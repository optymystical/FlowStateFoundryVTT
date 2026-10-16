import { parseEnergyCost, energyFor, energySummary, stripEnergyCost } from "../../module/energy.mjs";
import { TREES } from "../../module/trees.mjs";
const eff = { str: { value: 30, min: 10 }, dex: { value: 21, min: 7 }, con: { value: 15, min: 5 } };
const ctx = { effective: eff, skillPoints: 30, weapons: [{ name: "Sword", capped: 10 }, { name: "Unarmed", unarmed: true }] };
let n = 0, other = 0;
for (const t of TREES) for (const ti of t.tiers) for (const e of ti.entries) {
  const c = parseEnergyCost(e.text); if (!c) continue; n++;
  if (c.base === "other") { other++; console.log("OTHER", c.phrase); }
}
console.log("costs parsed", n, "unrecognized", other);
const show = s => { const c = parseEnergyCost(s); console.log(c.short.padEnd(28), "=>", energySummary(energyFor(c, ctx))); };
show("Cost: Energy equal to half of your Scaling Stat min, rounded down. x");
show("Cost: Energy equal to double your STR min. x");
show("Cost: Energy equal to a quarter of your CON min, rounded down. x");
show("Cost: Energy equal to half of your Skill Points, rounded down. x");
show("Cost: Energy equal to your CON stat. x");
show("Cost: Energy equal to the STR min of your grappled target. x");
show("Cost: Energy equal to your Scaling Stat. x");
console.log(JSON.stringify(stripEnergyCost("Cost: Energy equal to your STR min. At any time, do a thing.")));
// Mental costs: PON / SNA / WIL mins and total Mind are worked out; "Scaling Stat" in the Arts shows the Dream (PON) and Nightmare (SNA) amounts.
{
  const me = { pon: { value: 36, min: 7 }, snap: { value: 31, min: 6 }, will: { value: 40, min: 8 } };
  const fail = m => { console.log("FAIL", m); process.exitCode = 1; };
  const sum = (t, extra = {}) => energySummary(energyFor(parseEnergyCost(t), { effective: me, ...extra }));
  if (sum("Cost: Energy equal to half your SNA min, rounded down. x") !== "3 Energy") fail("SNA min");
  if (sum("Cost: Energy equal to your WIL min. x") !== "8 Energy" || parseEnergyCost("Cost: Energy equal to your WIL min. x").short !== "WIL min") fail("WIL min");
  if (sum("Cost: Energy equal to double your PON min. x") !== "14 Energy") fail("PON min");
  if (sum("Cost: Energy equal to your total Mind. x") !== "107 Energy") fail("total Mind");
  const both = [{ label: "Dream (PON)", stat: "pon" }, { label: "Nightmare (SNA)", stat: "snap" }];
  if (sum("Cost: Energy equal to half of your Scaling Stat min, rounded down. x", { scalingStats: both }) !== "Dream (PON): 3 · Nightmare (SNA): 3") fail("Reflex shows both");
  if (sum("Cost: Energy equal to your Scaling Stat min. x", { scalingStats: both.slice(0, 1) }) !== "7 Energy") fail("one Wonder stat");
  const mentalOther = TREES.filter(t => t.archetype === "mental").flatMap(t => t.tiers.flatMap(x => x.entries)).map(e => parseEnergyCost(e.text)).filter(c => c?.base === "other");
  if (mentalOther.length) fail(`Mental costs left unparsed: ${mentalOther.map(c => c.phrase).join("; ")}`);
  if (!process.exitCode) console.log("  PASS Mental costs: PON/SNA/WIL mins, total Mind, and the Arts' two Scaling Stat amounts");
}
