/**
 * The Codex window (Foundry side; codex.mjs builds the pages). Every player and the GM can open it: from the Journal sidebar's Codex button, the
 * `/codex [search]` chat command, a sheet's header menu, or any link with `data-codex` (sheets, chat cards, the wizard, journal text written as
 * `@Codex[<page id or name>]{label}`). Pages the world hides are shown to the GM only.
 */
import { codexIndex, findPage, searchCodex, renderPage, setStatuses, idForName, codexId } from "./codex.mjs";
import { escapeHtml } from "./codex-md.mjs";

let CodexClass = null;
function codexClass() {
  if (CodexClass) return CodexClass;
  const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
  class Codex extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "flowstate-codex",
      classes: ["flowstate", "fs-codex"],
      window: { title: "Codex", icon: "fa-solid fa-book-open", resizable: true },
      position: { width: 960, height: 760 },
      actions: { back: Codex.onBack, forward: Codex.onForward, copyLink: Codex.onCopyLink, toggleHidden: Codex.onToggleHidden, toggleGroup: Codex.onToggleGroup, home: Codex.onHome }
    };
    static PARTS = { body: { template: "systems/flowstate/templates/codex.hbs", scrollable: [".fs-codex-nav", ".fs-codex-page"] } };

    history = [];
    pos = -1;
    query = "";
    showHidden = false;
    open = new Set();

    get pageId() { return this.history[this.pos] ?? null; }

    /** Show a page (by id or name), remembering where we were. */
    go(idOrName) {
      const p = findPage(idOrName);
      if (!p) { ui.notifications.info(`The Codex has no page for "${idOrName}".`); return; }
      if (this.pageId !== p.id) { this.history = [...this.history.slice(0, this.pos + 1), p.id].slice(-100); this.pos = this.history.length - 1; }
      const sec = codexIndex().nav.find(s => s.groups.some(g => g.ids.includes(p.id) || g.ids.includes(p.parent)));
      const grp = sec?.groups.find(g => g.ids.includes(p.id) || g.ids.includes(p.parent));
      if (grp) this.open.add(`${sec.id}/${grp.label}`);
      this.render({ force: true });
    }

    async _prepareContext() {
      const gm = game.user.isGM, ix = codexIndex(), seeHidden = gm && this.showHidden;
      const page = this.pageId ? ix.pages.get(this.pageId) : null;
      const visible = id => { const p = ix.pages.get(id); return p && (seeHidden || !p.hidden); };
      const results = this.query.length >= 2 ? searchCodex(this.query, { gm: seeHidden }).map(p => ({ id: p.id, title: p.title, subtitle: p.subtitle ?? p.group ?? "", current: p.id === this.pageId })) : null;
      return {
        gm, showHidden: this.showHidden, query: this.query, results, noResults: results && !results.length,
        canBack: this.pos > 0, canForward: this.pos < this.history.length - 1,
        nav: ix.nav.map(s => ({ id: s.id, label: s.label, icon: s.icon,
          groups: s.groups.map(g => ({ key: `${s.id}/${g.label}`, label: g.label, open: this.open.has(`${s.id}/${g.label}`),
            pages: g.ids.filter(visible).map(id => ({ id, title: ix.pages.get(id).title, current: id === this.pageId, hidden: ix.pages.get(id).hidden })) })).filter(g => g.pages.length) })),
        page: page && (seeHidden || !page.hidden) ? { id: page.id, title: page.title, subtitle: page.subtitle ?? "", img: page.img ?? "", hidden: page.hidden, html: renderPage(page, { gm: seeHidden }) } : null
      };
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      const search = this.element.querySelector("[name=codexSearch]");
      search?.addEventListener("input", ev => {
        this.query = ev.currentTarget.value;
        clearTimeout(this._t);
        this._t = setTimeout(async () => { await this.render(); const s = this.element.querySelector("[name=codexSearch]"); s?.focus(); s?.setSelectionRange?.(s.value.length, s.value.length); }, 200);
      });
      search?.addEventListener("keydown", ev => {
        if (ev.key !== "Enter") return;
        ev.preventDefault();
        const first = this.element.querySelector(".fs-codex-results [data-codex]");
        if (first) this.go(first.dataset.codex);
      });
    }

    static onBack() { if (this.pos > 0) { this.pos--; this.render(); } }
    static onForward() { if (this.pos < this.history.length - 1) { this.pos++; this.render(); } }
    static onHome() { this.query = ""; this.render(); }
    static onToggleHidden() { this.showHidden = !this.showHidden; this.render(); }
    static onToggleGroup(event, target) {
      const k = target.dataset.group;
      if (this.open.has(k)) this.open.delete(k); else this.open.add(k);
      this.render();
    }
    /** Copy a link to this page for a journal or an item's text: @Codex[id]{Title}. */
    static async onCopyLink() {
      const p = this.pageId && codexIndex().pages.get(this.pageId);
      if (!p) return;
      const text = `@Codex[${p.id}]{${p.title}}`;
      try { await navigator.clipboard.writeText(text); ui.notifications.info(`Copied ${text}: paste it into any journal or description.`); }
      catch (err) { ui.notifications.info(text); }
    }
  }
  CodexClass = Codex;
  return Codex;
}

/** Open the Codex (on a page, by id or name, or on a search). */
export function openCodex(target = null, { search = null } = {}) {
  const Cls = codexClass();
  const app = foundry.applications.instances.get("flowstate-codex") ?? new Cls();
  if (search != null) { app.query = String(search); app.render({ force: true }); return app; }
  if (target) app.go(target); else app.render({ force: true });
  return app;
}

/** A link to a Codex page for HTML the system builds (a book icon by default, or `label`). Empty when there's no such page. */
export function codexLink(idOrName, { label = null, icon = true, cls = "" } = {}) {
  const p = findPage(idOrName) ?? (idForName(idOrName) ? findPage(idForName(idOrName)) : null);
  if (!p || (p.hidden && !game.user?.isGM)) return label ? escapeHtml(label) : "";
  const inner = label ? escapeHtml(label) : `<i class="fa-solid fa-book-open"></i>`;
  return `<a class="fs-codex-link ${icon && !label ? "fs-codex-icon" : ""} ${cls}" data-codex="${escapeHtml(p.id)}" data-tooltip="Codex: ${escapeHtml(p.title)}">${inner}</a>`;
}

export function registerCodex() {
  // Any element with data-codex, anywhere (sheets, chat, the wizard, journals), opens its page.
  document.addEventListener("click", ev => {
    const el = ev.target?.closest?.("[data-codex]");
    if (!el || ev.button !== 0) return;
    ev.preventDefault(); ev.stopPropagation();
    openCodex(el.dataset.codex);
  }, true);

  // Journal text: @Codex[weaponMaterial:iron]{Iron} or @Codex[Whirlwind].
  CONFIG.TextEditor.enrichers.push({
    pattern: /@Codex\[([^\]]+)\](?:\{([^}]+)\})?/g,
    enricher: async match => {
      const a = document.createElement("a");
      const p = findPage(match[1]);
      a.classList.add("fs-codex-link", "content-link");
      a.dataset.codex = p?.id ?? match[1];
      a.innerHTML = `<i class="fa-solid fa-book-open"></i> ${escapeHtml(match[2] ?? p?.title ?? match[1])}`;
      if (!p) a.classList.add("broken");
      return a;
    }
  });

  // /codex [search]
  Hooks.on("chatMessage", (log, message) => {
    const m = String(message).trim().match(/^\/codex(?:\s+(.+))?$/i);
    if (!m) return;
    const q = m[1]?.trim();
    if (q && findPage(q)) openCodex(q); else openCodex(null, { search: q ?? "" });
    return false;
  });

  // A Codex button in the Journal sidebar for everyone.
  Hooks.on("renderJournalDirectory", (app, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root || root.querySelector(".fs-codex-btn")) return;
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "fs-codex-btn";
    btn.innerHTML = `<i class="fa-solid fa-book-open"></i> Codex`;
    btn.addEventListener("click", () => openCodex());
    (root.querySelector(".header-actions") ?? root.querySelector(".directory-header") ?? root).append(btn);
  });

  // Chat cards: a card about an ability, spell, Mode or rule ("Hero — Whirlwind") gets a book icon to its page.
  Hooks.on("renderChatMessageHTML", (message, html) => {
    for (const t of html?.querySelectorAll?.(".flowstate-card .fs-card-title") ?? []) {
      if (t.querySelector("[data-codex]")) continue;
      const text = (t.textContent ?? "").trim();
      const tries = [...text.split(/\s[—–]\s/).reverse(), text].map(x => x.replace(/\s*\([^)]*\)\s*$/, "").trim()).filter(Boolean);
      const id = tries.map(x => idForName(x)).find(x => x && !x.startsWith("item:"));
      if (id) t.insertAdjacentHTML("beforeend", ` ${codexLink(id)}`);
    }
  });

  Hooks.once("ready", () => { setStatuses(CONFIG.statusEffects); game.flowstate.codex = { open: openCodex, link: codexLink, id: codexId }; });
}
