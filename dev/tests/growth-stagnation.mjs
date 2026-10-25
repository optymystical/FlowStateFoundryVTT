// Growth (Dream) and Stagnation (Nightmare): Cultivate and its options (Flourish, Thrift, Pierce, Feed, Graft, Bark, Uproot, Offshoot, Full Bloom), Sapling;
// Mire and the Stagnation stacks (Toll, Silt, Grind, Wane, Crush, Stasis), Moss, clearing.
import { installFoundry } from "./support/foundry.mjs";
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 });
const { combat } = installFoundry({ roll: () => (seq.length ? seq.shift() : 10), dialog: c => dialog(c), messages, uuids });

const { FlowStateActorData } = await import("../../module/data.mjs");
const actions = await import("../../module/actions.mjs");
const set = (o, k, v) => foundry.utils.setProperty(o, k, v);
function mkActor(name, extra = {}, trees = {}) {
  const a = { name, uuid: "Actor." + name, isOwner: true, items: [], statuses: new Set(), flags: {} };
  a.items.get = id => a.items.find(i => i.id === id);
  a.update = async u => { for (const [k, v] of Object.entries(u)) set(a, k, v); };
  a.setFlag = async (s, k, v) => { const cur = foundry.utils.getProperty(a.flags, `${s}.${k}`); set(a.flags, `${s}.${k}`, cur && typeof cur === "object" && v && typeof v === "object" && !Array.isArray(v) ? { ...cur, ...v } : v); };
  a.getFlag = (s, k) => foundry.utils.getProperty(a.flags, `${s}.${k}`);
  a.unsetFlag = async (s, k) => set(a.flags, `${s}.${k}`, undefined);
  a.toggleStatusEffect = async (id, { active }) => { active ? a.statuses.add(id) : a.statuses.delete(id); };
  a.getActiveTokens = () => [];
  a.system = Object.assign(Object.create(FlowStateActorData.prototype), { stats: { str: 30, dex: 30, con: 30, pon: 10, snap: 10, will: 10, reach: 10, grasp: 10, build: 10 }, skillPoints: 30, unspentStats: 0, statCarry: 0, trees, size: 3,
    hp: { value: 432, lost: 0 }, energy: { value: 50 }, ap: { value: 6 }, rp: { value: 6 }, conditions: {}, ...extra });
  a.system.prepareDerivedData(); uuids.set(a.uuid, a); game.actors.push(a);
  return a;
}
const text = m => m.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
globalThis.CONFIG = {};
let fails = 0; const ok2 = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
globalThis.Roll = class { constructor(f) { this.formula = f; } async evaluate() { this.total = seq.length ? seq.shift() : 10; return this; } async render() { return `<roll ${this.formula}=${this.total}>`; } };

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
const M = await import("../../module/mental.mjs");
const W = await import("../../module/wonders.mjs");
const WG = await import("../../module/wonders-g.mjs");
const stats = { str: 10, dex: 10, con: 10, pon: 30, snap: 25, will: 30, reach: 10, grasp: 10, build: 10 };
const GROWTH = "mental-growth-dream", STAG = "mental-stagnation-nightmare";
const hero = addEffects(mkActor("Gardener", { stats, energy: { value: 200 } }, { "mental-theory": 4, [GROWTH]: 1, [STAG]: 1 }));
const orc = addEffects(mkActor("Orc", { energy: { value: 100 } }, {}));
const ally = addEffects(mkActor("Ally", { energy: { value: 100 } }, {}));
combat.combatants.length = 0; combat.combatants.push({ actor: hero }, { actor: orc }, { actor: ally }); combat.combatant = { actor: hero };
const refresh = () => { for (const a of [hero, orc, ally]) { a.system.ap.value = 6; a.system.rp.value = 6; } hero.system.energy.value = 200; };
const target = (...as) => { game.user.targets = new Set(as.map(a => ({ actor: a, name: a.name, document: {} }))); };
const lastAtk = () => messages.filter(m => m.flags?.flowstate?.attack).at(-1);
const fxs = (a, k) => actions.spellEffects(a, k);
const D = e => e.flags.flowstate.spellEffect;
const tree = (id, n) => { hero.system.trees[id] = n; hero.system.prepareDerivedData(); };
const newTurn = async a => W.pendingTurnStart(a);          // the actor's own turn start: last action's Growth record and question timers are cleared
const reset = async () => {
  for (const a of [orc, ally, hero]) { a.effects.splice(0, a.effects.length); a.system.hp.value = 432; a.system.hp.lost = 0; a.statuses.clear(); a.system.conditions = {}; for (const k of Object.keys(a.flags)) delete a.flags[k]; a.system.prepareDerivedData(); await newTurn(a); }
  orc.system.energy.value = 100; ally.system.energy.value = 100; combat.combatant = { actor: hero };
};
/** Manifest at a creature, it fails to dodge (a hit, not a crit). */
async function hit(mode, extra = {}, who = orc) {
  refresh(); target(who); seq = [20];
  await M.manifest(hero, { mode, range: "ranged", ...extra });
  seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
}
const P_G = Math.floor(hero.system.derived.effective.pon.value / 10), P_S = Math.floor(hero.system.derived.effective.snap.value / 10);
const CULT = `${GROWTH}:cultivate`, MIRE = `${STAG}:mire`;
const growthAnswer = picks => c => (/Growth stack/.test(c) ? Object.fromEntries([...Object.entries(picks)]) : /Already applied/.test(c) ? { extra: 0 } : {});

console.log("== Cultivate (Growth T1)");
await reset(); dialog = () => ({});
await hit(CULT, {}, ally);
ok2(WG.growthCount(ally) === 1 && D(fxs(ally, "growth")[0]).power === P_G, "On a hit: the target gains a Growth stack (at the Manifest's Power)");
await hit(CULT, { enhance: true }, ally);
ok2(WG.growthCount(ally) === 3 && fxs(ally, "growth").length === 1, "Enhanced: two more, joining the stack already there");

console.log("== Spending: the popup as an action pays its first AP");
await newTurn(ally); refresh();
let asked = "";
dialog = c => { asked = c; return /Growth stack/.test(c) ? { opt_flourish: true, opt_thrift: true, opt_pierce: true } : {}; };
await actions.spendPoints(ally, "ap", 2, "casting");
const rec = ally.getFlag("flowstate", "growthSpent");
ok2(/Thorn/.test(asked) && /Thrift/.test(asked) && !/Pierce/.test(asked), "The popup lists only the options the Cultivator has unlocked (T1: Thorn, Thrift)");
ok2(rec?.opts?.flourish && rec.opts.thrift && !rec.opts.pierce && WG.growthCount(ally) === 1, "Two stacks spent, one per option; a locked option isn't spent");
asked = "";
await actions.spendPoints(ally, "rp", 1, "casting");
ok2(asked === "", "The same action paying the rest of its cost isn't asked again");
const e0 = ally.system.energy.value;
await actions.spendEnergy(ally, 10, "casting");
ok2(ally.system.energy.value === e0 - (10 - 3 * P_G), `Thrift: its Energy costs ${3 * P_G} less`);
await actions.spendEnergy(ally, 10, "casting");
ok2(ally.system.energy.value === e0 - (10 - 3 * P_G) - 10, "…only for that action's payment");

console.log("== Flourish on a weapon attack's damage");
const strike = { label: "Strike", net: 0, stealth: "none", melee: true, push: false, damage: "1d10", type: "physical", stacks: 0, physical: true, shots: 1, critStacks: 0, pierce: 0, knockback: 0, notes: [], followups: [] };
dialog = () => ({ extra: 0 });
target(orc); seq = [20]; await actions.performAttack(ally, strike);
ok2(lastAtk().flags.flowstate.attack.opts.growth?.flourish, "The attack after the payment carries the action's Flourish");
seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
let hp0 = orc.system.hp.value;
seq = [5, 4 * P_G]; await actions.rollExchangeDamage(messages.filter(m => m.flags?.flowstate?.defense).at(-1));
ok2(hp0 - orc.system.hp.value === 5 + 4 * P_G, `Flourish: ${2 * P_G}d8 more damage of the attack's type (${hp0 - orc.system.hp.value})`);
target(orc); seq = [20]; await actions.performAttack(ally, strike);
ok2(!lastAtk().flags.flowstate.attack.opts.growth, "A second attack (no new payment, no stacks to spend) carries nothing");

console.log("== Tier 2–4 options: Pierce, Feed, Graft, Bark, Uproot, Offshoot");
await reset(); tree(GROWTH, 4); dialog = () => ({});
await hit(CULT, { enhance: true }, ally); await hit(CULT, { enhance: true }, ally);
ok2(WG.growthCount(ally) === 4, "Four stacks to spend");
await newTurn(ally); refresh();
dialog = c => (/Growth stack/.test(c) ? { opt_feed: true, opt_graft: true, opt_bark: true, opt_offshoot: true, copy: "feed" } : {});
await actions.spendPoints(ally, "ap", 2, "casting");
const r2 = ally.getFlag("flowstate", "growthSpent");
ok2(r2.opts.feed?.n === 2 && r2.opts.offshoot?.copied === "feed" && WG.growthCount(ally) === 0, "Offshoot copies another option spent on the action (Feed twice)");
const bark = fxs(ally, "tempHP").find(e => D(e).bark);
ok2(bark && D(bark).hp === 10 * P_G && D(bark).caster === ally.uuid, `Bark: ${10 * P_G} Temp HP for the acting creature, until its next turn`);
await actions.giveStacks(orc, "ignite", 5, { caster: ally });
ok2(orc.system.conditions.ignite === 5 + 2 * 12 * P_G, `Feed: Ignite it applies is ${2 * 12 * P_G} more (doubled by Offshoot)`);
await actions.giveStacks(orc, "ignite", 5, { caster: ally });
ok2(orc.system.conditions.ignite === 10 + 2 * 12 * P_G, "…once per kind and target");
await actions.putSpellEffect(orc, { kind: "shield", caster: ally.uuid, hp: 8, max: 8, name: "Shield (8)" });
ok2(D(fxs(orc, "shield")[0]).hp === 8 + 10 * P_G, `Graft: shielding it grants is ${10 * P_G} more`);
await actions.putSpellEffect(orc, { kind: "tempHP", caster: hero.uuid, hp: 8, max: 8, name: "Temp HP (8)" });
ok2(D(fxs(orc, "tempHP")[0]).hp === 8, "…only what the acting creature grants");

console.log("== Uproot and Pierce on an attack, armed from the Action List");
await reset(); tree(GROWTH, 4); dialog = () => ({});
await hit(CULT, { enhance: true }, ally);
dialog = c => (/Growth stack/.test(c) ? { opt_uproot: true, opt_pierce: true } : {});
await WG.armGrowth(ally);
ok2(ally.getFlag("flowstate", "growthSpent")?.armed && WG.growthCount(ally) === 0, "Arming spends the stacks now, for the next action");
asked = ""; dialog = c => { asked = c; return { extra: 0 }; };
target(orc); seq = [20]; refresh(); await actions.performAttack(ally, strike);
const go = lastAtk().flags.flowstate.attack.opts.growth;
ok2(!/Growth stack/.test(asked) && go?.uproot && go.pierce, "The next attack takes up the armed options without asking");
seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
const up = messages.filter(m => m.flags?.flowstate?.knockback && /Uproot/.test(m.content)).at(-1);
ok2(up && up.flags.flowstate.knockback.attacker === hero.uuid, "Uproot: on a hit, Force on the target, its direction the Cultivator's to choose");
seq = [5]; await actions.rollExchangeDamage(messages.filter(m => m.flags?.flowstate?.defense).at(-1));
ok2(/Pierce \(Growth\): ignores up to 30 more Limit/.test(text(messages.at(-1))) || /Pierce 30/.test(text(messages.at(-1))), `Pierce: the attack ignores ${10 * P_G} more Limit`);

console.log("== Full Bloom (T5)");
await reset(); tree(GROWTH, 5); dialog = () => ({});
await hit(CULT, { enhance: true }, ally); await hit(CULT, {}, ally);
await newTurn(ally); refresh();
dialog = c => (/Growth stack/.test(c) ? { opt_flourish: true, opt_pierce: true, opt_bark: true } : { extra: 0 });
await actions.spendPoints(ally, "ap", 2, "attacking");
const r3 = ally.getFlag("flowstate", "growthSpent");
ok2(r3.bloom && r3.opts.bark.bs === 1, "Three options: the Growth effects are Strengthened");
ok2(D(fxs(ally, "tempHP").find(e => D(e).bark)).hp === Math.floor(10 * P_G * 1.5), "…Bark's Temp HP among them");
target(orc); seq = [20]; await actions.performAttack(ally, strike);
ok2(lastAtk().flags.flowstate.attack.opts.stacks === 1, "…and so is the action (the attack +1 Strengthened)");

console.log("== Sapling (Tenet)");
await reset();
hero.system.icon = { system: { tenet: `${GROWTH}:sapling`, profile: { valid: true, tenet: { wonder: GROWTH, mult: 1 } } } };
ok2(W.tenetOf(hero)?.id === `${GROWTH}:sapling`, "Sapling is the attuned Tenet");
dialog = c => (/Sapling/.test(c) ? { v: hero.uuid } : {});
await W.ACTS.sapling({ mult: 1, bstacks: 0 }, hero, orc);
ok2(WG.growthCount(hero) === 1 && WG.growthCount(orc) === 0, "Once per round: the target or you gains a Growth stack");
ok2(!(await W.ACTS.sapling({ mult: 1, bstacks: 0 }, hero, orc)), "…only once per round");
hero.system.icon = null;

console.log("== Mire (Stagnation T1): Toll and Silt");
await reset(); tree(STAG, 1); dialog = () => ({});
await hit(MIRE, { "choice:mire": "mental" });
ok2(fxs(orc, "mire")[0] && D(fxs(orc, "mire")[0]).types.join() === "mental", "On a hit: the chosen action type is Mired");
await hit(MIRE, { "choice:mire": "mental" });
ok2(fxs(orc, "mire").length === 1 && /already Mired/.test(text(messages.filter(m => /Mire/.test(m.content)).at(-1))), "Miring a type that is already Mired has no effect");
await actions.actionSpent(orc, "martial", 3);
ok2(!WG.stagnationOf(orc), "Points on an action that isn't Mired give no stacks");
await WG.actionSpent(orc, { type: "mental", points: 2 });
ok2(WG.stagnationOf(orc)?.count === 2, "Each point spent on a Mired action: a Stagnation stack");
ok2(orc.system.energy.value === 100 - 2 * P_S, `Toll (1 stack): it loses ${2 * P_S} Energy`);
ok2(orc.system.conditions.slow === 12 * P_S, `Silt (2 stacks): ${12 * P_S} Slow`);
await WG.actionSpent(orc, { type: "mental", points: 3 });
ok2(WG.stagnationOf(orc).count === 5 && orc.system.hp.value === 432, "Without the higher tiers, counts 3 and up do nothing");

console.log("== Toll past 0 Energy is health loss");
await reset(); dialog = () => ({});
await hit(MIRE, { "choice:mire": "martial" });
orc.system.energy.value = 1;
await actions.actionSpent(orc, "martial", 1);
ok2(orc.system.energy.value === 0 && orc.system.hp.value === 432 - (2 * P_S - 1), `The ${2 * P_S - 1} Energy it doesn't have becomes health loss`);

console.log("== Grind, Wane, Crush, Stasis (T2–T5)");
await reset(); tree(STAG, 5); dialog = () => ({});
await hit(MIRE, { enhance: true, "choice:mire": "mental", "choice:mire2": "magic" });
ok2(D(fxs(orc, "mire")[0]).types.join() === "mental,magic", "Enhanced: two action types");
hp0 = orc.system.hp.value;
seq = [7];
await WG.actionSpent(orc, { type: "magic", points: 3 });
ok2(hp0 - orc.system.hp.value === 7, "Grind (3 stacks): physical damage");
ok2(!WG.waneDie(orc, { spell: {} }), "Wane needs 4 or more stacks");
seq = [400];
await WG.actionSpent(orc, { type: "magic", points: 2 });
ok2(WG.waneDie(orc, { spell: {} })?.pen === P_S && WG.waneDie(orc, { mental: { mode: CULT } })?.pen === P_S && !WG.waneDie(orc, {}), `Wane (4+): attack dice for Mired types are ${P_S} smaller (not a Martial attack)`);
ok2(messages.some(m => /Crush/.test(m.content)) && orc.statuses.has("prone"), "Crush (5): downward Force (Force damage, prone at its height or more)");
const slow0 = orc.system.conditions.slow ?? 0;
asked = ""; dialog = c => { asked = c; return /Stasis/.test(c) ? { a: "silt", b: "silt" } : {}; };
await WG.actionSpent(orc, { type: "mental", points: 1 });
ok2(/Stasis/.test(asked) && orc.system.conditions.slow === slow0 + 24 * P_S, `Stasis (6+): two effects of the Stagnation user's choice; two Silts are one ${24 * P_S} Slow`);

console.log("== Moss (Tenet) and clearing");
await reset();
await W.ACTS.moss({ mult: 1, bstacks: 0 }, hero, orc);
ok2(WG.stagnationOf(orc)?.count === 1 && orc.system.energy.value === 98, "Moss: once per round on a Manifest hit, the target gains a Stagnation stack (and its Toll)");
ok2(!(await W.ACTS.moss({ mult: 1, bstacks: 0 }, hero, orc)), "…only once per round");
await actions.mentalBeforeClear(ally);
ok2(WG.stagnationOf(orc)?.count === 1, "Another creature's turn starting leaves them");
await actions.mentalBeforeClear(hero);
ok2(!WG.stagnationOf(orc), "The start of a source's next turn removes all of them");

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
if (fails) process.exit(1);
