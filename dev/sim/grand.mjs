// The grand balance pass (2026-11-15, the user's overnight ask): every combat tree (Martial, Magic, Mental) featured in a generated build at
// 15 Skill Points (the campaign's start: 45 stat points, a Background's 15 free points, an Ancestry) and at 60 Skill Points (180 stat points, the
// same start). Each build also raises a Generic tree with what's left, and the Ancestries rotate, so those trees ride along.
// Fights: each party of five against another party of the same level (mirrors: ten builds measured per fight), and against a Bestiary group
// (Bloomrots, Gloamhounds, a Burgeon; at 60 a Thicket Herald leads them). Results go to dev/sim/results/grand-<level>[-<n>].json; grand-report.mjs
// tabulates them per featured tree.
import { TREES } from "../../module/trees.mjs";
import * as S from "../../module/skills.mjs";
import * as ABC from "../../module/abc-rules.mjs";
import { WONDERS, FORMS } from "../../module/mental-rules.mjs";
import { bestiaryBuild } from "../../module/bestiary-rules.mjs";

const W = (type, weight, material, o = {}) => ({ type, weight, material, ...o });
const A = (weight, material) => ({ weight, material });

/** Trees a build features: every Martial, Magic and Mental tree but the Theories. */
export const FEATURED = TREES.filter(t => ["martial", "magic", "mental"].includes(t.archetype) && !t.theory).map(t => t.id);
const RIDERS = ["generic-fortitude", "generic-tempo", "generic-courage", "generic-recovery", "generic-stamina", "generic-punish", "generic-composure",
  "generic-mobility", "generic-discipline", "generic-acrobatics", "generic-ambush", "generic-delay", "generic-insight", "generic-athletics", "generic-endurance"];
const BACKGROUND = { martial: "recruit", magic: "apprentice-mage", mental: "novice" };

/* ---------------- Trees within a budget ---------------- */

const cost = t => (t * (t + 1)) / 2;
/** Raise a tree one tier at a time while the Skill Points (past the free tiers) allow and its requirements are met. */
function raise(trees, free, id, to, sp, ctx) {
  const tree = S.treeById(id);
  if (!tree) return;
  while (S.tierOf(trees, id) < to) {
    const next = { ...trees, [id]: S.tierOf(trees, id) + 1 };
    if (!S.isAvailable(trees, tree, ctx) || S.spentPoints(next, free) > sp) return;
    Object.assign(trees, next);
  }
}
/** Open a tree: its Theory (or Generic core) to the tier it needs first, then the tree itself as far as `to`. */
function open(trees, free, id, to, sp, ctx) {
  const tree = S.treeById(id), gate = S.theoryFor?.(tree) ?? S.coreFor?.(tree) ?? null;
  const gateId = typeof gate === "string" ? gate : gate?.id;
  if (gateId && gateId !== id) raise(trees, free, gateId, Math.max(S.tierOf(trees, gateId), tree.requires ?? 0), sp, ctx);
  raise(trees, free, id, to, sp, ctx);
}

/* ---------------- Stats and gear by tree ---------------- */

const DEX_TREES = new Set(["martial-dexterity-methods", "martial-swift-weapons", "martial-rapid-weapons", "martial-circular-weapons", "martial-curved-weapons",
  "martial-blast-weapons", "martial-longshot-weapons", "martial-light-armor", "martial-unarmored", "martial-reach-weapons"]);
const WEAPON_OF = { "martial-bladed-weapons": "bladed", "martial-balanced-weapons": "balanced", "martial-swift-weapons": "swift", "martial-rapid-weapons": "rapid",
  "martial-striker-weapons": "striker", "martial-defender-weapons": "defender", "martial-weighted-weapons": "weighted", "martial-assault-weapons": "assault",
  "martial-reach-weapons": "reach", "martial-circular-weapons": "circular", "martial-blast-weapons": "blast", "martial-curved-weapons": "curved",
  "martial-longshot-weapons": "longshot", "martial-thrasher-weapons": "thrasher" };
const ARMOR_OF = { "martial-medium-armor": A("medium", "hardLeather"), "martial-heavy-armor": A("heavy", "steel"), "martial-light-armor": A("light", "hardLeather"),
  "martial-titanic-armor": A("titanic", "iron"), "martial-unarmored": null };
const RANGED = new Set(["rapid", "assault", "blast", "longshot"]);
/** Magic: the casting stat alternates (Igniter on Grasp, Channeler on Reach); a Shroud on Build. */
const FOCI = { grasp: "wand", reach: "orb" };

/** A Mental build's priority list from its Wonder's Modes: heals and guards on allies, everything else at the weakest foe. */
const MODE_TARGET = { bloom: "threatened", flourish: "threatened", renewal: "hurt", guard: "threatened", absolution: "hurt", "adaptive-skin": "self", "second-wind": "hurt",
  hone: "self", crescendo: "self", ascend: "self", redirect: "self", consecrate: "threatened", accretion: "threatened", cultivate: "self", bloodbond: "ally",
  providence: "ally", windfall: "ally", forge: null, fabricate: null, conjure: null, decree: "strongest", mandate: "strongest", verdict: "strongest", burden: "strongest",
  sink: "nearest", herald: "nearest", undertow: "nearest", riptide: "nearest", drown: "nearest", provoke: "strongest", warzone: "nearest", pacify: "strongest" };
function mindFor(wonderIds, tiers) {
  const out = ["ward"];
  for (const wid of wonderIds) {
    const w = WONDERS.find(x => x.id === wid);
    if (!w) continue;
    const t = tiers[wid] ?? 1;
    for (const [i, m] of w.modes.entries()) {
      if (i >= Math.max(1, Math.ceil(t / 2) + (t >= 5 ? 1 : 0))) break;          // Modes come with the tree's tiers: roughly one per two tiers
      const key = m.id.split(":")[1], who = MODE_TARGET[key] === undefined ? "weakest" : MODE_TARGET[key];
      if (who) out.push(`${m.id}${who === "weakest" ? "+" : ""}@${who}`);
    }
  }
  return out;
}
const formFor = kind => (kind === "dream" ? "sanctum" : "warden");

/** One generated build: the featured tree at the highest tier the budget reaches, with a Background, an Ancestry and a Generic rider. */
export function build(featured, level, i) {
  const tree = S.treeById(featured), arch = tree.archetype;
  const ancs = ABC.playerAncestries().filter(a => ABC.backgroundsFor(a.id).some(b => b.id === BACKGROUND[arch]));
  const ancestry = ancs[i % ancs.length].id, bg = BACKGROUND[arch];
  const pkg = ABC.packageFor(bg, ancestry);
  // The Background's choices: the featured tree where it's offered, else the first; a focus that offers it, else the first.
  const focus = pkg.options.find(o => o.trees.some(x => (x.choose ?? []).some(n => ABC.treeByName(n)?.id === featured)))?.name ?? pkg.options[0]?.name ?? "";
  const picks = Object.fromEntries(ABC.choiceSlots(pkg, focus).map(s => [s.key, (s.choices.find(c => c.id === featured) ?? s.choices[0])?.id]));
  const abc = { ancestry, background: bg, focus, picks, alloc: {} };
  const free = ABC.freeTreesFor(abc).trees;
  const trees = { ...free }, ctx = { ancestry };
  open(trees, free, featured, 5, level, ctx);
  // Leftovers: an armor tree for a Martial build in armor, a second Wonder or school for the others, then a Generic rider.
  const statsPts = level * 3;
  let stats, gear = {};
  if (arch === "martial") {
    const dex = DEX_TREES.has(featured) || (["martial-bladed-weapons", "martial-balanced-weapons", "martial-brawling-methods", "martial-grappling-methods"].includes(featured) && i % 2);
    const main = dex ? "dex" : "str";
    stats = { [main]: Math.round(statsPts * 0.5), con: Math.round(statsPts * 0.35), will: statsPts - Math.round(statsPts * 0.5) - Math.round(statsPts * 0.35) };
    const type = WEAPON_OF[featured] ?? (featured === "martial-brawling-methods" || featured === "martial-grappling-methods" ? "unarmed" : dex ? "bladed" : "balanced");
    const weight = dex ? "light" : "heavy";
    const armor = featured in ARMOR_OF ? ARMOR_OF[featured] : A(dex ? "light" : "medium", "hardLeather");
    const armorTree = armor ? `martial-${armor.weight}-armor` : null;
    if (armorTree && S.treeById(armorTree)) open(trees, free, armorTree, level >= 60 ? 5 : 3, level, ctx);
    if (level >= 60) open(trees, free, dex ? "martial-dexterity-methods" : "martial-strength-methods", 5, level, ctx);
    gear = { armor, weapons: type === "unarmed" ? [] : [W(type, weight, "steel", { primary: true })], grapple: featured === "martial-grappling-methods",
      role: RANGED.has(type) ? "ranged" : dex ? "melee-dex" : "melee-str" };
  } else if (arch === "magic") {
    const cast = i % 2 ? "reach" : "grasp";
    stats = { [cast]: Math.round(statsPts * 0.5), build: Math.round(statsPts * 0.3), con: statsPts - Math.round(statsPts * 0.5) - Math.round(statsPts * 0.3) };
    // A school with no damage of its own gets Slashing beside it, so it has something to cast.
    if (!["magic-slashing", "magic-piercing", "magic-crushing", "magic-heat", "magic-cold", "magic-radiation", "magic-acid", "magic-arcanomancy"].includes(featured)) open(trees, free, "magic-slashing", level >= 60 ? 5 : 2, level, ctx);
    else if (level >= 60) open(trees, free, featured === "magic-slashing" ? "magic-heat" : "magic-slashing", 5, level, ctx);
    if (level >= 60) open(trees, free, "magic-protection-arcana", 3, level, ctx);
    gear = { armor: A("light", "hardLeather"), weapons: [], foci: { type: FOCI[cast] }, shroud: { type: "bastion" }, role: "caster" };
  } else {
    const w = WONDERS.find(x => x.id === featured);
    const kind = w?.kind ?? (featured === "mental-snappence-arts" ? "nightmare" : "dream");
    const main = kind === "dream" ? "pon" : "snap";
    stats = { [main]: Math.round(statsPts * 0.5), will: Math.round(statsPts * 0.35), con: statsPts - Math.round(statsPts * 0.5) - Math.round(statsPts * 0.35) };
    const wonders = w ? [w.id] : [kind === "dream" ? "mental-life-dream" : "mental-death-nightmare"];
    if (!w) open(trees, free, wonders[0], level >= 60 ? 5 : 3, level, ctx);          // an Arts tree: a T1 Wonder beside it to manifest with
    if (w && level >= 60) {
      const second = kind === "dream" ? (w.id === "mental-life-dream" ? "mental-order-dream" : "mental-life-dream") : (w.id === "mental-death-nightmare" ? "mental-chaos-nightmare" : "mental-death-nightmare");
      open(trees, free, second, 5, level, ctx);
      wonders.push(second);
    }
    const tenet = WONDERS.find(x => x.id === wonders[0])?.tenet?.id ?? "";
    gear = { armor: null, weapons: [], icon: { form: formFor(kind), tenet }, alignment: { kind, level: level >= 60 ? 2 : 1 }, mind: mindFor(wonders, trees), role: "caster" };
  }
  open(trees, free, RIDERS[i % RIDERS.length], 3, level, ctx);
  for (const r of RIDERS) if (S.spentPoints(trees, free) < level) open(trees, free, r, 2, level, ctx);
  // Names must be unique: an armor tree keeps "Armor" (Light Armor vs the Light Wonder), the Magic Creation school is "Creation School".
  const short = tree.id === "magic-creation" ? "Creation School" : tree.name.replace(/ (Weapons|Methods|Arts)$/, "").replace(/ \((Dream|Nightmare)\)$/, "");
  return { id: `${featured}-${level}`, name: `L${level} ${short}`, featured, level, sp: level, size: ABC.ANCESTRIES[ancestry]?.size ?? 3, stats, natural: false,
    loadout: { label: tree.name, trees, abc, freeTrees: free, stats, ...gear } };
}

/** The five-build parties of one level: the featured trees in an order that mixes Archetypes, five to a party. */
export function parties(level) {
  const by = { martial: [], magic: [], mental: [] };
  FEATURED.forEach(id => by[S.treeById(id).archetype].push(id));
  const order = [];
  for (let k = 0; order.length < FEATURED.length; k++) for (const a of ["martial", "magic", "mental"]) if (by[a][k]) order.push(by[a][k]);
  const builds = order.map((id, i) => build(id, level, i));
  const out = [];
  for (let i = 0; i < builds.length; i += 5) out.push(builds.slice(i, i + 5));
  // A short last party is filled from the front (those trees get a second look).
  const last = out.at(-1);
  for (let k = 0; last.length < 5; k++) last.push({ ...builds[k], id: `${builds[k].id}-b`, name: `${builds[k].name} B` });
  return out;
}

/* ---------------- The Bestiary group ---------------- */

function bestiaryKind(ancestry, bg, level, count, name) {
  const b = bestiaryBuild(ancestry, bg);
  const sp = level, stats = b.kind === "dream" ? { pon: sp * 2, will: sp * 2, con: sp } : { snap: sp * 2, will: sp * 2, con: sp };
  const nat = ancestry === "wonderborn-life" ? "Budding Gore" : ancestry === "wonderborn-dark" ? "Black Jaws" : "Root Lash";
  const modes = WONDERS.find(w => w.id === b.wonder)?.modes ?? [];
  return { id: `${ancestry}-${bg}`, name, count, size: b.size, sp, natural: true, stats, trees: b.free, abc: { ancestry, background: bg }, freeTrees: b.free,
    armor: null, weapons: [], icon: { form: b.form, tenet: WONDERS.find(w => w.id === b.wonder)?.tenet?.id ?? "" }, alignment: { kind: b.kind, level: 1 },
    mind: [`nat:${nat}@nearest`, ...modes.slice(0, 2).map(m => `${m.id}@${MODE_TARGET[m.id.split(":")[1]] ?? "weakest"}`).filter(x => !x.endsWith("@null"))] };
}
export function bestiaryGroup(level) {
  const kinds = level >= 60
    ? [bestiaryKind("wonderborn-life", "herald", level, 1, "Sim Thicket"), bestiaryKind("wonderborn-dark", "omen", level, 2, "Sim Gloamhound"), bestiaryKind("wonderborn-growth", "omen", level, 1, "Sim Burgeon")]
    : [bestiaryKind("wonderborn-life", "omen", level, 2, "Sim Bloomrot"), bestiaryKind("wonderborn-dark", "omen", level, 2, "Sim Gloamhound"), bestiaryKind("wonderborn-growth", "omen", level, 1, "Sim Burgeon")];
  return { label: "Bestiary", note: level >= 60 ? "A Thicket (Life Herald, Size 5), two Gloamhounds and a Burgeon." : "Two Bloomrots, two Gloamhounds and a Burgeon (Omens).", kinds };
}

/* ---------------- Passes ---------------- */

/** A party as the sim's roster wants it (one loadout each). */
const asParty = list => list.map(b => ({ id: b.id, name: b.name, role: b.loadout.role, sp: b.sp, size: b.size, stats: b.stats, note: b.loadout.label, loadouts: [b.loadout] }));
/** A party as a monster group (the other side of a mirror). */
const asGroup = (list, label) => ({ label, note: list.map(b => b.name).join(", "), kinds: list.map(b => ({ id: b.id, name: b.name, count: 1, size: b.size, sp: b.sp, natural: false, stats: b.stats,
  role: b.loadout.role, ...b.loadout })) });

/**
 * Passes `grand-<level>-p<k>`: party k of the level against party k+1 (a mirror) and against the Bestiary group. Run them in order
 * (SIM.passId = id; SIM.start()), or `grandQueue(level)` for the ids.
 */
export function grandPasses() {
  const out = {};
  for (const level of [15, 60]) {
    const ps = parties(level);
    ps.forEach((p, k) => {
      const rival = ps[(k + 1) % ps.length];
      const monsters = { mirror: asGroup(rival, `Mirror: party ${(k + 1) % ps.length + 1}`), bestiary: bestiaryGroup(level) };
      out[`grand-${level}-p${k + 1}`] = { id: `grand-${level}-p${k + 1}`, note: `Grand pass, level ${level}, party ${k + 1}: ${p.map(b => b.name).join(", ")}.`,
        party: asParty(p), monsters, encounters: [{ id: "mirror-r1", group: "mirror", rotation: 0 }, { id: "bestiary-r1", group: "bestiary", rotation: 0 }],
        backLine: true, spreadTargets: true, maxRounds: 15, grand: { level, party: k + 1 } };
    });
  }
  return out;
}
export const grandQueue = level => Object.keys(grandPasses()).filter(id => id.startsWith(`grand-${level}-`));

/* ---------------- Focused benches (2026-11-16) ---------------- */

/**
 * After the grand pass: one build against another (or against itself without one Mod), three of each, so a single difference shows.
 * Each bench is two passes, `bench-<key>-a` (A as the party) and `-b` (B as the party), so the side doesn't decide it.
 */
const BENCHES = [
  { key: "rend60", level: 60, a: "Slashing", b: ["Slashing", { noMods: ["magic-slashing:rend"], tag: "no Rend" }] },
  { key: "rend15", level: 15, a: "Slashing", b: ["Slashing", { noMods: ["magic-slashing:rend"], tag: "no Rend" }] },
  { key: "multicast15", level: 15, a: "Grasp Arcana", b: ["Grasp Arcana", { noMods: ["magic-reach-arcana:multicast"], tag: "no Multicast" }] },
  { key: "grasp60", level: 60, a: "Grasp Arcana", b: "Slashing" },
  { key: "thrasher60", level: 60, a: "Thrasher", b: "Balanced" },
  { key: "brawling60", level: 60, a: "Brawling", b: "Balanced" },
  { key: "acid60", level: 60, a: "Acid", b: "Cold" },
  // The first acid60 run: the AI spent its Threshold on the Slashing kit's Mods and the Cold side cast Cut, so here each side plays its own school.
  { key: "acidown60", level: 60, a: ["Acid", { school: "magic-acid", tag: "plays Acid" }], b: ["Cold", { school: "magic-cold", tag: "plays Cold" }] },
  { key: "fortune60", level: 60, a: "Fortune", b: "Life" },
  { key: "stagnation60", level: 60, a: "Stagnation", b: "Death" }
];
const FIGHTS_PER_SIDE = 3;
function benchBuild(level, spec) {
  const [name, mod] = Array.isArray(spec) ? spec : [spec, null];
  const b = parties(level).flat().find(x => x.name === `L${level} ${name}`);
  if (!b) throw new Error(`bench: no build L${level} ${name}`);
  return mod ? { ...b, id: `${b.id}-${mod.tag.replace(/\W+/g, "")}`, name: `${b.name} (${mod.tag})`, loadout: { ...b.loadout, noMods: mod.noMods, school: mod.school } } : b;
}
const trio = b => [1, 2, 3].map(k => ({ ...b, id: `${b.id}-${k}`, name: `${b.name} #${k}` }));
export function benchPasses() {
  const out = {};
  for (const bench of BENCHES) {
    const A = benchBuild(bench.level, bench.a), B = benchBuild(bench.level, bench.b);
    for (const [side, mine, theirs] of [["a", A, B], ["b", B, A]]) {
      const id = `bench-${bench.key}-${side}`;
      out[id] = { id, note: `Bench ${bench.key}: three ${mine.name} against three ${theirs.name}.`, party: asParty(trio(mine)),
        monsters: { rival: asGroup(trio(theirs), theirs.name) },
        encounters: Array.from({ length: FIGHTS_PER_SIDE }, (_, n) => ({ id: `r${n + 1}`, group: "rival", rotation: 0 })),
        backLine: true, spreadTargets: true, maxRounds: 15, bench: { key: bench.key, a: A.name, b: B.name } };
    }
  }
  return out;
}
export const benchQueue = () => Object.keys(benchPasses());
