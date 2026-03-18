const TOD_COLORS = ['#20e878', '#20d898', '#20c8b8', '#20a8d8', '#4088f8', '#6068f0', '#8048e8', '#9938d8'];

// Kraft palette — ink-on-parchment tones, slightly lightened: moss → teal → slate → indigo → violet → plum
const TOD_COLORS_KRAFT = ['#4a7a3c', '#386e64', '#2e5888', '#3848b0', '#5838a0', '#722e90', '#8c1e78', '#9e1860'];

export function todColor(i, n, theme) {
  const palette = theme === 'kraft' ? TOD_COLORS_KRAFT : TOD_COLORS;
  if (n <= 1) return palette[0];
  const t = i / (n - 1);
  const fi = t * (palette.length - 1);
  const lo = Math.floor(fi);
  const hi = Math.min(lo + 1, palette.length - 1);
  const frac = fi - lo;
  const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r1, g1, b1] = p(palette[lo]);
  const [r2, g2, b2] = p(palette[hi]);
  return `rgb(${Math.round(r1 + (r2 - r1) * frac)},${Math.round(g1 + (g2 - g1) * frac)},${Math.round(b1 + (b2 - b1) * frac)})`;
}
