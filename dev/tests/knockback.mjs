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


globalThis.CONST = {};
let wall = null;
globalThis.CONFIG = { Canvas: { polygonBackends: { move: { testCollision: (a, b) => wall ? wall(a, b) : null } } } };
const moves = [];
globalThis.canvas = { grid: { size: 100, distance: 5, isGridless: false,
  measurePath: ([p, q]) => ({ distance: Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)) / 20 }), getCenterPoint: o => o },
  dimensions: { size: 100, distance: 5, sceneX: 0, sceneY: 0, sceneWidth: 10000, sceneHeight: 10000 }, tokens: { controlled: [], placeables: [] }, scene: {} };
function place(actor, gx, gy) {
  const doc = { x: gx * 100, y: gy * 100, width: 1, height: 1, isOwner: true, uuid: actor.uuid + ".Token", update: async u => { Object.assign(doc, u); moves.push([actor.name, u.x / 100, u.y / 100]); } };
  const tok = { id: actor.name, name: actor.name, actor, document: doc, get center() { return { x: doc.x + 50, y: doc.y + 50 }; } };
  actor.getActiveTokens = () => [tok]; canvas.tokens.placeables.push(tok); return tok;
}
const F = () => messages.at(-1).flags.flowstate;
const hero = mkActor("Hero", { stats: { str: 200, dex: 30, con: 30, pon: 10, snap: 10, will: 10, reach: 10, grasp: 10, build: 10 } }, { "martial-theory": 1, "martial-balanced-weapons": 3 });
const orc = mkActor("Orc");
const maul = mkWeapon(hero, "Maul", { weaponType: "balanced", weight: "heavy", material: "iron", grade: 20 });
const orcSword = mkWeapon(orc, "Cutlass", {}); orcSword.isOwner = true;
const orcArmor = { id: "Mail", name: "Mail", type: "armor", uuid: "Actor.Orc.Item.Mail", system: { equipped: true, wear: 0, durability: { value: 100, max: 100 }, profile: { valid: true, limit: 20, focus: null } } };
orcArmor.update = async u => { orcArmor.system.wear = u["system.wear"]; };
orc.items.push(orcArmor); orc.system.armor = orcArmor;
place(hero, 10, 10); place(orc, 11, 10);
combat.combatant = { actor: hero };
const refill = a => { a.system.ap.value = 6; a.system.rp.value = 6; a.system.energy.value = 500; };
refill(hero);

console.log("== Posture");
combat.combatant = { actor: orc };
await actions.setPosture(hero, "crouch"); ok(!hero.statuses.has("crouch"), "not on your turn: blocked");
combat.combatant = { actor: hero };
await actions.setPosture(hero, "crouch"); ok(hero.statuses.has("crouch") && hero.system.ap.value === 6, "crouch: free");
await actions.setPosture(hero, "prone"); ok(hero.statuses.has("prone") && !hero.statuses.has("crouch") && hero.system.ap.value === 5, "prone: 1 AP, replaces crouch");
await actions.setPosture(hero, "crouch"); ok(!hero.statuses.has("crouch"), "can't crouch while prone");
await actions.setPosture(hero, "stand"); ok(!hero.statuses.has("prone") && hero.system.ap.value === 4, "get up from prone: 1 AP");
await actions.setPosture(hero, "crouch"); await actions.setPosture(hero, "stand"); ok(!hero.statuses.has("crouch") && hero.system.ap.value === 4, "get up from crouch: free");

console.log("== Slam Knockback button → push east into a wall");
refill(hero); game.user.targets = new Set([{ actor: orc }]);
dialog = () => ({ mode: "strike", net: 0, stacks: 0, slam: "knockback" });
seq = [30]; await actions.rollWeaponAttack(hero, maul);
orc.isOwner = true; dialog = () => ({ net: 0 }); seq = [5]; await actions.defend(messages.at(-1), 0, "dodge");
dialog = () => ({ extra: 0 }); seq = [10]; await actions.rollExchangeDamage(messages.at(-1));
const dmg = messages.at(-1);
console.log("   ", text(dmg).slice(0, 260));
ok(dmg.content.includes("fs-knockback") && F().knockback.feet > 0, `Knockback button (${F().knockback.feet} ft)`);
wall = (a, b) => ({ x: a.x + 100, y: a.y });
hero.isOwner = true; const hp0 = orc.system.hp.value;
dialog = () => ({ dir: "away" }); await actions.knockback(dmg);
console.log("    moves", JSON.stringify(moves), "|", text(messages.at(-1)).slice(0, 200));
ok(moves.length === 1 && orc.system.hp.value < hp0, "pushed away, hit the wall, took Force damage");
await actions.knockback(dmg);
wall = null;

console.log("== Knockback down");
refill(hero);
dialog = () => ({ mode: "strike", net: 0, stacks: 0, slam: "knockback" });
seq = [30]; await actions.rollWeaponAttack(hero, maul);
dialog = () => ({ net: 0 }); seq = [5]; await actions.defend(messages.at(-1), 0, "dodge");
dialog = () => ({ extra: 0 }); seq = [10]; await actions.rollExchangeDamage(messages.at(-1));
orc.system.hp.value = 432; orc.system.armor = null; const hp1 = orc.system.hp.value; moves.length = 0;
dialog = () => ({ dir: "down" }); await actions.knockback(messages.at(-1));
ok(orc.statuses.has("prone") && orc.system.hp.value < hp1 && moves.length === 0, "down: Force damage, prone, no move");
console.log("   ", text(messages.at(-1)).slice(0, 200));
orc.statuses.delete("prone");

console.log("== Bash through armor");
refill(hero); orcArmor.system.wear = 0; orc.system.armor = orcArmor; orc.system.hp.value = 432;
dialog = () => ({ mode: "strike", net: 0, stacks: 0, slam: "bash" });
seq = [30]; await actions.rollWeaponAttack(hero, maul);
ok(F().attack.opts.bash === Math.floor(maul.system.profile.capped / 4), `bash cap ${F().attack.opts.bash}`);
dialog = () => ({ net: 0 }); seq = [5]; await actions.defend(messages.at(-1), 0, "dodge");
const hp2 = orc.system.hp.value;
dialog = () => ({ extra: 0 }); seq = [10]; await actions.rollExchangeDamage(messages.at(-1));
console.log("   ", text(messages.at(-1)).slice(0, 300));
ok(/Bash: broke through Mail/.test(text(messages.at(-1))) && orcArmor.system.wear === 0, "armor Limit ignored and added as damage, no armor wear");

console.log("== Aim at the orc's cutlass");
refill(hero);
let seen = "";
dialog = c => { seen = c; return { mode: "strike", net: 0, stacks: 0, aim: orcSword.uuid }; };
seq = [30]; await actions.rollWeaponAttack(hero, maul);
ok(seen.includes("Orc's Cutlass") && seen.includes("Orc's Mail"), "Target choices: the orc, its held weapon and worn armor");
ok(text(messages.at(-1)).includes("vs Orc's Cutlass"), "card says what's targeted");
dialog = () => ({ net: 0 }); seq = [5]; await actions.defend(messages.at(-1), 0, "dodge");
const hp3 = orc.system.hp.value;
dialog = () => ({ extra: 0 }); seq = [10]; await actions.rollExchangeDamage(messages.at(-1));
ok(orcSword.system.wear > 0 && orc.system.hp.value === hp3 && !messages.at(-1).content.includes("fs-knockback"), `cutlass loses Durability (${orcSword.system.wear}), no HP damage`);
console.log("   ", text(messages.at(-1)).slice(0, 200));

console.log("== Throw a grappled creature down");
orc.system.hp.value = 432; orc.system.armor = null; await actions.setGrapple(orc, hero.uuid); refill(hero); game.user.targets = new Set();
const hp4 = orc.system.hp.value;
dialog = () => ({ dir: "down" }); await actions.throwGrappled(hero);
ok(orc.statuses.has("prone") && orc.system.hp.value < hp4 && !orc.statuses.has("grappled"), "slammed down: damage, prone, released");

console.log("== Knock the orc into a targeted goblin");
const gob = mkActor("Goblin"); place(gob, 16, 10); orc.statuses.delete("prone"); orc.system.hp.value = 432;
refill(hero); combat.combatant = { actor: hero }; game.user.targets = new Set([{ actor: orc }]);
orc.system.armor = null;
dialog = () => ({ mode: "strike", net: 0, stacks: 0, slam: "knockback" });
seq = [30]; await actions.rollWeaponAttack(hero, maul);
dialog = () => ({ net: 0 }); seq = [5]; await actions.defend(messages.at(-1), 0, "dodge");
dialog = () => ({ extra: 0 }); seq = [10]; await actions.rollExchangeDamage(messages.at(-1));
const kbCard = messages.at(-1);
game.user.targets = new Set([{ actor: gob }]);
let kseen = ""; dialog = c => { kseen = c; return { dir: "into" }; };
seq = [25]; await actions.knockback(kbCard);
const kAtk = messages.at(-1);
ok(kseen.includes("Into Goblin") && kAtk.flags.flowstate.attack.targets[0].name === "Goblin" && kAtk.flags.flowstate.attack.opts.knockInto, "targeted: a ranged attack roll against the goblin");
gob.isOwner = true; moves.length = 0; const g0 = gob.system.hp.value, o0 = orc.system.hp.value;
dialog = () => ({ net: 0 }); seq = [3]; await actions.defend(kAtk, 0, "dodge");
console.log("   ", text(messages.at(-1)).slice(0, 260));
ok(gob.system.hp.value < g0 && orc.system.hp.value < o0 && moves.length === 1 && moves[0][1] === 15, "hit: both take Force damage, orc lands beside the goblin");
ok(!text(messages.at(-1)).includes("released"), "no 'released' wording for knockback");
dialog = () => ({ dir: "away" }); const n = messages.length; await actions.knockback(kbCard);
ok(messages.length === n, "the Force can only be used once");
