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
