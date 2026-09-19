import { formatLifeSpan, formatRange, formatRelativeTime, joinNonEmpty } from '@/utils/format';

const NOW = 1_700_000_000_000;

describe('formatRelativeTime', () => {
  it.each([
    [null, 'never'],
    [NOW - 10_000, 'just now'],
    [NOW - 3 * 60_000, '3 min ago'],
    [NOW - 2 * 3_600_000, '2 h ago'],
    [NOW - 30 * 3_600_000, 'yesterday'],
    [NOW - 5 * 86_400_000, '5 days ago'],
  ])('%s → %s', (ts, expected) => {
    expect(formatRelativeTime(ts, NOW)).toBe(expected);
  });
});

describe('formatRange / formatLifeSpan', () => {
  it('formats ranges and single values', () => {
    expect(formatRange(4, 6, 'kg')).toBe('4–6 kg');
    expect(formatRange(6, 6, 'kg')).toBe('6 kg');
    expect(formatRange(null, 6, 'kg')).toBe('6 kg');
    expect(formatRange(null, null, 'kg')).toBe('—');
    expect(formatRange(4.25, 6, 'kg')).toBe('4.3–6 kg');
    expect(formatLifeSpan(14, 16)).toBe('14–16 years');
  });

  it('joins non-empty parts', () => {
    expect(joinNonEmpty(['Toy', null, '', 'Germany'])).toBe('Toy · Germany');
  });
});
