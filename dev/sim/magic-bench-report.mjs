/**
 * The Magic school benchmark (`magic-bench`): per school, HP the three raiders lost in 4 rounds (direct hits, burns and the rest: afflictions,
 * Force), what they dealt the punching bag, and what the caster spent its turns on. `node dev/sim/magic-bench-report.mjs [--json]`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const R = await import("./roster.mjs");
const runs = JSON.parse(readFileSync(join(here, "results", "magic-bench.json"), "utf8")).filter(r => !r.crashed);
const configs = R.PASSES["magic-bench"].party[0].loadouts;
const MONSTER = /Raider/;
const rows = [];
for (const c of configs) {
  const mine = runs.filter(r => r.id.replace(/-\d+$/, "") === c.id);
  if (!mine.length) continue;
  const avg = f => mine.reduce((n, r) => n + f(r), 0) / mine.length;
  const hpOf = (r, re) => Object.entries(r.hp ?? {}).filter(([k]) => re.test(k)).reduce((n, [, v]) => { const [cur, max] = v.split("/").map(Number); return n + Math.max(0, max - Math.max(0, cur)); }, 0);
  const direct = r => (r.creatures ?? []).filter(x => MONSTER.test(x.name)).reduce((n, x) => n + x.taken, 0);
  const lost = r => r.lostBy?.monsters ?? hpOf(r, MONSTER);
  const used = {};
  for (const r of mine) for (const a of r.ai ?? []) if (a.name === "Sim Caster") for (const [k, v] of Object.entries(a.used ?? {})) if (/^(cast|made|mod):/.test(k)) used[k] = (used[k] ?? 0) + v;
  rows.push({
    id: c.id, label: c.label, fights: mine.length,
    lost: Math.round(avg(lost)), direct: Math.round(avg(direct)), burn: Math.round(avg(r => r.burn?.monsters ?? 0)), other: Math.round(avg(r => r.otherLoss?.monsters ?? 0)),
    bag: Math.round(avg(r => hpOf(r, /^Sim Bag/))), caster: Math.round(avg(r => hpOf(r, /^Sim Caster/))), down: avg(r => (r.down ?? []).filter(n => MONSTER.test(n)).length),
    rounds: avg(r => r.rounds), used: Object.entries(used).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k.replace(/^cast:/, "")} ${v}`).join(", ")
  });
}
if (process.argv.includes("--json")) { console.log(JSON.stringify(rows)); process.exit(0); }
const pad = (v, n) => String(v).padEnd(n), num = (v, n) => String(v).padStart(n);
console.log(`${pad("school", 22)}${num("lost", 6)}${num("hit", 6)}${num("burn", 6)}${num("other", 6)}${num("bag", 6)}${num("me", 6)}${num("down", 6)}  what it cast`);
for (const r of rows) console.log(`${pad(r.label, 22)}${num(r.lost, 6)}${num(r.direct, 6)}${num(r.burn, 6)}${num(r.other, 6)}${num(r.bag, 6)}${num(r.caster, 6)}${num(r.down.toFixed(1), 6)}  ${r.used}`);
