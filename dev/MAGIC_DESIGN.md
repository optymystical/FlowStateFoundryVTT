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
