// The character tutorial (tutorial.mjs, tutorial-rules.mjs, tutorial-text.mjs): the New Character prompt and its "ask me again", the railroaded
// wizard (popups per step, Next blocked until a step is complete, then locked in; no going back), the archetype and equipment advice (★),
// and the wizard's "a pick hides the other cards" change.
import { createRequire } from "node:module"; const require = createRequire(import.meta.url);
const H = require("handlebars"), fs = require("fs");
H.registerHelper("selectOptions", (o, { hash }) => new H.SafeString(Object.entries(o).map(([k, v]) => `<option value="${k}"${k === hash.selected ? " selected" : ""}>${v}</option>`).join("")));
const settings = { startingStatPoints: 45, startingItems: 3, startingGrade: 1, startingMaxRarity: "uncommon", tutorialOffer: true, tutorialAsk: true };
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
ok(popups.at(-1).title === "New Character" && settings.tutorialAsk === false && opened.at(-1) === "CharacterWizard", "No (ask again unticked): never asked again, straight to the normal wizard");
popups.length = 0; await T.openNewCharacter();
ok(!popups.length && opened.at(-1) === "CharacterWizard", "...and the next New Character goes straight to the wizard");
settings.tutorialAsk = true; answer = () => "no-again"; await T.openNewCharacter();
ok(settings.tutorialAsk === true, "No with \"ask me again\" ticked: asked next time too");
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
CharacterWizard.onChange.call(w, null, null, { object: { "abc.picks.2": "martial-bladed-weapons", "abc.picks.4": "generic-courage" } });
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
ok(titles().join() === "Step 5: Skill Trees" && /Martial Theory 2/.test(popups[0].html) && ctx.archetypes.find(a => a.selected)?.id === "martial",
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
answer = () => "skip"; popups.length = 0;
await T.TutorialWizard.onTutorialFinish.call(w);
ok(w.closed && titles().at(-1) === "Your character is ready!" && popups.at(-1).buttons.join() === "sheet,skip", "Finish: the character is made, then the character sheet tutorial is offered");
popups.length = 0; await T.TutorialWizard.onTutorialAgain.call(w);
await new Promise(r => setTimeout(r, 5));

if (fails) { console.log(`${fails} failed`); process.exit(1); }
console.log("tutorial tests passed");
