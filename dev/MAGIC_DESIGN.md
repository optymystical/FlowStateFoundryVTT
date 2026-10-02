# Magic spell layer — design notes (settled with the user)

Phases: (A) casting framework → (C) per-tier spells/Mods, tier by tier (T1, T2, …) → (E) Foci passives → (D) Rituals/Weaving/Combos last.

## Casting framework
- Cast dialog: pick up to two **different** known Core Spells (exclusive boxes). Tabs below: Universal Mods (always), Core 1 Mods, Core 2 Mods (greyed if unused). Only applicable Mods shown. Live preview: Threshold, TR, energy cost, AP/RP, attack type.
- Needs 10+ in the casting stat; below that, casting is unavailable (hidden/greyed).
- Energy = floor(max(0, Threshold − TR) × skillPoints / 2) (round the end result down). Threshold is an integer, min 0.
- Igniter 2 AP / 1 TR (Grasp); Channeler 3 AP / 2 TR (Reach); Raw Casting 1/2/3 AP = 1/2/3 TR using min(Reach, Grasp), no Grade cap. Multi Foci use Raw Casting rules; Ring's +1 TR stacks with the T2 Focus passive.
- Gauntlet: first cast costs Energy, the duplicate is free but makes its own attack roll.
- Spell attacks roll attack die vs dodge, including allies/self. All defenses that fit "an attack" / the damage type apply.
- Arcane is the only damage type Weakened vs non-Magical targets; it ignores non-Magical objects but still interacts with Shrouds/armor that explicitly guard against magic.
- Active spell effects are Active Effects (with stored HP where the spell has health), expiring at the caster's next turn start.
- Rituals: an option on cast; applies a Max Energy loss Active Effect. When that effect ends, the spell effect ends too.
- Weaving: checkbox in the attack dialog, only offered when a non-Magical attack has the same AP/RP cost.
- GM-adjudicated spells: chat card states the expected effect and applies Active Effects to targets as needed.

## Built so far (v0.23.0): casting framework
- `spells.mjs` / `casting.mjs`, tests in `dev/tests/spells-test.mjs`.
- Judgment calls to confirm: Combo Threshold = sum of the Cores (matches every entry in the Combo Spell List with the user's confirmation that the listed Creation + Illusion = 2 is a typo for 3); Arcanomancy adds nothing; Rituals cost no AP or Energy to cast and lower max Energy by half the TR-ignoring Energy cost; Raw Casting needs a free hand with fists not counting.
- Next: Tier 1 spells (Core Spells + Pinpoint/React are in; the attack roll, damage and effects for Shield, Force, Cut, Stab, Slam are not).

## Built (v0.24.0): Tier 1 spells
- `spellfx.mjs` holds the Tier 1 profiles; hooks in `actions.mjs` (`spellHit`, `spellForce`, `spellDamageFacts`, Shield soak in `damageOutcome`, `applySpellEffect`/`clearSpellEffects`), `data.mjs` (die-size penalties), `casting.mjs` (`resolveSpell`, Ritual free casts). Test: `dev/tests/spell-t1.mjs`.
- Judgment calls: "direct damage" for pre-roll conditions = the spell's base dice at their largest would reach HP through every soak; Shield soaks after parrying weapons and before Shrouds, no Limit; "living" = not marked Fully Magical; die-size penalties are bolded in the doc so they scale with Spell Power; Ritual attack spells store two free casts (cast does not fire).

## Built (v0.25.0): Slashing/Piercing Mods and dialog polish
- Automated Mods are listed in `spellfx.AUTOMATED_MODS`; the rest are tagged "not automated" and listed on the card for the GM.
- Judgment calls: Bleed/Gash repeats go straight to HP (no soak) and keep Chop's Max HP loss; Gash triggers on any token position change except system moves; Exploit refunds unused stacks' Energy when the attack is rolled (not capped in the dialog); Setup's Advantage applies to any attack roll at that target and is stored as an actor flag; Pierce stacks add (10 × Power each); Cleave is flat damage before Strengthened/Weakened.

## Built (v0.26.0): the whole Magic T1 group
- "Tier" = the group of trees a Magic Theory tier unlocks. T1 = Magic Theory, Slashing, Piercing, Crushing, Protection Arcana, Gravity, all their tiers.
- Judgment calls: Replacement Mods have a "replace base effect (×2)" box (replacing drops Force, the Gravity part, and keeps a Combo partner's part); Hold's break-free is an attack-die roll against the held minimum; Reflect is a counter button, not automatic; Adjust = a per-Shield absorb-order setting plus an ally-help extension within 10 ft; Weaving only offers casting options whose normal AP equals the attack's; Duplicate asks for the second target; Emplace and the Gravity Field Ritual stay GM-resolved.

## Built (v0.27.0): Area placement, Emplace, polish
- Area spells choose a shape, drop a Measured Template on the caster, and the caster drags it into place and confirms (a modeless dialog, so the Templates tool stays usable). Placement happens before payment; cancelling spends nothing. Placement is the one part not covered by tests (no Foundry canvas here): the geometry and fallbacks are.
- One Replacement Mod at a time (other boxes hidden). Reflect has a 200 ft check. Emplace leaves a template as the barrier; the GM tracks health/facing.

## Built (v0.29.0): the whole Magic T2 group
- `elemental.mjs` + `spellfx.mjs` profiles (effect grammar: stack / energy / extra / force / chain / dodgeDis / scorch, with `when` conditions), Stain variants and armor-held stacks in `rules.mjs`/`data.mjs`/`actions.mjs` (`giveStacks`, `endOfTurn`, `clearCondition`), held melee spells, Multicast/Lob/Explode/Mold in `casting.mjs`. Tests: `stains.mjs`, `spell-t2.mjs`.
- Judgment calls: "that many" = the final damage (after Strengthened, before soak); stacks go on armor when armor absorbed the damage and none reached HP, and on armor first for no-damage spells; Flare sets are applied as separate instances (the card figures each independently); Electrify counts any damage you dealt that target this turn; Charge counts targets hit before this one; Lightning Rod and Charge only matter inside a chain; Discharge is a confirm prompt; chains are button-driven (you pick the next target); Mold's half-cover is GM-adjudicated (no cover system); Emplace is an object with Limit = health ÷ 5.

## Rulings (v0.29.1)
- A spell object with no stated Limit has Limit = its health (Shield and Emplace). Electrify only counts damage Crackle or its Combos did. Mold's half-cover: revisit when a cover effect is designed.

## Built (v0.29.2): Flight through Emplace barriers

- `areas.planFlight` (pure) plans a thrown creature's path through barriers and ordinary walls: 3 × untraveled feet to both sides, each capped by what the other has left; a surviving barrier stops the creature, a broken one lets it continue with `untraveled − barrierHP ÷ 3` feet. `actions.flyThrown` applies it (creature damage via `damageOutcome`, barrier health via `setBarrierHealth` / GM relay). A barrier between a thrower and the aimed target stops or slows the throw before the collision.
- Judgment calls: Force damage to a barrier ignores its Limit (it is Force, not an attack); an ordinary wall earlier on the path (more than 1.25 ft sooner) wins over a barrier, a tie goes to the barrier; barriers are sampled a quarter square at a time. Untested in real Foundry (token movement and Wall collision).

## Built (v0.30.0): Tier 3 (Grasp Arcana, Venomancy, Charm, Witchery)

- `module/afflictions.mjs` is the Tier 3 engine, registered into `actions.mjs` as `registerAfflictions` (`onHit`, `charmNet`, `charmWeakened`, `charmedBy`, `hexTrigger`, `afterDefense`, `turnStart`, `casterTurn`, `act`). Data is `PROFILES[...].afflict` in `spellfx.mjs` (kinds `poison`, `charm`, `hex`, `venomCharm`, `venomHex`, `charmHex`).
- Effects are Active Effects with `spellEffect.kind` of `coat`, `poison`, `charm`, `hex`. Poison/Hex/pending Charms are `onTargetTurn` (they survive the caster's turn); Ingrained Charms too. `turnsLeft` lets `clearSpellEffects` keep a Combo effect an extra caster turn.
- Rolls: `charmNet(actor, type)` is added to the system's own rolls (attack, parry, dodge, stat check, d100); Weakened damage goes through `targetStacks`. Hex triggers: Harm in `applyDamage` (damage flagged `fromHex` never triggers), Move in `preUpdateToken`, Roll in each roll function / the damage roll, attack/dodge Fail/Success in `afterDefense`. Manual triggers are buttons (`act: "hex"`).
- Buttons on our own cards read `flags.flowstate.afflict.acts[i]` (`pass`, `spread`, `arc`, `respread`, `hex`) and call `afflictions.act`. Spread / respread go through `performAttack` with a spell whose `act` field says what to do when it hits.
- `damageOutcome` / `applyDamage` / `requestDamage` got `ignoreArmor` (Venomancy Combos) and `fromHex`.
- Rituals: a Tier 3 Core's Ritual stores one free cast (`ritual.t3`); the free cast carries `ritualOf` and is spent on a hit (`spendRitual`).
- Instant Ritual is a `planCast` flag (`instantRitual`); Foci Master bypasses the in-combat attuning refusal with the `flowstateFociMaster` update option.
- Tests: `dev/tests/spell-t3.mjs`.

## Built (v0.31.0): Tier 4 (Build Arcana, Summoning, Creation, Animation) and Unravel

- `module/conjure.mjs` is the engine (casting.mjs asks `conjure.prompt` before payment and calls `conjure.resolve` after); `module/conjure-rules.mjs` is the pure math (pool, health, sizes, materials, riders). Profiles: `PROFILES[...].conjure` (`kind` summon/make/animate; `rider` for Any T1/T2/T3 + T4; `make`, `summonStats`, `instant` for the pure Combos).
- Summons/Animations are NPC actors created through `GM_ACTIONS.createCreation` (also `deleteCreation`, `giveItems`, `deleteMade`). Their numbers live in the actor flag `flowstate.summon` (`hp`, `energy`, `attackDie`, `dodgeDie`, `speed`, `physical`, `ap`, `rp`, `owner`, `ritualOf`, `rider`), which `FlowStateActorData.prepareDerivedData` applies. Made items carry `flags.flowstate.made { caster, ritualOf, rider? }`.
- Ending: `conjure.turnStart` (Reform, then temporary creations) from `_onStartTurn`; `clearAll` on combat end; `endRitual` from the Ritual-effect delete hook. A Tier 4 Ritual stores one free cast (`ritual.t3`), spent by `resolve`.
- Natural items: `natural` / `returning` fields; `dropItem` refuses them; the weapon dialog hides Throw for natural, non-returning weapons; natural weapons skip ammunition.
- `riderAfter` (registered as `registerConjure`) runs after a non-spell attack's damage: the Combo Core's extra damage/effects for a Summon, Animation, or Made item.
- Projection passes an `origin` token to range and melee checks; Seep is in `recoverEnergy`; Foci Master / Shroud Master share `swapAttuned`.
- Unravel: `magicDisNet` in spell attack rolls and Reach/Grasp/Build checks.
- Tests: `dev/tests/spell-t4.mjs`.

## Built (v0.32.0): Tier 5 (Restoration Arcana, Geomancy, Illusion, Arcanomancy)

- `module/arcana.mjs` (registered as `registerArcana`): `prompt` (before payment) / `resolve` for Restore and Shift, Mirage through the attack exchange (`mirageHit` from `spellHit`), `turnStart` decay, `act` buttons (`fs-arcana-act`, flags `arcana.acts`). Profiles: `PROFILES[...].arcana` (`restore`, `shift` with `rider`/`arcane`/`stealth`, `mirage` with `chart`); Strike is a plain damage profile (`strike: true`); `arcanize()` builds every Arcanomancy + Core profile (damage → arcane, `arcano`, `afflict.contested`).
- Restore history: `applyDamage` appends to the actor flag `lossLog`; `_onStartTurn` sets `turnStartedAt`; death sets `diedAt`. Painless is a `painDown` effect read in `prepareDerivedData`.
- Delay: `castSpell` stores `values` + target uuids in a `delayed` effect and `fireDelayed` re-runs the cast with `{ fire }` (no payment, no range check).
- Contested checks: `afflictions.check(..., { contest })`. Fear: `fearTimed` effect removed in `endOfTurn`.
- Geomancy Combos with Summoning / Creation / Animation set `geo` (returning natural weapons, ranged strike); Illusion Combos set `fear` (coin flip in `riderAfter`).
- Tests: `dev/tests/spell-t5.mjs`.

## Built (v0.33.0): Foci passives, Foci Affixes, Deck Foci

- `module/foci.mjs` (registered as `registerFoci`): per-turn Foci state (`fociState` flag: casts and last Core per Foci), the Affix hooks (`attackNet`, `damageStacks`, `afterDamage`, `afterHit` on `spell.fociFx`, the plain data a cast carries on its attack card), and the deck (`deck` actor flag: draw / hand / discard).
- Pure maths: `magic.mjs` `fociTR` (Wand, Lens, Scepter, Tablet) and `castsTwice` (Staff, Tome, Gauntlet); `spells.planCast` applies them (`ctx.fociState`, `ctx.targetsAlly`), the Deck TR and hand check, Hematite and Taaffeite.
- `castSpell` wraps the resolution in `run(plan)` so a Foci can run it twice; Gauntlet's first run uses the higher Scaling Stat.
- Tests: `dev/tests/foci-effects.mjs`.

## Built (v0.34.0): the last gaps

- Spells as targets: `arcana.listSpells()` (effects, Emplace templates, Summon actors) → `damageSpell` / `amplifySpell` / `ripSpell`; `casting.castSpell` calls `arcana.promptSpell` before payment and `resolveStrike` after. Spell health defaults to the caster's Scaling Stat.
- Blast Ritual: the template gets `spell: "antimagic"` flags (`tplFlags` GM action); `arcana.antimagicTurn` (turn start) and `arcana.checkEntry` (called from `preUpdateToken`) deal Strike's damage to magical tokens. `checkEntry` also offers Aura entrants an attack (the `aura` effect on the caster stores the attack options).
- Reactive: `damageOutcome` weakens damage that hits a Reactive Shield / barrier and returns `reactive` caster uuids; `applyDamage` spends the RP (and handles Summons first). Taaffeite (Shroud) is in the shield loop of `applyDamage`.
- Sense Swap: caster flag `senseSwap` → `conjure.senseSwapToken` is the `origin` for range and melee in `castSpell`. Limited Autonomy: summon flag `command`, announced by `conjure.autonomyTurn`.
- Muddy: `muddy` effects read by `afflictions.penaltyStacks`; Harden: `made.harden` flags (strong in `targetStacks`, armor via `selfWeakened` in the item data models). Phantom Pain and Painless are read in `prepareDerivedData`. Emerald: `sceneLush()` (scene flag set from a Scene Configuration checkbox).
- Animated weapons: `conjure.act("weapon")` builds a proxy item (caster's stats, held) for `rollWeaponAttack`.
- Tests: `dev/tests/spell-gaps.mjs`.

