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

const hero = mkActor("Hero", {}, { "martial-theory": 3 });
const orc = mkActor("Orc", {}, {});
const sword = mkWeapon(hero, "Sword", {});
const fists = mkWeapon(orc, "Fists", { weaponType: "unarmed", weight: "light", material: "", equipped: true });
const club = mkWeapon(orc, "Club", { weaponType: "weighted", weight: "heavy", material: "iron", equipped: false });
combat.combatant = { actor: orc };

console.log("== Parry is a stance: Hero turns it on during their turn");
combat.combatant = { actor: hero };
const e0 = hero.system.energy.value;
await actions.startParry(hero, sword.id);
ok(hero.getFlag("flowstate", "parrying")?.[sword.id]?.style === "parry", "Parry active on the Sword");
ok(hero.system.energy.value === e0 - sword.system.profile.capped, `Energy = Scaling Stat (${sword.system.profile.capped})`);
combat.combatant = { actor: orc };
game.user.targets = new Set([{ actor: hero }]);
const opts = { label: "Punch", net: 0, stealth: "none", melee: true, damage: "2d10", type: "physical", stacks: 0, physical: true, shots: 1, notes: [], followups: [] };
seq = [20]; await actions.performAttack(orc, opts);
const atk = messages.at(-1);
ok(!atk.content.includes('data-choice="parry"') && /guarding/.test(atk.content), "no Parry button; the card notes the guard");
console.log("== Hit for 10: the Sword's Limit (6) soaks, 4 gets through, no Riposte");
dialog = () => ({ net: 0, extra: 0 });
await actions.defend(atk, 0, "none");
seq = [10]; await actions.rollExchangeDamage(messages.at(-1));
ok(sword.system.wear === 6 && !messages.at(-1).content.includes("fs-riposte"), `sword wore ${sword.system.wear}; HP damage taken, no Riposte`);
console.log("== Hit for 5: fully soaked → Riposte on the damage card");
seq = [20]; await actions.performAttack(orc, opts);
await actions.defend(messages.at(-1), 0, "none");
seq = [5]; await actions.rollExchangeDamage(messages.at(-1));
const dmg = messages.at(-1);
ok(dmg.content.includes("fs-riposte") && dmg.flags.flowstate.damage.riposte, "Riposte offered");
console.log("== Riposte: RP = sword AP, targets orc, once only");
dialog = c => ({ mode: "strike", net: 0, stealth: "none", stacks: 0 });
const rp0 = hero.system.rp.value;
seq = [15]; await actions.riposte(dmg, { itemUuid: sword.uuid });
const rip = messages.at(-1);
ok(rip.flags.flowstate.followupOf === dmg.id, "linked to the damage card");
ok(rip.flags.flowstate.attack.targets[0].name === "Orc", "targets the attacker");
ok(hero.system.rp.value === rp0 - sword.system.profile.ap, `RP ${rp0} -> ${hero.system.rp.value}`);
await actions.riposte(dmg, { itemUuid: sword.uuid });
console.log("== Dodging while parrying gives no Riposte");
seq = [20]; await actions.performAttack(orc, opts);
dialog = () => ({ net: 0 }); seq = [5];
await actions.defend(messages.at(-1), 0, "dodge");
ok(!messages.at(-1).content.includes("fs-riposte"), "dodged: no Riposte");
await actions.clearParries(hero);
ok(!hero.getFlag("flowstate", "parrying"), "Parry ends at the start of the next turn");

console.log("== Grapple: orc light unarmed grapple on hero");
dialog = c => ({ weight: "light", mode: "strike", net: 0, stealth: "none", stacks: 0, grapple: true });
seq = [30]; await actions.rollWeaponAttack(orc, fists);
const g = messages.at(-1);
ok(g.flags.flowstate.attack.opts.grapple && g.flags.flowstate.attack.opts.grappleOnly, "grapple-only flagged");
dialog = () => ({ net: 0 }); seq = [5];
await actions.defend(g, 0, "dodge");
ok(hero.statuses.has("grappled") && hero.getFlag("flowstate","grappledBy") === orc.uuid, "hero grappled by orc");
ok(!messages.at(-1).content.includes("fs-roll-damage"), "light grapple: no damage button");
ok(actions.grappledBy(orc)[0] === hero, "grappledBy lists hero");

console.log("== Break free: miss then hit");
combat.combatant = { actor: hero }; hero.system.ap.value = 6;
seq = [3]; await actions.breakFree(hero);
seq = [30]; await actions.defend(messages.at(-1), 0, "dodge");
ok(hero.statuses.has("grappled"), "still grappled after miss");
ok(!messages.at(-2).content.includes('data-choice="parry"'), "no parry vs break free");
seq = [40]; await actions.breakFree(hero);
await actions.defend(messages.at(-1), 0, "none");
ok(!hero.statuses.has("grappled") && !hero.getFlag("flowstate","grappledBy"), "free after hit");
ok(hero.system.ap.value === 2, `AP 6 -> ${hero.system.ap.value}`);

console.log("== Throw grappled creature: hero grapples orc, throws at goblin");
const gob = mkActor("Goblin");
await actions.setGrapple(orc, hero.uuid);
hero.system.ap.value = 6;
game.user.targets = new Set([{ actor: gob }]);
dialog = () => ({ net: 0 });
seq = [25]; await actions.throwGrappled(hero);
const th = messages.at(-1);
console.log("  force", th.flags.flowstate.attack.opts.throwForce, "|", text(th).slice(0, 120));
ok(!th.content.includes('data-choice="parry"'), "no parry vs creature throw");
const orcHp = orc.system.hp.value, gobHp = gob.system.hp.value;
seq = [5]; await actions.defend(th, 0, "dodge");
console.log("  ", text(messages.at(-1)).slice(0, 400));
ok(!orc.statuses.has("grappled"), "orc released");
console.log(`   orc HP ${orcHp} -> ${orc.system.hp.value}, goblin HP ${gobHp} -> ${gob.system.hp.value}`);

console.log("== Stances");
hero.system.ap.value = 6; combat.combatant = { actor: hero };
const e1 = hero.system.energy.value;
await actions.useStance(hero, "psych");
ok(hero.statuses.has("psychedUp") && hero.system.energy.value === e1 - 15, "psych up on, 15 energy (30 SP / 2)");
await actions.useStance(hero, "psych");
await actions.useStance(hero, "calm");
ok(hero.statuses.has("calmedDown"), "calm down on (tier 3)");
await actions.useStance(orc, "psych");
combat.combatant = { actor: orc };
game.user.targets = new Set([{ actor: hero }]);
seq = [20]; await actions.performAttack(orc, opts);
console.log("  ", text(messages.at(-1)).slice(0, 120));
await actions.clearStances(hero);
ok(!hero.statuses.has("psychedUp") && !hero.statuses.has("calmedDown"), "stances cleared");
