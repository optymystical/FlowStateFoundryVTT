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
