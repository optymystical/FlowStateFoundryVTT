import { weaponProfile } from "../../module/martial.mjs";
for (const [grade, str, weight] of [[3, 30, "heavy"], [3, 12, "heavy"], [1, 60, "light"], [5, 60, "light"]]) {
  const p = weaponProfile({ type: "improvised", weight, material: "", grade }, { str, dex: str });
  console.log(`G${grade} stat ${str} ${weight}:`, p.valid, p.formula, "| AP", p.ap, "| tags", JSON.stringify(p.tags), "| throw", p.throwType, "| limit", p.limit, "| dur", p.durability, "| improvised", p.improvised);
}
const two = weaponProfile({ type: "improvised", weight: "heavy", grade: 2, twoHanded: true }, { str: 40, dex: 0 });
console.log("2H G2 str40:", two.formula);
