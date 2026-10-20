import { createRequire } from "node:module"; const require = createRequire(import.meta.url);
const H = require("handlebars"), fs = require("fs");
class Field { constructor(o={}){ Object.assign(this,o); } }
globalThis.Hooks = { on() {}, once() {} };
globalThis.foundry = { data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field, ObjectField: Field } }, abstract: { TypeDataModel: class {} },
  applications: { api: { HandlebarsApplicationMixin: C => C, ApplicationV2: class {} }, sheets: { ActorSheetV2: class { async _prepareContext() { return {}; } _prepareTabs() { return {}; } }, ItemSheetV2: class {} } } };
globalThis.game = { user: { isGM: false }, settings: { get: () => false }, combat: null };
const { FlowStateActorData } = await import("../../module/data.mjs");
const { FlowStateActorSheet } = await import("../../module/sheets.mjs");
H.registerHelper("eq", (a, b) => a === b);
H.registerPartial("fsSkillNavRow", fs.readFileSync(new URL("../../templates/skill-nav-row.hbs", import.meta.url), "utf8"));
const tpl = H.compile(fs.readFileSync(new URL("../../templates/actor-skills.hbs", import.meta.url), "utf8"));
function mk(trees, sp = 30) {
  const actor = { items: [], statuses: new Set(), uuid: `A.${Math.random()}`, type: "character", flags: {} };
  actor.getFlag = (sc, k) => actor.flags[sc]?.[k];
  actor.setFlag = async (sc, k, v) => { (actor.flags[sc] ??= {})[k] = v; };
  actor.system = Object.assign(Object.create(FlowStateActorData.prototype), { stats:{str:10,dex:10,con:10,pon:10,snap:10,will:10,reach:10,grasp:10,build:10}, skillPoints: sp, size:3, hp:{value:1,lost:0}, energy:{value:0}, ap:{value:6}, rp:{value:6}, conditions:{ignite:0,stain:0,slow:0,haste:0}, lift:0, daysWithoutRest:0, trees, unspentStats: 0, creation: false }, { parent: actor });
  actor.system.prepareDerivedData();
  const sheet = new FlowStateActorSheet(); sheet.document = actor; sheet.isEditable = true; sheet.render = () => {}; return sheet;
}
const view = async (sheet, sel) => { if (sel) Object.assign(sheet.skillSelection, sel); const ctx = await sheet._prepareContext({}); return { ctx, text: tpl({ tab: {}, ...ctx }).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() }; };

let fails = 0; const ok = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const ids = rows => rows.map(r => r.id);

console.log("== A new character (30 SP, nothing spent)");
let v = await view(mk({}));
let nav = v.ctx.skillView.nav;
ok(!nav.pinned.length && !nav.yours.length && nav.unlock.map(g => g.label).join() === "Martial,Mental,Magic", "Nothing bought yet: the three Theories are what they can start");
ok(nav.unlock.every(g => g.rows[0].theory && g.rows[0].canRaise) && v.ctx.skillView.tree.id === "martial-theory", "…each can be raised, and Martial Theory is shown first");
ok(nav.locked.some(l => l.label === "Martial" && l.count > 20) && nav.placeholders.some(p => p.label === "Generic"), "Locked trees are counted per Archetype; Generic is marked coming soon");
ok(/Find a tree/.test(tpl({ tab: {}, ...v.ctx })) && v.text.includes("Martial Theory"), "The list renders with its filter box");

console.log("== Theory 2, Brawling 3 (spent 3+6=9)");
let sheet = mk({ "martial-theory": 2, "martial-brawling-methods": 3 });
v = await view(sheet);
nav = v.ctx.skillView.nav;
ok(ids(nav.yours).join() === "martial-theory,martial-brawling-methods" && nav.yours[1].tier === 3, "Trees with points are listed together, Theory first, with their tier");
ok(v.ctx.skillView.tree.id === "martial-theory", "The first of them is shown");
const startable = nav.unlock.find(g => g.label === "Martial").rows;
ok(startable.some(r => r.id === "martial-bladed-weapons") && !startable.some(r => r.id === "martial-brawling-methods"), "The Martial trees they could start (Bladed) are listed apart, not the ones they have");
await FlowStateActorSheet.onPinTree.call(sheet, { stopPropagation() {} }, { dataset: { tree: "martial-bladed-weapons" } });
v = await view(sheet);
nav = v.ctx.skillView.nav;
ok(ids(nav.pinned).join() === "martial-bladed-weapons" && !nav.unlock.find(g => g.label === "Martial").rows.some(r => r.id === "martial-bladed-weapons"), "Pinning Bladed puts it at the top, and only there");
FlowStateActorSheet.onSelectTree.call(sheet, null, { dataset: { tree: "martial-brawling-methods" } });
v = await view(sheet);
ok(v.ctx.skillView.tree.id === "martial-brawling-methods" && v.ctx.skillView.nav.yours.find(r => r.id === "martial-brawling-methods").selected, "Clicking a tree shows it and marks it in the list");
const t4 = v.ctx.skillView.tree.tiers.find(t => t.tier === 4);
ok(t4.isNext && t4.canUnlock && t4.entries.length > 0, "Its next tier (4) can be unlocked from there");
v = await view(sheet, { filter: "blad" });
ok(ids(v.ctx.skillView.nav.pinned).join() === "martial-bladed-weapons" && !v.ctx.skillView.nav.yours.length && !v.ctx.skillView.nav.unlock.length, "The filter keeps only trees whose name matches");
v = await view(sheet, { filter: "" });

console.log("== Only 12 SP (3 left): the next tier costs 4");
v = await view(mk({ "martial-theory": 2, "martial-brawling-methods": 3 }, 12), { tree: "martial-brawling-methods" });
const next = v.ctx.skillView.tree.tiers.find(t => t.isNext);
ok(!next.canUnlock && /Costs 4/.test(next.reason) && !v.ctx.skillView.nav.yours.find(r => r.id === "martial-brawling-methods").canRaise, "The button is disabled with its reason, and the list doesn't mark it as raisable");

console.log("== A tree not open yet");
v = await view(mk({}), { tree: "martial-titanic-armor" });
ok(/Opens at Martial Theory Tier/.test(v.ctx.skillView.lockedNote), "Showing a locked tree says what opens it");

console.log(fails ? `${fails} FAILED` : "All Skills tab checks passed");
if (fails) process.exit(1);
