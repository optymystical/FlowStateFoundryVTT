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
let fails = 0; const ok2 = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
globalThis.CONFIG = {};
const handlers = {}; globalThis.Hooks = { on: (n, f) => (handlers[n] ??= []).push(f) };
const Mv = await import("../../module/movement.mjs");
Mv.register();
game.settings = { get: (ns, k) => (k === "movementCost" ? mode : false) }; let mode = "enforce";
game.user.id = "u1"; game.user.isGM = false;
globalThis.canvas = { grid: { size: 100, distance: 5, measurePath: pts => ({ distance: (Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) / 100) * 5 }) } };
const hero = mkActor("Hero", { skillPoints: 30, ap: { value: 6, max: 6 } }, {});
hero.setFlag = async (s, k, v) => foundry.utils.setProperty(hero.flags, `${s}.${k}`, v);
hero.unsetFlag = async (s, k) => foundry.utils.setProperty(hero.flags, `${s}.${k}`, undefined);
hero.getFlag = (s, k) => foundry.utils.getProperty(hero.flags, `${s}.${k}`);
hero.system.ap.max = 6;
combat.combatant = { actor: hero };
hero.system.movement = { speed: 30, ap: 2, multiplier: 1 };                  // 2 AP per 30 ft, like the worked example
const token = { id: "t1", name: "Hero", actor: hero, x: 0, y: 0 };
const preMove = (dx, dy = 0) => { const options = {}; const changes = { x: token.x + dx, y: token.y + dy }; const res = (handlers.preUpdateToken ?? []).map(f => f(token, changes, options)); return { options, changes, refused: res.includes(false) }; };
const doMove = async (feet) => { const r = preMove((feet / 5) * 100); if (r.refused) return r; token.x = r.changes.x; for (const f of handlers.updateToken ?? []) await f(token, r.changes, r.options, "u1"); return r; };

console.log("== A turn of movement and an action");
let r = await doMove(30);
ok2(!r.refused && hero.system.ap.value === 4, `Moving 30 ft costs one 2 AP step (AP ${hero.system.ap.value})`);
ok2(actions.openAp(hero) === 0, "…and it's all used: nothing open");
await actions.spendAP(hero, 3, "Cast Spell");
ok2(hero.system.ap.value === 1 && actions.moveLedger(hero).freeFt === 30 && actions.moveLedger(hero).bank === 1, "A 3 AP spell is paid in full, covers 30 ft more movement and banks 1 AP");
r = await doMove(40);
ok2(!r.refused && hero.system.ap.value === 0, `Moving 40 ft: 30 ft are covered, the rest costs the last 1 AP (AP ${hero.system.ap.value})`);
ok2(actions.openAp(hero) === 2, "…and the step stays open: 2 AP shown as open");
r = preMove(800);
ok2(r.refused, "A player can't move further with no AP and nothing covered (Enforce)");
game.user.isGM = true;
r = preMove(800);
ok2(!r.refused && r.options.flowstateMove?.apCost === 2, "The GM may overspend (the AP goes to 0)");
game.user.isGM = false;
mode = "warn"; r = preMove(800);
ok2(!r.refused, "In Warn mode the move goes through");
mode = "off"; r = preMove(800);
ok2(!r.refused && !r.options.flowstateMove, "Off charges nothing");
mode = "enforce";

console.log("== Strafing and exceptions");
hero.system.ap.value = 6; hero.flags.flowstate = {}; token.x = 0;
await doMove(10);
ok2(hero.system.ap.value === 4 && actions.openAp(hero) === 2, "A short move opens a step and leaves its AP open");
await actions.spendAP(hero, 2, "Attack");
ok2(hero.system.ap.value === 4 && actions.openAp(hero) === 0, "An action that fits in it costs nothing more (strafing)");
await doMove(20);
ok2(hero.system.ap.value === 4, "…and the rest of that step's distance is free");
hero.system.ap.value = 6; hero.flags.flowstate = {}; token.x = 0;
await actions.spendAP(hero, 1, "standing up");
ok2(actions.moveLedger(hero).freeFt === 0, "Standing up (a movement itself) doesn't cover movement");
const thrown = {}; const before = hero.system.ap.value;
(handlers.preUpdateToken ?? []).forEach(f => f(token, { x: 900 }, { flowstateThrow: true, ...thrown }));
ok2(hero.system.ap.value === before, "Forced movement (throws, knockback) isn't charged");
combat.combatant = { actor: { uuid: "Actor.Other" } };
r = preMove(500);
ok2(!r.refused && !r.options.flowstateMove, "Only the creature whose turn it is pays");

console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
