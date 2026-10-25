// Martial Theory automation: parry, riposte, grapple, break free, throw grappled, stances.
import { installFoundry } from "./support/foundry.mjs";
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 });
const { combat } = installFoundry({ roll: () => (seq.length ? seq.shift() : 10), dialog: c => dialog(c), messages, uuids });

const { FlowStateActorData, FlowStateWeaponData, FlowStateShroudData, FlowStateFociData } = await import("../../module/data.mjs");
const actions = await import("../../module/actions.mjs");
const set = (o, k, v) => foundry.utils.setProperty(o, k, v);
function mkActor(name, extra={}, trees={}) {
  const a = { name, uuid: "Actor."+name, isOwner: true, items: [], statuses: new Set(), flags: {} };
  a.items.get = id => a.items.find(i => i.id === id);
  a.update = async u => { for (const [k,v] of Object.entries(u)) set(a, k, v); };
  a.setFlag = async (s,k,v) => set(a.flags, `${s}.${k}`, v);
  a.getFlag = (s,k) => foundry.utils.getProperty(a.flags, `${s}.${k}`);
  a.unsetFlag = async (s,k) => set(a.flags, `${s}.${k}`, undefined);
  a.toggleStatusEffect = async (id, { active }) => { active ? a.statuses.add(id) : a.statuses.delete(id); };
  a.getActiveTokens = () => [];
  a.system = Object.assign(Object.create(FlowStateActorData.prototype), { stats:{str:30,dex:30,con:30,pon:10,snap:10,will:10,reach:10,grasp:10,build:10}, skillPoints:30, unspentStats:0, statCarry:0, trees, size:3, hp:{value:432,lost:0}, energy:{value:50}, ap:{value:6}, rp:{value:6}, conditions:{ignite:0,stain:0,slow:0,haste:0}, lift:0, daysWithoutRest:0, ...extra }, { parent: a });
  a.system.prepareDerivedData(); uuids.set(a.uuid, a); game.actors.push(a);
  combat.combatants.push({ actor: a });
  return a;
}
function mkWeapon(actor, id, sys) {
  const i = { id, name: id, type: "weapon", uuid: `${actor.uuid}.Item.${id}`, parent: actor, actor };
  i.system = Object.assign(Object.create(FlowStateWeaponData.prototype), { weaponType: "bladed", weight: "light", material: "hardwood", grade: 1, twoHanded: false, equipped: true, secondHand: false, loaded: true, rounds: 1, magazine: 1, wear: 0, ...sys }, { parent: i });
  i.update = async u => { for (const [k,v] of Object.entries(u)) set(i, k, v); i.system.prepareDerivedData(); };
  i.system.prepareDerivedData(); actor.items.push(i); uuids.set(i.uuid, i); return i;
}
const text = m => m.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const ok = (c, msg) => console.log(`  ${c ? "PASS" : "FAIL"} ${msg}`);


globalThis.CONFIG = {};

const M = await import("../../module/magic.mjs");
let fails = 0; const ok2 = (c, m) => { ok(c, m); if (!c) fails++; };
function mkShroud(actor, id, sys) {
  const i = { id, name: id, type: "shroud", uuid: `${actor.uuid}.Item.${id}`, parent: actor, actor, isOwner: true };
  i.system = Object.assign(Object.create(FlowStateShroudData.prototype), { shroudType: "bastion", grade: 3, attuned: true, wear: 0, affixes: [], element: "heat", declared: "", lush: false, carapace: 0, negated: [], lastType: "", hitSources: [], placedOn: "", ...sys }, { parent: i });
  i.update = async u => { for (const [k,v] of Object.entries(u)) set(i, k, v); actor.system.prepareDerivedData(); };
  actor.items.push(i); uuids.set(i.uuid, i); actor.system.prepareDerivedData(); return i;
}
const prep = a => a.system.prepareDerivedData();

console.log("== Profiles");
let p = M.fociProfile({ fociType: "staff", grade: 3, affixes: ["quartz", "agate"] }, { reach: 40, grasp: 25 });
ok2(p.valid && p.durability === 90 && p.limit === 18 && p.scalingStat === "grasp" && p.scaling === 25 && p.castAP === "2" && p.freeAffixes === 0 && p.twoHandCast, "Staff: Igniter, base × Grade, Grasp, no extra Free Affixes");
p = M.fociProfile({ fociType: "band", grade: 2 }, { reach: 12, grasp: 30 });
ok2(p.scalingStat === "reach" && p.scaling === 12 && p.doubles && p.tr === null, "Band: Multi uses the lesser stat, 1+ Affix");
p = M.shroudProfile({ shroudType: "bastion", grade: 3, affixes: [] }, 25);
ok2(p.durability === 200 && p.limit === 40 && p.mult === 2, "Bastion: ×floor(Build/10) Grade-capped");
p = M.shroudProfile({ shroudType: "bulwark", grade: 5 }, 50);
ok2(p.durability === 3 && p.limit === 120 && p.negator, "Aegis: fixed Durability, scaling Limit");

console.log("== Shroud soaks before armor");
const hero = mkActor("Mage", {}, {});   // Build 10 + bonus
const b = hero.system.derived.effective.build.value;
const mult = 2 * Math.max(1, Math.floor(Math.min(b, 30) / 10));        // the Bastion's listed Limit is 20: 10 × this
const sh = mkShroud(hero, "Veil", { shroudType: "bastion", grade: 3 });
ok2(hero.system.shroud === sh && sh.system.profile.limit === 10 * mult, `melded Shroud found (Limit ${sh.system.profile.limit})`);
let out = await actions.damageOutcome(hero, 25, "physical", {});
ok2(out.toHp === 25 - 10 * mult && out.shrouds[0].update["system.wear"] === 10 * mult, `Shroud absorbs its Limit (${25 - out.toHp})`);
out = await actions.damageOutcome(hero, 25, "supernatural", {});
ok2(out.toHp === 25 - 10 * mult, "Supernatural is blocked by a Shroud (Rules: Shrouds reduce it as normal)");
// Build Arcana T2's Reactive also Weakens a hit on your own Shroud for 1 RP.
{ hero.system.trees["magic-build-arcana"] = 2; hero.system.rp.value = 3;
  const big = 10 * mult + 30;
  const rx = await actions.damageOutcome(hero, big, "physical", {});
  ok2(rx.toHp === Math.max(0, Math.floor(big / 2) - 10 * mult) && rx.reactive?.includes(hero.uuid), `Reactive on the Shroud: ${big} is Weakened to ${Math.floor(big / 2)} before the Shroud's Limit (${rx.toHp} to HP)`);
  delete hero.system.trees["magic-build-arcana"]; }
out = await actions.damageOutcome(hero, 25, "arcane", {});
ok2(out.toHp === 25 - 10 * mult, "Arcane (Magical) is blocked");
// Arcane on a creature that isn't fully Magical: the Shroud (fully magical) takes it at full strength; what gets past it is Weakened.
out = await actions.damageOutcome(hero, 10 * mult + 30, "arcane", { archetype: "magic", arcaneWeak: 0.5 });
ok2(out.toHp === 15 && out.shrouds[0].absorbed === 10 * mult, `Arcane: the Shroud takes its full Limit (${out.shrouds[0]?.absorbed}), the 30 past it is Weakened to ${out.toHp}`);
// Weaving: a woven hit's two parts share one Limit (spent first on the weapon's part here), and the Shroud's Durability with it.
const spentL = { limit: {}, dur: {} };
const part1 = await actions.damageOutcome(hero, 6, "physical", { limitSpent: spentL });
const part2 = await actions.damageOutcome(hero, 25, "heat", { limitSpent: spentL, archetype: "magic" });
ok2(part1.toHp === 0 && part2.toHp === 25 - (10 * mult - 6), `A woven hit's parts share one Limit: 6 of the weapon's, then ${25 - part2.toHp} of the spell's (Limit ${10 * mult})`);
// A Bash on the weapon's part breaks through a parrying weapon for the whole hit: the woven part passes it too, with no second bonus.
const tank = mkActor("Tank"), parry = mkWeapon(tank, "parry", { weaponType: "defender", weight: "heavy", material: "steel", grade: 2 });
const pL = parry.system.profile.limit, spentB = { limit: {}, dur: {} };
const bashed1 = await actions.damageOutcome(tank, 6, "physical", { limitSpent: spentB, bash: pL, parryItems: [parry.uuid] });
const bashed2 = await actions.damageOutcome(tank, 25, "heat", { limitSpent: spentB, archetype: "magic", parryItems: [parry.uuid] });
const unbashed = await actions.damageOutcome(tank, 25, "heat", { limitSpent: { limit: {}, dur: {} }, archetype: "magic", parryItems: [parry.uuid] });
ok2(bashed1.toHp === 6 + pL && bashed2.toHp === 25 && unbashed.toHp < 25, `A Bash lets the whole woven hit through (${bashed1.toHp} + ${bashed2.toHp})`);
out = await actions.damageOutcome(hero, 25, "physical", { pierce: 5 });
ok2(out.toHp === 25 - (10 * mult - 5), "Pierce lowers the Shroud's Limit");
await sh.update({ "system.affixes": ["painite", "jasper"] });
out = await actions.damageOutcome(hero, 25, "physical", { pierce: 5 });
ok2(out.toHp === Math.max(0, 25 - sh.system.profile.scaling - 10 * mult) && out.shrouds[0].update["system.negated"]?.includes("physical"), `Bastion holds 2 Affixes: Jasper negates ${sh.system.profile.scaling}, Painite ignores Pierce (toHp ${out.toHp})`);
await sh.update({ "system.negated": ["physical"] });
out = await actions.damageOutcome(hero, 25, "physical", {});
ok2(out.toHp === 25 - 10 * mult, "Jasper only once until recovery");
await actions.applyDamage(hero, 25, "physical", { silent: true });
ok2(sh.system.wear === 10 * mult && hero.getFlag("flowstate", "takenTypes")?.includes("physical"), "applyDamage wears the Shroud and records the type");

console.log("== Magic damage is Magical as well as its own type (Rules)");
await sh.update({ "system.affixes": ["agate"], "system.negated": [], "system.wear": 0 });
out = await actions.damageOutcome(hero, 25, "heat", {});
ok2(!out.shrouds[0]?.update?.["system.negated"]?.includes("magical"), "A Heat hit that isn't a spell is only Elemental: Agate (Magical) doesn't touch it");
out = await actions.damageOutcome(hero, 25, "heat", { archetype: "magic" });
ok2(out.shrouds[0]?.update?.["system.negated"]?.includes("magical") && out.toHp < 25 - 10 * mult, `A Heat spell is Magical too: Agate negates ${sh.system.profile.scaling} before the Limit (${25 - out.toHp} absorbed)`);
await sh.update({ "system.affixes": ["agate", "obsidian"], "system.negated": [], "system.wear": 0 });
out = await actions.damageOutcome(hero, 25, "heat", { archetype: "magic" });
ok2(out.shrouds[0]?.update?.["system.negated"]?.includes("magical") && out.shrouds[0].update["system.negated"].includes("elemental"), "…and Obsidian (Elemental) negates it as well: it is blocked by either");
const MART = await import("../../module/martial.mjs");
ok2(MART.damageCategories("heat", true).join() === "elemental,magical" && MART.damageCategories("heat").join() === "elemental" && MART.damageCategories("arcane", true).join() === "magical", "damageCategories");
ok2(MART.limitFactor("heat", { key: "magical", factor: 0.1 }) === 0.1 && MART.limitFactor("heat", { key: "magical", factor: 0.1 }, true) === 1, "A Magical-focus Limit blocks a Heat spell fully, but only a tenth of Heat that isn't from Magic");
await sh.update({ "system.affixes": [], "system.negated": [], "system.wear": 0 });

console.log("== Force damage cap: HP plus what the Shroud soaks, netting negative max HP at most");
await sh.update({ "system.affixes": [], "system.negated": [], "system.wear": 0 });
const hpNow = hero.system.hp.value + hero.system.hp.max;
const cap = await actions.forceCap(hero);
ok2(cap === hpNow + 10 * mult, `Cap = HP + max HP ${hpNow} + the Shroud's Limit ${10 * mult} = ${cap} (not just HP)`);
out = await actions.damageOutcome(hero, cap, "physical", {});
ok2(out.toHp === hpNow, "Taking the capped damage nets them to exactly negative max HP");
out = await actions.damageOutcome(hero, cap + 1, "physical", {});
ok2(out.toHp > hpNow, "One more point would go past negative max HP");

console.log("== Shrouds recover by themselves out of combat");
await sh.update({ "system.wear": 30, "system.negated": ["physical"] });
await actions.refillShroud(hero);
ok2(sh.system.wear === 30, "In combat nothing recovers until the wearer's turn");
const ci = combat.combatants.findIndex(c => c.actor === hero); combat.combatants.splice(ci, 1);
await actions.refillShroud(hero);
ok2(sh.system.wear === 0 && !(sh.system.negated ?? []).length, "Out of combat the Shroud recovers fully (and Affix negations refresh)");
await sh.update({ "system.wear": 30 });
await actions.applyDamage(hero, 5, "physical", { silent: true });
ok2(sh.system.wear === 0, "A hit out of combat is absorbed, then the Shroud recovers right away");
M.SHROUD_TYPES.bastion.noRegen = true; await sh.update({ "system.wear": 30 }); sh.system.prepareDerivedData?.();
await actions.refillShroud(hero);
ok2(sh.system.wear === 30, "A Shroud whose passive says it doesn't naturally recover is left alone");
delete M.SHROUD_TYPES.bastion.noRegen;
combat.combatants.push({ actor: hero });
await sh.update({ "system.affixes": ["painite", "jasper"], "system.negated": ["physical"], "system.wear": 10 * mult });   // back to what the next checks expect

console.log("== Recovery at turn start");
await actions.shroudTurnStart(hero);
ok2(sh.system.wear === 0 && !sh.system.negated.length && !hero.getFlag("flowstate", "takenTypes"), "recovers its Limit, negations refresh, Cinder memory clears");

console.log("== Types");
await sh.update({ "system.shroudType": "bulwark", "system.affixes": [] });
out = await actions.damageOutcome(hero, 5, "physical", {});
ok2(out.toHp === 0 && out.shrouds[0].update["system.wear"] === 1, "Aegis negates damage up to its Limit for 1 Durability");
out = await actions.damageOutcome(hero, 500, "physical", {});
ok2(out.toHp === 500 && !out.shrouds.length, "Aegis: over the Limit isn't blocked");
await sh.update({ "system.shroudType": "cinder" });
const L0 = sh.system.profile.limit;
await hero.setFlag("flowstate", "takenTypes", ["heat"]);
out = await actions.damageOutcome(hero, 200, "heat", {});
ok2(200 - out.toHp === L0 * 3, `Cinder ×3 against a type already taken (${200 - out.toHp})`);
await hero.unsetFlag("flowstate", "takenTypes");
await sh.update({ "system.shroudType": "carapace" });
const cl = sh.system.profile.limit;
await actions.applyDamage(hero, 200, "physical", { silent: true });
ok2(sh.system.carapace === 1 && sh.system.profile.limit === 2 * cl, "Carapace: Limit grows each hit");
await actions.shroudTurnStart(hero);
ok2(sh.system.carapace === 0 && sh.system.profile.limit === cl, "Carapace resets at turn start");
hero.system.energy.value = hero.system.energy.max; await sh.update({ "system.shroudType": "cistern" });
ok2(sh.system.profile.limit === 3 * sh.system.profile.baseLimit, "Cistern ×3 at full Energy");
await sh.update({ "system.shroudType": "bastion", "system.affixes": ["tourmaline", "alexandrite"], "system.element": "heat", "system.wear": 0 });
out = await actions.damageOutcome(hero, 200, "heat", {});
ok2(out.shrouds[0].update["system.wear"] === Math.floor(10 * mult / 2) && out.shrouds[0].update["system.lastType"] === "heat", "Tourmaline: chosen element Weakened on the Shroud; Alexandrite remembers the type");
await sh.update({ "system.lastType": "heat" });
out = await actions.damageOutcome(hero, 200, "heat", {});
ok2(out.lines.some(l => /Alexandrite: Weakened 200 → 100/.test(l)), "Alexandrite: same type again is Weakened");

console.log("== Ward on an ally");
const ally = mkActor("Ally", {}, {});
await sh.update({ "system.shroudType": "mantle", "system.affixes": [], "system.lastType": "" });
game.user.targets = new Set([{ actor: ally }]); hero.system.rp.value = 6;
await actions.placeShroud(hero);
ok2(sh.system.placedOn === ally.uuid && ally.getFlag("flowstate", "shroudOn") === sh.uuid && hero.system.rp.value === 4, "Ward placed on the ally (2 RP)");
out = await actions.damageOutcome(ally, 50, "physical", {});
ok2(out.toHp < 50, "the ally's damage is soaked by the Ward");
out = await actions.damageOutcome(hero, 50, "physical", {});
ok2(out.toHp === 50, "the wearer isn't protected by a Ward placed elsewhere");
await actions.shroudTurnStart(hero);
ok2(!sh.system.placedOn && !ally.getFlag("flowstate", "shroudOn"), "the Ward ends at the start of the wearer's turn");

console.log("== Musgravite / Black Opal");
await sh.update({ "system.shroudType": "bastion", "system.affixes": ["musgravite", "blackOpal"] });
ok2(actions.musgraviteNegate(hero) === sh.system.profile.scaling, "Musgravite negates Scaling Stat Force");
ok2(actions.shroudAttackNet(ally, hero, { melee: true }) === -1, "Black Opal: Disadvantage for attackers in melee range");

console.log("== Exchange: Retort, Riposte, Ruby");
const foe = mkActor("Foe", {}, {});
const axe = mkWeapon(foe, "Axe", { weaponType: "bladed", weight: "light", material: "iron", grade: 3 });
const fo = { label: "Axe", net: 0, melee: true, damage: "2d10", type: "physical", stacks: 0, physical: true, shots: 1, notes: [], followups: [], itemUuid: axe.uuid, targetActors: [hero] };
await sh.update({ "system.shroudType": "retort", "system.affixes": [], "system.wear": 0 });
hero.system.rp.value = 6;
seq = [30]; await actions.performAttack(foe, fo);
dialog = () => ({ net: 0, extra: 0 }); await actions.defend(messages.at(-1), 0, "none");
const dm = messages.at(-1);
ok2(dm.content.includes("fs-retort"), "Retort offered after a hit");
await actions.retort(dm);
ok2(hero.system.rp.value === 5 && actions.findRetort(dm.id), "Retort: 1 RP");
seq = [20]; await actions.rollExchangeDamage(dm);
ok2(/Retort/.test(text(messages.at(-1))), "Retort Weakens the damage");
await sh.update({ "system.shroudType": "rebuke", "system.affixes": ["ruby"], "system.wear": 0 });
seq = [30]; await actions.performAttack(foe, fo);
await actions.defend(messages.at(-1), 0, "none");
seq = [20]; await actions.rollExchangeDamage(messages.at(-1));
const dmg = messages.at(-1);
ok2(dmg.content.includes('data-kind="rebuke"') && dmg.content.includes('data-kind="ruby"'), "damage card offers Shroud Rebuke and Ruby");
const took = Number(dmg.content.match(/data-kind="ruby" data-amount="(\d+)"/)?.[1]);
seq = [25]; await actions.shroudCounter(dmg, "ruby", took);
const ra = messages.at(-1);
ok2(ra.flags.flowstate.attack.opts.inflict?.ignite === took, "Ruby: free attack carrying the Ignite");
const ig0 = foe.system.conditions.ignite;
dialog = () => ({ net: 0 }); seq = [2]; await actions.defend(ra, 0, "dodge");
ok2(foe.system.conditions.ignite === ig0 + took, `Ruby hit: +${took} Ignite`);
await actions.shroudCounter(dmg, "ruby", took);

console.log("== Durability caps the soak");
await sh.update({ "system.shroudType": "bastion", "system.affixes": [], "system.placedOn": "" });
await sh.update({ "system.wear": sh.system.durability.max - 3 });
out = await actions.damageOutcome(hero, 40, "physical", {});
ok2(out.toHp === 37 && out.shrouds[0].update["system.wear"] === sh.system.durability.max, `Shroud with 3 Durability left absorbs only 3 (toHp ${out.toHp})`);
await sh.update({ "system.wear": sh.system.durability.max });
out = await actions.damageOutcome(hero, 40, "physical", {});
ok2(out.toHp === 40, "at 0 Durability it stops blocking");
{ const { soak } = await import("../../module/martial.mjs");
  const r = soak(40, "physical", { valid: true, limit: 40 }, { durability: 20 });
  ok2(r.absorbed === 20 && r.toHp === 20, "armor soak: Limit 40, Durability 20 → 20 through"); }
console.log("== Edge distance");
globalThis.canvas = { grid: { size: 100, distance: 5 } };
const T = (x, y, w = 1) => ({ document: { x, y, width: w, height: w } });
ok2(actions.tokenDistance(T(0, 0), T(100, 0)) === 0 && actions.tokenDistance(T(0, 0), T(100, 100)) === 0, "touching tokens (side or diagonal) are 0 ft apart");
ok2(actions.tokenDistance(T(0, 0), T(200, 0)) === 5 && actions.tokenDistance(T(0, 0), T(25, 25, 0.25)) === 0, "one square gap = 5 ft; a small token inside reach");
ok2(actions.tokenDistance(T(0, 0, 2), T(300, 0)) === 5, "large tokens measure from their border");
globalThis.canvas = null;
process.exit(fails ? 1 : 0);
