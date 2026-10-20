/**
 * The item catalog (pure, no Foundry globals): every item a sheet can be given, and how an item links to its entry.
 *
 * An *entry* says what an item is: { type, name, img, description, rarity, pounds, volume, price, system: { identity fields } }.
 *  - **Generated entries** exist for every valid combination the tables allow (each weapon type × weight × material, each armor weight × material,
 *    every Foci, Shroud, Icon Form and Affix, ammunition for each ranged type, a plain Misc item), built from the tables, so a new material in the
 *    world data has its weapons at once. Their keys spell them out: `weapon.bladed.light.iron`, `armor.heavy.iron`, `foci.rod`, `ammo.rapid`.
 *  - **Named entries** are added by the GM ("Longsword": a Light Bladed in Steel with its own picture, text and weight). Keys start `named.`.
 * The catalog is the store's `items` collection (derived: rebuilt from the tables, then the world's edits and named entries layered on).
 *
 * An *item* (a copy on a sheet, a pile or the sidebar) keeps only what is its own: its Grade, its play state (held, worn, wear, loaded, attuned,
 * quantity...), its name and picture, `system.base` (the entry's key) and `system.overrides` (the GM's changes to this one copy, as
 * [{ path, value }]). When it is prepared, its identity (type, weight, material, description, weight in lb...) is read from the entry with the
 * overrides on top; the identity fields it stores are a copy kept for when its entry is gone.
 */
import { WEAPON_TYPES, WEIGHTS, WEAPON_MATERIALS, ARMOR_WEIGHTS, ARMOR_MATERIALS, RARITIES, rarityKey } from "./martial.mjs";
import { FOCI_TYPES, SHROUD_TYPES, AFFIXES } from "./magic.mjs";
import { FORMS } from "./mental-rules.mjs";

/** The kinds of item, with their default picture. */
export const ITEM_TYPES = {
  weapon: { label: "Weapons", one: "Weapon", img: "icons/weapons/swords/greatsword-crossguard-steel.webp" },
  armor: { label: "Armor", one: "Armor", img: "icons/equipment/chest/breastplate-banded-steel.webp" },
  foci: { label: "Foci", one: "Foci", img: "icons/weapons/wands/wand-gem-purple.webp" },
  shroud: { label: "Shrouds", one: "Shroud", img: "icons/magic/defensive/shield-barrier-glowing-blue.webp" },
  icon: { label: "Icons", one: "Icon", img: "icons/magic/holy/yin-yang-balance-symbol.webp" },
  affix: { label: "Affixes", one: "Affix", img: "icons/commodities/gems/gem-faceted-diamond-blue.webp" },
  gear: { label: "Misc items", one: "Misc item", img: "icons/svg/item-bag.svg" }
};

/** The fields that say what an item of each type is (the rest of an item's data is its own). */
export const IDENTITY = {
  weapon: ["weaponType", "weight", "material", "magazine", "extraTypes"],
  armor: ["weight", "material"],
  foci: ["fociType"],
  shroud: ["shroudType"],
  icon: ["form"],
  affix: ["affix"],
  gear: ["ammoType", "body", "density"]
};
/** What a copy may override (the paths of `system.overrides`): everything but the rarity, which belongs to the entry. */
export const overridable = type => ["description", "pounds", "volume", "price", ...(IDENTITY[type] ?? []).map(k => `system.${k}`)];
/** An entry's identity fields (Unarmed's weight is the default attack weight, chosen on each copy, so it isn't one). */
const identityFields = (type, e) => (IDENTITY[type] ?? []).filter(f => !(f === "weight" && e?.system?.weaponType === "unarmed"));

const WEAPON_IMG = {
  unarmed: "icons/skills/melee/unarmed-punch-fist.webp", bladed: "icons/weapons/swords/greatsword-crossguard-steel.webp",
  balanced: "icons/weapons/staves/staff-animal-bird.webp", swift: "icons/weapons/daggers/dagger-black.webp", striker: "icons/weapons/hammers/hammer-war-spiked.webp",
  defender: "icons/equipment/shield/heater-steel-gray.webp", weighted: "icons/weapons/maces/mace-round-steel.webp", reach: "icons/weapons/polearms/spear-flared-steel.webp",
  circular: "icons/weapons/thrown/boomerang.webp", curved: "icons/weapons/swords/scimitar-guard.webp", thrasher: "icons/weapons/maces/flail-spiked.webp",
  improvised: "icons/weapons/clubs/club-simple-black.webp", rapid: "icons/weapons/bows/shortbow-recurve.webp", assault: "icons/weapons/crossbows/crossbow-simple-brown.webp",
  blast: "icons/weapons/guns/gun-blunderbuss-steel.webp", longshot: "icons/weapons/bows/longbow-recurve.webp"
};
const ARMOR_IMG = { light: "icons/equipment/chest/breastplate-banded-leather-brown.webp", medium: "icons/equipment/chest/breastplate-collared-leather-brown.webp",
  heavy: "icons/equipment/chest/breastplate-banded-steel.webp", titanic: "icons/equipment/chest/breastplate-layered-grey.webp" };
const AMMO_IMG = "icons/weapons/ammunition/arrows-bodkin-yellow-red.webp";

const entry = (type, name, system, extra = {}) => ({ type, name, img: ITEM_TYPES[type].img, description: "", rarity: "common", pounds: null, volume: null, price: null, ...extra, system });
const visible = x => !x?.hidden;

/** Every generated entry, from the tables as they stand. */
export function generateCatalog() {
  const out = {};
  for (const [t, w] of Object.entries(WEAPON_TYPES)) {
    const img = WEAPON_IMG[t] ?? ITEM_TYPES.weapon.img;
    if (t === "unarmed") { out["weapon.unarmed"] = entry("weapon", "Unarmed", { weaponType: t, weight: "light", material: "", magazine: 1, extraTypes: [] }, { img }); continue; }
    for (const [wk, wt] of Object.entries(WEIGHTS)) {
      if (t === "improvised") { out[`weapon.improvised.${wk}`] = entry("weapon", `${wt.label} Improvised`, { weaponType: t, weight: wk, material: "", magazine: 1, extraTypes: [] }, { img }); continue; }
      for (const [mk, m] of Object.entries(WEAPON_MATERIALS)) {
        if (!m.weights?.[wk]) continue;
        out[`weapon.${t}.${wk}.${mk}`] = entry("weapon", `${wt.label} ${w.label} (${m.label})`, { weaponType: t, weight: wk, material: mk, magazine: 1, extraTypes: [] },
          { img, rarity: m.rarity, ...(w.hidden || m.hidden ? { hidden: true } : {}) });
      }
    }
  }
  for (const [wk, wt] of Object.entries(ARMOR_WEIGHTS)) {
    for (const [mk, m] of Object.entries(ARMOR_MATERIALS)) {
      if (!m.weights?.[wk]) continue;
      out[`armor.${wk}.${mk}`] = entry("armor", `${wt.label} Armor (${m.label})`, { weight: wk, material: mk }, { img: ARMOR_IMG[wk] ?? ITEM_TYPES.armor.img, rarity: m.rarity, ...(m.hidden ? { hidden: true } : {}) });
    }
  }
  for (const [k, x] of Object.entries(FOCI_TYPES)) out[`foci.${k}`] = entry("foci", `${x.label} (Foci)`, { fociType: k }, x.hidden ? { hidden: true } : {});
  for (const [k, x] of Object.entries(SHROUD_TYPES)) out[`shroud.${k}`] = entry("shroud", `${x.label} (Shroud)`, { shroudType: k }, x.hidden ? { hidden: true } : {});
  for (const [k, x] of Object.entries(FORMS)) out[`icon.${k}`] = entry("icon", `${x.name} (Icon)`, { form: k }, { rarity: rarityKey(x.rarity), ...(x.hidden ? { hidden: true } : {}) });
  for (const [k, x] of Object.entries(AFFIXES)) out[`affix.${k}`] = entry("affix", x.label, { affix: k }, { rarity: x.rarity ?? "common", ...(x.hidden ? { hidden: true } : {}) });
  for (const [k, w] of Object.entries(WEAPON_TYPES)) if (w.ranged) out[`ammo.${k}`] = entry("gear", `${w.label} Ammunition`, { ammoType: k, body: 0, density: "soft" }, { img: AMMO_IMG, ...(w.hidden ? { hidden: true } : {}) });
  out["gear.misc"] = entry("gear", "Misc item", { ammoType: "", body: 0, density: "soft" });
  return out;
}

/** The live catalog (the store's `items` collection fills it). */
export const ITEM_CATALOG = generateCatalog();

export const isGenerated = key => typeof key === "string" && !key.startsWith("named.");
export const entryOf = key => (key ? ITEM_CATALOG[key] ?? null : null);

/** The generated entry an item's identity matches (null if none: an invalid combination, or a type the tables don't have). */
export function keyFor(type, sys = {}) {
  let key = null;
  if (type === "weapon") key = sys.weaponType === "unarmed" ? "weapon.unarmed" : sys.weaponType === "improvised" ? `weapon.improvised.${sys.weight || "light"}` : `weapon.${sys.weaponType}.${sys.weight}.${sys.material}`;
  else if (type === "armor") key = `armor.${sys.weight}.${sys.material}`;
  else if (type === "foci") key = `foci.${sys.fociType}`;
  else if (type === "shroud") key = `shroud.${sys.shroudType}`;
  else if (type === "icon") key = `icon.${sys.form}`;
  else if (type === "affix") key = `affix.${sys.affix}`;
  else if (type === "gear") key = sys.ammoType ? `ammo.${sys.ammoType}` : "gear.misc";
  return key && ITEM_CATALOG[key]?.type === type ? key : null;
}

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const copy = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
/** Is this a value worth storing as a difference (an empty description isn't)? */
const blankish = v => v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length);

/** An entry with a copy's overrides on top: { ...entry, system: {...} }. Overrides outside what may be overridden are ignored. */
export function resolve(entryValue, overrides = []) {
  if (!entryValue) return null;
  const out = copy(entryValue);
  out.system ??= {};
  const allowed = new Set(overridable(out.type));
  for (const o of Array.isArray(overrides) ? overrides : []) {
    if (!o || typeof o.path !== "string" || !allowed.has(o.path)) continue;
    if (o.path.startsWith("system.")) out.system[o.path.slice(7)] = copy(o.value);
    else out[o.path] = copy(o.value);
  }
  return out;
}

/**
 * Link an item to the catalog: which entry it is (`base`: kept if it still fits, else the generated entry its identity matches) and what about
 * it differs from that entry (`overrides`). `source` is the item's system data, `description` its description. Returns { base, overrides } or
 * null when nothing in the catalog fits it (an unknown type or material).
 */
export function linkFor(type, source = {}, { base = null, description = source.description } = {}) {
  let key = base && ITEM_CATALOG[base]?.type === type ? base : null;
  const generated = keyFor(type, source);
  // A generated entry follows the identity: change the material and it is a different entry. A named entry keeps the difference as an override.
  if (!key || (isGenerated(key) && generated && generated !== key)) key = generated;
  if (!key) return null;
  const e = ITEM_CATALOG[key];
  const overrides = [];
  for (const f of identityFields(type, e)) {
    if (source[f] === undefined) continue;
    if (!same(source[f], e.system?.[f]) && !(blankish(source[f]) && blankish(e.system?.[f]))) overrides.push({ path: `system.${f}`, value: copy(source[f]) });
  }
  if (!blankish(description) && !same(description, e.description)) overrides.push({ path: "description", value: description });
  for (const f of ["pounds", "volume", "price"]) if (source[f] !== undefined && source[f] !== null && !same(source[f], e[f])) overrides.push({ path: f, value: source[f] });
  return { base: key, overrides };
}

/** The item data to create a copy of an entry at a Grade (with any play state the caller adds: equipped, quantity, attuned...). */
export function itemData(key, { grade = 1, name = null, img = null, system = {} } = {}) {
  const e = ITEM_CATALOG[key];
  if (!e) return null;
  const sys = { ...copy(e.system), description: e.description ?? "", base: key, overrides: [], ...system };
  if (e.type !== "gear" && e.type !== "affix" && !(e.type === "weapon" && e.system.weaponType === "unarmed")) sys.grade = Math.max(1, Math.floor(Number(grade) || 1));
  return { name: name ?? e.name, type: e.type, img: img ?? e.img, system: sys };
}

/** What a prepared item reads from its entry: its identity fields, description, rarity, weight, volume and price. Null when the entry is gone. */
export function identityFor(type, base, overrides) {
  const e = base ? ITEM_CATALOG[base] : null;
  if (!e || e.type !== type) return null;
  const r = resolve(e, overrides);
  return { system: Object.fromEntries(identityFields(type, e).filter(f => r.system[f] !== undefined).map(f => [f, r.system[f]])),
    description: r.description ?? "", rarity: r.rarity ?? "common", pounds: num(r.pounds), volume: num(r.volume), price: num(r.price),
    name: e.name, modified: (overrides ?? []).map(o => o?.path).filter(Boolean) };
}
const num = v => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/** Entries to list, filtered: { type, search, rarity, named (only named), hidden (include hidden) }. */
export function listEntries({ type = null, search = "", rarity = "", named = false, hidden = false } = {}) {
  const q = String(search).trim().toLowerCase();
  return Object.entries(ITEM_CATALOG)
    .filter(([k, e]) => (!type || e.type === type) && (hidden || visible(e)) && (!named || !isGenerated(k)) && (!rarity || e.rarity === rarity)
      && (!q || e.name.toLowerCase().includes(q) || k.toLowerCase().includes(q)))
    .map(([key, e]) => ({ key, ...e, named: !isGenerated(key), rarityLabel: RARITIES[e.rarity] ?? e.rarity }));
}

/** A key for a new named entry from its name (unique in the catalog). */
export function namedKey(name, taken = ITEM_CATALOG) {
  const slug = String(name ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "item";
  let key = `named.${slug}`, n = 2;
  while (taken[key]) key = `named.${slug}-${n++}`;
  return key;
}

/** Total weight and volume of a list of items (gear counts its quantity); null parts are left out. */
export function carried(items = []) {
  let pounds = 0, volume = 0, any = false;
  for (const i of items) {
    const s = i?.system ?? {}, q = i?.type === "gear" ? Math.max(0, Number(s.quantity) || 0) : 1;
    if (s.pounds != null) { pounds += s.pounds * q; any = true; }
    if (s.volume != null) { volume += s.volume * q; any = true; }
  }
  return { pounds: Math.round(pounds * 100) / 100, volume: Math.round(volume * 100) / 100, any };
}

/** A line saying what an entry is, for lists (the numbers per Grade; a sheet shows them scaled). */
export function entrySummary(e, tables = {}) {
  const s = e?.system ?? {};
  const { CASTING_FORMS = {}, tagLabel = k => k } = tables;
  if (e?.type === "weapon") {
    const w = WEAPON_TYPES[s.weaponType], row = w?.[s.weaponType === "unarmed" ? "light" : s.weight];
    if (!w || !row) return "";
    const tags = Object.entries(row.tags ?? {}).map(([k, v]) => `${tagLabel(k)}${v === 2 ? "+" : ""}`).join(", ");
    const m = WEAPON_MATERIALS[s.material]?.weights?.[s.weight];
    return [`${WEIGHTS[s.weight]?.label ?? ""} ${w.label}`.trim(), `d${row.die}`, tags, m ? `Dur ${m.dur} · Limit ${m.limit} per Grade` : "", w.ranged ? `${row.range} ft` : ""].filter(Boolean).join(" · ");
  }
  if (e?.type === "armor") {
    const m = ARMOR_MATERIALS[s.material]?.weights?.[s.weight];
    return [`${ARMOR_WEIGHTS[s.weight]?.label ?? ""} armor`, m ? `Dur ${m.dur} · Limit ${m.limit} per Grade` : ""].filter(Boolean).join(" · ");
  }
  if (e?.type === "foci") { const x = FOCI_TYPES[s.fociType]; return x ? [CASTING_FORMS[x.form]?.label ?? x.form, `Dur ${x.dur} · Limit ${x.limit} per Grade`, x.free ? `${x.free > 0 ? "+" : ""}${x.free} Free Affix${Math.abs(x.free) === 1 ? "" : "es"}` : ""].filter(Boolean).join(" · ") : ""; }
  if (e?.type === "shroud") { const x = SHROUD_TYPES[s.shroudType]; return x ? `Dur ${x.dur} · Limit ${x.limit}` : ""; }
  if (e?.type === "icon") { const x = FORMS[s.form]; return x ? `${x.align === "dream" ? "Dream" : "Nightmare"} Form` : ""; }
  if (e?.type === "affix") { const x = AFFIXES[s.affix]; return x ? "Offensive or Defensive" : ""; }
  if (e?.type === "gear") return s.ammoType ? `Ammunition for ${WEAPON_TYPES[s.ammoType]?.label ?? s.ammoType} weapons` : s.body > 0 ? `An object (Body ${s.body})` : "";
  return "";
}
