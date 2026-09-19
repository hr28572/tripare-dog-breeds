import { ApiError } from '@/api/client';
import { RETRY_COUNT, retryDelayMs, shouldRetry } from '@/api/queries';

describe('retry policy', () => {
  it('backs off 1s, 2s, 4s and caps at 30s', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(retryDelayMs)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });

  it('retries transient errors up to RETRY_COUNT times', () => {
    const transient = new ApiError('network', 'x', 'u');
    expect(shouldRetry(0, transient)).toBe(true);
    expect(shouldRetry(RETRY_COUNT - 1, transient)).toBe(true);
    expect(shouldRetry(RETRY_COUNT, transient)).toBe(false);
  });

  it('never retries 404 but retries 429 and 5xx', () => {
    expect(shouldRetry(0, new ApiError('http', 'x', 'u', 404))).toBe(false);
    expect(shouldRetry(0, new ApiError('http', 'x', 'u', 429))).toBe(true);
    expect(shouldRetry(0, new ApiError('http', 'x', 'u', 503))).toBe(true);
  });
});
