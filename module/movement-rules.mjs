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
 * A step costs the worst terrain it passes through (the user's ruling): walking into difficult terrain partway through a step raises what that step
 * costs (`step`), and walking back out doesn't lower it again. The raise is owed like the rest of the step (`due`).
 * The ledger is { bank, ft, pending, step, due } for one creature's turn: `ft` is the distance left in the current step, `pending` whether some of it is
 * still unpaid, `step` what the step costs so far and `due` how much of that is still owed.
 * (movement.mjs adds `moves`: the moves made since the last action, with the ledger before each, so an undo can give them back.)
 */

export const emptyLedger = () => ({ bank: 0, ft: 0, pending: false, step: 0, due: 0 });

const EPS = 1e-9;
/** A ledger with every field; one written before `due`/`step` existed owes a pending step's whole cost. */
const clean = (L, cost = 1) => {
  const out = { ...emptyLedger(), ...(L ?? {}) };
  if (out.pending && !(out.due > 0)) out.due = cost;
  if (!(out.step > 0) && (out.pending || out.ft > 0)) out.step = Math.max(cost, out.due);
  if (!out.pending) out.due = 0;
  return out;
};

/**
 * The AP cost of a step covering feet `a` to `b` of a move, from the terrain along its path: `samples` are [{ d, cost }] (the cost of standing at
 * distance d, ascending; the first is the start). A step costs the worst it stands in: the sample at or before `a`, and every one up to `b`.
 */
export function stepCostAlong(samples, a, b, fallback = 1) {
  if (!samples?.length) return fallback;
  let worst = -Infinity, before = null;
  for (const s of samples) {
    if (s.d <= a + EPS) before = s;
    else if (s.d <= b + EPS) worst = Math.max(worst, s.cost);
  }
  if (before) worst = Math.max(worst, before.cost);
  return Number.isFinite(worst) ? worst : fallback;
}

/**
 * Move `distance` feet. Returns { ledger, apCost (real AP to pay now), ok (false if the move can't be made with `ap` AP) }.
 * `speedFt` is the distance one step carries you (speed, times the multiplier when Haste makes a step cost less than 1 AP), `cost` the AP a step costs
 * where you stand. `between(a, b)` (optional) is the cost of a step covering feet a..b of this move, from the terrain along the path (stepCostAlong).
 */
export function planMove(ledger, distance, { speedFt, cost, ap = Infinity, between = null }) {
  const start = clean(ledger, cost);
  const L = { ...start };
  let need = Math.max(0, Number(distance) || 0);
  let apCost = 0, pos = 0;
  if (!(speedFt > 0) || !(cost > 0)) return { ledger: L, apCost: 0, ok: true };
  const costOf = (a, b) => (between ? between(a, b) : cost);
  const fail = () => ({ ledger: start, apCost: 0, ok: false });
  const settle = () => { if (L.pending && L.bank >= L.due - EPS) { L.bank -= L.due; L.due = 0; L.pending = false; } };     // the bank covers what is owed
  // What is left of the step you're in: worse terrain on it raises what the step costs.
  const use = Math.min(L.ft, need);
  if (use > EPS) {
    const c = costOf(0, use);
    if (c > L.step + EPS) {
      L.due += c - L.step; L.step = c; L.pending = true; settle();
      if (L.pending && L.due > ap + L.bank + EPS) return fail();                // walking into terrain you couldn't pay for
    }
  }
  L.ft -= use; need -= use; pos += use;
  while (need > EPS) {
    if (L.pending) {                                             // moving past an unpaid step pays for it: the bank first, then real AP
      const net = L.due - Math.min(L.bank, L.due);
      if (net > ap - apCost + EPS) return fail();
      L.bank -= L.due - net; apCost += net; L.due = 0; L.pending = false;
    }
    const span = Math.min(speedFt, need);
    const c = costOf(pos, pos + span);
    if (ap - apCost + L.bank < c - EPS) return fail();           // can't open a step you couldn't pay for
    L.step = c; L.due = c; L.pending = true;
    settle();                                                    // a step the bank covers is settled at once
    L.ft = speedFt - span; need -= span; pos += span;
  }
  return { ledger: L, apCost, ok: true };
}

/**
 * The farthest a creature can move right now with `ap` AP (Infinity when nothing limits it). planMove(ledger, maxMove(...)) is always ok, and
 * anything farther isn't: what is left of the step you're in, then every step you could open (paying for the pending one as you pass it).
 */
export function maxMove(ledger, { speedFt, cost, ap = Infinity, between = null, limit = Infinity }) {
  if (!(speedFt > 0) || !(cost > 0) || !Number.isFinite(ap)) return Infinity;
  // Along a path with terrain: the longest part of it that can be paid for (planMove is monotone in distance).
  if (between) {
    const okAt = d => planMove(ledger, d, { speedFt, cost, ap, between }).ok;
    const top = Number.isFinite(limit) ? limit : 1000;
    if (okAt(top)) return top;
    let lo = 0, hi = top;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (okAt(mid)) lo = mid; else hi = mid; }
    return lo;
  }
  const L = clean(ledger, cost);
  let feet = Math.max(0, L.ft), left = Math.max(0, ap), bank = L.bank, pending = L.pending;
  let due = L.due;
  for (let i = 0; i < 10000; i++) {
    if (pending) {
      const net = due - Math.min(bank, due);
      if (net > left + EPS) break;
      bank -= due - net; left -= net; pending = false;
    }
    due = cost;
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
  const L = clean(ledger, cost);
  const a = Math.max(0, Number(amount) || 0);
  if (!(a > 0)) return { ledger: L, apCost: 0 };
  L.bank += a;
  L.moves = [];                                                  // the moves before it can no longer be undone for their AP (an empty list: a missing key would keep the old one)
  if (L.pending && L.due > 0 && L.bank >= L.due - EPS) { L.bank -= L.due; L.due = 0; L.pending = false; }
  return { ledger: L, apCost: a };
}
