// Generated from the Martial and Magic Stage 1 docs and the Mental Rework Test Ground by tools/build_trees.py. Don't edit by hand; re-run the converter.
export const TREES = [
 {
  "id": "martial-theory",
  "name": "Martial Theory",
  "archetype": "martial",
  "theory": true,
  "requires": 0,
  "tiers": [
   {
    "tier": 0,
    "free": true,
    "summary": "You gain the following actions:",
    "entries": [
     {
      "name": "Attack",
      "text": "You can use Weapons and Unarmed strikes to attack an enemy within their listed range. Attacking takes 2 AP for Light Weapons, and 3 AP for Heavy Weapons. See the Combat Rules section and the Equipment document for more details."
     },
     {
      "name": "Grappling",
      "text": "Grappling can be done with either a Light or Heavy unarmed attack. If Light, make the attack as normal, and on hit it deals no damage but successfully grapples the target. If Heavy, you deal your Heavy unarmed attack damage in addition to the grapple being successful. This counts as a normal unarmed attack either way. Can only function on a creature that is your size or smaller. For more info on how Grappling works, see the Combat Rules section in the main Rules document."
     },
     {
      "name": "Throw",
      "text": "Allows you to throw a held Martial Weapon or a grappled target using 2 AP. If you are throwing a grappled target, impart an amount of force onto the target equal to 10x your Strength stat. Either way, if you throw at a living target, make a ranged attack roll against them. On hit with a grappled target, both targets collide and take the same amount of damage from the throw (if the damage would exceed the health of the thrown thing, it instead only deals that much damage to itself and the target). On hit with a Weapon, apply its damage and any passives/activated abilities to whatever it was thrown at."
     }
    ]
   },
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the Brawling, Bladed, Balanced, Swift, Rapid, and Medium Armor skill trees. You also gain the following ability and action:",
    "entries": [
     {
      "name": "Parry",
      "text": "Cost: Energy equal to your Scaling Stat. At any time on your turn, you can activate this ability with a held Weapon to enable it to Parry incoming attacks until the start of your next turn. This causes all incoming Melee/Ranged attacks to have your chosen Weapon’s Limit and Durability applied to their damage (your armor and dodge roll still function as normal). Only one form of this ability can be active per Weapon."
     },
     {
      "name": "Riposte",
      "text": "Whenever you Parry and take no direct damage from that incoming attack, you can spend RP equal to the normal AP cost of that Weapon’s attack roll to immediately make an attack with that Weapon against the attacker (if ranged, you can throw or shoot a ranged attack if applicable). This attack occurs after their attack hits you, but before they can act again."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the Strength, Striker, Defender, Weighted, Assault, and Heavy Armor skill trees. You also gain the following ability:",
    "entries": [
     {
      "name": "Psych Up",
      "text": "Cost: Energy equal to half of your Skill Points, rounded down. Can be done once per turn at any time on your turn. You gain Advantage on all attack rolls you make, but all attacks made against you have Advantage on their attack rolls. Both effects last until the start of your next turn."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the Dexterity, Reach, Blast, Circular, and Light Armor skill trees. You also gain the following ability:",
    "entries": [
     {
      "name": "Calm Down",
      "text": "Cost: Energy equal to half of your Skill Points, rounded down. Can be done once per turn at any time on your turn. You gain Advantage on all dodge rolls you make, but all attacks you make have Disadvantage on their attack rolls. Both effects last until the start of your next turn."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the Constitution, Curved, Longshot, and Titanic Armor skill trees. You also gain the following passive:",
    "entries": [
     {
      "name": "Improvise",
      "text": "Improvised Weapons now instead follow the closest Weapon type to what they would be."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the Grappling, Thrasher, and Unarmored skill trees. You also gain the following passive:",
    "entries": [
     {
      "name": "Weapon Master",
      "text": "You can now use Weapons that have multiple weapon types, choosing between which one to use whenever you attack. While held, their normal and defensive abilities for each type are always available."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-brawling-methods",
  "name": "Brawling Methods",
  "archetype": "martial",
  "theory": false,
  "requires": 1,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following abilities:",
    "entries": [
     {
      "name": "Twin Fang (Light)",
      "text": "Cost: Energy equal to your DEX min. Can be used prior to making a set of Fast Unarmed Attacks. Those attacks get your choice of Advantage on their attack roll, or Strengthened (chosen for each separately)."
     },
     {
      "name": "Jab (Heavy)",
      "text": "Cost: Energy equal to your STR min. Can be used prior to making a Solitary Unarmed Attack. That attack gets Advantage on its attack roll and is Strengthened."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following actions:",
    "entries": [
     {
      "name": "Dip (Light)",
      "text": "You can now use Parry on any free hand using your DEX as the Scaling Stat, changing it to do the following instead: Reduces the damage of incoming Melee/Ranged attacks by your Dexterity stat. If any attack is reduced to 0 damage from this, you can spend 1 RP to move your speed instantly. Only one hand can benefit from this at a time."
     },
     {
      "name": "Shatter (Heavy)",
      "text": "You can now use Parry on any free hand using your STR as the Scaling Stat, changing it to do the following instead: Allows you to deal your Heavy Unarmed damage to the incoming attack for free (such as the weapon, projectile, etc.), applying before the damage of that attack does. Solitary does not apply here. Only one hand can benefit from this at a time."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following abilities:",
    "entries": [
     {
      "name": "Combo (Light)",
      "text": "Cost: Energy equal to double your DEX min. Can be used after successfully landing both hits in a set of Fast Unarmed Attacks. You immediately attack the same target again at no AP/RP cost with a Light Unarmed Attack with Advantage on the attack roll (that attack cannot chain into another Fast attack as per the Fast rules)."
     },
     {
      "name": "Dragon Lash (Heavy)",
      "text": "Cost: Energy equal to double your STR min. Can be used in place of any Heavy Unarmed Attack, still benefiting from any skills or features that affect them. The attack is Strengthened, and deals twice as much force from its Knockback. If the target is prone, both of these benefits are doubled."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following abilities:",
    "entries": [
     {
      "name": "Redirect (Light)",
      "text": "Cost: Energy equal to your DEX min. Whenever you successfully dodge or use Parry to take no damage from an incoming melee attack, you can use this ability. The attacker instead redirects their attack to a target adjacent to you (your choice, forced movement if necessary), rerolling the attack with Advantage on its attack rolls, and reapplying any skills they applied to the initial attack (at no extra cost to them)."
     },
     {
      "name": "Kick Out (Heavy)",
      "text": "Cost: Energy equal to your STR min. Can be used in place of any Heavy Unarmed Attack, still benefiting from any skills or features that affect them. If you successfully hit the target, so long as they are no more than one size larger than you, they are knocked prone."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Flow Like Water",
      "text": "Cost: Energy equal to double your Scaling Stat min. Whenever you successfully land all attacks in a Fast Unarmed Attack set or a Solitary Unarmed Attack set, you can use this ability. You immediately attack the same target again at no AP/RP cost with the opposite attack type to what triggered this ability. That attack can benefit from Fast/Solitary and cannot be chained into more Flow Like Water attacks. This can be used alongside Combo (the Combo attack would happen first, then this attack)."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-bladed-weapons",
  "name": "Bladed Weapons",
  "archetype": "martial",
  "theory": false,
  "requires": 1,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following abilities:",
    "entries": [
     {
      "name": "Whirlwind (Light)",
      "text": "Cost: Energy equal to your Scaling Stat min. Can be used prior to making a set of Fast Bladed Attacks. Those attacks are instead made as Area attacks, affecting all targets of your choice in your melee attack range."
     },
     {
      "name": "Remise (Heavy)",
      "text": "Cost: Energy equal to your Scaling Stat min. When you make a Solitary Bladed Weapon attack where the first hit in the chain landed, you can use this ability. That attack gets Advantage on its attack roll and is Strengthened."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Close Quarters",
      "text": "Cost: Energy equal to half of your Scaling Stat min, rounded down. Can be used when you are attacked in melee while wielding a Bladed Weapon. The incoming attack is made at double Disadvantage."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Blender (Light)",
      "text": "Your Light Bladed Weapons can now benefit from Fast+. If Whirlwind is used with this, it costs twice as much energy but all attacks made this way gain the Cleave tag."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Titan Weapon (Heavy)",
      "text": "Your Two Handed Bladed Weapon attacks can now benefit from Solitary+, but get Disadvantage on their extra attack roll if this is used. Remise costs twice as much energy to use with a Two Handed heavy Bladed Weapon."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Perfect Riposte",
      "text": "Cost: Energy equal to double your Scaling Stat min. You can use this ability whenever you Riposte with a Bladed Weapon. The Riposte is made with Advantage on its attack roll and is Strengthened. If used with Fast or Solitary, that extra attack also gets this benefit."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-balanced-weapons",
  "name": "Balanced Weapons",
  "archetype": "martial",
  "theory": false,
  "requires": 1,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Slip Off",
      "text": "Whenever Parry is used with a Balanced Weapon, the incoming attack’s damage is also Weakened against you (and your held items)."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Spin Cycle",
      "text": "Cost: Energy equal to your Scaling Stat min. Can be used prior to making a Balanced Weapon Attack. That attack is instead made as an Area attack, affecting all targets of your choice in your melee attack range."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following abilities:",
    "entries": [
     {
      "name": "Slice (Light)",
      "text": "Cost: Energy equal to your Scaling Stat min. When you make a Light Balanced Weapon Attack, you can use this ability. Your attack gains the Pierce tag, or it causes the target’s movement to take 1 more AP on hit, lasting until the start of your next turn (your choice)."
     },
     {
      "name": "Slam (Heavy)",
      "text": "Cost: Energy equal to your Scaling Stat min. When you make a Heavy Balanced Weapon Attack, you can use this ability. Your attack gains the Bash or Knockback tag (your choice)."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following action:",
    "entries": [
     {
      "name": "Deflect",
      "text": "If an attack is Parried by a Balanced Weapon and all of its damage is taken by the Balanced Weapon, you can spend 1 RP to Deflect the attack back at the attacker. Make an attack against the attacker using their own Weapon as the source (applying any relevant skills and effects, if ranged treat it as if you were shooting it back with the same Weapon type)."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "One with your Weapon",
      "text": "Slice and Slam can now be used for double their energy cost to instead grant both effects for their attack."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-swift-weapons",
  "name": "Swift Weapons",
  "archetype": "martial",
  "theory": false,
  "requires": 1,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Cut Back",
      "text": "While wielding a Swift Weapon, you can use Riposte with it whenever you dodge an incoming attack roll."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Quick Strike",
      "text": "Cost: Energy equal to half of your Scaling Stat min, rounded down. Prior to making a Swift Weapon Attack, you can use this ability. That attack has Advantage on its attack roll. Applies to both attacks in a set of Fast Attacks so long as they are both Swift Weapon Attacks."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Blade Flurry",
      "text": "Cost: Energy equal to your Scaling Stat min. When you land all attacks in a set of Fast Swift attacks, you can spend RP equal to the AP cost of that attack to use this ability. Make an additional Swift Weapon attack against the same target. Due to the RP cost, this enables further Fast attack sets, allowing this to chain with itself."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Eviscerate",
      "text": "Cost: Energy equal to double your Scaling Stat min. This ability can be used once at the end of your turn, so long as you have dealt direct damage to any number of targets using Swift Weapon attacks. Repeat all direct damage you dealt with Swift Weapon attacks during your turn back to those targets (this bypasses objects, and has no effect on objects)."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following passives:",
    "entries": [
     {
      "name": "Delta (Light)",
      "text": "When you end your turn having landed at least 12 Light Swift Weapon attacks, you regain 6 RP."
     },
     {
      "name": "Omega (Heavy)",
      "text": "Your Heavy Swift Weapon attacks now allow Strengthened to affect their Pierce value."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-rapid-weapons",
  "name": "Rapid Weapons",
  "archetype": "martial",
  "theory": false,
  "requires": 1,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following action:",
    "entries": [
     {
      "name": "Quickload",
      "text": "Whenever you attempt to attack or fire a shot while out of ammo with a held Rapid Weapon, you can choose to forgo that attack (still using the resources needed for that attack) to reload instantly. If used with Pepper, replace one of the Pepper shots with this effect, and those remaining shots get one less Disadvantage."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Spin Down",
      "text": "Cost: Energy equal to your Scaling Stat min. Prior to using the Pepper tag during a Rapid Weapon attack, you can use this ability. Double the number of shots fired. They are still made as one attack with Disadvantage on its attack roll (or two Disadvantages with Pepper+ being used), and all shots must be at the same target."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Mark",
      "text": "Cost: Energy equal to your Scaling Stat min. At any time while holding a Rapid Weapon, this ability can be used. Marks a target within your Rapid Weapon range until the start of your next turn. Whenever a Marked target declares an action (doesn't have to cost AP/RP), you can consume the Mark on them to attack them with a held Rapid Weapon for RP equal to the normal AP cost of that Weapon’s attacks."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Lead Blindness",
      "text": "Any actions used by the attacked target in reaction to your Rapid Weapon attacks, or actions used that result in Mark being consumed, have Disadvantage on their relevant rolls."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Speedloader",
      "text": "Cost: Energy equal to a quarter of your Scaling Stat min, rounded down. You can use this as an alternative to Quickload. If this ability is used, you no longer forgo the attack for that instance of Quickload, and still reload and fire as normal."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-medium-armor",
  "name": "Medium Armor",
  "archetype": "martial",
  "theory": false,
  "requires": 1,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Limber",
      "text": "Cost: Energy equal to a quarter of your CON min, rounded down. After succeeding on any attack or dodge roll during combat while wearing Medium Armor, you can use this ability. Your next roll before the start of your next turn has Advantage. This effect does not stack with itself."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following action:",
    "entries": [
     {
      "name": "Brace",
      "text": "You can now use Parry on worn Medium Armor, using your CON as the Scaling Stat, changing it to do the following instead: reduces the incoming damage by your Constitution stat."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following action:",
    "entries": [
     {
      "name": "Careful Steps",
      "text": "You can spend 2 AP to remove the stealth penalty from your worn Medium Armor. This can be done every turn passively by expending the 2 AP at turn start, allowing for normal stealth but limiting your individual turn movement, and your surprise round AP available."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Shift",
      "text": "Cost: Energy equal to half of your CON min, rounded down. When you are attacked while wearing Medium Armor, you can use this ability. You either gain Advantage on your dodge roll or impose Disadvantage on the incoming attack roll, your choice."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Versatility",
      "text": "At the start of each of your turns while wearing Medium Armor, pick between Shift, Brace, and Limber. Until the start of your next turn, all uses of the chosen ability cost no energy. This effect ends early if you are no longer wearing Medium Armor."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-strength-methods",
  "name": "Strength Methods",
  "archetype": "martial",
  "theory": false,
  "requires": 2,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Intimidate",
      "text": "Your persuasion and deception rolls impose Disadvantage against their target’s counter rolls so long as your Strength is higher than theirs. If they are a size larger than you, your Strength needs to be twice as high to trigger this effect (scaling for each size larger they are). Works inversely against smaller sizes."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Heave!",
      "text": "Cost: Energy equal to double your STR min. Prior to making a Heavy attack, you can use this ability. That attack is Strengthened and gets the Bash tag for that attack (if it already has Bash, it instead gets Bash+)."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Crunch Time",
      "text": "Cost: Energy equal to your STR min. Whenever you would apply Force from a Martial source, you can use this ability. The force is matched against the target’s Current Health instead of their Max Health."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Ho!",
      "text": "Cost: Energy equal to your STR min. Prior to making a Thrown Heavy Weapon attack that is not Good, you can use this ability. If Average, that attack is instead treated as Good. If Bad, that attack is instead treated as Average and this ability may be used again for that attack."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Unstoppable",
      "text": "Cost: Energy equal to double your STR min. At any time, you can use this ability. You become Unstoppable until the start of your next turn. While Unstoppable, any rolls you make to resist negative conditions and effects are rolled with Advantage, and your stats are considered twice as high for resisting negative conditions and effects (stacks with Pure Body)."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-striker-weapons",
  "name": "Striker Weapons",
  "archetype": "martial",
  "theory": false,
  "requires": 2,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Rend",
      "text": "Cost: Energy equal to half of your Scaling Stat min, rounded down. Prior to making a Striker Weapon attack that would hit an object at any point in its attack, you can use this ability. The damage dealt to all objects with this attack is Strengthened. This applies after the Limit damage is removed from your attack, so a 30 damage attack against a 15 Limit object would deal 15 (30-15 Limit) damage through and 22 (15 Limit damage1.5) damage to the object."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Berserk",
      "text": "Cost: Energy equal to your Scaling Stat min. At the start of your turn, you can use this ability. Until the start of your next turn, Light Striker attacks get the Fast tag, and Heavy Striker attacks get the Solitary tag. When this effect would end, you can expend its energy cost to maintain it instead."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Shred",
      "text": "Rend attacks are Strengthened again if the attack only targets one thing."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Seeing Red",
      "text": "Cost: Energy equal to your Scaling Stat min. While under the effects of Berserk, you can use this ability. You make all non-attack rolls at Disadvantage, but the benefits of Berserk are upgraded to Fast+ and Solitary+. Lasts for the duration of that Berserk (maintaining Berserk continues these effects at no extra cost)."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Blood and Iron",
      "text": "The Cleave tag for Striker Weapons now applies to non-objects."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-defender-weapons",
  "name": "Defender Weapons",
  "archetype": "martial",
  "theory": false,
  "requires": 2,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Block",
      "text": "Parry is always active for Defender Weapons, costs no energy, and can be used to block attacks for other targets within the Defender Weapon’s range."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Shield Toss",
      "text": "Cost: Energy equal to half of your Scaling Stat min, rounded down. This ability can be used as an alternative to making a Thrown Defender attack, and can be done for AP or RP equal to the normal AP cost of that attack. If this attack is successful, choose one or more of the following:",
      "sub": [
       "1. Return to you immediately after finishing its attack.",
       "2. Deal no damage and instead Block an attack for that target (Note that this still requires you to have succeeded in attacking them with the toss).",
       "3. Be Strengthened (has no effect if Blocking)."
      ]
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Sword and Board",
      "text": "Cost: Energy equal to your Scaling Stat min. Prior to making an attack with a non-Defender Weapon while holding a Defender Weapon in a different hand, you can use this ability. Make an attack roll with your Defender Weapon. If you hit, you deal damage as normal and impose Disadvantage on the target’s dodge roll against your triggering attack."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Bounce",
      "text": "If you use Shield Toss and it hits its attack roll, instead of having it return you can have it bounce to another target within range, making an attack roll with Disadvantage against the new target. This effect can keep triggering on the same Shield Toss, but the Disadvantage stacks."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following action:",
    "entries": [
     {
      "name": "Perfect Block",
      "text": "Whenever Block is used with a Defender Weapon, you can instead make an attack roll against that incoming attack roll. On hit, that attack is completely negated, and on miss, your Block does not apply to that hit."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-weighted-weapons",
  "name": "Weighted Weapons",
  "archetype": "martial",
  "theory": false,
  "requires": 2,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following abilities:",
    "entries": [
     {
      "name": "Controlled Swing (Light)",
      "text": "Cost: Energy equal to your Scaling Stat min. Prior to making a Light Weighted Weapon attack, you can use this ability. Your attack gains your choice of Advantage on its attack roll or Solitary (allowing another attack to be made as per Solitary’s rules)."
     },
     {
      "name": "Wild Swing (Heavy)",
      "text": "Cost: Energy equal to your Scaling Stat min. Prior to making a Heavy Weighted Weapon attack, you can use this ability. Your attack gets Disadvantage on its roll, but gains your choice of Bash+, two stacks of Strengthened, or Bash and one stack of Strengthened."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Spin",
      "text": "Cost: Energy equal to your Scaling Stat min. Prior to making a Weighted Weapon attack, you can use this ability. Your attack is made as an Area attack against all targets within your melee attack range."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Wide Arc",
      "text": "Your Weighted Weapon attacks gain Farstrike so long as they are made while Strafing (moving and attacking at the same time)."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Smashing",
      "text": "Cost: Energy equal to double your Scaling Stat min. At the start of your turn, you can use this ability. Strengthened now applies to your Weighted Attack’s Knockback additively with other boosts, lasting until the start of your next turn."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Crunch",
      "text": "When you use Controlled or Wild Swing against a prone target, you instead get both effects. Wild Swing specifically gives Bash+ and two stacks of Strengthened."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-assault-weapons",
  "name": "Assault Weapons",
  "archetype": "martial",
  "theory": false,
  "requires": 2,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following action:",
    "entries": [
     {
      "name": "Quickload",
      "text": "Whenever you attempt to attack while out of ammo with a held Assault Weapon, you can choose to forgo that attack (still using the resources needed for that attack) to reload instantly."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Take Aim",
      "text": "Cost: Energy equal to your Scaling Stat min. Prior to making an Assault Weapon attack, you can use this ability. That attack gets your choice of Advantage on its attack roll or Strengthened."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Distracting Fire",
      "text": "Cost: Energy equal to half of your Scaling Stat min, rounded down. When you would be attacked by an attack you can sense within your Assault Weapon range while holding an Assault Weapon, you can use this ability. Make an attack roll against the offending attack roll. If you hit, the triggering attack suffers Disadvantage on its attack roll and is Weakened. Distracting Fire itself only deals damage to whatever the offending thing is."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Cool Breath",
      "text": "Take Aim no longer costs energy so long as you do not move this turn (if used like this it prevents you from moving for the rest of the turn)."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Proper Stance",
      "text": "Cost: Energy equal to double your Scaling Stat min. At the start of your turn, if you are holding an Assault Weapon, you can use this ability. Your Assault Weapon attacks have Solitary+ until the start of your next turn. If at any point you swap Weapons, this effect ends."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-heavy-armor",
  "name": "Heavy Armor",
  "archetype": "martial",
  "theory": false,
  "requires": 2,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following action:",
    "entries": [
     {
      "name": "Brace",
      "text": "You can now use Parry on worn Heavy Armor, using your CON as the Scaling Stat, changing it to do the following instead: reduces the incoming damage by your Constitution stat."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Trudge",
      "text": "Cost: Energy equal to a quarter of your CON min, rounded down. Prior to moving while wearing Heavy Armor, you can use this ability. You ignore the Heavy Armor movement speed penalty for that instance of movement."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Bodyslam",
      "text": "Cost: Energy equal to your CON min. You can use this ability while wearing Heavy Armor by spending 3 AP. Make an attack roll against a target within your personal melee range. On hit, you slam your body into the target, dealing Physical damage equal to your worn armor’s Limit plus your Constitution min to them."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Harden",
      "text": "Cost: Energy equal to your CON min. When Brace would apply, you can use this ability to apply Weakened to the incoming attack (Weakened applies first)."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Launch",
      "text": "When you hit with Bodyslam while wearing Heavy Armor, instead of applying damage as normal, you can instead apply 10x that amount in Force to the target in the direction of your attack."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-dexterity-methods",
  "name": "Dexterity Methods",
  "archetype": "martial",
  "theory": false,
  "requires": 3,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Fast Lips",
      "text": "Your persuasion and deception rolls have Advantage against targets with less Dexterity than you. If they are a size smaller than you, your Dexterity needs to be twice as high to trigger this effect (scaling for each size smaller they are). Works inversely against larger sizes."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Shank",
      "text": "Cost: Energy equal to double your DEX min. Prior to making a Light attack, you can use this ability. That attack gets three of the following (your choice, repeated effects are in parentheses):",
      "sub": [
       "1. Pierce, upgrading existing Pierce to Pierce+ (Pierce+, does not stack with existing Pierce, does not upgrade again).",
       "2. Cleave, upgrading existing Cleave to Cleave+ (Cleave+, does not stack with existing Cleave, does not upgrade again).",
       "3. Imposes Disadvantage on their dodge roll (two Disadvantages, then three Disadvantages).",
       "4. Advantage on the attack roll (two Advantages, then three Advantages)."
      ]
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Quick Change",
      "text": "Changing your held item can now be done with 1 RP."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Spot Weakness",
      "text": "Cost: Energy equal to half of your DEX min, rounded down. Can be used as an alternative to a Spot action. Follows the standard rules of the Spot action, but can only target already sensed characters, and instead automatically reveals to you what armor they are wearing (if any), and its stats."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Pinpoint Accuracy",
      "text": "Cost: Energy equal to a quarter of your DEX min, rounded down. Prior to making a Light attack with Fast, Solitary, or Pepper that would have the negative of that effect applied, you can use this ability. That attack is made with no base penalty."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-reach-weapons",
  "name": "Reach Weapons",
  "archetype": "martial",
  "theory": false,
  "requires": 3,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following action:",
    "entries": [
     {
      "name": "Palisade",
      "text": "You can now Riposte with Reach Weapons whenever a target attempts to enter into your Reach Weapon’s melee attack range. If you hit, their movement is cancelled and they are stopped right outside of your melee attack range (meaning if they were to attempt to move again they would trigger this action again)."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Thrust",
      "text": "Cost: Energy equal to half of your Scaling Stat min, rounded down. Prior to making a Reach Weapon attack, you can use this ability. If your attack is Light, it gains the Cleave tag. If your attack is Heavy, it gains the Cleave+ tag."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Wall",
      "text": "Cost: Energy equal to half of your Scaling Stat min, rounded down. Can be used as an alternative to Palisade. Follows the same rules as Palisade, but the attack does not require RP to be made."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Twist",
      "text": "Cost: Energy equal to your Scaling Stat min. When you deal direct damage to a target with a Reach Weapon attack, you can use this ability. Add additional damage equal to your Weapon’s Pierce value to the attack (since this is triggered by direct damage, this would result in the added damage also being direct)."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Impale",
      "text": "Cost: Energy equal to double your Scaling Stat min. When you deal direct damage to a target with a Reach Weapon attack, you can use this ability. The target becomes grappled at the end of your Weapon. While they are grappled, you cannot make more attacks with that Reach Weapon."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-circular-weapons",
  "name": "Circular Weapons",
  "archetype": "martial",
  "theory": false,
  "requires": 3,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "What Goes Around",
      "text": "Cost: Energy equal to your Scaling Stat min. Prior to making a Thrown Circular Weapon attack, you can use this ability. The Weapon returns to you, making an additional attack roll against one target within the return arc (can be the original attack target)."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Pierce Through (Light)",
      "text": "Cost: Energy equal to half of your Scaling Stat min, rounded down. Prior to making a Light Circular Weapon attack, you can use this ability. Your attack gains your choice of Advantage on its attack roll or the Pierce+ tag."
     },
     {
      "name": "Cut Through (Heavy)",
      "text": "Cost: Energy equal to half of your Scaling Stat min, rounded down. Prior to making a Heavy Circular Weapon attack, you can use this ability. Your attack gains your choice of Strengthened or the Cleave+ tag."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Let it Rip!",
      "text": "Cost: Energy equal to half of your Scaling Stat min, rounded down. Prior to making a Circular Weapon attack, you can use this ability. If the attack hits, its damage is repeated again against the same target. This ability cannot be chained within the same attack."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Shadow Wings",
      "text": "If you would use Pierce Through or Cut Through on a Thrown Circular Weapon attack made from at least half stealth, it would instead gain both of the effects from that ability."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Vector Assault",
      "text": "The return attack from What Goes Around is made from half stealth automatically."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-blast-weapons",
  "name": "Blast Weapons",
  "archetype": "martial",
  "theory": false,
  "requires": 3,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Point Blank",
      "text": "Targets attempting to dodge your Blast Weapon attacks while within your personal melee range have Disadvantage on their dodge roll. Applies to Area Blast Weapon attacks as well."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Cone Shot",
      "text": "Cost: Energy equal to your Scaling Stat min. Prior to making an Area Blast Weapon attack, you can use this ability. The area affected by your attack is instead changed to be a 45 degree cone originating from your position, with a distance equal to half of your Weapon’s attack range."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Rip and Tear",
      "text": "Whenever you deal damage with a Blast Weapon attack, you may reload that Weapon for free."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Punch",
      "text": "Cost: Energy equal to your Scaling Stat min. Prior to making a Blast Weapon attack, you can use this ability. If your attack is Light, it gains the Knockback tag. If your attack is Heavy, it gains the Knockback+ tag."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Execute",
      "text": "Cost: Energy equal to your Scaling Stat min. Prior to making a Blast Weapon attack against a target within melee range that is prone, you can use this ability. Your attack gets two stacks of Strengthened."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-light-armor",
  "name": "Light Armor",
  "archetype": "martial",
  "theory": false,
  "requires": 3,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Shift",
      "text": "Cost: Energy equal to a quarter of your CON min, rounded down. When you are attacked while wearing Light Armor, you can use this ability. You either gain Advantage on your dodge roll or impose Disadvantage on the incoming attack roll, your choice."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Dash",
      "text": "Cost: Energy equal to half of your CON min, rounded down. You can use this ability at any time for 1 RP, so long as you are wearing Light Armor and are not under attack. Immediately move up to your movement speed. The RP cost of this ability is affected by movement slows."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Leap",
      "text": "Cost: Energy equal to half of your CON min, rounded down. You can use this ability while wearing Light Armor by spending 1 AP. You Jump, following normal Jumping rules. The AP cost of this ability is affected by movement slows, but not doubly so as normal jump rules would state."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Evade",
      "text": "Shift can now be used twice per triggering instance, both still costing energy as normal."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Breathing Room",
      "text": "While wearing Light Armor, your first usage of Shift, Dash, and Leap each round costs no energy."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-constitution-methods",
  "name": "Constitution Methods",
  "archetype": "martial",
  "theory": false,
  "requires": 4,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "One with Body",
      "text": "You are aware of any wounds, poisons, and diseases that affect you, as well as all of their effects (unless stated otherwise)."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Taunt",
      "text": "Cost: Energy equal to your CON min. You can use this ability at any time by spending 2 RP. Make a contested Persuasion or Deception check against a target who can sense you within 100ft. They are compelled to attack you until they are no longer within 100ft of you or the effect ends. They can repeat this check at the end of each of their turns or by spending 2 AP/RP, with each repeat giving you a stacking Disadvantage on your check. Lasts until the start of your next turn."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Pure Body",
      "text": "Your Martial stats are twice as high for the purpose of resisting negative effects and abilities (stacks with Unstoppable), and you automatically succeed on Martial checks that have a target number or contested result that is less than half of your relevant stat. When resisting any negative effect or ability, you may use your Constitution (not counting the doubling by Pure Body) in place of the required stat."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Pull Aggro",
      "text": "Cost: Energy equal to your CON stat. Can be used as an alternative to Taunt. Follows the same rules as Taunt, but instead you make the check against all targets within 30ft of you."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Imposing Presence",
      "text": "Attacks made against you from within your personal melee range are Weakened so long as they already have at least one stack of Weakened."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-curved-weapons",
  "name": "Curved Weapons",
  "archetype": "martial",
  "theory": false,
  "requires": 4,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Disarm",
      "text": "Cost: Energy equal to your Scaling Stat min. Prior to making a Curved Weapon attack against a target that is holding something, you can use this ability. Your attack is Weakened, but if you hit, the target immediately releases their held thing, be it a grappled target, Weapon, Foci, etc."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following action:",
    "entries": [
     {
      "name": "Perfect Parry",
      "text": "Whenever Parry is used with a Curved Weapon, you can instead make an attack roll with Advantage against that incoming attack roll. On hit, that attack is completely negated, and on miss, your Parry does not apply to that hit."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Momentum",
      "text": "When you hit a target with a Curved Weapon attack, you can choose to give all further Curved Weapon attacks against that target one stack of Advantage or Strengthened. This effect stacks, and lasts until the start of your next turn."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Sheath Weapon",
      "text": "Cost: Energy equal to double your Scaling Stat min. At the end of your turn, you can use this ability if you have dealt direct damage with a Curved Weapon this turn. Immediately repeat all direct damage you dealt with Curved Weapon attacks during your turn back to those targets. This damage does not ignore armor."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following action:",
    "entries": [
     {
      "name": "Omnislash",
      "text": "Prior to making a Curved Weapon attack against a target with 4 or more Momentum stacks, you can use this action. Consume all Momentum stacks on that target, your attack automatically hits and is treated as a Double Crit."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-longshot-weapons",
  "name": "Longshot Weapons",
  "archetype": "martial",
  "theory": false,
  "requires": 4,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Prepared Shot",
      "text": "Cost: Energy equal to double your Scaling Stat min. Prior to making a Longshot Weapon attack, you can use this ability. Your attack gains Advantage on its attack roll and one of the following (your choice):",
      "sub": [
       "1. Cleave+",
       "2. Pierce+",
       "3. Strengthened"
      ]
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Like Shooting Fish",
      "text": "Cost: Energy equal to your Scaling Stat min. Prior to making a Longshot Weapon attack, you can use this ability. If you hit, the target moves as if affected by rough terrain (+1 AP to move) until the start of your next turn."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Snipe Hunt",
      "text": "Cost: Energy equal to your Scaling Stat min. Prior to making a Longshot Weapon attack that has at least one stack of Advantage, you can choose to use this ability. Your opponent gets a number of Disadvantages dodging your attack equal to the Advantages you have on your attack roll."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "In a Barrel",
      "text": "When you make a Longshot Weapon attack against a target suffering from any movement penalty, you get an Advantage on that attack roll."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Headshot",
      "text": "Cost: Energy equal to your Scaling Stat. Can be used as an alternative to Prepared Shot. Your attack gains Advantage on its attack roll and all three of Prepared Shot's options (Cleave+, Pierce+, and Strengthened)."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-titanic-armor",
  "name": "Titanic Armor",
  "archetype": "martial",
  "theory": false,
  "requires": 4,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following action:",
    "entries": [
     {
      "name": "Giga Brace",
      "text": "You can now use Parry on worn Titanic Armor, using your CON as the Scaling Stat, changing it to do the following instead: reduces the incoming damage by double your Constitution stat."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Bodyslam",
      "text": "Cost: Energy equal to your CON min. You can use this ability while wearing Titanic Armor by spending 3 AP. Make an attack roll with Disadvantage against a target within your personal melee range. On hit, you slam your body into the target, dealing Physical damage equal to your worn armor’s Limit plus your Constitution min to them."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Giga Harden",
      "text": "Cost: Energy equal to half of your CON min, rounded down. When Giga Brace would apply, you can use this ability to apply Weakened to the incoming attack (Weakened applies first)."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Trudge",
      "text": "Cost: Energy equal to half of your CON min, rounded down. Prior to moving while wearing Titanic Armor, you can use this ability. You ignore the Titanic Armor movement speed penalty for that instance of movement."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Chunky",
      "text": "Pierce affects your worn Titanic Armor half as much, rounded down."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-grappling-methods",
  "name": "Grappling Methods",
  "archetype": "martial",
  "theory": false,
  "requires": 5,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Lock Down",
      "text": "Cost: Energy equal to the STR stat of your grappled target. Can be used at any time against a target you have grappled, or on a target that was just grappled by a Weapon you attacked them with. The target is forced prone for the duration of the grapple, they are disallowed from moving, and if they were to escape the grapple for any reason, they instead only remove Lock Down (essentially requiring two escapes)."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Disrupt",
      "text": "Cost: Energy equal to the STR min of your grappled target. Whenever your grappled target would attempt any roll, you can use this ability. They get Disadvantage on that roll."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Big Hands",
      "text": "You can now grapple targets that are up to one size larger than you, and you have Advantage on all grapple attacks you make."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Stunlock",
      "text": "Disrupt costs no energy on targets you have Locked Down."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following action:",
    "entries": [
     {
      "name": "Living Weapon",
      "text": "Creatures grappled by you can now be used as improvised melee Weapons, following the Weapon type that most closely matches their body type. They attack as a normal Weapon would, but do not do damage as the Weapon normally would; instead, you apply Force to them equal to 10x your Strength stat, and treat them as hitting a “wall” (the target of your attack) 0ft away, dealing damage to both them and the target (if the damage would exceed the health of the grappled target, it instead only deals that much damage to itself and the target)."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-thrasher-weapons",
  "name": "Thrasher Weapons",
  "archetype": "martial",
  "theory": false,
  "requires": 5,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following action:",
    "entries": [
     {
      "name": "Grapple",
      "text": "Prior to making a Thrasher Weapon attack, you can use this action. On hit, you deal no damage but the target is grappled by your Thrasher Weapon. While they are grappled, you cannot make more attacks with that Thrasher Weapon, and they cannot move outside of your Thrasher Weapon’s range."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Windup",
      "text": "Cost: Energy equal to your Scaling Stat min. Prior to making a Thrasher Weapon attack, you can use this ability. That attack has one extra Advantage on its attack roll. This effect can be used as many times as desired before an attack."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Overshield Strike",
      "text": "Cost: Energy equal to your Scaling Stat min. Prior to making a Thrasher Weapon attack, you can use this ability. That attack ignores half cover and the Parry ability (and all Parry type abilities)."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Whirligig",
      "text": "Every two uses of Windup additionally grants that attack one stack of Strengthened."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Get Over Here!",
      "text": "Cost: Energy equal to double your Scaling Stat min. Can be used in place of any Thrasher Weapon Attack, still benefiting from any skills or features that affect them, and still dealing damage. On hit, the attack grapples the target, pulls the target into melee range of you, and knocks them prone (or applies Lock Down if you have it unlocked)."
     }
    ]
   }
  ]
 },
 {
  "id": "martial-unarmored",
  "name": "Unarmored",
  "archetype": "martial",
  "theory": false,
  "requires": 5,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Dash",
      "text": "Cost: Energy equal to a quarter of your CON min, rounded down. You can use this ability at any time for 1 RP, so long as you are not wearing armor. Immediately move up to your movement speed. The RP cost of this ability is affected by movement slows. If used while under attack, you impose Disadvantage on the incoming attack roll and move for 1 RP after the attack hits/misses."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Leap",
      "text": "Cost: Energy equal to a quarter of your CON min, rounded down. You can use this ability while wearing no armor by spending 1 AP. You Jump, following normal Jumping rules. The AP cost of this ability is affected by movement slows, but not doubly so as normal jump rules would state."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Speedy",
      "text": "Dash no longer costs energy."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Quicken",
      "text": "Cost: Energy equal to your CON min. You can use this ability at the start of your turn so long as you are wearing no armor. Doubles your movement speed until the start of your next turn. This effect ends early if you put armor on."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Unfettered",
      "text": "You are immune to all Stage 1 movement slows while you are not wearing armor, and you have Advantage on your dodge rolls against all attacks."
     }
    ]
   }
  ]
 },
 {
  "id": "magic-theory",
  "name": "Magic Theory",
  "archetype": "magic",
  "theory": true,
  "requires": 0,
  "tiers": [
   {
    "tier": 0,
    "free": true,
    "summary": "You gain the following actions:",
    "entries": [
     {
      "name": "Core Spells",
      "text": "Every Magic Skill Tree (aka Spell School) is built around one Core Spell. As you advance, you learn Spell Mods that reshape that Core Spell. If you branch into another School, you can combine their Core Spells into a unique Combo Spell, which can then use Mods from either parent School."
     },
     {
      "name": "Spell Mods",
      "text": "A Spell Mod is an optional upgrade applied when casting a Spell within a given Spell School. Unless stated otherwise, each Spell Mod can only be applied once per cast."
     },
     {
      "name": "",
      "text": "Stackable Mods may be applied multiple times. Each time you apply the Mod, increase the Spell’s Threshold again."
     },
     {
      "name": "",
      "text": "Universal Mods can be applied to any Core or Combo Spell from any Spell School."
     },
     {
      "name": "",
      "text": "Replacement Mods can either replace a Spell’s listed base effect (only replacing a Combo Spell’s relevant part), or simply add on like a normal Spell Mod. When a Replacement Mod replaces a Spell’s base effect, it is doubled in Power and any effects that would modify the Core/Combo Spell instead modify the Replacement Mod."
     },
     {
      "name": "Spell Threshold",
      "text": "Every Spell has a Threshold value, and the various Spell Mods increase it as well. The Threshold determines how much energy your Spell will cost to cast, with every Threshold equating to half of your skill points, rounded down, in energy cost. For example, a Threshold 4 Spell on a 30 skill point character would cost 60 energy (4(30/2))."
     },
     {
      "name": "Threshold Reduction (TR)",
      "text": "Each casting type (seen below) has its own Threshold Reduction (TR) value. This value lowers the Threshold of Spells you cast, essentially lowering their energy cost. Spells cannot go below 0 Threshold, and at 0 Threshold they are entirely free to cast energy wise. TR can also be gained from various equipment and skills, though it is rare to find."
     },
     {
      "name": "Spell Casting",
      "text": "To cast a Spell, choose a Core Spell or Combo Spell, apply any relevant Spell Mods, then cast it through one of the following methods:",
      "sub": [
       "1. An Igniter Foci and at least 10 Grasp (Spells cast this way take 2 AP to cast and have 1 TR).",
       "2. A Channeler Foci and at least 10 Reach (Spells cast this way take 3 AP but have 2 TR).",
       "3. At least 10 Reach and 10 Grasp, no Foci, and a free hand or Multi Foci (this is known as Raw Casting). See below for more info."
      ]
     },
     {
      "name": "Raw Casting",
      "text": "If you choose not to use a Foci or are using a Multi Foci, Spells can instead be cast utilizing yourself as the conduit. Spells cast this way use the lower of your Reach and Grasp as the Scaling Stat and their AP cost can be any of the following:",
      "sub": [
       "1 AP: 1 TR.",
       "2 AP: 2 TR.",
       "3 AP: 3 TR."
      ]
     },
     {
      "name": "Spell Power",
      "text": "All Spells automatically scale for every 10 points in your relevant Scaling Stat (assuming you are casting them through a Foci of high enough Grade, otherwise they are limited by that Grade), this is known as your Spell Power (SP). When determining what a Spell does on cast, scale its bolded effect by your SP. So a Spell that does 10d6 damage would scale to deal 30d6 if your Scaling Stat is 30. Any effects that modify the Power of a Spell are additive, so two 50% increases would result in a 100% increase in Power. Spells by default have a health value equal to your Scaling Stat when they are cast, unless stated otherwise."
     },
     {
      "name": "Spell Attack Types",
      "text": "The attack type of a Spell is determined by what that Spell has listed, and it can be changed by various Spell Mods.",
      "sub": [
       "Melee: All Spells cast at a target within your personal melee range are considered melee attacks regardless of their normal range type. Spells cast this way have advantage on their attack rolls.",
       "Ranged: Has a maximum range of 200ft. The attack is made as normal, respecting cover.",
       "Targeted: Has a maximum range of 100ft. The attack is automatically made from half stealth (unless the target is immune to stealth attacks or has Primary/Heightened Spirit Sense). Doubles up with Melee if made in melee.",
       "Area: Can either be a 10ft radius, a 20ft 90 degree cone, or a 30ft by 5ft line. Each target in the area must defend separately against your singular attack roll. This Area can include yourself if desired."
      ]
     }
    ]
   },
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the Protection Arcana, Gravity, Slashing, Piercing, and Crushing magic schools. You also gain the following Spell Mods:",
    "entries": [
     {
      "name": "Pinpoint",
      "text": "2 Threshold, Spell Mod, Universal. This Spell has advantage on its initial casting attack roll(s)."
     },
     {
      "name": "React",
      "text": "1 Threshold, Spell Mod, Universal. This Spell is cast using an equal amount of RP instead of AP, and can be cast outside of your turn."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the Reach Arcana, Heat, Cold, Radiation, and Acid magic schools. You also gain the following actions:",
    "entries": [
     {
      "name": "Ritual Casting",
      "text": "Unlocks a new way to cast Spells, known as Rituals. To cast this way, one must spend a longer period of time channeling energy into the Spell as a heavy activity, requiring a number of hours equal to the Threshold of the Spell (ignoring TR). While a Ritual is active, your maximum energy is reduced by half of the total energy cost of that Spell (ignoring TR, rounded down), only returning when the Ritual ends. While a Ritual is active, it can be hidden inside of you for 2 AP. This does not end the Ritual, it merely makes it impossible to detect by any means. At any time, you can make a hidden Ritual reappear anywhere within its normal cast range using 2 AP/RP."
     },
     {
      "name": "Focus",
      "text": "You may select one of your Core Spells to be your Focused Spell, it gains 1 additional TR whenever you cast it. This additionally applies to any Combo Spells that Core Spell is a part of. You can change the chosen Core Spell whenever you rest."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the Grasp Arcana, Venomancy, Charm, and Witchery magic schools. You also gain the following Spell Mod and action:",
    "entries": [
     {
      "name": "Empower",
      "text": "2 Threshold, Spell Mod, Universal. This Spell gains +100% Power to its Core or Combo bolded effect(s)."
     },
     {
      "name": "Weaving",
      "text": "Whenever you make a non-Magical attack, you may cast a Spell alongside it for no additional AP or RP cost, as long as the Spell’s normal AP/RP cost equals the non-Magical attack’s AP/RP cost. The Spell must have the same attack type and primary target as the non-Magical attack. The Spell still costs Energy, does not benefit from TR, requires its own attack roll, and resolves its damage/effects separately."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock Build Arcana, Summoning, Creation, and Animation magic schools. You also gain the following Spell Mod and Passive:",
    "entries": [
     {
      "name": "Snipe",
      "text": "2 Threshold, Spell Mod, Universal. Double this Spell’s range. If the Spell uses an area, double the area’s listed dimensions. It has disadvantage on its initial cast’s attack roll if it is made in this extra range/area."
     },
     {
      "name": "Connection",
      "text": "Your Focused Spell now additionally benefits from your choice of Pinpoint, Empower, or Snipe for no added Threshold."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock Restoration Arcana, Geomancy, Illusion, and Arcanomancy magic schools. You also gain the following Spell Mod and Passive:",
    "entries": [
     {
      "name": "Duplicate",
      "text": "3 Threshold, Spell Mod, Universal. This Spell is cast once more after the initial cast for no extra energy or AP/RP, the second cast being at any valid target of your choosing. Works multiplicatively with other duplication effects."
     },
     {
      "name": "Webmaster",
      "text": "Weaving now benefits from TR."
     }
    ]
   }
  ]
 },
 {
  "id": "magic-protection-arcana",
  "name": "Protection Arcana",
  "archetype": "magic",
  "theory": false,
  "requires": 1,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the following Core Spell:",
    "entries": [
     {
      "name": "Shield",
      "text": "1 Threshold, Core Spell, Targeted, Uncombinable. This Spell can be used to project a shield of energy on a target within range until the start of your next turn. The shield has a total of 10 health which it uses to absorb damage that would attempt to harm the target or anything the target is wearing/holding. Does not stack with itself, treat the Limit of this shield as being equal to its health. Ritual: Lasts until the Ritual ends or the shield breaks."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Reflect",
      "text": "2 Threshold, Spell Mod, Universal. Any damage this Spell takes is sent back as a Ranged Attack roll against the damage’s source so long as it is within 200ft of this effect (this does not negate the damage). You make the attack roll in this instance, even if you lack the required sense(s) to do so (it would be made at disadvantage in that case)."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Adjust",
      "text": "1 Threshold, Spell Mod. While the Shield is on the target, they can choose what of their held/worn items apply before and after the Shield. In addition, whenever another target within 10ft of the initial target would take damage, the initial target can extend the Shield to protect them from that damage as a free reaction."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Emplace",
      "text": "1 Threshold, Spell Mod. The Shield changes its attack type to Area, no longer applying its effects to a single target. Instead, the Shield now applies its effects as a one-way Shield, set up as desired within the Area range. This also prevents movement through the chosen direction."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Dampen",
      "text": "1 Threshold, Spell Mod, Stackable, Universal. Choose an Archetype. Any damage this Spell would take from that Archetype is Weakened. Subsequent stacks of this cannot pick the same Archetype, but instead can be used to add more chosen Archetypes."
     }
    ]
   }
  ]
 },
 {
  "id": "magic-gravity",
  "name": "Gravity",
  "archetype": "magic",
  "theory": false,
  "requires": 1,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the following Core Spell:",
    "entries": [
     {
      "name": "Force",
      "text": "1 Threshold, Core Spell, Ranged. This Spell can be used to attempt to forcefully move a target within range, applying 8d10 Force to them in a direction of your choosing. If this were to push the target out of the way of an incoming attack, give disadvantage to that attack roll. Ritual: While the Ritual is active, you may cast Force up to two times without spending Energy. These casts still require AP/RP. Once both casts are used, the Ritual ends."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the following Spell Mods:",
    "entries": [
     {
      "name": "Burden",
      "text": "1 Threshold, Spell Mod, Replacement. The Spell applies 20 Slow stacks to the target. Ritual: The Slow stacks last until the Ritual ends, and cannot be removed otherwise."
     },
     {
      "name": "Lighten",
      "text": "1 Threshold, Spell Mod, Replacement. The Spell applies 20 Haste stacks to the target. Ritual: The Haste stacks last until the Ritual ends, and cannot be removed otherwise."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the following Spell Mods:",
    "entries": [
     {
      "name": "Personal Repulsion",
      "text": "1 Threshold, Spell Mod, Replacement, Targeted. The Spell gives the target a personal repulsion field that lasts until the start of your next turn. Any incoming attack that has a Scaling Stat value of 20 or less has disadvantage on its attack roll. Ritual: Lasts until the Ritual ends."
     },
     {
      "name": "Personal Well",
      "text": "1 Threshold, Spell Mod, Replacement, Targeted. The Spell gives the target a personal gravity well that lasts until the start of your next turn. Any incoming attack that has a Scaling Stat value of 20 or less has advantage on its attack roll. Ritual: Lasts until the Ritual ends."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Hold",
      "text": "2 Threshold, Spell Mod, Replacement, Targeted. The Spell grapples the target in place with Magical force on a successful hit until the start of your next turn. Their counter grapple check must get a minimum of 2 on the roll to break free from this hold. This value is halved for every size above 3 the creature is, and doubled for every size below 3. If the target is already grappled, they instead take 1d12 physical damage. Ritual: Lasts until the Ritual ends or the target is no longer grappled."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Gravity Field",
      "text": "2 Threshold, Spell Mod. The Spell changes its attack type to Area, applying its effect to all targets within the area. In addition, its Ritual form now continues the application in the area until the Ritual ends (this changes Force’s Ritual to be this instead, effects do not stack and apply at the start of each of your turns)."
     }
    ]
   }
  ]
 },
 {
  "id": "magic-slashing",
  "name": "Slashing",
  "archetype": "magic",
  "theory": false,
  "requires": 1,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the following Core Spell:",
    "entries": [
     {
      "name": "Cut",
      "text": "1 Threshold, Core Spell, Ranged. This Spell can be used to cut at a target, dealing 2d6 physical damage to them. If the target is living and this Spell would deal direct damage to them, this Spell’s damage die size is increased by 4. Ritual: While the Ritual is active, you may cast this Spell up to two times without spending Energy. These casts still require AP/RP. Once both casts are used, the Ritual ends."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Bleed",
      "text": "2 Threshold, Spell Mod. Any direct damage dealt by this Spell is dealt again to the target as direct physical damage at the start of their next turn. Reapplies any other effects that this Spell has on that damage being dealt."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Gash",
      "text": "3 Threshold, Spell Mod. Any direct damage dealt by this Spell is repeated any time the target spends AP or RP to voluntarily move, lasting until the start of your next turn. Reapplies any other effects that this Spell has on that damage being dealt."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Rend",
      "text": "1 Threshold, Spell Mod. The damage dealt by this Spell is increased by your Scaling Stat min."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Chop",
      "text": "2 Threshold, Spell Mod. Any direct damage dealt by this Spell is instead treated as Max HP loss."
     }
    ]
   }
  ]
 },
 {
  "id": "magic-piercing",
  "name": "Piercing",
  "archetype": "magic",
  "theory": false,
  "requires": 1,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the following Core Spell:",
    "entries": [
     {
      "name": "Stab",
      "text": "1 Threshold, Core Spell, Ranged. This Spell can be used to stab a target, dealing 1d10 physical damage to them. If this Spell crits, it gets an additional stack of Strengthened in addition to the normal crit effects. Ritual: While the Ritual is active, you may cast this Spell up to two times without spending Energy. These casts still require AP/RP. Once both casts are used, the Ritual ends."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Exploit",
      "text": "1 Threshold, Spell Mod, Stackable. If your attack roll against the target of this Spell has an advantage, you can consume that advantage to give your attack +4 die size. Each stack requires another instance of advantage to give another instance of die size."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Pierce",
      "text": "1 Threshold, Spell Mod, Stackable. This Spell gains the Pierce property with a value of 10 (ignores that much Limit of objects it would hit)."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Setup",
      "text": "1 Threshold, Spell Mod, Stackable. If this Spell deals direct damage to the target, you have advantage on your next attack roll that would be made at them before the start of your next turn. Each stack adds another instance of advantage to that same attack roll."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Weakpoint",
      "text": "2 Threshold, Spell Mod. Any object that would block this Spell from hitting the target only applies half of its Limit to this Spell’s damage, rounded down."
     }
    ]
   }
  ]
 },
 {
  "id": "magic-crushing",
  "name": "Crushing",
  "archetype": "magic",
  "theory": false,
  "requires": 1,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the following Core Spell:",
    "entries": [
     {
      "name": "Slam",
      "text": "1 Threshold, Core Spell, Ranged. This Spell can be used to slam a target, dealing 1d12 physical damage to them. In addition, the target’s dodge rolls suffer -2 die size until the start of your next turn (this effect does not stack). Ritual: While the Ritual is active, you may cast this Spell up to two times without spending Energy. These casts still require AP/RP. Once both casts are used, the Ritual ends."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Crush",
      "text": "1 Threshold, Spell Mod. If the opponent’s dodge roll against this Spell is less than or equal to a third of their normal maximum possible and the Spell would hit, the damage this Spell deals is Strengthened."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Bash",
      "text": "1 Threshold, Spell Mod, Stackable. This Spell gains the Bash property with a value of 10 (if an object has this much Limit or less, ignore it and deal damage equal to its Limit as extra damage to the target)."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Beatdown",
      "text": "1 Threshold, Spell Mod. Targets hit by this Spell must make an extra dodge roll against your initial attack roll, and on failure they are knocked prone."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Telegraph",
      "text": "1 Threshold, Spell Mod. Prior to making the attack roll for this Spell, predict what your opponent will roll on their dodge roll. If they roll within 1 of your guess, this Spell rolls twice as many damage dice."
     }
    ]
   }
  ]
 },
 {
  "id": "magic-reach-arcana",
  "name": "Reach Arcana",
  "archetype": "magic",
  "theory": false,
  "requires": 2,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Multicast",
      "text": "2 Threshold, Spell Mod, Universal. After casting this Spell, you can spend AP/RP equal to the AP/RP spent to cast the Spell (minimum 1) to instantly recast it at the same target for free. Works multiplicatively with other duplication effects."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Lob",
      "text": "1 Threshold, Spell Mod, Universal. Can only be added onto a Spell whose attack type is Area. This Spell now casts at the end of a single target Ranged version of this Spell (meaning it can hit twice on the primary target), with the Area expanding from the point the ranged Spell hits. The primary Area Spell triggers whether or not the Ranged part hits."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Mold",
      "text": "1 Threshold, Spell Mod, Universal. This Spell ignores half cover completely, and if it is of attack type Area you can choose who in the area is attacked by the Spell."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Explode",
      "text": "3 Threshold, Spell Mod, Universal. Can only be added onto a Spell whose attack type is Ranged. This Spell now explodes in an Area version of this Spell starting at where the Spell would hit, expanding however you’d like (meaning it can hit twice on the primary target). The Area part triggers whether or not the primary Ranged Spell hits."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the following Passive:",
    "entries": [
     {
      "name": "Minigun",
      "text": "Multicast becomes Stackable. Each instance requires its own usage of AP/RP."
     }
    ]
   }
  ]
 },
 {
  "id": "magic-heat",
  "name": "Heat",
  "archetype": "magic",
  "theory": false,
  "requires": 2,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the following Core Spell:",
    "entries": [
     {
      "name": "Flame",
      "text": "1 Threshold, Core Spell, Ranged. This Spell can be used to produce a flame which can be launched at a target, dealing 1d12 heat damage to the target and applying that many Ignite stacks to whatever is damaged. If done in melee, the Spell can instead deal no damage (still applying Ignite stacks) to keep it available to use until the start of your next turn. This can be repeated using the same amount of AP each time as was used to cast this Spell. In addition, while this Spell or its Ignite effect is active, it can produce light up to 30ft away (chosen at Spell cast). Ritual: The flame no longer goes out naturally so long as it is being used for melee attacks only. This lasts until used as any other attack type or the Ritual ends."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Ignition",
      "text": "1 Threshold, Spell Mod. If the target has no Ignite stacks on them as this Spell hits, this Spell applies three times as many Ignite stacks (if the Spell applies no Ignite stacks, instead it applies Ignite stacks equal to double the damage dealt). If the target has Ignite stacks on them, instead this Spell triggers them after applying all other effects."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Brand",
      "text": "3 Threshold, Spell Mod. If this Spell hits, prior to it dealing damage the target gets marked with a Brand until the start of your next turn. While under the effects of a Brand, anytime they take heat damage that isn’t from Brand, they are dealt heat damage equal to the base damage of the Spell this mod is attached to."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Flare",
      "text": "2 Threshold, Spell Mod. The damage dice of this Spell are split into a proportional amount of d4s instead, and each proportional set of d4s deals its damage separately (so if you use 2d12 normally, this would do 2 3d4s each dealt separately)."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Cook",
      "text": "2 Threshold, Spell Mod. This Spell deals 1d4 additional heat damage for every time you have dealt heat damage to the target since the start of your turn."
     }
    ]
   }
  ]
 },
 {
  "id": "magic-cold",
  "name": "Cold",
  "archetype": "magic",
  "theory": false,
  "requires": 2,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the following Core Spell:",
    "entries": [
     {
      "name": "Frost",
      "text": "1 Threshold, Core Spell, Ranged. This Spell can be used to produce a frost which can be launched at a target, dealing 1d8 cold damage and removing that much energy from them. If done in melee, the Spell can instead deal no damage (still removing energy) to keep it available to use until the start of your next turn. This can be repeated using the same amount of AP each time as was used to cast this Spell. Ritual: The frost no longer goes out naturally so long as it is being used for melee attacks only. This lasts until used as any other attack type or the Ritual ends."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Frostbite",
      "text": "1 Threshold, Spell Mod, Stackable. This Spell removes an additional 1d12 energy from the target."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Chill",
      "text": "1 Threshold, Spell Mod. Anytime this Spell would remove energy from the target (even if they have 0 remaining), they take that much cold damage, Strengthened."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Freeze",
      "text": "1 Threshold, Spell Mod. The next time the target would restore energy, they restore 3 less energy and take that much cold damage."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Shatter",
      "text": "1 Threshold, Spell Mod. If the target has 0 energy remaining, this Spell is doubly Strengthened."
     }
    ]
   }
  ]
 },
 {
  "id": "magic-radiation",
  "name": "Radiation",
  "archetype": "magic",
  "theory": false,
  "requires": 2,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the following Core Spell:",
    "entries": [
     {
      "name": "Crackle",
      "text": "1 Threshold, Core Spell, Ranged. This Spell can be used to produce electricity which can be launched at a target, dealing 1d12 radiation damage to them and then chaining to a target unaffected by this Spell chain within range with a disadvantage stack on its attack roll (repeating endlessly, stacking disadvantages until you miss or no other targets can be hit). If done in melee, the Spell can instead have no advantage on its attack roll from the melee to keep it available to use until the start of your next turn. This can be repeated using the same amount of AP each time as was used to cast this Spell. Ritual: The crackle no longer goes out naturally so long as it is being used for melee attacks only. This lasts until used as any other attack type or the Ritual ends."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Electrify",
      "text": "1 Threshold, Spell Mod. Whenever this Spell deals damage to a target, if this is the first time this Spell has dealt damage to that target since the start of your turn, the damage this Spell deals to them is Strengthened."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Lightning Rod",
      "text": "1 Threshold, Spell Mod. The primary target of this Spell takes 1d10 radiation damage whenever another target takes damage from this Spell."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Charge",
      "text": "1 Threshold, Spell Mod. This Spell’s damage is Strengthened for every two targets it hits (applying after the second takes damage each time)."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Discharge",
      "text": "1 Threshold, Spell Mod. Any time this Spell would deal damage that has at least two Strengthened stacks, you can remove those two Strengthened stacks from that damage to cause your next attack before the start of your next turn to have advantage on its attack roll."
     }
    ]
   }
  ]
 },
 {
  "id": "magic-acid",
  "name": "Acid",
  "archetype": "magic",
  "theory": false,
  "requires": 2,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the following Core Spell:",
    "entries": [
     {
      "name": "Glob",
      "text": "1 Threshold, Core Spell, Ranged. This Spell can be used to mold a ball of acid which can be launched at a target, dealing 1d8 acid damage to the target and applying that many Stain stacks to whatever is damaged. If done in melee, the Spell can instead deal no damage (still applying Stain stacks) to keep it available to use until the start of your next turn. This can be repeated using the same amount of AP each time as was used to cast this Spell. Ritual: The glob no longer goes away naturally so long as it is being used for melee attacks only. This lasts until used as any other attack type or the Ritual ends."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Melt",
      "text": "1 Threshold, Spell Mod. Any damage this Spell or its Stains would deal to objects is Strengthened."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Solidify",
      "text": "2 Threshold, Spell Mod. Any Stains applied by this Spell are instead Solid Stains, acting like normal Stains but instead take 6 AP to remove and are removed separately from normal Stains."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Sticky",
      "text": "1 Threshold, Spell Mod. This Spell has advantage on its attack rolls against targets with Stain stacks equal to or greater than their Pain Threshold (includes Solid Stains)."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Catalyst",
      "text": "2 Threshold, Spell Mod. After this Spell concludes its other effects, all targets who were hit by this Spell take damage from their Stain stacks that you have applied to them."
     }
    ]
   }
  ]
 },
 {
  "id": "magic-grasp-arcana",
  "name": "Grasp Arcana",
  "archetype": "magic",
  "theory": false,
  "requires": 3,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Foresight",
      "text": "1 Threshold, Spell Mod, Universal. If the target of this Spell has disadvantage on their dodge roll, this Spell’s attack roll gets an advantage."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the following Passive:",
    "entries": [
     {
      "name": "Spirit Sense Secondary",
      "text": "You gain an extra sense known as “Spirit Sense” that starts off as Secondary."
     },
     {
      "name": "Secondary",
      "text": "Allows you to make a spot check to detect any magical energy that is within 10ft. On success, you sense the direction of the source regardless of obstacles and know the quantity of energy present (for creatures, this is their total Spirit) but not their exact location."
     },
     {
      "name": "Primary",
      "text": "Increases spot check range to 100ft, and you now auto succeed on targets within melee range. In addition, you are now immune to Targeted attack roll’s stealth bonus."
     },
     {
      "name": "Heightened",
      "text": "Increases spot check range to 1000ft, and you can now determine the exact composition of Spells, as well as the individual Spirit stats of creatures, and the exact location of all energies detected this way. Obtainable using the Perception Generic Group or other methods."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Replicate",
      "text": "X+1 Threshold, Spell Mod, Universal. This Spell mod replicates any other Spell Mod of your choosing for the Spell, allowing it to essentially be taken twice. Costs Threshold equal to the chosen Spell Mod plus one."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the following Passives:",
    "entries": [
     {
      "name": "Spirit Sense Primary",
      "text": "Your Spirit Sense is now naturally Primary."
     },
     {
      "name": "Foci Master",
      "text": "You can spend 2 AP to swap your Attuned Foci to another one, assuming the new one is on your person and easily accessible."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Instant Ritual",
      "text": "2 Threshold, Spell Mod, Universal. This Spell is cast as a Ritual without requiring the time Rituals normally would need. This Spell Mod does count towards the reduced maximum energy that Rituals normally apply."
     }
    ]
   }
  ]
 },
 {
  "id": "magic-venomancy",
  "name": "Venomancy",
  "archetype": "magic",
  "theory": false,
  "requires": 3,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the following Core Spell:",
    "entries": [
     {
      "name": "Poison",
      "text": "1 Threshold, Core Spell, Targeted. Coats the target object, creature, Spell, or Wonder with this Poison on a successful hit, lasting until the start of your next turn. When that coated thing would next deal direct damage to a target before then, the Poison then transfers to that target. On the start of that target's next turn, they must roll a Constitution Check and get a 3 or higher, or they lose 3d6 health. Regardless of if they succeed or fail, the Poison then ends. This Spell cannot crit. Ritual: This Spell no longer decays after a turn while coating something. In addition, when it applies to a target after they are dealt direct damage, it lasts on them until either they die, or they pass the Constitution Check, triggering the effect at the start of each of their turns."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Prolong",
      "text": "1 Threshold, Spell Mod, Stackable. This Poison now continues applying its effect until its Constitution Check has been passed 1 time, or its effect has applied 2 times (+1 each stack)."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Lethality",
      "text": "1 Threshold, Spell Mod. Every time this Poison’s base damage procs, increase its base damage die size by 50%, rounded down (stacking additively)."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Potency",
      "text": "1 Threshold, Spell Mod. The target’s first Constitution Check made against this Poison has disadvantage."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Virality",
      "text": "2 Threshold, Spell Mod. If the target rolls less than half of the Constitution Check required for this Poison, you may make an attack roll against a target within 100ft of them and you. On hit, the Poison duplicates and spreads to that new target (that new target can also trigger Virality, the new Poison cannot be a Ritual, and Lethality resets for the new target)."
     }
    ]
   }
  ]
 },
 {
  "id": "magic-charm",
  "name": "Charm",
  "archetype": "magic",
  "theory": false,
  "requires": 3,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the following Core Spell:",
    "entries": [
     {
      "name": "Charm",
      "text": "1 Threshold, Core Spell, Targeted. On a successful hit, the target must roll a Willpower Check and get a 3 or higher, or they get disadvantage/Weakened on a generic roll type of your choice (attack, damage, dodge, non-combat, stat check), lasting until the start of your next turn. In addition, a successful hit and failure of the check does not alert the target that this Spell is affecting them. This effect does not stack for the same roll type, but can be applied to different roll types. Ritual: You get a no-threshold cast of this Spell that, on hit, becomes permanent on the target until the Ritual ends or the target passes/dies. If you miss this Spell, it is still usable on another cast attempt."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Ingrained",
      "text": "2 Threshold, Spell Mod. This Charm now lasts for 1 minute, with the target repeating the Willpower Check at the start of each of your turns, with the requirement being halved each successive time (rounded down). The effect ends if they pass the check."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Convince",
      "text": "1 Threshold, Spell Mod. If the target is already under the effects of one of your Charms, this Spell has advantage on its attack roll."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Cloud",
      "text": "1 Threshold, Spell Mod. The target’s first Willpower Check made against this Charm has disadvantage."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Propagandize",
      "text": "1 Threshold, Spell Mod. This Charm’s effect is doubled (aside from the check requirement) so long as the target is under the effect of at least 2 other of your Charms (for a total of 3)."
     }
    ]
   }
  ]
 },
 {
  "id": "magic-witchery",
  "name": "Witchery",
  "archetype": "magic",
  "theory": false,
  "requires": 3,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the following Core Spell:",
    "entries": [
     {
      "name": "Hex",
      "text": "1 Threshold, Core Spell, Targeted. On a successful hit, the target has this Hex applied to them, lasting for a minute or until it triggers. They are not aware of this Hex until the trigger occurs. On trigger, the target must roll a Build Check and get a 3 or higher, or they suffer 1d12 arcane damage (this is not Weakened naturally due to the Hex being directly on their spirit), which can be blocked by things that block magical damage. This Spell cannot crit. You can select how it triggers from the following:"
     },
     {
      "name": "Harm",
      "text": "The target takes damage from a non-Hex source. The damage dealt by this Hex is doubly Weakened."
     },
     {
      "name": "Move",
      "text": "The target spends AP to move. The damage dealt by this Hex is Weakened."
     },
     {
      "name": "Fail/Success",
      "text": "The target fails/succeeds on an attack, dodge, stat check, or non-combat d100 roll."
     },
     {
      "name": "Roll",
      "text": "The target makes a specified roll (attack, damage, dodge, non-combat, stat check). The damage dealt by this Hex is Strengthened."
     },
     {
      "name": "Act",
      "text": "The target performs a specific declared action (a named Weapon type, Wonder, or Core Spell). The damage dealt by this Hex is doubly Strengthened."
     },
     {
      "name": "Word/Condition",
      "text": "The target speaks a chosen word or enters a chosen condition (prone, feared, 0 energy, etc). The damage dealt by this Hex is triply Strengthened.",
      "sub": [
       "Ritual: You get a no-threshold cast of this Spell that, on hit, becomes permanent on the target until the Ritual ends or the target dies (passing does not remove the Hex), triggering each time the trigger would occur. If you miss this Spell, it is still usable on another cast attempt."
      ]
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Linger",
      "text": "1 Threshold, Spell Mod, Stackable. This Hex now continues until its trigger has been activated 2 times (+1 each stack, continues even if the target passes that trigger’s check)."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Fester",
      "text": "1 Threshold, Spell Mod. Every time this Hex’s base damage procs, increase its base damage die size by 6."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Unravel",
      "text": "2 Threshold, Spell Mod. The target’s first Build Check made against this Hex has disadvantage, and if they fail it they then have disadvantage on all Magic related checks until the start of your next turn."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Consume",
      "text": "2 Threshold, Spell Mod. If this Hex’s damage destroys its target, you regain energy equal to the damage dealt and you may instantly reapply the Hex to another valid target within your Targeted attack range so long as you make a successful Targeted attack roll against them. The new Hex resets its trigger count for Linger and Fester’s purposes, but can be maintained as a Ritual if it was one."
     }
    ]
   }
  ]
 },
 {
  "id": "magic-build-arcana",
  "name": "Build Arcana",
  "archetype": "magic",
  "theory": false,
  "requires": 4,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Layered",
      "text": "1 Threshold, Spell Mod, Universal. This Spell’s health is increased by two times your Build stat if it uses default Spell health. If it does not use default Spell health (such as summons or shields), instead its health/durability is increased by your Build stat."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Reactive",
      "text": "1 Threshold, Spell Mod, Universal. Whenever this Spell would take damage, you can spend 1 RP to give that damage instance a stack of Weakened. This can be done once per instance of damage."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the following Passive:",
    "entries": [
     {
      "name": "Seep",
      "text": "Whenever you spend AP to regain energy, you can forgo half of the energy gained (rounded down) to activate the recovery of your Shroud once."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the following Spell Mod and Passive:",
    "entries": [
     {
      "name": "Reform",
      "text": "1 Threshold, Spell Mod, Universal. At the start of each of your turns, this Spell restores health/durability equal to your Build min, up to the damage it has taken since the start of your last turn."
     },
     {
      "name": "Shroud Master",
      "text": "You can spend 2 AP to swap your Attuned Shroud to another one, assuming the new one is on your person and easily accessible."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Projection",
      "text": "1 Threshold, Spell Mod, Universal. This Spell can be cast from the position of any willing target (or unwilling if you make a Targeted attack roll against them) within 100ft of you. Treat its range as being based on their position, and count it as melee if it targets something within their melee range."
     }
    ]
   }
  ]
 },
 {
  "id": "magic-summoning",
  "name": "Summoning",
  "archetype": "magic",
  "theory": false,
  "requires": 4,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the following Core Spell:",
    "entries": [
     {
      "name": "Form",
      "text": "1-5 Threshold, Core Spell, Targeted. Summons a creature made entirely out of your Spirit at the target location (it counts as a Spell), lasting until the start of your next turn. This Spell's Threshold can be manually raised on cast to multiply its point pool by that much, up to a maximum of 5 Threshold (stacks additively with similar sources). You get 5 points to allocate towards the following:"
     },
     {
      "name": "Body",
      "text": "1 point adds 1 Strength, Dexterity, or Constitution to the Summon. Each stat must have at least 1 point put into it."
     },
     {
      "name": "Skill",
      "text": "2 points give the Summon 1 skill point that can be allocated towards it knowing any Martial Archetype skill tree. It automatically knows any that you know at a baseline, this just adds to its knowledge. When it uses these skills, it uses energy from its own pool.",
      "sub": [
       "In addition, the Summon gets the following:"
      ]
     },
     {
      "name": "Health",
      "text": "The Summon has health equal to 3 times its Constitution, then multiplied by its size. The Summon does not have natural regeneration or a Pain Threshold."
     },
     {
      "name": "Limbs",
      "text": "The Summon can have any number of limbs you desire and take any shape you desire, but only two of its limbs will ever be usable for holding objects, combat, etc. All other limbs are purely cosmetic."
     },
     {
      "name": "Size",
      "text": "The Summon has a default size of 1 or 2 (your choice), but this can be increased to 3 if this Core Spell’s Threshold (including Summoning Spell Mods) is at least 5, going up to 4 if the total Threshold reaches 10."
     },
     {
      "name": "Energy",
      "text": "The Summon has a pool of energy equal to 5 times its Constitution. This can be used for its various Martial Skills it may have access to, and cannot be accessed by you."
     },
     {
      "name": "Non-Body Checks",
      "text": "Any non-Body checks the Summon would need to make, such as Attacks, Dodges, Magic checks, etc, are instead made using your relevant die for its roll. Any effects your Summon has that would enhance these rolls still apply."
     },
     {
      "name": "Mindless",
      "text": "Your Summon is immune to Mind altering effects due to being Mindless, and cannot take orders. In addition, your Summon has no natural senses, and instead follows your senses as you control it. This means if your character’s senses are limited, your Summon would be equally limited by this."
     },
     {
      "name": "Unarmed Attacks, Movement, AP, RP",
      "text": "All of these systems function as they normally would for a Creature. It shares a turn order with you (meaning you decide who goes first when it comes to your turn), and after cast can immediately act after your turn ends. Your Summons do not count as you attacking, and thus Weaving cannot proc off of their attacks.",
      "sub": [
       "Ritual: The Summon is permanent until it is destroyed or the Ritual ends."
      ]
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Arm",
      "text": "1-2 Threshold, Spell Mod, Stackable. This Spell’s Summon naturally has one of its arms turned into a natural weapon (can only be stacked one additional time this way for both arms to be different weapons), or both arms into one weapon if 2 Threshold is used for this Spell instead (follows normal weapon two handing rules). This creates a Natural Weapon with a type and weight of your choice, scaling in stats for every 10 Scaling Stat the Summon has. The Natural Weapon follows Hardwood’s stats if Light, and Iron’s stats if Heavy, and can only be repaired with healing effects. Ranged Natural Weapons need to reload still, but have infinite accessible ammunition, and Natural Melee Weapons can be thrown, returning if the Summon spends 1 RP."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Skin",
      "text": "1-4 Threshold, Spell Mod. This Spell’s Summon naturally has Armor built into it, with a weight based on the Threshold used for this Spell Mod (1 = Light, 2 = Medium, 3 = Heavy, 4 = Titanic). This creates Natural Armor scaling in stats for every 10 Constitution the Summon has. The Natural Armor follows Soft Leather’s stats if Light or Medium, and Iron’s stats if Heavy or Titanic, and can only be repaired with healing effects."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Sense Swap",
      "text": "1 Threshold, Spell Mod. At any time, you can spend 2 RP to swap your senses with this Spell’s Summon (can only be active on one summon at a time, reuse this ability to deactivate it). This results in your body being limited by whatever sense the Summon has, and the Summon now utilizing your senses. During this time your character may still act, following the same rules your Summon would have previously. While this effect is active on a Summon, Spells you cast using your turn are cast from the position of your Summon using your senses, regardless of its distance from you (they still use your energy and AP/RP)."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Limited Autonomy",
      "text": "2 Threshold, Spell Mod. This Spell’s Summon can follow a simple command given by you, carrying it out until it is unable to, or until its (or your) destruction. While carrying out this command, their senses are elevated to that of your own, and it can act independently of you given the command it was given (Sense Swap used during this causes them to try and act from your body instead). The command can be no longer than a single short sentence (it utilizes your memory for knowing named individuals and places). Despite all of this, it is still Mindless and is to be treated as such."
     }
    ]
   }
  ]
 },
 {
  "id": "magic-creation",
  "name": "Creation",
  "archetype": "magic",
  "theory": false,
  "requires": 4,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the following Core Spell:",
    "entries": [
     {
      "name": "Make",
      "text": "1 Threshold, Core Spell, Targeted. You create an inanimate object that lasts until the start of your next turn that can be one of the following (it counts as a Spell, and can be conjured into a target’s hand with no attack roll so long as they are willing, with it not being possible if they are not willing):"
     },
     {
      "name": "Archetypal",
      "text": "It is made of a Common material and has a Grade of 2. Can only make equipment with a material that your character is familiar with (up to GM), and can only create equipment with a single type and material."
     },
     {
      "name": "Non-Archetypal",
      "text": "Can be any singular Powder, Liquid, or Soft material with a Body of 10. Can only make an object with a material that your character is familiar with (up to GM), and can only create objects with a single material. Note that 1 body of a material is roughly equal to a cubic foot of it, meaning 25 body equals a 5x5x1ft tile, and 125 body equals a 5x5x5ft cube.",
      "sub": [
       "Ritual: The Creation is permanent until it is destroyed or the Ritual ends."
      ]
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Armory",
      "text": "1 Threshold, Spell Mod, Stackable. Creates an additional equipment/object of your choice at the same target."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Make Mk2",
      "text": "1 Threshold, Spell Mod. Allows Make to create Uncommon Archetypal equipment, as well as Hard Non-Archetypal objects."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Complexity",
      "text": "1 Threshold, Spell Mod, Stackable. Creates an Archetypal equipment with one additional Type (if it supports multiple types), or a non-Archetypal object with one additional Material."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Make Mk3",
      "text": "1 Threshold, Spell Mod. Requires Make Mk2 to also be added to this Spell. Allows Make to create Rare Archetypal equipment, as well as Dense Non-Archetypal objects."
     }
    ]
   }
  ]
 },
 {
  "id": "magic-animation",
  "name": "Animation",
  "archetype": "magic",
  "theory": false,
  "requires": 4,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the following Core Spell:",
    "entries": [
     {
      "name": "Animate",
      "text": "1-5 Threshold, Core Spell, Targeted. Animates a pile of inanimate materials that are Soft or Liquid (such as a pile of wood, plastic, a pool of water, a corpse, etc), infusing it with up to 5 points of magical energy (the effect binding it counts as a Spell). This Spell's Threshold can be manually raised on cast to multiply its point count by that much, up to a maximum of 5 Threshold (stacks additively with similar sources). It has the following effects/requirements:"
     },
     {
      "name": "Body",
      "text": "The pile must be at least X Body to be targeted, with X being the points used in its animation."
     },
     {
      "name": "Size",
      "text": "Its size is by default 1, increasing to 2 if at least 5 Body of materials were used, to 3 if at least 25 Body were used, to 4 with 125, and to 5 with 625. Multiply its eventual health value by this size."
     },
     {
      "name": "Material",
      "text": "The created Animation has stats and features based on its primary material category (see the tables below this tree)."
     },
     {
      "name": "Duration",
      "text": "Lasts until the start of your next turn."
     },
     {
      "name": "Skills",
      "text": "Can use any Martial skills that you know."
     },
     {
      "name": "Mindless",
      "text": "Animations are immune to Mind altering effects due to being Mindless, and cannot take orders. In addition, your Animation has no natural senses, and instead follows your senses as you control it. This means if your character’s senses are limited, your Animation would be equally limited by this."
     },
     {
      "name": "Non-Body Checks",
      "text": "Any non-Body checks the Animation would need to make, such as Attacks, Dodges, Magic checks, etc, are instead made using your relevant die for its roll. Any effects your Animation has that would enhance these rolls still apply."
     },
     {
      "name": "Unarmed Attacks, AP, RP",
      "text": "All of these systems function as they normally would for a Creature, utilizing points as a stand in for Strength, Dexterity (Both used for unarmed damage calcs), and Constitution (Con has no effect other than being used for checks). It shares a turn order with you (meaning you decide who goes first when it comes to your turn), and after cast can immediately act after your turn ends. Your Animations do not count as you attacking, and thus Weaving cannot proc off of their attacks.",
      "sub": [
       "Note that 1 body of a material is roughly equal to a cubic foot of it, meaning 25 body equals a 5x5x1ft tile, and 125 body equals a 5x5x5ft cube. Ritual: The Animation is permanent until it is destroyed or the Ritual ends."
      ]
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Animate Weapon/Icon/Foci",
      "text": "1 Threshold, Spell Mod, Replacement. Can only be used as a replacement (no doubling). Animate under your control the targeted Weapon, Icon, or Foci with Grade 2 or lower within range. If held by an unwilling target, make a Targeted attack roll against them for this to succeed. For the duration, you can expend AP or RP equal to that equipment’s attack cost (can be done as a reaction) to move the animated equipment a number of feet equal to your Scaling Stat min (Reach/Grasp) and attack using it as if you were holding it (if Weapon, make attacks as normal with skills allowed. If Icon, you can Manifest through it and use its Ward. If Foci, you can cast Spells through it). Lasts until the start of your next turn."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Expanded Animation",
      "text": "1 Threshold, Spell Mod. Allows using Powder or Hard materials for Animate."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Animate Armor/Shroud",
      "text": "1 Threshold, Spell Mod, Replacement. Can only be used as a replacement (no doubling). Animate under your control the targeted Armor or Shroud that is at most Grade 2 within range. If worn/melded by an unwilling target, make a Targeted attack roll against them for this to succeed. For the duration, you can expend 2 AP or RP (can be done as a reaction) to either attempt to suffocate the target, or mold the armor/shroud. Suffocation causes the armor/shroud to deal Xd12 physical damage to its wearer, where X is the Grade of the armor, halved if it’s Light, normal if it’s Medium, doubled if it’s Heavy, and quadruple if it’s Titanic (shrouds deal double the damage but as arcane damage). Molding the armor instead deals this damage to a target within melee range. Both suffocation and molding require a successful melee attack roll, with suffocation having advantage on its attack roll."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Mixed Animations",
      "text": "1 Threshold, Spell Mod, Stackable. You may select one additional material that is present within the Animation on cast to have its material effect be active.",
      "sub": [
       "| Liquid Animations | | |",
       "| ----- | ----- | :---: |",
       "| Liquid Animations cannot hold items such as weapons or armor, but can move through nearly any opening, have advantage dodging non-targeted attacks as well as imposing disadvantage on said attacks, ignore swimming restrictions, and targets grappled by them begin drowning as if they are underwater without breath left but are not slowed or restricted otherwise. The Animation has health equal to 1x Points, a speed of 100%, and Weakened physical attacks. | | |",
       "| Name | Rarity | Effect |",
       "| Water | Common | TBD |",
       "| Oil | Common | TBD |",
       "| Blood | Common | TBD |",
       "| Tar / Pitch | Uncommon | TBD |",
       "| Resin | Uncommon | TBD |",
       "| Alcohol / Spirits | Uncommon | TBD |",
       "| Mercury | Rare | TBD |",
       "| Soft Animations | | |",
       "| ----- | ----- | :---: |",
       "| Animations made of a soft material have no restrictions, acting as a standard summon. The Animation has health equal to 3x Points, a speed of 40%, and normal physical attacks. | | |",
       "| Name | Rarity | Effect |",
       "| Hardwood | Common | TBD |",
       "| Softwood | Common | TBD |",
       "| Bone | Common | TBD |",
       "| Cloth | Common | TBD |",
       "| Soft Leather | Common | TBD |",
       "| Hide | Common | TBD |",
       "| Clay | Common | TBD |",
       "| Coal | Common | TBD |",
       "| Wool | Common | TBD |",
       "| Salt / Halite | Common | TBD |",
       "| Amberite | Uncommon | TBD |",
       "| Chitin | Uncommon | TBD |",
       "| Hard Leather | Uncommon | TBD |",
       "| Sulfur | Uncommon | TBD |",
       "| Gravesalt | Rare | TBD |",
       "| Beryllium | Very Rare | TBD |",
       "| Aetherwood | Very Rare | TBD |",
       "| Powder Animations | | |",
       "| ----- | ----- | :---: |",
       "| Powder Animations can only ever hold one object or entity at a time with excess objects falling through them (but cannot attack with held items), have advantage dodging non-targeted attacks, can fit through ¼ inch gaps, and after being hit they can use 2 RP to scatter, causing them to be untargetable by attacks that are neither Targeted nor Area until the start of their next turn, dropping their held item as well. The Animation has health equal to 2x Points, a speed of 60%, and doubly Weakened physical attacks. | | |",
       "| Name | Rarity | Effect |",
       "| Charcoal | Common | TBD |",
       "| Cotton | Common | TBD |",
       "| Sand | Common | TBD |",
       "| Ash | Common | TBD |",
       "| Chalk Dust | Common | TBD |",
       "| Lime Powder | Uncommon | TBD |",
       "| Pigment Powder | Uncommon | TBD |",
       "| Hard Animations | | |",
       "| ----- | ----- | :---: |",
       "| Hard Animations have only 3 AP and RP per turn, but their Points count as twice as high for determining weapon and armor limits. The Animation has health equal to 5x Points, a speed of 20%, and Strengthened physical attacks. | | |",
       "| Name | Rarity | Effect |",
       "| Stone | Common | TBD |",
       "| Titanium | Common | TBD |",
       "| Glass | Uncommon | TBD |",
       "| Obsidian | Uncommon | TBD |",
       "| Quartz | Uncommon | TBD |",
       "| Aluminum | Uncommon | TBD |",
       "| Brick | Uncommon | TBD |",
       "| Granite | Uncommon | TBD |",
       "| Marble | Uncommon | TBD |",
       "| Positron | Rare | TBD |",
       "| Jade | Rare | TBD |",
       "| Mithrite | Very Rare | TBD |",
       "| Leviathan Chitin | Very Rare | TBD |"
      ]
     }
    ]
   }
  ]
 },
 {
  "id": "magic-restoration-arcana",
  "name": "Restoration Arcana",
  "archetype": "magic",
  "theory": false,
  "requires": 5,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the following Core Spell:",
    "entries": [
     {
      "name": "Restore",
      "text": "1 Threshold, Core Spell, Targeted, Uncombinable. Restores 2 health to a living target, only restoring health that has been lost since the start of your last turn. Ritual: Restores the health regardless of time since damage was taken. This Ritual applies once as an effect then ends."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Painless",
      "text": "1 Threshold, Spell Mod, Replacement. Lowers the target’s Pain Threshold by 3. If they are unconscious and this brings their health above their Pain Threshold, they can be woken up. If this replaces Restore, this can be used as a Ritual to make this effect last until you die, they die, or the Ritual ends."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Regenerate",
      "text": "1 Threshold, Spell Mod. When this Spell is cast as a Ritual while the target’s health is full, it instead restores maximum health."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Delay",
      "text": "2 Threshold, Spell Mod, Universal. This Spell now triggers against a target chosen now whenever a predefined trigger is met (can include things within 100ft of you). This Spell gains +100% Power to its Core or Combo bolded effect(s). If the Spell has no normal duration, the delay lasts until the start of your next turn."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Resuscitate",
      "text": "1 Threshold, Spell Mod. Can now be used on a target who has died, so long as they died after the start of your last turn. If this restores them above 0 HP, they are resurrected."
     }
    ]
   }
  ]
 },
 {
  "id": "magic-geomancy",
  "name": "Geomancy",
  "archetype": "magic",
  "theory": false,
  "requires": 5,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the following Core Spell:",
    "entries": [
     {
      "name": "Shift",
      "text": "1 Threshold, Core Spell, Targeted. Move up to 6 Body of connected material in an area. One piece of connected material must remain in its original position during this move, and the material must be a Powder/Liquid/Soft object Non-Archetypal object, or a Common Archetypal piece of equipment. If you move the terrain into someone, make a melee attack roll against them with advantage on the attack roll (this is due to it being melee, as per Spell range rules). On a hit, they take a number of d4s of physical damage equal to half of the Body of the material moved, rounded down. The moved material returns to its original position if possible at the start of your next turn. Note that 1 body of a material is roughly equal to a cubic foot of it, meaning 25 body equals a 5x5x1ft tile, and 125 body equals a 5x5x5ft cube. Ritual: While the Ritual is active, you may cast this Spell up to two times without spending Energy. These casts still require AP/RP. Once both casts are used, the Ritual ends."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Mend",
      "text": "1 Threshold, Spell Mod, Replacement. Can only be used as a replacement (no doubling). Restores 5 durability to an object (still following rarity/density restrictions) that is not broken, only restoring damage that was dealt to it since the start of your last turn. Ritual: Restores the durability regardless of time since damage was taken, and it can now target broken objects. This Ritual applies once as an effect then ends."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the following Spell Mods:",
    "entries": [
     {
      "name": "Toss",
      "text": "1 Threshold, Spell Mod. The material no longer needs to be connected, and can instead be flung from its starting location to a target within 100ft. If this is a living target, make a ranged attack roll against them. On a hit, they take a number of d6s of physical damage equal to half of the Body of the material moved, rounded down (this does not double up with Shift’s damage, it overrides it)."
     },
     {
      "name": "Tier Up",
      "text": "1 Threshold, Spell Mod. This Spell can now target an Uncommon Archetypal piece of equipment, or a Hard Non-Archetypal object. If it does so, increase its damage die size by 2."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Muddy",
      "text": "1 Threshold, Spell Mod, Replacement. Choose from the following: The material becomes difficult terrain, all rolls made while using or wearing the object are made at disadvantage for the duration, or all damage dealt by it is Weakened (this effect does not stack). If this fully replaces Shift, instead get all three effects, and the Ritual variant causes these effects to become permanent until the Ritual ends or the object is destroyed."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the following Spell Mods:",
    "entries": [
     {
      "name": "Harden",
      "text": "1 Threshold, Spell Mod, Replacement. Choose from the following: The material loses all negative terrain modifiers, all damage dealt by the material is Strengthened, or all damage dealt to it is Weakened (this effect does not stack). If this fully replaces Shift, instead get all three effects, and the Ritual variant causes these effects to become permanent until the Ritual ends or the object is destroyed."
     },
     {
      "name": "Tier Up, Again",
      "text": "1 Threshold, Spell Mod. Requires the first Tier Up to be active on this Spell. This Spell can now target a Rare Archetypal piece of equipment, or a Dense Non-Archetypal object. If it does so, increase its damage die size by 4."
     }
    ]
   }
  ]
 },
 {
  "id": "magic-illusion",
  "name": "Illusion",
  "archetype": "magic",
  "theory": false,
  "requires": 5,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the following Core Spell:",
    "entries": [
     {
      "name": "Mirage",
      "text": "2 Threshold, Core Spell, Targeted. You plant a false sensory impression in the target which can come in the form of a sound, a sight, or a smell (other senses you are aware of can apply here too). The Mirage has 10 Power, which is reduced by a tenth of the target’s Skill Points at the start of each of their turns. This can, at worst, remove the targeted sense from the character completely for the duration. On cast and whenever they take an action that would test it (up to GM), they make an Attack Roll vs the remaining Power, on pass the Mirage ends for them, and on failure it loses Power equal to a tenth of their Skill Points. Lasts for one minute. Ritual: You get a no-threshold cast of this Spell that, on hit, becomes permanent on the target until the Ritual ends, the target dies, or the Mirage’s Power becomes 0. Instead of a pass removing the Mirage, it instead reduces the Power twice. If you miss this Spell, it is still usable on another cast attempt."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Phantom Pain",
      "text": "1 Threshold, Spell Mod. Whenever this Mirage would lose Power, whomever it is affecting has their Pain Threshold increased by 1d6. If the target is no longer under the effects of any Mirages, this effect is removed."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Fidelity",
      "text": "1 Threshold, Spell Mod, Replacement. Can only be used as a replacement (no doubling). The Mirage becomes a tangible object or creature instead of affecting a specific sense, which can move and interact around them (which can result in forcing a check against the Mirage). This can result in the target suffering from Fear (preventing energy regain), disadvantage on a specified check, or many other afflictions with similar weight, lasting until the Mirage is broken. Otherwise works how Mirage normally does with its Power, decay, and checks."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the following Spell Mods:",
    "entries": [
     {
      "name": "Pervasive",
      "text": "1 Threshold, Spell Mod. Mirage no longer loses Power at the start of the target’s turn."
     },
     {
      "name": "Reshape",
      "text": "1 Threshold, Spell Mod. When the target would pass against your Mirage while they are within 100ft of you, you can spend 3 RP to cause them to fail instead, and increase the Power by the loss value instead, with a maximum equal to that Mirage’s normal Power."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Aura",
      "text": "2 Threshold, Spell Mod. Instead of casting your Mirage as normal, it is instead applied as an aura around you as one unified Mirage that all targets can sense. On cast and whenever a target enters within 50ft of you, make an attack roll against those targets. On hit, that target is afflicted by this Spell, and on miss they are immune to this instance. In addition, if they pass out of the Mirage, they become immune to this instance as well. The whole aura lasts for one minute, and when it ends so too do all Mirages that it applied."
     }
    ]
   }
  ]
 },
 {
  "id": "magic-arcanomancy",
  "name": "Arcanomancy",
  "archetype": "magic",
  "theory": false,
  "requires": 5,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the following Core Spell:",
    "entries": [
     {
      "name": "Strike",
      "text": "1 Threshold, Core Spell, Targeted. Deals 2d12 arcane damage. This Spell has advantage targeting fully magical targets, and can target and destroy Spells (they have health equal to their caster’s Scaling Stat unless specified, if they are mid cast your attack roll must beat their attack roll to hit). Arcane damage is Weakened against targets that are not fully magical. Ritual: While the Ritual is active, you may cast this Spell up to two times without spending Energy. These casts still require AP/RP. Once both casts are used, the Ritual ends."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Blast",
      "text": "2 Threshold, Spell Mod. The Spell changes its attack type to Area, applying its effect to all targets within the area. In addition, the Ritual effect changes to create an Anti-Magic field in the specified Area, which applies the arcane damage to all magical things whenever they enter the field and whenever your turn starts, lasting until it is dispelled or the Ritual ends."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Absorb",
      "text": "2 Threshold, Spell Mod. The Spell changes its attack type to Targeted, and gives you back Energy equal to the Spell’s Power if this destroys the Spell. If this is used with Blast, it causes the attack to be treated as a Targeted attack roll on all targets within the Area (this does not grant back energy on destruction)."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Amplify",
      "text": "1 Threshold, Spell Mod, Replacement. Can only be used as a replacement (no doubling). Adds 10 to the Power (increase its effect as if its caster had 10 more scaling stat) of target non-Ritual Spell. Cannot apply to the same Spell more than once. If used on a Spell with on-cast decisions, it has no effect unless that Spell is mid cast (requiring the React Spell Mod to do so)."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the following Spell Mod:",
    "entries": [
     {
      "name": "Rip",
      "text": "1 Threshold, Spell Mod, Replacement. Can only be used as a replacement (no doubling). Takes control of a magical Spell that has 5 or less Power (scaling stat the caster had for that Spell). When you take control of it, you can redirect it or cause it to dissipate instantly. If you redirect it, make a new attack roll based on the magical Spell if needed. Ritual: You get a no-threshold cast of this Spell that, on hit, becomes permanent on the target Spell until the Ritual ends or the Spell is dispelled, and causes the Spell to be made into a Ritual."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-theory",
  "name": "Mental Theory",
  "archetype": "mental",
  "theory": true,
  "requires": 0,
  "tiers": [
   {
    "tier": 0,
    "free": true,
    "summary": "You gain the following actions:",
    "entries": [
     {
      "name": "Wonders and Modes",
      "text": "Your Mental power is expressed through Wonders, each Wonder being one end of an Axis of Reality (also called Domains in some settings), these being the skill trees you unlock in Mental. Wonders can either be Dreams (scaling with Ponderance), or Nightmares (scaling with Snappence). Each Wonder has a handful of Modes found in its tiers, which are the individual effects you can Manifest."
     },
     {
      "name": "Manifesting",
      "text": "Manifesting a Mode of a Wonder is an attack, made with an attack roll against whatever target is specified. The AP cost of Manifesting is dependent on the Range chosen when Manifesting."
     },
     {
      "name": "Wonder Power",
      "text": "The Power of a Wonder increases by 1 for every 10 points you have in its Scaling stat (which is Snappence for Nightmares, and Ponderance for Dreams). All bolded effects within the Wonder are increased with its Power, so if you have 30 Snappence and have a Nightmare that deals 1d8 damage, that would increase to 3d8 damage due to its power being 3. If your Scaling Stat is less than 10 or the Power of a Wonder would otherwise be 0, you cannot Manifest it. Any effects that modify the Power of a Wonder are additive, so two 50% increases would result in a 100% increase in Power (rounding down as needed after all power bonuses have been calculated)."
     },
     {
      "name": "Wonder Ranges",
      "text": "The range of a Wonder is chosen from among the following whenever you Manifest it:",
      "sub": [
       "Melee: The Manifestation targets one target within your personal melee range. Has an AP cost of 1.",
       "Ranged: Has a maximum range of 100ft. The attack is made as normal, respecting cover. Has an AP cost of 2.",
       "Area: Can either be a 10ft radius around you, a 20ft 90 degree cone in front of you, or a 30ft by 5ft line in one cardinal direction. Each target in the area must make a dodge roll separately against your singular attack roll. Has an AP cost of 3, and the effect is Weakened if it hits more than two targets. This Area can include yourself if desired."
      ]
     },
     {
      "name": "Enhancing",
      "text": "When Manifesting a Mode of a Wonder, you can Enhance it for energy equal to that Wonder’s Scaling Stat min, giving that instance the benefits listed in the Enhance section."
     },
     {
      "name": "Dismissing Wonders",
      "text": "You can dismiss concentrated Wonders freely as a reaction. Non-concentrated Wonders you have created can be dismissed by making an attack roll against them (apply Wonder Range AP cost to this). If the target is an object, the rolled number needed to dismiss it is equal to the energy spent on Manifesting it (if 0 then no attack roll is needed), and if it is a creature, it can choose to resist it using its dodge roll, only being dismissed if you successfully hit."
     },
     {
      "name": "Alignment",
      "text": "All characters interfacing with the Mental system have an Alignment that they set, which gives various bonuses depending on its position at the cost of speed. Changing your Alignment can only be done with a 1 hour activity. You can choose how far you want to go as desired, gaining all prior bonuses but stacking a 20% speed penalty for each point of Alignment, and Alignment can either be for Dreams or Nightmares.",
      "sub": [
       "Neutral: Has no benefits, but you also get no speed penalty.",
       "1 Alignment: Your Dream/Nightmare Form’s Ward has advantage on it’s attack rolls.",
       "2 Alignment: Your Dream/Nightmare Form’s Ward bolded effect is Strengthened."
      ]
     },
     {
      "name": "Concentration",
      "text": "Some abilities and actions in Mental Theory require Concentration to maintain. When you take direct damage while Concentrating on something, you must expend 1 RP to make a Willpower check against the direct damage taken as a target number; if the result is lower, all of your Concentrations end at that moment. You can Concentrate on a number of things equal to your Mental Theory tier, any more must require you losing Concentration on something else. You can end Concentrations freely, and going unconscious removes all active Concentrations."
     }
    ]
   },
   {
    "tier": 1,
    "free": false,
    "summary": "You unlock the Psion Arts, Life, Death, Order, Chaos, Beyond, and Below trees. You also gain the following action and passive:",
    "entries": [
     {
      "name": "Burst",
      "text": "You can Manifest a Wonder using RP equal to your chosen Range’s Manifest AP cost if you additionally spend energy equal to its Enhance cost. This can be done in conjunction with Enhance by combining the costs. This also can apply to Form’s Wards and their Enhance Costs."
     },
     {
      "name": "Defensive Enhance",
      "text": "You can now Enhance your Form’s Ward, working the same as normal Wonder Modes Enhance actions do."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You unlock the Ponderance Arts, Creation, Destruction, Peace, War, Adaptation, and Perfection trees. You also gain the following actions:",
    "entries": [
     {
      "name": "Trance",
      "text": "You can spend 8 hours attempting to make permanent a Mode of your choice on a willing target (they must participate in the 8 hours as well). Upon completion, the effect of the Mode is permanently active on them, so long as you maintain Concentration on it (this counts towards your cap)."
     },
     {
      "name": "",
      "text": "Modes with a normal lingering effect require a successful self attack roll (crits do apply) at the start of the target’s turns, with a failure meaning it doesn't apply that round."
     },
     {
      "name": "",
      "text": "Modes that have an instanced effect such as Bloom or Decree trigger at the start of each of their turns so long as they make a successful attack roll against themselves (crits do apply), and that effect lasts until the start of their next turn."
     },
     {
      "name": "",
      "text": "Hostile effects are instead treated as a new ability the target can use for an AP cost determined by the Wonder Ranges (as well as the effects those impart), which are chosen on use, using your scaling dice for the effect but their own attack dice/buffs for the attack roll, are automatically Enhanced (if desired) for free, and their own energy if they wish to Burst it."
     },
     {
      "name": "Project",
      "text": "Your Form’s Ward can now be applied to an ally as a Ranged attack with a range of 100ft, still requiring whatever AP/RP/energy the Action normally would take."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You unlock the Snappence Arts, Light, Dark, Earth, and Sea trees. You also gain the following action and passive:",
    "entries": [
     {
      "name": "Chant",
      "text": "If you miss the attack roll on a Manifest, you can, once per Manifest, reroll that attack roll by spending energy equal to its Enhance effect’s cost (this does not Enhance it). The new roll keeps any Disadvantages/Advantages the first attempt had, but does not re-proc effects."
     },
     {
      "name": "Deepening",
      "text": "You unlock two new Alignment depths, seen below. While these Alignments are set, you additionally have -1 AP per turn for each Alignment past 2 (so -1 AP at Alignment 3, and -2 AP at Alignment 4).",
      "sub": [
       "3 Alignment: Upgrades the 1st Alignment effect to instead be “treat your Dream/Nightmare Form’s Ward attacks as being made from half stealth”, thus giving them advantage on their attack rolls, and targets disadvantage dodging them.",
       "4 Alignment: Your Dream/Nightmare Form’s Ward hits regardless of roll, the roll now being used to determine if a crit occurs."
      ]
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You unlock the Willpower Arts, Growth, Stagnation, Fortune, and Ruin trees. You also gain the following actions:",
    "entries": [
     {
      "name": "Expansion",
      "text": "If you expend energy equal to double your Form’s Ward Enhance cost, you can now treat it as an Area attack, which can either be a 10ft radius around you, a 20ft 90 degree cone in front of you, or a 30ft by 5ft line in one cardinal direction."
     },
     {
      "name": "Fluidity",
      "text": "You can now spend energy equal to half of your Skill Points multiplied by your current Alignment number to swap your Alignment type."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You unlock the Esoteric Arts, Truth, Mystery, Zeal, and Serenity trees. You also gain the following passives:",
    "entries": [
     {
      "name": "Will of Body and Spirit",
      "text": "Whenever you make a Martial or Magic attack using AP, you can Manifest a Wonder at no extra AP cost so long as that Wonder’s normal AP cost matches that of the initial attack. This can also be done with RP based Martial/Magic attacks if Burst is used. The target(s) of your Wonder does not need to be the same as the Martial/Magic attack."
     },
     {
      "name": "Patron",
      "text": "Whenever you rest, you can select one Wonder to become your Patron Wonder (or change your currently selected Patron Wonder). Whenever you Manifest that Wonder, you can choose to Enhance or Burst it completely for free."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-psion-arts",
  "name": "Psion Arts",
  "archetype": "mental",
  "theory": false,
  "requires": 1,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Sixth Sense",
      "text": "You gain an extra sense known as “Psion” that starts off as Secondary. Psion as a Secondary sense allows you to detect mental energies through any surface within 100ft. This ability only informs you of the number of mental energies around you, not their location or direction. You cannot increase this sense to Primary or higher unless directly stated. Keep in mind you still need to use a Spot action to detect them in the first place."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Far Sight",
      "text": "Cost: Energy equal to your total Mind. You can spend 2 AP to extend the range of your psion sense to 1000ft. This also increases the range of your Ranged Manifestation option to 500ft. This effect normally only lasts until the start of your next turn, but can be maintained for another turn for no AP cost by expending the same energy cost again when your turn starts."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Primary Psion",
      "text": "Psion now becomes a Primary sense for you, enabling you to use Spot to determine the direction of a chosen mental energy, as well as its total Mind."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Aura Sight",
      "text": "Cost: Energy equal to half of your total Mind, rounded down. You can spend 2 AP to immediately make a Spot check against all targets within your current Psion Sense range (this AP cost changes with your Spot’s AP/RP cost). This also doubles the area of your Area Manifestation option until the start of your next turn."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Heightened Psion",
      "text": "Psion now becomes a Heightened sense for you, enabling your Spot check to give the individual mental stats and mental abilities (if any) of those you detect. Cannot detect abilities of a higher Stage than you’ve achieved."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-life-dream",
  "name": "Life (Dream)",
  "archetype": "mental",
  "theory": false,
  "requires": 1,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following Mode and Tenet:",
    "entries": [
     {
      "name": "Bloom",
      "text": "At the start of the target’s next turn, they get 50 temp HP, lasting until the start of your next turn (can stack with itself). Enhanced: The temp HP applies immediately instead."
     },
     {
      "name": "Verdant Soul",
      "text": "Only active while this is your selected Tenet. Once per round when you successfully hit a Manifest, you can give either the target or yourself 10 temp HP, lasting until the start of your next turn."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Pollinate",
      "text": "Cost: Energy equal to half of your PON min, rounded down. Whenever one of your Life Modes would activate on a target, you can use this ability to attempt to spread it to another target within 100ft of you that you can sense, requiring an attack roll. This spread cannot trigger Pollinate, and it applies the effect of that Mode immediately."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Flourish",
      "text": "At the start of the target’s next turn, their dodge rolls get +1 die size, lasting until the start of your next turn. Does not stack. Enhanced: The bonus to their dodge dice applies immediately instead."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Perennial",
      "text": "Cost: Energy equal to your PON min. Whenever one of your Life Modes would expire on a target that you can sense within 100ft of you, you can use this ability. Instantly reapply that effect to them at no AP/RP cost, requiring no attack roll, and applying immediately without needing to be enhanced."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Renewal",
      "text": "At the start of the target’s next turn, they restore 4 health, only restoring health lost since the start of your last turn. This can also be used on a target who has died since the start of your last turn, the effect triggering when their turn would have started. If this effect raises them above 0 health, they are resurrected. Enhanced: The healing applies immediately instead."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-death-nightmare",
  "name": "Death (Nightmare)",
  "archetype": "mental",
  "theory": false,
  "requires": 1,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following Mode and Tenet:",
    "entries": [
     {
      "name": "Wither",
      "text": "Removes 1d12 health from a living target. This effect is reduced by anything that blocks Supernatural damage, Temp HP, Shielding, Shrouds, and Ward effects. Enhanced: This damage also removes that much Max HP from the target."
     },
     {
      "name": "Mortal Coil",
      "text": "Only active while this is your selected Tenet. Once per round when you successfully hit a Manifest, you can steal 1d8 health from the target(s), becoming Temp HP for yourself that lasts until the start of your next turn."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Fester",
      "text": "Cost: Energy equal to your SNA min. Whenever you successfully Manifest a Death Mode, you can use this ability to cause that Mode’s effect (including its Enhance effect if it was applied) to reapply to the same target at the start of their next turn. This reapplication does not require an attack roll, and does not count as a Manifestation."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Waste",
      "text": "Store a Waste charge on the target, lasting until the start of your next turn. Whenever the target makes a dodge roll, you can consume up to one Waste charge on them to reduce that roll’s die size by 2. Enhanced: The affected dodge roll also has Disadvantage for this charge."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Reap",
      "text": "Cost: Energy equal to your SNA min. Whenever one of your Death Modes would critically hit a living target, you can use this ability to instantly attempt to Manifest a Death Mode of your choosing of the same Range type for no AP/RP cost (if the initial was Bursted, this one is Bursted for free)."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Execute",
      "text": "Raises the target’s Pain Threshold by 1d12, lasting until the start of your next turn. Enhanced: If the target’s health falls below half of their raised Pain Threshold while Execute is on them, they instantly lose all remaining health and die."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-order-dream",
  "name": "Order (Dream)",
  "archetype": "mental",
  "theory": false,
  "requires": 1,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following Mode and Tenet:",
    "entries": [
     {
      "name": "Decree",
      "text": "Store a Decree charge on the target, lasting until the start of your next turn. When the target makes a roll, you can consume up to one Decree charge on them to change that roll to instead be a static result, equal to half of their roll’s max result, plus or minus 1 (your choice on Manifest). Enhanced: The baseline is set from your relevant die’s halfway point, instead of the target’s."
     },
     {
      "name": "Balance",
      "text": "Only active while this is your selected Tenet. Once per round when you make an attack or dodge roll, you can add 1 to the result, or remove 1 from the opposing side’s result."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Permanence",
      "text": "One Order Mode charge you have placed on each target no longer decays at the start of your turn, lasting instead until it is consumed. Only one charge can be affected by this per target."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Mandate",
      "text": "Store a Mandate charge on the target, lasting until the start of your next turn. When the target gets a result (from a roll or from Decree), you can consume any number of Mandate charges on them to give that result plus or minus 1 (your choice on Manifest) per charge consumed. Enhanced: This effect is instead activated on a damage roll, changing its damage to be plus or minus 10 damage of its type if it does so."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Preordained",
      "text": "Cost: Energy equal to your PON min. When you finish a rest, roll one of your dodge dice, that result is your Preordained Number. Whenever you consume an Order charge, you can use this ability to additionally increase/decrease that effect by your Preordained Number (Mandate’s Enhance 10x’s this effect as damage instead)."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Verdict",
      "text": "Store a Verdict charge on the target, lasting until the start of your next turn. When the target lands a regular hit or a crit, you can consume up to one Verdict charge on them to swap the result to be the other, and add/subtract 5 damage to the result (this doubles if the result is a crit). Enhanced: Also apply a stack of Strengthened or Weakened to that attack."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-chaos-nightmare",
  "name": "Chaos (Nightmare)",
  "archetype": "mental",
  "theory": false,
  "requires": 1,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following Mode and Tenet:",
    "entries": [
     {
      "name": "Fracture",
      "text": "Store a Fracture charge on the target, lasting until the start of your next turn. When the target makes a roll, you can consume up to one Fracture charge on them to force a reroll, with the new roll’s die size increased or decreased by 3 (your choice on Manifest, dodge dice are affected by half, the new roll does not inherit any effects the original roll had such as Advantage/Disadvantage). Enhanced: The forced reroll retains any effects the original roll had, such as Advantage/Disadvantage."
     },
     {
      "name": "Unbound",
      "text": "Only active while this is your selected Tenet. Once per round when you get a crit on a Manifest, you can instantly for free apply one Chaos Mode charge of your choice onto that Manifest’s target."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Ricochet",
      "text": "Cost: Energy equal to half of your SNA min, rounded down. When you successfully Manifest a Chaos Mode, you can use this ability to place a copy of that charge onto a random valid target within range (this copies the chosen effect exactly)."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Larceny",
      "text": "Store a Larceny charge on the target, lasting until the start of your next turn. When the target makes a roll, you can consume up to one Larceny charge on them to steal that roll and any effects it would have, forcing them to roll a die whose size is increased or decreased by 1 (dodge dice are affected by half). You can use their roll, including its effects, to replace any roll you would make prior to the start of your next turn. Enhanced: You now instead steal the action they were doing itself, lasting up to a minute. Their side functions the same (forced reroll), but now you can do their action exactly as they were attempting to by spending RP equal to its AP/RP cost, following the same rules they would as well as using their stats/dice."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Control",
      "text": "Once per charge, you can reroll one extra roll made by a Chaos Mode. If you do, you must use that new result."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Entropy",
      "text": "Fracture charges can now be used for the following effect: when the target would crit or be crit (can still occur on things with no crit effect), you can consume up to one Fracture charge on them to give them an additional roll (if critting, the additional roll is either an extra attack, or forcing them to redo the attack. If being crit, the additional roll is a new attempt to dodge. Either way, the roll does not inherit any effects from the original roll) with its die size increased or decreased by 3 (dodge dice are affected by half). Enhanced: The extra reroll retains any effects the original roll had, such as Advantage/Disadvantage."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-beyond-dream",
  "name": "Beyond (Dream)",
  "archetype": "mental",
  "theory": false,
  "requires": 1,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following Mode and Tenet:",
    "entries": [
     {
      "name": "Herald",
      "text": "On hit, apply 6d8 Force to the target in a direction of your choice. This Force ignores the half-max HP subtraction, instead converting directly into feet pushed after being divided by 10. Enhanced: The Force also ignores Lift, treating it as if it were 0."
     },
     {
      "name": "Gust",
      "text": "Only active while this is your selected Tenet. Once per round when you successfully hit a Manifest, you can apply 5d8 Force to whatever the target(s) of the Manifest are in any direction of your choosing. This Force adds up with any Force the Manifest itself would produce."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Momentum",
      "text": "Cost: Energy equal to your PON min. Whenever a creature or object you moved with a Beyond Mode collides with something, you can use this ability. Apply 5d8 Force to the target again in a different direction of your choosing, requiring no attack roll. This can chain with itself."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Redirect",
      "text": "Store a Redirect charge (no attack roll needed) with the range of the AP/RP you spent (Melee, Ranged, Area), lasting until the start of your next turn. When an attack hits within that range that you can sense, you can consume up to one Redirect charge of that range to make an attack roll against that attack’s result. On hit, that attack deals 20 less damage. If reduced to 0, you can redirect it to another target within that charge’s range, requiring a new attack roll, repeating that attack's effect on hit. Enhanced: The intercept roll automatically hits, but only reduces damage by 10."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Kinetic Focus",
      "text": "Cost: Energy equal to half of your PON min, rounded down. When you make a Herald or Ascend attack roll, or the attack roll for Redirect’s extra attack, you can use this ability. Give that attack roll a stack of Advantage. This effect can be used as much as desired per attack."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Ascend",
      "text": "On hit, grant the target 60 Lift, lasting until the start of your next turn. The target is in control of their flight directly, and must stabilize for 3 RP if they take more than 1/10th of their max HP as damage, or are affected by enough force to push them. Enhanced: You now control their stabilization, either causing them to automatically fail or succeed on the check as desired."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-below-nightmare",
  "name": "Below (Nightmare)",
  "archetype": "mental",
  "theory": false,
  "requires": 1,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following Mode and Tenet:",
    "entries": [
     {
      "name": "Sink",
      "text": "Must target a grounded creature. On hit, the ground below the target grapples them, lasting until they break free with a counter grapple check of 2 or higher, or the start of your next turn. Enhanced: The effect now lasts for 3 turns, or until broken free from."
     },
     {
      "name": "Weight",
      "text": "Only active while this is your selected Tenet. Once per round when you successfully hit a Manifest, you can apply 15 Slow stacks to whatever the target(s) of the Manifest are, lasting until the start of your next turn."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Vice",
      "text": "Cost: Energy equal to half of your SNA min, rounded down. Whenever a creature fails a counter grapple check against one of your Below Modes, you can use this ability. They take 1d12 physical damage. Usable once per failed instance."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Burden",
      "text": "On hit, the target gets two Disadvantages split among either their attack or dodge rolls (your choice on Manifest, has no effect on counter grapple checks), until they break free with a counter grapple check of 3 or higher, or the start of your next turn. This effect stacks with itself (both of the types of Disadvantage, as well as more Disadvantage on one type), but they are all removed at once with a successful counter grapple check. Enhanced: The effect now lasts for 3 turns, or until broken free from."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Quicksand",
      "text": "Cost: Energy equal to double your SNA min. Whenever a creature would successfully break free from one of your Below Mode effects while they are within 100ft of you and you can sense them, you can use this ability. Make an attack roll against that target, on hit they instead fail their counter grapple check in that instance. Usable once per breakout instance."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Entomb",
      "text": "Can only be used on a target affected by both Sink and at least 4 Burden stacks. Completely entomb the target in the ground below them, clearing their Sink and Burden effects but causing them to be blind, deaf, and unable to smell, lasting until the start of your next turn. While encased, they can attempt a counter grapple check of 4 or higher to escape their entombment. Additionally, at the start of each of their turns while entombed, they suffer 3d10 physical damage. Enhanced: The effect now lasts for 3 turns, or until broken free from."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-ponderance-arts",
  "name": "Ponderance Arts",
  "archetype": "mental",
  "theory": false,
  "requires": 2,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Premeditate",
      "text": "Cost: Energy equal to your Scaling Stat min. When you would apply the effects of a Wonder, you can instead use this ability. That Wonder is stored as an effect on the target requiring Concentration, its effect only activating when a preset action of your choosing occurs by or to that character, such as attacking, dodging, or moving. In addition, the effects of that Wonder are Strengthened. The stored effect ends at the start of your next turn if not used."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Mantra",
      "text": "Cost: Energy equal to half of your Scaling Stat min, rounded down. When your Tenet triggers, you can use this ability. Double its bolded effect for this instance."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Composure",
      "text": "When you would lose your Concentration from taking damage, you instead lose only one effect you are Concentrating on, of your choice."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Forethought",
      "text": "Your selected Tenet automatically applies to each of your Premeditated Wonders, if it can. This does not count against that Tenet’s once per round limit."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Daydreaming",
      "text": "One of your active Concentrations cannot be broken, even if you fall unconscious. Losing Concentration still requires you to pick one to lose if you have more than one active."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-creation-dream",
  "name": "Creation (Dream)",
  "archetype": "mental",
  "theory": false,
  "requires": 2,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following Mode and Tenet:",
    "entries": [
     {
      "name": "Forge",
      "text": "The attack roll for this Manifest is made against yourself. On hit, create a real Martial Weapon or set of Armor of a single type, with a material rarity of either Common or Uncommon, and a grade of 1. The item is created at a place within your chosen range (Area creates multiple per target, each requiring a separate dodge roll from yourself against the same attack roll), and it appears either in a willing target's free hand, or at the feet of an unwilling target/a target that cannot wield it. The item lasts until the start of your next turn. Enhanced: The created Weapon/Armor can be of Rare rarity instead."
     },
     {
      "name": "Alter",
      "text": "Only active while this is your selected Tenet. Once per round when you hit a Manifest, choose an object the target is wearing or holding. All damage dealt to it is either Strengthened or Weakened, lasting until the start of your next turn."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Conjure",
      "text": "The attack roll for this Manifest is made against yourself. On hit, create a real Magic Foci or Shroud of a single type, with Affixes of your choice up to the item’s cap of either Common or Uncommon rarity, and a grade of 1. The item is created at a place within your chosen range (Area creates multiple per target, each requiring a separate dodge roll from yourself against the same attack roll), and it appears either in a willing target's free hand, or at the feet of an unwilling target/a target that cannot wield it. The item lasts until the start of your next turn. Enhanced: The created Affixes can be of Rare rarity instead."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Consecrate",
      "text": "The attack roll for this Manifest is made against yourself. On hit, create a real Mental Icon of a single Form with either Common or Uncommon rarity, and a grade of 1. The item is created at a place within your chosen range (Area creates multiple per target, each requiring a separate dodge roll from yourself against the same attack roll), and it appears either in a willing target's free hand, or at the feet of an unwilling target/a target that cannot wield it. In addition, if it appeared in a willing target’s hand, you can automatically attune it to them to a Tenet either you or the target have access to (must match the Pole of the Icon’s Form). The item lasts until the start of your next turn. Enhanced: The created Icon can be of Rare rarity instead."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Fabricate",
      "text": "The attack roll for this Manifest is made against yourself. On hit, create a real non-archetypal object of any shape, made of a singular material that is either Powder, Liquid, or Soft, with a Body of up to 15. You must know how to make the material yourself, or be familiar enough with it (up to GM) to Manifest it. The item is created at a place within your chosen range (Area creates multiple per target, each requiring a separate dodge roll from yourself against the same attack roll), and it appears either in a willing target's free hand, at the feet of an unwilling target/a target that cannot wield it, or at an unoccupied space where it can fit. The item lasts until the start of your next turn. Enhanced: The created object can be made of a Hard material instead."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following action:",
    "entries": [
     {
      "name": "Rite",
      "text": "You can alternately Manifest one of your Creation Modes as a Rite. Doing so requires 2 hours if the item is Archetypal and Common, or Non-Archetypal and Powder/Liquid (Rare/Hard items cannot be made permanent through Rite). It instead takes 8 hours if it's Archetypal and Uncommon, or Non-Archetypal and Soft. During the Rite, you are considered doing a heavy activity and have zero energy (you can cancel the Rite at any time, losing all progress). On completion, the item is made permanent, though it can still be dismissed by yourself, or by others who identify it as Mentally made."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-destruction-nightmare",
  "name": "Destruction (Nightmare)",
  "archetype": "mental",
  "theory": false,
  "requires": 2,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following Mode and Tenet:",
    "entries": [
     {
      "name": "Corrode",
      "text": "On hit, deals 2d6 acid damage, applying Stain stacks equal to the damage dealt. The damage and stains applied by this Mode are Strengthened against objects. Enhanced: The Stains applied are instead Solid Stains, taking 6 AP to remove and are removed separately."
     },
     {
      "name": "Infuse",
      "text": "Only active while this is your selected Tenet. Once per round when a willing character within 100ft that you can sense hits a target, you can instantly apply the damage and effect of one of your Destruction Modes to that attack (cannot be enhanced or fusioned, can be used on your own hits), but its damage is Weakened."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Immolate",
      "text": "On hit, deals 2d10 heat damage, applying Ignite stacks equal to the damage dealt. Enhanced: After application, the target’s Ignite stacks instantly spread to an adjacent target of your choosing (adding the current target’s Ignite stacks to the new target, still capping out at Pain Threshold/Limit)."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Irradiate",
      "text": "On hit, deals 2d8 radiation damage. In addition, the target takes 1 additional damage from all sources until the start of your next turn, stacking with itself (applies to this hit as well). Enhanced: The effect also reduces healing effects by 1 for the same duration, also stacking."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Freeze",
      "text": "On hit, deals 2d8 cold damage, removing energy from the target equal to the direct damage dealt. If, after removing their energy, the target has 0 remaining energy, they are prevented from gaining their free energy gain at the start of their next turn. Enhanced: The energy block effect of this Mode can now be removed with damage, causing that damage to be doubly Strengthened."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Fusion",
      "text": "Cost: Energy equal to your SNA min. When you Manifest a Destruction Mode, you can use this ability. Select a different Destruction Mode and add its effects to the initial Manifest. Both Modes apply their effects simultaneously, and they do so favorably (Acid applies first to try and break objects, cold applies before heat to avoid it snuffing out the ignite, etc). If you enhance the initial Manifest, the extra one is Manifested as well. Limited to one use per Manifest."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-peace-dream",
  "name": "Peace (Dream)",
  "archetype": "mental",
  "theory": false,
  "requires": 2,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following Mode and Tenet:",
    "entries": [
     {
      "name": "Pacify",
      "text": "On hit, the target is Pacified until the start of your next turn (this Mode does not stack). While Pacified, their attack rolls suffer -2 die size, and their damage dealt is reduced by 1d8. Enhanced: The effect of this Mode flips, providing +1 die size to dodge rolls, and reducing incoming damage by 1d8."
     },
     {
      "name": "Dampen",
      "text": "Only active while this is your selected Tenet. Once per round when damage would be dealt to a target within 100ft of you that you can sense, you can reduce that damage by 1d10."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Tranquility",
      "text": "Cost: Energy equal to half of your PON min, rounded down. When a target under the effects of one of your Peace Modes is attacked or makes an attack, you can use this ability. That triggering attack roll is made with a stack of Disadvantage, only usable once per triggering instance."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Absolution",
      "text": "On hit, the target gains 2 stacks of Absolution, lasting until the start of your next turn. When a creature with Absolution stacks on them deals or takes damage, one of their Absolution stacks is consumed to reduce that damage by 5. Enhanced: You instead choose when these stacks are consumed, and how many are consumed in an instance (with no cap, stacking the effect per consumption)."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Benediction",
      "text": "Cost: Energy equal to double your PON min. When you Manifest a Peace Mode (prior to determining if it hits), you can use this ability. If the triggering Mode hits, duplicate its effects to any target(s) of the same Range as the triggering Mode (meaning same number of targets), at no additional AP/RP cost and requiring no attack roll."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Guard",
      "text": "On hit, the target gains a stack of Guard, lasting until the start of your next turn. When a creature with a Guard stack would take damage, you can consume up to one stack of Guard to redirect up to 15 of that damage to yourself, reducing what they would take. Enhanced: The damage to you is instead applied at the start of your next turn."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-war-nightmare",
  "name": "War (Nightmare)",
  "archetype": "mental",
  "theory": false,
  "requires": 2,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following Mode and Tenet:",
    "entries": [
     {
      "name": "Provoke",
      "text": "On hit, the target is Provoked until the start of your next turn. While provoked, their first set of AP spent on their turn must be spent making an attack of their choice at the nearest target to them, with an additional 2 die size for that attack roll. This can include movement (using strafing up to the AP the attack would cost, otherwise just using the AP to move). Cannot stack. Enhanced: You instead choose the attack they use (from what you know of their attacks), or the target of their attack. Two uses of Enhanced Provoke allow for both of these to apply."
     },
     {
      "name": "Empower",
      "text": "Only active while this is your selected Tenet. Once per round when damage would be dealt to a target within 100ft of you that you can sense, you can increase that damage by 1d10 (of that damage’s type)."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Warmonger",
      "text": "Cost: Energy equal to half of your SNA min, rounded down. When a creature deals damage through an attack that was buffed by one of your War Modes, you can use this ability. That attack’s damage is increased by 1d12 of the attack’s damage type."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Warzone",
      "text": "On hit, the target gains a stack of Warzone lasting until the start of your next turn. When a creature with a Warzone stack deals damage, the damage dealt increases by 1d10 of that attack’s damage type for each stack of Warzone that they have. Enhanced: Adds your snappence min to the damage as well, stacking for each instance of Enhanced Warzone on the target."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Warpath",
      "text": "Cost: Energy equal to your SNA min. When a creature deals damage through an attack that was buffed by one of your War Modes, you can use this ability. Choose one recipient of that creature’s damage and make an attack roll against them (no AP/RP cost). On hit, apply all War Modes on the triggering attack to that creature."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Bloodbond",
      "text": "On hit, the target gains a stack of Bloodbond lasting until the start of your next turn. Whenever a creature with a Bloodbond stack deals damage, you can consume up to one stack of Bloodbond to duplicate up to 10 of the damage they dealt (same type), applying it to a different target (or targets if Area was used) within the Range used by this Manifest (requiring a new attack roll). Bloodbond cannot trigger itself. Enhanced: If the damage that triggered this Mode exceeds the cap of Bloodbond, the stack of Bloodbond is not consumed (still applying its effect)."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-adaptation-dream",
  "name": "Adaptation (Dream)",
  "archetype": "mental",
  "theory": false,
  "requires": 2,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following Mode and Tenet:",
    "entries": [
     {
      "name": "Crescendo",
      "text": "On hit, deals 1d10 physical damage to the target. Regardless of hit, you gain a stack of Adaptation, lasting until the start of your next turn. On hit, you may consume any number of your Adaptation stacks: the first stack consumed increases this Manifest's damage die size by 2, and each stack after that increases it by 4 more than the stack before it. Enhanced: This Manifest's damage can be of a type of your choice, from among physical, heat, cold, radiation and acid, and it is resolved as though you consumed one additional Adaptation stack."
     },
     {
      "name": "Adapt",
      "text": "Only active while this is your selected Tenet. Once per round when you would Manifest, you can expend one of your Adaptation stacks to give that Manifest Strengthened."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Instinct",
      "text": "You keep up to 4 stacks of Adaptation between turns (overrides the duration listed in each mode). In addition, when combat starts, you start with 4 stacks of Adaptation already banked."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Adaptive Skin",
      "text": "On hit, the target gains an instance of Adaptive Skin until the start of your next turn, reducing all damage they take by 1. Regardless of hit, you gain a stack of Adaptation, lasting until the start of your next turn. Whenever a creature with Adaptive Skin would take damage, you can consume any number of your Adaptation stacks to give them additional damage reduction against that damage's type until the start of your next turn: the first stack consumed grants 1 damage reduction, and each stack after that grants 1 more damage reduction than the stack before it. Enhanced: This instance's damage reduction applies only against a single damage type of your choice, but is resolved as though one Adaptation stack had already been consumed for it."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Memory",
      "text": "Cost: Energy equal to your PON min. Whenever an Adaptation stack of yours would be removed, whether by being used or lost, you can use this ability. Keep that stack instead of consuming it. Any effect that stack was used for still applies as normal. If multiple stacks would be removed at once, you can do this for each one affected."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Second Wind",
      "text": "On hit, restores 5 energy to the target. Regardless of hit, you gain a stack of Adaptation, lasting until the start of your next turn. On hit, you can consume 2 of your Adaptation stacks to remove one negative condition affecting the target. Enhanced: Until the start of your next turn, the condition(s) removed by this Manifest cannot be applied to that target again by the same effect."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-perfection-nightmare",
  "name": "Perfection (Nightmare)",
  "archetype": "mental",
  "theory": false,
  "requires": 2,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following Mode and Tenet:",
    "entries": [
     {
      "name": "Exact",
      "text": "Deals 1d12 physical damage to the target, applying regardless of if you hit after the attack roll is made. On hit the damage dealt from this is Strengthened, while on miss the damage is reduced by how much you missed by. Enhanced: The damage from this gains 5 Pierce, which is affected by the Strengthened from the on hit bonus."
     },
     {
      "name": "Ego",
      "text": "Only active while this is your selected Tenet. Once per round when you crit on a Manifest, you can regain 5 energy."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Hubris",
      "text": "Cost: Energy equal to half of your SNA min, rounded down. Whenever you would attempt to Manifest a Perfection Mode, you can use this ability. The entire effect of that Mode is now on hit, but if it hits it automatically crits (assuming it can crit)."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Hone",
      "text": "Increases the target's attack roll results by 1, up to a total of their normal roll maximum, lasting until the start of your next turn, applying regardless of if you hit after the attack roll is made. On hit the target’s damage rolls are Strengthened for the duration, and on miss the bonus applied is Weakened. Does not stack. Enhanced: Instead, their attack roll results are no longer rolled, and are set to their roll's possible average rounded down, then increased by 1 up to their normal roll maximum."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Pride",
      "text": "Whenever you crit against a living target with a Perfection Mode you gain a stack of Pride, lasting until the start of your next turn. Each stack gives all of your Perfection Manifests Advantage on their attack rolls."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Masterstroke",
      "text": "Deals 1d8 damage of your choice from among physical, heat, cold, radiation and acid to the target, applying regardless of if you hit after the attack roll is made. On hit any direct damage dealt by this reapplies on another target within the Manifest range that you can sense, no extra attack roll needed, while on miss the damage is reduced by how much you missed by. Enhanced: When you Manifest this Mode, you can consume any number of Pride stacks. For each consumed, increase the damage dealt by this Mode by 1d8."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-snappence-arts",
  "name": "Snappence Arts",
  "archetype": "mental",
  "theory": false,
  "requires": 3,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Reflex",
      "text": "Cost: Energy equal to half of your Scaling Stat min, rounded down. When any character you can sense begins an action (attacking, dodging, moving, etc), you can use this ability. Manifest a Wonder in response, spending RP equal to your chosen Range’s AP cost. That Manifest resolves before the triggering action, but its effects are Weakened."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Impulse",
      "text": "Cost: Energy equal to half of your Scaling Stat min, rounded down. Once per round, if your selected Tenet has already triggered this round and would trigger again, you can use this ability to apply it to that instance."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Fixation",
      "text": "At the start of your turn, declare a character you can sense. Whenever you use Reflex to react to an action by that character, that instance of Reflex is not Weakened."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Nerve",
      "text": "You have Advantage on the Willpower checks you make to maintain your Concentration."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Afterimage",
      "text": "Once per round, you can Manifest in reaction to a triggering action without spending RP or energy."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-light-dream",
  "name": "Light (Dream)",
  "archetype": "mental",
  "theory": false,
  "requires": 3,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following Mode and Tenet:",
    "entries": [
     {
      "name": "Illuminate",
      "text": "Must be used on a creature. Neither version stacks with itself, nor do their effects stack with each other.",
      "sub": [
       "Against an enemy: On hit, that creature is Illuminated until the start of your next turn. Its attack rolls have their die size reduced by 1, it cannot be naturally obscured, and it cannot benefit from half cover.",
       "Against an ally: On hit, attack rolls made against that ally have their die size reduced by 1 until the start of your next turn. Attacks made by your own allies are unaffected.",
       "Enhanced: Damage dealt by an attack affected by this Mode is Weakened."
      ]
     },
     {
      "name": "Beacon",
      "text": "Only active while this is your selected Tenet. Once per round when you successfully hit a Manifest, you and your allies can see that target through any obstruction until the start of your next turn."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Refraction",
      "text": "Cost: Energy equal to half of your PON min, rounded down. When you Illuminate a creature, you can use this ability to attempt to spread that effect to another creature within the used Mental attack range, requiring an attack roll. The spread may apply either version of the effect, whichever suits the new target. This spread cannot trigger Refraction."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Convergence",
      "text": "The two effects of Illuminate now stack with one another. A creature that is itself Illuminated and is attacking a target affected by Illuminate suffers both die size reductions."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Dispersion",
      "text": "Target one Manifestation or Spell within your chosen range and make your attack roll with Advantage against a dodge roll from that target’s creator. On hit, and if that target has no normal health/durability (such as a normal spell), it is destroyed if its creator’s Scaling Stat is 15 or less. Instead, if it has health or durability and is not sentient, it loses 20 health. Enhanced: This single attack also affects any number of other effects of your choosing within 5ft of the target(s)."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following action:",
    "entries": [
     {
      "name": "Corona",
      "text": "You can, for 1 AP, make an attack roll against a creature you can sense within 100ft that is already under the effects of your Illuminate. On hit, that instance of Illuminate expands to also affect every valid target within 10ft of that creature."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-dark-nightmare",
  "name": "Dark (Nightmare)",
  "archetype": "mental",
  "theory": false,
  "requires": 3,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following Mode and Tenet:",
    "entries": [
     {
      "name": "Eclipse",
      "text": "Must be used on a creature. Neither version stacks with itself, nor do their effects stack with each other.",
      "sub": [
       "Against an enemy: On hit, that creature is Eclipsed until the start of your next turn. Its dodge rolls have their die size reduced by 0.5 (this reduction is rounded up).",
       "Against an ally: On hit, until the start of your next turn, that ally’s attacks cause their targets’ dodge rolls to have their die size reduced by 0.5 (this reduction is rounded up), and that ally becomes one step more obscured (none → lightly → heavily).",
       "Enhanced: Damage dealt by an attack affected by this Mode is Strengthened."
      ]
     },
     {
      "name": "Shadowmark",
      "text": "Only active while this is your selected Tenet. Once per round when you successfully hit a Manifest, you can make that target or yourself one more step obscured (none → lightly → heavily) until the start of your next turn."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Penumbra",
      "text": "Cost: Energy equal to half of your SNA min, rounded down. When you Eclipse a creature, you can use this ability to attempt to spread that effect to another creature within the used Mental attack range, requiring an attack roll. The spread may apply either version of the effect, whichever suits the new target. This spread cannot trigger Penumbra."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Totality",
      "text": "When an ally under your Eclipse attacks a creature under your Eclipse, that attack is treated as though the ally were undetectable to it, giving them half stealth against that target."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Umbral Strike",
      "text": "Store an Umbral Strike charge on the target, lasting until the start of your next turn. When a creature with an Umbral Strike charge makes an attack, it can consume up to one Umbral Strike charge to treat that attack as being made from one step further into stealth (none → half → full) and increase its damage by 1d4 of that attack’s damage type. Enhanced: Gives two charges of Umbral Strike instead."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following action:",
    "entries": [
     {
      "name": "Nightfall",
      "text": "You can, for 1 AP, make an attack roll against a creature you can sense within 100ft that is already under the effects of your Eclipse. On hit, that instance of Eclipse expands to also affect every valid target within 10ft of that creature."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-earth-dream",
  "name": "Earth (Dream)",
  "archetype": "mental",
  "theory": false,
  "requires": 3,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following Mode and Tenet:",
    "entries": [
     {
      "name": "Accretion",
      "text": "On hit, the target is encased in soft material until the start of your next turn. The encasement is an object with 50 Durability and a Limit equal to one fifth of its Durability, working only against Physical and Elemental damage. Attacks against that creature strike the encasement first: it absorbs damage up to its Limit from each attack, reducing its Durability by that much, with any excess passing through to the creature. This Mode stacks on the same target, melding into a single encasement whose Durability and Limit are the sums of its parts. Enhanced: On Manifest, select a damage category (Physical, Elemental, Magical, Supernatural). Damage of that category dealt to this instance is Weakened."
     },
     {
      "name": "Adamant",
      "text": "Only active while this is your selected Tenet. Once per round when you successfully hit a Manifest, you can lower the target’s or your own Pain Threshold by 10, lasting until the start of your next turn. If reapplied with a reaction the moment the effect ends, the target will not fall unconscious from the change in Pain Threshold."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Reinforce",
      "text": "Cost: Energy equal to half of your PON min, rounded down. When an attack would reduce one of your Accretions’ Durability, you can use this ability. For that attack instance, its Limit is equal to its full remaining Durability."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following action:",
    "entries": [
     {
      "name": "Ejecta",
      "text": "At any time, you can consume an Accretion to throw it as an attack roll against a target within 100ft of that Accretion. On a hit, deal physical damage equal to one fifth of that Accretion’s remaining Durability."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Batholith",
      "text": "Your Accretions absorb damage of any category, including Magical and Supernatural. In addition, Ejecta can target fully magical and Supernatural creatures, dealing Arcane damage to fully magical targets and Supernatural damage to Supernatural targets."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Bedrock",
      "text": "When damage would exceed one of your Accretions’ Limit, you may choose to have the excess reduce that encasement’s Durability by twice the excess instead of passing through to the creature."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-sea-nightmare",
  "name": "Sea (Nightmare)",
  "archetype": "mental",
  "theory": false,
  "requires": 3,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following Mode and Tenet:",
    "entries": [
     {
      "name": "Undertow",
      "text": "On hit, the target is engulfed in flowing water until the start of your next turn. Whenever they spend AP to move, or the target is forcefully moved by something other than your own Sea effects, it takes 1d8 physical damage. Enhanced: This Mode’s damage is cold instead of physical, and removes energy from the target equal to the direct damage dealt."
     },
     {
      "name": "Surge",
      "text": "Only active while this is your selected Tenet. Once per round when you successfully hit a Manifest, you can forcefully move the target up to 5ft horizontally in a direction of your choosing, ignoring Force and Lift."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Current",
      "text": "Cost: Energy equal to your SNA min. Whenever a creature takes damage or loses health from one of your Sea Modes, you can use this ability to forcefully move them up to 5ft in a direction of your choosing."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Riptide",
      "text": "On hit, the target is forcefully moved up to 5ft toward or away from a point of your choosing within the used range, ignoring Force and Lift. If this movement causes Force damage, it deals 1d6 more Force damage. Enhanced: Target an additional creature; the original target is pulled toward it, and if the additional target is also hit it is pulled the same distance toward the original. A creature cannot take Force Damage from both pulls of the same Manifest."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Shoal",
      "text": "Damage and health loss from your Sea Modes is Strengthened against prone targets. This does not apply to Force Damage."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Drown",
      "text": "Begin to drown the target by attempting to fill their lungs with water. On hit, they are knocked prone, and if they have been forcefully moved at least 10ft (downward movement does not count) during your current turn they lose 2d8 health (reduced by anything that blocks Supernatural damage, Temp HP, Shielding, Shrouds, and Ward effects). Enhanced: You can Concentrate on this Mode to keep it active and force them to stay prone. At the start of each of your turns they lose that health again so long as they have been forcefully moved at least that distance since the start of your last turn. The effect ends if that distance was not met, or if they get up successfully. Standing up costs 1 AP and prompts an attack roll from them targeting you, which deals no damage and only ends the effect on a hit."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-willpower-arts",
  "name": "Willpower Arts",
  "archetype": "mental",
  "theory": false,
  "requires": 4,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following action:",
    "entries": [
     {
      "name": "Attuned",
      "text": "You can swap your Icon attunement for 2 AP instead of the normal 6 AP. Once per turn, you can swap it for 2 RP instead."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Make Clear",
      "text": "Cost: Energy equal to your WIL min. Whenever you activate your Form’s Ward effect, you can use this ability. You get Advantage on the Ward’s activation attack roll. In addition, if you still end up missing the Ward activation attack roll, you can reroll it once, not keeping any Advantages/Disadvantages the original roll had."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Innate",
      "text": "Your first usage of your Form’s Ward effect each turn costs no AP/RP, and is automatically Enhanced."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Recur",
      "text": "Cost: Energy equal to half of your WIL min, rounded down. Whenever you activate your Form’s Ward effect on a target other than yourself, you can use this ability. If you hit the Ward effect, it chains to you as well for free, no additional hit required (including its Enhance effect if it was initially Enhanced, and its crit bonus if the initial activation crit)."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Innate Mastery",
      "text": "Innate also causes that Ward’s target to have Disadvantage on their roll against it."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-growth-dream",
  "name": "Growth (Dream)",
  "archetype": "mental",
  "theory": false,
  "requires": 4,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following Mode and Tenet:",
    "entries": [
     {
      "name": "Cultivate",
      "text": "On hit, the target gains a Growth stack, lasting until the start of your next turn. When the target takes an action (any named thing that spends AP or RP: an attack, a Manifest, a cast Spell, or an ability with an AP/RP cost), it can spend any number of its Growth stacks on that action, each on a different Growth option you have unlocked. Enhanced: The target gains two Growth stacks instead.",
      "sub": [
       "Flourish: The attack deals 2d8 more damage of its type.",
       "Thrift: The action costs 3 less energy (to a minimum of 0)."
      ]
     },
     {
      "name": "Sapling",
      "text": "Only active while this is your selected Tenet. Once per round when you successfully hit a Manifest, the target or you gains one Growth stack."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "Your Growth stacks gain the following options:",
    "entries": [
     {
      "name": "Pierce",
      "text": "The attack ignores up to 10 Limit."
     },
     {
      "name": "Feed",
      "text": "If the action applies Ignite, Stain, Slow, or Haste stacks, it applies 12 more of each."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "Your Growth stacks gain the following options:",
    "entries": [
     {
      "name": "Graft",
      "text": "If the action grants Temp HP or Shielding to its target, it grants 10 more."
     },
     {
      "name": "Bark",
      "text": "The acting creature gains 10 Temp HP until the start of its next turn."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "Your Growth stacks gain the following options:",
    "entries": [
     {
      "name": "Uproot",
      "text": "The action’s target is hit with 12d8 Force in a direction of your choosing."
     },
     {
      "name": "Offshoot",
      "text": "Copy another option spent on this action. Offshoot can only apply once per action."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Full Bloom",
      "text": "When an action spends Growth stacks on three or more options, that action and those Growth stacks damage/bolded effects are Strengthened."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-stagnation-nightmare",
  "name": "Stagnation (Nightmare)",
  "archetype": "mental",
  "theory": false,
  "requires": 4,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following Mode and Tenet:",
    "entries": [
     {
      "name": "Mire",
      "text": "On hit, choose an action type: Martial Attack, Mental Manifest, or Magic Spell. Until the start of your next turn, whenever the target spends AP or RP on an action of a Mired type, it gains one Stagnation stack per point spent. Stagnation stacks are shared between all sources, and all are removed at the start of your next turn. A Manifest that would Mire an action type that is already Mired has no effect. As the target reaches each stack count below, that effect applies. Enhanced: Choose two action types."
     },
     {
      "name": "Toll (1 Stack)",
      "text": "The target loses 2 energy. Energy below 0 becomes health loss at 1:1 (reduced by anything that blocks Supernatural damage, Temp HP, Shielding, Shrouds, and Ward effects)."
     },
     {
      "name": "Silt (2 Stacks)",
      "text": "The target gains 12 Slow stacks."
     },
     {
      "name": "Moss",
      "text": "Only active while this is your selected Tenet. Once per round when you successfully hit a Manifest, the target gains one Stagnation stack."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "Your Stagnation stacks gain the following effect:",
    "entries": [
     {
      "name": "Grind (3 Stacks)",
      "text": "The target takes 1d8 physical damage."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "Your Stagnation stacks gain the following effect:",
    "entries": [
     {
      "name": "Wane (4+ Stacks)",
      "text": "While the target has 4 or more Stagnation stacks, its attack rolls for Mired action types have their die size reduced by 1."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "Your Stagnation stacks gain the following effect:",
    "entries": [
     {
      "name": "Crush (5 Stacks)",
      "text": "The target is hit with 12d8 downward Force."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "Your Stagnation stacks gain the following effect:",
    "entries": [
     {
      "name": "Stasis (6+ Stacks)",
      "text": "Each stack the target gains from 6 onward applies two of Toll, Silt, Grind, and Crush, chosen each time. The same effect can be chosen twice, and the two chosen effects combine into one (two Crushes are a single 24d8 downward Force, two Grinds are 2d8 physical damage, and so on)."
     }
    ]
   }
  ]
 },
 {
  "id": "mental-fortune-dream",
  "name": "Fortune (Dream)",
  "archetype": "mental",
  "theory": false,
  "requires": 4,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following Mode, passive, and Tenet:",
    "entries": [
     {
      "name": "Wager",
      "text": "On hit, deals 1d10 physical damage to the target. Enhanced: The damage is instead Elemental (your choice of the 4) or Arcane, your choice on Manifest."
     },
     {
      "name": "Fortune’s Bands",
      "text": "Fortune Modes cannot crit, instead they get benefits or drawbacks depending on where they land in the below chart. The beneficial effects still require a hit overall, while the self hit automatically applies.",
      "sub": [
       "Under one half: You hit yourself with the Manifest instead of the target",
       "One half to under three quarters: Its effects gain 2 stacks of Strengthened",
       "Three quarters or higher: Its effects gain 4 stacks of Strengthened"
      ]
     },
     {
      "name": "Rig",
      "text": "Only active while this is your selected Tenet. Once per round at any time as a free reaction you can roll the Fortune Table found at the end of this tree, then select a target you can sense within 100ft of you to apply the rolled effect to on a successful attack roll."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Parlay",
      "text": "Cost: Energy equal to your PON min. When you Manifest a Fortune Mode, you can use this ability. For that Manifest, stacks of Strengthened are multiplicative instead of additive."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Windfall",
      "text": "On hit, restore 4 energy to the target. Energy restored above their maximum becomes Temp HP at 1:1, lasting until the start of your next turn. If this Manifest self hits from the bands, you instead lose that energy, and energy lost below 0 becomes health loss at 1:1. Enhanced: Both Energy conversion ratios become 1:2."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Double Down",
      "text": "Cost: Energy equal to your PON min. When you Manifest a Fortune Mode, you can use this ability. For that Manifest, the attack roll has Disadvantage, but a band at seven eighths and above is added that grants 8 stacks of Strengthened, and the self-hit bands gain Strengthened as well; 2 stacks from one eighth to under one half, 4 stacks below one eighth."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Providence",
      "text": "Select a target to make an attack roll against, on hit roll a d100 to get a result from the Fortune Table, applying the rolled effect to the target (the self hit band still applies here). Enhanced: Roll the d100 twice and choose which result applies."
     }
    ]
   }
  ],
  "table": {
   "title": "The Fortune Table",
   "rows": [
    [
     "1–3",
     "Deals 1d12 physical damage to the target and every creature of your choice within 20ft, each knocked prone.",
     [
      "1d12 physical damage"
     ]
    ],
    [
     "4–6",
     "Deals 1d12 cold damage to the target, and one effect they are Concentrating on ends.",
     [
      "1d12 cold damage"
     ]
    ],
    [
     "7–11",
     "Deals 1d12 physical damage to the target, and they cannot benefit from advantage until the start of your next turn.",
     [
      "1d12 physical damage"
     ]
    ],
    [
     "12–16",
     "Deals 1d10 radiation damage to the target, and their senses are each treated as one step lower until the start of your next turn (does not stack).",
     [
      "1d10 radiation damage"
     ]
    ],
    [
     "17–21",
     "The target loses 1d10 health (reduced by anything that blocks Supernatural damage, Temp HP, Shielding, Shrouds, and Ward effects).",
     [
      "1d10 health"
     ]
    ],
    [
     "22–26",
     "Deals 1d10 physical damage to the target and knocks them prone.",
     [
      "1d10 physical damage"
     ]
    ],
    [
     "27–31",
     "Deals 1d8 heat damage to the target and every creature within 10ft of it.",
     [
      "1d8 heat damage"
     ]
    ],
    [
     "32–35",
     "The target’s Pain Threshold is raised by 10 until the start of your next turn.",
     [
      "raised by",
      "10"
     ]
    ],
    [
     "36–39",
     "The target’s dodge rolls have their die size reduced by 0.5, rounded up, until the start of your next turn.",
     [
      "die size reduced by 0.5"
     ]
    ],
    [
     "40–43",
     "The target’s attack rolls have their die size reduced by 1 until the start of your next turn.",
     [
      "die size reduced by 1"
     ]
    ],
    [
     "44–47",
     "The target gains 15 Slow stacks, lasting until the start of your next turn.",
     [
      "15 Slow stacks"
     ]
    ],
    [
     "48–50",
     "The target loses 3 energy.",
     [
      "3 energy"
     ]
    ],
    [
     "51–53",
     "Apply 5d8 Force to the target in a direction of your choosing.",
     [
      "5d8 Force"
     ]
    ],
    [
     "54–56",
     "The target is forcefully moved 2ft in a direction of your choosing, ignoring Force and Lift.",
     [
      "2ft"
     ]
    ],
    [
     "57–59",
     "Deals 1d10 Elemental damage to the target, of a type of your choice.",
     [
      "1d10 Elemental damage"
     ]
    ],
    [
     "60–63",
     "Restore 3 energy to the target.",
     [
      "3 energy"
     ]
    ],
    [
     "64–67",
     "Give the target 15 Haste stacks, lasting until the start of your next turn.",
     [
      "15 Haste stacks"
     ]
    ],
    [
     "68–71",
     "Give the target 5 Temp HP, lasting until the start of your next turn.",
     [
      "5 Temp HP"
     ]
    ],
    [
     "72–75",
     "The target’s dodge rolls gain +0.5 die size, rounded up, until the start of your next turn.",
     [
      "+0.5 die size"
     ]
    ],
    [
     "76–79",
     "The target’s attack rolls gain +1 die size until the start of your next turn.",
     [
      "+1 die size"
     ]
    ],
    [
     "80–84",
     "Restore 5 health to the target, only affecting damage taken since the start of your last turn.",
     [
      "5 health"
     ]
    ],
    [
     "85–89",
     "The target’s Pain Threshold is lowered by 10 until the start of your next turn.",
     [
      "lowered by",
      "10"
     ]
    ],
    [
     "90–94",
     "Restore 5 energy to the target; energy above maximum becomes Temp HP at 1:1 until the start of your next turn.",
     [
      "5 energy"
     ]
    ],
    [
     "95–97",
     "Reroll this table, applying that effect to the same target.",
     []
    ],
    [
     "98–100",
     "Give the target 5 Temp HP, restore 5 health to them (only affecting damage taken since the start of your last turn), and remove one Stage 1 negative condition from them.",
     [
      "5 Temp HP",
      "5 health"
     ]
    ]
   ]
  }
 },
 {
  "id": "mental-ruin-nightmare",
  "name": "Ruin (Nightmare)",
  "archetype": "mental",
  "theory": false,
  "requires": 4,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following Mode, passive, and Tenet:",
    "entries": [
     {
      "name": "Jinx",
      "text": "On hit, store a Jinx of 1d10 physical damage on the target. Enhanced: The first time this Jinx would fizzle, it waits for the target’s next attack roll instead."
     },
     {
      "name": "Ruin’s Bands",
      "text": "Ruin Modes cannot crit. Instead, on hit, they store their effect on the target as a Jinx, lasting until the start of your next turn. The target’s next attack roll resolves every Jinx on it at once. The result depends on where that roll lands relative to its maximum:",
      "sub": [
       "Under one half: All the Jinxes fizzle.",
       "One half to under three quarters: The Jinxes’ effects gain 2 stacks of Strengthened",
       "Three quarters or higher: The Jinxes’ effects gain 4 stacks of Strengthened"
      ]
     },
     {
      "name": "Doom",
      "text": "Only active while this is your selected Tenet. Once per round at any time as a free reaction you can roll the Ruin Table found at the end of this tree, then select a target you can sense within 100ft of you to apply the rolled effect to on a successful attack roll."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Gild",
      "text": "Cost: Energy equal to half your SNA min, rounded down. When you Manifest a Ruin Mode, you can use this ability. If that Manifest hits, the roll that resolves the target’s Jinxes has Advantage."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Forfeit",
      "text": "On hit, store a Jinx that removes 4 energy from the target. Any energy that would go below 0 becomes health loss at 1:1 instead (reduced by anything that blocks Supernatural damage, Temp HP, Shielding, Shrouds, and Ward effects). Enhanced: That conversion becomes 1:2."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Reversal",
      "text": "Cost: Energy equal to half your SNA min, rounded down. After a Jinxed creature’s roll resolves your Jinxes, you can use this ability to flip that roll: that die’s result becomes (its size + 1 − the result)."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following Mode:",
    "entries": [
     {
      "name": "Calamity",
      "text": "On hit, roll a d100 and store the Ruin Table result on the target as a Jinx. Enhanced: Roll twice and choose which result to store."
     }
    ]
   }
  ],
  "table": {
   "title": "The Ruin Table",
   "rows": [
    [
     "1–4",
     "Deals 1d12 physical to the target. If the target is at or above ¾ of its max health, this damage gains 2 stacks of Strengthened.",
     [
      "1d12 physical"
     ]
    ],
    [
     "5–8",
     "The target’s next attack after this one causes them to deal 1d10 physical to themself, hit or miss. Lasts until used or the start of your next turn.",
     [
      "1d10 physical"
     ]
    ],
    [
     "9–12",
     "Deals 1d10 physical to the target and to one creature of your choice within 10ft of it.",
     [
      "1d10 physical"
     ]
    ],
    [
     "13–16",
     "A fresh Jinx holding 1d8 physical passes to a creature of your choice within 10ft of the target. Lasts until used or the start of your next turn.",
     [
      "1d8 physical"
     ]
    ],
    [
     "17–20",
     "Removes 1d10 Temp HP/Shielding from the target, then deals 1d10 acid damage to them.",
     [
      "1d10 Temp HP/Shielding",
      "1d10 acid damage"
     ]
    ],
    [
     "21–24",
     "Deals 1d10 radiation damage to the target, and the target cannot regain health until the start of your next turn.",
     [
      "1d10 radiation"
     ]
    ],
    [
     "25–28",
     "Deals 1d8 heat damage to the target now, and again at the start of the target’s next turn.",
     [
      "1d8 heat"
     ]
    ],
    [
     "29–32",
     "Deals 1d10 cold damage to the target and applies 10 Slow stacks to them.",
     [
      "1d10 cold",
      "10 Slow stacks"
     ]
    ],
    [
     "33–36",
     "The target loses 1d10 health (reduced by anything that blocks Supernatural damage, Temp HP, Shielding, Shrouds, and Ward effects).",
     [
      "1d10 health"
     ]
    ],
    [
     "37–40",
     "The target loses 3 energy. Any amount below 0 becomes health loss 1:1 (reduced by anything that blocks Supernatural damage, Temp HP, Shielding, Shrouds, and Ward effects).",
     [
      "3 energy"
     ]
    ],
    [
     "41–44",
     "The next time the target spends energy, it spends 3 more. Any amount below 0 becomes health loss 1:1 (reduced by anything that blocks Supernatural damage, Temp HP, Shielding, Shrouds, and Ward effects). Lasts until used or the start of your next turn.",
     [
      "3",
      "more"
     ]
    ],
    [
     "45–48",
     "The target’s Haste stacks become Slow stacks, then it gains 10 Slow stacks.",
     [
      "10 Slow stacks"
     ]
    ],
    [
     "49–52",
     "The target loses 10 Temp HP/Shielding, and one object that it is holding or wearing that has Durability loses 10 Durability.",
     [
      "10 Temp HP/Shielding",
      "10 Durability"
     ]
    ],
    [
     "53–56",
     "Deals 1d8 physical damage to the target, and their next attack roll has Disadvantage. Lasts until used or the start of your next turn.",
     [
      "1d8 physical damage"
     ]
    ],
    [
     "57–60",
     "Deals 1d8 physical damage to the target, and their next dodge roll has Disadvantage. Lasts until used or the start of your next turn.",
     [
      "1d8 physical damage"
     ]
    ],
    [
     "61–64",
     "Deals 1d6 physical damage to the target, and the next Jinx to resolve on the target gains 2 Strengthened stacks (if multiple, choose one). Lasts until used or the start of your next turn.",
     [
      "1d6 physical damage"
     ]
    ],
    [
     "65–68",
     "Deals 1d6 physical damage to the target, and you may flip the target’s next attack roll for free, as Reversal does. Lasts until used or the start of your next turn.",
     [
      "1d6 physical damage"
     ]
    ],
    [
     "69–72",
     "Deals 1d12 physical damage to the target, ignoring up to 10 Limit.",
     [
      "1d12 physical damage",
      "10 Limit"
     ]
    ],
    [
     "73–76",
     "Deals 1d8 physical damage to the target, and the next time they deal damage, that damage has a stack of Weakened. Lasts until used or the start of your next turn.",
     [
      "1d8 physical damage"
     ]
    ],
    [
     "77–80",
     "One effect the target is Concentrating on ends, and it loses 1d8 health (reduced by anything that blocks Supernatural damage, Temp HP, Shielding, Shrouds, and Ward effects).",
     [
      "1d8 health"
     ]
    ],
    [
     "81–84",
     "Deals 1d8 physical damage to the target, and the next time they take non-Jinx damage, that damage has a stack of Strengthened. Lasts until used or the start of your next turn.",
     [
      "1d8 physical damage"
     ]
    ],
    [
     "85–88",
     "If the target has more than half its max energy, it loses 5 energy. Otherwise, they are dealt 1d10 physical damage.",
     [
      "5 energy",
      "1d10 physical damage"
     ]
    ],
    [
     "89–92",
     "Roll again and store the new result on the target as a fresh Calamity.",
     []
    ],
    [
     "93–96",
     "Roll twice more and apply both, rerolling any 89–100.",
     []
    ],
    [
     "97–100",
     "Deals 1d12 Supernatural damage to the target, and they are knocked prone.",
     [
      "1d12 Supernatural"
     ]
    ]
   ]
  }
 },
 {
  "id": "mental-esoteric-arts",
  "name": "Esoteric Arts",
  "archetype": "mental",
  "theory": false,
  "requires": 5,
  "tiers": [
   {
    "tier": 1,
    "free": false,
    "summary": "You gain the following action and passive:",
    "entries": [
     {
      "name": "Seed",
      "text": "Spend 8 hours in a Trance to seed an Omen of a Wonder you have at Tier 5. It is bound to you and counts as one of your Concentrations. At Seeding, choose its Form from its Wonder’s pole (Common, Uncommon, or Rare) and its Alignment depth."
     },
     {
      "name": "Omen",
      "text": "Your Omen has its own sapience, initiative, and turn, with its own AP, RP, and an energy pool equal to 5 times its skill points. It has stat points equal to yours, with two thirds in its Wonder’s scaling stat and one third in Willpower (you can flip this split at Seeding), and skill points equal to one fifth of its stat points, which only set its dice. It always has full Mental Theory and its own Wonder at Tier 5, regardless of its skill points."
     },
     {
      "name": "Pole-Bound",
      "text": "Your Omen Manifests only its own Wonder, and that Wonder’s Tenet is always active for it. It is its own Icon, using its Form’s Ward without needing one. Attacks between it and creatures or effects of its opposite pole are Strengthened, in both directions. It never acts against its pole and never aids the opposite one."
     },
     {
      "name": "Bond",
      "text": "If you end this Concentration yourself and your Omen is willing, it is dismissed. It is willing if, since it was seeded, you have Manifested its Wonder more times than its opposite pole’s Wonder. Otherwise, make an attack roll against it; on a miss, the bond is severed and it turns hostile. If you lose this Concentration any other way, it fights on your side for the rest of that battle, but turns hostile if angered (you or an ally harming it, Manifesting its opposite pole where it can sense it, or acting against its pole). If it is not hostile when the battle ends, you can rebind it with 1 hour of work."
     }
    ]
   },
   {
    "tier": 2,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Channel",
      "text": "Cost: Energy equal to half your scaling stat min, rounded down. When you Manifest a Wonder, you can use this ability to Manifest it from your Omen’s position instead of your own, using its senses. If the Mode belongs to your Omen’s Wonder, its attack roll has Advantage."
     }
    ]
   },
   {
    "tier": 3,
    "free": false,
    "summary": "You gain the following ability:",
    "entries": [
     {
      "name": "Unbind",
      "text": "Cost: 2 AP and energy equal to your scaling stat min. Until the start of your next turn, your Omen has its full stats (stat points equal to twice yours, with its skill points unchanged). Its current HP rises with its Max HP, and when this ends, its current HP is reduced to its normal Max HP if it is above it."
     }
    ]
   },
   {
    "tier": 4,
    "free": false,
    "summary": "You gain the following passive:",
    "entries": [
     {
      "name": "Kinship",
      "text": "While your Omen is within 30ft of you, you also benefit from its Tenet. If it is your selected Tenet, you can trigger it one additional time per round (your Omen still triggers its own once per round)."
     }
    ]
   },
   {
    "tier": 5,
    "free": false,
    "summary": "You gain the following action:",
    "entries": [
     {
      "name": "Rend",
      "text": "Summon an Omen of a Wonder you have at Tier 5 instantly. Make an attack roll against it with Disadvantage, with it dodging at Advantage. On a hit, it is seeded and bound to you as normal. On a miss, it arrives free with its full stats and is hostile."
     }
    ]
   }
  ]
 }
];
