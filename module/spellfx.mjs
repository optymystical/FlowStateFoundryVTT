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

/**
 * Tier 3 (Venomancy, Charm, Witchery) profiles. They deal no damage on the hit itself; `afflict` describes what lingers on the target
 * (see afflictions.mjs). Dice counts scale with Spell Power.
 *   poison  { dice, type: "health" or a damage type, bypassArmor, force, livingDie, halfStrength, dodgeDie, ignite|stain|energy: true, arc: true }
 *   charm   { combo?: { dice, type, force, ignite|stain|energy, nextRoll, zap, critStrength } }
 *   hex     { dice: [1, 12], extra?: { force|ignite|stain|energy: [n, sides], dieDown: true, arcs: 2 } }
 *   venomCharm / venomHex / charmHex   the pure Tier 3 Combos: a combined check, then a lingering damage-over-time effect
 */
const PO = "magic-venomancy:poison", CM = "magic-charm:charm", HX = "magic-witchery:hex";
Object.assign(PROFILES, {
  [PO]: { name: "Poison", afflict: { kind: "poison", dice: [3, 6], type: "health" } },
  [CM]: { name: "Charm", afflict: { kind: "charm" } },
  [HX]: { name: "Hex", afflict: { kind: "hex", dice: [1, 12], type: "arcane" } },
  // Tier 1/2 + Venomancy: Poison's health loss becomes damage that ignores armor (but not Shrouds).
  [profileKey([G, PO])]: { name: "Force + Poison", afflict: { kind: "poison", dice: [24, 10], type: "force", force: true } },
  [profileKey([SL, PO])]: { name: "Cut + Poison", afflict: { kind: "poison", dice: [6, 6], type: "physical", bypassArmor: true, livingDie: 4 } },
  [profileKey([PI, PO])]: { name: "Stab + Poison", afflict: { kind: "poison", dice: [3, 10], type: "physical", bypassArmor: true, halfStrength: true } },
  [profileKey([CR, PO])]: { name: "Slam + Poison", afflict: { kind: "poison", dice: [3, 12], type: "physical", bypassArmor: true, dodgeDie: 3 } },
  [profileKey([FL, PO])]: { name: "Flame + Poison", afflict: { kind: "poison", dice: [3, 12], type: "heat", bypassArmor: true, ignite: true } },
  [profileKey([FR, PO])]: { name: "Frost + Poison", afflict: { kind: "poison", dice: [3, 8], type: "cold", bypassArmor: true, energy: true } },
  [profileKey([CK, PO])]: { name: "Crackle + Poison", afflict: { kind: "poison", dice: [3, 12], type: "radiation", bypassArmor: true, arc: true } },
  [profileKey([GL, PO])]: { name: "Glob + Poison", afflict: { kind: "poison", dice: [3, 8], type: "acid", bypassArmor: true, stain: true } },
  // + Charm: the failed Willpower check (at the start of their next turn) makes them hurt themselves.
  [profileKey([G, CM])]: { name: "Force + Charm", afflict: { kind: "charm", combo: { dice: [28, 10], type: "force", force: true } } },
  [profileKey([SL, CM])]: { name: "Cut + Charm", afflict: { kind: "charm", combo: { dice: [8, 6], type: "physical" } } },
  [profileKey([PI, CM])]: { name: "Stab + Charm", afflict: { kind: "charm", combo: { dice: [4, 10], type: "physical", critStrength: true } } },
  [profileKey([CR, CM])]: { name: "Slam + Charm", afflict: { kind: "charm", combo: { dice: [4, 12], type: "physical", nextRoll: true } } },
  [profileKey([FL, CM])]: { name: "Flame + Charm", afflict: { kind: "charm", combo: { dice: [4, 12], type: "heat", ignite: true } } },
  [profileKey([FR, CM])]: { name: "Frost + Charm", afflict: { kind: "charm", combo: { dice: [4, 8], type: "cold", energy: true } } },
  [profileKey([CK, CM])]: { name: "Crackle + Charm", afflict: { kind: "charm", combo: { dice: [4, 12], type: "radiation", zap: true } } },
  [profileKey([GL, CM])]: { name: "Glob + Charm", afflict: { kind: "charm", combo: { dice: [4, 8], type: "acid", stain: true } } },
  // + Witchery: Hex does something extra whenever it procs.
  [profileKey([G, HX])]: { name: "Force + Hex", afflict: { kind: "hex", dice: [1, 12], type: "arcane", extra: { force: [20, 10] } } },
  [profileKey([CR, HX])]: { name: "Slam + Hex", afflict: { kind: "hex", dice: [1, 12], type: "arcane", extra: { dieDown: true } } },
  [profileKey([FL, HX])]: { name: "Flame + Hex", afflict: { kind: "hex", dice: [1, 12], type: "arcane", extra: { ignite: [4, 12] } } },
  [profileKey([FR, HX])]: { name: "Frost + Hex", afflict: { kind: "hex", dice: [1, 12], type: "arcane", extra: { energy: [4, 8] } } },
  [profileKey([CK, HX])]: { name: "Crackle + Hex", afflict: { kind: "hex", dice: [1, 12], type: "arcane", extra: { arcs: 2 } } },
  [profileKey([GL, HX])]: { name: "Glob + Hex", afflict: { kind: "hex", dice: [1, 12], type: "arcane", extra: { stain: [4, 8] } } },
  // Pure Tier 3
  [profileKey([PO, CM])]: { name: "Poison + Charm", afflict: { kind: "venomCharm", dice: [2, 6], type: "health", combined: ["con", "will"], req: 5 } },
  [profileKey([PO, HX])]: { name: "Poison + Hex", afflict: { kind: "venomHex", dice: [1, 10], type: "health", combined: ["con", "build"], req: 5 } },
  [profileKey([CM, HX])]: { name: "Charm + Hex", afflict: { kind: "charmHex", dice: [1, 8], type: "arcane", combined: ["will", "build"], req: 5 } }
});

/**
 * Tier 4 (Summoning, Creation, Animation) profiles. `conjure` says what the cast makes (see conjure.mjs): a Summon, a Made object, an Animation.
 * Combos with a Tier 1/2/3 Core add that Core's effect to the creation's attacks (`rider`); the pure Tier 4 Combos mix the rules.
 */
const SU = "magic-summoning:form", MK = "magic-creation:make", AN = "magic-animation:animate";
Object.assign(PROFILES, {
  [SU]: { name: "Form", conjure: { kind: "summon" } },
  [MK]: { name: "Make", conjure: { kind: "make" } },
  [AN]: { name: "Animate", conjure: { kind: "animate" } },
  [profileKey([SU, MK])]: { name: "Form + Make", conjure: { kind: "summon", make: true } },
  [profileKey([SU, AN])]: { name: "Form + Animate", conjure: { kind: "animate", summonStats: true } },
  [profileKey([MK, AN])]: { name: "Make + Animate", conjure: { kind: "animate", instant: true } }
});
for (const core of ["magic-gravity:force", "magic-slashing:cut", "magic-piercing:stab", "magic-crushing:slam", "magic-heat:flame", "magic-cold:frost", "magic-radiation:crackle", "magic-acid:glob",
  "magic-venomancy:poison", "magic-charm:charm", "magic-witchery:hex"]) {
  const short = core.split(":")[1][0].toUpperCase() + core.split(":")[1].slice(1);
  for (const [t4, kind, label] of [[SU, "summon", "Form"], [MK, "make", "Make"], [AN, "animate", "Animate"]])
    PROFILES[profileKey([core, t4])] = { name: `${short} + ${label}`, conjure: { kind, rider: core } };
}

/** Roll types a Charm / Hex can be tied to. */
export const ROLL_TYPES = { attack: "Attack", damage: "Damage", dodge: "Dodge", stat: "Stat check", noncombat: "Non-combat (d100)" };

/** Hex triggers and the Strengthened (+) / Weakened (−) stacks they put on the Hex's damage. */
export const HEX_TRIGGERS = {
  harm: { label: "Harm: takes damage from a non-Hex source", stacks: -2 },
  move: { label: "Move: spends AP to move", stacks: -1 },
  failsuccess: { label: "Fail/Success: fails or succeeds on a roll", stacks: 0 },
  roll: { label: "Roll: makes a specified roll", stacks: 1 },
  act: { label: "Act: performs a declared action", stacks: 2 },
  word: { label: "Word/Condition: speaks a word or enters a condition", stacks: 3 }
};

/** Poison's die size after `procs` applications: each Lethality adds 50% of the base size (rounded down) per application. */
export const poisonSides = (base, lethality = 0, procs = 0) => base + Math.floor(base * 0.5) * Math.max(0, lethality) * Math.max(0, procs);
/** Hex's die size after `procs` triggers: Fester adds 6 each time. */
export const hexSides = (base, fester = 0, procs = 0) => base + 6 * Math.max(0, fester) * Math.max(0, procs);
/** Charm's check requirement after `times` Ingrained repeats (halved and rounded down each time). */
export const charmRequirement = (req, times = 0) => { let r = req; for (let i = 0; i < times; i++) r = Math.floor(r / 2); return r; };
/** Is a check roll "half or lower" / "less than half" of what was needed? */
export const halfOrLower = (roll, req) => roll * 2 <= req;
export const lessThanHalf = (roll, req) => roll * 2 < req;
/** How many Poison applications a Prolong'd Poison has before it ends (a failed check each), and when it ends. Ritual Poison ends only on a pass. */
export function poisonEnds({ passed, procs, prolong = 0, ritual = false }) {
  if (ritual) return passed;
  if (!prolong) return true;
  return passed || procs >= 1 + prolong;
}
/** Propagandize doubles a Charm that has two other Charms of yours on the target. */
export const charmAmount = (propagandize, otherCharms) => (propagandize && otherCharms >= 2 ? 2 : 1);
/** The effect the dialog's Charm/Hex choices need for this Core pair: { charm, hex, hexDie }. */
export function afflictNeeds(profile) {
  const k = profile?.afflict?.kind, rider = profile?.conjure?.rider;
  return { charm: (k === "charm" && !profile.afflict.combo) || k === "venomCharm" || rider === "magic-charm:charm", hex: k === "hex" || k === "venomHex" || k === "charmHex" || rider === "magic-witchery:hex", hexDie: !!profile?.afflict?.extra?.dieDown };
}

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
  "magic-reach-arcana:multicast", "magic-reach-arcana:lob", "magic-reach-arcana:mold", "magic-reach-arcana:explode",
  "magic-heat:ignition", "magic-heat:brand", "magic-heat:flare", "magic-heat:cook",
  "magic-cold:frostbite", "magic-cold:chill", "magic-cold:freeze", "magic-cold:shatter",
  "magic-radiation:electrify", "magic-radiation:lightning-rod", "magic-radiation:charge", "magic-radiation:discharge",
  "magic-acid:melt", "magic-acid:solidify", "magic-acid:sticky", "magic-acid:catalyst",
  "magic-grasp-arcana:foresight", "magic-grasp-arcana:replicate", "magic-grasp-arcana:instant-ritual",
  "magic-venomancy:prolong", "magic-venomancy:lethality", "magic-venomancy:potency", "magic-venomancy:virality",
  "magic-charm:ingrained", "magic-charm:convince", "magic-charm:cloud", "magic-charm:propagandize",
  "magic-witchery:linger", "magic-witchery:fester", "magic-witchery:unravel", "magic-witchery:consume",
  "magic-build-arcana:layered", "magic-build-arcana:reform", "magic-build-arcana:projection",
  "magic-summoning:arm", "magic-summoning:skin", "magic-creation:armory", "magic-creation:make-mk2", "magic-creation:make-mk3", "magic-creation:complexity",
  "magic-animation:weapon-foci", "magic-animation:armor-shroud", "magic-animation:expanded-animation", "magic-animation:mixed-animations"
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
  for (const a of applied) { const k = (a.replicatesName ?? a.mod.name).toLowerCase(); out[k] = (out[k] ?? 0) + 1; }
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
