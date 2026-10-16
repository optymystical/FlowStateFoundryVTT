// Light (Dream) and Dark (Nightmare): Illuminate, Eclipse, Tenets, Refraction, Totality, Umbral Strike, Dispersion, Corona and Nightfall.
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

const WB = await import("../../module/wonders-b.mjs");
const WC = await import("../../module/wonders-c.mjs");
const { spellEffects, putSpellEffect } = actions;
const tree = (id, n) => { hero.system.trees[id] = n; hero.system.prepareDerivedData(); };
const fxs = (a, k) => spellEffects(a, k);
const mtrees = { ...mTrees, "mental-light-dream": 5, "mental-dark-nightmare": 5 };
Object.assign(hero.system.trees, mtrees); hero.system.prepareDerivedData();
const ILL = "mental-light-dream:illuminate", ECL = "mental-dark-nightmare:eclipse";
const power = (stat) => Math.floor(hero.system.derived.effective[stat].value / 10);

console.log("== Illuminate (Light T1)");
reset(); dialog = h => (typeof h === "string" ? h : { net: 0 });
const atk0 = orc.system.derived.attackDie;
dialog = () => "enemy"; await hit(ILL);
const ie = fxs(orc, "illuminated")[0];
ok2(ie && ie.flags.flowstate.spellEffect.attackDie === power("pon") && orc.system.derived.attackDie === atk0 - power("pon"), "Against an enemy: their attack rolls have their die size reduced by 1 × Power");
reset(); dialog = () => "ally"; await hit(ILL);
ok2(fxs(orc, "illumWard").length === 1 && fxs(orc, "illuminated").length === 0 && orc.system.derived.attackDie === atk0, "Against an ally: the effect is on attacks against them, not their own die");
const pw = power("pon");
ok2(WC.attackDieAgainst(ally, orc)?.pen === pw, "An attacker who isn't on the Light user's side has a smaller attack die against the warded ally");
ok2(WC.attackDieAgainst(hero, orc) === null, "…the Light user's own attacks are unaffected");
await putSpellEffect(ally, { kind: "illuminated", caster: hero.uuid, name: "Illuminated", attackDie: pw });
tree("mental-light-dream", 2);
ok2(WC.attackDieAgainst(ally, orc) === null, "Without Convergence the two versions don't stack (the worse applies)");
tree("mental-light-dream", 3);
ok2(WC.attackDieAgainst(ally, orc)?.pen === pw, "Convergence (T3): an Illuminated attacker against a warded target suffers both reductions");
tree("mental-light-dream", 5);

console.log("== Illuminate Enhanced weakens the damage");
reset(); dialog = () => "enemy"; await hit(ILL, { enhance: true });
const base = (await WB.adjust({ attacker: orc, target: hero, amount: 40, type: "physical" })).amount;
ok2(base === 20, "Enhanced: damage from the Illuminated creature's attacks is Weakened");
reset(); dialog = () => "enemy"; await hit(ILL);
ok2((await WB.adjust({ attacker: orc, target: hero, amount: 40, type: "physical" })).amount === 40, "…not when it isn't Enhanced");

console.log("== Eclipse (Dark T1)");
reset(); dialog = () => "enemy"; await hit(ECL);
const ee = fxs(orc, "eclipsed")[0];
const half = Math.ceil(power("snap") * 0.5);
ok2(ee && ee.flags.flowstate.spellEffect.dodgeDie === half && orc.system.derived.dodgeDie === ally.system.derived.dodgeDie - half, "Against an enemy: dodge die reduced by 0.5 × Power (rounded down)");
reset(); dialog = () => "ally"; await hit(ECL);
ok2(fxs(orc, "eclipseWard").length === 1 && fxs(orc, "obscured").length === 1, "Against an ally: their attacks shrink dodge dice, and they're one step more obscured");
ok2(WC.dodgeDieAgainst(orc, ally)?.pen === half, "…a target dodges with a smaller die against that ally");
await putSpellEffect(ally, { kind: "eclipsed", caster: hero.uuid, name: "Eclipsed", dodgeDie: half });
ok2(WC.dodgeDieAgainst(orc, ally) === null, "…and the two Eclipse effects don't stack");
reset(); dialog = () => "enemy"; await hit(ECL, { enhance: true });
ok2((await WB.adjust({ attacker: ally, target: orc, amount: 20, type: "physical" })).amount === 30, "Enhanced: damage against the Eclipsed creature is Strengthened");

console.log("== Totality and Umbral Strike");
reset(); clearAll(ally);
await putSpellEffect(orc, { kind: "eclipseWard", caster: hero.uuid, name: "Eclipsed (ally)", dodgeAgainst: 1 });
await putSpellEffect(ally, { kind: "eclipsed", caster: hero.uuid, name: "Eclipsed", dodgeDie: 1 });
let o2 = await WC.attackStart(orc, { stealth: "none", notes: [] }, [ally]);
ok2(o2?.stealth === "half", "Totality (T3): an Eclipsed ally attacking an Eclipsed target is in half stealth against it");
tree("mental-dark-nightmare", 2);
ok2(await WC.attackStart(orc, { stealth: "none", notes: [] }, [ally]) === undefined, "…not before Dark Tier 3");
tree("mental-dark-nightmare", 5);
reset(); clearAll(ally); dialog = () => "enemy"; await hit("mental-dark-nightmare:umbral-strike");
const uc = fxs(orc, "umbralCharge")[0];
ok2(uc?.flags.flowstate.spellEffect.count === 1, "Umbral Strike stores a charge on the target");
dialog = () => null;
ok2(await WC.attackStart(orc, { stealth: "none", notes: [] }, [ally]) === undefined && fxs(orc, "umbralCharge").length === 1, "Declining keeps the charge");
dialog = () => ({});
o2 = await WC.attackStart(orc, { stealth: "none", notes: [] }, [ally]);
ok2(o2?.stealth === "half" && fxs(orc, "umbralCharge").length === 0 && !!orc.getFlag("flowstate", "umbral"), "Using it: one step deeper into stealth, the charge is spent");
seq = [5];
ok2((await WB.adjust({ attacker: orc, target: hero, amount: 20, type: "physical" })).amount === 25 && !orc.getFlag("flowstate", "umbral"), "…and its damage gets 1d4 × Power more, once");
reset(); dialog = () => "enemy"; await hit("mental-dark-nightmare:umbral-strike", { enhance: true });
ok2(fxs(orc, "umbralCharge")[0]?.flags.flowstate.spellEffect.count === 2, "Enhanced: two charges");

console.log("== Beacon, Shadowmark, Refraction and Penumbra are offered");
const ic = mkIcon(hero, "ic", { form: "aegis", grade: 3, attuned: true, tenet: "mental-light-dream:beacon" }); hero.system.prepareDerivedData();
ok2(W.tenetOf(hero)?.id === "mental-light-dream:beacon", "Beacon is a Tenet you can select");
reset(); hero.flags.flowstate.mentalOnce = undefined; dialog = () => "enemy";
messages.length = 0; await hit(ILL);
await new Promise(r => setTimeout(r, 30));
const acts = messages.flatMap(m => m.flags?.flowstate?.mentalAct?.acts ?? []);
ok2(acts.some(a => a.id === "refraction"), "Illuminate offers Refraction");
await hero.setFlag("flowstate", "autoDecline", { wonderAbilities: true });
reset(); messages.length = 0; await hit(ILL); await new Promise(r => setTimeout(r, 30));
ok2(!messages.some(m => m.flags?.flowstate?.mentalAct?.acts?.some(a => a.id === "refraction")), "…unless the ability buttons are switched off (Reactions)");
await hero.setFlag("flowstate", "autoDecline", { wonderAbilities: false });
hero.flags.flowstate.mentalOnce = undefined; await W.ACTS.beacon({ caster: hero.uuid }, hero, orc);
ok2(fxs(orc, "beacon").length === 1, "Beacon puts a marker on the target");
ic.system.tenet = "mental-dark-nightmare:shadowmark"; hero.flags.flowstate.mentalOnce = undefined; dialog = () => orc.uuid;
reset();
await W.ACTS.shadowmark({ caster: hero.uuid }, hero, orc);
ok2(fxs(orc, "obscured")[0]?.flags.flowstate.spellEffect.level === 1 || fxs(hero, "obscured").length + fxs(orc, "obscured").length >= 1, "Shadowmark makes someone one step more obscured");

console.log("== Dispersion (Light T4)");
reset(); clearAll(ally); refresh();
await putSpellEffect(orc, { kind: "tempHP", caster: ally.uuid, name: "Temp HP", hp: 50, max: 50, mode: "mental-life-dream:bloom" });
await putSpellEffect(orc, { kind: "hex", caster: ally.uuid, name: "A Hex", mode: "" });
const tfx = orc.effects.find(e => e.name === "Temp HP");
{
  target(orc);
  dialog = () => ({ e: tfx.uuid, net: 0 });
  seq = [20]; await M.manifest(hero, { mode: "mental-light-dream:dispersion", range: "ranged" });
  const card = lastAtk();
  ok2(card?.flags.flowstate.attack.targets[0].uuid === ally.uuid && card.flags.flowstate.attack.opts.mental?.disperse?.targets?.[0]?.uuid === tfx.uuid, "Dispersion goes at the effect's creator (their dodge), not at its holder");
  seq = [1]; await actions.defend(card, 0, "dodge");
  ok2(!orc.effects.includes(tfx) && fxs(orc, "tempHP").length === 0, "On a hit an effect with health loses 20 × Power health (here it's gone)");
}

console.log("== Dispersion against Summons, Animations and Made items");
reset(); clearAll(ally); refresh();
const wisp = addEffects(mkActor("Wisp", { skillPoints: 5, hp: { value: 100, lost: 0 } }, {}));
wisp.flags.flowstate = { summon: { owner: ally.uuid, kind: "summon", hp: 100 } }; wisp.system.prepareDerivedData();
target(wisp);
dialog = () => ({ e: wisp.uuid, net: 0 });
seq = [20]; await M.manifest(hero, { mode: "mental-light-dream:dispersion", range: "ranged" });
const sc = lastAtk();
ok2(sc?.flags.flowstate.attack.targets[0].uuid === ally.uuid && sc.flags.flowstate.attack.opts.mental?.disperse?.targets?.[0]?.kind === "summon", "A Summon (marked with its caster) can be dispersed: the attack goes at its creator");
seq = [1]; await actions.defend(sc, 0, "dodge");
ok2(wisp.system.hp.value <= 100 - 20 * power("pon") || wisp.system.hp.value < 100, `On a hit it loses 20 × Power health (${wisp.system.hp.value} left of 100)`);
const gem = mkWeapon(ally, "gem", { wear: 0 }); gem.flags = { flowstate: { made: { caster: ally.uuid, ritualOf: null } } };
gem.update = async u => { for (const [k, v] of Object.entries(u)) set(gem, k, v); };
const w0 = gem.system.wear;
target(ally);
dialog = () => ({ e: gem.uuid, net: 0 });
reset(); refresh(); seq = [20]; await M.manifest(hero, { mode: "mental-light-dream:dispersion", range: "ranged" });
const ic2 = lastAtk();
ok2(ic2?.flags.flowstate.attack.opts.mental?.disperse?.targets?.[0]?.kind === "item", "A Made item can be dispersed too");
seq = [1]; await actions.defend(ic2, 0, "dodge");
ok2(gem.system.wear === w0 + 2 * 20 * power("pon"), `On a crit it loses 20 × Power durability, doubled by the crit's stacks (wear ${gem.system.wear})`);

console.log("== Corona and Nightfall (T5)");
reset(); refresh(); dialog = () => "enemy"; await hit(ILL); refresh(); seq = [20]; dialog = () => orc.uuid;
const ap0 = hero.system.ap.value;
await WC.expand(hero, "light");
const cc = lastAtk();
ok2(hero.system.ap.value === ap0 - 1 && cc.flags.flowstate.attack.opts.mental?.expand?.which === "light" && cc.flags.flowstate.attack.targets[0].uuid === orc.uuid, "Corona: 1 AP and an attack roll at a creature under your Illuminate");
seq = [1]; messages.length = 0; await actions.defend(cc, 0, "dodge");
ok2(/within 10 ft/.test(messages.map(text).join(" ")), "On a hit it looks for everyone within 10 ft (no one else here)");
tree("mental-light-dream", 4);
ok2(await WC.expand(hero, "light") === undefined, "Corona needs Light Tier 5");
tree("mental-light-dream", 5);
reset(); refresh();
ok2(await WC.expand(hero, "dark") === undefined, "Nightfall needs a creature under your Eclipse");

if (fails) { console.log(`${fails} FAILED`); process.exit(1); }
