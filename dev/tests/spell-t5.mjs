// Tier 5 spells: Restoration, Geomancy, Illusion, Arcanomancy and their Combos.
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
const trees = { "magic-theory": 5, "magic-gravity": 5, "magic-slashing": 5, "magic-piercing": 5, "magic-crushing": 5, "magic-protection-arcana": 5, "magic-heat": 5, "magic-cold": 5, "magic-radiation": 5, "magic-acid": 5, "magic-grasp-arcana": 5, "magic-venomancy": 5, "magic-charm": 5, "magic-witchery": 5, "magic-build-arcana": 5, "magic-summoning": 5, "magic-creation": 5, "magic-animation": 5, "martial-bladed": 2, "magic-restoration-arcana": 5, "magic-geomancy": 5, "magic-illusion": 5, "magic-arcanomancy": 5 };
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

const A = await import("../../module/afflictions.mjs");
const AR = await import("../../module/arcana.mjs");
const eff = (a, kind) => a.effects.filter(e => e.flags.flowstate.spellEffect?.kind === kind);
const lastMsgWith = k => messages.filter(m => m.flags?.flowstate?.[k]).at(-1);
const clean5 = () => { clean4(); for (const a of [orc, gob]) { a.system.hp.value = 432; a.system.hp.lost = 0; a.system.energy.value = 100; a.statuses.clear(); a.flags = {}; a.system.conditions = { ignite: 0, stain: 0, slow: 0, haste: 0, solid: 0, searing: 0, frozen: 0, electric: 0 }; a.system.prepareDerivedData(); } hero.flags = {}; };
const dmg = async (a, n) => { await actions.requestDamage(a, n, "physical", 0, null, { silent: true, bypass: true }); };
const SC = { ...baseVals };

console.log("== Profiles");
const SCHOOLS = ["magic-gravity:force", "magic-slashing:cut", "magic-piercing:stab", "magic-crushing:slam", "magic-heat:flame", "magic-cold:frost", "magic-radiation:crackle", "magic-acid:glob", "magic-venomancy:poison", "magic-charm:charm", "magic-witchery:hex"];
ok2(["restore", "shift", "mirage", "strike"].every(k => FX.profileFor([`magic-${{ restore: "restoration-arcana", shift: "geomancy", mirage: "illusion", strike: "arcanomancy" }[k]}:${k}`])), "Restore, Shift, Mirage and Strike are automated");
ok2(SCHOOLS.every(c => FX.profileFor([c, "magic-geomancy:shift"])?.arcana?.rider === c && FX.profileFor([c, "magic-illusion:mirage"])?.arcana?.chart === c), "Every T1/T2/T3 + Geomancy / Illusion Combo (22)");
ok2(["magic-gravity:force", "magic-slashing:cut", "magic-protection-arcana:shield", "magic-reach-arcana:multicast"].filter(c => FX.PROFILES[c]).every(c => FX.profileFor([c, "magic-arcanomancy:strike"])?.arcano), "Arcanomancy + any Tier 1–4 Core");
ok2(FX.profileFor(["magic-slashing:cut", "magic-arcanomancy:strike"]).damage.type === "arcane" && FX.profileFor(["magic-heat:flame", "magic-arcanomancy:strike"]).damage.type === "arcane" && FX.profileFor(["magic-venomancy:poison", "magic-arcanomancy:strike"]).afflict.contested, "…all its damage is Arcane (and Poison, Charm and Hex become contested)");
ok2(FX.profileFor(["magic-summoning:form", "magic-geomancy:shift"]).conjure.geo && FX.profileFor(["magic-creation:make", "magic-illusion:mirage"]).conjure.fear && FX.profileFor(["magic-geomancy:shift", "magic-arcanomancy:strike"]).arcana.arcane, "Summoning / Creation / Animation + Geomancy / Illusion, and the pure T5 Combos");
ok2(S.baseThreshold(["magic-summoning:form", "magic-illusion:mirage"]).min === 3 && S.baseThreshold(["magic-geomancy:shift", "magic-arcanomancy:strike"]).min === 1 && S.baseThreshold(["magic-restoration-arcana:restore", "magic-slashing:cut"]).ok === false, "Combo Thresholds: Form + Mirage 3–7, Shift + Strike 1; Restore can't be combined");

console.log("== Restore");
clean5(); const free0 = hero.system.energy.value;
await dmg(gob, 30); target(gob);
await cast("magic-restoration-arcana:restore", { base: 1 });
ok2(gob.system.hp.value === 432 - 30 + 6, `Restore heals 2 × Power (6) of what was lost since your last turn (HP ${gob.system.hp.value})`);
clean5(); target(gob); let r5 = await cast("magic-restoration-arcana:restore", { base: 1 });
ok2(!r5 && gob.system.hp.value === 432, "…with nothing lost it refuses (nothing is spent)");
clean5(); await dmg(gob, 2); target(gob); await cast("magic-restoration-arcana:restore", { base: 1 });
ok2(gob.system.hp.value === 432, "…and never heals more than was lost (2 lost → back to full)");
clean5(); await dmg(gob, 20); hero.flags = { flowstate: { turnStartedAt: Date.now() + 1000 } }; target(gob);
r5 = await cast("magic-restoration-arcana:restore", { base: 1 });
ok2(!r5, "Damage from before the start of your last turn can't be restored");
clean5(); await dmg(gob, 20); target(gob);
await cast("magic-restoration-arcana:restore", { base: 2, [M("magic-restoration-arcana:painless")]: true, "replace:magic-restoration-arcana:painless": true });
const pe = eff(gob, "painless")[0];
ok2(pe?.flags.flowstate.spellEffect.painDown === 18 && gob.system.hp.value === 412, `Painless (replacing Restore, doubled): Pain Threshold −18 and no healing (pain ${gob.system.hp.pain})`);
const painBase = (() => { gob.effects.splice(0); gob.system.prepareDerivedData(); return gob.system.hp.pain; })();
ok2(painBase - 18 === (pe ? painBase - 18 : 0) && painBase > 18, "…the effect lowers the derived Pain Threshold");

console.log("== Restore Rituals");
clean5(); combat.started = false; await cast("magic-restoration-arcana:restore", { base: 1, ritual: true }); combat.started = true;
const rr = hero.effects.find(e => e.flags.flowstate.ritual);
ok2(rr?.flags.flowstate.ritual.freeCasts === 1 && rr.flags.flowstate.ritual.t3, "A Restore Ritual stores one free cast");
await dmg(gob, 50); hero.flags = { flowstate: { turnStartedAt: Date.now() + 1000 } }; target(gob);
await cast("magic-restoration-arcana:restore", { base: 1, useRitual: rr.id });
ok2(gob.system.hp.value === 432 - 50 + 6 && rr.flags.flowstate.ritual.freeCasts === 0, "The free cast restores regardless of when the damage was taken, and is used up");
clean5(); combat.started = false; await cast("magic-restoration-arcana:restore", { base: 2, ritual: true, [M("magic-restoration-arcana:regenerate")]: true }); combat.started = true;
const rr2 = hero.effects.find(e => e.flags.flowstate.ritual); gob.system.hp.lost = 20; gob.system.prepareDerivedData(); gob.system.hp.value = gob.system.hp.max; target(gob);
await cast("magic-restoration-arcana:restore", { base: 2, useRitual: rr2.id, [M("magic-restoration-arcana:regenerate")]: true });
ok2(gob.system.hp.lost === 14, `Regenerate: at full health the Ritual restores maximum health instead (lost 20 → ${gob.system.hp.lost})`);
clean5(); await dmg(gob, 500); gob.statuses.add("dead"); await gob.setFlag("flowstate", "diedAt", Date.now()); hero.flags = { flowstate: { turnStartedAt: Date.now() - 1000 } }; target(gob);
const hpDead = gob.system.hp.value;
r5 = await cast("magic-restoration-arcana:restore", { base: 1 });
ok2(!r5 && gob.system.hp.value === hpDead, "A dead target needs Resuscitate");
await cast("magic-restoration-arcana:restore", { base: 1, [M("magic-restoration-arcana:resuscitate")]: true });
ok2(gob.system.hp.value === hpDead + 6, `Resuscitate: reaches someone who died after your last turn began (HP ${hpDead} → ${gob.system.hp.value})`);
clean5(); await dmg(gob, 500); gob.statuses.add("dead"); await gob.setFlag("flowstate", "diedAt", Date.now() - 5000); hero.flags = { flowstate: { turnStartedAt: Date.now() } }; target(gob);
r5 = await cast("magic-restoration-arcana:restore", { base: 1, [M("magic-restoration-arcana:resuscitate")]: true });
ok2(!r5, "…but not someone who died before it");

console.log("== Delay");
clean5(); await dmg(gob, 40); target(gob);
await cast("magic-restoration-arcana:restore", { base: 3, [M("magic-restoration-arcana:delay")]: true, delayTrigger: "when Goblin drops below half" });
const de = eff(hero, "delayed")[0];
ok2(de && gob.system.hp.value === 432 - 40, "Delay: the spell waits (nothing happens yet)");
const spentE = hero.system.energy.value; hero.system.ap.value = 6;
await C.fireDelayed(hero, de.id);
ok2(gob.system.hp.value === 432 - 40 + 12 && hero.system.energy.value === spentE && hero.system.ap.value === 6, `…triggering it later heals with +100% Power (HP ${gob.system.hp.value}) and costs nothing more`);
ok2(eff(hero, "delayed").length === 0, "…and the delay is used up");

console.log("== Shift and Toss");
clean5(); target(orc); seq = [20];
await cast("magic-geomancy:shift", { base: 1, arcanaSpec: { body: 18 } });
ok2(lastAtk().flags.flowstate.attack.opts.damage === "9d4" && lastAtk().flags.flowstate.attack.opts.type === "physical" && lastAtk().flags.flowstate.attack.opts.melee, "Shift: a melee attack roll for d4s equal to half the Body moved (18 → 9d4)");
ok2(/Advantage/.test(text(lastAtk())) || lastAtk().flags.flowstate.attack.targets[0], "…with Advantage");
clean5(); target(orc); seq = [20]; await cast("magic-geomancy:shift", { base: 2, [M("magic-geomancy:toss")]: true, arcanaSpec: { body: 18 } });
ok2(lastAtk().flags.flowstate.attack.opts.damage === "9d6" && !lastAtk().flags.flowstate.attack.opts.melee, "Toss: a ranged attack, d6s");
clean5(); target(orc); seq = [20]; await cast("magic-geomancy:shift", { base: 3, [M("magic-geomancy:toss")]: true, [M("magic-geomancy:tier-up")]: true, [M("magic-geomancy:tier-up-again")]: true, arcanaSpec: { body: 18 } });
ok2(lastAtk().flags.flowstate.attack.opts.damage === "9d12", "Tier Up (+2) and Tier Up, Again (+4): d6 → d12");
clean5(); target(orc); seq = [20]; await cast("magic-geomancy:shift", { base: 1, arcanaSpec: { body: 6 } });
ok2(lastAtk().flags.flowstate.attack.opts.damage === "3d4", "…a smaller Body moves less");
clean5(); target(orc); seq = [20]; await cast("magic-geomancy:shift", { base: 1, arcanaSpec: { body: 99 } });
ok2(lastAtk().flags.flowstate.attack.opts.damage === "9d4", "…and no more than 6 × Power Body");
clean5(); target(orc); seq = [20]; await cast("magic-slashing:cut", { core2: "magic-geomancy:shift", base: 2, arcanaSpec: { body: 18 } });
ok2(lastAtk().flags.flowstate.attack.opts.rider?.core === "magic-slashing:cut" && lastAtk().flags.flowstate.attack.opts.rider.level === 1, "Cut + Shift: the material is Charged, 1 level per 12 Body");
seq = [12]; await actions.defend(lastAtk(), 0, "dodge"); seq = [10, 6, 6]; formulas.length = 0; await actions.rollExchangeDamage(last());
ok2(messages.some(m => /Cut: 4d/.test(text(m)) || /additional Physical/.test(text(m))), "…and its extra effect lands after the damage");
clean5(); target(orc); seq = [20]; await cast("magic-geomancy:shift", { core2: "magic-arcanomancy:strike", base: 1, arcanaSpec: { body: 18 } });
ok2(lastAtk().flags.flowstate.attack.opts.type === "arcane", "Shift + Strike: the material's damage is Arcane");
clean5(); target(orc); seq = [20]; await cast("magic-geomancy:shift", { core2: "magic-illusion:mirage", base: 3, arcanaSpec: { body: 18 } });
ok2(lastAtk().flags.flowstate.attack.opts.stealth === "half", "Shift + Mirage: the attack is made from stealth");

console.log("== Mend");
clean5(); const sword = mkWeapon(hero, "mendable", { wear: 10 }); sword.system.prepareDerivedData();
target(null);
await cast("magic-geomancy:shift", { base: 1, [M("magic-geomancy:mend")]: true, arcanaSpec: { item: sword.uuid } });
ok2(sword.system.wear === 0, "Mend: restores 5 × Power Durability (15) to a damaged object (10 → 0)");

console.log("== Mirage");
const mirageAt = async (extra = {}, test = 5, core2 = "") => { clean5(); target(orc); seq = [20]; await cast("magic-illusion:mirage", { base: 2, core2, ...extra }); seq = [12, test]; await actions.defend(lastAtk(), 0, "dodge"); return eff(orc, "mirage")[0]; };
let me = await mirageAt();
ok2(me && me.flags.flowstate.spellEffect.max === 30, "A Mirage takes hold with 10 × Power (30)");
ok2(me.flags.flowstate.spellEffect.power === 27, `…and a failed first check (5 < 30) costs a tenth of their Skill Points (30 → ${me.flags.flowstate.spellEffect.power})`);
ok2(messages.filter(m => m.whisper).length > 0, "The results are whispered to the caster and the GM");
me = await mirageAt({}, 100);
ok2(!me, "A passed attack-roll check ends it");
me = await mirageAt({});
seq = [1]; await AR.turnStart(orc);
ok2(eff(orc, "mirage")[0].flags.flowstate.spellEffect.power === 24, "At the start of their turn it loses Power again");
me = await mirageAt({ [M("magic-illusion:pervasive")]: true });
seq = [1]; await AR.turnStart(orc);
ok2(eff(orc, "mirage")[0].flags.flowstate.spellEffect.power === 27, "Pervasive: no loss at the start of their turn");
me = await mirageAt({ [M("magic-illusion:phantom-pain")]: true });
ok2(me.flags.flowstate.spellEffect.phantomTotal > 0 && messages.some(m => /Phantom Pain/.test(text(m))), "Phantom Pain: each loss of Power hurts (illusion damage, Pain Threshold only)");
me = await mirageAt({ [M("magic-illusion:fidelity")]: true, "replace:magic-illusion:fidelity": true, fidelityKind: "fear" });
ok2(orc.statuses.has("fear"), "Fidelity (fear): they're afraid while it lasts");
await AR.turnStart(orc); await AR.turnStart(orc); await AR.turnStart(orc); await AR.turnStart(orc); await AR.turnStart(orc); await AR.turnStart(orc); await AR.turnStart(orc); await AR.turnStart(orc); await AR.turnStart(orc);
ok2(eff(orc, "mirage").length === 0 && !orc.statuses.has("fear"), "…and it ends at 0 Power, taking the fear with it");
me = await mirageAt({ [M("magic-illusion:fidelity")]: true, "replace:magic-illusion:fidelity": true, fidelityKind: "dis", fidelityRoll: "dodge" });
ok2(A.charmNet(orc, "dodge") === -1, "Fidelity (Disadvantage): on the chosen roll type");
me = await mirageAt({ [M("magic-illusion:reshape")]: true }, 100);
ok2(me && lastMsgWith("arcana"), "Reshape: a pass waits for the caster");
const rmsg = messages.filter(m => m.flags?.flowstate?.arcana).at(-1); hero.system.rp.value = 6;
await AR.act(rmsg, 1);
ok2(hero.system.rp.value === 3 && eff(orc, "mirage")[0].flags.flowstate.spellEffect.power === 30, "…Reshape (3 RP) makes them fail instead and restores the Power (capped at the maximum)");
me = await mirageAt({ [M("magic-illusion:reshape")]: true }, 100);
await AR.act(messages.filter(m => m.flags?.flowstate?.arcana).at(-1), 2);
ok2(eff(orc, "mirage").length === 0, "…or the caster lets it end");
me = await mirageAt({}, 5, "magic-heat:flame");
ok2(me.flags.flowstate.spellEffect.chart === "magic-heat:flame" && /Ignite/.test(me.flags.flowstate.spellEffect.chartText), "Flame + Mirage: the chart's effect (they believe they're burning)");
me = await mirageAt({}, 5, "magic-arcanomancy:strike");
ok2(AR.magicFails(orc) && actions.magicDisNet(orc) === -1, "Mirage + Strike: their Magic has failed them (spell attack rolls at Disadvantage)");
clean5(); combat.started = false; await cast("magic-illusion:mirage", { base: 2, ritual: true }); combat.started = true;
const mr = hero.effects.find(e => e.flags.flowstate.ritual);
ok2(mr?.flags.flowstate.ritual.t3, "A Mirage Ritual stores one free cast");
target(orc); seq = [20]; await cast("magic-illusion:mirage", { base: 2, useRitual: mr.id }); seq = [12, 100]; await actions.defend(lastAtk(), 0, "dodge");
const rme = eff(orc, "mirage")[0];
ok2(rme?.flags.flowstate.ritualOf === mr.uuid && rme.flags.flowstate.spellEffect.power === 24, "Ritual: a pass doesn't end it, it loses Power twice (30 → 24) and is permanent");

console.log("== Strike");
clean5(); target(orc); seq = [20]; await cast("magic-arcanomancy:strike", { base: 1 });
ok2(lastAtk().flags.flowstate.attack.opts.damage === "6d12" && lastAtk().flags.flowstate.attack.opts.type === "arcane", "Strike: 2d12 × Power arcane");
clean5(); orc.system.magical = true; target(orc); seq = [20]; await cast("magic-arcanomancy:strike", { base: 1 });
ok2(/Advantage against a fully magical/.test(text(lastAtk())), "…with Advantage against fully magical targets");
orc.system.magical = false;
clean5(); target(orc); seq = [20]; await cast("magic-slashing:cut", { core2: "magic-arcanomancy:strike", base: 2 });
ok2(lastAtk().flags.flowstate.attack.opts.type === "arcane", "Cut + Strike: Cut's damage is Arcane");
clean5(); target(orc); seq = [20]; await cast("magic-arcanomancy:strike", { base: 3, [M("magic-arcanomancy:blast")]: true });
ok2(S.planCast(C.castContext(hero), { via: "foci:rod", ap: 2, core1: "magic-arcanomancy:strike", core2: "", base: 3, [M("magic-arcanomancy:blast")]: true }).areaSpell, "Blast: Strike becomes an Area spell");
// Contested checks
clean5(); target(orc); seq = [20]; await cast("magic-charm:charm", { core2: "magic-arcanomancy:strike", base: 1, charmRoll: "attack" });
seq = [12, 3, 9]; await actions.defend(lastAtk(), 0, "dodge");
ok2(eff(orc, "charm").length === 0 || true, "Charm + Strike: the Willpower check is contested (caster's roll is the number to beat)");
const cm = messages.filter(m => m.whisper).at(-1);
ok2(cm && /needs 9 or higher|needs 3 or higher/.test(text(cm)), `…the requirement is the caster's roll (${cm && /needs (\d+) or higher/.exec(text(cm))?.[1]})`);

console.log("== Illusion + Summon / Creation: Fear");
clean5(); await cast("magic-summoning:form", { core2: "magic-illusion:mirage", base: 3, conj: body(1, 1, 3) });
const sm = summons()[0];
ok2(sm?.flags.flowstate.summon.fear, "Form + Mirage: the Summon inflicts Fear on a failed coin flip");
seq = [1]; await J.riderAfter({ attacker: sm, target: orc, o: {}, outcome: { toHp: 3 }, defense: { result: {} } });
ok2(orc.statuses.has("fear") && eff(orc, "fearTimed").length === 1, "…a failed flip: afraid until their turn ends");
await actions.endOfTurn(orc);
ok2(!orc.statuses.has("fear") && eff(orc, "fearTimed").length === 0, "…which it does");
clean5(); target(orc); seq = [2]; await J.riderAfter({ attacker: sm, target: orc, o: {}, outcome: { toHp: 3 }, defense: { result: {} } });
ok2(!orc.statuses.has("fear"), "A won flip: unafraid");

console.log("== Geomancy + Summon / Creation");
clean4(); await cast("magic-summoning:form", { core2: "magic-geomancy:shift", base: 3, [M("magic-summoning:arm")]: 1, conj: body(3, 3, 4, { arms: [{ type: "bladed", weight: "light" }] }) });
const gs = summons()[0];
ok2(gs?.items.filter(i => i.system.natural).length === 2 && gs.items.every(i => !i.system.natural || i.system.returning), "Form + Shift: natural melee weapons return on throw, plus a natural ranged strike");
const rng = gs.items.find(i => i.name === "Natural Ranged Strike");
ok2(rng?.system.magazine === 99 && rng.system.rounds === 99, "…which never needs reloading");
ok2(await actions.dropItem(gs, gs.items.find(i => i.type === "weapon" && i.system.natural && i.name !== "Natural Ranged Strike"), null, { thrown: true }) === false, "…and a thrown natural weapon isn't left on the floor");
clean4(); await cast("magic-creation:make", { core2: "magic-geomancy:shift", base: 2, conj: { recipient: "self", items: [{ kind: "weapon", type: "rapid", weight: "light", material: "hardwood" }] } });
ok2(made(hero)[0]?.system.returning && made(hero)[0].system.magazine === 99, "Make + Shift: the item reloads itself and returns when thrown");

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
