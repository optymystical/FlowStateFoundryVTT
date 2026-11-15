// The character tutorial (tutorial.mjs, tutorial-rules.mjs, tutorial-text.mjs): the New Character prompt (Yes/No), the railroaded
// wizard (popups per step, Next blocked until a step is complete, then locked in; no going back), the archetype and equipment advice (★),
// the wizard's "a pick hides the other cards" change, and the sheet tutorial (sheet-tour.mjs, sheet-tour-text.mjs).
import { createRequire } from "node:module"; const require = createRequire(import.meta.url);
const H = require("handlebars"), fs = require("fs");
H.registerHelper("selectOptions", (o, { hash }) => new H.SafeString(Object.entries(o).map(([k, v]) => `<option value="${k}"${k === hash.selected ? " selected" : ""}>${v}</option>`).join("")));
const settings = { startingStatPoints: 45, startingItems: 3, startingGrade: 1, startingMaxRarity: "uncommon", tutorialOffer: true };
const popups = []; let answer = () => "ok";
const opened = [];
globalThis.Hooks = { on() {}, once() {} };
globalThis.foundry = { utils: { expandObject: o => { const r = {}; for (const [k, v] of Object.entries(o)) { const ps = k.split("."); let t = r; ps.slice(0, -1).forEach(p => t = t[p] ??= {}); t[ps.at(-1)] = v; } return r; }, deepClone: o => structuredClone(o), escapeHTML: s => s },
  applications: { api: { HandlebarsApplicationMixin: C => C, ApplicationV2: class { render() { this.rendered = (this.rendered ?? 0) + 1; opened.push(this.constructor.name); return this; } close() { this.closed = true; } },
    DialogV2: { wait: async o => { popups.push({ title: o.window.title, html: o.content, buttons: o.buttons.map(b => b.action) }); return answer(o); } } }, instances: new Map() } };
globalThis.game = { settings: { get: (s, k) => settings[k], set: async (s, k, v) => { settings[k] = v; } }, user: { id: "P1", isGM: false, can: () => false },
  users: { activeGM: { id: "GM" }, get: id => ({ id, name: "Player One", isGM: false }), filter: () => [] }, socket: { emit: () => {} } };
const notes = [];
globalThis.ui = { notifications: { warn: m => notes.push(m), info: m => notes.push(m), error: m => notes.push(m) } };
let fails = 0; const ok = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };

const R = await import("../../module/tutorial-rules.mjs");
const T = await import("../../module/tutorial.mjs");
const { CharacterWizard } = await import("../../module/wizard.mjs");
const tpl = H.compile(fs.readFileSync(new URL("../../templates/wizard.hbs", import.meta.url), "utf8"));

console.log("== The advice");
ok(R.presetArchetypes({ "martial-theory": 2, "generic-resolve": 2 }).join() === "martial", "A Background with Martial Theory presets Martial");
ok(R.suggestedArchetype({ stats: { reach: 30, build: 10 }, freeTrees: {} }).id === "magic" && R.suggestedArchetype({ stats: { reach: 30 }, freeTrees: { "martial-theory": 2 } }).why === "background",
  "The suggested Archetype: the Background's first, else where the stats went");
const WT = ["unarmed", "bladed", "reach"], AW = ["light", "medium", "heavy", "titanic"];
let adv = R.equipmentAdvice({ stats: { dex: 25, con: 15 }, trees: { "martial-theory": 1, "martial-bladed-weapons": 2 }, weaponTypes: WT, armorWeights: AW });
ok(adv.highlight.weaponWeights.has("light") && !adv.highlight.weaponWeights.has("heavy") && adv.highlight.weaponTypes.has("bladed") && adv.highlight.armorWeights.has("medium"),
  "Martial: Dex → Light weapons, the Bladed tree → Bladed, Con → Light/Medium armor");
adv = R.equipmentAdvice({ stats: { reach: 30, build: 15 }, trees: {}, weaponTypes: WT, armorWeights: AW });
ok(adv.highlight.fociForms.has("channeler") && adv.highlight.add.has("shroud") && adv.highlight.add.has("affix") && !adv.highlight.add.has("weapon"),
  "Magic: Reach → a Channeler Foci, Build → a Shroud, Affixes; no weapon");
ok(R.equipmentAdvice({ stats: { reach: 20, grasp: 18 } }).highlight.fociForms.has("multi"), "Reach and Grasp close together → a Multi Foci");
adv = R.equipmentAdvice({ stats: { snap: 25, will: 15 }, trees: { "mental-theory": 1, "mental-death-nightmare": 2 } });
ok(adv.highlight.iconAligns.has("nightmare") && !adv.highlight.iconAligns.has("dream") && adv.highlight.add.has("icon"), "Mental: Snappence and a Nightmare tree → Nightmare Icon Forms");

console.log("== The New Character prompt");
answer = () => "no";
await T.openNewCharacter();
ok(popups.at(-1).title === "New Character" && !/checkbox/.test(popups.at(-1).html ?? popups.at(-1).content ?? "") && opened.at(-1) === "CharacterWizard", "No: the normal wizard (a plain Yes/No, nothing to tick)");
popups.length = 0; await T.openNewCharacter();
ok(popups.at(-1)?.title === "New Character", "...and the next New Character asks again");
answer = () => "yes"; await T.openNewCharacter();
ok(opened.at(-1) === "TutorialWizard", "Yes: the tutorial wizard");
settings.tutorialOffer = false; popups.length = 0; await T.openNewCharacter();
ok(!popups.length && opened.at(-1) === "CharacterWizard", "The GM's world setting off: nobody is asked");
settings.tutorialOffer = true;

console.log("== The wizard: a pick hides the other cards");
const plain = new CharacterWizard();
CharacterWizard.onPickAncestry.call(plain, null, { dataset: { id: "elf" } });
let ctx = await plain._prepareContext({});
ok(ctx.ancestries.filter(a => !a.hidden).map(a => a.id).join() === "elf" && /Change/.test(tpl(ctx)), "Picking an Ancestry hides the others (a Change button on the pick)");
CharacterWizard.onPickAncestry.call(plain, null, { dataset: { id: "elf" } });
ctx = await plain._prepareContext({});
ok(!plain.state.abc.ancestry && ctx.ancestries.every(a => !a.hidden), "...picking it again unpicks it: the whole list shows again");
CharacterWizard.onPickAncestry.call(plain, null, { dataset: { id: "human" } });
CharacterWizard.onChange.call(plain, null, null, { object: { "abc.homeland": (await plain._prepareContext({})).homelands[0].id } });
ctx = await plain._prepareContext({});
ok(ctx.homelands.filter(h => !h.hidden).length === 1, "A Homeland pick hides the other Homelands");
CharacterWizard.onClearCulture.call(plain, null, { dataset: { part: "homeland" } });
ok(!plain.state.abc.homeland, "...Change unpicks it");

console.log("== The tutorial");
const w = new T.TutorialWizard(); w.rendered = 1;
answer = o => (o.window.title === "Lock it in?" ? "go" : "ok");
const titles = () => popups.map(p => p.title);
const step = () => w.steps[w.state.step].id;
popups.length = 0; await w.coach();
ok(titles().join(" | ") === "Welcome to Flow State | Step 1: Ancestry", "Opening: the welcome, then the Ancestry step's explanation (over the wizard, modal)");
ctx = await w._prepareContext({});
ok(ctx.tutorial?.banner?.startsWith("Pick an Ancestry") && ctx.backDisabled, "The banner says what to do; Back is off");
popups.length = 0; await T.TutorialWizard.onTutorialNext.call(w);
ok(titles().join() === "Not yet" && step() === "ancestry", "Next before picking: \"Not yet\", the step stays");
T.TutorialWizard.onLocked.call(w); ok(/only goes forward/.test(notes.at(-1)), "Back and the step tabs are locked");
CharacterWizard.onPickAncestry.call(w, null, { dataset: { id: "dwarf" } });
answer = o => (o.window.title === "Lock it in?" ? "stay" : "ok");
popups.length = 0; await T.TutorialWizard.onTutorialNext.call(w);
ok(titles().join() === "Lock it in?" && /Dwarf/.test(popups[0].html) && step() === "ancestry", "Next asks to lock the Ancestry in; \"Not yet\" stays");
answer = o => (o.window.title === "Lock it in?" ? "go" : "ok");
await T.TutorialWizard.onTutorialNext.call(w);
ok(step() === "background", "...\"Lock it in\" moves on");
popups.length = 0; await w.coach();
ok(titles().join() === "Step 2: Background", "The Background step explains itself");
CharacterWizard.onPickBackground.call(w, null, { dataset: { id: "recruit" } });
popups.length = 0; await w.coach();
ok(titles().join() === "Recruit: your choices" && /One of these/.test(popups[0].html), "A Background with choices: a popup lists them");
popups.length = 0; await T.TutorialWizard.onTutorialNext.call(w);
ok(titles().join() === "Not yet" && step() === "background", "Next before the choices are made: \"Not yet\"");
for (const [slot, id] of [["2", "martial-bladed-weapons"], ["4", "generic-courage"]]) CharacterWizard.onPickChoice.call(w, null, { dataset: { slot, id } });
await T.TutorialWizard.onTutorialNext.call(w);
ok(step() === "culture", "Choices made: locked in, on to Culture");
popups.length = 0; await w.coach(); ok(titles().join() === "Step 3: Culture" && /Homeland/.test(popups[0].html) && /Circle/.test(popups[0].html), "Culture: Homeland and Circle explained");
ctx = await w._prepareContext({});
CharacterWizard.onChange.call(w, null, null, { object: { "abc.homeland": ctx.homelands[0].id, "abc.circle": ctx.circles[0].id } });
await T.TutorialWizard.onTutorialNext.call(w);
ok(step() === "stats", "On to Stats");
popups.length = 0; await w.coach();
ok(titles().join(" | ") === "Step 4: Stats | Which Archetype?" && /Strength/.test(popups[0].html) && /started you in <strong>Martial/.test(popups[1].html),
  "Stats: every stat explained, then \"stick to one Archetype\" (the Recruit's Background started them in Martial)");
CharacterWizard.onChange.call(w, null, null, { object: { "stats.dex": 30, "stats.con": 15 } });
await T.TutorialWizard.onTutorialNext.call(w);
ok(step() === "skills", "On to Skill Trees");
popups.length = 0; await w.coach();
ctx = await w._prepareContext({});
ok(titles().join() === "Step 5: Skill Trees" && /Martial Theory(<\/a>)? 2/.test(popups[0].html) && ctx.archetypes.find(a => a.selected)?.id === "martial",
  "Skill Trees: the Background's free trees listed; the list opens on Martial");
await T.TutorialWizard.onTutorialNext.call(w);
ok(step() === "equipment", "On to Equipment");
popups.length = 0; await w.coach();
ctx = await w._prepareContext({});
ok(titles().join() === "Step 6: Equipment" && /Light weapons/.test(popups[0].html) && /Bladed/.test(popups[0].html), "Equipment: what fits (Light weapons for Dexterity, a Bladed weapon for the tree)");
ok(ctx.suggest.weapon && ctx.suggest.armor && !ctx.suggest.foci && ctx.weaponTypes.bladed.startsWith("★") && /★ Weapon/.test(tpl(ctx)), "★ on the fitting add buttons and weapon type");
CharacterWizard.onAddItem.call(w, null, { dataset: { kind: "weapon" } });
ctx = await w._prepareContext({});
ok(ctx.items[0].weights.light.startsWith("★") && !ctx.items[0].weights.heavy.startsWith("★"), "...and on the fitting weight in a weapon's Weight box");
await T.TutorialWizard.onTutorialNext.call(w);
popups.length = 0; await w.coach();
ok(step() === "notes" && titles().join() === "Step 7: Notes", "Notes");
CharacterWizard.onChange.call(w, null, null, { object: { name: "Tess" } });
{ const gm = game.users.activeGM; game.users.activeGM = null; popups.length = 0;
  await T.TutorialWizard.onTutorialFinish.call(w);
  ok(!w.closed && !titles().includes("Your character is ready!"), "Finish with no GM connected: nothing is sent, the wizard stays open and the tutorial doesn't say it's ready");
  game.users.activeGM = gm; }
answer = () => "skip"; popups.length = 0;
await T.TutorialWizard.onTutorialFinish.call(w);
ok(w.closed && titles().at(-1) === "Your character is ready!" && popups.at(-1).buttons.join() === "sheet,skip", "Finish: the character is made, then the character sheet tutorial is offered");
popups.length = 0; await T.TutorialWizard.onTutorialAgain.call(w);
await new Promise(r => setTimeout(r, 5));

console.log("== The sheet tutorial: stops tailored to the character");
const ST = await import("../../module/sheet-tour-text.mjs");
const facts = over => ({ name: "Tess", has: {}, weapons: [], armor: [], foci: [], shrouds: [], icons: [], affixes: 0, unspentSP: 0, statPoints: 0,
  energyMax: 150, energyRecover: 15, hpMax: 160, pain: 80, attackDie: 30, dodgeDie: 15, speed: 50, moveCost: "1 AP per move", ancestry: "Dwarf", background: "Recruit", ...over });
const ids = st => st.map(x => x.id);
const mart = ST.sheetStops(facts({ has: { martial: true }, weapons: [{ name: "Heavy Bladed (Iron)", held: false }], armor: [{ name: "Heavy Armor", worn: false }] }));
ok(["weapons", "armor", "gear", "actions", "attack", "exchange", "defend", "move", "done"].every(x => ids(mart).includes(x)) && !["foci", "shroud", "icons", "act-magic", "act-mental"].some(x => ids(mart).includes(x)),
  "A Martial character: weapons, armor and the first turn; no Foci, Shroud, Icon or casting stops");
ok(/still packed away/.test(mart.find(x => x.id === "weapons").html) && /isn't on yet/.test(mart.find(x => x.id === "armor").html) && /Foci, Shrouds and Affixes \(Magic\)/.test(mart.find(x => x.id === "gear").html),
  "...it's told to hold its weapon and put its armor on, and the other Archetypes' sections get one line");
ok(/Attack: \(weapon\)/.test(mart.find(x => x.id === "attack").html) && !/Cast Spell|Manifest/.test(mart.find(x => x.id === "attack").html), "...and how a Martial attacks (only)");
const mage = ST.sheetStops(facts({ has: { magic: true }, foci: [{ name: "Igniter Foci", attuned: true, held: false }], shrouds: [{ name: "Shroud", attuned: true }], affixes: 1 }));
ok(["foci", "shroud", "affixes", "act-magic"].every(x => ids(mage).includes(x)) && !ids(mage).includes("act-mental") && [mage.find(x => x.id === "attack").target].flat()[0] === "[data-section=act-magic]",
  "A Magic character: Foci, Shroud, Affixes, Cast Spell, and the first-turn stop points at the Magic group");
ok(/isn't in your hand yet/.test(mage.find(x => x.id === "foci").html), "...told to hold its Foci");
const mind = ST.sheetStops(facts({ has: { mental: true }, icons: [{ name: "Icon", attuned: true }] }));
ok(ids(mind).includes("icons") && ids(mind).includes("act-mental") && /Manifest/.test(mind.find(x => x.id === "attack").html), "A Mental character: Icons, Manifest");
const none = ST.sheetStops(facts({}));
ok(/Cast Spell/.test(none.find(x => x.id === "attack").html) && /Manifest/.test(none.find(x => x.id === "attack").html), "No Archetype yet: every way to attack is explained");
const all = [...mart, ...mage, ...mind, ...none];
ok(all.every(x => x.title && x.html && !/undefined|NaN|\[object/.test(x.title + x.html)), "Every stop has a title and words (nothing undefined)");
{ const src = ["actor-header", "actor-main", "actor-skills", "actor-actions", "actor-reactions", "actor-equipment", "actor-misc", "actor-notes"]
    .map(f => fs.readFileSync(new URL(`../../templates/${f}.hbs`, import.meta.url), "utf8")).join("\n") + fs.readFileSync(new URL("../../module/sheets.mjs", import.meta.url), "utf8");
  const missing = all.filter(x => x.target).flatMap(x => [x.target].flat()).flatMap(t => [...t.matchAll(/\.([a-z][\w-]*)|data-section=([\w-]+)|data-tab=([\w-]+)/g)].map(m => m[1] ?? m[2] ?? m[3]))
    .filter(k => !src.includes(k));
  ok(!missing.length, `Every stop's outline points at something the sheet has${missing.length ? ` (missing: ${[...new Set(missing)].join(", ")})` : ""}`); }

console.log("== The sheet tutorial: the character's own abilities by name");
{ const groups = [
    { key: "act-combat", name: "Combat", rows: [{ label: "Attack: Iron Sword", detail: "5d12 Physical", cost: "3 AP" }, { label: "Move", detail: "50 ft", cost: "1 AP" }] },
    { key: "act-magic", name: "Magic", rows: [{ label: "Cast Spell", detail: "Slash, Pierce", cost: "AP/RP + Energy" }, { label: "Spirit Sense", detail: "Spot check", cost: "Check" }] },
    { key: "act-generic", name: "Generic", rows: [{ label: "First Aid", detail: "Heal a creature", cost: "2 AP" }] },
    { key: "act-checks", name: "Checks", rows: [{ label: "Stealth", detail: "", cost: "d30" }, { label: "Perception", detail: "", cost: "d30" }] }];
  const reacts = [{ key: "react-auto", name: "Automation", rows: [{ label: "Auto-Dodge: off" }] }, { key: "react-popups", name: "Popups", rows: [{ label: "Riposte", detail: "Strike back after a dodge" }] }];
  const st = ST.sheetStops(facts({ has: { martial: true, magic: true }, groups, reacts, trees: [{ id: "martial-theory", name: "Martial Theory", tier: 2, free: true }],
    weapons: [{ name: "Iron Sword", held: true }], foci: [{ name: "Igniter Foci", attuned: true, held: true }] }));
  const html = id => st.find(x => x.id === id)?.html ?? "";
  ok(/Attack: Iron Sword/.test(html("actions")) && /Move/.test(html("actions")) && /Generic/.test(html("actions")), "The Action List stop names the Combat rows and the other groups");
  ok(/\[\[Slash\|Slash\]\]/.test(html("act-magic")) && /Spirit Sense/.test(html("act-magic")), "Casting names the Core Spells (linked) and the rest of the Magic group");
  ok(st.some(x => x.id === "group:act-generic" && /First Aid/.test(x.html) && x.target === "[data-section=act-generic]"), "Every other group gets its own stop naming its rows");
  ok(/Stealth/.test(html("checks")) && /Riposte/.test(html("reactions")) && !/Auto-Dodge: off/.test(html("reactions").split("These can ask you")[1]?.split("</ul>")[0] ?? ""), "Checks and the Reaction List name the character's own rows");
  ok(/\[\[tree:martial-theory\|Martial Theory\]\] 2 \(from your Background\)/.test(html("trees").replace(/<\/?strong>/g, "")), "The trees stop names the character's trees");
  ok(/Attack: Iron Sword/.test(html("attack")) && /Slash/.test(html("attack")), "The first-turn attack stop names the attack rows and the spells"); }

console.log("== Codex links in the popups");
ok(T.codexLinks("[[stat:str|Strength]] and [[Nope|nope]] and [[Bare]]", k => (k === "stat:str" ? "stat:str" : null))
  === '<a class="fs-codex-name" data-codex="stat:str" data-tooltip="Open in the Codex">Strength</a> and nope and Bare', "[[page|label]] becomes a Codex link, or just the label when there's no page");
{ const C = await import("../../module/codex.mjs"), TT = await import("../../module/tutorial-text.mjs");
  const statLabels = { str: "Strength", dex: "Dexterity", con: "Constitution", pon: "Ponderance", snap: "Snappence", will: "Willpower", reach: "Reach", grasp: "Grasp", build: "Build" };
  const arg = { ancestry: "Dwarf", background: "Recruit", lines: [], points: 45, statLabels, preset: ["martial"], free: [], sp: 10, items: 3, rarity: "Uncommon", name: "T", archetype: "martial", why: "stats" };
  const texts = [...Object.values(TT.POPUPS).map(f => { try { return f(arg)?.html ?? ""; } catch { return ""; } }),
    ...TT.choiceLines({ focus: [], slots: [{ label: "One of these", choices: [{ id: "martial-bladed-weapons", name: "Bladed Weapons" }] }] }), ...all.map(x => x.html)].join("\n");
  const keys = [...new Set([...texts.matchAll(/\[\[([^\]|]+)/g)].map(m => m[1]).filter(k => k.includes(":")))];
  const dead = keys.filter(k => !C.findPage(k));
  ok(keys.length > 20 && !dead.length, `Every page id a popup links to is in the Codex (${keys.length} checked${dead.length ? `; dead: ${dead.join(", ")}` : ""})`); }

console.log("== The sheet tutorial: placing the popup");
const TS = await import("../../module/sheet-tour.mjs");
ok(TS.placeNear({ left: 100, top: 50, right: 1000, width: 900 }, null, { width: 1600, height: 900 }).left === 1008, "Room on the right: beside the sheet");
ok(TS.placeNear({ left: 700, top: 50, right: 1600, width: 900 }, null, { width: 1600, height: 900 }).left === 212, "Room on the left: beside it there");
ok(TS.placeNear({ left: 0, top: 0, right: 800, width: 800 }, { top: 500, bottom: 560, height: 60 }, { width: 800, height: 600 }, 480, 300).top === 188, "No room: over the sheet, above a low outline");
ok(TS.placeNear({ left: 0, top: 0, right: 800, width: 800 }, { top: 60, bottom: 120, height: 60 }, { width: 800, height: 600 }, 480, 300).top === 132, "...and below a high one");
ok(TS.placeNear({ left: 0, top: 0, right: 800, width: 800 }, { top: 140, bottom: 180, height: 40 }, { width: 800, height: 600 }, 480, 430).top === 162, "A tall popup that doesn't fit below a high outline stays inside the window");
ok(TS.placeNear({ left: 0, top: 0, right: 800, width: 800 }, { top: 300, bottom: 760, height: 460 }, { width: 800, height: 600 }, 480, 440).top === 8, "...and one under a huge outline goes to the top");

console.log("== The sheet tutorial: the tour");
{ const el = cls => { const c = new Set(); return { classList: { add: x => c.add(x), remove: x => c.delete(x), has: x => c.has(x) }, cls: c, open: false, scrollIntoView() {} }; };
  const parts = new Map();
  const root = { ...el(), querySelector: q => { if (!parts.has(q)) parts.set(q, el()); return parts.get(q); }, querySelectorAll: () => [] };
  const tabs = [];
  const sheet = { rendered: true, tabGroups: { primary: "main" }, element: root, render: async () => sheet, changeTab(t) { this.tabGroups.primary = t; tabs.push(t); }, position: {} };
  const actor = { id: "A1", name: "Tess", type: "character", sheet, items: [], system: { stats: { str: 30, con: 15 }, trees: { "martial-theory": 2 }, derived: { attackDie: 30, dodgeDie: 15, energyRecover: 15 },
    hp: { max: 160, pain: 80 }, energy: { max: 150 }, movement: { speed: 50 }, skills: { unspent: 4 }, unspentStats: 0, abc: {} } };
  const n = ST.sheetStops(TS.tourFacts(actor)).length;
  let k = 0; const seen = [];
  answer = o => { seen.push(o.window.title); k++; return k === 3 ? "back" : "next"; };
  popups.length = 0;
  await TS.startSheetTour(actor);
  ok(popups.length === n + 2 && seen[1] === seen[3] && popups.at(-1).buttons.join() === "back,next", `Next through every stop (${n}), Back goes back one, the last one is Finish`);
  ok(["main", "skills", "equipment", "actions", "reactions", "misc", "notes"].every(t => tabs.includes(t)), "The tour switches the sheet to each tab");
  ok(parts.get('details[data-section="weapons"]')?.open === true && ![...parts.values()].some(p => p.cls.has("fs-tour-target")), "It opens the section it explains, and leaves no outline behind");
  ok(popups[0].buttons.join() === "next,end", "The first stop: Next or End tour");
  // A group the character doesn't have (no Magic rows yet) is skipped, going forward and back.
  const mageFacts = { ...actor, id: "A2", system: { ...actor.system, stats: { reach: 30 }, trees: {} } };
  const gone = new Set(["[data-section=act-magic]"]), q0 = root.querySelector;
  root.querySelector = q => (gone.has(q) ? null : q0(q));
  popups.length = 0; seen.length = 0; answer = o => { seen.push(o.window.title); return "next"; };
  await TS.startSheetTour(mageFacts);
  ok(!seen.includes("Casting spells") && seen.includes("Checks"), "A stop whose group isn't on the sheet yet (Casting spells with no spells) is skipped");
  root.querySelector = q0;
  answer = () => "end"; popups.length = 0;
  await TS.startSheetTour(actor);
  ok(popups.length === 1, "End tour stops it");
  answer = () => "ok"; }

if (fails) { console.log(`${fails} failed`); process.exit(1); }
console.log("tutorial tests passed");
