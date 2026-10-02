/**
 * Spell effects: what each automated Core Spell / Combo Spell does when it hits. Pure data and functions (no Foundry globals).
 * Bolded numbers in the docs scale by Spell Power (dice counts, health, die-size changes, Force); `power` is that multiplier.
 * Tier 1: Shield, Force, Cut, Stab, Slam and the six pure Tier 1 Combos.
 */

/** Key for a cast's Core(s): one id, or two ids sorted and joined with "+". */
export const profileKey = coreIds => [...coreIds].sort().join("+");

const G = "magic-gravity:force", SL = "magic-slashing:cut", PI = "magic-piercing:stab", CR = "magic-crushing:slam", SH = "magic-protection-arcana:shield";

/**
 * Base effects at Spell Power ×1.
 *  damage        { n, sides, type }        dice count scales with power
 *  livingDie     die size bonus when the target is living and the spell would deal direct damage (Cut)
 *  critStack     extra Strengthened stacks on a crit (in addition to the normal crit stacks)
 *  directStack   extra Strengthened stacks if the spell would deal direct damage
 *  force         { n, sides, when }        Force applied in a direction of your choosing: "hit", "direct" damage, or "crit"
 *  dodgeDie      −die size on the target's dodge rolls until your next turn (scaled by power), on a hit
 *  attackDie     −die size on the target's attack rolls until your next turn (scaled by power), if direct damage
 *  tripleLowDodge  roll three times the dice on a crit when the target's dodge was a third or less of its normal maximum
 *  shield        health of a projected shield (scaled by power)
 */
export const PROFILES = {
  [SH]: { name: "Shield", shield: 20 },
  [G]: { name: "Force", force: { n: 8, sides: 10, when: "hit" } },
  [SL]: { name: "Cut", damage: { n: 2, sides: 6, type: "physical" }, livingDie: 4 },
  [PI]: { name: "Stab", damage: { n: 1, sides: 10, type: "physical" }, critStack: 1 },
  [CR]: { name: "Slam", damage: { n: 1, sides: 12, type: "physical" }, dodgeDie: 2 },
  [profileKey([G, SL])]: { name: "Force + Cut", damage: { n: 4, sides: 6, type: "physical" }, force: { n: 8, sides: 10, when: "direct" } },
  [profileKey([G, PI])]: { name: "Force + Stab", damage: { n: 2, sides: 10, type: "physical" }, force: { n: 20, sides: 10, when: "crit" } },
  [profileKey([G, CR])]: { name: "Force + Slam", damage: { n: 2, sides: 12, type: "physical" }, force: { n: 8, sides: 10, when: "hit" }, dodgeDie: 2 },
  [profileKey([SL, PI])]: { name: "Cut + Stab", damage: { n: 3, sides: 6, type: "physical" }, directStack: 1, critStack: 1 },
  [profileKey([SL, CR])]: { name: "Cut + Slam", damage: { n: 2, sides: 12, type: "physical" }, attackDie: 5 },
  [profileKey([PI, CR])]: { name: "Stab + Slam", damage: { n: 2, sides: 12, type: "physical" }, tripleLowDodge: true }
};

/** The automated profile for these Cores, or null (the GM resolves it from the card). */
export const profileFor = coreIds => PROFILES[profileKey(coreIds)] ?? null;

/**
 * The damage dice for a hit.
 * @param profile  a PROFILES entry
 * @param power    Spell Power
 * @param ctx      { living, direct, crit, lowDodge }  facts about the target and the roll
 * @returns { n, sides, type, extraStacks, notes[] } or null if the spell deals no damage
 */
export function damageDice(profile, power, ctx = {}, mods = {}) {
  if (!profile.damage) return null;
  let { n, sides } = profile.damage;
  n *= Math.max(1, power);
  const notes = [];
  let extraStacks = 0;
  if (profile.livingDie && ctx.living && ctx.direct) { sides += profile.livingDie; notes.push(`Living target, direct damage: dice are d${sides}`); }
  if (profile.critStack && ctx.crit) { extraStacks += profile.critStack; notes.push(`+${profile.critStack} Strengthened (crit)`); }
  if (profile.directStack && ctx.direct) { extraStacks += profile.directStack; notes.push(`+${profile.directStack} Strengthened (direct damage)`); }
  if (profile.tripleLowDodge && ctx.crit && ctx.lowDodge) { n *= 3; notes.push("Crit against a low dodge: three times the dice"); }
  // Crush (Crushing T2): a dodge of a third of their normal maximum or less Strengthens the damage.
  if (mods.crush && ctx.lowDodge) { extraStacks += 1; notes.push("Crush: +1 Strengthened (low dodge)"); }
  // Telegraph (Crushing T5): a dodge roll within range of your guess doubles the damage dice.
  if (mods.telegraph && ctx.telegraphHit) { n *= 2; notes.push(`Telegraph: the dodge landed within ${ctx.telegraphRange} of your guess (${ctx.telegraphGuess}): twice the dice`); }
  return { n, sides, type: profile.damage.type, extraStacks, notes };
}

/** Force dice this hit applies (null if none): when "direct", "crit" or "hit" matches. */
export function forceDice(profile, power, { direct = false, crit = false } = {}) {
  const f = profile.force;
  if (!f) return null;
  if (f.when === "direct" && !direct) return null;
  if (f.when === "crit" && !crit) return null;
  return { n: f.n * Math.max(1, power), sides: f.sides };
}

/** Die-size penalties from a hit: { dodge, attack } (both positive numbers; 0 when none). */
export function diePenalties(profile, power, { direct = false } = {}) {
  return {
    dodge: profile.dodgeDie ? profile.dodgeDie * Math.max(1, power) : 0,
    attack: profile.attackDie && direct ? profile.attackDie * Math.max(1, power) : 0
  };
}

export const shieldHealth = (profile, power) => (profile.shield ?? 0) * Math.max(1, power);

/** A die size after the worst active penalty (they don't stack), never below 1. */
export const penalizedDie = (die, penalty) => Math.max(1, die - Math.max(0, penalty));

/** Spell Mods whose effects are automated (everything else only costs Threshold, and the card tells the GM to resolve it). */
export const AUTOMATED_MODS = new Set([
  "magic-theory:pinpoint", "magic-theory:react",
  "magic-slashing:bleed", "magic-slashing:gash", "magic-slashing:cleave", "magic-slashing:chop",
  "magic-piercing:exploit", "magic-piercing:pierce", "magic-piercing:setup", "magic-piercing:weakpoint",
  "magic-crushing:crush", "magic-crushing:bash", "magic-crushing:beatdown", "magic-crushing:telegraph",
  "magic-gravity:burden", "magic-gravity:lighten", "magic-gravity:personal-repulsion", "magic-gravity:personal-well", "magic-gravity:hold", "magic-gravity:gravity-field",
  "magic-protection-arcana:reflect", "magic-protection-arcana:adjust", "magic-protection-arcana:dampen",
  "magic-theory:empower", "magic-theory:snipe", "magic-theory:duplicate"
]);

/** Gravity's Replacement Mods: when one replaces the base effect, Force (the Gravity part of the spell) is dropped. */
export const GRAVITY_REPLACEMENTS = ["burden", "lighten", "personal repulsion", "personal well", "hold"];
/** The spell's profile after Replacement Mods: a replaced Force is gone (its Combo partner's part stays). */
export function applyReplacements(profile, replaced = {}) {
  if (!profile) return profile;
  if (GRAVITY_REPLACEMENTS.some(n => replaced[n])) return { ...profile, force: null };
  return profile;
}
/** A Replacement Mod that replaces the base effect is doubled in power. */
export const replaceFactor = (replaced, name) => (replaced?.[name] ? 2 : 1);

/** { bleed: 1, exploit: 2, … } from the applied Mods (lowercase names, stack counts). */
export function modCounts(applied) {
  const out = {};
  for (const a of applied) { const k = a.mod.name.toLowerCase(); out[k] = (out[k] ?? 0) + 1; }
  return out;
}

/** Pierce value from the Pierce Mod: 10 per stack, scaled by Spell Power. */
export const piercePerStack = power => 10 * Math.max(1, power);
/** Exploit: each consumed Advantage gives +4 die size to the attack roll, scaled by Spell Power. */
export const exploitDie = power => 4 * Math.max(1, power);
