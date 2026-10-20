/**
 * Shops (Foundry side; shop-rules.mjs has the math): the Shop actor's sheet, buying and selling (always carried out by the GM's client, so a
 * player can never edit a shop or anyone's money directly), random stock, and the world's prices.
 *  - A shop's stock is its items: catalog copies at a Grade. The GM fills it from the Forge (drag entries onto the shop, or its + opens the Forge
 *    for it), by dragging items in, or with **Restock** from the shop's random rules. Each row can have its own price, a count, or unlimited stock.
 *  - Players browse a shop they can see (Observer or more), pick which of their characters is buying, and **Buy**; if the shop buys, they can
 *    **Sell** what they carry (not what's held, worn or attuned, natural or conjured) at its sell rate. What they sell joins its stock.
 */
import { requestGM, GM_ACTIONS } from "./actions.mjs";
import { notCreature } from "./kinds.mjs";
import { getCurrencies } from "./currency.mjs";
import { DEFAULT_PRICING, sanitizePricing, buyPrice, sellPrice, stockOf, hasGrade, pay, earn, wealth, formatPrice, priceCurrency, pickStock, sanitizeRandom, DEFAULT_RANDOM } from "./shop-rules.mjs";
import { ITEM_TYPES, itemData, listEntries } from "./catalog.mjs";
import { RARITIES } from "./martial.mjs";
import { CatalogApp, dropEntry } from "./catalog-app.mjs";
import { codexId, findPage } from "./codex.mjs";
import { esc } from "./html.mjs";

export const getPricing = () => { try { return sanitizePricing(game.settings.get("flowstate", "shopPricing")); } catch (err) { return sanitizePricing(DEFAULT_PRICING); } };
const money = () => { const defs = getCurrencies(); return { defs, unit: priceCurrency(defs, getPricing()) }; };

/** Can this user trade with this shop (see it), and buy or sell for this character (own it)? */
const canSee = (shop, user) => user.isGM || shop.testUserPermission(user, "OBSERVER");
const owns = (actor, user) => user.isGM || actor.testUserPermission(user, "OWNER");
/** What a character can't sell: what's in use, natural, conjured or Unarmed. */
export const unsellable = item => (item.system?.equipped || item.system?.attuned || item.system?.secondHand) ? "in use (unequip or unattune it first)"
  : item.system?.natural ? "natural" : item.flags?.flowstate?.made ? "conjured" : item.system?.weaponType === "unarmed" ? "Unarmed" : null;

/** Tell a user something about their trade (whispered to them and the GM). */
async function tell(user, shop, html) {
  const gms = game.users.filter(u => u.isGM).map(u => u.id);
  await ChatMessage.create({ whisper: [...new Set([user.id, ...gms])], speaker: ChatMessage.getSpeaker({ actor: shop }),
    content: `<div class="flowstate-card"><header class="fs-card-title">${esc(shop.name)}</header>${html}</div>` });
}

/** Strip a stock row's shop data off a copy going to a character. */
function forCharacter(stock, quantity) {
  const data = stock.toObject();
  delete data._id;
  if (data.flags?.flowstate) delete data.flags.flowstate.shop;
  for (const k of ["equipped", "attuned", "secondHand"]) if (k in (data.system ?? {})) data.system[k] = false;
  if (data.type === "gear") data.system.quantity = quantity;
  return data;
}
/** A stack of the same thing (same entry, Grade and per-copy changes, and no price of its own) to add to. */
const sameAs = (a, b) => a.type === b.type && (a.system?.base ?? "") === (b.system?.base ?? "") && (a.system?.grade ?? 0) === (b.system?.grade ?? 0)
  && JSON.stringify(a.system?.overrides ?? []) === JSON.stringify(b.system?.overrides ?? []) && a.name === b.name;

/* ---- The GM's side of a trade ---- */

GM_ACTIONS.shopBuy = async function ({ target, buyer, item, quantity = 1 }, senderId = null) {
  const user = (senderId && game.users.get(senderId)) || game.user;
  const shop = await fromUuid(target), who = await fromUuid(buyer);
  if (shop?.type !== "shop" || !who || notCreature(who) || !canSee(shop, user) || !owns(who, user)) return;
  if (!shop.system.open) return tell(user, shop, `<p>${esc(shop.name)} is closed.</p>`);
  const stock = shop.items.get(item);
  if (!stock) return tell(user, shop, "<p>That isn't for sale any more.</p>");
  const have = stockOf(stock);
  const n = Math.max(1, Math.min(Math.floor(quantity) || 1, have, stock.type === "gear" ? 1000 : 20));
  if (!(have >= 1)) return tell(user, shop, `<p>${esc(stock.name)} is sold out.</p>`);
  const { defs, unit } = money(), pricing = getPricing();
  const cost = buyPrice(stock, shop.system, pricing) * n;
  const paid = pay(defs, who.system.currency ?? {}, cost, unit);
  if (!paid.ok) return tell(user, shop, `<p>${esc(who.name)} can't afford ${n > 1 ? `${n} × ` : ""}${esc(stock.name)}: it costs ${esc(formatPrice(defs, cost, unit))}, and ${esc(formatPrice(defs, cost - paid.short, unit))} is all they have.</p>`);
  await who.update({ "system.currency": paid.amounts }, { flowstateSystem: true });
  if (stock.type === "gear") {
    const data = forCharacter(stock, n), stack = who.items.find(i => sameAs(i, data));
    if (stack) await stack.update({ "system.quantity": (stack.system.quantity ?? 0) + n }, { flowstateSystem: true });
    else await who.createEmbeddedDocuments("Item", [data], { flowstateSystem: true });
  } else await who.createEmbeddedDocuments("Item", Array.from({ length: n }, () => forCharacter(stock, 1)), { flowstateSystem: true });
  if (have !== Infinity) {
    const left = have - n;
    if (left <= 0) await stock.delete();
    else await stock.update(stock.type === "gear" ? { "system.quantity": left } : { "flags.flowstate.shop.count": left });
  }
  return tell(user, shop, `<p><strong>${esc(who.name)}</strong> buys ${n > 1 ? `${n} × ` : ""}<strong>${esc(stock.name)}</strong> for ${esc(formatPrice(defs, cost, unit))}.</p>`);
};

GM_ACTIONS.shopSell = async function ({ target, seller, item, quantity = 1 }, senderId = null) {
  const user = (senderId && game.users.get(senderId)) || game.user;
  const shop = await fromUuid(target), who = await fromUuid(seller);
  if (shop?.type !== "shop" || !who || notCreature(who) || !canSee(shop, user) || !owns(who, user)) return;
  if (!shop.system.open || !shop.system.buys) return tell(user, shop, `<p>${esc(shop.name)} isn't buying.</p>`);
  const it = who.items.get(item);
  if (!it || !ITEM_TYPES[it.type]) return;
  const why = unsellable(it);
  if (why) return tell(user, shop, `<p>${esc(it.name)} can't be sold: ${esc(why)}.</p>`);
  const n = it.type === "gear" ? Math.max(1, Math.min(Math.floor(quantity) || 1, it.system.quantity ?? 1)) : 1;
  const { defs, unit } = money(), pricing = getPricing();
  const value = sellPrice(it, shop.system, pricing) * n;
  const data = forCharacter(it, n);
  await who.update({ "system.currency": earn(defs, who.system.currency ?? {}, value, unit) }, { flowstateSystem: true });
  if (it.type === "gear" && (it.system.quantity ?? 1) > n) await it.update({ "system.quantity": it.system.quantity - n }, { flowstateSystem: true });
  else await it.delete({ flowstateSystem: true });
  const stack = shop.items.find(i => sameAs(i, data) && i.flags?.flowstate?.shop?.price == null && !i.flags?.flowstate?.shop?.infinite);
  if (stack) await stack.update(stack.type === "gear" ? { "system.quantity": (stack.system.quantity ?? 0) + n } : { "flags.flowstate.shop.count": stockOf(stack) + 1 });
  else await shop.createEmbeddedDocuments("Item", [{ ...data, flags: { ...(data.flags ?? {}), flowstate: { ...(data.flags?.flowstate ?? {}), shop: { count: 1 } } } }]);
  return tell(user, shop, `<p><strong>${esc(who.name)}</strong> sells ${n > 1 ? `${n} × ` : ""}<strong>${esc(it.name)}</strong> for ${esc(formatPrice(defs, value, unit))}.</p>`);
};

/** GM: fill a shop from its random rules (replacing its stock, or adding to it). */
export async function restock(shop, { replace = true } = {}) {
  if (!game.user.isGM) return;
  const picks = pickStock(listEntries({}), shop.system.random ?? {});
  if (!picks.length) return ui.notifications.warn("Nothing in the catalog matches the shop's random stock rules.");
  if (replace && shop.items.size) await shop.deleteEmbeddedDocuments("Item", shop.items.map(i => i.id));
  const items = picks.map(p => {
    const d = itemData(p.key, { grade: p.grade });
    if (d.type === "gear") d.system.quantity = p.quantity;
    d.flags = { flowstate: { shop: d.type === "gear" ? {} : { count: p.quantity } } };
    return d;
  });
  await shop.createEmbeddedDocuments("Item", items);
  ui.notifications.info(`${shop.name}: ${items.length} item${items.length === 1 ? "" : "s"} ${replace ? "stocked" : "added"}.`);
}

/* ---- The world's prices ---- */

async function editPricing() {
  const { DialogV2 } = foundry.applications.api;
  const p = getPricing(), defs = getCurrencies(), unit = priceCurrency(defs, p);
  const row = (label, name, v) => `<div class="form-group"><label>${esc(label)}</label><div class="form-fields"><input type="number" name="${name}" value="${v}" min="0" step="1"></div></div>`;
  const content = `<div class="flowstate-dialog">
    <p class="hint">An item costs its catalog price, or the price for its rarity if it has none, plus the per-Grade amount for each Grade above 1. A shop's markup and sell rate are percentages of that.</p>
    ${Object.entries(RARITIES).map(([k, l]) => row(`${l}`, `r-${k}`, p.rarity[k] ?? 0)).join("")}
    ${row("Each Grade above 1 adds", "perGrade", p.perGrade)}
    <div class="form-group"><label>Prices are in</label><div class="form-fields"><select name="currency">${defs.map(c => `<option value="${c.id}" ${c.id === unit ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
      <p class="hint">Any currency that merges into it (or that it merges into) pays at its worth.</p></div></div>`;
  const v = await DialogV2.prompt({ window: { title: "Shop prices" }, content, rejectClose: false,
    ok: { label: "Save", icon: "fa-solid fa-floppy-disk", callback: (e, b) => Object.fromEntries([...b.form.elements].filter(el => el.name).map(el => [el.name, el.value])) } });
  if (!v) return;
  const rarity = Object.fromEntries(Object.keys(RARITIES).map(k => [k, v[`r-${k}`]]));
  await game.settings.set("flowstate", "shopPricing", sanitizePricing({ rarity, perGrade: v.perGrade, currency: v.currency }));
  ui.notifications.info("Shop prices saved.");
}

/* ---- The sheet ---- */

function makeShopSheet() {
  const { HandlebarsApplicationMixin } = foundry.applications.api;
  const { ActorSheetV2 } = foundry.applications.sheets;
  class ShopSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
    static DEFAULT_OPTIONS = {
      classes: ["flowstate", "sheet", "actor", "fs-shop"],
      position: { width: 720, height: 760 },
      window: { resizable: true },
      form: { submitOnChange: true },
      actions: { buy: ShopSheet.onBuy, sell: ShopSheet.onSell, restock: ShopSheet.onRestock, addRandom: ShopSheet.onAddRandom, openForge: ShopSheet.onForge,
        removeStock: ShopSheet.onRemove, editStock: ShopSheet.onEditStock, pricing: () => editPricing(), toggleInfinite: ShopSheet.onInfinite }
    };
    static PARTS = { sheet: { template: "systems/flowstate/templates/shop-sheet.hbs", scrollable: [".fs-shop-scroll"] } };

    buyerUuid = null;

    /** Characters this user may trade for: theirs (the GM: any character or NPC, the selected token's first). */
    buyers() {
      const list = game.actors.filter(a => !notCreature(a) && (game.user.isGM ? a.hasPlayerOwner || a.type === "character" : a.isOwner));
      const sel = canvas?.tokens?.controlled?.map(t => t.actor).filter(a => a && !notCreature(a) && (game.user.isGM || a.isOwner)) ?? [];
      return [...new Set([...sel, game.user.character, ...list].filter(Boolean))];
    }

    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      const shop = this.document, sys = shop.system, gm = game.user.isGM, pricing = getPricing();
      const { defs, unit } = money();
      const buyers = this.buyers();
      const buyer = buyers.find(a => a.uuid === this.buyerUuid) ?? buyers[0] ?? null;
      this.buyerUuid = buyer?.uuid ?? null;
      const funds = buyer ? wealth(defs, buyer.system.currency ?? {}, unit) : 0;
      const stock = shop.items.contents.sort((a, b) => a.name.localeCompare(b.name)).map(i => {
        const price = buyPrice(i, sys, pricing), left = stockOf(i), f = i.flags?.flowstate?.shop ?? {};
        return { id: i.id, name: i.name, img: i.img, grade: hasGrade(i) ? i.system.grade : "", rarity: RARITIES[i.system.rarity] ?? "", gear: i.type === "gear",
          stock: left === Infinity ? "∞" : left, count: i.type === "gear" ? i.system.quantity : (f.count ?? 1), infinite: !!f.infinite, ownPrice: f.price ?? "",
          price: formatPrice(defs, price, unit), affordable: funds >= price, canBuy: sys.open && !!buyer && left >= 1,
          codex: i.system.base && findPage(codexId.item(i.system.base)) ? codexId.item(i.system.base) : null };
      });
      const sell = sys.buys && buyer ? buyer.items.contents.filter(i => ITEM_TYPES[i.type]).sort((a, b) => a.name.localeCompare(b.name)).map(i => {
        const why = unsellable(i);
        return { id: i.id, name: i.name, img: i.img, grade: hasGrade(i) ? i.system.grade : "", gear: i.type === "gear", quantity: i.system.quantity ?? 1,
          price: formatPrice(defs, sellPrice(i, sys, pricing), unit), why };
      }) : [];
      const random = sanitizeRandom(sys.random ?? DEFAULT_RANDOM);
      return Object.assign(context, {
        shop, sys, gm, stock, sell, buyer: buyer ? { uuid: buyer.uuid, name: buyer.name, funds: formatPrice(defs, funds, unit) } : null,
        buyers: buyers.map(a => ({ uuid: a.uuid, name: a.name, selected: a.uuid === this.buyerUuid })),
        random, kinds: Object.entries(ITEM_TYPES).map(([k, t]) => ({ key: k, label: t.label, on: random.types.includes(k) })),
        rarities: Object.entries(RARITIES).map(([k, l]) => ({ key: k, label: l, on: random.rarities.includes(k) })),
        unitName: defs.find(c => c.id === unit)?.name ?? ""
      });
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      const root = this.element;
      root.querySelector("[data-buyer]")?.addEventListener("change", ev => { this.buyerUuid = ev.currentTarget.value; this.render(); });
      if (!game.user.isGM) return;
      // A stock row's own price and count.
      for (const input of root.querySelectorAll("[data-stock-field]")) {
        input.addEventListener("change", async ev => {
          ev.stopPropagation();
          const item = this.document.items.get(input.closest("[data-item-id]")?.dataset.itemId);
          if (!item) return;
          const v = input.value === "" ? null : Math.max(0, Math.floor(Number(input.value) || 0));
          if (input.dataset.stockField === "price") await item.update({ "flags.flowstate.shop.price": v });
          else if (item.type === "gear") await item.update({ "system.quantity": v ?? 0 });
          else await item.update({ "flags.flowstate.shop.count": Math.max(1, v ?? 1) });
        });
      }
      // The random rules' checkboxes (kinds, rarities) are kept as lists.
      for (const box of root.querySelectorAll("[data-random-list]")) {
        box.addEventListener("change", ev => {
          ev.stopPropagation();
          const list = box.dataset.randomList, on = [...root.querySelectorAll(`[data-random-list="${list}"]`)].filter(b => b.checked).map(b => b.value);
          return this.document.update({ [`system.random.${list}`]: on });
        });
      }
    }

    /** Items dragged from the Forge (or another sheet) join the stock. */
    async _onDrop(event) {
      let data = null;
      try { data = JSON.parse(event.dataTransfer?.getData("text/plain") || "null"); } catch (err) { data = null; }
      if (data?.type === "FlowStateCatalog") { event.preventDefault?.(); return game.user.isGM ? dropEntry(this.document, data) : false; }
      if (!game.user.isGM) return false;
      return super._onDrop(event);
    }

    #row(target) { return target.closest("[data-item-id]")?.dataset.itemId; }
    #qty(target) { return Math.max(1, Math.floor(Number(target.closest("[data-item-id]")?.querySelector("[data-qty]")?.value) || 1)); }

    static onBuy(event, target) {
      if (!this.buyerUuid) return ui.notifications.warn("Pick who is buying first.");
      return requestGM("shopBuy", { target: this.document.uuid, buyer: this.buyerUuid, item: this.#row(target), quantity: this.#qty(target) });
    }
    static onSell(event, target) {
      if (!this.buyerUuid) return ui.notifications.warn("Pick who is selling first.");
      return requestGM("shopSell", { target: this.document.uuid, seller: this.buyerUuid, item: this.#row(target), quantity: this.#qty(target) });
    }
    static onRestock() { return restock(this.document, { replace: true }); }
    static onAddRandom() { return restock(this.document, { replace: false }); }
    static onForge() { return CatalogApp.open({ actor: this.document }); }
    static onEditStock(event, target) { return this.document.items.get(this.#row(target))?.sheet.render(true); }
    static onRemove(event, target) { return this.document.items.get(this.#row(target))?.delete(); }
    static onInfinite(event, target) {
      const item = this.document.items.get(this.#row(target));
      return item?.update({ "flags.flowstate.shop.infinite": !item.flags?.flowstate?.shop?.infinite });
    }
  }
  return ShopSheet;
}

function makePricingMenu() {
  const { ApplicationV2 } = foundry.applications.api;
  return class PricingMenu extends ApplicationV2 {
    async render() { await editPricing(); return this; }
  };
}

export function registerShopSettings() {
  game.settings.register("flowstate", "shopPricing", { scope: "world", config: false, type: Object, default: DEFAULT_PRICING });
  game.settings.registerMenu("flowstate", "shopPricingMenu", {
    name: "Shop prices", label: "Set prices", icon: "fa-solid fa-scale-balanced", type: makePricingMenu(), restricted: true,
    hint: "What shops charge for an item with no price of its own (by rarity), how much each Grade above 1 adds, and which currency prices are in."
  });
}

export function registerShops() {
  foundry.applications.apps.DocumentSheetConfig.registerSheet(Actor, "flowstate", makeShopSheet(), { types: ["shop"], makeDefault: true, label: "Shop" });
  // A new shop: one shared stock for all its tokens, a market stall picture, and every player can look at it (the GM can change that).
  Hooks.on("preCreateActor", (actor, data) => {
    if (actor.type !== "shop") return;
    const upd = { "prototypeToken.actorLink": true };
    if (!data.img || data.img === "icons/svg/mystery-man.svg") upd.img = "icons/svg/chest.svg";
    if (data.ownership?.default === undefined) upd["ownership.default"] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
    actor.updateSource(upd);
  });
  // Money changes redraw any open shop (so funds stay current).
  Hooks.on("updateActor", (actor, changes) => {
    if (!foundry.utils.hasProperty(changes, "system.currency")) return;
    for (const app of foundry.applications.instances.values()) if (app.document?.type === "shop" && app.rendered) app.render();
  });
}

