/**
 * Skill tree rules (Rules doc Ch4). Pure functions so they can be unit-tested outside Foundry.
 * - A tree's tiers are unlocked in order; tier N costs N Skill Points (so 0 → 5 costs 15).
 * - Each Archetype's Theory unlocks its trees: Theory tier N makes the "T<N> Skill Trees" available.
 * - Theory Tier 0 is free and always known.
 * - Unspent Skill Points stay banked and still count toward total Skill Points.
 */
import { TREES } from "./trees.mjs";

export const ARCHETYPES = [
  { id: "martial", label: "Martial" },
  { id: "mental", label: "Mental", placeholder: "Mental skill trees are mid-rework and will be added once the rework is finished." },
  { id: "magic", label: "Magic" },
  { id: "generic", label: "Generic", placeholder: "Generic Groups (Perception, Stealth, Speech, Energy, and more) will be added once that document is ready." }
];

export const MAX_TIER = 5;
export const treeById = id => TREES.find(t => t.id === id);
export const treesFor = archetype => TREES.filter(t => t.archetype === archetype);
export const theoryFor = archetype => TREES.find(t => t.archetype === archetype && t.theory);

/** Current tier in a tree (Theory is at least 0; other trees are 0 = not started). */
export const tierOf = (state, id) => Math.max(0, Number(state?.[id]) || 0);

/** Skill Points spent across all trees: tier N cost N, so a tree at tier t cost t(t+1)/2. */
export function spentPoints(state = {}) {
  return Object.entries(state).reduce((n, [id, t]) => (treeById(id) ? n + (tierOf(state, id) * (tierOf(state, id) + 1)) / 2 : n), 0);
}

/** A tree is available once its Archetype's Theory reaches the tree's group tier. */
export function isAvailable(state, tree) {
  if (!tree) return false;
  if (tree.theory) return true;
  const theory = theoryFor(tree.archetype);
  return tierOf(state, theory?.id) >= tree.requires;
}

/** Can the next tier of this tree be bought? Returns { ok, next, cost, reason }. */
export function nextTier(state, tree, unspent, { inCombat = false } = {}) {
  const current = tierOf(state, tree.id);
  const next = current + 1;
  if (next > MAX_TIER) return { ok: false, next: null, cost: 0, reason: "Fully unlocked." };
  const cost = next;
  if (!isAvailable(state, tree)) return { ok: false, next, cost, reason: `Requires ${theoryFor(tree.archetype)?.name} Tier ${tree.requires}.` };
  if (inCombat) return { ok: false, next, cost, reason: "Skill Points can only be spent outside combat." };
  if (unspent < cost) return { ok: false, next, cost, reason: `Costs ${cost} Skill Point${cost === 1 ? "" : "s"}; you have ${unspent}.` };
  return { ok: true, next, cost, reason: `Costs ${cost} Skill Point${cost === 1 ? "" : "s"}.` };
}

/** The weapon type a Martial weapon tree is for ("martial-swift-weapons" → "swift"), or null for other trees. */
export const weaponTypeOfTree = id => /^martial-(.+)-weapons$/.exec(id ?? "")?.[1] ?? null;

/**
 * Can an ability from this tree be used with a weapon of these type(s)?
 * Weapon trees need one of the weapon's types. A multi-type weapon counts as all its types only with Weapon Master
 * (Martial Theory T5); otherwise just its main (first) type. Non-weapon trees always can.
 * @param {string|string[]} weaponTypes  the weapon's type, or all its types (main first)
 */
export function canUseWeaponSkill(state, treeId, weaponTypes) {
  const need = weaponTypeOfTree(treeId);
  if (!need) return true;
  const types = Array.isArray(weaponTypes) ? weaponTypes : [weaponTypes];
  // Unarmed and improvised aren't weapons in this sense.
  if (types[0] === "unarmed" || types[0] === "improvised") return false;
  const usable = tierOf(state, "martial-theory") >= 5 ? types : types.slice(0, 1);
  return usable.includes(need);
}
