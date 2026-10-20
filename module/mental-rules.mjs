/**
 * Mental rules (Mental Rework Test Ground + Equipment doc). Pure: no Foundry globals, so it's unit-tested outside Foundry.
 * Wonders are the Mental skill trees named "<Name> (Dream)" or "<Name> (Nightmare)"; each has Modes (Manifested as attacks), a Tenet,
 * and abilities/passives. Icons are the Mental equipment: a Form with a Ward effect and a Tenet.
 */
import { TREES } from "./trees.mjs";
import { BOLD } from "./mental-bold.mjs";
import { applyStacks } from "./rules.mjs";

/**
 * Strengthened/Weakened stacks on a Manifest (Alignment 2, a Weakened Area, Adapt...) scale its bolded effects: the number after the stacks, rounded down.
 * `stacks` is the Manifest's net stacks (`c.stacks`; an effect stored for later keeps them as `bstacks`).
 */
export const bold = (stacks, n) => Math.floor(applyStacks(n, Number(stacks) || 0));

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

const isTenet = e => /^Only active while/i.test(e.text ?? "");

/** "Bloom: …" → { base, enhanced } (the part after "Enhanced:" is what Enhancing adds or changes). */
function splitEnhanced(text) {
  const m = /\s*\bEnhanced:\s*/.exec(text ?? "");
  return m ? { base: text.slice(0, m.index).trim(), enhanced: text.slice(m.index + m[0].length).trim() } : { base: String(text ?? "").trim(), enhanced: "" };
}

/** "You gain the following Mode, passive, and Tenet:" → ["mode", "passive", "tenet"]: what each of a tier's entries is, in order. */
const tierKinds = summary => (/following\s+(.*?):?\s*$/i.exec(summary ?? "")?.[1] ?? "").split(/\s*,\s*(?:and\s+)?|\s+and\s+/i).map(s => s.trim().toLowerCase().replace(/s$/, "")).filter(Boolean);

/** One Wonder parsed from its skill tree: its Modes (with the tier they unlock), Tenet, abilities/passives, and its table if it has one (Fortune). */
function parseWonder(tree) {
  const kind = wonderKind(tree);
  if (!tree || tree.archetype !== "mental" || tree.theory || !kind) return null;
  const name = tree.name.replace(/\s*\((Dream|Nightmare)\)\s*$/i, "");
  const out = { id: tree.id, name, kind, requires: tree.requires, modes: [], tenet: null, abilities: [], table: tree.table ?? null };
  for (const t of tree.tiers) {
    const modeTier = /\bModes?\b/i.test(t.summary ?? "");
    // "the following Mode" (one) makes only the first entry that isn't the Tenet a Mode: the others are what it does (Stagnation's Toll and Silt).
    let modesLeft = /\bModes\b/i.test(t.summary ?? "") ? Infinity : 1;
    // When the tier names one kind per entry ("Mode, passive, and Tenet"), that says which entry is the Mode.
    const kinds = tierKinds(t.summary);
    for (const [i, entry] of t.entries.entries()) {
      // Sub-points (a Mode's "Against an enemy / ally" and "Enhanced" lines, Bands) are listed under the entry in the Skills tab; the game reads them as one text.
      const e = entry.sub?.length ? { ...entry, text: withSubs(entry) } : entry;
      if (isTenet(e)) { out.tenet = { name: e.name, text: e.text, tier: t.tier, id: `${tree.id}:${slug(e.name)}` }; continue; }
      if (kinds.length === t.entries.length ? kinds[i] === "mode" : modeTier && modesLeft-- > 0) out.modes.push({ id: `${tree.id}:${slug(e.name)}`, wonder: tree.id, name: e.name, tier: t.tier, text: e.text, ...splitEnhanced(e.text) });
      else out.abilities.push({ id: `${tree.id}:${slug(e.name || "x")}`, wonder: tree.id, name: e.name, tier: t.tier, text: e.text });
    }
  }
  return out;
}

/**
 * An entry's text with its sub-points. Sub-points that are options of the Mode (Cultivate's Flourish and Thrift) go before an inline "Enhanced:" clause,
 * so they stay part of the base effect; "Against an enemy / ally" and "Enhanced" lines follow the text as they are.
 */
function withSubs(entry) {
  const at = entry.text.search(/\bEnhanced:/);
  if (at > 0 && !entry.sub.some(s => /^(Enhanced|Against an?)\b/i.test(s))) return [entry.text.slice(0, at).trim(), ...entry.sub, entry.text.slice(at)].join(" ");
  return [entry.text, ...entry.sub].join(" ");
}

/** Every Wonder, parsed from the skill trees (rebuilt when the trees change: a world's own edits). */
export const WONDERS = [];
export function rebuildWonders() { WONDERS.length = 0; WONDERS.push(...TREES.map(parseWonder).filter(Boolean)); }
rebuildWonders();
export const wonderById = id => WONDERS.find(w => w.id === id) ?? null;
export const modeById = id => WONDERS.flatMap(w => w.modes).find(m => m.id === id) ?? null;

/**
 * Trance (Mental T2): is this Mode's baseline (unenhanced) effect hostile? A hostile Mode becomes an ability the Tranced creature can use on others; any other
 * applies to them at the start of their turns. It goes by what the Mode does to its target, not its Wonder's type: Nightmare Modes are hostile and Dream ones
 * aren't, except these. Illuminate and Eclipse count as non-hostile: a willing Trance target gets their ally version (the user's ruling).
 */
const HOSTILE_EXCEPTIONS = {
  "mental-peace-dream:pacify": true, "mental-beyond-dream:herald": true, "mental-adaptation-dream:crescendo": true, "mental-fortune-dream:wager": true,
  "mental-light-dream:dispersion": true, "mental-fortune-dream:providence": true,
  "mental-war-nightmare:warzone": false, "mental-war-nightmare:bloodbond": false, "mental-perfection-nightmare:hone": false,
  "mental-dark-nightmare:umbral-strike": false, "mental-dark-nightmare:eclipse": false
};
export const modeHostile = id => (id in HOSTILE_EXCEPTIONS ? HOSTILE_EXCEPTIONS[id] : wonderById(modeById(id)?.wonder)?.kind === "nightmare");

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
export function manifestCost({ range = "ranged", enhance = false, burst = false, enhanceCost = 0, free = false, waive = {}, freeEnhance = false }) {
  const base = RANGES[range]?.ap ?? 2;
  const w = free ? { ap: true, rp: true, energy: true } : waive;
  const energy = w.energy ? 0 : (enhance && !freeEnhance ? enhanceCost : 0) + (burst ? enhanceCost : 0);          // `freeEnhance`: a self-Trance of this hostile Mode
  return { ap: burst || w.ap ? 0 : base, rp: burst && !w.rp ? base : 0, energy, burst, enhance };
}
/** Can this Wonder be Manifested, and at what Power? */
export function manifestCheck(wonder, stat, bonusPct = 0) {
  const power = wonderPower(stat, bonusPct);
  if (power < 1) return { ok: false, power, reason: `${KINDS[wonder.kind].statLabel} is under 10, so ${wonder.name} can't be Manifested.` };
  return { ok: true, power };
}

/**
 * Fortune's Bands: a Fortune Manifest can't crit; where its attack roll lands as a fraction of the attack die's max decides instead. Under one half it hits
 * you ({ self: true }); one half up to three quarters gives 2 Strengthened, three quarters or more 4. Double Down (Fortune T4) adds 8 at seven eighths or more,
 * and Strengthens the self hits: 2 from one eighth to under one half, 4 under one eighth.
 */
export function fortuneBand(total, die, doubleDown = false) {
  const f = (Number(total) || 0) / Math.max(1, Number(die) || 1);
  if (f < 0.5) return { self: true, stacks: doubleDown ? (f < 0.125 ? 4 : 2) : 0, label: `under one half${doubleDown ? (f < 0.125 ? " (under one eighth)" : "") : ""}: it hits you instead` };
  if (doubleDown && f >= 0.875) return { self: false, stacks: 8, label: "seven eighths or higher: 8 Strengthened" };
  if (f >= 0.75) return { self: false, stacks: 4, label: "three quarters or higher: 4 Strengthened" };
  return { self: false, stacks: 2, label: "one half to under three quarters: 2 Strengthened" };
}
/**
 * Ruin's Bands: the attack roll that resolves a creature's Jinxes, as a fraction of its die's max. Under one half they all fizzle; one half to under three quarters
 * gives them 2 Strengthened, three quarters or higher 4.
 */
export function ruinBand(total, die) {
  const f = (Number(total) || 0) / Math.max(1, Number(die) || 1);
  if (f < 0.5) return { fizzle: true, stacks: 0, label: "under one half: the Jinxes fizzle" };
  return f >= 0.75 ? { fizzle: false, stacks: 4, label: "three quarters or higher: 4 Strengthened" } : { fizzle: false, stacks: 2, label: "one half to under three quarters: 2 Strengthened" };
}
/** Reversal (Ruin T4): a die's result flipped: its size + 1 − the result. */
export const flipRoll = (total, die) => Math.max(1, (Number(die) || 1) + 1 - (Number(total) || 0));
/** Parlay (Fortune T2): Strengthened stacks multiply (×1.5 each) instead of adding; Weakened is unchanged. */
export const fortuneScale = (value, stacks, parlay = false) => (parlay && stacks > 0 ? Math.floor(value * Math.pow(1.5, stacks)) : applyStacks(value, stacks));

/* -------------------------------------------- */
/*  Alignment                                   */
/* -------------------------------------------- */

export const ALIGNMENTS = { neutral: "Neutral", dream: "Dream", nightmare: "Nightmare" };
export const MAX_ALIGNMENT = 4;
export const ALIGN_SPEED_PCT = 20;

/**
 * An Alignment is a kind (Dream or Nightmare) and how far you went (1 to 4, Neutral = 0). It is set with a 1 hour activity, and every point costs 20% speed.
 * It shapes your Form's Ward (see `alignmentWard`). Depths 3 and 4 need Deepening (Mental T3), which also costs 1 AP a turn per point past 2.
 */
export function alignmentState(raw) {
  const kind = raw?.kind === "dream" || raw?.kind === "nightmare" ? raw.kind : "neutral";
  const level = kind === "neutral" ? 0 : Math.max(0, Math.min(MAX_ALIGNMENT, Math.floor(Number(raw?.level)) || 0));
  return level ? { kind, level } : { kind: "neutral", level: 0 };
}

/** What the sheet calls it: "Dream 2", "Neutral". */
export function alignmentLabel(state) {
  const s = alignmentState(state);
  return s.level ? `${ALIGNMENTS[s.kind]} ${s.level}` : "Neutral";
}

/** Speed lost to Alignment: 20% per point. */
export const alignmentSpeedPct = state => ALIGN_SPEED_PCT * alignmentState(state).level;

/** Deepening (Mental T3): AP lost each turn to Alignment past 2 (-1 at 3, -2 at 4). */
export const alignmentApLoss = state => Math.max(0, alignmentState(state).level - 2);

/** The deepest Alignment a character may set: 2 at first, 4 with Deepening (Mental Theory T3). */
export const maxAlignment = theoryTier => (theoryTier >= 3 ? MAX_ALIGNMENT : 2);

/** What an Alignment does, in words (for the Action List, the dialog and the cards). */
export function alignmentBlurb(raw) {
  const st = alignmentState(raw);
  if (!st.level) return "Neutral: no benefits and no speed penalty.";
  const own = st.kind === "dream" ? "Dream" : "Nightmare";
  return [st.level >= 3 ? `3: your ${own} Form's Ward is made from half stealth (Advantage, and the target dodges with Disadvantage).` : `1: your ${own} Form's Ward has Advantage on its attack rolls.`,
    st.level >= 2 ? `2: your ${own} Form's Ward bolded effect is Strengthened.` : "",
    st.level >= 4 ? `4: your ${own} Form's Ward hits regardless of the roll (the roll only decides a crit).` : "",
    `Speed lowered by ${alignmentSpeedPct(st)}%${st.level > 2 ? `, and ${alignmentApLoss(st)} AP less each turn` : ""}.`].filter(Boolean).join(" ");
}

/**
 * What Alignment does to the Ward of a Form of `kind` (only your own type's Form benefits):
 *  - 1: Advantage on its attack roll. 2: its bolded effect is Strengthened.
 *  - 3: made from half stealth: Advantage, and whoever dodges it has Disadvantage (`dodgeNet`).
 *  - 4: it hits regardless of the roll (`autoHit`); the roll only decides whether it crits.
 */
export function alignmentWard(state, kind) {
  const s = alignmentState(state);
  if (!s.level || s.kind !== kind) return { net: 0, stacks: 0, dodgeNet: 0, autoHit: false };
  return { net: 1, stacks: s.level >= 2 ? 1 : 0, dodgeNet: s.level >= 3 ? -1 : 0, autoHit: s.level >= 4 };
}

/** Are you Aligned towards this type of Wonder (Dream or Nightmare, at least 1 Alignment)? */
export function alignedTo(state, kind) {
  const s = alignmentState(state);
  return s.level >= 1 && s.kind === kind;
}

/** Fluidity (Mental T4): energy equal to half your Skill Points multiplied by your current Alignment number swaps its type. */
export const fluidityCost = (state, skillPoints = 0) => Math.floor(skillPoints / 2) * alignmentState(state).level;

/* -------------------------------------------- */
/*  Icons and Forms                             */
/* -------------------------------------------- */

const f = (name, align, rarity, ward, enhance, extra = {}) => ({ name, align, rarity, ward, enhance, ...extra });
/** Forms from the Equipment doc. `kind`: how the engine plays the Ward: shield (1 AP, stacking shielding), negate (reaction, RP), persistent, charge. */
export const FORMS = {
  aegis: f("Aegis", "dream", "common", "For 1 AP, provides 8 shielding, lasting until the start of your next turn. This effect stacks.", "Instead provides 15 shielding.", { kind: "shield", amount: 8, enhanced: 15, ap: 1 }),
  sanctum: f("Sanctum", "dream", "common", "For 1 AP, provides 8 shielding, lasting until the start of your next turn. This effect stacks.", "The shield provided lasts an additional turn.", { kind: "shield", amount: 8, enhanced: 8, ap: 1, extraTurn: true }),
  prism: f("Prism", "dream", "uncommon", "For 1 AP, provides 25 shielding against specifically Physical, Elemental, or Magical damage, lasting until the start of your next turn. This effect stacks.", "The shield protects against two chosen damage types.", { kind: "shield", amount: 25, enhanced: 25, ap: 1, typed: true }),
  vigil: f("Vigil", "dream", "uncommon", "Provides a passive 40 shielding that does not decay or naturally regenerate. Instead, on your turn you can spend 1 AP to recover 8 shielding for this effect (still requires a hit). Project/Expansion causes this persistent shield to apply to the target(s) instead.", "The recovery attack automatically succeeds.", { kind: "persistent", amount: 40, recover: 8, ap: 1 }),
  anchor: f("Anchor", "dream", "rare", "For 1 AP, provides 8 shielding, lasting until the start of your next turn. This effect stacks. If you have not moved since the start of your turn, damage dealt to this shielding is Weakened (the Weakened does not stack with multiple instances of this shield).", "The Weakened persists beyond the shield, now applying to all damage you would take until the start of your next turn, so long as you do not move.", { kind: "shield", amount: 8, enhanced: 8, ap: 1, anchor: true }),
  reverie: f("Reverie", "dream", "rare", "Can only be activated while you are at 2+ Dream Alignment. For 1 AP, provides 12 shielding, lasting until the start of your next turn. This effect stacks up to 40 shielding, and holds between turns so long as you remain at 2+ Dream Alignment.", "If you are at 4+ Dream Alignment, whenever you Manifest a Dream successfully, add 4 shielding to this effect, up to the cap. This effect stacks, so multiple instances increase the shielding provided per Manifest.", { kind: "shield", amount: 12, enhanced: 12, ap: 1, cap: 40, needs: "dream" }),
  premonition: f("Premonition", "dream", "very rare", "For 1 AP, store one charge of Premonition until the start of your next turn. Whenever you would take damage, you can consume up to one charge of Premonition to negate 40 of that damage.", "When you store the charge, declare an attack source. If, on activation, the declared source is the one causing the damage, it gets a stack of Weakened.", { kind: "charge", amount: 40, enhanced: 40, ap: 1 }),
  veil: f("Veil", "nightmare", "common", "When you would take damage, spend 1 RP to negate up to 4 of that damage. Can be used multiple times per damage instance.", "Instead provides 8 negation.", { kind: "negate", amount: 4, enhanced: 8 }),
  warden: f("Warden", "nightmare", "common", "When you would take damage, spend 1 RP to negate up to 5 of that damage. Can be used multiple times per damage instance.", "After negation occurs and damage resolves, if the source of the damage is within 100ft, make a Ranged attack roll against them. On hit, the damage negated is dealt to them. Only one attack needs to be made per damage instance, regardless of times this Ward was used.", { kind: "negate", amount: 5, enhanced: 5, reflect: "ranged" }),
  bane: f("Bane", "nightmare", "uncommon", "When you attune to this Form, select Physical, Elemental, or Magical damage. When you would take damage, spend 1 RP to negate up to 6 of that damage if it matches the chosen damage type, or 3 of that damage otherwise. Can be used multiple times per damage instance.", "If the incoming damage matches the type of damage this Form is set against, give that incoming damage a stack of Weakened on hit (once per damage instance).", { kind: "negate", amount: 6, other: 3, enhanced: 6, chooses: "category" }),
  grudge: f("Grudge", "nightmare", "uncommon", "When you would take damage, spend 1 RP to negate up to 4 of that damage. Increases by 4 negation per instance of this Ward used in the same damage instance. Can be used multiple times per damage instance.", "Treat this effect as if it already triggered one additional time for the purposes of increasing the negation amount.", { kind: "negate", amount: 4, enhanced: 4, grows: 4 }),
  riposte: f("Riposte", "nightmare", "rare", "When you would take damage, spend 1 RP to negate up to 10 of that damage if the attack’s source is within your melee range, or 4 of that damage otherwise. Can be used multiple times per damage instance.", "After negation occurs and damage resolves, if the source of the damage is within melee range, make a Melee attack roll against them with advantage. On hit, the damage negated is dealt to them. Only one attack needs to be made per damage instance, regardless of times this Ward was used.", { kind: "negate", amount: 10, other: 4, enhanced: 10, near: true, reflect: "melee" }),
  zealot: f("Zealot", "nightmare", "rare", "When you would take damage, spend 1 RP to negate up to 6 of that damage so long as you are at 2+ Nightmare Alignment, providing 4 negation otherwise. Can be used multiple times per damage instance.", "If you are at 4+ Nightmare Alignment, the incoming damage is Weakened on crit (only applies once per damage instance).", { kind: "negate", amount: 6, other: 4, enhanced: 6, needs: "deepNightmare" }),
  echo: f("Echo", "nightmare", "very rare", "When you would take damage, spend 1 RP to negate up to 3 of that damage. Can be used multiple times per damage instance. If this fully negates the attack, this effect is now applied for free to all instances of damage you would take until the start of your next turn. This effect stacks.", "Instead provides 6 negation.", { kind: "negate", amount: 3, enhanced: 6, echo: true })
};
export const FORM_KEYS = [];
export function rebuildFormKeys() { FORM_KEYS.length = 0; FORM_KEYS.push(...Object.keys(FORMS)); }
rebuildFormKeys();
export const formGroups = () => Object.entries(KINDS).map(([k, v]) => ({ label: `${v.label} Forms`, options: Object.fromEntries(Object.entries(FORMS).filter(([, x]) => x.align === k).map(([id, x]) => [id, `${x.name} (${x.rarity})`])) }));

/** Stat that affects an Icon: scaled per 10, limited by Grade (10 per Grade). Always at least ×1. */
export const iconScale = (stat, grade) => Math.max(1, Math.floor(Math.min(Number(stat) || 0, Math.max(1, grade) * 10) / 10));

/** The Ward and Tenet numbers on an Icon for a character (Willpower for the Ward, the Tenet Wonder's stat for the Tenet). */
export function iconProfile(item, stats = {}) {
  const form = FORMS[item.form];
  if (!form) return { valid: false, error: "Pick a Form." };
  // A natural Icon (an Omen is its own) has no Grade: its numbers scale with the stats uncapped; its Durability counts a Grade per 10 Willpower.
  const natural = !!item.natural;
  const cap = natural ? Infinity : Math.max(1, item.grade || 1);
  const grade = natural ? Math.max(1, Math.floor((Number(stats.will) || 0) / 10)) : cap;
  const wardMult = iconScale(stats.will ?? 0, cap);
  const tenetWonder = item.tenet ? wonderById(item.tenet.split(":")[0]) : null;
  const tenetStat = tenetWonder ? stats[KINDS[tenetWonder.kind].stat] ?? 0 : 0;
  return {
    valid: true, form: item.form, name: form.name, align: form.align, rarity: form.rarity, grade, natural, wardMult,
    amount: (form.amount ?? 0) * wardMult, enhancedAmount: (form.enhanced ?? form.amount ?? 0) * wardMult, other: (form.other ?? 0) * wardMult, grows: (form.grows ?? 0) * wardMult,
    cap: form.cap ? form.cap * wardMult : null, recover: (form.recover ?? 0) * wardMult,
    ward: scaleFormText(form.ward, wardMult), enhance: scaleFormText(form.enhance, wardMult), kind: form.kind,
    tenet: tenetWonder ? { wonder: tenetWonder.id, wonderName: tenetWonder.name, mult: iconScale(tenetStat, cap) } : null,
    durability: 20 * grade, limit: 4 * grade
  };
}

/** A Form's Ward / Enhance text with its numbers scaled by the Icon (shielding, negation and "N of that damage" grow with Willpower and Grade; AP, RP and Alignment numbers don't). */
export const scaleFormText = (text, mult, stacks = 0) => String(text ?? "").replace(/(\d+)(?=\s+(?:shielding|negation|of that|damage otherwise))/g, (m, n) => String(Math.floor(applyStacks(Number(n) * mult, stacks))));          // `stacks`: the Alignment (or other) Strengthened on the Ward

/** The Tenets a Form may be attuned to: those of Wonders of the same Alignment (Dream or Nightmare). */
export const tenetChoices = (align, state = null) => WONDERS.filter(w => w.kind === align && w.tenet && (!state || (Number(state[w.id]) || 0) >= (w.tenet.tier ?? 1)));

/* -------------------------------------------- */
/*  Numbers in text                             */
/* -------------------------------------------- */

/** Multiply the numbers in a bolded span by Power: dice counts (2d10 → 6d10) and plain numbers (20 temp HP → 60 temp HP, 1.5ft → 4.5ft). */
const scaleSpan = (span, P) => span.replace(/(\d+)d(\d+)/g, (m, n, sides) => `${n * P}d${sides}`)
  .replace(/(?<![\d.d])(\d+(?:\.\d+)?)(?!d\d|[\d.])/g, (m, n) => String(Math.round(Number(n) * P * 10) / 10));
/**
 * A Wonder table row's effect with its bolded values (`spans`, in order, from the doc) multiplied by `power`: each span is found after the last one, so a
 * plain "10" can't be mistaken for an earlier number.
 */
export function scaleSpans(text, spans, power) {
  const P = Math.max(1, Math.floor(power) || 1);
  let out = String(text ?? "");
  if (P <= 1 || !spans?.length) return out;
  let at = 0;
  for (const span of spans) {
    const i = out.indexOf(span, at);
    if (i < 0) continue;
    const scaled = scaleSpan(span, P);
    out = out.slice(0, i) + scaled + out.slice(i + span.length);
    at = i + scaled.length;
  }
  return out;
}

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
      // A phrase bolded more than once (Illuminate's "die size reduced by 1", in both versions) scales everywhere; a bare number only where it first appears.
      if (hit) out = hit.length >= 8 ? out.split(hit).join(scaleSpan(hit, P)) : out.replace(hit, scaleSpan(hit, P));
    }
    return out;
  }
  return src
    .replace(/\b(\d+)d(\d+)\b/g, (m, n, sides) => `${n * P}d${sides}`)
    .replace(/\b(\d+)( (?:temp HP|health|shielding|negation|Lift|Slow stacks?)\b)/g, (m, n, rest) => `${n * P}${rest}`);
}
