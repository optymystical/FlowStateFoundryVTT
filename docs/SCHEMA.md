# Flow State system: data schema for content builders

This page is for anyone building content (an Adventure, a module, compendium packs) on the Flow State system (`flowstate`), so actors and items
import cleanly. The code is the authority: `module/data.mjs` holds the data models and `module/catalog.mjs` the item catalog.

- **Foundry:** built and verified for **v14**; works on v13 (`system.json`: minimum 13, verified 14). Areas are Regions (v14), not Measured Templates.
- **Compendium ids:** `docs/PACK_IDS.md` lists every system pack document's UUID. The ids never change between system versions.

## Ground rules

1. **Leave out what the system works out.** Max HP, Pain Threshold, max Energy, dice, speed, Load, Durability and Limit are all *derived*
   when an actor or item is prepared. Don't store them; store only the fields below.
2. **Items link to the catalog.** Every item has `system.base`, the key of its catalog entry. Its identity (weapon type, weight, material, potion
   kind, its text, weight in lb and price) is read from that entry. Anything that differs goes in `system.overrides` (`[{ path, value }]`). The easy
   ways to get it right:
   - copy an item from a system pack (`Compendium.flowstate.starting-gear...`, `Compendium.flowstate.consumables...`), or
   - write the identity fields (for example `weaponType`/`weight`/`material`) and leave `base` empty: the item links itself to the matching
     generated entry as it loads.
3. **A new actor fills itself in.** With no `system.hp.value`, a new creature starts at full HP and Energy. Every creature also gets an Unarmed
   weapon when it's created, unless it already has one. Its token size follows its Size.
4. **Flags** live under `flags.flowstate.*`. Writing an object flag merges into the one already there, so write the whole value to replace it.

## Actors

Types: `character` and `npc` (the same data model), plus `pile` (dropped items, objects) and `shop`.

### `character` / `npc`: `system`

| Field | Type | Notes |
| --- | --- | --- |
| `stats.str/dex/con/pon/snap/will/reach/grasp/build` | integer | The nine stats, before the Stat Bonus. Body = Str/Dex/Con, Mind = Pon/Snap/Will, Spirit = Reach/Grasp/Build. A starting character spreads 90 points. |
| `skillPoints` | integer | Total Skill Points (a character: a third of its stat points). Sets the attack die (d SP), the dodge dice (2d(SP/2)), max Energy (5 × SP) and the Stat Bonus (+1 to every stat per 5 SP). |
| `unspentStats`, `statCarry` | integer | Banked stat points. For a character these are worked out from its stats; an NPC keeps its own. |
| `trees` | object | `{ treeId: tier }`, the Background's free tiers included. See "Skill trees". |
| `abc` | object | Ancestry, Background and Culture: `{ ancestry, wasteling, background, focus, picks: { slot: treeId }, alloc: { treeId: tier }, homeland, circle, element, element2 }` (`wasteling: true`: the Wasteling core replaces the Ancestry's core) (ids from `module/abcs.mjs`: `human`, `recruit`, `shared.wanderer`, `recruit.barracks-raised`...). |
| `freeTrees` | object | `{ treeId: tier }`: what the Background gives for free (15 points). Free tiers count for requirements, not toward Skill Points. Set it with the trees; `abc-rules.mjs freeTreesFor(abc)` works it out. |
| `details` | object | Roleplay notes from the wizard: `age`, `pronouns`, `height`, `appearance`, `personality`, `goals`, `backstory` (all optional text). |
| `size` | 1–7 | Size 3 is human-sized. Tokens are ¼, ½, 1, 2 or 4 squares. 6 and 7 are rare (Bestiary creatures, NPCs only): Size 5’s numbers with one more Strengthen per Size on natural attacks; 8 and 16 squares. A character's Size comes from its Ancestry (Halfling, Goblin: 2). |
| `hp.value` | integer | Current HP, which can go negative (Overkill). Leave it out to start at full. |
| `hp.lost` | integer | Max HP lost (body removed). Usually 0. |
| `energy.value` | integer | Current Energy. Leave it out to start full. Outside combat Energy is always full, unless the scene is a tense scene. |
| `energy.bonus` | integer | An Energy potion's bonus pool. Leave it at 0. |
| `ap.value`, `rp.value` | integer | Action and Reaction Points (6 each, refilled each turn). |
| `conditions.ignite/stain/slow/haste/solid/searing/frozen/electric` | integer | Stacking conditions. Usually 0. |
| `currency` | object | `{ c0: amount, c1: amount, ... }`: positional ids of the world's currencies (see Settings). |
| `senses.sight/hearing/smell` | `"none"`, `"secondary"`, `"primary"`, `"heightened"` | Defaults: primary, primary, secondary. |
| `magical`, `supernatural` | boolean | Fully Magical (not Weakened by Arcane); Supernatural (Silver and Cold Iron are Strengthened against it). |
| `lift` | integer | Flight lift (usually 0). |
| `daysWithoutRest` | integer | Exhaustion counter (usually 0). |
| `focusedSpell` | string | Magic Theory T2's Focused Spell (a Core id). |
| `biography` | HTML | |

Derived (read-only) values worth knowing:
- `system.derived.effective[stat]` = { value, die, min }: the stat with the Stat Bonus, its check die (2 × value) and its minimum.
- `system.derived.hpMax`, `system.derived.pain` (Pain Threshold, half of max HP), `system.derived.restHeal` (the Con + Will + Build minimums).
- `system.derived.energyMax` (5 × SP), `system.derived.attackDie`, `system.derived.dodgeDie`, `system.derived.move`.
- `system.energy.max`, `system.energy.total` (own Energy plus the bonus pool), `system.skills.unspent`.

### How NPCs differ from PCs

They share one data model. The differences are in how they're made and run:
- A character is made in the New Character wizard (stat points, a third of them as Skill Points, starting gear at the world's starting Grade and
  rarity). Its prototype token is linked (`actorLink: true`), Friendly (`disposition: 1`), and owned by its player.
- An NPC is made by the GM, with any stat points, any Skill Points (or a ratio), any gear, rarity and Grade. Its token is unlinked and its
  disposition is the GM's pick (Hostile -1, Neutral 0, Friendly 1). The NPC wizard sets `flags.flowstate.npcWizard: true`.
- Disposition matters: abilities that help "a willing creature" or hurt "a foe" check it (`sides.mjs`). Neutral counts as either side.
- An NPC's `unspentStats` is its own number; a character's is worked out from its stats and Skill Points.

### Alignment, Icons, Tenets (Mental)

- **Alignment** is a flag: `flags.flowstate.alignment = { kind: "dream" | "nightmare", level: 1–4 }`. Leave it out for Neutral. Levels 3 and 4
  need Deepening (Mental Theory T3).
- An **Icon** is an item (see Items) that holds the Form and the Tenet. A creature uses the one with `attuned: true`.
- **Wonders** come from the creature's Mental trees (`mental-<wonder>-<dream|nightmare>` tiers). Their Modes need nothing stored.

### `pile` and `shop`

- `pile`: `system.description`. It holds dropped items; a pile whose first gear item has `body > 0` is a Non-Archetypal object.
- `shop`: `system.description`, `open`, `markup` (%), `buys`, `sellRate` (%), `random` (restock rules), `regrade`. Items in its inventory are
  its stock. Prices come from the catalog, else from the world's price for the item's rarity (the Shop prices setting).

Neither is a creature: they have no stats, HP or turn.

## Skill trees

`system.trees` maps tree ids to the tier reached: `{ "martial-theory": 2, "martial-bladed-weapons": 3, "generic-stealth": 1 }`.
- Tiers run 1–5. Theory and Core Tier 0 is free and always known, so don't store 0.
- A tree costs 1 Skill Point per tier, and the trees' requirements apply (a Group's trees need its Core tree, Magic tiers need Magic Theory...).
  Neither wizard lets a character break them; content written by hand should respect them too.
- Ids: `martial-theory`, `martial-<weapon>-weapons`, `martial-<weight>-armor`, `martial-unarmored`, `martial-<stat>-methods`,
  `martial-brawling-methods`, `martial-grappling-methods`; `magic-theory`, `magic-<group>` (for example `magic-heat`, `magic-grasp-arcana`);
  `mental-theory`, `mental-psion-arts`, `mental-ponderance-arts`, `mental-snappence-arts`, `mental-willpower-arts`, `mental-esoteric-arts`,
  `mental-<wonder>-<dream|nightmare>` (for example `mental-life-dream`, `mental-dark-nightmare`); `generic-<tree>` (for example
  `generic-perception`, `generic-stealth`, `generic-hauling`). The full list is `module/trees.mjs` (`TREES`, each with `id`, `archetype`, `tiers`).
- **Ancestry trees** (archetype `ancestry`): the cores `ancestry-wusonian`, `ancestry-lakeborn`, `ancestry-strigid`, `ancestry-leporid` and `ancestry-wasteling` (a Wasteling's, in place of its core), the lineage and shared trees `ancestry-commonkin`, `ancestry-bestial`, `ancestry-smallfolk`, and each Ancestry's own (`ancestry-human-tree`, `ancestry-namuh-tree`, `ancestry-dwarf-tree`, `ancestry-sworan-tree`, `ancestry-halfling-tree`, `ancestry-wildibit-tree`, `ancestry-elf-tree`, `ancestry-myrthel-tree`, `ancestry-dusken-shadow`, `ancestry-dusken-spirit`, `ancestry-dawn-elf-tree`, `ancestry-draken-elements`, `ancestry-draken-legacy`, `ancestry-orc-tree`, `ancestry-noctua-tree`, `ancestry-dirtborn`, `ancestry-firelander`, `ancestry-minotaur-tree`, `ancestry-goblin-tree`, `ancestry-smoblin-tree`). Every tree's Tier 0 is free; none requires another. They open only for a creature whose `system.abc.ancestry` is one of theirs, and can't be lowered.
- **Backgrounds** give 15 free points (`freeTrees`). Starting characters have 45 stat points (15 Skill Points) by default plus those 15.
- The Bestiary Ancestries (Wonderborn, Dreamborn, Nightmareborn...) aren't in yet: give a monster's abilities as plain items or as biography text until they are.

## Items

Every type stores `system.base` and `system.overrides` (the catalog link) and `system.description`. "Identity" fields come from the catalog entry.

| Type | Identity fields | The copy's own fields |
| --- | --- | --- |
| `weapon` | `weaponType`, `weight` (light/heavy), `material`, `magazine`, `extraTypes` | `grade`, `equipped` (held), `twoHanded`, `secondHand` (Unarmed: the other fist), `rounds` (loaded), `wear`, `size`, `natural`, `returning`, `conditions` |
| `armor` | `weight` (light/medium/heavy/titanic), `material` | `grade`, `equipped` (worn), `wear`, `size`, `natural`, `conditions` |
| `foci` | `fociType` | `grade`, `attuned`, `equipped` (held), `twoHanded`, `wear`, `size`, `natural`, `doubled`, `element`, `chosenSpell`, `declared`, `fusedInto`... |
| `shroud` | `shroudType` | `grade`, `attuned`, `wear`, `size`, `natural`, `doubled`, `element`, `declared`... |
| `affix` | `affix` | `side` (offensive/defensive), `attuned`, `natural`, `element`, `declared` |
| `icon` | `form` | `grade`, `attuned`, `natural`, `tenet` (the Tenet id, `"<wonderTreeId>:<tenet-slug>"`), `chosen` (Bane's category) |
| `gear` | `ammoType`, `body`, `density`, `use`, `potion` | `quantity`, `wear`, `size`, `charges`, `checkType` |

Notes:
- **Grade** caps how much of the scaling stat counts (10 per Grade). Natural items (`natural: true`) have no Grade: they scale with the stat
  uncapped, can't be dropped or sold, and have their creature's usual Size built in.
- **Size** (`size`, 0–5, or empty for the usual): an item is usually one Size below its user (gear two below). Size 2 is neutral.
- A creature can attune one Foci, one Shroud and one Icon at a time. Attuning takes an hour.
- **Consumables** are `gear`:
  - `use: "potion"` with `potion` = `healthLesser`, `health`, `healthGreater`, `energyLesser`, `energy` or `energyGreater`.
  - `use: "token"` is a Festival Token: `charges` holds the uses left (empty = 3) and `checkType` the roll it's set to: `perception` (Spot),
    `athletics`, `deception`, `persuasion`, `stealth`, `initiative`, `fear` (resisting Fear), `con`, `str` or `attack`. Leave `checkType`
    empty to let the player pick when they first use it.

### Generated catalog keys

`weapon.<type>.<light|heavy>.<material>`, `weapon.unarmed`, `weapon.improvised.<weight>`, `armor.<weight>.<material>`, `foci.<type>`,
`shroud.<type>`, `icon.<form>`, `affix.<affix>`, `ammo.<rangedType>`, `potion.<potion>`, `gear.festivalToken`, `gear.misc`. A world's own entries
are `named.<slug>`. The GM's Forge window (the item catalog) lists them all.

## Consumable rules (system)

- **Health potions** restore ½, 1 or 2 × the health an 8 hour rest restores (up to max HP).
- **Energy potions** put ½, 1 or 2 × max Energy into the bonus pool (`energy.bonus`). The pool can take you past your maximum, is spent before
  your own Energy, and lasts 1 minute (10 rounds) or until used. The token's Energy bar and the sheet show it.
- **The limit:** one potion per rest (Health and Energy alike), tracked by `flags.flowstate.potionUsed` and cleared by an 8 hour rest. The GM can
  override it.
- **Using one:** 1 AP in combat to drink, or to give one to a creature within your reach (the giver pays; the drinker uses up their potion for the
  rest). A dead creature can't drink, and an afraid one can't gain Energy.
- **Prices**, in the world's first currency: Lesser 200, regular 500, Greater 1,200. The GM can change them in World data → Potions.
- **Festival Token:** each use arms Advantage on the holder's next roll of its kind (`flags.flowstate.edge`, a list). At 0 uses it stays as a
  keepsake.

## Statuses the content can use

Set them with `actor.toggleStatusEffect(id, { active: true })`. The ids: `dead`, `unconscious`, `prone`, `falling`, `crouch`, `stealth`,
`halfStealth`, `fullStealth`, `fear`, `surprised`, `grappled`, `flying`, `infected`, plus the tree stances (`psychedUp`, `berserk`, `limber`...).
- **Fear** (`fear`): no Energy gained from any source while afraid (regen included; Fight Through It and Fearless soften it). Resist Fear is an
  Action List row.
- **Infected** (`infected`): a marker that lasts a day of world time and is cleared by any heat damage. How it spreads is the GM's.
- **Advantage and Disadvantage** are stacks: they add up and cancel. Every roll dialog has a stacks field when the world allows custom stacks.

## Settings and flags an Adventure may set

| What | How |
| --- | --- |
| Currencies | World setting `flowstate.currencies`: a list of `{ id: "c0", name, img, mergeInto, mergeAmount, start }`. Ids are positional (`c0`, `c1`...). `start` is what a character made in the New Character wizard starts with. Example, a one-currency world of Shards with a 100 starting purse: `game.settings.set("flowstate", "currencies", [{ id: "c0", name: "Shards", img: "icons/commodities/gems/gem-shattered-violet.webp", mergeInto: "", mergeAmount: 0, start: 100 }])`. Actors written by hand set `system.currency.c0` themselves. |
| Starting equipment | `flowstate.startingStatPoints` (45, plus the Background's 15 free points), `startingItems` (4 picks), `startingGrade` (10), `startingMaxRarity` (`uncommon`), `startingMultiType`. For a Common Grade 3 start: `startingGrade` 3, `startingMaxRarity` `"common"`. |
| Tense scene | `flowstate.tenseScene` (boolean): Energy is spent and regained outside combat as in combat. |
| Shop prices | The Shop prices setting (GM menu): price per rarity and per Grade above 1. |
| World data | World setting `flowstate.worldData`: the GM's changes to the system's tables (materials, Foci, potions...). It's easiest to leave alone, or to import it through the World data window. |
| Actor flags | `flags.flowstate.alignment` (see Mental); `flags.flowstate.biomes` (Acclimated: biome names, Wusonian), `flags.flowstate.territory` (Territorial: a scene uuid), `flags.flowstate.gland2` (Elemental Diversity's second element). The system writes the rest itself; don't preset them. |
| Environments | Scene flag `flags.flowstate.environment` = `{ type: "lush" \| "fertile" \| "extreme" \| "", biome: "desert", hazard: true, hazardName: "a sandstorm" }` (optional, GM-managed). Regions with `flags.flowstate.shelter: true` are Shelter. |

## System packs

| Pack | Contents |
| --- | --- |
| `flowstate.consumables` | The six potions and one Festival Token (unset). |
| `flowstate.starting-gear` | Every Common catalog entry at Grade 3, foldered by type: weapons, armor, Foci, Shrouds, Icons, Affixes, and 20 of each ammunition. Unarmed, Improvised and the plain Misc item are left out (everyone has them). |

The UUIDs are in `docs/PACK_IDS.md`. Packs are built from the catalog with `cd dev && npm run packs`.
