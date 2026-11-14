// Generated from Flow State - ABCs by tools/build_abcs.py. Don't edit by hand; re-run `npm run trees`.
export const ABC_RULES = {
 "id": "ancestry-abc-rules",
 "name": "ABC Rules",
 "archetype": "ancestry",
 "rulesOnly": true,
 "requires": 0,
 "tiers": [
  {
   "tier": 0,
   "free": true,
   "summary": "You gain the following rules:",
   "entries": [
    {
     "name": "Ancestry, Background, and Culture",
     "text": "Every character of high sapience is defined by three choices, made in order. You first pick an Ancestry, then a Background from that Ancestry’s list, then your Culture: one Homeland, from your Ancestry’s list or the Shared Homelands, and one Circle, from your Background’s list or the Shared Circles."
    },
    {
     "name": "Ancestry",
     "text": "Your Ancestry is the people you are born to. Each Ancestry is a group, with a core tree shared by the wider kind it belongs to (all Wuson-descended peoples share the Wusonian core) and one or more meat trees unique to it, or shared with closely related Ancestries. You start with the Tier 0 of your Ancestry’s core, and buy its other tiers as normal."
    },
    {
     "name": "Background",
     "text": "Your Background is how you were raised and what you did before the story began. It grants 15 free points of starting skill trees at normal tier costs, including any Theory or core tiers those trees require. Free points unlock trees and count toward their requirements, but toward nothing else: not dice, not the Stat Bonus, and not Energy. Any points a Background cannot place go into your Ancestry’s trees instead. Some Backgrounds are shared across several Ancestries, with small differences for each."
    },
    {
     "name": "Culture",
     "text": "Your Culture has two parts: your Homeland, the people and place you come from, and your Circle, the group you came up in through your Background. Together they set your values, customs, outlook, and ties in the world. Cultures are purely roleplay, and have no mechanical effect."
    },
    {
     "name": "Sapience",
     "text": "Every creature sits in one of three bands of sapience. Sapience sets what a creature can draw on; age and experience set how far it has grown within that, adding stat and skill points over time.",
     "sub": [
      "High sapience (band 3): Peoples such as Humans and Orcs. They have full access to Ancestry, Background, and Culture, and start at about 3 stat points per skill point.",
      "Mid sapience (band 2): Creatures capable of some higher learning, perhaps tool use or social life, but far more limited. They have an Ancestry and a Background but no Culture, meaning no defined cultural roleplay of their own, and they keep the free skill trees their Background grants. Their ratio is about 5:1, sometimes wider.",
      "Low sapience (band 1): Creatures with no real intelligence, unable to use tools in any meaningful way and hard-pressed to learn tactics. This covers most animals, such as cats, deer, and most dogs. They have only their Ancestry and get no free trees. Their ratio is about 10:1 or worse, widening the lower their sapience."
     ]
    }
   ]
  }
 ]
};
export const ANCESTRIES = {
 "human": {
  "id": "human",
  "name": "Human",
  "core": "ancestry-wusonian",
  "size": 3,
  "languages": "Common.",
  "lifespan": "About 80 years.",
  "backgrounds": [
   "explorer",
   "scholar-s-apprentice",
   "recruit",
   "apprentice-mage",
   "novice",
   "hunter",
   "trader-s-apprentice",
   "laborer",
   "urchin",
   "outsider"
  ],
  "profile": [
   {
    "name": "Lineage",
    "text": "One of the two founding races of the Twin Continents, descended from the Wuson. Ancestors of the Dwarves, Halflings, Elves, Dusken, and Drakenblood."
   },
   {
    "name": "Homeland",
    "text": "The United States of Tartan (north of the eastern continent), though their explorative, inquisitive nature puts them nearly everywhere."
   },
   {
    "name": "Size",
    "text": "3."
   },
   {
    "name": "Languages",
    "text": "Common."
   },
   {
    "name": "Lifespan",
    "text": "About 80 years."
   },
   {
    "name": "Backgrounds",
    "text": "Explorer, Scholar’s Apprentice, Recruit, Apprentice Mage, Novice, Hunter, Trader’s Apprentice, Laborer, Urchin, Outsider."
   },
   {
    "name": "Homelands",
    "text": "Guild-Town, Crownland, Old Pantheon, or a Shared Homeland."
   }
  ],
  "trees": [
   "ancestry-wusonian",
   "ancestry-commonkin",
   "ancestry-human-tree"
  ]
 },
 "dwarf": {
  "id": "dwarf",
  "name": "Dwarf",
  "core": "ancestry-wusonian",
  "size": 3,
  "languages": "Common (Dwarven dialect, shared with Halflings).",
  "lifespan": "About 80 years.",
  "backgrounds": [
   "engineer-s-apprentice",
   "mine-hand",
   "recruit",
   "apprentice-mage",
   "novice",
   "hunter",
   "trader-s-apprentice",
   "laborer",
   "outsider"
  ],
  "profile": [
   {
    "name": "Lineage",
    "text": "Human line. Descended from Human colonization ships that landed on the western continent; years at sea left them stockier and disease-resistant."
   },
   {
    "name": "Homeland",
    "text": "The Dwarven Republic (south-west of the western continent)."
   },
   {
    "name": "Size",
    "text": "3."
   },
   {
    "name": "Languages",
    "text": "Common (Dwarven dialect, shared with Halflings)."
   },
   {
    "name": "Lifespan",
    "text": "About 80 years."
   },
   {
    "name": "Backgrounds",
    "text": "Engineer’s Apprentice, Mine Hand, Recruit, Apprentice Mage, Novice, Hunter, Trader’s Apprentice, Laborer, Outsider."
   },
   {
    "name": "Homelands",
    "text": "Iron Republic, Moon Faithful, Common Folk, or a Shared Homeland."
   }
  ],
  "trees": [
   "ancestry-wusonian",
   "ancestry-commonkin",
   "ancestry-dwarf-tree"
  ]
 },
 "halfling": {
  "id": "halfling",
  "name": "Halfling",
  "core": "ancestry-wusonian",
  "size": 2,
  "languages": "Common (shared with Dwarves).",
  "lifespan": "About 60 years.",
  "backgrounds": [
   "street-performer",
   "courier",
   "apprentice-mage",
   "novice",
   "trader-s-apprentice",
   "laborer",
   "urchin",
   "outsider"
  ],
  "profile": [
   {
    "name": "Lineage",
    "text": "Human line, the first Human subspecies."
   },
   {
    "name": "Homeland",
    "text": "Littlefoot Hills (just south of the Humans)."
   },
   {
    "name": "Size",
    "text": "2."
   },
   {
    "name": "Languages",
    "text": "Common (shared with Dwarves)."
   },
   {
    "name": "Lifespan",
    "text": "About 60 years."
   },
   {
    "name": "Backgrounds",
    "text": "Street Performer, Courier, Apprentice Mage, Novice, Trader’s Apprentice, Laborer, Urchin, Outsider."
   },
   {
    "name": "Homelands",
    "text": "Hills Revelers, Cargo Families, Council-Town, or a Shared Homeland."
   }
  ],
  "trees": [
   "ancestry-wusonian",
   "ancestry-commonkin",
   "ancestry-smallfolk",
   "ancestry-halfling-tree"
  ]
 },
 "elf": {
  "id": "elf",
  "name": "Elf",
  "core": "ancestry-wusonian",
  "size": 3,
  "languages": "Common.",
  "lifespan": "About 60 years.",
  "backgrounds": [
   "college-student",
   "court-page",
   "recruit",
   "apprentice-mage",
   "novice",
   "hunter",
   "laborer",
   "urchin",
   "outsider"
  ],
  "profile": [
   {
    "name": "Lineage",
    "text": "Human line. Transformed by the explosion of magic when the southern Rift opened. They are not Rift-born, a term reserved for peoples made when a Rift was closed. Lighter-skinned, weaker, and far more magically adept than Humans."
   },
   {
    "name": "Homeland",
    "text": "The Paanlands (south of the eastern continent)."
   },
   {
    "name": "Size",
    "text": "3."
   },
   {
    "name": "Languages",
    "text": "Common."
   },
   {
    "name": "Lifespan",
    "text": "About 60 years."
   },
   {
    "name": "Backgrounds",
    "text": "College Student, Court Page, Recruit, Apprentice Mage, Novice, Hunter, Laborer, Urchin, Outsider."
   },
   {
    "name": "Homelands",
    "text": "Elven Courts, Paan Faithful, Open-City Elves, or a Shared Homeland."
   }
  ],
  "trees": [
   "ancestry-wusonian",
   "ancestry-commonkin",
   "ancestry-elf-tree"
  ]
 },
 "dusken": {
  "id": "dusken",
  "name": "Dusken",
  "core": "ancestry-wusonian",
  "size": 3,
  "languages": "Common.",
  "lifespan": "About 50 years, as the curse wears on the body; those who master their spirit can live to about 90.",
  "backgrounds": [
   "spirit-hunter-initiate",
   "spirit-tender",
   "recruit",
   "apprentice-mage",
   "novice",
   "laborer",
   "outsider"
  ],
  "profile": [
   {
    "name": "Lineage",
    "text": "Human line, through the Elves, Rift-born. Made when Paan sealed the southern Rift: gray-skinned elves shrouded by the Dusken curse (the shadow veil)."
   },
   {
    "name": "Homeland",
    "text": "The Dusklands (southern tip of the eastern continent)."
   },
   {
    "name": "Size",
    "text": "3."
   },
   {
    "name": "Languages",
    "text": "Common."
   },
   {
    "name": "Lifespan",
    "text": "About 50 years, as the curse wears on the body; those who master their spirit can live to about 90."
   },
   {
    "name": "Loose Tether",
    "text": "Your spirit is only loosely bound to your body. This has no effect on its own, but it is what the Dusken Shadow and Dusken Spirit trees build on."
   },
   {
    "name": "Backgrounds",
    "text": "Spirit Hunter Initiate, Spirit Tender, Recruit, Apprentice Mage, Novice, Laborer, Outsider."
   },
   {
    "name": "Homelands",
    "text": "Paan Faithful, Tribal Village, Shadow Supremacist, or a Shared Homeland."
   }
  ],
  "trees": [
   "ancestry-wusonian",
   "ancestry-commonkin",
   "ancestry-dusken-shadow",
   "ancestry-dusken-spirit"
  ]
 },
 "drakenblood": {
  "id": "drakenblood",
  "name": "Drakenblood",
  "core": "ancestry-wusonian",
  "size": 3,
  "languages": "Common and Bestial.",
  "lifespan": "About 50 years, shortened by their transformation.",
  "backgrounds": [
   "ward-apprentice",
   "reclaimer-initiate",
   "recruit",
   "apprentice-mage",
   "novice",
   "laborer",
   "outsider"
  ],
  "profile": [
   {
    "name": "Lineage",
    "text": "Human line, Rift-born. The people of Draken Hold, rewritten by their royals’ great spell into a lizard-like people, each with an elemental gland and a shorter lifespan."
   },
   {
    "name": "Homeland",
    "text": "The Kingdom of Drakenblood (south-central western continent), between the Goblins and the Fire Walkers; their old land is now the Dragon Wastes."
   },
   {
    "name": "Size",
    "text": "3."
   },
   {
    "name": "Languages",
    "text": "Common and Bestial."
   },
   {
    "name": "Lifespan",
    "text": "About 50 years, shortened by their transformation."
   },
   {
    "name": "Elemental Gland",
    "text": "When you create a Drakenblood character, choose your gland’s element: Heat, Cold, Acid, or Radiation. You can make Light or Heavy unarmed attacks with your breath instead of your body; these are natural attacks with a range of 15ft that deal your gland’s element instead of Physical damage. The Draken Elements tree builds on this gland."
   },
   {
    "name": "Backgrounds",
    "text": "Ward Apprentice, Reclaimer Initiate, Recruit, Apprentice Mage, Novice, Laborer, Outsider."
   },
   {
    "name": "Homelands",
    "text": "Reclaimers, Wired Cities, Crown-Sworn, or a Shared Homeland."
   }
  ],
  "trees": [
   "ancestry-wusonian",
   "ancestry-commonkin",
   "ancestry-draken-elements",
   "ancestry-draken-legacy"
  ]
 },
 "orc": {
  "id": "orc",
  "name": "Orc",
  "core": "ancestry-wusonian",
  "size": 3,
  "languages": "Bestial (Orcish).",
  "lifespan": "About 40 years in the hostile jungle; up to about 80 in peaceful conditions.",
  "backgrounds": [
   "untested-warrior",
   "wildspeaker-s-apprentice",
   "recruit",
   "apprentice-mage",
   "novice",
   "hunter",
   "laborer",
   "outsider"
  ],
  "profile": [
   {
    "name": "Lineage",
    "text": "One of the two founding races of the Twin Continents, descended from the Wuson. Ancestors of the Fire Walkers and Goblins."
   },
   {
    "name": "Homeland",
    "text": "The Orcish Wildlands (north-west of the western continent)."
   },
   {
    "name": "Size",
    "text": "3."
   },
   {
    "name": "Languages",
    "text": "Bestial (Orcish)."
   },
   {
    "name": "Lifespan",
    "text": "About 40 years in the hostile jungle; up to about 80 in peaceful conditions."
   },
   {
    "name": "Backgrounds",
    "text": "Untested Warrior, Wildspeaker’s Apprentice, Recruit, Apprentice Mage, Novice, Hunter, Laborer, Outsider."
   },
   {
    "name": "Homelands",
    "text": "Great Tribe, Small Tribe, Borderland, or a Shared Homeland."
   }
  ],
  "trees": [
   "ancestry-wusonian",
   "ancestry-bestial",
   "ancestry-orc-tree"
  ]
 },
 "fire-walker": {
  "id": "fire-walker",
  "name": "Fire Walker",
  "core": "ancestry-wusonian",
  "size": 3,
  "languages": "Bestial (Orcish).",
  "lifespan": "About 50 years in their harsh climate; up to about 80 in ideal conditions.",
  "backgrounds": [
   "nomad",
   "pilgrim",
   "inquisition-familiar",
   "tiro",
   "recruit",
   "apprentice-mage",
   "novice",
   "hunter",
   "laborer",
   "outsider"
  ],
  "profile": [
   {
    "name": "Lineage",
    "text": "Orc line. Orcs who migrated east into the savannas and deserts; tannish-brown and beefier."
   },
   {
    "name": "Homeland",
    "text": "The Hellspire Expanse (center/east of the western continent)."
   },
   {
    "name": "Size",
    "text": "3."
   },
   {
    "name": "Languages",
    "text": "Bestial (Orcish)."
   },
   {
    "name": "Lifespan",
    "text": "About 50 years in their harsh climate; up to about 80 in ideal conditions."
   },
   {
    "name": "Backgrounds",
    "text": "Nomad, Pilgrim, Inquisition Familiar, Tiro, Recruit, Apprentice Mage, Novice, Hunter, Laborer, Outsider."
   },
   {
    "name": "Homelands",
    "text": "Guiding Flame Faithful, Lake Temple-Cities, Dirt Clans, or a Shared Homeland."
   }
  ],
  "trees": [
   "ancestry-wusonian",
   "ancestry-bestial",
   "ancestry-dirtborn",
   "ancestry-firelander"
  ]
 },
 "goblin": {
  "id": "goblin",
  "name": "Goblin",
  "core": "ancestry-wusonian",
  "size": 2,
  "languages": "Common and Bestial (Orcish).",
  "lifespan": "About 60 years.",
  "backgrounds": [
   "mob-runner",
   "green-hood-cub",
   "deckhand",
   "latent-psion",
   "trader-s-apprentice",
   "laborer",
   "urchin",
   "outsider"
  ],
  "profile": [
   {
    "name": "Lineage",
    "text": "Orc line. Descended from a long-forgotten Orcish exploratory expedition."
   },
   {
    "name": "Homeland",
    "text": "Tinksmith (south-east tip of the western continent)."
   },
   {
    "name": "Size",
    "text": "2."
   },
   {
    "name": "Languages",
    "text": "Common and Bestial (Orcish)."
   },
   {
    "name": "Lifespan",
    "text": "About 60 years."
   },
   {
    "name": "Backgrounds",
    "text": "Mob Runner, Green Hood Cub, Deckhand, Latent Psion, Trader’s Apprentice, Laborer, Urchin, Outsider."
   },
   {
    "name": "Homelands",
    "text": "Family Ward, Undercity, Island Holdings, or a Shared Homeland."
   }
  ],
  "trees": [
   "ancestry-wusonian",
   "ancestry-bestial",
   "ancestry-smallfolk",
   "ancestry-goblin-tree"
  ]
 }
};
export const BACKGROUNDS = {
 "outsider": {
  "id": "outsider",
  "name": "Outsider",
  "available": "all",
  "trees": [],
  "options": [],
  "differences": [],
  "tradeSlot": 0,
  "text": {
   "Available to": "Every Ancestry.",
   "Starting Trees": "Spend all 15 points freely across your Ancestry’s trees (your core, lineage, and Ancestry trees), at normal tier costs and requirements.",
   "Circle": "any Shared Circle (Self-Made or Family Trade)."
  },
  "ancestryPoints": 15
 },
 "recruit": {
  "id": "recruit",
  "name": "Recruit",
  "available": [
   "human",
   "dwarf",
   "elf",
   "dusken",
   "drakenblood",
   "orc",
   "fire-walker"
  ],
  "trees": [
   {
    "tree": "Martial Theory",
    "tier": 2
   },
   {
    "tree": "Medium Armor",
    "tier": 2
   },
   {
    "choose": [
     "Brawling Methods",
     "Bladed Weapons",
     "Balanced Weapons",
     "Swift Weapons",
     "Rapid Weapons"
    ],
    "tier": 2
   },
   {
    "tree": "Resolve",
    "tier": 2
   },
   {
    "choose": [
     "Courage",
     "Endurance"
    ],
    "tier": 2
   }
  ],
  "options": [],
  "differences": [
   {
    "ancestry": "dwarf",
    "text": "Heavy Armor T2 replaces Medium Armor T2.",
    "replace": {
     "tree": "Heavy Armor",
     "tier": 2,
     "from": "Medium Armor"
    }
   }
  ],
  "tradeSlot": 0,
  "text": {
   "Available to": "Human, Dwarf, Elf, Dusken, Drakenblood, Orc, and Fire Walker.",
   "Starting Trees": "Martial Theory T2, Medium Armor T2, one of Brawling Methods, Bladed Weapons, Balanced Weapons, Swift Weapons, or Rapid Weapons at T2, Resolve T2, and either Courage T2 or Endurance T2.",
   "Ancestry Differences": "Dwarf: Heavy Armor T2 replaces Medium Armor T2.",
   "Circle": "Barracks-Raised, or a Shared Circle."
  }
 },
 "apprentice-mage": {
  "id": "apprentice-mage",
  "name": "Apprentice Mage",
  "available": [
   "human",
   "dwarf",
   "halfling",
   "elf",
   "dusken",
   "drakenblood",
   "orc",
   "fire-walker"
  ],
  "trees": [
   {
    "tree": "Magic Theory",
    "tier": 2
   }
  ],
  "options": [
   {
    "name": "Warder",
    "trees": [
     {
      "tree": "Protection Arcana",
      "tier": 3
     },
     {
      "choose": [
       "Gravity",
       "Slashing",
       "Piercing",
       "Crushing"
      ],
      "tier": 2
     },
     {
      "tree": "Perception",
      "tier": 2
     }
    ]
   },
   {
    "name": "Elementalist",
    "trees": [
     {
      "choose": [
       "Heat",
       "Cold",
       "Radiation",
       "Acid"
      ],
      "tier": 3
     },
     {
      "tree": "Reach Arcana",
      "tier": 2
     },
     {
      "tree": "Perception",
      "tier": 2
     }
    ]
   },
   {
    "name": "Force-Shaper",
    "trees": [
     {
      "tree": "Gravity",
      "tier": 3
     },
     {
      "choose": [
       "Slashing",
       "Piercing",
       "Crushing"
      ],
      "tier": 2
     },
     {
      "tree": "Perception",
      "tier": 2
     }
    ]
   }
  ],
  "differences": [
   {
    "ancestry": "fire-walker",
    "text": "Elementalist only, and the school must be Heat.",
    "only": "Elementalist",
    "mustBe": "Heat"
   },
   {
    "ancestry": "orc",
    "text": "Warder only.",
    "only": "Warder",
    "mustBe": null
   }
  ],
  "tradeSlot": 0,
  "text": {
   "Available to": "Human, Dwarf, Halfling, Elf, Dusken, Drakenblood, Orc, and Fire Walker.",
   "Starting Trees": "Magic Theory T2, plus one focus:",
   "Warder": "Protection Arcana T3, one of Gravity, Slashing, Piercing, or Crushing at T2, and Perception T2.",
   "Elementalist": "one of Heat, Cold, Radiation, or Acid at T3, Reach Arcana T2, and Perception T2.",
   "Force-Shaper": "Gravity T3, one of Slashing, Piercing, or Crushing at T2, and Perception T2.",
   "Ancestry Differences": "Fire Walker: Elementalist only, and the school must be Heat. Orc: Warder only.",
   "Circle": "Academy, or a Shared Circle."
  }
 },
 "novice": {
  "id": "novice",
  "name": "Novice",
  "available": [
   "human",
   "dwarf",
   "halfling",
   "elf",
   "dusken",
   "drakenblood",
   "orc",
   "fire-walker"
  ],
  "trees": [
   {
    "tree": "Mental Theory",
    "tier": 2
   },
   {
    "choose": [
     "Life",
     "Death",
     "Order",
     "Chaos",
     "Beyond",
     "Below"
    ],
    "tier": 3
   },
   {
    "tree": "Resolve",
    "tier": 2
   },
   {
    "tree": "Persuasion",
    "tier": 2
   }
  ],
  "options": [],
  "differences": [
   {
    "ancestry": "fire-walker",
    "text": "Mental Theory T3, Light T2, Resolve T2, and Persuasion T2.",
    "trees": [
     {
      "tree": "Mental Theory",
      "tier": 3
     },
     {
      "tree": "Light",
      "tier": 2
     },
     {
      "tree": "Resolve",
      "tier": 2
     },
     {
      "tree": "Persuasion",
      "tier": 2
     }
    ]
   }
  ],
  "tradeSlot": 0,
  "text": {
   "Available to": "Human, Dwarf, Halfling, Elf, Dusken, Drakenblood, Orc, and Fire Walker.",
   "Starting Trees": "Mental Theory T2, one of Life, Death, Order, Chaos, Beyond, or Below at T3 (the domain of your faith), Resolve T2, and Persuasion T2.",
   "Ancestry Differences": "Fire Walker: Mental Theory T3, Light T2, Resolve T2, and Persuasion T2.",
   "Circle": "Temple, or a Shared Circle."
  }
 },
 "hunter": {
  "id": "hunter",
  "name": "Hunter",
  "available": [
   "human",
   "dwarf",
   "elf",
   "orc",
   "fire-walker"
  ],
  "trees": [
   {
    "tree": "Martial Theory",
    "tier": 1
   },
   {
    "choose": [
     "Rapid Weapons",
     "Swift Weapons"
    ],
    "tier": 2
   },
   {
    "tree": "Perception",
    "tier": 2
   },
   {
    "tree": "Stealth",
    "tier": 2
   },
   {
    "tree": "Concealment",
    "tier": 2
   },
   {
    "tree": "Endurance",
    "tier": 1
   },
   {
    "tree": "Athletics",
    "tier": 1
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 0,
  "text": {
   "Available to": "Human, Dwarf, Elf, Orc, and Fire Walker.",
   "Starting Trees": "Martial Theory T1, either Rapid Weapons T2 or Swift Weapons T2, Perception T2, Stealth T2, Concealment T2, Endurance T1, and Athletics T1.",
   "Circle": "Lodge, or a Shared Circle."
  }
 },
 "trader-s-apprentice": {
  "id": "trader-s-apprentice",
  "name": "Trader’s Apprentice",
  "available": [
   "human",
   "dwarf",
   "halfling",
   "goblin"
  ],
  "trees": [
   {
    "tree": "Persuasion",
    "tier": 2
   },
   {
    "tree": "Barter",
    "tier": 2
   },
   {
    "tree": "Perception",
    "tier": 2
   },
   {
    "tree": "Resolve",
    "tier": 2,
    "trade": true
   },
   {
    "tree": "Insight",
    "tier": 2,
    "trade": true
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 6,
  "text": {
   "Available to": "Human, Dwarf, Halfling, and Goblin.",
   "Starting Trees": "Persuasion T2, Barter T2, and Perception T2.",
   "Trade Slot": "6 points, held for now by Resolve T2 and Insight T2 as placeholders until trade professions exist.",
   "Circle": "Caravan, or a Shared Circle."
  }
 },
 "laborer": {
  "id": "laborer",
  "name": "Laborer",
  "available": "all",
  "trees": [
   {
    "tree": "Athletics",
    "tier": 2
   },
   {
    "tree": "Hauling",
    "tier": 2
   },
   {
    "tree": "Endurance",
    "tier": 2
   },
   {
    "tree": "Recovery",
    "tier": 2,
    "trade": true
   },
   {
    "tree": "Mobility",
    "tier": 2,
    "trade": true
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 6,
  "text": {
   "Available to": "Every Ancestry.",
   "Starting Trees": "Athletics T2, Hauling T2, and Endurance T2.",
   "Trade Slot": "6 points, held for now by Recovery T2 and Mobility T2 as placeholders until trade professions exist.",
   "Circle": "Workhouse, or a Shared Circle."
  }
 },
 "urchin": {
  "id": "urchin",
  "name": "Urchin",
  "available": [
   "human",
   "halfling",
   "elf",
   "goblin"
  ],
  "trees": [
   {
    "tree": "Stealth",
    "tier": 2
   },
   {
    "tree": "Sleight",
    "tier": 2
   },
   {
    "tree": "Deception",
    "tier": 2
   },
   {
    "tree": "Perception",
    "tier": 2
   },
   {
    "tree": "Athletics",
    "tier": 1
   },
   {
    "tree": "Mobility",
    "tier": 1
   },
   {
    "tree": "Initiative",
    "tier": 1
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 0,
  "text": {
   "Available to": "Human, Halfling, Elf, and Goblin.",
   "Starting Trees": "Stealth T2, Sleight T2, Deception T2, Perception T2, Athletics T1, Mobility T1, and Initiative T1.",
   "Circle": "Street Crew, or a Shared Circle."
  }
 },
 "explorer": {
  "id": "explorer",
  "name": "Explorer",
  "available": [
   "human"
  ],
  "trees": [
   {
    "tree": "Perception",
    "tier": 2
   },
   {
    "tree": "Athletics",
    "tier": 2
   },
   {
    "tree": "Mobility",
    "tier": 2
   },
   {
    "tree": "Endurance",
    "tier": 2
   },
   {
    "tree": "Recovery",
    "tier": 1
   },
   {
    "tree": "Persuasion",
    "tier": 1
   },
   {
    "tree": "Initiative",
    "tier": 1
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 0,
  "text": {
   "Available to": "Human.",
   "Starting Trees": "Perception T2, Athletics T2, Mobility T2, Endurance T2, Recovery T1, Persuasion T1, and Initiative T1.",
   "Circle": "Expedition Society, or a Shared Circle."
  }
 },
 "scholar-s-apprentice": {
  "id": "scholar-s-apprentice",
  "name": "Scholar’s Apprentice",
  "available": [
   "human"
  ],
  "trees": [
   {
    "tree": "Perception",
    "tier": 2
   },
   {
    "tree": "Resolve",
    "tier": 2
   },
   {
    "tree": "Insight",
    "tier": 2
   },
   {
    "tree": "Persuasion",
    "tier": 2
   },
   {
    "tree": "Composure",
    "tier": 2,
    "trade": true
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 3,
  "text": {
   "Available to": "Human.",
   "Starting Trees": "Perception T2, Resolve T2, Insight T2, and Persuasion T2.",
   "Trade Slot": "3 points, held for now by Composure T2 as a placeholder until trade professions exist.",
   "Circle": "The Stacks, or a Shared Circle."
  }
 },
 "engineer-s-apprentice": {
  "id": "engineer-s-apprentice",
  "name": "Engineer’s Apprentice",
  "available": [
   "dwarf"
  ],
  "trees": [
   {
    "tree": "Magic Theory",
    "tier": 2
   },
   {
    "tree": "Protection Arcana",
    "tier": 2
   },
   {
    "tree": "Perception",
    "tier": 2
   },
   {
    "tree": "Resolve",
    "tier": 2,
    "trade": true
   },
   {
    "tree": "Endurance",
    "tier": 2,
    "trade": true
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 6,
  "text": {
   "Available to": "Dwarf.",
   "Starting Trees": "Magic Theory T2, Protection Arcana T2, and Perception T2.",
   "Trade Slot": "6 points (gem-tech crafting), held for now by Resolve T2 and Endurance T2 as placeholders until trade professions exist.",
   "Circle": "Construct Works, or a Shared Circle."
  }
 },
 "mine-hand": {
  "id": "mine-hand",
  "name": "Mine Hand",
  "available": [
   "dwarf"
  ],
  "trees": [
   {
    "tree": "Athletics",
    "tier": 2
   },
   {
    "tree": "Hauling",
    "tier": 2
   },
   {
    "tree": "Endurance",
    "tier": 2
   },
   {
    "tree": "Perception",
    "tier": 2
   },
   {
    "tree": "Recovery",
    "tier": 2,
    "trade": true
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 3,
  "text": {
   "Available to": "Dwarf.",
   "Starting Trees": "Athletics T2, Hauling T2, Endurance T2, and Perception T2.",
   "Trade Slot": "3 points (mining), held for now by Recovery T2 as a placeholder until trade professions exist.",
   "Circle": "Deep Crews, or a Shared Circle."
  }
 },
 "street-performer": {
  "id": "street-performer",
  "name": "Street Performer",
  "available": [
   "halfling"
  ],
  "trees": [
   {
    "tree": "Persuasion",
    "tier": 2
   },
   {
    "tree": "Deception",
    "tier": 2
   },
   {
    "tree": "Diversion",
    "tier": 2
   },
   {
    "tree": "Athletics",
    "tier": 2
   },
   {
    "tree": "Diplomacy",
    "tier": 1
   },
   {
    "tree": "Mobility",
    "tier": 1
   },
   {
    "tree": "Initiative",
    "tier": 1
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 0,
  "text": {
   "Available to": "Halfling.",
   "Starting Trees": "Persuasion T2, Deception T2, Diversion T2, Athletics T2, Diplomacy T1, Mobility T1, and Initiative T1.",
   "Circle": "Traveling Troupe, or a Shared Circle."
  }
 },
 "courier": {
  "id": "courier",
  "name": "Courier",
  "available": [
   "halfling"
  ],
  "trees": [
   {
    "tree": "Athletics",
    "tier": 2
   },
   {
    "tree": "Mobility",
    "tier": 2
   },
   {
    "tree": "Hauling",
    "tier": 2
   },
   {
    "tree": "Endurance",
    "tier": 2
   },
   {
    "tree": "Perception",
    "tier": 2
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 0,
  "text": {
   "Available to": "Halfling.",
   "Starting Trees": "Athletics T2, Mobility T2, Hauling T2, Endurance T2, and Perception T2.",
   "Circle": "The Relay, or a Shared Circle."
  }
 },
 "college-student": {
  "id": "college-student",
  "name": "College Student",
  "available": [
   "elf"
  ],
  "trees": [
   {
    "tree": "Magic Theory",
    "tier": 3
   },
   {
    "tree": "Grasp Arcana",
    "tier": 2
   },
   {
    "school": {
     "min": 1,
     "max": 2
    },
    "tier": 2
   },
   {
    "tree": "Perception",
    "tier": 2
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 0,
  "text": {
   "Available to": "Elf.",
   "Starting Trees": "Magic Theory T3, Grasp Arcana T2, one Magic T1 or T2 school of your choice at T2, and Perception T2.",
   "Circle": "The College, or a Shared Circle."
  }
 },
 "court-page": {
  "id": "court-page",
  "name": "Court Page",
  "available": [
   "elf"
  ],
  "trees": [
   {
    "tree": "Persuasion",
    "tier": 2
   },
   {
    "tree": "Diplomacy",
    "tier": 2
   },
   {
    "tree": "Resolve",
    "tier": 2
   },
   {
    "tree": "Composure",
    "tier": 2
   },
   {
    "tree": "Insight",
    "tier": 1
   },
   {
    "tree": "Deception",
    "tier": 1
   },
   {
    "tree": "Initiative",
    "tier": 1
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 0,
  "text": {
   "Available to": "Elf.",
   "Starting Trees": "Persuasion T2, Diplomacy T2, Resolve T2, Composure T2, Insight T1, Deception T1, and Initiative T1.",
   "Circle": "Household Staff, or a Shared Circle."
  }
 },
 "spirit-hunter-initiate": {
  "id": "spirit-hunter-initiate",
  "name": "Spirit Hunter Initiate",
  "available": [
   "dusken"
  ],
  "trees": [
   {
    "tree": "Perception",
    "tier": 2
   },
   {
    "tree": "Stealth",
    "tier": 2
   }
  ],
  "options": [
   {
    "name": "Spellward Path",
    "trees": [
     {
      "tree": "Magic Theory",
      "tier": 3
     },
     {
      "tree": "Grasp Arcana",
      "tier": 2
     }
    ]
   },
   {
    "name": "Blade Path",
    "trees": [
     {
      "tree": "Martial Theory",
      "tier": 2
     },
     {
      "choose": [
       "Brawling Methods",
       "Bladed Weapons",
       "Balanced Weapons",
       "Swift Weapons",
       "Rapid Weapons"
      ],
      "tier": 3
     }
    ]
   }
  ],
  "differences": [],
  "tradeSlot": 0,
  "text": {
   "Available to": "Dusken.",
   "Starting Trees": "Perception T2 and Stealth T2, plus one path:",
   "Spellward Path": "Magic Theory T3 and Grasp Arcana T2.",
   "Blade Path": "Martial Theory T2 and one of Brawling Methods, Bladed Weapons, Balanced Weapons, Swift Weapons, or Rapid Weapons at T3.",
   "Circle": "Wild Coast Lodge, or a Shared Circle."
  }
 },
 "spirit-tender": {
  "id": "spirit-tender",
  "name": "Spirit Tender",
  "available": [
   "dusken"
  ],
  "trees": [
   {
    "tree": "Magic Theory",
    "tier": 3
   },
   {
    "tree": "Protection Arcana",
    "tier": 2
   },
   {
    "tree": "Grasp Arcana",
    "tier": 2
   },
   {
    "tree": "Resolve",
    "tier": 2
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 0,
  "text": {
   "Available to": "Dusken.",
   "Starting Trees": "Magic Theory T3, Protection Arcana T2, Grasp Arcana T2, and Resolve T2.",
   "Circle": "The Tending Halls, or a Shared Circle."
  }
 },
 "ward-apprentice": {
  "id": "ward-apprentice",
  "name": "Ward Apprentice",
  "available": [
   "drakenblood"
  ],
  "trees": [
   {
    "tree": "Magic Theory",
    "tier": 2
   },
   {
    "tree": "Protection Arcana",
    "tier": 3
   },
   {
    "tree": "Resolve",
    "tier": 2
   },
   {
    "tree": "Composure",
    "tier": 2
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 0,
  "text": {
   "Available to": "Drakenblood.",
   "Starting Trees": "Magic Theory T2, Protection Arcana T3, Resolve T2, and Composure T2.",
   "Circle": "Barrier Wardens, or a Shared Circle."
  }
 },
 "reclaimer-initiate": {
  "id": "reclaimer-initiate",
  "name": "Reclaimer Initiate",
  "available": [
   "drakenblood"
  ],
  "trees": [
   {
    "tree": "Martial Theory",
    "tier": 1
   },
   {
    "choose": [
     "Brawling Methods",
     "Bladed Weapons",
     "Balanced Weapons",
     "Swift Weapons",
     "Rapid Weapons"
    ],
    "tier": 2
   },
   {
    "tree": "Endurance",
    "tier": 2
   },
   {
    "tree": "Fortitude",
    "tier": 1
   },
   {
    "tree": "Recovery",
    "tier": 1
   },
   {
    "tree": "Perception",
    "tier": 2
   },
   {
    "tree": "Athletics",
    "tier": 2
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 0,
  "text": {
   "Available to": "Drakenblood.",
   "Starting Trees": "Martial Theory T1, one of Brawling Methods, Bladed Weapons, Balanced Weapons, Swift Weapons, or Rapid Weapons at T2, Endurance T2, Fortitude T1, Recovery T1, Perception T2, and Athletics T2.",
   "Circle": "Waste Camps, or a Shared Circle."
  }
 },
 "untested-warrior": {
  "id": "untested-warrior",
  "name": "Untested Warrior",
  "available": [
   "orc"
  ],
  "trees": [
   {
    "tree": "Martial Theory",
    "tier": 2
   },
   {
    "choose": [
     "Brawling Methods",
     "Bladed Weapons",
     "Balanced Weapons",
     "Swift Weapons",
     "Rapid Weapons"
    ],
    "tier": 3
   },
   {
    "tree": "Athletics",
    "tier": 2
   },
   {
    "tree": "Resolve",
    "tier": 1
   },
   {
    "tree": "Courage",
    "tier": 1
   },
   {
    "tree": "Initiative",
    "tier": 1
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 0,
  "text": {
   "Available to": "Orc.",
   "Starting Trees": "Martial Theory T2, one of Brawling Methods, Bladed Weapons, Balanced Weapons, Swift Weapons, or Rapid Weapons at T3, Athletics T2, Resolve T1, Courage T1, and Initiative T1.",
   "Circle": "Warband, or a Shared Circle."
  }
 },
 "wildspeaker-s-apprentice": {
  "id": "wildspeaker-s-apprentice",
  "name": "Wildspeaker’s Apprentice",
  "available": [
   "orc"
  ],
  "trees": [
   {
    "tree": "Mental Theory",
    "tier": 2
   },
   {
    "tree": "Life",
    "tier": 3
   },
   {
    "tree": "Perception",
    "tier": 2
   },
   {
    "tree": "Stealth",
    "tier": 1
   },
   {
    "tree": "Endurance",
    "tier": 1
   },
   {
    "tree": "Recovery",
    "tier": 1
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 0,
  "text": {
   "Available to": "Orc.",
   "Starting Trees": "Mental Theory T2, Life T3, Perception T2, Stealth T1, Endurance T1, and Recovery T1.",
   "Circle": "Grove Circle, or a Shared Circle."
  }
 },
 "nomad": {
  "id": "nomad",
  "name": "Nomad",
  "available": [
   "fire-walker"
  ],
  "trees": [
   {
    "tree": "Endurance",
    "tier": 2
   },
   {
    "tree": "Recovery",
    "tier": 2
   },
   {
    "tree": "Athletics",
    "tier": 2
   },
   {
    "tree": "Mobility",
    "tier": 2
   },
   {
    "tree": "Perception",
    "tier": 2
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 0,
  "text": {
   "Available to": "Fire Walker.",
   "Starting Trees": "Endurance T2, Recovery T2, Athletics T2, Mobility T2, and Perception T2.",
   "Circle": "Caravan Clan, or a Shared Circle."
  }
 },
 "pilgrim": {
  "id": "pilgrim",
  "name": "Pilgrim",
  "available": [
   "fire-walker"
  ],
  "trees": [
   {
    "tree": "Martial Theory",
    "tier": 2
   },
   {
    "choose": [
     "Brawling Methods",
     "Bladed Weapons",
     "Balanced Weapons",
     "Swift Weapons",
     "Rapid Weapons"
    ],
    "tier": 2
   },
   {
    "tree": "Perception",
    "tier": 2
   },
   {
    "tree": "Resolve",
    "tier": 2
   },
   {
    "tree": "Courage",
    "tier": 2
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 0,
  "text": {
   "Available to": "Fire Walker.",
   "Starting Trees": "Martial Theory T2, one of Brawling Methods, Bladed Weapons, Balanced Weapons, Swift Weapons, or Rapid Weapons at T2, Perception T2, Resolve T2, and Courage T2.",
   "Circle": "Pilgrim Band, or a Shared Circle."
  }
 },
 "inquisition-familiar": {
  "id": "inquisition-familiar",
  "name": "Inquisition Familiar",
  "available": [
   "fire-walker"
  ],
  "trees": [
   {
    "tree": "Mental Theory",
    "tier": 2
   },
   {
    "tree": "Order",
    "tier": 2
   },
   {
    "tree": "Resolve",
    "tier": 2
   },
   {
    "tree": "Insight",
    "tier": 2
   },
   {
    "tree": "Perception",
    "tier": 2
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 0,
  "text": {
   "Available to": "Fire Walker.",
   "Starting Trees": "Mental Theory T2, Order T2, Resolve T2, Insight T2, and Perception T2.",
   "Circle": "The Inquisition, or a Shared Circle."
  }
 },
 "tiro": {
  "id": "tiro",
  "name": "Tiro",
  "available": [
   "fire-walker"
  ],
  "trees": [
   {
    "tree": "Martial Theory",
    "tier": 2
   },
   {
    "choose": [
     "Brawling Methods",
     "Bladed Weapons",
     "Balanced Weapons",
     "Swift Weapons"
    ],
    "tier": 3
   },
   {
    "tree": "Medium Armor",
    "tier": 1
   },
   {
    "tree": "Athletics",
    "tier": 1
   },
   {
    "tree": "Initiative",
    "tier": 2
   },
   {
    "tree": "Tempo",
    "tier": 1
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 0,
  "text": {
   "Available to": "Fire Walker.",
   "Starting Trees": "Martial Theory T2, one of Brawling Methods, Bladed Weapons, Balanced Weapons, or Swift Weapons at T3, Medium Armor T1, Athletics T1, Initiative T2, and Tempo T1.",
   "Circle": "Arena Ludus, or a Shared Circle."
  }
 },
 "mob-runner": {
  "id": "mob-runner",
  "name": "Mob Runner",
  "available": [
   "goblin"
  ],
  "trees": [
   {
    "tree": "Deception",
    "tier": 2
   },
   {
    "tree": "Persuasion",
    "tier": 2
   },
   {
    "tree": "Perception",
    "tier": 2
   },
   {
    "tree": "Barter",
    "tier": 1
   },
   {
    "tree": "Stealth",
    "tier": 1
   },
   {
    "tree": "Sleight",
    "tier": 1
   },
   {
    "tree": "Athletics",
    "tier": 1
   },
   {
    "tree": "Mobility",
    "tier": 1
   },
   {
    "tree": "Initiative",
    "tier": 1
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 0,
  "text": {
   "Available to": "Goblin.",
   "Starting Trees": "Deception T2, Persuasion T2, Perception T2, Barter T1, Stealth T1, Sleight T1, Athletics T1, Mobility T1, and Initiative T1.",
   "Circle": "one of the five families: The Mobmen, The Gearspinners, The Spark, The Ledger, or The Iron Collar; or a Shared Circle."
  }
 },
 "green-hood-cub": {
  "id": "green-hood-cub",
  "name": "Green Hood Cub",
  "available": [
   "goblin"
  ],
  "trees": [
   {
    "tree": "Perception",
    "tier": 2
   },
   {
    "tree": "Stealth",
    "tier": 2
   },
   {
    "tree": "Persuasion",
    "tier": 2
   },
   {
    "tree": "Diplomacy",
    "tier": 1
   },
   {
    "tree": "Athletics",
    "tier": 1
   },
   {
    "tree": "Mobility",
    "tier": 1
   },
   {
    "tree": "Resolve",
    "tier": 1
   },
   {
    "tree": "Courage",
    "tier": 1
   },
   {
    "tree": "Initiative",
    "tier": 1
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 0,
  "text": {
   "Available to": "Goblin.",
   "Starting Trees": "Perception T2, Stealth T2, Persuasion T2, Diplomacy T1, Athletics T1, Mobility T1, Resolve T1, Courage T1, and Initiative T1.",
   "Circle": "The Green Hoods, or a Shared Circle."
  }
 },
 "deckhand": {
  "id": "deckhand",
  "name": "Deckhand",
  "available": [
   "goblin"
  ],
  "trees": [
   {
    "tree": "Athletics",
    "tier": 2
   },
   {
    "tree": "Mobility",
    "tier": 2
   },
   {
    "tree": "Hauling",
    "tier": 2
   },
   {
    "tree": "Endurance",
    "tier": 2
   },
   {
    "tree": "Martial Theory",
    "tier": 1
   },
   {
    "tree": "Swift Weapons",
    "tier": 1
   },
   {
    "tree": "Initiative",
    "tier": 1
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 0,
  "text": {
   "Available to": "Goblin.",
   "Starting Trees": "Athletics T2, Mobility T2, Hauling T2, Endurance T2, Martial Theory T1, Swift Weapons T1, and Initiative T1.",
   "Circle": "Ship’s Crew, or a Shared Circle."
  }
 },
 "latent-psion": {
  "id": "latent-psion",
  "name": "Latent Psion",
  "available": [
   "goblin"
  ],
  "trees": [
   {
    "tree": "Mental Theory",
    "tier": 2
   },
   {
    "tree": "Psion Arts",
    "tier": 3
   },
   {
    "tree": "Resolve",
    "tier": 2
   },
   {
    "tree": "Deception",
    "tier": 2
   }
  ],
  "options": [],
  "differences": [],
  "tradeSlot": 0,
  "text": {
   "Available to": "Goblin.",
   "Starting Trees": "Mental Theory T2, Psion Arts T3, Resolve T2, and Deception T2.",
   "Circle": "Sewer Cult Fringe, or a Shared Circle."
  }
 }
};
export const HOMELANDS = [
 {
  "id": "shared.wanderer",
  "name": "Wanderer",
  "text": "You grew up on the move, with no single place to call home. You value self-reliance and a light pack, pick up customs wherever you go, and are welcome nearly everywhere but trusted almost nowhere. Ties: a scatter of old acquaintances along the roads.",
  "ancestry": null
 },
 {
  "id": "shared.displaced",
  "name": "Displaced",
  "text": "War, disaster, or persecution drove your family from its home. You value the people who took you in, keep the old customs alive in small ways, and carry a quiet grudge against whatever drove you out. Ties: other refugees from your homeland, and those who sheltered them.",
  "ancestry": null
 },
 {
  "id": "shared.crossroads-born",
  "name": "Crossroads-Born",
  "text": "You were raised in a trade hub where many peoples meet, such as a great port or market city. You value deals, news, and novelty, speak a little of everyone’s slang, and see borders as a matter of price. Ties: dockhands, innkeepers, and traders of many peoples.",
  "ancestry": null
 },
 {
  "id": "shared.mixed-heritage",
  "name": "Mixed Heritage",
  "text": "You were raised between two peoples, by parents or guardians of different Ancestries or Cultures. You value belonging and bridge-building, keep customs from both sides, and are never fully claimed by either. Ties: family on both sides, who may not agree about you.",
  "ancestry": null
 },
 {
  "id": "human.guild-town",
  "name": "Guild-Town",
  "text": "You grew up in a Human city where the Merchants Guild is the real power. You value contracts, reputation, and steady coin, mark life’s milestones with dues and ledgers, and see the crown as distant and the Guild as near. Ties: Guild clerks, factors, and debtors.",
  "ancestry": "human"
 },
 {
  "id": "human.crownland",
  "name": "Crownland",
  "text": "You were raised in the royal heartlands, loyal to the throne. You value duty, order, and the king’s peace, keep royal holidays and oaths, and look on the Guild’s reach with suspicion. Ties: local lords, guard captains, and royal officials.",
  "ancestry": "human"
 },
 {
  "id": "human.old-pantheon",
  "name": "Old Pantheon",
  "text": "Your family keeps to the old Human gods that most of your people have drifted away from. You value tradition and the cycle of the seasons, keep household shrines and seasonal rites, and are seen as quaint by city folk. Ties: the last village priests and keepers of old shrines.",
  "ancestry": "human"
 },
 {
  "id": "dwarf.iron-republic",
  "name": "Iron Republic",
  "text": "You were raised among the Dwarves who see the Republic’s strength in its army and its arsenal. You value discipline, rank, and victory, mark coming of age with service, and hold the old grudge against the Orcs as a point of pride. Ties: officers, veterans, and arms-works foremen.",
  "ancestry": "dwarf"
 },
 {
  "id": "dwarf.moon-faithful",
  "name": "Moon Faithful",
  "text": "Your people worship the moon as the source of magic and believe every gem construct has a mind of its own. You value reverence, restraint, and the dignity of constructs, keep night vigils under the moon, and are distrusted by factory owners. Ties: moon temples, mages, and workers who walked off the line.",
  "ancestry": "dwarf"
 },
 {
  "id": "dwarf.common-folk",
  "name": "Common Folk",
  "text": "You grew up among the ordinary miners and workers of the Republic, just trying to live. You value hard work, fair pay, and a good council vote, mark the end of a shift with drink and song, and have little patience for factions. Ties: crews, neighbors, and council delegates.",
  "ancestry": "dwarf"
 },
 {
  "id": "halfling.hills-revelers",
  "name": "Hills Revelers",
  "text": "You were raised in the festival towns of Littlefoot Hills, the entertainment heart of the world. You value joy, hospitality, and a good show, keep the revelry gods’ feast days loosely but loudly, and are welcome at any party. Ties: performers, innkeepers, and festival organizers.",
  "ancestry": "halfling"
 },
 {
  "id": "halfling.cargo-families",
  "name": "Cargo Families",
  "text": "Your family has moved other peoples’ goods for generations, the middlemen of Human trade. You value reliability, discretion, and a fair cut, keep careful ledgers and route lore, and are trusted by Humans and resented by Goblins. Ties: haulers, warehouse keepers, and trade partners on both ends.",
  "ancestry": "halfling"
 },
 {
  "id": "halfling.council-town",
  "name": "Council-Town",
  "text": "You grew up in a Halfling town ruled by its own small councils, where real power is local. You value home, neighbors, and having your say, settle disputes over long dinners, and distrust anyone who claims to speak for all Halflings. Ties: councilors, elders, and every family on your street.",
  "ancestry": "halfling"
 },
 {
  "id": "elf.elven-courts",
  "name": "Elven Courts",
  "text": "You were raised in the manor life of the Elven nobility, where appearance is everything. You value beauty, poise, and standing, dress and speak to be seen, and treat every gathering as a quiet contest. Ties: noble households, tailors, and court gossips.",
  "ancestry": "elf"
 },
 {
  "id": "elf.paan-faithful",
  "name": "Paan Faithful",
  "text": "Your family keeps faith with Paan, who sealed the southern Rift. You value devotion, humility, and gratitude, keep his shrines and sealing-day rites, and are seen as old-fashioned by the fashionable. Ties: temple keepers and the remaining faithful.",
  "ancestry": "elf"
 },
 {
  "id": "elf.open-city-elves",
  "name": "Open-City Elves",
  "text": "You grew up in the open cities of the Paanlands, among markets, magic batteries, and street spellcraft. You value craft, cleverness, and convenience, treat everyday magic like plumbing, and look down a little on those who live without it. Ties: shopkeepers, enchanters, and city guilds.",
  "ancestry": "elf"
 },
 {
  "id": "dusken.paan-faithful",
  "name": "Paan Faithful",
  "text": "Your people follow Paan, whose sealing of the southern Rift left the curse you now count as a gift. You value devotion, control of the spirit, and patience, teach the young to master their tether, and see the shadow as a blessing to be earned. Ties: temple elders and spirit teachers.",
  "ancestry": "dusken"
 },
 {
  "id": "dusken.tribal-village",
  "name": "Tribal Village",
  "text": "You were raised in a young Dusken village, newly built with old tools. You value community, building, and the tribe’s council, raise homes and halls together, and are proud of how far your people have come. Ties: village elders, builders, and neighboring tribes.",
  "ancestry": "dusken"
 },
 {
  "id": "dusken.shadow-supremacist",
  "name": "Shadow Supremacist",
  "text": "You were raised to believe the Dusken curse makes your people superior, and that it should be spread to others. You value strength of spirit, unity, and the shadow’s destiny, keep secret gatherings and oaths, and are feared or scorned by most other peoples. Ties: cells of believers, and enemies among the faithful.",
  "ancestry": "dusken"
 },
 {
  "id": "drakenblood.reclaimers",
  "name": "Reclaimers",
  "text": "Your family is sworn to retake and restore the Dragon Wastes. You value duty to the lost homeland, endurance, and memory, recite the names of what was lost, and see every other goal as secondary. Ties: Reclaimer camps, veterans of the Wastes, and scholars of the old land.",
  "ancestry": "drakenblood"
 },
 {
  "id": "drakenblood.wired-cities",
  "name": "Wired Cities",
  "text": "You grew up in Drakenblood cities run on magical wiring, batteries, and waystones. You value precision and understanding how things work, treat magitech as everyday life, and find other peoples’ magic crude. Ties: technicians, scholars, and waystone keepers.",
  "ancestry": "drakenblood"
 },
 {
  "id": "drakenblood.crown-sworn",
  "name": "Crown-Sworn",
  "text": "Your family is sworn to the Drakenblood king and the sorcerer crown. You value loyalty, will, and the bloodline’s strength against temptation, keep courtly oaths, and see the crown as the people’s shield. Ties: royal households, knights, and court mages.",
  "ancestry": "drakenblood"
 },
 {
  "id": "orc.great-tribe",
  "name": "Great Tribe",
  "text": "You were born into one of the few large tribes that lead the Wildlands. You value strength, territory, and the nature gods, keep great hunts and seasonal rites, and see the smaller tribes as yours to lead. Ties: chieftains, wildspeakers, and allied Fire Walker clans.",
  "ancestry": "orc"
 },
 {
  "id": "orc.small-tribe",
  "name": "Small Tribe",
  "text": "You come from one of the many small tribes the great tribes rule by force or bargain. You value survival, kinship, and independence, keep your own small gods and customs, and resent the great tribes as much as you need them. Ties: your tribe, and rivals in the tribe that rules yours.",
  "ancestry": "orc"
 },
 {
  "id": "orc.borderland",
  "name": "Borderland",
  "text": "You were raised on the Wildlands’ frontier with the Dwarves, sworn to the old feud over the coast. You value vigilance, vengeance, and the land itself, keep watch-fires and raid songs, and distrust anyone carrying Dwarven goods. Ties: border warbands and the families of the fallen.",
  "ancestry": "orc"
 },
 {
  "id": "fire-walker.guiding-flame-faithful",
  "name": "Guiding Flame Faithful",
  "text": "Your family keeps the old faith in the Guiding Flame, the lone savior who closed the Fire Walker Rift. You value self-reliance, sacrifice, and helping others, tend small flames as prayers, and see the lake temples as having strayed. Ties: old-faith shrines and wandering faithful.",
  "ancestry": "fire-walker"
 },
 {
  "id": "fire-walker.lake-temple-cities",
  "name": "Lake Temple-Cities",
  "text": "You were raised in the cities around the Firelands lake, where religion rules and the lake’s changed creatures are revered. You value faith, purity, and order, purify water with flame and prayer, and are wary of outsiders. Ties: priests, temple guards, and the Inquisition’s eyes.",
  "ancestry": "fire-walker"
 },
 {
  "id": "fire-walker.dirt-clans",
  "name": "Dirt Clans",
  "text": "You come from the nomadic clans of the Dirt, its savannas and deserts. You value honor, strength, and tradition, settle disputes by challenge, and measure others by how they endure hardship. Ties: clan elders, rival clans, and the arenas.",
  "ancestry": "fire-walker"
 },
 {
  "id": "goblin.family-ward",
  "name": "Family Ward",
  "text": "You grew up in a part of Tinksmith ruled by one of the five families. You value opportunity, loyalty, and knowing who to pay, treat debts as sacred, and assume everything has a price. Ties: the family that ran your street, and everyone who owes it.",
  "ancestry": "goblin"
 },
 {
  "id": "goblin.undercity",
  "name": "Undercity",
  "text": "You were raised in Tinksmith’s depths, among abandoned shafts, sewer cults, and towns no one maps. You value secrecy, survival, and getting out, know paths no one else knows, and trust nothing that comes down from above. Ties: tunnel folk, smugglers, and cults best left unnamed.",
  "ancestry": "goblin"
 },
 {
  "id": "goblin.island-holdings",
  "name": "Island Holdings",
  "text": "You grew up on one of the Goblins’ island holdings, a research or trading post far from Tinksmith. You value invention, profit, and the sea, live by shipping schedules and company rules, and are a little more open to magic than most Goblins. Ties: company officers, researchers, and ship captains.",
  "ancestry": "goblin"
 }
];
export const CIRCLES = [
 {
  "id": "shared.self-made",
  "name": "Self-Made",
  "text": "You came up on your own, without a mentor or an institution. You value grit and independence, owe nobody, and are owed nothing in return. Ties: few, and all of them earned.",
  "background": null
 },
 {
  "id": "shared.family-trade",
  "name": "Family Trade",
  "text": "You were raised into your family’s work alongside parents and siblings. You value the family name and its craft, and inherit its friends, rivals, and debts. Ties: your family and its customers.",
  "background": null
 },
 {
  "id": "recruit.barracks-raised",
  "name": "Barracks-Raised",
  "text": "You came up through a garrison, drilled alongside other recruits. You value discipline, comradeship, and the chain of command, and still keep barracks habits. Ties: your old unit and its sergeant.",
  "background": "recruit"
 },
 {
  "id": "apprentice-mage.academy",
  "name": "Academy",
  "text": "You trained at a school of magic or under a tutor’s roof. You value knowledge, practice, and friendly rivalry, and measure people by what they can cast. Ties: tutors, classmates, and rivals.",
  "background": "apprentice-mage"
 },
 {
  "id": "novice.temple",
  "name": "Temple",
  "text": "You were raised within a house of faith, learning its rites from the ground up. You value devotion, service, and humility, and keep the daily observances of your faith. Ties: the clergy and congregation who raised you.",
  "background": "novice"
 },
 {
  "id": "hunter.lodge",
  "name": "Lodge",
  "text": "You learned among hunters who share game, trails, and stories. You value patience, respect for prey, and pulling your weight, and judge others by how they handle the wild. Ties: lodge members, trappers, and trackers.",
  "background": "hunter"
 },
 {
  "id": "trader-s-apprentice.caravan",
  "name": "Caravan",
  "text": "You came up on the trade roads with a merchant caravan. You value a fair deal, a full wagon, and safe roads, and know every inn between the markets. Ties: caravan masters, guards, and regular buyers.",
  "background": "trader-s-apprentice"
 },
 {
  "id": "laborer.workhouse",
  "name": "Workhouse",
  "text": "You worked long shifts among other laborers in a yard, a factory, or a field. You value solidarity, fair pay, and a day’s rest, and stand by your crew. Ties: crewmates and foremen.",
  "background": "laborer"
 },
 {
  "id": "urchin.street-crew",
  "name": "Street Crew",
  "text": "You survived the streets with a crew of other children. You value loyalty to the crew, quick wits, and a full belly, and know every alley and hiding place. Ties: your crew, fences, and the watch who chased you.",
  "background": "urchin"
 },
 {
  "id": "explorer.expedition-society",
  "name": "Expedition Society",
  "text": "You joined a society of explorers who chart unknown lands. You value discovery, preparation, and bragging rights, and keep journals of everything. Ties: expedition leaders, mapmakers, and patrons.",
  "background": "explorer"
 },
 {
  "id": "scholar-s-apprentice.the-stacks",
  "name": "The Stacks",
  "text": "You learned among archives and libraries, copying and cataloguing. You value accuracy, curiosity, and a good argument, and always know where to look something up. Ties: archivists, scholars, and their patrons.",
  "background": "scholar-s-apprentice"
 },
 {
  "id": "engineer-s-apprentice.construct-works",
  "name": "Construct Works",
  "text": "You came up in the workshops where gem constructs are built and repaired. You value precision, invention, and working machines, and talk to constructs as if they listen. Ties: engineers, foremen, and the constructs you helped build.",
  "background": "engineer-s-apprentice"
 },
 {
  "id": "mine-hand.deep-crews",
  "name": "Deep Crews",
  "text": "You worked the mines with a crew that trusts each other with their lives. You value safety, steadiness, and the crew above all, and keep the miners’ superstitions. Ties: your crew and its shaft boss.",
  "background": "mine-hand"
 },
 {
  "id": "street-performer.traveling-troupe",
  "name": "Traveling Troupe",
  "text": "You toured with a troupe of performers from town to town. You value the audience, the show, and the troupe, and can make a stage out of anything. Ties: troupe members and patrons in many towns.",
  "background": "street-performer"
 },
 {
  "id": "courier.the-relay",
  "name": "The Relay",
  "text": "You ran messages and parcels along a courier network. You value speed, discretion, and a delivery made, and know the fastest way between any two places. Ties: relay posts and regular clients.",
  "background": "courier"
 },
 {
  "id": "college-student.the-college",
  "name": "The College",
  "text": "You study at the Elven College of Magic or a school like it. You value scholarship, prestige, and the right connections, and keep the College’s customs and rivalries. Ties: professors, fellow students, and rival students.",
  "background": "college-student"
 },
 {
  "id": "court-page.household-staff",
  "name": "Household Staff",
  "text": "You serve in a noble household as a page. You value discretion, manners, and your house’s good name, and know what happens behind every door. Ties: the household’s servants and the family you serve.",
  "background": "court-page"
 },
 {
  "id": "spirit-hunter-initiate.wild-coast-lodge",
  "name": "Wild Coast Lodge",
  "text": "You train with the Dusken lodges that hunt and quell the shadow creatures of the Wild Coast. You value vigilance, control, and the safety of the villages, and keep the hunters’ trophies and tallies. Ties: senior hunters and the villages they guard.",
  "background": "spirit-hunter-initiate"
 },
 {
  "id": "spirit-tender.the-tending-halls",
  "name": "The Tending Halls",
  "text": "You learned among those who care for Dusken suffering from their loose tether. You value patience, compassion, and mastery of the spirit, and keep a tender’s calm in any crisis. Ties: tenders, healers, and those you have helped.",
  "background": "spirit-tender"
 },
 {
  "id": "ward-apprentice.barrier-wardens",
  "name": "Barrier Wardens",
  "text": "You train with the wardens who maintain the barrier sealing Old Draken Hold. You value vigilance, duty, and keeping the seal, and know the barrier’s every weakness. Ties: wardens and scholars of the barrier.",
  "background": "ward-apprentice"
 },
 {
  "id": "reclaimer-initiate.waste-camps",
  "name": "Waste Camps",
  "text": "You came up in the camps on the edge of the Dragon Wastes. You value endurance, readiness, and the dream of reclamation, and know the dangers of the curse firsthand. Ties: camp leaders, scouts, and supply runners.",
  "background": "reclaimer-initiate"
 },
 {
  "id": "untested-warrior.warband",
  "name": "Warband",
  "text": "You run with a band of young warriors who have yet to prove themselves. You value courage, brotherhood, and glory, and boast of the deeds you mean to do. Ties: your band and its war leader.",
  "background": "untested-warrior"
 },
 {
  "id": "wildspeaker-s-apprentice.grove-circle",
  "name": "Grove Circle",
  "text": "You learn from a circle of wildspeakers who keep the nature gods’ ways. You value balance, respect for the land, and listening, and keep the grove’s rites. Ties: elder wildspeakers and the tribes they serve.",
  "background": "wildspeaker-s-apprentice"
 },
 {
  "id": "nomad.caravan-clan",
  "name": "Caravan Clan",
  "text": "You travel the Dirt with a nomadic clan and its herds. You value family, endurance, and the old routes, and share water before words. Ties: your clan and its trade partners.",
  "background": "nomad"
 },
 {
  "id": "pilgrim.pilgrim-band",
  "name": "Pilgrim Band",
  "text": "You set out with a band of pilgrims across the Firelands toward the lake. You value faith, courage, and proving yourself, and keep the pilgrims’ vows. Ties: fellow pilgrims and the guides who lead them.",
  "background": "pilgrim"
 },
 {
  "id": "inquisition-familiar.the-inquisition",
  "name": "The Inquisition",
  "text": "You serve as a familiar of the Inquisition, the secret police of the Fire Walker faith. You value truth, loyalty, and secrecy, and watch everyone, as you are watched in turn. Ties: your handler and your informants; most people fear you.",
  "background": "inquisition-familiar"
 },
 {
  "id": "tiro.arena-ludus",
  "name": "Arena Ludus",
  "text": "You train at an arena school, preparing for your first bout. You value strength, showmanship, and the crowd’s favor, and live by the school’s strict code. Ties: your trainer and your fellow tirones.",
  "background": "tiro"
 },
 {
  "id": "mob-runner.the-mobmen",
  "name": "The Mobmen",
  "text": "You run for the largest of Tinksmith’s five families, which holds politics and control. You value power, order, and the family’s name, and never forget a favor or a slight. Ties: family bosses and the people they rule.",
  "background": "mob-runner"
 },
 {
  "id": "mob-runner.the-gearspinners",
  "name": "The Gearspinners",
  "text": "You run for the family of engineers, the second largest of the five. You value invention, contracts, and the factories, and work closely with the Spark. Ties: foremen, engineers, and Spark researchers.",
  "background": "mob-runner"
 },
 {
  "id": "mob-runner.the-spark",
  "name": "The Spark",
  "text": "You run for the family of researchers, so close to the Gearspinners that some say there are only four families. You value discovery, secrecy, and results, and see the city as one great experiment. Ties: researchers and their hidden labs.",
  "background": "mob-runner"
 },
 {
  "id": "mob-runner.the-ledger",
  "name": "The Ledger",
  "text": "You run for the family that controls Tinksmith’s money and trade. You value profit, contracts, and leverage, and keep count of every debt. Ties: bankers, brokers, and debtors.",
  "background": "mob-runner"
 },
 {
  "id": "mob-runner.the-iron-collar",
  "name": "The Iron Collar",
  "text": "You run for the family that handles enforcement and security. You value strength, loyalty, and fear, and settle problems before they spread. Ties: enforcers and the people who pay for protection.",
  "background": "mob-runner"
 },
 {
  "id": "green-hood-cub.the-green-hoods",
  "name": "The Green Hoods",
  "text": "You are a cub of the Green Hoods, the people’s movement working to free Tinksmith from the five families. You value freedom, solidarity, and the common folk, and keep the movement’s secrets. Ties: Green Hood cells and the neighborhoods that shelter them.",
  "background": "green-hood-cub"
 },
 {
  "id": "deckhand.ship-s-crew",
  "name": "Ship’s Crew",
  "text": "You came up aboard a Goblin ship, learning every rope and every port. You value the crew, the ship, and a good haul, and keep a sailor’s superstitions. Ties: your captain, crewmates, and dockmasters.",
  "background": "deckhand"
 },
 {
  "id": "latent-psion.sewer-cult-fringe",
  "name": "Sewer Cult Fringe",
  "text": "You drifted near one of the cults beneath Tinksmith, and that is where your mind first woke. You value secrets, survival, and what you might become, and keep strange habits you cannot quite explain. Ties: cultists who remember you, and others who heard the same whispers.",
  "background": "latent-psion"
 }
];
