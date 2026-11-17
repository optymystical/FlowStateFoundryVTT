/**
 * NPC creation rules for the GM's NPC wizard: the GM sets the stat points, Skill Points and their ratio, picks any gear (any rarity and grade),
 * and gets an unlinked NPC. Pure functions (no Foundry globals) so they're unit-tested; the wizard and the final check use the same logic.
 *
 * Every NPC has an Ancestry (`npcAbc`): a Bestiary creature, or one of the ABCs' peoples (they're moving into the Bestiary). What else it needs
 * follows its sapience (ABC Rules): a people (high) picks a Background and a Culture (Homeland and Circle), and gets the Background's free trees
 * (the points a Background can't place aren't given: an NPC buys those trees with its Skill Points); a Bestiary creature with Backgrounds (mid)
 * picks one (its build); one with none (low) has its Ancestry only.
 */
import { STATS, deriveCharacter } from "./rules.mjs";
import { WEAPON_TYPES, WEAPON_MATERIALS, ARMOR_MATERIALS, weaponProfile, armorProfile } from "./martial.mjs";
import { FOCI_TYPES, SHROUD_TYPES, AFFIXES, AFFIX_SIDES } from "./magic.mjs";
import { FORMS } from "./mental-rules.mjs";
import * as creation from "./creation.mjs";
import { bestiaryBuild, bestiaryBackgrounds, isBestiary as ANCESTRY_IS_BESTIARY } from "./bestiary-rules.mjs";
import { ANCESTRIES, BACKGROUNDS, backgroundsFor, homelandsFor, circlesFor, freeTreesFor, GLAND_ELEMENTS } from "./abc-rules.mjs";
import { wonderById } from "./mental-rules.mjs";

export const NPC_DEFAULTS = { statPoints: 90, ratio: 3, skillManual: false, skillPoints: 30, grade: 1, size: 3, disposition: -1, ammo: creation.STARTING_AMMO };
export const ANY_RARITY = "veryRare";
export const DISPOSITIONS = { "-1": "Hostile", 0: "Neutral", 1: "Friendly" };
/** Sapience (Flow State - ABCs): high, mid or low, and the stat points per Skill Point it starts a creature at. */
export const SAPIENCE = { 3: { label: "High (3:1)", ratio: 3 }, 2: { label: "Mid (5:1)", ratio: 5 }, 1: { label: "Low (10:1)", ratio: 10 } };
const TOKEN_SQUARES = { 1: 0.25, 2: 0.5, 3: 1, 4: 2, 5: 4 };

const int = v => Math.trunc(Number(v) || 0);

/**
 * A Bestiary creature's build (Flow State - Bestiary): its Background (Omen, Herald) sets its Size and its trees' tiers, free of Skill Points
 * (bestiary-rules.mjs `bestiaryBuild`). Null for any other NPC.
 */
export const bestiaryOf = choice => (choice?.ancestry ? bestiaryBuild(choice.ancestry, choice.bestiaryBg || "omen") : null);

/** The Ancestries an NPC can have: the Bestiary's creatures, then the ABCs' peoples (the Wasteling is a tick on a people). */
export const npcAncestries = () => [...Object.values(ANCESTRIES).filter(a => a.bestiary && !a.hidden), ...Object.values(ANCESTRIES).filter(a => !a.bestiary && !a.hidden && !a.variant)];
/**
 * What an NPC's Ancestry asks for: { people, band (3 high, 2 mid, 1 low), background, culture }. A people is high sapience (Background and Culture);
 * a Bestiary creature is mid when it has Backgrounds (its build's band) and low when it has none (its Ancestry only).
 */
export function npcAbc(choice) {
  const a = ANCESTRIES[choice?.ancestry];
  if (!a) return null;
  if (!a.bestiary) return { people: true, band: 3, background: true, culture: true };
  const bgs = bestiaryBackgrounds(a.id);
  return { people: false, band: bgs.length ? Number(bestiaryOf(choice)?.sapience) || 2 : 1, background: bgs.length > 0, culture: false };
}
/** A people's ABC choice (abc-rules shape) from the wizard's state. */
const peopleAbc = choice => ({ ancestry: choice.ancestry, wasteling: !!choice.wasteling, background: choice.background || "", focus: choice.focus || "", picks: choice.picks ?? {}, alloc: {},
  homeland: choice.homeland || "", circle: choice.circle || "", element: choice.element || "" });
/** A people's Background: its free trees and the problems with its choices (the unplaced points aren't owed by an NPC). */
export function peopleBackground(choice) {
  if (!npcAbc(choice)?.people || !BACKGROUNDS[choice.background]) return { trees: {}, errors: [] };
  const r = freeTreesFor(peopleAbc(choice));
  return { trees: r.trees, errors: r.errors.filter(e => !/^Spend \d+ points/.test(e)) };
}
/** The trees an NPC starts with for free (a Bestiary creature's, or a people's Background's), and its trees with them. */
export const freeTreesOf = choice => (npcAbc(choice)?.people ? peopleBackground(choice).trees : bestiaryOf(choice)?.free ?? {});
/** The problems with an NPC's Ancestry, Background and Culture. */
export function abcErrors(choice) {
  const req = npcAbc(choice), errors = [];
  if (!req) return ["Pick the NPC's Ancestry."];
  if (req.people) {
    if (!backgroundsFor(choice.ancestry).some(b => b.id === choice.background)) errors.push("Pick the NPC's Background.");
    else errors.push(...peopleBackground(choice).errors);
    if (!homelandsFor(choice.ancestry).some(h => h.id === choice.homeland)) errors.push("Pick the NPC's Homeland.");
    if (!circlesFor(choice.background).some(c => c.id === choice.circle)) errors.push("Pick the NPC's Circle.");
    if (choice.ancestry === "drakenblood" && !GLAND_ELEMENTS[choice.element]) errors.push("Pick the NPC's Elemental Gland element.");
  } else if (req.background && !bestiaryOf(choice)) errors.push("Pick the creature's Bestiary Background (Omen or Herald).");
  return errors;
}
const withFree = (trees, free) => { const out = { ...(trees ?? {}) }; for (const [id, t] of Object.entries(free)) out[id] = Math.max(Number(out[id]) || 0, t); return out; };

/** Skill Points from stat points at a ratio (stat points per Skill Point), rounded down. */
export const skillPointsFrom = (statPoints, ratio) => (Number(ratio) > 0 ? Math.floor(Math.max(0, statPoints) / Number(ratio)) : 0);

/** The budget a choice works with: stat points, ratio, and Skill Points (worked out from the ratio unless set by hand). */
export function budget(choice) {
  const statPoints = Math.max(0, int(choice.statPoints));
  const ratio = Number(choice.ratio) > 0 ? Number(choice.ratio) : NPC_DEFAULTS.ratio;
  const skillPoints = choice.skillManual ? Math.max(0, int(choice.skillPoints)) : skillPointsFrom(statPoints, ratio);
  return { statPoints, ratio, skillPoints, spent: creation.statTotal(choice.stats ?? {}), remaining: statPoints - creation.statTotal(choice.stats ?? {}) };
}

/** Spread the stat points as evenly as possible over every stat (the leftovers go to the first stats). */
export function evenStats(statPoints) {
  const keys = Object.keys(STATS), base = Math.floor(Math.max(0, statPoints) / keys.length);
  let extra = Math.max(0, statPoints) - base * keys.length;
  return Object.fromEntries(keys.map(k => [k, base + (extra-- > 0 ? 1 : 0)]));
}

/** A fresh slot for any piece of gear: the same slots as the player wizard, plus a grade, a "ready" flag, and plain gear. */
export function newNpcSlot(kind, grade = NPC_DEFAULTS.grade) {
  if (kind === "gear") return { kind, name: "Supplies", quantity: 1, ammoType: "" };
  const slot = creation.newSlot(kind, ANY_RARITY);
  slot.grade = Math.max(1, int(grade));
  slot.ready = true;
  return slot;
}

/** Keep a slot valid after an edit (materials that no longer fit, bad numbers). */
export function normalizeNpcSlot(slot) {
  if (slot.kind === "gear") {
    return { kind: "gear", name: String(slot.name ?? "").trim() || "Supplies", quantity: Math.max(1, int(slot.quantity) || 1), ammoType: WEAPON_TYPES[slot.ammoType]?.ranged ? slot.ammoType : "" };
  }
  const s = creation.normalizeSlot(slot, ANY_RARITY);
  s.grade = Math.max(1, int(slot.grade) || 1);
  s.ready = slot.ready === undefined ? true : slot.ready === true || slot.ready === "true" || slot.ready === "on";
  return s;
}

/** Display name for a slot. */
export const slotName = slot => (slot.kind === "gear" ? `${slot.name || "Supplies"} ×${slot.quantity ?? 1}` : creation.slotName(slot));

/** Derived numbers for the preview (HP, Pain Threshold, Energy, Move, dice). */
export function preview(choice) {
  const b = budget(choice);
  const d = deriveCharacter({ stats: { ...creation.emptyStats(), ...choice.stats }, skillPoints: b.skillPoints, size: Math.min(5, Math.max(1, int(choice.size) || 3)) });
  return { skillPoints: b.skillPoints, hp: d.hpMax, pain: d.pain, energy: d.energyMax, move: d.move, attackDie: d.attackDie, dodgeDie: d.dodgeDie, effective: d.effective };
}

/** All problems with an NPC choice. Empty = OK to create. */
export function validate(choice) {
  const errors = [];
  const b = budget(choice);
  if (!String(choice.name ?? "").trim()) errors.push("Give the NPC a name.");
  for (const k of Object.keys(STATS)) {
    const v = choice.stats?.[k];
    if (!Number.isInteger(v) || v < 0) errors.push(`${STATS[k].label} must be a whole number of 0 or more.`);
  }
  if (!(Number(choice.ratio) > 0)) errors.push("The ratio must be above 0.");
  if (b.spent > b.statPoints) errors.push(`${b.spent} stat points are spent, but only ${b.statPoints} are set.`);
  const size = int(choice.size);
  if (size < 1 || size > 5) errors.push("Size must be from 1 to 5.");
  const items = choice.items ?? [];
  for (const [n, slot] of items.entries()) {
    const label = `Item ${n + 1}`;
    if (slot.kind !== "gear" && !(int(slot.grade) >= 1)) errors.push(`${label}: Grade must be 1 or more.`);
    if (slot.kind === "gear") { if (!String(slot.name ?? "").trim()) errors.push(`${label}: name the gear.`); if (!(int(slot.quantity) >= 1)) errors.push(`${label}: quantity must be at least 1.`); continue; }
    if (slot.kind === "foci") { if (!FOCI_TYPES[slot.fociType]) errors.push(`${label}: pick a Foci type.`); continue; }
    if (slot.kind === "shroud") { if (!SHROUD_TYPES[slot.shroudType]) errors.push(`${label}: pick a Shroud type.`); continue; }
    if (slot.kind === "icon") { if (!FORMS[slot.iconForm]) errors.push(`${label}: pick a Form.`); continue; }
    if (slot.kind === "affix") {
      if (!AFFIXES[slot.affix]) { errors.push(`${label}: pick an Affix.`); continue; }
      if (!AFFIX_SIDES[slot.side]) errors.push(`${label}: pick the form ${AFFIXES[slot.affix].label} is attuned to (Offensive or Defensive).`);
      continue;
    }
    const table = slot.kind === "armor" ? ARMOR_MATERIALS : WEAPON_MATERIALS;
    if (!table[slot.material]) { errors.push(`${label}: pick a material.`); continue; }
    const p = slot.kind === "armor"
      ? armorProfile({ weight: slot.weight, material: slot.material, grade: int(slot.grade) || 1 }, 10)
      : weaponProfile({ type: slot.type, weight: slot.weight, material: slot.material, grade: int(slot.grade) || 1 }, { str: 10, dex: 10 });
    if (!p.valid) errors.push(`${label}: ${p.error}`);
  }
  const ready = kind => items.filter(i => i.kind === kind && i.ready !== false).length;
  if (ready("armor") > 1) errors.push("Only one armor can be worn at a time: untick Ready on the others.");
  if (ready("foci") > 1) errors.push("Only one Foci can be attuned at a time.");
  if (ready("shroud") > 1) errors.push("Only one Shroud can be attuned at a time.");
  if (ready("icon") > 1) errors.push("Only one Icon can be attuned at a time.");
  const best = bestiaryOf(choice);
  errors.push(...abcErrors(choice));
  if (best?.form && ready("icon") > 0) errors.push("A Wonderborn is its own Icon: untick Ready on the Icon (or remove it).");
  if (ready("weapon") > 2) errors.push("At most two weapons can be ready (two hands).");
  errors.push(...creation.validateTrees(choice.trees, b.skillPoints, { ancestry: choice.ancestry || null, wasteling: !!choice.wasteling && !ANCESTRY_IS_BESTIARY(choice.ancestry), free: freeTreesOf(choice) }));
  return errors;
}

/** The items an NPC starts with: Unarmed, every picked piece of gear (Affixes are items of their own) and ammunition for ranged weapons. */
function npcItems(slots, choice = {}) {
  const readyWeapons = slots.filter(s => s.kind === "weapon" && s.ready !== false).length;
  const out = [{
    name: "Unarmed", type: "weapon", img: "icons/skills/melee/unarmed-punch-fist.webp",
    system: { weaponType: "unarmed", weight: "light", material: "", equipped: readyWeapons === 0, secondHand: readyWeapons === 0 }
  }];
  const ammo = {};
  for (const slot of slots) {
    const grade = Math.max(1, int(slot.grade) || 1), ready = slot.ready !== false;
    if (slot.kind === "affix") { if (AFFIXES[slot.affix]) out.push({ name: AFFIXES[slot.affix].label, type: "affix", img: "icons/commodities/gems/gem-faceted-diamond-blue.webp", system: { affix: slot.affix, side: slot.side === "defensive" ? "defensive" : "offensive", attuned: ready } }); continue; }
    if (slot.kind === "gear") { out.push({ name: String(slot.name).trim(), type: "gear", system: { quantity: Math.max(1, int(slot.quantity) || 1), ammoType: slot.ammoType || "" } }); continue; }
    if (slot.kind === "foci") { out.push({ name: slotName(slot), type: "foci", img: "icons/weapons/wands/wand-gem-purple.webp", system: { fociType: slot.fociType, grade, attuned: ready, equipped: ready } }); continue; }
    if (slot.kind === "shroud") { out.push({ name: slotName(slot), type: "shroud", img: "icons/magic/defensive/shield-barrier-glowing-blue.webp", system: { shroudType: slot.shroudType, grade, attuned: ready } }); continue; }
    if (slot.kind === "icon") { out.push({ name: slotName(slot), type: "icon", img: "icons/magic/holy/yin-yang-balance-symbol.webp", system: { form: slot.iconForm, grade, attuned: ready } }); continue; }
    if (slot.kind === "armor") { out.push({ name: slotName(slot), type: "armor", system: { weight: slot.weight, material: slot.material, grade, equipped: ready } }); continue; }
    const extraTypes = slot.extraTypes ?? [];
    out.push({ name: slotName(slot), type: "weapon", system: { weaponType: slot.type, weight: slot.weight, material: slot.material, grade, equipped: ready, extraTypes } });
    const ammoType = [slot.type, ...extraTypes].find(k => WEAPON_TYPES[k]?.ranged);
    if (ammoType) ammo[ammoType] = Math.min(100, (ammo[ammoType] ?? 0) + Math.max(0, int(choice.ammo ?? NPC_DEFAULTS.ammo)));
  }
  for (const [type, quantity] of Object.entries(ammo)) {
    if (quantity > 0) out.push({ name: `${WEAPON_TYPES[type].label} Ammunition`, type: "gear", img: "icons/weapons/ammunition/arrows-bodkin-yellow-red.webp", system: { quantity, ammoType: type } });
  }
  return out;
}

/** A Wonderborn's natural Icon: the Form its Wonder's Bestiary tree names, attuned, with its Wonder's Tenet (Pole-Bound: always active). */
function bestiaryIcon(best) {
  if (!best?.form || !FORMS[best.form]) return null;
  return { name: `${FORMS[best.form].name ?? best.form} (natural)`, type: "icon", img: "icons/magic/holy/yin-yang-balance-symbol.webp",
    system: { form: best.form, grade: 1, attuned: true, natural: true, tenet: wonderById(best.wonder)?.tenet?.id ?? "" } };
}

/** Actor creation data for a validated NPC choice: an unlinked NPC the GM owns, with a token sized to its Size. */
export function buildNpcData(choice) {
  const img = String(choice.img || creation.DEFAULT_IMG);
  const name = String(choice.name).trim();
  const b = budget(choice);
  const best = bestiaryOf(choice), free = freeTreesOf(choice);
  const size = Math.min(5, Math.max(1, int(choice.size) || 3));
  const sq = TOKEN_SQUARES[size];
  const icon = bestiaryIcon(best);
  return {
    name, img, type: "npc",
    ownership: { default: 0 },
    prototypeToken: { name, actorLink: false, disposition: int(choice.disposition), texture: { src: img }, width: sq, height: sq },
    system: { stats: { ...creation.emptyStats(), ...choice.stats }, skillPoints: b.skillPoints, unspentStats: Math.max(0, b.remaining), statCarry: 0, creation: false, size,
      trees: creation.cleanTrees(withFree(choice.trees, free)), freeTrees: free,
      abc: npcAbc(choice)?.people ? creation.cleanAbc(peopleAbc(choice)) : choice.ancestry ? { ancestry: String(choice.ancestry), ...(best ? { background: best.background } : {}) } : {},
      details: { sapience: String(choice.sapience ?? 3) } },
    items: [...npcItems(choice.items ?? [], choice), ...(icon ? [icon] : [])],
    // A Wonderborn's Patron is always its own Wonder (its Domain).
    flags: { flowstate: { npcWizard: true, ...(best?.wonder ? { patron: best.wonder } : {}) } }
  };
}
