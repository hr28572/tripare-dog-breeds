export const API_BASE_URL =
  process.env.EXPO_PUBLIC_DOG_API_BASE_URL?.replace(/\/+$/, '') ?? 'https://dogapi.dog/api/v2';

export const REQUEST_TIMEOUT_MS = 15_000;

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'parse' | 'aborted';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;
  readonly url: string;

  constructor(kind: ApiErrorKind, message: string, url: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.url = url;
  }

  /** 4xx (except 408/429) will not succeed on retry. */
  get isRetryable(): boolean {
    if (this.kind === 'aborted') return false;
    if (this.kind === 'http' && this.status !== undefined) {
      if (this.status === 408 || this.status === 429) return true;
      return this.status >= 500;
    }
    return true;
  }
}

export function isRetryableError(error: unknown): boolean {
  return error instanceof ApiError ? error.isRetryable : true;
}

export interface FetchJsonOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * GET `path` (relative to the API base, or absolute) and parse JSON.
 * Enforces a per-request timeout and maps every failure to an ApiError.
 */
export async function fetchJson<T>(path: string, options: FetchJsonOptions = {}): Promise<T> {
  const url = /^https?:\/\//.test(path) ? path : `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onOuterAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onOuterAbort);
  if (options.signal?.aborted) controller.abort();

  try {
    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/vnd.api+json, application/json' },
      });
    } catch (error) {
      if (timedOut) throw new ApiError('timeout', `Request timed out after ${timeoutMs}ms`, url);
      if (options.signal?.aborted) throw new ApiError('aborted', 'Request aborted', url);
      throw new ApiError('network', error instanceof Error ? error.message : 'Network request failed', url);
    }

    if (!response.ok) {
      throw new ApiError('http', `HTTP ${response.status} for ${url}`, url, response.status);
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new ApiError('parse', error instanceof Error ? error.message : 'Invalid JSON', url);
    }
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onOuterAbort);
  }
}
