/**
 * Tabulate a Magic pass: `node dev/sim/magic-report.mjs magic-t3` (several ids at once work too).
 * Per fight: winner, rounds, survivors, each side's HP lost (direct hits, stack burns, the rest). Then per spell (party and monsters apart):
 * casts, hits, damage, damage per cast; and per party caster: turns, casts, creations, healing, how it was spent.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const MONSTER = /Goblin|Raider|Ogre/;
const pad = (v, n) => String(v).padEnd(n);
const num = (v, n) => String(v).padStart(n);

for (const id of process.argv.slice(2).length ? process.argv.slice(2) : ["magic-t1"]) {
  const file = join(here, "results", `${id}.json`);
  if (!existsSync(file)) { console.log(`${id}: no results`); continue; }
  const runs = JSON.parse(readFileSync(file, "utf8")).filter(r => !r.crashed);
  console.log(`\n=== ${id}: ${runs.length} fights ===`);
  console.log(`${pad("fight", 12)}${pad("winner", 10)}${num("rnd", 4)}${num("pty", 4)}${num("mon", 4)}   party lost (hit/burn/other)   monsters lost (hit/burn/other)`);
  for (const r of runs) {
    // Older passes have no burn data: what a side lost beyond its direct damage taken is all "other" there.
    const lost = { party: 0, monsters: 0 }, taken = { party: 0, monsters: 0 };
    for (const [k, v] of Object.entries(r.hp ?? {})) { const [cur, max] = v.split("/").map(Number); lost[MONSTER.test(k) ? "monsters" : "party"] += Math.max(0, max - Math.max(0, cur)); }
    for (const c of r.creatures ?? []) taken[MONSTER.test(c.name) ? "monsters" : "party"] += c.taken;
    const side = s => {
      const burn = r.burn?.[s] ?? 0, other = r.otherLoss?.[s] ?? Math.max(0, lost[s] - taken[s] - burn);
      return `${r.lostBy?.[s] ?? lost[s]} (${r.directTaken?.[s] ?? taken[s]}/${burn}/${other})`;
    };
    console.log(`${pad(r.id, 12)}${pad(r.winner, 10)}${num(r.rounds, 4)}${num(r.partyLeft, 4)}${num(r.monstersLeft, 4)}   ${pad(side("party"), 30)}${side("monsters")}`);
  }
  const wins = runs.filter(r => r.winner === "party").length;
  console.log(`party wins ${wins}/${runs.length}, mean rounds ${(runs.reduce((n, r) => n + r.rounds, 0) / Math.max(1, runs.length)).toFixed(1)}`);

  // Spells and creations by side.
  // Passes from before the monsters' rows were split (" [M]") show one table for both sides.
  const split = runs.some(r => Object.keys(r.weapons ?? {}).some(k => k.endsWith(" [M]")));
  for (const s of split ? ["party", "monsters"] : ["both sides"]) {
    const agg = {};
    for (const r of runs) for (const [k, w] of Object.entries(r.weapons ?? {})) {
      const mine = !split ? "both sides" : k.endsWith(" [M]") ? "monsters" : "party";
      if (mine !== s) continue;
      const a = (agg[k] ??= { attacks: 0, hits: 0, damage: 0, ap: 0, users: new Set() });
      a.attacks += w.attacks + w.followups; a.hits += w.hits; a.damage += w.damage; a.ap += w.ap; w.users.forEach(u => a.users.add(u));
    }
    console.log(`\n${s} spells (direct damage only)`);
    for (const [k, a] of Object.entries(agg).sort((x, y) => y[1].damage - x[1].damage))
      console.log(`  ${pad(k.replace(/^Spell: /, "").replace(/ \[M\]$/, ""), 34)}${num(a.attacks, 5)} casts${num(a.hits, 5)} hits${num(a.damage, 7)} dmg${num((a.damage / Math.max(1, a.attacks)).toFixed(1), 7)}/cast  ${[...a.users].slice(0, 4).join(", ")}`);
  }
  console.log("\nparty casters");
  const by = {};
  for (const r of runs) for (const a of r.ai ?? []) {
    if (a.side !== "party" || a.role === "creation") continue;
    const b = (by[a.name] ??= { turns: 0, casts: 0, creations: 0, creationHp: 0, healed: 0, used: {} });
    b.turns += a.turns; b.casts += a.casts ?? 0; b.creations += a.creations ?? 0; b.creationHp += a.creationHp ?? 0; b.healed += a.healed ?? 0;
    for (const [k, v] of Object.entries(a.used ?? {})) if (/^(cast|made|mod):/.test(k)) b.used[k] = (b.used[k] ?? 0) + v;
  }
  for (const [n, b] of Object.entries(by)) {
    const top = Object.entries(b.used).sort((x, y) => y[1] - x[1]).slice(0, 7).map(([k, v]) => `${k} ${v}`).join(", ");
    console.log(`  ${pad(n.replace(/^Sim /, ""), 14)}${num(b.turns, 4)} turns${num(b.casts, 4)} casts${b.creations ? ` ${b.creations} made (${Math.round(b.creationHp / b.creations)} HP each)` : ""}${b.healed ? ` healed ${b.healed}` : ""}  ${top}`);
  }
}
