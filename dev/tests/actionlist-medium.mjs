class Field { constructor(o={}){ Object.assign(this,o); } }
globalThis.Hooks = { on() {} };
globalThis.foundry = { data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field, ObjectField: Field } }, abstract: { TypeDataModel: class {} },
  applications: { api: { HandlebarsApplicationMixin: C => C }, sheets: { ActorSheetV2: class {}, ItemSheetV2: class {} } } };
const { FlowStateActorData, FlowStateArmorData } = await import("../../module/data.mjs");
const { buildActionList } = await import("../../module/sheets.mjs");
let fails = 0; const ok = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const armor = { type: "armor", system: Object.assign(Object.create(FlowStateArmorData.prototype), { weight: "medium", material: "hide", grade: 10, equipped: true, wear: 0 }) };
const actor = { items: [armor], statuses: new Set(), flags: {}, getFlag(s, k) { return this.flags[k]; } };
actor.system = Object.assign(Object.create(FlowStateActorData.prototype), { stats:{str:10,dex:10,con:10,pon:10,snap:10,will:10,reach:10,grasp:10,build:10}, skillPoints:30, size:3, hp:{value:400,lost:0}, energy:{value:150}, ap:{value:6}, rp:{value:6}, conditions:{ignite:0,stain:0,slow:0,haste:0}, lift:0, daysWithoutRest:0, trees: { "martial-medium-armor": 5, "martial-rapid-weapons": 3, "martial-swift-weapons": 4 } }, { parent: actor });
const rows = () => { actor.system.prepareDerivedData(); return buildActionList(actor, []).flatMap(g => g.actions); };
let r = rows(); console.log("armor:", JSON.stringify(armor.system.profile), !!actor.system.armor);
const cs = r.find(a => a.op === "careful");
ok(cs && !cs.disabled, "Careful Steps shown and clickable with Medium armor worn");
ok(r.find(a => a.op === "versatility"), "Versatility shown");
ok(!r.find(a => a.op === "mark") && !r.find(a => a.op === "eviscerate"), "Mark / Eviscerate hidden without the weapons");
armor.system.equipped = false; r = rows();
ok(!r.find(a => a.op === "careful") && !r.find(a => a.op === "versatility"), "hidden without Medium armor");
process.exit(fails ? 1 : 0);
