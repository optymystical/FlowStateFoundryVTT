/**
 * The ancestry passives that only add Advantage to a check (no imports beyond the skill rules, so checks.mjs and generic.mjs can use them without a cycle):
 * Territorial (Bestial T2: perception in your territory; Tribe, T5, shares it with allies within 100 ft), Unassuming (Halfling T3: stealth checks),
 * Silent Wings (Strigid T2: stealth while flying), Unbowed (Draken Legacy T2), Hardened Mind (Smoblin T4) and Warren Instinct (Wildibit T4: an ally within
 * 10 ft) on resisting Fear, Treasured (Myrthel T2: persuasion against Elves), Unwelcome (Wasteling T0: Disadvantage on persuasion against anyone who
 * isn't a Wasteling). The ones that hang on the situation are ticks in the check's dialog (`situational`): Twitching Ears (Leporid T2: perception by
 * Hearing), Turning Gaze (Strigid T4: Spotting a creature), Perched (Noctua T1: 10 ft above it), Faith of the Flame (Firelander T2: a fire in sight).
 */
import { tierOf, hasAncestryTree } from "./skills.mjs";

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
/** A Wasteling (the Wasteling core in place of its Ancestry's). */
export const isWasteling = actor => !!actor?.system?.abc?.wasteling;
const allyNear = (actor, ft) => [...(globalThis.canvas?.scene?.tokens ?? [])].some(t => t.actor && t.actor.uuid !== actor.uuid && !t.actor.statuses?.has?.("unconscious")
  && Math.sign(t.disposition ?? 0) !== 0 && Math.sign(t.disposition ?? 0) === Math.sign(actor.getActiveTokens?.()[0]?.document?.disposition ?? 0) && near(t.actor, actor, ft));
export const ancestryNet = {
  perception: actor => (inTerritory(actor) ? 1 : 0),
  stealth: actor => (tier(actor, "ancestry-halfling-tree") >= 3 ? 1 : 0) + (tier(actor, "ancestry-strigid") >= 2 && actor?.statuses?.has?.("flying") ? 1 : 0),
  fear: actor => (tier(actor, "ancestry-draken-legacy") >= 2 ? 1 : 0) + (tier(actor, "ancestry-smoblin-tree") >= 4 ? 1 : 0)
    + (tier(actor, "ancestry-wildibit-tree") >= 4 && allyNear(actor, 10) ? 1 : 0),
  /** Persuasion against `target` (null: no one in particular). */
  persuasion: (actor, target) => (tier(actor, "ancestry-myrthel-tree") >= 2 && target?.system?.abc?.ancestry === "elf" ? 1 : 0)
    + (isWasteling(actor) && hasAncestryTree(actor.system, "ancestry-wasteling") && !isWasteling(target) ? -1 : 0)
};
/** The situational ones: [{ key, label }] ticks for a check's dialog of this kind. */
export function situational(actor, kind) {
  const out = [];
  if (kind === "perception") {
    if (tier(actor, "ancestry-leporid") >= 2) out.push({ key: "twitchingEars", label: "Twitching Ears: it relies on Hearing (Advantage)" });
    if (tier(actor, "ancestry-strigid") >= 4) out.push({ key: "turningGaze", label: "Turning Gaze: Spotting a creature (Advantage)" });
    if (tier(actor, "ancestry-noctua-tree") >= 1) out.push({ key: "perched", label: "Perched: at least 10 ft above the creature (Advantage)" });
  }
  if (kind === "fear" && tier(actor, "ancestry-firelander") >= 2) out.push({ key: "faithFlame", label: "Faith of the Flame: you can see a fire or bright light (Advantage)" });
  return out;
}
/** The dialog's ticks as HTML, and the Advantage the ticked ones give. */
export const situationalFields = (actor, kind) => situational(actor, kind).map(s => `<div class="form-group"><label><input type="checkbox" name="anc_${s.key}"> ${s.label}</label></div>`).join("");
export const situationalNet = (actor, kind, vals) => situational(actor, kind).filter(s => vals?.[`anc_${s.key}`]).length;
