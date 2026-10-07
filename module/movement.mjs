/**
 * Movement cost in combat: moving a token on its creature's turn is charged to its AP by the rules in movement-rules.mjs.
 * Only distance nothing has covered costs anything: AP spent on actions covers movement (strafing), and a step a move opens stays open for abilities.
 *  - World setting "Movement cost": Enforce (default: a move the AP can't pay is refused; the GM may overspend), Warn (always allowed, AP just goes
 *    to 0) or Off.
 *  - Free and forced moves aren't charged (throws, knockback, Dip's free move...). Terrain counts as it was where the move started.
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

export function register() {
  Hooks.on("preUpdateToken", (token, changes, options) => {
    try {
      if (!("x" in changes || "y" in changes) || options?.flowstateThrow || options?.flowstateDrag || options?.flowstateNoCost) return;
      const actor = token.actor;
      if (!actor || actor.type === "pile" || movementMode() === "off" || !movementTracked(actor)) return;
      if (actor.getFlag("flowstate", "freeMove")) return;                       // Dip and the like: a free move (the other hook uses it up)
      const feet = movedFeet(token, changes, options);
      if (!(feet > 0)) return;
      const plan = planMove(moveLedger(actor), feet, { ...moveParams(actor), ap: actor.system.ap.value });
      if (!plan.ok) {
        if (movementMode() === "enforce" && !game.user.isGM) {
          ui.notifications.warn(`${token.name} needs ${plan.apCost} AP to move ${Math.round(feet)} ft but has ${actor.system.ap.value}.`);
          return false;
        }
        ui.notifications.warn(`${token.name} moves ${Math.round(feet)} ft for ${plan.apCost} AP with only ${actor.system.ap.value} left: it goes to 0.`);
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
