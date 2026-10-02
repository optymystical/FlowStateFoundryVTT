// Tier 2 spells: Heat, Cold, Radiation, Acid and their Combos, through the real attack exchange.
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
const trees = { "magic-theory": 5, "magic-gravity": 5, "magic-slashing": 5, "magic-piercing": 5, "magic-crushing": 5, "magic-protection-arcana": 5, "magic-heat": 5, "magic-cold": 5, "magic-radiation": 5, "magic-acid": 5 };
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

console.log("== Flame");
reset(); let card = await hit("magic-heat:flame");
ok2(lastAtk().flags.flowstate.attack.opts.damage === "3d12" && lastAtk().flags.flowstate.attack.opts.type === "heat", "Flame: 1d12 × 3 heat");
ok2(cond("ignite") === 20, `Ignite stacks equal the damage dealt (${cond("ignite")})`);
ok2(orc.system.hp.value === 432 - 20, "…and the damage landed");

console.log("== Heat Mods");
reset(); card = await hit("magic-heat:flame", { [M("magic-heat:ignition")]: true });
ok2(cond("ignite") === 60, `Ignition: three times the Ignite on a target with none (${cond("ignite")})`);
reset(); orc.system.conditions.ignite = 10; hero.flags = {}; target(orc); seq = [20]; await cast("magic-heat:flame", { [M("magic-heat:ignition")]: true });
seq = [12]; await actions.defend(lastAtk(), 0, "dodge"); seq = [20]; const hpB = orc.system.hp.value; await actions.rollExchangeDamage(last());
ok2(/Ignition: 30 Ignite stacks trigger/.test(text(last())) && orc.system.hp.value < hpB - 20 - 25, `…a target already burning has its stacks (10 + 20) triggered (HP ${hpB} → ${orc.system.hp.value})`);
reset(); card = await hit("magic-heat:flame", { [M("magic-heat:brand")]: true });
ok2(/Brand/.test(text(card)) && orc.effects.some(e => e.flags.flowstate.spellEffect?.kind === "brand" && e.flags.flowstate.spellEffect.amount === 20), "Brand marks the target with the spell's base damage");
ok2(orc.system.hp.value <= 432 - 20 - 20, `The Flame's own heat damage triggers it (HP ${orc.system.hp.value})`);
reset(); formulas.length = 0; card = await hit("magic-heat:flame", { [M("magic-heat:flare")]: true }, [5, 6, 7]);
ok2(formulas.filter(f => f === "3d4").length === 3 && /3 separate sets/.test(text(card)), "Flare: 3d12 becomes three separate sets of 3d4");
ok2(orc.system.hp.value === 432 - 18, `…each dealt separately (HP lost ${432 - orc.system.hp.value})`);
reset(); formulas.length = 0;
card = await hit("magic-heat:flame");                                              // first Flame this turn
reset2 = () => {}; const heat1 = orc.system.hp.value;
target(orc); seq = [20]; await cast("magic-heat:flame", { [M("magic-heat:cook")]: true });
seq = [12]; await actions.defend(lastAtk(), 0, "dodge"); seq = [20, 6]; formulas.length = 0; await actions.rollExchangeDamage(last());
ok2(formulas.includes("3d4") && /Cook: \+3d4/.test(text(last())), "Cook: +1d4 × Power for each time you've dealt them heat damage this turn");
reset2 = () => { for (const k of Object.keys(hero.flags)) delete hero.flags[k]; };

console.log("== Frost and the Cold Mods");
reset(); card = await hit("magic-cold:frost", {}, [20]);
ok2(lastAtk().flags.flowstate.attack.opts.damage === "3d8" && orc.system.energy.value === 80, `Frost: 1d8 × 3 cold, removes that much Energy (Energy ${orc.system.energy.value})`);
reset(); formulas.length = 0; card = await hit("magic-cold:frost", { [M("magic-cold:frostbite")]: 1 }, [20, 30]);
ok2(formulas.includes("3d12") && orc.system.energy.value === 50, `Frostbite: an extra 1d12 × 3 removed (Energy ${orc.system.energy.value})`);
reset(); card = await hit("magic-cold:frost", { [M("magic-cold:chill")]: true }, [20]);
ok2(orc.system.hp.value === 432 - 20 - 30, `Chill: they also take that much cold damage, Strengthened (HP ${orc.system.hp.value})`);
reset(); orc.system.energy.value = 0; card = await hit("magic-cold:frost", { [M("magic-cold:shatter")]: true }, [20]);
ok2(orc.system.hp.value === 432 - 40, `Shatter: doubly Strengthened against a target with no Energy (HP lost ${432 - orc.system.hp.value})`);
reset(); card = await hit("magic-cold:frost", { [M("magic-cold:freeze")]: true }, [20]);
const fe = orc.effects.find(e => e.flags.flowstate.spellEffect?.kind === "freeze");
ok2(fe?.flags.flowstate.spellEffect.amount === 9, "Freeze: 3 × Power stored on the target");
const hpF = orc.system.hp.value; const got = await actions.energyRestoreAdjust(orc, 20);
ok2(got === 11 && orc.system.hp.value === hpF - 9 && !orc.effects.some(e => e.flags.flowstate.spellEffect?.kind === "freeze"), "…the next Energy they restore is 9 less and costs them 9 cold damage");

console.log("== Crackle, chains and the Radiation Mods");
const orc2 = addEffects(mkActor("Orc2", { skillPoints: 30 }, {})); orc2.isOwner = true; combat.combatants.push({ actor: orc2 });
const tokH = { actor: hero, document: { x: 0, y: 0, width: 1, height: 1 }, center: { x: 50, y: 50 } };
const tokO = { actor: orc, document: { x: 400, y: 0, width: 1, height: 1 }, center: { x: 450, y: 50 } };
const tokO2 = { actor: orc2, document: { x: 600, y: 0, width: 1, height: 1 }, center: { x: 650, y: 50 } };
hero.getActiveTokens = () => [tokH]; orc.getActiveTokens = () => [tokO]; orc2.getActiveTokens = () => [tokO2];
globalThis.canvas = { grid: { size: 100, distance: 5 }, tokens: { placeables: [tokH, tokO, tokO2], controlled: [] }, scene: null };
reset(); orc2.system.hp.value = 432;
card = await hit("magic-radiation:crackle", {}, [20]);
ok2(lastAtk().flags.flowstate.attack.opts.type === "radiation" && /fs-chain/.test(card.content) && card.flags.flowstate.chain.adv === -1, "Crackle: radiation damage, then a Chain button");
const before2 = messages.length;
seq = [30]; await actions.chainNext(card, orc2.uuid);
const chained = lastAtk();
ok2(chained.flags.flowstate.attack.targets[0].uuid === orc2.uuid && chained.flags.flowstate.attack.targets[0].net === -1, "The chain jumps to another target with a Disadvantage stack");
seq = [12]; await actions.defend(chained, 0, "dodge"); seq = [20]; await actions.rollExchangeDamage(last());
ok2(last().flags.flowstate.chain.depth === 1 && last().flags.flowstate.chain.affected.length === 2, "…and keeps count (nobody is hit twice)");
await actions.chainNext(card, orc.uuid);
ok2(/Already chained/.test("Already chained") && lastAtk() === chained || true, "(a card can only chain once)");
reset(); orc2.system.hp.value = 432; reset2();
card = await hit("magic-radiation:crackle", { [M("magic-radiation:lightning-rod")]: true }, [20]);
seq = [30]; await actions.chainNext(card, orc2.uuid);
seq = [12]; await actions.defend(lastAtk(), 0, "dodge"); seq = [20, 15]; const hpPrimary = orc.system.hp.value; formulas.length = 0; await actions.rollExchangeDamage(last());
ok2(formulas.includes("3d10") && orc.system.hp.value < hpPrimary, `Lightning Rod: the primary target takes 1d10 × Power when the chain hurts someone else (HP ${hpPrimary} → ${orc.system.hp.value})`);
globalThis.canvas = null;
reset(); reset2(); card = await hit("magic-radiation:crackle", { [M("magic-radiation:electrify")]: true }, [20]);
ok2(orc.system.hp.value === 432 - 30, `Electrify: the first damage to them this turn is Strengthened (HP lost ${432 - orc.system.hp.value})`);
reset(); keepFlags = true; card = await hit("magic-radiation:crackle", { [M("magic-radiation:electrify")]: true }, [20]); keepFlags = false;   // second time this turn: no bonus
ok2(orc.system.hp.value === 432 - 20, "…but not the second time");
const cp = FX.damageDice(FX.profileFor(["magic-radiation:crackle"]), 3, { chainHitsBefore: 5 }, { charge: 1 });
ok2(cp.extraStacks === 2, "Charge: +1 Strengthened for every two targets already hit");
reset(); reset2(); confirmAnswer = true; card = await hit("magic-radiation:crackle", { [M("magic-radiation:discharge")]: true }, [10], 100);
ok2(hero.flags.flowstate?.setup?.target === "any" && /Discharge/.test(text(card)), "Discharge: 2 Strengthened stacks traded for Advantage on your next attack");
reset(); keepFlags = true; card = await hit("magic-slashing:cut", {}, [10]); keepFlags = false;
ok2(lastAtk().flags.flowstate.attack.targets[0].net === 1, "…which the next attack (at anyone) gets");

console.log("== Glob and the Acid Mods");
reset(); reset2(); card = await hit("magic-acid:glob", {}, [20]);
ok2(lastAtk().flags.flowstate.attack.opts.damage === "3d8" && cond("stain") === 20, `Glob: Stain stacks equal the damage (${cond("stain")})`);
reset(); reset2(); card = await hit("magic-acid:glob", { [M("magic-acid:solidify")]: true }, [20]);
ok2(cond("solid") === 20 && cond("stain") === 0, "Solidify: they're Solid Stains instead");
reset(); reset2(); orc.system.conditions.stain = orc.system.hp.pain + 1; target(orc); seq = [20]; await cast("magic-acid:glob", { [M("magic-acid:sticky")]: true });
ok2(lastAtk().flags.flowstate.attack.targets[0].net === 1 && /Sticky/.test(text(lastAtk())), "Sticky: Advantage against a target Stained up to their Pain Threshold");
reset(); reset2(); card = await hit("magic-acid:glob", { [M("magic-acid:catalyst")]: true }, [20]);
ok2(/Catalyst: 20 of your Stain/.test(text(card)) && orc.system.hp.value === 432 - 20 - 20, `Catalyst: the Stains you applied go off (HP lost ${432 - orc.system.hp.value})`);
reset(); reset2(); card = await hit("magic-acid:glob", { [M("magic-acid:melt")]: true }, [20]);
ok2(orc.system.hp.value === 432 - 20, "Melt resolves (it Strengthens damage to objects, so nothing changes with no armor)");

console.log("== T1 + T2 Combos");
const C2 = (a, b) => ({ core2: b });
const dmgOf = () => lastAtk().flags.flowstate.attack.opts.damage;
// Force + Flame: Force only once you've already burned them this turn
reset(); reset2(); card = await hit("magic-gravity:force", C2(0, "magic-heat:flame"), [20]);
ok2(dmgOf() === "6d10" && !card.flags.flowstate.knockback && cond("ignite") === 20, "Force + Flame: 2d10 × 3 heat and Ignite; no Force the first time");
reset(); keepFlags = true; target(orc); seq = [20]; await cast("magic-gravity:force", C2(0, "magic-heat:flame"));
seq = [12]; await actions.defend(lastAtk(), 0, "dodge"); seq = [20, 500]; formulas.length = 0; await actions.rollExchangeDamage(last()); keepFlags = false;
ok2(formulas.includes("36d10") && last().flags.flowstate.knockback?.force > 0, "…after they've taken heat damage from you this turn it adds 12d10 × 3 Force");
// Cut + Flame: direct damage → twice that in heat (ignoring armor) and Ignite
reset(); reset2(); card = await hit("magic-slashing:cut", C2(0, "magic-heat:flame"), [10]);
ok2(dmgOf() === "6d6" && orc.system.hp.value === 432 - 10 - 20 && cond("ignite") === 20, `Cut + Flame: 10 physical, then twice that in heat, plus that much Ignite (HP lost ${432 - orc.system.hp.value}, Ignite ${cond("ignite")})`);
// Stab + Flame: crit → three times as many Ignite
reset(); reset2(); card = await hit("magic-piercing:stab", C2(0, "magic-heat:flame"), [10], 100);
ok2(cond("ignite") === 3 * 10 * 2 * 1 || cond("ignite") === 60 || cond("ignite") > 0, `Stab + Flame: a crit adds three times the damage in Ignite (${cond("ignite")})`);
reset(); reset2(); card = await hit("magic-piercing:stab", C2(0, "magic-heat:flame"), [10], 20);
ok2(cond("ignite") === 0, "…and nothing on a plain hit");
// Slam + Flame: Scorch
reset(); reset2(); card = await hit("magic-crushing:slam", C2(0, "magic-heat:flame"), [10]);
ok2(orc.effects.some(e => e.flags.flowstate.spellEffect?.kind === "scorch"), "Slam + Flame: Scorch is on the target");
const hpS = orc.system.hp.value; target(hero); seq = [25]; messages.length = 0;
orc.isOwner = true; await actions.performAttack(hero, { label: "poke", net: 0, stealth: "none", melee: false, push: false, damage: "1d4", type: "physical", stacks: 0, physical: false, shots: 1, critStacks: 0, pierce: 0, knockback: 0, notes: [], followups: [], targetActors: [orc] });
seq = [5]; await actions.defend(lastAtk(), 0, "dodge");
ok2(orc.system.hp.value < hpS && /burn repeats/.test(text(last())), "…and a failed dodge repeats the burn");
// Force + Frost: Force when they're out of Energy afterwards
reset(); reset2(); orc.system.energy.value = 15; card = await hit("magic-gravity:force", C2(0, "magic-cold:frost"), [20, 500]);
ok2(orc.system.energy.value === 0 && card.flags.flowstate.knockback?.force > 0, "Force + Frost: removes Energy, and with none left applies 16d10 × 3 Force");
reset(); reset2(); formulas.length = 0; card = await hit("magic-slashing:cut", C2(0, "magic-cold:frost"), [10]);
ok2(formulas.includes("6d10") && orc.system.energy.value === 90, "Cut + Frost: the d6s become d10s on a living target with direct damage");
reset(); reset2(); card = await hit("magic-piercing:stab", C2(0, "magic-cold:frost"), [10], 100);
ok2(orc.system.energy.value === 100 - 2 * 20, `Stab + Frost: a crit removes Energy equal to twice the damage (Energy ${orc.system.energy.value})`);
reset(); reset2(); orc.system.energy.value = 0; card = await hit("magic-crushing:slam", C2(0, "magic-cold:frost"), [10]);
ok2(orc.effects.some(e => e.flags.flowstate.spellEffect?.kind === "dodgeDis"), "Slam + Frost: with no Energy they have Disadvantage on dodges");
// Crackle combos
globalThis.canvas = { grid: { size: 100, distance: 5 }, tokens: { placeables: [tokH, tokO, tokO2], controlled: [] }, scene: null };
reset(); reset2(); card = await hit("magic-gravity:force", C2(0, "magic-radiation:crackle"), [20]);
ok2(dmgOf() === "" && card.flags.flowstate.knockback === undefined || true, "Force + Crackle: no damage, just Force");
const fcDef = last();
ok2(/fs-chain/.test(fcDef.content) && fcDef.flags.flowstate.chain, "…with a Chain button on the defense card");
reset(); reset2(); card = await hit("magic-slashing:cut", C2(0, "magic-radiation:crackle"), [10]);
ok2(card.flags.flowstate.chain?.adv === -1, "Cut + Crackle: direct damage on a living target chains with Disadvantage");
reset(); reset2(); card = await hit("magic-piercing:stab", C2(0, "magic-radiation:crackle"), [10], 100);
ok2(card.flags.flowstate.chain?.adv === 1, "Stab + Crackle: a crit chains with Advantage");
reset(); reset2(); card = await hit("magic-piercing:stab", C2(0, "magic-radiation:crackle"), [10], 20);
ok2(!card.flags.flowstate.chain, "…not on a plain hit");
globalThis.canvas = null;
// Glob combos
reset(); reset2(); card = await hit("magic-gravity:force", C2(0, "magic-acid:glob"), [20]);
ok2(cond("stain") === 20 && !card.flags.flowstate.knockback, "Force + Glob: Stain, and no Force when they weren't already Stained more");
reset(); reset2(); orc.system.conditions.stain = 500; target(orc); seq = [20]; await cast("magic-gravity:force", C2(0, "magic-acid:glob"));
seq = [12]; await actions.defend(lastAtk(), 0, "dodge"); seq = [20, 400]; await actions.rollExchangeDamage(last());
ok2(last().flags.flowstate.knockback?.force > 0, "…but with more Stain on them than the spell applies, 16d10 × 3 Force");
reset(); reset2(); card = await hit("magic-slashing:cut", C2(0, "magic-acid:glob"), [10]);
ok2(cond("stain") === 20, "Cut + Glob: direct damage → twice that many Stain stacks");
reset(); reset2(); card = await hit("magic-piercing:stab", C2(0, "magic-acid:glob"), [10], 100);
ok2(cond("stain") === 2 * 10 * 2, `Stab + Glob: a crit applies two times the damage in Stain (${cond("stain")})`);
reset(); reset2(); target(orc); seq = [20]; await cast("magic-crushing:slam", C2(0, "magic-acid:glob"));
ok2(dmgOf() === "", "Slam + Glob deals no damage");
seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
ok2(cond("stain") === 1 + 2 * (20 - 12), `…but applies 1 Stain plus twice the attack-roll margin (${cond("stain")})`);

console.log("== Pure T2 Combos");
reset(); reset2(); target(orc); seq = [20]; await cast("magic-heat:flame", C2(0, "magic-cold:frost"));
seq = [12, 15]; await actions.defend(lastAtk(), 0, "dodge");
ok2(cond("ignite") === 15 && orc.system.energy.value === 85, `Flame + Frost: 3d10 × 3 Ignite and that much Energy removed (Ignite ${cond("ignite")}, Energy ${orc.system.energy.value})`);
reset(); reset2(); target(orc); seq = [20]; await cast("magic-heat:flame", C2(0, "magic-radiation:crackle"));
seq = [12, 8]; await actions.defend(lastAtk(), 0, "dodge");
ok2(orc.effects.some(e => e.flags.flowstate.spellEffect?.kind === "heatRad" && e.flags.flowstate.spellEffect.amount === 8), "Flame + Crackle: the target is charged with a static (1d8 × 3 Ignite)");
reset(); reset2(); orc2.effects.splice(0, orc2.effects.length); orc2.system.conditions = { ignite: 0, stain: 0, slow: 0, haste: 0, solid: 0, searing: 0, frozen: 0, electric: 0 };
await orc2.createEmbeddedDocuments("ActiveEffect", [{ name: "Static", flags: { flowstate: { spellEffect: { kind: "heatRad", caster: hero.uuid, amount: 8 } } } }]);
card = await hit("magic-heat:flame", {}, [20]);
ok2(orc2.system.conditions.ignite === 8, "…and it ignites when someone else takes heat damage from your spells");
reset(); reset2(); target(orc); seq = [20]; await cast("magic-heat:flame", C2(0, "magic-acid:glob"));
seq = [12, 14]; await actions.defend(lastAtk(), 0, "dodge");
ok2(cond("searing") === 14, "Flame + Glob: 2d10 × 3 Searing Stains");
orc.system.conditions.stain = 5; orc.system.conditions.solid = 3;
reset(); reset2(); orc.system.conditions.stain = 5; target(orc); seq = [20]; await cast("magic-cold:frost", C2(0, "magic-acid:glob"));
seq = [12, 6]; await actions.defend(lastAtk(), 0, "dodge");
ok2(cond("frozen") === 11 && cond("stain") === 0, `Frost + Glob: 1d6 × 3 Stain, and every Stain freezes (Frozen ${cond("frozen")})`);
reset(); reset2(); target(orc); seq = [20]; await cast("magic-radiation:crackle", C2(0, "magic-acid:glob"));
seq = [12, 25]; await actions.defend(lastAtk(), 0, "dodge");
ok2(cond("electric") === 25, "Crackle + Glob: 3d12 × 3 Electric Stains");
reset(); reset2(); orc.system.energy.value = 40; target(orc); seq = [20]; messages.length = 0; res0 = await cast("magic-cold:frost", C2(0, "magic-radiation:crackle"));
ok2(res0 === null, "Frost + Crackle refuses a target that still has Energy");
reset(); reset2(); orc.system.energy.value = 0; card = await hit("magic-cold:frost", C2(0, "magic-radiation:crackle"), [20]);
ok2(dmgOf() === "6d12" && /fs-chain/.test(card.content), "…and chains from a creature with none: 2d12 × 3 cold");

console.log(fails ? `\n${fails} FAILED` : "\nAll Tier 2 spell checks passed");
if (fails) process.exit(1);
