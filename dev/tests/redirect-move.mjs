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


globalThis.CONST = {};
globalThis.CONFIG = { Canvas: { polygonBackends: { move: { testCollision: () => null } } } };
const moves = [];
globalThis.canvas = { grid: { size: 100, distance: 5, isGridless: false,
  measurePath: ([p, q]) => ({ distance: Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)) / 20 }), getCenterPoint: o => o },
  dimensions: { size: 100, distance: 5, sceneX: 0, sceneY: 0, sceneWidth: 10000, sceneHeight: 10000 }, tokens: { controlled: [], placeables: [] }, scene: {} };
function place(actor, gx, gy) {
  const doc = { x: gx * 100, y: gy * 100, width: 1, height: 1, isOwner: true, uuid: actor.uuid + ".Token", update: async u => { Object.assign(doc, u); moves.push([actor.name, u.x / 100, u.y / 100]); } };
  const tok = { id: actor.name, name: actor.name, actor, document: doc, get center() { return { x: doc.x + 50, y: doc.y + 50 }; } };
  actor.getActiveTokens = () => [tok]; canvas.tokens.placeables.push(tok); return tok;
}
const orc = mkActor("Orc", {}, { "martial-theory": 1, "martial-brawling-methods": 4 });
const gob = mkActor("Goblin"); const hero = mkActor("Hero"); const imp = mkActor("Imp");
mkWeapon(orc, "Unarmed", { weaponType: "unarmed", weight: "light", material: "", equipped: true, secondHand: true });
place(gob, 10, 10); place(orc, 11, 10); place(hero, 20, 10); place(imp, 12, 10);   // goblin attacks orc from the west; imp sits east of the orc
combat.combatant = { actor: gob };
game.user.targets = new Set([{ actor: orc }]);
const gobOpts = { label: "Axe", net: 0, melee: true, damage: "2d10", type: "physical", stacks: 0, physical: true, shots: 1, notes: [], followups: [] };
seq = [10]; await actions.performAttack(gob, gobOpts);
orc.isOwner = true; dialog = () => ({ net: 0 }); seq = [20]; await actions.defend(messages.at(-1), 0, "dodge");
const rd = messages.at(-1);
console.log("== Redirect into the far-away hero (forced movement)");
game.user.targets = new Set([{ actor: hero }]);
seq = [18]; await actions.redirect(rd);
console.log("  moves:", JSON.stringify(moves));
const [, hx, hy] = moves.at(-1) ?? [];
ok(moves.length === 1 && Math.max(Math.abs(hx - 11), Math.abs(hy - 10)) === 1, `hero pulled next to the orc at (${hx},${hy})`);
ok(Math.max(Math.abs(hx - 10), Math.abs(hy - 10)) <= 1, "and within the goblin's reach");
ok(!(hx === 12 && hy === 10) && !(hx === 10 && hy === 10), "not onto an occupied space");
ok(text(messages.at(-1)).includes("forced next to Orc"), "card notes the forced move");
console.log("== Already adjacent: no move");
seq = [10]; game.user.targets = new Set([{ actor: orc }]); await actions.performAttack(gob, gobOpts);
seq = [20]; await actions.defend(messages.at(-1), 0, "dodge");
moves.length = 0; game.user.targets = new Set([{ actor: imp }]);
seq = [18]; await actions.redirect(messages.at(-1));
ok(moves.length === 0 && messages.at(-1).flags.flowstate.attack.targets[0].name === "Imp", "imp already adjacent: redirected without moving");
