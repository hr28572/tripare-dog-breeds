import { create } from 'zustand';

import type { CoatLength, SizeBand, TraitKey } from '@/types/breed';

export interface TraitThreshold {
  trait: TraitKey;
  /** inclusive minimum score */
  min: number;
}

export interface ActiveFilters {
  groupIds: string[];
  sizeBands: SizeBand[];
  coatLengths: CoatLength[];
  hypoallergenicOnly: boolean;
  traitThresholds: TraitThreshold[];
}

export const DEFAULT_TRAIT_MIN = 4;

export const EMPTY_FILTERS: ActiveFilters = {
  groupIds: [],
  sizeBands: [],
  coatLengths: [],
  hypoallergenicOnly: false,
  traitThresholds: [],
};

export interface FilterState {
  /** Raw search input; the list hook debounces it. */
  searchQuery: string;
  /** Survives navigation to detail and back because it lives here, not in the screen. */
  activeFilters: ActiveFilters;

  setSearchQuery: (query: string) => void;
  toggleGroup: (groupId: string) => void;
  toggleSizeBand: (band: SizeBand) => void;
  toggleCoatLength: (length: CoatLength) => void;
  setHypoallergenicOnly: (value: boolean) => void;
  toggleTrait: (trait: TraitKey) => void;
  /** Applies one minimum to every selected trait threshold. */
  setTraitMin: (min: number) => void;
  clearAll: () => void;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export const useFilterStore = create<FilterState>((set) => ({
  searchQuery: '',
  activeFilters: EMPTY_FILTERS,

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  toggleGroup: (groupId) =>
    set((s) => ({ activeFilters: { ...s.activeFilters, groupIds: toggle(s.activeFilters.groupIds, groupId) } })),
  toggleSizeBand: (band) =>
    set((s) => ({ activeFilters: { ...s.activeFilters, sizeBands: toggle(s.activeFilters.sizeBands, band) } })),
  toggleCoatLength: (length) =>
    set((s) => ({ activeFilters: { ...s.activeFilters, coatLengths: toggle(s.activeFilters.coatLengths, length) } })),
  setHypoallergenicOnly: (hypoallergenicOnly) => set((s) => ({ activeFilters: { ...s.activeFilters, hypoallergenicOnly } })),
  toggleTrait: (trait) =>
    set((s) => {
      const existing = s.activeFilters.traitThresholds;
      const current = existing.find((t) => t.trait === trait);
      const min = existing[0]?.min ?? DEFAULT_TRAIT_MIN;
      return {
        activeFilters: {
          ...s.activeFilters,
          traitThresholds: current ? existing.filter((t) => t.trait !== trait) : [...existing, { trait, min }],
        },
      };
    }),
  setTraitMin: (min) =>
    set((s) => ({
      activeFilters: { ...s.activeFilters, traitThresholds: s.activeFilters.traitThresholds.map((t) => ({ ...t, min })) },
    })),
  clearAll: () => set({ activeFilters: EMPTY_FILTERS }),
}));

/** Number of active filter selections, for the badge. Search is not a filter. */
export function countActiveFilters(f: ActiveFilters): number {
  return f.groupIds.length + f.sizeBands.length + f.coatLengths.length + (f.hypoallergenicOnly ? 1 : 0) + f.traitThresholds.length;
}
