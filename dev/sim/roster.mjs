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
