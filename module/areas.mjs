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
export async function placeArea(actor, { title = "Area", scale = 1, aim = null, flags = {} } = {}) {
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
  const x = src?.center?.x ?? 0, y = src?.center?.y ?? 0;
  const direction = aim && src ? (Math.atan2(aim.center.y - y, aim.center.x - x) * 180) / Math.PI : 0;
  const data = { ...areaTemplate(pick, { x, y, direction, scale }), fillColor: game.user.color?.css ?? "#a050ff", borderColor: "#a050ff",
    flags: { flowstate: { areaOf: actor.uuid, casterX: x, casterY: y, ...flags } } };
  const [doc] = await scene.createEmbeddedDocuments("MeasuredTemplate", [data]);
  try { globalThis.canvas.templates?.activate?.(); } catch (err) { /* layer switch is a convenience only */ }
  const ok = await DialogV2.confirm({
    window: { title: `${title}: place the area` },
    content: `<p>Drag the template into place (move it with the Templates tool; rotate it with the mouse wheel or by dragging its handle), then press <strong>Confirm</strong>. Everything it touches is targeted.</p>`,
    yes: { label: "Confirm" }, no: { label: "Cancel" }, rejectClose: false
  });
  const placed = scene.templates?.get?.(doc?.id) ?? doc;
  if (!ok || !placed) { await placed?.delete?.(); return null; }
  const tpl = { t: placed.t, x: placed.x, y: placed.y, direction: placed.direction, distance: placed.distance, angle: placed.angle, width: placed.width };
  const inside = tokensInArea(tpl, globalThis.canvas.tokens.placeables.filter(t => t.actor && t.actor.type !== "pile"), { size: grid.size, distance: grid.distance });
  return { actors: [...new Map(inside.map(t => [t.actor.uuid, t.actor])).values()], shape: pick, templateId: placed.id };
}

/** Drop the caster's spell templates (they last until the start of the caster's next turn). */
export async function clearAreas(caster, { all = false } = {}) {
  const scene = globalThis.canvas?.scene;
  if (!scene) return;
  const mine = scene.templates.filter(t => t.flags?.flowstate?.areaOf === caster.uuid && (all || !t.flags.flowstate.ritualOf));
  for (const t of mine) await t.delete();
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
 * Does an Emplace barrier stop an attack from `attacker` at `target`? It's one-way: it protects the side the caster stood on,
 * so it only blocks attacks that start on the other side and pass through it. Pure.
 */
export function barrierBlocks(tpl, caster, attacker, target, grid = { size: 100, distance: 5 }) {
  if (!segmentTouchesArea(tpl, attacker, target, grid)) return false;
  const protectedSide = barrierSide(tpl, caster);
  if (barrierSide(tpl, attacker) === protectedSide) return false;       // same side as the caster: it lets them through
  return true;
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
    if (barrierBlocks(tpl, { x: f.casterX ?? d.x, y: f.casterY ?? d.y }, a, t, g)) out.push({ id: d.id, sceneId: scene.id, hp: f.health });
  }
  return out;
}

/** Set a barrier's remaining health (or remove it at 0). The scene's templates belong to whoever placed them, so the GM does this. */
export async function setBarrierHealth(sceneId, id, hp) {
  const d = globalThis.game?.scenes?.get?.(sceneId)?.templates?.get?.(id);
  if (!d) return;
  if (hp <= 0) await d.delete(); else await d.update({ "flags.flowstate.health": hp });
}
