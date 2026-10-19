/**
 * What kind of actor something is (pure). Characters and NPCs are creatures; a pile of dropped items and a shop are not: they can't be targeted,
 * damaged, moved by Force, given conditions or turns. Anything that asks "is this a creature?" uses `notCreature`, so a new non-creature actor
 * type only needs adding here.
 */
export const NON_CREATURES = new Set(["pile", "shop"]);
export const notCreature = a => !!a && NON_CREATURES.has(a.type);
export const isShop = a => a?.type === "shop";
