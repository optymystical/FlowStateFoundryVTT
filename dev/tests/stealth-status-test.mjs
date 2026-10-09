// Mock just enough of Foundry to drive the attack exchange end to end.
class Field { constructor(o={}){ Object.assign(this,o); } }
let seq = [];                // queued die totals for the next rolls
const messages = [];
const uuids = new Map();
globalThis.foundry = {
  data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field } },
  abstract: { TypeDataModel: class {} },
  utils: { escapeHTML: s => s, deepClone: o => structuredClone(o), getProperty: (o,k)=>k.split(".").reduce((a,b)=>a?.[b],o) },
  applications: { api: { DialogV2: { prompt: async ({ content }) => content.includes('name="extra"') ? { extra: 1 } : { net: 0 } } } }
};
globalThis.Roll = class { constructor(f){ this.formula=f; } async evaluate(){ this.total = seq.length ? seq.shift() : 10; return this; } async render(){ return `<roll ${this.formula}=${this.total}>`; } };
globalThis.ChatMessage = { getSpeaker: ({actor}) => ({ alias: actor.name }),
  create: async d => { const m = { id: "m"+messages.length, ...d, getFlag: (s,k) => d.flags?.[s]?.[k] }; messages.push(m); return m; } };
let autoDmg = false;
globalThis.game = { settings: { get: (s, k) => k === "autoDamage" ? autoDmg : true }, messages: { find: fn => messages.find(fn), filter: fn => messages.filter(fn), get: id => messages.find(m=>m.id===id) }, combat: null,
  users: { activeGM: { id: "gm" } }, socket: { emit: (...a) => console.log("  socket emit", JSON.stringify(a[1])) }, user: { targets: new Set() } };
globalThis.ui = { notifications: { warn: m => console.log("  WARN", m), info: m => console.log("  INFO", m), error: m => console.log("  ERR", m) } };
globalThis.fromUuid = async u => uuids.get(u); globalThis.fromUuidSync = u => uuids.get(u);

const { FlowStateActorData } = await import("../../module/data.mjs");
const actions = await import("../../module/actions.mjs");
function mkActor(name, isOwner, extra={}) {
  const a = { name, uuid: "Actor."+name, isOwner, items: [], statuses: new Set(), updates: [] };
  a.update = async u => { a.updates.push(u); };
  a.system = Object.assign(Object.create(FlowStateActorData.prototype), { stats:{str:10,dex:10,con:10,pon:10,snap:10,will:10,reach:10,grasp:10,build:10}, skillPoints:30, size:3, hp:{value:432,lost:0}, energy:{value:0}, ap:{value:6}, rp:{value:6}, conditions:{ignite:0,stain:0,slow:0,haste:0}, lift:0, daysWithoutRest:0, ...extra }, { parent: a });
  a.system.prepareDerivedData(); uuids.set(a.uuid, a); return a;
}
let fails = 0; const ok2 = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const hero = mkActor("Hero", true), orc = mkActor("Orc", false);
game.user.targets = new Set([{ actor: orc }]);
const opts = { label: "Test Strike", net: 0, stealth: "none", melee: true, push: false, damage: "2d10", type: "physical", stacks: 0, physical: false, shots: 1, critStacks: 0, pierce: 0, knockback: 0, notes: [], followups: [] };
const W = actions.withStealthStatus;

console.log("== withStealthStatus");
ok2(W(hero, opts) === opts, "No status: the attack is unchanged");
hero.statuses.add("halfStealth");
ok2(W(hero, opts).stealth === "half" && W(hero, opts).notes.includes("Half stealth (GM)"), "Half Stealth status makes the attack a half stealth attack");
ok2(W(hero, { ...opts, stealth: "half" }).stealth === "half" && !W(hero, { ...opts, stealth: "half" }).notes.includes("Half stealth (GM)"), "An attack that already has half stealth (Targeted, Vector Assault) is still a single half, not two");
ok2(W(hero, { ...opts, stealth: "full" }).stealth === "full", "Half Stealth doesn't lower a full stealth attack");
ok2(W(hero, { ...opts, breakFree: true }).stealth === "none" && W(hero, { ...opts, throwGrappled: "x" }).stealth === "none" && W(hero, { ...opts, mental: { ward: true } }).stealth === "none", "Breaking free, throws and Ward rolls aren't attacks from stealth");
hero.statuses.add("fullStealth");
ok2(W(hero, opts).stealth === "full", "Full Stealth wins when both are on");
hero.statuses.clear();

console.log("== half stealth in the roll: Advantage on the attack, Disadvantage on the dodge");
const formulas = []; const Base = globalThis.Roll;
globalThis.Roll = class extends Base { constructor(f) { super(f); formulas.push(f); } };
const rolls = async o => { formulas.length = 0; seq = [20]; await actions.performAttack(hero, o); return [...formulas]; };
const plain = await rolls(opts);
hero.statuses.add("halfStealth");
const viaStatus = await rolls(opts);
const viaOpts = await (async () => { hero.statuses.clear(); return rolls({ ...opts, stealth: "half" }); })();
hero.statuses.add("halfStealth");
const both = await rolls({ ...opts, stealth: "half" });
ok2(JSON.stringify(plain) !== JSON.stringify(viaStatus), `the status changes the attack roll (${plain[0]} → ${viaStatus[0]})`);
ok2(JSON.stringify(viaStatus) === JSON.stringify(viaOpts), "the status gives exactly what half stealth from the attack gives");
ok2(JSON.stringify(both) === JSON.stringify(viaOpts), "status + half stealth from the attack is still one half stealth");
const atk = messages.at(-1); orc.isOwner = true; hero.isOwner = false; formulas.length = 0; seq = [10];
await actions.defend(atk, 0, "dodge");
const dodgeStatus = formulas[0];
hero.statuses.clear(); hero.isOwner = true; await actions.performAttack(hero, opts); const atk2 = messages.at(-1); formulas.length = 0; seq = [10]; await actions.defend(atk2, 0, "dodge");
ok2(dodgeStatus !== formulas[0], `the target's dodge gets Disadvantage (${formulas[0]} → ${dodgeStatus})`);

console.log("== full stealth: no dodge");
hero.statuses.add("fullStealth"); hero.isOwner = true;
const before = messages.length; seq = [30]; await actions.performAttack(hero, opts);
ok2(!messages.slice(before).some(m => m.content?.includes("fs-defend")) && messages.at(-1).flags?.flowstate?.defense?.result?.hit, "the target can't react and the attack lands");

console.log(fails ? `${fails} FAILED` : "all stealth status tests passed");
process.exit(fails ? 1 : 0);
