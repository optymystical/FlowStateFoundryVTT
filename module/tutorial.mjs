/**
 * The character tutorial: New Character asks whether to walk through it (Yes/No each time, if the world setting `tutorialOffer` is on; the wizard's
 * menu also has "Start over with the tutorial"). The tutorial
 * is the same wizard (TutorialWizard extends CharacterWizard; the character it makes is the same) with popups over it that explain each step, a banner
 * that says what to do now, ★ on the equipment that fits, and a railroad: it only goes forward, and Next locks a step in once it's complete.
 * The words are tutorial-text.mjs; the advice (archetype, equipment) is tutorial-rules.mjs.
 */
import { CharacterWizard, creationRules } from "./wizard.mjs";
import * as abcRules from "./abc-rules.mjs";
import * as skills from "./skills.mjs";
import * as creation from "./creation.mjs";
import * as mentalRules from "./mental-rules.mjs";
import { STATS } from "./rules.mjs";
import { WEAPON_TYPES, ARMOR_WEIGHTS, RARITIES } from "./martial.mjs";
import { CASTING_FORMS } from "./magic.mjs";
import { DialogV2, esc } from "./html.mjs";
import { findPage, idForName } from "./codex.mjs";
import { POPUPS, LOCK, BANNER, adviceLine, choiceLines } from "./tutorial-text.mjs";
import { presetArchetypes, suggestedArchetype, equipmentAdvice } from "./tutorial-rules.mjs";

/** World: offer the tutorial at New Character. */
export function register() {
  game.settings.register("flowstate", "tutorialOffer", {
    name: "Offer the character tutorial", hint: "When someone makes a New Character, ask whether they'd like the tutorial that walks them through it.",
    scope: "world", config: true, type: Boolean, default: true
  });
}

/** `[[page|label]]` in a popup's words → a Codex link (a page id or a name), or just the label when there's no such page. */
export function codexLinks(html, find = key => findPage(key)?.id ?? idForName(key)) {
  return String(html ?? "").replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (m, key, label) => {
    const id = find(key.trim()), shown = label ?? esc(key);
    return id ? `<a class="fs-codex-name" data-codex="${esc(id)}" data-tooltip="Open in the Codex">${shown}</a>` : shown;
  });
}

/**
 * A tutorial popup over the wizard (or sheet). The app behind it is blocked (an overlay over its contents; its title bar still works), but the
 * popup isn't modal, so a Codex link in it opens the Codex on top. Centred on the app; `place(height)` (optional) says where instead, once the
 * popup has rendered and its height is known. Returns the button's action (null if it was closed).
 */
export async function popup(app, { title, html, buttons = null, width = 580, place = null }) {
  const el = app?.element, pos = app?.position ?? {};
  el?.classList?.add("fs-tutorial-blocked");
  const left = Math.max(8, Math.round((pos.left ?? 80) + ((pos.width ?? 720) - width) / 2)), top = Math.max(8, Math.round((pos.top ?? 40) + 70));
  const tag = `fs-tut-${Math.random().toString(36).slice(2, 9)}`;
  // Clicking the blocked app would raise it over the popup: put the popup back on top.
  let shown = null;
  const raise = () => setTimeout(() => shown?.bringToFront?.(), 0);
  const hook = globalThis.Hooks?.on?.("renderDialogV2", dlg => {
    if (!dlg.options?.classes?.includes(tag)) return;
    globalThis.Hooks.off("renderDialogV2", hook);
    shown = dlg;
    el?.addEventListener?.("pointerdown", raise);
    const at = place?.(dlg.element?.offsetHeight || 360);
    if (at) dlg.setPosition?.(at);
  }) ?? null;
  try {
    return await DialogV2().wait({ window: { title, icon: "fa-solid fa-graduation-cap" }, classes: ["fs-tutorial-popup", tag], position: { width, left, top },
      modal: false, rejectClose: false, content: codexLinks(html), buttons: buttons ?? [{ action: "ok", label: "Got it", icon: "fa-solid fa-check", default: true }] });
  } finally {
    el?.classList?.remove("fs-tutorial-blocked");
    el?.removeEventListener?.("pointerdown", raise);
    if (hook != null) globalThis.Hooks?.off?.("renderDialogV2", hook);
  }
}

/** New Character: ask about the tutorial (if the world offers it), then open the right wizard. */
export async function openNewCharacter() {
  for (const id of ["flowstate-character-wizard", "flowstate-tutorial-wizard"]) {
    const open = foundry.applications.instances.get(id);
    if (open) return open.bringToFront?.() ?? open.render(true);
  }
  if (game.settings.get("flowstate", "tutorialOffer") === false) return CharacterWizard.open();
  const answer = await DialogV2().wait({ window: { title: "New Character", icon: "fa-solid fa-graduation-cap" }, classes: ["fs-tutorial-popup"], position: { width: 460 },
    rejectClose: false, modal: true,
    content: `<p>Would you like to see the tutorial for character creation and how to use the character sheet?</p>
      <p class="hint">It walks you through every step and explains what your choices mean. Good for a first character.</p>`,
    buttons: [
      { action: "yes", label: "Yes", icon: "fa-solid fa-graduation-cap", default: true },
      { action: "no", label: "No", icon: "fa-solid fa-forward" }
    ] });
  if (!answer) return null;
  return answer === "yes" ? TutorialWizard.open() : CharacterWizard.open();
}

/** The wizard's menu: throw away this character and start again in the tutorial. */
export async function restartWithTutorial(app) {
  const ok = await DialogV2().confirm({ window: { title: "Start over with the tutorial?", icon: "fa-solid fa-graduation-cap" }, position: { width: 420 },
    content: "<p>This clears everything picked so far and starts again from the first step, with the tutorial.</p>", rejectClose: false, modal: true });
  if (!ok) return null;
  await app?.close();
  return TutorialWizard.open();
}

const star = (label, on) => (on ? `★ ${String(label).replace(/^★ /, "")}` : label);

/** The tutorial: the same wizard, railroaded, with popups over it. */
export class TutorialWizard extends CharacterWizard {
  static DEFAULT_OPTIONS = {
    id: "flowstate-tutorial-wizard",
    classes: ["fs-tutorial"],
    window: { title: "New Character: Tutorial", icon: "fa-solid fa-graduation-cap" },
    actions: {
      next: TutorialWizard.onTutorialNext,
      back: TutorialWizard.onLocked,
      goto: TutorialWizard.onLocked,
      finish: TutorialWizard.onTutorialFinish,
      tutorialAgain: TutorialWizard.onTutorialAgain
    }
  };

  static open() {
    const existing = foundry.applications.instances.get(this.DEFAULT_OPTIONS.id);
    if (existing) return existing.bringToFront?.() ?? existing.render(true);
    return new this().render(true);
  }

  /** Which popups have shown: step ids, "welcome", "gland", "choices:<background>", "statsArchetype". */
  tut = { seen: {}, archSet: false };
  #queue = Promise.resolve();

  /** What the tutorial needs to know about the current picks. */
  facts(ctx = null) {
    const st = this.state, rules = creationRules(), free = this.free(), anc = abcRules.ANCESTRIES[st.abc.ancestry] ?? null;
    const pkg = st.abc.background ? abcRules.packageFor(st.abc.background, st.abc.ancestry) : null;
    const pv = creation.preview(st, rules), spent = creation.statTotal(st.stats);
    return { st, rules, free, anc, pkg, pv, statLeft: rules.statPoints - spent, spLeft: pv.skillPoints - skills.spentPoints(st.trees, free.trees),
      homeland: abcRules.homelandsFor(st.abc.ancestry).find(h => h.id === st.abc.homeland)?.name ?? "", circle: abcRules.circlesFor(st.abc.background).find(c => c.id === st.abc.circle)?.name ?? "",
      ctx };
  }

  async _prepareContext(options) {
    const st = this.state, f = this.facts(), step = this.steps[st.step]?.id;
    // Skill Trees: open on the suggested Archetype the first time.
    if (step === "skills" && !this.tut.archSet) {
      const s = suggestedArchetype({ stats: st.stats, freeTrees: f.free.trees });
      if (s.id) st.skillArch = s.id;
      this.tut.archSet = true;
    }
    const ctx = await super._prepareContext(options);
    ctx.backDisabled = true;
    ctx.tutorial = { banner: this.banner(step, f) };
    if (step === "equipment") this.highlight(ctx);
    return ctx;
  }

  banner(step, f) {
    const st = f.st;
    switch (step) {
      case "ancestry": return BANNER.ancestry({ picked: f.anc?.name ?? "", needGland: st.abc.ancestry === "drakenblood" && !st.abc.element });
      case "background": return BANNER.background({ picked: f.pkg?.name ?? "", error: f.free.errors?.[0] ?? "" });
      case "culture": return BANNER.culture({ homeland: !!st.abc.homeland, circle: !!st.abc.circle });
      case "stats": return BANNER.stats({ left: f.statLeft });
      case "skills": return BANNER.skills({ left: f.spLeft });
      case "equipment": return BANNER.equipment({ left: f.rules.items - st.items.length });
      case "notes": return BANNER.notes({ name: st.name?.trim() });
      default: return "";
    }
  }

  /** The equipment that fits: ★ on the add buttons and on the fitting choices in each box (weapon type and weight, armor weight, Foci form, Icon Form). */
  advice() {
    return equipmentAdvice({ stats: this.state.stats, trees: this.state.trees, weaponTypes: Object.keys(WEAPON_TYPES), armorWeights: Object.keys(ARMOR_WEIGHTS) });
  }
  highlight(ctx) {
    const { highlight: hl } = this.advice();
    ctx.suggest = Object.fromEntries([...hl.add].map(k => [k, true]));
    ctx.weaponTypes = Object.fromEntries(Object.entries(ctx.weaponTypes ?? {}).map(([k, v]) => [k, star(v, hl.weaponTypes.has(k))]));
    for (const it of ctx.items ?? []) {
      if (it.kind === "weapon" && it.weights) it.weights = Object.fromEntries(Object.entries(it.weights).map(([k, v]) => [k, star(v, hl.weaponWeights.has(k))]));
      if (it.kind === "armor" && it.weights) it.weights = Object.fromEntries(Object.entries(it.weights).map(([k, v]) => [k, star(v, hl.armorWeights.has(k))]));
      if (it.foci && it.typeChoices) {
        it.typeChoices = it.typeChoices.map(g => {
          const form = Object.entries(CASTING_FORMS).find(([, x]) => x.label === g.label)?.[0], on = hl.fociForms.has(form);
          return { label: star(g.label, on), options: Object.fromEntries(Object.entries(g.options).map(([k, v]) => [k, star(v, on)])) };
        });
      }
      if (it.icon && it.typeChoices) {
        it.typeChoices = it.typeChoices.map(g => ({ ...g, options: Object.fromEntries(Object.entries(g.options).map(([k, v]) => [k, star(v, hl.iconAligns.has(mentalRules.FORMS[k]?.align))])) }));
      }
    }
  }

  /** The words for the equipment popup. */
  adviceLines() {
    const L = { stat: k => `<strong>[[stat:${k}|${esc(STATS[k]?.label ?? k)}]]</strong>`, weaponType: k => WEAPON_TYPES[k]?.label ?? k, armorWeight: k => ARMOR_WEIGHTS[k]?.label ?? k };
    return this.advice().advice.map(a => adviceLine(a, L)).filter(Boolean);
  }

  /** Can Next lock this step in? Returns a reason it can't, or "". */
  blocker(step, f) {
    const st = f.st;
    if (step === "ancestry") return !f.anc ? "Pick an Ancestry first." : st.abc.ancestry === "drakenblood" && !st.abc.element ? "Pick your Elemental Gland's element first." : "";
    if (step === "background") return !f.pkg ? "Pick a Background first." : f.free.errors?.length ? `Finish your Background's choices first: ${f.free.errors[0]}` : "";
    if (step === "culture") return abcRules.cultureErrors(st.abc)[0] ?? "";
    if (step === "stats") return f.statLeft < 0 ? `You've placed ${-f.statLeft} stat point${f.statLeft === -1 ? "" : "s"} too many: take some back first.` : "";
    return "";
  }

  /** The popups due now (each shows once), one at a time. */
  _onRender(context, options) {
    super._onRender?.(context, options);
    this.#queue = this.#queue.then(() => this.coach()).catch(err => console.error("flowstate | tutorial", err));
  }
  async coach() {
    if (!this.rendered) return;
    const f = this.facts(), step = this.steps[f.st.step]?.id, seen = this.tut.seen;
    const show = async (key, pop) => { if (seen[key]) return false; seen[key] = true; await popup(this, pop); return true; };
    if (!seen.welcome) await show("welcome", POPUPS.welcome());
    if (step === "ancestry") {
      await show("ancestry", POPUPS.ancestry());
      if (f.st.abc.ancestry === "drakenblood" && !f.st.abc.element) await show("gland", POPUPS.gland());
    }
    if (step === "background") {
      await show("background", POPUPS.background({ ancestry: f.anc?.name ?? "" }));
      if (f.pkg) {
        const slots = abcRules.choiceSlots(f.pkg, f.st.abc.focus), focus = (f.pkg.options ?? []).map(o => o.name);
        const lines = choiceLines({ focus, slots, owed: f.free.owed ?? 0 });
        if (lines.length) await show(`choices:${f.pkg.id}`, POPUPS.choices({ background: f.pkg.name, lines }));
      }
    }
    if (step === "culture") await show("culture", POPUPS.culture({ ancestry: f.anc?.name ?? "", background: f.pkg?.name ?? "" }));
    if (step === "stats") {
      const statLabels = Object.fromEntries(Object.entries(STATS).map(([k, v]) => [k, v.label]));
      await show("stats", POPUPS.stats({ points: f.rules.statPoints, statLabels }));
      await show("statsArchetype", POPUPS.statsArchetype({ preset: presetArchetypes(f.free.trees), statLabels }));
    }
    if (step === "skills") {
      const s = suggestedArchetype({ stats: f.st.stats, freeTrees: f.free.trees });
      const free = Object.entries(f.free.trees).filter(([, t]) => t > 0).map(([id, t]) => `[[tree:${id}|${esc(skills.treeById(id)?.name ?? id)}]] ${t}`);
      await show("skills", POPUPS.skills({ free, sp: f.pv.skillPoints - skills.spentPoints(f.st.trees, f.free.trees), archetype: s.id, why: s.why }));
    }
    if (step === "equipment") await show("equipment", POPUPS.equipment({ items: f.rules.items, rarity: RARITIES[f.rules.maxRarity] ?? f.rules.maxRarity, lines: this.adviceLines() }));
    if (step === "notes") await show("notes", POPUPS.notes());
  }

  /** Next: only once the step is complete, and only after the lock-in warning. */
  static async onTutorialNext() {
    const f = this.facts(), step = this.steps[f.st.step]?.id;
    const why = this.blocker(step, f);
    if (why) return popup(this, { title: "Not yet", html: `<p>${esc(why)}</p>`, width: 440 });
    const lock = LOCK[step]?.({ ancestry: f.anc?.name ?? "", background: f.pkg?.name ?? "", homeland: f.homeland, circle: f.circle,
      left: step === "stats" ? f.statLeft : step === "skills" ? f.spLeft : 0, count: f.st.items.length });
    if (lock) {
      const ok = await popup(this, { title: "Lock it in?", width: 460, html: `<p>${lock}</p><p class="fs-tut-warn"><i class="fa-solid fa-lock"></i> You won't be able to come back and change it during the tutorial.</p>`,
        buttons: [{ action: "go", label: "Lock it in", icon: "fa-solid fa-lock", default: true }, { action: "stay", label: "Not yet", icon: "fa-solid fa-xmark" }] });
      if (ok !== "go") return null;
    }
    this.state.step = Math.min(this.steps.length - 1, this.state.step + 1);
    return this.render();
  }
  static onLocked() { ui.notifications.info("The tutorial only goes forward: each step is locked in once you hit Next."); }

  /** The current step's explanation, again. */
  static onTutorialAgain() {
    const step = this.steps[this.state.step]?.id;
    for (const k of Object.keys(this.tut.seen)) if (k === step || (step === "stats" && k === "statsArchetype") || (step === "background" && k.startsWith("choices:"))) delete this.tut.seen[k];
    this.#queue = this.#queue.then(() => this.coach()).catch(err => console.error("flowstate | tutorial", err));
  }

  /** Finish: the character is made as usual; then the character sheet tutorial is offered (coming next: it does nothing yet). */
  static async onTutorialFinish() {
    const name = this.state.name;
    const errors = creation.validate(this.state, creationRules());
    if (errors.length) return popup(this, { title: "Not yet", html: `<p>${esc(errors[0])}</p>`, width: 440 });
    const made = waitForActor(name);
    if ((await CharacterWizard.onFinish.call(this)) !== true) { made.cancel(); return null; }    // nothing sent (no GM connected): stay put
    const answer = await popup(null, { ...POPUPS.done({ name }), width: 460,
      buttons: [{ action: "sheet", label: "Yes, show me", icon: "fa-solid fa-graduation-cap", default: true }, { action: "skip", label: "No thanks", icon: "fa-solid fa-xmark" }] });
    if (answer === "sheet") {
      const actor = await made;
      if (actor) await sheetTutorial(actor);
      else ui.notifications.warn(`${name} isn't ready yet: open the sheet and pick Sheet tutorial from its ⋮ menu.`);
    } else made.cancel?.();
    return answer;
  }
}

/** The character the GM is making for us (the createActor hook on our client), or null after a while. */
export function waitForActor(name, ms = 30000) {
  let hook = null, timer = null, done;
  const out = new Promise(resolve => {
    done = actor => { if (hook != null) globalThis.Hooks?.off?.("createActor", hook); if (timer) clearTimeout(timer); resolve(actor); };
    hook = globalThis.Hooks?.on?.("createActor", doc => { if (doc?.name === name && doc.isOwner) done(doc); }) ?? null;
    timer = setTimeout(() => done(null), ms);
  });
  out.cancel = () => done(null);
  return out;
}

/** The character sheet tutorial (sheet-tour.mjs imports this file, so it's loaded when used). */
export async function sheetTutorial(actor) {
  const { startSheetTour } = await import("./sheet-tour.mjs");
  return startSheetTour(actor);
}
