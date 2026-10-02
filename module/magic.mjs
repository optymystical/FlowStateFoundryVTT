/**
 * Magic equipment (Equipment doc: Magic Foci, Magic Shrouds, Magic Affixes).
 * Foci: Durability/Limit = base × Grade. Power scales with the casting form's stat (Grasp / Reach / the lesser), Grade-capped.
 * Shrouds: Durability/Limit = base × floor(Build capped at Grade × 10 ÷ 10), minimum ×1 (like armor with Con).
 */
import { armorMultiplier, cappedStat, DAMAGE_CATEGORY } from "./martial.mjs";

export const CASTING_FORMS = {
  igniter: { label: "Igniter", stat: "grasp", ap: "2", tr: 1, text: "Grasp · 2 AP to cast · 1 Threshold Reduction" },
  channeler: { label: "Channeler", stat: "reach", ap: "3", tr: 2, text: "Reach · 3 AP to cast · 2 Threshold Reduction" },
  multi: { label: "Multi", stat: "lesser", ap: "1 / 2 / 3", tr: null, text: "The lesser of Reach and Grasp · Raw Casting AP and TR (1, 2 or 3)" }
};

const fo = (label, form, dur, limit, affixes, plus, effect = "", extra = {}) => ({ label, form, dur, limit, affixes, plus, effect, ...extra });
const DECK = (draw, core, combo) => `Cannot cast spells normally. Create a "deck" of spells using all of your Core spells (3 each). At the start of your turn, shuffle your hand and discard pile into your deck and draw ${draw} cards (reshuffle when empty). You can: 1. Spend 1/10th of your max Energy to draw a card. 2. Spend 2/10th of your max Energy to mulligan your entire hand (discard your whole hand to draw that many cards). 3. Cast a card as a Core spell with ${core} TR base (it discards after). 4. Combine two cards for a Combo spell with ${combo} TR base (they discard after).`;

export const FOCI_TYPES = {
  // Igniters
  rod: fo("Rod", "igniter", 20, 4, 3, false),
  shard: fo("Shard", "igniter", 40, 8, 1, true),
  wand: fo("Wand", "igniter", 30, 6, 1, false, "Every other spell cast with this Foci grants it 1 additional TR until the start of your next turn. Has 0 TR baseline.", { tr: 0 }),
  staff: fo("Staff", "igniter", 30, 6, 1, false, "Requires two hands to cast with. Your next spell cast with this Foci using AP/RP casts twice, as long as your last one cast since the start of your turn was a different Core Spell.", { twoHandCast: true }),
  scepter: fo("Scepter", "igniter", 60, 12, 1, false, "Spells cast with this Foci have 1 additional TR when targeting an ally."),
  chime: fo("Chime", "igniter", 10, 2, 0, false, DECK(7, 2, 4)),
  // Channelers
  scroll: fo("Scroll", "channeler", 20, 4, 3, false),
  orb: fo("Orb", "channeler", 40, 8, 1, true),
  lens: fo("Lens", "channeler", 30, 6, 1, false, "Every spell cast with this Foci removes 1 TR from it until the start of your next turn. Has 4 TR baseline.", { tr: 4 }),
  tome: fo("Tome", "channeler", 30, 6, 1, false, "Requires two hands to cast with. Your next spell cast with this Foci using AP/RP casts twice, as long as your last one cast since the start of your turn was the same Core Spell.", { twoHandCast: true }),
  tablet: fo("Tablet", "channeler", 60, 12, 1, false, "Spells cast with this Foci have 2 additional TR when targeting an ally."),
  cards: fo("Cards", "channeler", 10, 2, 0, false, DECK(5, 3, 6)),
  // Multi
  glove: fo("Glove", "multi", 40, 8, 3, false),
  band: fo("Band", "multi", 60, 12, 1, true),
  ring: fo("Ring", "multi", 30, 6, 1, false, "Select one Core spell to be the chosen spell of this Foci (can be changed on rest). That Core spell and its Combos have 1 additional TR when cast with this Foci.", { choice: "spell" }),
  gauntlet: fo("Gauntlet", "multi", 10, 2, 0, false, "Whenever you cast a spell with this Foci using AP/RP, duplicate it. The first spell in this chain uses your higher Scaling Stat, and the second uses your lower Scaling Stat (between Reach and Grasp).")
};

const sh = (label, dur, limit, affixes, plus, effect = "", extra = {}) => ({ label, dur, limit, affixes, plus, effect, ...extra });
export const SHROUD_TYPES = {
  bastion: sh("Bastion", 50, 10, 2, false),
  keystone: sh("Keystone", 60, 12, 1, true),
  cinder: sh("Cinder", 80, 5, 1, false, "The Limit of this Shroud is three times as high against damage types you have already taken since the start of your turn."),
  cistern: sh("Cistern", 60, 5, 1, false, "The Limit of this Shroud is three times as high while you are at full Energy, two times as high if you are instead above half Energy, and normal if you are at or below half Energy. Recovery scales with this varying limit."),
  ember: sh("Ember", 60, 5, 1, false, "The Limit of this Shroud is three times as high while you are at or below half of your max HP, two times as high if you are instead above half of your max HP, and normal if you are at full HP. Recovery scales with this varying limit."),
  aegis: sh("Aegis", 3, 12, 0, false, "The Durability of this Shroud does not scale, and fully restores at the start of your turn. Does not block damage as normal, instead any damage up to but not exceeding the Limit removes 1 durability instead and gets fully negated.", { fixedDur: true, negator: true }),
  lattice: sh("Lattice", 6, 6, 0, false, "The Durability of this Shroud does not scale, and fully restores at the start of your turn. Does not block damage as normal, instead any damage up to but not exceeding the Limit removes 1 durability instead and gets fully negated.", { fixedDur: true, negator: true }),
  ward: sh("Ward", 30, 8, 1, false, "Instead of blocking damage as normal, this Shroud must be activated with 2 RP to be placed on a target within 100ft (no attack roll, only one application at a time, can target yourself). Durability restores to full on usage, effect lasts until the start of your next turn or until reactivated.", { placed: "ward" }),
  bond: sh("Bond", 80, 8, 1, false, "This Shroud applies to both you and a single other target within 100ft you may declare for 3 RP at any time. Doing so refreshes the durability of this Shroud. This effect goes away if the target goes more than 1000ft away from you, or the Shroud's durability reaches 0.", { placed: "bond" }),
  carapace: sh("Carapace", 50, 5, 1, false, "Every time this Shroud takes damage, its Limit increases by what it is at a baseline post scaling. Resets at the start of your turn (before recovery)."),
  riposte: sh("Riposte", 40, 8, 1, false, "When this Shroud takes damage from a source within 100ft, you can spend 1 RP to make a ranged attack roll against that target, dealing the damage that the Shroud took back at them on hit."),
  retort: sh("Retort", 40, 8, 1, false, "While you are melded with this Shroud, if you would take damage from an attack that this Shroud can block, you may spend 1 RP to give that attack's damage a stack of Weakened.")
};

const af = (label, rarity, foci, shroud) => ({ label, rarity, foci, shroud });
export const AFFIXES = {
  quartz: af("Quartz", "common", "The range of your Ranged spells is increased by 50%.", "If a target within your personal melee range would be damaged, you can extend your shroud to protect them for that instance."),
  agate: af("Agate", "common", "The area of your Area spells is increased by 50%.", "Negates an amount of damage equal to your Scaling Stat from the first instance of Magical damage you would take. Refreshes when the Shroud Recovers."),
  jasper: af("Jasper", "common", "The attack rolls of your spells have advantage against targets with at least +2 AP of movement slows.", "Negates an amount of damage equal to your Scaling Stat from the first instance of Physical damage you would take. Refreshes when the Shroud Recovers."),
  obsidian: af("Obsidian", "common", "Your Ranged spells are silent (if upgraded, your Area spells are silent as well).", "Negates an amount of damage equal to your Scaling Stat from the first instance of Elemental damage you would take. Refreshes when the Shroud Recovers."),
  hematite: af("Hematite", "common", "When you cast a spell, you can double its Power by spending Health equal to the Power of that spell.", "At any time, you can expend Health equal to half of your Skill Points (rounded down) to instantly refill this Shroud's durability to max."),
  garnet: af("Garnet", "uncommon", "Spells you cast at targets with more than half their Pain Threshold in Ignite stacks have advantage on their attack rolls.", "An amount of Ignite stacks on you equal to your Scaling Stat min are automatically put out at the start of each of your turns."),
  topaz: af("Topaz", "uncommon", "Spells you cast at targets that have at least 2 AP of movement slows have advantage on their attack rolls.", "An amount of Slow stacks on you equal to your Scaling Stat min are automatically removed from you at the start of each of your turns."),
  moonstone: af("Moonstone", "uncommon", "While in darkness or dim light, all spells you cast are silent (if upgraded, they have advantage on their attack rolls too).", "While in darkness or dim light, you are considered lightly obscured."),
  tourmaline: af("Tourmaline", "uncommon", "Damage dealt by your spells of the specified Elemental damage type are Strengthened, and all other damage types (non-elemental included) are Weakened. The specified element can be changed when you rest.", "Damage taken by this Shroud of the specified Elemental damage type is Weakened. The specified element can be changed when you rest."),
  zircon: af("Zircon", "uncommon", "Damage taken by this Foci is Weakened, and attacks made that target it directly have disadvantage on their attack rolls.", "While this Shroud is undamaged, you ignore the penalties of Rough Terrain and Slow stacks."),
  emerald: af("Emerald", "rare", "While in a Lush Biome, the attack rolls of your spells have advantage. While in any other biome type, they have disadvantage instead.", "While in a Lush Biome, the Limit of this Shroud is doubled. While in any other biome type, it is halved instead."),
  ruby: af("Ruby", "rare", "Your spells that target something within your personal melee range can also impart Ignite stacks on that target equal to your Scaling Stat min if they hit.", "If your Shroud is damaged by a source that is within your personal melee range, make a melee attack against that target for free. On hit, they get Ignite stacks equal to the damage your Shroud took."),
  blackOpal: af("Black Opal", "rare", "The ranges of your Targeted and Ranged spells are swapped (if upgraded, choose one to have 50% increased range. Can be changed when you rest).", "Any attacks made against you within your personal melee range have disadvantage on their attack rolls."),
  sapphire: af("Sapphire", "rare", "Your spells that target something within your personal melee range also impart Slow stacks on that target equal to your Scaling Stat min if they hit.", "If your Shroud is damaged by a source that is within your personal melee range, make a melee attack against that target for free. On hit, they get Slow stacks equal to the damage your Shroud took."),
  diamond: af("Diamond", "rare", "Whenever you successfully hit a spell, if you cast that same spell against the same target this turn, that spell's attack roll has advantage.", "If your Shroud would be damaged by a source that already damaged it this turn, that damage is Weakened. Applies to specific source types only, such as Bladed Weapons or Heat Spells."),
  alexandrite: af("Alexandrite", "veryRare", "When you deal damage with a spell, the next time you deal damage with a spell this turn, if the new damage type is the same as the previous one, the new damage is Strengthened.", "When your Shroud takes damage, the next time it would be damaged, if the new damage type is the same as the previous one, the new damage is Weakened."),
  painite: af("Painite", "veryRare", "Your spells ignore Limit (as Martial Cleave would) equal to your Scaling Stat min.", "This Shroud's Limit cannot be ignored."),
  musgravite: af("Musgravite", "veryRare", "Force applied by your spells goes against the target's current health instead of their maximum health.", "Negates an amount of Force equal to your Scaling Stat from each instance of Force that would affect you."),
  taaffeite: af("Taaffeite", "veryRare", "Rituals you cast take half as much Energy to complete.", "Whenever a Ritual would be destroyed while you are attuned to this Shroud, you may instead set this Shroud's Durability to 0 to keep that Ritual alive at 1 health. Your shroud must have more than 0 Durability to proc this effect."),
  coloredDiamond: af("Colored Diamond", "veryRare", "At the start of each of your turns, declare a spell name. Any damage you would deal with that spell this turn is Strengthened, and any attack rolls for that spell have advantage.", "At the start of each of your turns, declare a source type that can deal damage (such as Bladed Weapons or Heat Spells). For that turn, damage your Shroud would take from the named source is Weakened, and attacks from that source against you have disadvantage.")
};

export const AFFIX_RARITIES = { common: "Common", uncommon: "Uncommon", rare: "Rare", veryRare: "Very Rare" };
export const ELEMENTS = { heat: "Heat", cold: "Cold", acid: "Acid", radiation: "Radiation" };

/** Affix keys on an item, trimmed to its slot count (unknown keys dropped). */
export function affixList(keys, slots) {
  return (keys ?? []).filter(k => AFFIXES[k]).slice(0, Math.max(0, slots));
}

/** Foci profile. `stats` = { reach, grasp } effective values (or Grade-cap previews). */
export function fociProfile(sys, stats = {}) {
  const t = FOCI_TYPES[sys.fociType];
  if (!t) return { valid: false, error: "Pick a Foci type." };
  const form = CASTING_FORMS[t.form];
  const grade = Math.max(1, sys.grade || 1);
  const reach = cappedStat(stats.reach ?? 0, grade), grasp = cappedStat(stats.grasp ?? 0, grade);
  const scalingStat = form.stat === "lesser" ? (reach <= grasp ? "reach" : "grasp") : form.stat;
  const scaling = form.stat === "lesser" ? Math.min(reach, grasp) : form.stat === "reach" ? reach : grasp;
  const affixes = affixList(sys.affixes, t.affixes);
  return {
    valid: true,
    label: `${form.label} · ${t.label}`,
    form: t.form, formLabel: form.label, formText: form.text,
    grade, scalingStat, scaling,
    castAP: form.ap,
    tr: t.tr ?? form.tr,
    durability: t.dur * grade,
    limit: t.limit * grade,
    affixSlots: t.affixes, affixPlus: t.plus, affixes,
    twoHandCast: !!t.twoHandCast,
    effect: t.effect,
    // Foci only block what they would as an object (Physical and Elemental), when something targets or hits through them.
    focus: null, selfWeakened: affixes.includes("zircon") ? (t.plus ? 2 : 1) : 0
  };
}

/** Shroud profile. `build` = effective Build (or the Grade-cap preview). */
export function shroudProfile(sys, build = 0) {
  const t = SHROUD_TYPES[sys.shroudType];
  if (!t) return { valid: false, error: "Pick a Shroud type." };
  const grade = Math.max(1, sys.grade || 1);
  const mult = armorMultiplier(build, grade);
  const affixes = affixList(sys.affixes, t.affixes);
  return {
    valid: true,
    label: t.label,
    grade, mult,
    scaling: cappedStat(build, grade),
    durability: t.fixedDur ? t.dur : t.dur * mult,
    baseLimit: t.limit * mult,
    limit: t.limit * mult,
    affixSlots: t.affixes, affixPlus: t.plus, affixes,
    affixMult: t.plus ? 2 : 1,
    negator: !!t.negator, placed: t.placed ?? null, fixedDur: !!t.fixedDur,
    effect: t.effect
  };
}

/** Shrouds block Physical, Elemental, and Magical damage. */
export const shroudBlocks = type => ["physical", "elemental", "magical"].includes(DAMAGE_CATEGORY[type] ?? "physical");

/**
 * Damage "source types" for Diamond / Colored Diamond: weapon types (Unarmed included), else the damage type.
 * Spell schools will join this list once spells exist.
 */
export function sourceTypeChoices(WEAPON_TYPES, DAMAGE_TYPES) {
  const out = {};
  for (const [k, v] of Object.entries(WEAPON_TYPES)) if (k !== "improvised") out[`weapon:${k}`] = k === "unarmed" ? "Unarmed attacks" : `${v.label} Weapons`;
  for (const [k, v] of Object.entries(DAMAGE_TYPES)) out[`type:${k}`] = `${v} damage (non-weapon)`;
  return out;
}
