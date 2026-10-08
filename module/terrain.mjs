/**
 * Terrain regions: an easy way to put rough / difficult terrain on the scene, and what Geomancy's Muddy and Harden do to the ground.
 *
 *  - A terrain region is an ordinary Scene Region (so it can be moved, resized and reshaped with the Regions tools) carrying
 *    `flags.flowstate.terrain` = "rough" | "difficult" | "clear". No custom region type is involved.
 *  - The GM's client keeps each creature's `terrainLevel` flag in step with the terrain regions its token stands in: rough +1 AP to move,
 *    difficult +2 AP (posture penalties don't stack with it: the worst one applies), "clear" cancels both. `data.mjs` reads the flag.
 *  - Scene controls get a Flow State group (GM only) with one button per terrain: click it and a region of that terrain appears in the middle of
 *    your view, selected on the Regions layer, ready to drag and resize.
 *  - Muddy ("difficult terrain") and Harden ("loses negative terrain modifiers") place such a region where the material is, sized from its Body.
 *    It lasts until the start of the caster's next turn (a Ritual's lasts until the Ritual ends).
 * The geometry and level rules are pure (unit-tested).
 */
import { requestGM } from "./actions.mjs";

export const TERRAIN = {
  rough: { label: "Rough terrain", level: 1, color: "#b8863b", icon: "fa-solid fa-shoe-prints", tip: "+1 AP to move" },
  difficult: { label: "Difficult terrain", level: 2, color: "#8a3f1f", icon: "fa-solid fa-mountain", tip: "+2 AP to move" },
  clear: { label: "Cleared terrain", level: 0, color: "#3a9ec9", icon: "fa-solid fa-broom", tip: "cancels rough and difficult terrain" }
};

/** The AP penalty (0, 1 or 2) of standing in regions of these terrain kinds: "clear" cancels the rest, otherwise the worst wins. */
export function terrainLevel(kinds) {
  const list = (kinds ?? []).filter(k => TERRAIN[k]);
  if (list.includes("clear")) return 0;
  return list.reduce((n, k) => Math.max(n, TERRAIN[k].level), 0);
}

/**
 * Side (in feet) of the square footprint for `body` cubic feet of material: its square root, rounded up to whole grid squares (at least one).
 */
export function squareSideFt(body, gridFt = 5) {
  const side = Math.sqrt(Math.max(1, Number(body) || 1));
  return Math.max(1, Math.ceil(side / gridFt)) * gridFt;
}

/** Data for a terrain Region: a square of `sidePx` centred on (cx, cy). */
export function terrainRegionData(kind, { cx, cy, sidePx, name = null, flags = {}, visibility = 2 } = {}) {
  const t = TERRAIN[kind] ?? TERRAIN.rough;
  return {
    name: name ?? t.label, color: t.color, visibility,
    shapes: [{ type: "rectangle", x: Math.round(cx - sidePx / 2), y: Math.round(cy - sidePx / 2), width: Math.round(sidePx), height: Math.round(sidePx), rotation: 0, hole: false }],
    flags: { flowstate: { terrain: kind, ...flags } }
  };
}

/** The terrain kind a region carries, if it is a terrain region. */
export const kindOf = region => { const k = region?.flags?.flowstate?.terrain; return TERRAIN[k] ? k : null; };

/** The Regions a token is standing in (its own list where Foundry keeps one, else tested by the token's centre). */
export function regionsOf(token, scene = token?.parent) {
  if (token?.regions) return [...token.regions];
  const w = (token?.width ?? 1) * (scene?.grid?.size ?? 100), h = (token?.height ?? 1) * (scene?.grid?.size ?? 100);
  const p = { x: (token?.x ?? 0) + w / 2, y: (token?.y ?? 0) + h / 2 };
  return [...(scene?.regions ?? [])].filter(r => r.testPoint?.(p, token?.elevation ?? 0));
}

/** The terrain level for a token from the regions it is in. */
export const levelFor = token => terrainLevel(regionsOf(token).map(kindOf));

/** Bring every token on the scene's `terrainLevel` flag in line with the terrain regions it stands in. GM only. */
export async function syncTerrain(scene = globalThis.canvas?.scene) {
  if (!scene || !globalThis.game?.user?.isActiveGM) return;
  for (const token of scene.tokens ?? []) {
    const actor = token.actor;
    if (!actor || actor.type === "pile") continue;
    const level = levelFor(token);
    const have = actor.getFlag?.("flowstate", "terrainLevel") ?? 0;
    if (level === have) continue;
    try { if (level) await actor.setFlag("flowstate", "terrainLevel", level); else await actor.unsetFlag("flowstate", "terrainLevel"); } catch (err) { /* a sync is retried on the next move */ }
  }
}
let syncTimer = null;
const syncSoon = scene => { clearTimeout(syncTimer); syncTimer = setTimeout(() => syncTerrain(scene), 50); };

/** Centre of what the user is looking at, snapped to the grid. */
function viewCenter() {
  const c = globalThis.canvas;
  const p = c?.stage?.pivot ?? { x: 0, y: 0 };
  try { return c.grid.getSnappedPoint({ x: p.x, y: p.y }, { mode: CONST.GRID_SNAPPING_MODES.CENTER }); } catch (err) {
    const s = c?.grid?.size ?? 100; return { x: Math.round(p.x / s) * s, y: Math.round(p.y / s) * s };
  }
}

/** The scene-control button: drop a region of this terrain in the middle of the view and select it for dragging and resizing. */
let lastDrop = { kind: null, at: 0 };
export async function dropTerrain(kind) {
  // Foundry can report one click on a button tool more than once (onChange and the older onClick): drop a single region per click.
  const now = Date.now();
  if (lastDrop.kind === kind && now - lastDrop.at < 700) return null;
  lastDrop = { kind, at: now };
  const scene = globalThis.canvas?.scene;
  if (!scene) return ui.notifications.warn("There's no scene to put terrain on.");
  const grid = scene.grid;
  const c = viewCenter();
  const [doc] = await scene.createEmbeddedDocuments("Region", [terrainRegionData(kind, { cx: c.x, cy: c.y, sidePx: (grid.size ?? 100) * 2, flags: { placed: true } })]);
  try { globalThis.canvas.regions?.activate?.(); setTimeout(() => doc?.object?.control?.({ releaseOthers: true }), 100); } catch (err) { /* the region exists either way */ }
  ui.notifications.info(`${TERRAIN[kind].label} placed: drag and resize it with the Regions tools (${TERRAIN[kind].tip}).`);
  return doc;
}

/**
 * A spell leaves terrain behind (Muddy: difficult; Harden: cleared). Placed on `target`'s token if there is one, else the caster's, sized from the Body
 * of the material. Returns a line for the card ("" when there is no scene). Goes through the GM, who owns Regions.
 */
export async function placeSpellTerrain({ actor, kind, body, target = null, ritualOf = null, label = null }) {
  const scene = globalThis.canvas?.scene;
  if (!scene) return "";
  const at = (target?.getActiveTokens?.()[0] ?? actor.getActiveTokens?.()[0]);
  if (!at) return "";
  const gridFt = scene.grid?.distance ?? 5, size = scene.grid?.size ?? 100;
  const side = squareSideFt(body, gridFt);
  const data = terrainRegionData(kind, { cx: at.center?.x ?? at.x, cy: at.center?.y ?? at.y, sidePx: (side / gridFt) * size, name: `${label ?? TERRAIN[kind].label} (${actor.name})`,
    flags: { terrainOf: actor.uuid, ritualOf: ritualOf ?? null } });
  await requestGM("createTerrain", { sceneId: scene.id, data });
  return `${TERRAIN[kind].label}: a ${side} ft square${target ? ` around ${target.name}` : ` around ${actor.name}`} (drag and resize it with the Regions tools)${ritualOf ? ", until the Ritual ends" : ", until the start of your next turn"}.`;
}

/** GM side of `createTerrain`. */
export async function gmCreate({ sceneId, data }) {
  const scene = game.scenes.get(sceneId);
  if (!scene) return;
  await scene.createEmbeddedDocuments("Region", [data]);
}

/** A caster's terrain ends (the start of their next turn; `all` = when combat ends too, Ritual terrain included). */
export async function clearTerrain(caster, { all = false } = {}) {
  for (const scene of game.scenes ?? []) {
    const mine = [...(scene.regions ?? [])].filter(r => r.flags?.flowstate?.terrainOf === caster.uuid && (all || !r.flags.flowstate.ritualOf));
    if (mine.length) await scene.deleteEmbeddedDocuments("Region", mine.map(r => r.id));
  }
}

/** A Ritual ended: the terrain it made goes with it. */
export async function endRitual(ritualUuid) {
  for (const scene of game.scenes ?? []) {
    const mine = [...(scene.regions ?? [])].filter(r => r.flags?.flowstate?.ritualOf === ritualUuid && r.flags?.flowstate?.terrainOf);
    if (mine.length) await scene.deleteEmbeddedDocuments("Region", mine.map(r => r.id));
  }
}

/** Hooks: the scene-control buttons, and keeping `terrainLevel` in step as tokens move and regions change. */
export function register() {
  Hooks.on("getSceneControlButtons", controls => {
    if (!game.user.isGM) return;
    const tools = {};
    let order = 0;
    for (const [kind, t] of Object.entries(TERRAIN)) {
      tools[`fsTerrain-${kind}`] = { name: `fsTerrain-${kind}`, title: `${t.label}: drop on the view`, icon: t.icon, order: order++, button: true, visible: true, onChange: () => dropTerrain(kind) };
    }
    const group = { name: "flowstate", title: "Flow State terrain", icon: "fa-solid fa-mountain-sun", order: 99, visible: true, tools, activeTool: "" };
    if (Array.isArray(controls)) controls.push({ ...group, tools: Object.values(tools) });
    else controls.flowstate = group;
  });
  const scene = doc => doc?.parent ?? doc?.scene ?? globalThis.canvas?.scene;
  Hooks.on("updateToken", (token, changes) => { if (["x", "y", "width", "height", "elevation"].some(k => k in changes)) syncSoon(scene(token)); });
  Hooks.on("createToken", token => syncSoon(scene(token)));
  for (const h of ["createRegion", "updateRegion", "deleteRegion"]) Hooks.on(h, region => syncSoon(scene(region)));
  Hooks.on("canvasReady", () => syncSoon(globalThis.canvas?.scene));
}
