import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import type { SyncMeta } from '@/db/schema';
import type { SyncProgress, SyncStatus } from '@/types/breed';

export interface SyncState {
  /** true once sync_meta has been read from SQLite on startup */
  hydrated: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  lastStatus: SyncStatus | null;
  lastSyncedAt: number | null;
  lastAttemptAt: number | null;
  lastError: string | null;
  breedCount: number;
  imageCount: number;
  parseFailureCount: number;
  /** Bumped after any local write outside a full sync (e.g. detail refresh) so readers re-query. */
  localWriteVersion: number;
  /** Page-by-page progress of the running sync; null when idle. */
  syncProgress: SyncProgress | null;

  hydrateFromMeta: (meta: SyncMeta | undefined) => void;
  setOnline: (online: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  bumpLocalWrite: () => void;
  /** A page was written: readers re-query, and the list leaves its empty state at once. */
  setProgress: (progress: SyncProgress) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  hydrated: false,
  isOnline: true,
  isSyncing: false,
  lastStatus: null,
  lastSyncedAt: null,
  lastAttemptAt: null,
  lastError: null,
  breedCount: 0,
  imageCount: 0,
  parseFailureCount: 0,
  localWriteVersion: 0,
  syncProgress: null,

  hydrateFromMeta: (meta) =>
    set({
      hydrated: true,
      lastStatus: meta?.lastSyncStatus ?? null,
      lastSyncedAt: meta?.lastSyncedAt ?? null,
      lastAttemptAt: meta?.lastAttemptAt ?? null,
      lastError: meta?.lastError ?? null,
      breedCount: meta?.breedCount ?? 0,
      imageCount: meta?.imageCount ?? 0,
      parseFailureCount: meta?.parseFailureCount ?? 0,
    }),
  setOnline: (isOnline) => set({ isOnline }),
  setSyncing: (isSyncing) => set(isSyncing ? { isSyncing } : { isSyncing, syncProgress: null }),
  bumpLocalWrite: () => set((s) => ({ localWriteVersion: s.localWriteVersion + 1 })),
  setProgress: (progress) =>
    set((s) => ({
      syncProgress: progress,
      breedCount: Math.max(s.breedCount, progress.breedsWritten),
      localWriteVersion: s.localWriteVersion + 1,
    })),
}));

/** What the banner and Settings read: "last synced X ago", "offline, showing cached data", etc. */
export function useSyncStatus() {
  return useSyncStore(
    useShallow((s) => ({
      hydrated: s.hydrated,
      isOnline: s.isOnline,
      isSyncing: s.isSyncing,
      lastStatus: s.lastStatus,
      lastSyncedAt: s.lastSyncedAt,
      lastAttemptAt: s.lastAttemptAt,
      lastError: s.lastError,
      breedCount: s.breedCount,
      imageCount: s.imageCount,
      parseFailureCount: s.parseFailureCount,
      syncProgress: s.syncProgress,
      hasCachedData: s.breedCount > 0,
    })),
  );
}

export type SyncStatusView = ReturnType<typeof useSyncStatus>;
