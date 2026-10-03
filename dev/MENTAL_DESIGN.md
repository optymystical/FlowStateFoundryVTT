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
