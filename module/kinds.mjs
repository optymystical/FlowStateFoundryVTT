/**
 * What kind of actor something is (pure). Characters and NPCs are creatures; a pile of dropped items and a shop are not: they can't be targeted,
 * damaged, moved by Force, given conditions or turns. Anything that asks "is this a creature?" uses `notCreature`, so a new non-creature actor
 * type only needs adding here.
 */
export const NON_CREATURES = new Set(["pile", "shop"]);
export const notCreature = a => !!a && NON_CREATURES.has(a.type);
/**
 * A living target: a creature that isn't fully Magical and isn't a Summon or an Animation (Tier 4 Magic creations: a Summon is fully Magical; an
 * Animation is a physical pile bound by a Spell, so it isn't Magical, but it isn't alive either). Restore, "living target" bonuses and Mental's
 * living-target checks use this.
 */
export const isLiving = a => !!a && !notCreature(a) && !a.system?.magical && !a.flags?.flowstate?.summon;

/** The attuned Foci fused into this weapon (Fused Foci, Equipment doc), or null. */
export function fusedFociOf(weapon) {
  if (!weapon?.id || weapon.type !== "weapon") return null;
  return weapon.actor?.items?.find?.(i => i.type === "foci" && i.system.attuned && i.system.fusedInto === weapon.id) ?? null;
}
/**
 * Living Metal Arm (Sworan T0), the user's ruling: shaped as an open hand (Unarmed, no arm item) it's a hand like any other. Shaped as a Weapon, a Foci or an
 * Icon Form it takes that hand: a Sworan then holds at most one thing besides the arm, one-handed, and only the arm's own Weapon may be two-handed (using the
 * other hand too). Returns why a hold is refused, or "".
 */
export function sworanHoldRefusal(actor, item, next) {
  if (actor.system?.abc?.ancestry !== "sworan" || !next.equipped || next.weaponType === "unarmed") return "";
  const armOf = i => !!i?.flags?.flowstate?.livingArm;
  const isArm = armOf(item), arm = actor.items.find(i => armOf(i) && i.id !== item.id);
  if (!isArm && !arm) return "";                                   // an open hand: nothing to refuse
  const others = actor.items.filter(i => ["weapon", "foci"].includes(i.type) && i.id !== item.id && !armOf(i) && i.system.weaponType !== "unarmed" && i.system.equipped);
  if (isArm) return next.twoHanded && others.length ? `${actor.name} needs their other hand free to two-hand the Living Metal Arm.` : "";
  if (next.twoHanded) return `${actor.name}'s Living Metal Arm is shaped as ${String(arm.name ?? "a Weapon").replace(/^Living Metal Arm \(|\)$/g, "")}: only the arm can be two-handed (reshape it into an open hand to free it).`;
  if (others.length) return `${actor.name} has one hand besides the Living Metal Arm, and it's holding ${others[0].name}.`;
  if (arm?.system.equipped && arm.system.twoHanded) return `${actor.name}'s Living Metal Arm is two-handed: no hand is free.`;
  return "";
}
