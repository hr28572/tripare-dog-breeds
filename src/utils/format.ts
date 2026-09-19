/** "just now", "3 min ago", "2 h ago", "yesterday", "5 days ago", or a date. */
export function formatRelativeTime(timestampMs: number | null, now = Date.now()): string {
  if (timestampMs === null) return 'never';
  const diff = Math.max(0, now - timestampMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return 'just now';
  if (diff < hour) return `${Math.floor(diff / minute)} min ago`;
  if (diff < day) return `${Math.floor(diff / hour)} h ago`;
  if (diff < 2 * day) return 'yesterday';
  if (diff < 30 * day) return `${Math.floor(diff / day)} days ago`;
  return new Date(timestampMs).toLocaleDateString();
}

/** "4–6 kg", "6 kg", or "—" */
export function formatRange(min: number | null, max: number | null, unit: string): string {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  if (min !== null && max !== null) return min === max ? `${fmt(min)} ${unit}` : `${fmt(min)}–${fmt(max)} ${unit}`;
  if (max !== null) return `${fmt(max)} ${unit}`;
  if (min !== null) return `${fmt(min)} ${unit}`;
  return '—';
}

/** Screen-reader friendly range: "4 to 6 kilograms", never an en dash. */
export function spokenRange(min: number | null, max: number | null, unit: string): string {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  if (min !== null && max !== null) return min === max ? `${fmt(min)} ${unit}` : `${fmt(min)} to ${fmt(max)} ${unit}`;
  if (max !== null) return `${fmt(max)} ${unit}`;
  if (min !== null) return `${fmt(min)} ${unit}`;
  return 'unknown';
}

export function formatLifeSpan(min: number | null, max: number | null): string {
  const r = formatRange(min, max, 'years');
  return r === '—' ? r : r.replace(/^(\d+) years$/, '$1 years');
}

export function capitalize(value: string | null | undefined): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function joinNonEmpty(parts: (string | null | undefined)[], separator = ' · '): string {
  return parts.filter((p): p is string => !!p && p.trim().length > 0).join(separator);
}
