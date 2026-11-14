/**
 * Armed Advantage on a creature's next roll of a kind (a Festival Token's use, consumables.mjs): flag `edge`, a list of the kinds armed
 * (consumables-rules.mjs `TOKEN_CHECKS`: perception, athletics, deception, persuasion, stealth, initiative, fear, con, str, attack).
 * The rolls that take it call `takeEdge` (actions.mjs, checks.mjs, generic.mjs); it has no imports, so anything can use it without a cycle.
 */

/** Is Advantage armed for this kind of roll? */
export const hasEdge = (actor, kind) => (actor?.getFlag?.("flowstate", "edge") ?? []).includes(kind);

/** Use the armed Advantage for this roll: 1 (one stack of Advantage) if it was armed, else 0. Only the creature's owner can use it up. */
export async function takeEdge(actor, kind) {
  const list = actor?.getFlag?.("flowstate", "edge") ?? [];
  if (!Array.isArray(list) || !list.includes(kind) || !actor.isOwner) return 0;
  const i = list.indexOf(kind);
  await actor.setFlag("flowstate", "edge", [...list.slice(0, i), ...list.slice(i + 1)]);
  return 1;
}
