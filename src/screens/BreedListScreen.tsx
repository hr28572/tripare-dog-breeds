import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
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

/**
 * How far beyond the viewport FlashList keeps rows mounted (dp). Its default of
 * 250 is under three rows, so a fast fling outruns the JS thread and the rows
 * entering the viewport are still blank: white space under the pinned section
 * header until rendering catches up. FlashList splits 2 x this value 70/30 in
 * favour of the scroll direction, so ~12 rows are ready ahead and ~5 behind,
 * which also covers the moment the user reverses from a downward fling.
 */
const LIST_DRAW_DISTANCE = 800;

export function BreedListScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pulling, setPulling] = useState(false);
  // True while the list is dragged below its top edge (pull-to-refresh). The pinned
  // section header must be hidden then: the real header moves down with the content
  // under the spinner while the pinned copy stays put, so both would be visible.
  const [overscrolled, setOverscrolled] = useState(false);

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

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const over = e.nativeEvent.contentOffset.y < -1;
    setOverscrolled((prev) => (prev === over ? prev : over));
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
        <SyncBanner />
        <View style={styles.header}>
          <ThemedText type="subtitle" style={styles.title}>
            Breeds
          </ThemedText>
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
        </View>
        <View style={styles.filters}>
          <FilterBar onOpenSheet={() => setSheetOpen(true)} resultCount={rows.length} groupCount={groupCount} />
        </View>
        {/* Remount on filter/search change so a new result set starts at the top with a
            fresh recycler, and again when the list first goes from empty to populated: on a
            first launch the pages arrive one by one, and on slower devices the transition
            from ListEmptyComponent to real rows inside a live instance left a one-row blank
            under the pinned header until the next page landed. A fresh mount takes the same
            path as a normal cached launch. maintainVisibleContentPosition (on by default in
            FlashList v2) is disabled: with sticky headers it tried to keep the previous first
            item in place when the data set was replaced, leaving a blank gap under the header. */}
        <FlashList
          key={`${filterKey}:${items.length > 0 ? 'data' : 'empty'}`}
          data={items}
          drawDistance={LIST_DRAW_DISTANCE}
          maintainVisibleContentPosition={{ disabled: true }}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
          stickyHeaderIndices={overscrolled || pulling ? undefined : stickyHeaderIndices}
          ListEmptyComponent={empty}
          refreshing={pulling}
          onRefresh={onRefresh}
          onScroll={onScroll}
          scrollEventThrottle={16}
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
