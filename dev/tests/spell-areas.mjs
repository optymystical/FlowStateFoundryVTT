// Area shapes (geometry, placement fallback) and Adjust's 10 ft Shield extension.
class Field { constructor(o={}){ Object.assign(this,o); } }
const uuids = new Map();
globalThis.foundry = { data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field, ObjectField: Field } },
  abstract: { TypeDataModel: class {} }, utils: { escapeHTML: s => s, deepClone: o => structuredClone(o), getProperty: (o,k)=>k.split(".").reduce((a,b)=>a?.[b],o) },
  applications: { api: { DialogV2: { prompt: async () => null } } } };
globalThis.Roll = class { constructor(f){ this.formula=f; } async evaluate(){ this.total = 10; return this; } async render(){ return ""; } };
globalThis.ChatMessage = { getSpeaker: () => ({}), create: async d => d };
globalThis.game = { settings: { get: () => false }, messages: [], combat: null, users: { activeGM: {} }, socket: { emit() {} }, user: { targets: new Set() }, actors: [] };
globalThis.ui = { notifications: { warn() {}, info() {}, error() {} } };
globalThis.fromUuid = async u => uuids.get(u); globalThis.fromUuidSync = u => uuids.get(u);
let fails = 0; const ok = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };

const A = await import("../../module/areas.mjs");
const actions = await import("../../module/actions.mjs");
const grid = { size: 100, distance: 5 };
const T = (shape, o) => A.areaTemplate(shape, { x: 0, y: 0, ...o });

console.log("== Area geometry");
ok(A.areaTemplate("radius", { scale: 2 }).distance === 20, "Snipe doubles a radius to 20 ft");
ok(A.areaTemplate("line", { scale: 1.5 }).distance === 45 && A.areaTemplate("line", { scale: 1.5 }).width === 7.5, "Agate's +50% scales a line's length and width");
ok(A.pointInArea(T("radius"), 150, 0, grid) && !A.pointInArea(T("radius"), 250, 0, grid), "10 ft radius = 2 squares");
ok(A.pointInArea(T("cone", { direction: 0 }), 300, 100, grid) && !A.pointInArea(T("cone", { direction: 0 }), 300, 400, grid), "20 ft 90° cone east: a point 45° off axis is in, 70° off isn't");
ok(!A.pointInArea(T("cone", { direction: 0 }), 500, 0, grid) && A.pointInArea(T("cone", { direction: 0 }), 400, 0, grid), "…and it reaches 20 ft (4 squares)");
ok(A.pointInArea(T("cone", { direction: 180 }), -300, 0, grid) && !A.pointInArea(T("cone", { direction: 180 }), 300, 0, grid), "A cone pointing west");
ok(A.pointInArea(T("line", { direction: 90 }), 0, 500, grid) && !A.pointInArea(T("line", { direction: 90 }), 0, 700, grid), "30 ft line south = 6 squares");
ok(!A.pointInArea(T("line", { direction: 90 }), 100, 300, grid) && A.pointInArea(T("line", { direction: 90 }), 20, 300, grid), "…5 ft wide");
const tok = (x, y) => ({ document: { x, y, width: 1, height: 1 } });
const hit = A.tokensInArea(T("radius"), [tok(0, 0), tok(150, 0), tok(900, 900)], grid);
ok(hit.length === 2, "tokensInArea: tokens touching the circle count, far ones don't");

console.log("== Adjust: a Shield holder within 10 ft can extend it");
const mk = (name, x, y, shield) => {
  const a = { name, uuid: "Actor." + name, type: "character", statuses: new Set(), effects: [], system: {}, isOwner: true };
  if (shield) a.effects.push({ disabled: false, flags: { flowstate: { spellEffect: { kind: "shield", adjust: true, hp: 40 } } }, parent: a });
  const t = { actor: a, document: { x, y, width: 1, height: 1 }, center: { x: x + 50, y: y + 50 } };
  a.getActiveTokens = () => [t]; uuids.set(a.uuid, a);
  return { a, t };
};
const atk = mk("Attacker", 0, 0, false), tgt = mk("Target", 1000, 0, false), near = mk("Guard", 1200, 0, true), far = mk("Far", 3000, 0, true), plain = mk("Plain", 1100, 100, false);
globalThis.canvas = { grid: { size: 100, distance: 5 }, tokens: { placeables: [atk.t, tgt.t, near.t, far.t, plain.t] } };
const guards = actions.adjustGuards(atk.a, tgt.a);
ok(guards.length === 1 && guards[0].name === "Guard", "Only the Adjust Shield holder within 10 ft (1 square gap) is offered");
const helpers = actions.allyHelpers(atk.a, tgt.a, { damage: "1d6", type: "physical" });
ok(helpers.some(h => h.kind === "adjust" && /Guard/.test(h.label)), "It shows up in the Ally help list on the attack card");
ok(!actions.allyHelpers(atk.a, tgt.a, { damage: "", type: "physical" }).some(h => h.kind === "adjust"), "…but not for attacks that do nothing");
console.log(fails ? `\n${fails} FAILED` : "\nAll area checks passed");
process.exit(fails ? 1 : 0);
