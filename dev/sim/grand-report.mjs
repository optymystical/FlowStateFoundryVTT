// Tabulate the grand balance pass (grand.mjs): per featured tree and level, from every dev/sim/results/grand-*.json (party and mirror side both
// count: a build fights as the party in its own pass and as the mirror in the pass before it). Damage is the HP tally (every HP drop, credited to
// the creature whose turn it was, when the one losing it was on the other side); fights saved before the tally use their cards' numbers.
// Run: node dev/sim/grand-report.mjs [--md out.md] [--json out.json]
import fs from "node:fs";
import path from "node:path";

const dir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "results");
const files = fs.readdirSync(dir).filter(f => /^grand-\d+-p\d+(-\d+)?\.json$/.test(f));
const ARCH = { martial: "Martial", magic: "Magic", mental: "Mental" };
const archOf = tree => {
  if (/ Armor$|^(Brawling|Bladed|Balanced|Swift|Rapid|Medium|Strength|Striker|Defender|Weighted|Assault|Heavy|Dexterity|Reach|Circular|Blast|Constitution|Curved|Longshot|Titanic|Grappling|Thrasher|Unarmored)$/.test(tree)) return "Martial";
  if (/Arcana$|^(Gravity|Slashing|Piercing|Crushing|Heat|Cold|Radiation|Acid|Venomancy|Charm|Witchery|Summoning|Creation School|Animation|Geomancy|Illusion|Arcanomancy)$/.test(tree)) return "Magic";
  return "Mental";
};
const rows = new Map();
const row = (name, level) => rows.get(name) ?? rows.set(name, { name, level, fights: 0, wins: 0, losses: 0, stalls: 0, dealt: 0, taken: 0, hits: 0, attacks: 0, turns: 0, downs: 0 }).get(name);
const fights = [];
for (const f of files) {
  let list;
  try { list = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
  const level = Number(/^grand-(\d+)/.exec(f)[1]);
  for (const fight of list) {
    if (fight.crashed) continue;
    fights.push({ file: f, level, id: fight.id, winner: fight.winner, rounds: fight.rounds, seconds: fight.seconds, tally: !!fight.hpLoss });
    const aiBy = new Map((fight.ai ?? []).map(a => [a.name, a]));
    const downs = new Map();
    for (const n of fight.down ?? []) downs.set(n, (downs.get(n) ?? 0) + 1);
    const listed = new Set(Object.values(fight.creatures ?? {}).map(c => c.name));
    const extra = (fight.ai ?? []).filter(a => !listed.has(a.name)).map(a => ({ name: a.name, dealt: 0, taken: 0, hits: 0, attacks: a.attacks ?? 0 }));
    for (const c of [...Object.values(fight.creatures ?? {}), ...extra]) {
      if (!/^L\d+ /.test(c.name)) continue;                          // only generated builds (not the Bestiary monsters)
      // The first level 15 run named Light Armor "Light" and Creation School "Creation" (the Wonders' names): those two rows mixed two builds, so they're left out.
      if (/^grand-15-p\d+\.json$/.test(f) && /^L15 (Light|Creation)$/.test(c.name)) continue;
      const ai = aiBy.get(c.name) ?? {};
      const side = ai.side ?? "party";
      // That run also named Heavy, Medium and Titanic Armor without "Armor": they're the same builds as the later runs' armor rows.
      const name = /^grand-15-p\d+\.json$/.test(f) ? c.name.replace(/^L15 (Heavy|Medium|Titanic)( B)?$/, "L15 $1 Armor$2") : c.name;
      const r = row(name.replace(/ B$/, ""), level);          // a filler "B" build is the same tree
      r.fights++;
      if (fight.winner === "unfinished") r.stalls++;
      else if (fight.winner === side) r.wins++;
      else r.losses++;
      const tally = fight.hpLoss;
      r.dealt += tally ? tally.dealt?.[c.name] ?? 0 : c.dealt ?? 0; r.taken += tally ? tally.taken?.[c.name] ?? 0 : c.taken ?? 0;
      r.hits += c.hits ?? 0; r.attacks += c.attacks ?? 0; r.turns += ai.turns ?? 0;
      if (downs.get(c.name)) { r.downs++; downs.set(c.name, downs.get(c.name) - 1); }
    }
  }
}
const builds = [...rows.values()].map(r => {
  const tree = r.name.replace(/^L\d+ /, "").replace(/ B$/, "");
  return { ...r, tree, arch: archOf(tree), dpt: r.turns ? r.dealt / r.turns : 0, apt: r.turns ? r.attacks / r.turns : 0, hitRate: r.attacks ? r.hits / r.attacks : null,
    survive: r.fights ? 1 - r.downs / r.fights : 0, winRate: r.wins + r.losses ? r.wins / (r.wins + r.losses) : null, takenPer: r.fights ? r.taken / r.fights : 0 };
});
const fmt = (n, d = 0) => (n === null || n === undefined || !Number.isFinite(n) ? "-" : n.toFixed(d));
let md = `# Grand balance pass\n\n${fights.length} fights from ${files.length} files.\n`;
for (const level of [15, 60]) {
  const list = builds.filter(r => r.level === level).sort((a, b) => b.dpt - a.dpt);
  if (!list.length) continue;
  const lf = fights.filter(f => f.level === level);
  const by = g => lf.filter(f => f.id.startsWith(g));
  const sum = g => { const x = by(g); return `${x.length} fights: party won ${x.filter(f => f.winner === "party").length}, other side ${x.filter(f => f.winner === "monsters").length}, unfinished (15 rounds) ${x.filter(f => f.winner === "unfinished").length}; average ${fmt(x.reduce((s, f) => s + f.rounds, 0) / Math.max(1, x.length), 1)} rounds`; };
  const med = list.map(r => r.dpt).sort((a, b) => a - b)[Math.floor(list.length / 2)] || 1;
  md += `\n## Level ${level}\n\nMirrors: ${sum("mirror")}. Bestiary: ${sum("bestiary")}.\n\nMedian damage per turn ${fmt(med, 1)}.\n\n| Build | Archetype | Fights | Win % (decided) | Dmg/turn | vs median | Attacks/turn | Hit % | Taken/fight | Survived % |\n|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const r of list) md += `| ${r.tree} | ${r.arch} | ${r.fights} | ${fmt(r.winRate === null ? null : 100 * r.winRate)} | ${fmt(r.dpt, 1)} | ${fmt(r.dpt / med, 2)}× | ${fmt(r.apt, 1)} | ${fmt(r.hitRate === null ? null : 100 * r.hitRate)} | ${fmt(r.takenPer)} | ${fmt(100 * r.survive)} |\n`;
  for (const a of Object.values(ARCH)) {
    const x = list.filter(r => r.arch === a);
    if (x.length) md += `\n${a}: ${x.length} builds, mean damage per turn ${fmt(x.reduce((s, r) => s + r.dpt, 0) / x.length, 1)}, mean survival ${fmt(100 * x.reduce((s, r) => s + r.survive, 0) / x.length)}%.`;
  }
  md += "\n";
}
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
if (arg("--md")) fs.writeFileSync(arg("--md"), md);
if (arg("--json")) fs.writeFileSync(arg("--json"), JSON.stringify({ fights, builds }, null, 1));
console.log(md);
