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
// Generic Groups: each Group's Core tree is free at Tier 0 and opens its own trees ("Requires Stealth 2"), not other Groups'.
const stealth = k.treeById("generic-stealth"), infil = k.treeById("generic-infiltration"), sleight = k.treeById("generic-sleight"), tempo = k.treeById("generic-tempo");
assert.equal(k.isAvailable({}, stealth), true); assert.equal(k.coreFor(infil), stealth);
assert.equal(k.isAvailable({ "generic-stealth": 1 }, sleight), true); assert.equal(k.isAvailable({ "generic-stealth": 1 }, infil), false);
assert.equal(k.isAvailable({ "generic-stealth": 2 }, infil), true); assert.equal(k.isAvailable({ "generic-stealth": 5 }, tempo), false);
assert.match(k.nextTier({}, infil, 30).reason, /Stealth Tier 2/);
assert.equal(k.spentPoints({ "generic-stealth": 2, "generic-infiltration": 1 }), 3 + 1);
// The sense trees: Perception 1, 3 or 5 by the base sense (Heightened, Primary, Secondary); defaults Sight/Hearing Primary, Smell Secondary.
const sight = k.treeById("generic-sight"), smell = k.treeById("generic-smell");
assert.equal(k.isAvailable({ "generic-perception": 3 }, sight), true); assert.equal(k.isAvailable({ "generic-perception": 3 }, smell), false);
assert.equal(k.isAvailable({ "generic-perception": 1 }, sight, { senses: { sight: "heightened" } }), true);
assert.equal(k.isAvailable({ "generic-perception": 4 }, sight, { senses: { sight: "secondary" } }), false);
assert.match(k.nextTier({ "generic-perception": 1 }, sight, 30, { senses: { sight: "primary" } }).reason, /Perception Tier 3/);
// Lowering a Core tree only locks its own Group's trees.
assert.equal(k.sameGroup(infil, stealth), true); assert.equal(k.sameGroup(tempo, stealth), false); assert.equal(k.sameGroup(brawl, theory), true); assert.equal(k.sameGroup(brawl, stealth), false);
console.log("skills tests passed");
