// Mental rules: Wonders and Modes parsed from the Rework Test Ground trees, Wonder Power, Manifest costs, Alignment, Icons and Forms.
const M = await import("../../module/mental-rules.mjs");
let fails = 0; const ok = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };

console.log("== Wonders from the Mental trees");
ok(M.WONDERS.length === 12, `12 Wonders are written (${M.WONDERS.map(w => w.name).join(", ")})`);
const life = M.wonderById("mental-life-dream");
ok(life.kind === "dream" && life.name === "Life" && life.modes.map(m => m.name).join() === "Bloom,Flourish,Renewal", "Life (Dream): Modes Bloom, Flourish, Renewal");
ok(life.tenet.name === "Verdant Soul" && life.tenet.tier === 1 && life.abilities.map(a => a.name).join() === "Pollinate,Perennial", "…its Tenet is Verdant Soul and its abilities Pollinate and Perennial");
const bloom = life.modes[0];
ok(/^At the start of the target/.test(bloom.base) && /^The temp HP applies immediately/.test(bloom.enhanced), "A Mode splits into its base text and its Enhanced effect");
const death = M.wonderById("mental-death-nightmare");
ok(death.kind === "nightmare" && death.modes.map(m => m.name).join() === "Wither,Waste,Execute", "Death (Nightmare): Wither, Waste, Execute");
ok(M.KINDS.dream.stat === "pon" && M.KINDS.nightmare.stat === "snap", "Dreams scale with Ponderance, Nightmares with Snappence");
const adapt = M.wonderById("mental-adaptation-dream");
ok(adapt.modes.map(m => m.name).join() === "Crescendo,Adaptive Skin,Second Wind" && adapt.tenet.name === "Adapt", "Adaptation: bulleted Modes parse too");
const known = M.knownWonders({ "mental-life-dream": 2, "mental-theory": 1 });
ok(known.length === 1 && known[0].modes.map(m => m.name).join() === "Bloom" && known[0].tenet && known[0].abilities.map(a => a.name).join() === "Pollinate", "A character knows only the tiers they've bought (Life T2: Bloom, the Tenet, Pollinate)");
ok(M.theoryTier({ "mental-theory": 3 }) === 3, "Mental Theory tier is read from the tree state");

console.log("== Wonder Power and Manifest costs");
ok(M.wonderPower(30) === 3 && M.wonderPower(9) === 0 && M.wonderPower(35) === 3, "1 Power per 10 in the Scaling Stat");
ok(M.wonderPower(30, 50) === 4 && M.wonderPower(30, 100) === 6, "Power bonuses are additive percentages, rounded down after");
ok(!M.manifestCheck(life, 9).ok && /under 10/.test(M.manifestCheck(life, 9).reason) && M.manifestCheck(life, 20).power === 2, "Under 10 in the Scaling Stat: can't Manifest");
ok(M.manifestCost({ range: "melee" }).ap === 1 && M.manifestCost({ range: "ranged" }).ap === 2 && M.manifestCost({ range: "area" }).ap === 3, "Melee 1 AP, Ranged 2, Area 3");
let c = M.manifestCost({ range: "ranged", enhance: true, enhanceCost: 7 });
ok(c.ap === 2 && c.energy === 7 && c.rp === 0, "Enhance costs the Wonder's Scaling Stat min in energy");
c = M.manifestCost({ range: "area", burst: true, enhanceCost: 7 });
ok(c.ap === 0 && c.rp === 3 && c.energy === 7, "Burst: RP equal to the AP cost, plus the Enhance cost in energy");
c = M.manifestCost({ range: "melee", burst: true, enhance: true, enhanceCost: 7 });
ok(c.rp === 1 && c.energy === 14, "Burst and Enhance together combine the costs");
ok(M.manifestCost({ range: "ranged", enhance: true, burst: true, enhanceCost: 7, free: true }).energy === 0, "Free Manifests (Patron, Innate) cost nothing");

console.log("== Alignment");
ok(M.alignmentNet("dream", "dream") === 1 && M.alignmentNet("dream", "nightmare") === -1 && M.alignmentNet("neutral", "dream") === 0, "Dream/Nightmare: Advantage for its own Wonders, Disadvantage for the opposite");
ok(M.alignmentNet("neutral", "dream", { ward: true }) === 1 && M.alignmentNet("dream", "dream", { ward: true }) === 0, "Neutral: Ward attacks have Advantage");
ok(M.alignChangeCost({}).ap === 2 && M.alignChangeCost({ fluidity: true, skillPoints: 31 }).energy === 15, "Changing Alignment: 2 AP, or half your Skill Points in energy with Fluidity");
ok(M.deepenCost("dream", { scalingMin: 9 }).energy === 9 && M.deepenCost("neutral", { willMin: 6 }).ap === 2 && M.deepenCost("neutral", { willMin: 6 }).energy === 6, "Deepening costs the Scaling Stat min; Neutral Equilibrium costs 2 AP and Willpower min");

console.log("== Icons and Forms");
ok(M.FORM_KEYS.length === 14 && M.FORM_KEYS.filter(k => M.FORMS[k].align === "dream").length === 7, "14 Forms, 7 Dream and 7 Nightmare");
let p = M.iconProfile({ form: "aegis", grade: 2, tenet: "mental-life-dream:verdant-soul" }, { will: 45, pon: 32 });
ok(p.wardMult === 2 && p.amount === 40 && p.enhancedAmount === 60, "Aegis at Grade 2 with Willpower 45: capped at 20 → ×2, 20 → 40 shielding (30 → 60 Enhanced)");
ok(p.tenet.mult === 2 && p.durability === 40 && p.limit === 8, "The Tenet scales with the Wonder's stat, limited by Grade; Durability 20 and Limit 4 per Grade");
p = M.iconProfile({ form: "veil", grade: 3 }, { will: 15 });
ok(p.wardMult === 1 && p.amount === 10 && p.enhancedAmount === 20, "Veil: 10 negation (20 Enhanced), at least ×1");
p = M.iconProfile({ form: "bane", grade: 1 }, { will: 99 });
ok(p.amount === 20 && p.other === 5, "Bane: 20 against the chosen type, 5 otherwise");
ok(M.iconProfile({ form: "nope" }).valid === false, "An unknown Form isn't valid");
ok(M.tenetChoices("dream").every(w => w.kind === "dream") && M.tenetChoices("nightmare").every(w => w.kind === "nightmare"), "Tenets match the Form's Alignment");
ok(M.tenetChoices("dream").length === 6 && M.tenetChoices("nightmare").length === 6, "Six Dream and six Nightmare Tenets");
ok(M.tenetChoices("dream", { "mental-life-dream": 1 }).length === 1, "A character can pick only Tenets they know");

console.log("== Text scaling");
ok(M.scaleMentalText("they get 20 temp HP. Herald: apply 10d8 Force", 3) === "they get 60 temp HP. Herald: apply 30d8 Force", "Dice counts and temp HP scale with Wonder Power");
ok(M.scaleMentalText("2d10 health", 1) === "2d10 health", "Power 1 leaves it as printed");
console.log(fails ? `\n${fails} FAILED` : "\nAll Mental rules checks passed");
if (fails) process.exit(1);
