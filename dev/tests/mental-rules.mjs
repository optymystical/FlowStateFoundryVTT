// Mental rules: Wonders and Modes parsed from the Rework Test Ground trees, Wonder Power, Manifest costs, Alignment, Icons and Forms.
const M = await import("../../module/mental-rules.mjs");
let fails = 0; const ok = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };

console.log("== Wonders from the Mental trees");
ok(M.WONDERS.length === 18, `18 Wonders are written (${M.WONDERS.map(w => w.name).join(", ")})`);
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
const A = (kind, level) => ({ kind, level });
ok(M.alignmentState(null).level === 0 && M.alignmentState({ kind: "dream", level: 9 }).level === 4 && M.alignmentState({ kind: "neutral", level: 3 }).level === 0, "Alignment: Neutral by default, 4 at most, no points on Neutral");
ok(M.alignmentSpeedPct(A("dream", 3)) === 60 && M.alignmentSpeedPct(A("neutral", 0)) === 0, "20% speed per point; none for Neutral");
ok(M.alignmentApLoss(A("dream", 2)) === 0 && M.alignmentApLoss(A("dream", 3)) === 1 && M.alignmentApLoss(A("nightmare", 4)) === 2 && M.maxAlignment(2) === 2 && M.maxAlignment(3) === 4, "Deepening: 1 AP a turn per point past 2; depths 3 and 4 need Mental T3");
{ const w = (k, n, f) => M.alignmentWard(A(k, n), f);
  ok(w("nightmare", 1, "nightmare").net === 1 && w("nightmare", 1, "nightmare").stacks === 0 && w("nightmare", 1, "dream").net === 0, "1 Alignment: your own type's Ward has Advantage on its attack roll");
  ok(w("nightmare", 2, "nightmare").stacks === 1 && w("nightmare", 2, "nightmare").dodgeNet === 0 && !w("nightmare", 2, "nightmare").autoHit, "2 Alignment: its bolded effect is Strengthened");
  ok(w("nightmare", 3, "nightmare").dodgeNet === -1 && w("nightmare", 3, "nightmare").net === 1 && !w("nightmare", 3, "nightmare").autoHit, "3 Alignment: half stealth, so whoever dodges has Disadvantage");
  ok(w("nightmare", 4, "nightmare").autoHit && w("nightmare", 4, "dream").autoHit === false, "4 Alignment: the Ward hits regardless of the roll"); }
ok(M.alignmentWard(A("neutral", 0), "dream").net === 0, "Neutral gives the Ward nothing");
ok(M.fluidityCost(A("dream", 3), 31) === 45 && M.fluidityCost(A("neutral", 0), 31) === 0, "Fluidity: half your Skill Points times your Alignment number");
ok(M.alignedTo(A("dream", 1), "dream") && !M.alignedTo(A("neutral", 0), "dream"), "Aligned towards a type: at least 1 Alignment of it");
ok(M.alignmentLabel(A("dream", 2)) === "Dream 2" && M.alignmentLabel(A("neutral", 0)) === "Neutral", "Alignment labels");

console.log("== Icon texts scale");
ok(M.scaleFormText("provides 20 shielding for 1 AP, up to 60 shielding. In the Dream 2, 5 shielding", 3) === "provides 60 shielding for 1 AP, up to 180 shielding. In the Dream 2, 15 shielding", "Shielding grows with the Icon; AP and Alignment numbers don't");
ok(M.scaleFormText("spend 1 RP to negate up to 30 of that damage, 5 negation otherwise", 2) === "spend 1 RP to negate up to 60 of that damage, 10 negation otherwise", "Negation grows too; RP doesn't");

console.log("== Icons and Forms");
ok(M.FORM_KEYS.length === 14 && M.FORM_KEYS.filter(k => M.FORMS[k].align === "dream").length === 7, "14 Forms, 7 Dream and 7 Nightmare");
let p = M.iconProfile({ form: "aegis", grade: 2, tenet: "mental-life-dream:verdant-soul" }, { will: 45, pon: 32 });
ok(p.wardMult === 2 && p.amount === 16 && p.enhancedAmount === 30, "Aegis at Grade 2 with Willpower 45: capped at 20 → ×2, 8 → 16 shielding (15 → 30 Enhanced)");
ok(p.tenet.mult === 2 && p.durability === 40 && p.limit === 8, "The Tenet scales with the Wonder's stat, limited by Grade; Durability 20 and Limit 4 per Grade");
p = M.iconProfile({ form: "veil", grade: 3 }, { will: 15 });
ok(p.wardMult === 1 && p.amount === 4 && p.enhancedAmount === 8, "Veil: 4 negation (8 Enhanced), at least ×1");
p = M.iconProfile({ form: "bane", grade: 1 }, { will: 99 });
ok(p.amount === 6 && p.other === 3, "Bane: 6 against the chosen type, 3 otherwise");
ok(M.iconProfile({ form: "nope" }).valid === false, "An unknown Form isn't valid");
ok(M.tenetChoices("dream").every(w => w.kind === "dream") && M.tenetChoices("nightmare").every(w => w.kind === "nightmare"), "Tenets match the Form's Alignment");
ok(M.tenetChoices("dream").length === 9 && M.tenetChoices("nightmare").length === 9, "Nine Dream and nine Nightmare Tenets");
const earth = M.wonderById("mental-earth-dream"), sea = M.wonderById("mental-sea-nightmare");
ok(earth?.modes.map(m => m.name).join() === "Accretion" && earth.tenet?.name === "Adamant" && sea?.modes.map(m => m.name).join() === "Undertow,Riptide,Drown" && sea.tenet?.name === "Surge", "Earth (Accretion, Adamant) and Sea (Undertow, Riptide, Drown, Surge) parse");
const ill = M.modeById("mental-light-dream:illuminate");
ok((M.scaleMentalText(ill.base, 3, "Illuminate").match(/reduced by 3/g) ?? []).length === 2, "A phrase bolded in both versions scales in both");
ok(/Against an enemy:.*Against an ally:/.test(ill?.base ?? "") && /Weakened/.test(ill?.enhanced ?? ""), "Illuminate keeps its two versions and its Enhanced text (the doc's bullet layout)");
ok(M.tenetChoices("dream", { "mental-life-dream": 1 }).length === 1, "A character can pick only Tenets they know");

console.log("== Text scaling");
ok(M.scaleMentalText("they get 20 temp HP. Herald: apply 10d8 Force", 3) === "they get 60 temp HP. Herald: apply 30d8 Force", "Dice counts and temp HP scale with Wonder Power");
ok(M.scaleMentalText("2d10 health", 1) === "2d10 health", "Power 1 leaves it as printed");
ok(M.scaleSpans("The next time the target spends energy, it spends 3 more.", ["3", "more"], 4) === "The next time the target spends energy, it spends 12 more." && M.scaleSpans("Loses 10 Temp HP, and an object loses 10 Durability.", ["10 Temp HP", "10 Durability"], 2) === "Loses 20 Temp HP, and an object loses 20 Durability.", "A table row's bolded values scale in order");
ok(M.scaleMentalText("move them up to 1.5ft (rounded down)", 3, "Current") === "move them up to 4.5ft (rounded down)", "Decimals scale too (Current: 1.5 ft × 3)");
ok(M.scaleMentalText("Its dodge rolls have their die size reduced by 0.5 (this reduction is rounded up).", 3, "Eclipse").includes("reduced by 1.5"), "…and Eclipse's 0.5 die size");
console.log(fails ? `\n${fails} FAILED` : "\nAll Mental rules checks passed");
if (fails) process.exit(1);
