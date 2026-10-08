/**
 * Currencies (pure, no Foundry globals): the world's list of currencies and what a character carries of each.
 *  - A currency has a name, a picture, and optionally one other currency it automatically merges into: once a character has `mergeAmount` of it,
 *    each batch of that many becomes one of the other (100 copper → 1 silver). Merges chain (silver → gold).
 *  - Currencies are positional: they are `c0`, `c1`, ... in the order the GM set them up, so renaming one never loses what characters hold.
 */

export const MAX_CURRENCIES = 12;
export const DEFAULT_IMG = "icons/commodities/currency/coin-embossed-crown-gold.webp";

/** The currency list a new world starts with: one currency. */
export const defaultCurrencies = () => [{ id: "c0", name: "Currency", img: DEFAULT_IMG, mergeInto: "", mergeAmount: 0 }];

/**
 * Make any stored list safe: 1 to MAX_CURRENCIES entries with positional ids, names, and merge rules that point at another currency and can't
 * loop back (a merge needs at least 2 to make one). Returns a new list.
 */
export function sanitizeCurrencies(raw, count = null) {
  let list = Array.isArray(raw) ? raw.filter(c => c && typeof c === "object") : [];
  const n = Math.max(1, Math.min(MAX_CURRENCIES, Math.floor(Number(count ?? list.length)) || 1));
  const out = Array.from({ length: n }, (_, i) => {
    const c = list[i] ?? {};
    return { id: `c${i}`, name: String(c.name ?? "").trim() || `Currency ${i + 1}`, img: String(c.img ?? "") || DEFAULT_IMG, mergeInto: String(c.mergeInto ?? ""), mergeAmount: Math.floor(Number(c.mergeAmount)) || 0 };
  });
  const ids = new Set(out.map(c => c.id));
  for (const c of out) {
    if (!c.mergeInto || c.mergeInto === c.id || !ids.has(c.mergeInto) || c.mergeAmount < 2) { c.mergeInto = ""; c.mergeAmount = 0; }
  }
  // No loops: walk each chain and cut the link that would close it.
  for (const c of out) {
    const seen = new Set([c.id]);
    let at = c;
    while (at.mergeInto) {
      if (seen.has(at.mergeInto)) { at.mergeInto = ""; at.mergeAmount = 0; break; }
      seen.add(at.mergeInto);
      at = out.find(x => x.id === at.mergeInto);
    }
  }
  return out;
}

/** Whole, non-negative amounts for each currency (anything else is 0). */
export function cleanAmounts(defs, amounts) {
  return Object.fromEntries(defs.map(c => [c.id, Math.max(0, Math.floor(Number(amounts?.[c.id]) || 0))]));
}

/**
 * Apply the merge rules: every batch of `mergeAmount` of a currency becomes one of the currency it merges into, down the chain.
 * Returns the new amounts for every currency.
 */
export function normalizeCurrency(defs, amounts) {
  const out = cleanAmounts(defs, amounts);
  for (let guard = 0; guard < defs.length * 4 + 4; guard++) {
    let moved = false;
    for (const c of defs) {
      if (!c.mergeInto || c.mergeAmount < 2) continue;
      const batches = Math.floor(out[c.id] / c.mergeAmount);
      if (!batches) continue;
      out[c.id] -= batches * c.mergeAmount;
      out[c.mergeInto] += batches;
      moved = true;
    }
    if (!moved) break;
  }
  return out;
}

/** What a sheet shows: each currency with its amount, and a note on how it merges. */
export function currencyRows(defs, amounts) {
  const clean = cleanAmounts(defs, amounts);
  return defs.map(c => {
    const into = c.mergeInto ? defs.find(x => x.id === c.mergeInto) : null;
    return { ...c, amount: clean[c.id], note: into ? `${c.mergeAmount} = 1 ${into.name}` : "" };
  });
}
