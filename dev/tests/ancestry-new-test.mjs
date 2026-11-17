// The Ancestries added with the ABCs reorganization (Namuh, Sworan, Wildibit, Myrthel, Dawn Elf, Noctua, Minotaur, Smoblin; the Lakeborn, Strigid,
// Leporid and Wasteling cores): passives on the sheet, the exchange hooks, the Living Metal Arm's weapon, casting, checks and the Action List.
import { installFoundry } from "./support/foundry.mjs";
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 });
const { combat } = installFoundry({ roll: () => (seq.length ? seq.shift() : 10), dialog: c => dialog(c), messages, uuids });
globalThis.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

const { FlowStateActorData } = await import("../../module/data.mjs");
const actions = await import("../../module/actions.mjs");
const anc = await import("../../module/ancestry.mjs");
const { ancestryNet, situational } = await import("../../module/ancestry-net.mjs");
const { weaponProfile, armorProfile } = await import("../../module/martial.mjs");
const spells = await import("../../module/spells.mjs");
const S = await import("../../module/skills.mjs");
actions.registerAncestry(anc.hooks);
const set = (o, k, v) => foundry.utils.setProperty(o, k, v);
function mkActor(name, trees = {}, extra = {}, abc = {}) {
  const a = { name, uuid: "Actor." + name, isOwner: true, items: [], statuses: new Set(), flags: {}, effects: [] };
  a.items.get = id => a.items.find(i => i.id === id);
  a.update = async u => { for (const [k, v] of Object.entries(u)) set(a, k, v); a.system.prepareDerivedData(); };
  a.setFlag = async (s, k, v) => { set(a.flags, `${s}.${k}`, v); a.system.prepareDerivedData(); };
  a.getFlag = (s, k) => foundry.utils.getProperty(a.flags, `${s}.${k}`);
  a.unsetFlag = async (s, k) => set(a.flags, `${s}.${k}`, undefined);
  a.toggleStatusEffect = async (id, { active }) => { active ? a.statuses.add(id) : a.statuses.delete(id); };
  a.getActiveTokens = () => [];
  a.system = Object.assign(Object.create(FlowStateActorData.prototype), { stats: { str: 30, dex: 30, con: 30, pon: 10, snap: 10, will: 10, reach: 10, grasp: 10, build: 30 }, skillPoints: 30, unspentStats: 0, statCarry: 0,
    trees, abc, freeTrees: {}, size: 3, hp: { value: 300, lost: 0 }, energy: { value: 150, bonus: 0 }, ap: { value: 6 }, rp: { value: 6 }, conditions: { ignite: 0, stain: 0, slow: 0, haste: 0 }, lift: 0, daysWithoutRest: 0,
    senses: { sight: "primary", hearing: "primary", smell: "secondary" }, ...extra }, { parent: a });
  a.system.prepareDerivedData(); uuids.set(a.uuid, a); game.actors.push(a);
  return a;
}
globalThis.fromUuidSync = u => uuids.get(u);
let fails = 0; const ok = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const labels = a => anc.actionRows(a).map(r => r.label);

console.log("== Trees: the Wasteling and Tier 0 of every tree");
ok(S.hasAncestryTree({ abc: { ancestry: "dwarf" } }, "ancestry-wusonian") && !S.hasAncestryTree({ abc: { ancestry: "dwarf", wasteling: true } }, "ancestry-wusonian")
  && S.hasAncestryTree({ abc: { ancestry: "dwarf", wasteling: true } }, "ancestry-wasteling"), "A Wasteling Dwarf has the Wasteling core in place of Wusonian");

console.log("== Passives on the sheet");
const bun = mkActor("Bun", { "ancestry-smallfolk": 2 }, { size: 2 }, { ancestry: "wildibit" });
ok(bun.system.derived.move === 80, `Bounding (Leporid T0) doubles the Size 2 maximum, after Quick Feet (40 → ${bun.system.derived.move})`);
ok(bun.system.senses.hearing === "heightened" && bun.system.senses.smell === "primary", "Leporid senses: Hearing Heightened, Smell Primary");
const owl = mkActor("Owl", {}, { size: 2 }, { ancestry: "noctua" });
const walkOwl = owl.system.movement.speed;
ok(owl.system.lift > 0 && owl.system.senses.hearing === "heightened" && owl.system.senses.smell === "none", `Wings (Strigid T0): Lift ${owl.system.lift}; Hearing Heightened, no Smell`);
owl.statuses.add("flying"); owl.system.prepareDerivedData();
ok(walkOwl === Math.max(5, Math.floor(owl.system.movement.speed / 10) * 5) && walkOwl < owl.system.movement.speed, `...on the ground its speed is halved (${walkOwl} walking, ${owl.system.movement.speed} flying)`);
owl.items.push({ type: "weapon", system: { equipped: true, weaponType: "balanced", weight: "heavy", twoHanded: false, computeProfile() {} } });
owl.system.lift = 0; owl.system.prepareDerivedData();          // (a real prepare starts from the stored Lift)
ok(owl.system.wingsGrounded && owl.system.lift === 0, "Wing-Hands (Noctua T0): no flying while wielding a Heavy weapon");
const sworan = mkActor("Sworan", { "ancestry-sworan-tree": 3 }, {}, { ancestry: "sworan" });
ok(sworan.system.senses.hearing === "heightened", "Deep-Dweller (Sworan T0): Hearing Heightened");
const smob = mkActor("Smob", { "ancestry-smoblin-tree": 2 }, { size: 2 }, { ancestry: "smoblin" });
await smob.setFlag("flowstate", "alignment", { kind: "dream", level: 2 });
ok(smob.system.movement.speedLoss.alignment === 20, `Light Step (Smoblin T2): Alignment costs 10% a point (${smob.system.movement.speedLoss.alignment}%)`);
await smob.setFlag("flowstate", "overclock", { extra: 1, prev: 1, armed: "x" });
ok(smob.system.movement.speedLoss.alignment === 10, "...and Overclock's extra point costs nothing");

console.log("== Damage taken");
const myr = mkActor("Myr", { "ancestry-myrthel-tree": 4 }, {}, { ancestry: "myrthel" });
ok((await anc.hooks.incoming(myr, 40, "physical", {})).amount > 40 && (await anc.hooks.incoming(myr, 40, "heat", {})).amount === 40, "Glass Body (Myrthel T0): physical damage is Strengthened");
const dawn = mkActor("Dawn", { "ancestry-dawn-elf-tree": 3 }, {}, { ancestry: "dawn-elf" });
const dawn4 = mkActor("Dawn4", { "ancestry-dawn-elf-tree": 4 }, {}, { ancestry: "dawn-elf" });
ok((await anc.hooks.incoming(dawn, 40, "arcane", {})).amount > 40 && (await anc.hooks.incoming(dawn4, 40, "arcane", {})).amount === 40, "Fused Shadow: Arcane is Strengthened, until Uneasy Truce (T4)");
const rot = mkActor("Rot", { "ancestry-wasteling": 1 }, {}, { ancestry: "human", wasteling: true });
ok((await anc.hooks.incoming(rot, 40, "acid", {})).amount < 40, "Acid-Worn (Wasteling T1): Acid is Weakened");
const cmin = sworan.system.derived.effective.con.min;
ok((await anc.hooks.incoming(sworan, 50, "physical", {})).amount === 50 - cmin && (await anc.hooks.incoming(sworan, 50, "cold", {})).amount === 50, `Stone Skin (Sworan T3): physical damage less the Constitution Min (${cmin})`);

console.log("== The exchange");
combat.started = true; combat.id = "C"; combat.round = 1;
const wild = mkActor("Wild", { "ancestry-wildibit-tree": 3 }, { size: 2 }, { ancestry: "wildibit" });
const foe = mkActor("Foe");
combat.combatants = [{ actor: wild }, { actor: foe }, { actor: myr }]; combat.combatant = { actor: foe };
ok((await anc.hooks.dodgeNet(wild, foe, {})).net === 1 && (await anc.hooks.dodgeNet(wild, foe, {})).net === 0, "Skittish (Wildibit T2): Advantage on the first dodge each round");
await wild.setFlag("flowstate", "zigzag", true);
ok((await anc.hooks.attackNet(foe, wild, { melee: false })).net === -1 && (await anc.hooks.attackNet(foe, wild, { melee: true })).net === 0, "Zig-Zag: ranged attacks against it have Disadvantage");
myr.system.hp.value = myr.system.hp.max;
const up = anc.hooks.dodgeDieUp(myr, { type: "physical" });
ok(up?.up === 6 && !anc.hooks.dodgeDieUp(myr, { type: "heat" }), "Shy of Pain + Hardened Glass (Myrthel T4, 30 SP): +6 dodge die size against physical attacks");
myr.system.hp.value = 10;
ok(!anc.hooks.dodgeDieUp(myr, { type: "physical" }), "...only above the Pain Threshold");
const bull = mkActor("Bull", { "ancestry-minotaur-tree": 3 }, {}, { ancestry: "minotaur" });
await bull.setFlag("flowstate", "redTide", { armed: "t" });
ok((await anc.hooks.dodgeNet(bull, foe, {})).net === -1 && anc.hooks.damageStacks({ attacker: bull, target: foe, o: { melee: true } }).parts.includes("+1 Red Tide"),
  "Red Tide: a raging Minotaur's dodges have Disadvantage and its melee attacks are Strengthened");
const hare = mkActor("Hare", { "ancestry-leporid": 3 }, {}, { ancestry: "wildibit" });
await hare.setFlag("flowstate", "hindKick", true);
const kick = await anc.hooks.weaponAttack(hare, { unarmed: true, melee: true });
ok(kick.stacks === 1 && kick.knockback && !hare.getFlag("flowstate", "hindKick"), "Hind Kick: the next Unarmed attack is Strengthened with Knockback (used up)");
dialog = () => ({});
const sick = mkActor("Sick", { "ancestry-wasteling": 3 }, {}, { ancestry: "human", wasteling: true });
combat.combatants.push({ actor: sick });
const touched = await anc.hooks.beforeDamage(sick, foe, { type: "physical", melee: true, stacks: 0 });
ok(touched.type === "acid" && touched.ancStacks.includes("Rotting Touch") && sick.system.rp.value === 5, "Rotting Touch (Wasteling T3): 1 RP, a melee hit becomes Acid with a Strengthened stack");

console.log("== The Living Metal Arm and Thick Hide");
const lightIron = weaponProfile({ type: "balanced", weight: "light", material: "iron", grade: 1, natural: true, livingArm: true }, { str: 30, dex: 30 });
const heavyIron = weaponProfile({ type: "balanced", weight: "heavy", material: "iron", grade: 1, natural: true, livingArm: true }, { str: 30, dex: 30 });
ok(lightIron.valid && lightIron.durability * 2 === heavyIron.durability && !weaponProfile({ type: "balanced", weight: "light", material: "iron", grade: 1 }, { str: 30, dex: 30 }).valid,
  "A Living Metal Arm can be a Light Weapon of Iron (Heavy-only) at half its Durability and Limit");
const hide = armorProfile({ weight: "medium", material: "hide", grade: 1, natural: true }, 30);
ok(hide.durability === 90 && hide.limit === 18, "Thick Hide (Medium): 30 Durability, 6 Limit, scaled by all of Constitution (×3 at 30)");
ok(labels(sworan).includes("Living Metal Arm") && labels(bull).includes("Red Tide") === false, "Rows: the Living Metal Arm (Red Tide is a reaction, no row)");

console.log("== Casting and checks");
const ctx = { skillPoints: 30, known: null, trees: {}, options: [], extraTR: 1, extraTRLabel: "Steeped in Magic", bloodPrice: true };
const plan = spells.planCast({ ...ctx, trees: { "magic-theory": 1, "magic-slashing": 1 }, options: [{ key: "raw", ok: true, ap: [1, 2, 3], scaling: 30, scalingStat: "reach", tr: [1, 2, 3] }] },
  { option: "raw", ap: 1, core1: "magic-slashing:cut", bloodPrice: true });
ok(plan.trParts?.some(p => p.label === "Steeped in Magic") && plan.bloodPrice && plan.power === 2 * plan.spellPower, "Steeped in Magic: +1 TR; Blood Price: +100% Power");
const elfT = mkActor("ElfT", {}, {}, { ancestry: "elf" });
ok(ancestryNet.persuasion(rot, elfT) === -1 && ancestryNet.persuasion(rot, rot) === 0, "Unwelcome (Wasteling): Disadvantage on persuasion against anyone who isn't a Wasteling");
const myr2 = mkActor("Myr2", { "ancestry-myrthel-tree": 2 }, {}, { ancestry: "myrthel" });
ok(ancestryNet.persuasion(myr2, elfT) === 1 && ancestryNet.fear(mkActor("Sm4", { "ancestry-smoblin-tree": 4 }, {}, { ancestry: "smoblin" })) === 1, "Treasured (against Elves), Hardened Mind (resisting Fear)");
ok(situational(hare, "perception").length === 1 && situational(mkActor("Hare2", { "ancestry-leporid": 2 }, {}, { ancestry: "wildibit" }), "perception")[0].key === "twitchingEars", "Twitching Ears: a tick in the perception check");

if (fails) { console.log(`${fails} failed`); process.exit(1); }
console.log("new ancestry tests passed");
