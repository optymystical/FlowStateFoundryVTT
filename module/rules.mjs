/**
 * Flow State core rules math.
 * Pure functions only (no Foundry globals) so they can be unit-tested outside Foundry.
 * Source of truth: "Flow State - Rules" (Ch3, Ch7, Ch8, Ch9, Ch10).
 */

export const STATS = {
  str:   { label: "Strength",     abbr: "Str",   group: "Body" },
  dex:   { label: "Dexterity",    abbr: "Dex",   group: "Body" },
  con:   { label: "Constitution", abbr: "Con",   group: "Body" },
  pon:   { label: "Ponderance",   abbr: "Pon",   group: "Mind" },
  snap:  { label: "Snappence",    abbr: "Snap",  group: "Mind" },
  will:  { label: "Willpower",    abbr: "Will",  group: "Mind" },
  reach: { label: "Reach",        abbr: "Reach", group: "Spirit" },
  grasp: { label: "Grasp",        abbr: "Grasp", group: "Spirit" },
  build: { label: "Build",        abbr: "Build", group: "Spirit" }
};

/** Ch7 Size Categories + Ch10 Terminal Velocity. physical = Strengthened(+)/Weakened(-) stacks on physical attacks. */
export const SIZES = {
  1: { maxMove: 10,  ratio: 0.25, rations: 0.25, physical: -2, melee: 1,  space: "< 1 ft³",   terminal: 1, noFallDamage: true },
  2: { maxMove: 25,  ratio: 0.33, rations: 0.5,  physical: -1, melee: 3,  space: "1–3 ft³",   terminal: 1 },
  3: { maxMove: 50,  ratio: 0.50, rations: 1,    physical: 0,  melee: 5,  space: "3–5 ft³",   terminal: 2 },
  4: { maxMove: 100, ratio: 0.67, rations: 2,    physical: 1,  melee: 10, space: "5–10 ft³",  terminal: 3 },
  5: { maxMove: 200, ratio: 0.75, rations: 4,    physical: 2,  melee: 20, space: "10–20 ft³", terminal: 4 }
};

export const DAMAGE_TYPES = {
  physical: "Physical",
  heat: "Heat",
  cold: "Cold",
  acid: "Acid",
  radiation: "Radiation",
  arcane: "Arcane",
  supernatural: "Supernatural"
};

export const SENSE_LEVELS = { none: "None", secondary: "Secondary", primary: "Primary", heightened: "Heightened" };

const clampSize = size => Math.min(5, Math.max(1, Math.round(size || 3)));

/** Ch3 Stat Bonus: +1 to every stat per 5 skill points. */
export const statBonus = sp => Math.floor(Math.max(0, sp) / 5);

/** Ch3/Ch7 Stat Minimum: 1/3 of the stat, rounded down. */
export const statMin = value => Math.floor(value / 3);

/** Ch7 Stat Checks: die size = 2 × stat. */
export const checkDie = value => Math.max(1, value * 2);

/** Ch8 Attacking: attack die size = total skill points. */
export const attackDie = sp => Math.max(1, sp);

/** Ch8 Dodging: two dice, each half total skill points (rounded down). */
export const dodgeDie = sp => Math.max(1, Math.floor(sp / 2));

/** Ch8 Health Points: (Con + Will + Build) × (Size × 3). */
export const maxHP = (con, will, build, size) => (con + will + build) * (clampSize(size) * 3);

/** Ch8 Pain Threshold: 1/4 of max HP, rounded down. */
export const painThreshold = max => Math.floor(max / 4);

/** Ch8 HP regen per 8 hr rest: Con, Will, and Build minimums combined. */
export const restHeal = (con, will, build) => statMin(con) + statMin(will) + statMin(build);

/** Ch8 Energy: max = 5 × skill points; 1 AP recovers 1/10 max (rounded down). */
export const maxEnergy = sp => sp * 5;
export const energyRecover = max => Math.floor(max / 10);

/**
 * Ch8 Movement. Full size max when Dex+Snap+Grasp ≥ ratio × total stats (incl. bonuses).
 * Below that it scales linearly, rounded to the nearest 5 ft, minimum 10 ft (designer ruling).
 */
export function moveSpeed({ dex, snap, grasp, total }, size) {
  const s = SIZES[clampSize(size)];
  const threshold = s.ratio * total;
  const mobility = dex + snap + grasp;
  if (threshold <= 0 || mobility >= threshold) return Math.max(10, s.maxMove);
  const raw = s.maxMove * (mobility / threshold);
  return Math.max(10, Math.round(raw / 5) * 5);
}

/**
 * Dice pool formula with Advantage/Disadvantage stacks (Ch7).
 * Each stack adds one extra die; keep the best (adv) or worst (dis) `keep` dice.
 * net > 0 = advantage stacks, net < 0 = disadvantage stacks.
 */
export function poolFormula(keep, size, net = 0) {
  const extra = Math.abs(Math.trunc(net));
  if (!extra) return `${keep}d${size}`;
  return `${keep + extra}d${size}${net > 0 ? "kh" : "kl"}${keep}`;
}

/** Ch8 Strengthened/Weakened multiplier from net stacks. Str is additive +50%, Weak is multiplicative ×0.5. */
export const stackMultiplier = net => (net >= 0 ? 1 + 0.5 * net : Math.pow(0.5, -net));

/** Apply net Strengthened/Weakened stacks to a value, rounding down with no minimum. */
export const applyStacks = (value, net) => Math.floor(value * stackMultiplier(net));

/**
 * Ch8 Attack vs Dodge.
 * Hit if attack ≥ dodge. Crit if attack ≥ 2 × dodge (2 Strengthened stacks).
 */
export function resolveAttack(attack, dodge) {
  const hit = attack >= dodge;
  const crit = hit && attack >= dodge * 2;
  return { hit, crit, doubleCrit: false, critStacks: crit ? 2 : 0, outcome: crit ? "Critical Hit" : hit ? "Hit" : "Miss" };
}

/**
 * Ch8 Sneak Attack from full stealth: no dodge; auto hit.
 * Crit if attack ≥ target's dodge die size; double crit (4 stacks) if ≥ 2× that.
 */
export function resolveFullStealth(attack, targetDodgeDie) {
  const doubleCrit = attack >= targetDodgeDie * 2;
  const crit = attack >= targetDodgeDie;
  const critStacks = doubleCrit ? 4 : crit ? 2 : 0;
  return { hit: true, crit, doubleCrit, critStacks, outcome: doubleCrit ? "Double Crit" : crit ? "Critical Hit" : "Hit" };
}

/**
 * Ch10 Force resolution. Returns feet pushed.
 * 1) subtract Lift; 2) subtract half Max HP unless falling via Gravity; 3) divide by 10, rounded down.
 */
export function resolveForce(force, { lift = 0, maxHp = 0, falling = false } = {}) {
  let remaining = force - Math.max(0, lift);
  if (remaining <= 0) return 0;
  if (!falling) remaining -= Math.floor(maxHp / 2);
  if (remaining <= 0) return 0;
  return Math.floor(remaining / 10);
}

/** Ch10 Force Damage: 3 × untraveled feet (partial feet are dropped, so it rounds down). */
/** Non-Archetypal object materials (Rules, Ch10): Durability and Limit are the Body times these, rounded down. */
export const OBJECT_DENSITY = {
  powder: { label: "Powder / Liquid", durability: 1, limit: 1 }, soft: { label: "Soft", durability: 2, limit: 0.25 }, hard: { label: "Hard", durability: 4, limit: 0.5 },
  dense: { label: "Dense", durability: 8, limit: 1 }, superdense: { label: "Super Dense", durability: 16, limit: 2 }
};
export const objectStats = (body, density = "soft") => {
  const d = OBJECT_DENSITY[density] ?? OBJECT_DENSITY.soft, b = Math.max(0, Math.floor(body) || 0);
  return { body: b, durability: Math.floor(b * d.durability), limit: Math.floor(b * d.limit) };
};
/** Attacking an object: it always hits; the attack roll only decides a crit, at or above its Body (Grade × 10 with no Body). */
export const objectCrit = (roll, body, grade = 1) => roll >= (body > 0 ? body : Math.max(1, grade) * 10);
/** Terminal Velocity: how many rounds of falling it takes a creature of this Size to stop accelerating (Size 1 also takes no fall damage). */
export const TERMINAL_ROUNDS = { 1: 1, 2: 1, 3: 2, 4: 3, 5: 4 };
/** The downward Gravity Force after `rounds` of falling: Max HP × the world's gravity (G) for each round, up to Terminal Velocity. */
export const gravityForce = ({ gravity = 1, maxHp = 0, rounds = 1, size = 3 }) => Math.floor(Math.max(0, gravity) * Math.max(0, maxHp) * Math.min(Math.max(1, rounds), TERMINAL_ROUNDS[size] ?? 2));
/** Feet fallen from a Gravity Force: Lift comes off first, then it's divided by 10 (no half-Max-HP step when falling via Gravity). */
export const fallFeet = (force, lift = 0) => Math.max(0, Math.floor((force - Math.max(0, lift)) / 10));
/** What a creature's Lift does against its current Gravity Force: "full" (no gravity while stabilized), "slow" (10 ft a round, no fall damage), or "none". */
export const liftBand = (lift, gForce) => (lift >= gForce && gForce > 0 ? "full" : lift * 2 >= gForce && lift > 0 ? "slow" : "none");
export const forceDamage = untraveledFeet => 3 * Math.floor(Math.max(0, untraveledFeet));

/** Ch8 Pushing: force = 5 × Strength. */
export const pushForce = str => 5 * str;

/**
 * Ch9 Slow/Haste tempo. Stacks cancel each other; ≥ ½ Pain Threshold = ±1 AP, ≥ Pain Threshold = ±2 AP.
 * Returns the AP change to movement cost (+ slower, − faster).
 */
export function tempoModifier(slow, haste, pain) {
  const net = slow - haste;
  const stacks = Math.abs(net);
  if (stacks === 0) return 0;
  const steps = stacks >= pain ? 2 : stacks >= pain / 2 ? 1 : 0;
  return net > 0 ? steps : -steps;
}

/**
 * Movement cost in AP (Ch8 Movement/Terrain, Ch9 Crouch/Prone/Stealth/Slow/Haste).
 * Posture/stealth terrain penalties act as rough (+1) or difficult (+2) and don't stack with each other.
 * If haste pushes the cost below 1 AP, you instead move multiple increments for 1 AP.
 */
export function movementCost({ prone = false, crouch = false, stealth = false, tempo = 0, base = 1 } = {}) {
  const terrain = prone ? 2 : crouch || stealth ? 1 : 0;
  const cost = base + terrain + tempo;
  if (cost >= 1) return { ap: cost, multiplier: 1 };
  return { ap: 1, multiplier: 1 + (1 - cost) };
}

/** Everything derivable from base stats, skill points, and size. */
export function deriveCharacter({ stats, skillPoints, size, hpLost = 0 }) {
  const bonus = statBonus(skillPoints);
  const effective = {};
  let total = 0;
  for (const key of Object.keys(STATS)) {
    const value = (stats[key] ?? 0) + bonus;
    effective[key] = { base: stats[key] ?? 0, value, die: checkDie(value), min: statMin(value) };
    total += value;
  }
  const e = k => effective[k].value;
  const hpMax = maxHP(e("con"), e("will"), e("build"), size) - Math.max(0, hpLost);
  return {
    bonus,
    effective,
    totalStats: total,
    hpMax,
    pain: painThreshold(hpMax),
    restHeal: restHeal(e("con"), e("will"), e("build")),
    energyMax: maxEnergy(skillPoints),
    energyRecover: energyRecover(maxEnergy(skillPoints)),
    attackDie: attackDie(skillPoints),
    dodgeDie: dodgeDie(skillPoints),
    move: moveSpeed({ dex: e("dex"), snap: e("snap"), grasp: e("grasp"), total }, size),
    size: SIZES[clampSize(size)]
  };
}

/* -------------------------------------------- */
/*  Ignite and the Stain variants               */
/* -------------------------------------------- */

/** Stain variants: normal, Solid (6 AP to remove, separately), Searing (Ignite + Stain), Frozen (6 AP, drains Energy), Electric (can't be removed). */
export const STAIN_VARIANTS = {
  stain: { label: "Stain", ap: 3 }, solid: { label: "Solid Stain", ap: 6 }, searing: { label: "Searing Stain", ap: 3 },
  frozen: { label: "Frozen Stain", ap: 6 }, electric: { label: "Electric Stain", ap: null }
};
const SPECIAL_STAINS = ["searing", "frozen", "electric"];
export const CONDITION_KEYS = ["ignite", ...Object.keys(STAIN_VARIANTS)];

/** Ignite counts Searing Stains too ("both Ignite and Stain stacks for all purposes"). */
export const igniteTotal = c => (c?.ignite ?? 0) + (c?.searing ?? 0);
/** Every kind of Stain stack. */
export const stainTotal = c => Object.keys(STAIN_VARIANTS).reduce((n, k) => n + (c?.[k] ?? 0), 0);

/**
 * The conditions after adding stacks (a flat { key: value } update). Searing, Frozen and Electric Stains override the other Stain types.
 * `c` = current { ignite, stain, solid, searing, frozen, electric }.
 */
export function addStacks(c, kind, n) {
  const out = {};
  const amount = Math.max(0, Math.floor(n));
  if (!amount) return out;
  if (kind === "ignite") return { ignite: (c?.ignite ?? 0) + amount };
  if (SPECIAL_STAINS.includes(kind)) {
    for (const k of Object.keys(STAIN_VARIANTS)) out[k] = k === kind ? (c?.[k] ?? 0) + amount : 0;
    return out;
  }
  return { [kind]: (c?.[kind] ?? 0) + amount };
}

/** Freeze every Stain the creature has into Frozen Stains (Cold + Acid), adding `extra` new stacks. */
export function freezeStains(c, extra = 0) {
  const total = stainTotal(c) + Math.max(0, Math.floor(extra));
  return Object.fromEntries(Object.keys(STAIN_VARIANTS).map(k => [k, k === "frozen" ? total : 0]));
}

/** Damage and Energy loss from a set of conditions at the end of the creature's turn. */
export function tickAmounts(c) {
  return {
    heat: (c?.ignite ?? 0) + (c?.searing ?? 0),
    acid: (c?.stain ?? 0) + (c?.solid ?? 0) + (c?.searing ?? 0) + (c?.frozen ?? 0),
    radiation: c?.electric ?? 0,
    energy: c?.frozen ?? 0
  };
}
