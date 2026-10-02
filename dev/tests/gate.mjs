class Field { constructor(o={}){ Object.assign(this,o); } }
const hooks = {}; const log = (...a) => console.log(" ", ...a);
globalThis.Hooks = { on: (n, f) => (hooks[n] ??= []).push(f), once: (n, f) => (hooks[n] ??= []).push(f) };
const flatten = (o, p = "") => Object.entries(o).reduce((a, [k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? Object.assign(a, flatten(v, p + k + ".")) : (a[p + k] = v, a)), {});
globalThis.foundry = { data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field } }, abstract: { TypeDataModel: class {} },
  utils: { debounce: f => f, escapeHTML: s => s, deepClone: o => structuredClone(o), flattenObject: flatten, getProperty: (o, k) => k.split(".").reduce((a, b) => a?.[b], o) },
  applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: C => C, DialogV2: {} }, sheets: { ActorSheetV2: class {}, ItemSheetV2: class {} }, apps: { DocumentSheetConfig: { registerSheet() {} } }, instances: new Map() } };
globalThis.canvas = null; globalThis.Actor = class {}; globalThis.Combat = class {}; globalThis.CONFIG = { Actor: {}, Item: {}, Combat: {} };
const warns = []; globalThis.ui = { notifications: { warn: m => warns.push(m), info: () => {} } };
globalThis.game = { combat: null, user: { id: "u", isGM: false }, settings: { get: () => true } };
await import("../../module/flowstate.mjs");
const actions = await import("../../module/actions.mjs");
const run = (hook, ...a) => (hooks[hook] ?? []).map(f => f(...a)).includes(false) ? "BLOCKED" : "allowed";
const check = (label, hook, ...a) => { warns.length = 0; const r = run(hook, ...a); console.log(`  ${label.padEnd(58)} ${r}${r === "BLOCKED" ? `  — ${warns.at(-1) ?? ""}` : ""}`); };

const mkActor = creation => Object.assign(new Actor(), { name: "Hero", type: "character", sheet: null, uuid: "A.h", items: [],
  system: { creation, stats: { str: 10 }, skillPoints: 30, size: 3, unspentStats: 2, statCarry: 0, hp: { value: 100 } } });
const mkItem = actor => ({ parent: actor, actor, type: "weapon", name: "Sword", img: "s.png", sheet: null,
  system: { weaponType: "bladed", weight: "light", material: "iron", grade: 2, equipped: false, twoHanded: false, loaded: true, rounds: 1, magazine: 1, wear: 0, description: "" } });

console.log("== Player, character FINALIZED");
let a = mkActor(false), it = mkItem(a);
check("edit Strength directly", "preUpdateActor", a, { system: { stats: { str: 15 } } }, {});
check("edit Skill Points", "preUpdateActor", a, { "system.skillPoints": 99 }, {});
check("change size", "preUpdateActor", a, { system: { size: 4 } }, {});
check("spend a granted stat point (+ button path)", "preUpdateActor", a, { "system.stats.str": 11, "system.unspentStats": 1 }, { flowstateSpend: true });
check("edit HP (gameplay state)", "preUpdateActor", a, { system: { hp: { value: 50 } } }, {});
check("form resubmits unchanged stat values", "preUpdateActor", a, { system: { stats: { str: 10 }, hp: { value: 40 } } }, {});
check("create a new item from nothing", "preCreateItem", { parent: a }, {}, {});
check("pick up an item (transfer)", "preCreateItem", { parent: a }, {}, { flowstateTransfer: true });
check("rename a weapon", "preUpdateItem", it, { name: "Excalibur" }, {});
check("raise weapon Grade", "preUpdateItem", it, { "system.grade": 5 }, {});
check("repair (clear wear)", "preUpdateItem", Object.assign(it, { system: { ...it.system, wear: 10 } }), { "system.wear": 0 }, {});
check("armor wear from damage (system)", "preUpdateItem", it, { "system.wear": 20 }, { flowstateSystem: true });
check("toggle two-handed (state)", "preUpdateItem", it, { "system.twoHanded": true }, {});
check("delete an item", "preDeleteItem", it, {});
check("drop / throw an item (transfer)", "preDeleteItem", it, { flowstateTransfer: true });

console.log("== Player, character in CREATION");
a = mkActor(true); it = mkItem(a);
check("edit Strength directly", "preUpdateActor", a, { system: { stats: { str: 15 } } }, {});
check("create a new item", "preCreateItem", { parent: a }, {}, {});
check("raise weapon Grade", "preUpdateItem", it, { "system.grade": 5 }, {});
check("delete an item", "preDeleteItem", it, {});

console.log("== GM, finalized character");
game.user.isGM = true; a = mkActor(false); it = mkItem(a);
check("edit Strength", "preUpdateActor", a, { system: { stats: { str: 15 } } }, {});
check("create an item", "preCreateItem", { parent: a }, {}, {});
check("delete an item", "preDeleteItem", it, {});
game.user.isGM = false;

console.log("== Grants (3 stat : 1 skill, carry remainders)");
const g = mkActor(false); g.system.unspentStats = 0; g.system.statCarry = 0;
g.update = async u => { for (const [k, v] of Object.entries(u)) { const key = k.split(".")[1]; g.system[key] = v; } };
for (const [stats, skills] of [[3, null], [2, null], [2, null], [5, 4], [0, 2]]) {
  const r = await actions.grantPoints(g, stats, skills);
  log(`grant ${stats} stat${skills === null ? "" : ` + ${skills} skill`} → +${r.skills} SP | pool ${g.system.unspentStats} stat, SP ${g.system.skillPoints}, carry ${g.system.statCarry}`);
}
console.log("== /grant chat command parsing");
const re = /^\/grant(?:\s+(\d+))?(?:\s+(\d+))?\s*$/i;
for (const t of ["/grant", "/grant 3", "/grant 6 1", "/grant three", "/grantx 3"]) { const m = t.match(re); log(t.padEnd(12), m ? `stats=${m[1] ?? "(dialog)"} skills=${m[2] ?? "auto"}` : "not a grant command"); }
console.log("== Size");
game.user.isGM = true;
check("GM changes a character's size", "preUpdateActor", mkActor(false), { "system.size": 4 }, {});
check("GM changes an NPC's size", "preUpdateActor", Object.assign(mkActor(false), { type: "npc" }), { "system.size": 4 }, {});
check("character form resubmits Size 3 unchanged", "preUpdateActor", mkActor(false), { system: { size: 3, hp: { value: 5 } } }, {});
