// Equipment Size (Equipment doc) and Carrying / Encumbrance (Athletics Tier 0).
import assert from "node:assert/strict";
const R = await import("../../module/rules.mjs");
// An item with no Size of its own is one below its user (gear two below); Size 2 is neutral.
assert.equal(R.equipSize(null, 3), 2); assert.equal(R.equipSize(null, 4), 3); assert.equal(R.equipSize(null, 3, 2), 1); assert.equal(R.equipSize(4, 3), 4);
assert.equal(R.equipStacks(2), 0); assert.equal(R.equipStacks(4), 2); assert.equal(R.equipStacks(1), -1);
// Strengthened ×1.5 a stack, Weakened ×0.5: a Size 3 weapon's 40 Durability becomes 60, a Size 1 one's 20.
assert.equal(R.applyStacks(40, R.equipStacks(3)), 60); assert.equal(R.applyStacks(40, R.equipStacks(1)), 20);
// Load: two or more Sizes smaller 0, one smaller 1, your Size 6, bigger can't be lifted.
assert.equal(R.loadFor(1, 3), 0); assert.equal(R.loadFor(2, 3), 1); assert.equal(R.loadFor(3, 3), 6); assert.equal(R.loadFor(4, 3), null);
// Encumbrance: over 6 Encumbered (+1 AP), over 12 can't move; Strong Back 8 / 16; Pack Mule Overburdened (+2 AP) up to 18.
assert.equal(R.encumbrance(6).state, "free"); assert.equal(R.encumbrance(7).state, "encumbered"); assert.equal(R.encumbrance(7).moveAP, 1);
assert.equal(R.encumbrance(13).state, "immobile"); assert.equal(R.encumbrance(8, { strongBack: true }).state, "free");
assert.equal(R.encumbrance(13, { packMule: true }).state, "overburdened"); assert.equal(R.encumbrance(13, { packMule: true }).moveAP, 2);
assert.equal(R.encumbrance(19, { packMule: true }).state, "immobile"); assert.equal(R.encumbrance(20, { packMule: true, strongBack: true }).state, "overburdened");
// Shove (Strength T1): a Push is 10 × Strength instead of 5 ×.
assert.equal(R.pushForce(40), 200); assert.equal(R.pushForce(40, true), 400);
console.log("size and load tests passed");
