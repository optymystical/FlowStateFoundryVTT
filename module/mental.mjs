/**
 * Mental (Rework Test Ground): Manifesting Wonder Modes, Alignment, Icons and their Wards, Psion Arts and Willpower Arts.
 * Pure numbers live in mental-rules.mjs. actions.mjs calls in through `registerMental()`:
 *   onResolve   after a Manifest or Ward attack is answered (the Mode's text, or the Ward's effect),
 *   negate      before damage is applied (Nightmare Wards that spend RP to negate damage),
 *   turnStart   Alignment returns to Neutral, Far Sight / Aura Sight lapse.
 * What each Wonder's Modes do (Life, Death, ...) is added Wonder by Wonder: until then a Manifest rolls its attack, pays its costs and the
 * card shows the Mode's numbers worked out for your Wonder Power for the GM to resolve.
 */
import {
  post, requestGM, putSpellEffect, performAttack, spendPoints, spendEnergy, setActorFlag, checkRange, attackerToken, inActiveCombat, helpless,
  rollD100, turnKey, registerMental, spellEffects, damageOutcome, pickSceneTarget, setGrapple, requestDamage, changeEffect, clearSpellEffects, tokenDistance, attackGuard, guardRows
} from "./actions.mjs";
import * as wonders from "./wonders.mjs";
import * as charges from "./charges.mjs";
import * as wondersB from "./wonders-b.mjs";
import * as forging from "./forging.mjs";
import * as ab from "./abilities.mjs";
import * as areas from "./areas.mjs";
import * as R from "./mental-rules.mjs";
import { tierOf } from "./skills.mjs";
import { DAMAGE_CATEGORY, WEAPON_TYPES } from "./martial.mjs";
import { poolFormula, resolveAttack, DAMAGE_TYPES, applyStacks } from "./rules.mjs";

const esc = s => foundry.utils.escapeHTML?.(String(s)) ?? String(s);
const DialogV2 = () => foundry.applications.api.DialogV2;
const eff = (actor, k) => actor.system.derived?.effective?.[k]?.value ?? 0;
const minOf = (actor, k) => ab.statMinOf(actor, k);
const trees = actor => actor.system.trees ?? {};
const theory = actor => R.theoryTier(trees(actor));
const willTier = actor => tierOf(trees(actor), "mental-willpower-arts");
const psionTier = actor => tierOf(trees(actor), "mental-psion-arts");
const mind = actor => eff(actor, "pon") + eff(actor, "snap") + eff(actor, "will");

/* -------------------------------------------- */
/*  Alignment                                   */
/* -------------------------------------------- */

export const alignmentOf = actor => R.alignmentState(actor?.getFlag?.("flowstate", "alignment"));
const setAlignment = (actor, state) => {
  const st = R.alignmentState(state);
  return setActorFlag(actor, "alignment", st.level || st.equilibrium ? st : null);
};

/** Pay AP / RP / energy together, checking all of it first so nothing is half spent. Returns false (with a warning) if the actor can't afford it. */
export async function pay(actor, { ap = 0, rp = 0, energy = 0 }, what) {
  if (inActiveCombat(actor)) {
    const s = actor.system;
    if (s.ap.value < ap) { ui.notifications.warn(`${actor.name} needs ${ap} AP for ${what} but has ${s.ap.value}.`); return false; }
    if (s.rp.value < rp) { ui.notifications.warn(`${actor.name} needs ${rp} RP for ${what} but has ${s.rp.value}.`); return false; }
    if (s.energy.value < energy) { ui.notifications.warn(`${actor.name} needs ${energy} Energy for ${what} but has ${s.energy.value}.`); return false; }
  }
  // Paying for someone else's character (a charge's caster answering on another client): the GM applies it.
  if (!actor.isOwner) {
    if (!inActiveCombat(actor)) return true;
    const s = actor.system;
    await requestGM("updateActor", { uuid: actor.uuid, data: { ...(ap ? { "system.ap.value": s.ap.value - ap } : {}), ...(rp ? { "system.rp.value": s.rp.value - rp } : {}), ...(energy ? { "system.energy.value": s.energy.value - energy } : {}) } });
    return true;
  }
  if (ap && !(await spendPoints(actor, "ap", ap, what))) return false;
  if (rp && !(await spendPoints(actor, "rp", rp, what))) return false;
  if (energy && !(await spendEnergy(actor, energy, what))) return false;
  return true;
}

/** What an Alignment gives, for the card and the dialog. */
const alignmentBlurb = st => {
  if (st.equilibrium) return "Equilibrium (-1): your Manifest attack rolls have Disadvantage, and everything dodging your Icon's Ward has Disadvantage. No speed penalty.";
  if (!st.level) return "Neutral: no benefits and no speed penalty.";
  const own = st.kind === "dream" ? "Dream" : "Nightmare", other = st.kind === "dream" ? "Nightmare" : "Dream";
  return [`${own} Wonders: Advantage on their attack rolls; ${other} Wonders: Disadvantage.`,
    st.level >= 2 ? `${own} bolded effects Strengthened, ${other} Weakened.` : "",
    st.level >= 3 ? `A ${own} Tenet can trigger twice per round.` : "",
    st.level >= 4 ? `Your ${own} Icon's Ward has Advantage and a Strengthened bolded effect.` : "",
    `Speed lowered by ${R.alignmentSpeedPct(st)}%.`].filter(Boolean).join(" ");
};

/**
 * Set your Alignment: a 1 hour activity (so never in combat). Choose Dream or Nightmare and how far to go (1 to 4, each point costs 20% speed),
 * or Neutral. Going further keeps everything before it.
 */
export async function setAlignmentActivity(actor) {
  if (inActiveCombat(actor)) return ui.notifications.warn("Changing your Alignment takes a 1 hour activity, so it can't be done in combat.");
  const cur = alignmentOf(actor);
  const out = await DialogV2().prompt({
    window: { title: `Alignment: ${actor.name}` },
    content: `<div class="fs-cast"><p class="hint">A 1 hour activity. Each point of Alignment lowers your speed by ${R.ALIGN_SPEED_PCT}%.</p>
      <div class="fs-field"><label>Alignment</label><select name="kind">${Object.entries(R.ALIGNMENTS).map(([k, l]) => `<option value="${k}" ${cur.kind === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div class="fs-field"><label>How far (1 to ${R.MAX_ALIGNMENT})</label><input type="number" name="level" min="0" max="${R.MAX_ALIGNMENT}" step="1" value="${cur.level || 1}"></div>
      <p class="hint">1: Advantage for your type, Disadvantage for the other. 2: Strengthened/Weakened bolded effects. 3: your Tenet triggers twice per round. 4: your Icon's Ward has Advantage and Strengthened.</p></div>`,
    ok: { label: "Set", callback: (event, button) => formValues(button.form) }, rejectClose: false });
  if (!out) return;
  const st = R.alignmentState({ kind: out.kind, level: Number(out.level) });
  await setAlignment(actor, st);
  await post(actor, { title: `${esc(actor.name)} — Alignment`, body: `<div class="fs-result">${esc(actor.name)} sets their Alignment to <strong>${esc(R.alignmentLabel(st))}</strong>. ${esc(alignmentBlurb(st))}</div>` });
}

/**
 * Fluidity (Mental T3): swap your Alignment between Dream and Nightmare for energy equal to half your Skill Points times your current Alignment number.
 * With Equilibrium (T4) the same swap can instead drop you into -1 Alignment until the start of your next turn, when you return to what you were.
 */
export async function fluidity(actor) {
  if (helpless(actor)) return ui.notifications.warn(`${actor.name} can't act.`);
  if (theory(actor) < 3) return ui.notifications.warn("Fluidity is a Mental Theory Tier 3 ability.");
  const cur = alignmentOf(actor);
  if (cur.equilibrium) return ui.notifications.info(`${actor.name} is in Equilibrium until the start of their next turn.`);
  const cost = R.fluidityCost(cur, actor.system.skillPoints ?? 0);
  const canSwap = cur.level > 0, canEq = theory(actor) >= 4;
  if (!canSwap && !canEq) return ui.notifications.warn("Fluidity swaps an Alignment you already have; you are Neutral.");
  const other = cur.kind === "dream" ? "nightmare" : "dream";
  const buttons = [...(canSwap ? [{ action: "swap", label: `Swap to ${R.ALIGNMENTS[other]} (${cost} Energy)`, default: true }] : []), ...(canEq ? [{ action: "eq", label: `Equilibrium (${cost} Energy)` }] : [])];
  const pick = buttons.length === 1 ? buttons[0].action : await DialogV2().wait({ window: { title: "Fluidity" }, rejectClose: false, content: `<p>You are ${esc(R.alignmentLabel(cur))}. Spend <strong>${cost}</strong> Energy to:</p>`, buttons });
  if (!pick) return;
  if (!(await pay(actor, { energy: cost }, "Fluidity"))) return;
  if (pick === "swap") {
    await setAlignment(actor, { kind: other, level: cur.level });
    return post(actor, { title: `${esc(actor.name)} — Fluidity`, body: `<div class="fs-result">${esc(actor.name)} swaps to <strong>${esc(R.alignmentLabel({ kind: other, level: cur.level }))}</strong>.</div>` });
  }
  await setAlignment(actor, { ...cur, equilibrium: true });
  await post(actor, { title: `${esc(actor.name)} — Equilibrium`, body: `<div class="fs-result">${esc(actor.name)} enters <strong>Equilibrium (-1 Alignment)</strong> until the start of their next turn, then returns to ${esc(R.alignmentLabel({ ...cur, equilibrium: false }))}. ${esc(alignmentBlurb({ ...cur, equilibrium: true }))}</div>` });
}

/* -------------------------------------------- */
/*  Manifesting                                 */
/* -------------------------------------------- */

/** What the Manifest dialog needs: known Modes grouped by Wonder, the Icon, Far Sight and Aura Sight. */
export function manifestContext(actor) {
  const wonders = R.knownWonders(trees(actor)).filter(w => w.modes.length);
  const flags = actor.getFlag?.("flowstate", "psion") ?? {};
  return { actor, wonders, theory: theory(actor), icon: actor.system.icon ?? null, alignment: alignmentOf(actor), farSight: !!flags.farSight, auraSight: !!flags.auraSight, will: willTier(actor),
    patron: actor.getFlag?.("flowstate", "patron") ?? null, wobs: null };
}

/** Everything about a Manifest worked out from the dialog values (also used for the live preview). */
/** Extra choices a Mode asks for when it's Manifested (and Kinetic Focus for Beyond's attacks). */
export function modeChoices(actor, modeId) {
  const out = [];
  if (modeId === "mental-below-nightmare:burden") out.push({ name: "dis", label: "Disadvantage on", options: { attack: "Their attack rolls", dodge: "Their dodge rolls" } });
  if (["mental-order-dream:decree", "mental-order-dream:mandate"].includes(modeId)) out.push({ name: "sign", label: "Plus or minus", options: { plus: "+1 (plus)", minus: "−1 (minus)" } });
  if (["mental-chaos-nightmare:fracture", "mental-chaos-nightmare:larceny", "mental-chaos-nightmare:entropy"].includes(modeId)) out.push({ name: "size", label: "Die size", options: { up: "Increased", down: "Decreased" } });
  if (["mental-beyond-dream:herald", "mental-beyond-dream:ascend"].includes(modeId) && tierOf(trees(actor), "mental-beyond-dream") >= 4)
    out.push({ name: "kinetic", label: `Kinetic Focus (⚡ ${Math.floor(minOf(actor, "pon") / 2)} each: +1 Advantage)`, number: true });
  for (const f of wonders.CHOICE_PROVIDERS) out.push(...(f(actor, modeId) ?? []));
  return out;
}
const choiceValues = v => Object.fromEntries(Object.entries(v ?? {}).filter(([k]) => k.startsWith("choice:")).map(([k, val]) => [k.slice(7), val]));
const choicesHTML = (actor, modeId, v) => modeChoices(actor, modeId).map(c => c.number
  ? `<div class="fs-field"><label>${esc(c.label)}</label><input type="number" name="choice:${c.name}" value="${Number(v[`choice:${c.name}`]) || 0}" min="0" step="1"></div>`
  : `<div class="fs-field"><label>${esc(c.label)}</label><select name="choice:${c.name}">${Object.entries(c.options).map(([k, l]) => `<option value="${k}" ${v[`choice:${c.name}`] === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>`).join("");

export function manifestPlan(actor, ctx, v, { free = false } = {}) {
  const wobs = ctx.wobs ?? null;
  const mode = R.modeById(v.mode);
  const wonder = mode ? R.wonderById(mode.wonder) : null;
  if (!mode || !wonder || !ctx.wonders.some(w => w.modes.some(m => m.id === mode.id))) return { ok: false, errors: ["Pick a Mode you know."] };
  const kind = R.KINDS[wonder.kind];
  const stat = eff(actor, kind.stat);
  const check = R.manifestCheck(wonder, stat);
  const range = R.RANGES[v.range] ? v.range : "ranged";
  const enhanceCost = minOf(actor, kind.stat);
  // Will of Body and Spirit: the Range must cost what the attack did; an RP attack needs Burst. Patron: its Wonder's Enhance and Burst energy is free while aligned to it.
  const patronFree = ctx.theory >= 5 && ctx.patron === wonder.id && R.alignedTo(ctx.alignment, wonder.kind);
  const burst = wobs ? !!wobs.rp : !!v.burst && ctx.theory >= 1;
  const cost = R.manifestCost({ range, enhance: !!v.enhance, burst, enhanceCost, free, waive: { ap: !!wobs?.ap, rp: !!wobs?.rp, energy: patronFree } });
  const choices = choiceValues(v);
  const kinetic = Math.max(0, Math.floor(Number(choices.kinetic) || 0));
  if (kinetic && !free) cost.energy += kinetic * Math.floor(minOf(actor, "pon") / 2);
  const align = ctx.alignment;
  // Wonder-specific costs and bonuses (Fusion, Hubris, Pride, Adapt, ...).
  const extras = wonders.COST_PROVIDERS.map(f => f(actor, { mode, wonder, choices, free })).filter(Boolean);
  for (const x of extras) if (!free) cost.energy += x.energy ?? 0;
  const extraNet = extras.reduce((n, x) => n + (x.net ?? 0), 0), extraStacks = extras.reduce((n, x) => n + (x.stacks ?? 0), 0);
  const alignFx = R.alignmentManifest(align, wonder.kind);
  const net = alignFx.net + kinetic + extraNet;
  const power = check.power;
  const text = R.scaleMentalText(v.enhance ? `${mode.base} Enhanced: ${mode.enhanced || "(no extra effect)"}` : mode.base, power, mode.name);
  const errors = check.ok ? [] : [check.reason];
  if (v.burst && ctx.theory < 1) errors.push("Burst needs Mental Theory Tier 1.");
  if (wobs && R.RANGES[range].ap !== (wobs.ap || wobs.rp)) errors.push(`Will of Body and Spirit: the Range has to cost ${wobs.ap || wobs.rp} ${wobs.ap ? "AP" : "RP"}, like your attack.`);
  return { ok: errors.length === 0, errors, mode, wonder, kind: wonder.kind, power, stat, enhanceCost, cost, range, enhance: !!v.enhance, burst, net, choices, kinetic,
    alignStacks: alignFx.stacks, text, alignment: align, patronFree, wobs,
    extraStacks, extraNotes: extras.flatMap(x => x.notes ?? []), extraAfter: extras.map(x => x.after).filter(Boolean), extraFlags: Object.assign({}, ...extras.map(x => x.flags ?? {})) };
}

const costText = c => [c.ap ? `${c.ap} AP` : "", c.rp ? `${c.rp} RP` : "", c.energy ? `${c.energy} Energy` : ""].filter(Boolean).join(" + ") || "free";

function previewHTML(plan) {
  if (!plan.ok) return `<p class="fs-warn">${plan.errors.map(esc).join(" ")}</p>`;
  const align = plan.net > 0 ? " · Alignment: Advantage" : plan.net < 0 ? " · Alignment: Disadvantage" : "";
  const alignStr = plan.alignStacks > 0 ? " · Alignment: Strengthened" : plan.alignStacks < 0 ? " · Alignment: Weakened" : "";
  return `<div class="fs-cast-sum"><div><strong>${esc(plan.mode.name)}</strong> <small>(${esc(plan.wonder.name)}, ${R.KINDS[plan.kind].label})</small>: ${esc(plan.text)}</div>
    <div><strong>${costText(plan.cost)}</strong> · Wonder Power ×${plan.power} <small>(${R.KINDS[plan.kind].statLabel} ${plan.stat})</small>${align}${alignStr}${plan.patronFree ? " · Patron: Enhance and Burst energy is free" : ""}${plan.wobs ? " · Will of Body and Spirit: no AP/RP of its own" : ""}</div></div>`;
}

function dialogHTML(ctx, v, plan) {
  const modes = ctx.wonders.map(w => `<optgroup label="${esc(w.name)} (${R.KINDS[w.kind].label})">${w.modes.map(m => `<option value="${esc(m.id)}" ${v.mode === m.id ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</optgroup>`).join("");
  const ranges = Object.entries(R.RANGES).filter(([, r]) => !ctx.wobs || r.ap === (ctx.wobs.ap || ctx.wobs.rp)).map(([k, r]) => `<option value="${k}" ${v.range === k ? "selected" : ""}>${r.label} (${r.ap} AP): ${esc(r.text)}</option>`).join("");
  return `<div class="fs-cast">
    <div class="fs-field"><label>Mode</label><select name="mode">${modes}</select></div>
    <div class="fs-field"><label>Range</label><select name="range">${ranges}</select></div>
    <label class="fs-cast-mod"><input type="checkbox" name="enhance" ${v.enhance ? "checked" : ""}> <strong>Enhance</strong> <small>${v.mode && plan?.enhanceCost !== undefined ? `${plan.enhanceCost} Energy (the Wonder's Scaling Stat min)` : "costs the Wonder's Scaling Stat min in Energy"}</small></label>
    <div class="fs-mode-choices">${choicesHTML(ctx.actor, v.mode, v)}</div>
    ${ctx.theory >= 1 && !ctx.wobs ? `<label class="fs-cast-mod"><input type="checkbox" name="burst" ${v.burst ? "checked" : ""}> <strong>Burst</strong> <small>use RP instead of AP, and pay the Enhance cost in Energy</small></label>` : ""}
    <div class="fs-cast-preview">${previewHTML(plan)}</div>
  </div>`;
}

const formValues = form => {
  const v = {};
  for (const el of form.elements) if (el.name && !el.disabled) v[el.name] = el.type === "checkbox" ? el.checked : el.value;
  return v;
};

async function manifestDialog(actor, ctx) {
  const firstRange = Object.entries(R.RANGES).find(([k, r]) => !ctx.wobs || r.ap === (ctx.wobs.ap || ctx.wobs.rp))?.[0] ?? "ranged";
  let v = { mode: ctx.wonders[0]?.modes[0]?.id, range: firstRange, enhance: false, burst: false };
  const plan0 = manifestPlan(actor, ctx, v);
  return DialogV2().prompt({
    window: { title: `Manifest: ${actor.name}` },
    position: { width: 560 },
    content: dialogHTML(ctx, v, plan0),
    render: (event, dlg) => {
      const el = dlg?.element ?? dlg;
      const form = el?.querySelector?.("form");
      if (!form) return;
      const refresh = () => {
        v = formValues(form);
        const plan = manifestPlan(actor, ctx, v);
        form.querySelector(".fs-cast-preview").innerHTML = previewHTML(plan);
        const hint = form.querySelector('[name="enhance"] ~ small');
        if (hint && plan.enhanceCost !== undefined) hint.textContent = `${plan.enhanceCost} Energy (the Wonder's Scaling Stat min)`;
        const ok = el.querySelector('button[data-action="ok"]');
        if (ok) ok.disabled = !plan.ok;
      };
      form.addEventListener("change", e => {
        if (e.target?.name === "mode") form.querySelector(".fs-mode-choices").innerHTML = choicesHTML(actor, e.target.value, formValues(form));
        refresh();
      });
      refresh();
    },
    ok: { label: "Manifest", icon: "fa-solid fa-eye", callback: (event, button) => formValues(button.form) },
    rejectClose: false
  });
}

const NO_ATTACK = new Set(["mental-beyond-dream:redirect"]);

/** Pick one of a list of [value, label] pairs. */
export async function pickChoice(actor, title, pairs) {
  const out = await DialogV2().prompt({ window: { title }, content: `<div class="fs-field"><label>${esc(title)}</label><select name="v">${pairs.map(([k, l]) => `<option value="${esc(k)}">${esc(l)}</option>`).join("")}</select></div>`,
    ok: { label: "Pick", callback: (event, button) => button.form.elements.v.value }, rejectClose: false });
  return out || null;
}
/** Pick one of a few creatures / Modes with a small dialog. Null if cancelled. */
export async function pickOne(actor, actors, title) {
  const list = actors.filter(Boolean);
  const out = await DialogV2().prompt({ window: { title }, content: `<div class="fs-field"><label>Who</label><select name="who">${list.map(a => `<option value="${a.uuid}">${esc(a.name)}</option>`).join("")}</select></div>`,
    ok: { label: "Pick", callback: (event, button) => button.form.elements.who.value }, rejectClose: false });
  return list.find(a => a.uuid === out) ?? null;
}
export const pickAnother = (actor, opts) => pickSceneTarget(actor, { within: 100, anchors: [attackerToken(actor)], ...opts });
export async function pickMode(actor, modes, title) {
  const out = await DialogV2().prompt({ window: { title }, content: `<div class="fs-field"><label>Mode</label><select name="m">${modes.map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join("")}</select></div>`,
    ok: { label: "Manifest", callback: (event, button) => button.form.elements.m.value }, rejectClose: false });
  return out || null;
}

/** Manifest a known Mode at one specific target for free (an ability spreading it: Pollinate). */
export async function manifestAt(actor, mode, target, { power, enhanced, range = "ranged", choices = {}, spread = false, label = null, extraModes = [] } = {}) {
  const wonder = R.wonderById(mode.wonder);
  const align = alignmentOf(actor);
  const text = R.scaleMentalText(enhanced ? `${mode.base} Enhanced: ${mode.enhanced || ""}` : mode.base, power, mode.name);
  const alignFx = R.alignmentManifest(align, wonder.kind);
  const mental = { mode: mode.id, wonder: wonder.id, kind: wonder.kind, power, enhanced: !!enhanced, burst: false, range, alignStacks: alignFx.stacks, text, caster: actor.uuid, choices, spread, extraModes };
  return performAttack(actor, { ...baseAttack, label: `${label ?? mode.name} (${mode.name})`, net: alignFx.net, stacks: alignFx.stacks, melee: false, area: false,
    notes: [`${label ?? "Free"}: ${mode.name} spreads to ${target.name}; its effect applies immediately`], mental, targetActors: [target] });
}

/** An attack roll from `caster` at `target` that deals `amount` of `type` on a hit (Bloodbond, Masterstroke): no AP/RP. */
export async function reflectStrike(caster, target, amount, type, label, { melee = false, net = 0 } = {}) {
  return performAttack(caster, { ...baseAttack, label, net, melee, area: false, notes: [`${amount} ${type} damage on a hit`], mental: { reflect: { amount, type }, caster: caster.uuid }, targetActors: [target] });
}

/** Quicksand (Below T4): an attack roll at a creature that just broke free; on a hit the escape fails and the effect is back on them. */
export async function quicksand(caster, target, x) {
  return performAttack(caster, { ...baseAttack, label: "Quicksand", net: 0, melee: false, notes: [`Quicksand: ${target.name}'s escape may fail`], mental: { quicksand: { held: x.held }, caster: caster.uuid }, targetActors: [target] });
}

/** The base attack options for a Mental attack (a Manifest or a Ward): no damage of its own, effects come from the hook. */
const baseAttack = { stealth: "none", push: false, damage: "", type: "arcane", stacks: 0, physical: false, shots: 1, critStacks: 0, pierce: 0, bash: 0, knockback: 0, followups: [] };

/**
 * Manifest a Mode: choose it, its Range, Enhance and Burst, pay, and make the attack roll. `preset` skips the dialog (values as the form would give).
 * `free` is for Manifests that cost nothing (Patron, Innate, Will of Body and Spirit).
 */
export async function manifest(actor, preset = null, { free = false, wobs = null } = {}) {
  if (helpless(actor)) return ui.notifications.warn(`${actor.name} can't act.`);
  const ctx = manifestContext(actor);
  ctx.wobs = wobs;
  if (!ctx.wonders.length) return ui.notifications.warn(`${actor.name} doesn't know any Wonder Modes yet.`);
  const v = preset ?? await manifestDialog(actor, ctx);
  if (!v) return null;
  const plan = manifestPlan(actor, ctx, v, { free });
  if (!plan.ok) { ui.notifications.warn(plan.errors.join(" ")); return null; }
  // Targets: Melee needs one close by, Ranged within 100 ft (500 with Far Sight), Area is placed on the scene.
  const farSight = ctx.farSight;
  const reach = actor.system.derived?.size?.melee ?? 5;
  let targets = [...(game.user?.targets ?? [])].map(t => t.actor).filter(a => a && a.type !== "pile");
  let area = null;
  if (plan.range === "melee" && targets.length && !checkRange(actor, reach, `${plan.mode.name} (Melee)`)) return null;
  if (plan.range === "ranged" && targets.length && !checkRange(actor, farSight ? 500 : 100, `${plan.mode.name} (Ranged)`)) return null;
  if (plan.range === "area") {
    area = await areas.placeArea(actor, { title: `Manifest ${plan.mode.name}`, scale: ctx.auraSight ? 2 : 1, aim: [...(game.user?.targets ?? [])][0] });
    if (area === null) return null;                                     // cancelled: nothing is spent
    if (area) targets = area.actors;
  }
  if (!(await pay(actor, plan.cost, `Manifesting ${plan.mode.name}`))) return null;
  const notes = [
    `${plan.mode.name} (${plan.wonder.name}, ${R.KINDS[plan.kind].label}) · Wonder Power ×${plan.power}`,
    plan.enhance ? "Enhanced" : "", plan.burst ? "Burst (RP)" : "",
    plan.net > 0 ? `${R.alignmentLabel(plan.alignment)}: Advantage` : plan.net < 0 ? `${R.alignmentLabel(plan.alignment)}: Disadvantage` : "",
    plan.alignStacks > 0 ? `${R.alignmentLabel(plan.alignment)}: Strengthened` : plan.alignStacks < 0 ? `${R.alignmentLabel(plan.alignment)}: Weakened` : "", plan.range === "area" ? "Area: Weakened if it hits more than two targets" : "", ...plan.extraNotes
  ].filter(Boolean);
  for (const f of plan.extraAfter) await f();
  const mental = { mode: plan.mode.id, wonder: plan.wonder.id, kind: plan.kind, power: plan.power, enhanced: plan.enhance, burst: plan.burst, range: plan.range, alignStacks: plan.alignStacks,
    text: plan.text, caster: actor.uuid, choices: plan.choices, uid: foundry.utils.randomID?.() ?? String(Math.random()), ...plan.extraFlags };
  // Creation: the attack roll is made against yourself; the creature(s) you targeted (or the Area) are who it's created for.
  let attackTargets = targets;
  if (forging.CREATION_MODES.has(plan.mode.id)) {
    mental.recipients = (targets.length ? targets : [actor]).map(a => a.uuid);
    attackTargets = (targets.length ? targets : [actor]).map(() => actor);
  }
  const adaptStack = await wondersB.offerAdapt(actor);           // Adapt (Adaptation Tenet): a stack for Strengthened
  if (adaptStack) notes.push("Adapt: an Adaptation stack makes this Manifest Strengthened");
  // Some Modes need no attack roll (Redirect stores a charge on you).
  if (NO_ATTACK.has(plan.mode.id)) {
    const out = await wonders.resolveMode({ attacker: actor, target: actor, o: { stacks: 0 }, result: { hit: true }, m: mental, bs: plan.alignStacks, mode: plan.mode, power: plan.power, enhanced: plan.enhance, choices: plan.choices, range: plan.range, stacks: 0, hit: true, crit: false, text: plan.text });
    await post(actor, { title: `${esc(actor.name)} — ${esc(plan.mode.name)}`, rolls: out.rolls, body: `<div class="fs-result">${out.html}</div>` });
    return true;
  }
  return performAttack(actor, { ...baseAttack, label: `${plan.mode.name} (Manifest)`, net: plan.net, melee: plan.range === "melee", area: plan.range === "area", singleRoll: plan.range === "area",
    stacks: plan.alignStacks - (plan.range === "area" && targets.length > 2 ? 1 : 0) + plan.extraStacks + adaptStack, notes, mental, ...(attackTargets.length ? { targetActors: attackTargets } : {}) });
}

/* -------------------------------------------- */
/*  Icons: attuning and Wards                   */
/* -------------------------------------------- */

/** Attune an Icon (6 AP; Willpower Arts T1: 2 AP, or 2 RP once per turn) and pick its Tenet. Free outside combat. */
export async function attuneIcon(actor, item = null) {
  if (helpless(actor)) return ui.notifications.warn(`${actor.name} can't act.`);
  const icons = actor.items.filter(i => i.type === "icon" && i.system.profile?.valid);
  if (!icons.length) return ui.notifications.info(`${actor.name} has no Icon.`);
  const icon = item ?? (icons.length === 1 ? icons[0] : null);
  const profile = icon?.system.profile;
  const choices = icon ? R.tenetChoices(profile.align, trees(actor)) : [];
  const key = turnKey();
  const rpFree = willTier(actor) >= 1 && !!key && actor.getFlag("flowstate", "attuneRP") !== key;
  const cost = willTier(actor) >= 1 ? { ap: 2 } : { ap: 6 };
  const out = await DialogV2().prompt({
    window: { title: `Attune: ${actor.name}` },
    content: `<div class="fs-cast">
      ${icon ? "" : `<div class="fs-field"><label>Icon</label><select name="icon">${icons.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join("")}</select></div>`}
      <div class="fs-field"><label>Tenet</label><select name="tenet"><option value="">— No Tenet —</option>${(icon ? choices : R.tenetChoices(icons[0].system.profile.align, trees(actor))).map(w => `<option value="${esc(w.tenet.id)}" ${icon?.system.tenet === w.tenet.id ? "selected" : ""}>${esc(w.tenet.name)} (${esc(w.name)})</option>`).join("")}</select></div>
      ${icon?.system.form === "bane" || (!icon && icons.some(i => i.system.form === "bane")) ? `<div class="fs-field"><label>Bane: chosen damage</label><select name="chosen"><option value="physical">Physical</option><option value="elemental">Elemental</option><option value="magical">Magical</option></select></div>` : ""}
      <div class="fs-field"><label>Pay with</label><select name="pay"><option value="ap">${cost.ap} AP</option>${rpFree ? `<option value="rp">2 RP (once per turn)</option>` : ""}</select></div>
      <p class="hint">Attuning takes ${cost.ap} AP in combat (free outside it). Only one Icon can be attuned; attuning again changes the Tenet.</p></div>`,
    ok: { label: "Attune", callback: (event, button) => formValues(button.form) }, rejectClose: false
  });
  if (!out) return;
  const target = icon ?? actor.items.get(out.icon);
  if (!target) return;
  const rp = out.pay === "rp";
  if (!(await pay(actor, rp ? { rp: 2 } : { ap: cost.ap }, `attuning ${target.name}`))) return;
  if (rp) await setActorFlag(actor, "attuneRP", key);
  await target.update({ "system.attuned": true, "system.tenet": out.tenet ?? "", ...(out.chosen ? { "system.chosen": out.chosen } : {}) }, { flowstateAttune: true });
  const tenet = out.tenet ? R.wonderById(out.tenet.split(":")[0])?.tenet?.name : null;
  await post(actor, { title: `${esc(actor.name)} — Attune`, body: `<div class="fs-result">${esc(actor.name)} attunes to <strong>${esc(target.name)}</strong>${tenet ? ` with the Tenet <strong>${esc(tenet)}</strong>` : ""}.</div>` });
}

const mark = (actor, key) => { const k = turnKey(); return !!k && actor.getFlag?.("flowstate", key) === k; };

/** Where attacks can come from, for Premonition's declared source (the same kinds a Colored Diamond Shroud declares). */
const sourceChoices = () => ({
  ...Object.fromEntries(Object.entries(WEAPON_TYPES).map(([k, w]) => [`weapon:${k}`, `${w.label} weapons`])),
  ...Object.fromEntries(Object.entries(DAMAGE_TYPES).map(([k, l]) => [`type:${k}`, `${l} damage`]))
});

/** Activate your Icon's Ward (shielding and charges): a self attack roll (Neutral gives it Advantage), or Projected at an ally (Mental T2). */
export async function activateWard(actor) {
  if (helpless(actor)) return ui.notifications.warn(`${actor.name} can't act.`);
  const icon = actor.system.icon;
  const p = icon?.system.profile;
  if (!p?.valid) return ui.notifications.warn(`${actor.name} has no attuned Icon.`);
  if (p.kind === "negate") return ui.notifications.info(`${p.name} works on its own: when you would take damage you're asked whether to spend 1 RP to negate it.`);
  const form = R.FORMS[p.form];
  const align = alignmentOf(actor);
  if (form.needs === "dream" && !(R.alignedTo(align, "dream") && align.level >= 2)) return ui.notifications.warn(`${p.name} can only be activated while you are at least 2 in the Dream Alignment.`);
  const th = theory(actor), wt = willTier(actor);
  const innate = wt >= 3 && !mark(actor, "innateTurn") && inActiveCombat(actor);
  const enhanceCost = minOf(actor, "will");
  const wardFx = R.alignmentWard(align, p.align);          // 4 Alignment: Advantage and Strengthened; Equilibrium: everything dodging it has Disadvantage
  const ally = th >= 2 ? [...(game.user?.targets ?? [])].map(t => t.actor).find(a => a && a.uuid !== actor.uuid && a.type !== "pile") : null;
  const out = await DialogV2().prompt({
    window: { title: `${p.name} Ward: ${actor.name}` },
    content: `<div class="fs-cast">
      <p>${esc(p.ward)}</p>
      ${innate ? `<p class="hint"><strong>Innate:</strong> your first Ward each turn costs no AP/RP and is automatically Enhanced.</p>` : `
      ${th >= 1 ? `<label class="fs-cast-mod"><input type="checkbox" name="enhance"> <strong>Enhance</strong> <small>${enhanceCost} Energy: ${esc(p.enhance)}</small></label>
      <label class="fs-cast-mod"><input type="checkbox" name="burst"> <strong>Burst</strong> <small>RP instead of AP, and ${enhanceCost} Energy</small></label>` : ""}`}
      ${wt >= 2 ? `<label class="fs-cast-mod"><input type="checkbox" name="clear"> <strong>Make Clear</strong> <small>${enhanceCost} Energy: Advantage on the activation roll, and one reroll if it misses</small></label>` : ""}
      ${ally && wt >= 4 ? `<label class="fs-cast-mod"><input type="checkbox" name="recur"> <strong>Recur</strong> <small>${Math.floor(enhanceCost / 2)} Energy: it chains to you as well on a hit</small></label>` : ""}
      ${th >= 4 ? `<label class="fs-cast-mod"><input type="checkbox" name="expand"> <strong>Expansion</strong> <small>${2 * enhanceCost} Energy: an Area attack (10 ft radius, 20 ft cone or 30×5 ft line) instead</small></label>` : ""}
      ${ally ? `<p class="hint">Projected at ${esc(ally.name)} (Ranged, 100 ft).</p>` : ""}
      ${form.kind === "shield" && form.typed ? `<div class="fs-field"><label>Shields against</label><select name="types"><option value="physical">Physical</option><option value="elemental">Elemental</option><option value="magical">Magical</option></select></div>
        <div class="fs-field"><label>Second type (when Enhanced)</label><select name="types2"><option value="">— None —</option><option value="physical">Physical</option><option value="elemental">Elemental</option><option value="magical">Magical</option></select></div>` : ""}
      ${form.kind === "charge" ? `<div class="fs-field"><label>Declared source (when Enhanced)</label><select name="declared"><option value="">— None —</option>${Object.entries(sourceChoices()).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("")}</select></div>` : ""}
    </div>`,
    ok: { label: "Ward", callback: (event, button) => formValues(button.form) }, rejectClose: false
  });
  if (!out) return;
  const enhanced = innate || !!out.enhance;
  const burst = !innate && !!out.burst;
  const enhEnergy = enhanceCost;
  let energy = (out.enhance && !innate ? enhEnergy : 0) + (burst ? enhEnergy : 0) + (out.clear ? enhanceCost : 0) + (out.recur ? Math.floor(enhanceCost / 2) : 0) + (out.expand ? 2 * enhanceCost : 0);
  const costs = innate ? { ap: 0, rp: 0, energy } : burst ? { ap: 0, rp: form.ap ?? 1, energy } : { ap: form.ap ?? 1, rp: 0, energy };
  // Expansion places the area first, so cancelling it spends nothing.
  let area = null;
  if (out.expand) {
    area = await areas.placeArea(actor, { title: `${p.name} Ward (Expansion)`, scale: psion(actor).auraSight ? 2 : 1 });
    if (!area) { if (area === undefined) ui.notifications.warn("Expansion needs a scene to place the area on."); return; }
  }
  if (!(await pay(actor, costs, `${p.name}'s Ward`))) return;
  if (innate) await setActorFlag(actor, "innateTurn", turnKey());
  const targets = area ? area.actors : [ally ?? actor];
  const adv = wardFx.net + (out.clear ? 1 : 0);
  const mental = { ward: { form: p.form, enhanced, types: out.types ? [out.types, ...(enhanced && out.types2 && out.types2 !== out.types ? [out.types2] : [])] : null, recur: !!out.recur, clear: !!out.clear, caster: actor.uuid, icon: icon.uuid,
    declared: enhanced && out.declared ? out.declared : "", amount: enhanced ? p.enhancedAmount : p.amount, alignStacks: wardFx.stacks } };
  const notes = [`${p.name} Ward`, enhanced ? "Enhanced" : "", burst ? "Burst (RP)" : "", innate ? "Innate (free)" : "", wardFx.net > 0 ? `${R.alignmentLabel(align)}: Advantage and Strengthened` : "", out.clear ? "Make Clear: Advantage" : "", out.expand ? "Expansion (Area)" : "",
    align.equilibrium ? "Equilibrium: the target has Disadvantage on their dodge" : "", wt >= 5 && innate ? "Innate Mastery: the target has Disadvantage on their roll against it" : ""].filter(Boolean);
  return performAttack(actor, { ...baseAttack, label: `${p.name} Ward`, net: adv, melee: false, area: !!area, singleRoll: !!area, notes, mental, targetActors: targets, dodgeNet: (wt >= 5 && innate ? -1 : 0) + wardFx.dodgeNet,
    stacks: wardFx.stacks });
}
const psion = actor => actor.getFlag?.("flowstate", "psion") ?? {};

/** A hit Ward: put its effect on the target. */
async function applyWard({ attacker, target, ward }) {
  const form = R.FORMS[ward.form];
  const caster = attacker;
  const lines = [];
  const place = async (who, amount) => {
    if (form.kind === "shield" || form.kind === "persistent") {
      let amt = amount;
      const mine = spellEffects(who, "shield").filter(e => e.flags.flowstate.spellEffect.ward === ward.form && e.flags.flowstate.spellEffect.caster === caster.uuid);
      if (form.cap) amt = Math.max(0, Math.min(amt, form.cap * R.iconScale(eff(caster, "will"), (ward.grade ?? 1)) - mine.reduce((n, e) => n + (Number(e.flags.flowstate.spellEffect.hp) || 0), 0)));
      if (form.cap && amt <= 0) { lines.push(`${esc(who.name)} already has the most ${form.name} shielding.`); return; }
      await putSpellEffect(who, { kind: "shield", stack: true, caster: caster.uuid, name: `${form.name} (${amt} shielding)`, hp: amt, max: amt, ward: ward.form, order: "default", ritualOf: null,
        types: ward.types ?? null, turnsLeft: form.extraTurn && ward.enhanced ? 2 : undefined, persistent: form.kind === "persistent",
        anchor: !!form.anchor, reverie: ward.form === "reverie", reverieEnhanced: ward.form === "reverie" && !!ward.enhanced,
        description: `Absorbs the next ${amt} damage${ward.types ? ` of ${ward.types.join("/")}` : ""}. ${form.kind === "persistent" ? "Does not decay or naturally regenerate." : "Until the start of the caster's next turn."}${form.anchor ? " Damage dealt to it is Weakened while the caster has not moved since the start of their turn." : ""}` });
      lines.push(`${esc(who.name)} gets <strong>${amt} shielding</strong> from ${esc(form.name)}${form.kind === "persistent" ? " (it stays until it is used up)" : ""}${ward.types ? ` against ${ward.types.map(esc).join(" and ")} damage` : ""}.`);
      if (form.anchor && ward.enhanced) {
        await putSpellEffect(who, { kind: "anchorWeak", caster: caster.uuid, name: "Anchor (all damage Weakened)", ritualOf: null,
          description: "Damage you would take is Weakened until the start of the caster's next turn, as long as the caster has not moved since the start of their turn. Doesn't stack." });
        lines.push(`Enhanced Anchor: <em>all</em> damage ${esc(who.name)} takes is Weakened until your next turn, as long as you don't move.`);
      }
    } else if (form.kind === "charge") {
      await putSpellEffect(who, { kind: "premonition", caster: caster.uuid, name: `Premonition (negates ${amount})`, charge: amount, ward: ward.form, ritualOf: null, declared: ward.declared || "",
        description: `One charge: when damage would be dealt, negate up to ${amount} of it. Until the start of the caster's next turn.${ward.declared ? ` Declared source: ${sourceChoices()[ward.declared] ?? ward.declared}: damage from it gets a stack of Weakened first.` : ""}` });
      lines.push(`${esc(who.name)} stores a <strong>Premonition</strong> charge (negates up to ${amount})${ward.declared ? `, declaring ${esc(sourceChoices()[ward.declared] ?? ward.declared)} as the source` : ""}.`);
    }
  };
  // 4 Alignment: the Ward's bolded effect is Strengthened.
  const amount = Math.floor(applyStacks(ward.amount, ward.alignStacks ?? 0));
  await place(target, amount);
  if (ward.recur && target.uuid !== caster.uuid) { await place(caster, amount); lines.push("Recur: it chains to the caster too."); }
  return lines.join("<br>");
}

/** Enhanced Reverie at 4 Dream Alignment: whenever a Dream Manifest of yours hits, each Enhanced Reverie shield you hold grows by 5 (× the Icon's scaling), up to the cap in all. */
async function growReverie(attacker, grade) {
  const mine = [];
  for (const a of new Set([...(globalThis.game?.actors ?? []), ...(globalThis.canvas?.tokens?.placeables ?? []).map(t => t.actor).filter(Boolean)])) {
    for (const e of spellEffects(a, "shield")) { const d = e.flags.flowstate.spellEffect; if (d.reverie && d.caster === attacker.uuid && d.reverieEnhanced) mine.push(e); }
  }
  if (!mine.length) return "";
  const mult = R.iconScale(eff(attacker, "will"), grade ?? 1);
  const cap = R.FORMS.reverie.cap * mult;
  let total = 0;
  for (const a of new Set(mine.map(e => e.parent))) for (const e of spellEffects(a, "shield")) { const d = e.flags.flowstate.spellEffect; if (d.reverie && d.caster === attacker.uuid) total += Number(d.hp) || 0; }
  let added = 0;
  for (const e of mine) {
    const room = cap - total - added;
    const n = Math.min(5 * mult, room);
    if (n <= 0) break;
    const d = e.flags.flowstate.spellEffect;
    await changeEffect(e, { "flags.flowstate.spellEffect.hp": (Number(d.hp) || 0) + n, "flags.flowstate.spellEffect.max": (Number(d.max) || 0) + n, name: `Reverie (${(Number(d.hp) || 0) + n} shielding)` });
    added += n;
  }
  return added ? `Reverie grows by <strong>${added}</strong> shielding.` : "";
}

/* -------------------------------------------- */
/*  Resolving the attack: Manifests and Wards   */
/* -------------------------------------------- */

/** A Manifest's Mode lands (the first time, or after a Chant reroll): apply it and build the card. */
async function landManifest({ attacker, target, o, m, mode, result, stacksBase, hit = true, margin = 0, index = 0, attackMessage = null, shattered = false }) {
  const c = { attacker, target, o, result, m, mode, power: m.power, enhanced: m.enhanced, choices: m.choices ?? {}, range: m.range, text: m.text, hit, margin, crit: hit && !!result.crit, index,
    stacks: stacksBase + (hit ? (result.critStacks ?? 0) : 0), bs: m.alignStacks ?? 0, now: !!m.spread };
  // Brace, Dip, Shatter and parrying weapons guard against this attack like any other Melee or Ranged one: a damaging Mode asks for the guard (once).
  let guardP = null;
  c.guardOf = () => (guardP ??= attackGuard(attacker, target, o, attackMessage, index, { hit, shattered }));
  const out = await wonders.resolveMode(c);
  // Fusion-style riders and Warpath: more Modes applied with the same hit.
  for (const id of m.extraModes ?? []) { const em = R.modeById(id); if (em) { const x = await wonders.resolveMode({ ...c, mode: em }); out.html += `<br>${x.html}`; out.rolls.push(...x.rolls); } }
  let riposte = null;
  if (guardP) {
    const g = await guardP;
    out.html += g.html; out.rolls.push(...g.rolls);
    // A guard that took all of it earns a Riposte (and Dip's move, Redirect), as on a weapon's damage card.
    if (g.any && g.damaged && (g.direct === 0 || g.dipZero)) riposte = { items: g.riposteItems ?? [], noDamage: g.direct === 0, dipZero: !!g.dipZero };
  }
  const tenet = "";
  const grow = hit && R.wonderById(m.wonder)?.kind === "dream" && R.alignedTo(alignmentOf(attacker), "dream") && alignmentOf(attacker).level >= 4 ? await growReverie(attacker, attacker.system.icon?.system.grade) : "";
  let crits = "";
  if (c.crit) for (const f of wonders.ON_CRIT) crits += (await f(c)) ?? "";
  // Tenets pop up once the card is out (and again next time if they aren't used).
  if (hit && out.tenets?.length) setTimeout(() => wonders.offerTenets(c, out.tenets), 0);
  const html = `<div class="fs-result"><i class="fa-solid fa-eye"></i> ${out.html}${result.crit ? " <em>(critical)</em>" : ""}${m.alignStacks ? ` <em>(Alignment: ${m.alignStacks > 0 ? "Strengthened" : "Weakened"})</em>` : ""}${tenet ? `<br>${tenet}` : ""}${grow ? `<br>${grow}` : ""}${crits ? `<br>${crits}` : ""}</div>`;
  if (out.acts.length) await post(attacker, { title: `${esc(attacker.name)} — ${esc(mode.name)}: abilities`, body: wonders.actButtons(out.acts), flags: { flowstate: { mentalAct: { acts: out.acts } } } });
  return { html, push: out.push, rolls: out.rolls, riposte };
}

async function onResolve({ attacker, target, o, result, entry, dodgeRoll, index = 0, attackMessage = null }) {
  const m = o.mental;
  if (!m) return null;
  const reroll = { net: entry?.net ?? 0, die: entry?.die ?? attacker.system.derived.attackDie, dodge: dodgeRoll?.total ?? null };
  if (m.reflect) {
    if (!result.hit) return { html: `<div class="fs-notes">The reflected attack misses ${esc(target.name)}.</div>` };
    await requestDamage(target, m.reflect.amount, m.reflect.type, 0, null, { silent: true });
    return { html: `<div class="fs-result"><i class="fa-solid fa-reply"></i> The negated damage is dealt back: <strong>${m.reflect.amount}</strong> ${esc(DAMAGE_TYPES[m.reflect.type] ?? m.reflect.type)} to ${esc(target.name)}.</div>` };
  }
  if (m.dismiss) {
    if (!result.hit) return { html: `<div class="fs-notes">The dismissal misses: ${esc(target.name)} keeps their effects.</div>` };
    let n = 0;
    for (const u of m.dismiss.effects) { const e = await fromUuid(u); if (e) { await changeEffect(e, null); n++; } }
    return { html: `<div class="fs-result"><i class="fa-solid fa-ban"></i> Dismissed ${n} Wonder effect${n === 1 ? "" : "s"} on ${esc(target.name)}.</div>` };
  }
  if (m.ward) {
    const w = { ...m.ward, grade: attacker.system.icon?.system.grade ?? 1 };
    if (!result.hit) {
      let extra = "";
      if (m.ward.clear && !o.area && reroll.dodge !== null) {
        const act = { id: "makeClear", label: "Make Clear: reroll", tip: "Reroll the Ward's activation roll once (not keeping any Advantage/Disadvantage)", cost: "free", caster: attacker.uuid, target: target.uuid, re: { ...reroll, keepNet: false }, ward: w };
        await post(attacker, { title: `${esc(attacker.name)} — Make Clear`, body: wonders.actButtons([act]), flags: { flowstate: { mentalAct: { acts: [act] } } } });
        extra = " Make Clear can reroll it.";
      }
      return { html: `<div class="fs-notes">${esc(R.FORMS[m.ward.form].name)}: the Ward doesn't take hold on ${esc(target.name)}.${extra}</div>` };
    }
    const html = await applyWard({ attacker, target, ward: w });
    return { html: `<div class="fs-result"><i class="fa-solid fa-hands-praying"></i> ${html}${result.crit ? "<br>Critical hit: the Ward's crit bonus applies." : ""}</div>` };
  }
  const mode = R.modeById(m.mode);
  if (m.quicksand) {
    if (!result.hit) return { html: `<div class="fs-notes">Quicksand misses: ${esc(target.name)} stays free.</div>` };
    const h = m.quicksand.held;
    const { name, description, ...data } = h;
    if (h.kind === "hold") await setGrapple(target, attacker.uuid);
    await putSpellEffect(target, { ...data, name, description });
    return { html: `<div class="fs-result"><i class="fa-solid fa-hill-rockslide"></i> Quicksand: ${esc(target.name)} fails the escape check after all and is held again by <strong>${esc(name)}</strong>.</div>` };
  }
  if (m.hubris && result.hit && !result.noCrit) result = { ...result, crit: true, critStacks: 2, outcome: "Critical Hit (Hubris)" };
  if (!result.hit && wonders.MISS_MODES.has(m.mode) && !m.hubris) {
    // Perfection Modes apply even on a miss: what they do is worked out from how far it missed.
    return landManifest({ attacker, target, o, m, mode, result, stacksBase: o.stacks ?? 0, hit: false, margin: Math.max(0, (reroll.dodge ?? 0) - (entry?.total ?? 0)), index, attackMessage });
  }
  if (!result.hit) {
    // Mode-specific follow-ups on a miss (Instinct)
    const missActs = await wonders.missActs({ attacker, target, m, mode, power: m.power, enhanced: m.enhanced, range: m.range, hit: false });
    if (missActs.length) await post(attacker, { title: `${esc(attacker.name)} — ${esc(mode.name)}`, body: wonders.actButtons(missActs), flags: { flowstate: { mentalAct: { acts: missActs } } } });
    // Chant (Mental T2): once per Manifest, reroll a missed attack roll for the Enhance cost (keeping its Advantage/Disadvantage).
    let extra = "";
    if (theory(attacker) >= 2 && !o.area && !m.chanted && !m.spread && reroll.dodge !== null) {
      const cost = minOf(attacker, R.KINDS[R.wonderById(m.wonder).kind].stat);
      const act = { id: "chant", label: "Chant: reroll", tip: "Reroll the missed attack roll once (keeps its Advantage/Disadvantage; this does not Enhance it)", cost: `⚡ ${cost}`, caster: attacker.uuid, target: target.uuid, mode: m.mode, re: { ...reroll, keepNet: true, stacks: o.stacks ?? 0, melee: !!o.melee, msg: attackMessage, index }, m, range: m.range };
      await post(attacker, { title: `${esc(attacker.name)} — Chant`, body: wonders.actButtons([act]), flags: { flowstate: { mentalAct: { acts: [act] } } } });
      extra = " Chant can reroll it.";
    }
    return { html: `<div class="fs-notes">${esc(mode?.name ?? "The Mode")} misses ${esc(target.name)}.${extra}</div>` };
  }
  return landManifest({ attacker, target, o, m, mode, result, stacksBase: o.stacks ?? 0, index, attackMessage });
}

/** Chant and Make Clear: reroll the missed attack roll against the same dodge. */
export async function rerollAct(x) {
  const caster = await fromUuid(x.caster), target = await fromUuid(x.target);
  if (!caster || !target) return false;
  const chant = x.id === "chant";
  if (chant) {
    const cost = minOf(caster, R.KINDS[R.wonderById(x.m.wonder).kind].stat);
    if (!(await pay(caster, { energy: cost }, "Chant"))) return false;
  }
  const r = await new Roll(poolFormula(1, x.re.die, x.re.keepNet ? x.re.net : 0)).evaluate();
  const result = resolveAttack(r.total, x.re.dodge);
  const label = chant ? "Chant" : "Make Clear";
  let riposteFlags = {};
  let html = `<div class="fs-notes">${label}: new attack roll <strong>${r.total}</strong> against a dodge of ${x.re.dodge}${x.re.keepNet ? "" : " (no Advantage/Disadvantage kept)"}: <strong>${result.outcome}</strong>.</div>`;
  if (result.hit) {
    if (chant) {
      const o = { stacks: x.re.stacks ?? 0, area: false, melee: !!x.re.melee };
      // The first roll was a miss: a melee miss already met Shatter, so the reroll doesn't strike the attack a second time.
      const landed = await landManifest({ attacker: caster, target, o, m: { ...x.m, chanted: true }, mode: R.modeById(x.m.mode), result, stacksBase: o.stacks, attackMessage: x.re.msg ?? null, index: x.re.index ?? 0, shattered: !!x.re.melee });
      html += landed.html;
      // A guard that took all the damage of the rerolled hit earns the same Riposte (and Dip's move, Redirect) the first card would have.
      if (landed.riposte) { const g = await guardRows(target, landed.riposte, o); html += g.html; if (g.riposte) riposteFlags = { guardRiposte: { defender: target.uuid, attacker: caster.uuid } }; }
    } else {
      html += `<div class="fs-result"><i class="fa-solid fa-hands-praying"></i> ${await applyWard({ attacker: caster, target, ward: x.ward })}${result.crit ? "<br>Critical hit: the Ward's crit bonus applies." : ""}</div>`;
    }
  } else html += `<div class="fs-notes">Still a miss.</div>`;
  await post(caster, { title: `${esc(caster.name)} — ${label}`, rolls: [r], body: html, flags: { flowstate: { ...riposteFlags } } });
  return true;
}

/* -------------------------------------------- */
/*  Nightmare Wards: negate damage              */
/* -------------------------------------------- */

/**
 * Before damage lands: a Nightmare Ward may spend 1 RP to negate part of it, as many times as the owner likes ("Can be used multiple times per damage
 * instance"). Returns { amount, html }. A Premonition charge can negate a chunk too. Only the owner is asked; Echo, once it fully negates an
 * attack, keeps negating for free until the start of the owner's next turn.
 */
async function negate(actor, amount, type, { source = null, attacker = null } = {}) {
  if (!actor || actor.type === "pile" || amount <= 0 || !actor.isOwner) return { amount, html: "" };
  const icon = actor.system.icon;
  const p = icon?.system.profile;
  const notes = [];
  let left = amount;
  // Premonition (Dream): one stored charge negates a lump of damage. Enhanced, it declared a source: damage from it is Weakened first.
  for (const e of spellEffects(actor, "premonition")) {
    if (left <= 0) break;
    const d = e.flags.flowstate.spellEffect;
    if (d.declared && source === d.declared) {
      const weak = Math.floor(left / 2);
      notes.push(`Premonition: the declared source (${sourceChoices()[d.declared] ?? d.declared}) gets a stack of Weakened, so ${left} becomes ${weak}`);
      left = weak; amount = left;
    }
    const yes = await DialogV2().confirm({ window: { title: "Premonition" }, rejectClose: false, content: `<p>Consume a Premonition charge to negate up to <strong>${d.charge}</strong> of the ${left} ${esc(type)} damage?</p>` });
    if (!yes) continue;
    const n = Math.min(d.charge, left);
    left -= n;
    notes.push(`Premonition negates ${n}`);
    await e.delete();
  }
  if (!p?.valid || p.kind !== "negate" || left <= 0) return { amount: left, html: notes.length ? `<div class="fs-notes">${notes.join(" · ")}</div>` : "" };
  const startLeft = left;
  const form = R.FORMS[p.form];
  const align = alignmentOf(actor);
  const cat = DAMAGE_CATEGORY[type] ?? "physical";
  const th = theory(actor);
  const willMin = minOf(actor, "will");
  const per = (uses, enhanced, near) => {
    let n = enhanced ? p.enhancedAmount : p.amount;
    if (form.chooses) n = enhanced || cat === icon.system.chosen ? p.amount : p.other;
    // Zealot: full negation at 2 or more Nightmare Alignment.
    if (form.needs === "deepNightmare") n = (R.alignedTo(align, "nightmare") && align.level >= 2) ? p.amount : p.other;
    if (form.near) n = near ? p.amount : p.other;
    if (form.grows) n += p.grows * (uses + (enhanced ? 1 : 0));
    return Math.floor(applyStacks(n, R.alignmentWard(align, p.align).stacks));        // 4 Alignment: the bolded effect is Strengthened
  };
  // Echo: once it has fully negated an attack, it keeps working for free until your next turn.
  const echo = actor.getFlag("flowstate", "echoWard");
  let uses = 0, near = !!source?.near, enhancedUsed = false, weakened = false;
  if (form.echo && echo && echo.key === (turnKey() ?? "ooc") && echo.n > 0) {
    const n = Math.min(left, echo.n * p.amount);
    left -= n;
    notes.push(`Echo negates ${n} for free (×${echo.n})`);
  }
  for (;;) {
    if (left <= 0 || ((actor.system.rp?.value ?? 0) < 1 && inActiveCombat(actor))) break;
    const n = Math.min(left, per(uses, false, near));
    const ask = await DialogV2().prompt({
      window: { title: `${p.name} Ward` },
      content: `<p><strong>${left}</strong> ${esc(type)} damage is coming. Spend 1 RP to negate up to <strong>${n}</strong> of it with ${esc(p.name)}?</p>
        ${form.near ? `<label class="fs-cast-mod"><input type="checkbox" name="near" ${near ? "checked" : ""}> The source is within my melee range (${p.amount} instead of ${p.other})</label>` : ""}
        ${th >= 1 ? `<label class="fs-cast-mod"><input type="checkbox" name="enhance"> <strong>Enhance</strong> <small>${willMin} Energy: ${esc(p.enhance)}</small></label>` : ""}
        ${uses ? `<small>Used ${uses} time${uses === 1 ? "" : "s"} already on this damage.</small>` : ""}`,
      ok: { label: "Negate (1 RP)", callback: (event, button) => formValues(button.form) }, rejectClose: false
    });
    if (!ask) break;
    near = form.near ? !!ask.near : near;
    const enh = !!ask.enhance && th >= 1;
    const nn = Math.min(left, per(uses, enh, near));
    if (!(await pay(actor, { rp: 1, energy: enh ? willMin : 0 }, `${p.name}'s Ward`))) break;
    left -= nn; uses++;
    if (enh) enhancedUsed = true;
    // Zealot, Enhanced at 4 Nightmare Alignment: the damage is Weakened on use (once per damage instance).
    if (enh && form.needs === "deepNightmare" && R.alignedTo(align, "nightmare") && align.level >= 4 && !weakened) { weakened = true; const before = left; left = Math.floor(applyStacks(left, -1)); notes.push(`Zealot (4 Nightmare): the rest is Weakened, ${before} → ${left}`); }
    notes.push(`${p.name} negates ${nn} (1 RP${enh ? `, Enhanced for ${willMin} Energy` : ""})`);
  }
  if (form.echo && left <= 0 && amount > 0) {
    const cur = actor.getFlag("flowstate", "echoWard");
    const key = turnKey() ?? "ooc";
    await setActorFlag(actor, "echoWard", { key, n: (cur?.key === key ? cur.n : 0) + 1 });
    notes.push("Echo: it now negates every instance of damage for free until your next turn, and stacks");
  }
  // Warden and Riposte (Enhanced): once the damage resolves, one attack at its source; on a hit the negated damage is dealt to them.
  const negated = startLeft - Math.max(0, left);
  let reflect = null;
  if (negated > 0 && form.reflect && icon.system && enhancedUsed && attacker) reflect = { kind: form.reflect, amount: negated, type, attacker };
  return { amount: Math.max(0, left), html: notes.length ? `<div class="fs-notes">${notes.map(esc).join(" · ")}</div>` : "", reflect, after: reflect ? () => reflectNow(actor, reflect) : null };
}

/** Run a Warden / Riposte reflect that `negate` handed back (it can travel as data: the damage may be applied on another client). */
const reflectNow = (actor, r) => reflectAttack(actor, r.kind, r.amount, r.type, r.attacker);

/** Warden (Ranged, within 100 ft) / Riposte (Melee with Advantage, within melee range): an attack roll at the damage's source for the damage that was negated. */
async function reflectAttack(actor, kind, amount, type, attackerUuid) {
  const src = await fromUuid(attackerUuid);
  if (!src || src.uuid === actor.uuid || src.type === "pile") return;
  const melee = kind === "melee";
  const reach = melee ? actor.system.derived?.size?.melee ?? 5 : 100;
  const a = attackerToken(actor), b = src.getActiveTokens?.()[0];
  if (a && b && globalThis.canvas?.grid) {
    if (tokenDistance(a, b) > reach) return post(actor, { title: `${esc(actor.name)} — ${melee ? "Riposte" : "Warden"}`, body: `<div class="fs-notes">${esc(src.name)} isn't within ${reach} ft: no attack is made.</div>` });
  }
  await performAttack(actor, { ...baseAttack, label: melee ? "Riposte (Ward)" : "Warden (Ward)", net: melee ? 1 : 0, melee, area: false,
    notes: [`The ${amount} negated ${type} damage goes to ${src.name} on a hit`], mental: { reflect: { amount, type }, caster: actor.uuid }, targetActors: [src] });
}

/* -------------------------------------------- */
/*  Psion Arts                                  */
/* -------------------------------------------- */

/** Sixth Sense: a Spot check for mental energies through any surface within 100 ft (1000 ft with Far Sight). */
export async function psionSense(actor) {
  const t = psionTier(actor);
  if (t < 1) return;
  const far = !!actor.getFlag("flowstate", "psion")?.farSight;
  const range = far ? 1000 : 100;
  await rollD100(actor, "Psion Sense");
  const detail = t >= 5 ? "the individual mental stats and mental abilities (of stages you've reached) of those you detect, with direction and total Mind"
    : t >= 3 ? "the direction of a chosen mental energy and its total Mind" : "only how many mental energies are around you, not where";
  await post(actor, { title: `${esc(actor.name)} — Psion Sense`, body: `<div class="fs-notes">${t >= 3 ? "Primary" : "Secondary"} Psion within <strong>${range} ft</strong>${far ? " (Far Sight)" : ""}: on a success you learn ${detail}.</div>` });
}

/** Far Sight (Psion T2): 2 AP and energy equal to your total Mind. Psion Sense reaches 1000 ft and Ranged Manifestations 500 ft until your next turn. */
export async function farSight(actor) {
  if (psionTier(actor) < 2) return;
  const cost = { ap: 2, energy: mind(actor) };
  if (!(await pay(actor, cost, "Far Sight"))) return;
  const cur = actor.getFlag("flowstate", "psion") ?? {};
  await setActorFlag(actor, "psion", { ...cur, farSight: true });
  await post(actor, { title: `${esc(actor.name)} — Far Sight`, body: `<div class="fs-result">Psion Sense reaches <strong>1000 ft</strong> and Ranged Manifestations <strong>500 ft</strong> until the start of ${esc(actor.name)}'s next turn (pay ${cost.energy} Energy again then to keep it).</div>` });
}

/** Aura Sight (Psion T4): 2 AP and half your total Mind: a Spot check on everyone in Psion range, and Area Manifestations are doubled until your next turn. */
export async function auraSight(actor) {
  if (psionTier(actor) < 4) return;
  const cost = { ap: 2, energy: Math.floor(mind(actor) / 2) };
  if (!(await pay(actor, cost, "Aura Sight"))) return;
  const cur = actor.getFlag("flowstate", "psion") ?? {};
  await setActorFlag(actor, "psion", { ...cur, auraSight: true });
  await rollD100(actor, "Aura Sight (Spot)");
  await post(actor, { title: `${esc(actor.name)} — Aura Sight`, body: `<div class="fs-result">A Spot check against everything within Psion range. Area Manifestations are <strong>doubled</strong> until the start of ${esc(actor.name)}'s next turn.</div>` });
}

/* -------------------------------------------- */
/*  Turn start                                  */
/* -------------------------------------------- */

/** Where this creature's token stands (for Anchor's "have not moved since the start of your turn"). */
const posOf = actor => { const t = actor?.getActiveTokens?.()[0]; return t ? { x: t.document?.x ?? t.x, y: t.document?.y ?? t.y } : null; };
const hasForm = (actor, form) => actor?.system?.icon?.system?.attuned && actor.system.icon.system.form === form;

/** Anchor: has the Ward's caster stayed put since their turn began? (Also true when we can't tell.) */
function anchorStill(casterUuid) {
  const c = fromUuidSync?.(casterUuid);
  const at = c?.getFlag?.("flowstate", "turnPos");
  const now = c ? posOf(c) : null;
  return !at || !now || (at.x === now.x && at.y === now.y);
}
/** Enhanced Anchor: does an Anchor effect on this creature still apply? */
function anchorWeak(actor) {
  return spellEffects(actor, "anchorWeak").some(e => anchorStill(e.flags.flowstate.spellEffect.caster));
}

/** Start of the Mental user's turn: Equilibrium ends; Far Sight and Aura Sight lapse (Far Sight can be paid again). */
export async function turnStart(actor) {
  await wonders.pendingTurnStart(actor);
  if (actor.getFlag("flowstate", "stolenRoll")) await setActorFlag(actor, "stolenRoll", null);      // Larceny: a stolen roll lasts until your next turn
  if (hasForm(actor, "anchor")) { const pos = posOf(actor); await setActorFlag(actor, "turnPos", pos); }
  // Equilibrium (-1 Alignment) ends: you are back to the Alignment you set.
  if (alignmentOf(actor).equilibrium) await setAlignment(actor, { ...alignmentOf(actor), equilibrium: false });
  const psion = actor.getFlag("flowstate", "psion");
  if (!psion) return;
  let next = { ...psion, auraSight: false };
  if (psion.farSight) {
    const cost = mind(actor);
    const keep = actor.isOwner && psionTier(actor) >= 2 && (actor.system.energy?.value ?? 0) >= cost
      ? await DialogV2().confirm({ window: { title: "Far Sight" }, rejectClose: false, content: `<p>Pay <strong>${cost}</strong> Energy to keep Far Sight for another turn?</p>` }) : false;
    if (keep && (await pay(actor, { energy: cost }, "Far Sight"))) next.farSight = true; else next.farSight = false;
  }
  await setActorFlag(actor, "psion", next.farSight || next.auraSight ? next : null);
}

/** Every creature we can see on the scene or in the world (actors and unlinked tokens). */
const everyActor = () => [...new Set([...(globalThis.game?.actors ?? []), ...(globalThis.canvas?.tokens?.placeables ?? []).map(t => t.actor).filter(Boolean)])];

/** Just before this creature's effects on others end (its turn has started): Perennial offers to reapply expiring Life effects; Reverie may be kept. */
async function beforeClear(actor) {
  for (const f of wonders.BEFORE_CLEAR) await f(actor);
  const acts = wonders.perennialActs(actor);
  if (acts.length) await post(actor, { title: `${esc(actor.name)} — Perennial`, body: wonders.actButtons(acts), flags: { flowstate: { mentalAct: { acts } } } });
  // Reverie: the shielding holds between turns as long as you are still at least 2 in a Dream Alignment as your turn starts (it is kept, so there is nothing to pay).
  const rev = [];
  for (const a of everyActor()) for (const e of spellEffects(a, "shield")) { const d = e.flags.flowstate.spellEffect; if (d.reverie && d.caster === actor.uuid) rev.push(e); }
  if (!rev.length) return;
  const al = alignmentOf(actor);
  const keep = al.kind === "dream" && al.level >= 2;
  for (const e of rev) await changeEffect(e, { "flags.flowstate.spellEffect.persistent": keep });
}

/* -------------------------------------------- */
/*  Mental Theory: Patron, Dismissing, Will of Body and Spirit */
/* -------------------------------------------- */

/** Patron (Mental T5): when you rest, pick a Wonder. Aligned to it, its Manifests can Enhance or Burst without the energy cost. */
export async function choosePatron(actor) {
  if (theory(actor) < 5) return;
  const known = R.knownWonders(trees(actor)).filter(w => w.modes.length);
  if (!known.length) return;
  const cur = actor.getFlag("flowstate", "patron");
  const out = await DialogV2().prompt({ window: { title: `Patron Wonder: ${actor.name}` }, rejectClose: false,
    content: `<div class="fs-field"><label>Patron Wonder</label><select name="w"><option value="">— None —</option>${known.map(w => `<option value="${esc(w.id)}" ${cur === w.id ? "selected" : ""}>${esc(w.name)} (${R.KINDS[w.kind].label})</option>`).join("")}</select></div>
      <p class="hint">While you're aligned to it (${known.map(w => R.KINDS[w.kind].label).filter((v, i, a) => a.indexOf(v) === i).join(" / ")}), you can Enhance or Burst it without paying the energy.</p>`,
    ok: { label: "Choose", callback: (event, button) => button.form.elements.w.value } });
  if (out === null || out === undefined) return;
  await setActorFlag(actor, "patron", out || null);
  const w = R.wonderById(out);
  await post(actor, { title: `${esc(actor.name)} — Patron`, body: `<div class="fs-result">${esc(actor.name)}'s Patron Wonder is ${w ? `<strong>${esc(w.name)}</strong>` : "none"}.</div>` });
}

/** After a rest: Patron (Mental T5) and Preordained. */
async function afterRest(actor) {
  await wonders.afterRest(actor);
  if (theory(actor) >= 5 && actor.isOwner) await choosePatron(actor);
}

/** Dismissing Wonders: an attack roll at a creature carrying your Wonder effects (Range AP applies; they may dodge), or free on yourself. */
export async function dismiss(actor) {
  if (helpless(actor)) return ui.notifications.warn(`${actor.name} can't act.`);
  const mine = [];
  for (const a of everyActor()) for (const e of a.effects ?? []) {
    const d = e.flags?.flowstate?.spellEffect;
    if (!d || d.caster !== actor.uuid || e.flags.flowstate.ritualOf) continue;
    if (String(d.mode ?? "").startsWith("mental-") || d.ward || ["charge", "burden", "pending", "waste", "redirect", "anchorWeak", "premonition"].includes(d.kind) || d.below || d.mode === "verdant-soul") mine.push({ e, a, d });
  }
  if (!mine.length) return ui.notifications.info(`${actor.name} has no Wonder effects to dismiss.`);
  const out = await DialogV2().prompt({ window: { title: `Dismiss: ${actor.name}` }, rejectClose: false,
    content: `<div class="fs-field"><label>Dismiss</label><select name="e">${mine.map((x, i) => `<option value="${i}">${esc(x.e.name)} — on ${esc(x.a.name)}</option>`).join("")}</select></div>
      <div class="fs-field"><label>Range of the attack <small>(on someone else)</small></label><select name="range">${Object.entries(R.RANGES).filter(([k]) => k !== "area").map(([k, r]) => `<option value="${k}" ${k === "ranged" ? "selected" : ""}>${r.label} (${r.ap} AP)</option>`).join("")}</select></div>
      <p class="hint">Yours dismiss freely; on a creature you make an attack roll and they may dodge it.</p>`,
    ok: { label: "Dismiss", callback: (event, button) => formValues(button.form) } });
  if (!out) return;
  const pick = mine[Number(out.e)];
  if (!pick) return;
  if (pick.a.uuid === actor.uuid) {
    await changeEffect(pick.e, null);
    return post(actor, { title: `${esc(actor.name)} — Dismiss`, body: `<div class="fs-result">${esc(actor.name)} dismisses <strong>${esc(pick.e.name)}</strong>.</div>` });
  }
  const range = R.RANGES[out.range] ? out.range : "ranged";
  if (!(await pay(actor, { ap: R.RANGES[range].ap }, "dismissing a Wonder"))) return;
  return performAttack(actor, { ...baseAttack, label: `Dismiss ${pick.e.name}`, net: 0, melee: range === "melee", area: false,
    notes: [`Dismissing ${pick.e.name} on ${pick.a.name} (${R.RANGES[range].label})`], mental: { dismiss: { effects: [pick.e.uuid] }, caster: actor.uuid }, targetActors: [pick.a] });
}

/** Will of Body and Spirit (Mental T4): after a Martial or Magic attack, a Manifest whose Range costs the same AP is free (RP attacks need Burst). */
async function attackCost(actor, cost) {
  if (theory(actor) < 4 || !actor.isOwner) return;
  if (!R.knownWonders(trees(actor)).some(w => w.modes.length)) return;
  const n = cost.ap > 0 ? cost.ap : cost.rp;
  if (![1, 2, 3].includes(n)) return;
  const act = { id: "wobs", label: "Manifest (Will of Body and Spirit)", tip: `Manifest a Wonder whose Range costs ${n} ${cost.ap > 0 ? "AP" : "RP"}, with no AP/RP of its own${cost.ap > 0 ? "" : " (Burst: its Enhance energy still applies)"}`, cost: "free",
    caster: actor.uuid, ap: cost.ap > 0 ? n : 0, rp: cost.ap > 0 ? 0 : n };
  await post(actor, { title: `${esc(actor.name)} — Will of Body and Spirit`, body: wonders.actButtons([act]), flags: { flowstate: { mentalAct: { acts: [act] } } } });
}

/** Chant, Make Clear and Will of Body and Spirit buttons (wonders.runAct hands them over). */
export async function theoryAct(x) {
  if (x.id === "wobs") {
    const caster = await fromUuid(x.caster);
    const res = await manifest(caster, null, { wobs: { ap: x.ap, rp: x.rp } });
    return !!res;
  }
  return rerollAct(x);
}

/** A button on one of our follow-up cards: run that ability. Marks it used with a card of its own. */
async function act(message, i) {
  const x = message.getFlag("flowstate", "mentalAct")?.acts?.[Number(i)];
  if (!x) return;
  if (game.messages.find(m => { const f = m.getFlag("flowstate", "mentalActDone"); return f?.card === message.id && f.i === Number(i); })) return ui.notifications.info("Already used.");
  const done = x.id === "perennial" ? await wonders.runPerennial(x) : await wonders.runAct(x);
  if (done) await post(await fromUuid(x.caster), { title: "Used", body: `<div class="fs-notes">${esc(x.label)}: used.</div>`, flags: { flowstate: { mentalActDone: { card: message.id, i: Number(i) } } } });
}
export const usedActs = id => game.messages.filter(m => m.getFlag("flowstate", "mentalActDone")?.card === id).map(m => m.getFlag("flowstate", "mentalActDone").i);

registerMental({ onResolve, negate, reflect: reflectNow, turnStart, beforeClear, act, dodgeWaste: wonders.dodgeWaste, useWaste: wonders.useWaste, burdenNet: wonders.burdenNet, checkExecute: wonders.checkExecute, afterBreakFree: wonders.afterBreakFree, rest: afterRest, attackCost, anchorStill, anchorWeak,
  rollCharges: async ctx => { const a = await wondersB.onRollBuffs(ctx); const b = await charges.onRoll(ctx); return a && b ? { notes: [...a.notes, ...b.notes], rolls: [...a.rolls, ...b.rolls] } : a ?? b; },
  adjust: wondersB.adjust, blocked: wondersB.blocked, alterStacks: forging.alterStacks, damageStacks: wondersB.damageStacks, anyHit: wondersB.anyHit,
  resolveCharges: charges.afterResolve, damageCharges: charges.onDamage });
