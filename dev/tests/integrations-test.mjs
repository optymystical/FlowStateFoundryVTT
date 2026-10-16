class Field { constructor(o={}){ Object.assign(this,o); } }
const hooks = {}; const called = [];
globalThis.Hooks = { on() {}, once(n, f) { (hooks[n] ??= []).push(f); }, call(n, a) { called.push([n, a]); return true; }, callAll() {} };
globalThis.foundry = { data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field, ObjectField: Field } }, abstract: { TypeDataModel: class {} },
  utils: { escapeHTML: s => String(s).replace(/</g, "&lt;") },
  applications: { api: { HandlebarsApplicationMixin: C => C }, sheets: { ActorSheetV2: class {}, ItemSheetV2: class {} } } };
globalThis.game = { system: { id: "flowstate" }, combat: null, actors: [] };
const { FlowStateActorData, FlowStateWeaponData } = await import("../../module/data.mjs");
const I = await import("../../module/integrations.mjs");
const actions = await import("../../module/actions.mjs");
let fails = 0; const ok = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };

// Carousel
const cfg = { defaultAttributesConfig: () => ({ dnd5e: [1] }), CombatantPortrait: class { constructor(a) { this.actor = a; } } };
hooks["combat-tracker-dock-init"][0](cfg);
ok(cfg.defaultAttributesConfig().flowstate?.length === 4 && cfg.defaultAttributesConfig().dnd5e, "Carousel: Flow State default attributes added");

// Actor
const actor = { name: "Hero", type: "character", isOwner: true, items: [], statuses: new Set(), flags: {}, getFlag(s, k) { return this.flags[k]; } };
actor.items.get = id => actor.items.find(i => i.id === id);
const fist = { id: "fist", name: "Unarmed", type: "weapon", parent: actor };
fist.system = Object.assign(Object.create(FlowStateWeaponData.prototype), { weaponType: "unarmed", weight: "light", material: "", equipped: true, secondHand: true }, { parent: fist });
actor.items.push(fist);
actor.system = Object.assign(Object.create(FlowStateActorData.prototype), { stats:{str:20,dex:20,con:10,pon:10,snap:10,will:10,reach:10,grasp:10,build:10}, skillPoints:30, size:3, hp:{value:400,lost:0}, energy:{value:150}, ap:{value:6}, rp:{value:6}, conditions:{ignite:0,stain:0,slow:0,haste:0}, lift:0, daysWithoutRest:0, trees: { "martial-theory": 1 } }, { parent: actor });
fist.system.prepareDerivedData(); actor.system.prepareDerivedData();
const portrait = new cfg.CombatantPortrait(actor);
ok(portrait.getDescription() === "Unarmored · Unarmed", `Carousel description: ${portrait.getDescription()}`);

// Token Action HUD
class ActionHandler { constructor() { this.added = []; } addActions(a, g) { this.added.push([g.id, a]); } }
class SystemManager {} class RollHandler {}
await hooks["tokenActionHudCoreApiReady"][0]({ api: { ActionHandler, SystemManager, RollHandler } });
const [name, mod] = called.find(c => c[0] === "tokenActionHudSystemReady") ?? [];
ok(name && mod.api.requiredCoreModuleVersion === "2", "TAH: system registered with Core");
const sm = new mod.api.SystemManager();
const defs = await sm.registerDefaults();
ok(defs.layout.length === 8 && defs.groups.some(g => g.id === "act-parry") && defs.groups.some(g => g.id === "act-magic") && defs.layout[0].groups[0].nestId === "combat_act-combat", "TAH: default layout and groups");
const ah = sm.getActionHandler(); ah.actor = actor;
await ah.buildSystemActions();
const combat = ah.added.find(([id]) => id === "act-combat")?.[1] ?? [];
const atk = combat.find(a => a.name === "Attack: Unarmed");
ok(atk && atk.info1?.text === "2 / 3 AP" && typeof atk.onClick === "function", "TAH: weapon attack action with cost");
ok(!ah.added.flatMap(([, a]) => a).some(a => a.name === "Grapple") && /Grapple/.test(atk.info2?.text ?? atk.tooltip ?? JSON.stringify(atk)), "TAH: Grapple is not its own action: it is an option of Attack: Unarmed");
ok(new Set(ah.added.flatMap(([, a]) => a.map(x => x.id))).size === ah.added.flatMap(([, a]) => a).length, "TAH: action ids unique");
// Click → same handler as the sheet.
let called2 = null;
const orig = actions.rollWeaponAttack;
globalThis.ui = { notifications: { warn: m => { called2 = m; } } };
actor.statuses.add("unconscious");
await atk.onClick();
ok(/unconscious and can't attack/.test(called2 ?? ""), `TAH: click reaches the sheet's attack handler (${called2})`);
actor.statuses.delete("unconscious"); called2 = null;
const { runActionRow } = await import("../../module/sheets.mjs");
await runActionRow(actor, { action: "martial", op: "release" });
ok(/isn't grappling/.test(called2 ?? ""), `TAH: martial op dispatch (${called2})`);
// Every Action List group in sheets.mjs must have a home in the HUD layout (so nothing in the list is missing from the HUD).
{
  const { readFileSync } = await import("node:fs");
  const { TAH_LAYOUT } = await import("../../module/integrations.mjs");
  const keys = [...readFileSync(new URL("../../module/sheets.mjs", import.meta.url), "utf8").matchAll(/key: "((?:act|react)-[a-z-]+)"/g)].map(m => m[1]);
  const placed = new Set(TAH_LAYOUT.flatMap(t => t.groups.map(g => g[0])));
  const missing = [...new Set(keys)].filter(k => !placed.has(k));
  ok(missing.length === 0, `TAH: every Action List and Reaction List group is in the HUD layout (missing: ${missing.join(", ") || "none"})`);
  ok(TAH_LAYOUT.find(t => t.id === "reactions")?.name === "Reaction List" && keys.includes("react-cards"), "TAH: the Reaction List has its own HUD tab");
}
// The Reaction List's switches reach the HUD, and a click toggles the same flag as the sheet.
{
  actor.system.trees["martial-rapid-weapons"] = 3; actor.flags = {}; actor.setFlag = async (s, k, v) => { actor.flags[k] = { ...(actor.flags[k] ?? {}), ...v }; };
  const ah2 = sm.getActionHandler(); ah2.actor = actor; await ah2.buildSystemActions();
  const mark = (ah2.added.find(([id]) => id === "react-cards")?.[1] ?? []).find(a => /Mark shot/.test(a.name));
  ok(mark && !ah2.added.some(([id]) => id === "act-reactions"), "TAH: the Mark shot switch is in the HUD's Reaction List, not the Action List");
  await mark.onClick();
  ok(actor.flags.autoDecline?.mark === true, "TAH: clicking it switches the card off");
}
// The Skills tab shows a Wonder's table (Fortune Table, Ruin Table) under its tiers.
{
  const { wonderTable } = await import("../../module/sheets.mjs");
  const skills = await import("../../module/skills.mjs");
  const ft = wonderTable(skills.treeById("mental-fortune-dream"), null, { power: 3 });
  const rt = wonderTable(skills.treeById("mental-ruin-nightmare"));
  ok(ft?.rows.length === 25 && ft.rows[0].roll === "1–3" && /Wonder Power \(3\)/.test(ft.note) && rt?.rows.length === 25 && rt.title === "The Ruin Table", "Skills tab: the Fortune and Ruin Tables, with how their values scale");
  ok(wonderTable(skills.treeById("mental-life-dream")) === null, "Skills tab: no table for a tree without one");
  const row = n => ft.rows.find(r => r.roll === n)?.effect ?? "";
  ok(/^Deals 3d12 physical damage/.test(row("1–3")) && /raised by 30 until/.test(row("32–35")) && /45 Slow stacks/.test(row("44–47")) && /15 Temp HP, restore 15 health/.test(row("98–100")) && /within 20ft/.test(row("1–3")),
    `Skills tab: the table's bolded values are worked out for Power 3, the rest stays (${row("98–100")})`);
  ok(/Deals 1d12 physical/.test(rt.rows[0].effect), "…and as printed at Power 1");
  for (const id of ["mental-light-dream", "mental-dark-nightmare"]) {
    const m = skills.treeById(id).tiers.find(t => t.tier === 1).entries[0];
    ok(m.sub?.length === 3 && /^Against an enemy/.test(m.sub[0]) && /^Against an ally/.test(m.sub[1]) && /^Enhanced/.test(m.sub[2]) && !/Against/.test(m.text), `${m.name}: its two versions and Enhanced are sub-points`);
  }
  for (const id of ["mental-fortune-dream", "mental-ruin-nightmare"]) {
    const bands = skills.treeById(id).tiers.find(t => t.tier === 1).entries.find(e => /Bands/.test(e.name));
    ok(bands?.sub?.length === 3 && !/Under one half/.test(bands.text), `${skills.treeById(id).name}: the Bands are three sub-points, not run into the text`);
  }
  const H = (await import("handlebars")).default, fs = await import("node:fs");
  const html = H.compile(fs.readFileSync(new URL("../../templates/actor-skills.hbs", import.meta.url), "utf8"))({ tab: {}, skillView: { trees: [], archetypes: [], points: {}, tree: { tiers: [] }, table: ft } });
  ok(/fs-wonder-table/.test(html) && (html.match(/<tr>/g) ?? []).length === 26, "Skills tab: the table renders (25 rows and a header)");
}
process.exit(fails ? 1 : 0);
