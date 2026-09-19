import { deriveSizeBand, sizeBandFromHeightCm, sizeBandFromWeightKg } from '@/utils/sizeBand';

describe('sizeBandFromWeightKg', () => {
  it.each([
    [3, 'small'],
    [10, 'small'],
    [10.5, 'medium'],
    [25, 'medium'],
    [25.1, 'large'],
    [45, 'large'],
    [46, 'giant'],
    [113, 'giant'],
  ])('%s kg → %s', (kg, band) => {
    expect(sizeBandFromWeightKg(kg)).toBe(band);
  });
});

describe('deriveSizeBand', () => {
  it('uses the heavier of male/female max weight', () => {
    expect(deriveSizeBand({ maleWeightMax: 9, femaleWeightMax: 12 })).toBe('medium');
    expect(deriveSizeBand({ maleWeightMax: 40, femaleWeightMax: 50 })).toBe('giant');
  });

  it('falls back to height when weight is missing', () => {
    expect(deriveSizeBand({ maleHeightMax: 30 })).toBe('small');
    expect(deriveSizeBand({ maleWeightMax: null, femaleHeightMax: 70 })).toBe('giant');
    expect(sizeBandFromHeightCm(50)).toBe('medium');
  });

  it('ignores zero, negative and non-finite values', () => {
    expect(deriveSizeBand({ maleWeightMax: 0, femaleWeightMax: -1, maleHeightMax: Number.NaN })).toBeNull();
    expect(deriveSizeBand({})).toBeNull();
  });
});
