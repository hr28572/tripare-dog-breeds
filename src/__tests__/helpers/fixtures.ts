import type { ApiBreedResource, ApiCollection, ApiGroupResource } from '@/types/breed';

import breedsJson from '../fixtures/breeds.json';
import groupsJson from '../fixtures/groups.json';

/** All 283 breeds as captured from https://dogapi.dog/api/v2/breeds (10 pages of 30). */
export const allBreeds = breedsJson as unknown as ApiBreedResource[];
export const groupsCollection = groupsJson as unknown as ApiCollection<ApiGroupResource>;

/** Split the fixture into API-shaped pages of `size`. */
export function pageOf(page: number, size: number): ApiCollection<ApiBreedResource> {
  const last = Math.ceil(allBreeds.length / size);
  const start = (page - 1) * size;
  return {
    data: allBreeds.slice(start, start + size),
    meta: { pagination: { current: page, next: page < last ? page + 1 : null, last, records: allBreeds.length } },
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
