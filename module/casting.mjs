/**
 * Casting (Magic Theory): the Cast Spell dialog, paying AP/RP and Energy, and the cast card.
 * The math lives in spells.mjs; this file talks to Foundry. Spell effects are resolved per spell as they are automated;
 * until then the card states the effect for the GM to resolve.
 */
import * as spells from "./spells.mjs";
import { post, inActiveCombat, helpless, spendPoints, spendEnergy, performAttack, checkRange, attackerToken, tokenDistance, setWeaveHook, requestGM, applySpellEffect, rollD100, pickSceneTarget } from "./actions.mjs";
import * as fx from "./spellfx.mjs";
import * as areas from "./areas.mjs";
import "./elemental.mjs";
import "./afflictions.mjs";
import * as conjure from "./conjure.mjs";
import * as arcana from "./arcana.mjs";
import { STATS } from "./rules.mjs";
import { tierOf } from "./skills.mjs";

const esc = s => foundry.utils.escapeHTML?.(String(s)) ?? String(s);
const DialogV2 = () => foundry.applications.api.DialogV2;

/** Is a hand free for Raw Casting? Fists don't count as holding anything. */
function freeHand(actor) {
  const used = actor.items.reduce((n, i) => {
    if (i.type === "weapon" && i.system.weaponType === "unarmed") return n;
    if (i.type !== "weapon" && i.type !== "foci") return n;
    return n + (i.system.equipped ? (i.system.twoHanded ? 2 : 1) : 0);
  }, 0);
  return used < 2;
}

/** Everything planCast() needs from an actor. */
export function castContext(actor, weave = null) {
  const eff = actor.system.derived?.effective ?? {};
  const foci = actor.items.filter(i => i.type === "foci" && i.system.equipped).map(i => ({
    id: i.id, name: i.name, profile: i.system.profile, attuned: !!i.system.attuned, broken: !!i.system.broken, twoHanded: !!i.system.twoHanded
  }));
  const ring = {};
  for (const i of actor.items) if (i.type === "foci" && i.system.fociType === "ring" && i.system.chosenSpell) ring[i.id] = i.system.chosenSpell;
  const rituals = Array.from(actor.effects ?? []).filter(e => !e.disabled && e.flags?.flowstate?.ritual?.freeCasts > 0)
    .map(e => ({ id: e.id, name: e.name, cores: e.flags.flowstate.ritual.cores, mods: e.flags.flowstate.ritual.mods, freeCasts: e.flags.flowstate.ritual.freeCasts }));
  const options = spells.castingOptions({ reach: eff.reach?.value ?? 0, grasp: eff.grasp?.value ?? 0, freeHand: freeHand(actor), foci });
  const theory = tierOf(actor.system.trees ?? {}, "magic-theory");
  // Weaving: only options whose normal AP equals the attack's can be woven; Webmaster (T5) keeps TR.
  if (weave) for (const o of options) if (o.ok && !o.ap.includes(weave.ap)) { o.ok = false; o.reason = `Takes ${o.ap.join("/")} AP; the attack you're weaving with costs ${weave.ap}.`; }
  return { inCombat: inActiveCombat(actor), trees: actor.system.trees ?? {}, skillPoints: actor.system.skillPoints ?? 0, options, focused: actor.system.focusedSpell || "", ring, extraTR: 0, rituals,
    weave: weave ? { ap: weave.ap, keepTR: theory >= 5 } : null };
}

/** Can this actor cast at all? (Knows a Core Spell and meets some casting requirement.) */
export function castSummary(actor, weave = null) {
  const ctx = castContext(actor, weave);
  const known = spells.knownSpells(ctx.trees);
  return { ctx, known, any: known.cores.length > 0, usable: ctx.options.some(o => o.ok) };
}

/* -------------------------------------------- */
/*  Dialog                                      */
/* -------------------------------------------- */

const coreSelect = (name, cores, value, blank) => `<select name="${name}">${blank ? `<option value="">—</option>` : ""}${cores.map(c =>
  `<option value="${c.id}" ${c.id === value ? "selected" : ""}>${esc(c.name)}${c.min !== c.max ? ` (${c.min}–${c.max})` : ` (${c.min})`}</option>`).join("")}</select>`;

function modRow(m, mods, v) {
  const on = m.stackable ? Number(v[`mod:${m.id}`]) > 0 : !!v[`mod:${m.id}`];
  const thr = m.replicate ? "X+1" : m.min === m.max ? m.min : `${m.min}–${m.max}`;
  const control = m.stackable
    ? `<input type="number" name="mod:${m.id}" value="${Number(v[`mod:${m.id}`]) || 0}" min="0" step="1" data-tooltip="Times applied (each adds Threshold)">`
    : `<input type="checkbox" name="mod:${m.id}" ${on ? "checked" : ""}>`;
  const extra = m.replicate
    ? `<select name="rep:${m.id}">${mods.filter(o => !o.replicate).map(o => `<option value="${o.id}" ${v[`rep:${m.id}`] === o.id ? "selected" : ""}>${esc(o.name)}</option>`).join("")}</select>`
    : m.min !== m.max ? `<input type="number" name="modT:${m.id}" value="${v[`modT:${m.id}`] ?? m.min}" min="${m.min}" max="${m.max}" step="1" data-tooltip="Threshold for this Mod">` : "";
  // Only one Replacement Mod can replace the base effect: once one is ticked, the others lose their box.
  const replaceTicked = mods.some(o => o.replacement && v[`replace:${o.id}`]);
  const replaceBox = m.replacement && (!replaceTicked || v[`replace:${m.id}`]) ? `<label class="fs-cast-sub" data-tooltip="Replace the spell's base effect with this one (doubled in power), instead of adding it on"><input type="checkbox" name="replace:${m.id}" ${v[`replace:${m.id}`] ? "checked" : ""}> replace base effect (×2)</label>` : "";
  const damp = m.name === "Dampen" ? [0, 1, 2].map(i => `<select name="dampen:${i}" data-tooltip="Archetype for stack ${i + 1}">${["martial", "mental", "magic"].map(a => `<option value="${a}" ${(v[`dampen:${i}`] ?? ["martial", "mental", "magic"][i]) === a ? "selected" : ""}>${a}</option>`).join("")}</select>`).join("") : "";
  const guess = m.name === "Telegraph" ? `<input type="number" name="telegraph" value="${v.telegraph ?? ""}" placeholder="dodge guess" data-tooltip="Predict their dodge roll before the attack">` : "";
  const manual = fx.AUTOMATED_MODS.has(m.id) ? "" : ` · <em data-tooltip="Costs Threshold, but its effect isn't automated yet: the GM resolves it from the card">not automated</em>`;
  const hint = m.name === "Exploit" ? " · each stack needs an Advantage on the attack, or it is refunded" : "";
  return `<label class="fs-cast-mod" data-tooltip="${esc(m.text)}">${control} <strong>${esc(m.name)}</strong> <small>${thr} Threshold${m.replacement ? " · Replacement" : ""}${m.stackable ? " · Stackable" : ""}${hint}${manual}</small> ${extra}${replaceBox}${damp}${guess}</label>`;
}

/** The Universal / Core 1 / Core 2 Mod tabs for the chosen Cores. */
export function modsHTML(ctx, v, theory) {
  const coreIds = [v.core1, v.core2].filter(Boolean);
  const all = spells.applicableMods(ctx.trees, coreIds);
  const universal = all.filter(m => m.universal);
  const own = id => all.filter(m => !m.universal && m.treeId === spells.spellById(id)?.treeId);
  const panel = (key, rows, empty) => `<div class="fs-cast-panel" data-panel="${key}">${rows.length ? rows.map(m => modRow(m, all, v)).join("") : `<p class="hint">${empty}</p>`}</div>`;
  const tab = (key, label, disabled) => `<button type="button" class="fs-cast-tab" data-tab="${key}" ${disabled ? "disabled" : ""}>${esc(label)}</button>`;
  const c1 = spells.spellById(v.core1), c2 = spells.spellById(v.core2);
  const focusedHere = ctx.focused && theory >= 4 && coreIds.includes(ctx.focused);
  return `<div class="fs-cast-tabs">${tab("universal", "Universal", false)}${tab("core1", c1 ? `${c1.name} Mods` : "Core 1 Mods", !c1)}${tab("core2", c2 ? `${c2.name} Mods` : "Core 2 Mods", !c2)}</div>
    ${panel("universal", universal, "No Universal Mods yet.")}${panel("core1", c1 ? own(c1.id) : [], "No Mods for this Core yet.")}${panel("core2", c2 ? own(c2.id) : [], "No Mods for this Core yet.")}
    ${focusedHere ? `<div class="fs-field"><label>Connection (free on your Focused Spell)</label><select name="connection"><option value="">None</option>${spells.CONNECTION_MODS.map(k => `<option value="${k}" ${v.connection === k ? "selected" : ""}>${k[0].toUpperCase() + k.slice(1)}</option>`).join("")}</select></div>` : ""}`;
}

/** The chosen Core's effect, or the Combo's when two are picked. */
function effectHTML(v) {
  const e = spells.effectText([v.core1, v.core2].filter(Boolean));
  return e ? `<strong>${esc(e.title)}</strong>: ${esc(e.text)}` : "";
}

/** The Charm / Hex choices a Tier 3 spell needs on the cast: which roll a Charm hits, a Hex's trigger. */
export function afflictHTML(v) {
  const ids = [v.core1, v.core2].filter(Boolean);
  const profile = ids.length ? fx.profileFor(ids) : null;
  const need = fx.afflictNeeds(profile);
  const sel = (name, opts, value) => `<select name="${name}">${Object.entries(opts).map(([k, label]) => `<option value="${k}" ${value === k ? "selected" : ""}>${esc(label)}</option>`).join("")}</select>`;
  const out = [];
  if (need.charm) out.push(`<div class="fs-field"><label>Charm: roll type</label>${sel("charmRoll", fx.ROLL_TYPES, v.charmRoll || "attack")}</div>`);
  if (need.hex) {
    const trig = v.hexTrigger || "harm";
    out.push(`<div class="fs-field"><label>Hex: trigger</label>${sel("hexTrigger", Object.fromEntries(Object.entries(fx.HEX_TRIGGERS).map(([k, t]) => [k, t.label])), trig)}</div>`);
    if (trig === "roll" || trig === "failsuccess") out.push(`<div class="fs-field"><label>…which roll</label>${sel("hexRoll", fx.ROLL_TYPES, v.hexRoll || "attack")}</div>`);
    if (trig === "failsuccess") out.push(`<div class="fs-field"><label>…fails or succeeds</label>${sel("hexOutcome", { fail: "Fails", success: "Succeeds" }, v.hexOutcome || "fail")}</div>`);
    if (trig === "act" || trig === "word") out.push(`<div class="fs-field"><label>${trig === "act" ? "Declared action" : "Word or condition"}</label><input type="text" name="hexDetail" value="${esc(v.hexDetail ?? "")}"></div>`);
  }
  // Illusion: the sense a Mirage dulls, and Fidelity's tangible affliction.
  if (profile?.arcana?.kind === "mirage" && !profile.arcana.chart) out.push(`<div class="fs-field"><label>Mirage: sense</label>${sel("sense", { sight: "Sight", sound: "Sound", smell: "Smell", other: "Another sense" }, v.sense || "sight")}</div>`);
  if (profile?.arcana?.kind === "mirage" && v["mod:magic-illusion:fidelity"]) {
    out.push(`<div class="fs-field"><label>Fidelity: it makes them</label>${sel("fidelityKind", { fear: "Afraid (no Energy regain)", dis: "Disadvantaged on a roll type" }, v.fidelityKind || "fear")}</div>`);
    if (v.fidelityKind === "dis") out.push(`<div class="fs-field"><label>…rolls of</label>${sel("fidelityRoll", fx.ROLL_TYPES, v.fidelityRoll || "attack")}</div>`);
  }
  // Delay: what sets it off.
  if (v["mod:magic-restoration-arcana:delay"]) out.push(`<div class="fs-field"><label>Delay: trigger</label><input type="text" name="delayTrigger" value="${esc(v.delayTrigger ?? "")}" placeholder="when…"></div>`);
  if (need.hexDie) out.push(`<div class="fs-field"><label>Hex: shrink their</label>${sel("hexDie", { dodge: "Dodge (−3 die size)", attack: "Attack (−6 die size)" }, v.hexDie || "dodge")}</div>`);
  return out.join("");
}

function previewHTML(plan, ctx) {
  if (!plan.ok) return `<p class="fs-warn">${plan.errors.map(esc).join(" ")}</p>`;
  const parts = [`${plan.base}${plan.combo ? " (Combo)" : ""}`, ...plan.applied.filter(a => a.threshold).map(a => `${a.mod.name} ${a.threshold}`)].join(" + ");
  const tr = plan.trParts.map(p => `${p.label} ${p.value}`).join(", ") || "none";
  return `<div class="fs-cast-sum">
    <div><strong>Threshold ${plan.threshold}</strong> <small>(${parts}${plan.tr ? ` − TR ${plan.tr}: ${tr}` : ""})</small></div>
    <div><strong>${plan.ritual ? `Ritual: ${plan.instantRitual ? "instant" : `${plan.ritualHours} h`}, −${plan.ritualLoss} max Energy` : `${plan.energy} Energy`}</strong>${plan.ritual && !plan.instantRitual ? "" : ` · ${plan.ap} ${plan.usesRP ? "RP" : "AP"}`}
      · Spell Power ×${plan.power} <small>(${STATS[plan.scalingStat]?.label ?? plan.scalingStat} ${plan.scaling})</small> · ${esc(plan.attack ?? "")}</div></div>`;
}

/** Read the dialog's form into the values planCast() expects. */
export function valuesFromForm(form) {
  const v = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    v[el.name] = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value;
  }
  return v;
}

function dialogHTML(ctx, v) {
  const known = spells.knownSpells(ctx.trees);
  const theory = tierOf(ctx.trees, "magic-theory");
  const opts = ctx.options.map(o => `<option value="${o.key}" ${o.key === v.via ? "selected" : ""} ${o.ok ? "" : "disabled"}>${esc(o.label)}${o.ok ? "" : ` — ${esc(o.reason)}`}</option>`).join("");
  const sel = ctx.options.find(o => o.key === v.via);
  const bt = spells.baseThreshold([v.core1, v.core2].filter(Boolean));
  return `<div class="fs-cast">
    <div class="fs-field"><label>Cast through</label><select name="via">${opts}</select></div>
    <div class="fs-field fs-cast-ap" ${sel?.ap?.length > 1 ? "" : "hidden"}><label>AP (more AP = more TR)</label><select name="ap">${[1, 2, 3].map(n => `<option value="${n}" ${Number(v.ap) === n ? "selected" : ""}>${n} AP · ${n} TR</option>`).join("")}</select></div>
    <div class="fs-field"><label>Core Spell</label>${coreSelect("core1", known.cores, v.core1, false)}</div>
    <div class="fs-field"><label>Second Core (Combo)</label>${coreSelect("core2", known.cores.filter(c => c.id !== v.core1), v.core2, true)}</div>
    <div class="fs-field fs-cast-base" ${bt.ok && bt.max > bt.min ? "" : "hidden"}><label>Core Threshold</label><input type="number" name="base" value="${v.base ?? bt.min}" min="${bt.min}" max="${bt.max}" step="1"></div>
    <div class="fs-cast-effect">${effectHTML(v)}</div>
    <div class="fs-cast-afflict">${afflictHTML(v)}</div>
    <div class="fs-cast-mods">${modsHTML(ctx, v, theory)}</div>
    ${(() => { const only = v.core1 && !v.core2 ? fx.profileFor([v.core1]) : null; return only?.hold ? `<label class="fs-cast-mod"><input type="checkbox" name="hold" ${v.hold ? "checked" : ""}> <strong>Hold it</strong> <small>in melee: no damage, but it stays available to use again for the same AP until your next turn</small></label>` : ""; })()}
    ${ctx.rituals?.length ? `<div class="fs-field"><label>Free cast from Ritual</label><select name="useRitual"><option value="">None</option>${ctx.rituals.map(r => `<option value="${r.id}" ${v.useRitual === r.id ? "selected" : ""}>${esc(r.name)} (${r.freeCasts} left)</option>`).join("")}</select></div>` : ""}
    ${theory >= 2 && !ctx.inCombat ? `<label class="fs-cast-mod"><input type="checkbox" name="ritual" ${v.ritual ? "checked" : ""}> <strong>Ritual</strong> <small>takes hours instead of AP, and lowers your max Energy while it lasts (out of combat)</small></label>` : ""}
    <div class="fs-cast-preview">${previewHTML(spells.planCast(ctx, v), ctx)}</div>
  </div>`;
}

/** Ask what to cast. Returns the form values, or null if cancelled. */
async function castDialog(actor, ctx) {
  const known = spells.knownSpells(ctx.trees);
  let v = {
    via: (ctx.options.find(o => o.ok) ?? ctx.options[0])?.key,
    ap: 2, core1: known.cores[0]?.id ?? "", core2: "", base: known.cores[0]?.min ?? 1
  };
  return DialogV2().prompt({
    window: { title: `Cast a spell: ${actor.name}` },
    content: dialogHTML(ctx, v),
    render: (event, dlg) => {
      const el = dlg?.element ?? dlg;
      const form = el?.querySelector?.("form");
      if (!form) return;
      const showTab = key => {
        for (const p of form.querySelectorAll(".fs-cast-panel")) p.hidden = p.dataset.panel !== key;
        for (const t of form.querySelectorAll(".fs-cast-tab")) t.classList.toggle("active", t.dataset.tab === key);
      };
      const refresh = (rebuild, changed) => {
        v = valuesFromForm(form);
        if (changed === "core1" || changed === "core2") { v.base = spells.baseThreshold([v.core1, v.core2].filter(Boolean)).min; }
        if (rebuild) {
          const bt = spells.baseThreshold([v.core1, v.core2].filter(Boolean));
          form.querySelector(".fs-cast-effect").innerHTML = effectHTML(v);
          form.querySelector(".fs-cast-afflict").innerHTML = afflictHTML(v);
          form.querySelector(".fs-cast-mods").innerHTML = modsHTML(ctx, v, tierOf(ctx.trees, "magic-theory"));
          const baseField = form.querySelector(".fs-cast-base");
          baseField.hidden = !(bt.ok && bt.max > bt.min);
          if (!baseField.hidden) { const inp = baseField.querySelector("input"); inp.min = bt.min; inp.max = bt.max; inp.value = Math.min(bt.max, Math.max(bt.min, v.base)); }
          showTab("universal");
        }
        const plan = spells.planCast(ctx, valuesFromForm(form));
        form.querySelector(".fs-cast-preview").innerHTML = previewHTML(plan, ctx);
        form.querySelector(".fs-cast-ap").hidden = !(ctx.options.find(o => o.key === form.elements.via?.value)?.ap?.length > 1);
        const ok = el.querySelector('button[data-action="ok"]');
        if (ok) ok.disabled = !plan.ok;
      };
      const activeTab = () => form.querySelector(".fs-cast-tab.active")?.dataset.tab ?? "universal";
      form.addEventListener("change", e => {
        const name = e.target?.name ?? "";
        if (name.startsWith("replace:")) {                       // the other Replacement boxes appear or vanish
          const tab = activeTab();
          v = valuesFromForm(form);
          form.querySelector(".fs-cast-mods").innerHTML = modsHTML(ctx, v, tierOf(ctx.trees, "magic-theory"));
          showTab(tab);
          refresh(false);
        } else if (name === "hexTrigger" || name === "fidelityKind" || name.startsWith("mod:")) { form.querySelector(".fs-cast-afflict").innerHTML = afflictHTML(valuesFromForm(form)); refresh(false); }
        else refresh(["core1", "core2"].includes(name), name);
      });
      form.addEventListener("click", e => { const t = e.target?.closest?.(".fs-cast-tab"); if (t && !t.disabled) showTab(t.dataset.tab); });
      showTab("universal");
      refresh(false);
    },
    ok: { label: "Cast", icon: "fa-solid fa-wand-sparkles", callback: (event, button) => valuesFromForm(button.form) },
    rejectClose: false
  });
}

/* -------------------------------------------- */
/*  Casting                                     */
/* -------------------------------------------- */

const stripHeader = spells.stripHeader;

/** Cast card: the cost breakdown and the effect text for the GM to resolve (until the spell is automated). */
export function castCardHTML(actor, plan) {
  const names = plan.cores.map(c => c.name).join(" + ");
  const via = esc(plan.option.label);
  const parts = [`${plan.base}`, ...plan.applied.filter(a => a.threshold).map(a => `${esc(a.mod.name)} ${a.threshold}`)].join(" + ");
  const eff = spells.effectText(plan.cores.map(c => c.id));
  const effects = eff ? `<li><strong>${esc(plan.combo ? eff.title : plan.cores[0].name)}:</strong> ${esc(eff.text)}</li>` : "";
  const mods = plan.applied.map(a => `<li><strong>${esc(a.mod.name)}${a.free ? " (Connection)" : ""}${a.replicates ? ` (copies ${esc(spells.spellById(a.replicates)?.name ?? "")})` : ""}:</strong> ${esc(stripHeader(a.mod.text))}</li>`).join("");
  return `<div class="fs-result"><strong>${esc(actor.name)}</strong> casts <strong>${esc(names)}</strong>${plan.combo ? " (Combo Spell)" : ""}${plan.ritual ? " as a <em>Ritual</em>" : ""}.</div>
    <ul class="fs-list">
      <li>Through ${via}${plan.ritual && !plan.instantRitual ? "" : ` · ${plan.ap} ${plan.usesRP ? "RP" : "AP"}`}</li>
      <li>Threshold <strong>${plan.threshold}</strong> (${parts}${plan.tr ? ` − TR ${plan.tr}` : ""})${plan.ritual ? ` · ${plan.instantRitual ? "instant" : `${plan.ritualHours} hour${plan.ritualHours === 1 ? "" : "s"}`}, max Energy −${plan.ritualLoss}` : ` · <strong>${plan.energy} Energy</strong>`}</li>
      <li>Spell Power ×${plan.power} (${STATS[plan.scalingStat]?.label ?? plan.scalingStat} ${plan.scaling}) · ${esc(plan.attack ?? "")}</li>
    </ul>
    <ul class="fs-list">${effects}${mods}</ul>
    ${plan.note ? `<p class="hint">${plan.note}</p>` : ""}`;
}

/** Cast a spell: dialog → check → spend → post. Returns the plan, or null if nothing was cast. */
export async function castSpell(actor, preset = null, { weave = null, fire = null } = {}) {
  if (helpless(actor)) { ui.notifications.warn(`${actor.name} is ${actor.statuses.has("dead") ? "dead" : "unconscious"} and can't cast.`); return null; }
  const { ctx, known } = castSummary(actor, weave);
  if (!known.cores.length) { ui.notifications.warn(`${actor.name} doesn't know any Core Spells yet (unlock a Magic school).`); return null; }
  if (!ctx.options.some(o => o.ok)) { ui.notifications.warn(`${actor.name} can't cast right now: ${ctx.options.map(o => `${o.label}: ${o.reason}`).join(" · ")}`); return null; }
  const values = preset ?? await castDialog(actor, ctx);
  if (!values) return null;
  const plan = spells.planCast(ctx, values);
  if (!plan.ok) { ui.notifications.warn(plan.errors.join(" ")); return null; }

  const inCombat = inActiveCombat(actor);
  if (plan.ritual && inCombat && !plan.instantRitual) { ui.notifications.warn("Rituals take hours and can't be cast in combat."); return null; }
  if (inCombat && !plan.usesRP && !weave && game.combat.combatant?.actor?.uuid !== actor.uuid) {
    ui.notifications.warn("You can only cast with AP on your own turn (the React Mod casts with RP instead).");
    return null;
  }
  // Check everything before spending anything.
  const ids = plan.cores.map(c => c.id);
  const profile = fx.profileFor(ids);
  const mods = fx.modCounts(plan.applied);
  let targets = fire ? fire.targets.map(a => ({ actor: a })) : weave ? weave.targetActors.map(a => ({ actor: a })) : [...(game.user?.targets ?? [])].filter(t => t.actor && t.actor.type !== "pile");
  // Aura (Illusion T5): the Mirage surrounds you; everything within 50 ft gets the attack roll.
  if (mods.aura && !weave && !fire) { const near = arcana.auraTargets(actor); if (near.length) targets = near.map(a => ({ actor: a })); }
  // Projection (Build Arcana T5): the spell is cast from the position of a creature within 100 ft of you (willing, or hit by a Targeted attack roll: you resolve that).
  let origin = null;
  if (mods.projection && !weave) {
    const who = await pickSceneTarget(actor, { title: "Projection: cast from", within: 100, anchors: [attackerToken(actor)], exclude: [] });
    origin = who?.getActiveTokens?.()[0] ?? null;
    if (globalThis.canvas?.tokens?.placeables?.length && !origin) return null;
  }
  const meleeRange = !!targets[0]?.actor && inMeleeRange(actor, targets[0].actor, origin);
  if (weave?.melee && !meleeRange) { ui.notifications.warn("A woven spell must be the same kind of attack: the target has to be within your personal melee range for a melee attack."); return null; }
  // Snipe (Magic Theory T4) doubles the range; past the normal range the initial attack roll has Disadvantage.
  const normalRange = plan.attack === "Targeted" ? 100 : 200;
  if (!weave && !fire && !mods.aura && !plan.ritual && !meleeRange && (plan.attack === "Ranged" || plan.attack === "Targeted") && !checkRange(actor, normalRange * (mods.snipe ? 2 : 1), `${plan.cores.map(c => c.name).join(" + ")} (${plan.attack}${mods.snipe ? ", Snipe" : ""})`, null, origin)) return null;
  // Area spells (Gravity Field) and Emplace: choose a shape and place it before anything is spent; everything it touches is targeted.
  const emplace = !!mods.emplace && !!profile?.shield;
  // Lob / Explode: a Ranged hit on the primary target, then an Area version where it lands.
  const rangedPlusArea = !!(mods.lob || mods.explode) && !emplace;
  const areaSpell = !weave && (!!mods["gravity field"] || !!mods.blast || emplace || rangedPlusArea);
  const primary = targets.map(t => t.actor).filter(Boolean).slice(0, 1);
  let placed;
  if (areaSpell) {
    const fociItem = plan.option?.fociId ? actor.items.get?.(plan.option.fociId) ?? actor.items.find(i => i.id === plan.option.fociId) : null;
    const agate = fociItem?.system?.attuned && fociItem.system.profile?.affixes?.includes("agate") ? (fociItem.system.profile.affixPlus ? 2 : 1.5) : 1;
    const aim = [...(game.user?.targets ?? [])][0];
    const originTok = rangedPlusArea ? (aim?.object ?? aim) : null;
    const layered = (mods.layered ?? 0) * Math.max(0, actor.system.derived?.effective?.build?.value ?? 0);
    placed = await areas.placeArea(actor, { title: emplace ? "Emplace" : mods.blast && !mods["gravity field"] ? "Blast" : "Gravity Field", scale: (mods.snipe ? 2 : 1) * agate, aim, origin: originTok?.center ? originTok : null,
      facing: emplace, flags: { spell: emplace ? "emplace" : mods.blast && !mods["gravity field"] ? "blast" : "gravity field", ...(emplace ? { health: 20 * plan.power + layered, limit: 20 * plan.power + layered } : {}) } });
    if (placed === null) return null;                                    // cancelled: nothing is spent
    if (placed && !emplace) targets = placed.actors.map(a => ({ actor: a }));
    // Mold (Reach Arcana T3): you choose who in the area is attacked.
    if (mods.mold && !emplace && targets.length > 1) targets = (await pickMold(actor, targets.map(t => t.actor), values.moldPick)).map(a => ({ actor: a }));
  }
  const hold = !!values.hold && plan.cores.length === 1 && !!profile?.hold && !plan.ritual && !weave;
  if (values.hold && !hold) { ui.notifications.warn("Only a single Flame, Frost, Crackle or Glob can be held (not woven or as a Ritual)."); return null; }
  if (hold && !meleeRange) { ui.notifications.warn("A held spell is cast in melee: the target has to be within your personal melee range."); return null; }
  plan.hold = hold;
  // Frost + Crackle only works on creatures with no Energy left.
  if (profile?.needsEnergyZero) {
    const rich = targets.map(t => t.actor).filter(a => (a?.system?.energy?.value ?? 0) > 0);
    if (rich.length) { ui.notifications.warn(`${plan.cores.map(c => c.name).join(" + ")} can only target creatures with zero Energy remaining (${rich.map(a => a.name).join(", ")} ${rich.length === 1 ? "has" : "have"} some).`); return null; }
  }
  // Tier 4: Form, Make and Animate ask what they create before anything is spent.
  const conjureCast = !!profile?.conjure;
  let cjSpec = null;
  if (conjureCast && !plan.ritual) { cjSpec = fire && values.conj ? values.conj : await conjure.prompt({ actor, plan, profile, mods, values, targets }); if (!cjSpec) return null; }
  // Tier 5: Restore and Shift ask what they need before anything is spent; a Mirage is an attack and goes on to the exchange.
  const arcanaCast = !!profile?.arcana && profile.arcana.kind !== "mirage";
  let arcSpec = null;
  if (arcanaCast && !plan.ritual) { arcSpec = fire && values.arcanaSpec ? values.arcanaSpec : await arcana.prompt({ actor, plan, profile, mods, values, targets }); if (!arcSpec) return null; }
  const key = plan.usesRP ? "rp" : "ap";
  if (!fire) {
    if (inCombat && plan.ap && actor.system[key].value < plan.ap) { ui.notifications.warn(`${actor.name} needs ${plan.ap} ${key.toUpperCase()} to cast this but has ${actor.system[key].value}.`); return null; }
    if (inCombat && plan.energy && actor.system.energy.value < plan.energy) { ui.notifications.warn(`${actor.name} needs ${plan.energy} Energy to cast this but has ${actor.system.energy.value}.`); return null; }
    if (!(await spendPoints(actor, key, plan.ap, "casting"))) return null;
    if (!(await spendEnergy(actor, plan.energy, "casting"))) return null;
  }

  // A Ritual: Shield lasts until the Ritual ends; the attack spells store two free casts. Free casts used up end the Ritual.
  let ritualOf = null;
  if (plan.ritual && !fire) {
    const heldRitual = !!profile?.hold && plan.cores.length === 1;
    const stored = !profile?.shield && !!profile && !heldRitual;
    const t3 = !!profile?.afflict || !!profile?.conjure || ["restore", "mirage"].includes(profile?.arcana?.kind);
    const made = await actor.createEmbeddedDocuments?.("ActiveEffect", [{
      name: `Ritual: ${plan.cores.map(c => c.name).join(" + ")}`, img: "icons/magic/symbols/runes-star-orange.webp", origin: actor.uuid,
      description: `Max Energy −${plan.ritualLoss} while the ritual lasts.${stored ? (t3 ? " One free cast of this spell (AP/RP still needed): on a hit its effect lasts until the Ritual ends, and a miss leaves the free cast." : " Two free casts of this spell (AP/RP still needed); the Ritual ends after the second.") : " Ending this effect ends the ritual's spell effects."}`,
      flags: { flowstate: { ritual: { cores: ids, mods: plan.applied.filter(a => !a.free).map(a => a.mod.id), energyLost: plan.ritualLoss, power: plan.power, ...(stored ? { freeCasts: t3 ? 1 : 2, t3 } : {}) } } }
    }]);
    ritualOf = made?.[0]?.uuid ?? null;
    // Ritual Flame/Frost/Crackle/Glob: the spell stays held until the Ritual ends.
    if (heldRitual) await areasHeld(actor, { ...plan, ap: plan.option.ap.length === 1 ? plan.option.ap[0] : 2 }, profile, ids, fx.modCounts(plan.applied), ritualOf);
    plan.note = heldRitual ? `Ritual complete: the ${profile.name.toLowerCase()} stays held until the Ritual ends (use it from the Action List for AP only).` : stored ? (t3 ? "Ritual complete: one free cast is ready (cast it again with the Ritual selected); on a hit its effect lasts until the Ritual ends." : "Ritual complete: two free casts of this spell are ready (cast it again with the Ritual selected).") : profile ? "" : "";
  } else if (plan.freeFrom && !fire) {
    const r = actor.effects.get?.(plan.freeFrom) ?? Array.from(actor.effects).find(e => e.id === plan.freeFrom);
    if (r?.flags?.flowstate?.ritual?.t3) {
      // Poison / Charm / Hex Rituals: the free cast is used up only on a hit, and what it applies lasts until the Ritual ends.
      ritualOf = r.uuid; plan.t3Free = r.id;
      plan.note = "Free cast: if it hits, its effect lasts until the Ritual ends (a miss leaves the free cast).";
    } else {
      const left = (r?.flags?.flowstate?.ritual?.freeCasts ?? 1) - 1;
      if (left <= 0) await r?.delete();
      else await r?.update({ "flags.flowstate.ritual.freeCasts": left });
      plan.note = left <= 0 ? "That was the Ritual's last free cast: the Ritual ends." : `${left} free cast${left === 1 ? "" : "s"} left on the Ritual.`;
    }
  }
  const manual = plan.applied.filter(a => !a.free && !fx.AUTOMATED_MODS.has(a.mod.id)).map(a => a.mod.name);
  if (manual.length && profile) plan.note = `${plan.note ? `${plan.note} ` : ""}Not automated yet (the GM resolves it from the text above): ${[...new Set(manual)].join(", ")}.`;
  if (!plan.note && !profile) plan.note = `Spell effects for this spell aren't automated yet: scale the effect by Spell Power ×${plan.power} and resolve it at the table (attack roll, damage, and effects).`;

  await post(actor, {
    title: `${esc(actor.name)} casts ${esc(plan.cores.map(c => c.name).join(" + "))}`,
    body: castCardHTML(actor, plan),
    flags: { flowstate: { spell: { caster: actor.uuid, cores: ids, mods: plan.applied.map(a => a.mod.id), power: plan.power, threshold: plan.threshold, energy: plan.energy, ritual: plan.ritual, attack: plan.attack } } }
  });
  // Delay (Restoration Arcana T4): the spell waits for a trigger you name now (until the start of your next turn if it has no duration).
  if (mods.delay && !fire && !plan.ritual) {
    const trigger = values.delayTrigger || "the trigger you named";
    await applySpellEffect(actor, { kind: "delayed", caster: actor.uuid, name: `Delayed ${plan.cores.map(c => c.name).join(" + ")}`, trigger, targets: targets.map(t => t.actor.uuid),
      values: { ...values, conj: cjSpec ?? undefined, arcanaSpec: arcSpec ?? undefined, ritual: false, useRitual: "", hold: false }, description: `Waits for: ${trigger}. Trigger it from the Action List (until the start of your next turn).` });
    await post(actor, { title: `${esc(actor.name)} — Delay`, body: `<div class="fs-result"><i class="fa-solid fa-hourglass-half"></i> ${esc(plan.cores.map(c => c.name).join(" + "))} is held, waiting for: <strong>${esc(trigger)}</strong> (against ${targets.length ? targets.map(t => esc(t.actor.name)).join(", ") : "its target"}). Use <em>Trigger delayed spell</em> in the Action List when it happens.</div>` });
    return plan;
  }
  // Automated spells go on to the attack exchange (Rituals of attack spells just store their free casts).
  if (emplace) {
    // The barrier is a real one-way Wall (movement only), made through the GM; its template holds the health.
    if (placed?.tpl) await requestGM("createWalls", { sceneId: placed.sceneId, walls: areas.wallData(placed.tpl, placed.front, placed.grid, { barrierOf: placed.templateId, areaOf: actor.uuid }) });
    await emplaceCard(actor, { health: 20 * plan.power + (mods.layered ?? 0) * Math.max(0, actor.system.derived?.effective?.build?.value ?? 0), shapeLabel: areas.AREA_SHAPES[placed?.shape]?.label ?? "your chosen area", templateId: placed?.templateId, sceneId: placed?.sceneId, walls: !!placed?.tpl });
  }
  else if (conjureCast) { if (!plan.ritual) await conjure.resolve({ actor, plan, profile, spec: cjSpec, mods, ritualOf, targets, values }); }
  else if (arcanaCast) { if (!plan.ritual) await arcana.resolve({ actor, plan, profile, spec: arcSpec, mods, ritualOf, targets }); }
  else if (profile && (!plan.ritual || profile.shield)) await resolveSpell(actor, plan, profile, ids, ritualOf, targets, meleeRange, ctx, values, { normalRange, weave, primary, rangedPlusArea });
  return plan;
}

/** Is the target within the caster's personal melee range? (False without tokens.) */
function inMeleeRange(actor, other, from = null) {
  const a = from ?? attackerToken(actor), b = other.getActiveTokens?.()[0];
  if (!a || !b || !globalThis.canvas?.grid) return false;
  return tokenDistance(a, b) <= (actor.system.derived?.size?.melee ?? 5);
}

/** Make the spell's attack: Pinpoint and melee range give Advantage, Targeted spells attack from half stealth. */
async function resolveSpell(actor, plan, profile, ids, ritualOf, targets, melee, ctx, values, { normalRange = 200, weave = null, primary = [], rangedPlusArea = false } = {}) {
  let targetActors = targets.map(t => t.actor);
  if (!targetActors.length && profile.shield) targetActors = [actor];     // a Shield with no target goes on yourself
  const area = plan.applied.some(a => ["Gravity Field", "Blast", "Aura"].includes(a.mod.name)) || rangedPlusArea;
  if (targetActors.length > 1 && !area) { ui.notifications.info(`${profile.name} has a single target: using ${targetActors[0].name}.`); targetActors = targetActors.slice(0, 1); }
  const pinpoint = plan.applied.some(a => a.mod.name === "Pinpoint");
  const mods0 = fx.modCounts(plan.applied);
  // Snipe: Disadvantage on the initial attack roll when the target is in the extra range.
  let farNet = 0;
  const srcTok = attackerToken(actor), dstTok = targetActors[0]?.getActiveTokens?.()[0];
  if (mods0.snipe && !melee && srcTok && dstTok && globalThis.canvas?.grid && tokenDistance(srcTok, dstTok) > normalRange) farNet = -1;
  const notes = [pinpoint ? "Pinpoint: Advantage" : "", melee ? "Cast in melee range: Advantage" : "", farNet ? "Snipe: target is in the extra range (Disadvantage)" : "", weave ? "Woven into an attack: no AP/RP, no TR" : ""].filter(Boolean);
  const dice = profile.damage ? fx.damageDice(profile, plan.power) : null;
  const holdRoll = plan.hold && dice ? (await new Roll(`${dice.n}d${dice.sides}`).evaluate()).total : 0;
  const mods = mods0;
  const replaced = Object.fromEntries(plan.applied.filter(a => a.replace).map(a => [a.mod.name.toLowerCase(), true]));
  const dampen = plan.applied.filter(a => a.mod.name === "Dampen").map(a => a.archetype);
  // Exploit: how much Energy comes back if some stacks have no Advantage to consume (worked out against the real attack roll).
  let exploit = null;
  const exploitMod = plan.applied.find(a => a.mod.name === "Exploit")?.mod;
  if (mods.exploit && exploitMod && !plan.freeFrom) {
    const refund = [0];
    for (let unused = 1; unused <= mods.exploit; unused++) {
      const fewer = spells.planCast(ctx, { ...values, [`mod:${exploitMod.id}`]: mods.exploit - unused });
      refund[unused] = Math.max(0, plan.energy - fewer.energy);
    }
    exploit = { stacks: mods.exploit, die: fx.exploitDie(plan.power), refund };
  } else if (mods.exploit) exploit = { stacks: mods.exploit, die: fx.exploitDie(plan.power), refund: [] };
  const pierce = mods.pierce ? mods.pierce * fx.piercePerStack(plan.power) : 0;
  // Bash (Crushing T3): Bash 10 × Power per stack (an object with that much Limit or less is ignored for extra damage).
  const bash = mods.bash ? mods.bash * 10 * plan.power : 0;
  const attackOpts = {
    label: profile.name + (plan.hold ? " (held)" : ""), net: (pinpoint ? 1 : 0) + (melee && !plan.hold ? 1 : 0) + farNet, stealth: plan.attack === "Targeted" ? "half" : "none", melee, area, push: false,
    damage: dice && !plan.hold ? `${dice.n}d${dice.sides}` : "", type: profile.damage?.type ?? "physical", stacks: 0, physical: false, shots: 1, critStacks: 0, pierce, bash, knockback: 0,
    notes: [...notes, plan.hold ? `Held: no damage, ${holdRoll} worth of effect` : "", pierce ? `Pierce ${pierce} (ignores that much Limit)` : "", bash ? `Bash ${bash}` : "", area ? "Area: everything targeted is in the area" : ""].filter(Boolean), followups: [], ...(targetActors.length ? { targetActors } : {}),
    spell: { cores: ids, power: plan.power, ritualOf, scaling: plan.scaling, mods, exploit, replaced, dampen, singleRoll: area, telegraph: plan.telegraph && mods.telegraph ? { guess: plan.telegraph } : null, hold: plan.hold, holdRoll,
      ...(profile.arcana?.kind === "mirage" ? { ritualFree: plan.t3Free ?? null, arcana: { sense: values?.sense, fidelity: values?.fidelityKind, fidelityRoll: values?.fidelityRoll } } : {}),
      ...(profile.afflict ? { ritualFree: plan.t3Free ?? null, afflict: { charmRoll: values?.charmRoll, hexDie: values?.hexDie, hex: { trigger: values?.hexTrigger, roll: values?.hexRoll, outcome: values?.hexOutcome, detail: values?.hexDetail } } } : {}) }
  };
  if (plan.hold) await areasHeld(actor, plan, profile, ids, mods, ritualOf);
  let first;
  if (rangedPlusArea) {
    // Lob / Explode: the Ranged part hits the primary target; the Area part goes off where it lands, whether or not that hit.
    const p = primary.length ? primary : targetActors.slice(0, 1);
    first = await performAttack(actor, { ...attackOpts, area: false, targetActors: p, notes: [...attackOpts.notes, "Ranged part (primary target)"], spell: { ...attackOpts.spell, singleRoll: false } });
    await performAttack(actor, { ...attackOpts, area: true, notes: [...attackOpts.notes, "Area part"], spell: { ...attackOpts.spell, singleRoll: true, exploit: null } });
  } else first = await performAttack(actor, attackOpts);
  // Duplicate (Magic Theory T5): cast once more for free, at any valid target.
  if (mods.duplicate) {
    const picked = await pickDuplicateTarget(actor, targetActors, values?.dupTarget);
    if (picked?.length) await performAttack(actor, { ...attackOpts, targetActors: picked, area: false, notes: [...attackOpts.notes, "Duplicate: the free second cast"], spell: { ...attackOpts.spell, exploit: null, telegraph: null, ritualOf: null } });
  }
  // Multicast (Reach Arcana T1, stacking with Minigun at T5): pay the same AP/RP again to recast it for free.
  if (mods.multicast) await multicastCard(actor, plan, first, targetActors, mods.multicast, !!mods.duplicate);
  return first;
}

/** Mold (Reach Arcana T3): pick who in the area is attacked. */
async function pickMold(actor, actors, preset) {
  if (preset) return actors.filter(a => preset.includes(a.uuid));
  const out = await DialogV2().prompt({
    window: { title: "Mold: who is attacked?" },
    content: `<div class="fs-cast">${actors.map(a => `<label class="fs-cast-mod"><input type="checkbox" name="m:${a.uuid}" checked> ${esc(a.name)}</label>`).join("")}</div>`,
    ok: { label: "Attack them", callback: (event, button) => valuesFromForm(button.form) }, rejectClose: false
  });
  if (!out) return actors;
  return actors.filter(a => out[`m:${a.uuid}`]);
}

/** The Multicast card: a button per remaining recast. */
async function multicastCard(actor, plan, attackMsg, targetActors, count, dup) {
  const cost = Math.max(1, plan.ap || 1), key = plan.usesRP ? "rp" : "ap";
  await post(actor, { title: `${esc(actor.name)} — Multicast`, body: `<div class="fs-result">Multicast: recast it at the same target${targetActors.length === 1 ? "" : "s"} for free by paying ${cost} ${key.toUpperCase()} again${count > 1 ? ` (up to ${count} times)` : ""}.</div>
    <div class="fs-brawl-row fs-multicast-row" data-role="attacker" data-owner="${actor.uuid}"><button type="button" class="fs-multicast"><i class="fa-solid fa-repeat"></i> Multicast (${cost} ${key.toUpperCase()})</button></div>`,
    flags: { flowstate: { multicast: { attackMessage: attackMsg?.id ?? null, cost, key, remaining: count, targets: targetActors.map(a => a.uuid), dup, caster: actor.uuid } } } });
}

/** Click: pay and recast the same spell (and its Duplicate) for no Energy. */
export async function multicast(message) {
  const mc = message.getFlag("flowstate", "multicast");
  if (!mc || mc.remaining <= 0) return;
  const actor = await fromUuid(mc.caster);
  if (!actor?.isOwner) return ui.notifications.warn("Only the caster can do that.");
  if (inActiveCombat(actor) && mc.key === "ap" && game.combat.combatant?.actor?.uuid !== actor.uuid) return ui.notifications.warn("Multicast with AP is for your own turn.");
  const atk = game.messages.get(mc.attackMessage)?.getFlag("flowstate", "attack");
  if (!atk) return ui.notifications.warn("The original cast can no longer be found.");
  if (!(await spendPoints(actor, mc.key, mc.cost, "Multicast"))) return;
  const targets = (await Promise.all(mc.targets.map(u => fromUuid(u)))).filter(Boolean);
  const o = atk.opts;
  const spell = { ...o.spell, exploit: null, telegraph: null, ritualOf: null };
  await performAttack(actor, { ...o, targetActors: targets, notes: ["Multicast: free recast"], spell, followups: [] });
  if (mc.dup) {                                                                  // Duplicate works multiplicatively with Multicast
    const picked = await pickDuplicateTarget(actor, targets, null);
    if (picked?.length) await performAttack(actor, { ...o, targetActors: picked, area: false, notes: ["Multicast + Duplicate"], spell, followups: [] });
  }
  await message.setFlag("flowstate", "multicast", { ...mc, remaining: mc.remaining - 1 });
}

/** Who gets the free second cast of a Duplicate? The same target by default, or anyone else on the scene. */
async function pickDuplicateTarget(actor, current, preset) {
  const others = (globalThis.canvas?.tokens?.placeables ?? []).map(t => t.actor).filter(a => a && a.type !== "pile" && !current.some(c => c.uuid === a.uuid));
  if (preset) { const a = [...current, ...others].find(x => x.uuid === preset); return a ? [a] : current; }
  if (!others.length) return current.slice(0, 1);
  const choices = [...current.slice(0, 1), ...others];
  const out = await DialogV2().prompt({
    window: { title: "Duplicate: second target" },
    content: `<div class="fs-field"><label>Cast again at</label><select name="t">${choices.map(a => `<option value="${a.uuid}">${esc(a.name)}</option>`).join("")}</select></div>`,
    ok: { label: "Cast", callback: (event, button) => valuesFromForm(button.form) }, rejectClose: false
  });
  const a = choices.find(x => x.uuid === out?.t);
  return a ? [a] : current.slice(0, 1);
}

/* Weaving (Magic Theory T3): the attack dialog offers a free spell alongside a non-Magical attack of the same AP cost. */
export async function weaveSpell(actor, { ap, melee, targetActors }) {
  return castSpell(actor, null, { weave: { ap, melee: !!melee, targetActors } });
}
setWeaveHook({
  eligible: actor => tierOf(actor.system.trees ?? {}, "magic-theory") >= 3 && castSummary(actor).any,
  run: weaveSpell
});

/** Chat card for a placed Emplace barrier. */
async function emplaceCard(actor, { health, shapeLabel, templateId, sceneId, walls }) {
  return post(actor, { title: `${esc(actor.name)} — Emplace`, body: `<div class="fs-result"><i class="fa-solid fa-shield"></i> A one-way barrier (${esc(shapeLabel)}) with <strong>${health} health</strong> is in place.${templateId ? " Its template is on the scene." : ""}</div>
    <div class="fs-notes">It's an object: it blocks attacks coming from the far side of it from you (anything on your side passes), absorbing up to its Limit (equal to its health) of each attack and its remaining health, before parries, Shields or armor. Pierce, Bash, Cleave and Weakpoint work on it. It blocks movement through it too, from the same side. It lasts until the start of your next turn.</div>
    ${walls ? `<div class="fs-brawl-row" data-role="attacker" data-owner="${actor.uuid}"><button type="button" class="fs-flip-wall" data-scene="${sceneId}" data-template="${templateId}" data-tooltip="If the wall's arrow points the wrong way, flip which side it blocks"><i class="fa-solid fa-arrows-left-right"></i> Flip facing</button></div>` : ""}` });
}

/** A held spell stays on the caster (until their next turn) so it can be used again for AP only. */
async function areasHeld(actor, plan, profile, ids, mods, ritualOf = null) {
  await applySpellEffect(actor, { kind: "held", caster: actor.uuid, name: `Held ${profile.name}`, cores: ids, power: plan.power, scaling: plan.scaling, mods, ap: plan.ap, ritualOf,
    description: `${profile.name} is held in your hand: use it again from the Action List for ${plan.ap} AP (no Energy) until the start of your next turn.` });
}

/** Use a held Flame/Frost/Crackle/Glob again: AP only, in melee, no damage. */
export async function useHeldSpell(actor, effectId) {
  const e = Array.from(actor.effects ?? []).find(x => x.id === effectId);
  const h = e?.flags?.flowstate?.spellEffect;
  if (!h || h.kind !== "held") return;
  if (helpless(actor)) return ui.notifications.warn(`${actor.name} can't act.`);
  const inCombat = inActiveCombat(actor);
  if (inCombat && game.combat.combatant?.actor?.uuid !== actor.uuid) return ui.notifications.warn("A held spell can only be used on your own turn.");
  const targets = [...(game.user?.targets ?? [])].filter(t => t.actor && t.actor.type !== "pile");
  if (!targets.length) return ui.notifications.warn("Target someone in melee range first.");
  if (!inMeleeRange(actor, targets[0].actor)) return ui.notifications.warn("A held spell is used in melee: the target has to be within your personal melee range.");
  if (!(await spendPoints(actor, "ap", h.ap, "using a held spell"))) return;
  const profile = fx.profileFor(h.cores);
  const dice = fx.damageDice(profile, h.power);
  const holdRoll = (await new Roll(`${dice.n}d${dice.sides}`).evaluate()).total;
  return performAttack(actor, {
    label: `${profile.name} (held)`, net: 0, stealth: "none", melee: true, area: false, push: false, damage: "", type: profile.damage?.type ?? "physical", stacks: 0, physical: false, shots: 1, critStacks: 0,
    pierce: 0, bash: 0, knockback: 0, notes: [`Held: no damage, ${holdRoll} worth of effect`], followups: [], targetActors: [targets[0].actor],
    spell: { cores: h.cores, power: h.power, ritualOf: null, scaling: h.scaling, mods: h.mods ?? {}, replaced: {}, dampen: [], singleRoll: false, telegraph: null, exploit: null, hold: true, holdRoll }
  });
}


/* -------------------------------------------- */
/*  Grasp Arcana actions                        */
/* -------------------------------------------- */

/** Spirit Sense (Grasp Arcana T2): a spot check for magical energy. Secondary senses it within 10 ft; Primary (Grasp Arcana T4) within 100 ft. */
export async function spiritSense(actor) {
  const tier = tierOf(actor.system.trees ?? {}, "magic-grasp-arcana");
  const primary = tier >= 4;
  const range = primary ? 100 : 10;
  await rollD100(actor, "Spirit Sense");
  await post(actor, { title: `${esc(actor.name)} — Spirit Sense`, body: `<div class="fs-notes">${primary ? "Primary" : "Secondary"} Spirit Sense: on a success you sense the direction and amount of magical energy within <strong>${range} ft</strong> (for creatures, their total Spirit), regardless of obstacles, but not their exact location.${primary ? " You auto succeed on targets within melee range and are immune to a Targeted attack roll's stealth bonus." : ""} The GM decides the check's difficulty. (Heightened Spirit Sense, if you have it: 1000 ft and exact compositions.)</div>` });
}

/** Foci Master (Grasp Arcana T4) / Shroud Master (Build Arcana T4): swap your attuned Foci / Shroud for another on your person for 2 AP (no hour of attuning). */
async function swapAttuned(actor, type) {
  const tree = type === "foci" ? "magic-grasp-arcana" : "magic-build-arcana", label = type === "foci" ? "Foci Master" : "Shroud Master";
  if (tierOf(actor.system.trees ?? {}, tree) < 4) return;
  if (helpless(actor)) return ui.notifications.warn(`${actor.name} can't act.`);
  const others = actor.items.filter(i => i.type === type && !i.system.attuned);
  if (!others.length) return ui.notifications.info(`${actor.name} has no other ${type === "foci" ? "Foci" : "Shroud"} to swap to.`);
  const out = await DialogV2().prompt({
    window: { title: `${label}: swap` },
    content: `<div class="fs-field"><label>Attune to</label><select name="f">${others.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join("")}</select></div>`,
    ok: { label: "Swap (2 AP)", callback: (event, button) => button.form.elements.f.value }, rejectClose: false
  });
  const next = out ? actor.items.get(out) : null;
  if (!next) return;
  if (!(await spendPoints(actor, "ap", 2, label))) return;
  await next.update({ "system.attuned": true }, { flowstateFociMaster: true });
  await post(actor, { title: `${esc(actor.name)} — ${label}`, body: `<div class="fs-result">${esc(actor.name)} swaps their attuned ${type === "foci" ? "Foci" : "Shroud"} to <strong>${esc(next.name)}</strong> (2 AP).</div>` });
}
export const swapFoci = actor => swapAttuned(actor, "foci");
export const swapShroud = actor => swapAttuned(actor, "shroud");


/** Trigger a Delayed spell (Restoration Arcana T4): it resolves now, with no further cost. */
export async function fireDelayed(actor, effectId) {
  const e = Array.from(actor.effects ?? []).find(x => x.id === effectId);
  const d = e?.flags?.flowstate?.spellEffect;
  if (!d || d.kind !== "delayed") return;
  const targets = (await Promise.all((d.targets ?? []).map(u => fromUuid(u)))).filter(Boolean);
  await e.delete();
  return castSpell(actor, d.values, { fire: { targets } });
}
