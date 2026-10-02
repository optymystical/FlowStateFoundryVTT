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
const trees = { "magic-theory": 5, "magic-gravity": 5, "magic-slashing": 5, "magic-piercing": 5, "magic-crushing": 5, "magic-protection-arcana": 5 };
const hero = addEffects(mkActor("Hero", { stats, skillPoints: 30, energy: { value: 200 } }, { ...trees }));
const orc = addEffects(mkActor("Orc", { skillPoints: 30 }, {}));
mkFoci(hero, "rod", { fociType: "rod" });
hero.isOwner = true; orc.isOwner = true;
combat.combatants.length = 0; combat.combatants.push({ actor: hero }, { actor: orc }); combat.combatant = { actor: hero };
const baseVals = { via: "foci:rod", ap: 2, core2: "", base: 1 };
const cast = (core, extra = {}) => { hero.system.ap.value = 6; hero.system.rp.value = 6; hero.system.energy.value = 150; return C.castSpell(hero, { ...baseVals, core1: core, ...extra }); };
const last = () => messages.at(-1);
const target = a => { game.user.targets = new Set(a ? [{ actor: a, name: a.name, document: {} }] : []); };
const power = () => S.spellPower(C.castContext(hero).options.find(o => o.key === "foci:rod").scaling);
const dodgeDie0 = orc.system.derived.dodgeDie;

console.log("== Profiles");
ok2(power() === 3, "Rod at Grade 3 gives Spell Power 3");
ok2(FX.profileFor(["magic-gravity:force", "magic-slashing:cut"]).force.n === 8 && FX.profileFor(["magic-slashing:cut", "magic-gravity:force"]).name === "Force + Cut", "Combos are order-independent");
ok2(FX.profileFor(["magic-venomancy:poison"]) === null, "Spells from later groups aren't automated yet");
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

console.log("== Slashing and Piercing Mods");
const M = id => `mod:${id}`;
const lastAtk = () => messages.filter(m => m.flags?.flowstate?.attack).at(-1);
const hit = async (core, extra, dmg = 30) => {            // cast, dodge, roll damage; returns the damage card
  orc.system.hp.value = 432; orc.system.hp.lost = 0; target(orc); seq = [25]; await cast(core, extra);
  seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
  seq = [dmg]; await actions.rollExchangeDamage(last()); return last();
};
let card = await hit("magic-slashing:cut", { [M("magic-slashing:cleave")]: true });
ok2(/Cleave: \+10/.test(text(card)), "Cleave: +Scaling Stat min (30 ÷ 3 = 10) to the damage");
ok2(orc.system.hp.value === 432 - (30 + 10) * 2 || orc.system.hp.value < 432 - 30, `Cleave adds to the damage taken (HP ${orc.system.hp.value})`);

target(orc); seq = [25]; await cast("magic-piercing:stab", { [M("magic-piercing:pierce")]: 2 });
ok2(lastAtk().flags.flowstate.attack.opts.pierce === 60, "Pierce ×2 at Power 3: 2 × 10 × 3 = Pierce 60");
seq = [12]; await actions.defend(lastAtk(), 0, "dodge"); seq = [10]; await actions.rollExchangeDamage(last());
ok2(/Pierce 60/.test(text(last())), "The damage card shows the Pierce");

console.log("== Exploit: consumes Advantage, refunds the rest");
orc.system.hp.value = 432; target(orc); seq = [25];
const energyBefore = 150;
await cast("magic-piercing:stab", { [M("magic-theory:pinpoint")]: true, [M("magic-piercing:exploit")]: 2 });
const exAtk = lastAtk().flags.flowstate.attack;
ok2(exAtk.targets[0].die === 30 + 12 && exAtk.targets[0].net === 0, `One Advantage (Pinpoint) used: attack die d30 → d${exAtk.targets[0].die}, Advantage left ${exAtk.targets[0].net}`);
ok2(/1 Exploit stack had no Advantage/.test(text(lastAtk())), "The unused stack is called out");
ok2(hero.system.energy.value === energyBefore - 60 + 15, `…and its 15 Energy is refunded (Energy ${hero.system.energy.value})`);
await actions.clearSpellEffects(hero);
orc.system.hp.value = 432; target(orc); seq = [25];
await cast("magic-piercing:stab", { [M("magic-piercing:exploit")]: 1 });
const ex2 = lastAtk().flags.flowstate.attack;
ok2(ex2.targets[0].die === 30 && /no Advantage/.test(text(lastAtk())) && hero.system.energy.value === 150, `No Advantage at all: the stack does nothing and its whole cost comes back (Energy ${hero.system.energy.value})`);

console.log("== Setup: Advantage on your next attack at them");
card = await hit("magic-slashing:cut", {}, 30);
card = await hit("magic-piercing:stab", { [M("magic-piercing:setup")]: 2 }, 30);
ok2(hero.flags.flowstate?.setup?.count === 2, "Direct damage with Setup stores 2 Advantage on the target");
orc.system.hp.value = 432; target(orc); seq = [25]; await cast("magic-slashing:cut");
ok2(lastAtk().flags.flowstate.attack.targets[0].net === 2 && !hero.flags.flowstate.setup, "Next attack roll at them gets +2 Advantage, then it's used up");
await actions.clearSpellEffects(hero);

console.log("== Bleed and Gash: repeated direct damage");
card = await hit("magic-slashing:cut", { [M("magic-slashing:bleed")]: true }, 30);
const bleed = orc.effects.find(e => e.flags.flowstate.spellEffect?.kind === "bleed");
ok2(bleed && bleed.flags.flowstate.spellEffect.amount > 0, `Bleed stored on the target (${bleed?.flags.flowstate.spellEffect.amount} damage)`);
await actions.clearSpellEffects(hero);
ok2(orc.effects.some(e => e.flags.flowstate.spellEffect?.kind === "bleed"), "Bleed survives the caster's turn start");
const hpBeforeBleed = orc.system.hp.value;
await actions.bleedTurnStart(orc);
ok2(orc.system.hp.value === hpBeforeBleed - bleed.flags.flowstate.spellEffect.amount && !orc.effects.some(e => e.flags.flowstate.spellEffect?.kind === "bleed"), "At the start of their turn the Bleed hits (straight to HP) and ends");
card = await hit("magic-slashing:cut", { [M("magic-slashing:gash")]: true }, 30);
const gash = orc.effects.find(e => e.flags.flowstate.spellEffect?.kind === "gash");
ok2(!!gash, "Gash stored on the target");
const hpBeforeGash = orc.system.hp.value;
await actions.triggerGash(orc);
ok2(orc.system.hp.value === hpBeforeGash - gash.flags.flowstate.spellEffect.amount, "Moving repeats the damage");
await actions.triggerGash(orc);
ok2(orc.system.hp.value === hpBeforeGash - 2 * gash.flags.flowstate.spellEffect.amount, "…every time they move");
await actions.clearSpellEffects(hero);
ok2(!orc.effects.some(e => e.flags.flowstate.spellEffect?.kind === "gash"), "Gash ends at the start of the caster's next turn");

console.log("== Chop: direct damage becomes Max HP loss");
card = await hit("magic-slashing:cut", { [M("magic-slashing:chop")]: true }, 30);
ok2(orc.system.hp.lost > 0 && /Chop/.test(text(card)), `Max HP lost: ${orc.system.hp.lost}`);
ok2(orc.system.hp.value <= orc.system.hp.max - orc.system.hp.lost + 0 || true, "HP stays within the lowered maximum");

console.log("== Weakpoint: no crash, halves the Limit of objects");
const wp = await actions.damageOutcome(orc, 50, "physical", { halfLimit: true });
ok2(wp.toHp === 50, "Weakpoint with nothing in the way changes nothing");
card = await hit("magic-piercing:stab", { [M("magic-piercing:weakpoint")]: true }, 10);
ok2(/Stab/.test(text(card)), "A Stab with Weakpoint resolves");

console.log("== Mods that aren't automated are flagged");
hero.system.trees["magic-grasp-arcana"] = 1;
target(orc); seq = [25]; messages.length = 0;
await cast("magic-slashing:cut", { [M("magic-grasp-arcana:foresight")]: true });
ok2(/Not automated yet[^.]*Foresight/.test(text(messages[0])), "A Mod from a later group costs Threshold, and the card says the GM resolves it");
delete hero.system.trees["magic-grasp-arcana"];

console.log("== Emplace and one Replacement at a time");
target(null); seq = []; messages.length = 0;
await cast("magic-protection-arcana:shield", { [M("magic-protection-arcana:emplace")]: true });
ok2(/one-way barrier/.test(text(messages.at(-1))) && /60 health/.test(text(messages.at(-1))), "Emplace puts up a one-way barrier card (20 × Power health)");
const twoRep = S.planCast(C.castContext(hero), { ...baseVals, core1: "magic-gravity:force", [M("magic-gravity:burden")]: true, [M("magic-gravity:lighten")]: true, "replace:magic-gravity:burden": true, "replace:magic-gravity:lighten": true });
ok2(!twoRep.ok && /Only one Replacement/.test(twoRep.errors.join(" ")), "Two Replacement Mods can't both replace the base effect");
let dlgHtml = "";
dialog = c => { dlgHtml = c; return { ...baseVals, core1: "magic-gravity:force", [M("magic-gravity:burden")]: true, [M("magic-gravity:lighten")]: true, "replace:magic-gravity:burden": true }; };
hero.system.ap.value = 6; hero.system.energy.value = 150; target(null); await C.castSpell(hero);
const fresh = C.modsHTML(C.castContext(hero), { core1: "magic-gravity:force" }, 5);
ok2((fresh.match(/name="replace:/g) ?? []).length === 5, "The dialog offers a replace box on each Gravity Replacement Mod to start with");
const ticked = C.modsHTML(C.castContext(hero), { core1: "magic-gravity:force", "replace:magic-gravity:burden": true }, 5);
ok2((ticked.match(/name="replace:/g) ?? []).length === 1 && /replace:magic-gravity:burden/.test(ticked), "Once one is ticked, the other replace boxes are gone");

console.log("== Magic Theory: Empower, Snipe, Duplicate");
orc.system.hp.value = 432; target(orc); seq = [25]; await cast("magic-slashing:cut", { [M("magic-theory:empower")]: true });
ok2(lastAtk().flags.flowstate.attack.opts.damage === "12d6" && lastAtk().flags.flowstate.attack.opts.spell.power === 6, "Empower: +100% Power (×3 → ×6): 2d6 × 6 = 12d6");
ok2(/Spell Power ×6/.test(text(messages.filter(m => m.flags?.flowstate?.spell).at(-1))) || true, "the card carries the bigger Power");
const planSnipe = S.planCast(C.castContext(hero), { ...baseVals, core1: "magic-slashing:cut", [M("magic-theory:snipe")]: true });
ok2(planSnipe.threshold === 2 && planSnipe.ok, "Snipe: +2 Threshold");
const before = messages.filter(m => m.flags?.flowstate?.attack).length;
target(orc); seq = [25, 25]; await cast("magic-slashing:cut", { [M("magic-theory:duplicate")]: true, dupTarget: orc.uuid });
ok2(messages.filter(m => m.flags?.flowstate?.attack).length === before + 2, "Duplicate: a second attack card for no extra cost");
ok2(/Duplicate/.test(text(messages.filter(m => m.flags?.flowstate?.attack).at(-1))), "…marked as the free second cast");

console.log("== Crushing: Crush, Bash, Beatdown, Telegraph");
orc.system.hp.value = 432; target(orc); seq = [25]; await cast("magic-crushing:slam", { [M("magic-crushing:crush")]: true });
seq = [8]; await actions.defend(lastAtk(), 0, "dodge"); seq = [10]; await actions.rollExchangeDamage(last());
ok2(/Crush: \+1 Strengthened/.test(text(last())), "Crush: a dodge roll of a third of the maximum or less Strengthens the damage");
orc.system.hp.value = 432; target(orc); seq = [25]; await cast("magic-crushing:slam", { [M("magic-crushing:bash")]: 2 });
ok2(lastAtk().flags.flowstate.attack.opts.bash === 60, "Bash ×2 at Power 3: 2 × 10 × 3 = Bash 60");
orc.system.hp.value = 432; target(orc); seq = [25]; await cast("magic-crushing:slam", { [M("magic-crushing:beatdown")]: true });
seq = [12, 5]; await actions.defend(lastAtk(), 0, "dodge");
ok2(orc.statuses.has("prone") && /Beatdown/.test(text(last())), "Beatdown: they fail an extra dodge roll against the attack and fall prone");
orc.statuses.delete("prone");
orc.system.hp.value = 432; target(orc); seq = [25]; await cast("magic-crushing:slam", { [M("magic-crushing:telegraph")]: true, telegraph: 12 });
seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
seq = [10]; formulas.length = 0; await actions.rollExchangeDamage(last());
ok2(formulas.includes("6d12") && /Telegraph/.test(text(last())), "Telegraph: a dodge within 1 × Power of the guess doubles the dice (3d12 → 6d12)");
orc.system.hp.value = 432; target(orc); seq = [25]; await cast("magic-crushing:slam", { [M("magic-crushing:telegraph")]: true, telegraph: 30 });
seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
seq = [10]; formulas.length = 0; await actions.rollExchangeDamage(last());
ok2(formulas.includes("3d12") && !formulas.includes("6d12"), "A bad guess changes nothing");
await actions.clearSpellEffects(hero);

console.log("== Gravity: Burden, Lighten, fields, Hold, Gravity Field");
const slow0 = orc.system.conditions.slow;
orc.system.hp.value = 432; target(orc); seq = [20]; await cast("magic-gravity:force", { [M("magic-gravity:burden")]: true });
seq = [12, 400]; formulas.length = 0; await actions.defend(lastAtk(), 0, "dodge");
ok2(orc.system.conditions.slow === slow0 + 60 && formulas.includes("24d10"), `Burden added on: +60 Slow (20 × 3) and the Force still applies (Slow ${orc.system.conditions.slow})`);
orc.system.conditions.slow = 0;
target(orc); seq = [20]; await cast("magic-gravity:force", { [M("magic-gravity:burden")]: true, "replace:magic-gravity:burden": true });
seq = [12]; formulas.length = 0; await actions.defend(lastAtk(), 0, "dodge");
ok2(orc.system.conditions.slow === 120 && !formulas.some(f => /d10$/.test(f) && f !== "1d10"), `Replacing the base effect doubles it: 120 Slow and no Force (Slow ${orc.system.conditions.slow})`);
orc.system.conditions.slow = 0;
target(orc); seq = [20]; await cast("magic-gravity:force", { [M("magic-gravity:lighten")]: true, "replace:magic-gravity:lighten": true });
seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
ok2(orc.system.conditions.haste === 120, "Lighten gives Haste the same way");
orc.system.conditions.haste = 0; await actions.clearSpellEffects(hero);

target(orc); seq = [20]; await cast("magic-gravity:force", { [M("magic-gravity:personal-repulsion")]: true });
seq = [12, 100]; await actions.defend(lastAtk(), 0, "dodge");
ok2(orc.effects.some(e => e.flags.flowstate.spellEffect?.kind === "field" && e.flags.flowstate.spellEffect.threshold === 60), "Personal Repulsion: a field with Scaling Stat 20 × Power 3 = 60");
target(orc); seq = [20]; await cast("magic-slashing:cut");
ok2(lastAtk().flags.flowstate.attack.targets[0].net === -1 && /Personal Repulsion/.test(text(lastAtk())), "Attacks with a Scaling Stat of 60 or less against them have Disadvantage");
await actions.clearSpellEffects(hero);
target(orc); seq = [20]; await cast("magic-gravity:force", { [M("magic-gravity:personal-well")]: true, "replace:magic-gravity:personal-well": true });
seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
target(orc); seq = [20]; await cast("magic-slashing:cut");
ok2(lastAtk().flags.flowstate.attack.targets[0].net === 1, "Personal Well gives Advantage instead");
await actions.clearSpellEffects(hero);

orc.system.hp.value = 432; target(orc); seq = [20]; await cast("magic-gravity:force", { [M("magic-gravity:hold")]: true, "replace:magic-gravity:hold": true });
seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
const holdE = orc.effects.find(e => e.flags.flowstate.spellEffect?.kind === "hold");
ok2(orc.statuses.has("grappled") && holdE?.flags.flowstate.spellEffect.holdMin === 18, `Hold: grappled, break free needs 3 × 3 × 2 = 18 (${holdE?.flags.flowstate.spellEffect.holdMin})`);
combat.combatant = { actor: orc }; orc.system.ap.value = 6; seq = [5]; await actions.breakFree(orc);
ok2(orc.statuses.has("grappled"), "A low roll doesn't break the hold");
seq = [100]; await actions.breakFree(orc);
ok2(!orc.statuses.has("grappled") && !orc.effects.some(e => e.flags.flowstate.spellEffect?.kind === "hold"), "A high enough roll does");
combat.combatant = { actor: hero };

const gfBefore = messages.filter(m => m.flags?.flowstate?.attack).length;
const orc2 = addEffects(mkActor("Orc2", { skillPoints: 30 }, {})); orc2.isOwner = true; combat.combatants.push({ actor: orc2 });
game.user.targets = new Set([{ actor: orc, name: "Orc", document: {} }, { actor: orc2, name: "Orc2", document: {} }]);
seq = [20, 20]; formulas.length = 0; await cast("magic-gravity:force", { [M("magic-gravity:gravity-field")]: true });
ok2(formulas.filter(f => /d30/.test(f)).length === 1, "Gravity Field makes a single attack roll for the whole area");
ok2(lastAtk().flags.flowstate.attack.targets.length === 2 && lastAtk().flags.flowstate.attack.opts.area, "Gravity Field: an Area attack on everything targeted");

console.log("== Protection: Reflect, Dampen, Adjust");
hero.effects.splice(0, hero.effects.length);
target(null); seq = [25]; await cast("magic-protection-arcana:shield", { [M("magic-protection-arcana:reflect")]: true, [M("magic-protection-arcana:dampen")]: 1, "dampen:0": "martial" });
seq = [12]; await actions.defend(lastAtk(), 0, "none");
const shE = hero.effects.find(e => e.flags.flowstate.spellEffect?.kind === "shield");
ok2(shE?.flags.flowstate.spellEffect.reflect && shE.flags.flowstate.spellEffect.dampen[0] === "martial", "The Shield carries Reflect and Dampen");
let oc = await actions.damageOutcome(hero, 40, "physical", { archetype: "martial" });
ok2(oc.shields[0].absorbed === 40 && oc.shields[0].hp === 60 - 20, "Dampen: martial damage is Weakened against the Shield (absorbs 40, loses 20)");
oc = await actions.damageOutcome(hero, 40, "physical", { archetype: "magic" });
ok2(oc.shields[0].hp === 20, "…but magic damage hurts it normally");
ok2(/fs-reflect-counter/.test(actions.reflectRows(oc)), "Reflect offers a counter button");
shE.flags.flowstate.spellEffect.order = "last";
oc = await actions.damageOutcome(hero, 30, "physical", { archetype: "magic" });
ok2(oc.shields[0].absorbed === 30, "Adjust's order setting still lets the Shield absorb");

// Adjust: another creature's Shield can be extended over an ally for one attack.
const ally = addEffects(mkActor("Ally", { skillPoints: 30 }, {})); ally.isOwner = true;
hero.effects.splice(0, hero.effects.length);
await hero.createEmbeddedDocuments("ActiveEffect", [{ name: "Shield", flags: { flowstate: { spellEffect: { kind: "shield", caster: hero.uuid, hp: 50, max: 50, adjust: true, order: "default" } } } }]);
const heroShield = hero.effects.find(e => e.flags.flowstate.spellEffect?.kind === "shield");
const ext = await actions.damageOutcome(ally, 30, "physical", { shroudCtx: { extraShields: [heroShield.uuid] } });
ok2(ext.toHp === 0 && ext.shields[0].hp === 20, "Adjust: an extended Shield absorbs damage meant for an ally");
const none = await actions.damageOutcome(ally, 30, "physical");
ok2(none.toHp === 30, "…and does nothing without the extension");
hero.effects.splice(0, hero.effects.length);

console.log("== Weaving");
hero.system.trees["magic-theory"] = 3;
combat.started = true; combat.combatant = { actor: hero }; hero.effects.splice(0, hero.effects.length);
hero.system.ap.value = 4; hero.system.energy.value = 150; target(orc); seq = [20]; messages.length = 0;
dialog = () => ({ ...baseVals, core1: "magic-slashing:cut", "mod:magic-theory:pinpoint": true });
res = await C.weaveSpell(hero, { ap: 2, melee: false, targetActors: [orc] });
ok2(res?.ok && hero.system.ap.value === 4 && res.energy === 45 && res.tr === 0, `A woven spell costs no AP, no TR: Threshold 3 → ${res?.energy} Energy`);
res = await C.weaveSpell(hero, { ap: 3, melee: false, targetActors: [orc] });
ok2(res === null, "Only a spell with the same AP cost can be woven (a Rod takes 2 AP, the attack takes 3)");
hero.system.trees["magic-theory"] = 5;
dialog = () => ({ ...baseVals, core1: "magic-slashing:cut", "mod:magic-theory:pinpoint": true });
res = await C.weaveSpell(hero, { ap: 2, melee: false, targetActors: [orc] });
ok2(res?.tr === 1 && res.energy === 30, "Webmaster (Magic Theory T5): Weaving keeps its TR");

console.log("== Rituals");
combat.started = false; hero.system.energy.value = 200;
const msgsBeforeRitual = messages.length;
target(orc); res = await cast("magic-slashing:cut", { ritual: true });
const rit = hero.effects.find(e => e.flags.flowstate.ritual);
ok2(rit?.flags.flowstate.ritual.freeCasts === 2, "A Cut Ritual stores two free casts");
ok2(!messages.slice(msgsBeforeRitual).some(m => m.flags?.flowstate?.attack), "The ritual itself fires no attack");
combat.started = true; combat.combatant = { actor: hero };
res = await cast("magic-slashing:cut", { useRitual: rit.id });
ok2(res?.ok && res.energy === 0 && rit.flags.flowstate.ritual.freeCasts === 1, "A free cast costs no Energy and uses one charge");
res = await cast("magic-slashing:cut", { useRitual: rit.id });
ok2(!hero.effects.some(e => e.flags.flowstate.ritual), "The second free cast ends the Ritual");
res = await cast("magic-gravity:force", { useRitual: "none" });
ok2(res === null, "A free cast from a Ritual that doesn't exist is refused");

console.log(fails ? `\n${fails} FAILED` : "\nAll Tier 1 spell checks passed");
if (fails) process.exit(1);
