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

console.log("== Emplace barrier");
const wall = { t: "ray", x: 500, y: -500, direction: 90, distance: 30, angle: 0, width: 5 };   // a vertical line, x = 500, from y = -500 to 100
const caster = { x: 300, y: 0 };
ok(A.barrierBlocks(wall, caster, { x: 800, y: 0 }, { x: 300, y: 0 }, grid), "An attack from the far side through the barrier is blocked");
ok(!A.barrierBlocks(wall, caster, { x: 200, y: 0 }, { x: 400, y: 0 }, grid), "An attack from the caster's side isn't");
ok(!A.barrierBlocks(wall, caster, { x: 900, y: 0 }, { x: 700, y: 0 }, grid), "Nor is one that never crosses it");
ok(!A.barrierBlocks(wall, caster, { x: 800, y: 400 }, { x: 300, y: 400 }, grid), "Nor one that passes beyond its end (y = 400)");
ok(A.barrierBlocks(wall, caster, { x: 300, y: 0 }, { x: 800, y: 0 }, { size: 100, distance: 5 }) === false, "One-way: it doesn't stop attacks that start on the caster's side, even toward the far side");
const east = A.lineFront(wall, A.FACINGS.e, caster), west = A.lineFront(wall, A.FACINGS.w, caster);
ok(east.x === 1 && Math.abs(east.y) < 1e-9 && west.x === -1, "Facing east/west picks the normal on that side of a vertical line");
const away = A.lineFront(wall, null, caster);
ok(away.x === 1, "'Away from me' faces the side opposite the caster (caster is west of x = 500, so it faces east)");
ok(A.barrierBlocks(wall, caster, { x: 800, y: 0 }, { x: 300, y: 0 }, grid, east) && !A.barrierBlocks(wall, caster, { x: 800, y: 0 }, { x: 300, y: 0 }, grid, west), "The chosen facing decides which side's attacks are blocked");
ok(!A.barrierBlocks(wall, caster, { x: 300, y: 0 }, { x: 800, y: 0 }, grid, east), "…and attacks from the other side go through");
const segs = A.wallSegments(wall, east, grid);
ok(segs.length === 1 && segs[0].c[0] === 500 && Math.round(segs[0].c[3]) === 100, "A line is one wall segment (x = 500, y -500 → 100)");
const dEast = A.wallDir(segs[0].c, east), dWest = A.wallDir(segs[0].c, west);
ok(dEast !== dWest && [1, 2].includes(dEast) && dEast + dWest === 3, "Flipping the facing flips the wall's one-way direction (1 ↔ 2)");
const w = A.wallData(wall, east, grid, { barrierOf: "t1" });
ok(w[0].move === 20 && w[0].sense === 0 && w[0].flags.flowstate.barrierOf === "t1", "The wall blocks movement only (not sight, light or sound) and is tagged to its template");
ok(A.wallSegments({ t: "circle", x: 0, y: 0, distance: 10, direction: 0, angle: 360, width: 0 }, null, grid).length === 16, "A radius is a 16-sided wall");
ok(A.wallSegments({ t: "cone", x: 0, y: 0, distance: 20, direction: 0, angle: 90, width: 0 }, null, grid).length === 8, "A cone is an arc of walls closed by its two edges");
const domeSegs = A.wallSegments({ t: "circle", x: 0, y: 0, distance: 10, direction: 0, angle: 360, width: 0 }, null, grid);
ok(domeSegs.every(sg => { const mx = (sg.c[0] + sg.c[2]) / 2, my = (sg.c[1] + sg.c[3]) / 2; return mx * sg.front.x + my * sg.front.y > 0; }), "Every dome segment faces outward");
const dome = { t: "circle", x: 500, y: 500, direction: 0, distance: 10, angle: 360, width: 0 };
ok(A.barrierBlocks(dome, { x: 500, y: 500 }, { x: 1200, y: 500 }, { x: 500, y: 500 }, grid) && !A.barrierBlocks(dome, { x: 500, y: 500 }, { x: 550, y: 500 }, { x: 500, y: 450 }, grid), "A radius works as a dome: it blocks attacks from outside at those inside");
const dummy = () => ({ name: "T", uuid: "A.T", effects: [], items: [], statuses: new Set(), system: { armor: null, derived: { size: {} } }, getFlag: () => null, getActiveTokens: () => [] });
const bar = (hp, limit) => ({ shroudCtx: { barriers: [{ id: "t1", sceneId: "s", hp, limit }] } });
let oc = await actions.damageOutcome(dummy(), 50, "physical", bar(100, 20));
ok(oc.toHp === 30 && oc.barriers[0].absorbed === 20 && oc.barriers[0].hp === 80, "The barrier is an object: it absorbs up to its Limit (20) of each attack");
oc = await actions.damageOutcome(dummy(), 50, "physical", { pierce: 10, ...bar(100, 20) });
ok(oc.barriers[0].absorbed === 10 && oc.toHp === 40, "Pierce ignores part of its Limit");
oc = await actions.damageOutcome(dummy(), 50, "physical", { halfLimit: true, ...bar(100, 20) });
ok(oc.barriers[0].absorbed === 10, "Weakpoint halves its Limit");
oc = await actions.damageOutcome(dummy(), 50, "physical", { bash: 25, ...bar(100, 20) });
ok(oc.barriers[0].absorbed === 0 && oc.toHp === 50 + 20, "Bash breaks through a barrier with a Limit at or under it (and adds the Limit as damage)");
oc = await actions.damageOutcome(dummy(), 50, "physical", { cleave: 15, ...bar(100, 20) });
ok(oc.barriers[0].hp === 80 && oc.toHp === 45, "Cleave uses up its Limit first (15), then normal damage takes the rest (5): 20 off its health, 45 gets through");
oc = await actions.damageOutcome(dummy(), 50, "physical", bar(8, 20));
ok(oc.barriers[0].absorbed === 8 && oc.barriers[0].hp === 0 && oc.toHp === 42, "It can't absorb more than its remaining health, and breaks");
oc = await actions.damageOutcome(dummy(), 50, "arcane", bar(100, 20));
ok(oc.barriers[0].absorbed === 20, "A magical object blocks Arcane damage too");

console.log("== Thrown through an Emplace barrier (Force Damage)");
const flightWall = { t: "ray", x: 500, y: -500, direction: 90, distance: 30, angle: 0, width: 5 };
const bwest = { x: -1, y: 0 };
const mkBar = hp => ({ id: "b1", tpl: flightWall, caster: { x: 0, y: 0 }, front: bwest, hp });
const fly = (o = {}) => A.planFlight({ start: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, feet: 40, barriers: [mkBar(30)], grid, creatureHp: 432, ...o });
let pf = fly();
ok(pf.events.length === 1 && pf.events[0].kind === "barrier" && Math.abs(pf.events[0].untraveled - 17.5) < 1e-6, "It hits the barrier 22.5 ft in, with 17.5 ft untraveled");
ok(pf.events[0].creature === 30 && pf.events[0].barrier === 30 && pf.events[0].broke, "A weak barrier (30 health): each takes 30 (all it has) and it breaks");
ok(pf.end.x > 500 && Math.abs(pf.traveled - 30) < 1e-6, `…and the creature keeps going with the leftover (17.5 − 30 ÷ 3 = 7.5 ft): it travels ${pf.traveled} ft in all`);
{ const R = await import("../../module/rules.mjs"); ok(R.forceDamage(17.5) === 51 && R.forceDamage(0.9) === 0 && R.forceDamage(-3) === 0 && R.forceDamage(10) === 30, "Force damage rounds down: 3 × whole untraveled feet (17.5 ft → 51)"); }
pf = fly({ barriers: [mkBar(200)] });
ok(pf.events[0].creature === 51 && pf.events[0].barrier === 51 && !pf.events[0].broke && pf.events[0].left === 149 && pf.end.x < 450, "A strong barrier (200 health) holds: 3 × 17 whole feet (17.5 rounds down) = 51 Force each, and the creature stops in front of it");
pf = fly({ creatureHp: 20 });
ok(pf.events[0].creature === 20 && pf.events[0].barrier === 20 && !pf.events[0].broke, "Each side only takes what the other has left to give (a creature with 20 HP deals 20)");
pf = fly({ start: { x: 800, y: 0 }, dir: { x: -1, y: 0 } });
ok(pf.events.length === 0 && Math.abs(pf.traveled - 40) < 1e-6, "From the protected side the barrier lets it through");
pf = fly({ wallAt: () => ({ x: 200, y: 0 }) });
ok(pf.events[0].kind === "wall" && pf.events[0].creature === 90 && pf.events[0].untraveled === 30, "A real wall before the barrier stops it first (30 ft untraveled × 3)");
pf = fly({ wallAt: () => ({ x: 450, y: 0 }) });
ok(pf.events[0].kind === "barrier", "The barrier's own Wall doesn't count twice: the barrier collision wins a tie");
pf = A.planFlight({ start: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, feet: 80, barriers: [mkBar(30), { ...mkBar(20), id: "b2", tpl: { ...flightWall, x: 700 } }], grid, creatureHp: 432 });
ok(pf.events.filter(e => e.kind === "barrier").length === 2 && pf.events.every(e => e.kind !== "barrier" || e.broke), "A creature with enough Force can break through two barriers in a row");

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
