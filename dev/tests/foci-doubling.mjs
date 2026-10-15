// Shard / Orb / Band double one Offensive Affix: the Foci side honours it for stack and range numbers too.
import { installFoundry } from "./support/foundry.mjs";
installFoundry({ roll: () => 10 });
const F = await import("../../module/foci.mjs");
const FX = await import("../../module/spellfx.mjs");
let fails = 0; const ok2 = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const attacker = { getFlag: () => undefined };
const ds = (affixes, doubled, type, extra = {}) => F.damageStacks({ attacker, o: { spell: { cores: ["magic-heat:flame"], fociFx: { affixes, doubled, element: "heat", ...extra } } }, type }).stacks;
console.log("== Foci Affix doubling");
ok2(ds(["jasper"], null, "physical") === 1 && ds(["jasper"], "jasper", "physical") === 2 && ds(["jasper"], "jasper", "heat") === -2, "Jasper: Physical doubly Strengthened, other damage doubly Weakened, when doubled");
ok2(ds(["tourmaline"], "tourmaline", "heat") === 2 && ds(["tourmaline"], "jasper", "heat") === 1, "Tourmaline doubles only when it is the chosen Affix");
ok2(FX.normalRange("Ranged", { affixes: ["quartz"], doubled: null }) === 300 && FX.normalRange("Ranged", { affixes: ["quartz"], doubled: "quartz" }) === 400, "Quartz: +50% Ranged range, +100% when doubled");
if (fails) { console.log(`${fails} FAILED`); process.exit(1); }
