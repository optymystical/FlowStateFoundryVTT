/**
 * Spell framework (Magic Stage 1: Magic Theory, Spell Schools, Combo Spell List). Pure functions, no Foundry globals.
 * - The catalog of Core Spells and Spell Mods is parsed from the generated skill trees ("1 Threshold, Core Spell, Ranged. …").
 * - Threshold: sum of the Core(s) and Mods, minus Threshold Reduction (TR), minimum 0. Energy = floor(Threshold × Skill Points ÷ 2).
 * - Casting options: Igniter Foci (Grasp, 2 AP, 1 TR), Channeler Foci (Reach, 3 AP, 2 TR), Raw Casting (lesser of Reach/Grasp, 1/2/3 AP = 1/2/3 TR).
 */
import { TREES } from "./trees.mjs";
import { COMBO_PAIRS, COMBO_GENERIC, COMBO_BONUS, COMBO_ILLUSION } from "./combos.mjs";
import { tierOf, isAvailable, treeById } from "./skills.mjs";

export const MIN_CAST_STAT = 10;
const SPELL_RE = /^(X\+1|\d+(?:-\d+)?) Threshold, ([^.]*)\.\s*(.*)$/s;
const ATTACK_TYPES = ["Melee", "Ranged", "Targeted", "Area", "Mixed"];

/** Parse one skill-tree entry into a spell/mod record, or null if it isn't one. */
export function parseSpellEntry(entry, tree, tier) {
  const m = SPELL_RE.exec(entry.text ?? "");
  if (!m) return null;
  const tags = m[2].split(",").map(s => s.trim());
  const kind = tags.includes("Core Spell") ? "core" : tags.includes("Spell Mod") ? "mod" : null;
  if (!kind) return null;
  const [lo, hi] = m[1] === "X+1" ? [1, 1] : m[1].split("-").map(Number);
  const name = entry.name.replace(/^#\s*/, "");
  return {
    id: `${tree.id}:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    name, kind, treeId: tree.id, school: tree.name, tier,
    min: lo, max: hi ?? lo, replicate: m[1] === "X+1",
    attack: tags.find(t => ATTACK_TYPES.includes(t)) ?? null,
    universal: tags.includes("Universal"),
    stackable: tags.includes("Stackable"),
    replacement: tags.includes("Replacement"),
    uncombinable: tags.includes("Uncombinable"),
    text: m[3].trim()
  };
}

/** Every Core Spell and Spell Mod in the Magic trees (Theory included, for its Universal Mods). */
export const CATALOG = (() => {
  const out = [];
  for (const tree of TREES.filter(t => t.archetype === "magic"))
    for (const t of tree.tiers) for (const e of t.entries) {
      const rec = parseSpellEntry(e, tree, t.tier);
      if (rec) out.push(rec);
    }
  return out;
})();
export const spellById = id => CATALOG.find(s => s.id === id) ?? null;

/** The Core Spells and Mods a character knows (tree unlocked and tier reached). */
export function knownSpells(state = {}) {
  const known = CATALOG.filter(s => isAvailable(state, treeById(s.treeId)) && tierOf(state, s.treeId) >= s.tier);
  return { cores: known.filter(s => s.kind === "core"), mods: known.filter(s => s.kind === "mod") };
}

/** Mods that can be applied to a cast with these Cores: every Universal Mod plus the chosen schools' own. */
export function applicableMods(state, coreIds) {
  const cores = coreIds.map(spellById).filter(Boolean);
  const schools = new Set(cores.map(c => c.treeId));
  return knownSpells(state).mods.filter(m => m.universal || schools.has(m.treeId));
}

/**
 * Base Threshold range for one or two Cores. A Combo is the sum of both Cores' Thresholds, except that
 * Arcanomancy adds nothing ("for no added threshold").
 */
export function baseThreshold(coreIds) {
  const cores = coreIds.map(spellById).filter(Boolean);
  if (!cores.length) return { ok: false, reason: "Pick a Core Spell.", min: 0, max: 0 };
  if (cores.length === 1) return { ok: true, min: cores[0].min, max: cores[0].max, combo: false };
  const [a, b] = cores;
  if (a.id === b.id) return { ok: false, reason: "Pick two different Core Spells.", min: 0, max: 0 };
  const un = cores.find(c => c.uncombinable);
  if (un) return { ok: false, reason: `${un.name} can't be combined.`, min: 0, max: 0 };
  const arcane = cores.find(c => c.treeId === "magic-arcanomancy");
  if (arcane) {
    const other = cores.find(c => c !== arcane);
    return { ok: true, min: other.min, max: other.max, combo: true };
  }
  return { ok: true, min: a.min + b.min, max: a.max + b.max, combo: true };
}

/**
 * Casting options for an actor. `ctx`:
 *   reach, grasp   effective stat values
 *   freeHand       true if a hand is free for Raw Casting
 *   foci           held items: [{ id, name, profile, attuned, broken, twoHanded }]
 * Each option: { key, label, form, ap: [allowed AP], tr, scaling, scalingStat, ok, reason }
 */
export function castingOptions(ctx) {
  const { reach = 0, grasp = 0, freeHand = false, foci = [] } = ctx;
  const out = [];
  const raw = (key, label, extra = {}) => {
    const ok = reach >= MIN_CAST_STAT && grasp >= MIN_CAST_STAT && !extra.reason;
    out.push({
      key, label, form: "raw", ap: [1, 2, 3], trByAp: { 1: 1, 2: 2, 3: 3 },
      scaling: Math.min(reach, grasp), scalingStat: reach <= grasp ? "reach" : "grasp",
      ok, reason: extra.reason ?? (ok ? "" : `Raw Casting needs at least ${MIN_CAST_STAT} Reach and ${MIN_CAST_STAT} Grasp.`), ...extra
    });
  };
  for (const f of foci) {
    const p = f.profile;
    if (!p?.valid) continue;
    let reason = "";
    if (!f.attuned) reason = "Not attuned.";
    else if (f.broken) reason = "Broken.";
    else if (p.deck) reason = "Deck Foci aren't automated yet.";
    else if (p.twoHandCast && !f.twoHanded) reason = "Needs two hands to cast with.";
    if (p.form === "multi") {
      raw(`foci:${f.id}`, `${f.name} (Multi, Raw Casting)`, { fociId: f.id, scaling: p.scaling, scalingStat: p.scalingStat, reason });
      continue;
    }
    const stat = p.form === "igniter" ? grasp : reach;
    const ok = !reason && stat >= MIN_CAST_STAT;
    out.push({
      key: `foci:${f.id}`, label: `${f.name} (${p.formLabel})`, form: p.form, fociId: f.id,
      ap: [Number(p.castAP)], tr: p.tr, scaling: p.scaling, scalingStat: p.scalingStat, ok,
      reason: reason || (ok ? "" : `Needs at least ${MIN_CAST_STAT} ${p.form === "igniter" ? "Grasp" : "Reach"}.`)
    });
  }
  raw("raw", "Raw Casting (free hand)", freeHand ? {} : { reason: "No free hand." });
  return out;
}

/** Spell Power: 1 per 10 points of the Scaling Stat. */
export const spellPower = scaling => Math.max(0, Math.floor(scaling / MIN_CAST_STAT));

/**
 * Total Threshold and Energy for a cast.
 * @param {object} p
 *   base        Threshold chosen for the Core/Combo (within its range)
 *   mods        [{ threshold }]  every applied Mod (stacks listed separately), free ones with threshold 0
 *   tr          total Threshold Reduction
 *   skillPoints character's Skill Points
 */
export function castCost({ base = 0, mods = [], tr = 0, skillPoints = 0 }) {
  const gross = base + mods.reduce((n, m) => n + (m.threshold ?? 0), 0);
  const threshold = Math.max(0, gross - Math.max(0, tr));
  const energy = Math.floor(threshold * skillPoints / 2);
  return { gross, tr, threshold, energy };
}

/** Universal Mods that Connection (Magic Theory T4) lets the Focused Spell use for free. */
export const CONNECTION_MODS = ["pinpoint", "empower", "snipe"];
const modKey = m => m.name.toLowerCase();

/**
 * Build a cast from the dialog's values. Never touches the actor; returns { ok, errors, … } for the caller to spend and post.
 * @param {object} ctx
 *   trees, skillPoints   the actor's trees and Skill Points
 *   options              castingOptions() result
 *   focused              the Focused Spell's Core id (Magic Theory T2)
 *   ring                 { [fociId]: coreId } chosen Core for each Ring
 *   extraTR              TR from other sources
 *   rituals              [{ id, cores, mods, freeCasts }]  active Rituals with free casts left
 * @param {object} v  dialog values: via, ap, core1, core2, base, "mod:<id>" (boolean or stack count), "modT:<id>" (Threshold per use),
 *                    "rep:<id>" (the Mod Replicate copies), connection, ritual
 */
export function planCast(ctx, v) {
  const errors = [];
  const theory = tierOf(ctx.trees, "magic-theory");
  const option = ctx.options.find(o => o.key === v.via);
  if (!option) errors.push("Pick how to cast.");
  else if (!option.ok) errors.push(option.reason || "That way of casting isn't available.");

  const coreIds = [v.core1, v.core2].filter(Boolean);
  const known = new Set(knownSpells(ctx.trees).cores.map(c => c.id));
  for (const id of coreIds) if (!known.has(id)) errors.push("You don't know that Core Spell.");
  const bt = baseThreshold(coreIds);
  if (!bt.ok) errors.push(bt.reason);
  const base = bt.ok ? Math.min(bt.max, Math.max(bt.min, Math.round(Number(v.base) || bt.min))) : 0;
  const cores = coreIds.map(spellById).filter(Boolean);

  // Mods: each applied use (stacks listed separately) with its own Threshold.
  const applied = [];
  if (bt.ok) {
    for (const m of applicableMods(ctx.trees, coreIds)) {
      const raw = v[`mod:${m.id}`];
      const count = m.stackable ? Math.max(0, Math.floor(Number(raw) || 0)) : (raw ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const t = Math.min(m.max, Math.max(m.min, Math.round(Number(v[`modT:${m.id}`]) || m.min)));
        applied.push({ mod: m, threshold: t });
      }
    }
    for (const a of [...applied]) {
      if (!a.mod.replicate) continue;
      const target = applied.find(x => x.mod.id === v[`rep:${a.mod.id}`] && !x.mod.replicate);
      if (!target) { errors.push("Replicate needs another applied Mod to copy."); a.threshold = 0; continue; }
      a.threshold = target.threshold + 1;
      a.replicates = target.mod.id;
    }
  }

  // Connection (Magic Theory T4): the Focused Spell gets Pinpoint, Empower, or Snipe free.
  const focusedCast = !!ctx.focused && theory >= 2 && cores.some(c => c.id === ctx.focused);
  let free = null;
  if (focusedCast && theory >= 4 && v.connection && CONNECTION_MODS.includes(v.connection)) {
    free = knownSpells(ctx.trees).mods.find(m => m.treeId === "magic-theory" && modKey(m) === v.connection) ?? null;
    if (free) applied.push({ mod: free, threshold: 0, free: true });
  }

  // Free cast from an active Ritual (same Core(s) and Mods): costs AP/RP but no Energy.
  let freeFrom = null;
  if (v.useRitual) {
    const r = (ctx.rituals ?? []).find(x => x.id === v.useRitual && x.freeCasts > 0);
    const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
    if (!r) errors.push("That Ritual has no free casts left.");
    else if (!same(r.cores, coreIds) || !same(r.mods, applied.filter(a => !a.free).map(a => a.mod.id))) errors.push("That Ritual is for a different spell (same Core(s) and Mods needed).");
    else freeFrom = r.id;
  }

  // Ritual Casting (Magic Theory T2).
  const ritual = !!v.ritual && theory >= 2;
  if (v.ritual && theory < 2) errors.push("Ritual Casting needs Magic Theory Tier 2.");

  const react = applied.some(a => !a.free && a.mod.treeId === "magic-theory" && modKey(a.mod) === "react");
  const ap = ritual ? 0 : option ? (option.ap.length > 1 ? Math.min(3, Math.max(1, Math.round(Number(v.ap) || option.ap[0]))) : option.ap[0]) : 0;
  const trParts = [];
  if (option) {
    const form = option.trByAp ? option.trByAp[ap] ?? 0 : option.tr ?? 0;
    trParts.push({ label: option.form === "raw" ? "Raw Casting" : option.form === "igniter" ? "Igniter" : "Channeler", value: form });
  }
  if (focusedCast) trParts.push({ label: "Focus", value: 1 });
  if (option?.fociId && ctx.ring?.[option.fociId] && cores.some(c => c.id === ctx.ring[option.fociId])) trParts.push({ label: "Ring", value: 1 });
  if (ctx.extraTR) trParts.push({ label: "Other", value: ctx.extraTR });
  const tr = trParts.reduce((n, p) => n + p.value, 0);

  const cost = castCost({ base, mods: applied, tr, skillPoints: ctx.skillPoints });
  const grossEnergy = Math.floor(cost.gross * ctx.skillPoints / 2);
  // A Combo is Targeted if either Core is (Arcanomancy keeps the other Core's type).
  const attack = !bt.ok ? null : cores.length === 1 ? cores[0].attack
    : cores.filter(c => c.treeId !== "magic-arcanomancy").some(c => c.attack === "Targeted") ? "Targeted" : "Ranged";
  return {
    ok: errors.length === 0, errors, option, cores, combo: cores.length === 2, base, applied, free, focusedCast, ritual, react,
    ap, usesRP: react && !ritual, tr, trParts, ...cost,
    energy: ritual || freeFrom ? 0 : cost.energy, freeFrom,
    ritualHours: ritual ? cost.gross : 0,
    ritualLoss: ritual ? Math.floor(grossEnergy / 2) : 0,
    power: option ? spellPower(option.scaling) : 0, scaling: option?.scaling ?? 0, scalingStat: option?.scalingStat ?? null,
    attack
  };
}

/** A spell's text without its "N Threshold, Core Spell, Ranged." header. */
export const stripHeader = text => String(text).replace(/^(?:X\+1|\d+(?:-\d+)?) Threshold, [^.]*\.\s*/, "");

const schoolSlug = c => c.treeId.replace("magic-", "");

/**
 * The effect text to show for the chosen Core(s): the Core's own text for one, or the Combo Spell List entry for two
 * (an "Any T1/T2/T3 + …" combo adds the other school's line from its chart). Returns { title, text } or null.
 */
export function effectText(coreIds) {
  const cores = coreIds.map(spellById).filter(Boolean);
  if (cores.length === 1) return { title: cores[0].name, text: stripHeader(cores[0].text) };
  if (cores.length !== 2) return null;
  const [a, b] = cores.map(schoolSlug);
  const title = `${cores[0].name} + ${cores[1].name} (Combo Spell)`;
  const listed = COMBO_PAIRS[[a, b].sort().join("+")];
  if (listed) return { title, text: listed.text };
  for (const [special, other] of [[a, b], [b, a]]) {
    const g = COMBO_GENERIC[special];
    if (!g) continue;
    if (special === "arcanomancy") return { title, text: g.text };
    const chart = special === "illusion" ? COMBO_ILLUSION : COMBO_BONUS;
    const line = chart[other === "witchery" ? "hex" : other];
    return { title, text: `${g.text}${line ? ` Added effect (${other[0].toUpperCase()}${other.slice(1)}): ${line}` : ""}` };
  }
  return { title, text: "See the Combo Spell List for this Combo's effect." };
}
