const TOD_COLORS = ['#20e878', '#20d898', '#20c8b8', '#20a8d8', '#4088f8', '#6068f0', '#8048e8', '#9938d8'];

export function todColor(i, n) {
  if (n <= 1) return TOD_COLORS[0];
  const t = i / (n - 1);
  const fi = t * (TOD_COLORS.length - 1);
  const lo = Math.floor(fi);
  const hi = Math.min(lo + 1, TOD_COLORS.length - 1);
  const frac = fi - lo;
  const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r1, g1, b1] = p(TOD_COLORS[lo]);
  const [r2, g2, b2] = p(TOD_COLORS[hi]);
  return `rgb(${Math.round(r1 + (r2 - r1) * frac)},${Math.round(g1 + (g2 - g1) * frac)},${Math.round(b1 + (b2 - b1) * frac)})`;
}
