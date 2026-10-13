/**
 * Affixes used to sit in a list on a Foci or Shroud. They are items of their own now (attuned separately, to the Offensive or Defensive form),
 * so any old list is turned into Affix items the first time the GM's client sees it. Idempotent: an item with an empty list is left alone.
 */
import { AFFIXES } from "./magic.mjs";

/** What to do for one actor: Affix items to create and Foci/Shroud list clears. Pure. */
export function legacyAffixPlan(actor) {
  const create = [], clear = [];
  for (const item of actor?.items ?? []) {
    if (item.type !== "foci" && item.type !== "shroud") continue;
    const keys = [...new Set((item.system.affixes ?? []).filter(k => AFFIXES[k]))];
    if (!item.system.affixes?.length) continue;
    const side = item.type === "foci" ? "offensive" : "defensive";
    for (const k of keys) {
      if (create.some(c => c.system.affix === k && c.system.side === side)) continue;
      create.push({ name: AFFIXES[k].label, type: "affix", img: "icons/commodities/gems/gem-faceted-diamond-blue.webp", system: { affix: k, side, attuned: !!item.system.attuned } });
    }
    clear.push({ _id: item.id, "system.affixes": [] });
  }
  return { create, clear };
}

/** Run it over every actor the GM can see (world actors and unlinked tokens on the active scene). */
export async function migrateAffixes() {
  const actors = new Set(game.actors.contents);
  for (const t of canvas?.scene?.tokens ?? []) if (t.actor && !t.actorLink) actors.add(t.actor);
  let n = 0;
  for (const actor of actors) {
    const { create, clear } = legacyAffixPlan(actor);
    if (!clear.length) continue;
    // Skip Affixes the actor already has as items (a half-finished earlier run).
    const have = new Set(actor.items.filter(i => i.type === "affix").map(i => `${i.system.affix}|${i.system.side}`));
    const fresh = create.filter(c => !have.has(`${c.system.affix}|${c.system.side}`));
    if (fresh.length) await actor.createEmbeddedDocuments("Item", fresh, { flowstateAuto: true });
    await actor.updateEmbeddedDocuments("Item", clear, { flowstateAuto: true });
    n += fresh.length;
  }
  if (n) ui.notifications.info(`Flow State: ${n} Affix${n === 1 ? "" : "es"} moved from Foci and Shrouds into Affix items (Equipment tab). Each is attuned like the item it was on.`);
}
