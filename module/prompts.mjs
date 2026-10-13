/**
 * The GM's list of open prompts: every question the system is waiting on a player to answer (a Ward, a Tenet, a charge...), who it is waiting on, and for
 * how long, with a button to cancel it. Questions have no timer, so this is how a stuck fight gets moving. Opens from the scene controls, and by itself when
 * a question has waited half a minute. The list itself lives in `ask.mjs`.
 */
import { openPrompts, onPromptsChanged, cancelPrompt } from "./ask.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

class PromptsApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "flowstate-prompts",
    classes: ["flowstate"],
    window: { title: "Open prompts", icon: "fa-solid fa-bell", resizable: true },
    position: { width: 600 },
    actions: { cancel: PromptsApp.onCancel, cancelAll: PromptsApp.onCancelAll }
  };

  static PARTS = { body: { template: "systems/flowstate/templates/prompts.hbs" } };

  async _prepareContext() {
    const now = Date.now(), list = openPrompts();
    return { none: !list.length, prompts: list.map(r => ({ ...r, seconds: Math.max(0, Math.round((now - r.startedAt) / 1000)) })) };
  }

  _onFirstRender(context, options) {
    super._onFirstRender?.(context, options);
    this._off = onPromptsChanged(() => this.render());
    this._tick = setInterval(() => { if (openPrompts().length) this.render(); }, 5000);          // the "for" column counts up
  }

  _onClose(options) {
    super._onClose?.(options);
    this._off?.();
    clearInterval(this._tick);
  }

  static onCancel(event, target) { cancelPrompt(target.dataset.id); }
  static onCancelAll() { for (const r of openPrompts()) cancelPrompt(r.id); }
}

let app = null;
/** Open (or bring forward) the list. */
function showPrompts() {
  app ??= new PromptsApp();
  return app.render({ force: true });
}

/** Hooks: the scene-control button, and opening the list by itself when a question has waited too long. GM only. */
export function register() {
  Hooks.on("getSceneControlButtons", controls => {
    if (!game.user.isGM) return;
    const tools = { fsPrompts: { name: "fsPrompts", title: "Open prompts", icon: "fa-solid fa-bell", order: 0, button: true, visible: true, onChange: () => showPrompts() } };
    const group = { name: "flowstatePrompts", title: "Flow State prompts", icon: "fa-solid fa-bell", order: 98, visible: true, tools, activeTool: "" };
    if (Array.isArray(controls)) controls.push({ ...group, tools: Object.values(tools) });
    else controls.flowstatePrompts = group;
  });
  Hooks.on("flowstatePromptStuck", () => { if (game.user.isGM) showPrompts(); });
}
