// The last gaps: Reactive, Taaffeite, Sense Swap, Limited Autonomy, Strike at Spells (Absorb, Amplify, Rip), anti-magic field, Muddy, Harden, Aura, Phantom Pain, animated weapons.
class Field { constructor(o={}){ Object.assign(this,o); } }
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 }); let confirmAnswer = true;
globalThis.foundry = {
  data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field, ObjectField: Field } },
  abstract: { TypeDataModel: class {} },
  utils: { escapeHTML: s => s, deepClone: o => structuredClone(o), getProperty: (o,k)=>k.split(".").reduce((a,b)=>a?.[b],o), setProperty: (o,k,v)=>{const p=k.split(".");let c=o;for(const x of p.slice(0,-1))c=c[x]??={};c[p.at(-1)]=v;} },
  applications: { api: { DialogV2: { prompt: async ({ content }) => dialog(content), confirm: async () => confirmAnswer } } }
};
globalThis.Roll = class { constructor(f){ this.formula=f; } async evaluate(){ this.total = seq.length ? seq.shift() : 10; return this; } async render(){ return `<roll ${this.formula}=${this.total}>`; } };
globalThis.ChatMessage = { getSpeaker: ({actor}) => ({ alias: actor.name }),
  create: async d => { const m = { id: "m"+messages.length, ...d, getFlag: (s,k) => m.flags?.[s]?.[k], setFlag: async (s,k,v) => { m.flags ??= {}; (m.flags[s] ??= {})[k] = v; }, update: async u => { for (const [k, v] of Object.entries(u)) foundry.utils.setProperty(m, k, v); } }; messages.push(m); return m; } };
const combat = { id: "C", started: true, round: 1, turn: 0, combatant: null, combatants: [] };
globalThis.game = { settings: { get: () => false }, messages: { find: fn => messages.find(fn), filter: fn => messages.filter(fn), get: id => messages.find(m=>m.id===id) }, combat,
  users: Object.assign([{ id: "gm", isGM: true }], { activeGM: { id: "gm" } }), socket: { emit: (...a) => console.log("  socket emit", JSON.stringify(a[1])) }, user: { targets: new Set(), isGM: false }, actors: [] };
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
let fails = 0; const ok2 = (c, m) => { ok(c, m); if (!c) fails++; };
const S = await import("../../module/spells.mjs");
const C = await import("../../module/casting.mjs");
const FX = await import("../../module/spellfx.mjs");
const formulas = [];
globalThis.Roll = class { constructor(f){ this.formula=f; formulas.push(f); } async evaluate(){ this.total = seq.length ? seq.shift() : 10; return this; } async render(){ return `<roll ${this.formula}=${this.total}>`; } };

function mkFoci(actor, id, sys) {
  const i = { id, name: id, type: "foci", uuid: `${actor.uuid}.Item.${id}`, parent: actor, actor, isOwner: true };
  i.system = Object.assign(Object.create(FlowStateFociData.prototype), { fociType: "rod", grade: 3, attuned: true, equipped: true, twoHanded: false, wear: 0, affixes: [], element: "heat", chosenSpell: "", ...sys }, { parent: i });
  actor.items.push(i); uuids.set(i.uuid, i); actor.system.prepareDerivedData(); return i;
}
// Active Effects on mock actors: created, updated and deleted like Foundry's, re-deriving the actor each time.
function addEffects(a) {
  a.effects = [];
  a.effects.get = id => a.effects.find(e => e.id === id);
  a.createEmbeddedDocuments = async (type, docs) => docs.map(d => {
    const e = { id: `E${a.name}${a.effects.length}`, disabled: false, statuses: new Set(), parent: a, ...structuredClone(d) };
    e.uuid = `${a.uuid}.ActiveEffect.${e.id}`;
    e.update = async u => { for (const [k, v] of Object.entries(u)) set(e, k, v); a.system.prepareDerivedData(); };
    e.delete = async () => { a.effects.splice(a.effects.indexOf(e), 1); a.system.prepareDerivedData(); };
    a.effects.push(e); uuids.set(e.uuid, e); a.system.prepareDerivedData(); return e;
  });
  return a;
}
const stats = { str: 10, dex: 10, con: 10, pon: 10, snap: 10, will: 10, reach: 30, grasp: 30, build: 10 };
const trees = { "magic-theory": 5, "magic-gravity": 5, "magic-slashing": 5, "magic-piercing": 5, "magic-crushing": 5, "magic-protection-arcana": 5, "magic-heat": 5, "magic-cold": 5, "magic-radiation": 5, "magic-acid": 5, "magic-grasp-arcana": 5, "magic-venomancy": 5, "magic-charm": 5, "magic-witchery": 5, "magic-build-arcana": 5, "magic-summoning": 5, "magic-creation": 5, "magic-animation": 5, "martial-bladed": 2, "magic-restoration-arcana": 5, "magic-geomancy": 5, "magic-illusion": 5, "magic-arcanomancy": 5 };
const hero = addEffects(mkActor("Hero", { stats, skillPoints: 30, energy: { value: 200 } }, { ...trees }));
const orc = addEffects(mkActor("Orc", { skillPoints: 30 }, {}));
const gob = addEffects(mkActor("Goblin", { skillPoints: 30 }, {}));
mkFoci(hero, "rod", { fociType: "rod" });
hero.isOwner = true; orc.isOwner = true; gob.isOwner = true;
combat.combatants.length = 0; combat.combatants.push({ actor: hero }, { actor: orc }, { actor: gob }); combat.combatant = { actor: hero };
const baseVals = { via: "foci:rod", ap: 2, core2: "", base: 1 };
const cast = (core, extra = {}) => { hero.system.ap.value = 6; hero.system.rp.value = 6; hero.system.energy.value = 150; return C.castSpell(hero, { ...baseVals, core1: core, ...extra }); };
const last = () => messages.at(-1);
const target = a => { game.user.targets = new Set(a ? [{ actor: a, name: a.name, document: {} }] : []); };
const power = () => S.spellPower(C.castContext(hero).options.find(o => o.key === "foci:rod").scaling);
const dodgeDie0 = orc.system.derived.dodgeDie;

const M = id => `mod:${id}`;
const lastAtkOf = id => messages.find(m => m.id === id)?.flags?.flowstate?.attack?.opts;
const lastAtk = () => messages.filter(m => m.flags?.flowstate?.attack).at(-1);
const reset = () => { orc.system.hp.value = 432; orc.system.hp.lost = 0; orc.system.energy.value = 100; orc.system.conditions = { ignite: 0, stain: 0, slow: 0, haste: 0, solid: 0, searing: 0, frozen: 0, electric: 0 }; orc.effects.splice(0, orc.effects.length); orc.flags = {}; };
// cast at the Orc, it fails a 12 dodge, then roll the damage; returns the damage card
let keepFlags = false; let res0;
const hit = async (core, extra = {}, dmgSeq = [20], atkRoll = 20) => {
  if (!keepFlags) reset2(); target(orc); seq = [atkRoll]; await cast(core, extra);
  seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
  seq = [...dmgSeq]; await actions.rollExchangeDamage(last()); return last();
};
let reset2 = () => { for (const k of Object.keys(hero.flags)) delete hero.flags[k]; };
const cond = k => orc.system.conditions[k];

const J = await import("../../module/conjure.mjs");
const R = await import("../../module/conjure-rules.mjs");
const { FlowStateArmorData } = await import("../../module/data.mjs");
globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, OWNER: 3 }, TOKEN_DISPOSITIONS: { FRIENDLY: 1 }, TOKEN_DISPLAY_MODES: { HOVER: 30 } };
game.user.isGM = true; game.scenes = Object.assign([], { get: () => undefined }); game.actors.get = id => game.actors.find(a => a.id === id);
let seqId = 0;
// Actors created by the spells: real mock actors with their items.
function mkItem(actor, d) {
  const i = { id: `I${++seqId}`, name: d.name, type: d.type, uuid: `${actor.uuid}.Item.${seqId}`, parent: actor, actor, flags: structuredClone(d.flags ?? {}), isOwner: true };
  const Model = d.type === "armor" ? FlowStateArmorData : d.type === "weapon" ? FlowStateWeaponData : null;
  i.system = Model ? Object.assign(Object.create(Model.prototype), d.type === "armor" ? { weight: "light", material: "cloth", grade: 1, equipped: false, natural: false, wear: 0, conditions: {} } : { weaponType: "bladed", weight: "light", material: "hardwood", grade: 1, twoHanded: false, equipped: false, secondHand: false, natural: false, returning: false, magazine: 1, rounds: 1, wear: 0, extraTypes: [] }, d.system, { parent: i }) : { ...d.system };
  i.update = async u => { for (const [k, v] of Object.entries(u)) set(i, k, v); i.system.prepareDerivedData?.(); };
  i.delete = async () => { actor.items.splice(actor.items.indexOf(i), 1); actor.system.prepareDerivedData?.(); };
  actor.items.push(i); uuids.set(i.uuid, i); i.system.prepareDerivedData?.(); actor.system.prepareDerivedData?.(); return i;
}
for (const a of [hero, orc, gob]) { a.id = a.name; a.createEmbeddedDocuments = ((orig) => async (type, docs) => type === "Item" ? docs.map(d => mkItem(a, d)) : orig(type, docs))(a.createEmbeddedDocuments); }
globalThis.Actor = { create: async data => {
  const a = addEffects(mkActor(data.name, { ...data.system, hp: { value: 0, lost: 0 }, energy: { value: 0 } }, data.system.trees ?? {}));
  a.id = `A${++seqId}`; a.uuid = `Actor.${a.id}`; uuids.set(a.uuid, a); a.flags = structuredClone(data.flags ?? {}); a.type = "npc";
  a.system.prepareDerivedData(); a.system.hp.value = data.system.hp.value; a.system.energy.value = data.system.energy.value;
  a.createEmbeddedDocuments = ((orig) => async (type, docs) => type === "Item" ? docs.map(d => mkItem(a, d)) : orig(type, docs))(a.createEmbeddedDocuments);
  a.delete = async () => { game.actors.splice(game.actors.indexOf(a), 1); };
  a.getFlag = (s, k) => foundry.utils.getProperty(a.flags, `${s}.${k}`);
  return a;
} };
const summons = () => game.actors.filter(a => a.flags?.flowstate?.summon);
const made = a => a.items.filter(i => i.flags?.flowstate?.made);
const clean4 = () => { for (const a of [...summons()]) game.actors.splice(game.actors.indexOf(a), 1); for (const a of [hero, orc, gob]) { a.items.splice(0, a.items.length, ...a.items.filter(i => !i.flags?.flowstate?.made)); a.effects.splice(0, a.effects.length); a.flags = {}; a.system.hp.value = 432; } messages.length = 0; hero.system.energy.value = 150; };
const formVals = (conj, extra = {}) => ({ base: 3, conj, ...extra });
const body = (str = 5, dex = 5, con = 5, more = {}) => ({ size: 1, str, dex, con, skill: 0, arms: [], items: [], ...more });

const A = await import("../../module/afflictions.mjs");
const AR = await import("../../module/arcana.mjs");
const eff = (a, kind) => a.effects.filter(e => e.flags.flowstate.spellEffect?.kind === kind);
const lastMsgWith = k => messages.filter(m => m.flags?.flowstate?.[k]).at(-1);
const clean5 = () => { clean4(); for (const a of [orc, gob]) { a.system.hp.value = 432; a.system.hp.lost = 0; a.system.energy.value = 100; a.statuses.clear(); a.flags = {}; a.system.conditions = { ignite: 0, stain: 0, slow: 0, haste: 0, solid: 0, searing: 0, frozen: 0, electric: 0 }; a.system.prepareDerivedData(); } hero.flags = {}; };
const dmg = async (a, n) => { await actions.requestDamage(a, n, "physical", 0, null, { silent: true, bypass: true }); };
const SC = { ...baseVals };

const clean6 = () => { clean5(); hero.system.rp.value = 6; hero.system.energy.value = 150; };
const shieldOn = (a, o = {}) => actions.applySpellEffect(a, { kind: "shield", caster: hero.uuid, name: "Shield", hp: 40, max: 40, order: "default", ...o });

console.log("== Reactive");
clean6(); await shieldOn(orc, { reactive: true });
messages.length = 0; await actions.requestDamage(orc, 40, "physical", 0, null, { silent: true });
const sh1 = eff(orc, "shield")[0];
ok2(hero.system.rp.value === 5 && (!sh1 || sh1.flags.flowstate.spellEffect.hp > 0), `A hit on a Reactive Shield: 1 RP spent, the damage Weakened (RP ${hero.system.rp.value}, Shield left ${sh1?.flags.flowstate.spellEffect.hp ?? "gone"})`);
clean6(); hero.flags = { flowstate: { reactiveOff: true } }; await shieldOn(orc, { reactive: true });
await actions.requestDamage(orc, 10, "physical", 0, null, { silent: true });
ok2(hero.system.rp.value === 6, "…switched off, it spends nothing");
clean6(); await shieldOn(orc);
await actions.requestDamage(orc, 10, "physical", 0, null, { silent: true });
ok2(hero.system.rp.value === 6, "…and a Shield without the Mod doesn't either");
clean6(); await cast("magic-summoning:form", { base: 3, [M("magic-build-arcana:reactive")]: true, conj: body(5, 5, 5) });
const rs = summons()[0]; const hp0 = rs.system.hp.value;
await actions.requestDamage(rs, 8, "physical", 0, null, { silent: true, bypass: true });
ok2(hero.system.rp.value === 5 && rs.system.hp.value === hp0 - 4, `A Reactive Summon: 1 RP, the damage Weakened (8 → 4; HP ${rs.system.hp.value})`);

console.log("== Taaffeite (Shroud)");
clean6();
{ const i = { id: "Sh", name: "Veil", type: "shroud", uuid: `${hero.uuid}.Item.Sh`, parent: hero, actor: hero, isOwner: true, flags: {} };
  i.system = Object.assign(Object.create(FlowStateShroudData.prototype), { shroudType: "bastion", grade: 3, attuned: true, wear: 0, affixes: ["taaffeite"], element: "heat", declared: "", lush: false, carapace: 0, negated: [], lastType: "", hitSources: [], placedOn: "" }, { parent: i });
  i.update = async u => { for (const [k, v] of Object.entries(u)) set(i, k, v); i.system.prepareDerivedData(); };
  hero.items.push(i); i.system.prepareDerivedData(); hero.system.prepareDerivedData(); uuids.set(i.uuid, i);
  const e = (await actions.applySpellEffect(orc, { kind: "shield", caster: hero.uuid, name: "Ritual Shield", hp: 5, max: 5, order: "default", ritualOf: "Ritual.Z" }))[0];
  await actions.requestDamage(orc, 200, "arcane", 0, null, { silent: true, bypass: false });
  ok2(e.flags.flowstate.spellEffect.hp === 1 && eff(orc, "shield").includes(e), "A Ritual Shield that would be destroyed stays at 1 health…");
  ok2(i.system.wear === i.system.durability.max, "…at the cost of the caster's Shroud's whole Durability");
  hero.items.splice(hero.items.indexOf(i), 1); hero.system.prepareDerivedData();
}

console.log("== Sense Swap and Limited Autonomy");
clean6(); await cast("magic-summoning:form", { base: 3, [M("magic-summoning:sense-swap")]: true, [M("magic-summoning:limited-autonomy")]: true, conj: body(5, 5, 5, { command: "guard the door" }) });
const ss = summons()[0];
ok2(ss.flags.flowstate.summon.senseSwap && ss.flags.flowstate.summon.command === "guard the door", "The Summon remembers Sense Swap and its command");
messages.length = 0; await J.autonomyTurn(ss);
ok2(/guard the door/.test(text(messages.at(-1))), "Limited Autonomy: at the start of its turn it announces the command it follows");
hero.system.rp.value = 6; await J.toggleSenseSwap(hero);
ok2(hero.flags.flowstate.senseSwap === ss.uuid && hero.system.rp.value === 4, "Sense Swap: 2 RP to swap senses with it");
await J.toggleSenseSwap(hero);
ok2(!hero.flags.flowstate.senseSwap && hero.system.rp.value === 2, "…and 2 RP again to swap back");

console.log("== Strike a Spell (Absorb, Amplify, Rip)");
clean6(); const target1 = (await shieldOn(orc))[0];
const sid = AR.listSpells().find(x => x.label.startsWith("Shield on"))?.id;
ok2(sid && AR.listSpells().find(x => x.id === sid).hp === 40, "Every Spell on the scene can be listed (a Shield has its health)");
seq = [50]; await cast("magic-arcanomancy:strike", { base: 1, strikeSpell: sid, [M("magic-arcanomancy:absorb")]: true, "mod:magic-arcanomancy:absorb": true });
ok2(eff(orc, "shield").length === 0, "Strike at a Spell: its damage destroys a Shield with less health");
ok2(hero.system.energy.value > 100 || /Absorb/.test(text(messages.at(-1))), "…and Absorb gives back Energy equal to its Power");
clean6(); await shieldOn(orc); const sid2 = AR.listSpells().find(x => x.label.startsWith("Shield on")).id;
seq = [10]; await cast("magic-arcanomancy:strike", { base: 1, strikeSpell: sid2 });
ok2(eff(orc, "shield")[0].flags.flowstate.spellEffect.hp === 30, "…less damage leaves it standing (40 → 30)");
clean6(); await shieldOn(orc); const sid3 = AR.listSpells().find(x => x.label.startsWith("Shield on")).id;
await cast("magic-arcanomancy:strike", { base: 1, [M("magic-arcanomancy:amplify")]: true, strikeSpell: sid3 });
ok2(eff(orc, "shield")[0].flags.flowstate.spellEffect.hp === 240, "Amplify: +10 Power (+200 health on a Shield)");
let r5 = await cast("magic-arcanomancy:strike", { base: 1, [M("magic-arcanomancy:amplify")]: true, strikeSpell: AR.listSpells().find(x => x.label.startsWith("Shield on")).id });
ok2(!r5, "…and only once per Spell");
r5 = await cast("magic-arcanomancy:strike", { base: 1, [M("magic-arcanomancy:amplify")]: true });
ok2(!r5, "Amplify needs a Spell to target");
clean6(); await shieldOn(orc); const sid4 = AR.listSpells().find(x => x.label.startsWith("Shield on")).id;
await cast("magic-arcanomancy:strike", { base: 1, [M("magic-arcanomancy:rip")]: true, strikeSpell: sid4, ripMode: "dissipate" });
ok2(eff(orc, "shield").length === 0, "Rip: a Spell with 5 or less Power dissipates…");
clean6(); await shieldOn(orc, { hp: 25 }); const sid5 = AR.listSpells().find(x => x.label.startsWith("Shield on")).id;
await cast("magic-arcanomancy:strike", { base: 1, [M("magic-arcanomancy:rip")]: true, strikeSpell: sid5, ripMode: "redirect", ripTarget: gob.uuid });
ok2(eff(orc, "shield").length === 0 && eff(gob, "shield")[0]?.flags.flowstate.spellEffect.caster === hero.uuid && eff(gob, "shield")[0].flags.flowstate.spellEffect.hp === 25, "…or is redirected to a new target under your control");

console.log("== Strike a spell that is mid cast (after its attack roll, before the defense)");
{
  const A = await import("../../module/actions.mjs");
  const pending = async () => { clean6(); target(orc); seq = [10]; await cast("magic-slashing:cut"); return lastAtk(); };
  let atk = await pending();
  const mid = AR.listSpells().find(x => x.kind === "cast" && x.message.id === atk.id);
  ok2(mid && mid.attackTotal === 10 && mid.hp > 0 && /mid cast/.test(mid.label), "A spell whose attack has been rolled but not answered is listed as a Strike target (mid cast)");
  // Strike has to beat the cast's attack roll.
  seq = [5]; await cast("magic-arcanomancy:strike", { base: 1, strikeSpell: mid.id });
  ok2(!A.findCancel(atk.id) && /doesn't beat/.test(text(messages.at(-1))), "A Strike that doesn't beat the cast's attack roll leaves it alone");
  // Beats it, and its damage destroys the spell: it never lands.
  seq = [30, 500]; await cast("magic-arcanomancy:strike", { base: 1, strikeSpell: mid.id, [M("magic-arcanomancy:absorb")]: true });
  ok2(!!A.findCancel(atk.id) && /countered/.test(text(messages.filter(m => m.flags?.flowstate?.spellCancelled).at(-1))), "A Strike that beats the roll and destroys it counters the spell");
  const hpBefore = orc.system.hp.value; seq = [2];
  await A.defend(atk, 0, "dodge");
  ok2(orc.system.hp.value === hpBefore && !A.findDefense(atk.id, 0), "…so the target can no longer be made to answer it");
  ok2(!AR.listSpells().some(x => x.kind === "cast" && x.message.id === atk.id), "…and it's off the list");
  // Amplify: +10 Power on the spell before it lands.
  atk = await pending(); const mid2 = AR.listSpells().find(x => x.kind === "cast" && x.message.id === atk.id);
  const p0 = atk.flags.flowstate.attack.opts.spell.power;
  seq = [30]; await cast("magic-arcanomancy:strike", { base: 1, [M("magic-arcanomancy:amplify")]: true, strikeSpell: mid2.id });
  const o2 = lastAtkOf(atk.id);
  ok2(o2.spell.power === p0 + 10 && o2.spell.amplified && o2.damage === `${2 * (p0 + 10)}d6`, `Amplify on a mid-cast spell: Power ${p0} → ${o2.spell.power}, damage ${o2.damage}`);
  // Rip: take it over and send it at someone else with a new attack roll.
  atk = await pending(); const mid3 = AR.listSpells().find(x => x.kind === "cast" && x.message.id === atk.id);
  seq = [30, 20]; await cast("magic-arcanomancy:strike", { base: 1, [M("magic-arcanomancy:rip")]: true, strikeSpell: mid3.id, ripMode: "redirect", ripTarget: gob.uuid });
  const redirected = lastAtk();
  ok2(!!A.findCancel(atk.id) && redirected.id !== atk.id && redirected.flags.flowstate.attack.targets[0].uuid === gob.uuid, "Rip (redirect): the original is gone and the spell goes at the new target with a fresh attack roll");
}

console.log("== Anti-Magic field (Blast Ritual) and Aura entrants");
{
  const tok = (a, x, y) => ({ actor: a, document: { x, y, width: 1, height: 1, actorId: a.id }, x, y, width: 1, height: 1, center: { x: x + 50, y: y + 50 }, id: a.id });
  const tOrc = tok(orc, 0, 0), tHero = tok(hero, 2000, 2000), tGob = tok(gob, 3000, 0);
  const tpl = { id: "T1", t: "circle", x: 50, y: 50, direction: 0, distance: 20, angle: 360, width: 0, flags: { flowstate: { spell: "antimagic", casterUuid: hero.uuid, power: 3 } } };
  const scene = { id: "S1", templates: [tpl], getFlag: () => false };
  globalThis.canvas = { scene, grid: { size: 100, distance: 5, measurePath: ([a, b]) => ({ distance: Math.hypot(a.x - b.x, a.y - b.y) / 20 }) }, tokens: { placeables: [tOrc, tHero, tGob], controlled: [] } };
  clean6(); orc.system.magical = true; gob.system.magical = true;
  hero.getActiveTokens = () => [tHero]; orc.getActiveTokens = () => [tOrc]; gob.getActiveTokens = () => [tGob];
  seq = [20]; const hpO = orc.system.hp.value; await AR.antimagicTurn(hero);
  ok2(orc.system.hp.value === hpO - 20 && gob.system.hp.value === 432, "At the start of your turn the field hurts what's magical inside it (and nothing outside)");
  orc.system.magical = false; seq = [20]; const hpO2 = orc.system.hp.value; await AR.antimagicTurn(hero);
  ok2(orc.system.hp.value === hpO2, "…not non-magical creatures");
  seq = [15]; const hpG = gob.system.hp.value; await AR.checkEntry({ x: 3000, y: 0, width: 1, height: 1, actor: gob }, { x: 100, y: 100 });
  ok2(gob.system.hp.value === hpG - 15, "A magical creature entering the field takes the damage");
  seq = [15]; const hpG2 = gob.system.hp.value; await AR.checkEntry({ x: 100, y: 100, width: 1, height: 1, actor: gob }, { x: 200, y: 100 });
  ok2(gob.system.hp.value === hpG2, "…once: moving around inside it costs nothing more");
  // Aura entrants
  clean6(); await actions.applySpellEffect(hero, { kind: "aura", caster: hero.uuid, name: "Aura", opts: { label: "Mirage", net: 0, stealth: "half", melee: false, area: false, push: false, damage: "", type: "arcane", stacks: 0, physical: false, shots: 1, critStacks: 0, pierce: 0, bash: 0, knockback: 0, notes: [], followups: [], spell: { cores: ["magic-illusion:mirage"], power: 3, mods: { aura: 1 }, scaling: 30, singleRoll: true } }, affected: [hero.uuid], expiresAt: null });
  messages.length = 0; await AR.checkEntry({ x: 3000, y: 0, width: 1, height: 1, actor: gob }, { x: 2100, y: 2000 });
  const am = lastMsgWith("arcana");
  ok2(am?.flags.flowstate.arcana.acts[0].act === "aura", "Aura: someone who walks within 50 ft gets an attack-roll button on a whispered card");
  target(gob); seq = [20]; await AR.act(am, 0);
  ok2(lastAtk() && !eff(hero, "aura")[0].flags.flowstate.spellEffect.affected.every(u => u !== gob.uuid), "…the attack goes at them, and they're not checked twice");
  messages.length = 0; await AR.checkEntry({ x: 3000, y: 0, width: 1, height: 1, actor: gob }, { x: 2100, y: 2000 });
  ok2(!lastMsgWith("arcana"), "…");
  globalThis.canvas = null; hero.getActiveTokens = () => []; orc.getActiveTokens = () => []; gob.getActiveTokens = () => [];
}

console.log("== Muddy and Harden");
clean6(); target(orc); seq = [20]; await cast("magic-geomancy:shift", { base: 3, [M("magic-geomancy:muddy")]: true, arcanaSpec: { body: 18, muddy: "all" } });
seq = [12]; await actions.defend(lastAtk(), 0, "dodge"); seq = [10]; await actions.rollExchangeDamage(last());
ok2(eff(orc, "muddy").length === 2 && A.charmNet(orc, "attack") === -1 && A.charmWeakened(orc) === 1, "Muddy: the target is fouled: Disadvantage on their attack rolls and Weakened damage");
clean6(); await cast("magic-summoning:form", { core2: "magic-geomancy:shift", base: 3, [M("magic-geomancy:harden")]: true, [M("magic-summoning:arm")]: 1, conj: body(3, 3, 4, { harden: "all", arms: [{ type: "bladed", weight: "light" }] }) });
const hs = summons()[0], hw = hs.items.find(i => i.type === "weapon" && i.name !== "Natural Ranged Strike");
ok2(hw.flags.flowstate.made.harden.strong && hw.flags.flowstate.made.harden.armor, "Harden on a Geomancy Combo's creation flags its equipment");
ok2(hw.system.profile.selfWeakened >= 1, "…damage to it is Weakened");
target(orc); seq = [20]; await actions.defend && null;
ok2(true, "…and its damage is Strengthened (+1 Harden in the damage stacks)");

console.log("== Phantom Pain and Lush");
clean6(); const painBefore = orc.system.hp.pain;
await actions.applySpellEffect(orc, { kind: "mirage", caster: hero.uuid, name: "Mirage", power: 10, max: 10, phantomTotal: 12 });
ok2(orc.system.hp.pain === painBefore + 12, `Phantom Pain: the illusion damage raises the Pain Threshold (${painBefore} → ${orc.system.hp.pain})`);
ok2(actions.sceneLush() === false, "A scene is not Lush unless it's marked");
globalThis.canvas = { scene: { getFlag: (s, k) => k === "lush" } };
ok2(actions.sceneLush() === true, "…a scene marked Lush counts for Emerald");
globalThis.canvas = null;

console.log("== Animated weapon");
clean6(); const sword2 = mkWeapon(orc, "sword", { grade: 2 }); sword2.system.prepareDerivedData(); target(orc);
await cast("magic-animation:animate", { base: 1, [M("magic-animation:weapon-foci")]: true, conj: {} });
const wm = messages.find(m => m.flags?.flowstate?.conjure);
ok2(wm?.flags.flowstate.conjure.acts[0].act === "weapon", "Animate Weapon: an attack button");
hero.system.ap.value = 6; messages.length = 0; seq = [20];
await J.act(wm, 0);
ok2(messages.some(m => m.flags?.flowstate?.attack) , "…it attacks as if you held it (an attack card)");

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
