/**
 * Movement cost in combat: moving a token on its creature's turn is charged to its AP by the rules in movement-rules.mjs.
 * The AP isn't paid when you move: a step stays pending, and is paid only if you move past it (or settled for free by AP spent on an action: strafing).
 *  - World setting "Movement cost": Enforce (default: a player's move is cut short where their AP runs out; the GM may overspend), Warn (always
 *    allowed, AP just goes to 0) or Off.
 *  - The distance is Foundry's own measure of the path the token takes (every waypoint, around walls), not a straight line.
 *  - Undoing a move (Ctrl+Z) on your turn gives back what it cost, as long as you haven't spent AP on anything since.
 *  - Free and forced moves aren't charged and don't touch the ledger (throws, knockback, Force, pulls, teleports, scripted moves...). A free move
 *    (Dip, Dash) is cut short at your speed.
 *    Terrain counts as it was where the move started.
 */
import { planMove, maxMove, cutPath } from "./movement-rules.mjs";
import { movementMode, movementTracked, moveParams, moveLedger, turnKey } from "./actions.mjs";
import { notCreature } from "./kinds.mjs";

/**
 * Moves planned on this client whose update hasn't landed yet (actor uuid → { key, ledger, owed, n, at, sure }), so a quick second move (the arrow
 * keys) starts from where the first one left the ledger and AP instead of the stale values. A move is `sure` once the other token checks let it
 * through (preUpdateToken); one they turned down is forgotten quickly.
 */
const inFlight = new Map();
const FLIGHT_MS = 5000, UNSURE_MS = 300;
function current(actor) {
  const f = inFlight.get(actor.uuid), age = f ? Date.now() - f.at : 0;
  if (f && f.key === turnKey() && age < (f.sure ? FLIGHT_MS : UNSURE_MS)) return { ledger: f.ledger, ap: Math.max(0, actor.system.ap.value - f.owed), f };
  if (f) inFlight.delete(actor.uuid);
  return { ledger: moveLedger(actor), ap: actor.system.ap.value, f: null };
}
/** Forget the moves on their way (tests). */
export const forgetMoves = () => inFlight.clear();

/**
 * Is this token update forced or free rather than the creature walking? Everything the system moves (throws, knockback, Force, pulls, Palisade, Redirect,
 * dragging a held creature) is marked; so is a teleport, and a move Foundry says came from a script or macro ("api"), the token's configuration, a paste
 * or an undo. Only a player dragging the token or using the keys is a creature moving.
 */
function isForcedMove(options, method) {
  if (options?.flowstateThrow || options?.flowstateDrag || options?.flowstateNoCost || options?.teleport) return true;
  return method !== undefined && method !== "dragging" && method !== "keyboard";
}

/** Keep only what a new move needs of Foundry's waypoints (the in-between grid spaces are filled in again). */
const cleanWaypoints = pts => pts.filter((w, i) => !w.intermediate || i === pts.length - 1)
  .map(({ x, y, elevation, action, snapped, explicit, checkpoint }) => ({ x, y, elevation, action, snapped, explicit, checkpoint }));

/**
 * The part of a move that fits in `maxFt`: the start of the path Foundry passed us, measured the way Foundry measures it. Gridless scenes can stop
 * part of the way between two waypoints.
 */
function cutMove(token, movement, maxFt) {
  const measure = pts => { try { return token.measureMovementPath(pts).distance; } catch (err) { return Infinity; } };
  const gridless = !!token.parent?.grid?.isGridless;
  const between = gridless ? (a, b, t) => ({ ...b, x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t), intermediate: false }) : null;
  return cutPath(movement.passed?.waypoints ?? [], maxFt, measure, { between, origin: movement.origin });
}

/** Stop the move and make the part of it that fits instead (after Foundry has finished turning the first one down). */
function redoShorter(token, movement, cut) {
  const waypoints = cleanWaypoints(cut);
  setTimeout(() => token.move(waypoints, { method: movement.method, autoRotate: movement.autoRotate, showRuler: movement.showRuler,
    constrainOptions: movement.constrainOptions, flowstateCapped: true }).catch(err => console.error("flowstate | movement cost", err)), 0);
  return false;
}

/** preMoveToken: price the path the token is about to take, cut it short if the AP can't pay for all of it, and stash the plan for updateToken. */
function preMove(token, movement, options) {
  try {
    const actor = token.actor;
    if (!actor || notCreature(actor) || isForcedMove(options, movement.method)) return;
    const feet = Number(movement.passed?.distance) || 0;
    if (!(feet > 0)) return;
    const enforce = movementMode() === "enforce" && !game.user.isGM;
    // Dip and Dash: one free move of up to your speed, even off-turn (flowstate.mjs uses the flag up).
    if (actor.getFlag("flowstate", "freeMove")) {
      const speed = Number(actor.system.movement?.speed) || 0;
      if (!enforce || !(speed > 0) || feet <= speed + 1e-6) return;
      if (options.flowstateCapped) return false;
      const cut = cutMove(token, movement, speed);
      ui.notifications.warn(`${token.name}'s free move goes up to ${speed} ft, so it stops there.`);
      return cut.length ? redoShorter(token, movement, cut) : false;
    }
    if (movementMode() === "off" || !movementTracked(actor)) return;
    const params = moveParams(actor), now = current(actor);
    let plan = planMove(now.ledger, feet, { ...params, ap: now.ap });
    if (!plan.ok) {
      const max = maxMove(now.ledger, { ...params, ap: now.ap });
      if (enforce) {
        const cut = !options.flowstateCapped && max > 0 ? cutMove(token, movement, max) : [];
        if (!cut.length) {
          ui.notifications.warn(`${token.name} can't move any farther this turn (${now.ap} AP left${max > 0 ? `: only ${Math.floor(max)} ft more` : ""}).`);
          return false;
        }
        ui.notifications.warn(`${token.name} has the AP for only ${Math.floor(max)} of the ${Math.round(feet)} ft, so the move stops there.`);
        return redoShorter(token, movement, cut);
      }
      const full = planMove(now.ledger, feet, { ...params, ap: Infinity });            // what it would cost with all the AP it needs
      ui.notifications.warn(`${token.name} moves ${Math.round(feet)} ft without the AP for it: ${full.apCost} AP, only ${now.ap} left (it goes to 0).`);
      plan = full;
    }
    // Remember the move so Ctrl+Z can give it back.
    const before = { bank: now.ledger.bank, ft: now.ledger.ft, pending: now.ledger.pending };
    const moves = [...(now.ledger.moves ?? []), { id: movement.id, before, ap: Math.min(plan.apCost, now.ap) }].slice(-30);
    const ledger = { bank: plan.ledger.bank, ft: plan.ledger.ft, pending: plan.ledger.pending, moves };
    options.flowstateMove = { ledger, apCost: plan.apCost, feet, key: turnKey() };
    const f = now.f ?? { owed: 0, n: 0 };
    inFlight.set(actor.uuid, { key: turnKey(), ledger, owed: f.owed + plan.apCost, n: f.n + 1, at: Date.now(), sure: false });
  } catch (err) { console.error("flowstate | movement cost", err); }
}

/**
 * preUpdateToken (after the other token checks): a planned move got through them. An undo (Ctrl+Z) on the creature's turn gives back the moves it
 * takes back, if nothing has been spent since (they are the last on the ledger).
 */
function preUpdate(token, changes, options) {
  try {
    if (options?.flowstateMove && !options.flowstateMove.undo) { const f = token.actor && inFlight.get(token.actor.uuid); if (f) { f.sure = true; f.at = Date.now(); } }
    if (!options?.isUndo || !Array.isArray(changes._movementHistory)) return;
    const actor = token.actor;
    if (!actor || movementMode() === "off" || !movementTracked(actor)) return;
    const kept = new Set(changes._movementHistory.map(w => w.movementId));
    const undone = new Set((token._source?._movementHistory ?? []).map(w => w.movementId).filter(id => id && !kept.has(id)));
    const moves = moveLedger(actor).moves ?? [];
    let i = moves.length;
    while (i > 0 && undone.has(moves[i - 1].id)) i--;
    if (i === moves.length) return;
    const back = moves.slice(i), ap = back.reduce((n, m) => n + (m.ap || 0), 0);
    options.flowstateMove = { ledger: { ...back[0].before, moves: moves.slice(0, i) }, apCost: -ap, feet: 0, undo: true, key: turnKey() };
  } catch (err) { console.error("flowstate | movement cost", err); }
}

/** updateToken on the client that made the move: pay the AP and write the ledger in one update. */
async function afterMove(token, changes, options, userId) {
  const mv = options?.flowstateMove;
  if (!mv || userId !== game.user.id || !token.actor) return;
  const actor = token.actor;
  try {
    if (mv.key !== turnKey()) return;                                                  // the turn changed while the move was on its way
    const ap = actor.system.ap.value, max = actor.system.ap.max ?? ap;
    const value = mv.apCost >= 0 ? Math.max(0, ap - mv.apCost) : Math.min(max, ap - mv.apCost);
    const data = { "flags.flowstate.moveLedger": { ...mv.ledger, key: mv.key } };
    if (value !== ap) data["system.ap.value"] = value;
    await actor.update(data);
    if (mv.undo) { if (mv.apCost < 0) ui.notifications.info(`${token.name}'s move is undone: ${-mv.apCost} AP back.`); }
    else if (mv.apCost > 0) ui.notifications.info(`${token.name} moved ${Math.round(mv.feet)} ft: ${mv.apCost} AP.`);
  } catch (err) { console.error("flowstate | movement cost", err); }
  finally {
    const f = inFlight.get(actor.uuid);
    if (f && !mv.undo) { f.owed = Math.max(0, f.owed - Math.max(0, mv.apCost)); if (--f.n <= 0) inFlight.delete(actor.uuid); }
    else if (mv.undo) inFlight.delete(actor.uuid);
  }
}

export function register() {
  Hooks.on("preMoveToken", preMove);
  Hooks.on("preUpdateToken", preUpdate);
  Hooks.on("updateToken", afterMove);
}
