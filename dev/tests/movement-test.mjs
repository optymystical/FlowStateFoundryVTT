// Mental Wonders: Life, Death, Order, Chaos, Beyond and Below (their Modes, Tenets and abilities, through the real attack exchange).
import { installFoundry } from "./support/foundry.mjs";
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 }); let confirmAnswer = true; let waitAnswer = "ap";
const { combat } = installFoundry({ roll: () => (seq.length ? seq.shift() : 10), dialog: c => dialog(c), confirm: () => confirmAnswer, wait: () => waitAnswer, messages, uuids });

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
const handlers = {}; globalThis.Hooks = { on: (n, f) => (handlers[n] ??= []).push(f) };
const Mv = await import("../../module/movement.mjs");
const M = await import("../../module/movement-rules.mjs");
Mv.register();
game.settings = { get: (ns, k) => (k === "movementCost" ? mode : false) }; let mode = "enforce";
game.user.id = "u1"; game.user.isGM = false;
globalThis.canvas = { grid: { size: 100, distance: 5, measurePath: pts => ({ distance: (Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) / 100) * 5 }) } };
const hero = mkActor("Hero", { skillPoints: 30, ap: { value: 6, max: 6 } }, {});
// Like Foundry, writing an object flag merges into the one there (keys left out stay), so the code has to clear what it means to clear.
const mergeInto = (target, src) => { for (const [k, v] of Object.entries(src)) target[k] = v && typeof v === "object" && !Array.isArray(v) && target[k] && typeof target[k] === "object" && !Array.isArray(target[k]) ? mergeInto({ ...target[k] }, v) : v; return target; };
hero.setFlag = async (s, k, v) => { const cur = foundry.utils.getProperty(hero.flags, `${s}.${k}`); foundry.utils.setProperty(hero.flags, `${s}.${k}`, v && typeof v === "object" && cur && typeof cur === "object" ? mergeInto({ ...cur }, v) : v); };
hero.unsetFlag = async (s, k) => foundry.utils.setProperty(hero.flags, `${s}.${k}`, undefined);
hero.getFlag = (s, k) => foundry.utils.getProperty(hero.flags, `${s}.${k}`);
hero.system.ap.max = 6;
combat.combatant = { actor: hero };
hero.system.movement = { speed: 30, ap: 2, multiplier: 1 };                  // 2 AP per 30 ft, like the worked example
const token = { id: "t1", name: "Hero", actor: hero, x: 0, y: 0, parent: { grid: { isGridless: false } }, redone: [] };
token._source = { _movementHistory: [] };
// Foundry measures the path through the waypoints from where the token stands; here one square is 100 px = 5 ft.
token.measureMovementPath = pts => { let d = 0, p = { x: token.x, y: token.y }; for (const q of pts) { d += (Math.hypot(q.x - p.x, q.y - p.y) / 100) * 5; p = q; } return { distance: d }; };
token.move = async (waypoints, options) => { token.redone.push({ waypoints, options }); };
let mid = 0;
/** Foundry's complete path for a straight move of `feet` (one waypoint per square), or the given waypoints. */
const path = (feet, dy = 0) => { const n = Math.round(feet / 5); return Array.from({ length: n }, (_, i) => ({ x: token.x + (i + 1) * 100, y: token.y + dy, intermediate: i < n - 1 })); };
const measureOf = wps => token.measureMovementPath(wps).distance;
/** preMoveToken (the moving client) and the other token checks; `commit` lands the update (updateToken). */
const preMove = (feet, { options: extra = {}, method = "dragging", waypoints = null } = {}) => {
  const options = { ...extra }, wps = waypoints ?? path(feet);
  const movement = { id: `m${++mid}`, method, origin: { x: token.x, y: token.y }, passed: { waypoints: wps, distance: measureOf(wps) } };
  const res = (handlers.preMoveToken ?? []).map(f => f(token, movement, options));
  const refused = res.includes(false), changes = { x: wps.at(-1)?.x ?? token.x, y: wps.at(-1)?.y ?? token.y };
  if (!refused) (handlers.preUpdateToken ?? []).forEach(f => f(token, changes, options));
  return { options, movement, refused, changes };
};
const commit = async r => {
  token.x = r.changes.x; token.y = r.changes.y;
  token._source._movementHistory.push({ movementId: r.movement.id });
  for (const f of handlers.updateToken ?? []) await f(token, r.changes, r.options, "u1");
  return r;
};
const doMove = async (feet, o) => { const r = preMove(feet, o); if (r.refused) return r; return commit(r); };
/** A preMove that never lands (a check: refused, or just looking at the plan). */
const tryMove = (feet, o) => { const r = preMove(feet, o); Mv.forgetMoves(); return r; };
/** Ctrl+Z: Foundry undoes the last recorded move (its movement id). */
const undo = async () => {
  const hist = token._source._movementHistory, last = hist.at(-1);
  const changes = { x: 0, y: 0, _movementHistory: hist.filter(w => w.movementId !== last.movementId) }, options = { isUndo: true, movement: { t1: { method: "undo" } } };
  (handlers.preUpdateToken ?? []).forEach(f => f(token, changes, options));
  token._source._movementHistory = changes._movementHistory;
  for (const f of handlers.updateToken ?? []) await f(token, changes, options, "u1");
  return options;
};

console.log("== A turn of movement and an action");
ok2(actions.moveStatus(hero)?.free === 30 && actions.moveStatus(hero).pay === 0, "At the start of the turn a whole step (30 ft) is free to move");
let r = await doMove(30);
ok2(actions.moveStatus(hero).free === 0 && actions.moveStatus(hero).pay === 2, "After moving it, 0 ft are free and moving on costs the pending step's 2 AP");
ok2(!r.refused && hero.system.ap.value === 6 && actions.moveLedger(hero).pending, "Moving 30 ft spends nothing yet (the 2 AP of movement is pending)");
await actions.spendAP(hero, 3, "Cast Spell");
ok2(hero.system.ap.value === 3 && !actions.moveLedger(hero).pending && actions.moveLedger(hero).bank === 1, "A 3 AP spell settles the pending movement and banks 1 AP");
r = await doMove(40);
ok2(!r.refused && hero.system.ap.value === 2, `Moving 40 ft costs 1 AP (the bank covers the other one): ${hero.system.ap.value} AP left`);
ok2(actions.moveLeft(hero) === 20 && actions.moveLedger(hero).pending, "…and 20 ft of the next 30 ft step are left (its 2 AP still pending)");
ok2(actions.moveStatus(hero).free === 20 && actions.moveStatus(hero).pay === 2, "…shown as 20 ft free, and 2 AP for what comes after");

console.log("== A move longer than the AP can pay is cut short (Enforce)");
hero.system.ap.value = 4; token.redone = [];
r = tryMove(100);
await new Promise(res => setTimeout(res, 5));
ok2(r.refused && token.redone.length === 1, "A player's 100 ft move with AP for less is stopped, and a shorter one is made instead");
{ const wps = token.redone[0]?.waypoints ?? [], last = wps.at(-1);
  ok2(last && ((last.x - token.x) / 100) * 5 === 50 && token.redone[0].options.flowstateCapped && token.redone[0].options.method === "dragging", `…to the last square 4 AP pays for: the 20 ft left of the step (paying its 2 AP), then one more 30 ft step for the other 2 (${last ? ((last.x - token.x) / 100) * 5 : "none"} ft)`);
  ok2(wps.length === 1 && !("intermediate" in wps[0] && wps[0].intermediate), "…along the same path (the in-between squares are left to Foundry)"); }
ok2(hero.system.ap.value === 4, "Nothing is charged for the move that was stopped");
token.redone = [];
r = tryMove(50, { options: { flowstateCapped: true } });
ok2(!r.refused && r.options.flowstateMove?.apCost === 2, "The shorter move goes through and costs the 2 AP");
r = tryMove(60, { options: { flowstateCapped: true } });
await new Promise(res => setTimeout(res, 5));
ok2(r.refused && token.redone.length === 0, "A cut move that still doesn't fit is refused, not cut again");
{ const bent = [{ x: token.x + 100, y: 0, intermediate: true }, { x: token.x + 100, y: 100, intermediate: false }, { x: token.x + 100, y: 200, intermediate: true }, { x: token.x + 100, y: 300, intermediate: true },
    { x: token.x + 200, y: 300, intermediate: true }, { x: token.x + 300, y: 300, intermediate: true }, { x: token.x + 400, y: 300, intermediate: true }, { x: token.x + 500, y: 300, intermediate: false }];
  r = tryMove(0, { waypoints: bent });
  ok2(r.movement.passed.distance === 40 && !r.refused, "The cost is the path's length (around a corner: 40 ft), not the straight line"); }
await new Promise(res => setTimeout(res, 5));
hero.system.ap.value = 0; await actions.setMoveLedger(hero, { bank: 0, ft: 0, pending: true }); token.redone = [];
r = tryMove(10);
ok2(r.refused && token.redone.length === 0, "With no AP and the step used up, the move is refused");
hero.system.ap.value = 2; await actions.setMoveLedger(hero, { bank: 0, ft: 20, pending: true });
game.user.isGM = true;
r = tryMove(40);
ok2(!r.refused && r.options.flowstateMove?.apCost === 2, "The GM may overspend (the AP goes to 0)");
game.user.isGM = false;
mode = "warn"; r = tryMove(40);
ok2(!r.refused, "In Warn mode the move goes through");
mode = "off"; r = tryMove(40);
ok2(!r.refused && !r.options.flowstateMove, "Off charges nothing");
mode = "enforce";
{ const L = { bank: 0, ft: 20, pending: true }, P = { speedFt: 30, cost: 2 };
  ok2(M.maxMove(L, { ...P, ap: 2 }) === 20 && M.maxMove(L, { ...P, ap: 4 }) === 50 && M.maxMove(L, { ...P, ap: 6 }) === 80, "maxMove: the 20 ft left, then a step for each 2 AP left after paying the pending one (2 AP: only the 20 ft)");
  for (const ap of [0, 1, 2, 3, 5, 6]) {
    const m = M.maxMove(L, { ...P, ap });
    ok2(M.planMove(L, m, { ...P, ap }).ok && !M.planMove(L, m + 5, { ...P, ap }).ok, `maxMove agrees with planMove (${ap} AP: ${m} ft fits, ${m + 5} doesn't)`);
  }
  ok2(M.maxMove({ bank: 1, ft: 0, pending: false }, { ...P, ap: 1 }) === 30, "A banked AP and 1 real AP open one more step");
  ok2(M.maxMove(L, { ...P, ap: Infinity }) === Infinity, "No AP limit: no cap");
  const flat = [{ x: 100, y: 0 }, { x: 200, y: 0 }, { x: 300, y: 0 }], meas = pts => pts.length ? pts.at(-1).x / 20 : 0;
  ok2(M.cutPath(flat, 10, meas).length === 2 && M.cutPath(flat, 4, meas).length === 0 && M.cutPath(flat, 99, meas).length === 3, "cutPath keeps the longest start of the path that fits");
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: 0 });
  const g = M.cutPath([{ x: 300, y: 0 }], 7.5, meas, { between: lerp, origin: { x: 0, y: 0 } });
  ok2(g.length === 1 && Math.abs(g[0].x - 150) < 1, "…and on a gridless scene it stops part of the way to the next point"); }

console.log("== Quick moves in a row, undo, and a new turn");
hero.system.ap.value = 6; await actions.setMoveLedger(hero, { bank: 0, ft: 0, pending: false }); token.x = 0; token._source._movementHistory = [];
{ const a = preMove(30), b = preMove(30), c = preMove(30);
  ok2(a.options.flowstateMove.apCost === 0 && b.options.flowstateMove.apCost === 2 && c.options.flowstateMove.apCost === 2, "Three quick moves before the first lands: each starts where the last left off (0, then 2 and 2 AP)");
  const d = preMove(30);
  ok2(d.refused || d.options.flowstateMove?.apCost === 2, "…and a fourth sees only the 2 AP still unspent");
  Mv.forgetMoves();
  await commit(a); await commit(b); await commit(c);
  ok2(hero.system.ap.value === 2 && actions.moveLedger(hero).pending, `When they land the AP is paid once each (6 → ${hero.system.ap.value})`); }
let o = await undo();
ok2(hero.system.ap.value === 4 && o.flowstateMove?.undo, `Undoing the last move gives back its 2 AP (${hero.system.ap.value})`);
ok2(actions.moveLedger(hero).pending && actions.moveLeft(hero) === 0 && actions.moveLedger(hero).moves.length === 2, "…and the ledger is back to how it was before it");
await undo(); await undo();
ok2(hero.system.ap.value === 6 && !actions.moveLedger(hero).pending && actions.moveLeft(hero) === 30, "Undoing all of them puts the whole turn back");
await doMove(30); await doMove(10);
await actions.spendAP(hero, 2, "Attack");
o = await undo();
ok2(!o.flowstateMove && hero.system.ap.value === 2, "After spending AP on an action, undoing a move gives nothing back (the action already covered it)");
await doMove(10);
combat.round = 2;
o = await undo();
ok2(!o.flowstateMove, "A move from an earlier turn gives nothing back");
combat.round = 1;

console.log("== The ledger belongs to the creature's turn");
await actions.setMoveLedger(hero, { bank: 1, ft: 20, pending: true });
const heroCombatant = { id: "cHero", actor: hero }; combat.combatant = heroCombatant; combat.turn = 3;
await actions.setMoveLedger(hero, { bank: 1, ft: 20, pending: true });
combat.turn = 2;                                                                  // a creature before them left the tracker
ok2(actions.moveLedger(hero).bank === 1 && actions.moveLeft(hero) === 20, "Someone earlier in the order leaving the tracker mid-turn doesn't reset the turn");
combat.round = 2;
ok2(actions.moveLedger(hero).bank === 0 && actions.moveLeft(hero) === 30, "Next round: nothing banked or half-walked carries over");
combat.round = 1; combat.turn = 0; combat.combatant = { actor: hero };

console.log("== Strafing and exceptions");
hero.system.ap.value = 6; hero.flags.flowstate = {}; token.x = 0;
await doMove(10);
ok2(hero.system.ap.value === 6 && actions.moveLeft(hero) === 20, "A short move costs nothing and leaves 20 ft of the step");
await actions.spendAP(hero, 2, "Attack");
ok2(hero.system.ap.value === 4 && !actions.moveLedger(hero).pending && actions.moveLeft(hero) === 20, "A 2 AP action settles it (strafing); the 20 ft left stay free");
await doMove(20);
ok2(hero.system.ap.value === 4 && !actions.moveLedger(hero).pending, "…and moving them costs nothing");
hero.system.ap.value = 6; hero.flags.flowstate = {}; token.x = 0;
await actions.spendAP(hero, 1, "standing up");
ok2(actions.moveLedger(hero).bank === 0, "Standing up (a movement itself) does not bank movement");
await actions.spendAP(hero, 2, "Careful Steps");
ok2(actions.moveLedger(hero).bank === 0, "Nor does Careful Steps' 2 AP upkeep");
hero.system.ap.value = 6;
const forcedCases = [{ flowstateThrow: true }, { flowstateDrag: true }, { flowstateNoCost: true }, { teleport: true }];
for (const opts of forcedCases) {
  const ap0 = hero.system.ap.value, ledger0 = JSON.stringify(actions.moveLedger(hero));
  const res = await doMove(400, { options: opts });
  ok2(!res.refused && !res.options.flowstateMove && hero.system.ap.value === ap0 && JSON.stringify(actions.moveLedger(hero)) === ledger0, `Forced or free movement (${Object.keys(opts)[0]}) costs nothing and leaves the ledger alone`);
}
for (const method of ["api", "undo", "config", "paste", "hud"]) {
  const ap0 = hero.system.ap.value, ledger0 = JSON.stringify(actions.moveLedger(hero));
  const res = await doMove(400, { method });
  ok2(!res.refused && !res.options.flowstateMove && hero.system.ap.value === ap0 && JSON.stringify(actions.moveLedger(hero)) === ledger0, `A move by ${method} costs nothing and leaves the ledger alone`);
}
for (const method of ["dragging", "keyboard"]) ok2(!!tryMove(5, { method }).options.flowstateMove, `A creature moving (${method}) is charged`);
await hero.setFlag("flowstate", "freeMove", true); token.redone = [];
r = tryMove(20);
ok2(!r.refused && !r.options.flowstateMove, "A free move (Dip, Dash) within your speed costs nothing");
r = tryMove(60);
await new Promise(res => setTimeout(res, 5));
ok2(r.refused && token.redone.length === 1, "…and one past your speed is cut short at it");
ok2(((token.redone[0]?.waypoints.at(-1)?.x - token.x) / 100) * 5 === 30, "…at 30 ft");
await hero.unsetFlag("flowstate", "freeMove");
combat.combatant = { actor: { uuid: "Actor.Other" } };
r = tryMove(100);
ok2(!r.refused && !r.options.flowstateMove, "Only the creature whose turn it is pays");

console.log("== Removing Ignite / Stain is an action you can strafe with");
mode = "enforce"; combat.started = true; combat.combatant = { actor: hero };
hero.system.ap.value = 6; await actions.setMoveLedger(hero, { bank: 0, ft: 10, pending: true });
await actions.spendAP(hero, 3, "removing Stain");
ok2(!actions.moveLedger(hero).pending && actions.moveLedger(hero).bank === 1, "Removing Stain (3 AP) settles the pending movement like any action, and banks the rest");
await actions.setMoveLedger(hero, { bank: 0, ft: 10, pending: true });
await actions.spendAP(hero, 2, "putting out Ignite");
ok2(!actions.moveLedger(hero).pending && actions.moveLedger(hero).bank === 0, "Putting out Ignite (2 AP) does too");
await actions.setMoveLedger(hero, { bank: 0, ft: 10, pending: true });
await actions.spendAP(hero, 1, "Stand up");
ok2(actions.moveLedger(hero).pending, "…while standing up is movement itself and settles nothing");

console.log("== Dragging a grappled creature costs +1 AP per move");
const victim = mkActor("Victim", { skillPoints: 30 }, {});
ok2(actions.moveParams(hero).cost === 2 && !actions.dragging(hero), "Not grappling anyone: a move costs the usual 2 AP");
await victim.setFlag("flowstate", "grappledBy", hero.uuid);
ok2(actions.dragging(hero) && actions.moveParams(hero).cost === 3, "Holding a grappled creature: moving drags them along for 3 AP");
await victim.setFlag("flowstate", "grappleStatic", "pinned by a spear");
ok2(!actions.dragging(hero) && actions.moveParams(hero).cost === 2, "…unless they're held in place by something else (a thrown weapon, a Hold): no drag, no extra AP");
await victim.unsetFlag("flowstate", "grappleStatic"); await victim.unsetFlag("flowstate", "grappledBy");
ok2(actions.moveParams(hero).cost === 2, "Releasing them brings the cost back down");

console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
