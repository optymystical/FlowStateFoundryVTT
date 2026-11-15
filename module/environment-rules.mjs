/**
 * Environments (Flow State - Generic Groups, Endurance): a GM-managed option. A scene can be a Lush, Fertile or Extreme biome of some kind (desert,
 * tundra...), and can have a Hazard (a blizzard, the curse of the Wastes). Shelter regions (a camp, a building, a cave) remove both while you're in them.
 *  - Extreme, unsheltered: Athletics checks have Disadvantage, and resting restores only half the usual HP.
 *  - A Hazard, unsheltered: each hour you lose 1/10 of your Max HP (rounded down).
 *  - Wusonian (ABCs): Acclimated (T1) to a biome kind ignores its Extreme penalties and has Advantage on Athletics checks there (two biomes at T4, every
 *    one you've lived in for a week at T5, which also ignores its Hazards); Hardy Constitution (T2): resting in an Extreme biome restores full HP, and
 *    Hazard losses are halved.
 * Scene flag `flowstate.environment` = { type: "lush" | "fertile" | "extreme" | "", biome, hazard, hazardName }; regions with `flowstate.shelter`.
 * No imports from the engine, so actions.mjs and checks.mjs can ask it.
 */
export const BIOME_TYPES = { "": "None (no environment rules)", lush: "Lush", fertile: "Fertile", extreme: "Extreme" };

const tier = (actor, id) => Number(actor?.system?.trees?.[id]) || 0;
const norm = s => String(s ?? "").trim().toLowerCase();

/** A scene's environment (null when it has none set). */
export function envOf(scene) {
  const e = scene?.flags?.flowstate?.environment;
  return e && (e.type || e.hazard) ? e : null;
}
/** Is the scene a Lush biome? (The Environment's biome type; an older scene's "Lush biome" checkbox, flag `lush`, still counts.) Emerald reads this. */
export const lushAt = (scene = globalThis.canvas?.scene) => envOf(scene)?.type === "lush" || !!scene?.flags?.flowstate?.lush;
/** The biomes a creature is Acclimated to (Wusonian T1; two at T4, any number at T5). */
export function acclimatedTo(actor) {
  const t = tier(actor, "ancestry-wusonian");
  if (t < 1) return [];
  const list = (actor.getFlag?.("flowstate", "biomes") ?? []).map(norm).filter(Boolean);
  return list.slice(0, t >= 5 ? list.length : t >= 4 ? 2 : 1);
}
/** Is a creature's token inside a Shelter region? */
export function sheltered(actor, scene = globalThis.canvas?.scene) {
  const tok = actor?.getActiveTokens?.()[0];
  if (!tok || !scene) return false;
  const c = tok.center ?? { x: tok.x, y: tok.y };
  return [...(scene.regions ?? [])].some(r => r.flags?.flowstate?.shelter && (() => { try { return r.testPoint({ x: c.x, y: c.y, elevation: tok.document?.elevation ?? 0 }); } catch { return false; } })());
}

/**
 * What the environment does to a creature: { extreme (its penalties apply), athleticsNet, restFull, restHalf, hazardLoss }. Pure given its inputs.
 */
export function envEffects(env, { sheltered: inside = false, acclimated = [], wusonian = 0, maxHp = 0 } = {}) {
  if (!env) return { extreme: false, athleticsNet: 0, restFull: false, restHalf: false, hazardLoss: 0 };
  const home = !!env.biome && acclimated.includes(norm(env.biome));
  const extreme = env.type === "extreme" && !inside && !home;
  const hardy = wusonian >= 2;
  const hazardLoss = env.hazard && !inside && !(home && wusonian >= 5) ? Math.floor(Math.floor(Math.max(0, maxHp) / 10) / (hardy ? 2 : 1)) : 0;
  return { extreme, athleticsNet: (extreme ? -1 : 0) + (home ? 1 : 0), restFull: env.type === "extreme" && hardy, restHalf: extreme && !hardy, hazardLoss };
}
/** The same for a creature on a scene. */
export const envFor = (actor, scene = globalThis.canvas?.scene) => envEffects(envOf(scene), { sheltered: sheltered(actor, scene), acclimated: acclimatedTo(actor),
  wusonian: tier(actor, "ancestry-wusonian"), maxHp: actor?.system?.hp?.max ?? 0 });
