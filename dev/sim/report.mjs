// Combat sim report (dev only): node dev/sim/report.mjs [results.json] → Markdown tables per fight, per weapon and per armor.
import { readFileSync } from "node:fs";

const file = process.argv[2] ?? new URL("./results/martial-baseline.json", import.meta.url);
const runs = JSON.parse(readFileSync(file, "utf8")).filter(r => !r.crashed);
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "–");
const r1 = n => (Number.isFinite(n) ? Math.round(n * 10) / 10 : "–");

const out = [];
out.push(`# Sim report: ${runs.length} fights`, "");
out.push("| Fight | Winner | Rounds | Party left | Foes left | Follow-ups | Errors | Warnings |", "|---|---|---|---|---|---|---|---|");
for (const r of runs) out.push(`| ${r.id} | ${r.winner} | ${r.rounds} | ${r.partyLeft}/5 | ${r.monstersLeft} | ${r.followups} | ${r.log.errors.length} | ${r.log.notes.length} |`);

// Weapons over every fight.
const W = {};
for (const r of runs) for (const [k, v] of Object.entries(r.weapons)) {
  const w = (W[k] ??= { attacks: 0, followups: 0, hits: 0, crits: 0, misses: 0, damage: 0, ap: 0, kills: 0, users: new Set(), fights: 0 });
  for (const f of ["attacks", "followups", "hits", "crits", "misses", "damage", "ap", "kills"]) w[f] += v[f];
  v.users.forEach(u => w.users.add(u));
  w.fights++;
}
out.push("", "## Weapons", "", "Damage is what reached HP (after armor). Per AP counts the attacks' AP (follow-ups are free).", "",
  "| Weapon | Users | Attacks (+free) | Hit | Crit | Dmg to HP | Per hit | Per AP | Kills |", "|---|---|---|---|---|---|---|---|---|");
for (const [k, w] of Object.entries(W).sort((a, b) => a[0].localeCompare(b[0]))) {
  const swings = w.hits + w.misses;
  out.push(`| ${k} | ${[...w.users].join(", ")} | ${w.attacks} (+${w.followups}) | ${pct(w.hits, swings)} | ${pct(w.crits, w.hits)} | ${w.damage} | ${r1(w.damage / (w.hits || NaN))} | ${r1(w.damage / (w.ap || NaN))} | ${w.kills} |`);
}

// Armor.
const AR = {};
for (const r of runs) for (const [k, v] of Object.entries(r.armor ?? {})) { const a = (AR[k] ??= { hits: 0, absorbed: 0 }); a.hits += v.hits; a.absorbed += v.absorbed; }
out.push("", "## Armor", "", "| Armor | Hits absorbed | Total absorbed | Per hit |", "|---|---|---|---|");
for (const [k, a] of Object.entries(AR).sort((x, y) => y[1].absorbed - x[1].absorbed)) out.push(`| ${k} | ${a.hits} | ${a.absorbed} | ${r1(a.absorbed / a.hits)} |`);

// Abilities and options the AI used (tree abilities, defenses, dialog options), with who used them.
const used = {}, by = {};
for (const r of runs) {
  for (const [k, v] of Object.entries(r.used ?? {})) used[k] = (used[k] ?? 0) + v;
  for (const a of r.ai ?? []) for (const k of Object.keys(a.used ?? {})) (by[k] ??= new Set()).add(a.name.replace(/^Sim /, ""));
}
if (Object.keys(used).length) {
  out.push("", "## Abilities used", "", "`opt:` = an attack-dialog option the AI ticked; `defend:` = its defense; `:skipped` = offered but not affordable.", "",
    "| Ability | Times | By |", "|---|---|---|");
  for (const [k, v] of Object.entries(used).sort((a, b) => a[0].localeCompare(b[0]))) out.push(`| ${k} | ${v} | ${[...(by[k] ?? [])].join(", ")} |`);
}

// Problems seen.
const notes = {}, dialogs = {};
for (const r of runs) {
  for (const n of r.log.notes) notes[n.msg.replace(/\d+/g, "#")] = (notes[n.msg.replace(/\d+/g, "#")] ?? 0) + 1;
  for (const [k, v] of Object.entries(r.log.dialogs)) dialogs[k] = (dialogs[k] ?? 0) + v;
}
out.push("", "## Warnings", "");
for (const [k, n] of Object.entries(notes).sort((a, b) => b[1] - a[1])) out.push(`- ${n}× ${k}`);
out.push("", "## Errors", "");
for (const r of runs) for (const e of r.log.errors) out.push(`- ${r.id}: ${e.split("\n")[0]}`);
console.log(out.join("\n"));
