// Automation: remembered dialog picks, a follow-up planned in the first attack's dialog, Auto-Dodge, Auto-Limber, keep-up abilities and the start-of-turn card.
import { installFoundry } from "./support/foundry.mjs";
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 });
let seen = "";
const { combat } = installFoundry({ roll: () => (seq.length ? seq.shift() : 10), dialog: c => { seen = c; return dialog(c); }, messages, uuids });

const { FlowStateActorData, FlowStateWeaponData } = await import("../../module/data.mjs");
const actions = await import("../../module/actions.mjs");
const auto = await import("../../module/automation-rules.mjs");
const ab = await import("../../module/abilities.mjs");
const set = (o, k, v) => foundry.utils.setProperty(o, k, v);
function mkActor(name, extra = {}, trees = {}) {
  const a = { name, uuid: "Actor." + name, isOwner: true, hasPlayerOwner: true, items: [], statuses: new Set(), flags: {} };
  a.items.get = id => a.items.find(i => i.id === id);
  a.update = async u => { for (const [k, v] of Object.entries(u)) set(a, k, v); };
  // Flags merge (like Foundry's): an object written into an object keeps the keys it leaves out.
  const merge = (cur, v) => (v && typeof v === "object" && cur && typeof cur === "object" ? Object.fromEntries([...new Set([...Object.keys(cur), ...Object.keys(v)])].map(k => [k, k in v ? merge(cur[k], v[k]) : cur[k]])) : v);
  a.setFlag = async (s, k, v) => set(a.flags, `${s}.${k}`, merge(foundry.utils.getProperty(a.flags, `${s}.${k}`), v));
  a.getFlag = (s, k) => foundry.utils.getProperty(a.flags, `${s}.${k}`);
  a.unsetFlag = async (s, k) => set(a.flags, `${s}.${k}`, undefined);
  a.toggleStatusEffect = async (id, { active }) => { active ? a.statuses.add(id) : a.statuses.delete(id); };
  a.getActiveTokens = () => [];
  a.testUserPermission = u => u.id === "p1";          // the player owns it (the GM in the mocks owns nothing)
  a.system = Object.assign(Object.create(FlowStateActorData.prototype), { stats: { str: 30, dex: 30, con: 30, pon: 10, snap: 10, will: 10, reach: 10, grasp: 10, build: 10 }, skillPoints: 30, unspentStats: 0, statCarry: 0, trees, size: 3, hp: { value: 432, lost: 0 }, energy: { value: 50 }, ap: { value: 6 }, rp: { value: 6 }, conditions: { ignite: 0, stain: 0, slow: 0, haste: 0 }, lift: 0, daysWithoutRest: 0, ...extra }, { parent: a });
  a.system.prepareDerivedData(); uuids.set(a.uuid, a); game.actors.push(a);
  combat.combatants.push({ actor: a });
  return a;
}
function mkWeapon(actor, id, sys) {
  const i = { id, name: id, type: "weapon", uuid: `${actor.uuid}.Item.${id}`, parent: actor, actor };
  i.system = Object.assign(Object.create(FlowStateWeaponData.prototype), { weaponType: "bladed", weight: "light", material: "hardwood", grade: 1, twoHanded: false, equipped: true, secondHand: false, loaded: true, rounds: 1, magazine: 1, wear: 0, ...sys }, { parent: i });
  i.update = async u => { for (const [k, v] of Object.entries(u)) set(i, k, v); i.system.prepareDerivedData(); };
  i.system.prepareDerivedData(); actor.items.push(i); uuids.set(i.uuid, i); return i;
}
const ok = (c, msg) => console.log(`  ${c ? "PASS" : "FAIL"} ${msg}`);
const text = m => m.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
globalThis.CONFIG = {}; game.messages.filter = fn => messages.filter(fn);
globalThis.foundry.applications.api.DialogV2.wait = async () => "quick";
globalThis.foundry.applications.api.DialogV2.confirm = async () => true;
const player = { id: "p1", isGM: false, active: true };
game.users.push(player); game.users.get = id => game.users.find(u => u.id === id); game.user.id = "p1";
const refill = a => { a.system.ap.value = 6; a.system.rp.value = 6; a.system.energy.value = 500; };

console.log("== Pure helpers");
const blank = auto.automationOf({ getFlag: () => undefined });
ok(!blank.dodge.on && blank.dodge.tries.shift && !blank.limber && !blank.keep.smashing, "defaults: everything off, every reaction ticked for Auto-Dodge");
ok(JSON.stringify(auto.rememberable({ mode: "strike", net: 1, stacks: 2, aim: "x", heave: true, "fu.0.disarm": "y" })) === JSON.stringify({ mode: "strike", heave: true }), "remembered: not the adjusters, aim or Disarm");
const sp = auto.splitFollowup({ mode: "strike", fu: "1|fast:B", "fu.0.thrust": true, "fu.1.quickStrike": true });
ok(sp.pick === "1|fast:B" && sp.fields.quickStrike === true && !sp.fields.thrust && sp.own.mode === "strike" && !("fu" in sp.own), "splitFollowup: the picked follow-up's own fields");
ok(auto.autoValues('<select name="mode"><option value="adv">a</option><option value="dis">d</option></select>', { mode: "dis" }).mode === "dis"
  && auto.autoValues('<select name="item">\n <option value="u1">x</option></select>').item === "u1", "autoValues: the given value, else each select's first option");

console.log("== Remembered attack picks");
const duel = mkActor("Duelist", {}, { "martial-theory": 2, "martial-curved-weapons": 1 });
const orc = mkActor("Orc");
const blade = mkWeapon(duel, "Blade", { weaponType: "curved", weight: "light" });
const axe = mkWeapon(orc, "Axe", { weaponType: "striker", weight: "light" });
refill(duel); refill(orc);
combat.combatant = { actor: duel };
game.user.targets = new Set([{ actor: orc }]);
dialog = c => (c.includes('name="fu"') ? { mode: "strike", fu: "0|solitary:Blade", "fu.0.mode": "strike" } : { mode: "strike" });
seq = [30]; await actions.rollWeaponAttack(duel, blade);
const atk = messages.at(-1);
ok(/name="fu"/.test(seen) && /Solitary follow-up/.test(seen), "the dialog offers the Solitary follow-up to plan");
ok(duel.getFlag("flowstate", "remember")?.["atk:Blade:main"]?.mode === "strike" && duel.getFlag("flowstate", "remember")["atk:Blade:main"].fu === "0|solitary:Blade", "this attack's picks are remembered (the follow-up plan too)");
ok(atk.flags.flowstate.attack.opts.autoFollowup?.pick === "solitary:Blade" && atk.flags.flowstate.attack.opts.autoFollowup.user === "p1", "the planned follow-up rides on the attack");

console.log("== The planned follow-up is made once the exchange is resolved");
orc.isOwner = true;
seq = [45]; await actions.defend(atk, 0, "dodge");          // a miss: the exchange is resolved
const n0 = messages.length;
await actions.postReadyFollowups(atk);
ok(!messages.slice(n0).some(m => m.flags?.flowstate?.followupCard), "no follow-up card (it was planned)");
dialog = () => { throw new Error("the planned follow-up showed a dialog"); };
seq = [30]; await actions.runAutoFollowup(atk);
const fu = messages.find(m => m.flags?.flowstate?.followupOf === atk.id && m.flags?.flowstate?.attack);
ok(!!fu && /Solitary/.test(fu.flags.flowstate.attack.opts.label ?? ""), "the Solitary follow-up was made on its own, no dialog");
await actions.runAutoFollowup(atk);
ok(messages.filter(m => m.flags?.flowstate?.followupOf === atk.id && m.flags?.flowstate?.attack).length === 1, "…only once");

console.log("== Auto-Dodge: tries Shift (if affordable), then dodges");
const hero = mkActor("Hero", {}, { "martial-theory": 1, "martial-medium-armor": 5 });
const mail = { id: "Mail", name: "Mail", type: "armor", uuid: "Actor.Hero.Item.Mail", system: { weight: "medium", equipped: true, wear: 0, durability: { value: 100, max: 100 }, profile: { valid: true, limit: 0, focus: null } } };
hero.items.push(mail); hero.system.armor = mail;
refill(hero);
await hero.setFlag("flowstate", "automation", { dodge: { on: true, tries: { shift: true }, shiftMode: "adv" } });
const orcOpts = { label: "Axe", net: 0, melee: true, damage: "2d10", type: "physical", stacks: 0, physical: true, shots: 1, notes: [], followups: [], itemUuid: axe.uuid };
combat.combatant = { actor: orc }; game.user.targets = new Set([{ actor: hero }]);
seq = [25]; await actions.performAttack(orc, orcOpts);
const a2 = messages.at(-1);
const e0 = hero.system.energy.value;
dialog = () => { throw new Error("Auto-Dodge showed a dialog"); };
seq = [5, 5, 12, 12]; await actions.autoDefend(a2);
ok(messages.some(m => m.flags?.flowstate?.shift?.attackMessage === a2.id) && hero.system.energy.value < e0, "Shift was used (Advantage), paid from Energy");
ok(!!actions.findDefense(a2.id, 0), "…then the dodge, with no dialog");
// Not affordable: Shift is skipped without a word, the dodge still happens.
hero.system.energy.value = 0;
seq = [25]; await actions.performAttack(orc, orcOpts);
const a3 = messages.at(-1);
seq = [12, 12]; await actions.autoDefend(a3);
ok(!messages.some(m => m.flags?.flowstate?.shift?.attackMessage === a3.id) && !!actions.findDefense(a3.id, 0), "no Energy: Shift skipped silently, dodged anyway");
// Another client (a second GM, say) leaves it to the one that runs it: no double answer.
seq = [25]; await actions.performAttack(orc, orcOpts);
const aOther = messages.at(-1);
game.user.id = "gm2"; await actions.autoDefend(aOther); game.user.id = "p1";
ok(!actions.findDefense(aOther.id, 0), "only the character's own client answers (no second Auto-Dodge from another GM)");
await actions.autoDefend(aOther);
await hero.setFlag("flowstate", "automation", { dodge: { on: false } });
seq = [25]; await actions.performAttack(orc, orcOpts);
const a4 = messages.at(-1);
await actions.autoDefend(a4);
ok(!actions.findDefense(a4.id, 0), "Auto-Dodge off: nothing answers");

console.log("== Auto-Limber");
refill(hero); hero.statuses.delete("limber");
await hero.setFlag("flowstate", "automation", { limber: true, dodge: { on: true } });
seq = [5]; await actions.performAttack(orc, orcOpts);
const a5 = messages.at(-1);
seq = [12, 12]; await actions.autoDefend(a5);
const d5 = actions.findDefense(a5.id, 0);
ok(d5 && /fs-limber/.test(d5.content), "a dodge that succeeded offers Limber");
await actions.autoLimber(d5);
ok(hero.statuses.has("limber"), "Auto-Limber took it");

console.log("== Keep-up abilities and the start-of-turn card");
const brute = mkActor("Brute", {}, { "martial-theory": 2, "martial-weighted-weapons": 4 });
const club = mkWeapon(brute, "Club", { weaponType: "weighted", weight: "heavy", material: "iron", grade: 3 });
refill(brute);
await brute.setFlag("flowstate", "automation", { keep: { smashing: true } });
combat.combatant = { actor: brute };
const eB = brute.system.energy.value;
await actions.treesTurnStart(brute, { regain: 12 });
let card = messages.at(-1);
ok(brute.statuses.has("smashing") && brute.system.energy.value === eB - ab.WEIGHTED_COST.smashing(club), "Smashing kept up: paid and on");
ok(/Energy \+12/.test(text(card)) && /Kept up: Smashing/.test(text(card)) && !/data-op="smashing"/.test(card.content), "one card: Energy regained, what was kept up, no button for it");
brute.system.energy.value = 1;
await actions.treesTurnStart(brute, { regain: 0 });
card = messages.at(-1);
ok(!brute.statuses.has("smashing") && /Couldn't keep up: Smashing \(needs/.test(text(card)) && /Ended: Smashing/.test(text(card)), "not enough Energy: it ended and the card says it couldn't be kept up");
const plain = mkActor("Plain");
const before = messages.length;
await actions.treesTurnStart(plain, { regain: 6 });
ok(messages.length === before + 1 && /Energy \+6/.test(text(messages.at(-1))), "a player's character gets the card every turn (Energy regained)");
plain.hasPlayerOwner = false;
const before2 = messages.length;
await actions.treesTurnStart(plain, { regain: 6 });
ok(messages.length === before2, "…a GM's creature with nothing to use or report doesn't");
