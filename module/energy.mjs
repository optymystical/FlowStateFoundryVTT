/**
 * Energy costs written in the skill trees ("Cost: Energy equal to half of your Scaling Stat min, rounded down.").
 * Parsed into a small formula so the sheet can show a badge with the actor's actual cost.
 * Pure functions (no Foundry globals) so they can be unit-tested.
 */
import { statMin } from "./rules.mjs";

const COST_RE = /Cost:\s*Energy equal to ([^.]*)\.\s*/i;
const STAT_KEYS = { str: "str", dex: "dex", con: "con" };

/** Parse a cost sentence. Returns null if the text has no Energy cost. */
export function parseEnergyCost(text = "") {
  const m = String(text).match(COST_RE);
  if (!m) return null;
  const phrase = m[1].trim();
  const p = phrase.toLowerCase();
  const mult = /\bdouble\b/.test(p) ? 2 : /\bquarter\b/.test(p) ? 0.25 : /\bhalf\b/.test(p) ? 0.5 : 1;
  const target = /grappled target/.test(p);
  let base, stat = null;
  if (/skill points/.test(p)) base = "skillPoints";
  else if (/scaling stat min/.test(p)) base = "scalingMin";
  else if (/scaling stat/.test(p)) base = "scaling";
  else {
    const s = p.match(/\b(str|dex|con)\b\s+(min|stat)/);
    if (s) { stat = STAT_KEYS[s[1]]; base = s[2] === "min" ? "statMin" : "stat"; }
  }
  if (!base) return { phrase, mult, base: "other", stat: null, target, short: phrase };
  const multLabel = { 2: "2 × ", 0.5: "½ × ", 0.25: "¼ × ", 1: "" }[mult];
  const baseLabel = {
    skillPoints: "Skill Points", scalingMin: "Scaling Stat min", scaling: "Scaling Stat",
    statMin: `${stat?.toUpperCase()} min`, stat: `${stat?.toUpperCase()} stat`
  }[base];
  return { phrase, mult, base, stat, target, short: `${multLabel}${target ? "target's " : ""}${baseLabel}` };
}

/** Text with the cost sentence removed (the badge shows it instead). */
export const stripEnergyCost = (text = "") => String(text).replace(COST_RE, "").trim();

/** Apply the multiplier; costs are whole numbers, rounded down. */
export const scaleCost = (value, mult) => Math.floor(Math.max(0, value) * mult);

/**
 * The actor's cost for a parsed formula.
 * @param {object} ctx  { effective, skillPoints, weapons: [{name, capped, statValue, unarmed, light?, heavy?}] }
 * @returns {{ value: number|null, parts: Array<{label, value}> , note: string }}
 */
export function energyFor(cost, ctx) {
  if (!cost) return null;
  if (cost.target) return { value: null, parts: [], note: "depends on the grappled target" };
  const eff = ctx.effective ?? {};
  switch (cost.base) {
    case "skillPoints": return { value: scaleCost(ctx.skillPoints ?? 0, cost.mult), parts: [], note: "" };
    case "statMin": return { value: scaleCost(eff[cost.stat]?.min ?? 0, cost.mult), parts: [], note: "" };
    case "stat": return { value: scaleCost(eff[cost.stat]?.value ?? 0, cost.mult), parts: [], note: "" };
    case "scalingMin":
    case "scaling": {
      const pick = v => (cost.base === "scalingMin" ? statMin(v) : v);
      const parts = [];
      for (const w of ctx.weapons ?? []) {
        if (w.unarmed) {
          parts.push({ label: `${w.name} (Light)`, value: scaleCost(pick(eff.dex?.value ?? 0), cost.mult) });
          parts.push({ label: `${w.name} (Heavy)`, value: scaleCost(pick(eff.str?.value ?? 0), cost.mult) });
        } else {
          parts.push({ label: w.name, value: scaleCost(pick(w.capped ?? 0), cost.mult) });
        }
      }
      const values = [...new Set(parts.map(p => p.value))];
      return { value: values.length === 1 ? values[0] : null, parts, note: parts.length ? "" : "depends on the weapon (none held)" };
    }
    default: return { value: null, parts: [], note: "see text" };
  }
}

/** One-line summary of the actor's cost: "3 Energy", "Sword: 1 · Axe: 2", or a note. */
export function energySummary(result) {
  if (!result) return "";
  if (result.value !== null && result.value !== undefined) return `${result.value} Energy`;
  if (result.parts.length) return result.parts.map(p => `${p.label}: ${p.value}`).join(" · ");
  return result.note;
}
