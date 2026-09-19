import { useEffect, useState } from 'react';

export const SEARCH_DEBOUNCE_MS = 300;

/** Returns `value` after it has been stable for `delayMs`. */
export function useDebouncedValue<T>(value: T, delayMs = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** Debounced search term, trimmed. Empty string when nothing to search. */
export function useDebouncedSearch(search: string, delayMs = SEARCH_DEBOUNCE_MS): string {
  return useDebouncedValue(search.trim(), delayMs);
}
