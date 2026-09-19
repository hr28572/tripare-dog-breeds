import { useMemo } from 'react';

import { db } from '@/db/client';
import { listBreedRows, type BreedListRow, type ListBreedsFilter } from '@/db/repository';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { useFilterStore, type ActiveFilters } from '@/stores/filterStore';
import { useSyncStore } from '@/stores/syncStore';
import { measureSync } from '@/utils/perf';
import { buildBreedSections, type BreedSections } from '@/utils/sections';

/** Map store state to the repository filter. Pure, so it is unit-tested. */
export function toListFilter(search: string, f: ActiveFilters): ListBreedsFilter {
  return {
    search: search || undefined,
    groupIds: f.groupIds.length > 0 ? f.groupIds : undefined,
    sizeBands: f.sizeBands.length > 0 ? f.sizeBands : undefined,
    coatLengths: f.coatLengths.length > 0 ? f.coatLengths : undefined,
    hypoallergenic: f.hypoallergenicOnly ? true : undefined,
    traitThresholds: f.traitThresholds.length > 0 ? f.traitThresholds : undefined,
  };
}

export interface BreedsListResult extends BreedSections {
  rows: BreedListRow[];
  /** Changes whenever the effective search/filter changes; screens use it to scroll to top. */
  filterKey: string;
  /** true while the debounced search lags the input */
  isSearchPending: boolean;
}

/**
 * Reads the breed list straight from SQLite, driven reactively by the filter
 * store (search debounced 300 ms) and re-queried when a sync or local write
 * lands. No React Query cache is involved, so online and offline are identical.
 */
export function useBreedsList(): BreedsListResult {
  const searchQuery = useFilterStore((s) => s.searchQuery);
  const activeFilters = useFilterStore((s) => s.activeFilters);
  const debouncedSearch = useDebouncedSearch(searchQuery);

  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const localWriteVersion = useSyncStore((s) => s.localWriteVersion);

  const filter = useMemo(() => toListFilter(debouncedSearch, activeFilters), [debouncedSearch, activeFilters]);
  const filterKey = JSON.stringify(filter);

  const rows = useMemo(
    () => measureSync('list.query', () => listBreedRows(db, filter)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterKey, lastSyncedAt, isSyncing, localWriteVersion],
  );
  const sections = useMemo(() => buildBreedSections(rows), [rows]);

  return { rows, ...sections, filterKey, isSearchPending: debouncedSearch !== searchQuery.trim() };
}
