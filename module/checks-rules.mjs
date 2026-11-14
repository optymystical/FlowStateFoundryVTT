/**
 * Non Stat Checks (Rules doc, Ch7; the Generic Groups' Tier 0s): Stealth, Perception, Persuasion, Deception, counter checks, Athletics and Initiative
 * roll the plain attack die (a die the size of your total Skill Points), untouched by what changes attack rolls. Contested, the acting side (the spotter,
 * the persuader) wins ties; uncontested, the GM sets a static target. Pure: no Foundry globals.
 */

/** The GM's static targets for an uncontested check (Rules doc). */
export const CHECK_DIFFICULTIES = {
  easy: { label: "Easy", target: 5 },
  moderate: { label: "Moderate", target: 10 },
  hard: { label: "Hard", target: 15 },
  veryHard: { label: "Very Hard", target: 25 },
  heroic: { label: "Heroic", target: 40 },
  legendary: { label: "Legendary", target: 60 }
};

/**
 * The checks. `tree` is the Generic Group whose Tier 3 holds the check's reroll (Focus, Still Breath...): a result under half the die can be rerolled
 * for Energy equal to half your total Skill Points, once (repeatedly at Tier 5). `against`: the check the other side rolls when it's contested.
 */
export const CHECK_KINDS = {
  perception: { label: "Perception", tree: "generic-perception", reroll: "Focus", repeat: "Hyperfocus", against: "stealth" },
  stealth: { label: "Stealth", tree: "generic-stealth", reroll: "Still Breath", repeat: "Deep Breath", against: "perception" },
  persuasion: { label: "Persuasion", tree: "generic-persuasion", reroll: "Rephrase", repeat: "Silver Tongue", against: "counter" },
  deception: { label: "Deception", tree: "generic-deception", reroll: "Double Down", repeat: "Straight Face", against: "counter" },
  counter: { label: "Counter check", tree: "generic-resolve", reroll: "Hold Firm", repeat: "Unbreakable", against: null },
  athletics: { label: "Athletics", tree: "generic-athletics", reroll: null, against: null },
  initiative: { label: "Initiative", tree: "generic-initiative", reroll: null, against: null }
};
/** The kind a label names ("Perception", "Spirit Sense", "Psion Sense": a sense is a perception check). */
export function kindOf(label) {
  const l = String(label ?? "").toLowerCase();
  for (const k of Object.keys(CHECK_KINDS)) if (l === k || l.startsWith(CHECK_KINDS[k].label.toLowerCase())) return k;
  if (/sense|sight|spot/.test(l)) return "perception";
  if (/counter/.test(l)) return "counter";
  return "perception";
}

/** A contest: the acting side wins ties. */
export const actingWins = (acting, other) => Number(acting) >= Number(other);
/** An uncontested check succeeds on a result at least the static target. */
export const meetsTarget = (result, target) => Number(result) >= Number(target);
/** The T3 rerolls: a result under half the die's maximum. */
export const underHalf = (result, die) => Number(result) < Number(die) / 2;
/** Energy for an ability that costs "half of your total skill points" (rounded down, like every other half in the docs). */
export const halfSP = sp => Math.floor(Math.max(0, Number(sp) || 0) / 2);

/** Attitudes for Persuade and Deceive (Persuasion and Deception Tier 0). */
export const ATTITUDES = { friendly: "Friendly", neutral: "Neutral", hostile: "Hostile" };

/**
 * The counter check's Advantage in a social contest, and whether the check can happen at all. `tiers(id)` reads the counter-roller's trees,
 * `actorTiers(id)` the persuader's or deceiver's.
 * - Persuade: friendly normal, neutral counter has Advantage, hostile can't be persuaded. Stubborn (Composure T2): a friendly target counters as neutral.
 * - Deceive: friendly/neutral normal, hostile counter has Advantage; Unreadable (Deception T2) takes that away.
 * - Focused (Discipline T1): Advantage on counter checks against deception during combat.
 */
export function socialCounter({ kind, attitude = "neutral", inCombat = false, tiers = () => 0, actorTiers = () => 0 }) {
  const notes = [];
  let net = 0, blocked = null;
  if (kind === "persuasion") {
    const att = attitude === "friendly" && tiers("generic-composure") >= 2 ? "neutral" : attitude;
    if (att !== attitude) notes.push("Stubborn: counters as neutral");
    if (att === "hostile") blocked = "A hostile creature can't be persuaded (Intimidate, Command T1, works on them).";
    else if (att === "neutral") { net += 1; notes.push("neutral: Advantage"); }
  } else if (kind === "deception") {
    if (attitude === "hostile") {
      if (actorTiers("generic-deception") >= 2) notes.push("Unreadable: no hostile Advantage");
      else { net += 1; notes.push("hostile: Advantage"); }
    }
    if (inCombat && tiers("generic-discipline") >= 1) { net += 1; notes.push("Focused: Advantage"); }
  }
  return { net, notes, blocked };
}

/** The acting side's Advantage from its own passives. Charismatic (Persuasion T2): Advantage against friendly targets. */
export function actingNet({ kind, attitude = null, tiers = () => 0 }) {
  const notes = [];
  let net = 0;
  if (kind === "persuasion" && attitude === "friendly" && tiers("generic-persuasion") >= 2) { net += 1; notes.push("Charismatic: Advantage"); }
  if (kind === "athletics" && tiers("generic-athletics") >= 5) { net += 1; notes.push("Peak Condition: Advantage"); }
  return { net, notes };
}

/** Initiative: Alacrity (Initiative T1) rolls with Advantage, two stacks with Lightning Reflexes (T5). */
export const alacrityStacks = tier => (tier >= 5 ? 2 : tier >= 1 ? 1 : 0);
/** Initiative ties: reroll against each other, unless one of them has Poised (Initiative T2), who wins it. Returns "a", "b" or "reroll". */
export function initiativeTie(aPoised, bPoised) {
  if (aPoised && !bPoised) return "a";
  if (bPoised && !aPoised) return "b";
  return "reroll";
}
