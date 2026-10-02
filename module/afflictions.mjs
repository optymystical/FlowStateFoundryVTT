/**
 * Tier 3 spell effects: Venomancy (Poison), Charm and Witchery (Hex), their Combos, and the Mods that go with them.
 * The rules data is in spellfx.mjs; this file applies it. actions.mjs calls in through `registerAfflictions()`.
 *
 * Shapes of the effects these spells leave on creatures (Active Effects with `flags.flowstate.spellEffect`):
 *   coat    a Poison waiting to pass to whoever the coated creature next deals direct damage to (until the caster's next turn)
 *   poison  a Poison on a victim: a Constitution check at the start of their turn, and health loss on a failure
 *   charm   disadvantage (Weakened for damage) on one roll type; Combo versions wait for the victim's next turn, then hurt them
 *   hex     a trigger, and a Build check + damage whenever it fires
 * Everything about Charm and Hex checks goes to the caster and the GM only: the target is not alerted.
 */
import * as fx from "./spellfx.mjs";
import {
  post, requestGM, requestDamage, damageOutcome, putSpellEffect, spellEffects, spellForce, giveStacks, pickSceneTarget, performAttack, attackerToken,
  tokenDistance, changeEffect, knockbackRow, exhaustionNet, magicDisNet, registerAfflictions, setActorFlag
} from "./actions.mjs";
import { removeEnergy } from "./elemental.mjs";
import { poolFormula, applyStacks, DAMAGE_TYPES, STATS } from "./rules.mjs";

const esc = s => foundry.utils.escapeHTML?.(String(s)) ?? String(s);
const roll = formula => new Roll(formula).evaluate();
const data = e => e.flags?.flowstate?.spellEffect ?? {};
const typeLabel = t => (t === "health" ? "health" : DAMAGE_TYPES[t] ?? t);
const dice = (n, sides) => `${n}d${sides}`;

/** Every actor that might carry one of our effects (world actors and unlinked tokens). */
function allActors() {
  const seen = new Set(), out = [];
  for (const a of globalThis.game?.actors ?? []) if (!seen.has(a.uuid)) { seen.add(a.uuid); out.push(a); }
  for (const t of globalThis.canvas?.tokens?.placeables ?? []) { const a = t.actor; if (a && !seen.has(a.uuid)) { seen.add(a.uuid); out.push(a); } }
  return out;
}
/** Effects of one kind that this caster put on anyone. */
const effectsFrom = (kind, casterUuid) => allActors().flatMap(a => spellEffects(a, kind).filter(e => data(e).caster === casterUuid).map(e => ({ actor: a, effect: e })));

/* -------------------------------------------- */
/*  Secret cards and checks                     */
/* -------------------------------------------- */

/** A card only the caster and the GM see (Charm and Hex don't alert their target). */
export async function secret(actor, caster, { title, body, rolls = [], flags = {} }) {
  const game = globalThis.game;
  const ids = (game.users ?? []).filter(u => u.isGM || caster?.testUserPermission?.(u, "OWNER")).map(u => u.id);
  const content = `<div class="flowstate-card"><header class="fs-card-title">${title}</header>${body}</div>`;
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content, rolls, flags, whisper: ids });
}

/**
 * A stat check against a fixed requirement. `stats` is one key or several (their die sizes are added: Poison + Charm's combined check).
 * `dis` is extra Disadvantage stacks (Cloud, Potency, Unravel). Returns { roll, total, passed, die, label }.
 */
export async function check(actor, stats, req, { dis = 0 } = {}) {
  const keys = [].concat(stats);
  const eff = actor.system.derived.effective;
  const die = keys.reduce((n, k) => n + (eff[k]?.die ?? 0), 0);
  const spirit = keys.some(k => ["reach", "grasp", "build"].includes(k));
  const net = -dis + exhaustionNet(actor) + charmNet(actor, "stat") + (spirit ? magicDisNet(actor) : 0);
  const r = await roll(poolFormula(1, Math.max(1, die), net));
  return { roll: r, total: r.total, passed: r.total >= req, die, req, net, label: keys.map(k => STATS[k]?.label ?? k).join(" + ") };
}
const checkLine = (who, c) => `<div class="fs-notes">${esc(who.name)}: ${c.label} check (d${c.die}${c.net ? `, ${c.net < 0 ? `${-c.net}× Disadvantage` : `${c.net}× Advantage`}` : ""}) needs ${c.req} or higher: <strong>${c.total}</strong> — ${c.passed ? "passed" : "failed"}.</div>`;

/* -------------------------------------------- */
/*  Roll penalties from Charm and Hex           */
/* -------------------------------------------- */

/** Stacks a Charm/Hex puts on this creature's rolls of a type (the larger of those that apply: they don't stack on the same roll type). */
function penaltyStacks(actor, type) {
  let best = 0;
  for (const e of spellEffects(actor, "charm")) { const d = data(e); if (d.rollType === type && !d.pending) best = Math.max(best, d.amount ?? 1); }
  for (const e of [...spellEffects(actor, "hex"), ...spellEffects(actor, "charm")]) { const p = data(e).penalty; if (p?.roll === type) best = Math.max(best, p.amount ?? 1); }
  return best;
}
/** Disadvantage stacks (negative) on a roll type: everything but damage, which is Weakened instead. */
export const charmNet = (actor, type) => (type === "damage" ? 0 : -penaltyStacks(actor, type));
/** Weakened stacks on this creature's damage rolls. */
export const charmWeakened = actor => penaltyStacks(actor, "damage");
/** Is this creature under a Charm of that caster's? (Convince) */
export const charmedBy = (actor, casterUuid) => spellEffects(actor, "charm").some(e => data(e).caster === casterUuid && !data(e).pending);

/* -------------------------------------------- */
/*  Casting hooks                               */
/* -------------------------------------------- */

/** Use up a Ritual's single free cast once it has hit (a miss leaves it usable). */
async function spendRitual(caster, ritualFree) {
  if (!ritualFree) return;
  const r = Array.from(caster.effects ?? []).find(e => e.id === ritualFree);
  if (r) await r.update({ "flags.flowstate.ritual.freeCasts": 0 });
}

/** The spell hit `target`. Returns { html, rolls, push }. */
export async function onHit({ attacker, target, o, result, entry, profile, dodgeTotal }) {
  const sp = o.spell, a = profile.afflict;
  const out = { html: "", rolls: [], push: null };
  if (sp.act) return actHit({ attacker, target, sp, out });
  await spendRitual(attacker, sp.ritualFree);
  const ch = sp.afflict ?? {};
  const m = sp.mods ?? {};
  const ritualOf = sp.ritualOf ?? null;
  const power = Math.max(1, sp.power);
  const base = { caster: attacker.uuid, power, ritualOf, crit: result.critStacks ?? 0 };
  const lines = [];
  if (a.kind === "poison" || a.kind === "venomCharm" || a.kind === "venomHex") {
    const d = poisonData(a, sp, base, ch);
    await putSpellEffect(target, { kind: "coat", caster: attacker.uuid, ritualOf, name: `${profile.name} coating`, poison: d,
      description: `Coated with ${profile.name}: it passes to the next creature this one deals direct damage to${ritualOf ? " (a Ritual's coating doesn't wear off)" : ", until the start of the caster's next turn"}.` });
    out.html = `<div class="fs-result"><i class="fa-solid fa-flask-vial"></i> ${esc(target.name)} is coated with <strong>${esc(profile.name)}</strong>${ritualOf ? "" : " until the start of your next turn"}.</div>`;
    await post(attacker, { title: `${esc(attacker.name)} — ${esc(profile.name)}`, body: `<div class="fs-result">${esc(target.name)} is coated: when they next deal direct damage to a target, the ${esc(profile.name)} passes to that target.</div>
      ${actRow(attacker, 0, "pass", `Pass the ${profile.name}…`, "fa-solid fa-flask-vial", `Choose who ${target.name} just dealt direct damage to`)}`,
      flags: { flowstate: { afflict: { acts: [{ act: "pass", coated: target.uuid, caster: attacker.uuid }] } } } });
    return out;
  }
  if (a.kind === "charm") {
    if (a.combo) {
      await putSpellEffect(target, { kind: "charm", stack: true, onTargetTurn: true, pending: true, caster: attacker.uuid, ritualOf, name: `${profile.name}`, combo: a.combo, power,
        ingrained: !!m.ingrained, req: 3, cloud: !!m.cloud, critStacks: a.combo.critStrength ? base.crit : 0,
        description: `At the start of their next turn they roll a Willpower check (3 or higher); on a failure they hurt themselves (${dice(a.combo.dice[0] * power, a.combo.dice[1])} ${typeLabel(a.combo.type)}).` });
      out.html = `<div class="fs-notes">${esc(profile.name)} hit. The result goes to the caster and the GM.</div>`;
      await secret(target, attacker, { title: `${esc(attacker.name)} — ${esc(profile.name)}`, body: `<div class="fs-result">${esc(target.name)} makes a Willpower check (3 or higher) at the start of their next turn; on a failure they hurt themselves for ${dice(a.combo.dice[0] * power, a.combo.dice[1])} ${typeLabel(a.combo.type)}.</div>` });
      return out;
    }
    const r = await charmCheck(attacker, target, { dis: m.cloud ? 1 : 0 });
    out.rolls.push(r.roll);
    out.html = `<div class="fs-notes">Charm hit. The result goes to the caster and the GM.</div>`;
    if (r.passed) {
      await secret(target, attacker, { title: `${esc(attacker.name)} — Charm`, rolls: [r.roll], body: `${checkLine(target, r)}<div class="fs-result">${esc(target.name)} resists the Charm.</div>` });
      return out;
    }
    const placed = await placeCharm(attacker, target, { rollType: ch.charmRoll || "attack", ritualOf, ingrained: !!m.ingrained, propagandize: !!m.propagandize });
    await secret(target, attacker, { title: `${esc(attacker.name)} — Charm`, rolls: [r.roll], body: `${checkLine(target, r)}${placed}` });
    return out;
  }
  // Hex (and the pure Combos that end in a Hex)
  if (a.kind === "hex") {
    const h = hexData(a, sp, base, ch, profile);
    await putSpellEffect(target, hexEffect(h, profile));
    out.html = `<div class="fs-notes">${esc(profile.name)} hit. The result goes to the caster and the GM.</div>`;
    await secret(target, attacker, { title: `${esc(attacker.name)} — ${esc(profile.name)}`, body: hexCard(target, h), flags: hexFlags(target, h) });
    return out;
  }
  if (a.kind === "charmHex") {
    const c = await combinedCheck(attacker, target, a, { dis: 0 });
    out.rolls.push(c.roll);
    out.html = `<div class="fs-notes">${esc(profile.name)} hit. The result goes to the caster and the GM.</div>`;
    if (c.passed) { await secret(target, attacker, { title: `${esc(attacker.name)} — ${esc(profile.name)}`, rolls: [c.roll], body: `${checkLine(target, c)}<div class="fs-result">${esc(target.name)} resists.</div>` }); return out; }
    const h = hexData(a, sp, base, ch, profile, { noCheck: true, repeat: true, penalty: true, lastsToCaster: true });
    await putSpellEffect(target, hexEffect(h, profile));
    await secret(target, attacker, { title: `${esc(attacker.name)} — ${esc(profile.name)}`, rolls: [c.roll], body: `${checkLine(target, c)}${hexCard(target, h)}`, flags: hexFlags(target, h) });
    return out;
  }
  return out;
}

/** Charm's Willpower check (3 or higher). */
const charmCheck = (attacker, target, { dis = 0, req = 3 } = {}) => check(target, "will", req, { dis });
/** A combined check (die sizes added), 5 or higher: Venomancy + Charm, Venomancy + Witchery, Charm + Witchery. */
const combinedCheck = (attacker, target, a, { dis = 0 } = {}) => check(target, a.combined, a.req, { dis });

/** Put a Charm on a creature (replacing one of the same caster and roll type; doubled by Propagandize). */
export async function placeCharm(caster, target, { rollType, ritualOf = null, ingrained = false, propagandize = false, dot = null, turnsLeft = 0 }) {
  const mine = spellEffects(target, "charm").filter(e => data(e).caster === caster.uuid && !data(e).pending);
  const same = mine.find(e => data(e).rollType === rollType);
  if (same && turnsLeft) { await changeEffect(same, { "flags.flowstate.spellEffect.turnsLeft": (data(same).turnsLeft ?? 1) + 1 }); return `<div class="fs-result">${esc(target.name)}'s Charm lasts one more turn of yours.</div>`; }
  if (same) await changeEffect(same, null);
  const amount = fx.charmAmount(propagandize, mine.filter(e => data(e).rollType !== rollType).length);
  const weak = rollType === "damage";
  const what = weak ? `Weakened ${amount > 1 ? "twice" : ""} on damage rolls` : `${amount > 1 ? "double " : ""}Disadvantage on ${fx.ROLL_TYPES[rollType]?.toLowerCase() ?? rollType} rolls`;
  await putSpellEffect(target, { kind: "charm", stack: true, caster: caster.uuid, ritualOf, onTargetTurn: ingrained && !ritualOf, ingrained: ingrained && !ritualOf, req: 3, rollType, amount, dot, turnsLeft,
    name: `Charm (${fx.ROLL_TYPES[rollType] ?? rollType})`, description: `${what}${ritualOf ? " until the ritual ends" : ingrained ? " for a minute (repeating the Willpower check each of the caster's turns, halving the requirement)" : ", until the start of the caster's next turn"}.${dot ? ` Loses ${dice(dot.n, dot.sides)} health at the start of each of their turns.` : ""}` });
  return `<div class="fs-result">${esc(target.name)} is Charmed: <strong>${what}</strong>${ritualOf ? " (permanent until the ritual ends)" : ingrained ? " (about a minute)" : " until the start of your next turn"}.</div>`;
}

/* -------------------------------------------- */
/*  Poison                                      */
/* -------------------------------------------- */

/** What a Poison carries around (as the coat, then as the Poison on the victim). */
function poisonData(a, sp, base, ch = {}) {
  const m = sp.mods ?? {}, p = base.power;
  return {
    kind: a.kind, caster: base.caster, ritualOf: base.ritualOf, ritual: !!base.ritualOf,
    n: (a.dice?.[0] ?? 0) * p, sides: a.dice?.[1] ?? 6, type: a.type ?? "health",
    bypassArmor: !!a.bypassArmor, force: !!a.force, livingDie: a.livingDie ?? 0, halfStrength: !!a.halfStrength, dodgeDie: a.dodgeDie ? a.dodgeDie * p : 0,
    ignite: !!a.ignite, stain: !!a.stain, energy: !!a.energy, arc: !!a.arc,
    prolong: m.prolong ?? 0, lethality: m.lethality ?? 0, potency: !!m.potency, virality: !!m.virality,
    combined: a.combined ?? null, comboReq: a.req ?? 0, charmRoll: ch.charmRoll || "attack", hex: ch.hex ?? null, hexDie: ch.hexDie ?? null,
    power: p, procs: 0, checks: 0
  };
}

/** The Poison is passed to `victim` (from a coat, or spread by Virality). */
export async function applyPoison(victim, d, caster, { fromSpread = false } = {}) {
  if (d.kind === "venomCharm" || d.kind === "venomHex") return applyVenomCombo(victim, d, caster);
  await putSpellEffect(victim, { ...d, kind: "poison", stack: true, onTargetTurn: true, name: `Poison (${dice(d.n, d.sides)}${d.type === "health" ? "" : ` ${typeLabel(d.type)}`})`, ritualOf: d.ritualOf ?? null,
    description: `At the start of their turn they roll a Constitution check (${d.req ?? 3} or higher) or ${d.force ? `take ${dice(d.n, d.sides)} Force` : `lose ${dice(d.n, d.sides)} ${typeLabel(d.type)}${d.bypassArmor ? " (ignoring armor)" : ""}`}${d.ritual ? "; it lasts until they pass or die" : d.prolong ? `; it repeats until they pass or it has applied ${1 + d.prolong} times` : ""}.` });
  await post(victim, { title: `${esc(victim.name)} — Poisoned`, body: `<div class="fs-result"><i class="fa-solid fa-skull-crossbones"></i> ${esc(victim.name)} is poisoned${fromSpread ? " (it spread)" : ""}: at the start of their next turn they roll a Constitution check (3 or higher) or ${d.force ? `take ${dice(d.n, d.sides)} Force` : `lose ${dice(d.n, d.sides)} ${typeLabel(d.type)}`}.</div>` });
}

/** Venomancy + Charm / Venomancy + Witchery, once the coating has passed: the combined check. */
async function applyVenomCombo(victim, d, caster) {
  const c = await check(victim, d.combined, d.comboReq, { dis: d.potency ? 1 : 0 });
  const title = d.kind === "venomCharm" ? "Poison + Charm" : "Poison + Hex";
  if (c.passed) return secret(victim, caster, { title: `${esc(title)} — ${esc(victim.name)}`, rolls: [c.roll], body: `${checkLine(victim, c)}<div class="fs-result">${esc(victim.name)} resists.</div>` });
  let body = checkLine(victim, c);
  if (d.kind === "venomCharm") {
    body += await placeCharm(caster ?? victim, victim, { rollType: d.charmRoll, ritualOf: d.ritualOf, dot: { n: d.n, sides: d.sides }, turnsLeft: 1 });
  } else {
    const h = { ...hexBase(d.caster, d.power, d.ritualOf), trigger: d.hex?.trigger || "harm", roll: d.hex?.roll || "attack", outcome: d.hex?.outcome || "fail", detail: d.hex?.detail || "",
      n: d.n, sides: d.sides, type: "health", noCheck: true, repeat: true, lastsToCaster: true, turnsLeft: 1, linger: 0, fester: 0, unravel: false, consume: false, extra: null };
    await putSpellEffect(victim, hexEffect(h, { name: "Poison + Hex" }));
    body += hexCard(victim, h);
  }
  await secret(victim, caster, { title: `${esc(title)} — ${esc(victim.name)}`, rolls: [c.roll], body });
}

/**
 * The start of a poisoned creature's turn: the Constitution check, health loss, extras, and whether the Poison ends.
 */
async function poisonTick(actor, e) {
  const d = data(e);
  const caster = await fromUuid(d.caster);
  const req = d.req ?? 3;
  const c = await check(actor, "con", req, { dis: d.potency && !d.checks ? 1 : 0 });
  const html = [checkLine(actor, c)];
  const rolls = [c.roll];
  let push = null, acts = [];
  if (!c.passed) {
    const sides = fx.poisonSides(d.sides, d.lethality, d.procs);
    const living = !actor.system.magical;
    const die = sides + (d.livingDie && living ? d.livingDie : 0);
    if (d.force) {
      html.push(`<div class="fs-result">${esc(actor.name)} fails and the Poison applies Force instead of health loss.</div>`);
      const f = await forceRoll(caster, actor, { n: d.n, sides });
      html.push(f.html); rolls.push(...f.rolls); push = f.push;
    } else {
      const dmg = await roll(dice(d.n, die));
      rolls.push(dmg);
      const stacks = d.halfStrength && fx.halfOrLower(c.total, req) ? 1 : 0;
      const total = applyStacks(dmg.total, stacks);
      html.push(`<div class="fs-result">${esc(actor.name)} fails: ${dice(d.n, die)} = ${dmg.total}${stacks ? ` (Strengthened → ${total})` : ""} ${typeLabel(d.type)}${d.livingDie && living ? ` (+${d.livingDie} die size: living)` : ""}${d.lethality && d.procs ? ` (Lethality: d${sides})` : ""}.</div>`);
      const extra = await dealDamage(actor, total, d, html);
      if (d.ignite) html.push(await stackLine(actor, "ignite", total, extra.outcome, caster));
      if (d.stain) html.push(await stackLine(actor, "stain", total, extra.outcome, caster));
      if (d.energy) { const r = await removeEnergy(actor, total); html.push(`<div class="fs-result">${esc(actor.name)} loses <strong>${r.removed} Energy</strong> (${r.remaining} left).</div>`); }
      if (d.arc && caster) acts.push({ act: "arc", from: actor.uuid, attacker: caster.uuid, n: d.n, sides: die, type: d.type, stacks: 0, label: "Radiation Poison" });
    }
  }
  const procs = d.procs + (c.passed ? 0 : 1);
  const ended = fx.poisonEnds({ passed: c.passed, procs, prolong: d.prolong, ritual: !!d.ritual });
  if (d.virality && caster && fx.lessThanHalf(c.total, req)) acts.push({ act: "spread", from: actor.uuid, attacker: caster.uuid, poison: { ...d, procs: 0, checks: 0, ritual: false, ritualOf: null, lethality: d.lethality } });
  if (ended) { await changeEffect(e, null); html.push(`<div class="fs-notes">The Poison ends.</div>`); }
  else await changeEffect(e, { "flags.flowstate.spellEffect.procs": procs, "flags.flowstate.spellEffect.checks": d.checks + 1 });
  await post(actor, { title: `${esc(actor.name)} — Poison`, rolls, body: html.join("") + acts.map((x, i) => actButton(x, i)).join("") + (push ? knockbackRow(d.caster, push.feet, "Force") : ""),
    flags: { flowstate: { afflict: { acts }, ...(push ? { knockback: push } : {}) } } });
}

/** Damage dealt by a lingering effect: through armor (ignored for health loss and the Venomancy Combos). Returns { outcome }. */
async function dealDamage(actor, total, d, html) {
  const health = d.type === "health";
  const type = health ? "arcane" : d.type;
  const opts = { bypass: health, ignoreArmor: !!d.bypassArmor, archetype: "magic", fromHex: !!d.fromHex };
  const outcome = await damageOutcome(actor, total, type, opts);
  await requestDamage(actor, total, type, 0, null, { silent: true, ...opts });
  if (!health) html.push(`<ul class="fs-list">${outcome.lines.map(l => `<li>${l}</li>`).join("")}</ul>`);
  return { outcome };
}
async function stackLine(actor, kind, amount, outcome, caster) {
  const line = await giveStacks(actor, kind, amount, { outcome: outcome ?? null, caster });
  return line ? `<div class="fs-result">${line}</div>` : "";
}
/** Force from a lingering effect: the caster picks the direction on the card's button. */
async function forceRoll(caster, target, fd) {
  const f = await spellForce(caster ?? target, target, { stacks: 0 }, { critStacks: 0 }, fd, "Force");
  return f;
}

/* -------------------------------------------- */
/*  Hex                                         */
/* -------------------------------------------- */

export const hexBase = (caster, power, ritualOf) => ({ caster, power, ritualOf: ritualOf ?? null, ritual: !!ritualOf, hid: foundry.utils.randomID?.() ?? String(Math.random()).slice(2) });

export function hexData(a, sp, base, ch, profile, extra = {}) {
  const m = sp.mods ?? {}, p = base.power, hx = ch.hex ?? {};
  const trigger = hx.trigger && fx.HEX_TRIGGERS[hx.trigger] ? hx.trigger : "harm";
  const scaled = {};
  for (const [k, v] of Object.entries(a.extra ?? {})) scaled[k] = Array.isArray(v) ? [v[0] * p, v[1]] : v;
  return { ...hexBase(base.caster, p, base.ritualOf), trigger, roll: hx.roll || "attack", outcome: hx.outcome || "fail", detail: hx.detail || "",
    n: a.dice[0] * p, sides: a.dice[1], type: a.type, linger: m.linger ?? 0, fester: m.fester ?? 0, unravel: !!m.unravel, consume: !!m.consume,
    extra: Object.keys(scaled).length ? scaled : null, hexDie: ch.hexDie || "dodge", procs: 0, checks: 0, triggers: 0, ...extra };
}

/** The Active Effect data for a Hex (a minute, or until it has triggered enough times; Rituals are permanent). */
export function hexEffect(h, profile) {
  const w = globalThis.game?.time?.worldTime;
  const left = h.ritual || h.repeat ? Infinity : 1 + (h.linger ?? 0);
  const trig = fx.HEX_TRIGGERS[h.trigger]?.label ?? h.trigger;
  const penalty = h.penalty && (h.trigger === "roll" || h.trigger === "failsuccess") ? { roll: h.roll, amount: 1 } : null;
  return { ...h, kind: "hex", stack: true, onTargetTurn: !h.lastsToCaster, left: Number.isFinite(left) ? left : 99999, penalty, expiresAt: !h.ritual && !h.lastsToCaster && w !== undefined ? w + 60 : null, name: `${profile.name} (${h.trigger})`,
    description: `Triggers on: ${trig}${h.trigger === "roll" || h.trigger === "failsuccess" ? ` (${fx.ROLL_TYPES[h.roll] ?? h.roll}${h.trigger === "failsuccess" ? `, ${h.outcome}` : ""})` : ""}${h.detail ? ` — ${h.detail}` : ""}. ${h.noCheck ? "" : "Build check (3 or higher), "}${h.type === "health" ? `${dice(h.n, h.sides)} health` : `${dice(h.n, h.sides)} ${typeLabel(h.type)}`}.` };
}
const hexTriggerText = h => `${fx.HEX_TRIGGERS[h.trigger]?.label ?? h.trigger}${h.trigger === "roll" || h.trigger === "failsuccess" ? ` (${fx.ROLL_TYPES[h.roll] ?? h.roll}${h.trigger === "failsuccess" ? `, ${h.outcome}` : ""})` : ""}${h.detail ? ` — ${esc(h.detail)}` : ""}`;
export function hexCard(target, h) {
  const manual = h.trigger === "act" || h.trigger === "word" || (h.trigger === "failsuccess" && (h.roll === "stat" || h.roll === "noncombat"));
  return `<div class="fs-result"><i class="fa-solid fa-hat-wizard"></i> ${esc(target.name)} carries a Hex. Trigger: <strong>${hexTriggerText(h)}</strong>.</div>
    <div class="fs-notes">${h.noCheck ? "" : "Build check (3 or higher), then "}${dice(h.n, h.sides)} ${typeLabel(h.type)} (${fx.HEX_TRIGGERS[h.trigger].stacks > 0 ? `Strengthened ×${fx.HEX_TRIGGERS[h.trigger].stacks}` : fx.HEX_TRIGGERS[h.trigger].stacks < 0 ? `Weakened ×${-fx.HEX_TRIGGERS[h.trigger].stacks}` : "no stacks"}). ${h.ritual ? "Permanent until the ritual ends." : h.repeat ? "Lasts until the start of your next turn." : `Lasts a minute or ${h.linger ? `${1 + h.linger} triggers` : "until it triggers"}.`}
    ${manual ? "This trigger can't be detected automatically: click the button below when it happens." : "It triggers automatically."}</div>
    ${manual ? actRow({ uuid: h.caster }, 0, "hex", "Trigger the Hex", "fa-solid fa-bolt", "The trigger just happened") : ""}`;
}
export const hexFlags = (target, h) => ({ flowstate: { afflict: { acts: [{ act: "hex", target: target.uuid, hid: h.hid, caster: h.caster }] } } });

/** A Hex's trigger happened to this creature. kind: harm | move | roll | failsuccess | manual. */
const firing = new Set();
export async function hexTrigger(actor, kind, info = {}) {
  if (!actor || actor.type === "pile") return;
  for (const e of spellEffects(actor, "hex")) {
    const d = data(e);
    const hit = kind === "manual" ? d.hid === info.hid
      : kind === "harm" ? d.trigger === "harm"
      : kind === "move" ? d.trigger === "move"
      : kind === "roll" ? d.trigger === "roll" && d.roll === info.roll
      : kind === "failsuccess" ? d.trigger === "failsuccess" && d.roll === info.roll && d.outcome === info.outcome : false;
    if (!hit || firing.has(e.id)) continue;
    firing.add(e.id);
    try { await fireHex(actor, e); } finally { firing.delete(e.id); }
  }
}

const hexExpired = d => d.expiresAt != null && globalThis.game?.time?.worldTime !== undefined && globalThis.game.time.worldTime >= d.expiresAt;

async function fireHex(actor, e) {
  const d = data(e);
  if (hexExpired(d)) return changeEffect(e, null);
  const caster = await fromUuid(d.caster);
  const html = [`<div class="fs-result"><i class="fa-solid fa-hat-wizard"></i> The Hex on ${esc(actor.name)} triggers (${hexTriggerText(d)}).</div>`];
  const rolls = [];
  let failed = true, ch = null;
  if (!d.noCheck) {
    ch = await check(actor, "build", 3, { dis: d.unravel && !d.checks ? 1 : 0 });
    rolls.push(ch.roll);
    failed = !ch.passed;
    html.push(checkLine(actor, ch));
  }
  let destroyed = false, push = null;
  const acts = [];
  if (failed) {
    const sides = fx.hexSides(d.sides, d.fester, d.procs);
    const dmg = await roll(dice(d.n, sides));
    rolls.push(dmg);
    const stacks = fx.HEX_TRIGGERS[d.trigger]?.stacks ?? 0;
    const total = applyStacks(dmg.total, stacks);
    html.push(`<div class="fs-result">${dice(d.n, sides)} = ${dmg.total}${stacks ? ` (${stacks > 0 ? "Strengthened" : "Weakened"} ×${Math.abs(stacks)} → ${total})` : ""} ${typeLabel(d.type)}${d.fester && d.procs ? ` (Fester: d${sides})` : ""}.</div>`);
    const out = await dealDamage(actor, total, { ...d, fromHex: true, bypassArmor: false }, html);
    destroyed = actor.system.hp.value - out.outcome.toHp <= 0;
    const ex = d.extra ?? {};
    if (ex.force) { const f = await forceRoll(caster, actor, { n: ex.force[0], sides: ex.force[1] }); html.push(f.html); rolls.push(...f.rolls); push = f.push; }
    if (ex.ignite) { const r = await roll(dice(ex.ignite[0], ex.ignite[1])); rolls.push(r); html.push(await stackLine(actor, "ignite", r.total, out.outcome, caster)); }
    if (ex.stain) { const r = await roll(dice(ex.stain[0], ex.stain[1])); rolls.push(r); html.push(await stackLine(actor, "stain", r.total, out.outcome, caster)); }
    if (ex.energy) { const r = await roll(dice(ex.energy[0], ex.energy[1])); rolls.push(r); const rm = await removeEnergy(actor, r.total); html.push(`<div class="fs-result">${esc(actor.name)} loses <strong>${rm.removed} Energy</strong> (${rm.remaining} left).</div>`); }
    if (ex.dieDown) {
      const choice = d.hexDie === "attack" ? { key: "attackDie", n: 6, label: "attack" } : { key: "dodgeDie", n: 3, label: "dodge" };
      const amt = choice.n * d.power;
      await putSpellEffect(actor, { kind: choice.key, caster: d.caster, name: `${choice.label[0].toUpperCase()}${choice.label.slice(1)} −${amt} die size`, [choice.key]: amt,
        description: `${choice.label} dice are ${amt} sizes smaller until the start of the caster's next turn (doesn't stack).` });
      html.push(`<div class="fs-notes">${esc(actor.name)}'s ${choice.label} dice suffer <strong>−${amt} die size</strong> until the start of your next turn.</div>`);
    }
    for (let i = 0; i < (ex.arcs ?? 0); i++) if (caster) acts.push({ act: "arc", from: actor.uuid, attacker: caster.uuid, n: d.n, sides, type: d.type, stacks: stacks + 1, label: "Radiation Hex" });
    if (ch && d.unravel) {
      await putSpellEffect(actor, { kind: "magicDis", caster: d.caster, name: "Unravelled", description: "Disadvantage on all Magic related checks until the start of the caster's next turn." });
      html.push(`<div class="fs-notes">Unravel: ${esc(actor.name)} has Disadvantage on all Magic related checks until the start of your next turn.</div>`);
    }
    if (destroyed && d.consume && caster) {
      const gain = out.outcome.toHp;
      const maxE = caster.system.energy?.max ?? 0, haveE = caster.system.energy?.value ?? 0;
      if (caster.isOwner) await caster.update({ "system.energy.value": Math.min(maxE, haveE + gain) }); else await requestGM("updateActor", { uuid: caster.uuid, data: { "system.energy.value": Math.min(maxE, haveE + gain) } });
      html.push(`<div class="fs-result">Consume: ${esc(caster.name)} regains <strong>${gain} Energy</strong>.</div>`);
      acts.push({ act: "respread", from: actor.uuid, attacker: caster.uuid, hex: { ...d, procs: 0, checks: 0, triggers: 0, hid: foundry.utils.randomID?.() ?? "x", left: d.ritual ? 99999 : 1 + (d.linger ?? 0) } });
    }
  } else html.push(`<div class="fs-notes">${esc(actor.name)} passes: no damage.</div>`);
  const triggers = (d.triggers ?? 0) + 1;
  const left = (d.left ?? 1) - 1;
  const procs = d.procs + (failed ? 1 : 0);
  if (d.ritual || d.repeat) await changeEffect(e, { "flags.flowstate.spellEffect.procs": procs, "flags.flowstate.spellEffect.checks": (d.checks ?? 0) + 1, "flags.flowstate.spellEffect.triggers": triggers });
  else if (left <= 0) { await changeEffect(e, null); html.push(`<div class="fs-notes">The Hex is spent.</div>`); }
  else await changeEffect(e, { "flags.flowstate.spellEffect.left": left, "flags.flowstate.spellEffect.procs": procs, "flags.flowstate.spellEffect.checks": (d.checks ?? 0) + 1, "flags.flowstate.spellEffect.triggers": triggers });
  await post(actor, { title: `${esc(actor.name)} — Hex`, rolls, body: html.join("") + acts.map((x, i) => actButton(x, i)).join("") + (push ? knockbackRow(d.caster, push.feet, "Force") : ""),
    flags: { flowstate: { afflict: { acts }, ...(push ? { knockback: push } : {}) } } });
}

/** Success or failure of the attack roll / dodge: Fail/Success and Roll Hexes, after an exchange. */
export async function afterDefense({ attacker, target, result, dodgeRoll }) {
  await hexTrigger(attacker, "roll", { roll: "attack" });
  await hexTrigger(attacker, "failsuccess", { roll: "attack", outcome: result.hit ? "success" : "fail" });
  if (dodgeRoll) {
    await hexTrigger(target, "roll", { roll: "dodge" });
    await hexTrigger(target, "failsuccess", { roll: "dodge", outcome: result.hit ? "fail" : "success" });
  }
}

/* -------------------------------------------- */
/*  Start of turns                              */
/* -------------------------------------------- */

/** The start of a creature's turn: Poison checks, Combo Charm checks, damage-over-time, spent Hexes. */
export async function turnStart(actor) {
  for (const e of spellEffects(actor, "poison")) await poisonTick(actor, e);
  for (const e of spellEffects(actor, "charm")) {
    const d = data(e);
    if (d.combo && d.pending) await comboCheck(actor, e);
    else if (d.dot) await dotTick(actor, e);
  }
  for (const e of spellEffects(actor, "hex")) if (hexExpired(data(e))) await changeEffect(e, null);
}

/** Venomancy + Charm: health loss at the start of each of the victim's turns while the effect lasts. */
async function dotTick(actor, e) {
  const d = data(e);
  const r = await roll(dice(d.dot.n, d.dot.sides));
  await dealDamage(actor, r.total, { type: "health", bypassArmor: false }, []);
  await post(actor, { title: `${esc(actor.name)} — Poison + Charm`, rolls: [r], body: `<div class="fs-result">${esc(actor.name)} loses <strong>${r.total} health</strong> (${dice(d.dot.n, d.dot.sides)}).</div>` });
}

/** A Combo Charm's Willpower check; a failure hurts the victim (it can repeat each caster turn with Ingrained). */
async function comboCheck(actor, e, req = 3) {
  const d = data(e);
  const caster = await fromUuid(d.caster);
  const c = await check(actor, "will", req, { dis: d.cloud && !d.checked ? 1 : 0 });
  const html = [checkLine(actor, c)];
  const rolls = [c.roll];
  let push = null;
  const acts = [];
  if (!c.passed) {
    const cb = d.combo, n = cb.dice[0] * d.power;
    if (cb.force) {
      html.push(`<div class="fs-result">${esc(actor.name)} fails and is thrown about, in a way that seems natural. <em>The GM can lower it if it's too large to make sense.</em></div>`);
      const f = await forceRoll(caster, actor, { n, sides: cb.dice[1] });
      html.push(f.html); rolls.push(...f.rolls); push = f.push;
    } else {
      const r = await roll(dice(n, cb.dice[1]));
      rolls.push(r);
      const total = applyStacks(r.total, d.critStacks ?? 0);
      html.push(`<div class="fs-result">${esc(actor.name)} fails and hurts themselves: ${dice(n, cb.dice[1])} = ${r.total}${d.critStacks ? ` (Strengthened → ${total})` : ""} ${typeLabel(cb.type)}, in a way that seems natural. <em>The GM can lower it if it's too large to make sense.</em></div>`);
      const out = await dealDamage(actor, total, { type: cb.type, bypassArmor: false }, html);
      if (cb.ignite) html.push(await stackLine(actor, "ignite", total, out.outcome, caster));
      if (cb.stain) html.push(await stackLine(actor, "stain", total, out.outcome, caster));
      if (cb.energy) { const rm = await removeEnergy(actor, total); html.push(`<div class="fs-result">${esc(actor.name)} loses <strong>${rm.removed} Energy</strong> (${rm.remaining} left).</div>`); }
      if (cb.zap) acts.push({ act: "arc", from: actor.uuid, attacker: actor.uuid, n, sides: cb.dice[1], type: "radiation", stacks: 0, label: "Zap an ally", ally: true });
      if (cb.nextRoll) { await setActorFlag(actor, "disrupted", { by: d.caster }); html.push(`<div class="fs-notes">${esc(actor.name)}'s next roll of any kind has Disadvantage (Weakened if it is a damage roll).</div>`); }
    }
  }
  if (c.passed || !d.ingrained) await changeEffect(e, null);
  else await changeEffect(e, { "flags.flowstate.spellEffect.pending": false, "flags.flowstate.spellEffect.req": req, "flags.flowstate.spellEffect.checked": true });
  await secret(actor, caster, { title: `${esc(actor.name)} — Charm`, rolls, body: html.join("") + acts.map((x, i) => actButton(x, i)).join("") + (push ? knockbackRow(d.caster, push.feet, "Force") : ""),
    flags: { flowstate: { afflict: { acts }, ...(push ? { knockback: push } : {}) } } });
}

/** The caster's turn starts: Ingrained Charms repeat their check with half the requirement; Hexes that ran out are removed. */
export async function casterTurn(caster) {
  for (const { actor, effect } of effectsFrom("charm", caster.uuid)) {
    const d = data(effect);
    if (!d.ingrained || d.ritualOf) continue;
    const req = fx.charmRequirement(d.req ?? 3, 1);
    if (d.combo) { if (!d.pending) await comboCheck(actor, effect, req); continue; }
    const c = await charmCheck(caster, actor, { req });
    const html = [checkLine(actor, c)];
    if (c.passed) { await changeEffect(effect, null); html.push(`<div class="fs-result">${esc(actor.name)} shakes off the Charm.</div>`); }
    else { await changeEffect(effect, { "flags.flowstate.spellEffect.req": req }); html.push(`<div class="fs-result">The Charm holds (next check needs ${fx.charmRequirement(req, 1)}).</div>`); }
    await secret(actor, caster, { title: `${esc(caster.name)} — Ingrained Charm`, rolls: [c.roll], body: html.join("") });
  }
  for (const { effect } of effectsFrom("hex", caster.uuid)) if (hexExpired(data(effect))) await changeEffect(effect, null);
}

/* -------------------------------------------- */
/*  Buttons: passing a Poison, spreads, arcs     */
/* -------------------------------------------- */

/** Pick a creature on the scene (within range of the anchors); with no scene tokens, the caster's current targets stand in. */
async function pickTarget(actor, opts) {
  if (!(globalThis.canvas?.tokens?.placeables?.length)) {
    return [...(globalThis.game.user?.targets ?? [])].map(t => t.actor).find(a => a && a.type !== "pile" && !(opts.exclude ?? []).includes(a.uuid)) ?? null;
  }
  return pickSceneTarget(actor, opts);
}

const ACT_LABELS = { pass: "Pass the Poison", spread: "Virality: spread it", arc: "Arc to another target", respread: "Consume: reapply the Hex", hex: "Trigger the Hex" };
function actRow(owner, i, act, label, icon, tip) {
  return `<div class="fs-brawl-row fs-afflict-row" data-role="attacker" data-owner="${owner.uuid}"><button type="button" class="fs-afflict-act" data-i="${i}" data-tooltip="${esc(tip ?? "")}"><i class="${icon}"></i> ${esc(label)}</button></div>`;
}
export function actButton(x, i) {
  const ally = x.ally;
  const label = x.act === "arc" ? `${x.label}${ally ? "" : ""} (${dice(x.n, x.sides)} ${typeLabel(x.type)})` : ACT_LABELS[x.act] ?? x.act;
  const tips = { arc: "Make a Ranged attack roll at a target within 100 ft of the afflicted; on a hit the damage repeats", spread: "Make an attack roll at a target within 100 ft of them and you; on a hit the Poison duplicates onto it",
    respread: "Make a Targeted attack roll at another target in range; on a hit the Hex is reapplied to them" };
  return actRow({ uuid: x.attacker }, i, x.act, label, x.act === "arc" ? "fa-solid fa-bolt" : "fa-solid fa-circle-nodes", tips[x.act]);
}

/** A button on one of our cards was clicked. */
export async function act(message, i = 0) {
  const info = message.getFlag("flowstate", "afflict");
  const x = info?.acts?.[Number(i)];
  if (!x) return;
  const key = `${message.id}:afflict:${i}`;
  const done = () => globalThis.game.messages.find(m => m.getFlag("flowstate", "attack")?.opts?.shroudCounterOf === key);
  if (x.act === "hex") {
    const target = await fromUuid(x.target), caster = await fromUuid(x.caster);
    if (!caster?.isOwner) return ui.notifications.warn("Only the caster (or the GM) can trigger the Hex.");
    return hexTrigger(target, "manual", { hid: x.hid });
  }
  if (x.act === "pass") return passPoison(x);
  if (done()) return ui.notifications.info("Already used.");
  const attacker = await fromUuid(x.attacker), from = x.from ? await fromUuid(x.from) : null;
  if (!attacker?.isOwner) return ui.notifications.warn(`Only ${attacker?.name ?? "the caster"}'s owner can do that.`);
  const fromTok = from?.getActiveTokens?.()[0];
  const base = { net: 0, stealth: "none", melee: false, area: false, push: false, damage: "", type: "arcane", stacks: 0, physical: false, shots: 1, critStacks: 0, pierce: 0, bash: 0, knockback: 0, followups: [], shroudCounterOf: key };
  if (x.act === "arc") {
    const picked = await pickTarget(attacker, { title: `${x.label}: who`, within: 100, anchors: x.ally ? [attackerToken(attacker)] : [fromTok], exclude: [x.from, ...(x.ally ? [] : [])] });
    if (!picked) return;
    return performAttack(attacker, { ...base, label: x.label, damage: dice(x.n, x.sides), type: x.type, stacks: x.stacks ?? 0, notes: [`${x.label}: the damage repeats`], targetActors: [picked] });
  }
  const spell = (cores, extra) => ({ cores, power: 1, ritualOf: null, scaling: attacker.system.derived?.effective?.reach?.value ?? 0, mods: {}, exploit: null, replaced: {}, dampen: [], singleRoll: false, telegraph: null, hold: false, holdRoll: 0, ...extra });
  if (x.act === "spread") {
    const picked = await pickTarget(attacker, { title: "Virality: spread it to", within: 100, anchors: [attackerToken(attacker), fromTok], exclude: [x.from, attacker.uuid] });
    if (!picked) return;
    return performAttack(attacker, { ...base, label: "Virality", stealth: "half", notes: ["Virality: the Poison tries to spread"], targetActors: [picked], spell: spell(["magic-venomancy:poison"], { act: { type: "spread", poison: x.poison } }) });
  }
  if (x.act === "respread") {
    const picked = await pickTarget(attacker, { title: "Consume: reapply the Hex to", within: 100, anchors: [attackerToken(attacker)], exclude: [x.from, attacker.uuid] });
    if (!picked) return;
    return performAttack(attacker, { ...base, label: "Consume", stealth: "half", notes: ["Consume: the Hex jumps to a new target"], targetActors: [picked], spell: spell(["magic-witchery:hex"], { act: { type: "respread", hex: x.hex } }) });
  }
}

/** Pass a coating on: the caster says who the coated creature just dealt direct damage to. */
async function passPoison(x) {
  const caster = await fromUuid(x.caster), coated = await fromUuid(x.coated);
  if (!caster?.isOwner) return ui.notifications.warn(`Only ${caster?.name ?? "the caster"}'s owner (or the GM) can pass the Poison on.`);
  const coat = coated ? spellEffects(coated, "coat").find(e => data(e).caster === caster.uuid) : null;
  if (!coat) return ui.notifications.info("That coating has worn off (or was already passed on).");
  const victim = await pickTarget(caster, { title: `The Poison passes from ${coated.name} to`, exclude: [coated.uuid] });
  if (!victim) return;
  const d = data(coat).poison;
  await changeEffect(coat, null);
  await applyPoison(victim, d, caster);
}

/** A spread / reapplied effect landed (Virality, Consume). */
async function actHit({ attacker, target, sp, out }) {
  const act = sp.act;
  if (act.type === "spread") {
    await applyPoison(target, { ...act.poison, procs: 0, checks: 0 }, attacker, { fromSpread: true });
    out.html = `<div class="fs-result">The Poison spreads to ${esc(target.name)}.</div>`;
  } else if (act.type === "respread") {
    const h = act.hex, profile = { name: "Hex" };
    await putSpellEffect(target, hexEffect(h, profile));
    await secret(target, attacker, { title: `${esc(attacker.name)} — Consume`, body: hexCard(target, h), flags: hexFlags(target, h) });
    out.html = `<div class="fs-notes">The Hex jumps. The result goes to the caster and the GM.</div>`;
  }
  return out;
}

registerAfflictions({ onHit, charmNet, charmWeakened, charmedBy, hexTrigger, afterDefense, turnStart, casterTurn, act });
