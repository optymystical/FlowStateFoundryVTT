// Ignite and the Stain variants: stacking rules, end-of-turn ticks, armor-held stacks, removal.
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

const { FlowStateActorData, FlowStateWeaponData, FlowStateShroudData, FlowStateFociData } = await import("../../module/data.mjs");
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
let fails = 0; const ok2 = (c, m) => { ok(c, m); if (!c) fails++; };
const R = await import("../../module/rules.mjs");

console.log("== Stack rules");
const c0 = { ignite: 5, stain: 4, solid: 3, searing: 0, frozen: 0, electric: 0 };
ok2(R.addStacks(c0, "stain", 2).stain === 6 && R.addStacks(c0, "ignite", 3).ignite === 8, "Normal stacks add");
const s1 = R.addStacks(c0, "searing", 7);
ok2(s1.searing === 7 && s1.stain === 0 && s1.solid === 0 && s1.frozen === 0 && s1.electric === 0, "Searing overrides the other Stain types");
ok2(R.addStacks({ ...c0, frozen: 2 }, "electric", 4).frozen === 0 && R.addStacks({ ...c0, frozen: 2 }, "electric", 4).electric === 4, "Electric overrides Frozen");
ok2(R.igniteTotal({ ignite: 5, searing: 3 }) === 8 && R.stainTotal({ stain: 1, solid: 2, searing: 3, frozen: 4, electric: 5 }) === 15, "Searing counts as both Ignite and Stain");
const fz = R.freezeStains({ stain: 3, solid: 2, searing: 0, frozen: 1, electric: 0 }, 4);
ok2(fz.frozen === 10 && fz.stain === 0 && fz.solid === 0, "Freezing converts every Stain (plus the new ones) to Frozen");
const t = R.tickAmounts({ ignite: 4, stain: 3, solid: 2, searing: 5, frozen: 6, electric: 7 });
ok2(t.heat === 9 && t.acid === 3 + 2 + 5 + 6 && t.radiation === 7 && t.energy === 6, "Per-turn ticks: Searing is 1 heat + 1 acid per stack, Frozen also drains Energy");

console.log("== End of turn");
const A = mkActor("Victim", { energy: { value: 50 }, conditions: { ignite: 10, stain: 0, slow: 0, haste: 0, solid: 0, searing: 4, frozen: 6, electric: 5 } });
A.getFlag = (s, k) => k === "electricBy" ? "Actor.Caster" : undefined;
const hp0 = A.system.hp.value;
messages.length = 0;
await actions.endOfTurn(A);
ok2(A.system.hp.value === hp0 - (10 + 4) - (4 + 6) - 5, `Heat 14, Acid 10, Radiation 5 (HP ${hp0} → ${A.system.hp.value})`);
ok2(A.system.energy.value === 44, "Frozen Stains drain 6 Energy");
ok2(A.system.conditions.electric === 0, "Electric Stains are used up");
ok2(messages.some(m => /Pass them on/.test(m.content)), "The caster is offered a chance to pass them on");
ok2(A.system.conditions.searing === 4 && A.system.conditions.ignite === 10, "Searing and Ignite stay until removed");

console.log("== Stacks on whatever is damaged");
const B = mkActor("Wearer");
const armor = { id: "ar", name: "Plate", type: "armor", uuid: "Actor.Wearer.Item.ar", isOwner: true, system: { profile: { valid: true, limit: 10 }, broken: false, durability: { value: 50, max: 50 }, wear: 0, conditions: { ignite: 0, stain: 0, solid: 0, searing: 0, frozen: 0, electric: 0 } } };
armor.update = async u => { for (const [k, v] of Object.entries(u)) set(armor, k, v); };
B.system.armor = armor;
let line = await actions.giveStacks(B, "ignite", 12, { outcome: { toHp: 0, armorLoss: 5 } });
ok2(armor.system.conditions.ignite === 12 && /Plate/.test(line), "Damage the armor absorbed: the Ignite goes on the armor");
line = await actions.giveStacks(B, "stain", 7, { outcome: { toHp: 3, armorLoss: 5 } });
ok2(B.system.conditions.stain === 7, "Damage that reached HP: the Stain goes on the creature");
line = await actions.giveStacks(B, "searing", 4, { first: true });
ok2(armor.system.conditions.searing === 4, "With no damage the armor is hit first");
armor.system.wear = 0; messages.length = 0;
B.system.conditions.slow = 0; B.system.conditions.haste = 0;
await actions.endOfTurn(B);
ok2(armor.system.wear >= 12 + 4 * 2, `The armor's own stacks wear it down (wear ${armor.system.wear})`);

console.log("== Removal");
B.system.ap.value = 6; B.system.conditions.solid = 3; armor.system.conditions.solid = 2;
combat.combatant = { actor: B };
await actions.clearCondition(B, "solid");
ok2(B.system.ap.value === 0 && B.system.conditions.solid === 0 && armor.system.conditions.solid === 0, "Solid Stains take 6 AP to remove (creature and armor)");
B.system.conditions.electric = 3; B.system.ap.value = 6;
await actions.clearCondition(B, "electric");
ok2(B.system.conditions.electric === 3 && B.system.ap.value === 6, "Electric Stains can't be removed");

console.log(fails ? `\n${fails} FAILED` : "\nAll stain checks passed");
if (fails) process.exit(1);
