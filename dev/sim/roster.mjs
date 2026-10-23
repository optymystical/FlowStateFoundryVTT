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
