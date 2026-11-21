// Pure formatting and escaping helpers (no DOM access).

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only allows http(s) URLs; anything else (javascript:, data:, junk) becomes '#'. */
export function safeHttpUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || ''));
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
  } catch {
    // ignore invalid URLs
  }
  return '#';
}

export function formatCount(num) {
  if (num === null || num === undefined || num === '') return '-';
  const n = Number(num);
  if (!Number.isFinite(n)) return '-';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('en-US');
}

export function formatSizeKb(kb) {
  const n = Number(kb);
  if (!Number.isFinite(n) || n <= 0) return '0 KB';
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} GB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} MB`;
  return `${Math.round(n)} KB`;
}

export function formatDuration(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}

export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * CSV cell escaping. Also neutralizes spreadsheet formula injection
 * (cells starting with = + - @ tab or CR are prefixed with a quote).
 */
export function escapeCsv(val) {
  let str = String(val ?? '').replace(/\r?\n/g, ' ');
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  if (/[",]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function toCsv(headers, rows) {
  return [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
}
