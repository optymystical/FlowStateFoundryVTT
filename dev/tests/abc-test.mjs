// Ancestry, Background and Culture (Flow State - ABCs): the generated tables, every Background's 15 free points for every Ancestry and choice,
// the Ancestry differences, ancestry trees' availability, free tiers in the Skill Point count, and moving through hostile creatures.
import assert from "node:assert/strict";
const R = await import("../../module/abc-rules.mjs");
const S = await import("../../module/skills.mjs");
const P = await import("../../module/passage.mjs");
let fails = 0; const ok = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };

console.log("== The tables");
ok(R.playerAncestries().length === 17 && ["halfling", "goblin", "wildibit", "noctua", "smoblin"].every(a => R.ANCESTRIES[a].size === 2) && R.ANCESTRIES.orc.size === 3, "Seventeen Ancestries; the Smallfolk are Size 2");
ok(R.ANCESTRIES.wildibit.trees.join() === "ancestry-leporid,ancestry-wildibit-tree,ancestry-smallfolk" && R.ANCESTRIES.minotaur.core === "ancestry-lakeborn" && R.ANCESTRIES.noctua.core === "ancestry-strigid", "New cores: Leporid (Wildibit), Lakeborn (Minotaur), Strigid (Noctua)");
ok(R.ANCESTRIES.sworan.trees.join() === "ancestry-wusonian,ancestry-sworan-tree", "A Sworan has no lineage tree");
ok(R.ANCESTRIES.wasteling.variant === "wasteling" && !R.playerAncestries().some(a => a.id === "wasteling"), "The Wasteling is a choice on top of an Ancestry, not one of its own");
ok(Object.keys(R.BACKGROUNDS).length >= 30 && R.HOMELANDS.length >= 30 && R.CIRCLES.length >= 30, "Backgrounds, Homelands and Circles are read from the doc");
ok(R.ANCESTRIES.human.trees.join() === "ancestry-wusonian,ancestry-commonkin,ancestry-human-tree", "A Human's trees: the Wusonian core, Commonkin, Human");
ok(R.ANCESTRIES.goblin.trees.includes("ancestry-smallfolk") && R.ANCESTRIES.goblin.trees.includes("ancestry-bestial"), "A Goblin also gets Smallfolk (shared with Halflings)");
for (const a of Object.values(R.ANCESTRIES).filter(x => !x.variant)) {
  const listed = new Set(a.backgrounds), open = new Set(R.backgroundsFor(a.id).map(b => b.id));
  ok([...listed].every(b => open.has(b)) && [...open].every(b => listed.has(b)), `${a.name}: its profile's Backgrounds match the Backgrounds' "Available to"`);
}

console.log("== Every Background, for every Ancestry and every choice, gives exactly 15 points that meet their requirements");
let n = 0, bad = [];
for (const a of R.playerAncestries().map(x => x.id)) for (const b of R.backgroundsFor(a)) {
  const pkg = R.packageFor(b.id, a);
  for (const focus of pkg.options.length ? pkg.options.map(o => o.name) : [""]) {
    let combos = [{}];
    for (const s of R.choiceSlots(pkg, focus)) combos = combos.flatMap(c => s.choices.map(ch => ({ ...c, [s.key]: ch.id }))).slice(0, 300);
    for (const picks of combos) {
      const alloc = pkg.anyPoints || pkg.ancestryPoints ? { [S.ancestryTrees(a)[0].id]: 5 } : {};
      const r = R.freeTreesFor({ ancestry: a, background: b.id, focus, picks, alloc });
      n++;
      if (r.errors.length || r.spent !== 15) bad.push(`${a}/${b.id}/${focus}: ${r.spent} ${r.errors.join("; ")}`);
    }
  }
}
ok(!bad.length, `${n} combinations, all 15 points${bad.length ? `: ${bad.slice(0, 3).join(" | ")}` : ""}`);

console.log("== Ancestry differences");
const dwarfRecruit = R.packageFor("recruit", "dwarf").items.map(i => i.tree).filter(Boolean);
ok(dwarfRecruit.includes("Heavy Armor") && !dwarfRecruit.includes("Medium Armor"), "Dwarf Recruit: Heavy Armor T2 replaces Medium Armor T2");
const fwMage = R.packageFor("apprentice-mage", "fire-walker");
ok(fwMage.options.length === 1 && fwMage.options[0].name === "Elementalist" && fwMage.options[0].trees.some(i => i.tree === "Heat" && i.tier === 3), "Fire Walker Apprentice Mage: Elementalist only, and the school is Heat");
ok(R.packageFor("apprentice-mage", "orc").options.map(o => o.name).join() === "Warder", "Orc Apprentice Mage: Warder only");
const fwNovice = R.freeTreesFor({ ancestry: "fire-walker", background: "novice", picks: {} });
ok(fwNovice.trees["mental-theory"] === 3 && fwNovice.trees["mental-light-dream"] === 2 && !fwNovice.errors.length, "Fire Walker Novice: Mental Theory 3, Light 2 (no choice to make)");

console.log("== Choices and the Outsider");
ok(R.freeTreesFor({ ancestry: "human", background: "recruit", picks: {} }).errors.some(e => /isn't picked/.test(e)), "An unpicked choice is an error");
{ // An unpicked slot isn't unplaced: no Ancestry points are owed until the picks are made, and points spent early don't count once none are owed.
  const anc = S.ancestryTrees("dwarf")[0].id;
  ok(R.freeTreesFor({ ancestry: "dwarf", background: "recruit", picks: {} }).owed === 0, "No Ancestry points owed while a Background's choices are unpicked");
  const done = R.freeTreesFor({ ancestry: "dwarf", background: "recruit", picks: { 1: "martial-bladed-weapons" }, alloc: { [anc]: 3 } });
  ok(done.owed === 0 && !done.trees[anc] && !done.errors.length, "Picks that fill the 15 owe nothing, and early Ancestry points are dropped");
  ok(R.freeTreesFor({ ancestry: "dwarf", background: "outsider", alloc: {} }).owed === 15, "The Outsider still owes its 15");
}
ok(R.freeTreesFor({ ancestry: "human", background: "explorer" }).errors.length === 0, "Explorer (no choices) is ready at once");
ok(R.freeTreesFor({ ancestry: "dwarf", background: "explorer" }).errors.some(e => /can't take/.test(e)), "A Dwarf can't take the Human-only Explorer");
const out = R.freeTreesFor({ ancestry: "human", background: "outsider", alloc: { "ancestry-wusonian": 3, "ancestry-commonkin": 2, "ancestry-human-tree": 3 } });
ok(!out.errors.length && out.trees["ancestry-human-tree"] === 3 && out.spent === 15, "Outsider: 15 points spread over the Ancestry's trees (Wusonian 3, Commonkin 2, Human 3)");
ok(!R.freeTreesFor({ ancestry: "human", background: "outsider", alloc: { "ancestry-human-tree": 5 } }).errors.length, "...no tree needs another (Human 5 alone)");
const anyOut = R.freeTreesFor({ ancestry: "human", background: "outsider", alloc: { "martial-theory": 2, "martial-bladed-weapons": 1, "generic-resolve": 2, "ancestry-human-tree": 3, "ancestry-commonkin": 1, "ancestry-wusonian": 1 } });
ok(!anyOut.errors.length && anyOut.trees["martial-bladed-weapons"] === 1, "...or on any trees the character could take, Theory tiers included");
ok(R.freeTreesFor({ ancestry: "human", background: "outsider", alloc: { "martial-bladed-weapons": 5 } }).errors.some(e => /needs/.test(e)), "...with their requirements (Bladed needs Martial Theory)");
ok(R.freeTreesFor({ ancestry: "human", background: "outsider", alloc: { "ancestry-wusonian": 3 } }).errors.some(e => /Spend 15/.test(e)), "...and all 15 spent");
ok(R.freeTreesFor({ ancestry: "elf", background: "outsider", alloc: { "ancestry-smallfolk": 5 } }).errors.length > 0, "...never another Ancestry's trees (an Elf has no Smallfolk)");
{ // A Wasteling: the Wasteling core in place of the Ancestry's core; the lineage and own trees stay.
  const w = S.ancestryTrees("dwarf", true).map(t => t.id);
  ok(w.join() === "ancestry-wasteling,ancestry-commonkin,ancestry-dwarf-tree", "A Wasteling Dwarf: Wasteling, Commonkin, Dwarf");
  ok(!S.isAvailable({}, S.treeById("ancestry-wusonian"), { ancestry: "dwarf", wasteling: true }) && S.isAvailable({}, S.treeById("ancestry-wasteling"), { ancestry: "dwarf", wasteling: true })
    && !S.isAvailable({}, S.treeById("ancestry-wasteling"), { ancestry: "dwarf" }), "...it can't take Wusonian, and only a Wasteling takes the Wasteling tree");
  const wo = R.freeTreesFor({ ancestry: "dwarf", wasteling: true, background: "outsider", alloc: { "ancestry-wasteling": 5 } });
  ok(!wo.errors.length && wo.trees["ancestry-wasteling"] === 5, "...and its Outsider points can go on the Wasteling tree");
}

console.log("== Height and weight");
ok(JSON.stringify(R.bodyRange({ ancestry: "human" })) === JSON.stringify({ height: [60, 76], weight: [100, 250] }) && R.formatHeight(76) === "6 ft 4 in" && R.formatHeight(60) === "5 ft",
  "A Human: 5 ft to 6 ft 4 in, 100 to 250 lb");
ok(JSON.stringify(R.bodyRange({ ancestry: "human", wasteling: true })) === JSON.stringify({ height: [58, 76], weight: [80, 225] }), "A Wasteling Human: up to 2 in shorter, 10 to 20% lighter");
ok(R.randomIn([60, 76], 0) === 60 && R.randomIn([60, 76], 0.9999) === 76, "The randomizer stays in the range, both ends included");
ok(R.circlesFor("hill-warden").some(c => c.name === "The Hill Wardens"), "A Circle a Background names (not yet described in Cultures) can still be picked");

console.log("== Culture");
ok(R.homelandsFor("dusken").some(h => h.id === "dusken.paan-faithful") && R.homelandsFor("dusken").some(h => h.id === "shared.wanderer") && !R.homelandsFor("dusken").some(h => h.id === "elf.elven-courts"), "Homelands: the Ancestry's own and the Shared ones");
ok(R.circlesFor("mob-runner").filter(c => c.background === "mob-runner").length === 5, "Mob Runner: the five families' Circles");
ok(R.cultureErrors({ ancestry: "drakenblood", background: "laborer", homeland: "shared.wanderer", circle: "shared.self-made" }).some(e => /Gland/.test(e)), "A Drakenblood picks their Elemental Gland's element");

console.log("== Ancestry trees in the skill rules");
const human = { ancestry: "human" };
ok(S.isAvailable({}, S.treeById("ancestry-wusonian"), human) && !S.isAvailable({}, S.treeById("ancestry-wusonian"), {}), "The core opens only with an Ancestry");
ok(S.isAvailable({}, S.treeById("ancestry-human-tree"), human) && S.isAvailable({}, S.treeById("ancestry-commonkin"), human), "Every ancestry tree is open from the start (none needs another)");
ok(!S.isAvailable({ "ancestry-commonkin": 5 }, S.treeById("ancestry-elf-tree"), human), "...and another Ancestry's tree never opens");
ok(S.skillGroups({ ancestry: "goblin", ancestryName: "Goblin" })[0].trees.map(t => t.id).includes("ancestry-smallfolk"), "The Skills list's first group is the Ancestry's trees");
ok(S.spentPoints({ "martial-theory": 3, "generic-resolve": 2 }, { "martial-theory": 2, "generic-resolve": 2 }) === 3, "Free tiers cost nothing: Martial Theory 2 → 3 costs 3");
assert.equal(S.spentPoints({ "martial-theory": 2 }, {}), 3);

console.log("== Hostile spaces");
const ogre = [{ id: "ogre", x: 200, y: 0, w: 1, h: 1 }];
ok(P.blockerOnPath([{ x: 0, y: 0 }, { x: 400, y: 0 }], { size: 100 }, ogre)?.id === "ogre", "Walking straight through a hostile creature is stopped");
ok(!P.blockerOnPath([{ x: 0, y: 0 }, { x: 100, y: 0 }], { size: 100 }, ogre), "...stopping beside it is fine");
ok(!P.blockerOnPath([{ x: 0, y: 100 }, { x: 400, y: 100 }], { size: 100 }, ogre), "...and so is going past along its side");
ok(P.hostileDispositions(1, -1) && P.hostileDispositions(-2, 1) && !P.hostileDispositions(0, -1) && !P.hostileDispositions(1, 1), "Friendly vs Hostile (or Secret) only; Neutral never blocks");

if (fails) { console.log(`${fails} failed`); process.exit(1); }
console.log("abc tests passed");
