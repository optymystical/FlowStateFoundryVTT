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
globalThis.foundry.applications.api.DialogV2.confirm = async () => true;
const ab = await import("../../module/abilities.mjs");
const F = () => messages.at(-1).flags.flowstate;
const hero = mkActor("Hero", {}, { "martial-theory": 1, "martial-swift-weapons": 5 });
const orc = mkActor("Orc");
const kn1 = mkWeapon(hero, "Knife", { weaponType: "swift", weight: "light", material: "hardwood", grade: 3 });
const kn2 = mkWeapon(hero, "Dirk", { weaponType: "swift", weight: "light", material: "hardwood", grade: 3 });
const axe = mkWeapon(orc, "Axe", { weaponType: "striker", weight: "light", material: "hardwood" });
combat.id = "C"; combat.round = 1; combat.turn = 0; combat.combatant = { actor: hero };
const refill = a => { a.system.ap.value = 6; a.system.rp.value = 6; a.system.energy.value = 500; };
refill(hero); refill(orc);
const sm = ab.scalingMin(kn1);

console.log("== Quick Strike on a Fast Swift set");
game.user.targets = new Set([{ actor: orc }]);
let seen = ""; dialog = c => { seen = c; return { mode: "strike", net: 0, stacks: 0, quickStrike: true }; };
seq = [25]; await actions.rollWeaponAttack(hero, kn1);
const root = messages.at(-1);
ok(seen.includes("Quick Strike") && /Advantage/.test(text(root)) && F().attack.opts.swift && hero.system.energy.value === 500 - Math.floor(sm / 2), "Quick Strike: Advantage, ½ Scaling Stat min, marked Swift");
ok(F().followups.list.some(f => f.kind === "fast" && f.quickStrike && f.net === 0), "Dirk Fast+ follow-up carries Quick Strike");
orc.isOwner = true; dialog = () => ({ net: 0 }); seq = [5]; await actions.defend(root, 0, "dodge");
dialog = () => ({ extra: 0 }); seq = [3]; await actions.rollExchangeDamage(messages.at(-1));
dialog = () => ({ mode: "strike", net: 0, stacks: 0 });
seq = [25]; await actions.rollWeaponAttack(hero, kn2, { net: 0, label: "Fast follow-up: Dirk", kind: "fast", quickStrike: true, source: root.id });
const fu = messages.at(-1);
ok(/Quick Strike/.test(text(fu)) && /Advantage/.test(text(fu)), "follow-up gets Advantage free");
dialog = () => ({ net: 0 }); seq = [5]; await actions.defend(fu, 0, "dodge");
dialog = () => ({ extra: 0 }); seq = [3]; await actions.rollExchangeDamage(messages.at(-1));
await actions.postReadyFollowups(fu);
const card = messages.find(m => m.flags?.flowstate?.flurryCard?.set === fu.id);
ok(!!card && card.content.includes("Knife") && card.content.includes("Dirk"), "Blade Flurry card offers each held Swift weapon");

console.log("== Blade Flurry chains");
refill(hero);
dialog = () => ({ mode: "strike", net: 0, stacks: 0 });
seq = [25]; await actions.bladeFlurry(card, kn1.id);
ok(hero.system.rp.value === 6 - kn1.system.profile.ap && hero.system.energy.value === 500 - sm, "costs RP = attack AP and Scaling Stat min");
ok(F().followups?.list?.some(f => f.kind === "fast"), "the Flurry attack offers a new Fast follow-up (chain)");
await actions.bladeFlurry(card, kn1.id);

console.log("== Eviscerate");
refill(hero);
const hits = actions.swiftDamageThisTurn(hero);
console.log("   logged Swift hits:", hits.map(h => h.toHp));
ok(hits.length === 2 && actions.eviscerateBlocked(hero) === "", "two damaging Swift hits logged; Eviscerate available");
const hp0 = orc.system.hp.value;
await actions.eviscerate(hero);
ok(orc.system.hp.value === hp0 - hits.reduce((n, h) => n + h.toHp, 0) && hero.system.energy.value === 500 - 2 * sm, "repeats the damage (bypassing armor) for 2× Scaling Stat min");
ok(actions.eviscerateBlocked(hero) === "Already used this turn.", "once per turn");

console.log("== Cut Back after a dodge");
combat.combatant = { actor: orc }; combat.turn = 1; refill(hero);
game.user.targets = new Set([{ actor: hero }]);
seq = [5]; await actions.performAttack(orc, { label: "Axe", net: 0, melee: true, damage: "2d10", type: "physical", stacks: 0, physical: true, shots: 1, notes: [], followups: [] });
hero.isOwner = true; dialog = () => ({ net: 0 }); seq = [20]; await actions.defend(messages.at(-1), 0, "dodge");
const dd = messages.at(-1);
ok(dd.content.includes("fs-cut-back"), "Cut Back offered after a successful dodge");
dialog = c => c.includes('name="item"') ? { item: "Knife" } : { mode: "strike", net: 0, stacks: 0 };
seq = [18]; await actions.cutBack(dd);
ok(F().attack.targets[0].name === "Orc" && hero.system.rp.value === 6 - kn1.system.profile.ap && hero.system.energy.value === 500, "Riposte with the Knife: RP = AP, no Energy");
ok(F().followups?.list?.some(f => f.kind === "fast"), "Cut Back enables Fast follow-ups");

console.log("== Delta");
const key = "C:1:0";
console.log("   Swift hits in hero's turn:", actions.swiftHitsInTurn(hero, key));
hero.system.rp.value = 0;
await actions.delta(hero, key);
ok(hero.system.rp.value === 0, "fewer than 12 hits: no RP");
