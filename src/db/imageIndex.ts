import type { AppDb } from './client';
import { getImageRow, listCachedImages, markImageCached, markImagesEvicted, touchImage } from './repository';

import type { CacheIndex } from '@/utils/imageCache';

/** CacheIndex backed by the breed_images table. */
export function createDbImageIndex(db: AppDb): CacheIndex {
  return {
    get(id) {
      const row = getImageRow(db, id);
      return row ? { localUri: row.localUri, cachedLocally: row.cachedLocally } : undefined;
    },
    listCached() {
      return listCachedImages(db)
        .filter((r) => r.localUri !== null)
        .map((r) => ({
          id: r.id,
          variant: r.variant,
          localUri: r.localUri!,
          byteSize: r.byteSize ?? 0,
          lastAccessedAt: r.lastAccessedAt ?? 0,
        }));
    },
    markCached: (id, uri, bytes, now) => markImageCached(db, id, uri, bytes, now),
    markEvicted: (ids) => markImagesEvicted(db, ids),
    touch: (id, now) => touchImage(db, id, now),
  };
}
