import {
  STATS, DAMAGE_TYPES, poolFormula, applyStacks, stackMultiplier, resolveAttack, resolveFullStealth,
  objectCrit, resolveForce, pushForce, forceDamage, statMin, addStacks, tickAmounts, igniteTotal, stainTotal, STAIN_VARIANTS
} from "./rules.mjs";
import { THROW, WEAPON_TYPES, WEAPON_MATERIALS, soak, weaponProfile, effectiveLimit, DAMAGE_CATEGORY } from "./martial.mjs";
import { AFFIXES, shroudBlocks } from "./magic.mjs";
import * as skills from "./skills.mjs";
import * as ab from "./abilities.mjs";
import * as fx from "./spellfx.mjs";
import * as areas from "./areas.mjs";

const esc = s => foundry.utils.escapeHTML?.(String(s)) ?? String(s);
/** Synchronous uuid lookup (Foundry's fromUuidSync), null outside Foundry. */
const syncUuid = u => globalThis.fromUuidSync?.(u) ?? null;
const DialogV2 = () => foundry.applications.api.DialogV2;
const PHYSICAL_STATS = new Set(["str", "dex", "con"]);

/* -------------------------------------------- */
/*  Helpers                                     */
/* -------------------------------------------- */

/** Is this actor a combatant in a started combat? */
export function inActiveCombat(actor) {
  const combat = globalThis.game?.combat;
  if (!combat?.started) return false;
  return combat.combatants.some(c => c.actor?.uuid === actor.uuid);
}

/** Spend AP or RP only when in an active combat. Returns false if the actor can't afford it. */
export async function spendPoints(actor, key, cost, what = "that") {
  if (!cost || !inActiveCombat(actor)) return true;
  const have = actor.system[key].value;
  if (have < cost) {
    ui.notifications.warn(`${actor.name} needs ${cost} ${key.toUpperCase()} for ${what} but has ${have}.`);
    return false;
  }
  await actor.update({ [`system.${key}.value`]: have - cost });
  return true;
}
export const spendAP = (actor, cost, what) => spendPoints(actor, "ap", cost, what);
/** Could this actor pay `cost` AP or RP (`key`) right now? Always, outside combat. Used to leave out buttons nobody could press. */
export const canSpend = (actor, key, cost) => !cost || !inActiveCombat(actor) || (actor?.system?.[key]?.value ?? 0) >= cost;

/** Is this item an improvised weapon? */
export const isImprovised = item => item?.type === "weapon" && item.system?.weaponType === "improvised";

/**
 * Martial Theory T4 (Improvise): improvised weapons become normal ones, so remove any the actor carries.
 * Returns the names removed.
 */
export async function removeImprovised(actor) {
  const items = actor.items.filter(isImprovised);
  if (!items.length || theoryTier(actor) < 4) return [];
  await actor.deleteEmbeddedDocuments("Item", items.map(i => i.id), { flowstateSystem: true });
  const names = items.map(i => i.name);
  await post(actor, { title: "Improvise", body: `<div class="fs-result">${esc(actor.name)} reached Martial Theory Tier 4. Improvised weapons now count as normal weapons, so these were removed:</div>
    <ul class="fs-list">${names.map(n => `<li>${esc(n)}</li>`).join("")}</ul><p class="hint">The GM can forge replacements as their closest real weapon type.</p>` });
  return names;
}

/** Unconscious or dead characters can't act, and attacks against them land as if from full stealth. */
export const helpless = actor => !!(actor?.statuses?.has("unconscious") || actor?.statuses?.has("dead"));
/** Warn and return true if the actor can't act right now. */
function cantAct(actor, what = "act") {
  if (!helpless(actor)) return false;
  ui.notifications.warn(`${actor.name} is ${actor.statuses.has("dead") ? "dead" : "unconscious"} and can't ${what}.`);
  return true;
}

/** "combat:round:turn" for the current turn (null outside a started combat). */
export const turnKey = () => (game.combat?.started ? `${game.combat.id}:${game.combat.round}:${game.combat.turn}` : null);

/** Current tier of an Archetype's Theory tree. */
export const theoryTier = (actor, archetype = "martial") => Number(actor?.system?.trees?.[`${archetype}-theory`]) || 0;

/** Martial Theory stances: Psych Up (T2) and Calm Down (T3), active until the start of your next turn. */
const psyched = actor => !!actor?.statuses?.has("psychedUp");
const calmed = actor => !!actor?.statuses?.has("calmedDown");
/** Net Advantage on this actor's own attack rolls from stances. */
const attackStanceNet = actor => (psyched(actor) ? 1 : 0) - (calmed(actor) ? 1 : 0);

/**
 * Spirit Sense, Primary (Grasp Arcana T4): immune to the stealth bonus of Targeted attack rolls. That bonus only comes from Targeted
 * spells (any Magic attack with half stealth), so a weapon attack from half stealth still counts against them.
 */
const spellStealthImmune = (opts, target) => opts?.stealth === "half" && !!(opts.spell || opts.magicStealth) && ab.treeTier(target, "magic-grasp-arcana") >= 4;

/** Where an attack roll's Advantage/Disadvantage came from, as "Psych Up +1, target Psych Up +1" style parts. */
function attackNetParts(actor, opts, target = null) {
  const parts = [];
  const add = (label, v) => { if (v) parts.push(`${label} ${v > 0 ? "+" : "−"}${Math.abs(v)}`); };
  add("attack options", opts.net ?? 0);
  add("exhausted", exhaustionNet(actor));
  add("half stealth", opts.stealth === "half" && !(target && spellStealthImmune(opts, target)) ? 1 : 0);
  add("Psych Up", psyched(actor) ? 1 : 0);
  add("Calm Down", calmed(actor) ? -1 : 0);
  add("Limber", limberNet(actor));
  if (target) {
    if (spellStealthImmune(opts, target)) parts.push(`${target.name}'s Spirit Sense: immune to the Targeted stealth bonus`);
    add(`${target.name} prone`, opts.melee && target.statuses?.has("prone") ? 1 : 0);
    add(`${target.name} Psyched Up`, psyched(target) ? 1 : 0);
    add(`${target.name}'s Shroud`, shroudAttackNet(actor, target, opts));
    add(`${target.name}'s Dash (Speedy)`, autoDash(target, opts) ? -1 : 0);
  }
  return parts;
}
const netNote = (net, parts) => (net || parts.length ? `<div class="fs-notes">${net ? netLabel(net) : "No net Advantage"}${parts.length ? ` (${parts.join(", ")})` : ""}</div>` : "");

/** A weapon's normal attack AP (for RP costs like Riposte and Blade Flurry). */
const p0Ap = (item, unarmed) => (unarmed ? 2 : item.system.profile?.ap ?? 2);

/** Limber (Medium Armor T1): the next attack/dodge/parry roll has Advantage, then it's used up. */
const limberNet = actor => (actor?.statuses?.has("limber") ? 1 : 0);
async function consumeLimber(actor) { if (actor?.statuses?.has("limber")) await setStatus(actor, "limber", false); }
/** Lead Blindness (Rapid T4): reactions to a Rapid attack have Disadvantage. */
const leadBlindNet = o => (o?.leadBlind ? -1 : 0);

/** Seeing Red (Striker T4): Disadvantage on all non-attack rolls. */
const seeingRedNet = actor => (actor?.statuses?.has("seeingRed") ? -1 : 0);
/** Unfettered (Unarmored T5): Advantage on dodge rolls with no armor on. */
const unfetteredNet = actor => (ab.unarmoredT(actor, 5) ? 1 : 0);

/** Disrupt (Grappling T2): the grappled creature's next roll has Disadvantage (every roll while Locked Down with Stunlock, T4). */
const disruptNet = actor => (actor?.getFlag?.("flowstate", "disrupted") ? -1 : 0);
async function consumeDisrupt(actor) {
  const d = actor?.getFlag?.("flowstate", "disrupted");
  if (d && !d.auto) await setActorFlag(actor, "disrupted", null);
}

/** Momentum (Curved T3) this attacker has built on a target: { adv, str }. */
export const momentumOf = (target, attacker) => target?.getFlag?.("flowstate", `momentum.${attacker.id}`) ?? { adv: 0, str: 0 };

/** Does this creature suffer any movement penalty (In a Barrel, Longshot T4)? */
export function movementPenalized(actor) {
  const st = actor?.statuses ?? new Set();
  return st.has("prone") || st.has("crouch") || st.has("grappled") || st.has("fishy") || !!actor?.getFlag?.("flowstate", "lockedDown")
    || (actor?.system?.conditions?.slow ?? 0) > 0 || (actor?.system?.movement?.ap ?? 1) > 1;
}

/** Exhaustion (Ch7 Rest) adds a Disadvantage stack. */
export const exhaustionNet = actor => (actor.system.exhausted ? -1 : 0);

function netLabel(net) {
  if (net > 0) return `${net}× Advantage`;
  if (net < 0) return `${-net}× Disadvantage`;
  return "";
}
const signed = n => `${n > 0 ? "+" : ""}${n}`;

/** "Strengthened ×2 (×2)" style label for a net stack count. */
function stackLabel(net) {
  if (!net) return "no Strengthened/Weakened";
  const mult = Math.round(stackMultiplier(net) * 1000) / 1000;
  return `${net > 0 ? `Strengthened ×${net}` : `Weakened ×${-net}`} (×${mult})`;
}

/** Damage line showing base → final so the Strengthened/Weakened math is visible. */
export function damageLine(totals, net, type, shots) {
  const base = totals.reduce((a, b) => a + b, 0);
  const final = totals.reduce((sum, v) => sum + applyStacks(v, net), 0);
  return { final, html: `<div class="fs-result">Damage: ${net ? `${base} → <strong>${final}</strong>` : `<strong>${final}</strong>`} ${DAMAGE_TYPES[type]}${shots > 1 ? ` (${shots} shots)` : ""}</div>
    <div class="fs-notes">${stackLabel(net)}</div>` };
}

export async function post(actor, { title, body, rolls = [], flags = {} }) {
  const content = `<div class="flowstate-card"><header class="fs-card-title">${title}</header>${body}</div>`;
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content, rolls, flags });
}

async function evaluate(formula) {
  return new Roll(formula).evaluate();
}

/** Notes from Order/Chaos charges spent on a roll, as card HTML. */
const chargeNotesHTML = cr => (cr?.notes ?? []).map(n => `<div class="fs-notes fs-charge-note"><i class="fa-solid fa-link"></i> ${n}</div>`).join("");

async function rollBlock(roll, label) {
  return `<div class="fs-roll"><span class="fs-roll-label">${label}</span>${await roll.render()}</div>`;
}

/** Simple option dialog. Returns an object of the form values, or null if closed. */
async function optionsDialog(title, fieldsHTML, okLabel = "Roll", { skipIfEmpty = false } = {}) {
  // Nothing to choose (e.g. the Advantage field is turned off): roll straight away.
  if (skipIfEmpty && !/\bname="/.test(fieldsHTML)) return { net: 0, stacks: 0, extra: 0 };
  return DialogV2().prompt({
    window: { title },
    content: `<div class="flowstate-dialog">${fieldsHTML}</div>`,
    render: (event, dlg) => syncWeightOptions(dlg?.element ?? dlg),
    ok: {
      label: okLabel,
      icon: "fa-solid fa-dice",
      callback: (event, button) => {
        const out = { net: 0, stacks: 0, extra: 0 };
        for (const el of button.form.elements) {
          if (!el.name || el.disabled) continue;
          if (el.type === "checkbox") out[el.name] = el.checked;
          else if (el.type === "number") out[el.name] = Number(el.value) || 0;
          else out[el.name] = el.value;
        }
        return out;
      }
    },
    rejectClose: false
  });
}

/**
 * Unarmed attacks pick Light or Heavy in the dialog: options wrapped in [data-fs-weight] only show (and only
 * count) for the matching weight.
 */
function syncWeightOptions(root) {
  const el = root instanceof HTMLElement ? root : root?.[0];
  const select = el?.querySelector?.('select[name="weight"]');
  if (!select) return;
  const apply = () => {
    for (const wrap of el.querySelectorAll("[data-fs-weight]")) {
      const on = wrap.dataset.fsWeight === select.value;
      wrap.hidden = !on;
      for (const input of wrap.querySelectorAll("input, select")) input.disabled = !on;
    }
  };
  select.addEventListener("change", apply);
  apply();
}

/** World setting: show the manual Advantage/Disadvantage stacks field in roll dialogs (default off). */
function customNetOn() {
  try { return game.settings.get("flowstate", "customAdvantage") === true; } catch (err) { return false; }
}
/** World setting: show manual extra Strengthened/Weakened fields in attack and damage dialogs (default off). */
function customStacksOn() {
  try { return game.settings.get("flowstate", "customStacks") === true; } catch (err) { return false; }
}
const stacksField = (name, label = "Extra Strengthened (+) / Weakened (−)") => (customStacksOn()
  ? `<div class="form-group"><label>${label}</label><input type="number" name="${name}" value="0" step="1"></div>` : "");
const netField = () => (customNetOn() ? `<div class="form-group"><label>Advantage (+) / Disadvantage (−) stacks</label>
  <input type="number" name="net" value="0" step="1"></div>` : "");

/* -------------------------------------------- */
/*  Checks                                      */
/* -------------------------------------------- */

/** Ch7 Stat Check: d(2 × stat); Stat Minimum floor out of combat unless in a time crunch. */
export async function rollStatCheck(actor, key) {
  const stat = actor.system.derived.effective[key];
  const minDefault = !inActiveCombat(actor);
  const opts = await optionsDialog(`${STATS[key].label} Check`, `${netField()}
    <div class="form-group"><label>Apply Stat Minimum (${stat.min})</label>
    <input type="checkbox" name="applyMin" ${minDefault ? "checked" : ""}></div>
    <p class="hint">Off in combat or a time crunch.</p>`);
  if (!opts) return;

  const armorDis = PHYSICAL_STATS.has(key) ? actor.system.penalties.physicalDis : 0;
  const net = opts.net + exhaustionNet(actor) - armorDis + seeingRedNet(actor) + disruptNet(actor) + charmNet(actor, "stat") + (["reach", "grasp", "build"].includes(key) ? magicDisNet(actor) : 0);
  await consumeDisrupt(actor);
  const roll = await evaluate(poolFormula(1, stat.die, net));
  const cr = await mentalHook?.rollCharges?.({ actor, type: "other", roll, die: stat.die, count: 1, net, max: stat.die, label: `${STATS[key].label} Check` });
  const floored = opts.applyMin && roll.total < stat.min;
  const result = floored ? stat.min : roll.total;
  const notes = [netLabel(net), armorDis ? "armor penalty" : "", floored ? `raised to Stat Minimum` : ""].filter(Boolean).join(" · ");

  await post(actor, {
    title: `${STATS[key].label} Check (d${stat.die})`,
    rolls: [roll, ...(cr?.rolls ?? [])],
    body: `${await rollBlock(roll, "Roll")}${chargeNotesHTML(cr)}
      <div class="fs-result">Result: <strong>${result}</strong></div>
      ${notes ? `<div class="fs-notes">${notes}</div>` : ""}`
  });
  await hexRoll(actor, "stat");
}

/** Ch7 Non Stat Checks: d100 (Stealth, Perception, Persuasion, Deception, counter rolls). */
export async function rollD100(actor, label, { apCost = 0 } = {}) {
  const stealthDis = label === "Stealth" ? actor.system.penalties.stealthDis : 0;
  if (stealthDis === Infinity) {
    return post(actor, { title: "Stealth (d100)", body: `<div class="fs-outcome fs-miss">Automatically fails</div><div class="fs-notes">Titanic armor</div>` });
  }
  const opts = await optionsDialog(`${label} (d100)`, netField(), "Roll", { skipIfEmpty: true });
  if (!opts) return;
  if (!(await spendAP(actor, apCost, label))) return;
  // Persuasion/Deception against one targeted creature: Fast Lips (Dexterity T1) and Intimidate (Strength T1).
  let socialNet = 0;
  const social = [];
  if (label === "Persuasion" || label === "Deception") {
    const tgt = [...(game.user.targets ?? [])].map(t => t.actor).filter(a => a && a.type !== "pile" && a.uuid !== actor.uuid);
    if (tgt.length === 1) {
      const t = tgt[0];
      if (ab.dexterity(actor, 1) && ab.beatsScaled(ab.statValue(actor, "dex"), ab.statValue(t, "dex"), actor.system.size, t.system.size, { larger: "self" })) {
        socialNet += 1; social.push(`Fast Lips: Advantage (more Dexterity than ${t.name})`);
      }
      if (ab.strength(actor, 1) && ab.beatsScaled(ab.statValue(actor, "str"), ab.statValue(t, "str"), actor.system.size, t.system.size, { larger: "target" })) {
        social.push(`Intimidate: ${t.name}'s counter roll has Disadvantage`);
      }
    }
  }
  const net = opts.net + exhaustionNet(actor) - stealthDis + seeingRedNet(actor) + socialNet + disruptNet(actor) + charmNet(actor, "noncombat");
  await consumeDisrupt(actor);
  const roll = await evaluate(poolFormula(1, 100, net));
  const cr = await mentalHook?.rollCharges?.({ actor, type: "other", roll, die: 100, count: 1, net, max: 100, label });
  const notes = [netLabel(net), stealthDis ? "armor penalty" : "", seeingRedNet(actor) ? "Seeing Red" : "", ...social].filter(Boolean).join(" · ");
  await post(actor, {
    title: `${label} (d100)`,
    rolls: [roll, ...(cr?.rolls ?? [])],
    body: `${await rollBlock(roll, "Roll")}${chargeNotesHTML(cr)}${notes ? `<div class="fs-notes">${notes}</div>` : ""}`
  });
  await hexRoll(actor, "noncombat");
}

/** Ch8 Attack roll as a plain check: d(SP), no AP, no target resolution. */
export async function rollAttackCheck(actor) {
  const opts = await optionsDialog("Attack Roll", netField(), "Roll", { skipIfEmpty: true });
  if (!opts) return;
  const net = opts.net + exhaustionNet(actor) - actor.system.penalties.physicalDis + attackStanceNet(actor) + limberNet(actor) + charmNet(actor, "attack");
  await consumeLimber(actor);
  const size = actor.system.derived.attackDie;
  const roll = await evaluate(poolFormula(1, size, net));
  const cr = await mentalHook?.rollCharges?.({ actor, type: "attack", roll, die: size, count: 1, net, max: size, label: "Attack Roll" });
  await post(actor, {
    title: `Attack Roll (d${size})`,
    rolls: [roll, ...(cr?.rolls ?? [])],
    body: `${await rollBlock(roll, "Attack")}${chargeNotesHTML(cr)}${net ? `<div class="fs-notes">${netLabel(net)}</div>` : ""}`
  });
  await hexRoll(actor, "attack");
}

/** Ch8 Dodge: 2d(SP/2); Advantage adds a die and keeps the best two. */
export async function rollDodge(actor) {
  const opts = await optionsDialog("Dodge", netField(), "Roll", { skipIfEmpty: true });
  if (!opts) return;
  const net = opts.net + exhaustionNet(actor) + (actor.statuses.has("prone") ? -1 : 0) - actor.system.penalties.physicalDis + (calmed(actor) ? 1 : 0) + limberNet(actor) + seeingRedNet(actor) + unfetteredNet(actor) + disruptNet(actor) + dodgeDisNet(actor) + charmNet(actor, "dodge");
  await consumeLimber(actor); await consumeDisrupt(actor);
  const size = actor.system.derived.dodgeDie;
  const roll = await evaluate(poolFormula(2, size, net));
  const cr = await mentalHook?.rollCharges?.({ actor, type: "dodge", roll, die: size, count: 2, net, max: 2 * size, label: "Dodge" });
  await post(actor, {
    title: `Dodge (2d${size})`,
    rolls: [roll, ...(cr?.rolls ?? [])],
    body: `${await rollBlock(roll, "Dodge")}${chargeNotesHTML(cr)}${net ? `<div class="fs-notes">${netLabel(net)}</div>` : ""}`
  });
  await hexRoll(actor, "dodge");
}

/* -------------------------------------------- */
/*  Range                                       */
/* -------------------------------------------- */

/** The attacker's token on the current scene: a controlled one if possible. */
export function attackerToken(actor) {
  const controlled = canvas?.tokens?.controlled?.find(t => t.actor?.uuid === actor.uuid);
  return controlled ?? actor.getActiveTokens?.()[0] ?? null;
}

/** Grid distance between the closest spaces two tokens occupy (so large creatures measure edge to edge). */
export function tokenDistance(a, b) {
  // Measured between token borders (two tokens that touch are 0 ft apart), square-grid style: the larger of the
  // horizontal and vertical gaps. Works for fractional (small) and multi-square (large) tokens alike.
  const grid = canvas.grid;
  const box = t => {
    const d = t.document ?? t;
    const gs = grid?.size ?? 100;
    const x = d.x ?? (t.center?.x ?? 0), y = d.y ?? (t.center?.y ?? 0);
    const w = (d.width ?? 0) * gs, h = (d.height ?? 0) * gs;
    return { x, y, w, h };
  };
  const A = box(a), B = box(b);
  const dx = Math.max(0, B.x - (A.x + A.w), A.x - (B.x + B.w));
  const dy = Math.max(0, B.y - (A.y + A.h), A.y - (B.y + B.h));
  const px = Math.max(dx, dy);
  return Math.round((px / (grid?.size ?? 100)) * (grid?.distance ?? 5) * 100) / 100;
}

/**
 * Every targeted token must be within `maxRange` ft of the attacker.
 * Returns true if the attack may proceed. Skipped when range enforcement is off or the attacker has no token.
 */
export function checkRange(actor, maxRange, what, tokens = null, from = null) {
  if (!game.settings.get("flowstate", "enforceRange")) return true;
  const targets = (tokens ?? [...game.user.targets]).filter(t => t.actor?.type !== "pile");
  const source = from ?? attackerToken(actor);
  if (!targets.length || !source || !canvas?.grid) return true;
  const out = targets
    .map(t => ({ name: t.name, dist: Math.round(tokenDistance(source, t) * 10) / 10 }))
    .filter(t => t.dist > maxRange);
  if (!out.length) return true;
  ui.notifications.warn(`Out of range for ${what} (${maxRange} ft): ${out.map(t => `${t.name} is ${t.dist} ft away`).join(", ")}.`);
  return false;
}

/* -------------------------------------------- */
/*  Attacks                                     */
/* -------------------------------------------- */

const damageTypeOptions = Object.entries(DAMAGE_TYPES)
  .map(([k, v]) => `<option value="${k}">${v}</option>`).join("");

/** Generic attack (no weapon): manual damage formula and type. */
export async function rollAttack(actor) {
  if (cantAct(actor, "attack")) return;
  const opts = await optionsDialog("Attack", `
    <div class="form-group"><label>Attack name</label><input type="text" name="label" value="Attack"></div>
    ${netField()}
    <div class="form-group"><label>Melee</label><input type="checkbox" name="melee"></div>
    <div class="form-group"><label>Push instead of damage</label><input type="checkbox" name="push"></div>
    <div class="form-group"><label>Damage formula</label><input type="text" name="damage" placeholder="e.g. 3d12+4"></div>
    <div class="form-group"><label>Damage type</label><select name="type">${damageTypeOptions}</select></div>
    ${stacksField("stacks", "Strengthened (+) / Weakened (−) stacks")}
    <div class="form-group"><label>AP cost</label><input type="number" name="ap" value="2" min="0" step="1"></div>
    <p class="hint">Target tokens first. Size and Arcane modifiers are applied automatically.</p>`);
  if (!opts) return;
  if (opts.melee && !checkRange(actor, actor.system.derived.size.melee, "a melee attack")) return;
  if (!(await spendAP(actor, opts.ap, "an attack"))) return;
  return performAttack(actor, { ...opts, physical: opts.type === "physical" || opts.push });
}

/**
 * Attack with a Martial weapon item. Dialog adapts to the weapon (range bands, throwing, Area, Pepper).
 * @param {object} [followup]  {net, label, weight} for free Fast/Solitary follow-up attacks (no AP, no further follow-ups).
 */
export async function rollWeaponAttack(actor, item, followup = null, { grapple: presetGrapple = false } = {}) {
  if (cantAct(actor, "attack")) return;
  const w = item.system;
  const unarmed = w.weaponType === "unarmed";
  if (!w.profile?.valid) return ui.notifications.warn(`${item.name}: ${w.profile?.error ?? "invalid weapon"}`);
  if (!w.held) return ui.notifications.warn(`${item.name} isn't held. Equip it in a hand first.`);
  if (w.broken) return ui.notifications.warn(`${item.name} is broken.`);
  // Multi-type weapons (Weapon Master, Martial Theory T5): pick which type this attack uses (its follow-ups keep it).
  const typeChoices = unarmed ? [] : ab.attackTypes(actor, item);
  let attackType = followup?.attackType && typeChoices.includes(followup.attackType) ? followup.attackType : typeChoices[0] ?? w.weaponType;
  if (typeChoices.length > 1 && !followup?.attackType) {
    const pick = await optionsDialog(`${item.name} — attack as`, `<div class="form-group"><label>Weapon type</label><select name="type">
      ${typeChoices.map(k => `<option value="${k}">${esc(WEAPON_TYPES[k]?.label ?? k)}${WEAPON_TYPES[k]?.ranged ? " (ranged)" : ""}</option>`).join("")}</select></div>`, "Next");
    if (!pick) return;
    attackType = typeChoices.includes(pick.type) ? pick.type : typeChoices[0];
  }
  let base = w.profileFor ? w.profileFor(attackType) : w.profile;
  if (!base?.valid) return ui.notifications.warn(`${item.name}: ${base?.error ?? "invalid weapon"}`);
  // A natural weapon can't be thrown unless it returns (Geomancy Combos).
  if (w.natural && !w.returning && base.throwType) base = { ...base, throwType: null };
  // A grapple needs a free hand to maintain: each Unarmed grapple occupies a fist.
  if (unarmed && ab.freeFists(actor) < 1) {
    return ui.notifications.warn(`${actor.name}'s free hand is holding ${ab.handGrapples(actor).map(a => a.name).join(", ")} in a grapple; let go to attack Unarmed.`);
  }
  // Impale (Reach T5) / Thrasher Grapple (T1): a weapon holding a grappled creature can't attack.
  const pinned = grappledBy(actor).find(v => v.getFlag?.("flowstate", "grappleWeapon") === item.uuid);
  if (pinned) return ui.notifications.warn(`${item.name} is holding ${pinned.name}; it can't attack until they're released.`);
  // Rapid T1 Quickload / T5 Speedloader: attacking while out of ammo can reload instead (or reload and fire).
  let speedloaded = false;
  if (base.ranged && !w.loaded) {
    if (followup || !(ab.rapid(actor, item, 1) || ab.assault(actor, item, 1))) return ui.notifications.warn(`${item.name} needs to be reloaded (${base.reloadRP} RP${ammoRequired() && !w.natural ? `; ${ammoCount(actor, w.ammoType)} ${ammoLabel(w.ammoType)} left` : ""}).`);
    if (!ammoCount(actor, w.ammoType) && ammoRequired() && !w.natural) return ui.notifications.warn(`${actor.name} has no ${ammoLabel(w.ammoType)} for ${item.name}.`);
    const r = await quickload(actor, item);
    if (r !== "speed") return;
    speedloaded = true;
  }

  // Unarmed: Light or Heavy is declared per attack.
  const eff = actor.system.derived.effective;
  const stats = { str: eff.str.value, dex: eff.dex.value };
  const unarmedProfile = weight => weaponProfile({ type: "unarmed", weight }, stats);
  const weightField = unarmed && !followup?.weight
    ? `<div class="form-group"><label>Unarmed attack</label><select name="weight">
        <option value="light" ${w.weight === "light" ? "selected" : ""}>Light — ${unarmedProfile("light").display}, 2 AP (Dex)</option>
        <option value="heavy" ${w.weight === "heavy" ? "selected" : ""}>Heavy — ${unarmedProfile("heavy").display}, 3 AP (Str)</option>
       </select></div>` : "";
  // Weight-specific options: hidden unless the matching Light/Heavy is picked (only when the dialog offers the choice).
  const byWeight = (weight, html) => weightField && html ? `<div data-fs-weight="${weight}">${html}</div>` : html;

  const modes = [];
  if (!base.ranged) modes.push(`<option value="strike">Strike (${actor.system.derived.size.melee * base.farstrike} ft)</option>`);
  if (!base.ranged && base.throwType) {
    const th = THROW[base.throwType];
    modes.push(`<option value="throw">Throw — ${th.label} (${th.range} ft${th.net ? `, ${netLabel(th.net)}` : ""})</option>`);
  }
  if (base.ranged) {
    modes.push(`<option value="r1">Normal range (${base.range} ft)</option>`,
      `<option value="r2">Up to 2× range (${base.range * 2} ft, Dis)</option>`,
      `<option value="r4">Up to 4× range (${base.range * 4} ft, 2× Dis, 6 AP)</option>`);
  }
  const pepperOpts = base.pepper
    ? `<div class="form-group"><label>Pepper bonus shots (each adds Dis)</label><select name="pepper">
        ${Array.from({ length: base.pepper + 1 }, (_, i) => `<option value="${i}">${i}</option>`).join("")}</select></div>` : "";
  const areaOpt = base.area
    ? `<div class="form-group"><label>Area attack (${base.area === 2 ? "10" : "5"} ft radius, Weakened)</label><input type="checkbox" name="area"></div>` : "";
  // Martial Theory T0 Grappling: Light = grapple instead of damage, Heavy = damage + grapple. Your size or smaller.
  // Follow-ups (Fast, Solitary, Riposte...) can grapple too, when a target is small enough to grab.
  const grabSize = actor.system.size + (ab.grappling(actor, 3) ? 1 : 0);
  const grabTargets = (followup?.targetActors ?? [...(game.user.targets ?? [])].map(t => t.actor)).filter(a => a && a.type !== "pile");
  const canGrab = !followup || (!followup.whirlwind && grabTargets.length > 0 && grabTargets.every(a => (a.system?.size ?? 3) <= grabSize));
  const grappleOpt = unarmed && canGrab
    ? `<div class="form-group"><label>Grapple (${followup?.weight === "heavy" ? "Heavy: damage + grapple" : followup?.weight === "light" ? "Light: grapple only, no damage" : "Light: grapple only · Heavy: damage + grapple"})</label><input type="checkbox" name="grapple" ${presetGrapple ? "checked" : ""}></div>` : "";

  // Bladed Weapons tree: Whirlwind (T1 Light, Blender at T3), Remise (T1 Heavy, on a Solitary follow-up).
  let bladedOpts = "";
  if (!followup && !unarmed && !base.ranged && ab.bladed(actor, item, 1, "light") && ab.fastValue(actor, item) > 0) {
    const cost = ab.BLADED_COST.whirlwind(item);
    bladedOpts += `<div class="form-group"><label>Whirlwind <span class="fs-energy-inline">⚡ ${cost}</span></label><select name="whirlwind">
      <option value="">No</option>
      <option value="on">Whirlwind: this attack and its Fast follow-up hit every target in melee range (Area) · ${cost} Energy</option>
      ${ab.bladed(actor, item, 3, "light") ? `<option value="blender">Whirlwind + Blender: as above, and the attacks gain Cleave · ${cost * 2} Energy</option>` : ""}
    </select></div>`;
  }
  let remiseState = null;
  if (followup?.kind === "solitary" && !followup.riposte && ab.bladed(actor, item, 1, "heavy")) {
    remiseState = firstHitLanded(followup.source);
    const cost = ab.BLADED_COST.remise(item);
    bladedOpts += remiseState === false ? `<p class="hint">Remise: the first attack missed, so it can't be used.</p>`
      : remiseState === "pending" ? `<p class="hint">Remise: resolve the first attack (dodge or take the hit) before this follow-up to use it.</p>`
      : `<div class="form-group"><label>Remise <span class="fs-energy-inline">⚡ ${cost}</span>: Advantage and Strengthened${remiseState === null ? " (only if the first attack hit)" : ""}</label><input type="checkbox" name="remise"></div>`;
  }
  if (followup?.whirlwind) bladedOpts += `<p class="hint"><strong>Whirlwind${followup.whirlwind === "blender" ? " + Blender" : ""}:</strong> Area attack on every target in melee range${followup.whirlwind === "blender" ? ", with Cleave" : ""}. Already paid.</p>`;
  if (followup?.perfect) bladedOpts += `<p class="hint"><strong>Perfect Riposte:</strong> Advantage and Strengthened${followup.riposte ? ` · ${ab.BLADED_COST.perfectRiposte(item)} Energy` : " (from the Perfect Riposte)"}.</p>`;

  // Brawling Methods (Unarmed): Twin Fang, Jab, Dragon Lash, Kick Out.
  let brawlOpts = "";
  if (unarmed && ab.brawl(actor, 1)) {
    const C = ab.BRAWLING_COST;
    const canLight = !followup?.weight || followup.weight === "light";
    const canHeavy = !followup?.weight || followup.weight === "heavy";
    if (!followup && canLight) {
      brawlOpts += byWeight("light", `<div class="form-group"><label>Twin Fang (Light) <span class="fs-energy-inline">⚡ ${C.twinFang(actor)}</span></label><select name="twinFang">
        <option value="">No</option><option value="adv">Yes: this attack gets Advantage</option><option value="str">Yes: this attack is Strengthened</option></select></div>
        <p class="hint">Twin Fang covers this Light attack and its Fast Unarmed follow-up (which picks its own bonus).</p>`);
    }
    if (followup?.twinFang) {
      brawlOpts += `<div class="form-group"><label>Twin Fang (already paid)</label><select name="twinFangPick">
        <option value="adv">Advantage</option><option value="str">Strengthened</option></select></div>`;
    }
    // Jab (T1, Heavy): only on the Solitary follow-up hit.
    if (followup?.kind === "solitary" && followup.weight === "heavy") {
      brawlOpts += `<div class="form-group"><label>Jab (Heavy) <span class="fs-energy-inline">⚡ ${C.jab(actor)}</span>: Advantage and Strengthened</label><input type="checkbox" name="jab"></div>`;
    }
    if (canHeavy && followup?.kind !== "combo") {
      if (ab.brawl(actor, 3)) {
        brawlOpts += byWeight("heavy", `<div class="form-group"><label>Heavy technique</label><select name="heavyTech">
          <option value="">None</option>
          <option value="dragon">Dragon Lash: Strengthened, 2× Knockback (both doubled vs prone) · ⚡ ${C.dragonLash(actor)}</option>
          ${ab.brawl(actor, 4) ? `<option value="kick">Kick Out: knock the target prone on a hit (up to one size larger) · ⚡ ${C.kickOut(actor)}</option>` : ""}
        </select></div>`);
      }
    }
  }

  // Rapid Weapons: Spin Down (T2) doubles the shots fired with Pepper.
  let rapidOpts = "";
  if (base.pepper && ab.rapid(actor, item, 2)) {
    rapidOpts += `<div class="form-group"><label>Spin Down <span class="fs-energy-inline">⚡ ${ab.RAPID_COST.spinDown(item)}</span>: double the Pepper shots (same target, same Disadvantage)</label><input type="checkbox" name="spinDown"></div>`;
  }
  if (speedloaded) rapidOpts += `<p class="hint"><strong>Speedloader:</strong> reloaded; a Pepper attack has one less Disadvantage.</p>`;

  // Swift Weapons: Quick Strike (T2).
  let swiftOpts = "";
  if (!unarmed && !followup && ab.swift(actor, item, 2)) {
    swiftOpts += `<div class="form-group"><label>Quick Strike <span class="fs-energy-inline">⚡ ${ab.SWIFT_COST.quickStrike(item)}</span>: Advantage (and on a Swift Fast follow-up)</label><input type="checkbox" name="quickStrike"></div>`;
  }
  if (followup?.quickStrike) swiftOpts += `<p class="hint"><strong>Quick Strike:</strong> Advantage (already paid).</p>`;
  if (followup?.kind === "flurry") swiftOpts += `<p class="hint"><strong>Blade Flurry:</strong> costs ${esc(String(p0Ap(item, unarmed)))} RP and ${ab.SWIFT_COST.bladeFlurry(item)} Energy.</p>`;
  if (followup?.cutBack) swiftOpts += `<p class="hint"><strong>Cut Back:</strong> a Riposte after your dodge.</p>`;

  // Balanced Weapons: Spin Cycle (T2), Slice (T3 Light) / Slam (T3 Heavy), both effects with One with your Weapon (T5).
  let balancedOpts = "";
  if (!unarmed && !base.ranged && ab.balanced(actor, item, 2) && !followup) {
    const cost = ab.BALANCED_COST.spinCycle(item);
    balancedOpts += `<div class="form-group"><label>Spin Cycle <span class="fs-energy-inline">⚡ ${cost}</span>: Area attack on every target in melee range</label><input type="checkbox" name="spinCycle"></div>`;
  }
  if (!unarmed && ab.balanced(actor, item, 3)) {
    const both = ab.balanced(actor, item, 5);
    const c = ab.BALANCED_COST.slice(item);
    if (item.system.weight === "light") {
      balancedOpts += `<div class="form-group"><label>Slice (Light)</label><select name="slice">
        <option value="">No</option><option value="pierce">Pierce (ignore ¼ Scaling Stat of Limit) · ${c} Energy</option>
        <option value="slow">Hamstring: on a hit, their movement costs +1 AP until your next turn · ${c} Energy</option>
        ${both ? `<option value="both">Both (One with your Weapon) · ${c * 2} Energy</option>` : ""}</select></div>`;
    } else {
      balancedOpts += `<div class="form-group"><label>Slam (Heavy)</label><select name="slam">
        <option value="">No</option><option value="knockback">Knockback (5 × Scaling Stat Force) · ${c} Energy</option>
        <option value="bash">Bash (ignore armor/weapon Limit ≤ ¼ Scaling Stat, add it as damage) · ${c} Energy</option>
        ${both ? `<option value="both">Both (One with your Weapon) · ${c * 2} Energy</option>` : ""}</select></div>`;
    }
  }

  // T2 Martial trees: Strength Methods, Striker, Defender, Weighted, Assault.
  const dlgTargets = (followup?.targetActors ?? [...(game.user.targets ?? [])].map(t => t.actor)).filter(a => a && a.type !== "pile");
  const allProne = dlgTargets.length > 0 && dlgTargets.every(a => a.statuses?.has("prone"));
  let t2Opts = "";
  if (ab.strength(actor, 2) && (unarmed ? followup?.weight !== "light" : w.weight === "heavy")) {
    t2Opts += byWeight("heavy", `<div class="form-group"><label>Heave! (Heavy) <span class="fs-energy-inline">⚡ ${ab.STRENGTH_COST.heave(actor)}</span>: Strengthened and Bash (Bash+ if it already has Bash)</label><input type="checkbox" name="heave"></div>`);
  }
  if (ab.strength(actor, 4) && !unarmed && !base.ranged && w.weight === "heavy" && base.throwType && base.throwType !== "good" && !followup) {
    const c = ab.STRENGTH_COST.ho(actor);
    t2Opts += `<div class="form-group"><label>Ho! (thrown Heavy) <span class="fs-energy-inline">⚡ ${c} each</span></label><select name="ho">
      <option value="0">No</option><option value="1">${base.throwType === "bad" ? "Bad → Average" : "Average → Good"} · ${c} Energy</option>
      ${base.throwType === "bad" ? `<option value="2">Bad → Good (twice) · ${2 * c} Energy</option>` : ""}</select></div>`;
  }
  if (!unarmed && ab.striker(actor, item, 1)) {
    const shred = ab.striker(actor, item, 3), all = ab.striker(actor, item, 5);
    t2Opts += `<div class="form-group"><label>Rend <span class="fs-energy-inline">⚡ ${ab.STRIKER_COST.rend(item)}</span>: damage to ${all ? "everything it hits" : "objects (after their Limit)"} is Strengthened${shred ? " (twice against a single target, Shred)" : ""}</label><input type="checkbox" name="rend"></div>`;
  }
  if (!unarmed && !base.ranged && ab.weighted(actor, item, 1)) {
    const c = ab.WEIGHTED_COST.swing(item);
    const crunch = ab.weighted(actor, item, 5) && allProne;
    if (w.weight === "light") {
      t2Opts += crunch
        ? `<div class="form-group"><label>Controlled Swing <span class="fs-energy-inline">⚡ ${c}</span>: Advantage and Solitary (Crunch: target is prone)</label><input type="checkbox" name="controlled" value="both"></div>`
        : `<div class="form-group"><label>Controlled Swing (Light) <span class="fs-energy-inline">⚡ ${c}</span></label><select name="controlled">
          <option value="">No</option><option value="adv">Advantage</option><option value="solitary">Solitary (another attack, per Solitary)</option></select></div>`;
    } else {
      t2Opts += crunch
        ? `<div class="form-group"><label>Wild Swing <span class="fs-energy-inline">⚡ ${c}</span>: Disadvantage, Bash+ and two Strengthened (Crunch: target is prone)</label><input type="checkbox" name="wild" value="both"></div>`
        : `<div class="form-group"><label>Wild Swing (Heavy) <span class="fs-energy-inline">⚡ ${c}</span>: Disadvantage, plus</label><select name="wild">
          <option value="">No</option><option value="bashPlus">Bash+</option><option value="str2">Two Strengthened</option><option value="bashStr">Bash and one Strengthened</option></select></div>`;
    }
    if (ab.weighted(actor, item, 2) && !followup) t2Opts += `<div class="form-group"><label>Spin <span class="fs-energy-inline">⚡ ${ab.WEIGHTED_COST.spin(item)}</span>: Area attack on every target in melee range</label><input type="checkbox" name="spin"></div>`;
    if (ab.weighted(actor, item, 3) && base.farstrike < 2) t2Opts += `<div class="form-group"><label>Strafing (moving while attacking): Wide Arc gives Farstrike</label><input type="checkbox" name="strafe"></div>`;
    if (ab.weighted(actor, item, 4) && base.knockback) t2Opts += `<div class="form-group"><label>Smash <span class="fs-energy-inline">⚡ ${ab.WEIGHTED_COST.smash(item)}</span>: +${5 * base.capped} Knockback Force</label><input type="checkbox" name="smash"></div>`;
  }
  if (!unarmed && base.ranged && ab.assault(actor, item, 2)) {
    const free = ab.assault(actor, item, 4) && inActiveCombat(actor) && actor.getFlag("flowstate", "movedTurn") !== turnKey();
    t2Opts += `<div class="form-group"><label>Take Aim <span class="fs-energy-inline">⚡ ${ab.ASSAULT_COST.takeAim(item)}</span></label><select name="takeAim">
      <option value="">No</option><option value="adv">Advantage</option><option value="str">Strengthened</option></select></div>
      ${free ? `<div class="form-group"><label>Cool Breath: Take Aim is free, but you can't move for the rest of this turn</label><input type="checkbox" name="coolBreath"></div>` : ""}`;
  }
  const board = !unarmed && !followup && !ab.defender(actor, item, 1) ? ab.defenderHeld(actor, 3).filter(i => i.id !== item.id) : [];
  if (board.length) {
    t2Opts += `<div class="form-group"><label>Sword and Board <span class="fs-energy-inline">⚡ ${ab.DEFENDER_COST.swordAndBoard(board[0])}</span>: attack with ${esc(board[0].name)} first; if it hits, the target's dodge against this attack has Disadvantage</label><input type="checkbox" name="swordBoard"></div>`;
  }
  if (!unarmed && (!followup || followup.riposte) && !base.ranged && base.throwType && ab.defender(actor, item, 2)) {
    t2Opts += `<div class="form-group"><label>Shield Toss (Throw mode) <span class="fs-energy-inline">⚡ ${ab.DEFENDER_COST.shieldToss(item)}</span></label><select name="shieldToss">
      <option value="">No</option><option value="damage">Strengthened; returns to you on a hit${ab.defender(actor, item, 4) ? " (or Bounce)" : ""}</option>
      <option value="guard">No damage: on a hit, it Blocks the next attack against that target</option></select></div>
      ${followup?.riposte ? "" : `<div class="form-group"><label>Shield Toss paid with</label><select name="tossPay"><option value="ap">2 AP</option><option value="rp">2 RP</option></select></div>`}`;
  }

  // T3 Martial trees: Dexterity Methods, Reach, Circular, Blast.
  let t3Opts = "";
  const canBeLight = unarmed ? !followup?.weight || followup.weight === "light" : w.weight === "light";
  if (ab.dexterity(actor, 2) && canBeLight) {
    const pick = n => `<select name="shank${n}"><option value="">—</option><option value="pierce">Pierce (again: Pierce+)</option><option value="cleave">Cleave (again: Cleave+)</option>
      <option value="dodge">Disadvantage on their dodge</option><option value="adv">Advantage on the attack</option></select>`;
    t3Opts += byWeight("light", `<div class="form-group"><label>Shank (Light) <span class="fs-energy-inline">⚡ ${ab.DEXTERITY_COST.shank(actor)}</span>: pick three (repeats stack)</label>${pick(1)}${pick(2)}${pick(3)}</div>`);
  }
  if (ab.dexterity(actor, 5) && canBeLight && ((followup?.net ?? 0) < 0 && ["fast", "solitary"].includes(followup?.kind) || base.pepper)) {
    t3Opts += byWeight("light", `<div class="form-group"><label>Pinpoint Accuracy <span class="fs-energy-inline">⚡ ${ab.DEXTERITY_COST.pinpoint(actor)}</span>: no ${base.pepper ? "Pepper" : "Fast/Solitary"} Disadvantage</label><input type="checkbox" name="pinpoint"></div>`);
  }
  if (!unarmed && ab.reach(actor, item, 2)) {
    t3Opts += `<div class="form-group"><label>Thrust <span class="fs-energy-inline">⚡ ${ab.REACH_COST.thrust(item)}</span>: ${w.weight === "light" ? "Cleave" : "Cleave+"}</label><input type="checkbox" name="thrust"></div>`;
  }
  if (!unarmed && ab.circular(actor, item, 1)) {
    if (!followup && base.throwType) t3Opts += `<div class="form-group"><label>What Goes Around (Throw mode) <span class="fs-energy-inline">⚡ ${ab.CIRCULAR_COST.whatGoesAround(item)}</span>: it returns to you with an extra attack${ab.circular(actor, item, 5) ? " from half stealth (Vector Assault)" : ""}</label><input type="checkbox" name="wga"></div>`;
    if (ab.circular(actor, item, 2)) {
      const c = ab.CIRCULAR_COST.through(item);
      t3Opts += w.weight === "light"
        ? `<div class="form-group"><label>Pierce Through (Light) <span class="fs-energy-inline">⚡ ${c}</span></label><select name="through"><option value="">No</option><option value="adv">Advantage</option><option value="pierce">Pierce+</option></select></div>`
        : `<div class="form-group"><label>Cut Through (Heavy) <span class="fs-energy-inline">⚡ ${c}</span></label><select name="through"><option value="">No</option><option value="str">Strengthened</option><option value="cleave">Cleave+</option></select></div>`;
      if (ab.circular(actor, item, 4)) t3Opts += `<p class="hint">Shadow Wings: a Thrown attack while you're stealthing gets both effects.</p>`;
    }
    if (ab.circular(actor, item, 3)) t3Opts += `<div class="form-group"><label>Let it Rip! <span class="fs-energy-inline">⚡ ${ab.CIRCULAR_COST.letItRip(item)}</span>: on a hit, the damage is repeated</label><input type="checkbox" name="letItRip"></div>`;
  }
  if (!unarmed && ab.blast(actor, item, 2)) {
    if (base.area) t3Opts += `<div class="form-group"><label>Cone Shot <span class="fs-energy-inline">⚡ ${ab.BLAST_COST.coneShot(item)}</span>: the Area is a 45° cone from you, half the weapon's range</label><input type="checkbox" name="cone"></div>`;
    if (ab.blast(actor, item, 4)) t3Opts += `<div class="form-group"><label>Punch <span class="fs-energy-inline">⚡ ${ab.BLAST_COST.punch(item)}</span>: ${w.weight === "light" ? "Knockback" : "Knockback+"}</label><input type="checkbox" name="punch"></div>`;
    if (ab.blast(actor, item, 5) && allProne) t3Opts += `<div class="form-group"><label>Execute <span class="fs-energy-inline">⚡ ${ab.BLAST_COST.execute(item)}</span>: two Strengthened (prone target in melee range)</label><input type="checkbox" name="execute"></div>`;
  }

  // T4/T5 Martial trees: Curved, Longshot, Thrasher.
  let t4Opts = "";
  const soloTarget = dlgTargets.length === 1 ? dlgTargets[0] : null;
  const momentum = soloTarget && !unarmed && ab.curved(actor, item, 3) ? momentumOf(soloTarget, actor) : null;
  if (!unarmed && ab.curved(actor, item, 1) && soloTarget) {
    const held = soloTarget.items.filter(i => i.type === "weapon" && i.system.held && i.system.weaponType !== "unarmed");
    const holding = grappledBy(soloTarget);
    if (held.length || holding.length) {
      t4Opts += `<div class="form-group"><label>Disarm <span class="fs-energy-inline">⚡ ${ab.CURVED_COST.disarm(item)}</span>: Weakened; on a hit they let go of</label><select name="disarm">
        <option value="">No</option>${held.map(i => `<option value="${i.uuid}">${esc(i.name)}</option>`).join("")}
        ${holding.length ? `<option value="grapple">their grapple (${esc(holding.map(v => v.name).join(", "))})</option>` : ""}</select></div>`;
    }
  }
  if (momentum && (momentum.adv || momentum.str)) t4Opts += `<p class="hint"><strong>Momentum on ${esc(soloTarget.name)}:</strong> +${momentum.adv} Advantage, +${momentum.str} Strengthened (applied automatically).</p>`;
  if (momentum && ab.curved(actor, item, 5) && momentum.adv + momentum.str >= 4) {
    t4Opts += `<div class="form-group"><label>Omnislash: spend all ${momentum.adv + momentum.str} Momentum; the attack hits automatically as a Double Crit</label><input type="checkbox" name="omnislash"></div>`;
  }
  if (!unarmed && base.ranged && ab.longshot(actor, item, 1)) {
    t4Opts += `<div class="form-group"><label>Prepared Shot <span class="fs-energy-inline">⚡ ${ab.LONGSHOT_COST.prepared(item)}</span>: Advantage and</label><select name="prepared">
      <option value="">No</option><option value="cleave">Cleave+</option><option value="pierce">Pierce+</option><option value="str">Strengthened</option>
      ${ab.longshot(actor, item, 5) ? `<option value="headshot">Headshot: all three · ⚡ ${ab.LONGSHOT_COST.headshot(item)}</option>` : ""}</select></div>`;
    if (ab.longshot(actor, item, 2)) t4Opts += `<div class="form-group"><label>Like Shooting Fish <span class="fs-energy-inline">⚡ ${ab.LONGSHOT_COST.fish(item)}</span>: on a hit, their movement is rough terrain until your next turn</label><input type="checkbox" name="fish"></div>`;
    if (ab.longshot(actor, item, 3)) t4Opts += `<div class="form-group"><label>Snipe Hunt <span class="fs-energy-inline">⚡ ${ab.LONGSHOT_COST.snipe(item)}</span>: their dodge gets a Disadvantage per Advantage on this attack</label><input type="checkbox" name="snipe"></div>`;
  }
  if (!unarmed && !base.ranged && ab.thrasher(actor, item, 1) && !followup) {
    t4Opts += `<div class="form-group"><label>Grapple (Thrasher): no damage; on a hit your weapon holds them</label><input type="checkbox" name="thrasherGrapple"></div>`;
    if (ab.thrasher(actor, item, 5)) t4Opts += `<div class="form-group"><label>Get Over Here! <span class="fs-energy-inline">⚡ ${ab.THRASHER_COST.getOverHere(item)}</span>: on a hit, grapple, pull them next to you, and ${ab.grappling(actor, 1) ? "Lock Down" : "knock them prone"}</label><input type="checkbox" name="getOverHere"></div>`;
    if (ab.thrasher(actor, item, 2)) t4Opts += `<div class="form-group"><label>Windup <span class="fs-energy-inline">⚡ ${ab.THRASHER_COST.windup(item)} each</span>: uses (each +1 Advantage${ab.thrasher(actor, item, 4) ? "; every two +1 Strengthened" : ""})</label><input type="number" name="windup" value="0" min="0" step="1"></div>`;
    if (ab.thrasher(actor, item, 3)) t4Opts += `<div class="form-group"><label>Overshield Strike <span class="fs-energy-inline">⚡ ${ab.THRASHER_COST.overshield(item)}</span>: ignores half cover and every Parry-type response</label><input type="checkbox" name="overshield"></div>`;
  }

  // Targeting (Ch8): with one creature targeted, you can aim at one of its equipped items instead of the creature.
  const aimTargets = (followup?.targetActors ?? [...(game.user.targets ?? [])].map(t => t.actor)).filter(a => a && a.type !== "pile");
  const aimables = aimTargets.length === 1
    ? aimTargets[0].items.filter(i => (i.type === "weapon" && i.system.held && i.system.weaponType !== "unarmed") || (i.type === "armor" && i.system.equipped)
      || (i.type === "foci" && i.system.equipped))
    : [];
  const aimField = aimables.length ? `<div class="form-group"><label>Target</label><select name="aim">
      <option value="">${esc(aimTargets[0].name)}</option>
      ${aimables.map(i => `<option value="${i.uuid}">${esc(aimTargets[0].name)}'s ${esc(i.name)}</option>`).join("")}</select></div>` : "";

  const title = followup ? `${item.name} — ${followup.label}` : item.name;
  const summary = unarmed
    ? (followup?.weight ? `${unarmedProfile(followup.weight).label} · ${unarmedProfile(followup.weight).display}` : "Unarmed")
    : `${base.label} · ${base.display} ${DAMAGE_TYPES[base.damageType]}`;
  const opts = await optionsDialog(title, `
    <p class="hint">${summary}${followup ? " · free follow-up" : unarmed ? "" : ` · ${base.ap} AP`}</p>
    ${followup?.riposte ? `<p class="hint"><strong>Riposte:</strong> costs ${esc(String(followup.rp ?? ""))} RP (the weapon's attack AP).</p>`
      : followup ? `<p class="hint"><strong>${esc(followup.label)}:</strong> ${followup.net < 0 ? "Disadvantage is applied automatically." : "no Disadvantage (+ tag)."} No AP/RP cost.</p>` : ""}
    ${aimField}${weightField}
    <div class="form-group"><label>Mode</label><select name="mode">${modes.join("")}</select></div>
    ${netField()}
    ${weaveHook && !followup && weaveHook.eligible(actor) ? `<div class="form-group"><label data-tooltip="Cast a spell alongside this attack for no extra AP/RP if its normal AP matches this attack's. Same target, still costs Energy, no TR, its own attack roll.">Weave a spell (Magic Theory T3)</label><input type="checkbox" name="weave"></div>` : ""}
    ${pepperOpts}${areaOpt}${grappleOpt}${bladedOpts}${balancedOpts}${swiftOpts}${rapidOpts}${brawlOpts}${t2Opts}${t3Opts}${t4Opts}
    ${stacksField("stacks")}
    <p class="hint">${followup?.riposte ? `Riposte against ${esc(followup.targetActors?.[0]?.name ?? "the attacker")}.` : "Target tokens first."} Material, size, armor, and tag effects are applied automatically.</p>`, "Attack");
  if (!opts) return;

  if (followup?.kind === "return") opts.mode = "throw";
  const p = unarmed ? unarmedProfile(followup?.weight ?? opts.weight ?? w.weight) : base;
  let ap = followup ? 0 : p.ap;
  let net = opts.net + (followup?.net ?? 0) - actor.system.penalties.physicalDis;
  const explicitTargets = followup?.targetActors ?? null;
  let stacks = opts.stacks + p.stacks - actor.system.penalties.physicalWeakened;
  const notes = unarmed ? [p.label] : [];
  // Ho! (Strength T4): a thrown Heavy weapon's throw is one step better per use (Bad → Average → Good).
  let throwType = p.throwType;
  let energy = 0;
  const hoSteps = opts.mode === "throw" ? Number(opts.ho) || 0 : 0;
  if (hoSteps) {
    const order = ["bad", "average", "good"];
    throwType = order[Math.min(2, order.indexOf(throwType) + hoSteps)];
    const mods = WEAPON_MATERIALS[w.material]?.mods ?? {};
    if (mods.throwForce) throwType = mods.throwForce;           // Gray Steel always throws Bad
    else if (throwType === "good" && mods.throwCap) throwType = mods.throwCap; // Gray Iron can't be Good
    energy += ab.STRENGTH_COST.ho(actor) * hoSteps;
    notes.push(`Ho! (${THROW[p.throwType].label} → ${THROW[throwType].label})`);
  }
  // Martial Theory T0 Throw: throwing a held weapon takes 2 AP.
  if (opts.mode === "throw") { net += THROW[throwType].net; ap = followup ? 0 : 2; notes.push(`Thrown (${THROW[throwType].label})`); }
  if (opts.mode === "r2") { net -= 1; notes.push("2× range"); }
  if (opts.mode === "r4") { net -= 2; ap = followup ? 0 : 6; notes.push("4× range"); }
  // Whirlwind (Bladed T1): the set of Fast attacks become Area attacks on targets in melee range (not Weakened).
  const whirl = followup ? (followup.whirlwind || "") : (opts.whirlwind || "");
  let damage = p.formula;
  // Cleave (Equipment): object-only damage, carried separately from the rolled dice.
  let cleave = p.cleave ?? 0;
  if (whirl) {
    if (opts.mode !== "strike") return ui.notifications.warn("Whirlwind only works with melee strikes.");
    if (!followup) energy += ab.BLADED_COST.whirlwind(item) * (whirl === "blender" ? 2 : 1);
    notes.push(whirl === "blender" ? "Whirlwind + Blender" : "Whirlwind");
    // Blender: the attacks gain the Cleave tag (+ Scaling Stat min damage) if they don't already have it.
    if (whirl === "blender" && !p.cleave) {
      cleave = Math.max(cleave, Math.floor(p.capped / 3) * p.hands);
    }
  }
  // The Area tag's Weakened applies to Area-tag weapons only; Whirlwind's Area attacks aren't Weakened.
  if (opts.area) { stacks -= 1; notes.push("Area (Weakened)"); }
  else if (whirl) notes.push("Area");
  // Remise (Bladed T1, Heavy): on a Solitary follow-up after the first hit landed.
  if (opts.remise) {
    if (remiseState === false || remiseState === "pending") return ui.notifications.warn("Remise needs the first attack in the chain to have hit.");
    energy += ab.BLADED_COST.remise(item); net += 1; stacks += 1; notes.push("Remise (Advantage, Strengthened)");
  }
  // Perfect Riposte (Bladed T5): the riposte and its Fast/Solitary follow-up get Advantage and Strengthened.
  if (followup?.perfect) {
    if (followup.riposte) energy += ab.BLADED_COST.perfectRiposte(item);
    net += 1; stacks += 1; notes.push("Perfect Riposte (Advantage, Strengthened)");
  }
  // Swift Weapons.
  let quickStrike = false;
  if (opts.quickStrike) { quickStrike = true; energy += ab.SWIFT_COST.quickStrike(item); net += 1; notes.push("Quick Strike (Advantage)"); }
  if (followup?.quickStrike) { net += 1; notes.push("Quick Strike (Advantage)"); }
  if (followup?.kind === "wall") { energy += ab.REACH_COST.wall(item); notes.push("Wall (no RP)"); }
  if (followup?.kind === "palisade") notes.push("Palisade");
  if (followup?.kind === "flurry") { energy += ab.SWIFT_COST.bladeFlurry(item); notes.push("Blade Flurry"); }

  // Balanced Weapons.
  let spin = false, pierce = p.pierce, knockback = p.knockback, knockbackAdd = 0, bash = 0;
  if (opts.spinCycle) {
    if (opts.mode !== "strike") return ui.notifications.warn("Spin Cycle only works with melee strikes.");
    spin = true; energy += ab.BALANCED_COST.spinCycle(item); notes.push("Spin Cycle (Area)");
  }
  let sliceSlow = false;
  if (opts.slice) {
    const both = opts.slice === "both";
    energy += ab.BALANCED_COST.slice(item) * (both ? 2 : 1);
    if ((both || opts.slice === "pierce") && !pierce) pierce = Math.floor(p.capped / 4) * p.hands;
    if (both || opts.slice === "slow") sliceSlow = true;
    notes.push(`Slice: ${both ? "Pierce + movement +1 AP" : opts.slice === "slow" ? "movement +1 AP on a hit" : "Pierce"}`);
  }
  if (opts.slam) {
    const both = opts.slam === "both";
    energy += ab.BALANCED_COST.slam(item) * (both ? 2 : 1);
    if ((both || opts.slam === "knockback") && !knockback) knockback = 5 * p.capped * p.hands; // base +5× when two-handed
    if (both || opts.slam === "bash") bash = Math.floor(p.capped / 4) * p.hands;
    notes.push(`Slam: ${both ? "Knockback + Bash" : opts.slam === "knockback" ? "Knockback" : "Bash"}`);
  }

  // T2 Martial trees.
  const bashBase = Math.floor(p.capped / 4) * p.hands, bashPlus = Math.floor(p.capped / 2) * p.hands;
  const heavyWeight = unarmed ? p.scalingStat === "str" : w.weight === "heavy";
  if (opts.heave) {
    if (!heavyWeight) return ui.notifications.warn("Heave! needs a Heavy attack.");
    energy += ab.STRENGTH_COST.heave(actor); stacks += 1;
    bash = bash ? Math.max(bash, bashPlus) : bashBase;
    notes.push(`Heave! (Strengthened, ${bash === bashPlus && bashPlus !== bashBase ? "Bash+" : "Bash"})`);
  }
  let rend = null;
  if (opts.rend) {
    const single = !opts.area && !spin && !whirl && (explicitTargets ?? [...(game.user.targets ?? [])]).length <= 1;
    // Blood and Iron (Striker T5) no longer extends Rend to creatures (only Cleave).
    rend = { stacks: 1 + (ab.striker(actor, item, 3) && single ? 1 : 0), all: false };
    energy += ab.STRIKER_COST.rend(item);
    notes.push(`Rend (${rend.all ? "damage" : "damage to objects"} Strengthened${rend.stacks > 1 ? " ×2, Shred" : ""})`);
  }
  let solitaryOverride = 0;
  if (opts.controlled) {
    const both = opts.controlled === "both";
    energy += ab.WEIGHTED_COST.swing(item);
    if (both || opts.controlled === "adv") net += 1;
    if (both || opts.controlled === "solitary") solitaryOverride = 1;
    notes.push(`Controlled Swing (${both ? "Advantage + Solitary, Crunch" : opts.controlled === "adv" ? "Advantage" : "Solitary"})`);
  }
  if (opts.wild) {
    energy += ab.WEIGHTED_COST.swing(item); net -= 1;
    const pick = opts.wild === "both" ? "both" : opts.wild;
    if (pick === "both" || pick === "bashPlus") bash = Math.max(bash, bashPlus);
    if (pick === "bashStr") bash = Math.max(bash, bashBase);
    stacks += pick === "both" || pick === "str2" ? 2 : pick === "bashStr" ? 1 : 0;
    notes.push(`Wild Swing (Disadvantage; ${pick === "both" ? "Bash+ and 2× Strengthened, Crunch" : pick === "bashPlus" ? "Bash+" : pick === "str2" ? "2× Strengthened" : "Bash and Strengthened"})`);
  }
  if (opts.spin) {
    if (opts.mode !== "strike") return ui.notifications.warn("Spin only works with melee strikes.");
    spin = true; energy += ab.WEIGHTED_COST.spin(item); notes.push("Spin (Area)");
  }
  let farstrike = p.farstrike;
  if (opts.strafe && opts.mode === "strike") { farstrike = Math.max(farstrike, 2); notes.push("Wide Arc (Strafing: Farstrike)"); }
  if (opts.smash && knockback) { knockbackAdd += 5 * p.capped; energy += ab.WEIGHTED_COST.smash(item); notes.push(`Smash (+${5 * p.capped} Knockback)`); }
  let rooted = false;
  if (opts.takeAim) {
    if (opts.coolBreath) { rooted = true; notes.push("Cool Breath (Take Aim free; no more movement this turn)"); }
    else energy += ab.ASSAULT_COST.takeAim(item);
    if (opts.takeAim === "adv") net += 1; else stacks += 1;
    notes.push(`Take Aim (${opts.takeAim === "adv" ? "Advantage" : "Strengthened"})`);
  }
  let shieldToss = null;
  if (opts.shieldToss) {
    if (opts.mode !== "throw") return ui.notifications.warn("Shield Toss is a Thrown attack: pick the Throw mode.");
    shieldToss = { mode: opts.shieldToss, item: item.uuid, pay: followup?.riposte || opts.tossPay === "rp" ? "rp" : "ap", bounces: 0, riposte: !!followup?.riposte };
    energy += ab.DEFENDER_COST.shieldToss(item);
    if (opts.shieldToss === "damage") stacks += 1;
    if (shieldToss.pay === "rp") ap = 0;
    notes.push(`Shield Toss (${opts.shieldToss === "guard" ? "Block for the target, no damage" : "Strengthened, returns on a hit"}; 2 ${shieldToss.pay.toUpperCase()})`);
  }
  const boardItem = opts.swordBoard ? board[0] : null;
  if (boardItem) energy += ab.DEFENDER_COST.swordAndBoard(boardItem);

  // T3 Martial trees.
  const lightWeight = !heavyWeight;
  let cleaveLevel = p.tags?.cleave ?? 0, pierceLevel = p.tags?.pierce ?? 0;
  const cleaveVal = L => (L >= 2 ? p.capped : L === 1 ? Math.floor(p.capped / 3) : 0);
  const pierceVal = L => (L >= 2 ? Math.floor(p.capped / 2) : L === 1 ? Math.floor(p.capped / 4) : 0);
  const setCleave = L => { L = Math.min(2, L); if (L <= cleaveLevel) return; cleave = Math.max(cleave, cleaveVal(L) * p.hands); cleaveLevel = L; };
  const setPierce = L => { L = Math.min(2, L); if (L <= pierceLevel) return; pierce = Math.max(pierce, pierceVal(L) * p.hands); pierceLevel = L; };
  let dodgeNet = 0;
  const shank = [opts.shank1, opts.shank2, opts.shank3].filter(Boolean);
  if (shank.length) {
    if (shank.length !== 3) return ui.notifications.warn("Shank needs all three picks.");
    if (!lightWeight) return ui.notifications.warn("Shank needs a Light attack.");
    const n = k => shank.filter(x => x === k).length;
    energy += ab.DEXTERITY_COST.shank(actor);
    if (n("pierce")) setPierce((p.tags?.pierce ?? 0) + n("pierce"));
    if (n("cleave")) setCleave((p.tags?.cleave ?? 0) + n("cleave"));
    dodgeNet -= n("dodge"); net += n("adv");
    notes.push(`Shank (${shank.map(x => ({ pierce: "Pierce", cleave: "Cleave", dodge: "dodge Dis", adv: "Advantage" })[x]).join(", ")})`);
  }
  let pinpointPepper = false;
  if (opts.pinpoint) {
    if (!lightWeight) return ui.notifications.warn("Pinpoint Accuracy needs a Light attack.");
    energy += ab.DEXTERITY_COST.pinpoint(actor);
    if ((followup?.net ?? 0) < 0) net -= followup.net;
    pinpointPepper = true;
    notes.push("Pinpoint Accuracy (no base penalty)");
  }
  if (opts.thrust) { energy += ab.REACH_COST.thrust(item); setCleave(lightWeight ? 1 : 2); notes.push(`Thrust (${lightWeight ? "Cleave" : "Cleave+"})`); }
  let wga = false;
  if (opts.wga) {
    if (opts.mode !== "throw") return ui.notifications.warn("What Goes Around needs the Throw mode.");
    wga = true; energy += ab.CIRCULAR_COST.whatGoesAround(item); notes.push("What Goes Around (returns with an extra attack)");
  }
  if (opts.through) {
    const both = ab.circular(actor, item, 4) && opts.mode === "throw" && actor.statuses?.has("stealth");
    energy += ab.CIRCULAR_COST.through(item);
    if (lightWeight) {
      if (both || opts.through === "adv") net += 1;
      if (both || opts.through === "pierce") setPierce(2);
      notes.push(`Pierce Through (${both ? "Advantage + Pierce+, Shadow Wings" : opts.through === "adv" ? "Advantage" : "Pierce+"})`);
    } else {
      if (both || opts.through === "str") stacks += 1;
      if (both || opts.through === "cleave") setCleave(2);
      notes.push(`Cut Through (${both ? "Strengthened + Cleave+, Shadow Wings" : opts.through === "str" ? "Strengthened" : "Cleave+"})`);
    }
  }
  const letItRip = !!opts.letItRip;
  if (letItRip) { energy += ab.CIRCULAR_COST.letItRip(item); notes.push("Let it Rip! (damage repeats on a hit)"); }
  let cone = false;
  if (opts.cone) {
    if (!opts.area) return ui.notifications.warn("Cone Shot changes an Area attack: tick the Area attack option too.");
    cone = true; energy += ab.BLAST_COST.coneShot(item); notes.push(`Cone Shot (45° cone, ${Math.floor((p.range ?? 0) / 2)} ft)`);
  }
  if (opts.punch) { energy += ab.BLAST_COST.punch(item); knockback = Math.max(knockback, 5 * p.capped * (p.hands + (lightWeight ? 0 : 1))); notes.push(`Punch (${lightWeight ? "Knockback" : "Knockback+"})`); }
  if (opts.execute) { energy += ab.BLAST_COST.execute(item); stacks += 2; notes.push("Execute (2× Strengthened)"); }

  // T4/T5 Martial trees.
  let disarm = null;
  if (opts.disarm) { disarm = opts.disarm; energy += ab.CURVED_COST.disarm(item); stacks -= 1; notes.push("Disarm (Weakened)"); }
  if (momentum && (momentum.adv || momentum.str) && !opts.omnislash) { net += momentum.adv; stacks += momentum.str; notes.push(`Momentum (+${momentum.adv} Adv, +${momentum.str} Str)`); }
  const omnislash = !!opts.omnislash && momentum && momentum.adv + momentum.str >= 4;
  if (omnislash) notes.push("Omnislash (automatic Double Crit)");
  if (opts.prepared) {
    const head = opts.prepared === "headshot";
    energy += head ? ab.LONGSHOT_COST.headshot(item) : ab.LONGSHOT_COST.prepared(item);
    net += 1;
    if (head || opts.prepared === "cleave") setCleave(2);
    if (head || opts.prepared === "pierce") setPierce(2);
    if (head || opts.prepared === "str") stacks += 1;
    notes.push(head ? "Headshot (Advantage, Cleave+, Pierce+, Strengthened)" : `Prepared Shot (Advantage, ${{ cleave: "Cleave+", pierce: "Pierce+", str: "Strengthened" }[opts.prepared]})`);
  }
  const fish = !!opts.fish;
  if (fish) { energy += ab.LONGSHOT_COST.fish(item); notes.push("Like Shooting Fish"); }
  const snipe = !!opts.snipe;
  if (snipe) { energy += ab.LONGSHOT_COST.snipe(item); notes.push("Snipe Hunt"); }
  const inABarrel = !unarmed && base.ranged && ab.longshot(actor, item, 4);
  const thrasherGrapple = !!(opts.thrasherGrapple || opts.getOverHere);
  if (opts.thrasherGrapple && !opts.getOverHere) notes.push("Grapple (Thrasher, no damage)");
  if (opts.getOverHere) { energy += ab.THRASHER_COST.getOverHere(item); notes.push("Get Over Here!"); }
  const windup = Math.max(0, Math.floor(Number(opts.windup) || 0));
  if (windup) {
    energy += ab.THRASHER_COST.windup(item) * windup; net += windup;
    const whirly = ab.thrasher(actor, item, 4) ? Math.floor(windup / 2) : 0;
    stacks += whirly;
    notes.push(`Windup ×${windup}${whirly ? ` (Whirlygig +${whirly} Strengthened)` : ""}`);
  }
  if (opts.overshield) { energy += ab.THRASHER_COST.overshield(item); notes.push("Overshield Strike (no Parry-type responses)"); }

  // Brawling Methods.
  const heavyAtk = unarmed && p.scalingStat === "str";
  const lightAtk = unarmed && !heavyAtk;
  const B = ab.BRAWLING_COST;
  let twinFang = false, dragonLash = false, kickOut = false;
  if (opts.twinFang) {
    if (!lightAtk) return ui.notifications.warn("Twin Fang needs a Light Unarmed attack.");
    twinFang = true; energy += B.twinFang(actor);
    if (opts.twinFang === "adv") net += 1; else stacks += 1;
    notes.push(`Twin Fang (${opts.twinFang === "adv" ? "Advantage" : "Strengthened"})`);
  }
  if (followup?.twinFang && lightAtk) {
    if (opts.twinFangPick === "str") stacks += 1; else net += 1;
    notes.push(`Twin Fang (${opts.twinFangPick === "str" ? "Strengthened" : "Advantage"})`);
  }
  if (opts.jab) {
    if (!heavyAtk || followup?.kind !== "solitary") return ui.notifications.warn("Jab only works on a Heavy Unarmed Solitary follow-up.");
    energy += B.jab(actor); net += 1; stacks += 1; notes.push("Jab (Advantage, Strengthened)");
  }
  if (opts.heavyTech) {
    if (!heavyAtk) return ui.notifications.warn(`${opts.heavyTech === "kick" ? "Kick Out" : "Dragon Lash"} needs a Heavy Unarmed attack.`);
    if (opts.heavyTech === "dragon") { dragonLash = true; energy += B.dragonLash(actor); notes.push("Dragon Lash"); }
    if (opts.heavyTech === "kick") { kickOut = true; energy += B.kickOut(actor); notes.push("Kick Out"); }
  }
  // Combo (T3) and Flow Like Water (T5): free extra attacks against the same target.
  if (followup?.kind === "combo") { energy += B.combo(actor); notes.push("Combo"); }
  if (followup?.kind === "flow") { energy += B.flow(actor, heavyAtk ? "heavy" : "light"); notes.push("Flow Like Water"); }
  if (energy && inActiveCombat(actor) && actor.system.energy.value < energy) {
    return ui.notifications.warn(`${actor.name} needs ${energy} Energy for that but has ${actor.system.energy.value}.`);
  }
  const pepper = Number(opts.pepper) || 0;
  let shots = 1 + pepper;
  if (pepper) { net -= pepper; notes.push(`Pepper +${pepper} shot${pepper > 1 ? "s" : ""}`); }
  if (pepper && pinpointPepper) net += pepper;
  if (opts.spinDown) {
    if (!pepper) return ui.notifications.warn("Spin Down needs Pepper shots.");
    shots *= 2; energy += ab.RAPID_COST.spinDown(item); notes.push(`Spin Down (${shots} shots)`);
  }
  if (speedloaded && pepper) { net += 1; notes.push("Speedloader (−1 Disadvantage)"); }
  if (energy && inActiveCombat(actor) && actor.system.energy.value < energy) {
    return ui.notifications.warn(`${actor.name} needs ${energy} Energy for that but has ${actor.system.energy.value}.`);
  }
  if (actor.system.penalties.physicalDis) notes.push("armor penalty");
  if (followup && !followup.riposte) notes.push(`${followup.label}${followup.net < 0 ? " — Disadvantage" : ""}`);

  // Range: melee reach (× Farstrike), throw range, or the chosen range band (Area extends to its radius).
  let maxRange, what;
  if (opts.mode === "strike") { maxRange = actor.system.derived.size.melee * farstrike; what = "a melee strike"; }
  else if (opts.mode === "throw") { maxRange = THROW[throwType].range; what = "a throw"; }
  else {
    const band = p.range * ({ r1: 1, r2: 2, r4: 4 }[opts.mode] ?? 1);
    maxRange = cone ? Math.floor(p.range / 2) : opts.area ? (p.area === 2 ? band : band / 2) + (p.area === 2 ? 10 : 5) : band;
    what = opts.area ? "an Area attack" : "this range band";
  }
  const rangeTokens = explicitTargets ? explicitTargets.flatMap(a => a.getActiveTokens?.() ?? []) : null;
  if (!checkRange(actor, maxRange, what, rangeTokens)) return;

  // Grapple: only against creatures your size or smaller.
  const grapple = !!opts.grapple && unarmed;
  if (grapple) {
    const bigHands = ab.grappling(actor, 3) ? 1 : 0;
    const tooBig = (explicitTargets ?? [...game.user.targets].map(t => t.actor)).filter(a => a && (a.system?.size ?? 3) > actor.system.size + bigHands);
    if (tooBig.length) return ui.notifications.warn(`${tooBig.map(a => a.name).join(", ")} ${tooBig.length === 1 ? "is" : "are"} too large to grapple (${bigHands ? "up to one size larger, Big Hands" : "your size or smaller"}).`);
    if (bigHands) { net += 1; notes.push("Big Hands (Advantage)"); }
    notes.push(p.scalingStat === "str" ? "Grapple (Heavy: damage + grapple)" : "Grapple (Light: no damage)");
  }

  // Riposte (Martial Theory T1) costs RP equal to the weapon's normal attack AP.
  if (followup?.riposte) {
    // A Shield Toss riposte is a throw: the Riposte's RP is the toss's 2, not an extra payment.
    const ripCost = shieldToss ? 2 : p.ap;
    if (!(await spendPoints(actor, "rp", ripCost, `${followup.cutBack ? "Cut Back" : "a Riposte"} with ${item.name}`))) return;
    notes.push(`${followup.cutBack ? "Cut Back" : "Riposte"} (${ripCost} RP)`);
  }
  if (followup?.kind === "flurry" || followup?.kind === "mark" || followup?.kind === "palisade") {
    if (!(await spendPoints(actor, "rp", p.ap, `${{ mark: "a Mark shot", flurry: "Blade Flurry", palisade: "Palisade" }[followup.kind]} with ${item.name}`))) return;
    notes.push(`${p.ap} RP`);
  }
  if (shieldToss?.pay === "rp" && !shieldToss.riposte && !(await spendPoints(actor, "rp", 2, `Shield Toss with ${item.name}`))) return;
  if (!(await spendAP(actor, ap, `attacking with ${item.name}`))) return;
  const rpPaid = followup?.riposte ? (shieldToss ? 2 : p.ap) : ["flurry", "mark", "palisade"].includes(followup?.kind) ? p.ap : shieldToss?.pay === "rp" ? 2 : 0;
  if (energy && !(await spendEnergy(actor, energy, notes.filter(n => /Whirlwind|Remise|Perfect/.test(n)).join(", ") || "that"))) return;
  if (rooted && inActiveCombat(actor)) await actor.setFlag("flowstate", "rootedTurn", turnKey());
  if (energy) notes.push(`${energy} Energy`);
  if (p.ranged) await item.update({ "system.rounds": Math.max(0, (item.system.rounds ?? 0) - 1) });

  // Follow-ups: Solitary (same weapon) or Fast (a different held Fast weapon; the other fist counts). Never chain.
  // A Riposte is an RP attack, so it can trigger them too. Titan Weapon (Bladed T4) lets two-handed Heavy attacks use Solitary+ (with Dis).
  const followups = [];
  if (!followup || followup.riposte || ["flow", "flurry", "mark"].includes(followup.kind)) {
    const lightUnarmedFast = WEAPON_TYPES.unarmed.light.tags.fast ?? 0;
    // Only a Fast attack (a Fast weapon, or a Light Unarmed strike) opens a Fast follow-up.
    // A Light grapple opening the chain with both hands free still opens the other fist's Fast follow-up (for this attack
    // only; afterwards that hand is holding the grapple). A Heavy grapple, like any Heavy Unarmed attack, only offers Solitary.
    const selfFast = unarmed ? (p.scalingStat === "str" ? 0 : lightUnarmedFast) : ab.fastValue(actor, item);
    const carry = { perfect: !!followup?.perfect, flowChain: followup?.kind === "flow" || !!followup?.flowChain };
    const sol = opts.mode !== "throw" ? ab.solitaryFollowup(actor, item, solitaryOverride ? { ...p, solitary: Math.max(p.solitary ?? 0, solitaryOverride) } : p) : null;
    if (sol) {
      followups.push({ ...carry, kind: "solitary", itemId: item.id, attackType, net: sol.net, weight: unarmed ? p.scalingStat === "str" ? "heavy" : "light" : "",
        label: `Solitary follow-up${sol.titan ? " (Titan Weapon, Dis)" : sol.net ? " (Dis)" : ""}` });
    }
    if (unarmed && selfFast && ab.freeFists(actor) >= 2 && lightUnarmedFast) {
      followups.push({ ...carry, kind: "fast", whirlwind: whirl, twinFang, itemId: item.id, net: lightUnarmedFast === 2 ? 0 : -1, weight: "light",
        label: `Fast follow-up: other fist${lightUnarmedFast === 2 ? "" : " (Dis)"}` });
    }
    for (const other of actor.items) {
      if (other.type !== "weapon" || other.id === item.id || !other.system.held) continue;
      const otherUnarmed = other.system.weaponType === "unarmed";
      const fast = selfFast && !(otherUnarmed && ab.freeFists(actor) < 1) ? ab.fastValue(actor, other, lightUnarmedFast) : 0;
      if (fast) followups.push({ ...carry, kind: "fast", whirlwind: whirl, twinFang: twinFang && otherUnarmed,
        quickStrike: quickStrike && !otherUnarmed && ab.isSwiftAttack(actor, other), itemId: other.id, net: fast === 2 ? 0 : -1, weight: otherUnarmed ? "light" : "",
        label: `Fast follow-up: ${other.name}${fast === 2 ? "" : " (Dis)"}${whirl ? " · Whirlwind" : ""}` });
    }
  }

  // What Goes Around (Circular T1): the thrown weapon returns with an extra attack (from half stealth with Vector Assault, T5).
  if (wga) followups.push({ kind: "return", itemId: item.id, attackType, net: 0, weight: "", label: `What Goes Around: return attack${ab.circular(actor, item, 5) ? " (half stealth)" : ""}` });
  const thrown = opts.mode === "throw" || followup?.kind === "return";
  const landingToken = thrown ? [...game.user.targets].find(t => t.actor?.type !== "pile") ?? null : null;
  // Sword and Board (Defender T3): the shield attack goes first, against the same targets.
  let swordBoard = null;
  if (boardItem) {
    const bp = boardItem.system.profile;
    const shieldMsg = await performAttack(actor, {
      label: `${boardItem.name} — Sword and Board`, net: -actor.system.penalties.physicalDis, melee: true, push: false,
      damage: bp.formula, cleave: bp.cleave ?? 0, type: bp.damageType, stacks: bp.stacks - actor.system.penalties.physicalWeakened, physical: true, shots: 1,
      critStacks: bp.critStacks, vsSupernatural: bp.vsSupernatural, arcaneVsMagic: bp.arcaneVsMagic, pierce: bp.pierce, knockback: bp.knockback,
      notes: [`Sword and Board (${ab.DEFENDER_COST.swordAndBoard(boardItem)} Energy): if this hits, the dodge against ${item.name} has Disadvantage`],
      followups: [], itemUuid: boardItem.uuid, turnKey: turnKey(), targetActors: explicitTargets
    });
    swordBoard = shieldMsg?.id ?? null;
  }
  const result = await performAttack(actor, {
    label: followup ? `${item.name} — ${followup.label}` : unarmed ? `${item.name} (${WEAPON_TYPES.unarmed.label} ${p.scalingStat === "str" ? "Heavy" : "Light"})` : item.name,
    net, stealth: followup?.kind === "return" && ab.circular(actor, item, 5) ? "half" : opts.stealth, melee: opts.mode === "strike", push: false,
    damage: shieldToss?.mode === "guard" || (opts.thrasherGrapple && !opts.getOverHere) ? "" : damage, type: p.damageType, stacks, ap: 0, apCost: ap || rpPaid,
    physical: true, shots,
    critStacks: p.critStacks, vsSupernatural: p.vsSupernatural, arcaneVsMagic: p.arcaneVsMagic,
    pierce, knockback, knockbackAdd: knockback ? knockbackAdd : 0, bash, notes, followups, followupOf: followup?.source ?? null,
    aimItem: opts.aim && !opts.area && !whirl && !spin && !grapple ? opts.aim : null,
    aimName: opts.aim && !opts.area && !whirl && !spin && !grapple ? aimables.find(i => i.uuid === opts.aim)?.name ?? null : null,
    area: !!opts.area || !!whirl || spin, grapple, grappleOnly: grapple && p.scalingStat !== "str",
    swift: !unarmed && ab.isSwiftAttack(actor, item), turnKey: turnKey(),
    swiftLight: !unarmed && ab.isSwiftAttack(actor, item) && item.system.weight === "light",
    omega: !unarmed && ab.isSwiftAttack(actor, item) && item.system.weight === "heavy" && ab.treeTier(actor, ab.SWIFT) >= 5,
    leadBlind: !unarmed && ab.rapid(actor, item, 4),
    itemUuid: unarmed ? null : item.uuid, unarmedWeight: unarmed ? (heavyAtk ? "heavy" : "light") : null, attackType: unarmed ? "unarmed" : attackType,
    setKind: followup?.kind ?? null, flowChain: !!(followup?.kind === "flow" || followup?.flowChain), dragonLash, kickOut,
    rend, swordBoard, shieldToss, dodgeNet, letItRip, palisadeFrom: followup?.palisadeFrom ?? null, cleave,
    disarm, omnislash, fishy: fish, sliceSlow, snipe, inABarrel, overshield: !!opts.overshield, striker: !unarmed && ab.striker(actor, item, 5),
    curved: !unarmed && ab.isCurvedAttack(actor, item), momentumItem: !unarmed && ab.curved(actor, item, 3) ? item.uuid : null,
    thrasherGrapple: thrasherGrapple ? item.uuid : null, thrasherThrown: thrasherGrapple && thrown ? "pinned by a thrown weapon" : null, getOverHere: !!opts.getOverHere,
    pointBlank: !unarmed && ab.blast(actor, item, 1),
    reachItem: !unarmed && ab.reach(actor, item, 4) ? item.uuid : null,
    targetActors: explicitTargets
  });
  await mentalHook?.attackCost?.(actor, { ap, rp: rpPaid });                                   // Will of Body and Spirit (Mental T4)
  // Weaving: the woven spell goes at the same target, free of AP/RP, once the attack is made.
  if (opts.weave && weaveHook) await weaveHook.run(actor, { ap: p.ap, melee: opts.mode === "strike" || unarmed, targetActors: explicitTargets ?? [...(game.user?.targets ?? [])].map(t => t.actor).filter(a => a && a.type !== "pile") });
  // A thrown weapon leaves your hand and lands by what it was thrown at. A Shield Toss comes back on a hit
  // (it lands by the target on a miss, handled when the target responds).
  if (thrown && !(shieldToss && landingToken) && !wga && followup?.kind !== "return") await dropItem(actor, item, landingToken);
  return result;
}

/* -------------------------------------------- */
/*  Dropped items (thrown weapons)              */
/* -------------------------------------------- */

/** Top-left pixel position one space from `near`, on the side facing `from` (or beside it). */
function landingPosition(near, from) {
  const gs = canvas.grid.size;
  const d = near.document;
  const w = (d.width ?? 1) * gs, h = (d.height ?? 1) * gs;
  let dx = 1, dy = 0;
  if (from) {
    dx = Math.sign(from.center.x - near.center.x);
    dy = Math.sign(from.center.y - near.center.y);
    if (!dx && !dy) dx = 1;
  }
  return {
    x: dx > 0 ? d.x + w : dx < 0 ? d.x - gs : d.x,
    y: dy > 0 ? d.y + h : dy < 0 ? d.y - gs : d.y
  };
}

/**
 * Remove an item from an actor and place it on the map as a pile, beside `nearToken`
 * (or beside the actor's own token). If there's no token on the scene, the item just stays unequipped.
 */
export async function dropItem(actor, item, nearToken = null, { thrown = true } = {}) {
  // Natural weapons and armor are part of a Summon or Animation: never dropped. One that returns comes straight back after a throw.
  if (item.system?.returning && thrown && !item.system.natural) return false;            // returns to its user when thrown (Geomancy Combos)
  if (item.system?.natural) {
    if (!thrown) ui.notifications.warn(`${item.name} is natural: it can't be dropped.`);
    return false;
  }
  const source = attackerToken(actor);
  const anchor = nearToken ?? source;
  if (!anchor || !canvas?.scene) {
    if (!thrown) { ui.notifications.warn(`${actor.name} has no token on this scene, so there's nowhere to drop ${item.name}.`); return false; }
    await item.update({ "system.equipped": false, "system.twoHanded": false }, { flowstateAuto: true });
    ui.notifications.info(`${item.name} was thrown, but there's no token on this scene to place it by. It stays in the inventory, unequipped.`);
    return false;
  }
  const pos = landingPosition(anchor, nearToken ? source : null);
  const data = item.toObject();
  delete data._id;
  foundry.utils.mergeObject(data, { system: { equipped: false, twoHanded: false, secondHand: false, attuned: false } });
  await item.delete({ flowstateTransfer: true });
  await requestGM("createPile", { sceneId: canvas.scene.id, x: pos.x, y: pos.y, item: data });
  return true;
}

/**
 * The delete button: choose to drop the item beside your token (free) or delete it for good.
 * Worn armor can't be dropped in combat (taking it off follows the armor rules).
 */
export async function dropOrDelete(actor, item) {
  const worn = item.type === "armor" && item.system.equipped;
  const canDelete = game.user.isGM || actor.system.creation;
  const choice = await DialogV2().wait({
    window: { title: `${item.name}` },
    content: `<p>Drop <strong>${esc(item.name)}</strong> on the ground beside ${esc(actor.name)}${canDelete ? ", or delete it permanently" : ""}?</p>
      ${canDelete ? "" : `<p class="hint">Only the GM can delete items.</p>`}
      ${item.type === "weapon" && item.system.equipped ? `<p class="hint">Dropping a held weapon is free, even in combat.</p>` : ""}`,
    buttons: [
      { action: "drop", label: "Drop", icon: "fa-solid fa-arrow-down", default: true },
      ...(canDelete ? [{ action: "delete", label: "Delete", icon: "fa-solid fa-trash" }] : []),
      { action: "cancel", label: "Cancel", icon: "fa-solid fa-xmark" }
    ],
    rejectClose: false
  });
  if (choice === "delete" && canDelete) return item.delete();
  if (choice !== "drop") return;
  if (worn && inActiveCombat(actor)) return ui.notifications.warn(`Take ${item.name} off before dropping it (armor can't be dropped mid-combat).`);
  if (await dropItem(actor, item, null, { thrown: false })) ui.notifications.info(`${actor.name} drops ${item.name}.`);
}

/** Run a GM-only operation: directly if we are the GM, otherwise over the system socket. */
export async function requestGM(action, payload) {
  if (game.user.isGM) return GM_ACTIONS[action]?.(payload);
  if (!game.users.activeGM) return ui.notifications.error("A GM must be connected for that.");
  game.socket.emit("system.flowstate", { action, ...payload });
}

/** Folder that holds dropped-item piles in the Actors sidebar. */
async function pileFolder() {
  return game.folders.find(f => f.type === "Actor" && f.name === "Dropped Items")
    ?? Folder.create({ name: "Dropped Items", type: "Actor" });
}

export const GM_ACTIONS = {
  async applyDamage({ target, amount, type, pierce, parryItem, parryItems, silent, bash, bypass, rend, cleave, cleaveToCreature, shroudCtx, halfLimit, maxHpLoss, archetype, brandBy, ignoreArmor, fromHex, mentalDone, wardDone, wardReflect, reply }) {
    const actor = await fromUuid(target);
    const out = actor ? await applyDamage(actor, amount, type, { pierce, parryItem, parryItems, silent, bash, bypass, rend, cleave, cleaveToCreature, shroudCtx, halfLimit, maxHpLoss, archetype, brandBy, ignoreArmor, fromHex, mentalDone, wardDone, wardReflect }) : null;
    if (reply) game.socket.emit("system.flowstate", { action: "damageResult", to: reply.to, reqId: reply.reqId, result: summarizeDamage(out) });
    return out;
  },
  /** A Ward's owner (the GM's client, for someone else's character) is asked to negate damage the attacker's client is about to settle. */
  async wardNegate({ target, amount, type, source, attacker, reply }) {
    const actor = await fromUuid(target);
    const r = actor && mentalHook?.negate ? await mentalHook.negate(actor, amount, type, { source, attacker }) : null;
    const result = r ? { amount: r.amount, html: r.html ?? "", reflect: r.reflect ?? null } : null;
    if (reply) game.socket.emit("system.flowstate", { action: "damageResult", to: reply.to, reqId: reply.reqId, result });
    return result;
  },
  async updateActor({ uuid, data }) {
    const actor = await fromUuid(uuid);
    if (actor) await actor.update(data);
  },
  async updateItem({ uuid, data }) {
    const item = await fromUuid(uuid);
    if (item) await item.update(data, { flowstateSystem: true });
  },
  /** Change a spell that is mid cast (its attack card): its Power and dice (Amplify), or the health it has left. */
  async castChange({ id, power, damage, hpLeft }) {
    const m = game.messages.get(id);
    if (!m) return;
    const upd = {};
    if (power !== undefined) { upd["flags.flowstate.attack.opts.spell.power"] = power; upd["flags.flowstate.attack.opts.spell.amplified"] = true; }
    if (damage !== undefined) upd["flags.flowstate.attack.opts.damage"] = damage;
    if (hpLeft !== undefined) upd["flags.flowstate.attack.opts.spell.hpLeft"] = hpLeft;
    await m.update(upd);
  },
  async moveToken({ uuid, x, y }) {
    const doc = await fromUuid(uuid);
    if (doc) await doc.update({ x, y }, { flowstateThrow: true });
  },
  async setActorFlag({ target, key, value }) {
    const actor = await fromUuid(target);
    if (actor) await setActorFlag(actor, key, value);
  },
  async setStatus({ target, status, active }) {
    const actor = await fromUuid(target);
    if (actor) await setStatus(actor, status, active);
  },
  async wearItem({ uuid, amount }) {
    const item = await fromUuid(uuid);
    if (item) await item.update({ "system.wear": item.system.wear + amount }, { flowstateSystem: true });
  },
  async barrier({ sceneId, id, hp }) { await areas.setBarrierHealth(sceneId, id, hp); },
  async createWalls({ sceneId, walls }) { await areas.createBarrierWalls(sceneId, walls); },
  async flipBarrier({ sceneId, templateId }) { await areas.flipBarrier(sceneId, templateId); },
  async changeEffect({ uuid, data }) {
    const e = await fromUuid(uuid);
    if (e) await (data ? e.update(data) : e.delete());
  },
  async spellEffect({ target, effect }) {
    const actor = await fromUuid(target);
    if (actor) await applySpellEffect(actor, effect);
  },
  async setGrapple({ target, grappler }) {
    const actor = await fromUuid(target);
    if (actor) await setGrapple(actor, grappler);
  },
  async loadItem({ uuid }) {
    const item = await fromUuid(uuid);
    if (item?.parent) await loadWeapon(item.parent, item);
  },
  async dropItem({ actor, item, near }) {
    const a = await fromUuid(actor), i = await fromUuid(item), n = near ? await fromUuid(near) : null;
    if (a && i && i.parent?.uuid === a.uuid) await dropItem(a, i, n?.object ?? n?.getActiveTokens?.()[0] ?? null);
  },
  async createPile({ sceneId, x, y, item }) {
    const scene = game.scenes.get(sceneId);
    if (!scene) return;
    const folder = await pileFolder();
    const pile = await Actor.create({
      name: item.name, type: "pile", img: item.img, folder: folder?.id,
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
      prototypeToken: {
        name: item.name, actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL,
        displayName: CONST.TOKEN_DISPLAY_MODES.HOVER, texture: { src: item.img, scaleX: 0.6, scaleY: 0.6 }
      },
      items: [item]
    });
    const token = await pile.getTokenDocument({ x, y });
    await scene.createEmbeddedDocuments("Token", [token.toObject()]);
  },
  async deletePile({ actorId }) {
    const pile = game.actors.get(actorId);
    if (!pile || pile.type !== "pile") return;
    for (const scene of game.scenes) {
      const ids = scene.tokens.filter(t => t.actorId === actorId).map(t => t.id);
      if (ids.length) await scene.deleteEmbeddedDocuments("Token", ids);
    }
    await pile.delete();
  }
};

/** Hands occupied by held weapons (Unarmed: one per raised fist). */
function handsHeld(actor) {
  return actor.items.reduce((n, i) => {
    if (i.type !== "weapon" && i.type !== "foci") return n;
    const w = i.system;
    if (w.weaponType === "unarmed") return n + (w.equipped ? 1 : 0) + (w.secondHand ? 1 : 0);
    return n + (w.equipped ? (w.twoHanded ? 2 : 1) : 0);
  }, 0);
}

/**
 * Pick an item up from a pile onto the user's selected token (or assigned character).
 * Must be within reach when range enforcement is on. In combat it costs 1 AP on your turn.
 * Weapons can be equipped immediately at no extra cost, putting away a held item of your choice if hands are full.
 */
export async function pickUp(pile, item) {
  const taker = canvas?.tokens?.controlled?.find(t => t.actor && t.actor.type !== "pile")?.actor ?? game.user.character;
  if (!taker) return ui.notifications.warn("Select your token first, then pick the item up.");
  if (!taker.isOwner) return ui.notifications.warn(`You don't control ${taker.name}.`);
  if (cantAct(taker, "pick things up")) return;
  await triggerMark(taker, `picks up ${item.name}`);
  if (game.settings.get("flowstate", "enforceRange")) {
    const from = attackerToken(taker);
    const at = pile.getActiveTokens?.()[0];
    const reach = taker.system.derived?.size.melee ?? 5;
    if (from && at && tokenDistance(from, at) > reach) return ui.notifications.warn(`${taker.name} needs to be within ${reach} ft to pick that up.`);
  }

  // Martial Theory T4 (Improvise): improvised weapons aren't used; they're real weapons now.
  if (isImprovised(item) && theoryTier(taker) >= 4) {
    return ui.notifications.warn(`${taker.name} has Improvise (Martial Theory Tier 4) and doesn't carry improvised weapons. Ask the GM to forge it as its closest real weapon.`);
  }

  // In combat: 1 AP, on your own turn.
  const inCombat = inActiveCombat(taker);
  if (inCombat) {
    if (game.combat.combatant?.actor?.uuid !== taker.uuid) return ui.notifications.warn(`${taker.name} can only pick things up on their own turn (1 AP).`);
    if (taker.system.ap.value < 1) return ui.notifications.warn(`${taker.name} needs 1 AP to pick up ${item.name}.`);
  }

  // Ask: keep it stowed, or equip it now (no extra AP), choosing what to put away if hands are full.
  const isWeapon = item.type === "weapon";
  let equip = false, replace = "";
  const cost = inCombat ? ` for <strong>1 AP</strong> (${taker.name} has ${taker.system.ap.value})` : "";
  if (isWeapon) {
    const free = 2 - handsHeld(taker);
    const held = taker.items.filter(i => i.type === "weapon" && i.system.weaponType !== "unarmed" && i.system.equipped);
    const fists = taker.items.find(i => i.type === "weapon" && i.system.weaponType === "unarmed" && (i.system.equipped || i.system.secondHand));
    const options = [
      ...held.map(i => `<option value="${i.id}">Put away ${esc(i.name)}${i.system.twoHanded ? " (two-handed)" : ""}</option>`),
      ...(fists ? [`<option value="fist">Lower a fist</option>`] : [])
    ];
    const replaceField = free < 1 && options.length
      ? `<div class="form-group"><label>Hands are full — to make room</label><select name="replace">${options.join("")}</select></div>` : "";
    const opts = await optionsDialog(`Pick up ${item.name}`, `
      <p>Pick up <strong>${esc(item.name)}</strong>${cost}.</p>
      <div class="form-group"><label>Then</label><select name="equip">
        <option value="no">Keep it stowed</option>
        <option value="yes">Equip it (no extra AP)</option>
      </select></div>${replaceField}`, "Pick up");
    if (!opts) return;
    equip = opts.equip === "yes";
    replace = opts.replace ?? "";
  } else if (inCombat) {
    const ok = await DialogV2().confirm({ window: { title: `Pick up ${item.name}` }, content: `<p>Pick up <strong>${esc(item.name)}</strong>${cost}?</p>`, rejectClose: false });
    if (!ok) return;
  }

  if (inCombat && !(await spendAP(taker, 1, `picking up ${item.name}`))) return;

  const data = item.toObject();
  delete data._id;
  foundry.utils.mergeObject(data, { system: { equipped: false, twoHanded: false, secondHand: false, attuned: false } });
  const [created] = await taker.createEmbeddedDocuments("Item", [data], { flowstateTransfer: true });
  await item.delete({ flowstateTransfer: true });

  if (equip && created) {
    // Make room first, then equip. Both are part of the pick-up, so no draw cost is charged.
    const quiet = { flowstateAuto: true, flowstateConfirmed: true };
    if (replace === "fist") {
      const fists = taker.items.find(i => i.type === "weapon" && i.system.weaponType === "unarmed");
      await fists?.update(fists.system.secondHand ? { "system.secondHand": false } : { "system.equipped": false }, quiet);
    } else if (replace) {
      await taker.items.get(replace)?.update({ "system.equipped": false, "system.twoHanded": false }, quiet);
    }
    await created.update({ "system.equipped": true }, quiet);
  }
  ui.notifications.info(`${taker.name} picks up ${item.name}${equip ? " and equips it" : ""}.`);
  if (!pile.items.size) await requestGM("deletePile", { actorId: pile.id });
}

/** Options carried through the exchange (serializable into chat message flags). */
const EXCHANGE_KEYS = ["label", "type", "damage", "stacks", "physical", "shots", "critStacks", "vsSupernatural",
  "arcaneVsMagic", "pierce", "knockback", "knockbackAdd", "push", "stealth", "melee", "area", "grapple", "grappleOnly",
  "breakFree", "thrasherThrown", "mental", "throwGrappled", "throwForce", "itemUuid", "unarmedWeight", "setKind", "flowChain", "dragonLash", "kickOut", "redirectOf", "bash", "deflectOf", "aimItem", "aimName", "knockInto", "knockbackOf", "swift", "turnKey", "leadBlind", "net", "rend", "swordBoard", "shieldToss", "bounceOf", "crunch", "launchForce", "harden", "dodgeNet", "letItRip", "pointBlank", "reachItem", "palisadeFrom", "thrasherGrapple", "getOverHere", "disarm", "omnislash", "fishy", "sliceSlow", "snipe", "overshield", "inABarrel", "curved", "momentumItem", "slamGrappled", "cleave", "striker", "shroudCounterOf", "inflict", "attackType", "spell", "swiftLight", "omega", "rider", "muddy", "magicStealth", "apCost", "dieOf", "dieOverride"];

/**
 * Ch8 attack. With targets, starts a step-by-step exchange:
 *   1. Attack card (attack roll per target) → the defender clicks Dodge or Take the hit.
 *   2. Defense card (dodge + outcome) → on a hit, the attacker clicks Roll Damage.
 *   3. Damage card → damage is applied automatically (armor soak included).
 * Full stealth skips step 1's choice (targets can't react). Without targets, rolls everything at once.
 */
export async function performAttack(actor, opts) {
  // Taunt (Constitution T2): note when a Taunted creature attacks someone else.
  const taunt = actor.getFlag?.("flowstate", "tauntedBy");
  if (taunt) {
    const tgts = (opts.targetActors ?? [...(game.user?.targets ?? [])].map(t => t.actor)).filter(Boolean);
    if (tgts.length && !tgts.some(a => a.uuid === taunt.by)) opts = { ...opts, notes: [...(opts.notes ?? []), `Taunted by ${taunt.name}: compelled to attack them`] };
  }
  // Rapid T3 Mark: attacking while Marked lets the marker shoot first (Lead Blindness gives this attack Disadvantage).
  if (await triggerMark(actor, `attacks (${opts.label || "Attack"})`)) {
    opts = { ...opts, net: (opts.net ?? 0) - 1, notes: [...(opts.notes ?? []), "Lead Blindness (Marked): Disadvantage"] };
  }
  const picked = (opts.targetActors ?? [...game.user.targets].map(t => t.actor)).filter(a => a && (a.type !== "pile" || objectOf(a)));
  // An object on the ground (a pile holding a Non-Archetypal object) is attacked on its own: it always hits.
  if (picked.length === 1 && objectOf(picked[0])) return attackObject(actor, opts, picked[0], objectOf(picked[0]));
  const targets = picked.filter(a => a.type !== "pile");
  if (targets.length) return startExchange(actor, opts, targets);
  return untargetedAttack(actor, opts);
}

/** The Non-Archetypal object a pile is (its first gear item with a Body), or null. */
export const objectOf = actor => (actor?.type === "pile" ? (actor.items?.find?.(i => i.type === "gear" && i.system?.body > 0) ?? null) : null);

/**
 * Attacking an object (Rules, Ch8/Ch10): it automatically hits, the attack roll only decides a crit (at or above its Body, or Grade × 10 without one),
 * and the damage goes straight to its Durability: its Limit is ignored because it is the target. Down to 0 it is broken; at its negative max, destroyed.
 */
async function attackObject(actor, opts, target, item) {
  const d = actor.system.derived;
  const shots = Math.max(1, opts.shots ?? 1);
  const baseNet = opts.net + exhaustionNet(actor) + attackStanceNet(actor) + limberNet(actor);
  await consumeLimber(actor);
  const atk = await evaluate(poolFormula(1, d.attackDie, baseNet));
  const crit = objectCrit(atk.total, item.system.body, item.system.grade ?? 1);
  const rolls = [atk];
  let body = "";
  if (opts.damage?.trim() && opts.damage.trim() !== "0" && !opts.push) {
    const base = await rollBaseDamage(opts.damage, shots);
    if (!base) return;
    rolls.push(...base.rolls);
    let net = opts.stacks ?? 0;
    if (crit) net += 2 + (opts.critStacks ?? 0);
    if (opts.physical && d.size.physical) net += d.size.physical;
    if (opts.rend) net += opts.rend.stacks;
    const line = damageLine(base.totals, net, opts.type, shots);
    const amount = line.final + (opts.cleave ?? 0);
    const before = item.system.durability.value, max = item.system.durability.max;
    if (item.isOwner) await item.update({ "system.wear": item.system.wear + amount }); else await requestGM("wearItem", { uuid: item.uuid, amount });
    const left = before - amount;
    body = `${await baseDamageHTML(base, opts.type)}${line.html}
      <div class="fs-result fs-damage-taken">${esc(item.name)} takes ${amount}</div>
      <ul class="fs-list"><li>−${amount} Durability (${Math.max(left, -max)}/${max}); its Limit (${item.system.objectLimit}) doesn't apply to a direct attack</li>${left <= -max ? `<li>${esc(item.name)} is destroyed</li>` : left <= 0 ? `<li>${esc(item.name)} is broken</li>` : ""}</ul>`;
  }
  await post(actor, { title: `${esc(opts.label || "Attack")} — ${esc(item.name)}`, rolls,
    body: `<div class="fs-notes">${(opts.notes ?? []).join(" · ")}</div>${await rollBlock(atk, `Attack (d${d.attackDie})`)}
      <div class="fs-outcome fs-${crit ? "crit" : "hit"}">${crit ? `Critical Hit (${atk.total} ≥ ${item.system.body > 0 ? `Body ${item.system.body}` : `Grade × 10`})` : "Hit"}</div>
      <div class="fs-notes">An object always hits; the roll only decides a crit (Body ${item.system.body}).</div>${body}` });
}

/** No targets: attack roll plus base damage (with non-target stacks) for manual resolution. */
async function untargetedAttack(actor, opts) {
  const d = actor.system.derived;
  const rolls = [];
  const shots = Math.max(1, opts.shots ?? 1);

  let base = null;
  if (!opts.push && opts.damage?.trim() && opts.damage.trim() !== "0") {
    base = await rollBaseDamage(opts.damage, shots);
    if (!base) return;
    rolls.push(...base.rolls);
  }
  const baseNet = opts.net + exhaustionNet(actor) + (opts.stealth === "half" ? 1 : 0) + attackStanceNet(actor) + limberNet(actor) + (mentalHook?.burdenNet(actor, "attackDis") ?? 0);
  await consumeLimber(actor);
  const atk = await evaluate(poolFormula(1, d.attackDie, baseNet));
  rolls.unshift(atk);
  const uc = await mentalHook?.rollCharges?.({ actor, type: "attack", roll: atk, die: d.attackDie, count: 1, net: baseNet, max: d.attackDie, label: opts.label });
  if (uc) rolls.push(...uc.rolls);

  let dmgHTML = "";
  if (base) {
    const parts = [];
    let net = opts.stacks ?? 0;
    if (net) parts.push(`${signed(net)} weapon/manual`);
    if (opts.dragonLash) { net += 1; parts.push("+1 Dragon Lash (+2 if the target is prone)"); }
    if (opts.physical && d.size.physical) { net += d.size.physical; parts.push(`${signed(d.size.physical)} size`); }
    const hit = damageLine(base.totals, net, opts.type, shots);
    const critNet = net + 2 + (opts.critStacks ?? 0);
    const crit = damageLine(base.totals, critNet, opts.type, shots);
    dmgHTML = `${await baseDamageHTML(base, opts.type)}${hit.html}${parts.length ? `<div class="fs-notes">Stacks: ${parts.join(", ")}</div>` : ""}
      <div class="fs-notes">On a crit (attack ≥ 2× dodge): <strong>${crit.final}</strong> · ${stackLabel(critNet)}</div>`;
  }
  const header = opts.notes?.length ? `<div class="fs-notes">${opts.notes.join(" · ")}</div>` : "";
  await post(actor, {
    title: esc(opts.label || "Attack"),
    rolls,
    body: `${header}${await rollBlock(atk, `Attack (d${d.attackDie})`)}
      ${netNote(baseNet, attackNetParts(actor, opts))}
      ${(uc?.notes ?? []).map(n => `<div class="fs-notes fs-charge-note"><i class="fa-solid fa-link"></i> ${n}</div>`).join("")}
      ${dmgHTML}
      <p class="hint">No targets selected — compare against a dodge manually. Target modifiers (Arcane, Supernatural) aren't included.</p>
      ${followupsPending(opts)}`,
    flags: { flowstate: { followupOf: opts.followupOf ?? null, followups: followupsFlag(actor, opts) } }
  });
}

async function rollBaseDamage(formula, shots) {
  try {
    const rolls = [];
    for (let i = 0; i < shots; i++) rolls.push(await evaluate(formula.trim()));
    return { rolls, totals: rolls.map(r => r.total) };
  } catch (err) {
    ui.notifications.error(`Invalid damage formula: ${formula}`);
    return null;
  }
}

async function baseDamageHTML(base, type) {
  const shots = base.rolls.length;
  return (await Promise.all(base.rolls.map((r, i) =>
    rollBlock(r, `Base damage${shots > 1 ? ` (shot ${i + 1})` : ""} · ${DAMAGE_TYPES[type]}`)))).join("");
}

/** Follow-up buttons (posted on their own card once the exchange is resolved). `source` is the attack message they follow. */
function followupsHTML(actorUuid, list, source) {
  if (!list?.length) return "";
  return `<div class="fs-followups" data-role="attacker" data-owner="${actorUuid}">${list.map(f =>
    `<button type="button" class="fs-followup" data-actor="${actorUuid}" data-item="${f.itemId}" data-net="${f.net}" data-weight="${f.weight ?? ""}" data-label="${esc(f.label)}"
       data-kind="${f.kind ?? ""}" data-whirlwind="${f.whirlwind ?? ""}" data-perfect="${f.perfect ? "1" : ""}" data-source="${f.kind === "return" ? `${source}:return` : source}"
       data-twin-fang="${f.twinFang ? "1" : ""}" data-flow-chain="${f.flowChain ? "1" : ""}" data-quick-strike="${f.quickStrike ? "1" : ""}" data-attack-type="${f.attackType ?? ""}">
     <i class="fa-solid fa-forward"></i> ${esc(f.label)}</button>`).join("")}</div>`;
}

/** Note on an attack card that has follow-ups waiting. */
const followupsPending = opts => (opts.followups?.length
  ? `<div class="fs-notes fs-followups-pending"><i class="fa-solid fa-forward"></i> Follow-up available once this exchange is resolved.</div>` : "");

/** What the attack card stores so the follow-up card can be posted later. */
const followupsFlag = (actor, opts) => (opts.followups?.length ? { actor: actor.uuid, list: opts.followups } : null);

/* ---- Step 1: attack card ---- */

async function startExchange(actor, opts, targets) {
  const d = actor.system.derived;
  const baseNet = opts.net + exhaustionNet(actor) + (opts.stealth === "half" ? 1 : 0) + attackStanceNet(actor) + limberNet(actor) + (mentalHook?.burdenNet(actor, "attackDis") ?? 0);
  await consumeLimber(actor);
  const disrupted = disruptNet(actor);
  const rolls = [];
  const entries = [];
  const sections = [];

  let sharedRoll = null;
  for (const [index, target] of targets.entries()) {
    const prone = target.statuses.has("prone");
    // Psych Up: attacks against you have Advantage.
    // In a Barrel (Longshot T4): Advantage against a target with any movement penalty.
    const barrel = opts.inABarrel && movementPenalized(target) ? 1 : 0;
    let atkNet = baseNet - (spellStealthImmune(opts, target) ? 1 : 0) + (opts.melee && prone ? 1 : 0) + (psyched(target) ? 1 : 0) + barrel + disruptNet(actor) + shroudAttackNet(actor, target, opts) + charmNet(actor, "attack") + (opts.spell ? magicDisNet(actor) : 0)
      - (autoDash(target, opts) ? 1 : 0);
    const spellNotes = [];
    const burdenAtk = mentalHook?.burdenNet(actor, "attackDis") ?? 0;
    if (burdenAtk) spellNotes.push(`Burden ×${-burdenAtk}: ${-burdenAtk} Disadvantage on the attack`);
    // Personal Repulsion / Personal Well (Gravity T3): attacks with a small Scaling Stat get Disadvantage / Advantage.
    for (const e of spellEffects(target, "field")) {
      const f = e.flags.flowstate.spellEffect;
      if (attackScaling(actor, opts) <= f.threshold) { const step = f.mode === "well" ? 1 : -1; atkNet += step; spellNotes.push(`${f.mode === "well" ? "Personal Well" : "Personal Repulsion"}: ${step > 0 ? "Advantage" : "Disadvantage"}`); }
    }
    // Setup (Piercing T4): Advantage on your next attack roll at the target the spell damaged.
    const setup = actor.getFlag?.("flowstate", "setup");
    if ((setup?.target === target.uuid || setup?.target === "any") && setup.count > 0) {
      atkNet += setup.count; spellNotes.push(`Setup: +${setup.count} Advantage`);
      await setActorFlag(actor, "setup", null);
    }
    // Foresight (Grasp Arcana T1): Advantage if the target has Disadvantage on their dodge. Convince (Charm T3): Advantage on a target already Charmed by you.
    const sm = opts.spell?.mods ?? {};
    if (sm.foresight && dodgeNetKnown(target) < 0) { atkNet += 1; spellNotes.push("Foresight: Advantage (they have Disadvantage on dodge rolls)"); }
    if (foci && opts.spell?.fociFx) { const fa = foci.attackNet({ attacker: actor, target, o: opts }); if (fa.net) { atkNet += fa.net; spellNotes.push(...fa.notes); } else spellNotes.push(...fa.notes); }
    if (opts.spell && fx.profileFor(opts.spell.cores)?.strike && target.system.magical) { atkNet += 1; spellNotes.push("Strike: Advantage against a fully magical target"); }
    if (sm.convince && aff?.charmedBy(target, actor.uuid)) { atkNet += 1; spellNotes.push("Convince: Advantage (already Charmed by you)"); }
    // Sticky (Acid T4): Advantage against a target with Stain stacks equal to or above their Pain Threshold.
    if (opts.spell?.mods?.sticky && stainTotal(target.system.conditions ?? {}) >= (target.system.hp?.pain ?? Infinity)) { atkNet += 1; spellNotes.push("Sticky: Advantage (Stained)"); }
    // Exploit (Piercing T2): each stack consumes one Advantage for +4 die size (× Spell Power); stacks with no Advantage left are refunded.
    // A stolen action (Larceny, Enhanced) is rolled with the original attacker's dice.
    const dice = opts.dieOf ? (globalThis.fromUuidSync?.(opts.dieOf)?.system?.derived ?? d) : d;
    let atkDie = opts.dieOverride ?? dice.attackDie;
    const ex = opts.spell?.exploit;
    if (ex?.stacks) {
      const used = Math.min(ex.stacks, Math.max(0, atkNet));
      const unused = ex.stacks - used;
      atkNet -= used; atkDie += used * ex.die;
      spellNotes.push(`Exploit: ${used} Advantage consumed for +${used * ex.die} die size (d${atkDie})`);
      if (unused) {
        const back = ex.refund?.[unused] ?? 0;
        await refundEnergy(actor, back);
        spellNotes.push(`${unused} Exploit stack${unused === 1 ? "" : "s"} had no Advantage to use${back ? `: ${back} Energy refunded` : ""}`);
      }
    }
    // An Area spell makes one attack roll that every target in the area defends against.
    const shared = (opts.spell?.singleRoll || opts.singleRoll) && sharedRoll;
    const atk = shared || await evaluate(poolFormula(1, atkDie, atkNet));
    if (!shared) rolls.push(atk);
    const chargeNotes = [];
    if (!shared && mentalHook?.rollCharges) {
      const rc = await mentalHook.rollCharges({ actor, type: "attack", roll: atk, die: atkDie, count: 1, net: atkNet, max: atkDie, label: opts.label, targetActor: target,
        attackOpts: foundry.utils.deepClone(Object.fromEntries(EXCHANGE_KEYS.map(k => [k, opts[k]]))) });
      if (rc) { rolls.push(...rc.rolls); chargeNotes.push(...rc.notes); }
    }
    if (opts.spell?.singleRoll || opts.singleRoll) { sharedRoll = atk; if (shared) spellNotes.push("Area: the single attack roll above"); }
    entries.push({ uuid: target.uuid, name: target.name, total: atk.total, net: atkNet, die: atkDie, snipe: opts.snipe ? Math.max(0, atkNet) : 0,
      autoDash: autoDash(target, opts) });
    // Parry is a stance now (turned on during your turn); here only the optional rolls remain.
    // Overshield Strike (Thrasher T3): no Parry-type effects at all.
    const noParry = !!opts.overshield;
    const blockable = !noParry && !opts.area && !opts.breakFree && !opts.throwGrappled;
    const g = blockable ? guardFor(target, opts) : { items: [] };
    const canPerfectParry = g.items.some(u => { const it = syncUuid(u); return it && ab.curved(target, it, 2); });
    const canPerfectBlock = blockable && ab.defenderHeld(target, 5).length > 0;
    const blockers = blockable ? blockersFor(actor, target) : [];
    const guardNote = blockable && g.any ? `<div class="fs-notes"><i class="fa-solid fa-shield"></i> ${esc(target.name)} is guarding: ${[
      ...g.items.map(u => syncUuid(u)?.name).filter(Boolean), ...g.reductions.map(r => `${r.label} −${r.amount}`), ...(g.shatter ? ["Shatter"] : []), ...g.weaken].join(", ")}</div>` : "";
    // Assault T3 Distracting Fire: against a non-targeted (Area) attack, with an Assault weapon in range.
    const distract = opts.area && !opts.breakFree ? distractWeapons(target, actor) : [];
    const shiftI = ab.shiftInfo(target);
    const canShift = !!shiftI;
    // Bladed T2 Close Quarters: when attacked in melee while holding a Bladed weapon, the attack is made at double Disadvantage.
    const cq = opts.melee ? ab.bladedHeld(target, 2) : [];
    // Unarmored T1 Dash as a reaction: Disadvantage on the incoming attack (re-rolled), then move.
    const dashR = ab.dashInfo(target)?.reaction && !autoDash(target, opts) ? ab.dashInfo(target) : null;
    const cqCost = cq.length ? Math.min(...cq.map(ab.BLADED_COST.closeQuarters)) : 0;

    const react = opts.omnislash ? `<div class="fs-notes">Omnislash — ${esc(target.name)} can't react.</div>` : opts.stealth === "full" || helpless(target)
      ? `<div class="fs-notes">${helpless(target) ? `${esc(target.name)} is ${target.statuses.has("dead") ? "dead" : "unconscious"}: attacked as if from full stealth` : "Full stealth"} — ${esc(target.name)} can't react.</div>`
      : `<div class="fs-exchange-buttons" data-role="defender" data-owner="${target.uuid}">
           <button type="button" class="fs-defend" data-choice="dodge" data-index="${index}"><i class="fa-solid fa-person-running"></i> Dodge (2d${target.system.derived.dodgeDie})</button>
           ${canPerfectParry ? `<button type="button" class="fs-defend fs-perfect" data-choice="perfectParry" data-index="${index}" data-tooltip="Curved T2: roll with Advantage against this attack; on a success it's negated, on a miss your Curved weapon doesn't apply to it (you still respond)"><i class="fa-solid fa-moon"></i> Perfect Parry</button>` : ""}
           ${canPerfectBlock ? `<button type="button" class="fs-defend fs-perfect" data-choice="perfectBlock" data-index="${index}" data-tooltip="Defender T5: roll against this attack; on a success it's negated, on a miss your shield doesn't apply to it (you still respond)"><i class="fa-solid fa-shield-halved"></i> Perfect Block</button>` : ""}
           ${dashR ? `<button type="button" class="fs-defend fs-dash" data-choice="dash" data-index="${index}" data-tooltip="Unarmored T1: this attack is re-rolled with Disadvantage, and you move after it resolves"><i class="fa-solid fa-person-running"></i> Dash (${dashR.cost ? `⚡ ${dashR.cost}` : "free"}; move after: 1 RP)</button>` : ""}
           ${distract.length ? `<button type="button" class="fs-defend fs-distract" data-choice="distract" data-index="${index}" data-tooltip="Assault T3: attack roll against this attack; on a hit it's re-rolled with Disadvantage and Weakened"><i class="fa-solid fa-crosshairs"></i> Distracting Fire (⚡ ${Math.min(...distract.map(ab.ASSAULT_COST.distractingFire))})</button>` : ""}
           ${canShift ? `<button type="button" class="fs-defend fs-shift" data-choice="shift" data-index="${index}" data-tooltip="${shiftI.tree}: Advantage on your dodge, or Disadvantage on this attack (re-rolled); then respond${shiftI.uses > 1 ? ". Evade: twice" : ""}"><i class="fa-solid fa-arrows-left-right"></i> Shift (⚡ ${breathingFree(target, "shift", shiftI) ? 0 : shiftI.cost})</button>` : ""}
           ${cq.length ? `<button type="button" class="fs-defend fs-close-quarters" data-choice="closeQuarters" data-index="${index}" data-tooltip="Bladed T2: re-roll this attack at double Disadvantage, then respond"><i class="fa-solid fa-compress"></i> Close Quarters (⚡ ${cqCost})</button>` : ""}
           <button type="button" class="fs-defend" data-choice="none" data-index="${index}"><i class="fa-solid fa-shield-halved"></i> Take the hit</button>
         </div>`;
    // Allies who can help (Block, Shield Toss, Perfect Block, Quartz) share one button; the popup lets you pick who and how.
    const helpers = opts.stealth === "full" || helpless(target) ? [] : allyHelpers(actor, target, opts, blockers);
    const owners = [...new Set(helpers.map(h => h.actor.uuid))];
    const allyRow = helpers.length ? `<div class="fs-ally-row" data-owners="${owners.join(",")}">
        <button type="button" class="fs-ally-help" data-index="${index}" data-tooltip="${esc(helpers.map(h => h.label).join(" · "))}"><i class="fa-solid fa-people-group"></i> Ally help for ${esc(target.name)} (${owners.length} ${owners.length === 1 ? "ally" : "allies"})</button>
        <div class="fs-ally-status"></div></div>` : "";
    sections.push(`<section class="fs-target" data-index="${index}">
      <h4>vs ${esc(target.name)}${opts.aimName ? `'s ${esc(opts.aimName)}` : ""}</h4>
      ${await rollBlock(atk, `Attack (d${atkDie})`)}
      ${netNote(atkNet, attackNetParts(actor, opts, target))}
      ${spellNotes.map(n => `<div class="fs-notes">${esc(n)}</div>`).join("")}
      ${chargeNotes.map(n => `<div class="fs-notes fs-charge-note"><i class="fa-solid fa-link"></i> ${n}</div>`).join("")}
      ${guardNote}
      <div class="fs-status" data-index="${index}"></div>
      ${react}${allyRow}
    </section>`);
  }

  if (disrupted) await consumeDisrupt(actor);
  if (opts.omnislash && targets[0]) await setActorFlag(targets[0], `momentum.${actor.id}`, null);
  const headNotes = [...(opts.notes ?? []), disrupted ? "Disrupted (Disadvantage)" : ""].filter(Boolean);
  const header = headNotes.length ? `<div class="fs-notes">${headNotes.join(" · ")}</div>` : "";
  const attack = { attacker: actor.uuid, opts: foundry.utils.deepClone(Object.fromEntries(EXCHANGE_KEYS.map(k => [k, opts[k]]))), targets: entries };
  const msg = await post(actor, {
    title: esc(opts.label || "Attack"),
    rolls,
    body: `${header}${sections.join("")}${followupsPending(opts)}`,
    flags: { flowstate: { attack, followupOf: opts.followupOf ?? null, followups: followupsFlag(actor, opts) } }
  });

  // Full stealth (or a helpless target): resolve immediately (auto-hit; crit vs dodge die size).
  for (const [index, target] of targets.entries()) {
    if (opts.omnislash) {
      await postDefense(actor, msg, index, target, { hit: true, crit: true, doubleCrit: true, critStacks: 4, outcome: "Omnislash — Double Crit" }, null, "Omnislash: all Momentum spent");
      continue;
    }
    if (opts.stealth !== "full" && !helpless(target)) continue;
    const result = resolveFullStealth(entries[index].total, target.system.derived.dodgeDie);
    const why = helpless(target) ? `${target.statuses.has("dead") ? "Dead" : "Unconscious"} — attacked as if from full stealth` : "Full stealth";
    await postDefense(actor, msg, index, target, result, null, `${why} — crit on ≥ ${target.system.derived.dodgeDie}`);
  }
  return msg;
}

/**
 * Creatures that can Block (Defender T1) an attack on `target` for them: a held Defender weapon and the target within
 * that weapon's melee range, or a Shield Toss guard on the target (no range needed). Returns [{actor, perfect, guard}].
 */
function blockersFor(attacker, target) {
  const out = new Map();
  const guard = target.getFlag?.("flowstate", "shieldGuard");
  const tTok = target.getActiveTokens?.()[0];
  for (const tok of globalThis.canvas?.tokens?.placeables ?? []) {
    const a = tok.actor;
    if (!a || a.type === "pile" || a.uuid === target.uuid || a.uuid === attacker?.uuid || helpless(a) || out.has(a.uuid)) continue;
    const shields = ab.defenderHeld(a, 1);
    if (!shields.length) continue;
    // A Shield Toss guard Blocks on its own (see shieldGuardItem); the guard's owner can still Block normally when in reach.
    const isGuard = false;
    const reach = (a.system.derived?.size?.melee ?? 5) * Math.max(...shields.map(i => i.system.profile.farstrike ?? 1));
    const dist = tTok ? tokenDistance(tok, tTok) : Infinity;
    const perfect = ab.defenderHeld(a, 5).length > 0;
    if (isGuard || dist <= reach) { out.set(a.uuid, { actor: a, perfect, guard: isGuard }); continue; }
    // Shield Toss (Defender T2) as a guard: throw the shield to an ally in throw range, then Block for them (2 RP).
    const toss = tossShields(a).filter(i => dist <= (THROW[i.system.profile.throwType]?.range ?? 0));
    if (toss.length) out.set(a.uuid, { actor: a, perfect, guard: false, toss: true, cost: Math.min(...toss.map(ab.DEFENDER_COST.shieldToss)) });
  }
  return [...out.values()];
}

/** Every way allies can help this target against this attack: Block / Shield Toss / Perfect Block (Defender), Quartz (Shroud). */
export function allyHelpers(attacker, target, opts, blockers = null) {
  const out = [];
  const blockable = !opts.overshield && !opts.area && !opts.breakFree && !opts.throwGrappled;
  for (const b of blockers ?? (blockable ? blockersFor(attacker, target) : [])) {
    out.push({ actor: b.actor, kind: "block", toss: !!b.toss, perfect: false,
      label: b.toss ? `${b.actor.name}: Shield Toss to guard ${target.name} (2 RP · ⚡ ${b.cost})` : `${b.actor.name}: Block for ${target.name}${b.guard ? " (Shield Toss guard)" : ""}` });
    if (b.perfect) out.push({ actor: b.actor, kind: "block", toss: !!b.toss, perfect: true,
      label: `${b.actor.name}: ${b.toss ? "Shield Toss + Perfect Block" : "Perfect Block"} for ${target.name}` });
  }
  if (opts.damage && !opts.aimItem && shroudBlocks(opts.type ?? "physical")) {
    for (const a of quartzGuards(attacker, target)) out.push({ actor: a, kind: "quartz", label: `${a.name}: extend ${a.system.shroud.name} (Quartz) over ${target.name}` });
  }
  // Adjust (Protection Arcana T3): a Shield holder within 10 ft of the target can extend it over them.
  if (opts.damage || opts.push || opts.spell) for (const a of adjustGuards(attacker, target)) out.push({ actor: a, kind: "adjust", label: `${a.name}: extend their Shield (Adjust) over ${target.name}` });
  return out;
}

/** Creatures with an Adjust Shield on them, within 10 ft of the target (not the target or attacker). */
export function adjustGuards(attacker, target) {
  const out = [];
  const tTok = target.getActiveTokens?.()[0];
  for (const tok of globalThis.canvas?.tokens?.placeables ?? []) {
    const a = tok.actor;
    if (!a || a.type === "pile" || a.uuid === target.uuid || a.uuid === attacker?.uuid || helpless(a) || out.some(x => x.uuid === a.uuid)) continue;
    if (!spellEffects(a, "shield").some(e => e.flags.flowstate.spellEffect.adjust && e.flags.flowstate.spellEffect.hp > 0)) continue;
    if (tTok && tokenDistance(tok, tTok) <= 10) out.push(a);
  }
  return out;
}
export async function adjustFor(message, index, ownerUuid) {
  const entry = message.getFlag("flowstate", "attack")?.targets?.[index];
  if (!entry) return;
  if (findCancel(message.id)) return ui.notifications.info("That spell was countered before it landed.");
if (findDefense(message.id, index)) return ui.notifications.info(`${entry.name} has already responded.`);
  const owner = await fromUuid(ownerUuid);
  if (!owner?.isOwner) return ui.notifications.warn(`Only ${owner?.name ?? "its owner"}'s owner can extend that Shield.`);
  const eff = spellEffects(owner, "shield").find(e => e.flags.flowstate.spellEffect.adjust && e.flags.flowstate.spellEffect.hp > 0);
  if (!eff || findAdjust(message.id, index).includes(eff.uuid)) return;
  await post(owner, { title: `${esc(owner.name)} — Adjust`, body: `<div class="fs-result">${esc(owner.name)}'s Shield extends over ${esc(entry.name)} for this attack.</div>`,
    flags: { flowstate: { adjustFor: { attackMessage: message.id, index, effect: eff.uuid, owner: owner.uuid } } } });
}
export function findAdjust(attackMessageId, index) {
  return game.messages.filter(m => { const f = m.getFlag("flowstate", "adjustFor"); return f?.attackMessage === attackMessageId && f.index === index; })
    .map(m => m.getFlag("flowstate", "adjustFor").effect);
}

/** The "Ally help" button: pick which of your characters helps, and how. */
export async function allyHelp(message, index) {
  const attack = message.getFlag("flowstate", "attack");
  const entry = attack?.targets?.[index];
  if (!entry) return;
  if (findCancel(message.id)) return ui.notifications.info("That spell was countered before it landed.");
if (findDefense(message.id, index)) return ui.notifications.info(`${entry.name} has already responded.`);
  const attacker = await fromUuid(attack.attacker), target = await fromUuid(entry.uuid);
  if (!target) return;
  const blocking = new Set(findBlocksFor(message.id, index).map(b => b.blocker));
  const quartz = new Set(findQuartz(message.id, index));
  const adjusted = new Set(findAdjust(message.id, index));
  const options = allyHelpers(attacker, target, attack.opts).filter(h => h.actor.isOwner
    && !(h.kind === "block" && blocking.has(h.actor.uuid)) && !(h.kind === "quartz" && quartz.has(h.actor.system.shroud?.uuid))
    && !(h.kind === "adjust" && spellEffects(h.actor, "shield").some(e => adjusted.has(e.uuid))));
  if (!options.length) return ui.notifications.info(`None of your characters can help ${entry.name} right now.`);
  const opts = await optionsDialog(`Help ${entry.name}`, `<div class="form-group"><label>Who and how</label><select name="pick">
    ${options.map((h, i) => `<option value="${i}">${esc(h.label)}</option>`).join("")}</select></div>`, "Help");
  if (!opts) return;
  const h = options[Number(opts.pick)];
  if (!h) return;
  if (h.kind === "quartz") return quartzFor(message, index, h.actor.uuid);
  if (h.kind === "adjust") return adjustFor(message, index, h.actor.uuid);
  return blockFor(message, index, h.actor.uuid, h.perfect, h.toss);
}

/** The shield guarding this creature from a Shield Toss (Defender T2, "Block for the target"), if it's still usable. */
export function shieldGuardItem(target) {
  const sg = target?.getFlag?.("flowstate", "shieldGuard");
  if (!sg?.item) return null;
  const sh = syncUuid(sg.item);
  if (!sh || sh.parent?.uuid !== sg.blocker || sh.system?.broken) return null;
  return sh.uuid;
}

/** Held Defender weapons that can be thrown with Shield Toss (Defender T2). */
const tossShields = actor => ab.defenderHeld(actor, 2).filter(i => i.system.profile.throwType);

/** Held Assault weapons (T3) that can answer an Area attack with Distracting Fire: the attacker must be in range. */
function distractWeapons(target, attacker) {
  const weapons = ab.assaultHeld(target, 3);
  if (!weapons.length) return [];
  const tTok = target.getActiveTokens?.()[0], aTok = attacker ? attackerToken(attacker) : null;
  if (!tTok || !aTok || !globalThis.canvas?.grid) return weapons;
  const dist = tokenDistance(tTok, aTok);
  return weapons.filter(i => dist <= (i.system.profile.range ?? 0));
}

/* ---- Step 2: defender responds ---- */

/** Defender clicks Dodge or Take the hit on the attack card. */
export async function defend(message, index, choice) {
  const attack = message.getFlag("flowstate", "attack");
  let entry = attack?.targets?.[index];
  if (!entry) return;
  if (findCancel(message.id)) return ui.notifications.info("That spell was countered before it landed.");
if (findDefense(message.id, index)) return ui.notifications.info(`${entry.name} has already responded.`);
  const target = await fromUuid(entry.uuid);
  if (!target) return ui.notifications.warn("That target no longer exists.");
  if (!target.isOwner) return ui.notifications.warn(`Only ${entry.name}'s owner can respond.`);
  const o = attack.opts;
  if (choice === "closeQuarters") return closeQuarters(message, index, target, entry);
  // Close Quarters / Shift may have re-rolled this attack.
  entry = effectiveEntry(message.id, index, entry);

  if (choice === "none") {
    // Declining to dodge: the attack hits but can't crit (also how forced auto-hits like Parry will resolve).
    const result = { hit: true, crit: false, doubleCrit: false, critStacks: 0, outcome: "Hit (no dodge)" };
    return postDefense(target, message, index, target, result, null, "Took the hit without dodging — can't crit.");
  }

  if (choice === "perfectParry" || choice === "perfectBlock") return perfectRoll(message, index, target, entry, o, { kind: choice });
  if (choice === "distract") return distractingFire(message, index, target, entry, o);
  if (choice === "dash") return dashReaction(message, index, target, entry);
  if (choice === "shift") return shift(message, index, target, entry);

  // Sword and Board (Defender T3): the shield attack is resolved first; if it hit, this dodge has Disadvantage.
  let boardNet = 0;
  if (o.swordBoard) {
    const sm = game.messages.get(o.swordBoard);
    const si = sm?.getFlag("flowstate", "attack")?.targets?.findIndex(t => t.uuid === entry.uuid) ?? -1;
    if (si >= 0) {
      const sd = findDefense(sm.id, si);
      if (!sd) return ui.notifications.warn("Respond to the Sword and Board shield attack first.");
      if (sd.getFlag("flowstate", "defense").result.hit) boardNet = -1;
    }
  }
  // Point Blank (Blast T1): dodging a Blast attack from within the attacker's personal melee range has Disadvantage.
  let pointBlankNet = 0;
  if (o.pointBlank) {
    const att = await fromUuid(attack.attacker);
    const aTok = att ? attackerToken(att) : null, tTok = target.getActiveTokens?.()[0];
    if (aTok && tTok && globalThis.canvas?.grid && tokenDistance(aTok, tTok) <= (att.system.derived?.size?.melee ?? 5)) pointBlankNet = -1;
  }
  const t = target.system;
  const prone = target.statuses.has("prone");
  const opts = await optionsDialog(`${entry.name} — Dodge`, `
    <p class="hint">Incoming attack: <strong>${entry.total}</strong> · Dodge 2d${t.derived.dodgeDie}</p>${netField()}`, "Dodge", { skipIfEmpty: true });
  if (!opts) return;
  if (findDefense(message.id, index)) return;
  const armorDis = t.penalties.physicalDis;
  const shiftAdv = findShifts(message.id, index).filter(f => f.mode === "adv").length;
  const stealthImmune = spellStealthImmune(o, target);
  const net = opts.net + (o.stealth === "half" && !stealthImmune ? -1 : 0) + (prone ? -1 : 0) + (t.exhausted ? -1 : 0) - armorDis + (calmed(target) ? 1 : 0)
    + limberNet(target) + shiftAdv + leadBlindNet(o) + boardNet + seeingRedNet(target) + (o.dodgeNet ?? 0) + pointBlankNet - (entry.snipe ?? 0) + disruptNet(target) + unfetteredNet(target) + dodgeDisNet(target) + charmNet(target, "dodge");
  const reasons = [netLabel(net), o.stealth === "half" && !stealthImmune ? "attacker in half stealth" : "", prone ? "prone" : "", t.exhausted ? "exhausted" : "", armorDis ? "armor penalty" : "",
    calmed(target) ? "Calm Down" : "", limberNet(target) ? "Limber" : "", shiftAdv ? "Shift" : "", o.leadBlind ? "Lead Blindness" : "",
    boardNet ? "Sword and Board" : "", seeingRedNet(target) ? "Seeing Red" : "", o.dodgeNet ? "Shank" : "", pointBlankNet ? "Point Blank" : "", entry.snipe ? `Snipe Hunt (−${entry.snipe})` : "",
    disruptNet(target) ? "Disrupted" : "", unfetteredNet(target) ? "Unfettered" : "", dodgeDisNet(target) ? "spell: dodge Disadvantage" : "", charmNet(target, "dodge") ? "Charm/Hex: dodge Disadvantage" : ""].filter(Boolean);
  await consumeDisrupt(target);
  await consumeLimber(target);
  // Mental: a Waste charge shrinks this dodge (and may give it Disadvantage), Burden gives Disadvantage; the charge is used up.
  const waste = mentalHook?.dodgeWaste(target) ?? null;
  const burden = mentalHook?.burdenNet(target, "dodgeDis") ?? 0;
  const dieNow = Math.max(1, t.derived.dodgeDie - (waste?.pen ?? 0));
  const net2 = net + (waste?.net ?? 0) + burden;
  if (waste) reasons.push(waste.note);
  if (burden) reasons.push(`Burden ×${-burden}: ${-burden} Disadvantage on the dodge`);
  const dodge = await evaluate(poolFormula(2, dieNow, net2));
  if (waste) await mentalHook.useWaste(waste);
  // Mental: Order/Chaos charges on the dodge roll (Decree, Fracture, Larceny, Mandate), then on the answered attack (Balance, Verdict, Entropy).
  const chargeRolls = [], chargeNotes = [];
  const dc = await mentalHook?.rollCharges?.({ actor: target, type: "dodge", roll: dodge, die: dieNow, count: 2, net: net2, max: 2 * dieNow, label: o.label });
  if (dc) { chargeRolls.push(...dc.rolls); chargeNotes.push(...dc.notes); }
  let result = resolveAttack(entry.total, dodge.total);
  const attackerActor = await fromUuid(attack.attacker);
  const atkBox = { total: entry.total };
  const ar = await mentalHook?.resolveCharges?.({ attacker: attackerActor, target, atk: atkBox, dodge, result, attackDie: entry.die, o });
  if (ar) {
    result = { ...ar.result, ...(ar.dmgAdjust ? { mentalDmg: ar.dmgAdjust } : {}) };
    chargeRolls.push(...ar.rolls); chargeNotes.push(...ar.notes);
    if (atkBox.total !== entry.total) chargeNotes.push(`The attack roll is now ${atkBox.total}.`);
  }
  return postDefense(target, message, index, target, result, dodge, reasons.join(" · "), null,
    chargeNotes.length || chargeRolls.length ? { rolls: chargeRolls, html: chargeNotes.map(n => `<div class="fs-notes fs-charge-note"><i class="fa-solid fa-link"></i> ${n}</div>`).join("") } : null);
}

/* ---- Martial Theory T1: Parry (a stance until your next turn) ---- */

/**
 * Turn on a Parry during your turn (lasts until the start of your next turn). `key` is a held weapon's id (Parry: its
 * Limit and Durability apply to every incoming melee/ranged attack), "dip" / "shatter" (Brawling T2, a free hand), or
 * "brace" (Medium/Heavy/Titanic armor). Energy = the Scaling Stat. Only one form per weapon; one hand for Dip/Shatter.
 */
export async function startParry(actor, key) {
  if (cantAct(actor, "Parry")) return;
  if (inActiveCombat(actor) && !onOwnTurn(actor)) return ui.notifications.warn("Parry is turned on during your turn.");
  const cur = actor.getFlag("flowstate", "parrying") ?? {};
  let cost, entry, label;
  if (key === "dip" || key === "shatter") {
    if (!ab.brawl(actor, 2) || !ab.fists(actor)) return ui.notifications.warn(`${actor.name} needs Brawling Methods Tier 2 and a free hand.`);
    cost = ab.handParryCost(actor, key); label = key === "dip" ? "Dip" : "Shatter"; entry = { style: key };
  } else if (key === "brace") {
    const info = ab.braceInfo(actor);
    if (!info) return ui.notifications.warn(`${actor.name} needs Brace for the armor they're wearing.`);
    let harden = false;
    if (info.harden !== null) {
      const opts = await optionsDialog(info.name, `<div class="form-group"><label>Harden (+${info.harden} Energy): incoming attacks are also Weakened (before the reduction)</label><input type="checkbox" name="harden"></div>`, "Brace");
      if (!opts) return;
      harden = !!opts.harden;
    }
    cost = info.cost + (harden ? info.harden : 0); label = `${info.name}${harden ? " + Harden" : ""}`; entry = { style: "brace", harden };
  } else {
    const item = actor.items.get(key);
    if (theoryTier(actor) < 1) return ui.notifications.warn("Parry requires Martial Theory Tier 1.");
    if (!item || !parryWeapons(actor).includes(item)) return ui.notifications.warn("Parry needs a held, unbroken weapon.");
    if (ab.defender(actor, item, 1)) return ui.notifications.info(`${item.name} always Blocks (Defender Weapons T1); no Parry needed.`);
    cost = ab.parryCost(item); label = `Parry: ${item.name}`; entry = { style: "parry", item: item.uuid };
  }
  if (cur[key]) return ui.notifications.info(`${label} is already active.`);
  if (!(await spendEnergy(actor, cost, label))) return;
  // Only one hand can Dip or Shatter at a time.
  if (key === "dip" && cur.shatter) await actor.unsetFlag("flowstate", "parrying.shatter");
  if (key === "shatter" && cur.dip) await actor.unsetFlag("flowstate", "parrying.dip");
  await actor.setFlag("flowstate", `parrying.${key}`, entry);
  await post(actor, { title: `${esc(actor.name)} — ${esc(label)}`, body: `<div class="fs-result">${parryText(actor, entry)} until the start of ${esc(actor.name)}'s next turn.</div><div class="fs-notes">${cost ? `${cost} Energy` : "Free"}</div>` });
}

function parryText(actor, e) {
  if (e.style === "dip") return `Dip: incoming melee/ranged damage is reduced by ${ab.statValue(actor, "dex")} (Dexterity)`;
  if (e.style === "shatter") return "Shatter: each incoming hit takes your Heavy Unarmed damage first";
  if (e.style === "brace") return `Brace: incoming damage is reduced by ${ab.braceInfo(actor)?.reduce ?? ab.statValue(actor, "con")}${e.harden ? " and Weakened (Harden)" : ""}`;
  return "The weapon's Limit and Durability apply to every incoming melee/ranged attack";
}

/** End all of an actor's Parries (the start of their turn). */
export async function clearParries(actor) {
  if (actor?.isOwner && actor.getFlag?.("flowstate", "parrying")) await actor.unsetFlag("flowstate", "parrying");
}

/**
 * What protects `target` from one incoming attack: parrying and Blocking weapons (soak), Brace/Dip reductions, Weakened from
 * Slip Off and Harden, and Shatter. Overshield Strike ignores all of it. Perfect Parry/Block failures drop that weapon.
 */
export function guardFor(target, o, attackMessageId = null, index = 0) {
  const g = { items: [], riposteItems: [], reductions: [], weaken: [], shatter: false, dip: 0, brace: false, any: false };
  if (o?.overshield || !(o?.melee || !o?.area)) return g;
  const failed = new Set(attackMessageId ? findPerfectFails(attackMessageId, index) : []);
  const parrying = target.getFlag?.("flowstate", "parrying") ?? {};
  const held = new Set(parryWeapons(target).map(i => i.uuid));
  for (const e of Object.values(parrying)) {
    if (!e) continue;
    if (e.style === "parry" && held.has(e.item) && !failed.has(e.item)) { g.items.push(e.item); g.riposteItems.push(e.item); }
    if (e.style === "dip" && ab.fists(target)) { g.dip = ab.statValue(target, "dex"); g.reductions.push({ label: "Dip (DEX)", amount: g.dip }); g.riposteItems.push(ab.fists(target).uuid); }
    if (e.style === "shatter" && ab.fists(target)) { g.shatter = true; g.riposteItems.push(ab.fists(target).uuid); }
    if (e.style === "brace") {
      const info = ab.braceInfo(target);
      if (info) { g.brace = true; g.reductions.push({ label: `${info.name} (CON${info.reduce > ab.statValue(target, "con") ? " ×2" : ""})`, amount: info.reduce }); if (e.harden) g.weaken.push("Harden"); }
    }
  }
  // Defender T1 Block: always on for your own held Defender weapons.
  for (const sh of ab.defenderHeld(target, 1)) if (!failed.has(sh.uuid) && !g.items.includes(sh.uuid)) { g.items.push(sh.uuid); g.riposteItems.push(sh.uuid); }
  // Blocks made for this creature by allies (Defender T1).
  if (attackMessageId) for (const b of findBlocksFor(attackMessageId, index)) if (!failed.has(b.item) && !g.items.includes(b.item)) g.items.push(b.item);
  // Shield Toss guard (Defender T2): once the target responds it's recorded on the defense card; before that it's pending on the target.
  const defMsg = attackMessageId ? findDefense(attackMessageId, index) : null;
  const sg = defMsg ? defMsg.getFlag("flowstate", "defense")?.guardItem : shieldGuardItem(target);
  if (sg && !failed.has(sg) && !g.items.includes(sg)) g.items.push(sg);
  // Balanced T1 Slip Off: a parrying Balanced weapon also Weakens the attack.
  if (g.items.some(u => { const it = syncUuid(u); return it && ab.balanced(it.parent, it, 1); })) g.weaken.push("Slip Off");
  g.any = g.items.length > 0 || g.reductions.length > 0 || g.shatter;
  return g;
}

/** Items whose Perfect Parry/Perfect Block roll failed against this attack (they don't apply to it). */
export function findPerfectFails(attackMessageId, index) {
  return game.messages.filter(m => { const f = m.getFlag("flowstate", "perfect"); return f?.attackMessage === attackMessageId && f.index === index && !f.success; })
    .map(m => m.getFlag("flowstate", "perfect").item);
}
/** Shields raised for this target by allies (Defender T1 Block). */
export function findBlocksFor(attackMessageId, index) {
  return game.messages.filter(m => { const f = m.getFlag("flowstate", "blockFor"); return f?.attackMessage === attackMessageId && f.index === index; })
    .map(m => m.getFlag("flowstate", "blockFor"));
}

/**
 * Perfect Parry (Curved T2, an active Curved Parry, roll with Advantage) / Perfect Block (Defender T5): roll against the
 * incoming attack. Success: the attack is negated. Failure: that weapon doesn't apply to this hit (you still dodge).
 */
async function perfectRoll(message, index, target, entry, o, { kind, blocker = null, tossText = "" } = {}) {
  const who = blocker ?? target;
  const items = kind === "perfectParry"
    ? guardFor(target, o, message.id, index).items.map(u => syncUuid(u)).filter(i => i && ab.curved(target, i, 2))
    : ab.defenderHeld(who, 5);
  if (!items.length) return ui.notifications.warn(kind === "perfectParry" ? `${entry.name} needs an active Parry with a Curved weapon.` : `${who.name} needs a held Defender weapon (Defender T5).`);
  const label = kind === "perfectParry" ? "Perfect Parry" : "Perfect Block";
  const opts = await optionsDialog(`${who.name} — ${label}`, `
    <p class="hint">Incoming attack: <strong>${entry.total}</strong> · attack roll (d${who.system.derived.attackDie})${kind === "perfectParry" ? " with Advantage" : ""}. Equal or higher: the attack is negated. Lower: ${items.length > 1 ? "that weapon" : esc(items[0].name)} doesn't apply to this hit, and you still respond.</p>
    ${items.length > 1 ? `<div class="form-group"><label>Weapon</label><select name="item">${items.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join("")}</select></div>` : ""}
    ${netField()}`, label);
  if (!opts) return;
  if (findDefense(message.id, index)) return;
  const item = items.find(i => i.id === opts.item) ?? items[0];
  if (findPerfectFails(message.id, index).includes(item.uuid)) return ui.notifications.info(`${item.name} already missed its ${label}.`);
  const w = who.system;
  const net = opts.net + (kind === "perfectParry" ? 1 : 0) + exhaustionNet(who) - w.penalties.physicalDis + attackStanceNet(who) + limberNet(who) + leadBlindNet(o) + disruptNet(who) + charmNet(who, "attack");
  await consumeLimber(who); await consumeDisrupt(who);
  const roll = await evaluate(poolFormula(1, w.derived.attackDie, net));
  const success = roll.total >= entry.total;
  if (success) {
    const result = { hit: false, crit: false, doubleCrit: false, critStacks: 0, outcome: `${label} — negated`,
      parry: { item: item.uuid, name: `${item.name} (${label})`, success: true, ap: item.system.profile.ap, style: kind, by: blocker && blocker.uuid !== target.uuid ? blocker.uuid : null } };
    return postDefense(who, message, index, target, result, roll, `${tossText ? `${tossText} · ` : ""}${item.name} · ${label}${net ? ` · ${netLabel(net)}` : ""}`, `${label} (d${w.derived.attackDie})`);
  }
  await post(who, { title: `${esc(who.name)} — ${label} misses`, rolls: [roll],
    body: `${tossText ? `<div class="fs-notes">${esc(tossText)}</div>` : ""}${await rollBlock(roll, `${label} (d${w.derived.attackDie})`)}<div class="fs-result">${roll.total} vs ${entry.total}: ${esc(item.name)} doesn't apply to this hit. Respond on the attack card.</div>`,
    flags: { flowstate: { perfect: { attackMessage: message.id, index, item: item.uuid, success: false } } } });
}

/**
 * Block for someone else (Defender T1): a free per-attack choice; your shield's Limit applies to their damage. With Defender
 * T5, Perfect Block rolls instead. Shield Toss (T2, 2 RP) reaches allies in throw range.
 */
export async function blockFor(message, index, blockerUuid, perfect = false, toss = false) {
  const attack = message.getFlag("flowstate", "attack");
  const entry0 = attack?.targets?.[index];
  if (!entry0) return;
  if (findCancel(message.id)) return ui.notifications.info("That spell was countered before it landed.");
if (findDefense(message.id, index)) return ui.notifications.info(`${entry0.name} has already responded.`);
  const blocker = await fromUuid(blockerUuid);
  const target = await fromUuid(entry0.uuid);
  if (!blocker || !target) return;
  if (!blocker.isOwner) return ui.notifications.warn(`Only ${blocker.name}'s owner can Block with them.`);
  if (cantAct(blocker, "Block")) return;
  if (findBlocksFor(message.id, index).some(b => b.blocker === blocker.uuid)) return ui.notifications.info(`${blocker.name} is already Blocking this attack.`);
  let shield = ab.defenderHeld(blocker, 1)[0];
  let tossNote = "";
  if (toss) {
    const tTok = target.getActiveTokens?.()[0], bTok = attackerToken(blocker);
    const dist = tTok && bTok && globalThis.canvas?.grid ? tokenDistance(bTok, tTok) : 0;
    const shields = tossShields(blocker).filter(i => dist <= (THROW[i.system.profile.throwType]?.range ?? 0));
    if (!shields.length) return ui.notifications.warn(`${blocker.name} needs a throwable Defender weapon with ${target.name} in throw range.`);
    shield = shields.sort((a, b) => ab.DEFENDER_COST.shieldToss(a) - ab.DEFENDER_COST.shieldToss(b))[0];
    const cost = ab.DEFENDER_COST.shieldToss(shield);
    if (inActiveCombat(blocker) && blocker.system.energy.value < cost) return ui.notifications.warn(`${blocker.name} needs ${cost} Energy for Shield Toss.`);
    if (!(await spendPoints(blocker, "rp", 2, "Shield Toss"))) return;
    if (!(await spendEnergy(blocker, cost, "Shield Toss"))) return;
    tossNote = `<div class="fs-notes">Shield Toss: ${esc(shield.name)} is thrown to ${esc(target.name)} and returns afterwards · 2 RP · ${cost} Energy</div>`;
  }
  if (!shield) return ui.notifications.warn(`${blocker.name} needs a held Defender weapon.`);
  // A Shield Toss guard is used up by the Block.
  if (target.getFlag("flowstate", "shieldGuard")?.blocker === blocker.uuid) await setActorFlag(target, "shieldGuard", null);
  if (perfect) return perfectRoll(message, index, target, effectiveEntry(message.id, index, entry0), attack.opts, { kind: "perfectBlock", blocker,
    tossText: tossNote ? `Shield Toss: ${shield.name} thrown to ${target.name} (2 RP · ${ab.DEFENDER_COST.shieldToss(shield)} Energy)` : "" });
  await post(blocker, { title: `${esc(blocker.name)} — ${toss ? "Shield Toss: " : ""}Block for ${esc(target.name)}`,
    body: `<div class="fs-result">${esc(shield.name)}'s Limit applies to ${esc(target.name)}'s damage from this attack.</div>${tossNote}`,
    flags: { flowstate: { blockFor: { attackMessage: message.id, index, blocker: blocker.uuid, item: shield.uuid, toss: !!toss } } } });
}

/* ---- Martial Theory T1: Parry & Riposte ---- */

/** Held weapons that can Parry (a real weapon with a Limit: not Unarmed, not broken). */
export function parryWeapons(actor) {
  return actor.items.filter(i => i.type === "weapon" && i.system.held && !i.system.broken
    && i.system.profile?.valid && !i.system.profile.unarmed && !i.system.profile.improvised);
}

/**
 * Shatter (Brawling T2, Heavy): the defender's Heavy Unarmed damage (no Solitary) hits the incoming attack for free, before
 * its damage. Melee: the attacking weapon takes it (to Durability); if that breaks the weapon, the attack deals no damage.
 * An Unarmed (or weaponless) melee attack is the attacker's own body, so the attacker takes it. Ranged/projectile attacks
 * (magic ones too): the projectile takes it, and the attack's damage is lowered by that much (to 0 = destroyed, no damage).
 * Returns { html, rolls, broken, reduce }.
 */
async function shatterStrike(defender, attacker, o = {}) {
  const none = { html: "", rolls: [], broken: false, reduce: 0 };
  const eff = defender.system.derived.effective;
  const p = weaponProfile({ type: "unarmed", weight: "heavy" }, { str: eff.str.value, dex: eff.dex.value });
  const base = await rollBaseDamage(p.formula, 1);
  if (!base) return none;
  const amount = base.totals[0];
  const total = amount + (p.cleave ?? 0); // Cleave is object damage: it counts against weapons and projectiles.
  let html = `<div class="fs-result fs-damage-taken">Shatter (${esc(defender.name)})</div>${await baseDamageHTML(base, "physical")}`;
  if (!o.melee) {
    html += `<div class="fs-result">The projectile takes <strong>${total}</strong>${p.cleave ? ` (incl. ${p.cleave} Cleave)` : ""}: the attack's damage is lowered by ${total}.</div>`;
    return { html, rolls: base.rolls, broken: false, reduce: total };
  }
  const weapon = o.itemUuid ? await fromUuid(o.itemUuid) : null;
  const breakable = weapon?.type === "weapon" && weapon.system.weaponType !== "unarmed" && (weapon.system.durability?.max ?? 0) > 0;
  if (breakable) {
    const broken = weapon.system.durability.value - total <= 0;
    html += `<div class="fs-result">${esc(weapon.name)} takes <strong>${total}</strong>${p.cleave ? ` (incl. ${p.cleave} Cleave)` : ""} (−${total} Durability)${broken ? " and <strong>breaks</strong>: the attack deals no damage" : ""}.</div>`;
    if (weapon.isOwner) await weapon.update({ "system.wear": weapon.system.wear + total }, { flowstateSystem: true });
    else await requestGM("wearItem", { uuid: weapon.uuid, amount: total });
    return { html, rolls: base.rolls, broken, reduce: 0 };
  }
  if (attacker) {
    const outcome = await damageOutcome(attacker, amount, "physical", { cleave: p.cleave ?? 0 });
    html += damageOutcomeHTML(attacker, amount, "physical", outcome);
    await requestDamage(attacker, amount, "physical", 0, null, { silent: true, cleave: p.cleave ?? 0 });
  }
  return { html, rolls: base.rolls, broken: false, reduce: 0 };
}

/**
 * Redirect (Brawling T4, Light): after a successful Parry or dodge against a melee attack, the attacker's attack goes to a
 * creature adjacent to you instead (your target), re-rolled with Advantage and with the same options (no extra cost to them).
 */
export async function redirect(defenseMessage) {
  const defense = defenseMessage.getFlag("flowstate", "defense");
  if (!defense) return;
  if (game.messages.find(m => m.getFlag("flowstate", "attack")?.opts?.redirectOf === defenseMessage.id)) return ui.notifications.info("That attack was already redirected.");
  const defender = await fromUuid(defense.target);
  const attacker = await fromUuid(defense.attacker);
  if (!defender?.isOwner) return ui.notifications.warn(`Only ${defender?.name ?? "the defender"}'s owner can Redirect.`);
  if (!attacker) return;
  const picks = [...game.user.targets].map(t => t.actor).filter(a => a && a.type !== "pile" && a.uuid !== defender.uuid && a.uuid !== attacker.uuid);
  if (picks.length !== 1) return ui.notifications.warn("Target exactly one creature to redirect the attack into.");
  const into = picks[0];

  // Forced movement: if the chosen creature isn't next to you, it's moved to the nearest free space that is.
  const dTok = attackerToken(defender), iTok = into.getActiveTokens?.()[0], aTok = attackerToken(attacker);
  let moveNote = "";
  let spot = null;
  if (dTok && iTok && globalThis.canvas?.grid && !adjacent(dTok, iTok)) {
    spot = adjacentSpot(dTok, iTok, aTok, attacker.system.derived?.size?.melee ?? 5);
    if (!spot) return ui.notifications.warn(`There's no free space next to ${defender.name} to pull ${into.name} into.`);
  }
  const cost = ab.BRAWLING_COST.redirect(defender);
  if (!(await spendEnergy(defender, cost, "Redirect"))) return;
  if (spot) {
    await moveTokenTopLeft(iTok, spot);
    moveNote = ` · ${into.name} is forced next to ${defender.name}`;
  }
  const o = game.messages.get(defense.attackMessage)?.getFlag("flowstate", "attack")?.opts ?? {};
  return performAttack(attacker, {
    ...o, net: 1, followups: [], followupOf: null, targetActors: [into], redirectOf: defenseMessage.id,
    label: `${o.label || "Attack"} (redirected)`,
    notes: [`Redirected by ${defender.name} (Brawling: Redirect, ${cost} Energy) — re-rolled with Advantage${moveNote}`]
  });
}

/** Grid footprint of a token as [x, y, w, h] in grid cells (top-left based). */
function footprint(token, at = null) {
  const gs = canvas.grid.size;
  const d = token.document;
  const pos = at ?? { x: d.x, y: d.y };
  return [Math.round(pos.x / gs), Math.round(pos.y / gs), Math.max(1, Math.round(d.width ?? 1)), Math.max(1, Math.round(d.height ?? 1))];
}
const overlaps = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
/** Two footprints touch (share an edge or corner) without overlapping. */
const touches = (a, b) => !overlaps(a, b) && a[0] <= b[0] + b[2] && b[0] <= a[0] + a[2] && a[1] <= b[1] + b[3] && b[1] <= a[1] + a[3];

/** Are these two tokens next to each other? */
function adjacent(a, b) {
  return touches(footprint(a), footprint(b)) || overlaps(footprint(a), footprint(b));
}

/**
 * The best free space next to `anchor` for `mover`: inside the attacker's melee reach when possible,
 * then the shortest pull. Returns a top-left pixel position, or null if every space is taken.
 */
function adjacentSpot(anchor, mover, attackerTok, reach) {
  const gs = canvas.grid.size;
  const A = footprint(anchor);
  const [mx, my, mw, mh] = footprint(mover);
  const others = (canvas.tokens?.placeables ?? [])
    .filter(t => t.id !== mover.id && t.id !== anchor.id && t.actor?.type !== "pile")
    .map(t => footprint(t));
  let best = null;
  for (let i = A[0] - mw; i <= A[0] + A[2]; i++) {
    for (let j = A[1] - mh; j <= A[1] + A[3]; j++) {
      const cand = [i, j, mw, mh];
      if (!touches(cand, A) || others.some(o => overlaps(cand, o))) continue;
      const center = { x: (i + mw / 2) * gs, y: (j + mh / 2) * gs };
      const inReach = attackerTok ? canvas.grid.measurePath([attackerTok.center, center]).distance <= reach + (canvas.grid.distance ?? 5) * 0.5 : true;
      const pull = Math.hypot(i - mx, j - my);
      const score = (inReach ? 0 : 1000) + pull;
      if (!best || score < best.score) best = { score, x: i * gs, y: j * gs };
    }
  }
  return best && { x: best.x, y: best.y };
}

/**
 * Deflect (Balanced T4): when a Parry with a Balanced weapon leaves all of the damage on the weapon, spend 1 RP to send
 * the attack back at the attacker, using their own weapon's attack (its damage and effects). You roll the attack.
 */
export async function deflect(damageMessage) {
  const info = damageMessage.getFlag("flowstate", "deflect");
  if (!info) return;
  if (game.messages.find(m => m.getFlag("flowstate", "attack")?.opts?.deflectOf === damageMessage.id)) return ui.notifications.info("That attack was already deflected.");
  const defender = await fromUuid(info.defender);
  const attacker = await fromUuid(info.attacker);
  if (!defender?.isOwner) return ui.notifications.warn(`Only ${defender?.name ?? "the defender"}'s owner can Deflect.`);
  if (!attacker) return;
  if (cantAct(defender, "Deflect")) return;
  const o = game.messages.get(info.attackMessage)?.getFlag("flowstate", "attack")?.opts ?? {};
  if (!(await spendPoints(defender, "rp", 1, "Deflect"))) return;
  return performAttack(defender, {
    ...o, net: 0, followups: [], followupOf: null, redirectOf: null, targetActors: [attacker], deflectOf: damageMessage.id,
    label: `Deflect — ${o.label || "Attack"}`,
    notes: [`${defender.name} deflects ${attacker.name}'s attack back at them (Balanced: Deflect, 1 RP)`]
  });
}

const riposteInFlight = new Set();

/** Cut Back (Swift T1): after a successful dodge, Riposte the attacker with a held Swift weapon. */
export async function cutBack(defenseMessage) {
  const defense = defenseMessage.getFlag("flowstate", "defense");
  if (!defense || defense.result?.hit) return;
  if (findFollowup(defenseMessage.id) || riposteInFlight.has(defenseMessage.id)) return ui.notifications.info("Cut Back was already used.");
  const defender = await fromUuid(defense.target);
  const attacker = await fromUuid(defense.attacker);
  if (!defender?.isOwner) return ui.notifications.warn(`Only ${defender?.name ?? "the defender"}'s owner can Cut Back.`);
  if (!attacker) return;
  const weapons = ab.swiftHeld(defender, 1);
  if (!weapons.length) return ui.notifications.warn(`${defender.name} needs a held Swift weapon.`);
  let item = weapons[0];
  if (weapons.length > 1) {
    const opts = await optionsDialog(`${defender.name} — Cut Back`, `<div class="form-group"><label>Weapon</label><select name="item">
      ${weapons.map(i => `<option value="${i.id}">${esc(i.name)} — ${i.system.profile.ap} RP</option>`).join("")}</select></div>`, "Choose");
    if (!opts) return;
    item = defender.items.get(opts.item) ?? item;
  }
  riposteInFlight.add(defenseMessage.id);
  try {
    return await rollWeaponAttack(defender, item, { riposte: true, cutBack: true, net: 0, label: "Cut Back", rp: item.system.profile.ap,
      source: defenseMessage.id, targetActors: [attacker] });
  } finally {
    riposteInFlight.delete(defenseMessage.id);
  }
}

const flurryCardInFlight = new Set();

/**
 * Blade Flurry (Swift T3): when both attacks of a Fast Swift set land on the same single target, offer another Swift
 * attack against it (RP = its attack AP). That attack can start a new Fast set, so the Flurry can chain.
 */
async function maybeFlurryCard(f) {
  const fa = f?.getFlag("flowstate", "attack");
  if (!fa?.opts?.swift || fa.opts.setKind !== "fast") return;
  const root = game.messages.get(f.getFlag("flowstate", "followupOf"));
  const ra = root?.getFlag("flowstate", "attack");
  if (!ra?.opts?.swift) return;
  if (flurryCardInFlight.has(f.id) || game.messages.find(m => m.getFlag("flowstate", "flurryCard")?.set === f.id)) return;
  if (ra.targets.length !== 1 || fa.targets.length !== 1 || ra.targets[0].uuid !== fa.targets[0].uuid) return;
  if (!exchangeDone(f) || !exchangeDone(root)) return;
  const hit = m => !!findDefense(m.id, 0)?.getFlag("flowstate", "defense")?.result?.hit;
  if (!hit(root) || !hit(f)) return;
  const attacker = await fromUuid(fa.attacker);
  if (!attacker || !ab.swiftHeld(attacker, 3).length) return;
  flurryCardInFlight.add(f.id);
  try {
    const weapons = ab.swiftHeld(attacker, 3);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="flowstate-card"><header class="fs-card-title">Blade Flurry — ${esc(attacker.name)}</header>
        <div class="fs-notes">Both Fast Swift attacks landed on ${esc(ra.targets[0].name)}.</div>
        <div class="fs-brawl-row fs-flurry-row" data-role="attacker" data-owner="${attacker.uuid}">
          ${weapons.map(i => `<button type="button" class="fs-flurry" data-item="${i.id}" data-tooltip="Swift T3: another attack on the same target; it can start a new Fast set"><i class="fa-solid fa-wind"></i> ${esc(i.name)} (${i.system.profile.ap} RP · ⚡ ${ab.SWIFT_COST.bladeFlurry(i)})</button>`).join("")}
        </div></div>`,
      flags: { flowstate: { flurryCard: { set: f.id, attacker: attacker.uuid, target: ra.targets[0].uuid } } }
    });
  } finally {
    flurryCardInFlight.delete(f.id);
  }
}

/** Blade Flurry from its card. */
export async function bladeFlurry(card, itemId) {
  const info = card.getFlag("flowstate", "flurryCard");
  if (!info) return;
  const source = `${card.id}:flurry`;
  if (findFollowup(source)) return ui.notifications.info("That Blade Flurry was already used.");
  const attacker = await fromUuid(info.attacker);
  const target = await fromUuid(info.target);
  if (!attacker?.isOwner) return ui.notifications.warn(`You don't control ${attacker?.name ?? "that character"}.`);
  if (!target) return ui.notifications.warn("The target no longer exists.");
  const item = attacker.items.get(itemId);
  if (!item || !ab.swift(attacker, item, 3) || !item.system.held) return ui.notifications.warn("That weapon isn't a held Swift weapon any more.");
  return rollWeaponAttack(attacker, item, { kind: "flurry", net: 0, label: "Blade Flurry", source, targetActors: [target] });
}

/** Swift damage this actor dealt to HP during the current turn (from damage cards). */
export function swiftDamageThisTurn(actor) {
  const key = turnKey();
  if (!key) return [];
  return game.messages.filter(m => {
    const d = m.getFlag("flowstate", "damage");
    return d?.swift && d.attacker === actor.uuid && d.turnKey === key && d.toHp > 0;
  }).map(m => m.getFlag("flowstate", "damage"));
}

/** Delta (Swift T5): count Light Swift attacks by this actor that landed during the given turn. */
export function swiftHitsInTurn(actor, key) {
  return game.messages.filter(m => {
    const d = m.getFlag("flowstate", "defense");
    if (!d?.result?.hit || d.attacker !== actor.uuid) return false;
    const o = game.messages.get(d.attackMessage)?.getFlag("flowstate", "attack")?.opts;
    return o?.swiftLight && o.turnKey === key;
  }).length;
}

/** Delta (Swift T5): at the end of your turn, if 12+ Light Swift attacks landed, regain 6 RP (up to 6). Runs on the GM. */
export async function delta(actor, key) {
  if (!actor?.isOwner || ab.treeTier(actor, ab.SWIFT) < 5) return;
  const hits = swiftHitsInTurn(actor, key);
  if (hits < 12) return;
  const before = actor.system.rp.value;
  const after = Math.min(6, before + 6);
  if (after > before) await actor.update({ "system.rp.value": after });
  await post(actor, { title: `${esc(actor.name)} — Delta`, body: `<div class="fs-result">${hits} Light Swift attacks landed this turn: RP ${before} → ${after}.</div>` });
}

/* ---- Rapid Weapons ---- */

/**
 * Quickload (Rapid T1): attacking with an empty Rapid weapon can instead spend the attack's AP to reload instantly.
 * Speedloader (T5): pay Energy to reload and still fire. Returns "speed" to go on with the attack, else "done"/null.
 */
async function quickload(actor, item) {
  const p = item.system.profile;
  const speed = ab.rapid(actor, item, 5);
  const cost = ab.RAPID_COST.speedloader(item);
  const choice = await DialogV2().wait({
    window: { title: `${item.name} is empty` },
    content: `<p><strong>${esc(item.name)}</strong> is out of ammo.</p>
      <p class="hint">Quickload: spend the attack's ${p.ap} AP to reload instantly (no attack).${speed ? ` Speedloader: ${cost} Energy to reload and fire as normal (a Pepper attack has one less Disadvantage).` : ""}</p>`,
    buttons: [
      { action: "quick", label: `Quickload (${p.ap} AP)`, icon: "fa-solid fa-rotate", default: true },
      ...(speed ? [{ action: "speed", label: `Speedloader (⚡ ${cost})`, icon: "fa-solid fa-bolt" }] : []),
      { action: "cancel", label: "Cancel", icon: "fa-solid fa-xmark" }
    ],
    rejectClose: false
  });
  if (choice === "quick") {
    if (!(await spendAP(actor, p.ap, `Quickload with ${item.name}`))) return null;
    await loadWeapon(actor, item);
    await post(actor, { title: `${esc(actor.name)} — Quickload`, body: `<div class="fs-result">${esc(item.name)} is reloaded (${p.ap} AP, no attack).</div>` });
    return "done";
  }
  if (choice === "speed") {
    if (inActiveCombat(actor) && actor.system.energy.value < cost) { ui.notifications.warn(`${actor.name} needs ${cost} Energy for Speedloader.`); return null; }
    if (!(await spendEnergy(actor, cost, "Speedloader"))) return null;
    if (!(await loadWeapon(actor, item))) return null;
    return "speed";
  }
  return null;
}

/** Turn a flag on an actor on or off, through the GM when we don't own it. */
export async function setActorFlag(actor, key, value) {
  if (!actor) return;
  if (!actor.isOwner) return requestGM("setActorFlag", { target: actor.uuid, key, value });
  if (value === null || value === undefined) { if (actor.getFlag("flowstate", key) !== undefined) await actor.unsetFlag("flowstate", key); }
  else await actor.setFlag("flowstate", key, value);
}

/** Mark (Rapid T3): mark one targeted creature within your Rapid weapon's range until the start of your next turn. */
export async function markTarget(actor) {
  if (cantAct(actor, "Mark")) return;
  const weapons = ab.rapidHeld(actor, 3);
  if (!weapons.length) return ui.notifications.warn(`${actor.name} needs a held Rapid weapon (Rapid Weapons Tier 3).`);
  const targets = [...(game.user.targets ?? [])].map(t => t.actor).filter(a => a && a.type !== "pile" && a.uuid !== actor.uuid);
  if (targets.length !== 1) return ui.notifications.warn("Target exactly one creature to Mark.");
  const target = targets[0];
  const weapon = weapons.sort((a, b) => (b.system.profile.range ?? 0) - (a.system.profile.range ?? 0))[0];
  if (!checkRange(actor, weapon.system.profile.range ?? 0, `a Mark (${weapon.name})`, target.getActiveTokens?.() ?? [])) return;
  const cost = ab.RAPID_COST.mark(weapon);
  if (!(await spendEnergy(actor, cost, "Mark"))) return;
  await setActorFlag(target, "markedBy", { marker: actor.uuid, name: actor.name });
  await post(actor, { title: `${esc(actor.name)} — Mark`, body: `<div class="fs-result">${esc(target.name)} is Marked until the start of ${esc(actor.name)}'s next turn.</div>
    <div class="fs-notes">${cost} Energy · when ${esc(target.name)} attacks, acts, or moves, ${esc(actor.name)} can shoot them (RP = the weapon's attack AP)${ab.treeTier(actor, ab.RAPID) >= 4 ? "; Lead Blindness gives that action Disadvantage" : ""}.</div>` });
}

/**
 * A Marked creature declared something: use up the Mark and give the marker a card to shoot them.
 * Returns true if Lead Blindness (Rapid T4) applies to the triggering action.
 */
export async function triggerMark(actor, what) {
  const mark = actor?.getFlag?.("flowstate", "markedBy");
  if (!mark) return false;
  const marker = await fromUuid(mark.marker);
  await setActorFlag(actor, "markedBy", null);
  if (!marker) return false;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: marker }),
    content: `<div class="flowstate-card"><header class="fs-card-title">Mark — ${esc(actor.name)} ${esc(what)}</header>
      <div class="fs-notes">${esc(marker.name)}'s Mark is used up. Shoot ${esc(actor.name)} now with a held Rapid weapon.</div>
      <div class="fs-brawl-row fs-mark-row" data-role="attacker" data-owner="${marker.uuid}">
        <button type="button" class="fs-mark-shot"><i class="fa-solid fa-crosshairs"></i> Shoot ${esc(actor.name)} (RP = attack AP)</button></div></div>`,
    flags: { flowstate: { markCard: { marker: marker.uuid, target: actor.uuid } } }
  });
  return ab.treeTier(marker, ab.RAPID) >= 4;
}

/** Shoot a Marked creature from its Mark card. */
export async function markShot(card) {
  const info = card.getFlag("flowstate", "markCard");
  if (!info) return;
  const source = `${card.id}:mark`;
  if (findFollowup(source)) return ui.notifications.info("That Mark shot was already taken.");
  const marker = await fromUuid(info.marker);
  const target = await fromUuid(info.target);
  if (!marker?.isOwner) return ui.notifications.warn(`You don't control ${marker?.name ?? "the marker"}.`);
  if (!target) return;
  const weapons = ab.rapidHeld(marker, 3);
  if (!weapons.length) return ui.notifications.warn(`${marker.name} needs a held Rapid weapon.`);
  let item = weapons[0];
  if (weapons.length > 1) {
    const opts = await optionsDialog("Mark shot", `<div class="form-group"><label>Weapon</label><select name="item">
      ${weapons.map(i => `<option value="${i.id}">${esc(i.name)} — ${i.system.profile.ap} RP</option>`).join("")}</select></div>`, "Choose");
    if (!opts) return;
    item = marker.items.get(opts.item) ?? item;
  }
  return rollWeaponAttack(marker, item, { kind: "mark", net: 0, label: "Mark shot", source, targetActors: [target] });
}

/** Start of the marker's turn: their Marks end. Runs on the GM. */
export async function clearMarks(marker) {
  if (!game.user.isGM) return;
  const pool = new Map();
  for (const a of game.actors ?? []) pool.set(a.uuid, a);
  for (const t of globalThis.canvas?.tokens?.placeables ?? []) if (t.actor) pool.set(t.actor.uuid, t.actor);
  for (const a of pool.values()) if (a.getFlag?.("flowstate", "markedBy")?.marker === marker.uuid) await a.unsetFlag("flowstate", "markedBy");
}

/* ---- Medium Armor ---- */

/** Limber (Medium T1): from a defense card, after a successful attack or dodge/parry roll. */
export async function limber(message, actorUuid) {
  const actor = await fromUuid(actorUuid);
  if (!actor?.isOwner) return ui.notifications.warn("You don't control that character.");
  if (actor.getFlag("flowstate", "limberFrom") === message.id) return ui.notifications.info("Limber was already used from this card.");
  if (!ab.medium(actor, 1)) return ui.notifications.warn(`${actor.name} needs Medium Armor Tier 1 and worn Medium armor.`);
  if (actor.statuses.has("limber")) return ui.notifications.info(`${actor.name} is already Limber.`);
  const cost = ab.mediumCost(actor, "limber");
  if (!(await spendEnergy(actor, cost, "Limber"))) return;
  await actor.setFlag("flowstate", "limberFrom", message.id);
  await actor.toggleStatusEffect("limber", { active: true });
  // A card (rather than just a notification) so the defense card re-renders everywhere and drops the button.
  await post(actor, { title: `${esc(actor.name)} — Limber`, body: `<div class="fs-result">The next attack, dodge, or parry roll before ${esc(actor.name)}'s next turn has Advantage.</div>${cost ? `<div class="fs-notes">${cost} Energy</div>` : ""}`,
    flags: { flowstate: { limberOf: message.id, limberActor: actor.uuid } } });
}

/**
 * Careful Steps (Medium T3): no stealth penalty from worn Medium armor. Toggle any time. While it's on, each of your
 * turns in combat automatically costs 2 AP at the start of the turn; if you can't pay, it lapses for that turn but
 * stays on. Switching it on mid-combat: on your own turn you pay the 2 AP now; otherwise it kicks in (and is paid for)
 * at the start of your next turn.
 */
export async function carefulSteps(actor) {
  if (actor.statuses.has("carefulSteps")) {
    if (actor.getFlag("flowstate", "carefulLapsed")) await actor.unsetFlag("flowstate", "carefulLapsed");
    return actor.toggleStatusEffect("carefulSteps", { active: false });
  }
  if (cantAct(actor, "do that")) return;
  if (ab.treeTier(actor, ab.MEDIUM) < 3) return ui.notifications.warn(`${actor.name} needs Medium Armor Tier 3.`);
  if (!ab.wearingMedium(actor)) return ui.notifications.warn(`${actor.name} isn't wearing Medium armor (equip it first).`);
  let lapsed = false;
  if (inActiveCombat(actor)) {
    if (game.combat.combatant?.actor?.uuid === actor.uuid && actor.system.ap.value >= 2) await spendAP(actor, 2, "Careful Steps");
    else lapsed = true;
  }
  if (lapsed) await actor.setFlag("flowstate", "carefulLapsed", true);
  else if (actor.getFlag("flowstate", "carefulLapsed")) await actor.unsetFlag("flowstate", "carefulLapsed");
  await actor.toggleStatusEffect("carefulSteps", { active: true });
  if (lapsed) ui.notifications.info(`Careful Steps is on; it takes effect at the start of ${actor.name}'s next turn (2 AP).`);
}

/**
 * Versatility (Medium T5): a standing choice of Shift, Brace, or Limber, which costs no Energy while you wear Medium
 * armor. It stays set; outside combat change it freely, in combat once per turn on your own turn.
 */
export async function versatility(actor) {
  if (ab.treeTier(actor, ab.MEDIUM) < 5) return ui.notifications.warn(`${actor.name} needs Medium Armor Tier 5.`);
  const fighting = inActiveCombat(actor) && !game.user.isGM;
  if (fighting) {
    if (game.combat.combatant?.actor?.uuid !== actor.uuid) return ui.notifications.warn("In combat, Versatility can only be changed on your own turn.");
    if (actor.getFlag("flowstate", "versatilityTurn") === turnKey()) return ui.notifications.info("Versatility was already changed this turn.");
  }
  const cur = actor.getFlag("flowstate", "versatility");
  const opt = v => `<option value="${v}"${cur === v ? " selected" : ""}>${v[0].toUpperCase() + v.slice(1)}</option>`;
  const opts = await optionsDialog("Versatility", `<div class="form-group"><label>Costs no Energy while wearing Medium armor</label><select name="ability">
    ${["shift", "brace", "limber"].map(opt).join("")}</select></div>`, "Set");
  if (!opts) return;
  const upd = { "flags.flowstate.versatility": opts.ability };
  if (fighting) upd["flags.flowstate.versatilityTurn"] = turnKey();
  await actor.update(upd);
  ui.notifications.info(`Versatility: ${opts.ability[0].toUpperCase() + opts.ability.slice(1)} costs no Energy while ${actor.name} wears Medium armor.`);
}

/** Taking off Medium armor ends Careful Steps. Called after the actor's items change (by the user who changed them). */
export async function checkMediumArmor(actor) {
  if (!actor?.isOwner || !actor.statuses?.has("carefulSteps") || ab.wearingMedium(actor)) return;
  if (actor.getFlag("flowstate", "carefulLapsed")) await actor.unsetFlag("flowstate", "carefulLapsed");
  await actor.toggleStatusEffect("carefulSteps", { active: false });
  ui.notifications.warn(`${actor.name} is no longer wearing Medium armor, so Careful Steps ends.`);
}

/** Start of your turn: Limber ends; Careful Steps charges its 2 AP (or lapses this turn). Runs on the GM. */
export async function mediumTurnStart(actor) {
  if (!actor?.isOwner) return;
  if (actor.statuses.has("limber")) await actor.toggleStatusEffect("limber", { active: false });
  if (actor.statuses.has("carefulSteps")) {
    const lapsed = !!actor.getFlag("flowstate", "carefulLapsed");
    if (!ab.medium(actor, 3)) {
      if (!lapsed) await actor.setFlag("flowstate", "carefulLapsed", true);
    } else if (actor.system.ap.value < 2) {
      await actor.setFlag("flowstate", "carefulLapsed", true);
      await post(actor, { title: `${esc(actor.name)} — Careful Steps lapses`, body: `<div class="fs-notes">Not enough AP this turn; the stealth penalty applies until your next turn.</div>` });
    } else {
      await actor.update({ "system.ap.value": actor.system.ap.value - 2, "flags.flowstate.carefulLapsed": false });
    }
  }
}

/* ---- T2 Martial trees: turn abilities ---- */

const onOwnTurn = actor => inActiveCombat(actor) && game.combat.combatant?.actor?.uuid === actor.uuid;
/** The held weapon a "Scaling Stat min" cost is paid with: the best one among `items`. */
const bestWeapon = items => [...items].sort((a, b) => ab.scalingMin(b) - ab.scalingMin(a))[0] ?? null;

/** Why Berserk can't be used now ("" if it can). */
export function berserkBlocked(actor) {
  if (ab.treeTier(actor, ab.STRIKER) < 2) return "Requires Striker Weapons Tier 2.";
  if (actor.statuses?.has("berserk")) return "Already Berserk.";
  if (!ab.strikerHeld(actor, 2).length) return "Hold a Striker weapon.";
  if (inActiveCombat(actor) && !onOwnTurn(actor)) return "Only at the start of your turn.";
  return "";
}

/**
 * Berserk (Striker T2): at the start of your turn, until the start of your next: Light Striker attacks get Fast and Heavy
 * Striker attacks get Solitary. When it would end, it can be maintained by paying its cost again.
 */
export async function berserk(actor) {
  if (cantAct(actor, "go Berserk")) return;
  const blocked = berserkBlocked(actor);
  if (blocked) return ui.notifications.warn(`Berserk: ${blocked}`);
  await triggerMark(actor, "goes Berserk");
  const weapon = bestWeapon(ab.strikerHeld(actor, 2));
  const cost = ab.STRIKER_COST.berserk(weapon);
  if (!(await spendEnergy(actor, cost, "Berserk"))) return;
  await actor.setFlag("flowstate", "berserkCost", cost);
  await setStatus(actor, "berserk", true);
  await post(actor, { title: `${esc(actor.name)} — Berserk`, body: `<div class="fs-result">Until the start of ${esc(actor.name)}'s next turn: Light Striker attacks get Fast, Heavy Striker attacks get Solitary.</div><div class="fs-notes">${cost} Energy</div>` });
}

/** Seeing Red (Striker T4): while Berserk, Fast+ / Solitary+, but Disadvantage on all non-attack rolls. */
export async function seeingRed(actor) {
  if (cantAct(actor, "do that")) return;
  if (ab.treeTier(actor, ab.STRIKER) < 4) return ui.notifications.warn("Seeing Red requires Striker Weapons Tier 4.");
  if (!actor.statuses?.has("berserk")) return ui.notifications.warn("Seeing Red can only be used while Berserk.");
  if (actor.statuses.has("seeingRed")) return ui.notifications.info(`${actor.name} is already Seeing Red.`);
  const weapon = bestWeapon(ab.strikerHeld(actor, 4));
  if (!weapon) return ui.notifications.warn("Hold a Striker weapon.");
  const cost = ab.STRIKER_COST.seeingRed(weapon);
  if (!(await spendEnergy(actor, cost, "Seeing Red"))) return;
  await setStatus(actor, "seeingRed", true);
  await post(actor, { title: `${esc(actor.name)} — Seeing Red`, body: `<div class="fs-result">Berserk is upgraded to Fast+ and Solitary+ for as long as it lasts. All non-attack rolls have Disadvantage.</div><div class="fs-notes">${cost} Energy</div>` });
}

/** Start of your turn: Berserk would end. Returns what was active so the start-of-turn card can offer to maintain it. */
async function berserkTurnStart(actor) {
  if (!actor.statuses?.has("berserk")) return null;
  const red = actor.statuses.has("seeingRed");
  const cost = actor.getFlag("flowstate", "berserkCost") ?? 0;
  await setStatus(actor, "berserk", false);
  if (red) await setStatus(actor, "seeingRed", false);
  return { cost, red };
}

/**
 * Start of your turn: one card with the abilities used "at the start of your turn" that you could use now:
 * Maintain Berserk or Berserk (Striker T2), Proper Stance (Assault T5), and Quicken (Unarmored T4).
 */
async function startOfTurnCard(actor, kept) {
  const rows = [];
  if (kept) rows.push(`<button type="button" class="fs-turn-start" data-op="maintain"><i class="fa-solid fa-fire"></i> Maintain Berserk (⚡ ${kept.cost}${kept.red ? " · Seeing Red continues" : ""})</button>`);
  else if (ab.treeTier(actor, ab.STRIKER) >= 2 && ab.strikerHeld(actor, 2).length) {
    rows.push(`<button type="button" class="fs-turn-start" data-op="berserk"><i class="fa-solid fa-fire"></i> Berserk (⚡ ${ab.STRIKER_COST.berserk(bestWeapon(ab.strikerHeld(actor, 2)))})</button>`);
  }
  if (ab.treeTier(actor, ab.ASSAULT) >= 5 && ab.assaultHeld(actor, 5).length) {
    rows.push(`<button type="button" class="fs-turn-start" data-op="properStance"><i class="fa-solid fa-person-rifle"></i> Proper Stance (⚡ ${ab.ASSAULT_COST.properStance(bestWeapon(ab.assaultHeld(actor, 5)))})</button>`);
  }
  if (ab.unarmoredT(actor, 4)) rows.push(`<button type="button" class="fs-turn-start" data-op="quicken"><i class="fa-solid fa-forward-fast"></i> Quicken (⚡ ${ab.UNARMORED_COST.quicken(actor)})</button>`);
  if (!rows.length) return;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="flowstate-card"><header class="fs-card-title">Start of turn — ${esc(actor.name)}</header>
      <div class="fs-notes">${kept ? "Berserk ends unless you maintain it. " : ""}Abilities you can use at the start of your turn:</div>
      <div class="fs-brawl-row fs-turn-start-row" data-role="attacker" data-owner="${actor.uuid}">${rows.join("")}</div></div>`,
    flags: { flowstate: { startCard: { actor: actor.uuid, round: game.combat?.round ?? null, berserk: kept } } }
  });
}

/** Use an ability from the start-of-turn card (this turn only). */
export async function startOfTurn(card, op) {
  const info = card.getFlag("flowstate", "startCard");
  if (!info) return;
  const actor = await fromUuid(info.actor);
  if (!actor?.isOwner) return ui.notifications.warn("You don't control that character.");
  if (inActiveCombat(actor) && (game.combat.round !== info.round || !onOwnTurn(actor))) return ui.notifications.warn("That can only be used at the start of the turn it was offered.");
  if (op === "maintain") {
    if (actor.statuses?.has("berserk")) return ui.notifications.info(`${actor.name} is already Berserk.`);
    if (!(await spendEnergy(actor, info.berserk.cost, "maintaining Berserk"))) return;
    await setStatus(actor, "berserk", true);
    if (info.berserk.red) await setStatus(actor, "seeingRed", true);
    ui.notifications.info(`${actor.name} stays Berserk${info.berserk.red ? " (and Seeing Red)" : ""}.`);
  } else if (op === "berserk") await berserk(actor);
  else if (op === "properStance") await properStance(actor);
  else if (op === "quicken") await quicken(actor);
  ui.chat?.updateMessage?.(card);
}

/** Unstoppable (Strength T5): any time; until the start of your next turn. */
export async function unstoppable(actor) {
  if (cantAct(actor, "do that")) return;
  if (!ab.strength(actor, 5)) return ui.notifications.warn("Unstoppable requires Strength Methods Tier 5.");
  if (actor.statuses?.has("unstoppable")) return ui.notifications.info(`${actor.name} is already Unstoppable.`);
  const cost = ab.STRENGTH_COST.unstoppable(actor);
  if (!(await spendEnergy(actor, cost, "Unstoppable"))) return;
  await setStatus(actor, "unstoppable", true);
  await post(actor, { title: `${esc(actor.name)} — Unstoppable`, body: `<div class="fs-result">Until the start of ${esc(actor.name)}'s next turn: Advantage on rolls to block negative conditions and effects, and stats count as twice as high to resist them.</div><div class="fs-notes">${cost} Energy</div>` });
}

/** Why Proper Stance can't be used now. */
export function properStanceBlocked(actor) {
  if (ab.treeTier(actor, ab.ASSAULT) < 5) return "Requires Assault Weapons Tier 5.";
  if (actor.statuses?.has("properStance")) return "Already in Proper Stance.";
  if (!ab.assaultHeld(actor, 5).length) return "Hold an Assault weapon.";
  if (inActiveCombat(actor) && !onOwnTurn(actor)) return "Only at the start of your turn.";
  return "";
}

/** Proper Stance (Assault T5): Assault attacks have Solitary+ until the start of your next turn; swapping weapons ends it. */
export async function properStance(actor) {
  if (cantAct(actor, "do that")) return;
  const blocked = properStanceBlocked(actor);
  if (blocked) return ui.notifications.warn(`Proper Stance: ${blocked}`);
  const cost = ab.ASSAULT_COST.properStance(bestWeapon(ab.assaultHeld(actor, 5)));
  if (!(await spendEnergy(actor, cost, "Proper Stance"))) return;
  await setStatus(actor, "properStance", true);
  await post(actor, { title: `${esc(actor.name)} — Proper Stance`, body: `<div class="fs-result">Assault weapon attacks have Solitary+ until the start of ${esc(actor.name)}'s next turn. Swapping weapons ends it.</div><div class="fs-notes">${cost} Energy</div>` });
}

/** Trudge (Heavy T2 / Titanic T4): the next move ignores the armor's movement penalty. */
export async function trudge(actor) {
  if (cantAct(actor, "move")) return;
  const cost = ab.trudgeCost(actor);
  if (cost === null) return ui.notifications.warn(`${actor.name} needs Trudge for the armor they're wearing (Heavy T2 or Titanic T4).`);
  if (actor.getFlag("flowstate", "trudge")) return ui.notifications.info("Trudge is already ready for the next move.");
  if (!(await spendEnergy(actor, cost, "Trudge"))) return;
  await actor.setFlag("flowstate", "trudge", true);
  ui.notifications.info(`Trudge: ${actor.name}'s next move costs normal AP (${cost} Energy).`);
}

/**
 * Bodyslam (Heavy T3 / Titanic T2, with Disadvantage): 3 AP, an attack roll against one target in personal melee range;
 * on a hit, Physical damage equal to your armor's Limit plus your CON min. Launch (Heavy T5): Force 10× that instead.
 */
export async function bodyslam(actor) {
  if (cantAct(actor, "attack")) return;
  const info = ab.bodyslamInfo(actor);
  if (!info) return ui.notifications.warn(`${actor.name} needs Bodyslam (Heavy T3 in Heavy armor, or Titanic T2 in Titanic armor).`);
  const targets = [...(game.user.targets ?? [])].map(t => t.actor).filter(a => a && a.type !== "pile" && a.uuid !== actor.uuid);
  if (targets.length !== 1) return ui.notifications.warn("Target exactly one creature to Bodyslam.");
  const armor = actor.system.armor;
  const amount = (armor?.system.profile?.limit ?? 0) + ab.statMinOf(actor, "con");
  const opts = await optionsDialog("Bodyslam", `
    <p class="hint">3 AP · ${info.cost} Energy · attack roll${info.net ? " with Disadvantage" : ""} against ${esc(targets[0].name)} (personal melee range).
      On a hit: <strong>${amount}</strong> Physical (armor Limit ${armor?.system.profile?.limit ?? 0} + CON min).</p>
    ${info.launch ? `<div class="form-group"><label>Launch: on a hit, apply Force ${10 * amount} (10×) instead of damage</label><input type="checkbox" name="launch"></div>` : ""}
    ${netField()}`, "Bodyslam");
  if (!opts) return;
  if (!checkRange(actor, actor.system.derived.size.melee, "a Bodyslam", targets[0].getActiveTokens?.() ?? [])) return;
  if (inActiveCombat(actor) && actor.system.energy.value < info.cost) return ui.notifications.warn(`${actor.name} needs ${info.cost} Energy for Bodyslam.`);
  if (!(await spendAP(actor, 3, "Bodyslam"))) return;
  if (!(await spendEnergy(actor, info.cost, "Bodyslam"))) return;
  const launch = !!opts.launch && info.launch;
  return performAttack(actor, {
    label: launch ? "Bodyslam (Launch)" : "Bodyslam", net: opts.net + info.net - actor.system.penalties.physicalDis, melee: true, push: false,
    damage: launch ? "" : String(amount), type: "physical", stacks: -actor.system.penalties.physicalWeakened, physical: true, shots: 1,
    launchForce: launch ? 10 * amount : null, turnKey: turnKey(), followups: [],
    notes: [`Bodyslam · 3 AP · ${info.cost} Energy${info.net ? " · Disadvantage (Titanic)" : ""}${launch ? ` · Launch (Force ${10 * amount})` : ""}`],
    targetActors: targets
  });
}

/**
 * Bounce (Defender T4): after a Shield Toss hits, send it at another creature within throw range of the one it hit.
 * Each bounce adds a Disadvantage; a miss leaves the shield by that creature.
 */
export async function shieldBounce(defenseMessage) {
  const defense = defenseMessage.getFlag("flowstate", "defense");
  if (!defense?.result?.hit) return;
  if (game.messages.find(m => m.getFlag("flowstate", "attack")?.opts?.bounceOf === defenseMessage.id)) return ui.notifications.info("That shield already bounced.");
  const attacker = await fromUuid(defense.attacker);
  const from = await fromUuid(defense.target);
  if (!attacker?.isOwner) return ui.notifications.warn(`Only ${attacker?.name ?? "the thrower"}'s owner can Bounce.`);
  const o = game.messages.get(defense.attackMessage)?.getFlag("flowstate", "attack")?.opts ?? {};
  const shield = o.shieldToss ? await fromUuid(o.shieldToss.item) : null;
  if (!shield || shield.parent?.uuid !== attacker.uuid) return ui.notifications.warn("The shield isn't in hand any more.");
  const picks = [...(game.user.targets ?? [])].map(t => t.actor).filter(a => a && a.type !== "pile" && a.uuid !== from?.uuid && a.uuid !== attacker.uuid);
  if (picks.length !== 1) return ui.notifications.warn("Target exactly one other creature to bounce the shield to.");
  const next = picks[0];
  const range = THROW[shield.system.profile.throwType]?.range ?? 100;
  const a = from?.getActiveTokens?.()[0], b = next.getActiveTokens?.()[0];
  if (a && b && globalThis.canvas?.grid && tokenDistance(a, b) > range) return ui.notifications.warn(`${next.name} is out of throw range (${range} ft) from ${from.name}.`);
  const bounces = (o.shieldToss.bounces ?? 0) + 1;
  return performAttack(attacker, {
    ...o, net: (o.net ?? 0) - 1, followups: [], followupOf: null, targetActors: [next], bounceOf: defenseMessage.id,
    shieldToss: { ...o.shieldToss, bounces }, label: `${shield.name} — Bounce ${bounces}`,
    notes: [`Bounce ${bounces} from ${from?.name ?? "the last target"} (Disadvantage stacks)`]
  });
}

/** Start of your turn for the later trees: Berserk would end, Unstoppable and Proper Stance end. Runs on the GM. */
export async function treesTurnStart(actor) {
  if (!actor?.isOwner) return;
  await clearParries(actor);
  await shroudTurnStart(actor);
  const kept = await berserkTurnStart(actor);
  for (const st of ["unstoppable", "properStance", "quickened"]) if (actor.statuses?.has(st)) await actor.toggleStatusEffect(st, { active: false });
  await clearPlacedEffects(actor);
  if (!helpless(actor)) await startOfTurnCard(actor, kept);
}

/* ---- Reach Weapons: Palisade / Wall ---- */

/**
 * A token moved: if it came into the reach of a creature with Palisade (Reach T1) and a held Reach weapon, post a card
 * that lets them strike it (RP = attack AP; Wall, T3, costs Energy instead). Called before the move lands.
 */
export async function checkPalisade(token, dest) {
  const combat = game.combat;
  if (!combat?.started || !globalThis.canvas?.grid || !token?.object) return;
  const mover = token.actor;
  if (!mover || mover.type === "pile" || !combat.combatants.some(c => c.actor?.uuid === mover.uuid)) return;
  const gs = canvas.grid.size;
  const w = (token.width ?? 1) * gs, h = (token.height ?? 1) * gs;
  const oldC = { x: token.x + w / 2, y: token.y + h / 2 }, newC = { x: (dest.x ?? token.x) + w / 2, y: (dest.y ?? token.y) + h / 2 };
  for (const t of canvas.tokens.placeables) {
    const a = t.actor;
    if (!a || t.id === token.id || a.type === "pile" || helpless(a) || t.document.disposition === token.disposition) continue;
    const weapons = ab.reachHeld(a, 1);
    if (!weapons.length) continue;
    const reach = (a.system.derived?.size?.melee ?? 5) * Math.max(...weapons.map(i => i.system.profile.farstrike ?? 1));
    const before = canvas.grid.measurePath([t.center, oldC]).distance, after = canvas.grid.measurePath([t.center, newC]).distance;
    if (before <= reach || after > reach) continue;
    const wall = ab.reachHeld(a, 3).length > 0;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: a }),
      content: `<div class="flowstate-card"><header class="fs-card-title">Palisade — ${esc(mover.name)} enters ${esc(a.name)}'s reach</header>
        <div class="fs-notes">Strike ${esc(mover.name)} now; on a hit their move is cancelled just outside your reach.</div>
        <div class="fs-brawl-row fs-palisade-row" data-role="attacker" data-owner="${a.uuid}">
          <button type="button" class="fs-palisade"><i class="fa-solid fa-person-rifle"></i> Palisade (RP = attack AP)</button>
          ${wall ? `<button type="button" class="fs-palisade" data-wall="1"><i class="fa-solid fa-road-barrier"></i> Wall (no RP · ⚡ ${Math.min(...ab.reachHeld(a, 3).map(ab.REACH_COST.wall))})</button>` : ""}</div></div>`,
      flags: { flowstate: { palisadeCard: { wielder: a.uuid, mover: mover.uuid, token: token.uuid, x: token.x, y: token.y } } }
    });
  }
}

/**
 * Where a Palisade stops the mover: on the line from where its move started toward the wielder, the closest spot that is
 * still just outside the wielder's reach. Returns a top-left position.
 */
function palisadeSpot(tokenDoc, from, wielder, weapon) {
  const gs = canvas.grid.size;
  const w = (tokenDoc.width ?? 1) * gs, h = (tokenDoc.height ?? 1) * gs;
  const wTok = attackerToken(wielder);
  if (!wTok) return { x: from.x, y: from.y };
  const reach = (wielder.system.derived?.size?.melee ?? 5) * (weapon?.system?.profile?.farstrike ?? 1);
  const start = { x: from.x + w / 2, y: from.y + h / 2 };
  const dx = wTok.center.x - start.x, dy = wTok.center.y - start.y, len = Math.hypot(dx, dy) || 1;
  const step = { x: (dx / len) * gs, y: (dy / len) * gs };
  // Walk from the start toward the wielder, one grid space at a time, keeping the last snapped spot still outside reach.
  const snap = c => (canvas.grid.isGridless ? { x: c.x - w / 2, y: c.y - h / 2 } : { x: Math.round((c.x - w / 2) / gs) * gs, y: Math.round((c.y - h / 2) / gs) * gs });
  const outside = tl => canvas.grid.measurePath([wTok.center, { x: tl.x + w / 2, y: tl.y + h / 2 }]).distance > reach;
  let best = { x: from.x, y: from.y };
  for (let i = 1; i < 200; i++) {
    const tl = snap({ x: start.x + step.x * i, y: start.y + step.y * i });
    if (!outside(tl)) break;
    best = tl;
  }
  return best;
}

/** Palisade / Wall from its card. */
export async function palisade(card, wall = false) {
  const info = card.getFlag("flowstate", "palisadeCard");
  if (!info) return;
  const source = `${card.id}:palisade`;
  if (findFollowup(source)) return ui.notifications.info("That Palisade was already used.");
  const wielder = await fromUuid(info.wielder), mover = await fromUuid(info.mover);
  if (!wielder?.isOwner) return ui.notifications.warn(`You don't control ${wielder?.name ?? "that character"}.`);
  if (!mover) return;
  const weapons = ab.reachHeld(wielder, wall ? 3 : 1);
  if (!weapons.length) return ui.notifications.warn(`${wielder.name} needs a held Reach weapon.`);
  let item = weapons[0];
  if (weapons.length > 1) {
    const opts = await optionsDialog(wall ? "Wall" : "Palisade", `<div class="form-group"><label>Weapon</label><select name="item">
      ${weapons.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join("")}</select></div>`, "Choose");
    if (!opts) return;
    item = wielder.items.get(opts.item) ?? item;
  }
  return rollWeaponAttack(wielder, item, { kind: wall ? "wall" : "palisade", net: 0, label: wall ? "Wall" : "Palisade", source, targetActors: [mover],
    palisadeFrom: { token: info.token, x: info.x, y: info.y } });
}

/** Spot Weakness (Dexterity T4): 1 AP, like Spotting, against a creature you already sense: reveals its armor and stats to you. */
export async function spotWeakness(actor) {
  if (cantAct(actor, "do that")) return;
  if (!ab.dexterity(actor, 4)) return ui.notifications.warn("Spot Weakness requires Dexterity Methods Tier 4.");
  const targets = [...(game.user.targets ?? [])].map(t => t.actor).filter(a => a && a.type !== "pile" && a.uuid !== actor.uuid);
  if (targets.length !== 1) return ui.notifications.warn("Target exactly one creature you can already sense.");
  const t = targets[0];
  const cost = ab.DEXTERITY_COST.spotWeakness(actor);
  if (inActiveCombat(actor) && actor.system.energy.value < cost) return ui.notifications.warn(`${actor.name} needs ${cost} Energy for Spot Weakness.`);
  if (!(await spendAP(actor, 1, "Spot Weakness"))) return;
  if (!(await spendEnergy(actor, cost, "Spot Weakness"))) return;
  const armor = t.system.armor;
  const p = armor?.system.profile;
  const body = armor && p?.valid
    ? `<div class="fs-result">${esc(t.name)} wears <strong>${esc(armor.name)}</strong> (${esc(p.label)}, Grade ${p.grade}).</div>
      <ul class="fs-list"><li>Limit ${p.limit}</li><li>Durability ${armor.system.durability.value}/${armor.system.durability.max}</li>
      ${p.stealthDis ? `<li>Stealth ${p.stealthDis === Infinity ? "auto-fails" : `Disadvantage ×${p.stealthDis}`}</li>` : ""}<li>${p.moveAP} AP per move</li>${p.effect ? `<li>${esc(p.effect)}</li>` : ""}</ul>`
    : `<div class="fs-result">${esc(t.name)} isn't wearing armor.</div>`;
  const whisper = game.users?.filter?.(u => u.isGM || actor.testUserPermission?.(u, "OWNER")).map(u => u.id) ?? [];
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), whisper,
    content: `<div class="flowstate-card"><header class="fs-card-title">Spot Weakness — ${esc(t.name)}</header>${body}<div class="fs-notes">1 AP · ${cost} Energy</div></div>` });
}

/** Dip (Brawling T2): when the Dip took a hit to 0, spend 1 RP to move your speed right away. */
export async function dipMove(damageMessage) {
  const d = damageMessage.getFlag("flowstate", "damage");
  if (!d) return;
  if (game.messages.find(m => m.getFlag("flowstate", "dipOf") === damageMessage.id)) return ui.notifications.info("That Dip move was already used.");
  const actor = await fromUuid(d.target);
  if (!actor?.isOwner) return ui.notifications.warn("You don't control that character.");
  if (!(await spendPoints(actor, "rp", 1, "a Dip move"))) return;
  await actor.setFlag("flowstate", "freeMove", true);
  await post(actor, { title: `${esc(actor.name)} — Dip`, body: `<div class="fs-result">${esc(actor.name)} can move up to ${actor.system.movement?.speed ?? "their"} ft right now (1 RP).</div>`,
    flags: { flowstate: { dipOf: damageMessage.id } } });
}

/** The move after a Dash reaction (Unarmored T1), from the defense card: 1 RP (+ slows). Once. */
export async function dashMove(defenseMessage) {
  const d = defenseMessage.getFlag("flowstate", "defense");
  if (!d) return;
  if (game.messages.find(m => m.getFlag("flowstate", "dashMoveOf") === defenseMessage.id)) return ui.notifications.info("That Dash move was already used.");
  const actor = await fromUuid(d.target);
  if (!actor?.isOwner) return ui.notifications.warn("You don't control that character.");
  if (cantAct(actor, "move")) return;
  const rp = slowedCost(actor);
  if (!(await spendPoints(actor, "rp", rp, "a Dash move"))) return;
  await actor.setFlag("flowstate", "freeMove", true);
  await post(actor, { title: `${esc(actor.name)} — Dash`, body: `<div class="fs-result">${esc(actor.name)} can move up to ${actor.system.movement?.speed ?? "their"} ft right now (${rp} RP).</div>`,
    flags: { flowstate: { dashMoveOf: defenseMessage.id } } });
}

/** Momentum (Curved T3) from a defense card: +1 Advantage or Strengthened on this target. Once per hit. */
export async function addMomentum(defenseMessage, kind) {
  const defense = defenseMessage.getFlag("flowstate", "defense");
  if (!defense?.result?.hit) return;
  if (game.messages.find(m => m.getFlag("flowstate", "momentumOf") === defenseMessage.id)) return ui.notifications.info("Momentum was already added for this hit.");
  const attacker = await fromUuid(defense.attacker), target = await fromUuid(defense.target);
  if (!attacker?.isOwner) return ui.notifications.warn(`Only ${attacker?.name ?? "the attacker"}'s owner can do that.`);
  if (!target) return;
  const cur = momentumOf(target, attacker);
  const next = { adv: cur.adv + (kind === "adv" ? 1 : 0), str: cur.str + (kind === "str" ? 1 : 0) };
  await setActorFlag(target, `momentum.${attacker.id}`, next);
  await post(attacker, { title: `${esc(attacker.name)} — Momentum`, body: `<div class="fs-result">Curved attacks on ${esc(target.name)}: +${next.adv} Advantage, +${next.str} Strengthened (${next.adv + next.str} stacks) until ${esc(attacker.name)}'s next turn.</div>`,
    flags: { flowstate: { momentumOf: defenseMessage.id } } });
}

/** Start of a creature's turn: effects it placed on others end (Momentum, Like Shooting Fish, Slice, Taunt). Runs on the GM. */
export async function clearPlacedEffects(owner) {
  if (!game.user.isGM) return;
  const pool = new Map();
  for (const a of game.actors ?? []) pool.set(a.uuid, a);
  for (const t of globalThis.canvas?.tokens?.placeables ?? []) if (t.actor) pool.set(t.actor.uuid, t.actor);
  for (const a of pool.values()) {
    if (a.getFlag?.("flowstate", `momentum.${owner.id}`)) await a.unsetFlag("flowstate", `momentum.${owner.id}`);
    if (a.getFlag?.("flowstate", "fishyBy") === owner.uuid) { await a.unsetFlag("flowstate", "fishyBy"); if (a.statuses?.has("fishy")) await a.toggleStatusEffect("fishy", { active: false }); }
    if (a.getFlag?.("flowstate", "slicedBy") === owner.uuid) { await a.unsetFlag("flowstate", "slicedBy"); if (a.statuses?.has("sliced")) await a.toggleStatusEffect("sliced", { active: false }); }
    if (a.getFlag?.("flowstate", "tauntedBy")?.by === owner.uuid) { await a.unsetFlag("flowstate", "tauntedBy"); if (a.statuses?.has("taunted")) await a.toggleStatusEffect("taunted", { active: false }); }
  }
}

/** Curved damage this actor dealt to HP during the current turn (for Sheath Weapon). */
export function curvedDamageThisTurn(actor) {
  const key = turnKey();
  if (!key) return [];
  return game.messages.filter(m => {
    const d = m.getFlag("flowstate", "damage");
    return d?.curved && d.attacker === actor.uuid && d.turnKey === key && d.toHp > 0;
  }).map(m => m.getFlag("flowstate", "damage"));
}

/** Why Sheath Weapon can't be used right now ("" if it can). */
export function sheathBlocked(actor) {
  if (ab.treeTier(actor, ab.CURVED) < 4) return "Requires Curved Weapons Tier 4.";
  if (!onOwnTurn(actor)) return "Only at the end of your turn, in combat.";
  if (actor.getFlag("flowstate", "sheathUsed") === turnKey()) return "Already used this turn.";
  if (!ab.curvedHeld(actor, 4).length) return "Hold a Curved weapon.";
  if (!curvedDamageThisTurn(actor).length) return "Deal direct damage with Curved attacks this turn first.";
  return "";
}

/** Sheath Weapon (Curved T4): at the end of your turn, repeat this turn's direct Curved damage as twice as much normal damage. */
export async function sheathWeapon(actor) {
  const blocked = sheathBlocked(actor);
  if (blocked) return ui.notifications.warn(`Sheath Weapon: ${blocked}`);
  const weapon = bestWeapon(ab.curvedHeld(actor, 4));
  const cost = ab.CURVED_COST.sheath(weapon);
  const hits = curvedDamageThisTurn(actor);
  const ok = await DialogV2().confirm({ window: { title: "Sheath Weapon" }, rejectClose: false,
    content: `<p>Repeat ${hits.length} hit${hits.length === 1 ? "" : "s"} of Curved damage (${hits.reduce((n, h) => n + h.toHp, 0)} direct) as normal damage, for <strong>${cost} Energy</strong>?</p>` });
  if (!ok || sheathBlocked(actor)) return;
  if (!(await spendEnergy(actor, cost, "Sheath Weapon"))) return;
  await actor.setFlag("flowstate", "sheathUsed", turnKey());
  let body = "";
  for (const h of hits) {
    const target = await fromUuid(h.target);
    if (!target) continue;
    const amount = h.toHp;
    body += damageOutcomeHTML(target, amount, h.type, await damageOutcome(target, amount, h.type));
    await requestDamage(target, amount, h.type, 0, null, { silent: true });
  }
  await post(actor, { title: `${esc(actor.name)} — Sheath Weapon`, body: `<div class="fs-notes">${cost} Energy · this turn's direct Curved damage, repeated (armor applies)</div>${body}` });
}

/* ---- Grappling Methods ---- */

/** Lock Down (Grappling T1): a creature you have grappled is forced prone and can't move; escaping only removes the Lock Down. */
export async function lockDown(actor) {
  if (cantAct(actor, "do that")) return;
  if (!ab.grappling(actor, 1)) return ui.notifications.warn("Lock Down requires Grappling Methods Tier 1.");
  const victims = grappledBy(actor).filter(v => v.getFlag?.("flowstate", "lockedDown") !== actor.uuid);
  if (!victims.length) return ui.notifications.warn(`${actor.name} has no grappled creature to Lock Down.`);
  let victim = victims[0];
  if (victims.length > 1) {
    const opts = await optionsDialog("Lock Down", `<div class="form-group"><label>Grappled creature</label><select name="uuid">
      ${victims.map(v => `<option value="${v.uuid}">${esc(v.name)} — ${ab.GRAPPLING_COST.lockDown(v)} Energy</option>`).join("")}</select></div>`, "Lock Down");
    if (!opts) return;
    victim = victims.find(v => v.uuid === opts.uuid) ?? victim;
  }
  const cost = ab.GRAPPLING_COST.lockDown(victim);
  if (!(await spendEnergy(actor, cost, "Lock Down"))) return;
  await setActorFlag(victim, "lockedDown", actor.uuid);
  await setStatus(victim, "prone", true);
  await post(actor, { title: `${esc(actor.name)} — Lock Down`, body: `<div class="fs-result">${esc(victim.name)} is Locked Down: prone, can't move, and must escape twice.</div><div class="fs-notes">${cost} Energy (${esc(victim.name)}'s STR)</div>` });
}

/**
 * Disrupt (Grappling T2): your grappled creature's next roll has Disadvantage (paid now, used up on their roll).
 * Stunlock (T4): free on a creature you've Locked Down, and it then applies to all of their rolls.
 */
export async function disrupt(actor) {
  if (cantAct(actor, "do that")) return;
  if (!ab.grappling(actor, 2)) return ui.notifications.warn("Disrupt requires Grappling Methods Tier 2.");
  const victims = grappledBy(actor).filter(v => !v.getFlag?.("flowstate", "disrupted"));
  if (!victims.length) return ui.notifications.warn(`${actor.name} has no grappled creature left to Disrupt.`);
  let victim = victims[0];
  if (victims.length > 1) {
    const opts = await optionsDialog("Disrupt", `<div class="form-group"><label>Grappled creature</label><select name="uuid">
      ${victims.map(v => `<option value="${v.uuid}">${esc(v.name)}</option>`).join("")}</select></div>`, "Disrupt");
    if (!opts) return;
    victim = victims.find(v => v.uuid === opts.uuid) ?? victim;
  }
  const stun = ab.grappling(actor, 4) && victim.getFlag?.("flowstate", "lockedDown") === actor.uuid;
  const cost = stun ? 0 : ab.GRAPPLING_COST.disrupt(victim);
  if (!(await spendEnergy(actor, cost, "Disrupt"))) return;
  await setActorFlag(victim, "disrupted", { by: actor.uuid, auto: stun });
  await post(actor, { title: `${esc(actor.name)} — Disrupt`, body: `<div class="fs-result">${stun ? `Every roll ${esc(victim.name)} makes has Disadvantage while Locked Down (Stunlock).` : `${esc(victim.name)}'s next roll has Disadvantage.`}</div><div class="fs-notes">${stun ? "Free (Stunlock)" : `${cost} Energy (${esc(victim.name)}'s STR min)`}</div>` });
}

/**
 * Slam (Grappling T5): swing a grappled creature at a target (3 AP, an attack roll). On a hit, Force 10 × your STR drives it into
 * the target 0 ft away: both take the Force damage (capped at the held creature's HP). It stays grappled.
 */
export async function slamGrappled(actor) {
  if (cantAct(actor, "attack")) return;
  if (!ab.grappling(actor, 5)) return ui.notifications.warn("Slam requires Grappling Methods Tier 5.");
  const victim = await pickGrappled(actor, "Slam");
  if (!victim) return;
  const targets = [...(game.user.targets ?? [])].map(t => t.actor).filter(a => a && a.type !== "pile" && a.uuid !== victim.uuid && a.uuid !== actor.uuid);
  if (targets.length !== 1) return ui.notifications.warn("Target exactly one creature to Slam into.");
  const force = 10 * actor.system.derived.effective.str.value;
  const opts = await optionsDialog(`Slam ${victim.name}`, `<p class="hint">Melee attack roll against ${esc(targets[0].name)}. On a hit, Force ${force} (10 × Str) at 0 ft: both take Force damage.</p>
    <div class="form-group"><label>Used as a</label><select name="weight"><option value="heavy">Heavy weapon (3 AP)</option><option value="light">Light weapon (2 AP)</option></select></div>
    <p class="hint">Pick whichever its body type most closely matches.</p>${netField()}`, "Slam");
  if (!opts) return;
  const ap = opts.weight === "light" ? 2 : 3;
  if (!checkRange(actor, actor.system.derived.size.melee, "a Slam", targets[0].getActiveTokens?.() ?? [])) return;
  if (!(await spendAP(actor, ap, "Slam"))) return;
  return performAttack(actor, {
    label: `Slam: ${victim.name}`, net: opts.net - actor.system.penalties.physicalDis, stealth: "none", melee: true,
    damage: "", type: "physical", stacks: 0, physical: false, shots: 1,
    throwGrappled: victim.uuid, throwForce: force, knockInto: true, slamGrappled: true,
    notes: [`${victim.name} is used as a ${opts.weight === "light" ? "Light" : "Heavy"} weapon (${ap} AP · Force ${force}, 0 ft)`], targetActors: targets
  });
}

/* ---- Constitution Methods: Taunt / Pull Aggro ---- */

/**
 * Taunt (Constitution T2, 2 RP): a contested Persuasion/Deception roll against a creature within 100 ft; on a win they're compelled
 * to attack you until your next turn. Pull Aggro (T4) does it against every targeted creature within 30 ft.
 */
export async function taunt(actor, { aggro = false } = {}) {
  if (cantAct(actor, "do that")) return;
  if (!ab.constitution(actor, aggro ? 4 : 2)) return ui.notifications.warn(`${aggro ? "Pull Aggro" : "Taunt"} requires Constitution Methods Tier ${aggro ? 4 : 2}.`);
  const targets = [...(game.user.targets ?? [])].map(t => t.actor).filter(a => a && a.type !== "pile" && a.uuid !== actor.uuid);
  if (!targets.length || (!aggro && targets.length !== 1)) return ui.notifications.warn(aggro ? "Target every creature within 30 ft to Pull Aggro on." : "Target exactly one creature to Taunt.");
  if (!checkRange(actor, aggro ? 30 : 100, aggro ? "Pull Aggro" : "Taunt", targets.flatMap(a => a.getActiveTokens?.() ?? []))) return;
  const opts = await optionsDialog(aggro ? "Pull Aggro" : "Taunt", `<div class="form-group"><label>Check</label><select name="check"><option value="Persuasion">Persuasion</option><option value="Deception">Deception</option></select></div>${netField()}`, "Taunt");
  if (!opts) return;
  const cost = aggro ? ab.CONSTITUTION_COST.pullAggro(actor) : ab.CONSTITUTION_COST.taunt(actor);
  if (inActiveCombat(actor) && actor.system.energy.value < cost) return ui.notifications.warn(`${actor.name} needs ${cost} Energy.`);
  if (!(await spendPoints(actor, "rp", 2, aggro ? "Pull Aggro" : "Taunt"))) return;
  if (!(await spendEnergy(actor, cost, aggro ? "Pull Aggro" : "Taunt"))) return;
  let body = `<div class="fs-notes">${opts.check} vs each target's counter roll · 2 RP · ${cost} Energy</div>`;
  const rolls = [];
  for (const t of targets) {
    const res = await tauntContest(actor, t, opts.check, opts.net, 0);
    rolls.push(...res.rolls);
    body += res.html;
  }
  await post(actor, { title: `${esc(actor.name)} — ${aggro ? "Pull Aggro" : "Taunt"}`, rolls, body });
}

/** One Taunt contest: the taunter's d100 (with `dis` stacking Disadvantage) against the target's d100 counter roll. */
async function tauntContest(actor, target, check, net = 0, dis = 0) {
  const mine = await evaluate(poolFormula(1, 100, net - dis + exhaustionNet(actor) + seeingRedNet(actor)));
  const theirs = await evaluate(poolFormula(1, 100, exhaustionNet(target) + seeingRedNet(target)));
  const won = mine.total > theirs.total;
  if (won) {
    await setActorFlag(target, "tauntedBy", { by: actor.uuid, name: actor.name, check, repeats: dis });
    await setStatus(target, "taunted", true);
  } else if (target.getFlag?.("flowstate", "tauntedBy")?.by === actor.uuid) {
    await setActorFlag(target, "tauntedBy", null);
    await setStatus(target, "taunted", false);
  }
  return { rolls: [mine, theirs], html: `<div class="fs-result">${esc(actor.name)} ${mine.total}${dis ? ` (${dis}× Dis)` : ""} vs ${esc(target.name)} ${theirs.total}:
    <strong>${won ? `${esc(target.name)} is Taunted` : `${esc(target.name)} resists`}</strong></div>` };
}

/** A Taunted creature repeats the check (end of its turn, or 2 AP/RP); each repeat gives the taunter another Disadvantage. */
export async function shakeTaunt(actor, { pay = null } = {}) {
  const info = actor.getFlag?.("flowstate", "tauntedBy");
  if (!info) return;
  const taunter = await fromUuid(info.by);
  if (!taunter) { await setActorFlag(actor, "tauntedBy", null); return setStatus(actor, "taunted", false); }
  if (pay && !(await spendPoints(actor, pay, 2, "shaking off a Taunt"))) return;
  const res = await tauntContest(taunter, actor, info.check, 0, (info.repeats ?? 0) + 1);
  await post(actor, { title: `${esc(actor.name)} — resisting the Taunt`, rolls: res.rolls, body: `<div class="fs-notes">${pay ? `2 ${pay.toUpperCase()}` : "End of turn"}</div>${res.html}` });
}

/* ---- Unarmored: Quicken ---- */

/** Quicken (Unarmored T4): at the start of your turn with no armor on, double your movement speed until your next turn. */
export async function quicken(actor) {
  if (cantAct(actor, "do that")) return;
  if (!ab.unarmoredT(actor, 4)) return ui.notifications.warn("Quicken requires Unarmored Tier 4 and no armor.");
  if (actor.statuses?.has("quickened")) return ui.notifications.info(`${actor.name} is already Quickened.`);
  if (inActiveCombat(actor) && !onOwnTurn(actor)) return ui.notifications.warn("Quicken is used at the start of your turn.");
  const cost = ab.UNARMORED_COST.quicken(actor);
  if (!(await spendEnergy(actor, cost, "Quicken"))) return;
  await setStatus(actor, "quickened", true);
  await post(actor, { title: `${esc(actor.name)} — Quicken`, body: `<div class="fs-result">Movement speed doubled until the start of ${esc(actor.name)}'s next turn (ends if armor goes on).</div><div class="fs-notes">${cost} Energy</div>` });
}

/** Why Eviscerate can't be used right now ("" if it can). */
export function eviscerateBlocked(actor) {
  if (ab.treeTier(actor, ab.SWIFT) < 4) return "Requires Swift Weapons Tier 4.";
  if (!inActiveCombat(actor) || game.combat.combatant?.actor?.uuid !== actor.uuid) return "Only at the end of your turn, in combat.";
  if (actor.getFlag("flowstate", "eviscerateUsed") === turnKey()) return "Already used this turn.";
  if (!ab.swiftHeld(actor, 4).length) return "Hold a Swift weapon.";
  if (!swiftDamageThisTurn(actor).length) return "Deal direct damage with Swift attacks this turn first.";
  return "";
}

/**
 * Eviscerate (Swift T4): once at the end of your turn, repeat all direct (HP) damage your Swift attacks dealt this turn.
 * It bypasses armor and other objects. Energy = 2 × Scaling Stat min (your best held Swift weapon).
 */
export async function eviscerate(actor) {
  const blocked = eviscerateBlocked(actor);
  if (blocked) return ui.notifications.warn(`Eviscerate: ${blocked}`);
  const weapon = ab.swiftHeld(actor, 4).sort((a, b) => ab.scalingMin(b) - ab.scalingMin(a))[0];
  const cost = ab.SWIFT_COST.eviscerate(weapon);
  const hits = swiftDamageThisTurn(actor);
  const ok = await DialogV2().confirm({ window: { title: "Eviscerate" }, rejectClose: false,
    content: `<p>Repeat ${hits.length} hit${hits.length === 1 ? "" : "s"} of Swift damage (${hits.reduce((n, h) => n + h.toHp, 0)} total), bypassing armor, for <strong>${cost} Energy</strong>?</p>` });
  if (!ok) return;
  if (eviscerateBlocked(actor)) return;
  if (!(await spendEnergy(actor, cost, "Eviscerate"))) return;
  await actor.setFlag("flowstate", "eviscerateUsed", turnKey());
  let body = "";
  for (const h of hits) {
    const target = await fromUuid(h.target);
    if (!target) continue;
    body += damageOutcomeHTML(target, h.toHp, h.type, await damageOutcome(target, h.toHp, h.type, { bypass: true }));
    await requestDamage(target, h.toHp, h.type, 0, null, { silent: true, bypass: true });
  }
  await post(actor, { title: `${esc(actor.name)} — Eviscerate`, body: `<div class="fs-notes">${cost} Energy · repeats this turn's Swift damage, bypassing objects</div>${body}` });
}

/**
 * Riposte (Martial Theory T1): a Parry that took no direct damage (from the damage card), or a Perfect Parry/Block that
 * negated the attack (from the defense card). Attack the attacker with that weapon for RP = its attack AP.
 */
export async function riposte(message, { perfect = false, itemUuid = null } = {}) {
  const defense = message.getFlag("flowstate", "defense");
  const dmg = message.getFlag("flowstate", "damage");
  let defenderUuid, attackerUuid, item;
  if (dmg?.riposte) { defenderUuid = dmg.target; attackerUuid = dmg.attacker; item = itemUuid ? await fromUuid(itemUuid) : null; }
  else if (defense?.result?.parry?.success) {
    const p = defense.result.parry;
    defenderUuid = p.by ?? defense.target; attackerUuid = defense.attacker; item = await fromUuid(itemUuid ?? p.item);
  } else return;
  if (findFollowup(message.id) || riposteInFlight.has(message.id)) return ui.notifications.info("Riposte was already used.");
  if (findRiposteDeclined(message.id)) return ui.notifications.info("The Riposte was passed on.");
  const defender = await fromUuid(defenderUuid);
  const attacker = await fromUuid(attackerUuid);
  if (!defender || !attacker) return ui.notifications.warn("This exchange can no longer be resolved.");
  if (!defender.isOwner) return ui.notifications.warn(`Only ${defender.name}'s owner can Riposte.`);
  if (!item || item.parent?.uuid !== defender.uuid || !item.system.held) return ui.notifications.warn(`That weapon is no longer in ${defender.name}'s hands.`);
  riposteInFlight.add(message.id);
  try {
    if (perfect && !ab.bladed(defender, item, 5)) return ui.notifications.warn("Perfect Riposte needs Bladed Weapons Tier 5 and a weapon that can use it.");
    const unarmed = item.system.weaponType === "unarmed";
    return await rollWeaponAttack(defender, item, { riposte: true, perfect, net: 0, label: perfect ? "Perfect Riposte" : "Riposte",
      rp: unarmed ? null : item.system.profile?.ap, weight: null, source: message.id, targetActors: [attacker] });
  } finally {
    riposteInFlight.delete(message.id);
  }
}

/* ---- Martial Theory T0: Grappling ---- */

/** Turn a status on or off, through the GM when we don't own the actor. */
export async function setStatus(actor, status, active) {
  if (!actor) return;
  if (active && mentalHook?.blocked?.(actor, status)) return;
  if (!actor.isOwner) return requestGM("setStatus", { target: actor.uuid, status, active });
  if (actor.statuses.has(status) !== !!active) await actor.toggleStatusEffect(status, { active: !!active });
}

/** Grapple (grapplerUuid) or release (null) an actor. Routed through the GM when we don't own it. */
export async function setGrapple(actor, grappler) {
  if (!actor) return;
  if (!actor.isOwner) return requestGM("setGrapple", { target: actor.uuid, grappler: grappler ?? null });
  if (grappler) await actor.setFlag("flowstate", "grappledBy", grappler);
  else {
    if (actor.getFlag("flowstate", "grappledBy")) await actor.unsetFlag("flowstate", "grappledBy");
    for (const k of ["grappleWeapon", "grappleStatic", "lockedDown", "disrupted"]) if (actor.getFlag("flowstate", k)) await actor.unsetFlag("flowstate", k);
  }
  if (!!grappler !== actor.statuses.has("grappled")) await actor.toggleStatusEffect("grappled", { active: !!grappler });
}

/**
 * How a grappled creature is held, for movement:
 *   { static: true, why }            held in place by an effect rather than a creature (Gravity Hold, a thrown weapon that pins them):
 *                                    it can't move at all;
 *   { holder, leash, why }           held by another creature: it can move around them but not more than `leash` ft away (token borders),
 *                                    and it follows them when they move. Unarmed grapples reach the holder's melee range; a weapon
 *                                    grapple reaches the weapon's (Farstrike: Thrasher's long whip reaches 2× or 4×);
 *   null                             not grappled (or the holder isn't around).
 */
export function grappleHold(actor) {
  const by = actor?.getFlag?.("flowstate", "grappledBy");
  if (!by) return null;
  if (spellEffects(actor, "hold").length) return { static: true, why: "held in place by magical force" };
  const pinned = actor.getFlag?.("flowstate", "grappleStatic");
  if (pinned) return { static: true, why: pinned };
  const holder = syncUuid(by);
  if (!holder) return null;
  const melee = holder.system?.derived?.size?.melee ?? 5;
  const weaponId = actor.getFlag?.("flowstate", "grappleWeapon");
  const weapon = weaponId ? syncUuid(weaponId) : null;
  if (weapon) {
    // A weapon that has left its wielder's hands (thrown) holds them where it is.
    if (weapon.parent?.uuid !== holder.uuid) return { static: true, why: `pinned by ${weapon.name}` };
    return { holder, leash: melee * Math.max(1, weapon.system?.profile?.farstrike ?? 1), why: `${weapon.name}'s reach` };
  }
  return { holder, leash: melee, why: "their grapple" };
}

/** Can this grappled creature's token go to (x, y)? Returns null if so, else the reason it can't. */
export function grappleMoveBlock(actor, token, x, y) {
  const hold = grappleHold(actor);
  if (!hold) return null;
  if (hold.static) return `${token.name} is ${hold.why} and can't move.`;
  const hTok = attackerToken(hold.holder);
  if (!hTok || !globalThis.canvas?.grid) return null;
  const at = { document: { x, y, width: token.width, height: token.height } };
  const now = tokenDistance(token, hTok), then = tokenDistance(at, hTok);
  // Moving around the holder is fine, and so is moving back toward them if something left them outside the leash.
  if (then > Math.max(hold.leash, now)) return `${token.name} is grappled by ${hold.holder.name} and can't get more than ${hold.leash} ft from them (${hold.why}).`;
  return null;
}

/** When a creature moves, the creatures it holds (not pinned in place) follow by the same step. */
export async function dragGrappled(actor, token, from) {
  const dx = token.x - from.x, dy = token.y - from.y;
  if (!dx && !dy) return;
  for (const victim of grappledBy(actor)) {
    const hold = grappleHold(victim);
    if (!hold || hold.static) continue;
    const vTok = victim.getActiveTokens?.()[0];
    if (!vTok || vTok.parent?.id !== token.parent?.id) continue;
    await requestGM("moveToken", { uuid: vTok.document?.uuid ?? vTok.uuid, x: (vTok.document?.x ?? vTok.x) + dx, y: (vTok.document?.y ?? vTok.y) + dy });
  }
}

/** Actors (world actors and tokens on the current scene) grappled by this actor. */
export function grappledBy(actor) {
  const pool = new Map();
  for (const a of globalThis.game?.actors ?? []) pool.set(a.uuid, a);
  for (const t of globalThis.canvas?.tokens?.placeables ?? []) if (t.actor) pool.set(t.actor.uuid, t.actor);
  return [...pool.values()].filter(a => a.getFlag?.("flowstate", "grappledBy") === actor.uuid);
}

/** Choose one grappled creature (asks only when there's more than one). */
async function pickGrappled(actor, verb) {
  const victims = grappledBy(actor);
  if (!victims.length) { ui.notifications.warn(`${actor.name} isn't grappling anyone.`); return null; }
  if (victims.length === 1) return victims[0];
  const opts = await optionsDialog(`${verb}`, `<div class="form-group"><label>Grappled creature</label><select name="uuid">
    ${victims.map(v => `<option value="${v.uuid}">${esc(v.name)}</option>`).join("")}</select></div>`, verb);
  return opts ? victims.find(v => v.uuid === opts.uuid) ?? null : null;
}

/** Break free: 2 AP, an attack roll against the grappler's dodge. On a hit you're free. */
export async function breakFree(actor) {
  if (cantAct(actor, "break free")) return;
  const grapplerUuid = actor.getFlag("flowstate", "grappledBy");
  const burden = spellEffects(actor, "burden");
  if (!grapplerUuid && !actor.statuses.has("grappled") && !burden.length) return ui.notifications.warn(`${actor.name} isn't grappled.`);
  // Held by magic (Gravity T4 Hold): a roll of the held minimum or more breaks free, instead of beating the grappler's dodge.
  const hold = spellEffects(actor, "hold")[0];
  if (hold) {
    const min = hold.flags.flowstate.spellEffect.holdMin;
    if (!(await spendAP(actor, 2, "breaking free"))) return;
    const roll = await evaluate(`1d${actor.system.derived.attackDie}`);
    const freed = roll.total >= min;
    await post(actor, { title: `${esc(actor.name)} — Break Free (magical hold)`, rolls: [roll], body: `${await rollBlock(roll, `Attack die (d${actor.system.derived.attackDie}), needs ${min}+`)}<div class="fs-result">${freed ? "Breaks free!" : "Still held."}</div>` });
    // Mental (Below): Vice punishes a failed check, Quicksand can undo a successful one; a success also shakes off every Burden stack.
    const held = { ...hold.flags.flowstate.spellEffect, name: hold.name };
    if (freed) { await hold.delete(); await setGrapple(actor, null); for (const b of burden) await changeEffect(b, null); }
    await mentalHook?.afterBreakFree({ actor, held, freed });
    return;
  }
  // Mental (Below): Burden alone (nothing grappling them) is shaken off with a counter grapple check of 2 or higher.
  if (!grapplerUuid && !actor.statuses.has("grappled") && burden.length) {
    if (!(await spendAP(actor, 2, "shaking off Burden"))) return;
    const roll = await evaluate(`1d${actor.system.derived.attackDie}`);
    const need = Math.max(2, ...burden.map(b => Number(b.flags.flowstate.spellEffect.breakMin) || 0));       // 2 × Wonder Power
    const freed = roll.total >= need;
    await post(actor, { title: `${esc(actor.name)} — Break Free (Burden)`, rolls: [roll], body: `${await rollBlock(roll, `Attack die (d${actor.system.derived.attackDie}), needs ${need}+`)}<div class="fs-result">${freed ? "The weight is gone!" : "Still weighed down."}</div>` });
    const held = { ...burden[0].flags.flowstate.spellEffect, name: burden[0].name };
    if (freed) for (const b of burden) await changeEffect(b, null);
    await mentalHook?.afterBreakFree({ actor, held, freed });
    return;
  }
  const grappler = grapplerUuid ? await fromUuid(grapplerUuid) : null;
  if (!grappler) {
    await setGrapple(actor, null);
    return ui.notifications.info(`${actor.name}'s grappler is gone, so ${actor.name} is free.`);
  }
  const opts = await optionsDialog(`${actor.name} — Break Free`, `
    <p class="hint">Attack roll (d${actor.system.derived.attackDie}) against ${esc(grappler.name)}'s dodge · 2 AP. On a hit you break free.</p>${netField()}`, "Break free");
  if (!opts) return;
  if (!(await spendAP(actor, 2, "breaking free"))) return;
  return performAttack(actor, {
    label: "Break Free", net: opts.net - actor.system.penalties.physicalDis, stealth: "none", melee: true,
    damage: "", type: "physical", stacks: 0, physical: false, shots: 1,
    breakFree: true, notes: [`Break free from ${grappler.name}`], targetActors: [grappler]
  });
}

/** Let go of a grappled creature (free). */
export async function releaseGrapple(actor) {
  const victim = await pickGrappled(actor, "Release");
  if (!victim) return;
  await setGrapple(victim, null);
  await post(actor, { title: "Release", body: `<div class="fs-result">${esc(actor.name)} releases ${esc(victim.name)}.</div>` });
}

/** Throw Force for a grappled creature: 10 × Strength. */
export const grappleThrowForce = actor => 10 * actor.system.derived.effective.str.value;

/**
 * Throw a grappled creature (2 AP). Force = 10 × Str. At a living target: a ranged attack roll; on a hit
 * both collide and take Force damage (3 × the feet left untraveled), capped at the thrown creature's HP.
 * Without a target the creature is just thrown (released) as far as the Force carries it.
 */
export async function throwGrappled(actor) {
  if (cantAct(actor, "throw anything")) return;
  const victim = await pickGrappled(actor, "Throw");
  if (!victim) return;
  const force = grappleThrowForce(actor);
  let feet = forceFeet(force, victim, false);
  const crunchable = ab.strength(actor, 3);
  const crunchFeet = crunchable ? forceFeet(force, victim, true) : 0;
  const targets = [...(game.user.targets ?? [])].map(t => t.actor).filter(a => a && a.type !== "pile" && a.uuid !== victim.uuid);
  if (targets.length > 1) return ui.notifications.warn("Target only one creature to throw at.");
  const target = targets[0] ?? null;
  const opts = await optionsDialog(`Throw ${victim.name}`, `
    <p class="hint">Force ${force} (10 × Str) → ${esc(victim.name)} flies up to <strong>${feet} ft</strong> · 2 AP.</p>
    <p class="hint">${target ? `Ranged attack roll against ${esc(target.name)}. On a hit both collide and take Force damage.` : "No target: the creature is thrown in the direction you pick and released. Target a creature first to throw it at someone."}</p>
    ${crunchable ? `<div class="form-group"><label>Crunch Time <span class="fs-energy-inline">⚡ ${ab.STRENGTH_COST.crunchTime(actor)}</span>: match the Force against current HP (${crunchFeet} ft)</label><input type="checkbox" name="crunch"></div>` : ""}
    ${target ? netField() : `<div class="form-group"><label>Direction</label><select name="dir">${Object.entries(DIRECTIONS).map(([k, d]) => `<option value="${k}">${d.label}</option>`).join("")}
      <option value="down">Down (into the ground: Force damage, knocked prone)</option></select></div>`}`, "Throw");
  if (!opts) return;
  if (opts.crunch) feet = crunchFeet;
  if (target && !feet) return ui.notifications.warn(`${victim.name} is too heavy to throw at anything (Force ${force} moves it 0 ft).`);
  if (target && !checkRange(actor, feet, "this throw", target.getActiveTokens?.() ?? [])) return;
  if (!(await spendAP(actor, 2, `throwing ${victim.name}`))) return;
  if (opts.crunch && !(await spendEnergy(actor, ab.STRENGTH_COST.crunchTime(actor), "Crunch Time"))) return;
  if (!target) {
    await setGrapple(victim, null);
    if (opts.dir === "down") {
      return post(actor, { title: `Throw ${esc(victim.name)}`, body: `<div class="fs-result">Force ${force} → ${esc(victim.name)} is slammed into the ground and released.</div>
        ${await slamDown(victim, feet)}` });
    }
    const d = DIRECTIONS[opts.dir] ?? DIRECTIONS.n;
    const len = Math.hypot(d.x, d.y);
    const flight = await flyThrown(victim, { x: d.x / len, y: d.y / len }, feet);
    return post(actor, { title: `Throw ${esc(victim.name)}`, body: `<div class="fs-result">Force ${force} → ${esc(victim.name)} is thrown ${d.label.toLowerCase()} and released.</div>
      ${await flightHTML(victim, flight, feet)}` });
  }
  return performAttack(actor, {
    label: `Throw ${victim.name}`, net: (opts.net ?? 0) - actor.system.penalties.physicalDis, stealth: "none", melee: false,
    damage: "", type: "physical", stacks: 0, physical: false, shots: 1,
    throwGrappled: victim.uuid, throwForce: force, crunch: !!opts.crunch,
    notes: [`Thrown creature: ${victim.name} (Force ${force}, ${feet} ft${opts.crunch ? ", Crunch Time" : ""})`], targetActors: [target]
  });
}

/** Resolve a grapple throw once the target has responded. Moves the thrown token and returns chat HTML. */
async function resolveGrappleThrow(thrower, thrown, target, hit, force, { release = true, crunch = false, slam = false } = {}) {
  if (!thrown) return `<div class="fs-notes">The thrown creature no longer exists.</div>`;
  if (release) await setGrapple(thrown, null);
  const released = release ? " and is released" : "";
  const feet = forceFeet(force, thrown, crunch);
  const from = thrown.getActiveTokens?.()[0] ?? attackerToken(thrower);
  const to = target.getActiveTokens?.()[0];
  if (!hit && slam) return `<div class="fs-notes">The Slam misses; ${esc(thrown.name)} is still held.</div>`;
  if (!hit) {
    // A miss: it flies past the target, the full distance (unless a wall stops it).
    let flight = null;
    if (from && to) {
      const dx = to.center.x - from.center.x, dy = to.center.y - from.center.y, len = Math.hypot(dx, dy) || 1;
      flight = await flyThrown(thrown, { x: dx / len, y: dy / len }, feet);
    }
    return `<div class="fs-notes">${esc(thrown.name)} misses ${esc(target.name)}${released}, flying past (through anyone else in the way).</div>${await flightHTML(thrown, flight, feet)}`;
  }
  // An Emplace barrier between the thrown creature and its target is struck first: it holds (the creature stops short) or breaks
  // (the creature carries on, with the distance the barrier used up taken off).
  let reach = feet, barrierHTML = "";
  if (from && to && !slam && globalThis.canvas?.grid && areas.emplaceBarriers().some(b => areas.barrierBlocks(b.tpl, b.caster, from.center, to.center, { size: canvas.grid.size, distance: canvas.grid.distance }, b.front))) {
    const dx = to.center.x - from.center.x, dy = to.center.y - from.center.y, len = Math.hypot(dx, dy) || 1;
    const flight = await flyThrown(thrown, { x: dx / len, y: dy / len }, feet);
    barrierHTML = await flightHTML(thrown, flight, feet);
    const bars = (flight.events ?? []).filter(e => e.kind === "barrier");
    if (!bars.length || bars.some(e => !e.broke) || flight.wall) return `<div class="fs-notes">${esc(thrown.name)} is stopped before reaching ${esc(target.name)}${released}.</div>${barrierHTML}`;
    reach = feet - bars.reduce((n, e) => n + e.creature / 3, 0);
  }
  // Slam (Grappling T5): the target is a "wall" 0 ft away.
  const dist = slam ? 0 : from && to && globalThis.canvas?.grid ? Math.round(tokenDistance(from, to)) : 0;
  const untraveled = Math.max(0, reach - dist);
  const raw = forceDamage(untraveled);
  const cap = await forceCap(thrown);
  const damage = Math.min(raw, cap);
  // It lands beside the target, on the side it came from.
  const tok = thrown.getActiveTokens?.()[0];
  if (tok && to && !slam) await moveTokenTopLeft(tok, landingPosition(to, tok));
  let taken = "";
  if (damage > 0) {
    for (const who of [thrown, target]) {
      taken += damageOutcomeHTML(who, damage, "physical", await damageOutcome(who, damage, "physical"));
      await requestDamage(who, damage, "physical", 0, null, { silent: true });
    }
  }
  return `${barrierHTML}<div class="fs-result"><strong>${esc(thrown.name)} collides with ${esc(target.name)}</strong> — ${damage} Force damage to each.</div>${taken}
    <div class="fs-notes">Force ${force} → ${feet} ft, ${dist} ft to the target, ${untraveled} ft untraveled × 3 = ${raw}${damage < raw ? ` (capped at ${cap}: ${esc(thrown.name)}'s HP plus what its protection soaks)` : ""}.${release ? ` ${esc(thrown.name)} is released.` : ""}</div>`;
}

/**
 * Force straight down into the ground: all of the travel is stopped at once, so the creature takes Force damage for the
 * full distance (3 × feet, capped at its HP) and is knocked prone. Returns chat HTML.
 */
async function slamDown(actor, feet) {
  const cap = await forceCap(actor);
  const damage = Math.min(forceDamage(feet), cap);
  let html = `<div class="fs-notes">Driven ${feet} ft into the ground: ${feet} ft × 3 = ${forceDamage(feet)}${damage < forceDamage(feet) ? ` (capped at ${cap}: ${esc(actor.name)}'s HP plus what its protection soaks)` : ""}.</div>`;
  if (damage > 0) {
    html += damageOutcomeHTML(actor, damage, "physical", await damageOutcome(actor, damage, "physical"));
    await requestDamage(actor, damage, "physical", 0, null, { silent: true });
  }
  await setStatus(actor, "prone", true);
  return `${html}<div class="fs-result"><strong>${esc(actor.name)} is knocked prone.</strong></div>`;
}

/**
 * The most Force damage a creature can be dealt: its HP plus whatever its armor, Shroud, Shield and the rest would soak, so the damage
 * that finally reaches HP is at most all of it plus their max HP (it nets them to negative max HP, never past it). Armor Limit and other effects don't count against
 * the cap the way they would if the cap were just HP. Works out hits without applying them.
 */
export async function forceCap(actor, type = "physical") {
  const hp = Math.max(0, actor.system.hp.value + (actor.system.hp.max ?? 0));          // Overkill: down to negative max HP
  const reaches = async n => (await damageOutcome(actor, n, type)).toHp;
  let lo = 0, hi = hp + 1;                                    // lo always nets ≤ HP; hi nets more (once found)
  while ((await reaches(hi)) <= hp && hi < 1000000) { lo = hi; hi *= 2; }
  if (hi >= 1000000 && (await reaches(hi)) <= hp) return hi;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if ((await reaches(mid)) <= hp) lo = mid; else hi = mid;
  }
  return lo;
}

/**
 * Feet a Force pushes this creature. Crunch Time (Strength T3) matches the Force against current HP instead of max HP.
 */
function forceFeet(force, target, crunch = false) {
  force = Math.max(0, force - musgraviteNegate(target));
  const hp = crunch ? Math.max(0, target.system.hp.value) : target.system.hp.max;
  return resolveForce(force, { lift: target.system.lift, maxHp: hp });
}


/* -------------------------------------------- */
/*  Spells                                      */
/* -------------------------------------------- */

const SPELL_ICONS = { shield: "icons/magic/defensive/shield-barrier-blue.webp", dodgeDie: "icons/skills/wounds/injury-pain-body-orange.webp", attackDie: "icons/skills/wounds/injury-pain-body-orange.webp" };

/** Emplace barriers between an attacker and a target (none without a scene). */
const barriersFor = (attacker, target) => (globalThis.canvas?.scene ? areas.barriersBetween(attackerToken(attacker), target.getActiveTokens?.()[0]) : []);

/** Tier 2 spell effects live in elemental.mjs, which registers its hooks here. */
let elem = null;
export const registerElemental = h => { elem = h; };
export const chainNext = (message, preset) => elem?.chainNext(message, preset);
/** Foci effects (Affixes, Deck Foci) live in foci.mjs, which registers its hooks here. */
let foci = null;
export const registerFoci = h => { foci = h; };
/** Tier 5 (Restoration, Geomancy, Illusion) lives in arcana.mjs, which registers its hooks here. */
let arc = null;
export const registerArcana = h => { arc = h; };
/** Mental (mental.mjs) registers its hooks here: Manifest and Ward resolution, Nightmare Ward negation, turn start. */
let flightHook = null;
/** Falling and Flight (gravity.mjs): told when a creature takes damage. */
export const registerFlight = h => { flightHook = h; };
let mentalHook = null;
export const registerMental = h => { mentalHook = h; };
export const mentalTurnStart = actor => mentalHook?.turnStart(actor);
export const mentalBeforeClear = actor => mentalHook?.beforeClear(actor);
export const mentalAct = (message, i) => mentalHook?.act(message, i);
export const afterAttackCost = (actor, cost) => mentalHook?.attackCost?.(actor, cost);
export const arcanaTurnStart = actor => arc?.turnStart(actor);
export const arcanaAct = (message, i) => arc?.act(message, i);
export const arcanaCheckEntry = (token, changes) => arc?.checkEntry(token, changes);
export const arcanaAntimagicTurn = actor => arc?.antimagicTurn(actor);
/** Tier 4 (Summons, Animations, Made objects) lives in conjure.mjs: riders on a creation's attacks. */
let conj = null;
export const registerConjure = h => { conj = h; };
/** Tier 3 (Poison, Charm, Hex) lives in afflictions.mjs, which registers its hooks here. */
let aff = null;
export const registerAfflictions = h => { aff = h; };
/** Disadvantage stacks (as a negative number) a Charm or Hex puts on this creature's roll of a type (attack, dodge, stat, noncombat). */
const charmNet = (actor, type) => aff?.charmNet(actor, type) ?? 0;
/** A Hex that triggers on a roll the creature just made. */
const hexRoll = (actor, type) => aff?.hexTrigger(actor, "roll", { roll: type });
/** Unravel (Witchery T4): Disadvantage on all Magic related checks (spell attack rolls and Reach / Grasp / Build checks) until the caster's next turn. */
export const magicDisNet = actor => (spellEffects(actor, "magicDis").length || arc?.magicFails(actor) ? -1 : 0);
export const afflictTurnStart = actor => aff?.turnStart(actor);
export const afflictCasterTurn = actor => aff?.casterTurn(actor);
export const hexMove = actor => (inActiveCombat(actor) ? aff?.hexTrigger(actor, "move") : null);
export const afflictAct = (message, i) => aff?.act(message, i);
const dodgeDisNet = actor => (spellEffects(actor, "dodgeDis").length ? -1 : 0);
/** The Advantage/Disadvantage this creature's dodge rolls are known to carry (for Foresight). */
const dodgeNetKnown = actor => exhaustionNet(actor) + (actor.statuses?.has("prone") ? -1 : 0) - (actor.system?.penalties?.physicalDis ?? 0) + seeingRedNet(actor) + disruptNet(actor)
  + dodgeDisNet(actor) + charmNet(actor, "dodge") + unfetteredNet(actor) + limberNet(actor) + (calmed(actor) ? 1 : 0);

/** Weaving (Magic Theory T3): casting.mjs registers this so the weapon attack dialog can offer a spell. */
let weaveHook = null;
export const setWeaveHook = hook => { weaveHook = hook; };

/** Update or delete an Active Effect that may belong to someone else (through the GM). */
export async function changeEffect(effect, data) {
  if (effect.isOwner !== false && effect.parent?.isOwner !== false) return data ? effect.update(data) : effect.delete();
  return requestGM("changeEffect", { uuid: effect.uuid, data });
}

/** Temp HP (Mental: Bloom, Verdant Soul, Mortal Coil) soaks what is about to reach HP, even damage that ignores protection. Returns what's left. */
function soakTemp(actor, amount, lines, used) {
  let left = amount;
  for (const e of spellEffects(actor, "tempHP")) {
    if (left <= 0) break;
    const have = Number(e.flags.flowstate.spellEffect.hp) || 0;
    const n = Math.min(have, left);
    if (n <= 0) continue;
    left -= n;
    used.push({ effect: e, used: n, left: have - n });
    lines.push(`Temp HP absorbs ${n} (${have - n} left)`);
  }
  return left;
}

/** Combine the outcomes of several separate damage instances into one for the card. */
function mergeOutcomes(list) {
  const first = list[0];
  return { ...first, toHp: list.reduce((n, x) => n + x.toHp, 0), armorLoss: list.reduce((n, x) => n + (x.armorLoss ?? 0), 0), weaponLoss: list.reduce((n, x) => n + (x.weaponLoss ?? 0), 0),
    afterWeapon: list.reduce((n, x) => n + (x.afterWeapon ?? 0), 0), shroudTook: list.reduce((n, x) => n + (x.shroudTook ?? 0), 0),
    lines: [`<strong>${list.reduce((n, x) => n + x.toHp, 0)}</strong> damage to HP across ${list.length} separate instances`, ...list.flatMap((x, i) => x.lines.slice(1).map(l => `(${i + 1}) ${l}`))],
    tempHp: list.flatMap(x => x.tempHp ?? []), weapons: list.flatMap(x => x.weapons ?? []), reactive: list.flatMap(x => x.reactive ?? []), shields: list.flatMap(x => x.shields ?? []), barriers: list.flatMap(x => x.barriers ?? []), shrouds: list.flatMap(x => x.shrouds ?? []) };
}

/** A cast's automated profile after Replacement Mods (or null when the GM resolves it). */
const spellProfile = o => (o?.spell ? fx.applyReplacements(fx.profileFor(o.spell.cores), o.spell.replaced) : null);

/** The Scaling Stat value behind an attack (for Personal Repulsion / Well): a spell's, a weapon's (Grade-capped), or an Unarmed stat. */
function attackScaling(actor, opts) {
  if (opts.spell) return opts.spell.scaling ?? 0;
  const item = opts.itemUuid ? syncUuid(opts.itemUuid) : null;
  if (item?.system?.profile?.capped !== undefined) return item.system.profile.capped;
  const eff = actor.system.derived.effective;
  return opts.unarmedWeight === "heavy" ? eff.str.value : opts.unarmedWeight === "light" ? eff.dex.value : Infinity;
}

/** Spell Active Effects on an actor of one kind (a Shield, a die-size penalty). */
export const spellEffects = (actor, kind) => Array.from(actor?.effects ?? []).filter(e => !e.disabled && e.flags?.flowstate?.spellEffect?.kind === kind);

/**
 * Put a spell's Active Effect on an actor (GM / owner). Effects of the same kind from the same caster are replaced.
 * `effect`: { kind, caster, name, description, ritualOf?, ...values (hp, dodgeDie, attackDie) }
 */
export async function applySpellEffect(actor, effect) {
  const { name, description, replaceAll, ...fxData } = effect;
  if (!effect.stack) for (const old of spellEffects(actor, effect.kind)) if (replaceAll || old.flags.flowstate.spellEffect.caster === effect.caster) await old.delete();
  const data = { name, img: SPELL_ICONS[effect.kind] ?? "icons/magic/symbols/runes-star-orange.webp", origin: effect.caster, description: description ?? "",
    flags: { flowstate: { spellEffect: fxData, ...(effect.ritualOf ? { ritualOf: effect.ritualOf } : {}) } } };
  return actor.createEmbeddedDocuments("ActiveEffect", [data]);
}
/** Ask the GM to put a spell effect on a target the caster doesn't own. */
export async function putSpellEffect(target, effect) {
  if (target.isOwner) return applySpellEffect(target, effect);
  return requestGM("spellEffect", { target: target.uuid, effect });
}

/** End every spell effect this caster put on others (until the start of their next turn). Rituals' effects end with the Ritual instead. */
export async function clearSpellEffects(caster, { all = false } = {}) {
  // Bleed waits for its victim's next turn (that always comes before the caster's), unless combat is ending.
  const mine = e => e.flags?.flowstate?.spellEffect?.caster === caster.uuid && !e.flags?.flowstate?.ritualOf
    && (all || (!e.flags.flowstate.spellEffect.onTargetTurn && !e.flags.flowstate.spellEffect.persistent));
  const docs = [];
  for (const a of game.actors ?? []) for (const e of a.effects ?? []) if (mine(e)) docs.push(e);
  for (const t of globalThis.canvas?.tokens?.placeables ?? []) if (!t.document.actorLink) for (const e of t.actor?.effects ?? []) if (mine(e)) docs.push(e);
  for (const e of docs) {
    // A Combo's lingering effect (Poison + Charm / Hex) can last extra turns of the caster's.
    const left = e.flags.flowstate.spellEffect.turnsLeft;
    if (!all && left > 1) { await e.update({ "flags.flowstate.spellEffect.turnsLeft": left - 1 }); continue; }
    // A magical Hold lets go with the spell.
    if (e.flags.flowstate.spellEffect.kind === "hold" && e.parent?.getFlag?.("flowstate", "grappledBy") === caster.uuid) await setGrapple(e.parent, null);
    await e.delete();
  }
  if (!all && caster.getFlag?.("flowstate", "setup")) await caster.unsetFlag("flowstate", "setup");
}

/** Bleed (Slashing T2): at the start of the victim's turn each Bleed repeats its direct physical damage, then ends. */
export async function bleedTurnStart(actor) {
  for (const e of spellEffects(actor, "bleed")) {
    const { amount, dmgType, chop } = e.flags.flowstate.spellEffect;
    await e.delete();
    await post(actor, { title: `${esc(actor.name)} — Bleed`, body: `<div class="fs-result">Bleed: ${amount} direct ${DAMAGE_TYPES[dmgType] ?? dmgType} damage${chop ? " (Max HP loss)" : ""}.</div>` });
    await requestDamage(actor, amount, dmgType, 0, null, { silent: true, bypass: true, maxHpLoss: !!chop });
  }
}

/** Gash (Slashing T3): the victim spent AP/RP to voluntarily move, so each Gash on them repeats its damage. */
export async function triggerGash(actor) {
  for (const e of spellEffects(actor, "gash")) {
    const { amount, dmgType, chop } = e.flags.flowstate.spellEffect;
    await post(actor, { title: `${esc(actor.name)} — Gash`, body: `<div class="fs-result">${esc(actor.name)} moves and the Gash opens: ${amount} ${DAMAGE_TYPES[dmgType] ?? dmgType} damage${chop ? " (Max HP loss)" : ""}.</div>` });
    await requestDamage(actor, amount, dmgType, 0, null, { silent: true, bypass: true, maxHpLoss: !!chop });
  }
}

/** Would this spell damage (at its largest) get past everything in the way and reach the target's HP? ("direct damage") */
async function wouldBeDirect(target, maxDamage, type, dmgOpts) {
  if (maxDamage <= 0) return false;
  return (await damageOutcome(target, maxDamage, type, dmgOpts)).toHp > 0;
}

/** A Spell hit that doesn't wait for damage: a Shield goes up, Force is applied, die sizes shrink. */
async function spellHit(attacker, target, o, result, entry = null, dodgeTotal = null) {
  const sp = o.spell;
  const profile = spellProfile(o);
  if (!profile) return null;
  const rolls = [], html = [];
  let push = null, chain = null;
  const caster = attacker.uuid;
  const ritualOf = sp.ritualOf ?? null;
  if (profile.shield) {
    const m = sp.mods ?? {};
    // Layered (Build Arcana T1): a Shield isn't default Spell health, so it gains your Build per Layered.
    const hp = fx.shieldHealth(profile, sp.power) + (m.layered ?? 0) * Math.max(0, attacker.system?.derived?.effective?.build?.value ?? 0);
    // A Shield doesn't stack with itself: a target keeps one Shield (from any caster), the one with more health left; a weaker new one is wasted.
    const standing = spellEffects(target, "shield");
    const best = standing.reduce((m, e) => Math.max(m, Number(e.flags.flowstate.spellEffect.hp) || 0), 0);
    if (standing.length && best >= hp) {
      html.push(`<div class="fs-result"><i class="fa-solid fa-shield"></i> ${esc(target.name)} already has a Shield with ${best} health; Shields don't stack, so this one adds nothing.</div>`);
    } else {
    await putSpellEffect(target, { kind: "shield", caster, name: `Shield (${esc(attacker.name)})`, hp, max: hp, ritualOf, replaceAll: true,
      reflect: !!m.reflect, adjust: !!m.adjust, dampen: sp.dampen ?? [], order: "default", reactive: !!m.reactive, reform: !!m.reform, reformMark: hp,
      description: `Absorbs the next ${hp} damage. ${ritualOf ? "Lasts until the ritual ends or the Shield breaks." : "Until the start of the caster's next turn."}` });
    html.push(`<div class="fs-result"><i class="fa-solid fa-shield"></i> ${esc(target.name)} is protected by a Shield with <strong>${hp} health</strong>${ritualOf ? " (until the ritual ends or it breaks)" : " until the start of your next turn"}.</div>`);
    }
  }
  const pen = fx.diePenalties(profile, sp.power, { direct: false });
  if (pen.dodge) {
    await putSpellEffect(target, { kind: "dodgeDie", caster, name: `Dodge −${pen.dodge} die size`, dodgeDie: pen.dodge, ritualOf,
      description: `Dodge dice are ${pen.dodge} sizes smaller until the start of the caster's next turn (doesn't stack).` });
    html.push(`<div class="fs-notes">${esc(target.name)}'s dodge dice suffer <strong>−${pen.dodge} die size</strong> until the start of your next turn.</div>`);
  }
  // Gravity Mods (the base effect may be replaced, which doubles the Mod): Slow/Haste stacks, personal fields, Hold.
  const m = sp.mods ?? {}, rp = sp.replaced ?? {};
  const stackBonus = (o.stacks ?? 0) + (result.critStacks ?? 0);
  const conditionStacks = async (kind, label, name) => {
    const n = applyStacks(20 * sp.power * fx.replaceFactor(rp, name), stackBonus);
    const cur = target.system.conditions?.[kind] ?? 0;
    const data = { [`system.conditions.${kind}`]: cur + n };
    if (target.isOwner) await target.update(data); else await requestGM("updateActor", { uuid: target.uuid, data });
    html.push(`<div class="fs-result">${esc(target.name)} gets <strong>${n} ${label}</strong> stacks${sp.ritualOf ? " (they last until the ritual ends)" : ""}.</div>`);
  };
  if (m.burden) await conditionStacks("slow", "Slow", "burden");
  if (m.lighten) await conditionStacks("haste", "Haste", "lighten");
  for (const [key, mode, label] of [["personal repulsion", "repulse", "Personal Repulsion"], ["personal well", "well", "Personal Well"]]) {
    if (!m[key]) continue;
    const threshold = 20 * sp.power * fx.replaceFactor(rp, key);
    await putSpellEffect(target, { kind: "field", mode, caster, name: `${label} (≤ ${threshold})`, threshold, ritualOf,
      description: `Incoming attacks with a Scaling Stat of ${threshold} or less have ${mode === "well" ? "Advantage" : "Disadvantage"} on their attack rolls, until the start of the caster's next turn.` });
    html.push(`<div class="fs-result">${esc(target.name)} has a ${label}: attacks with a Scaling Stat of <strong>${threshold}</strong> or less against them have ${mode === "well" ? "Advantage" : "Disadvantage"} until the start of your next turn.</div>`);
  }
  if (m.hold) {
    const mult = fx.replaceFactor(rp, "hold");
    if (target.statuses?.has("grappled")) {
      const roll = await evaluate(`${2 * sp.power * mult}d12`);
      rolls.push(roll);
      html.push(`<div class="fs-result">Already grappled: ${esc(target.name)} takes ${2 * sp.power * mult}d12 = <strong>${roll.total}</strong> physical instead.</div>`);
      await requestDamage(target, applyStacks(roll.total, stackBonus), "physical", 0, null, { silent: false });
    } else {
      const size = target.system.size ?? 3;
      const min = Math.max(1, Math.floor(3 * sp.power * mult * Math.pow(2, 3 - size)));
      await setGrapple(target, attacker.uuid);
      await putSpellEffect(target, { kind: "hold", caster, name: `Held by ${esc(attacker.name)} (≥ ${min})`, holdMin: min, ritualOf,
        description: `Magically held: breaking free needs a roll of ${min} or more. Ends at the start of the caster's next turn.` });
      html.push(`<div class="fs-result">${esc(target.name)} is held in a magical grapple: breaking free needs a <strong>${min}</strong> or more${sp.ritualOf ? " (until the ritual ends or they are free)" : ", until the start of your next turn"}.</div>`);
    }
  }
  // Beatdown (Crushing T4): an extra dodge roll against the initial attack roll, or knocked prone.
  if (m.beatdown && entry) {
    const die = target.system.derived.dodgeDie;
    const dodge = await evaluate(poolFormula(2, die, 0));
    rolls.push(dodge);
    const down = dodge.total < entry.total;
    html.push(`<div class="fs-result">Beatdown: ${esc(target.name)} dodges again (${dodge.total} vs ${entry.total}): ${down ? "<strong>knocked prone</strong>" : "stays on their feet"}.</div>`);
    if (down && !target.statuses?.has("prone")) await setStatus(target, "prone", true);
  }
  const fd = fx.forceDice(profile, sp.power, { direct: false, crit: !!result.crit });
  if (fd) {
    const f = await spellForce(attacker, target, o, result, fd, "Force");
    html.push(f.html, f.push ? knockbackRow(attacker.uuid, f.push.feet, f.push.label) : ""); rolls.push(...f.rolls); push = f.push;
  }
  // Tier 2: effects of spells with no damage, Freeze, and the held-melee roll.
  if (elem && profile) {
    const eh = await elem.onHit({ attacker, target, o, result, entry, profile, dodgeTotal });
    if (eh.html) html.push(eh.html);
    rolls.push(...eh.rolls);
    chain = eh.chain ?? null;
  }
  if (conj && sp.makeAct) html.push(await conj.makeHit({ attacker, target, sp }));
  if (foci && sp.fociFx) { const fh = await foci.afterHit({ attacker, target, o }); if (fh) html.push(fh); }
  // Tier 5: a Mirage takes hold.
  if (arc && profile?.arcana?.kind === "mirage") { const mh = await arc.mirageHit({ attacker, target, o, result, profile }); if (mh.html) html.push(mh.html); rolls.push(...mh.rolls); }
  // Tier 3: Poison, Charm and Hex.
  if (aff && profile?.afflict) {
    const ah = await aff.onHit({ attacker, target, o, result, entry, profile, dodgeTotal });
    if (ah.html) html.push(ah.html);
    rolls.push(...ah.rolls);
    if (ah.push) push = ah.push;
  }
  return { html: html.join(""), rolls, push, chain: chain ? { ...chain, affected: o.spell?.chain?.affected ?? [target.uuid], depth: o.spell?.chain?.depth ?? 0, primary: o.spell?.chain?.primary ?? target.uuid } : null };
}

/** Roll a spell's Force dice and work out how far it can move the target (the attacker picks the direction on the button). */
export async function spellForce(attacker, target, o, result, fd, label, stacksOverride = null) {
  const roll = await evaluate(`${fd.n}d${fd.sides}`);
  // A spell's Force is a bolded effect like its damage, so the same Strengthened / Weakened stacks apply to it (the spell's, crits,
  // Foci Affixes, Charm and so on). The damage path passes the stacks it already worked out.
  const stacks = stacksOverride ?? (o.spell ? targetStacks(attacker, o, target, result, 0, {}).stacks : (o.stacks ?? 0) + (result.critStacks ?? 0));
  const force = applyStacks(roll.total, stacks);
  const feet = forceFeet(force, target, !!o.spell?.fociFx?.affixes?.includes("musgravite"));          // Musgravite: against current health
  const html = `<div class="fs-result">${label}: ${fd.n}d${fd.sides} = ${roll.total}${stacks ? ` ${stackLabel(stacks)} → ${force}` : ""} Force → up to <strong>${feet} ft</strong></div>`;
  return { html, rolls: [roll], push: feet > 0 ? { attacker: attacker.uuid, target: target.uuid, force, feet, label } : null };
}

/** Facts a spell's damage needs: is the target living, would it be direct, and did the dodge roll come in low? */
async function spellDamageFacts(profile, o, attacker, target, defense, dmgOpts) {
  const sp = o.spell;
  // "Living": a creature that isn't fully Magical (constructs, spirits).
  const living = target.type !== "pile" && !target.system.magical;
  const base = profile.damage;
  const baseMax = base ? base.n * Math.max(1, sp.power) * base.sides : 0;
  const stacks = (o.stacks ?? 0) + (defense.result?.critStacks ?? 0);
  const direct = base ? await wouldBeDirect(target, applyStacks(baseMax, stacks), base.type, dmgOpts) : false;
  const dodgeMax = 2 * Math.max(1, Math.floor((target.system.skillPoints ?? 0) / 2));
  const lowDodge = defense.dodge != null && defense.dodge <= dodgeMax / 3;
  const tg = sp.telegraph;
  const telegraphRange = tg ? 1 * sp.power : 0;
  const telegraphHit = !!tg && defense.dodge != null && Math.abs(defense.dodge - tg.guess) <= telegraphRange;
  return { living, direct, crit: !!defense.result?.crit, lowDodge, telegraphHit, telegraphRange, telegraphGuess: tg?.guess,
    cookCount: elem?.countFor(attacker, "heatDealt", target.uuid) ?? 0, energyZeroBefore: (target.system.energy?.value ?? 0) <= 0,
    firstDamage: (elem?.countFor(attacker, "crackleHit", target.uuid) ?? 0) === 0, chainHitsBefore: Math.max(0, (sp.chain?.affected?.length ?? 1) - 1) };
}

/** Knockback / Push buttons: the Force info is stored on the card that offers them. */
export function knockbackRow(ownerUuid, feet, label = "Knockback") {
  return `<div class="fs-brawl-row fs-knockback-row" data-role="attacker" data-owner="${ownerUuid}">
    <button type="button" class="fs-knockback" data-tooltip="Choose a direction (or down, into the ground)"><i class="fa-solid fa-arrows-up-down-left-right"></i> ${label} (${feet} ft)</button></div>`;
}

/**
 * Knockback or Push: the attacker picks a direction for the Force stored on this card. The target's token is moved
 * (walls stop it, dealing Force damage for the untraveled feet), or driven down into the ground (Force damage, prone).
 */
const knockbackUsed = id => game.messages.find(m => m.getFlag("flowstate", "knockbackOf") === id || m.getFlag("flowstate", "attack")?.opts?.knockbackOf === id);

export async function knockback(message) {
  const info = message.getFlag("flowstate", "knockback");
  if (!info?.feet) return;
  if (knockbackUsed(message.id)) return ui.notifications.info("That Force was already used.");
  const attacker = await fromUuid(info.attacker);
  const target = await fromUuid(info.target);
  if (!attacker?.isOwner) return ui.notifications.warn(`Only ${attacker?.name ?? "the attacker"}'s owner can do that.`);
  if (!target) return ui.notifications.warn("The target no longer exists.");
  // Knocking them into another creature is a targeted attack: target that creature first.
  const into = [...(game.user.targets ?? [])].map(t => t.actor).filter(a => a && a.type !== "pile" && a.uuid !== target.uuid);
  const aimAt = into.length === 1 ? into[0] : null;
  const crunchable = ab.strength(attacker, 3);
  const crunchFeet = crunchable ? forceFeet(info.force, target, true) : 0;
  const opts = await optionsDialog(`${info.label ?? "Knockback"} — ${target.name}`, `
    <p class="hint">Force ${info.force} → ${esc(target.name)} can be pushed up to <strong>${info.feet} ft</strong>.
      With no creature targeted, it passes through anyone in the way unharmed.</p>
    ${crunchable ? `<div class="form-group"><label>Crunch Time <span class="fs-energy-inline">⚡ ${ab.STRENGTH_COST.crunchTime(attacker)}</span>: match the Force against current HP (${crunchFeet} ft)</label><input type="checkbox" name="crunch"></div>` : ""}
    <div class="form-group"><label>Direction</label><select name="dir">
      ${aimAt ? `<option value="into" selected>Into ${esc(aimAt.name)} (ranged attack roll; on a hit both collide)</option>` : ""}
      <option value="away">Straight away from ${esc(attacker.name)}</option>
      ${Object.entries(DIRECTIONS).map(([k, d]) => `<option value="${k}">${d.label}</option>`).join("")}
      <option value="down">Down (into the ground: Force damage, knocked prone)</option>
    </select></div>`, "Push");
  if (!opts) return;
  if (knockbackUsed(message.id)) return;
  let feet = info.feet;
  if (opts.crunch) {
    if (!(await spendEnergy(attacker, ab.STRENGTH_COST.crunchTime(attacker), "Crunch Time"))) return;
    feet = crunchFeet;
  }
  if (!feet) return ui.notifications.warn(`The Force doesn't move ${target.name} at all${crunchable && !opts.crunch ? " (Crunch Time might)" : ""}.`);
  if (opts.dir === "into" && aimAt) {
    const from = target.getActiveTokens?.()[0], to = aimAt.getActiveTokens?.()[0];
    if (from && to && globalThis.canvas?.grid && tokenDistance(from, to) > feet) {
      return ui.notifications.warn(`${aimAt.name} is ${Math.round(tokenDistance(from, to))} ft from ${target.name}, beyond the ${feet} ft the Force carries them.`);
    }
    return performAttack(attacker, {
      label: `${info.label ?? "Knockback"}: ${target.name} into ${aimAt.name}`, net: 0, melee: false,
      damage: "", type: "physical", stacks: 0, physical: false, shots: 1,
      throwGrappled: target.uuid, throwForce: info.force, knockInto: true, knockbackOf: message.id, crunch: !!opts.crunch,
      notes: [`${target.name} is knocked at ${aimAt.name} (Force ${info.force}, ${feet} ft${opts.crunch ? ", Crunch Time" : ""})`], targetActors: [aimAt]
    });
  }
  let body;
  if (opts.dir === "down") body = await slamDown(target, feet);
  else {
    let dir;
    if (opts.dir === "away") {
      const a = attackerToken(attacker), t = target.getActiveTokens?.()[0];
      const dx = t && a ? t.center.x - a.center.x : 1, dy = t && a ? t.center.y - a.center.y : 0, len = Math.hypot(dx, dy) || 1;
      dir = { x: dx / len, y: dy / len };
    } else {
      const d = DIRECTIONS[opts.dir] ?? DIRECTIONS.n, len = Math.hypot(d.x, d.y);
      dir = { x: d.x / len, y: d.y / len };
    }
    const flight = await flyThrown(target, dir, feet);
    body = await flightHTML(target, flight, feet);
  }
  await post(attacker, { title: `${info.label ?? "Knockback"} — ${esc(target.name)}`, body: `<div class="fs-notes">Force ${info.force}${opts.crunch ? ` · Crunch Time (${ab.STRENGTH_COST.crunchTime(attacker)} Energy): matched against current HP` : ""}</div>${body}`,
    flags: { flowstate: { knockbackOf: message.id } } });
}

/** Compass directions for throws without a target (screen space: +y is down). */
const DIRECTIONS = {
  n: { label: "North", x: 0, y: -1 }, ne: { label: "North-east", x: 1, y: -1 }, e: { label: "East", x: 1, y: 0 },
  se: { label: "South-east", x: 1, y: 1 }, s: { label: "South", x: 0, y: 1 }, sw: { label: "South-west", x: -1, y: 1 },
  w: { label: "West", x: -1, y: 0 }, nw: { label: "North-west", x: -1, y: -1 }
};

/** First wall a move from `a` to `b` (canvas points) would hit, or null. */
function wallHit(a, b) {
  try {
    const backend = CONFIG.Canvas.polygonBackends?.move;
    return backend?.testCollision(a, b, { type: "move", mode: "closest" }) ?? null;
  } catch (err) { return null; }
}

/** Move a token to a top-left position (snapped to the grid). Routed through the GM if we don't own it. */
async function moveTokenTopLeft(token, pos) {
  const doc = token.document;
  const gs = canvas.grid.size;
  let { x, y } = pos;
  if (!canvas.grid.isGridless) { x = Math.round(x / gs) * gs; y = Math.round(y / gs) * gs; }
  const d = canvas.dimensions;
  x = Math.min(Math.max(x, d.sceneX ?? 0), (d.sceneX ?? 0) + (d.sceneWidth ?? d.width) - (doc.width ?? 1) * gs);
  y = Math.min(Math.max(y, d.sceneY ?? 0), (d.sceneY ?? 0) + (d.sceneHeight ?? d.height) - (doc.height ?? 1) * gs);
  if (doc.isOwner) return doc.update({ x, y }, { flowstateThrow: true });
  return requestGM("moveToken", { uuid: doc.uuid, x, y });
}

/**
 * Fly a thrown creature's token `feet` along a unit direction. Walls stop it early; the feet it didn't
 * travel become Force damage to it (3 × untraveled, capped at its HP). Returns { moved, traveled, wall, damage }.
 */
async function flyThrown(thrown, dir, feet) {
  const tok = thrown.getActiveTokens?.()[0];
  const dims = globalThis.canvas?.dimensions;
  if (!tok || !dims || !feet) return { moved: false, traveled: feet, wall: false, damage: 0 };
  const ppf = dims.size / dims.distance;
  const start = tok.center;
  // Emplace barriers are objects: a creature thrown through one damages it and itself (3 × the untraveled feet each, capped by what the
  // other has left), is stopped by it if it holds, and carries on with the leftover distance if it breaks.
  const plan = areas.planFlight({ start, dir, feet, barriers: areas.emplaceBarriers(), grid: { size: dims.size, distance: dims.distance },
    creatureHp: await forceCap(thrown), wallAt: (a, b) => { const h = wallHit(a, b); return h ? { x: h.x, y: h.y } : null; } });
  let damage = 0, wall = false, taken = "";
  const notes = [];
  for (const ev of plan.events) {
    if (ev.creature > 0) {
      taken += damageOutcomeHTML(thrown, ev.creature, "physical", await damageOutcome(thrown, ev.creature, "physical"));
      await requestDamage(thrown, ev.creature, "physical", 0, null, { silent: true });
      damage += ev.creature;
    }
    if (ev.kind === "wall") wall = true;
    else {
      const b = areas.emplaceBarriers().find(x => x.id === ev.id);
      if (b) { const left = Math.max(0, ev.left); if (game.user.isGM) await areas.setBarrierHealth(b.sceneId, b.id, left); else await requestGM("barrier", { sceneId: b.sceneId, id: b.id, hp: left }); }
      notes.push(`${esc(thrown.name)} slams into an Emplace barrier after ${Math.floor(ev.ft)} ft: ${Math.floor(ev.untraveled)} ft untraveled × 3 = ${3 * Math.floor(ev.untraveled)} Force. It takes <strong>${ev.creature}</strong> and the barrier takes <strong>${ev.barrier}</strong> (${ev.broke ? "it breaks" : `${ev.left} health left`})${ev.broke ? " and they fly on" : " and they stop"}.`);
    }
  }
  const w = (tok.document.width ?? 1) * dims.size, h = (tok.document.height ?? 1) * dims.size;
  await moveTokenTopLeft(tok, { x: plan.end.x - w / 2, y: plan.end.y - h / 2 });
  const wallEv = plan.events.find(e => e.kind === "wall");
  return { moved: true, traveled: Math.floor(plan.traveled), wall, damage: wallEv ? wallEv.creature : 0, untraveledAtWall: wallEv?.untraveled, taken, notes, totalDamage: damage, events: plan.events };
}

function flightHTML(thrown, flight, feet) {
  if (!flight?.moved) return `<div class="fs-notes">Flies up to ${feet} ft (no token on this scene to move).</div>`;
  const notes = (flight.notes ?? []).map(n => `<div class="fs-result">${n}</div>`).join("");
  if (!flight.wall) return `${notes || `<div class="fs-notes">${esc(thrown.name)} flies ${feet} ft.</div>`}${flight.taken ?? ""}`;
  const left = flight.untraveledAtWall ?? feet - flight.traveled;
  return `${notes}<div class="fs-result">${esc(thrown.name)} hits a wall after ${flight.traveled} ft — <strong>${flight.damage}</strong> Force damage (${Math.floor(left)} ft untraveled × 3${flight.damage < forceDamage(left) ? ", capped at its HP" : ""}).</div>${flight.taken ?? ""}`;
}

/* ---- Martial Theory T2/T3: Psych Up & Calm Down ---- */

export const STANCES = {
  psych: { status: "psychedUp", label: "Psych Up", tier: 2, text: "Advantage on your attack rolls; attacks against you have Advantage" },
  calm: { status: "calmedDown", label: "Calm Down", tier: 3, text: "Advantage on your dodge rolls; your attack rolls have Disadvantage" }
};
/** Stance Energy cost: half your Skill Points, rounded down. */
export const stanceCost = actor => Math.floor((actor.system.skills?.total ?? actor.system.skillPoints ?? 0) / 2);

/** Why a stance can't be used right now (or "" if it can). */
export function stanceBlocked(actor, key) {
  const s = STANCES[key];
  if (theoryTier(actor) < s.tier) return `Requires Martial Theory Tier ${s.tier}.`;
  if (!inActiveCombat(actor)) return "Only in combat, on your turn.";
  if (game.combat.combatant?.actor?.uuid !== actor.uuid) return "Only on your turn.";
  const stamp = `${game.combat.id}:${game.combat.round}:${game.combat.turn}`;
  if (actor.getFlag("flowstate", `stanceUsed.${key}`) === stamp) return "Already used this turn.";
  return "";
}

/** Psych Up / Calm Down: once per turn on your turn; lasts until the start of your next turn. */
export async function useStance(actor, key) {
  const s = STANCES[key];
  if (!s || cantAct(actor, `use ${s.label}`)) return;
  await triggerMark(actor, `uses ${s.label}`);
  const blocked = stanceBlocked(actor, key);
  if (blocked) return ui.notifications.warn(`${s.label}: ${blocked}`);
  const cost = stanceCost(actor);
  if (!(await spendEnergy(actor, cost, s.label))) return;
  await actor.setFlag("flowstate", `stanceUsed.${key}`, `${game.combat.id}:${game.combat.round}:${game.combat.turn}`);
  if (!actor.statuses.has(s.status)) await actor.toggleStatusEffect(s.status, { active: true });
  await post(actor, { title: s.label, body: `<div class="fs-result">${s.text} until the start of ${esc(actor.name)}'s next turn.</div><div class="fs-notes">${cost} Energy</div>` });
}

/** Stances end at the start of your next turn (and when combat ends). */
export async function clearStances(actor) {
  if (!actor?.isOwner) return;
  for (const s of Object.values(STANCES)) if (actor.statuses?.has(s.status)) await actor.toggleStatusEffect(s.status, { active: false });
}

/** The Shift choice for one target of an attack card, if used. */
/** Every Shift used against one target of an attack card (Evade allows two). */
export function findShifts(attackMessageId, index) {
  return game.messages.filter(m => {
    const f = m.getFlag("flowstate", "shift");
    return f?.attackMessage === attackMessageId && f.index === index;
  }).map(m => m.getFlag("flowstate", "shift"));
}

export function findShift(attackMessageId, index) {
  return game.messages.find(m => {
    const f = m.getFlag("flowstate", "shift");
    return f?.attackMessage === attackMessageId && f.index === index;
  });
}

/** Net Advantage for re-rolling this attack now: the original, minus Close Quarters (2) and Shift (1) if used. */
function rerollNet(attackMessageId, index, entry) {
  const shiftDis = findShifts(attackMessageId, index).filter(f => f.mode === "dis").length;
  const distracted = !!findDistract(attackMessageId, index)?.getFlag("flowstate", "distract")?.hit;
  return (entry.net ?? 0) + (findCloseQuarters(attackMessageId, index) ? -2 : 0) - shiftDis + (distracted ? -1 : 0) + (findDash(attackMessageId, index) ? -1 : 0);
}

/** The attack entry with its latest re-rolled total (Close Quarters or Shift), if any. */
export function effectiveEntry(attackMessageId, index, entry) {
  const rerolls = game.messages.filter(m => {
    const f = m.getFlag("flowstate", "closeQuarters") ?? (m.getFlag("flowstate", "shift")?.total !== undefined ? m.getFlag("flowstate", "shift") : null)
      ?? (m.getFlag("flowstate", "distract")?.total !== undefined ? m.getFlag("flowstate", "distract") : null) ?? m.getFlag("flowstate", "dash");
    return f?.attackMessage === attackMessageId && f.index === index;
  });
  const last = rerolls.at(-1);
  if (!last) return entry;
  const f = last.getFlag("flowstate", "closeQuarters") ?? last.getFlag("flowstate", "shift") ?? last.getFlag("flowstate", "distract") ?? last.getFlag("flowstate", "dash");
  return { ...entry, total: f.total };
}

/**
 * Speedy (Unarmored T3) makes the Dash reaction free, so it's applied automatically: the attack is rolled with
 * Disadvantage from the start (same odds as a re-roll that keeps the lower result). Needs a target that can react.
 */
export function autoDash(target, opts = {}) {
  if (!target || opts.omnislash || opts.stealth === "full" || helpless(target) || opts.breakFree || opts.throwGrappled) return false;
  return !!ab.dashInfo(target)?.reaction && ab.unarmoredT(target, 3);
}

/** Forced re-rolls of an incoming attack only ever lower it: the higher result is ignored. */
const keptNote = (reroll, current) => (reroll > current ? ` (the re-roll of ${reroll} is higher, so ${current} stands)` : "");

/** The Unarmored Dash reaction used against one target of an attack card, if any. */
export function findDash(attackMessageId, index) {
  return game.messages.find(m => {
    const f = m.getFlag("flowstate", "dash");
    return f?.attackMessage === attackMessageId && f.index === index;
  });
}

/** Dash as a reaction (Unarmored T1): Energy only; the incoming attack is re-rolled with Disadvantage. Moving after it resolves costs 1 RP (+ slows). */
async function dashReaction(message, index, target, entry) {
  const info = ab.dashInfo(target);
  if (!info?.reaction) return ui.notifications.warn(`${entry.name} needs Unarmored Tier 1 and no armor.`);
  if (findDash(message.id, index)) return ui.notifications.info("Dash was already used against this attack.");
  if (findDefense(message.id, index)) return;
  if (inActiveCombat(target) && target.system.energy.value < info.cost) return ui.notifications.warn(`${entry.name} needs ${info.cost} Energy for Dash.`);
  if (!(await spendEnergy(target, info.cost, "Dash"))) return;
  const cur = effectiveEntry(message.id, index, entry);
  const net = rerollNet(message.id, index, entry) - 1;
  const roll = await evaluate(poolFormula(1, entry.die ?? 1, net));
  await post(target, { title: `${esc(entry.name)} — Dash`, rolls: [roll],
    body: `<div class="fs-notes">${info.cost ? `${info.cost} Energy` : "Free (Speedy)"} · original attack roll ${cur.total}</div>${await rollBlock(roll, `Attack (d${entry.die}), re-rolled with Disadvantage`)}
      <div class="fs-result">The attack is now <strong>${Math.min(cur.total, roll.total)}</strong>${keptNote(roll.total, cur.total)}. Respond on the attack card; afterwards ${esc(entry.name)} can spend ${slowedCost(target)} RP to move up to their speed.</div>`,
    flags: { flowstate: { dash: { attackMessage: message.id, index, total: Math.min(cur.total, roll.total), original: cur.total } } } });
}

/** The Distracting Fire used against one target of an attack card, if any. */
export function findDistract(attackMessageId, index) {
  return game.messages.find(m => {
    const f = m.getFlag("flowstate", "distract");
    return f?.attackMessage === attackMessageId && f.index === index;
  });
}

/**
 * Distracting Fire (Assault T3): against a non-targeted (Area) attack while holding an Assault weapon with the attacker in
 * range. Make an attack roll against the incoming attack roll; on a hit, the attack is re-rolled with Disadvantage and its
 * damage is Weakened. It only damages whatever the attack is (not the attacker), so no damage is rolled here.
 */
async function distractingFire(message, index, target, entry, o) {
  if (findDistract(message.id, index)) return ui.notifications.info("Distracting Fire was already used against this attack.");
  const attacker = await fromUuid(message.getFlag("flowstate", "attack")?.attacker);
  const weapons = distractWeapons(target, attacker);
  if (!weapons.length) return ui.notifications.warn(`${entry.name} needs a held Assault weapon with the attacker in range.`);
  const opts = await optionsDialog(`${entry.name} — Distracting Fire`, `
    <p class="hint">Attack roll (d${target.system.derived.attackDie}) against the incoming attack (${entry.total}). On a hit, it's re-rolled with Disadvantage and Weakened.</p>
    ${weapons.length > 1 ? `<div class="form-group"><label>Weapon</label><select name="item">${weapons.map(i => `<option value="${i.id}">${esc(i.name)} — ${ab.ASSAULT_COST.distractingFire(i)} Energy</option>`).join("")}</select></div>` : ""}
    ${netField()}`, "Fire");
  if (!opts) return;
  if (findDistract(message.id, index) || findDefense(message.id, index)) return;
  const item = target.items.get(opts.item) ?? weapons[0];
  const cost = ab.ASSAULT_COST.distractingFire(item);
  if (!(await spendEnergy(target, cost, "Distracting Fire"))) return;
  const t = target.system;
  const net = opts.net + exhaustionNet(target) - t.penalties.physicalDis + attackStanceNet(target) + limberNet(target);
  await consumeLimber(target);
  const roll = await evaluate(poolFormula(1, t.derived.attackDie, net));
  const hit = roll.total >= entry.total;
  const rolls = [roll];
  const flag = { attackMessage: message.id, index, hit };
  let body = `<div class="fs-notes">${esc(item.name)} · ${cost} Energy · against the incoming attack roll (${entry.total})</div>${await rollBlock(roll, `Distracting Fire (d${t.derived.attackDie})`)}`;
  if (hit) {
    const rnet = rerollNet(message.id, index, entry) - 1;
    const re = await evaluate(poolFormula(1, entry.die ?? 1, rnet));
    rolls.push(re);
    const cur = effectiveEntry(message.id, index, entry).total;
    Object.assign(flag, { total: Math.min(cur, re.total), original: cur });
    body += `<div class="fs-result">Hit! The attack is re-rolled with Disadvantage and Weakened.</div>${await rollBlock(re, `Attack (d${entry.die}), re-rolled`)}
      <div class="fs-result">The attack is now <strong>${Math.min(cur, re.total)}</strong>${keptNote(re.total, cur)}. Respond on the attack card.</div>`;
  } else body += `<div class="fs-notes">Missed: the attack is unchanged. Respond on the attack card.</div>`;
  await post(target, { title: `${esc(entry.name)} — Distracting Fire`, rolls, body, flags: { flowstate: { distract: flag } } });
}

/**
 * Shift (Medium Armor T4): when attacked in Medium armor, either gain Advantage on your dodge or give the incoming
 * attack Disadvantage (re-rolled). Then respond as usual.
 */
async function shift(message, index, target, entry) {
  const info = ab.shiftInfo(target);
  if (!info) return ui.notifications.warn(`${entry.name} needs Shift for the armor they're wearing (Medium T4 or Light T1).`);
  if (findShifts(message.id, index).length >= info.uses) return ui.notifications.info(`Shift was already used against this attack${info.uses > 1 ? " twice" : ""}.`);
  const opts = await optionsDialog(`${entry.name} — Shift`, `<div class="form-group"><label>Shift</label><select name="mode">
    <option value="adv">Advantage on my dodge roll</option><option value="dis">Disadvantage on the incoming attack roll (re-rolled)</option></select></div>`, "Shift");
  if (!opts) return;
  if (findShifts(message.id, index).length >= info.uses || findDefense(message.id, index)) return;
  const free = breathingFree(target, "shift", info);
  const cost = free ? 0 : info.cost;
  if (!(await spendEnergy(target, cost, "Shift"))) return;
  if (free) await useBreathing(target, "shift");
  const cur = effectiveEntry(message.id, index, entry);
  const flag = { attackMessage: message.id, index, mode: opts.mode };
  let body = `<div class="fs-notes">${info.tree} · ${cost ? `${cost} Energy` : free ? "Free (Breathing Room)" : "Free (Versatility)"}</div>`;
  const rolls = [];
  if (opts.mode === "dis") {
    const net = rerollNet(message.id, index, entry) - 1;
    const roll = await evaluate(poolFormula(1, entry.die ?? 1, net));
    rolls.push(roll);
    Object.assign(flag, { total: Math.min(cur.total, roll.total), original: cur.total });
    body += `<div class="fs-notes">Original attack roll: ${cur.total}</div>${await rollBlock(roll, `Attack (d${entry.die}), re-rolled with Disadvantage`)}
      <div class="fs-result">The attack is now <strong>${Math.min(cur.total, roll.total)}</strong>${keptNote(roll.total, cur.total)}. Respond on the attack card.</div>`;
  } else body += `<div class="fs-result">${esc(entry.name)}'s dodge against this attack has Advantage. Respond on the attack card.</div>`;
  await post(target, { title: `${esc(entry.name)} — Shift`, rolls, body, flags: { flowstate: { shift: flag } } });
}

/** Breathing Room (Light Armor T5): the first Shift, Dash, and Leap each round cost no Energy. */
const roundKey = () => (game.combat?.started ? `${game.combat.id}:${game.combat.round}` : null);
function breathingFree(actor, key, info) {
  return !!info?.breathing && !!roundKey() && actor.getFlag?.("flowstate", `breathing.${key}`) !== roundKey();
}
async function useBreathing(actor, key) { if (roundKey()) await actor.setFlag("flowstate", `breathing.${key}`, roundKey()); }

/** Why Dash can't be used now ("" if it can). */
export function dashBlocked(actor) {
  const info = ab.dashInfo(actor);
  if (!info) return "Needs Dash (Light Armor T2 in Light armor, or Unarmored T1 with no armor).";
  return "";
}
/** RP/AP for a move-based ability: 1, plus any movement slow (tempo). */
const slowedCost = actor => Math.max(1, 1 + Math.max(0, actor.system.movement?.tempo ?? 0));

/** Dash (Light Armor T2 / Unarmored T1): 1 RP (+ slows): move up to your speed right away, even off-turn. */
export async function dash(actor) {
  if (cantAct(actor, "move")) return;
  const info = ab.dashInfo(actor);
  if (!info) return ui.notifications.warn(`${actor.name}: ${dashBlocked(actor)}`);
  const rp = slowedCost(actor);
  const free = breathingFree(actor, "dash", info);
  const cost = free ? 0 : info.cost;
  if (inActiveCombat(actor) && actor.system.energy.value < cost) return ui.notifications.warn(`${actor.name} needs ${cost} Energy for Dash.`);
  if (!(await spendPoints(actor, "rp", rp, "Dash"))) return;
  if (!(await spendEnergy(actor, cost, "Dash"))) return;
  if (free) await useBreathing(actor, "dash");
  await actor.setFlag("flowstate", "freeMove", true);
  await post(actor, { title: `${esc(actor.name)} — Dash`, body: `<div class="fs-result">${esc(actor.name)} can move up to ${actor.system.movement?.speed ?? "their"} ft right now (one move, even off-turn).</div>
    <div class="fs-notes">${info.tree} · ${rp} RP · ${cost ? `${cost} Energy` : free ? "free (Breathing Room)" : "free (Speedy)"}</div>` });
}

/** Leap (Light Armor T3 / Unarmored T2): 1 AP (+ slows, not doubled): Jump. */
export async function leap(actor) {
  if (cantAct(actor, "move")) return;
  const info = ab.leapInfo(actor);
  if (!info) return ui.notifications.warn(`${actor.name} needs Leap (Light Armor T3 in Light armor, or Unarmored T2 with no armor).`);
  const ap = slowedCost(actor);
  const free = breathingFree(actor, "leap", info);
  const cost = free ? 0 : info.cost;
  if (inActiveCombat(actor) && actor.system.energy.value < cost) return ui.notifications.warn(`${actor.name} needs ${cost} Energy for Leap.`);
  if (!(await spendAP(actor, ap, "Leap"))) return;
  if (!(await spendEnergy(actor, cost, "Leap"))) return;
  if (free) await useBreathing(actor, "leap");
  const speed = actor.system.movement?.speed ?? 0;
  await post(actor, { title: `${esc(actor.name)} — Leap`, body: `<div class="fs-result">Jump: up to ${Math.floor(speed / 5)} ft up and ${speed} ft across (the peak is at the midpoint).</div>
    <div class="fs-notes">${info.tree} · ${ap} AP · ${cost ? `${cost} Energy` : "free (Breathing Room)"}</div>` });
}

/** The Close Quarters re-roll for one target of an attack card, if used. */
export function findCloseQuarters(attackMessageId, index) {
  return game.messages.find(m => {
    const f = m.getFlag("flowstate", "closeQuarters");
    return f?.attackMessage === attackMessageId && f.index === index;
  });
}

/**
 * Close Quarters (Bladed T2): when attacked in melee while holding a Bladed weapon, spend Energy (half the weapon's
 * Scaling Stat min) and the incoming attack is re-rolled at double Disadvantage. The defender then responds as usual.
 */
async function closeQuarters(message, index, target, entry) {
  if (findCloseQuarters(message.id, index)) return ui.notifications.info("Close Quarters was already used against this attack.");
  const weapons = ab.bladedHeld(target, 2);
  if (!weapons.length) return ui.notifications.warn(`${entry.name} needs a held Bladed weapon for Close Quarters.`);
  let item = weapons[0];
  if (weapons.length > 1) {
    const opts = await optionsDialog(`${entry.name} — Close Quarters`, `<div class="form-group"><label>Weapon</label><select name="item">
      ${weapons.map(i => `<option value="${i.id}">${esc(i.name)} — ${ab.BLADED_COST.closeQuarters(i)} Energy</option>`).join("")}</select></div>`, "Close Quarters");
    if (!opts) return;
    item = target.items.get(opts.item) ?? item;
  }
  if (findCloseQuarters(message.id, index) || findDefense(message.id, index)) return;
  const cost = ab.BLADED_COST.closeQuarters(item);
  if (!(await spendEnergy(target, cost, "Close Quarters"))) return;
  const die = entry.die ?? 1;
  const net = rerollNet(message.id, index, entry) - 2;
  const roll = await evaluate(poolFormula(1, die, net));
  const cur = effectiveEntry(message.id, index, entry).total;
  await post(target, {
    title: `${esc(entry.name)} — Close Quarters`,
    rolls: [roll],
    body: `<div class="fs-notes">${esc(item.name)} · ${cost} Energy · the attack is re-rolled at double Disadvantage</div>
      <div class="fs-notes">Original attack roll: ${cur}</div>
      ${await rollBlock(roll, `Attack (d${die}), re-rolled`)}
      <div class="fs-notes">${netLabel(net) || "No net Advantage"}</div>
      <div class="fs-result">The attack is now <strong>${Math.min(cur, roll.total)}</strong>${keptNote(roll.total, cur)}. Respond on the attack card.</div>`,
    flags: { flowstate: { closeQuarters: { attackMessage: message.id, index, total: Math.min(cur, roll.total), original: cur } } }
  });
}

/**
 * Did the first attack in a chain land? true / false, "pending" while any target hasn't responded,
 * or null when it can't be known (an untargeted attack).
 */
export function firstHitLanded(sourceMessageId) {
  const msg = sourceMessageId ? game.messages.get(sourceMessageId) : null;
  const attack = msg?.getFlag("flowstate", "attack");
  if (!attack) return null;
  const results = attack.targets.map((_, i) => findDefense(sourceMessageId, i)?.getFlag("flowstate", "defense")?.result);
  if (results.some(r => r?.hit)) return true;
  return results.every(Boolean) ? false : "pending";
}

/* ---- Follow-ups wait until the exchange is resolved ---- */

/** Does this exchange hit, and still owe a damage roll? */
const expectsDamage = o => !o.breakFree && !o.throwGrappled && !o.grappleOnly && !o.push && !!o.damage && o.damage.trim() !== "0";

/** The "no riposte" record for a defense card, if the defender passed. */
export function findRiposteDeclined(defenseMessageId) {
  return game.messages.find(m => m.getFlag("flowstate", "riposteDeclined") === defenseMessageId);
}

/**
 * Is this attack card's exchange fully resolved? Every target has responded, every hit that deals damage has
 * rolled it, and every successful Parry has been answered (Riposte resolved, or passed).
 */
export function exchangeDone(message, depth = 0) {
  const attack = message?.getFlag("flowstate", "attack");
  if (!attack) return true;
  if (depth > 10) return true;
  for (const [index] of attack.targets.entries()) {
    const def = findDefense(message.id, index);
    if (!def) return false;
    const r = def.getFlag("flowstate", "defense").result;
    if (r.hit && expectsDamage(attack.opts) && !findDamage(def.id)) return false;
    // A Parry that took no direct damage offers a Riposte on the damage card: wait for it (or a pass).
    const dm = r.hit ? findDamage(def.id) : null;
    if (dm?.getFlag("flowstate", "damage")?.riposte) {
      const rip = findFollowup(dm.id);
      if (rip ? !exchangeDone(rip, depth + 1) : !findRiposteDeclined(dm.id)) return false;
    }
    if (r.parry?.success && !r.parry.noRiposte) {
      const rip = findFollowup(def.id);
      if (rip ? !exchangeDone(rip, depth + 1) : !findRiposteDeclined(def.id)) return false;
    }
  }
  return true;
}

/** The follow-up card already posted for an attack, if any. */
export function findFollowupCard(attackMessageId) {
  return game.messages.find(m => m.getFlag("flowstate", "followupCard") === attackMessageId);
}

const followupCardInFlight = new Set();

/**
 * Post an attack's follow-up buttons on their own card once its exchange is resolved. Also walks up to any attack
 * this one answers (a Riposte), since that attack's follow-ups wait for the Riposte to finish too.
 */
export async function postReadyFollowups(message) {
  let msg = message;
  for (let depth = 0; msg && depth < 10; depth++) {
    await maybeBrawlingCard(msg);
    await maybeFlurryCard(msg);
    const f = msg.getFlag("flowstate", "followups");
    if (f?.list?.length && !findFollowupCard(msg.id) && !followupCardInFlight.has(msg.id) && exchangeDone(msg)) {
      followupCardInFlight.add(msg.id);
      try {
        const actor = await fromUuid(f.actor);
        const label = msg.getFlag("flowstate", "attack")?.opts?.label;
        await ChatMessage.create({
          speaker: actor ? ChatMessage.getSpeaker({ actor }) : msg.speaker,
          content: `<div class="flowstate-card"><header class="fs-card-title">Follow-up — ${esc(label || "Attack")}</header>
            <div class="fs-notes">${esc(actor?.name ?? "The attacker")} can make one follow-up attack (no AP/RP).</div>
            ${followupsHTML(f.actor, f.list, msg.id)}</div>`,
          flags: { flowstate: { followupCard: msg.id } }
        });
      } finally {
        followupCardInFlight.delete(msg.id);
      }
    }
    // A Riposte answers a defense card: re-check the attack that defense belongs to.
    const parent = msg.getFlag("flowstate", "followupOf");
    const parentMsg = parent ? game.messages.get(parent) : null;
    const viaDamage = parentMsg?.getFlag("flowstate", "damage");
    const parentDefense = viaDamage ? game.messages.get(viaDamage.defenseMessage)?.getFlag("flowstate", "defense") : parentMsg?.getFlag("flowstate", "defense");
    msg = parentDefense ? game.messages.get(parentDefense.attackMessage) : null;
  }
}

const brawlCardInFlight = new Set();

/**
 * Brawling T3 Combo / T5 Flow Like Water: once a set of Unarmed attacks (the attack and its Fast or Solitary follow-up)
 * has fully resolved with every hit landing on the same single target, offer the extra attack(s) on their own card.
 */
async function maybeBrawlingCard(f) {
  const fa = f?.getFlag("flowstate", "attack");
  if (!fa?.opts?.unarmedWeight || !["fast", "solitary"].includes(fa.opts.setKind)) return;
  const root = game.messages.get(f.getFlag("flowstate", "followupOf"));
  const ra = root?.getFlag("flowstate", "attack");
  if (!ra?.opts?.unarmedWeight) return;
  if (brawlCardInFlight.has(f.id) || game.messages.find(m => m.getFlag("flowstate", "brawlingCard")?.set === f.id)) return;
  if (ra.targets.length !== 1 || fa.targets.length !== 1 || ra.targets[0].uuid !== fa.targets[0].uuid) return;
  if (!exchangeDone(f) || !exchangeDone(root)) return;
  const hit = m => !!findDefense(m.id, 0)?.getFlag("flowstate", "defense")?.result?.hit;
  if (!hit(root) || !hit(f)) return;
  const attacker = await fromUuid(fa.attacker);
  if (!attacker) return;
  const fastSet = fa.opts.setKind === "fast" && fa.opts.unarmedWeight === "light";
  const solitarySet = fa.opts.setKind === "solitary" && fa.opts.unarmedWeight === "heavy" && ra.opts.unarmedWeight === "heavy";
  const combo = fastSet && ab.brawl(attacker, 3);
  const flow = (fastSet || solitarySet) && ab.brawl(attacker, 5) && !fa.opts.flowChain && !ra.opts.flowChain;
  if (!combo && !flow) return;
  const flowWeight = fastSet ? "heavy" : "light";
  const target = ra.targets[0];
  brawlCardInFlight.add(f.id);
  try {
    const B = ab.BRAWLING_COST;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="flowstate-card"><header class="fs-card-title">Brawling — ${esc(attacker.name)}</header>
        <div class="fs-notes">Every hit in the ${fastSet ? "Fast" : "Solitary"} Unarmed set landed on ${esc(target.name)}.</div>
        <div class="fs-brawl-row fs-brawl-extras" data-role="attacker" data-owner="${attacker.uuid}">
          ${combo ? `<button type="button" class="fs-brawl-extra" data-kind="combo" data-tooltip="Brawling T3: a free Light Unarmed attack with Advantage (can't chain into another Fast attack)"><i class="fa-solid fa-hand-back-fist"></i> Combo (⚡ ${B.combo(attacker)})</button>` : ""}
          ${flow ? `<button type="button" class="fs-brawl-extra" data-kind="flow" data-tooltip="Brawling T5: a free ${flowWeight === "heavy" ? "Heavy" : "Light"} Unarmed attack; it can use Fast/Solitary but not chain into more Flow Like Water"><i class="fa-solid fa-water"></i> Flow Like Water (⚡ ${B.flow(attacker, flowWeight)})</button>` : ""}
        </div>${combo && flow ? `<p class="hint">Combo comes first, then Flow Like Water.</p>` : ""}</div>`,
      flags: { flowstate: { brawlingCard: { set: f.id, attacker: attacker.uuid, target: target.uuid, flowWeight } } }
    });
  } finally {
    brawlCardInFlight.delete(f.id);
  }
}

/** Combo or Flow Like Water from a Brawling card. */
export async function brawlingExtra(card, kind) {
  const info = card.getFlag("flowstate", "brawlingCard");
  if (!info) return;
  const source = `${card.id}:${kind}`;
  if (findFollowup(source)) return ui.notifications.info("That was already used.");
  const attacker = await fromUuid(info.attacker);
  const target = await fromUuid(info.target);
  if (!attacker?.isOwner) return ui.notifications.warn(`You don't control ${attacker?.name ?? "that character"}.`);
  if (!target) return ui.notifications.warn("The target no longer exists.");
  const fist = ab.fists(attacker);
  if (!fist) return ui.notifications.warn(`${attacker.name} needs a raised fist.`);
  const combo = kind === "combo";
  return rollWeaponAttack(attacker, fist, {
    kind, weight: combo ? "light" : info.flowWeight, net: combo ? 1 : 0,
    label: combo ? "Combo (Advantage)" : "Flow Like Water", source, targetActors: [target]
  });
}

/** The defender passes on Riposte (so the attacker's follow-ups can appear). */
export async function declineRiposte(defenseMessage) {
  const defense = defenseMessage.getFlag("flowstate", "defense");
  const dmg = defenseMessage.getFlag("flowstate", "damage");
  if (!defense?.result?.parry?.success && !dmg?.riposte) return;
  if (findFollowup(defenseMessage.id) || findRiposteDeclined(defenseMessage.id)) return;
  const defender = await fromUuid(dmg?.riposte ? dmg.target : defense.result.parry.by ?? defense.target);
  if (!defender?.isOwner) return ui.notifications.warn(`Only ${defender?.name ?? "the defender"}'s owner can decide that.`);
  await post(defender, { title: `${esc(defender.name)} — No Riposte`, body: `<div class="fs-notes">${esc(defender.name)} doesn't riposte.</div>`,
    flags: { flowstate: { riposteDeclined: defenseMessage.id } } });
}

/** The follow-up attack already taken from an attack card, if any (only one per attack: Fast or Solitary). */
export function findFollowup(sourceMessageId) {
  return game.messages.find(m => m.getFlag("flowstate", "followupOf") === sourceMessageId);
}

/** A spell that was countered mid cast (a Strike at it destroyed or Ripped it): the card that cancelled it, if any. */
export function findCancel(attackMessageId) {
  return game.messages.find(m => m.getFlag("flowstate", "spellCancelled")?.attackMessage === attackMessageId);
}
export function findDefense(attackMessageId, index) {
  return game.messages.find(m => {
    const f = m.getFlag("flowstate", "defense");
    return f?.attackMessage === attackMessageId && f.index === index;
  });
}
export function findDamage(defenseMessageId) {
  return game.messages.find(m => m.getFlag("flowstate", "damage")?.defenseMessage === defenseMessageId);
}

async function postDefense(speaker, attackMessage, index, target, result, dodgeRoll, note, rollLabel = null, more = null) {
  const attack = attackMessage.getFlag("flowstate", "attack");
  const entry = effectiveEntry(attackMessage.id, index, attack.targets[index]);
  const o = attack.opts;
  const attacker = await fromUuid(attack.attacker);
  let action = "";
  let pushInfo = null;
  const extra = [];
  // Shield Toss guard (Defender T2): the guarding shield Blocks this attack automatically, then it's used up.
  const guardItem = !o.overshield && (o.melee || !o.area) && !o.breakFree && !o.throwGrappled ? shieldGuardItem(target) : null;
  if (guardItem) {
    await setActorFlag(target, "shieldGuard", null);
    const sh = syncUuid(guardItem);
    extra.push(`<div class="fs-result"><i class="fa-solid fa-shield"></i> ${esc(sh?.parent?.name ?? "An ally")}'s ${esc(sh?.name ?? "shield")} (Shield Toss guard) Blocks this attack for ${esc(target.name)}, then returns.</div>`);
  }
  // Grapples, breaking free, and creature throws don't deal crit damage: a crit is just a hit.
  if (result.crit && (o.breakFree || o.throwGrappled || o.grappleOnly)) result = { ...result, crit: false, doubleCrit: false, critStacks: 0, outcome: "Hit" };

  // Martial Theory T0: breaking free, throwing a grappled creature, and grappling.
  if (o.breakFree) {
    if (result.hit && attacker.getFlag("flowstate", "lockedDown")) {
      // Lock Down (Grappling T1): escaping only removes the Lock Down; a second escape is needed.
      await setActorFlag(attacker, "lockedDown", null);
      extra.push(`<div class="fs-result"><strong>${esc(attacker.name)} breaks the Lock Down</strong>, but is still grappled.</div>`);
    } else if (result.hit) { await setGrapple(attacker, null); extra.push(`<div class="fs-result"><strong>${esc(attacker.name)} breaks free!</strong></div>`); }
    else extra.push(`<div class="fs-notes">${esc(attacker.name)} is still grappled.</div>`);
  } else if (o.throwGrappled) {
    const thrown = await fromUuid(o.throwGrappled);
    const out = await resolveGrappleThrow(attacker, thrown, target, result.hit, o.throwForce, { release: !o.knockInto && !o.slamGrappled, crunch: !!o.crunch, slam: !!o.slamGrappled });
    extra.push(out);
  } else if (result.hit && o.grapple) {
    await setGrapple(target, attack.attacker);
    extra.push(`<div class="fs-result"><strong>${esc(target.name)} is grappled</strong> by ${esc(attacker.name)}.</div>`);
  }
  // Palisade / Wall (Reach T1/T3): a hit stops the mover just outside your reach (back where the move started).
  if (o.palisadeFrom && result.hit) {
    const tok = await fromUuid(o.palisadeFrom.token);
    if (tok?.object) await moveTokenTopLeft(tok.object, palisadeSpot(tok, o.palisadeFrom, attacker, o.itemUuid ? await fromUuid(o.itemUuid) : null));
    extra.push(`<div class="fs-result"><strong>${esc(target.name)}'s movement is stopped</strong> just outside ${esc(attacker.name)}'s reach.</div>`);
  }
  // Disarm (Curved T1): on a hit the target lets go of the chosen item (or their grapple).
  if (o.disarm && result.hit) {
    if (o.disarm === "grapple") {
      const held = grappledBy(target);
      for (const v of held) await setGrapple(v, null);
      extra.push(`<div class="fs-result"><strong>Disarmed:</strong> ${esc(target.name)} lets go of ${esc(held.map(v => v.name).join(", ") || "nothing")}.</div>`);
    } else {
      const it = await fromUuid(o.disarm);
      if (it && it.parent?.uuid === target.uuid) {
        await requestGM("dropItem", { actor: target.uuid, item: it.uuid, near: null });
        extra.push(`<div class="fs-result"><strong>Disarmed:</strong> ${esc(target.name)} drops ${esc(it.name)}.</div>`);
      }
    }
  }
  // Momentum (Curved T3): each hit can add Advantage or Strengthened to your further Curved attacks on this target.
  if (o.momentumItem && result.hit && !o.omnislash) {
    extra.push(`<div class="fs-brawl-row fs-momentum-row" data-role="attacker" data-owner="${attacker.uuid}">
      <button type="button" class="fs-momentum" data-kind="adv" data-tooltip="Curved T3: further Curved attacks on ${esc(target.name)} get +1 Advantage until your next turn"><i class="fa-solid fa-angles-up"></i> Momentum: Advantage</button>
      <button type="button" class="fs-momentum" data-kind="str" data-tooltip="Curved T3: further Curved attacks on ${esc(target.name)} get +1 Strengthened until your next turn"><i class="fa-solid fa-angles-up"></i> Momentum: Strengthened</button></div>`);
  }
  // Like Shooting Fish (Longshot T2): rough-terrain movement until the shooter's next turn.
  if (o.fishy && result.hit) {
    await setStatus(target, "fishy", true);
    await setActorFlag(target, "fishyBy", attacker.uuid);
    extra.push(`<div class="fs-result">${esc(target.name)} moves as if in rough terrain (+1 AP) until ${esc(attacker.name)}'s next turn.</div>`);
  }
  // Ruby / Sapphire (Shroud) counters: Ignite / Slow stacks on a hit.
  if (o.inflict && result.hit) {
    const c = target.system.conditions ?? {};
    const up = {};
    for (const [k, v] of Object.entries(o.inflict)) if (v) for (const [ck, cv] of Object.entries(addStacks(c, k === "slow" || k === "haste" ? "_" : k, v))) up[`system.conditions.${ck}`] = cv;
    for (const [k, v] of Object.entries(o.inflict)) if (v && (k === "slow" || k === "haste")) up[`system.conditions.${k}`] = (c[k] ?? 0) + v;
    if (Object.keys(up).length) {
      if (target.isOwner) await target.update(up); else await requestGM("updateActor", { uuid: target.uuid, data: up });
      if (o.inflict.electric) await setActorFlag(target, "electricBy", attacker.uuid);
      extra.push(`<div class="fs-result">${esc(target.name)} gets ${Object.entries(o.inflict).filter(([, v]) => v).map(([k, v]) => `${v} ${k === "ignite" ? "Ignite" : k === "slow" ? "Slow" : k === "haste" ? "Haste" : STAIN_VARIANTS[k]?.label ?? k}`).join(", ")}.</div>`);
    }
  }
  // Retort Shroud: 1 RP to Weaken the damage of a hit it can block.
  if (result.hit && o.damage && target.system?.shroud?.system.shroudType === "retort" && shroudBlocks(o.type ?? "physical") && canSpend(target, "rp", 1)) {
    extra.push(`<div class="fs-brawl-row fs-retort-row" data-role="defender" data-owner="${entry.uuid}">
      <button type="button" class="fs-retort" data-tooltip="Retort Shroud: the damage of this hit gets a stack of Weakened"><i class="fa-solid fa-ghost"></i> Retort (1 RP)</button></div>`);
  }
  // Slice (Balanced T3, Light): their movement costs +1 AP until the attacker's next turn.
  if (o.sliceSlow && result.hit) {
    await setStatus(target, "sliced", true);
    await setActorFlag(target, "slicedBy", attacker.uuid);
    extra.push(`<div class="fs-result">Slice: ${esc(target.name)}'s movement costs +1 AP until ${esc(attacker.name)}'s next turn.</div>`);
  }
  // Thrasher T1 Grapple / T5 Get Over Here!: the weapon holds them (and pulls them in, prone or Locked Down).
  if (o.thrasherGrapple && result.hit) {
    await setGrapple(target, attacker.uuid);
    await setActorFlag(target, "grappleWeapon", o.thrasherGrapple);
    if (o.thrasherThrown) await setActorFlag(target, "grappleStatic", o.thrasherThrown);        // a thrown weapon pins them where it is
    extra.push(`<div class="fs-result"><strong>${esc(target.name)} is grappled</strong> by ${esc(attacker.name)}'s weapon (it can't attack while holding them).</div>`);
    if (o.getOverHere) {
      const aTok = attackerToken(attacker), tTok = target.getActiveTokens?.()[0];
      if (aTok && tTok && globalThis.canvas?.grid && !adjacent(aTok, tTok)) {
        const spot = adjacentSpot(aTok, tTok, aTok, attacker.system.derived?.size?.melee ?? 5);
        if (spot) await moveTokenTopLeft(tTok, spot);
      }
      if (ab.grappling(attacker, 1)) {
        await setActorFlag(target, "lockedDown", attacker.uuid);
        extra.push(`<div class="fs-result">${esc(target.name)} is pulled in and <strong>Locked Down</strong> (prone, can't move).</div>`);
      } else extra.push(`<div class="fs-result">${esc(target.name)} is pulled in and knocked prone.</div>`);
      await setStatus(target, "prone", true);
    }
  }
  // Shield Toss (Defender T2): returns on a hit (or Bounces, T4), guards the target, or lands by them on a miss.
  if (o.shieldToss && !o.breakFree) {
    const shield = await fromUuid(o.shieldToss.item);
    if (!result.hit) {
      extra.push(`<div class="fs-notes">${esc(shield?.name ?? "The shield")} misses and lands by ${esc(target.name)}.</div>`);
      if (shield && attacker) await requestGM("dropItem", { actor: attacker.uuid, item: shield.uuid, near: target.uuid });
    } else if (o.shieldToss.mode === "guard") {
      await setActorFlag(target, "shieldGuard", { blocker: attacker.uuid, item: o.shieldToss.item });
      extra.push(`<div class="fs-result">${esc(shield?.name ?? "The shield")} guards ${esc(target.name)}: ${esc(attacker.name)} can Block the next attack against them (no range needed), then it returns.</div>`);
    } else {
      extra.push(`<div class="fs-notes">${esc(shield?.name ?? "The shield")} returns to ${esc(attacker.name)}${ab.defender(attacker, shield, 4) ? " unless it Bounces" : ""}.</div>`);
      if (shield && ab.defender(attacker, shield, 4)) {
        extra.push(`<div class="fs-brawl-row fs-bounce-row" data-role="attacker" data-owner="${attacker.uuid}">
          <button type="button" class="fs-bounce" data-tooltip="Defender T4: target another creature within throw range of ${esc(target.name)}; the attack has ${(o.shieldToss.bounces ?? 0) + 1}× Disadvantage"><i class="fa-solid fa-arrow-turn-up"></i> Bounce (target the next creature first)</button></div>`);
      }
    }
  }
  // Brawling T4 Kick Out: a hit knocks the target prone (no more than one size larger than you).
  if (result.hit && o.kickOut && !o.breakFree && !o.throwGrappled) {
    if ((target.system?.size ?? 3) <= (attacker.system?.size ?? 3) + 1) {
      await setStatus(target, "prone", true);
      extra.push(`<div class="fs-result"><strong>${esc(target.name)} is knocked prone</strong> (Kick Out).</div>`);
    } else extra.push(`<div class="fs-notes">Kick Out: ${esc(target.name)} is too large to knock prone.</div>`);
  }
  // Brawling T2 Dip: free move away; Shatter: strike back at the attacker or their weapon.
  if (result.parry?.success && result.parry.style === "dip") {
    extra.push(`<div class="fs-notes">${esc(target.name)} can move up to ${target.system.movement?.speed ?? "their"} ft away for free (one move, even off-turn).</div>`);
  }
  // Medium Armor T1 Limber: after succeeding on an attack roll (the attack hit) or a dodge/parry roll, in combat.
  const limberFor = [];
  if (result.hit && !result.parry?.success) limberFor.push([attacker, "attacker"]);
  if ((dodgeRoll && !result.hit && !result.parry) || (result.parry?.success && dodgeRoll)) limberFor.push([target, "defender"]);
  for (const [who, role] of limberFor) {
    if (!who || !ab.medium(who, 1) || !inActiveCombat(who) || who.statuses?.has("limber")) continue;
    extra.push(`<div class="fs-brawl-row fs-limber-row" data-role="${role}" data-owner="${who.uuid}">
      <button type="button" class="fs-limber" data-actor="${who.uuid}" data-tooltip="Medium Armor T1: your next attack, dodge, or parry roll before your next turn has Advantage"><i class="fa-solid fa-person-running"></i> Limber: ${esc(who.name)} (⚡ ${ab.mediumCost(who, "limber")})</button></div>`);
  }
  // Swift T1 Cut Back: after a successful dodge, Riposte with a held Swift weapon.
  if (dodgeRoll && !result.hit && !result.parry && ab.swiftHeld(target, 1).length && canSpend(target, "rp", Math.min(...ab.swiftHeld(target, 1).map(i => i.system.profile.ap)))) {
    const sw = ab.swiftHeld(target, 1);
    const rp = Math.min(...sw.map(i => i.system.profile.ap));
    extra.push(`<div class="fs-brawl-row fs-cutback-row" data-role="defender" data-owner="${entry.uuid}">
      <button type="button" class="fs-cut-back" data-tooltip="Swift T1: Riposte ${esc(attacker.name)} with a held Swift weapon (RP = its attack AP); Fast follow-ups allowed"><i class="fa-solid fa-reply"></i> Cut Back (${rp} RP)</button></div>`);
  }
  // Unarmored T1 Dash used against this attack (automatic with Speedy, T3): once it hits or misses, the defender may move for 1 RP (+ slows).
  if ((findDash(attackMessage.id, index) || attack.targets[index]?.autoDash) && canSpend(target, "rp", slowedCost(target))) {
    extra.push(`<div class="fs-brawl-row fs-dash-move-row" data-role="defender" data-owner="${entry.uuid}">
      <button type="button" class="fs-dash-move" data-tooltip="Dash: move up to your speed now"><i class="fa-solid fa-person-running"></i> Dash: move (${slowedCost(target)} RP)</button></div>`);
  }
  // Brawling T4 Redirect: after a successful Parry or dodge against a melee attack.
  if (o.melee && ab.brawl(target, 4) && ab.fists(target) && (result.parry?.success || (dodgeRoll && !result.hit && !result.parry))) {
    extra.push(`<div class="fs-brawl-row fs-redirect-row" data-role="defender" data-owner="${entry.uuid}">
      <button type="button" class="fs-redirect" data-tooltip="Target a creature next to you first"><i class="fa-solid fa-shuffle"></i> Redirect (⚡ ${ab.BRAWLING_COST.redirect(target)})</button></div>`);
  }
  // Martial Theory T1 Riposte: after a successful Parry, strike back for RP equal to the weapon's attack AP.
  let autoDeclineBy = null;
  if (result.parry?.success && !result.parry.noRiposte && !canSpend(await fromUuid(result.parry.by ?? entry.uuid), "rp", result.parry.ap)) autoDeclineBy = await fromUuid(result.parry.by ?? entry.uuid);   // no RP left: no Riposte to offer
  else if (result.parry?.success && !result.parry.noRiposte) {
    const parryItem = await fromUuid(result.parry.item);
    const perfect = parryItem && ab.bladed(target, parryItem, 5)
      ? `<button type="button" class="fs-riposte" data-perfect="1" data-tooltip="Bladed T5: Advantage and Strengthened, and so is its Fast/Solitary follow-up">
          <i class="fa-solid fa-star"></i> Perfect Riposte (${result.parry.ap} RP · ⚡ ${ab.BLADED_COST.perfectRiposte(parryItem)})</button>` : "";
    extra.push(`<div class="fs-riposte-row" data-role="defender" data-owner="${result.parry.by ?? entry.uuid}">
      <button type="button" class="fs-riposte"><i class="fa-solid fa-reply"></i> Riposte (${result.parry.ap} RP)</button>${perfect}
      <button type="button" class="fs-no-riposte" data-tooltip="Pass, so the attacker's follow-up can go ahead"><i class="fa-solid fa-xmark"></i> No riposte</button></div>`);
  }

  if (result.hit && !o.breakFree && !o.throwGrappled && !o.grappleOnly) {
    if (o.launchForce) {
      // Launch (Heavy Armor T5): Bodyslam applies 10× its damage as Force instead of damage.
      const d = attacker.system.derived;
      const stacks = (o.stacks ?? 0) + (result.critStacks ?? 0) + (o.physical ? d.size.physical : 0);
      const force = applyStacks(o.launchForce, stacks);
      const feet = forceFeet(force, target, false);
      const crunchFeet = ab.strength(attacker, 3) ? forceFeet(force, target, true) : 0;
      action = `<div class="fs-result">Launch: Force ${force} → up to <strong>${feet} ft</strong>${crunchFeet > feet ? ` (${crunchFeet} ft with Crunch Time)` : ""}</div>${Math.max(feet, crunchFeet) > 0 ? knockbackRow(attack.attacker, feet, "Launch") : ""}`;
      pushInfo = Math.max(feet, crunchFeet) > 0 ? { attacker: attack.attacker, target: target.uuid, force, feet, label: "Launch" } : null;
    } else if (o.push) {
      const d = attacker.system.derived;
      const stacks = (o.stacks ?? 0) + (result.critStacks ?? 0) + (o.physical ? d.size.physical : 0);
      const force = applyStacks(pushForce(d.effective.str.value), stacks);
      const feet = forceFeet(force, target, false);
      const crunchFeet = ab.strength(attacker, 3) ? forceFeet(force, target, true) : 0;
      action = `<div class="fs-result">Push: Force ${force} → up to <strong>${feet} ft</strong>${crunchFeet > feet ? ` (${crunchFeet} ft with Crunch Time)` : ""}</div>${Math.max(feet, crunchFeet) > 0 ? knockbackRow(attack.attacker, feet, "Push") : ""}`;
      pushInfo = Math.max(feet, crunchFeet) > 0 ? { attacker: attack.attacker, target: target.uuid, force, feet, label: "Push" } : null;
    } else if (o.damage && o.damage.trim() !== "0") {
      action = `<div class="fs-exchange-buttons" data-role="attacker" data-owner="${attack.attacker}">
        <button type="button" class="fs-roll-damage"><i class="fa-solid fa-burst"></i> Roll damage (${esc(attacker?.name ?? "attacker")})</button></div>`;
    }
  }
  // Hexes (Witchery) that trigger on the attack roll or the dodge/parry: Roll and Fail/Success.
  if (aff) await aff.afterDefense({ attacker, target, result, dodgeRoll });
  // A Make aimed at a creature that missed: it lands on the floor beside them.
  if (conj && o.spell?.makeAct && !result.hit) await conj.makeMiss({ attacker, target, sp: o.spell });
  // Spells: Force, shields, and die-size penalties that don't wait for damage.
  let spellRolls = [], defenseChain = null;
  if (result.hit && o.spell) {
    const sh = await spellHit(attacker, target, o, result, entry, dodgeRoll?.total ?? null);
    if (sh) { extra.push(sh.html); spellRolls = sh.rolls; if (sh.push) pushInfo = sh.push; defenseChain = sh.chain; }
  }
  // Mental: other creatures' attacks that hit can be Infused (Destruction Tenet).
  if (result.hit && !o.mental && mentalHook?.anyHit && attacker) await mentalHook.anyHit({ attacker, target, result });
  // Mental: a Manifest's Mode or a Ward's effect, once the attack is answered.
  if (o.mental && mentalHook) {
    const mh = await mentalHook.onResolve({ attacker, target, o, result, entry, dodgeRoll, index });
    if (mh?.html) extra.push(mh.html);
    if (mh?.rolls?.length) spellRolls = [...spellRolls, ...mh.rolls];
    if (mh?.push) pushInfo = mh.push;
  }
  // Scorch (Slam + Flame): a failed dodge repeats the burn.
  if (result.hit && dodgeRoll) for (const e of spellEffects(target, "scorch")) {
    const amt = Number(e.flags.flowstate.spellEffect.amount) || 0;
    if (amt > 0) { extra.push(`<div class="fs-result"><i class="fa-solid fa-fire"></i> ${esc(target.name)} failed the dodge: the burn repeats for ${amt} heat damage.</div>`); await requestDamage(target, amt, "heat", 0, null, { silent: true }); }
  }
  // Shatter (Brawling T2) still hits a melee attack that misses (the hit path applies it when damage is rolled).
  let shatterMiss = null;
  if (!result.hit && o.melee && target && guardFor(target, o, attackMessage.id, index).shatter
    && !game.messages.find(m => { const f = m.getFlag("flowstate", "defense"); return f?.attackMessage === attackMessage.id && f.index === index && f.shatter; })) {
    shatterMiss = await shatterStrike(target, attacker, o);
  }
  const blockerName = result.parry?.by ? (await fromUuid(result.parry.by))?.name : null;
  const title = blockerName ? `${esc(blockerName)} blocks for ${esc(entry.name)} — ${esc(o.label || "Attack")}`
    : `${esc(entry.name)} ${result.parry ? (/block/i.test(result.parry.style ?? "") ? "blocks" : result.parry.style === "brace" ? "braces" : "parries") : dodgeRoll ? "dodges" : "responds"} — ${esc(o.label || "Attack")}`;
  // Auto damage waits when the defender has a Retort to decide on first.
  const autoDamage = !!action.includes("fs-roll-damage") && autoDamageOn() && !extra.some(x => x.includes("fs-retort-row"));
  if (autoDamage) action = "";
  const defenseMessage = await post(speaker, {
    title,
    rolls: [...(dodgeRoll ? [dodgeRoll] : []), ...(more?.rolls ?? []), ...(shatterMiss?.rolls ?? []), ...spellRolls],
    body: `<div class="fs-notes">Attack roll: <strong>${entry.total}</strong></div>
      ${dodgeRoll ? await rollBlock(dodgeRoll, rollLabel ?? `Dodge (2d${target.system.derived.dodgeDie})`) : ""}
      ${note ? `<div class="fs-notes">${note}</div>` : ""}
      <div class="fs-outcome fs-${result.hit ? (result.crit ? "crit" : "hit") : "miss"}">${result.outcome}</div>
      ${extra.join("")}${more?.html ?? ""}${shatterMiss?.html ?? ""}
      <div class="fs-status"></div>
      ${action}`,
    flags: { flowstate: { defense: { attackMessage: attackMessage.id, index, target: entry.uuid, attacker: attack.attacker, result, shatter: !!shatterMiss, guardItem, dodge: dodgeRoll?.total ?? null }, knockback: pushInfo, chain: defenseChain } }
  });
  if (autoDeclineBy) await post(autoDeclineBy, { title: `${esc(autoDeclineBy.name)} — No Riposte`, body: `<div class="fs-notes">${esc(autoDeclineBy.name)} has no RP left to riposte.</div>`, flags: { flowstate: { riposteDeclined: defenseMessage.id } } });
  // "Roll damage automatically" setting: skip the button and roll straight away (no extra stacks).
  if (autoDamage) await rollExchangeDamage(defenseMessage, { auto: true });
  return defenseMessage;
}

/** World setting: roll exchange damage as soon as a hit lands (default on). */
function autoDamageOn() {
  try { return game.settings.get("flowstate", "autoDamage") !== false; } catch (err) { return true; }
}

/* ---- Step 3: attacker rolls damage (auto-applied) ---- */

/** Net Strengthened/Weakened against one target. */
function targetStacks(attacker, o, target, result, extra = 0, ctx = {}) {
  const d = attacker.system.derived;
  const t = target.system;
  const type = o.arcaneVsMagic && t.magical ? "arcane" : o.type;
  const parts = [];
  let stacks = (o.stacks ?? 0);
  if (stacks) parts.push(`${signed(stacks)} weapon/attack`);
  if (extra) { stacks += extra; parts.push(`${signed(extra)} added`); }
  if (result.critStacks) {
    const c = result.critStacks + (o.critStacks ?? 0);
    stacks += c; parts.push(`+${c} ${result.doubleCrit ? "double crit" : "crit"}`);
  }
  if (o.physical && d.size.physical) { stacks += d.size.physical; parts.push(`${signed(d.size.physical)} size`); }
  if (o.vsSupernatural && t.supernatural) { stacks += o.vsSupernatural; parts.push(`+${o.vsSupernatural} vs supernatural`); }
  if (type === "arcane" && !t.magical) { stacks -= 1; parts.push("−1 Arcane vs non-magical"); }
  // Slip Off (Balanced T1) and Harden (Heavy T4 / Titanic T3) Weaken attacks against an active Parry/Brace.
  for (const w of ctx.weaken ?? []) { stacks -= 1; parts.push(`−1 ${w}`); }
  if (ctx.distracted) { stacks -= 1; parts.push("−1 Distracting Fire"); }
  // Harden (Geomancy T5): a hardened creation's weapon deals Strengthened damage.
  if (o.itemUuid && syncUuid(o.itemUuid)?.flags?.flowstate?.made?.harden?.strong) { stacks += 1; parts.push("+1 Harden"); }
  if (o.spell && foci) { const fs = foci.damageStacks({ attacker, o, type }); if (fs.stacks) { stacks += fs.stacks; parts.push(...fs.parts); } }
  if (o.spell && arc?.magicFails(attacker)) { stacks -= 1; parts.push("−1 Illusion (their Magic has failed them)"); }
  const charmed = aff?.charmWeakened(attacker) ?? 0;
  if (charmed) { stacks -= charmed; parts.push(`−${charmed} Charm/Hex (damage rolls)`); }
  if (ctx.retort) { stacks -= 1; parts.push("−1 Retort (Shroud)"); }
  // Imposing Presence (Constitution T5): attacks from within your personal melee range that are already Weakened are Weakened again.
  if (stacks < 0 && ab.constitution(target, 5)) {
    const aTok = attackerToken(attacker), tTok = target.getActiveTokens?.()[0];
    if (aTok && tTok && globalThis.canvas?.grid && tokenDistance(aTok, tTok) <= (target.system.derived?.size?.melee ?? 5)) { stacks -= 1; parts.push("−1 Imposing Presence"); }
  }
  // Dragon Lash (Brawling T3): Strengthened, doubled against a prone target.
  if (o.dragonLash) { const d = target.statuses?.has("prone") ? 2 : 1; stacks += d; parts.push(`+${d} Dragon Lash${d === 2 ? " (prone)" : ""}`); }
  return { stacks, parts, type };
}

/** Attacker clicks Roll Damage on the defense card. */
export async function rollExchangeDamage(defenseMessage, { auto = false } = {}) {
  const defense = defenseMessage.getFlag("flowstate", "defense");
  if (!defense?.result?.hit) return;
  if (findDamage(defenseMessage.id)) return ui.notifications.info("Damage was already rolled.");
  const attackMessage = game.messages.get(defense.attackMessage);
  const attack = attackMessage?.getFlag("flowstate", "attack");
  const attacker = await fromUuid(defense.attacker);
  const target = await fromUuid(defense.target);
  if (!attack || !attacker || !target) return ui.notifications.warn("This attack can no longer be resolved.");
  if (!auto && !attacker.isOwner) return ui.notifications.warn(`Only ${attacker.name}'s owner can roll this damage.`);
  const o = attack.opts;
  await hexRoll(attacker, "damage");

  const guard = guardFor(target, o, defense.attackMessage, defense.index);
  const ctx = { distracted: !!findDistract(defense.attackMessage, defense.index)?.getFlag("flowstate", "distract")?.hit, weaken: guard.weaken,
    retort: !!findRetort(defenseMessage.id) };
  const preview = targetStacks(attacker, o, target, defense.result, 0, ctx);
  // Spells: the damage dice can depend on the target (living, direct damage, low dodge), so settle them now.
  const profile = spellProfile(o);
  let spellPlan = null, spellFacts = null;
  if (profile?.damage) {
    spellFacts = await spellDamageFacts(profile, o, attacker, target, defense, { pierce: o.pierce ?? 0, halfLimit: !!o.spell?.mods?.weakpoint, parryItems: guard.items, bash: o.bash || 0,
      shroudCtx: { source: sourceOf(o), attacker: attacker.uuid, extra: findQuartz(defense.attackMessage, defense.index), barriers: barriersFor(attacker, target) } });
    spellPlan = fx.damageDice(profile, o.spell.power, spellFacts, o.spell.mods ?? {});
  }
  const flare = spellPlan?.flare ?? null;
  const formula = flare ? `${flare.dice}d4` : spellPlan ? `${spellPlan.n}d${spellPlan.sides}` : o.damage;
  const opts = auto ? { extra: 0 } : await optionsDialog(`${o.label || "Attack"} — Damage vs ${target.name}`, `
    <p class="hint">${esc(formula)} ${DAMAGE_TYPES[preview.type]}${(o.shots ?? 1) > 1 ? ` × ${o.shots} shots` : ""}</p>
    <p class="hint">Already applied: ${preview.parts.length ? preview.parts.join(", ") : "none"} (${stackLabel(preview.stacks)})</p>
    ${stacksField("extra")}`, "Roll damage", { skipIfEmpty: true });
  if (!opts) return;
  if (findDamage(defenseMessage.id)) return;

  const shots = flare ? flare.sets : Math.max(1, o.shots ?? 1);
  const base = await rollBaseDamage(formula, shots);
  if (!base) return;
  // Cook (Heat T5): extra d4s for the heat damage you've already dealt them this turn.
  if (spellPlan?.extraDice) { const r = await evaluate(`${spellPlan.extraDice.n}d${spellPlan.extraDice.sides}`); base.rolls.push(r); base.totals.push(r.total); }
  let { stacks, parts, type } = targetStacks(attacker, o, target, defense.result, (opts.extra ?? 0) + (spellPlan?.extraStacks ?? 0) + (mentalHook?.damageStacks?.(attacker) ?? 0), ctx);
  // Discharge (Radiation T5): trade two Strengthened stacks for Advantage on your next attack before your next turn.
  let dischargeHTML = "";
  if (o.spell?.mods?.discharge && stacks >= 2 && attacker.isOwner) {
    const use = await DialogV2().confirm({ window: { title: "Discharge" }, content: `<p>Remove 2 Strengthened stacks from this damage (${stacks} → ${stacks - 2}) to give your next attack before the start of your next turn Advantage?</p>`, rejectClose: false });
    if (use) { stacks -= 2; parts.push("−2 Discharge"); await setActorFlag(attacker, "setup", { target: "any", count: 1 }); dischargeHTML = `<div class="fs-notes">Discharge: 2 Strengthened stacks removed; Advantage on your next attack before your next turn.</div>`; }
  }
  // Cleave (Slashing T4): the spell's damage is increased by your Scaling Stat min.
  const flat = o.spell?.mods?.cleave ? statMin(o.spell.scaling ?? 0) : 0;
  // Mental: Enhanced Mandate on this damage roll, and Verdict's damage change from the attack that landed.
  const md = await mentalHook?.damageCharges?.({ actor: attacker, formula, totals: base.totals });
  if (md?.totals) { base.totals = md.totals; base.rolls.push(...(md.rolls ?? [])); }
  const mflat = (md?.flat ?? 0) + (defense.result?.mentalDmg ?? 0);
  const line = damageLine(flat || mflat ? base.totals.map((t, i) => t + flat + (i === 0 ? mflat : 0)) : base.totals, stacks, type, shots);
  // Omega (Swift T5): Heavy Swift attacks let Strengthened/Weakened change their Pierce value too.
  const pierceNow = o.omega && o.pierce ? applyStacks(o.pierce, stacks) : (o.pierce ?? 0);

  let extraHTML = spellPlan?.notes.length ? `<div class="fs-notes">${spellPlan.notes.map(esc).join(" · ")}</div>` : "";
  if (flat) extraHTML += `<div class="fs-notes">Cleave: +${flat} damage (Scaling Stat min)</div>`;
  if (md || mflat) extraHTML += `<div class="fs-notes fs-charge-note"><i class="fa-solid fa-link"></i> ${[...(md?.notes ?? []), defense.result?.mentalDmg ? `Verdict: ${defense.result.mentalDmg > 0 ? "+" : "−"}${Math.abs(defense.result.mentalDmg)} damage.` : ""].filter(Boolean).join(" ")}</div>`;
  extraHTML += dischargeHTML;
  let kb = null;
  if (o.knockback && !o.aimItem) {
    const lash = o.dragonLash ? (target.statuses?.has("prone") ? 4 : 2) : 1;
    // Weapon tags ignore Strengthened/Weakened. Knockback adds up (base, Knockback+, two-handed, Smash); Dragon Lash multiplies the total.
    const force = (o.knockback + (o.knockbackAdd ?? 0)) * lash;
    const feet = forceFeet(force, target, false);
    const crunchFeet = ab.strength(attacker, 3) ? forceFeet(force, target, true) : 0;
    extraHTML += `<div class="fs-notes">Knockback: up to ${force} Force → ${feet} ft${crunchFeet > feet ? ` (${crunchFeet} ft with Crunch Time)` : ""}${lash > 1 ? ` (Dragon Lash ×${lash})` : ""}</div>`;
    if (Math.max(feet, crunchFeet) > 0) kb = { attacker: attacker.uuid, target: target.uuid, force, feet, label: "Knockback" };
  }
  if (pierceNow) extraHTML += `<div class="fs-notes">Pierce ${pierceNow}${pierceNow !== o.pierce ? ` (${o.pierce} with Omega: ${stackLabel(stacks)})` : ""}: ignores that much armor Limit</div>`;

  // Aimed at an equipped item: the item is the target, so its Limit doesn't apply and it loses Durability instead.
  if (o.aimItem) {
    const aimed = await fromUuid(o.aimItem);
    let body = `${await baseDamageHTML(base, type)}${line.html}${parts.length ? `<div class="fs-notes">Stacks: ${parts.join(", ")}</div>` : ""}`;
    // Cleave is object damage, so it all lands on an aimed-at item.
    const aimCleave = o.cleave ?? 0;
    if (aimed && aimCleave) { line.final += aimCleave; body += `<div class="fs-notes">Cleave: +${aimCleave} to the object</div>`; }
    if (aimed && o.rend) {
      // Rend: damage to objects is Strengthened (the aimed item is the object).
      const before = line.final;
      line.final = applyStacks(line.final, o.rend.stacks);
      body += `<div class="fs-notes">Rend: ${before} → ${line.final} to the object</div>`;
    }
    if (aimed?.type === "foci" && aimed.system.profile?.selfWeakened) {
      // Zircon (Foci): damage it takes is Weakened.
      const before = line.final;
      line.final = applyStacks(line.final, -aimed.system.profile.selfWeakened);
      body += `<div class="fs-notes">Zircon: ${before} → ${line.final}</div>`;
    }
    if (aimed) {
      const left = aimed.system.durability.value - line.final;
      body += `<div class="fs-result fs-damage-taken">${esc(target.name)}'s ${esc(aimed.name)} takes ${line.final}</div>
        <ul class="fs-list"><li>−${line.final} Durability (${Math.max(left, -aimed.system.durability.max)}/${aimed.system.durability.max})</li>
        ${left <= 0 ? `<li>${esc(aimed.name)} is ${left <= -aimed.system.durability.max ? "destroyed" : "broken"}</li>` : ""}</ul>`;
      if (aimed.isOwner) await aimed.update({ "system.wear": aimed.system.wear + line.final }, { flowstateSystem: true });
      else await requestGM("wearItem", { uuid: aimed.uuid, amount: line.final });
    } else body += `<div class="fs-notes">The targeted item is gone.</div>`;
    return post(attacker, { title: `${esc(o.label || "Attack")} — Damage to ${esc(target.name)}'s ${esc(o.aimName ?? "item")}`, rolls: base.rolls, body,
      flags: { flowstate: { damage: { defenseMessage: defenseMessage.id } } } });
  }

  // Shatter (Brawling T2): the defender's Heavy Unarmed damage hits the incoming attack (its weapon) first; Solitary doubles it.
  let incoming = line.final;
  let shatterRolls = [], shattered = false;
  if (guard.shatter) {
    const sh = await shatterStrike(target, attacker, o);
    extraHTML += sh.html; shatterRolls = sh.rolls;
    if (sh.broken) { incoming = 0; shattered = true; if (kb) { kb = null; extraHTML += `<div class="fs-notes">No Knockback: the weapon broke.</div>`; } }
    else if (sh.reduce) {
      incoming = Math.max(0, incoming - sh.reduce);
      extraHTML += `<div class="fs-notes">Shatter: −${Math.min(line.final, sh.reduce)} → ${incoming}${incoming === 0 ? " (the projectile is destroyed: no damage)" : ""}</div>`;
    }
  }
  // Brace / Dip: flat reductions before any Limit.
  let dipZero = false;
  for (const r of guard.reductions) {
    const cut = Math.min(incoming, r.amount);
    incoming -= cut;
    extraHTML += `<div class="fs-notes">${r.label}: −${cut} → ${incoming}</div>`;
    if (r.label.startsWith("Dip") && incoming === 0 && line.final > 0) dipZero = true;
  }
  // Mental: damage dealt and taken is changed by Wonder effects (Pacify, Warzone, Absolution, Irradiate, Guard, ...).
  if (mentalHook?.adjust && incoming > 0) {
    const adj = await mentalHook.adjust({ attacker, target, amount: incoming, type, o, crit: !!defense.result?.crit });
    if (adj.amount !== incoming || adj.html) { incoming = adj.amount; extraHTML += adj.html; }
  }
  // Mental: a Nightmare Ward may negate some of it now, so Stains, Bleed, Gash and the like go by what is actually dealt.
  let ward = null, wardCut = 0;
  if (mentalHook?.negate && incoming > 0 && !flare) {
    ward = await wardNegate(target, incoming, type, { source: sourceOf(o), attacker: attacker.uuid });
    if (ward) { wardCut = Math.max(0, incoming - ward.amount); incoming = ward.amount; extraHTML += ward.html ?? ""; }
  }
  const cleave = shattered ? 0 : o.cleave ?? 0;
  if (cleave) extraHTML += `<div class="fs-notes">Cleave ${cleave}: object damage, hits Limits first${o.striker ? "; what gets past them hits the creature (Blood and Iron)" : ""}</div>`;

  // The outcome (soak, HP lost) goes on this card; the owner (or GM) applies it without a separate card.
  const dmgOpts = { pierce: pierceNow, halfLimit: !!o.spell?.mods?.weakpoint, maxHpLoss: !!o.spell?.mods?.chop, archetype: o.spell ? "magic" : "martial", parryItems: guard.items, bash: o.bash || 0, rend: o.rend ?? (o.spell?.mods?.melt ? { stacks: 1 } : null), cleave, cleaveToCreature: !!o.striker,
    shroudCtx: { source: sourceOf(o), attacker: attacker.uuid, extra: findQuartz(defense.attackMessage, defense.index), extraShields: findAdjust(defense.attackMessage, defense.index),
      barriers: barriersFor(attacker, target) }, mentalDone: true };
  let outcome = await damageOutcome(target, incoming, type, dmgOpts);
  // Flare (Heat T4): each set of d4s is a separate instance, so Limits apply to each.
  const instances = flare ? base.totals.map(t => applyStacks(t + flat, stacks)) : null;
  if (instances) { outcome = mergeOutcomes(await Promise.all(instances.map(a => damageOutcome(target, a, type, dmgOpts)))); incoming = instances.reduce((a, b) => a + b, 0); }
  // Spell riders that need the damage to have got through to HP (direct damage): Force, attack-die penalties.
  let spellHTML = "", spellRolls = [], chainFlag = null;
  if (profile) {
    const direct = outcome.toHp > 0;
    if (profile.force?.when === "direct" && direct) {
      const f = await spellForce(attacker, target, o, defense.result, fx.forceDice(profile, o.spell.power, { direct }), "Force", stacks);
      spellHTML += f.html; spellRolls.push(...f.rolls); kb = f.push;
    }
    const m = o.spell.mods ?? {};
    if (direct && m.bleed) {
      await putSpellEffect(target, { kind: "bleed", stack: true, onTargetTurn: true, caster: attacker.uuid, name: `Bleed (${outcome.toHp})`, amount: outcome.toHp, dmgType: "physical", chop: !!m.chop,
        description: `Takes ${outcome.toHp} direct physical damage${m.chop ? " as Max HP loss" : ""} at the start of their next turn.` });
      spellHTML += `<div class="fs-notes">Bleed: ${esc(target.name)} takes ${outcome.toHp} direct physical damage again at the start of their next turn.</div>`;
    }
    if (direct && m.gash) {
      await putSpellEffect(target, { kind: "gash", stack: true, caster: attacker.uuid, name: `Gash (${outcome.toHp})`, amount: outcome.toHp, dmgType: type, chop: !!m.chop,
        description: `Takes ${outcome.toHp} damage${m.chop ? " as Max HP loss" : ""} every time they spend AP or RP to voluntarily move, until the start of the caster's next turn.` });
      spellHTML += `<div class="fs-notes">Gash: ${esc(target.name)} takes ${outcome.toHp} damage again each time they voluntarily move, until the start of your next turn.</div>`;
    }
    if (direct && m.setup) {
      await setActorFlag(attacker, "setup", { target: target.uuid, count: m.setup });
      spellHTML += `<div class="fs-notes">Setup: ${m.setup} Advantage on your next attack roll at ${esc(target.name)} before your next turn.</div>`;
    }
    if (outcome.toHp > 0 && m.chop) spellHTML += `<div class="fs-notes">Chop: the ${outcome.toHp} direct damage is Max HP loss instead.</div>`;
    // Tier 2: Brand, Ignite/Stain stacks, Energy removal, chains, Catalyst, counters.
    if (elem) {
      spellHTML += await elem.beforeApply({ attacker, target, o, baseTotal: base.totals.reduce((a, b) => a + b, 0) + flat });
      // `dealt`: Shatter, Brace, Dip, Wonders and Wards all take it down before Stains, Energy loss and the like are worked out.
      const er = await elem.afterDamage({ o, attacker, target, defense, outcome, dealt: Math.min(line.final, incoming), type, profile, facts: spellFacts ?? {}, dmgOpts });
      spellHTML += er.html; spellRolls.push(...er.rolls); if (er.kb) kb = er.kb; chainFlag = er.chain;
    }
    const pen = fx.diePenalties(profile, o.spell.power, { direct });
    if (pen.attack) {
      await putSpellEffect(target, { kind: "attackDie", caster: attacker.uuid, name: `Attack −${pen.attack} die size`, attackDie: pen.attack, ritualOf: o.spell.ritualOf ?? null,
        description: `Attack dice are ${pen.attack} sizes smaller until the start of the caster's next turn (doesn't stack).` });
      spellHTML += `<div class="fs-notes">${esc(target.name)}'s attack rolls suffer <strong>−${pen.attack} die size</strong> until the start of your next turn.</div>`;
    }
  }
  // Balanced T4 Deflect: a Parry with a Balanced weapon that took all of the damage.
  const balancedParry = outcome.weapons?.find(w => ab.balanced(target, w.item, 4)) ?? null;
  const canDeflect = !!balancedParry && incoming > 0 && outcome.afterWeapon === 0 && !o.deflectOf && canSpend(target, "rp", 1);
  const deflectRow = canDeflect ? `<div class="fs-brawl-row fs-deflect-row" data-role="defender" data-owner="${target.uuid}">
    <button type="button" class="fs-deflect" data-tooltip="Balanced T4: send the attack back at ${esc(attacker.name)} with their own weapon's attack"><i class="fa-solid fa-rotate-left"></i> Deflect (1 RP)</button></div>` : "";
  // Riposte (Martial Theory T1): a Parry that took no direct damage. Redirect (Brawling T4) and Dip's move too.
  const noDamage = outcome.toHp === 0 && guard.any;
  const riposteItems = noDamage ? (await Promise.all(guard.riposteItems.map(u => fromUuid(u)))).filter(i => i && i.parent?.uuid === target.uuid && canSpend(target, "rp", i.system.profile?.unarmed ? 2 : i.system.profile?.ap ?? 2)) : [];
  let parryRows = "";
  if (riposteItems.length) {
    parryRows += `<div class="fs-riposte-row" data-role="defender" data-owner="${target.uuid}">
      ${riposteItems.map(i => { const ap = i.system.profile?.unarmed ? 2 : i.system.profile?.ap ?? 2; return `<button type="button" class="fs-riposte" data-item="${i.uuid}"><i class="fa-solid fa-reply"></i> Riposte: ${esc(i.name)} (${ap} RP)</button>
        ${ab.bladed(target, i, 5) ? `<button type="button" class="fs-riposte" data-item="${i.uuid}" data-perfect="1" data-tooltip="Bladed T5: Advantage and Strengthened, and so is its Fast/Solitary follow-up"><i class="fa-solid fa-star"></i> Perfect Riposte (⚡ ${ab.BLADED_COST.perfectRiposte(i)})</button>` : ""}`; }).join("")}
      <button type="button" class="fs-no-riposte" data-tooltip="Pass, so the attacker's follow-up can go ahead"><i class="fa-solid fa-xmark"></i> No riposte</button></div>`;
  }
  if (dipZero && canSpend(target, "rp", 1)) parryRows += `<div class="fs-brawl-row fs-dip-row" data-role="defender" data-owner="${target.uuid}">
      <button type="button" class="fs-dip-move" data-tooltip="Brawling T2: the Dip took the whole hit; spend 1 RP to move your speed right away"><i class="fa-solid fa-person-walking-arrow-right"></i> Dip: move (1 RP)</button></div>`;
  if (noDamage && o.melee && ab.brawl(target, 4) && ab.fists(target)) parryRows += `<div class="fs-brawl-row fs-redirect-row" data-role="defender" data-owner="${target.uuid}">
      <button type="button" class="fs-redirect" data-tooltip="Target a creature next to you first"><i class="fa-solid fa-shuffle"></i> Redirect (⚡ ${ab.BRAWLING_COST.redirect(target)})</button></div>`;
  // Let it Rip! (Circular T3): the damage is repeated against the same target (a second hit through armor).
  let ripHTML = "";
  if (o.letItRip && line.final > 0) ripHTML = `<div class="fs-result">Let it Rip! — the damage repeats</div>${damageOutcomeHTML(target, incoming, type, outcome)}`;
  // Rip and Tear (Blast T3): dealing damage with a Blast weapon reloads it for free.
  const firedWith = o.itemUuid ? await fromUuid(o.itemUuid) : null;
  if (firedWith && line.final > 0 && firedWith.system?.profile?.ranged && firedWith.system.loaded === false && ab.blast(attacker, firedWith, 3)) {
    await requestGM("loadItem", { uuid: firedWith.uuid });
    extraHTML += `<div class="fs-notes">Rip and Tear: ${esc(firedWith.name)} is reloaded for free.</div>`;
  }
  // Reach T4 Twist / T5 Impale: after direct damage with a Reach weapon.
  let reachRow = "";
  const reachWeapon = o.reachItem ? await fromUuid(o.reachItem) : null;
  if (reachWeapon && outcome.toHp > 0) {
    const regen = ab.statMinOf(target, "con") + ab.statMinOf(target, "will") + ab.statMinOf(target, "build");
    reachRow = `<div class="fs-brawl-row fs-reach-row" data-role="attacker" data-owner="${attacker.uuid}">
      ${o.pierce ? `<button type="button" class="fs-twist" data-tooltip="Reach T4: add your Pierce (${o.pierce}) as direct damage"><i class="fa-solid fa-rotate"></i> Twist +${o.pierce} (⚡ ${ab.REACH_COST.twist(reachWeapon)})</button>` : ""}
      ${ab.reach(attacker, reachWeapon, 5) ? `<button type="button" class="fs-impale" data-tooltip="Reach T5: needs more direct damage than ${esc(target.name)}'s HP Regen (${regen}); grapples them on your weapon"><i class="fa-solid fa-thumbtack"></i> Impale (⚡ ${ab.REACH_COST.impale(reachWeapon)})</button>` : ""}</div>`;
  }
  await post(attacker, {
    title: `${esc(o.label || "Attack")} — Damage to ${esc(target.name)}`,
    rolls: [...base.rolls, ...shatterRolls, ...spellRolls],
    body: `${await baseDamageHTML(base, type)}${line.html}
      ${parts.length ? `<div class="fs-notes">Stacks: ${parts.join(", ")}</div>` : ""}${extraHTML}
      ${damageOutcomeHTML(target, incoming, type, outcome)}${spellHTML}${chainFlag && elem ? elem.chainRow(attacker, chainFlag, o.spell?.chain?.depth ?? 0) : ""}${reflectRows(outcome)}${ripHTML}${parryRows}${deflectRow}${reachRow}${kb ? knockbackRow(attacker.uuid, kb.feet, kb.label) : ""}${shroudCounterRows(target, attacker, outcome)}`,
    flags: { flowstate: { damage: { defenseMessage: defenseMessage.id, swift: !!o.swift, curved: !!o.curved, turnKey: o.turnKey ?? null,
      attacker: attacker.uuid, target: target.uuid, toHp: outcome.toHp, type, riposte: riposteItems.length > 0 }, knockback: kb,
      deflect: canDeflect ? { defender: target.uuid, attacker: attacker.uuid, attackMessage: defense.attackMessage } : null,
      chain: chainFlag ? { ...chainFlag, affected: o.spell?.chain?.affected ?? [target.uuid], depth: o.spell?.chain?.depth ?? 0, primary: o.spell?.chain?.primary ?? target.uuid } : null } }
  });
  if (instances) for (const amt of instances) await requestDamage(target, amt, type, pierceNow, null, { silent: true, ...dmgOpts });
  else await requestDamage(target, incoming, type, pierceNow, null, { silent: true, ...dmgOpts, wardDone: !!ward, wardReflect: ward?.reflect ?? null });
  if (ripHTML) await requestDamage(target, incoming + wardCut, type, pierceNow, null, { silent: true, ...dmgOpts });                       // a second instance: a Ward may answer it again
  // A Summon's or Animation's attacks carry the Core they were Combo'd with (Any T1/T2/T3 + Summoning / Animation).
  if (conj && !o.spell) await conj.riderAfter({ attacker, target, o, outcome, defense });
  if (foci && o.spell?.fociFx) await foci.afterDamage({ attacker, o, type });
}

/** Twist (Reach T4) and Impale (Reach T5) from a damage card. */
export async function reachFinisher(damageMessage, kind) {
  const d = damageMessage.getFlag("flowstate", "damage");
  if (!d) return;
  const used = damageMessage.getFlag("flowstate", "damage")?.[kind] || game.messages.find(m => m.getFlag("flowstate", "reachOf") === `${damageMessage.id}:${kind}`);
  if (used) return ui.notifications.info(`${kind === "twist" ? "Twist" : "Impale"} was already used.`);
  const attacker = await fromUuid(d.attacker), target = await fromUuid(d.target);
  if (!attacker?.isOwner) return ui.notifications.warn(`Only ${attacker?.name ?? "the attacker"}'s owner can do that.`);
  if (!target) return;
  const defense = game.messages.get(d.defenseMessage)?.getFlag("flowstate", "defense");
  const o = game.messages.get(defense?.attackMessage)?.getFlag("flowstate", "attack")?.opts ?? {};
  const weapon = o.reachItem ? await fromUuid(o.reachItem) : null;
  if (!weapon) return ui.notifications.warn("The Reach weapon is gone.");
  const twisted = game.messages.find(m => m.getFlag("flowstate", "reachOf") === `${damageMessage.id}:twist`);
  if (kind === "twist") {
    const cost = ab.REACH_COST.twist(weapon);
    if (!(await spendEnergy(attacker, cost, "Twist"))) return;
    const amount = o.pierce ?? 0;
    const body = damageOutcomeHTML(target, amount, d.type, await damageOutcome(target, amount, d.type, { bypass: true }));
    await requestDamage(target, amount, d.type, 0, null, { silent: true, bypass: true });
    return post(attacker, { title: `${esc(attacker.name)} — Twist`, body: `<div class="fs-notes">${cost} Energy · +${amount} direct damage (Pierce)</div>${body}`,
      flags: { flowstate: { reachOf: `${damageMessage.id}:twist` } } });
  }
  const regen = ab.statMinOf(target, "con") + ab.statMinOf(target, "will") + ab.statMinOf(target, "build");
  const dealt = (d.toHp ?? 0) + (twisted ? (o.pierce ?? 0) : 0);
  if (dealt <= regen) return ui.notifications.warn(`Impale needs more direct damage (${dealt}) than ${target.name}'s HP Regen (${regen}).`);
  const cost = ab.REACH_COST.impale(weapon);
  if (!(await spendEnergy(attacker, cost, "Impale"))) return;
  await setGrapple(target, attacker.uuid);
  await setActorFlag(target, "grappleWeapon", weapon.uuid);
  return post(attacker, { title: `${esc(attacker.name)} — Impale`, body: `<div class="fs-result"><strong>${esc(target.name)} is impaled</strong> on ${esc(weapon.name)} (grappled). ${esc(weapon.name)} can't attack while they're held.</div><div class="fs-notes">${cost} Energy · ${dealt} direct damage > HP Regen ${regen}</div>`,
    flags: { flowstate: { reachOf: `${damageMessage.id}:impale` } } });
}

/**
 * Apply damage directly if we own the target; otherwise ask the active GM to do it. With `wantResult` the answer is
 * { toHp, armorLoss, reduced } (waits for the GM; for effects that go by the damage dealt, after anything that negated or reduced it).
 */
export async function requestDamage(target, amount, type, pierce = 0, parryItem = null, { silent = false, bash = 0, bypass = false, rend = null,
  parryItems = null, cleave = 0, cleaveToCreature = false, shroudCtx = null, halfLimit = false, maxHpLoss = false, archetype = "martial", brandBy = false, ignoreArmor = false, fromHex = false, mentalDone = false, wardDone = false, wardReflect = null, wantResult = false } = {}) {
  const o = { pierce, parryItem, parryItems, silent, bash, bypass, rend, cleave, cleaveToCreature, shroudCtx, halfLimit, maxHpLoss, archetype, brandBy, ignoreArmor, fromHex, mentalDone, wardDone, wardReflect };
  if (target.isOwner) return applyDamage(target, amount, type, o);
  const payload = { target: target.uuid, amount, type, ...o };
  return wantResult ? askGMDamage(payload) : requestGM("applyDamage", payload);
}

/** Damage results that are on their way back from the GM: reqId → resolver. */
const pendingDamage = new Map();
let damageReq = 0;
/**
 * Ask the GM to apply damage and wait for what came of it ({ toHp, armorLoss, reduced }: a Ward or a Wonder may have taken some off, and effects that
 * go by the damage dealt need to know). Gives up after two minutes (null).
 */
async function askGMDamage(payload) {
  if (game.user.isGM) return summarizeDamage(await GM_ACTIONS.applyDamage(payload));
  if (!game.users.activeGM) return requestGM("applyDamage", payload);
  return askGM("applyDamage", payload);
}
/** Run a GM action over the socket and wait for what it answers (null after two minutes, or if it gave nothing). */
function askGM(action, payload) {
  const reqId = `${game.user.id}:${++damageReq}`;
  return new Promise(resolve => {
    const timer = setTimeout(() => { pendingDamage.delete(reqId); resolve(null); }, 120000);
    pendingDamage.set(reqId, v => { clearTimeout(timer); resolve(v); });
    game.socket.emit("system.flowstate", { action, ...payload, reply: { to: game.user.id, reqId } });
  });
}
/**
 * Mental: let a Nightmare Ward (or a Premonition charge) negate part of incoming damage *before* anything that goes by the damage dealt
 * (Stains, Bleed, Gash...) is worked out. The Ward's owner is asked (the GM's client, for someone else's character).
 * Returns { amount, html, reflect } or null when it can't be asked (then applyDamage asks as usual).
 */
export async function wardNegate(target, amount, type, { source = null, attacker = null } = {}) {
  if (!mentalHook?.negate || amount <= 0 || target.type === "pile") return null;
  if (target.isOwner) {
    const r = await mentalHook.negate(target, amount, type, { source, attacker });
    return { amount: r.amount, html: r.html ?? "", reflect: r.reflect ?? null };
  }
  if (game.user.isGM || !game.users.activeGM) return null;
  return askGM("wardNegate", { target: target.uuid, amount, type, source, attacker });
}
const summarizeDamage = out => out ? { toHp: out.toHp ?? 0, armorLoss: out.armorLoss ?? 0, reduced: out.reduced ?? 0 } : null;
/** A client receives the result of damage it asked the GM for. */
export function damageResult(data) {
  pendingDamage.get(data.reqId)?.(data.result ?? null);
  pendingDamage.delete(data.reqId);
}

/** Ranged reload: spends RP by reload speed (Fast 1, Average 2, Slow 3). */
export async function reloadWeapon(actor, item) {
  if (cantAct(actor, "reload")) return;
  await triggerMark(actor, `reloads`);
  const p = item.system.profile;
  if (!p?.ranged || (item.system.rounds ?? 0) >= (item.system.magazine ?? 1)) return ui.notifications.info(`${item.name} is fully loaded.`);
  if (ammoRequired() && !item.system.natural && !ammoCount(actor, item.system.ammoType)) return ui.notifications.warn(`${actor.name} has no ${ammoLabel(item.system.ammoType)} for ${item.name}.`);
  if (!(await spendPoints(actor, "rp", p.reloadRP, `reloading ${item.name}`))) return;
  const n = await loadWeapon(actor, item);
  if (n) ui.notifications.info(`${item.name}: loaded ${n} (${item.system.rounds}/${item.system.magazine}).`);
}

/* ---- Ammunition ---- */

/** World setting: reloading uses Ammunition items (on by default). */
export function ammoRequired() {
  try { return game.settings.get("flowstate", "requireAmmo") !== false; } catch (err) { return true; }
}
export const AMMO_MAX = 100;
export const ammoLabel = type => `${WEAPON_TYPES[type]?.label ?? "matching"} ammunition`;
/** Ammunition items this actor carries for a ranged weapon type. */
export const ammoStacks = (actor, type) => (actor?.items ?? []).filter(i => i.type === "gear" && type && i.system.ammoType === type);
export const ammoCount = (actor, type) => ammoStacks(actor, type).reduce((n, i) => n + (i.system.quantity ?? 0), 0);

/**
 * Reload a ranged weapon up to its magazine (X shots per reload), using only the ammunition of its type needed to fill it
 * (or what's left), so a partly loaded weapon takes less. It can be done any time. Returns the shots loaded (0 = nothing to load).
 */
export async function loadWeapon(actor, item) {
  const w = item.system;
  const need = Math.max(0, (w.magazine ?? 1) - (w.rounds ?? 0));
  if (!need) return 0;
  let take = need;
  if (ammoRequired() && !w.natural) {
    take = Math.min(need, ammoCount(actor, w.ammoType));
    if (!take) { ui.notifications.warn(`${actor.name} has no ${ammoLabel(w.ammoType)} for ${item.name}.`); return 0; }
    let left = take;
    for (const stack of ammoStacks(actor, w.ammoType)) {
      if (!left) break;
      const use = Math.min(left, stack.system.quantity ?? 0);
      if (!use) continue;
      left -= use;
      await stack.update({ "system.quantity": stack.system.quantity - use }, { flowstateSystem: true });
    }
  }
  await item.update({ "system.rounds": (w.rounds ?? 0) + take }, { flowstateSystem: true });
  return take;
}

/* -------------------------------------------- */
/*  Damage, resources, rest                     */
/* -------------------------------------------- */

/**
 * Apply damage to HP. Equipped armor soaks first up to its Limit (× type effectiveness, − Pierce),
 * losing that much Durability. Cold damage removes all Ignite (Ch9).
 */
/**
 * Work out what a hit does without changing anything: parrying weapon soak (Martial Theory T1), then armor soak.
 * Every client has the data, so the rolling client can show the result on its damage card while the owner applies it.
 */
export async function damageOutcome(actor, amount, type, { pierce = 0, parryItem = null, parryItems = null, bash = 0, bypass = false, rend = null,
  cleave = 0, cleaveToCreature = false, shroudCtx = null, halfLimit = false, archetype = "martial", ignoreArmor = false } = {}) {
  if (bypass) {
    const lines = [], tempHp = [];
    const toHp = soakTemp(actor, Math.max(0, amount), lines, tempHp);
    lines.unshift(`<strong>${toHp}</strong> damage to HP (bypasses armor)`);
    return { toHp, lines, weapon: null, weaponLoss: 0, weapons: [], armor: null, armorLoss: 0, afterWeapon: amount, parried: false, shrouds: [], shroudTook: 0, tempHp };
  }
  const lines = [];
  let remaining = Math.max(0, amount);
  // Mental: Enhanced Anchor Weakens all the damage this creature takes while its caster stays put.
  if (remaining > 0 && mentalHook?.anchorWeak?.(actor)) { const was = remaining; remaining = Math.floor(applyStacks(remaining, -1)); lines.push(`Anchor (Enhanced): all damage is Weakened (${was} → ${remaining})`); }
  // Cleave (Equipment): object-only damage that hits first and uses up each object's Limit before the normal damage.
  let cleaveLeft = Math.max(0, cleave);
  // Bash: the first object in the way (a parrying weapon, else armor) with a Limit of at most `bash` is ignored,
  // and its Limit is added as extra damage. Once per attack.
  let bashLeft = bash > 0;
  const tryBash = (obj, profile, durability, objPierce) => {
    if (!bashLeft || !profile?.valid || durability <= 0) return false;
    bashLeft = false;
    const lim = effectiveLimit(profile, type, objPierce);
    if (lim > bash) { lines.push(`Bash: ${obj.name}'s Limit ${lim} is above ${bash}, no effect`); return false; }
    remaining += lim;
    lines.push(`Bash: broke through ${obj.name} (Limit ${lim} ignored, +${lim} damage)`);
    return true;
  };
  /** One object's soak: Cleave takes its Limit first, then the normal damage takes what's left. */
  const soakObject = (obj, objPierce, label) => {
    const profile = obj.system.profile, durability = obj.system.durability.value;
    if (!profile?.valid || durability <= 0) return 0;
    // An object can't absorb more than its remaining Durability (it doesn't go negative unless targeted directly).
    const alter = mentalHook?.alterStacks?.(actor, obj) ?? 0;            // Alter (Creation Tenet): damage to this object is Strengthened or Weakened
    const lossFactor = (profile.selfWeakened ? Math.pow(0.5, profile.selfWeakened) : 1) * (rend ? stackMultiplier(rend.stacks) : 1) * stackMultiplier(alter);
    // Weakpoint (Piercing T5): only half the object's Limit applies to this spell's damage.
    const baseLimit = effectiveLimit(profile, type, objPierce);
    const L = Math.min(halfLimit ? Math.floor(baseLimit / 2) : baseLimit, Math.floor(durability / lossFactor));
    const cAbs = Math.min(cleaveLeft, L);
    const rAbs = Math.min(remaining, L - cAbs);
    cleaveLeft -= cAbs; remaining -= rAbs;
    const absorbed = cAbs + rAbs;
    if (!absorbed) return 0;
    let loss = profile.selfWeakened ? Math.floor(absorbed * Math.pow(0.5, profile.selfWeakened)) : absorbed;
    if (rend) loss = applyStacks(loss, rend.stacks);
    if (alter) loss = applyStacks(loss, alter);
    loss = Math.min(loss, durability);
    lines.push(`${obj.name}${label} absorbed ${rAbs}${cAbs ? ` (+${cAbs} Cleave)` : ""} (−${loss} Durability)`);
    if (durability - loss <= 0) lines.push(`${obj.name} is broken`);
    return loss;
  };
  const shields = [];
  // Reactive (Build Arcana T2): the caster may spend 1 RP to give a damage instance that hits their Spell a stack of Weakened (automatic, unless they turn it off).
  const reactive = [];
  const reactiveFor = casterUuid => {
    const c = casterUuid ? syncUuid(casterUuid) : null;
    if (!c || c.getFlag?.("flowstate", "reactiveOff") || (c.system?.rp?.value ?? 0) - reactive.filter(u => u === c.uuid).length < 1) return null;
    return c;
  };
  const weaken = (c, what) => { remaining = Math.floor(applyStacks(remaining, -1)); reactive.push(c.uuid); lines.push(`Reactive: ${c.name} spends 1 RP, so the damage to ${what} is Weakened`); };
  // Spell Shields are objects too: Limit = their health (a spell with no stated Limit), absorbing up to that and their remaining health,
  // so Pierce, Bash, Cleave, Weakpoint and Melt apply. Dampen makes damage from an Archetype Weakened against them (they lose half the health).
  const absorbWith = pos => {
    const extraShields = (shroudCtx?.extraShields ?? []).map(u => syncUuid(u)).filter(Boolean);
    for (const e of [...spellEffects(actor, "shield"), ...extraShields]) {
      const f = e.flags.flowstate.spellEffect;
      if (((e.parent?.uuid === actor.uuid ? f.order : "default") ?? "default") !== pos || shields.some(x => x.effect === e)) continue;
      const hp = Number(f.hp) || 0;
      if (hp <= 0) continue;
      if (f.types?.length && !f.types.includes(DAMAGE_CATEGORY[type] ?? "physical")) continue;      // Prism: only the chosen damage types
      const damped = (f.dampen ?? []).includes(archetype);
      const anchored = f.anchor && mentalHook?.anchorStill?.(f.caster);              // Anchor: damage to this shielding is Weakened while its caster hasn't moved
      const obj = { name: "Shield", system: { profile: { valid: true, limit: Number(f.max) || hp, focus: { key: "magical", factor: 1 }, selfWeakened: damped || anchored ? 1 : 0 }, durability: { value: hp } } };
      if (tryBash(obj, obj.system.profile, hp, pierce)) { shields.push({ effect: e, hp, absorbed: 0, reflect: !!f.reflect, caster: f.caster }); continue; }
      if (f.reactive) { const rc = reactiveFor(f.caster); if (rc) weaken(rc, "the Shield"); }
      const before = remaining;
      const loss = soakObject(obj, pierce, damped ? " (Dampened)" : anchored ? " (Anchor: Weakened)" : "");
      if (!loss && remaining === before) continue;
      shields.push({ effect: e, hp: hp - loss, absorbed: before - remaining, reflect: !!f.reflect, caster: f.caster });
    }
  };
  // Emplace barriers (Protection Arcana T4) between the attacker and the target are objects: they absorb first, up to their Limit
  // per attack and their remaining health, so Pierce, Bash, Cleave, Weakpoint and Rend all apply to them.
  const barriers = [];
  for (const b of shroudCtx?.barriers ?? []) {
    const obj = { name: "Emplace barrier", system: { profile: { valid: true, limit: b.limit ?? b.hp, focus: { key: "magical", factor: 1 } }, durability: { value: b.hp } } };
    if (tryBash(obj, obj.system.profile, b.hp, pierce)) { barriers.push({ ...b, absorbed: 0 }); continue; }
    if (b.reactive) { const rc = reactiveFor(b.caster); if (rc) weaken(rc, "the barrier"); }
    const before = remaining;
    const loss = soakObject(obj, pierce, "");
    if (!loss && remaining === before) continue;
    barriers.push({ ...b, absorbed: before - remaining, hp: b.hp - loss });
  }
  absorbWith("first");
  // Parrying weapons (Martial Theory T1 Parry, Defender Block) soak first, in order.
  const uuids = [...new Set([...(parryItems ?? []), ...(parryItem ? [parryItem] : [])])];
  const weapons = [];
  for (const u of uuids) {
    const w = await fromUuid(u);
    if (!w?.system?.profile?.valid || w.system.profile.unarmed || w.system.profile.improvised) continue;
    if (tryBash(w, w.system.profile, w.system.durability.value, pierce)) continue;
    const loss = soakObject(w, pierce, " (parry)");
    if (loss) weapons.push({ item: w, loss });
  }
  const afterWeapon = remaining;
  // Spell Shields (Protection Arcana) absorb by their position (Adjust lets the holder move it); Dampen halves the health they lose to an Archetype.
  absorbWith("default");
  // Magic Shrouds soak next (before armor): the creature's own melded Shroud, Wards/Bonds placed on it, Quartz extensions.
  const shrouds = [];
  for (const sh of shroudsFor(actor, shroudCtx?.extra ?? [])) {
    const r = shroudSoak(sh, actor, type, { remaining, cleaveLeft, pierce, rend, source: shroudCtx?.source ?? null, halfLimit });
    remaining = r.remaining; cleaveLeft = r.cleaveLeft;
    lines.push(...r.lines);
    if (r.update) shrouds.push({ item: sh, loss: r.loss, absorbed: r.absorbed, update: r.update });
  }
  absorbWith("afterShroud");
  let armor = ignoreArmor ? null : actor.system.armor;                       // (Venomancy Combos ignore armor, but not Shrouds)
  // Chunky (Titanic Armor T5): Pierce affects worn Titanic armor half as much.
  const armorPierce = armor?.system.weight === "titanic" && ab.titanic(actor, 5) ? Math.floor(pierce / 2) : pierce;
  if (armor && tryBash(armor, armor.system.profile, armor.system.durability.value, armorPierce)) armor = null;
  const armorLoss = armor ? soakObject(armor, armorPierce, "") : 0;
  absorbWith("last");
  let toHp = remaining;
  // Blood and Iron (Striker T5): Striker Cleave that gets past every object hits the creature too.
  if (cleaveToCreature && cleaveLeft > 0) { toHp += cleaveLeft; lines.push(`Cleave: ${cleaveLeft} gets through (Blood and Iron)`); cleaveLeft = 0; }
  else if (cleave > 0 && cleaveLeft === cleave && !weapons.length && !armorLoss && !shrouds.some(x => x.absorbed)) lines.push("Cleave: no object in the way");
  // Rend: Strengthened after the Limits are taken off. Blood and Iron extends it to the creature.
  if (rend?.all && toHp > 0) {
    const before = toHp;
    toHp = applyStacks(toHp, rend.stacks);
    lines.push(`Rend (Blood and Iron): ${before} → ${toHp}`);
  }
  if (rend && (weapons.length || armorLoss)) lines.push("Rend: damage to objects Strengthened");
  const tempHp = [];
  toHp = soakTemp(actor, toHp, lines, tempHp);
  lines.unshift(`<strong>${toHp}</strong> damage to HP`);
  return { toHp, tempHp, lines, weapon: weapons[0]?.item ?? null, weaponLoss: weapons[0]?.loss ?? 0, weapons, armor: armorLoss ? armor : null, armorLoss,
    afterWeapon, parried: uuids.length > 0, shields, barriers, reactive, shrouds, shroudTook: shrouds.reduce((n, x) => n + (x.absorbed ?? 0), 0) };
}

/** "Orc takes 12 Physical" block for a card: the outcome lines as a list. */
export function damageOutcomeHTML(actor, amount, type, outcome) {
  return `<div class="fs-result fs-damage-taken">${esc(actor.name)} takes ${amount} ${DAMAGE_TYPES[type] ?? ""}</div>
    <ul class="fs-list">${outcome.lines.map(l => `<li>${l}</li>`).join("")}</ul>`;
}

/**
 * Apply damage to HP. A parrying weapon soaks first, then equipped armor up to its Limit (× type effectiveness,
 * − Pierce), each losing that much Durability. Cold damage removes all Ignite (Ch9).
 * @param {boolean} silent  don't post a card (the caller already shows the outcome on its own card)
 */
export async function applyDamage(actor, amount, type, { pierce = 0, parryItem = null, parryItems = null, silent = false, bash = 0, bypass = false, rend = null,
  cleave = 0, cleaveToCreature = false, shroudCtx = null, halfLimit = false, maxHpLoss = false, archetype = "martial", brandBy = false, ignoreArmor = false, fromHex = false, mentalDone = false, wardDone = false, wardReflect = null } = {}) {
  if (!actor.isOwner) return ui.notifications.warn(`You don't have permission to modify ${actor.name}.`);
  // Reactive: a Summon or Animation of a caster with the Mod gets a Weakened stack on each instance (1 RP).
  let reduced = 0;                                                            // everything that took damage off before it reached the soak (Reactive, Wonders, Wards)
  const smr = actor.flags?.flowstate?.summon;
  if (smr?.reactive && amount > 0) {
    const c = syncUuid(smr.owner);
    if (c && !c.getFlag?.("flowstate", "reactiveOff") && (c.system?.rp?.value ?? 0) >= 1) {
      const was = amount;
      amount = Math.floor(applyStacks(amount, -1));
      reduced += Math.max(0, was - amount);
      const data = { "system.rp.value": c.system.rp.value - 1 };
      if (c.isOwner) await c.update(data); else await requestGM("updateActor", { uuid: c.uuid, data });
      await post(actor, { title: `${esc(actor.name)} — Reactive`, body: `<div class="fs-result">${esc(c.name)} spends 1 RP: the damage is Weakened (${amount}).</div>` });
    }
  }
  // Mental: Wonder effects on whoever takes damage that didn't come through an attack's damage roll (those were settled there).
  if (mentalHook?.adjust && amount > 0 && !bypass && !mentalDone) {
    const adj = await mentalHook.adjust({ attacker: shroudCtx?.attacker ? syncUuid(shroudCtx.attacker) : null, target: actor, amount, type, o: null });
    if (adj.amount !== amount && adj.html && !silent) await post(actor, { title: `${esc(actor.name)} — Wonders`, body: adj.html });
    reduced += Math.max(0, amount - adj.amount);
    amount = adj.amount;
  }
  // Mental: a Nightmare Ward may spend RP to negate some of it first, and a Premonition charge a lump.
  let neg = null;
  if (mentalHook && amount > 0 && !bypass && !wardDone) {
    const before = amount;
    neg = await mentalHook.negate(actor, amount, type, { source: shroudCtx?.source ?? null, attacker: shroudCtx?.attacker ?? null });
    if (neg.amount !== amount) { if (neg.html && !silent) await post(actor, { title: `${esc(actor.name)} — Ward`, body: neg.html }); amount = neg.amount; }
    reduced += Math.max(0, before - amount);
  }
  const out = await damageOutcome(actor, amount, type, { pierce, parryItem, parryItems, bash, bypass, rend, cleave, cleaveToCreature, shroudCtx, halfLimit, archetype, ignoreArmor });
  // Shrouds (possibly someone else's Ward/Bond/Quartz) lose Durability and record what hit them.
  for (const { item, update } of out.shrouds ?? []) {
    if (item.isOwner === false) await requestGM("updateItem", { uuid: item.uuid, data: update });
    else await item.update(update, { flowstateSystem: true });
    if (item.system.shroudType === "bond" && item.system.durability.max - (update["system.wear"] ?? item.system.wear) <= 0) await endShroudPlacement(item.parent, item);
  }
  // Temp HP loses what it absorbed.
  for (const { effect, left } of out.tempHp ?? []) await changeEffect(effect, left > 0 ? { "flags.flowstate.spellEffect.hp": left, name: `Temp HP (${left})` } : null);
  // Emplace barriers lose the health they absorbed.
  for (const b of out.barriers ?? []) { if (game.user.isGM) await areas.setBarrierHealth(b.sceneId, b.id, b.hp); else await requestGM("barrier", { sceneId: b.sceneId, id: b.id, hp: b.hp }); }
  // Spell Shields lose the health they absorbed (and end when it runs out).
  for (const { effect, hp: hp0 } of out.shields ?? []) {
    let hp = hp0;
    // Taaffeite (Shroud): a Ritual Shield that would be destroyed stays at 1 health if the caster's Shroud gives up all its Durability.
    const sf = effect.flags?.flowstate;
    const tshroud = hp <= 0 && sf?.ritualOf ? syncUuid(sf.spellEffect?.caster)?.system?.shroud : null;
    if (tshroud && hasAffix(tshroud, "taaffeite") && tshroud.system.durability.value > 0) {
      const upd = { "system.wear": tshroud.system.durability.max };
      if (tshroud.isOwner !== false) await tshroud.update(upd, { flowstateSystem: true }); else await requestGM("updateItem", { uuid: tshroud.uuid, data: upd });
      hp = 1;
      await post(actor, { title: `${esc(actor.name)} — Taaffeite`, body: `<div class="fs-result">The Ritual Shield would have been destroyed: ${esc(tshroud.name)} gives up all its Durability to keep it at 1 health.</div>` });
    }
    if (hp <= 0) await changeEffect(effect, null);
    else await changeEffect(effect, { "flags.flowstate.spellEffect.hp": hp, description: `Absorbs the next ${hp} damage.` });
  }
  // Cinder Shroud: damage types taken since the start of your turn.
  if (amount > 0 && actor.setFlag) {
    const taken = actor.getFlag("flowstate", "takenTypes") ?? [];
    if (!taken.includes(type)) await actor.setFlag("flowstate", "takenTypes", [...taken, type]);
  }
  // Parrying weapons may belong to someone else (a Block made for this creature).
  for (const { item, loss } of out.weapons ?? []) {
    if (item.isOwner === false) await requestGM("wearItem", { uuid: item.uuid, amount: loss });
    else await item.update({ "system.wear": item.system.wear + loss }, { flowstateSystem: true });
  }
  // Reactive: the RP the casters spent.
  for (const [u, n] of Object.entries((out.reactive ?? []).reduce((m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {}))) {
    const c = syncUuid(u);
    if (!c) continue;
    const data = { "system.rp.value": Math.max(0, c.system.rp.value - n) };
    if (c.isOwner) await c.update(data); else await requestGM("updateActor", { uuid: c.uuid, data });
  }
  const update = { "system.hp.value": actor.system.hp.value - out.toHp };
  // Chop (Slashing T5): direct damage is Max HP loss instead of lost HP.
  if (maxHpLoss && out.toHp > 0) {
    update["system.hp.value"] = Math.min(actor.system.hp.value, actor.system.hp.max - out.toHp);
    update["system.hp.lost"] = (actor.system.hp.lost ?? 0) + out.toHp;
  }
  if (type === "cold" && actor.system.conditions.ignite > 0) update["system.conditions.ignite"] = 0;
  if (type === "cold" && actor.system.armor?.system.conditions?.ignite > 0 && out.armorLoss) await actor.system.armor.update({ "system.conditions.ignite": 0 }, { flowstateSystem: true });
  await actor.update(update);
  if (mentalHook && out.toHp > 0) await mentalHook.checkExecute(actor);        // Execute (Enhanced): below half the raised Pain Threshold they die
  if (neg?.after) await neg.after();
  else if (wardReflect && mentalHook?.reflect) await mentalHook.reflect(actor, wardReflect);          // a Warden / Riposte the pre-damage Ward earned
  if (flightHook && out.toHp > 0 && actor.isOwner) await flightHook(actor, out.toHp);   // a flyer hit hard enough must stabilize                                            // Warden / Riposte (Enhanced): strike back at the source
  if (out.armor && out.armorLoss) await out.armor.update({ "system.wear": out.armor.system.wear + out.armorLoss }, { flowstateSystem: true });
  if (!silent) await post(actor, { title: `${esc(actor.name)} takes ${amount} ${DAMAGE_TYPES[type] ?? ""}`, body: `<ul class="fs-list">${out.lines.map(l => `<li>${l}</li>`).join("")}</ul>` });
  if (out.shrouds?.length) await refillShroud(actor);                         // out of combat the Shroud recovers right away
  // Brand (Heat T3): heat damage that isn't from the Brand adds the Brand's damage.
  const brand = amount > 0 && elem ? elem.brandExtra(actor, type, brandBy) : 0;
  if (brand) { await post(actor, { title: `${esc(actor.name)} — Brand`, body: `<div class="fs-result">The Brand burns: ${brand} more heat damage.</div>` }); await applyDamage(actor, brand, "heat", { silent: true, brandBy: true }); }
  // Restoration: remember when HP was lost (Restore only heals health lost since the caster's last turn).
  if (out.toHp > 0 && actor.setFlag) await actor.setFlag("flowstate", "lossLog", [...(actor.getFlag("flowstate", "lossLog") ?? []).slice(-24), { at: Date.now(), n: out.toHp }]);
  // Hex (Witchery): damage from a source that isn't a Hex triggers a Harm Hex.
  if (aff && !fromHex && amount > 0 && out.toHp > 0) await aff.hexTrigger(actor, "harm");
  out.reduced = reduced;                                                      // what negated or reduced it first (effects "equal to the damage dealt" shrink by it)
  return out;
}

/**
 * Spend Energy for an ability. Outside combat Energy use is free (and Energy stays full).
 * Returns false if the actor can't afford it in combat.
 */
export async function spendEnergy(actor, cost, what = "that") {
  if (!cost || !inActiveCombat(actor)) return true;
  const have = actor.system.energy.value;
  if (have < cost) {
    ui.notifications.warn(`${actor.name} needs ${cost} Energy for ${what} but has ${have}.`);
    return false;
  }
  await actor.update({ "system.energy.value": have - cost });
  return true;
}

/** Give Energy back (in combat), up to the maximum. */
export async function refundEnergy(actor, amount) {
  if (!amount || !inActiveCombat(actor)) return;
  const e = actor.system.energy;
  await actor.update({ "system.energy.value": Math.min(e.max, e.value + amount) });
}

/** Outside combat, Energy is always full (and an attuned Shroud recovers fully, see `refillShroud`). */
export async function refillEnergy(actor) {
  if (!actor?.isOwner || actor.type === "pile" || inActiveCombat(actor) || actor.getFlag?.("flowstate", "rite")) return;   // a Rite keeps Energy at zero
  const { value, max } = actor.system.energy ?? {};
  if (value !== undefined && value < max) await actor.update({ "system.energy.value": max });
  await refillShroud(actor);
}

/**
 * Outside combat an attuned Shroud recovers fully by itself, unless its passive says it doesn't naturally recover (`noRegen`).
 * In combat it recovers at the start of its wearer's turns (`shroudTurnStart`).
 */
export async function refillShroud(actor) {
  if (!actor || actor.type === "pile" || inActiveCombat(actor)) return;
  const sh = actor.system?.shroud;
  if (!sh || sh.system.profile?.noRegen) return;
  const upd = {};
  if (sh.system.wear > 0) upd["system.wear"] = 0;
  if ((sh.system.negated ?? []).length) upd["system.negated"] = [];          // Agate / Jasper / Obsidian refresh when the Shroud recovers
  if (sh.system.carapace) upd["system.carapace"] = 0;
  if (Object.keys(upd).length) await sh.update(upd, { flowstateSystem: true });
}

/* -------------------------------------------- */
/*  Progression                                 */
/* -------------------------------------------- */

/**
 * GM grants points. Stat points go to the unspent pool. Skill points default to the 3:1 ratio
 * (every 3 stat points granted = 1 skill point, remainders carried), unless given explicitly.
 */
export async function grantPoints(actor, stats = 0, skills = null) {
  const sys = actor.system;
  const update = { "system.unspentStats": sys.unspentStats + Math.max(0, stats) };
  let skillGain = skills;
  if (skillGain === null || skillGain === undefined || skillGain === "") {
    const pool = sys.statCarry + Math.max(0, stats);
    skillGain = Math.floor(pool / 3);
    update["system.statCarry"] = pool % 3;
  }
  skillGain = Number(skillGain) || 0;
  update["system.skillPoints"] = sys.skillPoints + skillGain;
  await actor.update(update, { flowstateSpend: true });
  return { stats: Math.max(0, stats), skills: skillGain };
}

/** Buy the next tier of a skill tree (tier N costs N Skill Points). Outside combat only. */
export async function unlockTier(actor, treeId) {
  const tree = skills.treeById(treeId);
  if (!tree) return;
  const check = skills.nextTier(actor.system.trees, tree, actor.system.skills.unspent, { inCombat: inActiveCombat(actor) });
  if (!check.ok) return ui.notifications.warn(check.reason);
  const tier = tree.tiers.find(t => t.tier === check.next);
  const gains = (tier?.entries ?? []).map(e => e.name).filter(Boolean);
  const left = actor.system.skills.unspent - check.cost;
  const ok = await DialogV2().confirm({
    window: { title: `Are you sure? ${tree.name} Tier ${check.next}` }, rejectClose: false,
    content: `<p>Spend <strong>${check.cost} Skill Point${check.cost === 1 ? "" : "s"}</strong> to unlock <strong>${esc(tree.name)} Tier ${check.next}</strong>?</p>
      ${tier?.summary ? `<p class="hint">${esc(tier.summary)}</p>` : ""}
      ${gains.length ? `<p>Gain: <strong>${gains.map(esc).join(", ")}</strong></p>` : ""}
      <p>Unspent Skill Points: ${actor.system.skills.unspent} → <strong>${left}</strong></p>
      <p class="hint">This can't be undone by a player. Only the GM can remove a tier.</p>`,
    yes: { label: `Unlock (${check.cost} SP)`, icon: "fa-solid fa-lock-open" },
    no: { label: "Cancel", icon: "fa-solid fa-xmark", default: true }
  });
  if (!ok) return;
  await actor.update({ [`system.trees.${treeId}`]: check.next }, { flowstateSpend: true });
  ui.notifications.info(`${actor.name} unlocks ${tree.name} Tier ${check.next}.`);
}

/** GM: remove the top tier of a tree (refunds its Skill Points). */
export async function lowerTier(actor, treeId) {
  if (!game.user.isGM) return;
  const tree = skills.treeById(treeId);
  const current = skills.tierOf(actor.system.trees, treeId);
  if (!tree || current < 1) return;
  const next = current - 1;
  const update = { [`system.trees.${treeId}`]: next };
  // Lowering a Theory can lock trees that need a higher Theory tier: confirm, then those trees lose all their tiers.
  if (tree.theory) {
    const state = { ...actor.system.trees, [treeId]: next };
    const locked = skills.treesFor(tree.archetype).filter(t => !t.theory && skills.tierOf(state, t.id) > 0 && !skills.isAvailable(state, t));
    if (locked.length) {
      const refund = locked.reduce((n, t) => { const k = skills.tierOf(state, t.id); return n + (k * (k + 1)) / 2; }, 0);
      const ok = await DialogV2().confirm({ window: { title: `Lower ${tree.name}?` }, rejectClose: false,
        content: `<p>Lowering <strong>${esc(tree.name)}</strong> to Tier ${next} locks these trees, and ${esc(actor.name)} loses every tier in them:</p>
          <ul>${locked.map(t => `<li>${esc(t.name)} (Tier ${skills.tierOf(state, t.id)}, needs ${esc(tree.name)} Tier ${t.requires})</li>`).join("")}</ul>
          <p>Their ${refund} Skill Point${refund === 1 ? "" : "s"} go back to the unspent pool.</p>` });
      if (!ok) return;
      for (const t of locked) update[`system.trees.${t.id}`] = 0;
    }
  }
  await actor.update(update);
}

/** Player spends one unspent stat point on a stat. Outside combat only. */
export async function spendStatPoint(actor, key) {
  if (inActiveCombat(actor)) return ui.notifications.warn("Stat points can only be spent outside combat.");
  if (actor.system.unspentStats < 1) return ui.notifications.warn(`${actor.name} has no stat points to spend.`);
  await actor.update({
    [`system.stats.${key}`]: actor.system.stats[key] + 1,
    "system.unspentStats": actor.system.unspentStats - 1
  }, { flowstateSpend: true });
}

/**
 * Ch9 Crouch/Prone. Crouching (free) can be done any time on your turn. Going prone costs 1 AP; standing up from prone
 * costs 1 AP (from a crouch it's free). Outside combat there are no costs or turn limits.
 */
export async function setPosture(actor, posture) {
  if (cantAct(actor, "change posture")) return;
  const inCombat = inActiveCombat(actor);
  if (inCombat && game.combat.combatant?.actor?.uuid !== actor.uuid) return ui.notifications.warn(`${actor.name} can only change posture on their own turn.`);
  if (posture !== "prone" && actor.getFlag?.("flowstate", "lockedDown")) return ui.notifications.warn(`${actor.name} is Locked Down and stays prone.`);
  await triggerMark(actor, "changes posture");
  const prone = actor.statuses.has("prone"), crouch = actor.statuses.has("crouch");
  if (posture === "crouch") {
    if (crouch) return;
    if (prone) return ui.notifications.warn(`${actor.name} is prone. Get up first.`);
    await actor.toggleStatusEffect("crouch", { active: true });
  } else if (posture === "prone") {
    if (prone) return;
    if (!(await spendAP(actor, 1, "going prone"))) return;
    if (crouch) await actor.toggleStatusEffect("crouch", { active: false });
    await actor.toggleStatusEffect("prone", { active: true });
  } else if (posture === "stand") {
    if (!prone && !crouch) return;
    if (prone && !(await spendAP(actor, 1, "standing up"))) return;
    if (prone) await actor.toggleStatusEffect("prone", { active: false });
    if (crouch) await actor.toggleStatusEffect("crouch", { active: false });
  }
}

/** Ch8 Energy: spend 1 AP to recover 1/10 max. Fear blocks all Energy gain (Ch9). */
/**
 * Freeze (Cold T4): the next time a creature would restore Energy, it restores less and takes that much cold damage.
 * Returns the Energy actually restored.
 */
export async function energyRestoreAdjust(actor, restore) {
  let left = restore;
  for (const e of spellEffects(actor, "freeze")) {
    const cut = Math.min(left, Number(e.flags.flowstate.spellEffect.amount) || 0);
    await changeEffect(e, null);
    if (cut > 0) {
      left -= cut;
      await post(actor, { title: `${esc(actor.name)} — Freeze`, body: `<div class="fs-result">Freeze: restores ${cut} less Energy and takes ${cut} cold damage.</div>` });
      await requestDamage(actor, cut, "cold", 0, null, { silent: true });
    }
    break;                                           // "the next time": one Freeze per restore
  }
  return left;
}

export async function recoverEnergy(actor) {
  if (cantAct(actor, "recover Energy")) return;
  await triggerMark(actor, `recovers Energy`);
  if (!inActiveCombat(actor)) return ui.notifications.info("Outside combat, Energy is always full.");
  if (actor.statuses.has("fear")) return ui.notifications.warn(`${actor.name} is afraid and can't gain Energy.`);
  const { value, max } = actor.system.energy;
  if (value >= max) return ui.notifications.info(`${actor.name} is already at full Energy.`);
  if (!(await spendAP(actor, 1, "recovering Energy"))) return;
  let gain = await energyRestoreAdjust(actor, Math.min(actor.system.derived.energyRecover, max - value));
  // Seep (Build Arcana T3): forgo half of the Energy to make your Shroud recover once.
  let seep = "";
  const sh = actor.system.shroud;
  if (ab.treeTier(actor, "magic-build-arcana") >= 3 && sh?.system?.wear > 0 && gain > 1) {
    const forgo = Math.floor(gain / 2);
    const yes = await DialogV2().confirm({ window: { title: "Seep" }, rejectClose: false, content: `<p>Forgo <strong>${forgo}</strong> of the ${gain} Energy to make ${esc(sh.name)} recover once?</p>` });
    if (yes) {
      const P = sh.system.profile;
      const recover = P.fixedDur ? sh.system.wear : Math.min(sh.system.wear, sh.system.shroudType === "cistern" || sh.system.shroudType === "ember" ? P.limit : P.baseLimit);
      if (recover > 0) { await sh.update({ "system.wear": sh.system.wear - recover }, { flowstateSystem: true }); gain -= forgo; seep = ` · Seep: ${esc(sh.name)} recovers ${recover} Durability (−${forgo} Energy)`; }
    }
  }
  await actor.update({ "system.energy.value": value + gain });
  await post(actor, { title: "Recover Energy", body: `<div class="fs-result">+${gain} Energy (${value + gain}/${max})${seep}</div>` });
}

/** Ch8 8-hour rest: regain Con+Will+Build minimums; clears days without rest. Max HP lost is not healed. */
export async function rest(actor) {
  const { value, max } = actor.system.hp;
  const heal = actor.system.derived.restHeal;
  const next = Math.min(max, value + heal);
  const days = actor.system.daysWithoutRest ?? 0;
  const ok = await DialogV2().confirm({
    window: { title: `8 Hour Rest — ${actor.name}` }, rejectClose: false,
    content: `<div class="flowstate-dialog"><p>${esc(actor.name)} rests for 8 hours:</p>
      <ul class="fs-list">
        <li>Heals ${heal} HP (CON + WILL + BUILD mins): ${value} → <strong>${next}</strong> / ${max}${next - value < heal ? ` (capped at max)` : ""}</li>
        <li>Days without rest reset to 0${days ? ` (now ${days}${actor.system.exhausted ? ", which ends the Disadvantage on all rolls" : ""})` : ""}</li>
      </ul>${inActiveCombat(actor) ? `<p class="fs-warn">${esc(actor.name)} is in an active combat.</p>` : ""}</div>`
  });
  if (!ok) return;
  await actor.update({ "system.hp.value": next, "system.daysWithoutRest": 0 });
  await post(actor, { title: "8 Hour Rest", body: `<div class="fs-result">+${next - value} HP (${next}/${max})</div>` });
  await mentalHook?.rest(actor);                     // Preordained (Mental, Order T4) rolls its number after a rest
}

/** Ch9 Ignite: put out (2 AP, anyone in melee). Stain: clean (3 AP). */
export async function clearCondition(actor, key) {
  const cost = key === "ignite" ? 2 : STAIN_VARIANTS[key]?.ap;
  if (cost === null || cost === undefined) return ui.notifications.warn(`${STAIN_VARIANTS[key]?.label ?? key} can't be removed.`);
  const armor = actor.system.armor;
  if (!actor.system.conditions[key] && !armor?.system.conditions?.[key]) return;
  if (!(await spendAP(actor, cost, key === "ignite" ? "putting out Ignite" : `removing ${STAIN_VARIANTS[key].label}`))) return;
  if (key === "ignite") await actor.setFlag("flowstate", "ignitePutOut", true);        // Ignite Spread (optional): it doesn't grow while you're putting it out
  if (actor.system.conditions[key]) await actor.update({ [`system.conditions.${key}`]: 0 });
  if (armor?.system.conditions?.[key]) await armor.update({ [`system.conditions.${key}`]: 0 }, { flowstateSystem: true });
}

/**
 * Put Ignite/Stain stacks on a creature or its armor. "Whatever is damaged": the creature if the damage reached HP,
 * else the armor that absorbed it. With no damage (`first`), the armor is hit first if it's worn. Returns a chat line.
 */
export async function giveStacks(target, kind, amount, { outcome = null, first = false, caster = null } = {}) {
  amount = Math.floor(amount);
  if (amount <= 0) return "";
  if (mentalHook?.blocked?.(target, kind)) return `${esc(target.name)} has been cleansed: ${esc(kind)} can't be applied to them right now.`;
  const armor = target.system?.armor;
  const armorOk = armor && armor.system.profile?.valid && !armor.system.broken;
  const onArmor = armorOk && (first || (outcome && !(outcome.toHp > 0) && outcome.armorLoss > 0));
  const holder = onArmor ? armor : target;
  const up = addStacks(holder.system.conditions ?? {}, kind, amount);
  const data = Object.fromEntries(Object.entries(up).map(([k, v]) => [`system.conditions.${k}`, v]));
  if (onArmor) { if (armor.isOwner !== false) await armor.update(data, { flowstateSystem: true }); else await requestGM("updateItem", { uuid: armor.uuid, data }); }
  else if (target.isOwner) await target.update(data); else await requestGM("updateActor", { uuid: target.uuid, data });
  if (kind === "electric" && caster) await setActorFlag(target, "electricBy", caster.uuid);
  const label = kind === "ignite" ? "Ignite" : STAIN_VARIANTS[kind]?.label ?? kind;
  return `${esc(target.name)}${onArmor ? `'s ${esc(armor.name)}` : ""} gets <strong>${amount} ${label}</strong>${amount === 1 ? "" : " stacks"}.`;
}

/**
 * Ask which creature on the scene to pick next (a chain, a transfer, a second target): within `within` ft of every anchor token,
 * not in `exclude`. `preset` (an actor uuid) skips the popup. Returns an actor or null (also when there's no scene).
 */
export async function pickSceneTarget(actor, { title = "Pick a target", within = Infinity, anchors = [], exclude = [], preset = null } = {}) {
  const seen = new Set(), cands = [];
  for (const t of globalThis.canvas?.tokens?.placeables ?? []) {
    const a = t.actor;
    if (!a || a.type === "pile" || seen.has(a.uuid) || exclude.includes(a.uuid) || helpless(a)) continue;
    if (!anchors.filter(Boolean).every(an => tokenDistance(an, t) <= within)) continue;
    seen.add(a.uuid); cands.push(a);
  }
  if (preset) return cands.find(a => a.uuid === preset) ?? null;
  if (!cands.length) { ui.notifications.info("There's nobody in range to pick."); return null; }
  const out = await DialogV2().prompt({ window: { title }, content: `<div class="form-group"><label>Who</label><select name="who">${cands.map(a => `<option value="${a.uuid}">${esc(a.name)}</option>`).join("")}</select></div>`,
    ok: { label: "Pick", callback: (event, button) => button.form.elements.who.value }, rejectClose: false });
  return cands.find(a => a.uuid === out) ?? null;
}

/** Electric Stains (Radiation + Acid): the caster makes an attack roll at another target; on a hit the stacks move there. */
export async function electricTransfer(message, preset = null) {
  const e = message.getFlag("flowstate", "electric");
  if (!e?.by) return;
  const key = `${message.id}:electric`;
  if (game.messages.find(m => m.getFlag("flowstate", "attack")?.opts?.shroudCounterOf === key)) return ui.notifications.info("Already tried.");
  const caster = await fromUuid(e.by), holder = await fromUuid(e.from);
  if (!caster?.isOwner) return ui.notifications.warn("Only the caster can pass them on.");
  const picked = await pickSceneTarget(caster, { title: "Electric Stains: pass them to", within: 100, anchors: [attackerToken(caster), holder?.getActiveTokens?.()[0]], exclude: [e.from, caster.uuid], preset });
  if (!picked) return;
  return performAttack(caster, { label: "Electric Stains", net: 0, melee: false, push: false, damage: "", type: "radiation", stacks: 0, physical: false, shots: 1,
    notes: [`${e.amount} Electric Stains look for a new home`], followups: [], targetActors: [picked], shroudCounterOf: key, inflict: { electric: e.amount } });
}

/** Ch8/Ch9 end-of-turn processing: AP expires, Ignite/Stain damage, Slow/Haste decay. */
/** The optional Ignite Spread rule (a world setting): Ignite grows 10% each turn up to the Pain Threshold; at it, it spreads twice to surrounding tiles. */
const igniteSpreadOn = () => { try { return game.settings.get("flowstate", "igniteSpread") === true; } catch (err) { return false; } };
export async function igniteSpread(actor, ignite) {
  if (!igniteSpreadOn() || !(ignite > 0) || actor.type === "pile") return;
  if (actor.getFlag?.("flowstate", "ignitePutOut")) { await actor.unsetFlag("flowstate", "ignitePutOut"); return; }
  const limit = actor.system.hp?.pain ?? Infinity;
  if (ignite < limit) {
    const up = Math.min(limit, ignite + Math.floor(ignite * 0.1));
    if (up > ignite) { await actor.update({ "system.conditions.ignite": up }); await post(actor, { title: `${esc(actor.name)} — Ignite spreads`, body: `<div class="fs-notes">Ignite Spread: ${ignite} → <strong>${up}</strong> (+10%${up >= limit ? ", at their Pain Threshold" : ""}).</div>` }); }
    return;
  }
  const DIRS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  const r1 = await evaluate("1d8"), r2 = await evaluate("1d8");
  const each = Math.floor(ignite * 0.1);
  await post(actor, { title: `${esc(actor.name)} — Ignite spreads`, rolls: [r1, r2],
    body: `<div class="fs-result"><i class="fa-solid fa-fire"></i> ${esc(actor.name)}'s Ignite (${ignite}) is at its limit: it spreads twice to surrounding tiles, <strong>${DIRS[r1.total - 1] ?? r1.total}</strong> and <strong>${DIRS[r2.total - 1] ?? r2.total}</strong>. Each tile gets <strong>${each} Ignite</strong> (10%); anything standing there is lit, an already burning tile adds it.</div>` });
}

export async function endOfTurn(actor) {
  // Fear from an Illusion Combo's creation ends when the afraid creature's turn ends.
  for (const e of spellEffects(actor, "fearTimed")) { await changeEffect(e, null); if (actor.statuses?.has("fear")) await setStatus(actor, "fear", false); }
  const sys = actor.system;
  const { slow, haste } = sys.conditions;
  const decay = Math.floor(sys.hp.pain / 2);
  const update = { "system.ap.value": 0 };
  const lines = [];

  // Ignite (Heat), Stain (Acid), Searing (both), Frozen (Acid, and drains Energy) and Electric (Radiation) Stains don't ignore armor:
  // equipped armor soaks each tick. Armor's own stacks wear it down directly.
  const armor = sys.armor;
  const t = tickAmounts(sys.conditions);
  let hpLoss = 0, wear = 0;
  for (const [amount, type, label] of [[t.heat, "heat", "Ignite"], [t.acid, "acid", "Stain"], [t.radiation, "radiation", "Electric Stain"]]) {
    if (!amount) continue;
    const s = soak(amount, type, armor?.system.profile, { durability: (armor?.system.durability.value ?? 0) - wear });
    hpLoss += s.toHp; wear += s.durabilityLoss;
    lines.push(`${amount} ${DAMAGE_TYPES[type]} from ${label}${s.absorbed ? ` (${armor.name} absorbed ${s.absorbed})` : ""}`);
  }
  if (t.energy) { update["system.energy.value"] = Math.max(0, sys.energy.value - t.energy); lines.push(`Frozen Stains drain ${t.energy} Energy`); }
  if (hpLoss) update["system.hp.value"] = sys.hp.value - hpLoss;
  if (armor) {
    const at = tickAmounts(armor.system.conditions);
    const own = at.heat + at.acid + at.radiation;
    if (own) { wear += own; lines.push(`${armor.name} takes ${own} from its own Ignite/Stain`); }
  }
  if (armor && wear) await armor.update({ "system.wear": armor.system.wear + wear }, { flowstateSystem: true });
  // Brand (Heat T3): Ignite's heat damage triggers it too.
  const brandTick = t.heat > 0 && elem ? elem.brandExtra(actor, "heat", false) : 0;
  if (brandTick) { hpLoss += brandTick; update["system.hp.value"] = sys.hp.value - hpLoss; lines.push(`Brand: ${brandTick} more heat damage`); }

  if (slow) { update["system.conditions.slow"] = Math.max(0, slow - decay); lines.push(`Slow ${slow} → ${update["system.conditions.slow"]}`); }
  if (haste) { update["system.conditions.haste"] = Math.max(0, haste - decay); lines.push(`Haste ${haste} → ${update["system.conditions.haste"]}`); }
  // Electric Stains trigger no matter what, then the caster may try to pass them on (or they go away).
  const electric = sys.conditions.electric;
  if (electric) update["system.conditions.electric"] = 0;

  await actor.update(update);
  await igniteSpread(actor, sys.conditions.ignite);
  if (lines.length) {
    await post(actor, { title: "End of Turn", body: `<ul class="fs-list">${lines.map(l => `<li>${l}</li>`).join("")}</ul>` });
  }
  if (electric) {
    const by = actor.getFlag?.("flowstate", "electricBy");
    await post(actor, { title: `${esc(actor.name)} — Electric Stains`, body: `<div class="fs-result">The ${electric} Electric Stains on ${esc(actor.name)} went off.</div>
      ${by ? `<div class="fs-brawl-row fs-electric-row" data-role="defender" data-owner="${by}"><button type="button" class="fs-electric-transfer" data-from="${actor.uuid}" data-amount="${electric}" data-tooltip="Attack roll against another target within 100 ft of ${esc(actor.name)} and of you; on a hit the Electric Stains move to them, otherwise they go away"><i class="fa-solid fa-bolt"></i> Pass them on (${electric})</button></div>` : "<div class=\"fs-notes\">Nobody to pass them on: they go away.</div>"}`,
      flags: { flowstate: { electric: { from: actor.uuid, amount: electric, by: by ?? null } } } });
  }
}

/* -------------------------------------------- */
/*  Magic Shrouds                               */
/* -------------------------------------------- */

/** Damage source type for Diamond / Colored Diamond: the weapon type, else the damage type. */
export function sourceOf(o) {
  if (o?.attackType && WEAPON_TYPES[o.attackType]) return `weapon:${o.attackType}`;
  const item = o?.itemUuid ? syncUuid(o.itemUuid) : null;
  if (item?.type === "weapon") return `weapon:${item.system.weaponType}`;
  return o?.type ? `type:${o.type}` : null;
}

/** Shrouds protecting this creature: its own melded one (a Ward only protects where it's placed), Wards/Bonds placed on it, Quartz extensions. */
export function shroudsFor(actor, extra = []) {
  const out = [];
  const own = actor?.system?.shroud;
  if (own && own.system.shroudType !== "ward") out.push(own);
  const placed = actor?.getFlag?.("flowstate", "shroudOn");
  for (const u of [placed, ...extra].filter(Boolean)) {
    const sh = syncUuid(u);
    if (!sh?.system?.attuned || !sh.system.profile?.valid || out.includes(sh)) continue;
    if (u === placed && sh.system.placedOn !== actor.uuid) continue;
    out.push(sh);
  }
  return out;
}

const hasAffix = (sh, k) => !!sh?.system?.profile?.affixes?.includes(k);

/**
 * One Shroud's soak (no changes made; returns the update to apply).
 * Order: Agate/Jasper/Obsidian negation → Diamond/Alexandrite/Colored Diamond Weakened → Limit (Cleave first, then damage).
 */
export function shroudSoak(sh, actor, type, { remaining, cleaveLeft, pierce = 0, rend = null, source = null, halfLimit = false }) {
  const P = sh.system.profile;
  const lines = [];
  const update = {};
  const m = P.affixMult;
  const cat = DAMAGE_CATEGORY[type] ?? "physical";
  const own = sh.parent?.uuid === actor.uuid;
  // Agate (Magical) / Jasper (Physical) / Obsidian (Elemental): the first instance since the Shroud last recovered.
  const negKey = { magical: "agate", physical: "jasper", elemental: "obsidian" }[cat];
  if (own && negKey && hasAffix(sh, negKey) && !(sh.system.negated ?? []).includes(cat) && remaining > 0) {
    const cut = Math.min(remaining, P.scaling * m);
    remaining -= cut;
    lines.push(`${sh.name} (${AFFIXES[negKey].label}): −${cut} ${cat} damage`);
    update["system.negated"] = [...(sh.system.negated ?? []), cat];
  }
  const done = () => ({ remaining, cleaveLeft, lines, loss: 0, absorbed: 0, update: Object.keys(update).length ? update : null });
  if (!shroudBlocks(type) || sh.system.durability.value <= 0 || remaining + cleaveLeft <= 0) {
    if (shroudBlocks(type) && sh.system.durability.value <= 0 && remaining > 0) lines.push(`${sh.name} has no Durability left`);
    return done();
  }
  const key = turnKey();
  // Damage that would hit the Shroud: Weakened by Diamond (same source this turn), Alexandrite (same type as last), Colored Diamond (declared source).
  let weak = 0;
  const why = [];
  if (hasAffix(sh, "diamond") && source && (sh.system.hitSources ?? []).includes(`${key}|${source}`)) { weak += m; why.push("Diamond"); }
  if (hasAffix(sh, "alexandrite") && sh.system.lastType && sh.system.lastType === type) { weak += m; why.push("Alexandrite"); }
  if (hasAffix(sh, "coloredDiamond") && source && sh.system.declared === source) { weak += m; why.push("Colored Diamond"); }
  if (weak && remaining > 0) {
    const before = remaining;
    remaining = applyStacks(remaining, -weak);
    lines.push(`${why.join(", ")}: Weakened ${before} → ${remaining}`);
  }
  // Limit: Cinder triples against types already taken this turn; Painite can't be ignored (no Pierce).
  let L = P.limit;
  if (sh.system.shroudType === "cinder" && (sh.parent?.getFlag?.("flowstate", "takenTypes") ?? []).includes(type)) L = P.baseLimit * 3;
  // Emerald: doubled in a Lush biome, halved anywhere else.
  if (hasAffix(sh, "emerald")) L = sh.system.lush || sceneLush() ? L * 2 : Math.floor(L / 2);
  if (!hasAffix(sh, "painite")) L = Math.max(0, L - Math.max(0, pierce));
  if (halfLimit) L = Math.floor(L / 2);
  // It can't absorb more than its remaining Durability (Tourmaline / Rend change how fast that runs out).
  const durLeft = sh.system.durability.value;
  if (!P.negator) {
    const f = (hasAffix(sh, "tourmaline") && sh.system.element === type ? stackMultiplier(-m) : 1) * (rend ? stackMultiplier(rend.stacks) : 1);
    L = Math.min(L, Math.floor(durLeft / f));
  }
  let loss = 0, rAbs = 0, cAbs = 0;
  if (P.negator) {
    // Aegis / Lattice: damage up to the Limit is negated for 1 Durability; more than that isn't blocked at all.
    if (remaining > 0 && remaining <= L) { rAbs = remaining; remaining = 0; loss = 1; lines.push(`${sh.name} (Shroud) negated ${rAbs} (−1 Durability)`); }
    else if (remaining > 0) lines.push(`${sh.name}: ${remaining} is over its Limit ${L}, so it isn't blocked`);
  } else {
    cAbs = Math.min(cleaveLeft, L);
    rAbs = Math.min(remaining, L - cAbs);
    cleaveLeft -= cAbs; remaining -= rAbs;
    loss = cAbs + rAbs;
    // Tourmaline: damage of the chosen element taken by the Shroud is Weakened.
    if (loss && hasAffix(sh, "tourmaline") && sh.system.element === type) loss = applyStacks(loss, -m);
    if (loss && rend) loss = applyStacks(loss, rend.stacks);
    loss = Math.min(loss, durLeft);
    if (rAbs || cAbs) lines.push(`${sh.name} (Shroud) absorbed ${rAbs}${cAbs ? ` (+${cAbs} Cleave)` : ""} (−${loss} Durability)`);
  }
  const absorbed = rAbs + cAbs;
  if (absorbed > 0) {
    update["system.wear"] = sh.system.wear + loss;
    if (sh.system.shroudType === "carapace") update["system.carapace"] = (sh.system.carapace ?? 0) + 1;
    if (hasAffix(sh, "alexandrite")) update["system.lastType"] = type;
    if (hasAffix(sh, "diamond") && source && key) update["system.hitSources"] = [...(sh.system.hitSources ?? []).filter(h => h.startsWith(`${key}|`) && h !== `${key}|${source}`), `${key}|${source}`];
    if (sh.system.durability.value - loss <= 0) lines.push(`${sh.name} is spent (0 Durability)`);
  }
  return { remaining, cleaveLeft, lines, loss, absorbed, update: Object.keys(update).length ? update : null };
}

/** Is the current scene a Lush biome? (A scene setting; Emerald also has its own checkbox on the item.) */
export const sceneLush = () => !!globalThis.canvas?.scene?.getFlag?.("flowstate", "lush");

/** Musgravite (Shroud): Force against you is reduced by your Scaling Stat. */
export function musgraviteNegate(actor) {
  const sh = actor?.system?.shroud;
  return hasAffix(sh, "musgravite") ? sh.system.profile.scaling * sh.system.profile.affixMult : 0;
}

/** Within this creature's personal melee range? (Unknown positions count as yes.) */
export function inPersonalMelee(actor, other) {
  const a = attackerToken(actor), b = attackerToken(other);
  if (!a || !b || !globalThis.canvas?.grid) return true;
  return tokenDistance(a, b) <= (actor.system.derived?.size?.melee ?? 5);
}

/** Attack-roll Disadvantage from the target's Shroud: Black Opal (attacker in its melee range), Colored Diamond (declared source). */
export function shroudAttackNet(attacker, target, opts) {
  // Zircon (Foci): attacks that target the Foci directly have Disadvantage.
  const aimed = opts?.aimItem ? syncUuid(opts.aimItem) : null;
  const fociNet = aimed?.type === "foci" ? -(aimed.system.profile?.selfWeakened ?? 0) : 0;
  const sh = target?.system?.shroud;
  if (!sh) return fociNet;
  const m = sh.system.profile.affixMult;
  let net = 0;
  if (hasAffix(sh, "blackOpal") && inPersonalMelee(target, attacker)) net -= m;
  if (hasAffix(sh, "coloredDiamond") && sh.system.declared && sh.system.declared === sourceOf(opts)) net -= m;
  return net + fociNet;
}

/** Ward / Bond: place the melded Shroud on a target (Ward: 2 RP, Bond: 3 RP). Restores its Durability. */
export async function placeShroud(actor) {
  if (cantAct(actor, "place a Shroud")) return;
  const sh = actor.system.shroud;
  const kind = sh?.system.profile?.placed;
  if (!kind) return ui.notifications.warn(`${actor.name} needs a melded Ward or Bond Shroud.`);
  const picks = [...(game.user.targets ?? [])].map(t => t.actor).filter(a => a && a.type !== "pile");
  const target = kind === "ward" ? (picks[0] ?? actor) : picks.find(a => a.uuid !== actor.uuid);
  if (!target) return ui.notifications.warn(kind === "ward" ? "Target a creature (or none, for yourself)." : "Target the creature to Bond with.");
  if (picks.length > 1) return ui.notifications.warn("Target just one creature.");
  const tTok = target.getActiveTokens?.()[0], aTok = attackerToken(actor);
  if (target !== actor && tTok && aTok && globalThis.canvas?.grid && tokenDistance(aTok, tTok) > 100) return ui.notifications.warn(`${target.name} is more than 100 ft away.`);
  const rp = kind === "ward" ? 2 : 3;
  if (!(await spendPoints(actor, "rp", rp, kind === "ward" ? "Ward" : "Bond"))) return;
  await endShroudPlacement(actor, sh);
  await sh.update({ "system.placedOn": target.uuid, "system.wear": 0 }, { flowstateSystem: true });
  await setActorFlag(target, "shroudOn", sh.uuid);
  await post(actor, { title: `${esc(actor.name)} — ${kind === "ward" ? "Ward" : "Bond"}`,
    body: `<div class="fs-result">${esc(sh.name)} ${kind === "ward" ? `is placed on ${esc(target.name)} until the start of ${esc(actor.name)}'s next turn` : `now also protects ${esc(target.name)} (ends at 0 Durability or beyond 1000 ft)`}. Durability restored to full.</div><div class="fs-notes">${rp} RP</div>` });
}

/** End a Ward/Bond placement (unattuning, re-placing, Ward expiring, Bond spent). */
export async function endShroudPlacement(actor, sh) {
  const on = sh?.system?.placedOn;
  if (!on) return;
  const target = syncUuid(on) ?? await fromUuid(on);
  if (target?.getFlag?.("flowstate", "shroudOn") === sh.uuid) await setActorFlag(target, "shroudOn", null);
  if (sh.isOwner !== false) await sh.update({ "system.placedOn": "" }, { flowstateSystem: true });
  else await requestGM("updateItem", { uuid: sh.uuid, data: { "system.placedOn": "" } });
}

/** Hematite (Shroud): spend HP equal to half your Skill Points (rounded down) to refill the Shroud's Durability. */
export async function hematiteRefill(actor) {
  const sh = actor.system.shroud;
  if (!hasAffix(sh, "hematite")) return ui.notifications.warn(`${actor.name}'s melded Shroud has no Hematite.`);
  if (!sh.system.wear) return ui.notifications.info(`${sh.name} is already full.`);
  const cost = Math.floor(actor.system.skillPoints / 2);
  await actor.update({ "system.hp.value": actor.system.hp.value - cost });
  await sh.update({ "system.wear": 0 }, { flowstateSystem: true });
  await post(actor, { title: `${esc(actor.name)} — Hematite`, body: `<div class="fs-result">${esc(sh.name)} is refilled to ${sh.system.durability.max} Durability for ${cost} HP.</div>` });
}

/**
 * Start of the wearer's turn: Carapace resets, then the Shroud recovers (Aegis/Lattice fully), affix negations refresh,
 * Garnet/Topaz shed Ignite/Slow, a Ward placed last turn ends, and Cinder forgets the damage types taken.
 */
export async function shroudTurnStart(actor) {
  if (actor.getFlag?.("flowstate", "takenTypes")?.length) await actor.unsetFlag("flowstate", "takenTypes");
  const sh = actor.system?.shroud;
  if (!sh) return;
  const notes = [];
  if (sh.system.shroudType === "ward" && sh.system.placedOn) { await endShroudPlacement(actor, sh); notes.push("the Ward ends"); }
  const update = {};
  if (sh.system.shroudType === "carapace" && sh.system.carapace) update["system.carapace"] = 0;
  // Recovery uses the Limit after Carapace resets (Cistern/Ember use their current Limit).
  const P = sh.system.profile;
  const recover = P.fixedDur ? sh.system.wear : Math.min(sh.system.wear, sh.system.shroudType === "cistern" || sh.system.shroudType === "ember" ? P.limit : P.baseLimit);
  if (recover > 0) { update["system.wear"] = sh.system.wear - recover; notes.push(`recovers ${recover} Durability`); }
  if ((sh.system.negated ?? []).length) update["system.negated"] = [];
  if (Object.keys(update).length) await sh.update(update, { flowstateSystem: true });
  const minB = Math.floor(P.scaling / 3) * P.affixMult;
  const cond = actor.system.conditions ?? {};
  const cu = {};
  if (hasAffix(sh, "garnet") && cond.ignite > 0) { cu["system.conditions.ignite"] = Math.max(0, cond.ignite - minB); notes.push(`Garnet puts out ${Math.min(cond.ignite, minB)} Ignite`); }
  if (hasAffix(sh, "topaz") && cond.slow > 0) { cu["system.conditions.slow"] = Math.max(0, cond.slow - minB); notes.push(`Topaz removes ${Math.min(cond.slow, minB)} Slow`); }
  if (Object.keys(cu).length) await actor.update(cu);
  if (hasAffix(sh, "coloredDiamond")) notes.push(`Colored Diamond: declare a source type on ${esc(sh.name)} (now: ${sh.system.declared ? esc(sh.system.declared.split(":")[1]) : "none"})`);
  if (notes.length) await post(actor, { title: `${esc(actor.name)} — ${esc(sh.name)}`, body: `<div class="fs-notes">${notes.join(" · ")}</div>` });
}

/* ---- Shroud reactions: Quartz (extend to an ally), Retort, Riposte / Ruby / Sapphire ---- */

/** Creatures that could extend a Quartz Shroud over this target (the target is within their personal melee range). */
export function quartzGuards(attacker, target) {
  const out = [];
  const tTok = target.getActiveTokens?.()[0];
  for (const tok of globalThis.canvas?.tokens?.placeables ?? []) {
    const a = tok.actor;
    if (!a || a.type === "pile" || a.uuid === target.uuid || a.uuid === attacker?.uuid || helpless(a) || out.some(x => x.uuid === a.uuid)) continue;
    const sh = a.system?.shroud;
    if (!hasAffix(sh, "quartz") || sh.system.durability.value <= 0) continue;
    if (tTok && tokenDistance(tok, tTok) <= (a.system.derived?.size?.melee ?? 5)) out.push(a);
  }
  return out;
}

/** Quartz: extend your Shroud over an ally for this attack. */
export async function quartzFor(message, index, ownerUuid) {
  const entry = message.getFlag("flowstate", "attack")?.targets?.[index];
  if (!entry) return;
  if (findCancel(message.id)) return ui.notifications.info("That spell was countered before it landed.");
if (findDefense(message.id, index)) return ui.notifications.info(`${entry.name} has already responded.`);
  const owner = await fromUuid(ownerUuid);
  if (!owner?.isOwner) return ui.notifications.warn(`Only ${owner?.name ?? "its owner"}'s owner can extend that Shroud.`);
  const sh = owner.system.shroud;
  if (!hasAffix(sh, "quartz")) return;
  if (findQuartz(message.id, index).includes(sh.uuid)) return;
  await post(owner, { title: `${esc(owner.name)} — Quartz`, body: `<div class="fs-result">${esc(sh.name)} extends over ${esc(entry.name)} for this attack.</div>`,
    flags: { flowstate: { quartzFor: { attackMessage: message.id, index, shroud: sh.uuid, owner: owner.uuid } } } });
}
export function findQuartz(attackMessageId, index) {
  return game.messages.filter(m => { const f = m.getFlag("flowstate", "quartzFor"); return f?.attackMessage === attackMessageId && f.index === index; })
    .map(m => m.getFlag("flowstate", "quartzFor").shroud);
}

/** Retort Shroud: after a hit it could block, 1 RP to give the attack's damage a stack of Weakened. */
export async function retort(defenseMessage) {
  const d = defenseMessage.getFlag("flowstate", "defense");
  if (!d?.result?.hit) return;
  if (findRetort(defenseMessage.id)) return ui.notifications.info("Retort was already used.");
  const actor = await fromUuid(d.target);
  if (!actor?.isOwner) return ui.notifications.warn("You don't control that character.");
  if (actor.system.shroud?.system.shroudType !== "retort") return;
  if (!(await spendPoints(actor, "rp", 1, "Retort"))) return;
  await post(actor, { title: `${esc(actor.name)} — Retort`, body: `<div class="fs-result">The incoming damage gets a stack of Weakened.</div><div class="fs-notes">1 RP</div>`,
    flags: { flowstate: { retortOf: defenseMessage.id } } });
}
export const findRetort = defenseMessageId => game.messages.find(m => m.getFlag("flowstate", "retortOf") === defenseMessageId) ?? null;

/**
 * After the Shroud takes damage from an attacker: Riposte Shroud (1 RP, ranged attack for the damage it took),
 * Ruby / Sapphire (free melee attack in your melee range: Ignite / Slow stacks equal to the damage it took).
 */
export function shroudCounterRows(target, attacker, outcome) {
  const sh = target.system?.shroud;
  const took = (outcome.shrouds ?? []).find(x => x.item === sh)?.absorbed ?? 0;
  if (!sh || !took || !attacker) return "";
  const btn = (kind, label, tip) => `<button type="button" class="fs-shroud-counter" data-kind="${kind}" data-amount="${took}" data-tooltip="${tip}"><i class="fa-solid fa-ghost"></i> ${label}</button>`;
  const near = inPersonalMelee(target, attacker);
  const buttons = [
    sh.system.shroudType === "riposte" ? btn("riposte", `Shroud Riposte (1 RP): ${took} back`, `Ranged attack roll against ${esc(attacker.name)}; on a hit they take ${took}`) : "",
    hasAffix(sh, "ruby") && near ? btn("ruby", `Ruby: free attack (Ignite ${took})`, `Free melee attack; on a hit ${esc(attacker.name)} gets ${took} Ignite`) : "",
    hasAffix(sh, "sapphire") && near ? btn("sapphire", `Sapphire: free attack (Slow ${took})`, `Free melee attack; on a hit ${esc(attacker.name)} gets ${took} Slow`) : ""
  ].filter(Boolean);
  return buttons.length ? `<div class="fs-brawl-row fs-shroud-row" data-role="defender" data-owner="${target.uuid}">${buttons.join("")}</div>` : "";
}

/** Reflect (Protection Arcana T2): damage a Shield took goes back at the source as a Ranged attack roll by the caster. */
export function reflectRows(outcome) {
  return (outcome.shields ?? []).filter(x => x.reflect && x.absorbed > 0 && x.caster).map(x =>
    `<div class="fs-brawl-row fs-reflect-row" data-role="defender" data-owner="${x.caster}">
      <button type="button" class="fs-reflect-counter" data-caster="${x.caster}" data-amount="${x.absorbed}" data-tooltip="Ranged attack roll against the attacker; on a hit they take the damage the Shield took (the Shield still took it)"><i class="fa-solid fa-shield-halved"></i> Reflect: ${x.absorbed} back</button></div>`).join("");
}
export async function reflectCounter(damageMessage, casterUuid, amount) {
  const d = damageMessage.getFlag("flowstate", "damage");
  if (!d) return;
  const key = `${damageMessage.id}:reflect:${casterUuid}`;
  if (game.messages.find(m => m.getFlag("flowstate", "attack")?.opts?.shroudCounterOf === key)) return ui.notifications.info("Already reflected.");
  const caster = await fromUuid(casterUuid), foe = await fromUuid(d.attacker);
  if (!caster?.isOwner) return ui.notifications.warn("You don't control that character.");
  if (!foe) return;
  // The attacker has to be within 200 ft of the Shield (the creature wearing it).
  const holder = await fromUuid(d.target);
  const hTok = holder?.getActiveTokens?.()[0], fTok = foe.getActiveTokens?.()[0];
  if (hTok && fTok && globalThis.canvas?.grid && tokenDistance(hTok, fTok) > 200) return ui.notifications.warn(`${foe.name} is more than 200 ft from the Shield.`);
  return performAttack(caster, {
    label: "Reflect", net: 0, melee: false, push: false, damage: String(amount), type: d.type ?? "physical", stacks: 0, physical: false, shots: 1,
    notes: [`The damage the Shield took (${amount}) goes back at ${foe.name}`], followups: [], targetActors: [foe], shroudCounterOf: key
  });
}

/** Run a Shroud counter from a damage card. Each one once per card. */
export async function shroudCounter(damageMessage, kind, amount) {
  const d = damageMessage.getFlag("flowstate", "damage");
  if (!d) return;
  if (game.messages.find(m => m.getFlag("flowstate", "attack")?.opts?.shroudCounterOf === `${damageMessage.id}:${kind}`)) return ui.notifications.info("Already used.");
  const actor = await fromUuid(d.target), foe = await fromUuid(d.attacker);
  if (!actor?.isOwner) return ui.notifications.warn("You don't control that character.");
  if (!foe) return;
  if (kind === "riposte" && !(await spendPoints(actor, "rp", 1, "Shroud Riposte"))) return;
  const sh = actor.system.shroud;
  const type = damageMessage.getFlag("flowstate", "damage")?.type ?? "physical";
  return performAttack(actor, {
    label: kind === "riposte" ? `${sh?.name ?? "Shroud"} — Riposte` : `${sh?.name ?? "Shroud"} — ${kind === "ruby" ? "Ruby" : "Sapphire"}`,
    net: 0, melee: kind !== "riposte", push: false, damage: kind === "riposte" ? String(amount) : "", type, stacks: 0, physical: false, shots: 1,
    notes: [kind === "riposte" ? `The damage the Shroud took (${amount}) goes back at them` : `On a hit: ${amount} ${kind === "ruby" ? "Ignite" : "Slow"}`],
    followups: [], targetActors: [foe], shroudCounterOf: `${damageMessage.id}:${kind}`,
    inflict: kind === "ruby" ? { ignite: amount } : kind === "sapphire" ? { slow: amount } : null
  });
}
