/**
 * Items and the catalog (Foundry side; catalog.mjs has the rules): giving an item from the catalog, keeping an item linked to its entry when the
 * GM changes it, and the one-time conversion of the Items sidebar into named catalog entries.
 */
import { ITEM_CATALOG, ITEM_TYPES, IDENTITY, linkFor, itemData, keyFor, namedKey, isGenerated } from "./catalog.mjs";
import { withEntry } from "./store.mjs";
import { getWorldData, setWorldData } from "./world-data.mjs";
import { esc } from "./html.mjs";

/** What an item says about itself beyond its identity fields: changed here, they become overrides on this copy. */
const OWN = ["description", "pounds", "volume", "price"];

/**
 * Give `actor` a copy of a catalog entry at a Grade. Stackable things (ammunition, Misc items of the same entry) add to the stack instead.
 * Returns the item created or topped up.
 */
export async function giveEntry(actor, key, { grade = 1, quantity = 1 } = {}) {
  const data = itemData(key, { grade });
  if (!actor || !data) return null;
  if (data.type === "gear") {
    const stack = actor.items.find(i => i.type === "gear" && i.system.base === key && !i.system.overrides?.length);
    if (stack) { await stack.update({ "system.quantity": (stack.system.quantity ?? 0) + Math.max(1, quantity) }); return stack; }
    data.system.quantity = Math.max(1, quantity);
  }
  const [item] = await actor.createEmbeddedDocuments("Item", [data]);
  if (item) ui.notifications.info(`${actor.name} gets ${item.name}${data.system.grade ? ` (Grade ${data.system.grade})` : ""}.`);
  return item ?? null;
}

/** The identity an item has right now (as prepared: its entry with its overrides), with `changes` (a system update) on top. */
function identityWith(item, sysChanges) {
  const out = {};
  for (const f of [...(IDENTITY[item.type] ?? []), ...OWN]) out[f] = foundry.utils.deepClone(item.system[f]);
  for (const [k, v] of Object.entries(foundry.utils.flattenObject(sysChanges ?? {}))) if (k in out) out[k] = v;
  return out;
}

/** Does this update change what the item is (rather than its state: held, wear, loaded...)? */
const touchesIdentity = (type, flat) => Object.keys(flat).some(k => [...(IDENTITY[type] ?? []), ...OWN].includes(k.replace(/^system\./, "")) && k.startsWith("system."));

/**
 * The one-time conversion of the Items sidebar: every item the GM made there (with the Forge) becomes a named catalog entry, and is linked to it.
 * Placeholders nobody filled in ("New Weapon" unchanged) are left as they are. Nothing is deleted.
 */
async function convertSidebar() {
  if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
  if (game.settings.get("flowstate", "catalogSidebarConverted")) return;
  const placeholder = i => /^New (Weapon|Armor|Foci|Shroud|Icon|Affix|Item|Gear)$/.test(i.name) && !i.system.description;
  let data = getWorldData();
  const taken = { ...ITEM_CATALOG }, made = [];
  for (const item of game.items) {
    if (!ITEM_TYPES[item.type] || placeholder(item) || (item.system.base && !isGenerated(item.system.base))) continue;
    const system = Object.fromEntries((IDENTITY[item.type] ?? []).filter(f => item.system[f] !== undefined).map(f => [f, foundry.utils.deepClone(item.system[f])]));
    const generated = ITEM_CATALOG[keyFor(item.type, system)];
    const key = namedKey(item.name, taken);
    taken[key] = true;
    data = withEntry(data, "items", key, { type: item.type, name: item.name, img: item.img, description: item.system.description ?? "", rarity: generated?.rarity ?? "common",
      pounds: null, volume: null, price: null, system });
    made.push([item, key]);
  }
  if (made.length) {
    await setWorldData(data);
    for (const [item, key] of made) await item.update({ "system.base": key, "system.overrides": [] }, { flowstateRelinked: true });
    await ChatMessage.create({ whisper: [game.user.id], speaker: { alias: "Flow State" },
      content: `<div class="flowstate-card"><header class="fs-card-title">Item catalog</header><p>${made.length} item${made.length === 1 ? "" : "s"} from the Items sidebar ${made.length === 1 ? "is" : "are"} now named catalog entr${made.length === 1 ? "y" : "ies"} (open the Forge to see them):</p>
        <ul class="fs-list">${made.slice(0, 30).map(([i]) => `<li>${esc(i.name)}</li>`).join("")}${made.length > 30 ? `<li>…and ${made.length - 30} more</li>` : ""}</ul>
        <p class="hint">The sidebar items stay where they are, linked to their entries; you can delete them when you no longer need them.</p></div>` });
  }
  await game.settings.set("flowstate", "catalogSidebarConverted", true);
}

export function registerItemSettings() {
  game.settings.register("flowstate", "catalogSidebarConverted", { scope: "world", config: false, type: Boolean, default: false });
}

export function register() {
  // Keep an item linked when what it is changes (the GM's builder on its sheet, or anything else that edits it): a generated entry follows the
  // change (a different material is a different entry), a named one keeps the difference on this copy.
  Hooks.on("preUpdateItem", (item, changes, options) => {
    if (options?.flowstateRelinked || !ITEM_TYPES[item.type]) return;
    const flat = foundry.utils.flattenObject(changes);
    if ("system.base" in flat || "system.overrides" in flat || !touchesIdentity(item.type, flat)) return;
    const sysChanges = foundry.utils.expandObject(flat).system ?? {};
    const current = identityWith(item, sysChanges);
    const link = linkFor(item.type, current, { base: item.system.base || null, description: current.description });
    if (!link) return;
    foundry.utils.setProperty(changes, "system.base", link.base);
    foundry.utils.setProperty(changes, "system.overrides", link.overrides);
  });
  Hooks.once("ready", () => { convertSidebar().catch(err => console.error("flowstate | catalog conversion", err)); });
}
