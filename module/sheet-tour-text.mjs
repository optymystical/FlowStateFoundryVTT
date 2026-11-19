/**
 * The character sheet tutorial's stops and words (pure: no Foundry globals). `sheetStops(c)` returns the tour in order: each stop is
 * { id, tab, target, open, optional, title, html } — the sheet tab to show, a CSS selector (inside the sheet; a list: the first one there) to
 * highlight, a collapsed section to open, and the popup. An `optional` stop is skipped when its target isn't on the sheet (a group with no rows yet).
 * `c` is what the tour knows about the character (sheet-tour.mjs `tourFacts`): which Archetypes it plays, its gear, its numbers, its trees, and
 * the rows of its Action and Reaction Lists as the sheet shows them (so the words name the character's own abilities).
 * `[[page|label]]` is a Codex link (a page id or a name; the label is optional): the popup turns it into a link, or plain text if there's no page.
 * Written for someone who has never played a tabletop RPG. Edit freely: sheet-tour.mjs only shows them.
 */
import { esc } from "./html.mjs";

const p = s => `<p>${s}</p>`;
const ul = items => `<ul class="fs-tut-list">${items.filter(Boolean).map(i => `<li>${i}</li>`).join("")}</ul>`;
const tip = s => `<p class="fs-tut-tip"><i class="fa-solid fa-lightbulb"></i> ${s}</p>`;
const list = arr => (arr.length <= 1 ? arr.join("") : `${arr.slice(0, -1).join(", ")} and ${arr.at(-1)}`);
/** A Codex link to a page id or name, with an (escaped) label. */
const L = (key, label = key) => `[[${String(key).replace(/[[\]|]/g, "")}|${esc(label)}]]`;
const names = items => list(items.map(i => `<strong>${L(i.name)}</strong>`));
const S = { pain: "entry:generic-endurance:pain-threshold", energy: "entry:generic-endurance:energy", ap: "doc:rules/ch11-combat-rules/action-points-ap",
  rp: "doc:rules/ch11-combat-rules/reaction-points-rp", crit: "doc:rules/ch11-combat-rules/critical-hits", dodge: "doc:rules/ch11-combat-rules/attacking-dodging",
  limit: "doc:rules/ch13-objects-and-force/limit", durability: "doc:rules/ch13-objects-and-force/durability", statBonus: "doc:rules/ch7-skill-points/stat-bonus",
  statChecks: "doc:rules/ch6-stats/stat-checks", nonStat: "doc:rules/ch7-skill-points/non-stat-checks", sp: "doc:rules/ch7-skill-points/how-do-i-use-skill-points",
  foci: "doc:equipment/magic-foci", shroud: "doc:equipment/magic-shrouds", affixes: "doc:equipment/magic-affixes", icons: "doc:equipment/mental-icons",
  igniter: "castingForm:igniter", channeler: "castingForm:channeler", multi: "castingForm:multi", raw: "entry:magic-theory:raw-casting",
  cores: "entry:magic-theory:core-spells", mods: "entry:magic-theory:spell-mods", threshold: "entry:magic-theory:spell-threshold",
  manifest: "entry:mental-theory:manifesting", wonders: "entry:mental-theory:wonders-and-modes", alignment: "entry:mental-theory:alignment",
  initiative: "entry:generic-initiative:initiative", rest: "entry:generic-endurance:rest", unarmed: "weaponType:unarmed", crouch: "doc:rules/ch12-conditions/crouch-prone",
  targeting: "doc:rules/ch11-combat-rules/targeting", damage: "doc:rules/ch11-combat-rules/damage-rolls-types", grappling: "entry:martial-theory:grappling" };

/** A group of the character's Action or Reaction List, by key. */
const group = (c, key) => (c.groups ?? []).find(g => g.key === key) ?? null;
/** A row's label without the parts that change (Attack: X keeps X), linked to its page when it has one. */
const rowName = r => `<strong>${L(r.label)}</strong>`;
const rowLine = r => `${rowName(r)}${r.cost ? ` <span class="fs-tut-cost">(${esc(r.cost)})</span>` : ""}${r.detail ? `: ${esc(r.detail.length > 140 ? `${r.detail.slice(0, 137)}...` : r.detail)}` : ""}`;
/** Cast Spell's detail is the Core Spells; Manifest's starts with the Wonders. */
const coreSpells = c => (group(c, "act-magic")?.rows.find(r => r.label === "Cast Spell")?.detail ?? "").split(/,\s*/).filter(s => s && !/[.:]/.test(s));
const wondersOf = c => (group(c, "act-mental")?.rows.find(r => r.label === "Manifest")?.detail ?? "").split(" · ")[0].split(/,\s*/).filter(Boolean);

/** What each kind of Action List group is, for the stops about the character's own groups. */
const GROUP_TEXT = {
  "act-generic": "abilities from the <strong>Generic Groups</strong>, the trees anyone can learn",
  "act-ancestry": "your <strong>Ancestry's</strong> own abilities",
  "act-items": "the things you carry that you can use: potions and the like",
  "act-parry": "parrying with your weapon",
  "act-shroud": "what your Shroud can do"
};
const SKIP_GROUPS = new Set(["act-combat", "act-magic", "act-mental", "act-checks"]);

/** The words for "how you attack", per Archetype. */
const ATTACK = {
  martial: c => {
    const rows = (group(c, "act-combat")?.rows ?? []).filter(r => /^Attack: /.test(r.label));
    return `<strong>Martial:</strong> click ${rows.length ? list(rows.map(r => `${rowName(r)} (${esc(r.cost)})`)) : "<strong>Attack: (weapon)</strong>"} in the Combat group.${c.weapons.some(w => !w.held) ? ` ${names(c.weapons.filter(w => !w.held))} has to be in your hand first (Equipment tab, the fist button) to get its own Attack row.` : ""}`;
  },
  magic: c => {
    const cores = coreSpells(c);
    return `<strong>Magic:</strong> click <strong>Cast Spell</strong> in the Magic group and pick ${cores.length ? `one of your ${L(S.cores, "Core Spells")} (${list(cores.map(s => `<strong>${L(s)}</strong>`))})` : `a ${L(S.cores, "Core Spell")}`} and any ${L(S.mods, "Mods")}. Through an ${L(S.igniter, "Igniter")} Foci a spell takes 2 AP, through a ${L(S.channeler, "Channeler")} 3 AP; the dialog shows the AP and Energy before you cast.${c.foci.some(f => f.attuned && !f.held) ? " Your Foci has to be in your hand first (Equipment tab, the fist button)." : ""}`;
  },
  mental: c => {
    const w = wondersOf(c);
    return `<strong>Mental:</strong> click <strong>${L(S.manifest, "Manifest")}</strong> in the Mental group, pick ${w.length ? `a Wonder (${list(w.map(x => `<strong>${L(x)}</strong>`))})` : "a Wonder"} and one of its ${L(S.wonders, "Modes")}. The range sets the AP: Melee 1, Ranged 2, Area 3.`;
  }
};

/** Every stop of the tour, in order, for this character. */
export function sheetStops(c) {
  const has = c.has ?? {}, any = has.martial || has.magic || has.mental;
  const plays = Object.keys(ATTACK).filter(k => has[k]);
  const attackers = plays.length ? plays : ["martial", "magic", "mental"];
  const trees = c.trees ?? [], combat = group(c, "act-combat");
  const reactRows = (c.reacts ?? []).filter(g => g.key !== "react-auto").flatMap(g => g.rows);
  const stops = [
    { id: "welcome", tab: "main", title: `${esc(c.name)}'s character sheet`, html: [
      p("This is your <strong>character sheet</strong>: everything your character is, has and can do. This tour shows you around it, tab by tab, then walks you through your first turn in a fight."),
      p("The part being explained is outlined in gold. Use <strong>Next</strong> and <strong>Back</strong> to move through the tour; the sheet is locked until it ends."),
      tip("Underlined words are links: click one to read its rules in the <strong>Codex</strong>. You can take the tour again any time from the sheet's <strong>⋮</strong> menu (top right): <strong>Sheet tutorial</strong>.")
    ].join("") },

    { id: "header", tab: "main", target: ".fs-sheet-header .fs-header", title: "Name, portrait and speed", html: [
      p("Your <strong>name</strong> and <strong>portrait</strong> (click it to change the picture)."),
      p(`The pill under your name is your <strong>speed</strong>: how far one move takes you (${esc(c.speed)} ft), and what a move costs in a fight (${esc(c.moveCost)}). Armor, your posture and the ground can change it; hover it to see why.`)
    ].join("") },

    { id: "energy", tab: "main", target: ".fs-vitals", title: "Energy", html: [
      p(`${L(S.energy, "Energy")} (⚡) is what your abilities cost to use. You have <strong>${c.energyMax}</strong> at most (5 for every Skill Point).`),
      ul([`<strong>Recover</strong> spends 1 AP to get back ${c.energyRecover} Energy (a tenth of your max).`,
        "At the start of each of your turns you also get back as much as 2 AP of recovering would give.",
        "Out of combat your Energy is always full, unless the GM calls a tense scene (sneaking past guards, a collapsing building), when it's spent like in a fight."]),
      p("In a fight your <strong>AP</strong> and <strong>RP</strong> show up here as well (more on those at the end of the tour).")
    ].join("") },

    { id: "hp", tab: "main", target: ".fs-resources", title: "Health", html: [
      p(`<strong>HP</strong> is your health: <strong>${c.hpMax}</strong> at full. It comes from ${L("stat:con", "Constitution")}, ${L("stat:will", "Willpower")} and ${L("stat:build", "Build")} together.`),
      p(`Your ${L(S.pain, "Pain Threshold")} is half of it (${c.pain}). If your HP drops below it you <strong>fall unconscious</strong>, and stay out until you're healed back above it. Keep an eye on this number in a fight.`),
      p("<strong>Max HP lost</strong> is damage that lowers your maximum itself. Under it is how much HP a night's rest heals.")
    ].join("") },

    { id: "stats", tab: "main", target: ".fs-stats", title: "Stats", html: [
      p(`Your nine <strong>stats</strong>, grouped by Archetype: Body (${L("archetype:martial", "Martial")}), Mind (${L("archetype:mental", "Mental")}) and Spirit (${L("archetype:magic", "Magic")}). The number on the right is the stat with your ${L(S.statBonus, "Stat Bonus")} added (every stat gets +1 for each 5 Skill Points you have).`),
      p(`The <strong>d</strong> button beside a stat rolls a ${L(S.statChecks, "stat check")} with it: the GM asks for one when you try something your stat decides, like lifting a gate (Strength) or keeping your nerve (Willpower).`),
      c.statPoints > 0 ? tip(`You have <strong>${c.statPoints}</strong> stat point${c.statPoints === 1 ? "" : "s"} still to place: use the <strong>+</strong> buttons (outside combat).`) : ""
    ].join("") },

    { id: "summary", tab: "main", target: ".fs-summary", title: "Attack and dodge dice", html: [
      p(`Every attack you make rolls your <strong>attack die</strong> (d${c.attackDie}, as big as your total Skill Points). The creature you attack rolls its ${L(S.dodge, "dodge dice")} against it; yours are 2d${c.dodgeDie}.`),
      p(`Roll equal or higher than their dodge and you hit. Roll <strong>double</strong> their dodge or more and it's a ${L(S.crit, "critical hit")}, which hits harder. Both dice grow as you earn Skill Points.`)
    ].join("") },

    { id: "skills", tab: "skills", target: ".fs-skill-points", title: "Skill Points", html: [
      p(`The <strong>Skills</strong> tab is where your abilities come from. You earn ${L(S.sp, "Skill Points")} as you play and spend them here: a tier costs its number (Tier 1 costs 1, Tier 2 costs 2...).`),
      c.unspentSP > 0 ? tip(`You have <strong>${c.unspentSP}</strong> unspent. Spend them whenever you like (outside combat); they're banked until then.`) : p("Everything you had is spent. New points show here as <strong>Unspent</strong>.")
    ].join("") },

    { id: "trees", tab: "skills", target: ".fs-skill-layout", title: "Skill trees", html: [
      trees.length ? p(`Your trees right now: ${list(trees.map(t => `<strong>${L(`tree:${t.id}`, t.name)}</strong> ${t.tier}${t.free ? " (from your Background)" : ""}`))}.`) : "",
      p("On the left is every tree you can open, grouped by Archetype, your Ancestry and the Generic Groups; type in the box to find one. Click a tree to read it on the right."),
      ul(["Each <strong>tier</strong> says what it gives you. <strong>Unlock</strong> on the next tier buys it.",
        "A <i class=\"fa-solid fa-scroll\"></i> badge is a tier your Background gave you for free.",
        "A <i class=\"fa-solid fa-wand-magic-sparkles\"></i> badge means the system does that ability for you in play (buttons, popups or automatic effects).",
        "The <i class=\"fa-solid fa-book-open\"></i> book opens the rules for that tree in the <strong>Codex</strong>."]),
      has.martial ? tip("Your weapon trees only work with weapons of that type: a Bladed tree for a Bladed weapon.") : ""
    ].join("") }
  ];

  // Equipment: what this character uses gets a stop of its own; the rest a line.
  if (has.martial || c.weapons.length) stops.push({ id: "weapons", tab: "equipment", target: "[data-section=weapons]", open: "weapons", title: "Weapons", html: [
    p(`Your weapons. ${L(S.unarmed, "Unarmed")} (your fists) is always there: Light or Heavy, picked each time you attack.${c.weapons.length ? ` You also carry ${names(c.weapons)}.` : ""}`),
    ul(["The <strong>fist</strong> button on the left puts a weapon in your hand (or away). You can only attack with a weapon you're holding, and each one needs a free hand (two for a two-handed grip).",
      "Holding a weapon takes a hand from your fists on its own (Unarmed shows which hands are still free).",
      "The <i class=\"fa-solid fa-khanda\"></i> button on the right attacks with it. Hover a <strong>tag</strong> to read what it does (click it for its Codex page).",
      `<strong>Dur.</strong> is its ${L(S.durability, "Durability")}: it wears down as it takes hits, and breaks at 0.`]),
    c.weapons.some(w => !w.held) ? tip(`${names(c.weapons.filter(w => !w.held))} ${c.weapons.filter(w => !w.held).length === 1 ? "is" : "are"} still packed away: click the fist to hold ${c.weapons.filter(w => !w.held).length === 1 ? "it" : "them"} before a fight.`) : ""
  ].join("") });
  if (c.armor.length) stops.push({ id: "armor", tab: "equipment", target: "[data-section=armor]", open: "armor", title: "Armor", html: [
    p(`Your armor: ${names(c.armor)}. The button on its row puts it on or takes it off.`),
    ul([`Armor <strong>soaks</strong> damage: each hit loses up to the armor's ${L(S.limit, "Limit")} before it reaches you, and wears its Durability down.`,
      "Heavier armor slows you and makes you easier to spot.",
      "Putting it on takes time (its <strong>Don</strong> time), so do it before the fight starts."]),
    c.armor.some(a => !a.worn) ? tip(`${names(c.armor.filter(a => !a.worn))} isn't on yet.`) : ""
  ].join("") });
  if (has.magic || c.foci.length) stops.push({ id: "foci", tab: "equipment", target: "[data-section=foci]", open: "foci", title: "Foci", html: [
    p(`A ${L(S.foci, "Foci")} is what you cast spells through.${c.foci.length ? ` You have ${names(c.foci)}.` : ` You don't have one yet: without one you cast with yourself as the conduit (${L(S.raw, "Raw Casting")}).`}`),
    ul(["Only your <strong>attuned</strong> Foci works, and it has to be <strong>in your hand</strong> (the fist button) to cast through it. Attuning to another takes an hour, so it can't be done in a fight.",
      `Its form decides how you cast: an ${L(S.igniter, "Igniter")} uses Grasp (2 AP a spell), a ${L(S.channeler, "Channeler")} uses Reach (3 AP, but spells are easier to power), a ${L(S.multi, "Multi")} either.`,
      "Its <strong>Free Affixes</strong> are how many Affixes you can attune without losing speed."]),
    c.foci.some(f => f.attuned && !f.held) ? tip(`${names(c.foci.filter(f => f.attuned && !f.held))} isn't in your hand yet: click its fist before a fight.`) : ""
  ].join("") });
  if (c.shrouds.length) stops.push({ id: "shroud", tab: "equipment", target: "[data-section=shrouds]", open: "shrouds", title: "Shroud", html: [
    p(`Your ${L(S.shroud, "Shroud")} (${names(c.shrouds)}) guards your spirit: it soaks damage <strong>before your armor does</strong>, and grows with your Build. Like a Foci, only the attuned one works.`)
  ].join("") });
  if (c.affixes > 0) stops.push({ id: "affixes", tab: "equipment", target: "[data-section=affixes]", open: "affixes", title: "Affixes", html: [
    p(`${L(S.affixes, "Affixes")} are gems attuned in one of two forms: <strong>Offensive</strong> ones work through your Foci and spells, <strong>Defensive</strong> ones through your Shroud. Each one past your Free Affixes costs 20% of your speed.`)
  ].join("") });
  if (has.mental || c.icons.length) stops.push({ id: "icons", tab: "equipment", target: "[data-section=icons]", open: "icons", title: "Icons", html: [
    p(`An ${L(S.icons, "Icon")} is a Mental character's focus object.${c.icons.length ? ` You have ${names(c.icons)}.` : " You don't have one yet."}`),
    ul(["Your <strong>attuned</strong> Icon gives you its <strong>Ward</strong>: the defense it puts up for you, stronger with your Willpower.",
      "Attuning one (from the Action List) asks you to pick its <strong>Tenet</strong>."])
  ].join("") });
  const others = [!has.magic && !c.foci.length && "Foci, Shrouds and Affixes (Magic)", !has.mental && !c.icons.length && "Icons (Mental)", !has.martial && !c.armor.length && "Armor"].filter(Boolean);
  stops.push({ id: "gear", tab: "equipment", target: "[data-section=currency]", open: "currency", title: "Money and other things", html: [
    p("Your <strong>money</strong> is here, and below it <strong>Misc Items</strong>: potions, tools and anything else you carry."),
    others.length ? p(`The other sections (${list(others)}) are for gear your character doesn't use yet; they stay empty until you pick some up.`) : "",
    tip("Click an item's name to open it and read everything about it.")
  ].join("") });

  const extraGroups = (c.groups ?? []).filter(g => !SKIP_GROUPS.has(g.key) && g.rows.length);
  stops.push(
    { id: "actions", tab: "actions", target: "[data-section=act-combat]", open: "act-combat", title: "The Action List", html: [
      p("The <strong>Action List</strong> is everything you can do, as buttons. Click one to do it: the system rolls the dice, pays the cost and posts the result in the chat. Hover a row to read more."),
      combat?.rows.length ? `${p("Your <strong>Combat</strong> group (the cost of each is on the right; ⚡ is Energy):")}${ul(combat.rows.map(rowLine))}`
        : p("The <strong>Combat</strong> group has the basics: an <strong>Attack</strong> row for each weapon you hold, <strong>Move</strong>, crouching and going prone, and <strong>Recover Energy</strong>. The cost of each is on the right (⚡ is Energy)."),
      extraGroups.length ? p(`Below it are your other groups: ${list(extraGroups.map(g => `<strong>${esc(g.name)}</strong>`))}. The next stops go through them.`) : p("More groups appear as you unlock abilities: each tree's active abilities get their own rows.")
    ].join("") });
  if (has.magic) {
    const g = group(c, "act-magic"), cores = coreSpells(c);
    stops.push({ id: "act-magic", tab: "actions", target: "[data-section=act-magic]", open: "act-magic", optional: true, title: "Casting spells", html: [
      p(`The <strong>Magic</strong> group. <strong>Cast Spell</strong> opens the casting dialog: pick one of your ${L(S.cores, "Core Spells")}${cores.length ? ` (${list(cores.map(s => `<strong>${L(s)}</strong>`))})` : " (the spells your Magic trees taught you)"}, add any ${L(S.mods, "Mods")} that change it, and pick its target or area.`),
      p(`A spell costs AP (2 through an Igniter, 3 through a Channeler) and Energy. Bigger spells have a higher ${L(S.threshold, "Threshold")}, which your Foci and stats help you reach; the dialog shows what it will cost before you cast.`),
      g && g.rows.length > 1 ? `${p("Also in this group:")}${ul(g.rows.filter(r => r.label !== "Cast Spell").map(rowLine))}` : ""
    ].join("") });
  }
  if (has.mental) {
    const g = group(c, "act-mental"), w = wondersOf(c);
    stops.push({ id: "act-mental", tab: "actions", target: "[data-section=act-mental]", open: "act-mental", optional: true, title: "Manifesting Wonders", html: [
      p(`The <strong>Mental</strong> group. ${L(S.manifest, "Manifest")} is your attack: pick one of your Wonders${w.length ? ` (${list(w.map(x => `<strong>${L(x)}</strong>`))})` : ""} and one of its ${L(S.wonders, "Modes")} (what it does), then the range: Melee (1 AP), Ranged (2 AP) or an Area (3 AP).`),
      g && g.rows.length > 1 ? `${p("Also in this group:")}${ul(g.rows.filter(r => r.label !== "Manifest").map(rowLine))}` : "",
      p(`${L(S.alignment, "Set Alignment")} leans your mind toward Dream or Nightmare (it strengthens that kind of Ward and costs some speed), and <strong>Attune Icon</strong> picks the Icon your Ward comes from.`)
    ].join("") });
  }
  for (const g of extraGroups) stops.push({ id: `group:${g.key}`, tab: "actions", target: `[data-section=${g.key}]`, open: g.key, optional: true, title: g.name, html: [
    p(`<strong>${esc(g.name)}</strong>: ${GROUP_TEXT[g.key] ?? `abilities from your <strong>${esc(g.name)}</strong> tree`}.`),
    ul(g.rows.map(rowLine)),
    tip("Click a name to read the full rules for it.")
  ].join("") });
  const checks = group(c, "act-checks")?.rows ?? [];
  stops.push(
    { id: "checks", tab: "actions", target: "[data-section=act-checks]", open: "act-checks", title: "Checks", html: [
      p(`The <strong>Checks</strong> group rolls the things the GM asks for outside a fight: ${checks.length ? list(checks.slice(0, 8).map(r => `<strong>${L(r.label)}</strong>`)) : `${L("tree:generic-stealth", "Stealth")}, ${L("tree:generic-perception", "Perception")}, ${L("tree:generic-persuasion", "Persuasion")} and the rest`}${checks.length > 8 ? " and more" : ""}. Those are ${L(S.nonStat, "Non Stat Checks")}, rolled on your plain attack die.`),
      tip("When the GM says \"roll Perception\", this is where you click.")
    ].join("") },
    { id: "reactions", tab: "reactions", target: ".fs-tab[data-tab=reactions] > details", title: "The Reaction List", html: [
      p("Some things happen in <strong>other creatures' turns</strong>: you dodge their attacks, and some abilities let you react to what they do. When you can, the system asks you with a popup or puts a button on the chat card."),
      reactRows.length ? `${p("These can ask you right now:")}${ul(reactRows.slice(0, 10).map(r => `${rowName(r)}${r.detail ? `: ${esc(r.detail.length > 110 ? `${r.detail.slice(0, 107)}...` : r.detail)}` : ""}`))}` : "",
      p("The <strong>Reaction List</strong> lists everything that can ask you. Click one to switch it off (it then counts as \"no\") or back on."),
      p("<strong>Auto-Dodge</strong> (in the Automation group) dodges every attack for you, so you don't have to watch for them. Handy if you're not sure what to do yet.")
    ].join("") },
    { id: "misc", tab: "misc", target: ".fs-conditions", title: "Conditions and rest", html: [
      p("The <strong>Misc</strong> tab holds the rest of your character: your body's numbers (size, melee range, how much you can lift), your <strong>senses</strong>, and the effects on you right now."),
      p(`<strong>Conditions</strong> are what's on you right now: burning (Ignite), Stains, Slow or Haste, and days without rest. <strong>8 Hour Rest</strong> is your night's sleep (${L(S.rest, "Rest")}): it heals some HP and resets what recovers on a rest. The GM tells you when you can rest.`)
    ].join("") },
    { id: "notes", tab: "notes", target: ".fs-abc-view", title: "Notes", html: [
      p(`Who your character is: Ancestry${c.ancestry ? ` (${L(c.ancestryId ? `abc:ancestry:${c.ancestryId}` : c.ancestry, c.ancestry)})` : ""}, Background${c.background ? ` (${L(c.backgroundId ? `abc:background:${c.backgroundId}` : c.background, c.background)})` : ""}, Culture, languages, and the details you wrote in the wizard. The big box under it is for your own notes.`),
      tip("Names with a link (the Ancestry, the Background) open their page in the Codex.")
    ].join("") },

    // Your first turn.
    { id: "turn", tab: "main", target: ".fs-vitals", title: "Your first turn: AP and RP", html: [
      p(`When a fight starts, everyone rolls ${L(S.initiative, "initiative")} (the GM starts it) and takes turns in that order. On your turn you have two kinds of points:`),
      ul([`${L(S.ap, "AP")} (Action Points): <strong>6</strong>, refilled at the start of your turn. Attacking, casting, moving and most actions spend AP. What you don't use is lost when your turn ends.`,
        `${L(S.rp, "RP")} (Reaction Points): <strong>6</strong>, also given at the start of your turn, but they last until your <strong>next</strong> turn. Reactions in other creatures' turns spend them.`]),
      p("Both show up here, next to your Energy, while you're in a fight. 1 AP is about one second: a round is six seconds.")
    ].join("") },
    { id: "attack", tab: "actions", target: plays.length === 1 && plays[0] !== "martial" ? [`[data-section=act-${plays[0]}]`, "[data-section=act-combat]"] : "[data-section=act-combat]",
      open: plays.length === 1 && plays[0] !== "martial" ? `act-${plays[0]}` : "act-combat",
      title: "Your first turn: attacking", html: [
        p("To attack something:"),
        ul([`${L(S.targeting, "Target it")}: hover over its token on the map and press <strong>T</strong> (or right-click the token and click the target button). A target marker shows around it.`,
          ...attackers.map(k => ATTACK[k](c)),
          "A dialog asks about anything that can change the attack, then the <strong>attack card</strong> appears in the chat."]),
        p("You can attack more than once a turn while your AP lasts.")
      ].join("") },
    { id: "exchange", tab: "actions", title: "Your first turn: the chat cards", html: [
      p("A fight plays out on cards in the <strong>chat</strong>:"),
      ul(["The <strong>attack card</strong> shows your roll. The creature you attacked answers it with its dodge (the GM does that for monsters).",
        `Your roll equal or higher than their dodge is a <strong>hit</strong>; double their dodge or more is a ${L(S.crit, "critical hit")}.`,
        `On a hit, the ${L(S.damage, "damage")} is rolled. It goes through what protects them first (a parrying weapon, a Shroud, armor), and what's left comes off their HP.`,
        "Any extra attacks or abilities that can follow a hit get their own buttons on the card."]),
      tip("Buttons on a card only show to the player they belong to, so if a card has a button for you, it's your move.")
    ].join("") },
    { id: "defend", tab: "reactions", target: ".fs-tab[data-tab=reactions] > details", title: "When you're attacked", html: [
      p(`When something attacks you, its attack card shows you a <strong>Dodge</strong> button (2d${c.dodgeDie}). Click it to roll your dodge. Any reactions you can use against that attack (they cost RP or Energy) show as buttons beside it.`),
      p("If you'd rather not watch for every attack, switch <strong>Auto-Dodge</strong> on here: it dodges for you."),
      tip(`If your HP falls below ${c.pain} (your ${L(S.pain, "Pain Threshold")}), you're knocked out. Back off, guard yourself or ask an ally for help before it gets that low.`)
    ].join("") },
    { id: "move", tab: "main", target: ".fs-sheet-header .fs-header", title: "Moving", html: [
      p(`To move, drag your token on the map. In a fight each move (up to ${esc(c.speed)} ft) costs AP (${esc(c.moveCost)}), paid as you go; out of a fight, moving is free. ${L(S.crouch, "Crouching and going prone")} are in the Combat group.`),
      p("When you're done, end your turn with the <strong>End Turn</strong> button in the combat tracker. Your unused AP goes, your RP stays until your next turn.")
    ].join("") },
    { id: "done", tab: "main", title: "That's the tour!", html: [
      p(`You know your way around ${esc(c.name)} now. A few last things:`),
      ul(["Any <i class=\"fa-solid fa-book-open\"></i> book, linked name or tag opens its rules in the <strong>Codex</strong>. You can also type <strong>/codex</strong> in the chat.",
        any ? "" : "Your character hasn't settled on an Archetype yet: the Skills tab is where you'll grow one.",
        "Take this tour again from the sheet's <strong>⋮</strong> menu: <strong>Sheet tutorial</strong>.",
        "When in doubt, ask your GM. Have fun!"])
    ].join("") }
  );
  return stops;
}
