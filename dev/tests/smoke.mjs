// Minimal Foundry mocks to exercise the data models' derived data.
class Field { constructor(o={}){ Object.assign(this,o); } }
globalThis.foundry = { data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field } },
  abstract: { TypeDataModel: class {} } };
const { FlowStateActorData, FlowStateWeaponData, FlowStateArmorData } = await import("../../module/data.mjs");
const mk = (Cls, data, parent) => Object.assign(Object.create(Cls.prototype), structuredClone(data), { parent });
const items = [];
const actor = { items, statuses: new Set(["stealth"]) };
const sys = mk(FlowStateActorData, { stats:{str:24,dex:10,con:24,pon:10,snap:10,will:10,reach:10,grasp:10,build:10}, skillPoints:30, size:3, hp:{value:100,lost:0}, energy:{value:0}, ap:{value:6}, rp:{value:6}, conditions:{ignite:0,stain:0,slow:0,haste:0}, lift:0, daysWithoutRest:0 }, actor);
actor.system = sys;
const wItem = { type:"weapon", actor }; wItem.system = mk(FlowStateWeaponData, {weaponType:"bladed",weight:"heavy",material:"iron",grade:3,twoHanded:false,equipped:true,loaded:true,wear:10}, wItem);
const aItem = { type:"armor", actor }; aItem.system = mk(FlowStateArmorData, {weight:"heavy",material:"steel",grade:3,equipped:true,wear:0}, aItem);
items.push(wItem, aItem);
wItem.system.prepareDerivedData(); aItem.system.prepareDerivedData(); // before actor derived (no actor stats yet)
sys.prepareDerivedData();
console.log("weapon", wItem.system.profile.formula, wItem.system.durability, "armor", aItem.system.profile.mult, aItem.system.durability, aItem.system.profile.limit);
console.log("penalties", sys.penalties, "move", sys.movement, "armor is", sys.armor === aItem);
