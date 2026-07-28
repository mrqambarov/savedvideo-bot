export function nf(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('en-US');
}

export function shortNum(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(v);
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleString('uz-UZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'hozirgina';
  if (s < 3600) return `${Math.floor(s / 60)} daqiqa oldin`;
  if (s < 86400) return `${Math.floor(s / 3600)} soat oldin`;
  if (s < 2592000) return `${Math.floor(s / 86400)} kun oldin`;
  return fmtDate(iso);
}

// Deterministic avatar color from a string.
const AV_COLORS = [
  ['#6366f1', '#8b5cf6'], ['#0ea5e9', '#22d3ee'], ['#10b981', '#34d399'],
  ['#f59e0b', '#fbbf24'], ['#ef4444', '#f87171'], ['#ec4899', '#f472b6'],
  ['#8b5cf6', '#c084fc'], ['#14b8a6', '#2dd4bf'],
];
export function avatarColor(seed) {
  const s = String(seed || '?');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const [a, b] = AV_COLORS[h % AV_COLORS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

export function initials(name) {
  const s = String(name || '?').replace(/^@/, '').trim();
  if (!s) return '?';
  return s.slice(0, 2).toUpperCase();
}

export function fmtShortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso).slice(5);
  return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short' });
}
