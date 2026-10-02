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
game.settings.get = (m, k) => k === "requireAmmo" ? true : false;
let fails = 0; const ok2 = (c, m) => { ok(c, m); if (!c) fails++; };
const mkGear = (actor, id, sys) => { const i = { id, name: id, type: "gear", uuid: `${actor.uuid}.Item.${id}`, parent: actor, system: { quantity: 1, ammoType: "", ...sys } };
  i.update = async u => { for (const [k, v] of Object.entries(u)) set(i, k, v); }; actor.items.push(i); return i; };
const shooter = mkActor("Shooter", {}, { "martial-theory": 1 });
const foe = mkActor("Foe");
const gun = mkWeapon(shooter, "Carbine", { weaponType: "assault", weight: "light", material: "hardwood", grade: 3, rounds: 0, magazine: 3 });
const refill = a => { a.system.ap.value = 6; a.system.rp.value = 6; };
console.log("== Ammunition");
refill(shooter);
await actions.reloadWeapon(shooter, gun);
ok2(gun.system.rounds === 0 && shooter.system.rp.value === 6, "no ammunition: can't reload (no RP spent)");
const box = mkGear(shooter, "Assault Rounds", { ammoType: "assault", quantity: 2 });
mkGear(shooter, "Arrows", { ammoType: "longshot", quantity: 50 });
await actions.reloadWeapon(shooter, gun);
ok2(gun.system.rounds === 2 && box.system.quantity === 0 && shooter.system.rp.value === 5, "reload loads what's left (2 of 3) from matching ammo only");
box.system.quantity = 10; refill(shooter);
await actions.reloadWeapon(shooter, gun);
ok2(gun.system.rounds === 3 && box.system.quantity === 9, "tops up to the magazine (3)");
game.user.targets = new Set([{ actor: foe }]); dialog = () => ({ net: 0, stacks: 0, mode: "r1" }); seq = [20];
await actions.rollWeaponAttack(shooter, gun);
ok2(gun.system.rounds === 2 && gun.system.loaded, "each attack uses one loaded shot");
ok2(actions.ammoCount(shooter, "assault") === 9 && actions.ammoCount(shooter, "longshot") === 50, "ammo counted per type");

console.log("== Multi-type attack");
const gb = mkWeapon(shooter, "Gunblade", { weaponType: "bladed", extraTypes: ["assault"], weight: "light", material: "hardwood", grade: 3, rounds: 1, magazine: 1, equipped: true });
gun.system.equipped = false; gun.system.prepareDerivedData();
shooter.system.trees["martial-theory"] = 5; refill(shooter);
let asked = "";
dialog = c => { if (/attack as|Weapon type/.test(c)) { asked = c; return { type: "assault" }; } return { net: 0, stacks: 0, mode: "r1" }; };
seq = [20]; await actions.rollWeaponAttack(shooter, gb);
const o = messages.at(-1).flags.flowstate.attack.opts;
ok2(/Bladed/.test(asked) && /Assault/.test(asked) && o.attackType === "assault" && gb.system.rounds === 0, "Weapon Master: choose the type; Assault fires and uses its loaded shot");
shooter.system.trees["martial-theory"] = 1; refill(shooter); asked = "";
dialog = c => { if (/Weapon type/.test(c)) asked = c; return { net: 0, stacks: 0, mode: "strike" }; };
seq = [20]; await actions.rollWeaponAttack(shooter, gb);
ok2(!asked && messages.at(-1).flags.flowstate.attack.opts.attackType === "bladed", "without T5: main type only, no prompt");
process.exit(fails ? 1 : 0);
