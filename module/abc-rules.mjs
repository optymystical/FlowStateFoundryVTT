/**
 * Ancestry, Background and Culture (Flow State - ABCs). Pure: no Foundry globals. The tables are generated into abcs.mjs from the doc (and are the
 * store's `ancestries`, `backgrounds`, `homelands` and `circles` collections).
 *  - A character's choices live in `system.abc`: { ancestry, wasteling, background, focus, picks: { slotKey: treeId }, alloc: { treeId: tier }, homeland,
 *    circle, element, element2 }. A Wasteling (the doc's Wasteling Ancestry) keeps its original Ancestry, with the Wasteling core in place of its core. `system.freeTrees` (tree id → tier) is what the Background gives for free; `freeTreesFor` works it out from the choices.
 *  - A Background grants 15 free points of trees at normal tier costs, requirements included. Free points unlock trees and count toward their
 *    requirements, nothing else (not dice, the Stat Bonus or Energy: they aren't Skill Points). Points a Background can't place are spread across the
 *    Ancestry's trees by the player (`alloc`); the Outsider's 15 go on any trees the character could take (Theory tiers included).
 *  - Cultures (Homeland + Circle) are roleplay only.
 */
import { ANCESTRIES, BACKGROUNDS, HOMELANDS, CIRCLES, ABC_RULES, BESTIARY_RULES } from "./abcs.mjs";
import { TREES } from "./trees.mjs";
import { treeById, isAvailable, spentPoints, ancestryTrees, tierOf, MAX_TIER, requirementText } from "./skills.mjs";

export { ANCESTRIES, BACKGROUNDS, HOMELANDS, CIRCLES, ABC_RULES, BESTIARY_RULES };
/** Free Background points (the doc's 15). */
export const FREE_POINTS = 15;
/** Elemental Gland (Drakenblood): the elements it can be. */
export const GLAND_ELEMENTS = { heat: "Heat", cold: "Cold", acid: "Acid", radiation: "Radiation" };

const cost = t => (t * (t + 1)) / 2;

/** A tree named in a Background (never an ancestry tree): "Courage", "Life" (the Dream/Nightmare Wonder), "Heavy Armor". */
export function treeByName(name) {
  const n = String(name ?? "").trim().toLowerCase();
  const pool = TREES.filter(t => t.archetype !== "ancestry");
  return pool.find(t => t.name.toLowerCase() === n) ?? pool.find(t => t.name.toLowerCase().replace(/\s*\((dream|nightmare)\)$/, "") === n) ?? null;
}

/** The Ancestries a player can pick (the Bestiary's creature Ancestries are for the GM's NPCs; the Wasteling is a choice on top of another Ancestry). */
export const playerAncestries = () => Object.values(ANCESTRIES).filter(a => !a.hidden && !a.bestiary && !a.variant);
/** The Wasteling entry (its profile), if the doc has one. */
export const wastelingEntry = () => Object.values(ANCESTRIES).find(a => a.variant === "wasteling") ?? null;
/** The trees a Wasteling's choices give it: its Ancestry's, with the Wasteling core in place of the core. */
export const abcCtx = abc => ({ ancestry: abc?.ancestry || null, wasteling: !!abc?.wasteling });
/** The Backgrounds an Ancestry can take, in its profile's order (a Bestiary Ancestry takes only the Bestiary's Backgrounds, and a player's none of them). */
export function backgroundsFor(ancestry) {
  const a = ANCESTRIES[ancestry];
  if (!a) return [];
  const listed = (a.backgrounds ?? []).filter(id => BACKGROUNDS[id]);
  const open = Object.values(BACKGROUNDS).filter(b => !b.hidden && !!b.bestiary === !!a.bestiary && (b.available === "all" || (b.available ?? []).includes(ancestry))).map(b => b.id);
  return [...new Set([...listed.filter(id => open.includes(id)), ...open])].map(id => BACKGROUNDS[id]);
}
/** The Homelands an Ancestry can pick from (its own, then the Shared ones), and the Circles a Background can (its own, then the Shared ones). */
export const homelandsFor = ancestry => [...HOMELANDS.filter(h => !h.hidden && h.ancestry === ancestry), ...HOMELANDS.filter(h => !h.hidden && !h.ancestry)];
export const circlesFor = background => [...CIRCLES.filter(c => !c.hidden && c.background === background), ...CIRCLES.filter(c => !c.hidden && !c.background)];

/**
 * A Background's package for an Ancestry, with that Ancestry's differences applied: { items, options, ancestryPoints }. A replacement swaps one tree
 * (Dwarf Recruit: Heavy Armor for Medium Armor); "X only" keeps one focus (and "the school must be Heat" narrows its choice); a list replaces it all.
 */
export function packageFor(background, ancestry) {
  const bg = BACKGROUNDS[background];
  if (!bg) return null;
  let items = structuredClone(bg.trees ?? []), options = structuredClone(bg.options ?? []);
  for (const d of bg.differences ?? []) {
    if (d.ancestry !== ancestry) continue;
    if (d.replace) items = items.map(i => (i.tree === d.replace.from ? { tree: d.replace.tree, tier: d.replace.tier } : i));
    else if (d.only) {
      options = options.filter(o => o.name === d.only);
      if (d.mustBe) for (const o of options) o.trees = o.trees.map(i => (i.choose?.includes(d.mustBe) ? { tree: d.mustBe, tier: i.tier } : i));
    } else if (d.trees) { items = structuredClone(d.trees); options = []; }
  }
  return { id: bg.id, name: bg.name, items, options, ancestryPoints: bg.ancestryPoints ?? 0, anyPoints: bg.anyPoints ?? 0, tradeSlot: bg.tradeSlot ?? 0 };
}

/** Every tree a "school" choice can be: the Magic trees opened by Theory tiers min–max ("one Magic T1 or T2 school"). */
const schoolTrees = ({ min, max }) => TREES.filter(t => t.archetype === "magic" && !t.theory && (t.requires ?? 0) >= min && (t.requires ?? 0) <= max);

/**
 * The choices a package asks for, given the focus picked: [{ key, label, tier, choices: [{ id, name, tier }] }]. Keys are stable ("0", "focus:Warder:1").
 */
export function choiceSlots(pkg, focus = "") {
  if (!pkg) return [];
  const opt = pkg.options.find(o => o.name === focus) ?? null;
  const list = [...pkg.items.map((it, i) => [String(i), it]), ...(opt ? opt.trees.map((it, i) => [`focus:${opt.name}:${i}`, it]) : [])];
  const out = [];
  for (const [key, it] of list) {
    if (it.choose) out.push({ key, tier: it.tier, label: `One of these at Tier ${it.tier}`, choices: it.choose.map(n => treeByName(n)).filter(Boolean).map(t => ({ id: t.id, name: t.name, tier: it.tier })) });
    else if (it.school) out.push({ key, tier: it.tier, label: `A Magic T${it.school.min} or T${it.school.max} school at Tier ${it.tier}`, choices: schoolTrees(it.school).map(t => ({ id: t.id, name: t.name, tier: it.tier })) });
    else if (it.either) out.push({ key, tier: null, label: "One of these", choices: it.either.map(e => ({ t: treeByName(e.tree), tier: e.tier })).filter(e => e.t).map(e => ({ id: e.t.id, name: `${e.t.name} (Tier ${e.tier})`, tier: e.tier })) });
  }
  return out;
}

/** Merge a tree into a free-tree map at the higher tier. */
const put = (map, id, tier) => { if (id) map[id] = Math.max(map[id] ?? 0, Math.min(MAX_TIER, tier)); };

/**
 * The free trees an ABC choice gives: { trees: { id: tier }, spent, errors }. `abc` = { ancestry, background, focus, picks, alloc }.
 * Checks that every choice is made, the package's trees meet their requirements (from the free trees alone), and the Ancestry points (`alloc`)
 * are spent in full on the Ancestry's own trees.
 */
export function freeTreesFor(abc = {}) {
  const errors = [], trees = {};
  const a = ANCESTRIES[abc.ancestry];
  if (!a) return { trees, spent: 0, errors: ["Pick an Ancestry."] };
  if (a.bestiary) return { trees, spent: 0, errors: [`${a.name} is a Bestiary creature, not a player Ancestry.`] };
  if (a.variant) return { trees, spent: 0, errors: [`Pick your original Ancestry (a ${a.name} is one decayed by the Wastes).`] };
  const pkg = packageFor(abc.background, abc.ancestry);
  if (!pkg) return { trees, spent: 0, errors: ["Pick a Background."] };
  if (!backgroundsFor(abc.ancestry).some(b => b.id === pkg.id)) errors.push(`${a.name}s can't take the ${pkg.name} Background.`);
  if (pkg.options.length && !pkg.options.some(o => o.name === abc.focus)) errors.push(`Pick one of ${pkg.options.map(o => o.name).join(", ")}.`);
  const opt = pkg.options.find(o => o.name === abc.focus);
  const slots = Object.fromEntries(choiceSlots(pkg, abc.focus).map(s => [s.key, s]));
  const items = [...pkg.items.map((it, i) => [String(i), it]), ...(opt ? opt.trees.map((it, i) => [`focus:${opt.name}:${i}`, it]) : [])];
  let unpicked = pkg.options.length && !opt;
  for (const [key, it] of items) {
    if (it.tree) { const t = treeByName(it.tree); if (t) put(trees, t.id, it.tier); else errors.push(`Unknown tree "${it.tree}".`); continue; }
    const slot = slots[key], pick = abc.picks?.[key], c = slot?.choices.find(x => x.id === pick);
    if (!c) { errors.push(`${slot?.label ?? "A choice"} isn't picked yet.`); unpicked = true; continue; }
    put(trees, c.id, c.tier);
  }
  // The points the player places: the Outsider's 15 (on any trees), or whatever a Background couldn't place (on the Ancestry's own trees). What it
  // couldn't place is only known once every choice is made (an unpicked slot isn't "unplaced"); with nothing owed, these points don't count.
  const ctx = abcCtx(abc);
  const placed = spentPoints(trees);
  const anyTrees = !!pkg.anyPoints;
  const owed = pkg.anyPoints || pkg.ancestryPoints || (unpicked ? 0 : Math.max(0, FREE_POINTS - placed));
  const own = new Set(ancestryTrees(abc.ancestry, ctx.wasteling).map(t => t.id));
  const allowed = id => (anyTrees ? !!treeById(id) && !treeById(id).rulesOnly && (treeById(id).archetype !== "ancestry" || own.has(id)) : own.has(id));
  const alloc = owed ? Object.fromEntries(Object.entries(abc.alloc ?? {}).filter(([id, t]) => allowed(id) && Number(t) > 0).map(([id, t]) => [id, Math.min(MAX_TIER, Math.floor(Number(t)))])) : {};
  const allocCost = Object.values(alloc).reduce((n, t) => n + cost(t), 0);
  if (owed && allocCost !== owed) errors.push(`Spend ${owed} points on ${anyTrees ? "your trees" : "your Ancestry's trees"} (${allocCost} so far).`);
  for (const [id, t] of Object.entries(alloc)) put(trees, id, t);
  for (const id of Object.keys(trees)) {
    const t = treeById(id);
    if (t && !isAvailable(trees, t, ctx)) errors.push(`${t.name} needs ${requirementText(t, ctx)}.`);
  }
  return { trees, spent: spentPoints(trees), owed, allocCost, anyTrees, errors };
}

/** The roleplay half and the creation choices: every pick is valid for the Ancestry and Background. */
export function cultureErrors(abc = {}) {
  const errors = [];
  if (!homelandsFor(abc.ancestry).some(h => h.id === abc.homeland)) errors.push("Pick a Homeland.");
  if (!circlesFor(abc.background).some(c => c.id === abc.circle)) errors.push("Pick a Circle.");
  if (abc.ancestry === "drakenblood" && !GLAND_ELEMENTS[abc.element]) errors.push("Pick your Elemental Gland's element.");
  return errors;
}

/** An Ancestry's Size (Halflings and Goblins are Size 2). */
export const ancestrySize = ancestry => ANCESTRIES[ancestry]?.size ?? 3;

/** The tiers a character paid for in a tree, past what's free (so the free part can never be lowered or refunded). */
export const paidTiers = (trees, free, id) => Math.max(0, tierOf(trees, id) - tierOf(free, id));
