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
const hero = mkActor("Hero", {}, { "martial-theory": 1 });
const orc = mkActor("Orc", {}, { "martial-theory": 1 });
const a1 = mkWeapon(hero, "Sword", {}); const a2 = mkWeapon(hero, "Dagger", {});
const orcBlade = mkWeapon(orc, "Cutlass", {});
combat.combatant = { actor: hero };
game.user.targets = new Set([{ actor: orc }]);
const cards = () => messages.filter(m => m.flags?.flowstate?.followupCard);
dialog = c => ({ mode: "strike", net: 0, stealth: "none", stacks: 0 });

console.log("== Hit: follow-up waits for the dodge and the damage");
seq = [25]; await actions.rollWeaponAttack(hero, a1);
const atk = messages.at(-1);
await actions.postReadyFollowups(atk); ok(cards().length === 0, "not before the defender responds");
orc.isOwner = true; dialog = () => ({ net: 0 }); seq = [5];
await actions.defend(atk, 0, "dodge");                                  // auto damage off (settings.get → false)
await actions.postReadyFollowups(atk); ok(cards().length === 0, "not before damage is rolled");
dialog = () => ({ extra: 0 }); seq = [7];
await actions.rollExchangeDamage(messages.at(-1));
await actions.postReadyFollowups(atk);
ok(cards().length === 1 && cards()[0].flags.flowstate.followupCard === atk.id, "follow-up card posted after damage");
ok(/data-source="m\d+"/.test(cards()[0].content) && cards()[0].content.includes("Fast follow-up: Dagger"), "card has the buttons, pointing at the attack");
await actions.postReadyFollowups(atk); ok(cards().length === 1, "posted only once");

console.log("== Miss: follow-up right after the dodge");
seq = [3]; await actions.rollWeaponAttack(hero, a1);
const atk2 = messages.at(-1); seq = [20];
await actions.defend(atk2, 0, "dodge");
await actions.postReadyFollowups(atk2); ok(cards().length === 2, "miss: posted after the dodge");

console.log("== Parry: waits for the Riposte decision, then the Riposte's exchange");
combat.combatant = { actor: orc }; await actions.startParry(orc, orcBlade.id); combat.combatant = { actor: hero };
dialog = c => ({ mode: "strike", net: 0, stealth: "none", stacks: 0 });
seq = [20]; await actions.rollWeaponAttack(hero, a1);
const atk3 = messages.at(-1);
dialog = () => ({ net: 0, extra: 0 });
await actions.defend(atk3, 0, "none");
const def3 = messages.at(-1);
seq = [4]; await actions.rollExchangeDamage(def3);
const dmg3 = messages.at(-1);
ok(dmg3.content.includes("fs-no-riposte"), "No riposte button offered on the damage card");
await actions.postReadyFollowups(atk3); ok(cards().length === 2, "waits while the Riposte is undecided");
await actions.declineRiposte(dmg3);
await actions.postReadyFollowups(atk3); ok(cards().length === 3, "posted once the Riposte is passed");
await actions.riposte(dmg3, { itemUuid: orcBlade.uuid });

console.log("== Parry then Riposte: waits for the Riposte to resolve"); hero.system.ap.value = 6;
dialog = c => ({ mode: "strike", net: 0, stealth: "none", stacks: 0 });
seq = [20]; await actions.rollWeaponAttack(hero, a1);
const atk4 = messages.at(-1);
dialog = () => ({ net: 0, extra: 0 });
await actions.defend(atk4, 0, "none");
seq = [4]; await actions.rollExchangeDamage(messages.at(-1));
const dmg4 = messages.at(-1);
dialog = c => ({ mode: "strike", net: 0, stealth: "none", stacks: 0 });
seq = [18]; await actions.riposte(dmg4, { itemUuid: orcBlade.uuid });
const rip = messages.at(-1);
await actions.postReadyFollowups(rip); ok(cards().length === 3, "riposte unresolved: original follow-up still waits");
hero.isOwner = true; dialog = () => ({ net: 0 }); seq = [2];
await actions.defend(rip, 0, "dodge");
dialog = () => ({ extra: 0 }); seq = [4]; await actions.rollExchangeDamage(messages.at(-1));
await actions.postReadyFollowups(rip);
ok(cards().some(c => c.flags.flowstate.followupCard === atk4.id), "riposte resolved: the original attack's follow-up card appears");

console.log("== Untargeted: posted immediately"); hero.system.ap.value = 6;
game.user.targets = new Set(); seq = [20, 5];
await actions.rollWeaponAttack(hero, a1);
const u = messages.at(-1); await actions.postReadyFollowups(u);
ok(cards().some(c => c.flags.flowstate.followupCard === u.id), "untargeted attack's follow-up posted at once");
