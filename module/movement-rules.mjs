/**
 * Movement cost in combat (pure, no Foundry globals).
 *
 * A move is made in steps: a step carries you `speedFt` feet and costs `cost` AP (1, plus terrain and slows). The cost is not paid when you move.
 * A step you open stays *pending* (its AP is simply still there to use) and is only paid when one of two things happens:
 *   - you move on past it, so a new step has to open: the pending step is paid now, from the bank first and then from real AP;
 *   - you spend AP on an action: strafing means that AP also pays for the movement, so it settles the pending step for free. Whatever of it is left over
 *     is banked (`bank`, in AP) toward the next step; a step that the bank covers in full is settled the moment it opens.
 * A step still pending when the turn ends costs nothing (the AP it would have used lapses with the rest). To open a step at all you need its cost
 * available (real AP plus bank), so nobody walks on AP they don't have.
 * The ledger is { bank, ft, pending } for one creature's turn: `ft` is the distance left in the current step, `pending` whether that step is still unpaid.
 */

export const emptyLedger = () => ({ bank: 0, ft: 0, pending: false });

const clean = L => ({ ...emptyLedger(), ...(L ?? {}) });
const EPS = 1e-9;

/**
 * Move `distance` feet. Returns { ledger, apCost (real AP to pay now), ok (false if the move can't be made with `ap` AP) }.
 * `speedFt` is the distance one step carries you (speed, times the multiplier when Haste makes a step cost less than 1 AP), `cost` the AP a step costs.
 */
export function planMove(ledger, distance, { speedFt, cost, ap = Infinity }) {
  const start = clean(ledger);
  const L = { ...start };
  let need = Math.max(0, Number(distance) || 0);
  let apCost = 0;
  if (!(speedFt > 0) || !(cost > 0)) return { ledger: L, apCost: 0, ok: true };
  const use = Math.min(L.ft, need);                              // what is left of the step you're in
  L.ft -= use; need -= use;
  while (need > EPS) {
    if (L.pending) {                                             // moving past an unpaid step pays for it: the bank first, then real AP
      const net = cost - Math.min(L.bank, cost);
      if (net > ap - apCost + EPS) return { ledger: start, apCost: 0, ok: false };
      L.bank -= cost - net; apCost += net; L.pending = false;
    }
    if (ap - apCost + L.bank < cost - EPS) return { ledger: start, apCost: 0, ok: false };   // can't open a step you couldn't pay for
    if (L.bank >= cost - EPS) { L.bank -= cost; L.pending = false; } else L.pending = true; // a step the bank covers is settled at once
    L.ft = speedFt;
    const used = Math.min(L.ft, need);
    L.ft -= used; need -= used;
  }
  return { ledger: L, apCost, ok: true };
}

/**
 * Spend `amount` AP on an action (real AP). Because it can be moved with, it covers movement: it goes to the bank, and a step that was pending is
 * settled out of it (the rest of that step's distance stays free). Returns { ledger, apCost }.
 */
export function planAction(ledger, amount, { cost }) {
  const L = clean(ledger);
  const a = Math.max(0, Number(amount) || 0);
  if (!(a > 0)) return { ledger: L, apCost: 0 };
  L.bank += a;
  if (L.pending && cost > 0 && L.bank >= cost - EPS) { L.bank -= cost; L.pending = false; }
  return { ledger: L, apCost: a };
}
