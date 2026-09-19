/**
 * Tiny in-app performance recorder. Marks are kept in memory (last 50) so the
 * Settings screen can show them on device; in dev they are also logged.
 */
export interface PerfMark {
  label: string;
  ms: number;
  at: number;
}

const MAX_MARKS = 50;
const marks: PerfMark[] = [];
const listeners = new Set<() => void>();

export const appStartedAt = Date.now();

function nowMs(): number {
  const p = (globalThis as { performance?: { now?: () => number } }).performance;
  return typeof p?.now === 'function' ? p.now() : Date.now();
}

export function recordPerf(label: string, ms: number): void {
  marks.push({ label, ms: Math.round(ms * 10) / 10, at: Date.now() });
  if (marks.length > MAX_MARKS) marks.shift();
  if (__DEV__) console.log(`[perf] ${label}: ${ms.toFixed(1)} ms`);
  listeners.forEach((l) => l());
}

export function measureSync<T>(label: string, fn: () => T): T {
  const start = nowMs();
  try {
    return fn();
  } finally {
    recordPerf(label, nowMs() - start);
  }
}

export async function measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = nowMs();
  try {
    return await fn();
  } finally {
    recordPerf(label, nowMs() - start);
  }
}

/** Record elapsed time since JS started, e.g. time to first list row. */
export function markSinceAppStart(label: string): void {
  recordPerf(label, Date.now() - appStartedAt);
}

export function getPerfMarks(): readonly PerfMark[] {
  return marks;
}

export function latestPerfMark(label: string): PerfMark | undefined {
  for (let i = marks.length - 1; i >= 0; i -= 1) if (marks[i].label === label) return marks[i];
  return undefined;
}

export function subscribePerf(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test helper. */
export function clearPerfMarks(): void {
  marks.length = 0;
}
