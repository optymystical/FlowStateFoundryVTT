// Combat sim roster (dev only, pure data): the party archetypes, the monster groups, the gear rotations and the encounters.
// Pass 1 is baseline Martial: no skill trees, Common and Uncommon materials, each item's Grade just high enough for its user's stat.
//
// Stats are the points spent (the system adds the Stat Bonus, +1 per 5 Skill Points, to every stat). Party members are 90 stat points and
// 30 Skill Points (the 3-1 ratio). Monsters use 1/5 (5 stat points per Skill Point) or 1/10.

export const PASS = "martial-baseline";

/** Weapon slot: [type, weight, material, { twoHanded, primary }]. Armor: [weight, material]. */
const W = (type, weight, material, o = {}) => ({ type, weight, material, ...o });
const A = (weight, material) => ({ weight, material });

/**
 * The party: five characters, 90 stat points and 30 Skill Points each. Each has a role (the AI plays to it) and three loadouts (rotations),
 * so that between them the party carries every weapon type at both weights over a set of fights.
 */
export const PARTY = [
  {
    id: "bulwark", name: "Sim Bulwark", role: "tank",
    note: "Tank: the most HP and the heaviest armor; walks up to the nearest foe and holds the line.",
    stats: { con: 45, str: 30, will: 15 },
    loadouts: [
      { armor: A("heavy", "steel"), weapons: [W("defender", "heavy", "steel", { primary: true }), W("defender", "light", "steel")] },
      { armor: A("heavy", "steel"), weapons: [W("balanced", "heavy", "steel", { primary: true }), W("defender", "light", "steel")] },
      { armor: A("titanic", "iron"), weapons: [W("reach", "heavy", "steel", { primary: true, twoHanded: true })] }
    ]
  },
  {
    id: "duelist", name: "Sim Duelist", role: "melee-dex",
    note: "Dexterity melee: two Light weapons, chasing Fast follow-ups.",
    stats: { dex: 45, con: 30, will: 15 },
    loadouts: [
      { armor: A("medium", "hardLeather"), weapons: [W("bladed", "light", "steel", { primary: true }), W("swift", "light", "steel")] },
      { armor: A("medium", "chitin"), weapons: [W("circular", "light", "steel", { primary: true }), W("curved", "light", "steel")] },
      { armor: A("light", "hardLeather"), weapons: [W("reach", "light", "steel", { primary: true }), W("balanced", "light", "steel")] }
    ]
  },
  {
    id: "breaker", name: "Sim Breaker", role: "melee-str",
    note: "Strength melee: one big Heavy weapon, usually two-handed.",
    stats: { str: 45, con: 30, build: 15 },
    loadouts: [
      { armor: A("medium", "hide"), weapons: [W("weighted", "heavy", "iron", { primary: true, twoHanded: true })] },
      { armor: A("heavy", "titanium"), weapons: [W("striker", "heavy", "steel", { primary: true }), W("bladed", "heavy", "steel")] },
      { armor: A("medium", "softLeather"), weapons: [W("curved", "heavy", "steel", { primary: true, twoHanded: true })] }
    ]
  },
  {
    id: "marksman", name: "Sim Marksman", role: "ranged",
    note: "Ranged: stays back and shoots, reloading with RP.",
    stats: { dex: 45, con: 25, str: 10, will: 10 },
    loadouts: [
      { armor: A("light", "softLeather"), weapons: [W("longshot", "light", "steel", { primary: true }), W("rapid", "light", "steel")] },
      { armor: A("light", "chitin"), weapons: [W("assault", "light", "steel", { primary: true }), W("swift", "light", "steel")] },
      { armor: A("light", "cloth"), weapons: [W("rapid", "light", "steel", { primary: true }), W("striker", "light", "steel")] }
    ]
  },
  {
    id: "warden", name: "Sim Warden", role: "support",
    note: "Support (no trees yet, so a controller): grapples the foe nearest the backline and fights from reach; Blast for groups.",
    stats: { str: 35, con: 35, dex: 20 },
    loadouts: [
      { armor: A("medium", "hardLeather"), weapons: [W("thrasher", "heavy", "copper", { primary: true })], grapple: true },
      { armor: A("medium", "softLeather"), weapons: [W("blast", "light", "steel", { primary: true }), W("weighted", "light", "steel")] },
      { armor: A("heavy", "iron"), weapons: [W("blast", "heavy", "steel", { primary: true }), W("thrasher", "light", "steel")], grapple: true }
    ]
  }
];

/**
 * Monster groups. `count` copies of each kind. Monsters' gear is natural (no Grade: it scales with the stat uncapped) unless `natural: false`.
 * The Raiders carry the weapon type/weights the party's rotations leave out (Swift, Circular, Rapid, Longshot and Assault Heavy).
 */
export const MONSTERS = {
  swarm: {
    label: "Swarm", note: "Many weak foes: eight goblins (15 Skill Points, 1/5 ratio: 75 stat points). Hackers chew armor with Cleave+, Stabbers Pierce it.",
    kinds: [
      { id: "goblin-hacker", name: "Sim Goblin Hacker", count: 4, size: 3, sp: 15, stats: { str: 40, con: 25, dex: 10 },
        armor: A("light", "softLeather"), weapons: [W("striker", "heavy", "iron", { primary: true })] },
      { id: "goblin-stabber", name: "Sim Goblin Stabber", count: 4, size: 3, sp: 15, stats: { dex: 40, con: 25, str: 10 },
        armor: A("light", "softLeather"), weapons: [W("reach", "light", "hardwood", { primary: true })] }
    ]
  },
  raiders: {
    label: "Raiders", note: "A matched crew of five (25 Skill Points, 1/5 ratio) with real gear the party doesn't carry.",
    kinds: [
      { id: "raider-brute", name: "Sim Raider Brute", count: 1, size: 3, sp: 25, natural: false, stats: { str: 60, con: 50, will: 15 },
        armor: A("heavy", "iron"), weapons: [W("swift", "heavy", "steel", { primary: true, twoHanded: true })] },
      { id: "raider-cutter", name: "Sim Raider Cutter", count: 1, size: 3, sp: 25, natural: false, stats: { str: 60, con: 50, will: 15 },
        armor: A("medium", "hide"), weapons: [W("circular", "heavy", "steel", { primary: true }), W("thrasher", "light", "hardwood")] },
      { id: "raider-gunner", name: "Sim Raider Gunner", count: 1, size: 3, sp: 25, natural: false, stats: { str: 60, con: 50, dex: 15 },
        armor: A("medium", "softLeather"), weapons: [W("rapid", "heavy", "steel", { primary: true })] },
      { id: "raider-sniper", name: "Sim Raider Sniper", count: 1, size: 3, sp: 25, natural: false, stats: { str: 60, con: 50, dex: 15 },
        armor: A("light", "softLeather"), weapons: [W("longshot", "heavy", "steel", { primary: true })] },
      { id: "raider-bomber", name: "Sim Raider Bomber", count: 1, size: 3, sp: 25, natural: false, stats: { str: 60, con: 50, dex: 15 },
        armor: A("medium", "hide"), weapons: [W("assault", "heavy", "steel", { primary: true })] }
    ]
  },
  boss: {
    label: "Boss", note: "One Size 4 Ogre Tyrant (30 Skill Points, 1/10 ratio: 300 stat points) with natural weapons and hide.",
    kinds: [{ id: "ogre", name: "Sim Ogre Tyrant", count: 1, size: 4, sp: 30, stats: { str: 110, con: 120, dex: 30, will: 40 },
      armor: A("heavy", "iron"), weapons: [W("weighted", "heavy", "iron", { primary: true }), W("striker", "light", "steel")] }]
  }
};

/** The fights of a pass: every monster group against each of the party's loadouts. */
export const ENCOUNTERS = Object.keys(MONSTERS).flatMap(group => [0, 1, 2].map(rotation => ({ id: `${group}-r${rotation + 1}`, group, rotation })));

/** Stat keys every actor has (anything not listed is 0 points spent). */
export const STAT_KEYS = ["str", "dex", "con", "pon", "snap", "will", "reach", "grasp", "build"];
export const statBlock = o => Object.fromEntries(STAT_KEYS.map(k => [k, o[k] ?? 0]));
export const spent = o => STAT_KEYS.reduce((n, k) => n + (o[k] ?? 0), 0);

/** The Grade an item needs for its user's stat to count in full (Grade × 10 ≥ stat), at least 1. */
export const gradeFor = stat => Math.max(1, Math.ceil(Math.max(0, stat) / 10));

/* -------------------------------------------- */
/*  Pass 2: the Martial Theory T1 trees          */
/* -------------------------------------------- */

// Martial Theory T1 unlocks Brawling, Bladed, Balanced, Swift, Rapid and Medium Armor. Each character takes Martial Theory T1 (1 SP), one tree to
// T5 (15) and another to T4 (10); 4 SP are left (Medium Armor T2 for the Duelist, banked otherwise). Two rotations put every tree at T5 at least once
// and swap Light/Heavy weapons so both halves of each tree get used. Monsters have no trees (the baseline to compare with).
const T = (o) => ({ "martial-theory": 1, ...o });
const BAL = "martial-balanced-weapons", BLA = "martial-bladed-weapons", SWI = "martial-swift-weapons", RAP = "martial-rapid-weapons",
  BRA = "martial-brawling-methods", MED = "martial-medium-armor";

export const PARTY_T1 = [
  {
    id: "bulwark", name: "Sim Bulwark", role: "tank", note: "Tank: Parries with a Heavy Balanced weapon (Slip Off, Deflect, Riposte) in Medium armor (Brace, Shift).",
    stats: { con: 45, str: 30, will: 15 },
    loadouts: [
      { trees: T({ [BAL]: 5, [MED]: 4 }), armor: A("medium", "chitin"), weapons: [W("balanced", "heavy", "steel", { primary: true })] },
      { trees: T({ [MED]: 5, [BAL]: 4 }), armor: A("medium", "chitin"), weapons: [W("balanced", "heavy", "steel", { primary: true })] }
    ]
  },
  {
    id: "duelist", name: "Sim Duelist", role: "melee-dex", note: "Dexterity melee: Light Swift and Light Bladed in Fast sets (Quick Strike, Blade Flurry, Whirlwind, Blender).",
    stats: { dex: 45, con: 30, will: 15 },
    loadouts: [
      { trees: T({ [SWI]: 5, [BLA]: 4, [MED]: 2 }), armor: A("medium", "hardLeather"), weapons: [W("swift", "light", "steel", { primary: true }), W("bladed", "light", "steel")] },
      { trees: T({ [BLA]: 5, [SWI]: 4, [MED]: 2 }), armor: A("medium", "hardLeather"), weapons: [W("bladed", "light", "steel", { primary: true }), W("swift", "light", "steel")] }
    ]
  },
  {
    id: "breaker", name: "Sim Breaker", role: "melee-str", note: "Strength melee: a two-handed Heavy Bladed (Remise, Titan Weapon) or Heavy Swift (Omega).",
    stats: { str: 45, con: 30, build: 15 },
    loadouts: [
      { trees: T({ [BLA]: 5, [MED]: 4 }), armor: A("medium", "hide"), weapons: [W("bladed", "heavy", "steel", { primary: true, twoHanded: true })] },
      { trees: T({ [SWI]: 5, [MED]: 4 }), armor: A("medium", "hide"), weapons: [W("swift", "heavy", "steel", { primary: true, twoHanded: true })] }
    ]
  },
  {
    id: "marksman", name: "Sim Marksman", role: "ranged", note: "Ranged: a Light Rapid (Quickload, Spin Down, Mark, Speedloader) with a Light melee backup.",
    stats: { dex: 45, con: 25, str: 10, will: 10 },
    loadouts: [
      { trees: T({ [RAP]: 5, [SWI]: 4 }), armor: A("light", "softLeather"), weapons: [W("rapid", "light", "steel", { primary: true }), W("swift", "light", "steel")] },
      { trees: T({ [RAP]: 5, [BLA]: 4 }), armor: A("light", "chitin"), weapons: [W("rapid", "light", "steel", { primary: true }), W("bladed", "light", "steel")] }
    ]
  },
  {
    id: "warden", name: "Sim Warden", role: "support", note: "Support brawler: Unarmed (Twin Fang, Jab, Dip/Shatter, Combo, Dragon Lash, Kick Out, Redirect, Flow Like Water) and grapples.",
    stats: { str: 30, dex: 30, con: 30 },
    loadouts: [
      { trees: T({ [BRA]: 5, [MED]: 4 }), armor: A("medium", "hardLeather"), weapons: [], grapple: true, brawler: true },
      { trees: T({ [BRA]: 5, [BAL]: 4 }), armor: A("medium", "softLeather"), weapons: [W("balanced", "light", "steel", { primary: true })], grapple: true, brawler: true }
    ]
  }
];

/** A stronger swarm: ten goblins at 20 Skill Points (1/5: 100 stat points), and a mix of weapons (the Light Weighted and Light Thrasher pass 1 missed). */
export const MONSTERS_T1 = {
  ...MONSTERS,
  swarm: {
    label: "Swarm", note: "Ten goblins (20 Skill Points, 1/5 ratio: 100 stat points): Hackers (Heavy Striker), Stabbers (Light Reach), Lashers (Light Thrasher), Bashers (Light Weighted).",
    kinds: [
      { id: "goblin-hacker", name: "Sim Goblin Hacker", count: 3, size: 3, sp: 20, stats: { str: 55, con: 35, dex: 10 },
        armor: A("light", "softLeather"), weapons: [W("striker", "heavy", "iron", { primary: true })] },
      { id: "goblin-stabber", name: "Sim Goblin Stabber", count: 3, size: 3, sp: 20, stats: { dex: 55, con: 35, str: 10 },
        armor: A("light", "softLeather"), weapons: [W("reach", "light", "hardwood", { primary: true })] },
      { id: "goblin-lasher", name: "Sim Goblin Lasher", count: 2, size: 3, sp: 20, stats: { dex: 55, con: 35, str: 10 },
        armor: A("light", "softLeather"), weapons: [W("thrasher", "light", "hardwood", { primary: true })] },
      { id: "goblin-basher", name: "Sim Goblin Basher", count: 2, size: 3, sp: 20, stats: { dex: 55, con: 35, str: 10 },
        armor: A("light", "softLeather"), weapons: [W("weighted", "light", "hardwood", { primary: true })] }
    ]
  }
};

/** Every pass: its party, monsters and fights (every monster group against each of the party's loadouts). */
const encountersFor = (monsters, rotations) => Object.keys(monsters).flatMap(group => [...Array(rotations).keys()].map(rotation => ({ id: `${group}-r${rotation + 1}`, group, rotation })));
export const PASSES = {
  "martial-baseline": { id: "martial-baseline", note: "Baseline Martial: no trees.", party: PARTY, monsters: MONSTERS, encounters: ENCOUNTERS },
  "martial-t1": { id: "martial-t1", note: "Martial Theory T1 trees (Brawling, Bladed, Balanced, Swift, Rapid, Medium Armor) up to T5.", party: PARTY_T1, monsters: MONSTERS_T1, encounters: encountersFor(MONSTERS_T1, 2) }
};

/* -------------------------------------------- */
/*  Pass 2b: filling pass 2's gaps               */
/* -------------------------------------------- */

// Abilities pass 2 never saw: Blade Flurry and Delta (two Light Swift weapons), Twin Fang / Dragon Lash / Redirect (a Light brawler that keeps its
// Energy: no Dip, Shatter or Brace stances), Perfect Riposte (a Bladed parrier), and plain Quickload (the AI cycles Quickload, Pepper, Speedloader).
export const PARTY_T1_GAPS = [
  { ...PARTY_T1[0], loadouts: [PARTY_T1[0].loadouts[0]] },
  { ...PARTY_T1[1], note: "Two Light Swift weapons: Fast Swift sets for Blade Flurry and Delta.",
    loadouts: [{ trees: T({ [SWI]: 5, [BLA]: 4, [MED]: 2 }), armor: A("medium", "hardLeather"), weapons: [W("swift", "light", "steel", { primary: true }), W("swift", "light", "steel")] }] },
  { ...PARTY_T1[2], note: "Parries with a two-handed Heavy Bladed weapon (Perfect Riposte); no Brace, so the Energy goes there.", loadouts: [{ ...PARTY_T1[2].loadouts[0], stances: false }] },
  { ...PARTY_T1[3], loadouts: [PARTY_T1[3].loadouts[0]], quickload: "cycle" },
  { ...PARTY_T1[4], note: "A Light brawler that spends its Energy on Twin Fang, Dragon Lash/Kick Out and Redirect instead of stances.",
    stats: { dex: 40, str: 25, con: 25 }, loadouts: [{ ...PARTY_T1[4].loadouts[0], stances: false, grapple: false }] }
];
PASSES["martial-t1-gaps"] = { id: "martial-t1-gaps", note: "Pass 2's gaps: Blade Flurry, Delta, Twin Fang, Dragon Lash, Redirect, Perfect Riposte, plain Quickload.",
  party: PARTY_T1_GAPS, monsters: { swarm: MONSTERS_T1.swarm, raiders: MONSTERS_T1.raiders }, encounters: [{ id: "swarm-r1", group: "swarm", rotation: 0 }, { id: "raiders-r1", group: "raiders", rotation: 0 }] };

/* -------------------------------------------- */
/*  Pass 3: the Martial Theory T2 trees          */
/* -------------------------------------------- */

// Martial Theory T2 (3 SP) unlocks Strength, Striker, Defender, Weighted, Assault and Heavy Armor. Each character takes one of them to T5 (15) and
// another to T4 (10): 28 of 30 SP. Two rotations put every T2 tree at T5 once and use both weights where the tree splits them.
const T2 = o => ({ "martial-theory": 2, ...o });
const STR = "martial-strength-methods", STK = "martial-striker-weapons", DEF = "martial-defender-weapons", WEI = "martial-weighted-weapons",
  ASL = "martial-assault-weapons", HVY = "martial-heavy-armor";

export const PARTY_T2 = [
  {
    id: "bulwark", name: "Sim Bulwark", role: "tank", note: "Tank: a Heavy Defender (Block for allies, Shield Toss, Sword and Board, Perfect Block) in Heavy armor (Brace, Harden, Trudge, Bodyslam, Launch).",
    stats: { con: 45, str: 30, will: 15 },
    loadouts: [
      { trees: T2({ [DEF]: 5, [HVY]: 4 }), armor: A("heavy", "steel"), weapons: [W("defender", "heavy", "steel", { primary: true }), W("striker", "heavy", "steel")] },
      { trees: T2({ [HVY]: 5, [DEF]: 4 }), armor: A("heavy", "steel"), weapons: [W("defender", "heavy", "steel", { primary: true }), W("striker", "heavy", "steel")] }
    ]
  },
  {
    id: "duelist", name: "Sim Duelist", role: "melee-dex", note: "Dexterity melee: Light Weighted (Controlled Swing, Spin, Smash, Crunch) or two Light Strikers (Berserk's Fast, Seeing Red's Fast+).",
    stats: { dex: 45, con: 30, will: 15 },
    loadouts: [
      { trees: T2({ [WEI]: 5, [STK]: 4 }), armor: A("medium", "hardLeather"), weapons: [W("weighted", "light", "steel", { primary: true }), W("striker", "light", "steel")] },
      { trees: T2({ [STK]: 5, [WEI]: 4 }), armor: A("medium", "hardLeather"), weapons: [W("striker", "light", "steel", { primary: true }), W("striker", "light", "steel")] }
    ]
  },
  {
    id: "breaker", name: "Sim Breaker", role: "melee-str", note: "Strength melee: Heavy Striker (Rend, Berserk's Solitary, Shred, Blood and Iron) or a two-handed Heavy Weighted (Wild Swing, Spin, Smash) with Heave! and Crunch Time.",
    stats: { str: 45, con: 30, build: 15 },
    loadouts: [
      { trees: T2({ [STK]: 5, [STR]: 4 }), armor: A("medium", "hide"), weapons: [W("striker", "heavy", "steel", { primary: true }), W("weighted", "heavy", "iron")] },
      { trees: T2({ [WEI]: 5, [STR]: 4 }), armor: A("medium", "hide"), weapons: [W("weighted", "heavy", "iron", { primary: true, twoHanded: true })] }
    ]
  },
  {
    id: "marksman", name: "Sim Marksman", role: "ranged", note: "Ranged: a Light Assault (Quickload, Take Aim, Distracting Fire, Cool Breath, Proper Stance) with a Light Striker or Light Defender.",
    stats: { dex: 45, con: 25, str: 10, will: 10 },
    loadouts: [
      { trees: T2({ [ASL]: 5, [STK]: 4 }), armor: A("light", "softLeather"), weapons: [W("assault", "light", "steel", { primary: true }), W("striker", "light", "steel")] },
      { trees: T2({ [ASL]: 5, [DEF]: 4 }), armor: A("light", "chitin"), weapons: [W("assault", "light", "steel", { primary: true }), W("defender", "light", "steel")] }
    ]
  },
  {
    id: "warden", name: "Sim Warden", role: "support", note: "Support: a Heavy Defender to Block for allies, with a Heavy Weighted (Heave!, Crunch Time, Ho!, Unstoppable; or Perfect Block, Bounce).",
    stats: { str: 35, con: 35, dex: 20 },
    loadouts: [
      { trees: T2({ [STR]: 5, [DEF]: 4 }), armor: A("medium", "hardLeather"), weapons: [W("weighted", "heavy", "iron", { primary: true }), W("defender", "heavy", "steel")] },
      { trees: T2({ [DEF]: 5, [HVY]: 4 }), armor: A("heavy", "iron"), weapons: [W("defender", "heavy", "steel", { primary: true }), W("weighted", "heavy", "iron")] }
    ]
  }
];
PASSES["martial-t2"] = { id: "martial-t2", note: "Martial Theory T2 trees (Strength, Striker, Defender, Weighted, Assault, Heavy Armor) up to T5.",
  party: PARTY_T2, monsters: MONSTERS_T1, encounters: encountersFor(MONSTERS_T1, 2) };

/* -------------------------------------------- */
/*  Pass 4: the Martial Theory T3 trees          */
/* -------------------------------------------- */

// Martial Theory T3 (6 SP) unlocks Dexterity, Reach, Blast, Circular and Light Armor. Each character takes one tree to T5 (15), one to T3 (6) and one
// to T2 (3): all 30 SP. Folded in from pass 3: Distracting Fire (the Marksman keeps Assault T3, and the Raider Bomber now fires an Area Blast at the
// party), Ho! (the Breaker keeps Strength T4 and throws a Heavy Weighted, an Average throw) and Wide Arc (the Warden keeps Weighted T3 and strafes).
const T3 = o => ({ "martial-theory": 3, ...o });
const DEX = "martial-dexterity-methods", RCH = "martial-reach-weapons", BLS = "martial-blast-weapons", CIR = "martial-circular-weapons", LGT = "martial-light-armor";

export const PARTY_T3 = [
  {
    id: "bulwark", name: "Sim Bulwark", role: "tank", note: "Tank: a two-handed Heavy Reach (Palisade, Thrust, Wall, Twist, Impale) in Light armor (Shift, Dash, Leap, Evade, Breathing Room).",
    stats: { con: 45, str: 30, will: 15 },
    loadouts: [
      { trees: T3({ [LGT]: 5, [RCH]: 3, [CIR]: 2 }), armor: A("light", "chitin"), weapons: [W("reach", "heavy", "steel", { primary: true, twoHanded: true })] },
      { trees: T3({ [RCH]: 5, [LGT]: 3, [DEX]: 2 }), armor: A("light", "chitin"), weapons: [W("reach", "heavy", "steel", { primary: true, twoHanded: true })] }
    ]
  },
  {
    id: "duelist", name: "Sim Duelist", role: "melee-dex", note: "Dexterity melee: a Light Circular (Pierce Through, Let it Rip!, What Goes Around) and a Light Reach, with Shank and Pinpoint Accuracy.",
    stats: { dex: 45, con: 30, will: 15 },
    loadouts: [
      { trees: T3({ [DEX]: 5, [CIR]: 3, [RCH]: 2 }), armor: A("light", "hardLeather"), weapons: [W("circular", "light", "steel", { primary: true }), W("reach", "light", "steel")] },
      { trees: T3({ [CIR]: 5, [DEX]: 3, [RCH]: 2 }), armor: A("light", "hardLeather"), weapons: [W("circular", "light", "steel", { primary: true }), W("reach", "light", "steel")] }
    ]
  },
  {
    id: "breaker", name: "Sim Breaker", role: "melee-str", note: "Strength melee: a Heavy Circular (Cut Through, Let it Rip!) with a Heavy Weighted to throw with Ho!.",
    stats: { str: 45, con: 30, build: 15 },
    loadouts: [
      { trees: T3({ [CIR]: 4, "martial-strength-methods": 4 }), armor: A("light", "softLeather"), weapons: [W("circular", "heavy", "steel", { primary: true }), W("weighted", "heavy", "iron")] },
      { trees: T3({ [CIR]: 5, [LGT]: 3, [RCH]: 2 }), armor: A("light", "softLeather"), weapons: [W("circular", "heavy", "steel", { primary: true }), W("reach", "heavy", "steel")] }
    ]
  },
  {
    id: "marksman", name: "Sim Marksman", role: "ranged", note: "Ranged: a Light Blast (Point Blank, Cone Shot, Rip and Tear, Punch, Execute) and a Light Assault (Distracting Fire against Area attacks).",
    stats: { dex: 45, con: 25, str: 10, will: 10 },
    loadouts: [
      { trees: T3({ [BLS]: 5, "martial-assault-weapons": 3, [LGT]: 2 }), armor: A("light", "softLeather"), weapons: [W("blast", "light", "steel", { primary: true }), W("assault", "light", "steel")] },
      { trees: T3({ [BLS]: 5, [DEX]: 3, [LGT]: 2 }), armor: A("light", "chitin"), weapons: [W("blast", "light", "steel", { primary: true }), W("assault", "light", "steel")] }
    ]
  },
  {
    id: "warden", name: "Sim Warden", role: "support", note: "Support: a Heavy Reach to hold the line (Palisade, Wall) and a Heavy Weighted that strafes (Wide Arc).",
    stats: { str: 35, con: 35, dex: 20 },
    loadouts: [
      { trees: T3({ [RCH]: 5, "martial-weighted-weapons": 3, [LGT]: 2 }), armor: A("light", "hardLeather"), weapons: [W("reach", "heavy", "steel", { primary: true }), W("weighted", "heavy", "iron")] },
      { trees: T3({ [LGT]: 5, [RCH]: 3, "martial-weighted-weapons": 2 }), armor: A("light", "hardLeather"), weapons: [W("reach", "heavy", "steel", { primary: true }), W("weighted", "heavy", "iron")] }
    ]
  }
];

/** The Raider Bomber fires an Area Blast at the party (for Distracting Fire). */
export const MONSTERS_T3 = {
  ...MONSTERS_T1,
  raiders: { ...MONSTERS_T1.raiders, note: `${MONSTERS_T1.raiders.note} The Bomber fires a Heavy Blast (Area+).`,
    kinds: MONSTERS_T1.raiders.kinds.map(k => (k.id === "raider-bomber" ? { ...k, weapons: [W("blast", "heavy", "steel", { primary: true })] } : k)) }
};
PASSES["martial-t3"] = { id: "martial-t3", note: "Martial Theory T3 trees (Dexterity, Reach, Blast, Circular, Light Armor) up to T5, with Distracting Fire, Ho! and Wide Arc.",
  party: PARTY_T3, monsters: MONSTERS_T3, encounters: encountersFor(MONSTERS_T3, 2) };

/* -------------------------------------------- */
/*  Pass 5: the Martial Theory T4 trees          */
/* -------------------------------------------- */

// Martial Theory T4 (10 SP) unlocks Constitution, Curved, Longshot and Titanic Armor. Each character takes one tree to T5 (15) and another to T2 (3),
// 28 SP, or two to T4 (30). Two rotations put every T4 tree at T5 at least once.
const T4 = o => ({ "martial-theory": 4, ...o });
const CON = "martial-constitution-methods", CUR = "martial-curved-weapons", LNG = "martial-longshot-weapons", TIT = "martial-titanic-armor";

export const PARTY_T4 = [
  {
    id: "bulwark", name: "Sim Bulwark", role: "tank", note: "Tank: Titanic armor (Giga Brace, Bodyslam, Giga Harden, Trudge, Chunky) or Constitution (Taunt, Pull Aggro, Imposing Presence), with a Heavy Curved.",
    stats: { con: 45, str: 30, will: 15 },
    loadouts: [
      { trees: T4({ [TIT]: 5, [CON]: 2 }), armor: A("titanic", "iron"), weapons: [W("curved", "heavy", "steel", { primary: true })] },
      { trees: T4({ [CON]: 5, [TIT]: 2 }), armor: A("titanic", "iron"), weapons: [W("curved", "heavy", "steel", { primary: true })] }
    ]
  },
  {
    id: "duelist", name: "Sim Duelist", role: "melee-dex", note: "Dexterity melee: a Light Curved (Disarm, Perfect Parry, Momentum, Sheath Weapon, Omnislash).",
    stats: { dex: 45, con: 30, will: 15 },
    loadouts: [
      { trees: T4({ [CUR]: 5, [CON]: 2 }), armor: A("medium", "hardLeather"), weapons: [W("curved", "light", "steel", { primary: true })] },
      { trees: T4({ [CUR]: 5, [LNG]: 2 }), armor: A("medium", "hardLeather"), weapons: [W("curved", "light", "steel", { primary: true }), W("longshot", "light", "steel")] }
    ]
  },
  {
    id: "breaker", name: "Sim Breaker", role: "melee-str", note: "Strength melee: a two-handed Heavy Curved, with Constitution or in Titanic armor.",
    stats: { str: 45, con: 30, build: 15 },
    loadouts: [
      { trees: T4({ [CUR]: 4, [CON]: 4 }), armor: A("medium", "hide"), weapons: [W("curved", "heavy", "steel", { primary: true, twoHanded: true })] },
      { trees: T4({ [TIT]: 5, [CUR]: 2 }), armor: A("titanic", "steel"), weapons: [W("curved", "heavy", "steel", { primary: true, twoHanded: true })] }
    ]
  },
  {
    id: "marksman", name: "Sim Marksman", role: "ranged", note: "Ranged: a Light Longshot (Prepared Shot, Like Shooting Fish, Snipe Hunt, In a Barrel, Headshot).",
    stats: { dex: 45, con: 25, str: 10, will: 10 },
    loadouts: [
      { trees: T4({ [LNG]: 5, [CUR]: 2 }), armor: A("light", "softLeather"), weapons: [W("longshot", "light", "steel", { primary: true }), W("curved", "light", "steel")] },
      { trees: T4({ [LNG]: 5, [CON]: 2 }), armor: A("light", "chitin"), weapons: [W("longshot", "light", "steel", { primary: true }), W("curved", "light", "steel")] }
    ]
  },
  {
    id: "warden", name: "Sim Warden", role: "support", note: "Support: Constitution (Taunt the foe nearest an ally, Pull Aggro) or a Heavy Curved and Heavy Longshot.",
    stats: { str: 35, con: 35, dex: 20 },
    loadouts: [
      { trees: T4({ [CON]: 5, [CUR]: 2 }), armor: A("medium", "hardLeather"), weapons: [W("curved", "heavy", "steel", { primary: true })] },
      { trees: T4({ [CUR]: 4, [LNG]: 4 }), armor: A("medium", "hardLeather"), weapons: [W("curved", "heavy", "steel", { primary: true }), W("longshot", "heavy", "steel")] }
    ]
  }
];
PASSES["martial-t4"] = { id: "martial-t4", note: "Martial Theory T4 trees (Constitution, Curved, Longshot, Titanic Armor) up to T5.",
  party: PARTY_T4, monsters: MONSTERS_T1, encounters: encountersFor(MONSTERS_T1, 2) };

/* -------------------------------------------- */
/*  Pass 6: the Martial Theory T5 trees          */
/* -------------------------------------------- */

// Martial Theory T5 (15 SP: Weapon Master) unlocks Grappling, Thrasher and Unarmored; each character takes one of them to T5 (15): all 30 SP.
// Weapon Master is exercised with multi-type weapons (`extraTypes`; the AI attacks as each type in turn). Unarmored characters wear no armor.
const T5 = o => ({ "martial-theory": 5, ...o });
const GRP = "martial-grappling-methods", THR = "martial-thrasher-weapons", UNA = "martial-unarmored";

export const PARTY_T5 = [
  {
    id: "bulwark", name: "Sim Bulwark", role: "tank", note: "Tank: a Heavy Thrasher that is also a Reach weapon (Windup, Overshield Strike, Thrasher Grapple, Get Over Here!), or a grappler (Lock Down, Disrupt, Living Weapon).",
    stats: { con: 45, str: 30, will: 15 },
    loadouts: [
      { trees: T5({ [THR]: 5 }), armor: A("heavy", "steel"), weapons: [W("thrasher", "heavy", "steel", { primary: true, extraTypes: ["reach"] })] },
      { trees: T5({ [GRP]: 5 }), armor: A("heavy", "steel"), weapons: [W("defender", "heavy", "steel", { primary: true })], grapple: true }
    ]
  },
  {
    id: "duelist", name: "Sim Duelist", role: "melee-dex", note: "Dexterity melee, unarmored (Dash, Leap, Speedy, Quicken, Unfettered), with a Light Bladed that is also Swift and Curved; or a Light Thrasher.",
    stats: { dex: 45, con: 30, will: 15 },
    loadouts: [
      { trees: T5({ [UNA]: 5 }), armor: null, weapons: [W("bladed", "light", "steel", { primary: true, extraTypes: ["swift", "curved"] })] },
      { trees: T5({ [THR]: 5 }), armor: A("medium", "hardLeather"), weapons: [W("thrasher", "light", "steel", { primary: true, extraTypes: ["circular"] })] }
    ]
  },
  {
    id: "breaker", name: "Sim Breaker", role: "melee-str", note: "Strength melee: a grappler with a Heavy Weighted that is also a Striker (Big Hands takes Size 4), or unarmored with it two-handed.",
    stats: { str: 45, con: 30, build: 15 },
    loadouts: [
      { trees: T5({ [GRP]: 5 }), armor: A("medium", "hide"), weapons: [W("weighted", "heavy", "iron", { primary: true, extraTypes: ["striker"] })], grapple: true },
      { trees: T5({ [UNA]: 5 }), armor: null, weapons: [W("weighted", "heavy", "iron", { primary: true, twoHanded: true, extraTypes: ["striker"] })] }
    ]
  },
  {
    id: "marksman", name: "Sim Marksman", role: "ranged", note: "Ranged, unarmored: a Light Rapid that is also an Assault weapon (Weapon Master), with Dash and Quicken; or a Light Thrasher backup.",
    stats: { dex: 45, con: 25, str: 10, will: 10 },
    loadouts: [
      { trees: T5({ [UNA]: 5 }), armor: null, weapons: [W("rapid", "light", "steel", { primary: true, extraTypes: ["assault"] })] },
      { trees: T5({ [THR]: 5 }), armor: A("light", "softLeather"), weapons: [W("rapid", "light", "steel", { primary: true, extraTypes: ["assault"] }), W("thrasher", "light", "steel")] }
    ]
  },
  {
    id: "warden", name: "Sim Warden", role: "support", note: "Support: a grappler holding the foe nearest an ally (Lock Down, Disrupt, Stunlock, Living Weapon), or a Heavy Thrasher that pulls foes in.",
    stats: { str: 35, con: 35, dex: 20 },
    loadouts: [
      { trees: T5({ [GRP]: 5 }), armor: A("medium", "hardLeather"), weapons: [W("thrasher", "heavy", "copper", { primary: true })], grapple: true },
      { trees: T5({ [THR]: 5 }), armor: A("medium", "hardLeather"), weapons: [W("thrasher", "heavy", "copper", { primary: true, extraTypes: ["weighted"] })] }
    ]
  }
];
PASSES["martial-t5"] = { id: "martial-t5", note: "Martial Theory T5 (Weapon Master) and its trees (Grappling, Thrasher, Unarmored) to T5.",
  party: PARTY_T5, monsters: MONSTERS_T1, encounters: encountersFor(MONSTERS_T1, 2) };

/* -------------------------------------------- */
/*  Focused passes (after the balance review)    */
/* -------------------------------------------- */

// The review's open questions, each tested on its own: a weapon benchmark against still dummies, 2H against 1H + shield in mirror duels,
// armor against speed (a gun that kites a melee chaser) and Heavy Assault with Quickload.

/** A still target: it never acts, only dodges. Same body as a party member (Con 45, Dex 30). */
const dummy = (armor, count = 1) => ({ kinds: [{ id: "dummy", name: "Sim Dummy", role: "dummy", count, size: 3, sp: 30, natural: false,
  stats: { con: 45, dex: 30, str: 15 }, armor, weapons: [] }] });
const MELEE_TYPES = ["bladed", "balanced", "swift", "striker", "defender", "weighted", "reach", "circular", "curved", "thrasher"];
const RANGED_TYPES = ["rapid", "assault", "blast", "longshot"];
/** Every weapon type and weight, one-handed and (Heavy) two-handed, no trees; plus Assault with its tree (Quickload, then T5). */
const BENCH = [
  { id: "unarmed", weapons: [] },
  ...MELEE_TYPES.flatMap(t => [
    { id: `${t}-light`, weapons: [W(t, "light", "steel", { primary: true })] },
    { id: `${t}-heavy`, weapons: [W(t, "heavy", "steel", { primary: true })] },
    { id: `${t}-heavy-2h`, weapons: [W(t, "heavy", "steel", { primary: true, twoHanded: true })] }]),
  ...RANGED_TYPES.flatMap(t => [
    { id: `${t}-light`, weapons: [W(t, "light", "steel", { primary: true })], ranged: true },
    { id: `${t}-heavy`, weapons: [W(t, "heavy", "steel", { primary: true })], ranged: true },
    { id: `${t}-heavy-2h`, weapons: [W(t, "heavy", "steel", { primary: true, twoHanded: true })], ranged: true }]),
  { id: "assault-heavy-q", trees: T2({ [ASL]: 1 }), weapons: [W("assault", "heavy", "steel", { primary: true })], ranged: true },
  { id: "assault-heavy-t5", trees: T2({ [ASL]: 5 }), weapons: [W("assault", "heavy", "steel", { primary: true })], ranged: true },
  { id: "assault-light-q", trees: T2({ [ASL]: 1 }), weapons: [W("assault", "light", "steel", { primary: true })], ranged: true },
  { id: "assault-light-t5", trees: T2({ [ASL]: 5 }), weapons: [W("assault", "light", "steel", { primary: true })], ranged: true }
];
export const PARTY_BENCH = [{ id: "tester", name: "Sim Tester", role: "bench", note: "Str 45 and Dex 45: every weapon at full scaling.",
  stats: { str: 45, dex: 45 }, loadouts: BENCH.map(b => ({ ...b, armor: null })) }];
const BENCH_DUMMIES = { light: dummy(A("light", "softLeather")), heavy: dummy(A("heavy", "iron")), cluster: dummy(A("light", "softLeather"), 3) };
PASSES["focus-bench"] = { id: "focus-bench", note: "Weapon benchmark: each weapon against a still dummy in Light or Heavy armor for 4 rounds; Blasts also into a cluster of 3.",
  party: PARTY_BENCH, monsters: BENCH_DUMMIES, deploy: "bench", maxRounds: 4,
  encounters: [
    ...BENCH.flatMap((b, rotation) => ["light", "heavy"].map(group => ({ id: `${b.id}-${group}`, group, rotation }))),
    ...BENCH.map((b, rotation) => ({ b, rotation })).filter(x => x.b.id.startsWith("blast")).map(({ b, rotation }) => ({ id: `${b.id}-cluster`, group: "cluster", rotation }))
  ] };

// Mirror duels: the same Strength build (Weighted or Bladed to T5) with a two-handed weapon and Strength T4, or the one-handed weapon and a
// Heavy Defender shield with Defender T4 (Block, Shield Toss, Sword and Board, Bounce). Both in Medium armor.
const DUELIST_STATS = { str: 45, con: 30, build: 15 };
const SHIELD_LOADOUTS = {
  w2h: { trees: T2({ [WEI]: 5, [STR]: 4 }), armor: A("medium", "hide"), weapons: [W("weighted", "heavy", "steel", { primary: true, twoHanded: true })] },
  wsh: { trees: T2({ [WEI]: 5, [DEF]: 4 }), armor: A("medium", "hide"), weapons: [W("weighted", "heavy", "steel", { primary: true }), W("defender", "heavy", "steel")] },
  b2h: { trees: T2({ [BLA]: 5, [STR]: 4 }), armor: A("medium", "hide"), weapons: [W("bladed", "heavy", "steel", { primary: true, twoHanded: true })] },
  bsh: { trees: T2({ [BLA]: 5, [DEF]: 4 }), armor: A("medium", "hide"), weapons: [W("bladed", "heavy", "steel", { primary: true }), W("defender", "heavy", "steel")] }
};
const SHIELD_KEYS = Object.keys(SHIELD_LOADOUTS);
export const PARTY_SHIELD = [{ id: "breaker", name: "Sim Breaker", role: "melee-str", note: "Strength melee, one loadout per duel.",
  stats: DUELIST_STATS, loadouts: SHIELD_KEYS.map(k => SHIELD_LOADOUTS[k]) }];
const RIVALS = Object.fromEntries(SHIELD_KEYS.map(k => [k, { kinds: [{ id: "rival", name: "Sim Rival", count: 1, size: 3, sp: 30, natural: false, stats: DUELIST_STATS, ...SHIELD_LOADOUTS[k] }] }]));
const duels = (mine, theirs, reps) => [...Array(reps).keys()].map(i => ({ id: `${mine}-v-${theirs}-${i + 1}`, group: theirs, rotation: SHIELD_KEYS.indexOf(mine) }));
PASSES["focus-shield"] = { id: "focus-shield", note: "Mirror duels: two-handed (Strength T4) against one-handed + Heavy Defender (Defender T4), Weighted and Bladed.",
  party: PARTY_SHIELD, monsters: RIVALS,
  encounters: [...duels("w2h", "wsh", 3), ...duels("wsh", "w2h", 3), ...duels("b2h", "bsh", 3), ...duels("bsh", "b2h", 3)] };

// Armor against speed: a Light Assault gunner (no trees) that keeps out of a melee chaser's reach, in Light, Medium or Heavy armor, against a
// two-handed Heavy Weighted chaser in each of the three. A big open field (400 ft square).
const KITE_ARMOR = { light: A("light", "softLeather"), medium: A("medium", "hide"), heavy: A("heavy", "iron") };
export const PARTY_KITE = [{ id: "kiter", name: "Sim Kiter", role: "kiter", note: "Shoots, and steps back out of the chaser's reach when it can still shoot after.",
  stats: { dex: 45, con: 25, str: 10, will: 10 }, loadouts: Object.values(KITE_ARMOR).map(armor => ({ armor, weapons: [W("assault", "light", "steel", { primary: true })] })) }];
const CHASERS = Object.fromEntries(Object.entries(KITE_ARMOR).map(([k, armor]) => [k, { kinds: [{ id: "chaser", name: "Sim Chaser", count: 1, size: 3, sp: 30, natural: false,
  stats: DUELIST_STATS, armor, weapons: [W("weighted", "heavy", "steel", { primary: true, twoHanded: true })] }] }]));
PASSES["focus-kite"] = { id: "focus-kite", note: "Armor vs speed: a Light Assault kiter in Light/Medium/Heavy armor against a 2H Heavy Weighted chaser in each.",
  party: PARTY_KITE, monsters: CHASERS, deploy: "kite", arena: { name: "Sim Field", width: 8000, height: 8000 },
  encounters: Object.keys(KITE_ARMOR).flatMap((mine, rotation) => Object.keys(KITE_ARMOR).flatMap(theirs => [1, 2].map(i => ({ id: `${mine}-v-${theirs}-${i}`, group: theirs, rotation })))) };

// Retest (after the review's follow-ups): Knockback weapons with Force damage now counted, Light Reach at Reach T5 beside other Light
// weapons at their T5, and Blasts with the AI firing Area only when it pays (single targets, an armored cluster, a bare cluster).
// Two-handed weapons now give a Strengthened stack instead of double damage (v0.76.0). Two fights per cell.
const RT = (id, type, weight, trees, o = {}) => ({ id, trees, ranged: ["blast"].includes(type), weapons: [W(type, weight, "steel", { primary: true, ...o })] });
const RETEST = [
  RT("weighted-light", "weighted", "light", {}), RT("weighted-heavy", "weighted", "heavy", {}), RT("weighted-heavy-2h", "weighted", "heavy", {}, { twoHanded: true }),
  RT("weighted-light-t5", "weighted", "light", T2({ [WEI]: 5 })), RT("weighted-heavy-t5", "weighted", "heavy", T2({ [WEI]: 5 })), RT("weighted-heavy-2h-t5", "weighted", "heavy", T2({ [WEI]: 5 }), { twoHanded: true }),
  RT("thrasher-light", "thrasher", "light", {}), RT("thrasher-heavy", "thrasher", "heavy", {}), RT("thrasher-heavy-2h", "thrasher", "heavy", {}, { twoHanded: true }),
  RT("thrasher-light-t5", "thrasher", "light", T5({ [THR]: 5 })), RT("thrasher-heavy-t5", "thrasher", "heavy", T5({ [THR]: 5 })), RT("thrasher-heavy-2h-t5", "thrasher", "heavy", T5({ [THR]: 5 }), { twoHanded: true }),
  RT("bladed-heavy-2h", "bladed", "heavy", {}, { twoHanded: true }), RT("striker-heavy-2h", "striker", "heavy", {}, { twoHanded: true }), RT("curved-heavy-2h", "curved", "heavy", {}, { twoHanded: true }),
  RT("reach-light-t5", "reach", "light", T3({ [RCH]: 5 })), RT("reach-heavy-t5", "reach", "heavy", T3({ [RCH]: 5 })), RT("reach-heavy-2h-t5", "reach", "heavy", T3({ [RCH]: 5 }), { twoHanded: true }),
  RT("bladed-light-t5", "bladed", "light", T({ [BLA]: 5 })), RT("curved-light-t5", "curved", "light", T4({ [CUR]: 5 })), RT("striker-light-t5", "striker", "light", T2({ [STK]: 5 })),
  RT("blast-light", "blast", "light", {}), RT("blast-heavy", "blast", "heavy", {}),
  RT("blast-light-t5", "blast", "light", T3({ [BLS]: 5 })), RT("blast-heavy-t5", "blast", "heavy", T3({ [BLS]: 5 }))
];
const RETEST_DUMMIES = { ...BENCH_DUMMIES, bare: { kinds: [{ ...dummy(null, 3).kinds[0] }] } };
PASSES["focus-retest"] = { id: "focus-retest", note: "Retest: Knockback weapons (Force counted), Light Reach at T5, Blasts with Area only when it pays; 2H = Strengthened.",
  party: [{ ...PARTY_BENCH[0], loadouts: RETEST.map(b => ({ ...b, armor: null })) }], monsters: RETEST_DUMMIES, deploy: "bench", maxRounds: 4,
  encounters: RETEST.flatMap((b, rotation) => (b.id.startsWith("blast") ? ["light", "heavy", "cluster", "bare"] : ["light", "heavy"])
    .flatMap(group => [1, 2].map(i => ({ id: `${b.id}~${group}~${i}`, group, rotation })))) };

// Smash at its new cost (Scaling Stat min) and Light Blast as Area, Pierce, Pepper (v0.76.1).
const SB = RETEST.filter(b => /^weighted-.*-t5$|^blast-/.test(b.id));
PASSES["focus-smash-blast"] = { id: "focus-smash-blast", note: "Smash at its new cost and the new Light Blast (Area, Pierce, Pepper).",
  party: [{ ...PARTY_BENCH[0], loadouts: SB.map(b => ({ ...b, armor: null })) }], monsters: RETEST_DUMMIES, deploy: "bench", maxRounds: 4,
  encounters: SB.flatMap((b, rotation) => (b.id.startsWith("blast") ? ["light", "heavy", "cluster", "bare"] : ["light", "heavy"])
    .flatMap(group => [...Array(b.id.startsWith("blast") ? 2 : 3).keys()].map(i => ({ id: `${b.id}~${group}~${i + 1}`, group, rotation })))) };

// Light Blast with Pepper off: is Pepper's Disadvantage costing more than its extra shot?
const NP = RETEST.filter(b => /^blast-light/.test(b.id)).map(b => ({ ...b, id: `${b.id}-nopepper`, noPepper: true }));
PASSES["focus-blast-nopepper"] = { id: "focus-blast-nopepper", note: "Light Blast (Area, Pierce, Pepper) fired without Pepper.",
  party: [{ ...PARTY_BENCH[0], loadouts: NP.map(b => ({ ...b, armor: null })) }], monsters: RETEST_DUMMIES, deploy: "bench", maxRounds: 4,
  encounters: NP.flatMap((b, rotation) => ["light", "heavy", "cluster", "bare"].flatMap(group => [1, 2].map(i => ({ id: `${b.id}~${group}~${i}`, group, rotation })))) };

// Smashing (start of turn: Strengthened adds to Knockback) and Light Blast as Area, Pierce, Cleave (v0.77.0).
PASSES["focus-smash-blast-2"] = { ...PASSES["focus-smash-blast"], id: "focus-smash-blast-2", note: "Smashing (v0.77.0) and Light Blast as Area, Pierce, Cleave." };

// The Blasts again after the sim fix (an Area now targets everyone in it), Light Blast as Area, Pierce, Cleave (v0.77.1).
const B3 = RETEST.filter(b => b.id.startsWith("blast"));
PASSES["focus-blast-3"] = { id: "focus-blast-3", note: "Blasts with the Area targeting fix; Light Blast as Area, Pierce, Cleave.",
  party: [{ ...PARTY_BENCH[0], loadouts: B3.map(b => ({ ...b, armor: null })) }], monsters: RETEST_DUMMIES, deploy: "bench", maxRounds: 4,
  encounters: B3.flatMap((b, rotation) => ["light", "heavy", "cluster", "bare"].flatMap(group => [1, 2].map(i => ({ id: `${b.id}~${group}~${i}`, group, rotation })))) };

// Re-run of the Martial passes with every fix in (v0.77.1): two hands = Strengthened, Remise ×2 on 2H Heavy Bladed, Smashing, Light Blast
// (Area, Pierce, Cleave), Quickload on follow-ups, Area attacks targeting everyone in them, Knockback Force counted. Same rosters as before.
for (const id of ["martial-t1", "martial-t1-gaps", "martial-t2", "martial-t3", "martial-t4", "martial-t5"]) PASSES[`${id}-r2`] = { ...PASSES[id], id: `${id}-r2`, note: `${PASSES[id].note} (re-run, v0.77.1)` };

// Pain Threshold at half of max HP (v0.79.0): the T1 and T5 parties against the Raiders and the Ogre, to compare rounds with the ¼ runs.
PASSES["pain-t1"] = { ...PASSES["martial-t1"], id: "pain-t1", note: "Pain Threshold ½ (v0.79.0), T1 trees." };
PASSES["pain-t5"] = { ...PASSES["martial-t5"], id: "pain-t5", note: "Pain Threshold ½ (v0.79.0), T5 trees." };

// Pain Threshold A/B on the same code (the hidden painDivisor setting: 4 = a quarter, 2 = half): the T1 party against every group, both
// rotations, two fights each. The sim sets the divisor before each pass.
const PAIN_AB = Object.keys(MONSTERS_T1).flatMap(group => [0, 1].flatMap(rotation => [1, 2].map(i => ({ id: `${group}-r${rotation + 1}-${i}`, group, rotation }))));
PASSES["pain-ab-quarter"] = { ...PASSES["martial-t1"], id: "pain-ab-quarter", painDivisor: 4, encounters: PAIN_AB, note: "Pain Threshold ¼ (A/B)." };
PASSES["pain-ab-half"] = { ...PASSES["martial-t1"], id: "pain-ab-half", painDivisor: 2, encounters: PAIN_AB, note: "Pain Threshold ½ (A/B)." };

/* -------------------------------------------- */
/*  Magic pass 1: the Magic Theory T1 schools     */
/* -------------------------------------------- */

// Pure casters (the user's choice): Magic Theory T1 (1 SP) unlocks Protection Arcana, Gravity, Slashing, Piercing and Crushing. Each character takes
// one school to T5 (15), another to T4 (10) and a third to T2 (3): 29 of 30 SP. Foci and Shroud Graded to the stat (no Affixes this pass), armor, no
// weapon trees. Two rotations put every T1 school at T5 at least once and try different Foci (Igniters, Channelers, Raw and Multi casting).
// The monsters cast too, with the same T1 schools (natural Foci and Shrouds).
const M1 = o => ({ "magic-theory": 1, ...o });
const PRO = "magic-protection-arcana", GRA = "magic-gravity", SLA = "magic-slashing", PIE = "magic-piercing", CRU = "magic-crushing";
const FO = (type, o = {}) => ({ type, ...o });
export const PARTY_M1 = [
  {
    id: "bulwark", name: "Sim Bulwark", role: "tank", note: "Tank caster: Shields (Reflect, Adjust, Emplace, Dampen) and Slams from a Rod, in Medium armor with a Bastion Shroud.",
    stats: { con: 40, grasp: 30, build: 20 },
    loadouts: [
      { trees: M1({ [PRO]: 5, [CRU]: 4, [GRA]: 2 }), armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") },
      { trees: M1({ [CRU]: 5, [PRO]: 4, [GRA]: 2 }), armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") }
    ]
  },
  {
    id: "duelist", name: "Sim Slasher", role: "caster", note: "Grasp caster: Cut and Stab (Bleed, Gash, Rend, Chop / Exploit, Pierce, Setup, Weakpoint) from a Wand or Rod.",
    stats: { grasp: 45, con: 30, build: 15 },
    loadouts: [
      { trees: M1({ [SLA]: 5, [PIE]: 4, [CRU]: 2 }), armor: A("light", "hardLeather"), weapons: [], foci: FO("wand"), shroud: FO("cinder") },
      { trees: M1({ [PIE]: 5, [SLA]: 4, [GRA]: 2 }), armor: A("light", "hardLeather"), weapons: [], foci: FO("rod"), shroud: FO("carapace") }
    ]
  },
  {
    id: "breaker", name: "Sim Crusher", role: "caster", note: "Reach caster: Slam and Force (Crush, Bash, Beatdown, Telegraph / Hold, Gravity Field) from a Tome or Scroll.",
    stats: { reach: 45, con: 30, build: 15 },
    loadouts: [
      { trees: M1({ [CRU]: 5, [GRA]: 4, [SLA]: 2 }), armor: A("medium", "softLeather"), weapons: [], foci: FO("tome", { twoHanded: true }), shroud: FO("bastion") },
      { trees: M1({ [GRA]: 5, [CRU]: 4, [PIE]: 2 }), armor: A("medium", "softLeather"), weapons: [], foci: FO("scroll"), shroud: FO("ember") }
    ]
  },
  {
    id: "marksman", name: "Sim Piercer", role: "caster", note: "Raw caster (Reach and Grasp): Stab and Cut with no Foci, or through a Gauntlet (casts twice).",
    stats: { reach: 30, grasp: 30, con: 30 },
    loadouts: [
      { trees: M1({ [PIE]: 5, [SLA]: 4, [GRA]: 2 }), armor: A("light", "softLeather"), weapons: [], foci: null, shroud: FO("lattice") },
      { trees: M1({ [SLA]: 5, [PIE]: 4, [CRU]: 2 }), armor: A("light", "softLeather"), weapons: [], foci: FO("gauntlet"), shroud: FO("lattice") }
    ]
  },
  {
    id: "warden", name: "Sim Warden", role: "support", note: "Support caster: Burden/Lighten, Personal Repulsion, Hold and Gravity Field, or Shields, from a Scepter (+1 TR on allies).",
    stats: { grasp: 35, con: 30, reach: 10, build: 15 },
    loadouts: [
      { trees: M1({ [GRA]: 5, [PRO]: 4, [PIE]: 2 }), armor: A("medium", "hardLeather"), weapons: [], foci: FO("scepter"), shroud: FO("bastion") },
      { trees: M1({ [PRO]: 5, [GRA]: 4, [SLA]: 2 }), armor: A("medium", "hardLeather"), weapons: [], foci: FO("scepter"), shroud: FO("bastion") }
    ]
  }
];

/** Caster monsters: the same five schools, natural Foci (scale uncapped) and Shrouds. */
export const MONSTERS_M1 = {
  swarm: {
    label: "Swarm", note: "Ten goblin casters (20 Skill Points, 1/5): Cutters, Stabbers, Bashers and Pushers, each with two T1 schools (T4 and T3) and a natural Rod.",
    kinds: [
      { id: "goblin-cutter", name: "Sim Goblin Cutter", count: 3, size: 3, sp: 20, stats: { grasp: 45, con: 35, build: 10, reach: 10 }, trees: M1({ [SLA]: 4, [CRU]: 3 }), armor: A("light", "softLeather"), weapons: [], foci: FO("rod") },
      { id: "goblin-stabber", name: "Sim Goblin Stabber", count: 3, size: 3, sp: 20, stats: { grasp: 45, con: 35, build: 10, reach: 10 }, trees: M1({ [PIE]: 4, [SLA]: 3 }), armor: A("light", "softLeather"), weapons: [], foci: FO("rod") },
      { id: "goblin-basher", name: "Sim Goblin Basher", count: 2, size: 3, sp: 20, stats: { grasp: 45, con: 35, build: 10, reach: 10 }, trees: M1({ [CRU]: 4, [GRA]: 3 }), armor: A("light", "softLeather"), weapons: [], foci: FO("rod") },
      { id: "goblin-pusher", name: "Sim Goblin Pusher", count: 2, size: 3, sp: 20, stats: { grasp: 45, con: 35, build: 10, reach: 10 }, trees: M1({ [GRA]: 4, [PIE]: 3 }), armor: A("light", "softLeather"), weapons: [], foci: FO("rod") }
    ]
  },
  raiders: {
    label: "Raiders", note: "Five caster raiders (25 Skill Points, 1/5): one school each at T5 and another at T3, natural Foci and a Bastion Shroud; the Warder Shields its crew.",
    kinds: [
      { id: "raider-crusher", name: "Sim Raider Crusher", count: 1, size: 3, sp: 25, stats: { reach: 55, con: 50, build: 20 }, trees: M1({ [CRU]: 5, [GRA]: 3 }), armor: A("medium", "hide"), weapons: [], foci: FO("scroll"), shroud: FO("bastion") },
      { id: "raider-slasher", name: "Sim Raider Slasher", count: 1, size: 3, sp: 25, stats: { grasp: 55, con: 50, build: 20 }, trees: M1({ [SLA]: 5, [PIE]: 3 }), armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") },
      { id: "raider-piercer", name: "Sim Raider Piercer", count: 1, size: 3, sp: 25, stats: { reach: 40, grasp: 40, con: 45 }, trees: M1({ [PIE]: 5, [CRU]: 3 }), armor: A("light", "softLeather"), weapons: [], foci: null, shroud: FO("bastion") },
      { id: "raider-gravitic", name: "Sim Raider Gravitic", count: 1, size: 3, sp: 25, stats: { grasp: 55, con: 50, build: 20 }, trees: M1({ [GRA]: 5, [SLA]: 3 }), armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") },
      { id: "raider-warder", name: "Sim Raider Warder", count: 1, size: 3, sp: 25, role: "support", stats: { grasp: 55, con: 50, build: 20 }, trees: M1({ [PRO]: 5, [CRU]: 3 }), armor: A("medium", "hide"), weapons: [], foci: FO("scepter"), shroud: FO("bastion") }
    ]
  },
  boss: {
    label: "Boss", note: "An Ogre Magus (Size 4, 30 Skill Points, 1/10): Crushing T5 and Gravity T4 through a natural Orb, with natural Heavy armor and a Carapace Shroud.",
    kinds: [{ id: "ogre-magus", name: "Sim Ogre Magus", count: 1, size: 4, sp: 30, stats: { con: 110, reach: 80, grasp: 40, build: 40, will: 30 }, trees: M1({ [CRU]: 5, [GRA]: 4 }),
      armor: A("heavy", "iron"), weapons: [], foci: FO("orb"), shroud: FO("carapace") }]
  }
};
PASSES["magic-t1"] = { id: "magic-t1", note: "Magic Theory T1 schools (Protection Arcana, Gravity, Slashing, Piercing, Crushing) up to T5; caster monsters with the same schools.",
  party: PARTY_M1, monsters: MONSTERS_M1, encounters: encountersFor(MONSTERS_M1, 2) };

/* -------------------------------------------- */
/*  Magic pass 2: the Magic Theory T2 schools     */
/* -------------------------------------------- */

// Magic Theory T2 (3 SP: Focus and Ritual Casting) unlocks Reach Arcana, Heat, Cold, Radiation and Acid. Each caster takes one school to T5 (15) and
// another to T4 (10): 28 of 30 SP, and Focuses its main school's Core (+1 TR). Pure casters as in pass 1; the monsters cast the same tier.
const M2 = o => ({ "magic-theory": 2, ...o });
const RCH2 = "magic-reach-arcana", HEA = "magic-heat", COL = "magic-cold", RAD = "magic-radiation", ACI = "magic-acid";
const FLAME = "magic-heat:flame", FROST = "magic-cold:frost", CRACKLE = "magic-radiation:crackle", GLOB = "magic-acid:glob";
export const PARTY_M2 = [
  {
    id: "bulwark", name: "Sim Bulwark", role: "tank", note: "Tank caster: Glob and Frost (Melt, Solidify, Sticky, Catalyst / Frostbite, Chill, Freeze, Shatter) from a Rod.",
    stats: { con: 40, grasp: 30, build: 20 },
    loadouts: [
      { trees: M2({ [ACI]: 5, [COL]: 4 }), focus: GLOB, armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") },
      { trees: M2({ [COL]: 5, [ACI]: 4 }), focus: FROST, armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") }
    ]
  },
  {
    id: "duelist", name: "Sim Pyro", role: "caster", note: "Grasp caster: Flame and Crackle (Ignition, Brand, Flare, Cook / Electrify, Lightning Rod, Charge, Discharge) from a Wand or Rod.",
    stats: { grasp: 45, con: 30, build: 15 },
    loadouts: [
      { trees: M2({ [HEA]: 5, [RAD]: 4 }), focus: FLAME, armor: A("light", "hardLeather"), weapons: [], foci: FO("wand"), shroud: FO("cinder") },
      { trees: M2({ [RAD]: 5, [HEA]: 4 }), focus: CRACKLE, armor: A("light", "hardLeather"), weapons: [], foci: FO("rod"), shroud: FO("cinder") }
    ]
  },
  {
    id: "breaker", name: "Sim Storm", role: "caster", note: "Reach caster: Crackle with Reach Arcana (Multicast, Lob, Mold, Explode, Minigun) from a Tome or Scroll.",
    stats: { reach: 45, con: 30, build: 15 },
    loadouts: [
      { trees: M2({ [RAD]: 5, [RCH2]: 4 }), focus: CRACKLE, armor: A("medium", "softLeather"), weapons: [], foci: FO("tome", { twoHanded: true }), shroud: FO("bastion") },
      { trees: M2({ [RCH2]: 5, [RAD]: 4 }), focus: CRACKLE, armor: A("medium", "softLeather"), weapons: [], foci: FO("scroll"), shroud: FO("ember") }
    ]
  },
  {
    id: "marksman", name: "Sim Frostfire", role: "caster", note: "Raw caster: Frost and Flame with no Foci, or through a Gauntlet.",
    stats: { reach: 30, grasp: 30, con: 30 },
    loadouts: [
      { trees: M2({ [COL]: 5, [HEA]: 4 }), focus: FROST, armor: A("light", "softLeather"), weapons: [], foci: null, shroud: FO("lattice") },
      { trees: M2({ [HEA]: 5, [COL]: 4 }), focus: FLAME, armor: A("light", "softLeather"), weapons: [], foci: FO("gauntlet"), shroud: FO("lattice") }
    ]
  },
  {
    id: "warden", name: "Sim Warden", role: "support", note: "Support caster: Glob with Reach Arcana (Multicast, Explode), from a Scepter.",
    stats: { grasp: 35, con: 30, reach: 10, build: 15 },
    loadouts: [
      { trees: M2({ [RCH2]: 5, [ACI]: 4 }), focus: GLOB, armor: A("medium", "hardLeather"), weapons: [], foci: FO("scepter"), shroud: FO("bastion") },
      { trees: M2({ [ACI]: 5, [RCH2]: 4 }), focus: GLOB, armor: A("medium", "hardLeather"), weapons: [], foci: FO("scepter"), shroud: FO("bastion") }
    ]
  }
];

export const MONSTERS_M2 = {
  swarm: {
    label: "Swarm", note: "Ten goblin casters (20 Skill Points, 1/5): Magic Theory T2 and two T2 schools (T4 and T3), a natural Rod.",
    kinds: [
      { id: "goblin-pyro", name: "Sim Goblin Pyro", count: 3, size: 3, sp: 20, stats: { grasp: 45, con: 35, build: 10, reach: 10 }, trees: M2({ [HEA]: 4, [COL]: 3 }), focus: FLAME, armor: A("light", "softLeather"), weapons: [], foci: FO("rod") },
      { id: "goblin-froster", name: "Sim Goblin Froster", count: 3, size: 3, sp: 20, stats: { grasp: 45, con: 35, build: 10, reach: 10 }, trees: M2({ [COL]: 4, [ACI]: 3 }), focus: FROST, armor: A("light", "softLeather"), weapons: [], foci: FO("rod") },
      { id: "goblin-sparker", name: "Sim Goblin Sparker", count: 2, size: 3, sp: 20, stats: { grasp: 45, con: 35, build: 10, reach: 10 }, trees: M2({ [RAD]: 4, [HEA]: 3 }), focus: CRACKLE, armor: A("light", "softLeather"), weapons: [], foci: FO("rod") },
      { id: "goblin-spitter", name: "Sim Goblin Spitter", count: 2, size: 3, sp: 20, stats: { grasp: 45, con: 35, build: 10, reach: 10 }, trees: M2({ [ACI]: 4, [RAD]: 3 }), focus: GLOB, armor: A("light", "softLeather"), weapons: [], foci: FO("rod") }
    ]
  },
  raiders: {
    label: "Raiders", note: "Five caster raiders (25 Skill Points, 1/5): Magic Theory T2, one T2 school at T5 and another at T3, natural Foci and a Bastion Shroud.",
    kinds: [
      { id: "raider-pyro", name: "Sim Raider Pyro", count: 1, size: 3, sp: 25, stats: { grasp: 55, con: 50, build: 20 }, trees: M2({ [HEA]: 5, [RAD]: 3 }), focus: FLAME, armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") },
      { id: "raider-froster", name: "Sim Raider Froster", count: 1, size: 3, sp: 25, stats: { grasp: 55, con: 50, build: 20 }, trees: M2({ [COL]: 5, [ACI]: 3 }), focus: FROST, armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") },
      { id: "raider-storm", name: "Sim Raider Storm", count: 1, size: 3, sp: 25, stats: { reach: 55, con: 50, build: 20 }, trees: M2({ [RAD]: 5, [RCH2]: 3 }), focus: CRACKLE, armor: A("medium", "hide"), weapons: [], foci: FO("scroll"), shroud: FO("bastion") },
      { id: "raider-spitter", name: "Sim Raider Spitter", count: 1, size: 3, sp: 25, stats: { grasp: 55, con: 50, build: 20 }, trees: M2({ [ACI]: 5, [HEA]: 3 }), focus: GLOB, armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") },
      { id: "raider-caster", name: "Sim Raider Echo", count: 1, size: 3, sp: 25, stats: { reach: 40, grasp: 40, con: 45 }, trees: M2({ [RCH2]: 5, [COL]: 3 }), focus: FROST, armor: A("light", "softLeather"), weapons: [], foci: null, shroud: FO("bastion") }
    ]
  },
  boss: {
    label: "Boss", note: "An Ogre Magus (Size 4, 30 Skill Points, 1/10): Heat T5 and Acid T4 through a natural Orb, natural Heavy armor and a Carapace Shroud.",
    kinds: [{ id: "ogre-magus", name: "Sim Ogre Magus", count: 1, size: 4, sp: 30, stats: { con: 110, reach: 80, grasp: 40, build: 40, will: 30 }, trees: M2({ [HEA]: 5, [ACI]: 4 }), focus: FLAME,
      armor: A("heavy", "iron"), weapons: [], foci: FO("orb"), shroud: FO("carapace") }]
  }
};
PASSES["magic-t2"] = { id: "magic-t2", note: "Magic Theory T2 schools (Reach Arcana, Heat, Cold, Radiation, Acid) up to T5; caster monsters with the same schools.",
  party: PARTY_M2.map(p => ({ ...p, loadouts: p.loadouts.map(l => ({ ...l })) })), monsters: MONSTERS_M2, encounters: encountersFor(MONSTERS_M2, 2) };

/* -------------------------------------------- */
/*  Magic pass 3: the Magic Theory T3 schools     */
/* -------------------------------------------- */

// Magic Theory T3 (6 SP: Empower, Weaving) unlocks Grasp Arcana, Venomancy, Charm and Witchery. The T3 schools have no direct-damage spell (Grasp Arcana
// has no Core at all, and a Poison only passes on when its coated carrier deals direct damage), so each caster spends its last 3 SP on a T1 damage
// school at T2 (Cut, Stab or Slam) as the carrier (a judgment call for the sim): Magic Theory T3 (6) + a T3 school at T5 (15) + another at T3 (6) +
// the carrier at T2 (3) = 30. The monsters are built the same way.
const M3 = o => ({ "magic-theory": 3, ...o });
const GRS = "magic-grasp-arcana", VEN = "magic-venomancy", CHA = "magic-charm", WIT = "magic-witchery";
const POISON = "magic-venomancy:poison", CHARM = "magic-charm:charm", HEX = "magic-witchery:hex";
export const PARTY_M3 = [
  {
    id: "bulwark", name: "Sim Bulwark", role: "tank", note: "Tank caster: Hex and Charm (Charm + Hex), Slam as the carrier, from a Rod.",
    stats: { con: 40, grasp: 30, build: 20 },
    loadouts: [
      { trees: M3({ [WIT]: 5, [CHA]: 3, [CRU]: 2 }), focus: HEX, armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") },
      { trees: M3({ [CHA]: 5, [WIT]: 3, [CRU]: 2 }), focus: CHARM, armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") }
    ]
  },
  {
    id: "duelist", name: "Sim Venom", role: "caster", note: "Grasp caster: Poison coats (Prolong, Lethality, Potency, Virality) carried by Cut, with Grasp Arcana (Foresight, Replicate, Instant Ritual).",
    stats: { grasp: 45, con: 30, build: 15 },
    loadouts: [
      { trees: M3({ [VEN]: 5, [GRS]: 3, [SLA]: 2 }), focus: POISON, armor: A("light", "hardLeather"), weapons: [], foci: FO("wand"), shroud: FO("cinder") },
      { trees: M3({ [GRS]: 5, [VEN]: 3, [SLA]: 2 }), focus: POISON, armor: A("light", "hardLeather"), weapons: [], foci: FO("rod"), shroud: FO("cinder") }
    ]
  },
  {
    id: "breaker", name: "Sim Hexer", role: "caster", note: "Reach caster: Hex (Linger, Fester, Unravel, Consume) and Poison, Stab as the carrier, from a Tome or Scroll.",
    stats: { reach: 45, con: 30, build: 15 },
    loadouts: [
      { trees: M3({ [WIT]: 5, [VEN]: 3, [PIE]: 2 }), focus: HEX, armor: A("medium", "softLeather"), weapons: [], foci: FO("tome", { twoHanded: true }), shroud: FO("bastion") },
      { trees: M3({ [VEN]: 5, [WIT]: 3, [PIE]: 2 }), focus: POISON, armor: A("medium", "softLeather"), weapons: [], foci: FO("scroll"), shroud: FO("ember") }
    ]
  },
  {
    id: "marksman", name: "Sim Charmer", role: "caster", note: "Raw caster: Charm (Ingrained, Convince, Cloud, Propagandize) or Hex, Cut as the carrier.",
    stats: { reach: 30, grasp: 30, con: 30 },
    loadouts: [
      { trees: M3({ [CHA]: 5, [VEN]: 3, [SLA]: 2 }), focus: CHARM, armor: A("light", "softLeather"), weapons: [], foci: null, shroud: FO("lattice") },
      { trees: M3({ [WIT]: 5, [CHA]: 3, [SLA]: 2 }), focus: HEX, armor: A("light", "softLeather"), weapons: [], foci: FO("gauntlet"), shroud: FO("lattice") }
    ]
  },
  {
    id: "warden", name: "Sim Warden", role: "support", note: "Support caster: Grasp Arcana and Charm, Burden (Gravity T2) on the biggest threat, from a Scepter.",
    stats: { grasp: 35, con: 30, reach: 10, build: 15 },
    loadouts: [
      { trees: M3({ [GRS]: 5, [CHA]: 3, [GRA]: 2 }), focus: CHARM, armor: A("medium", "hardLeather"), weapons: [], foci: FO("scepter"), shroud: FO("bastion") },
      { trees: M3({ [CHA]: 5, [GRS]: 3, [GRA]: 2 }), focus: CHARM, armor: A("medium", "hardLeather"), weapons: [], foci: FO("scepter"), shroud: FO("bastion") }
    ]
  }
];

export const MONSTERS_M3 = {
  swarm: {
    label: "Swarm", note: "Ten goblin casters (20 Skill Points, 1/5): Magic Theory T3, a T3 school at T4 and a T1 carrier at T2, a natural Rod.",
    kinds: [
      { id: "goblin-venomer", name: "Sim Goblin Venomer", count: 3, size: 3, sp: 20, stats: { grasp: 45, con: 35, build: 10, reach: 10 }, trees: M3({ [VEN]: 4, [SLA]: 2 }), focus: POISON, armor: A("light", "softLeather"), weapons: [], foci: FO("rod") },
      { id: "goblin-charmer", name: "Sim Goblin Charmer", count: 3, size: 3, sp: 20, stats: { grasp: 45, con: 35, build: 10, reach: 10 }, trees: M3({ [CHA]: 4, [PIE]: 2 }), focus: CHARM, armor: A("light", "softLeather"), weapons: [], foci: FO("rod") },
      { id: "goblin-hexer", name: "Sim Goblin Hexer", count: 2, size: 3, sp: 20, stats: { grasp: 45, con: 35, build: 10, reach: 10 }, trees: M3({ [WIT]: 4, [CRU]: 2 }), focus: HEX, armor: A("light", "softLeather"), weapons: [], foci: FO("rod") },
      { id: "goblin-grasper", name: "Sim Goblin Grasper", count: 2, size: 3, sp: 20, stats: { grasp: 45, con: 35, build: 10, reach: 10 }, trees: M3({ [GRS]: 4, [SLA]: 2 }), armor: A("light", "softLeather"), weapons: [], foci: FO("rod") }
    ]
  },
  raiders: {
    label: "Raiders", note: "Five caster raiders (25 Skill Points, 1/5): Magic Theory T3, one T3 school at T5 and a T1 carrier at T2, natural Foci and a Bastion Shroud.",
    kinds: [
      { id: "raider-venomer", name: "Sim Raider Venomer", count: 1, size: 3, sp: 25, stats: { grasp: 55, con: 50, build: 20 }, trees: M3({ [VEN]: 5, [SLA]: 2 }), focus: POISON, armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") },
      { id: "raider-charmer", name: "Sim Raider Charmer", count: 1, size: 3, sp: 25, stats: { grasp: 55, con: 50, build: 20 }, trees: M3({ [CHA]: 5, [PIE]: 2 }), focus: CHARM, armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") },
      { id: "raider-hexer", name: "Sim Raider Hexer", count: 1, size: 3, sp: 25, stats: { reach: 55, con: 50, build: 20 }, trees: M3({ [WIT]: 5, [CRU]: 2 }), focus: HEX, armor: A("medium", "hide"), weapons: [], foci: FO("scroll"), shroud: FO("bastion") },
      { id: "raider-grasper", name: "Sim Raider Grasper", count: 1, size: 3, sp: 25, stats: { grasp: 55, con: 50, build: 20 }, trees: M3({ [GRS]: 5, [SLA]: 2 }), armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") },
      { id: "raider-witch", name: "Sim Raider Witch", count: 1, size: 3, sp: 25, stats: { reach: 40, grasp: 40, con: 45 }, trees: M3({ [WIT]: 5, [PIE]: 2 }), focus: HEX, armor: A("light", "softLeather"), weapons: [], foci: null, shroud: FO("bastion") }
    ]
  },
  boss: {
    label: "Boss", note: "An Ogre Magus (Size 4, 30 Skill Points, 1/10): Witchery T5, Venomancy T3 and Crushing T2 through a natural Orb, natural Heavy armor and a Carapace Shroud.",
    kinds: [{ id: "ogre-magus", name: "Sim Ogre Magus", count: 1, size: 4, sp: 30, stats: { con: 110, reach: 80, grasp: 40, build: 40, will: 30 }, trees: M3({ [WIT]: 5, [VEN]: 3, [CRU]: 2 }), focus: HEX,
      armor: A("heavy", "iron"), weapons: [], foci: FO("orb"), shroud: FO("carapace") }]
  }
};
PASSES["magic-t3"] = { id: "magic-t3", note: "Magic Theory T3 schools (Grasp Arcana, Venomancy, Charm, Witchery) up to T5, each caster with a T1 carrier at T2; caster monsters the same.",
  party: PARTY_M3, monsters: MONSTERS_M3, encounters: encountersFor(MONSTERS_M3, 2) };

/* -------------------------------------------- */
/*  Magic pass 4: the Magic Theory T4 schools     */
/* -------------------------------------------- */

// Magic Theory T4 (10 SP: Connection, Snipe) unlocks Build Arcana, Summoning, Creation and Animation. Each caster takes its main T4 school to T5 (15),
// a second one to T2 (3) and a T1 damage school at T1 (1): 29 of 30 SP. `conj` names what the caster keeps in the fight each turn (the Cores, and
// for an Animation the material): Creation alone only makes gear, so Creation casters make it for a Summon (Form + Make) or animate it (Make + Animate).
const M4 = o => ({ "magic-theory": 4, ...o });
const BUI = "magic-build-arcana", SUM = "magic-summoning", CRE = "magic-creation", ANI = "magic-animation";
const FORM = "magic-summoning:form", MAKE = "magic-creation:make", ANIMATE = "magic-animation:animate";
export const PARTY_M4 = [
  {
    id: "bulwark", name: "Sim Bulwark", role: "tank", note: "Tank caster: Build Arcana (Layered, Reactive) on its Shields and an armed Summon, from a Rod.",
    stats: { con: 40, grasp: 30, build: 20 },
    loadouts: [
      { trees: M4({ [BUI]: 5, [SUM]: 2, [PRO]: 1 }), focus: FORM, conj: { cores: [FORM] }, armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") },
      { trees: M4({ [SUM]: 5, [BUI]: 2, [PRO]: 1 }), focus: FORM, conj: { cores: [FORM] }, armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") }
    ]
  },
  {
    id: "duelist", name: "Sim Summoner", role: "caster", note: "Grasp caster: Summons (Arm, Skin, Size by Threshold) given a Made weapon (Form + Make) or built as an Animation (Form + Animate), Cut on the side.",
    stats: { grasp: 45, con: 30, build: 15 },
    loadouts: [
      { trees: M4({ [SUM]: 5, [CRE]: 2, [SLA]: 1 }), focus: FORM, conj: { cores: [FORM, MAKE] }, armor: A("light", "hardLeather"), weapons: [], foci: FO("wand"), shroud: FO("cinder") },
      { trees: M4({ [SUM]: 5, [ANI]: 2, [SLA]: 1 }), focus: FORM, conj: { cores: [FORM, ANIMATE], material: "Clay" }, armor: A("light", "hardLeather"), weapons: [], foci: FO("rod"), shroud: FO("cinder") }
    ]
  },
  {
    id: "breaker", name: "Sim Animator", role: "caster", note: "Reach caster: Animate (Expanded Animation: Stone) or Make + Animate, Stab on the side, from a Tome or Scroll.",
    stats: { reach: 45, con: 30, build: 15 },
    loadouts: [
      { trees: M4({ [ANI]: 5, [SUM]: 2, [PIE]: 1 }), focus: ANIMATE, conj: { cores: [ANIMATE], material: "Stone" }, armor: A("medium", "softLeather"), weapons: [], foci: FO("tome", { twoHanded: true }), shroud: FO("bastion") },
      { trees: M4({ [ANI]: 5, [CRE]: 2, [PIE]: 1 }), focus: ANIMATE, conj: { cores: [MAKE, ANIMATE], material: "Clay" }, armor: A("medium", "softLeather"), weapons: [], foci: FO("scroll"), shroud: FO("ember") }
    ]
  },
  {
    id: "marksman", name: "Sim Maker", role: "caster", note: "Raw caster: Creation (Make Mk2/Mk3, Complexity) arming a Summon (Form + Make) or animating its gear (Make + Animate), Cut on the side.",
    stats: { reach: 30, grasp: 30, con: 30 },
    loadouts: [
      { trees: M4({ [CRE]: 5, [SUM]: 2, [SLA]: 1 }), focus: MAKE, conj: { cores: [FORM, MAKE] }, armor: A("light", "softLeather"), weapons: [], foci: null, shroud: FO("lattice") },
      { trees: M4({ [CRE]: 5, [ANI]: 2, [SLA]: 1 }), focus: MAKE, conj: { cores: [MAKE, ANIMATE], material: "Clay" }, armor: A("light", "softLeather"), weapons: [], foci: FO("gauntlet"), shroud: FO("lattice") }
    ]
  },
  {
    id: "warden", name: "Sim Warden", role: "support", note: "Support caster: a Skinned Summon with Layered and Reactive, Burden (Gravity T2) on the biggest threat, from a Scepter.",
    stats: { grasp: 35, con: 30, reach: 10, build: 15 },
    loadouts: [
      { trees: M4({ [SUM]: 4, [BUI]: 3, [GRA]: 2 }), focus: FORM, conj: { cores: [FORM] }, armor: A("medium", "hardLeather"), weapons: [], foci: FO("scepter"), shroud: FO("bastion") },
      { trees: M4({ [BUI]: 4, [SUM]: 3, [GRA]: 2 }), focus: FORM, conj: { cores: [FORM] }, armor: A("medium", "hardLeather"), weapons: [], foci: FO("scepter"), shroud: FO("bastion") }
    ]
  }
];

export const MONSTERS_M4 = {
  swarm: {
    label: "Swarm", note: "Ten goblin casters (20 Skill Points, 1/5): Magic Theory T4, T4 schools worth 6 SP and Cut at T2, a natural Rod.",
    kinds: [
      { id: "goblin-summoner", name: "Sim Goblin Summoner", count: 3, size: 3, sp: 20, stats: { grasp: 45, con: 35, build: 10, reach: 10 }, trees: M4({ [SUM]: 3, [SLA]: 2 }), focus: FORM, conj: { cores: [FORM] }, armor: A("light", "softLeather"), weapons: [], foci: FO("rod") },
      { id: "goblin-animator", name: "Sim Goblin Animator", count: 3, size: 3, sp: 20, stats: { grasp: 45, con: 35, build: 10, reach: 10 }, trees: M4({ [ANI]: 3, [SLA]: 2 }), focus: ANIMATE, conj: { cores: [ANIMATE], material: "Stone" }, armor: A("light", "softLeather"), weapons: [], foci: FO("rod") },
      { id: "goblin-maker", name: "Sim Goblin Maker", count: 2, size: 3, sp: 20, stats: { grasp: 45, con: 35, build: 10, reach: 10 }, trees: M4({ [CRE]: 2, [SUM]: 2, [SLA]: 2 }), focus: FORM, conj: { cores: [FORM, MAKE] }, armor: A("light", "softLeather"), weapons: [], foci: FO("rod") },
      { id: "goblin-builder", name: "Sim Goblin Builder", count: 2, size: 3, sp: 20, stats: { grasp: 45, con: 35, build: 10, reach: 10 }, trees: M4({ [BUI]: 2, [SUM]: 2, [SLA]: 2 }), focus: FORM, conj: { cores: [FORM] }, armor: A("light", "softLeather"), weapons: [], foci: FO("rod") }
    ]
  },
  raiders: {
    label: "Raiders", note: "Five caster raiders (25 Skill Points, 1/5): Magic Theory T4 and T4 schools (a Summoner and an Animator at T5, the rest mixed with Cut), natural Foci and a Bastion Shroud.",
    kinds: [
      { id: "raider-summoner", name: "Sim Raider Summoner", count: 1, size: 3, sp: 25, stats: { grasp: 55, con: 50, build: 20 }, trees: M4({ [SUM]: 5 }), focus: FORM, conj: { cores: [FORM] }, armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") },
      { id: "raider-animator", name: "Sim Raider Animator", count: 1, size: 3, sp: 25, stats: { grasp: 55, con: 50, build: 20 }, trees: M4({ [ANI]: 5 }), focus: ANIMATE, conj: { cores: [ANIMATE], material: "Stone" }, armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") },
      { id: "raider-maker", name: "Sim Raider Maker", count: 1, size: 3, sp: 25, stats: { reach: 55, con: 50, build: 20 }, trees: M4({ [CRE]: 4, [SUM]: 2, [SLA]: 1 }), focus: FORM, conj: { cores: [FORM, MAKE] }, armor: A("medium", "hide"), weapons: [], foci: FO("scroll"), shroud: FO("bastion") },
      { id: "raider-builder", name: "Sim Raider Builder", count: 1, size: 3, sp: 25, stats: { grasp: 55, con: 50, build: 20 }, trees: M4({ [BUI]: 4, [SUM]: 2, [SLA]: 1 }), focus: FORM, conj: { cores: [FORM] }, armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") },
      { id: "raider-binder", name: "Sim Raider Binder", count: 1, size: 3, sp: 25, stats: { reach: 40, grasp: 40, con: 45 }, trees: M4({ [SUM]: 3, [ANI]: 2, [SLA]: 2 }), focus: FORM, conj: { cores: [FORM, ANIMATE], material: "Clay" }, armor: A("light", "softLeather"), weapons: [], foci: null, shroud: FO("bastion") }
    ]
  },
  boss: {
    label: "Boss", note: "An Ogre Magus (Size 4, 30 Skill Points, 1/10): Summoning T5, Build Arcana T2 and Crushing T1 through a natural Orb, natural Heavy armor and a Carapace Shroud.",
    kinds: [{ id: "ogre-magus", name: "Sim Ogre Magus", count: 1, size: 4, sp: 30, stats: { con: 110, reach: 80, grasp: 40, build: 40, will: 30 }, trees: M4({ [SUM]: 5, [BUI]: 2, [CRU]: 1 }), focus: FORM, conj: { cores: [FORM] },
      armor: A("heavy", "iron"), weapons: [], foci: FO("orb"), shroud: FO("carapace") }]
  }
};
PASSES["magic-t4"] = { id: "magic-t4", note: "Magic Theory T4 schools (Build Arcana, Summoning, Creation, Animation) up to T5, each caster keeping a creation in the fight, with a T1 damage school; caster monsters the same.",
  party: PARTY_M4, monsters: MONSTERS_M4, encounters: encountersFor(MONSTERS_M4, 2) };

/* -------------------------------------------- */
/*  Magic pass 5: the Magic Theory T5 schools     */
/* -------------------------------------------- */

// Magic Theory T5 (15 SP) unlocks Restoration Arcana, Geomancy, Illusion and Arcanomancy. Each caster's first loadout takes one T5 school to T5 (15:
// 30 SP); the second takes it to T4 (10), another T5 school to T2 (3) and a T1 school at T1 (1), for its Combos (29 SP).
const M5 = o => ({ "magic-theory": 5, ...o });
const RES = "magic-restoration-arcana", GEO = "magic-geomancy", ILL = "magic-illusion", ARC = "magic-arcanomancy";
const RESTORE = "magic-restoration-arcana:restore", SHIFT = "magic-geomancy:shift", MIRAGE = "magic-illusion:mirage", STRIKE = "magic-arcanomancy:strike";
export const PARTY_M5 = [
  {
    id: "bulwark", name: "Sim Bulwark", role: "tank", note: "Tank caster: Arcanomancy (Strike; Absorb, Amplify) or Strike with Geomancy and a Shield, from a Rod.",
    stats: { con: 40, grasp: 30, build: 20 },
    loadouts: [
      { trees: M5({ [ARC]: 5 }), focus: STRIKE, armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") },
      { trees: M5({ [ARC]: 4, [GEO]: 2, [PRO]: 1 }), focus: STRIKE, armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") }
    ]
  },
  {
    id: "duelist", name: "Sim Geomancer", role: "caster", note: "Grasp caster: Shift with Toss, Tier Up, Muddy and Harden; or Shift + Strike and Cut + Shift.",
    stats: { grasp: 45, con: 30, build: 15 },
    loadouts: [
      { trees: M5({ [GEO]: 5 }), focus: SHIFT, armor: A("light", "hardLeather"), weapons: [], foci: FO("wand"), shroud: FO("cinder") },
      { trees: M5({ [GEO]: 4, [ARC]: 2, [SLA]: 1 }), focus: SHIFT, armor: A("light", "hardLeather"), weapons: [], foci: FO("rod"), shroud: FO("cinder") }
    ]
  },
  {
    id: "breaker", name: "Sim Illusionist", role: "caster", note: "Reach caster: Mirage (Phantom Pain, Fidelity, Pervasive) on the biggest threat, or Mirage + Strike (their Magic fails), Stab on the side.",
    stats: { reach: 45, con: 30, build: 15 },
    loadouts: [
      { trees: M5({ [ILL]: 5 }), focus: MIRAGE, armor: A("medium", "softLeather"), weapons: [], foci: FO("tome", { twoHanded: true }), shroud: FO("bastion") },
      { trees: M5({ [ILL]: 4, [ARC]: 2, [PIE]: 1 }), focus: MIRAGE, armor: A("medium", "softLeather"), weapons: [], foci: FO("scroll"), shroud: FO("ember") }
    ]
  },
  {
    id: "marksman", name: "Sim Striker", role: "caster", note: "Raw caster: Strike (Arcanomancy T5), or Strike with Illusion (Mirage + Strike) and Cut + Strike.",
    stats: { reach: 30, grasp: 30, con: 30 },
    loadouts: [
      { trees: M5({ [ARC]: 5 }), focus: STRIKE, armor: A("light", "softLeather"), weapons: [], foci: null, shroud: FO("lattice") },
      { trees: M5({ [ARC]: 4, [ILL]: 2, [SLA]: 1 }), focus: STRIKE, armor: A("light", "softLeather"), weapons: [], foci: FO("gauntlet"), shroud: FO("lattice") }
    ]
  },
  {
    id: "warden", name: "Sim Mender", role: "support", note: "Support caster: Restore (Painless, Resuscitate) on whoever lost the most since its last turn; or Restore with Geomancy and Force.",
    stats: { grasp: 35, con: 30, reach: 10, build: 15 },
    loadouts: [
      { trees: M5({ [RES]: 5 }), focus: RESTORE, armor: A("medium", "hardLeather"), weapons: [], foci: FO("scepter"), shroud: FO("bastion") },
      { trees: M5({ [RES]: 4, [GEO]: 2, [GRA]: 1 }), focus: RESTORE, armor: A("medium", "hardLeather"), weapons: [], foci: FO("scepter"), shroud: FO("bastion") }
    ]
  }
];

export const MONSTERS_M5 = {
  swarm: {
    label: "Swarm", note: "Ten goblin casters (20 Skill Points, 1/5): Magic Theory T5, a T5 school at T2 and a T1 school at T1, a natural Rod.",
    kinds: [
      { id: "goblin-geomancer", name: "Sim Goblin Geomancer", count: 3, size: 3, sp: 20, stats: { grasp: 45, con: 35, build: 10, reach: 10 }, trees: M5({ [GEO]: 2, [CRU]: 1 }), focus: SHIFT, armor: A("light", "softLeather"), weapons: [], foci: FO("rod") },
      { id: "goblin-striker", name: "Sim Goblin Striker", count: 3, size: 3, sp: 20, stats: { grasp: 45, con: 35, build: 10, reach: 10 }, trees: M5({ [ARC]: 2, [SLA]: 1 }), focus: STRIKE, armor: A("light", "softLeather"), weapons: [], foci: FO("rod") },
      { id: "goblin-illusionist", name: "Sim Goblin Illusionist", count: 2, size: 3, sp: 20, stats: { grasp: 45, con: 35, build: 10, reach: 10 }, trees: M5({ [ILL]: 2, [PIE]: 1 }), focus: MIRAGE, armor: A("light", "softLeather"), weapons: [], foci: FO("rod") },
      { id: "goblin-mender", name: "Sim Goblin Mender", count: 2, size: 3, sp: 20, stats: { grasp: 45, con: 35, build: 10, reach: 10 }, trees: M5({ [RES]: 2, [SLA]: 1 }), focus: RESTORE, armor: A("light", "softLeather"), weapons: [], foci: FO("rod") }
    ]
  },
  raiders: {
    label: "Raiders", note: "Five caster raiders (25 Skill Points, 1/5): Magic Theory T5 and one T5 school at T4 (the Witch mixes Geomancy, Arcanomancy and Cut), natural Foci and a Bastion Shroud.",
    kinds: [
      { id: "raider-geomancer", name: "Sim Raider Geomancer", count: 1, size: 3, sp: 25, stats: { grasp: 55, con: 50, build: 20 }, trees: M5({ [GEO]: 4 }), focus: SHIFT, armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") },
      { id: "raider-striker", name: "Sim Raider Striker", count: 1, size: 3, sp: 25, stats: { grasp: 55, con: 50, build: 20 }, trees: M5({ [ARC]: 4 }), focus: STRIKE, armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") },
      { id: "raider-illusionist", name: "Sim Raider Illusionist", count: 1, size: 3, sp: 25, stats: { reach: 55, con: 50, build: 20 }, trees: M5({ [ILL]: 4 }), focus: MIRAGE, armor: A("medium", "hide"), weapons: [], foci: FO("scroll"), shroud: FO("bastion") },
      { id: "raider-mender", name: "Sim Raider Mender", count: 1, size: 3, sp: 25, stats: { grasp: 55, con: 50, build: 20 }, trees: M5({ [RES]: 4 }), focus: RESTORE, armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") },
      { id: "raider-witch", name: "Sim Raider Witch", count: 1, size: 3, sp: 25, stats: { reach: 40, grasp: 40, con: 45 }, trees: M5({ [GEO]: 3, [ARC]: 2, [SLA]: 1 }), focus: SHIFT, armor: A("light", "softLeather"), weapons: [], foci: null, shroud: FO("bastion") }
    ]
  },
  boss: {
    label: "Boss", note: "An Ogre Magus (Size 4, 30 Skill Points, 1/10): Geomancy T5 through a natural Orb, natural Heavy armor and a Carapace Shroud.",
    kinds: [{ id: "ogre-magus", name: "Sim Ogre Magus", count: 1, size: 4, sp: 30, stats: { con: 110, reach: 80, grasp: 40, build: 40, will: 30 }, trees: M5({ [GEO]: 5 }), focus: SHIFT,
      armor: A("heavy", "iron"), weapons: [], foci: FO("orb"), shroud: FO("carapace") }]
  }
};
PASSES["magic-t5"] = { id: "magic-t5", note: "Magic Theory T5 schools (Restoration Arcana, Geomancy, Illusion, Arcanomancy) up to T5, or T4 with Combos; caster monsters the same.",
  party: PARTY_M5, monsters: MONSTERS_M5, encounters: encountersFor(MONSTERS_M5, 2) };
