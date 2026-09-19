import { fireEvent, render, screen } from '@testing-library/react-native';

import { FilterBar } from '@/components/FilterBar';
import { FilterSheet } from '@/components/FilterSheet';
import { EMPTY_FILTERS, useFilterStore } from '@/stores/filterStore';

const groups = [
  { id: 'g1', name: 'Toy' },
  { id: 'g2', name: 'Hound' },
];

describe('<FilterBar />', () => {
  beforeEach(() => useFilterStore.setState({ activeFilters: EMPTY_FILTERS }));

  it('toggles size bands, shows the count badge and clears all', async () => {
    const onOpen = jest.fn();
    await render(<FilterBar onOpenSheet={onOpen} resultCount={12} groupCount={3} />);
    expect(screen.getByLabelText('12 breeds in 3 groups')).toBeTruthy();

    await fireEvent.press(screen.getByText('Small'));
    await fireEvent.press(screen.getByText('Giant'));
    expect(useFilterStore.getState().activeFilters.sizeBands).toEqual(['small', 'giant']);
    expect(screen.getByText('Filters · 2')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText(/Filters, 2 active/));
    expect(onOpen).toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText('Clear all filters'));
    expect(useFilterStore.getState().activeFilters).toEqual(EMPTY_FILTERS);
  });
});

describe('<FilterSheet />', () => {
  beforeEach(() => useFilterStore.setState({ activeFilters: EMPTY_FILTERS }));

  it('multi-selects groups and coat lengths, toggles hypoallergenic', async () => {
    await render(<FilterSheet visible onClose={jest.fn()} groups={groups} />);
    await fireEvent.press(screen.getByText('Toy'));
    await fireEvent.press(screen.getByText('Hound'));
    expect(useFilterStore.getState().activeFilters.groupIds).toEqual(['g1', 'g2']);
    await fireEvent.press(screen.getByText('Toy'));
    expect(useFilterStore.getState().activeFilters.groupIds).toEqual(['g2']);

    await fireEvent.press(screen.getByText('Long'));
    await fireEvent.press(screen.getByText('Hairless'));
    expect(useFilterStore.getState().activeFilters.coatLengths).toEqual(['long', 'hairless']);

    await fireEvent(screen.getByLabelText('Hypoallergenic only'), 'valueChange', true);
    expect(useFilterStore.getState().activeFilters.hypoallergenicOnly).toBe(true);
    expect(screen.getByText('Filters (4)')).toBeTruthy();
  });

  it('adds trait thresholds with a shared minimum and clears everything', async () => {
    const onClose = jest.fn();
    await render(<FilterSheet visible onClose={onClose} groups={groups} />);
    expect(screen.queryByText('Minimum score')).toBeNull();

    await fireEvent.press(screen.getByText('Good with children'));
    expect(screen.getByText('Minimum score')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Minimum score 5'));
    await fireEvent.press(screen.getByText('Energy'));
    expect(useFilterStore.getState().activeFilters.traitThresholds).toEqual([
      { trait: 'goodWithChildren', min: 5 },
      { trait: 'energy', min: 5 },
    ]);

    await fireEvent.press(screen.getByLabelText('Clear all filters'));
    expect(useFilterStore.getState().activeFilters).toEqual(EMPTY_FILTERS);
    await fireEvent.press(screen.getByText('Show results'));
    expect(onClose).toHaveBeenCalled();
  });
});
