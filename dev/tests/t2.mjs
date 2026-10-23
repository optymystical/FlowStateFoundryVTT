// Martial Theory automation: parry, riposte, grapple, break free, throw grappled, stances.
import { installFoundry } from "./support/foundry.mjs";
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 });
const { combat } = installFoundry({ roll: () => (seq.length ? seq.shift() : 10), dialog: c => dialog(c), messages, uuids });

const { FlowStateActorData, FlowStateWeaponData } = await import("../../module/data.mjs");
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
globalThis.CONFIG = {}; game.messages.filter = fn => messages.filter(fn);
globalThis.CONFIG = {};
let waitChoice = "quick";
globalThis.foundry.applications.api.DialogV2.wait = async () => waitChoice;
globalThis.foundry.applications.api.DialogV2.confirm = async () => true;
const ab = await import("../../module/abilities.mjs");
const { applyStacks } = await import("../../module/rules.mjs");
const F = () => messages.at(-1).flags.flowstate;
const last = k => [...messages].reverse().find(m => m.flags?.flowstate?.[k]);
function mkArmor(actor, id, weight, limit = 10) {
  const a = { id, name: id, type: "armor", uuid: `${actor.uuid}.Item.${id}`, parent: actor, isOwner: true,
    system: { weight, equipped: true, wear: 0, durability: { value: 200, max: 200 }, profile: { valid: true, limit, focus: null, selfWeakened: 0 } } };
  a.update = async u => { for (const [k,v] of Object.entries(u)) set(a, k, v); a.system.durability.value = 200 - a.system.wear; };
  actor.items.push(a); actor.system.armor = a; uuids.set(a.uuid, a); return a;
}
const trees = { "martial-theory": 5, "martial-strength-methods": 5, "martial-striker-weapons": 5, "martial-defender-weapons": 5,
  "martial-weighted-weapons": 5, "martial-assault-weapons": 5, "martial-heavy-armor": 5 };
const hero = mkActor("Hero", { energy: { value: 5000 } }, trees);
const orc = mkActor("Orc", { energy: { value: 5000 } }, trees);
combat.combatant = { actor: hero };
const attack = async (item, o = {}) => { dialog = () => ({ net: 0, stacks: 0, mode: "strike", ...o }); game.user.targets = new Set([{ actor: orc }]); return actions.rollWeaponAttack(hero, item); };

console.log("== Heave! (Strength T2)");
const maul = mkWeapon(hero, "Maul", { weaponType: "striker", weight: "heavy", material: "iron", grade: 3 });
let e0 = hero.system.energy.value;
seq = [20]; await attack(maul, { heave: true });
let o = last("attack").flags.flowstate.attack.opts;
ok(o.stacks === maul.system.profile.stacks + 1 && o.bash === Math.floor(maul.system.profile.capped / 4), "Strengthened and Bash");
ok(e0 - hero.system.energy.value === 2 * hero.system.derived.effective.str.min, "costs double the STR min (Heave!)");

console.log("== Rend + Shred on armor (Striker T1/T3/T5)");
maul.system.equipped = true;
const plate = mkArmor(orc, "Plate", "heavy", 15);
hero.system.energy.value = 5000; hero.system.ap.value = 6;
seq = [20]; await attack(maul, { rend: true });
o = last("attack").flags.flowstate.attack.opts;
ok(o.rend?.stacks === 2 && o.rend.all === false, "Rend ×2 (single target, Shred); Blood and Iron no longer extends it");
const out = await actions.damageOutcome(orc, 30, "physical", { rend: o.rend });
ok(out.armorLoss === applyStacks(15, 2) && out.toHp === 15, `object loss ${out.armorLoss}, HP ${out.toHp} (only the object loss is Strengthened)`);
const out1 = await actions.damageOutcome(orc, 30, "physical", { rend: { stacks: 1, all: false } });
ok(out1.armorLoss === 22 && out1.toHp === 15, "doc example: 30 vs Limit 15 → 15 through, 22 to the object");

console.log("== Block / Perfect Block (Defender T1/T5)");
const shield = mkWeapon(orc, "Shield", { weaponType: "defender", weight: "light", material: "hardwood", grade: 3 });
const hitFor = async dmg => { dialog = () => ({ net: 0, extra: 0 }); await actions.defend(last("attack"), 0, "none"); seq = [dmg]; await actions.rollExchangeDamage(last("defense")); return last("damage"); };
hero.system.ap.value = 6;
seq = [10]; await attack(maul);
let atkMsg = last("attack");
ok(/guarding/.test(atkMsg.content) && atkMsg.content.includes('data-choice="perfectBlock"') && !atkMsg.content.includes('data-choice="block"'), "Block is automatic; Perfect Block is an optional roll");
let w0 = shield.system.wear;
let dm = await hitFor(10);
ok(shield.system.wear > w0 && dm.content.includes("fs-riposte"), "the shield soaks the hit; nothing got through, so Riposte is offered");
await actions.declineRiposte(dm);
hero.system.ap.value = 6; seq = [10]; await attack(maul); atkMsg = last("attack");
dialog = () => ({ net: 0 }); seq = [15]; await actions.defend(atkMsg, 0, "perfectBlock");
let def = last("defense").flags.flowstate.defense;
ok(!def.result.hit && def.result.parry.success, "Perfect Block success negates");
hero.system.ap.value = 6; seq = [10]; await attack(maul); atkMsg = last("attack");
seq = [5]; await actions.defend(atkMsg, 0, "perfectBlock");
ok(last("perfect") && !last("defense")?.flags.flowstate.defense || last("defense").flags.flowstate.defense.attackMessage !== atkMsg.id, "Perfect Block miss: no response yet, the defender still dodges");
w0 = shield.system.wear;
dm = await hitFor(10);
ok(shield.system.wear === w0, "the missed shield doesn't apply to that hit");
shield.system.equipped = false; shield.system.prepareDerivedData();

console.log("== Block for an ally");
const knight = mkActor("Knight", {}, trees);
const kshield = mkWeapon(knight, "Tower", { weaponType: "defender", weight: "heavy", material: "iron", grade: 3 });
hero.system.ap.value = 6; seq = [10]; await attack(maul); atkMsg = last("attack");
await actions.blockFor(atkMsg, 0, knight.uuid, false);
ok(last("blockFor")?.flags.flowstate.blockFor.item === kshield.uuid, "Knight raises the Tower shield for Orc");
w0 = kshield.system.wear;
dm = await hitFor(10);
ok(kshield.system.wear > w0, "the Tower shield soaks Orc's hit");

console.log("== Brace / Harden (Heavy T1/T4)");
combat.combatant = { actor: orc };
const oe = orc.system.energy.value;
dialog = () => ({ harden: true }); await actions.startParry(orc, "brace");
const info = ab.braceInfo(orc);
ok(orc.getFlag("flowstate", "parrying")?.brace?.harden && orc.system.energy.value === oe - info.cost - info.harden, `Brace + Harden: ${info.cost} + ${info.harden} Energy`);
combat.combatant = { actor: hero };
hero.system.ap.value = 6; seq = [10]; await attack(maul);
dm = await hitFor(100);
ok(/Harden/.test(text(dm)) && text(dm).includes(`Brace (CON): −${orc.system.derived.effective.con.value}`), "Weakened (Harden), then − CON");
await actions.clearParries(orc);

console.log("== Distracting Fire (Assault T3)");
const rifle = mkWeapon(orc, "Rifle", { weaponType: "assault", weight: "light", material: "hardwood", grade: 3 });
shield.system.equipped = false; shield.system.prepareDerivedData();
hero.system.ap.value = 6; seq = [30];
await actions.performAttack(hero, { label: "Bomb", net: 0, area: true, damage: "10", type: "physical", stacks: 0, physical: true, shots: 1, notes: [] , targetActors: [orc]});
atkMsg = last("attack");
ok(atkMsg.content.includes('data-choice="distract"'), "Distracting Fire button on an Area attack");
dialog = () => ({ net: 0 }); seq = [35, 8]; await actions.defend(atkMsg, 0, "distract");
ok(last("distract").flags.flowstate.distract.hit && last("distract").flags.flowstate.distract.total === 8, "hit → attack re-rolled to 8");
seq = [4, 4]; await actions.defend(atkMsg, 0, "none");
seq = [10]; await actions.rollExchangeDamage(last("defense"), { auto: true });
ok(/Distracting Fire/.test(last("damage").content), "damage Weakened by Distracting Fire");

console.log("== Berserk / Seeing Red (Striker T2/T4)");
const knife = mkWeapon(hero, "Knife", { weaponType: "striker", weight: "light", material: "hardwood", grade: 3 });
hero.system.energy.value = 5000;
await actions.berserk(hero);
ok(hero.statuses.has("berserk") && ab.fastValue(hero, knife) === 1, "Light Striker gets Fast");
await actions.seeingRed(hero);
ok(ab.fastValue(hero, knife) === 2, "Seeing Red: Fast+");
await actions.treesTurnStart(hero);
ok(!hero.statuses.has("berserk") && /Maintain Berserk/.test(last("startCard")?.content ?? ""), "Berserk ends at turn start; the start-of-turn card offers Maintain");
await actions.startOfTurn(last("startCard"), "maintain");
ok(hero.statuses.has("berserk") && hero.statuses.has("seeingRed"), "maintained (Seeing Red too)");

console.log("== Wild Swing + Crunch vs prone (Weighted T1/T5)");
const flail = mkWeapon(hero, "Flail", { weaponType: "weighted", weight: "heavy", material: "iron", grade: 3 });
orc.statuses.add("prone"); hero.system.ap.value = 6;
const eSm = hero.system.energy.value;
await actions.smashing(hero);
ok(hero.statuses.has("smashing") && hero.system.energy.value === eSm - 2 * ab.scalingMin(flail), "Smashing (start of turn): double Scaling Stat min Energy, status on");
seq = [20]; await attack(flail, { wild: "both" });
o = last("attack").flags.flowstate.attack.opts;
ok(o.bash === Math.floor(flail.system.profile.capped / 2) && o.stacks === flail.system.profile.stacks + 2 && o.knockback === 10 * flail.system.profile.capped && o.smashKb === 5 * flail.system.profile.capped && !o.knockbackAdd, "Bash+, two Strengthened; Smashing carries the base Knockback for the hit");
ok(ab.smashingForce(100, 2) === 100 && ab.smashingForce(100, 1) === 50 && ab.smashingForce(100, -2) === 0, "Smashing: +half the base per net Strengthened stack, never below the baseline");
await hero.toggleStatusEffect("smashing", { active: false });
await actions.treesTurnStart(hero);
ok(/data-op="smashing"/.test(last("startCard")?.content ?? ""), "the start-of-turn card offers Smashing");
orc.statuses.delete("prone");

console.log("== Take Aim + Cool Breath (Assault T2/T4)");
const carbine = mkWeapon(hero, "Carbine", { weaponType: "assault", weight: "light", material: "hardwood", grade: 3 });
hero.system.ap.value = 6; e0 = hero.system.energy.value;
seq = [20]; await attack(carbine, { mode: "r1", takeAim: "adv", coolBreath: true });
ok(hero.getFlag("flowstate", "rootedTurn") === actions.turnKey() && e0 === hero.system.energy.value, "free Take Aim, rooted this turn");

console.log("== Shield Toss (Defender T2) misses → lands by the target");
const buckler = mkWeapon(hero, "Buckler", { weaponType: "defender", weight: "light", material: "hardwood", grade: 3 });
hero.system.ap.value = 6; hero.system.rp.value = 6;
seq = [3]; await attack(buckler, { mode: "throw", shieldToss: true, tossReturn: true, tossStrong: true, tossPay: "rp" });
ok(hero.system.rp.value === 4 && hero.items.includes(buckler), "paid 2 RP, still in hand");
dialog = () => ({ net: 0 }); seq = [10, 10]; await actions.defend(last("attack"), 0, "dodge");
ok(/misses and lands/.test(last("defense").content), "miss → lands by the target (GM drop requested)");

console.log("== Bodyslam + Launch (Heavy T3/T5)");
mkArmor(hero, "HeroPlate", "heavy", 20);
hero.system.ap.value = 6; game.user.targets = new Set([{ actor: orc }]);
dialog = () => ({ net: 0, launch: true }); seq = [20];
await actions.bodyslam(hero);
o = last("attack").flags.flowstate.attack.opts;
ok(hero.system.ap.value === 3 && o.launchForce === 10 * (20 + hero.system.derived.effective.con.min), "3 AP, Launch Force 10× (Limit + CON min)");

console.log("== Shield Toss guard as a reaction (Defender T2)");
const ally = mkActor("Ally", {}, {});
const squire = mkActor("Squire", { energy: { value: 5000 } }, trees);
const sq = mkWeapon(squire, "Kite", { weaponType: "defender", weight: "light", material: "hardwood", grade: 3 });
combat.combatant = { actor: orc }; orc.system.ap.value = 6;
game.user.targets = new Set([{ actor: ally }]); dialog = () => ({ net: 0, stacks: 0, mode: "strike" }); seq = [10];
const club2 = mkWeapon(orc, "Club2", { weaponType: "striker", weight: "light", material: "hardwood", grade: 1 });
await actions.rollWeaponAttack(orc, club2);
squire.system.rp.value = 6;
dialog = () => ({ net: 0 }); seq = [15];
await actions.blockFor(last("attack"), 0, squire.uuid, false, true);
ok(squire.system.rp.value === 4 && last("blockFor")?.flags.flowstate.blockFor.item === sq.uuid, "2 RP; the tossed shield Blocks for the ally");
{ const am = last("attack");
  const hp0 = ally.system.hp.value, w0 = sq.system.wear;
  dialog = () => ({ net: 0, extra: 0 }); await actions.defend(am, 0, "none");
  seq = [30]; await actions.rollExchangeDamage(last("defense"));
  console.log("   DMG:", text(last("damage") ?? messages.at(-1)).slice(0, 400));
  ok(sq.system.wear > w0 && ally.system.hp.value > hp0 - 30, `tossed shield soaks the ally's damage (wear +${sq.system.wear - w0}, HP ${hp0} → ${ally.system.hp.value})`); }

console.log("== Collapsed Ally help button");
{ const knight2 = mkActor("Knight2", { energy: { value: 5000 } }, trees);
  mkWeapon(knight2, "Buckler", { weaponType: "defender", weight: "light", material: "hardwood", grade: 3 });
  const squire2 = mkActor("Squire2", { energy: { value: 5000 } }, trees);
  mkWeapon(squire2, "Kite2", { weaponType: "defender", weight: "light", material: "hardwood", grade: 3 });
  const ally2 = mkActor("Ally2", {}, {});
  const tk = (actor, x) => ({ actor, center: { x, y: 0 }, document: {} });
  const allyTok = tk(ally2, 0);
  ally2.getActiveTokens = () => [allyTok];
  globalThis.canvas = { grid: { measurePath: ([p, q]) => ({ distance: Math.abs(p.x - q.x) }) }, tokens: { placeables: [tk(knight2, 5), tk(squire2, 500), allyTok] } };
  orc.system.ap.value = 6; game.user.targets = new Set([{ actor: ally2 }]); dialog = () => ({ net: 0, stacks: 0, mode: "strike" }); seq = [10];
  await actions.rollWeaponAttack(orc, club2);
  const c = last("attack").content;
  ok((c.match(/class="fs-ally-help"/g) ?? []).length === 1 && !c.includes("fs-block-row"), "one Ally help button for the target instead of a row per ally");
  let listed = "";
  dialog = html => { listed = html; const m = [...html.matchAll(/<option value="(\d+)">([^<]*)<\/option>/g)].find(x => /Knight2: Block for/.test(x[2])); return { pick: m?.[1] }; };
  await actions.allyHelp(last("attack"), 0);
  ok(/Knight2: Block for Ally2/.test(listed) && last("blockFor")?.flags.flowstate.blockFor.blocker === knight2.uuid, "the popup lists who can help; picking one Blocks");
  ok(/Squire2: Shield Toss to guard Ally2/.test(listed), "an ally out of reach but in throw range is offered Shield Toss to guard");
  // Without the 2 RP a Shield Toss guard costs, it isn't offered (it could only fail).
  squire2.system.rp.value = 0; listed = "";
  await actions.allyHelp(last("attack"), 0);
  ok(!/Squire2: Shield Toss/.test(listed), "no Shield Toss to guard without 2 RP");
  squire2.system.rp.value = 6;
  globalThis.canvas = null; ally2.getActiveTokens = () => []; }

console.log("== Shield Toss guard Blocks automatically");
{ const guardian = mkActor("Guardian", { energy: { value: 5000 } }, trees);
  const gs = mkWeapon(guardian, "Pavise", { weaponType: "defender", weight: "light", material: "hardwood", grade: 3 });
  const ward = mkActor("Ward", {}, {});
  await ward.setFlag("flowstate", "shieldGuard", { blocker: guardian.uuid, item: gs.uuid });
  orc.system.ap.value = 6; game.user.targets = new Set([{ actor: ward }]); dialog = () => ({ net: 0, stacks: 0, mode: "strike" }); seq = [10];
  await actions.rollWeaponAttack(orc, club2);
  ok(/guarding: Pavise/.test(last("attack").content), "attack card shows the guard");
  const hp0 = ward.system.hp.value, w0 = gs.system.wear;
  dialog = () => ({ net: 0, extra: 0 }); await actions.defend(last("attack"), 0, "none");
  ok(/Shield Toss guard\) Blocks/.test(text(last("defense"))) && !ward.getFlag("flowstate", "shieldGuard"), "the guard Blocks on its own and is used up");
  seq = [30]; await actions.rollExchangeDamage(last("defense"));
  ok(gs.system.wear > w0 && ward.system.hp.value > hp0 - 30, `the guarding shield soaks the hit (wear +${gs.system.wear - w0}, HP ${hp0} → ${ward.system.hp.value})`);
  seq = [10]; orc.system.ap.value = 6; dialog = () => ({ net: 0, stacks: 0, mode: "strike" });
  await actions.rollWeaponAttack(orc, club2);
  ok(!/Pavise/.test(last("attack").content), "only one attack is Blocked"); }

console.log("== Start-of-turn card (Proper Stance)");
const ar = mkWeapon(hero, "AR", { weaponType: "assault", weight: "light", material: "hardwood", grade: 3 });
combat.combatant = { actor: hero };
await actions.treesTurnStart(hero);
const sc = last("startCard");
ok(/Proper Stance/.test(sc.content) && /Berserk/.test(sc.content), "card offers Berserk and Proper Stance");
await actions.startOfTurn(sc, "properStance");
ok(hero.statuses.has("properStance"), "Proper Stance from the card");

console.log("== Cleave is object damage (Equipment)");
const plate2 = orc.system.armor;
let co = await actions.damageOutcome(orc, 30, "physical", { cleave: 15 });
ok(co.toHp === 30 && co.armorLoss === 15, `30 + Cleave 15 vs Limit 15: Cleave takes the Limit, 30 gets through (${co.toHp}), armor −15`);
co = await actions.damageOutcome(orc, 30, "physical", { cleave: 20, cleaveToCreature: true });
ok(co.toHp === 35, `Blood and Iron: 5 Cleave left after the Limit hits the creature (${co.toHp})`);
co = await actions.damageOutcome(orc, 30, "physical", { cleave: 0 });
ok(co.toHp === 15, "no Cleave: Limit 15 soaks normal damage");
const k1 = mkWeapon(orc, "K1", { weaponType: "bladed", weight: "light", material: "hardwood", grade: 1 });
const k2 = mkWeapon(orc, "K2", { weaponType: "bladed", weight: "light", material: "hardwood", grade: 1 });
co = await actions.damageOutcome(orc, 30, "physical", { parryItems: [k1.uuid, k2.uuid] });
ok(co.weapons.length === 2 && co.toHp === 30 - 6 - 6 - 15, `two parrying weapons both soak (${co.toHp})`);
