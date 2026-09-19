import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { normalizeBreed } from '@/api/normalize';
import { breedQueryOptions } from '@/api/queries';
import { db } from '@/db/client';
import { getBreedDetail, upsertBreeds, type BreedDetail } from '@/db/repository';
import { useSyncStore } from '@/stores/syncStore';

/** Re-fetch a breed from the API if its row is older than this. */
export const DETAIL_STALE_MS = 24 * 60 * 60 * 1_000;

/**
 * A cached breed is considered stale when it is missing, has no images, or
 * was written more than DETAIL_STALE_MS ago. Pure, so it is unit-tested.
 */
export function isDetailStale(detail: BreedDetail | undefined, now = Date.now()): boolean {
  if (!detail) return true;
  if (detail.images.length === 0) return true;
  return now - detail.breed.updatedAt > DETAIL_STALE_MS;
}

export interface BreedDetailState {
  detail: BreedDetail | undefined;
  /** true while a network refresh for this breed is in flight */
  refreshing: boolean;
}

/**
 * Reads a breed from SQLite immediately (works offline). If the cached row
 * looks stale or incomplete, refreshes it from /breeds/:id in the background
 * and writes the result back before re-reading. The UI never waits on network.
 */
export function useBreedDetail(id: string | undefined): BreedDetailState {
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const localWriteVersion = useSyncStore((s) => s.localWriteVersion);

  const detail = useMemo(
    () => (id ? getBreedDetail(db, id) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, lastSyncedAt, localWriteVersion],
  );

  const query = useQuery({ ...breedQueryOptions(id ?? ''), enabled: !!id && isDetailStale(detail) });

  // Persist the fresh API record; the store bump makes the memo above re-read.
  useEffect(() => {
    if (!query.data) return;
    const normalized = normalizeBreed(query.data, Date.now());
    if (!normalized.ok) return;
    upsertBreeds(db, [normalized.breed], normalized.images);
    useSyncStore.getState().bumpLocalWrite();
  }, [query.data]);

  return { detail, refreshing: query.isFetching };
}
