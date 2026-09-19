import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InfoRow } from '@/components/InfoRow';
import { describeSyncStatus } from '@/components/SyncBanner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { imageCache, triggerSync } from '@/hooks/useOfflineSync';
import { useSyncStatus, useSyncStore } from '@/stores/syncStore';
import { capitalize, formatRelativeTime } from '@/utils/format';
import { getPerfMarks, subscribePerf } from '@/utils/perf';

const DATA_SOURCE_URL = 'https://dogapi.dog';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SettingsScreen() {
  const theme = useTheme();
  const sync = useSyncStatus();
  const localWriteVersion = useSyncStore((s) => s.localWriteVersion);
  const [clearing, setClearing] = useState(false);
  const perfMarks = useSyncExternalStore(subscribePerf, getPerfMarks, getPerfMarks);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cache = useMemo(() => imageCache.stats(), [sync.lastSyncedAt, sync.isSyncing, localWriteVersion, clearing]);
  const status = describeSyncStatus(sync, Date.now());

  const confirmClearCache = () => {
    Alert.alert('Clear image cache?', `This removes ${cache.count} cached photos (${formatBytes(cache.bytes)}). They will be downloaded again when needed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          setClearing(true);
          imageCache.clear();
          useSyncStore.getState().bumpLocalWrite();
          setClearing(false);
        },
      },
    ]);
  };

  const recentMarks = useMemo(() => [...perfMarks].reverse().slice(0, 8), [perfMarks]);

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle" style={styles.title}>
            Settings
          </ThemedText>

          <Section title="Sync">
            <InfoRow label="Status" value={status.text} />
            <InfoRow label="Last synced" value={formatRelativeTime(sync.lastSyncedAt)} />
            <InfoRow label="Last attempt" value={formatRelativeTime(sync.lastAttemptAt)} />
            <InfoRow label="Result" value={sync.lastStatus ? capitalize(sync.lastStatus) : null} />
            <InfoRow label="Breeds" value={String(sync.breedCount)} />
            <InfoRow label="Image records" value={String(sync.imageCount)} />
            {sync.parseFailureCount > 0 && <InfoRow label="Parse failures" value={String(sync.parseFailureCount)} />}
            {sync.lastError && <InfoRow label="Last error" value={sync.lastError} />}
            <Button
              label={sync.isSyncing ? 'Syncing…' : 'Sync now'}
              onPress={() => void triggerSync()}
              disabled={sync.isSyncing || !sync.isOnline}
              busy={sync.isSyncing}
            />
            {!sync.isOnline && (
              <ThemedText type="small" themeColor="textSecondary">
                You are offline. Sync resumes automatically when a connection returns.
              </ThemedText>
            )}
          </Section>

          <Section title="Storage">
            <InfoRow label="Cached photos" value={`${cache.count} files · ${formatBytes(cache.bytes)}`} />
            <InfoRow label="Cache limit" value={formatBytes(cache.maxBytes)} />
            <ThemedText type="small" themeColor="textSecondary">
              Thumbnails are stored after each sync so the list works offline. Larger photos are stored when you open a gallery and are evicted least-recently-used first.
            </ThemedText>
            <Button label="Clear image cache" onPress={confirmClearCache} disabled={cache.count === 0} destructive />
          </Section>

          {__DEV__ && (
            <Section title="Performance (dev)">
              {recentMarks.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  No measurements yet.
                </ThemedText>
              ) : (
                recentMarks.map((m, i) => <InfoRow key={`${m.label}-${m.at}-${i}`} label={m.label} value={`${m.ms} ms`} />)
              )}
            </Section>
          )}

          <Section title="About">
            <InfoRow label="Version" value={Constants.expoConfig?.version ?? '—'} />
            <Pressable onPress={() => WebBrowser.openBrowserAsync(DATA_SOURCE_URL)} accessibilityRole="link">
              <ThemedText type="small" themeColor="tint">
                Breed data and photos from dogapi.dog
              </ThemedText>
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary">
              Photos are Creative Commons or public domain; each gallery photo shows its author and license.
            </ThemedText>
          </Section>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );

  function Button({ label, onPress, disabled, busy, destructive }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; destructive?: boolean }) {
    const bg = destructive ? theme.backgroundElement : theme.tint;
    const fg = destructive ? theme.danger : theme.onTint;
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled, busy: !!busy }}
        style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}>
        {busy && <ActivityIndicator size="small" color={fg} />}
        <ThemedText type="smallBold" style={{ color: fg }}>
          {label}
        </ThemedText>
      </Pressable>
    );
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  title: { fontSize: 28, lineHeight: 34 },
  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 12, letterSpacing: 0.6 },
  button: {
    minHeight: 48,
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: Spacing.two + 4,
    marginTop: Spacing.one,
  },
});
