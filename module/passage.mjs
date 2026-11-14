/**
 * Moving through creatures (Flow State - Generic Groups, Movement): you can't move through a hostile creature's space. Slip Through (Smallfolk T1) lets
 * a creature through the space of any creature at least one Size larger. Pure: positions in pixels, sizes in grid squares.
 */

/** Two tokens are hostile when one is Friendly and the other Hostile (Secret counts as Hostile; Neutral is neither). */
export const hostileDispositions = (a, b) => {
  const s = d => (!Number.isFinite(d) || d === 0 ? 0 : d > 0 ? 1 : -1);
  return s(a) * s(b) < 0;
};

/**
 * The first creature a move passes through: the token's footprint (w × h squares) slid along `path` ([{x, y}] top-left corners, the start first) overlaps
 * one of `others` ([{ id, x, y, w, h }]) by more than touching. Sampled every quarter square. Null if the way is clear.
 */
export function blockerOnPath(path, { w = 1, h = 1, size = 100 } = {}, others = []) {
  if (!others.length || path.length < 2) return null;
  const pw = w * size, ph = h * size, eps = 0.5;
  const overlaps = (x, y, o) => x < o.x + o.w * size - eps && x + pw > o.x + eps && y < o.y + o.h * size - eps && y + ph > o.y + eps;
  // The start doesn't count (a creature already overlapping you doesn't trap you).
  const start = others.filter(o => overlaps(path[0].x, path[0].y, o)).map(o => o.id);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (size / 4)));
    for (let k = 1; k <= n; k++) {
      const x = a.x + ((b.x - a.x) * k) / n, y = a.y + ((b.y - a.y) * k) / n;
      const hit = others.find(o => !start.includes(o.id) && overlaps(x, y, o));
      if (hit) return hit;
    }
  }
  return null;
}
