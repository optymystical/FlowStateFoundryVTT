import { createRequire } from "node:module"; const require = createRequire(import.meta.url);
const H = require("handlebars"), fs = require("fs");
H.registerHelper("selectOptions", (o, { hash }) => new H.SafeString(Object.entries(o).map(([k, v]) => `<option value="${k}"${k === hash.selected ? " selected" : ""}>${v}</option>`).join("")));
const settings = { startingStatPoints: 45, startingItems: 3, startingGrade: 1, startingMaxRarity: "uncommon" };
const created = []; const chats = [];
globalThis.Hooks = { on() {}, once() {} };
globalThis.foundry = { utils: { expandObject: o => { const r = {}; for (const [k, v] of Object.entries(o)) { const ps = k.split("."); let t = r; ps.slice(0, -1).forEach(p => t = t[p] ??= {}); t[ps.at(-1)] = v; } return r; }, deepClone: o => structuredClone(o), escapeHTML: s => s },
  applications: { api: { HandlebarsApplicationMixin: C => C, ApplicationV2: class { render() { this.rendered = (this.rendered ?? 0) + 1; } close() { this.closed = true; } } }, instances: new Map() } };
globalThis.game = { settings: { get: (s, k) => settings[k] }, user: { id: "P1", isGM: false, can: () => false }, users: { activeGM: { id: "GM" }, get: id => ({ id, name: "Player One", isGM: false, character: null, update: async u => log("user.update", JSON.stringify(u)) }), filter: () => [] } };
globalThis.ui = { notifications: { warn: m => log("WARN", m), info: m => log("INFO", m), error: m => log("ERR", m) } };
globalThis.Actor = { create: async d => { created.push(d); return { id: "NEW", name: d.name }; } };
globalThis.ChatMessage = { create: async d => chats.push(d) };
const log = (...a) => console.log(" ", ...a);
const actions = await import("../../module/actions.mjs");
const { CharacterWizard, createCharacterForUser } = await import("../../module/wizard.mjs");
actions.GM_ACTIONS.createCharacter = createCharacterForUser;
let emitted = null; game.socket = { emit: (ch, d) => { emitted = d; } };

const w = new CharacterWizard();
const tpl = H.compile(fs.readFileSync(new URL("../../templates/wizard.hbs", import.meta.url), "utf8"));
const view = async () => { const ctx = await w._prepareContext({}); return { ctx, text: tpl(ctx).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() }; };
const change = obj => CharacterWizard.onChange.call(w, null, null, { object: obj });

console.log("== Step 1: Ancestry"); let v = await view(); log(v.text.slice(0, 160));
CharacterWizard.onPickAncestry.call(w, null, { dataset: { id: "dwarf" } });
v = await view(); log("Ancestries offered:", v.ctx.ancestries.length, "| picked:", v.ctx.anc?.name);
// Tree chips: a click opens the tree's tiers under the card, as on the Skill Trees step.
{ const dw = v.ctx.ancestries.find(x => x.id === "dwarf");
  if (!dw.chips.length || dw.openTree) throw new Error("FAIL the Dwarf card has no tree chips, or one is open already");
  CharacterWizard.onTreeToggle.call(w, null, { dataset: { key: dw.chips.at(-1).key } });
  const v2 = await view(), open = v2.ctx.ancestries.find(x => x.id === "dwarf").openTree;
  if (!open?.tiers.length || !/T5/.test(v2.text)) throw new Error("FAIL the opened ancestry tree shows no tiers");
  log("Dwarf trees:", dw.chips.map(c => c.label).join(", "), "| opened:", open.name, open.tiers.map(t => `T${t.tier}`).join(" "));
  CharacterWizard.onTreeToggle.call(w, null, { dataset: { key: dw.chips.at(-1).key } });
  if ((await view()).ctx.ancestries.find(x => x.id === "dwarf").openTree) throw new Error("FAIL a second click doesn't close it"); }
CharacterWizard.onNext.call(w);
console.log("== Step 2: Background (Recruit: a Dwarf takes Heavy Armor for Medium Armor)");
v = await view(); log("Backgrounds for a Dwarf:", v.ctx.backgrounds.map(b => b.name).join(", "));
{ const rec = v.ctx.backgrounds.find(b => b.id === "recruit"), chips = rec.groups.flatMap(g => g.chips);
  const gen = chips.find(c => c.id.startsWith("generic-"));
  if (!gen) throw new Error("FAIL the Recruit card has no Generic Group chips");
  CharacterWizard.onTreeToggle.call(w, null, { dataset: { key: gen.key } });
  const open = (await view()).ctx.backgrounds.find(b => b.id === "recruit").openTree;
  if (!open || open.tiers.filter(t => t.owned).length !== gen.tier) throw new Error("FAIL the Generic tree's tiers (the Background's tiers marked owned)");
  log("Recruit trees:", rec.groups.map(g => g.chips.map(c => c.label).join(g.choice ? " / " : ", ")).join(" | "), "| opened:", open.name);
  CharacterWizard.onTreeToggle.call(w, null, { dataset: { key: gen.key } }); }
CharacterWizard.onPickBackground.call(w, null, { dataset: { id: "recruit" } });
v = await view(); log("choices:", v.ctx.slots.map(x => `${x.label} [${x.choices.map(c => c.name).join("/")}]`).join(" | "));
change({ "abc.picks.2": "martial-bladed-weapons", "abc.picks.4": "generic-courage" });
v = await view(); log("free trees:", v.ctx.freeList.join(", "), "| errors:", v.ctx.freeErrors.length ? v.ctx.freeErrors : "none");
CharacterWizard.onNext.call(w);
console.log("== Step 3: Culture");
v = await view(); log("Homelands:", v.ctx.homelands.map(h => h.name).join(", ")); log("Circles:", v.ctx.circles.map(c => c.name).join(", "));
change({ "abc.homeland": "dwarf.iron-republic", "abc.circle": "recruit.barracks-raised" });
CharacterWizard.onNext.call(w);
console.log("== Step 4: stats (spend 40 of 45)");
change({ "stats.str": 15, "stats.dex": 5, "stats.con": 10, "stats.will": 5, "stats.build": 5 });
v = await view(); log(v.text.match(/\d+ of 45 stat points left[^.]*\./)[0]); log(v.text.slice(v.text.indexOf("HP "), v.text.indexOf("HP ") + 110));
change({ "stats.dex": -4 }); log("negative Dex clamps to", w.state.stats.dex); change({ "stats.dex": 5 });
CharacterWizard.onNext.call(w);
console.log("== Step 5: skill trees (15 SP; the Background's tiers are free)");
v = await view(); log(`${v.ctx.remainingSP} of ${v.ctx.skillPoints} SP left; groups: ${v.ctx.archetypes.map(a => a.label).slice(0, 3).join(", ")}...`);
log("ancestry rows:", v.ctx.treeRows.map(r => `${r.name} ${r.tier}`).join(", "));
CharacterWizard.onTreeUp.call(w, null, { dataset: { tree: "ancestry-wusonian" } });
change({ skillArch: "martial" }); v = await view();
const ha = v.ctx.treeRows.find(r => r.id === "martial-heavy-armor"); log("Heavy Armor:", ha.tier, "free", ha.freeTier, "| can lower:", ha.canLower);
CharacterWizard.onTreeDown.call(w, null, { dataset: { tree: "martial-heavy-armor" } });
CharacterWizard.onTreeUp.call(w, null, { dataset: { tree: "martial-heavy-armor" } });
v = await view(); log(`Heavy Armor to 3 costs 3: ${v.ctx.remainingSP} SP left`);
CharacterWizard.onNext.call(w);
console.log("== Step 4: equipment");
CharacterWizard.onAddItem.call(w, null, { dataset: { kind: "weapon" } });
CharacterWizard.onAddItem.call(w, null, { dataset: { kind: "armor" } });
change({ "items.0.type": "bladed", "items.0.weight": "heavy" });   // hardwood isn't heavy → auto-fixes to iron
v = await view(); log(v.ctx.items.map(i => `${i.name} [${i.summary}]`).join(" | "));
log("materials offered for heavy weapons:", Object.values(v.ctx.items[0].materials).join(", "));
log("can add another armor?", v.ctx.canAddArmor, "| slots left:", v.ctx.slotsLeft);
CharacterWizard.onNext.call(w);
console.log("== Step 7: Notes"); change({ name: "Kara Voss", img: "", "details.age": "22", "details.backstory": "Ran away from the arms-works." });
v = await view(); log("errors:", v.ctx.errors.length ? v.ctx.errors : "none", "| Create enabled:", v.ctx.ready);
await CharacterWizard.onFinish.call(w);
log("sent to GM:", emitted?.action, "| wizard closed:", !!w.closed);

console.log("== GM receives it and creates the character");
await createCharacterForUser({ userId: emitted.userId, choice: emitted.choice });
const a = created[0];
log(`${a.name}: stats ${JSON.stringify(a.system.stats)}, SP ${a.system.skillPoints}, banked ${a.system.unspentStats}, creation ${a.system.creation}`);
log(`size ${a.system.size} | abc ${JSON.stringify(a.system.abc)} | trees ${JSON.stringify(a.system.trees)} | free ${JSON.stringify(a.system.freeTrees)} | details ${JSON.stringify(a.system.details)}`);
if (a.system.trees["martial-heavy-armor"] !== 3 || a.system.freeTrees["martial-heavy-armor"] !== 2 || a.system.trees["ancestry-wusonian"] !== 1 || a.system.abc.ancestry !== "dwarf") throw new Error("FAIL the created character's trees or ABCs");
log("ownership", JSON.stringify(a.ownership), "| items:", a.items.map(i => i.name).join(", "));

console.log("== A tampered request (too many stat points, rare material, a Human-only Background) is refused by the GM");
const bad = structuredClone(emitted.choice); bad.stats.str = 70; bad.items[0].material = "scarletite"; bad.abc.background = "explorer";
await createCharacterForUser({ userId: "P1", choice: bad });
log("actors created:", created.length, "| GM whisper:", chats.at(-1).content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
