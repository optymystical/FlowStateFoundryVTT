// Tier 4 spells: Summoning, Creation, Animation (real temporary actors and items) and Build Arcana's Mods.
class Field { constructor(o={}){ Object.assign(this,o); } }
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 }); let confirmAnswer = true;
globalThis.foundry = {
  data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field, ObjectField: Field } },
  abstract: { TypeDataModel: class {} },
  utils: { escapeHTML: s => s, deepClone: o => structuredClone(o), getProperty: (o,k)=>k.split(".").reduce((a,b)=>a?.[b],o), setProperty: (o,k,v)=>{const p=k.split(".");let c=o;for(const x of p.slice(0,-1))c=c[x]??={};c[p.at(-1)]=v;} },
  applications: { api: { DialogV2: { prompt: async ({ content }) => dialog(content), confirm: async () => confirmAnswer } } }
};
globalThis.Roll = class { constructor(f){ this.formula=f; } async evaluate(){ this.total = seq.length ? seq.shift() : 10; return this; } async render(){ return `<roll ${this.formula}=${this.total}>`; } };
globalThis.ChatMessage = { getSpeaker: ({actor}) => ({ alias: actor.name }),
  create: async d => { const m = { id: "m"+messages.length, ...d, getFlag: (s,k) => m.flags?.[s]?.[k], setFlag: async (s,k,v) => { m.flags ??= {}; (m.flags[s] ??= {})[k] = v; } }; messages.push(m); return m; } };
const combat = { id: "C", started: true, round: 1, turn: 0, combatant: null, combatants: [] };
globalThis.game = { settings: { get: () => false }, messages: { find: fn => messages.find(fn), filter: fn => messages.filter(fn), get: id => messages.find(m=>m.id===id) }, combat,
  users: Object.assign([{ id: "gm", isGM: true }], { activeGM: { id: "gm" } }), socket: { emit: (...a) => console.log("  socket emit", JSON.stringify(a[1])) }, user: { targets: new Set(), isGM: false }, actors: [] };
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
const stats = { str: 10, dex: 10, con: 10, pon: 10, snap: 10, will: 10, reach: 30, grasp: 30, build: 10 };
const trees = { "magic-theory": 5, "magic-gravity": 5, "magic-slashing": 5, "magic-piercing": 5, "magic-crushing": 5, "magic-protection-arcana": 5, "magic-heat": 5, "magic-cold": 5, "magic-radiation": 5, "magic-acid": 5, "magic-grasp-arcana": 5, "magic-venomancy": 5, "magic-charm": 5, "magic-witchery": 5, "magic-build-arcana": 5, "magic-summoning": 5, "magic-creation": 5, "magic-animation": 5, "martial-bladed": 2 };
const hero = addEffects(mkActor("Hero", { stats, skillPoints: 30, energy: { value: 200 } }, { ...trees }));
const orc = addEffects(mkActor("Orc", { skillPoints: 30 }, {}));
const gob = addEffects(mkActor("Goblin", { skillPoints: 30 }, {}));
mkFoci(hero, "rod", { fociType: "rod" });
hero.isOwner = true; orc.isOwner = true; gob.isOwner = true;
combat.combatants.length = 0; combat.combatants.push({ actor: hero }, { actor: orc }, { actor: gob }); combat.combatant = { actor: hero };
const baseVals = { via: "foci:rod", ap: 2, core2: "", base: 1 };
const cast = (core, extra = {}) => { hero.system.ap.value = 6; hero.system.rp.value = 6; hero.system.energy.value = 150; return C.castSpell(hero, { ...baseVals, core1: core, ...extra }); };
const last = () => messages.at(-1);
const target = a => { game.user.targets = new Set(a ? [{ actor: a, name: a.name, document: {} }] : []); };
const power = () => S.spellPower(C.castContext(hero).options.find(o => o.key === "foci:rod").scaling);
const dodgeDie0 = orc.system.derived.dodgeDie;

const M = id => `mod:${id}`;
const lastAtk = () => messages.filter(m => m.flags?.flowstate?.attack).at(-1);
const reset = () => { orc.system.hp.value = 432; orc.system.hp.lost = 0; orc.system.energy.value = 100; orc.system.conditions = { ignite: 0, stain: 0, slow: 0, haste: 0, solid: 0, searing: 0, frozen: 0, electric: 0 }; orc.effects.splice(0, orc.effects.length); orc.flags = {}; };
// cast at the Orc, it fails a 12 dodge, then roll the damage; returns the damage card
let keepFlags = false; let res0;
const hit = async (core, extra = {}, dmgSeq = [20], atkRoll = 20) => {
  if (!keepFlags) reset2(); target(orc); seq = [atkRoll]; await cast(core, extra);
  seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
  seq = [...dmgSeq]; await actions.rollExchangeDamage(last()); return last();
};
let reset2 = () => { for (const k of Object.keys(hero.flags)) delete hero.flags[k]; };
const cond = k => orc.system.conditions[k];

const J = await import("../../module/conjure.mjs");
const R = await import("../../module/conjure-rules.mjs");
const { FlowStateArmorData } = await import("../../module/data.mjs");
globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, OWNER: 3 }, TOKEN_DISPOSITIONS: { FRIENDLY: 1 }, TOKEN_DISPLAY_MODES: { HOVER: 30 } };
game.user.isGM = true; game.scenes = Object.assign([], { get: () => undefined }); game.actors.get = id => game.actors.find(a => a.id === id);
let seqId = 0;
// Actors created by the spells: real mock actors with their items.
function mkItem(actor, d) {
  const i = { id: `I${++seqId}`, name: d.name, type: d.type, uuid: `${actor.uuid}.Item.${seqId}`, parent: actor, actor, flags: structuredClone(d.flags ?? {}), isOwner: true };
  const Model = d.type === "armor" ? FlowStateArmorData : d.type === "weapon" ? FlowStateWeaponData : null;
  i.system = Model ? Object.assign(Object.create(Model.prototype), d.type === "armor" ? { weight: "light", material: "cloth", grade: 1, equipped: false, natural: false, wear: 0, conditions: {} } : { weaponType: "bladed", weight: "light", material: "hardwood", grade: 1, twoHanded: false, equipped: false, secondHand: false, natural: false, returning: false, magazine: 1, rounds: 1, wear: 0, extraTypes: [] }, d.system, { parent: i }) : { ...d.system };
  i.update = async u => { for (const [k, v] of Object.entries(u)) set(i, k, v); i.system.prepareDerivedData?.(); };
  i.delete = async () => { actor.items.splice(actor.items.indexOf(i), 1); actor.system.prepareDerivedData?.(); };
  actor.items.push(i); uuids.set(i.uuid, i); i.system.prepareDerivedData?.(); actor.system.prepareDerivedData?.(); return i;
}
for (const a of [hero, orc, gob]) { a.id = a.name; a.createEmbeddedDocuments = ((orig) => async (type, docs) => type === "Item" ? docs.map(d => mkItem(a, d)) : orig(type, docs))(a.createEmbeddedDocuments); }
globalThis.Actor = { create: async data => {
  const a = addEffects(mkActor(data.name, { ...data.system, hp: { value: 0, lost: 0 }, energy: { value: 0 } }, data.system.trees ?? {}));
  a.id = `A${++seqId}`; a.uuid = `Actor.${a.id}`; uuids.set(a.uuid, a); a.flags = structuredClone(data.flags ?? {}); a.type = "npc";
  a.system.prepareDerivedData(); a.system.hp.value = data.system.hp.value; a.system.energy.value = data.system.energy.value;
  a.createEmbeddedDocuments = ((orig) => async (type, docs) => type === "Item" ? docs.map(d => mkItem(a, d)) : orig(type, docs))(a.createEmbeddedDocuments);
  a.delete = async () => { game.actors.splice(game.actors.indexOf(a), 1); };
  a.getFlag = (s, k) => foundry.utils.getProperty(a.flags, `${s}.${k}`);
  return a;
} };
const summons = () => game.actors.filter(a => a.flags?.flowstate?.summon);
const made = a => a.items.filter(i => i.flags?.flowstate?.made);
const clean4 = () => { for (const a of [...summons()]) game.actors.splice(game.actors.indexOf(a), 1); for (const a of [hero, orc, gob]) { a.items.splice(0, a.items.length, ...a.items.filter(i => !i.flags?.flowstate?.made)); a.effects.splice(0, a.effects.length); a.flags = {}; a.system.hp.value = 432; } messages.length = 0; hero.system.energy.value = 150; };
const formVals = (conj, extra = {}) => ({ base: 3, conj, ...extra });
const body = (str = 5, dex = 5, con = 5, more = {}) => ({ size: 1, str, dex, con, skill: 0, arms: [], items: [], ...more });

console.log("== Rules math");
ok2(R.summonPool(3) === 120 && R.summonPool(1) === 40 && R.formPool(3) === 15 && R.conjureMultiplier(4, true) === 3 && R.conjureMultiplier(3, false) === 3, "Form: 5 points × the Threshold multiplier (a Combo's extra baseline doesn't multiply)");
ok2(R.formStats({ str: 5, dex: 5, con: 5 }, 15).ok && !R.formStats({ str: 0, dex: 5, con: 5 }, 15).ok && !R.formStats({ str: 8, dex: 5, con: 5 }, 15).ok && R.formStats({ str: 3, dex: 3, con: 3, skill: 3 }, 15).ok, "Body points need at least 1 in each stat; Skill costs 2 each; no overspending");
ok2(R.formSize(3, 4) === 2 && R.formSize(3, 5) === 3 && R.formSize(4, 10) === 4 && R.formSize(1, 1) === 1, "Summon size: 1–2, 3 at Threshold 5, 4 at 10");
ok2(R.summonHealth(5, 2) === 30 && R.summonEnergy(5) === 25, "Health 3 × Con × size; Energy 5 × Con");
ok2(R.animationSize(4) === 1 && R.animationSize(5) === 2 && R.animationSize(25) === 3 && R.animationSize(125) === 4 && R.animationSize(625) === 5, "Animation size by Body");
ok2(R.animationStats({ points: 10, category: "hard", size: 2 }).hp === 100 && R.animationStats({ points: 10, category: "liquid", size: 1 }).hp === 10, "Animation health: Hard 5×, Liquid 1× points × size");
ok2(R.naturalArmor({ threshold: 3, con: 25 }).material === "copper" && R.naturalArmor({ threshold: 1, con: 5 }).weight === "light" && R.naturalWeapon({ weaponType: "bladed", weight: "heavy", scaling: 24 }).grade === 2, "Natural armor and weapons by Threshold and stat");
const planOk = (core, extra = {}) => S.planCast(C.castContext(hero), { via: "foci:rod", ap: 2, core1: core, core2: extra.core2 ?? "", base: extra.base ?? 1, ...extra });
ok2(S.baseThreshold(["magic-summoning:form", "magic-animation:animate"]).max === 6 && S.baseThreshold(["magic-slashing:cut", "magic-summoning:form"]).min === 2, "Combo Thresholds: Form + Animate is 2–6; Cut + Form is 2–6");

console.log("== Form: a Summon");
clean4(); const eBefore = hero.system.energy.value;
let plan = await cast("magic-summoning:form", formVals(body(5, 5, 5)));
let sm = summons()[0];
ok2(plan && sm && sm.flags.flowstate.summon.owner === hero.uuid, "Casting Form creates a temporary NPC actor owned by you");
ok2(sm.system.hp.value === 15 && sm.system.hp.max === 15 && sm.system.energy.max === 25, `Health 3 × Con(5) × size(1) = 15 and Energy 25 (HP ${sm.system.hp.value}/${sm.system.hp.max}, Energy ${sm.system.energy.max})`);
ok2(sm.system.derived.attackDie === hero.system.derived.attackDie && sm.system.derived.dodgeDie === hero.system.derived.dodgeDie, "Its attack and dodge dice are yours");
ok2(sm.system.stats.str === 5 && sm.system.trees["martial-bladed"] === 2, "Stats from the points; it knows the Martial trees you know");
ok2(hero.system.energy.value < eBefore, `It cost Energy (${eBefore} → ${hero.system.energy.value})`);
await J.turnStart(hero);
ok2(summons().length === 0, "At the start of your next turn it's gone");
clean4(); plan = await cast("magic-summoning:form", formVals(body(50, 50, 50)));
ok2(!plan && summons().length === 0, "Overspending the 120 points (40 × the multiplier) is refused (nothing is cast or spent)");
clean4(); plan = await cast("magic-summoning:form", { base: 1, conj: body(10, 10, 20) });
ok2(summons()[0]?.system.hp.max === 60 && summons()[0].system.stats.con === 20, "Form: 40 points to split as you like (10 / 10 / 20 → health 3 × 20)");
plan = await cast("magic-summoning:form", formVals(body(5, 5, 5, { size: 3 })));
ok2(!plan, "Size 3 needs a Threshold of at least 5");
clean4(); plan = await cast("magic-summoning:form", { base: 5, conj: body(10, 10, 5, { size: 3 }) });
ok2(summons()[0]?.system.size === 3 && summons()[0].system.hp.max === 3 * 5 * 3, "…and at 5 the Summon can be Size 3 (health × size)");
clean4(); plan = await cast("magic-summoning:form", { base: 3, [M("magic-build-arcana:layered")]: true, conj: body(5, 5, 5) });
ok2(summons()[0]?.system.hp.max === 15 + hero.system.derived.effective.build.value, `Layered adds your Build to a Summon's health (${summons()[0]?.system.hp.max})`);

console.log("== Arm and Skin");
clean4(); plan = await cast("magic-summoning:form", { base: 3, [M("magic-summoning:arm")]: 1, conj: body(5, 5, 5, { arms: [{ type: "bladed", weight: "light" }] }) });
sm = summons()[0]; const nat = sm.items.find(i => i.type === "weapon");
ok2(nat?.system.natural && nat.system.equipped && nat.system.material === "hardwood" && nat.system.weight === "light", "Arm: a Light natural weapon in Hardwood, equipped");
ok2(await actions.dropItem(sm, nat, null, { thrown: false }) === false && sm.items.includes(nat), "A natural weapon can't be dropped…");
ok2(await actions.dropItem(sm, nat, null, { thrown: true }) === false && sm.items.includes(nat), "…or thrown (it stays on the Summon)");
clean4(); plan = await cast("magic-summoning:form", { base: 3, [M("magic-summoning:arm")]: 1, [`modT:${"magic-summoning:arm"}`]: 2, conj: body(5, 5, 5, { arms: [{ type: "balanced", weight: "heavy" }] }) });
sm = summons()[0]; const two = sm.items.find(i => i.type === "weapon");
ok2(two?.system.twoHanded && two.system.material === "iron", "Arm at 2 Threshold: both arms into one two-handed weapon (Heavy → Iron)");
clean4(); plan = await cast("magic-summoning:form", { base: 3, [M("magic-summoning:skin")]: true, [`modT:${"magic-summoning:skin"}`]: 2, conj: body(5, 5, 5) });
sm = summons()[0]; const skin = sm.items.find(i => i.type === "armor");
ok2(skin?.system.natural && skin.system.weight === "medium" && skin.system.material === "softLeather" && skin.system.equipped, "Skin at 2 Threshold: Medium natural armor");
ok2(sm.system.armor === skin, "…which it wears");

console.log("== Animate");
const wat = { material: "Water", body: 10, arms: [], items: [] };
clean4(); plan = await cast("magic-animation:animate", { base: 2, conj: wat });
sm = summons()[0];
ok2(sm && sm.system.size === 2 && sm.system.hp.max === 1 * 10 * 2 && sm.flags.flowstate.summon.speed === 50, `Water Animation: 10 points, Size 2 (10 Body), health 1 × 10 × 2 = 20 (${sm?.system.hp.max}), 50 ft/AP`);
ok2(sm.system.derived.move === 50 && sm.system.derived.size.physical < 0, "…its speed and Weakened physical attacks are in its derived stats");
clean4(); plan = await cast("magic-animation:animate", { base: 2, conj: { material: "Stone", body: 10 } });
ok2(!plan, "Stone needs Expanded Animation (Hard material)");
clean4(); plan = await cast("magic-animation:animate", { base: 2, [M("magic-animation:expanded-animation")]: true, conj: { material: "Stone", body: 10 } });
sm = summons()[0];
ok2(sm.system.hp.max === 5 * 10 * 2 && sm.system.ap.max === 3 && sm.system.rp.max === 3 && sm.flags.flowstate.summon.physical === 1, "Stone: health 5×, only 3 AP / 3 RP, Strengthened physical attacks");
clean4(); plan = await cast("magic-animation:animate", { base: 2, conj: { material: "Water", body: 9 } });
ok2(!plan, "The pile must hold at least as much Body as the points");
await J.turnStart(hero);

console.log("== Make");
const wvals = (o = {}) => ({ items: [{ kind: "weapon", type: "bladed", weight: "light", material: "hardwood", ...o }], recipient: "self" });
clean4(); const heroItems0 = hero.items.length;
plan = await cast("magic-creation:make", { base: 1, conj: wvals() });
let it = made(hero)[0];
ok2(it && it.type === "weapon" && it.system.grade === 2 && it.system.material === "hardwood", "Make: a Grade 2 Common weapon appears in your hand (a real item)");
await J.turnStart(hero);
ok2(made(hero).length === 0 && hero.items.length === heroItems0, "…and ends at the start of your next turn");
clean4(); plan = await cast("magic-creation:make", { base: 1, conj: wvals({ material: "steel" }) });
ok2(!plan && made(hero).length === 0, "Steel is Uncommon: it needs Make Mk2");
clean4(); plan = await cast("magic-creation:make", { base: 1, [M("magic-creation:make-mk2")]: true, conj: wvals({ material: "steel" }) });
ok2(made(hero).length === 1, "…with Make Mk2 it works");
clean4(); plan = await cast("magic-creation:make", { base: 1, [M("magic-creation:make-mk3")]: true, conj: wvals() });
ok2(!plan, "Make Mk3 needs Make Mk2 on the same Spell");
clean4(); plan = await cast("magic-creation:make", { base: 1, [M("magic-creation:armory")]: 1, conj: { recipient: "self", items: [{ kind: "weapon", type: "bladed", weight: "light", material: "hardwood" }, { kind: "armor", weight: "light", material: "cloth" }] } });
ok2(made(hero).length === 2 && made(hero).some(i => i.type === "armor"), "Armory: an additional object");
clean4(); plan = await cast("magic-creation:make", { base: 1, [M("magic-creation:complexity")]: 1, conj: { recipient: "self", items: [{ kind: "weapon", type: "bladed", weight: "light", material: "hardwood", extra: ["swift"] }] } });
ok2(made(hero)[0]?.system.extraTypes.includes("swift"), "Complexity: one additional weapon type");
clean4(); target(orc); seq = [20]; plan = await cast("magic-creation:make", { base: 1, conj: { ...wvals(), recipient: "target" } });
ok2(made(orc).length === 0 && lastAtk(), "Made for a target: an attack roll first");
seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
ok2(made(orc).length === 1 && made(hero).length === 0, "…on a hit it goes into their inventory");
clean4(); target(orc); seq = [1]; plan = await cast("magic-creation:make", { base: 1, conj: { ...wvals(), recipient: "target" } });
seq = [30]; await actions.defend(lastAtk(), 0, "dodge");
ok2(made(orc).length === 0 && made(hero).length === 1 && messages.some(m => /missed/.test(text(m))), "…on a miss it lands beside them (here, with no scene, in your inventory)");
clean4(); target(null); plan = await cast("magic-creation:make", { base: 1, conj: { recipient: "self", items: [{ kind: "object", name: "A cube of clay" }] } });
ok2(made(hero)[0]?.type === "gear", "A non-Archetypal object is a plain misc item");

console.log("== Pure Tier 4 Combos");
clean4(); plan = await cast("magic-summoning:form", { core2: "magic-creation:make", base: 4, conj: body(5, 5, 5, { items: [{ kind: "weapon", type: "balanced", weight: "light", material: "hardwood" }] }) });
sm = summons()[0]; const held = sm?.items.find(i => i.type === "weapon" && !i.system.natural);
ok2(held?.system.equipped && held.system.grade === 2, "Form + Make: the Summon holds a Made weapon (Threshold 4 → 3 × 5 points)");
clean4(); plan = await cast("magic-animation:animate", { core2: "magic-creation:make", base: 3, conj: { material: "Hardwood" } });
sm = summons()[0];
ok2(sm && sm.system.stats.str === 20 && sm.system.size === 2, `Make + Animate: instantly a 20-point Animation (10 × the multiplier of 2), size 2 (20 Body)`);
clean4(); plan = await cast("magic-summoning:form", { core2: "magic-animation:animate", base: 3, conj: { material: "Hardwood", body: 10, str: 3, dex: 3, con: 4, skill: 0 } });
sm = summons()[0];
ok2(sm && sm.system.stats.con === 4 && sm.system.hp.max === 3 * 4 * 2 && sm.system.size === 2, `Form + Animate: points allocated like Form; health = Con × Material scaling (Soft 3×) × size (${sm?.system.hp.max})`);

console.log("== Riders (Any T1/T2/T3 + Summoning / Creation)");
clean4(); plan = await cast("magic-slashing:cut", { core2: "magic-summoning:form", base: 3, conj: body(3, 3, 4) });
sm = summons()[0];
ok2(sm?.flags.flowstate.summon.rider?.core === "magic-slashing:cut" && sm.flags.flowstate.summon.rider.level === 1, "Cut + Form: the Summon's attacks carry Cut, one level per 10 Str + Dex");
formulas.length = 0; seq = [9]; const hp0 = orc.system.hp.value;
await J.riderAfter({ attacker: sm, target: orc, o: {}, outcome: { toHp: 5 }, defense: { result: {} } });
ok2(formulas.includes("2d10") && orc.system.hp.value < hp0, `…2d6 additional physical, d10 against a living target taking direct damage (${formulas})`);
clean4(); plan = await cast("magic-heat:flame", { core2: "magic-animation:animate", base: 3, conj: { material: "Water", body: 10 } });
sm = summons()[0]; seq = [12]; await J.riderAfter({ attacker: sm, target: orc, o: {}, outcome: { toHp: 3 }, defense: { result: {} } });
ok2(orc.system.conditions.ignite === 12, "Flame + Animate: additional heat damage and Ignite equal to it");
clean4(); plan = await cast("magic-cold:frost", { core2: "magic-summoning:form", base: 3, conj: body(3, 3, 4) });
sm = summons()[0]; seq = [8]; orc.system.energy.value = 100; await J.riderAfter({ attacker: sm, target: orc, o: {}, outcome: { toHp: 3 }, defense: { result: {} } });
ok2(orc.system.energy.value === 92, "Frost + Form: Energy removed");
clean4(); plan = await cast("magic-crushing:slam", { core2: "magic-summoning:form", base: 3, conj: body(3, 3, 4) });
sm = summons()[0]; seq = [6]; await J.riderAfter({ attacker: sm, target: orc, o: {}, outcome: { toHp: 3 }, defense: { result: {} } });
ok2(orc.effects.some(e => e.flags.flowstate.spellEffect?.dodgeDie === 2), "Slam + Form: −2 dodge die size");
clean4(); plan = await cast("magic-venomancy:poison", { core2: "magic-summoning:form", base: 3, conj: body(3, 3, 4) });
sm = summons()[0]; await J.riderAfter({ attacker: sm, target: orc, o: {}, outcome: { toHp: 3 }, defense: { result: {} } });
ok2(orc.effects.some(e => e.flags.flowstate.spellEffect?.kind === "poison"), "Poison + Form: a hit that deals direct damage poisons a living target");
clean4(); plan = await cast("magic-witchery:hex", { core2: "magic-summoning:form", base: 3, hexTrigger: "harm", conj: body(3, 3, 4) });
sm = summons()[0]; await J.riderAfter({ attacker: sm, target: orc, o: {}, outcome: { toHp: 3 }, defense: { result: {} } });
ok2(orc.effects.some(e => e.flags.flowstate.spellEffect?.kind === "hex"), "Hex + Form: the hit applies the chosen Hex");
clean4(); plan = await cast("magic-slashing:cut", { core2: "magic-creation:make", base: 1, conj: wvals() });
it = made(hero)[0];
ok2(it?.flags.flowstate.made.rider?.core === "magic-slashing:cut", "Cut + Make: the made item carries the rider");
seq = [9]; formulas.length = 0; await J.riderAfter({ attacker: hero, target: orc, o: { itemUuid: it.uuid }, outcome: { toHp: 4 }, defense: { result: {} } });
ok2(formulas.some(f => /^2d(6|10)$/.test(f)), "…attacks with it add the Cut effect (1 level per 4 Grade, min 1)");

console.log("== Animate Armor/Shroud");
clean4(); mkItem(orc, { name: "Plate", type: "armor", system: { weight: "heavy", material: "titanium", grade: 1, equipped: true } }); target(orc);
plan = await cast("magic-animation:animate", { base: 1, [M("magic-animation:armor-shroud")]: true, conj: {} });
const ae = orc.effects.find(e => e.flags.flowstate.spellEffect?.kind === "animatedEquip");
const acard = messages.find(m => m.flags?.flowstate?.conjure);
ok2(ae && acard?.flags.flowstate.conjure.acts[0].dice === 2, "Armor/Shroud: the armor is animated; suffocate / mould buttons deal Grade × 2 (Heavy) d12 physical");
seq = [20]; hero.system.ap.value = 6; messages.length = 0; await J.act(acard, 0);
ok2(hero.system.ap.value === 4 && lastAtk()?.flags.flowstate.attack.opts.damage === "2d12", "…each costs 2 AP and is a melee attack roll");

console.log("== Rituals");
clean4(); combat.started = false;
await cast("magic-summoning:form", { base: 3, ritual: true }); combat.started = true;
const rit = hero.effects.find(e => e.flags.flowstate.ritual);
ok2(rit?.flags.flowstate.ritual.t3 && rit.flags.flowstate.ritual.freeCasts === 1 && summons().length === 0, "A Summoning Ritual stores one free cast (nothing appears yet)");
plan = await cast("magic-summoning:form", { base: 3, useRitual: rit.id, conj: body(5, 5, 5) });
sm = summons()[0];
ok2(sm?.flags.flowstate.summon.ritualOf === rit.uuid && rit.flags.flowstate.ritual.freeCasts === 0, "The free cast makes a permanent Summon tied to the Ritual");
await J.turnStart(hero);
ok2(summons().length === 1, "…it survives the start of your next turn");
await J.endRitual(rit.uuid);
ok2(summons().length === 0, "…and ends with the Ritual");

console.log("== Build Arcana");
clean4(); target(orc); seq = [20]; await cast("magic-protection-arcana:shield", { base: 1, [M("magic-build-arcana:layered")]: true }); seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
const shield = orc.effects.find(e => e.flags.flowstate.spellEffect?.kind === "shield");
ok2(shield?.flags.flowstate.spellEffect.hp === 60 + hero.system.derived.effective.build.value, `Layered: a Shield gains your Build (${shield?.flags.flowstate.spellEffect.hp})`);
clean4(); combat.started = false; await cast("magic-protection-arcana:shield", { base: 1, ritual: true, [M("magic-build-arcana:reform")]: true }); combat.started = true;
clean4();
// Reform on a ritual Shield
{ const e = (await actions.applySpellEffect(orc, { kind: "shield", caster: hero.uuid, name: "Shield", hp: 40, max: 60, reform: true, reformMark: 60, ritualOf: "Ritual.X", adjust: false, order: "default" }))[0];
  await J.turnStart(hero);
  const min = hero.system.derived.effective.build.min;
  ok2(e.flags.flowstate.spellEffect.hp === 40 + Math.min(min, 20), `Reform: a Ritual Shield restores your Build minimum (+${Math.min(min, 20)}) of what it lost (hp ${e.flags.flowstate.spellEffect.hp})`); }
dialog = () => ({ net: 0 });

console.log("== Shroud Master and Seep");
{
  const mkShroud = (name, attuned) => { const i = { id: `S${name}`, name, type: "shroud", uuid: `${hero.uuid}.Item.${name}`, parent: hero, actor: hero, system: { attuned, wear: 0 }, flags: {}, isOwner: true }; i.update = async u => { for (const [k, v] of Object.entries(u)) set(i, k, v); }; hero.items.push(i); return i; };
  const s1 = mkShroud("One", true), s2 = mkShroud("Two", false);
  dialog = () => s2.id; hero.system.ap.value = 6;
  await C.swapShroud(hero);
  ok2(s2.system.attuned === true && hero.system.ap.value === 4, "Shroud Master: swap your attuned Shroud for 2 AP");
  hero.system.trees["magic-build-arcana"] = 3; const ap = hero.system.ap.value; await C.swapShroud(hero);
  ok2(hero.system.ap.value === ap, "…it needs Build Arcana T4");
  hero.system.trees["magic-build-arcana"] = 5;
}
dialog = () => ({ net: 0 });

console.log("== Unravel (T3)");
{
  clean4(); await actions.applySpellEffect(orc, { kind: "magicDis", caster: hero.uuid, name: "Unravelled" });
  formulas.length = 0; seq = [5]; await actions.rollStatCheck(orc, "build");
  ok2(formulas.some(f => /kl/.test(f)), `Unravel: Build checks are made with Disadvantage (${formulas.at(-1)})`);
  formulas.length = 0; seq = [5]; await actions.rollStatCheck(orc, "str");
  ok2(!formulas.some(f => /kl/.test(f)), "…Strength checks aren't affected");
  ok2(actions.magicDisNet(orc) === -1, "…and neither is anyone without it");
}
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
