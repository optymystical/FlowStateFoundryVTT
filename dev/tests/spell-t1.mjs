// Tier 1 spells: Shield, Force, Cut, Stab, Slam and the pure Tier 1 Combos, through the real attack exchange.
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
const trees = { "magic-theory": 2, "magic-gravity": 1, "magic-slashing": 1, "magic-piercing": 1, "magic-crushing": 1, "magic-protection-arcana": 1 };
const hero = addEffects(mkActor("Hero", { stats, skillPoints: 30, energy: { value: 200 } }, { ...trees }));
const orc = addEffects(mkActor("Orc", { skillPoints: 30 }, {}));
mkFoci(hero, "rod", { fociType: "rod" });
hero.isOwner = true; orc.isOwner = true;
combat.combatants.length = 0; combat.combatants.push({ actor: hero }, { actor: orc }); combat.combatant = { actor: hero };
const baseVals = { via: "foci:rod", ap: 2, core2: "", base: 1 };
const cast = (core, extra = {}) => { hero.system.ap.value = 6; hero.system.rp.value = 6; hero.system.energy.value = 200; return C.castSpell(hero, { ...baseVals, core1: core, ...extra }); };
const last = () => messages.at(-1);
const target = a => { game.user.targets = new Set(a ? [{ actor: a, name: a.name, document: {} }] : []); };
const power = () => S.spellPower(C.castContext(hero).options.find(o => o.key === "foci:rod").scaling);
const dodgeDie0 = orc.system.derived.dodgeDie;

console.log("== Profiles");
ok2(power() === 3, "Rod at Grade 3 gives Spell Power 3");
ok2(FX.profileFor(["magic-gravity:force", "magic-slashing:cut"]).force.n === 8 && FX.profileFor(["magic-slashing:cut", "magic-gravity:force"]).name === "Force + Cut", "Combos are order-independent");
ok2(FX.profileFor(["magic-heat:flame"]) === null, "Other spells aren't automated yet");
ok2(FX.damageDice(FX.profileFor(["magic-slashing:cut"]), 3, { living: true, direct: true }).sides === 10, "Cut: d6 → d10 on a living target with direct damage");
ok2(FX.damageDice(FX.profileFor(["magic-slashing:cut"]), 3, { living: true, direct: false }).sides === 6, "Cut: stays d6 without direct damage");
ok2(FX.damageDice(FX.profileFor(["magic-slashing:cut"]), 3, {}).n === 6, "Cut: 2d6 × Spell Power 3 = 6 dice");
ok2(FX.shieldHealth(FX.profileFor(["magic-protection-arcana:shield"]), 3) === 60, "Shield: 20 × 3 health");

console.log("== Cut: living target, direct damage → d10");
target(orc); seq = [25]; formulas.length = 0;
let res = await cast("magic-slashing:cut");
ok2(res?.ok && /Cut/.test(text(messages[0])), "Cut is cast");
const atk = messages.find(m => m.flags?.flowstate?.attack);
ok2(!!atk && atk.flags.flowstate.attack.opts.spell.power === 3, "Attack card carries the spell and its Power");
ok2(atk.flags.flowstate.attack.opts.damage === "6d6", "Attack card shows 2d6 × 3");
seq = [12]; await actions.defend(atk, 0, "dodge");
const def = last(); ok2(def.flags.flowstate.defense.result.hit, "25 vs dodge 12 hits");
seq = [30]; formulas.length = 0; await actions.rollExchangeDamage(def);
ok2(formulas.includes("6d10"), `damage rolled as 6d10 (${formulas.filter(f => /d\d+$/.test(f)).join(",")})`);
ok2(/Living target/.test(text(last())), "Card explains the bigger dice");
ok2(orc.system.hp.value < 432, `Orc lost HP (${orc.system.hp.value})`);

console.log("== Cut: a Shield in the way means no direct damage → d6");
orc.system.hp.value = 432;
await orc.createEmbeddedDocuments("ActiveEffect", [{ name: "Shield", flags: { flowstate: { spellEffect: { kind: "shield", caster: "Actor.Ally", hp: 500, max: 500 } } } }]);
target(orc); seq = [25]; await cast("magic-slashing:cut");
const atkB = messages.filter(m => m.flags?.flowstate?.attack).at(-1);
seq = [12]; await actions.defend(atkB, 0, "dodge");
seq = [30]; formulas.length = 0; await actions.rollExchangeDamage(last());
ok2(formulas.includes("6d6"), "damage stays 6d6");
ok2(/Shield absorbed/.test(text(last())), "the Shield absorbed it");
ok2(orc.effects[0].flags.flowstate.spellEffect.hp < 500 && orc.system.hp.value === 432, `Shield health dropped (${orc.effects[0].flags.flowstate.spellEffect.hp}), HP untouched`);
await orc.effects[0].delete();

console.log("== Stab: crit adds a Strengthened stack");
orc.system.hp.value = 432; target(orc); seq = [100]; await cast("magic-piercing:stab");
const atkC = messages.filter(m => m.flags?.flowstate?.attack).at(-1);
seq = [10]; await actions.defend(atkC, 0, "dodge");
ok2(last().flags.flowstate.defense.result.crit, "100 vs dodge 10 crits");
seq = [10]; await actions.rollExchangeDamage(last());
ok2(/\+1 added/.test(text(last())) || /added/.test(text(last())), "extra Strengthened stack from Stab's crit rider");

console.log("== Slam: dodge dice shrink, then end at the caster's next turn");
orc.system.hp.value = 432; target(orc); seq = [25]; await cast("magic-crushing:slam");
const atkD = messages.filter(m => m.flags?.flowstate?.attack).at(-1);
seq = [12]; await actions.defend(atkD, 0, "dodge");
ok2(orc.system.derived.dodgeDie === dodgeDie0 - 6, `Orc's dodge die ${dodgeDie0} → ${orc.system.derived.dodgeDie} (−2 × Power 3)`);
await actions.clearSpellEffects(hero);
ok2(orc.system.derived.dodgeDie === dodgeDie0 && orc.effects.length === 0, "Effect ends when Hero's next turn starts");

console.log("== Force: applies Force and offers a push");
orc.system.hp.value = 432; target(orc); seq = [20]; await cast("magic-gravity:force");
const atkE = messages.filter(m => m.flags?.flowstate?.attack).at(-1);
ok2(atkE.flags.flowstate.attack.opts.damage === "", "Force deals no damage");
seq = [12, 400]; formulas.length = 0; await actions.defend(atkE, 0, "dodge");
ok2(formulas.includes("24d10"), "Force dice: 8d10 × 3");
const fm = last().flags.flowstate.knockback; 
ok2(fm && fm.force === 400 && fm.feet === Math.floor((400 - Math.floor(orc.system.hp.max / 2)) / 10), `Force 400 → ${fm?.feet} ft push offered`);

console.log("== Shield: absorbs damage, then breaks");
target(null); seq = [25]; await cast("magic-protection-arcana:shield");
const atkF = messages.filter(m => m.flags?.flowstate?.attack).at(-1);
ok2(atkF.flags.flowstate.attack.targets[0].uuid === hero.uuid, "No target: the Shield goes on the caster");
seq = [12]; await actions.defend(atkF, 0, "none");
const sh = hero.effects.find(e => e.flags.flowstate.spellEffect?.kind === "shield");
ok2(sh && sh.flags.flowstate.spellEffect.hp === 60, "Shield has 20 × 3 = 60 health");
let out = await actions.damageOutcome(hero, 25, "physical");
ok2(out.toHp === 0 && out.shields[0].hp === 35, "25 damage is absorbed (35 left)");
out = await actions.damageOutcome(hero, 100, "magical");
ok2(out.toHp === 40 && out.shields[0].hp === 0, "100 damage: 60 absorbed, 40 gets through");
hero.system.hp.value = 432;
await actions.applyDamage(hero, 100, "physical", { silent: true });
ok2(!hero.effects.some(e => e.flags.flowstate.spellEffect?.kind === "shield") && hero.system.hp.value === 392, "A broken Shield ends and the rest hits HP");

console.log("== Combo Force + Cut: direct damage applies Force");
orc.system.hp.value = 432; target(orc); seq = [25]; await cast("magic-gravity:force", { core2: "magic-slashing:cut" });
const atkG = messages.filter(m => m.flags?.flowstate?.attack).at(-1);
ok2(atkG.flags.flowstate.attack.opts.damage === "12d6", "Force + Cut: 4d6 × 3");
seq = [12]; await actions.defend(atkG, 0, "dodge");
seq = [30, 500]; formulas.length = 0; await actions.rollExchangeDamage(last());
ok2(formulas.includes("24d10"), "…then 8d10 × 3 Force");
ok2(last().flags.flowstate.knockback?.force > 0 && (last().content.match(/fs-knockback"/g) ?? []).length === 1, "One Force button on the damage card");

console.log("== Combo Force + Stab: Force only on a crit");
orc.system.hp.value = 432; target(orc); seq = [25]; await cast("magic-gravity:force", { core2: "magic-piercing:stab" });
const atkH = messages.filter(m => m.flags?.flowstate?.attack).at(-1);
seq = [20]; formulas.length = 0; await actions.defend(atkH, 0, "dodge");
ok2(!last().flags.flowstate.knockback, "A plain hit applies no Force");
orc.system.hp.value = 432; target(orc); seq = [100]; await cast("magic-gravity:force", { core2: "magic-piercing:stab" });
const atkI = messages.filter(m => m.flags?.flowstate?.attack).at(-1);
seq = [10, 600]; formulas.length = 0; await actions.defend(atkI, 0, "dodge");
ok2(formulas.includes("60d10") && last().flags.flowstate.knockback?.force >= 600, "A crit applies 20d10 × 3 = 60d10 Force");

console.log("== Combo Cut + Slam: attack dice shrink on direct damage");
orc.system.hp.value = 432; const attackDie0 = orc.system.derived.attackDie; target(orc); seq = [25]; await cast("magic-slashing:cut", { core2: "magic-crushing:slam" });
const atkJ = messages.filter(m => m.flags?.flowstate?.attack).at(-1);
seq = [12]; await actions.defend(atkJ, 0, "dodge");
seq = [30]; await actions.rollExchangeDamage(last());
ok2(orc.system.derived.attackDie === attackDie0 - 15, `Orc's attack die ${attackDie0} → ${orc.system.derived.attackDie} (−5 × 3)`);
await actions.clearSpellEffects(hero);

console.log("== Combo Stab + Slam: three times the dice on a crit against a low dodge");
orc.system.hp.value = 432; target(orc); seq = [100]; await cast("magic-piercing:stab", { core2: "magic-crushing:slam" });
const atkK = messages.filter(m => m.flags?.flowstate?.attack).at(-1);
seq = [5]; await actions.defend(atkK, 0, "dodge");
seq = [30]; formulas.length = 0; await actions.rollExchangeDamage(last());
ok2(formulas.includes("18d12"), `2d12 × 3 × 3 = 18d12 (${formulas.filter(f => /d12$/.test(f)).join(",")})`);
await actions.clearSpellEffects(hero);

console.log("== Rituals");
combat.started = false; hero.system.energy.value = 200;
target(orc); res = await cast("magic-slashing:cut", { ritual: true });
const rit = hero.effects.find(e => e.flags.flowstate.ritual);
ok2(rit?.flags.flowstate.ritual.freeCasts === 2, "A Cut Ritual stores two free casts");
ok2(!messages.slice(-2).some(m => m.flags?.flowstate?.attack), "The ritual itself fires no attack");
combat.started = true; combat.combatant = { actor: hero };
res = await cast("magic-slashing:cut", { useRitual: rit.id });
ok2(res?.ok && res.energy === 0 && rit.flags.flowstate.ritual.freeCasts === 1, "A free cast costs no Energy and uses one charge");
res = await cast("magic-slashing:cut", { useRitual: rit.id });
ok2(!hero.effects.some(e => e.flags.flowstate.ritual), "The second free cast ends the Ritual");
res = await cast("magic-gravity:force", { useRitual: "none" });
ok2(res === null, "A free cast from a Ritual that doesn't exist is refused");

console.log(fails ? `\n${fails} FAILED` : "\nAll Tier 1 spell checks passed");
if (fails) process.exit(1);
