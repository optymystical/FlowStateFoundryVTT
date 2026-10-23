// Source checks the other harnesses can't see: a file that imports the shared DialogV2 helper (html.mjs) must call it (`DialogV2().prompt`), never
// `DialogV2.prompt` (that is undefined on the helper and throws in Foundry).
import fs from "node:fs";
const dir = new URL("../../module/", import.meta.url);
let fails = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".mjs"))) {
  const src = fs.readFileSync(new URL(f, dir), "utf8");
  if (!/import\s*\{[^}]*\bDialogV2\b[^}]*\}\s*from\s*"\.\/html\.mjs"/.test(src)) continue;
  // A local `const { DialogV2 } = foundry.applications.api` shadows the helper on purpose; only lines outside such a scope are suspect,
  // so a file that shadows it is checked by hand.
  if (/const\s*\{[^}]*\bDialogV2\b[^}]*\}\s*=\s*foundry\.applications\.api/.test(src)) continue;
  src.split("\n").forEach((line, i) => {
    if (/\bDialogV2\.(prompt|confirm|wait)\(/.test(line)) { console.log(`  FAIL ${f}:${i + 1} calls DialogV2.${line.match(/DialogV2\.(\w+)/)[1]} without () on the html.mjs helper`); fails++; }
  });
}
console.log(fails ? `${fails} FAILED` : "  PASS every DialogV2 helper call is DialogV2().x");
if (fails) process.exit(1);
