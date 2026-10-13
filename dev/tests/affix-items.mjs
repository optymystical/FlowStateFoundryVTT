// Affixes as items of their own: attuned separately (Offensive → Foci and raw casting, Defensive → Shroud), speed per form, migration.
import { installFoundry } from "./support/foundry.mjs";
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 });
const { combat } = installFoundry({ roll: () => (seq.length ? seq.shift() : 10), dialog: c => dialog(c), messages, uuids });

const { FlowStateActorData, FlowStateShroudData, FlowStateFociData, FlowStateAffixData } = await import("../../module/data.mjs");
await import("../../module/actions.mjs");
const M = await import("../../module/magic.mjs");
const FX = await import("../../module/foci.mjs");
const MIG = await import("../../module/affix-migration.mjs");
const set = (o, k, v) => foundry.utils.setProperty(o, k, v);
function mkActor(name) {
  const a = { name, uuid: "Actor." + name, isOwner: true, items: [], statuses: new Set(), flags: {} };
  a.items.get = id => a.items.find(i => i.id === id);
  a.update = async u => { for (const [k, v] of Object.entries(u)) set(a, k, v); };
  a.setFlag = async (s, k, v) => set(a.flags, `${s}.${k}`, v);
  a.getFlag = (s, k) => foundry.utils.getProperty(a.flags, `${s}.${k}`);
  a.getActiveTokens = () => [];
  a.system = Object.assign(Object.create(FlowStateActorData.prototype), { stats: { str: 30, dex: 30, con: 30, pon: 10, snap: 10, will: 10, reach: 30, grasp: 30, build: 30 }, skillPoints: 30, unspentStats: 0, statCarry: 0, trees: {}, size: 3, hp: { value: 432, lost: 0 }, energy: { value: 50 }, ap: { value: 6 }, rp: { value: 6 }, conditions: { ignite: 0, stain: 0, slow: 0, haste: 0 }, lift: 0, daysWithoutRest: 0 }, { parent: a });
  a.system.prepareDerivedData(); uuids.set(a.uuid, a); game.actors.push(a); combat.combatants.push({ actor: a });
  return a;
}
let fails = 0; const ok2 = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const mkItem = (actor, id, type, Cls, sys) => {
  const i = { id, name: id, type, uuid: `${actor.uuid}.Item.${id}`, parent: actor, actor, isOwner: true };
  i.system = Object.assign(Object.create(Cls.prototype), sys, { parent: i });
  actor.items.push(i); actor.system.prepareDerivedData(); return i;
};
const foci = (a, fociType, extra = {}) => mkItem(a, `foci-${fociType}`, "foci", FlowStateFociData, { fociType, grade: 3, attuned: true, equipped: false, twoHanded: false, wear: 0, affixes: [], doubled: "", element: "heat", chosenSpell: "", lush: false, declared: "", opalRange: "targeted", ...extra });
const shroud = (a, shroudType, extra = {}) => mkItem(a, `shroud-${shroudType}`, "shroud", FlowStateShroudData, { shroudType, grade: 3, attuned: true, wear: 0, affixes: [], doubled: "", element: "heat", declared: "", lush: false, carapace: 0, negated: [], lastType: "", hitSources: [], placedOn: "", ...extra });
let n = 0;
const gem = (a, affix, side, extra = {}) => mkItem(a, `affix-${affix}-${side}-${n++}`, "affix", FlowStateAffixData, { affix, side, attuned: true, element: "heat", declared: "", ...extra });
const speed = a => { a.system.prepareDerivedData(); return a.system.movement.speed; };

console.log("== An Affix item's profile");
const p = M.affixProfile({ affix: "agate", side: "defensive" });
ok2(p.valid && p.side === "defensive" && p.text === M.AFFIXES.agate.shroud && p.label === "Agate", "A Defensive Agate shows its Shroud text");
ok2(M.affixProfile({ affix: "nope", side: "offensive" }).valid === false, "An unknown Affix is invalid");

console.log("== Attuned Affixes reach the Foci or Shroud of their form");
const mage = mkActor("Mage"); const rod = foci(mage, "rod"); const cinder = shroud(mage, "bastion");
gem(mage, "quartz", "offensive"); gem(mage, "agate", "defensive"); gem(mage, "jasper", "offensive", { attuned: false });
mage.system.prepareDerivedData();
ok2(rod.system.profile.affixes.join() === "quartz", `Foci: only the attuned Offensive Affix (${rod.system.profile.affixes})`);
ok2(cinder.system.profile.affixes.join() === "agate", `Shroud: only the attuned Defensive Affix (${cinder.system.profile.affixes})`);
ok2(mage.system.shroud === cinder && M.attunedAffixKeys(mage, "offensive").join() === "quartz", "The helper lists distinct attuned keys per form");

console.log("== Speed: 20% per Affix past the Free Affixes of the matching form");
const a1 = mkActor("A1"); foci(a1, "rod"); gem(a1, "quartz", "offensive"); gem(a1, "agate", "offensive");
ok2(speed(a1) === 50, "A Rod's 2 Free Affixes cover two Offensive Affixes");
gem(a1, "jasper", "offensive");
ok2(speed(a1) === 40, "…a third costs 20%");
const a2 = mkActor("A2"); foci(a2, "rod"); gem(a2, "agate", "defensive");
ok2(speed(a2) === 40, "A Rod's Free Affixes can't cover a Defensive Affix");
const a3 = mkActor("A3"); shroud(a3, "bastion"); gem(a3, "agate", "defensive");
ok2(speed(a3) === 50, "A Bastion's 1 Free Affix covers a Defensive one");
gem(a3, "garnet", "defensive");
ok2(speed(a3) === 40, "…the second costs 20%");
const a4 = mkActor("A4"); foci(a4, "wand"); gem(a4, "quartz", "offensive", { attuned: false });
ok2(speed(a4) === 50, "An Affix that isn't attuned costs nothing");
const a5 = mkActor("A5"); gem(a5, "quartz", "offensive");
ok2(speed(a5) === 40, "Without a Foci there are no Free Affixes");
const a6 = mkActor("A6"); foci(a6, "chime");
ok2(speed(a6) === 40, "A Chime acts as if an Affix were already attuned");
const a7 = mkActor("A7"); foci(a7, "rod", { affixes: ["agate", "jasper", "garnet"] });
ok2(speed(a7) === 40, "Affixes still in an old Foci list are counted until they are converted");

console.log("== Settings live on the Affix");
const t = mkActor("T"); const tf = foci(t, "rod"); gem(t, "tourmaline", "offensive", { element: "cold" }); gem(t, "coloredDiamond", "offensive", { declared: "magic-heat:flame" });
t.system.prepareDerivedData();
ok2(tf.system.element === "cold" && tf.system.declared === "magic-heat:flame", "Tourmaline's element and Colored Diamond's declaration reach the Foci");
const ts = mkActor("TS"); const tsh = shroud(ts, "bastion"); gem(ts, "tourmaline", "defensive", { element: "acid" });
ts.system.prepareDerivedData();
ok2(tsh.system.element === "acid", "…and the Shroud");

console.log("== Raw Casting uses attuned Offensive Affixes");
const r = mkActor("R"); gem(r, "agate", "offensive"); gem(r, "tourmaline", "offensive", { element: "cold" }); gem(r, "jasper", "defensive");
const fx = FX.fociFx(r, { option: { key: "raw", form: "raw" }, scaling: 30 });
ok2(fx && fx.id === null && fx.affixes.includes("agate") && !fx.affixes.includes("jasper") && fx.element === "cold", "A raw cast carries the Offensive Affixes (and the Tourmaline element)");
ok2(FX.fociFx(mkActor("None"), { option: { key: "raw", form: "raw" }, scaling: 30 }) === null, "No Affixes, no raw effects");
ok2(FX.fociFx(r, { option: { key: "foci:x", form: "igniter", fociId: "x" }, scaling: 30 }) === null, "A Foci cast that can't find its Foci doesn't fall back to raw");

console.log("== Old per-item lists are converted");
const old = mkActor("Old"); foci(old, "rod", { affixes: ["agate", "jasper"] }); shroud(old, "bastion", { affixes: ["garnet"], attuned: false });
const plan = MIG.legacyAffixPlan(old);
ok2(plan.create.length === 3 && plan.create.filter(c => c.system.side === "offensive").length === 2 && plan.create.find(c => c.system.affix === "garnet").system.side === "defensive", "Foci Affixes become Offensive items, Shroud Affixes Defensive");
ok2(plan.create.find(c => c.system.affix === "agate").system.attuned === true && plan.create.find(c => c.system.affix === "garnet").system.attuned === false, "…attuned like the item they were on");
ok2(plan.clear.length === 2 && plan.clear.every(c => c["system.affixes"].length === 0), "…and the old lists are cleared");
ok2(MIG.legacyAffixPlan(mkActor("Clean")).clear.length === 0, "Nothing to do for an actor without old lists");

console.log("== Shroud types renamed");
ok2(FlowStateShroudData.migrateData({ shroudType: "aegis" }).shroudType === "bulwark" && FlowStateShroudData.migrateData({ shroudType: "ward" }).shroudType === "mantle" && FlowStateShroudData.migrateData({ shroudType: "riposte" }).shroudType === "rebuke", "Old ids map to Bulwark, Mantle and Rebuke");

if (fails) { console.log(`${fails} FAILED`); process.exit(1); }
