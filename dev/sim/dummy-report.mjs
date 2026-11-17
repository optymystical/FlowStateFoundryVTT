// Tabulate the dummy benches (grand.mjs `dummyPasses`): one level 60 build against a still dummy with a fixed dodge, 4 rounds, three fights each.
// Damage is every HP the dummy lost (ticks on its own turn included), per turn of the tester.
// Run: node dev/sim/dummy-report.mjs [--json out.json]
import fs from "node:fs";
import path from "node:path";

const dir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "results");
const files = fs.readdirSync(dir).filter(f => /^dummy-.+\.json$/.test(f)).sort();
const rows = [];
for (const f of files) {
  let list;
  try { list = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
  const key = f.replace(/^dummy-|\.json$/g, "");
  const r = { key, name: "", fights: 0, lost: 0, turns: 0, hits: 0, attacks: 0, used: {}, perFight: [] };
  for (const fight of list) {
    if (fight.crashed) continue;
    const tester = (fight.ai ?? []).find(a => a.side === "party") ?? (fight.ai ?? [])[0] ?? {};
    const c = Object.values(fight.creatures ?? {}).find(x => x.name === tester.name) ?? {};
    r.name ||= tester.name ?? "";
    const lost = fight.lostBy?.monsters ?? 0;
    r.fights++; r.lost += lost; r.turns += tester.turns ?? 0; r.hits += c.hits ?? 0; r.attacks += c.attacks ?? 0;
    r.perFight.push(tester.turns ? Math.round(lost / tester.turns) : 0);
    for (const [k, v] of Object.entries(tester.used ?? {})) if (k !== "defend:dodge") r.used[k] = (r.used[k] ?? 0) + v;
  }
  rows.push({ ...r, dpt: r.turns ? r.lost / r.turns : 0, hitRate: r.attacks ? r.hits / r.attacks : null,
    used: Object.fromEntries(Object.entries(r.used).sort((a, b) => b[1] - a[1]).slice(0, 8)) });
}
const fmt = (n, d = 0) => (Number.isFinite(n) ? n.toFixed(d) : "-");
let md = "# Dummy benches (level 60, fixed dodge, 4 rounds)\n\n| Bench | Build | Fights | Damage per turn | Per fight | Hit % | Used |\n|---|---|---|---|---|---|---|\n";
for (const r of rows) md += `| ${r.key} | ${r.name} | ${r.fights} | ${fmt(r.dpt)} | ${r.perFight.join(", ")} | ${r.hitRate === null ? "-" : fmt(100 * r.hitRate)} | ${Object.entries(r.used).map(([k, v]) => `${k} ${v}`).join(", ")} |\n`;
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
if (arg("--json")) fs.writeFileSync(arg("--json"), JSON.stringify(rows, null, 1));
console.log(md);
