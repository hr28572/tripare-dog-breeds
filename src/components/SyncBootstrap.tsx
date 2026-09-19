import { useOfflineSync } from '@/hooks/useOfflineSync';

/** Renders nothing; mounts the offline sync lifecycle once. */
export function SyncBootstrap() {
  useOfflineSync();
  return null;
}
