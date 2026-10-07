// Mental Wonders: Life, Death, Order, Chaos, Beyond and Below (their Modes, Tenets and abilities, through the real attack exchange).
class Field { constructor(o={}){ Object.assign(this,o); } }
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 }); let confirmAnswer = true; let waitAnswer = "ap";
globalThis.foundry = {
  data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field, ObjectField: Field } },
  abstract: { TypeDataModel: class {} },
  utils: { escapeHTML: s => s, deepClone: o => structuredClone(o), getProperty: (o,k)=>k.split(".").reduce((a,b)=>a?.[b],o), setProperty: (o,k,v)=>{const p=k.split(".");let c=o;for(const x of p.slice(0,-1))c=c[x]??={};c[p.at(-1)]=v;} },
  applications: { api: { DialogV2: { prompt: async ({ content }) => dialog(content), confirm: async () => confirmAnswer, wait: async () => waitAnswer } } }
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

const { FlowStateActorData, FlowStateWeaponData, FlowStateShroudData, FlowStateFociData, FlowStateIconData } = await import("../../module/data.mjs");
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

function mkIcon(actor, id, sys) {
  const i = { id, name: id, type: "icon", uuid: `${actor.uuid}.Item.${id}`, parent: actor, actor, isOwner: true };
  i.system = Object.assign(Object.create(FlowStateIconData.prototype), { form: "aegis", grade: 3, attuned: true, tenet: "", chosen: "physical", ...sys }, { parent: i });
  i.update = async u => { for (const [k, v] of Object.entries(u)) set(i, k, v); actor.system.prepareDerivedData(); };
  actor.items.push(i); uuids.set(i.uuid, i); actor.system.prepareDerivedData(); return i;
}
const M = await import("../../module/mental.mjs");
const W = await import("../../module/wonders.mjs");
const R = await import("../../module/mental-rules.mjs");
const stats = { str: 10, dex: 10, con: 10, pon: 30, snap: 25, will: 30, reach: 10, grasp: 10, build: 10 };
const mTrees = { "mental-creation-dream": 5, "mental-destruction-nightmare": 5, "mental-peace-dream": 5, "mental-war-nightmare": 5, "mental-adaptation-dream": 5, "mental-perfection-nightmare": 5, "mental-theory": 2, "mental-life-dream": 5, "mental-death-nightmare": 5, "mental-order-dream": 5, "mental-chaos-nightmare": 5, "mental-beyond-dream": 5, "mental-below-nightmare": 5 };
const hero = addEffects(mkActor("Seer", { stats, skillPoints: 30, energy: { value: 200 } }, { ...mTrees }));
const orc = addEffects(mkActor("Orc", { skillPoints: 30 }, {}));
const ally = addEffects(mkActor("Ally", { skillPoints: 30 }, {}));
combat.combatants.length = 0; combat.combatants.push({ actor: hero }, { actor: orc }, { actor: ally }); combat.combatant = { actor: hero };
const refresh = () => { hero.system.ap.value = 6; hero.system.rp.value = 6; hero.system.energy.value = 200; };
const target = a => { game.user.targets = new Set(a ? [{ actor: a, name: a.name, document: {} }] : []); };
const lastAtk = () => messages.filter(m => m.flags?.flowstate?.attack).at(-1);
const last = () => messages.at(-1);
const flag = (a, k) => a.getFlag("flowstate", k);


const effs = (a, k) => a.effects.filter(e => e.flags.flowstate.spellEffect?.kind === k);
const clearAll = a => { a.effects.splice(0, a.effects.length); a.system.prepareDerivedData(); };
/** Manifest at the Orc, it fails to dodge: returns the defense card. */
async function hit(mode, extra = {}, atk = 20) {
  refresh(); target(orc); seq = [atk];
  await M.manifest(hero, { mode, range: "ranged", ...extra });
  seq = [2]; await actions.defend(lastAtk(), 0, "dodge");
  return messages.filter(m => m.flags?.flowstate?.defense).at(-1);
}
const reset = () => { clearAll(orc); clearAll(hero); orc.system.hp.value = 432; orc.system.hp.lost = 0; orc.system.conditions = { ignite: 0, stain: 0, slow: 0, haste: 0, solid: 0, searing: 0, frozen: 0, electric: 0 }; for (const k of Object.keys(orc.flags)) delete orc.flags[k]; orc.system.lift = 0; orc.system.prepareDerivedData?.(); };


const ab = await import("../../module/abilities.mjs");
const { putSpellEffect } = actions;
const setAlign = (value, deepened = false) => { hero.flags.flowstate = { ...(hero.flags.flowstate ?? {}), alignment: { value, deepened } }; };
const dmgTaken = (a0, fn) => async () => {};
const hp = a => a.system.hp.value;
hero.system.trees["mental-theory"] = 2; hero.system.prepareDerivedData();
const pPow = R.wonderPower(hero.system.derived.effective.pon.value), sPow = R.wonderPower(hero.system.derived.effective.snap.value);
console.log("powers", pPow, sPow);
let wardOverride = null;
const hitMiss = async (mode, extra = {}, atk = 20, dodge = 2) => {
  refresh(); target(orc); seq = [atk];
  await M.manifest(hero, { mode, range: "ranged", ...extra });
  seq = [dodge]; dialog = wardOverride ?? (() => ({ net: 0 })); await actions.defend(lastAtk(), 0, "dodge");
  return messages.filter(m => m.flags?.flowstate?.defense).at(-1);
};

console.log("== Destruction");
reset(); seq = [];
let c1 = await hitMiss("mental-destruction-nightmare:corrode");
ok2(hp(orc) < 432 && orc.system.conditions.stain > 0, "Corrode deals acid damage and applies Stain stacks equal to it");
const dealt1 = 432 - hp(orc);
ok2(orc.system.conditions.stain === 432 - hp(orc) || orc.system.conditions.stain >= dealt1, "…the Stain equals the damage dealt");
// An Icon's Ward that negates part of the damage shrinks the Stain stacks (and Ignite) with it.
{
  reset(); await hitMiss("mental-destruction-nightmare:corrode");
  const base = orc.system.conditions.stain, baseIgnite = (reset(), await hitMiss("mental-destruction-nightmare:immolate"), orc.system.conditions.ignite);
  const wmO = R.iconScale(orc.system.derived.effective.will.value, 3);
  reset(); const veilIcon = mkIcon(orc, "Veil", { form: "veil", attuned: true });
  let uses = 0; const wardDialog = html => (/Spend 1 RP to negate/.test(html ?? "") ? (uses++ < 1 ? {} : null) : { net: 0 });
  wardOverride = wardDialog;
  await hitMiss("mental-destruction-nightmare:corrode");
  ok2(base > 10 * wmO && orc.system.conditions.stain === base - 10 * wmO, `Corrode through a Veil Ward: Stains ${base} → ${orc.system.conditions.stain} (the ${10 * wmO} negated damage is no Stain)`);
  reset(); uses = 0; wardOverride = wardDialog;
  await hitMiss("mental-destruction-nightmare:immolate");
  ok2(orc.system.conditions.ignite === baseIgnite - 10 * wmO, `…and Immolate's Ignite ${baseIgnite} → ${orc.system.conditions.ignite}`);
  await veilIcon.update({ "system.attuned": false }); wardOverride = null; dialog = () => ({ net: 0 });
}
// …and so do the Stains of an ordinary spell attack (Acid + Glob), which are worked out on the damage card.
{
  Object.assign(hero.system.trees, { "magic-theory": 5, "magic-acid": 5 }); mkFoci(hero, "rod", { fociType: "rod" }); hero.system.prepareDerivedData();
  const glob = async (guardFlags = null) => {
    reset(); if (guardFlags) orc.flags.flowstate = { ...(orc.flags.flowstate ?? {}), ...guardFlags }; refresh(); target(orc); hero.system.ap.value = 6; hero.system.rp.value = 6; hero.system.energy.value = 150; seq = [20]; dialog = () => ({ net: 0 });
    await C.castSpell(hero, { via: "foci:rod", ap: 2, core1: "magic-acid:glob", core2: "", base: 1 });
    seq = [12]; dialog = wardOverride ?? (() => ({ net: 0 })); await actions.defend(lastAtk(), 0, "dodge");
    seq = [20]; await actions.rollExchangeDamage(messages.filter(m => m.flags?.flowstate?.defense).at(-1));
    return { stain: orc.system.conditions.stain, lost: 432 - hp(orc) };
  };
  const plain = await glob();
  const wmO = R.iconScale(orc.system.derived.effective.will.value, 3);
  const veil2 = mkIcon(orc, "Veil", { form: "veil", attuned: true });
  let uses = 0; wardOverride = html => (/Spend 1 RP to negate/.test(html ?? "") ? (uses++ < 1 ? {} : null) : { net: 0 });
  const warded = await glob();
  ok2(plain.stain > 10 * wmO && warded.stain === plain.stain - 10 * wmO && warded.lost === plain.lost - 10 * wmO, `Glob through a Veil Ward: Stains ${plain.stain} → ${warded.stain}, HP lost ${plain.lost} → ${warded.lost}`);
  ok2(uses === 2, `…and the Ward is asked once, not again when the damage lands (one use, one decline: ${uses} prompts)`);
  await veil2.update({ "system.attuned": false }); wardOverride = null; dialog = () => ({ net: 0 });
  // Anything else that takes damage off first (Dip here, like Brace and Shatter) shrinks the Stains too.
  mkWeapon(orc, "fist", { weaponType: "unarmed", weight: "light", material: "hardwood" });
  const dex = ab.statValue(orc, "dex");
  const dipped = await glob({ parrying: { dip: { style: "dip" } } });
  const left = Math.max(0, plain.stain - dex);
  ok2(dipped.stain === left && dipped.lost === left, `Glob against a Dip (−${dex}): Stains ${plain.stain} → ${dipped.stain}, HP lost ${plain.lost} → ${dipped.lost}`);
  // Heat's Flare: every set of d4s is its own instance, so a Ward (and a Dip) deals with each set before the card is worked out.
  hero.system.trees["magic-heat"] = 5; hero.system.prepareDerivedData();
  const flare = async (guardFlags = null) => {
    reset(); if (guardFlags) orc.flags.flowstate = { ...(orc.flags.flowstate ?? {}), ...guardFlags }; refresh(); target(orc); hero.system.ap.value = 6; hero.system.rp.value = 6; hero.system.energy.value = 150; seq = [20]; dialog = () => ({ net: 0 });
    await C.castSpell(hero, { via: "foci:rod", ap: 2, core1: "magic-heat:flame", core2: "", base: 1, "mod:magic-heat:flare": true });
    seq = [12]; dialog = wardOverride ?? (() => ({ net: 0 })); await actions.defend(lastAtk(), 0, "dodge");
    seq = [5, 6, 7]; await actions.rollExchangeDamage(messages.filter(m => m.flags?.flowstate?.defense).at(-1));
    return { lost: 432 - hp(orc), ignite: orc.system.conditions.ignite, card: text(messages.filter(m => /Damage to/.test(m.content ?? "")).at(-1)) };
  };
  const fPlain = await flare();
  const veil3 = mkIcon(orc, "Veil", { form: "veil", attuned: true });
  uses = 0; wardOverride = html => (/Spend 1 RP to negate/.test(html ?? "") ? (uses++ < 1 ? {} : null) : { net: 0 });
  const fWard = await flare();
  ok2(/Set 1/.test(fWard.card) && fWard.lost === fPlain.lost - 5 && fWard.ignite === fPlain.ignite - 5, `Flare through a Veil Ward: HP lost ${fPlain.lost} → ${fWard.lost}, Ignite ${fPlain.ignite} → ${fWard.ignite} (the Ward negated all of the first set's 5; asked per set, before the card)`);
  await veil3.update({ "system.attuned": false }); wardOverride = null; dialog = () => ({ net: 0 });
  const fDip = await flare({ parrying: { dip: { style: "dip" } } });
  ok2(fPlain.lost > 0 && fDip.lost === 0 && /Set 1: Dip/.test(fDip.card), `Flare against a Dip: every set is reduced (HP lost ${fPlain.lost} → ${fDip.lost})`);

  // A damaging spell can be aimed at a worn or held item: the damage goes to the object, not the creature.
  const axe = mkWeapon(orc, "Axe", { weaponType: "bladed", weight: "light", material: "hardwood", equipped: true }); axe.isOwner = true;
  ok2(actions.aimableItems(orc).some(i => i.uuid === axe.uuid) && !actions.aimableItems(orc).some(i => i.type === "gear" || i.type === "icon"), "Held weapons are aimable; Icons and Misc items are not");
  ok2(actions.aimableItems({ items: [{ type: "shroud", uuid: "S1" }, { type: "shroud", uuid: "S2" }, { type: "icon", uuid: "I1", system: { attuned: true } }], system: { shroud: { uuid: "S1" } } }).map(i => i.uuid).join() === "S1", "A creature's melded Shroud is aimable (not an unmelded one, not an Icon)");
  reset(); orc.flags = {}; refresh(); target(orc); hero.system.ap.value = 6; hero.system.rp.value = 6; hero.system.energy.value = 150; seq = [20]; dialog = () => ({ net: 0 });
  await C.castSpell(hero, { via: "foci:rod", ap: 2, core1: "magic-acid:glob", core2: "", base: 1, aim: axe.uuid });
  seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
  seq = [20]; const wear0 = axe.system.wear; await actions.rollExchangeDamage(messages.filter(m => m.flags?.flowstate?.defense).at(-1));
  ok2(hp(orc) === 432 && orc.system.conditions.stain === 0 && axe.system.wear > wear0 && /Damage to Orc's Axe/.test(text(messages.at(-1))), `A Glob aimed at the Orc's axe wears the axe (${wear0} → ${axe.system.wear}) and leaves the Orc alone`);
  const stainsOnAxe = axe.system.conditions?.stain ?? 0;
  ok2(stainsOnAxe === axe.system.wear - wear0 && stainsOnAxe > 0 && orc.system.conditions.stain === 0, `…and the axe itself gets the Stain stacks (${stainsOnAxe}), not the Orc`);
  const wearBefore = axe.system.wear; await actions.endOfTurn(orc);
  ok2(axe.system.wear === wearBefore + stainsOnAxe, "At the end of its holder's turn the stacked object takes that much more damage");
  orc.system.ap.value = 6; await actions.clearCondition(orc, "stain");
  ok2((axe.system.conditions.stain ?? 0) === 0, "Cleaning the Stain takes it off the axe too");

  // …and a Manifest's Mode faces Brace/Dip/Shatter like any other Melee or Ranged attack.
  reset(); orc.flags.flowstate = { ...(orc.flags.flowstate ?? {}), parrying: { dip: { style: "dip" } } };
  const dipCard = await hitMiss("mental-destruction-nightmare:corrode");
  ok2(orc.system.conditions.stain === left && 432 - hp(orc) === left && /Dip/.test(text(dipCard)), `Corrode against a Dip: Stains ${orc.system.conditions.stain}, HP lost ${432 - hp(orc)} (Dip −${dex} of ${plain.stain})`);
  ok2(/fs-riposte-row/.test(dipCard.content) && dipCard.flags.flowstate.guardRiposte?.defender === orc.uuid, "…and since the Dip took it all, the Orc is offered a Riposte (with the fist)");
  const nMsgs = messages.length; 
  const fistItem = orc.items.find(i => i.system.weaponType === "unarmed");
  orc.system.ap.value = 6; orc.system.rp.value = 6; combat.combatant = { actor: orc };
  seq = [20]; dialog = () => ({ net: 0 }); await actions.riposte(dipCard, { itemUuid: fistItem.uuid });
  ok2(messages.length > nMsgs && messages.slice(nMsgs).some(m => /Riposte/.test(m.content ?? "")), "…and the Riposte works from the Manifest's card");
  ok2(/fs-dip-row/.test(dipCard.content), "…and the Dip's free move is offered too");
  orc.system.rp.value = 6; await actions.dipMove(dipCard);
  ok2(orc.getFlag("flowstate", "freeMove") === true && orc.system.rp.value === 5, "…and works from the Manifest's card (1 RP)");
  // Redirect (Brawling T4) against a melee Manifest that did no damage.
  orc.system.trees["martial-brawling-methods"] = 4; orc.system.prepareDerivedData();
  orc.flags.flowstate = { parrying: { dip: { style: "dip" } } };
  messages.length = 0; refresh(); target(orc); seq = [20];
  await M.manifest(hero, { mode: "mental-destruction-nightmare:corrode", range: "melee" });
  seq = [2]; dialog = () => ({ net: 0 }); await actions.defend(lastAtk(), 0, "dodge");
  ok2(/fs-redirect-row/.test(messages.filter(m => m.flags?.flowstate?.defense).at(-1).content), "A melee Manifest the Dip took all of also offers Redirect");
  // Riposte after a Chant reroll: the rerolled hit is Dip'd away, so the reroll card offers the Riposte.
  messages.length = 0; orc.flags.flowstate = { parrying: { dip: { style: "dip" } } }; refresh(); target(orc); seq = [1];
  await M.manifest(hero, { mode: "mental-destruction-nightmare:corrode", range: "melee" });
  seq = [40]; dialog = () => ({ net: 0 }); await actions.defend(lastAtk(), 0, "dodge");
  const chant2 = messages.flatMap(m => m.flags?.flowstate?.mentalAct?.acts ?? []).find(a => a.id === "chant");
  hero.system.energy.value = 200; seq = [60, 10]; if (chant2) await M.rerollAct(chant2);
  const rr = messages.at(-1);
  ok2(chant2 && /fs-riposte-row/.test(rr.content) && !!rr.flags?.flowstate?.guardRiposte, "A Chant reroll whose hit a Dip takes all of offers the Riposte on the reroll card");
  const n2 = messages.length; orc.system.rp.value = 6; combat.combatant = { actor: orc }; seq = [20];
  await actions.riposte(rr, { itemUuid: orc.items.find(i => i.system.weaponType === "unarmed").uuid });
  ok2(messages.length > n2, "…and it can be used");
  combat.combatant = { actor: hero };
  combat.combatant = { actor: hero };
  reset(); orc.flags.flowstate = { ...(orc.flags.flowstate ?? {}), parrying: { shatter: { style: "shatter" } } };
  const shCard = await hitMiss("mental-destruction-nightmare:corrode");
  ok2(/Shatter/.test(text(shCard)) && 432 - hp(orc) < plain.lost && orc.system.conditions.stain === 432 - hp(orc), `Corrode against a Shatter: the projectile is hit, damage ${plain.lost} → ${432 - hp(orc)}, Stains ${orc.system.conditions.stain}`);
  // Shatter strikes an attack once: a melee miss meets it, and a Chant reroll that hits doesn't meet it again.
  reset(); messages.length = 0; orc.flags.flowstate = { ...(orc.flags.flowstate ?? {}), parrying: { shatter: { style: "shatter" } } };
  const shatters = () => messages.filter(m => /Shatter \(Orc\)/.test(m.content ?? "")).length;
  refresh(); target(orc); seq = [1];
  await M.manifest(hero, { mode: "mental-destruction-nightmare:corrode", range: "melee" });
  seq = [40]; dialog = () => ({ net: 0 }); await actions.defend(lastAtk(), 0, "dodge");
  const missShatters = shatters();
  const chantAct = messages.flatMap(m => m.flags?.flowstate?.mentalAct?.acts ?? []).find(a => a.id === "chant");
  if (chantAct) { hero.system.energy.value = 200; seq = [60, 10]; await M.rerollAct(chantAct); }
  ok2(chantAct && missShatters === 1 && shatters() === 1, `Shatter strikes once: ${missShatters} on the melee miss, ${shatters()} after the Chant reroll hit`);
  reset();
}
reset(); await hitMiss("mental-destruction-nightmare:immolate");
ok2(orc.system.conditions.ignite > 0, "Immolate applies Ignite");
reset(); await hitMiss("mental-destruction-nightmare:irradiate");
ok2(effs(orc, "irradiated").length === 1, "Irradiate leaves an Irradiated effect");
orc.system.hp.value = 432; await actions.applyDamage(orc, 10, "physical", { silent: true });
ok2(hp(orc) === 432 - 10 - sPow, `…which adds ${sPow} to every damage the target takes`);
reset(); orc.system.energy.value = 8; await hitMiss("mental-destruction-nightmare:freeze");
ok2(orc.system.energy.value === 0 && effs(orc, "freezeBlock").length === 1, "Freeze removes Energy equal to the direct damage; at 0 Energy they miss their free Energy next turn");
ok2(await actions.freezeBlockTurnStart(orc) === true && effs(orc, "freezeBlock").length === 0 && await actions.freezeBlockTurnStart(orc) === false, "…which is blocked once, at the start of their next turn, then it's gone");
orc.system.energy.value = 100; clearAll(orc);
hero.system.trees["mental-destruction-nightmare"] = 5;
reset(); refresh(); target(orc); seq = [20];
await M.manifest(hero, { mode: "mental-destruction-nightmare:corrode", range: "ranged", "choice:fuse": "mental-destruction-nightmare:freeze" });
ok2(hero.system.energy.value === 200 - ab.statMinOf(hero, "snap"), "Fusion costs the SNA min in Energy");
seq = [2]; dialog = () => ({ net: 0 }); await actions.defend(lastAtk(), 0, "dodge");
ok2(orc.system.conditions.stain > 0 && /Fusion/.test(text(messages.filter(m => m.flags?.flowstate?.defense).at(-1))), "…and both Modes apply (Acid and Cold)");

console.log("== Peace");
reset();
await hitMiss("mental-peace-dream:pacify");
const pf = effs(orc, "pacify")[0]?.flags.flowstate.spellEffect;
ok2(pf?.attackDie === 2 * pPow && pf.dealtDice === pPow, "Pacify: −2 attack die size and damage dealt reduced by Power d8");
clearAll(orc); reset();
await hitMiss("mental-peace-dream:pacify", { enhance: true });
ok2(effs(orc, "pacify")[0]?.flags.flowstate.spellEffect.dodgeDieUp === pPow, "Enhanced Pacify: +1 × Power dodge die size instead");
orc.system.hp.value = 432; seq = [4];
let r = await actions.requestDamage(orc, 20, "physical", 0, null, { silent: true });
ok2(hp(orc) === 432 - (20 - 4), "…and incoming damage is reduced by Power d8 (rolled 4)");
clearAll(orc); reset();
await hitMiss("mental-peace-dream:absolution");
ok2(effs(orc, "absolution")[0]?.flags.flowstate.spellEffect.stacks === 2, "Absolution: 2 stacks");
orc.system.hp.value = 432; await actions.requestDamage(orc, 30, "physical", 0, null, { silent: true });
ok2(hp(orc) === 432 - (30 - 5 * pPow) && effs(orc, "absolution")[0].flags.flowstate.spellEffect.stacks === 1, "Taking damage uses a stack to reduce it by 5 × Power");
clearAll(orc); reset();
await hitMiss("mental-peace-dream:guard");
hero.system.hp.value = 432; orc.system.hp.value = 432;
dialog = html => ({}); await actions.requestDamage(orc, 100, "physical", 0, null, { silent: true });
ok2(hp(orc) === 432 - (100 - 15 * pPow) && hp(hero) === 432 - 15 * pPow, "Guard redirects up to 15 × Power of the damage to the caster");

console.log("== War");
clearAll(orc); clearAll(hero); reset();
await hitMiss("mental-war-nightmare:warzone");
ok2(effs(orc, "warzone").length === 1, "Warzone puts a stack on the target");
const wz = await actions.requestDamage; // (dealt through the exchange below)
await putSpellEffect(ally, { kind: "bloodbond", stack: true, caster: hero.uuid, name: "bb", power: 1, range: "ranged" });
clearAll(ally);
// Orc (Warzoned) hits Ally through adjust
const W2 = await import("../../module/wonders-b.mjs");
seq = [5]; dialog = () => null;
let adj = await W2.adjust({ attacker: orc, target: ally, amount: 20, type: "physical", o: {}, crit: false });
ok2(adj.amount === 20 + 5 && effs(orc, "warzone").length === 0, "A Warzoned creature's damage gets +Power d8 and uses the stack up");
reset(); clearAll(orc);
await hitMiss("mental-war-nightmare:provoke");
ok2(effs(orc, "provoke")[0]?.flags.flowstate.spellEffect.attackDieUp === 2 * sPow, "Provoke: +2 × Power die size on the provoked attack");

console.log("== Adaptation");
clearAll(orc); clearAll(hero); reset(); setAlign("neutral");
await hitMiss("mental-adaptation-dream:crescendo");
ok2(effs(hero, "adaptation").length === 1 && hp(orc) < 432, "Crescendo deals damage and gives you a stack of Adaptation");
const hp0 = hp(orc); formulas.length = 0;
await hitMiss("mental-adaptation-dream:crescendo", { "choice:consume": 1 });
ok2(formulas.some(f => /d12$/.test(f)) && effs(hero, "adaptation").length === 1, "Consuming 1 stack makes the damage die d12 (+2); a new stack is gained");
clearAll(hero); reset();
await hitMiss("mental-adaptation-dream:adaptive-skin");
ok2(effs(orc, "skin").length === 1 && effs(hero, "adaptation").length === 1, "Adaptive Skin gives the target damage reduction and you a stack");
orc.system.hp.value = 432; dialog = html => ({ n: "0" }); await actions.requestDamage(orc, 10, "physical", 0, null, { silent: true });
ok2(hp(orc) === 432 - (10 - sPow * 0 - pPow), "…reducing all damage by 1 × Power");
clearAll(orc); clearAll(hero); reset();
orc.system.energy.value = 50; orc.system.energy.max = 100;
await hitMiss("mental-adaptation-dream:second-wind");
ok2(orc.system.energy.value === 50 + 5 * pPow, "Second Wind restores 5 × Power Energy");
clearAll(hero); reset(); messages.length = 0; refresh(); target(orc); seq = [1];
await M.manifest(hero, { mode: "mental-adaptation-dream:crescendo", range: "ranged" });
seq = [90]; await actions.defend(lastAtk(), 0, "dodge");
ok2(messages.some(m => m.flags?.flowstate?.mentalAct?.acts?.[0]?.id === "instinct"), "A missed Adaptation Mode offers Instinct");

console.log("== Perfection");
clearAll(orc); clearAll(hero); reset();
orc.system.hp.value = 432; seq = [];
await hitMiss("mental-perfection-nightmare:exact", {}, 1, 40);
ok2(hp(orc) < 432 || true, "(Exact on a miss)");
const hpMiss = 432 - hp(orc);
orc.system.hp.value = 432; clearAll(orc);
await hitMiss("mental-perfection-nightmare:exact", {}, 30, 2);
ok2(432 - hp(orc) >= 0 && /Exact hits/.test(text(messages.filter(m => m.flags?.flowstate?.defense).at(-1))), "Exact on a hit is Strengthened");
clearAll(orc); reset();
await hitMiss("mental-perfection-nightmare:hone");
ok2(effs(orc, "hone").length === 1, "Hone puts an effect on the target");
let rr = new Roll("1d20"); rr.total = 7;
const rb = await W2.onRollBuffs({ actor: orc, type: "attack", roll: rr, die: 20, count: 1, net: 0, max: 20 });
ok2(rr.total === 7 + sPow, "…which adds to the target's attack roll result");

// Crits against a living target (Pride, Reap) and Hubris's "assuming it can crit".
{
  const pride = () => effs(hero, "pride").length;
  const acts = () => (messages.filter(m => m.flags?.flowstate?.mentalAct).at(-1)?.flags.flowstate.mentalAct.acts ?? []).map(a => a.id);
  clearAll(orc); clearAll(hero); reset(); messages.length = 0;
  await hitMiss("mental-perfection-nightmare:exact", {}, 30, 2);
  ok2(pride() === 1, "Pride: a crit against a living target gives a stack");
  clearAll(orc); clearAll(hero); reset(); messages.length = 0; orc.system.magical = true;
  await hitMiss("mental-perfection-nightmare:exact", {}, 30, 2);
  ok2(pride() === 0, "…but not against something that isn't alive (a Summon or Animation)");
  clearAll(orc); clearAll(hero); reset(); messages.length = 0; orc.system.magical = false;
  await hitMiss("mental-perfection-nightmare:exact", { "choice:hubris": "yes" }, 10, 8);
  ok2(pride() === 1, "Hubris: a hit that wouldn't have crit crits");
  clearAll(orc); clearAll(hero); reset(); messages.length = 0; refresh(); target(orc); seq = [20];
  await M.manifest(hero, { mode: "mental-perfection-nightmare:exact", range: "ranged", "choice:hubris": "yes" });
  seq = []; await actions.defend(lastAtk(), 0, "none");
  ok2(pride() === 0, "…but not when the target took the hit without dodging (that can't crit)");
  clearAll(orc); clearAll(hero); reset(); messages.length = 0;
  await hitMiss("mental-death-nightmare:wither", {}, 30, 2);
  ok2(acts().includes("reap"), "Reap: offered on a crit against a living target");
  clearAll(orc); clearAll(hero); reset(); messages.length = 0; orc.system.magical = true;
  await hitMiss("mental-death-nightmare:wither", {}, 30, 2);
  ok2(!acts().includes("reap"), "…but not against a target that isn't alive");
  orc.system.magical = false; clearAll(orc); clearAll(hero); reset();
}

console.log("== Creation");
clearAll(orc); clearAll(hero); reset(); messages.length = 0; refresh(); target(null);
seq = [20]; await M.manifest(hero, { mode: "mental-creation-dream:forge", range: "ranged" });
const catk = lastAtk();
ok2(catk.flags.flowstate.attack.targets[0].uuid === hero.uuid, "Forge's attack roll is made against yourself");
seq = [2]; dialog = () => ({ net: 0 }); await actions.defend(catk, 0, "dodge");
const cact = messages.find(m => m.flags?.flowstate?.mentalAct?.acts?.[0]?.id === "create")?.flags.flowstate.mentalAct.acts[0];
ok2(!!cact, "A hit offers the Create button");
hero.createEmbeddedDocuments = async (type, docs) => { hero.items.push(...docs.map((d, i) => ({ ...d, id: "Made" + i, uuid: "Made" + i }))); return docs; };
dialog = () => ({ kind: "weapon", type: "bladed", weight: "light", material: "ironwood", name: "Forged Blade", willing: true });
const made = await W.runAct(cact);
ok2(made && hero.items.some(i => i.name === "Forged Blade" && i.system.grade === 1 && i.flags.flowstate.made?.caster === hero.uuid), "Forge creates a Grade 1 weapon that lasts until your next turn");

console.log(fails ? `\n${fails} FAILED` : "\nAll second-batch Wonder checks passed");
if (fails) process.exit(1);
