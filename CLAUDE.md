# Flow State — Foundry VTT system

Flow State is Christopher Caplinger's TTRPG (setting-universal, digital-only). This repo is its Foundry VTT game system
(id `flowstate`, built for v14, compatible with v13). The repo root **is** the system folder: on the user's PC it lives at
`C:\Users\optym\AppData\Local\FoundryVTT\Data\systems\flowstate`. After a change, the user refreshes Foundry to test.

The user tests in Foundry and reports issues in plain language; answer questions in the chat, ask when a rule is
genuinely ambiguous (they prefer being asked), and state judgment calls you made.

## Source of truth: the Google Docs

The system must stay faithful to the design docs in the user's Google Drive. Fetch the live doc (Drive connector,
export as markdown) whenever a rule matters; snapshots in `dev/docs/` go stale.

| Doc | Status | Drive file ID |
| --- | --- | --- |
| Flow State - Rules | authoritative | `101-TbMt8Ttc2GOZdZfkNGrY_KWppPtIzOUui4mEWU0A` |
| Flow State - Martial Stage 1 | authoritative | `1w5x2zNdUCZMatirMQ-qsNga7XijfzEuzQ7Ad_UgiWbw` |
| Flow State - Equipment | authoritative (Mental Equipment section in flux) | `1bjinhIrPGJr0Ss4M9fjlCRSZrteX5r9yjsSuhYkMuag` |
| Flow State - Magic Stage 1 | authoritative | `10yfXGyX5-dTUYCJzsGw1DOTd7qpGaeD5ZlNF7mMbWI8` |
| Combo Spell List (linked from Magic Theory) | authoritative | `1lyNQtEPZWuIpjxqvD3BIa_ZPFD25iTxi3YMp78hVAGY` |
| Mental Rework Test Ground | in-dev: the source for Mental (Mental Stage 1 holds the old system); snapshot in `dev/docs/mental.md` | `1vyo3biYzh4smTOMmNM5OK7uqLXxKlrse6M-zHbnC0YI` |

If an ID read fails, search by exact title. "[Discipline] Rework Test Ground" docs are scratchpads; "Stage 1" docs are
the stable versions. When the user says "I updated the doc", diff the live doc against `dev/docs/*.md`, summarize
the changes, implement them, then refresh the snapshot.

Status: all Martial trees (Theory + every weapon/armor/method tree, T0–T5) are automated. Magic: Foci, Shrouds and
Affixes (separately attuned items) are in (Shroud side and Foci side, including Deck Foci). Magic spells: the casting framework and
all five Magic groups (T1: Magic Theory, Slashing, Piercing, Crushing, Protection Arcana, Gravity; T2: Reach Arcana, Heat,
Cold, Radiation, Acid; T3: Grasp Arcana, Venomancy, Charm, Witchery; T4: Build Arcana, Summoning, Creation, Animation; T5:
Restoration Arcana, Geomancy, Illusion, Arcanomancy, with all their Combos) are automated; "tier" in Magic means the group of
trees a Magic Theory tier unlocks. Muddy/Harden place terrain regions (rough/difficult/cleared); only Mixed Animations are left to the GM.
Mental is in progress (built from the Mental Rework Test Ground): the framework is in (Manifest, Alignment, Icons and Wards, Concentration, Trance, Willpower, Ponderance, Snappence and Psion Arts) and the Wonders' Modes are being added Wonder by Wonder (all twenty written Wonders are in) and Esoteric Arts (Omens, Mental T5) is in. Mental Theory, Forms/Wards and Willpower Arts are complete. Ancestries are not yet implemented.

## Layout

- `system.json`, `lang/en.json`, `styles/flowstate.css`, `templates/*.hbs` — standard Foundry system files.
- `module/flowstate.mjs` — entry point: document classes (`FlowStateActor`, `FlowStateCombat` with turn start/end),
  settings, status effects, sheet registration, and most `Hooks` (chat-card button wiring and decoration,
  preCreate/preUpdate guards for hands, armor, attunement, ammo caps, GM-only identity edits).
- `module/actions.mjs` — the game engine: attacks and the exchange flow, defenses, damage/soak (`damageOutcome`,
  `applyDamage`), all tree abilities, movement/Force, grapples, Shrouds, ammo/reloads, GM relay (`GM_ACTIONS`).
- `module/abilities.mjs` — pure helpers: "can this actor use tree X tier N with this item", Energy cost tables.
- `module/martial.mjs` — weapon/armor tables, materials, tags, `weaponProfile`/`armorProfile`, Limit math.
- `module/magic.mjs` — Foci/Shroud/Affix tables and profiles. `module/affix-migration.mjs` converts old per-Foci/Shroud Affix lists into Affix items.
- `module/spells.mjs` — pure spell framework: the Core/Mod catalog (parsed from `trees.mjs`), known spells, Combo Threshold, casting options, `planCast`, Threshold/Energy math.
- `module/spellfx.mjs` — what each automated Core/Combo/Mod does (Tier 1 spells, Slashing/Piercing Mods); hooks live in `actions.mjs` (`spellHit`, `spellForce`, Shield soak, Bleed/Gash) and `casting.mjs` (`resolveSpell`).
- `module/elemental.mjs` — Tier 2 spell effects (Ignite/Stain stacks, Energy removal, chains, Brand, Freeze, per-turn counters); registers its hooks into `actions.mjs` (`registerElemental`).
- `module/afflictions.mjs` — Tier 3 spell effects (Poison coats and ticks, Charm, Hex triggers, the Combos); registers into `actions.mjs` (`registerAfflictions`).
- `module/foci.mjs` — Foci effects: Affix hooks for spells, per-turn Foci state, Deck Foci (registers into `actions.mjs` via `registerFoci`).
- `module/arcana.mjs` — Tier 5: Restore/Painless/Resuscitate, Shift/Toss/Mend, Mirage, Delay support; registers into `actions.mjs` (`registerArcana`).
- `module/conjure.mjs` + `conjure-rules.mjs` — Tier 4: Summons/Animations as temporary NPC actors, Made items, riders, Build Arcana helpers (rules math is pure).
- `module/mental-rules.mjs` (pure: Wonders and Modes parsed from the Mental trees, Wonder Power, Manifest costs, Alignment, Icon Forms and their numbers) + `module/mental.mjs` (Manifest dialog and attack, Alignment, attuning Icons, Wards, Nightmare Ward negation, Psion Arts; registers into `actions.mjs` via `registerMental`).
- `module/concentration.mjs` — Mental Concentration: cap, damage check, Composure/Daydreaming, ending (flag `concentrating`; effects carry `spellEffect.concentration`). `module/ponderance.mjs` — Trance and the Ponderance Arts (Premeditate, Mantra); registers into `wonders.mjs`/`mental.mjs`. `module/snappence.mjs` — the Snappence Arts (Reflex offers from `performAttack` via `mentalHook.reflex`, Impulse via `impulseHook`, Fixation, Afterimage).
- `module/wonders.mjs` — Mental Wonders: Mode/ability/Tenet effects (`MODES` registry), charges, pending effects; registers into `mental.mjs`/`actions.mjs`.
- `module/wonders-c.mjs` — Light and Dark (Illuminate/Eclipse and their die effects, Totality, Umbral Strike, Dispersion, Corona/Nightfall); `mental.mjs` calls its `attackStart`, `attackDieAgainst` and `dodgeDieAgainst` through `registerMental`, and `DAMAGE_PROVIDERS` (wonders.mjs) feeds the damage-adjust pipeline.
- `module/wonders-d.mjs` — Earth and Sea (Accretion encasements and their soak, Adamant, Reinforce/Bedrock, Ejecta; Undertow, Surge, Current, Riptide, Shoal, Drown); `damageOutcome` asks it for `encasements`, and every system token move reports forced movement (`forcedMove`) through `registerMental`.
- `module/wonders-e.mjs` — Fortune (Fortune's Bands in `fortuneResolve`, which `mental.mjs` calls for a Fortune Manifest; Wager, Windfall, Providence, Rig, Parlay/Double Down, and the Fortune Table, whose rows come from the doc's table in `trees.mjs`).
- `module/wonders-g.mjs` — Growth and Stagnation (Growth stacks spent as an action pays its first AP/RP via `pointsSpent`, or armed from the Action List; Thrift/Feed/Graft/Flourish/Pierce/Uproot hook `spendEnergy`, `giveStacks`/`feedExtra`, `putSpellEffect`, `rollExchangeDamage`, `anyHit`; Mire's stacks come from `actionSpent` at the pay sites, Wane through `attackDieAgainst`).
- `module/esoteric.mjs` — Esoteric Arts: Omens (Seed/Rend make an NPC through `GM_ACTIONS.omenCreate`; `omenState` changes it: bound, at your side, free, hostile, Unbind; flags `flowstate.omen`), Bond via `concentration.END_HOOKS`, Pole-Bound in `attackStart`, Channel as a Manifest choice, Kinship through `kinshipHook` (`tenetsOf`/`tenetFor` in wonders.mjs: check Tenets with these, not `tenetOf(...).id ===`).
- `module/wonders-f.mjs` — Ruin (Jinxes and Ruin's Bands: `attackRolled` resolves them on the Jinxed creature's next attack roll from `startExchange`; Gild, Forfeit, Reversal, Calamity, Doom and the Ruin Table).
- `module/wonders-b.mjs` — Destruction, Peace, War, Adaptation, Perfection and the damage-adjust pipeline (`adjust`); `module/forging.mjs` — Creation (items via the Create button, Alter). Both register into `wonders.mjs` (`MODES`, `ACTS`, the provider lists).
- `module/sides.mjs` — pure: `opposed/allied/mayHelp/mayHarm` by token disposition (Friendly vs Hostile; Neutral/tokenless go either way). Every automatic offer that helps "a willing creature" (Block, Shield Toss, Quartz, Adjust, Dampen, Infuse) or hurts a foe (Empower) must check it.
- `module/automation-rules.mjs` (pure) — automation settings (flag `automation`: Auto-Dodge and its reactions, Auto-Limber, keep-up abilities), remembered dialog values (flag `remember`), splitting a planned follow-up off the attack dialog. The runtime is in actions.mjs (`autoDefend`, `autoLimber`, `runAutoFollowup`, `keepUp`, `optionsDialog`'s `remember`/`preset`, `withAutoAnswers`) and the Reaction List's Automation group (sheets.mjs).
- `module/reactions.mjs` (pure) — the catalog of popups and offer cards a player can switch off (flag `autoDecline`, shown in the sheet's Reaction List tab via `buildReactionList`, and in the Token Action HUD). Every `askFor` spec for a reaction carries `react: "<key>"`; add the key to `REACTIONS` when adding a new popup. `module/ask.mjs` — `askFor`/`runOnOwner`/`answeringUser`: asks a character's player on their own client (charges.mjs re-exports it).
- `module/relay-guard.mjs` (pure) — `relayAllowed`: what the socket GM relay accepts. A new `GM_ACTIONS` handler that writes data needs a check here (field allow-list) or players could write anything.
- `module/distance.mjs` (pure) — border/centre distance on square, hex and gridless grids (`tokenDistance` in `actions.mjs` wraps it). `module/placement.mjs` (pure) — spots beside a token on hex/gridless scenes (`landingPosition`, `adjacentSpot`, `besideTokenPosition` in `actions.mjs` use it; square grids keep their cell arithmetic). `snapTopLeft` is the one place that snaps a token position.
- `module/charges.mjs` — Order/Chaos charges live on rolls: asks the charge's caster (socket) at attack/dodge/other/damage rolls and after an attack resolves (Verdict, Entropy, Balance).
- `module/areas.mjs` — Area spells: shapes, pure geometry, template placement, Emplace card.
- `module/casting.mjs` — the Cast Spell dialog, paying AP/RP/Energy, the cast card, Rituals. Design decisions are in `dev/MAGIC_DESIGN.md`.
- `module/movement-rules.mjs` (pure) + `module/movement.mjs`: movement cost in combat (a step is paid only when you move past it or an action settles it; forced/free moves are excluded). `module/terrain.mjs`: terrain regions (scene-control buttons, Muddy/Harden). `module/currency-rules.mjs` + `module/currency.mjs`: the world's currency list and the sheet section. `module/tree-scale.mjs`: scaled numbers in skill-tree text.
- `module/store.mjs` (pure) — the world data store: every table of game data is a collection; the system's values are the defaults and a world layers patches, new entries and hidden marks on top (`applyWorldData` resets and re-layers the live tables in place). `module/store-catalog.mjs` (pure) registers the collections (what's addable, required fields, rebuild hooks). `module/world-data.mjs` — the `worldData` world setting (applied first thing in init, and on change on every client) and the GM's World data window (export/import/clear).
- `module/catalog.mjs` (pure) — the item catalog: generated entries for every valid combination (`generateCatalog`, the store's derived `items` collection) plus named ones; `keyFor`/`linkFor` link an item to its entry, `identityFor` reads an item's identity (entry + `system.overrides`), `itemData(key, {grade})` makes a copy. Items store `system.base` + `system.overrides`; their identity fields are a fallback copy (`migrateData` links old items as they load, `prepareBaseData` reads the entry). `module/items.mjs` — giving entries (`giveEntry`), re-linking on identity edits (preUpdateItem), the one-time sidebar conversion. `module/catalog-app.mjs` — the Forge window (browse/give/drag, the GM's entry editor).
- `module/codex.mjs` (pure) — the Codex: every element as a page (`registerSection(id, build)`; ids from `codexId`, e.g. `entry:<treeId>:<slug>` = the spell/Mode ids), the name lookup (`idForName`, `findPage`), search and `renderPage`; rebuilt when the store's `dataVersion` changes. `module/codex-md.mjs` (pure) — the docs' Markdown → safe HTML. `module/rules-text.mjs` — GENERATED from `dev/docs/rules.md` + `equip.md` (`npm run rules`). `module/codex-app.mjs` — the window, the global `[data-codex]` click handler, the `@Codex[...]` enricher, `/codex`, chat card title links.
- `module/shop-rules.mjs` (pure) — shop prices (`unitPrice`/`buyPrice`/`sellPrice`), paying in linked currencies (`pay`/`earn`/`formatPrice`), random stock (`pickStock`). `module/shop.mjs` — the Shop actor's sheet, `GM_ACTIONS.shopBuy`/`shopSell` (relayed; they get the sender's id to check ownership), restock, the Shop prices setting. `module/kinds.mjs` (pure) — `notCreature(actor)`: piles and shops aren't creatures; use it, not `type === "pile"`, wherever something must be a creature.
- `module/html.mjs` — shared HTML helpers: `esc`, `field`, `select`, `formValues`/`formValuesNumeric`, `DialogV2` (puts the `fs-dialog` class on every system dialog: use it, not Foundry's DialogV2 directly), `dialogHead` (a section heading in a dialog). Import these; don't define local copies. Anything a player can name (actors, items) goes through `esc` before it's put into HTML.
- `module/data.mjs` — TypeDataModels (actor, weapon, armor, foci, shroud, gear, pile) and derived data.
- `module/rules.mjs` — core rules math (stats, sizes, stacks, rolls, Force). `skills.mjs` + `trees.mjs` — skill trees
  (`trees.mjs` is GENERATED from the docs; don't hand-edit).
- `module/sheets.mjs` — actor/item sheets, the Action List (`buildActionList`), `runActionRow`.
- `module/wizard.mjs` + `creation.mjs` — New Character wizard (GM creates the actor via the relay).
- `module/integrations.mjs` — Carousel Combat Tracker defaults and a built-in Token Action HUD system integration.
- `README.md` — short front page. `CHANGELOG.md` — one short entry per version (newest first). `dev/AUTOMATION.md` — every automated rule and judgment call in detail; update it when a rule changes.
- `dev/` — not loaded by Foundry: `tests/` (Node harnesses with Foundry mocks), `run-tests.mjs`, `tools/build_trees.py`,
  `docs/` (doc snapshots), `live/` (the live-test kit for the Test World), `sim/` (the combat sim: `roster.mjs` holds the party archetypes,
  monster groups and loadout rotations of a pass; `sim.mjs` runs them in the Test World with an AI through the real actions and chat cards,
  answering dialogs headlessly; results are saved to `sim/results/<pass>.json` and `node dev/sim/report.mjs` tabulates them).

## Key mechanics in code

- **Exchange flow (chat cards):** attack card (`flags.flowstate.attack {attacker, opts, targets}`) → defender responds →
  defense card (`flags.flowstate.defense`) → damage card (`flags.flowstate.damage`). Follow-ups get their own card once
  the exchange is resolved. Every opts key that must survive on the card has to be listed in `EXCHANGE_KEYS`.
  Rows tagged `data-role`/`data-owner` show buttons only to the owner; a new chat message re-renders the card it
  answers (see the `createChatMessage` hook's ref chain — add new flag names there).
- **GM relay:** players can't update others' documents; use `requestGM(action, payload)` with a handler in `GM_ACTIONS` and a field check in `relay-guard.mjs`. The GM client runs relayed requests one at a time per creature (`makeQueue`); a handler must not `await` another relayed request for the same creature, or it waits on itself.
- **Soak order:** parrying weapons → Shroud(s) → armor. Objects absorb at most their remaining Durability.
- **Distance:** `tokenDistance` measures between token borders (touching = 0 ft).
- **Weapon trees:** `abilities.weaponFits` — a weapon's main type, plus its extra types with Weapon Master (MT T5).

## Working conventions

- Run the tests after every change: `cd dev && npm install && npm test` (or `node run-tests.mjs t2 brawling` for a
  subset). Add or update a harness for new behavior. Harnesses use `seq = [...]` to script dice and `dialog = () => ({...})`
  to answer popups.
- `node --check module/<file>.mjs` catches syntax errors fast. `cd dev && npm run lint` (ESLint, config in `eslint.config.mjs`) catches undefined names and unused code; `npm run check` runs lint and the tests, and is what CI (`.github/workflows/ci.yml`) runs on every push. Keep both clean.
- Bump `system.json` `version` (patch for fixes, minor for features) and add a short `CHANGELOG.md` entry with each change (and update `dev/AUTOMATION.md` if a rule or judgment call changed).
- Regenerate skill trees after Martial/Magic doc changes: export the docs to `dev/docs/martial.md` and `magic.md`,
  then `cd dev && npm run trees` (Mental too: export the Mental Rework Test Ground to `dev/docs/mental.md`; the generator leaves out trees with no entries yet). After Combo Spell List changes: export it to `dev/docs/combos.md`, then `npm run combos`
  (generates `module/combos.mjs`; don't hand-edit).
- **Link new things into the Codex:** a new table or system gets pages (a section in `codex.mjs`, or `registerSection` from its module: the A.B.C.s will add theirs), and UI that shows a rule, ability, tag, material or status links to its page with `data-codex="<id>"` (or `codexLink(...)`). `codex-test.mjs` fails on any dead link. After a Rules or Equipment doc update, re-export to `dev/docs/` and run `npm run rules`.
- **New items come from the catalog:** make them with `itemData(key, { grade, system })` (or with the identity fields, which `migrateData` links). A new item identity field goes in `IDENTITY` (catalog.mjs) and the type's schema; a new item type needs an `ITEM_TYPES` entry, generated entries, `KEY_FIELDS` and `migrateData`/`prepareBaseData` in data.mjs. Code reading an item's identity (`item.system.material`...) gets the entry's value; never write identity straight to a copy's source expecting it to stick past the entry (the preUpdateItem hook turns it into an override).
- **Flags merge:** writing an object flag (or `flags.flowstate.x` in an update) merges into the object already there, so a key you leave out survives. Write the whole value (or set the key to an empty value) when something must be cleared.
- **New game data goes in the store:** a new table of game data (equipment, statuses, anything a GM might want to change or the Codex should show) is defined in `store-catalog.mjs`. Never copy a table at load (`const X = Object.keys(TABLE)` at module scope): read it at call time, or keep the derived value in a list rebuilt by the collection's `rebuild`. Entries may carry `hidden: true` (pickers should leave those out).
- Keep Foundry globals out of `store.mjs`, `store-catalog.mjs`, `abilities.mjs`, `martial.mjs`, `magic.mjs`, `rules.mjs`, `creation.mjs` (they're unit-tested).
- Commit with clear messages; the user may test from `main`.
- The user has granted standing permission to open pull requests for this project (done through the GitHub MCP tools, not the `gh` CLI). Open a PR when a branch has no open one; pushing to a branch with an open PR just updates it.

## Settled rulings (don't re-ask)

- Blocking for an ally is free and gives the blocker no Riposte; Brace on armor gets no Riposte.
- Shatter: Heavy Unarmed damage to the incoming attack, no Solitary; works on melee misses; vs projectiles lowers the
  damage; if it breaks the weapon the attack deals no damage.
- Knockback is additive: base 5×, +5× Knockback+, +5× two-handed. Weapon tags ignore Strengthened/Weakened, except Smashing (Weighted T4, start of turn): each net Strengthened stack adds half the base Knockback (2.5×); Weakened never takes it below the baseline.
- Fast follow-ups only come from Fast attacks (Fast weapon or Light Unarmed); a Light grapple opening the chain still
  gets the other fist's Fast follow-up; a Heavy grapple offers only Solitary. Each Unarmed grapple occupies a fist.
- Forced re-rolls (Dash, Shift, Close Quarters, Distracting Fire) keep the lower result. Speedy (Unarmored T3) applies
  Dash's Disadvantage automatically. Dash reaction costs Energy only; the move after costs 1 RP.
- Shroud scaling: base × floor(Build capped at Grade×10 ÷ 10), min ×1 (the table's Durability and Limit were doubled after the Magic vs Martial tank bench); Foci: base × Grade. Shroud soaks before armor.
  Affixes are items of their own (type `affix`: key + Offensive/Defensive form + attuned). Offensive ones work through the attuned Foci and Raw Casting, Defensive ones through the Shroud; the actor feeds them into the Foci/Shroud profiles (`attunedAffixKeys` in `magic.mjs`), so effect code still reads `profile.affixes`. Attuning takes an hour (not in combat).
- Ammo: X shots per reload (weapon setting, default 1; a Light Assault 2, and it rolls d12s) using X ammo; 1 shot per attack; max 100 per type.
- The starting rarity limit covers materials, Affixes, Icon Forms and named items alike.
- Shops: an item costs its catalog price, else the world's price for its rarity, plus a flat amount per Grade above 1 (not a multiplier). Shops buy at a sell rate (default 50%). Regrading (per shop: kinds, rarities, a surcharge %, a highest Grade; nothing by default) only raises Grades and costs the per-Grade price per Grade gained plus the surcharge.
- Token size: Size 1–5 = ¼, ½, 1, 2, 4 squares. Downed creatures are deleted from the combat tracker. A creature's height is the top of its Size's space (1, 3, 5, 10, 20 ft): downward Force (into the ground, a damaging fall) of at least that knocks it prone.
- Speed: base = Size maximum less additive percentages (armor 20/40/60/80, attuned Affixes 20 each, less the Free Affixes of the attuned Foci and Shroud, Alignment 20 per point), rounded down to 5 ft steps, minimum 5 ft (Rules doc); Quicken doubles the result. Affix allowance = the sum of the attuned Foci and Shroud's Free Affixes (no free one for everyone; can be -1). Snapshots of the Rules doc are in `dev/docs/rules.md`.
- Strengthened/Weakened stacks, from any source (a crit's two, Alignment, an Area spread, Adapt, a Mod, anything on the caster), scale the **bolded** numbers of what they carry, not only damage: Mental Modes (`bold(stacks, n)` in `mental-rules.mjs`; effects that last, Fester, charges and Tenet acts keep `bstacks`; Vice, Quicksand and Momentum are responses that use fresh Power and no stacks) and Magic spell hits (`stackBonus` in `spellHit`/`elemental.mjs`). Spells with no roll use `castStacks(actor, plan)`. Martial has no bolded numbers and is unchanged. Alignment no longer scales Modes (it shapes the Form's Ward only).
- Mental Alignment is Dream/Nightmare 1-4 (Neutral 0; 3-4 need Deepening, Mental T3), set with a 1 hour activity, 20% speed a point, 1 AP a turn per point past 2. It only changes your own type's Form Ward: 1 Advantage, 2 Strengthened bolded effect, 3 half stealth, 4 hits regardless (roll decides a crit). Fluidity (T4) swaps the type for half Skill Points × the Alignment number in Energy (0 from Neutral). No Equilibrium, no Tenet doubling. Reverie needs Dream 2 (Enhanced growth: 4); Zealot negates 6 at Nightmare 2+.
- Design intent (from the Martial balance review; don't flag these as problems): a two-handed weapon is meant to be just under the power of two one-handed weapons (dual wielding is more versatile). Heavy armor is the step into the tank class; Medium is the middling area well below it. Light Reach is a defensive denial weapon; Light Blast is a secondary option for Dexterity users against groups. Assault's Solitary is fine as is; a Light Assault reloads every 2 shots (so a lone one gets its Solitary shot). Lock Down is the intended way to lock down a single target: a lone boss is meant to be beatable; lair events and minions balance bosses at the table (don't sim them).
- "Take the hit" (declining to dodge) is a GM bug-fixing tool, not part of play: creatures always dodge, even an ally's helpful spell (Shield, Repulsion, Lighten), so a buff can miss. The sim and Auto-Dodge always dodge.
- Pain Threshold = half of max HP (Rules doc; was a quarter). Fights were 6–8 rounds; this aims at about 4–5.
- Heavy armor has two stealth Disadvantages. Heavy armor shutting out Light weapons (Limit per hit) is intended: Heavy armor is for tanks over many turns.
- An Area attack with Pepper: every target it hits takes all the Pepper shots.
- Quickload (Rapid/Assault T1) can replace a free follow-up: the follow-up is forgone and the gun reloads at no cost.
- A weapon rolls one die per full 10 of its scaling stat: under 10 it rolls no dice (no minimum of 1, unlike armor).
- An Area (spell, Manifest, Expansion) leaves the caster out of its targets unless they tick Include yourself in the shape picker.
- A movement step costs the worst terrain it passes through (priced along the path; leaving the terrain doesn't lower it).
- Dream Form Wards (the AP ones) can't be Burst.
- Natural items (weapon, armor, Foci, Shroud, Affix, Icon: `system.natural`) have no Grade: they scale with the stat uncapped, Grade-based numbers count one per 10 of the stat; they can't be dropped, sold or regraded.
- Omens (Esoteric Arts): the player runs a bound Omen (or one at their side after a lost Concentration); a free or hostile one is the GM's. "Opposite pole" is the paired Wonder (Life ↔ Death...), for Bond, anger and Pole-Bound's Strengthened attacks. An Omen is its own natural Icon. Rend costs 2 AP. A character can have several Omens, up to their Concentration cap (`omensOf`).
- Wonders and `mental.mjs` don't import each other: `wonders.mjs` exports `mental` and `setMental` (mental.mjs registers itself on load); Mental modules reach it as `import { mental } from "./wonders.mjs"`. Keep the import graph acyclic (the only self-reference is mental.mjs importing itself for that).
- Weaving joins the hit: one attack roll, the woven spell's damage keeps its own type and shares one Limit with the weapon's part; its riders apply on a hit; main attack only (no follow-ups); a Bash that breaks through an object lets the whole hit through it, the woven part included. Fused Foci (1 hour Ritual, no ongoing cost): the weapon's hand holds both; the Foci's Durability and Limit add to the weapon's (each its own Grade; intended buff), its damage-taking Affixes protect the weapon; can't be dropped/disarmed while attuned; any weapon (no one-handed requirement).
- Gust, Momentum and the Fortune Table's 51–53 are normal Force (half the target's max HP comes off before it turns into feet); Herald takes off half the target's current HP instead (its own text).
- Dragon Lash doubles total Knockback (a multiplier, not +5×): settled, don't ask again.
- Sea distances are fixed (the doc doesn't bold them): Surge, Current and Riptide move up to 5 ft, Drown needs 10 ft of forced movement. Riptide's extra 1d6 Force damage is bolded and scales. Enhanced Accretion: only damage of the chosen category is Weakened against it (it still takes Physical and Elemental). Reinforce/Bedrock are a popup each time an Accretion is hit. Each caster's Accretions meld only with their own. Fortune's Bands are the attack roll / the attack die's max. Fortune Table 98–100's "Stage 1 negative condition" is any one negative condition. Rig's table numbers scale with the Tenet multiplier. Table 7–11's "no Advantage" covers all their rolls. Ruin's Reversal flips only the attack: the Jinxes resolve on the original roll. Chant on a Fortune Manifest that missed under one half is offered before the self hit; a reroll that hits lands by its own band, otherwise the self hit applies once.
- Arcane damage is Weakened against anything not fully Magical and passes through armor; Shrouds block it. Strike is a Ranged spell of 2d8 arcane (balance pass: it was Targeted 2d12). Build Arcana's Reactive also works on your own attuned Shroud. Summons are fully Magical (data.mjs sets `magical` from the summon flag); Animations aren't. Neither is living: use `isLiving` (kinds.mjs) wherever a rule needs a living target.
- Animation Size (Animate, Form + Animate, Make + Animate) comes from the pile's Body but is capped by the Threshold like Form: 3 needs 5, 4 needs 10, no Size 5 (`animationSize(body, gross)`).
- Restore's "since the start of your last turn": cast on your own turn it's the start of your previous turn (not before the combat started); between your turns, your latest turn. What Restore already healed counts against the window (`restoreSince`/`restorable` in arcana.mjs). Renewal and the Fortune Table's heals (`heal` in wonders.mjs) use the same window and log.
- Alignment's Ward effects also apply to the Warden/Riposte reflect roll. Neutral tokens count as either side for ally/foe checks. Spirit Sense (Grasp Arcana T4) only stops a Targeted spell's own automatic half stealth against that target; a GM-set Half/Full Stealth status still applies.
