/**
 * Mental Theory's Concentration-based abilities and the Ponderance Arts (Mental doc):
 *  - Trance (Theory T2): 8 hours to make a Mode permanent on a willing target, for as long as you concentrate on it. A Dream Mode takes hold at the start of
 *    each of the target's turns if they succeed on a self attack roll; a hostile one (`modeHostile`: Pacify, Wither...) becomes an ability the target can use, with your Power and their dice.
 *  - Premeditate (Ponderance T1): a Manifest that hits is stored (Strengthened) on its target, to take hold when a preset action happens (Concentration).
 *  - Mantra (T2): asked as a Tenet is used; double its bolded effect for half the Scaling Stat min in Energy. Composure (T3) and Daydreaming (T5) shape Concentration (concentration.mjs).
 *  - Forethought (T4): your Tenet applies to each Premeditated Wonder for free, outside its once per round limit.
 */
import { post, putSpellEffect, spellEffects, changeEffect, inActiveCombat } from "./actions.mjs";
import { askFor, everyActor } from "./ask.mjs";
import { poolFormula, resolveAttack } from "./rules.mjs";
import * as R from "./mental-rules.mjs";
import * as ab from "./abilities.mjs";
import { tierOf } from "./skills.mjs";
import * as conc from "./concentration.mjs";
import { mental, mantraHook, TURN_START, tenetOf } from "./wonders.mjs";

const esc = s => foundry.utils.escapeHTML?.(String(s)) ?? String(s);
const trees = a => a?.system?.trees ?? {};
export const ponderTier = actor => tierOf(trees(actor), "mental-ponderance-arts");
const minOf = (a, k) => ab.statMinOf(a, k);
const uid = () => foundry.utils.randomID?.() ?? String(Math.random()).slice(2);

/** The Mode the caster would Manifest at this Wonder Power: what a stored or permanent copy of it carries. */
function modeMental(caster, mode, extra = {}) {
  const wonder = R.wonderById(mode.wonder), kind = R.KINDS[wonder.kind];
  const power = R.manifestCheck(wonder, caster.system.derived.effective[kind.stat].value).power;
  return { mode: mode.id, wonder: wonder.id, kind: wonder.kind, power, enhanced: false, burst: false, range: "ranged", alignStacks: 0, text: R.scaleMentalText(mode.base, power, mode.name),
    caster: caster.uuid, choices: {}, uid: uid(), ...extra };
}

/* -------------------------------------------- */
/*  Premeditate                                 */
/* -------------------------------------------- */

/** A Premeditated Manifest hit: keep it on the target instead of applying it. Called by `landManifest`. */
export async function storePremeditated({ attacker, target, m, mode, stacks }) {
  const id = `premeditate:${m.uid}`;
  if (!(await conc.begin(attacker, { id, label: `Premeditated ${mode.name}` }))) return `<strong>${esc(mode.name)}</strong> can't be stored: ${esc(attacker.name)} can't concentrate on any more.`;
  const ans = await askFor(attacker, { title: "Premeditate", ok: "Store it", html: `<p>${esc(mode.name)} is stored on ${esc(target.name)}. It takes hold when this happens (your choice):</p>
    <div class="fs-field"><label>Preset action</label><input type="text" name="trigger" value="attacks, dodges or moves"></div>` });
  const trigger = String(ans?.trigger || "attacks, dodges or moves");
  await putSpellEffect(target, { kind: "premeditated", stack: true, caster: attacker.uuid, concentration: id, name: `Premeditated: ${mode.name}`, trigger, stored: { m: { ...m, premeditate: false }, stacks: (stacks ?? 0) + 1 },
    description: `${attacker.name}'s ${mode.name}, stored (Strengthened) until ${trigger}. It ends at the start of ${attacker.name}'s next turn if it isn't used, or if the Concentration breaks.` });
  return `<strong>${esc(mode.name)}</strong> is <strong>premeditated</strong> on ${esc(target.name)} (Strengthened): it takes hold when they ${esc(trigger)}. ${esc(attacker.name)} is concentrating on it.`;
}

/** The preset action happened: the stored Mode lands on its target. */
export async function triggerPremeditated(caster, effect) {
  const d = effect?.flags?.flowstate?.spellEffect;
  if (!d?.stored) return false;
  const target = effect.parent;
  const mode = R.modeById(d.stored.m.mode);
  if (!mode || !target) return false;
  await changeEffect(effect, null);
  const m = { ...d.stored.m, forethought: ponderTier(caster) >= 4 };
  const out = await mental.landManifest({ attacker: caster, target, o: { stacks: 0, label: `Premeditated ${mode.name}` }, m, mode, result: { hit: true, crit: false, critStacks: 0, outcome: "Hit" }, stacksBase: d.stored.stacks });
  await post(caster, { title: `${esc(caster.name)} — Premeditated ${esc(mode.name)}`, rolls: out.rolls, body: out.html });
  return true;
}

/** Premeditated effects this caster has stored on others. */
export const premeditatedBy = caster => everyActor().flatMap(a => spellEffects(a, "premeditated").filter(e => e.flags.flowstate.spellEffect.caster === caster.uuid));

/* -------------------------------------------- */
/*  Trance                                      */
/* -------------------------------------------- */

/** Trance (Mental Theory T2): 8 hours (not in combat) to make a Mode permanent on a willing target, for as long as you keep concentrating on it. */
export async function trance(actor) {
  if (R.theoryTier(trees(actor)) < 2) return ui.notifications.warn("Trance is a Mental Theory Tier 2 ability.");
  if (inActiveCombat(actor)) return ui.notifications.warn("Trance takes 8 hours, so it can't be done in combat.");
  const target = [...(game.user?.targets ?? [])].map(t => t.actor).find(a => a && a.type !== "pile") ?? actor;
  const known = R.knownWonders(trees(actor)).filter(w => w.modes.length);
  if (!known.length) return ui.notifications.warn(`${actor.name} doesn't know any Wonder Modes yet.`);
  const out = await foundry.applications.api.DialogV2.prompt({ window: { title: `Trance: ${actor.name}` }, rejectClose: false,
    content: `<div class="fs-cast"><p>8 hours with <strong>${esc(target.name)}</strong> (they must take part): the Mode you pick stays active on them for as long as you concentrate on it.</p>
      <div class="fs-field"><label>Mode</label><select name="mode">${known.map(w => `<optgroup label="${esc(w.name)}">${w.modes.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")}</optgroup>`).join("")}</select></div></div>`,
    ok: { label: "Begin the Trance", callback: (event, button) => button.form.elements.mode.value } });
  const mode = R.modeById(out);
  if (!mode) return null;
  const id = `trance:${uid()}`;
  if (!(await conc.begin(actor, { id, label: `Trance: ${mode.name} on ${target.name}` }))) return null;
  const mm = modeMental(actor, mode);
  const hostile = R.modeHostile(mode.id);          // by what the Mode does to its target (Pacify is hostile, Hone isn't), not by Dream / Nightmare
  await putSpellEffect(target, { kind: "trance", stack: true, persistent: true, caster: actor.uuid, concentration: id, name: `Trance: ${mode.name}`, mode: mode.id, power: mm.power, hostile, m: mm,
    description: hostile ? `${actor.name}'s ${mode.name} is a permanent ability for ${target.name}: they can use it for the Range's AP, with ${actor.name}'s Power and their own attack dice.`
      : `${actor.name}'s ${mode.name} takes hold at the start of each of ${target.name}'s turns if they succeed on an attack roll against themselves; it lasts until their next turn.` });
  await post(actor, { title: `${esc(actor.name)} — Trance`, body: `<div class="fs-result">After 8 hours, <strong>${esc(mode.name)}</strong> is permanently ${hostile ? "an ability of" : "active on"} <strong>${esc(target.name)}</strong>, for as long as ${esc(actor.name)} concentrates on it.</div>` });
  return true;
}

/** Start of the holder's turn: a lingering or instanced Trance Mode takes hold if they pass a self attack roll (crits count). */
async function tranceTurnStart(holder) {
  for (const e of spellEffects(holder, "trance")) {
    const d = e.flags.flowstate.spellEffect;
    if (d.hostile) continue;
    const caster = globalThis.fromUuidSync?.(d.caster);
    const mode = R.modeById(d.mode);
    if (!caster || !mode) continue;
    // Last round's copy ends; a new one needs a successful attack roll against yourself.
    for (const x of holder.effects ?? []) if (x.flags?.flowstate?.spellEffect?.tranceOf === e.id) await changeEffect(x, null);
    const dd = holder.system.derived;
    const atk = await new Roll(poolFormula(1, dd.attackDie)).evaluate();
    const dodge = await new Roll(poolFormula(2, dd.dodgeDie)).evaluate();
    const res = resolveAttack(atk.total, dodge.total);
    if (!res.hit) { await post(holder, { title: `${esc(holder.name)} — Trance`, rolls: [atk, dodge], body: `<div class="fs-notes">${esc(mode.name)}: the self attack roll (${atk.total}) misses ${dodge.total}: it doesn't take hold this round.</div>` }); continue; }
    const before = new Set((holder.effects ?? []).map(x => x.id));
    const m = { ...d.m, spread: true, uid: uid() };
    const out = await mental.landManifest({ attacker: caster, target: holder, o: { stacks: 0, label: `Trance: ${mode.name}` }, m, mode, result: res, stacksBase: 0 });
    for (const x of holder.effects ?? []) {
      if (before.has(x.id) || x.flags?.flowstate?.spellEffect?.caster !== caster.uuid) continue;
      await changeEffect(x, { "flags.flowstate.spellEffect.persistent": true, "flags.flowstate.spellEffect.tranceOf": e.id, "flags.flowstate.spellEffect.concentration": d.concentration });
    }
    await post(holder, { title: `${esc(holder.name)} — Trance: ${esc(mode.name)}`, rolls: [atk, dodge, ...(out.rolls ?? [])], body: out.html });
  }
}
TURN_START.push(tranceTurnStart);

/** Hostile Trance Modes this creature may use. */
export const tranceAbilities = holder => spellEffects(holder, "trance").filter(e => e.flags.flowstate.spellEffect.hostile);

/** Use a hostile Trance Mode: the Range's AP, the caster's Power, the user's own attack dice (and energy to Enhance). */
export async function useTrance(holder, effect) {
  const d = effect?.flags?.flowstate?.spellEffect;
  const mode = R.modeById(d?.mode);
  if (!mode) return false;
  const target = [...(game.user?.targets ?? [])].map(t => t.actor).find(a => a && a.type !== "pile");
  if (!target) { ui.notifications.warn("Target a creature first."); return false; }
  const wonder = R.wonderById(mode.wonder), kind = R.KINDS[wonder.kind];
  const out = await foundry.applications.api.DialogV2.prompt({ window: { title: `Trance: ${mode.name}` }, rejectClose: false,
    content: `<div class="fs-cast"><p>${esc(mode.name)} at Power ${d.power} (${esc(R.wonderById(mode.wonder).name)}), with your own attack roll.</p>
      <div class="fs-field"><label>Range</label><select name="range">${Object.entries(R.RANGES).filter(([k]) => k !== "area").map(([k, r]) => `<option value="${k}">${r.label} (${r.ap} AP)</option>`).join("")}</select></div>
      <label class="fs-cast-mod"><input type="checkbox" name="enhance"> <strong>Enhance</strong> <small>${minOf(holder, kind.stat)} of your Energy</small></label></div>`,
    ok: { label: "Use it", callback: (event, button) => ({ range: button.form.elements.range.value, enhance: button.form.elements.enhance.checked }) } });
  if (!out) return false;
  const range = R.RANGES[out.range] ? out.range : "ranged";
  if (!(await mental.pay(holder, { ap: R.RANGES[range].ap, energy: out.enhance ? minOf(holder, kind.stat) : 0 }, `Trance: ${mode.name}`))) return false;
  await mental.manifestAt(holder, mode, target, { power: d.power, enhanced: !!out.enhance, range, label: "Trance" });
  return true;
}

/* -------------------------------------------- */
/*  Mantra                                      */
/* -------------------------------------------- */

/** Mantra (Ponderance T2): when a Tenet is used, pay half your Scaling Stat min in Energy to double its bolded effect. Returns the mult to use. */
mantraHook.offer = async (actor, mult, label = "Tenet") => {
  if (ponderTier(actor) < 2 || mult == null) return mult;
  const tn = tenetOf(actor);
  if (!tn) return mult;
  const cost = Math.floor(minOf(actor, R.KINDS[R.wonderById(tn.wonder).kind].stat) / 2);
  if ((actor.system.energy?.value ?? 0) < cost) return mult;
  const ans = await askFor(actor, { react: "mantra", title: "Mantra", ok: "Use Mantra", html: `<p><strong>Mantra</strong>: pay <strong>⚡ ${cost}</strong> to double the bolded effect of ${esc(label)}?</p>` });
  if (!ans) return mult;
  if (!(await mental.pay(actor, { energy: cost }, "Mantra"))) return mult;
  await post(actor, { title: `${esc(actor.name)} — Mantra`, body: `<div class="fs-result">${esc(label)}'s bolded effect is doubled.</div>` });
  return mult * 2;
};
