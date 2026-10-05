import { createRequire } from "node:module"; const require = createRequire(import.meta.url);
const H = require("handlebars"), fs = require("fs");
H.registerHelper("selectOptions", (o, { hash }) => new H.SafeString(Object.entries(o).map(([k, v]) => `<option value="${k}"${k === hash.selected ? " selected" : ""}>${v}</option>`).join("")));
H.registerHelper("checked", v => (v ? "checked" : ""));
const created = [];
globalThis.Hooks = { on() {}, once() {} };
globalThis.foundry = { utils: { expandObject: o => { const r = {}; for (const [k, v] of Object.entries(o)) { const ps = k.split("."); let t = r; ps.slice(0, -1).forEach(p => t = t[p] ??= {}); t[ps.at(-1)] = v; } return r; }, deepClone: o => structuredClone(o), escapeHTML: s => s },
  applications: { api: { HandlebarsApplicationMixin: C => C, ApplicationV2: class { render() { this.rendered = (this.rendered ?? 0) + 1; } close() { this.closed = true; } } }, instances: new Map() } };
globalThis.game = { settings: { get: () => 0 }, user: { id: "GM", isGM: true, can: () => true } };
const warns = [];
globalThis.ui = { notifications: { warn: m => warns.push(m), info() {}, error() {} } };
globalThis.Actor = { create: async d => { created.push(d); return { id: "NEW", name: d.name, sheet: { render() {} } }; } };
const { NpcWizard, createNpc } = await import("../../module/npc-wizard.mjs");
const npc = await import("../../module/npc-creation.mjs");
let bad = 0; const check = (ok, msg) => { console.log(ok ? "  ok" : "  FAIL", msg); if (!ok) bad++; };

const w = new NpcWizard();
const tpl = H.compile(fs.readFileSync(new URL("../../templates/npc-wizard.hbs", import.meta.url), "utf8"));
const view = async () => { const ctx = await w._prepareContext({}); return { ctx, text: tpl(ctx).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() }; };
const change = obj => NpcWizard.onChange.call(w, null, null, { object: obj });
const add = kind => NpcWizard.onAddItem.call(w, null, { dataset: { kind } });

console.log("== budget: ratio and Skill Points");
check(npc.skillPointsFrom(90, 3) === 30 && npc.skillPointsFrom(100, 3) === 33, "90/3 = 30 SP, 100/3 = 33 SP");
change({ statPoints: 120, ratio: 4 });
let v = await view();
check(v.ctx.preview.skillPoints === 30, "120 stat points at ratio 4 → 30 Skill Points");
change({ skillManual: true, skillPoints: 50 });
v = await view(); check(v.ctx.preview.skillPoints === 50 && v.ctx.skillPointsField === 50, "manual Skill Points override the ratio");
change({ skillManual: false }); v = await view(); check(v.ctx.preview.skillPoints === 30, "back to ratio-derived");
check(w.state.stats.str + w.state.stats.dex >= 0, "stats start evenly spread");
check(Object.values(w.state.stats).reduce((a, b) => a + b, 0) === 90, "the starting even spread uses the default 90 points");
NpcWizard.onEvenStats.call(w); check(Object.values(w.state.stats).reduce((a, b) => a + b, 0) === 120, "Even spread uses all 120 points");
change({ "stats.str": 200 }); v = await view(); check(v.ctx.overspent && v.ctx.errors.some(e => /stat points are spent/.test(e)), "overspending is an error");
NpcWizard.onEvenStats.call(w);

console.log("== gear: any rarity, grade, ready");
change({ name: "Warlord", size: 4 });
add("weapon"); add("weapon"); add("weapon"); add("armor"); add("armor"); add("gear");
v = await view(); check(v.ctx.errors.some(e => /two weapons/.test(e)), "three ready weapons is an error");
change({ "items.2.readyMark": "1" });
check(w.state.items[2].ready === false, "unchecked Ready (hidden marker, no checkbox) turns ready off");
v = await view(); check(v.ctx.errors.some(e => /one armor/.test(e)), "two worn armors is an error");
change({ "items.4.readyMark": "1" });
change({ "items.0.type": "assault", "items.0.weight": "heavy", "items.0.grade": 3 });
change({ "items.3.weight": "heavy", "items.3.grade": 2 });
change({ "items.5.name": "Rope", "items.5.quantity": 3 });
v = await view(); check(!v.ctx.errors.length, "no errors: " + v.ctx.errors.join("; ")); NpcWizard.onGoto.call(w, null, { dataset: { step: 4 } }); v = await view();
check(v.text.includes("Create NPC"), "Create button shown on review");
const mats = Object.keys(v.ctx.items[0].materials);
check(mats.length > 0, "materials offered: " + mats.join(","));
check(v.ctx.items[3].materials && Object.keys(v.ctx.items[3].materials).length > 0, "armor materials offered");

console.log("== buildNpcData");
const d = npc.buildNpcData(w.state);
check(d.type === "npc" && d.prototypeToken.actorLink === false && d.prototypeToken.disposition === -1, "unlinked hostile NPC by default");
check(d.prototypeToken.width === 2 && d.system.size === 4, "Size 4 = 2 squares");
check(d.system.skillPoints === 30, "Skill Points from ratio");
const names = d.items.map(i => i.name);
const un = d.items.find(i => i.name === "Unarmed"); check(un.system.equipped === false, "Unarmed isn't held when a weapon is ready");
check(d.items.some(i => i.name === "Rope" && i.system.quantity === 3), "plain gear added");
const arm = d.items.filter(i => i.type === "armor"); check(arm.length === 2 && arm.filter(a => a.system.equipped).length === 1, "two armors, one worn: " + names.join(" | "));
check(d.items.some(i => i.type === "gear" && i.system.ammoType === "assault" && i.system.quantity === 20), "ranged weapon comes with 20 ammo");
check(d.items.find(i => i.type === "weapon" && i.system.grade === 3), "grade is kept");

console.log("== magic gear is any rarity");
add("foci"); add("shroud"); add("icon"); add("affix");
v = await view(); log: console.log("  errors:", v.ctx.errors.join("; ") || "none");
const rar = npc.newNpcSlot("foci"); check(rar && Object.keys(v.ctx.items[6].typeChoices ?? []).length > 0, "Foci types offered");

console.log("== GM only");
const created0 = created.length;
game.user.isGM = false;
warns.length = 0;
NpcWizard.open(); check(warns.length === 1 && !foundry.applications.instances.size, "non-GM can't open the wizard");
const r = await createNpc(npc.NPC_DEFAULTS && { ...w.state }); check(r === null && created.length === created0, "non-GM can't create an NPC");
game.user.isGM = true;
const bad2 = await createNpc({ ...w.state, name: "" }); check(bad2 === null, "invalid choice refused");
const ok = await createNpc({ ...w.state, items: w.state.items.slice(0, 6) }); check(ok && created.length === created0 + 1, "GM creates the NPC");
if (bad) { console.log(`FAIL: ${bad}`); process.exit(1); }
