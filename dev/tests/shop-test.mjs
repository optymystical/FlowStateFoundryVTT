// Shops: prices (catalog, rarity, the flat per-Grade amount, markup and sell rate), paying in linked currencies, random stock, and buying and selling.
import { installFoundry } from "./support/foundry.mjs";
const messages = [], uuids = new Map();
installFoundry({ roll: () => 10, dialog: () => ({}), messages, uuids });
await import("../../module/store-catalog.mjs");
const R = await import("../../module/shop-rules.mjs");
const C = await import("../../module/catalog.mjs");
let fails = 0; const ok = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };

const DEFS = [
  { id: "c0", name: "Gold", mergeInto: "", mergeAmount: 0 }, { id: "c1", name: "Silver", mergeInto: "c0", mergeAmount: 100 },
  { id: "c2", name: "Copper", mergeInto: "c1", mergeAmount: 100 }, { id: "c3", name: "Gems", mergeInto: "", mergeAmount: 0 }
];
const P = R.sanitizePricing({ rarity: { common: 10, uncommon: 50, rare: 250, veryRare: 1000 }, perGrade: 10 });

console.log("== Prices");
const sword = { type: "weapon", system: { weaponType: "bladed", grade: 3, rarity: "uncommon", price: null } };
ok(R.unitPrice(sword, P) === 50 + 20, "No price of its own: its rarity's (Uncommon 50), plus 10 for each Grade above 1 (Grade 3: 70)");
ok(R.unitPrice({ ...sword, system: { ...sword.system, price: 15, grade: 1 } }, P) === 15, "Its catalog price wins; Grade 1 adds nothing");
ok(R.unitPrice({ type: "gear", system: { rarity: "common", price: 2, grade: 5 } }, P) === 2 && R.unitPrice({ type: "weapon", system: { weaponType: "unarmed", grade: 9, rarity: "common" } }, P) === 10, "Misc items and Unarmed have no Grade to add");
ok(R.buyPrice(sword, { markup: 125 }, P) === 88 && R.sellPrice(sword, { sellRate: 50 }, P) === 35, "A shop sells at its markup (125%: 88, rounded up) and buys at its rate (50%: 35, rounded down)");
ok(R.buyPrice({ ...sword, flags: { flowstate: { shop: { price: 5 } } } }, { markup: 300 }, P) === 5, "A stock row's own price wins over everything");
ok(R.stockOf({ type: "gear", system: { quantity: 40 } }) === 40 && R.stockOf({ type: "weapon", system: {} }) === 1 && R.stockOf({ type: "armor", flags: { flowstate: { shop: { count: 3 } } } }) === 3 && R.stockOf({ type: "armor", flags: { flowstate: { shop: { infinite: true } } } }) === Infinity, "Stock: a Misc item's quantity, a count, or unlimited");

console.log("== Paying in linked currencies");
ok(R.lowestOf(DEFS, "c0") === "c2" && R.priceCurrency(DEFS, P) === "c2" && R.priceCurrency(DEFS, { currency: "c1" }) === "c1", "Prices are in the smallest currency of the first's chain (Copper), unless the world picks another");
ok(JSON.stringify(R.worths(DEFS, "c2")) === JSON.stringify({ c2: 1, c1: 100, c0: 10000 }), "Silver is worth 100 Copper, Gold 10,000; Gems aren't linked");
let r = R.pay(DEFS, { c0: 1, c1: 0, c2: 30, c3: 5 }, 250, "c2");
ok(r.ok && r.amounts.c0 === 0 && r.amounts.c1 === 97 && r.amounts.c2 === 80 && r.amounts.c3 === 5, "1 Gold 30 Copper pays 250 Copper: 97 Silver 80 Copper change, the Gems untouched");
r = R.pay(DEFS, { c1: 2, c2: 10 }, 250, "c2");
ok(!r.ok && r.short === 40, "Short by 40 Copper: no sale");
{ const e = R.earn(DEFS, { c2: 90, c3: 1 }, 15, "c2"); ok(e.c0 === 0 && e.c1 === 1 && e.c2 === 5 && e.c3 === 1, "Getting paid merges up (90 + 15 Copper = 1 Silver 5 Copper)"); }
ok(R.formatPrice(DEFS, 10250, "c2") === "1 Gold, 2 Silver, 50 Copper" && R.formatPrice(DEFS, 0, "c2") === "0 Copper", "Prices read as coins");

console.log("== Random stock");
let seed = 1; const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const all = C.listEntries({ hidden: true }).map(e => ({ ...e }));
all.find(e => e.key === "weapon.bladed.light.hardwood").hidden = true;
const picks = R.pickStock(all, { count: 30, types: ["weapon", "gear"], rarities: ["common"], gradeMin: 2, gradeMax: 4, quantity: 3 }, rng);
const keys = picks.map(p => p.key), entry = k => C.ITEM_CATALOG[k];
ok(picks.length === 30 && new Set(keys).size === 30, "30 different entries");
ok(keys.every(k => ["weapon", "gear"].includes(entry(k).type) && entry(k).rarity === "common") && !keys.includes("weapon.unarmed") && !keys.includes("weapon.bladed.light.hardwood"), "Only the chosen kinds and rarities; never Unarmed or a hidden entry");
ok(picks.every(p => (entry(p.key).type === "gear" ? p.grade === 1 : p.grade >= 2 && p.grade <= 4) && p.quantity === 3), "Grades in the range (Misc items have none), and 3 of each");
ok(R.pickStock(all, { count: 5, search: "Steel", types: ["weapon"], rarities: ["uncommon"] }, rng).every(p => /Steel/.test(entry(p.key).name)), "A word in the name narrows it (Steel)");

console.log("== Buying and selling (the GM's side)");
const player = { id: "p1", isGM: false, active: true };
game.users.push(player); game.users.get = id => game.users.find(u => u.id === id);
game.user = { id: "gm", isGM: true, targets: new Set() };
game.settings.get = (ns, k) => (k === "currencies" ? DEFS.map(d => ({ ...d, img: "" })) : k === "shopPricing" ? P : false);
let nid = 0;
const mkItems = owner => { const list = []; return Object.assign(list, { get: id => list.find(i => i.id === id), get contents() { return [...list]; }, get size() { return list.length; } }); };
const mkItem = (owner, data) => {
  const i = { id: `i${++nid}`, ...structuredClone(data), parent: owner, actor: owner };
  i.flags ??= {};
  i.toObject = () => structuredClone({ name: i.name, type: i.type, img: i.img, system: i.system, flags: i.flags });
  i.update = async u => { for (const [k, v] of Object.entries(u)) foundry.utils.setProperty(i, k, v); };
  i.delete = async () => { owner.items.splice(owner.items.indexOf(i), 1); };
  return i;
};
const mkActor = (name, type, system, perm = () => true) => {
  const a = { name, type, uuid: `Actor.${name}`, system, items: null, flags: {}, testUserPermission: perm };
  a.items = mkItems(a);
  a.update = async u => { for (const [k, v] of Object.entries(u)) foundry.utils.setProperty(a, k, v); };
  a.createEmbeddedDocuments = async (t, list) => list.map(d => { const i = mkItem(a, d); a.items.push(i); return i; });
  a.deleteEmbeddedDocuments = async (t, ids) => { for (const id of ids) a.items.splice(a.items.findIndex(i => i.id === id), 1); };
  uuids.set(a.uuid, a);
  return a;
};
const shop = mkActor("Smithy", "shop", { open: true, markup: 100, buys: true, sellRate: 50, random: {} }, (u, lvl) => lvl === "OBSERVER");
const hero = mkActor("Hero", "character", { currency: { c0: 0, c1: 2, c2: 0, c3: 0 } }, u => u.id === "p1");
const villain = mkActor("Villain", "character", { currency: { c0: 9 } }, () => false);
const { GM_ACTIONS } = await import("../../module/actions.mjs");
await import("../../module/shop.mjs");
const steel = C.itemData("weapon.swift.light.steel", { grade: 2 });
const stocked = mkItem(shop, { ...steel, system: { ...steel.system, rarity: "uncommon", price: null }, flags: { flowstate: { shop: { count: 2 } } } }); shop.items.push(stocked);
const arrows = mkItem(shop, { ...C.itemData("ammo.rapid"), system: { ...C.itemData("ammo.rapid").system, quantity: 150, rarity: "common", price: 1 } }); shop.items.push(arrows);
await GM_ACTIONS.shopBuy({ target: shop.uuid, buyer: hero.uuid, item: stocked.id, quantity: 1 }, "p1");
ok(hero.items.length === 1 && hero.items[0].system.grade === 2 && !hero.items[0].flags?.flowstate?.shop && hero.system.currency.c1 === 1 && hero.system.currency.c2 === 40, "Hero buys the Grade 2 Light Swift (Steel) for 60 Copper (Uncommon 50 + 10): 1 Silver 40 Copper left");
ok(R.stockOf(stocked) === 1 && /buys/.test(messages.at(-1).content) && messages.at(-1).whisper.includes("p1"), "…the shop has one left, and the receipt is whispered to the player and the GM");
await GM_ACTIONS.shopBuy({ target: shop.uuid, buyer: hero.uuid, item: arrows.id, quantity: 30 }, "p1");
ok(hero.items.find(i => i.type === "gear")?.system.quantity === 30 && arrows.system.quantity === 120 && hero.system.currency.c1 === 1 && hero.system.currency.c2 === 10, "30 arrows at 1 Copper each: they stack, the shop keeps 120");
stocked.flags.flowstate.shop.price = 500;
await GM_ACTIONS.shopBuy({ target: shop.uuid, buyer: hero.uuid, item: stocked.id, quantity: 1 }, "p1");
ok(hero.items.filter(i => i.type === "weapon").length === 1 && /can't afford/.test(messages.at(-1).content) && hero.system.currency.c2 === 10 && R.stockOf(stocked) === 1, "Priced at 500 Copper with 110 to spend: nothing changes hands");
delete stocked.flags.flowstate.shop.price;
await GM_ACTIONS.shopBuy({ target: shop.uuid, buyer: villain.uuid, item: arrows.id, quantity: 1 }, "p1");
ok(!villain.items.length && villain.system.currency.c0 === 9, "A player can't buy for (or spend the money of) a character they don't own");
const sold = hero.items.find(i => i.type === "weapon");
sold.system.equipped = true;
await GM_ACTIONS.shopSell({ target: shop.uuid, seller: hero.uuid, item: sold.id, quantity: 1 }, "p1");
ok(hero.items.includes(sold) && /in use/.test(messages.at(-1).content), "Something held can't be sold");
sold.system.equipped = false;
await GM_ACTIONS.shopSell({ target: shop.uuid, seller: hero.uuid, item: sold.id, quantity: 1 }, "p1");
ok(!hero.items.includes(sold) && hero.system.currency.c2 === 40 && R.stockOf(stocked) === 2, "Selling it back pays 30 Copper (half of 60) and it rejoins the shop's stock");
shop.system.buys = false;
const quiver = hero.items.find(i => i.type === "gear");
await GM_ACTIONS.shopSell({ target: shop.uuid, seller: hero.uuid, item: quiver.id, quantity: 5 }, "p1");
ok(quiver.system.quantity === 30 && /isn't buying/.test(messages.at(-1).content), "A shop that doesn't buy turns sales down");
shop.system.open = false;
await GM_ACTIONS.shopBuy({ target: shop.uuid, buyer: hero.uuid, item: arrows.id, quantity: 1 }, "p1");
ok(/closed/.test(messages.at(-1).content) && arrows.system.quantity === 120, "A closed shop sells nothing");
const { relayAllowed } = await import("../../module/relay-guard.mjs");
ok(relayAllowed("shopBuy", { target: "a", buyer: "b", item: "c", quantity: 2 }, GM_ACTIONS) && !relayAllowed("shopBuy", { target: "a", buyer: "b", item: "c", quantity: 1e9 }, GM_ACTIONS)
  && !relayAllowed("shopSell", { target: "a", seller: { x: 1 }, item: "c", quantity: 1 }, GM_ACTIONS), "The relay only takes shop requests made of ids and a sane quantity");

console.log("== Regrading");
{ const sword = { type: "weapon", system: { weaponType: "bladed", grade: 2, rarity: "uncommon" } };
  ok(R.regradeBlock(sword, {}) && /kind of item/.test(R.regradeBlock(sword, {})), "By default a shop regrades nothing");
  const rules = { types: ["weapon"], rarities: ["common", "uncommon"], surcharge: 25, maxGrade: 5 };
  ok(R.regradeBlock(sword, rules) === null && /rarity/.test(R.regradeBlock({ ...sword, system: { ...sword.system, rarity: "rare" } }, rules)) && /kind/.test(R.regradeBlock({ type: "armor", system: { grade: 1, rarity: "common" } }, rules)), "It works on the kinds and rarities the GM ticks");
  ok(/up to Grade 5/.test(R.regradeBlock({ ...sword, system: { ...sword.system, grade: 5 } }, rules)) && R.regradeBlock({ type: "affix", system: { rarity: "common" } }, { ...rules, types: ["weapon", "affix"] }) === "it has no Grade", "…up to its highest Grade; things without a Grade never");
  ok(R.regradeCost(sword, 4, rules, P) === 25 && R.regradeCost(sword, 3, { ...rules, surcharge: 0 }, P) === 10, "Grade 2 → 4: 2 × 10 per Grade + 25% = 25 (no surcharge, one Grade: 10)");
  shop.system.open = true;
  shop.system.regrade = rules;
  hero.system.currency = { c0: 0, c1: 0, c2: 30 };
  const blade = mkItem(hero, { ...C.itemData("weapon.bladed.light.steel", { grade: 2 }) }); blade.system.rarity = "uncommon"; hero.items.push(blade);
  await GM_ACTIONS.shopRegrade({ target: shop.uuid, owner: hero.uuid, item: blade.id, grade: 4 }, "p1");
  ok(blade.system.grade === 4 && hero.system.currency.c2 === 5 && /Grade 2 to <strong>Grade 4/.test(messages.at(-1).content), "Hero pays 25 Copper and the blade is now Grade 4 (receipt whispered)");
  await GM_ACTIONS.shopRegrade({ target: shop.uuid, owner: hero.uuid, item: blade.id, grade: 9 }, "p1");
  ok(blade.system.grade === 4 && /can't afford/.test(messages.at(-1).content), "Asking past the shop's top Grade asks for Grade 5 only, and without the money nothing changes");
  hero.system.currency.c1 = 1;
  await GM_ACTIONS.shopRegrade({ target: shop.uuid, owner: hero.uuid, item: blade.id, grade: 9 }, "p1");
  ok(blade.system.grade === 5, "With the money, it stops at the shop's Grade 5");
  await GM_ACTIONS.shopRegrade({ target: shop.uuid, owner: villain.uuid, item: blade.id, grade: 6 }, "p1");
  ok(blade.system.grade === 5, "Nobody regrades through a character they don't own");
  ok(relayAllowed("shopRegrade", { target: "a", owner: "b", item: "c", grade: 3 }, GM_ACTIONS) && !relayAllowed("shopRegrade", { target: "a", owner: "b", item: "c", grade: "3" }, GM_ACTIONS), "The relay only takes regrade requests of ids and a whole Grade"); }

console.log(fails ? `\n${fails} FAILED` : "\nAll shop checks passed");
if (fails) process.exit(1);
