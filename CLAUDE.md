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
Affixes are in (Shroud side and Foci side, including Deck Foci). Magic spells: the casting framework and
all five Magic groups (T1: Magic Theory, Slashing, Piercing, Crushing, Protection Arcana, Gravity; T2: Reach Arcana, Heat,
Cold, Radiation, Acid; T3: Grasp Arcana, Venomancy, Charm, Witchery; T4: Build Arcana, Summoning, Creation, Animation; T5:
Restoration Arcana, Geomancy, Illusion, Arcanomancy, with all their Combos) are automated; "tier" in Magic means the group of
trees a Magic Theory tier unlocks. Only terrain effects (Muddy/Harden) and Mixed Animations are left to the GM.
Mental is in progress (built from the Mental Rework Test Ground): the framework is in (Manifest, Alignment, Icons and Wards, Willpower Arts, Psion Arts) and the Wonders' Modes are being added Wonder by Wonder. Ancestries are not yet implemented.

## Layout

- `system.json`, `lang/en.json`, `styles/flowstate.css`, `templates/*.hbs` — standard Foundry system files.
- `module/flowstate.mjs` — entry point: document classes (`FlowStateActor`, `FlowStateCombat` with turn start/end),
  settings, status effects, sheet registration, and most `Hooks` (chat-card button wiring and decoration,
  preCreate/preUpdate guards for hands, armor, attunement, ammo caps, GM-only identity edits).
- `module/actions.mjs` — the game engine: attacks and the exchange flow, defenses, damage/soak (`damageOutcome`,
  `applyDamage`), all tree abilities, movement/Force, grapples, Shrouds, ammo/reloads, GM relay (`GM_ACTIONS`).
- `module/abilities.mjs` — pure helpers: "can this actor use tree X tier N with this item", Energy cost tables.
- `module/martial.mjs` — weapon/armor tables, materials, tags, `weaponProfile`/`armorProfile`, Limit math.
- `module/magic.mjs` — Foci/Shroud/Affix tables and profiles.
- `module/spells.mjs` — pure spell framework: the Core/Mod catalog (parsed from `trees.mjs`), known spells, Combo Threshold, casting options, `planCast`, Threshold/Energy math.
- `module/spellfx.mjs` — what each automated Core/Combo/Mod does (Tier 1 spells, Slashing/Piercing Mods); hooks live in `actions.mjs` (`spellHit`, `spellForce`, Shield soak, Bleed/Gash) and `casting.mjs` (`resolveSpell`).
- `module/elemental.mjs` — Tier 2 spell effects (Ignite/Stain stacks, Energy removal, chains, Brand, Freeze, per-turn counters); registers its hooks into `actions.mjs` (`registerElemental`).
- `module/afflictions.mjs` — Tier 3 spell effects (Poison coats and ticks, Charm, Hex triggers, the Combos); registers into `actions.mjs` (`registerAfflictions`).
- `module/foci.mjs` — Foci effects: Affix hooks for spells, per-turn Foci state, Deck Foci (registers into `actions.mjs` via `registerFoci`).
- `module/arcana.mjs` — Tier 5: Restore/Painless/Resuscitate, Shift/Toss/Mend, Mirage, Delay support; registers into `actions.mjs` (`registerArcana`).
- `module/conjure.mjs` + `conjure-rules.mjs` — Tier 4: Summons/Animations as temporary NPC actors, Made items, riders, Build Arcana helpers (rules math is pure).
- `module/mental-rules.mjs` (pure: Wonders and Modes parsed from the Mental trees, Wonder Power, Manifest costs, Alignment, Icon Forms and their numbers) + `module/mental.mjs` (Manifest dialog and attack, Alignment, attuning Icons, Wards, Nightmare Ward negation, Psion Arts; registers into `actions.mjs` via `registerMental`).
- `module/areas.mjs` — Area spells: shapes, pure geometry, template placement, Emplace card.
- `module/casting.mjs` — the Cast Spell dialog, paying AP/RP/Energy, the cast card, Rituals. Design decisions are in `dev/MAGIC_DESIGN.md`.
- `module/wonders.mjs` — Mental Wonders: Mode/ability/Tenet effects (`MODES` registry), charges, pending effects; registers into `mental.mjs`/`actions.mjs`.
- `module/data.mjs` — TypeDataModels (actor, weapon, armor, foci, shroud, gear, pile) and derived data.
- `module/rules.mjs` — core rules math (stats, sizes, stacks, rolls, Force). `skills.mjs` + `trees.mjs` — skill trees
  (`trees.mjs` is GENERATED from the docs; don't hand-edit).
- `module/sheets.mjs` — actor/item sheets, the Action List (`buildActionList`), `runActionRow`.
- `module/wizard.mjs` + `creation.mjs` — New Character wizard (GM creates the actor via the relay).
- `module/integrations.mjs` — Carousel Combat Tracker defaults and a built-in Token Action HUD system integration.
- `README.md` — player/GM-facing description of every automated rule and the judgment calls. Keep it current.
- `dev/` — not loaded by Foundry: `tests/` (Node harnesses with Foundry mocks), `run-tests.mjs`, `tools/build_trees.py`,
  `docs/` (doc snapshots).

## Key mechanics in code

- **Exchange flow (chat cards):** attack card (`flags.flowstate.attack {attacker, opts, targets}`) → defender responds →
  defense card (`flags.flowstate.defense`) → damage card (`flags.flowstate.damage`). Follow-ups get their own card once
  the exchange is resolved. Every opts key that must survive on the card has to be listed in `EXCHANGE_KEYS`.
  Rows tagged `data-role`/`data-owner` show buttons only to the owner; a new chat message re-renders the card it
  answers (see the `createChatMessage` hook's ref chain — add new flag names there).
- **GM relay:** players can't update others' documents; use `requestGM(action, payload)` with a handler in `GM_ACTIONS`.
- **Soak order:** parrying weapons → Shroud(s) → armor. Objects absorb at most their remaining Durability.
- **Distance:** `tokenDistance` measures between token borders (touching = 0 ft).
- **Weapon trees:** `abilities.weaponFits` — a weapon's main type, plus its extra types with Weapon Master (MT T5).

## Working conventions

- Run the tests after every change: `cd dev && npm install && npm test` (or `node run-tests.mjs t2 brawling` for a
  subset). Add or update a harness for new behavior. Harnesses use `seq = [...]` to script dice and `dialog = () => ({...})`
  to answer popups.
- `node --check module/<file>.mjs` catches syntax errors fast.
- Bump `system.json` `version` (patch for fixes, minor for features) and add a README note with each change.
- Regenerate skill trees after Martial/Magic doc changes: export the docs to `dev/docs/martial.md` and `magic.md`,
  then `cd dev && npm run trees` (Mental too: export the Mental Rework Test Ground to `dev/docs/mental.md`; the generator leaves out trees with no entries yet). After Combo Spell List changes: export it to `dev/docs/combos.md`, then `npm run combos`
  (generates `module/combos.mjs`; don't hand-edit).
- Keep Foundry globals out of `abilities.mjs`, `martial.mjs`, `magic.mjs`, `rules.mjs`, `creation.mjs` (they're unit-tested).
- Commit with clear messages; the user may test from `main`.
- The user has granted standing permission to open pull requests for this project (done through the GitHub MCP tools, not the `gh` CLI). Open a PR when a branch has no open one; pushing to a branch with an open PR just updates it.

## Settled rulings (don't re-ask)

- Blocking for an ally is free and gives the blocker no Riposte; Brace on armor gets no Riposte.
- Shatter: Heavy Unarmed damage to the incoming attack, no Solitary; works on melee misses; vs projectiles lowers the
  damage; if it breaks the weapon the attack deals no damage.
- Knockback is additive: base 5×, +5× Knockback+, +5× two-handed, +5× Smash. Weapon tags ignore Strengthened/Weakened.
- Fast follow-ups only come from Fast attacks (Fast weapon or Light Unarmed); a Light grapple opening the chain still
  gets the other fist's Fast follow-up; a Heavy grapple offers only Solitary. Each Unarmed grapple occupies a fist.
- Forced re-rolls (Dash, Shift, Close Quarters, Distracting Fire) keep the lower result. Speedy (Unarmored T3) applies
  Dash's Disadvantage automatically. Dash reaction costs Energy only; the move after costs 1 RP.
- Shroud scaling: base × floor(Build capped at Grade×10 ÷ 10), min ×1; Foci: base × Grade. Shroud soaks before armor.
  Affixes are a pick-list on the item (GM-set). Attuning takes an hour (not in combat).
- Ammo: X shots per reload (weapon setting, default 1) using X ammo; 1 shot per attack; max 100 per type.
- Token size: Size 1–5 = ¼, ½, 1, 2, 4 squares. Downed creatures are deleted from the combat tracker.
- Open question: Dragon Lash still doubles total Knockback (user hasn't decided vs. +5×).
