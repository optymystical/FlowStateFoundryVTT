/**
 * Environments, the GM's side (the rules are environment-rules.mjs): the scene's biome and Hazard (the Flow State scene controls), Shelter regions,
 * "an hour passes", and the Hazard's hourly health loss as world time goes by.
 */
import { BIOME_TYPES, envOf, envFor } from "./environment-rules.mjs";
import { notCreature } from "./kinds.mjs";
import { esc, select, DialogV2 } from "./html.mjs";

/** The GM sets the scene's environment. */
export async function configure(scene = globalThis.canvas?.scene) {
  if (!game.user.isGM || !scene) return null;
  const e = scene.flags?.flowstate?.environment ?? {};
  const vals = await DialogV2().prompt({ window: { title: `Environment: ${scene.name}` }, rejectClose: false,
    content: `<p class="hint">Optional (Generic Groups, Endurance). Extreme: Athletics checks have Disadvantage and rest restores half the HP, outside Shelter. A Hazard takes a tenth of Max HP each hour outside Shelter.</p>
      <div class="form-group"><label>Biome type</label>${select("type", Object.entries(BIOME_TYPES), e.type ?? "")}</div>
      <div class="form-group"><label>Biome (desert, tundra, jungle...)</label><input type="text" name="biome" value="${esc(e.biome ?? "")}"></div>
      <div class="form-group"><label>Hazard</label><input type="checkbox" name="hazard" ${e.hazard ? "checked" : ""}></div>
      <div class="form-group"><label>Hazard name</label><input type="text" name="hazardName" value="${esc(e.hazardName ?? "")}" placeholder="a blizzard, thin air, the Firelands..."></div>`,
    ok: { label: "Save", callback: (event, button) => { const f = button.form.elements; return { type: f.type.value, biome: f.biome.value.trim(), hazard: f.hazard.checked, hazardName: f.hazardName.value.trim() }; } } });
  if (!vals) return null;
  await scene.update({ "flags.flowstate.environment": { ...vals, hazardTick: game.time?.worldTime ?? 0 } });
  ui.notifications.info(`${scene.name}: ${vals.type ? `${BIOME_TYPES[vals.type]}${vals.biome ? ` (${vals.biome})` : ""}` : "no biome rules"}${vals.hazard ? `, Hazard${vals.hazardName ? `: ${vals.hazardName}` : ""}` : ""}.`);
  return vals;
}

/** A Shelter region dropped at the middle of the view (drag and resize it with the Regions tools). */
export async function dropShelter() {
  const scene = globalThis.canvas?.scene;
  if (!game.user.isGM || !scene) return null;
  const size = scene.grid?.size ?? 100, v = globalThis.canvas.stage?.pivot ?? { x: size * 5, y: size * 5 };
  const half = size * 2;
  const [doc] = await scene.createEmbeddedDocuments("Region", [{ name: "Shelter", color: "#4a8a5a", visibility: 1,
    shapes: [{ type: "rectangle", x: Math.round(v.x - half), y: Math.round(v.y - half), width: half * 2, height: half * 2, rotation: 0 }], flags: { flowstate: { shelter: true } } }]);
  ui.notifications.info("Shelter placed: drag and resize it with the Regions tools. Inside it the biome's and the Hazard's penalties don't apply.");
  return doc;
}

/** "An hour passes": world time moves on an hour (the Hazard ticks from the world-time hook). */
export const hourPasses = () => (game.user.isGM ? game.time.advance(3600) : null);

/** The scene's Hazard takes its toll for every whole hour of world time since the last tick (GM, on the scene being viewed). */
async function hazardTick(worldTime) {
  const scene = globalThis.canvas?.scene, env = envOf(scene);
  if (!game.user.isActiveGM || !env?.hazard) return;
  const last = Number(scene.flags.flowstate.environment.hazardTick ?? worldTime);
  const hours = Math.floor((worldTime - last) / 3600);
  if (hours < 1) { if (worldTime < last) await scene.update({ "flags.flowstate.environment.hazardTick": worldTime }); return; }
  await scene.update({ "flags.flowstate.environment.hazardTick": last + hours * 3600 });
  const lines = [];
  for (const t of scene.tokens ?? []) {
    const a = t.actor;
    if (!a || notCreature(a) || a.statuses?.has?.("dead")) continue;
    const loss = envFor(a, scene).hazardLoss * hours;
    if (!loss) continue;
    await a.update({ "system.hp.value": a.system.hp.value - loss });
    lines.push(`${esc(a.name)} −${loss}`);
  }
  if (lines.length) await ChatMessage.create({ content: `<div class="flowstate-card"><header class="fs-card-title">${esc(env.hazardName || "Hazard")}</header><div class="fs-notes">${hours} hour${hours === 1 ? "" : "s"} exposed without shelter: ${lines.join(", ")}.</div></div>` });
}

/** The scene-control tools (terrain.mjs adds them to the Flow State group). */
export function tools(order) {
  const env = envOf(globalThis.canvas?.scene);
  return {
    fsEnvironment: { name: "fsEnvironment", title: env ? `Environment: ${BIOME_TYPES[env.type] ?? ""}${env.biome ? ` (${env.biome})` : ""}${env.hazard ? ", Hazard" : ""}. Click to change it.` : "Set this scene's environment (biome, Hazard)",
      icon: "fa-solid fa-sun-plant-wilt", order: order++, button: true, visible: true, onChange: () => configure() },
    fsShelter: { name: "fsShelter", title: "Shelter: drop on the view (no biome or Hazard penalties inside)", icon: "fa-solid fa-campground", order: order++, button: true, visible: true, onChange: () => dropShelter() },
    fsHour: { name: "fsHour", title: "An hour passes (world time; a Hazard takes its toll)", icon: "fa-solid fa-hourglass-half", order: order++, button: true, visible: true, onChange: () => hourPasses() }
  };
}

export function register() {
  Hooks.on("updateWorldTime", worldTime => { hazardTick(worldTime).catch(err => console.error("flowstate | hazard", err)); });
}
