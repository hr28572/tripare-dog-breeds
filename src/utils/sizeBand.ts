import type { SizeBand } from '@/types/breed';

/**
 * Size band thresholds.
 *
 * Primary signal: the heaviest adult of the breed (max of male max weight and
 * female max weight, kg). Weight is the most consistently populated size
 * measure in the dataset (283/283 breeds) and is what owners plan around
 * (food, crate, travel rules). Height is a fallback only (a few breeds have
 * no height data).
 *
 * Upper bounds are INCLUSIVE:
 *   small   ≤ 10 kg   (Chihuahua … Scottish Terrier, Pug)
 *   medium  ≤ 25 kg   (Beagle, Cocker Spaniel, Border Collie)
 *   large   ≤ 45 kg   (Labrador, German Shepherd, Doberman)
 *   giant   > 45 kg   (Bernese, Rottweiler, Great Dane, Mastiff)
 *
 * These sit close to the dataset quartiles (p25 = 12, p50 = 25, p90 = 52 kg)
 * and match common kennel-club style groupings, so the four bands are all
 * reasonably populated for filtering.
 */
export const SIZE_BAND_WEIGHT_KG_MAX = { small: 10, medium: 25, large: 45 } as const;

/** Height fallback, cm at the withers (max of male/female max). Same inclusive-upper rule. */
export const SIZE_BAND_HEIGHT_CM_MAX = { small: 35, medium: 50, large: 65 } as const;

export interface SizeBandInput {
  maleWeightMax?: number | null;
  femaleWeightMax?: number | null;
  maleHeightMax?: number | null;
  femaleHeightMax?: number | null;
}

function maxOf(...values: (number | null | undefined)[]): number | null {
  let result: number | null = null;
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      result = result === null ? v : Math.max(result, v);
    }
  }
  return result;
}

export function sizeBandFromWeightKg(kg: number): SizeBand {
  if (kg <= SIZE_BAND_WEIGHT_KG_MAX.small) return 'small';
  if (kg <= SIZE_BAND_WEIGHT_KG_MAX.medium) return 'medium';
  if (kg <= SIZE_BAND_WEIGHT_KG_MAX.large) return 'large';
  return 'giant';
}

export function sizeBandFromHeightCm(cm: number): SizeBand {
  if (cm <= SIZE_BAND_HEIGHT_CM_MAX.small) return 'small';
  if (cm <= SIZE_BAND_HEIGHT_CM_MAX.medium) return 'medium';
  if (cm <= SIZE_BAND_HEIGHT_CM_MAX.large) return 'large';
  return 'giant';
}

/**
 * Pure derivation. Returns null only when neither weight nor height is usable.
 */
export function deriveSizeBand(input: SizeBandInput): SizeBand | null {
  const weight = maxOf(input.maleWeightMax, input.femaleWeightMax);
  if (weight !== null) return sizeBandFromWeightKg(weight);
  const height = maxOf(input.maleHeightMax, input.femaleHeightMax);
  if (height !== null) return sizeBandFromHeightCm(height);
  return null;
}
