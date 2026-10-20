// The item catalog: generated and named entries, linking items to them (old items included), overrides, and the data models reading from it.
import { installFoundry } from "./support/foundry.mjs";
installFoundry({ roll: () => 10, messages: [], uuids: new Map() });
await import("../../module/store-catalog.mjs");
const S = await import("../../module/store.mjs");
const C = await import("../../module/catalog.mjs");
const { FlowStateWeaponData, FlowStateGearData, FlowStateShroudData } = await import("../../module/data.mjs");
let fails = 0; const ok = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const keys = Object.keys(C.ITEM_CATALOG);
const count = t => Object.values(C.ITEM_CATALOG).filter(e => e.type === t).length;

console.log("== Generated entries");
ok(count("weapon") > 400 && count("armor") >= 40 && count("foci") === 16 && count("shroud") === 12 && count("icon") === 14 && count("affix") === 20, `Every combination is there (${count("weapon")} weapons, ${count("armor")} armor, the 16 Foci, 12 Shrouds, 14 Forms, 20 Affixes)`);
const ironHeavy = C.ITEM_CATALOG["weapon.bladed.heavy.iron"];
ok(ironHeavy?.name === "Heavy Bladed (Iron)" && ironHeavy.rarity === "common" && ironHeavy.system.material === "iron", "A weapon entry is named like a starting item (Heavy Bladed (Iron)) and takes its material's rarity");
ok(!C.ITEM_CATALOG["weapon.bladed.heavy.hardwood"] && !C.ITEM_CATALOG["armor.titanic.cloth"], "No entries for combinations the tables can't make (Hardwood only comes Light, Cloth only as Light armor)");
ok(C.ITEM_CATALOG["weapon.unarmed"] && C.ITEM_CATALOG["weapon.improvised.heavy"] && C.ITEM_CATALOG["ammo.longshot"]?.system.ammoType === "longshot" && C.ITEM_CATALOG["gear.misc"], "Unarmed, Improvised, ammunition for each ranged type, and a plain Misc item");
ok(keys.filter(k => k.startsWith("weapon.") && k !== "weapon.unarmed").every(k => C.keyFor("weapon", C.ITEM_CATALOG[k].system) === k), "Every weapon entry's identity leads back to its own key");

console.log("== Linking items to entries");
const legacy = { weaponType: "reach", weight: "light", material: "steel", magazine: 1, extraTypes: [], grade: 3, description: "" };
ok(C.linkFor("weapon", legacy)?.base === "weapon.reach.light.steel" && !C.linkFor("weapon", legacy).overrides.length, "An old item matches its generated entry, with nothing different");
let link = C.linkFor("weapon", { ...legacy, weaponType: "assault", weight: "heavy", material: "iron", magazine: 3, description: "<p>Grandpa's gun.</p>" });
ok(link.base === "weapon.assault.heavy.iron" && link.overrides.some(o => o.path === "system.magazine" && o.value === 3) && link.overrides.some(o => o.path === "description"), "What the GM changed on it (3 shots per reload, its own text) is kept as overrides");
ok(C.linkFor("weapon", { ...legacy, material: "nope" }) === null, "Nothing in the catalog fits an unknown material");
link = C.linkFor("weapon", { ...legacy, material: "iron", weight: "heavy", description: "Mine." }, { base: "weapon.reach.light.steel" });
ok(link.base === "weapon.reach.heavy.iron" && link.overrides.length === 1, "A generated entry follows a change to what it is (Heavy Iron is a different entry); the copy's own text stays");
ok(C.keyFor("gear", { ammoType: "rapid" }) === "ammo.rapid" && C.keyFor("gear", {}) === "gear.misc" && C.keyFor("shroud", { shroudType: "bastion" }) === "shroud.bastion", "Ammunition, Misc items and Shrouds match too");

console.log("== Named entries (the world's own)");
let data = S.withEntry({}, "items", "named.longsword", { type: "weapon", name: "Longsword", img: "x.webp", description: "A long sword.", rarity: "uncommon", pounds: 3, volume: 0.5, price: 15,
  system: { weaponType: "bladed", weight: "light", material: "steel", magazine: 1, extraTypes: [] } });
let res = S.applyWorldData(data);
ok(!res.problems.length && C.ITEM_CATALOG["named.longsword"]?.name === "Longsword" && C.ITEM_CATALOG["weapon.bladed.light.steel"], "A named entry joins the catalog beside the generated ones");
link = C.linkFor("weapon", { weaponType: "bladed", weight: "light", material: "iron", magazine: 1, extraTypes: [] }, { base: "named.longsword", description: "A long sword." });
ok(link.base === "named.longsword" && link.overrides.length === 1 && link.overrides[0].path === "system.material", "A copy of a named entry keeps it, with the change (Iron) as an override");
const id = C.identityFor("weapon", "named.longsword", [{ path: "system.material", value: "iron" }, { path: "price", value: 20 }, { path: "rarity", value: "veryRare" }, { path: "system.grade", value: 99 }]);
ok(id.system.material === "iron" && id.price === 20 && id.pounds === 3 && id.rarity === "uncommon" && !("grade" in id.system), "Overrides apply on top of the entry; the rarity and the Grade can't be overridden");
res = S.applyWorldData(S.withEntry(data, "items", "named.bad", { type: "spaceship", name: "Bad", system: {} }));
ok(!C.ITEM_CATALOG["named.bad"] && /unknown item type/.test(res.problems.join()), "A named entry of an unknown kind is left out");
res = S.applyWorldData(S.withEntry(data, "items", "named.half", { type: "armor", name: "Half", system: { weight: "light" } }));
ok(!C.ITEM_CATALOG["named.half"] && /missing material/.test(res.problems.join()), "…and so is one missing what it is");
ok(C.namedKey("Longsword") === "named.longsword-2" && C.namedKey("Brand New!") === "named.brand-new", "New named keys come from the name and don't clash");

console.log("== The catalog follows the tables");
data = S.withEntry(data, "weaponMaterials", "duskSteel", { label: "Dusk Steel", rarity: "rare", weights: { light: { dur: 50, limit: 10 } }, effect: "", mods: {} });
data = S.withEntry(data, "items", "weapon.bladed.heavy.iron", { pounds: 2, img: "iron.webp" });
data = S.withHidden(data, "weaponMaterials", "glass");
S.applyWorldData(data);
ok(C.ITEM_CATALOG["weapon.swift.light.duskSteel"]?.rarity === "rare", "A new material has a weapon of every type at once");
ok(C.ITEM_CATALOG["weapon.bladed.heavy.iron"].pounds === 2 && C.ITEM_CATALOG["weapon.bladed.heavy.iron"].img === "iron.webp" && C.ITEM_CATALOG["weapon.bladed.heavy.iron"].name === "Heavy Bladed (Iron)", "Edits to a generated entry (its weight, picture) layer on after it is made again");
ok(C.ITEM_CATALOG["weapon.bladed.light.glass"]?.hidden && !C.listEntries({ type: "weapon" }).some(e => e.key === "weapon.bladed.light.glass") && C.listEntries({ type: "weapon", hidden: true }).some(e => e.key === "weapon.bladed.light.glass"), "Hiding a material hides its weapons from the lists (they still work)");
ok(C.listEntries({ type: "weapon", named: true }).map(e => e.key).join() === "named.longsword" && C.listEntries({ search: "dusk" }).length >= 14, "Lists filter by kind, named entries and search");
S.applyWorldData({});
ok(!C.ITEM_CATALOG["weapon.swift.light.duskSteel"] && !C.ITEM_CATALOG["named.longsword"] && C.ITEM_CATALOG["weapon.bladed.heavy.iron"].pounds === null, "Clearing the world data takes the catalog back to the system's");

console.log("== Items read their identity from the entry");
const mk = (Cls, src) => Object.assign(Object.create(Cls.prototype), foundry.utils.deepClone(src));
const old = { weaponType: "bladed", weight: "light", material: "hardwood", grade: 2, magazine: 1, extraTypes: [], description: "Old notes.", equipped: true };
let src = foundry.utils.deepClone(old);
FlowStateWeaponData.migrateData(src, {});
ok(src.base === "weapon.bladed.light.hardwood" && src.overrides.length === 1 && src.overrides[0].path === "description", "An item made before the catalog is linked as it loads, its notes kept as an override");
const part = { material: "steel" };
FlowStateWeaponData.migrateData(part, { partial: true });
ok(!("base" in part), "A partial update isn't touched");
S.applyWorldData(S.withEntry({}, "items", "weapon.bladed.light.hardwood", { pounds: 4, description: "Catalog text." }));
let w = mk(FlowStateWeaponData, { ...src, material: "softwood" });                 // its stored copy says Softwood, the entry says Hardwood
w.prepareBaseData();
ok(w.material === "hardwood" && w.pounds === 4 && w.description === "Old notes." && w.catalog.found && w.catalog.name === "Light Bladed (Hardwood)", "Prepared, it is its entry (Hardwood, 4 lb) with its own notes on top");
w = mk(FlowStateWeaponData, { ...src, overrides: [] });
w.prepareBaseData();
ok(w.description === "Catalog text.", "…and without them it shows the entry's text");
w = mk(FlowStateWeaponData, { ...src, base: "named.gone", material: "copper" });
w.prepareBaseData();
ok(!w.catalog.found && w.material === "copper", "If its entry is gone it keeps working from its own copy");
const unarmed = mk(FlowStateWeaponData, { weaponType: "unarmed", weight: "heavy", material: "", base: "weapon.unarmed", overrides: [] });
unarmed.prepareBaseData();
ok(unarmed.weight === "heavy", "Unarmed keeps its own default attack weight");
const ammo = { quantity: 20, ammoType: "rapid" };
FlowStateGearData.migrateData(ammo, {});
ok(ammo.base === "ammo.rapid", "Ammunition made by the wizard links to its entry");
const sh = { shroudType: "aegis", grade: 1, description: "" };
FlowStateShroudData.migrateData(sh, {});
ok(sh.shroudType === "bulwark" && sh.base === "shroud.bulwark", "Renamed Shroud types are renamed first, then linked");
S.applyWorldData({});

console.log("== Making and carrying items");
const made = C.itemData("weapon.reach.heavy.iron", { grade: 4.7, system: { equipped: true } });
ok(made.system.base === "weapon.reach.heavy.iron" && made.system.grade === 4 && made.system.equipped && made.system.weaponType === "reach" && made.name === "Heavy Reach (Iron)", "A copy is its entry at a Grade, with any state added");
ok(!("grade" in C.itemData("ammo.rapid").system) && !("grade" in C.itemData("weapon.unarmed").system), "Ammunition and Unarmed have no Grade");
ok(JSON.stringify(C.carried([{ type: "weapon", system: { pounds: 3, volume: 0.5 } }, { type: "gear", system: { quantity: 20, pounds: 0.05, volume: null } }, { type: "armor", system: { pounds: null } }])) === JSON.stringify({ pounds: 4, volume: 0.5, any: true }), "Carried weight and volume add up (a stack counts its quantity)");
ok(/d12/.test(C.entrySummary(C.ITEM_CATALOG["weapon.bladed.heavy.iron"])) && /Dur 30/.test(C.entrySummary(C.ITEM_CATALOG["weapon.bladed.light.hardwood"])), "Each entry has a one-line summary for the lists");

console.log("== Editing an item keeps it linked");
const flat = (o, pre = "") => Object.entries(o ?? {}).reduce((acc, [k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? Object.assign(acc, flat(v, `${pre}${k}.`)) : Object.assign(acc, { [`${pre}${k}`]: v })), {});
foundry.utils.flattenObject = o => flat(o);
foundry.utils.expandObject = o => { const out = {}; for (const [k, v] of Object.entries(o)) foundry.utils.setProperty(out, k, v); return out; };
const handlers = {}; globalThis.Hooks = { on: (n, fn) => (handlers[n] ??= []).push(fn), once: () => {} };
(await import("../../module/items.mjs")).register();
const relink = (item, changes) => { for (const fn of handlers.preUpdateItem) fn(item, changes, {}); return changes; };
const prepared = (Cls, type, src) => { const sys = mk(Cls, src); sys.prepareBaseData(); return { type, system: sys }; };
let it = prepared(FlowStateWeaponData, "weapon", { weaponType: "bladed", weight: "heavy", material: "iron", magazine: 1, extraTypes: [], grade: 2, base: "weapon.bladed.heavy.iron", overrides: [], description: "" });
let ch = relink(it, { system: { material: "steel" } });
ok(ch.system.base === "weapon.bladed.heavy.steel" && !ch.system.overrides.length, "The GM switching a generated weapon to Steel links it to the Steel entry");
ch = relink(it, { system: { equipped: true } });
ok(!("base" in ch.system), "Picking it up (state, not what it is) leaves the link alone");
ch = relink(it, { "system.pounds": 6 });
ok(ch.system.base === "weapon.bladed.heavy.iron" && ch.system.overrides.length === 1 && ch.system.overrides[0].path === "pounds", "Setting its weight on the sheet keeps the difference on this copy");
S.applyWorldData(S.withEntry({}, "items", "named.claymore", { type: "weapon", name: "Claymore", img: "c.webp", description: "Big.", rarity: "uncommon", pounds: 5, volume: 1, price: 30,
  system: { weaponType: "bladed", weight: "heavy", material: "steel", magazine: 1, extraTypes: [] } }));
it = prepared(FlowStateWeaponData, "weapon", { weaponType: "bladed", weight: "heavy", material: "copper", magazine: 1, extraTypes: [], grade: 2, base: "named.claymore", overrides: [], description: "" });
ok(it.system.material === "steel" && it.system.description === "Big.", "A copy of a named entry reads the entry, whatever its stored copy says");
ch = relink(it, { system: { description: "Notched blade." } });
ok(ch.system.base === "named.claymore" && ch.system.overrides.length === 1 && ch.system.overrides[0].value === "Notched blade.", "Changing its text keeps it a Claymore, with this copy's text (and no stray differences from its stale stored copy)");
S.applyWorldData({});


console.log("== Named items in the character wizard");
{
  const CR = await import("../../module/creation.mjs");
  const named = (key, type, name, rarity, system) => [key, { type, name, img: "x.webp", description: "", rarity, pounds: null, volume: null, price: null, system }];
  let wd = {};
  for (const [k, v] of [named("named.longbow", "weapon", "Elven Longbow", "uncommon", { weaponType: "longshot", weight: "light", material: "hardwood", magazine: 1, extraTypes: [] }),
    named("named.plate", "armor", "Royal Plate", "rare", { weight: "heavy", material: "iron" }), named("named.vest", "armor", "Padded Vest", "common", { weight: "light", material: "cloth" }),
    named("named.rope", "gear", "Rope", "common", { ammoType: "", body: 0, density: "soft" })]) wd = S.withEntry(wd, "items", k, v);
  S.applyWorldData(wd);
  const rules = { ...CR.DEFAULT_RULES, grade: 4, maxRarity: "uncommon" };
  const allowed = CR.allowedNamed("uncommon");
  ok(allowed["named.longbow"] && allowed["named.vest"] && !allowed["named.plate"] && !allowed["named.rope"], "Named items within the rarity limit can be picked (not Rare plate, not a Misc item)");
  const slots = [CR.newSlot("named", "uncommon"), { kind: "named", key: "named.vest" }];
  slots[0].key = "named.longbow";
  const choice = { name: "Ash", stats: { ...CR.emptyStats(), str: 10 }, items: slots, trees: {} };
  ok(!CR.validate(choice, rules).some(e => /Item/.test(e)), "A pick of them is valid");
  ok(CR.validate({ ...choice, items: [...slots, { kind: "armor", weight: "light", material: "cloth" }] }, rules).some(e => /at most one armor/.test(e)), "A named armor counts toward the one armor");
  ok(CR.validate({ ...choice, items: [{ kind: "named", key: "named.plate" }] }, rules).some(e => /above the Uncommon limit/.test(e)), "…and one above the limit is refused");
  const made = CR.startingItems(slots, rules);
  const bow = made.find(i => i.system?.base === "named.longbow");
  ok(bow && bow.name === "Elven Longbow" && bow.system.grade === 4 && made.some(i => i.type === "gear" && i.system.ammoType === "longshot" && i.system.quantity === 20), "It starts as a copy of the entry at the starting Grade, with ammunition for a ranged one");
  S.applyWorldData({});
}

console.log("== Rarities");
{ const MT = await import("../../module/martial.mjs");
  ok(MT.rarityKey("very rare") === "veryRare" && MT.rarityKey("Very Rare") === "veryRare" && MT.rarityKey("veryRare") === "veryRare" && MT.rarityKey("") === "common" && MT.rarityKey(null) === "common", "Rarity names however they're written ('very rare', an Icon Form's) give their key");
  ok(MT.rarityRank("common") === 0 && MT.rarityRank("very rare") === 3 && MT.rarityRank("nonsense") === 0, "…and their place in the order (unknown counts as Common)"); }

console.log(fails ? `\n${fails} FAILED` : "\nAll catalog checks passed");
if (fails) process.exit(1);
