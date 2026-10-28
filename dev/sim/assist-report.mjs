// Assist bench report: what the allies dealt to the target per config, against the baseline.
//   node dev/sim/assist-report.mjs [--pass assist-bench]
import { readFileSync } from "node:fs";
const pass = process.argv.includes("--pass") ? process.argv[process.argv.indexOf("--pass") + 1] : "assist-bench";
const fights = JSON.parse(readFileSync(new URL(`./results/${pass}.json`, import.meta.url)));
const rows = new Map();
for (const f of fights) {
  const cfg = f.id.replace(/-\d+$/, "");
  const r = rows.get(cfg) ?? rows.set(cfg, { n: 0, lost: 0, rounds: 0, killed: 0, s: [0, 0, 0], c: [0, 0, 0], w: 0, used: {} }).get(cfg);
  r.n++;
  const hp = Object.entries(f.hp).find(([k]) => k.startsWith("Sim Target"))?.[1] ?? "0/0";
  const [cur, max] = hp.split("/").map(Number);
  r.lost += Math.min(max, max - cur);
  r.rounds += Math.min(f.rounds, 4); r.killed += cur <= 0 ? 1 : 0;
  const who = name => f.creatures.find(c => c.name === name) ?? { attacks: 0, hits: 0, dealt: 0 };
  const s = who("Sim Striker"), c = who("Sim Cutter");
  r.s[0] += s.attacks; r.s[1] += s.hits; r.s[2] += s.dealt;
  r.c[0] += c.attacks; r.c[1] += c.hits; r.c[2] += c.dealt;
  r.w += Math.min(max, max - cur) - s.dealt - c.dealt;          // Wither and Mortal Coil aren't on damage cards: the rest of the target's HP loss
  for (const [k, v] of Object.entries(f.used ?? {})) if (/^(manifest|charge|dmgcharge|verdict|balance)/.test(k)) r.used[k] = (r.used[k] ?? 0) + v;
}
const base = rows.get("baseline");
const pct = (a, b) => (b ? `${a >= b ? "+" : ""}${Math.round((a / b - 1) * 100)}%` : "—");
const hr = ([a, h]) => (a ? `${Math.round((h / a) * 100)}%` : "—");
console.log("config      fights  killed  lost/round  target lost/fight  vs base/round  striker hit  dmg/fight  cutter hit  dmg/fight  witherer dmg/fight");
for (const [cfg, r] of rows) {
  const per = x => Math.round(x / r.n);
  console.log([cfg.padEnd(10), String(r.n).padStart(6), String(r.killed).padStart(7), String(Math.round(r.lost / r.rounds)).padStart(11), String(per(r.lost)).padStart(18), pct(r.lost / r.rounds, base.lost / base.rounds).padStart(14),
    hr(r.s).padStart(12), String(per(r.s[2])).padStart(10), hr(r.c).padStart(11), String(per(r.c[2])).padStart(10), String(per(r.w)).padStart(19)].join(" "));
  console.log("           ", Object.entries(r.used).map(([k, v]) => `${k} ${(v / r.n).toFixed(1)}`).join(", "));
}
