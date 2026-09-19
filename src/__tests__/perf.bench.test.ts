/**
 * Data-layer benchmark on Node + better-sqlite3. Numbers are printed, not
 * asserted tightly; the loose assertions only guard against pathological
 * regressions. On-device numbers will differ (see docs/PERFORMANCE.md).
 */
import { normalizeBreeds } from '@/api/normalize';
import { getBreedDetail, listBreedRows, upsertBreeds } from '@/db/repository';
import { runSync } from '@/db/sync';

import { allBreeds, groupsCollection } from './helpers/fixtures';
import { createTestDb } from './helpers/testDb';

function median(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function bench(label: string, fn: () => void, runs = 20): number {
  const samples: number[] = [];
  for (let i = 0; i < runs; i += 1) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  const med = median(samples);
  console.log(`[bench] ${label}: median ${med.toFixed(1)} ms, min ${Math.min(...samples).toFixed(1)} ms (${runs} runs)`);
  return med;
}

describe('data layer benchmark (Node, better-sqlite3)', () => {
  it('measures normalize, full upsert, list and detail queries', async () => {
    const db = createTestDb();
    const online = { fetchBreeds: async () => allBreeds, fetchGroups: async () => groupsCollection.data };

    const normalizeMs = bench('normalize 283 breeds', () => normalizeBreeds(allBreeds, 1), 10);

    const normalized = normalizeBreeds(allBreeds, 1);
    const firstWriteStart = performance.now();
    await runSync(db, { ...online, now: () => 1000 });
    const firstWriteMs = performance.now() - firstWriteStart;
    console.log(`[bench] first full sync write (283 breeds, 7062 images): ${firstWriteMs.toFixed(1)} ms`);

    const upsertMs = bench('re-upsert 283 breeds + 7062 images', () => upsertBreeds(db, normalized.breeds, normalized.images), 5);
    const listMs = bench('listBreedRows (all 283, joins)', () => listBreedRows(db));
    const searchMs = bench("listBreedRows search 'terrier'", () => listBreedRows(db, { search: 'terrier' }));
    const filterMs = bench('listBreedRows size+hypo filter', () => listBreedRows(db, { sizeBands: ['small', 'medium'], hypoallergenic: true }));
    const detailMs = bench('getBreedDetail (breed + 27 images)', () => getBreedDetail(db, allBreeds[0].id));

    expect(normalizeMs).toBeLessThan(500);
    expect(firstWriteMs).toBeLessThan(5000);
    expect(upsertMs).toBeLessThan(5000);
    expect(listMs).toBeLessThan(200);
    expect(searchMs).toBeLessThan(200);
    expect(filterMs).toBeLessThan(200);
    expect(detailMs).toBeLessThan(50);
  });
});
