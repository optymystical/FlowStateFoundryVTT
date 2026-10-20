# Changelog

Newest first. Short notes; the rules as implemented are in `dev/AUTOMATION.md`.

**0.72.0:** **Skills tab: a tree list instead of two dropdowns.** The trees sit in a list beside the one shown: pinned trees first (pin any tree from its header), then the trees you have points in, then the ones you could start, by Archetype. A green arrow marks a tree whose next tier you can buy now, a filter box finds a tree by name, locked trees are counted, and the tab remembers the last tree you looked at.

**0.71.3:** **Codex pages, laid out for reading.** Each page says what it is (a badge: Core Spell, Mode, Ability, Weapon type, Status...). Facts sit in a stat block (tree, tier, Energy, Threshold, attack); the text drops what the block already says (the spell's Threshold line, the Energy cost). Enhanced, Ritual, Combo bonus and Illusion Combo parts get their own boxes; dice, AP/RP costs and a Mode's bolded numbers stand out. Lists of links are chips; a skill tree's tiers are headed bars with each entry as a card and its Energy cost as a badge; weapon types are a table of both weights; a status shows the rule or ability it comes from under that page's own title; tables are striped.

**0.71.2:** Starting Icons obey the starting rarity limit, like materials and Affixes: the wizard only offers Forms within it, and the GM's check refuses one above it.

**0.71.1:** **Code audit.** Fixed: undoing a move after spending AP on an action could still give the move's AP back (Foundry merges flag data, so the cleared undo list lingered; the movement ledger is now always written whole). Fixed: a Very Rare Form or Affix was read as Common by Forge/Conjure/Consecrate's Rite timing. Names that go into dialogs and chat cards (a picked-up item's taker, Phantom Pain, the Mods tabs, armor changes, Ward and Mode lines, attack card notes) are escaped, so a name with `<` or `&` in it shows as written. Cleanup: the small helpers copied into 26 modules (escaping, dialog fields, selects, form reading) are one shared module; the rarity name and order helpers are shared; unused code removed.

**0.71.0:** **Shops.** A new Shop actor: put a merchant token on the map, stock it from the Forge, by dragging items in, or with random stock rules (kinds, rarities, Grades, how many), and players buy and sell with their characters' money. Prices come from the catalog, or the world's price per rarity, plus a flat amount per Grade above 1 (Settings → Shop prices); each shop has a markup and a sell rate, and each stock row can have its own price, a count or unlimited stock. Money changes hands in whichever linked currencies a character holds, with change. Every trade goes through the GM's client and is whispered as a receipt. The New Character wizard can now start characters with the GM's named catalog items.

**0.70.2:** Fixed: the Journal sidebar's Codex button spans the full width (like the Forge's), instead of sitting small at the top.

**0.70.1:** **Force (the Rules doc).** Downward Force knocks a creature prone only when it's at least the creature's height (Sizes 1–5: 1, 3, 5, 10, 20 ft; shown on the Size pages in the Codex): being driven into the ground, a grapple slammed down, and a damaging fall landing (Gravity is downward Force) all check it. Forced movement (Sea's moves, the Fortune Table) already skipped Lift and half Max HP, with walls turning the feet left into Force damage; that's now written down as the doc's rule.

**0.70.0:** **The Codex.** A window everyone can open with every element of the game as a page (over 1,400): the Rules and Equipment docs chapter by chapter, stats, Sizes, damage types and conditions, every skill tree and every ability, spell, Mod and Mode, the Combo spells, the Wonders, weapon types, tags, materials, armor, Foci, Shrouds, Affixes, Icon Forms, items and statuses, all linked to each other and built from this world's data (its edits show; what it hides stays hidden from players). Search it, or follow the links now on sheets (tags, skill entries, Action List rows, statuses, an item's catalog line), the wizards and chat cards. Open it from the Journal sidebar, `/codex [search]`, or a sheet's header menu; link to a page from any journal with `@Codex[name]`. The Rules doc snapshot is refreshed from the live doc.

**0.69.0:** **Item catalog.** Every item now comes from one catalog: an entry for every valid weapon, armor, Foci, Shroud, Icon Form, Affix and ammunition (568, built from the tables, so new materials get their weapons automatically), plus the GM's own named entries with a picture, text, rarity, weight, volume and price. A sheet's item is a copy at a Grade that reads everything else from its entry (edit the entry, every copy follows), with the GM's per-copy changes kept as overrides. The **Forge** is now the catalog: browse and filter it, give an item at a Grade (a sheet's + opens it for that character) or drag it onto a sheet, make, edit, copy, hide or delete entries. Existing items are linked as they load with nothing lost; items in the Items sidebar become named entries once. Item sheets show their entry and weight/volume/price; the Equipment tab shows what a character carries.

**0.68.0:** **World data store.** Every table of game data (Stats, Sizes, weapon types, tags, materials, armor, Foci, Shrouds, Affixes, Icon Forms, Combo spells, skill trees and the rest: 33 tables) now lives in one store. The system's values from the docs are the defaults, and a world can layer its own changes on top (edits field by field, new entries where the engine handles them generically, hidden entries), so doc updates still reach everything a world hasn't changed. Settings → **World data** shows what a world changed and can export, import or clear it. Nothing changes in play yet: this is the groundwork for the Codex and the GM editor.

**0.67.0:** **Movement cost overhaul.** A move longer than your AP can pay for is now cut short at the last square you can afford, along the path you chose, instead of being refused (Enforce). The cost is measured along the token's real path (waypoints, around walls), not the straight line. Undoing a move (Ctrl+Z) gives its AP back if you haven't acted since. Fixed: the movement ledger is cleared at the start of each turn and keyed by the combatant, so nothing banked carries into a later turn, and a creature leaving the tracker mid-turn no longer resets the current turn (this also fixes "once per turn" abilities resetting then); quick moves in a row (arrow keys) are charged from where the last one left off; the AP and the ledger are written in one update; stowing a weapon, changing Light armor and clicking an AP pip now count as actions for strafing; Careful Steps' upkeep no longer banks movement; clicking the tracker's Move pill no longer throws an error.

**0.66.0:** **Sea update (the Mental doc).** Surge (horizontally), Current and Riptide now move up to 5 ft, fixed (they no longer scale with Power); Drown needs 10 ft of forced movement. Riptide's move deals Power d6 more Force damage when it causes Force damage (into a wall or a barrier).

**0.65.13:** **Fixed: free stat points from GM edits.** A character's unspent stat points are now worked out as 3 per Skill Point (plus the carried remainder) less what's in their stats, instead of a separate count. Lowering a stat frees points, raising one uses them, and lowering then raising no longer leaves extra points behind. To take points away for good, lower Skill Points. New characters start with any leftover (stat points not a multiple of 3) carried.

**0.65.12:** **Fixed: combat ending ended Concentrations.** Clearing a creature's effects when combat ends now leaves the effects its Concentrations keep going (Trance, Premeditate, an Enhanced Drown), so the Concentration carries on.

**0.65.11:** **Melee Manifests no longer have Disadvantage** (the Mental doc's update): Melee is 1 AP at a target within your personal melee range, with a normal attack roll.

**0.65.10:** **Trance on yourself.** A hostile Mode Tranced onto yourself makes your Manifests of that Mode Enhanced for free while the Trance lasts (Burst still costs Energy), instead of adding a Trance ability you already have.

**0.65.9:** **Illuminate and Eclipse are bulleted too.** Their "Against an enemy", "Against an ally" and "Enhanced" lines show as bullets in the Skills tab and the wizards. Fixed: a bolded phrase that appears in both versions (Illuminate's "die size reduced by 1") now scales in both, in the Skills tab and on Manifest cards.

**0.65.8:** **Fortune's and Ruin's Bands are a list again.** Their three bands show as bullets under the passive in the Skills tab and the wizards, instead of running into one sentence.

**0.65.7:** **The Fortune and Ruin Tables show real numbers.** Their bolded values are worked out for the character's Wonder Power in the Skills tab and the wizards (e.g. 3d12 at Power 3, not 1d12); a note says when Rig or Doom use a different Tenet multiplier.

**0.65.6:** **The Fortune and Ruin Tables in the Skills tab.** A Wonder's table shows under its tree's tiers (with how its bolded values scale for you), and in the creation wizards' Skill Trees step.

**0.65.5:** **Trance abilities: free Enhance, Burst with your own Energy** (the doc's update). Using a hostile Trance Mode can be Enhanced for free; Burst (RP instead of AP) is now offered and costs the user's own Energy.

**0.65.4:** **Stat points the GM takes back stay spendable.** Lowering a character's stat (after creation) puts those points into their unspent stat points, so the player can still spend their whole total (setting the unspent points in the same edit overrides it). The character sheet opens wider (900 px), so the stat rows and their + buttons fit.

**0.65.3:** **Mental costs in the Skills tab.** PON, SNA and WIL mins and "total Mind" are worked out (they showed "see text"), and "Scaling Stat" in a Mental tree is a stat, not a held weapon: a Wonder's own, or for the Arts (Reflex, Impulse, Premeditate, Mantra) both amounts, Dream (PON) and Nightmare (SNA). The Reflex row in the Action List shows both numbers, and the Reflex Manifest dialog no longer offers Burst.

**0.65.2:** **Trance: hostile goes by the Mode.** A Trance Mode is hostile (an ability the target can use) by what its baseline effect does, not by Dream or Nightmare: Pacify, Herald, Crescendo, Wager, Dispersion and Providence are hostile; Warzone, Bloodbond, Hone, Umbral Strike and Eclipse aren't (Illuminate and Eclipse give a willing target their ally version).

**0.65.1:** **Character creation help.** The wizards' Skill Trees step now describes each tier: the doc's tier line, then every entry's name with its first sentence or two and its Energy cost (the full text on hover). The Stats step has advice for new players: one Archetype, one offensive stat (Str/Dex, Pon/Snap or Reach/Grasp) plus its defensive stat (Con, Will or Build).

**0.65.0:** **Ruin (Nightmare) Wonder, the Reaction List tab, and Rig's attack roll.**
- **Ruin:** Jinx, Forfeit and Calamity store Jinxes (no crits); the Jinxed creature's next attack roll resolves them all (under half its die: they fizzle; higher: 2 or 4 Strengthened). Gild (Advantage on that roll), Reversal (flip their attack roll after the Jinxes resolve), Doom (Tenet: roll the Ruin Table, apply it on a hit), and all 25 Ruin Table effects.
- **Reaction List:** the popup and offer card switches have their own sheet tab (Popups and Offer cards) instead of the Action List's Reactions group, and their own Token Action HUD tab.
- **Fortune:** Rig now needs a successful attack roll at the creature you pick (the doc's update).

**0.64.2:** **More offer cards can be switched off** under Reactions in the Action List: Palisade, Blade Flurry, Combo / Flow Like Water, the start-of-turn card, the Wonder ability buttons, Chant, Will of Body and Spirit, Perennial, Vice / Quicksand, Momentum, Warpath and Current. Each switch only shows for characters who can get that card.

**0.64.1:** **Mark shot switch.** Rapid Weapons T3 characters get a "Mark shot" switch under Reactions in the Action List: off, a Marked creature acting uses the Mark up without posting the Shoot card (Lead Blindness still applies).

**0.64.0:** **Fortune (Dream) Wonder, and Mental doc changes.**
- **Fortune:** Wager (damage), Windfall (Energy, overflow to Temp HP), Providence (the Fortune Table), Fortune's Bands (no crits: a low roll hits you, a high one adds 2/4 Strengthened), Parlay (stacks multiply), Double Down (Disadvantage, an 8-stack band), and Rig (Tenet: roll the table any time, from the Action List). All 25 Fortune Table effects are automated.
- **Changed:** Herald is 6d8 × Power Force (was 10d8); Umbral Strike adds 1d4 × Power (was 1d8); Drown drains 2d8 × Power (was 2d10), and downward movement doesn't count toward it.
- **Fixed:** Umbral Strike's extra damage always rolled at Power 1 (it cleared the charge before reading it).
- The tree generator reads Wonder tables and indented sub-bullets, and the Wonder parser tells a tier's Mode from its passive when the tier names both.

**0.63.0:** **Earth (Dream) and Sea (Nightmare) Wonders.**
- **Earth:** Accretion encases a creature in an object that soaks Physical and Elemental hits up to its Limit before anything else (your Accretions meld; Enhanced Weakens a chosen category against it); Adamant (Tenet) lowers a Pain Threshold; Reinforce and Bedrock are asked when a big hit strikes an Accretion; Ejecta throws an Accretion (Action List); Batholith widens both.
- **Sea:** Undertow hurts a creature whenever it moves or something else moves it; Surge (Tenet), Current and Riptide are short forced moves that ignore Force and Lift (direction card, up to the distance); Shoal Strengthens Sea damage on prone targets; Drown knocks prone and drains health after enough forced movement this turn (Enhanced: a Concentration that keeps them down; getting up is an attack roll).
- Forced movement (throws, knockback, pulls, drags) is now tracked per creature. The Mental snapshot is refreshed, and the tree and bold-number generators handle the doc's new bullet layout for Light and Dark; decimal bolded numbers (Eclipse's 0.5, Current's 1.5 ft) now scale with Power in the shown text.

**0.62.1:** **New NPC stats start at 0** (Even spread still fills them). **Terrain regions are GM only:** players don't see rough/difficult/cleared terrain but still pay its AP; terrain already on scenes is hidden once when the GM loads the world.

**0.62.0:** **Rules audit: Fear, dragging, Cut + Hex and Stab + Hex.**
- **Fear** now also blocks the free Energy at the start of a turn (Rules Ch9: no Energy from any source), not just Recover Energy.
- **Dragging** a grappled creature along costs +1 AP per move (Rules Ch8); the Action List's Move row and the movement pill show it, and the pill now says how far a grappled creature can move instead of "can't move".
- **Cut + Hex** (+12 die size against a living target the Hex damages directly) and **Stab + Hex** (three Strengthened when the Build check rolls half or less) are automated: every Combo in the list now is.
- **Impale** note in AUTOMATION.md corrected (more than half the Pain Threshold, as the code already did); the Eclipse snapshot and trees carry the doc's "reduction rounded up" wording (the code already rounded that way); the Pure Body sheet note no longer says it's manual.
- Cleanups: a duplicate Energy check in the attack flow, a dead Shield-guard variable, an empty Control branch in the Wonder reroll, a `var` in Strike a Spell, and a comment that swallowed a line in Forging.

**0.61.2:** **Emplace barrier health** is the Shield's 10 × Power (it was still the old 20 × Power), and Amplify adds 10 per Power level to a barrier.

**0.61.1:** **Shown numbers match applied numbers.**
- **Mental:** charge names, descriptions and dialogs, the Order sign options, Tenet tips and popups (Verdant Soul, Mortal Coil, Weight, Gust, Ego), Ward text (with Alignment's Strengthened), Eclipse, Flourish, Redirect, Vice, Absolution, Adaptive Skin and Umbral Strike now show the scaled values; Pacify and Dampen reductions read "−".
- **Magic:** the Cast Spell dialog, Mod tooltips (a ticked Replacement doubles them), the Skills tab and the cast card scale check targets, Prolong/Linger counts, Hold, Telegraph, Freeze, Form/Animate points, Grade, Body, Amplify and Rip; Combo rider text stays "per level"; the Slam + Hex choice shows the scaled die size; Poison, Hex and Charm cards show the real check target, count and stacks (Weakened too); Hold on a grappled target shows the stacked total; Amplify and Mirage updates keep effect names and descriptions in step.

**0.61.0:** **Every bolded number scales with Power and stacks.**
- **Check targets:** Poison's, Charm's and Hex's "3 or higher" (and the combined "5 or higher") are multiplied by Spell Power and the spell's stacks (a Power 3 Poison needs a 9). Combo riders use their level.
- **Pools:** Form, Animate and Make + Animate point pools and Body minimums scale with Spell Power too (a Power 3 Form has 15 points before the Threshold multiplier).
- **Amplify** adds the Amplify caster's Spell Power in Power levels; **Rip** accepts Spells up to 5 × the Rip caster's Spell Power; Exploit's +4 die size uses the caster's stacks.

**0.60.2:** **Power scales the rest.** Make/Animate's Grade 2, Creation's grade of 1 and Prolong/Linger's counts now scale with Power as well as stacks; a doubled Hematite is 4× Power and a doubled Taaffeite quarters a Ritual's Energy.

**0.60.1:** **Audit follow-ups.**
- **Foci Affix doubling** (Shard / Orb / Band) now also doubles Quartz's range, Jasper / Tourmaline / Colored Diamond / Alexandrite's stacks and Ruby / Sapphire / Painite's numbers (only some Affixes were wired before).
- **Scaling:** Prolong and Linger counts, Make/Animate Grade, Creation's grade and Brand's damage (with its stacks) are scaled by Strengthened/Weakened.
- **Frostbite** works on spells with no Energy removal of their own (held Frost, Slam + Frost, a Stab + Frost that doesn't crit). **Vigil**'s later activations recover 8 shielding instead of placing a new one. Lingering Arcane damage and riders are Weakened once against non-magical targets.

**0.60.0:** **Strengthened/Weakened now scale every bolded number (audit).**
- **Mental:** a Ward's amounts are scaled by a crit on its activation roll and by an Area Ward that hits more than two targets (Weakened); Reverie's cap and growth by Alignment's Strengthened. Enhanced Mandate damage (±10), damage-roll Fracture (±3, was 2) and the manual charge dialog scale with Power and stacks. A Weakened Burden is no longer held at 3 to escape. Dispersion counts a crit's stacks. Umbral Strike's damage is Power d8 scaled by the Manifest's stacks. Warmonger's 1d12 scales with the buffing Mode's stacks.
- **Magic:** Poison, Hex and combo Charms (and their Force, dice, Ignite/Stain/Energy extras and die-size penalties) keep the stacks they were cast with and use them every tick; Summon, Animation and Made riders use the attack's stacks; a spell's Pierce and Bash, Telegraph's tolerance, Hold's minimum, Phantom Pain, Strike on a Spell and Combo Force go through the stacks too. Slam + Acid's 1 Stain is now × Power and scaled; object-aimed Ignite/Stain no longer scales twice.

**0.59.1:** **Dispersion works on magically made things.** Summons, Animations (the `summon` marker) and Made items (the `made` marker) can be dispersed; they lose 20 × Power health or durability, and the attack goes at their creator.

**0.59.0:** **Light (Dream) and Dark (Nightmare) Wonders.**
- **Illuminate / Eclipse:** the version follows the target's side (ally or enemy; a neutral one asks). Illuminate shrinks an enemy's attack die, or the attack die of anyone attacking a warded ally (not the caster's allies); Eclipse shrinks an enemy's dodge die by 0.5 × Power (rounded down), or the dodge die of whoever an Eclipsed ally attacks. The versions don't stack with each other (Convergence lets the Illuminate ones). Enhanced: the damage of affected attacks is Weakened (Illuminate) or Strengthened (Eclipse).
- **Tenets:** Beacon and Shadowmark (markers for the GM: seen through obstruction, one step more obscured). **Refraction / Penumbra** spread the Mode with an attack roll. **Totality:** an Eclipsed ally attacking an Eclipsed target is in half stealth. **Umbral Strike:** a charge that gives a step deeper into stealth and 1d8 damage, asked when the holder attacks. **Dispersion:** an attack with Advantage at an effect's creator; the effect loses 20 health or is destroyed if its creator's Scaling Stat is 15 or less. **Corona / Nightfall** (Action List, 1 AP) spread a lasting Illuminate / Eclipse to everyone within 10 ft.

**0.58.1:** **Reflex picks its target.** The Reflex popup lets you choose whether the Manifest goes at the attacker or at who they are attacking.

**0.58.0:** **Snappence Arts (new Mental T3 tree).**
- **Reflex** (T1): when a character you can sense attacks, you're offered a Manifest first, for RP equal to the Range's AP cost and half the Wonder's Scaling Stat min in Energy; its effects are Weakened. Other actions (moving, dodging...) use the Action List row.
- **Impulse** (T2): once a round, pay half the Scaling Stat min to apply your Tenet again after it already triggered (Tenet buttons, Balance, Infuse, Empower, Dampen, Adapt).
- **Fixation** (T3): at the start of your turn you declare a character; Reflex against them isn't Weakened.
- **Nerve** (T4): Advantage on the Willpower check that keeps a Concentration.
- **Afterimage** (T5): once a round, Reflex costs no RP or Energy for the ability.
- Reflex, Impulse and Fixation are switchable popups under Reactions.

**0.57.0:** **Concentration, Trance and the Ponderance Arts (Mental doc changes).**
- **Concentration:** you can concentrate on as many things as your Mental Theory tier. Taking direct damage costs 1 RP and a Willpower-die check (the result must at least match the damage), or every Concentration is lost; falling unconscious loses them all. Ending one (Action List: Concentration, or Dismiss) ends the effects it was keeping up, for free.
- **Trance** (Mental Theory T2): an 8 hour activity (not in combat) that puts a permanent Mode on a creature and a Concentration on you. At the start of their turn they make a self attack roll; a hit applies the Mode (last round's copy is replaced). Nightmare Modes become abilities of the target instead.
- **Ponderance Arts** (new tree): Premeditate (store a Manifest that hits, trigger it later; Forethought makes it free of once-per-turn limits), Mantra (asked whenever a Tenet triggers: pay Energy to double its bolded effect; with Infuse it removes the Weakened stack, with Adapt it adds a second Strengthened stack), Composure (damage costs you only one Concentration), Daydreaming (one Concentration can't be broken).
- **Burden / Entomb:** Burden stacks are counted per Disadvantage, so Entomb (escape 4 × Power) needs 4 stacks in total (two Burden applications).
- **Tier moves:** Chant is Mental Theory T3, Fluidity T4, Will of Body and Spirit T5.

**0.56.1:** **Mental and Magic doc changes.**
- **Magic:** Shield has 10 × Power health (was 20); Reactive works once per instance of damage.
- **Mental:** Bloom is 50 × Power temp HP and stacks with itself; Wither (1d12) is reduced by Temp HP, shielding, Shrouds and Wards; Fracture changes the die by 3; Entropy is now a Chaos T5 passive that lets Fracture charges be spent on a crit; Burden is two Disadvantages split as you choose (escape 3 × Power) and Entomb escapes on 4 × Power (it needs 3 Burden instances); Warzone adds 1d10 per stack (Enhanced adds your Snappence min) and no longer uses up; Adaptation Modes give their stack hit or miss, Crescendo's die grows 2, 6, 10..., Exact is 1d12; Instinct is a passive (keep 4 stacks, start combat with 4).

**0.56.0:** **Affixes are items of their own, and Rip.**
- **Affix items** (Equipment tab, new item type): a gem with an Offensive and a Defensive form, attuned separately (an hour, not in combat) to one of them. Offensive Affixes work through your attuned Foci and Raw Casting, Defensive ones through your Shroud. Each attuned Affix costs 20% speed past the Free Affixes of the matching Foci (Offensive) or Shroud (Defensive). Tourmaline's element and Colored Diamond's declaration are set on the Affix. Old per-item lists convert automatically when the GM's client loads.
- **Wizards and Forge:** the New Character and New NPC wizards pick Affixes as their own items with a form (no Foci or Shroud needed); Conjure makes Foci, Shrouds or Affixes.
- **Shroud ids** renamed to bulwark / mantle / rebuke (old items convert).
- **Rip** compares the Scaling Stat the caster had (5 or less), as the Magic doc says.

**0.55.0:** **Doc refresh (Rules, Martial, Equipment, Magic, Combos, Mental) and Action List tidy.**
- **Action List:** Grapple is no longer its own row (it's an option in the Unarmed attack dialog); Reactions sit just above Checks (also in the Token Action HUD).
- **Rules:** speed rounds down to 5 ft steps; Magic damage also counts as Magical (Agate/Jasper/Obsidian, Prism, Wards, Limit factors); Thrasher grapples need a target your size or smaller; Heave costs double STR min; Impale uses half Pain Threshold; Pure Body doubles with Unstoppable.
- **Martial:** Shield Toss is now Return / Block / Strengthened boxes (none needed beyond one); Quickload can replace a Pepper shot; renamed Rend, Living Weapon, Giga Harden, Delta/Omega; Solitary can't be used while holding another weapon.
- **Equipment:** Iron/Copper armor swapped, Steel/Bronze armor Limit is a third (was a tenth), Silver Coating; Shrouds renamed Bulwark / Mantle / Rebuke; Painite works as Pierce; every Icon Form Ward number changed (and Bane Enhanced Weakens, Zealot Enhanced Weakens on a crit).
- **Magic:** Flare sets (2d12 = two 3d4), Phantom Pain raises the Pain Threshold, Animation speed as a percentage of Size, Animate Armor/Shroud by weight (Shrouds Arcane), Animate Icon, Amplify +1 Power, Skin uses Iron, Slashing/Piercing/Crushing + Radiation deal radiation.
- **Mental:** Alignment reworked: it now only shapes your Form's Ward (1 Advantage, 2 Strengthened, 3 half stealth, 4 hits regardless), depths 3-4 need Deepening (Mental T3) and cost 1/2 AP a turn; Equilibrium and the Tenet doubling are gone; Melee Manifests have Disadvantage; Patron no longer needs Alignment; Wither is 1d12; Rite can't make Rare or Hard things permanent.
- Affixes as separately attuned items (Equipment doc) are not built yet: Affixes still sit on the Foci/Shroud.

**0.54.1:** **Lint and CI.** ESLint config in the repo (`eslint.config.mjs`, run with `npm run lint` from `dev/`) and a GitHub Action that runs lint and the tests on every push and pull request. No change to play.

**0.54.0:**
- **Open prompts list (GM).** A bell button in the scene controls opens a list of every question the game is waiting on a player to answer: what, who it waits on, about whom, and for how long, with a Cancel button each (and Cancel all). It opens by itself when a question has waited 30 seconds. Cancelling closes the window for the player and counts as "no".
- **Questions no longer time out.** The 60-second timer on questions to players and the 2-minute timer on requests to the GM are gone. A question asked of a player who goes offline is answered "no" at once, and requests waiting on a GM who left are dropped.
- **Warden / Riposte (Enhanced):** the reflect attack roll gets the Ward's Alignment 4 Advantage (and Equilibrium's Disadvantage on the dodge), like the Ward's own roll.
- Removed the console line logged for every question. Un-exported 114 functions nothing else imports. The harnesses share one Foundry mock (`dev/tests/support/foundry.mjs`).
- README is now a short front page; the detail moved to `dev/AUTOMATION.md` and the version notes to this file.

**0.53.1:**
- **Concurrent relayed requests no longer lose updates.** The GM's client now runs relayed requests for the same creature (or item or effect of it) one after another, so two hits that arrive at once both land instead of both reading the same health. A request waits for the one before it, including a Ward question still open for that creature.
- **Redirected damage (Guard) no longer uses a global flag** that made every other damage instance skip its Wonder effects while it was being applied; it now says so on the damage itself.
- **Placement beside a token works on hex and gridless scenes** (see "Range on any grid").

**0.53.0:** **Audit follow-ups.**
- **The GM relay only carries out what the system sends.** A player's client asks the GM's client to change things it doesn't own (damage, conditions, Durability). Every such request is now checked: only health, the pools, conditions, Durability, Ward placement and the system's own flags and effects are accepted; stats, Skill Points, trees, ownership, items' identity and the GM-only stealth statuses are refused (and logged to the console). It cannot tell a real hit from a made-up one, so this narrows what a modified client can do rather than stopping all cheating.
- **Reaction switches** in the Action List (see "Reactions: skipping popups").
- **Distance works on hex and gridless scenes.**
- **Fix:** the Infuse card showed dice left over from the previous resolution; it now shows only its own.
- **Cleanup:** dead code and unused imports removed, and the Mental modules no longer import each other in a circle (`ask.mjs`, and `wonders.mjs` is handed `mental.mjs` when it loads).
- `system.json` description updated.

**0.52.3:** **Echo's free negation is Strengthened at 4 Alignment too.** Every Ward already got Advantage on its attack roll and a Strengthened bolded effect at 4 Alignment of its own type (shielding, Premonition charges, every negating Ward); Echo's free negation on later instances of damage was the one piece that still used the unscaled number.

**0.52.2:** **Infuse, Empower and Dampen only look at creatures on the scene.** They scanned every character in the world, so a character who wasn't on the scene at all (Rustgnaw, with no token) was still asked about hits in the fight, and the GM got the popup. A character who isn't on the scene can't see the fight and isn't asked.

**0.52.1:** **A Tenet only works for someone who has learned its Wonder.** An Icon set to a Tenet (Infuse, Empower, Dampen, Verdant Soul...) gave that Tenet to its attuned holder even if they hadn't learned the Wonder it comes with (its first tier), so Infuse could pop up for a character who had no Destruction.

**0.52.0:** **Half Stealth and Full Stealth statuses (GM only).** Two new statuses on the token HUD, "Half Stealth (GM)" and "Full Stealth (GM)". A token with one attacks from that stealth value:
- **Half stealth:** Advantage on the attack roll and Disadvantage on the target's dodge. **Full stealth:** the target can't react, and the attack roll only decides a crit (at or above their dodge die size, double crit at twice that).
- **They don't stack.** Full beats Half, and an attack that already has half stealth by itself (a Targeted spell, Vector Assault's return attack) is still a single half stealth, not two. Spirit Sense (Grasp Arcana T4) only cancels the Targeted spell's own bonus, not one the GM set with the status.
- Breaking free, throwing or slamming a grapple victim, and Ward rolls aren't attacks from stealth, so the status doesn't apply to them.
- Only the GM can add or remove them: players don't see them on the token HUD and can't toggle them.

**0.51.17:** **Helping effects only come up for allies, harming ones for foes.** A new check by token disposition (Friendly vs Hostile; Neutral and tokenless creatures count as either side):
- **Offered only for a creature not on the opposite side of the one being helped:** Block, Shield Toss guard, Perfect Block, Quartz and Adjust (the "Ally help" button), Dampen (Peace Tenet) and Infuse (Destruction Tenet; also never offered to a creature whose own hit it would be, or the one being hit).
- **Offered only against a creature that isn't the holder's ally:** Empower (War Tenet).
- Choices you pick yourself (a Ward projected at someone, Bloodbond's second target, Zap an ally, Scepter and Tablet's ally bonus) are unchanged.

**0.51.16:** **Infuse needs a willing character.** The Infuse question went to every creature holding the Tenet, including the enemy being hit (the GM got asked for an NPC's Infuse). It is now skipped when the holder is the one being hit, and when the holder and the attacker are on opposite sides of the scene (a friendly token and a hostile token); neutral tokens still get asked.

**0.51.15:** Every question the system asks a player logs a line to the browser console (F12) saying whose client asked, who answered it, and who owns the character: a debugging aid for prompts that reach the wrong client.

**0.51.14:** **Infuse is offered once per hit.** At 3 Alignment a Tenet can be used twice a round, but the same hit is never offered Infuse twice.

**0.51.13:** **Infuse is asked after the response is on the card.** The Infuse question used to open while the defense was still being worked out, so the attack card kept showing its response buttons until it was answered; a second click (from either client) repeated the whole attack. The defense card is now posted first, then Infuse is offered.

**0.51.12:** **Questions about an unlinked token's character go to its owning player.** A token whose character isn't linked is a copy of the world actor, and the copy didn't always show who owned it, so Infuse and other prompts could fall through to the GM. The copy now defers to the original character's owners, and each creature is asked about once instead of both the world actor and its token copy.

**0.51.11:** **One popup per question.** The questions the system asks a player (Ward and Premonition negation, charges, Tenets, Far Sight, Discharge, Adapt...) are de-duplicated on each client: if the same question is asked twice at once (by two clients, or twice by one), a single window opens and both askers get its answer; the same ability sent to a client twice within three seconds runs once. This is a safeguard for two connected clients ever getting the same prompt.

**0.51.10:** **Prompts about a player's character go to that player, not the GM**, whenever the player is connected (the GM only answers for NPCs and for players who are offline). This was true for the Ward and Premonition prompts, charges and Tenets since 0.51.8; it now covers the turn-start **Far Sight** upkeep question (the GM's client runs turn starts) and **Discharge** (the attacker's choice, which a defender's or GM's client could be the one to ask).

**0.51.9:** **Nightmare negate Wards (Veil, Warden, Bane, Grudge, Riposte, Zealot, Echo) need an attack roll**, as the Equipment doc says Wards are used with "a self attack as per the rules". Each use costs the 1 RP, then you roll your attack against your own dodge roll (4 Alignment gives the roll Advantage, Equilibrium gives the dodge Disadvantage, exhaustion and the like apply to the dodge): a hit negates, a miss spends the RP (and Enhance Energy) and negates nothing. **Make Clear** (Willpower Arts T2) is offered in the same prompt: Advantage and one reroll for its Energy. Echo's free uses after it fully negates an attack need no roll, and Grudge only counts hits.

**0.51.8 (testing fixes):**
- **Ward and Premonition prompts go to the defender's player.** "Spend 1 RP to negate…" was asked on whichever client applied the damage, so a GM's or an attacker's screen got it (most visibly after a Chant reroll). It is now asked of the character's own player (the GM only for NPCs or when no player owns it). Charge and Tenet questions use the same rule.
- **Infuse (Destruction Tenet)** now comes up on the caster's own Manifest hits (and Chant rerolls that hit), as the Tenet says; it still skips Ward activations and Warden/Riposte reflects.
- **Icons show scaled numbers:** the Equipment tab, Icon sheet, Ward dialog and cards now show the Ward and Enhance text with its shielding and negation scaled by Willpower and Grade.
- **Alignment explains itself:** the Set Alignment row in the Action List says what your current Alignment does at each point and its speed cost.
- **Removing Ignite or Stain can be strafed with.** "Removing Stain" and "putting out Ignite" were being mistaken for movement (the word "removing" contains "moving"), so their AP did not pay for pending movement. The movement check now matches whole words only.
- **Free movement indicator:** the combat tracker shows **Move N ft** for the creature whose turn it is (what it can move without spending AP; hover for the AP the next step would cost), and the sheet header shows the same ("30 ft free · moving past it costs 2 AP"). A fresh turn shows a whole step.

**0.51.7 (doc refresh: Rules, Martial, Magic, Equipment; Mental unchanged):**
- **Ignite and Stain ticks** no longer slip past barriers and temp HP: each tick goes through the normal damage pipeline (Shields, Shroud, armor, temp HP, Wards).
- **Pure Body:** when resisting, Constitution (not doubled) can stand in for the required stat if it is higher; the check uses whichever is better.
- **Hold** (Gravity): the counter grapple check needs a minimum of **2** (was 3), and a creature that is already grappled takes **1d12** physical (was 2d12), both × Power.
- **Affixes** (Equipment): nobody gets an Affix free any more. Every attuned Affix costs 20% speed, not counting the Free Affixes of your attuned Foci and Shroud (a Wand with one Affix is -20%).
- **Grappling** (Rules): a grappled creature can't move out of its grappler's range (this was already how held creatures work). **Get Over Here!** still deals its damage. Wording only: Harden ("when Brace would apply"), Skin (Soft Leather), and the Foci/Shroud Affix columns now read Offensive/Defensive Effect.

**0.51.6:** Fixed the terrain buttons dropping two regions per click: the buttons were wired through both `onChange` and `onClick`, which Foundry can fire together. They now use `onChange` only, and a repeat click on the same button within a moment is ignored.

**0.51.5:** Cleanup, no rules changes: removed the old Gray Iron/Gray Steel physical-roll penalty fields from the engine, renamed the Affix profile fields (`affixLimit`, `doubles`), and rewrote the Code map below to list every module.

**0.51.4:** More Mental follow-ups now carry the stacks of the Manifest that caused them, so a crit doubles their bolded numbers:
- **Fester**'s re-application at the start of their turn, **Unbound** and **Ricochet** charges, **Benediction**'s copies, **Infuse** (its own Weakened now scales the Mode's numbers), and the Tenets that fire on a Manifest hit: **Verdant Soul**, **Mortal Coil**, **Weight**, **Gust** (its Force too), and **Ego** (on a crit it always doubles).
- **Momentum** (Beyond T2) is now offered automatically, on a card, whenever a creature moved by Herald, Gust or Momentum collides (a wall, an Emplace barrier, the ground, or another creature it was knocked into), like Vice after a failed counter grapple check. It uses fresh Power and no stacks; you can still use the Action List row for a collision the system didn't see.
- Vice and Quicksand already come up after every failed or successful counter grapple check against a Below Mode (holds and Burden).

**0.51.3:** Spells with no attack roll (Restore and Painless, Shift, Mend, Summons and Animations pools, a Mirage's Power) now scale with Strengthened/Weakened too, from the plan's stacks and from any effect on the caster with a `strengthened` value (nothing in the rules gives one yet, so this is plumbing for when something does). A crit Mirage's Power now scales with its stacks. Removed a stray `trees.mjs.orig`.

**0.51.2:** Any Strengthened or Weakened stack on an attack (a crit's two, Alignment, an Area spread, Adapt, a Mod) now scales the **bolded** numbers of what it carries, not just damage.
- **Mental:** every Manifest's stacks (crit included) scale the bolded numbers of its Mode (temp HP, healing, Lift, die sizes, escape checks, charge sizes, damage reduction and caps, Body); effects that last remember the stacks they were made with. A critical Bloom gives 120 temp HP at Power 3 instead of 60.
- **Magic:** on a hit, a Shield's health, Slow/Haste and die-size penalties, Personal Repulsion/Well thresholds, Hold's escape check, Static, Freeze and held-spell Energy removal scale with the spell's stacks (the damage's stacks for attack-die penalties, Frostbite and Lightning Rod). Restore, Shift/Mend, Mirage and Summons resolve at the cast with no attack roll, so there is no crit to scale them.
- **Martial:** the Martial doc has no bolded numbers, so nothing changed there.

**0.51.1:** Heavy armor keeps its two stealth Disadvantages. Alignment 2 now scales every bolded number of a Mode (see Alignment), not just damage; Wards ignore it. Reverie and Zealot follow the updated Equipment doc (Alignment numbers).

**0.51.0 (movement speed rework):** speed is no longer a stat-based value. It starts at your Size's maximum (Size 3: 50 ft) and **percentages add together** (two 20%s are 40%), rounded to the nearest 5 ft, never under 5 ft:
- **Armor** (Equipment doc): Light -20%, Medium -40%, Heavy -60%, Titanic -80%. Armor no longer costs extra AP to move, and Heavy keeps two stealth Disadvantages (Titanic auto-fails). **Gray Iron** pushed past Titanic (Titanic) and **Gray Steel** pushed past it (Heavy, Titanic) have speed 0% (the 5 ft minimum); Gray Steel Titanic also takes +1 AP to move. The old "Disadvantage on physical rolls" is gone. **Trudge** ignores the armor's speed loss (and that AP) for the next move; **Quicken** doubles the final speed.
- **Affixes** and **Mental Alignment** (see above and Magic Equipment).
- The header's speed pill tooltip lists where your speed went. Summons use the speed they were made with.
- Doc refresh: Martial (Trudge), Mental (Alignment, Fluidity, Expansion/Equilibrium positions), Equipment (armor, Foci, Shrouds), and the Rules doc snapshot is now kept in `dev/docs/rules.md`.

**0.50.2:** Forced and free movement is explicitly kept out of movement cost: it costs nothing and doesn't change the movement ledger, whoever's turn it is (see the list under 0.50.0).

**0.50.0 — Movement cost in combat.** Moving a token on its creature's turn costs AP, but the cost isn't paid when you move.
- **Steps:** a move is made in steps. One step carries you your speed in feet (Haste's multiplier included) and costs the creature's move AP (1, plus terrain, slows, armor...). A step you open stays **pending**: its AP is simply still there to use.
- **When it's paid:** only if you move on past the step (the pending step is paid then, and a new one opens), or never: **AP spent on an action settles a pending step for free** (strafing), and whatever is left of that action's AP is **banked** toward your next step (the bank is used first when a step has to be paid, and a step the bank covers in full is settled the moment it opens). The distance left in a step you've settled stays free. A step still pending when your turn ends costs nothing.
- **Affording it:** you need a step's cost available (real AP plus bank) to open it, and to pay for one you move past. The sheet header shows "(N ft of move left)" beside your AP.
- *The worked example (2 AP per 30 ft, 6 AP):* move 30 ft (nothing spent: 2 AP of movement pending); cast a 3 AP spell (3 left: it settles the pending 2 AP of movement and banks 1); move 40 ft (the first 30 ft cost 1 AP, 2 minus the bank, because the move went on past it: 2 AP left; the last 10 ft are the start of a new step, 20 ft of its 30 left, its 2 AP pending).
- **Not charged, and the ledger isn't touched:** forced or free movement: everything the system moves (throws, knockback, Force pushes, pulls like Get Over Here!, Palisade, Redirect, dragging a held creature), teleports, moves Foundry says came from a script or macro, the token's configuration, a paste or an undo, Dip's and Dash's free moves, and anyone moving off their own turn. Only a creature being dragged or walked with the keys on its own turn pays. AP spent on standing up, jumping, leaping, dashing or climbing doesn't bank movement. Terrain counts as it is where the move starts.
- **Setting: Movement cost in combat** — *Enforce* (default: a player's move the AP can't pay for is refused; the GM may overspend, the AP just goes to 0), *Warn only* (everything goes through), or *Off*.
- The rules are pure (`module/movement-rules.mjs`) and unit-tested with that example; the token hooks (`module/movement.mjs`) use Foundry's pending-movement distance when it has one, else the straight line on the grid, and haven't been tried in a live Foundry yet.

**0.49.2:** **Objects get Ignite and Stain stacks when they're aimed at directly.** A spell aimed at a worn or held object (weapon, armor, Foci, Shroud) now puts its Ignite / Stain stacks on the object instead of skipping them: the ones that follow its damage go by the damage the object took, and a spell with no damage (Searing Stain, Heat + Cold...) puts its stacks on the object when it lands. Each object has its own stacks (shown under the conditions as "Objects: ..."): at the end of its holder's turn it takes damage from them, cold damage aimed at it puts out its Ignite, and cleaning or putting out a condition clears it from the objects too. Stacks that land on armor because it absorbed an ordinary hit work as before (only a direct aim does this).

**0.49.1:** **Unstoppable and Pure Body multiply** (×4 with both). **Anything worn or held can be aimed at**, not just weapons and armor: the target dropdown in a weapon attack's dialog and the Cast dialog (for a damaging spell at one target) lists the creature's held weapons (not fists), worn armor, held Foci and melded Shroud. Icons, Misc items, currency and Affixes can't be aimed at. The creature's own dodge roll answers the attack, and the damage goes to the object's Durability. A spell aimed at an object only damages it: its riders (Stains, Force, Poison and so on) don't apply to the creature.

**0.49.0 — Automation pass:**
- **Martial resisting:** Strength, Dexterity and Constitution checks get *resisting* checkboxes for **Unstoppable** (while active: Advantage, stat counts twice) and **Pure Body** (stat counts twice; a target number under half your stat is an automatic success). They multiply: with both, the stat counts four times as high.
- **Terrain regions** (Muddy and Harden included): see *Terrain regions* above.
- **Larceny on damage rolls:** the caster can steal a damage roll (the target rerolls with bigger or smaller dice), and the thief can use a stolen roll for a damage roll of their own.
- **Flight and Force:** a flyer moved by Force must spend 3 RP to stabilize or begin falling, as for a big hit.
- **Currency:** the GM sets up the world's currencies in **Settings → Configure Settings → Flow State → Set up currencies**: how many there are (default 1), and for each a name, a picture, and whether it merges into another currency and how many it takes (100 copper = 1 silver; merges chain). Every character has a **Currency** section in its Misc items equipment tab with an amount per currency (they can't be deleted); amounts merge as soon as they're saved.
- **Checked and already done** (the old "not automated" notes were out of date and are gone): Thrasher/Impale grapples (the weapon's reach is the leash), Aura entrants, striking a spell mid cast, and every Mod (all 97).

**0.48.8:** **Manifests earn the whole guard payoff.** A Manifest that a Parry, Dip or Shatter takes all the damage of now also offers **Dip's free move** and, against a melee Manifest, Brawling's **Redirect** (not just the Riposte), on its card. A **Chant reroll** whose hit gets all its damage taken away offers the same Riposte, Dip move and Redirect on the reroll's card. **Combo Spell List** re-checked against the live doc: the only difference is wording (the Geomancy combo now says "refer to the below chart", the same chart as the T4 combos list), so the snapshot and `module/combos.mjs` text were updated and nothing else changed. "Take the hit" stays a GM-only card option, by design.

**0.48.7:** **Flare, Manifest Riposte, Shatter once, doc refresh.** **Heat's Flare:** each set of d4s now goes through Shatter, Brace/Dip, Wonder effects and the Ward on its own *before* the damage card is worked out (the card says "Set 1:", "Set 2:"...), so its Ignite and everything else go by what each set dealt. Before, Brace/Dip didn't touch a Flare at all. **Manifests earn Ripostes:** when a Parry, Dip or Shatter takes all the damage of a Manifest (no HP lost), the defender gets the same Riposte buttons (and "No riposte") on the Manifest's card. **Shatter strikes an attack once:** a melee miss meets it, and a Chant reroll that hits no longer meets it again (a ranged miss isn't struck, so a hit after a reroll is the one time). **Docs:** the live Martial and Magic docs were compared with the snapshots: Magic is unchanged, Martial's only parsed change is "Melee/Ranged" capitalised in Parry. Skill trees were regenerated from all three docs (`module/trees.mjs`): besides the Mental/Martial text, this brings the Magic tree text in line with the Magic doc (Hex triggers, Summon Body/Skill and Make/Animate lists are separate entries now instead of sub-bullets); nothing in the engine depends on those, and all tests pass.

**0.48.6:** **"Take the hit" is GM-only on attack cards.** Players no longer see it next to Dodge and the other defenses (a GM still can, for forced hits and targets who are unaware). It's hidden on the card for non-GMs, so nothing about the exchange itself changed.

**0.48.5 — Mental doc update:** **Freeze** no longer costs +1 AP to move: a target left at 0 Energy doesn't gain their free Energy at the start of their next turn (once; Enhanced: damage lifts it and is doubly Strengthened). **Reap** and **Pride** need the crit to be against a living target (not a Summon, Animation or object). **Hubris's** automatic crit only happens if the attack can crit (a target who took the hit without dodging, or grapple/break-free attacks, can't). **Unbound** now simply needs a crit (the "even if it cannot crit" aside is gone; the engine already required one). Doc snapshot and skill trees refreshed (only the Mental text changed in `module/trees.mjs`: the Martial/Magic snapshots in `dev/docs` had already drifted from it, so I patched just the Mental changes rather than regenerating everything).

**0.48.4:** **Brace, Dip, Shatter and parrying weapons guard against Mental Manifests too.** They work against every Melee and Ranged attack whatever its archetype, so a Manifest's damaging Modes (Corrode, Immolate, Irradiate, Freeze, Crescendo, Exact, Masterstroke) now take them into account: Slip Off/Harden's Weakened stacks on the damage roll, Shatter (rolled once per Manifest, spent across its damage instances; vs a melee Manifest it hits the attacker as it does for any weapon), then Brace/Dip's flat reduction off each damage instance, and parrying/Blocking weapons soak first. Stains, Ignite, Energy loss and the like go by what's left. Area Manifests aren't guarded (as for any Area attack); Wither and other damage that ignores defenses isn't either. A Manifest has no Riposte prompt yet when a guard takes all the damage.

**0.48.3:** **Anything that takes damage off first now shrinks the effects that go by damage dealt**, not just Wards: Brace, Dip, Shatter (and a Shatter that breaks the weapon: no damage, so no Stains), Wonder effects such as Dampen, Guard and Pacify, and Reactive Summons. An Acid spell's Stains, Energy removal, extra damage, Scorch and the like use the damage left after those (it never goes above the damage rolled: effects that add damage, like Irradiate, don't add Stains). Armor, Shroud and Shield soak don't count: Stains still land on whatever is damaged. (Manifest Modes are covered in 0.48.4.)

**0.48.2:** **Wards now settle before an attack's damage card is worked out.** When a hit lands on someone with a Nightmare Ward (or a Premonition charge), their owner is asked about negating right then (the GM's client answers for someone else's character), so the damage card shows the reduced damage and everything that goes by the damage dealt uses it: an Acid spell's Stains, Bleed, Gash, Force that needs direct damage, Twist/Impale, Riposte (no direct damage) and so on. The Ward is asked once per hit (not again when the damage lands); Let it Rip!'s repeat is a second instance and asks again. (Flare is covered in 0.48.7.)

**0.48.1:** **Max HP loss no longer lowers the Pain Threshold**: it stays a quarter of your full Max HP (Chop, Wither Enhanced and other Max HP loss only shrink Max HP and health). **Wards cut effects that go by damage dealt**: damage an Icon's Ward (or a Premonition) negates no longer counts for effects "equal to the damage dealt": Corrode's Stains, Immolate's Ignite, Freeze's Energy removal, Masterstroke's reapplied direct damage, a Summon rider's Ignite/Stain/Energy and the Poison/Hex Combos' Stains and Ignite all shrink by what was negated (ordinary spell attacks are covered in 0.48.2). The attacker's client now waits for the GM's client to finish applying such damage (including any Ward prompt) so it knows the result.

**0.47.1:** **Tenets are pop-ups now**, not buttons: Verdant Soul, Mortal Coil, Gust, Weight, Unbound, Alter, Ego and Infuse ask "Use it?" as soon as their condition is met (a Manifest hit, a crit, an ally's hit...), on the Mental user's own client. Declining leaves it unused, so it pops up again the next time the condition is met that round, until it's used (once per round). Adapt asks when you Manifest. Burden's cards now say how many stacks of Disadvantage they apply.

**0.47.0 — scaling pass:** the Skills tab now shows numbers worked out for you: a Mental Wonder's tree uses that Wonder's Power (every bolded effect in the doc, picked up by `dev/tools/build_bold.py` into `module/mental-bold.mjs`, run `npm run bold` after doc changes) and Magic trees use your Spell Power (attuned Foci's Scaling Stat, else Raw Casting); Martial numbers aren't Power-scaled (Energy costs there already show your values). The engine was brought in line with the bolded numbers: Decree, Mandate, Verdict, Fracture, Larceny and Entropy now scale with Power (±1 becomes ±Power, die size changes ×Power, 5 and 10 damage ×Power), Flourish and Waste, Pacify's die sizes, Provoke's +2 die size, Execute's 1d12 (Power d12 now, not a roll times Power) and Fabricate's Body limit (15 × Power) scale too, and a Fabricated object is a real object with that Body.

**0.46.2:** the counter grapple numbers in Below scale with Wonder Power like every other bolded number: Sink and Burden need 2 × Power or higher, Entomb 3 × Power.

**0.46.1:** a grapple made by a spell or a Manifest (Sink, Gravity's Hold and the like) no longer takes up one of your hands; only an Unarmed grapple does.
