// The doc text shown in dialogs, tooltips and cards has its bolded numbers worked out for the Spell Power.
import { installFoundry } from "./support/foundry.mjs";
installFoundry({ roll: () => 10 });
const { scaleText } = await import("../../module/spellfx.mjs");
let fails = 0; const ok2 = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
console.log("== scaleText");
const t = (s, p = 3) => scaleText(s, p);
ok2(t("must roll a Build Check and get a 3 or higher, or") === "must roll a Build Check and get a 9 or higher, or", "Check targets scale");
ok2(t("applied 2 times (+1 each stack)") === "applied 6 times (+1 each stack)", "Prolong / Linger counts scale");
ok2(t("a minimum of 2 and 1d12 damage") === "a minimum of 6 and 3d12 damage", "Hold's minimum and dice scale");
ok2(t("within 1 of your guess") === "within 3 of your guess" && t("within 100ft") === "within 100ft", "Telegraph's tolerance scales, plain ranges don't");
ok2(t("3 less energy") === "9 less energy", "Freeze scales");
ok2(t("Grade of 2 Common, Body of 10, 5 points") === "Grade of 6 Common, Body of 30, 15 points", "Grade, Body and pools scale");
ok2(t("Adds 10 to the Power (as if its caster had 10 more scaling stat)") === "Adds 30 to the Power (as if its caster had 30 more scaling stat)", "Amplify scales");
ok2(t("5 or less Power") === "15 or less Power" && t("-3/-6 die size") === "-9/-18 die size", "Rip and both Hex die sizes scale");
if (fails) { console.log(`${fails} FAILED`); process.exit(1); }
