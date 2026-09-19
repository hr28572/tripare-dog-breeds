import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { triggerSync } from '@/hooks/useOfflineSync';
import { useSyncStatus, type SyncStatusView } from '@/stores/syncStore';
import { formatRelativeTime } from '@/utils/format';

/** Re-render every 30s so "X min ago" stays honest. */
function useClock(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

type Tone = 'info' | 'warning' | 'danger' | 'muted';

export function describeSyncStatus(
  s: SyncStatusView,
  now: number,
): { text: string; tone: Tone; canRetry: boolean; icon: keyof typeof Ionicons.glyphMap } {
  const ago = formatRelativeTime(s.lastSyncedAt, now);
  if (s.isSyncing) return { text: 'Syncing breeds…', tone: 'info', canRetry: false, icon: 'sync' };
  if (!s.isOnline) {
    return s.hasCachedData
      ? { text: `Offline — showing cached data (synced ${ago})`, tone: 'warning', canRetry: false, icon: 'cloud-offline' }
      : { text: 'Offline — connect to load breeds', tone: 'danger', canRetry: false, icon: 'cloud-offline' };
  }
  if (s.lastStatus === 'failed') {
    return {
      text: s.hasCachedData ? `Sync failed — showing cached data (synced ${ago})` : 'Sync failed — tap to retry',
      tone: 'danger',
      canRetry: true,
      icon: 'alert-circle',
    };
  }
  if (s.lastStatus === 'partial') {
    return { text: `Partial sync — some breeds may be stale (synced ${ago})`, tone: 'warning', canRetry: true, icon: 'warning' };
  }
  return { text: `Last synced ${ago}`, tone: 'muted', canRetry: true, icon: 'checkmark-circle' };
}

export function SyncBanner() {
  const status = useSyncStatus();
  const now = useClock();
  const theme = useTheme();
  if (!status.hydrated) return null;

  const { text, tone, canRetry, icon } = describeSyncStatus(status, now);
  const color =
    tone === 'danger' ? theme.danger : tone === 'warning' ? theme.warning : tone === 'info' ? theme.tint : theme.textSecondary;

  return (
    <Pressable
      onPress={canRetry ? () => void triggerSync() : undefined}
      accessibilityRole={canRetry ? 'button' : 'text'}
      accessibilityLabel={canRetry ? `${text}. Tap to sync now` : text}
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.row}>
        {status.isSyncing ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon} size={16} color={color} />}
        <ThemedText type="small" style={[styles.text, { color }]} numberOfLines={2}>
          {text}
        </ThemedText>
        {canRetry && !status.isSyncing && <Ionicons name="refresh" size={16} color={theme.textSecondary} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  text: { flex: 1 },
});
