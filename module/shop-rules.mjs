/**
 * Shops (pure, no Foundry globals): what an item costs, paying for it in the world's currencies, and picking a random stock.
 *
 * Prices are whole amounts of one currency (the world's **price currency**: by default the smallest one, the bottom of the chain the first
 * currency is in). An item's price is its catalog entry's price, or, if it has none, the world's price for its rarity; each Grade above 1 adds a
 * flat amount (the world's per-Grade price). A shop sells at its markup and buys at its sell rate, both percentages of that price. Paying takes
 * every currency linked to the price currency by merge rules (silver = 100 copper...) at its worth, and gives change by the same rules.
 */

export const DEFAULT_PRICING = { rarity: { common: 10, uncommon: 50, rare: 250, veryRare: 1000 }, perGrade: 10, currency: "" };
const whole = (v, d = 0) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : d);

/** The world's pricing, made safe. */
export function sanitizePricing(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  const rarity = {};
  for (const [k, v] of Object.entries(DEFAULT_PRICING.rarity)) rarity[k] = whole(r.rarity?.[k], v);
  return { rarity, perGrade: whole(r.perGrade, DEFAULT_PRICING.perGrade), currency: typeof r.currency === "string" ? r.currency : "" };
}

/** Does Grade change this item's price? (Misc items, Affixes and Unarmed have no Grade.) */
export const hasGrade = item => !!item && !["gear", "affix"].includes(item.type) && item.system?.weaponType !== "unarmed";

/** An item's price before a shop's markup: its own (catalog) price, else its rarity's, plus the per-Grade amount for each Grade above 1. */
export function unitPrice(item, pricing = DEFAULT_PRICING) {
  const p = sanitizePricing(pricing), s = item?.system ?? {};
  const own = s.price;
  const base = own !== null && own !== undefined && own !== "" && Number.isFinite(Number(own)) ? whole(own) : (p.rarity[s.rarity] ?? p.rarity.common);
  return base + (hasGrade(item) ? p.perGrade * Math.max(0, whole(s.grade, 1) - 1) : 0);
}

/** What a shop charges for one: the stock row's own price if the GM set one, else the price at the shop's markup (rounded up). */
export function buyPrice(item, shop = {}, pricing = DEFAULT_PRICING) {
  const own = item?.flags?.flowstate?.shop?.price;
  if (own !== null && own !== undefined && own !== "" && Number.isFinite(Number(own))) return whole(own);
  return Math.ceil(unitPrice(item, pricing) * whole(shop.markup ?? 100, 100) / 100);
}

/** What a shop pays for one: the price at its sell rate (rounded down). */
export const sellPrice = (item, shop = {}, pricing = DEFAULT_PRICING) => Math.floor(unitPrice(item, pricing) * whole(shop.sellRate ?? 50, 50) / 100);

/** How many a stock row has (Misc items: their quantity; anything else: its count), or Infinity. */
export function stockOf(item) {
  const f = item?.flags?.flowstate?.shop ?? {};
  if (f.infinite) return Infinity;
  return item?.type === "gear" ? whole(item.system?.quantity, 0) : whole(f.count ?? 1, 1);
}

/* ---- Currency ---- */

/** The smallest currency of the chain `id` is in (follow whatever merges into it, down to the bottom). */
export function lowestOf(defs, id) {
  let at = defs.find(c => c.id === id) ?? defs[0];
  const seen = new Set();
  for (;;) {
    if (!at || seen.has(at.id)) return at?.id ?? null;
    seen.add(at.id);
    const below = defs.find(c => c.mergeInto === at.id && c.mergeAmount >= 2);
    if (!below) return at.id;
    at = below;
  }
}

/** The currency prices are in: the world's choice, or the smallest one in the first currency's chain. */
export const priceCurrency = (defs, pricing = DEFAULT_PRICING) => (defs.some(c => c.id === pricing?.currency) ? pricing.currency : lowestOf(defs, defs[0]?.id));

/** What each currency linked to `unit` is worth in it (unit = 1, the one it merges into = its merge amount, and so on up). Others aren't listed. */
export function worths(defs, unit) {
  const out = { [unit]: 1 };
  let at = defs.find(c => c.id === unit), worth = 1;
  const seen = new Set([unit]);
  while (at?.mergeInto && at.mergeAmount >= 2 && !seen.has(at.mergeInto)) {
    worth *= at.mergeAmount;
    out[at.mergeInto] = worth;
    seen.add(at.mergeInto);
    at = defs.find(c => c.id === at.mergeInto);
  }
  return out;
}

/** What someone holding `amounts` has, counted in `unit`. */
export function wealth(defs, amounts, unit) {
  const w = worths(defs, unit);
  return Object.entries(w).reduce((n, [id, x]) => n + whole(amounts?.[id]) * x, 0);
}

/** Their money laid out again in the fewest coins (all of it in the unit, then merged up by the rules). Currencies not linked are untouched. */
function lay(defs, amounts, unit, total) {
  const w = worths(defs, unit);
  const out = { ...amounts };
  for (const id of Object.keys(w)) out[id] = 0;
  let left = Math.max(0, total);
  for (const id of Object.keys(w).sort((a, b) => w[b] - w[a])) { out[id] = Math.floor(left / w[id]); left -= out[id] * w[id]; }
  return out;
}

/** Pay `price` (in `unit`) out of `amounts`. Returns { ok, amounts } (the amounts after paying, with change), or ok false if they can't. */
export function pay(defs, amounts, price, unit) {
  const have = wealth(defs, amounts, unit), cost = whole(price);
  if (have < cost) return { ok: false, amounts, short: cost - have };
  return { ok: true, amounts: lay(defs, amounts, unit, have - cost) };
}
/** Receive `value` (in `unit`). */
export const earn = (defs, amounts, value, unit) => lay(defs, amounts, unit, wealth(defs, amounts, unit) + whole(value));

/** An amount in `unit` as coins: "1 Gold, 2 Silver, 50 Copper" ("0 Copper" for nothing). */
export function formatPrice(defs, value, unit) {
  const w = worths(defs, unit);
  const coins = lay(defs, {}, unit, whole(value));
  const parts = Object.keys(w).sort((a, b) => w[b] - w[a]).filter(id => coins[id] > 0).map(id => `${coins[id]} ${defs.find(c => c.id === id)?.name ?? id}`);
  return parts.length ? parts.join(", ") : `0 ${defs.find(c => c.id === unit)?.name ?? ""}`.trim();
}

/* ---- Random stock ---- */

export const DEFAULT_RANDOM = { count: 8, types: ["weapon", "armor", "foci", "shroud", "icon", "affix", "gear"], rarities: ["common", "uncommon"], named: false, search: "", gradeMin: 1, gradeMax: 3, quantity: 1 };

/** Random stock rules, made safe. */
export function sanitizeRandom(raw = {}) {
  const r = { ...DEFAULT_RANDOM, ...(raw && typeof raw === "object" ? raw : {}) };
  const g1 = Math.max(1, whole(r.gradeMin, 1)), g2 = Math.max(g1, whole(r.gradeMax, g1));
  return { count: Math.min(200, whole(r.count, 8)), types: Array.isArray(r.types) ? r.types.map(String) : DEFAULT_RANDOM.types,
    rarities: Array.isArray(r.rarities) ? r.rarities.map(String) : DEFAULT_RANDOM.rarities, named: !!r.named, search: String(r.search ?? "").trim(),
    gradeMin: g1, gradeMax: g2, quantity: Math.max(1, whole(r.quantity, 1)) };
}

/**
 * Pick a random stock from catalog entries ([{ key, type, rarity, name, named, hidden, system }]) by the rules: kinds, rarities, named only, a word in
 * the name, how many, a Grade range and how many of each. No entry twice; hidden entries and Unarmed are never picked. `rng()` returns [0, 1).
 * Returns [{ key, grade, quantity }].
 */
export function pickStock(entries, rawRules = {}, rng = Math.random) {
  const r = sanitizeRandom(rawRules), q = r.search.toLowerCase();
  const pool = entries.filter(e => !e.hidden && e.key !== "weapon.unarmed" && r.types.includes(e.type) && r.rarities.includes(e.rarity ?? "common")
    && (!r.named || e.named) && (!q || String(e.name).toLowerCase().includes(q)));
  const out = [];
  while (out.length < r.count && pool.length) {
    const [e] = pool.splice(Math.floor(rng() * pool.length), 1);
    const grade = hasGrade(e) ? r.gradeMin + Math.floor(rng() * (r.gradeMax - r.gradeMin + 1)) : 1;
    out.push({ key: e.key, grade, quantity: r.quantity });
  }
  return out;
}
