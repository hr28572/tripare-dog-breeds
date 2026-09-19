import { Directory, File, Paths } from 'expo-file-system';

import type { CacheFs } from './imageCache';

export const IMAGE_CACHE_DIR_NAME = 'breed-images';

/** expo-file-system implementation of the cache filesystem. */
export function createExpoCacheFs(): CacheFs {
  const dir = new Directory(Paths.cache, IMAGE_CACHE_DIR_NAME);

  function ensureDir(): Directory {
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    return dir;
  }

  return {
    async download(url, fileName) {
      const target = new File(ensureDir(), fileName);
      const file = await File.downloadFileAsync(url, target, { idempotent: true });
      return { uri: file.uri, byteSize: file.size ?? 0 };
    },
    exists(uri) {
      try {
        return new File(uri).exists;
      } catch {
        return false;
      }
    },
    remove(uri) {
      const file = new File(uri);
      if (file.exists) file.delete();
    },
    clear() {
      if (dir.exists) dir.delete();
      ensureDir();
    },
  };
}
