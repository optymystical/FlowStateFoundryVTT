/**
 * Area spells (Magic Theory: Spell Attack Types): pick an Area shape, place it on the scene, and everything inside it is targeted.
 *  - 10 ft radius, 20 ft 90° cone, or 30 ft × 5 ft line. Snipe doubles the dimensions and Agate adds 50%.
 *  - The geometry is pure (unit-tested). Placement drops a Measured Template on the scene that the caster drags into position,
 *    then confirms; with no scene (or no canvas) the caller falls back to the current targets.
 */
const esc = s => foundry.utils.escapeHTML?.(String(s)) ?? String(s);

export const AREA_SHAPES = {
  radius: { label: "10 ft radius", t: "circle", distance: 10, angle: 360, width: 0 },
  cone: { label: "20 ft cone (90°)", t: "cone", distance: 20, angle: 90, width: 0 },
  line: { label: "30 ft line (5 ft wide)", t: "ray", distance: 30, angle: 0, width: 5 }
};

/** Template data for a shape at a point, scaled (Snipe ×2, Agate ×1.5). `direction` is degrees clockwise from east. */
export function areaTemplate(shape, { x = 0, y = 0, direction = 0, scale = 1 } = {}) {
  const s = AREA_SHAPES[shape] ?? AREA_SHAPES.radius;
  return { t: s.t, x, y, direction, distance: s.distance * scale, angle: s.angle, width: s.width * scale };
}

/**
 * Is a point inside a template? Everything in pixels except `distance`/`width` (feet): `grid` = { size, distance } converts.
 */
export function pointInArea(tpl, px, py, grid = { size: 100, distance: 5 }) {
  const ft = grid.size / grid.distance;                       // pixels per foot
  const dx = px - tpl.x, dy = py - tpl.y;
  const dist = Math.hypot(dx, dy);
  const reach = tpl.distance * ft;
  if (tpl.t === "circle") return dist <= reach;
  const rad = (tpl.direction * Math.PI) / 180;
  if (tpl.t === "cone") {
    if (dist > reach) return false;
    if (dist === 0) return true;
    let diff = Math.abs(((Math.atan2(dy, dx) * 180) / Math.PI - tpl.direction + 540) % 360 - 180);
    return diff <= (tpl.angle || 90) / 2 + 1e-9;
  }
  // ray: a rectangle along the direction
  const along = dx * Math.cos(rad) + dy * Math.sin(rad);
  const across = Math.abs(-dx * Math.sin(rad) + dy * Math.cos(rad));
  return along >= 0 && along <= reach && across <= ((tpl.width || 5) * ft) / 2;
}

/** Tokens (anything with document x/y/width/height, in grid squares) touched by the area: any corner, edge midpoint or the centre inside it. */
export function tokensInArea(tpl, tokens, grid = { size: 100, distance: 5 }) {
  return tokens.filter(t => {
    const d = t.document ?? t;
    const w = (d.width ?? 1) * grid.size, h = (d.height ?? 1) * grid.size;
    const x = d.x ?? 0, y = d.y ?? 0;
    const pts = [[0, 0], [w / 2, 0], [w, 0], [0, h / 2], [w / 2, h / 2], [w, h / 2], [0, h], [w / 2, h], [w, h]];
    return pts.some(([ox, oy]) => pointInArea(tpl, x + ox, y + oy, grid));
  });
}

/**
 * Let the caster choose a shape, drop the template, drag it into place, and confirm. Returns
 * { actors, shape, templateId } (actors may include the caster), or null if cancelled, or undefined when there's no scene to place on.
 */
export async function placeArea(actor, { title = "Area", scale = 1, aim = null, flags = {}, facing = false, origin = null } = {}) {
  const scene = globalThis.canvas?.scene;
  const grid = globalThis.canvas?.grid;
  if (!scene || !grid) return undefined;
  const DialogV2 = foundry.applications.api.DialogV2;
  const pick = await DialogV2.prompt({
    window: { title: `${title}: shape` },
    content: `<div class="fs-field"><label>Area</label><select name="shape">${Object.entries(AREA_SHAPES).map(([k, s]) =>
      `<option value="${k}">${esc(s.label)}${scale !== 1 ? ` (×${scale} → ${s.distance * scale} ft)` : ""}</option>`).join("")}</select></div>`,
    ok: { label: "Place it", callback: (event, button) => button.form.elements.shape.value }, rejectClose: false
  });
  if (!pick) return null;
  // Start on the caster, pointing at the first target if there is one.
  const src = globalThis.canvas.tokens?.controlled?.find(t => t.actor?.uuid === actor.uuid) ?? actor.getActiveTokens?.()[0];
  // Lob / Explode: the area starts where the ranged part lands (the `origin` token), not on the caster.
  const x = (origin ?? src)?.center?.x ?? 0, y = (origin ?? src)?.center?.y ?? 0;
  const direction = aim && src && !origin ? (Math.atan2(aim.center.y - y, aim.center.x - x) * 180) / Math.PI : src && origin ? (Math.atan2(origin.center.y - src.center.y, origin.center.x - src.center.x) * 180) / Math.PI : 0;
  const data = { ...areaTemplate(pick, { x, y, direction, scale }), fillColor: game.user.color?.css ?? "#a050ff", borderColor: "#a050ff",
    flags: { flowstate: { areaOf: actor.uuid, casterX: x, casterY: y, ...flags } } };
  const [doc] = await scene.createEmbeddedDocuments("MeasuredTemplate", [data]);
  try { globalThis.canvas.templates?.activate?.(); } catch (err) { /* layer switch is a convenience only */ }
  const ok = await DialogV2.confirm({
    window: { title: `${title}: place the area` },
    content: `<p>Drag the template into place (move it with the Templates tool; rotate it with Ctrl + the middle mouse wheel, or by dragging its handle), then press <strong>Confirm</strong>. Everything it touches is targeted.</p>`,
    yes: { label: "Confirm" }, no: { label: "Cancel" }, rejectClose: false
  });
  const placed = scene.templates?.get?.(doc?.id) ?? doc;
  if (!ok || !placed) { await placed?.delete?.(); return null; }
  const tpl = { t: placed.t, x: placed.x, y: placed.y, direction: placed.direction, distance: placed.distance, angle: placed.angle, width: placed.width };
  // A barrier line also needs a facing: which side attacks and movement are blocked from.
  let front = null;
  if (facing && tpl.t === "ray") {
    const pickFace = await DialogV2.prompt({
      window: { title: `${title}: facing` },
      content: `<p>Which side does it block things coming from?</p><div class="fs-field"><label>Faces</label><select name="face">${Object.entries(FACINGS).map(([k, f]) => `<option value="${k}">${f.label}</option>`).join("")}</select></div>`,
      ok: { label: "Set", callback: (event, button) => button.form.elements.face.value }, rejectClose: false
    });
    front = lineFront(tpl, FACINGS[pickFace ?? "away"], { x, y });
    await placed.update({ "flags.flowstate.frontX": front.x, "flags.flowstate.frontY": front.y });
  }
  const inside = tokensInArea(tpl, globalThis.canvas.tokens.placeables.filter(t => t.actor && t.actor.type !== "pile"), { size: grid.size, distance: grid.distance });
  return { actors: [...new Map(inside.map(t => [t.actor.uuid, t.actor])).values()], shape: pick, templateId: placed.id, tpl, front, grid: { size: grid.size, distance: grid.distance }, sceneId: scene.id };
}

/** Drop the caster's spell templates (they last until the start of the caster's next turn). */
export async function clearAreas(caster, { all = false } = {}) {
  const scene = globalThis.canvas?.scene;
  if (!scene) return;
  const mine = scene.templates.filter(t => t.flags?.flowstate?.areaOf === caster.uuid && (all || !t.flags.flowstate.ritualOf));
  for (const t of mine) {
    const walls = scene.walls?.filter(w => w.flags?.flowstate?.barrierOf === t.id).map(w => w.id) ?? [];
    if (walls.length) await scene.deleteEmbeddedDocuments("Wall", walls);
    await t.delete();
  }
}

/* -------------------------------------------- */
/*  Facing and walls (pure)                     */
/* -------------------------------------------- */

/** Compass facings for a line barrier: the direction attacks are blocked FROM (screen space: +y is down). */
export const FACINGS = {
  away: { label: "Away from me (blocks what comes from the far side)", x: 0, y: 0 },
  n: { label: "North", x: 0, y: -1 }, ne: { label: "North-east", x: 1, y: -1 }, e: { label: "East", x: 1, y: 0 }, se: { label: "South-east", x: 1, y: 1 },
  s: { label: "South", x: 0, y: 1 }, sw: { label: "South-west", x: -1, y: 1 }, w: { label: "West", x: -1, y: 0 }, nw: { label: "North-west", x: -1, y: -1 }
};

/** The unit normal of a ray template that points toward `face` (the side attacks come from). `face` = { x, y } (any length), or null for away from `caster`. */
export function lineFront(tpl, face, caster) {
  const rad = (tpl.direction * Math.PI) / 180;
  let n = { x: -Math.sin(rad), y: Math.cos(rad) };
  const toward = face && (face.x || face.y) ? face : { x: tpl.x - (caster?.x ?? tpl.x), y: tpl.y - (caster?.y ?? tpl.y) };
  if (n.x * toward.x + n.y * toward.y < 0) n = { x: -n.x, y: -n.y };
  return n;
}

/**
 * Wall segments for a barrier template, each with the outward ("front") normal that attacks and movement are blocked from.
 * Line: one segment facing `front`. Radius / cone: a polygon of segments facing outward (a dome).
 */
export function wallSegments(tpl, front = null, grid = { size: 100, distance: 5 }) {
  const ft = grid.size / grid.distance, reach = tpl.distance * ft;
  const rad = d => (d * Math.PI) / 180;
  if (tpl.t === "ray") {
    const e = { x: tpl.x + Math.cos(rad(tpl.direction)) * reach, y: tpl.y + Math.sin(rad(tpl.direction)) * reach };
    return [{ c: [tpl.x, tpl.y, e.x, e.y], front: front ?? lineFront(tpl, null, null) }];
  }
  const pts = [];
  const half = tpl.t === "cone" ? (tpl.angle || 90) / 2 : 180;
  const steps = tpl.t === "cone" ? 6 : 16;
  const start = tpl.t === "cone" ? tpl.direction - half : 0, span = tpl.t === "cone" ? half * 2 : 360;
  for (let i = 0; i <= steps; i++) pts.push({ x: tpl.x + Math.cos(rad(start + (span * i) / steps)) * reach, y: tpl.y + Math.sin(rad(start + (span * i) / steps)) * reach });
  const segs = [];
  for (let i = 0; i < steps; i++) {
    const a = pts[i], b = pts[i + 1], mx = (a.x + b.x) / 2 - tpl.x, my = (a.y + b.y) / 2 - tpl.y, len = Math.hypot(mx, my) || 1;
    segs.push({ c: [a.x, a.y, b.x, b.y], front: { x: mx / len, y: my / len } });
  }
  if (tpl.t === "cone") {                                      // the two straight edges close the wedge; their fronts point away from the wedge
    const a = pts[0], b = pts.at(-1), mid = rad(tpl.direction);
    const out = (p, q) => { const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1; let n = { x: -dy / l, y: dx / l }; if (n.x * Math.cos(mid) + n.y * Math.sin(mid) > 0) n = { x: -n.x, y: -n.y }; return n; };
    segs.push({ c: [tpl.x, tpl.y, a.x, a.y], front: out({ x: tpl.x, y: tpl.y }, a) }, { c: [b.x, b.y, tpl.x, tpl.y], front: out(b, { x: tpl.x, y: tpl.y }) });
  }
  return segs;
}

/**
 * Foundry's one-way `dir` for a wall segment so that it blocks from the `front` side. Foundry's convention (which of LEFT/RIGHT
 * means "blocks from the positive side") couldn't be checked here, so it's one constant: flip POSITIVE_SIDE_DIR if arrows come out reversed.
 */
export const POSITIVE_SIDE_DIR = 2;     // CONST.WALL_DIRECTIONS.RIGHT
export function wallDir(c, front) {
  const [x1, y1, x2, y2] = c;
  const mx = (x1 + x2) / 2 + front.x * 10, my = (y1 + y2) / 2 + front.y * 10;
  const orient = (x2 - x1) * (my - y1) - (y2 - y1) * (mx - x1);
  return orient > 0 ? POSITIVE_SIDE_DIR : 3 - POSITIVE_SIDE_DIR;
}

/** Wall documents for a barrier: blocks movement only (not sight, light or sound), one-way toward each segment's front. */
export function wallData(tpl, front, grid, flags = {}) {
  return wallSegments(tpl, front, grid).map(seg => ({ c: seg.c.map(Math.round), move: 20, sense: 0, light: 0, sound: 0, dir: wallDir(seg.c, seg.front), flags: { flowstate: flags } }));
}

/* -------------------------------------------- */
/*  Emplace barriers                            */
/* -------------------------------------------- */

/** Samples along a segment (a quarter square apart): is any of it inside the area? */
export function segmentTouchesArea(tpl, a, b, grid = { size: 100, distance: 5 }) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(len / (grid.size / 4)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (pointInArea(tpl, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, grid)) return true;
  }
  return false;
}

/** Which side of a barrier a point is on: a line has a left and a right; a radius or cone has an inside and an outside. */
export function barrierSide(tpl, p) {
  if (tpl.t === "ray") {
    const rad = (tpl.direction * Math.PI) / 180;
    return Math.sign(-(p.x - tpl.x) * Math.sin(rad) + (p.y - tpl.y) * Math.cos(rad)) || 1;
  }
  return pointInArea(tpl, p.x, p.y) ? 1 : -1;
}

/**
 * Does an Emplace barrier stop an attack from `attacker` at `target`? It's one-way. A line blocks attacks that start on its
 * front side (`front` = the unit normal toward the side attacks come from); a radius or cone is a dome that blocks attacks from
 * outside at what's inside. `caster` is only used for a dome the caster stands outside of. Pure.
 */
export function barrierBlocks(tpl, caster, attacker, target, grid = { size: 100, distance: 5 }, front = null) {
  if (!segmentTouchesArea(tpl, attacker, target, grid)) return false;
  if (tpl.t === "ray" && front) return (attacker.x - tpl.x) * front.x + (attacker.y - tpl.y) * front.y > 0;
  const protectedSide = barrierSide(tpl, caster);
  return barrierSide(tpl, attacker) !== protectedSide;
}

/** Emplace barriers on the scene that stand between an attacker's and a target's tokens: [{ id, sceneId, hp }]. */
export function barriersBetween(attackerToken, targetToken) {
  const scene = globalThis.canvas?.scene, grid = globalThis.canvas?.grid;
  if (!scene || !grid || !attackerToken || !targetToken) return [];
  const g = { size: grid.size, distance: grid.distance };
  const a = attackerToken.center, t = targetToken.center;
  const out = [];
  for (const d of scene.templates ?? []) {
    const f = d.flags?.flowstate;
    if (f?.spell !== "emplace" || !(f.health > 0)) continue;
    const tpl = { t: d.t, x: d.x, y: d.y, direction: d.direction, distance: d.distance, angle: d.angle, width: d.width };
    if (barrierBlocks(tpl, { x: f.casterX ?? d.x, y: f.casterY ?? d.y }, a, t, g, f.frontX !== undefined ? { x: f.frontX, y: f.frontY } : null)) out.push({ id: d.id, sceneId: scene.id, hp: f.health, limit: f.limit ?? f.health });
  }
  return out;
}

/** Set a barrier's remaining health (or remove it at 0). The scene's templates belong to whoever placed them, so the GM does this. */
export async function setBarrierHealth(sceneId, id, hp) {
  const d = globalThis.game?.scenes?.get?.(sceneId)?.templates?.get?.(id);
  if (!d) return;
  if (hp <= 0) {
    const scene = globalThis.game.scenes.get(sceneId);
    const walls = scene.walls.filter(w => w.flags?.flowstate?.barrierOf === id).map(w => w.id);
    if (walls.length) await scene.deleteEmbeddedDocuments("Wall", walls);
    await d.delete();
  } else await d.update({ "flags.flowstate.health": hp });
}

/** (GM) Put the barrier's real Walls on the scene. */
export async function createBarrierWalls(sceneId, walls) {
  const scene = globalThis.game.scenes.get(sceneId);
  if (scene && walls?.length) await scene.createEmbeddedDocuments("Wall", walls);
}

/** (GM) Flip a barrier: which side it blocks from, for its Walls and for the damage check. */
export async function flipBarrier(sceneId, templateId) {
  const scene = globalThis.game.scenes.get(sceneId);
  const d = scene?.templates?.get(templateId);
  if (!d) return;
  const f = d.flags?.flowstate ?? {};
  if (f.frontX !== undefined) await d.update({ "flags.flowstate.frontX": -f.frontX, "flags.flowstate.frontY": -f.frontY });
  const walls = scene.walls.filter(w => w.flags?.flowstate?.barrierOf === templateId);
  if (walls.length) await scene.updateEmbeddedDocuments("Wall", walls.map(w => ({ _id: w.id, dir: w.dir ? 3 - w.dir : w.dir })));
}
