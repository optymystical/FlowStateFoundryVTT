class Field { constructor(o={}){ Object.assign(this,o); } }
const hooks = {}; const log = (...a) => console.log(" ", ...a);
globalThis.Hooks = { on: (n, f) => (hooks[n] ??= []).push(f), once: (n, f) => (hooks[n] ??= []).push(f) };
let confirmAnswer = true, promptAnswer = null, waitAnswer = null, lastText = "", lastButtons = [];
globalThis.foundry = { data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field } }, abstract: { TypeDataModel: class {} },
  utils: { escapeHTML: s => s, deepClone: o => structuredClone(o), getProperty: (o, k) => k.split(".").reduce((a, b) => a?.[b], o), debounce: f => f, flattenObject: o => o },
  applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: C => C, DialogV2: {
      confirm: async ({ content }) => { lastText = content.replace(/<[^>]+>/g, ""); return confirmAnswer; },
      wait: async ({ content, buttons }) => { lastText = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "); lastButtons = buttons.map(b => b.label); return waitAnswer; },
      prompt: async ({ content }) => { lastText = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "); return promptAnswer; } } },
    sheets: { ActorSheetV2: class {}, ItemSheetV2: class {} }, apps: { DocumentSheetConfig: { registerSheet() {} } }, instances: new Map() } };
globalThis.canvas = null; globalThis.Actor = class {}; globalThis.Combat = class {}; globalThis.CONFIG = { Actor: {}, Item: {}, Combat: {} };
globalThis.ui = { notifications: { warn: m => log("WARN", m), info: m => log("INFO", m) } };
globalThis.game = { combat: null, user: { id: "u" }, settings: { get: () => true } };
await import("../../module/flowstate.mjs");
const pre = (...a) => hooks.preUpdateItem.map(f => f(...a)).includes(false) ? false : undefined;
const tick = () => new Promise(r => setTimeout(r, 5));

function setup({ ap = 6, rp = 6, weapons = [] } = {}) {
  const items = new Map();
  const actor = { uuid: "A.hero", name: "Hero", system: { ap: { value: ap }, rp: { value: rp } } };
  actor.update = async u => { for (const [k, v] of Object.entries(u)) actor.system[k.split(".")[1]].value = v; log("hero.update", JSON.stringify(u)); };
  actor.items = { get: id => items.get(id), find: fn => [...items.values()].find(fn), filter: fn => [...items.values()].filter(fn), reduce: (fn, v) => [...items.values()].reduce(fn, v) };
  for (const [id, sys] of weapons) {
    const it = { id, name: id, type: "weapon", actor, system: { weaponType: "bladed", equipped: false, twoHanded: false, secondHand: false, ...sys } };
    // update runs the real hook first, like Foundry does
    it.update = async (u, o = {}) => { if (pre(it, structuredClone(u), o) === false) return; for (const [k, v] of Object.entries(u)) it.system[k.split(".")[1]] = v; log(`${id} ←`, JSON.stringify(u), o.flowstateAuto ? "(auto)" : o.flowstatePaid ? "(paid)" : ""); };
    it.sheet = null; items.set(id, it);
  }
  game.combat = { started: true, combatants: [{ actor }], combatant: { actor } };
  return { actor, items };
}
const held = items => [...items.values()].filter(i => i.system.equipped || i.system.secondHand).map(i => i.id + (i.system.weaponType === "unarmed" ? `(${(i.system.equipped?1:0)+(i.system.secondHand?1:0)} fists)` : "")).join(", ");

console.log("== Draw into empty hand (fists up): 1 RP, fists lowered to make room");
let t = setup({ weapons: [["fists", { weaponType: "unarmed", equipped: true, secondHand: true }], ["sword", {}]] });
await t.items.get("sword").update({ "system.equipped": true }); await tick();
log("dialog:", lastText.trim()); log("RP", t.actor.system.rp.value, "AP", t.actor.system.ap.value, "| held:", held(t.items));

console.log("== Hands full of weapons (sword + dagger), draw axe: swap for 1 AP, choose dagger");
t = setup({ weapons: [["sword", { equipped: true }], ["dagger", { equipped: true }], ["axe", {}]] });
promptAnswer = "dagger";
await t.items.get("axe").update({ "system.equipped": true }); await tick();
log("dialog:", lastText.trim().slice(0, 120)); log("RP", t.actor.system.rp.value, "AP", t.actor.system.ap.value, "| held:", held(t.items));

console.log("== Swap to a two-handed weapon while holding two: both get put away");
t = setup({ weapons: [["sword", { equipped: true }], ["dagger", { equipped: true }], ["greatsword", { twoHanded: true }]] });
promptAnswer = "sword";
await t.items.get("greatsword").update({ "system.equipped": true }); await tick();
log("AP", t.actor.system.ap.value, "| held:", held(t.items));

console.log("== Swap attempted off-turn: blocked (needs AP)");
t = setup({ weapons: [["sword", { equipped: true, twoHanded: true }], ["axe", {}]] }); game.combat.combatant = { actor: { uuid: "other" } };
await t.items.get("axe").update({ "system.equipped": true }); await tick();

console.log("== Draw off-turn into a free hand: allowed for 1 RP");
t = setup({ weapons: [["sword", { equipped: true }], ["axe", {}]] }); game.combat.combatant = { actor: { uuid: "other" } };
await t.items.get("axe").update({ "system.equipped": true }); await tick();
log("RP", t.actor.system.rp.value, "| held:", held(t.items));

console.log("== Cancel the draw dialog: nothing spent");
t = setup({ weapons: [["axe", {}]] }); confirmAnswer = false;
await t.items.get("axe").update({ "system.equipped": true }); await tick();
log("RP", t.actor.system.rp.value, "| held:", held(t.items) || "(nothing)"); confirmAnswer = true;

console.log("== Out of combat: drawing is free, swapping still asks what to put away (free)");
t = setup({ weapons: [["sword", { equipped: true, twoHanded: true }], ["axe", {}]] }); game.combat = null; promptAnswer = "sword";
await t.items.get("axe").update({ "system.equipped": true }); await tick();
log("dialog:", lastText.trim().slice(0, 80)); log("RP", t.actor.system.rp.value, "AP", t.actor.system.ap.value, "| held:", held(t.items));

console.log("== Putting away is free");
t = setup({ weapons: [["sword", { equipped: true }]] });
await t.items.get("sword").update({ "system.equipped": false }); await tick();
log("RP", t.actor.system.rp.value, "AP", t.actor.system.ap.value);

console.log("== In combat, your turn: unequip sword -> Stow for 1 AP");
t = setup({ weapons: [["sword", { equipped: true }]] }); waitAnswer = "stow";
await t.items.get("sword").update({ "system.equipped": false }); await tick();
log("buttons:", lastButtons.join(" | ")); log("AP", t.actor.system.ap.value, "| held:", held(t.items) || "(nothing)");

console.log("== Off-turn: only Drop is offered");
t = setup({ weapons: [["sword", { equipped: true }]] }); game.combat.combatant = { actor: { uuid: "other" } }; waitAnswer = "drop";
await t.items.get("sword").update({ "system.equipped": false }); await tick();
log("buttons:", lastButtons.join(" | "), "| text:", lastText.trim().slice(0, 90));

console.log("== Cancel: stays held, nothing spent");
t = setup({ weapons: [["sword", { equipped: true }]] }); waitAnswer = "cancel";
await t.items.get("sword").update({ "system.equipped": false }); await tick();
log("AP", t.actor.system.ap.value, "| held:", held(t.items));

console.log("== Out of combat: stowing is free, no dialog");
t = setup({ weapons: [["sword", { equipped: true }]] }); game.combat = null; lastButtons = [];
await t.items.get("sword").update({ "system.equipped": false }); await tick();
log("dialog shown:", lastButtons.length > 0, "| held:", held(t.items) || "(nothing)");
