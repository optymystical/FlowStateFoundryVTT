/**
 * Martial weapon-tree abilities: who can use them, with which weapon, and what they cost.
 * Kept free of Foundry globals so the rules can be unit-tested.
 */
import * as skills from "./skills.mjs";

export const BLADED = "martial-bladed-weapons";

/** Tier the actor has in a tree. */
export const treeTier = (actor, id) => skills.tierOf(actor?.system?.trees, id);

/** Scaling Stat min for a weapon: a third of the Grade-capped Scaling Stat, rounded down. */
export const scalingMin = item => Math.floor((item?.system?.profile?.capped ?? 0) / 3);

/**
 * Can this weapon use this weapon tree's abilities? Its main type does; a multi-type weapon's other types count too
 * with Weapon Master (Martial Theory T5): "while held, their normal and defensive abilities for each type are always available".
 */
export function weaponFits(actor, item, treeId) {
  const type = item?.system?.weaponType;
  if (!type || item.type !== "weapon") return false;
  return skills.canUseWeaponSkill(actor?.system?.trees, treeId, item.system.types ?? [type]);
}

/** The weapon types this actor can attack with using this weapon (all of them with Weapon Master, else the main one). */
export function attackTypes(actor, item) {
  const types = item?.system?.types ?? [item?.system?.weaponType];
  return treeTier(actor, "martial-theory") >= 5 ? types : types.slice(0, 1);
}

/**
 * A Bladed Weapons ability of this tier can be used with this weapon.
 * @param {string|null} weight  "light"/"heavy" for abilities marked (Light)/(Heavy)
 */
export function bladed(actor, item, tier, weight = null) {
  return treeTier(actor, BLADED) >= tier && weaponFits(actor, item, BLADED)
    && (!weight || item.system.weight === weight);
}

/** Held weapons that can use a Bladed ability of this tier. */
export const bladedHeld = (actor, tier, weight = null) =>
  (actor?.items ?? []).filter(i => i.type === "weapon" && i.system.held && !i.system.broken && i.system.profile?.valid && bladed(actor, i, tier, weight));

/** Energy costs (Bladed Weapons tree). */
export const BLADED_COST = {
  whirlwind: item => scalingMin(item),                       // T1, Scaling Stat min (×2 with Blender)
  remise: item => scalingMin(item),                          // T1, Scaling Stat min
  closeQuarters: item => Math.floor(scalingMin(item) / 2),   // T2, half Scaling Stat min
  perfectRiposte: item => 2 * scalingMin(item)               // T5, double Scaling Stat min
};

/**
 * The Fast value a weapon gives a follow-up (0 none, 1 Fast, 2 Fast+).
 * Blender (Bladed T3, Light): Light Bladed weapons benefit from Fast+.
 */
export function fastValue(actor, item, unarmedLightFast = 0) {
  if (item.system.weaponType === "unarmed") return unarmedLightFast;
  let v = item.system.profile?.valid ? item.system.profile.fast : 0;
  if (bladed(actor, item, 3, "light")) v = 2;
  // Berserk (Striker T2): Light Striker attacks get Fast (Fast+ with Seeing Red, T4).
  if (actor?.statuses?.has?.("berserk") && striker(actor, item, 2, "light")) v = Math.max(v, actor.statuses.has("seeingRed") ? 2 : 1);
  return v;
}

/** Solitary value for an attack with this weapon after tree effects (Berserk, Proper Stance). */
export function solitaryValue(actor, item, p) {
  let v = p.solitary ?? 0;
  if (actor?.statuses?.has?.("berserk") && striker(actor, item, 2, "heavy")) v = Math.max(v, actor.statuses.has("seeingRed") ? 2 : 1);
  if (actor?.statuses?.has?.("properStance") && assault(actor, item, 5)) v = 2;
  return v;
}

/**
 * Solitary follow-up for an attack, or null.
 * - Normal: one-handed Solitary weapon (Solitary+ = no Disadvantage).
 * - Titan Weapon (Bladed T4, Heavy): two-handed attacks benefit from Solitary+, but the extra attack has Disadvantage.
 */
export function solitaryFollowup(actor, item, p) {
  const sol = solitaryValue(actor, item, p);
  if (p.hands === 1 && sol) return { net: sol === 2 ? 0 : -1, titan: false };
  if (p.hands === 2 && bladed(actor, item, 4, "heavy")) return { net: -1, titan: true };
  return null;
}

/* -------------------------------------------- */
/*  Brawling Methods (Unarmed)                  */
/* -------------------------------------------- */

export const BRAWLING = "martial-brawling-methods";

/** Brawling Methods tier reached. */
export const brawl = (actor, tier) => treeTier(actor, BRAWLING) >= tier;

const dexMin = a => a?.system?.derived?.effective?.dex?.min ?? 0;
const strMin = a => a?.system?.derived?.effective?.str?.min ?? 0;

/** The actor's Unarmed item if at least one fist is raised. */
/** Creatures this actor holds in an Unarmed grapple (weapon grapples such as Thrasher/Impale don't use a hand). */
export function handGrapples(actor) {
  if (!actor?.uuid) return [];
  const pool = new Map();
  for (const a of globalThis.game?.actors ?? []) pool.set(a.uuid, a);
  for (const t of globalThis.canvas?.tokens?.placeables ?? []) if (t.actor) pool.set(t.actor.uuid, t.actor);
  // Only a creature holding someone with its hands counts: a weapon grapple and a magical hold (a spell, a Manifest like Sink) don't take a hand.
  const magical = a => Array.from(a.effects ?? []).some(e => !e.disabled && e.flags?.flowstate?.spellEffect?.kind === "hold" && e.flags.flowstate.spellEffect.caster === actor.uuid);
  return [...pool.values()].filter(a => a.getFlag?.("flowstate", "grappledBy") === actor.uuid && !a.getFlag?.("flowstate", "grappleWeapon") && !magical(a));
}

/** Fists that are up and not holding a grapple (each Unarmed grapple occupies one hand). */
export function freeFists(actor) {
  const fist = (actor?.items ?? []).find(i => i.type === "weapon" && i.system.weaponType === "unarmed");
  if (!fist) return 0;
  const up = (fist.system.equipped ? 1 : 0) + (fist.system.secondHand ? 1 : 0);
  return Math.max(0, up - handGrapples(actor).length);
}

export const fists = actor => freeFists(actor) > 0
  ? (actor?.items ?? []).find(i => i.type === "weapon" && i.system.weaponType === "unarmed") ?? null : null;

/** Energy costs (Brawling Methods tree). Unarmed has no Grade cap, so these use the full stat minimums. */
export const BRAWLING_COST = {
  twinFang: a => dexMin(a),                     // T1 Light
  jab: a => strMin(a),                          // T1 Heavy
  combo: a => 2 * dexMin(a),                    // T3 Light
  dragonLash: a => 2 * strMin(a),               // T3 Heavy
  redirect: a => dexMin(a),                     // T4 Light
  kickOut: a => strMin(a),                      // T4 Heavy
  flow: (a, weight) => 2 * (weight === "heavy" ? strMin(a) : dexMin(a))  // T5, Scaling Stat min of the new attack
};

/* -------------------------------------------- */
/*  Balanced Weapons                            */
/* -------------------------------------------- */

export const BALANCED = "martial-balanced-weapons";

/** A Balanced Weapons ability of this tier can be used with this weapon ("light"/"heavy" for Slice/Slam). */
export function balanced(actor, item, tier, weight = null) {
  return treeTier(actor, BALANCED) >= tier && weaponFits(actor, item, BALANCED)
    && (!weight || item.system.weight === weight);
}

/** Held weapons that can use a Balanced ability of this tier. */
export const balancedHeld = (actor, tier, weight = null) =>
  (actor?.items ?? []).filter(i => i.type === "weapon" && i.system.held && !i.system.broken && i.system.profile?.valid && balanced(actor, i, tier, weight));

/** Energy costs (Balanced Weapons tree). Slice/Slam cost double for both effects (One with your Weapon, T5). */
export const BALANCED_COST = {
  spinCycle: item => scalingMin(item),                 // T2
  slice: item => scalingMin(item),                     // T3 Light
  slam: item => scalingMin(item)                       // T3 Heavy
};

/* -------------------------------------------- */
/*  Swift Weapons                               */
/* -------------------------------------------- */

export const SWIFT = "martial-swift-weapons";

/** A Swift Weapons ability of this tier can be used with this weapon. */
export const swift = (actor, item, tier) => treeTier(actor, SWIFT) >= tier && weaponFits(actor, item, SWIFT);

/** Held weapons that can use a Swift ability of this tier. */
export const swiftHeld = (actor, tier) =>
  (actor?.items ?? []).filter(i => i.type === "weapon" && i.system.held && !i.system.broken && i.system.profile?.valid && swift(actor, i, tier));

/** Is this a Swift Weapon attack (for tracking Eviscerate and Delta)? A weapon with the Swift type (all types with Weapon Master). */
export const isSwiftAttack = (actor, item) => !!item && weaponFits(actor, item, SWIFT);

/** Energy costs (Swift Weapons tree). */
export const SWIFT_COST = {
  quickStrike: item => Math.floor(scalingMin(item) / 2), // T2
  bladeFlurry: item => scalingMin(item),                // T3
  eviscerate: item => 2 * scalingMin(item)              // T4
};

/* -------------------------------------------- */
/*  Medium Armor                                */
/* -------------------------------------------- */

export const MEDIUM = "martial-medium-armor";

/** Wearing Medium armor (its real weight; Gray Iron's heavier penalties don't change what it is). */
export const wearingMedium = actor => actor?.system?.armor?.system?.weight === "medium";

/** A Medium Armor ability of this tier is usable right now (tier reached and wearing Medium armor). */
export const medium = (actor, tier) => treeTier(actor, MEDIUM) >= tier && wearingMedium(actor);

const conMin = a => a?.system?.derived?.effective?.con?.min ?? 0;
const conStat = a => a?.system?.derived?.effective?.con?.value ?? 0;

/** Energy costs (Medium Armor tree). Versatility (T5) makes the chosen one free until your next turn. */
export const MEDIUM_COST_BASE = {
  limber: a => Math.floor(conMin(a) / 4),   // T1
  // T2 Brace is a Parry on the armor: Energy = CON (capped by the armor's Grade × 10).
  brace: a => Math.min(conStat(a), Math.max(1, a?.system?.armor?.system?.grade ?? 1) * 10),
  shift: a => Math.floor(conMin(a) / 2)     // T4
};
export function mediumCost(actor, ability) {
  const v = actor?.getFlag?.("flowstate", "versatility");
  if (v === ability && medium(actor, 5)) return 0;
  return MEDIUM_COST_BASE[ability](actor);
}
/** Brace reduces the damage by your Constitution stat. */
export const braceReduction = actor => conStat(actor);

/* -------------------------------------------- */
/*  Rapid Weapons                               */
/* -------------------------------------------- */

export const RAPID = "martial-rapid-weapons";

/** A Rapid Weapons ability of this tier can be used with this weapon. */
export const rapid = (actor, item, tier) => treeTier(actor, RAPID) >= tier && weaponFits(actor, item, RAPID);

/** Held weapons that can use a Rapid ability of this tier. */
export const rapidHeld = (actor, tier) =>
  (actor?.items ?? []).filter(i => i.type === "weapon" && i.system.held && !i.system.broken && i.system.profile?.valid && rapid(actor, i, tier));

/** Energy costs (Rapid Weapons tree). */
export const RAPID_COST = {
  spinDown: item => scalingMin(item),                    // T2
  mark: item => scalingMin(item),                        // T3
  speedloader: item => Math.floor(scalingMin(item) / 4)  // T5
};

/* -------------------------------------------- */
/*  Shared helpers for the later trees          */
/* -------------------------------------------- */

/** Weapon-tree helpers: `can(actor, item, tier, weight)` and `held(actor, tier, weight)`. */
function weaponTree(id) {
  const can = (actor, item, tier, weight = null) => treeTier(actor, id) >= tier && weaponFits(actor, item, id)
    && (!weight || item.system.weight === weight);
  const held = (actor, tier, weight = null) => (actor?.items ?? []).filter(i => i.type === "weapon" && i.system.held
    && !i.system.broken && i.system.profile?.valid && can(actor, i, tier, weight));
  return { id, can, held };
}

const eff = (a, k) => a?.system?.derived?.effective?.[k] ?? { value: 0, min: 0 };
export const statValue = (a, k) => eff(a, k).value ?? 0;
export const statMinOf = (a, k) => eff(a, k).min ?? 0;

/** The weight of the armor this actor is wearing ("light"/"medium"/"heavy"/"titanic"), or null. */
export const wornWeight = actor => actor?.system?.armor?.system?.weight ?? null;
/** Wearing no armor at all (Unarmored). */
export const unarmored = actor => !(actor?.items ?? []).some(i => i.type === "armor" && i.system.equipped);

/* -------------------------------------------- */
/*  Strength Methods                            */
/* -------------------------------------------- */

export const STRENGTH = "martial-strength-methods";
export const strength = (actor, tier) => treeTier(actor, STRENGTH) >= tier;
export const STRENGTH_COST = {
  heave: a => statValue(a, "str"),        // T2, STR stat
  crunchTime: a => statMinOf(a, "str"),   // T3, STR min
  ho: a => statMinOf(a, "str"),           // T4, STR min (per step)
  unstoppable: a => 2 * statMinOf(a, "str") // T5
};

/**
 * Intimidate (Strength T1) / Fast Lips (Dexterity T1): compare a stat against a target's, scaled by size.
 * Each size the target is larger doubles what you need; each size smaller halves it.
 * Returns true if `mine` beats the target's (scaled) stat.
 */
export function beatsScaled(mine, theirs, mySize, theirSize, { larger = "target" } = {}) {
  const diff = (theirSize ?? 3) - (mySize ?? 3);
  // Intimidate: bigger targets need more Strength. Fast Lips: smaller targets need more Dexterity.
  const steps = larger === "target" ? diff : -diff;
  const need = theirs * Math.pow(2, steps);
  return mine > need;
}

/* -------------------------------------------- */
/*  Striker Weapons                             */
/* -------------------------------------------- */

export const STRIKER = "martial-striker-weapons";
const strikerT = weaponTree(STRIKER);
export const striker = strikerT.can;
export const strikerHeld = strikerT.held;
export const STRIKER_COST = {
  rend: item => Math.floor(scalingMin(item) / 2),  // T1
  berserk: item => scalingMin(item),               // T2 (and to maintain it)
  seeingRed: item => scalingMin(item)              // T4
};

/* -------------------------------------------- */
/*  Defender Weapons                            */
/* -------------------------------------------- */

export const DEFENDER = "martial-defender-weapons";
const defenderT = weaponTree(DEFENDER);
export const defender = defenderT.can;
export const defenderHeld = defenderT.held;
export const DEFENDER_COST = {
  shieldToss: item => Math.floor(scalingMin(item) / 2),  // T2
  swordAndBoard: item => scalingMin(item)                // T3
};

/* -------------------------------------------- */
/*  Weighted Weapons                            */
/* -------------------------------------------- */

export const WEIGHTED = "martial-weighted-weapons";
const weightedT = weaponTree(WEIGHTED);
export const weighted = weightedT.can;
export const WEIGHTED_COST = {
  swing: item => scalingMin(item),                 // T1 Controlled (Light) / Wild (Heavy)
  spin: item => scalingMin(item),                  // T2
  smash: item => Math.floor(scalingMin(item) / 2)  // T4
};

/* -------------------------------------------- */
/*  Assault Weapons                             */
/* -------------------------------------------- */

export const ASSAULT = "martial-assault-weapons";
const assaultT = weaponTree(ASSAULT);
export const assault = assaultT.can;
export const assaultHeld = assaultT.held;
export const ASSAULT_COST = {
  takeAim: item => scalingMin(item),                         // T2
  distractingFire: item => Math.floor(scalingMin(item) / 2), // T3
  properStance: item => 2 * scalingMin(item)                 // T5
};

/* -------------------------------------------- */
/*  Heavy & Titanic Armor (Brace, Harden, Trudge, Bodyslam)  */
/* -------------------------------------------- */

export const HEAVY = "martial-heavy-armor";
export const TITANIC = "martial-titanic-armor";
export const heavy = (actor, tier) => treeTier(actor, HEAVY) >= tier && wornWeight(actor) === "heavy";
export const titanic = (actor, tier) => treeTier(actor, TITANIC) >= tier && wornWeight(actor) === "titanic";

/**
 * Brace: Parry on worn armor (Medium T2, Heavy T1; Titanic T1 Giga Brace reduces by double). Turned on during your turn for
 * Energy equal to your CON (the Scaling Stat, capped by the armor's Grade × 10); Medium's Versatility makes it free.
 * Harden (Heavy T4: + CON min, Titanic T3: + ½ CON min) costs extra and also Weakens incoming attacks.
 * Returns null when Brace isn't available.
 */
export function braceInfo(actor) {
  const c = statMinOf(actor, "con");
  const grade = actor?.system?.armor?.system?.grade ?? 1;
  const scaling = Math.min(statValue(actor, "con"), Math.max(1, grade) * 10);
  const conV = statValue(actor, "con");
  if (medium(actor, 2)) return { tree: "Medium Armor", name: "Brace", cost: mediumCost(actor, "brace"), reduce: conV, harden: null };
  if (heavy(actor, 1)) return { tree: "Heavy Armor", name: "Brace", cost: scaling, reduce: conV, harden: heavy(actor, 4) ? c : null };
  if (titanic(actor, 1)) return { tree: "Titanic Armor", name: "Giga Brace", cost: scaling, reduce: 2 * conV, harden: titanic(actor, 3) ? Math.floor(c / 2) : null };
  return null;
}

/** Parry (Martial Theory T1) Energy for a held weapon: its Scaling Stat, capped by Grade × 10. */
export const parryCost = item => item?.system?.profile?.capped ?? 0;
/** Dip (DEX) / Shatter (STR): Parry on a free hand, paid with the full stat (Unarmed has no Grade cap). */
export const handParryCost = (actor, style) => statValue(actor, style === "dip" ? "dex" : "str");

/** Trudge: Heavy T2 (¼ CON min) or Titanic T4 (½ CON min). Null when not available. */
export function trudgeCost(actor) {
  const c = statMinOf(actor, "con");
  if (heavy(actor, 2)) return Math.floor(c / 4);
  if (titanic(actor, 4)) return Math.floor(c / 2);
  return null;
}

/** Bodyslam: Heavy T3 or Titanic T2 (with Disadvantage). Launch (Heavy T5) only in Heavy armor. */
export function bodyslamInfo(actor) {
  const cost = statMinOf(actor, "con");
  if (heavy(actor, 3)) return { cost, net: 0, launch: heavy(actor, 5) };
  if (titanic(actor, 2)) return { cost, net: -1, launch: false };
  return null;
}

/* -------------------------------------------- */
/*  Dexterity Methods                           */
/* -------------------------------------------- */

export const DEXTERITY = "martial-dexterity-methods";
export const dexterity = (actor, tier) => treeTier(actor, DEXTERITY) >= tier;
export const DEXTERITY_COST = {
  shank: a => 2 * statMinOf(a, "dex"),                       // T2
  spotWeakness: a => Math.floor(statMinOf(a, "dex") / 2),    // T4
  pinpoint: a => Math.floor(statMinOf(a, "dex") / 4)         // T5
};

/* -------------------------------------------- */
/*  Reach Weapons                               */
/* -------------------------------------------- */

export const REACH = "martial-reach-weapons";
const reachT = weaponTree(REACH);
export const reach = reachT.can;
export const reachHeld = reachT.held;
export const REACH_COST = {
  thrust: item => Math.floor(scalingMin(item) / 2),  // T2
  wall: item => Math.floor(scalingMin(item) / 2),    // T3
  twist: item => scalingMin(item),                   // T4
  impale: item => 2 * scalingMin(item)               // T5
};

/* -------------------------------------------- */
/*  Circular Weapons                            */
/* -------------------------------------------- */

export const CIRCULAR = "martial-circular-weapons";
const circularT = weaponTree(CIRCULAR);
export const circular = circularT.can;
export const CIRCULAR_COST = {
  whatGoesAround: item => scalingMin(item),              // T1
  through: item => Math.floor(scalingMin(item) / 2),     // T2 Pierce Through / Cut Through
  letItRip: item => Math.floor(scalingMin(item) / 2)     // T3
};

/* -------------------------------------------- */
/*  Blast Weapons                               */
/* -------------------------------------------- */

export const BLAST = "martial-blast-weapons";
const blastT = weaponTree(BLAST);
export const blast = blastT.can;
export const BLAST_COST = {
  coneShot: item => scalingMin(item),  // T2
  punch: item => scalingMin(item),     // T4
  execute: item => scalingMin(item)    // T5
};

/* -------------------------------------------- */
/*  Light Armor / Unarmored (Shift, Dash, Leap) */
/* -------------------------------------------- */

export const LIGHT = "martial-light-armor";
export const UNARMORED = "martial-unarmored";
export const lightArmor = (actor, tier) => treeTier(actor, LIGHT) >= tier && wornWeight(actor) === "light";
export const unarmoredT = (actor, tier) => treeTier(actor, UNARMORED) >= tier && unarmored(actor);

/** Shift for the armor being worn: Medium T4 (½ CON min, Versatility) or Light T1 (¼ CON min). Uses: 2 with Evade (Light T4). */
export function shiftInfo(actor) {
  if (medium(actor, 4)) return { tree: "Medium Armor", cost: mediumCost(actor, "shift"), uses: 1, breathing: false };
  if (lightArmor(actor, 1)) return { tree: "Light Armor", cost: Math.floor(statMinOf(actor, "con") / 4), uses: lightArmor(actor, 4) ? 2 : 1, breathing: lightArmor(actor, 5) };
  return null;
}

/** Dash: Light Armor T2 (½ CON min) or Unarmored T1 (¼ CON min, free with Speedy T3). */
export function dashInfo(actor) {
  const c = statMinOf(actor, "con");
  if (lightArmor(actor, 2)) return { tree: "Light Armor", cost: Math.floor(c / 2), breathing: lightArmor(actor, 5), reaction: false };
  if (unarmoredT(actor, 1)) return { tree: "Unarmored", cost: unarmoredT(actor, 3) ? 0 : Math.floor(c / 4), breathing: false, reaction: true };
  return null;
}

/** Leap: Light Armor T3 (½ CON min) or Unarmored T2 (¼ CON min). */
export function leapInfo(actor) {
  const c = statMinOf(actor, "con");
  if (lightArmor(actor, 3)) return { tree: "Light Armor", cost: Math.floor(c / 2), breathing: lightArmor(actor, 5) };
  if (unarmoredT(actor, 2)) return { tree: "Unarmored", cost: Math.floor(c / 4), breathing: false };
  return null;
}

/* -------------------------------------------- */
/*  Constitution Methods                        */
/* -------------------------------------------- */

/**
 * Resisting with a Martial (Body) stat check: Unstoppable (Strength T5, while it lasts: Advantage, and the stat counts twice as high) and Pure Body
 * (Constitution T3: the stat counts twice as high, or Constitution itself stands in for it if that is higher; a target number or contested result under half of the stat is an automatic success).
 * Each doubles the stat, and together they multiply (×4). `target` is the number to beat (0 = none).
 * Returns { value, die, min, net, auto, notes }.
 */
export function resistCheck(stat, { unstoppable = false, pureBody = false, target = 0, con = null } = {}) {
  const factor = (unstoppable ? 2 : 1) * (pureBody ? 2 : 1);
  const doubled = factor > 1;
  const value = stat.value * factor;
  const notes = [];
  // Pure Body: when resisting, Constitution (not doubled) can stand in for the required stat if it is higher than the stat as boosted.
  if (pureBody && con && con !== stat && con.value > value) {
    notes.push(`Pure Body: Constitution ${con.value} (not doubled) stands in for the required stat`);
    const auto = target > 0 && target < con.value / 2;
    if (auto) notes.push(`Pure Body: ${target} is less than half of ${con.value}, an automatic success`);
    return { value: con.value, die: con.die, min: con.min, net: unstoppable ? 1 : 0, auto, notes: [...(unstoppable ? ["Unstoppable: Advantage"] : []), ...notes] };
  }
  if (unstoppable) notes.push("Unstoppable: Advantage, stat counts twice");
  if (pureBody) notes.push(unstoppable ? "Pure Body: twice again (×4 with Unstoppable)" : "Pure Body: stat counts twice");
  const auto = pureBody && target > 0 && target < stat.value / 2;
  if (auto) notes.push(`Pure Body: ${target} is less than half of ${stat.value}, an automatic success`);
  return { value, die: doubled ? Math.max(1, value * 2) : stat.die, min: doubled ? Math.floor(value / 3) : stat.min, net: unstoppable ? 1 : 0, auto, notes };
}
export const BODY_STATS = new Set(["str", "dex", "con"]);

export const CONSTITUTION = "martial-constitution-methods";
export const constitution = (actor, tier) => treeTier(actor, CONSTITUTION) >= tier;
export const CONSTITUTION_COST = {
  taunt: a => statMinOf(a, "con"),      // T2 (plus 2 RP)
  pullAggro: a => statValue(a, "con")   // T4 (plus 2 RP)
};

/* -------------------------------------------- */
/*  Curved Weapons                              */
/* -------------------------------------------- */

export const CURVED = "martial-curved-weapons";
const curvedT = weaponTree(CURVED);
export const curved = curvedT.can;
export const curvedHeld = curvedT.held;
export const isCurvedAttack = (actor, item) => !!item && weaponFits(actor, item, CURVED);
export const CURVED_COST = {
  disarm: item => scalingMin(item),                        // T1
  sheath: item => 2 * scalingMin(item)                     // T4
};

/* -------------------------------------------- */
/*  Longshot Weapons                            */
/* -------------------------------------------- */

export const LONGSHOT = "martial-longshot-weapons";
const longshotT = weaponTree(LONGSHOT);
export const longshot = longshotT.can;
export const LONGSHOT_COST = {
  prepared: item => 2 * scalingMin(item),      // T1
  fish: item => scalingMin(item),              // T2
  snipe: item => scalingMin(item),             // T3
  headshot: item => item?.system?.profile?.capped ?? 0  // T5, Scaling Stat
};

/* -------------------------------------------- */
/*  Grappling Methods                           */
/* -------------------------------------------- */

export const GRAPPLING = "martial-grappling-methods";
export const grappling = (actor, tier) => treeTier(actor, GRAPPLING) >= tier;
export const GRAPPLING_COST = {
  lockDown: target => statValue(target, "str"),   // T1: the grappled target's STR stat
  disrupt: target => statMinOf(target, "str")     // T2: the grappled target's STR min
};

/* -------------------------------------------- */
/*  Thrasher Weapons                            */
/* -------------------------------------------- */

export const THRASHER = "martial-thrasher-weapons";
const thrasherT = weaponTree(THRASHER);
export const thrasher = thrasherT.can;
export const THRASHER_COST = {
  windup: item => scalingMin(item),            // T2 (each)
  overshield: item => scalingMin(item),        // T3
  getOverHere: item => 2 * scalingMin(item)    // T5
};

/* -------------------------------------------- */
/*  Unarmored                                   */
/* -------------------------------------------- */

export const UNARMORED_COST = {
  quicken: a => statMinOf(a, "con")   // T4
};
