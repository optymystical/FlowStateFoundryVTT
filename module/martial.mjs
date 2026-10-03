/**
 * Martial equipment tables and math, from "Flow State - Equipment" (Martial Weapons, Martial Armor).
 * Pure data + functions (no Foundry globals) so they can be unit-tested outside Foundry.
 */

export const RARITIES = { common: "Common", uncommon: "Uncommon", rare: "Rare", veryRare: "Very Rare" };

export const TAGS = {
  broad: "Broad", cleave: "Cleave", knockback: "Knockback", fast: "Fast", pierce: "Pierce",
  farstrike: "Farstrike", solitary: "Solitary", bash: "Bash", area: "Area", pepper: "Pepper"
};

/** Tag rules text from "Flow State - Equipment" (Melee Tags, Ranged Tags). */
export const TAG_DESCRIPTIONS = {
  broad: {
    base: "This Weapon's Durability and Limit are twice as high as they normally would be.",
    plus: "Durability and Limit are three times as high instead."
  },
  cleave: {
    base: "This weapon deals additional damage equal to your Scaling Stat Min against objects only (armor, a parrying weapon, an aimed-at item), applied before normal damage and using up their Limit first.",
    plus: "Deals additional object damage equal to your Scaling Stat instead."
  },
  knockback: {
    base: "Any hit on a target with this Weapon can impart Force to them up to 5× your Scaling Stat in the direction of your attack.",
    plus: "Adds another 5× Scaling Stat in Force (additive: base 5×, +5× Knockback+, +5× two-handed)."
  },
  fast: {
    base: "When you make an attack with a Fast Weapon, you may make another attack at no AP/RP cost with a different held Weapon that has the Fast tag. The extra attack has disadvantage on its attack roll. Triggers once per AP/RP attack.",
    plus: "The extra attack has no disadvantage."
  },
  pierce: {
    base: "This Weapon ignores Limit equal to a quarter of your Scaling Stat.",
    plus: "Ignores Limit equal to half of your Scaling Stat instead."
  },
  farstrike: {
    base: "This Weapon's melee attack range is double your normal melee range.",
    plus: "Quadruple your normal melee range instead."
  },
  solitary: {
    base: "Once per attack, when you make an attack with a one-handed Solitary weapon, you may immediately attack again with disadvantage using no AP/RP. Can't be done at the same time as a Fast attack.",
    plus: "The extra attack has no disadvantage."
  },
  bash: {
    base: "When attacking through an object with Limit ≤ a quarter of your Scaling Stat, ignore its Limit and add that Limit as extra damage. Once per attack; no effect when targeting something directly.",
    plus: "Works on Limit up to half of your Scaling Stat."
  },
  area: {
    base: "Attacks can instead be Area attacks: all targets within 5 ft of a position up to half the Weapon's range away. Area damage rolls are Weakened.",
    plus: "All targets within 10 ft, and the position can be up to the Weapon's full range away."
  },
  pepper: {
    base: "Fire an additional shot at the same target: roll the attack with a disadvantage, and on hit both shots hit. On-attack effects trigger once; on-hit effects trigger per shot.",
    plus: "Up to 2 bonus shots per attack, each adding a disadvantage."
  }
};

/** Tags as [{key, label, tooltip}] for display. */
export function describeTags(tags = {}) {
  return Object.entries(tags).map(([key, v]) => {
    const d = TAG_DESCRIPTIONS[key];
    const label = `${TAGS[key] ?? key}${v === 2 ? "+" : ""}`;
    const tooltip = d ? (v === 2 ? `${d.base} ${label}: ${d.plus}` : d.base) : "";
    return { key, label, tooltip };
  });
}

/** Tag value 1 = base tag, 2 = "+" version. */
const t = s => Object.fromEntries(s.split(",").map(x => x.trim()).filter(Boolean)
  .map(x => (x.endsWith("+") ? [x.slice(0, -1).toLowerCase(), 2] : [x.toLowerCase(), 1])));

/* -------------------------------------------- */
/*  Weapon types                                */
/* -------------------------------------------- */

const melee = (label, light, heavy) => ({ label, ranged: false, light, heavy });
const ranged = (label, light, heavy) => ({ label, ranged: true, light, heavy });

export const WEAPON_TYPES = {
  unarmed:  melee("Unarmed",  { die: 10, tags: t("Fast, Pierce"),             throw: null },      { die: 12, tags: t("Knockback, Solitary, Cleave"), throw: null }),
  bladed:   melee("Bladed",   { die: 8,  tags: t("Fast"),                     throw: "average" }, { die: 12, tags: t("Broad, Cleave, Solitary+"),   throw: "bad" }),
  balanced: melee("Balanced", { die: 8,  tags: t("Broad, Solitary"),          throw: "average" }, { die: 12, tags: t("Broad, Farstrike, Solitary"), throw: "average" }),
  swift:    melee("Swift",    { die: 4,  tags: t("Fast+, Pierce"),            throw: "good" },    { die: 12, tags: t("Fast, Pierce+"),              throw: "good" }),
  striker:  melee("Striker",  { die: 8,  tags: t("Cleave"),                   throw: "good" },    { die: 12, tags: t("Cleave+"),                    throw: "good" }),
  defender: melee("Defender", { die: 6,  tags: t("Broad"),                    throw: "good" },    { die: 10, tags: t("Broad+, Cleave"),             throw: "average" }),
  weighted: melee("Weighted", { die: 8,  tags: t("Knockback"),                throw: "average" }, { die: 12, tags: t("Knockback+"),                 throw: "average" }),
  reach:    melee("Reach",    { die: 6,  tags: t("Pierce, Solitary"),         throw: "good" },    { die: 10, tags: t("Pierce+, Farstrike"),         throw: "good" }),
  circular: melee("Circular", { die: 6,  tags: t("Fast, Pierce"),             throw: "good" },    { die: 12, tags: t("Fast, Cleave"),               throw: "good" }),
  curved:   melee("Curved",   { die: 6,  tags: t("Cleave, Solitary+"),        throw: "average" }, { die: 12, tags: t("Cleave, Farstrike, Solitary"), throw: "average" }),
  thrasher: melee("Thrasher", { die: 8,  tags: t("Farstrike, Knockback"),     throw: "bad" },     { die: 10, tags: t("Farstrike+, Knockback"),      throw: "average" }),
  // Improvised (Martial Theory T4 text): 1d6 per Grade, no tags or effects. Characters with T4 use real weapons instead.
  improvised: melee("Improvised", { die: 6, tags: {}, throw: "average" }, { die: 6, tags: {}, throw: "average" }),
  rapid:    ranged("Rapid",    { die: 6,  tags: t("Fast, Pepper"),   reload: "fast",    range: 75 },  { die: 12, tags: t("Pepper+"),        reload: "average", range: 150 }),
  assault:  ranged("Assault",  { die: 8,  tags: t("Solitary"),       reload: "fast",    range: 100 }, { die: 12, tags: t("Pierce, Solitary"), reload: "average", range: 200 }),
  blast:    ranged("Blast",    { die: 8,  tags: t("Area, Cleave"),   reload: "average", range: 25 },  { die: 12, tags: t("Area+, Cleave"),  reload: "average", range: 50 }),
  longshot: ranged("Longshot", { die: 8,  tags: t("Cleave, Pierce"), reload: "average", range: 150 }, { die: 14, tags: t("Cleave, Pierce"), reload: "slow",    range: 300 })
};

export const WEIGHTS = { light: { label: "Light", stat: "dex", ap: 2 }, heavy: { label: "Heavy", stat: "str", ap: 3 } };
export const RELOAD_RP = { fast: 1, average: 2, slow: 3 };
export const THROW = {
  bad:     { label: "Bad",     range: 50,  net: -1 },
  average: { label: "Average", range: 100, net: 0 },
  good:    { label: "Good",    range: 200, net: 1 }
};

/* -------------------------------------------- */
/*  Damage categories and Limit effectiveness   */
/* -------------------------------------------- */

/** Damage type → Limit category. */
export const DAMAGE_CATEGORY = {
  physical: "physical", heat: "elemental", cold: "elemental", acid: "elemental", radiation: "elemental",
  arcane: "magical", supernatural: "supernatural"
};

/**
 * Limit effectiveness vs a damage type.
 * Default (Martial): blocks Physical and Elemental fully, nothing else.
 * A material "focus" means: that type/category blocks fully, every other type it would block at `factor`.
 */
export function limitFactor(damageType, focus = null) {
  const cat = DAMAGE_CATEGORY[damageType] ?? "physical";
  const normallyBlocked = cat === "physical" || cat === "elemental";
  if (!focus) return normallyBlocked ? 1 : 0;
  const matches = focus.key === damageType || focus.key === cat;
  if (matches) return 1;
  return normallyBlocked ? focus.factor : 0;
}

/* -------------------------------------------- */
/*  Weapon materials                            */
/* -------------------------------------------- */

const wm = (label, rarity, weights, effect, mods = {}) => ({ label, rarity, weights, effect, mods });
const L = (dur, limit) => ({ light: { dur, limit } });
const H = (dur, limit) => ({ heavy: { dur, limit } });
const LH = (ld, ll, hd, hl) => ({ light: { dur: ld, limit: ll }, heavy: { dur: hd, limit: hl } });
const tenth = key => ({ focus: { key, factor: 0.1 } });
const third = key => ({ focus: { key, factor: 1 / 3 } });

export const WEAPON_MATERIALS = {
  hardwood:   wm("Hardwood", "common", L(30, 6), ""),
  softwood:   wm("Softwood", "common", L(20, 4), "Requires half as much work/resources to make and repair."),
  bone:       wm("Bone", "common", L(10, 2), "Damage dealt is Strengthened, but requires twice as much work/resources to make and repair.", { stacks: 1 }),
  iron:       wm("Iron", "common", H(60, 12), ""),
  copper:     wm("Copper", "common", H(40, 8), "Requires half as much work/resources to make and repair."),
  stone:      wm("Stone", "common", H(20, 4), "Damage dealt is Strengthened, but requires twice as much work/resources to make and repair.", { stacks: 1 }),
  steel:      wm("Steel", "uncommon", LH(45, 9, 90, 18), "The Limit is a third as effective against non-physical damage.", third("physical")),
  bronze:     wm("Bronze", "uncommon", LH(45, 9, 90, 18), "The Limit is a third as effective against non-elemental damage.", third("elemental")),
  glass:      wm("Glass", "uncommon", L(5, 1), "Damage dealt is doubly Strengthened, but requires four times as much work/resources to make and repair.", { stacks: 2 }),
  silver:     wm("Silver", "uncommon", L(60, 12), "Damage dealt is Strengthened against supernatural targets, but the Limit is a tenth as effective against non-supernatural damage.", { vsSupernatural: 1, ...tenth("supernatural") }),
  amberite:   wm("Amberite", "uncommon", L(60, 12), "Deals arcane damage to magic, but the Limit is a tenth as effective against non-magical damage.", { arcaneVsMagic: true, ...tenth("magical") }),
  obsidian:   wm("Obsidian", "uncommon", H(10, 2), "Damage dealt is doubly Strengthened, but requires four times as much work/resources to make and repair.", { stacks: 2 }),
  coldIron:   wm("Cold Iron", "uncommon", H(120, 24), "Damage dealt is Strengthened against supernatural targets, but the Limit is a tenth as effective against non-supernatural damage.", { vsSupernatural: 1, ...tenth("supernatural") }),
  quartz:     wm("Quartz", "uncommon", H(120, 24), "Deals arcane damage to magic, but the Limit is a tenth as effective against non-magical damage.", { arcaneVsMagic: true, ...tenth("magical") }),
  grayIron:   wm("Gray Iron", "rare", LH(45, 9, 90, 18), "Damage from this Weapon is Weakened and cannot be considered \"Good\" for throwing (becoming Average instead).", { stacks: -1, throwCap: "average" }),
  scarletite: wm("Scarletite", "rare", LH(60, 12, 120, 24), "Deals heat damage, but the Limit is a tenth as effective against non-heat damage.", { damageType: "heat", ...tenth("heat") }),
  frigidium:  wm("Frigidium", "rare", LH(60, 12, 120, 24), "Deals cold damage, but the Limit is a tenth as effective against non-cold damage.", { damageType: "cold", ...tenth("cold") }),
  positron:   wm("Positron", "rare", LH(60, 12, 120, 24), "Deals radiation damage, but the Limit is a tenth as effective against non-radiation damage.", { damageType: "radiation", ...tenth("radiation") }),
  wyrmMetal:  wm("Wyrm Metal", "rare", LH(60, 12, 120, 24), "Deals acid damage, but the Limit is a tenth as effective against non-acid damage.", { damageType: "acid", ...tenth("acid") }),
  graySteel:  wm("Gray Steel", "veryRare", LH(60, 12, 120, 24), "Damage from this Weapon is doubly Weakened and counts as \"Bad\" for throwing regardless of type.", { stacks: -2, throwForce: "bad" }),
  orichalcum: wm("Orichalcum", "veryRare", LH(20, 4, 40, 8), "Damage dealt by this Weapon is Strengthened, doubling up on a crit.", { stacks: 1, critStacks: 1 }),
  mithrite:   wm("Mithrite", "veryRare", L(20, 4), "Damage that would be dealt to this Weapon is Weakened.", { selfWeakened: 1 }),
  adamantine: wm("Adamantine", "veryRare", H(40, 8), "Damage that would be dealt to this Weapon is Weakened.", { selfWeakened: 1 })
};

/* -------------------------------------------- */
/*  Armor                                       */
/* -------------------------------------------- */

/** Armor weights: stealth Disadvantage stacks (Infinity = auto-fail) and base AP per movement. */
export const ARMOR_WEIGHTS = {
  light:   { label: "Light",   order: 0, stealthDis: 0,        moveAP: 1, don: "1 turn" },
  medium:  { label: "Medium",  order: 1, stealthDis: 1,        moveAP: 1, don: "1 minute" },
  heavy:   { label: "Heavy",   order: 2, stealthDis: 2,        moveAP: 2, don: "10 minutes" },
  titanic: { label: "Titanic", order: 3, stealthDis: Infinity, moveAP: 3, don: "1 hour" }
};
const WEIGHT_ORDER = ["light", "medium", "heavy", "titanic"];

const am = (label, rarity, weights, effect, mods = {}) => ({ label, rarity, weights, effect, mods });
const W = pairs => Object.fromEntries(Object.entries(pairs).map(([k, [dur, limit]]) => [k, { dur, limit }]));

export const ARMOR_MATERIALS = {
  cloth:       am("Cloth", "common", W({ light: [15, 3] }), "Requires half as much work/resources to make and repair."),
  softLeather: am("Soft Leather", "common", W({ light: [20, 4], medium: [40, 8] }), ""),
  hide:        am("Hide", "common", W({ medium: [30, 6] }), "Requires half as much work/resources to make and repair."),
  titanium:    am("Titanium", "common", W({ heavy: [60, 12] }), "Requires half as much work/resources to make and repair."),
  copper:      am("Copper", "common", W({ heavy: [80, 16], titanic: [160, 32] }), ""),
  iron:        am("Iron", "common", W({ titanic: [120, 24] }), "Requires half as much work/resources to make and repair."),
  chitin:      am("Chitin", "uncommon", W({ light: [30, 6], medium: [60, 12] }), "The Limit is a third as effective against non-physical damage.", third("physical")),
  hardLeather: am("Hard Leather", "uncommon", W({ light: [30, 6], medium: [60, 12] }), "The Limit is a third as effective against non-elemental damage.", third("elemental")),
  silver:      am("Silver", "uncommon", W({ light: [40, 8], medium: [80, 16] }), "The Limit is a tenth as effective against non-supernatural damage.", tenth("supernatural")),
  amberite:    am("Amberite", "uncommon", W({ light: [40, 8], medium: [80, 16] }), "The Limit is a tenth as effective against non-magical damage.", tenth("magical")),
  steel:       am("Steel", "uncommon", W({ heavy: [120, 24], titanic: [240, 48] }), "The Limit is a tenth as effective against non-physical damage.", tenth("physical")),
  bronze:      am("Bronze", "uncommon", W({ heavy: [120, 24], titanic: [240, 48] }), "The Limit is a tenth as effective against non-elemental damage.", tenth("elemental")),
  coldIron:    am("Cold Iron", "uncommon", W({ heavy: [160, 32], titanic: [320, 64] }), "The Limit is a tenth as effective against non-supernatural damage.", tenth("supernatural")),
  quartz:      am("Quartz", "uncommon", W({ heavy: [160, 32], titanic: [320, 64] }), "The Limit is a tenth as effective against non-magical damage.", tenth("magical")),
  grayIron:    am("Gray Iron", "rare", W({ medium: [60, 12], heavy: [120, 24], titanic: [240, 48] }), "Has the penalties of Armor one weight heavier than it. If Titanic, you have disadvantage on all physical rolls.", { heavier: 1 }),
  scarletite:  am("Scarletite", "rare", W({ light: [40, 8], medium: [80, 16], heavy: [160, 32], titanic: [320, 64] }), "The Limit is a tenth as effective against non-heat damage.", tenth("heat")),
  frigidium:   am("Frigidium", "rare", W({ light: [40, 8], medium: [80, 16], heavy: [160, 32], titanic: [320, 64] }), "The Limit is a tenth as effective against non-cold damage.", tenth("cold")),
  positron:    am("Positron", "rare", W({ light: [40, 8], medium: [80, 16], heavy: [160, 32], titanic: [320, 64] }), "The Limit is a tenth as effective against non-radiation damage.", tenth("radiation")),
  wyrmMetal:   am("Wyrm Metal", "rare", W({ light: [40, 8], medium: [80, 16], heavy: [160, 32], titanic: [320, 64] }), "The Limit is a tenth as effective against non-acid damage.", tenth("acid")),
  graySteel:   am("Gray Steel", "veryRare", W({ medium: [80, 16], heavy: [160, 32], titanic: [320, 64] }), "Has the penalties of Armor two weights heavier than it. If Heavy, you have disadvantage on all physical rolls and the normal Titanic penalties. If Titanic, you have disadvantage on all physical rolls and your physical attacks have one stack of Weakened.", { heavier: 2 }),
  orichalcum:  am("Orichalcum", "veryRare", W({ medium: [30, 6], heavy: [60, 12] }), "Damage that would be dealt to this Armor is Weakened.", { selfWeakened: 1 }),
  mithrite:    am("Mithrite", "veryRare", W({ light: [15, 3] }), "Damage that would be dealt to this Armor is Weakened.", { selfWeakened: 1 }),
  adamantine:  am("Adamantine", "veryRare", W({ titanic: [120, 24] }), "Damage that would be dealt to this Armor is Weakened.", { selfWeakened: 1 })
};

/* -------------------------------------------- */
/*  Scaling                                     */
/* -------------------------------------------- */

/** Stat allowed to affect equipment: capped at Grade × 10. */
export const cappedStat = (stat, grade) => Math.max(0, Math.min(stat, Math.max(1, grade) * 10));

/** Weapon damage dice: one per 10 in the capped Scaling Stat (can be 0). */
export const weaponDice = (stat, grade) => Math.floor(cappedStat(stat, grade) / 10);

/** Armor multiplier: ×1 per 10 in capped Con, minimum ×1. */
export const armorMultiplier = (con, grade) => Math.max(1, Math.floor(cappedStat(con, grade) / 10));

/** Materials available for a weight. */
export const materialsFor = (table, weight) =>
  Object.fromEntries(Object.entries(table).filter(([, m]) => m.weights[weight]).map(([k, m]) => [k, `${m.label} (${RARITIES[m.rarity]})`]));

/**
 * Full weapon profile given the wielder's effective stats.
 * @param {object} w      {type, weight, material, grade, twoHanded}
 * @param {object} stats  {str, dex} effective values
 */
export function weaponProfile(w, stats) {
  const type = WEAPON_TYPES[w.type];
  const weight = WEIGHTS[w.weight];
  if (!type || !weight) return { valid: false, error: "Pick a weapon type and weight." };
  const row = type[w.weight];
  const unarmed = w.type === "unarmed";
  const improvised = w.type === "improvised";
  const mat = unarmed || improvised ? null : WEAPON_MATERIALS[w.material];
  const matStats = mat?.weights[w.weight];
  if (!unarmed && !improvised && !matStats) return { valid: false, error: `${mat?.label ?? "That material"} can't be made ${weight.label}.` };

  // Unarmed has no material, so no Grade cap on its scaling.
  const grade = unarmed ? Infinity : Math.max(1, w.grade || 1);
  const twoHanded = !!w.twoHanded && !unarmed;
  const hands = twoHanded ? 2 : 1;
  const stat = stats[weight.stat] ?? 0;
  const capped = cappedStat(stat, grade);
  const statMin = Math.floor(capped / 3);
  const tags = row.tags;
  const mods = mat?.mods ?? {};

  const dice = weaponDice(stat, grade);
  const cleave = tags.cleave === 2 ? capped : tags.cleave === 1 ? statMin : 0;
  // Cleave is object-only damage (Equipment: Cleave), so it isn't part of the rolled formula.
  const dieFormula = dice > 0 ? `${dice}d${row.die}` : "0";
  const formula = twoHanded ? `(${dieFormula}) * 2` : dieFormula;
  const display = cleave ? `${formula} (+${cleave * (twoHanded ? 2 : 1)} Cleave vs objects)` : formula;

  // Broad: Durability/Limit ×2 (Broad+ ×3). Material stats scale with Grade.
  const broad = tags.broad === 2 ? 3 : tags.broad === 1 ? 2 : 1;
  const durability = matStats ? matStats.dur * grade * broad : 0;
  const limit = matStats ? matStats.limit * grade * broad : 0;

  let throwType = row.throw ?? null;
  if (throwType && mods.throwForce) throwType = mods.throwForce;
  else if (throwType === "good" && mods.throwCap) throwType = mods.throwCap;

  return {
    valid: true,
    label: `${weight.label} ${type.label}${mat ? ` · ${mat.label}` : ""}`,
    ranged: type.ranged,
    unarmed,
    improvised,
    scalingStat: weight.stat,
    stat,
    capped,
    grade,
    hands,
    ap: weight.ap,
    die: row.die,
    dice,
    cleave: cleave * hands,
    formula,
    display,
    damageType: mods.damageType ?? "physical",
    arcaneVsMagic: !!mods.arcaneVsMagic,
    stacks: mods.stacks ?? 0,
    critStacks: mods.critStacks ?? 0,
    vsSupernatural: mods.vsSupernatural ?? 0,
    tags,
    pierce: (tags.pierce === 2 ? Math.floor(capped / 2) : tags.pierce === 1 ? Math.floor(capped / 4) : 0) * hands,
    bash: Math.floor(capped / 4) * hands,
    // Knockback, all additive: 5× Scaling Stat base, +5× for Knockback+, +5× two-handed (Smash adds another +5×).
    knockback: tags.knockback ? 5 * capped * (1 + (tags.knockback === 2 ? 1 : 0) + (hands === 2 ? 1 : 0)) : 0,
    knockbackBase: tags.knockback ? 5 * capped : 0,
    farstrike: tags.farstrike === 2 ? 4 : tags.farstrike === 1 ? 2 : 1,
    fast: tags.fast ?? 0,
    solitary: tags.solitary ?? 0,
    area: tags.area ?? 0,
    pepper: tags.pepper ?? 0,
    throwType,
    reload: row.reload ?? null,
    reloadRP: row.reload ? RELOAD_RP[row.reload] : 0,
    range: row.range ?? null,
    durability,
    limit,
    focus: mods.focus ?? null,
    selfWeakened: mods.selfWeakened ?? 0,
    effect: mat?.effect ?? (unarmed ? "Damage dealt to objects from Light unarmed attacks is Weakened."
      : improvised ? "Improvised: 1d6 per Grade (capped by your Scaling Stat), no tags or effects. Can be thrown, but has no Limit, so it can't Parry. Removed from characters who reach Martial Theory Tier 4 (Improvise), who use real weapons instead." : "")
  };
}

/** Effective armor penalties after Gray Iron / Gray Steel shifts. */
export function armorPenalties(weight, material) {
  const mods = ARMOR_MATERIALS[material]?.mods ?? {};
  const shift = mods.heavier ?? 0;
  const baseIdx = WEIGHT_ORDER.indexOf(weight);
  const shiftedIdx = Math.min(3, baseIdx + shift);
  const overflow = baseIdx + shift - 3; // steps past Titanic
  const eff = ARMOR_WEIGHTS[WEIGHT_ORDER[shiftedIdx]];
  return {
    effectiveWeight: WEIGHT_ORDER[shiftedIdx],
    stealthDis: eff.stealthDis,
    moveAP: eff.moveAP,
    physicalDis: overflow >= 1 ? 1 : 0,           // penalties pushed past Titanic
    physicalWeakened: overflow >= 2 ? 1 : 0        // Gray Steel Titanic
  };
}

/** Full armor profile given the wearer's effective Con. */
export function armorProfile(a, con) {
  const weight = ARMOR_WEIGHTS[a.weight];
  const mat = ARMOR_MATERIALS[a.material];
  const matStats = mat?.weights[a.weight];
  if (!weight || !matStats) return { valid: false, error: `${mat?.label ?? "That material"} can't be made ${weight?.label ?? "that weight"}.` };
  const grade = Math.max(1, a.grade || 1);
  const mult = armorMultiplier(con, grade);
  return {
    valid: true,
    label: `${weight.label} · ${mat.label}`,
    grade,
    mult,
    durability: matStats.dur * mult,
    limit: matStats.limit * mult,
    focus: mat.mods.focus ?? null,
    selfWeakened: mat.mods.selfWeakened ?? 0,
    don: weight.don,
    effect: mat.effect,
    ...armorPenalties(a.weight, a.material)
  };
}

/**
 * Armor soak for one hit. Limit (× type effectiveness, minus Pierce) absorbs damage first.
 * Returns {absorbed, toHp, durabilityLoss}.
 */
/** The Limit an object actually applies against this damage type, after Pierce. */
export function effectiveLimit(profile, damageType, pierce = 0) {
  if (!profile?.valid) return 0;
  return Math.max(0, Math.floor(profile.limit * limitFactor(damageType, profile.focus)) - Math.max(0, pierce));
}

export function soak(damage, damageType, armor, { pierce = 0, durability = Infinity } = {}) {
  if (!armor?.valid || durability <= 0 || damage <= 0) return { absorbed: 0, toHp: Math.max(0, damage), durabilityLoss: 0 };
  let effLimit = Math.max(0, Math.floor(armor.limit * limitFactor(damageType, armor.focus)) - Math.max(0, pierce));
  // Can't absorb more than the remaining Durability.
  if (Number.isFinite(durability)) effLimit = Math.min(effLimit, Math.floor(durability / (armor.selfWeakened ? Math.pow(0.5, armor.selfWeakened) : 1)));
  const absorbed = Math.min(damage, effLimit);
  const durabilityLoss = armor.selfWeakened ? Math.floor(absorbed * Math.pow(0.5, armor.selfWeakened)) : absorbed;
  return { absorbed, toHp: damage - absorbed, durabilityLoss };
}
