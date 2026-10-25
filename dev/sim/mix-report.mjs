/**
 * The Magic vs Martial pass (`magic-vs-martial`): wins by monster group and type, by party rotation, and each party member's output tagged with its
 * build (Martial, Magic, Hybrid). `node dev/sim/mix-report.mjs [--hybrid | --weave | --join | --t5]` (--t5: Magic Theory T5 hybrids, joined damage).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const R = await import("./roster.mjs");
const P = R.PASSES["magic-vs-martial"];
// `--hybrid`: the hybrid rotation from the re-run (magic-vs-martial-hybrid), the rest from the first pass.
const read = id => JSON.parse(readFileSync(join(here, "results", `${id}.json`), "utf8")).filter(r => !r.crashed);
// `--weave`: the hybrid rotation rebuilt around Weaving (magic-vs-martial-weave).
// `--join`: the Weaving hybrids with the woven spell's damage joining the weapon hit (the prototype, magic-vs-martial-weave-join).
const rerun = process.argv.includes("--t5") ? "magic-vs-martial-weave5" : process.argv.includes("--join") ? "magic-vs-martial-weave-join" : process.argv.includes("--weave") ? "magic-vs-martial-weave" : process.argv.includes("--hybrid") ? "magic-vs-martial-hybrid" : null;
const runs = rerun ? [...read("magic-vs-martial").filter(r => r.rotation !== 2), ...read(rerun)] : read("magic-vs-martial");
const MONSTER = /Goblin|Raider|Ogre/, CREATION = /Summon|Animation/;
const pad = (v, n) => String(v).padEnd(n), num = (v, n) => String(v).padStart(n);

console.log(`${pad("fight", 22)}${pad("winner", 10)}${num("rnd", 4)}${num("pty", 4)}${num("mon", 4)}  party HP left`);
for (const r of runs) {
  let cur = 0, max = 0;
  for (const [k, v] of Object.entries(r.hp)) { if (MONSTER.test(k) || CREATION.test(k)) continue; const [c, m] = v.split("/").map(Number); cur += Math.max(0, c); max += m; }
  console.log(`${pad(r.id, 22)}${pad(r.winner, 10)}${num(r.rounds, 4)}${num(r.partyLeft, 4)}${num(r.monstersLeft, 4)}  ${Math.round(100 * cur / max)}%`);
}
const tally = key => {
  const t = {};
  for (const r of runs) { const k = key(r); const x = (t[k] ??= { n: 0, w: 0, rounds: 0 }); x.n++; x.rounds += r.rounds; if (r.winner === "party") x.w++; }
  return Object.entries(t).map(([k, x]) => `${k} ${x.w}/${x.n} (${(x.rounds / x.n).toFixed(1)} rnd)`).join(" · ");
};
console.log(`\nparty wins ${runs.filter(r => r.winner === "party").length}/${runs.length}`);
console.log(`by monster type: ${tally(r => r.group.split("-")[1])}`);
console.log(`by group: ${tally(r => r.group.split("-")[0])}`);
console.log(`by party rotation: ${tally(r => `r${r.rotation}`)}`);

// Each party member: direct damage dealt per fight, by build. (Burns and afflictions aren't credited to anyone; creations count for their maker.)
console.log("\nparty members (direct damage to HP per fight; a creation's damage counts for its maker)");
const rows = {};
for (const r of runs) {
  const rot = r.rotation - 1;
  for (const p of P.party) {
    const l = p.loadouts[rot];
    const key = `${p.name.replace(/^Sim /, "")} (${l.label})`;
    const row = (rows[key] ??= { fights: 0, dealt: 0, taken: 0, turns: 0, down: 0 });
    row.fights++;
    const me = (r.creatures ?? []).filter(c => c.name === p.name || c.name.startsWith(`${p.name}'s`));
    row.dealt += me.reduce((n, c) => n + c.dealt, 0);
    row.taken += (r.creatures ?? []).find(c => c.name === p.name)?.taken ?? 0;
    row.turns += (r.ai ?? []).find(a => a.name === p.name)?.turns ?? 0;
    row.weaves = (row.weaves ?? 0) + ((r.ai ?? []).find(a => a.name === p.name)?.weaves ?? 0);
    if ((r.down ?? []).includes(p.name)) row.down++;
  }
}
for (const [k, v] of Object.entries(rows)) console.log(`  ${pad(k, 22)}${num(Math.round(v.dealt / v.fights), 6)} dealt${num(Math.round(v.taken / v.fights), 6)} taken${num((v.turns / v.fights).toFixed(1), 6)} turns  down ${v.down}/${v.fights}${v.weaves ? `  ${(v.weaves / v.fights).toFixed(1)} weaves` : ""}`);
