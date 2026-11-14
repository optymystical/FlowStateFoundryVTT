// Consumables: potions (health, bonus Energy, one per rest, giving), the bonus pool spent first and running out, the Festival Token's Advantage,
// the starting purse, the catalog entries and the packs' stable ids.
import { installFoundry } from "./support/foundry.mjs";
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 });
const { combat } = installFoundry({ roll: () => (seq.length ? seq.shift() : 10), dialog: c => dialog(c), messages, uuids });
const hooks = {};
globalThis.Hooks = { on: (n, fn) => (hooks[n] ??= []).push(fn), once: () => {}, callAll: () => {} };
foundry.utils.hasProperty = (o, k) => foundry.utils.getProperty(o, k) !== undefined;
const expand = flat => { const o = {}; for (const [k, v] of Object.entries(flat)) foundry.utils.setProperty(o, k, v); return o; };
const flatten = (o, p = "", out = {}) => { for (const [k, v] of Object.entries(o)) { const key = p ? `${p}.${k}` : k; if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out); else out[key] = v; } return out; };

const R = await import("../../module/consumables-rules.mjs");
const { FlowStateActorData } = await import("../../module/data.mjs");
const C = await import("../../module/catalog.mjs");
const cons = await import("../../module/consumables.mjs");
const actions = await import("../../module/actions.mjs");
const checks = await import("../../module/checks.mjs");
const { startingPurse, sanitizeCurrencies } = await import("../../module/currency-rules.mjs");
cons.register();
const set = (o, k, v) => foundry.utils.setProperty(o, k, v);

let fails = 0; const ok = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
function mkActor(name, extra = {}) {
  const a = { name, uuid: "Actor." + name, isOwner: true, items: [], statuses: new Set(), flags: {}, effects: [] };
  a.items.get = id => a.items.find(i => i.id === id);
  a.update = async u => {
    const changes = expand(u);
    for (const fn of hooks.preUpdateActor ?? []) fn(a, changes);
    for (const [k, v] of Object.entries(flatten(changes))) set(a, k, v);
    a.system.prepareDerivedData();
  };
  a.setFlag = async (s, k, v) => set(a.flags, `${s}.${k}`, v);
  a.getFlag = (s, k) => foundry.utils.getProperty(a.flags, `${s}.${k}`);
  a.toggleStatusEffect = async (id, { active }) => { active ? a.statuses.add(id) : a.statuses.delete(id); };
  a.getActiveTokens = () => [];
  a.system = Object.assign(Object.create(FlowStateActorData.prototype), { stats: { str: 30, dex: 30, con: 30, pon: 10, snap: 10, will: 20, reach: 10, grasp: 10, build: 20 }, skillPoints: 30, unspentStats: 0, statCarry: 0,
    trees: {}, size: 3, hp: { value: 100, lost: 0 }, energy: { value: 50, bonus: 0 }, ap: { value: 6 }, rp: { value: 6 }, conditions: { ignite: 0, stain: 0, slow: 0, haste: 0 }, lift: 0, daysWithoutRest: 0,
    senses: { sight: "primary", hearing: "primary", smell: "secondary" }, ...extra }, { parent: a });
  a.system.prepareDerivedData(); uuids.set(a.uuid, a); game.actors.push(a);
  return a;
}
function give(actor, key, system = {}) {
  const data = C.itemData(key, { system: { quantity: 1, ...system } });
  const item = { id: `i${actor.items.length}`, ...data, actor, system: { ...data.system } };
  item.update = async u => { for (const [k, v] of Object.entries(u)) set(item, k, v); };
  item.delete = async () => { actor.items.splice(actor.items.indexOf(item), 1); };
  actor.items.push(item);
  return item;
}

console.log("== Rules");
ok(R.potionAmount(R.POTIONS.healthLesser, { restHeal: 31 }) === 15 && R.potionAmount(R.POTIONS.healthGreater, { restHeal: 31 }) === 62, "Health: half / double the rest heal, rounded down");
ok(R.potionAmount(R.POTIONS.energy, { energyMax: 150 }) === 150 && R.potionAmount(R.POTIONS.energyLesser, { energyMax: 151 }) === 75, "Energy: × max Energy, rounded down");
ok(JSON.stringify(R.spendBonusFirst(50, 40, 30)) === JSON.stringify({ value: 50, bonus: 20 }), "A 10 Energy spend comes off a 30 bonus pool first");
ok(JSON.stringify(R.spendBonusFirst(50, 10, 30)) === JSON.stringify({ value: 40, bonus: 0 }), "...and the rest off your own Energy");
ok(R.bonusExpired({ time: 100, combat: "C", round: 11 }, { time: 500, combatId: "C", round: 10 }) === false, "In its combat the rounds decide (round 10 < 11: still there)");
ok(R.bonusExpired({ time: 100, combat: "C", round: 11 }, { time: 0, combatId: "C", round: 11 }) === true, "...and it ends at round 11");
ok(R.bonusExpired({ time: 100, combat: null }, { time: 100 }) === true && R.bonusExpired({ time: 100 }, { time: 99 }) === false, "Outside it, world time decides");
ok(R.tokenUses({ charges: null }) === 3 && R.tokenUses({ charges: 0 }) === 0, "A new token has 3 uses");

console.log("== Catalog");
ok(C.ITEM_CATALOG["potion.health"]?.price === 500 && C.ITEM_CATALOG["potion.energyGreater"]?.price === 1200, "Potions are catalog entries with their prices");
ok(C.keyFor("gear", { use: "potion", potion: "energyLesser" }) === "potion.energyLesser" && C.keyFor("gear", { use: "token" }) === R.TOKEN_KEY, "An item's identity finds its potion / token entry");
ok(C.keyFor("gear", { ammoType: "", body: 0 }) === "gear.misc", "A plain Misc item still links to Misc item");

console.log("== Drinking");
combat.round = 3;
const hero = mkActor("Hero");
combat.combatants = [{ actor: hero }]; combat.combatant = { actor: hero };
const rest = hero.system.derived.restHeal;
const hp = give(hero, "potion.health", { quantity: 2 });
await cons.usePotion(hero, hp);
ok(hero.system.hp.value === Math.min(hero.system.hp.max, 100 + rest), `A Health potion heals the rest heal (${rest})`);
ok(hp.system.quantity === 1 && hero.getFlag("flowstate", "potionUsed") === true, "One is used up, and the one potion per rest is spent");
const was = hero.system.hp.value;
await cons.usePotion(hero, hp);
ok(hero.system.hp.value === was && hp.system.quantity === 1, "A second potion before resting is refused");
hero.flags.flowstate.potionUsed = false;
const ep = give(hero, "potion.energyLesser");
await cons.usePotion(hero, ep);
const half = Math.floor(hero.system.energy.max / 2);
ok(hero.system.energy.bonus === half && hero.system.energy.total === 50 + half, `A Lesser Energy potion: +${half} bonus Energy on top of your own`);
ok(!hero.items.includes(ep), "The last potion of a stack is gone");
ok(hero.getFlag("flowstate", "energyBonus")?.round === 13, "In combat it lasts 10 rounds");

console.log("== Bonus Energy is spent first");
await actions.spendEnergy(hero, 10, "a test");
ok(hero.system.energy.value === 50 && hero.system.energy.bonus === half - 10, "A spend comes off the bonus pool");
await actions.spendEnergy(hero, half + 5, "a big test");
ok(hero.system.energy.bonus === 0 && hero.system.energy.value === 50 - 15, "...then your own Energy");
await hero.update({ "system.energy.bonus": 20, "flags.flowstate.energyBonus": { time: 0, combat: "C", round: 13 } });
ok(await actions.spendEnergy(hero, 50, "more than own") && hero.system.energy.value === 5 && hero.system.energy.bonus === 0, "You can afford what your own Energy plus the pool covers");
await hero.update({ "system.energy.bonus": 20 });
combat.round = 12; await cons.turnStart(combat, hero);
ok(hero.system.energy.bonus === 20, "Round 12: still there");
combat.round = 13; await cons.turnStart(combat, hero);
ok(hero.system.energy.bonus === 0, "Round 13, at your turn: it runs out");

console.log("== Afraid, dead, giving");
hero.flags.flowstate.potionUsed = false;
hero.statuses.add("fear");
const ep2 = give(hero, "potion.energy");
await cons.usePotion(hero, ep2);
ok(hero.system.energy.bonus === 0 && hero.items.includes(ep2), "An afraid creature can't gain Energy: the potion isn't drunk");
hero.statuses.delete("fear");
const ally = mkActor("Ally", { hp: { value: 40, lost: 0 } });
const hp2 = give(hero, "potion.healthLesser");
game.user.targets = new Set([{ actor: ally }]);
const ap = hero.system.ap.value;
await cons.usePotion(hero, hp2, { give: true });
ok(ally.system.hp.value === 40 + Math.floor(ally.system.derived.restHeal / 2) && ally.getFlag("flowstate", "potionUsed") && !hero.getFlag("flowstate", "potionUsed"), "Giving: the ally is healed and uses their one potion per rest");
ok(hero.system.ap.value === ap - 1, "The giver pays the 1 AP");
game.user.targets = new Set();

console.log("== Festival Token");
const tok = give(hero, R.TOKEN_KEY, { checkType: "attack" });
await cons.useToken(hero, tok);
ok(tok.system.charges === 2 && hero.getFlag("flowstate", "edge")?.includes("attack"), "A use arms Advantage on the next attack roll");
const { takeEdge } = await import("../../module/edge.mjs");
ok((await takeEdge(hero, "stealth")) === 0 && (await takeEdge(hero, "attack")) === 1 && (await takeEdge(hero, "attack")) === 0, "Only that kind of roll takes it, once");
tok.system.charges = 0;
await cons.useToken(hero, tok);
ok(hero.items.includes(tok) && !hero.getFlag("flowstate", "edge")?.length, "At 0 uses it stays as a keepsake and does nothing");
const rows = cons.actionRows(hero).map(r => r.label);
ok(rows.some(l => l.startsWith("Drink:")) && rows.some(l => l.startsWith("Give:")) && !rows.some(l => l.startsWith("Festival Token")), "Action List: drink and give rows; a spent token has none");
// The token's Advantage reaches a Non Stat Check.
const tok2 = give(hero, R.TOKEN_KEY, { checkType: "stealth" });
await cons.useToken(hero, tok2);
let rolled = null; const realEval = actions.rollKit.evaluate;
actions.rollKit.evaluate = async f => { rolled = f; return realEval(f); };
dialog = () => ({ vs: "", net: 0 });
await checks.rollCheck(hero, "stealth");
actions.rollKit.evaluate = realEval;
ok(/2d30kh|kh/.test(String(rolled)) && !hero.getFlag("flowstate", "edge")?.includes("stealth"), `A Stealth check rolls with Advantage (${rolled}) and uses it up`);

console.log("== Infected");
const sick = mkActor("Sick");
sick.statuses.add("infected");
await actions.applyDamage(sick, 0, "heat", { silent: true });
ok(sick.statuses.has("infected"), "No heat damage, still Infected");
await actions.applyDamage(sick, 5, "cold", { silent: true });
ok(sick.statuses.has("infected"), "Cold damage doesn't clear it");
await actions.applyDamage(sick, 5, "heat", { silent: true });
ok(!sick.statuses.has("infected"), "Heat damage clears it");

console.log("== Starting purse");
const defs = sanitizeCurrencies([{ name: "Shards", start: 100 }, { name: "Crowns", start: 0 }]);
ok(JSON.stringify(startingPurse(defs)) === JSON.stringify({ c0: 100 }), "Each currency's starting amount (Shards: 100)");
const merging = sanitizeCurrencies([{ name: "Bits", start: 250, mergeInto: "c1", mergeAmount: 100 }, { name: "Shards" }]);
ok(JSON.stringify(startingPurse(merging)) === JSON.stringify({ c0: 50, c1: 2 }), "...merged like any amounts");

console.log("== Pack ids");
const { stableId } = await import("../tools/build-packs-ids.mjs");
ok(stableId("item:potion.health") === stableId("item:potion.health") && /^[A-Za-z0-9]{16}$/.test(stableId("item:potion.health")) && stableId("item:potion.health") !== stableId("item:potion.energy"), "Pack ids are 16 letters and digits, the same every build");

if (fails) { console.log(`${fails} failed`); process.exit(1); }
console.log("consumables tests passed");
