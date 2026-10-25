/**
 * Earth (Dream) and Sea (Nightmare) (Mental Rework Test Ground).
 *  Earth: Accretion (an encasement: an object with Durability and a Limit that soaks Physical and Elemental damage before the creature, melding with your
 *  own Accretions on the same target), Adamant (Tenet: Pain Threshold lowered), Reinforce and Bedrock (asked when damage is about to hit one of your
 *  Accretions), Ejecta (throw an Accretion), Batholith (any damage category; Ejecta reaches magical and Supernatural creatures).
 *  Sea: Undertow (damage whenever they move, or something other than your Sea moves them), Surge (Tenet) and Current (short forced moves), Riptide,
 *  Shoal (Strengthened against prone targets) and Drown (health loss after enough forced movement this turn; Enhanced: a Concentration that keeps them down).
 * They register into wonders.mjs (`MODES`, `ACTS`, the provider lists); mental.mjs hands `encasements`, `accretionAsk`, `accretionWorn`, `forcedMove`,
 * `voluntaryMove` and `standUp` to actions.mjs through `registerMental`, and calls `ejectaResolve` / `escapeResolve` from its resolve step.
 */
import { post, putSpellEffect, spellEffects, changeEffect, setActorFlag, attackerToken, tokenDistance, requestDamage, damageOutcome, damageOutcomeHTML, setStatus, knockbackRow } from "./actions.mjs";
import { reevaluate } from "./arcana.mjs";
import { removeEnergy } from "./elemental.mjs";
import { damageCategories } from "./martial.mjs";
import { applyStacks, DAMAGE_TYPES } from "./rules.mjs";
import * as ab from "./abilities.mjs";
import * as concentration from "./concentration.mjs";
import { askFor, everyActor } from "./ask.mjs";
import { isDeclined } from "./reactions.mjs";
import { tierOf } from "./skills.mjs";
import { mental, bold, MODES, ACTS, ACT_PROVIDERS, CHOICE_PROVIDERS, TURN_START, BEFORE_CLEAR, rolled, tenetsOf, tryOnce, actButtons } from "./wonders.mjs";
import { notCreature } from "./kinds.mjs";
import { esc } from "./html.mjs";

export const EARTH = "mental-earth-dream", SEA = "mental-sea-nightmare";
/** Sea's moves and Drown's threshold: fixed feet (the doc no longer bolds them, so Power and stacks don't change them). */
export const SEA_MOVE_FT = 5, DROWN_FT = 10;
const ACCRETION = `${EARTH}:accretion`, UNDERTOW = `${SEA}:undertow`, RIPTIDE = `${SEA}:riptide`, DROWN = `${SEA}:drown`;
const tier = (actor, id) => tierOf(actor?.system?.trees ?? {}, id);
const minOf = (a, k) => ab.statMinOf(a, k);
const fromU = u => (u ? globalThis.fromUuidSync?.(u) ?? null : null);
const dataOf = e => e.flags.flowstate.spellEffect;
const live = a => a && !notCreature(a);
const roll = formula => new Roll(formula).evaluate();
const typeLabel = t => DAMAGE_TYPES[t] ?? t;
export const CATEGORIES = { physical: "Physical", elemental: "Elemental", magical: "Magical", supernatural: "Supernatural" };

/* -------------------------------------------- */
/*  Earth: Accretion                            */
/* -------------------------------------------- */

/** An encasement's Limit: a fifth of the Durability it was made with (it doesn't wear down with the Durability, like any object's). */
export const accretionLimit = durability => Math.floor((Number(durability) || 0) / 5);
const accName = (hp, limit) => `Accretion (${hp} Durability, Limit ${limit})`;
function accText(caster, d) {
  const cats = tier(caster, EARTH) >= 4 ? "any" : "Physical or Elemental";
  const weak = (d.weak ?? []).length ? ` ${d.weak.map(k => CATEGORIES[k] ?? k).join(" and ")} damage dealt to it is Weakened.` : "";
  return `An encasement ${caster?.name ?? "an Earth user"} made: attacks strike it first. It absorbs up to its Limit (${d.limit}) of each ${cats} hit, losing that much Durability (${d.hp} left); the rest passes through.${weak} Until the start of ${caster?.name ?? "the caster"}'s next turn.`;
}

/** Enhanced Accretion: the damage category it Weakens is picked on Manifest. */
CHOICE_PROVIDERS.push((actor, modeId) => (modeId === ACCRETION ? [{ name: "category", label: "If Enhanced: damage of this category dealt to it is Weakened", options: CATEGORIES }] : []));

MODES[ACCRETION] = async c => {
  if (!live(c.target)) return `<strong>Accretion</strong> needs a creature to encase.`;
  const add = bold(c.bs, 50 * c.power), lim = accretionLimit(add);
  const cat = c.enhanced && CATEGORIES[c.choices?.category] ? c.choices.category : null;
  // Your Accretions on the same target meld into one encasement: Durability and Limit are the sums of their parts.
  const mine = spellEffects(c.target, "accretion").find(e => dataOf(e).caster === c.attacker.uuid);
  if (mine) {
    const d = dataOf(mine);
    const next = { hp: (Number(d.hp) || 0) + add, max: (Number(d.max) || 0) + add, limit: (Number(d.limit) || 0) + lim, weak: [...new Set([...(d.weak ?? []), ...(cat ? [cat] : [])])] };
    await changeEffect(mine, { "flags.flowstate.spellEffect.hp": next.hp, "flags.flowstate.spellEffect.max": next.max, "flags.flowstate.spellEffect.limit": next.limit, "flags.flowstate.spellEffect.weak": next.weak,
      name: accName(next.hp, next.limit), description: accText(c.attacker, next) });
    return `The Accretion on <strong>${esc(c.target.name)}</strong> grows by <strong>${add}</strong> Durability (Limit +${lim}): now ${next.hp} Durability, Limit ${next.limit}${cat ? `; ${CATEGORIES[cat]} damage to it is Weakened` : ""}.`;
  }
  const d = { hp: add, max: add, limit: lim, weak: cat ? [cat] : [] };
  await putSpellEffect(c.target, { kind: "accretion", stack: true, caster: c.attacker.uuid, mode: ACCRETION, power: c.power, bstacks: c.bs, ...d, name: accName(add, lim), description: accText(c.attacker, d) });
  return `<strong>${esc(c.target.name)}</strong> is encased: an Accretion with <strong>${add}</strong> Durability and a Limit of ${lim}, struck before them by ${tier(c.attacker, EARTH) >= 4 ? "any" : "Physical and Elemental"} damage${cat ? `; ${CATEGORIES[cat]} damage to it is Weakened` : ""}, until the start of your next turn.`;
};

/**
 * The encasements a hit on this creature meets (for damageOutcome): its Accretions, each an object with a Limit and Durability. They only take Physical and
 * Elemental damage, any category with their caster's Batholith (Earth T4). `picks` are the Reinforce / Bedrock answers for this hit (`accretionAsk`).
 */
export function encasements(actor, type, magic = false, picks = null) {
  const cats = damageCategories(type, magic);
  const out = [];
  for (const e of spellEffects(actor, "accretion")) {
    const d = dataOf(e), hp = Number(d.hp) || 0;
    if (hp <= 0) continue;
    if (tier(fromU(d.caster), EARTH) < 4 && !cats.some(k => k === "physical" || k === "elemental")) continue;
    out.push({ effect: e, name: "Accretion", hp, limit: Number(d.limit) || 0, weakened: (d.weak ?? []).some(k => cats.includes(k)),
      reinforce: !!picks?.reinforce?.includes(e.id), bedrock: !!picks?.bedrock?.includes(e.id) });
  }
  return out;
}

/**
 * Reinforce (T2: its Limit is its whole remaining Durability for this hit, for half the PON min in Energy) and Bedrock (T5: what gets past the Limit costs the
 * encasement twice that much Durability instead of reaching the creature): asked of the Earth user when damage bigger than the Limit is about to hit one of
 * their Accretions. Returns the picks for damageOutcome (empty when nothing was asked, so it isn't asked again).
 */
export async function accretionAsk(actor, amount, type, magic = false) {
  const picks = { reinforce: [], bedrock: [] };
  for (const a of encasements(actor, type, magic)) {
    if (!(amount > a.limit)) continue;                            // the Limit takes all of it already
    const caster = fromU(dataOf(a.effect).caster);
    const canR = tier(caster, EARTH) >= 2, canB = tier(caster, EARTH) >= 5;
    if (!caster || (!canR && !canB)) continue;
    const cost = Math.floor(minOf(caster, "pon") / 2);
    const ans = await askFor(caster, { react: "accretion", title: `Accretion on ${actor.name}`, ok: "Use", html: `<p>${amount} ${esc(typeLabel(type))} damage is about to strike your Accretion on <strong>${esc(actor.name)}</strong> (${a.hp} Durability, Limit ${a.limit}).</p>
      ${canR ? `<label class="fs-cast-mod"><input type="checkbox" name="reinforce"> <strong>Reinforce</strong> <small>⚡ ${cost}: its Limit is its full remaining Durability (${a.hp}) for this hit</small></label>` : ""}
      ${canB ? `<label class="fs-cast-mod"><input type="checkbox" name="bedrock"> <strong>Bedrock</strong> <small>what gets past its Limit costs it twice that much Durability instead of reaching ${esc(actor.name)}</small></label>` : ""}` });
    if (ans?.reinforce && await mental.pay(caster, { energy: cost }, "Reinforce")) picks.reinforce.push(a.effect.id);
    if (ans?.bedrock && canB) picks.bedrock.push(a.effect.id);
  }
  return picks;
}

/** An Accretion took damage: its Durability goes down, and at 0 it crumbles. */
export async function accretionWorn(effect, hp) {
  const d = dataOf(effect);
  if (hp > 0) return changeEffect(effect, { "flags.flowstate.spellEffect.hp": hp, name: accName(hp, d.limit), description: accText(fromU(d.caster), { ...d, hp }) });
  await changeEffect(effect, null);
  const holder = effect.parent;
  if (holder) await post(holder, { title: `${esc(holder.name)} — Accretion`, body: `<div class="fs-notes">The Accretion on ${esc(holder.name)} crumbles away.</div>` });
}

/** Your Accretions on creatures in play: [{ effect, holder }]. */
export function accretionsOf(caster) {
  const out = [];
  for (const a of everyActor()) for (const e of spellEffects(a, "accretion")) if (dataOf(e).caster === caster.uuid && (Number(dataOf(e).hp) || 0) > 0) out.push({ effect: e, holder: a });
  return out;
}

/* -------------------------------------------- */
/*  Earth: Ejecta (T3), Batholith (T4)          */
/* -------------------------------------------- */

/** The damage Ejecta deals to this target: physical; with Batholith, Arcane to a fully magical creature and Supernatural to a Supernatural one. */
const ejectaType = (caster, target) => (tier(caster, EARTH) >= 4 ? (target.system?.supernatural ? "supernatural" : target.system?.magical ? "arcane" : "physical") : "physical");

/** Ejecta (Earth T3, any time, free): consume one of your Accretions to throw it at a creature within 100 ft of it: an attack roll, a fifth of its Durability on a hit. */
export async function ejecta(caster) {
  if (tier(caster, EARTH) < 3) return ui.notifications.warn("Ejecta is an Earth Tier 3 action.");
  const mine = accretionsOf(caster);
  if (!mine.length) return ui.notifications.info(`${caster.name} has no Accretion to throw.`);
  const pickUuid = mine.length === 1 ? mine[0].effect.uuid : await mental.pickChoice(caster, "Ejecta: which Accretion", mine.map(x => [x.effect.uuid, `On ${x.holder.name} (${dataOf(x.effect).hp} Durability)`]));
  const pick = mine.find(x => x.effect.uuid === pickUuid);
  if (!pick) return null;
  const from = attackerToken(pick.holder);
  const targeted = [...(game.user?.targets ?? [])].map(t => t.actor).filter(live);
  const target = targeted.length === 1 ? targeted[0] : await mental.pickAnother(caster, { title: "Ejecta: throw it at", anchors: [from], within: 100 });
  if (!target) return null;
  const tTok = attackerToken(target);
  if (from && tTok && globalThis.canvas?.grid && tokenDistance(from, tTok) > 100) return ui.notifications.warn(`${target.name} is more than 100 ft from the Accretion on ${pick.holder.name}.`);
  if ((target.system?.magical || target.system?.supernatural) && tier(caster, EARTH) < 4) return ui.notifications.warn(`Ejecta can't target a fully magical or Supernatural creature (Batholith, Earth Tier 4, lets it).`);
  const amount = Math.floor((Number(dataOf(pick.effect).hp) || 0) / 5), type = ejectaType(caster, target);
  await changeEffect(pick.effect, null);
  return mental.specialAttack(caster, target, { label: "Ejecta", notes: [`Ejecta: the Accretion on ${pick.holder.name} is thrown (${amount} ${typeLabel(type)} damage on a hit)`], flag: { ejecta: { amount, type, from: pick.holder.uuid } } });
}

export async function ejectaResolve({ attacker, target, result, m }) {
  if (!result.hit) return { html: `<div class="fs-notes">The Ejecta misses ${esc(target.name)} and breaks apart.</div>` };
  const crit = result.critStacks ?? (result.crit ? 2 : 0);
  const n = applyStacks(m.ejecta.amount, crit), type = m.ejecta.type;
  const outcome = await damageOutcome(target, n, type);
  await requestDamage(target, n, type, 0, null, { silent: true, shroudCtx: { attacker: attacker.uuid } });
  return { html: `<div class="fs-result"><i class="fa-solid fa-meteor"></i> Ejecta hits ${esc(target.name)}: <strong>${n}</strong> ${esc(typeLabel(type))} damage${crit ? " (critical)" : ""}.</div>${damageOutcomeHTML(target, n, type, outcome)}` };
}

/* -------------------------------------------- */
/*  Earth and Sea Tenets: Adamant, Surge        */
/* -------------------------------------------- */

ACT_PROVIDERS.push(async c => {
  const a = c.attacker, out = [];
  if (c.m.spread || c.now) return out;
  for (const tn of tenetsOf(a)) {
    const base = { target: c.target.uuid, caster: a.uuid, mode: c.mode.id, power: c.power, enhanced: !!c.enhanced, range: c.range, choices: c.choices ?? {}, crit: !!c.crit, bstacks: c.bs ?? c.stacks ?? 0, mult: tn.mult };
    if (tn.id === `${EARTH}:adamant`) out.push({ tenet: true, id: "adamant", label: "Adamant", tip: `Once per round: lower the target's or your own Pain Threshold by ${bold(base.bstacks, 10 * tn.mult)} until your next turn`, cost: "once per round", ...base });
    if (tn.id === `${SEA}:surge`) out.push({ tenet: true, id: "surge", label: "Surge", tip: `Once per round: move the target up to ${SEA_MOVE_FT} ft horizontally in a direction of your choosing (ignores Force and Lift)`, cost: "once per round", ...base });
  }
  return out;
});

/** Adamant: −10 × the Tenet's multiplier to someone's Pain Threshold until your next turn (a lower Threshold may wake them). */
ACTS.adamant = async (x, caster, target) => {
  if (!(await tryOnce(caster, "adamant"))) { ui.notifications.info("Adamant: already used this round."); return false; }
  const n = bold(x.bstacks ?? 0, 10 * (x.mult ?? 1));
  const who = await mental.pickOne(caster, [target, caster], `Adamant: lower the Pain Threshold by ${n}`);
  if (!who) return false;
  await putSpellEffect(who, { kind: "adamant", stack: true, caster: caster.uuid, mode: `${EARTH}:adamant`, painDown: n, name: `Adamant (−${n} Pain Threshold)`,
    description: `Pain Threshold lowered by ${n} until the start of ${caster.name}'s next turn.` });
  await reevaluate(who);
  await post(caster, { title: `${esc(caster.name)} — Adamant`, body: `<div class="fs-result"><strong>${esc(who.name)}</strong>'s Pain Threshold is lowered by <strong>${n}</strong> until the start of ${esc(caster.name)}'s next turn.</div>` });
  return true;
};

/**
 * Adamant ends with the rest of your effects as your turn starts: the creatures it was on are checked again (the Threshold going back up can knock them out).
 * Reapplying it with a reaction right then brings them back round (applying it re-checks too), so they don't stay unconscious from the change.
 */
const adamantEnding = new Map();
BEFORE_CLEAR.push(async actor => {
  const holders = everyActor().filter(a => spellEffects(a, "adamant").some(e => dataOf(e).caster === actor.uuid));
  if (holders.length) adamantEnding.set(actor.uuid, holders.map(a => a.uuid));
});
TURN_START.push(async actor => {
  const list = adamantEnding.get(actor.uuid);
  if (!list) return;
  adamantEnding.delete(actor.uuid);
  for (const u of list) {
    const a = fromU(u);
    if (!a) continue;
    await reevaluate(a);
    const hp = a.system.hp.value, pain = a.system.hp.pain;
    if (hp > 0 && hp < pain) await post(actor, { title: `${esc(actor.name)} — Adamant`, body: `<div class="fs-notes">Adamant on ${esc(a.name)} ends: their Pain Threshold is back to ${pain} and they fall unconscious (${hp} health). Reapplying Adamant with a reaction now (a Manifest that hits) brings them back round.</div>` });
  }
});

/** Surge: once per round, a short forced move of the target. */
ACTS.surge = async (x, caster, target) => {
  if (!target) return false;
  if (!(await tryOnce(caster, "surge"))) { ui.notifications.info("Surge: already used this round."); return false; }
  await seaPush(caster, target, SEA_MOVE_FT, "Surge");
  return true;
};

/* -------------------------------------------- */
/*  Sea: forced movement                        */
/* -------------------------------------------- */

/**
 * A Sea move (Surge, Current, Riptide): a card with a direction button for the caster. It ignores Force and Lift: the feet are what the Mode says, the caster
 * may move them less, and it doesn't set off their own Undertow.
 */
export async function seaPush(caster, target, feet, label, extra = {}) {
  if (!(feet > 0)) return post(caster, { title: `${esc(caster.name)} — ${label}`, body: `<div class="fs-notes">${label}: no distance to move ${esc(target.name)}.</div>` });
  const push = { attacker: caster.uuid, target: target.uuid, force: 0, feet, label, sea: caster.uuid, upTo: true, ...extra };
  return post(caster, { title: `${esc(caster.name)} — ${label}`, body: `<div class="fs-result">${label}: ${esc(target.name)} can be moved up to <strong>${feet} ft</strong>${extra.toward ? ` toward ${esc(fromU(extra.toward)?.name ?? "the other target")}` : " in a direction of your choosing"} (ignores Force and Lift).</div>${knockbackRow(caster.uuid, feet, label)}`,
    flags: { flowstate: { knockback: push } } });
}

/** How far a creature was forcefully moved since a time (Date.now() stamps, like the caster's `turnStartedAt`). */
export const forcedSince = (actor, since = 0) => (actor?.getFlag?.("flowstate", "forcedLog") ?? []).filter(x => x.at >= since).reduce((n, x) => n + (Number(x.ft) || 0), 0);

/**
 * A creature was forcefully moved `feet` (thrown, knocked back, pulled, dragged): Drown keeps count, and an Undertow on it triggers unless it was the
 * Undertow caster's own Sea effect that moved it (`source` = "sea:<caster uuid>").
 */
export async function forcedMove(actor, feet, source = null) {
  if (!live(actor) || !(feet > 0)) return;
  const log = [...(actor.getFlag?.("flowstate", "forcedLog") ?? []), { at: Date.now(), ft: Math.round(feet) }].slice(-30);
  await setActorFlag(actor, "forcedLog", log);
  await undertowTrigger(actor, source);
}

/** A creature moved itself in combat (spent its movement): its Undertows trigger. */
export async function voluntaryMove(actor) {
  if (spellEffects(actor, "undertow").length) await undertowTrigger(actor, null);
}

/* -------------------------------------------- */
/*  Sea: Undertow, Current, Shoal               */
/* -------------------------------------------- */

/** Shoal (Sea T4): damage and health loss from your Sea Modes are Strengthened against a prone target (not Force damage). */
const shoalOn = (caster, target) => !!caster && tier(caster, SEA) >= 4 && !!target?.statuses?.has("prone");
const currentFt = () => SEA_MOVE_FT;

/** Current (Sea T2): offered on the card whenever a creature takes damage or loses health from one of your Sea Modes. */
function currentActs(caster, target, d) {
  if (!caster || tier(caster, SEA) < 2 || !live(target) || isDeclined(caster, "current")) return [];
  return [{ id: "current", label: `Current on ${target.name}`, tip: `Move them up to ${currentFt()} ft in a direction of your choosing (ignores Force and Lift)`, cost: `⚡ ${minOf(caster, "snap")}`,
    caster: caster.uuid, target: target.uuid, power: d.power ?? 1, bstacks: d.bstacks ?? 0 }];
}
ACTS.current = async (x, caster, target) => {
  if (!target) return false;
  if (!(await mental.pay(caster, { energy: minOf(caster, "snap") }, "Current"))) return false;
  await seaPush(caster, target, currentFt(), "Current");
  return true;
};

MODES[UNDERTOW] = async c => {
  if (!live(c.target)) return `<strong>Undertow</strong> needs a creature.`;
  const type = c.enhanced ? "cold" : "physical";
  await putSpellEffect(c.target, { kind: "undertow", stack: true, caster: c.attacker.uuid, mode: UNDERTOW, power: c.power, bstacks: c.bs, enhanced: !!c.enhanced, name: `Undertow (${c.power}d8 ${typeLabel(type)})`,
    description: `Engulfed in flowing water: whenever they spend AP to move, or something other than ${c.attacker.name}'s Sea effects forcefully moves them, they take ${c.power}d8 ${typeLabel(type)} damage${c.enhanced ? " and lose Energy equal to the direct damage" : ""}. Until the start of ${c.attacker.name}'s next turn.` });
  return `<strong>${esc(c.target.name)}</strong> is engulfed in flowing water until the start of your next turn: moving, or being moved by anything but your Sea, deals <strong>${c.power}d8 ${typeLabel(type)}</strong>${c.enhanced ? " and drains that much Energy" : ""}.`;
};

/** An Undertow on `actor` triggers (once per Undertow): roll its damage, deal it, drain Energy when Enhanced, and offer Current. */
async function undertowTrigger(actor, source = null) {
  for (const e of spellEffects(actor, "undertow")) {
    const d = dataOf(e);
    if (source && source === `sea:${d.caster}`) continue;
    const caster = fromU(d.caster);
    const type = d.enhanced ? "cold" : "physical";
    const r = await roll(`${d.power ?? 1}d8`);
    let n = bold(d.bstacks ?? 0, r.total);
    const shoal = shoalOn(caster, actor);
    if (shoal) n = applyStacks(n, 1);
    const outcome = await damageOutcome(actor, n, type);
    const res = await requestDamage(actor, n, type, 0, null, { wantResult: true, silent: true, shroudCtx: { attacker: d.caster } });
    const direct = res?.toHp ?? outcome.toHp;
    let drain = "";
    if (d.enhanced && direct > 0) { const rm = await removeEnergy(actor, direct); drain = `<div class="fs-result">${esc(actor.name)} loses <strong>${rm.removed} Energy</strong> (${rm.remaining} left).</div>`; }
    const acts = currentActs(caster, actor, d);
    await post(caster ?? actor, { title: `${esc(actor.name)} — Undertow`, rolls: [r], body: `<div class="fs-result"><i class="fa-solid fa-water"></i> ${esc(actor.name)} ${source ? "is moved" : "moves"} in the Undertow: ${d.power ?? 1}d8 = ${r.total}${n !== r.total ? ` → ${n}` : ""} ${esc(typeLabel(type))}${shoal ? " (Shoal: prone, Strengthened)" : ""}.</div>${damageOutcomeHTML(actor, n, type, outcome)}${drain}${actButtons(acts)}`,
      flags: acts.length ? { flowstate: { mentalAct: { acts } } } : {} });
  }
}

/* -------------------------------------------- */
/*  Sea: Riptide (T3)                           */
/* -------------------------------------------- */

/**
 * Riptide: on a hit the target can be moved up to 5 ft toward or away from a point you choose; if the move causes Force damage (a wall), it deals Power d6 more
 * (scaled by the Manifest's stacks). Enhanced with a second target (the Manifest's targets
 * in the order they were picked): the first is pulled toward the second, and the second (if it's hit too) toward the first.
 */
MODES[RIPTIDE] = async c => {
  if (!live(c.target)) return `<strong>Riptide</strong> needs a creature.`;
  const feet = SEA_MOVE_FT;
  const others = c.enhanced ? (c.m.targets ?? []).filter(u => u !== c.target.uuid) : [];
  const other = others.length ? fromU(others[0]) : null;
  const push = { attacker: c.attacker.uuid, target: c.target.uuid, force: 0, feet, label: "Riptide", sea: c.attacker.uuid, upTo: true, ...(other ? { toward: other.uuid } : {}),
    extraForce: { dice: c.power, sides: 6, bstacks: c.bs ?? 0 } };          // "deals 1d6 more Force damage" if the move causes any
  const html = other ? `<strong>${esc(c.target.name)}</strong> is pulled up to <strong>${feet} ft</strong> toward ${esc(other.name)} (ignores Force and Lift).`
    : `<strong>${esc(c.target.name)}</strong> can be moved up to <strong>${feet} ft</strong> toward or away from a point of your choosing (ignores Force and Lift; if it causes Force damage, ${c.power}d6 more).`;
  return { html: `${html}${knockbackRow(c.attacker.uuid, feet, "Riptide")}`, push };
};

/* -------------------------------------------- */
/*  Sea: Drown (T5)                             */
/* -------------------------------------------- */

/** Drown's health loss: 2d8 × Power, reduced by what blocks Supernatural damage (Temp HP, shielding, Shrouds, Wards); Strengthened by Shoal. */
async function drownLoss(caster, target, power, bs) {
  const r = await roll(`${2 * power}d8`);
  let n = bold(bs ?? 0, r.total);
  const shoal = shoalOn(caster, target);
  if (shoal) n = applyStacks(n, 1);
  const outcome = await damageOutcome(target, n, "supernatural", { archetype: "magic" });
  const res = await requestDamage(target, n, "supernatural", 0, null, { wantResult: true, silent: true, archetype: "magic", shroudCtx: { source: "type:supernatural", attacker: caster.uuid } });
  const lost = res?.toHp ?? outcome.toHp;
  return { r, lost, html: ` They lose <strong>${lost}</strong> health (${2 * power}d8 = ${r.total}${n !== r.total ? ` → ${n}` : ""}${shoal ? ", Shoal: Strengthened" : ""}${lost < n ? `, ${n - lost} blocked` : ""}).` };
}

MODES[DROWN] = async c => {
  const t = c.target, caster = c.attacker;
  if (!live(t)) return `<strong>Drown</strong> needs a creature.`;
  await setStatus(t, "prone", true);
  const need = DROWN_FT;
  const moved = forcedSince(t, Number(caster.getFlag?.("flowstate", "turnStartedAt")) || 0);
  let html = `<strong>${esc(t.name)}</strong> is knocked prone as water fills their lungs.`;
  if (moved >= need) {
    const loss = await drownLoss(caster, t, c.power, c.bs);
    rolled.push(loss.r);
    html += ` They were forcefully moved ${moved} ft this turn (${need} needed).${loss.html}`;
    const acts = currentActs(caster, t, { power: c.power, bstacks: c.bs });
    if (acts.length && loss.lost > 0) await post(caster, { title: `${esc(caster.name)} — Drown`, body: actButtons(acts), flags: { flowstate: { mentalAct: { acts } } } });
  } else html += ` They were forcefully moved ${moved} ft this turn, short of the ${need} ft it needs: no damage.`;
  if (c.enhanced) {
    const id = `drown:${foundry.utils.randomID?.() ?? String(Math.random()).slice(2)}`;
    if (await concentration.begin(caster, { id, label: `Drown on ${t.name}` })) {
      await putSpellEffect(t, { kind: "drowning", stack: true, persistent: true, caster: caster.uuid, concentration: id, mode: DROWN, power: c.power, bstacks: c.bs, need, name: "Drowning",
        description: `Kept prone by ${caster.name}'s Drown (Concentration). At the start of each of ${caster.name}'s turns they lose ${2 * c.power}d8 health if they were forcefully moved ${need} ft since the start of ${caster.name}'s last turn; otherwise it ends. Getting up costs 1 AP and an attack roll against ${caster.name}: a hit ends it.` });
      html += ` You concentrate on it: they stay down, losing that health at the start of each of your turns while they keep being moved ${need} ft a turn.`;
    }
  }
  return html;
};

/** Drown (Enhanced): at the start of each of the caster's turns, enough forced movement since their last turn costs the target that health again; else it ends. */
TURN_START.push(async actor => {
  const since = Number(actor.getFlag?.("flowstate", "turnStartedAt")) || 0;          // still the start of their last turn: it's stamped after this runs
  for (const a of everyActor()) for (const e of spellEffects(a, "drowning")) {
    const d = dataOf(e);
    if (d.caster !== actor.uuid) continue;
    const moved = forcedSince(a, since);
    if (moved < d.need) { await concentration.end(actor, d.concentration, `${a.name} was forcefully moved ${moved} ft since your last turn, not the ${d.need} it needs`); continue; }
    const loss = await drownLoss(actor, a, d.power ?? 1, d.bstacks ?? 0);
    const acts = loss.lost > 0 ? currentActs(actor, a, d) : [];
    await post(actor, { title: `${esc(a.name)} — Drowning`, rolls: [loss.r], body: `<div class="fs-result"><i class="fa-solid fa-water"></i> ${esc(a.name)} was forcefully moved ${moved} ft since ${esc(actor.name)}'s last turn and is still drowning.${loss.html}</div>${actButtons(acts)}`,
      flags: acts.length ? { flowstate: { mentalAct: { acts } } } : {} });
  }
});

/** Getting up while Drowning (Enhanced): 1 AP and an attack roll against the drowner, no damage; only a hit ends it. Returns true when it took over. */
export async function standUp(actor) {
  const e = spellEffects(actor, "drowning")[0];
  if (!e) return false;
  const caster = fromU(dataOf(e).caster);
  if (!caster) { await changeEffect(e, null); return false; }
  if (!(await mental.pay(actor, { ap: 1 }, "getting up"))) return true;
  await mental.specialAttack(actor, caster, { label: "Get up (Drowning)", notes: [`${actor.name} tries to get up: a hit ends the Drown (no damage)`], flag: { escape: { effect: e.uuid } } });
  return true;
}

export async function escapeResolve({ attacker, target, result, m }) {
  if (!result.hit) return { html: `<div class="fs-notes">${esc(attacker.name)} can't get up: still drowning, still prone.</div>` };
  const e = await fromUuid(m.escape.effect);
  const d = e ? dataOf(e) : null;
  if (d?.concentration) await concentration.end(fromU(d.caster) ?? target, d.concentration, `${attacker.name} got up`);
  else if (e) await changeEffect(e, null);
  await setStatus(attacker, "prone", false);
  return { html: `<div class="fs-result"><i class="fa-solid fa-person"></i> ${esc(attacker.name)} breaks the surface and gets up: the Drown ends.</div>` };
}
