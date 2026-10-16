// Earth (Dream) and Sea (Nightmare): Accretion, Adamant, Reinforce, Ejecta, Batholith, Bedrock; Undertow, Surge, Current, Riptide, Shoal, Drown.
import { installFoundry } from "./support/foundry.mjs";
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 }); let confirmAnswer = true; let waitAnswer = "ap";
const { combat } = installFoundry({ roll: () => (seq.length ? seq.shift() : 10), dialog: c => dialog(c), confirm: () => confirmAnswer, wait: () => waitAnswer, messages, uuids });

const { FlowStateActorData } = await import("../../module/data.mjs");
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
const text = m => m.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
globalThis.CONFIG = {};
let fails = 0; const ok2 = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
globalThis.Roll = class { constructor(f){ this.formula=f; } async evaluate(){ this.total = seq.length ? seq.shift() : 10; return this; } async render(){ return `<roll ${this.formula}=${this.total}>`; } };

// Active Effects on mock actors: created, updated and deleted like Foundry's, re-deriving the actor each time.
function addEffects(a) {
  a.effects = [];
  a.effects.get = id => a.effects.find(e => e.id === id);
  let n = 0;
  a.createEmbeddedDocuments = async (type, docs) => docs.map(d => {
    const e = { id: `E${a.name}${n++}`, disabled: false, statuses: new Set(), parent: a, ...structuredClone(d) };
    e.uuid = `${a.uuid}.ActiveEffect.${e.id}`;
    e.update = async u => { for (const [k, v] of Object.entries(u)) set(e, k, v); a.system.prepareDerivedData(); };
    e.delete = async () => { a.effects.splice(a.effects.indexOf(e), 1); a.system.prepareDerivedData(); };
    a.effects.push(e); uuids.set(e.uuid, e); a.system.prepareDerivedData(); return e;
  });
  return a;
}
const M = await import("../../module/mental.mjs");
const W = await import("../../module/wonders.mjs");
const WD = await import("../../module/wonders-d.mjs");
const stats = { str: 10, dex: 10, con: 10, pon: 30, snap: 25, will: 30, reach: 10, grasp: 10, build: 10 };
const hero = addEffects(mkActor("Shaper", { stats, skillPoints: 30, energy: { value: 200 } }, { "mental-theory": 2, "mental-earth-dream": 5, "mental-sea-nightmare": 5 }));
const orc = addEffects(mkActor("Orc", { skillPoints: 30, energy: { value: 100 } }, {}));
const ally = addEffects(mkActor("Ally", { skillPoints: 30 }, {}));
combat.combatants.length = 0; combat.combatants.push({ actor: hero }, { actor: orc }, { actor: ally }); combat.combatant = { actor: hero };
const refresh = () => { hero.system.ap.value = 6; hero.system.rp.value = 6; hero.system.energy.value = 200; };
const target = (...as) => { game.user.targets = new Set(as.map(a => ({ actor: a, name: a.name, document: {} }))); };
const lastAtk = () => messages.filter(m => m.flags?.flowstate?.attack).at(-1);
const lastDef = () => messages.filter(m => m.flags?.flowstate?.defense).at(-1);
const fxs = (a, k) => actions.spellEffects(a, k);
const D = e => e.flags.flowstate.spellEffect;
const tree = (id, n) => { hero.system.trees[id] = n; hero.system.prepareDerivedData(); };
const reset = () => {
  for (const a of [orc, ally, hero]) { a.effects.splice(0, a.effects.length); a.system.hp.value = 432; a.system.hp.lost = 0; a.statuses.clear(); a.system.prepareDerivedData(); }
  for (const k of Object.keys(orc.flags)) delete orc.flags[k];
  for (const k of Object.keys(hero.flags)) delete hero.flags[k];
  orc.system.energy.value = 100; combat.combatant = { actor: hero };
};
/** Manifest at the Orc, it fails to dodge (a hit, not a crit): returns the defense card. */
async function hit(mode, extra = {}, who = orc) {
  refresh(); target(who); seq = [20];
  await M.manifest(hero, { mode, range: "ranged", ...extra });
  seq = [12]; await actions.defend(lastAtk(), 0, "dodge");
  return lastDef();
}
const EARTH = "mental-earth-dream", SEA = "mental-sea-nightmare";
const ACC = `${EARTH}:accretion`, UND = `${SEA}:undertow`, RIP = `${SEA}:riptide`, DRN = `${SEA}:drown`;
const P_EARTH = Math.floor(hero.system.derived.effective.pon.value / 10), P_SEA = Math.floor(hero.system.derived.effective.snap.value / 10);          // Wonder Power: 1 per 10 effective PON / SNA

console.log("== Accretion (Earth T1)");
reset(); dialog = () => ({});
await hit(ACC);
let acc = fxs(orc, "accretion")[0];
ok2(acc && D(acc).hp === 50 * P_EARTH && D(acc).limit === 10 * P_EARTH, `On a hit: an encasement of 50 × Power Durability (${acc && D(acc).hp}) and a Limit of a fifth of it`);
await hit(ACC);
acc = fxs(orc, "accretion")[0];
ok2(fxs(orc, "accretion").length === 1 && D(acc).hp === 300 && D(acc).limit === 60, "A second Accretion of yours melds into it: Durability and Limit add up");
await actions.putSpellEffect(orc, { kind: "accretion", stack: true, caster: ally.uuid, hp: 50, max: 50, limit: 10, name: "Accretion (ally)" });
ok2(fxs(orc, "accretion").length === 2, "…another Earth user's stays a separate encasement");
orc.effects.splice(orc.effects.findIndex(e => D(e).caster === ally.uuid), 1);

console.log("== Accretion soaks before the creature");
let hp0 = orc.system.hp.value;
await actions.requestDamage(orc, 100, "physical");
acc = fxs(orc, "accretion")[0];
ok2(orc.system.hp.value === hp0 - 40 && D(acc).hp === 240, `It absorbs up to its Limit (60) of a hit and loses that much Durability; the rest passes through (HP ${orc.system.hp.value}, Durability ${D(acc).hp})`);
tree(EARTH, 3); hp0 = orc.system.hp.value;
await actions.requestDamage(orc, 20, "arcane");
ok2(D(fxs(orc, "accretion")[0]).hp === 240 && orc.system.hp.value === hp0 - 20, "Arcane (Magical) damage goes past it");
tree(EARTH, 4);
await actions.requestDamage(orc, 20, "arcane");
ok2(D(fxs(orc, "accretion")[0]).hp === 220 && orc.system.hp.value === hp0 - 20, "Batholith (T4): it takes any category");

console.log("== Reinforce (T2) and Bedrock (T5)");
tree(EARTH, 5); refresh(); hp0 = orc.system.hp.value;
let asked = "";
dialog = c => { asked = c; return /Reinforce/.test(c) ? { reinforce: true } : {}; };
await actions.requestDamage(orc, 100, "physical");
ok2(/Reinforce/.test(asked) && /Bedrock/.test(asked), "Damage bigger than its Limit asks the Earth user about Reinforce and Bedrock");
ok2(orc.system.hp.value === hp0 && D(fxs(orc, "accretion")[0]).hp === 120 && hero.system.energy.value < 200, "Reinforce: its Limit is its whole remaining Durability for that hit (Energy paid)");
asked = ""; dialog = c => { asked = c; return {}; };
await actions.requestDamage(orc, 30, "physical");
ok2(asked === "" && D(fxs(orc, "accretion")[0]).hp === 90, "Not asked when the Limit takes it all anyway");
dialog = c => (/Bedrock/.test(c) ? { bedrock: true } : {});
await actions.requestDamage(orc, 70, "physical");
ok2(orc.system.hp.value === hp0 && D(fxs(orc, "accretion")[0]).hp === 10, "Bedrock: what gets past the Limit costs it twice as much Durability instead (90 − 60 − 2 × 10)");
dialog = () => ({});
await actions.requestDamage(orc, 30, "physical");
ok2(fxs(orc, "accretion").length === 0 && orc.system.hp.value === hp0 - 20, "At 0 Durability it crumbles");
tree(EARTH, 1); dialog = () => ({});
await hit(ACC);
asked = ""; dialog = c => { asked = c; return {}; };
await actions.requestDamage(orc, 100, "physical");
ok2(asked === "" && D(fxs(orc, "accretion")[0]).hp === 120, "Without Earth T2 nobody is asked");
dialog = () => ({});
tree(EARTH, 5);

console.log("== Enhanced Accretion: a chosen category is Weakened against it");
reset();
await hit(ACC, { enhance: true, "choice:category": "physical" });
acc = fxs(orc, "accretion")[0];
ok2(D(acc).weak?.includes("physical"), "The category picked on Manifest is kept");
await actions.requestDamage(orc, 30, "physical");
ok2(D(fxs(orc, "accretion")[0]).hp === 150 - 15, "Physical damage it absorbs costs it half the Durability");
await actions.requestDamage(orc, 30, "cold");
ok2(D(fxs(orc, "accretion")[0]).hp === 135 - 30, "…other categories cost the full amount");

console.log("== Ejecta (T3)");
target(ally); refresh(); seq = [20];
await WD.ejecta(hero);
const ej = lastAtk();
ok2(fxs(orc, "accretion").length === 0 && ej?.flags.flowstate.attack.opts.mental?.ejecta?.amount === 21 && ej.flags.flowstate.attack.targets[0].uuid === ally.uuid, "Ejecta consumes the Accretion and throws it: an attack roll for a fifth of its Durability (105 / 5)");
seq = [12]; await actions.defend(ej, 0, "dodge");
ok2(ally.system.hp.value === 432 - 21, `On a hit: physical damage (${432 - ally.system.hp.value})`);
await hit(ACC);
ally.system.magical = true; tree(EARTH, 3); target(ally);
const before = messages.length;
await WD.ejecta(hero);
ok2(messages.length === before && fxs(orc, "accretion").length === 1, "Without Batholith it can't target a fully magical creature (and the Accretion stays)");
tree(EARTH, 4); seq = [20];
await WD.ejecta(hero);
ok2(lastAtk().flags.flowstate.attack.opts.mental?.ejecta?.type === "arcane", "Batholith: Arcane damage to a fully magical target");
ally.system.magical = false; tree(EARTH, 5);

console.log("== Adamant (Earth Tenet)");
reset(); const pain0 = orc.system.hp.pain;
dialog = () => orc.uuid;
ok2(await W.ACTS.adamant({ bstacks: 0, mult: 2 }, hero, orc) === true && orc.system.hp.pain === pain0 - 20, `Lowers the target's Pain Threshold by 10 × the Tenet's multiplier (${pain0} → ${orc.system.hp.pain})`);
ok2(await W.ACTS.adamant({ bstacks: 0, mult: 2 }, hero, orc) === false, "…once per round");
orc.system.hp.value = pain0 - 5; messages.length = 0;
await actions.mentalBeforeClear(hero); await actions.clearSpellEffects(hero); await W.pendingTurnStart(hero);
ok2(orc.system.hp.pain === pain0 && messages.some(m => /Adamant on Orc ends/.test(text(m))), "It ends at your next turn; someone kept up only by it is told they fall unconscious unless it's reapplied");

console.log("== Undertow (Sea T1) and Shoal (T4)");
reset(); dialog = () => ({});
await hit(UND);
ok2(fxs(orc, "undertow")[0] && D(fxs(orc, "undertow")[0]).power === P_SEA, "On a hit: engulfed until your next turn");
hp0 = orc.system.hp.value; seq = [7];
await WD.forcedMove(orc, 10, null);
ok2(orc.system.hp.value === hp0 - 7 && WD.forcedSince(orc) === 10, "Forcefully moved by something else: 2d8 physical (×Power dice)");
const cur = messages.flatMap(m => m.flags?.flowstate?.mentalAct?.acts ?? []).find(a => a.id === "current");
ok2(cur && cur.tip.includes(`${Math.floor(1.5 * P_SEA)} ft`), "Current (T2) is offered on the card: up to 1.5 ft × Power, rounded down");
await hero.setFlag("flowstate", "autoDecline", { current: true });
const before2 = messages.length; seq = [7]; await WD.forcedMove(orc, 5, null);
ok2(!messages.slice(before2).some(m => m.flags?.flowstate?.mentalAct?.acts?.some(a => a.id === "current")), "…not when Current is switched off (Reactions)");
await hero.setFlag("flowstate", "autoDecline", { current: false });
hp0 = orc.system.hp.value; seq = [7];
await WD.forcedMove(orc, 5, `sea:${hero.uuid}`);
ok2(orc.system.hp.value === hp0 && WD.forcedSince(orc) === 20, "…not when your own Sea moves them (it still counts as forced movement)");
seq = [6]; await actions.seaMove(orc);
ok2(orc.system.hp.value === hp0 - 6, "Moving themselves in combat triggers it too");
orc.statuses.add("prone"); hp0 = orc.system.hp.value; seq = [8];
await actions.seaMove(orc);
ok2(orc.system.hp.value === hp0 - 12, "Shoal: Strengthened against a prone target (8 → 12)");
reset(); await hit(UND, { enhance: true });
seq = [9]; await WD.forcedMove(orc, 5);
ok2(orc.system.hp.value === 432 - 9 && orc.system.energy.value === 91, "Enhanced: cold damage, and Energy lost equal to the direct damage");

console.log("== Current, Surge and Riptide move the target (ignoring Force and Lift)");
reset(); refresh();
ok2(await W.ACTS.current({ power: P_SEA, bstacks: 0 }, hero, orc) === true && messages.at(-1).flags.flowstate.knockback?.feet === Math.floor(1.5 * P_SEA) && hero.system.energy.value < 200, "Current: pay SNA min Energy, then a direction button (1.5 ft × Power, rounded down)");
hero.flags.flowstate = { ...(hero.flags.flowstate ?? {}), mentalOnce: undefined };
ok2(await W.ACTS.surge({ bstacks: 0, mult: 3 }, hero, orc) === true && messages.at(-1).flags.flowstate.knockback?.feet === 3 && messages.at(-1).flags.flowstate.knockback?.sea === hero.uuid, "Surge: once per round, up to 1 ft × the Tenet's multiplier");
ok2(await W.ACTS.surge({ bstacks: 0, mult: 3 }, hero, orc) === false, "…once per round");
await hit(UND);
const rip = await hit(RIP);
const kb = rip.flags.flowstate.knockback;
ok2(kb?.feet === 2 * P_SEA && kb.sea === hero.uuid && kb.upTo, "Riptide: up to 2 ft × Power, a Sea move");
hp0 = orc.system.hp.value; dialog = () => ({ dir: "n", ft: 3 });
await actions.knockback(rip);
ok2(WD.forcedSince(orc) === 3 && orc.system.hp.value === hp0, "The caster may move them less; it counts as forced movement and doesn't set off your own Undertow");
reset(); refresh(); target(orc, ally); seq = [20, 20];
await M.manifest(hero, { mode: RIP, range: "ranged", enhance: true });
const pair = lastAtk();
seq = [12]; await actions.defend(pair, 0, "dodge"); const d0 = lastDef();
seq = [12]; await actions.defend(pair, 1, "dodge"); const d1 = lastDef();
ok2(d0.flags.flowstate.knockback?.toward === ally.uuid && d1.flags.flowstate.knockback?.toward === orc.uuid, "Enhanced: the first target is pulled toward the second, and the second (hit too) toward the first");

console.log("== Drown (T5)");
reset(); dialog = () => ({});
hero.flags.flowstate = { turnStartedAt: Date.now() - 1000 };
await hit(DRN);
ok2(orc.statuses.has("prone") && orc.system.hp.value === 432, "On a hit they're knocked prone; not moved 4 ft × Power this turn, they lose nothing");
await WD.forcedMove(orc, 4 * P_SEA, `sea:${hero.uuid}`);
await hit(DRN);
ok2(orc.system.hp.value === 432 - 15, `Moved 4 ft × Power this turn: they lose 2d10 × Power health, Strengthened by Shoal as they're prone (${432 - orc.system.hp.value})`);
ok2(messages.flatMap(m => m.flags?.flowstate?.mentalAct?.acts ?? []).some(a => a.id === "current" && a.target === orc.uuid), "…and Current is offered");

console.log("== Drown, Enhanced: Concentration, getting up, each turn");
reset(); dialog = () => ({});
hero.flags.flowstate = { turnStartedAt: Date.now() - 1000 };
await hit(DRN, { enhance: true });
ok2(fxs(orc, "drowning").length === 1 && (hero.getFlag("flowstate", "concentrating") ?? []).length === 1, "Enhanced: you concentrate on it and they're kept drowning");
combat.combatant = { actor: orc }; orc.system.ap.value = 6; seq = [1];
await actions.setPosture(orc, "stand");
const esc1 = lastAtk();
ok2(orc.system.ap.value === 5 && esc1?.flags.flowstate.attack.opts.mental?.escape && esc1.flags.flowstate.attack.targets[0].uuid === hero.uuid, "Getting up costs 1 AP and is an attack roll against the drowner");
seq = [12]; await actions.defend(esc1, 0, "dodge");
ok2(orc.statuses.has("prone") && fxs(orc, "drowning").length === 1, "A miss: still prone, still drowning");
combat.combatant = { actor: hero };
hero.flags.flowstate.turnStartedAt = Date.now() - 1000;
await WD.forcedMove(orc, 4 * P_SEA, `sea:${hero.uuid}`);
let hpD = orc.system.hp.value;
await W.pendingTurnStart(hero);
ok2(orc.system.hp.value === hpD - 15 && fxs(orc, "drowning").length === 1, "Start of your turn: moved enough since your last turn, they lose the health again");
hero.flags.flowstate.turnStartedAt = Date.now() + 1;
hpD = orc.system.hp.value;
await W.pendingTurnStart(hero);
ok2(fxs(orc, "drowning").length === 0 && orc.system.hp.value === hpD, "…not moved enough: it ends");
await hit(DRN, { enhance: true });
combat.combatant = { actor: orc }; orc.system.ap.value = 6; seq = [20];
await actions.setPosture(orc, "stand");
seq = [5]; await actions.defend(lastAtk(), 0, "dodge");
ok2(!orc.statuses.has("prone") && fxs(orc, "drowning").length === 0, "A hit: they get up and the Drown ends");
combat.combatant = { actor: hero };

if (fails) { console.log(`${fails} FAILED`); process.exit(1); }
console.log("all passed");
