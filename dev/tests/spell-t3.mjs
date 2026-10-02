// Tier 3 spells: Poison, Charm, Hex, their Combos and Mods, through the real attack exchange.
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
const trees = { "magic-theory": 5, "magic-gravity": 5, "magic-slashing": 5, "magic-piercing": 5, "magic-crushing": 5, "magic-protection-arcana": 5, "magic-heat": 5, "magic-cold": 5, "magic-radiation": 5, "magic-acid": 5, "magic-grasp-arcana": 5, "magic-venomancy": 5, "magic-charm": 5, "magic-witchery": 5 };
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

const A = await import("../../module/afflictions.mjs");
const putEffect = (a, e) => actions.applySpellEffect(a, e);
const lastMsgWith = k => messages.filter(m => m.flags?.flowstate?.[k]).at(-1);
const eff = (a, kind) => a.effects.filter(e => e.flags.flowstate.spellEffect?.kind === kind);
const clean = () => { for (const a of [orc, gob]) { a.effects.splice(0, a.effects.length); a.flags = {}; a.system.hp.value = 432; a.system.hp.lost = 0; a.system.energy.value = 100; a.system.conditions = { ignite: 0, stain: 0, slow: 0, haste: 0, solid: 0, searing: 0, frozen: 0, electric: 0 }; a.system.prepareDerivedData(); }
  for (const k of Object.keys(hero.flags)) delete hero.flags[k]; hero.effects.splice(0, hero.effects.length); messages.length = 0; };
// A spell with no damage: cast, miss/hit, defend with a 12 dodge.
const land = async (core, extra = {}, atkRoll = 20, core2 = "") => { target(orc); seq = [atkRoll]; await cast(core, { core2, ...extra }); seq = [12]; await actions.defend(lastAtk(), 0, "dodge"); return last(); };

console.log("== Profiles");
const T3_CORES = ["magic-venomancy:poison", "magic-charm:charm", "magic-witchery:hex"];
ok2(T3_CORES.every(c => FX.profileFor([c])?.afflict), "Poison, Charm and Hex are automated");
const SCHOOLS = ["magic-gravity:force", "magic-slashing:cut", "magic-piercing:stab", "magic-crushing:slam", "magic-heat:flame", "magic-cold:frost", "magic-radiation:crackle", "magic-acid:glob"];
const wanted = [];
for (const s of SCHOOLS) for (const t of T3_CORES) if (!(t === "magic-witchery:hex" && ["magic-slashing:cut", "magic-piercing:stab"].includes(s))) wanted.push([s, t]);
ok2(wanted.every(p => FX.profileFor(p)?.afflict), `Every listed T1/T2 + T3 Combo is automated (${wanted.length})`);
ok2(FX.profileFor(["magic-venomancy:poison", "magic-charm:charm"]) && FX.profileFor(["magic-venomancy:poison", "magic-witchery:hex"]) && FX.profileFor(["magic-charm:charm", "magic-witchery:hex"]), "…and the three pure T3 Combos");
ok2(FX.poisonSides(6, 1, 2) === 12 && FX.hexSides(12, 1, 2) === 24 && FX.charmRequirement(3, 1) === 1 && FX.charmRequirement(3, 2) === 0, "Lethality, Fester and Ingrained maths");
ok2(!FX.poisonEnds({ passed: false, procs: 1 }) === false && FX.poisonEnds({ passed: false, procs: 1, prolong: 1 }) === false && FX.poisonEnds({ passed: false, procs: 2, prolong: 1 }) === true && FX.poisonEnds({ passed: false, procs: 5, ritual: true }) === false && FX.poisonEnds({ passed: true, procs: 0, ritual: true }) === true, "A Poison ends after one tick, after Prolong's applications, on a pass, or (Ritual) only on a pass");

console.log("== Poison: the coat");
clean(); await land("magic-venomancy:poison");
const coat = eff(orc, "coat")[0];
ok2(coat && coat.flags.flowstate.spellEffect.poison.n === 9 && coat.flags.flowstate.spellEffect.poison.sides === 6, "A hit coats the target with a Poison of 3d6 × Power (9d6)");
const coatCard = lastMsgWith("afflict");
ok2(coatCard?.flags.flowstate.afflict.acts[0].act === "pass" && /Pass the Poison/.test(coatCard.content), "…and posts a 'Pass the Poison' button");
ok2(!/fs-roll-damage/.test(last().content), "Poison deals no damage on the hit");
target(gob);
await A.act(coatCard, 0);
ok2(eff(gob, "poison").length === 1 && eff(orc, "coat").length === 0, "Passing it puts the Poison on the new target and ends the coating");

console.log("== Poison: the tick");
formulas.length = 0; seq = [2, 10]; await A.turnStart(gob);
ok2(formulas.some(f => /^1d\d+$/.test(f)) && formulas.includes("9d6"), `The Constitution check fails (2 < 3) and they lose 9d6 (formulas ${formulas})`);
ok2(gob.system.hp.value === 432 - 10, `…10 health lost (HP ${gob.system.hp.value})`);
ok2(eff(gob, "poison").length === 0, "…and the Poison then ends");
await A.act(coatCard, 0).catch(() => {});
clean(); await land("magic-venomancy:poison"); target(gob); await A.act(lastMsgWith("afflict"), 0);
seq = [9]; await A.turnStart(gob);
ok2(gob.system.hp.value === 432 && eff(gob, "poison").length === 0, "A passed check: no health lost, and the Poison still ends");

console.log("== Poison Mods");
const poisoned = async (core, extra = {}, core2 = "") => { clean(); await land(core, extra, 20, core2); target(gob); await A.act(lastMsgWith("afflict"), 0); return eff(gob, "poison")[0]; };
await poisoned("magic-venomancy:poison", { [M("magic-venomancy:prolong")]: 1 });
seq = [1, 5]; await A.turnStart(gob);
ok2(eff(gob, "poison").length === 1 && eff(gob, "poison")[0].flags.flowstate.spellEffect.procs === 1, "Prolong: after a failed check the Poison goes on");
seq = [1, 5]; await A.turnStart(gob);
ok2(eff(gob, "poison").length === 0, "…and ends once it has applied 2 times");
await poisoned("magic-venomancy:poison", { [M("magic-venomancy:prolong")]: 1 });
seq = [9]; await A.turnStart(gob);
ok2(eff(gob, "poison").length === 0, "…or as soon as they pass the check");
await poisoned("magic-venomancy:poison", { [M("magic-venomancy:prolong")]: 2, [M("magic-venomancy:lethality")]: true });
formulas.length = 0; seq = [1, 5]; await A.turnStart(gob); seq = [1, 5]; await A.turnStart(gob);
ok2(formulas.includes("9d6") && formulas.includes("9d9"), `Lethality: the die grows 50% each time it procs (${formulas.filter(f => /^9d/.test(f))})`);
await poisoned("magic-venomancy:poison", { [M("magic-venomancy:potency")]: true });
formulas.length = 0; seq = [5]; await A.turnStart(gob);
ok2(messages.at(-1) && /Disadvantage/.test(text(messages.at(-1))), "Potency: the first Constitution check has Disadvantage");
await poisoned("magic-venomancy:poison", { [M("magic-venomancy:virality")]: true });
seq = [1, 5]; await A.turnStart(gob);
const vm = lastMsgWith("afflict");
ok2(vm?.flags.flowstate.afflict.acts.some(x => x.act === "spread"), "Virality: a check below half of what's needed offers a spread attack");
messages.length = 0; target(orc); seq = [20]; await A.act(vm, vm.flags.flowstate.afflict.acts.findIndex(x => x.act === "spread"));
seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
ok2(eff(orc, "poison").length === 1, "…and on a hit the Poison duplicates onto the new target");
ok2(eff(orc, "poison")[0].flags.flowstate.spellEffect.ritual === false, "…as an ordinary Poison");

console.log("== Poison Combos");
let pe = await poisoned("magic-slashing:cut", {}, "magic-venomancy:poison");
ok2(pe.flags.flowstate.spellEffect.n === 18 && pe.flags.flowstate.spellEffect.bypassArmor, "Cut + Poison: 6d6 × Power physical, ignoring armor");
formulas.length = 0; seq = [1, 10]; await A.turnStart(gob);
ok2(formulas.includes("18d10") && gob.system.hp.value === 422, "…and the die is +4 against a living target (d10)");
pe = await poisoned("magic-piercing:stab", {}, "magic-venomancy:poison");
seq = [1, 10]; await A.turnStart(gob);
ok2(gob.system.hp.value === 432 - 15, `Stab + Poison: a roll of half or lower Strengthens the damage (10 → 15; HP ${gob.system.hp.value})`);
pe = await poisoned("magic-crushing:slam", {}, "magic-venomancy:poison");
ok2(gob.system.derived.dodgeDie < orc.system.derived.dodgeDie, `Slam + Poison: −9 dodge die size while the Poison lasts (d${gob.system.derived.dodgeDie} vs d${orc.system.derived.dodgeDie})`);
pe = await poisoned("magic-heat:flame", {}, "magic-venomancy:poison");
seq = [1, 12]; await A.turnStart(gob);
ok2(gob.system.hp.value === 432 - 12 && gob.system.conditions.ignite === 12, `Flame + Poison: heat damage and Ignite stacks equal to it (Ignite ${gob.system.conditions.ignite})`);
pe = await poisoned("magic-cold:frost", {}, "magic-venomancy:poison");
seq = [1, 15]; await A.turnStart(gob);
ok2(gob.system.energy.value === 85, `Frost + Poison: cold damage and Energy removed equal to it (Energy ${gob.system.energy.value})`);
pe = await poisoned("magic-acid:glob", {}, "magic-venomancy:poison");
seq = [1, 14]; await A.turnStart(gob);
ok2(gob.system.conditions.stain === 14, `Glob + Poison: Stain stacks equal to the damage (${gob.system.conditions.stain})`);
pe = await poisoned("magic-gravity:force", {}, "magic-venomancy:poison");
seq = [1, 1000]; await A.turnStart(gob);
ok2(lastMsgWith("knockback") && /Force/.test(text(messages.at(-1))), "Force + Poison: the failed check applies Force (a direction button), not health loss");
ok2(gob.system.hp.value === 432, "…and no health is lost");
pe = await poisoned("magic-radiation:crackle", {}, "magic-venomancy:poison");
seq = [1, 14]; await A.turnStart(gob);
ok2(lastMsgWith("afflict").flags.flowstate.afflict.acts.some(x => x.act === "arc"), "Crackle + Poison: an arc button to repeat the damage at someone nearby");
const arcMsg = lastMsgWith("afflict"); messages.length = 0; target(orc); seq = [20]; await A.act(arcMsg, 0);
ok2(lastAtk()?.flags.flowstate.attack.opts.damage === "9d12" && lastAtk().flags.flowstate.attack.opts.type === "radiation", "…as a Ranged attack roll for 3d12 × Power radiation");

console.log("== Charm");
const charmOn = async (extra = {}, check = 1, roll = "attack") => { clean(); target(orc); seq = [20]; await cast("magic-charm:charm", { charmRoll: roll, ...extra }); seq = [12, check]; await actions.defend(lastAtk(), 0, "dodge"); return eff(orc, "charm")[0]; };
let ce = await charmOn({}, 1, "attack");
ok2(ce && A.charmNet(orc, "attack") === -1 && A.charmNet(orc, "dodge") === 0, "A failed Willpower check (1 < 3): Disadvantage on the chosen roll type only");
ok2(messages.filter(m => m.whisper).length > 0 && !messages.some(m => !m.whisper && /needs 3 or higher/.test(text(m))), "The check result is whispered (the target isn't alerted)");
ce = await charmOn({}, 9, "attack");
ok2(!ce, "A passed check (9 ≥ 3): no Charm");
ce = await charmOn({}, 1, "damage");
ok2(A.charmWeakened(orc) === 1 && A.charmNet(orc, "damage") === 0, "A Charm on damage rolls Weakens them instead");
ce = await charmOn({}, 1, "dodge");
ok2(A.charmNet(orc, "dodge") === -1, "…a Charm on dodge rolls gives Disadvantage");
// the penalty reaches the real rolls
{ const o = orc; const before = actions.rollDodge; seq = [5, 6]; formulas.length = 0; dialog = () => ({ net: 0 }); await actions.rollDodge(orc);
  ok2(formulas.some(f => /kl/.test(f)), `…and the dodge roll is made with Disadvantage (${formulas.at(-1)})`); }
ce = await charmOn({ [M("magic-charm:cloud")]: true }, 5, "attack");
ok2(/Disadvantage/.test(text(messages.filter(m => m.whisper)[0])), "Cloud: the Willpower check has Disadvantage");
ce = await charmOn({ [M("magic-charm:ingrained")]: true }, 1, "attack");
ok2(ce.flags.flowstate.spellEffect.ingrained && ce.flags.flowstate.spellEffect.onTargetTurn, "Ingrained: the Charm outlasts the caster's next turn");
await actions.clearSpellEffects(hero);
ok2(eff(orc, "charm").length === 1, "…it isn't cleared at the start of the caster's turn");
seq = [1]; await A.casterTurn(hero);
ok2(eff(orc, "charm").length === 0, "…each of the caster's turns repeats the check with the requirement halved (3 → 1), and a pass ends it");
// Propagandize needs two other Charms
clean();
for (const t of ["dodge", "stat"]) { target(orc); seq = [20]; await cast("magic-charm:charm", { charmRoll: t }); seq = [12, 1]; await actions.defend(lastAtk(), 0, "dodge"); }
target(orc); seq = [20]; await cast("magic-charm:charm", { charmRoll: "attack", [M("magic-charm:propagandize")]: true }); seq = [12, 1]; await actions.defend(lastAtk(), 0, "dodge");
ok2(eff(orc, "charm").length === 3 && A.charmNet(orc, "attack") === -2, "Propagandize: with two other Charms the effect is doubled");
// Convince
clean(); target(orc); seq = [20]; await cast("magic-charm:charm", { charmRoll: "attack" }); seq = [12, 1]; await actions.defend(lastAtk(), 0, "dodge");
messages.length = 0; target(orc); seq = [10]; await cast("magic-charm:charm", { charmRoll: "dodge", [M("magic-charm:convince")]: true });
ok2(/Convince: Advantage/.test(text(lastAtk())), "Convince: Advantage on the attack against a creature you've Charmed");

console.log("== Charm Combos");
const comboCharm = async (core, extra = {}) => { clean(); target(orc); seq = [20]; await cast(core, { core2: "magic-charm:charm", ...extra }); seq = [12]; await actions.defend(lastAtk(), 0, "dodge"); return eff(orc, "charm")[0]; };
ce = await comboCharm("magic-slashing:cut");
ok2(ce?.flags.flowstate.spellEffect.pending && ce.flags.flowstate.spellEffect.combo.dice[0] === 8, "Cut + Charm: waits for their next turn (no roll-type penalty)");
ok2(A.charmNet(orc, "attack") === 0, "…and applies no Disadvantage meanwhile");
formulas.length = 0; seq = [1, 20]; await A.turnStart(orc);
ok2(orc.system.hp.value === 432 - 20 && formulas.includes("24d6"), `A failed check at the start of their turn: they hurt themselves for 8d6 × Power (HP ${orc.system.hp.value})`);
ok2(eff(orc, "charm").length === 0, "…then it's over");
ce = await comboCharm("magic-cold:frost"); seq = [1, 20]; await A.turnStart(orc);
ok2(orc.system.energy.value === 80, "Frost + Charm: removes Energy equal to the damage");
ce = await comboCharm("magic-heat:flame"); seq = [1, 20]; await A.turnStart(orc);
ok2(orc.system.conditions.ignite === 20, "Flame + Charm: Ignite equal to the damage");
ce = await comboCharm("magic-crushing:slam"); seq = [1, 20]; await A.turnStart(orc);
ok2(orc.flags.flowstate?.disrupted, "Slam + Charm: their next roll has Disadvantage");
ce = await comboCharm("magic-radiation:crackle"); seq = [1, 20]; await A.turnStart(orc);
ok2(lastMsgWith("afflict")?.flags.flowstate.afflict.acts.some(x => x.act === "arc" && x.ally), "Crackle + Charm: a zap-an-ally attack");
ce = await comboCharm("magic-gravity:force"); seq = [1, 1000]; await A.turnStart(orc);
ok2(lastMsgWith("knockback"), "Force + Charm: Force applied (direction button)");
ce = await comboCharm("magic-slashing:cut"); seq = [9]; await A.turnStart(orc);
ok2(orc.system.hp.value === 432 && eff(orc, "charm").length === 0, "A passed check: nothing happens");

console.log("== Hex");
const hexOn = async (extra = {}, core2 = "") => { clean(); target(orc); seq = [20]; await cast("magic-witchery:hex", { core2, ...extra }); seq = [12]; await actions.defend(lastAtk(), 0, "dodge"); return eff(orc, "hex")[0]; };
let he = await hexOn({ hexTrigger: "harm" });
ok2(he && he.flags.flowstate.spellEffect.trigger === "harm" && he.flags.flowstate.spellEffect.n === 3, "A Hex on a hit: 1d12 × Power arcane, trigger Harm");
ok2(messages.some(m => m.whisper && /Hex/.test(text(m))) && !last().content.includes("Harm: takes damage"), "…the details go only to the caster and the GM");
ok2(!/Harm/.test(text(last())), "…and the public defense card doesn't give it away");
formulas.length = 0; seq = [1, 10]; await actions.requestDamage(orc, 5, "physical");
ok2(orc.system.hp.value < 432 - 5, `Harm: the Hex triggers when they take damage from another source (HP ${orc.system.hp.value})`);
ok2(formulas.includes("3d12"), "…a Build check, then 3d12 arcane");
ok2(eff(orc, "hex").length === 0, "…and the Hex is spent (it triggers once)");
he = await hexOn({ hexTrigger: "harm", [M("magic-witchery:linger")]: 1 });
seq = [1, 10]; await actions.requestDamage(orc, 5, "physical");
ok2(eff(orc, "hex").length === 1 && eff(orc, "hex")[0].flags.flowstate.spellEffect.left === 1, "Linger: it triggers 2 times (1 left after the first)");
seq = [9]; await actions.requestDamage(orc, 5, "physical");
ok2(eff(orc, "hex").length === 0, "…and a passed Build check still uses a trigger up");
// Damage multiplier by trigger: Harm Weakened twice, Roll Strengthened, Word triply
he = await hexOn({ hexTrigger: "harm" }); seq = [1, 40]; await actions.requestDamage(orc, 1, "physical");
const doubleWeak = 432 - orc.system.hp.value - 1;
ok2(doubleWeak > 0 && doubleWeak < 40, `Harm's damage is doubly Weakened (40 → ${doubleWeak})`);
he = await hexOn({ hexTrigger: "move" }); seq = [1, 40]; await A.hexTrigger(orc, "move");
ok2(432 - orc.system.hp.value > doubleWeak && 432 - orc.system.hp.value < 40, `Move: Weakened once (${432 - orc.system.hp.value})`);
he = await hexOn({ hexTrigger: "roll", hexRoll: "stat" }); seq = [1, 10]; await A.hexTrigger(orc, "roll", { roll: "attack" });
ok2(eff(orc, "hex").length === 1, "Roll: only the specified roll type triggers it");
seq = [1, 10]; await A.hexTrigger(orc, "roll", { roll: "stat" });
ok2(eff(orc, "hex").length === 0 && orc.system.hp.value < 432, "…and the right roll does (Strengthened)");
he = await hexOn({ hexTrigger: "failsuccess", hexRoll: "attack", hexOutcome: "fail" });
seq = [1, 10]; await A.hexTrigger(orc, "failsuccess", { roll: "attack", outcome: "success" });
ok2(eff(orc, "hex").length === 1, "Fail/Success: the wrong outcome doesn't trigger it");
seq = [1, 10]; await A.hexTrigger(orc, "failsuccess", { roll: "attack", outcome: "fail" });
ok2(eff(orc, "hex").length === 0, "…the chosen one does");
he = await hexOn({ hexTrigger: "act", hexDetail: "casts Flame" });
const hexCardMsg = messages.find(m => m.whisper && m.flags?.flowstate?.afflict);
ok2(/can't be detected automatically/.test(text(hexCardMsg)), "Act: a button for the caster/GM to trigger it by hand");
seq = [1, 10]; await A.act(hexCardMsg, 0);
ok2(eff(orc, "hex").length === 0 && orc.system.hp.value < 432, "…clicking it fires the Hex");
he = await hexOn({ hexTrigger: "harm", [M("magic-witchery:fester")]: true, [M("magic-witchery:linger")]: 1 });
formulas.length = 0; seq = [1, 10]; await actions.requestDamage(orc, 5, "physical"); seq = [1, 10]; await actions.requestDamage(orc, 5, "physical");
ok2(formulas.includes("3d12") && formulas.includes("3d18"), `Fester: +6 die size each time it procs (${formulas.filter(f => /^3d1/.test(f))})`);
he = await hexOn({ hexTrigger: "harm", [M("magic-witchery:unravel")]: true });
seq = [1, 10]; await actions.requestDamage(orc, 5, "physical");
ok2(eff(orc, "magicDis").length === 1, "Unravel: a failed Build check gives Disadvantage on Magic checks until your next turn");
ok2(/Disadvantage/.test(text(messages.filter(m => /Hex/.test(m.content)).at(-1))), "…and the first check was made with Disadvantage");
he = await hexOn({ hexTrigger: "harm", [M("magic-witchery:consume")]: true });
hero.system.energy.value = 10; orc.system.hp.value = 8; seq = [1, 100]; await actions.requestDamage(orc, 1, "physical");
const consumeMsg = messages.filter(m => m.flags?.flowstate?.afflict?.acts?.some(x => x.act === "respread")).at(-1);
ok2(consumeMsg && hero.system.energy.value > 10, `Consume: a Hex that destroys its target restores Energy (${hero.system.energy.value}) and offers to reapply it`);
orc.system.hp.value = 432;

console.log("== Hex Combos");
he = await hexOn({ hexTrigger: "harm" }, "magic-heat:flame"); formulas.length = 0; seq = [1, 10, 8]; await actions.requestDamage(orc, 5, "physical");
ok2(orc.system.conditions.ignite === 8 && formulas.includes("12d12"), `Flame + Hex: 4d12 × Power Ignite when it procs (Ignite ${orc.system.conditions.ignite})`);
he = await hexOn({ hexTrigger: "harm" }, "magic-cold:frost"); seq = [1, 10, 12]; await actions.requestDamage(orc, 5, "physical");
ok2(orc.system.energy.value === 88, "Cold + Hex: removes 4d8 × Power Energy");
he = await hexOn({ hexTrigger: "harm" }, "magic-acid:glob"); seq = [1, 10, 9]; await actions.requestDamage(orc, 5, "physical");
ok2(orc.system.conditions.stain === 9, "Acid + Hex: Stain stacks");
he = await hexOn({ hexTrigger: "harm" }, "magic-gravity:force"); seq = [1, 10, 1000]; await actions.requestDamage(orc, 5, "physical");
ok2(lastMsgWith("knockback"), "Gravity + Hex: Force on a proc (direction button)");
he = await hexOn({ hexTrigger: "harm", hexDie: "dodge" }, "magic-crushing:slam"); seq = [1, 10]; await actions.requestDamage(orc, 5, "physical");
ok2(orc.system.derived.dodgeDie < 15, `Crushing + Hex: −9 dodge die size on a proc (d${orc.system.derived.dodgeDie})`);
he = await hexOn({ hexTrigger: "harm" }, "magic-radiation:crackle"); seq = [1, 10]; await actions.requestDamage(orc, 5, "physical");
ok2(messages.filter(m => m.flags?.flowstate?.afflict?.acts?.some(x => x.act === "arc")).length > 0, "Radiation + Hex: arc buttons (two others, Strengthened)");

console.log("== Pure Tier 3 Combos");
clean(); target(orc); seq = [20]; await cast("magic-venomancy:poison", { core2: "magic-charm:charm", charmRoll: "dodge" }); seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
target(gob); seq = [30]; await A.act(lastMsgWith("afflict"), 0);
ok2(A.charmNet(gob, "dodge") === 0 && eff(gob, "charm").length === 0, "Poison + Charm: a passed combined check (5+) does nothing…");
clean(); target(orc); seq = [20]; await cast("magic-venomancy:poison", { core2: "magic-charm:charm", charmRoll: "dodge" }); seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
target(gob); seq = [2]; await A.act(lastMsgWith("afflict"), 0);
ok2(A.charmNet(gob, "dodge") === -1 && eff(gob, "charm")[0].flags.flowstate.spellEffect.dot.n === 6, "…then a failed combined check (Con + Will, 5+) gives the Charm and 2d6 × Power health loss each turn");
formulas.length = 0; seq = [10]; await A.turnStart(gob);
ok2(gob.system.hp.value === 422 && formulas.includes("6d6"), "…lost at the start of each of their turns");
clean(); target(orc); seq = [20]; await cast("magic-venomancy:poison", { core2: "magic-witchery:hex", hexTrigger: "harm" }); seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
target(gob); seq = [2]; await A.act(lastMsgWith("afflict"), 0);
ok2(eff(gob, "hex").length === 1 && eff(gob, "hex")[0].flags.flowstate.spellEffect.noCheck, "Poison + Hex: a failed combined check (Con + Build) gives a Hex with no further check");
seq = [10]; await actions.requestDamage(gob, 5, "physical");
ok2(gob.system.hp.value < 432 - 5 && eff(gob, "hex").length === 1, "…it loses health each time it triggers (1d10 × Power), until your next turn");
clean(); target(orc); seq = [20]; await cast("magic-charm:charm", { core2: "magic-witchery:hex", hexTrigger: "roll", hexRoll: "attack" }); seq = [12, 2]; await actions.defend(lastAtk(), 0, "dodge");
ok2(eff(orc, "hex").length === 1 && A.charmNet(orc, "attack") === -1, "Charm + Hex: a failed combined check (Will + Build) gives a Hex with Disadvantage on the triggering roll");
seq = [4]; await A.hexTrigger(orc, "roll", { roll: "attack" });
ok2(orc.system.hp.value === 432 - 4 * 1 - 0 || orc.system.hp.value < 432, "…and 1d8 arcane damage whenever it triggers");

console.log("== Rituals");
clean(); target(orc); combat.started = false;
await cast("magic-charm:charm", { ritual: true }); combat.started = true;
const rit = hero.effects.find(e => e.flags.flowstate.ritual);
ok2(rit && rit.flags.flowstate.ritual.freeCasts === 1 && rit.flags.flowstate.ritual.t3, "A Charm Ritual stores one free cast (the Ritual itself is the cast)");
messages.length = 0; seq = [20]; await cast("magic-charm:charm", { useRitual: rit.id, charmRoll: "attack" }); seq = [12, 1]; await actions.defend(lastAtk(), 0, "dodge");
const rc = eff(orc, "charm")[0];
ok2(rc && rc.flags.flowstate.ritualOf === rit.uuid && A.charmNet(orc, "attack") === -1, "A hit with the free cast makes the Charm permanent (until the Ritual ends)");
ok2(rit.flags.flowstate.ritual.freeCasts === 0, "…and uses up the free cast");
await actions.clearSpellEffects(hero);
ok2(eff(orc, "charm").length === 1, "…it isn't cleared at the start of your turn");
clean(); target(orc); combat.started = false;
await cast("magic-charm:charm", { ritual: true }); combat.started = true;
const rit2 = hero.effects.find(e => e.flags.flowstate.ritual);
seq = [1]; await cast("magic-charm:charm", { useRitual: rit2.id, charmRoll: "attack" }); seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
ok2(rit2.flags.flowstate.ritual.freeCasts === 1, "A missed Ritual cast leaves the free cast usable");


console.log("== Poison Ritual");
clean(); combat.started = false; target(orc);
await cast("magic-venomancy:poison", { ritual: true }); combat.started = true;
const prit = hero.effects.find(e => e.flags.flowstate.ritual);
seq = [20]; await cast("magic-venomancy:poison", { useRitual: prit.id }); seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
ok2(eff(orc, "coat")[0]?.flags.flowstate.ritualOf === prit.uuid, "A Ritual's coating doesn't wear off");
await actions.clearSpellEffects(hero);
ok2(eff(orc, "coat").length === 1, "…it survives the start of your turn");
target(gob); await A.act(lastMsgWith("afflict"), 0);
ok2(eff(gob, "poison")[0].flags.flowstate.spellEffect.ritual === true, "…and the Poison it passes on is a Ritual Poison");
seq = [1, 5]; await A.turnStart(gob); seq = [1, 5]; await A.turnStart(gob); seq = [1, 5]; await A.turnStart(gob);
ok2(eff(gob, "poison").length === 1, "…it keeps applying every turn…");
seq = [9]; await A.turnStart(gob);
ok2(eff(gob, "poison").length === 0, "…until they pass the Constitution check");

console.log("== Grasp Arcana Mods");
clean(); target(orc);
await putEffect(orc, { kind: "dodgeDis", caster: hero.uuid, name: "Dodge Disadvantage" });
messages.length = 0; seq = [10]; await cast("magic-slashing:cut", { [M("magic-grasp-arcana:foresight")]: true });
ok2(/Foresight: Advantage/.test(text(lastAtk())), "Foresight: Advantage when the target has Disadvantage on their dodge");
clean(); target(orc); messages.length = 0; seq = [10]; await cast("magic-slashing:cut", { [M("magic-grasp-arcana:foresight")]: true });
ok2(!/Foresight: Advantage/.test(text(lastAtk())), "…and none when they don't");
// Replicate copies another Mod
{
  const ctx = C.castContext(hero);
  const plan = S.planCast(ctx, { via: "foci:rod", ap: 2, core1: "magic-venomancy:poison", core2: "", base: 1, [M("magic-venomancy:lethality")]: true, [M("magic-grasp-arcana:replicate")]: true, [`rep:magic-grasp-arcana:replicate`]: "magic-venomancy:lethality" });
  const counts = FX.modCounts(plan.applied);
  ok2(plan.ok && counts.lethality === 2, `Replicate: Lethality counts twice (${JSON.stringify(counts)})`);
  ok2(plan.applied.find(a => a.replicates)?.threshold === 2, "…for the Mod's Threshold plus one");
  const inst = S.planCast(ctx, { via: "foci:rod", ap: 2, core1: "magic-slashing:cut", core2: "", base: 1, [M("magic-grasp-arcana:instant-ritual")]: true });
  ok2(inst.ok && inst.ritual && inst.instantRitual && inst.ritualHours === 0 && inst.ap === 2 && inst.energy === 0 && inst.ritualLoss > 0, `Instant Ritual: a Ritual with no hours that still costs AP (${inst.ap} AP, −${inst.ritualLoss} max Energy)`);
  messages.length = 0; clean(); hero.system.ap.value = 6; const before = hero.effects.length;
  await C.castSpell(hero, { via: "foci:rod", ap: 2, core1: "magic-charm:charm", core2: "", base: 1, [M("magic-grasp-arcana:instant-ritual")]: true });
  ok2(hero.effects.length === before + 1 && hero.effects.at(-1).flags.flowstate.ritual?.freeCasts === 1, "…and can be cast in combat");
}

console.log("== Cast dialog choices");
{
  const h = C.afflictHTML({ core1: "magic-charm:charm", core2: "" });
  ok2(/name="charmRoll"/.test(h) && !/hexTrigger/.test(h), "Charm: asks which roll type");
  const h2 = C.afflictHTML({ core1: "magic-witchery:hex", core2: "", hexTrigger: "failsuccess" });
  ok2(/name="hexTrigger"/.test(h2) && /name="hexRoll"/.test(h2) && /name="hexOutcome"/.test(h2), "Hex: asks for the trigger (and the roll and outcome for Fail/Success)");
  ok2(/name="hexDetail"/.test(C.afflictHTML({ core1: "magic-witchery:hex", hexTrigger: "word" })), "…and the word or action for Word/Act");
  ok2(/name="hexDie"/.test(C.afflictHTML({ core1: "magic-crushing:slam", core2: "magic-witchery:hex" })), "Slam + Hex: which die to shrink");
  const h3 = C.afflictHTML({ core1: "magic-venomancy:poison", core2: "magic-charm:charm" });
  ok2(/charmRoll/.test(h3), "Poison + Charm: asks which roll type");
  ok2(C.afflictHTML({ core1: "magic-slashing:cut", core2: "" }) === "", "Other spells ask nothing extra");
}

console.log("== Grasp Arcana actions");
{
  const wand = mkFoci(hero, "wand", { fociType: "wand", attuned: false, equipped: false });
  wand.update = async u => { for (const [k, v] of Object.entries(u)) set(wand, k, v); };
  const wasAp = (hero.system.ap.value = 6);
  dialog = () => "wand";
  await C.swapFoci(hero);
  ok2(wand.system.attuned === true && hero.system.ap.value === 4, "Foci Master: swapping your attuned Foci costs 2 AP");
  hero.system.trees["magic-grasp-arcana"] = 1;
  const before = hero.system.ap.value; await C.swapFoci(hero);
  ok2(hero.system.ap.value === before, "…and needs Grasp Arcana T4");
  hero.system.trees["magic-grasp-arcana"] = 5;
}
dialog = () => ({ net: 0 });
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
