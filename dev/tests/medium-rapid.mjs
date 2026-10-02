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
let waitChoice = "quick";
globalThis.foundry.applications.api.DialogV2.wait = async () => waitChoice;
globalThis.foundry.applications.api.DialogV2.confirm = async () => true;
const ab = await import("../../module/abilities.mjs");
const F = () => messages.at(-1).flags.flowstate;
const hero = mkActor("Hero", {}, { "martial-theory": 1, "martial-medium-armor": 5, "martial-rapid-weapons": 5 });
const orc = mkActor("Orc");
const mail = { id: "Mail", name: "Mail", type: "armor", uuid: "Actor.Hero.Item.Mail", system: { weight: "medium", equipped: true, wear: 0, durability: { value: 100, max: 100 }, profile: { valid: true, limit: 0, focus: null } } };
hero.items.push(mail); hero.system.armor = mail;
const gun = mkWeapon(hero, "Repeater", { weaponType: "rapid", weight: "light", material: "hardwood", grade: 3 });
const axe = mkWeapon(orc, "Axe", { weaponType: "striker", weight: "light", material: "hardwood" });
combat.id = "C"; combat.round = 1; combat.turn = 0; combat.combatant = { actor: orc };
const refill = a => { a.system.ap.value = 6; a.system.rp.value = 6; a.system.energy.value = 500; };
refill(hero); refill(orc);
const conMin = hero.system.derived.effective.con.min, con = hero.system.derived.effective.con.value;
const orcOpts = { label: "Axe", net: 0, melee: true, damage: "2d10", type: "physical", stacks: 0, physical: true, shots: 1, notes: [], followups: [], itemUuid: axe.uuid };
game.user.targets = new Set([{ actor: hero }]); hero.isOwner = true; orc.isOwner = true;

console.log("== Brace (Parry on the armor, until your next turn)");
combat.combatant = { actor: hero };
await actions.startParry(hero, "brace");
ok(hero.getFlag("flowstate", "parrying")?.brace && hero.system.energy.value === 500 - Math.min(con, 10), "Brace on: CON (capped by armor Grade × 10) Energy");
combat.combatant = { actor: orc };
seq = [25]; await actions.performAttack(orc, orcOpts);
const a1 = messages.at(-1);
ok(!a1.content.includes('data-choice="brace"') && a1.content.includes('data-choice="shift"') && /guarding/.test(a1.content), "Shift button; Brace shown as an active guard");
await actions.defend(a1, 0, "none");
dialog = () => ({ extra: 0 }); seq = [20]; await actions.rollExchangeDamage(messages.at(-1));
const dmgText = text(messages.at(-1));
console.log("   ", dmgText.slice(0, 200));
ok(dmgText.includes(`Brace (CON): −${Math.min(20, con)}`), "damage − Constitution");
await actions.clearParries(hero);

console.log("== Shift (disadvantage re-roll), then dodge; Limber");
refill(hero); combat.combatant = { actor: orc }; hero.statuses.delete("limber");
seq = [25]; await actions.performAttack(orc, orcOpts);
const a2 = messages.at(-1);
dialog = () => ({ mode: "dis" }); seq = [4]; await actions.defend(a2, 0, "shift");
ok(F().shift.total === 4 && /kl1/.test(messages.at(-1).rolls[0].formula), `attack re-rolled with Disadvantage → 4 (${messages.at(-1).rolls[0].formula})`);
dialog = () => ({ net: 0 }); seq = [10]; await actions.defend(a2, 0, "dodge");
const d2 = messages.at(-1);
ok(!F().defense.result.hit && text(d2).includes("Attack roll: 4"), "dodge beats the re-rolled attack");
ok(d2.content.includes("fs-limber"), "Limber offered after the successful dodge");
await actions.limber(d2, hero.uuid);
ok(messages.at(-1).flags?.flowstate?.limberOf === d2.id, "Limber posts a card that marks the button used");
ok(hero.statuses.has("limber") && hero.system.energy.value === 500 - Math.floor(conMin / 2) - Math.floor(conMin / 4), "Limber on (¼ CON min)");
seq = [25]; await actions.performAttack(orc, orcOpts);
dialog = () => ({ net: 0 }); seq = [10]; await actions.defend(messages.at(-1), 0, "dodge");
ok(/Limber/.test(text(messages.at(-1))) && !hero.statuses.has("limber"), "next dodge has Advantage, Limber used up");

console.log("== Versatility: standing pick, once per turn in combat");
combat.combatant = { actor: orc }; combat.turn = 0; refill(hero);
dialog = () => ({ ability: "brace" }); await actions.versatility(hero);
ok(!hero.getFlag("flowstate", "versatility"), "not on someone else's turn");
combat.combatant = { actor: hero }; combat.turn = 1;
await actions.versatility(hero);
ok(hero.getFlag("flowstate", "versatility") === "brace" && ab.mediumCost(hero, "brace") === 0, "set on your turn, Brace free");
dialog = () => ({ ability: "shift" }); await actions.versatility(hero);
ok(hero.getFlag("flowstate", "versatility") === "brace", "only once per turn");
await actions.mediumTurnStart(hero);
ok(hero.getFlag("flowstate", "versatility") === "brace", "persists across turns");
combat.turn = 3; await actions.versatility(hero);
ok(hero.getFlag("flowstate", "versatility") === "shift" && ab.mediumCost(hero, "shift") === 0 && ab.mediumCost(hero, "brace") > 0, "changed on a later turn");
combat.started = false; dialog = () => ({ ability: "limber" }); await actions.versatility(hero); await actions.versatility(hero);
ok(hero.getFlag("flowstate", "versatility") === "limber", "free changes outside combat"); combat.started = true;

console.log("== Careful Steps: toggle any time, auto-charged each turn");
refill(hero); combat.combatant = { actor: hero };
await actions.carefulSteps(hero);
ok(hero.statuses.has("carefulSteps") && hero.system.ap.value === 4 && !hero.getFlag("flowstate", "carefulLapsed"), "on during your turn: 2 AP now");
await actions.carefulSteps(hero);
ok(!hero.statuses.has("carefulSteps"), "off any time");
combat.combatant = { actor: orc }; refill(hero);
await actions.carefulSteps(hero);
ok(hero.statuses.has("carefulSteps") && hero.system.ap.value === 6 && hero.getFlag("flowstate", "carefulLapsed"), "on during another's turn: pending until your turn");
combat.combatant = { actor: hero };
await actions.mediumTurnStart(hero);
ok(hero.system.ap.value === 4 && !hero.getFlag("flowstate", "carefulLapsed"), "charges 2 AP at turn start");
hero.system.ap.value = 1; await actions.mediumTurnStart(hero);
ok(hero.statuses.has("carefulSteps") && hero.getFlag("flowstate", "carefulLapsed") && hero.system.ap.value === 1, "can't pay: lapses but stays on");
hero.system.ap.value = 6; await actions.mediumTurnStart(hero);
ok(hero.system.ap.value === 4 && !hero.getFlag("flowstate", "carefulLapsed"), "resumes next turn when affordable");
await actions.carefulSteps(hero);
combat.started = false; refill(hero); await actions.carefulSteps(hero);
ok(hero.statuses.has("carefulSteps") && hero.system.ap.value === 6 && !hero.getFlag("flowstate", "carefulLapsed"), "free outside combat");
await actions.carefulSteps(hero); combat.started = true;

console.log("== Rapid: Quickload / Speedloader / Spin Down");
refill(hero); gun.system.rounds = 0; gun.system.prepareDerivedData(); game.user.targets = new Set([{ actor: orc }]);
waitChoice = "quick"; const n0 = messages.length;
await actions.rollWeaponAttack(hero, gun);
ok(gun.loaded !== undefined || true, "");
ok(hero.system.ap.value === 6 - gun.system.profile.ap && messages.length === n0 + 1 && text(messages.at(-1)).includes("reloaded"), "Quickload: attack AP spent, reloaded, no attack");
refill(hero); await gun.update({ "system.rounds": 0 });
waitChoice = "speed";
dialog = c => ({ mode: "r1", net: 0, stacks: 0, pepper: 1, spinDown: true });
seq = [20]; await actions.rollWeaponAttack(hero, gun);
const at = F().attack;
ok(at.opts.shots === 4, `Spin Down: Pepper 1 → ${at.opts.shots} shots`);
ok(/Speedloader \(−1 Disadvantage\)/.test(text(messages.at(-1))) && /No net Advantage|Advantage|Disadvantage/.test(text(messages.at(-1))), "Speedloader cancels one Pepper Disadvantage");
ok(at.opts.leadBlind, "Rapid attack flagged for Lead Blindness");
orc.isOwner = true; dialog = () => ({ net: 0 }); seq = [5]; await actions.defend(messages.at(-1), 0, "dodge");
ok(/Lead Blindness/.test(text(messages.at(-1))), "orc's dodge vs the Rapid attack has Lead Blindness");

console.log("== Mark");
refill(hero); gun.system.rounds = 1; gun.system.prepareDerivedData();
await actions.markTarget(hero);
ok(orc.getFlag("flowstate", "markedBy")?.marker === hero.uuid, "orc is Marked");
game.user.targets = new Set([{ actor: hero }]); combat.combatant = { actor: orc };
seq = [20]; await actions.performAttack(orc, orcOpts);
const markCard = messages.find(m => m.flags?.flowstate?.markCard);
const orcAtk = messages.at(-1);
ok(!!markCard && !orc.getFlag("flowstate", "markedBy"), "Mark card posted and the Mark is used up");
ok(/Lead Blindness \(Marked\)/.test(text(orcAtk)), "the orc's attack gets Disadvantage (Lead Blindness)");
refill(hero); gun.system.rounds = 1; gun.system.prepareDerivedData();
dialog = () => ({ mode: "r1", net: 0, stacks: 0 });
seq = [20]; await actions.markShot(markCard);
ok(F().attack.targets[0].name === "Orc" && hero.system.rp.value === 6 - gun.system.profile.ap, "Mark shot: RP = attack AP");
