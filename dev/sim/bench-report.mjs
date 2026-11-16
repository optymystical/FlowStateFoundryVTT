// Tabulate the focused benches (grand.mjs `benchPasses`): per bench, A against B over both passes (-a: A is the party, -b: B is).
// Damage is the HP tally (every HP drop, credited to the creature whose turn it was, when the one losing it was on the other side).
// Run: node dev/sim/bench-report.mjs [--json out.json]
import fs from "node:fs";
import path from "node:path";

const dir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "results");
const files = fs.readdirSync(dir).filter(f => /^bench-.+-(a|b)(-\d+)?\.json$/.test(f));
const benches = new Map();
for (const f of files) {
  const [, key, side] = /^bench-(.+)-(a|b)(?:-\d+)?\.json$/.exec(f);
  let list;
  try { list = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
  const b = benches.get(key) ?? benches.set(key, { key, sides: {}, fights: 0, rounds: 0, stalls: 0 }).get(key);
  for (const fight of list) {
    if (fight.crashed) continue;
    b.fights++; b.rounds += fight.rounds ?? 0;
    if (fight.winner === "unfinished") b.stalls++;
    const party = side === "a" ? "A" : "B";
    const winner = fight.winner === "party" ? party : fight.winner === "monsters" ? (party === "A" ? "B" : "A") : null;
    const aiBy = new Map((fight.ai ?? []).map(a => [a.name, a]));
    const downs = new Map();
    for (const n of fight.down ?? []) downs.set(n, (downs.get(n) ?? 0) + 1);
    const seen = new Set();
    for (const c of Object.values(fight.creatures ?? {})) {
      if (!/ #\d+$/.test(c.name)) continue;
      const ai = aiBy.get(c.name) ?? {};
      const who = (ai.side ?? "party") === "party" ? party : party === "A" ? "B" : "A";
      const s = b.sides[who] ??= { name: c.name.replace(/ #\d+$/, ""), wins: 0, fights: 0, dealt: 0, taken: 0, turns: 0, hits: 0, attacks: 0, downs: 0, bodies: 0, used: {} };
      if (!seen.has(who)) { seen.add(who); s.fights++; if (winner === who) s.wins++; }
      const tally = fight.hpLoss;
      s.dealt += tally ? tally.dealt?.[c.name] ?? 0 : c.dealt ?? 0;
      s.taken += tally ? tally.taken?.[c.name] ?? 0 : c.taken ?? 0;
      s.hits += c.hits ?? 0; s.attacks += c.attacks ?? 0; s.turns += ai.turns ?? 0; s.bodies++;
      if (downs.get(c.name)) { s.downs++; downs.set(c.name, downs.get(c.name) - 1); }
      for (const [k, v] of Object.entries(ai.used ?? {})) s.used[k] = (s.used[k] ?? 0) + v;
    }
  }
}
const fmt = (n, d = 0) => (Number.isFinite(n) ? n.toFixed(d) : "-");
const out = [];
let md = `# Focused benches\n\n| Bench | Build | Fights | Wins | Dmg/turn | Hit % | Taken/creature | Survived % |\n|---|---|---|---|---|---|---|---|\n`;
for (const b of [...benches.values()].sort((x, y) => x.key.localeCompare(y.key))) {
  for (const who of ["A", "B"]) {
    const s = b.sides[who];
    if (!s) continue;
    const row = { bench: b.key, side: who, name: s.name, fights: s.fights, wins: s.wins, stalls: b.stalls, rounds: b.fights ? b.rounds / b.fights : 0,
      dpt: s.turns ? s.dealt / s.turns : 0, hitRate: s.attacks ? s.hits / s.attacks : null, takenPer: s.bodies ? s.taken / s.bodies : 0, survive: s.bodies ? 1 - s.downs / s.bodies : 0,
      used: Object.fromEntries(Object.entries(s.used).sort((x, y) => y[1] - x[1]).slice(0, 12)) };
    out.push(row);
    md += `| ${b.key} | ${s.name} | ${s.fights} | ${s.wins} | ${fmt(row.dpt, 1)} | ${row.hitRate === null ? "-" : fmt(100 * row.hitRate)} | ${fmt(row.takenPer)} | ${fmt(100 * row.survive)} |\n`;
  }
  md += `| | *${b.stalls} of ${b.fights} hit the round cap; average ${fmt(b.fights ? b.rounds / b.fights : 0, 1)} rounds* | | | | | | |\n`;
}
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
if (arg("--json")) fs.writeFileSync(arg("--json"), JSON.stringify(out, null, 1));
console.log(md);
