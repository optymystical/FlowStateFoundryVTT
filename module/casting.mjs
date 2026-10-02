/**
 * Casting (Magic Theory): the Cast Spell dialog, paying AP/RP and Energy, and the cast card.
 * The math lives in spells.mjs; this file talks to Foundry. Spell effects are resolved per spell as they are automated;
 * until then the card states the effect for the GM to resolve.
 */
import * as spells from "./spells.mjs";
import { post, inActiveCombat, helpless, spendPoints, spendEnergy } from "./actions.mjs";
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
export function castContext(actor) {
  const eff = actor.system.derived?.effective ?? {};
  const foci = actor.items.filter(i => i.type === "foci" && i.system.equipped).map(i => ({
    id: i.id, name: i.name, profile: i.system.profile, attuned: !!i.system.attuned, broken: !!i.system.broken, twoHanded: !!i.system.twoHanded
  }));
  const ring = {};
  for (const i of actor.items) if (i.type === "foci" && i.system.fociType === "ring" && i.system.chosenSpell) ring[i.id] = i.system.chosenSpell;
  const options = spells.castingOptions({ reach: eff.reach?.value ?? 0, grasp: eff.grasp?.value ?? 0, freeHand: freeHand(actor), foci });
  return { trees: actor.system.trees ?? {}, skillPoints: actor.system.skillPoints ?? 0, options, focused: actor.system.focusedSpell || "", ring, extraTR: 0 };
}

/** Can this actor cast at all? (Knows a Core Spell and meets some casting requirement.) */
export function castSummary(actor) {
  const ctx = castContext(actor);
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
  return `<label class="fs-cast-mod" data-tooltip="${esc(m.text)}">${control} <strong>${esc(m.name)}</strong> <small>${thr} Threshold${m.replacement ? " · Replacement" : ""}${m.stackable ? " · Stackable" : ""}</small> ${extra}</label>`;
}

/** The Universal / Core 1 / Core 2 Mod tabs for the chosen Cores. */
function modsHTML(ctx, v, theory) {
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

function previewHTML(plan, ctx) {
  if (!plan.ok) return `<p class="fs-warn">${plan.errors.map(esc).join(" ")}</p>`;
  const parts = [`${plan.base}${plan.combo ? " (Combo)" : ""}`, ...plan.applied.filter(a => a.threshold).map(a => `${a.mod.name} ${a.threshold}`)].join(" + ");
  const tr = plan.trParts.map(p => `${p.label} ${p.value}`).join(", ") || "none";
  return `<div class="fs-cast-sum">
    <div><strong>Threshold ${plan.threshold}</strong> <small>(${parts}${plan.tr ? ` − TR ${plan.tr}: ${tr}` : ""})</small></div>
    <div><strong>${plan.ritual ? `Ritual: ${plan.ritualHours} h, −${plan.ritualLoss} max Energy` : `${plan.energy} Energy`}</strong>${plan.ritual ? "" : ` · ${plan.ap} ${plan.usesRP ? "RP" : "AP"}`}
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
    <div class="fs-cast-mods">${modsHTML(ctx, v, theory)}</div>
    ${theory >= 2 ? `<label class="fs-cast-mod"><input type="checkbox" name="ritual" ${v.ritual ? "checked" : ""}> <strong>Ritual</strong> <small>takes hours instead of AP, and lowers your max Energy while it lasts (out of combat)</small></label>` : ""}
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
      form.addEventListener("change", e => refresh(["core1", "core2"].includes(e.target?.name), e.target?.name));
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

const stripHeader = text => String(text).replace(/^(?:X\+1|\d+(?:-\d+)?) Threshold, [^.]*\.\s*/, "");

/** Cast card: the cost breakdown and the effect text for the GM to resolve (until the spell is automated). */
export function castCardHTML(actor, plan) {
  const names = plan.cores.map(c => c.name).join(" + ");
  const via = esc(plan.option.label);
  const parts = [`${plan.base}`, ...plan.applied.filter(a => a.threshold).map(a => `${esc(a.mod.name)} ${a.threshold}`)].join(" + ");
  const effects = plan.cores.map(c => `<li><strong>${esc(c.name)}:</strong> ${esc(stripHeader(c.text))}</li>`).join("");
  const mods = plan.applied.map(a => `<li><strong>${esc(a.mod.name)}${a.free ? " (Connection)" : ""}${a.replicates ? ` (copies ${esc(spells.spellById(a.replicates)?.name ?? "")})` : ""}:</strong> ${esc(stripHeader(a.mod.text))}</li>`).join("");
  return `<div class="fs-result"><strong>${esc(actor.name)}</strong> casts <strong>${esc(names)}</strong>${plan.combo ? " (Combo Spell)" : ""}${plan.ritual ? " as a <em>Ritual</em>" : ""}.</div>
    <ul class="fs-list">
      <li>Through ${via}${plan.ritual ? "" : ` · ${plan.ap} ${plan.usesRP ? "RP" : "AP"}`}</li>
      <li>Threshold <strong>${plan.threshold}</strong> (${parts}${plan.tr ? ` − TR ${plan.tr}` : ""})${plan.ritual ? ` · ${plan.ritualHours} hour${plan.ritualHours === 1 ? "" : "s"}, max Energy −${plan.ritualLoss}` : ` · <strong>${plan.energy} Energy</strong>`}</li>
      <li>Spell Power ×${plan.power} (${STATS[plan.scalingStat]?.label ?? plan.scalingStat} ${plan.scaling}) · ${esc(plan.attack ?? "")}</li>
    </ul>
    <ul class="fs-list">${effects}${mods}</ul>
    <p class="hint">Spell effects aren't automated yet: scale the effect by Spell Power ×${plan.power} and resolve it at the table (attack roll, damage, and effects).</p>`;
}

/** Cast a spell: dialog → check → spend → post. Returns the plan, or null if nothing was cast. */
export async function castSpell(actor, preset = null) {
  if (helpless(actor)) { ui.notifications.warn(`${actor.name} is ${actor.statuses.has("dead") ? "dead" : "unconscious"} and can't cast.`); return null; }
  const { ctx, known } = castSummary(actor);
  if (!known.cores.length) { ui.notifications.warn(`${actor.name} doesn't know any Core Spells yet (unlock a Magic school).`); return null; }
  if (!ctx.options.some(o => o.ok)) { ui.notifications.warn(`${actor.name} can't cast right now: ${ctx.options.map(o => `${o.label}: ${o.reason}`).join(" · ")}`); return null; }
  const values = preset ?? await castDialog(actor, ctx);
  if (!values) return null;
  const plan = spells.planCast(ctx, values);
  if (!plan.ok) { ui.notifications.warn(plan.errors.join(" ")); return null; }

  const inCombat = inActiveCombat(actor);
  if (plan.ritual && inCombat) { ui.notifications.warn("Rituals take hours and can't be cast in combat."); return null; }
  if (inCombat && !plan.usesRP && game.combat.combatant?.actor?.uuid !== actor.uuid) {
    ui.notifications.warn("You can only cast with AP on your own turn (the React Mod casts with RP instead).");
    return null;
  }
  // Check everything before spending anything.
  const key = plan.usesRP ? "rp" : "ap";
  if (inCombat && plan.ap && actor.system[key].value < plan.ap) { ui.notifications.warn(`${actor.name} needs ${plan.ap} ${key.toUpperCase()} to cast this but has ${actor.system[key].value}.`); return null; }
  if (inCombat && plan.energy && actor.system.energy.value < plan.energy) { ui.notifications.warn(`${actor.name} needs ${plan.energy} Energy to cast this but has ${actor.system.energy.value}.`); return null; }
  if (!(await spendPoints(actor, key, plan.ap, "casting"))) return null;
  if (!(await spendEnergy(actor, plan.energy, "casting"))) return null;

  if (plan.ritual) await actor.createEmbeddedDocuments?.("ActiveEffect", [{
    name: `Ritual: ${plan.cores.map(c => c.name).join(" + ")}`, img: "icons/magic/symbols/runes-star-orange.webp", origin: actor.uuid,
    description: `Max Energy −${plan.ritualLoss} while the ritual lasts. Ending this effect ends the ritual's spell effects.`,
    flags: { flowstate: { ritual: { cores: plan.cores.map(c => c.id), mods: plan.applied.map(a => a.mod.id), energyLost: plan.ritualLoss, power: plan.power } } }
  }]);

  await post(actor, {
    title: `${esc(actor.name)} casts ${esc(plan.cores.map(c => c.name).join(" + "))}`,
    body: castCardHTML(actor, plan),
    flags: { flowstate: { spell: { caster: actor.uuid, cores: plan.cores.map(c => c.id), mods: plan.applied.map(a => a.mod.id), power: plan.power, threshold: plan.threshold, energy: plan.energy, ritual: plan.ritual, attack: plan.attack } } }
  });
  return plan;
}
