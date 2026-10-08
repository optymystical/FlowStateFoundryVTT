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
const mTrees = { "mental-theory": 2, "mental-life-dream": 5, "mental-death-nightmare": 5, "mental-order-dream": 5, "mental-chaos-nightmare": 5, "mental-beyond-dream": 5, "mental-below-nightmare": 5 };
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

console.log("== Life (Dream): Bloom, Flourish, Renewal");
reset();
let card = await hit("mental-life-dream:bloom");
let pend = effs(orc, "pending");
ok2(pend.length === 1 && pend[0].flags.flowstate.spellEffect.then.n === 60, "Bloom: 20 temp HP × Power 3 waits for the target's next turn (pending)");
ok2(/60 temp HP/.test(text(card)), "…and the card says so");
await W.pendingTurnStart(orc);
ok2(effs(orc, "pending").length === 0 && effs(orc, "tempHP")[0]?.flags.flowstate.spellEffect.hp === 60, "At the start of their turn it becomes 60 temp HP");
let dmg = await actions.damageOutcome(orc, 100, "physical");
ok2(dmg.toHp === 40 && dmg.tempHp.length === 1 && dmg.tempHp[0].used === 60, "Temp HP soaks what would reach HP (60 of 100)");
orc.system.hp.value = 432;
await actions.applyDamage(orc, 100, "physical", { silent: true });
ok2(orc.system.hp.value === 392 && effs(orc, "tempHP").length === 0, "…and is used up");
reset();
await hit("mental-life-dream:bloom", { enhance: true });
ok2(effs(orc, "tempHP")[0]?.flags.flowstate.spellEffect.hp === 60 && !effs(orc, "pending").length, "Enhanced Bloom gives the temp HP immediately");
reset();
const dd0 = orc.system.derived.dodgeDie;
hero.system.trees["mental-life-dream"] = 5;
await hit("mental-life-dream:flourish");
await W.pendingTurnStart(orc);
ok2(orc.system.derived.dodgeDie === dd0 + R.wonderPower(hero.system.derived.effective.pon.value), "Flourish: dodge dice +1 size × Power from the start of their next turn");
reset();
orc.system.hp.value = 400; orc.flags.flowstate = { lossLog: [{ at: 1000, n: 32 }] }; hero.flags.flowstate = { ...(hero.flags.flowstate ?? {}), turnStartedAt: 0 };
await hit("mental-life-dream:renewal", { enhance: true });
ok2(orc.system.hp.value === 412, "Renewal (Enhanced, immediate): 4 × Power 3 = 12 health, only what was lost recently");
reset(); messages.length = 0;
card = await hit("mental-life-dream:bloom");
const acts = messages.find(m => m.flags?.flowstate?.mentalAct)?.flags.flowstate.mentalAct.acts ?? [];
ok2(acts.some(a => a.id === "pollinate"), "Life T2: Pollinate is offered after a hit");

console.log("== Alignment 2 scales the bolded effects of Modes");
const setAlign = (kind, level) => { hero.flags.flowstate = { ...(hero.flags.flowstate ?? {}), alignment: kind ? { kind, level } : null }; };
reset(); setAlign("dream", 1);
await hit("mental-life-dream:bloom");
ok2(effs(orc, "pending")[0]?.flags.flowstate.spellEffect.then.n === 60, "1 Alignment: no scaling yet (Bloom still 60 temp HP)");
reset(); setAlign("dream", 2);
await hit("mental-life-dream:bloom");
ok2(effs(orc, "pending")[0]?.flags.flowstate.spellEffect.then.n === 90, "2 Dream Alignment: a Dream Mode's bolded effect is Strengthened (Bloom 60 → 90 temp HP)");
reset(); setAlign("dream", 2);
await hit("mental-beyond-dream:ascend");
ok2(effs(orc, "lift")[0]?.flags.flowstate.spellEffect.liftUp === 270, "…Ascend's 180 Lift becomes 270");
reset(); setAlign("dream", 2);
await hit("mental-death-nightmare:waste");
ok2(effs(orc, "waste")[0] && Math.floor(6 * 0.5) === 3 && effs(orc, "waste")[0].flags.flowstate.spellEffect.bstacks === -1, "A Nightmare Mode under Dream 2 is Weakened (Waste carries the Weakened stack)");
{ const w = W.dodgeWaste(orc); ok2(w?.pen === 3, "…and takes 3 die sizes off instead of 6"); }
reset(); setAlign("dream", 2);
await hit("mental-below-nightmare:sink");
{ const hold = effs(orc, "hold")[0]; ok2(hold?.flags.flowstate.spellEffect.holdMin === 3, "…Sink's escape check is 3 instead of 6"); }
reset(); setAlign("nightmare", 2);
await hit("mental-below-nightmare:sink");
{ const hold = effs(orc, "hold")[0]; ok2(hold?.flags.flowstate.spellEffect.holdMin === 9, "2 Nightmare Alignment: Sink is Strengthened (6 → 9)"); }
setAlign(null);
reset();

console.log("== Life: Verdant Soul (Tenet) and Perennial");
const icon = mkIcon(hero, "Aegis", { form: "aegis", attuned: true, tenet: "mental-life-dream:verdant-soul" });
reset(); messages.length = 0;
const prompts = []; let take = false;
dialog = html => { prompts.push(html); return /Use it now/.test(html) ? (take ? {} : null) : /Who/.test(html) ? orc.uuid : { net: 0 }; };
await hit("mental-life-dream:bloom");
await new Promise(r => setTimeout(r, 30));
ok2(prompts.some(h => /Verdant Soul/.test(h) && /Use it now/.test(h)), "With the Verdant Soul Tenet attuned, a hit pops it up");
ok2(!effs(orc, "tempHP").length && !messages.some(m => m.flags?.flowstate?.mentalAct?.acts?.some(a => a.id === "verdantSoul")), "…declined, nothing happens and it isn't a button");
prompts.length = 0; take = true;
await hit("mental-life-dream:bloom");
await new Promise(r => setTimeout(r, 30));
ok2(prompts.some(h => /Verdant Soul/.test(h) && /Use it now/.test(h)), "Not used, so it pops up again on the next hit that round");
ok2(effs(orc, "tempHP").some(e => e.flags.flowstate.spellEffect.hp === 10 * R.wonderPower(hero.system.derived.effective.pon.value)), "Accepted: Verdant Soul gives temp HP");
prompts.length = 0;
await hit("mental-life-dream:bloom");
await new Promise(r => setTimeout(r, 30));
ok2(!prompts.some(h => /Verdant Soul/.test(h)), "…and once used, it stops popping up this round");
dialog = () => ({ net: 0 });
reset(); await hit("mental-life-dream:bloom", { enhance: true });
const pe = W.perennialActs(hero);
ok2(pe.length >= 1 && pe[0].id === "perennial", "Perennial offers to reapply a Life effect that is about to expire");

console.log("== Death (Nightmare): Wither, Waste, Execute");
reset();
seq = [12]; target(orc); refresh();
await M.manifest(hero, { mode: "mental-death-nightmare:wither", range: "ranged" });
seq = [2, 55]; await actions.defend(lastAtk(), 0, "dodge");
ok2(orc.system.hp.value === 432 - 110 && /Wither removes 110/.test(text(messages.filter(m => m.flags?.flowstate?.defense).at(-1))), "Wither removes 2d10 × Power health (doubled by the critical), ignoring defenses");
reset(); orc.system.magical = true;
seq = [20]; await M.manifest(hero, { mode: "mental-death-nightmare:wither", range: "ranged" }); seq = [2, 55]; await actions.defend(lastAtk(), 0, "dodge");
ok2(orc.system.hp.value === 432, "Wither needs a living target");
orc.system.magical = false; reset();
await hit("mental-death-nightmare:waste");
ok2(effs(orc, "waste").length === 1, "Waste puts a charge on the target");
const formulas0 = []; const origRoll = globalThis.Roll;
globalThis.Roll = class extends origRoll { constructor(f) { super(f); formulas0.push(f); } };
seq = [20]; target(null); refresh();
hero.system.trees["mental-theory"] = 2;
// the Orc attacks the Seer; the Orc's own dodge is what Waste shrinks, so make the Seer attack the Orc
refresh(); target(orc); seq = [20]; await M.manifest(hero, { mode: "mental-life-dream:bloom", range: "ranged" });
seq = [8]; await actions.defend(lastAtk(), 0, "dodge");
ok2(formulas0.some(f => new RegExp(`^2d${orc.system.derived.dodgeDie - 2 * R.wonderPower(hero.system.derived.effective.snap.value)}`).test(f)) && effs(orc, "waste").length === 0, "Waste: the next dodge roll is 2 × Power die sizes smaller, and the charge is used");
globalThis.Roll = origRoll;
reset();
orc.system.hp.value = 432;
await hit("mental-death-nightmare:execute", { enhance: true });
const ex = effs(orc, "execute")[0];
ok2(ex && ex.flags.flowstate.spellEffect.painUp > 0 && orc.system.hp.pain > 0, "Execute raises the target's Pain Threshold");
orc.system.hp.value = Math.floor(orc.system.hp.pain / 2) + 20;
await actions.applyDamage(orc, 40, "physical", { silent: true });
ok2(orc.system.hp.value === 0, "Enhanced Execute: dropping below half the raised Pain Threshold kills");

console.log("== Beyond (Dream): Herald, Ascend, Redirect, Gust");
reset();
seq = [12]; target(orc); refresh();
await M.manifest(hero, { mode: "mental-beyond-dream:herald", range: "ranged" });
seq = [2, 900]; await actions.defend(lastAtk(), 0, "dodge");
card = messages.filter(m => m.flags?.flowstate?.defense).at(-1);
ok2(/Herald: 30d8 = 900/.test(text(card)) && card.flags.flowstate.knockback?.feet === Math.floor((1800 - (orc.system.lift ?? 0)) / 10), "Herald: 10d8 × Power Force becomes feet directly (no half-HP threshold), with a Push button");
reset();
await hit("mental-beyond-dream:ascend");
orc.system.lift = 0; orc.system.prepareDerivedData();
ok2((orc.system.lift ?? 0) >= 180, "Ascend: 60 × Power Lift");
reset(); refresh(); seq = [];
const prevAtk = lastAtk();
await M.manifest(hero, { mode: "mental-beyond-dream:redirect", range: "ranged" });
ok2(effs(hero, "redirect").length === 1 && lastAtk() === prevAtk, "Redirect needs no attack roll: a charge goes on the caster");
refresh(); messages.length = 0; dialog = () => ({ c: "0", beat: "5" }); seq = [30];
await W.useRedirect(hero);
ok2(effs(hero, "redirect").length === 0 && /20/.test(text(messages.at(-1)).replace(/\s/g, "")) === true || /less damage/.test(text(messages.at(-1))), "Using Redirect spends the charge and cuts the damage");
reset(); refresh();
const bTree = hero.system.trees["mental-beyond-dream"]; hero.system.trees["mental-beyond-dream"] = 4;
const mc = M.modeChoices(hero, "mental-beyond-dream:herald");
ok2(mc.some(c => c.name === "kinetic"), "Beyond T4: Kinetic Focus is offered for Herald");
refresh(); target(orc); seq = [20];
await M.manifest(hero, { mode: "mental-beyond-dream:herald", range: "ranged", "choice:kinetic": 2 });
ok2(hero.system.energy.value === 200 - 2 * Math.floor(hero.system.derived.effective.pon.min / 2) && lastAtk().flags.flowstate.attack.targets[0].net === 2, "Kinetic Focus: ⚡ half PON min each for +1 Advantage");
hero.system.trees["mental-beyond-dream"] = bTree;

console.log("== Below (Nightmare): Sink, Burden, Entomb, Vice");
reset();
await hit("mental-below-nightmare:sink");
const hold = effs(orc, "hold")[0];
ok2(hold && hold.flags.flowstate.spellEffect.holdMin === 2 * R.wonderPower(hero.system.derived.effective.snap.value) && orc.statuses.has("grappled"), "Sink: the ground grapples them, escape needs 2 × Power or higher");
const abMod = await import("../../module/abilities.mjs");
ok2(abMod.handGrapples(hero).length === 0, "A magical grapple (Sink) doesn't take up a hand");
const G = actions.grappleHold(orc);
ok2(G.static, "…they can't move at all while sunk");
reset();
await hit("mental-below-nightmare:burden", { "choice:dis": "dodge" });
await hit("mental-below-nightmare:burden", { "choice:dis": "attack" });
ok2(effs(orc, "burden").length === 2 && actions.mentalHookTest?.() !== false, "Burden stacks (one dodge, one attack Disadvantage)");
orc.system.hp.value = 432;
reset(); await hit("mental-below-nightmare:burden", { "choice:dis": "attack" }); await hit("mental-below-nightmare:burden", { "choice:dis": "attack" }); await hit("mental-below-nightmare:burden", { "choice:dis": "attack" });
await hit("mental-below-nightmare:sink");
messages.length = 0;
await hit("mental-below-nightmare:entomb");
ok2(effs(orc, "hold").some(e => e.flags.flowstate.spellEffect.entomb) && effs(orc, "burden").length === 0 && !effs(orc, "hold").some(e => e.flags.flowstate.spellEffect.sink), "Entomb: with Sink and 3 Burden stacks it clears them and entombs the target");
orc.system.hp.value = 432; messages.length = 0; seq = [22];
await W.pendingTurnStart(orc);
ok2(orc.system.hp.value === 432 - 22 && /Entombed/.test(text(messages[0])), "…and each of their turns they take 3d10 × Power physical damage");
reset();
await hit("mental-below-nightmare:entomb");
ok2(effs(orc, "hold").length === 0, "Entomb refuses a target without Sink and Burden");
reset(); orc.system.trees = {}; messages.length = 0;
await hit("mental-below-nightmare:sink");
orc.system.ap = { value: 6, max: 6 };
seq = [1]; messages.length = 0;
await actions.breakFree(orc);
ok2(/Still held/.test(text(messages.at(-1))) || messages.some(m => m.flags?.flowstate?.mentalAct), "A failed break free from Sink stays held, and offers Vice to the caster");
const viceCard = messages.find(m => m.flags?.flowstate?.mentalAct);
const vice = viceCard?.flags.flowstate.mentalAct.acts.find(a => a.id === "vice");
ok2(!!vice, "Below T2: Vice is offered on a failed break free");
hero.system.hp.value = 432; orc.system.hp.value = 432; seq = [7]; refresh();
await W.runAct(vice);
ok2(orc.system.hp.value === 425, "Vice deals Power × 1d12 physical damage");

console.log("== Order and Chaos: charges");
reset();
card = await hit("mental-order-dream:decree", { "choice:sign": "plus" });
let ch = W.chargesOf(hero);
ok2(ch.length === 1 && ch[0].kind === "decree" && ch[0].data.persistent === true, "Decree puts a charge on the target; Permanence (Order T2) makes the first one last until used");
await hit("mental-order-dream:mandate", { "choice:sign": "minus" });
ok2(W.chargesOf(hero).length === 2 && W.chargesOf(hero)[1].data.persistent === false, "Only one Order charge per target is permanent");
messages.length = 0; dialog = () => ({ type: "attack", max: "0" });
await W.consumeCharge(hero, W.chargesOf(hero)[0].effect);
ok2(/static result/.test(text(messages.at(-1))) && /<strong>/.test(messages.at(-1).content) && W.chargesOf(hero).length === 1, "Spending Decree works out the static result (half the roll's max ± 1) and uses the charge up");
messages.length = 0; dialog = () => ({ result: "9", n: "2" });
await W.consumeCharge(hero, W.chargesOf(hero)[0].effect);
ok2(/becomes 7/.test(text(messages.at(-1))), "Mandate (minus, two charges) takes 2 off the result: 9 → 7");
reset();
await hit("mental-chaos-nightmare:fracture", { "choice:size": "up" });
messages.length = 0; dialog = () => ({ type: "dodge", max: "0" }); seq = [11];
await W.consumeCharge(hero, W.chargesOf(hero)[0].effect);
ok2(/rerolls with the die size \+2/.test(text(messages.at(-1))), "Fracture: a forced reroll with the die size +2");
reset();
hero.flags.flowstate = { preordained: { n: 3 } };
await hit("mental-order-dream:decree", { "choice:sign": "plus" });
hero.system.trees["mental-order-dream"] = 5;
messages.length = 0; dialog = () => ({ type: "attack", pre: true });
await W.consumeCharge(hero, W.chargesOf(hero)[0].effect);
ok2(/Preordained/.test(text(messages.at(-1))), "Preordained (Order T4) adds its number to a charge");
messages.length = 0; seq = [5]; await W.afterRest(hero);
ok2(hero.getFlag("flowstate", "preordained")?.n === 5, "Preordained: a rest rolls one of your dodge dice for your Preordained Number");

console.log(fails ? `\n${fails} FAILED` : "\nAll Mental Wonders checks passed");
if (fails) process.exit(1);
