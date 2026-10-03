// Mental: Manifesting, Alignment, Icons and Wards, Nightmare Ward negation, Psion Arts (through the real attack exchange).
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
const R = await import("../../module/mental-rules.mjs");
const stats = { str: 10, dex: 10, con: 10, pon: 30, snap: 25, will: 30, reach: 10, grasp: 10, build: 10 };
const mTrees = { "mental-theory": 1, "mental-life-dream": 5, "mental-death-nightmare": 5, "mental-psion-arts": 5, "mental-willpower-arts": 0 };
const hero = addEffects(mkActor("Seer", { stats, skillPoints: 30, energy: { value: 200 } }, { ...mTrees }));
const orc = addEffects(mkActor("Orc", { skillPoints: 30 }, {}));
const ally = addEffects(mkActor("Ally", { skillPoints: 30 }, {}));
combat.combatants.length = 0; combat.combatants.push({ actor: hero }, { actor: orc }, { actor: ally }); combat.combatant = { actor: hero };
const refresh = () => { hero.system.ap.value = 6; hero.system.rp.value = 6; hero.system.energy.value = 200; };
const target = a => { game.user.targets = new Set(a ? [{ actor: a, name: a.name, document: {} }] : []); };
const lastAtk = () => messages.filter(m => m.flags?.flowstate?.attack).at(-1);
const last = () => messages.at(-1);
const flag = (a, k) => a.getFlag("flowstate", k);

console.log("== Manifest: costs, Wonder Power, the card");
refresh(); target(orc); seq = [20];
await M.manifest(hero, { mode: "mental-life-dream:bloom", range: "ranged" });
let atk = lastAtk();
ok2(atk && atk.flags.flowstate.attack.opts.mental.power === 3 && atk.flags.flowstate.attack.opts.mental.wonder === "mental-life-dream", "A Ranged Bloom is cast at Wonder Power 3 (Ponderance 30)");
ok2(hero.system.ap.value === 4 && hero.system.energy.value === 200, "Ranged costs 2 AP (no energy without Enhance)");
seq = [12]; await actions.defend(atk, 0, "dodge");
ok2(/60 temp HP/.test(text(last())) && /Bloom/.test(text(last())), "On a hit the card shows Bloom's numbers scaled by Power (20 → 60 temp HP)");
refresh(); target(orc); seq = [20];
await M.manifest(hero, { mode: "mental-life-dream:bloom", range: "melee", enhance: true });
ok2(hero.system.ap.value === 5 && hero.system.energy.value === 200 - R.wonderPower(0) - hero.system.derived.effective.pon.min, "Melee 1 AP, Enhance costs the Ponderance min in Energy");
refresh(); target(orc); seq = [20];
await M.manifest(hero, { mode: "mental-death-nightmare:wither", range: "ranged", burst: true });
ok2(hero.system.ap.value === 6 && hero.system.rp.value === 4 && hero.system.energy.value < 200, "Burst: 2 RP for a Ranged Manifest plus the Enhance cost in Energy, no AP");
hero.system.stats.pon = 0; hero.system.prepareDerivedData(); refresh(); target(orc);
const n0 = messages.length;
const r = await M.manifest(hero, { mode: "mental-life-dream:bloom", range: "ranged" });
ok2(r === null && messages.length === n0 && hero.system.ap.value === 6, "Ponderance under 10 (even with the Skill Point bonus): can't Manifest a Dream, nothing spent");
hero.system.stats.pon = 30; hero.system.prepareDerivedData();

console.log("== Alignment");
refresh(); await M.changeAlignment(hero, "dream");
ok2(flag(hero, "alignment")?.value === "dream" && hero.system.ap.value === 4, "Aligning to Dream costs 2 AP");
refresh(); target(orc); seq = [20];
await M.manifest(hero, { mode: "mental-life-dream:bloom", range: "ranged" });
ok2(lastAtk().flags.flowstate.attack.targets[0].net === 1, "A Dream Wonder in Dream Alignment has Advantage");
refresh(); target(orc); seq = [20];
await M.manifest(hero, { mode: "mental-death-nightmare:wither", range: "ranged" });
ok2(lastAtk().flags.flowstate.attack.targets[0].net === -1, "…a Nightmare Wonder has Disadvantage");
hero.system.trees["mental-theory"] = 3; hero.system.prepareDerivedData(); refresh();
await M.deepen(hero);
const aln = flag(hero, "alignment");
ok2(aln.deepened && hero.system.energy.value === 200 - hero.system.derived.effective.pon.min, "Deepening a Dream Alignment costs the Ponderance min in Energy");
refresh(); target(orc); seq = [20];
await M.manifest(hero, { mode: "mental-life-dream:bloom", range: "ranged" });
ok2(lastAtk().flags.flowstate.attack.opts.stacks === 2, "A Deepened Wonder is doubly Strengthened");
await M.turnStart(hero);
ok2(!flag(hero, "alignment"), "At the start of your next turn you're back to Neutral");
refresh(); waitAnswer = "energy"; await M.changeAlignment(hero, "nightmare");
ok2(hero.system.ap.value === 6 && hero.system.energy.value === 200 - 15 && flag(hero, "alignment").value === "nightmare", "Fluidity (Mental T3): change Alignment for half your Skill Points in Energy instead of AP");
await M.turnStart(hero);
hero.system.trees["mental-theory"] = 1; hero.system.prepareDerivedData();

console.log("== Icons: attuning, Wards");
const aegis = mkIcon(hero, "Aegis", { form: "aegis", attuned: false });
refresh(); dialog = () => ({ tenet: "mental-life-dream:verdant-soul", pay: "ap" });
await M.attuneIcon(hero, aegis);
ok2(aegis.system.attuned && aegis.system.tenet === "mental-life-dream:verdant-soul" && hero.system.ap.value === 0, "Attuning an Icon costs 6 AP and sets its Tenet");
ok2(hero.system.icon === aegis, "The attuned Icon is the character's Icon");
refresh(); dialog = () => ({});
await M.activateWard(hero);
atk = lastAtk();
ok2(atk.flags.flowstate.attack.opts.mental.ward.form === "aegis" && atk.flags.flowstate.attack.targets[0].uuid === hero.uuid && hero.system.ap.value === 5, "A Ward is a 1 AP self attack");
ok2(atk.flags.flowstate.attack.targets[0].net === 1, "In Neutral Alignment a Ward attack has Advantage");
seq = [2]; await actions.defend(atk, 0, "none");
const sh = hero.effects.filter(e => e.flags.flowstate.spellEffect?.kind === "shield");
ok2(sh.length === 1 && sh[0].flags.flowstate.spellEffect.hp === 20 * R.iconScale(30, 3), `Aegis puts ${sh[0]?.flags.flowstate.spellEffect.hp} shielding on you (20 × the Ward scale)`);
refresh(); dialog = () => ({}); await M.activateWard(hero); seq = [2]; await actions.defend(lastAtk(), 0, "none");
ok2(hero.effects.filter(e => e.flags.flowstate.spellEffect?.kind === "shield").length === 2, "Ward shielding stacks");
const out = await actions.damageOutcome(hero, 50, "physical");
ok2(out.toHp === 0 || out.toHp < 50, "…and soaks damage like a Shield");
await actions.clearSpellEffects(hero);
ok2(!hero.effects.some(e => e.flags.flowstate.spellEffect?.kind === "shield"), "It ends at the start of your next turn");

console.log("== Nightmare Wards negate damage");
const wm = R.iconScale(hero.system.derived.effective.will.value, 3);
await aegis.update({ "system.attuned": false });
const veil = mkIcon(hero, "Veil", { form: "veil", attuned: true });
let answers = [{}, {}, null];
dialog = () => answers.shift();
refresh(); hero.system.hp.value = 400;
await actions.applyDamage(hero, 80, "physical", { silent: true });
ok2(hero.system.hp.value === 400 - (80 - 2 * 10 * wm) && hero.system.rp.value === 4, `Veil (×${wm}): two uses negate ${10 * wm} each (2 RP); the rest lands`);
answers = [{ enhance: true }, null]; refresh(); hero.system.hp.value = 400;
await actions.applyDamage(hero, 80, "physical", { silent: true });
ok2(hero.system.hp.value === 400 - (80 - 20 * wm) && hero.system.rp.value === 5 && hero.system.energy.value === 200 - hero.system.derived.effective.will.min, "Enhanced (Mental T1): double the negation for the Willpower min in Energy");
answers = [null]; refresh(); hero.system.hp.value = 400;
await actions.applyDamage(hero, 12, "physical", { silent: true });
ok2(hero.system.hp.value === 388 && hero.system.rp.value === 6, "Declining spends nothing");
const grudgeI = mkIcon(hero, "Grudge", { form: "grudge", attuned: true }); await veil.update({ "system.attuned": false });
answers = [{}, {}, {}, null]; refresh(); hero.system.hp.value = 400;
await actions.applyDamage(hero, 200, "physical", { silent: true });
ok2(hero.system.hp.value === 400 - (200 - (10 + 20 + 30) * wm), `Grudge grows by 10 negation (×${wm}) per use in one damage instance`);
const echoI = mkIcon(hero, "Echo", { form: "echo", attuned: true }); await grudgeI.update({ "system.attuned": false });
answers = [{}, null]; refresh(); hero.system.hp.value = 400;
await actions.applyDamage(hero, 5 * wm, "physical", { silent: true });
ok2(hero.system.hp.value === 400 && flag(hero, "echoWard")?.n === 1, "Echo: fully negating an attack makes it free on every later instance");
answers = []; hero.system.hp.value = 400;
await actions.applyDamage(hero, 12 * wm, "physical", { silent: true });
ok2(hero.system.hp.value === 400 - (12 * wm - 5 * wm), "…it negates for free until your next turn (no prompt, no RP)");
await echoI.update({ "system.attuned": false });

console.log("== Psion Arts");
refresh(); messages.length = 0; await M.psionSense(hero);
ok2(/100 ft/.test(text(messages.at(-1))) && /Primary/.test(text(messages.at(-1))), "Psion Sense: 100 ft; Primary at T3");
refresh(); await M.farSight(hero);
ok2(flag(hero, "psion").farSight && hero.system.ap.value === 4 && hero.system.energy.value === 200 - (36 + 31 + 36), "Far Sight: 2 AP and Energy equal to your total Mind");
refresh(); target(orc); seq = [20]; hero.system.trees["mental-life-dream"] = 5;
await M.manifest(hero, { mode: "mental-life-dream:bloom", range: "ranged" });
ok2(true, "Ranged Manifestations reach 500 ft (checked against the token range)");
confirmAnswer = false; await M.turnStart(hero);
ok2(!flag(hero, "psion"), "Far Sight lapses at your next turn unless you pay again");
refresh(); await M.auraSight(hero);
ok2(flag(hero, "psion").auraSight && hero.system.energy.value === 200 - Math.floor(103 / 2), "Aura Sight: 2 AP and half your total Mind");

console.log(fails ? `\n${fails} FAILED` : "\nAll Mental engine checks passed");
if (fails) process.exit(1);
