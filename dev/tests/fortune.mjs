// Fortune (Dream): Wager, Windfall, Providence, Fortune's Bands, Parlay, Double Down, Rig and the Fortune Table; plus the Herald / Umbral Strike / Drown dice.
import { installFoundry } from "./support/foundry.mjs";
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 }); let confirmAnswer = true; let waitAnswer = "ap";
const { combat } = installFoundry({ roll: () => (seq.length ? seq.shift() : 10), dialog: c => dialog(c), confirm: () => confirmAnswer, wait: () => waitAnswer, messages, uuids });

const { FlowStateActorData, FlowStateIconData } = await import("../../module/data.mjs");
const actions = await import("../../module/actions.mjs");
const set = (o, k, v) => foundry.utils.setProperty(o, k, v);
function mkActor(name, extra={}, trees={}) {
  const a = { name, uuid: "Actor."+name, isOwner: true, items: [], statuses: new Set(), flags: {} };
  a.items.get = id => a.items.find(i => i.id === id);
  a.update = async u => { for (const [k,v] of Object.entries(u)) set(a, k, v); a.system.prepareDerivedData(); };
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
const text = m => m.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
globalThis.CONFIG = {};
let fails = 0; const ok2 = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const formulas = [];
globalThis.Roll = class { constructor(f){ this.formula=f; formulas.push(f); } async evaluate(){ this.total = seq.length ? seq.shift() : 10; return this; } async render(){ return `<roll ${this.formula}=${this.total}>`; } };
function addEffects(a) {
  a.effects = [];
  a.effects.get = id => a.effects.find(e => e.id === id);
  let n = 0;
  a.createEmbeddedDocuments = async (type, docs) => docs.map(d => {
    const e = { id: `E${a.name}${n++}`, disabled: false, statuses: new Set(), parent: a, ...structuredClone(d) };
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
const WB = await import("../../module/wonders-b.mjs");
const WE = await import("../../module/wonders-e.mjs");
const R = await import("../../module/mental-rules.mjs");
const stats = { str: 10, dex: 10, con: 10, pon: 30, snap: 25, will: 30, reach: 10, grasp: 10, build: 10 };
const hero = addEffects(mkActor("Gambler", { stats, skillPoints: 30, energy: { value: 200 } }, { "mental-theory": 4, "mental-fortune-dream": 5, "mental-dark-nightmare": 5, "mental-sea-nightmare": 5 }));
const orc = addEffects(mkActor("Orc", { skillPoints: 30, energy: { value: 100 } }, {}));
combat.combatants.length = 0; combat.combatants.push({ actor: hero }, { actor: orc }); combat.combatant = { actor: hero };
const target = (...as) => { game.user.targets = new Set(as.map(a => ({ actor: a, name: a.name, document: {} }))); };
const lastAtk = () => messages.filter(m => m.flags?.flowstate?.attack).at(-1);
const lastDef = () => messages.filter(m => m.flags?.flowstate?.defense).at(-1);
const fxs = (a, k) => actions.spellEffects(a, k);
const reset = () => {
  for (const a of [orc, hero]) { a.effects.splice(0, a.effects.length); a.system.hp.value = 432; a.system.hp.lost = 0; a.statuses.clear(); a.system.conditions = { ignite: 0, stain: 0, slow: 0, haste: 0 }; a.system.prepareDerivedData(); }
  orc.system.energy.value = 100; hero.system.ap.value = 6; hero.system.rp.value = 6; hero.system.energy.value = 200;
  if (hero.flags.flowstate) hero.flags.flowstate.mentalOnce = undefined;
};
const D = hero.system.derived.attackDie;
const P = Math.floor(hero.system.derived.effective.pon.value / 10);
/** Manifest a Fortune Mode at the Orc with the attack roll `atk`; it dodges with `dodge`; then `after` rolls come next (damage, d100...). */
async function cast(mode, atk, { dodge = 1, after = [], extra = {} } = {}) {
  reset(); target(orc); seq = [atk];
  await M.manifest(hero, { mode, range: "ranged", ...extra });
  seq = [dodge, ...after]; await actions.defend(lastAtk(), 0, "dodge");
  return lastDef();
}
const F = "mental-fortune-dream", WAGER = `${F}:wager`, WIND = `${F}:windfall`, PROV = `${F}:providence`;
const half = Math.ceil(D / 2), threeQ = Math.ceil(0.75 * D);

console.log("== Fortune's Bands");
ok2(R.fortuneBand(1, 20).self && R.fortuneBand(9, 20).self && !R.fortuneBand(10, 20).self, "Under one half of the die's max: it hits you instead");
ok2(R.fortuneBand(10, 20).stacks === 2 && R.fortuneBand(14, 20).stacks === 2 && R.fortuneBand(15, 20).stacks === 4 && R.fortuneBand(20, 20).stacks === 4, "One half to three quarters: 2 Strengthened; three quarters and up: 4");
ok2(R.fortuneBand(18, 20, true).stacks === 8 && R.fortuneBand(17, 20, true).stacks === 4 && R.fortuneBand(5, 20, true).stacks === 2 && R.fortuneBand(2, 20, true).stacks === 4 && R.fortuneBand(2, 20, true).self, "Double Down: 8 at seven eighths, and the self hits get 2 (or 4 under one eighth)");
ok2(R.fortuneScale(10, 4, true) === 50 && R.fortuneScale(10, 4) === 30 && R.fortuneScale(10, -1, true) === 5, "Parlay: Strengthened stacks multiply (×1.5 each); Weakened is unchanged");

console.log("== Wager");
await cast(WAGER, half, { after: [7] });
ok2(orc.system.hp.value === 432 - 14, `A hit in the 2-stack band: ${P}d10 = 7 → 14 (no crit, though the roll is double the dodge)`);
await cast(WAGER, D, { after: [7] });
ok2(orc.system.hp.value === 432 - 21, "Three quarters or more: 4 Strengthened (7 → 21)");
await cast(WAGER, 1, { dodge: 30, after: [7] });
ok2(orc.system.hp.value === 432 && hero.system.hp.value === 432 - 7, "Under one half: it hits the caster instead (even on a miss), with no stacks");
await cast(WAGER, D, { after: [7], extra: { "choice:parlay": "yes" } });
ok2(orc.system.hp.value === 432 - 35 && hero.system.energy.value < 200, "Parlay (T2, PON min): the 4 stacks multiply (7 → 35)");
await cast(WAGER, D, { after: [7], extra: { "choice:doubleDown": "yes" } });
ok2(orc.system.hp.value === 432 - 35 && lastAtk().flags.flowstate.attack.opts.net < 0, "Double Down (T4): Disadvantage on the roll, and seven eighths or more gives 8 Strengthened (7 → 35)");
await cast(WAGER, 1, { dodge: 30, after: [7], extra: { "choice:doubleDown": "yes" } });
ok2(hero.system.hp.value === 432 - 21, "…and a self hit under one eighth is Strengthened 4 times (7 → 21)");
await cast(WAGER, half, { after: [7], extra: { enhance: true, "choice:wtype": "cold" } });
ok2(messages.some(m => /Wager: .* cold damage/.test(text(m))), "Enhanced: the damage type picked on Manifest (cold)");

console.log("== Windfall (T3)");
await cast(WIND, half);
ok2(orc.system.energy.value === 100 + 2 * 4 * P, `On a hit: 4 × Power Energy, here with 2 stacks (${orc.system.energy.value - 100})`);
reset(); orc.system.energy.value = orc.system.energy.max - 4; target(orc); seq = [half];
await M.manifest(hero, { mode: WIND, range: "ranged" }); seq = [1]; await actions.defend(lastAtk(), 0, "dodge");
const temp = fxs(orc, "tempHP")[0];
ok2(orc.system.energy.value === orc.system.energy.max && temp?.flags.flowstate.spellEffect.hp === 8 * P - 4, "Energy over the maximum becomes Temp HP 1:1");
reset(); orc.system.energy.value = orc.system.energy.max - 4; target(orc); seq = [half];
await M.manifest(hero, { mode: WIND, range: "ranged", enhance: true }); seq = [1]; await actions.defend(lastAtk(), 0, "dodge");
ok2(fxs(orc, "tempHP")[0]?.flags.flowstate.spellEffect.hp === 2 * (8 * P - 4), "Enhanced: 1:2");
reset(); target(orc); seq = [1];
await M.manifest(hero, { mode: WIND, range: "ranged" }); hero.system.energy.value = 5; seq = [30]; await actions.defend(lastAtk(), 0, "dodge");
ok2(hero.system.energy.value === 0 && hero.system.hp.value === 432 - (4 * P - 5), "A self hit: you lose the Energy instead, and what goes below 0 is health lost 1:1");

console.log("== The Fortune Table and Providence (T5)");
const rows = R.wonderById(F).table?.rows ?? [];
ok2(rows.length === 25 && WE.FORTUNE_ROWS.length === 25, "The table's 25 rows each have an effect");
ok2(WE.fortuneRow(1).index === 0 && WE.fortuneRow(46).index === 10 && WE.fortuneRow(95).index === 23 && WE.fortuneRow(100).index === 24, "A d100 finds its row by the doc's ranges");
await cast(PROV, half, { after: [45] });
ok2(orc.system.conditions.slow === 2 * 15 * P, `Providence: on a hit, a d100 on the table (45: Slow 15 × Power, ×2 stacks = ${orc.system.conditions.slow})`);
await cast(PROV, half, { after: [8, 7] });
ok2(fxs(orc, "noAdvantage").length === 1 && actions.noAdvantage(orc, 2) === 0 && actions.noAdvantage(orc, -1) === -1, "7–11: they can't benefit from Advantage (Disadvantage still counts)");
await cast(PROV, half, { after: [33] });
ok2(orc.system.hp.pain === orc.system.derived.pain && fxs(orc, "fortunePain")[0]?.flags.flowstate.spellEffect.painUp === 2 * 10 * P, "32–35: Pain Threshold raised by 10 × Power");
dialog = c => (/Providence/.test(c) ? "77" : { net: 0 });
await cast(PROV, half, { after: [12, 77], extra: { enhance: true } });
ok2(fxs(orc, "attackUp")[0]?.flags.flowstate.spellEffect.attackDieUp === 2 * P, "Enhanced: two d100s, the caster picks (77: +1 attack die size × Power)");
dialog = () => ({ net: 0 });
await cast(PROV, half, { after: [96, 46] });
ok2(orc.system.conditions.slow === 2 * 15 * P, "95–97 rerolls the table onto the same target");

console.log("== Rig (Tenet)");
reset(); mkIcon(hero, "dice", { form: "aegis", grade: 3, attuned: true, tenet: `${F}:rig` }); hero.system.prepareDerivedData();
const mult = W.tenetOf(hero)?.mult;
ok2(W.tenetOf(hero)?.id === `${F}:rig`, "Rig is Fortune's Tenet");
target(orc); seq = [45];
await WE.rig(hero);
ok2(orc.system.conditions.slow === 15 * mult, `Any time, once per round: roll the table and apply it to someone within 100 ft (× the Tenet's multiplier, ${mult})`);
seq = [45]; await WE.rig(hero);
ok2(orc.system.conditions.slow === 15 * mult, "…once per round");

console.log("== Changed dice: Umbral Strike 1d4, Drown 2d8");
reset(); formulas.length = 0;
await orc.setFlag("flowstate", "umbral", { power: 2, bs: 0 });
await WB.adjust({ attacker: orc, target: hero, amount: 10, type: "physical" });
ok2(formulas.includes("2d4"), `Umbral Strike adds 1d4 × Power (${formulas.join(", ")})`);
const WD = await import("../../module/wonders-d.mjs");
reset(); formulas.length = 0; hero.flags.flowstate.turnStartedAt = Date.now() - 1000;
await WD.forcedMove(orc, 100, `sea:${hero.uuid}`);
target(orc); seq = [20];
await M.manifest(hero, { mode: "mental-sea-nightmare:drown", range: "ranged" }); seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
ok2(formulas.some(f => /^\d+d8$/.test(f) && Number(f.split("d")[0]) % 2 === 0) && !formulas.some(f => /d10$/.test(f)), `Drown's health loss is 2d8 × Power (${formulas.filter(f => /d\d/.test(f)).join(", ")})`);

if (fails) { console.log(`${fails} FAILED`); process.exit(1); }
console.log("all passed");
