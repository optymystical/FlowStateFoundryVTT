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

const { FlowStateActorData, FlowStateWeaponData, FlowStateShroudData, FlowStateFociData } = await import("../../module/data.mjs");
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

const M = await import("../../module/magic.mjs");
let fails = 0; const ok2 = (c, m) => { ok(c, m); if (!c) fails++; };
function mkShroud(actor, id, sys) {
  const i = { id, name: id, type: "shroud", uuid: `${actor.uuid}.Item.${id}`, parent: actor, actor, isOwner: true };
  i.system = Object.assign(Object.create(FlowStateShroudData.prototype), { shroudType: "bastion", grade: 3, attuned: true, wear: 0, affixes: [], element: "heat", declared: "", lush: false, carapace: 0, negated: [], lastType: "", hitSources: [], placedOn: "", ...sys }, { parent: i });
  i.update = async u => { for (const [k,v] of Object.entries(u)) set(i, k, v); actor.system.prepareDerivedData(); };
  actor.items.push(i); uuids.set(i.uuid, i); actor.system.prepareDerivedData(); return i;
}
const prep = a => a.system.prepareDerivedData();

console.log("== Profiles");
let p = M.fociProfile({ fociType: "staff", grade: 3, affixes: ["quartz", "agate"] }, { reach: 40, grasp: 25 });
ok2(p.valid && p.durability === 90 && p.limit === 18 && p.scalingStat === "grasp" && p.scaling === 25 && p.castAP === "2" && p.freeAffixes === 0 && p.twoHandCast, "Staff: Igniter, base × Grade, Grasp, no extra Free Affixes");
p = M.fociProfile({ fociType: "band", grade: 2 }, { reach: 12, grasp: 30 });
ok2(p.scalingStat === "reach" && p.scaling === 12 && p.affixPlus && p.tr === null, "Band: Multi uses the lesser stat, 1+ Affix");
p = M.shroudProfile({ shroudType: "bastion", grade: 3, affixes: [] }, 25);
ok2(p.durability === 100 && p.limit === 20 && p.mult === 2, "Bastion: ×floor(Build/10) Grade-capped");
p = M.shroudProfile({ shroudType: "aegis", grade: 5 }, 50);
ok2(p.durability === 3 && p.limit === 60 && p.negator, "Aegis: fixed Durability, scaling Limit");

console.log("== Shroud soaks before armor");
const hero = mkActor("Mage", {}, {});   // Build 10 + bonus
const b = hero.system.derived.effective.build.value;
const mult = Math.max(1, Math.floor(Math.min(b, 30) / 10));
const sh = mkShroud(hero, "Veil", { shroudType: "bastion", grade: 3 });
ok2(hero.system.shroud === sh && sh.system.profile.limit === 10 * mult, `melded Shroud found (Limit ${sh.system.profile.limit})`);
let out = await actions.damageOutcome(hero, 25, "physical", {});
ok2(out.toHp === 25 - 10 * mult && out.shrouds[0].update["system.wear"] === 10 * mult, `Shroud absorbs its Limit (${25 - out.toHp})`);
out = await actions.damageOutcome(hero, 25, "supernatural", {});
ok2(out.toHp === 25 && !out.shrouds.length, "Supernatural isn't blocked");
out = await actions.damageOutcome(hero, 25, "arcane", {});
ok2(out.toHp === 25 - 10 * mult, "Arcane (Magical) is blocked");
out = await actions.damageOutcome(hero, 25, "physical", { pierce: 5 });
ok2(out.toHp === 25 - (10 * mult - 5), "Pierce lowers the Shroud's Limit");
await sh.update({ "system.affixes": ["painite", "jasper"] });
out = await actions.damageOutcome(hero, 25, "physical", { pierce: 5 });
ok2(out.toHp === Math.max(0, 25 - sh.system.profile.scaling - 10 * mult) && out.shrouds[0].update["system.negated"]?.includes("physical"), `Bastion holds 2 Affixes: Jasper negates ${sh.system.profile.scaling}, Painite ignores Pierce (toHp ${out.toHp})`);
await sh.update({ "system.negated": ["physical"] });
out = await actions.damageOutcome(hero, 25, "physical", {});
ok2(out.toHp === 25 - 10 * mult, "Jasper only once until recovery");
await actions.applyDamage(hero, 25, "physical", { silent: true });
ok2(sh.system.wear === 10 * mult && hero.getFlag("flowstate", "takenTypes")?.includes("physical"), "applyDamage wears the Shroud and records the type");

console.log("== Force damage cap: HP plus what the Shroud soaks, netting negative max HP at most");
await sh.update({ "system.affixes": [], "system.negated": [], "system.wear": 0 });
const hpNow = hero.system.hp.value + hero.system.hp.max;
const cap = await actions.forceCap(hero);
ok2(cap === hpNow + 10 * mult, `Cap = HP + max HP ${hpNow} + the Shroud's Limit ${10 * mult} = ${cap} (not just HP)`);
out = await actions.damageOutcome(hero, cap, "physical", {});
ok2(out.toHp === hpNow, "Taking the capped damage nets them to exactly negative max HP");
out = await actions.damageOutcome(hero, cap + 1, "physical", {});
ok2(out.toHp > hpNow, "One more point would go past negative max HP");

console.log("== Shrouds recover by themselves out of combat");
await sh.update({ "system.wear": 30, "system.negated": ["physical"] });
await actions.refillShroud(hero);
ok2(sh.system.wear === 30, "In combat nothing recovers until the wearer's turn");
const ci = combat.combatants.findIndex(c => c.actor === hero); combat.combatants.splice(ci, 1);
await actions.refillShroud(hero);
ok2(sh.system.wear === 0 && !(sh.system.negated ?? []).length, "Out of combat the Shroud recovers fully (and Affix negations refresh)");
await sh.update({ "system.wear": 30 });
await actions.applyDamage(hero, 5, "physical", { silent: true });
ok2(sh.system.wear === 0, "A hit out of combat is absorbed, then the Shroud recovers right away");
M.SHROUD_TYPES.bastion.noRegen = true; await sh.update({ "system.wear": 30 }); sh.system.prepareDerivedData?.();
await actions.refillShroud(hero);
ok2(sh.system.wear === 30, "A Shroud whose passive says it doesn't naturally recover is left alone");
delete M.SHROUD_TYPES.bastion.noRegen;
combat.combatants.push({ actor: hero });
await sh.update({ "system.affixes": ["painite", "jasper"], "system.negated": ["physical"], "system.wear": 10 * mult });   // back to what the next checks expect

console.log("== Recovery at turn start");
await actions.shroudTurnStart(hero);
ok2(sh.system.wear === 0 && !sh.system.negated.length && !hero.getFlag("flowstate", "takenTypes"), "recovers its Limit, negations refresh, Cinder memory clears");

console.log("== Types");
await sh.update({ "system.shroudType": "aegis", "system.affixes": [] });
out = await actions.damageOutcome(hero, 5, "physical", {});
ok2(out.toHp === 0 && out.shrouds[0].update["system.wear"] === 1, "Aegis negates damage up to its Limit for 1 Durability");
out = await actions.damageOutcome(hero, 500, "physical", {});
ok2(out.toHp === 500 && !out.shrouds.length, "Aegis: over the Limit isn't blocked");
await sh.update({ "system.shroudType": "cinder" });
const L0 = sh.system.profile.limit;
await hero.setFlag("flowstate", "takenTypes", ["heat"]);
out = await actions.damageOutcome(hero, 200, "heat", {});
ok2(200 - out.toHp === L0 * 3, `Cinder ×3 against a type already taken (${200 - out.toHp})`);
await hero.unsetFlag("flowstate", "takenTypes");
await sh.update({ "system.shroudType": "carapace" });
const cl = sh.system.profile.limit;
await actions.applyDamage(hero, 200, "physical", { silent: true });
ok2(sh.system.carapace === 1 && sh.system.profile.limit === 2 * cl, "Carapace: Limit grows each hit");
await actions.shroudTurnStart(hero);
ok2(sh.system.carapace === 0 && sh.system.profile.limit === cl, "Carapace resets at turn start");
hero.system.energy.value = hero.system.energy.max; await sh.update({ "system.shroudType": "cistern" });
ok2(sh.system.profile.limit === 3 * sh.system.profile.baseLimit, "Cistern ×3 at full Energy");
await sh.update({ "system.shroudType": "bastion", "system.affixes": ["tourmaline", "alexandrite"], "system.element": "heat", "system.wear": 0 });
out = await actions.damageOutcome(hero, 200, "heat", {});
ok2(out.shrouds[0].update["system.wear"] === Math.floor(10 * mult / 2) && out.shrouds[0].update["system.lastType"] === "heat", "Tourmaline: chosen element Weakened on the Shroud; Alexandrite remembers the type");
await sh.update({ "system.lastType": "heat" });
out = await actions.damageOutcome(hero, 200, "heat", {});
ok2(out.lines.some(l => /Alexandrite: Weakened 200 → 100/.test(l)), "Alexandrite: same type again is Weakened");

console.log("== Ward on an ally");
const ally = mkActor("Ally", {}, {});
await sh.update({ "system.shroudType": "ward", "system.affixes": [], "system.lastType": "" });
game.user.targets = new Set([{ actor: ally }]); hero.system.rp.value = 6;
await actions.placeShroud(hero);
ok2(sh.system.placedOn === ally.uuid && ally.getFlag("flowstate", "shroudOn") === sh.uuid && hero.system.rp.value === 4, "Ward placed on the ally (2 RP)");
out = await actions.damageOutcome(ally, 50, "physical", {});
ok2(out.toHp < 50, "the ally's damage is soaked by the Ward");
out = await actions.damageOutcome(hero, 50, "physical", {});
ok2(out.toHp === 50, "the wearer isn't protected by a Ward placed elsewhere");
await actions.shroudTurnStart(hero);
ok2(!sh.system.placedOn && !ally.getFlag("flowstate", "shroudOn"), "the Ward ends at the start of the wearer's turn");

console.log("== Musgravite / Black Opal");
await sh.update({ "system.shroudType": "bastion", "system.affixes": ["musgravite", "blackOpal"] });
ok2(actions.musgraviteNegate(hero) === sh.system.profile.scaling, "Musgravite negates Scaling Stat Force");
ok2(actions.shroudAttackNet(ally, hero, { melee: true }) === -1, "Black Opal: Disadvantage for attackers in melee range");

console.log("== Exchange: Retort, Riposte, Ruby");
const foe = mkActor("Foe", {}, {});
const axe = mkWeapon(foe, "Axe", { weaponType: "bladed", weight: "light", material: "iron", grade: 3 });
const fo = { label: "Axe", net: 0, melee: true, damage: "2d10", type: "physical", stacks: 0, physical: true, shots: 1, notes: [], followups: [], itemUuid: axe.uuid, targetActors: [hero] };
await sh.update({ "system.shroudType": "retort", "system.affixes": [], "system.wear": 0 });
hero.system.rp.value = 6;
seq = [30]; await actions.performAttack(foe, fo);
dialog = () => ({ net: 0, extra: 0 }); await actions.defend(messages.at(-1), 0, "none");
const dm = messages.at(-1);
ok2(dm.content.includes("fs-retort"), "Retort offered after a hit");
await actions.retort(dm);
ok2(hero.system.rp.value === 5 && actions.findRetort(dm.id), "Retort: 1 RP");
seq = [20]; await actions.rollExchangeDamage(dm);
ok2(/Retort/.test(text(messages.at(-1))), "Retort Weakens the damage");
await sh.update({ "system.shroudType": "riposte", "system.affixes": ["ruby"], "system.wear": 0 });
seq = [30]; await actions.performAttack(foe, fo);
await actions.defend(messages.at(-1), 0, "none");
seq = [20]; await actions.rollExchangeDamage(messages.at(-1));
const dmg = messages.at(-1);
ok2(dmg.content.includes('data-kind="riposte"') && dmg.content.includes('data-kind="ruby"'), "damage card offers Shroud Riposte and Ruby");
const took = Number(dmg.content.match(/data-kind="ruby" data-amount="(\d+)"/)?.[1]);
seq = [25]; await actions.shroudCounter(dmg, "ruby", took);
const ra = messages.at(-1);
ok2(ra.flags.flowstate.attack.opts.inflict?.ignite === took, "Ruby: free attack carrying the Ignite");
const ig0 = foe.system.conditions.ignite;
dialog = () => ({ net: 0 }); seq = [2]; await actions.defend(ra, 0, "dodge");
ok2(foe.system.conditions.ignite === ig0 + took, `Ruby hit: +${took} Ignite`);
await actions.shroudCounter(dmg, "ruby", took);

console.log("== Durability caps the soak");
await sh.update({ "system.shroudType": "bastion", "system.affixes": [], "system.placedOn": "" });
await sh.update({ "system.wear": sh.system.durability.max - 3 });
out = await actions.damageOutcome(hero, 40, "physical", {});
ok2(out.toHp === 37 && out.shrouds[0].update["system.wear"] === sh.system.durability.max, `Shroud with 3 Durability left absorbs only 3 (toHp ${out.toHp})`);
await sh.update({ "system.wear": sh.system.durability.max });
out = await actions.damageOutcome(hero, 40, "physical", {});
ok2(out.toHp === 40, "at 0 Durability it stops blocking");
{ const { soak } = await import("../../module/martial.mjs");
  const r = soak(40, "physical", { valid: true, limit: 40 }, { durability: 20 });
  ok2(r.absorbed === 20 && r.toHp === 20, "armor soak: Limit 40, Durability 20 → 20 through"); }
console.log("== Edge distance");
globalThis.canvas = { grid: { size: 100, distance: 5 } };
const T = (x, y, w = 1) => ({ document: { x, y, width: w, height: w } });
ok2(actions.tokenDistance(T(0, 0), T(100, 0)) === 0 && actions.tokenDistance(T(0, 0), T(100, 100)) === 0, "touching tokens (side or diagonal) are 0 ft apart");
ok2(actions.tokenDistance(T(0, 0), T(200, 0)) === 5 && actions.tokenDistance(T(0, 0), T(25, 25, 0.25)) === 0, "one square gap = 5 ft; a small token inside reach");
ok2(actions.tokenDistance(T(0, 0, 2), T(300, 0)) === 5, "large tokens measure from their border");
globalThis.canvas = null;
process.exit(fails ? 1 : 0);
