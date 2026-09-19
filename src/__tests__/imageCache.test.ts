import { createImageCache, planEviction, type CacheEntry, type CacheFs, type CacheIndex } from '@/utils/imageCache';

function entry(id: string, variant: CacheEntry['variant'], byteSize: number, lastAccessedAt: number): CacheEntry {
  return { id, variant, localUri: `file:///${id}`, byteSize, lastAccessedAt };
}

describe('planEviction', () => {
  it('does nothing under the cap', () => {
    expect(planEviction([entry('a', 'thumb', 10, 1)], 100)).toEqual([]);
  });

  it('evicts least-recently-used non-thumbs before thumbs', () => {
    const entries = [
      entry('thumb-old', 'thumb', 30, 1),
      entry('large-new', 'large', 30, 9),
      entry('medium-old', 'medium', 30, 2),
      entry('large-mid', 'large', 30, 5),
    ];
    // total 120, cap 70 → need to free 50: medium-old (30) then large-mid (30)
    expect(planEviction(entries, 70)).toEqual(['medium-old', 'large-mid']);
    // cap 20 → all non-thumbs then the thumb
    expect(planEviction(entries, 20)).toEqual(['medium-old', 'large-mid', 'large-new', 'thumb-old']);
  });

  it('accounts for incoming bytes', () => {
    expect(planEviction([entry('a', 'medium', 60, 1)], 100, 50)).toEqual(['a']);
  });
});

function fakeEnv(sizes: Record<string, number>) {
  const rows = new Map<string, { localUri: string | null; cachedLocally: boolean; byteSize: number; last: number; variant: CacheEntry['variant'] }>();
  const files = new Set<string>();
  const downloads: string[] = [];
  const index: CacheIndex = {
    get: (id) => rows.get(id),
    listCached: () =>
      [...rows.entries()]
        .filter(([, r]) => r.cachedLocally && r.localUri)
        .map(([id, r]) => ({ id, variant: r.variant, localUri: r.localUri!, byteSize: r.byteSize, lastAccessedAt: r.last })),
    markCached: (id, uri, bytes, now) => {
      const r = rows.get(id)!;
      Object.assign(r, { localUri: uri, cachedLocally: true, byteSize: bytes, last: now });
    },
    markEvicted: (ids) => ids.forEach((id) => Object.assign(rows.get(id)!, { localUri: null, cachedLocally: false, byteSize: 0 })),
    touch: (id, now) => {
      rows.get(id)!.last = now;
    },
  };
  const fs: CacheFs = {
    async download(url, fileName) {
      downloads.push(url);
      if (url.includes('fail')) throw new Error('boom');
      const uri = `file:///cache/${fileName}`;
      files.add(uri);
      return { uri, byteSize: sizes[url] ?? 10 };
    },
    exists: (uri) => files.has(uri),
    remove: (uri) => void files.delete(uri),
    clear: () => files.clear(),
  };
  const addRow = (id: string, variant: CacheEntry['variant']) =>
    rows.set(id, { localUri: null, cachedLocally: false, byteSize: 0, last: 0, variant });
  return { index, fs, files, downloads, addRow, rows };
}

describe('createImageCache', () => {
  it('downloads once, then serves from cache and touches the entry', async () => {
    const env = fakeEnv({});
    let t = 100;
    const cache = createImageCache({ index: env.index, fs: env.fs, now: () => t++ });
    env.addRow('img:thumb', 'thumb');

    const first = await cache.ensureCached({ id: 'img:thumb', url: 'https://x/t', variant: 'thumb' });
    const second = await cache.ensureCached({ id: 'img:thumb', url: 'https://x/t', variant: 'thumb' });
    expect(first).toBe(second);
    expect(env.downloads).toHaveLength(1);
    expect(env.rows.get('img:thumb')!.last).toBe(101);
  });

  it('re-downloads when the file disappeared from disk', async () => {
    const env = fakeEnv({});
    const cache = createImageCache({ index: env.index, fs: env.fs });
    env.addRow('a:medium', 'medium');
    const uri = await cache.ensureCached({ id: 'a:medium', url: 'https://x/m', variant: 'medium' });
    env.files.delete(uri!);
    expect(cache.getLocalUri('a:medium')).toBeNull();
    await cache.ensureCached({ id: 'a:medium', url: 'https://x/m', variant: 'medium' });
    expect(env.downloads).toHaveLength(2);
  });

  it('evicts LRU non-thumbs to stay under the cap', async () => {
    const env = fakeEnv({ 'https://x/l1': 40, 'https://x/l2': 40, 'https://x/t': 5 });
    let t = 0;
    const cache = createImageCache({ index: env.index, fs: env.fs, maxBytes: 60, now: () => ++t });
    env.addRow('t:thumb', 'thumb');
    env.addRow('l1:large', 'large');
    env.addRow('l2:large', 'large');

    await cache.ensureCached({ id: 't:thumb', url: 'https://x/t', variant: 'thumb' });
    await cache.ensureCached({ id: 'l1:large', url: 'https://x/l1', variant: 'large' });
    await cache.ensureCached({ id: 'l2:large', url: 'https://x/l2', variant: 'large' });

    expect(cache.getLocalUri('l1:large')).toBeNull();
    expect(cache.getLocalUri('l2:large')).not.toBeNull();
    expect(cache.getLocalUri('t:thumb')).not.toBeNull();
    expect(env.files.size).toBe(2);
  });

  it('prefetch reports failures without throwing', async () => {
    const env = fakeEnv({});
    const cache = createImageCache({ index: env.index, fs: env.fs });
    env.addRow('ok:thumb', 'thumb');
    env.addRow('bad:thumb', 'thumb');
    const result = await cache.prefetch([
      { id: 'ok:thumb', url: 'https://x/ok', variant: 'thumb' },
      { id: 'bad:thumb', url: 'https://x/fail', variant: 'thumb' },
    ]);
    expect(result).toEqual({ cached: 1, failed: 1 });
  });
});
