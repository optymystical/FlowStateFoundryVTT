// Mental Wonders: Life, Death, Order, Chaos, Beyond and Below (their Modes, Tenets and abilities, through the real attack exchange).
class Field { constructor(o={}){ Object.assign(this,o); } }
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 }); let confirmAnswer = true; let waitAnswer = "ap";
globalThis.foundry = {
  data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field, ObjectField: Field } },
  abstract: { TypeDataModel: class {} },
  utils: { escapeHTML: s => s, deepClone: o => structuredClone(o), getProperty: (o,k)=>k.split(".").reduce((a,b)=>a?.[b],o), setProperty: (o,k,v)=>{const p=k.split(".");let c=o;for(const x of p.slice(0,-1))c=c[x]??={};c[p.at(-1)]=v;} },
  applications: { api: { DialogV2: { prompt: async ({ content }) => dialog(content), confirm: async () => confirmAnswer, wait: async () => waitAnswer } } }
};
globalThis.Roll = class { constructor(f){ this.formula=f; } async evaluate(){ this.total = seq.length ? seq.shift() : 10; return this; } async render(){ return `<roll ${this.formula}=${this.total}>`; } };
globalThis.ChatMessage = { getSpeaker: ({actor}) => ({ alias: actor.name }),
  create: async d => { const m = { id: "m"+messages.length, ...d, getFlag: (s,k) => m.flags?.[s]?.[k], setFlag: async (s,k,v) => { m.flags ??= {}; (m.flags[s] ??= {})[k] = v; }, update: async u => { for (const [k, v] of Object.entries(u)) foundry.utils.setProperty(m, k, v); } }; messages.push(m); return m; } };
const combat = { id: "C", started: true, round: 1, turn: 0, combatant: null, combatants: [] };
globalThis.game = { settings: { get: () => false }, messages: { find: fn => messages.find(fn), filter: fn => messages.filter(fn), get: id => messages.find(m=>m.id===id) }, combat,
  users: Object.assign([{ id: "gm", isGM: true }], { activeGM: { id: "gm" } }), socket: { emit: (...a) => console.log("  socket emit", JSON.stringify(a[1])) }, user: { targets: new Set(), isGM: false }, actors: [] };
globalThis.ui = { notifications: { warn: m => console.log("  WARN", m), info: m => console.log("  INFO", m), error: m => console.log("  ERR", m) } };
globalThis.canvas = null;
globalThis.fromUuid = async u => uuids.get(u); globalThis.fromUuidSync = u => uuids.get(u);

const { FlowStateActorData, FlowStateWeaponData, FlowStateShroudData, FlowStateFociData, FlowStateIconData } = await import("../../module/data.mjs");
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

const ab = await import("../../module/abilities.mjs");
globalThis.canvas = null;

console.log("== Resisting with Martial stat checks");
const base = { value: 16, die: 32, min: 5 };
let r = ab.resistCheck(base, { unstoppable: true });
ok2(r.value === 32 && r.die === 64 && r.net === 1 && !r.auto, "Unstoppable: the stat counts twice (d64 instead of d32) and the roll has Advantage");
r = ab.resistCheck(base, { pureBody: true, target: 7 });
ok2(r.die === 64 && r.net === 0 && r.auto, "Pure Body: stat counts twice, and a target under half the stat (7 < 8) is an automatic success");
r = ab.resistCheck(base, { pureBody: true, target: 8 });
ok2(!r.auto, "…8 is not under half of 16");
r = ab.resistCheck(base, { unstoppable: true, pureBody: true });
ok2(r.value === 64 && r.die === 128 && r.net === 1, "Both together multiply: the stat counts four times as high");
r = ab.resistCheck(base, {});
ok2(r.die === 32 && r.net === 0 && !r.auto, "Neither: a normal check");

const hero = mkActor("Hero", {}, { "martial-constitution-methods": 3, "martial-strength-methods": 5 });
// Dialog answers: an options object per check.
let answers = [];
foundry.applications.api.DialogV2.prompt = async () => answers.shift() ?? { net: 0, applyMin: false };
seq = [20]; answers = [{ net: 0, applyMin: false, pureBody: true, target: 7 }];
messages.length = 0; await actions.rollStatCheck(hero, "con");
ok2(/Automatic success/.test(text(messages.at(-1))), "A Constitution check with Pure Body against a low target is an automatic success (no roll)");
seq = [20]; answers = [{ net: 0, applyMin: false, pureBody: true, target: 0 }];
messages.length = 0; await actions.rollStatCheck(hero, "con");
ok2(/Pure Body: stat counts twice/.test(text(messages.at(-1))) && text(messages.at(-1)).includes(`d${2 * hero.system.derived.effective.con.die}`), "Resisting with Pure Body rolls the doubled die");
seq = [20]; answers = [{ net: 0, applyMin: false }];
messages.length = 0; await actions.rollStatCheck(hero, "pon");
ok2(text(messages.at(-1)).includes("d" + hero.system.derived.effective.pon.die + ")") && !/Pure Body|Unstoppable/.test(text(messages.at(-1))), "Mind and Spirit stat checks have no resisting options");
await hero.toggleStatusEffect("unstoppable", { active: true });
seq = [20]; answers = [{ net: 0, applyMin: false, unstoppable: true }];
messages.length = 0; await actions.rollStatCheck(hero, "str");
ok2(/Unstoppable: Advantage/.test(text(messages.at(-1))) && text(messages.at(-1)).includes(`d${2 * hero.system.derived.effective.str.die}`), "While Unstoppable, a Strength check can resist with Advantage and a doubled stat");

console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
