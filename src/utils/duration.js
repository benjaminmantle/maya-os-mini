export const DURATIONS = [null, '15m', '30m', '45m', '1h', '1.5h', '2h', '3h', '4h', '∞'];

export function isOpenEnded(s) {
  return s === '∞' || /\+$/.test(s || '');
}

export function parseDurMs(s) {
  if (!s || s === '∞') return null;
  const clean = s.replace(/\+$/, '');
  const hm = clean.match(/^(\d+(?:\.\d+)?)h$/);
  if (hm) return parseFloat(hm[1]) * 3600000;
  const mm = clean.match(/^(\d+)m$/);
  if (mm) return parseInt(mm[1]) * 60000;
  return null;
}

export function fmtMs(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
