import { act, renderHook } from '@testing-library/react-native';

import { toListFilter, useBreedsList } from '@/hooks/useBreedsList';
import { EMPTY_FILTERS, useFilterStore } from '@/stores/filterStore';

import { makeRow } from './helpers/factories';

const mockListBreedRows = jest.fn();
jest.mock('@/db/repository', () => ({
  ...jest.requireActual('@/db/repository'),
  listBreedRows: (_db: unknown, filter: unknown) => mockListBreedRows(filter),
}));

describe('toListFilter', () => {
  it('omits empty selections and maps thresholds through', () => {
    expect(toListFilter('', EMPTY_FILTERS)).toEqual({
      search: undefined,
      groupIds: undefined,
      sizeBands: undefined,
      coatLengths: undefined,
      hypoallergenic: undefined,
      traitThresholds: undefined,
    });
    expect(
      toListFilter('pug', { ...EMPTY_FILTERS, groupIds: ['g1'], coatLengths: ['short'], hypoallergenicOnly: true, traitThresholds: [{ trait: 'energy', min: 3 }] }),
    ).toEqual({
      search: 'pug',
      groupIds: ['g1'],
      sizeBands: undefined,
      coatLengths: ['short'],
      hypoallergenic: true,
      traitThresholds: [{ trait: 'energy', min: 3 }],
    });
  });
});

describe('useBreedsList', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockListBreedRows.mockReset().mockReturnValue([makeRow({ groupName: 'Toy' }), makeRow({ id: 'b2', name: 'Beagle', groupName: 'Hound' })]);
    useFilterStore.setState({ searchQuery: '', activeFilters: EMPTY_FILTERS });
  });
  afterEach(() => jest.useRealTimers());

  it('reads from SQLite and builds sections', async () => {
    const { result } = await renderHook(() => useBreedsList());
    expect(result.current.rows).toHaveLength(2);
    expect(result.current.groupCount).toBe(2);
    expect(result.current.stickyHeaderIndices).toEqual([0, 2]);
  });

  it('applies filters immediately and search after the 300 ms debounce', async () => {
    const { result } = await renderHook(() => useBreedsList());
    await act(async () => useFilterStore.getState().toggleSizeBand('small'));
    expect(mockListBreedRows).toHaveBeenLastCalledWith(expect.objectContaining({ sizeBands: ['small'] }));

    await act(async () => useFilterStore.getState().setSearchQuery('bea'));
    expect(result.current.isSearchPending).toBe(true);
    expect(mockListBreedRows).not.toHaveBeenLastCalledWith(expect.objectContaining({ search: 'bea' }));
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(mockListBreedRows).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'bea', sizeBands: ['small'] }));
    expect(result.current.isSearchPending).toBe(false);
  });
});
