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
