import { queryOptions, useQuery } from '@tanstack/react-query';

import { fetchAllBreeds, fetchBreedById, fetchGroups } from './breeds';
import { isRetryableError } from './client';

/**
 * Retry policy (explicit, shared by every query and by the sync pipeline):
 *   - up to 3 retries (4 attempts total)
 *   - exponential backoff, no jitter: 1s → 2s → 4s, capped at 30s
 *   - 4xx responses (other than 408/429) are not retried
 * Worst case before a query settles: ~7s of backoff + 4 × 15s request timeouts.
 */
export const RETRY_COUNT = 3;
export const RETRY_BASE_DELAY_MS = 1_000;
export const RETRY_MAX_DELAY_MS = 30_000;

export function retryDelayMs(attemptIndex: number): number {
  return Math.min(RETRY_BASE_DELAY_MS * 2 ** attemptIndex, RETRY_MAX_DELAY_MS);
}

export function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < RETRY_COUNT && isRetryableError(error);
}

/** Lists change rarely; consider them fresh for an hour and keep for a day. */
export const LIST_STALE_TIME_MS = 60 * 60 * 1_000;
export const LIST_GC_TIME_MS = 24 * 60 * 60 * 1_000;

export const queryKeys = {
  breeds: ['breeds'] as const,
  breedsAll: ['breeds', 'all'] as const,
  breed: (id: string) => ['breeds', 'byId', id] as const,
  groups: ['groups'] as const,
};

export const breedsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.breedsAll,
    queryFn: ({ signal }) => fetchAllBreeds({ signal }),
    retry: shouldRetry,
    retryDelay: retryDelayMs,
    staleTime: LIST_STALE_TIME_MS,
    gcTime: LIST_GC_TIME_MS,
  });

export const groupsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.groups,
    queryFn: ({ signal }) => fetchGroups({ signal }),
    retry: shouldRetry,
    retryDelay: retryDelayMs,
    staleTime: LIST_STALE_TIME_MS,
    gcTime: LIST_GC_TIME_MS,
  });

export const breedQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.breed(id),
    queryFn: ({ signal }) => fetchBreedById(id, { signal }),
    retry: shouldRetry,
    retryDelay: retryDelayMs,
    staleTime: LIST_STALE_TIME_MS,
    gcTime: LIST_GC_TIME_MS,
  });

export function useBreedsQuery() {
  return useQuery(breedsQueryOptions());
}

export function useGroupsQuery() {
  return useQuery(groupsQueryOptions());
}

export function useBreedQuery(id: string | undefined) {
  return useQuery({ ...breedQueryOptions(id ?? ''), enabled: !!id });
}
