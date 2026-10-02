class Field { constructor(o={}){ Object.assign(this,o); } }
const log = (...a) => console.log(" ", ...a);
let dialogAnswer = null, confirmAnswer = true, lastDialog = "";
globalThis.foundry = { data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field } }, abstract: { TypeDataModel: class {} },
  utils: { escapeHTML: s => s, deepClone: o => structuredClone(o), mergeObject: (a, b) => { for (const k in b) a[k] = (typeof b[k] === "object" && a[k]) ? { ...a[k], ...b[k] } : b[k]; return a; } },
  applications: { api: { DialogV2: { prompt: async ({ content }) => { lastDialog = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); return dialogAnswer; }, confirm: async () => confirmAnswer } } } };
globalThis.ui = { notifications: { warn: m => log("WARN", m), info: m => log("INFO", m), error: m => log("ERR", m) } };
globalThis.canvas = { tokens: { controlled: [] } };
globalThis.game = { user: { isGM: true, targets: new Set() }, settings: { get: k => k !== "enforceRange" }, combat: null };
const actions = await import("../../module/actions.mjs");
actions.GM_ACTIONS.deletePile = async () => log("pile removed (empty)");

function setup(ap) {
  const items = new Map();
  const hero = { uuid: "A.hero", name: "Hero", isOwner: true, system: { ap: { value: ap }, derived: { size: { melee: 5 } } } };
  hero.update = async u => { if ("system.ap.value" in u) hero.system.ap.value = u["system.ap.value"]; log("hero.update", JSON.stringify(u)); };
  hero.items = { get: id => items.get(id), find: fn => [...items.values()].find(fn), filter: fn => [...items.values()].filter(fn), reduce: (fn, v) => [...items.values()].reduce(fn, v) };
  const add = (id, name, system) => { const it = { id, name, type: "weapon", system: { ...system } };
    it.update = async (u, o) => { for (const [k, v] of Object.entries(u)) it.system[k.split(".")[1]] = v; log(`${name}.update`, JSON.stringify(u), o?.flowstateAuto ? "(auto, no cost)" : ""); }; items.set(id, it); return it; };
  hero.createEmbeddedDocuments = async (t, [d]) => [add("new", d.name, d.system)];
  add("fists", "Unarmed", { weaponType: "unarmed", equipped: true, secondHand: false });
  add("sword", "Sword", { weaponType: "bladed", equipped: true, twoHanded: false });
  const pileItem = { id: "p1", name: "Spear", type: "weapon", toObject: () => ({ name: "Spear", type: "weapon", system: { weaponType: "reach", equipped: false } }), delete: async () => { pile.items.delete("p1"); } };
  const pile = { id: "P1", items: new Map([["p1", pileItem]]) };
  canvas.tokens.controlled = [{ actor: hero }];
  game.combat = { started: true, combatants: [{ actor: hero }], combatant: { actor: hero } };
  return { hero, pile, pileItem, items };
}

console.log("== In combat, hands full (Sword + fist): equip Spear, putting the Sword away");
let t = setup(3); dialogAnswer = { equip: "yes", replace: "sword" };
await actions.pickUp(t.pile, t.pileItem);
log("dialog said:", lastDialog);
log("AP left:", t.hero.system.ap.value, "| Sword held:", t.items.get("sword").system.equipped, "| Spear held:", t.items.get("new").system.equipped);

console.log("== Equip, lowering the fist instead");
t = setup(3); dialogAnswer = { equip: "yes", replace: "fist" };
await actions.pickUp(t.pile, t.pileItem);
log("fist up:", t.items.get("fists").system.equipped, "| Sword held:", t.items.get("sword").system.equipped, "| Spear held:", t.items.get("new").system.equipped);

console.log("== Keep it stowed");
t = setup(3); dialogAnswer = { equip: "no" };
await actions.pickUp(t.pile, t.pileItem);
log("AP left:", t.hero.system.ap.value, "| Spear held:", t.items.get("new").system.equipped);

console.log("== Cancel the dialog: nothing happens");
t = setup(3); dialogAnswer = null;
await actions.pickUp(t.pile, t.pileItem);
log("AP left:", t.hero.system.ap.value, "| still in pile:", t.pile.items.size === 1);

console.log("== No AP left");
t = setup(0); await actions.pickUp(t.pile, t.pileItem);

console.log("== Not your turn");
t = setup(3); game.combat.combatant = { actor: { uuid: "someone-else" } }; await actions.pickUp(t.pile, t.pileItem);

console.log("== Out of combat: free");
t = setup(3); game.combat = null; dialogAnswer = { equip: "no" };
await actions.pickUp(t.pile, t.pileItem); log("AP untouched:", t.hero.system.ap.value);
