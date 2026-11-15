/**
 * The Bestiary (Flow State - Bestiary), the pure part: the creature Ancestries (Wonderborn: Omens and Heralds of a Wonder) and their Backgrounds,
 * what a Bestiary build gives (Size, the trees set to the Background's tier, the Wonderborn's Domain), the Wonder a creature is a piece of, the
 * poles it serves, and its natural attacks as the trees word them. No Foundry globals (unit-tested); bestiary.mjs is what the trees do in play.
 */
import { ANCESTRIES, BACKGROUNDS } from "./abc-rules.mjs";
import { WONDERS, KINDS, wonderById, wonderPower } from "./mental-rules.mjs";
import { TREES } from "./trees.mjs";
import { tierOf } from "./skills.mjs";

export const WONDERBORN = "ancestry-wonderborn";
export const isBestiary = id => !!ANCESTRIES[id]?.bestiary;
/** The Bestiary's Ancestries (for the GM's NPC wizard), and the Backgrounds one can take (Omen, Herald). */
export const bestiaryAncestries = () => Object.values(ANCESTRIES).filter(a => a.bestiary && !a.hidden);
export const bestiaryBackgrounds = id => Object.values(BACKGROUNDS).filter(b => b.bestiary && !b.hidden && (b.available ?? []).includes(id));
/** A Bestiary Ancestry's label: "Life (Wonderborn)". */
export const bestiaryLabel = a => `${a.name}${a.coreName ? ` (${a.coreName})` : ""}`;

/** The Mental Wonder a Wonderborn Ancestry is a piece of (the one it's named after: Life, Dark, Growth...). */
export function wonderFor(ancestryId) {
  const a = ANCESTRIES[ancestryId];
  if (!a?.bestiary || a.core !== WONDERBORN) return null;
  return WONDERS.find(w => w.name === (a.wonderName ?? a.name))?.id ?? null;
}
/** The Bestiary Ancestry of a Wonder (Seed and Rend build an Omen from it), or null while the Bestiary has none. */
export const ancestryForWonder = wonderId => bestiaryAncestries().find(a => wonderFor(a.id) === wonderId) ?? null;

/** The paired Wonder (Life ↔ Death, Order ↔ Chaos...): its opposite pole, the neighbour of the other type in the doc's order. */
export function pairOf(wonderId) {
  const i = WONDERS.findIndex(w => w.id === wonderId), w = WONDERS[i];
  if (!w) return null;
  const n = WONDERS[w.kind === "dream" ? i + 1 : i - 1];
  return n && n.kind !== w.kind ? n.id : null;
}

/**
 * What a Bestiary build gives: { ancestry, background, wonder, kind, size, free, form, sapience, ratio }. `free` is every tree it starts with at its
 * tier, none of them counting as Skill Points: the Ancestry's trees at the Background's tier (Omen 3, Herald 5) and, for a Wonderborn, its Domain
 * (Mental Theory and its own Wonder at Tier 5). Null if the Background isn't open to the Ancestry.
 */
export function bestiaryBuild(ancestryId, backgroundId) {
  const a = ANCESTRIES[ancestryId], b = BACKGROUNDS[backgroundId];
  if (!a?.bestiary || !b?.bestiary || !(b.available ?? []).includes(ancestryId)) return null;
  const wonder = wonderFor(ancestryId), t = Math.max(0, Math.min(5, Number(b.setTier) || 0));
  const free = Object.fromEntries((a.trees ?? []).map(id => [id, t]));
  if (wonder) { free["mental-theory"] = 5; free[wonder] = 5; }
  return { ancestry: a.id, background: b.id, wonder, kind: wonderById(wonder)?.kind ?? null, size: a.sizes?.[b.id] ?? a.size ?? 3, free,
    form: a.form || null, sapience: b.sapience ?? null, ratio: b.ratio ?? null };
}

/* -------------------------------------------- */
/*  Creatures: their Wonder and the poles they serve   */
/* -------------------------------------------- */

const flagsOf = a => a?.flags?.flowstate ?? {};
/** The Wonder a creature is a piece of: a Wonderborn's (its Ancestry), or a seeded Omen's (its flag). */
export const wonderOf = a => wonderFor(a?.system?.abc?.ancestry) ?? flagsOf(a).omen?.wonder ?? null;
/** The Wonders (poles) a creature serves: its own (a Wonderborn or an Omen), a Mental user's Patron, and any the GM marked on its sheet. */
export function polesServed(a) {
  const out = new Set();
  const w = wonderOf(a);
  if (w) out.add(w);
  if (flagsOf(a).patron) out.add(flagsOf(a).patron);
  for (const x of [flagsOf(a).servesPole ?? []].flat()) if (x && wonderById(x)) out.add(x);
  return out;
}
export const serves = (a, wonder) => !!wonder && polesServed(a).has(wonder);
/** It serves the opposite pole of `wonder`. */
export const opposes = (a, wonder) => !!wonder && serves(a, pairOf(wonder));
/** A Herald of `wonder` (a Wonderborn of it with the Herald Background). */
export const isHeraldOf = (a, wonder) => !!wonder && wonderFor(a?.system?.abc?.ancestry) === wonder && a?.system?.abc?.background === "herald";

/** What a creature must reach to resist Allure or Dread (as Fear): its Skill Points × its Size. */
export const presenceNeed = a => Math.max(0, Number(a?.system?.skillPoints) || 0) * Math.max(1, Number(a?.system?.size) || 3);

/** The Wonder Power a creature's Wonderborn abilities scale with: its Wonder's stat (Ponderance for Dream, Snappence for Nightmare) per full 10. */
export function powerOf(a, wonder = wonderOf(a)) {
  const kind = wonderById(wonder)?.kind;
  const stat = KINDS[kind]?.stat ?? "pon";
  return Math.max(1, wonderPower(a?.system?.derived?.effective?.[stat]?.value ?? a?.system?.stats?.[stat] ?? 0));
}

/* -------------------------------------------- */
/*  Natural attacks                             */
/* -------------------------------------------- */

const NATURAL = /^You can spend (\d+) AP to (\w+) a target within (your melee range|(\d+) ?ft), dealing (\d+)d(\d+) (\w+) damage/i;
/**
 * The natural attacks a creature's Bestiary trees give it, read from their words ("You can spend 2 AP to gore a target within your melee range,
 * dealing 1d10 physical damage. This scales with your Wonder's Power..."): [{ tree, name, ap, verb, range (ft, null = melee), dice, die, type, scales }].
 */
export function naturalAttacks(trees = {}) {
  const out = [];
  for (const t of TREES) {
    if (!t.bestiary || t.rulesOnly) continue;
    const have = tierOf(trees, t.id);
    for (const tier of t.tiers) {
      if (tier.tier > have) continue;
      for (const e of tier.entries) {
        const m = NATURAL.exec(e.text ?? "");
        if (!m) continue;
        out.push({ tree: t.id, name: e.name, ap: Number(m[1]), verb: m[2].toLowerCase(), range: m[4] ? Number(m[4]) : null, dice: Number(m[5]), die: Number(m[6]),
          type: m[7].toLowerCase(), scales: /scales with your Wonder'?s Power/i.test(e.text) });
      }
    }
  }
  return out;
}
/** A natural attack's damage formula at a Wonder Power: 1d10 × Power 3 = 3d10. */
export const naturalFormula = (n, power = 1) => `${Math.max(1, n.dice * (n.scales ? Math.max(1, Math.floor(power) || 1) : 1))}d${n.die}`;

/** Tiers of the Bestiary trees that matter in play, by name (a creature's own tree is "ancestry-<ancestry id>"). */
export const tiers = a => {
  const trees = a?.system?.trees ?? {};
  return { wonderborn: tierOf(trees, WONDERBORN), dream: tierOf(trees, "ancestry-dreamborn"), nightmare: tierOf(trees, "ancestry-nightmareborn"),
    life: tierOf(trees, "ancestry-wonderborn-life"), dark: tierOf(trees, "ancestry-wonderborn-dark"), growth: tierOf(trees, "ancestry-wonderborn-growth") };
};
