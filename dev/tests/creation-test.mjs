import assert from "node:assert/strict";
import * as c from "../../module/creation.mjs";
const R = c.DEFAULT_RULES;
const stats = { str: 30, dex: 10, con: 20, pon: 0, snap: 5, will: 10, reach: 0, grasp: 5, build: 10 }; // 90
const good = { name: "Kara", stats, items: [c.newSlot("weapon", "uncommon"), c.newSlot("armor", "uncommon")] };
assert.deepEqual(c.validate(good, R), []);
assert.equal(c.statTotal(stats), 90);
// Materials filtered by weight AND rarity cap
const heavyUncommon = Object.keys(c.allowedMaterials("weapon", "heavy", "uncommon"));
assert.ok(heavyUncommon.includes("iron") && heavyUncommon.includes("steel") && !heavyUncommon.includes("scarletite") && !heavyUncommon.includes("hardwood"));
assert.deepEqual(Object.keys(c.allowedMaterials("weapon", "light", "common")), ["hardwood", "softwood", "bone"]);
// Changing weight fixes an invalid material
assert.equal(c.normalizeSlot({ kind: "weapon", type: "bladed", weight: "heavy", material: "hardwood" }, "uncommon").material, "iron");
// Errors
const bad = c.validate({ name: " ", stats: { ...stats, str: 31 }, items: [
  { kind: "weapon", type: "bladed", weight: "light", material: "scarletite" },
  { kind: "armor", weight: "light", material: "cloth" }, { kind: "armor", weight: "light", material: "cloth" },
  { kind: "weapon", type: "unarmed", weight: "light", material: "hardwood" } ] }, { ...R, items: 3 });
console.log(bad.join("\n"));
assert.equal(bad.length, 6);
assert.ok(c.validate({ name: "x", stats: { ...stats, str: -1 }, items: [] }, R).some(e => e.includes("0 or more")));
// Actor data
const data = c.buildActorData({ ...good, stats: { ...stats, str: 20 } }, R, "U1");
assert.equal(data.system.unspentStats, 10); assert.equal(data.system.skillPoints, 30); assert.equal(data.system.creation, false);
assert.deepEqual(data.ownership, { default: 0, U1: 3 });
console.log("items:", data.items.map(i => i.name).join(", "));
const p = c.preview(good, R); console.log("preview:", JSON.stringify({ hp: p.hp, energy: p.energy, move: p.move, atk: p.attackDie, dodge: p.dodgeDie }));
console.log("creation tests passed");
{ const d = c.buildActorData({ ...good, items: [] }, R, "U1"); if (!(d.items.length === 1 && d.items[0].system.weaponType === "unarmed" && d.items[0].system.equipped && d.items[0].system.secondHand)) throw new Error("FAIL wizard actor without weapons has no Unarmed"); console.log("  PASS wizard actor starts with Unarmed"); }
{ // Starting magic gear, Affixes, and ammunition.
  const slots = [
    { kind: "weapon", type: "rapid", weight: "light", material: "hardwood" },
    { kind: "weapon", type: "rapid", weight: "light", material: "hardwood" },
    { kind: "shroud", shroudType: "bastion" },
    { kind: "affix", affix: "agate", side: "defensive" }
  ];
  const R4 = { ...R, items: 4, maxRarity: "uncommon" };
  const errs = c.validate({ ...good, items: slots }, R4);
  if (errs.length) throw new Error("FAIL valid magic picks rejected: " + errs.join("; "));
  const items = c.startingItems(slots, R4);
  const ammo = items.filter(i => i.system.ammoType === "rapid");
  const shroud = items.find(i => i.type === "shroud");
  if (!(ammo.length === 1 && ammo[0].system.quantity === 40)) throw new Error("FAIL two Rapid weapons should give 40 Rapid ammo");
  const gem = items.find(i => i.type === "affix");
  if (!(shroud.system.attuned && !shroud.system.affixes && gem && gem.system.affix === "agate" && gem.system.side === "defensive" && gem.system.attuned)) throw new Error("FAIL Affix should be its own attuned item on the Defensive form");
  console.log("  PASS 2 Rapid weapons → 40 Rapid ammo; the Affix is an attuned Defensive item");
  const bad = c.validate({ ...good, items: [{ kind: "affix", affix: "agate", side: "sideways" }] }, R4);
  if (!bad.some(e => /Offensive or Defensive/.test(e))) throw new Error("FAIL an Affix needs a form");
  const alone = c.validate({ ...good, items: [{ kind: "affix", affix: "agate", side: "offensive" }] }, R4);
  if (alone.length) throw new Error("FAIL an Affix needs no Foci or Shroud: " + alone.join("; "));
  const rare = c.validate({ ...good, items: [{ kind: "foci", fociType: "rod" }, { kind: "affix", affix: "diamond", side: "offensive" }] }, R4);
  if (!rare.some(e => /above/.test(e))) throw new Error("FAIL rare Affix above the cap should be rejected");
  const slot = c.newSlot("affix", "uncommon");
  if (!(slot.side === "offensive" && slot.affix && c.normalizeSlot({ ...slot, side: "x" }, "uncommon").side === "offensive")) throw new Error("FAIL new Affix slots default to the Offensive form");
  console.log("  PASS Affix rules (their own form, rarity cap, no Foci or Shroud needed)");
}
// The wizards' tier descriptions: a sentence or two, the Energy cost pulled out, the full text kept for the tooltip.
{
  const b = c.entryBlurb({ name: "Parry", text: "Cost: Energy equal to your Scaling Stat. At any time on your turn, you can activate this ability with a held Weapon to enable it to Parry incoming attacks until the start of your next turn. While Parrying, that Weapon's Limit applies to every incoming attack. More text follows here that is long." });
  assert.equal(b.name, "Parry");
  assert.equal(b.cost, "your Scaling Stat");
  assert.ok(b.text.startsWith("At any time on your turn") && !b.text.includes("Cost:") && b.text.length <= 175 && /…$/.test(b.text), b.text);
  assert.ok(b.full.startsWith("Cost: Energy equal to your Scaling Stat."));
  const short = c.entryBlurb({ name: "Bloom", text: "Gives 50 temp HP." });
  assert.equal(short.text, "Gives 50 temp HP.");
  assert.equal(short.cost, "");
  console.log("  PASS Tier descriptions in the wizards: first sentences, cost apart, full text kept");
}
