import { buildBreedSections } from '@/utils/sections';

import { makeRow } from './helpers/factories';

describe('buildBreedSections', () => {
  it('emits one header per group in row order and records sticky indices', () => {
    const rows = [
      makeRow({ id: 'a', name: 'Akita', groupName: 'Working Group' }),
      makeRow({ id: 'b', name: 'Boxer', groupName: 'Working Group' }),
      makeRow({ id: 'c', name: 'Beagle', groupName: 'Hound Group' }),
      makeRow({ id: 'd', name: 'Mutt', groupName: null }),
    ];
    const { items, stickyHeaderIndices, groupCount } = buildBreedSections(rows);
    expect(groupCount).toBe(3);
    expect(stickyHeaderIndices).toEqual([0, 3, 5]);
    expect(items.map((i) => (i.type === 'header' ? `# ${i.title} (${i.count})` : i.breed.name))).toEqual([
      '# Working Group (2)',
      'Akita',
      'Boxer',
      '# Hound Group (1)',
      'Beagle',
      '# Other (1)',
      'Mutt',
    ]);
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
  });

  it('handles an empty list', () => {
    expect(buildBreedSections([])).toEqual({ items: [], stickyHeaderIndices: [], groupCount: 0 });
  });
});
