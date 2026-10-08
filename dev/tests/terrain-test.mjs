// Mental Wonders: Life, Death, Order, Chaos, Beyond and Below (their Modes, Tenets and abilities, through the real attack exchange).
class Field { constructor(o={}){ Object.assign(this,o); } }
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 }); let confirmAnswer = true; let waitAnswer = "ap";
globalThis.foundry = {
  data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field, ObjectField: Field } },
  abstract: { TypeDataModel: class {} },
  utils: { escapeHTML: s => s, deepClone: o => structuredClone(o), getProperty: (o,k)=>k.split(".").reduce((a,b)=>a?.[b],o), setProperty: (o,k,v)=>{const p=k.split(".");let c=o;for(const x of p.slice(0,-1))c=c[x]??={};c[p.at(-1)]=v;} },
  applications: { api: { DialogV2: { prompt: async ({ content }) => dialog(content), confirm: async () => confirmAnswer, wait: async () => waitAnswer } } }
};
globalThis.Roll = class { constructor(f){ this.formula=f; } async evaluate(){ this.total = seq.length ? seq.shift() : 10; return this; } async render(){ return `<roll ${this.formula}=${this.total}>`; } };
globalThis.ChatMessage = { getSpeaker: ({actor}) => ({ alias: actor.name }),
  create: async d => { const m = { id: "m"+messages.length, ...d, getFlag: (s,k) => m.flags?.[s]?.[k], setFlag: async (s,k,v) => { m.flags ??= {}; (m.flags[s] ??= {})[k] = v; }, update: async u => { for (const [k, v] of Object.entries(u)) foundry.utils.setProperty(m, k, v); } }; messages.push(m); return m; } };
const combat = { id: "C", started: true, round: 1, turn: 0, combatant: null, combatants: [] };
globalThis.game = { settings: { get: () => false }, messages: { find: fn => messages.find(fn), filter: fn => messages.filter(fn), get: id => messages.find(m=>m.id===id) }, combat,
  users: Object.assign([{ id: "gm", isGM: true }], { activeGM: { id: "gm" } }), socket: { emit: (...a) => console.log("  socket emit", JSON.stringify(a[1])) }, user: { targets: new Set(), isGM: false }, actors: [] };
globalThis.ui = { notifications: { warn: m => console.log("  WARN", m), info: m => console.log("  INFO", m), error: m => console.log("  ERR", m) } };
globalThis.canvas = null;
globalThis.fromUuid = async u => uuids.get(u); globalThis.fromUuidSync = u => uuids.get(u);

const { FlowStateActorData, FlowStateWeaponData, FlowStateShroudData, FlowStateFociData, FlowStateIconData } = await import("../../module/data.mjs");
const actions = await import("../../module/actions.mjs");
const set = (o, k, v) => foundry.utils.setProperty(o, k, v);
function mkActor(name, extra={}, trees={}) {
  const a = { name, uuid: "Actor."+name, isOwner: true, items: [], statuses: new Set(), flags: {} };
  a.items.get = id => a.items.find(i => i.id === id);
  a.update = async u => { for (const [k,v] of Object.entries(u)) set(a, k, v); };
  a.setFlag = async (s,k,v) => set(a.flags, `${s}.${k}`, v);
  a.getFlag = (s,k) => foundry.utils.getProperty(a.flags, `${s}.${k}`);
  a.unsetFlag = async (s,k) => set(a.flags, `${s}.${k}`, undefined);
  a.toggleStatusEffect = async (id, { active }) => { active ? a.statuses.add(id) : a.statuses.delete(id); };
  a.getActiveTokens = () => [];
  a.system = Object.assign(Object.create(FlowStateActorData.prototype), { stats:{str:30,dex:30,con:30,pon:10,snap:10,will:10,reach:10,grasp:10,build:10}, skillPoints:30, unspentStats:0, statCarry:0, trees, size:3, hp:{value:432,lost:0}, energy:{value:50}, ap:{value:6}, rp:{value:6}, conditions:{ignite:0,stain:0,slow:0,haste:0}, lift:0, daysWithoutRest:0, ...extra }, { parent: a });
  a.system.prepareDerivedData(); uuids.set(a.uuid, a); game.actors.push(a);
  combat.combatants.push({ actor: a });
  return a;
}
function mkWeapon(actor, id, sys) {
  const i = { id, name: id, type: "weapon", uuid: `${actor.uuid}.Item.${id}`, parent: actor, actor };
  i.system = Object.assign(Object.create(FlowStateWeaponData.prototype), { weaponType: "bladed", weight: "light", material: "hardwood", grade: 1, twoHanded: false, equipped: true, secondHand: false, loaded: true, rounds: 1, magazine: 1, wear: 0, ...sys }, { parent: i });
  i.update = async u => { for (const [k,v] of Object.entries(u)) set(i, k, v); i.system.prepareDerivedData(); };
  i.system.prepareDerivedData(); actor.items.push(i); uuids.set(i.uuid, i); return i;
}
const text = m => m.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
let fails = 0; const ok2 = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
globalThis.CONFIG = {};
const T = await import("../../module/terrain.mjs");
const R = await import("../../module/rules.mjs");
actions.GM_ACTIONS.createTerrain = T.gmCreate;

console.log("== Terrain levels and movement cost");
ok2(T.terrainLevel([]) === 0 && T.terrainLevel(["rough"]) === 1 && T.terrainLevel(["rough", "difficult"]) === 2, "Rough +1, difficult +2, the worst wins");
ok2(T.terrainLevel(["difficult", "clear"]) === 0, "Cleared terrain cancels difficult terrain");
ok2(T.squareSideFt(6) === 5 && T.squareSideFt(25) === 5 && T.squareSideFt(30) === 10 && T.squareSideFt(100) === 10 && T.squareSideFt(0) === 5, "A square footprint from the Body (square root, up to whole 5 ft squares)");
ok2(R.movementCost({ terrain: 2 }).ap === 3 && R.movementCost({ terrain: 1 }).ap === 2 && R.movementCost({ crouch: true, terrain: 1 }).ap === 2 && R.movementCost({ crouch: true, terrain: 2 }).ap === 3 && R.movementCost({ prone: true, terrain: 1 }).ap === 3, "Terrain costs AP and doesn't stack with posture (the worst applies)");
const d = T.terrainRegionData("difficult", { cx: 250, cy: 250, sidePx: 200, flags: { terrainOf: "Actor.X" } });
ok2(d.shapes[0].x === 150 && d.shapes[0].width === 200 && d.flags.flowstate.terrain === "difficult" && d.flags.flowstate.terrainOf === "Actor.X", "Region data: a square around the point, flagged with its terrain");

console.log("== Keeping creatures in step with the terrain they stand in");
const hero = { name: "Hero", uuid: "Actor.Hero", type: "character", flags: {}, getFlag(s, k) { return foundry.utils.getProperty(this.flags, `${s}.${k}`); }, async setFlag(s, k, v) { foundry.utils.setProperty(this.flags, `${s}.${k}`, v); }, async unsetFlag(s, k) { foundry.utils.setProperty(this.flags, `${s}.${k}`, undefined); } };
const mud = { id: "R1", flags: { flowstate: { terrain: "difficult", terrainOf: "Actor.Hero" } } };
const rough = { id: "R2", flags: { flowstate: { terrain: "rough" } } };
const other = { id: "R3", flags: {} };
const regions = new Set([other, rough]);
const token = { actor: hero, regions };
const scene = { id: "S1", tokens: [token], regions: [mud, rough, other], grid: { size: 100, distance: 5 }, createEmbeddedDocuments: async (t, docs) => docs.map((x, i) => ({ id: `N${i}`, ...x })), deleteEmbeddedDocuments: async (t, ids) => { for (const id of ids) { const i = scene.regions.findIndex(r => r.id === id); if (i >= 0) scene.regions.splice(i, 1); } } };
globalThis.game.user.isActiveGM = true; game.user.isGM = true; game.scenes = [scene];
await T.syncTerrain(scene);
ok2(hero.getFlag("flowstate", "terrainLevel") === 1, "Standing in a rough terrain region (and a plain one): level 1");
regions.add(mud); await T.syncTerrain(scene);
ok2(hero.getFlag("flowstate", "terrainLevel") === 2, "Walking into difficult terrain: level 2");
regions.clear(); await T.syncTerrain(scene);
ok2(!hero.getFlag("flowstate", "terrainLevel"), "Leaving the terrain clears it");

console.log("== The creature's movement cost");
const a = { name: "Walker", uuid: "Actor.Walker", isOwner: true, items: [], statuses: new Set(), flags: {}, effects: [], getFlag(s, k) { return foundry.utils.getProperty(this.flags, `${s}.${k}`); } };
a.system = Object.assign(Object.create(FlowStateActorData.prototype), { stats: { str: 10, dex: 10, con: 10, pon: 10, snap: 10, will: 10, reach: 10, grasp: 10, build: 10 }, skillPoints: 30, unspentStats: 0, statCarry: 0, trees: {}, size: 3, hp: { value: 432, lost: 0 }, energy: { value: 100 }, ap: { value: 6 }, rp: { value: 6 }, conditions: { ignite: 0, stain: 0, slow: 0, haste: 0 }, lift: 0, daysWithoutRest: 0 }, { parent: a });
a.system.prepareDerivedData(); const flat = a.system.movement.ap;
foundry.utils.setProperty(a.flags, "flowstate.terrainLevel", 2); a.system.prepareDerivedData();
ok2(a.system.movement.ap === flat + 2, `Moving through difficult terrain costs +2 AP (${flat} → ${a.system.movement.ap})`);

console.log("== Spell terrain (Muddy / Harden)");
const tok = { center: { x: 300, y: 300 }, x: 250, y: 250, name: "Orc" };
const caster = { name: "Mage", uuid: "Actor.Mage", getActiveTokens: () => [{ center: { x: 100, y: 100 }, x: 50, y: 50 }] };
const orcActor = { name: "Orc", uuid: "Actor.Orc", getActiveTokens: () => [tok] };
globalThis.canvas = { scene };
game.scenes = [scene]; game.scenes.get = id => (id === "S1" ? scene : null);
let created = [];
scene.createEmbeddedDocuments = async (t, docs) => { created.push(...docs); scene.regions.push(...docs.map((x, i) => ({ id: `C${created.length}${i}`, ...x }))); return docs; };
const line = await T.placeSpellTerrain({ actor: caster, kind: "difficult", body: 30, target: orcActor, label: "Muddy ground" });
ok2(created.length === 1 && created[0].flags.flowstate.terrain === "difficult" && created[0].shapes[0].width === 200 && /10 ft square around Orc/.test(line), `Muddy puts a 10 ft difficult-terrain square around the target (${line})`);
ok2(created[0].shapes[0].x === 200, "…centred on their token");
await T.placeSpellTerrain({ actor: caster, kind: "clear", body: 6, label: "Hardened ground", ritualOf: "Effect.R" });
ok2(created[1].flags.flowstate.terrain === "clear" && created[1].flags.flowstate.ritualOf === "Effect.R" && created[1].shapes[0].width === 100, "Harden puts cleared terrain around the caster when nothing is targeted, tied to the Ritual");
await T.clearTerrain(caster);
ok2(scene.regions.some(r => r.flags?.flowstate?.ritualOf === "Effect.R") && !scene.regions.some(r => r.flags?.flowstate?.terrainOf === "Actor.Mage" && !r.flags.flowstate.ritualOf), "At the start of the caster's next turn their terrain ends, Ritual terrain stays");
await T.endRitual("Effect.R");
ok2(!scene.regions.some(r => r.flags?.flowstate?.ritualOf === "Effect.R"), "…and Ritual terrain ends with the Ritual");

// The scene-control buttons: one click drops one region even if Foundry reports the click twice.
const before = created.length;
await Promise.all([T.dropTerrain("rough"), T.dropTerrain("rough")]);
ok2(created.length === before + 1 && created.at(-1).flags.flowstate.terrain === "rough" && created.at(-1).flags.flowstate.placed, "A button click drops a single region (a repeat within a moment is ignored)");
await new Promise(r => setTimeout(r, 750));
await T.dropTerrain("rough");
ok2(created.length === before + 2, "…and a later click drops another");
await new Promise(r => setTimeout(r, 750));
await T.dropTerrain("difficult");
ok2(created.length === before + 3 && created.at(-1).flags.flowstate.terrain === "difficult", "…and a different button isn't held up by the last one");

console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
