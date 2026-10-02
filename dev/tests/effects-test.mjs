globalThis.Hooks = { on: () => {}, once: () => {} };
globalThis.foundry = { applications: { api: { HandlebarsApplicationMixin: C => C }, sheets: { ActorSheetV2: class {}, ItemSheetV2: class {} } },
  data: { fields: {} }, abstract: { TypeDataModel: class {} }, utils: {} };
globalThis.CONFIG = { statusEffects: [{ id: "psychedUp", name: "Psyched Up", img: "up.svg" }, { id: "grappled", name: "Grappled", img: "net.svg" }] };
const orc = { name: "Orc", uuid: "Actor.Orc" };
globalThis.fromUuidSync = u => (u === "Actor.Orc" ? orc : null);
const hero = { name: "Hero", uuid: "Actor.Hero", flags: { flowstate: { grappledBy: "Actor.Orc" } },
  getFlag: (s, k) => hero.flags[s][k],
  effects: [{ id: "e1", statuses: new Set(["psychedUp"]), name: "Psyched Up" }, { id: "e2", statuses: new Set(["grappled"]), name: "Grappled" },
    { id: "e3", statuses: new Set(), name: "Blessed", img: "b.svg" }, { id: "e4", statuses: new Set(), name: "Off", disabled: true }] };
orc.getFlag = () => undefined;
globalThis.game = { actors: [hero, orc] };
const { activeEffectRows } = await import("../../module/sheets.mjs");
for (const r of activeEffectRows(hero)) console.log(" ", r.name, "|", r.status, r.effectId, "|", r.detail);
orc.getFlag = () => undefined; orc.effects = [];
console.log(" orc rows:", activeEffectRows(orc).map(r => r.name + " → release " + r.release));
