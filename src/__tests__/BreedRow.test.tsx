import { fireEvent, render, screen } from '@testing-library/react-native';

import { BreedRow } from '@/components/BreedRow';

import { makeRow } from './helpers/factories';

describe('<BreedRow />', () => {
  it('renders name, group, life span, size badge and hypoallergenic tag', async () => {
    await render(<BreedRow breed={makeRow()} onPress={jest.fn()} />);
    expect(screen.getByText('Affenpinscher')).toBeTruthy();
    expect(screen.getByText('Toy · 14–16 years')).toBeTruthy();
    expect(screen.getByText('Small')).toBeTruthy();
    expect(screen.getByText('Hypoallergenic')).toBeTruthy();
    // three trait badges: energy 3, good with children 3, shedding 2
    expect(screen.getAllByText('3')).toHaveLength(2);
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('calls onPress with the breed id and hides tags when absent', async () => {
    const onPress = jest.fn();
    await render(<BreedRow breed={makeRow({ id: 'x9', hypoallergenic: false, sizeBand: null, groupName: null })} onPress={onPress} />);
    await fireEvent.press(screen.getByText('Affenpinscher'));
    expect(onPress).toHaveBeenCalledWith('x9');
    expect(screen.queryByText('Hypoallergenic')).toBeNull();
    expect(screen.queryByText('Small')).toBeNull();
    expect(screen.getByText('14–16 years')).toBeTruthy();
  });
});
