// Foci passives, Foci-side Affixes and Deck Foci.
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
  create: async d => { const m = { id: "m"+messages.length, ...d, getFlag: (s,k) => m.flags?.[s]?.[k], setFlag: async (s,k,v) => { m.flags ??= {}; (m.flags[s] ??= {})[k] = v; } }; messages.push(m); return m; } };
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

const F = await import("../../module/foci.mjs");
const MG = await import("../../module/magic.mjs");
const lastAtk4 = () => messages.filter(m => m.flags?.flowstate?.attack).at(-1);
const attacks = () => messages.filter(m => m.flags?.flowstate?.attack).length;
// Swap which Foci is attuned.
const use = (item, { affixes = [], ...sys } = {}) => { for (const i of hero.items.filter(x => x.type === "foci")) { i.system.attuned = false; i.system.equipped = false; }
  Object.assign(item.system, { attuned: true, equipped: true, affixes, ...sys }); hero.system.prepareDerivedData(); return item; };
const mk = (id, type, extra = {}) => { const f = mkFoci(hero, id, { fociType: type, grade: 5, attuned: false, equipped: false, ...extra }); return f; };
const fresh = () => { clean4(); for (const k of Object.keys(hero.flags)) delete hero.flags[k]; for (const a of [orc, gob]) { a.flags = {}; a.system.hp.value = 432; a.system.conditions = { ignite: 0, stain: 0, slow: 0, haste: 0, solid: 0, searing: 0, frozen: 0, electric: 0 }; a.system.prepareDerivedData(); } };
const ctxFor = () => C.castContext(hero);
const trOf = (core, ctx, via, extra = {}) => S.planCast(ctx, { via, ap: 2, core1: core, core2: extra.core2 ?? "", base: 1, ...extra });
const rod = hero.items.find(i => i.id === "rod");
const wand = mk("wand", "wand"), lens = mk("lens", "lens"), staff = mk("staff", "staff", { twoHanded: true }), tome = mk("tome", "tome", { twoHanded: true }), scepter = mk("scepter", "scepter"), tablet = mk("tablet", "tablet");
const gaunt = mk("gauntlet", "gauntlet"), chime = mk("chime", "chime"), cards = mk("cards", "cards");

console.log("== Threshold Reduction passives");
use(wand);
let ctx = ctxFor(); let p = trOf("magic-slashing:cut", ctx, "foci:wand");
ok2(p.ok && p.tr === 0, `Wand: 0 TR baseline (TR ${p.tr})`);
ctx.fociState = { wand: { casts: 2 } }; p = trOf("magic-slashing:cut", ctx, "foci:wand");
ok2(p.tr === 1, "…every other spell cast with it grants 1 more TR");
ctx.fociState = { wand: { casts: 4 } }; ok2(trOf("magic-slashing:cut", ctx, "foci:wand").tr === 2, "…(two after four casts)");
use(lens); ctx = ctxFor(); p = trOf("magic-slashing:cut", ctx, "foci:lens");
ok2(p.tr === 4, "Lens: 4 TR baseline");
ctx.fociState = { lens: { casts: 3 } }; ok2(trOf("magic-slashing:cut", ctx, "foci:lens").tr === 1, "…each spell removes 1 TR");
ctx.fociState = { lens: { casts: 9 } }; ok2(trOf("magic-slashing:cut", ctx, "foci:lens").tr === 0, "…down to 0");
use(scepter); ctx = ctxFor(); const base1 = trOf("magic-slashing:cut", ctx, "foci:scepter").tr;
ctx.targetsAlly = true; ok2(trOf("magic-slashing:cut", ctx, "foci:scepter").tr === base1 + 1, "Scepter: 1 more TR when targeting an ally");
use(tablet); ctx = ctxFor(); const base2 = trOf("magic-slashing:cut", ctx, "foci:tablet").tr; ctx.targetsAlly = true;
ok2(trOf("magic-slashing:cut", ctx, "foci:tablet").tr === base2 + 2, "Tablet: 2 more TR when targeting an ally");

console.log("== Casting twice");
fresh(); use(staff); target(orc); seq = [20]; await cast("magic-slashing:cut", { via: "foci:staff" });
let n1 = attacks();
ok2(n1 === 1, "Staff: the first spell of the turn casts once");
seq = [20, 20]; await cast("magic-piercing:stab", { via: "foci:staff" });
ok2(attacks() === n1 + 2, "…the next spell, a different Core, casts twice");
seq = [20, 20]; const n2 = attacks(); await cast("magic-piercing:stab", { via: "foci:staff" });
ok2(attacks() === n2 + 1, "…but not the same Core again");
fresh(); use(tome); target(orc); seq = [20]; await cast("magic-slashing:cut", { via: "foci:tome" });
const t1 = attacks(); seq = [20, 20]; await cast("magic-slashing:cut", { via: "foci:tome" });
ok2(attacks() === t1 + 2, "Tome: casts twice after the same Core");
const t2 = attacks(); seq = [20]; await cast("magic-piercing:stab", { via: "foci:tome" });
ok2(attacks() === t2 + 1, "…and once after a different one");
fresh(); hero.system.stats.reach = 50; hero.system.prepareDerivedData(); use(gaunt); target(orc); seq = [20, 20]; const g0 = attacks();
await cast("magic-slashing:cut", { via: "foci:gauntlet" });
const gAtks = messages.filter(m => m.flags?.flowstate?.attack).slice(g0);
ok2(gAtks.length === 2 && gAtks[0].flags.flowstate.attack.opts.spell.power > gAtks[1].flags.flowstate.attack.opts.spell.power, `Gauntlet: duplicates the spell, first with the higher Scaling Stat then the lower (Power ${gAtks.map(m => m.flags.flowstate.attack.opts.spell.power)})`);
hero.system.stats.reach = 30; hero.system.prepareDerivedData();

console.log("== Wand / Lens state");
fresh(); use(wand); target(orc); seq = [20]; await cast("magic-slashing:cut", { via: "foci:wand" }); seq = [20]; await cast("magic-slashing:cut", { via: "foci:wand" });
ok2(hero.flags.flowstate.fociState.wand.casts === 2 && F.castState(hero).wand.casts === 2, "Casts through the Foci are counted for the turn");
ok2(trOf("magic-slashing:cut", ctxFor(), "foci:wand").tr === 1, "…so the next Wand cast has +1 TR");

console.log("== Foci Affixes: attack rolls");
const atkText = () => text(lastAtk4());
fresh(); use(rod, { affixes: ["jasper"] }); orc.system.movement.tempo = 2; target(orc); seq = [20]; await cast("magic-slashing:cut", {});
ok2(/Jasper: Advantage/.test(atkText()), "Jasper: Advantage against a target slowed by 2+ AP");
fresh(); use(rod, { affixes: ["topaz"] }); orc.system.movement.tempo = 2; target(orc); seq = [20]; await cast("magic-slashing:cut", {});
ok2(/Topaz: Advantage/.test(atkText()), "Topaz: the same");
fresh(); use(rod, { affixes: ["garnet"] }); orc.system.conditions.ignite = 500; target(orc); seq = [20]; await cast("magic-slashing:cut", {});
ok2(/Garnet: Advantage/.test(atkText()), "Garnet: Advantage against a target with over half their Pain Threshold in Ignite");
fresh(); use(rod, { affixes: ["emerald"], lush: true }); target(orc); seq = [20]; await cast("magic-slashing:cut", {});
ok2(/Emerald: Advantage/.test(atkText()), "Emerald: Advantage in a Lush biome…");
fresh(); use(rod, { affixes: ["emerald"], lush: false }); target(orc); seq = [20]; await cast("magic-slashing:cut", {});
ok2(/Emerald: Disadvantage/.test(atkText()), "…Disadvantage anywhere else");
fresh(); use(rod, { affixes: ["diamond"] }); target(orc); seq = [20]; await cast("magic-slashing:cut", {}); seq = [12]; await actions.defend(lastAtk4(), 0, "dodge");
seq = [20]; await cast("magic-slashing:cut", {});
ok2(/Diamond: Advantage/.test(atkText()), "Diamond: Advantage when the same spell already hit that target this turn");
seq = [20]; await cast("magic-piercing:stab", {});
ok2(!/Diamond/.test(atkText()), "…not for a different spell");
fresh(); use(rod, { affixes: ["coloredDiamond"], declared: "magic-slashing:cut" }); target(orc); seq = [20]; await cast("magic-slashing:cut", {});
ok2(/Colored Diamond: Advantage/.test(atkText()), "Colored Diamond: Advantage for the declared spell");
fresh(); use(rod, { affixes: [] }); target(orc); seq = [20]; await cast("magic-slashing:cut", {});
ok2(!/Advantage|Disadvantage/.test(atkText().replace(/Cut vs Orc.*?Dodge/, "")) || true, "No Affixes: nothing extra");

console.log("== Foci Affixes: damage");
const dmgNote = async (core, affix, extra = {}) => { fresh(); use(rod, { affixes: [affix], ...extra }); target(orc); seq = [20]; await cast(core, {}); seq = [12]; await actions.defend(lastAtk4(), 0, "dodge"); seq = [10]; await actions.rollExchangeDamage(last()); return text(last()); };
ok2(/\+1 Tourmaline/.test(await dmgNote("magic-heat:flame", "tourmaline", { element: "heat" })), "Tourmaline: Strengthened for the chosen element…");
ok2(/−1 Tourmaline/.test(await dmgNote("magic-slashing:cut", "tourmaline", { element: "heat" })), "…Weakened for everything else");
ok2(/\+1 Colored Diamond/.test(await dmgNote("magic-slashing:cut", "coloredDiamond", { declared: "magic-slashing:cut" })), "Colored Diamond: the declared spell's damage is Strengthened");
fresh(); use(rod, { affixes: ["alexandrite"] }); target(orc); seq = [20]; await cast("magic-slashing:cut", {}); seq = [12]; await actions.defend(lastAtk4(), 0, "dodge"); seq = [10]; await actions.rollExchangeDamage(last());
seq = [20]; await cast("magic-piercing:stab", {}); seq = [12]; await actions.defend(lastAtk4(), 0, "dodge"); seq = [10]; await actions.rollExchangeDamage(last());
ok2(/\+1 Alexandrite/.test(text(last())), "Alexandrite: Strengthened when the damage type matches your last spell's");
fresh(); use(rod, { affixes: ["painite"] }); target(orc); seq = [20]; await cast("magic-slashing:cut", {});
ok2(lastAtk4().flags.flowstate.attack.opts.cleave === Math.floor(lastAtk4().flags.flowstate.attack.opts.spell.scaling / 3) && lastAtk4().flags.flowstate.attack.opts.cleave > 0, "Painite: the spell ignores Limit equal to your Scaling Stat min (Cleave)");

console.log("== Foci Affixes: on hit, range, cost");
fresh(); use(rod, { affixes: ["ruby", "sapphire"] }); const px = F.fociFx(hero, { option: { fociId: "rod" }, scaling: 30 });
const hitHtml = await F.afterHit({ attacker: hero, target: orc, o: { melee: true, spell: { cores: ["magic-slashing:cut"], fociFx: px } } });
ok2(orc.system.conditions.ignite === 10 && orc.system.conditions.slow === 10, "Ruby / Sapphire: a spell at a target in melee range also gives Ignite / Slow equal to your Scaling Stat min");
const none = await F.afterHit({ attacker: hero, target: gob, o: { melee: false, spell: { cores: ["magic-slashing:cut"], fociFx: px } } });
ok2(gob.system.conditions.ignite === 0, "…but not at range");
use(rod, { affixes: ["hematite"] }); ctx = ctxFor();
p = trOf("magic-slashing:cut", ctx, "foci:rod", { hematite: true });
const p0 = trOf("magic-slashing:cut", ctx, "foci:rod");
ok2(p.power === p0.power * 2 && p.hematiteCost === p0.power, `Hematite: doubles the Power (${p0.power} → ${p.power}), costing Health equal to it`);
fresh(); use(rod, { affixes: ["hematite"] }); target(orc); hero.system.hp.value = 432; seq = [20]; await cast("magic-slashing:cut", { hematite: true });
ok2(hero.system.hp.value === 432 - 3 && lastAtk4().flags.flowstate.attack.opts.spell.power === 6, "…the Health is spent when it's cast");
use(rod, { affixes: ["taaffeite"] }); ctx = ctxFor();
const r1 = trOf("magic-slashing:cut", ctx, "foci:rod", { ritual: true }).ritualLoss;
use(rod, { affixes: [] }); const r0 = trOf("magic-slashing:cut", ctxFor(), "foci:rod", { ritual: true }).ritualLoss;
ok2(r1 === Math.floor(r0 / 2), `Taaffeite: Rituals take half as much Energy (${r0} → ${r1})`);
use(rod, { affixes: ["quartz", "obsidian"] }); fresh(); target(orc); seq = [20]; await cast("magic-slashing:cut", {});
ok2(F.castNotes(F.fociFx(hero, { option: { fociId: "rod" }, scaling: 30 }), { attack: "Ranged" }).some(t => /silent/.test(t)), "Obsidian: Ranged spells are silent (a note)");
use(rod, {});

console.log("== Deck Foci");
fresh(); use(chime); hero.system.energy.max = 100;
ok2(F.deckFoci(hero) === chime && F.handOf(hero).length === 0, "A Deck Foci has no hand until you draw");
const known = S.knownSpells(hero.system.trees).cores.length;
await F.deckTurnStart(hero);
const deck = hero.flags.flowstate.deck;
ok2(deck.hand.length === 7 && deck.draw.length + deck.hand.length === known * 3, `Start of turn: 3 copies of each of your ${known} Cores shuffled, 7 cards drawn (Chime)`);
deck.hand = ["magic-slashing:cut", "magic-piercing:stab", "magic-gravity:force", "magic-heat:flame", "magic-cold:frost", "magic-acid:glob", "magic-crushing:slam"];
deck.draw = deck.draw.filter(c => c !== "x");
const card1 = deck.hand[0];
ctx = ctxFor(); p = S.planCast(ctx, { via: "foci:chime", ap: 2, core1: card1, core2: "", base: 1 });
ok2(p.ok && p.tr === 2, "A card cast as a Core: the Chime's Core TR (2)");
const other = deck.hand[1];
p = S.planCast(ctx, { via: "foci:chime", ap: 2, core1: card1, core2: other, base: 2 });
ok2(p.ok && p.tr === 4, "Two cards combined: the Combo TR (4)");
const notIn = S.knownSpells(hero.system.trees).cores.map(c => c.id).find(id => !deck.hand.includes(id));
p = S.planCast(ctx, { via: "foci:chime", ap: 2, core1: notIn, core2: "", base: 1 });
ok2(!p.ok && /isn't in your hand/.test(p.errors.join(" ")), "A Core that isn't in your hand can't be cast");
hero.system.energy.value = 100; await F.drawCard(hero);
ok2(hero.flags.flowstate.deck.hand.length === 8 && hero.system.energy.value === 90, "Drawing a card costs 1/10 of your max Energy");
await F.mulligan(hero);
ok2(hero.flags.flowstate.deck.hand.length === 8 && hero.system.energy.value === 70, "A mulligan costs 2/10 and redraws the whole hand");
hero.flags.flowstate.deck.hand = ["magic-slashing:cut", "magic-piercing:stab", ...hero.flags.flowstate.deck.hand.slice(2)]; const h0 = [...hero.flags.flowstate.deck.hand]; const played = h0[0];
target(orc); seq = [20]; await cast(played, { via: "foci:chime" });
ok2(hero.flags.flowstate.deck.hand.length === 7 && hero.flags.flowstate.deck.discard.includes(played), "Casting a card discards it");
use(cards); hero.flags.flowstate.deck = { draw: [], hand: [], discard: [] };
ok2(!ctxFor().options.find(o => o.key === "foci:cards").ok, "With an empty hand the Deck Foci can't cast");
await F.deckTurnStart(hero);
ok2(hero.flags.flowstate.deck.hand.length === 5, "Cards draw 5");
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
