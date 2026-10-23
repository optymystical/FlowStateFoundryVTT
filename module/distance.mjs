/**
 * Feet between the borders of two tokens (touching = 0), on any scene grid. Pure: the caller hands in the grid.
 * `grid` = { size (px per square), distance (ft per square), kind: "square" | "hex" | "gridless", measure(from, to) → feet (the grid's own path measure, for hexes) }.
 * A token is { x, y, w, h } in pixels (top left and size).
 */
export function borderDistance(A, B, grid = {}) {
  const size = grid.size || 100, ft = grid.distance ?? 5, kind = grid.kind ?? "square";
  const dx = Math.max(0, B.x - (A.x + A.w), A.x - (B.x + B.w));
  const dy = Math.max(0, B.y - (A.y + A.h), A.y - (B.y + B.h));
  const round = n => Math.round(n * 100) / 100;
  // Gridless: the straight line between the nearest points of the two borders.
  if (kind === "gridless") return round((Math.hypot(dx, dy) / size) * ft);
  // Hexes: count the hexes between the centres the way the grid does, less the half-widths of the two tokens (so neighbours touch at 0 ft).
  if (kind === "hex" && typeof grid.measure === "function") {
    const centre = t => ({ x: t.x + t.w / 2, y: t.y + t.h / 2 });
    const between = grid.measure(centre(A), centre(B));
    return round(Math.max(0, between - ((A.w + B.w) / 2 / size) * ft));
  }
  // Square: the larger of the horizontal and vertical gaps (a diagonal step counts as one square).
  return round((Math.max(dx, dy) / size) * ft);
}

/** Feet between the centres of two tokens on any grid: the grid's own measure on squares and hexes, a straight line when gridless. */
export function centreDistance(a, b, grid = {}) {
  const size = grid.size || 100, ft = grid.distance ?? 5, kind = grid.kind ?? "square";
  if (kind === "gridless") return Math.round((Math.hypot(a.x - b.x, a.y - b.y) / size) * ft * 100) / 100;
  if (kind === "hex" && typeof grid.measure === "function") return grid.measure(a, b);
  return Math.round((Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) / size) * ft * 100) / 100;
}

/**
 * Where a token really is: its stored top-left. In Foundry v14 a token's x/y (and its placeable's centre) follow its move animation, which can lag
 * a second behind (or never finish in a hidden window); `_source` is where the move ends. Anything with only a `center` falls back to it.
 */
export function tokenPos(t) {
  const d = t?.document ?? t;
  return { x: d?._source?.x ?? d?.x ?? t?.center?.x ?? 0, y: d?._source?.y ?? d?.y ?? t?.center?.y ?? 0 };
}

/** A token's centre at its stored position (Foundry's own centre for that spot when there is one, so hexes are right). */
export function tokenCentre(t) {
  const d = t?.document ?? t;
  const x = d?._source?.x ?? d?.x, y = d?._source?.y ?? d?.y;
  if (x === undefined || y === undefined) return t?.center ?? { x: 0, y: 0 };
  if (typeof d.getCenterPoint === "function") {
    try { const c = d.getCenterPoint({ x, y }); if (Number.isFinite(c?.x)) return { x: c.x, y: c.y }; } catch (err) { /* below */ }
  }
  const size = globalThis.canvas?.grid?.size ?? 100;
  return { x: x + ((d.width ?? 1) * size) / 2, y: y + ((d.height ?? 1) * size) / 2 };
}

/** The scene grid as `distance.mjs` wants it (square, hex or gridless; hexes are measured by Foundry's own path measure). */
export function gridFor(grid = globalThis.canvas?.grid) {
  const kind = grid?.isGridless ? "gridless" : grid?.isHexagonal ? "hex" : "square";
  return { size: grid?.size ?? 100, distance: grid?.distance ?? 5, kind,
    measure: kind === "hex" ? (from, to) => { try { const d = grid.measurePath([from, to]).distance; return Number.isFinite(d) ? d : 0; } catch (err) { return 0; } } : undefined };
}
