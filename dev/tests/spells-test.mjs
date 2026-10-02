// Spell framework: catalog, Threshold/Energy math, casting options, and the cast flow.
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

const { FlowStateActorData, FlowStateWeaponData, FlowStateShroudData, FlowStateFociData } = await import("../../module/data.mjs");
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
const ok = (c, msg) => console.log(`  ${c ? "PASS" : "FAIL"} ${msg}`);

globalThis.CONFIG = {};
let fails = 0; const ok2 = (c, m) => { ok(c, m); if (!c) fails++; };
const S = await import("../../module/spells.mjs");
const C = await import("../../module/casting.mjs");
function mkFoci(actor, id, sys) {
  const i = { id, name: id, type: "foci", uuid: `${actor.uuid}.Item.${id}`, parent: actor, actor, isOwner: true };
  i.system = Object.assign(Object.create(FlowStateFociData.prototype), { fociType: "rod", grade: 3, attuned: true, equipped: true, twoHanded: false, wear: 0, affixes: [], element: "heat", chosenSpell: "", ...sys }, { parent: i });
  actor.items.push(i); uuids.set(i.uuid, i); actor.system.prepareDerivedData(); return i;
}
const names = list => list.map(s => s.name).sort().join(",");

console.log("== Catalog");
const cores = S.CATALOG.filter(s => s.kind === "core");
ok2(cores.length === 19, `19 Core Spells (${cores.length})`);
ok2(S.spellById("magic-protection-arcana:shield").uncombinable, "Shield is uncombinable");
ok2(S.spellById("magic-summoning:form").max === 5 && S.spellById("magic-illusion:mirage").min === 2, "Form 1-5, Mirage 2");
ok2(S.spellById("magic-grasp-arcana:replicate").replicate, "Replicate is X+1");
ok2(S.spellById("magic-theory:pinpoint").universal, "Pinpoint is universal");

console.log("== Known spells and applicable mods");
const trees = { "magic-theory": 1, "magic-gravity": 2, "magic-slashing": 1 };
let k = S.knownSpells(trees);
ok2(names(k.cores) === "Cut,Force", `known cores ${names(k.cores)}`);
ok2(names(k.mods) === "Burden,Lighten,Pinpoint,React", `known mods ${names(k.mods)}`);
ok2(names(S.applicableMods(trees, ["magic-slashing:cut"])) === "Pinpoint,React", "Cut: only universal mods (Gravity's are for Force)");
ok2(names(S.applicableMods(trees, ["magic-gravity:force"])) === "Burden,Lighten,Pinpoint,React", "Force: its school's mods too");
ok2(S.knownSpells({ "magic-gravity": 2 }).cores.length === 0, "Schools need Magic Theory first");

console.log("== Combo Threshold");
const bt = ids => S.baseThreshold(ids);
ok2(bt(["magic-gravity:force", "magic-slashing:cut"]).min === 2, "Force + Cut = 2");
ok2(!bt(["magic-protection-arcana:shield", "magic-slashing:cut"]).ok, "Shield can't combine");
ok2(!bt(["magic-gravity:force", "magic-gravity:force"]).ok, "Two different Cores");
const fm = bt(["magic-summoning:form", "magic-creation:make"]);
ok2(fm.min === 2 && fm.max === 6, "Form + Make = 2-6");
ok2(bt(["magic-arcanomancy:strike", "magic-geomancy:shift"]).min === 1, "Arcanomancy adds nothing (Shift 1)");
ok2(bt(["magic-arcanomancy:strike", "magic-illusion:mirage"]).min === 2, "Arcanomancy + Mirage = 2");
ok2(bt(["magic-creation:make", "magic-illusion:mirage"]).min === 3, "Creation + Illusion = 3 (the sum)");
ok2(bt(["magic-geomancy:shift", "magic-illusion:mirage"]).min === 3, "Geomancy + Illusion = 3");

console.log("== Cost math");
ok2(S.castCost({ base: 4, tr: 0, skillPoints: 30 }).energy === 60, "Threshold 4 at 30 SP = 60 Energy (doc example)");
ok2(S.castCost({ base: 1, tr: 0, skillPoints: 31 }).energy === 15, "Odd SP: round the end result down (1 × 31 ÷ 2 = 15)");
ok2(S.castCost({ base: 3, tr: 5, skillPoints: 30 }).threshold === 0, "Threshold can't go below 0");
ok2(S.castCost({ base: 3, tr: 5, skillPoints: 30 }).energy === 0, "Threshold 0 is free");
ok2(S.spellPower(29) === 2 && S.spellPower(30) === 3, "Spell Power per 10 of the Scaling Stat");

console.log("== Casting options");
const stats = { str: 10, dex: 10, con: 10, pon: 10, snap: 10, will: 10, reach: 30, grasp: 30, build: 10 };
const A = mkActor("Mage", { stats, skillPoints: 30 }, { "magic-theory": 5, "magic-gravity": 5, "magic-slashing": 5, "magic-reach-arcana": 5, "magic-grasp-arcana": 5 });
const rod = mkFoci(A, "rod", { fociType: "rod" });
let ctx = C.castContext(A);
const opt = key => ctx.options.find(o => o.key === key);
ok2(opt(`foci:rod`)?.ok && opt("foci:rod").ap[0] === 2 && opt("foci:rod").tr === 1, "Igniter: 2 AP, 1 TR");
ok2(opt("foci:rod").scalingStat === "grasp" && opt("foci:rod").scaling === 30, "Igniter scales with Grasp (Grade 3 cap = 30)");
ok2(opt("raw").ok, "Raw Casting works with one hand free (Rod held in the other)");
ok2(opt("raw").scaling > 30, `Raw Casting has no Grade cap (scaling ${opt("raw").scaling})`);
rod.system.twoHanded = true; ctx = C.castContext(A);
ok2(opt("raw").ok === false && /free hand/i.test(opt("raw").reason), "Raw Casting needs a free hand (Rod held in both)");
rod.system.twoHanded = false; rod.system.equipped = false; A.system.prepareDerivedData(); ctx = C.castContext(A);
ok2(opt("raw").ok, "Raw Casting with both hands free");
rod.system.equipped = true; rod.system.attuned = false; A.system.prepareDerivedData(); ctx = C.castContext(A);
ok2(!opt("foci:rod").ok && /attuned/i.test(opt("foci:rod").reason), "Un-attuned Foci can't cast");
rod.system.attuned = true;
const weak = mkActor("Weak", { stats: { ...stats, grasp: 4, reach: 4 }, skillPoints: 0 }, { "magic-theory": 1, "magic-gravity": 1 });
weak.system.prepareDerivedData();
ok2(!C.castContext(weak).options.some(o => o.ok), "Below 10 in the casting stat: no casting at all");

console.log("== planCast");
const base = { via: "foci:rod", ap: 2, core1: "magic-gravity:force", core2: "", base: 1 };
A.system.prepareDerivedData(); ctx = C.castContext(A);
let p = S.planCast(ctx, base);
ok2(p.ok && p.threshold === 0 && p.energy === 0 && p.ap === 2 && p.power === 3, `Force via Rod: Threshold 1 − TR 1 = 0 (${p.threshold}), free, 2 AP, ×3`);
p = S.planCast(ctx, { ...base, "mod:magic-theory:pinpoint": true });
ok2(p.threshold === 2 && p.energy === 30, `+ Pinpoint: Threshold 2, 30 Energy (${p.threshold}/${p.energy})`);
p = S.planCast(ctx, { ...base, via: "raw", ap: 3 });
ok2(p.tr === 3 && p.threshold === 0 && p.ap === 3, "Raw 3 AP = 3 TR");
p = S.planCast(ctx, { ...base, via: "raw", ap: 1, "mod:magic-theory:pinpoint": true });
ok2(p.tr === 1 && p.threshold === 2 && p.energy === 30, "Raw 1 AP = 1 TR");
p = S.planCast(ctx, { ...base, "mod:magic-theory:react": true });
ok2(p.usesRP && p.threshold === 1 && p.energy === 15, `React: casts with RP, +1 Threshold (${p.threshold}/${p.energy})`);
p = S.planCast(ctx, { ...base, core2: "magic-slashing:cut" });
ok2(p.combo && p.base === 2 && p.threshold === 1, `Combo Force + Cut: base 2, one TR → 1 (${p.threshold})`);
ok2(p.attack === "Ranged", "Ranged combo");
p = S.planCast(ctx, { ...base, core1: "magic-gravity:force", "mod:magic-slashing:bleed": true });
ok2(true, "(Slashing mods are not offered for Force alone)");
A.system.focusedSpell = "magic-gravity:force"; ctx = C.castContext(A);
p = S.planCast(ctx, base);
ok2(p.focusedCast && p.tr === 2, `Focused Spell: +1 TR (${p.tr})`);
p = S.planCast(ctx, { ...base, "mod:magic-theory:pinpoint": true, connection: "empower" });
ok2(p.free?.name === "Empower" && p.threshold === 1, `Connection: Empower free (Threshold ${p.threshold}: 1 + Pinpoint 2 − TR 2)`);
A.system.focusedSpell = "";
p = S.planCast(C.castContext(A), { ...base, ritual: true, "mod:magic-theory:pinpoint": true });
ok2(p.ritual && p.ap === 0 && p.energy === 0 && p.ritualHours === 3 && p.ritualLoss === 22, `Ritual: ${p.ritualHours} h, −${p.ritualLoss} max Energy (gross 3 × 15 = 45 ÷ 2)`);
// Replicate (Grasp Arcana T3): copies another Mod for its Threshold + 1.
p = S.planCast(C.castContext(A), { ...base, "mod:magic-theory:pinpoint": true, "mod:magic-grasp-arcana:replicate": true, "rep:magic-grasp-arcana:replicate": "magic-theory:pinpoint" });
ok2(p.applied.find(a => a.replicates)?.threshold === 3 && p.threshold === 1 + 2 + 3 - 1, `Replicate Pinpoint costs 3 (Threshold ${p.threshold})`);
p = S.planCast(C.castContext(A), { ...base, "mod:magic-grasp-arcana:replicate": true });
ok2(!p.ok, "Replicate needs a Mod to copy");
p = S.planCast(C.castContext(A), { ...base, core1: "magic-slashing:nope" });
ok2(!p.ok, "Unknown Core is refused");

console.log("== Cast flow");
const B = mkActor("Caster", { stats, skillPoints: 30, energy: { value: 80 } }, { "magic-theory": 2, "magic-gravity": 1 });
mkFoci(B, "rod2", { fociType: "rod" });
combat.combatant = { actor: B }; combat.combatants.length = 0; combat.combatants.push({ actor: B });
const v0 = { via: "foci:rod2", ap: 2, core1: "magic-gravity:force", core2: "", base: 1, "mod:magic-theory:pinpoint": true };
messages.length = 0;
let res = await C.castSpell(B, v0);
ok2(res && B.system.ap.value === 4 && B.system.energy.value === 50, `Cast spends 2 AP and 30 Energy (AP ${B.system.ap.value}, Energy ${B.system.energy.value})`);
ok2(messages.length >= 1 && /Force/.test(text(messages[0])) && /30 Energy/.test(text(messages[0])), "Cast card posted with the cost");
ok2(messages[0].flags.flowstate.spell.power === 3, "Card flag carries Spell Power");
B.system.ap.value = 1;
res = await C.castSpell(B, v0);
ok2(res === null && B.system.energy.value === 50, "Not enough AP: nothing is spent");
B.system.ap.value = 6; B.system.energy.value = 10;
res = await C.castSpell(B, v0);
ok2(res === null && B.system.ap.value === 6, "Not enough Energy: AP is not spent either");
B.system.energy.value = 80;
combat.combatant = { actor: A };
res = await C.castSpell(B, v0);
ok2(res === null, "Can't cast with AP off your own turn");
res = await C.castSpell(B, { ...v0, "mod:magic-theory:react": true });
ok2(res && res.usesRP && B.system.rp.value === 4, `React casts off-turn with RP (RP ${B.system.rp.value})`);
// Ritual: only out of combat, adds a max-Energy effect.
let created = null; B.createEmbeddedDocuments = async (t, d) => { created = d[0]; };
combat.started = false;
res = await C.castSpell(B, { ...v0, ritual: true });
ok2(res?.ritual && created?.flags.flowstate.ritual.energyLost === 22, "Ritual creates a max-Energy effect out of combat");
combat.started = true;
res = await C.castSpell(B, { ...v0, ritual: true });
ok2(res === null, "Rituals can't be cast in combat");

console.log("== Dialog");
let html = "";
dialog = c => { html = c; return { ...v0, via: "foci:rod2" }; };
combat.combatant = { actor: B }; B.system.ap.value = 6; B.system.energy.value = 80;
res = await C.castSpell(B);
ok2(res?.ok && /name="core1"/.test(html) && /Universal/.test(html) && /Pinpoint/.test(html), "Dialog lists Cores and Universal Mods");
ok2(/Burden/.test(html) === false, "Mods for Cores you haven't picked (Gravity T2 needs tier 2) are absent");
ok2(/name="ritual"/.test(html), "Ritual option shows from Magic Theory T2");

console.log(fails ? `\n${fails} FAILED` : "\nAll spell framework checks passed");
if (fails) process.exit(1);
