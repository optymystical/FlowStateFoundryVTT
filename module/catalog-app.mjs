/**
 * The Forge: the item catalog's window. Browse every entry (generated and named), give one to a character at a Grade (or drag it onto a sheet),
 * and, as the GM, make named entries, edit any entry's picture, text, weight, volume and price, or hide entries the world doesn't use.
 * Entries are saved in the world data (store.mjs), so they export and import with it.
 */
import { ITEM_CATALOG, ITEM_TYPES, IDENTITY, listEntries, entrySummary, namedKey, isGenerated, keyFor, entryOf } from "./catalog.mjs";
import { withEntry, withoutEntry, withHidden, systemEntry } from "./store.mjs";
import { getWorldData, setWorldData } from "./world-data.mjs";
import { giveEntry } from "./items.mjs";
import { WEAPON_TYPES, WEIGHTS, WEAPON_MATERIALS, ARMOR_WEIGHTS, ARMOR_MATERIALS, RARITIES, WEAPON_TAGS } from "./martial.mjs";
import { FOCI_TYPES, SHROUD_TYPES, AFFIXES, CASTING_FORMS } from "./magic.mjs";
import { FORMS } from "./mental-rules.mjs";
import { OBJECT_DENSITY } from "./rules.mjs";
import { askImage } from "./pictures.mjs";

const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
const LIMIT = 150;
const DRAG_TYPE = "FlowStateCatalog";
const tables = { CASTING_FORMS, tagLabel: k => WEAPON_TAGS[k]?.label ?? k };

/** Can this user give items to this actor (the GM always; a player only to their own character while it's being built)? */
const canGiveTo = actor => !!actor && (game.user.isGM || (actor.isOwner && (actor.type === "pile" || actor.system?.creation)));

/** Drop handler for sheets: a row dragged from the Forge. */
export async function dropEntry(actor, data) {
  if (data?.type !== DRAG_TYPE || !entryOf(data.key)) return false;
  if (!canGiveTo(actor)) { ui.notifications.warn("Only the GM can add items to a character."); return false; }
  await giveEntry(actor, data.key, { grade: data.grade ?? 1 });
  return true;
}

const opts = (pairs, selected) => pairs.map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(selected ?? "") ? "selected" : ""}>${esc(l)}</option>`).join("");
const field = (label, html, hint = "") => `<div class="form-group"><label>${esc(label)}</label><div class="form-fields">${html}</div>${hint ? `<p class="hint">${esc(hint)}</p>` : ""}</div>`;
const numIn = (name, v, step = "any") => `<input type="number" name="${name}" value="${v ?? ""}" min="0" step="${step}" placeholder="—">`;
const labels = t => Object.entries(t).filter(([, v]) => !v?.hidden).map(([k, v]) => [k, v.label ?? v.name ?? k]);

/** The identity fields of an entry type, as form fields. */
function identityFields(type, sys = {}, locked = false) {
  const dis = locked ? "disabled" : "";
  if (type === "weapon") {
    const types = labels(WEAPON_TYPES).filter(([k]) => k !== "unarmed");
    const mats = Object.entries(WEAPON_MATERIALS).filter(([, m]) => !m.hidden).map(([k, m]) => [k, `${m.label} (${Object.keys(m.weights).map(w => WEIGHTS[w]?.label).join("/")})`]);
    return field("Weapon type", `<select name="weaponType" ${dis}>${opts(types, sys.weaponType ?? "bladed")}</select>`)
      + field("Weight", `<select name="weight" ${dis}>${opts(labels(WEIGHTS), sys.weight ?? "light")}</select>`)
      + field("Material", `<select name="material" ${dis}><option value="">— (Improvised)</option>${opts(mats, sys.material ?? "hardwood")}</select>`)
      + field("Shots per reload", `<input type="number" name="magazine" value="${sys.magazine ?? 1}" min="1" step="1" ${dis}>`, "Ranged weapons only.");
  }
  if (type === "armor") return field("Weight", `<select name="weight" ${dis}>${opts(labels(ARMOR_WEIGHTS), sys.weight ?? "light")}</select>`)
    + field("Material", `<select name="material" ${dis}>${opts(Object.entries(ARMOR_MATERIALS).filter(([, m]) => !m.hidden).map(([k, m]) => [k, `${m.label} (${Object.keys(m.weights).map(w => ARMOR_WEIGHTS[w]?.label).join("/")})`]), sys.material ?? "cloth")}</select>`);
  if (type === "foci") return field("Foci", `<select name="fociType" ${dis}>${opts(labels(FOCI_TYPES), sys.fociType)}</select>`);
  if (type === "shroud") return field("Shroud", `<select name="shroudType" ${dis}>${opts(labels(SHROUD_TYPES), sys.shroudType)}</select>`);
  if (type === "icon") return field("Form", `<select name="form" ${dis}>${opts(labels(FORMS), sys.form)}</select>`);
  if (type === "affix") return field("Affix", `<select name="affix" ${dis}>${opts(labels(AFFIXES), sys.affix)}</select>`);
  return field("Ammunition for", `<select name="ammoType" ${dis}><option value="">— (not ammunition)</option>${opts(Object.entries(WEAPON_TYPES).filter(([, w]) => w.ranged).map(([k, w]) => [k, `${w.label} weapons`]), sys.ammoType)}</select>`)
    + field("Body", `<input type="number" name="body" value="${sys.body ?? 0}" min="0" step="1" ${dis}>`, "Above 0 makes it an object with Durability and Limit (Rules, Ch10).")
    + field("Density", `<select name="density" ${dis}>${opts(labels(OBJECT_DENSITY), sys.density ?? "soft")}</select>`);
}

/** Read the identity fields back from the form. */
function readIdentity(type, v) {
  const n = x => Math.max(0, Number(x) || 0);
  if (type === "weapon") return { weaponType: v.weaponType, weight: v.weight, material: v.weaponType === "improvised" ? "" : v.material, magazine: Math.max(1, Math.floor(n(v.magazine)) || 1), extraTypes: [] };
  if (type === "armor") return { weight: v.weight, material: v.material };
  if (type === "foci") return { fociType: v.fociType };
  if (type === "shroud") return { shroudType: v.shroudType };
  if (type === "icon") return { form: v.form };
  if (type === "affix") return { affix: v.affix };
  return { ammoType: v.ammoType ?? "", body: Math.floor(n(v.body)), density: v.density || "soft" };
}

/** Is this identity something the tables can make? (A weapon's material has to come in its weight.) */
function identityProblem(type, sys) {
  if (type === "weapon" && sys.weaponType !== "improvised" && !WEAPON_MATERIALS[sys.material]?.weights?.[sys.weight]) return `${WEAPON_MATERIALS[sys.material]?.label ?? "That material"} can't be made ${WEIGHTS[sys.weight]?.label ?? ""}.`;
  if (type === "armor" && !ARMOR_MATERIALS[sys.material]?.weights?.[sys.weight]) return `${ARMOR_MATERIALS[sys.material]?.label ?? "That material"} can't be made into ${ARMOR_WEIGHTS[sys.weight]?.label ?? ""} armor.`;
  return null;
}

/**
 * The entry editor (GM). A named entry (new, or copied from a generated one) sets everything; a generated entry keeps what it is (that comes from
 * the tables) and only its picture, text, weight, volume and price can change.
 */
async function editEntry(key, { type = null, from = null } = {}) {
  const { DialogV2 } = foundry.applications.api;
  const existing = key ? ITEM_CATALOG[key] : null;
  const source = existing ?? (from ? ITEM_CATALOG[from] : null);
  const t = existing?.type ?? source?.type ?? type ?? "gear";
  const generated = !!key && isGenerated(key);
  const e = source ? foundry.utils.deepClone(source) : { type: t, name: "", img: ITEM_TYPES[t].img, description: "", rarity: "common", pounds: null, volume: null, price: null, system: {} };
  if (from && !key) e.name = `${e.name} (copy)`;
  const content = `<div class="flowstate-dialog fs-entry-editor">
    ${field("Name", `<input type="text" name="name" value="${esc(e.name)}" ${generated ? "disabled" : ""} required>`, generated ? "Generated from the tables: its name and what it is follow them. Make a named copy to change those." : "")}
    ${field("Picture", `<input type="text" name="img" value="${esc(e.img)}"><button type="button" data-browse-img><i class="fa-solid fa-folder-open"></i></button>`)}
    ${identityFields(t, e.system, generated)}
    ${field("Rarity", `<select name="rarity" ${generated ? "disabled" : ""}>${opts(Object.entries(RARITIES), e.rarity)}</select>`)}
    ${field("Weight (lb)", numIn("pounds", e.pounds))}
    ${field("Volume (ft³)", numIn("volume", e.volume))}
    ${field("Price", numIn("price", e.price), "In the world's first currency.")}
    ${field("Description", `<textarea name="description" rows="5">${esc(e.description)}</textarea>`)}
  </div>`;
  const values = await DialogV2.wait({
    window: { title: existing ? `Edit: ${existing.name}` : `New ${ITEM_TYPES[t].one}` }, position: { width: 520 }, content, rejectClose: false,
    render: (event, dialog) => {
      const root = dialog.element ?? event?.target?.element;
      root?.querySelector("[data-browse-img]")?.addEventListener("click", async () => {
        const input = root.querySelector("[name=img]");
        const url = await askImage("Picture", input.value);
        if (url) input.value = url;
      });
    },
    buttons: [{ action: "save", label: "Save", icon: "fa-solid fa-floppy-disk", default: true,
      callback: (ev, button) => Object.fromEntries([...button.form.elements].filter(el => el.name && !el.disabled).map(el => [el.name, el.value])) },
    { action: "cancel", label: "Cancel", icon: "fa-solid fa-xmark" }]
  });
  if (!values || typeof values !== "object") return null;
  const num = v => (v === "" || v === undefined ? null : Math.max(0, Number(v) || 0));
  let data = getWorldData();
  if (generated) {
    const sys = systemEntry("items", key) ?? {};
    const patch = {};
    for (const [f, v] of [["img", values.img || sys.img], ["description", values.description ?? ""], ["pounds", num(values.pounds)], ["volume", num(values.volume)], ["price", num(values.price)]]) patch[f] = v;
    data = withEntry(data, "items", key, patch);
  } else {
    const name = String(values.name ?? "").trim();
    if (!name) { ui.notifications.warn("Give the entry a name."); return null; }
    const system = readIdentity(t, values);
    const problem = identityProblem(t, system);
    if (problem) { ui.notifications.warn(problem); return null; }
    const entry = { type: t, name, img: values.img || ITEM_TYPES[t].img, description: values.description ?? "", rarity: values.rarity || "common",
      pounds: num(values.pounds), volume: num(values.volume), price: num(values.price), system };
    key ??= namedKey(name);
    data = withEntry(withoutEntry(data, "items", key), "items", key, entry);
  }
  await setWorldData(data);
  ui.notifications.info(`Saved ${values.name || existing?.name || "the entry"} in the catalog.`);
  return key;
}

/** How many items in the world use an entry (on characters, NPCs, piles and the sidebar). */
function copiesOf(key) {
  let n = 0;
  for (const i of game.items) if (i.system?.base === key) n++;
  for (const a of game.actors) for (const i of a.items) if (i.system?.base === key) n++;
  return n;
}

let CatalogClass = null;
/** The window's class, made the first time it is needed (it needs Foundry's application classes). */
function catalogClass() {
  if (CatalogClass) return CatalogClass;
  const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
  class Catalog extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "flowstate-catalog",
      classes: ["flowstate", "fs-catalog"],
      window: { title: "Forge: item catalog", icon: "fa-solid fa-hammer", resizable: true },
      position: { width: 860, height: 720 },
      actions: {
        tab: Catalog.onTab, give: Catalog.onGive, newEntry: Catalog.onNew, editEntry: Catalog.onEdit, copyEntry: Catalog.onCopy,
        hideEntry: Catalog.onHide, deleteEntry: Catalog.onDelete, clearTarget: Catalog.onClearTarget
      }
    };
    static PARTS = { body: { template: "systems/flowstate/templates/catalog.hbs", scrollable: [".fs-cat-list"] } };

    filters = { type: "weapon", search: "", rarity: "", weaponType: "", weight: "", material: "", named: false, hidden: false };
    targetUuid = null;
    grade = 1;

    get target() { return this.targetUuid ? fromUuidSync(this.targetUuid) : null; }

    async _prepareContext() {
      const f = this.filters, gm = game.user.isGM, target = this.target;
      let rows = listEntries({ type: f.type, search: f.search, rarity: f.rarity, named: f.named, hidden: gm && f.hidden });
      if (f.type === "weapon") rows = rows.filter(r => (!f.weaponType || r.system.weaponType === f.weaponType) && (!f.weight || r.system.weight === f.weight) && (!f.material || r.system.material === f.material));
      if (f.type === "armor") rows = rows.filter(r => (!f.weight || r.system.weight === f.weight) && (!f.material || r.system.material === f.material));
      rows.sort((a, b) => (b.named - a.named) || a.name.localeCompare(b.name));
      const total = rows.length;
      const giveable = canGiveTo(target);
      const fmt = v => (v == null ? "" : String(Math.round(v * 100) / 100));
      return {
        gm, giveable, target: target ? { name: target.name } : null, grade: this.grade, total, more: total > LIMIT ? total - LIMIT : 0,
        tabs: Object.entries(ITEM_TYPES).map(([k, t]) => ({ key: k, label: t.label, active: k === f.type })),
        filters: f, isWeapon: f.type === "weapon", isArmor: f.type === "armor",
        rarities: Object.entries(RARITIES).map(([k, l]) => ({ key: k, label: l, selected: k === f.rarity })),
        weaponTypes: labels(WEAPON_TYPES).map(([k, l]) => ({ key: k, label: l, selected: k === f.weaponType })),
        weights: labels(f.type === "armor" ? ARMOR_WEIGHTS : WEIGHTS).map(([k, l]) => ({ key: k, label: l, selected: k === f.weight })),
        materials: labels(f.type === "armor" ? ARMOR_MATERIALS : WEAPON_MATERIALS).map(([k, l]) => ({ key: k, label: l, selected: k === f.material })),
        rows: rows.slice(0, LIMIT).map(r => ({ key: r.key, name: r.name, img: r.img, rarity: r.rarityLabel, named: r.named, hidden: !!r.hidden,
          summary: entrySummary(r, tables), pounds: fmt(r.pounds), volume: fmt(r.volume), price: fmt(r.price),
          description: String(r.description ?? "").replace(/<[^>]+>/g, " ").slice(0, 300) }))
      };
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      const root = this.element;
      const set = (name, key, rerender = true) => root.querySelector(`[name="${name}"]`)?.addEventListener(name === "search" ? "input" : "change", ev => {
        const el = ev.currentTarget;
        this.filters[key] = el.type === "checkbox" ? el.checked : el.value;
        if (rerender) this.#rerender(name === "search");
      });
      set("search", "search"); set("rarity", "rarity"); set("weaponType", "weaponType"); set("weight", "weight"); set("material", "material"); set("named", "named"); set("hidden", "hidden");
      root.querySelector("[name=grade]")?.addEventListener("change", ev => { this.grade = Math.max(1, Math.floor(Number(ev.currentTarget.value) || 1)); });
      for (const row of root.querySelectorAll("[data-entry-key]")) {
        row.addEventListener("dragstart", ev => ev.dataTransfer.setData("text/plain", JSON.stringify({ type: DRAG_TYPE, key: row.dataset.entryKey, grade: this.grade })));
      }
    }

    /** Re-render, keeping the search box focused while typing. */
    #rerender(keepSearch) {
      clearTimeout(this._t);
      this._t = setTimeout(async () => {
        await this.render();
        if (keepSearch) { const s = this.element.querySelector("[name=search]"); s?.focus(); s?.setSelectionRange?.(s.value.length, s.value.length); }
      }, keepSearch ? 200 : 0);
    }

    static onTab(event, target) {
      this.filters.type = target.dataset.type;
      this.filters.weight = ""; this.filters.material = ""; this.filters.weaponType = "";
      this.render();
    }

    static async onGive(event, target) {
      const key = target.closest("[data-entry-key]")?.dataset.entryKey;
      const actor = this.target;
      if (!actor) return ui.notifications.info("Drag the item onto a character's sheet, or open the Forge from a sheet's + button to give it there.");
      if (!canGiveTo(actor)) return ui.notifications.warn("Only the GM can add items to a character.");
      await giveEntry(actor, key, { grade: this.grade });
    }
    static onClearTarget() { this.targetUuid = null; this.render(); }

    static async onNew() {
      if (!game.user.isGM) return;
      const key = await editEntry(null, { type: this.filters.type });
      if (key) this.render();
    }
    static async onEdit(event, target) {
      if (!game.user.isGM) return;
      if (await editEntry(target.closest("[data-entry-key]").dataset.entryKey)) this.render();
    }
    static async onCopy(event, target) {
      if (!game.user.isGM) return;
      if (await editEntry(null, { from: target.closest("[data-entry-key]").dataset.entryKey })) this.render();
    }
    static async onHide(event, target) {
      if (!game.user.isGM) return;
      const key = target.closest("[data-entry-key]").dataset.entryKey;
      await setWorldData(withHidden(getWorldData(), "items", key, !ITEM_CATALOG[key]?.hidden));
      this.render();
    }
    static async onDelete(event, target) {
      if (!game.user.isGM) return;
      const key = target.closest("[data-entry-key]").dataset.entryKey, e = ITEM_CATALOG[key];
      if (!e || isGenerated(key)) return;
      const n = copiesOf(key);
      const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Delete catalog entry" }, rejectClose: false,
        content: `<p>Delete <strong>${esc(e.name)}</strong> from the catalog?${n ? ` ${n} item${n === 1 ? "" : "s"} in the world use${n === 1 ? "s" : ""} it: they keep working from their own copy of its data, but no longer follow it.` : ""}</p>` });
      if (!ok) return;
      await setWorldData(withoutEntry(getWorldData(), "items", key));
      this.render();
    }
  }
  CatalogClass = Catalog;
  return Catalog;
}

/** The Forge's window. `open()` shows it, optionally for one actor (its sheet's + buttons) and on one item type. */
export const CatalogApp = {
  open({ actor = null, type = null } = {}) {
    const Cls = catalogClass();
    const app = foundry.applications.instances.get("flowstate-catalog") ?? new Cls();
    if (actor) app.targetUuid = actor.uuid;
    if (type) app.filters.type = type;
    app.render({ force: true });
    return app;
  }
};

/** The generated entry an item's builder fields describe (the sheets use it to show what an item is). */
export const generatedKeyOf = item => keyFor(item.type, Object.fromEntries((IDENTITY[item.type] ?? []).map(f => [f, item.system[f]])));
