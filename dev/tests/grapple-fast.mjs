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


globalThis.CONFIG = {};
const ab = await import("../../module/abilities.mjs");
const F = () => messages.at(-1).flags.flowstate;
const hero = mkActor("Hero", {}, { "martial-theory": 1, "martial-brawling-methods": 5 });
const orc = mkActor("Orc", {}, { "martial-theory": 1, "martial-brawling-methods": 4 });
const gob = mkActor("Goblin");
const fistsH = mkWeapon(hero, "Unarmed", { weaponType: "unarmed", weight: "light", material: "", equipped: true, secondHand: true });
const fistsO = mkWeapon(orc, "Unarmed", { weaponType: "unarmed", weight: "light", material: "", equipped: true, secondHand: true });
const axe = mkWeapon(gob, "Axe", {}); axe.isOwner = true;
combat.combatant = { actor: hero };
const dexMin = hero.system.derived.effective.dex.min, strMin = hero.system.derived.effective.str.min;
const refill = a => { a.system.ap.value = 6; a.system.rp.value = 6; a.system.energy.value = 200; };
refill(hero); refill(orc);
console.log("== Grapple then Fast follow-up");
game.user.targets = new Set([{ actor: gob }]); refill(hero);
for (const a of [hero, orc, gob]) await actions.setGrapple(a, null);
dialog = c => ({ net: 0, mode: "strike", weight: "light", grapple: true });
seq = [30]; await actions.rollWeaponAttack(hero, fistsH);
const am = messages.at(-1);
ok(am.flags.flowstate.followups?.list?.some(f => f.kind === "fast"), "Light grapple: Fast follow-up offered");
dialog = () => ({ net: 0 }); seq = [2]; await actions.defend(am, 0, "dodge");
ok(gob.getFlag("flowstate", "grappledBy") === hero.uuid && ab.freeFists(hero) === 1, "grapple holds one fist");
const fu = messages.find(m => m.content?.includes("fs-followup"));
dialog = c => ({ net: 0, mode: "strike" }); seq = [30];
const n = messages.length;
await actions.rollWeaponAttack(hero, fistsH, { net: -1, label: "Fast follow-up: other fist (Dis)", weight: "light", kind: "fast", source: am.id, targetActors: [gob] });
ok(messages.length > n, "the other fist's Fast follow-up goes ahead");
// Heavy grapple opening the chain also gets the Fast follow-up.
for (const a of [hero, orc, gob]) await actions.setGrapple(a, null);
refill(hero); dialog = c => ({ net: 0, mode: "strike", weight: "heavy", grapple: true });
seq = [30]; await actions.rollWeaponAttack(hero, fistsH);
{ const l = messages.at(-1).flags.flowstate.followups?.list ?? [];
  ok(!l.some(f => f.kind === "fast") && l.some(f => f.kind === "solitary"), "Heavy grapple: only the Solitary follow-up"); }
// Still grappling: a later Light attack can't use the other fist for a Fast follow-up.
dialog = () => ({ net: 0 }); seq = [2]; await actions.defend(messages.at(-1), 0, "dodge");
refill(hero); dialog = c => ({ net: 0, mode: "strike", weight: "light" });
seq = [30]; await actions.rollWeaponAttack(hero, fistsH);
ok(!(messages.at(-1).flags.flowstate.followups?.list ?? []).some(f => f.kind === "fast"), "later attacks while grappling: no other-fist Fast follow-up");
