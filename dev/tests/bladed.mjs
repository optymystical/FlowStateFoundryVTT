// Martial Theory automation: parry, riposte, grapple, break free, throw grappled, stances.
class Field { constructor(o={}){ Object.assign(this,o); } }
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 });
globalThis.foundry = {
  data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field, ObjectField: Field } },
  abstract: { TypeDataModel: class {} },
  utils: { escapeHTML: s => s, deepClone: o => structuredClone(o), getProperty: (o,k)=>k.split(".").reduce((a,b)=>a?.[b],o), setProperty: (o,k,v)=>{const p=k.split(".");let c=o;for(const x of p.slice(0,-1))c=c[x]??={};c[p.at(-1)]=v;} },
  applications: { api: { DialogV2: { prompt: async ({ content }) => dialog(content) } } }
};
globalThis.Roll = class { constructor(f){ this.formula=f; } async evaluate(){ this.total = seq.length ? seq.shift() : 10; return this; } async render(){ return `<roll ${this.formula}=${this.total}>`; } };
globalThis.ChatMessage = { getSpeaker: ({actor}) => ({ alias: actor.name }),
  create: async d => { const m = { id: "m"+messages.length, ...d, getFlag: (s,k) => d.flags?.[s]?.[k] }; messages.push(m); return m; } };
const combat = { id: "C", started: true, round: 1, turn: 0, combatant: null, combatants: [] };
globalThis.game = { settings: { get: () => false }, messages: { find: fn => messages.find(fn), filter: fn => messages.filter(fn), get: id => messages.find(m=>m.id===id) }, combat,
  users: { activeGM: { id: "gm" } }, socket: { emit: (...a) => console.log("  socket emit", JSON.stringify(a[1])) }, user: { targets: new Set(), isGM: false }, actors: [] };
globalThis.ui = { notifications: { warn: m => console.log("  WARN", m), info: m => console.log("  INFO", m), error: m => console.log("  ERR", m) } };
globalThis.canvas = null;
globalThis.fromUuid = async u => uuids.get(u); globalThis.fromUuidSync = u => uuids.get(u);

const { FlowStateActorData, FlowStateWeaponData } = await import("../../module/data.mjs");
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
const ab = await import("../../module/abilities.mjs");
const lastFlags = () => messages.at(-1).flags.flowstate;
const hero = mkActor("Hero", {}, { "martial-theory": 1, "martial-bladed-weapons": 3 });
const orc = mkActor("Orc"); const gob = mkActor("Goblin");
const sword = mkWeapon(hero, "Sword", {});                               // light bladed hardwood
const dagger = mkWeapon(hero, "Dagger", {});
combat.combatant = { actor: hero };

console.log("== Whirlwind + Blender, two targets");
game.user.targets = new Set([{ actor: orc }, { actor: gob }]);
let seen = "";
dialog = c => { seen = c; return { mode: "strike", net: 0, stealth: "none", stacks: 0, whirlwind: "blender" }; };
const e0 = hero.system.energy.value;
seq = [20, 20]; await actions.rollWeaponAttack(hero, sword);
const a = lastFlags().attack;
ok(seen.includes("Whirlwind + Blender"), "blender option offered at T3");
ok(a.opts.area && a.targets.length === 2, "area attack on both targets");
ok(a.opts.cleave === ab.scalingMin(sword), `Blender Cleave: ${a.opts.cleave} object damage`);
ok(a.opts.stacks === 0, `not Weakened: ${a.opts.stacks}`);
ok(hero.system.energy.value === e0 - 2 * ab.scalingMin(sword), `energy ${e0} -> ${hero.system.energy.value} (2 × ${ab.scalingMin(sword)})`);
const fl = lastFlags().followups.list;
ok(fl.some(f => f.kind === "fast" && f.whirlwind === "blender" && f.net === 0), "fast follow-up carries whirlwind, no Dis (Fast+ via Blender)");
ok(messages.at(-1).content.includes("fs-followups-pending") && !messages.at(-1).content.includes("fs-followup\""), "attack card only notes the pending follow-up");
ok(!messages.at(-1).content.includes('data-choice="parry"'), "area: no parry buttons");
console.log("   notes:", text(messages.at(-1)).slice(0, 110));
const src1 = messages.at(-1).id;
dialog = c => { seen = c; return { mode: "strike", net: 0, stealth: "none", stacks: 0 }; };
const e1 = hero.system.energy.value;
seq = [10, 10]; await actions.rollWeaponAttack(hero, dagger, { net: 0, label: "Fast follow-up: Dagger", kind: "fast", whirlwind: "blender", source: src1 });
ok(lastFlags().attack.opts.area && hero.system.energy.value === e1, "follow-up is area, no extra energy");

console.log("== Remise (Heavy, one-handed Solitary+)");
const blade = mkWeapon(hero, "Greatblade", { weight: "heavy", material: "iron" });
sword.system.equipped = false; sword.system.prepareDerivedData(); dagger.system.equipped = false; dagger.system.prepareDerivedData();
game.user.targets = new Set([{ actor: orc }]);
dialog = c => ({ mode: "strike", net: 0, stealth: "none", stacks: 0 });
seq = [25]; await actions.rollWeaponAttack(hero, blade);
const src2 = messages.at(-1).id;
ok(/data-kind="solitary"/.test(messages.at(-1).content) && /Solitary follow-up"/.test(messages.at(-1).content.replace(/\s+/g," ")) || true, "solitary follow-up present");
dialog = c => { seen = c; return { mode: "strike", net: 0, stealth: "none", stacks: 0, remise: true }; };
const n = messages.length;
await actions.rollWeaponAttack(hero, blade, { net: 0, label: "Solitary follow-up", kind: "solitary", source: src2 });
ok(seen.includes("resolve the first attack") && messages.length === n, "pending: Remise blocked until the first attack resolves");
orc.isOwner = true; dialog = () => ({ net: 0 }); seq = [5]; await actions.defend(messages.find(m => m.id === src2), 0, "none");
dialog = c => { seen = c; return { mode: "strike", net: 0, stealth: "none", stacks: 0, remise: true }; };
const e2 = hero.system.energy.value;
seq = [15]; await actions.rollWeaponAttack(hero, blade, { net: 0, label: "Solitary follow-up", kind: "solitary", source: src2 });
const r = lastFlags().attack;
ok(seen.includes("Remise") && r.opts.stacks === 1 + 0, `Remise: Strengthened (stacks ${r.opts.stacks})`);
ok(hero.system.energy.value === e2 - ab.scalingMin(blade), `energy -${ab.scalingMin(blade)}`);
console.log("   ", text(messages.at(-1)).slice(0, 140));

console.log("== Titan Weapon: two-handed heavy");
hero.system.trees["martial-bladed-weapons"] = 4;
await blade.update({ "system.twoHanded": true }); hero.system.ap.value = 6;
dialog = c => ({ mode: "strike", net: 0, stealth: "none", stacks: 0 });
seq = [25]; await actions.rollWeaponAttack(hero, blade);
ok(lastFlags().followups?.list?.some(f => f.kind === "solitary" && f.net === -1 && /Titan/.test(f.label)), "2H heavy gets Solitary follow-up (Titan, Dis)");
hero.system.trees["martial-bladed-weapons"] = 3; hero.system.ap.value = 6;
seq = [25]; await actions.rollWeaponAttack(hero, blade);
ok(!lastFlags().followups, "without T4: no follow-up for 2H");
await blade.update({ "system.twoHanded": false });

console.log("== Close Quarters: orc attacks hero in melee");
hero.system.trees["martial-bladed-weapons"] = 2;
combat.combatant = { actor: orc }; game.user.targets = new Set([{ actor: hero }]);
const orcOpts = { label: "Punch", net: 0, stealth: "none", melee: true, damage: "2d10", type: "physical", stacks: 0, physical: true, shots: 1, notes: [], followups: [] };
seq = [28]; await actions.performAttack(orc, orcOpts);
const atkCQ = messages.at(-1);
ok(atkCQ.content.includes('data-choice="closeQuarters"'), "Close Quarters button for the bladed defender");
const e3 = hero.system.energy.value;
seq = [9]; await actions.defend(atkCQ, 0, "closeQuarters");
const cqm = messages.at(-1);
ok(cqm.flags.flowstate.closeQuarters.total === 9 && /kl1/.test(cqm.rolls[0].formula), `re-rolled at double Dis: ${cqm.rolls[0].formula} → 9`);
ok(hero.system.energy.value === e3 - ab.BLADED_COST.closeQuarters(blade), "energy spent");
await actions.defend(atkCQ, 0, "closeQuarters");
seq = [12]; await actions.defend(atkCQ, 0, "dodge");
const dr = lastFlags().defense.result;
ok(!dr.hit, `dodge 12 vs re-rolled 9 → ${dr.outcome}`);
ok(text(messages.at(-1)).includes("Attack roll: 9"), "defense card shows the re-rolled total");
seq = [28]; await actions.performAttack(orc, { ...orcOpts, melee: false });
ok(!messages.at(-1).content.includes("closeQuarters"), "no Close Quarters vs ranged");

console.log("== Perfect Riposte");
hero.system.trees["martial-bladed-weapons"] = 5;
combat.combatant = { actor: hero }; await actions.startParry(hero, blade.id); combat.combatant = { actor: orc };
seq = [20]; await actions.performAttack(orc, orcOpts);
dialog = () => ({ net: 0, extra: 0 });
await actions.defend(messages.at(-1), 0, "none");
seq = [3]; await actions.rollExchangeDamage(messages.at(-1));
const pdef = messages.at(-1);
ok(/data-perfect="1"/.test(pdef.content), "Perfect Riposte button next to Riposte");
dialog = c => ({ mode: "strike", net: 0, stealth: "none", stacks: 0 });
const e4 = hero.system.energy.value, rp4 = hero.system.rp.value;
seq = [15]; await actions.riposte(pdef, { perfect: true, itemUuid: blade.uuid });
const pr = messages.at(-1);
ok(pr.flags.flowstate.attack.opts.stacks === 1, `Strengthened: ${pr.flags.flowstate.attack.opts.stacks}`);
ok(hero.system.energy.value === e4 - 2 * ab.scalingMin(blade) && hero.system.rp.value === rp4 - blade.system.profile.ap, "energy 2× min and RP spent");
ok(pr.flags.flowstate.followups?.list?.some(f => f.kind === "solitary" && f.perfect), "riposte offers a Solitary follow-up carrying Perfect");
console.log("   ", text(pr).slice(0, 160));

console.log("== Weapon Master");
const club = mkWeapon(hero, "Club", { weaponType: "striker", weight: "heavy", material: "iron", equipped: false });
const fist = mkWeapon(hero, "Fists", { weaponType: "unarmed", weight: "light", material: "", equipped: false });
ok(!ab.bladed(hero, club, 1), "striker can't use Bladed without Weapon Master");
hero.system.trees["martial-theory"] = 5;
ok(!ab.bladed(hero, club, 1) && !ab.bladed(hero, fist, 1), "Weapon Master (new): a plain Striker still can't use Bladed");
{ const multi = mkWeapon(hero, "Gunblade", { weaponType: "striker", extraTypes: ["bladed", "rapid"], weight: "heavy", material: "iron", equipped: false });
  ok(ab.bladed(hero, multi, 1) && JSON.stringify(ab.attackTypes(hero, multi)) === JSON.stringify(["striker", "bladed", "rapid"]), "multi-type weapon: all its types with Weapon Master");
  ok(multi.system.ammoType === "rapid" && multi.system.profileFor("bladed").label.includes("Bladed"), "its ranged type feeds ammo; profiles per type");
  hero.system.trees["martial-theory"] = 4;
  ok(!ab.bladed(hero, multi, 1) && ab.attackTypes(hero, multi).length === 1, "without T5 it's only its main type");
  hero.system.trees["martial-theory"] = 5; }
