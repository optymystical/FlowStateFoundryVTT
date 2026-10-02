class Field { constructor(o={}){ Object.assign(this,o); } }
globalThis.Hooks = { on() {} };
globalThis.foundry = { data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field } }, abstract: { TypeDataModel: class {} },
  applications: { api: { HandlebarsApplicationMixin: C => C }, sheets: { ActorSheetV2: class {}, ItemSheetV2: class {} } } };
const { FlowStateActorData } = await import("../../module/data.mjs");
const { buildActionList } = await import("../../module/sheets.mjs");
const actor = { items: [], statuses: new Set() };
actor.system = Object.assign(Object.create(FlowStateActorData.prototype), { stats:{str:10,dex:10,con:10,pon:10,snap:10,will:10,reach:10,grasp:10,build:10}, skillPoints:30, size:3, hp:{value:400,lost:0}, energy:{value:150}, ap:{value:6}, rp:{value:6}, conditions:{ignite:4,stain:0,slow:0,haste:0}, lift:0, daysWithoutRest:0 }, { parent: actor });
actor.system.prepareDerivedData();
const weapons = [
  { id: "u", name: "Unarmed", unarmed: true, system: { held: true }, profile: { valid: true, ap: 2 }, formula: "1d8 / 1d12", damageType: "Physical" },
  { id: "b", name: "Crossbow", system: { held: true }, profile: { valid: true, reloadRP: 2 }, needsReload: true },
  { id: "s", name: "Sword (stowed)", system: { held: false }, profile: { valid: true, ap: 2 } }
];
for (const g of buildActionList(actor, weapons)) {
  console.log(`[${g.name}]`);
  for (const a of g.actions) console.log(`  ${(a.action ? "▶" : "·")} ${a.label.padEnd(22)} ${String(a.detail).padEnd(30)} ${a.cost}${a.disabled ? "  (greyed out)" : ""}`);
}
