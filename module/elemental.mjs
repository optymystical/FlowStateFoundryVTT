/**
 * Tier 2 spell effects (Heat, Cold, Radiation, Acid and their Combos): Ignite/Stain stacks, Energy removal, extra damage, chains,
 * Brand, Freeze, held melee spells, per-turn counters. The rules data is in spellfx.mjs; this file applies it.
 * actions.mjs calls in through `registerElemental()` (afterDamage / onHit / beforeApply).
 */
import * as fx from "./spellfx.mjs";
import {
  post, giveStacks, requestGM, requestDamage, damageOutcome, putSpellEffect, setActorFlag, pickSceneTarget, performAttack,
  attackerToken, tokenDistance, spellEffects, spellForce, turnKey, inActiveCombat, registerElemental, applySpellEffect
} from "./actions.mjs";
import { applyStacks, igniteTotal, stainTotal, freezeStains, STAIN_VARIANTS } from "./rules.mjs";
import { DAMAGE_TYPES } from "./rules.mjs";

const esc = s => foundry.utils.escapeHTML?.(String(s)) ?? String(s);
const roll = async formula => new Roll(formula).evaluate();

/* -------------------------------------------- */
/*  Small helpers                               */
/* -------------------------------------------- */

/** Per-turn counters on the caster: { key, targets: { uuid: n } }, reset when the turn changes. */
const counter = (actor, name) => {
  const c = actor.getFlag?.("flowstate", name);
  return c && c.key === turnKey() ? c.targets ?? {} : {};
};
export const countFor = (actor, name, targetUuid) => counter(actor, name)[targetUuid] ?? 0;
async function bump(actor, name, targetUuid) {
  const t = counter(actor, name);
  t[targetUuid] = (t[targetUuid] ?? 0) + 1;
  await setActorFlag(actor, name, { key: turnKey(), targets: t });
}

/** Remove Energy from a creature. Returns { removed, remaining }. */
export async function removeEnergy(target, amount) {
  const have = target.system.energy?.value ?? 0;
  const removed = Math.min(have, Math.max(0, Math.floor(amount)));
  const data = { "system.energy.value": have - removed };
  if (removed) { if (target.isOwner) await target.update(data); else await requestGM("updateActor", { uuid: target.uuid, data }); }
  return { removed, remaining: have - removed };
}

/** Deal `amount` of a damage type through armor (an attack's damage), optionally ignoring armor. Returns the card lines. */
async function dealDamage(target, amount, type, { bypass = false, brandBy = false, opts = {} } = {}) {
  if (amount <= 0) return "";
  const outcome = await damageOutcome(target, amount, type, { bypass, ...opts });
  await requestDamage(target, amount, type, 0, null, { silent: true, bypass, brandBy, ...opts });
  return `<div class="fs-result fs-damage-taken">${esc(target.name)} takes ${amount} ${DAMAGE_TYPES[type] ?? type}</div><ul class="fs-list">${outcome.lines.map(l => `<li>${l}</li>`).join("")}</ul>`;
}

/* -------------------------------------------- */
/*  After a hit (spells with no damage)         */
/* -------------------------------------------- */

/** Effects that fire on a hit: no-damage spells (Heat + Cold, Crushing + Acid, ...), Freeze, Heat + Crackle. */
export async function onHit(ctx) {
  const { attacker, target, o, entry, profile } = ctx;
  const sp = o.spell, m = sp.mods ?? {}, power = sp.power;
  const html = [], rolls = [];
  const dealt = sp.hold ? sp.holdRoll ?? 0 : 0;
  let stackAmount = 0, chain = null;
  for (const e of profile.effects ?? []) {
    if (e.at !== "hit" && !sp.hold) continue;       // a held spell applies its usual effects with no damage dealt
    if (e.stack) {
      let amount;
      if (e.stack.crushAcid) amount = fx.crushAcidStacks(entry?.total ?? 0, ctx.dodgeTotal ?? 0);
      else if (e.stack.dice) { const r = await roll(`${e.stack.dice[0] * power}d${e.stack.dice[1]}`); rolls.push(r); amount = r.total; }
      else amount = fx.amountSpec(e.stack, dealt, power);
      amount = applyStacks(amount, (o.stacks ?? 0) + (ctx.result?.critStacks ?? 0));
      const kind = fx.stainKindFor(e.stack.kind, m);
      stackAmount = amount;
      const line = await giveStacks(target, kind, amount, { first: e.stack.where === "first" || !!sp.hold, caster: attacker });
      if (line) html.push(`<div class="fs-result">${line}</div>`);
      if (kind === "stain" || kind === "solid") await trackStain(target, attacker, amount);
    }
    if (e.energy && sp.hold && !e.energy.sameAsStacks) {
      const r = await removeEnergy(target, fx.amountSpec(e.energy, dealt, power));
      html.push(`<div class="fs-result">${esc(target.name)} loses <strong>${r.removed} Energy</strong> (${r.remaining} left).</div>`);
    }
    if (e.chain && !profile.damage && !sp.hold) chain = { adv: e.chain.adv, force: !!e.chain.force };
    if (e.energy?.sameAsStacks) {
      const r = await removeEnergy(target, stackAmount);
      html.push(`<div class="fs-result">${esc(target.name)} loses <strong>${r.removed} Energy</strong>${r.remaining ? "" : " (none left)"}.</div>`);
    }
    if (e.freezeAll) {
      const c = target.system.conditions ?? {};
      const up = freezeStains(c, stackAmount);                 // the new Stains were just added; freeze every kind they had
      const total = stainTotal(c);
      const data = Object.fromEntries(Object.entries(up).map(([k, v]) => [`system.conditions.${k}`, k === "frozen" ? total : 0]));
      if (target.isOwner) await target.update(data); else await requestGM("updateActor", { uuid: target.uuid, data });
      html.push(`<div class="fs-result">${esc(target.name)}'s Stains freeze: <strong>${total} Frozen Stains</strong> (6 AP to remove, they drain Energy).</div>`);
    }
    if (e.heatRad) {
      const r = await roll(`${e.heatRad.dice[0] * power}d${e.heatRad.dice[1]}`);
      rolls.push(r);
      await putSpellEffect(target, { kind: "heatRad", caster: attacker.uuid, name: `Static (${r.total} Ignite)`, amount: r.total,
        description: `Gets ${r.total} Ignite stacks whenever another target takes heat or radiation damage from ${attacker.name}'s spells, until the start of their next turn.` });
      html.push(`<div class="fs-result">${esc(target.name)} is charged: <strong>${r.total} Ignite</strong> whenever another target takes heat or radiation damage from your spells (until your next turn).</div>`);
    }
  }
  // Freeze (Cold T4): the next time they'd restore Energy they restore less and take that much cold damage.
  if (m.freeze) {
    const amount = 3 * power;
    await putSpellEffect(target, { kind: "freeze", caster: attacker.uuid, name: `Freeze (${amount})`, amount,
      description: `The next time they would restore Energy they restore ${amount} less and take that much cold damage.`, stack: true });
    html.push(`<div class="fs-notes">Freeze: the next time ${esc(target.name)} restores Energy, ${amount} less and ${amount} cold damage.</div>`);
  }
  if (chain) html.push(chainRow(attacker, chain, sp.chain?.depth ?? 0));
  return { html: html.join(""), rolls, chain };
}

/* -------------------------------------------- */
/*  Before the damage is applied                */
/* -------------------------------------------- */

/** Brand (Heat T3): mark the target before the damage lands, so this spell's own heat damage triggers it. */
export async function beforeApply(ctx) {
  const { attacker, target, o, baseTotal } = ctx;
  const sp = o.spell, m = sp.mods ?? {};
  if (!m.brand) return "";
  await putSpellEffect(target, { kind: "brand", caster: attacker.uuid, name: `Brand (${baseTotal})`, amount: baseTotal,
    description: `Whenever they take heat damage that isn't from the Brand, they take ${baseTotal} more heat damage, until the start of the caster's next turn.` });
  return `<div class="fs-notes">Brand: ${esc(target.name)} is branded: heat damage that isn't from the Brand deals ${baseTotal} more heat until your next turn.</div>`;
}

/**
 * Heat damage on a creature carrying a Brand (any source but the Brand itself) adds the Brand's damage. Called from applyDamage.
 * Returns the extra amount (the caller applies it).
 */
export function brandExtra(actor, type, brandBy) {
  if (type !== "heat" || brandBy) return 0;
  return spellEffects(actor, "brand").reduce((n, e) => n + (Number(e.flags.flowstate.spellEffect.amount) || 0), 0);
}

/* -------------------------------------------- */
/*  After the damage                            */
/* -------------------------------------------- */

/** Stain stacks you applied (for Catalyst): { casterUuid: n } on the target. */
async function trackStain(target, caster, amount) {
  const cur = target.getFlag?.("flowstate", "stainFrom") ?? {};
  cur[caster.uuid] = (cur[caster.uuid] ?? 0) + amount;
  await setActorFlag(target, "stainFrom", cur);
}

/**
 * Everything a Tier 2 spell does once its damage has landed.
 * ctx: { o, attacker, target, defense, outcome, dealt, type, profile, facts, baseTotal, setOutcomes }
 * Returns { html, rolls, kb, chain }.
 */
export async function afterDamage(ctx) {
  const { o, attacker, target, outcome, dealt, type, profile, facts } = ctx;
  const sp = o.spell, m = sp.mods ?? {}, power = sp.power;
  const html = [], rolls = [];
  let kb = null, chain = null;
  const c0 = target.system.conditions ?? {};
  const ignitedBefore = igniteTotal(c0);
  const energyBefore = target.system.energy?.value ?? 0;
  const f = {
    ...facts, heatBefore: countFor(attacker, "heatDealt", target.uuid) > 0, energyZeroBefore: energyBefore <= 0,
    stainMore: false, energyZeroAfter: false
  };
  const ig = fx.ignitionPlan(ignitedBefore);
  const effects = profile.effects ?? [];

  // How many stacks the spell itself would apply (Force + Glob compares against this).
  const stainEffect = effects.find(e => e.stack && (e.stack.kind === "stain"));
  const stainWould = stainEffect ? fx.amountSpec(stainEffect.stack, dealt, power) : 0;
  f.stainMore = stainTotal(c0) > stainWould;

  let energyRemovedAmount = 0, stainsApplied = false;
  for (const e of effects) {
    if (e.at === "hit" || !fx.whenMet(e.when, f)) continue;
    if (e.stack) {
      let amount = fx.amountSpec(e.stack, dealt, power);
      if (e.stack.kind === "ignite" && m.ignition && ig.mult > 1) amount *= ig.mult;
      if (amount > 0) {
        const kind = fx.stainKindFor(e.stack.kind, m);
        const line = await giveStacks(target, kind, amount, { outcome: e.stack.where === "target" ? { toHp: 1, armorLoss: 0 } : outcome, caster: attacker });
        if (line) html.push(`<div class="fs-result">${line}</div>`);
        if (kind === "stain" || kind === "solid") { stainsApplied = true; await trackStain(target, attacker, amount); }
      }
    }
    if (e.energy) {
      let amount = fx.amountSpec(e.energy, dealt, power);
      if (m.frostbite) { const r = await roll(`${m.frostbite * power}d12`); rolls.push(r); amount += r.total; html.push(`<div class="fs-notes">Frostbite: +${r.total} Energy removed (${m.frostbite * power}d12)</div>`); }
      energyRemovedAmount = amount;
      const r = await removeEnergy(target, amount);
      f.energyZeroAfter = r.remaining <= 0;
      html.push(`<div class="fs-result">${esc(target.name)} loses <strong>${r.removed} Energy</strong> (${r.remaining} left).</div>`);
      // Chill (Cold T3): anytime the spell would remove Energy (even with none left) they take that much cold damage, Strengthened.
      if (m.chill) html.push(await dealDamage(target, applyStacks(amount, 1), "cold", { opts: { shroudCtx: ctx.dmgOpts?.shroudCtx } }));
    }
    if (e.extra) {
      const amount = Math.floor(e.extra.per * dealt);
      html.push(`<div class="fs-notes">${esc(DAMAGE_TYPES[e.extra.type] ?? e.extra.type)} damage on top: ${amount}${e.extra.bypass ? " (ignores armor)" : ""}</div>`);
      html.push(await dealDamage(target, amount, e.extra.type, { bypass: !!e.extra.bypass }));
    }
    if (e.force) {
      const fr = await spellForce(attacker, target, o, ctx.defense.result, { n: e.force.n * power, sides: e.force.sides }, "Force");
      html.push(fr.html); rolls.push(...fr.rolls); kb = fr.push ?? kb;
    }
    if (e.dodgeDis) {
      await putSpellEffect(target, { kind: "dodgeDis", caster: attacker.uuid, name: "Dodge Disadvantage", description: "Disadvantage on their dodge rolls until the start of the caster's next turn." });
      html.push(`<div class="fs-notes">${esc(target.name)} has Disadvantage on their dodge rolls until the start of your next turn.</div>`);
    }
    if (e.scorch) {
      await putSpellEffect(target, { kind: "scorch", caster: attacker.uuid, name: `Scorch (${dealt})`, amount: dealt, stack: true,
        description: `Takes ${dealt} heat damage every time they fail a dodge roll, until the start of the caster's next turn.` });
      html.push(`<div class="fs-notes">Scorch: ${esc(target.name)} takes ${dealt} heat damage again every time they fail a dodge roll until your next turn.</div>`);
    }
    if (e.chain && !(e.chain.needsEnergyZero && !f.energyZeroAfter && !f.energyZeroBefore)) chain = { adv: e.chain.adv, force: !!e.chain.force };
  }

  // Ignition (Heat T2): a target that already had Ignite has it triggered once everything else is done.
  if (m.ignition && ig.trigger) {
    const total = igniteTotal(target.system.conditions);
    if (total > 0) { html.push(`<div class="fs-notes">Ignition: ${total} Ignite stacks trigger.</div>`); html.push(await dealDamage(target, total, "heat")); }
  }
  // Catalyst (Acid T5): the Stains you applied to them deal their damage now.
  if (m.catalyst) {
    const mine = Math.min((target.getFlag?.("flowstate", "stainFrom") ?? {})[attacker.uuid] ?? 0, stainTotal(target.system.conditions));
    if (mine > 0) { html.push(`<div class="fs-notes">Catalyst: ${mine} of your Stain stacks go off.</div>`); html.push(await dealDamage(target, mine, "acid")); }
  }
  // Lightning Rod (Radiation T3): the primary target takes 1d10 radiation whenever another target takes damage from this spell.
  if (m["lightning rod"] && sp.chain?.primary && sp.chain.primary !== target.uuid) {
    const primary = await fromUuid(sp.chain.primary);
    if (primary) { const r = await roll(`${power}d10`); rolls.push(r); html.push(`<div class="fs-notes">Lightning Rod: ${esc(primary.name)} takes ${r.total} radiation.</div>`); html.push(await dealDamage(primary, r.total, "radiation")); }
  }
  // Per-turn counters (Cook, Electrify) and Heat + Crackle's static.
  if (type === "heat") await bump(attacker, "heatDealt", target.uuid);
  // Electrify counts only damage that Crackle (or a Combo with it) does.
  if (sp.cores.includes("magic-radiation:crackle")) await bump(attacker, "crackleHit", target.uuid);
  if (type === "heat" || type === "radiation") await staticOthers(attacker, target, html);
  return { html: html.join(""), rolls, kb, chain };
}

/** Heat + Crackle: any other target carrying the static gets Ignite when this target takes heat or radiation damage from your spells. */
async function staticOthers(attacker, damaged, html) {
  const seen = new Set();
  const actors = [...(globalThis.game?.actors ?? [])];
  for (const t of globalThis.canvas?.tokens?.placeables ?? []) if (!t.document.actorLink && t.actor) actors.push(t.actor);
  for (const a of actors) {
    if (a.uuid === damaged.uuid || seen.has(a.uuid)) continue;
    seen.add(a.uuid);
    for (const e of spellEffects(a, "heatRad")) {
      if (e.flags.flowstate.spellEffect.caster !== attacker.uuid) continue;
      const line = await giveStacks(a, "ignite", e.flags.flowstate.spellEffect.amount, { first: true, caster: attacker });
      if (line) html.push(`<div class="fs-notes">Static: ${line}</div>`);
    }
  }
}

/* -------------------------------------------- */
/*  Chains (Crackle and friends)                */
/* -------------------------------------------- */

/** The chain button's row for a damage card. `chain` = { adv, force }, `depth` = how many jumps so far. */
export function chainRow(attacker, chain, depth) {
  if (!chain) return "";
  const label = chain.adv < 0 ? `Chain (${depth + 1} Disadvantage)` : chain.adv > 0 ? "Chain (Advantage)" : "Chain";
  return `<div class="fs-brawl-row fs-chain-row" data-role="attacker" data-owner="${attacker.uuid}">
    <button type="button" class="fs-chain" data-tooltip="Chain to another target in range that this chain hasn't touched yet"><i class="fa-solid fa-bolt"></i> ${label}</button></div>`;
}

/**
 * Jump the spell to a new target: the same spell, a new attack roll with the chain's Advantage/Disadvantage, nobody twice.
 * `message` is the damage card that offered the chain.
 */
export async function chainNext(message, preset = null) {
  const dm = message.getFlag("flowstate", "damage"), df = message.getFlag("flowstate", "defense"), ch = message.getFlag("flowstate", "chain");
  if (!(dm || df) || !ch) return;
  const key = `${message.id}:chain`;
  if (globalThis.game.messages.find(m => m.getFlag("flowstate", "attack")?.opts?.shroudCounterOf === key)) return ui.notifications.info("Already chained.");
  const attackerUuid = dm?.attacker ?? df.attacker, targetUuid = dm?.target ?? df.target;
  const attackMessageId = df ? df.attackMessage : globalThis.game.messages.get(dm.defenseMessage)?.getFlag("flowstate", "defense")?.attackMessage;
  const attacker = await fromUuid(attackerUuid);
  if (!attacker?.isOwner) return ui.notifications.warn("Only the caster can chain it.");
  const o = globalThis.game.messages.get(attackMessageId)?.getFlag("flowstate", "attack")?.opts;
  if (!o) return;
  const picked = await pickSceneTarget(attacker, { title: "Chain to", within: 200, anchors: [attackerToken(attacker)], exclude: [...(ch.affected ?? []), attacker.uuid], preset });
  if (!picked) return;
  const depth = (ch.depth ?? 0) + 1;
  const net = ch.adv < 0 ? -depth : ch.adv > 0 ? 1 : 0;
  const sp = { ...o.spell, exploit: null, telegraph: null, ritualOf: null, chain: { affected: [...(ch.affected ?? []), picked.uuid], depth, primary: ch.primary ?? targetUuid, adv: ch.adv, force: ch.force } };
  return performAttack(attacker, { ...o, net, notes: [ch.adv < 0 ? `Chain: ${depth} Disadvantage` : ch.adv > 0 ? "Chain: Advantage" : "Chain"], targetActors: [picked], spell: sp, shroudCounterOf: key, followups: [] });
}

/* -------------------------------------------- */
/*  Wiring                                      */
/* -------------------------------------------- */

registerElemental({ onHit, afterDamage, beforeApply, brandExtra, chainRow, countFor, removeEnergy, chainNext });
