/**
 * Movement cost in combat: moving a token on its creature's turn is charged to its AP by the rules in movement-rules.mjs.
 * The AP isn't paid when you move: a step stays pending, and is paid only if you move past it (or settled for free by AP spent on an action: strafing).
 *  - World setting "Movement cost": Enforce (default: a move the AP can't pay is refused; the GM may overspend), Warn (always allowed, AP just goes
 *    to 0) or Off.
 *  - Free and forced moves aren't charged and don't touch the ledger (throws, knockback, Force, pulls, teleports, scripted moves, Dip's free move...).
 *    Terrain counts as it was where the move started.
 */
import { planMove } from "./movement-rules.mjs";
import { movementMode, movementTracked, moveParams, moveLedger, setMoveLedger } from "./actions.mjs";

/** Feet a token update would move it: Foundry's own measure of the pending path when it has one, else the straight line on the grid. */
export function movedFeet(token, changes, options = {}) {
  const pending = options?.movement?.[token.id]?.pending?.distance;
  if (Number.isFinite(pending) && pending > 0) return pending;
  const from = { x: token.x, y: token.y }, to = { x: changes.x ?? token.x, y: changes.y ?? token.y };
  const grid = globalThis.canvas?.grid;
  if (!grid) return 0;
  try { const d = grid.measurePath([from, to]).distance; if (Number.isFinite(d)) return d; } catch (err) { /* fall back below */ }
  return (Math.hypot(to.x - from.x, to.y - from.y) / (grid.size || 100)) * (grid.distance || 5);
}

/**
 * Is this token update forced or free rather than the creature walking? Everything the system moves (throws, knockback, Force, pulls, Palisade, Redirect,
 * dragging a held creature) is marked; so is a teleport, and a move Foundry says came from a script or macro ("api"), the token's configuration, a paste
 * or an undo. Only a player dragging the token or using the keys is a creature moving.
 */
export function isForcedMove(options, token) {
  if (options?.flowstateThrow || options?.flowstateDrag || options?.flowstateNoCost || options?.teleport) return true;
  const method = options?.movement?.[token?.id]?.method;
  return method !== undefined && method !== "dragging" && method !== "keyboard";
}

export function register() {
  Hooks.on("preUpdateToken", (token, changes, options) => {
    try {
      if (!("x" in changes || "y" in changes) || isForcedMove(options, token)) return;
      const actor = token.actor;
      if (!actor || actor.type === "pile" || movementMode() === "off" || !movementTracked(actor)) return;
      if (actor.getFlag("flowstate", "freeMove")) return;                       // Dip and the like: a free move (the other hook uses it up)
      const feet = movedFeet(token, changes, options);
      if (!(feet > 0)) return;
      const params = moveParams(actor), have = actor.system.ap.value;
      let plan = planMove(moveLedger(actor), feet, { ...params, ap: have });
      if (!plan.ok) {
        const full = planMove(moveLedger(actor), feet, { ...params, ap: Infinity });          // what it would cost with all the AP it needs
        if (movementMode() === "enforce" && !game.user.isGM) {
          ui.notifications.warn(`${token.name} can't pay for moving ${Math.round(feet)} ft (it needs ${full.apCost} AP now and a step's cost ahead; ${have} AP left).`);
          return false;
        }
        ui.notifications.warn(`${token.name} moves ${Math.round(feet)} ft without the AP for it: ${full.apCost} AP, only ${have} left (it goes to 0).`);
        plan = full;
      }
      options.flowstateMove = { ledger: plan.ledger, apCost: plan.apCost, feet };
    } catch (err) { console.error("flowstate | movement cost", err); }
  });
  Hooks.on("updateToken", async (token, changes, options, userId) => {
    const mv = options?.flowstateMove;
    if (!mv || userId !== game.user.id || !token.actor) return;
    try {
      const actor = token.actor;
      if (mv.apCost > 0) await actor.update({ "system.ap.value": Math.max(0, actor.system.ap.value - mv.apCost) });
      await setMoveLedger(actor, mv.ledger);
      if (mv.apCost > 0) ui.notifications.info(`${token.name} moved ${Math.round(mv.feet)} ft: ${mv.apCost} AP.`);
    } catch (err) { console.error("flowstate | movement cost", err); }
  });
}
