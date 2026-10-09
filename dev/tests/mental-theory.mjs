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


const ab = await import("../../module/abilities.mjs");
const theory = n => { hero.system.trees["mental-theory"] = n; hero.system.prepareDerivedData(); };
const setAlign = (kind, level = 1, equilibrium = false) => { hero.flags.flowstate = { ...(hero.flags.flowstate ?? {}), alignment: kind === "neutral" ? null : { kind, level, equilibrium } }; };
const setFlag = (k, v) => { hero.flags.flowstate = { ...(hero.flags.flowstate ?? {}), [k]: v }; };
const ponMin = () => ab.statMinOf(hero, "pon"), willMin = () => ab.statMinOf(hero, "will");
const mkRef = () => {};
const shields = a => effs(a, "shield");

console.log("== Patron (Mental T5)");
reset(); theory(5); setAlign("dream"); setFlag("patron", null);
refresh(); target(orc); seq = [20];
await M.manifest(hero, { mode: "mental-life-dream:bloom", range: "ranged", enhance: true });
ok2(hero.system.energy.value === 200 - ponMin(), "Without a Patron, Enhance costs its energy");
setFlag("patron", "mental-life-dream"); refresh(); seq = [20];
await M.manifest(hero, { mode: "mental-life-dream:bloom", range: "ranged", enhance: true, burst: true });
ok2(hero.system.energy.value === 200 && hero.system.rp.value === 4, "Aligned to the Patron Wonder, Enhance and Burst cost no energy (Burst still pays its RP)");
setAlign("nightmare"); refresh(); seq = [20];
await M.manifest(hero, { mode: "mental-life-dream:bloom", range: "ranged", enhance: true });
ok2(hero.system.energy.value === 200 - ponMin(), "…but not when you're not aligned to it");
dialog = () => "mental-death-nightmare"; await M.choosePatron(hero);
ok2(flag(hero, "patron") === "mental-death-nightmare", "Choosing a Patron Wonder sets it");

console.log("== Will of Body and Spirit (Mental T4)");
reset(); theory(4); setAlign("neutral"); messages.length = 0;
await actions.afterAttackCost(hero, { ap: 2 });
let wcard = messages.find(m => m.flags?.flowstate?.mentalAct);
let wact = wcard?.flags.flowstate.mentalAct.acts[0];
ok2(wact?.id === "wobs" && wact.ap === 2, "A 2 AP attack offers a free Manifest");
refresh(); target(orc); seq = [20]; dialog = () => ({ mode: "mental-life-dream:flourish", range: "melee" });
let done = await W.runAct(wact);
ok2(!done && hero.system.ap.value === 6, "A Range that costs something else isn't allowed");
dialog = () => ({ mode: "mental-life-dream:flourish", range: "ranged" });
done = await W.runAct(wact);
ok2(done && hero.system.ap.value === 6 && hero.system.energy.value === 200, "A Ranged (2 AP) Manifest costs no AP of its own");
messages.length = 0; await actions.afterAttackCost(hero, { rp: 2 });
wact = messages.find(m => m.flags?.flowstate?.mentalAct).flags.flowstate.mentalAct.acts[0];
refresh(); seq = [20]; dialog = () => ({ mode: "mental-life-dream:flourish", range: "ranged" });
done = await W.runAct(wact);
ok2(done && hero.system.rp.value === 6 && hero.system.energy.value === 200 - ponMin(), "An RP attack's Manifest is a Burst: no RP, but the Burst energy is still paid");

console.log("== Chant (Mental T2)");
reset(); theory(2); setAlign("neutral"); messages.length = 0;
refresh(); target(orc); seq = [3];
await M.manifest(hero, { mode: "mental-death-nightmare:waste", range: "ranged" });
dialog = () => ({ net: 0 }); seq = [40]; await actions.defend(lastAtk(), 0, "dodge");
const chantAct = messages.find(m => m.flags?.flowstate?.mentalAct?.acts?.[0]?.id === "chant")?.flags.flowstate.mentalAct.acts[0];
ok2(!!chantAct && !effs(orc, "waste").length, "A missed Manifest offers Chant");
const e0 = hero.system.energy.value; seq = [60];
done = await W.runAct(chantAct);
ok2(done && hero.system.energy.value === e0 - ab.statMinOf(hero, "snap") && effs(orc, "waste").length === 1, "Chant rerolls it for the Enhance cost, and a hit lands the Mode");

console.log("== Alignment on the Ward, Make Clear, Prism and Premonition");
const aegis = mkIcon(hero, "Aegis", { form: "aegis", attuned: true });
target(null);
reset(); theory(4); hero.system.trees["mental-willpower-arts"] = 2; hero.system.prepareDerivedData();
setAlign("dream", 4); refresh(); messages.length = 0; dialog = () => ({});
await M.activateWard(hero);
{ const w = lastAtk().flags.flowstate.attack; ok2(w.targets[0].net === 1 && w.opts.stacks === 1, "4 Alignment: your own type's Icon Ward has Advantage and a Strengthened bolded effect"); seq = [2]; await actions.defend(lastAtk(), 0, "none");
  ok2(shields(hero)[0]?.flags.flowstate.spellEffect.hp === Math.floor(20 * R.iconScale(hero.system.derived.effective.will.value, 3) * 1.5), "…the shielding is 1.5× (Strengthened)"); }
clearAll(hero); setAlign("dream", 3); refresh(); messages.length = 0;
await M.activateWard(hero);
ok2(lastAtk().flags.flowstate.attack.targets[0].net === 0 && !lastAtk().flags.flowstate.attack.opts.stacks, "3 Alignment: nothing yet for the Ward");
clearAll(hero); setAlign("dream", 2, true); refresh(); messages.length = 0;
await M.activateWard(hero);
ok2(lastAtk().flags.flowstate.attack.opts.dodgeNet === -1, "Equilibrium: everything dodging the Ward has Disadvantage");
setAlign("neutral"); refresh(); clearAll(hero);
dialog = () => ({ clear: true }); seq = [2];
await M.activateWard(hero);
seq = [40]; dialog = () => ({ net: 0 }); await actions.defend(lastAtk(), 0, "dodge");
const mc = messages.find(m => m.flags?.flowstate?.mentalAct?.acts?.[0]?.id === "makeClear")?.flags.flowstate.mentalAct.acts[0];
ok2(!!mc && !shields(hero).length, "Make Clear: a missed Ward offers a reroll");
seq = [90]; done = await W.runAct(mc);
ok2(done && shields(hero).length === 1, "…which applies the Ward on a hit");
clearAll(hero); aegis.system.form = "prism"; hero.system.prepareDerivedData(); refresh(); setAlign("neutral");
dialog = () => ({ enhance: true, types: "physical", types2: "magical" }); seq = [20];
await M.activateWard(hero); seq = [2]; await actions.defend(lastAtk(), 0, "none");
ok2(JSON.stringify(shields(hero)[0]?.flags.flowstate.spellEffect.types) === JSON.stringify(["physical", "magical"]), "Prism, Enhanced: it protects against two chosen damage types");
clearAll(hero); aegis.system.form = "premonition"; hero.system.prepareDerivedData(); refresh();
dialog = () => ({ enhance: true, declared: "weapon:bladed" }); seq = [20];
await M.activateWard(hero); seq = [2]; await actions.defend(lastAtk(), 0, "none");
const pre = effs(hero, "premonition")[0];
ok2(pre?.flags.flowstate.spellEffect.declared === "weapon:bladed", "Premonition, Enhanced: a declared source is stored");
hero.system.hp.value = 432; confirmAnswer = true;
await actions.applyDamage(hero, 100, "physical", { silent: true, shroudCtx: { source: "weapon:bladed", attacker: orc.uuid } });
const mult = R.iconScale(hero.system.derived.effective.will.value, 3);
ok2(hero.system.hp.value === 432 - (50 - 40 * mult > 0 ? 50 - 40 * mult : 0), "The declared source's damage is Weakened first (100 → 50), then 40 is negated");

console.log("== Anchor");
clearAll(hero); hero.system.hp.value = 432;
const { putSpellEffect } = actions;
await putSpellEffect(hero, { kind: "shield", caster: hero.uuid, name: "Anchor", hp: 40, max: 40, anchor: true, order: "default" });
let o1 = await actions.damageOutcome(hero, 20, "physical");
ok2(o1.shields[0]?.hp === 30, "Anchor: damage to the shielding is Weakened while you haven't moved (20 costs 10)");
setFlag("turnPos", { x: 0, y: 0 }); hero.getActiveTokens = () => [{ document: { x: 50, y: 50 } }];
o1 = await actions.damageOutcome(hero, 20, "physical");
ok2(o1.shields[0]?.hp === 20, "…but not once you've moved");
hero.getActiveTokens = () => []; setFlag("turnPos", null);
clearAll(hero);
await putSpellEffect(hero, { kind: "anchorWeak", caster: hero.uuid, name: "Anchor (Enhanced)" });
o1 = await actions.damageOutcome(hero, 100, "physical");
ok2(o1.toHp === 50, "Enhanced Anchor: all damage you take is Weakened while you stay put");

console.log("== Warden (reflect)");
clearAll(hero); clearAll(orc); reset();
aegis.system.form = "warden"; hero.system.prepareDerivedData(); refresh(); hero.system.hp.value = 432; orc.system.hp.value = 432; hero.system.rp.value = 6;
dialog = () => ({ enhance: true }); seq = [20];
await actions.applyDamage(hero, 10, "physical", { silent: true, shroudCtx: { source: "weapon:bladed", attacker: orc.uuid } });
ok2(hero.system.hp.value === 432, "Warden negates the damage");
const rAtk = lastAtk();
ok2(rAtk?.flags.flowstate.attack.opts.mental?.reflect?.amount === 10, "Enhanced Warden makes an attack at the source for the negated damage");
seq = [2]; await actions.defend(rAtk, 0, "none");
ok2(orc.system.hp.value === 422, "…and a hit deals the negated damage to them");

console.log("== Zealot and Reverie follow the Alignment number");
clearAll(hero); aegis.system.form = "zealot"; hero.system.prepareDerivedData(); hero.system.hp.value = 432; hero.system.rp.value = 6; theory(1);
const zealotNegates = async (level, enhance, dmg = 300) => { hero.system.hp.value = 432; hero.system.rp.value = 6; setAlign("nightmare", level); refresh(); dialog = () => (enhance ? { enhance: true } : {}); await actions.applyDamage(hero, dmg, "heat", { silent: true, shroudCtx: { source: "type:heat", attacker: orc.uuid } }); return 432 - hero.system.hp.value; };
const zScale = R.iconScale(hero.system.derived.effective.will.value, 3);
{ const a1 = await zealotNegates(1, false), a2 = await zealotNegates(2, false);
  ok2(a1 === 300 - 6 * 5 * zScale && a2 === 0, "Zealot: only 5 × scale negated per use at 1 Nightmare, the full 30 × scale at 2"); }
{ const w3 = await zealotNegates(3, true, 2000), w4 = await zealotNegates(4, true, 2000);
  ok2(w3 === 1460 && w4 === 257, "Zealot Enhanced at 4 Nightmare: Strengthened by Alignment 4 (135 a use) and the damage is Weakened once (2000 → 1865 → 932 → 257)"); }
// Wards are used with a self attack roll (attack roll against your own dodge): a miss costs the RP and negates nothing.
clearAll(hero); aegis.system.form = "veil"; hero.system.prepareDerivedData(); setAlign("neutral"); theory(1); refresh();
{ hero.system.hp.value = 432; hero.system.rp.value = 2; dialog = () => ({}); seq = [30, 5, 30, 5];
  await actions.applyDamage(hero, 300, "heat", { silent: true, shroudCtx: { source: "type:heat", attacker: orc.uuid } });
  const missLoss = 432 - hero.system.hp.value;
  ok2(missLoss === 300 && hero.system.rp.value === 0, `Veil with two missed Ward rolls: nothing negated, both RP spent (took ${missLoss})`);
  hero.system.hp.value = 432; hero.system.rp.value = 2; seq = [5, 30, 5, 30];
  await actions.applyDamage(hero, 300, "heat", { silent: true, shroudCtx: { source: "type:heat", attacker: orc.uuid } });
  const hitLoss = 432 - hero.system.hp.value;
  ok2(hitLoss === 300 - 2 * 10 * zScale, `…and two hits negate 10 × scale each (took ${hitLoss})`); seq = []; }

clearAll(hero); aegis.system.form = "reverie"; hero.system.prepareDerivedData(); setAlign("dream", 1); refresh(); messages.length = 0; dialog = () => ({});
await M.activateWard(hero);
ok2(!messages.some(m => m.flags?.flowstate?.attack), "Reverie can't be activated under 2 Dream Alignment");
setAlign("dream", 2); refresh(); await M.activateWard(hero);
ok2(messages.some(m => m.flags?.flowstate?.attack), "…but can at 2");
clearAll(hero); aegis.system.form = "reverie"; hero.system.prepareDerivedData(); setAlign("dream", 3); refresh();
await putSpellEffect(hero, { kind: "shield", caster: hero.uuid, name: "Reverie", hp: 20, max: 20, reverie: true, reverieEnhanced: true, order: "default" });
await hit("mental-life-dream:flourish");
ok2(shields(hero)[0].flags.flowstate.spellEffect.hp === 20, "Enhanced Reverie only grows from 4 Dream Alignment (not at 3)");
clearAll(hero);

console.log("== Reverie");
clearAll(hero); aegis.system.form = "reverie"; hero.system.prepareDerivedData(); setAlign("dream", 4); refresh();
await putSpellEffect(hero, { kind: "shield", caster: hero.uuid, name: "Reverie", hp: 20, max: 20, reverie: true, reverieEnhanced: true, order: "default" });
await hit("mental-life-dream:flourish");
ok2(shields(hero)[0].flags.flowstate.spellEffect.hp === 20 + 5 * mult, "Enhanced Reverie grows by 5 (× the scale) when a Dream Manifest hits");
refresh(); setAlign("dream", 2);
await actions.mentalBeforeClear(hero);
await actions.clearSpellEffects(hero);
ok2(shields(hero).length === 1, "Still at least 2 in a Dream Alignment at turn start: the shielding is kept (nothing to pay)");
await actions.mentalTurnStart(hero);
ok2(flag(hero, "alignment")?.kind === "dream", "…and the Alignment stays Dream (it no longer resets each turn)");
setAlign("dream", 1); refresh();
await actions.mentalBeforeClear(hero);
await actions.clearSpellEffects(hero);
ok2(shields(hero).length === 0, "Under 2 Dream Alignment at turn start lets the shielding go");
confirmAnswer = true;

console.log("== Dismissing Wonders");
reset(); clearAll(hero); theory(2); setAlign("neutral"); refresh();
await hit("mental-death-nightmare:waste");
ok2(effs(orc, "waste").length === 1, "(Waste is on the Orc)");
refresh(); target(orc); seq = [20]; dialog = () => ({ e: "0", range: "ranged" });
await M.dismiss(hero);
seq = [2]; dialog = () => ({ net: 0 }); await actions.defend(lastAtk(), 0, "dodge");
ok2(effs(orc, "waste").length === 0 && hero.system.ap.value === 4, "Dismissing someone else's effect: Range AP and a hit remove it");
await putSpellEffect(hero, { kind: "redirect", caster: hero.uuid, name: "Redirect" });
refresh(); dialog = () => ({ e: "0", range: "ranged" });
await M.dismiss(hero);
ok2(effs(hero, "redirect").length === 0 && hero.system.ap.value === 6, "Your own effects are dismissed freely");

console.log(fails ? `\n${fails} FAILED` : "\nAll Mental Theory checks passed");
if (fails) process.exit(1);
