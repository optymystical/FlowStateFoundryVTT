/**
 * World data (Foundry side): the world setting that holds a world's own changes to the game's data (store.mjs has the rules, store-catalog.mjs the
 * collections), applying it on every client, and the GM's window to export, import or clear it.
 * The data is applied at init, before any document is prepared, and again on every client whenever the GM changes it.
 */
import "./store-catalog.mjs";
import { COLLECTIONS, applyWorldData, sanitizeWorldData, entries, layerWorldData, WORLD_DATA_VERSION } from "./store.mjs";

const KEY = "worldData";

/** The world's data as saved (cleaned). */
export function getWorldData() {
  try { return sanitizeWorldData(game.settings.get("flowstate", KEY)).data; } catch (err) { return { version: WORLD_DATA_VERSION, collections: {} }; }
}

/** Save new world data (GM). Every client applies it through the setting's onChange. */
export async function setWorldData(data) {
  const { data: clean, problems } = sanitizeWorldData(data);
  await game.settings.set("flowstate", KEY, clean);
  return problems;
}

/** Apply world data here, reporting what couldn't be used. */
function apply(raw, { quiet = false } = {}) {
  const { problems } = applyWorldData(raw);
  if (problems.length) {
    console.warn("flowstate | world data:", problems);
    if (!quiet && game.user?.isGM) ui.notifications?.warn(`Some world data couldn't be used (${problems.length}): see the console (F12).`);
  }
}

/** After the data changed mid-session: prepare every creature and item again, and redraw what's open. */
function refreshAll() {
  const actors = new Set(game.actors ?? []);
  for (const t of globalThis.canvas?.scene?.tokens ?? []) if (t.actor && !t.actorLink) actors.add(t.actor);
  for (const a of actors) { try { a.prepareData(); } catch (err) { console.error("flowstate | world data refresh", a?.name, err); } }
  for (const i of game.items ?? []) { try { i.prepareData(); } catch (err) { console.error("flowstate | world data refresh", i?.name, err); } }
  for (const app of foundry.applications.instances?.values?.() ?? []) { try { if (app.rendered) app.render(); } catch (err) { /* a window that can't redraw keeps its old view */ } }
  ui.combat?.render?.();
}

/** How much a world has changed each collection (for the window). */
export function worldDataSummary(data = getWorldData()) {
  const groups = new Map();
  for (const c of COLLECTIONS.values()) {
    const list = entries(c.id, data);
    const row = { id: c.id, label: c.label, total: list.length, edited: list.filter(e => e.edited).length, added: list.filter(e => e.custom).length,
      hidden: list.filter(e => e.hidden).length, addable: c.addable };
    row.changed = row.edited + row.added + row.hidden > 0;
    if (!groups.has(c.group)) groups.set(c.group, []);
    groups.get(c.group).push(row);
  }
  return [...groups].map(([label, rows]) => ({ label, rows }));
}

const download = (data, name) => {
  const text = JSON.stringify({ ...data, system: game.system.id, systemVersion: game.system.version, world: game.world?.title ?? "", exported: new Date().toISOString() }, null, 2);
  foundry.utils.saveDataToFile(text, "application/json", name);
};

/** Ask for a JSON file and read it. */
function pickFile() {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json,application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try { resolve(JSON.parse(await file.text())); } catch (err) { ui.notifications.error("That file isn't valid JSON."); resolve(null); }
    });
    input.click();
  });
}

function makeWorldDataConfig() {
  const { HandlebarsApplicationMixin, ApplicationV2, DialogV2 } = foundry.applications.api;
  const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
  class WorldDataConfig extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "flowstate-world-data",
      classes: ["flowstate", "fs-world-data"],
      window: { title: "World data", icon: "fa-solid fa-database", resizable: true },
      position: { width: 620, height: 640 },
      actions: { exportData: WorldDataConfig.onExport, importData: WorldDataConfig.onImport, resetData: WorldDataConfig.onReset }
    };
    static PARTS = { body: { template: "systems/flowstate/templates/world-data.hbs", scrollable: [".fs-wd-groups"] } };

    async _prepareContext() {
      const data = getWorldData(), groups = worldDataSummary(data);
      const changed = groups.flatMap(g => g.rows).filter(r => r.changed).length;
      return { groups, changed, empty: !changed };
    }

    static onExport() {
      const data = getWorldData();
      download(data, `flowstate-world-data-${(game.world?.id ?? "world").replace(/[^\w-]/g, "")}.json`);
    }

    static async onImport() {
      const raw = await pickFile();
      if (!raw) return;
      const { data, problems } = sanitizeWorldData(raw);
      const count = Object.values(data.collections).reduce((n, c) => n + Object.keys(c.entries).length + c.hidden.length, 0);
      if (!count) return ui.notifications.warn(problems[0] ?? "That file has no world data in it.");
      const notes = problems.length ? `<p>Left out:</p><ul>${problems.slice(0, 12).map(p => `<li>${esc(p)}</li>`).join("")}${problems.length > 12 ? `<li>…and ${problems.length - 12} more</li>` : ""}</ul>` : "";
      const choice = await DialogV2.wait({
        window: { title: "Import world data" },
        content: `<p>The file changes <strong>${count}</strong> entr${count === 1 ? "y" : "ies"}${raw.world ? ` (from “${esc(raw.world)}”)` : ""}.</p>${notes}
          <p><strong>Add to this world's</strong> keeps your changes and layers the file's over them; <strong>Replace</strong> throws your changes away first.</p>`,
        buttons: [{ action: "merge", label: "Add to this world's", icon: "fa-solid fa-layer-group", default: true },
          { action: "replace", label: "Replace", icon: "fa-solid fa-right-left" }, { action: "cancel", label: "Cancel", icon: "fa-solid fa-xmark" }],
        rejectClose: false
      });
      if (choice !== "merge" && choice !== "replace") return;
      await setWorldData(choice === "merge" ? layerWorldData(getWorldData(), data) : data);
      ui.notifications.info("World data imported.");
      this.render();
    }

    static async onReset() {
      const ok = await DialogV2.confirm({ window: { title: "Clear world data" },
        content: "<p>Throw away every change this world made to the game's data? Everything goes back to the system's own values. (Export first if you may want them back.)</p>",
        rejectClose: false });
      if (!ok) return;
      await setWorldData({});
      ui.notifications.info("World data cleared: everything is back to the system's values.");
      this.render();
    }
  }
  return WorldDataConfig;
}

/** Register the setting and its window, and apply the world's data. Called first thing in init, before anything reads the tables. */
export function registerWorldData() {
  game.settings.register("flowstate", KEY, {
    scope: "world", config: false, type: Object, default: {},
    onChange: value => { apply(value); refreshAll(); }
  });
  game.settings.registerMenu("flowstate", "worldDataMenu", {
    name: "World data",
    label: "Export, import or clear",
    hint: "This world's own changes to the game's data (weapons, materials, Foci, Icon Forms, skill trees and the rest), layered over the system's values. Export them to a file, import someone else's, or clear them.",
    icon: "fa-solid fa-database", type: makeWorldDataConfig(), restricted: true
  });
  apply(game.settings.get("flowstate", KEY), { quiet: true });
}
