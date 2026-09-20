import { normalizeBreeds, normalizeGroup, type ParseFailure } from '@/api/normalize';
import { PartialBreedsError, type BreedPageHandler } from '@/api/breeds';
import type { AppDb } from '@/db/client';
import { getSyncMeta, listPrimaryThumbs, upsertBreeds, upsertGroups, writeSyncMeta } from '@/db/repository';
import type { SyncMeta } from '@/db/schema';
import type { ApiBreedResource, ApiGroupResource, SyncProgress, SyncStatus } from '@/types/breed';
import type { ImageCache } from '@/utils/imageCache';

export interface SyncDeps {
  /** Resolves with every breed; may call `onPage` with each page as it arrives. */
  fetchBreeds: (onPage?: BreedPageHandler) => Promise<ApiBreedResource[]>;
  fetchGroups: () => Promise<ApiGroupResource[]>;
  /** Optional: when provided, primary thumbs are prefetched after a write. */
  imageCache?: ImageCache;
  now?: () => number;
  log?: (message: string, error?: unknown) => void;
  /** Called after each page of breeds is written, so the list can show rows before the sync ends. */
  onProgress?: (progress: SyncProgress) => void;
}

export interface SyncResult {
  status: SyncStatus;
  meta: SyncMeta;
  breedCount: number;
  imageCount: number;
  parseFailures: ParseFailure[];
  failedPages: number[];
  error: string | null;
  thumbs: { cached: number; failed: number } | null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

/**
 * One sync attempt:
 *   1. fetch groups and breeds (both go through the caller's retry policy);
 *      groups are written the moment they arrive, and each page of breeds is
 *      normalized and written as it lands (after the groups, so section titles
 *      are never placeholders) and reported through `onProgress`
 *   2. normalize the full set; count parse failures
 *   3. upsert whatever the pages did not already write, in one transaction,
 *      pruning breeds absent from the response only after a complete fetch
 *   4. write sync_meta with success | partial | failed
 *   5. prefetch primary thumbs (best effort, does not affect status)
 *
 * Never throws: every outcome is recorded in sync_meta and returned.
 */
export async function runSync(db: AppDb, deps: SyncDeps): Promise<SyncResult> {
  const now = deps.now ?? (() => Date.now());
  const log = deps.log ?? (() => {});
  const startedAt = now();
  const previous = getSyncMeta(db);

  // Groups first: breed rows reference them, and a page written before its groups
  // would briefly show "Unknown group" section headers.
  const groupsPromise = deps.fetchGroups().then((resources) => {
    const rows = resources.map(normalizeGroup).filter((g): g is NonNullable<typeof g> => g !== null);
    try {
      upsertGroups(db, rows);
    } catch (error) {
      log('sync: groups write failed, will retry after the fetch', error);
    }
    return resources;
  });
  const groupsReady = groupsPromise.then(
    () => undefined,
    () => undefined,
  );

  const writtenIds = new Set<string>();
  const pagesDone = new Set<number>();
  const pendingWrites: Promise<void>[] = [];
  const writePage = (page: ApiBreedResource[], totalPages: number, pageNumber: number, totalRecords: number | null) => {
    try {
      const chunk = normalizeBreeds(page, startedAt);
      const fresh = chunk.breeds.filter((b) => !writtenIds.has(b.id));
      if (fresh.length > 0) {
        const freshIds = new Set(fresh.map((b) => b.id));
        upsertBreeds(db, fresh, chunk.images.filter((img) => freshIds.has(img.breedId)));
        for (const id of freshIds) writtenIds.add(id);
      }
    } catch (error) {
      log('sync: page write failed, will retry after the fetch', error);
    }
    pagesDone.add(pageNumber);
    deps.onProgress?.({
      breedsWritten: writtenIds.size,
      totalBreeds: totalRecords,
      pagesDone: pagesDone.size,
      totalPages,
    });
  };
  const onPage: BreedPageHandler = (page, info) => {
    // Queued behind the groups fetch. writePage never throws, so a page is never
    // reported as failed because of a local write.
    pendingWrites.push(groupsReady.then(() => writePage(page, info.totalPages, info.page, info.totalRecords)));
  };

  const [groupsSettled, breedsSettled] = await Promise.allSettled([groupsPromise, deps.fetchBreeds(onPage)]);
  await Promise.all(pendingWrites);

  const errors: string[] = [];
  let failedPages: number[] = [];
  let complete = true;

  let groupResources: ApiGroupResource[] = [];
  if (groupsSettled.status === 'fulfilled') {
    groupResources = groupsSettled.value;
  } else {
    complete = false;
    errors.push(`groups: ${errorMessage(groupsSettled.reason)}`);
  }

  let breedResources: ApiBreedResource[] = [];
  if (breedsSettled.status === 'fulfilled') {
    breedResources = breedsSettled.value;
  } else if (breedsSettled.reason instanceof PartialBreedsError) {
    complete = false;
    breedResources = breedsSettled.reason.fetched;
    failedPages = breedsSettled.reason.failedPages;
    errors.push(`breeds: ${breedsSettled.reason.message}`);
  } else {
    complete = false;
    errors.push(`breeds: ${errorMessage(breedsSettled.reason)}`);
  }

  const groupRows = groupResources.map(normalizeGroup).filter((g): g is NonNullable<typeof g> => g !== null);
  const normalized = normalizeBreeds(breedResources, startedAt);
  const hasData = normalized.breeds.length > 0 || groupRows.length > 0;

  let breedCount = previous?.breedCount ?? 0;
  let imageCount = previous?.imageCount ?? 0;
  let orphanedLocalUris: string[] = [];
  let status: SyncStatus;

  if (!hasData) {
    status = 'failed';
  } else {
    try {
      upsertGroups(db, groupRows);
      const leftover = normalized.breeds.filter((b) => !writtenIds.has(b.id));
      const leftoverIds = new Set(leftover.map((b) => b.id));
      const written = upsertBreeds(
        db,
        leftover,
        normalized.images.filter((img) => leftoverIds.has(img.breedId)),
        {
          pruneMissing: complete && breedsSettled.status === 'fulfilled',
          keepIds: normalized.breeds.map((b) => b.id),
        },
      );
      breedCount = written.breedCount;
      imageCount = written.imageCount;
      orphanedLocalUris = written.orphanedLocalUris;
      status = complete && normalized.failures.length === 0 ? 'success' : 'partial';
      if (normalized.failures.length > 0) {
        errors.push(`${normalized.failures.length} breed(s) failed to parse`);
      }
    } catch (error) {
      log('sync: database write failed', error);
      errors.push(`db: ${errorMessage(error)}`);
      status = 'failed';
    }
  }

  const error = errors.length > 0 ? errors.join(' | ') : null;
  const meta = writeSyncMeta(db, {
    lastAttemptAt: startedAt,
    lastSyncedAt: status === 'failed' ? (previous?.lastSyncedAt ?? null) : startedAt,
    lastSyncStatus: status,
    lastError: error,
    breedCount,
    imageCount,
    parseFailureCount: normalized.failures.length,
  });

  let thumbs: SyncResult['thumbs'] = null;
  if (deps.imageCache && status !== 'failed') {
    deps.imageCache.removeFiles(orphanedLocalUris);
    thumbs = await deps.imageCache.prefetch(
      listPrimaryThumbs(db).map((row) => ({ id: row.id, url: row.url, variant: row.variant })),
    );
  }

  return {
    status,
    meta,
    breedCount,
    imageCount,
    parseFailures: normalized.failures,
    failedPages,
    error,
    thumbs,
  };
}
