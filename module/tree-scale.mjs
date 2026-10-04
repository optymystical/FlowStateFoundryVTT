/** Skill tree numbers worked out for a character: pure (no Foundry globals), so it's unit-tested. */
import * as mentalRules from "./mental-rules.mjs";
import * as spellfx from "./spellfx.mjs";

/**
 * The Power the Skills tab shows numbers for: a Wonder's Power (1 per 10 of its Scaling Stat, bolded effects grow with it) for a Mental Wonder tree,
 * or this character's Spell Power (attuned Foci's Scaling Stat, else Raw Casting) for Magic. Null where nothing scales (Martial, Theories, Arts).
 */
export function treePower(actor, tree) {
  const eff = actor?.system?.derived?.effective;
  if (!eff || !tree) return null;
  if (tree.archetype === "magic" || String(tree.id).startsWith("magic-")) {
    const foci = (actor.items ?? []).find(i => i.type === "foci" && i.system.attuned && i.system.profile?.valid);
    const scaling = foci ? foci.system.profile.scaling : Math.min(eff.reach?.value ?? 0, eff.grasp?.value ?? 0);
    const power = Math.floor((scaling ?? 0) / 10);
    return power >= 1 ? { kind: "Spell", power } : null;
  }
  const w = mentalRules.wonderById(tree.id);
  if (!w) return null;
  const check = mentalRules.manifestCheck(w, eff[mentalRules.KINDS[w.kind].stat]?.value ?? 0);
  return { kind: "Wonder", power: Math.max(1, check.power) };
}
/** An entry's text (and sub-lines) with the numbers worked out for that Power. */
export function scaleEntry(entry, tp) {
  if (!tp || tp.power <= 1) return entry;
  const f = tp.kind === "Spell" ? t => spellfx.scaleText(t, tp.power) : t => mentalRules.scaleMentalText(t, tp.power, entry.name);
  return { ...entry, text: f(entry.text ?? ""), ...(entry.sub ? { sub: entry.sub.map(f) } : {}) };
}

