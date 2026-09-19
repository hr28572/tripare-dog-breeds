import { fetchJson } from './client';

import type { ApiBreedResource, ApiCollection, ApiGroupResource, ApiSingle } from '@/types/breed';

/** 283 breeds / 50 per page = 6 pages. */
export const BREEDS_PAGE_SIZE = 50;

export interface FetchOptions {
  signal?: AbortSignal;
}

/**
 * Thrown by fetchAllBreeds when at least one page failed. Carries every breed
 * that DID arrive so the sync can still write them and report "partial".
 */
export class PartialBreedsError extends Error {
  readonly fetched: ApiBreedResource[];
  readonly failedPages: number[];
  readonly totalPages: number;
  readonly causes: unknown[];

  constructor(fetched: ApiBreedResource[], failedPages: number[], totalPages: number, causes: unknown[]) {
    super(`Failed to fetch ${failedPages.length}/${totalPages} breed page(s): ${failedPages.join(', ')}`);
    this.name = 'PartialBreedsError';
    this.fetched = fetched;
    this.failedPages = failedPages;
    this.totalPages = totalPages;
    this.causes = causes;
  }
}

export function breedsPagePath(page: number, pageSize = BREEDS_PAGE_SIZE): string {
  return `/breeds?page[number]=${page}&page[size]=${pageSize}`;
}

export function fetchBreedsPage(
  page: number,
  options: FetchOptions = {},
): Promise<ApiCollection<ApiBreedResource>> {
  return fetchJson<ApiCollection<ApiBreedResource>>(breedsPagePath(page), options);
}

/** Merge pages into one array, keeping the first occurrence of each id. */
export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

/**
 * Fetch every page of /breeds. Page 1 is fetched first to learn the page
 * count; the remaining pages are fetched in parallel. If any page fails a
 * PartialBreedsError is thrown carrying the pages that succeeded.
 */
export async function fetchAllBreeds(options: FetchOptions = {}): Promise<ApiBreedResource[]> {
  const first = await fetchBreedsPage(1, options);
  const totalPages = Math.max(1, first.meta?.pagination?.last ?? 1);

  const remaining = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
  const settled = await Promise.allSettled(remaining.map((page) => fetchBreedsPage(page, options)));

  const pages: ApiBreedResource[][] = [first.data ?? []];
  const failedPages: number[] = [];
  const causes: unknown[] = [];
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      pages.push(result.value.data ?? []);
    } else {
      failedPages.push(remaining[i]);
      causes.push(result.reason);
    }
  });

  const merged = dedupeById(pages.flat());
  if (failedPages.length > 0) {
    throw new PartialBreedsError(merged, failedPages, totalPages, causes);
  }
  return merged;
}

export async function fetchGroups(options: FetchOptions = {}): Promise<ApiGroupResource[]> {
  const all: ApiGroupResource[] = [];
  let page = 1;
  // Currently a single page of 9, but honour pagination if it ever grows.
  for (;;) {
    const res = await fetchJson<ApiCollection<ApiGroupResource>>(`/groups?page[number]=${page}`, options);
    all.push(...(res.data ?? []));
    const next = res.meta?.pagination?.next;
    if (!next || next <= page) break;
    page = next;
  }
  return dedupeById(all);
}

export async function fetchBreedById(id: string, options: FetchOptions = {}): Promise<ApiBreedResource> {
  const res = await fetchJson<ApiSingle<ApiBreedResource>>(`/breeds/${encodeURIComponent(id)}`, options);
  return res.data;
}
