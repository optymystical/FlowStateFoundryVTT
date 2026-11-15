// Ancestry abilities in play (ancestry.mjs) and Environments (environment-rules.mjs): passives, the Action List, attack and dodge Advantage,
// Unlucky / Indomitable after the dodge, incoming damage stacks, Lingering Spirit, Searing Zeal, and the biome/Hazard rules.
import { installFoundry } from "./support/foundry.mjs";
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 });
const { combat } = installFoundry({ roll: () => (seq.length ? seq.shift() : 10), dialog: c => dialog(c), messages, uuids });
globalThis.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

const { FlowStateActorData } = await import("../../module/data.mjs");
const actions = await import("../../module/actions.mjs");
const anc = await import("../../module/ancestry.mjs");
const E = await import("../../module/environment-rules.mjs");
const { ancestryNet } = await import("../../module/ancestry-net.mjs");
actions.registerAncestry(anc.hooks);
const set = (o, k, v) => foundry.utils.setProperty(o, k, v);
function mkActor(name, trees = {}, extra = {}, abc = {}) {
  const a = { name, uuid: "Actor." + name, isOwner: true, items: [], statuses: new Set(), flags: {}, effects: [] };
  a.items.get = id => a.items.find(i => i.id === id);
  a.update = async u => { for (const [k, v] of Object.entries(u)) set(a, k, v); a.system.prepareDerivedData(); };
  a.setFlag = async (s, k, v) => set(a.flags, `${s}.${k}`, v);
  a.getFlag = (s, k) => foundry.utils.getProperty(a.flags, `${s}.${k}`);
  a.unsetFlag = async (s, k) => set(a.flags, `${s}.${k}`, undefined);
  a.toggleStatusEffect = async (id, { active }) => { active ? a.statuses.add(id) : a.statuses.delete(id); };
  a.getActiveTokens = () => [];
  a.system = Object.assign(Object.create(FlowStateActorData.prototype), { stats: { str: 30, dex: 30, con: 30, pon: 10, snap: 10, will: 10, reach: 10, grasp: 10, build: 10 }, skillPoints: 30, unspentStats: 0, statCarry: 0,
    trees, abc, freeTrees: {}, size: 3, hp: { value: 300, lost: 0 }, energy: { value: 150, bonus: 0 }, ap: { value: 6 }, rp: { value: 6 }, conditions: { ignite: 0, stain: 0, slow: 0, haste: 0 }, lift: 0, daysWithoutRest: 0,
    senses: { sight: "primary", hearing: "primary", smell: "secondary" }, ...extra }, { parent: a });
  a.system.prepareDerivedData(); uuids.set(a.uuid, a); game.actors.push(a);
  return a;
}
globalThis.fromUuidSync = u => uuids.get(u);
let fails = 0; const ok = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const labels = a => anc.actionRows(a).map(r => r.label);

console.log("== Passives on the sheet");
const goblin = mkActor("Goblin", { "ancestry-wusonian": 1, "ancestry-bestial": 2, "ancestry-smallfolk": 3, "ancestry-goblin-tree": 1 }, { size: 2 }, { ancestry: "goblin" });
ok(goblin.system.senses.smell === "primary", "Keen Instincts (Bestial T1): Smell is Primary");
ok(goblin.system.derived.move === 40, `Quick Feet (Smallfolk T2): a Size 2 creature's speed is 40 ft (${goblin.system.derived.move})`);
const kid = mkActor("Kid", {}, { size: 2 });
ok(kid.system.derived.move === 25, "...without it, 25 ft");

console.log("== Action List");
combat.started = true; combat.id = "C"; combat.round = 1;
const fighter = mkActor("Fighter", { "ancestry-wusonian": 3, "ancestry-bestial": 2, "ancestry-dirtborn": 4 }, {}, { ancestry: "fire-walker" });
combat.combatants = [{ actor: fighter }, { actor: goblin }]; combat.combatant = { actor: fighter };
ok(["Shed the Heat", "Topple", "Duelist", "Acclimated"].every(l => labels(fighter).includes(l)), "Shed the Heat, Topple, Duelist, Acclimated rows");
const drake = mkActor("Drake", { "ancestry-wusonian": 1, "ancestry-commonkin": 2, "ancestry-draken-elements": 2 }, {}, { ancestry: "drakenblood", element: "cold" });
ok(labels(drake).includes("Breath: Light") && labels(drake).includes("Elemental Diversity"), "Drakenblood: breath rows, and Elemental Diversity until a second element is chosen");
const human = mkActor("Human", { "ancestry-wusonian": 1, "ancestry-commonkin": 3 }, {}, { ancestry: "human" });
ok(labels(human).includes("Pass It On"), "An active ability without its own row gets a pay-and-post row (Pass It On)");

console.log("== Attack and dodge Advantage");
const giant = mkActor("Giant", {}, { size: 5 });
const hob = mkActor("Hob", { "ancestry-smallfolk": 5 }, { size: 2 }, { ancestry: "goblin" });
ok((await anc.hooks.attackNet(giant, hob, {})).net === -1, "Small Target (Smallfolk T5): Disadvantage from a creature 2+ Sizes larger");
ok((await anc.hooks.attackNet(goblin, hob, {})).net === 0, "...not from a same-size one");
const elf = mkActor("Elf", { "ancestry-elf-tree": 1 }, {}, { ancestry: "elf" });
combat.combatants.push({ actor: elf });
ok((await anc.hooks.dodgeNet(elf, giant, {})).net === 1 && (await anc.hooks.dodgeNet(elf, giant, {})).net === 0, "Mindful of Fragility: Advantage on the first dodge of the combat only");
const under = mkActor("Under", { "ancestry-dirtborn": 2 }, {}, { ancestry: "fire-walker" });
const a1 = mkActor("A1"), a2 = mkActor("A2"), a3 = mkActor("A3");
combat.combatants.push({ actor: under });
const n1 = (await anc.hooks.dodgeNet(under, a1, {})).net, n2 = (await anc.hooks.dodgeNet(under, a2, {})).net, n3 = (await anc.hooks.dodgeNet(under, a3, {})).net;
ok(n1 === 0 && n2 === 0 && n3 === 1 && (await anc.hooks.dodgeNet(under, a1, {})).net === 1, "Underdog: from the third attacker in a round, Advantage on dodges (until your next turn)");

console.log("== After the dodge: Unlucky and Indomitable");
dialog = () => ({});                                             // every popup answered yes
const gob = mkActor("Gob", { "ancestry-goblin-tree": 1 }, {}, { ancestry: "goblin" });
seq = [3];
let r = await anc.hooks.afterDodge({ attacker: giant, target: gob, entry: { total: 15, die: 30, net: 0 }, dodge: { total: 8 }, die: 15, net: 0, result: { hit: true } });
ok(!r.result.hit && r.attackTotal === 3 && anc.used(gob, "unlucky", "rest"), "Unlucky: the hit is re-rolled (3), the lower stands, and it misses; once per rest");
seq = [2];
r = await anc.hooks.afterDodge({ attacker: giant, target: gob, entry: { total: 15, die: 30, net: 0 }, dodge: { total: 8 }, die: 15, net: 0, result: { hit: true } });
ok(r.result.hit && r.attackTotal === 15, "...not twice before a rest");
const hum = mkActor("Hum", { "ancestry-human-tree": 5 }, {}, { ancestry: "human" });
seq = [18];
r = await anc.hooks.afterDodge({ attacker: giant, target: hum, entry: { total: 15, die: 30, net: 0 }, dodge: { total: 8 }, die: 15, net: 0, result: { hit: true } });
ok(!r.result.hit && r.notes.some(n => /Indomitable/.test(n)), "Indomitable (Human T5): a failed dodge is re-rolled (18 vs 15: a miss)");
seq = [20];
r = await anc.hooks.afterDodge({ attacker: hum, target: giant, entry: { total: 5, die: 30, net: 0 }, dodge: { total: 12 }, die: 15, net: 0, result: { hit: false } });
ok(!r.result.hit, "...but once per round (its own miss isn't re-rolled now)");

console.log("== Damage");
ok((await anc.hooks.incoming(drake, 20, "cold", {})).amount < 20 && (await anc.hooks.incoming(drake, 20, "heat", {})).amount === 20, "Elemental Ward: the gland's element is Weakened");
const fl = mkActor("Fl", { "ancestry-firelander": 5 }, {}, { ancestry: "fire-walker" });
ok((await anc.hooks.incoming(fl, 20, "heat", {})).amount < 20, "Flamekin: Heat is Weakened");
const dusk = mkActor("Dusk", { "ancestry-dusken-spirit": 4 }, {}, { ancestry: "dusken" });
const beast = mkActor("Beast", {}, { supernatural: true });
ok((await anc.hooks.incoming(dusk, 20, "supernatural", {})).amount < 20 && (await anc.hooks.incoming(dusk, 20, "physical", { attacker: beast.uuid, natural: true })).amount < 20
  && (await anc.hooks.incoming(dusk, 20, "physical", { attacker: beast.uuid, natural: false })).amount === 20, "Curse-Hardened: Supernatural damage, and a Supernatural creature's natural weapons");
ok(anc.hooks.lethal(dusk, -5) === 1, "Lingering Spirit: damage that would drop you to 0 leaves you at 1");
await new Promise(res => setTimeout(res, 5));
ok(anc.hooks.lethal(dusk, -5) === -5, "...once per rest");
const zeal = await anc.hooks.beforeDamage(fl, giant, { type: "physical", stacks: 0 });
ok(zeal.type === "heat" && anc.hooks.damageStacks({ attacker: fl, target: giant, o: zeal }).stacks === 1 && anc.hooks.damageStacks({ attacker: fl, target: giant, o: zeal }).parts[0] === "+1 Searing Zeal",
  "Searing Zeal: the hit becomes Heat with a Strengthened stack (named on the damage card)");

console.log("== Checks");
const half = mkActor("Half", { "ancestry-halfling-tree": 3 }, { size: 2 }, { ancestry: "halfling" });
ok(ancestryNet.stealth(half) === 1 && ancestryNet.fear(mkActor("Leg", { "ancestry-draken-legacy": 2 })) === 1, "Unassuming (stealth), Unbowed (resisting Fear)");

console.log("== Environments");
const desert = { type: "extreme", biome: "Desert", hazard: true };
let e = E.envEffects(desert, { maxHp: 300 });
ok(e.extreme && e.athleticsNet === -1 && e.restHalf && e.hazardLoss === 30, "Extreme, outside: Athletics Disadvantage, half rest, Hazard 1/10 Max HP an hour");
e = E.envEffects(desert, { maxHp: 300, sheltered: true });
ok(!e.extreme && e.hazardLoss === 0 && e.athleticsNet === 0, "...Shelter removes it all");
e = E.envEffects(desert, { maxHp: 300, acclimated: ["desert"], wusonian: 2 });
ok(!e.extreme && e.athleticsNet === 1 && e.restFull && e.hazardLoss === 15, "Acclimated (Desert): no Extreme penalties, Athletics Advantage; Hardy Constitution: full rest, Hazard halved");
ok(E.envEffects(desert, { maxHp: 300, acclimated: ["desert"], wusonian: 5 }).hazardLoss === 0, "Endless Adaptation: no Hazard loss in a biome you're acclimated to");
const wus = mkActor("Wus", { "ancestry-wusonian": 4 });
await wus.setFlag("flowstate", "biomes", ["Desert", "Tundra", "Sea"]);
ok(E.acclimatedTo(wus).join() === "desert,tundra", "Adaptive Lineage (T4): two biomes");

if (fails) { console.log(`${fails} failed`); process.exit(1); }
console.log("ancestry tests passed");
