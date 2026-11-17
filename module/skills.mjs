/**
 * Skill tree rules (Rules doc Ch4). Pure functions so they can be unit-tested outside Foundry.
 * - A tree's tiers are unlocked in order; tier N costs N Skill Points (so 0 → 5 costs 15).
 * - Each Archetype's Theory unlocks its trees: Theory tier N makes the "T<N> Skill Trees" available.
 * - Each Generic Group's Core tree (its namesake: Perception, Stealth...) unlocks the Group's other trees ("Requires Stealth 2").
 *   The sense trees (Sight, Hearing, Smell) need Perception 1, 3 or 5 when the character's base sense is Heightened, Primary or Secondary.
 * - Theory and Core Tier 0 is free and always known.
 * - Unspent Skill Points stay banked and still count toward total Skill Points.
 * - Ancestry trees (Flow State - ABCs; archetype "ancestry") are open only to their Ancestries (`tree.ancestries`); none needs another (a Bestiary
 *   tree may: `tree.requiresTree`). Each tree's Tier 0 is free. `ctx.ancestry` is the character's Ancestry id; `ctx.wasteling` (system.abc.wasteling)
 *   swaps the Ancestry's core for the Wasteling core (`replacesCore`).
 * - A Background's free points (`free`: tree id → tier, the character's `system.freeTrees`) cost nothing: only tiers past them are paid for.
 */
import { TREES } from "./trees.mjs";

export const ARCHETYPES = [
  { id: "martial", label: "Martial" },
  { id: "mental", label: "Mental" },
  { id: "magic", label: "Magic" },
  { id: "generic", label: "Generic" },
  { id: "ancestry", label: "Ancestry" }
];

export const MAX_TIER = 5;
export const treeById = id => TREES.find(t => t.id === id);
export const treesFor = archetype => TREES.filter(t => t.archetype === archetype);
export const theoryFor = archetype => TREES.find(t => t.archetype === archetype && t.theory);
/** The Generic Groups' Core trees, in the doc's order. */
export const coreTrees = () => TREES.filter(t => t.core && t.archetype === "generic");
/** The tree that opens this one: its Generic Group's Core tree, or its Archetype's Theory. */
export const coreFor = tree => (tree?.archetype === "ancestry" ? (tree.core ? tree : treeById(tree.requiresTree?.id) ?? treeById(tree.coreId) ?? null)
  : tree?.group ? TREES.find(t => t.core && t.group === tree.group) : theoryFor(tree?.archetype));
/**
 * The ancestry trees an Ancestry can take, in the doc's order (its core, lineage, shared and own trees). A Wasteling has the Wasteling core in place of
 * its Ancestry's core.
 */
export function ancestryTrees(ancestry, wasteling = false) {
  if (!ancestry) return [];
  const own = TREES.filter(t => t.archetype === "ancestry" && !t.rulesOnly && !t.replacesCore && (t.ancestries ?? []).includes(ancestry));
  if (!wasteling) return own;
  const w = TREES.find(t => t.archetype === "ancestry" && t.replacesCore);
  return [...(w ? [w] : []), ...own.filter(t => !t.core)];
}
/** Does this creature's Ancestry have the tree (so its Tier 0 rules apply)? `sys` is the actor's system data. */
export const hasAncestryTree = (sys, id) => !!sys?.abc?.ancestry && ancestryTrees(sys.abc.ancestry, !!sys.abc.wasteling).some(t => t.id === id);
/** The context a character's trees are judged in: its base senses and its Ancestry (and whether it's a Wasteling). */
export const ctxOf = sys => ({ senses: sys?.senses, ancestry: sys?.abc?.ancestry || null, wasteling: !!sys?.abc?.wasteling });
/** Trees that share a Theory/Core: the same Generic Group, or the same Archetype. */
export const sameGroup = (a, b) => (a?.group || b?.group ? a?.group === b?.group : a?.archetype === b?.archetype);
/**
 * The Theory/Core tier a tree needs. A sense tree needs Perception 1, 3 or 5 by the character's base sense (Heightened, Primary, Secondary;
 * a sense with no level counts as Secondary); without the character's senses, the sense's default (Sight and Hearing Primary, Smell Secondary).
 */
export function requiredTier(tree, { senses } = {}) {
  if (tree?.archetype === "ancestry") return tree.requiresTree?.tier ?? 0;
  const r = tree?.senseRequires;
  if (!r || !senses) return tree?.requires ?? 0;
  return r[senses[r.sense]] ?? r.secondary;
}
/**
 * The lists trees are picked from (the Skills tab, the wizards): each Archetype, then each Generic Group. { id, label, trees, coreName }; a Group's id is
 * "generic-<group>".
 */
export function skillGroups({ ancestry = null, ancestryName = "", wasteling = false } = {}) {
  const own = ancestryTrees(ancestry, wasteling);
  return [...(own.length ? [{ id: "ancestry", label: `${ancestryName || "Ancestry"} (Ancestry)`, trees: own, coreName: own.find(t => t.core)?.name ?? "" }] : []),
    ...ARCHETYPES.filter(a => !a.placeholder && a.id !== "generic" && a.id !== "ancestry").map(a => ({ id: a.id, label: a.label, trees: treesFor(a.id), coreName: theoryFor(a.id)?.name ?? "" })),
    ...coreTrees().filter(c => c.archetype === "generic").map(c => ({ id: `generic-${c.group}`, label: `${c.name} (Generic)`, trees: TREES.filter(t => t.group === c.group), coreName: c.name }))];
}
/** "Requires Stealth Tier 2" / "Requires Martial Theory Tier 3". */
export const requirementText = (tree, ctx) => (tree?.archetype === "ancestry" && tree.replacesCore ? "a Wasteling" : tree?.archetype === "ancestry" && !tree.requiresTree
  ? `the ${(tree.ancestries ?? []).join(" or ").replace(/-/g, " ")} Ancestry` : `${coreFor(tree)?.name ?? "Theory"} Tier ${requiredTier(tree, ctx)}`);

/** Current tier in a tree (Theory is at least 0; other trees are 0 = not started). */
export const tierOf = (state, id) => Math.max(0, Number(state?.[id]) || 0);

/** Skill Points spent across all trees: tier N cost N, so a tree at tier t cost t(t+1)/2. */
export function spentPoints(state = {}, free = {}) {
  const cost = t => (t * (t + 1)) / 2;
  return Object.keys(state).reduce((n, id) => (treeById(id) ? n + Math.max(0, cost(tierOf(state, id)) - cost(Math.min(tierOf(free, id), tierOf(state, id)))) : n), 0);
}

/** A tree is available once its Theory (or Generic Core tree) reaches the tier it needs. `ctx.senses`: the character's base senses (sense trees). */
export function isAvailable(state, tree, ctx = {}) {
  if (!tree) return false;
  if (tree.archetype === "ancestry") {
    if (tree.rulesOnly || !ctx.ancestry || !ancestryTrees(ctx.ancestry, !!ctx.wasteling).includes(tree)) return false;
    return !tree.requiresTree || tierOf(state, tree.requiresTree.id) >= tree.requiresTree.tier;
  }
  if (tree.theory) return true;
  return tierOf(state, coreFor(tree)?.id) >= requiredTier(tree, ctx);
}

/** Can the next tier of this tree be bought? Returns { ok, next, cost, reason }. */
export function nextTier(state, tree, unspent, { inCombat = false, senses, ancestry = null, wasteling = false } = {}) {
  const current = tierOf(state, tree.id);
  const next = current + 1;
  if (next > MAX_TIER) return { ok: false, next: null, cost: 0, reason: "Fully unlocked." };
  const cost = next;
  if (!isAvailable(state, tree, { senses, ancestry, wasteling })) return { ok: false, next, cost, reason: `Requires ${requirementText(tree, { senses })}.` };
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

/**
 * The Skills tab's list of trees, in the order a player looks for them: **pinned** trees first (their own picks), then the trees they have
 * points in, then the trees they could start, by Archetype (Theory first, then by the Theory tier that opens them). `filter` keeps the trees
 * whose name has it. Each row says its tier and whether its next tier can be bought now (`canRaise`). Trees not open yet aren't listed.
 * Returns { pinned, yours, unlock: [{ id, label, rows }], first }.
 */
export function treeNav(state = {}, { pinned = [], unspent = 0, inCombat = false, filter = "", senses, ancestry = null, ancestryName = "", wasteling = false } = {}) {
  const q = String(filter ?? "").trim().toLowerCase();
  const pins = new Set(pinned);
  const order = (a, b) => (b.theory - a.theory) || ((a.requires ?? 0) - (b.requires ?? 0)) || a.name.localeCompare(b.name);
  const row = t => ({ id: t.id, name: t.name, archetype: t.archetype, archLabel: ARCHETYPES.find(a => a.id === t.archetype)?.label ?? t.archetype,
    tier: tierOf(state, t.id), max: MAX_TIER, theory: !!t.theory || !!t.core, pinned: pins.has(t.id), available: isAvailable(state, t, { senses, ancestry, wasteling }),
    canRaise: nextTier(state, t, unspent, { inCombat, senses, ancestry, wasteling }).ok });
  const shown = t => !t.hidden && (!q || t.name.toLowerCase().includes(q));
  const out = { pinned: [], yours: [], unlock: [] };
  // The Archetypes, then each Generic Group (its Core tree first, then the trees it opens by the tier they need).
  for (const a of skillGroups({ ancestry, ancestryName, wasteling })) {
    const trees = a.trees.filter(shown).sort(order);
    const unlock = [];
    for (const t of trees) {
      const r = row(t);
      if (r.pinned) out.pinned.push(r);
      else if (r.tier > 0) out.yours.push(r);
      else if (r.available) unlock.push(r);
    }
    if (unlock.length) out.unlock.push({ id: a.id, label: a.label, rows: unlock });
  }
  out.first = out.pinned[0]?.id ?? out.yours[0]?.id ?? out.unlock[0]?.rows[0]?.id ?? null;
  return out;
}
