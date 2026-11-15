/**
 * The character tutorial's advice (pure: no Foundry globals). Which Archetype a character leans to (its Background's Theory, else its stats), and what
 * equipment fits what was picked: weapon weights by Strength/Dexterity, weapon types by the weapon trees, armor by the armor trees and Constitution,
 * a Foci's casting form by Reach/Grasp, a Shroud by Build, Icon Forms by Ponderance/Snappence and the Wonder trees. The tutorial only highlights these.
 */
export const ARCHETYPES = {
  martial: { id: "martial", label: "Martial", stats: ["str", "dex", "con"], theory: "martial-theory",
    blurb: "weapons and armor: you hit things, and take hits, with gear you can see and hold." },
  magic: { id: "magic", label: "Magic", stats: ["reach", "grasp", "build"], theory: "magic-theory",
    blurb: "spells: a Core Spell plus Mods that change it, cast through a Foci, with a Shroud that guards your spirit." },
  mental: { id: "mental", label: "Mental", stats: ["pon", "snap", "will"], theory: "mental-theory",
    blurb: "Wonders: ideas and emotions (Dreams and Nightmares) made real, shaped as you Manifest them, with an Icon's Ward to defend you." }
};

/** A stat counts toward a playstyle from this many points (a weapon rolls one die per full 10 of its stat). */
export const SIGNIFICANT = 10;
const n = v => Number(v) || 0;

/** The Archetypes whose Theory the Background already gives (free tiers). */
export function presetArchetypes(freeTrees = {}) {
  return Object.values(ARCHETYPES).filter(a => n(freeTrees[a.theory]) > 0).map(a => a.id);
}

/** Each Archetype's share of the stat points, most first. */
export function statLeaning(stats = {}) {
  return Object.values(ARCHETYPES).map(a => ({ id: a.id, total: a.stats.reduce((t, k) => t + n(stats[k]), 0) })).sort((x, y) => y.total - x.total);
}

/**
 * The Archetype to start in: the one the Background gives (the one with more stat points if it gives several), else where the stats went, else null.
 * Returns { id, why: "background" | "stats" | null }.
 */
export function suggestedArchetype({ stats = {}, freeTrees = {} } = {}) {
  const lean = statLeaning(stats), preset = presetArchetypes(freeTrees);
  if (preset.length) return { id: lean.find(l => preset.includes(l.id))?.id ?? preset[0], why: "background" };
  return lean[0].total > 0 ? { id: lean[0].id, why: "stats" } : { id: null, why: null };
}

/** The Archetypes a character is building toward: a Theory tier (bought or free), or at least SIGNIFICANT points in one of its stats. */
export function activeArchetypes({ stats = {}, trees = {} } = {}) {
  return Object.values(ARCHETYPES).filter(a => n(trees[a.theory]) > 0 || a.stats.some(k => n(stats[k]) >= SIGNIFICANT)).map(a => a.id);
}

const WEAPON_TREE = t => (t === "unarmed" ? "martial-brawling-methods" : `martial-${t}-weapons`);
const WONDER_KIND = id => (/-dream$/.test(id) ? "dream" : /-nightmare$/.test(id) ? "nightmare" : null);

/**
 * What equipment fits: { archetypes, highlight, advice }. `highlight` names the choices the wizard marks (Sets of keys): weaponWeights, weaponTypes,
 * armorWeights, fociForms, iconAligns, and add (the add buttons: weapon, armor, foci, shroud, icon, affix). `advice` is a list of
 * { archetype, kind, key, why } the tutorial words for the player. `weaponTypes` / `armorWeights` are the system's keys (passed in, so this stays pure).
 */
export function equipmentAdvice({ stats = {}, trees = {}, weaponTypes = [], armorWeights = [] } = {}) {
  const archetypes = activeArchetypes({ stats, trees });
  const hl = { weaponWeights: new Set(), weaponTypes: new Set(), armorWeights: new Set(), fociForms: new Set(), iconAligns: new Set(), add: new Set() };
  const advice = [];
  const has = id => n(trees[id]) > 0;
  if (archetypes.includes("martial")) {
    const str = n(stats.str), dex = n(stats.dex), con = n(stats.con);
    if (dex >= SIGNIFICANT) { hl.weaponWeights.add("light"); advice.push({ archetype: "martial", kind: "weaponWeight", key: "light", why: "dex" }); }
    if (str >= SIGNIFICANT) { hl.weaponWeights.add("heavy"); advice.push({ archetype: "martial", kind: "weaponWeight", key: "heavy", why: "str" }); }
    if (!hl.weaponWeights.size) { hl.weaponWeights.add(dex >= str ? "light" : "heavy"); advice.push({ archetype: "martial", kind: "weaponWeight", key: dex >= str ? "light" : "heavy", why: "low" }); }
    for (const t of weaponTypes) if (has(WEAPON_TREE(t))) { hl.weaponTypes.add(t); advice.push({ archetype: "martial", kind: "weaponType", key: t, why: "tree" }); }
    hl.add.add("weapon");
    if (has("martial-unarmored")) advice.push({ archetype: "martial", kind: "armor", key: "none", why: "unarmored" });
    else {
      for (const w of armorWeights) if (has(`martial-${w}-armor`)) hl.armorWeights.add(w);
      if (hl.armorWeights.size) advice.push({ archetype: "martial", kind: "armor", key: [...hl.armorWeights].join(","), why: "tree" });
      else if (con >= SIGNIFICANT) { ["light", "medium"].forEach(w => hl.armorWeights.add(w)); advice.push({ archetype: "martial", kind: "armor", key: "light,medium", why: "con" }); }
      if (hl.armorWeights.size) hl.add.add("armor");
    }
  }
  if (archetypes.includes("magic")) {
    const reach = n(stats.reach), grasp = n(stats.grasp), build = n(stats.build);
    let form = null;
    if (reach >= SIGNIFICANT && grasp >= SIGNIFICANT && Math.abs(reach - grasp) <= 5) form = "multi";
    else if (reach >= SIGNIFICANT || grasp >= SIGNIFICANT) form = reach >= grasp ? "channeler" : "igniter";
    if (form) { hl.fociForms.add(form); hl.add.add("foci"); advice.push({ archetype: "magic", kind: "foci", key: form, why: form === "multi" ? "both" : form === "channeler" ? "reach" : "grasp" }); }
    else advice.push({ archetype: "magic", kind: "foci", key: null, why: "low" });
    if (build >= SIGNIFICANT) { hl.add.add("shroud"); advice.push({ archetype: "magic", kind: "shroud", key: null, why: "build" }); }
    if (form || build >= SIGNIFICANT) { hl.add.add("affix"); advice.push({ archetype: "magic", kind: "affix", key: null, why: "free" }); }
  }
  if (archetypes.includes("mental")) {
    const pon = n(stats.pon), snap = n(stats.snap);
    for (const id of Object.keys(trees)) { const k = n(trees[id]) > 0 ? WONDER_KIND(id) : null; if (k && id.startsWith("mental-")) hl.iconAligns.add(k); }
    if (pon >= SIGNIFICANT) hl.iconAligns.add("dream");
    if (snap >= SIGNIFICANT) hl.iconAligns.add("nightmare");
    if (!hl.iconAligns.size) hl.iconAligns.add(pon >= snap ? "dream" : "nightmare");
    hl.add.add("icon");
    advice.push({ archetype: "mental", kind: "icon", key: [...hl.iconAligns].join(","), why: "align" });
  }
  return { archetypes, highlight: hl, advice };
}
