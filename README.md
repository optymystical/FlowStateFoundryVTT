# Flow State — Foundry VTT system

A Foundry VTT system for **Flow State**, Christopher Caplinger's setting-universal, digital-only TTRPG. It automates the rules from the design docs (Rules, Martial, Magic, Mental and Equipment) in chat cards, so a fight runs on buttons instead of lookups.

Built for Foundry **v14**, compatible with **v13**. Flow State © 2019 by Christopher Caplinger, CC BY 4.0.

## What's in
- **Core rules:** stats and checks, the attack → dodge → damage exchange, Strengthened/Weakened, Advantage/Disadvantage, HP and Pain Threshold, Energy, AP and RP, Ignite and Stain, movement cost and speed.
- **Martial:** every weapon, armor and method tree, Theory through Tier 5.
- **Magic:** Foci, Shrouds and Affixes, casting, all five spell groups with their Combos, Rituals, Summons and Animations.
- **Mental:** Manifesting, Alignment, Icons and Wards, Willpower and Psion Arts, and every Wonder written so far.
- **Tools:** New Character and New NPC wizards, the Action List, terrain regions, a world currency list.
- **Not in yet:** Ancestries, Cover, the senses table, equipment repair, and whatever the Mental doc hasn't written.

## Install
Put the folder `flowstate/` in `{Foundry User Data}/Data/systems/`, restart Foundry, create a world and pick **Flow State**.

## Playing
- **Combat runs in chat cards.** An attack card asks the defender to dodge or take the hit; the defense card then offers damage and follow-ups. Buttons only show for the person who can use them.
- **The Action List** (character sheet, and Token Action HUD if installed) lists everything a character can do, with costs. The **Reaction List** tab (and the HUD's) holds the switches for everything that prompts a character: any popup that asks you something in someone else's turn (a Ward, a Tenet, Infuse...) and any offer card (a Palisade, a Mark shot...) can be switched off per character; a popup then counts as "no" and a card isn't posted.
- **Movement** costs AP in combat and the tracker shows how much free movement is left. Speed comes from Size, less armor, attuned Affixes and Mental Alignment.
- **Shops:** merchant actors stocked from the catalog (or at random), with prices, markups, sell rates and change in the world's currencies.
- **The Codex:** every rule, skill tree, ability, spell, Wonder, piece of equipment, material, tag and status in one searchable, linked window (Journal sidebar, `/codex`, or the book icons on sheets and chat cards).
- **Players can't edit** stats, Skill Points, size or items on their sheets; the GM grants points (`/grant`) and gives items from the Forge (the item catalog: every weapon, armor, Foci, Shroud, Icon and Affix, plus the GM's own named items).

## For the GM
- **Open prompts** (bell button in the scene controls): every question the game is waiting on a player to answer, with a button to cancel it. Questions have no timer; the list opens by itself after 30 seconds.
- **Half Stealth / Full Stealth** statuses on the token HUD (GM only) make that token's attack rolls sneak attacks.
- **Terrain** buttons in the scene controls drop Muddy and Harden regions.
- **Token dispositions matter:** Block, Quartz, Infuse and the like are only offered across the same side (Friendly or Hostile; Neutral counts as either).
- Works on square, hex and gridless scenes.

## Settings
Per player: attacker/defender card colors. World: custom Strengthened/Weakened and Advantage/Disadvantage fields, roll damage automatically, movement cost, range and ammo enforcement, world data (export, import or clear a world's own changes to the game's data), Ignite Spread, starting budgets for characters, and optional sheet fields.

## Optional modules
**Carousel Combat Tracker** works as is. **Token Action HUD** (install Core) mirrors the Action List with no extra system module.

## More
- `CHANGELOG.md` — what changed in each version.
- `dev/AUTOMATION.md` — every automated rule and judgment call, in detail.
- `CLAUDE.md` — notes for working on the code.
