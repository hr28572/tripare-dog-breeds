import { normalizeBreeds, normalizeGroup, type ParseFailure } from '@/api/normalize';
import { PartialBreedsError } from '@/api/breeds';
import type { AppDb } from '@/db/client';
import { getSyncMeta, listPrimaryThumbs, upsertBreeds, upsertGroups, writeSyncMeta } from '@/db/repository';
import type { SyncMeta } from '@/db/schema';
import type { ApiBreedResource, ApiGroupResource, SyncStatus } from '@/types/breed';
import type { ImageCache } from '@/utils/imageCache';

export interface SyncDeps {
  fetchBreeds: () => Promise<ApiBreedResource[]>;
  fetchGroups: () => Promise<ApiGroupResource[]>;
  /** Optional: when provided, primary thumbs are prefetched after a write. */
  imageCache?: ImageCache;
  now?: () => number;
  log?: (message: string, error?: unknown) => void;
}

export interface SyncResult {
  status: SyncStatus;
  meta: SyncMeta;
  breedCount: number;
  imageCount: number;
  parseFailures: ParseFailure[];
  failedPages: number[];
  error: string | null;
  thumbs: { cached: number; failed: number } | null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

/**
 * One sync attempt:
 *   1. fetch groups and breeds (both go through the caller's retry policy)
 *   2. normalize; count parse failures
 *   3. upsert into SQLite in a transaction (prune only after a complete fetch)
 *   4. write sync_meta with success | partial | failed
 *   5. prefetch primary thumbs (best effort, does not affect status)
 *
 * Never throws: every outcome is recorded in sync_meta and returned.
 */
export async function runSync(db: AppDb, deps: SyncDeps): Promise<SyncResult> {
  const now = deps.now ?? (() => Date.now());
  const log = deps.log ?? (() => {});
  const startedAt = now();
  const previous = getSyncMeta(db);

  const [groupsSettled, breedsSettled] = await Promise.allSettled([deps.fetchGroups(), deps.fetchBreeds()]);

  const errors: string[] = [];
  let failedPages: number[] = [];
  let complete = true;

  let groupResources: ApiGroupResource[] = [];
  if (groupsSettled.status === 'fulfilled') {
    groupResources = groupsSettled.value;
  } else {
    complete = false;
    errors.push(`groups: ${errorMessage(groupsSettled.reason)}`);
  }

  let breedResources: ApiBreedResource[] = [];
  if (breedsSettled.status === 'fulfilled') {
    breedResources = breedsSettled.value;
  } else if (breedsSettled.reason instanceof PartialBreedsError) {
    complete = false;
    breedResources = breedsSettled.reason.fetched;
    failedPages = breedsSettled.reason.failedPages;
    errors.push(`breeds: ${breedsSettled.reason.message}`);
  } else {
    complete = false;
    errors.push(`breeds: ${errorMessage(breedsSettled.reason)}`);
  }

  const groupRows = groupResources.map(normalizeGroup).filter((g): g is NonNullable<typeof g> => g !== null);
  const normalized = normalizeBreeds(breedResources, startedAt);
  const hasData = normalized.breeds.length > 0 || groupRows.length > 0;

  let breedCount = previous?.breedCount ?? 0;
  let imageCount = previous?.imageCount ?? 0;
  let orphanedLocalUris: string[] = [];
  let status: SyncStatus;

  if (!hasData) {
    status = 'failed';
  } else {
    try {
      upsertGroups(db, groupRows);
      const written = upsertBreeds(db, normalized.breeds, normalized.images, {
        pruneMissing: complete && breedsSettled.status === 'fulfilled',
      });
      breedCount = written.breedCount;
      imageCount = written.imageCount;
      orphanedLocalUris = written.orphanedLocalUris;
      status = complete && normalized.failures.length === 0 ? 'success' : 'partial';
      if (normalized.failures.length > 0) {
        errors.push(`${normalized.failures.length} breed(s) failed to parse`);
      }
    } catch (error) {
      log('sync: database write failed', error);
      errors.push(`db: ${errorMessage(error)}`);
      status = 'failed';
    }
  }

  const error = errors.length > 0 ? errors.join(' | ') : null;
  const meta = writeSyncMeta(db, {
    lastAttemptAt: startedAt,
    lastSyncedAt: status === 'failed' ? (previous?.lastSyncedAt ?? null) : startedAt,
    lastSyncStatus: status,
    lastError: error,
    breedCount,
    imageCount,
    parseFailureCount: normalized.failures.length,
  });

  let thumbs: SyncResult['thumbs'] = null;
  if (deps.imageCache && status !== 'failed') {
    deps.imageCache.removeFiles(orphanedLocalUris);
    thumbs = await deps.imageCache.prefetch(
      listPrimaryThumbs(db).map((row) => ({ id: row.id, url: row.url, variant: row.variant })),
    );
  }

  return {
    status,
    meta,
    breedCount,
    imageCount,
    parseFailures: normalized.failures,
    failedPages,
    error,
    thumbs,
  };
}
