// Non Stat Checks (Generic Groups): the plain attack die, static targets, contests (the acting side wins ties), the Tier 3 rerolls and Push Through.
import { installFoundry } from "./support/foundry.mjs";
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 });
installFoundry({ roll: () => (seq.length ? seq.shift() : 10), dialog: c => dialog(c), messages, uuids });

const { FlowStateActorData } = await import("../../module/data.mjs");
const actions = await import("../../module/actions.mjs");
const checks = await import("../../module/checks.mjs");
const R = await import("../../module/checks-rules.mjs");
const set = (o, k, v) => foundry.utils.setProperty(o, k, v);
function mkActor(name, trees = {}, extra = {}) {
  const a = { name, uuid: "Actor." + name, isOwner: true, items: [], statuses: new Set(), flags: {} };
  a.items.get = id => a.items.find(i => i.id === id);
  a.update = async u => { for (const [k, v] of Object.entries(u)) set(a, k, v); };
  a.setFlag = async (s, k, v) => set(a.flags, `${s}.${k}`, v);
  a.getFlag = (s, k) => foundry.utils.getProperty(a.flags, `${s}.${k}`);
  a.unsetFlag = async (s, k) => set(a.flags, `${s}.${k}`, undefined);
  a.getActiveTokens = () => [];
  a.system = Object.assign(Object.create(FlowStateActorData.prototype), { stats: { str: 30, dex: 30, con: 30, pon: 10, snap: 10, will: 10, reach: 10, grasp: 10, build: 10 }, skillPoints: 30, unspentStats: 0, statCarry: 0,
    trees, size: 3, hp: { value: 432, lost: 0 }, energy: { value: 150 }, ap: { value: 6 }, rp: { value: 6 }, conditions: { ignite: 0, stain: 0, slow: 0, haste: 0 }, lift: 0, daysWithoutRest: 0,
    senses: { sight: "primary", hearing: "primary", smell: "secondary" }, ...extra }, { parent: a });
  a.system.prepareDerivedData(); uuids.set(a.uuid, a); game.actors.push(a);
  return a;
}
const text = m => m.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
let fails = 0; const ok = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const last = () => messages[messages.length - 1];

console.log("== The rules");
ok(R.kindOf("Spot") === "perception" && R.kindOf("Spirit Sense") === "perception" && R.kindOf("Counter check") === "counter" && R.kindOf("Athletics") === "athletics", "Labels name their checks (a Spot or a sense is Perception)");
ok(R.actingWins(12, 12) && !R.actingWins(11, 12), "A tie goes to the acting side");
ok(R.meetsTarget(15, R.CHECK_DIFFICULTIES.hard.target) && !R.meetsTarget(24, R.CHECK_DIFFICULTIES.veryHard.target), "Static targets: Hard 15, Very Hard 25");
ok(R.underHalf(14, 30) && !R.underHalf(15, 30) && R.halfSP(31) === 15, "Rerolls: under half the die; half of 31 Skill Points is 15");
let c = R.socialCounter({ kind: "persuasion", attitude: "neutral" });
ok(c.net === 1 && !c.blocked, "Persuade: a neutral target's counter check has Advantage");
ok(!!R.socialCounter({ kind: "persuasion", attitude: "hostile" }).blocked, "…a hostile one can't be persuaded");
ok(R.socialCounter({ kind: "persuasion", attitude: "friendly", tiers: id => (id === "generic-composure" ? 2 : 0) }).net === 1, "Stubborn (Composure T2): a friendly target counters as neutral");
ok(R.socialCounter({ kind: "deception", attitude: "hostile" }).net === 1 && R.socialCounter({ kind: "deception", attitude: "hostile", actorTiers: () => 2 }).net === 0, "Deceive: a hostile counter has Advantage, Unreadable (Deception T2) takes it away");
ok(R.socialCounter({ kind: "deception", attitude: "neutral", inCombat: true, tiers: id => (id === "generic-discipline" ? 1 : 0) }).net === 1, "Focused (Discipline T1): Advantage against deception in combat");
ok(R.actingNet({ kind: "persuasion", attitude: "friendly", tiers: () => 2 }).net === 1 && R.actingNet({ kind: "persuasion", attitude: "neutral", tiers: () => 2 }).net === 0, "Charismatic (Persuasion T2): Advantage against friendly targets only");
ok(R.alacrityStacks(1) === 1 && R.alacrityStacks(5) === 2 && R.initiativeTie(true, false) === "a" && R.initiativeTie(true, true) === "reroll", "Alacrity (two stacks with Lightning Reflexes); Poised wins initiative ties");

console.log("== Rolling");
const scout = mkActor("Scout");
dialog = () => ({ net: 0, vs: "hard" });
seq = [16];
await actions.rollCheck(scout, "Perception");
ok(/Perception \(d30\)/.test(text(last())) && /Success against Hard \(15\)/.test(text(last())), "A check rolls the plain attack die (d30 for 30 Skill Points) and meets the GM's static target");
seq = [14];
await actions.rollCheck(scout, "Perception");
ok(/Failure against Hard \(15\)/.test(text(last())), "…or fails it");

const focused = mkActor("Focused", { "generic-perception": 3 });
seq = [5, 20];
await actions.rollCheck(focused, "Perception");
ok(/Focus: rerolled 5 → 20/.test(text(last())) && /Result: 20/.test(text(last())) && /15 Energy/.test(text(last())), "Focus (Perception T3): a result under half the die is rerolled for half the Skill Points in Energy (15; free outside combat, where Energy stays full)");
seq = [5, 3];
await actions.rollCheck(focused, "Perception");
ok(/Result: 3/.test(text(last())) && !/rerolled 3/.test(text(last())), "…once: the new result stands even when it's worse");
const hyper = mkActor("Hyper", { "generic-perception": 5 });
seq = [5, 3, 18];
await actions.rollCheck(hyper, "Perception");
ok(/rerolled 3 → 18/.test(text(last())), "Hyperfocus (T5): again while it's still under half");

const climber = mkActor("Climber", { "generic-athletics": 3 });
dialog = () => ({ net: 0, vs: "moderate" });
seq = [4, 12];
await actions.rollCheck(climber, "Athletics");
ok(/Push Through: rerolled 4 → 12/.test(text(last())) && /Success against Moderate/.test(text(last())), "Push Through (Athletics T3): a failed Athletics check is rerolled");

const mute = mkActor("Mute", {}, { senses: { sight: "secondary", hearing: "secondary", smell: "secondary" } });
dialog = () => ({ net: 0, vs: "" });
seq = [10];
await actions.rollCheck(mute, "Perception");
ok(/Disadvantage/.test(text(last())) && /no Primary or Heightened sense/.test(text(last())), "No Primary or Heightened sense: Disadvantage");

console.log("== Contests");
const talker = mkActor("Talker"), guard = mkActor("Guard");
game.user.targets = new Set([{ actor: guard }]);
dialog = () => ({ net: 0, vs: "", attitude: "neutral" });
seq = [12];
await actions.rollCheck(talker, "Persuasion");
const card = last();
const f = card.getFlag("flowstate", "check");
ok(f.target === guard.uuid && f.against === "counter" && f.attitude === "neutral" && /fs-counter-check/.test(card.content), "Persuading one targeted creature is a contest: the card asks for its counter check");
seq = [12];
await checks.counterCheck(card);
ok(/Talker wins/.test(text(last())) && /a tie goes to the acting side/.test(text(last())) && /neutral: Advantage/.test(text(last())), "The counter check (with the neutral Advantage) ties, and the acting side wins");
ok(last().getFlag("flowstate", "checkOf") === card.id, "…and answers the card");
game.user.targets = new Set([{ actor: guard }]);
dialog = () => ({ net: 0, vs: "", attitude: "hostile" });
seq = [20];
await actions.rollCheck(talker, "Persuasion");
await checks.counterCheck(last());
ok(/can't be persuaded/.test(text(last())), "A hostile target can't be persuaded: no counter check is rolled");
game.user.targets = new Set([{ actor: guard }]);
dialog = () => ({ net: 0, vs: "" });
seq = [9];
await actions.rollCheck(scout, "Spot");
ok(last().getFlag("flowstate", "check").against === "stealth", "A Spot against a targeted creature asks for its Stealth check");
game.user.targets = new Set();

console.log(fails ? `${fails} failed` : "all passed");
if (fails) process.exitCode = 1;
