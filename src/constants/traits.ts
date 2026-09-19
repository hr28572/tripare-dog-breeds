import type { TraitKey } from '@/types/breed';

export interface TraitMeta {
  key: TraitKey;
  label: string;
  /** Meaning of the low and high end of the 1–5 scale. */
  low: string;
  high: string;
}

/** Display order and copy for the Traits tab. */
export const TRAIT_META: TraitMeta[] = [
  { key: 'energy', label: 'Energy', low: 'Calm', high: 'Very active' },
  { key: 'trainability', label: 'Trainability', low: 'Stubborn', high: 'Eager to please' },
  { key: 'goodWithChildren', label: 'Good with children', low: 'Cautious', high: 'Great' },
  { key: 'goodWithDogs', label: 'Good with dogs', low: 'Cautious', high: 'Great' },
  { key: 'goodWithStrangers', label: 'Good with strangers', low: 'Reserved', high: 'Everyone’s friend' },
  { key: 'apartmentFriendly', label: 'Apartment friendly', low: 'Needs space', high: 'Happy indoors' },
  { key: 'barking', label: 'Barking', low: 'Quiet', high: 'Vocal' },
  { key: 'drooling', label: 'Drooling', low: 'Dry', high: 'Bring a towel' },
  { key: 'shedding', label: 'Shedding', low: 'Minimal', high: 'Heavy' },
  { key: 'grooming', label: 'Grooming needs', low: 'Low', high: 'High' },
  { key: 'exerciseMinutes', label: 'Daily exercise', low: '', high: '' },
];
