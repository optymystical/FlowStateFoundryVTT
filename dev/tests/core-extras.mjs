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
const S = await import("../../module/spells.mjs");
const C = await import("../../module/casting.mjs");
const FX = await import("../../module/spellfx.mjs");
const formulas = [];
globalThis.Roll = class { constructor(f){ this.formula=f; formulas.push(f); } async evaluate(){ this.total = seq.length ? seq.shift() : 10; return this; } async render(){ return `<roll ${this.formula}=${this.total}>`; } };

function mkFoci(actor, id, sys) {
  const i = { id, name: id, type: "foci", uuid: `${actor.uuid}.Item.${id}`, parent: actor, actor, isOwner: true };
  i.system = Object.assign(Object.create(FlowStateFociData.prototype), { fociType: "rod", grade: 3, attuned: true, equipped: true, twoHanded: false, wear: 0, affixes: [], element: "heat", chosenSpell: "", ...sys }, { parent: i });
  actor.items.push(i); uuids.set(i.uuid, i); actor.system.prepareDerivedData(); return i;
}
// Active Effects on mock actors: created, updated and deleted like Foundry's, re-deriving the actor each time.
function addEffects(a) {
  a.effects = [];
  a.effects.get = id => a.effects.find(e => e.id === id);
  a.createEmbeddedDocuments = async (type, docs) => docs.map(d => {
    const e = { id: `E${a.name}${a.effects.length}`, disabled: false, statuses: new Set(), parent: a, ...structuredClone(d) };
    e.uuid = `${a.uuid}.ActiveEffect.${e.id}`;
    e.update = async u => { for (const [k, v] of Object.entries(u)) set(e, k, v); a.system.prepareDerivedData(); };
    e.delete = async () => { a.effects.splice(a.effects.indexOf(e), 1); a.system.prepareDerivedData(); };
    a.effects.push(e); uuids.set(e.uuid, e); a.system.prepareDerivedData(); return e;
  });
  return a;
}

function mkIcon(actor, id, sys) {
  const i = { id, name: id, type: "icon", uuid: `${actor.uuid}.Item.${id}`, parent: actor, actor, isOwner: true };
  i.system = Object.assign(Object.create(FlowStateIconData.prototype), { form: "aegis", grade: 3, attuned: true, tenet: "", chosen: "physical", ...sys }, { parent: i });
  i.update = async u => { for (const [k, v] of Object.entries(u)) set(i, k, v); actor.system.prepareDerivedData(); };
  actor.items.push(i); uuids.set(i.uuid, i); actor.system.prepareDerivedData(); return i;
}
const M = await import("../../module/mental.mjs");
const W = await import("../../module/wonders.mjs");
const R = await import("../../module/mental-rules.mjs");
const stats = { str: 10, dex: 10, con: 10, pon: 30, snap: 25, will: 30, reach: 10, grasp: 10, build: 10 };
const mTrees = { "mental-theory": 2, "mental-life-dream": 5, "mental-death-nightmare": 5, "mental-order-dream": 5, "mental-chaos-nightmare": 5, "mental-beyond-dream": 5, "mental-below-nightmare": 5 };
const hero = addEffects(mkActor("Seer", { stats, skillPoints: 30, energy: { value: 200 } }, { ...mTrees }));
const orc = addEffects(mkActor("Orc", { skillPoints: 30 }, {}));
const ally = addEffects(mkActor("Ally", { skillPoints: 30 }, {}));
combat.combatants.length = 0; combat.combatants.push({ actor: hero }, { actor: orc }, { actor: ally }); combat.combatant = { actor: hero };
const refresh = () => { hero.system.ap.value = 6; hero.system.rp.value = 6; hero.system.energy.value = 200; };
const target = a => { game.user.targets = new Set(a ? [{ actor: a, name: a.name, document: {} }] : []); };
const lastAtk = () => messages.filter(m => m.flags?.flowstate?.attack).at(-1);
const last = () => messages.at(-1);
const flag = (a, k) => a.getFlag("flowstate", k);


const effs = (a, k) => a.effects.filter(e => e.flags.flowstate.spellEffect?.kind === k);
const clearAll = a => { a.effects.splice(0, a.effects.length); a.system.prepareDerivedData(); };
/** Manifest at the Orc, it fails to dodge: returns the defense card. */
async function hit(mode, extra = {}, atk = 20) {
  refresh(); target(orc); seq = [atk];
  await M.manifest(hero, { mode, range: "ranged", ...extra });
  seq = [2]; await actions.defend(lastAtk(), 0, "dodge");
  return messages.filter(m => m.flags?.flowstate?.defense).at(-1);
}
const reset = () => { clearAll(orc); clearAll(hero); orc.system.hp.value = 432; orc.system.hp.lost = 0; orc.system.conditions = { ignite: 0, stain: 0, slow: 0, haste: 0, solid: 0, searing: 0, frozen: 0, electric: 0 }; for (const k of Object.keys(orc.flags)) delete orc.flags[k]; orc.system.lift = 0; orc.system.prepareDerivedData?.(); };


const { FlowStateGearData } = await import("../../module/data.mjs");
const { putSpellEffect } = actions;
const RU = await import("../../module/rules.mjs");
const G = await import("../../module/gravity.mjs");
const F = await import("../../module/forging.mjs");
const CH = await import("../../module/charges.mjs");
const W2 = await import("../../module/wonders-b.mjs");
const setting = { gravity: 1, igniteSpread: true };
game.settings.get = (s, k) => setting[k] ?? false;
game.time = { worldTime: 1000 };

console.log("== Pure rules");
ok2(RU.objectStats(10, "soft").durability === 20 && RU.objectStats(10, "soft").limit === 2 && RU.objectStats(10, "dense").limit === 10, "Object stats: Body × density (Soft: 2× Durability, 0.25× Limit)");
ok2(RU.objectCrit(10, 10) && !RU.objectCrit(9, 10) && RU.objectCrit(10, 0, 1), "Attacking an object: a crit at or above its Body (Grade × 10 without one)");
ok2(RU.gravityForce({ gravity: 1, maxHp: 100, rounds: 1, size: 3 }) === 100 && RU.gravityForce({ gravity: 1, maxHp: 100, rounds: 5, size: 3 }) === 200 && RU.gravityForce({ gravity: 0.5, maxHp: 100, rounds: 1, size: 3 }) === 50, "Gravity Force: Max HP × G, growing to Terminal Velocity (2 rounds at Size 3)");
ok2(RU.fallFeet(100, 30) === 7 && RU.liftBand(100, 100) === "full" && RU.liftBand(50, 100) === "slow" && RU.liftBand(10, 100) === "none", "Falling feet (Lift off, ÷10) and the Lift bands");

console.log("== Attacking an object");
const crate = { name: "Crate", type: "pile", uuid: "Actor.Crate", isOwner: true, items: [], flags: {}, system: {}, statuses: new Set() };
const gear = { id: "g1", name: "Crate", type: "gear", uuid: "Actor.Crate.Item.g1", parent: crate, isOwner: true };
gear.system = Object.assign(Object.create(FlowStateGearData.prototype), { quantity: 1, ammoType: "", body: 10, density: "soft", wear: 0 }, { parent: gear });
gear.system.prepareDerivedData(); crate.items.push(gear); crate.items.find = fn => crate.items.filter(fn)[0];
gear.update = async u => { for (const [k, v] of Object.entries(u)) set(gear, k, v); gear.system.prepareDerivedData(); };
uuids.set(crate.uuid, crate); uuids.set(gear.uuid, gear);
ok2(gear.system.isObject && gear.system.durability.max === 20, "A gear item with a Body is an object");
refresh(); game.user.targets = new Set([{ actor: crate, name: "Crate", document: {} }]);
seq = [4, 5];
await actions.performAttack(hero, { stealth: "none", push: false, damage: "1d6", type: "physical", stacks: 0, physical: false, shots: 1, critStacks: 0, pierce: 0, bash: 0, knockback: 0, followups: [], label: "Smash", net: 0, melee: true, notes: [] });
const oc = messages.at(-1);
ok2(/takes 5/.test(text(oc)) && gear.system.wear === 5 && /Hit/.test(text(oc)), "An object always hits and its Durability takes the damage (Limit ignored)");
seq = [30, 20]; gear.system.wear = 0; gear.system.prepareDerivedData(); gear.system.durability.value = 20;
await actions.performAttack(hero, { stealth: "none", push: false, damage: "1d6", type: "physical", stacks: 0, physical: false, shots: 1, critStacks: 0, pierce: 0, bash: 0, knockback: 0, followups: [], label: "Smash", net: 0, melee: true, notes: [] });
ok2(/Critical Hit/.test(text(messages.at(-1))) && gear.system.wear > 5, "A roll at or above its Body crits (Strengthened damage)");

console.log("== Falling and flight");
const f1 = addEffects(mkActor("Faller", { skillPoints: 30 }, {}));
f1.system.hp.max = 100; f1.system.hp.value = 100;
f1.system.prepareDerivedData(); const max1 = f1.system.hp.max;
await G.startFalling(f1, "test");
ok2(G.isFalling(f1), "Starting to fall sets the Falling status");
dialog = () => "";
messages.length = 0; await G.turnStart(f1);
const gf = RU.gravityForce({ gravity: 1, maxHp: f1.system.hp.max, rounds: 1, size: f1.system.size });
ok2(/falls \d+ ft/.test(text(messages.at(-1))) && G.isFalling(f1), `Each turn it accrues Gravity Force (${gf}) and falls (ground unknown: still falling)`);
dialog = () => "0"; const hp0 = f1.system.hp.value; messages.length = 0;
await G.turnStart(f1);
ok2(!G.isFalling(f1) && f1.system.hp.value < hp0, "When the ground is reached the leftover distance hits as Force damage and the fall ends");
await G.startFalling(f1); await G.stabilize(f1);
ok2(!G.isFalling(f1), "Stabilizing (3 RP) stops it");
const flyer = addEffects(mkActor("Flyer", { skillPoints: 30 }, {})); flyer.system.lift = 50; flyer.system.hp.max = 100;
confirmAnswer = false; await G.flightCheck(flyer, "Hit");
ok2(G.isFalling(flyer), "A flyer who doesn't stabilize begins falling");

console.log("== Ignite Spread");
const burner = addEffects(mkActor("Burner", { skillPoints: 30 }, {}));
burner.system.conditions.ignite = 50; burner.system.hp.pain = 100; messages.length = 0;
await actions.igniteSpread(burner, 50);
ok2(burner.system.conditions.ignite === 55, "Ignite grows by 10% a turn");
burner.system.conditions.ignite = 100; seq = [3, 7];
await actions.igniteSpread(burner, 100);
ok2(/north|east|south|west/.test(text(messages.at(-1))) && /10 Ignite/.test(text(messages.at(-1))), "At the limit it spreads twice with a d8 each, 10% per tile");
burner.flags.flowstate = { ignitePutOut: true }; burner.system.conditions.ignite = 50;
await actions.igniteSpread(burner, 50);
ok2(burner.system.conditions.ignite === 50, "It doesn't grow when they tried to put it out");

console.log("== Mental follow-ups");
clearAll(orc); clearAll(hero); reset();
await putSpellEffect(orc, { kind: "irradiated", stack: true, caster: hero.uuid, name: "Irr", extra: 1, healDown: 3 });
orc.system.hp.value = 300; orc.flags.flowstate = { lossLog: [{ at: 1e15, n: 100 }] };
hero.flags.flowstate = { turnStartedAt: 0 };
await W.runAct({ id: "mortalCoil", caster: hero.uuid, target: orc.uuid, mode: "x", power: 3, mult: 1 }).catch(() => {});
const healed = await (async () => { orc.system.hp.value = 300; await import("../../module/arcana.mjs"); return 0; })();
ok2((await import("../../module/arcana.mjs")).healingDown(orc) === 3, "Irradiate (Enhanced) reduces healing by its amount (Restore, Renewal)");
ok2(W2.blocked(orc, "ignite") === false, "(nothing is warded yet)");
await putSpellEffect(orc, { kind: "wardOff", caster: hero.uuid, name: "Cleansed", blocks: ["ignite"] });
ok2(W2.blocked(orc, "ignite") && !W2.blocked(orc, "stain"), "Second Wind (Enhanced) wards a condition off");
const g1 = await actions.giveStacks(orc, "ignite", 10, {});
ok2(/can't be applied/.test(g1) && !orc.system.conditions.ignite, "…and it can't be applied again");

reset(); clearAll(hero);
const madeItems = []; hero.createEmbeddedDocuments = async (t, docs) => { madeItems.push(...docs); return docs; };
hero.system.trees["mental-creation-dream"] = 5; hero.system.trees["mental-theory"] = 5;
dialog = () => ({ kind: "weapon", type: "bladed", weight: "light", material: "ironwood", name: "Rite Blade", willing: true });
const riteDone = await W.runAct({ id: "create", caster: hero.uuid, target: hero.uuid, mode: "mental-creation-dream:forge", enhanced: false, range: "ranged", rite: true });
const rite = F.riteOf(hero);
ok2(riteDone && rite && !rite.ready && rite.hours === 2 && !madeItems.some(i => i.name === "Rite Blade"), "A Rite takes hours (2 for a Common item) and makes nothing yet");
game.time.worldTime = 1000 + 3 * 3600;
ok2(F.riteOf(hero).ready, "…once the hours have passed it's ready");
await F.finishRite(hero);
ok2(madeItems.some(i => i.name === "Rite Blade" && !i.flags?.flowstate?.made) && !F.riteOf(hero), "Finishing the Rite makes the item permanent");

console.log("== Decree and Fracture on a damage roll");
reset(); clearAll(hero); clearAll(orc);
await putSpellEffect(orc, { kind: "charge", stack: true, caster: hero.uuid, name: "Decree", charge: "decree", sign: "plus", enhanced: false });
dialog = html => ({ replace: html.match(/<option value="([^"]+)">Decree/)?.[1] });
const dd = await CH.onDamage({ actor: orc, formula: "2d6+3", totals: [11] });
ok2(dd?.totals?.[0] === 8 && CH.formulaMax("2d6+3") === 15, "Decree makes a damage roll half its top result (15 → 7) plus 1");
await putSpellEffect(orc, { kind: "charge", stack: true, caster: hero.uuid, name: "Fracture", charge: "fracture", sign: "plus", size: "up", enhanced: false });
formulas.length = 0; seq = [9];
dialog = html => ({ replace: html.match(/<option value="([^"]+)">Fracture/)?.[1] });
const fr = await CH.onDamage({ actor: orc, formula: "2d6+3", totals: [11] });
ok2(CH.shiftFormula("2d6+3", 2) === "2d8+3" && fr?.totals?.[0] === 9 && formulas.includes("2d8+3"), "Fracture rerolls the damage with every die size +2");

console.log(fails ? `\n${fails} FAILED` : "\nAll core extras checks passed");
if (fails) process.exit(1);
