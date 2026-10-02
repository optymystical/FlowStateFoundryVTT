// Martial Theory automation: parry, riposte, grapple, break free, throw grappled, stances.
class Field { constructor(o={}){ Object.assign(this,o); } }
let seq = []; const messages = []; const uuids = new Map();
let dialog = () => ({ net: 0 });
globalThis.foundry = {
  data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field, ObjectField: Field } },
  abstract: { TypeDataModel: class {} },
  utils: { escapeHTML: s => s, deepClone: o => structuredClone(o), getProperty: (o,k)=>k.split(".").reduce((a,b)=>a?.[b],o), setProperty: (o,k,v)=>{const p=k.split(".");let c=o;for(const x of p.slice(0,-1))c=c[x]??={};c[p.at(-1)]=v;} },
  applications: { api: { DialogV2: { prompt: async ({ content }) => dialog(content) } } }
};
globalThis.Roll = class { constructor(f){ this.formula=f; } async evaluate(){ this.total = seq.length ? seq.shift() : 10; return this; } async render(){ return `<roll ${this.formula}=${this.total}>`; } };
globalThis.ChatMessage = { getSpeaker: ({actor}) => ({ alias: actor.name }),
  create: async d => { const m = { id: "m"+messages.length, ...d, getFlag: (s,k) => d.flags?.[s]?.[k] }; messages.push(m); return m; } };
const combat = { id: "C", started: true, round: 1, turn: 0, combatant: null, combatants: [] };
globalThis.game = { settings: { get: () => false }, messages: { find: fn => messages.find(fn), filter: fn => messages.filter(fn), get: id => messages.find(m=>m.id===id) }, combat,
  users: { activeGM: { id: "gm" } }, socket: { emit: (...a) => console.log("  socket emit", JSON.stringify(a[1])) }, user: { targets: new Set(), isGM: false }, actors: [] };
globalThis.ui = { notifications: { warn: m => console.log("  WARN", m), info: m => console.log("  INFO", m), error: m => console.log("  ERR", m) } };
globalThis.canvas = null;
globalThis.fromUuid = async u => uuids.get(u); globalThis.fromUuidSync = u => uuids.get(u);

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


globalThis.CONFIG = {};
const ab = await import("../../module/abilities.mjs");
const F = () => messages.at(-1).flags.flowstate;
const hero = mkActor("Hero", {}, { "martial-theory": 1, "martial-brawling-methods": 5 });
const orc = mkActor("Orc", {}, { "martial-theory": 1, "martial-brawling-methods": 4 });
const gob = mkActor("Goblin");
const fistsH = mkWeapon(hero, "Unarmed", { weaponType: "unarmed", weight: "light", material: "", equipped: true, secondHand: true });
const fistsO = mkWeapon(orc, "Unarmed", { weaponType: "unarmed", weight: "light", material: "", equipped: true, secondHand: true });
const axe = mkWeapon(gob, "Axe", {}); axe.isOwner = true;
combat.combatant = { actor: hero };
const dexMin = hero.system.derived.effective.dex.min, strMin = hero.system.derived.effective.str.min;
const refill = a => { a.system.ap.value = 6; a.system.rp.value = 6; a.system.energy.value = 200; };
refill(hero); refill(orc);

console.log("== Twin Fang (Light)");
game.user.targets = new Set([{ actor: orc }]);
let seen = "";
dialog = c => { seen = c; return c.includes('name="item"') ? {} : { weight: "light", mode: "strike", net: 0, stacks: 0, twinFang: "adv" }; };
seq = [30]; await actions.rollWeaponAttack(hero, fistsH);
const tf = messages.at(-1);
ok(seen.includes("Twin Fang") && !seen.includes("Jab") && seen.includes("Dragon Lash") && seen.includes("Kick Out"), "main attack offers Twin Fang, Dragon Lash, Kick Out (no Jab)");
ok(hero.system.energy.value === 200 - dexMin, `energy −${dexMin} (DEX min)`);
ok(F().followups.list.some(f => f.kind === "fast" && f.twinFang), "other-fist follow-up carries Twin Fang");
ok(/1× Advantage/.test(text(tf)), "attack has Advantage");
orc.isOwner = true; dialog = () => ({ net: 0 }); seq = [5]; await actions.defend(tf, 0, "dodge");
dialog = () => ({ extra: 0 }); seq = [3]; await actions.rollExchangeDamage(messages.at(-1));
dialog = c => { seen = c; return { mode: "strike", net: 0, stacks: 0, twinFangPick: "str" }; };
seq = [30]; await actions.rollWeaponAttack(hero, fistsH, { net: -1, label: "Fast follow-up: other fist (Dis)", weight: "light", kind: "fast", twinFang: true, source: tf.id });
const fu = messages.at(-1);
ok(seen.includes("already paid") && F().attack.opts.stacks === 1, "follow-up picks Strengthened, free");
dialog = () => ({ net: 0 }); seq = [5]; await actions.defend(fu, 0, "dodge");
dialog = () => ({ extra: 0 }); seq = [3]; await actions.rollExchangeDamage(messages.at(-1));
await actions.postReadyFollowups(fu);
const card = messages.find(m => m.flags?.flowstate?.brawlingCard?.set === fu.id);
ok(!!card && card.content.includes("Combo") && card.content.includes("Flow Like Water"), "Brawling card offers Combo and Flow Like Water");
await actions.postReadyFollowups(fu);
ok(messages.filter(m => m.flags?.flowstate?.brawlingCard?.set === fu.id).length === 1, "posted once");

console.log("== Combo and Flow Like Water");
refill(hero);
dialog = () => ({ mode: "strike", net: 0, stacks: 0 });
seq = [20]; await actions.brawlingExtra(card, "combo");
ok(F().attack.opts.unarmedWeight === "light" && /Advantage/.test(text(messages.at(-1))) && !F().followups, "Combo: Light, Advantage, no Fast chain");
ok(hero.system.energy.value === 200 - 2 * dexMin, "Combo costs 2× DEX min");
await actions.brawlingExtra(card, "combo");
seq = [20]; await actions.brawlingExtra(card, "flow");
ok(F().attack.opts.unarmedWeight === "heavy" && F().attack.opts.flowChain && F().followups?.list?.some(f => f.kind === "solitary" && f.flowChain), "Flow: Heavy (opposite), can Solitary, marked no-more-Flow");

console.log("== Jab on the Solitary follow-up; Dragon Lash vs prone; Kick Out");
refill(hero); orc.statuses.add("prone");
dialog = () => ({ weight: "heavy", mode: "strike", net: 0, stacks: 0, heavyTech: "dragon" });
seq = [30]; await actions.rollWeaponAttack(hero, fistsH);
const dl = messages.at(-1);
ok(hero.system.energy.value === 200 - 2 * strMin, "Dragon Lash (2× STR min)");
ok(F().followups.list.some(f => f.kind === "solitary" && f.weight === "heavy"), "Heavy attack offers a Solitary follow-up");
seq = [5]; dialog = () => ({ net: 0 }); await actions.defend(dl, 0, "dodge");
dialog = () => ({ extra: 0 }); seq = [10]; await actions.rollExchangeDamage(messages.at(-1));
refill(hero);
dialog = c => { seen = c; return { mode: "strike", net: 0, stacks: 0, jab: true }; };
seq = [30]; await actions.rollWeaponAttack(hero, fistsH, { net: -1, label: "Solitary follow-up (Dis)", weight: "heavy", kind: "solitary", source: dl.id });
ok(seen.includes("Jab") && /Jab \(Advantage, Strengthened\)/.test(text(messages.at(-1))) && hero.system.energy.value === 200 - strMin, "Jab on the Solitary follow-up: Advantage, Strengthened, STR min");
ok(/\+2 Dragon Lash \(prone\)/.test(text(messages.find(m => m.flags?.flowstate?.damage?.defenseMessage && m.content.includes("Dragon")) ?? messages.at(-1))), "Dragon Lash doubled vs prone");
orc.statuses.delete("prone"); refill(hero);
dialog = () => ({ weight: "heavy", mode: "strike", net: 0, stacks: 0, heavyTech: "kick" });
seq = [30]; await actions.rollWeaponAttack(hero, fistsH);
seq = [5]; dialog = () => ({ net: 0 }); await actions.defend(messages.at(-1), 0, "dodge");
ok(orc.statuses.has("prone"), "Kick Out knocks the target prone");
dialog = () => ({ weight: "heavy", mode: "strike", net: 0, stacks: 0, jab: true });
const n0 = messages.length; seq = [30]; await actions.rollWeaponAttack(hero, fistsH);
ok(messages.length === n0, "Jab refused outside a Solitary follow-up");
orc.statuses.delete("prone");

console.log("== Dip and Shatter (orc defends against the goblin's axe)");
combat.combatant = { actor: orc }; refill(orc);
await actions.startParry(orc, "dip");
ok(orc.getFlag("flowstate", "parrying")?.dip && orc.system.energy.value === 200 - orc.system.derived.effective.dex.value, "Dip on: DEX stat Energy");
combat.combatant = { actor: gob }; refill(gob);
game.user.targets = new Set([{ actor: orc }]);
const gobOpts = { label: "Axe", net: 0, melee: true, damage: "2d10", type: "physical", stacks: 0, physical: true, shots: 1, notes: [], followups: [], itemUuid: axe.uuid };
seq = [20]; await actions.performAttack(gob, gobOpts);
dialog = () => ({ net: 0, extra: 0 }); await actions.defend(messages.at(-1), 0, "none");
const dexV = orc.system.derived.effective.dex.value;
seq = [dexV - 1]; await actions.rollExchangeDamage(messages.at(-1));
let dm = messages.at(-1);
ok(/Dip \(DEX\)/.test(text(dm)) && dm.content.includes("fs-dip-move") && dm.content.includes("fs-riposte"), "Dip reduced the hit to 0: Dip move and Riposte offered");
refill(orc); await actions.dipMove(dm);
ok(orc.flags.flowstate.freeMove === true && orc.system.rp.value === 5, "Dip move: 1 RP, free move");
console.log("== Shatter");
combat.combatant = { actor: orc };
await actions.startParry(orc, "shatter");
ok(orc.getFlag("flowstate", "parrying")?.shatter && !orc.getFlag("flowstate", "parrying")?.dip, "Shatter replaces Dip (one hand)");
combat.combatant = { actor: gob };
seq = [20]; await actions.performAttack(gob, gobOpts);
dialog = () => ({ net: 0, extra: 0 }); await actions.defend(messages.at(-1), 0, "none");
const w0 = axe.system.wear;
seq = [30, 6]; await actions.rollExchangeDamage(messages.at(-1));
dm = messages.at(-1);
const cl = orc.system.derived.effective.str.min;
ok(axe.system.wear - w0 === 6 + cl && /Shatter/.test(text(dm)), `Shatter: Heavy Unarmed (no Solitary) + Cleave hits the axe (wear +${axe.system.wear - w0})`);
gobOpts.itemUuid = null;
seq = [20]; await actions.performAttack(gob, gobOpts);
await actions.defend(messages.at(-1), 0, "none");
const hp0 = gob.system.hp.value;
seq = [5, 30]; await actions.rollExchangeDamage(messages.at(-1));
ok(gob.system.hp.value < hp0, `no weapon: Shatter hits the attacker (HP ${hp0} → ${gob.system.hp.value})`);
gobOpts.itemUuid = axe.uuid;
{ // Miss: Shatter still hits a melee weapon.
  const w1 = axe.system.wear;
  seq = [10]; await actions.performAttack(gob, gobOpts);
  dialog = () => ({ net: 0 }); seq = [20, 6]; await actions.defend(messages.at(-1), 0, "dodge");
  ok(axe.system.wear - w1 === 6 + cl && /Shatter/.test(text(messages.at(-1))) && messages.at(-1).flags.flowstate.defense.shatter, `Shatter on a missed melee attack (wear +${axe.system.wear - w1})`);
}
{ // Breaking the weapon: no damage.
  axe.system.wear = axe.system.durability.max - 3; axe.system.prepareDerivedData();
  seq = [20]; await actions.performAttack(gob, gobOpts);
  dialog = () => ({ net: 0, extra: 0 }); await actions.defend(messages.at(-1), 0, "none");
  const ohp = orc.system.hp.value;
  seq = [30, 6]; await actions.rollExchangeDamage(messages.at(-1));
  ok(orc.system.hp.value === ohp && /breaks/.test(text(messages.at(-1))), `Shatter breaks the weapon: no damage (HP ${ohp} → ${orc.system.hp.value})`);
  axe.system.wear = 0; axe.system.prepareDerivedData();
}
{ // Ranged: the projectile takes it and the damage drops by that much.
  const bow = mkWeapon(gob, "Bow", { weaponType: "longshot", weight: "light", material: "hardwood", grade: 1 });
  const ro = { ...gobOpts, melee: false, label: "Bow", itemUuid: bow.uuid };
  seq = [20]; await actions.performAttack(gob, ro);
  dialog = () => ({ net: 0, extra: 0 }); await actions.defend(messages.at(-1), 0, "none");
  seq = [30, 6]; await actions.rollExchangeDamage(messages.at(-1));
  const t = text(messages.at(-1));
  ok(/projectile takes/.test(t) && t.includes(`→ ${Math.max(0, 30 - 6 - cl)}`) && bow.system.wear === 0, `Shatter vs ranged lowers damage by ${6 + cl}`);
  seq = [10]; await actions.performAttack(gob, ro);
  dialog = () => ({ net: 0 }); seq = [20]; await actions.defend(messages.at(-1), 0, "dodge");
  ok(!/Shatter/.test(text(messages.at(-1))), "no Shatter on a missed ranged attack");
}
await actions.clearParries(orc);

console.log("== Redirect (orc dodges the goblin, redirects into the hero)");
seq = [10]; await actions.performAttack(gob, gobOpts);
dialog = () => ({ net: 0 }); seq = [20]; await actions.defend(messages.at(-1), 0, "dodge");
const rd = messages.at(-1);
ok(rd.content.includes("fs-redirect"), "Redirect offered after a successful dodge");
game.user.targets = new Set([{ actor: hero }]); refill(orc);
seq = [18]; await actions.redirect(rd);
ok(F().attack.opts.redirectOf === rd.id && F().attack.targets[0].name === "Hero" && /Advantage/.test(text(messages.at(-1))), "attack re-rolled against the hero with Advantage");
await actions.redirect(rd);

console.log("== Fast only from Fast attacks; grapples hold a fist");
game.user.targets = new Set([{ actor: gob }]); refill(hero);
const dagger = mkWeapon(hero, "Dagger", { weaponType: "swift", weight: "light", material: "hardwood", grade: 3, equipped: true });
fistsH.system.secondHand = false; fistsH.system.prepareDerivedData();
let lastDlg = "";
dialog = c => { lastDlg = c; return { net: 0, mode: "strike", weight: "heavy" }; };
seq = [30]; await actions.rollWeaponAttack(hero, fistsH);
ok(!(F().followups?.list ?? []).some(f => f.kind === "fast"), "Heavy Unarmed (not Fast): no Fast follow-up with the Dagger");
ok(/data-fs-weight="light"[^]*Twin Fang/.test(lastDlg) && /data-fs-weight="heavy"[^]*Heavy technique/.test(lastDlg), "Light/Heavy-only options are wrapped by weight");
refill(hero); dialog = () => ({ net: 0, mode: "strike", weight: "light" });
seq = [30]; await actions.rollWeaponAttack(hero, fistsH);
ok((F().followups?.list ?? []).some(f => f.kind === "fast" && f.itemId === "Dagger"), "Light Unarmed (Fast): Fast follow-up with the Dagger");
// Grapple holds the only raised fist.
await actions.setGrapple(gob, hero.uuid);
const before = messages.length;
refill(hero); seq = [30]; await actions.rollWeaponAttack(hero, fistsH);
ok(messages.length === before && ab.freeFists(hero) === 0, "one fist up and grappling: can't attack Unarmed");
fistsH.system.secondHand = true; fistsH.system.equipped = true; fistsH.system.prepareDerivedData(); dagger.system.equipped = false; dagger.system.prepareDerivedData();
refill(hero); seq = [30]; await actions.rollWeaponAttack(hero, fistsH);
ok(messages.length > before && ab.freeFists(hero) === 1 && !(F().followups?.list ?? []).some(f => f.kind === "fast"), "both fists up and grappling: one fist, no other-fist follow-up");
await actions.setGrapple(gob, null);
// Follow-up grapple option.
refill(hero); dialog = c => { lastDlg = c; return { net: 0, mode: "strike" }; };
seq = [30]; await actions.rollWeaponAttack(hero, fistsH, { net: -1, label: "Fast follow-up: other fist (Dis)", weight: "light", kind: "fast", source: messages.at(-1).id, targetActors: [gob] });
ok(/name="grapple"/.test(lastDlg), "Unarmed follow-up offers Grapple");

console.log("== Forced re-roll keeps the lower result");
{ const lowCQ = await import("../../module/actions.mjs");
  const dagger2 = mkWeapon(orc, "Dirk", { weaponType: "bladed", weight: "light", material: "hardwood", grade: 3 });
  orc.system.trees["martial-bladed-weapons"] = 2; refill(orc);
  seq = [10]; await actions.performAttack(gob, { ...gobOpts, itemUuid: axe.uuid, targetActors: [orc] });
  const am = messages.at(-1);
  dialog = () => ({ item: dagger2.id }); seq = [30]; await actions.defend(am, 0, "closeQuarters");
  const e = actions.effectiveEntry(am.id, 0, am.flags.flowstate.attack.targets[0]).total;
  ok(e === 10 && /stands/.test(text(messages.at(-1))), `Close Quarters re-roll of 30 doesn't raise the attack (still ${e})`); }
