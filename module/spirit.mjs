/**
 * Shadow Spirit (Dusken Shadow T3): a creature's separated spirit is a token flagged `spiritOf` (its body's actor uuid). No imports, so casting,
 * movement and the ancestry module can all ask for it.
 */
export function spiritToken(actor) {
  if (!actor?.uuid) return null;
  return (globalThis.canvas?.tokens?.placeables ?? []).find(t => t.document?.flags?.flowstate?.spiritOf === actor.uuid) ?? null;
}
/** The body (actor) a spirit token belongs to, or null. */
export const spiritOwner = token => {
  const u = (token?.document ?? token)?.flags?.flowstate?.spiritOf;
  return u ? globalThis.fromUuidSync?.(u) ?? null : null;
};
