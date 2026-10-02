import { createRequire } from "node:module"; const require = createRequire(import.meta.url);
const H = require("handlebars"), fs = require("fs");
H.registerHelper("selectOptions", (o, { hash }) => new H.SafeString(Object.entries(o).map(([k, v]) => `<option value="${k}"${k === hash.selected ? " selected" : ""}>${v}</option>`).join("")));
const settings = { startingStatPoints: 90, startingItems: 3, startingGrade: 1, startingMaxRarity: "uncommon" };
const created = []; const chats = [];
globalThis.Hooks = { on() {}, once() {} };
globalThis.foundry = { utils: { expandObject: o => { const r = {}; for (const [k, v] of Object.entries(o)) { const ps = k.split("."); let t = r; ps.slice(0, -1).forEach(p => t = t[p] ??= {}); t[ps.at(-1)] = v; } return r; }, deepClone: o => structuredClone(o), escapeHTML: s => s },
  applications: { api: { HandlebarsApplicationMixin: C => C, ApplicationV2: class { render() { this.rendered = (this.rendered ?? 0) + 1; } close() { this.closed = true; } } }, instances: new Map() } };
globalThis.game = { settings: { get: (s, k) => settings[k] }, user: { id: "P1", isGM: false, can: () => false }, users: { activeGM: { id: "GM" }, get: id => ({ id, name: "Player One", isGM: false, character: null, update: async u => log("user.update", JSON.stringify(u)) }), filter: () => [] } };
globalThis.ui = { notifications: { warn: m => log("WARN", m), info: m => log("INFO", m), error: m => log("ERR", m) } };
globalThis.Actor = { create: async d => { created.push(d); return { id: "NEW", name: d.name }; } };
globalThis.ChatMessage = { create: async d => chats.push(d) };
const log = (...a) => console.log(" ", ...a);
const actions = await import("../../module/actions.mjs");
const { CharacterWizard, createCharacterForUser } = await import("../../module/wizard.mjs");
actions.GM_ACTIONS.createCharacter = createCharacterForUser;
let emitted = null; game.socket = { emit: (ch, d) => { emitted = d; } };

const w = new CharacterWizard();
const tpl = H.compile(fs.readFileSync(new URL("../../templates/wizard.hbs", import.meta.url), "utf8"));
const view = async () => { const ctx = await w._prepareContext({}); return { ctx, text: tpl(ctx).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() }; };
const change = obj => CharacterWizard.onChange.call(w, null, null, { object: obj });

console.log("== Step 1: identity"); let v = await view(); log(v.text.slice(0, 160));
change({ name: "Kara Voss", img: "" });
CharacterWizard.onNext.call(w);
console.log("== Step 2: stats (spend 85 of 90)");
change({ "stats.str": 30, "stats.dex": 20, "stats.con": 15, "stats.will": 10, "stats.build": 10 });
v = await view(); log(v.text.match(/\d+ of 90 stat points left[^.]*\./)[0]); log(v.text.slice(v.text.indexOf("HP "), v.text.indexOf("HP ") + 110));
change({ "stats.dex": -4 }); log("negative Dex clamps to", w.state.stats.dex); change({ "stats.dex": 20 });
CharacterWizard.onNext.call(w); CharacterWizard.onNext.call(w);
console.log("== Step 4: equipment");
CharacterWizard.onAddItem.call(w, null, { dataset: { kind: "weapon" } });
CharacterWizard.onAddItem.call(w, null, { dataset: { kind: "armor" } });
change({ "items.0.type": "bladed", "items.0.weight": "heavy" });   // hardwood isn't heavy → auto-fixes to iron
v = await view(); log(v.ctx.items.map(i => `${i.name} [${i.summary}]`).join(" | "));
log("materials offered for heavy weapons:", Object.values(v.ctx.items[0].materials).join(", "));
log("can add another armor?", v.ctx.canAddArmor, "| slots left:", v.ctx.slotsLeft);
CharacterWizard.onNext.call(w);
console.log("== Step 5: review"); v = await view(); log("errors:", v.ctx.errors.length ? v.ctx.errors : "none", "| Create enabled:", v.ctx.ready);
await CharacterWizard.onFinish.call(w);
log("sent to GM:", emitted?.action, "| wizard closed:", !!w.closed);

console.log("== GM receives it and creates the character");
await createCharacterForUser({ userId: emitted.userId, choice: emitted.choice });
const a = created[0];
log(`${a.name}: stats ${JSON.stringify(a.system.stats)}, SP ${a.system.skillPoints}, banked ${a.system.unspentStats}, creation ${a.system.creation}`);
log("ownership", JSON.stringify(a.ownership), "| items:", a.items.map(i => i.name).join(", "));

console.log("== A tampered request (125 stat points, rare material) is refused by the GM");
const bad = structuredClone(emitted.choice); bad.stats.str = 70; bad.items[0].material = "scarletite";
await createCharacterForUser({ userId: "P1", choice: bad });
log("actors created:", created.length, "| GM whisper:", chats.at(-1).content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
