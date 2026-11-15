// Tabulate the grand balance pass (grand.mjs): per featured tree and level, from every dev/sim/results/grand-*.json (party and mirror side both
// count: a build fights as the party in its own pass and as the mirror in the pass before it). Run: node dev/sim/grand-report.mjs [--md out.md] [--json out.json]
import fs from "node:fs";
import path from "node:path";

const dir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "results");
const files = fs.readdirSync(dir).filter(f => /^grand-\d+-p\d+(-\d+)?\.json$/.test(f));
const rows = new Map();          // name → stats
const row = name => rows.get(name) ?? rows.set(name, { name, fights: 0, wins: 0, dealt: 0, taken: 0, hits: 0, attacks: 0, turns: 0, kills: 0, downs: 0, vsBestiary: 0, winsBestiary: 0 }).get(name);
const fights = [];
for (const f of files) {
  let list;
  try { list = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
  for (const fight of list) {
    if (fight.crashed) continue;
    fights.push({ file: f, id: fight.id, winner: fight.winner, rounds: fight.rounds, seconds: fight.seconds });
    const aiBy = new Map((fight.ai ?? []).map(a => [a.name, a]));
    const downs = new Map();
    for (const n of fight.down ?? []) downs.set(n, (downs.get(n) ?? 0) + 1);
    for (const c of Object.values(fight.creatures ?? {})) {
      if (!/^L\d+ /.test(c.name)) continue;                          // only generated builds (not the Bestiary monsters)
      const ai = aiBy.get(c.name) ?? {};
      const side = ai.side ?? (fight.group === "mirror" ? "?" : "party");
      const r = row(c.name);
      r.fights++;
      if ((side === "party" && fight.winner === "party") || (side === "monsters" && fight.winner === "monsters")) r.wins++;
      r.dealt += c.dealt ?? 0; r.taken += c.taken ?? 0; r.hits += c.hits ?? 0; r.attacks += c.attacks ?? 0;
      r.turns += ai.turns ?? 0; r.kills += ai.kills ?? 0;
      if (downs.get(c.name)) { r.downs++; downs.set(c.name, downs.get(c.name) - 1); }
      if (fight.id.startsWith("bestiary")) { r.vsBestiary++; if (fight.winner === "party") r.winsBestiary++; }
    }
  }
}
const out = [...rows.values()].map(r => ({ ...r, level: Number(/^L(\d+)/.exec(r.name)[1]), tree: r.name.replace(/^L\d+ /, ""),
  dpt: r.turns ? r.dealt / r.turns : 0, hitRate: r.attacks ? r.hits / r.attacks : 0, survive: r.fights ? 1 - r.downs / r.fights : 0, winRate: r.fights ? r.wins / r.fights : 0 }));
const fmt = (n, d = 0) => (Number.isFinite(n) ? n.toFixed(d) : "-");
let md = `# Grand balance pass\n\n${fights.length} fights from ${files.length} files.\n`;
for (const level of [15, 60]) {
  const list = out.filter(r => r.level === level).sort((a, b) => b.dpt - a.dpt);
  if (!list.length) continue;
  const med = list.map(r => r.dpt).sort((a, b) => a - b)[Math.floor(list.length / 2)] || 1;
  md += `\n## Level ${level} (${list.length} builds; median damage per turn ${fmt(med, 1)})\n\n| Build | Fights | Win % | Dmg/turn | vs median | Hit % | Taken/fight | Kills | Survived % |\n|---|---|---|---|---|---|---|---|---|\n`;
  for (const r of list) md += `| ${r.tree} | ${r.fights} | ${fmt(100 * r.winRate)} | ${fmt(r.dpt, 1)} | ${fmt(r.dpt / med, 2)}× | ${fmt(100 * r.hitRate)} | ${fmt(r.taken / Math.max(1, r.fights))} | ${r.kills} | ${fmt(100 * r.survive)} |\n`;
}
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
if (arg("--md")) fs.writeFileSync(arg("--md"), md);
if (arg("--json")) fs.writeFileSync(arg("--json"), JSON.stringify({ fights, builds: out }, null, 1));
console.log(md);
