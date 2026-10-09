// Sides of the scene: effects that help "a willing creature" or hurt "a foe" only come up for the right creatures.
const { sideOf, opposed, allied, mayHelp, mayHarm } = await import("../../module/sides.mjs");
let fails = 0; const ok2 = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const mk = (name, disposition) => ({ name, uuid: `Actor.${name}`, getActiveTokens: () => disposition === undefined ? [] : [{ document: { disposition } }] });
const pc = mk("PC", 1), pc2 = mk("PC2", 1), orc = mk("Orc", -1), orc2 = mk("Orc2", -1), npc = mk("Neutral", 0), gone = mk("NoToken");

console.log("== sides");
ok2(sideOf(pc) === 1 && sideOf(orc) === -1 && sideOf(npc) === 0 && sideOf(gone) === 0, "Friendly, Hostile, Neutral, and no token");
ok2(sideOf(mk("Secret", -2)) === -1, "Secret counts as Hostile");
ok2(opposed(pc, orc) && opposed(orc, pc2), "A Friendly and a Hostile token are opposed");
ok2(!opposed(pc, pc2) && !opposed(orc, orc2) && !opposed(pc, pc), "Same side, or the same creature, is not opposed");
ok2(!opposed(pc, npc) && !opposed(npc, orc) && !opposed(pc, gone), "Neutral and tokenless creatures are never opposed");
ok2(allied(pc, pc2) && allied(orc, orc2) && allied(pc, pc), "Allies share a side");
ok2(!allied(pc, orc) && !allied(pc, npc) && !allied(gone, pc), "Neutral and tokenless creatures aren't known allies");

console.log("== helping and harming");
ok2(mayHelp(pc2, pc) && mayHelp(npc, pc) && !mayHelp(orc, pc), "Block, Shield Toss, Quartz, Adjust, Dampen and Infuse are offered for allies and neutrals, not across sides");
ok2(mayHarm(orc, pc) && mayHarm(npc, pc) && !mayHarm(pc, pc2) && !mayHarm(pc, pc), "Empower is offered against foes and neutrals, never an ally or yourself");

console.log(fails ? `${fails} FAILED` : "all sides tests passed");
process.exit(fails ? 1 : 0);
