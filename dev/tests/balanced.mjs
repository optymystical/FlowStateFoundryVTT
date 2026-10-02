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
const F = () => messages.at(-1).flags.flowstate;
const hero = mkActor("Hero", {}, { "martial-theory": 1, "martial-balanced-weapons": 4 });
const orc = mkActor("Orc"); const gob = mkActor("Goblin");
const staff = mkWeapon(hero, "Staff", { weaponType: "balanced", weight: "light", material: "hardwood", grade: 3 });
const maul = mkWeapon(hero, "Maul", { weaponType: "balanced", weight: "heavy", material: "iron", grade: 3, equipped: false });
const axe = mkWeapon(orc, "Axe", { weaponType: "striker", weight: "light", material: "hardwood" });
const refill = a => { a.system.ap.value = 6; a.system.rp.value = 6; a.system.energy.value = 200; };
refill(hero); refill(orc);
combat.combatant = { actor: hero };
const sm = ab.scalingMin(staff);

console.log("== Spin Cycle + Slice (Light)");
game.user.targets = new Set([{ actor: orc }, { actor: gob }]);
let seen = "";
dialog = c => { seen = c; return { mode: "strike", net: 0, stacks: 0, spinCycle: true, slice: "slow" }; };
seq = [20, 20]; await actions.rollWeaponAttack(hero, staff);
const a = F().attack;
ok(seen.includes("Spin Cycle") && seen.includes("Slice") && !seen.includes("Both"), "Spin Cycle and Slice offered (no Both before T5)");
ok(a.opts.area && a.targets.length === 2 && a.opts.stacks === 0, "Spin Cycle: Area on both targets, not Weakened");
ok(a.opts.sliceSlow && !a.opts.cleave && seen.includes("+1 AP") && !seen.includes('value="cleave"'), "Slice: movement option (no more Cleave)");
ok(hero.system.energy.value === 200 - 2 * sm, `energy: Spin (${sm}) + Slice (${sm})`);
refill(hero); game.user.targets = new Set([{ actor: orc }]);
dialog = () => ({ mode: "strike", net: 0, stacks: 0, slice: "pierce" });
seq = [20]; await actions.rollWeaponAttack(hero, staff);
ok(F().attack.opts.pierce === Math.floor(staff.system.profile.capped / 4) && !F().attack.opts.sliceSlow, `Slice Pierce: ${F().attack.opts.pierce}`);
{ refill(hero); dialog = () => ({ mode: "strike", net: 0, stacks: 0, slice: "slow" });
  seq = [20]; await actions.rollWeaponAttack(hero, staff);
  const ap0 = orc.system.movement.ap;
  dialog = () => ({ net: 0 }); seq = [5]; await actions.defend(messages.at(-1), 0, "dodge");
  orc.system.prepareDerivedData();
  ok(orc.statuses.has("sliced") && orc.getFlag("flowstate", "slicedBy") === hero.uuid && orc.system.movement.ap === ap0 + 1, `Slice hit: movement ${ap0} → ${orc.system.movement.ap} AP`);
  game.user.isGM = true; await actions.clearPlacedEffects(hero); game.user.isGM = false; orc.system.prepareDerivedData();
  ok(!orc.statuses.has("sliced") && orc.system.movement.ap === ap0, "Slice ends at the attacker's next turn"); }

console.log("== Slam (Heavy) + One with your Weapon");
hero.system.trees["martial-balanced-weapons"] = 5; refill(hero);
staff.system.equipped = false; staff.system.prepareDerivedData(); maul.system.equipped = true; maul.system.prepareDerivedData();
dialog = c => { seen = c; return { mode: "strike", net: 0, stacks: 0, slam: "both" }; };
seq = [20]; await actions.rollWeaponAttack(hero, maul);
ok(seen.includes("Both (One with your Weapon)"), "T5 adds Both");
ok(F().attack.opts.knockback === 5 * maul.system.profile.capped && F().attack.opts.bash, `Slam both: knockback ${F().attack.opts.knockback}, bash`);
ok(hero.system.energy.value === 200 - 2 * ab.scalingMin(maul), "Both costs double");

console.log("== Slip Off (passive with Parry), then Deflect");
maul.system.equipped = false; maul.system.prepareDerivedData(); staff.system.equipped = true; staff.system.prepareDerivedData();
combat.combatant = { actor: hero }; refill(hero); hero.isOwner = true;
await actions.startParry(hero, staff.id);
combat.combatant = { actor: orc }; game.user.targets = new Set([{ actor: hero }]); refill(hero);
const orcOpts = { label: "Axe", net: 0, melee: true, damage: "2d10", type: "physical", stacks: 0, physical: true, shots: 1, notes: [], followups: [{ kind: "fast", itemId: axe.id, net: -1, label: "Fast follow-up" }], itemUuid: axe.uuid };
seq = [25]; await actions.performAttack(orc, orcOpts);
const atk = messages.at(-1);
ok(/Slip Off/.test(atk.content), "attack card notes the Slip Off guard");
const w0 = staff.system.wear;
await actions.defend(atk, 0, "none");
const def = messages.at(-1);
dialog = () => ({ extra: 0 }); seq = [4]; await actions.rollExchangeDamage(def);   // small hit: the staff's Limit takes it all
const dmg = messages.find(m => m.flags?.flowstate?.damage?.defenseMessage === def.id);
console.log("   ", text(dmg).slice(0, 220));
ok(/Slip Off/.test(text(dmg)) && dmg.content.includes("fs-deflect") && dmg.content.includes("fs-riposte"), "Weakened by Slip Off; Deflect and Riposte offered");
ok(staff.system.wear > w0, "staff took the wear");
await actions.postReadyFollowups(atk);
ok(!messages.some(m => m.flags?.flowstate?.followupCard === atk.id), "follow-up waits for the Riposte decision");
await actions.declineRiposte(dmg); await actions.postReadyFollowups(atk);
ok(messages.some(m => m.flags?.flowstate?.followupCard === atk.id), "after passing, the attacker's follow-up appears");
refill(hero);
seq = [22]; await actions.deflect(dmg);
const df = F().attack;
ok(df.opts.deflectOf === dmg.id && df.targets[0].name === "Orc" && df.opts.damage === "2d10" && hero.system.rp.value === 5, "Deflect: 1 RP, the orc's own attack sent back at the orc");
await actions.deflect(dmg);
console.log("== Big hit: no Deflect");
seq = [25]; await actions.performAttack(orc, { ...orcOpts, followups: [] });
await actions.defend(messages.at(-1), 0, "none"); refill(hero);
dialog = () => ({ extra: 0 }); seq = [200]; await actions.rollExchangeDamage(messages.at(-1));
ok(!messages.at(-1).content.includes("fs-deflect") && !messages.at(-2).content.includes("fs-deflect"), "damage got past the staff: no Deflect");
