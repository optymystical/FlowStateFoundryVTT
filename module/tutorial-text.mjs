/**
 * The character tutorial's words (pure: no Foundry globals). Each popup is { title, html }; the wizard's banner lines are plain strings.
 * Written for someone who has never played a tabletop RPG. Edit freely: tutorial.mjs only decides when each one shows.
 */
import { esc } from "./html.mjs";
import { ARCHETYPES } from "./tutorial-rules.mjs";

const p = s => `<p>${s}</p>`;
const ul = items => `<ul class="fs-tut-list">${items.map(i => `<li>${i}</li>`).join("")}</ul>`;
const tip = s => `<p class="fs-tut-tip"><i class="fa-solid fa-lightbulb"></i> ${s}</p>`;
const warn = s => `<p class="fs-tut-warn"><i class="fa-solid fa-lock"></i> ${s}</p>`;
const list = arr => (arr.length <= 1 ? arr.join("") : `${arr.slice(0, -1).join(", ")} and ${arr.at(-1)}`);

export const STAT_TEXT = {
  str: "how much force you put into each action. Heavy weapons deal damage with it.",
  dex: "how quickly you react and act. Light weapons deal damage with it.",
  con: "how much punishment you can take. Your armor gets stronger with it, and it raises your Health.",
  pon: "how well you hold long-term thoughts. Dream Wonders get their power from it.",
  snap: "how fast you react to what's right in front of you. Nightmare Wonders get their power from it.",
  will: "how strong and steady your mind is. Your Icon's Ward (its defense) gets stronger with it, and it raises your Health.",
  reach: "how much energy your spirit can move at once. Channeler Foci cast with it.",
  grasp: "how well you understand magic. Igniter Foci cast with it.",
  build: "how tough and dense your spirit is. Your Shroud gets stronger with it, and it raises your Health."
};

/** Popups, by step. `c` is what the tutorial knows: names, counts, the player's picks. */
export const POPUPS = {
  welcome: () => ({ title: "Welcome to Flow State", html: [
    p("This tutorial walks you through making your first character, one step at a time, and explains what each choice means as you go."),
    ul(["<strong>These windows</strong> explain each step. Read them, then click the button at the bottom to carry on.",
      "<strong>The bar at the top of the wizard</strong> always tells you what to do next.",
      "<strong>Anything underlined or with a <i class=\"fa-solid fa-book-open\"></i> book icon</strong> opens its page in the Codex, the game's rulebook, if you want to know more."]),
    warn("The tutorial only goes forward. When you hit <strong>Next</strong>, that step is locked in for the rest of the tutorial, so take your time before you do. (You can always close the wizard and start over.)")
  ].join("") }),

  ancestry: () => ({ title: "Step 1: Ancestry", html: [
    p("Your <strong>Ancestry</strong> is the people you were born to: Human, Dwarf, Elf, Orc and so on. It sets your <strong>Size</strong> (how big you are) and gives you your Ancestry's own <strong>skill trees</strong>: abilities only your people have."),
    p("Each card shows what that people is like. The buttons under <strong>Trees</strong> show what their abilities do: click one to read its tiers, and click it again to close it."),
    tip("There's no wrong answer here. Pick whichever people sounds most interesting to play. When you pick one, the other cards hide; click your pick again (or <strong>Change</strong>) to see them all again.")
  ].join("") }),
  gland: () => ({ title: "Drakenblood: your Elemental Gland", html: [
    p("Drakenblood have an <strong>Elemental Gland</strong>: an element they're tied to. It's the element of your breath attack, and the one your scales protect you from."),
    p("Pick it in the box under your Ancestry card. It's yours for good, so pick the element you like the sound of most.")
  ].join("") }),

  background: c => ({ title: "Step 2: Background", html: [
    p(`Your <strong>Background</strong> is how you were raised and what you did before the story began. The list shows the Backgrounds open to ${esc(c.ancestry)}.`),
    p("Each Background gives you <strong>15 free points</strong> of skill trees to start with. They're free: they don't come out of the Skill Points you'll spend later. The buttons on each card show those trees; click one to read it."),
    tip("Some Backgrounds hand you an <strong>Archetype</strong> (Martial, Magic or Mental) through its Theory tree: Recruit leans Martial, Apprentice Mage leans Magic, Novice leans Mental. If you already know which kind of character you want to play, pick a Background that gives you that one."),
    p("Like before, picking one hides the others; click it again (or <strong>Change</strong>) to see the whole list.")
  ].join("") }),
  choices: c => ({ title: `${esc(c.background)}: your choices`, html: [
    p(`${esc(c.background)} lets you choose part of what it gives you. The boxes under its card are those choices:`),
    ul(c.lines),
    p("Click a tree's name on the card to read it before you choose. You'll be able to hit Next once every choice is made.")
  ].join("") }),

  culture: c => ({ title: "Step 3: Culture", html: [
    p("Your <strong>Culture</strong> is where you come from and who you grew up with. It's made of two picks:"),
    ul([`<strong>Homeland:</strong> the people and place you come from. You can pick one of ${esc(c.ancestry)}'s Homelands or a Shared one anyone can have.`,
      `<strong>Circle:</strong> the group you came up in through your Background. You can pick one of ${esc(c.background)}'s Circles or a Shared one.`]),
    p("Together they shape your character's values, customs and ties to the world. Culture is <strong>purely roleplay</strong>: it doesn't change any numbers, so pick what makes your character's story more interesting."),
    tip("Picking one hides the others; click <strong>Change</strong> to see the list again.")
  ].join("") }),

  stats: c => ({ title: "Step 4: Stats", html: [
    p(`You have <strong>${c.points}</strong> stat points to place. There are nine stats, three for each <strong>Archetype</strong>, the three ways to play:`),
    ...Object.values(ARCHETYPES).map(a => `<h4 class="fs-tut-head">${a.label}: ${a.blurb}</h4>${ul(a.stats.map(k => `<strong>${esc(c.statLabels[k])}:</strong> ${STAT_TEXT[k]}`))}`),
    p("Some things to know:"),
    ul(["Your <strong>Health</strong> comes from Constitution, Willpower and Build together, whichever Archetype you play.",
      "A weapon rolls one die for every full 10 points of its stat, so under 10 it rolls none. Foci, Shrouds and Icons also get stronger as their stat goes up.",
      `Every stat also gets a free bonus as you earn Skill Points (1 for every 5), so none of them is ever really zero.`])
  ].join("") }),
  statsArchetype: c => ({ title: "Which Archetype?", html: [
    ...(c.preset.length
      ? [p(`Your Background already started you in <strong>${list(c.preset.map(id => ARCHETYPES[id].label))}</strong>. To keep things simple, we suggest you play that: put your points into ${list(c.preset.flatMap(id => ARCHETYPES[id].stats).map(k => `<strong>${esc(c.statLabels[k])}</strong>`))}.`)]
      : [p("Your Background didn't pick an Archetype for you, so it's your choice: Martial, Magic or Mental.")]),
    p("For your first character, <strong>stick to one Archetype</strong>. Every Archetype can play any role (dealing damage, protecting others, helping, hindering), and one is plenty to learn."),
    ul(["<strong>Martial:</strong> Strength for heavy weapons, or Dexterity for light ones, plus Constitution for armor.",
      "<strong>Magic:</strong> Reach (Channeler) or Grasp (Igniter) to cast, or both for a Multi Foci, plus Build for a Shroud.",
      "<strong>Mental:</strong> Ponderance for Dreams or Snappence for Nightmares, plus Willpower for your Icon's Ward."]),
    tip("A simple start: most of your points into your main attacking stat, the rest into that Archetype's defensive stat. Points you don't place are banked for later.")
  ].join("") }),

  skills: c => ({ title: "Step 5: Skill Trees", html: [
    p("<strong>Skill trees</strong> are where your abilities come from. Each tree has five tiers; each tier unlocks something new, and you need the tier before it first. A tier costs its number in Skill Points: Tier 1 costs 1, Tier 2 costs 2, and so on (15 for all five)."),
    c.free.length ? p(`Your Background already gave you these, for free: ${list(c.free.map(f => `<strong>${esc(f)}</strong>`))}.`) : "",
    p(`Now you have <strong>${c.sp}</strong> Skill Points of your own to spend on anything you like. Points you don't spend are banked for later.`),
    c.archetype
      ? p(c.why === "background"
        ? `Since you're starting in <strong>${ARCHETYPES[c.archetype].label}</strong>, we suggest growing it: raise its Theory and the trees your Background gave you, or open a new tree in it. The list is already showing ${ARCHETYPES[c.archetype].label}.`
        : `Based on your stats, <strong>${ARCHETYPES[c.archetype].label}</strong> is the Archetype for you. Start with <strong>${ARCHETYPES[c.archetype].label} Theory</strong>: it explains how the Archetype plays and opens its other trees as it goes up. The list is already showing ${ARCHETYPES[c.archetype].label}; look through it.`)
      : "",
    tip("Click a tree's name to read its tiers before you buy them. The <strong>Archetype or Group</strong> box at the top switches between lists: your Ancestry's trees, the three Archetypes, and the Generic Groups (Perception, Stealth, Persuasion...) anyone can learn.")
  ].join("") }),

  equipment: c => ({ title: "Step 6: Equipment", html: [
    p(`You can start with up to <strong>${c.items}</strong> items, ${esc(c.rarity)} or lower. Each card shows what the item does: its numbers, what its material or type adds, and book icons that open it in the Codex.`),
    c.lines.length ? `<h4 class="fs-tut-head">What fits your character</h4>${ul(c.lines)}` : p("Pick what sounds fun: a weapon, armor, or your Archetype's gear."),
    tip("The <strong>★</strong> marks the add buttons and the choices in each box that fit what you picked. They're only suggestions."),
    p("Fighting with your bare hands is always free, and every ranged weapon comes with 20 ammunition.")
  ].join("") }),

  notes: () => ({ title: "Step 7: Notes", html: [
    p("Last step! Give your character a <strong>name</strong> (you need one to finish) and, if you like, a portrait."),
    p("Everything else here (age, appearance, personality, goals, backstory) is optional, and you can fill it in later on your character sheet's Notes tab. When you're happy, hit <strong>Finish</strong>.")
  ].join("") }),

  done: c => ({ title: "Your character is ready!", html: [
    p(`<strong>${esc(c.name)}</strong> is being made, and will show up in your Actors list in a moment.`),
    p("Would you like to view the character sheet tutorial? It shows you around your sheet and how to play your character for the first time.")
  ].join("") })
};

/** The Next button's lock-in warning for a step. */
export const LOCK = {
  ancestry: c => `You're about to lock in <strong>${esc(c.ancestry)}</strong> as your Ancestry for the rest of the tutorial.`,
  background: c => `You're about to lock in <strong>${esc(c.background)}</strong> and its choices.`,
  culture: c => `You're about to lock in your Homeland (<strong>${esc(c.homeland)}</strong>) and your Circle (<strong>${esc(c.circle)}</strong>).`,
  stats: c => `You're about to lock in your stats.${c.left > 0 ? ` You still have <strong>${c.left}</strong> point${c.left === 1 ? "" : "s"} unplaced: they'll be banked for later.` : ""}`,
  skills: c => `You're about to lock in your skill trees.${c.left > 0 ? ` <strong>${c.left}</strong> Skill Point${c.left === 1 ? "" : "s"} will be banked for later.` : ""}`,
  equipment: c => `You're about to lock in your equipment${c.count ? ` (${c.count} item${c.count === 1 ? "" : "s"})` : " (none: you'll fight with your bare hands)"}.`
};

/** The banner line at the top of the wizard: what to do right now. */
export const BANNER = {
  ancestry: c => (!c.picked ? "Pick an Ancestry. Click the tree buttons on a card to read what its abilities do."
    : c.needGland ? "Pick your Elemental Gland's element in the box below your Ancestry."
      : `Happy with ${c.picked}? Hit Next when you're ready (it locks in ${c.picked}).`),
  background: c => (!c.picked ? "Pick a Background. Its tree buttons show what its 15 free points give you."
    : c.error ? `Make your Background's choices below: ${c.error}`
      : `Happy with ${c.picked}? Hit Next when you're ready.`),
  culture: c => (!c.homeland ? "Pick your Homeland: where you come from."
    : !c.circle ? "Now pick your Circle: who you grew up with." : "Hit Next when you're ready."),
  stats: c => (c.left < 0 ? `You've placed ${-c.left} point${c.left === -1 ? "" : "s"} too many: take some back.`
    : c.left > 0 ? `${c.left} stat point${c.left === 1 ? "" : "s"} left to place.` : "All your points are placed. Hit Next when you're ready."),
  skills: c => (c.left > 0 ? `${c.left} Skill Point${c.left === 1 ? "" : "s"} left. Spend them, or hit Next to bank them.` : "All your Skill Points are spent. Hit Next when you're ready."),
  equipment: c => (c.left > 0 ? `Add up to ${c.left} more item${c.left === 1 ? "" : "s"}; ★ marks what fits your character. Hit Next when you're done.` : "All your item picks are used. Hit Next when you're ready."),
  notes: c => (c.name ? "Hit Finish to make your character." : "Give your character a name.")
};

/** One line of equipment advice, worded (see tutorial-rules.equipmentAdvice). `L` gives labels: { weaponType, armorWeight, foci, stat }. */
export function adviceLine(a, L) {
  switch (`${a.kind}:${a.why}`) {
    case "weaponWeight:dex": return `<strong>Light weapons</strong> (★ in the Weight box) deal damage with your ${L.stat("dex")}.`;
    case "weaponWeight:str": return `<strong>Heavy weapons</strong> (★ in the Weight box) deal damage with your ${L.stat("str")}.`;
    case "weaponWeight:low": return `A weapon rolls one die per full 10 points of its stat: put at least 10 into ${L.stat("dex")} (Light) or ${L.stat("str")} (Heavy).`;
    case "weaponType:tree": return `A <strong>${esc(L.weaponType(a.key))}</strong> weapon (★ in the Type box), so the ${esc(L.weaponType(a.key))} tree you have works with it.`;
    case "armor:unarmored": return "You took <strong>Unarmored</strong>, so skip armor: that tree works when you wear none.";
    case "armor:tree": return `<strong>${esc(a.key.split(",").map(L.armorWeight).join(" or "))} armor</strong>, to match your armor tree. Armor gets stronger with your ${L.stat("con")}.`;
    case "armor:con": return `<strong>Light or Medium armor</strong> (★): your ${L.stat("con")} makes it stronger. Heavier armor protects more but slows you down more.`;
    case "foci:reach": return `A <strong>Channeler</strong> Foci (★ in the Foci type box): it casts with your ${L.stat("reach")}.`;
    case "foci:grasp": return `An <strong>Igniter</strong> Foci (★): it casts with your ${L.stat("grasp")}.`;
    case "foci:both": return `A <strong>Multi</strong> Foci (★): with ${L.stat("reach")} and ${L.stat("grasp")} close together, it casts with the lower of the two.`;
    case "foci:low": return `A Foci casts with ${L.stat("reach")} (Channeler) or ${L.stat("grasp")} (Igniter): put at least 10 into one of them.`;
    case "shroud:build": return `A <strong>Shroud</strong>: it soaks damage before your armor and gets stronger with your ${L.stat("build")}.`;
    case "affix:free": return "Some <strong>Affixes</strong>: gems that add an effect to your Foci or Shroud. Each Foci and Shroud lets a few work for free (its <em>Free Affixes</em>); past that, each costs 20% of your speed.";
    case "icon:align": return `An <strong>Icon</strong> with a ${a.key.split(",").map(k => (k === "dream" ? "Dream" : "Nightmare")).join(" or ")} Form (★ in the Icon Form box) to match your Wonders. Its Ward gets stronger with your ${L.stat("will")}.`;
    default: return "";
  }
}

/** The Background's choices, worded for the choices popup. */
export function choiceLines({ focus = [], slots = [], owed = 0 } = {}) {
  const out = [];
  if (focus.length) out.push(`<strong>Focus:</strong> pick one of ${list(focus.map(f => `<strong>${esc(f)}</strong>`))}. Each gives different trees (the rows on the card show which).`);
  for (const s of slots) out.push(`<strong>${esc(s.label)}:</strong> ${list(s.choices.map(ch => esc(ch.name)))}.`);
  if (owed) out.push(`<strong>${owed} points</strong> to spend on your Ancestry's own trees, with the + and − buttons.`);
  return out;
}
