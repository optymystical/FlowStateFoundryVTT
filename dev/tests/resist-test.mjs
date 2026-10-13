// Mental Wonders: Life, Death, Order, Chaos, Beyond and Below (their Modes, Tenets and abilities, through the real attack exchange).
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

const ab = await import("../../module/abilities.mjs");
globalThis.canvas = null;

console.log("== Resisting with Martial stat checks");
const base = { value: 16, die: 32, min: 5 };
let r = ab.resistCheck(base, { unstoppable: true });
ok2(r.value === 32 && r.die === 64 && r.net === 1 && !r.auto, "Unstoppable: the stat counts twice (d64 instead of d32) and the roll has Advantage");
r = ab.resistCheck(base, { pureBody: true, target: 7 });
ok2(r.die === 64 && r.net === 0 && r.auto, "Pure Body: stat counts twice, and a target under half the stat (7 < 8) is an automatic success");
r = ab.resistCheck(base, { pureBody: true, target: 8 });
ok2(!r.auto, "…8 is not under half of 16");
r = ab.resistCheck(base, { unstoppable: true, pureBody: true });
ok2(r.value === 64 && r.die === 128 && r.net === 1, "Both together multiply: the stat counts four times as high");
r = ab.resistCheck(base, {});
ok2(r.die === 32 && r.net === 0 && !r.auto, "Neither: a normal check");
r = ab.resistCheck(base, { pureBody: true, con: { value: 40, die: 80, min: 13 } });
ok2(r.value === 40 && r.die === 80 && r.min === 13, "Pure Body: Constitution (not doubled) stands in for the required stat when it is higher (40 beats 16 × 2)");
r = ab.resistCheck(base, { pureBody: true, unstoppable: true, con: { value: 40, die: 80, min: 13 } });
ok2(r.value === 80 && r.die === 160 && r.net === 1, "With Unstoppable, the stand-in Constitution still counts Unstoppable's doubling (not Pure Body's): 40 × 2 = 80 (the doc: \"not counting the doubling by Pure Body\")");
r = ab.resistCheck(base, { pureBody: true, con: { value: 20, die: 40, min: 6 } });
ok2(r.die === 64, "…but not when the doubled stat is higher (20 < 32)");
r = ab.resistCheck(base, { pureBody: true, target: 19, con: { value: 40, die: 80, min: 13 } });
ok2(r.auto, "…and the automatic success goes by the stat used (19 is under half of 40)");

const hero = mkActor("Hero", {}, { "martial-constitution-methods": 3, "martial-strength-methods": 5 });
// Dialog answers: an options object per check.
let answers = [];
foundry.applications.api.DialogV2.prompt = async () => answers.shift() ?? { net: 0, applyMin: false };
seq = [20]; answers = [{ net: 0, applyMin: false, pureBody: true, target: 7 }];
messages.length = 0; await actions.rollStatCheck(hero, "con");
ok2(/Automatic success/.test(text(messages.at(-1))), "A Constitution check with Pure Body against a low target is an automatic success (no roll)");
seq = [20]; answers = [{ net: 0, applyMin: false, pureBody: true, target: 0 }];
messages.length = 0; await actions.rollStatCheck(hero, "con");
ok2(/Pure Body: stat counts twice/.test(text(messages.at(-1))) && text(messages.at(-1)).includes(`d${2 * hero.system.derived.effective.con.die}`), "Resisting with Pure Body rolls the doubled die");
seq = [20]; answers = [{ net: 0, applyMin: false }];
messages.length = 0; await actions.rollStatCheck(hero, "pon");
ok2(text(messages.at(-1)).includes("d" + hero.system.derived.effective.pon.die + ")") && !/Pure Body|Unstoppable/.test(text(messages.at(-1))), "Mind and Spirit stat checks have no resisting options");
await hero.toggleStatusEffect("unstoppable", { active: true });
seq = [20]; answers = [{ net: 0, applyMin: false, unstoppable: true }];
messages.length = 0; await actions.rollStatCheck(hero, "str");
ok2(/Unstoppable: Advantage/.test(text(messages.at(-1))) && text(messages.at(-1)).includes(`d${2 * hero.system.derived.effective.str.die}`), "While Unstoppable, a Strength check can resist with Advantage and a doubled stat");

console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
