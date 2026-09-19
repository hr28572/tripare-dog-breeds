import { useEffect, useState } from 'react';

import { imageCache } from '@/hooks/useOfflineSync';
import type { ImageVariant } from '@/types/breed';

export interface CachedImageSource {
  id: string;
  url: string;
  variant: ImageVariant;
  localUri?: string | null;
  cachedLocally?: boolean | null;
}

export interface CachedImageState {
  /** What to render right now: the local file when cached, else the remote url. */
  uri: string | null;
  /** Call from expo-image onError to fall back to the remote url. */
  onError: () => void;
}

interface State {
  /** The initial uri this state was derived from; when it changes, state resets. */
  key: string | null;
  uri: string | null;
  failedLocal: boolean;
}

/**
 * Resolve the best uri for an image row. With `cacheOnDemand`, the file is
 * downloaded into the LRU cache (medium/large for the Gallery) and the uri
 * switches to the local copy once available.
 */
export function useCachedImage(source: CachedImageSource | null, cacheOnDemand = false): CachedImageState {
  const initial = source ? (source.cachedLocally && source.localUri ? source.localUri : source.url) : null;
  const [state, setState] = useState<State>({ key: initial, uri: initial, failedLocal: false });

  // Reset derived state when the source changes (React's "adjust state on prop change" pattern).
  if (state.key !== initial) {
    setState({ key: initial, uri: initial, failedLocal: false });
  }

  const alreadyLocal = !!(source?.cachedLocally && source.localUri);
  const sourceId = source?.id ?? null;
  const sourceUrl = source?.url ?? null;
  const sourceVariant = source?.variant ?? null;

  useEffect(() => {
    if (!sourceId || !sourceUrl || !sourceVariant || !cacheOnDemand || alreadyLocal || state.failedLocal) return;
    let cancelled = false;
    imageCache.ensureCached({ id: sourceId, url: sourceUrl, variant: sourceVariant }).then((local) => {
      if (!cancelled && local) setState((s) => (s.key === initial ? { ...s, uri: local } : s));
    });
    return () => {
      cancelled = true;
    };
  }, [sourceId, sourceUrl, sourceVariant, cacheOnDemand, alreadyLocal, state.failedLocal, initial]);

  return {
    uri: state.key === initial ? state.uri : initial,
    onError: () => {
      if (source && state.uri !== source.url) {
        setState({ key: initial, uri: source.url, failedLocal: true });
      }
    },
  };
}
