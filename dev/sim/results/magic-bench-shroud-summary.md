# magic-bench-shroud (summary)

The Magic-only school benchmark against Shroud users, on v0.83.2. The caster wore no armor and used Build for its Bastion. The three raiders swapped their armor for Build 50 and a Shroud (Keystone, Bastion, Carapace). There were 46 fights, two per school, of 4 rounds each.

The full results file didn't save: the Foundry server stopped accepting uploads from the browser session after fight 18 ("User [] does not have permission to upload files"). These rows were computed in the browser from all 46 fights, with the same columns as `magic-bench-report.mjs`.

| school | fights | lost | hit | burn | other | bag | me | down | what it cast |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cut only (baseline) | 2 | 0 | 0 | 0 | 0 | 575 | 0 | 0.0 | Cut 24, mod:Bleed 14 |
| Slashing | 2 | 35 | 35 | 0 | 0 | 472 | 0 | 0.0 | Cut + Stab 18, mod:Bleed 6, Cut 6 |
| Piercing | 2 | 65 | 65 | 0 | 0 | 470 | 0 | 0.0 | Cut + Stab 18, mod:Bleed 6, Cut 6 |
| Crushing | 2 | 96 | 75 | 0 | 21 | 448 | 0 | 0.0 | Cut + Slam 18, mod:Bleed 6, Cut 6 |
| Protection Arcana | 2 | 0 | 0 | 0 | 0 | 451 | 0 | 0.0 | Cut 16, mod:Bleed 10, Shield 8, mod:Dampen 6 |
| Gravity | 2 | 39 | 39 | 0 | 0 | 391 | 0 | 0.0 | Force + Cut 14, Personal Repulsion 8 |
| Reach Arcana | 2 | 43 | 24 | 0 | 19 | 622 | 0 | 0.0 | Cut 24, mod:Bleed 12, mod:Explode 2 |
| Heat | 2 | 3 | 0 | 3 | 0 | 279 | 0 | 0.0 | Cut + Flame 18, mod:Bleed 6, Flame 6 |
| Cold | 2 | 0 | 0 | 0 | 0 | 403 | 0 | 0.0 | Cut + Frost 18, mod:Bleed 6, Cut 6 |
| Radiation | 2 | 0 | 0 | 0 | 0 | 443 | 0 | 0.0 | Cut + Crackle 18, mod:Bleed 6, Crackle 6 |
| Acid | 2 | 0 | 0 | 0 | 0 | 702 | 0 | 0.0 | Cut + Glob 18, mod:Bleed 6, Glob 6 |
| Grasp Arcana | 2 | 0 | 0 | 0 | 0 | 632 | 0 | 0.0 | Cut 24, mod:Bleed 14 |
| Venomancy | 2 | 0 | 0 | 0 | 0 | 483 | 0 | 0.0 | Cut 16, Poison (coat self) 8, mod:Bleed 8, mod:Lethality 2 |
| Charm | 2 | 0 | 0 | 0 | 0 | 434 | 0 | 0.0 | Cut 16, mod:Bleed 12, Charm 8, mod:Cloud 4 |
| Witchery | 2 | 0 | 0 | 0 | 0 | 587 | 0 | 0.0 | Cut 16, mod:Bleed 10, Hex 8, mod:Fester 6 |
| Build Arcana | 2 | 0 | 0 | 0 | 0 | 368 | 0 | 0.0 | Cut 24, mod:Bleed 14 |
| Summoning | 2 | 0 | 0 | 0 | 0 | 504 | 23 | 0.0 | Cut 16, Form 8, made:summon 8, mod:Bleed 8 |
| Creation | 2 | 0 | 0 | 0 | 0 | 603 | 0 | 0.0 | Cut 24, mod:Bleed 14 |
| Animation | 2 | 0 | 0 | 0 | 0 | 353 | 0 | 0.0 | Cut 22, mod:Bleed 10, Animate 2 |
| Restoration Arcana | 2 | 0 | 0 | 0 | 0 | 441 | 0 | 0.0 | Restore 22, mod:Painless 22, Cut 2, mod:Bleed 2 |
| Geomancy | 2 | 17 | 17 | 0 | 0 | 705 | 0 | 0.0 | Shift 24, mod:Toss 18, mod:Tier Up 6, mod:Muddy 6 |
| Illusion | 2 | 0 | 0 | 0 | 0 | 479 | 0 | 0.0 | Cut 17, mod:Bleed 9, Mirage 7, mod:Phantom Pain 2 |
| Arcanomancy | 2 | 17 | 17 | 0 | 0 | 307 | 0 | 0.0 | Strike 24, mod:Empower 10 |

The same benchmark against armored raiders (magic-bench, before v0.83): Cut only 273, Heat 669, Witchery 428, Arcanomancy 1154 lost.

At Build 50 (+6), each raider's Shroud is Grade 5 with doubled numbers: Keystone Limit 120 / Durability 600, Bastion 100 / 500, Carapace 50 and growing with each hit. The Shroud recovers its Limit every turn. A 30 SP caster's single spell hits for roughly 30 to 90, so almost nothing gets past.
