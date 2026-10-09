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
let dodgeRoll = 12;   // a hit but not a crit (a crit is double the dodge result)
async function hit(mode, extra = {}, atk = 20) {
  refresh(); target(orc); seq = [atk];
  await M.manifest(hero, { mode, range: "ranged", ...extra });
  seq = [dodgeRoll]; await actions.defend(lastAtk(), 0, "dodge");
  return messages.filter(m => m.flags?.flowstate?.defense).at(-1);
}
const reset = () => { clearAll(orc); clearAll(hero); orc.system.hp.value = 432; orc.system.hp.lost = 0; orc.system.conditions = { ignite: 0, stain: 0, slow: 0, haste: 0, solid: 0, searing: 0, frozen: 0, electric: 0 }; for (const k of Object.keys(orc.flags)) delete orc.flags[k]; orc.system.lift = 0; orc.system.prepareDerivedData?.(); };


const CH = await import("../../module/charges.mjs");
const Pp = R.wonderPower(hero.system.derived.effective.pon.value), Ps = R.wonderPower(hero.system.derived.effective.snap.value);
const place = async (mode, extra = {}) => { await hit(mode, extra); };
const idOf = (html, name) => html.match(new RegExp(`name="${name}:([^"]+)"`))?.[1];
const optId = html => html.match(/<option value="([^"]+)">(?:Decree|Fracture|Larceny)/)?.[1];
const synth = (formula, total) => { const r = new Roll(formula); r.total = total; return r; };

console.log("== Decree and Mandate on a roll");
reset();
await place("mental-order-dream:decree", { "choice:sign": "plus" });
await place("mental-order-dream:mandate", { "choice:sign": "minus" });
let shown = null;
dialog = html => { shown = html; return { replace: optId(html), [`m:${idOf(html, "m")}`]: true }; };
let r = synth("1d20", 14);
let out = await CH.onRoll({ actor: orc, type: "attack", roll: r, die: 20, count: 1, net: 0 });
ok2(/Spend your charges/.test(shown) && new RegExp(`Decree: the roll becomes ${10 + Pp}`).test(shown), "The caster is offered Decree (half the die + 1) and Mandate as selectables");
ok2(r.total === 10 && out.notes.length === 2, "Decree makes it 11, Mandate (minus) takes 1 off: 10");
ok2(W.chargesOf(hero).length === 0, "Both charges are used up");

console.log("== Fracture and Control");
reset(); hero.system.trees["mental-chaos-nightmare"] = 5;
await place("mental-chaos-nightmare:fracture", { "choice:size": "up" });
dialog = html => ({ replace: optId(html), control: true });
r = synth("2d12", 9); seq = [7, 13]; formulas.length = 0;
out = await CH.onRoll({ actor: orc, type: "dodge", roll: r, die: 12, count: 2, net: 0, max: 24 });
ok2(formulas.includes(`2d${12 + Ps}`) && r.total === 13, "Fracture (up) rerolls a dodge at half the change (2d13), Control rerolls it once more and the new result stands");

console.log("== Larceny steals a roll");
reset();
await place("mental-chaos-nightmare:larceny", { "choice:size": "down" });
dialog = html => ({ replace: optId(html) });
r = synth("1d20", 18); seq = [5];
await CH.onRoll({ actor: orc, type: "attack", roll: r, die: 20, count: 1, net: 0 });
ok2(r.total === 5 && flag(hero, "stolenRoll")?.total === 18, "Larceny forces a reroll at die −1 and stores the stolen 18 for the thief");
dialog = () => ({ ok: true });
r = synth("1d20", 3);
await CH.onRoll({ actor: hero, type: "other", roll: r, die: 20, count: 1, net: 0 });
ok2(r.total === 18 && !flag(hero, "stolenRoll"), "The thief can use the stolen roll in place of one of theirs");

console.log("== Through a real dodge");
reset();
await place("mental-order-dream:decree", { "choice:sign": "plus" });
refresh(); target(orc); seq = [20];
await M.manifest(hero, { mode: "mental-life-dream:bloom", range: "ranged" });
dialog = html => /Spend your charges/.test(html) ? { replace: optId(html) } : { net: 0 };
seq = [3, 3]; await actions.defend(lastAtk(), 0, "dodge");
const dcard = messages.filter(m => m.flags?.flowstate?.defense).at(-1);
ok2(/Decree/.test(text(dcard)) && dcard.flags.flowstate.defense.dodge === orc.system.derived.dodgeDie + Pp, "A charge on the dodge roll is offered as part of the real dodge, and its note is on the card");

console.log("== Verdict, Entropy and Balance after the attack");
reset();
await place("mental-order-dream:verdict");
let atk = { total: 14 }, dod = synth("2d10", 10);
dialog = html => ({ adj: "1" });
let ar = await CH.afterResolve({ attacker: orc, target: ally, atk, dodge: dod, result: { hit: true, crit: false, critStacks: 0 }, attackDie: 20 });
ok2(ar?.result.crit && ar.dmgAdjust === 10 * Pp, "Verdict turns a regular hit into a crit and adds 10 damage");
reset();
await place("mental-chaos-nightmare:entropy", { "choice:size": "up" });
atk = { total: 30 }; dod = synth("2d10", 10);
dialog = html => ({ how: "redo" }); seq = [4];
ar = await CH.afterResolve({ attacker: orc, target: ally, atk, dodge: dod, result: { hit: true, crit: true, critStacks: 2 }, attackDie: 20 });
ok2(atk.total === 4 && !ar.result.hit, "Entropy on a crit: the attack is redone with its own die and can miss");
reset();
await place("mental-chaos-nightmare:entropy", { "choice:size": "up" });
atk = { total: 30 }; dod = synth("2d10", 10);
dialog = html => ({}); seq = [20];
ar = await CH.afterResolve({ attacker: ally, target: orc, atk, dodge: dod, result: { hit: true, crit: true, critStacks: 2 }, attackDie: 20 });
ok2(dod.total === 20 && ar.result.hit && !ar.result.crit, "Entropy on the defender (being crit): a new dodge attempt replaces theirs");

hero.system.trees = { ...hero.system.trees };
const ic = mkIcon(hero, "ic", { form: "aegis", grade: 3, attuned: true, tenet: "mental-order-dream:balance" });
hero.system.prepareDerivedData();
atk = { total: 9 }; dod = synth("2d10", 10);
dialog = html => ({ b: "mine" });
ar = await CH.afterResolve({ attacker: hero, target: orc, atk, dodge: dod, result: { hit: false, crit: false, critStacks: 0 } });
ok2(ar?.result.hit && atk.total > 9, "Balance (Order Tenet) is offered when +1 would change a miss into a hit, once per round");
atk = { total: 9 }; dod = synth("2d10", 10);
ar = await CH.afterResolve({ attacker: hero, target: orc, atk, dodge: dod, result: { hit: false, crit: false, critStacks: 0 } });
ok2(!ar, "…and not a second time that round");

console.log("== Enhanced Mandate on damage");
reset();
await place("mental-order-dream:mandate", { "choice:sign": "plus", enhance: true });
dialog = html => ({ [`m:${idOf(html, "m")}`]: true });
const md = await CH.onDamage({ actor: orc });
ok2(md?.flat === 10 * Pp, "An Enhanced Mandate changes damage by 10");

console.log("== Larceny on a damage roll");
reset(); clearAll(hero);
await place("mental-chaos-nightmare:larceny", { "choice:size": "up" });
dialog = html => /charges on/.test(html) || /Spend your charges/.test(html) || /damage/.test(html) ? { replace: optId(html) } : {};
formulas.length = 0; seq = [7];
const ld = await CH.onDamage({ actor: orc, formula: "2d6", totals: [9] });
const stolenFlag = hero.getFlag("flowstate", "stolenRoll");
ok2(ld?.totals?.[0] === 7 && formulas.some(f => f === `2d${6 + Pp}`) && stolenFlag?.total === 9 && stolenFlag.type === "damage", `Larceny steals a damage roll (9) and they reroll with bigger dice (2d${6 + Pp}): ${ld?.totals}`);
dialog = html => (/Stolen roll|stole from/.test(html) ? { go: true } : {});
const ld2 = await CH.onDamage({ actor: hero, formula: "1d8", totals: [3] });
ok2(ld2?.totals?.[0] === 9 && !hero.getFlag("flowstate", "stolenRoll"), "The thief can use the stolen roll in place of their own damage roll");

console.log("== Enhanced Larceny steals the action");
reset(); clearAll(hero);
await place("mental-chaos-nightmare:larceny", { "choice:size": "down", enhance: true });
dialog = html => ({ replace: optId(html) });
r = synth("1d20", 18); seq = [5];
await CH.onRoll({ actor: orc, type: "attack", roll: r, die: 20, count: 1, net: 0, attackOpts: { label: "Sword", apCost: 2, damage: "2d6", type: "physical", stacks: 0, net: 0, notes: [], melee: true } });
const sa = CH.stolenActionOf(hero);
ok2(sa && sa.cost === 2 && sa.opts.damage === "2d6" && sa.fromName === "Orc", "Enhanced Larceny on an attack keeps a copy of that exact attack for up to a minute");
refresh(); target(ally); formulas.length = 0; seq = [12];
await CH.useStolenAction(hero);
ok2(hero.system.rp.value === 4 && lastAtk().flags.flowstate.attack.opts.label === "Sword (stolen)", "Using it costs RP equal to the attack's AP and makes that attack");
ok2(formulas.some(f => f === `1d${orc.system.derived.attackDie}`) || formulas.some(f => new RegExp(`d${orc.system.derived.attackDie}`).test(f)), "…rolled with the victim's attack die");

console.log("== Questions go to the character's player, not to whoever runs the code");
{ const CH = await import("../../module/charges.mjs");
  const gmUser = { id: "gm", isGM: true, active: true }, pl = { id: "p1", isGM: false, active: true };
  const saved = [...game.users]; const savedUser = game.user;
  game.users.length = 0; game.users.push(gmUser, pl); game.users.activeGM = gmUser; game.user = { id: "gm", isGM: true, targets: new Set() };
  const owned = { isOwner: true, testUserPermission: (u) => u.id === "p1" };
  ok2(CH.answeringUser(owned) === pl, "The GM's client owns everything, but a connected player who owns the character is the one asked");
  pl.active = false;
  ok2(CH.answeringUser(owned) === game.user, "…with the player offline, whoever owns it here answers");
  const npc = { isOwner: true, testUserPermission: () => false };
  pl.active = true; ok2(CH.answeringUser(npc) === game.user, "An NPC nobody else owns is answered by the GM");
  // An unlinked token is a copy of its world actor: the player's ownership of the original counts, and the pair is one creature in play.
  const world = { id: "W1", isOwner: true, testUserPermission: (u) => u.id === "p1" };
  const copy = { id: "W1", token: { baseActor: world }, isOwner: true, testUserPermission: () => false };
  ok2(CH.answeringUser(copy) === pl, "A token copy that grants the player nothing is still answered by the original's owner");
  const savedCanvas = globalThis.canvas, savedActors = [...game.actors];
  globalThis.canvas = { tokens: { placeables: [{ actor: copy }] } }; game.actors.length = 0; game.actors.push(world, { id: "W2" });
  ok2(CH.everyActor().length === 2 && CH.everyActor().includes(copy) && !CH.everyActor().includes(world), "everyActor lists the token's actor instead of its world actor, so nobody is asked about the same creature twice");
  globalThis.canvas = savedCanvas; game.actors.length = 0; game.actors.push(...savedActors);
  game.users.length = 0; game.users.push(...saved); game.user = savedUser; }

console.log("== One popup per question");
{ const CH = await import("../../module/charges.mjs");
  let shown = 0; const savedDialog = dialog;
  dialog = () => { shown++; return new Promise(r => setTimeout(() => r({ ok: true }), 20)); };
  const owned = { isOwner: true, testUserPermission: () => false };
  const [a, b] = await Promise.all([CH.askFor(owned, { title: "Ward", html: "<p>same</p>" }), CH.askFor(owned, { title: "Ward", html: "<p>same</p>" })]);
  ok2(shown === 1 && a?.ok && b?.ok, "The same question asked twice at once opens one window and both askers get its answer");
  await CH.askFor(owned, { title: "Ward", html: "<p>same</p>" });
  ok2(shown === 2, "…and asking it again afterwards opens a new one");
  dialog = savedDialog; }

console.log(fails ? `\n${fails} FAILED` : "\nAll live charge checks passed");
if (fails) process.exit(1);
