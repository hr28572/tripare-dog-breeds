import type { BreedImageInsert, BreedInsert, GroupInsert } from '@/db/schema';
import {
  COAT_LENGTHS,
  IMAGE_VARIANTS,
  type ApiBreedResource,
  type ApiGroupResource,
  type ApiRange,
  type CoatLength,
} from '@/types/breed';
import { deriveSizeBand } from '@/utils/sizeBand';

export interface ParseFailure {
  id: string | null;
  name: string | null;
  reason: string;
}

export type NormalizeBreedResult =
  | { ok: true; breed: BreedInsert; images: BreedImageInsert[] }
  | { ok: false; failure: ParseFailure };

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function int(value: unknown): number | null {
  const n = num(value);
  return n === null ? null : Math.round(n);
}

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function strArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim());
}

function range(value: ApiRange | null | undefined): { min: number | null; max: number | null } {
  return { min: num(value?.min), max: num(value?.max) };
}

function coatLength(value: unknown): CoatLength | null {
  const s = str(value)?.toLowerCase();
  return s && (COAT_LENGTHS as readonly string[]).includes(s) ? (s as CoatLength) : null;
}

export function imageRowId(imageId: string, variant: string): string {
  return `${imageId}:${variant}`;
}

export function normalizeGroup(resource: ApiGroupResource): GroupInsert | null {
  const id = str(resource?.id);
  const name = str(resource?.attributes?.name);
  if (!id || !name) return null;
  return { id, name };
}

export function normalizeBreed(resource: ApiBreedResource, now: number): NormalizeBreedResult {
  const id = str(resource?.id);
  const a = resource?.attributes;
  const name = str(a?.name);

  if (!id) return { ok: false, failure: { id: null, name, reason: 'missing id' } };
  if (!a || typeof a !== 'object') return { ok: false, failure: { id, name: null, reason: 'missing attributes' } };
  if (!name) return { ok: false, failure: { id, name: null, reason: 'missing name' } };

  const life = range(a.life);
  const maleWeight = range(a.male_weight);
  const femaleWeight = range(a.female_weight);
  const maleHeight = range(a.male_height);
  const femaleHeight = range(a.female_height);
  const traits = a.traits ?? null;

  const breed: BreedInsert = {
    id,
    name,
    otherNames: strArray(a.other_names),
    description: str(a.description),
    lifeMin: int(life.min),
    lifeMax: int(life.max),
    maleWeightMin: maleWeight.min,
    maleWeightMax: maleWeight.max,
    femaleWeightMin: femaleWeight.min,
    femaleWeightMax: femaleWeight.max,
    maleHeightMin: maleHeight.min,
    maleHeightMax: maleHeight.max,
    femaleHeightMin: femaleHeight.min,
    femaleHeightMax: femaleHeight.max,
    originEra: str(a.origin?.era),
    originRegion: str(a.origin?.region),
    originCountry: str(a.origin?.country),
    hypoallergenic: a.hypoallergenic === true,
    coatLength: coatLength(a.coat?.length),
    coatType: str(a.coat?.type)?.toLowerCase() ?? null,
    coatColors: strArray(a.coat?.colors),
    sizeBand: deriveSizeBand({
      maleWeightMax: maleWeight.max,
      femaleWeightMax: femaleWeight.max,
      maleHeightMax: maleHeight.max,
      femaleHeightMax: femaleHeight.max,
    }),
    energy: int(traits?.energy),
    barking: int(traits?.barking),
    drooling: int(traits?.drooling),
    grooming: int(traits?.grooming),
    shedding: int(traits?.shedding),
    trainability: int(traits?.trainability),
    goodWithDogs: int(traits?.good_with_dogs),
    goodWithChildren: int(traits?.good_with_children),
    goodWithStrangers: int(traits?.good_with_strangers),
    apartmentFriendly: int(traits?.apartment_friendly),
    exerciseMinutes: int(traits?.exercise_minutes),
    temperament: strArray(traits?.temperament),
    recognizedBy: strArray(a.recognized_by),
    sources: (Array.isArray(a.sources) ? a.sources : [])
      .map((s) => ({ url: str(s?.url), title: str(s?.title) }))
      .filter((s): s is { url: string; title: string } => s.url !== null && s.title !== null),
    groupId: str(resource.relationships?.group?.data?.id),
    updatedAt: now,
  };

  const images: BreedImageInsert[] = [];
  (Array.isArray(a.images) ? a.images : []).forEach((img, position) => {
    const imageId = str(img?.id);
    if (!imageId) return;
    for (const variant of IMAGE_VARIANTS) {
      const url = str(img?.[variant]) ?? str(img?.url);
      if (!url) continue;
      images.push({
        id: imageRowId(imageId, variant),
        imageId,
        breedId: id,
        variant,
        position,
        url,
        author: str(img?.attribution?.author),
        license: str(img?.attribution?.license),
        licenseUrl: str(img?.attribution?.license_url),
        source: str(img?.attribution?.source),
        sourceUrl: str(img?.attribution?.source_url),
      });
    }
  });

  return { ok: true, breed, images };
}

export interface NormalizedBreeds {
  breeds: BreedInsert[];
  images: BreedImageInsert[];
  failures: ParseFailure[];
}

export function normalizeBreeds(resources: ApiBreedResource[], now: number): NormalizedBreeds {
  const out: NormalizedBreeds = { breeds: [], images: [], failures: [] };
  for (const resource of resources) {
    const result = normalizeBreed(resource, now);
    if (result.ok) {
      out.breeds.push(result.breed);
      out.images.push(...result.images);
    } else {
      out.failures.push(result.failure);
    }
  }
  return out;
}
