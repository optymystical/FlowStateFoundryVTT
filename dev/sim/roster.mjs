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

/* -------------------------------------------- */
/*  Magic school benchmark                        */
/* -------------------------------------------- */

// One caster per Magic school against the same three tree-less raiders for 4 rounds, so the schools compare on one scale (HP the raiders lose,
// afflictions and burns included). Every caster has the same stats (Grasp 45, Con 30, Build 15, a Rod, a Bastion, Medium Hide) and takes Magic
// Theory to its school's tier, the school to T5 (T4 for the T5 schools, which cost 15 SP of Theory) and Cut at T2 as a shared damage carrier
// (Slashing itself takes Stab instead), so every caster has a damage spell and Poison has something to ride on. A "Cut only" caster is the
// baseline. The raiders walk into a punching bag (an unarmored ally with a lot of HP that only dodges) standing between them and the caster; what they deal
// it shows what control and support schools prevent. Each config runs twice.
const MB = (tier, school, lvl = 5, carrier = SLA) => ({ "magic-theory": tier, [school]: lvl, ...(school === carrier ? {} : { [carrier]: 2 }) });
const BENCH_SCHOOLS = [
  ["cut-only", "Cut only (baseline)", { "magic-theory": 1, [SLA]: 2 }],
  ["slashing", "Slashing", MB(1, SLA, 5, PIE)], ["piercing", "Piercing", MB(1, PIE)], ["crushing", "Crushing", MB(1, CRU)],
  ["protection", "Protection Arcana", MB(1, PRO), "support"], ["gravity", "Gravity", MB(1, GRA), "support"],
  ["reach", "Reach Arcana", MB(2, RCH2)], ["heat", "Heat", MB(2, HEA)], ["cold", "Cold", MB(2, COL)], ["radiation", "Radiation", MB(2, RAD)], ["acid", "Acid", MB(2, ACI)],
  ["grasp", "Grasp Arcana", MB(3, GRS)], ["venomancy", "Venomancy", MB(3, VEN)], ["charm", "Charm", MB(3, CHA)], ["witchery", "Witchery", MB(3, WIT)],
  ["build", "Build Arcana", MB(4, BUI)], ["summoning", "Summoning", MB(4, SUM), null, { cores: [FORM] }], ["creation", "Creation", MB(4, CRE)],
  ["animation", "Animation", MB(4, ANI), null, { cores: [ANIMATE], material: "Stone" }],
  ["restoration", "Restoration Arcana", MB(5, RES, 4)], ["geomancy", "Geomancy", MB(5, GEO, 4)], ["illusion", "Illusion", MB(5, ILL, 4)], ["arcanomancy", "Arcanomancy", MB(5, ARC, 4)]
];
const BENCH_CASTER_STATS = { grasp: 45, con: 30, build: 15 };
export const PARTY_MBENCH = [
  { id: "caster", name: "Sim Caster", role: "caster", note: "One loadout per school.", stats: BENCH_CASTER_STATS,
    loadouts: BENCH_SCHOOLS.map(([id, label, trees, role, conj]) => ({ id, label, trees, role: role ?? "caster", conj: conj ?? null, armor: A("medium", "hide"), weapons: [], foci: FO("rod"), shroud: FO("bastion") })) },
  { id: "bag", name: "Sim Bag", role: "dummy", note: "No armor (its Grade would follow Con and soak everything), only dodges; Con 400 so it stays standing all 4 rounds.", stats: { con: 400 },
    loadouts: BENCH_SCHOOLS.map(() => ({ trees: {}, armor: null, weapons: [] })) }
];
const BENCH_RAIDERS = { raiders: { label: "Raiders", note: "Three tree-less raiders with Heavy weapons (25 Skill Points).",
  kinds: [
    { id: "bench-brute", name: "Sim Raider Brute", count: 1, size: 3, sp: 25, natural: false, stats: { str: 60, con: 50, will: 15 }, armor: A("heavy", "iron"), weapons: [W("swift", "heavy", "steel", { primary: true, twoHanded: true })] },
    { id: "bench-cutter", name: "Sim Raider Cutter", count: 1, size: 3, sp: 25, natural: false, stats: { str: 60, con: 50, will: 15 }, armor: A("medium", "hide"), weapons: [W("circular", "heavy", "steel", { primary: true })] },
    { id: "bench-bruiser", name: "Sim Raider Bruiser", count: 1, size: 3, sp: 25, natural: false, stats: { str: 60, con: 50, build: 15 }, armor: A("medium", "hide"), weapons: [W("weighted", "heavy", "steel", { primary: true })] }
  ] } };
PASSES["magic-bench"] = { id: "magic-bench", note: "School benchmark: one caster per Magic school (with Cut T2) against three tree-less raiders hitting a punching bag, 4 rounds.",
  party: PARTY_MBENCH, monsters: BENCH_RAIDERS, deploy: "magicbench", maxRounds: 4,
  encounters: BENCH_SCHOOLS.flatMap(([id], rotation) => [1, 2].map(rep => ({ id: `${id}-${rep}`, group: "raiders", rotation }))) };

// The same benchmark against unarmored raiders, for the T3 schools: does Poison fail on its delivery (a carrier soaked by armor) or on the check?
const SOFT_RAIDERS = { raiders: { ...BENCH_RAIDERS.raiders, note: "The benchmark's three raiders without armor.", kinds: BENCH_RAIDERS.raiders.kinds.map(k => ({ ...k, armor: null })) } };
const SOFT_IDS = ["cut-only", "venomancy", "witchery", "charm"];
PASSES["magic-bench-soft"] = { id: "magic-bench-soft", note: "School benchmark against unarmored raiders: Cut only and the T3 schools, three fights each.",
  party: PARTY_MBENCH, monsters: SOFT_RAIDERS, deploy: "magicbench", maxRounds: 4,
  encounters: SOFT_IDS.flatMap(id => [1, 2, 3].map(rep => ({ id: `${id}-${rep}`, group: "raiders", rotation: BENCH_SCHOOLS.findIndex(s => s[0] === id) }))) };

// Venomancy re-run once the sim passes coatings on (before, the Pass the Poison button was never pressed): against armored and unarmored raiders.
PASSES["magic-bench-venom"] = { id: "magic-bench-venom", note: "Venomancy with its coatings passed on, against the benchmark's raiders with and without armor, three fights each.",
  party: PARTY_MBENCH, monsters: { armored: BENCH_RAIDERS.raiders, soft: SOFT_RAIDERS.raiders }, deploy: "magicbench", maxRounds: 4,
  encounters: ["armored", "soft"].flatMap(group => [1, 2, 3].map(rep => ({ id: `venomancy-${group}-${rep}`, group, rotation: BENCH_SCHOOLS.findIndex(s => s[0] === "venomancy") }))) };

// (Venomancy variants were tested on 24 Oct 2026 behind a temporary setting, since removed: a coating that poisons every hit, a passed check that
// halves the damage, and a coating passed on any hit. Their results stay in results/magic-bench-venom-*.json; Poison stays as written.)

// More armored fights for the rules as written.
PASSES["magic-bench-venom-armored"] = { ...PASSES["magic-bench-venom"], id: "magic-bench-venom-armored", note: "Venomancy against armored raiders, six more fights.",
  encounters: [4, 5, 6, 7, 8, 9].map(rep => ({ id: `venomancy-armored-${rep}`, group: "armored", rotation: BENCH_SCHOOLS.findIndex(s => s[0] === "venomancy") })) };

// Re-runs on 24 Oct 2026: T3 now that the sim passes Poison coatings on, T4 with Animation Size capped by the Threshold (v0.80.0).
PASSES["magic-t3-rerun"] = { ...PASSES["magic-t3"], id: "magic-t3-rerun", note: `${PASSES["magic-t3"].note} Re-run with Poison coatings passed on.` };
PASSES["magic-t4-rerun"] = { ...PASSES["magic-t4"], id: "magic-t4-rerun", note: `${PASSES["magic-t4"].note} Re-run with Animation Size capped by the Threshold.` };

/* -------------------------------------------- */
/*  Magic vs Martial                              */
/* -------------------------------------------- */

// Party A: the dungeon-crawl party (tank, support, two damage dealers and a ranged one), each a real 30 Skill Point build somewhere between all
// Martial and all Magic, same stat and gear rules as before. Two rotations: (1) a Martial frontline with Magic in the back, (2) mostly hybrids
// (Martial trees and Magic schools on one character) with a pure Arcanomancer and a Martial support. Hybrids cast their spells first (support,
// then one damage spell) and fight with their weapons for the rest of the turn.
const MAG = (tier, o) => ({ "magic-theory": tier, ...o });
const MIX = (mt, mg, o) => ({ "martial-theory": mt, "magic-theory": mg, ...o });
export const PARTY_MIX = [
  {
    id: "bulwark", name: "Sim Bulwark", role: "tank", note: "Tank: Martial (Heavy Armor, Defender) or a hybrid holding a Heavy Defender behind its own Shields (Protection Arcana).",
    stats: { con: 40, str: 30, grasp: 20 },
    loadouts: [
      { label: "Martial", stats: { con: 45, str: 30, will: 15 }, trees: T2({ [HVY]: 5, [DEF]: 4 }), armor: A("heavy", "steel"), weapons: [W("defender", "heavy", "steel", { primary: true }), W("striker", "heavy", "steel")] },
      { label: "Hybrid", trees: MIX(2, 1, { [HVY]: 4, [PRO]: 5 }), armor: A("heavy", "steel"), weapons: [W("defender", "heavy", "steel", { primary: true })], foci: FO("rod"), shroud: FO("bastion") }
    ]
  },
  {
    id: "warden", name: "Sim Warden", role: "support", note: "Support: Magic (Shields, Burden, Repulsion) or Martial (a Heavy Defender to Block for allies, a Heavy Weighted).",
    stats: { grasp: 35, con: 30, reach: 10, build: 15 },
    loadouts: [
      { label: "Magic", trees: MAG(1, { [PRO]: 5, [GRA]: 4, [SLA]: 2 }), armor: A("medium", "hardLeather"), weapons: [], foci: FO("scepter"), shroud: FO("bastion") },
      { label: "Martial", stats: { str: 35, con: 35, dex: 20 }, trees: T2({ [DEF]: 5, [STR]: 4 }), armor: A("medium", "hardLeather"), weapons: [W("weighted", "heavy", "iron", { primary: true }), W("defender", "heavy", "steel")] }
    ]
  },
  {
    id: "duelist", name: "Sim Duelist", role: "melee-dex", note: "Dexterity melee: Martial (two Light weapons, Bladed and Swift) or a spellblade (Light Bladed with Flame from a Wand).",
    stats: { dex: 45, con: 30, will: 15 },
    loadouts: [
      { label: "Martial", trees: T({ [BLA]: 5, [SWI]: 4 }), armor: A("medium", "hardLeather"), weapons: [W("bladed", "light", "steel", { primary: true }), W("swift", "light", "steel")] },
      { label: "Hybrid", stats: { dex: 30, grasp: 30, con: 30 }, trees: MIX(1, 2, { [BLA]: 5, [HEA]: 4 }), armor: A("medium", "hardLeather"), weapons: [W("bladed", "light", "steel", { primary: true })], foci: FO("wand"), shroud: FO("cinder") }
    ]
  },
  {
    id: "breaker", name: "Sim Breaker", role: "melee-str", note: "Heavy hitter: Magic (Heat and Reach Arcana from a Tome) or a hybrid (a Heavy Weighted with Gravity from a Rod in the other hand).",
    stats: { reach: 45, con: 30, build: 15 },
    loadouts: [
      { label: "Magic", role: "caster", trees: MAG(2, { [HEA]: 5, [RCH2]: 4 }), armor: A("medium", "softLeather"), weapons: [], foci: FO("tome", { twoHanded: true }), shroud: FO("bastion") },
      { label: "Hybrid", stats: { str: 35, grasp: 25, con: 30 }, trees: MIX(2, 1, { [WEI]: 5, [GRA]: 4 }), armor: A("medium", "hide"), weapons: [W("weighted", "heavy", "iron", { primary: true })], foci: FO("rod"), shroud: FO("bastion") }
    ]
  },
  {
    id: "marksman", name: "Sim Marksman", role: "ranged", note: "Ranged: Martial (a Light Assault with Striker) or a pure Arcanomancer (Strike).",
    stats: { dex: 45, con: 25, str: 10, will: 10 },
    loadouts: [
      { label: "Martial", trees: T2({ [ASL]: 5, [STK]: 4 }), armor: A("light", "softLeather"), weapons: [W("assault", "light", "steel", { primary: true }), W("striker", "light", "steel")] },
      { label: "Magic", role: "caster", stats: { grasp: 45, con: 30, build: 15 }, trees: MAG(5, { [ARC]: 5 }), armor: A("light", "softLeather"), weapons: [], foci: FO("rod"), shroud: FO("lattice") }
    ]
  }
];

// Party B: the three groups, each as all Martial, all Magic and mixed. Martial monsters get Martial trees for their weapons now (they had none in the
// Martial passes); the Magic groups are the Magic passes' own (Swarm from T1, Raiders from T2, the Ogre Magus from T5); the mixed groups take half
// of each. Same Skill Points as before (goblins 20, raiders 25, the Ogre 30).
const GOB_MARTIAL = [
  { id: "goblin-hacker", name: "Sim Goblin Hacker", count: 5, size: 3, sp: 20, stats: { str: 50, con: 40, dex: 10 }, trees: T2({ [STK]: 4, [STR]: 3 }),
    armor: A("light", "softLeather"), weapons: [W("striker", "heavy", "iron", { primary: true })] },
  { id: "goblin-lancer", name: "Sim Goblin Lancer", count: 5, size: 3, sp: 20, stats: { dex: 50, con: 40, str: 10 }, trees: T3({ [RCH]: 4, [DEX]: 2 }),
    armor: A("light", "softLeather"), weapons: [W("reach", "light", "hardwood", { primary: true })] }
];
const RAIDERS_MARTIAL = [
  { id: "raider-brute", name: "Sim Raider Brute", count: 1, size: 3, sp: 25, natural: false, stats: { str: 60, con: 50, will: 15 }, trees: T2({ [SWI]: 5, [HVY]: 3 }),
    armor: A("heavy", "iron"), weapons: [W("swift", "heavy", "steel", { primary: true, twoHanded: true })] },
  { id: "raider-cutter", name: "Sim Raider Cutter", count: 1, size: 3, sp: 25, natural: false, stats: { str: 60, con: 50, will: 15 }, trees: T3({ [CIR]: 5, [MED]: 2 }),
    armor: A("medium", "hide"), weapons: [W("circular", "heavy", "steel", { primary: true }), W("thrasher", "light", "hardwood")] },
  { id: "raider-gunner", name: "Sim Raider Gunner", count: 1, size: 3, sp: 25, natural: false, stats: { str: 60, con: 50, dex: 15 }, trees: T({ [RAP]: 5, [MED]: 3 }),
    armor: A("medium", "softLeather"), weapons: [W("rapid", "heavy", "steel", { primary: true })] },
  { id: "raider-sniper", name: "Sim Raider Sniper", count: 1, size: 3, sp: 25, natural: false, stats: { str: 60, con: 50, dex: 15 }, trees: T4({ [LNG]: 5 }),
    armor: A("light", "softLeather"), weapons: [W("longshot", "heavy", "steel", { primary: true })] },
  { id: "raider-bomber", name: "Sim Raider Bomber", count: 1, size: 3, sp: 25, natural: false, stats: { str: 60, con: 50, dex: 15 }, trees: T2({ [ASL]: 5, [MED]: 3 }),
    armor: A("medium", "hide"), weapons: [W("assault", "heavy", "steel", { primary: true })] }
];
const OGRE_MARTIAL = { id: "ogre", name: "Sim Ogre Tyrant", count: 1, size: 4, sp: 30, stats: { str: 110, con: 120, dex: 30, will: 40 }, trees: T2({ [WEI]: 5, [STR]: 4 }),
  armor: A("heavy", "iron"), weapons: [W("weighted", "heavy", "iron", { primary: true }), W("striker", "light", "steel")] };
const OGRE_MIXED = { id: "ogre-warlock", name: "Sim Ogre Warlock", count: 1, size: 4, sp: 30, stats: { str: 90, con: 110, grasp: 60, will: 40 }, trees: MIX(2, 2, { [WEI]: 4, [HEA]: 4 }),
  focus: "magic-heat:flame", armor: A("heavy", "iron"), weapons: [W("weighted", "heavy", "iron", { primary: true })], foci: FO("rod"), shroud: FO("carapace") };
const pick = (kinds, counts) => kinds.filter(k => counts[k.id]).map(k => ({ ...k, count: counts[k.id] }));
export const MONSTERS_MIX = {
  "swarm-martial": { label: "Swarm (Martial)", note: "Ten goblins with Martial trees: five Heavy Striker hackers, five Light Reach lancers.", kinds: GOB_MARTIAL },
  "swarm-magic": { label: "Swarm (Magic)", note: MONSTERS_M1.swarm.note, kinds: MONSTERS_M1.swarm.kinds },
  "swarm-mixed": { label: "Swarm (mixed)", note: "Five Martial goblins and five T1 casters.",
    kinds: [...pick(GOB_MARTIAL, { "goblin-hacker": 3, "goblin-lancer": 2 }), ...pick(MONSTERS_M1.swarm.kinds, { "goblin-cutter": 2, "goblin-stabber": 1, "goblin-basher": 1, "goblin-pusher": 1 })] },
  "raiders-martial": { label: "Raiders (Martial)", note: "The five Martial raiders, now with trees for their weapons.", kinds: RAIDERS_MARTIAL },
  "raiders-magic": { label: "Raiders (Magic)", note: MONSTERS_M2.raiders.note, kinds: MONSTERS_M2.raiders.kinds },
  "raiders-mixed": { label: "Raiders (mixed)", note: "The Brute and the Cutter with three T2 casters (Pyro, Storm, Froster).",
    kinds: [...pick(RAIDERS_MARTIAL, { "raider-brute": 1, "raider-cutter": 1 }), ...pick(MONSTERS_M2.raiders.kinds, { "raider-pyro": 1, "raider-storm": 1, "raider-froster": 1 })] },
  "boss-martial": { label: "Boss (Martial)", note: "The Ogre Tyrant with Weighted T5 and Strength T4.", kinds: [OGRE_MARTIAL] },
  "boss-magic": { label: "Boss (Magic)", note: MONSTERS_M5.boss.note, kinds: MONSTERS_M5.boss.kinds },
  "boss-mixed": { label: "Boss (mixed)", note: "An Ogre Warlock: a natural Heavy Weighted (Weighted T4) and Flame from a natural Rod (Heat T4).", kinds: [OGRE_MIXED] }
};
PASSES["magic-vs-martial"] = { id: "magic-vs-martial", note: "Magic vs Martial: the party in two rotations (a Martial frontline with Magic behind; mostly hybrids) against every group as all Martial, all Magic and mixed.",
  party: PARTY_MIX, monsters: MONSTERS_MIX, encounters: encountersFor(MONSTERS_MIX, 2) };
// The hybrid rotation again, once hybrids choose weapon or spell by expected damage per AP each action (they used to cast one damage spell first).
PASSES["magic-vs-martial-hybrid"] = { ...PASSES["magic-vs-martial"], id: "magic-vs-martial-hybrid", note: "Magic vs Martial, the hybrid rotation only, with hybrids choosing weapon or spell by value.",
  encounters: PASSES["magic-vs-martial"].encounters.filter(e => e.rotation === 1) };

// The hybrids rebuilt around Weaving (Magic Theory T3: a weapon attack carries a spell of the same AP for no extra AP). Light weapons (2 AP) weave
// through an Igniter Foci (2 AP: Wand), Heavy ones (3 AP) through a Channeler (3 AP: an Orb, cast from Reach). Each weaves a damage Core.
const WEAVE_LOADOUTS = {
  bulwark: { label: "Hybrid", stats: { con: 40, str: 30, reach: 20 }, trees: MIX(2, 3, { [HVY]: 4, [PRO]: 3, [CRU]: 2 }), armor: A("heavy", "steel"),
    weapons: [W("defender", "heavy", "steel", { primary: true })], foci: FO("orb"), shroud: FO("bastion") },
  duelist: { label: "Hybrid", stats: { dex: 30, grasp: 30, con: 30 }, trees: MIX(1, 3, { [BLA]: 5, [HEA]: 3 }), armor: A("medium", "hardLeather"),
    weapons: [W("bladed", "light", "steel", { primary: true })], foci: FO("wand"), shroud: FO("cinder") },
  breaker: { label: "Hybrid", stats: { str: 35, reach: 25, con: 30 }, trees: MIX(2, 3, { [WEI]: 4, [CRU]: 4 }), armor: A("medium", "hide"),
    weapons: [W("weighted", "heavy", "iron", { primary: true })], foci: FO("orb"), shroud: FO("bastion") }
};
export const PARTY_MIX_WEAVE = PARTY_MIX.map(p => (WEAVE_LOADOUTS[p.id] ? { ...p, loadouts: [p.loadouts[0], WEAVE_LOADOUTS[p.id]] } : p));
PASSES["magic-vs-martial-weave"] = { ...PASSES["magic-vs-martial"], id: "magic-vs-martial-weave", party: PARTY_MIX_WEAVE,
  note: "Magic vs Martial, the hybrid rotation with the hybrids rebuilt around Weaving (Magic Theory T3).",
  encounters: PASSES["magic-vs-martial"].encounters.filter(e => e.rotation === 1) };

// Ran with a prototype (since replaced by the joined-Weaving rule): the woven spell's damage joined the weapon hit (one soak; the weapon's type; no riders).
PASSES["magic-vs-martial-weave-join"] = { ...PASSES["magic-vs-martial-weave"], id: "magic-vs-martial-weave-join",
  note: "Magic vs Martial, the Weaving hybrids, with the woven spell's damage joining the weapon hit (prototype)." };

// The Weaving hybrids at Magic Theory T5 (Webmaster: woven spells get Threshold Reduction, so they cost less Energy), with the joined-damage
// prototype. Magic Theory T5 is 15 SP, so the Martial side and the damage school are smaller.
const WEAVE5_LOADOUTS = {
  bulwark: { label: "Hybrid", stats: { con: 40, str: 30, reach: 20 }, trees: MIX(2, 5, { [HVY]: 4, [PRO]: 1, [CRU]: 1 }), armor: A("heavy", "steel"),
    weapons: [W("defender", "heavy", "steel", { primary: true })], foci: FO("orb"), shroud: FO("bastion") },
  duelist: { label: "Hybrid", stats: { dex: 30, grasp: 30, con: 30 }, trees: MIX(1, 5, { [BLA]: 4, [HEA]: 2 }), armor: A("medium", "hardLeather"),
    weapons: [W("bladed", "light", "steel", { primary: true })], foci: FO("wand"), shroud: FO("cinder") },
  breaker: { label: "Hybrid", stats: { str: 35, reach: 25, con: 30 }, trees: MIX(2, 5, { [WEI]: 4, [CRU]: 1 }), armor: A("medium", "hide"),
    weapons: [W("weighted", "heavy", "iron", { primary: true })], foci: FO("orb"), shroud: FO("bastion") }
};
PASSES["magic-vs-martial-weave5"] = { ...PASSES["magic-vs-martial-weave-join"], id: "magic-vs-martial-weave5",
  party: PARTY_MIX.map(p => (WEAVE5_LOADOUTS[p.id] ? { ...p, loadouts: [p.loadouts[0], WEAVE5_LOADOUTS[p.id]] } : p)),
  note: "Magic vs Martial, the hybrids at Magic Theory T5 (Webmaster) with the joined-damage prototype." };

// The joined-Weaving rule (Magic doc) with Fused Foci (Equipment doc): the T5 hybrids fuse their Foci into the primary weapon, so the duelist
// gets its off-hand Swift back (Fast follow-ups), and the woven spell keeps its own type and riders while sharing the hit's Limit.
const WOVEN_LOADOUTS = {
  bulwark: { ...WEAVE5_LOADOUTS.bulwark, foci: FO("orb", { fuse: true }) },
  duelist: { ...WEAVE5_LOADOUTS.duelist, weapons: [W("bladed", "light", "steel", { primary: true }), W("swift", "light", "steel")], foci: FO("wand", { fuse: true }) },
  breaker: { ...WEAVE5_LOADOUTS.breaker, foci: FO("orb", { fuse: true }) }
};
PASSES["magic-vs-martial-woven"] = { ...PASSES["magic-vs-martial-weave"], id: "magic-vs-martial-woven",
  party: PARTY_MIX.map(p => (WOVEN_LOADOUTS[p.id] ? { ...p, loadouts: [p.loadouts[0], WOVEN_LOADOUTS[p.id]] } : p)),
  note: "Magic vs Martial, the T5 hybrids with the joined-Weaving rule and Fused Foci (the duelist's off-hand Swift is back)." };

// The Magic vs Martial pass again, with ranged characters and casters starting on a back line and monsters spreading their shots and spells (they
// all used to shoot the lowest-HP character). Rotation 2 is the woven hybrids (joined Weaving, Fused Foci). Rotation 3 is rotation 1 with a pure
// Magic tank in place of the Martial Bulwark: Constitution and Build (HP and the Shroud), Shields and Gravity from a Scepter, a Keystone Shroud.
const MAGIC_TANK = { label: "Magic", stats: { con: 40, build: 30, grasp: 20 }, trees: MAG(1, { [PRO]: 5, [GRA]: 4, [CRU]: 2 }), armor: A("medium", "hardLeather"),
  weapons: [], foci: FO("scepter"), shroud: FO("keystone") };
export const PARTY_MIX3 = PARTY_MIX.map(p => ({ ...p,
  loadouts: [p.loadouts[0], WOVEN_LOADOUTS[p.id] ?? p.loadouts[1], p.id === "bulwark" ? MAGIC_TANK : p.loadouts[0]] }));
PASSES["magic-vs-martial-2"] = { id: "magic-vs-martial-2", party: PARTY_MIX3, monsters: MONSTERS_MIX, encounters: encountersFor(MONSTERS_MIX, 3), backLine: true, spreadTargets: true,
  note: "Magic vs Martial with a back line and spread monster targeting: (1) Martial front, Magic behind; (2) the woven hybrids; (3) as (1) with a Magic tank." };

// Balance fixes under test (the hidden `balanceTest` setting, module/balance-test.mjs), on the magic-vs-martial-2 setup. Rotation 1 and 3 carry the
// Martial Marksman (Assault), rotation 2 the Arcanomancer (Strike), rotation 3 the Magic tank.
// (A) rule tweaks: Light Assault d12, Strike 2d8, Shrouds ×2 Durability and Limit.
PASSES["balance-a"] = { ...PASSES["magic-vs-martial-2"], id: "balance-a", settings: { balanceTest: "assaultD12,strike2d8,shroudX2" },
  note: "Balance test A: Light Assault d12, Strike 2d8, Shrouds ×2 (Durability and Limit)." };
// (B) Strike is Ranged (no half stealth); the Marksman holds its Assault alone with 2 shots a reload (so Solitary fires); the Magic tank wears Heavy armor.
const SOLO_ASSAULT = { label: "Martial", trees: T2({ [ASL]: 5, [STK]: 4 }), armor: A("light", "softLeather"), weapons: [W("assault", "light", "steel", { primary: true, magazine: 2 })] };
const HEAVY_MAGIC_TANK = { ...MAGIC_TANK, armor: A("heavy", "steel") };
PASSES["balance-b"] = { ...PASSES["magic-vs-martial-2"], id: "balance-b", settings: { balanceTest: "strikeRanged" },
  party: PARTY_MIX3.map(p => p.id === "marksman" ? { ...p, loadouts: [SOLO_ASSAULT, p.loadouts[1], SOLO_ASSAULT] }
    : p.id === "bulwark" ? { ...p, loadouts: [p.loadouts[0], p.loadouts[1], HEAVY_MAGIC_TANK] } : p),
  note: "Balance test B: Strike Ranged; a lone Light Assault with 2 shots a reload (Solitary); the Magic tank in Heavy armor." };

// (C) the combined fixes: Light Assault d12 held alone with 2 shots a reload (Solitary), Strike 2d8 and Ranged. Rotation 3's tank is a Magic tank
// on its Shroud alone: no armor, a Keystone with four Defensive Affixes (Jasper doubled, Obsidian, Black Opal, Diamond), against rotation 1's
// Martial Bulwark in Heavy armor.
const SHROUD_TANK = { ...MAGIC_TANK, label: "Shroud", armor: null, shroud: FO("keystone", { doubled: "jasper" }), affixes: ["jasper", "obsidian", "blackOpal", "diamond"] };
PASSES["balance-c"] = { ...PASSES["magic-vs-martial-2"], id: "balance-c", settings: { balanceTest: "assaultD12,strike2d8,strikeRanged" },
  party: PARTY_MIX3.map(p => p.id === "marksman" ? { ...p, loadouts: [SOLO_ASSAULT, p.loadouts[1], SOLO_ASSAULT] }
    : p.id === "bulwark" ? { ...p, loadouts: [p.loadouts[0], p.loadouts[1], SHROUD_TANK] } : p),
  note: "Balance test C: Light Assault d12 alone with 2 shots a reload, Strike 2d8 and Ranged; a Shroud-only Magic tank with four Defensive Affixes." };
// (D) Shrouds adjusted as a whole (their scaled Durability and Limit ×2 or ×3), on top of C's fixes; rotation 3 only (the Shroud-only tank).
for (const x of [2, 3]) PASSES[`balance-d${x}`] = { ...PASSES["balance-c"], id: `balance-d${x}`, settings: { balanceTest: `assaultD12,strike2d8,strikeRanged,shroudX${x}` },
  encounters: PASSES["balance-c"].encounters.filter(e => e.rotation === 2), note: `Balance test D: C's fixes with Shrouds ×${x}, the Shroud-only tank's rotation.` };
// (E) Shrouds ×1.5: pure Shroud (rotation 3's Shroud-only Magic tank) against pure armor (rotation 1's Martial Heavy-armor tank), no hybrids.
PASSES["balance-e"] = { ...PASSES["balance-c"], id: "balance-e", settings: { balanceTest: "assaultD12,strike2d8,strikeRanged,shroudX1.5" },
  encounters: PASSES["balance-c"].encounters.filter(e => e.rotation !== 1), note: "Balance test E: C's fixes with Shrouds ×1.5; the Martial Heavy-armor tank vs the Shroud-only tank." };

// Tank bench: the tank alone against each Magic vs Martial monster group, so every monster attacks it (8 rounds at most). Heavy armor (the Martial
// Bulwark) against the Shroud-only Magic tank at Shrouds ×1, ×1.5 and ×2. Same fixes as pass C for everything else.
const BENCH_TANK = (id, loadout, x) => ({ id, party: [{ ...PARTY_MIX[0], loadouts: [loadout] }], monsters: MONSTERS_MIX, encounters: encountersFor(MONSTERS_MIX, 1),
  maxRounds: 8, backLine: true, spreadTargets: true, settings: { balanceTest: `assaultD12,strike2d8,strikeRanged${x ? `,shroudX${x}` : ""}` },
  note: `Tank bench: ${loadout.label} tank alone against every group${x ? ` (Shrouds ×${x})` : ""}.` });
PASSES["tank-armor"] = BENCH_TANK("tank-armor", PARTY_MIX[0].loadouts[0], null);
for (const [id, x] of [["tank-shroud1", 1], ["tank-shroud15", 1.5], ["tank-shroud2", 2]]) PASSES[id] = BENCH_TANK(id, SHROUD_TANK, x);
for (const [id, x] of [["tank-shroud25", 2.5], ["tank-shroud3", 3]]) PASSES[id] = BENCH_TANK(id, SHROUD_TANK, x);

// The Shroud-only tank rebuilt around Build Arcana (the Magic counterpart of the Heavy Armor tree): Magic Theory T4, Build Arcana T4 (Layered and
// Reactive Shields, Seep, Reform, Shroud Master), Protection Arcana T3 (Shield, Reflect, Adjust) and Crushing T2 (Slam): 29 Skill Points.
const BUILD_TANK = { ...SHROUD_TANK, label: "Build", trees: MAG(4, { "magic-build-arcana": 4, [PRO]: 3, [CRU]: 2 }) };
for (const [id, x] of [["tank-build1", 1], ["tank-build2", 2], ["tank-build3", 3]]) PASSES[id] = BENCH_TANK(id, BUILD_TANK, x);
// The tank benches again with the damage cards kept (`cardLog`), to see what the Shield, the Shroud, its Affixes and armor absorb.
PASSES["tank-cards-armor"] = { ...PASSES["tank-armor"], id: "tank-cards-armor", cardLog: true };
PASSES["tank-cards-build2"] = { ...PASSES["tank-build2"], id: "tank-cards-build2", cardLog: true };
// The Build tank at Shrouds ×2 with Reactive also working on its own Shroud (balance test `reactiveShroud`).
PASSES["tank-build2-react"] = { ...BENCH_TANK("tank-build2-react", BUILD_TANK, 2), cardLog: true, settings: { balanceTest: "assaultD12,strike2d8,strikeRanged,shroudX2,reactiveShroud" } };

// The confirming pass on the adopted rules (v0.83: Light Assault d12 and 2 shots a reload, Strike 2d8 Ranged, Shrouds doubled, Reactive on your own
// Shroud, Arcane meeting Shrouds at full strength). The user's guidance: armor is for Martial builds only, so pure Magic builds wear none and put their
// defense in Build (the Shroud); hybrids split 30/30/30 and pick one defense: Constitution and armor, or Build and a Shroud (not both).
const noArmor = (l, stats) => ({ ...l, armor: null, stats });
const MAGIC3 = {
  warden: noArmor(PARTY_MIX.find(p => p.id === "warden").loadouts[0], { grasp: 35, build: 30, reach: 10, con: 15 }),
  breaker: noArmor(PARTY_MIX.find(p => p.id === "breaker").loadouts[0], { reach: 45, build: 30, con: 15 }),
  marksman: noArmor(PARTY_MIX.find(p => p.id === "marksman").loadouts[1], { grasp: 45, build: 30, con: 15 })
};
const HYBRID3 = {
  bulwark: { ...WOVEN_LOADOUTS.bulwark, stats: { str: 30, reach: 30, con: 30 }, shroud: null },                                   // Constitution and Heavy armor
  duelist: { ...WOVEN_LOADOUTS.duelist, stats: { dex: 30, grasp: 30, build: 30 }, armor: null },                                  // Build and its Shroud
  breaker: { ...WOVEN_LOADOUTS.breaker, stats: { str: 30, reach: 30, con: 30 }, shroud: null }                                    // Constitution and Medium armor
};
const TANK3 = { ...BUILD_TANK, stats: { build: 40, con: 30, grasp: 20 } };
const r1of = p => (p.id === "marksman" ? SOLO_ASSAULT : MAGIC3[p.id] && p.loadouts[0].label === "Magic" ? MAGIC3[p.id] : p.loadouts[0]);
export const PARTY_MIX4 = PARTY_MIX.map(p => {
  const r1 = r1of(p);
  const r2 = p.id === "marksman" ? MAGIC3.marksman : HYBRID3[p.id] ?? (p.loadouts[1].label === "Magic" ? MAGIC3[p.id] : p.loadouts[1]);
  return { ...p, loadouts: [r1, r2, p.id === "bulwark" ? TANK3 : r1] };
});
PASSES["magic-vs-martial-3"] = { id: "magic-vs-martial-3", party: PARTY_MIX4, monsters: MONSTERS_MIX, encounters: encountersFor(MONSTERS_MIX, 3), backLine: true, spreadTargets: true,
  note: "Magic vs Martial on the adopted rules (v0.83): Magic builds without armor (Build and Shrouds), hybrids with one defense, a Build Arcana Shroud tank in rotation 3." };

// Magic-only school benchmark against Shroud users (the user's ask: armor is for Martial sims; see how Arcane fares against something built against
// it). The caster wears no armor (Build for its Bastion); the three raiders swap their armor for Build and a Shroud (Keystone, Bastion, Carapace) and
// keep their Heavy weapons for the punching bag. Shrouds are fully magical: Arcane meets them at full strength, only what gets past is Weakened.
const SHROUD_RAIDERS = { raiders: { ...BENCH_RAIDERS.raiders, note: "The benchmark's three raiders with Build and a Shroud instead of armor.",
  kinds: BENCH_RAIDERS.raiders.kinds.map((k, i) => ({ ...k, stats: { str: 60, build: 50, will: 15 }, armor: null, shroud: FO(["keystone", "bastion", "carapace"][i]) })) } };
const PARTY_MBENCH_SHROUD = [{ ...PARTY_MBENCH[0], stats: { grasp: 45, build: 30, con: 15 }, loadouts: PARTY_MBENCH[0].loadouts.map(l => ({ ...l, armor: null })) }, PARTY_MBENCH[1]];
PASSES["magic-bench-shroud"] = { id: "magic-bench-shroud", note: "School benchmark, Magic only: an unarmored caster against three raiders protected by Shrouds (no armor), 4 rounds, two fights each.",
  party: PARTY_MBENCH_SHROUD, monsters: SHROUD_RAIDERS, deploy: "magicbench", maxRounds: 4,
  encounters: BENCH_SCHOOLS.flatMap(([id], rotation) => [1, 2].map(rep => ({ id: `${id}-${rep}`, group: "raiders", rotation }))) };

/* -------------------------------------------- */
/*  Mental passes: tier by tier                   */
/* -------------------------------------------- */

// The user's setup (26 Oct 2026): Mental only, same-tier Mental monsters, no prep. Everyone has Mental Theory T5 from the start (15 SP); the Wonder trees
// are the pass's tier group only. No armor (that's Martial): Mental defense is the Icon's Ward and HP. Alignment matches the Wonder's kind (Dream /
// Nightmare), deeper the tankier the build (tank 3, middle 2, damage 1). `mind` is the AI's priority list: "ward" (activate a shielding Ward), then
// Modes as "<mode id>@<target>" (target: weakest, strongest, nearest foe; threatened, hurt ally; self), "+" to Enhance when the Energy allows.
const MT = (o) => ({ "mental-theory": 5, ...o });
const LIFE = "mental-life-dream", DEATH = "mental-death-nightmare", ORDER = "mental-order-dream", CHAOS = "mental-chaos-nightmare", BEYOND = "mental-beyond-dream", BELOW = "mental-below-nightmare";
const ICON = (form, tenet) => ({ form, tenet });
const AL = (kind, level) => ({ kind, level });
export const PARTY_MENTAL1 = [
  { id: "warden", name: "Sim Warden", role: "tank", note: "Tank: Life T4 and Order T2, an Aegis Icon (Verdant Soul), Dream 3.", stats: { will: 40, con: 30, pon: 25 },
    loadouts: [{ label: "Life/Order", trees: MT({ [LIFE]: 4, [ORDER]: 2 }), armor: null, weapons: [], icon: ICON("aegis", `${LIFE}:verdant-soul`), alignment: AL("dream", 3),
      mind: ["ward", `${LIFE}:bloom@threatened`, `${ORDER}:decree@strongest`, `${LIFE}:flourish@self`] }] },
  { id: "mender", name: "Sim Mender", role: "support", note: "Healer: Life T5 (Bloom, Flourish, Renewal), a Sanctum Icon (Verdant Soul), Dream 2.", stats: { pon: 45, will: 25, con: 20 },
    loadouts: [{ label: "Life", trees: MT({ [LIFE]: 5 }), armor: null, weapons: [], icon: ICON("sanctum", `${LIFE}:verdant-soul`), alignment: AL("dream", 2),
      mind: [`${LIFE}:renewal@hurt`, `${LIFE}:bloom@threatened`, `${LIFE}:flourish@threatened`, "ward"] }] },
  { id: "reaper", name: "Sim Reaper", role: "caster", note: "Damage: Death T5 (Wither, Waste, Execute), a Veil Icon (Mortal Coil), Nightmare 1.", stats: { snap: 45, con: 25, will: 20 },
    loadouts: [{ label: "Death", trees: MT({ [DEATH]: 5 }), armor: null, weapons: [], icon: ICON("veil", `${DEATH}:mortal-coil`), alignment: AL("nightmare", 1),
      mind: [`${DEATH}:wither+@weakest`, `${DEATH}:waste@strongest`] }] },
  { id: "binder", name: "Sim Binder", role: "caster", note: "Control: Below T4 (Sink, Burden) and Chaos T2 (Fracture), a Warden Icon (Weight), Nightmare 2.", stats: { snap: 45, will: 25, con: 20 },
    loadouts: [{ label: "Below/Chaos", trees: MT({ [BELOW]: 4, [CHAOS]: 2 }), armor: null, weapons: [], icon: ICON("warden", `${BELOW}:weight`), alignment: AL("nightmare", 2),
      mind: [`${BELOW}:burden@strongest`, `${BELOW}:sink@nearest`, `${CHAOS}:fracture@strongest`] }] },
  { id: "herald", name: "Sim Herald", role: "caster", note: "Force: Beyond T4 (Herald, Redirect) and Order T2 (Decree), an Aegis Icon (Gust), Dream 1.", stats: { pon: 45, con: 25, will: 20 },
    loadouts: [{ label: "Beyond/Order", trees: MT({ [BEYOND]: 4, [ORDER]: 2 }), armor: null, weapons: [], icon: ICON("aegis", `${BEYOND}:gust`), alignment: AL("dream", 1),
      mind: [`${BEYOND}:herald@nearest`, `${ORDER}:decree@strongest`] }] }
];
export const MONSTERS_MENTAL1 = {
  swarm: {
    label: "Swarm", note: "Ten goblin mystics (20 Skill Points: Mental Theory T5 and a T1 Wonder at T2 with another at T1): Witherers and Sinkers.",
    kinds: [
      { id: "goblin-witherer", name: "Sim Goblin Witherer", count: 5, size: 3, sp: 20, stats: { snap: 45, con: 35, will: 20 }, trees: MT({ [DEATH]: 2, [CHAOS]: 1 }), armor: null, weapons: [],
        icon: ICON("veil", `${DEATH}:mortal-coil`), alignment: AL("nightmare", 1), mind: [`${DEATH}:wither@weakest`, `${CHAOS}:fracture@strongest`] },
      { id: "goblin-sinker", name: "Sim Goblin Sinker", count: 5, size: 3, sp: 20, stats: { snap: 45, con: 35, will: 20 }, trees: MT({ [BELOW]: 2, [DEATH]: 1 }), armor: null, weapons: [],
        icon: ICON("warden", `${BELOW}:weight`), alignment: AL("nightmare", 1), mind: [`${BELOW}:sink@nearest`, `${DEATH}:wither@weakest`] }
    ]
  },
  raiders: {
    label: "Raiders", note: "Five mystic raiders (25 Skill Points: Mental Theory T5 and one T1 Wonder at T4), Nightmare and Dream.",
    kinds: [
      { id: "raider-reaper", name: "Sim Raider Reaper", count: 1, size: 3, sp: 25, stats: { snap: 55, con: 50, will: 20 }, trees: MT({ [DEATH]: 4 }), armor: null, weapons: [],
        icon: ICON("veil", `${DEATH}:mortal-coil`), alignment: AL("nightmare", 1), mind: [`${DEATH}:wither+@weakest`, `${DEATH}:waste@strongest`] },
      { id: "raider-binder", name: "Sim Raider Binder", count: 1, size: 3, sp: 25, stats: { snap: 55, con: 50, will: 20 }, trees: MT({ [BELOW]: 4 }), armor: null, weapons: [],
        icon: ICON("warden", `${BELOW}:weight`), alignment: AL("nightmare", 2), mind: [`${BELOW}:burden@strongest`, `${BELOW}:sink@nearest`] },
      { id: "raider-trickster", name: "Sim Raider Trickster", count: 1, size: 3, sp: 25, stats: { snap: 55, con: 50, will: 20 }, trees: MT({ [CHAOS]: 4 }), armor: null, weapons: [],
        icon: ICON("veil", `${CHAOS}:unbound`), alignment: AL("nightmare", 1), mind: [`${CHAOS}:fracture@strongest`, `${CHAOS}:larceny@strongest`] },
      { id: "raider-pusher", name: "Sim Raider Pusher", count: 1, size: 3, sp: 25, stats: { pon: 55, con: 50, will: 20 }, trees: MT({ [BEYOND]: 4 }), armor: null, weapons: [],
        icon: ICON("aegis", `${BEYOND}:gust`), alignment: AL("dream", 1), mind: [`${BEYOND}:herald@nearest`] },
      { id: "raider-tender", name: "Sim Raider Tender", count: 1, size: 3, sp: 25, role: "support", stats: { pon: 55, con: 50, will: 20 }, trees: MT({ [LIFE]: 4 }), armor: null, weapons: [],
        icon: ICON("sanctum", `${LIFE}:verdant-soul`), alignment: AL("dream", 2), mind: [`${LIFE}:bloom@threatened`, `${LIFE}:flourish@threatened`] }
    ]
  },
  boss: {
    label: "Boss", note: "An Ogre Dreadmind (Size 4, 30 Skill Points: Mental Theory T5 and Death T5), a natural Riposte Icon, Nightmare 3.",
    kinds: [{ id: "ogre-dreadmind", name: "Sim Ogre Dreadmind", count: 1, size: 4, sp: 30, stats: { con: 110, snap: 80, will: 40 }, trees: MT({ [DEATH]: 5 }), armor: null, weapons: [],
      icon: ICON("riposte", `${DEATH}:mortal-coil`), alignment: AL("nightmare", 3), mind: [`${DEATH}:wither+@weakest`, `${DEATH}:waste@strongest`, `${DEATH}:execute@weakest`] }]
  }
};
PASSES["mental-t1"] = { id: "mental-t1", note: "Mental T1 Wonders (Life, Death, Order, Chaos, Beyond, Below); Mental Theory T5 for everyone; Mental monsters of the same Wonders.",
  party: PARTY_MENTAL1, monsters: MONSTERS_MENTAL1, encounters: encountersFor(MONSTERS_MENTAL1, 1), backLine: true, spreadTargets: true };
// T1 again once the AI presses Vice / Quicksand / Momentum and drives Beyond's Force straight down, with every damage card kept for a breakdown.
PASSES["mental-t1b"] = { ...PASSES["mental-t1"], id: "mental-t1b", cardLog: "all" };
// T1 once Modes on foes repeat while AP lasts (they were once a turn).
PASSES["mental-t1c"] = { ...PASSES["mental-t1b"], id: "mental-t1c" };

// Mental T1 against mixed enemy groups (the user's ask): each group mixes pure Martial, Magic and Mental builds, from the Magic vs Martial groups and
// the Mental T1 ones. The boss fight is the Mental Ogre with a Martial and a Magic raider beside it.
const pickKind = (groups, group, id, count) => ({ ...groups[group].kinds.find(k => k.id === id), count });
const MONSTERS_MENTAL1_MIX = {
  swarm: { label: "Swarm (mixed)", note: "Ten goblins: 3 Martial Hackers, 2 Magic Cutters and a Stabber, 2 Mental Witherers and 2 Sinkers.",
    kinds: [pickKind(MONSTERS_MIX, "swarm-martial", "goblin-hacker", 3), pickKind(MONSTERS_MIX, "swarm-magic", "goblin-cutter", 2), pickKind(MONSTERS_MIX, "swarm-magic", "goblin-stabber", 1),
      pickKind(MONSTERS_MENTAL1, "swarm", "goblin-witherer", 2), pickKind(MONSTERS_MENTAL1, "swarm", "goblin-sinker", 2)] },
  raiders: { label: "Raiders (mixed)", note: "Five raiders: a Martial Brute and Gunner, a Magic Pyro, a Mental Reaper and Tender.",
    kinds: [pickKind(MONSTERS_MIX, "raiders-martial", "raider-brute", 1), pickKind(MONSTERS_MIX, "raiders-martial", "raider-gunner", 1), pickKind(MONSTERS_MIX, "raiders-magic", "raider-pyro", 1),
      pickKind(MONSTERS_MENTAL1, "raiders", "raider-reaper", 1), pickKind(MONSTERS_MENTAL1, "raiders", "raider-tender", 1)] },
  boss: { label: "Boss (mixed)", note: "The Mental Ogre Dreadmind with a Martial Raider Brute and a Magic Raider Pyro beside it.",
    kinds: [pickKind(MONSTERS_MENTAL1, "boss", "ogre-dreadmind", 1), pickKind(MONSTERS_MIX, "raiders-martial", "raider-brute", 1), pickKind(MONSTERS_MIX, "raiders-magic", "raider-pyro", 1)] }
};
PASSES["mental-t1-mix"] = { ...PASSES["mental-t1c"], id: "mental-t1-mix", monsters: MONSTERS_MENTAL1_MIX, encounters: encountersFor(MONSTERS_MENTAL1_MIX, 1),
  note: "Mental T1 party against mixed enemy groups (pure Martial, Magic and Mental builds together)." };

// Control bench (27 Oct 2026): how much each control tree protects a punching bag from three tree-less raiders over 4 rounds (the Magic school
// bench's layout). The measure is what the raiders deal to the bag and how often they hit; the caster's own damage doesn't count. A baseline
// caster does nothing. Mental T1 trees at T5 (with Mental Theory T5), Life for a defensive reference, and two Magic schools for a cross-Archetype one.
const CB_MENTAL = (id, label, tree, kind, mind, icon) => ({ id, label, role: "support", trees: MT({ [tree]: 5 }), armor: null, weapons: [],
  stats: kind === "dream" ? { pon: 45, will: 25, con: 20 } : { snap: 45, will: 25, con: 20 }, icon, alignment: AL(kind, 1), mind });
const CB_CONFIGS = [
  { id: "baseline", label: "Baseline (does nothing)", role: "support", trees: MT({}), armor: null, weapons: [], stats: { pon: 45, will: 25, con: 20 }, mind: ["none"] },
  CB_MENTAL("below", "Below (Sink, Burden, Entomb)", BELOW, "nightmare", [`${BELOW}:entomb@strongest`, `${BELOW}:burden@strongest`, `${BELOW}:sink@strongest`], ICON("warden", `${BELOW}:weight`)),
  CB_MENTAL("order", "Order (Decree, Mandate, Verdict)", ORDER, "dream", [`${ORDER}:decree@strongest`, `${ORDER}:verdict@strongest`, `${ORDER}:mandate@strongest`], ICON("aegis", `${ORDER}:balance`)),
  CB_MENTAL("chaos", "Chaos (Fracture, Larceny)", CHAOS, "nightmare", [`${CHAOS}:fracture@strongest`, `${CHAOS}:larceny@strongest`], ICON("veil", `${CHAOS}:unbound`)),
  CB_MENTAL("beyond", "Beyond (Herald, Ascend)", BEYOND, "dream", [`${BEYOND}:herald@strongest`], ICON("aegis", `${BEYOND}:gust`)),
  CB_MENTAL("life", "Life (Bloom, Flourish, Renewal) on the bag", LIFE, "dream", [`${LIFE}:bloom@threatened`, `${LIFE}:flourish@threatened`, `${LIFE}:renewal@hurt`], ICON("sanctum", `${LIFE}:verdant-soul`)),
  ...BENCH_SCHOOLS.filter(s => ["protection", "gravity"].includes(s[0])).map(([id, label, trees, role]) => ({ id: `magic-${id}`, label: `Magic: ${label}`, trees, role: role ?? "caster",
    armor: null, weapons: [], foci: FO("rod"), shroud: FO("bastion"), stats: { grasp: 45, build: 30, con: 15 } }))
];
export const PARTY_CBENCH = [
  { id: "caster", name: "Sim Caster", role: "support", note: "One control tree per config.", stats: { pon: 45, will: 25, con: 20 }, loadouts: CB_CONFIGS },
  { ...PARTY_MBENCH[1], loadouts: CB_CONFIGS.map(() => ({ trees: {}, armor: null, weapons: [] })) }
];
PASSES["control-bench"] = { id: "control-bench", note: "Control bench: each control tree protecting a punching bag from three tree-less raiders, 4 rounds, three fights each.",
  party: PARTY_CBENCH, monsters: BENCH_RAIDERS, deploy: "magicbench", maxRounds: 4,
  encounters: CB_CONFIGS.flatMap((c, rotation) => [1, 2, 3].map(rep => ({ id: `${c.id}-${rep}`, group: "raiders", rotation }))) };
// Order again once the AI answers Verdict (a foe's crit becomes a regular hit, an ally's hit a crit) and Balance (the better outcome) instead of accepting every popup.
PASSES["control-bench-order"] = { ...PASSES["control-bench"], id: "control-bench-order", note: "Control bench, Order only, after the Verdict/Balance AI fix: five fights.",
  encounters: [1, 2, 3, 4, 5].map(rep => ({ id: `order-${rep}`, group: "raiders", rotation: CB_CONFIGS.findIndex(c => c.id === "order") })) };

// Assist bench (27 Oct 2026): how much each Mental T1 tree helps allies hit and hurt a target. A support caster (the tree at T5, Mental Theory T5)
// backs three tree-less attackers (Martial, Magic, Mental) against one durable target that only dodges, 4 rounds. The measure is the allies' hit
// rate and damage against a baseline caster who does nothing. Life is left out: its Modes are defensive (Bloom, Flourish, Renewal).
const AB_MENTAL = (id, label, tree, kind, mind, icon, mindChoices = null) => ({ ...CB_MENTAL(id, label, tree, kind, mind, icon), mindChoices });
const AB_CONFIGS = [
  CB_CONFIGS[0],
  AB_MENTAL("order", "Order (Decree on the target, Enhanced Mandate and Verdict on the striker)", ORDER, "dream",
    [`${ORDER}:verdict@ally`, `${ORDER}:mandate+@ally`, `${ORDER}:decree@strongest`], ICON("aegis", `${ORDER}:balance`)),
  AB_MENTAL("chaos", "Chaos (Fracture and Larceny on the target, die size down)", CHAOS, "nightmare",
    [`${CHAOS}:fracture@strongest`, `${CHAOS}:larceny@strongest`], ICON("veil", `${CHAOS}:unbound`)),
  AB_MENTAL("death", "Death (Enhanced Waste and Execute on the target)", DEATH, "nightmare",
    [`${DEATH}:waste+@strongest`, `${DEATH}:execute+@strongest`], ICON("veil", `${DEATH}:mortal-coil`)),
  AB_MENTAL("below", "Below (Burden on dodge rolls, Sink)", BELOW, "nightmare",
    [`${BELOW}:burden@strongest`, `${BELOW}:sink@strongest`], ICON("warden", `${BELOW}:weight`), { "choice:dis": "dodge" }),
  AB_MENTAL("beyond", "Beyond (Herald straight down: prone)", BEYOND, "dream", [`${BEYOND}:herald@strongest`], ICON("aegis", `${BEYOND}:gust`))
];
const AB_SAME = l => AB_CONFIGS.map(() => l);
export const PARTY_ABENCH = [
  { id: "caster", name: "Sim Caster", role: "support", note: "One support tree per config.", stats: { pon: 45, will: 25, con: 20 }, loadouts: AB_CONFIGS },
  { id: "striker", name: "Sim Striker", role: "striker", note: "Martial: a two-handed Heavy Swift steel weapon, no trees.", stats: { str: 60, con: 50, will: 15 },
    loadouts: AB_SAME({ trees: {}, armor: null, weapons: [W("swift", "heavy", "steel", { primary: true, twoHanded: true })] }) },
  { id: "cutter", name: "Sim Cutter", role: "caster", note: "Magic: Cut (Slashing T2) through a Rod.", stats: { grasp: 45, con: 30, build: 15 },
    loadouts: AB_SAME({ trees: { "magic-theory": 1, [SLA]: 2 }, armor: null, weapons: [], foci: FO("rod") }) },
  { id: "witherer", name: "Sim Witherer", role: "caster", note: "Mental: Wither (Death T1), a Veil Icon (Mortal Coil), Nightmare 1.", stats: { snap: 45, con: 25, will: 20 },
    loadouts: AB_SAME({ trees: MT({ [DEATH]: 1 }), armor: null, weapons: [], icon: ICON("veil", `${DEATH}:mortal-coil`), alignment: AL("nightmare", 1), mind: [`${DEATH}:wither@weakest`] }) }
];
const AB_TARGET = { target: { label: "Target", note: "One durable target (30 Skill Points, Con 400, no armor) that only dodges.",
  kinds: [{ id: "bench-target", name: "Sim Target", count: 1, size: 3, sp: 30, natural: false, role: "dummy", stats: { con: 400 }, armor: null, weapons: [] }] } };
PASSES["assist-bench"] = { id: "assist-bench", note: "Assist bench: each Mental T1 tree helping three tree-less allies (Martial, Magic, Mental) hit one durable target, 4 rounds, three fights each.",
  party: PARTY_ABENCH, monsters: AB_TARGET, deploy: "assistbench", maxRounds: 4, cardLog: "all",
  encounters: AB_CONFIGS.flatMap((c, rotation) => [1, 2, 3].map(rep => ({ id: `${c.id}-${rep}`, group: "target", rotation }))) };
// Chaos again once the AI reads Fracture/Larceny reroll options (its text match missed "reroll at 2d12", so no Chaos charge was ever spent) and answers Entropy.
PASSES["assist-bench-chaos"] = { ...PASSES["assist-bench"], id: "assist-bench-chaos", note: "Assist bench, Chaos only, after the Fracture/Larceny/Entropy AI fix.",
  encounters: [1, 2, 3].map(rep => ({ id: `chaos-${rep}`, group: "target", rotation: AB_CONFIGS.findIndex(c => c.id === "chaos") })) };
PASSES["control-bench-chaos"] = { ...PASSES["control-bench"], id: "control-bench-chaos", note: "Control bench, Chaos only, after the Fracture/Larceny/Entropy AI fix.",
  encounters: [1, 2, 3].map(rep => ({ id: `chaos-${rep}`, group: "raiders", rotation: CB_CONFIGS.findIndex(c => c.id === "chaos") })) };
// The same with a target of normal HP (Con 60): Herald's Force takes off a quarter of the target's current HP, so the Con 400 target never moved
// (never knocked prone), and Execute's kill line was out of reach. The fight ends when the target drops; compare per round.
const AB_TARGET_REAL = { target: { ...AB_TARGET.target, note: "One target of normal HP (30 Skill Points, Con 60, no armor) that only dodges.",
  kinds: [{ ...AB_TARGET.target.kinds[0], stats: { con: 60 } }] } };
PASSES["assist-bench-real"] = { ...PASSES["assist-bench"], id: "assist-bench-real", monsters: AB_TARGET_REAL,
  note: "Assist bench against a normal-HP target (Con 60): Baseline, Order, Death, Below and Beyond, three fights each.",
  encounters: ["baseline", "order", "death", "below", "beyond"].flatMap(id => [1, 2, 3].map(rep => ({ id: `${id}-${rep}`, group: "target", rotation: AB_CONFIGS.findIndex(c => c.id === id) }))) };
