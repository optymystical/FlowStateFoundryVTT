/**
 * Automation a character can switch on (the sheet's Reaction List tab, flag `automation`): Auto-Dodge (with the defensive reactions to try first when
 * Energy/RP allow), Auto-Limber, and keeping start-of-turn abilities up. Pure: no Foundry globals.
 */

/** Reactions Auto-Dodge can try before dodging, in the order it tries them. Each one only fires if it is offered and affordable. */
export const DODGE_TRIES = [
  { key: "perfectBlock", label: "Perfect Block", tip: "Defender T5: an attack roll against the incoming one; on a hit it's negated." },
  { key: "perfectParry", label: "Perfect Parry", tip: "Curved T2: with an active Curved Parry, an attack roll with Advantage against the incoming one." },
  { key: "distract", label: "Distracting Fire", tip: "Assault T3: against an Area attack, re-roll it with Disadvantage and Weakened." },
  { key: "dash", label: "Dash", tip: "Unarmored: the attack is re-rolled with Disadvantage, then you move." },
  { key: "closeQuarters", label: "Close Quarters", tip: "Bladed T2: a melee attack is made at double Disadvantage." },
  { key: "shift", label: "Shift", tip: "Medium T4 / Light T1: Advantage on your dodge, or Disadvantage on the attack." }
];

/** Start-of-turn abilities that can be kept up automatically (paid at the start of each turn while Energy allows). */
export const KEEP_UP = [
  { key: "berserk", label: "Berserk", tip: "Striker T2: maintained (or started) at the start of your turn." },
  { key: "properStance", label: "Proper Stance", tip: "Assault T5." },
  { key: "quicken", label: "Quicken", tip: "Unarmored T4." },
  { key: "smashing", label: "Smashing", tip: "Weighted T4." }
];

/** Shift's two modes (Auto-Dodge picks one). */
export const SHIFT_MODES = [["adv", "Advantage on my dodge roll"], ["dis", "Disadvantage on the incoming attack roll"]];

/** A character's automation settings, with every field filled in. */
export function automationOf(actor) {
  const a = actor?.getFlag?.("flowstate", "automation") ?? {};
  const tries = Object.fromEntries(DODGE_TRIES.map(t => [t.key, a.dodge?.tries?.[t.key] !== false]));          // on unless switched off
  return {
    dodge: { on: a.dodge?.on === true, tries, shiftMode: a.dodge?.shiftMode === "dis" ? "dis" : "adv" },
    limber: a.limber === true,
    keep: Object.fromEntries(KEEP_UP.map(k => [k.key, a.keep?.[k.key] === true]))
  };
}

/** The reactions Auto-Dodge tries for this character, in order. */
export const dodgeTries = auto => DODGE_TRIES.filter(t => auto.dodge.tries[t.key]).map(t => t.key);

/**
 * Remembered dialog values: what a dialog saves for next time. Situational fields aren't kept: the Advantage/Strengthened adjusters, aiming at a
 * particular item, a Disarm pick, the unarmed fist the weapon field answers for.
 */
const NOT_REMEMBERED = new Set(["net", "stacks", "extra", "aim", "disarm"]);
export function rememberable(values) {
  return Object.fromEntries(Object.entries(values ?? {}).filter(([k, v]) => !NOT_REMEMBERED.has(k.split(".").pop()) && v !== undefined && typeof v !== "object"));
}

/** Split a dialog's values into the attack's own and the planned follow-up's (`fu` picks it; its fields are `fu.<n>.<name>`). */
export function splitFollowup(values) {
  const own = {}, picked = values?.fu ?? "";
  let idx = null;
  const fuFields = {};
  for (const [k, v] of Object.entries(values ?? {})) {
    if (k === "fu") continue;
    const m = /^fu\.(\d+)\.(.+)$/.exec(k);
    if (m) { (fuFields[m[1]] ??= {})[m[2]] = v; continue; }
    own[k] = v;
  }
  if (picked && picked !== "none") idx = String(picked).split("|")[0];
  return { own, pick: picked || "", fields: idx !== null ? fuFields[idx] ?? {} : {} };
}

/** First option of every select in a dialog's HTML (an automatic answer to a dialog nobody sees), with `values` taking precedence. */
export function autoValues(html, values = {}) {
  const out = { net: 0, stacks: 0, extra: 0 };
  for (const m of String(html).matchAll(/<select name="([^"]+)"[^>]*>\s*<option value="([^"]*)"/g)) out[m[1]] = m[2];
  return { ...out, ...values };
}
