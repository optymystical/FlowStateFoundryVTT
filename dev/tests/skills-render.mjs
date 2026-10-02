import { createRequire } from "node:module"; const require = createRequire(import.meta.url);
const H = require("handlebars"), fs = require("fs");
class Field { constructor(o={}){ Object.assign(this,o); } }
globalThis.Hooks = { on() {}, once() {} };
globalThis.foundry = { data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field, ObjectField: Field } }, abstract: { TypeDataModel: class {} },
  applications: { api: { HandlebarsApplicationMixin: C => C, ApplicationV2: class {} }, sheets: { ActorSheetV2: class { async _prepareContext() { return {}; } _prepareTabs() { return {}; } }, ItemSheetV2: class {} } } };
globalThis.game = { user: { isGM: false }, settings: { get: () => false }, combat: null };
const { FlowStateActorData } = await import("../../module/data.mjs");
const { FlowStateActorSheet } = await import("../../module/sheets.mjs");
const tpl = H.compile(fs.readFileSync(new URL("../../templates/actor-skills.hbs", import.meta.url), "utf8"));
function mk(trees, sp = 30) {
  const actor = { items: [], statuses: new Set(), uuid: "A.1", type: "character" };
  actor.system = Object.assign(Object.create(FlowStateActorData.prototype), { stats:{str:10,dex:10,con:10,pon:10,snap:10,will:10,reach:10,grasp:10,build:10}, skillPoints: sp, size:3, hp:{value:1,lost:0}, energy:{value:0}, ap:{value:6}, rp:{value:6}, conditions:{ignite:0,stain:0,slow:0,haste:0}, lift:0, daysWithoutRest:0, trees, unspentStats: 0, creation: false }, { parent: actor });
  actor.system.prepareDerivedData();
  const sheet = new FlowStateActorSheet(); sheet.document = actor; sheet.isEditable = true; return sheet;
}
const view = async (sheet, sel) => { if (sel) Object.assign(sheet.skillSelection, sel); const ctx = await sheet._prepareContext({}); return { ctx, text: tpl({ tab: {}, ...ctx }).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() }; };

console.log("== New character (30 SP, nothing spent), Martial");
let v = await view(mk({}));
console.log(" ", v.text.slice(0, 190));
console.log("  trees offered:", v.ctx.skillView.trees.map(t => t.label).join(" | "));
console.log("  tier states:", v.ctx.skillView.tree.tiers.map(t => `T${t.tier}:${t.free ? "free" : t.owned ? "owned" : t.isNext ? (t.canUnlock ? "UNLOCK" : "next-blocked") : "locked"}`).join(" "));

console.log("== Theory 2, Brawling 3 (spent 3+6=9), Martial → Brawling");
v = await view(mk({ "martial-theory": 2, "martial-brawling-methods": 3 }), { tree: "martial-brawling-methods" });
console.log("  points:", JSON.stringify(v.ctx.skillView.points), "| trees:", v.ctx.skillView.trees.length, "|", v.ctx.skillView.lockedNote);
console.log("  tier states:", v.ctx.skillView.tree.tiers.map(t => `T${t.tier}:${t.owned ? "owned" : t.isNext ? `next(${t.reason})` : "locked"}`).join(" "));
const t4 = v.ctx.skillView.tree.tiers.find(t => t.tier === 4);
console.log("  T4 entries:", t4.entries.map(e => e.name).join(", "));

console.log("== Only 3 unspent SP, next tier costs 4 → button disabled with reason");
v = await view(mk({ "martial-theory": 2, "martial-brawling-methods": 3 }, 12), { tree: "martial-brawling-methods" });
console.log("  next tier:", v.ctx.skillView.tree.tiers.find(t => t.isNext).reason, "| canUnlock:", v.ctx.skillView.tree.tiers.find(t => t.isNext).canUnlock);

console.log("== Mental placeholder / Magic default");
v = await view(mk({}), { archetype: "mental", tree: null }); console.log(" ", v.ctx.skillView.placeholder);
v = await view(mk({}), { archetype: "magic", tree: null }); console.log("  magic trees:", v.ctx.skillView.trees.map(t => t.label).join(" | "), "| T0 entries:", v.ctx.skillView.tree.tiers[0].entries.length);
