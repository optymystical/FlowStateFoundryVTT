// Concentration, Trance and the Ponderance Arts: Premeditate, Mantra, Composure, Daydreaming.
import { installFoundry } from "./support/foundry.mjs";
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 }); let confirmAnswer = true; let waitAnswer = "ap";
const { combat } = installFoundry({ roll: () => (seq.length ? seq.shift() : 10), dialog: c => dialog(c), confirm: () => confirmAnswer, wait: () => waitAnswer, messages, uuids });

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
let dodgeRoll = 12;   // a hit but not a crit (a crit is double the dodge result)
async function hit(mode, extra = {}, atk = 20) {
  refresh(); target(orc); seq = [atk];
  await M.manifest(hero, { mode, range: "ranged", ...extra });
  seq = [dodgeRoll]; await actions.defend(lastAtk(), 0, "dodge");
  return messages.filter(m => m.flags?.flowstate?.defense).at(-1);
}
const reset = () => { clearAll(orc); clearAll(hero); orc.system.hp.value = 432; orc.system.hp.lost = 0; orc.system.conditions = { ignite: 0, stain: 0, slow: 0, haste: 0, solid: 0, searing: 0, frozen: 0, electric: 0 }; for (const k of Object.keys(orc.flags)) delete orc.flags[k]; orc.system.lift = 0; orc.system.prepareDerivedData?.(); };

const CN = await import("../../module/concentration.mjs");
const P = await import("../../module/ponderance.mjs");
const { putSpellEffect } = actions;
const tree = (id, n) => { hero.system.trees[id] = n; hero.system.prepareDerivedData(); };
let cid = 0;
/** A Concentration on the Orc: a flag entry plus an effect carrying its id. */
async function concentrate(label, extra = {}) {
  const id = `t:${cid++}`;
  await putSpellEffect(orc, { kind: "trance", stack: true, persistent: true, caster: hero.uuid, concentration: id, name: label, mode: "mental-life-dream:bloom", power: 1, hostile: false, ...extra });
  await hero.setFlag("flowstate", "concentrating", [...(hero.getFlag("flowstate", "concentrating") ?? []), { id, label }]);
  return id;
}
const live = () => CN.list(hero).map(c => c.label);
const resetC = async () => { reset(); await hero.setFlag("flowstate", "concentrating", []); await hero.setFlag("flowstate", "daydream", null); refresh(); };

console.log("== Concentration: a cap of your Mental Theory tier");
tree("mental-theory", 2); tree("mental-ponderance-arts", 0);
await resetC();
ok2(CN.cap(hero) === 2, "You can concentrate on as many things as your Mental Theory tier");
await concentrate("A"); await concentrate("B");
dialog = () => ({ drop: CN.list(hero)[0].id });
ok2(await CN.begin(hero, { id: "t:new", label: "C" }) === true && !live().includes("A"), "At the cap, starting another drops the one you pick");
await concentrate("C2");
dialog = () => null;
const r2 = await CN.begin(hero, { id: "t:new2", label: "D" });
ok2(r2 === false, "…and with no answer nothing changes");
tree("mental-theory", 0);
ok2(await CN.begin(hero, { id: "t:zero", label: "E" }) === false, "No Mental Theory, no Concentration");
tree("mental-theory", 2);

console.log("== Concentration: damage, Composure, Daydreaming");
await resetC(); await concentrate("A"); await concentrate("B");
hero.system.hp.value = 400; seq = [3];
let held = await CN.damageCheck(hero, 10);
ok2(held === false && live().length === 0 && hero.system.rp.value === 5, "Direct damage: 1 RP and a Willpower check; lower than the damage ends every Concentration");
await resetC(); await concentrate("A"); seq = [30];
held = await CN.damageCheck(hero, 10);
ok2(held === true && live().length === 1 && hero.system.rp.value === 5, "A result at or above the damage holds");
await resetC(); await concentrate("A"); hero.system.rp.value = 0;
await CN.damageCheck(hero, 1);
ok2(live().length === 0, "No RP to spend: the Concentration is lost");
await resetC(); await concentrate("A"); await concentrate("B"); seq = [3];
tree("mental-ponderance-arts", 3); dialog = () => ({ drop: CN.list(hero)[1].id });
await CN.damageCheck(hero, 10);
ok2(live().length === 1 && live()[0] === "A", "Composure (Ponderance T3): only one of your choice is lost");
await resetC(); await concentrate("A"); await concentrate("B"); seq = [3];
tree("mental-ponderance-arts", 5); await hero.setFlag("flowstate", "daydream", CN.list(hero)[0].id);
await CN.damageCheck(hero, 10);
ok2(live().join() === "A", "Daydreaming (T5): the protected Concentration can't be broken");
hero.system.hp.value = 0; await concentrate("C");
await CN.damageCheck(hero, 50, 0);
ok2(live().join() === "A", "…even by falling unconscious (the rest are lost)");
hero.system.hp.value = 432; tree("mental-ponderance-arts", 0);
await resetC(); await concentrate("A"); hero.system.hp.value = 5;
await CN.damageCheck(hero, 50, 0);
ok2(live().length === 0, "Falling unconscious ends every Concentration");
hero.system.hp.value = 432;
await resetC(); const keep = await concentrate("A");
await CN.end(hero, keep);
ok2(live().length === 0 && effs(orc, "trance").length === 0, "Ending a Concentration ends the effects it was keeping going");

console.log("== Premeditate (Ponderance Arts T1)");
await resetC(); tree("mental-ponderance-arts", 1);
dialog = () => ({ trigger: "attacks" }); refresh(); target(orc); seq = [20];
const e0 = hero.system.energy.value;
await M.manifest(hero, { mode: "mental-life-dream:bloom", range: "ranged", premeditate: true });
seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
const pre = effs(orc, "premeditated");
ok2(pre.length === 1 && effs(orc, "pending").length === 0 && effs(orc, "tempHP").length === 0, "A Premeditated Manifest that hits is stored, not applied");
ok2(hero.system.energy.value === e0 - (await import("../../module/abilities.mjs")).statMinOf(hero, "pon") && live().length === 1, "…for the Wonder's Scaling Stat min in Energy, and you concentrate on it");
ok2(pre[0].flags.flowstate.spellEffect.stored.stacks === 1, "…Strengthened");
await P.triggerPremeditated(hero, pre[0]);
ok2(effs(orc, "premeditated").length === 0 && effs(orc, "pending")[0]?.flags.flowstate.spellEffect.then.n === Math.floor(150 * 1.5), "Triggering it applies the Mode (Strengthened: Bloom 150 → 225)");
ok2(live().length === 0, "…and the Concentration is over");
tree("mental-ponderance-arts", 0);

console.log("== Dismissing a Concentration is free");
await resetC(); const dis = await concentrate("Trance: Bloom");
dialog = () => ({ e: "0", range: "ranged" });
refresh(); target(orc); await M.dismiss(hero);
ok2(effs(orc, "trance").length === 0 && live().length === 0 && hero.system.ap.value === 6, "A Concentration's effect goes at once, with no attack roll or AP");

console.log("== Trance (Mental Theory T2)");
await resetC(); target(orc); refresh();
dialog = () => "mental-life-dream:bloom";
combat.started = false;
await P.trance(hero);
const tr = effs(orc, "trance");
ok2(tr.length === 1 && tr[0].flags.flowstate.spellEffect.persistent && live().length === 1 && !tr[0].flags.flowstate.spellEffect.hostile, "Trance puts a permanent Mode on the target and a Concentration on you");
messages.length = 0; seq = [20, 5];
await W.pendingTurnStart(orc);
ok2(effs(orc, "tempHP").length === 1 && effs(orc, "tempHP")[0].flags.flowstate.spellEffect.tranceOf === tr[0].id, "At the start of their turn a successful self attack roll applies it (Bloom, immediately)");
seq = [1, 30]; await W.pendingTurnStart(orc);
ok2(effs(orc, "tempHP").length === 0 && /doesn't take hold/.test(messages.map(text).join(" ")), "…a failed one doesn't, and last round's copy is gone");
await CN.end(hero, CN.list(hero)[0].id);
ok2(effs(orc, "trance").length === 0, "Ending the Concentration ends the Trance");
await resetC(); target(orc);
dialog = () => "mental-death-nightmare:wither";
await P.trance(hero);
combat.started = true;
ok2(effs(orc, "trance")[0]?.flags.flowstate.spellEffect.hostile && P.tranceAbilities(orc).length === 1, "A Nightmare (hostile) Mode becomes an ability of the target instead");
await resetC();

console.log("== Mantra (Ponderance Arts T2)");
tree("mental-ponderance-arts", 2);
const ic = mkIcon(hero, "ic", { form: "aegis", grade: 3, attuned: true, tenet: "mental-life-dream:verdant-soul" });
refresh();
const mult0 = W.tenetOf(hero).mult;
const cost = Math.floor((await import("../../module/abilities.mjs")).statMinOf(hero, "pon") / 2);
const eMax = hero.system.energy.value;
dialog = () => null;
ok2(await W.mantraHook.offer(hero, mult0, "Verdant Soul") === mult0 && hero.system.energy.value === eMax, "Mantra is asked as the Tenet is used: declining changes nothing");
dialog = () => ({});
ok2(await W.mantraHook.offer(hero, mult0, "Verdant Soul") === mult0 * 2 && hero.system.energy.value === eMax - cost, "…accepting pays half the Scaling Stat min and doubles the bolded effect");
hero.system.energy.value = cost - 1;
ok2(await W.mantraHook.offer(hero, mult0, "Verdant Soul") === mult0, "…not offered without the Energy");
hero.system.energy.value = eMax;
tree("mental-ponderance-arts", 1);
ok2(await W.mantraHook.offer(hero, mult0, "Verdant Soul") === mult0, "…and not before Ponderance Arts Tier 2");

console.log("== Mantra with Adapt and Infuse");
tree("mental-ponderance-arts", 2); tree("mental-adaptation-dream", 3); tree("mental-destruction-nightmare", 3);
const WBm = await import("../../module/wonders-b.mjs");
ic.system.tenet = "mental-adaptation-dream:adapt"; refresh();
await resetC(); hero.flags.flowstate.mentalOnce = undefined;
await putSpellEffect(hero, { kind: "adaptation", stack: true, caster: hero.uuid, name: "Adaptation", mode: "mental-adaptation-dream:crescendo" });
dialog = () => ({}); confirmAnswer = true;
ok2(await WBm.offerAdapt(hero) === 2, "Adapt with Mantra gives a second Strengthened stack");
await putSpellEffect(hero, { kind: "adaptation", stack: true, caster: hero.uuid, name: "Adaptation", mode: "mental-adaptation-dream:crescendo" });
hero.flags.flowstate.mentalOnce = undefined; dialog = () => null;
ok2(await WBm.offerAdapt(hero) === 1, "…and one without it");
ic.system.tenet = "mental-destruction-nightmare:infuse"; refresh();
const dest = (await import("../../module/mental-rules.mjs")).wonderById("mental-destruction-nightmare").modes[0].id;
const seen = []; const orig = W.MODES[dest]; W.MODES[dest] = async c => { seen.push(c.stacks); return "ok"; };
for (const [label, ans, want] of [["without Mantra", null, -1], ["with Mantra", {}, 0]]) {
  hero.flags.flowstate.mentalOnce = undefined; seen.length = 0;
  dialog = h => (typeof h === "string" && /Mantra/.test(h)) || (h?.title === "Mantra") ? ans : dest;
  await W.ACTS.infuse({ id: "infuse", caster: hero.uuid, target: orc.uuid }, hero, orc);
  ok2(seen[0] === want, `Infuse ${label}: ${want === 0 ? "no Weakened stack" : "Weakened"}`);
}
W.MODES[dest] = orig;
tree("mental-ponderance-arts", 0);

if (fails) { console.log(`${fails} FAILED`); process.exit(1); }
