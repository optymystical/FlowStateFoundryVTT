// Mock just enough of Foundry to drive the attack exchange end to end.
class Field { constructor(o={}){ Object.assign(this,o); } }
let seq = [];                // queued die totals for the next rolls
const messages = [];
const uuids = new Map();
globalThis.foundry = {
  data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field } },
  abstract: { TypeDataModel: class {} },
  utils: { escapeHTML: s => s, deepClone: o => structuredClone(o), getProperty: (o,k)=>k.split(".").reduce((a,b)=>a?.[b],o) },
  applications: { api: { DialogV2: { prompt: async ({ content }) => content.includes('name="extra"') ? { extra: 1 } : { net: 0 } } } }
};
globalThis.Roll = class { constructor(f){ this.formula=f; } async evaluate(){ this.total = seq.length ? seq.shift() : 10; return this; } async render(){ return `<roll ${this.formula}=${this.total}>`; } };
globalThis.ChatMessage = { getSpeaker: ({actor}) => ({ alias: actor.name }),
  create: async d => { const m = { id: "m"+messages.length, ...d, getFlag: (s,k) => d.flags?.[s]?.[k] }; messages.push(m); return m; } };
let autoDmg = false;
globalThis.game = { settings: { get: (s, k) => k === "autoDamage" ? autoDmg : true }, messages: { find: fn => messages.find(fn), filter: fn => messages.filter(fn), get: id => messages.find(m=>m.id===id) }, combat: null,
  users: { activeGM: { id: "gm" } }, socket: { emit: (...a) => console.log("  socket emit", JSON.stringify(a[1])) }, user: { targets: new Set() } };
globalThis.ui = { notifications: { warn: m => console.log("  WARN", m), info: m => console.log("  INFO", m), error: m => console.log("  ERR", m) } };
globalThis.fromUuid = async u => uuids.get(u); globalThis.fromUuidSync = u => uuids.get(u);

const { FlowStateActorData } = await import("../../module/data.mjs");
const actions = await import("../../module/actions.mjs");
function mkActor(name, isOwner, extra={}) {
  const a = { name, uuid: "Actor."+name, isOwner, items: [], statuses: new Set(), updates: [] };
  a.update = async u => { a.updates.push(u); };
  a.system = Object.assign(Object.create(FlowStateActorData.prototype), { stats:{str:10,dex:10,con:10,pon:10,snap:10,will:10,reach:10,grasp:10,build:10}, skillPoints:30, size:3, hp:{value:432,lost:0}, energy:{value:0}, ap:{value:6}, rp:{value:6}, conditions:{ignite:0,stain:0,slow:0,haste:0}, lift:0, daysWithoutRest:0, ...extra }, { parent: a });
  a.system.prepareDerivedData(); uuids.set(a.uuid, a); return a;
}
const hero = mkActor("Hero", true), orc = mkActor("Orc", false);
game.user.targets = new Set([{ actor: orc }]);

// A generic attack: 2d10 physical, +1 Strengthened from the attack itself.

const opts = { label: "Test Strike", net: 0, stealth: "none", melee: true, push: false, damage: "2d10", type: "physical", stacks: 1, physical: true, shots: 1, critStacks: 0, pierce: 0, knockback: 0, notes: [], followups: [] };
const text = m => m.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

console.log("== Case 1: dodge, attack 25 vs dodge 12 -> crit (25 >= 24)");
seq = [25];                                   // attack roll
await actions.performAttack(hero, opts);
const atkMsg = messages.at(-1);
console.log(" attack card has Dodge/Take buttons:", atkMsg.content.includes("fs-defend"), "| targets:", JSON.stringify(atkMsg.flags.flowstate.attack.targets));
orc.isOwner = true;                            // the GM (owner of the orc) responds
seq = [12];
await actions.defend(atkMsg, 0, "dodge");
const def1 = messages.at(-1);
console.log(" defense:", text(def1).slice(0, 140));
console.log(" result flag:", JSON.stringify(def1.flags.flowstate.defense.result));
await actions.defend(atkMsg, 0, "none");      // second response is blocked
hero.isOwner = true; orc.isOwner = false;     // back on the player's client
seq = [14];                                   // damage roll 14; stacks: +1 attack, +1 added, +2 crit = +4 -> x3 = 42
await actions.rollExchangeDamage(def1);
console.log(" damage card:", text(messages.at(-1)).slice(0, 200));
await actions.rollExchangeDamage(def1);       // second roll is blocked

console.log("== Case 2: take the hit (no crit even with a huge attack)");
seq = [30]; await actions.performAttack(hero, opts);
const atk2 = messages.at(-1); orc.isOwner = true;
await actions.defend(atk2, 0, "none");
console.log(" defense:", JSON.stringify(messages.at(-1).flags.flowstate.defense.result));

console.log("== Case 3: dodge succeeds -> miss, no damage button");
seq = [8]; await actions.performAttack(hero, opts);
const atk3 = messages.at(-1); seq = [15];
await actions.defend(atk3, 0, "dodge");
console.log(" outcome:", messages.at(-1).flags.flowstate.defense.result.outcome, "| has damage button:", messages.at(-1).content.includes("fs-roll-damage"));

console.log("== Case 4: full stealth -> resolves immediately, no defender step");
const before = messages.length;
seq = [30]; await actions.performAttack(hero, { ...opts, stealth: "full" });
console.log(" messages posted:", messages.length - before, "| outcome:", messages.at(-1).flags.flowstate.defense.result.outcome);

console.log("== Case 5: no targets -> single card as before");
game.user.targets = new Set(); seq = [20, 9];
await actions.performAttack(hero, opts);
console.log(" ", text(messages.at(-1)).slice(0, 160));

console.log("== Case 6: auto damage on -> hit rolls and applies damage with no button");
autoDmg = true; game.user.targets = new Set([{ actor: orc }]);
seq = [20]; await actions.performAttack(hero, opts);
const atk6 = messages.at(-1); orc.isOwner = true; hero.isOwner = false;   // defender's client responds
const n6 = messages.length;
seq = [5, 12];                                  // dodge 5 -> crit, damage 12
await actions.defend(atk6, 0, "dodge");
const cards = messages.slice(n6);
console.log(" cards:", cards.map(m => text(m).slice(0, 70)).join(" || "));
console.log(" defense card has button:", cards[0].content.includes("fs-roll-damage"), "| damage card linked:", cards[1]?.flags?.flowstate?.damage?.defenseMessage === cards[0].id);
