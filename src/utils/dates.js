export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function addDays(d, n) {
  const dt = new Date(d + 'T12:00:00');
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
}

export const get7 = () => Array.from({ length: 7 }, (_, i) => addDays(today(), i));

// Returns Mon–Sun of the current ISO week
export function getWeekDays() {
  const t = today();
  const dow = new Date(t + 'T12:00:00').getDay(); // 0=Sun
  const monday = addDays(t, dow === 0 ? -6 : 1 - dow);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function dayLabel(d) {
  if (d === today()) return 'Today';
  if (d === addDays(today(), 1)) return 'Tomorrow';
  if (d === addDays(today(), -1)) return 'Yesterday';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric'
  });
}

export const shortDay = d =>
  new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

export const shortNum = d => new Date(d + 'T12:00:00').getDate();

export const uid = () => Math.random().toString(36).slice(2, 10);
