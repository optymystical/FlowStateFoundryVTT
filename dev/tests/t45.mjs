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
const trees = { "martial-theory": 5, "martial-constitution-methods": 5, "martial-curved-weapons": 5, "martial-longshot-weapons": 5,
  "martial-titanic-armor": 5, "martial-grappling-methods": 5, "martial-thrasher-weapons": 5, "martial-unarmored": 5 };
const hero = mkActor("Hero", { energy: { value: 5000 } }, { ...trees });
const orc = mkActor("Orc", { energy: { value: 5000 } }, { ...trees, "martial-unarmored": 2 });
combat.combatant = { actor: hero };
game.user.isGM = true;
const attack = async (item, o = {}) => { dialog = () => ({ net: 0, stacks: 0, mode: "strike", ...o }); game.user.targets = new Set([{ actor: orc }]); return actions.rollWeaponAttack(hero, item); };
const hit = async () => { dialog = () => ({ net: 0 }); seq = [1, 50]; await actions.defend(last("attack"), 0, "dodge"); if (last("defense").flags.flowstate.defense.result.hit && !last("damage")?.flags.flowstate.damage || true) {} };

console.log("== Curved: Disarm, Momentum, Omnislash, Perfect Parry");
const scim = mkWeapon(hero, "Scimitar", { weaponType: "curved", weight: "light", material: "hardwood", grade: 3 });
const club = mkWeapon(orc, "Club", { weaponType: "striker", weight: "light", material: "hardwood", grade: 3 });
seq = [30]; await attack(scim, { disarm: club.uuid });
let o = last("attack").flags.flowstate.attack.opts;
ok(o.disarm === club.uuid && o.stacks === scim.system.profile.stacks - 1, "Disarm: Weakened, aimed at the Club");
dialog = () => ({ net: 0 }); seq = [1]; await actions.defend(last("attack"), 0, "dodge");
ok(/drops Club/.test(last("defense").content) && /fs-momentum/.test(last("defense").content), "hit: Club dropped (GM request), Momentum offered");
for (let i = 0; i < 4; i++) { const d = last("defense"); await actions.addMomentum(d, i % 2 ? "str" : "adv"); if (i < 3) { hero.system.ap.value = 6; seq = [30]; await attack(scim); dialog = () => ({ net: 0 }); seq = [1]; await actions.defend(last("attack"), 0, "dodge"); } }
ok(JSON.stringify(actions.momentumOf(orc, hero)) === JSON.stringify({ adv: 2, str: 2 }), "4 Momentum stacks (2 Adv, 2 Str)");
hero.system.ap.value = 6; seq = [5]; await attack(scim, { omnislash: true });
const df = last("defense").flags.flowstate.defense;
ok(df.result.doubleCrit && df.result.critStacks === 4 && !orc.getFlag("flowstate", `momentum.${hero.id}`), "Omnislash: auto Double Crit, Momentum spent");
const sabre = mkWeapon(orc, "Sabre", { weaponType: "curved", weight: "light", material: "hardwood", grade: 3 });
combat.combatant = { actor: orc };
dialog = () => ({ net: 0, stacks: 0, mode: "strike" }); game.user.targets = new Set([{ actor: hero }]); seq = [10];
const heroSabre = mkWeapon(hero, "HeroSabre", { weaponType: "curved", weight: "light", material: "hardwood", grade: 3 });
combat.combatant = { actor: hero }; await actions.startParry(hero, heroSabre.id); combat.combatant = { actor: orc };
await actions.rollWeaponAttack(orc, sabre);
ok(last("attack").content.includes('data-choice="perfectParry"'), "Perfect Parry button (Curved Parry active)");
let ppSeen = ""; dialog = c => { ppSeen = c; return { net: 0 }; }; seq = [12]; await actions.defend(last("attack"), 0, "perfectParry");
ok(!last("defense").flags.flowstate.defense.result.hit && /with Advantage/.test(ppSeen) && last("defense").content.includes("fs-riposte"), "Perfect Parry (Advantage) negates; Riposte offered");
await actions.clearParries(hero);
combat.combatant = { actor: hero };

console.log("== Longshot: Headshot, Snipe Hunt, Like Shooting Fish, In a Barrel");
const rifle = mkWeapon(hero, "Longrifle", { weaponType: "longshot", weight: "light", material: "hardwood", grade: 3 });
hero.system.ap.value = 6; seq = [30]; await attack(rifle, { mode: "r1", prepared: "headshot", snipe: true, fish: true });
o = last("attack").flags.flowstate.attack.opts;
const ent = last("attack").flags.flowstate.attack.targets[0];
ok(o.pierce === Math.floor(rifle.system.profile.capped / 2) && ent.snipe >= 1, `Headshot Pierce+, Snipe Hunt gives ${ent.snipe} dodge Dis`);
dialog = () => ({ net: 0 }); seq = [1]; await actions.defend(last("attack"), 0, "dodge");
ok(orc.statuses.has("fishy") && /Snipe Hunt/.test(last("defense").content), "Like Shooting Fish applied; Snipe Hunt in the dodge");
hero.system.ap.value = 6; rifle.system.rounds = 1; rifle.system.prepareDerivedData(); seq = [30]; await attack(rifle, { mode: "r1" });
ok(last("attack").flags.flowstate.attack.targets[0].net >= 1, "In a Barrel: Advantage vs a movement-penalized target");
await actions.clearPlacedEffects(hero);
ok(!orc.statuses.has("fishy"), "cleared at the shooter's next turn");

console.log("== Thrasher: Windup + Whirlygig, Overshield, Grapple, Get Over Here!");
const whip = mkWeapon(hero, "Whip", { weaponType: "thrasher", weight: "light", material: "hardwood", grade: 3 });
hero.system.ap.value = 6; seq = [30]; await attack(whip, { windup: 4, overshield: true });
o = last("attack").flags.flowstate.attack.opts;
ok(o.stacks === whip.system.profile.stacks + 2 && last("attack").flags.flowstate.attack.targets[0].net >= 4, "4 Windups: +4 Adv, +2 Strengthened");
ok(!last("attack").content.includes('data-choice="parry"') && !last("attack").content.includes("perfectParry"), "Overshield: no Parry-type buttons");
dialog = () => ({ net: 0 }); seq = [1, 5]; await actions.defend(last("attack"), 0, "dodge");
hero.system.ap.value = 6; seq = [30]; await attack(whip, { getOverHere: true });
dialog = () => ({ net: 0 }); seq = [1, 5]; await actions.defend(last("attack"), 0, "dodge");
ok(orc.getFlag("flowstate", "grappledBy") === hero.uuid && orc.getFlag("flowstate", "lockedDown") === hero.uuid && orc.statuses.has("prone"), "Get Over Here!: grappled, Locked Down (Grappling T1), prone");

console.log("== Grappling: Disrupt with Stunlock, Lock Down escape");
await actions.disrupt(hero);
ok(orc.getFlag("flowstate", "disrupted")?.auto === true, "Stunlock: free, every roll");
game.user.targets = new Set([{ actor: hero }]); dialog = () => ({ net: 0 }); seq = [99];
combat.combatant = { actor: orc };
await actions.breakFree(orc);
dialog = () => ({ net: 0 }); seq = [1]; await actions.defend(last("attack"), 0, "dodge");
ok(!orc.getFlag("flowstate", "lockedDown") && orc.getFlag("flowstate", "grappledBy") === hero.uuid, "first escape only removes Lock Down");
combat.combatant = { actor: hero };

console.log("== Taunt (Constitution T2)");
game.user.targets = new Set([{ actor: orc }]); hero.system.rp.value = 6;
dialog = () => ({ net: 0, check: "Persuasion" }); seq = [90, 10];
await actions.taunt(hero);
ok(orc.getFlag("flowstate", "tauntedBy")?.by === hero.uuid && hero.system.rp.value === 4, "Taunted (2 RP)");
seq = [5, 50]; await actions.shakeTaunt(orc);
ok(!orc.getFlag("flowstate", "tauntedBy"), "shaken off on a repeat");

console.log("== Chunky (Titanic T5) & Imposing Presence");
const t = { id: "TP", name: "Titan Plate", type: "armor", uuid: "Actor.Hero.Item.TP", parent: hero, system: { weight: "titanic", equipped: true, wear: 0, durability: { value: 500, max: 500 }, profile: { valid: true, limit: 40, focus: null, selfWeakened: 0 } } };
hero.items.push(t); hero.system.armor = t;
const out = await actions.damageOutcome(hero, 100, "physical", { pierce: 20 });
ok(out.toHp === 100 - (40 - 10), "Pierce 20 counts as 10 against Titanic armor");

console.log("== Unarmored: Dash reaction, Quicken");
hero.items.splice(hero.items.indexOf(t), 1); hero.system.armor = null;
combat.combatant = { actor: orc }; orc.system.ap.value = 6;
game.user.targets = new Set([{ actor: hero }]); dialog = () => ({ net: 0, stacks: 0, mode: "strike" }); seq = [20];
hero.system.trees["martial-unarmored"] = 5;
await actions.rollWeaponAttack(orc, sabre);
{ const a = last("attack").flags.flowstate.attack.targets[0];
  ok(!last("attack").content.includes('data-choice="dash"') && a.autoDash && /Dash \(Speedy\)/.test(last("attack").content), "Speedy: Dash applied automatically (rolled with Disadvantage, no button)");
  hero.system.rp.value = 6; dialog = () => ({ net: 0 }); seq = [1]; await actions.defend(last("attack"), 0, "dodge");
  ok(last("defense").content.includes("fs-dash-move"), "Speedy: the defense card still offers the 1 RP move"); }
hero.system.trees["martial-unarmored"] = 2;
combat.combatant = { actor: orc }; orc.system.ap.value = 6; dialog = () => ({ net: 0, stacks: 0, mode: "strike" }); seq = [20];
await actions.rollWeaponAttack(orc, sabre);
ok(last("attack").content.includes('data-choice="dash"'), "Dash reaction offered while unarmored");
hero.system.rp.value = 6; seq = [7]; await actions.defend(last("attack"), 0, "dash");
ok(hero.system.rp.value === 6 && !hero.getFlag("flowstate", "freeMove") && actions.effectiveEntry(last("attack").id, 0, last("attack").flags.flowstate.attack.targets[0]).total === 7, "Dash reaction: no RP, attack re-rolled to 7");
{ // A higher re-roll doesn't replace the attack.
  const msg = last("attack");
  const before = actions.effectiveEntry(msg.id, 0, msg.flags.flowstate.attack.targets[0]).total;
  hero.system.trees["martial-light-armor"] = hero.system.trees["martial-light-armor"] ?? 0;
  ok(before === 7, "attack is at 7 after the Dash"); }
{ const atk = last("attack"); dialog = () => ({ net: 0 }); seq = [12]; await actions.defend(atk, 0, "dodge");
  const dm = messages.at(-1);
  ok(dm.content.includes("fs-dash-move"), "defense card offers the Dash move");
  await actions.dashMove(dm); await actions.dashMove(dm);
  ok(hero.system.rp.value === 5 && hero.getFlag("flowstate", "freeMove"), "Dash move: 1 RP once, free move"); }
combat.combatant = { actor: hero }; hero.system.trees["martial-unarmored"] = 5;
await actions.quicken(hero); hero.system.prepareDerivedData();
ok(hero.statuses.has("quickened") && hero.system.movement.speed === 2 * hero.system.derived.move, "Quicken doubles speed");
