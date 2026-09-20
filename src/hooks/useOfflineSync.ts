import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef } from 'react';

import { breedsQueryOptions, groupsQueryOptions, LIST_STALE_TIME_MS } from '@/api/queries';
import { isOnlineState, queryClient } from '@/api/queryClient';
import { db } from '@/db/client';
import { createDbImageIndex } from '@/db/imageIndex';
import { getSyncMeta } from '@/db/repository';
import { runSync, type SyncResult } from '@/db/sync';
import { useSyncStore } from '@/stores/syncStore';
import { createImageCache } from '@/utils/imageCache';
import { measureAsync } from '@/utils/perf';
import { createExpoCacheFs } from '@/utils/imageCache.expo';

/** Shared cache instance (thumbs on sync; medium/large on demand from the Gallery). */
export const imageCache = createImageCache({
  index: createDbImageIndex(db),
  fs: createExpoCacheFs(),
  log: (message, error) => console.warn(`[imageCache] ${message}`, error),
});

let inFlight: Promise<SyncResult> | null = null;

/**
 * Run a sync unless one is already running. Fetches go through React Query's
 * fetchQuery so the explicit retry/backoff policy applies, and the result is
 * cached for any screen that also uses useBreedsQuery/useGroupsQuery.
 */
export function triggerSync(): Promise<SyncResult> {
  if (inFlight) return inFlight;
  const store = useSyncStore.getState();
  store.setSyncing(true);
  inFlight = measureAsync('sync.total', () =>
    runSync(db, {
      fetchBreeds: (onPage) => queryClient.fetchQuery(breedsQueryOptions(onPage)),
      fetchGroups: () => queryClient.fetchQuery(groupsQueryOptions()),
      imageCache,
      log: (message, error) => console.warn(`[sync] ${message}`, error),
      onProgress: (progress) => useSyncStore.getState().setProgress(progress),
    }),
  )
    .then((result) => {
      useSyncStore.getState().hydrateFromMeta(result.meta);
      return result;
    })
    .finally(() => {
      useSyncStore.getState().setSyncing(false);
      inFlight = null;
    });
  return inFlight;
}

export function isSyncStale(lastSyncedAt: number | null, now = Date.now()): boolean {
  return lastSyncedAt === null || now - lastSyncedAt > LIST_STALE_TIME_MS;
}

/**
 * Mount once near the root (after migrations). Hydrates sync status from
 * SQLite, syncs on launch when stale, and re-syncs when connectivity returns.
 */
export function useOfflineSync(): void {
  const wasOnline = useRef<boolean | null>(null);

  useEffect(() => {
    const store = useSyncStore.getState();
    const meta = getSyncMeta(db);
    store.hydrateFromMeta(meta);

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = isOnlineState(state);
      useSyncStore.getState().setOnline(online);
      const cameBackOnline = wasOnline.current === false && online;
      const firstReading = wasOnline.current === null;
      wasOnline.current = online;

      if (!online) return;
      if (cameBackOnline) {
        void triggerSync();
      } else if (firstReading && isSyncStale(useSyncStore.getState().lastSyncedAt)) {
        void triggerSync();
      }
    });

    return unsubscribe;
  }, []);
}

export { useSyncStatus } from '@/stores/syncStore';
