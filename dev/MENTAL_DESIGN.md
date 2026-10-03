# Mental build notes

Source: **Mental Rework Test Ground** (Drive `1vyo3biYzh4smTOMmNM5OK7uqLXxKlrse6M-zHbnC0YI`), snapshot `dev/docs/mental.md`. Icons and Forms come from the Equipment doc (Mental Icons section).

## Plan
1. **Foundation (v0.42.0)**: trees, Mental Theory framework (Manifest, Ranges, Wonder Power, Enhance, Burst, Alignment, Deepening, Fluidity), Icons/Forms/Wards, Willpower Arts, Psion Arts.
2. **Wonders in batches**: Life, Death, Order, Chaos, Beyond, Below (T1 group), then Creation, Destruction, Peace, War, Adaptation, Perfection. Per Wonder: its Modes' effects, Tenet, abilities (Fester, Pollinate...).
3. Remaining Theory pieces: Chant, Dismissing, Will of Body and Spirit, Expansion, Patron, Equilibrium's free Enhance/Burst, the Ward riders left over.

Charges (Decree, Fracture, Larceny, Waste...) are tracked as effects on the target; where a roll can use one, a prompt/button offers it to the Mental user ("auto where possible, plus buttons", like Hex triggers).

## How it is built
- `mental-rules.mjs` is pure. `parseWonder` reads a Wonder out of its skill tree: a tier whose summary says "Mode" holds Modes; the entry that starts "Only active while attuned" is the Tenet; everything else is an ability or passive. `splitEnhanced` splits "...Enhanced: ..." text.
- `mental.mjs` registers into `actions.mjs` (`registerMental`): `onResolve` (called after the defense, with `o.mental` on the attack opts), `negate` (start of `applyDamage`), `turnStart`. `mental` is in `EXCHANGE_KEYS`.
- A Manifest or Ward is `performAttack` with no damage; the effect is applied in `onResolve`. A Wonder's Mode effect belongs in `onResolve`'s `m.mode` branch.
- Ward shielding is a spell-effect `shield` (stacking, `ward` set, optional `types`, `persistent` for Vigil), so it soaks like a Shield. Premonition is a `premonition` effect consumed in `negate`.
- Alignment is an actor flag `alignment: { value, deepened }`, cleared at turn start. Far Sight / Aura Sight are the `psion` flag.
- Icon item type `icon` (`FlowStateIconData`, `FlowStateIconSheet`, Equipment tab table, Forge and wizard slot kind `icon`).

## Judgment calls
See README, "Mental (in progress)".

## Wonders batch 1 (Life, Death, Order, Chaos, Beyond, Below)
- Modes live in `wonders.mjs` `MODES` keyed by mode id; each returns card HTML. Delayed effects are `pending` effects (`onTargetTurn`) processed at the target's turn start.
- Temp HP is effect kind `tempHP`, soaked in `damageOutcome` before HP.
- Order/Chaos charges are effects spent via a calculator card, not live roll interception.

## Live charges, Theory and Wards (v0.44.0)
- `charges.mjs`: `onRoll` (hooked at every roll site via `mentalHook.rollCharges`), `afterResolve` (`resolveCharges`, in `defend`), `onDamage` (`damageCharges`, in `rollExchangeDamage`). A roll's total is overwritten with `setRollTotal`; notes go on the card. The caster is asked with `askFor` (local dialog, or the socket `chargeAsk`/`chargeAnswer` with a 60 s timeout).
- Chant/Make Clear are follow-up acts (`rerollAct`) carrying the original net, die and dodge total. Will of Body and Spirit is `mentalHook.attackCost`, called after weapon and spell attacks.
- Reverie's hold works through `beforeClear` (marks the effects `persistent`) + `maintainDream`; Anchor's "not moved" compares the token to the `turnPos` flag.

## Second batch of Wonders (v0.45.0)
- Extension points in `wonders.mjs`: `MODES`, `ACTS` (button handlers by id), `ACT_PROVIDERS` (buttons after a hit), `MISS_PROVIDERS` / `MISS_MODES` (misses; Perfection applies on a miss with `c.margin`), `CHOICE_PROVIDERS` / `COST_PROVIDERS` (Manifest dialog options, extra Energy, Advantage/Strengthened, flags), `TURN_START`, `BEFORE_CLEAR`, `ON_CRIT`.
- `adjust` (mentalHook) runs in `rollExchangeDamage` before the damage is soaked, and in `applyDamage` for damage that didn't come from an attack's damage roll (`mentalDone` marks the former); a `busy` flag stops redirected damage from adjusting itself again.
- `pay` now relays to the GM when paying for a character you don't own (a prompted caster's Energy).
