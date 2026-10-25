// Generated from the Rules and Equipment docs by tools/build_rules.py. Don't edit by hand; re-run the converter.
export const RULE_DOCS = [
 {
  "id": "rules",
  "title": "Rules",
  "chapters": [
   {
    "id": "ch1-what-is-flow-state",
    "title": "Ch1 - What is Flow State?",
    "intro": "Welcome to Flow State, a Setting Universal, Digital Only, Open Ended Tabletop Roleplaying Game (SUDOOE-TTRPG, or Suhdewey-TTRPG)\\! This rules doc here helps explain all the core concepts, rules, and systems of this game all in a simple and easy to digest manner. As this project is community assisted, this document will maintain a “Comments Allowed” feature that allows you to comment on anything within this document. If you use this feature, I ask that your comment is concise and useful, like for example if I have misspelled something or a rule is not entirely clear. With that out of the way, let's get into what Flow State is\\!",
    "sections": [
     {
      "id": "sudooe",
      "title": "SUDOOE",
      "md": "I know, this is a bit of a mess of buzzwords, but I’ll break down each of them to help you understand the pillars that hold this game up:\n\n* Starting with Setting Universal, this is a term that effectively means that the rules and systems within Flow State are intended to be very fantasy forward, but otherwise simple and flavorless on purpose, so that the game can be run in any style of setting within the Fantasy constraint. Many parts of this system can also easily be removed, added upon, or altogether changed using the core framework to more easily fit whatever setting you want. What this means is simple, the game can be run in any setting so long as that setting has some simple Fantasy allowances, and a lot of the mechanics are written in ways that aim to keep things both simple and modular.  \n* Post-COVID, a large number of TTRPGs were forced to be played online only. This led to a huge overarching market shift into digital only things, even well after the pandemic subsided. My game really takes advantage of that, with deep mechanical systems using complex math that, if done manually, would take a long time to set up. But thanks to the wonders of modern technology, everything is automated within a free to use Foundry VTT game system\\! For players, this makes character creation simple and quick, while offering a ton of opportunity to learn and master the various complex mechanics, and for GMs this allows for a ton of minute tweaking to core gameplay rules to fit any kind of desired setting or system idea.  \n* When I say Flow State is Open Ended, what I mean is twofold. On the Player end, Player Characters (PCs) can really go in any direction they want, there are no classes or restrictive systems. In addition, the amount of content in this game is meant to allow for any kind of concept to exist, at least in its basic terms. For example, Necromancy itself may not literally exist in this system, but Animation (magic tree) allows you to animate corpses all the same, and a player could easily flavor this as a necromancer as a result. For GMs, open ended means every system is modular, cleanly connected, and easily changeable, allowing for easy change and removal of everything."
     },
     {
      "id": "why-make-this",
      "title": "Why make this?",
      "md": "Back when I was in college in 2017/2018, I played a ton of D\\&D 5e, to the point where I started hosting my own games in my own unique setting. However, I found that I had a ton of difficulty molding certain features to fit my setting, and an even harder time creating new mechanics or ideas for players to mess around with without utterly breaking things. As a result, I spent a long time just fighting with the system to make it work how I wanted. After a while of this, I branched out into many other systems to find the Right One for me (World of Darkness, Powered by the Apocalypse, Fabula Ultima, Mutants and Masterminds, Warhammer Fantasy/40k, etc), but every time I always found pushback by the system to try and keep me in their setting or something adjacent to it. So, eventually I had enough and decided in 2019 to strike out on my own and make my own game, one where players and GMs alike could design and create anything using the structure provided by this system\\!"
     },
     {
      "id": "so-how-do-i-play",
      "title": "So, how do I play?",
      "md": "Well, just like most other TTRPGs, you need a GM and 3-5 Players to play, and they should be versed enough to guide you through the whole game process as well as character creation, but if you want to try and learn yourself read on in Chapter 2 and beyond\\! If you are that GM, then hello\\! Here are some useful things to know going into this; As I stated before, this game itself is Setting Universal. This means that I *highly suggest* coming in with your own fantasy setting (or one you are a fan of), and using this system as is for the first few sessions. Once you are used to running things a bit, you can begin removing or adding skill trees, changing the names of equipment, altering the stats of monsters, etc. When the GM guide is ready, I will link it here to help provide more direct tools to help shape this world how you like\\!"
     },
     {
      "id": "foundry-vtt",
      "title": "Foundry VTT",
      "md": "The primary way to play this game is the Foundry VTT game system, which can be found below in the links section (soon to be added). If you have issues with the module, let me know on Discord (@chris\\_optymystical)."
     },
     {
      "id": "cc-by",
      "title": "CC-BY",
      "md": "This document and all documents here fall under this licensing: Flow State © 2019 by Christopher Caplinger is licensed under CC BY 4.0. To view a copy of this license, visit [https\\://creativecommons.org/licenses/by/4.0](https://creativecommons.org/licenses/by/4.0)"
     },
     {
      "id": "links",
      "title": "Links",
      "md": "[Equipment](https://docs.google.com/document/d/1bjinhIrPGJr0Ss4M9fjlCRSZrteX5r9yjsSuhYkMuag/edit?tab=t.0#heading=h.bq5thp60inqi)  \n[Martial Skill Trees](https://docs.google.com/document/d/1w5x2zNdUCZMatirMQ-qsNga7XijfzEuzQ7Ad_UgiWbw/edit?tab=t.0#heading=h.z7f5qbem92om)  \n[Mental Skill Trees](https://docs.google.com/document/d/1AYDPICDPXz1TGjQquEX4k-PvXxxbRmncSZc4rkZ2nR4/edit?tab=t.0#heading=h.ows869dkj9ak)  \n[Magic Skill Trees](https://docs.google.com/document/d/10yfXGyX5-dTUYCJzsGw1DOTd7qpGaeD5ZlNF7mMbWI8/edit?tab=t.0#heading=h.mmgrmapgzhbn)"
     }
    ]
   },
   {
    "id": "ch2-archetypes",
    "title": "Ch2 - Archetypes",
    "intro": "This game has its stats, skill trees, and equipment split into three distinct “Archetypes”, and everything within them is referred to as “Archetypal”. For example, a single dollar bill is not Archetypal equipment as it is used by everyone universally, but a Sword or a Gun is considered Archetypal as it is used by Martial Characters. To give some general context, each Archetype has its own list of skill trees, 3 associated stats, and unique archetypal equipment.",
    "sections": [
     {
      "id": "what-are-the-archetypes",
      "title": "What are the Archetypes?",
      "md": "In total, there are three Archetypes: Martial, Mental, and Magic. Each archetype has its distinct way of playing the game and interfacing with combat, but can host any general character role (tank, damage, support, debuffer, etc). When designing a character for the first time, it is highly recommended that you stick to just one Archetype to learn the game. Below are some brief descriptions of each Archetype to help you decide."
     },
     {
      "id": "martial-archetype",
      "title": "Martial Archetype",
      "md": "**Weapon Types:** The Martial Archetype is defined by their equipment, known as Weapon Types. Essentially, a Weapon Type is a general idea of how a weapon works in the real world, categorized into a single stat block. This means, as you design a Martial character, you build them around one or more Weapon Types that you may find interesting or suitable for your targeted playstyle, with each of the 14 Weapon Types having their own unique skill tree and two different weights, light and heavy.\n\n**Armor Types:** Armor is broken up into 4 distinct weights; light, medium, heavy, and titanic. Each offers unique advantages and disadvantages compared to the others, and each has its own skill tree associated with it. You can only wear one armor at a time, and there is even a skill tree for if you want to play unarmored\\!"
     },
     {
      "id": "mental-archetype",
      "title": "Mental Archetype",
      "md": "**Wonders:** Wonders are essentially ideas and emotions that, when focused on, can form into real tangible effects. Wonders are split into two forms: Dreams and Nightmares, which are based on Religious/Spiritual Domains found a lot in fantasy settings, like Life/Death. Using Wonders requires having unlocked its associated Skill Tree, with each Dream having an antithetical Nightmare. Manifesting a Wonder is much more open ended than casting a spell or attacking with a weapon, allowing you to choose custom ranges and enhancements as needed, but they are quite limited in what they can accomplish.\n\n**Icons:** Icons are objects of belief or reverence that take on a named Form, which you Attune to in order to use. A Form grants a defensive Ward, as well as a Tenet: an extra effect tied to a Wonder of your choosing."
     },
     {
      "id": "magic-archetype",
      "title": "Magic Archetype",
      "md": "**Spells:** Magic skill trees are made up of a Core Spell and several mods. The mods can be activated when you cast that Core Spell to enhance or alter its effects at the cost of resources, and you can also combine two different Core Spells into a unique Combo Spell, allowing you to use both of their mods.\n\n**Foci and Shrouds:** Foci are an item that is used to cast your Spells. Not all Magic users require Foci to cast Spells, but generally Magic characters want a Foci to enable them to cast without requiring both casting stats. Shrouds on the other hand are like a veil attached to one's Spirit, which grants them defenses to various damage types, as well as other beneficial defensive effects. You can only ever attune to one Shroud and Foci at a time.\n\n**Affixes:** Affixes are gems that you Attune to separately (they only need to be on your person) to enhance your Foci, Shroud, and spell casting."
     }
    ]
   },
   {
    "id": "ch3-stats",
    "title": "Ch3 - Stats",
    "intro": "Each of the three Archetype stat groups have similar ways they are structured. For example: Constitution, Willpower, and Build all influence HP max and regen, and some form of defensive equipment’s power. Stats have no upper limit and no lower limit, and campaigns generally start you with 90 stat points (this can vary) which are spent 1 to 1 for stats (so you can start with 60 strength and 30 constitution if desired). Below is a detailed list of each stat, what it directly influences, and what its general use is within its archetype.",
    "sections": [
     {
      "id": "martial-stats-body",
      "title": "Martial Stats (Body)",
      "md": "**Strength** \\- Strength is a measure of how much force a character can put into each action they make as well as their overall focus. Affects Heavy weapon damage and effects.\n\n**Dexterity** \\- Dexterity is a measure of how quickly a character can physically react and act in combat. Affects Light weapon damage and effects.\n\n**Constitution** \\- Constitution is how much punishment a character can take, as well as how long they can last dishing out high power attacks. Affects armor stats and effects."
     },
     {
      "id": "mental-stats-mind",
      "title": "Mental Stats (Mind)",
      "md": "**Ponderance** \\- Ponderance is a measure of how focused one can be on long term ideas or thinking. Affects Dream power and effects.\n\n**Snappence** \\- Snappence, inversely, is a measure of how quickly one can react to changes happening directly around them. Affects Nightmare power and effects.\n\n**Willpower** \\- Willpower is simply a measure of how strong one's mind is, and how resilient they are to negative change. Affects your Icon’s defensive Ward and its effects."
     },
     {
      "id": "magic-stats-spirit",
      "title": "Magic Stats (Spirit)",
      "md": "**Reach** \\- Reach is a measure of how much energy one’s spirit can manipulate at a time. Reach affects your scaling with the Channeler casting form.\n\n**Grasp** \\- Grasp is a measure of how one understands and interfaces with magic. Grasp affects your scaling with the Igniter casting form.\n\n**Build** \\- Build is how energetic and tough one’s Spirit is, with more Build resulting in a denser Spirit. Build affects how powerful your Shroud is."
     },
     {
      "id": "stat-minimums",
      "title": "Stat Minimums",
      "md": "Any time you would roll a stat check out of combat (unless you’re in a time crunch), if your roll total is below your Minimum, it is set to your Minimum. Stat Minimums are also used in various skills and calculations, often read as Stat Min or “Stat Name” Min. More info on stat related checks can be found in Ch7."
     },
     {
      "id": "stat-bonus",
      "title": "Stat Bonus",
      "md": "In addition to any points invested in a stat, every stat a character has is increased by 1 for every 5 skill points they have. In other words, a baseline character with 30 skill points effectively has a floor of 6 in every stat."
     }
    ]
   },
   {
    "id": "ch4-skill-trees-groups",
    "title": "Ch4 - Skill Trees/Groups",
    "intro": "By this point you should have a character with an Archetype set, Stats put in, and ABC done (not finished don’t worry about it). With all this finished, you may already have an idea of what direction you want your character to go, but have no idea how to actually get there. This section will both explain how skill trees and groups work, and help give you an idea of which ones to focus on.",
    "sections": [
     {
      "id": "what-is-a-skill-tree",
      "title": "What is a skill tree?",
      "md": "Skill trees in Flow State are a linear path of unlockable skills/features separated out by tiers. Each tier requires the previous one to obtain, and once unlocked, you permanently gain whatever features that tier gives."
     },
     {
      "id": "how-do-i-get-skill-trees",
      "title": "How do I get skill trees?",
      "md": "Skill trees are improved using skill points, which are acquired whenever you would gain stat points. For every 3 stat points a character gains (through character growth), they also gain 1 skill point (known as the 3-1 stat-skill ratio). For most campaigns, players will start with 90 stat points, meaning they also start with 30 skill points."
     },
     {
      "id": "how-do-i-use-skill-points",
      "title": "How do I use Skill Points?",
      "md": "Skill points are spent unlocking the various tiers of skill trees. Tiers cost an amount of skill points to unlock equal to their tier. In other words, to go from tier 4 to 5 in a skill tree, you would need to spend 5 skill points. To help visualize this, getting from tier 0 to tier 5 in *any* skill tree requires 15 skill points total. With your 30 starting skill points, this means you could easily pick two trees to put to tier 5 and call it a day. Also, if you don’t want to spend some leftover points, they can be banked away for future use, but still count towards your total skill points."
     },
     {
      "id": "what-is-a-group",
      "title": "What is a Group?",
      "md": "You’ve already been acquainted with the three Archetypes; Martial, Mental, and Magic. These are examples of Groups, which are essentially bundles of skill trees that have both a common structural tree (like the Theories for the Archetypes) as well as an overarching theme. Groups can be as small as just three skill trees, or as large as even 30 or more. Generally speaking, most characters will stick to just knowing 1-2 Groups until much further into a campaign, however you are not restricted in their acquisition in any way."
     },
     {
      "id": "the-theories",
      "title": "The Theories",
      "md": "Each archetype has a titular Theory skill tree, outlining how the archetype itself plays out. In addition to this, each tier unlocks further skill trees for usage. So, if you want to use Brawling Methods in Martial, you would need at least Martial Theory at Tier 1, then you could pump Brawling Methods up as much as you can with your remaining points. The skills, actions, and passives found within each Theory offer both general rules to play that Archetype, but also features that can improve and define how you might play your character, so I highly suggest reading your respective Archetype Theory to understand both how to play, and what you can do at the top end."
     },
     {
      "id": "generic",
      "title": "Generic",
      "md": "Each Archetype's skill trees function exclusively within that Archetype, with specific abilities to help them synergize with the other Archetypes (Magic’s Weaving for example). The Generic Groups however are much broader with their applications. Generic Groups focus on things like Perception, Stealth, Speech, Energy, and many more concepts."
     }
    ]
   },
   {
    "id": "ch5-a-b-c-s",
    "title": "Ch5 - A.B.C.s",
    "intro": "Will be completed with 1.0’s release. For now, default to this all being based on flavor with little to no mechanical effect (A.B.C. stands for Ancestry, Background, and Culture).",
    "sections": []
   },
   {
    "id": "ch6-equipment",
    "title": "Ch6 - Equipment",
    "intro": "",
    "sections": [
     {
      "id": "archetypal-equipment",
      "title": "Archetypal Equipment",
      "md": "All equipment used in the three Archetypes is known as Archetypal Equipment. This includes Weapons, Armor, Icons, Foci, Shrouds, and Affixes. All equipment found within this system has a multitude of unique rules and mechanics behind them, all of which is located in the relevant [Equipment Document](https://docs.google.com/document/u/0/d/1bjinhIrPGJr0Ss4M9fjlCRSZrteX5r9yjsSuhYkMuag/edit). For most starter characters in standard campaigns, you will start with a few pieces of common or uncommon equipment of your chosen Archetype(s), with exact specifics being up to the GM."
     },
     {
      "id": "non-archetypal-equipment",
      "title": "Non-Archetypal Equipment",
      "md": "All things that do not fall explicitly into the Archetypal Equipment category instead fall here, and are generally treated or just referred to as “Objects”. There will be an expansive document detailing all of the various NA Equipment out there, but that all requires the ABCs, Gathering Professions, and Production Categories to be finished, so for now this section is empty."
     }
    ]
   },
   {
    "id": "ch7-non-combat-rules",
    "title": "Ch7 - Non Combat Rules",
    "intro": "",
    "sections": [
     {
      "id": "modular-dice",
      "title": "Modular Dice",
      "md": "As you’ll see in the below sections, this system does not use standard dice for its rolling mechanisms and instead uses what is referred to as a “Modular Die” system. The reason for this is because it's a lot easier to backwards balance things when you never use modifiers for accuracy/checks, and additionally because Flow State is a digital only system, it can make full use of Modular Dice. Expect non standard dice to be everywhere, and Die Size to be referenced a lot (it simply refers to literally what comes after the “d”, so a die size of 15 is a d15)."
     },
     {
      "id": "stat-checks",
      "title": "Stat Checks",
      "md": "Stat checks are rolled in response to various abilities or situations, and their die is a size equal to double your relevant stat. So having 30 Strength means you roll a d60 strength check. As mentioned in Ch3, your “Stat Minimum” (which is 1/3rd your stat, rounded down) is the absolute minimum you can roll while outside of combat or time intensive moments. Otherwise, assume you can make one stat check every few seconds to minutes depending on the time needed for the difficulty of the check, and if you ever roll below your stat minimum the roll is automatically set to your stat minimum."
     },
     {
      "id": "advantage-disadvantage",
      "title": "Advantage/Disadvantage",
      "md": "Advantage and Disadvantage are stacking keywords that affect checks, attack rolls, and dodge rolls. They can stack infinitely, and one stack cancels out one stack of the other. When rolling with Advantage or Disadvantage, roll an extra die per stack, and use the highest (Advantage) or lowest (Disadvantage) for the result."
     },
     {
      "id": "size-categories",
      "title": "Size Categories",
      "md": "All creatures fall into a size category, which affects things such as how much space your character takes up, maximum movement speed, hunger rate, max HP, and melee attack range. All playable characters have a default size of 3 unless stated otherwise. Aside from what is listed below, your size also affects your Max Health, Pain Threshold, and Grappling rules (see those sections for more details).\n\n**Size 1:** Takes up less than a 1 ft cube of space, has a max movespeed of 10ft/AP, eats ¼ of a ration a day, has doubly Weakened physical attacks, and has a 1ft melee attack range.  \n**Size 2:** Takes up a 1-3 ft cube of space, has a max movespeed of 25ft/AP, eats ½ of a ration a day, has Weakened physical attacks, and has a 3ft melee attack range.  \n**Size 3:** Takes up a 3-5 ft cube of space, has a max movespeed of 50ft/AP, eats 1 ration a day, and has a 5ft melee attack range.  \n**Size 4:** Takes up a 5-10 ft cube of space, has a max movespeed of 100ft/AP, eats 2 rations a day, has Strengthened physical attacks, and has a 10ft melee attack range.  \n**Size 5:** Takes up a 10-20 ft cube of space, has a max movespeed of 200ft/AP, eats 4 rations a day, has doubly Strengthened physical attacks, and has a 20ft melee attack range."
     },
     {
      "id": "non-stat-checks",
      "title": "Non Stat Checks",
      "md": "Most checks made that are not tied to any stat and are not attack/dodge checks are simply done by rolling a d100. This includes things such as Stealth, Perception, Persuasion, Deception, counter Persuasion/Deception, and Initiative."
     },
     {
      "id": "persuasion-deception",
      "title": "Persuasion/Deception",
      "md": "During roleplay, one can attempt to persuade or even deceive a target. Doing so will require a d100 persuasion/deception roll, going up against a “counter roll” by the target, which is also a d100 (though this rarely gets any bonuses to it). If the target is friendly, all rolls are made normally. If the target is neutral, their counter roll for persuasion has Advantage. If hostile, they cannot be persuaded and deception counter rolls have Advantage."
     },
     {
      "id": "rest",
      "title": "Rest",
      "md": "Characters must rest 8 hours each day. You can go without rest for up to 3 days, but the amount of rest you’d need to recover is cumulative. After 1 day, you have Disadvantage on all rolls. At 3 days, you fall unconscious until a full 24 hours of rest is completed."
     },
     {
      "id": "traveling-speeds",
      "title": "Traveling Speeds",
      "md": "When traveling, base party speed equals the slowest member’s speed, halved (rounded down). Using a vehicle grants you the positive effects of slow speed without the speed penalty. Choose one of three travel paces:   \n**Fast:** \\+50% speed, no downtime. 16 hours travel (8 rest).  \n**Normal:** Regular speed, 12 hours travel (4 downtime, 8 rest), party is always aware.  \n**Slow:** Half speed, 8 hours travel (8 downtime, 8 rest), party is always aware and can perform activities during travel."
     }
    ]
   },
   {
    "id": "ch8-combat-rules",
    "title": "Ch8 - Combat Rules",
    "intro": "",
    "sections": [
     {
      "id": "turn-order",
      "title": "Turn Order",
      "md": "At the start of combat, all characters whether they are surprised or not roll their initiative die (normally a d100). When round 1 starts (after the surprise round of round 0), all non-surprised characters get access to all of their RP, and can react just as combat is beginning if desired. From here, the person with the highest initiative goes, then the next highest, continuing until the final person has gone, then resetting back to the top for round 2 using the same scores."
     },
     {
      "id": "action-points-ap",
      "title": "Action Points (AP)",
      "md": "Whether you're swinging a sword, casting a spell, or manifesting the essence of wrath to annihilate someone, you are spending AP (or RP) to do so. Every character has 6 AP, which refills at the start of their turn, and goes away at the end of their turn if it's unused. Each Archetype’s attack system (Martial have attacking, Mental have manifesting, and Magic have casting) follows the baseline cost of 1-3 AP to do their thing once. This means, the typical character can make 2-6 attacks per turn using their AP. Many other skills, actions, and even movement also cost AP, which will be listed in their respective sections. A final note, 1 AP is roughly equal to 1 second of time passage, with rounds being a total of 6 seconds long."
     },
     {
      "id": "reaction-points-rp",
      "title": "Reaction Points (RP)",
      "md": "Just the same as AP, every character gets 6 RP at the start of their turn, however it only goes away when you would start your turn again. This means that the RP persists beyond your turn, up until it's your turn again in which it goes away. RP are often used for interrupt based abilities that require some kind of condition to be met (like being attacked, being hit, an ally being attacked, etc), but not all Reactions are like this. Some can just be done at any time (such as a spell cast with the React mod for magic), in these cases you must declare the very moment they are occurring. When this happens, other characters may also react with their reactions, which will occur before yours, then once everyone is finished declaring, you follow down the chain of reactions until they're all finished. If a reaction is made invalid for some reason, it's treated as if it never happened, so no resources or RP are lost."
     },
     {
      "id": "movement",
      "title": "Movement",
      "md": "During their turn, characters can move using 1 AP in any direction they choose for their Movement Speed. Movement Speed itself increments in values of 5ft rounding down, and its value is based on various equipment/abilities that give benefits at the cost of speed, having a minimum of 5ft after all reductions. This is also represented in the game by grid spaces, a grid space equalling 5ft. Base movespeed cannot exceed your size limitations unless you are using specified features to increase it (see size for more info), and is by default equal to your Size’s maximum movespeed. All movement speed percentage effects are additive, so two 20%s result in a 40% decrease."
     },
     {
      "id": "rough-difficult-terrain",
      "title": "Rough/Difficult Terrain",
      "md": "Rough terrain (swamps, thick brush, rubble) increases movement cost by 1 AP. Difficult terrain (water, steep climbs) increases movement cost by 2 AP. These penalties stack with other forms of movement penalties and slows, but do not stack with each other."
     },
     {
      "id": "jumping",
      "title": "Jumping",
      "md": "You can jump up to 1/5th of your movement speed vertically, and your full movement speed horizontally. The midpoint of the jump is the jump's peak. Jumping costs 2 AP, and any movement slowing effects are doubly effective on this cost."
     },
     {
      "id": "targeting",
      "title": "Targeting",
      "md": "Most attacks in this game are made against a single declared target. Unless otherwise stated, any objects or other targets in the way of your attack (such as armor, shrouds, walls, etc) must be broken through by dealing enough damage to get through their individual Limits (see Object rules for more info) before the next thing in line is hit. You can declare anything sensible as a target, from armor, to weapons, to even backpacks. If you would overkill a target, unless specified, any excess damage is lost. “Targeting directly” refers to targeting something that has nothing in the way at the time of the declaration."
     },
     {
      "id": "attacking-dodging",
      "title": "Attacking/Dodging",
      "md": "Attack rolls made by any character always have a die size equal to your total skill points, so starter characters would attack using a d30. Meanwhile, dodge rolls are made using two dice, each equal in size to half of your total skill points, rounded down, so a starter character would roll 2d15. Resolving a hit would be as simple as the attacker making an attack roll, the defender making a dodge roll, both roll totals being compared. If the attacker is equal to or higher, they hit and roll damage, otherwise they miss. If an attack is made in a situation where there is no duress (outside of combat for example), then the attack can automatically hit (a roll would be required to Crit)."
     },
     {
      "id": "attack-source",
      "title": "Attack Source",
      "md": "This term comes up a lot in various skill trees, so here it is plainly. Every Archetype has its own “types” for attacking. Martials have Weapons, Mentals have Wonders, and Magics have Spell Schools. Each of these is considered an attack source, and anything within them that enhances those attacks or offers alternatives is considered a part of them. The Unarmed attack source is a catch all for both Unarmed strikes and Grapple attacks."
     },
     {
      "id": "attacking-allies",
      "title": "Attacking Allies",
      "md": "When you target an ally, willing target, or yourself with an effect, you must still roll your attack roll against that target’s dodge roll. You can still miss the attack as per the standard attack rules, and can still Crit."
     },
     {
      "id": "attacking-objects-nothing",
      "title": "Attacking Objects/Nothing",
      "md": "An attack against an inanimate object, or against a point in empty space, automatically hits. Against objects, your attack roll is instead rolled to determine a critical hit, with rolls higher than or equal to the target’s Body (or Grade\\*10 if it has no Body) being a crit. An attack against empty space cannot crit. An object being worn or held by a creature uses that creature's dodge roll instead. This does not override effects that state their own required result against objects."
     },
     {
      "id": "strafing",
      "title": "Strafing",
      "md": "Strafing refers to moving while performing an action. So long as your Movement coincides with an Action that can be used within that Movement’s AP, that action can be performed using that same AP. In other words, you can strike someone with an attack using 2 AP, then with that same AP move backwards twice your movespeed."
     },
     {
      "id": "damage-rolls-types",
      "title": "Damage Rolls/Types",
      "md": "Damage rolls themselves can never benefit from Advantage and Disadvantage, instead using the Strengthened/Weakened system which is below. In total, there are 7 damage types and 4 overall damage categories. These types have no meaning on their own (aside from Arcane), instead they are for both flavor and setup.\n\n**Physical Category**: Entirely made up of just the Physical damage type, to keep things simple.  \n**Elemental Category**: Made up of the Heat, Cold, Acid, and Radiation damage types, typically found as environmental effects usually with bonus effects (nothing innate).  \n**Magical Category:** Made up mainly of Arcane damage, which is Weakened against targets that are not fully Magical and passes through (is not blocked by) non-magical things. Any damage produced by Magic is also Magical in addition to its own type (e.g. a Heat spell is Heat and Magical), allowing it to be blocked by protections that are either Magical or whatever type it is.  \n**Supernatural Category:** Damage dealt by Supernatural Sources (such as creatures made with Esoteric Arts in Mental) is treated as both Supernatural and whatever its normal damage type is, if it has a normal damage type (it can just be pure Supernatural)."
     },
     {
      "id": "strengthened-weakened",
      "title": "Strengthened/Weakened",
      "md": "Damage dice cannot be rolled with Advantage or Disadvantage, instead they get the Strengthened or Weakened keywords, which can stack with no inherent limit, and one stack cancels out one stack of the other, happening before damage calcs. Strengthened stacks additively give the base damage \\+50% increased damage, so three stacks would increase the damage by 150% (10 damage becomes 25 damage). Weakened, inversely, stacks multiplicatively, so three Weakened stacks goes 0.5\\*0.5\\*0.5, resulting in 0.125x damage (10 damage becomes 1 damage), rounding down with no minimum. In addition, Strengthened/Weakened stacks apply to numerical Bolded/Scaling effects found in the three Archetypes, such as Force applied, Slow/Haste stacks, etc."
     },
     {
      "id": "critical-hits",
      "title": "Critical Hits",
      "md": "To achieve a critical hit (crit), you must be attacking a target and roll double or more the result of the defender’s dodge dice for your attack result. Critical hits are doubly Strengthened (two stacks of Strengthened). Double Crits (happen rarely with abilities, and with Full Stealth later) give four Strengthened Stacks instead."
     },
     {
      "id": "health-points",
      "title": "Health Points",
      "md": "Health Points (HP) are a measure of how beat up and broken your character is. Your HP is determined by (Con+Will+Build)\\*(Size\\*3), and you regain HP equal to your Con, Will, and Build minimums combined every time you complete an 8hr rest. If your HP drops to 0 or below, you die, and any excess damage is tracked as Overkill damage. Overkill damage is tracked up to your max HP; at that point, your body is destroyed. In addition, one can also lose Max HP, representing actual chunks of your body being taken off. Natural regeneration does not heal Max HP."
     },
     {
      "id": "pain-threshold",
      "title": "Pain Threshold",
      "md": "Your Pain Threshold is a value that shows when your character would fall unconscious if their current HP dropped below that value, staying unconscious until they rise back above that value. Your Pain Threshold is always equal to half of your Maximum HP, rounded down."
     },
     {
      "id": "energy",
      "title": "Energy",
      "md": "Energy is used by all Archetypes to use various abilities and actions. Your maximum energy is equal to 5x your skill points, and you can spend 1 AP to recover 1/10th of your max energy, rounded down. In addition, you regain energy equal to 2 AP of recovery at the start of each of your turns."
     },
     {
      "id": "grappling",
      "title": "Grappling",
      "md": "Grappling is an involuntary capturing of one creature by another, typically requiring at least one free hand to maintain, and requiring you to be the same size or larger than the target you are grappling. While Grappled, a creature cannot move outside of the range of whatever is grappling them. The various ways grappling can be achieved are outlined in the Martial, Mental, and Magic documents. Once a creature is grappled, it can spend 2 AP to make a counter grapple check. This involves it making an attack roll against its grappler (who rolls dodge), with a success meaning it breaks free (some rules may vary by archetype, such as Magic’s Hold being rolled against a fixed value). If its grappler is an object, instead it makes that attack roll against the Limit of that object (they can also break the object to free themselves, if possible). Dragging a grappled target costs \\+1 AP per move."
     },
     {
      "id": "pushing",
      "title": "Pushing",
      "md": "Similarly to grappling, you can choose to instead simply push a target. This can only be done with a Martial attack roll, and instead of applying damage you impart an amount of force equal to 5x your Strength stat to the target (see Ch10 for more info on what Force does)."
     },
     {
      "id": "cover",
      "title": "Cover",
      "md": "Cover is determined by if part of your body is open: if none of your body is open you have full cover; if up to half of your body is open you have half cover; if more than half is open you have no cover. While in full cover, attacks are treated as if the cover is in the way, in addition having Disadvantage on their attack rolls if the attacker cannot easily sense you, with the cover also being hit on a miss. While in half cover, only ranged and area attacks have Disadvantage hitting you, but the cover is no longer in the way, with the cover only being hit on a miss."
     },
     {
      "id": "stealthing",
      "title": "Stealthing",
      "md": "On your turns (whether in or out of combat), you can choose to begin acting stealthily. Doing so causes your movement to be affected as if you were in rough terrain (+1 AP per movement). While stealthing, the volume of sounds you produce is treated as soft instead of medium, and you count as lightly obscured except in well lit environments. Whenever you would be targeted with a spot check, you will need to roll your stealth check, which is normally a d100."
     },
     {
      "id": "stealth-value",
      "title": "Stealth Value",
      "md": "Your stealth value for each target you would interact with while stealthed can either be “half” or “full”, depending on whether or not one or both of the following are active (if only one is active, you are in half stealth to that character, and if both are active you are in full stealth):\n\n- The target is unable to sense you, or if they can, they have not spotted you (assuming you are trying to hide from them).  \n- The target is unaware of combat occurring. This will always be inactive during combat."
     },
     {
      "id": "sneak-attack",
      "title": "Sneak Attack",
      "md": "Attacking from stealth can either be done from half stealth or full stealth. Half stealth gives you Advantage on the attack roll, and the target(s) Disadvantage on their dodge roll. Full stealth completely prevents the target(s) from reacting, meaning they roll no dodge roll. Your attack roll is instead rolled to determine if you crit, requiring a roll equal to or higher than the size of one of their dodge dice. If you roll double or more than this value, you instead deal a Double Crit."
     },
     {
      "id": "perception-and-senses",
      "title": "Perception and Senses",
      "md": "Counter to stealth, perception is one's ability to sense the world around them in various ways, and they use perception through one of three main senses (more can be found in Mental/Magic). Each one of your senses can be Secondary, Primary, or Heightened. If you have no Primary or Heightened senses, all actions that rely on senses are made with Disadvantage, and if all of your senses are none of the three, then you cannot make any actions that require senses. At any time a target is within your senses, you can spend 1 AP to use the Spot action, which lets you roll your perception die (normally a d100) against their stealth roll. The three main senses and their default state are as follows:\n\n- Sight (Default Primary): Your ability to physically see targets.  \n- Hearing (Default Primary): Your ability to physically hear targets.  \n- Smell (Default Secondary): Your ability to physically smell targets.\n\n| Senses Table |  |  |  |\n| ----- | :---- | ----- | ----- |\n| Sense Type | Obstacle | Requires a Check | Auto Pass |\n| Sight | Unobscured (Line of Sight) | Secondary | Primary |\n| Sight | Light Obscure (Melee) | Secondary | Primary |\n| Sight | Light Obscure (100ft) | Primary | Heightened |\n| Sight | Light Obscure (1,000ft) | Heightened | \\- |\n| Sight | Heavy Obscure (Melee) | Primary | Heightened |\n| Sight | Heavy Obscure (100ft) | Heightened | \\- |\n| Hearing | Loud Noise (1,000ft) | \\- | Secondary |\n| Hearing | Medium Noise (100ft) | Secondary | Primary |\n| Hearing | Medium Noise (1,000ft) | Primary | Heightened |\n| Hearing | Soft Noise (Melee) | Secondary | Primary |\n| Hearing | Soft Noise (100ft) | Primary | Heightened |\n| Hearing | Soft Noise (1,000ft) | Heightened | \\- |\n| Smell | Strong Odor (1,000ft) | Secondary | Primary |\n| Smell | Normal Odor (100ft) | Secondary | Primary |\n| Smell | Normal Odor (1,000ft) | Primary | Heightened |\n| Smell | Weak Odor (Melee) | Secondary | Primary |\n| Smell | Weak Odor (100ft) | Primary | Heightened |\n| Smell | Weak Odor (1,000ft) | Heightened | \\- |"
     }
    ]
   },
   {
    "id": "ch9-conditions",
    "title": "Ch9 - Conditions",
    "intro": "",
    "sections": [
     {
      "id": "crouch-prone",
      "title": "Crouch/Prone",
      "md": "Crouching makes you 50% your size for hiding behind cover, and can be done at any time while it is your turn. While crouching you are treated as if in rough terrain, but have no other benefits or drawbacks. Being prone makes you count as 25% of your size for hiding behind cover, and can be done by spending 1 AP, with standing up also requiring 1 AP. While prone you have Disadvantage on dodging attacks unless you have some kind of method of dodging while prone, enemies have Advantage when attacking you in melee, and you are treated as if you are in difficult terrain."
     },
     {
      "id": "fear",
      "title": "Fear",
      "md": "Fear can be applied in a variety of ways, but can also occur naturally in situations where your character is experiencing fear, such as being intimidated, experiencing a horror beyond your imagination, coming face to face with a phobia, etc. *To resist the effects of Fear when applied this way, roll Constitution, Willpower, or Build, requiring a result at least equal to the fear source’s Skill Points multiplied by its Size.* If the source of fear is not a creature, the result required is up to the GM. While affected by Fear, a character may not gain Energy from any source, including regen."
     },
     {
      "id": "ignite",
      "title": "Ignite",
      "md": "Ignite is a stacking value that applies to an object or creature. At the end of that Creature’s turn (or at the start of the round for objects) it takes Heat damage equal to its Ignite stacks. Attempting to put it out requires 2 AP to be spent and can be done by any creature in melee range of the Ignited thing, which removes all Ignite stacks currently on them. If a target with Ignite stacks takes any amount of Cold damage, all Ignite stacks are removed from them. Ignite damage does not ignore armor, barriers, or temp HP."
     },
     {
      "id": "ignite-spread",
      "title": "Ignite Spread",
      "md": "*This rule is optional and is only intended for more realistic games.*  \nIgnite spreads differently depending on if the afflicted target is attempting to put it out or not. If attempted, it does not naturally increase. Otherwise, it increases by 10% (rounded down) every turn unless it is greater than or equal to that target's Pain Threshold or Limit. If it is at or above that cap, instead it attempts to spread twice to surrounding tiles, with each spread requiring its own d8 roll to determine direction. Whether it's spreading to an ignited source or not, add Ignite stacks to that tile equal to 10% of the source’s stacks."
     },
     {
      "id": "stain",
      "title": "Stain",
      "md": "Stain is a stacking value that applies to an object or creature. At the end of that Creature’s turn (or at the start of the round for objects) it takes Acid damage equal to its Stain stacks. Removing Stains can be done by anyone in melee range (can also be the one who is Stained) who spends 3 AP, which instantly removes all Stains from that target. Stain damage does not ignore armor, barriers, or temp HP."
     },
     {
      "id": "slow",
      "title": "Slow",
      "md": "Slow is a stacking value that applies to a creature. While a creature has at least half their Pain Threshold in Slow stacks, their movement costs are increased by \\+1 AP. This grows to \\+2 AP if their Slow stacks reach or exceed their Pain Threshold. At the end of a creature with Slow stack’s turn, it reduces its Slow stacks by half of its Pain Threshold, rounded down. Haste and Slow stacks cancel each other out equal to their values."
     },
     {
      "id": "haste",
      "title": "Haste",
      "md": "Haste is a stacking value that applies to a creature. While a creature has at least half their Pain Threshold in Haste stacks, their movement costs are decreased by 1 AP (if already 1, they move twice as fast). If instead they have Haste stacks greater than or equal to their Pain Threshold, their movement costs are decreased by 2 AP (if already 1, they move three times as fast. If at 2, they cost 1 and they move twice as fast). At the end of a creature with Haste stack’s turn, it reduces its Haste stacks by half of its Pain Threshold, rounded down. Haste and Slow stacks cancel each other out equal to their values."
     }
    ]
   },
   {
    "id": "ch10-objects-and-force",
    "title": "Ch10 - Objects and Force",
    "intro": "",
    "sections": [
     {
      "id": "objects",
      "title": "Objects",
      "md": "Anything that is non-living counts as an object, from armor, to animated objects, and even weapons. Summoned entities are considered creatures, not objects."
     },
     {
      "id": "body",
      "title": "Body",
      "md": "Objects have a Body score, which shows their overall size. Refer to the chart below to determine the other stats of objects based on their body."
     },
     {
      "id": "durability",
      "title": "Durability",
      "md": "The overall “health” of the Object. Reaching 0 or lower means the Object is broken and can no longer be used, but it is still fixable. Negative durability equal to or exceeding the normal max means the Object is completely destroyed."
     },
     {
      "id": "limit",
      "title": "Limit",
      "md": "How much damage the Object can take from each attack it blocks or attacks that are hitting through it. This is ignored if the Object is the target of the attack."
     },
     {
      "id": "material-stats",
      "title": "Material Stats",
      "md": "*Note that archetypal equipment works differently for Limit and Durability (see the Equipment doc). 1 body of a material is roughly equal to a cubic foot of it, meaning 25 body equals a 5x5x1ft tile, and 125 body equals a 5x5x5ft cube.*\n\n*The following chart bases all other stats off the Body of the material and its Type, so for every Body a material has, it has that much multiplied by the other listed stats, rounding down.*\n\n| Material Type | Body | Durability | Limit |\n| :---- | :---: | :---: | :---: |\n| Powder/Liquid | 1 | 1x | 1x |\n| Soft | 1 | 2x | 0.25x |\n| Hard | 1 | 4x | 0.5x |\n| Dense | 1 | 8x | 1x |\n| Super Dense | 1 | 16x | 2x |\n\n*This chart lists a majority of the materials in the system and their rarity and density. This list is not exhaustive, and does not include things like gems, other fantasy materials, or a good chunk of elements.*\n\n| Name | Rarity | Density |\n| ----- | ----- | ----- |\n| Hardwood | Common | Soft |\n| Softwood | Common | Soft |\n| Bone | Common | Soft |\n| Iron | Common | Dense |\n| Copper | Common | Dense |\n| Stone | Common | Hard |\n| Cloth | Common | Soft |\n| Soft Leather | Common | Soft |\n| Hide | Common | Soft |\n| Titanium | Common | Hard |\n| Clay | Common | Soft |\n| Coal | Common | Soft |\n| Charcoal | Common | Powder/Liquid |\n| Cotton | Common | Powder/Liquid |\n| Wool | Common | Soft |\n| Salt / Halite | Common | Soft |\n| Water | Common | Powder/Liquid |\n| Oil | Common | Powder/Liquid |\n| Sand | Common | Powder/Liquid |\n| Ash | Common | Powder/Liquid |\n| Chalk Dust | Common | Powder/Liquid |\n| Blood | Common | Powder/Liquid |\n| Steel | Uncommon | Dense |\n| Bronze | Uncommon | Dense |\n| Glass | Uncommon | Hard |\n| Silver | Uncommon | Super Dense |\n| Amberite | Uncommon | Soft |\n| Obsidian | Uncommon | Hard |\n| Cold Iron | Uncommon | Dense |\n| Quartz | Uncommon | Hard |\n| Chitin | Uncommon | Soft |\n| Hard Leather | Uncommon | Soft |\n| Aluminum | Uncommon | Hard |\n| Brass | Uncommon | Dense |\n| Tin | Uncommon | Dense |\n| Zinc | Uncommon | Dense |\n| Brick | Uncommon | Hard |\n| Granite | Uncommon | Hard |\n| Marble | Uncommon | Hard |\n| Sulfur | Uncommon | Soft |\n| Tar / Pitch | Uncommon | Powder/Liquid |\n| Resin | Uncommon | Powder/Liquid |\n| Alcohol / Spirits | Uncommon | Powder/Liquid |\n| Lime Powder | Uncommon | Powder/Liquid |\n| Pigment Powder | Uncommon | Powder/Liquid |\n| Gray Iron | Rare | Dense |\n| Scarletite | Rare | Dense |\n| Frigidium | Rare | Dense |\n| Positron | Rare | Hard |\n| Wyrm Metal | Rare | Dense |\n| Nickel | Rare | Dense |\n| Lead | Rare | Super Dense |\n| Mercury | Rare | Powder/Liquid |\n| Jade | Rare | Hard |\n| Cobalt | Rare | Dense |\n| Gravesalt | Rare | Soft |\n| Gray Steel | Very Rare | Dense |\n| Orichalcum | Very Rare | Super Dense |\n| Mithrite | Very Rare | Hard |\n| Adamantine | Very Rare | Super Dense |\n| Gold | Very Rare | Super Dense |\n| Platinum | Very Rare | Super Dense |\n| Tungsten | Very Rare | Super Dense |\n| Beryllium | Very Rare | Soft |\n| Aetherwood | Very Rare | Soft |\n| Leviathan Chitin | Very Rare | Hard |"
     },
     {
      "id": "force",
      "title": "Force",
      "md": "Force is a measure of how much kinetic force is being applied at any given time. Forced movement skips steps 1 and 2, instead going directly to Force damage. To resolve Force:\n\n1. If the target is using Lift, subtract their Lift from the total Force. If the remaining Force is zero or lower, this process ends  \n2. Subtract half their Max HP/Durability from the remaining Force unless they are falling via Gravity. Then divide the remaining Force by 10, rounded down. The result is the number of feet the target is pushed in the direction of the Force.\n\nIf Force applied is downward and is an amount of feet equal to or greater to that character’s height the target is knocked prone in addition to the damage dealt."
     },
     {
      "id": "force-damage",
      "title": "Force Damage",
      "md": "If a creature is pushed by Force into an object or another creature, they take Physical damage equal to 3 × the remaining untraveled distance (in feet). This damage is subject to reduction as normal. The struck object or creature takes the same amount of damage. If the pushed entity’s body would be destroyed during impact (for example, it can only take 400 more damage), then only that much damage is transferred to the object or creature it collides with, with the same working vice versa (continuing the travel afterwards if there is remaining force leftover)."
     },
     {
      "id": "gravity",
      "title": "Gravity",
      "md": "Every setting has a Gravity value (G), which is the downward Force imparted to unsupported creatures and objects, representing the strength of that world's gravity. Standard gravity is 1, meaning Gravity equals your Max HP exactly**.** A GM may raise or lower G to model different worlds. A low-gravity moon sits at 0.5 G (or half Max HP), a crushing high-gravity world sits at 2 or 3 G, and zero-G sits at, literally, 0 G."
     },
     {
      "id": "gravity-force",
      "title": "Gravity Force",
      "md": "When a creature or object is unsupported or falling, at the start of its turn (or at the start of a round for objects) it accrues downward Gravity Force (based on the Gravity of where they currently are), resolved through the Force system. This increases by the baseline Gravity Force each turn the thing is falling, capping out after a number of rounds based on Size, as seen below (known as Terminal Velocity):  \n**Size 1:** 1 round, but takes no Force Damage from falling.  \n**Size 2:** 1 round.  \n**Size 3:** 2 rounds.  \n**Size 4:** 3 rounds.  \n**Size 5:** 4 rounds."
     },
     {
      "id": "flight",
      "title": "Flight",
      "md": "Any creature can fly so long as it has something providing it enough Lift. If you are flying downwards, your flight speed doubles. If you're generating Lift yourself and take damage equal to or greater than 1/10th of your Max HP or you are hit by enough Force to push you, you must spend 3 RP to stabilize yourself or you begin falling (see Gravity Force).  \n**Lift ≥ ½ Your Current Gravity Force:** You fall slowly and safely when stabilized (no Force Damage from falling) at a rate equal to 10ft per round.  \n**Lift ≥ Your Current Gravity Force:** Your flight speed equals your ground movement speed. You are not affected by downward gravity while stabilized (due to your lift being higher than the gravity force you would receive)."
     }
    ]
   }
  ]
 },
 {
  "id": "equipment",
  "title": "Equipment",
  "chapters": [
   {
    "id": "martial-weapons",
    "title": "Martial Weapons",
    "intro": "",
    "sections": [
     {
      "id": "weapon-info",
      "title": "Weapon Info",
      "md": "**Weapon Design:** Weapons are made up of two parts, but can visually be anything that you desire so long as it fits the type of weapon it is and the era your game takes place in. Pick a Weapon type and weight from the list, then a material matching its weight. Weapons with multiple types/materials (but not weights) can exist, but they cost more and are harder to make.  \n**Weight:** The weight of a Weapon denotes two things; its Scaling Stat and its AP to attack. Light Weapons scale with Dexterity and take **2 AP** to attack, whilst Heavy Weapons scale with Strength and take **3 AP** to attack (Heavy Weapons generally do more damage and/or have more tags). Weapon weight is set in stone when the material is decided, and cannot be changed without modifying the Weapon. If a material has both weights listed, which one it has is decided when the Weapon is created, and can only be changed by modifying the Weapon.  \n**Scaling and Grade:** The damage die count (and other features) listed in each Weapon increases for every 10 points you have in its Scaling Stat, which is Strength or Dexterity depending on the Weight of your Weapon. The grade of a weapon determines the amount a Stat can affect a weapon's scaling, where every 1 grade represents a max of 10 Stat scaling. So, a grade 3 Weapon allows for up to 30 Strength/Dexterity to affect its Stats, any higher would do nothing until the Grade is increased. This also applies to scaling tags such as Knockback, Cleave, etc, limiting them to only allow scaling up to the grade value.  \n**One vs Two Hands:** Two handing a Weapon gives the damage a stack of Strengthened and doubles the Knockback, Cleave, Pierce, and Bash of the Weapon. This does not affect any other stats, and does not work with Unarmed Attacks. Changing your held weapon takes **1 AP**, assuming the new one is on your person and easily accessible.  \n**Unarmed Attacks:** Unarmed attacks do not have a material but can dynamically shift from being made Light or Heavy. When you go to make one, declare which attack type you are making for that attack. Light Unarmed attacks require **2 AP**, while Heavy require **3 AP.** *Damage dealt to objects from Light unarmed attacks naturally has a stack of Weakened.*  \n**Improvised Weapons:** At a baseline, any object that isn’t explicitly a Weapon Type can still be used as an Improvised Weapon, dealing 1d6 damage per 10 scaling stat, functioning with either Strength or Dexterity as its scaling stat."
     },
     {
      "id": "melee-tags",
      "title": "Melee Tags",
      "md": "**Broad:** This Weapon’s Durability and Limit are twice as high as they normally would be. **Broad+** gives three times those stats instead.  \n**Cleave:** This weapon deals additional damage equal to your Scaling Stat Min against specifically objects, applied before normal damage (still counts for the Limit, so 30 Cleave \\+ 30 damage against 30 Limit means the 30 damage goes through while the Cleave hits the armor). **Cleave+** instead deals additional damage to specifically objects equal to your Scaling Stat.  \n**Knockback:** Any hit on a target with this Weapon can impart Force to them up to 5x your Scaling Stat in the direction of your attack. All bonus Knockback is additive, and does not change the base. **Knockback+** adds extra knockback equal to the base.  \n**Fast:** When you make an attack with a Weapon, you may make another attack at no AP/RP cost with a different held Weapon that has the Fast tag. The extra attack has disadvantage on its attack roll. This triggers once per AP/RP attack. The extra attack has no disadvantage with **Fast+** weapons.  \n**Pierce:** This Weapon ignores Limit equal to a quarter of your Scaling Stat. For example, having 5 Pierce value against a Limit 10 object means you would treat it as having only 5 Limit for your attacks. **Pierce+** increases this value to half of your Scaling Stat.  \n**Farstrike:** This Weapon’s melee attack range is instead equal to double your normal melee range. **Farstrike+** increases this to quadruple your normal melee range.  \n**Solitary:** Once per attack, when you make an attack with a one handed Solitary weapon, you may immediately attack again with disadvantage using no AP/RP. This cannot be done at the same time as an attack with a Fast Weapon, and cannot be done while holding another weapon. The extra attack has no disadvantage with **Solitary+** weapons.  \n**Bash:** When you attempt to attack through an object, if that object's Limit is less than or equal to a quarter of your Scaling Stat, this Weapon ignores the Limit of that object and instead applies extra damage to the attack equal to the Limit of that object. Applies once per attack and has no effect when targeting something directly. Bash+ works on Limit up to half of your Scaling Stat.  \n*Note: Bash is not normally present on any Weapons, and is instead activated through skills on certain Weapons, like Balanced and Weighted.*  \n**Throwing:** Items can either be considered “good”, “average”, or “bad” when it comes to being thrown. Thrown attacks can use skills that are usable by that Weapon type.  \n**Bad:** Has a 50ft range and disadvantage on the attack roll.  \n**Average:** Has a 100ft range.  \n**Good:** Has a 200ft range and advantage on the attack roll."
     },
     {
      "id": "ranged-tags",
      "title": "Ranged Tags",
      "md": "**Reload:** Ranged Weapons by default need to be reloaded after each shot. This can be modified to be “per X shots” reload types, but those are not covered here.  \n\t**Slow:** Reloading a slow ranged Weapon takes 3 RP.  \n\t**Average:** Reloading an average ranged Weapon takes 2 RP.  \n\t**Fast:** Reloading a fast ranged Weapon takes 1 RP.  \n**Range:** This shows the effective range the Weapon can fire within. All ranged Weapons have no direct penalty from firing at melee range, however they are counted as making an attack in melee if this is the case, and the opponent can react accordingly. If you wish to fire at a range higher than listed, you can attempt to fire at double the range with a penalty of a disadvantage on the attack roll, and up to 4x range with a penalty of double disadvantage on the attack roll and a 6 AP attack cost (regardless of weight).  \n**Area:** Attacks made with this Weapon can instead be treated as Area attacks. The Area is all targets within 5ft of the targeted position, with the position’s distance being at most half of your Weapon’s range away. If you choose to make the Area attack, your damage rolls for it are Weakened. **Area+** extends the area to be all targets within 10ft of the targeted position, and the position’s range to be equal to the Weapon’s range.  \n**Pepper:** Attacks made with this Weapon can fire an additional shot at the same target. A new attack roll is not used for this shot, instead you roll your attack roll with a disadvantage, and on hit both shots hit. As a result, any effects that activate when you attack only trigger once with a pepper attack, but on hit effects trigger twice. **Pepper+** allows for up to 2 bonus shots per attack, each one adding a disadvantage to the attack roll.\n\n| Melee Weapon Types |  |  |  |  |\n| :---: | :---: | :---: | :---: | :---: |\n| **Name** | **Weight** | **Damage** | **Tags** | **Throw Type** |\n| Unarmed | Light | 1d10 | Fast, Pierce | N/A |\n|  | Heavy | 1d12 | Knockback, Solitary, Cleave | N/A |\n| Bladed | Light | 1d8 | Fast | Average |\n|  | Heavy | 1d12 | Broad, Cleave, Solitary+ | Bad |\n| Balanced | Light | 1d8 | Broad, Solitary | Average |\n|  | Heavy | 1d12 | Broad, Farstrike, Solitary | Average |\n| Swift | Light | 1d4 | Fast+, Pierce | Good |\n|  | Heavy | 1d12 | Fast, Pierce+ | Good |\n| Striker | Light | 1d8 | Cleave | Good |\n|  | Heavy | 1d12 | Cleave+ | Good |\n| Defender | Light | 1d6 | Broad | Good |\n|  | Heavy | 1d10 | Broad+, Cleave | Average |\n| Weighted | Light | 1d8 | Knockback | Average |\n|  | Heavy | 1d12 | Knockback+ | Average |\n| Reach | Light | 1d6 | Pierce, Solitary | Good |\n|  | Heavy | 1d10 | Pierce+, Farstrike | Good |\n| Circular | Light | 1d6 | Fast, Pierce | Good |\n|  | Heavy | 1d12 | Fast, Cleave | Good |\n| Curved | Light | 1d6 | Cleave, Solitary+ | Average |\n|  | Heavy | 1d12 | Cleave, Farstrike, Solitary | Average |\n| Thrasher | Light | 1d8 | Farstrike, Knockback | Bad |\n|  | Heavy | 1d10 | Farstrike+, Knockback | Average |\n\n| Ranged Weapon Types |  |  |  |  |  |\n| :---: | :---: | :---: | :---: | :---: | :---: |\n| **Name** | **Weight** | **Damage** | **Tags** | **Reload** | **Range** |\n| Rapid | Light | 1d6 | Fast, Pepper | Fast | 75ft |\n|  | Heavy | 1d12 | Pepper+ | Average | 150ft |\n| Assault | Light | 1d8 | Solitary | Fast | 100ft |\n|  | Heavy | 1d12 | Pierce, Solitary | Average | 200ft |\n| Blast | Light | 1d8 | Area, Pierce, Cleave | Average | 25ft |\n|  | Heavy | 1d12 | Area+, Cleave | Average | 50ft |\n| Longshot | Light | 1d8 | Cleave, Pierce | Average | 150ft |\n|  | Heavy | 1d14 | Cleave, Pierce | Slow | 300ft |"
     },
     {
      "id": "weapon-material-info",
      "title": "Weapon Material Info",
      "md": "**Rarity:** The rarity denoted in each table only affects the scarcity and cost of those items, usually being the following:   \nCommon \\- 1x cost and scarcity of 1 (meaning this is found in 100% of normal stores)  \nUncommon \\- 2x cost and scarcity of 0.25   \nRare \\- 4x cost and scarcity of 0.1  \nVery Rare \\- 8x cost and scarcity of 0.05  \n**Material Scaling:** Material Stats do not scale with your Scaling Stat, instead they scale with the grade of the Weapon. For example, a grade 3 Weapon would multiply its Durability and Limit by 3\\.  \n**Durability:** The overall “health” of the Weapon. Reaching 0 or lower means the Weapon is broken and can no longer be used, but it is still fixable. Negative durability equal to or exceeding the normal max means the Weapon is completely destroyed.  \n**Limit:** How much damage the Weapon can take from each attack it blocks or attacks that are hitting through it. This is ignored if the Weapon is the target of the attack. Only blocks Physical and Elemental damage normally.\n\n| Common Weapon Materials |  |  |  |  |\n| :---: | :---: | :---: | :---: | :---: |\n| **Name** | **Weight** | **Durability** | **Limit** | **Bonus Effect** |\n| Hardwood | Light | 30 | 6 | N/A |\n| Softwood | Light | 20 | 4 | Requires half as much work/resources to make and repair. |\n| Bone | Light | 10 | 2 | Damage dealt is Strengthened, but requires twice as much work/resources to make and repair. |\n| Iron | Heavy | 60 | 12 | N/A |\n| Copper | Heavy | 40 | 8 | Requires half as much work/resources to make and repair. |\n| Stone | Heavy | 20 | 4 | Damage dealt is Strengthened, but requires twice as much work/resources to make and repair. |\n\n| Uncommon Weapon Materials |  |  |  |  |\n| :---: | :---: | :---: | :---: | :---: |\n| **Name** | **Weight** | **Durability** | **Limit** | **Bonus Effect** |\n| Steel | Light | 45 | 9 | The Limit is a third as effective against non-physical damage. |\n|  | Heavy | 90 | 18 |  |\n| Bronze | Light | 45 | 9 | The Limit is a third as effective against non-elemental damage. |\n|  | Heavy | 90 | 18 |  |\n| Glass | Light | 5 | 1 | Damage dealt is doubly Strengthened, but requires four times as much work/resources to make and repair. |\n| Silver Coating | Light | 60 | 12 | Damage dealt is Strengthened against supernatural targets, but the Limit is a tenth as effective against non-supernatural damage. |\n| Amberite | Light | 60 | 12 | Deals arcane damage to magic, but the Limit is a tenth as effective against non-magical damage. |\n| Obsidian | Heavy | 10 | 2 | Damage dealt is doubly Strengthened, but requires four times as much work/resources to make and repair. |\n| Cold Iron | Heavy | 120 | 24 | Damage dealt is Strengthened against supernatural targets, but the Limit is a tenth as effective against non-supernatural damage. |\n| Quartz | Heavy | 120 | 24 | Deals arcane damage to magic, but the Limit is a tenth as effective against non-magical damage. |\n\n| Rare Weapon Materials |  |  |  |  |\n| :---: | :---: | :---: | :---: | :---: |\n| **Name** | **Weight** | **Durability** | **Limit** | **Bonus Effect** |\n| Gray Iron | Light | 45 | 9 | Damage from this Weapon is Weakened and cannot be considered “Good” for throwing (becoming Average instead). |\n|  | Heavy | 90 | 18 |  |\n| Scarletite | Light | 60 | 12 | Deals heat damage, but the Limit is a tenth as effective against non-heat damage. |\n|  | Heavy | 120 | 24 |  |\n| Frigidium | Light | 60 | 12 | Deals cold damage, but the Limit is a tenth as effective against non-cold damage. |\n|  | Heavy | 120 | 24 |  |\n| Positron | Light | 60 | 12 | Deals radiation damage, but the Limit is a tenth as effective against non-radiation damage. |\n|  | Heavy | 120 | 24 |  |\n| Wyrm Metal | Light | 60 | 12 | Deals acid damage, but the Limit is a tenth as effective against non-acid damage. |\n|  | Heavy | 120 | 24 |  |\n\n| Very Rare Weapon Materials |  |  |  |  |\n| :---: | :---: | :---: | :---: | :---: |\n| **Name** | **Weight** | **Durability** | **Limit** | **Bonus Effect** |\n| Gray Steel | Light | 60 | 12 | Damage from this Weapon is doubly Weakened and counts as “Bad” for throwing regardless of type. |\n|  | Heavy | 120 | 24 |  |\n| Orichalcum | Light | 20 | 4 | Damage dealt by this Weapon is Strengthened, doubling up on a crit. |\n|  | Heavy | 40 | 8 |  |\n| Mithrite | Light | 20 | 4 | Damage that would be dealt to this Weapon is Weakened. |\n| Adamantine | Heavy | 40 | 8 | Damage that would be dealt to this Weapon is Weakened. |"
     }
    ]
   },
   {
    "id": "martial-armor",
    "title": "Martial Armor",
    "intro": "",
    "sections": [
     {
      "id": "armor-info",
      "title": "Armor Info",
      "md": "**Armor Design:** Pick an Armor weight from the list, then a material matching its weight. Armors with multiple materials (but not weights) can exist, but they cost more and are harder to make. You can only wear one Armor at a time.  \n**Weight:** The weights of Armor have varying effects, as denoted below. Armor weight is set in stone when the material is decided, and cannot be changed without modifying the Armor. If a material has multiple weights listed, which one it is is decided when the Armor is created, and can only be changed by modifying the Armor.  \n**Light:** While wearing this armor, your movement speed is 20% lower. Takes a single turn to remove or put on.  \n**Medium:** While wearing this armor, your movement speed is 40% lower, and you roll stealth rolls with a disadvantage. Takes a minute to remove or put on.  \n**Heavy:** While wearing this armor, your movement speed is 60% lower, and you roll stealth rolls with two disadvantages. Takes 10 minutes to remove or put on.  \n**Titanic:** While wearing this armor, your movement speed is 80% lower, and you automatically fail stealth rolls. Takes 1 hour to remove or put on.  \n**Scaling and Grade:** The Limit, Durability, and other features of armor increase for every 10 points you have in its Scaling Stat, which is Constitution. The grade of an armor determines the amount a Stat can affect that armor's scaling, where every 1 grade represents a max of 10 Stat scaling. So, a grade 3 Armor allows for up to 30 Constitution to affect its stats, any higher would do nothing until the Grade would be increased.  \n**Rarity:** The rarity denoted in each table only affects the scarcity and cost of those items, usually being the following:   \nCommon \\- 1x cost and scarcity of 1 (meaning this is found in 100% of normal stores)  \nUncommon \\- 2x cost and scarcity of 0.25   \nRare \\- 4x cost and scarcity of 0.1  \nVery Rare \\- 8x cost and scarcity of 0.05  \n**Durability:** The overall “health” of the Armor. Reaching 0 or lower means the Armor is broken and can no longer be used, but it is still fixable. Negative durability equal to or exceeding the normal max means the Armor is completely destroyed.  \n**Limit:** How much damage the Armor can take from each attack it blocks or attacks that are hitting through it. This is ignored if the Armor is the target of the attack. Only blocks Physical and Elemental damage normally.\n\n| Common Armor Materials |  |  |  |  |\n| :---: | :---: | :---: | :---: | :---: |\n| **Name** | **Weight** | **Durability** | **Limit** | **Bonus Effect** |\n| Cloth | Light | 15 | 3 | Requires half as much work/resources to make and repair. |\n| Soft Leather | Light | 20 | 4 | N/A |\n|  | Medium | 40 | 8 |  |\n| Hide | Medium | 30 | 6 | Requires half as much work/resources to make and repair. |\n| Titanium | Heavy | 60 | 12 | Requires half as much work/resources to make and repair. |\n| Iron | Heavy | 80 | 16 | N/A |\n|  | Titanic | 160 | 32 |  |\n| Copper | Titanic | 120 | 24 | Requires half as much work/resources to make and repair. |\n\n| Uncommon Armor Materials |  |  |  |  |\n| :---: | :---: | :---: | :---: | :---: |\n| **Name** | **Weight** | **Durability** | **Limit** | **Bonus Effect** |\n| Chitin | Light | 30 | 6 | The Limit is a third as effective against non-physical damage. |\n|  | Medium | 60 | 12 |  |\n| Hard Leather | Light | 30 | 6 | The Limit is a third as effective against non-elemental damage. |\n|  | Medium | 60 | 12 |  |\n| Silver | Light | 40 | 8 | The Limit is a tenth as effective against non-supernatural damage. |\n|  | Medium | 80 | 16 |  |\n| Amberite | Light | 40 | 8 | The Limit is a tenth as effective against non-magical damage. |\n|  | Medium | 80 | 16 |  |\n| Steel | Heavy | 120 | 24 | The Limit is a third as effective against non-physical damage. |\n|  | Titanic | 240 | 48 |  |\n| Bronze | Heavy | 120 | 24 | The Limit is a third as effective against non-elemental damage. |\n|  | Titanic | 240 | 48 |  |\n| Cold Iron | Heavy | 160 | 32 | The Limit is a tenth as effective against non-supernatural damage. |\n|  | Titanic | 320 | 64 |  |\n| Quartz | Heavy | 160 | 32 | The Limit is a tenth as effective against non-magical damage. |\n|  | Titanic | 320 | 64 |  |\n\n| Rare Armor Materials |  |  |  |  |\n| :---: | :---: | :---: | :---: | :---: |\n| **Name** | **Weight** | **Durability** | **Limit** | **Bonus Effect** |\n| Gray Iron | Medium | 60 | 12 | Has the penalties of Armor one weight heavier than it. If Titanic, your speed is instead 0% (5ft minimum). |\n|  | Heavy | 120 | 24 |  |\n|  | Titanic | 240 | 48 |  |\n| Scarletite | Light | 40 | 8 | The Limit is a tenth as effective against non-heat damage. |\n|  | Medium | 80 | 16 |  |\n|  | Heavy | 160 | 32 |  |\n|  | Titanic | 320 | 64 |  |\n| Frigidium | Light | 40 | 8 | The Limit is a tenth as effective against non-cold damage. |\n|  | Medium | 80 | 16 |  |\n|  | Heavy | 160 | 32 |  |\n|  | Titanic | 320 | 64 |  |\n| Positron | Light | 40 | 8 | The Limit is a tenth as effective against non-radiation damage. |\n|  | Medium | 80 | 16 |  |\n|  | Heavy | 160 | 32 |  |\n|  | Titanic | 320 | 64 |  |\n| Wyrm Metal | Light | 40 | 8 | The Limit is a tenth as effective against non-acid damage. |\n|  | Medium | 80 | 16 |  |\n|  | Heavy | 160 | 32 |  |\n|  | Titanic | 320 | 64 |  |\n\n| Very Rare Armor Materials |  |  |  |  |\n| :---: | :---: | :---: | :---: | :---: |\n| **Name** | **Weight** | **Durability** | **Limit** | **Bonus Effect** |\n| Gray Steel | Medium | 80 | 16 | Has the penalties of Armor two weights heavier than it. If Heavy, your speed is instead 0% (5ft minimum). If Titanic, your speed is both 0% (5ft minimum) and takes \\+1 AP to move. |\n|  | Heavy | 160 | 32 |  |\n|  | Titanic | 320 | 64 |  |\n| Orichalcum | Medium | 30 | 6 | Damage that would be dealt to this Armor is Weakened. |\n|  | Heavy | 60 | 12 |  |\n| Mithrite | Light | 15 | 3 | Damage that would be dealt to this Armor is Weakened. |\n| Adamantine | Titanic | 120 | 24 | Damage that would be dealt to this Armor is Weakened. |"
     }
    ]
   },
   {
    "id": "mental-icons",
    "title": "Mental Icons",
    "intro": "",
    "sections": [
     {
      "id": "icon-info",
      "title": "Icon Info",
      "md": "**Icon Forms:** Unlike other Archetypal Equipment, a Mental user’s equipment is the Icon, an object of devotion or ideological belief that takes on a specific named Form. Forms are divided into Dream and Nightmare Forms (known as the Poles), and require Attunement to use, taking 6 AP. Only one Form can be Attuned to at a time, but once Attuned a Form does not need to be actively held, so long as it is on your body somewhere (even in a bag or hidden under clothing) it can be utilized to assist in Manifesting/Warding. The Pole of a Form only dictates what Tenets it is allowed to have, it does not restrict what you can manifest.   \n**Scaling and Grade:** The Ward effect listed in each Form increases for every 10 points you have in its Scaling Stat, which is Willpower by default. In addition, the Tenet effect also scales for every 10 points you have in its Wonder’s respective Scaling Stat, be that Ponderance for Dreams or Snappence for Nightmares. These both are limited by the Grade of the Form, which denotes how much Stat can actually affect the Ward and Tenet effects, where every 1 grade represents a max of 10 Stat scaling for each. So, a grade 3 Form allows for up to 30 Willpower, Ponderance, and Snappence to affect its stats, any higher would do nothing until the Grade would be increased.  \n**Tenet:** Each Wonder has a specific Tenet effect that is only active if you select it as your desired Tenet when you Attune your Form. Your Form’s Alignment must be the same as the Wonder the Tenet is from. Only one Tenet can be active on a Form at a time, and once unattuned the Tenet dissipates. In addition, you can change the active Tenet by simply spending the Attune cost (by default 6 AP) again.  \n**Ward:** The Ward effect is typically an active ability that Forms have so long as you are Attuned to them. By default Wards can only be self-targeting, requiring a self attack as per the rules. Once you have T1 of Mental Theory unlocked, Wards can be Enhanced when they are activated so long as you spend energy equal to your Willpower Min. Unattuning from a Form removes any active Ward effects it has.  \n**Rarity:** The rarity denoted in each table only affects the scarcity and cost of those items, usually being the following:   \nCommon \\- 1x cost and scarcity of 1 (meaning this is found in 100% of normal stores)  \nUncommon \\- 2x cost and scarcity of 0.25   \nRare \\- 4x cost and scarcity of 0.1  \nVery Rare \\- 8x cost and scarcity of 0.05  \n**Durability and Limit:** Since Forms are intended to be small objects with not much Stats that are often concealed, their Durability and Limit are generally unimportant. All Forms can be treated as having 20 Durability and 4 Limit per Grade (this can be altered by the GM if it makes sense to do so).\n\n| Dream Forms |  |  |  |\n| :---: | :---: | :---: | :---: |\n| **Name** | **Rarity** | **Ward Effect** | **Ward Enhance Effect** |\n| Aegis | Common | For 1 AP, provides **8 shielding**, lasting until the start of your next turn. This effect stacks. | Instead provides **15 shielding**. |\n| Sanctum | Common | For 1 AP, provides **8 shielding**, lasting until the start of your next turn. This effect stacks.  | The shield provided lasts an additional turn. |\n| Prism | Uncommon | For 1 AP, provides **25 shielding** against specifically Physical, Elemental, or Magical damage, lasting until the start of your next turn. This effect stacks. | The shield protects against two chosen damage types. |\n| Vigil | Uncommon | Provides a passive **40 shielding** that does not decay or naturally regenerate. Instead, on your turn you can spend 1 AP to recover **8 shielding** for this effect (still requires a hit). Project/Expansion causes this persistent shield to apply to the target(s) instead. | The recovery attack automatically succeeds. |\n| Anchor | Rare | For 1 AP, provides **8 shielding**, lasting until the start of your next turn. This effect stacks. If you have not moved since the start of your turn, damage dealt to this shielding is Weakened (the Weakened does not stack with multiple instances of this shield). | The Weakened persists beyond the shield, now applying to all damage you would take until the start of your next turn, so long as you do not move. |\n| Reverie | Rare | Can only be activated while you are at 2+ Dream Alignment. For 1 AP, provides **12 shielding**, lasting until the start of your next turn. This effect stacks up to **40 shielding**, and holds between turns so long as you remain at 2+ Dream Alignment.  | If you are at 4+ Dream Alignment, whenever you Manifest a Dream successfully, add **4 shielding** to this effect, up to the cap. This effect stacks, so multiple instances increase the shielding provided per Manifest. |\n| Premonition | Very Rare | For 1 AP, store one charge of Premonition until the start of your next turn. Whenever you would take damage, you can consume up to one charge of Premonition to negate **40 of that damage**. | When you store the charge, declare an attack source. If, on activation, the declared source is the one causing the damage, it gets a stack of Weakened. |\n\n| Nightmare Forms |  |  |  |\n| :---: | :---: | :---: | :---: |\n| **Name** | **Rarity** | **Ward Effect** | **Ward Enhance Effect** |\n| Veil | Common | When you would take damage, spend 1 RP to negate up to **4 of that damage**. Can be used multiple times per damage instance. | Instead provides **8 negation**. |\n| Warden | Common | When you would take damage, spend 1 RP to negate up to **5 of that damage**. Can be used multiple times per damage instance. | After negation occurs and damage resolves, if the source of the damage is within 100ft, make a Ranged attack roll against them. On hit, the damage negated is dealt to them. Only one attack needs to be made per damage instance, regardless of times this Ward was used. |\n| Bane | Uncommon | When you attune to this Form, select Physical, Elemental, or Magical damage. When you would take damage, spend 1 RP to negate up to **6 of that damage** if it matches the chosen damage type, or **3 of that damage** otherwise. Can be used multiple times per damage instance. | If the incoming damage matches the type of damage this Form is set against, give that incoming damage a stack of Weakened on hit (once per damage instance). |\n| Grudge | Uncommon | When you would take damage, spend 1 RP to negate up to **4 of that damage**. Increases by **4 negation** per instance of this Ward used in the same damage instance. Can be used multiple times per damage instance. | Treat this effect as if it already triggered one additional time for the purposes of increasing the negation amount. |\n| Riposte | Rare | When you would take damage, spend 1 RP to negate up to **10 of that damage** if the attack’s source is within your melee range, or **4 of that damage** otherwise. Can be used multiple times per damage instance. | After negation occurs and damage resolves, if the source of the damage is within melee range, make a Melee attack roll against them with advantage. On hit, the damage negated is dealt to them. Only one attack needs to be made per damage instance, regardless of times this Ward was used. |\n| Zealot | Rare | When you would take damage, spend 1 RP to negate up to **6 of that damage** so long as you are at 2+ Nightmare Alignment, providing **4 negation** otherwise. Can be used multiple times per damage instance. | If you are at 4+ Nightmare Alignment, the incoming damage is Weakened on crit (only applies once per damage instance). |\n| Echo | Very Rare | When you would take damage, spend 1 RP to negate up to **3 of that damage**. Can be used multiple times per damage instance. If this fully negates the attack, this effect is now applied for free to all instances of damage you would take until the start of your next turn. This effect stacks. | Instead provides **6 negation**. |"
     }
    ]
   },
   {
    "id": "magic-foci",
    "title": "Magic Foci",
    "intro": "",
    "sections": [
     {
      "id": "foci-info",
      "title": "Foci Info",
      "md": "**Foci Design:** Pick a Foci type from among the casting form lists, and pick Affixes if your Foci type can utilize them. Foci cannot have multiple types, are predefined, and only specific Foci have the Multi casting form. To use a Foci, you need to Attune to it by spending one hour magically connecting to it (you can only Attune to one Foci at a time). Once Attuned, you know its location no matter where it is, and while held it can be used to cast your magic. Affix effects and passives for Foci only function if they are Attuned, and they only apply to spells cast through that Foci.  \n**Casting Form:** Magic Foci have three different casting forms which dictate passive effects, affix count, how long they take to cast, Scaling Stat, and Threshold Reduction (see Magic for more info). \n\n1. Igniters are Foci entirely built around having enough power to cast your known spells for you. Mechanically, this means they utilize Grasp as their Scaling Stat and take **2 AP** to cast with, but have 1 Threshold Reduction.   \n2. Channelers are Foci that instead have no power themselves, but take your spell concepts and idealize them into reality, so long as they are fed the power to do so. Mechanically, this means they utilize Reach as their Scaling Stat and take **3 AP** to cast with, but have 2 Threshold Reduction.  \n3. Foci denoted as Multi Type use Raw Casting AP and TR (1 AP/TR, 2 AP/TR, 3 AP/TR), but use the lesser of your two Scaling Stats.\n\n**Scaling and Grade:** The Power of spells outputted by your Foci increases for every 10 points you have in its Scaling Stat, which is Reach or Grasp depending on the Casting Form of your Foci. This is limited by the Grade of the Foci, which denotes how much Stat can actually affect the Power of the Foci, where every 1 grade represents a max of 10 Stat scaling. So, a grade 3 Foci allows for up to 30 Reach/Grasp to affect its Power output, any higher would do nothing until the Grade would be increased. Grade also directly impacts the durability and limit of the Foci, independent of your Scaling Stat.  \n**Affixes:** Affixes are your weight equivalent for armor, also requiring attunement to either their Offensive or Defensive form (do not need to be held to be attuned or used, just need to be on your person). For every Affix attuned your speed is lowered by 20% (not counting free ones). This is shared with Shroud’s Affixes.  \n**One vs Two Hands:** How many hands hold a Foci or are used to cast a spell has no effect on how the spells perform outside of specific Foci Types. Foci do still count as a held item, however, and cannot be used in the same hand as another held item unless it is fused into a Weapon (see Fused Foci).  \n**Fused Foci:** With a 1 hour Ritual, your Attuned Foci can be fused into a Weapon. While fused, the Weapon also counts as that Foci, so the same hand holds both. The Foci’s Durability and Limit are added to the Weapon’s (each keeps its own Grade), Affixes that change how the Foci takes damage now affect the Weapon too, and the Weapon can’t be disarmed or dropped while the Foci stays Attuned. Unattuning the Foci separates them.  \n**Durability:** The overall “health” of the Foci. Reaching 0 or lower means the Foci is broken and can no longer be used, but it is still fixable. Negative durability equal to or exceeding the normal max means the Foci is completely destroyed.  \n**Limit:** How much damage the Foci can take from each attack it blocks or attacks that are hitting through it. This is ignored if the Foci is the target of the attack. Only blocks Physical and Elemental damage normally.\n\n| Igniter Foci Types |  |  |  |  |  |\n| :---: | :---: | :---: | :---: | :---: | ----- |\n| **Name** | **Durability** | **Limit** | **Free Affixes** | **Other Effects** |  |\n| Rod | 20 | 4 | 2 | N/A |  |\n| Shard | 40 | 8 | 0 | While attuned, select one Offensive Affix, its effects are doubled (this can be changed by attuning again). |  |\n| Wand | 30 | 6 | 0 | Every other spell cast with this Foci grants it 1 additional TR until the start of your next turn. Has 0 TR baseline. |  |\n| Staff | 30 | 6 | 0 | Requires two hands to cast with. Your next spell cast with this Foci using AP/RP casts twice, as long as your last one cast since the start of your turn was a different Core Spell. |  |\n| Scepter | 60 | 12 | 0 | Spells cast with this Foci have 1 additional TR when targeting an ally. |  |\n| Chime | 10 | 2 | \\-1 (Acts as if one affix is already attuned for speed) | Cannot cast spells normally. Create a “deck” of spells using all of your Core spells (3 each). At the start of your turn, shuffle your hand and discard pile into your deck, then draw 7 cards (reshuffle when empty). You can do the following (casting follows normal AP/RP rules):\u000b1\\. Spend 1/10th of your max Energy to draw a card. 2\\. Spend 2/10th of your max Energy to mulligan your entire hand (discard your whole hand to draw that many cards). 3\\. Cast a card as a Core spell with 2 TR base (it discards after). 4\\. Combine two cards together for a Combo spell with 4 TR base (they discard after).\u000b\u000b*Visually, you can see this as playing notes to create a melody.* |  |\n\n| Channeler Foci Types |  |  |  |  |  |\n| :---: | :---: | :---: | :---: | :---: | ----- |\n| **Name** | **Durability** | **Limit** | **Free Affixes** | **Other Effects** |  |\n| Scroll | 20 | 4 | 2 | N/A |  |\n| Orb | 40 | 8 | 0 | While attuned, select one Offensive Affix, its effects are doubled (this can be changed by attuning again). |  |\n| Lens | 30 | 6 | 0 | Every spell cast with this Foci removes 1 TR from it until the start of your next turn. Has 4 TR baseline. |  |\n| Tome | 30 | 6 | 0 | Requires two hands to cast with. Your next spell cast with this Foci using AP/RP casts twice, as long as your last one cast since the start of your turn was the same Core Spell. |  |\n| Tablet | 60 | 12 | 0 | Spells cast with this Foci have 2 additional TR when targeting an ally. |  |\n| Cards | 10 | 2 | \\-1 (Acts as if one affix is already attuned for speed) | Cannot cast spells normally. Create a “deck” of spells using all of your Core spells (3 each). At the start of your turn, shuffle your hand and discard pile into your deck, then draw 5 cards (reshuffle when empty). You can do the following (casting follows normal AP/RP rules):\u000b1\\. Spend 1/10th of your max Energy to draw a card. 2\\. Spend 2/10th of your max Energy to mulligan your entire hand (discard your whole hand to draw that many cards). 3\\. Cast a card as a Core spell with 3 TR base (it discards after). 4\\. Combine two cards together for a Combo spell with 6 TR base (they discard after). |  |\n\n| Multi Foci Types |  |  |  |  |  |\n| :---: | :---: | :---: | :---: | :---: | ----- |\n| **Name** | **Durability** | **Limit** | **Free Affixes** | **Other Effects** |  |\n| Glove | 40 | 8 | 2 | N/A |  |\n| Band | 60 | 12 | 0 | While attuned, select one Offensive Affix, its effects are doubled (this can be changed by attuning again). |  |\n| Ring | 30 | 6 | 0 | Select one Core spell to be the chosen spell of this Foci (can be changed on rest). That Core spell and its Combos have 1 additional TR when cast with this Foci. |  |\n| Gauntlet | 10 | 2 | 0 | Whenever you cast a spell with this Foci using AP/RP, duplicate it. The first spell in this chain uses your higher Scaling Stat, and the second uses your lower Scaling Stat (between Reach and Grasp). |  |"
     }
    ]
   },
   {
    "id": "magic-shrouds",
    "title": "Magic Shrouds",
    "intro": "",
    "sections": [
     {
      "id": "shroud-info",
      "title": "Shroud Info",
      "md": "**Shroud Design:** Pick a Shroud type from the list, and pick Affixes if your Shroud type can utilize them. To use a Shroud, you need to Attune to it by spending one hour magically connecting to it (you can only Attune to one Shroud at a time). Once Attuned it becomes melded into your Spirit, meaning its Stats and Affixes are now active on your person, allowing it to protect you as Martial Armor would. Shrouds are considered Magical objects, both while melded and while not melded.  \n**Scaling and Grade:** The Stats of your Shroud increases for every 10 points you have in its Scaling Stat, which is Build by default. This is limited by the Grade of the Shroud, which denotes how much Stat can actually affect the Stats of the Shroud, where every 1 grade represents a max of 10 Stat scaling. So, a grade 3 Shroud allows for up to 30 Build to affect its Stats, any higher would do nothing until the Grade is increased.  \n**Affixes:** Affixes are your weight equivalent for armor, also requiring attunement to either their Offensive or Defensive form. For every Affix attuned your speed is lowered by 20% (not counting free ones). This is shared with Foci’s Affixes.  \n**Shroud Recovery:** Attuned Shrouds naturally recover their spent durability, by default recovering durability equal to its Limit at the start of each of your turns. This can vary, and would be stated in a Shroud’s passive if it is anything else.  \n**Durability:** The overall “health” of the Shroud. Reaching 0 or lower means the Shroud is unable to block any more damage, but it can still recover. Shrouds cannot be destroyed unless they are unmelded, or they are directly targeted by arcane damage or similar effects, with durability in the negatives exceeding its normal max resulting in its destruction.  \n**Limit:** How much damage the Shroud can take from each attack it blocks or attacks that are hitting through it. This is ignored if the Shroud is the target of the attack. Only blocks Physical, Elemental, and Magical damage normally.\n\n| Shroud Types |  |  |  |  |  |\n| :---: | :---: | :---: | :---: | :---: | ----- |\n| **Name** | **Durability** | **Limit** | **Free Affixes** | **Other Effects** |  |\n| Bastion | 50 | 10 | 1 | N/A |  |\n| Keystone | 60 | 12 | 0 | While attuned, select one Defensive Affix, its effects are doubled (this can be changed by attuning again). |  |\n| Cinder | 80 | 5 / 15 | 0 | The Limit of this Shroud is three times as high against damage types you have already taken since the start of your turn. |  |\n| Cistern | 60 | 5 / 10 / 15 | 0 | The Limit of this Shroud is three times as high while you are at full Energy, two times as high if you are instead above half Energy, and normal if you are at or below half Energy. Recovery scales with this varying limit. |  |\n| Ember | 60 | 5 / 10 / 15 | 0 | The Limit of this Shroud is three times as high while you are at or below half of your max HP, two times as high if you are instead above half of your max HP, and normal if you are at full HP. Recovery scales with this varying limit. |  |\n| Bulwark | 3 | 12 | \\-1 (Acts as if one affix is already attuned for speed) | The Durability of this Shroud does not scale, and fully restores at the start of your turn. Does not block damage as normal, instead any damage up to but not exceeding the Limit removes 1 durability instead and gets fully negated. |  |\n| Lattice | 6 | 6 | \\-1 (Acts as if one affix is already attuned for speed) | The Durability of this Shroud does not scale, and fully restores at the start of your turn. Does not block damage as normal, instead any damage up to but not exceeding the Limit removes 1 durability instead and gets fully negated. |  |\n| Mantle | 30 | 8 | 0 | Instead of blocking damage as normal, this Shroud must be activated with 2 RP to be placed on a target within 100ft (no attack roll, only one application at a time, can target yourself). Durability restores to full on usage, effect lasts until the start of your next turn or until reactivated. |  |\n| Bond | 80 | 8 | 0 | This Shroud applies to both you and a single other target within 100ft you may declare for 3 RP at any time. Doing so refreshes the durability of this Shroud. This effect goes away if the target goes more than 1000ft away from you, or the Shroud’s durability reaches 0\\. |  |\n| Carapace | 50 | 5+ | 0 | Every time this Shroud takes damage, its Limit increases by what it is at a baseline post scaling. Resets at the start of your turn (before recovery).  |  |\n| Rebuke | 40 | 8 | 0 | When this Shroud takes damage from a source within 100ft, you can spend 1 RP to make a ranged attack roll against that target, dealing the damage that the Shroud took back at them on hit. |  |\n| Retort | 40 | 8 | 0 | While you are melded with this Shroud, if you would take damage from an attack that this Shroud can block, you may spend 1 RP to give that attack’s damage a stack of Weakened. |  |"
     }
    ]
   },
   {
    "id": "magic-affixes",
    "title": "Magic Affixes",
    "intro": "**Affixes:** Affixes are different types of Gems (and other crystalline materials) Attuned separately from Foci/Shrouds (taking the same amount of time). While Attuned, the Affix imparts its effects onto you/your Foci/your Shroud. Every Affix Attuned lowers your speed by 20%. Free Affix slots granted by Foci/Shrouds must be Offensive/Defensive respectively, and do not lower your speed.  \n**Raw Casting:** Your Attuned Affixes also function with Raw Casting.  \n**Rarity:** The rarity denoted in each table only affects the scarcity and cost of those items, usually being the following (note that Affixes are much more expensive and rarer than that of other items due to their innate rarity):   \nCommon \\- 5x cost and scarcity of 0.20 (meaning this is found in 20% of normal stores)  \nUncommon \\- 10x cost and scarcity of 0.05   \nRare \\- 20x cost and scarcity of 0.01  \nVery Rare \\- 40x cost and scarcity of 0.0025  \n**Durability and Limit:** Since Affixes are intended to be held in a bag or hidden on a person, their Durability and Limit are generally unimportant. All Affixes can be treated as having 20 Durability and 4 Limit per Grade (this can be altered by the GM if it makes sense to do so).\n\n| Affixes |  |  |  |  |  |\n| :---: | :---: | :---: | ----- | :---: | ----- |\n| **Name** | **Rarity** | **Offensive Effect** |  | **Defensive Effect** |  |\n| Quartz | Common | The range of your Ranged spells is increased by 50%. |  | If a target within your personal melee range would be damaged, you can extend your Shroud to protect them for that instance. |  |\n| Agate | Common | The area of your Area spells is increased by 50%. |  | Negates an amount of damage equal to your Scaling Stat from the first instance of Magical damage you would take. Refreshes when your Shroud Recovers. |  |\n| Jasper | Common | Physical Damage dealt by your spells is Strengthened, and all other damage types are Weakened. |  | Negates an amount of damage equal to your Scaling Stat from the first instance of Physical damage you would take. Refreshes when your Shroud Recovers. |  |\n| Obsidian | Common | Your Ranged spells are silent (if doubled, your Area spells are silent as well). |  | Negates an amount of damage equal to your Scaling Stat from the first instance of Elemental damage you would take. Refreshes when your Shroud Recovers. |  |\n| Hematite | Common | When you cast a spell, you can double its Power by spending Health equal to the Power of that spell. |  | At any time, you can expend Health equal to half of your Skill Points (rounded down) to instantly refill your Shroud’s durability to max. |  |\n| Garnet | Uncommon | Spells you cast at targets with more than half their Pain Threshold in Ignite stacks have advantage on their attack rolls. |  | An amount of Ignite stacks on you equal to your Scaling Stat min are automatically put out at the start of each of your turns. |  |\n| Topaz | Uncommon | Spells you cast at targets that have at least 2 AP of movement slows have advantage on their attack rolls. |  | An amount of Slow stacks on you equal to your Scaling Stat min are automatically removed from you at the start of each of your turns. |  |\n| Moonstone | Uncommon | While in darkness or dim light, all spells you cast are silent (if doubled, they have advantage on their attack rolls too). |  | While in darkness or dim light, you are considered lightly obscured. |  |\n| Tourmaline | Uncommon | Damage dealt by your spells of the specified Elemental damage type is Strengthened, and all other damage types (non-elemental included) are Weakened. The specified element can be changed when you rest. |  | Damage taken by your Shroud of the specified Elemental damage type is Weakened. The specified element can be changed when you rest. |  |\n| Zircon | Uncommon | Damage taken by your Attuned Foci is Weakened, and attacks made that target it directly have disadvantage on their attack rolls. |  | While your Shroud is undamaged, you ignore the penalties of Rough Terrain and Slow stacks. |  |\n| Emerald | Rare | While in a Lush Biome (up to GM), the attack rolls of your spells have advantage. While in any other biome type, they have disadvantage instead. |  | While in a Lush Biome (up to GM), the Limit of your Shroud is doubled. While in any other biome type, it is halved instead. |  |\n| Ruby | Rare | Your spells that target something within your personal melee range can also impart Ignite stacks on that target equal to your Scaling Stat min if they hit. |  | If your Shroud is damaged by a source that is within your personal melee range, make a melee attack against that target for free. On hit, they get Ignite stacks equal to the damage your Shroud took. |  |\n| Black Opal | Rare | The ranges of your Targeted and Ranged spells are swapped (if doubled, choose one to have 50% increased range. Can be changed when you rest). |  | Any attacks made against you within your personal melee range have disadvantage on their attack rolls. |  |\n| Sapphire | Rare | Your spells that target something within your personal melee range also impart Slow stacks on that target equal to your Scaling Stat min if they hit. |  | If your Shroud is damaged by a source that is within your personal melee range, make a melee attack against that target for free. On hit, they get Slow stacks equal to the damage your Shroud took. |  |\n| Diamond | Rare | Whenever you successfully hit with a spell, if you cast that same spell against the same target again this turn, that spell’s attack roll has advantage. |  | If your Shroud would be damaged by a source that already damaged it this turn, that damage is Weakened. Applies to specific source types only, such as Bladed Weapons or Heat Spells. |  |\n| Alexandrite | Very Rare | When you deal damage with a spell, the next time you deal damage with a spell this turn, if the new damage type is the same as the previous one, the new damage is Strengthened. |  | When your Shroud takes damage, the next time it would be damaged, if the new damage type is the same as the previous one, the new damage is Weakened. |  |\n| Painite | Very Rare | Your spells ignore Limit (as Martial Pierce would) equal to your Scaling Stat min. |  | Your Shroud’s Limit cannot be ignored. |  |\n| Musgravite | Very Rare | Force applied by your spells is subtracted by half the target’s current health instead of half of their maximum health. |  | Negates an amount of Force equal to your Scaling Stat from each instance of Force that would affect you. |  |\n| Taaffeite | Very Rare | Rituals you cast take half as much Energy to complete. |  | Whenever a Ritual would be destroyed while you are attuned to your Shroud, you may instead set your Shroud’s Durability to 0 to keep that Ritual alive at 1 health. Your Shroud must have more than 0 Durability to proc this effect. |  |\n| Colored Diamond | Very Rare | At the start of each of your turns, declare a spell name. Any damage you would deal with that spell this turn is Strengthened, and any attack rolls for that spell have advantage. |  | At the start of each of your turns, declare a source type that can deal damage (such as Bladed Weapons or Heat Spells). For that turn, damage your Shroud would take from the named source is Weakened, and attacks from that source against you have disadvantage. |  |",
    "sections": []
   }
  ]
 }
];
