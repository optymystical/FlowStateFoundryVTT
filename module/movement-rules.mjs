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
 * (movement.mjs adds `moves`: the moves made since the last action, with the ledger before each, so an undo can give them back.)
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
 * The farthest a creature can move right now with `ap` AP (Infinity when nothing limits it). planMove(ledger, maxMove(...)) is always ok, and
 * anything farther isn't: what is left of the step you're in, then every step you could open (paying for the pending one as you pass it).
 */
export function maxMove(ledger, { speedFt, cost, ap = Infinity }) {
  if (!(speedFt > 0) || !(cost > 0) || !Number.isFinite(ap)) return Infinity;
  const L = clean(ledger);
  let feet = Math.max(0, L.ft), left = Math.max(0, ap), bank = L.bank, pending = L.pending;
  for (let i = 0; i < 10000; i++) {
    if (pending) {
      const net = cost - Math.min(bank, cost);
      if (net > left + EPS) break;
      bank -= cost - net; left -= net; pending = false;
    }
    if (left + bank < cost - EPS) break;
    if (bank >= cost - EPS) bank -= cost; else pending = true;
    feet += speedFt;
  }
  return feet;
}

/**
 * Cut a path of movement short at `maxFt`. `waypoints` are the points after the start (Foundry's complete path: on a grid, one per space),
 * `measure(points)` the distance of moving through the first points of it. Returns the longest start of the path that is no longer than `maxFt`
 * ([] when not even the first point fits). With `between` (gridless scenes), it also goes part of the way to the next point: `between(a, b, t)` is
 * the point a fraction t of the way, with `origin` the start.
 */
export function cutPath(waypoints, maxFt, measure, { between = null, origin = null } = {}) {
  const pts = waypoints ?? [];
  const fits = k => k === 0 || measure(pts.slice(0, k)) <= maxFt + EPS;
  let lo = 0, hi = pts.length;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (fits(mid)) lo = mid; else hi = mid - 1; }
  const cut = pts.slice(0, lo);
  if (between && lo < pts.length) {
    const a = lo ? pts[lo - 1] : origin, b = pts[lo];
    if (a && b) {
      let t0 = 0, t1 = 1;
      for (let i = 0; i < 30; i++) { const t = (t0 + t1) / 2; if (measure([...cut, between(a, b, t)]) <= maxFt + EPS) t0 = t; else t1 = t; }
      if (t0 > 0) cut.push(between(a, b, t0));
    }
  }
  return cut;
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
  L.moves = [];                                                  // the moves before it can no longer be undone for their AP (an empty list: a missing key would keep the old one)
  if (L.pending && cost > 0 && L.bank >= cost - EPS) { L.bank -= cost; L.pending = false; }
  return { ledger: L, apCost: a };
}
