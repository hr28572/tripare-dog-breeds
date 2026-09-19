import { countActiveFilters, EMPTY_FILTERS, useFilterStore } from '@/stores/filterStore';

describe('filterStore', () => {
  beforeEach(() => useFilterStore.setState({ searchQuery: '', activeFilters: EMPTY_FILTERS }));

  it('toggles multi-select lists and counts active filters', () => {
    const s = useFilterStore.getState();
    s.toggleSizeBand('small');
    s.toggleSizeBand('giant');
    s.toggleSizeBand('small');
    s.toggleGroup('g1');
    s.toggleGroup('g2');
    s.toggleCoatLength('long');
    s.setHypoallergenicOnly(true);
    const f = useFilterStore.getState().activeFilters;
    expect(f).toMatchObject({ sizeBands: ['giant'], groupIds: ['g1', 'g2'], coatLengths: ['long'], hypoallergenicOnly: true });
    expect(countActiveFilters(f)).toBe(5);
  });

  it('adds trait thresholds at the shared minimum and updates all of them', () => {
    const s = useFilterStore.getState();
    s.toggleTrait('goodWithChildren');
    expect(useFilterStore.getState().activeFilters.traitThresholds).toEqual([{ trait: 'goodWithChildren', min: 4 }]);
    s.setTraitMin(5);
    s.toggleTrait('energy');
    expect(useFilterStore.getState().activeFilters.traitThresholds).toEqual([
      { trait: 'goodWithChildren', min: 5 },
      { trait: 'energy', min: 5 },
    ]);
    s.toggleTrait('goodWithChildren');
    expect(useFilterStore.getState().activeFilters.traitThresholds).toEqual([{ trait: 'energy', min: 5 }]);
  });

  it('clearAll resets filters but keeps the search query', () => {
    const s = useFilterStore.getState();
    s.setSearchQuery('pug');
    s.toggleSizeBand('small');
    s.toggleTrait('energy');
    s.clearAll();
    expect(useFilterStore.getState()).toMatchObject({ searchQuery: 'pug', activeFilters: EMPTY_FILTERS });
  });
});
