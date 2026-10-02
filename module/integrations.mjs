/**
 * Optional module integrations. Each block only runs if that module is installed and active (it fires the hook).
 *  - Carousel Combat Tracker (combat-tracker-dock): default portrait attributes and a short description.
 *  - Token Action HUD Core (token-action-hud-core): a built-in Flow State system integration that mirrors the
 *    sheet's Action List, so the HUD always offers exactly what the Action List does, at the same costs.
 */
import { buildActionList, weaponRows, runActionRow } from "./sheets.mjs";

/* -------------------------------------------- */
/*  Carousel Combat Tracker                     */
/* -------------------------------------------- */

/** Attributes shown on each portrait (paths are relative to actor.system). GMs can still change them in its settings. */
export const CAROUSEL_ATTRIBUTES = [
  { attr: "hp.value", icon: "fas fa-heart", units: "HP" },
  { attr: "energy.value", icon: "fas fa-bolt", units: "Energy" },
  { attr: "ap.value", icon: "fas fa-circle", units: "AP" },
  { attr: "rp.value", icon: "fas fa-rotate-left", units: "RP" }
];

/** One line under the name: armor and held weapons. */
export function carouselDescription(actor) {
  if (!actor || actor.type === "pile") return null;
  const armor = actor.items.find(i => i.type === "armor" && i.system.equipped);
  const held = actor.items.filter(i => i.type === "weapon" && i.system.held && i.system.weaponType !== "unarmed").map(i => i.name);
  return [armor ? armor.name : "Unarmored", held.length ? held.join(", ") : "Unarmed"].join(" · ");
}

Hooks.once("combat-tracker-dock-init", config => {
  const defaults = config.defaultAttributesConfig;
  config.defaultAttributesConfig = () => ({ ...defaults(), flowstate: CAROUSEL_ATTRIBUTES });
  const Portrait = config.CombatantPortrait;
  config.CombatantPortrait = class FlowStateCombatantPortrait extends Portrait {
    getDescription() {
      try { return carouselDescription(this.actor); } catch (err) { console.error(err); return null; }
    }
  };
});

/* -------------------------------------------- */
/*  Token Action HUD                            */
/* -------------------------------------------- */

/** HUD tabs → Action List groups (by key). Empty groups are hidden by the HUD. */
export const TAH_LAYOUT = [
  { id: "combat", name: "Combat", groups: [["act-combat", "Combat"], ["act-parry", "Parry"], ["act-shroud", "Shroud"], ["act-martial", "Martial Theory"]] },
  { id: "magic", name: "Magic", groups: [["act-magic", "Magic"]] },
  { id: "movement", name: "Movement", groups: [["act-move", "Movement"], ["act-heavy", "Armor"], ["act-medium", "Medium Armor"]] },
  { id: "methods", name: "Methods", groups: [["act-strength", "Strength Methods"], ["act-dex", "Dexterity Methods"], ["act-con", "Constitution Methods"], ["act-grappling", "Grappling Methods"]] },
  { id: "weapons", name: "Weapon Trees", groups: [["act-curved", "Curved Weapons"], ["act-striker", "Striker Weapons"], ["act-assault", "Assault Weapons"], ["act-rapid", "Rapid Weapons"], ["act-swift", "Swift Weapons"]] },
  { id: "checks", name: "Checks", groups: [["act-checks", "Checks"]] }
];

/** Stable action id for an Action List row (so HUD customizations survive re-renders). */
export function rowId(groupKey, row) {
  return [groupKey, row.action, row.op ?? "", row.itemId ?? "", row.rollLabel ?? "", row.grapple ? "g" : ""].join("|");
}

/** The HUD actions for one actor, grouped by Action List key. */
export function hudActions(actor) {
  const out = new Map();
  for (const g of buildActionList(actor, weaponRows(actor))) {
    const seen = new Set();
    const list = [];
    for (const row of g.actions) {
      let id = rowId(g.key, row);
      while (seen.has(id)) id += "+";
      seen.add(id);
      list.push({
        id,
        name: row.label,
        tooltip: foundry.utils.escapeHTML([row.detail, row.tooltip].filter(Boolean).join(" · ") || row.label),
        info1: row.cost ? { text: row.cost } : undefined,
        info2: row.energy ? { text: row.energy, title: row.energyTip ?? "" } : undefined,
        icon1: row.icon ? `<i class="${row.icon}"></i>` : undefined,
        cssClass: row.disabled ? "fs-tah-disabled" : "",
        onClick: () => runActionRow(actor, row)
      });
    }
    out.set(g.key, list);
  }
  return out;
}

Hooks.once("tokenActionHudCoreApiReady", async coreModule => {
  const api = coreModule.api;

  class FlowStateActionHandler extends api.ActionHandler {
    async buildSystemActions() {
      const actor = this.actor;
      if (!actor || actor.type === "pile" || !actor.isOwner) return;
      for (const [key, actions] of hudActions(actor)) this.addActions(actions, { id: key, type: "system" });
    }
  }

  class FlowStateSystemManager extends api.SystemManager {
    getActionHandler() { return new FlowStateActionHandler(); }
    getAvailableRollHandlers() { return { core: "Flow State" }; }
    getRollHandler() { return new api.RollHandler(); }
    async registerDefaults() {
      const groups = [];
      const layout = TAH_LAYOUT.map(tab => ({
        nestId: tab.id, id: tab.id, name: tab.name,
        groups: tab.groups.map(([id, name]) => {
          const group = { id, name, listName: `Group: ${name}`, type: "system" };
          groups.push(group);
          return { ...group, nestId: `${tab.id}_${id}` };
        })
      }));
      return { layout, groups };
    }
  }

  // Token Action HUD Core expects a "system module"; the system provides it itself (any object with an `api`).
  Hooks.call("tokenActionHudSystemReady", {
    id: game.system.id,
    api: { requiredCoreModuleVersion: "2", SystemManager: FlowStateSystemManager }
  });
});
