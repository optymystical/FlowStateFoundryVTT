// Generic Groups in play: the Action List's Generic rows, the Stealth Value from Stealthing, and the Endurance and Athletics passives.
import { installFoundry } from "./support/foundry.mjs";
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 });
const { combat } = installFoundry({ roll: () => (seq.length ? seq.shift() : 10), dialog: c => dialog(c), messages, uuids });

const { FlowStateActorData } = await import("../../module/data.mjs");
const actions = await import("../../module/actions.mjs");
const generic = await import("../../module/generic.mjs");
await import("../../module/checks.mjs");
const set = (o, k, v) => foundry.utils.setProperty(o, k, v);
function mkActor(name, trees = {}, extra = {}) {
  const a = { name, uuid: "Actor." + name, isOwner: true, items: [], statuses: new Set(), flags: {}, effects: [] };
  a.items.get = id => a.items.find(i => i.id === id);
  a.update = async u => { for (const [k, v] of Object.entries(u)) set(a, k, v); a.system.prepareDerivedData(); };
  a.setFlag = async (s, k, v) => set(a.flags, `${s}.${k}`, v);
  a.getFlag = (s, k) => foundry.utils.getProperty(a.flags, `${s}.${k}`);
  a.unsetFlag = async (s, k) => set(a.flags, `${s}.${k}`, undefined);
  a.toggleStatusEffect = async (id, { active }) => { active ? a.statuses.add(id) : a.statuses.delete(id); };
  a.getActiveTokens = () => [];
  a.system = Object.assign(Object.create(FlowStateActorData.prototype), { stats: { str: 30, dex: 30, con: 30, pon: 10, snap: 10, will: 10, reach: 10, grasp: 10, build: 10 }, skillPoints: 30, unspentStats: 0, statCarry: 0,
    trees, size: 3, hp: { value: 432, lost: 0 }, energy: { value: 150 }, ap: { value: 6 }, rp: { value: 6 }, conditions: { ignite: 0, stain: 0, slow: 0, haste: 0 }, lift: 0, daysWithoutRest: 0,
    senses: { sight: "primary", hearing: "primary", smell: "secondary" }, ...extra }, { parent: a });
  a.system.prepareDerivedData(); uuids.set(a.uuid, a); game.actors.push(a);
  return a;
}
let fails = 0; const ok = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const labels = a => generic.actionRows(a).map(r => r.label);

console.log("== Action List rows");
const plain = mkActor("Plain");
ok(labels(plain).includes("Start Stealthing") && !labels(plain).includes("Glimpse"), "Everyone can start Stealthing (Stealth Tier 0); Glimpse needs Perception T1");
const sneak = mkActor("Sneak", { "generic-perception": 1, "generic-sleight": 1, "generic-infiltration": 1, "generic-concealment": 2, "generic-barter": 1 });
ok(["Glimpse", "Lift", "Pick", "Hunker Down", "Stash"].every(l => labels(sneak).includes(l)), "Glimpse, Lift and Pick are automated rows; Hunker Down and Stash (with costs in their text) get Use rows");
ok(!labels(sneak).includes("Haggle"), "…a passive or plain check (Haggle) doesn't get a row");
const row = generic.actionRows(sneak).find(r => r.label === "Hunker Down");
ok(row.cost === "1 AP" && row.op === "use:generic-concealment:Hunker Down", "A Use row shows the AP its text asks for");

console.log("== Stealthing and the Stealth Value");
combat.started = false;
const guard = mkActor("Guard");
await generic.run(plain, "stealthOn");
ok(plain.statuses.has("stealth"), "Start Stealthing sets the Stealthing status");
ok(actions.stealthValue(plain, [guard]) === "full", "Outside combat, against a creature that hasn't spotted you: Full stealth (it isn't aware of combat)");
combat.started = true; combat.combatants = [{ actor: plain }, { actor: guard }]; combat.combatant = { actor: plain };
ok(actions.stealthValue(plain, [guard]) === "half", "In combat (everyone is aware): Half");
ok(actions.withStealthStatus(plain, { stealth: "none", notes: [] }, [guard]).stealth === "half", "…which the attack takes");
await plain.setFlag("flowstate", "spottedBy", [guard.uuid]);
ok(actions.stealthValue(plain, [guard]) === null && actions.withStealthStatus(plain, { stealth: "none", notes: [] }, [guard]).stealth === "none", "Once it has spotted you, no Stealth Value against it");
await generic.run(plain, "stealthOff");
ok(!plain.statuses.has("stealth") && (plain.getFlag("flowstate", "spottedBy") ?? []).length === 0, "Stop Stealthing: the status and who spotted you are cleared");
const ambusher = mkActor("Ambusher", { "generic-stealth": 3, "generic-ambush": 5 });
combat.combatants.push({ actor: ambusher });
await ambusher.toggleStatusEffect("stealth", { active: true });
ok(actions.stealthValue(ambusher, [guard]) === "full", "Blindside (Ambush T5): in combat, an unspotted target it hasn't attacked counts as unaware (Full)");
await ambusher.setFlag("flowstate", "attackedThisCombat", { combat: combat.id, uuids: [guard.uuid] });
ok(actions.stealthValue(ambusher, [guard]) === "half", "…not once it has been attacked");
combat.combatant = { actor: guard };
await ambusher.toggleStatusEffect("stealth", { active: false });
await generic.run(ambusher, "stealthOn");
ok(ambusher.statuses.has("stealth") && ambusher.system.rp.value === 5, "Fade (Stealth T1) outside your turn costs RP (1 with Practiced, T3)");
await generic.run(plain, "stealthOn");
ok(!plain.statuses.has("stealth"), "…without Fade it can't be done outside your turn");

console.log("== Endurance and Athletics");
combat.combatant = { actor: plain };
const tough = mkActor("Tough", { "generic-fortitude": 2, "generic-stamina": 4, "generic-mobility": 1, "generic-infiltration": 4 }, { conditions: { ignite: 30, stain: 0, slow: 0, haste: 0 } });
combat.combatants.push({ actor: tough }); combat.combatant = { actor: tough };
await actions.clearCondition(tough, "ignite");
ok(tough.system.ap.value === 5 && tough.system.conditions.ignite === 0, "Shake It Off (Fortitude T1): putting out Ignite costs 1 AP instead of 2");
const regain = await actions.turnStartEnergy(tough);
ok(regain === 3 * tough.system.derived.energyRecover, "Inexhaustible (Stamina T4): 3 AP of recovery at the start of the turn");
await tough.toggleStatusEffect("stealth", { active: true }); tough.system.prepareDerivedData();
ok(tough.system.movement.ap === 1, "Ghost Step (Infiltration T4): Stealthing doesn't raise the move cost");
await tough.toggleStatusEffect("stealth", { active: false }); await tough.setFlag("flowstate", "terrainLevel", 1); tough.system.prepareDerivedData();
ok(tough.system.movement.ap === 1, "Sure Footing (Mobility T1): rough terrain costs nothing extra");
await tough.setFlag("flowstate", "terrainLevel", 2); tough.system.prepareDerivedData();
ok(tough.system.movement.ap === 3, "…difficult terrain still does");
await tough.setFlag("flowstate", "terrainLevel", 0);
await tough.update({ "system.energy.value": 100 });
await actions.recoverEnergy(tough);
ok(tough.system.energy.value === 100 + Math.min(50, 2 * tough.system.derived.energyRecover), "Catch Your Breath (Stamina T1): the first Recover Energy each turn recovers twice as much");

console.log("== Load");
const mule = mkActor("Mule");
mule.system.load = { state: "encumbered", value: 8, limit: 12, label: "Encumbered" };
const jumpRow = generic.actionRows(mule).find(r => r.label === "Jump");
ok(jumpRow?.disabled && /can't jump/.test(actions.loadBlocks(mule, "jump")), "Encumbered: the Jump row is disabled (can't jump)");
ok(actions.loadBlocks(mule, "ability") === null, "…but Dash and Leap's movement still works while only Encumbered");
mule.system.load = { state: "overburdened", value: 14, limit: 18, label: "Overburdened" };
ok(!!actions.loadBlocks(mule, "ability"), "Overburdened (Pack Mule): no abilities that move you");
mule.system.load = { state: "immobile", value: 20, limit: 12, label: "Can't move" };
ok(/too much to move/.test(actions.loadBlocks(mule, "ability")), "Too much Load: can't move at all");

console.log("== The surprise round");
const S = await import("../../module/surprise.mjs");
const turns = ["a", "b", "c", "d"].map(id => ({ id, isDefeated: false }));
const sc = { round: 1, turns, getFlag: () => ({ round: 1, openers: ["b", "d"] }) };
ok(S.firstOpenerIndex(sc, { openers: ["b", "d"] }) === 1 && S.nextOpenerIndex(sc, 1) === 3 && S.nextOpenerIndex(sc, 3) === null, "Only the openers take turns in the surprise round; after the last one the round ends");
ok(S.displayRound(sc) === 0 && S.displayRound({ ...sc, round: 3 }) === 2, "The tracker shows it as round 0, and the rounds after it one lower");
ok(S.nextOpenerIndex({ ...sc, round: 2 }, 0) === undefined, "After the surprise round, turns go as usual");

console.log(fails ? `${fails} failed` : "all passed");
if (fails) process.exitCode = 1;
