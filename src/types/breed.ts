// Shared types for the Dog API v2 (JSON:API) payloads and the app's domain model.

export const SIZE_BANDS = ['small', 'medium', 'large', 'giant'] as const;
export type SizeBand = (typeof SIZE_BANDS)[number];

export const COAT_LENGTHS = ['hairless', 'short', 'medium', 'long'] as const;
export type CoatLength = (typeof COAT_LENGTHS)[number];

/**
 * Coat filter options. The API stores length (hairless/short/medium/long) and type
 * (wire, double, smooth, curly, …) separately; the brief lists "wire" alongside the
 * lengths, so the filter exposes it and matches it against coat type.
 */
export const COAT_FILTERS = [...COAT_LENGTHS, 'wire'] as const;
export type CoatFilter = (typeof COAT_FILTERS)[number];

/** The 11 numeric trait scores exposed by the API, in display order. */
export const TRAIT_KEYS = [
  'energy',
  'barking',
  'drooling',
  'grooming',
  'shedding',
  'trainability',
  'goodWithDogs',
  'goodWithChildren',
  'goodWithStrangers',
  'apartmentFriendly',
  'exerciseMinutes',
] as const;
export type TraitKey = (typeof TRAIT_KEYS)[number];

/** All scores are 1–5 except exerciseMinutes, which is minutes per day (20–120 in the dataset). */
export const TRAIT_SCALE: Record<TraitKey, { min: number; max: number }> = {
  energy: { min: 1, max: 5 },
  barking: { min: 1, max: 5 },
  drooling: { min: 1, max: 5 },
  grooming: { min: 1, max: 5 },
  shedding: { min: 1, max: 5 },
  trainability: { min: 1, max: 5 },
  goodWithDogs: { min: 1, max: 5 },
  goodWithChildren: { min: 1, max: 5 },
  goodWithStrangers: { min: 1, max: 5 },
  apartmentFriendly: { min: 1, max: 5 },
  exerciseMinutes: { min: 0, max: 180 },
};

export const IMAGE_VARIANTS = ['thumb', 'medium', 'large'] as const;
export type ImageVariant = (typeof IMAGE_VARIANTS)[number];

export type SyncStatus = 'success' | 'partial' | 'failed';

/** Emitted after each page of breeds is written during a sync, so the UI can show rows early. */
export interface SyncProgress {
  breedsWritten: number;
  /** Total breeds the API reported, when known (from the first page's pagination meta). */
  totalBreeds: number | null;
  pagesDone: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Raw API shapes (as returned by https://dogapi.dog/api/v2). Everything is
// optional/nullable here because the normalizer is responsible for validation.
// ---------------------------------------------------------------------------

export interface ApiRange {
  min?: number | null;
  max?: number | null;
}

export interface ApiImageAttribution {
  author?: string | null;
  license?: string | null;
  license_url?: string | null;
  source?: string | null;
  source_url?: string | null;
}

export interface ApiImage {
  id?: string;
  url?: string | null;
  thumb?: string | null;
  medium?: string | null;
  large?: string | null;
  attribution?: ApiImageAttribution | null;
}

export interface ApiBreedAttributes {
  name?: string;
  description?: string | null;
  life?: ApiRange | null;
  male_weight?: ApiRange | null;
  female_weight?: ApiRange | null;
  male_height?: ApiRange | null;
  female_height?: ApiRange | null;
  hypoallergenic?: boolean | null;
  origin?: { era?: string | null; region?: string | null; country?: string | null } | null;
  coat?: { type?: string | null; length?: string | null; colors?: string[] | null } | null;
  traits?: {
    energy?: number | null;
    barking?: number | null;
    drooling?: number | null;
    grooming?: number | null;
    shedding?: number | null;
    trainability?: number | null;
    good_with_dogs?: number | null;
    good_with_children?: number | null;
    good_with_strangers?: number | null;
    apartment_friendly?: number | null;
    exercise_minutes?: number | null;
    temperament?: string[] | null;
  } | null;
  other_names?: string[] | null;
  recognized_by?: string[] | null;
  sources?: { url?: string | null; title?: string | null }[] | null;
  images?: ApiImage[] | null;
}

export interface ApiBreedResource {
  id: string;
  type: 'breed';
  attributes: ApiBreedAttributes;
  relationships?: {
    group?: { data?: { id: string; type: 'group' } | null } | null;
  } | null;
}

export interface ApiGroupResource {
  id: string;
  type: 'group';
  attributes: { name?: string };
}

export interface ApiPagination {
  current: number;
  next?: number | null;
  last?: number;
  records?: number;
}

export interface ApiCollection<T> {
  data: T[];
  meta?: { pagination?: ApiPagination };
}

export interface ApiSingle<T> {
  data: T;
}
