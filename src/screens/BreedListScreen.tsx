import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BreedRow } from '@/components/BreedRow';
import { EmptyState } from '@/components/EmptyState';
import { FilterBar } from '@/components/FilterBar';
import { FilterSheet } from '@/components/FilterSheet';
import { SearchBar } from '@/components/SearchBar';
import { SectionHeader } from '@/components/SectionHeader';
import { SyncBanner } from '@/components/SyncBanner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { listGroups } from '@/db/repository';
import { useTheme } from '@/hooks/use-theme';
import { useBreedsList } from '@/hooks/useBreedsList';
import { triggerSync } from '@/hooks/useOfflineSync';
import { countActiveFilters, useFilterStore } from '@/stores/filterStore';
import { useSyncStatus, useSyncStore } from '@/stores/syncStore';
import { markSinceAppStart } from '@/utils/perf';
import type { BreedListItem } from '@/utils/sections';

let firstRowMarked = false;

export function BreedListScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pulling, setPulling] = useState(false);

  const searchQuery = useFilterStore((s) => s.searchQuery);
  const setSearchQuery = useFilterStore((s) => s.setSearchQuery);
  const activeFilters = useFilterStore((s) => s.activeFilters);
  const clearAll = useFilterStore((s) => s.clearAll);

  const { rows, items, stickyHeaderIndices, groupCount, filterKey } = useBreedsList();
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groups = useMemo(() => listGroups(db), [lastSyncedAt]);
  const sync = useSyncStatus();

  useEffect(() => {
    if (!firstRowMarked && rows.length > 0) {
      firstRowMarked = true;
      markSinceAppStart('startup.firstRow');
    }
  }, [rows.length]);


  const onRefresh = useCallback(() => {
    setPulling(true);
    void triggerSync().finally(() => setPulling(false));
  }, []);

  const openBreed = useCallback((id: string) => router.push({ pathname: '/breed/[id]', params: { id } }), [router]);
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<BreedListItem>) =>
      item.type === 'header' ? <SectionHeader title={item.title} count={item.count} /> : <BreedRow breed={item.breed} onPress={openBreed} />,
    [openBreed],
  );
  const keyExtractor = useCallback((item: BreedListItem) => item.key, []);
  const getItemType = useCallback((item: BreedListItem) => item.type, []);

  const hasAnyFilter = searchQuery.trim().length > 0 || countActiveFilters(activeFilters) > 0;

  const empty = !sync.hasCachedData ? (
    sync.isSyncing ? (
      <EmptyState icon="paw" title="Loading breeds…" message="Fetching all 283 breeds for offline use." />
    ) : (
      <EmptyState
        icon="cloud-offline"
        title="No breeds yet"
        message={sync.isOnline ? 'The first sync did not complete.' : 'Connect to the internet to download the breed catalogue once.'}
        actionLabel={sync.isOnline ? 'Retry sync' : undefined}
        onAction={() => void triggerSync()}
      />
    )
  ) : (
    <EmptyState
      icon="search"
      title="No breeds match"
      message="Try a different name or loosen the filters."
      actionLabel={hasAnyFilter ? 'Clear filters' : undefined}
      onAction={() => {
        clearAll();
        setSearchQuery('');
      }}
    />
  );

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <View style={styles.header}>
          <ThemedText type="subtitle" style={styles.title}>
            Breeds
          </ThemedText>
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
        </View>
        <SyncBanner />
        <View style={styles.filters}>
          <FilterBar onOpenSheet={() => setSheetOpen(true)} resultCount={rows.length} groupCount={groupCount} />
        </View>
        {/* Remount on filter/search change so a new result set starts at the top with a
            fresh recycler. maintainVisibleContentPosition (on by default in FlashList v2)
            is disabled: with sticky headers it tried to keep the previous first item in
            place when the data set was replaced, leaving a blank gap under the header. */}
        <FlashList
          key={filterKey}
          data={items}
          maintainVisibleContentPosition={{ disabled: true }}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
          stickyHeaderIndices={stickyHeaderIndices}
          ListEmptyComponent={empty}
          refreshing={pulling}
          onRefresh={onRefresh}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ backgroundColor: theme.background }}
        />
        <FilterSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} groups={groups} />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.two, gap: Spacing.two },
  title: { fontSize: 28, lineHeight: 34 },
  filters: { paddingVertical: Spacing.two },
});
