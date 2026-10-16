// The reaction switches: which prompts a character can be asked, and the flag that skips them.
const R = await import("../../module/reactions.mjs");
let fails = 0; const ok2 = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const actor = flags => ({ getFlag: (s, k) => flags[k] });
const ctx = (over = {}, trees = {}) => ({ tenet: "", iconKind: "", hasPremonition: false, tier: w => trees[w] ?? 0, ...over });

console.log("== which reactions a character sees");
ok2(R.reactionRows(actor({}), ctx()).length === 0, "A character with nothing that can ask them anything sees no switches");
ok2(R.reactionRows(actor({}), ctx({ tenet: "infuse" })).map(r => r.key).join() === "infuse", "Infuse's Tenet gives the Infuse switch");
ok2(R.reactionRows(actor({}), ctx({ iconKind: "negate" })).map(r => r.key).join() === "ward", "A negating Ward gives the Ward switch");
ok2(R.reactionRows(actor({}), ctx({ hasPremonition: true })).some(r => r.key === "premonition"), "A Premonition charge on them gives the Premonition switch");
const war = R.reactionRows(actor({}), ctx({}, { "mental-war-nightmare": 5 })).map(r => r.key);
ok2(war.includes("warmonger") && war.includes("bloodbond") && !war.includes("serenity"), "War T5 gives Warmonger and Bloodbond, and nothing from Peace");
ok2(R.reactionRows(actor({}), ctx({ tenet: "gust" })).some(r => r.key === "tenet"), "A Manifest-hit Tenet gives the Tenet switch");
const keys = (over, trees) => R.reactionRows(actor({}), ctx(over, trees)).map(r => r.key);
ok2(keys({}, { "martial-reach-weapons": 1 }).join() === "palisade" && keys({}, { "martial-swift-weapons": 3 }).join() === "flurry" && keys({}, { "martial-brawling-methods": 3 }).join() === "brawling", "Offer cards get switches too: Palisade, Blade Flurry, Combo / Flow Like Water");
ok2(keys({ anyWonder: true, theory: 5 }).join() === "wonderAbilities,chant,wobs" && keys({}, { "mental-sea-nightmare": 2, "mental-beyond-dream": 2 }).join() === "momentum,current", "…and the Mental ones (ability buttons, Chant, Will of Body and Spirit, Momentum, Current)");
ok2(R.reactionRows(actor({}), ctx({}, { "martial-rapid-weapons": 3 })).map(r => r.key).join() === "mark" && !R.reactionRows(actor({}), ctx({}, { "martial-rapid-weapons": 2 })).length, "Rapid Weapons T3 gives the Mark shot switch");

console.log("== the switch");
ok2(R.isDeclined(actor({ autoDecline: { infuse: true } }), "infuse") && !R.isDeclined(actor({ autoDecline: { infuse: false } }), "infuse") && !R.isDeclined(actor({}), "infuse"), "Only an explicit true skips a reaction");
ok2(!R.isDeclined(actor({ autoDecline: { infuse: true } }), undefined) && !R.isDeclined(null, "infuse"), "No key, or no actor: never skipped");
ok2(R.toggledTo(actor({}), "ward") === true && R.toggledTo(actor({ autoDecline: { ward: true } }), "ward") === false, "Toggling flips it (written as true or false, since flags merge)");
ok2(R.reactionRows(actor({ autoDecline: { infuse: true } }), ctx({ tenet: "infuse" }))[0].off === true, "The row shows whether it is skipped");

console.log(fails ? `${fails} FAILED` : "all reaction tests passed");
process.exit(fails ? 1 : 0);
