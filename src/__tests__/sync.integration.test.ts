/**
 * Runs the real sync pipeline (normalize → upsert → sync_meta) against a real
 * SQLite database using the checked-in migrations and the full 283-breed
 * fixture. This is the Node-side equivalent of "sync, then read in airplane mode".
 */
import { ApiError } from '@/api/client';
import { PartialBreedsError, type BreedPageHandler } from '@/api/breeds';
import {
  countBreeds,
  countImages,
  getBreedById,
  getBreedDetail,
  getSyncMeta,
  listBreedImages,
  listBreedRows,
  listBreeds,
  listGroups,
  listPrimaryThumbs,
} from '@/db/repository';
import { runSync } from '@/db/sync';
import { createDbImageIndex } from '@/db/imageIndex';
import { createImageCache, type CacheFs } from '@/utils/imageCache';
import type { SyncProgress } from '@/types/breed';

import { allBreeds, groupsCollection } from './helpers/fixtures';
import { createTestDb } from './helpers/testDb';

const online = {
  fetchBreeds: async () => allBreeds,
  fetchGroups: async () => groupsCollection.data,
};

/** Delivers the fixture in pages of 50 through onPage before resolving, like the real fetcher. */
function streamingFetch(breeds = allBreeds, pageSize = 50) {
  return async (onPage?: BreedPageHandler) => {
    const totalPages = Math.ceil(breeds.length / pageSize);
    for (let page = 1; page <= totalPages; page += 1) {
      onPage?.(breeds.slice((page - 1) * pageSize, page * pageSize), { page, totalPages, totalRecords: breeds.length });
    }
    await Promise.resolve();
    return breeds;
  };
}

const offline = {
  fetchBreeds: async () => {
    throw new ApiError('network', 'Network request failed', 'u');
  },
  fetchGroups: async () => {
    throw new ApiError('network', 'Network request failed', 'u');
  },
};

describe('runSync', () => {
  it('writes each page as it arrives so rows are readable before the sync finishes', async () => {
    const db = createTestDb();
    const progress: SyncProgress[] = [];
    const rowsAtProgress: number[] = [];
    const result = await runSync(db, {
      fetchGroups: online.fetchGroups,
      fetchBreeds: streamingFetch(),
      now: () => 1000,
      onProgress: (p) => {
        progress.push(p);
        rowsAtProgress.push(countBreeds(db));
      },
    });
    expect(progress.map((p) => p.pagesDone)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(progress.map((p) => p.totalPages)).toEqual([6, 6, 6, 6, 6, 6]);
    expect(progress[0]).toMatchObject({ breedsWritten: 50, totalBreeds: 283 });
    expect(rowsAtProgress[0]).toBe(50);
    expect(rowsAtProgress[5]).toBe(283);
    // Pages are written after the groups, so no section is ever an "Unknown group" placeholder.
    expect(listGroups(db).map((g) => g.name)).not.toContain('Unknown group');
    expect(result.status).toBe('success');
    expect(countBreeds(db)).toBe(283);
    expect(countImages(db)).toBe(7062);
    expect(getSyncMeta(db)?.breedCount).toBe(283);
  });

  it('prunes breeds missing from a complete fetch even when the pages were written incrementally', async () => {
    const db = createTestDb();
    await runSync(db, { ...online, now: () => 1000 });
    expect(countBreeds(db)).toBe(283);
    const result = await runSync(db, { fetchGroups: online.fetchGroups, fetchBreeds: streamingFetch(allBreeds.slice(1)), now: () => 2000 });
    expect(result.status).toBe('success');
    expect(countBreeds(db)).toBe(282);
    expect(getBreedById(db, allBreeds[0].id)).toBeUndefined();
  });

  it('writes all 283 breeds, 9 groups and 7062 image rows, then reports success', async () => {
    const db = createTestDb();
    const result = await runSync(db, { ...online, now: () => 1000 });

    expect(result.status).toBe('success');
    expect(result.parseFailures).toEqual([]);
    expect(result.breedCount).toBe(283);
    expect(result.imageCount).toBe(2354 * 3);
    expect(countBreeds(db)).toBe(283);
    expect(countImages(db)).toBe(7062);
    expect(listGroups(db)).toHaveLength(9);
    expect(listPrimaryThumbs(db)).toHaveLength(283);

    const meta = getSyncMeta(db)!;
    expect(meta).toMatchObject({
      lastAttemptAt: 1000,
      lastSyncedAt: 1000,
      lastSyncStatus: 'success',
      lastError: null,
      breedCount: 283,
      imageCount: 7062,
      parseFailureCount: 0,
    });
  });

  it('cached data is fully queryable when every fetch fails (airplane mode)', async () => {
    const db = createTestDb();
    await runSync(db, { ...online, now: () => 1000 });

    const result = await runSync(db, { ...offline, now: () => 2000 });
    expect(result.status).toBe('failed');
    expect(result.error).toContain('Network request failed');

    // Nothing was wiped
    expect(countBreeds(db)).toBe(283);
    expect(countImages(db)).toBe(7062);
    const meta = getSyncMeta(db)!;
    expect(meta.lastSyncStatus).toBe('failed');
    expect(meta.lastAttemptAt).toBe(2000);
    expect(meta.lastSyncedAt).toBe(1000); // still points at the last good write
    expect(meta.breedCount).toBe(283);

    // Typical screen reads
    const affen = listBreeds(db, { search: 'affen' });
    expect(affen.map((b) => b.name)).toEqual(['Affenpinscher']);
    const byId = getBreedById(db, affen[0].id)!;
    expect(byId.groupId).toBe('f56dc4b1-ba1a-4454-8ce2-bd5d41404a0c');
    expect(byId.temperament).toContain('playful');
    expect(listBreedImages(db, byId.id, 'thumb')).toHaveLength(9);
    expect(listBreeds(db, { sizeBands: ['giant'] }).length).toBeGreaterThan(20);
    expect(listBreeds(db, { hypoallergenic: true }).every((b) => b.hypoallergenic)).toBe(true);
    expect(listBreeds(db, { groupIds: [byId.groupId!] }).some((b) => b.id === byId.id)).toBe(true);
  });

  it('is idempotent: a second full sync updates in place and keeps cache bookkeeping', async () => {
    const db = createTestDb();
    await runSync(db, { ...online, now: () => 1000 });

    const thumb = listPrimaryThumbs(db)[0];
    // Pretend the cache downloaded this thumb.
    createDbImageIndex(db).markCached(thumb.id, 'file:///cached.img', 1234, 1500);

    const again = await runSync(db, { ...online, now: () => 3000 });
    expect(again.status).toBe('success');
    expect(countBreeds(db)).toBe(283);
    expect(countImages(db)).toBe(7062);
    expect(getBreedById(db, thumb.breedId)!.updatedAt).toBe(3000);
    const row = listBreedImages(db, thumb.breedId, 'thumb')[0];
    expect(row).toMatchObject({ id: thumb.id, cachedLocally: true, localUri: 'file:///cached.img', byteSize: 1234 });
  });

  it('writes what arrived on a partial fetch and never prunes existing breeds', async () => {
    const db = createTestDb();
    await runSync(db, { ...online, now: () => 1000 });

    const half = allBreeds.slice(0, 140);
    const partial = {
      fetchGroups: online.fetchGroups,
      fetchBreeds: async () => {
        throw new PartialBreedsError(half, [4, 5, 6], 6, []);
      },
    };
    const result = await runSync(db, { ...partial, now: () => 2000 });

    expect(result.status).toBe('partial');
    expect(result.failedPages).toEqual([4, 5, 6]);
    expect(countBreeds(db)).toBe(283); // the other 143 were kept
    expect(getBreedById(db, half[0].id)!.updatedAt).toBe(2000);
    expect(getBreedById(db, allBreeds[282].id)!.updatedAt).toBe(1000);
    const meta = getSyncMeta(db)!;
    expect(meta.lastSyncStatus).toBe('partial');
    expect(meta.lastSyncedAt).toBe(2000);
    expect(meta.lastError).toContain('3/6');
  });

  it('prunes breeds that disappeared from a COMPLETE fetch and drops their images', async () => {
    const db = createTestDb();
    await runSync(db, { ...online, now: () => 1000 });
    const removed = allBreeds[0];
    await runSync(db, { ...online, fetchBreeds: async () => allBreeds.slice(1), now: () => 2000 });
    expect(countBreeds(db)).toBe(282);
    expect(getBreedById(db, removed.id)).toBeUndefined();
    expect(listBreedImages(db, removed.id)).toHaveLength(0);
  });

  it('records parse failures and still writes the good rows', async () => {
    const db = createTestDb();
    const broken = [{ id: 'bad', type: 'breed', attributes: {} }, ...allBreeds.slice(0, 5)];
    const result = await runSync(db, {
      ...online,
      fetchBreeds: async () => broken as typeof allBreeds,
      now: () => 1000,
    });
    expect(result.status).toBe('partial');
    expect(result.parseFailures).toEqual([{ id: 'bad', name: null, reason: 'missing name' }]);
    expect(countBreeds(db)).toBe(5);
    expect(getSyncMeta(db)!.parseFailureCount).toBe(1);
  });

  it('prefetches one thumb per breed through the image cache', async () => {
    const db = createTestDb();
    const downloaded: string[] = [];
    const fs: CacheFs = {
      async download(url, fileName) {
        downloaded.push(url);
        return { uri: `file:///c/${fileName}`, byteSize: 100 };
      },
      exists: () => true,
      remove: () => {},
      clear: () => {},
    };
    const imageCache = createImageCache({ index: createDbImageIndex(db), fs });
    const result = await runSync(db, { ...online, imageCache, now: () => 1000 });
    expect(result.thumbs).toEqual({ cached: 283, failed: 0 });
    expect(downloaded).toHaveLength(283);
    expect(listPrimaryThumbs(db).every((t) => t.cachedLocally && t.localUri)).toBe(true);

    // A second sync does not re-download already cached thumbs.
    await runSync(db, { ...online, imageCache, now: () => 2000 });
    expect(downloaded).toHaveLength(283);
  });
});

describe('list screen queries', () => {
  it('listBreedRows joins group name and primary thumb, and searches other_names', async () => {
    const db = createTestDb();
    await runSync(db, { ...online, now: () => 1000 });

    const rows = listBreedRows(db);
    expect(rows).toHaveLength(283);
    expect(rows.every((r) => r.thumbUrl && r.groupName)).toBe(true);

    // "Affen" is an other_name of the Affenpinscher; "monkey terrier" too.
    expect(listBreedRows(db, { search: 'monkey terrier' }).map((r) => r.name)).toEqual(['Affenpinscher']);
    expect(listBreedRows(db, { search: 'PUG' }).some((r) => r.name === 'Pug')).toBe(true);
    expect(listBreedRows(db, { sizeBands: ['small'], hypoallergenic: true }).every((r) => r.sizeBand === 'small' && r.hypoallergenic)).toBe(true);

    const affenRow = rows.find((r) => r.name === 'Affenpinscher')!;
    const detail = getBreedDetail(db, affenRow.id)!;
    expect(detail.breed.name).toBe('Affenpinscher');
    expect(detail.groupName).toBeTruthy();
    expect(detail.images).toHaveLength(27);
  });
});

describe('list filters (real SQLite)', () => {
  it('filters by coat length, trait threshold and multiple groups, ordered by group', async () => {
    const db = createTestDb();
    await runSync(db, { ...online, now: () => 1000 });

    const hairless = listBreedRows(db, { coatLengths: ['hairless'] });
    expect(hairless.length).toBe(4);
    expect(hairless.every((r) => r.coatLength === 'hairless')).toBe(true);

    // 'wire' is a coat TYPE in the API; the filter exposes it next to the lengths.
    const wire = listBreedRows(db, { coatLengths: ['wire'] });
    expect(wire.length).toBe(35);
    expect(wire.every((r) => r.coatType === 'wire')).toBe(true);
    const shortOrWire = listBreedRows(db, { coatLengths: ['short', 'wire'] });
    expect(shortOrWire.length).toBeGreaterThan(wire.length);
    expect(shortOrWire.every((r) => r.coatLength === 'short' || r.coatType === 'wire')).toBe(true);

    const kidFriendly = listBreedRows(db, { traitThresholds: [{ trait: 'goodWithChildren', min: 5 }] });
    expect(kidFriendly.length).toBeGreaterThan(0);
    expect(kidFriendly.every((r) => (r.goodWithChildren ?? 0) >= 5)).toBe(true);

    const both = listBreedRows(db, { traitThresholds: [{ trait: 'goodWithChildren', min: 5 }, { trait: 'energy', min: 5 }] });
    expect(both.length).toBeLessThan(kidFriendly.length);
    expect(both.every((r) => (r.energy ?? 0) >= 5)).toBe(true);

    const groups = listGroups(db);
    const two = listBreedRows(db, { groupIds: [groups[0].id, groups[1].id] });
    expect(new Set(two.map((r) => r.groupName))).toEqual(new Set([groups[0].name, groups[1].name]));

    const all = listBreedRows(db);
    const groupOrder = all.map((r) => r.groupName ?? '');
    expect([...groupOrder].sort((a, b) => a.localeCompare(b))).toEqual(groupOrder);
  });
});
