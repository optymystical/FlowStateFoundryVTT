// Speed: Size maximum, less armor, Affix and Alignment percentages (and what each piece of equipment does to it).
class Field { constructor(o={}){ Object.assign(this,o); } }
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 });
globalThis.foundry = {
  data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field, ObjectField: Field } },
  abstract: { TypeDataModel: class {} },
  utils: { escapeHTML: s => s, deepClone: o => structuredClone(o), getProperty: (o,k)=>k.split(".").reduce((a,b)=>a?.[b],o), setProperty: (o,k,v)=>{const p=k.split(".");let c=o;for(const x of p.slice(0,-1))c=c[x]??={};c[p.at(-1)]=v;} },
  applications: { api: { DialogV2: { prompt: async ({ content }) => dialog(content) } } }
};
globalThis.Roll = class { constructor(f){ this.formula=f; } async evaluate(){ this.total = seq.length ? seq.shift() : 10; return this; } async render(){ return `<roll ${this.formula}=${this.total}>`; } };
globalThis.ChatMessage = { getSpeaker: ({actor}) => ({ alias: actor.name }),
  create: async d => { const m = { id: "m"+messages.length, ...d, getFlag: (s,k) => d.flags?.[s]?.[k] }; messages.push(m); return m; } };
const combat = { id: "C", started: true, round: 1, turn: 0, combatant: null, combatants: [] };
globalThis.game = { settings: { get: () => false }, messages: { find: fn => messages.find(fn), filter: fn => messages.filter(fn), get: id => messages.find(m=>m.id===id) }, combat,
  users: { activeGM: { id: "gm" } }, socket: { emit: (...a) => console.log("  socket emit", JSON.stringify(a[1])) }, user: { targets: new Set(), isGM: false }, actors: [] };
globalThis.ui = { notifications: { warn: m => console.log("  WARN", m), info: m => console.log("  INFO", m), error: m => console.log("  ERR", m) } };
globalThis.canvas = null;
globalThis.fromUuid = async u => uuids.get(u); globalThis.fromUuidSync = u => uuids.get(u);

const { FlowStateActorData, FlowStateShroudData, FlowStateFociData, FlowStateArmorData } = await import("../../module/data.mjs");
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

const M = await import("../../module/magic.mjs");
let fails = 0; const ok2 = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const mkItem = (actor, id, type, Cls, sys) => {
  const i = { id, name: id, type, uuid: `${actor.uuid}.Item.${id}`, parent: actor, actor, isOwner: true };
  i.system = Object.assign(Object.create(Cls.prototype), sys, { parent: i });
  actor.items.push(i); actor.system.prepareDerivedData(); return i;
};
const MAT = { light: "cloth", medium: "hide", heavy: "titanium", titanic: "iron" };
const armor = (a, weight, material = MAT[weight]) => mkItem(a, `armor-${weight}-${material}`, "armor", FlowStateArmorData, { weight, material, grade: 3, equipped: true, wear: 0 });
const foci = (a, fociType, affixes = [], extra = {}) => mkItem(a, `foci-${fociType}`, "foci", FlowStateFociData, { fociType, grade: 3, attuned: true, equipped: false, twoHanded: false, wear: 0, affixes, doubled: "", element: "heat", chosenSpell: "", ...extra });
const shroud = (a, shroudType, affixes = [], extra = {}) => mkItem(a, `shroud-${shroudType}`, "shroud", FlowStateShroudData, { shroudType, grade: 3, attuned: true, wear: 0, affixes, doubled: "", element: "heat", declared: "", lush: false, carapace: 0, negated: [], lastType: "", hitSources: [], placedOn: "", ...extra });
const speed = a => { a.system.prepareDerivedData(); return a.system.movement.speed; };

console.log("== Base speed is the Size maximum");
const hero = mkActor("Hero");
ok2(speed(hero) === 50 && hero.system.movement.speedLoss.total === 0, "A Size 3 character with nothing on moves 50 ft, whatever their stats");
hero.system.stats.dex = 0; hero.system.stats.snap = 0; hero.system.stats.grasp = 0;
ok2(speed(hero) === 50, "…even with no Dexterity, Snap or Grasp");
hero.system.size = 2; ok2(speed(hero) === 25, "Size 2: 25 ft"); hero.system.size = 4; ok2(speed(hero) === 100, "Size 4: 100 ft"); hero.system.size = 3;

console.log("== Armor takes a percentage");
for (const [w, ft] of [["light", 40], ["medium", 30], ["heavy", 20], ["titanic", 10]]) {
  const a = mkActor(`A-${w}`); armor(a, w);
  ok2(speed(a) === ft && a.system.movement.ap === 1, `${w} armor: ${ft} ft, still 1 AP a move`);
}
const heavyStealth = mkActor("Stealthy"); armor(heavyStealth, "heavy");
ok2(heavyStealth.system.penalties.stealthDis === 2, "Heavy armor: two stacks of stealth Disadvantage");
const gi = mkActor("GrayIron"); armor(gi, "titanic", "grayIron");
ok2(speed(gi) === 5 && gi.system.movement.ap === 1 && gi.system.penalties.physicalDis === undefined, "Gray Iron Titanic: speed 0% (5 ft minimum), and the old physical Disadvantage is gone");
const gs = mkActor("GraySteel"); armor(gs, "titanic", "graySteel");
ok2(speed(gs) === 5 && gs.system.movement.ap === 2, "Gray Steel Titanic: speed 0% and +1 AP to move");
const gsh = mkActor("GraySteelHeavy"); armor(gsh, "heavy", "graySteel");
ok2(speed(gsh) === 5 && gsh.system.movement.ap === 1, "Gray Steel Heavy: speed 0%");
const tr = mkActor("Trudger"); armor(tr, "titanic", "graySteel"); tr.flags.flowstate = { trudge: true };
ok2(speed(tr) === 50 && tr.system.movement.ap === 1, "Trudge ignores the armor's speed loss and AP for the move");
const qk = mkActor("Quick"); qk.statuses.add("quickened");
ok2(speed(qk) === 100, "Quicken doubles the speed");

console.log("== Affixes");
const P = (n, free = 0) => ({ valid: true, affixes: Array.from({ length: n }, (_, i) => `a${i}`), freeAffixes: free });
ok2(M.affixSpeedPct() === 0 && M.affixSpeedPct(P(0)) === 0, "No Affixes: no loss");
ok2(M.affixSpeedPct(P(1)) === 20 && M.affixSpeedPct(P(2)) === 40, "Every attuned Affix costs 20% (nobody gets one free any more)");
ok2(M.affixSpeedPct(P(2, 2)) === 0 && M.affixSpeedPct(P(3, 2)) === 20, "A Rod's 2 Free Affixes cover two; the third costs 20%");
ok2(M.affixSpeedPct(P(2, 0), P(1, 0)) === 60 && M.affixSpeedPct(P(2, 2), P(1, 1)) === 0, "The Foci's and the Shroud's Affixes are counted together, with their Free Affixes");
ok2(M.affixSpeedPct(P(0, -1)) === 20 && M.affixSpeedPct(P(1, -1)) === 40, "A Chime acts as if an Affix were already attuned (20% even with none)");
ok2(M.affixSpeedPct(P(0, -1), P(0, -1)) === 40, "Chime and Aegis together count as two");
const mage = mkActor("Mage");
foci(mage, "rod", ["agate", "jasper"]);
ok2(speed(mage) === 50, "A Rod holds two Affixes with no speed loss");
const rod3 = mkActor("Rod3"); foci(rod3, "rod", ["agate", "jasper", "garnet"]);
ok2(speed(rod3) === 40, "…a third costs 20% (50 → 40 ft)");
const wandMage = mkActor("WandMage"); foci(wandMage, "wand", ["agate"]);
ok2(speed(wandMage) === 40, "A Wand with one Affix loses 20% (50 → 40 ft)");
const both = mkActor("Both"); foci(both, "wand", ["agate", "jasper"]); shroud(both, "cinder", ["jasper", "garnet"]);
ok2(speed(both) === 10, "Wand (2) + Cinder (2): four Affixes, no Free Affixes, so 80% (50 → 10 ft)");
const unattuned = mkActor("Unattuned"); foci(unattuned, "wand", ["agate", "jasper"], { attuned: false });
ok2(speed(unattuned) === 50, "Affixes on Foci that aren't attuned cost nothing");
const mix = mkActor("Mix"); armor(mix, "medium"); foci(mix, "wand", ["agate"]);
ok2(speed(mix) === 20 && mix.system.movement.speedLoss.total === 60, "Armor and Affixes add together (40% + 20%)");

console.log("== One Affix is doubled (Shard, Orb, Band, Keystone)");
const ks = mkActor("Keystoner"); const k = shroud(ks, "keystone", ["agate", "jasper"], { doubled: "jasper" });
ok2(k.system.profile.doubled === "jasper" && M.affixMultOf(k.system.profile, "jasper") === 2 && M.affixMultOf(k.system.profile, "agate") === 1, "Keystone: only the chosen Affix is doubled");
const k2 = shroud(mkActor("K2"), "keystone", ["agate", "jasper"]);
ok2(k2.system.profile.doubled === "agate", "…defaulting to the first Affix");
const b = foci(mkActor("B"), "band", ["quartz"], { doubled: "quartz" });
ok2(b.system.profile.doubled === "quartz" && b.system.profile.freeAffixes === 0, "Band doubles an Offensive Affix");
const plain = shroud(mkActor("P"), "bastion", ["agate"], { doubled: "agate" });
ok2(plain.system.profile.doubled === null && M.affixMultOf(plain.system.profile, "agate") === 1 && plain.system.profile.freeAffixes === 1, "Other types double nothing; a Bastion has 1 Free Affix");

console.log("== Alignment");
const mind = mkActor("Mind"); mind.flags.flowstate = { alignment: { kind: "nightmare", level: 3 } };
ok2(speed(mind) === 20 && mind.system.movement.speedLoss.alignment === 60, "3 Alignment costs 60% speed");
mind.flags.flowstate.alignment.equilibrium = true;
ok2(speed(mind) === 50, "Equilibrium has no speed penalty");
const all = mkActor("All"); all.flags.flowstate = { alignment: { kind: "dream", level: 4 } }; armor(all, "titanic");
ok2(speed(all) === 5, "Armor 80% + Alignment 80% is capped by the 5 ft minimum");

console.log(fails ? `${fails} FAILED` : "all speed tests passed");
process.exit(fails ? 1 : 0);
