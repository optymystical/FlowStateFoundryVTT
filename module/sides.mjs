/**
 * Which side of the scene a creature is on, by its token's disposition (Friendly 1, Hostile -1, Secret counts as Hostile; Neutral 0 and anyone with no
 * token on the scene go either way). Used so that effects that help or hurt "a willing creature" / "a foe" only come up for the right creatures.
 * Pure: no Foundry globals beyond what the actor itself carries.
 */
export function sideOf(actor) {
  const tok = actor?.getActiveTokens?.()?.[0] ?? null;
  const d = tok?.document?.disposition ?? actor?.token?.disposition;
  if (!Number.isFinite(d) || d === 0) return 0;
  return d > 0 ? 1 : -1;
}

/** Two creatures on opposite sides (one Friendly, one Hostile): nobody helps the other willingly. Neutral or the same creature is never opposed. */
export function opposed(a, b) {
  if (!a || !b || a === b || a.uuid === b.uuid) return false;
  const x = sideOf(a), y = sideOf(b);
  return !!x && !!y && x !== y;
}

/** Two creatures known to be on the same side (both Friendly or both Hostile), or the same creature. Neutral is neither side. */
export function allied(a, b) {
  if (!a || !b) return false;
  if (a === b || a.uuid === b.uuid) return true;
  const x = sideOf(a), y = sideOf(b);
  return !!x && x === y;
}

/** Can `helper` be offered a way to help `beneficiary` (Block, Shield Toss, Quartz, Adjust, Dampen, Infuse...)? Not across the two sides of the scene. */
export const mayHelp = (helper, beneficiary) => !opposed(helper, beneficiary);

/** Can `holder` be offered a way to hurt `victim` (Empower...)? Not an ally of theirs. */
export const mayHarm = (holder, victim) => !allied(holder, victim);
