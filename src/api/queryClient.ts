import NetInfo from '@react-native-community/netinfo';
import { QueryClient, onlineManager } from '@tanstack/react-query';

import { LIST_GC_TIME_MS, LIST_STALE_TIME_MS, retryDelayMs, shouldRetry } from './queries';

/** True when the device reports a usable connection. */
export function isOnlineState(state: { isConnected: boolean | null; isInternetReachable: boolean | null }): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

// Let React Query pause/resume queries based on real device connectivity.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(isOnlineState(state))),
);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      retryDelay: retryDelayMs,
      staleTime: LIST_STALE_TIME_MS,
      gcTime: LIST_GC_TIME_MS,
      refetchOnWindowFocus: false,
    },
  },
});
