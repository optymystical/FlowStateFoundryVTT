/**
 * Character creation rules: budgets, validation, and the actor data the GM creates.
 * Pure functions (no Foundry globals) so both the player's wizard and the GM's validation use the same logic.
 */
import { STATS, deriveCharacter } from "./rules.mjs";
import {
  WEAPON_TYPES, WEIGHTS, WEAPON_MATERIALS, ARMOR_WEIGHTS, ARMOR_MATERIALS, RARITIES, weaponProfile, armorProfile
} from "./martial.mjs";
import * as skills from "./skills.mjs";
import { FOCI_TYPES, SHROUD_TYPES, AFFIXES, AFFIX_RARITIES, AFFIX_LIMIT } from "./magic.mjs";
import { FORMS } from "./mental-rules.mjs";

export const RARITY_ORDER = ["common", "uncommon", "rare", "veryRare"];
export const DEFAULT_RULES = { statPoints: 90, items: 4, maxRarity: "uncommon", grade: 10 };
/** Ammunition given with each starting ranged weapon (per weapon, by its ammo type; at most 100 per type). */
export const STARTING_AMMO = 20;
export const DEFAULT_IMG = "icons/svg/mystery-man.svg";

export const emptyStats = () => Object.fromEntries(Object.keys(STATS).map(k => [k, 0]));
export const statTotal = stats => Object.keys(STATS).reduce((n, k) => n + (Number(stats[k]) || 0), 0);
export const skillPointsFor = statPoints => Math.floor(statPoints / 3);

const rarityOk = (rarity, max) => RARITY_ORDER.indexOf(rarity) <= RARITY_ORDER.indexOf(max);

/** Materials a starting item may use: valid for the weight and within the rarity cap. */
export function allowedMaterials(kind, weight, maxRarity) {
  const table = kind === "armor" ? ARMOR_MATERIALS : WEAPON_MATERIALS;
  return Object.fromEntries(Object.entries(table)
    .filter(([, m]) => m.weights[weight] && rarityOk(m.rarity, maxRarity))
    .map(([k, m]) => [k, `${m.label} (${RARITIES[m.rarity]})`]));
}

/** A fresh equipment slot, already pointing at valid choices. */
export function newSlot(kind, maxRarity, items = []) {
  if (kind === "foci") return { kind, fociType: "rod" };
  if (kind === "shroud") return { kind, shroudType: "bastion" };
  if (kind === "icon") return { kind, iconForm: "aegis" };
  if (kind === "affix") {
    const target = affixTargets(items).find(t => t.free > 0);
    return { kind, affix: Object.keys(allowedAffixes(maxRarity))[0] ?? "", target: target ? String(target.index) : "" };
  }
  const slot = kind === "armor" ? { kind, weight: "light" } : { kind, type: "bladed", weight: "light" };
  slot.material = Object.keys(allowedMaterials(kind, slot.weight, maxRarity))[0] ?? "";
  return slot;
}

/** Affixes a starting character may pick (within the rarity cap). */
export function allowedAffixes(maxRarity) {
  return Object.fromEntries(Object.entries(AFFIXES).filter(([, a]) => rarityOk(a.rarity, maxRarity))
    .map(([k, a]) => [k, `${a.label} (${AFFIX_RARITIES[a.rarity]})`]));
}

/** Picked Foci/Shrouds that Affixes can go on, with their free Affix slots. */
export function affixTargets(items) {
  return items.map((slot, index) => ({ slot, index })).filter(({ slot }) => slot.kind === "foci" || slot.kind === "shroud").map(({ slot, index }) => {
    const t = slot.kind === "foci" ? FOCI_TYPES[slot.fociType] : SHROUD_TYPES[slot.shroudType];
    const used = items.filter(a => a.kind === "affix" && a.target === String(index)).length;
    return { index, slot, slots: AFFIX_LIMIT, free: AFFIX_LIMIT - used, label: `${slotName(slot)} (item ${index + 1})` };
  });
}

/** Keep a slot valid after a change (e.g. weight changed so the material no longer fits). */
export function normalizeSlot(slot, maxRarity) {
  const s = { ...slot };
  if (s.kind === "foci") { if (!FOCI_TYPES[s.fociType]) s.fociType = "rod"; return s; }
  if (s.kind === "shroud") { if (!SHROUD_TYPES[s.shroudType]) s.shroudType = "bastion"; return s; }
  if (s.kind === "icon") { if (!FORMS[s.iconForm]) s.iconForm = "aegis"; return s; }
  if (s.kind === "affix") {
    const allowed = allowedAffixes(maxRarity);
    if (!allowed[s.affix]) s.affix = Object.keys(allowed)[0] ?? "";
    s.target = s.target === undefined || s.target === null ? "" : String(s.target);
    return s;
  }
  if (s.kind === "weapon") {
    if (!WEAPON_TYPES[s.type] || s.type === "unarmed" || s.type === "improvised") s.type = "bladed";
    if (!WEIGHTS[s.weight]) s.weight = "light";
    // Multi-type starting weapons: checkboxes arrive as { extra: { type: bool } }.
    if (s.extra && typeof s.extra === "object") { s.extraTypes = Object.entries(s.extra).filter(([, v]) => v).map(([k]) => k); delete s.extra; }
    s.extraTypes = [...new Set((s.extraTypes ?? []).filter(k => WEAPON_TYPES[k] && k !== s.type && k !== "unarmed" && k !== "improvised"))];
  } else if (!ARMOR_WEIGHTS[s.weight]) s.weight = "light";
  const allowed = allowedMaterials(s.kind, s.weight, maxRarity);
  if (!allowed[s.material]) s.material = Object.keys(allowed)[0] ?? "";
  return s;
}

/** Display name for a starting item, e.g. "Light Bladed (Iron)". */
export function slotName(slot) {
  if (slot.kind === "foci") return `${FOCI_TYPES[slot.fociType]?.label ?? "Foci"} (Foci)`;
  if (slot.kind === "shroud") return `${SHROUD_TYPES[slot.shroudType]?.label ?? "Shroud"} (Shroud)`;
  if (slot.kind === "icon") return `${FORMS[slot.iconForm]?.name ?? "Icon"} (Icon)`;
  if (slot.kind === "affix") return `${AFFIXES[slot.affix]?.label ?? "Affix"} (Affix)`;
  const mat = (slot.kind === "armor" ? ARMOR_MATERIALS : WEAPON_MATERIALS)[slot.material]?.label ?? "";
  if (slot.kind === "armor") return `${ARMOR_WEIGHTS[slot.weight]?.label ?? ""} Armor (${mat})`;
  const types = [slot.type, ...(slot.extraTypes ?? [])].map(k => WEAPON_TYPES[k]?.label ?? "").filter(Boolean).join("/");
  return `${WEIGHTS[slot.weight]?.label ?? ""} ${types} (${mat})`;
}

/** Derived numbers to preview while building. */
export function preview(choice, rules = DEFAULT_RULES) {
  const sp = skillPointsFor(rules.statPoints);
  const d = deriveCharacter({ stats: { ...emptyStats(), ...choice.stats }, skillPoints: sp, size: 3 });
  return { skillPoints: sp, hp: d.hpMax, pain: d.pain, energy: d.energyMax, move: d.move, attackDie: d.attackDie, dodgeDie: d.dodgeDie, effective: d.effective };
}

/** All problems with a creation choice. Empty array = OK to create. */
export function validate(choice, rules = DEFAULT_RULES) {
  const errors = [];
  if (!String(choice.name ?? "").trim()) errors.push("Give your character a name.");
  for (const k of Object.keys(STATS)) {
    const v = choice.stats?.[k];
    if (!Number.isInteger(v) || v < 0) errors.push(`${STATS[k].label} must be a whole number of 0 or more.`);
  }
  const spent = statTotal(choice.stats ?? {});
  if (spent > rules.statPoints) errors.push(`You've spent ${spent} stat points, but only ${rules.statPoints} are available.`);
  const items = choice.items ?? [];
  if (items.length > rules.items) errors.push(`You can pick at most ${rules.items} starting items.`);
  if (items.filter(i => i.kind === "armor").length > 1) errors.push("You can start with at most one armor.");
  const targets = affixTargets(items);
  for (const t of targets) if (t.free < 0) errors.push(`${t.label}: holds at most ${t.slots} Affix${t.slots === 1 ? "" : "es"}.`);
  for (const [n, slot] of items.entries()) {
    const label = `Item ${n + 1}`;
    if (slot.kind === "foci") { if (!FOCI_TYPES[slot.fociType]) errors.push(`${label}: pick a Foci type.`); continue; }
    if (slot.kind === "shroud") { if (!SHROUD_TYPES[slot.shroudType]) errors.push(`${label}: pick a Shroud type.`); continue; }
    if (slot.kind === "icon") { if (!FORMS[slot.iconForm]) errors.push(`${label}: pick a Form.`); continue; }
    if (slot.kind === "affix") {
      const a = AFFIXES[slot.affix];
      if (!a) { errors.push(`${label}: pick an Affix.`); continue; }
      if (!rarityOk(a.rarity, rules.maxRarity)) errors.push(`${label}: ${a.label} is above the ${RARITIES[rules.maxRarity]} limit.`);
      if (!targets.some(t => String(t.index) === slot.target)) errors.push(`${label}: put ${a.label} on a picked Foci or Shroud.`);
      continue;
    }
    const table = slot.kind === "armor" ? ARMOR_MATERIALS : WEAPON_MATERIALS;
    const mat = table[slot.material];
    if (!mat) { errors.push(`${label}: pick a material.`); continue; }
    if (!rarityOk(mat.rarity, rules.maxRarity)) errors.push(`${label}: ${mat.label} is above the ${RARITIES[rules.maxRarity]} limit.`);
    const p = slot.kind === "armor"
      ? armorProfile({ weight: slot.weight, material: slot.material, grade: rules.grade }, 10)
      : weaponProfile({ type: slot.type, weight: slot.weight, material: slot.material, grade: rules.grade }, { str: 10, dex: 10 });
    if (!p.valid) errors.push(`${label}: ${p.error}`);
    if (slot.kind === "weapon" && slot.type === "unarmed") errors.push(`${label}: Unarmed comes free; pick a different weapon.`);
    if (slot.kind === "weapon" && slot.extraTypes?.length && !rules.multiType) errors.push(`${label}: starting weapons can't have extra types in this world.`);
  }
  errors.push(...validateTrees(choice.trees, skillPointsFor(rules.statPoints)));
  return errors;
}

/** Skill tree tiers picked at creation, keeping only real trees and whole tiers 0–5. */
export function cleanTrees(trees = {}) {
  const out = {};
  for (const [id, t] of Object.entries(trees ?? {})) {
    const tier = Math.trunc(Number(t) || 0);
    if (skills.treeById(id) && tier > 0) out[id] = Math.min(skills.MAX_TIER, tier);
  }
  return out;
}

/** Problems with the starting skill trees: budget and Theory requirements. */
export function validateTrees(trees, skillPoints) {
  const errors = [];
  const t = cleanTrees(trees);
  const spent = skills.spentPoints(t);
  if (spent > skillPoints) errors.push(`Your skill trees cost ${spent} Skill Points, but you only have ${skillPoints}.`);
  for (const id of Object.keys(t)) {
    const tree = skills.treeById(id);
    if (!skills.isAvailable(t, tree)) errors.push(`${tree.name} needs ${skills.theoryFor(tree.archetype)?.name} Tier ${tree.requires}.`);
  }
  return errors;
}

/** Actor creation data for a validated choice, owned by `userId`. The sheet is locked (no creation mode). */
export function buildActorData(choice, rules, userId) {
  const img = String(choice.img || DEFAULT_IMG);
  const name = String(choice.name).trim();
  const spent = statTotal(choice.stats);
  return {
    name, img, type: "character",
    ownership: { default: 0, [userId]: 3 },
    prototypeToken: { name, actorLink: true, disposition: 1, texture: { src: img } },
    system: {
      stats: { ...emptyStats(), ...choice.stats },
      skillPoints: skillPointsFor(rules.statPoints),
      unspentStats: rules.statPoints - spent,
      statCarry: 0,
      creation: false,
      size: 3,
      trees: cleanTrees(choice.trees)
    },
    items: startingItems(choice.items ?? [], rules),
    flags: { flowstate: { createdBy: userId } }
  };
}

/**
 * The items a new character starts with: Unarmed, the picked weapons/armor/Foci/Shrouds (Affixes go onto their Foci or
 * Shroud), and 20 ammunition per starting ranged weapon (one stack per ammo type, at most 100).
 * The first Foci and the first Shroud start attuned.
 */
export function startingItems(slots, rules) {
  const out = [{
    name: "Unarmed", type: "weapon", img: "icons/skills/melee/unarmed-punch-fist.webp",
    system: { weaponType: "unarmed", weight: "light", material: "", equipped: true, secondHand: true }
  }];
  const affixesOn = index => slots.filter(a => a.kind === "affix" && a.target === String(index) && AFFIXES[a.affix]).map(a => a.affix);
  const ammo = {};
  let fociAttuned = false, shroudAttuned = false, iconAttuned = false;
  for (const [index, slot] of slots.entries()) {
    if (slot.kind === "affix") continue;
    if (slot.kind === "foci") {
      out.push({ name: slotName(slot), type: "foci", img: "icons/weapons/wands/wand-gem-purple.webp",
        system: { fociType: slot.fociType, grade: rules.grade, attuned: !fociAttuned, equipped: false, affixes: affixesOn(index) } });
      fociAttuned = true;
      continue;
    }
    if (slot.kind === "shroud") {
      out.push({ name: slotName(slot), type: "shroud", img: "icons/magic/defensive/shield-barrier-glowing-blue.webp",
        system: { shroudType: slot.shroudType, grade: rules.grade, attuned: !shroudAttuned, affixes: affixesOn(index) } });
      shroudAttuned = true;
      continue;
    }
    if (slot.kind === "icon") {
      out.push({ name: slotName(slot), type: "icon", img: "icons/magic/holy/yin-yang-balance-symbol.webp",
        system: { form: slot.iconForm, grade: rules.grade, attuned: !iconAttuned } });
      iconAttuned = true;
      continue;
    }
    if (slot.kind === "armor") {
      out.push({ name: slotName(slot), type: "armor", system: { weight: slot.weight, material: slot.material, grade: rules.grade, equipped: false } });
      continue;
    }
    const extraTypes = rules.multiType ? slot.extraTypes ?? [] : [];
    out.push({ name: slotName(slot), type: "weapon",
      system: { weaponType: slot.type, weight: slot.weight, material: slot.material, grade: rules.grade, equipped: false, extraTypes } });
    const ammoType = [slot.type, ...extraTypes].find(k => WEAPON_TYPES[k]?.ranged);
    if (ammoType) ammo[ammoType] = Math.min(100, (ammo[ammoType] ?? 0) + STARTING_AMMO);
  }
  for (const [type, quantity] of Object.entries(ammo)) {
    out.push({ name: `${WEAPON_TYPES[type].label} Ammunition`, type: "gear", img: "icons/weapons/ammunition/arrows-bodkin-yellow-red.webp",
      system: { quantity, ammoType: type } });
  }
  return out;
}
