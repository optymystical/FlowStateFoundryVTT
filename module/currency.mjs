/**
 * Currencies (Foundry side): the world setting, the settings window where the GM sets them up, and the merge on character updates.
 * The rules (what a currency is, how it merges) are pure and live in currency-rules.mjs.
 */
import { askImage } from "./pictures.mjs";
import { sanitizeCurrencies, defaultCurrencies, normalizeCurrency, MAX_CURRENCIES, DEFAULT_IMG } from "./currency-rules.mjs";

/** The world's currencies, made safe. */
export function getCurrencies() {
  try { return sanitizeCurrencies(game.settings.get("flowstate", "currencies")); } catch (err) { return defaultCurrencies(); }
}

/**
 * The GM's settings window: how many currencies, and for each a name, a picture, and whether (and how much of it) it merges into another.
 * Built when the settings are registered (it needs Foundry's application classes).
 */
function makeCurrencyConfig() {
  const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
  class CurrencyConfig extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "flowstate-currency-config",
      tag: "form",
      classes: ["flowstate", "fs-currency-config"],
      window: { title: "Currencies", icon: "fa-solid fa-coins", resizable: true },
      position: { width: 640, height: "auto" },
      form: { handler: CurrencyConfig.onSubmit, submitOnChange: false, closeOnSubmit: true },
      actions: { pickImage: CurrencyConfig.onPickImage }
    };

    static PARTS = { body: { template: "systems/flowstate/templates/currency-config.hbs" } };

    /** The list being edited (kept between re-renders so nothing typed is lost when the count changes). */
    draft = null;

    async _prepareContext() {
      const draft = this.draft ??= getCurrencies();
      return {
        count: draft.length, max: MAX_CURRENCIES,
        rows: draft.map((c, index) => ({ ...c, index, number: index + 1,
          others: draft.filter(x => x.id !== c.id).map(x => ({ id: x.id, name: x.name, selected: x.id === c.mergeInto })) }))
      };
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      // A new count rebuilds the rows; a new name updates the "merges into" lists.
      this.element.querySelector("[name=count]")?.addEventListener("change", () => { this.readForm(); this.draft = sanitizeCurrencies(this.draft, Number(this.element.querySelector("[name=count]").value)); this.render(); });
      for (const input of this.element.querySelectorAll("[data-name-input]")) input.addEventListener("change", () => { this.readForm(); this.render(); });
    }

    /** Copy what's in the window into the draft. */
    readForm(form = this.element) {
      const get = (n, i) => form.querySelector(`[name="${n}-${i}"]`)?.value;
      const count = Number(form.querySelector("[name=count]")?.value) || this.draft?.length || 1;
      this.draft = sanitizeCurrencies(Array.from({ length: Math.max(1, Math.min(MAX_CURRENCIES, count)) }, (_, i) => ({
        id: `c${i}`, name: get("name", i) ?? this.draft?.[i]?.name, img: get("img", i) ?? this.draft?.[i]?.img ?? DEFAULT_IMG,
        mergeInto: get("into", i) ?? "", mergeAmount: get("amt", i) ?? 0
      })));
      return this.draft;
    }

    static async onPickImage(event, target) {
      const i = Number(target.dataset.index);
      this.readForm();
      const url = await askImage(`Picture: ${this.draft[i]?.name ?? "currency"}`, this.draft[i]?.img ?? "");
      if (url && this.draft[i]) this.draft[i].img = url;
      this.render();
    }

    static async onSubmit(event, form) {
      const list = this.readForm(form);
      await game.settings.set("flowstate", "currencies", list);
      ui.notifications.info(`Saved ${list.length} currenc${list.length === 1 ? "y" : "ies"}.`);
    }
  }
  return CurrencyConfig;
}

/** Register the setting and its window. Called from init. */
export function registerCurrencySettings() {
  game.settings.register("flowstate", "currencies", { scope: "world", config: false, type: Array, default: defaultCurrencies() });
  game.settings.registerMenu("flowstate", "currencyMenu", {
    name: "Currencies",
    label: "Set up currencies",
    hint: "How many currencies there are, and for each a name, a picture, and whether it merges into another one (and how many it takes). Characters carry them in their Misc items; they can't be deleted.",
    icon: "fa-solid fa-coins", type: makeCurrencyConfig(), restricted: true
  });
}

/** A character's amounts are merged as they are saved (100 copper become a silver). */
export function register() {
  Hooks.on("preUpdateActor", (actor, changes) => {
    const edited = foundry.utils.getProperty(changes, "system.currency");
    if (!edited || actor.type === "pile") return;
    foundry.utils.setProperty(changes, "system.currency", normalizeCurrency(getCurrencies(), { ...(actor.system.currency ?? {}), ...edited }));
  });
}
