// The Bestiary (Flow State - Bestiary): the creature Ancestries and their Backgrounds (bestiary-rules.mjs, build_bestiary.py), the NPC build
// (npc-creation.mjs), Pole-Bound for any Wonderborn (esoteric.mjs) and the abilities in play (bestiary.mjs, through ancestry.mjs's hooks).
import { installFoundry } from "./support/foundry.mjs";
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 });
const { combat } = installFoundry({ roll: () => (seq.length ? seq.shift() : 10), dialog: c => dialog(c), messages, uuids });
globalThis.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

const { FlowStateActorData } = await import("../../module/data.mjs");
const actions = await import("../../module/actions.mjs");
const anc = await import("../../module/ancestry.mjs");
const B = await import("../../module/bestiary-rules.mjs");
const bestiary = await import("../../module/bestiary.mjs");
const R = await import("../../module/abc-rules.mjs");
const npc = await import("../../module/npc-creation.mjs");
const E = await import("../../module/esoteric.mjs");
actions.registerAncestry(anc.hooks);
const set = (o, k, v) => foundry.utils.setProperty(o, k, v);
function mkActor(name, trees = {}, extra = {}, abc = {}, flags = {}) {
  const a = { name, uuid: "Actor." + name, isOwner: true, items: [], statuses: new Set(), flags: { flowstate: { ...flags } }, effects: [] };
  a.items.get = id => a.items.find(i => i.id === id);
  a.update = async u => { for (const [k, v] of Object.entries(u)) set(a, k, v); a.system.prepareDerivedData(); };
  a.setFlag = async (s, k, v) => set(a.flags, `${s}.${k}`, v);
  a.getFlag = (s, k) => foundry.utils.getProperty(a.flags, `${s}.${k}`);
  a.unsetFlag = async (s, k) => set(a.flags, `${s}.${k}`, undefined);
  a.toggleStatusEffect = async (id, { active }) => { active ? a.statuses.add(id) : a.statuses.delete(id); };
  a.getActiveTokens = () => [];
  a.system = Object.assign(Object.create(FlowStateActorData.prototype), { stats: { str: 10, dex: 10, con: 10, pon: 30, snap: 30, will: 10, reach: 0, grasp: 0, build: 0 }, skillPoints: 30, unspentStats: 0, statCarry: 0,
    trees, abc, freeTrees: {}, size: 3, hp: { value: 300, lost: 0 }, energy: { value: 150, bonus: 0 }, ap: { value: 6 }, rp: { value: 6 }, conditions: { ignite: 0, stain: 0, slow: 0, haste: 0 }, lift: 0, daysWithoutRest: 0,
    senses: { sight: "primary", hearing: "primary", smell: "secondary" }, ...extra }, { parent: a });
  a.system.prepareDerivedData(); uuids.set(a.uuid, a); game.actors.push(a);
  return a;
}
globalThis.fromUuidSync = u => uuids.get(u);
let fails = 0; const ok = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const LIFE = "mental-life-dream", DEATH = "mental-death-nightmare", DARK = "mental-dark-nightmare";

console.log("== The Bestiary's data (Flow State - Bestiary)");
ok(B.bestiaryAncestries().map(a => a.id).join() === "wonderborn-life,wonderborn-dark,wonderborn-growth", "Three creature Ancestries: Life, Dark, Growth (Wonderborn)");
ok(R.ANCESTRIES["wonderborn-life"].trees.join() === "ancestry-wonderborn,ancestry-dreamborn,ancestry-wonderborn-life" && R.ANCESTRIES["wonderborn-dark"].trees[1] === "ancestry-nightmareborn",
  "Each has its core (Wonderborn), its lineage (Dreamborn / Nightmareborn) and its own tree");
ok(R.ANCESTRIES["wonderborn-growth"].sizes.omen === 4 && R.ANCESTRIES["wonderborn-life"].sizes.herald === 5 && R.ANCESTRIES["wonderborn-dark"].form === "riposte", "Sizes per Background and the Form, from the profile");
ok(!R.playerAncestries().some(a => a.bestiary) && !R.backgroundsFor("human").some(b => b.bestiary) && R.backgroundsFor("wonderborn-life").map(b => b.id).join() === "omen,herald",
  "Players never see them; a creature takes only the Omen or Herald Background");
ok(R.freeTreesFor({ ancestry: "wonderborn-life", background: "omen" }).errors.some(e => /Bestiary/.test(e)), "The player wizard refuses a Bestiary Ancestry");

console.log("== A Bestiary build");
const omen = B.bestiaryBuild("wonderborn-life", "omen"), herald = B.bestiaryBuild("wonderborn-life", "herald");
ok(omen.size === 3 && omen.free["ancestry-wonderborn"] === 3 && omen.free["ancestry-wonderborn-life"] === 3 && omen.free["mental-theory"] === 5 && omen.free[LIFE] === 5 && omen.form === "sanctum",
  "An Omen of Life: Size 3, its trees at Tier 3, its Domain (Mental Theory and Life at 5), the Sanctum Form");
ok(herald.size === 5 && herald.free["ancestry-dreamborn"] === 5 && B.bestiaryBuild("wonderborn-growth", "omen").size === 4, "A Herald: Size 5 and Tier 5; a Burgeon (Growth Omen) is Size 4");
ok(B.wonderFor("wonderborn-dark") === DARK && B.ancestryForWonder(LIFE)?.id === "wonderborn-life" && B.ancestryForWonder("mental-order-dream") === null && B.pairOf(LIFE) === DEATH,
  "Its Wonder (by name), the Bestiary Ancestry of a Wonder, and the paired Wonder");
ok(omen.sapience === 2 && omen.ratio === 5, "Omens and Heralds are band 2 (5:1)");

console.log("== Natural attacks (read from the trees' words)");
const gore = B.naturalAttacks({ "ancestry-wonderborn-life": 1 })[0], lash = B.naturalAttacks({ "ancestry-wonderborn-growth": 1 })[0];
ok(gore?.name === "Budding Gore" && gore.ap === 2 && gore.dice === 1 && gore.die === 10 && gore.range === null && gore.scales, "Budding Gore: 2 AP, 1d10, melee, scales with Wonder Power");
ok(lash?.name === "Root Lash" && lash.range === 10 && lash.die === 8 && B.naturalFormula(gore, 3) === "3d10", "Root Lash reaches 10 ft (1d8); at Wonder Power 3 the gore is 3d10");

console.log("== Poles served");
const lifeOmen = mkActor("Bloomrot", omen.free, {}, { ancestry: "wonderborn-life", background: "omen" });
const deathPatron = mkActor("Necro", { "mental-theory": 5 }, {}, {}, { patron: DEATH });
const cultist = mkActor("Cultist", {}, {}, {}, { servesPole: LIFE });
const farmer = mkActor("Farmer");
ok(B.serves(lifeOmen, LIFE) && B.serves(cultist, LIFE) && !B.serves(farmer, LIFE) && B.opposes(deathPatron, LIFE), "Its own Wonder, a GM mark and a Patron count; a Patron of Death opposes Life");
ok(E.poleStacks(lifeOmen, {}, [deathPatron]) === 1 && E.poleStacks(deathPatron, {}, [lifeOmen]) === 1 && E.poleStacks(lifeOmen, {}, [farmer]) === 0,
  "Pole-Bound: attacks between a Wonderborn and its opposite pole are Strengthened both ways; anyone else no change");
ok(B.presenceNeed(lifeOmen) === 90, "Allure / Dread: its Skill Points × its Size (30 × 3) to resist");

console.log("== The NPC wizard's build");
const choice = { name: "Bloomrot", ancestry: "wonderborn-life", bestiaryBg: "omen", size: 3, statPoints: 50, ratio: 5, stats: { pon: 30, will: 20 }, trees: {}, items: [], disposition: -1 };
for (const k of ["str", "dex", "con", "snap", "reach", "grasp", "build"]) choice.stats[k] = 0;
ok(!npc.validate(choice).length, `A Bestiary NPC with 10 Skill Points validates: its trees are free (${npc.validate(choice).join("; ")})`);
const data = npc.buildNpcData(choice);
const icon = data.items.find(i => i.type === "icon");
ok(data.system.trees["ancestry-wonderborn-life"] === 3 && data.system.freeTrees[LIFE] === 5 && data.system.abc.background === "omen" && data.flags.flowstate.patron === LIFE,
  "It's made with its free trees, its Background and its Patron (its own Wonder)");
ok(icon?.system.natural && icon.system.attuned && icon.system.form === "sanctum" && icon.system.tenet, "...and its own natural Icon (Sanctum, with Life's Tenet)");
ok(npc.validate({ ...choice, items: [npc.newNpcSlot("icon")] }).some(e => /its own Icon/.test(e)), "A ready Icon on a Wonderborn is refused");

console.log("== In play");
combat.started = true; combat.id = "C"; combat.round = 1;
const rows = anc.actionRows(lifeOmen).map(r => r.label);
ok(rows.includes("Budding Gore") && rows.includes("Recognition") && rows.includes("Allure: newcomers resist") && rows.filter(l => l === "Budding Gore").length === 1,
  "The Action List: Budding Gore (once), Recognition, Allure");
ok(anc.actionRows(lifeOmen).find(r => r.label === "Budding Gore").detail.includes("3d10"), "...the gore's dice at its Wonder Power (Ponderance 30 → 3d10)");
const hound = mkActor("Gloamhound", { "ancestry-wonderborn": 3, "ancestry-nightmareborn": 3, "ancestry-wonderborn-dark": 3 }, {}, { ancestry: "wonderborn-dark", background: "omen" });
const scared = mkActor("Scared"); scared.statuses.add("fear");
ok((await anc.hooks.attackNet(hound, scared, {})).net === 1 && (await anc.hooks.attackNet(hound, farmer, {})).net === 0, "Prey on Fear (Nightmareborn T3): Advantage against an afraid creature");
const charmed = mkActor("Charmed", {}, {}, {}, { allured: { by: lifeOmen.uuid, armed: "x", used: null } });
combat.combatant = { actor: charmed }; combat.turn = 1;
ok((await anc.hooks.attackNet(charmed, lifeOmen, {})).net === -1 && (await anc.hooks.attackNet(charmed, lifeOmen, {})).net === 0, "Allure's failure: the first attack against it each turn has Disadvantage");
const burgeon = mkActor("Burgeon", { "ancestry-wonderborn": 4, "ancestry-dreamborn": 4, "ancestry-wonderborn-growth": 4 }, { size: 4 }, { ancestry: "wonderborn-growth" });
ok(actions.braced(burgeon, 100) === 50, "Rooted (Growth T4): Force on it is halved while it hasn't moved this turn");
await burgeon.setFlag("flowstate", "moveLedger", { key: actions.turnKey(), ft: 10, moves: [] });
ok(actions.braced(burgeon, 100) === 100, "...and isn't once it has");
combat.combatants = [{ actor: burgeon }, { actor: charmed }];
ok(bestiary.holdingOn(burgeon) === true, "Unwaking (Dreamborn T4): it holds on in a fight");
await burgeon.setFlag("flowstate", "unwaking", { combat: "C", armed: "x", done: true });
ok(bestiary.holdingOn(burgeon) === false, "...until its next turn has passed");
const o1 = await bestiary.attackStart(lifeOmen, { mental: { mode: `${LIFE}:bloom`, wonder: LIFE }, notes: [] }, [cultist]);
const o2 = await bestiary.attackStart(lifeOmen, { mental: { mode: `${LIFE}:bloom`, wonder: LIFE }, notes: [] }, [cultist]);
ok(o1.mental.autoHit === true && !o2.mental.autoHit, "Bounty (Dreamborn T3): a Manifest on a creature serving its pole hits, once per round");
ok(bestiary.alignmentFree(lifeOmen) && !bestiary.alignmentFree(farmer), "Lucid Depth (Dreamborn T2): its Alignment costs no speed");

console.log("== Regrowth (Life T2)");
const t0 = Date.now() - 1000;
const thicket = mkActor("Thicket", { "ancestry-wonderborn": 2, "ancestry-dreamborn": 2, "ancestry-wonderborn-life": 2 }, { hp: { value: 200, lost: 0 } }, { ancestry: "wonderborn-life" },
  { turnStartedAt: t0, lossLog: [{ at: t0 + 10, n: 20, type: "physical" }, { at: t0 + 20, n: 10, type: "heat" }, { at: t0 + 30, n: 5, type: "physical", crit: true }, { at: t0 - 500, n: 40, type: "physical" }] });
const before = thicket.system.hp.value;
await bestiary.turnStart(combat, thicket);
ok(thicket.system.hp.value === before + 20, `It regrows what it lost since its last turn's start, but not heat damage or crits (+${thicket.system.hp.value - before})`);
ok(thicket.getFlag("flowstate", "bestTurns")?.n === 1, "Its turns in the fight are counted (Sporing / Ripen go off on the 4th)");

if (fails) { console.log(`${fails} failed`); process.exit(1); }
console.log("bestiary tests passed");
