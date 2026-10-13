/**
 * Putting a token or a pile beside another on a scene whose grid isn't square (hexes, or no grid at all). Square grids keep their own cell arithmetic in
 * `actions.mjs`; this is the geometry for the rest: candidate spots around a token, the test for "is there room", and the choice between them.
 * Pure: the caller hands in `snap` (Foundry's grid snapping) and `inReach`. Tokens are { x, y, w, h } in pixels, top left and size.
 */

/** How far from its centre a w × h rectangle's border is, along the unit vector (ux, uy). */
export function halfExtent(w, h, ux, uy) {
  const tx = Math.abs(ux) > 1e-9 ? w / 2 / Math.abs(ux) : Infinity;
  const ty = Math.abs(uy) > 1e-9 ? h / 2 / Math.abs(uy) : Infinity;
  return Math.min(tx, ty);
}

const centre = t => ({ x: t.x + t.w / 2, y: t.y + t.h / 2 });
const radius = t => Math.max(t.w, t.h) / 2;

/** Do two tokens overlap? Round tokens, so that neighbouring hexes (whose boxes overlap at the corners) don't count. */
export function overlapping(a, b, tolerance = 0.9) {
  const ca = centre(a), cb = centre(b);
  return Math.hypot(ca.x - cb.x, ca.y - cb.y) < (radius(a) + radius(b)) * tolerance;
}

/** Do they touch (are next to each other)? */
export function touching(a, b) {
  const ca = centre(a), cb = centre(b);
  return Math.hypot(ca.x - cb.x, ca.y - cb.y) <= (radius(a) + radius(b)) * 1.25;
}

/**
 * Spots for `mover` (a { w, h }) that touch `anchor`, one every 360/n degrees, the one nearest `preferred` (a direction vector, default east) first.
 * Each is a top-left position, not yet snapped to any grid.
 */
export function candidateSpots(anchor, mover, preferred = { x: 1, y: 0 }, n = 16) {
  const c = centre(anchor);
  const base = Math.atan2(preferred.y || 0, preferred.x || 1);
  const out = [];
  for (let k = 0; k < n; k++) {
    // 0, +1, -1, +2, -2 ... steps away from the preferred direction
    const step = k === 0 ? 0 : (k % 2 ? (k + 1) / 2 : -k / 2);
    const a = base + step * (2 * Math.PI / n);
    const ux = Math.cos(a), uy = Math.sin(a);
    const d = halfExtent(anchor.w, anchor.h, ux, uy) + halfExtent(mover.w, mover.h, ux, uy);
    out.push({ x: c.x + ux * d - mover.w / 2, y: c.y + uy * d - mover.h / 2 });
  }
  return out;
}

/**
 * The best free spot beside `anchor` for `mover`: touching it, clear of `others`, inside reach when possible, then the shortest pull from where the
 * mover is now. `snap(topLeft)` puts a candidate on the grid (identity when gridless); `inReach(centrePoint)` says whether a spot is within reach.
 * Returns { x, y } or null when every side is taken.
 */
export function pickSpot({ anchor, mover, others = [], snap = p => p, inReach = () => true, from = null, preferred = undefined, n = 16 }) {
  const now = from ?? mover;
  let best = null;
  for (const raw of candidateSpots(anchor, mover, preferred, n)) {
    const tl = snap(raw);
    const spot = { x: tl.x, y: tl.y, w: mover.w, h: mover.h };
    if (overlapping(spot, anchor) || !touching(spot, anchor) || others.some(o => overlapping(spot, o))) continue;
    const c = centre(spot);
    const score = (inReach(c) ? 0 : 1000) + Math.hypot(c.x - (now.x + (now.w ?? mover.w) / 2), c.y - (now.y + (now.h ?? mover.h) / 2));
    if (!best || score < best.score - 1e-6) best = { score, x: tl.x, y: tl.y };
  }
  return best && { x: best.x, y: best.y };
}
