/**
 * Mental rules (Mental Rework Test Ground + Equipment doc). Pure: no Foundry globals, so it's unit-tested outside Foundry.
 * Wonders are the Mental skill trees named "<Name> (Dream)" or "<Name> (Nightmare)"; each has Modes (Manifested as attacks), a Tenet,
 * and abilities/passives. Icons are the Mental equipment: a Form with a Ward effect and a Tenet.
 */
import { TREES } from "./trees.mjs";
import { BOLD } from "./mental-bold.mjs";

export const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* -------------------------------------------- */
/*  Wonders, Modes, Tenets                      */
/* -------------------------------------------- */

/** Dreams scale with Ponderance, Nightmares with Snappence. */
export const KINDS = {
  dream: { label: "Dream", stat: "pon", statLabel: "Ponderance" },
  nightmare: { label: "Nightmare", stat: "snap", statLabel: "Snappence" }
};

const wonderKind = tree => /\((Dream|Nightmare)\)\s*$/i.exec(tree.name)?.[1]?.toLowerCase() ?? null;

const isTenet = e => /^Only active while attuned/i.test(e.text ?? "");

/** "Bloom: …" → { base, enhanced } (the part after "Enhanced:" is what Enhancing adds or changes). */
export function splitEnhanced(text) {
  const m = /\s*\bEnhanced:\s*/.exec(text ?? "");
  return m ? { base: text.slice(0, m.index).trim(), enhanced: text.slice(m.index + m[0].length).trim() } : { base: String(text ?? "").trim(), enhanced: "" };
}

/** One Wonder parsed from its skill tree: its Modes (with the tier they unlock), Tenet, and abilities/passives. */
export function parseWonder(tree) {
  const kind = wonderKind(tree);
  if (!tree || tree.archetype !== "mental" || tree.theory || !kind) return null;
  const name = tree.name.replace(/\s*\((Dream|Nightmare)\)\s*$/i, "");
  const out = { id: tree.id, name, kind, requires: tree.requires, modes: [], tenet: null, abilities: [] };
  for (const t of tree.tiers) {
    const modeTier = /\bMode\b/i.test(t.summary ?? "");
    for (const e of t.entries) {
      if (isTenet(e)) { out.tenet = { name: e.name, text: e.text, tier: t.tier, id: `${tree.id}:${slug(e.name)}` }; continue; }
      if (modeTier) out.modes.push({ id: `${tree.id}:${slug(e.name)}`, wonder: tree.id, name: e.name, tier: t.tier, text: e.text, ...splitEnhanced(e.text) });
      else out.abilities.push({ id: `${tree.id}:${slug(e.name || "x")}`, wonder: tree.id, name: e.name, tier: t.tier, text: e.text });
    }
  }
  return out;
}

export const WONDERS = TREES.map(parseWonder).filter(Boolean);
export const wonderById = id => WONDERS.find(w => w.id === id) ?? null;
export const modeById = id => WONDERS.flatMap(w => w.modes).find(m => m.id === id) ?? null;

/** The Wonders, Modes and Tenets a character knows, from their skill tree state ({ [treeId]: tier }). */
export function knownWonders(state = {}) {
  return WONDERS.map(w => {
    const tier = Math.max(0, Number(state?.[w.id]) || 0);
    return { ...w, tier, modes: w.modes.filter(m => m.tier <= tier), abilities: w.abilities.filter(a => a.tier <= tier), tenet: w.tenet && w.tenet.tier <= tier ? w.tenet : null };
  }).filter(w => w.tier > 0);
}

/** Does the Mental Theory tier (or a named tree tier) unlock this feature? Helper for abilities. */
export const theoryTier = state => Math.max(0, Number(state?.["mental-theory"]) || 0);

/* -------------------------------------------- */
/*  Manifesting                                 */
/* -------------------------------------------- */

export const RANGES = {
  melee: { label: "Melee", ap: 1, text: "one target in your personal melee range" },
  ranged: { label: "Ranged", ap: 2, range: 100, text: "a target within 100 ft" },
  area: { label: "Area", ap: 3, text: "a 10 ft radius around you, a 20 ft 90° cone, or a 30 × 5 ft line" }
};
export const AREA_SHAPES = { radius: "10 ft radius around you", cone: "20 ft 90° cone", line: "30 × 5 ft line" };

/** Wonder Power: 1 per 10 points in the Wonder's Scaling Stat (0 means it can't be Manifested). Power bonuses are additive percentages. */
export const wonderPower = (stat, bonusPct = 0) => Math.floor(Math.floor((Number(stat) || 0) / 10) * (1 + bonusPct / 100));

/** What a Manifest costs. Burst pays RP instead of AP, plus the Enhance cost in energy; doing both pays the Enhance cost twice. */
export function manifestCost({ range = "ranged", enhance = false, burst = false, enhanceCost = 0, free = false, waive = {} }) {
  const base = RANGES[range]?.ap ?? 2;
  const w = free ? { ap: true, rp: true, energy: true } : waive;
  const energy = w.energy ? 0 : (enhance ? enhanceCost : 0) + (burst ? enhanceCost : 0);
  return { ap: burst || w.ap ? 0 : base, rp: burst && !w.rp ? base : 0, energy, burst, enhance };
}
/** Can this Wonder be Manifested, and at what Power? */
export function manifestCheck(wonder, stat, bonusPct = 0) {
  const power = wonderPower(stat, bonusPct);
  if (power < 1) return { ok: false, power, reason: `${KINDS[wonder.kind].statLabel} is under 10, so ${wonder.name} can't be Manifested.` };
  return { ok: true, power };
}

/* -------------------------------------------- */
/*  Alignment                                   */
/* -------------------------------------------- */

export const ALIGNMENTS = { neutral: "Neutral", dream: "Dream", nightmare: "Nightmare" };

/**
 * Advantage/Disadvantage on a Manifest's attack roll from Alignment: a Dream or Nightmare Alignment gives its own Wonders Advantage and the
 * opposite Wonders Disadvantage. Neutral gives Advantage to Form Ward attacks instead.
 */
export function alignmentNet(alignment, kind, { ward = false } = {}) {
  if (ward) return alignment === "neutral" ? 1 : 0;
  if (alignment === "neutral" || !kind) return 0;
  return alignment === kind ? 1 : -1;
}

/** Strengthened stacks Deepening gives Wonders of the Aligned type (doubly Strengthened). */
export const DEEPENED_STACKS = 2;

/** Changing Alignment: 2 AP, or (Fluidity, Mental T3) energy equal to half your Skill Points at any time. Deepening / Equilibrium costs. */
export const alignChangeCost = ({ fluidity = false, skillPoints = 0 }) => fluidity ? { ap: 0, energy: Math.floor(skillPoints / 2) } : { ap: 2, energy: 0 };
export const deepenCost = (alignment, { scalingMin = 0, willMin = 0 }) => alignment === "neutral" ? { ap: 2, energy: willMin } : { ap: 0, energy: scalingMin };

/* -------------------------------------------- */
/*  Icons and Forms                             */
/* -------------------------------------------- */

const f = (name, align, rarity, ward, enhance, extra = {}) => ({ name, align, rarity, ward, enhance, ...extra });
/** Forms from the Equipment doc. `kind`: how the engine plays the Ward: shield (1 AP, stacking shielding), negate (reaction, RP), persistent, charge. */
export const FORMS = {
  aegis: f("Aegis", "dream", "common", "For 1 AP, provides 20 shielding, lasting until the start of your next turn. This effect stacks.", "Instead provides 30 shielding.", { kind: "shield", amount: 20, enhanced: 30, ap: 1 }),
  sanctum: f("Sanctum", "dream", "common", "For 1 AP, provides 20 shielding, lasting until the start of your next turn. This effect stacks.", "The shield provided lasts an additional turn.", { kind: "shield", amount: 20, enhanced: 20, ap: 1, extraTurn: true }),
  prism: f("Prism", "dream", "uncommon", "For 1 AP, provides 40 shielding against specifically Physical, Elemental, or Magical damage, lasting until the start of your next turn. This effect stacks.", "The shield protects against two chosen damage types.", { kind: "shield", amount: 40, enhanced: 40, ap: 1, typed: true }),
  vigil: f("Vigil", "dream", "uncommon", "Provides a passive 60 shielding that does not decay or naturally regenerate. Instead, on your turn you can spend 1 AP to recover 10 shielding for this effect (still requires a hit). Project/Expansion causes this persistent shield to apply to the target(s) instead.", "The recovery attack automatically succeeds.", { kind: "persistent", amount: 60, recover: 10, ap: 1 }),
  anchor: f("Anchor", "dream", "rare", "For 1 AP, provides 20 shielding, lasting until the start of your next turn. This effect stacks. If you have not moved since the start of your turn, damage dealt to this shielding is Weakened (the Weakened does not stack with multiple instances of this shield).", "The Weakened persists beyond the shield, now applying to all damage you would take until the start of your next turn, so long as you do not move.", { kind: "shield", amount: 20, enhanced: 20, ap: 1, anchor: true }),
  reverie: f("Reverie", "dream", "rare", "Can only be activated while you are in the Dream Alignment. For 1 AP, provides 20 shielding, lasting until the start of your next turn. This effect stacks up to 60 shielding, and holds between turns so long as you instantly maintain Dream Alignment on turn start.", "Whenever you Manifest a Dream successfully, add 5 shielding to this effect, up to the cap. This effect stacks, so multiple instances increase the shielding provided per Manifest.", { kind: "shield", amount: 20, enhanced: 20, ap: 1, cap: 60, needs: "dream" }),
  premonition: f("Premonition", "dream", "very rare", "Store one charge of Premonition until the start of your next turn. Whenever you would take damage, you can consume up to one charge of Premonition to negate 40 of that damage.", "When you store the charge, declare an attack source. If, on activation, the declared source is the one causing the damage, it gets a stack of Weakened.", { kind: "charge", amount: 40, enhanced: 40, ap: 1 }),
  veil: f("Veil", "nightmare", "common", "When you would take damage, spend 1 RP to negate up to 10 of that damage. Can be used multiple times per damage instance.", "Instead provides 20 negation.", { kind: "negate", amount: 10, enhanced: 20 }),
  warden: f("Warden", "nightmare", "common", "When you would take damage, spend 1 RP to negate up to 10 of that damage. Can be used multiple times per damage instance.", "After negation occurs and damage resolves, if the source of the damage is within 100ft, make a Ranged attack roll against them. On hit, the damage negated is dealt to them. Only one attack needs to be made per damage instance, regardless of times this Ward was used.", { kind: "negate", amount: 10, enhanced: 10, reflect: "ranged" }),
  bane: f("Bane", "nightmare", "uncommon", "When you attune to this Form, select Physical, Elemental, or Magical damage. When you would take damage, spend 1 RP to negate up to 20 of that damage if it matches the chosen damage type, or 5 of that damage otherwise. Can be used multiple times per damage instance.", "Treat all incoming damage as your chosen damage type for this Ward effect.", { kind: "negate", amount: 20, other: 5, enhanced: 20, chooses: "category" }),
  grudge: f("Grudge", "nightmare", "uncommon", "When you would take damage, spend 1 RP to negate up to 10 of that damage. Increases by 10 negation per instance of this Ward used in the same damage instance. Can be used multiple times per damage instance.", "Treat this effect as if it already triggered one additional time for the purposes of increasing the negation amount.", { kind: "negate", amount: 10, enhanced: 10, grows: 10 }),
  riposte: f("Riposte", "nightmare", "rare", "When you would take damage, spend 1 RP to negate up to 30 of that damage if the attack’s source is within your melee range, and 5 damage otherwise. Can be used multiple times per damage instance.", "After negation occurs and damage resolves, if the source of the damage is within melee range, make a Melee attack roll against them with advantage. On hit, the damage negated is dealt to them. Only one attack needs to be made per damage instance, regardless of times this Ward was used.", { kind: "negate", amount: 30, other: 5, enhanced: 30, near: true, reflect: "melee" }),
  zealot: f("Zealot", "nightmare", "rare", "When you would take damage, spend 1 RP to negate up to 30 of that damage so long as you are in a Deepened Nightmare Alignment, providing 5 negation otherwise. Can be used multiple times per damage instance.", "No longer requires you to be in the Deepened Nightmare Alignment, only the regular Nightmare Alignment.", { kind: "negate", amount: 30, other: 5, enhanced: 30, needs: "deepNightmare" }),
  echo: f("Echo", "nightmare", "very rare", "When you would take damage, spend 1 RP to negate up to 5 of that damage. Can be used multiple times per damage instance. If this fully negates the attack, this effect is now applied for free to all instances of damage you would take until the start of your next turn. This effect stacks.", "Instead provides 10 negation.", { kind: "negate", amount: 5, enhanced: 10, echo: true })
};
export const FORM_KEYS = Object.keys(FORMS);
export const formGroups = () => Object.entries(KINDS).map(([k, v]) => ({ label: `${v.label} Forms`, options: Object.fromEntries(Object.entries(FORMS).filter(([, x]) => x.align === k).map(([id, x]) => [id, `${x.name} (${x.rarity})`])) }));

/** Stat that affects an Icon: scaled per 10, limited by Grade (10 per Grade). Always at least ×1. */
export const iconScale = (stat, grade) => Math.max(1, Math.floor(Math.min(Number(stat) || 0, Math.max(1, grade) * 10) / 10));

/** The Ward and Tenet numbers on an Icon for a character (Willpower for the Ward, the Tenet Wonder's stat for the Tenet). */
export function iconProfile(item, stats = {}) {
  const form = FORMS[item.form];
  if (!form) return { valid: false, error: "Pick a Form." };
  const grade = Math.max(1, item.grade || 1);
  const wardMult = iconScale(stats.will ?? 0, grade);
  const tenetWonder = item.tenet ? wonderById(item.tenet.split(":")[0]) : null;
  const tenetStat = tenetWonder ? stats[KINDS[tenetWonder.kind].stat] ?? 0 : 0;
  return {
    valid: true, form: item.form, name: form.name, align: form.align, rarity: form.rarity, grade, wardMult,
    amount: (form.amount ?? 0) * wardMult, enhancedAmount: (form.enhanced ?? form.amount ?? 0) * wardMult, other: (form.other ?? 0) * wardMult, grows: (form.grows ?? 0) * wardMult,
    cap: form.cap ? form.cap * wardMult : null, recover: (form.recover ?? 0) * wardMult,
    ward: form.ward, enhance: form.enhance, kind: form.kind,
    tenet: tenetWonder ? { wonder: tenetWonder.id, wonderName: tenetWonder.name, mult: iconScale(tenetStat, grade) } : null,
    durability: 20 * grade, limit: 4 * grade
  };
}

/** The Tenets a Form may be attuned to: those of Wonders of the same Alignment (Dream or Nightmare). */
export const tenetChoices = (align, state = null) => WONDERS.filter(w => w.kind === align && w.tenet && (!state || (Number(state[w.id]) || 0) >= (w.tenet.tier ?? 1)));

/* -------------------------------------------- */
/*  Numbers in text                             */
/* -------------------------------------------- */

/** Multiply the numbers in a bolded span by Power: dice counts (2d10 → 6d10) and plain numbers (20 temp HP → 60 temp HP). */
const scaleSpan = (span, P) => span.replace(/(\d+)d(\d+)/g, (m, n, sides) => `${n * P}d${sides}`).replace(/(?<![\d.d])(\d+)(?!d\d|\d)/g, (m, n) => String(n * P));
/**
 * Scale a Mode / Tenet / ability's text by Wonder Power: every bolded effect in the doc grows with it (the Mental doc lists base values).
 * `name` finds the bolded spans (`mental-bold.mjs`, generated from the doc); without them the common units are scaled instead.
 */
export function scaleMentalText(text, power, name = null) {
  const P = Math.max(1, Math.floor(power) || 1);
  const src = String(text ?? "");
  if (P <= 1) return src;
  const spans = name ? BOLD[name] : null;
  if (spans?.length) {
    let out = src;
    for (const span of spans) {
      const variants = [span, span.replace(/^\+/, "+"), span.replace(/-/g, "−")];
      const hit = variants.find(v => out.includes(v));
      if (hit) out = out.replace(hit, scaleSpan(hit, P));
    }
    return out;
  }
  return src
    .replace(/\b(\d+)d(\d+)\b/g, (m, n, sides) => `${n * P}d${sides}`)
    .replace(/\b(\d+)( (?:temp HP|health|shielding|negation|Lift|Slow stacks?)\b)/g, (m, n, rest) => `${n * P}${rest}`);
}
