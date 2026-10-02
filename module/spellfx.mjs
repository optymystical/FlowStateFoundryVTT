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

/**
 * Tier 2 (Heat, Cold, Radiation, Acid) profiles and their Combos with the Tier 1 and Tier 2 Cores.
 * Beyond damage they use an `effects` list; each effect may have a `when` and one of:
 *   stack   { kind, per | dice | fixed, where: "damaged" | "first" | "target" }   Ignite / Stain stacks (per = × the damage dealt)
 *   energy  { per | dice }           remove Energy from the target (per = × the damage dealt)
 *   extra   { type, per, bypass }   extra damage (per = × the damage dealt); bypass ignores armor
 *   force   { n, sides }            Force in a direction of your choosing
 *   chain   { adv }                 chain to another target (adv: −1 Disadvantage, 0 none, +1 Advantage)
 *   dodgeDis / scorch / freezeAll   see elemental.mjs
 * `when`: hit, direct, crit, directLiving, lowDodge, heatBefore, stainMore, energyZeroBefore, energyZeroAfter.
 * `at: "hit"` effects of spells with no damage resolve when the attack hits.
 */
const FL = "magic-heat:flame", FR = "magic-cold:frost", CK = "magic-radiation:crackle", GL = "magic-acid:glob";
const dmg = (n, sides, type) => ({ n, sides, type });
Object.assign(PROFILES, {
  [FL]: { name: "Flame", damage: dmg(1, 12, "heat"), effects: [{ stack: { kind: "ignite", per: 1 } }], hold: true },
  [FR]: { name: "Frost", damage: dmg(1, 8, "cold"), effects: [{ energy: { per: 1 } }], hold: true },
  [CK]: { name: "Crackle", damage: dmg(1, 12, "radiation"), effects: [{ chain: { adv: -1 } }], hold: true },
  [GL]: { name: "Glob", damage: dmg(1, 8, "acid"), effects: [{ stack: { kind: "stain", per: 1 } }], hold: true },
  // Tier 1 + Tier 2
  [profileKey([G, FL])]: { name: "Force + Flame", damage: dmg(2, 10, "heat"), effects: [{ stack: { kind: "ignite", per: 1 } }, { when: "heatBefore", force: { n: 12, sides: 10 } }] },
  [profileKey([SL, FL])]: { name: "Cut + Flame", damage: dmg(2, 6, "physical"), effects: [{ when: "direct", extra: { type: "heat", per: 2, bypass: true } }, { when: "direct", stack: { kind: "ignite", per: 2, where: "target" } }] },
  [profileKey([PI, FL])]: { name: "Stab + Flame", damage: dmg(2, 10, "heat"), effects: [{ when: "crit", stack: { kind: "ignite", per: 3 } }] },
  [profileKey([CR, FL])]: { name: "Slam + Flame", damage: dmg(1, 6, "heat"), effects: [{ scorch: true }] },
  [profileKey([G, FR])]: { name: "Force + Frost", damage: dmg(1, 12, "cold"), effects: [{ energy: { per: 1 } }, { when: "energyZeroAfter", force: { n: 16, sides: 10 } }] },
  [profileKey([SL, FR])]: { name: "Cut + Frost", damage: dmg(2, 6, "cold"), livingDie: 4, effects: [{ energy: { per: 1 } }] },
  [profileKey([PI, FR])]: { name: "Stab + Frost", damage: dmg(1, 12, "cold"), effects: [{ when: "crit", energy: { per: 2 } }] },
  [profileKey([CR, FR])]: { name: "Slam + Frost", damage: dmg(2, 6, "cold"), effects: [{ when: "energyZeroBefore", dodgeDis: true }] },
  [profileKey([G, CK])]: { name: "Force + Crackle", force: { n: 20, sides: 10, when: "hit" }, chain: true, effects: [{ chain: { adv: 0, force: true } }] },
  [profileKey([SL, CK])]: { name: "Cut + Crackle", damage: dmg(2, 8, "physical"), effects: [{ when: "directLiving", chain: { adv: -1 } }] },
  [profileKey([PI, CK])]: { name: "Stab + Crackle", damage: dmg(2, 12, "physical"), effects: [{ when: "crit", chain: { adv: 1 } }] },
  [profileKey([CR, CK])]: { name: "Slam + Crackle", damage: dmg(2, 10, "physical"), effects: [{ when: "lowDodge", chain: { adv: 0 } }] },
  [profileKey([G, GL])]: { name: "Force + Glob", damage: dmg(2, 6, "acid"), effects: [{ stack: { kind: "stain", per: 1 } }, { when: "stainMore", force: { n: 16, sides: 10 } }] },
  [profileKey([SL, GL])]: { name: "Cut + Glob", damage: dmg(2, 6, "acid"), effects: [{ when: "direct", stack: { kind: "stain", per: 2 } }] },
  [profileKey([PI, GL])]: { name: "Stab + Glob", damage: dmg(2, 6, "acid"), effects: [{ when: "crit", stack: { kind: "stain", per: 2 } }] },
  [profileKey([CR, GL])]: { name: "Slam + Glob", effects: [{ at: "hit", stack: { kind: "stain", crushAcid: true, where: "first" } }] },
  // Pure Tier 2
  [profileKey([FL, FR])]: { name: "Flame + Frost", effects: [{ at: "hit", stack: { kind: "ignite", dice: [3, 10], where: "first", tag: "hc" } }, { at: "hit", energy: { sameAsStacks: true } }] },
  [profileKey([FL, CK])]: { name: "Flame + Crackle", effects: [{ at: "hit", heatRad: { dice: [1, 8] } }] },
  [profileKey([FL, GL])]: { name: "Flame + Glob", effects: [{ at: "hit", stack: { kind: "searing", dice: [2, 10], where: "first" } }] },
  [profileKey([FR, CK])]: { name: "Frost + Crackle", damage: dmg(2, 12, "cold"), needsEnergyZero: true, effects: [{ energy: { per: 1 } }, { chain: { adv: 0, needsEnergyZero: true } }] },
  [profileKey([FR, GL])]: { name: "Frost + Glob", effects: [{ at: "hit", stack: { kind: "stain", dice: [1, 6], where: "first" } }, { at: "hit", freezeAll: true }] },
  [profileKey([CK, GL])]: { name: "Crackle + Glob", effects: [{ at: "hit", stack: { kind: "electric", dice: [3, 12], where: "first" } }] }
});

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
  // Tier 2 Mods that change the dice or the Strengthened stacks.
  let extraDice = null, flare = null;
  if (mods.cook && ctx.cookCount > 0) { extraDice = { n: ctx.cookCount * Math.max(1, power), sides: 4 }; notes.push(`Cook: +${extraDice.n}d4 (heat damage dealt to them ${ctx.cookCount}× this turn)`); }
  if (mods.shatter && ctx.energyZeroBefore) { extraStacks += 2; notes.push("Shatter: doubly Strengthened (no Energy left)"); }
  if (mods.electrify && ctx.firstDamage) { extraStacks += 1; notes.push("Electrify: Strengthened (first damage to them this turn)"); }
  if (mods.charge && ctx.chainHitsBefore >= 2) { const k = Math.floor(ctx.chainHitsBefore / 2); extraStacks += k; notes.push(`Charge: +${k} Strengthened (${ctx.chainHitsBefore} targets hit before)`); }
  if (mods.flare) { flare = flareSets(n, sides); notes.push(`Flare: ${flare.sets} separate sets of ${flare.dice}d4`); }
  return { n, sides, type: profile.damage.type, extraStacks, notes, extraDice, flare };
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
  "magic-protection-arcana:reflect", "magic-protection-arcana:adjust", "magic-protection-arcana:dampen", "magic-protection-arcana:emplace",
  "magic-theory:empower", "magic-theory:snipe", "magic-theory:duplicate",
  "magic-heat:ignition", "magic-heat:brand", "magic-heat:flare", "magic-heat:cook",
  "magic-cold:frostbite", "magic-cold:chill", "magic-cold:freeze", "magic-cold:shatter",
  "magic-radiation:electrify", "magic-radiation:lightning-rod", "magic-radiation:charge", "magic-radiation:discharge",
  "magic-acid:melt", "magic-acid:solidify", "magic-acid:sticky", "magic-acid:catalyst"
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

/* ---- Tier 2 helpers (pure) ---- */

/** Does an effect's `when` hold? `f` = { direct, crit, living, lowDodge, heatBefore, stainMore, energyZeroBefore, energyZeroAfter }. */
export function whenMet(when, f = {}) {
  switch (when) {
    case undefined: case null: case "hit": return true;
    case "directLiving": return !!(f.direct && f.living);
    default: return !!f[when];
  }
}

/** How many Ignite/Stain stacks / Energy an effect amount works out to. `spec` = { per } (× damage dealt), { dice: [n, sides] } or { fixed }. */
export function amountSpec(spec, dealt, power, roll = (n, sides) => n * (sides + 1) / 2) {
  if (!spec) return 0;
  const p = Math.max(1, power);
  if (spec.per !== undefined) return Math.floor(spec.per * dealt);
  if (spec.fixed !== undefined) return spec.fixed * p;
  if (spec.dice) return roll(spec.dice[0] * p, spec.dice[1]);
  return 0;
}

/** Flare (Heat T4): n dice of d`sides` become `sides ÷ 4` separate sets of n d4 (so 2d12 → three 2d4s). */
export function flareSets(n, sides) {
  return { sets: Math.max(1, Math.floor(sides / 4)), dice: Math.max(1, n) };
}

/** Crushing + Acid: 1 Stain stack plus twice the difference between your attack roll and their total dodge roll (never negative). */
export const crushAcidStacks = (attack, dodge) => 1 + 2 * Math.max(0, attack - dodge);

/** Ignition (Heat T2): triples Ignite stacks on a target with none; otherwise it triggers the stacks already there. */
export function ignitionPlan(targetIgnite) {
  return targetIgnite > 0 ? { trigger: true, mult: 1 } : { trigger: false, mult: 3 };
}

/** The stain kind a Mod turns an applied stain into (Solidify: Solid Stains). */
export const stainKindFor = (kind, mods) => (kind === "stain" && mods?.solidify ? "solid" : kind);
