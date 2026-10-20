/**
 * Concentration (Mental Theory): some Mental abilities (Trance, Premeditate) need it to keep going. You can concentrate on as many things as your Mental Theory
 * tier. Taking direct damage while concentrating costs 1 RP and a Willpower check against the damage; a lower result ends every Concentration (Composure, Ponderance
 * Arts T3: only one of your choice; Daydreaming, T5: one can't be broken, even by falling unconscious). Each Concentration is an entry in the actor's
 * `concentrating` flag; the effects it keeps going carry its id (`spellEffect.concentration`) and end with it.
 */
import { post, changeEffect, setActorFlag, spendPoints, canSpend } from "./actions.mjs";
import { askFor, everyActor } from "./ask.mjs";
import * as R from "./mental-rules.mjs";
import { tierOf } from "./skills.mjs";
import { poolFormula } from "./rules.mjs";
import { esc } from "./html.mjs";

const snapTier = actor => tierOf(actor?.system?.trees ?? {}, "mental-snappence-arts");
const ponder = actor => tierOf(actor?.system?.trees ?? {}, "mental-ponderance-arts");

/** How many things you can concentrate on: your Mental Theory tier. */
export const cap = actor => R.theoryTier(actor?.system?.trees);

/** Every effect (on anyone) kept going by this Concentration. */
export function effectsOf(actor, id) {
  const out = [];
  for (const a of everyActor()) for (const e of a.effects ?? []) {
    const d = e.flags?.flowstate?.spellEffect;
    if (d?.concentration === id && d.caster === actor.uuid) out.push(e);
  }
  return out;
}

/**
 * Your live Concentrations: { id, label, temp }. A `temp` one (Premeditate) is over as soon as its effects are gone (they end at your next turn);
 * a Trance is kept for as long as its effect exists, so it needs one too.
 */
export function list(actor) {
  const cur = actor?.getFlag?.("flowstate", "concentrating") ?? [];
  return cur.filter(c => effectsOf(actor, c.id).length > 0);
}

/** The Concentration Daydreaming protects: the one you picked (else the first). */
const protectedId = actor => (ponder(actor) >= 5 ? (actor.getFlag?.("flowstate", "daydream") && list(actor).some(c => c.id === actor.getFlag("flowstate", "daydream")) ? actor.getFlag("flowstate", "daydream") : list(actor)[0]?.id) : null);

/** Called when a Concentration ends: (actor, entry, { voluntary }) — `voluntary` when you ended it yourself, not when it was lost (an Omen's Bond, esoteric.mjs). */
export const END_HOOKS = [];

/** End one Concentration, and with it everything it was keeping going. `voluntary` is false when it was lost (damage, no RP, unconscious). */
export async function end(actor, id, why = "", { voluntary = true } = {}) {
  const cur = actor.getFlag?.("flowstate", "concentrating") ?? [];
  const entry = cur.find(c => c.id === id);
  for (const e of effectsOf(actor, id)) await changeEffect(e, null);
  await setActorFlag(actor, "concentrating", cur.filter(c => c.id !== id));
  if (entry) await post(actor, { title: `${esc(actor.name)} — Concentration`, body: `<div class="fs-notes">${esc(actor.name)} stops concentrating on <strong>${esc(entry.label)}</strong>${why ? `: ${esc(why)}` : ""}.</div>` });
  if (entry) for (const f of END_HOOKS) await f(actor, entry, { voluntary });
}

/** Start concentrating. At the cap, one has to go first (asked of the player). Returns false if it can't be done. */
export async function begin(actor, entry) {
  const cur = list(actor);
  if (cur.some(c => c.id === entry.id)) return true;
  const max = cap(actor);
  if (max < 1) { ui.notifications.warn(`${actor.name} can't concentrate (it needs Mental Theory).`); return false; }
  if (cur.length >= max) {
    const ans = await askFor(actor, { title: "Concentration", ok: "Drop it", html: `<p>${esc(actor.name)} can concentrate on ${max} thing${max === 1 ? "" : "s"}. Stop concentrating on which, to start <strong>${esc(entry.label)}</strong>?</p>
      <div class="fs-field"><label>Stop</label><select name="drop">${cur.map(c => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join("")}</select></div>` });
    const drop = cur.find(c => c.id === ans?.drop);
    if (!drop) { ui.notifications.info(`${actor.name} is already concentrating on the most they can.`); return false; }
    await end(actor, drop.id, `to concentrate on ${entry.label}`);
  }
  await setActorFlag(actor, "concentrating", [...(actor.getFlag?.("flowstate", "concentrating") ?? []).filter(c => list(actor).some(l => l.id === c.id)), entry]);
  return true;
}

/** Lose Concentrations: all of them (except the one Daydreaming protects), or just one (Composure). */
async function lose(actor, why, { oneOnly = false } = {}) {
  const prot = protectedId(actor);
  const cur = list(actor).filter(c => c.id !== prot);
  if (!cur.length) return;
  if (oneOnly && cur.length > 1) {
    const ans = await askFor(actor, { title: "Composure", ok: "Lose it", html: `<p>${esc(actor.name)} would lose their Concentration. With Composure only one goes: which?</p>
      <div class="fs-field"><label>Lose</label><select name="drop">${cur.map(c => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join("")}</select></div>` });
    const pick = cur.find(c => c.id === ans?.drop) ?? cur[0];
    return end(actor, pick.id, why, { voluntary: false });
  }
  if (oneOnly) return end(actor, cur[0].id, why, { voluntary: false });
  for (const c of cur) await end(actor, c.id, why, { voluntary: false });
}

/** Direct damage reached HP: spend 1 RP and make a Willpower check against it (a lower result loses the Concentration). Falling unconscious loses it outright. */
export async function damageCheck(actor, damage, hpAfter = actor.system?.hp?.value) {
  if (!list(actor).length || !(damage > 0)) return null;
  if (hpAfter <= 0) return lose(actor, "unconscious");
  const eff = actor.system?.derived?.effective?.will;
  if (!canSpend(actor, "rp", 1) || !(await spendPoints(actor, "rp", 1, "holding Concentration"))) return lose(actor, "no RP to hold it", { oneOnly: ponder(actor) >= 3 });
  const r = await new Roll(poolFormula(1, eff?.die ?? 10, snapTier(actor) >= 4 ? 1 : 0)).evaluate();          // Nerve (Snappence Arts T4): Advantage
  const held = r.total >= damage;
  await post(actor, { title: `${esc(actor.name)} — Concentration`, rolls: [r], body: `<div class="fs-notes">Willpower check against ${damage} damage: <strong>${r.total}</strong> — ${held ? "the Concentration holds" : "broken"}.</div>` });
  if (!held) await lose(actor, `the damage (${damage}) beat the Willpower check`, { oneOnly: ponder(actor) >= 3 });
  return held;
}

/** Daydreaming (Ponderance T5): choose which Concentration can't be broken. */
export async function chooseDaydream(actor) {
  if (ponder(actor) < 5) return;
  const cur = list(actor);
  if (cur.length < 2) return;
  const ans = await askFor(actor, { title: "Daydreaming", ok: "Protect it", html: `<p>Which Concentration can't be broken?</p><div class="fs-field"><label>Protect</label><select name="keep">${cur.map(c => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join("")}</select></div>` });
  if (ans?.keep) await setActorFlag(actor, "daydream", ans.keep);
}

/** The Action List's "End a Concentration" button. */
export async function endDialog(actor) {
  const cur = list(actor);
  if (!cur.length) return ui.notifications.info(`${actor.name} isn't concentrating on anything.`);
  const ans = await askFor(actor, { title: "Concentration", ok: "Stop", html: `<p>${esc(actor.name)} is concentrating on ${cur.length} of ${cap(actor)}. Stop which?</p>
    <div class="fs-field"><label>Stop</label><select name="drop">${cur.map(c => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join("")}</select></div>` });
  if (ans?.drop) await end(actor, ans.drop);
}
