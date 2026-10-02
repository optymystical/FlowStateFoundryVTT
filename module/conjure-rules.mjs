/**
 * Tier 4 rules math (Summoning, Animation, Creation, Build Arcana): pure functions, no Foundry globals.
 * The engine that makes the actors and items is conjure.mjs.
 */

/** Form / Animate: the point pool is 5 × a multiplier (the Core's Threshold; a Combo's extra baseline Threshold doesn't multiply). */
export const POINTS_PER_THRESHOLD = 5;

/** The multiplier a cast's base Threshold gives: the whole Threshold for a single Core, one less for a Combo (the partner's baseline). */
export const conjureMultiplier = (base, combo) => Math.max(1, Math.floor(base) - (combo ? 1 : 0));
export const formPool = mult => POINTS_PER_THRESHOLD * Math.max(1, mult);

/**
 * Form: spend the pool on Body (1 point = 1 Str, Dex or Con, each at least 1) and Skill (2 points = 1 skill point).
 * @returns { ok, errors, spent, left, stats: { str, dex, con }, skillPoints }
 */
export function formStats({ str = 1, dex = 1, con = 1, skill = 0 }, pool) {
  const errors = [];
  const s = { str: Math.floor(+str || 0), dex: Math.floor(+dex || 0), con: Math.floor(+con || 0) };
  const sk = Math.max(0, Math.floor(+skill || 0));
  for (const [k, v] of Object.entries(s)) if (v < 1) errors.push(`${k.toUpperCase()} needs at least 1 point.`);
  const spent = s.str + s.dex + s.con + 2 * sk;
  if (spent > pool) errors.push(`${spent} points spent of ${pool}.`);
  return { ok: !errors.length, errors, spent, left: pool - spent, stats: s, skillPoints: sk };
}

/** The Summon's size: 1 or 2 by choice; 3 once the Threshold (Mods included) is at least 5, 4 at 10. */
export function formSize(choice, gross) {
  const max = gross >= 10 ? 4 : gross >= 5 ? 3 : 2;
  return Math.min(max, Math.max(1, Math.floor(+choice || 1)));
}
export const formSizes = gross => (gross >= 10 ? [1, 2, 3, 4] : gross >= 5 ? [1, 2, 3] : [1, 2]);

/** A Summon's health: 3 × Constitution × size, no regeneration or Pain Threshold; Energy: 5 × Constitution. */
export const summonHealth = (con, size) => 3 * con * size;
export const summonEnergy = con => 5 * con;

/** Layered (Build Arcana T1): default Spell health gets 2 × Build; anything else (a Summon, a Shield's own durability) gets Build. */
export const layeredBonus = (build, defaultHealth) => (defaultHealth ? 2 : 1) * Math.max(0, build);

/** Natural weapon (Arm): Light → Hardwood, Heavy → Iron, Grade by every 10 of the Summon's Scaling Stat. */
export function naturalWeapon({ weaponType, weight, scaling }) {
  return { weaponType, weight, material: weight === "heavy" ? "iron" : "hardwood", grade: Math.max(1, Math.floor((scaling || 0) / 10)) };
}
/** Natural armor (Skin): Threshold 1 = Light, 2 = Medium, 3 = Heavy, 4 = Titanic; Untreated Leather's stats (Soft Leather here) for Light/Medium, Copper for Heavy/Titanic. */
export const SKIN_WEIGHTS = { 1: "light", 2: "medium", 3: "heavy", 4: "titanic" };
export function naturalArmor({ threshold, con }) {
  const weight = SKIN_WEIGHTS[Math.min(4, Math.max(1, Math.floor(threshold || 1)))];
  return { weight, material: weight === "light" || weight === "medium" ? "softLeather" : "copper", grade: Math.max(1, Math.floor((con || 0) / 10)) };
}

/* ---- Animation ---- */

/** Size from the Body of material used: 1; 2 at 5 Body; 3 at 25; 4 at 125; 5 at 625. */
export function animationSize(body) {
  const b = Math.max(0, +body || 0);
  return b >= 625 ? 5 : b >= 125 ? 4 : b >= 25 ? 3 : b >= 5 ? 2 : 1;
}

/** The four material categories: health = hpPer × points × size; speed in ft per AP; physical attack stacks. */
export const ANIM_CATEGORIES = {
  liquid: { label: "Liquid", hpPer: 1, speed: 50, physical: -1, ap: 6, rp: 6, text: "Can't hold items; moves through nearly any opening; Advantage dodging non-targeted attacks and Disadvantage on them; ignores swimming restrictions; a grappled target begins drowning." },
  soft: { label: "Soft", hpPer: 3, speed: 20, physical: 0, ap: 6, rp: 6, text: "No restrictions: a standard summon." },
  powder: { label: "Powder", hpPer: 2, speed: 30, physical: -2, ap: 6, rp: 6, text: "Holds one object at a time (can't attack with it); Advantage dodging non-targeted attacks; fits through ¼ inch gaps; after being hit, 2 RP to scatter (untargetable by non-area/targeted attacks until its next turn, dropping what it held)." },
  hard: { label: "Hard", hpPer: 5, speed: 10, physical: 1, ap: 3, rp: 3, text: "Only 3 AP and RP per turn, but its points count as twice as high for weapon and armor limits." }
};

const mat = (category, rarity, ...names) => names.map(name => ({ name, category, rarity }));
/** The material tables of the Animation tree. */
export const ANIM_MATERIALS = [
  ...mat("liquid", "common", "Water", "Oil", "Blood"), ...mat("liquid", "uncommon", "Tar / Pitch", "Resin", "Alcohol / Spirits"), ...mat("liquid", "rare", "Mercury"),
  ...mat("soft", "common", "Hardwood", "Softwood", "Bone", "Cloth", "Soft Leather", "Hide", "Clay", "Coal", "Wool", "Salt / Halite"),
  ...mat("soft", "uncommon", "Amberite", "Chitin", "Hard Leather", "Sulfur"), ...mat("soft", "rare", "Gravesalt"), ...mat("soft", "veryRare", "Beryllium", "Aetherwood"),
  ...mat("powder", "common", "Charcoal", "Cotton", "Sand", "Ash", "Chalk Dust"), ...mat("powder", "uncommon", "Lime Powder", "Pigment Powder"),
  ...mat("hard", "common", "Stone", "Titanium"), ...mat("hard", "uncommon", "Glass", "Obsidian", "Quartz", "Aluminum", "Brick", "Granite", "Marble"),
  ...mat("hard", "rare", "Positron", "Jade"), ...mat("hard", "veryRare", "Mithrite", "Leviathan Chitin")
];
export const animMaterial = name => ANIM_MATERIALS.find(m => m.name === name) ?? null;

/** Without Expanded Animation (Animation T3) only Soft and Liquid materials can be animated. */
export const animationAllowed = (category, expanded) => expanded || category === "liquid" || category === "soft";

/** An Animation's stats: points stand in for Str, Dex and Con. Summoning + Animation spends the points like Form instead (`stats`). */
export function animationStats({ points, category, size, stats = null }) {
  const c = ANIM_CATEGORIES[category];
  const s = stats ?? { str: points, dex: points, con: points };
  return { ...s, size, hp: c.hpPer * (stats ? s.con : points) * size, energy: 0, speed: c.speed, physical: c.physical, ap: c.ap, rp: c.rp };
}

/* ---- Creation ---- */

/** The rarities Make can create: Common; Uncommon with Make Mk2; Rare with Mk2 + Mk3 (Archetypal), and the same for non-Archetypal hardness. */
export function makeRarities({ mk2 = false, mk3 = false }) {
  return mk2 ? (mk3 ? ["common", "uncommon", "rare"] : ["common", "uncommon"]) : ["common"];
}
/** Non-Archetypal objects: Powder, Liquid or Soft; Hard with Mk2; Dense with Mk2 + Mk3. */
export function makeObjectKinds({ mk2 = false, mk3 = false }) {
  return ["powder", "liquid", "soft", ...(mk2 ? ["hard"] : []), ...(mk2 && mk3 ? ["dense"] : [])];
}
/** Make Mk3 needs Make Mk2 on the same Spell. */
export const mk3Needs = ({ mk2, mk3 }) => !mk3 || mk2;

/* ---- Summon / Animation riders (Any T1/T2/T3 + Summoning / Animation) ---- */

/**
 * The extra effect a Combo bakes into a Summon's or Animation's attacks, by Core: dice per level and what comes with them.
 * `level` = 1 per 10 Str + Dex (Summoning) or per 10 points (Animation).
 */
export const RIDERS = {
  "magic-gravity:force": { force: [8, 10] },
  "magic-slashing:cut": { dice: [2, 6], type: "physical", livingDie: 4 },
  "magic-piercing:stab": { dice: [1, 10], type: "physical", critStack: 1 },
  "magic-crushing:slam": { dice: [1, 12], type: "physical", dodgeDie: 2 },
  "magic-heat:flame": { dice: [1, 12], type: "heat", ignite: true },
  "magic-cold:frost": { dice: [1, 12], type: "cold", energy: true },
  "magic-radiation:crackle": { dice: [1, 12], type: "radiation", chain: true },
  "magic-acid:glob": { dice: [1, 12], type: "acid", stain: true },
  "magic-venomancy:poison": { poison: true },
  "magic-charm:charm": { charm: true },
  "magic-witchery:hex": { hex: true }
};
export const riderLevel = (total, per = 10) => Math.max(1, Math.floor(total / per));
