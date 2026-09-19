import type { ImageVariant } from '@/types/breed';

/**
 * Image cache policy:
 *   - thumb of each breed's primary image: cached eagerly right after a sync
 *   - medium / large: cached on demand (when the Gallery opens)
 *   - single size cap, LRU eviction by last access; non-thumb files are
 *     evicted before thumbs so the list screen stays offline-friendly.
 *
 * Filesystem and index access are injected so the policy is unit-testable.
 */
export const IMAGE_CACHE_MAX_BYTES = 100 * 1024 * 1024;

export interface CacheEntry {
  id: string;
  variant: ImageVariant;
  localUri: string;
  byteSize: number;
  lastAccessedAt: number;
}

export interface ImageRef {
  id: string;
  url: string;
  variant: ImageVariant;
}

export interface CacheIndex {
  get(id: string): { localUri: string | null; cachedLocally: boolean } | undefined;
  listCached(): CacheEntry[];
  markCached(id: string, localUri: string, byteSize: number, now: number): void;
  markEvicted(ids: string[]): void;
  touch(id: string, now: number): void;
}

export interface CacheFs {
  /** Download `url` to a file named `fileName` inside the cache dir; returns its uri and size. */
  download(url: string, fileName: string): Promise<{ uri: string; byteSize: number }>;
  exists(uri: string): boolean;
  remove(uri: string): void;
  /** Remove every file in the cache dir. */
  clear(): void;
}

export interface ImageCacheOptions {
  index: CacheIndex;
  fs: CacheFs;
  maxBytes?: number;
  now?: () => number;
  log?: (message: string, error?: unknown) => void;
}

/** Safe file name for an image row id such as `uuid:thumb`. */
export function cacheFileName(id: string): string {
  return `${id.replace(/[^a-zA-Z0-9_-]/g, '_')}.img`;
}

/**
 * Pure LRU planner: given the cached entries and the bytes about to be added,
 * return the ids to evict so total ≤ maxBytes. Non-thumb entries go first
 * (oldest access first), then thumbs.
 */
export function planEviction(entries: CacheEntry[], maxBytes: number, incomingBytes = 0): string[] {
  let total = entries.reduce((sum, e) => sum + e.byteSize, 0) + incomingBytes;
  if (total <= maxBytes) return [];

  const byLru = (a: CacheEntry, b: CacheEntry) => a.lastAccessedAt - b.lastAccessedAt;
  const ordered = [
    ...entries.filter((e) => e.variant !== 'thumb').sort(byLru),
    ...entries.filter((e) => e.variant === 'thumb').sort(byLru),
  ];

  const evict: string[] = [];
  for (const entry of ordered) {
    if (total <= maxBytes) break;
    evict.push(entry.id);
    total -= entry.byteSize;
  }
  return evict;
}

export interface ImageCache {
  /** Returns the local uri, downloading if needed. Null if the download failed. */
  ensureCached(ref: ImageRef): Promise<string | null>;
  /** Local uri if cached, without touching the network. */
  getLocalUri(id: string): string | null;
  /** Eagerly cache many refs (thumbs after sync) with bounded concurrency. Never throws. */
  prefetch(refs: ImageRef[], concurrency?: number): Promise<{ cached: number; failed: number }>;
  /** Delete files for rows removed from the DB. */
  removeFiles(uris: string[]): void;
  evictIfNeeded(incomingBytes?: number): void;
  clear(): void;
  /** Files and bytes currently on disk according to the index. */
  stats(): { count: number; bytes: number; maxBytes: number };
}

export function createImageCache(options: ImageCacheOptions): ImageCache {
  const { index, fs } = options;
  const maxBytes = options.maxBytes ?? IMAGE_CACHE_MAX_BYTES;
  const now = options.now ?? (() => Date.now());
  const log = options.log ?? (() => {});
  const inFlight = new Map<string, Promise<string | null>>();

  function evictIfNeeded(incomingBytes = 0): void {
    const entries = index.listCached();
    const ids = planEviction(entries, maxBytes, incomingBytes);
    if (ids.length === 0) return;
    const byId = new Map(entries.map((e) => [e.id, e]));
    for (const id of ids) {
      const uri = byId.get(id)?.localUri;
      if (uri) {
        try {
          fs.remove(uri);
        } catch (error) {
          log(`evict: failed to remove ${uri}`, error);
        }
      }
    }
    index.markEvicted(ids);
  }

  function getLocalUri(id: string): string | null {
    const row = index.get(id);
    if (!row?.cachedLocally || !row.localUri) return null;
    if (!fs.exists(row.localUri)) {
      // File vanished (OS cleared the cache dir). Fix the index.
      index.markEvicted([id]);
      return null;
    }
    return row.localUri;
  }

  async function ensureCached(ref: ImageRef): Promise<string | null> {
    const existing = getLocalUri(ref.id);
    if (existing) {
      index.touch(ref.id, now());
      return existing;
    }
    const pending = inFlight.get(ref.id);
    if (pending) return pending;

    const task = (async () => {
      try {
        const { uri, byteSize } = await fs.download(ref.url, cacheFileName(ref.id));
        evictIfNeeded(byteSize);
        index.markCached(ref.id, uri, byteSize, now());
        return uri;
      } catch (error) {
        log(`download failed for ${ref.id}`, error);
        return null;
      } finally {
        inFlight.delete(ref.id);
      }
    })();
    inFlight.set(ref.id, task);
    return task;
  }

  async function prefetch(refs: ImageRef[], concurrency = 4): Promise<{ cached: number; failed: number }> {
    let cached = 0;
    let failed = 0;
    const queue = [...refs];
    const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
      for (;;) {
        const ref = queue.shift();
        if (!ref) return;
        const uri = await ensureCached(ref);
        if (uri) cached += 1;
        else failed += 1;
      }
    });
    await Promise.all(workers);
    return { cached, failed };
  }

  function removeFiles(uris: string[]): void {
    for (const uri of uris) {
      try {
        if (fs.exists(uri)) fs.remove(uri);
      } catch (error) {
        log(`remove failed for ${uri}`, error);
      }
    }
  }

  function clear(): void {
    const ids = index.listCached().map((e) => e.id);
    try {
      fs.clear();
    } catch (error) {
      log('clear failed', error);
    }
    index.markEvicted(ids);
  }

  function stats() {
    const entries = index.listCached();
    return { count: entries.length, bytes: entries.reduce((n, e) => n + e.byteSize, 0), maxBytes };
  }

  return { ensureCached, getLocalUri, prefetch, removeFiles, evictIfNeeded, clear, stats };
}
