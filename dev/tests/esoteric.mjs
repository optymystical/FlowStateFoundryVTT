// Esoteric Arts (Mental T5): Seed, the Omen's stats, Pole-Bound, Bond (willing, unwilling, lost), anger, rebinding, Channel, Unbind, Kinship, Rend;
// and natural items (no Grade, scaling uncapped).
import { installFoundry } from "./support/foundry.mjs";
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 });
const { combat } = installFoundry({ roll: () => (seq.length ? seq.shift() : 10), dialog: c => dialog(c), messages, uuids });
game.user.isGM = true;                   // the GM's own client: relayed requests run here

const { FlowStateActorData, FlowStateIconData } = await import("../../module/data.mjs");
const actions = await import("../../module/actions.mjs");
const set = (o, k, v) => foundry.utils.setProperty(o, k, v);
let n = 0;
function mkActor(name, extra = {}, trees = {}, flags = {}) {
  const a = { name, id: `A${n++}`, uuid: "Actor." + name, type: "character", isOwner: true, items: [], statuses: new Set(), flags: structuredClone(flags) };
  a.items.get = id => a.items.find(i => i.id === id);
  a.update = async u => { for (const [k, v] of Object.entries(u)) set(a, k, v); a.system.prepareDerivedData(); };
  a.setFlag = async (s, k, v) => { const cur = foundry.utils.getProperty(a.flags, `${s}.${k}`); set(a.flags, `${s}.${k}`, cur && typeof cur === "object" && v && typeof v === "object" && !Array.isArray(v) ? { ...cur, ...v } : v); };
  a.getFlag = (s, k) => foundry.utils.getProperty(a.flags, `${s}.${k}`);
  a.unsetFlag = async (s, k) => set(a.flags, `${s}.${k}`, undefined);
  a.toggleStatusEffect = async (id, { active }) => { active ? a.statuses.add(id) : a.statuses.delete(id); };
  a.getActiveTokens = () => [];
  a.delete = async () => { game.actors.splice(game.actors.indexOf(a), 1); };
  a.system = Object.assign(Object.create(FlowStateActorData.prototype), { stats: { str: 10, dex: 10, con: 10, pon: 10, snap: 10, will: 10, reach: 10, grasp: 10, build: 10 }, skillPoints: 30, unspentStats: 0, statCarry: 0, trees, size: 3,
    hp: { value: 300, lost: 0 }, energy: { value: 50 }, ap: { value: 6 }, rp: { value: 6 }, conditions: {}, ...extra });
  Object.defineProperty(a.system, "parent", { value: a, configurable: true });
  a.effects = [];
  a.effects.get = id => a.effects.find(e => e.id === id);
  let k = 0;
  a.createEmbeddedDocuments = async (type, docs) => docs.map(d => {
    if (type === "Item") { const it = { id: `I${a.name}${k++}`, ...structuredClone(d) }; if (it.type === "icon") it.system = Object.assign(Object.create(FlowStateIconData.prototype), it.system); a.items.push(it); return it; }
    const e = { id: `E${a.name}${k++}`, disabled: false, statuses: new Set(), parent: a, ...structuredClone(d) };
    e.uuid = `${a.uuid}.ActiveEffect.${e.id}`;
    e.update = async u => { for (const [kk, v] of Object.entries(u)) set(e, kk, v); a.system.prepareDerivedData(); };
    e.delete = async () => { a.effects.splice(a.effects.indexOf(e), 1); a.system.prepareDerivedData(); };
    a.effects.push(e); uuids.set(e.uuid, e); a.system.prepareDerivedData(); return e;
  });
  a.system.prepareDerivedData(); uuids.set(a.uuid, a); game.actors.push(a);
  return a;
}
// The GM's Actor.create: an NPC built from the data given.
globalThis.Actor = { create: async d => {
  const a = mkActor(d.name, { stats: d.system.stats, skillPoints: d.system.skillPoints, hp: { ...d.system.hp }, energy: { ...d.system.energy }, size: d.system.size }, d.system.trees, d.flags);
  a.type = d.type; a.ownership = d.ownership; a.uuid = `Actor.${a.id}`; uuids.set(a.uuid, a);
  return a;
} };
const text = m => m.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
globalThis.CONFIG = {};
let fails = 0; const ok2 = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
globalThis.Roll = class { constructor(f) { this.formula = f; } async evaluate() { this.total = seq.length ? seq.shift() : 10; return this; } async render() { return `<roll ${this.formula}=${this.total}>`; } };

await import("../../module/mental.mjs");          // registers the Mental hooks
const W = await import("../../module/wonders.mjs");
const E = await import("../../module/esoteric.mjs");
const C = await import("../../module/concentration.mjs");
const LIFE = "mental-life-dream", DEATH = "mental-death-nightmare";
const stats = { str: 10, dex: 10, con: 10, pon: 40, snap: 20, will: 20, reach: 10, grasp: 10, build: 10 };          // 140 stat points
const hero = mkActor("Seer", { stats, energy: { value: 200 } }, { "mental-theory": 5, "mental-esoteric-arts": 1, [LIFE]: 5, [DEATH]: 5 });
const orc = mkActor("Orc", {}, {});
combat.combatants.length = 0; combat.combatants.push({ actor: hero }, { actor: orc }); combat.combatant = { actor: hero };
const fight = on => { combat.started = on; };
const omens = () => game.actors.filter(a => E.isOmen(a));
const D = a => a.flags.flowstate.omen;
const lastAtk = () => messages.filter(m => m.flags?.flowstate?.attack).at(-1);
const seedAnswer = (extra = {}) => c => (/Alignment depth/.test(c) ? { wonder: LIFE, form: "aegis", depth: "2", flip: false, ...extra } : {});
const clearOmens = async () => { for (const a of omens()) await a.delete(); hero.flags = {}; };

console.log("== Pairs and the Omen's stats");
ok2(E.pairOf(LIFE) === DEATH && E.pairOf(DEATH) === LIFE && E.pairOf("mental-ruin-nightmare") === "mental-fortune-dream", "Each Wonder's pair: Life ↔ Death, Fortune ↔ Ruin");
let b = E.omenBuild(hero, LIFE);
ok2(b.total === 140 && b.stats.pon === 93 && b.stats.will === 47 && b.stats.str === 0 && b.skillPoints === 28, "Stat points equal to yours: two thirds in its Wonder's stat, one third Willpower; skill points a fifth");
b = E.omenBuild(hero, DEATH, { flip: true, full: true });
ok2(b.stats.will === 186 && b.stats.snap === 94 && b.base.will === 93 && b.skillPoints === 28, "Flipped (two thirds Willpower), and full stats: twice the stat points, the same skill points");
ok2(/Dream Form/.test(E.seedProblem(hero, { wonder: LIFE, form: "veil", depth: 2 }) ?? "") && !E.seedProblem(hero, { wonder: LIFE, form: "aegis", depth: 2 }), "A Life Omen takes a Dream Form");
ok2(E.seedProblem(hero, { wonder: "mental-order-dream", form: "aegis", depth: 2 }), "…of a Wonder you have at Tier 5");

console.log("== Seed (T1)");
fight(true);
await E.seed(hero);
ok2(!omens().length, "Not in combat (an 8 hour Trance)");
fight(false); dialog = seedAnswer();
await E.seed(hero);
let omen = omens()[0];
ok2(omen && D(omen).bound && D(omen).wonder === LIFE && D(omen).owner === hero.uuid, "An Omen of a Tier 5 Wonder, bound to you");
ok2(C.list(hero).length === 1 && actions.spellEffects(omen, "omenBond").length === 1, "…one of your Concentrations");
ok2(omen.system.trees["mental-theory"] === 5 && omen.system.trees[LIFE] === 5 && omen.getFlag("flowstate", "alignment")?.level === 2, "Full Mental Theory, its Wonder at Tier 5, the Alignment depth picked");
ok2(omen.system.derived.effective.pon.value === 93 && omen.system.energy.max === 5 * 28, "Its skill points only set its dice (no stat bonus); its Energy is 5 × its skill points");
ok2(omen.items.some(i => i.type === "icon" && i.system.natural && i.system.attuned && i.system.form === "aegis" && i.system.tenet === `${LIFE}:verdant-soul`), "It is its own Icon: a natural Icon of its Form, with its Wonder's Tenet");

console.log("== Bond: willing");
await E.manifested(hero, LIFE); await E.manifested(hero, LIFE); await E.manifested(hero, DEATH);
ok2(D(omen).own === 2 && D(omen).opp === 1, "Manifests of its Wonder and of its paired one are counted");
await C.end(hero, C.list(hero)[0].id);
ok2(!omens().length, "Ending the Concentration yourself with a willing Omen (more of its Wonder) dismisses it");

console.log("== Bond: unwilling");
await clearOmens(); dialog = seedAnswer(); await E.seed(hero); omen = omens()[0];
await E.manifested(hero, DEATH);
dialog = () => ({});
seq = [1, 30];
await C.end(hero, C.list(hero)[0].id);
ok2(lastAtk()?.flags.flowstate.attack.opts.mental?.omenBond, "Unwilling: an attack roll against it");
ok2(D(omen).hostile && !D(omen).bound && !actions.spellEffects(omen, "omenBond").length, "A miss severs the bond: it turns hostile");

console.log("== Lost Concentration: at your side for the battle");
await clearOmens(); fight(false); dialog = seedAnswer(); await E.seed(hero); omen = omens()[0];
fight(true);
await C.end(hero, C.list(hero)[0].id, "the damage", { voluntary: false });
ok2(D(omen).battle === combat.id && !D(omen).bound && !D(omen).hostile, "Lost another way: it fights on your side for the rest of the battle");
ok2(E.omenOf(hero)?.uuid === omen.uuid, "…still your Omen");
await E.anyHit({ attacker: orc, target: omen, result: { hit: true } });
ok2(!D(omen).hostile, "A foe hitting it doesn't anger it");
await E.manifested(hero, DEATH);
ok2(D(omen).hostile, "Manifesting its paired Wonder where it can sense it angers it: hostile");

await clearOmens(); fight(false); dialog = seedAnswer(); await E.seed(hero); omen = omens()[0];
fight(true);
await C.end(hero, C.list(hero)[0].id, "unconscious", { voluntary: false });
await E.anyHit({ attacker: hero, target: omen, result: { hit: true } });
ok2(D(omen).hostile, "You harming it angers it too");

console.log("== The battle ends: free, then rebound");
await clearOmens(); fight(false); dialog = seedAnswer(); await E.seed(hero); omen = omens()[0];
fight(true);
await C.end(hero, C.list(hero)[0].id, "the damage", { voluntary: false });
await E.battleOver(combat);
ok2(!D(omen).battle && !D(omen).bound && !D(omen).hostile && E.strayOf(hero)?.uuid === omen.uuid, "Not hostile when the battle ends: it is free");
fight(false);
await E.rebind(hero);
ok2(D(omen).bound && C.list(hero).length === 1, "Rebind (1 hour of work): bound again, a Concentration again");

console.log("== Pole-Bound");
const death = await Actor.create({ name: "Death Omen", type: "npc", system: { stats: {}, skillPoints: 10, trees: {}, hp: { value: 50, lost: 0 }, energy: { value: 0 } }, flags: { flowstate: { omen: { owner: "x", wonder: DEATH } } } });
ok2(E.poleStacks(omen, {}, [death]) === 1 && E.poleStacks(death, {}, [omen]) === 1, "Attacks between it and an Omen of its paired Wonder are Strengthened, both ways");
ok2(E.poleStacks(orc, { mental: { mode: `${DEATH}:wither`, wonder: DEATH } }, [omen]) === 1 && E.poleStacks(orc, { mental: { mode: `${LIFE}:bloom`, wonder: LIFE } }, [omen]) === 0, "…and a Manifest of its paired Wonder at it (its own Wonder isn't)");
ok2(E.poleStacks(omen, {}, [orc]) === 0, "Anyone else: no change");
const o2 = E.attackStart(orc, { stacks: 0, notes: [], mental: { mode: `${DEATH}:wither`, wonder: DEATH } }, [omen]);
ok2(o2.stacks === 1 && o2.notes.some(x => /Pole-Bound/.test(x)), "The attack gets the stack and a note");
await death.delete();

console.log("== Channel (T2)");
hero.system.trees["mental-esoteric-arts"] = 2; hero.system.prepareDerivedData();
ok2(W.CHOICE_PROVIDERS.some(f => (f(hero, `${LIFE}:bloom`) ?? []).some(c => c.name === "channel")), "The Manifest dialog offers Channel through your Omen");
const ch = W.COST_PROVIDERS.map(f => f(hero, { mode: { wonder: LIFE }, wonder: { kind: "dream" }, choices: { channel: "yes" } })).find(x => x?.notes?.some(t => /Channel/.test(t)));
ok2(ch?.energy === Math.floor(Math.floor(hero.system.derived.effective.pon.value / 3) / 2) && ch.net === 1, "It costs half the Wonder's stat min in Energy; a Mode of the Omen's Wonder has Advantage");
const ch2 = W.COST_PROVIDERS.map(f => f(hero, { mode: { wonder: DEATH }, wonder: { kind: "nightmare" }, choices: { channel: "yes" } })).find(x => x?.notes?.some(t => /Channel/.test(t)));
ok2(ch2?.net === 0, "…another Wonder's doesn't");

console.log("== Unbind (T3)");
hero.system.trees["mental-esoteric-arts"] = 3; hero.system.prepareDerivedData();
fight(true); hero.system.ap.value = 6;
const max0 = omen.system.hp.max, hp0 = omen.system.hp.value;
await E.unbind(hero);
ok2(omen.system.stats.pon === 186 && omen.system.stats.will === 94 && D(omen).unbound && hero.system.ap.value === 4, "2 AP (and Energy): its full stats, twice the stat points");
ok2(omen.system.hp.max > max0 && omen.system.hp.value === hp0 + (omen.system.hp.max - max0), "Its current HP rises with its Max HP");
await W.pendingTurnStart(hero);
ok2(omen.system.stats.pon === 93 && !D(omen).unbound && omen.system.hp.value <= omen.system.hp.max, "The start of your next turn: back to normal, HP down to its normal Max HP");

console.log("== Kinship (T4)");
hero.system.trees["mental-esoteric-arts"] = 4; hero.system.prepareDerivedData();
omen.system.icon = { system: { tenet: `${LIFE}:verdant-soul`, profile: { valid: true, tenet: { wonder: LIFE, mult: 9 } } } };
hero.system.icon = { system: { tenet: `${DEATH}:mortal-coil`, profile: { valid: true, tenet: { wonder: DEATH, mult: 2 } } } };
let ts = W.tenetsOf(hero);
ok2(ts.length === 2 && ts[0].id === `${DEATH}:mortal-coil` && ts[1].id === `${LIFE}:verdant-soul` && ts[1].mult === 9, "Near your Omen you also benefit from its Tenet (at its numbers)");
ok2(W.tenetUses(hero, "mortalCoil") === 1, "…a different Tenet from your own: no extra trigger");
hero.system.icon = { system: { tenet: `${LIFE}:verdant-soul`, profile: { valid: true, tenet: { wonder: LIFE, mult: 2 } } } };
ok2(W.tenetsOf(hero).length === 1 && W.tenetUses(hero, "verdantSoul") === 2, "Its Tenet is your selected one: you can trigger it one more time a round");
hero.system.trees["mental-esoteric-arts"] = 3; hero.system.prepareDerivedData();
hero.system.icon = { system: { tenet: `${LIFE}:verdant-soul`, profile: { valid: true, tenet: { wonder: LIFE, mult: 2 } } } };
ok2(W.tenetsOf(hero).length === 1 && W.tenetUses(hero, "verdantSoul") === 1, "Without Kinship: nothing extra");
hero.system.icon = null;

console.log("== Rend (T5)");
await clearOmens();
hero.system.trees["mental-esoteric-arts"] = 5; hero.system.prepareDerivedData();
fight(true); hero.system.ap.value = 6; dialog = seedAnswer();
seq = [40, 2];
await E.rend(hero);
omen = omens()[0];
const ra = lastAtk()?.flags.flowstate.attack;
ok2(hero.system.ap.value === 4 && ra?.opts.mental?.omenRend && ra.opts.net === -1 && ra.opts.dodgeNet === 1, "2 AP: summoned at once; an attack roll with Disadvantage, it dodging with Advantage");
ok2(D(omen).bound && !D(omen).full && omen.system.stats.pon === 93 && C.list(hero).length === 1, "A hit: seeded and bound as normal (its stats normal, a Concentration)");
await clearOmens(); hero.system.ap.value = 6; dialog = seedAnswer();
seq = [1, 30];
await E.rend(hero);
omen = omens()[0];
ok2(D(omen).hostile && D(omen).full && omen.system.stats.pon === 186, "A miss: it arrives free with its full stats, and hostile");

console.log("== Natural items");
const MA = await import("../../module/martial.mjs");
const nat = MA.weaponProfile({ type: "bladed", weight: "light", material: "hardwood", grade: 1, natural: true }, { str: 47, dex: 47 });
const g1 = MA.weaponProfile({ type: "bladed", weight: "light", material: "hardwood", grade: 1 }, { str: 47, dex: 47 });
ok2(nat.natural && nat.capped === 47 && nat.grade === 4 && g1.capped === 10, "A natural weapon has no Grade cap (its Grade-based numbers count one per 10 of the stat)");
const SR = await import("../../module/shop-rules.mjs");
ok2(!SR.hasGrade({ type: "foci", system: { natural: true } }) && SR.hasGrade({ type: "foci", system: {} }), "…and no Grade to price or regrade");
const G = await import("../../module/magic.mjs");
const sh = G.shroudProfile({ shroudType: "bastion", grade: 1, natural: true, affixes: [] }, 47);
ok2(sh.natural && sh.mult === 4 && sh.scaling === 47, "Natural Shrouds (and Foci, armor, Icons) scale uncapped too");

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
if (fails) process.exit(1);
