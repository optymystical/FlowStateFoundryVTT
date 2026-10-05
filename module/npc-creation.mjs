/**
 * NPC creation rules for the GM's NPC wizard: the GM sets the stat points, Skill Points and their ratio, picks any gear (any rarity and grade),
 * and gets an unlinked NPC. Pure functions (no Foundry globals) so they're unit-tested; the wizard and the final check use the same logic.
 */
import { STATS, deriveCharacter } from "./rules.mjs";
import { WEAPON_TYPES, WEIGHTS, ARMOR_WEIGHTS, WEAPON_MATERIALS, ARMOR_MATERIALS, weaponProfile, armorProfile } from "./martial.mjs";
import { FOCI_TYPES, SHROUD_TYPES, AFFIXES } from "./magic.mjs";
import { FORMS } from "./mental-rules.mjs";
import * as skills from "./skills.mjs";
import * as creation from "./creation.mjs";

export const NPC_DEFAULTS = { statPoints: 90, ratio: 3, skillManual: false, skillPoints: 30, grade: 1, size: 3, disposition: -1, ammo: creation.STARTING_AMMO };
export const ANY_RARITY = "veryRare";
export const DISPOSITIONS = { "-1": "Hostile", 0: "Neutral", 1: "Friendly" };
const TOKEN_SQUARES = { 1: 0.25, 2: 0.5, 3: 1, 4: 2, 5: 4 };

const int = v => Math.trunc(Number(v) || 0);

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
export function newNpcSlot(kind, grade = NPC_DEFAULTS.grade, items = []) {
  if (kind === "gear") return { kind, name: "Supplies", quantity: 1, ammoType: "" };
  const slot = creation.newSlot(kind, ANY_RARITY, items);
  slot.grade = Math.max(1, int(grade));
  if (kind !== "affix") slot.ready = true;
  return slot;
}

/** Keep a slot valid after an edit (materials that no longer fit, bad numbers). */
export function normalizeNpcSlot(slot) {
  if (slot.kind === "gear") {
    return { kind: "gear", name: String(slot.name ?? "").trim() || "Supplies", quantity: Math.max(1, int(slot.quantity) || 1), ammoType: WEAPON_TYPES[slot.ammoType]?.ranged ? slot.ammoType : "" };
  }
  const s = creation.normalizeSlot(slot, ANY_RARITY);
  s.grade = Math.max(1, int(slot.grade) || 1);
  if (s.kind !== "affix") s.ready = slot.ready === undefined ? true : slot.ready === true || slot.ready === "true" || slot.ready === "on";
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
  const targets = creation.affixTargets(items);
  for (const t of targets) if (t.free < 0) errors.push(`${t.label}: holds at most ${t.slots} Affix${t.slots === 1 ? "" : "es"}.`);
  for (const [n, slot] of items.entries()) {
    const label = `Item ${n + 1}`;
    if (slot.kind !== "gear" && !(int(slot.grade) >= 1)) errors.push(`${label}: Grade must be 1 or more.`);
    if (slot.kind === "gear") { if (!String(slot.name ?? "").trim()) errors.push(`${label}: name the gear.`); if (!(int(slot.quantity) >= 1)) errors.push(`${label}: quantity must be at least 1.`); continue; }
    if (slot.kind === "foci") { if (!FOCI_TYPES[slot.fociType]) errors.push(`${label}: pick a Foci type.`); continue; }
    if (slot.kind === "shroud") { if (!SHROUD_TYPES[slot.shroudType]) errors.push(`${label}: pick a Shroud type.`); continue; }
    if (slot.kind === "icon") { if (!FORMS[slot.iconForm]) errors.push(`${label}: pick a Form.`); continue; }
    if (slot.kind === "affix") {
      if (!AFFIXES[slot.affix]) { errors.push(`${label}: pick an Affix.`); continue; }
      if (!targets.some(t => String(t.index) === slot.target)) errors.push(`${label}: put ${AFFIXES[slot.affix].label} on a Foci or Shroud.`);
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
  if (ready("weapon") > 2) errors.push("At most two weapons can be ready (two hands).");
  errors.push(...creation.validateTrees(choice.trees, b.skillPoints));
  return errors;
}

/** The items an NPC starts with: Unarmed, every picked piece of gear (Affixes go onto their Foci or Shroud) and ammunition for ranged weapons. */
export function npcItems(slots, choice = {}) {
  const readyWeapons = slots.filter(s => s.kind === "weapon" && s.ready !== false).length;
  const out = [{
    name: "Unarmed", type: "weapon", img: "icons/skills/melee/unarmed-punch-fist.webp",
    system: { weaponType: "unarmed", weight: "light", material: "", equipped: readyWeapons === 0, secondHand: readyWeapons === 0 }
  }];
  const affixesOn = index => slots.filter(a => a.kind === "affix" && a.target === String(index) && AFFIXES[a.affix]).map(a => a.affix);
  const ammo = {};
  for (const [index, slot] of slots.entries()) {
    if (slot.kind === "affix") continue;
    const grade = Math.max(1, int(slot.grade) || 1), ready = slot.ready !== false;
    if (slot.kind === "gear") { out.push({ name: String(slot.name).trim(), type: "gear", system: { quantity: Math.max(1, int(slot.quantity) || 1), ammoType: slot.ammoType || "" } }); continue; }
    if (slot.kind === "foci") { out.push({ name: slotName(slot), type: "foci", img: "icons/weapons/wands/wand-gem-purple.webp", system: { fociType: slot.fociType, grade, attuned: ready, equipped: ready, affixes: affixesOn(index) } }); continue; }
    if (slot.kind === "shroud") { out.push({ name: slotName(slot), type: "shroud", img: "icons/magic/defensive/shield-barrier-glowing-blue.webp", system: { shroudType: slot.shroudType, grade, attuned: ready, affixes: affixesOn(index) } }); continue; }
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

/** Actor creation data for a validated NPC choice: an unlinked NPC the GM owns, with a token sized to its Size. */
export function buildNpcData(choice) {
  const img = String(choice.img || creation.DEFAULT_IMG);
  const name = String(choice.name).trim();
  const b = budget(choice);
  const size = Math.min(5, Math.max(1, int(choice.size) || 3));
  const sq = TOKEN_SQUARES[size];
  return {
    name, img, type: "npc",
    ownership: { default: 0 },
    prototypeToken: { name, actorLink: false, disposition: int(choice.disposition), texture: { src: img }, width: sq, height: sq },
    system: { stats: { ...creation.emptyStats(), ...choice.stats }, skillPoints: b.skillPoints, unspentStats: Math.max(0, b.remaining), statCarry: 0, creation: false, size, trees: creation.cleanTrees(choice.trees) },
    items: npcItems(choice.items ?? [], choice),
    flags: { flowstate: { npcWizard: true } }
  };
}
