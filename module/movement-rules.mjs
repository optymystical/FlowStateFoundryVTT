/**
 * Movement cost in combat (pure, no Foundry globals).
 *
 * A move costs `cost` AP (1, plus terrain and slows) and carries you `speedFt` feet. Nothing is charged for distance you already have covered:
 *   - Strafing: AP spent on another action also pays for moving "with" it, so an action paid for with `C` AP covers `C` AP of movement.
 *     That is `freeFt` feet of free movement, and whatever is left over after whole steps is banked (`bank`, in AP) toward the next step.
 *   - Moving past what is covered opens a new step: it costs `cost` AP, paid from the bank first and then from real AP. The step's AP stays open
 *     (`openAp`) while any of its distance is left: an action that fits in it is paid out of it (the AP does double duty) and covers no further
 *     movement of its own.
 * The ledger is { bank, freeFt, ft, openAp } for one creature's turn. `availableAp` is what a sheet shows as AP left (the real AP plus the open AP).
 */

export const emptyLedger = () => ({ bank: 0, freeFt: 0, ft: 0, openAp: 0 });

const clean = L => ({ ...emptyLedger(), ...(L ?? {}) });
const EPS = 1e-9;

/** The open step's AP, once its distance is used up it is gone. */
function settle(L, speedFt, cost) {
  if (L.ft <= EPS) { L.ft = 0; L.openAp = 0; }
  else L.openAp = Math.min(L.openAp, Math.ceil(L.ft / speedFt - EPS) * cost);
  return L;
}

/** The AP a sheet shows as left: the real pool plus what the movement still has open for abilities. */
export const availableAp = (ap, L) => ap + (L?.openAp ?? 0);

/**
 * Move `distance` feet. Returns { ledger, apCost (real AP to pay), ok (whether `ap` covers it) }.
 * `speedFt` is the distance one step carries you (speed, times the multiplier when Haste makes a step cost less than 1 AP), `cost` the AP a step costs.
 */
export function planMove(ledger, distance, { speedFt, cost, ap = Infinity }) {
  const L = clean(ledger);
  let need = Math.max(0, Number(distance) || 0);
  let apCost = 0;
  if (!(speedFt > 0) || !(cost > 0)) return { ledger: L, apCost: 0, ok: true };
  const free = Math.min(L.freeFt, need);                       // movement an action already paid for
  L.freeFt -= free; need -= free;
  const open = Math.min(L.ft, need);                           // the rest of a step already open
  L.ft -= open; need -= open;
  settle(L, speedFt, cost);
  while (need > EPS) {                                         // each further step costs its AP: the bank first, then real AP
    const fromBank = Math.min(L.bank, cost);
    L.bank -= fromBank;
    apCost += cost - fromBank;
    L.ft = speedFt; L.openAp = cost;
    const used = Math.min(L.ft, need);
    L.ft -= used; need -= used;
    settle(L, speedFt, cost);
  }
  return { ledger: L, apCost, ok: apCost <= ap + EPS };
}

/**
 * Spend `amount` AP on an action. If it fits in the open step's AP it is paid out of that (strafing). Otherwise it costs real AP, and because it
 * can be moved with, it covers that much movement: whole steps become free distance, the remainder is banked.
 * Returns { ledger, apCost (real AP), fromOpen (paid out of the open step) }.
 */
export function planAction(ledger, amount, { speedFt, cost }) {
  const L = clean(ledger);
  const a = Math.max(0, Number(amount) || 0);
  if (!(a > 0)) return { ledger: L, apCost: 0, fromOpen: false };
  if (a <= L.openAp + EPS) { L.openAp -= a; return { ledger: L, apCost: 0, fromOpen: true }; }
  if (speedFt > 0 && cost > 0) {
    const total = L.bank + a;
    const steps = Math.floor(total / cost + EPS);
    L.bank = Math.max(0, total - steps * cost);
    L.freeFt += steps * speedFt;
  }
  return { ledger: L, apCost: a, fromOpen: false };
}
