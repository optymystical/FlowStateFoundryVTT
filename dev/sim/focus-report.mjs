// Tables for the focused passes (dev only): node dev/sim/focus-report.mjs [bench|shield|kite]
// Reads dev/sim/results/focus-<name>.json and prints Markdown.
import { readFileSync } from "node:fs";

const load = name => { try { return JSON.parse(readFileSync(new URL(`./results/focus-${name}.json`, import.meta.url), "utf8")); } catch { return []; } };
const RETEST_FILE = process.argv[3] ?? "retest";
const pct = (a, b) => (b ? `${Math.round(100 * a / b)}%` : "–");
const hpOf = (r, who) => {
  const [k, v] = Object.entries(r.hp ?? {}).find(([k]) => k.startsWith(who)) ?? [];
  if (!k) return null;
  const [a, b] = v.split("/").map(Number);
  return Math.max(0, a) / b;
};
const sum = (rows, f) => rows.reduce((n, r) => n + f(r), 0);
const errs = rows => rows.filter(r => r.crashed || r.log?.errors?.length).map(r => `- ${r.id}: ${r.crashed ?? r.log.errors[0]}`);

function bench() {
  const rows = load("bench");
  const by = {};
  for (const r of rows) {
    const [, cfg, armor] = r.id.match(/^(.*)-(light|heavy|cluster)$/) ?? [];
    const w = Object.values(r.weapons ?? {});
    const x = (by[cfg] ??= {});
    // Damage = the HP the dummies lost (it includes Knockback Force damage, which the weapon tables of older results miss).
    const lost = Object.entries(r.hp ?? {}).filter(([k]) => k.startsWith("Sim Dummy")).reduce((t, [, v]) => { const [a, b] = v.split("/").map(Number); return t + b - Math.max(0, a); }, 0);
    x[armor] = { dmg: lost, ap: sum(w, v => v.ap), attacks: sum(w, v => v.attacks), free: sum(w, v => v.followups), hits: sum(w, v => v.hits),
      kill: r.winner === "party" ? r.rounds : null, ql: (r.used?.["followup:quickload"] ?? 0), noRP: r.used?.["followup:noRP"] ?? 0 };
  }
  const per = c => (c && c.ap ? (c.dmg / c.ap).toFixed(1) : "–");
  const out = ["# Weapon benchmark", "", "HP the dummy lost per AP of paid attacks (Knockback Force damage included) against a still dummy (Con 45, Dex 30) for 4 rounds. Light: Soft Leather; Heavy: Iron; Cluster: 3 dummies in Soft Leather.", "",
    "| Weapon | vs Light: per AP | hit | vs Heavy: per AP | hit | Free follow-ups | Quickload follow-ups | Cluster per AP |", "|---|---|---|---|---|---|---|---|"];
  const order = Object.keys(by).sort((a, b) => (Number(per(by[b].light)) || 0) - (Number(per(by[a].light)) || 0));
  for (const cfg of order) {
    const { light, heavy, cluster } = by[cfg];
    const all = [light, heavy].filter(Boolean);
    out.push(`| ${cfg} | ${per(light)} | ${light ? pct(light.hits, light.attacks + light.free) : "–"} | ${per(heavy)} | ${heavy ? pct(heavy.hits, heavy.attacks + heavy.free) : "–"} | ${sum(all, c => c.free)} | ${sum(all, c => c.ql)} | ${per(cluster)} |`);
  }
  return [...out, "", ...errs(rows)].join("\n");
}

function shield() {
  const rows = load("shield");
  const out = ["# 2H vs 1H + shield (mirror duels)", "", "| Duel | Winner | Rounds | Breaker HP | Rival HP | Breaker dealt | Rival dealt |", "|---|---|---|---|---|---|---|"];
  for (const r of rows) {
    const c = n => r.creatures?.find(x => x.name === n)?.dealt ?? 0;
    const [mine, theirs] = r.id.split("-v-");
    const win = r.winner === "party" ? mine : r.winner === "monsters" ? theirs.replace(/-\d+$/, "") : r.winner;
    out.push(`| ${r.id} | ${win} | ${r.rounds} | ${pct(hpOf(r, "Sim Breaker") ?? 0, 1)} | ${pct(hpOf(r, "Sim Rival") ?? 0, 1)} | ${c("Sim Breaker")} | ${c("Sim Rival")} |`);
  }
  const tally = {};
  for (const r of rows) { const [mine, rest] = r.id.split("-v-"); const theirs = rest.replace(/-\d+$/, ""); const w = r.winner === "party" ? mine : r.winner === "monsters" ? theirs : "draw"; tally[w] = (tally[w] ?? 0) + 1; }
  return [...out, "", `Wins: ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(", ")}`, "", ...errs(rows)].join("\n");
}

function kite() {
  const rows = load("kite");
  const out = ["# Armor vs speed (kiting)", "", "Light Assault kiter (no trees) against a two-handed Heavy Weighted chaser.", "",
    "| Kiter armor | Chaser armor | Fights | Kiter won | Avg rounds | Kiter HP left | Chaser HP left | Kiter dealt | Chaser dealt | Chaser attacks |", "|---|---|---|---|---|---|---|---|---|---|"];
  const groups = {};
  for (const r of rows) { const [, mine, theirs] = r.id.match(/^(\w+)-v-(\w+)-\d+$/) ?? []; (groups[`${mine}|${theirs}`] ??= []).push(r); }
  for (const [k, rs] of Object.entries(groups)) {
    const [mine, theirs] = k.split("|");
    const d = n => sum(rs, r => r.creatures?.find(x => x.name === n)?.dealt ?? 0);
    const att = sum(rs, r => r.creatures?.find(x => x.name === "Sim Chaser")?.attacks ?? 0);
    out.push(`| ${mine} | ${theirs} | ${rs.length} | ${rs.filter(r => r.winner === "party").length} | ${(sum(rs, r => r.rounds) / rs.length).toFixed(1)} | ${pct(sum(rs, r => hpOf(r, "Sim Kiter") ?? 0), rs.length)} | ${pct(sum(rs, r => hpOf(r, "Sim Chaser") ?? 0), rs.length)} | ${d("Sim Kiter")} | ${d("Sim Chaser")} | ${att} |`);
  }
  return [...out, "", ...errs(rows)].join("\n");
}

function retest() {
  const rows = load(RETEST_FILE);
  const cells = {};
  for (const r of rows) {
    const [cfg, group] = r.id.split("~");
    const lost = Object.entries(r.hp ?? {}).filter(([k]) => k.startsWith("Sim Dummy")).reduce((t, [, v]) => { const [a, b] = v.split("/").map(Number); return t + b - Math.max(0, a); }, 0);
    const w = Object.values(r.weapons ?? {});
    const c = ((cells[cfg] ??= {})[group] ??= { lost: 0, ap: 0, force: 0, attacks: 0, hits: 0, free: 0, area: 0, n: 0 });
    c.lost += lost; c.ap += sum(w, v => v.ap); c.force += sum(w, v => v.force ?? 0); c.attacks += sum(w, v => v.attacks); c.free += sum(w, v => v.followups);
    c.hits += sum(w, v => v.hits); c.area += r.used?.["opt:area"] ?? 0; c.n++;
  }
  const per = c => (c?.ap ? (c.lost / c.ap).toFixed(1) : "–");
  const out = ["# Retest", "", "HP the dummies lost per AP of paid attacks (Knockback Force included), 4 rounds, 2 fights per cell. Two-handed = one Strengthened stack (v0.76.0).", "",
    "| Weapon | vs Light | vs Heavy | Force share | Hit | Cluster (armored) | Cluster (bare) | Area shots |", "|---|---|---|---|---|---|---|---|"];
  for (const [cfg, g] of Object.entries(cells)) {
    const all = Object.values(g);
    out.push(`| ${cfg} | ${per(g.light)} | ${per(g.heavy)} | ${pct(sum(all, c => c.force), sum(all, c => c.lost))} | ${pct(sum(all, c => c.hits), sum(all, c => c.attacks + c.free))} | ${per(g.cluster)} | ${per(g.bare)} | ${sum(all, c => c.area)} |`);
  }
  return [...out, "", ...errs(rows)].join("\n");
}

const which = process.argv[2];
const parts = { bench, shield, kite, retest };
console.log((which ? [parts[which]] : Object.values(parts)).map(f => f()).join("\n\n"));
