// Runs every harness in tests/ with Node and reports failures. Usage: npm test (from dev/), or node run-tests.mjs [name...]
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "tests");
const only = process.argv.slice(2);
const files = readdirSync(dir).filter(f => f.endsWith(".mjs") && !f.startsWith(".") && (!only.length || only.some(o => f.includes(o)))).sort();
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [join(dir, f)], { encoding: "utf8", timeout: 120000 });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const bad = r.status !== 0 || /\bFAIL\b|Error/.test(out);
  if (bad) {
    failed++;
    console.log(`✗ ${f}`);
    for (const line of out.split("\n").filter(l => /\bFAIL\b|Error/.test(l)).slice(0, 10)) console.log(`    ${line.trim()}`);
  } else console.log(`✓ ${f}`);
}
console.log(`\n${files.length - failed}/${files.length} passed`);
process.exit(failed ? 1 : 0);
