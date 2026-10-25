// Ruin (Nightmare): Jinx, Forfeit, Calamity, Ruin's Bands, Gild, Reversal, Doom and the Ruin Table.
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
globalThis.CONFIG = {};
let fails = 0; const ok2 = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
globalThis.Roll = class { constructor(f){ this.formula=f; } async evaluate(){ this.total = seq.length ? seq.shift() : 10; return this; } async render(){ return `<roll ${this.formula}=${this.total}>`; } };
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
  i.system = Object.assign(Object.create(FlowStateIconData.prototype), { form: "veil", grade: 3, attuned: true, tenet: "", chosen: "physical", ...sys }, { parent: i });
  i.update = async u => { for (const [k, v] of Object.entries(u)) set(i, k, v); actor.system.prepareDerivedData(); };
  actor.items.push(i); uuids.set(i.uuid, i); actor.system.prepareDerivedData(); return i;
}
const M = await import("../../module/mental.mjs");
const W = await import("../../module/wonders.mjs");
const WB = await import("../../module/wonders-b.mjs");
const WF = await import("../../module/wonders-f.mjs");
const R = await import("../../module/mental-rules.mjs");
const arcana = await import("../../module/arcana.mjs");
const stats = { str: 10, dex: 10, con: 10, pon: 10, snap: 30, will: 30, reach: 10, grasp: 10, build: 10 };
const hero = addEffects(mkActor("Jinxer", { stats, skillPoints: 30, energy: { value: 200 } }, { "mental-theory": 4, "mental-ruin-nightmare": 5 }));
const orc = addEffects(mkActor("Orc", { skillPoints: 30, energy: { value: 100 } }, {}));
combat.combatants.length = 0; combat.combatants.push({ actor: hero }, { actor: orc }); combat.combatant = { actor: hero };
const target = (...as) => { game.user.targets = new Set(as.map(a => ({ actor: a, name: a.name, document: {} }))); };
const lastAtk = () => messages.filter(m => m.flags?.flowstate?.attack).at(-1);
const fxs = (a, k) => actions.spellEffects(a, k);
const reset = () => {
  for (const a of [orc, hero]) { a.effects.splice(0, a.effects.length); a.system.hp.value = 432; a.system.hp.lost = 0; a.statuses.clear(); a.system.conditions = { ignite: 0, stain: 0, slow: 0, haste: 0 }; a.system.prepareDerivedData(); }
  orc.system.energy.value = 100; hero.system.ap.value = 6; hero.system.rp.value = 6; hero.system.energy.value = 200;
  if (hero.flags.flowstate) hero.flags.flowstate.mentalOnce = undefined;
  combat.combatant = { actor: hero };
};
const P = Math.floor(hero.system.derived.effective.snap.value / 10);
const OD = orc.system.derived.attackDie;
const A2 = Math.ceil(OD * 0.3);                    // a roll between one quarter and one half of the die: 2 Strengthened
const RU = "mental-ruin-nightmare", JINX = `${RU}:jinx`, FORFEIT = `${RU}:forfeit`, CAL = `${RU}:calamity`;
/** Manifest a Ruin Mode at the Orc (a hit); `after` = rolls after the dodge. */
async function jinx(mode, { extra = {}, after = [] } = {}) {
  target(orc); hero.system.ap.value = 6; seq = [20];
  await M.manifest(hero, { mode, range: "ranged", ...extra });
  seq = [12, ...after]; await actions.defend(lastAtk(), 0, "dodge");
}
/** The Orc attacks the Jinxer, rolling `atk` on its attack die; `after` = rolls the Jinxes need. Returns the attack card's entry. */
async function orcAttacks(atk, after = []) {
  combat.combatant = { actor: orc }; seq = [atk, ...after];
  await actions.performAttack(orc, { label: "Swing", net: 0, stealth: "none", melee: false, area: false, push: false, damage: "", type: "physical", stacks: 0, physical: false, shots: 1, critStacks: 0, pierce: 0, bash: 0, knockback: 0, followups: [], targetActors: [hero] });
  combat.combatant = { actor: hero };
  return lastAtk().flags.flowstate.attack.targets[0];
}
const decline = c => (/Reversal|flip/.test(c) ? null : { net: 0 });
dialog = decline;

console.log("== Ruin's Bands and Reversal maths");
ok2(R.ruinBand(10, 20).fizzle && R.ruinBand(20, 20).fizzle && R.ruinBand(9, 20).stacks === 2 && R.ruinBand(5, 20).stacks === 2 && R.ruinBand(4, 20).stacks === 4 && R.ruinBand(1, 20).stacks === 4, "Half or higher the Jinxes fizzle; under one half 2, under one quarter 4 Strengthened");
ok2(R.flipRoll(15, 20) === 6 && R.flipRoll(1, 20) === 20, "A flip is the die's size + 1 − the result");

console.log("== Jinx");
reset(); await jinx(JINX);
const jx = fxs(orc, "jinx")[0];
ok2(jx && jx.flags.flowstate.spellEffect.payload.type === "damage" && orc.system.hp.value === 432, "On a hit: a Jinx is stored, nothing happens yet (no crit, though the roll was high)");
await orcAttacks(1, [7]);
ok2(fxs(orc, "jinx").length === 0 && orc.system.hp.value === 432 - 21, `Their next attack roll resolves it: under one quarter, 4 Strengthened (${P}d12 = 7 → 21)`);
reset(); await jinx(JINX);
await orcAttacks(A2, [7]);
ok2(orc.system.hp.value === 432 - 14, "One quarter to under one half: 2 Strengthened (7 → 14)");
reset(); await jinx(JINX);
await orcAttacks(Math.ceil(OD / 2), [7]);
ok2(fxs(orc, "jinx").length === 0 && orc.system.hp.value === 432, "Half or higher: it fizzles");
reset(); await jinx(JINX, { extra: { enhance: true } });
await orcAttacks(OD);
ok2(fxs(orc, "jinx").length === 1 && fxs(orc, "jinx")[0].flags.flowstate.spellEffect.waited, "Enhanced: the first time it would fizzle it waits for their next attack roll");
await orcAttacks(OD);
ok2(fxs(orc, "jinx").length === 0, "…the second time it fizzles");

console.log("== Gild (T2) and Reversal (T4)");
reset(); await jinx(JINX, { extra: { "choice:gild": "yes" } });
ok2(fxs(orc, "jinx")[0]?.flags.flowstate.spellEffect.gild && hero.system.energy.value < 200, "Gild (SNA min) marks the Jinx");
let entry = await orcAttacks(1, [7]);
ok2(entry.net === -1, "…and the roll that resolves it has Disadvantage");
reset(); await jinx(JINX);
dialog = c => (/Reversal/.test(c) ? {} : { net: 0 });
const e0 = hero.system.energy.value;
entry = await orcAttacks(1, [7]);
ok2(orc.system.hp.value === 432 - 21 && entry.total === OD && hero.system.energy.value < e0, `Reversal: the Jinx resolves on the original 1, then their attack uses the flipped ${entry.total}`);
dialog = decline;

console.log("== Forfeit (T3)");
reset(); await jinx(FORFEIT);
await orcAttacks(A2);
ok2(orc.system.energy.value === 100 - 2 * 4 * P, `It removes 4 × Power Energy (here 2 Strengthened: ${100 - orc.system.energy.value})`);
reset(); await jinx(FORFEIT, { extra: { enhance: true } }); orc.system.energy.value = 5;
await orcAttacks(A2);
ok2(orc.system.energy.value === 0 && orc.system.hp.value === 432 - 2 * (8 * P - 5), "What goes below 0 is Supernatural damage (Enhanced: 2 a point)");

console.log("== Calamity (T5) and the Ruin Table");
ok2((R.wonderById(RU).table?.rows ?? []).length === 25 && WF.RUIN_ROWS.length === 25 && WF.ruinRow(1).index === 0 && WF.ruinRow(30).index === 7 && WF.ruinRow(100).index === 24, "The table's 25 rows, found by the doc's ranges");
reset(); await jinx(CAL, { after: [30] });
ok2(fxs(orc, "jinx")[0]?.flags.flowstate.spellEffect.payload.roll === 30, "Calamity stores a Ruin Table result as a Jinx (30)");
await orcAttacks(A2, [7]);
ok2(orc.system.hp.value < 432 && orc.system.conditions.slow === 2 * 10 * P, `It resolves like any Jinx (29–32: cold and 10 × Power Slow, ×2 stacks = ${orc.system.conditions.slow})`);
reset();
await WF.applyRuin(hero, orc, { P, n: 54 });
ok2((await WF.attackNetBefore(orc)).net === -1 && fxs(orc, "ruinAttackDis").length === 0, "53–56: their next attack roll has Disadvantage (then it's used up)");
await WF.applyRuin(hero, orc, { P, n: 58 });
ok2(await WF.dodgeNext(orc) === -1 && await WF.dodgeNext(orc) === 0, "57–60: their next dodge roll has Disadvantage, once");
await WF.applyRuin(hero, orc, { P, n: 42 }); orc.system.energy.value = 50; combat.combatant = { actor: orc };
await actions.spendEnergy(orc, 1, "something");
ok2(orc.system.energy.value === 50 - 1 - 3 * P, `41–44: the next Energy spent costs 3 × Power more (${50 - orc.system.energy.value})`);
combat.combatant = { actor: hero };
await WF.applyRuin(hero, orc, { P, n: 82 });
ok2((await WB.adjust({ attacker: hero, target: orc, amount: 10, type: "physical" })).amount === 15 && (await WB.adjust({ attacker: hero, target: orc, amount: 10, type: "physical" })).amount === 10, "81–84: the next damage they take is Strengthened, once");
await WF.applyRuin(hero, orc, { P, n: 22 });
ok2(arcana.healingDown(orc) > 1000, "21–24: they can't regain health until your next turn");
const hpB = orc.system.hp.value; seq = [5];
await WF.applyRuin(hero, orc, { P, n: 26 });
await W.pendingTurnStart(orc);
ok2(orc.system.hp.value === hpB - 10 && fxs(orc, "ruinBurn").length === 0, "25–28: the heat now, and the same again at the start of their next turn");
await WF.applyRuin(hero, orc, { P, n: 6 });
const hpC = orc.system.hp.value;
await orcAttacks(1, [4]);
ok2(orc.system.hp.value === hpC - 4, "5–8: their next attack hurts them, hit or miss");

console.log("== Doom (Tenet)");
reset(); mkIcon(hero, "skull", { tenet: `${RU}:doom` }); hero.system.prepareDerivedData();
ok2(W.tenetOf(hero)?.id === `${RU}:doom`, "Doom is Ruin's Tenet");
target(orc); seq = [98, 20];
await WF.doom(hero);
const dm = lastAtk();
ok2(dm?.flags.flowstate.attack.opts.mental?.doom?.n === 98 && !orc.statuses.has("prone"), "Roll the Ruin Table, then an attack roll at someone within 100 ft");
seq = [12, 6]; await actions.defend(dm, 0, "dodge");
ok2(orc.statuses.has("prone") && orc.system.hp.value < 432, "On a hit it applies (97–100: Supernatural damage, knocked prone)");

if (fails) { console.log(`${fails} FAILED`); process.exit(1); }
console.log("all passed");
