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
globalThis.CONFIG = {}; game.messages.filter = fn => messages.filter(fn);
globalThis.CONFIG = {};
let waitChoice = "quick";
globalThis.foundry.applications.api.DialogV2.wait = async () => waitChoice;
globalThis.foundry.applications.api.DialogV2.confirm = async () => true;
const ab = await import("../../module/abilities.mjs");
const { applyStacks } = await import("../../module/rules.mjs");
const F = () => messages.at(-1).flags.flowstate;
const last = k => [...messages].reverse().find(m => m.flags?.flowstate?.[k]);
function mkArmor(actor, id, weight, limit = 10) {
  const a = { id, name: id, type: "armor", uuid: `${actor.uuid}.Item.${id}`, parent: actor, isOwner: true,
    system: { weight, equipped: true, wear: 0, durability: { value: 200, max: 200 }, profile: { valid: true, limit, focus: null, selfWeakened: 0 } } };
  a.update = async u => { for (const [k,v] of Object.entries(u)) set(a, k, v); a.system.durability.value = 200 - a.system.wear; };
  actor.items.push(a); actor.system.armor = a; uuids.set(a.uuid, a); return a;
}
const trees = { "martial-theory": 5, "martial-dexterity-methods": 5, "martial-reach-weapons": 5, "martial-circular-weapons": 5,
  "martial-blast-weapons": 5, "martial-light-armor": 5 };
const hero = mkActor("Hero", { energy: { value: 5000 } }, trees);
const orc = mkActor("Orc", { energy: { value: 5000 } }, trees);
combat.combatant = { actor: hero };
const attack = async (item, o = {}) => { dialog = () => ({ net: 0, stacks: 0, mode: "strike", ...o }); game.user.targets = new Set([{ actor: orc }]); return actions.rollWeaponAttack(hero, item); };

console.log("== Shank (Dexterity T2)");
const dagger = mkWeapon(hero, "Dagger", { weaponType: "swift", weight: "light", material: "hardwood", grade: 3 });
seq = [20]; await attack(dagger, { shank1: "pierce", shank2: "dodge", shank3: "dodge" });
let o = last("attack").flags.flowstate.attack.opts;
ok(o.pierce === Math.floor(dagger.system.profile.capped / 2) && o.dodgeNet === -2, "existing Pierce → Pierce+, two dodge Disadvantages");
hero.system.ap.value = 6; seq = [20]; await attack(dagger, { shank1: "cleave", shank2: "cleave", shank3: "adv" });
o = last("attack").flags.flowstate.attack.opts;
ok(o.cleave === dagger.system.profile.capped && o.net === 1, `Cleave+ (${o.cleave} object damage), Advantage`);
dialog = () => ({ net: 0 }); seq = [20, 5, 5];
hero.system.ap.value = 6; await attack(dagger, { shank1: "dodge", shank2: "dodge", shank3: "dodge" });
dialog = () => ({ net: 0 }); await actions.defend(last("attack"), 0, "dodge");
ok(/Shank/.test(last("defense").content), "dodge shows the Shank Disadvantage");

console.log("== Pinpoint Accuracy (Dexterity T5) on Pepper");
const smg = mkWeapon(hero, "SMG", { weaponType: "rapid", weight: "light", material: "hardwood", grade: 3 });
hero.system.ap.value = 6; seq = [20]; await attack(smg, { mode: "r1", pepper: "1", pinpoint: true });
o = last("attack").flags.flowstate.attack.opts;
ok(o.shots === 2 && o.net === 0, "two shots, no Pepper Disadvantage");

console.log("== Thrust / Twist / Impale (Reach T2/T4/T5)");
const spear = mkWeapon(hero, "Spear", { weaponType: "reach", weight: "heavy", material: "iron", grade: 3 });
hero.system.ap.value = 6; seq = [30]; await attack(spear, { thrust: true });
o = last("attack").flags.flowstate.attack.opts;
ok(o.cleave === spear.system.profile.capped && o.reachItem === spear.uuid, "Cleave+ from Thrust");
dialog = () => ({ net: 0 }); seq = [2, 80]; await actions.defend(last("attack"), 0, "dodge"); await actions.rollExchangeDamage(last("defense"), { auto: true });
const dmg = last("damage");
ok(/fs-twist/.test(dmg.content) && /fs-impale/.test(dmg.content), "Twist and Impale offered");
const hp0 = orc.system.hp.value;
await actions.reachFinisher(dmg, "twist");
ok(orc.system.hp.value === hp0 - o.pierce, `Twist adds ${o.pierce} direct damage`);
await actions.reachFinisher(dmg, "impale");
ok(orc.getFlag("flowstate", "grappledBy") === hero.uuid && orc.getFlag("flowstate", "grappleWeapon") === spear.uuid, "Impaled (grappled on the spear)");
hero.system.ap.value = 6;
const before = messages.length; await attack(spear);
ok(messages.length === before, "the spear can't attack while holding Orc");
await actions.setGrapple(orc, null);

console.log("== What Goes Around + Let it Rip (Circular T1/T3/T5)");
const chakram = mkWeapon(hero, "Chakram", { weaponType: "circular", weight: "light", material: "hardwood", grade: 3 });
hero.system.ap.value = 6; seq = [30]; await attack(chakram, { mode: "throw", wga: true, letItRip: true });
const am = last("attack");
ok(hero.items.includes(chakram) && am.flags.flowstate.followups.list.some(f => f.kind === "return"), "kept in hand, return attack queued");
const hpA = orc.system.hp.value;
dialog = () => ({ net: 0 }); seq = [2, 2, 5]; await actions.defend(am, 0, "dodge"); await actions.rollExchangeDamage(last("defense"), { auto: true });
ok(/Let it Rip/.test(last("damage").content) && hpA - orc.system.hp.value >= 2 * 1, "damage repeated");
await actions.rollWeaponAttack(hero, chakram, { kind: "return", net: 0, label: "return", source: am.id + ":return", targetActors: [orc] });
o = last("attack").flags.flowstate.attack.opts;
ok(o.stealth === "half" && hero.items.includes(chakram), "return attack from half stealth, still in hand");

console.log("== Punch / Execute / Rip and Tear (Blast T4/T5/T3)");
const shotgun = mkWeapon(hero, "Shotgun", { weaponType: "blast", weight: "heavy", material: "iron", grade: 3 });
orc.statuses.add("prone"); hero.system.ap.value = 6;
seq = [30]; await attack(shotgun, { mode: "r1", punch: true, execute: true });
o = last("attack").flags.flowstate.attack.opts;
ok(o.knockback === 10 * shotgun.system.profile.capped && !o.knockbackAdd && o.stacks === shotgun.system.profile.stacks + 2 && o.pointBlank, "Knockback+, two Strengthened, Point Blank flagged");
ok(shotgun.system.loaded === false, "fired (unloaded)");
game.user.isGM = true;
dialog = () => ({ net: 0 }); seq = [2, 2, 5]; await actions.defend(last("attack"), 0, "dodge"); await actions.rollExchangeDamage(last("defense"), { auto: true });
ok(shotgun.system.loaded === true && /Rip and Tear/.test(last("damage").content), "Rip and Tear reloads");
game.user.isGM = false; orc.statuses.delete("prone");

console.log("== Light Armor: Shift ×2 (Evade), Breathing Room, Dash, Leap");
function mkArmor2(actor, weight) { const a = { id: "LA", name: "Leathers", type: "armor", uuid: `${actor.uuid}.Item.LA`, parent: actor, system: { weight, equipped: true, wear: 0, durability: { value: 50, max: 50 }, profile: { valid: true, limit: 2, focus: null } } }; actor.items.push(a); actor.system.armor = a; uuids.set(a.uuid, a); }
mkArmor2(orc, "light");
combat.combatant = { actor: hero }; hero.system.ap.value = 6;
seq = [20]; await attack(dagger);
const atk2 = last("attack");
ok(atk2.content.includes('data-choice="shift"'), "Shift button in Light armor");
const e0 = orc.system.energy.value;
dialog = () => ({ mode: "dis" }); seq = [15]; await actions.defend(atk2, 0, "shift");
ok(orc.system.energy.value === e0, "first Shift this round free (Breathing Room)");
seq = [10]; await actions.defend(atk2, 0, "shift");
ok(orc.system.energy.value === e0 - Math.floor(orc.system.derived.effective.con.min / 4) && actions.effectiveEntry(atk2.id, 0, atk2.flags.flowstate.attack.targets[0]).total === 10, "second Shift (Evade) costs Energy; attack re-rolled twice");
seq = [99]; await actions.defend(atk2, 0, "shift");
ok(actions.findShifts(atk2.id, 0).length === 2, "no third Shift");
orc.system.rp.value = 6; await actions.dash(orc);
ok(orc.getFlag("flowstate", "freeMove") && orc.system.rp.value === 5, "Dash: 1 RP, free move");
orc.system.ap.value = 6; await actions.leap(orc);
ok(orc.system.ap.value === 5 && /Jump/.test(last("x") ? "" : messages.at(-1).content), "Leap: 1 AP, jump card");
