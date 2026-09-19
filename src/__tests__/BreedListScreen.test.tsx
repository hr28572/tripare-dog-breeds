import { fireEvent, render, screen } from '@testing-library/react-native';

import { triggerSync } from '@/hooks/useOfflineSync';
import { BreedListScreen } from '@/screens/BreedListScreen';
import { EMPTY_FILTERS, useFilterStore } from '@/stores/filterStore';
import { useSyncStore } from '@/stores/syncStore';

import { makeRow } from './helpers/factories';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const mockRows = jest.fn();
jest.mock('@/hooks/useBreedsList', () => ({
  useBreedsList: () => {
    const { buildBreedSections } = jest.requireActual('@/utils/sections');
    const rows = mockRows();
    return { rows, ...buildBreedSections(rows), filterKey: 'k', isSearchPending: false };
  },
}));
jest.mock('@/db/repository', () => ({ ...jest.requireActual('@/db/repository'), listGroups: () => [{ id: 'g1', name: 'Toy' }] }));

describe('<BreedListScreen />', () => {
  beforeEach(() => {
    mockPush.mockClear();
    (triggerSync as jest.Mock).mockClear();
    useFilterStore.setState({ searchQuery: '', activeFilters: EMPTY_FILTERS });
    useSyncStore.setState({ hydrated: true, isOnline: true, isSyncing: false, lastStatus: 'success', lastSyncedAt: Date.now(), breedCount: 3 });
    mockRows.mockReturnValue([
      makeRow({ groupName: 'Toy' }),
      makeRow({ id: 'b2', name: 'Pug', groupName: 'Toy', hypoallergenic: false }),
      makeRow({ id: 'b3', name: 'Beagle', groupName: 'Hound Group' }),
    ]);
  });

  it('renders group headers with rows beneath and navigates on press', async () => {
    await render(<BreedListScreen />);
    expect(screen.getByText('3 breeds · 2 groups')).toBeTruthy();
    expect(screen.getByLabelText('Toy, 2 breeds')).toBeTruthy();
    expect(screen.getByLabelText('Hound Group, 1 breeds')).toBeTruthy();
    await fireEvent.press(screen.getByText('Pug'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/breed/[id]', params: { id: 'b2' } });
  });

  it('binds the search input to the store', async () => {
    await render(<BreedListScreen />);
    await fireEvent.changeText(screen.getByLabelText('Search breeds'), 'pu');
    expect(useFilterStore.getState().searchQuery).toBe('pu');
  });

  it('shows the no-match empty state with a clear action', async () => {
    mockRows.mockReturnValue([]);
    useFilterStore.setState({ activeFilters: { ...EMPTY_FILTERS, sizeBands: ['giant'] } });
    await render(<BreedListScreen />);
    expect(screen.getByText('No breeds match')).toBeTruthy();
    await fireEvent.press(screen.getByText('Clear filters'));
    expect(useFilterStore.getState().activeFilters).toEqual(EMPTY_FILTERS);
  });

  it('shows the never-synced offline state', async () => {
    mockRows.mockReturnValue([]);
    useSyncStore.setState({ breedCount: 0, isOnline: false });
    await render(<BreedListScreen />);
    expect(screen.getByText('No breeds yet')).toBeTruthy();
    expect(screen.queryByText('Retry sync')).toBeNull();
  });

  it('offers a retry when online with no data', async () => {
    mockRows.mockReturnValue([]);
    useSyncStore.setState({ breedCount: 0, isOnline: true, lastStatus: 'failed' });
    await render(<BreedListScreen />);
    await fireEvent.press(screen.getByText('Retry sync'));
    expect(triggerSync).toHaveBeenCalled();
  });
});
