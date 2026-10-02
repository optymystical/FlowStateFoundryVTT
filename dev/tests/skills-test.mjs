import assert from "node:assert/strict";
import * as k from "../../module/skills.mjs";
const brawl = k.treeById("martial-brawling-methods"), str = k.treeById("martial-strength-methods"), theory = k.theoryFor("martial");
// Default: only Theory is available
assert.equal(k.isAvailable({}, theory), true); assert.equal(k.isAvailable({}, brawl), false);
assert.equal(k.treesFor("martial").filter(t => k.isAvailable({}, t)).length, 1);
// Costs: tier N = N, 0→5 = 15 (Rules doc example)
assert.equal(k.spentPoints({ "martial-brawling-methods": 5 }), 15);
assert.equal(k.spentPoints({ "martial-theory": 2, "martial-brawling-methods": 3 }), 3 + 6);
// Buying Theory T1 unlocks the T1 group, not T2
let s = { "martial-theory": 1 };
assert.equal(k.isAvailable(s, brawl), true); assert.equal(k.isAvailable(s, str), false);
assert.deepEqual(k.treesFor("martial").filter(t => k.isAvailable(s, t)).map(t => t.name), ["Martial Theory", "Brawling Methods", "Bladed Weapons", "Balanced Weapons", "Swift Weapons", "Rapid Weapons", "Medium Armor"]);
// Next-tier checks
assert.equal(k.nextTier({}, theory, 30).cost, 1);
assert.equal(k.nextTier({}, brawl, 30).ok, false);
assert.match(k.nextTier({}, brawl, 30).reason, /Martial Theory Tier 1/);
assert.equal(k.nextTier({ "martial-theory": 1, "martial-brawling-methods": 2 }, brawl, 2).ok, false); // tier 3 costs 3
assert.equal(k.nextTier({ "martial-theory": 1, "martial-brawling-methods": 2 }, brawl, 3).ok, true);
assert.equal(k.nextTier({ "martial-theory": 1 }, brawl, 30, { inCombat: true }).ok, false);
assert.equal(k.nextTier({ "martial-theory": 5 }, theory, 30).reason, "Fully unlocked.");
// 30 starting SP: two trees to 5 (Rules doc) = 30
assert.equal(k.spentPoints({ "martial-theory": 5, "martial-brawling-methods": 5 }), 30);
console.log("skills tests passed");
