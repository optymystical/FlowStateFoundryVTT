// Martial Theory automation: parry, riposte, grapple, break free, throw grappled, stances.
class Field { constructor(o={}){ Object.assign(this,o); } }
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 });
globalThis.foundry = {
  data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field, ObjectField: Field } },
  abstract: { TypeDataModel: class {} },
  utils: { escapeHTML: s => s, deepClone: o => structuredClone(o), getProperty: (o,k)=>k.split(".").reduce((a,b)=>a?.[b],o), setProperty: (o,k,v)=>{const p=k.split(".");let c=o;for(const x of p.slice(0,-1))c=c[x]??={};c[p.at(-1)]=v;} },
  applications: { api: { DialogV2: { prompt: async ({ content }) => dialog(content) } } }
};
globalThis.Roll = class { constructor(f){ this.formula=f; } async evaluate(){ this.total = seq.length ? seq.shift() : 10; return this; } async render(){ return `<roll ${this.formula}=${this.total}>`; } };
globalThis.ChatMessage = { getSpeaker: ({actor}) => ({ alias: actor.name }),
  create: async d => { const m = { id: "m"+messages.length, ...d, getFlag: (s,k) => d.flags?.[s]?.[k] }; messages.push(m); return m; } };
const combat = { id: "C", started: true, round: 1, turn: 0, combatant: null, combatants: [] };
globalThis.game = { settings: { get: () => false }, messages: { find: fn => messages.find(fn), filter: fn => messages.filter(fn), get: id => messages.find(m=>m.id===id) }, combat,
  users: { activeGM: { id: "gm" } }, socket: { emit: (...a) => console.log("  socket emit", JSON.stringify(a[1])) }, user: { targets: new Set(), isGM: false }, actors: [] };
globalThis.ui = { notifications: { warn: m => console.log("  WARN", m), info: m => console.log("  INFO", m), error: m => console.log("  ERR", m) } };
globalThis.canvas = null;
globalThis.fromUuid = async u => uuids.get(u); globalThis.fromUuidSync = u => uuids.get(u);

const { FlowStateActorData, FlowStateWeaponData } = await import("../../module/data.mjs");
const actions = await import("../../module/actions.mjs");
const set = (o, k, v) => foundry.utils.setProperty(o, k, v);
function mkActor(name, extra={}, trees={}) {
  const a = { name, uuid: "Actor."+name, isOwner: true, items: [], statuses: new Set(), flags: {} };
  a.items.get = id => a.items.find(i => i.id === id);
  a.update = async u => { for (const [k,v] of Object.entries(u)) set(a, k, v); };
  a.setFlag = async (s,k,v) => set(a.flags, `${s}.${k}`, v);
  a.getFlag = (s,k) => foundry.utils.getProperty(a.flags, `${s}.${k}`);
  a.unsetFlag = async (s,k) => set(a.flags, `${s}.${k}`, undefined);
  a.toggleStatusEffect = async (id, { active }) => { active ? a.statuses.add(id) : a.statuses.delete(id); };
  a.getActiveTokens = () => [];
  a.system = Object.assign(Object.create(FlowStateActorData.prototype), { stats:{str:30,dex:30,con:30,pon:10,snap:10,will:10,reach:10,grasp:10,build:10}, skillPoints:30, unspentStats:0, statCarry:0, trees, size:3, hp:{value:432,lost:0}, energy:{value:50}, ap:{value:6}, rp:{value:6}, conditions:{ignite:0,stain:0,slow:0,haste:0}, lift:0, daysWithoutRest:0, ...extra }, { parent: a });
  a.system.prepareDerivedData(); uuids.set(a.uuid, a); game.actors.push(a);
  combat.combatants.push({ actor: a });
  return a;
}
function mkWeapon(actor, id, sys) {
  const i = { id, name: id, type: "weapon", uuid: `${actor.uuid}.Item.${id}`, parent: actor, actor };
  i.system = Object.assign(Object.create(FlowStateWeaponData.prototype), { weaponType: "bladed", weight: "light", material: "hardwood", grade: 1, twoHanded: false, equipped: true, secondHand: false, loaded: true, rounds: 1, magazine: 1, wear: 0, ...sys }, { parent: i });
  i.update = async u => { for (const [k,v] of Object.entries(u)) set(i, k, v); i.system.prepareDerivedData(); };
  i.system.prepareDerivedData(); actor.items.push(i); uuids.set(i.uuid, i); return i;
}
const text = m => m.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const ok = (c, msg) => console.log(`  ${c ? "PASS" : "FAIL"} ${msg}`);
globalThis.CONFIG = {}; game.messages.filter = fn => messages.filter(fn);
globalThis.CONFIG = {};
let waitChoice = "quick";
globalThis.foundry.applications.api.DialogV2.wait = async () => waitChoice;
globalThis.foundry.applications.api.DialogV2.confirm = async () => true;
const ab = await import("../../module/abilities.mjs");
const { applyStacks } = await import("../../module/rules.mjs");
const F = () => messages.at(-1).flags.flowstate;
const last = k => [...messages].reverse().find(m => m.flags?.flowstate?.[k]);
function mkArmor(actor, id, weight, limit = 10) {
  const a = { id, name: id, type: "armor", uuid: `${actor.uuid}.Item.${id}`, parent: actor, isOwner: true,
    system: { weight, equipped: true, wear: 0, durability: { value: 200, max: 200 }, profile: { valid: true, limit, focus: null, selfWeakened: 0 } } };
  a.update = async u => { for (const [k,v] of Object.entries(u)) set(a, k, v); a.system.durability.value = 200 - a.system.wear; };
  actor.items.push(a); actor.system.armor = a; uuids.set(a.uuid, a); return a;
}
let confirmed = true; let shown = "";
globalThis.foundry.applications.api.DialogV2.confirm = async ({ content }) => { shown = content; return confirmed; };
game.user.isGM = true;
const hero = mkActor("Hero", {}, { "martial-theory": 3, "martial-bladed-weapons": 2, "martial-dexterity-methods": 1, "martial-strength-methods": 3 });
confirmed = false; await actions.lowerTier(hero, "martial-theory");
ok(hero.system.trees["martial-theory"] === 3 && /Dexterity Methods/.test(shown) && !/Bladed/.test(shown), "prompt lists only the T3 tree; declining changes nothing");
confirmed = true; await actions.lowerTier(hero, "martial-theory");
ok(hero.system.trees["martial-theory"] === 2 && hero.system.trees["martial-dexterity-methods"] === 0 && hero.system.trees["martial-strength-methods"] === 3, "accepted: Theory 2, Dexterity cleared, Strength kept");
shown = ""; await actions.lowerTier(hero, "martial-bladed-weapons");
ok(hero.system.trees["martial-bladed-weapons"] === 1 && !shown, "lowering a normal tree doesn't prompt");
confirmed = true; await actions.lowerTier(hero, "martial-theory"); await actions.lowerTier(hero, "martial-theory");
ok(hero.system.trees["martial-theory"] === 0 && hero.system.trees["martial-bladed-weapons"] === 0 && hero.system.trees["martial-strength-methods"] === 0, "down to 0 clears everything above");
