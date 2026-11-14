/**
 * The ancestry passives that only add Advantage to a check (no imports beyond the skill rules, so checks.mjs and generic.mjs can use them without a cycle):
 * Territorial (Bestial T2: perception in your territory; Tribe, T5, shares it with allies within 100 ft), Unassuming (Halfling T3: stealth checks),
 * Unbowed (Draken Legacy T2: resisting Fear).
 */
import { tierOf } from "./skills.mjs";

const tier = (actor, id) => tierOf(actor?.system?.trees, id);
const near = (a, b, ft) => {
  const x = a?.getActiveTokens?.()[0], y = b?.getActiveTokens?.()[0];
  if (!x || !y) return false;
  const size = globalThis.canvas?.grid?.size ?? 100, dist = globalThis.canvas?.grid?.distance ?? 5;
  return Math.hypot(x.center.x - y.center.x, x.center.y - y.center.y) / size * dist <= ft + 5;
};
/** Is the current scene this creature's territory (or, with Tribe, that of an ally within 100 ft whose territory it is)? */
export function inTerritory(actor) {
  const scene = globalThis.canvas?.scene;
  if (!scene || !actor) return false;
  if (tier(actor, "ancestry-bestial") >= 2 && actor.getFlag?.("flowstate", "territory") === scene.uuid) return true;
  const sideOf = a => Math.sign(a?.getActiveTokens?.()[0]?.document?.disposition ?? 0);
  return [...(scene.tokens ?? [])].some(t => t.actor && t.actor.uuid !== actor.uuid && tier(t.actor, "ancestry-bestial") >= 5 && t.actor.getFlag?.("flowstate", "territory") === scene.uuid
    && sideOf(t.actor) !== 0 && sideOf(t.actor) === sideOf(actor) && near(t.actor, actor, 100));
}
/** Magic Boost (Elf T4): once per rest (Overflowing Magic, T5: once per combat). Its use is kept like the other ancestry uses (ancestry.mjs). */
export function magicBoostReady(actor) {
  const t = tier(actor, "ancestry-elf-tree");
  if (t < 4) return false;
  if (t >= 5) { const k = globalThis.game?.combat?.started ? game.combat.id : null; return !k || actor.getFlag?.("flowstate", "ancUse")?.magicBoost !== k; }
  return !actor.getFlag?.("flowstate", "ancRest")?.magicBoost;
}
/** The flag update that uses Magic Boost up. */
export const magicBoostUse = actor => (tier(actor, "ancestry-elf-tree") >= 5
  ? { key: "ancUse", value: { magicBoost: globalThis.game?.combat?.started ? game.combat.id : null } } : { key: "ancRest", value: { magicBoost: true } });
export const ancestryNet = {
  perception: actor => (inTerritory(actor) ? 1 : 0),
  stealth: actor => (tier(actor, "ancestry-halfling-tree") >= 3 ? 1 : 0),
  fear: actor => (tier(actor, "ancestry-draken-legacy") >= 2 ? 1 : 0)
};
