/**
 * What each Wonder's Modes, Tenets and abilities do (Mental Rework Test Ground). mental.mjs calls `resolveMode` when a Manifest is answered;
 * the optional bits ("you can...", Tenets, abilities that cost energy) come as buttons on a follow-up card owned by the Mental user
 * (`acts`, run by `runAct`), the same way Poison and Hex do it. Things that happen "at the start of the target's next turn" are `pending`
 * effects on the target that turn into the real effect when their turn starts (`pendingTurnStart`).
 */
import {
  post, requestGM, putSpellEffect, spellEffects, changeEffect, setActorFlag, requestDamage, performAttack, knockbackRow, setGrapple, clearSpellEffects
} from "./actions.mjs";
import { lossSince, setHp, reevaluate, healingDown } from "./arcana.mjs";
import { askFor, runOnOwner } from "./charges.mjs";
import { resolveForce, applyStacks } from "./rules.mjs";
import * as R from "./mental-rules.mjs";
import * as ab from "./abilities.mjs";
import { tierOf } from "./skills.mjs";
import * as mental from "./mental.mjs";

export const bold = R.bold;

const esc = s => foundry.utils.escapeHTML?.(String(s)) ?? String(s);
const roll = formula => new Roll(formula).evaluate();
const eff = (a, k) => a?.system?.derived?.effective?.[k]?.value ?? 0;
const minOf = (a, k) => ab.statMinOf(a, k);
const tier = (actor, id) => tierOf(actor.system.trees ?? {}, id);
const living = a => a && a.type !== "pile" && !a.system?.magical;

/* -------------------------------------------- */
/*  Shared: effects, once per round, Tenets     */
/* -------------------------------------------- */

const roundKey = () => (globalThis.game?.combat?.started ? `${game.combat.id}:${game.combat.round}` : "ooc");
/** How many times a Tenet can trigger per round: once, or twice with 3 Alignment of the Tenet's type. */
export function tenetUses(actor) {
  const tn = tenetOf(actor);
  if (!tn) return 1;
  return R.tenetUses(actor.getFlag?.("flowstate", "alignment"), R.wonderById(tn.wonder)?.kind);
}
/** Has this actor already used this "once per round" thing this round (Tenets: as many times as they may per round)? */
export function onceUsed(actor, id) {
  const cur = actor.getFlag?.("flowstate", "mentalOnce");
  return cur?.round === roundKey() && cur.ids.filter(x => x === id).length >= tenetUses(actor);
}
export async function markOnce(actor, id) {
  const cur = actor.getFlag?.("flowstate", "mentalOnce");
  const key = roundKey();
  const ids = cur?.round === key ? cur.ids : [];
  if (ids.filter(x => x === id).length < tenetUses(actor)) await setActorFlag(actor, "mentalOnce", { round: key, ids: [...ids, id] });
}
/** "Once per round": true (and marked) the first time per round for this actor and id. */
export async function tryOnce(actor, id) {
  if (onceUsed(actor, id)) return false;
  await markOnce(actor, id);
  return true;
}

/** The attuned Icon's Tenet for this caster: { id, wonder, mult } or null. */
export function tenetOf(actor) {
  const icon = actor?.system?.icon;
  const p = icon?.system?.profile;
  if (!p?.valid || !p.tenet || !icon.system.tenet) return null;
  return { id: icon.system.tenet, wonder: p.tenet.wonder, mult: p.tenet.mult };
}

const putTemp = (who, caster, n, why) => putSpellEffect(who, { kind: "tempHP", caster: caster.uuid, name: `Temp HP (${n})`, hp: n, max: n, mode: why,
  description: `Absorbs the next ${n} damage that would reach HP. Until the start of ${caster.name}'s next turn.` });
const putPending = (who, caster, label, then) => putSpellEffect(who, { kind: "pending", stack: true, onTargetTurn: true, caster: caster.uuid, name: `${label} (starts on ${who.name}'s next turn)`, then,
  description: `Takes hold at the start of the creature's next turn.` });

/** What a delayed effect turns into when the target's turn starts. */
async function runThen(actor, caster, then) {
  const who = caster?.name ?? "someone";
  if (then.type === "tempHP") return putTemp(actor, caster, then.n, then.mode);
  if (then.type === "dodgeUp") return putSpellEffect(actor, { kind: "dodgeUp", caster: caster.uuid, name: `Flourish (+${then.power ?? 1} dodge die size)`, dodgeDieUp: then.power ?? 1, mode: then.mode,
    description: `Dodge dice are ${then.power ?? 1} size${(then.power ?? 1) === 1 ? "" : "s"} bigger until the start of ${who}'s next turn. Doesn't stack.` });
  if (then.type === "heal") {
    const html = await heal(actor, caster, then.n);
    return post(actor, { title: `${esc(actor.name)} — Renewal`, body: `<div class="fs-result"><i class="fa-solid fa-heart-pulse"></i> ${html}</div>` });
  }
  if (then.type === "reapply") {
    const mode = R.modeById(then.mode);
    const out = await resolveMode({ attacker: caster, target: actor, o: { stacks: 0 }, result: { hit: true, crit: !!then.crit, critStacks: 0 }, m: { mode: then.mode, power: then.power, enhanced: then.enhanced, range: then.range, choices: then.choices ?? {}, reapplied: true, spread: true },
      mode, power: then.power, enhanced: then.enhanced, choices: then.choices ?? {}, stacks: 0, hit: true, crit: false, now: true });
    return post(actor, { title: `${esc(actor.name)} — ${esc(mode?.name ?? "Mode")} (Fester)`, body: `<div class="fs-result">${out.html}</div>` });
  }
}

/** Start of this creature's turn: delayed Mental effects take hold, and Entomb's damage lands. */
export async function pendingTurnStart(actor) {
  for (const f of TURN_START) await f(actor);
  for (const e of spellEffects(actor, "pending")) {
    const d = e.flags.flowstate.spellEffect;
    const caster = globalThis.fromUuidSync?.(d.caster);
    await changeEffect(e, null);
    if (caster) await runThen(actor, caster, d.then);
  }
  for (const e of spellEffects(actor, "hold")) {
    const d = e.flags.flowstate.spellEffect;
    if (!d.entomb) continue;
    const r = await roll(`${3 * d.power}d10`);
    const crush = bold(d.bstacks, r.total);
    await post(actor, { title: `${esc(actor.name)} — Entombed`, rolls: [r], body: `<div class="fs-result">${esc(actor.name)} is crushed in the earth: <strong>${crush}</strong> physical damage.</div>` });
    await requestDamage(actor, crush, "physical", 0, null, { silent: true });
  }
}

/** Heal with the "only health lost since the start of the caster's last turn" rule; the dead come back if they died since. */
async function heal(target, caster, n) {
  const stamp = caster.getFlag?.("flowstate", "turnStartedAt") ?? 0;
  const dead = target.statuses?.has("dead");
  const diedSince = !stamp || (target.getFlag?.("flowstate", "diedAt") ?? 0) >= stamp;
  if (dead && !diedSince) return `${esc(target.name)} died before the start of your last turn: Renewal can't reach them.`;
  const hp = target.system.hp.value, max = target.system.hp.max;
  const room = Math.max(0, max - hp);
  const lost = dead ? Infinity : lossSince(target, stamp);
  const cut = healingDown(target);
  n = Math.max(0, n - cut);
  const amount = Math.max(0, Math.min(n, lost, room));
  await setHp(target, { "system.hp.value": hp + amount });
  await reevaluate(target);
  return `${esc(target.name)} regains <strong>${amount}</strong> health (${hp + amount}/${max})${amount < n ? " (only health lost since the start of your last turn)" : ""}.${dead && hp + amount > 0 ? ` <strong>${esc(target.name)} is resurrected.</strong>` : ""}`;
}

const forceFeet = (force, target, ignoreLift) => resolveForce(force, { lift: ignoreLift ? 0 : target.system.lift ?? 0, maxHp: 0 });

/** Roll `n`d`sides` Force with the Manifest's Strengthened/Weakened and turn it into feet pushed, ignoring the half-max-HP threshold. */
async function forceRoll(ctx, n, sides, label, ignoreLift = false) {
  const r = await roll(`${n}d${sides}`);
  const force = Math.floor(applyStacks(r.total, ctx.stacks));
  const feet = forceFeet(force, ctx.target, ignoreLift);
  return { r, force, feet, html: `${label}: ${n}d${sides} = ${r.total}${ctx.stacks ? ` → ${force}` : ""} Force → up to <strong>${feet} ft</strong>${ignoreLift ? " (ignores Lift)" : ""}`, push: feet > 0 ? { attacker: ctx.attacker.uuid, target: ctx.target.uuid, force, feet, label } : null };
}

/* -------------------------------------------- */
/*  Modes                                       */
/* -------------------------------------------- */

export const rolled = [];     // dice rolled by the last resolve (so the card can show them)
/** Registries other Wonder files fill in: follow-up buttons (`ACTS`, by id) and extra buttons offered after a hit (`ACT_PROVIDERS`). */
export const ACTS = {};
export const ACT_PROVIDERS = [];
/** Modes whose effect applies even when the attack roll misses (Perfection). */
export const MISS_MODES = new Set();
/** Extra Manifest choices (`CHOICE_PROVIDERS`), costs and bonuses (`COST_PROVIDERS`), work at the start of a turn (`TURN_START`) and before effects clear (`BEFORE_CLEAR`). */
export const CHOICE_PROVIDERS = [];
export const COST_PROVIDERS = [];
export const TURN_START = [];
export const BEFORE_CLEAR = [];
/** Called with a Manifest context when it crits (Ego, Pride): return HTML or nothing. */
export const ON_CRIT = [];

/** Each Mode: ({ attacker, target, ctx... }) → HTML (and optional push / acts). */
export const MODES = {
  /* ---- Life (Dream) ---- */
  async "mental-life-dream:bloom"(c) {
    const n = bold(c.bs, 20 * c.power);
    if (c.enhanced || c.now) { await putTemp(c.target, c.attacker, n, c.mode.id); return `${esc(c.target.name)} gets <strong>${n} temp HP</strong> now.`; }
    await putPending(c.target, c.attacker, "Bloom", { type: "tempHP", n, mode: c.mode.id });
    return `${esc(c.target.name)} gets <strong>${n} temp HP</strong> at the start of their next turn (until the start of your next turn).`;
  },
  async "mental-life-dream:flourish"(c) {
    const up = bold(c.bs, c.power);
    if (c.enhanced || c.now) { await putSpellEffect(c.target, { kind: "dodgeUp", caster: c.attacker.uuid, name: `Flourish (+${up} dodge die size)`, dodgeDieUp: up, mode: c.mode.id, description: `Dodge dice are ${up} size${up === 1 ? "" : "s"} bigger until the start of ${c.attacker.name}'s next turn.` }); return `${esc(c.target.name)}'s dodge dice are <strong>one size bigger</strong> now.`; }
    await putPending(c.target, c.attacker, "Flourish", { type: "dodgeUp", mode: c.mode.id, power: up });
    return `${esc(c.target.name)}'s dodge dice get <strong>+${up} die size</strong> from the start of their next turn (until the start of your next turn).`;
  },
  async "mental-life-dream:renewal"(c) {
    const n = bold(c.bs, 4 * c.power);
    if (c.enhanced || c.now) return await heal(c.target, c.attacker, n);
    await putPending(c.target, c.attacker, "Renewal", { type: "heal", n, mode: c.mode.id });
    return `${esc(c.target.name)} will restore up to <strong>${n}</strong> health at the start of their next turn (even if they die before then: it can raise them from the dead).`;
  },

  /* ---- Death (Nightmare) ---- */
  async "mental-death-nightmare:wither"(c) {
    if (!living(c.target)) return `${esc(c.target.name)} isn't a living target: Wither does nothing.`;
    const r = await roll(`${2 * c.power}d10`);
    rolled.push(r);
    const n = Math.floor(applyStacks(r.total, c.stacks));
    await requestDamage(c.target, n, "supernatural", 0, null, { silent: true, bypass: true, maxHpLoss: !!c.enhanced });
    return `Wither removes <strong>${n}</strong> health from ${esc(c.target.name)} (${2 * c.power}d10 = ${r.total}${c.stacks ? ` → ${n}` : ""}), ignoring objects and defenses${c.enhanced ? ", and that much Max HP too" : ""}.`;
  },
  async "mental-death-nightmare:waste"(c) {
    const size = bold(c.bs, 2 * c.power);
    await putSpellEffect(c.target, { kind: "waste", stack: true, caster: c.attacker.uuid, name: `Waste${c.enhanced ? " (Enhanced)" : ""}`, enhanced: !!c.enhanced, power: c.power, bstacks: c.bs, mode: c.mode.id,
      description: `A charge: the next dodge roll is ${size} die sizes smaller${c.enhanced ? " and has Disadvantage" : ""}. Until the start of ${c.attacker.name}'s next turn.` });
    return `${esc(c.target.name)} carries a <strong>Waste</strong> charge: their next dodge roll has its die size reduced by ${size}${c.enhanced ? " and Disadvantage" : ""} (used automatically).`;
  },
  async "mental-death-nightmare:execute"(c) {
    const r = await roll(`${c.power}d12`);
    rolled.push(r);
    const up = bold(c.bs, r.total);
    await putSpellEffect(c.target, { kind: "execute", stack: true, caster: c.attacker.uuid, name: `Execute (+${up} Pain Threshold)`, painUp: up, execute: !!c.enhanced, mode: c.mode.id,
      description: `Pain Threshold raised by ${up}${c.enhanced ? "; if their health falls below half of the raised Pain Threshold they die" : ""}. Until the start of ${c.attacker.name}'s next turn.` });
    return `${esc(c.target.name)}'s Pain Threshold is raised by <strong>${up}</strong> (${c.power}d12 = ${r.total}${c.bs ? ` → ${up}` : ""})${c.enhanced ? `. <strong>If their health drops below half of it they die.</strong>` : ""}`;
  },

  /* ---- Beyond (Dream) ---- */
  async "mental-beyond-dream:herald"(c) {
    const f = await forceRoll(c, 10 * c.power, 8, "Herald", !!c.enhanced);
    rolled.push(f.r);
    return { html: `${f.html}${f.push ? knockbackRow(c.attacker.uuid, f.feet, "Herald") : ""}`, push: f.push };
  },
  async "mental-beyond-dream:redirect"(c) {
    // No attack roll: the charge goes on the caster until their next turn.
    await putSpellEffect(c.attacker, { kind: "redirect", stack: true, caster: c.attacker.uuid, name: `Redirect (${R.RANGES[c.range]?.label ?? c.range}${c.enhanced ? ", Enhanced" : ""})`, range: c.range, enhanced: !!c.enhanced, power: c.power, bstacks: c.bs,
      description: `A charge: when an attack hits within ${R.RANGES[c.range]?.label ?? c.range} range that you can sense, use "Redirect" to make an attack roll against its result: on a hit it deals ${c.enhanced ? 10 : 20} × ${c.power} less damage${c.enhanced ? " (the roll automatically hits)" : ""}. Until your next turn.` });
    return `${esc(c.attacker.name)} stores a <strong>Redirect</strong> charge (${R.RANGES[c.range]?.label ?? c.range}) until their next turn: use the Redirect action when an attack hits within range.`;
  },
  async "mental-beyond-dream:ascend"(c) {
    const lift = bold(c.bs, 60 * c.power);
    await putSpellEffect(c.target, { kind: "lift", caster: c.attacker.uuid, name: `Ascend (${lift} Lift)`, liftUp: lift, mode: c.mode.id,
      description: `Grants ${lift} Lift until the start of ${c.attacker.name}'s next turn. ${c.enhanced ? "The caster controls the stabilization check." : "The target controls their flight and must stabilize (3 RP) if they take more than 1/10 of their max HP in damage or are pushed by enough Force."}` });
    return `${esc(c.target.name)} is lifted: <strong>${lift} Lift</strong> until the start of your next turn${c.enhanced ? ". You control their stabilization (succeed or fail as you like)." : `. They fly as they choose, and must stabilize for 3 RP if they take more than ${Math.floor(c.target.system.hp.max / 10)} damage or are pushed.`}`;
  },

  /* ---- Below (Nightmare) ---- */
  async "mental-below-nightmare:sink"(c) {
    const min = bold(c.bs, 2 * c.power);
    if ((c.target.system.lift ?? 0) > 0 || spellEffects(c.target, "lift").length) return `${esc(c.target.name)} isn't on the ground: Sink needs a grounded creature.`;
    await holdWith(c, { min, label: "Sunk in the ground", turns: c.enhanced ? 3 : 1, flags: { below: true, sink: true } });
    return `The ground grapples ${esc(c.target.name)}: breaking free needs a counter grapple roll of <strong>${min}</strong> or higher, ${c.enhanced ? "lasting 3 turns" : "until the start of your next turn"}.`;
  },
  async "mental-below-nightmare:burden"(c) {
    const min = bold(c.bs, 2 * c.power);
    const dis = c.choices.dis === "dodge" ? "dodge" : "attack";
    await putSpellEffect(c.target, { kind: "burden", stack: true, caster: c.attacker.uuid, name: `Burden (${dis})`, [dis === "attack" ? "attackDis" : "dodgeDis"]: 1, below: true, breakMin: min, mode: c.mode.id, turnsLeft: c.enhanced ? 3 : undefined,
      description: `Disadvantage on ${dis} rolls. Stacks. A counter grapple check of ${min} or higher removes all of it; otherwise until ${c.enhanced ? "3 of the caster's turns" : "the start of the caster's next turn"}.` });
    const n = spellEffects(c.target, "burden").length;
    return `${esc(c.target.name)} is <strong>weighed down</strong>: Disadvantage on ${dis} rolls (${n} Burden stack${n === 1 ? "" : "s"}), until they break free with a counter grapple check of ${min} or higher${c.enhanced ? ", or 3 turns" : ", or the start of your next turn"}.`;
  },
  async "mental-below-nightmare:entomb"(c) {
    const min = bold(c.bs, 3 * c.power);
    const sunk = spellEffects(c.target, "hold").find(e => e.flags.flowstate.spellEffect.sink);
    const stacks = spellEffects(c.target, "burden").reduce((n, e) => n + (Number(e.flags.flowstate.spellEffect.attackDis) || 0) + (Number(e.flags.flowstate.spellEffect.dodgeDis) || 0), 0);
    if (!sunk || stacks < 3) return `Entomb needs a target under Sink and at least 3 Burden stacks (${esc(c.target.name)} has ${sunk ? "Sink" : "no Sink"} and ${stacks} Burden).`;
    await changeEffect(sunk, null);
    for (const e of spellEffects(c.target, "burden")) await changeEffect(e, null);
    await holdWith(c, { min, label: "Entombed", turns: c.enhanced ? 3 : 1, flags: { below: true, entomb: true, power: c.power, bstacks: c.bs } });
    return `${esc(c.target.name)} is <strong>entombed</strong> in the earth: blind, deaf and unable to smell. Escaping takes a counter grapple check of <strong>${min}</strong> or higher, and at the start of each of their turns they take ${3 * c.power}d10 physical damage${c.enhanced ? " (3 turns)" : ""}.`;
  }
};

/** A magical hold (the ground, an entombing earth): it works like Gravity's Hold, so Break Free and movement already know it. */
async function holdWith(c, { min, label, turns, flags }) {
  await setGrapple(c.target, c.attacker.uuid);
  await putSpellEffect(c.target, { kind: "hold", caster: c.attacker.uuid, name: `${label} (≥ ${min})`, holdMin: min, turnsLeft: turns > 1 ? turns : undefined, mode: c.mode.id, ...flags,
    description: `Held: breaking free needs a counter grapple roll of ${min} or more. ${turns > 1 ? `Lasts ${turns} of the caster's turns.` : "Ends at the start of the caster's next turn."}` });
}

/** Resolve a Mode on a target: { html, rolls, push, acts }. Modes with no automation yet fall back to the card text. */
export async function resolveMode(c) {
  rolled.length = 0;
  const handler = MODES[c.mode.id];
  let html, push = null;
  if (!handler) html = `<strong>${esc(c.mode.name)}</strong> ${c.hit ? "hits" : "misses"} ${esc(c.target.name)}: ${esc(c.text ?? "")}<div class="fs-notes">This Mode's effect isn't automated yet: the GM applies it from the numbers above.</div>`;
  else {
    const out = await handler(c);
    html = typeof out === "string" ? out : out.html;
    push = typeof out === "string" ? null : out.push ?? null;
  }
  const all = c.now || !c.hit ? (c.hit ? [] : await missActs(c)) : [...(await abilityActs(c)), ...(MODES_CHARGES_READY ? chargeActs(c) : [])];
  // Tenets aren't buttons: they pop up for the Mental user (offerTenets) whenever their condition is met, until used that round.
  return { html, push, rolls: [...rolled], acts: all.filter(a => !a.tenet), tenets: all.filter(a => a.tenet) };
}

export const MISS_PROVIDERS = [];
export async function missActs(c) { const out = []; for (const f of MISS_PROVIDERS) out.push(...(await f(c) ?? [])); return out; }

/* -------------------------------------------- */
/*  Abilities and Tenets after a hit            */
/* -------------------------------------------- */

const wonderOf = c => R.wonderById(c.mode.wonder);

/** Buttons offered to the Mental user once a Mode has hit: abilities that cost energy, and the attuned Tenet. */
async function abilityActs(c) {
  const a = c.attacker, acts = [];
  const w = wonderOf(c);
  const base = { target: c.target.uuid, caster: a.uuid, mode: c.mode.id, power: c.power, enhanced: !!c.enhanced, range: c.range, choices: c.choices ?? {}, crit: !!c.crit };
  const wt = tier(a, w.id);
  if (w.id === "mental-life-dream" && wt >= 2 && !c.m.spread) acts.push({ id: "pollinate", label: "Pollinate", tip: "Spread this Mode to another target within 100 ft you can sense (an attack roll)", cost: `⚡ ${Math.floor(minOf(a, "pon") / 2)}`, ...base });
  if (w.id === "mental-death-nightmare" && wt >= 2 && !c.m.reapplied) acts.push({ id: "fester", label: "Fester", tip: "The Mode's effect applies again at the start of their next turn", cost: `⚡ ${minOf(a, "snap")}`, ...base });
  if (w.id === "mental-death-nightmare" && wt >= 4 && c.crit && living(c.target)) acts.push({ id: "reap", label: "Reap", tip: "Manifest another Death Mode of the same Range for free", cost: `⚡ ${minOf(a, "snap")}`, ...base });
  const tn = tenetOf(a);
  if (tn && !c.m.spread && !c.now) {
    if (tn.id === "mental-life-dream:verdant-soul") acts.push({ tenet: true, id: "verdantSoul", label: "Verdant Soul", tip: "Once per round: 10 temp HP to the target or yourself", cost: "once per round", mult: tn.mult, ...base });
    if (tn.id === "mental-death-nightmare:mortal-coil") acts.push({ tenet: true, id: "mortalCoil", label: "Mortal Coil", tip: "Once per round: steal 1d8 health as temp HP", cost: "once per round", mult: tn.mult, ...base });
    if (tn.id === "mental-below-nightmare:weight") acts.push({ tenet: true, id: "weight", label: "Weight", tip: `Once per round: ${15 * tn.mult} Slow stacks on the target, until your next turn`, cost: "once per round", mult: tn.mult, ...base });
    if (tn.id === "mental-beyond-dream:gust") acts.push({ tenet: true, id: "gust", label: "Gust", tip: "Once per round: 5d8 Force on the target", cost: "once per round", mult: tn.mult, ...base });
  }
  for (const f of ACT_PROVIDERS) acts.push(...(await f(c) ?? []));
  return acts;
}

/** Weight (Below Tenet): 15 Slow stacks on the target. */
ACTS.weight = async (x, caster, target) => {
  if (!(await tryOnce(caster, "weight"))) { ui.notifications.info("Weight: already used this round."); return false; }
  const n = 15 * (x.mult ?? 1);
  const data = { "system.conditions.slow": (target.system.conditions?.slow ?? 0) + n };
  if (target.isOwner) await target.update(data); else await requestGM("updateActor", { uuid: target.uuid, data });
  await post(caster, { title: `${esc(caster.name)} — Weight`, body: `<div class="fs-result">${esc(target.name)} gets <strong>${n} Slow</strong> stacks, until the start of your next turn.</div>` });
  return true;
};

/**
 * Tenets pop up for the Mental user when their condition is met (a Manifest hit, a crit...): "Use it?". Declining leaves it unused, so it pops up
 * again the next time the condition is met that round, until it is used. Asked of the character's player (over the socket if that's someone else).
 */
export async function offerTenets(c, acts) {
  for (const x of acts ?? []) {
    if (onceUsed(c.attacker, x.id)) continue;
    const ans = await askFor(c.attacker, { title: `${x.label} (Tenet)`, ok: `Use ${x.label}`, html: `<p><strong>${esc(x.label)}</strong>: ${esc(x.tip)}.</p><p>${esc(c.attacker.name)}'s ${esc(c.mode?.name ?? "Manifest")} hit ${esc(c.target.name)}. Use it now? (If not, it comes up again the next time it can be used this round.)</p>` });
    if (ans) await runOnOwner(c.attacker, x);
  }
}

/** The button row(s) for a follow-up card. */
export function actButtons(acts) {
  return acts.map((x, i) => `<div class="fs-brawl-row fs-mental-row" data-role="attacker" data-owner="${x.caster}"><button type="button" class="fs-mental-act" data-i="${i}" data-tooltip="${esc(x.tip ?? "")}"><i class="fa-solid fa-wand-sparkles"></i> ${esc(x.label)} <small>${esc(x.cost ?? "")}</small></button></div>`).join("");
}

/** A button on one of our follow-up cards was clicked: do it. Returns true if it was used. */
export async function runAct(x) {
  const caster = await fromUuid(x.caster), target = await fromUuid(x.target);
  if (!caster?.isOwner) { ui.notifications.warn(`Only ${caster?.name ?? "the Mental user"}'s owner can do that.`); return false; }
  if (["chant", "makeClear", "wobs"].includes(x.id)) return mental.theoryAct(x);
  if (ACTS[x.id]) return ACTS[x.id](x, caster, target);
  const mode = R.modeById(x.mode);
  const energy = { pollinate: Math.floor(minOf(caster, "pon") / 2), fester: minOf(caster, "snap"), reap: minOf(caster, "snap") }[x.id] ?? 0;
  if (["verdantSoul", "mortalCoil", "gust"].includes(x.id) && !(await tryOnce(caster, x.id))) { ui.notifications.info("Once per round: already used this round."); return false; }
  if (energy && !(await mental.pay(caster, { energy }, x.label ?? x.id))) return false;
  if (x.id === "vice" || x.id === "quicksand") {
    const cost = x.id === "vice" ? Math.floor(minOf(caster, "snap") / 2) : 2 * minOf(caster, "snap");
    if (!(await mental.pay(caster, { energy: cost }, x.label))) return false;
    if (x.id === "vice") {
      const r = await roll(`${x.power}d12`);
      await post(caster, { title: `${esc(caster.name)} — Vice`, rolls: [r], body: `<div class="fs-result">${esc(target.name)} takes <strong>${r.total}</strong> physical damage (${x.power}d12) for failing to break free.</div>` });
      await requestDamage(target, r.total, "physical", 0, null, { silent: true });
      return true;
    }
    await mental.quicksand(caster, target, x);
    return true;
  }
  if (x.id === "ricochet" || x.id === "unbound") return runChargeAct(x, caster, target);
  if (x.id === "pollinate") {
    const picked = await mental.pickAnother(caster, { title: "Pollinate: spread it to", exclude: [target?.uuid, caster.uuid] });
    if (!picked) return false;
    await mental.manifestAt(caster, mode, picked, { power: x.power, enhanced: x.enhanced, range: "ranged", choices: x.choices, spread: true, label: "Pollinate" });
    return true;
  }
  if (x.id === "fester") {
    await putPending(target, caster, `${mode.name} (Fester)`, { type: "reapply", mode: x.mode, power: x.power, enhanced: x.enhanced, range: x.range, choices: x.choices, crit: false });
    await post(caster, { title: `${esc(caster.name)} — Fester`, body: `<div class="fs-result">${esc(mode.name)}'s effect applies to ${esc(target.name)} again at the start of their next turn (no attack roll).</div>` });
    return true;
  }
  if (x.id === "reap") {
    const w = R.knownWonders(caster.system.trees).find(w => w.id === "mental-death-nightmare");
    const choice = await mental.pickMode(caster, w?.modes ?? [], "Reap: Manifest another Death Mode");
    if (!choice) return false;
    await mental.manifest(caster, { mode: choice, range: x.range, enhance: x.enhanced, burst: false }, { free: true });
    return true;
  }
  if (x.id === "verdantSoul") {
    const n = 10 * x.mult;
    const who = await mental.pickOne(caster, [target, caster], "Verdant Soul: give 10 temp HP to");
    if (!who) return false;
    await putTemp(who, caster, n, "verdant-soul");
    await post(caster, { title: `${esc(caster.name)} — Verdant Soul`, body: `<div class="fs-result">${esc(who.name)} gets <strong>${n} temp HP</strong> until the start of ${esc(caster.name)}'s next turn.</div>` });
    return true;
  }
  if (x.id === "mortalCoil") {
    const r = await roll(`${x.mult}d8`);
    if (!living(target)) { ui.notifications.warn("Mortal Coil needs a living target."); return false; }
    await requestDamage(target, r.total, "supernatural", 0, null, { silent: true, bypass: true });
    await putTemp(caster, caster, r.total, "mortal-coil");
    await post(caster, { title: `${esc(caster.name)} — Mortal Coil`, rolls: [r], body: `<div class="fs-result">${esc(caster.name)} steals <strong>${r.total}</strong> health from ${esc(target.name)}, becoming temp HP until the start of their next turn.</div>` });
    return true;
  }
  if (x.id === "gust") {
    const f = await forceRoll({ stacks: 0, target, attacker: caster }, 5 * x.mult, 8, "Gust", false);
    await post(caster, { title: `${esc(caster.name)} — Gust`, rolls: [f.r], body: `<div class="fs-result">${f.html}${f.push ? knockbackRow(caster.uuid, f.feet, "Gust") : ""}</div>`, flags: f.push ? { flowstate: { knockback: f.push } } : {} });
    return true;
  }
  return false;
}

/* -------------------------------------------- */
/*  Things the engine asks about                */
/* -------------------------------------------- */

/** Waste: the first dodge roll of a creature carrying a charge is smaller (and maybe at Disadvantage). Returns { pen, net, charges } to apply and then `useWaste`. */
export function dodgeWaste(actor) {
  const charges = spellEffects(actor, "waste");
  if (!charges.length) return null;
  const e = charges[0], d = e.flags.flowstate.spellEffect;
  const pen = bold(d.bstacks, 2 * (d.power ?? 1));
  return { pen, net: d.enhanced ? -1 : 0, effect: e, note: `Waste: die size −${pen}${d.enhanced ? " and Disadvantage" : ""}` };
}
export const useWaste = w => changeEffect(w.effect, null);

/** After a Break Free from a Below effect: Vice (on a failure) and Quicksand (on a success) are offered to the caster on a card. */
export async function afterBreakFree({ actor, held, freed }) {
  if (!held?.below) return;
  const caster = globalThis.fromUuidSync?.(held.caster);
  if (!caster) return;
  const power = Math.max(1, R.wonderPower(eff(caster, "snap")));
  const acts = [];
  if (!freed && tier(caster, "mental-below-nightmare") >= 2) acts.push({ id: "vice", label: `Vice on ${actor.name}`, tip: "1d12 physical damage for a failed counter grapple check", cost: `⚡ ${Math.floor(minOf(caster, "snap") / 2)}`, caster: caster.uuid, target: actor.uuid, power });
  if (freed && tier(caster, "mental-below-nightmare") >= 4) acts.push({ id: "quicksand", label: `Quicksand on ${actor.name}`, tip: "An attack roll: on a hit they fail their escape check instead", cost: `⚡ ${2 * minOf(caster, "snap")}`, caster: caster.uuid, target: actor.uuid, power, held });
  if (acts.length) await post(caster, { title: `${esc(caster.name)} — Below`, body: `<div class="fs-notes">${esc(actor.name)} ${freed ? "broke free of" : "failed to break free of"} ${esc(held.name)}.</div>${actButtons(acts)}`, flags: { flowstate: { mentalAct: { acts } } } });
}

/** Burden: Disadvantage on attack rolls or dodge rolls (stacking). */
export const burdenNet = (actor, key) => -spellEffects(actor, "burden").reduce((n, e) => n + (Number(e.flags.flowstate.spellEffect[key]) || 0), 0);

/** Execute (Enhanced): below half of the raised Pain Threshold they die. Call after damage lands. */
export async function checkExecute(actor) {
  const ex = spellEffects(actor, "execute").find(e => e.flags.flowstate.spellEffect.execute);
  if (!ex) return null;
  const hp = actor.system.hp.value, pain = actor.system.hp.pain;
  if (hp > 0 && hp < pain / 2) {
    await setHp(actor, { "system.hp.value": 0 });
    await reevaluate(actor);
    await post(actor, { title: `${esc(actor.name)} — Execute`, body: `<div class="fs-result"><i class="fa-solid fa-skull"></i> ${esc(actor.name)}'s health fell below half of their raised Pain Threshold: <strong>they die</strong>.</div>` });
    return true;
  }
  return null;
}

/** Perennial (Life T4): Life Modes about to expire on a target within 100 ft can be reapplied for the Enhance cost. Returns acts for a card. */
export function perennialActs(caster) {
  if (tier(caster, "mental-life-dream") < 4) return [];
  const out = [];
  const seen = new Set();
  const pool = new Map();
  for (const a of globalThis.game?.actors ?? []) pool.set(a.uuid, a);
  for (const t of globalThis.canvas?.tokens?.placeables ?? []) if (t.actor) pool.set(t.actor.uuid, t.actor);
  for (const a of pool.values()) for (const e of a.effects ?? []) {
    const d = e.flags?.flowstate?.spellEffect;
    if (!d || d.caster !== caster.uuid || !String(d.mode ?? "").startsWith("mental-life-dream:") || e.disabled || e.flags?.flowstate?.ritualOf) continue;
    const key = `${a.uuid}:${d.mode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { name, img, ...rest } = e.toObject ? { name: e.name, ...d } : { name: e.name, ...d };
    out.push({ id: "perennial", label: `Perennial: ${R.modeById(d.mode)?.name ?? "Life Mode"} on ${a.name}`, tip: "Reapply this effect instantly (no attack roll)", cost: `⚡ ${minOf(caster, "pon")}`, caster: caster.uuid, target: a.uuid, effect: { ...d, name: e.name } });
  }
  return out;
}
export async function runPerennial(x) {
  const caster = await fromUuid(x.caster), target = await fromUuid(x.target);
  if (!caster?.isOwner || !target) return false;
  if (!(await mental.pay(caster, { energy: minOf(caster, "pon") }, "Perennial"))) return false;
  const { name, description, ...data } = x.effect;
  await putSpellEffect(target, { ...data, name, description });
  await post(caster, { title: `${esc(caster.name)} — Perennial`, body: `<div class="fs-result">${esc(name)} is reapplied to ${esc(target.name)} instantly.</div>` });
  return true;
}

/* -------------------------------------------- */
/*  Action List abilities                       */
/* -------------------------------------------- */

/** Momentum (Beyond T2): a creature or object you moved with a Beyond Mode collided: apply 5d8 Force again in a new direction, no attack roll. */
export async function momentum(actor) {
  if (tier(actor, "mental-beyond-dream") < 2) return;
  const power = Math.max(1, R.wonderPower(eff(actor, "pon")));
  const target = [...(game.user?.targets ?? [])].map(t => t.actor).find(a => a && a.type !== "pile") ?? await mental.pickAnother(actor, { title: "Momentum: the one that collided", within: Infinity, anchors: [] });
  if (!target) return;
  if (!(await mental.pay(actor, { energy: minOf(actor, "pon") }, "Momentum"))) return;
  const f = await forceRoll({ stacks: 0, target, attacker: actor }, 5 * power, 8, "Momentum", false);
  await post(actor, { title: `${esc(actor.name)} — Momentum`, rolls: [f.r], body: `<div class="fs-result">${esc(target.name)}: ${f.html}${f.push ? knockbackRow(actor.uuid, f.feet, "Momentum") : ""} <small>(Momentum can chain with itself)</small></div>`, flags: f.push ? { flowstate: { knockback: f.push } } : {} });
}

/** Redirect (Beyond T3): spend a stored charge against an attack that hit within its range: an attack roll against that attack's result. */
export async function useRedirect(actor) {
  const charges = spellEffects(actor, "redirect");
  if (!charges.length) return ui.notifications.info(`${actor.name} has no Redirect charge.`);
  const out = await foundry.applications.api.DialogV2.prompt({ window: { title: "Redirect" },
    content: `<div class="fs-field"><label>Charge</label><select name="c">${charges.map((e, i) => `<option value="${i}">${esc(e.name)}</option>`).join("")}</select></div>
      <div class="fs-field"><label>The attack's result to beat</label><input type="number" name="beat" value="10" min="0"></div>`,
    ok: { label: "Redirect", callback: (event, button) => Object.fromEntries(new FormData(button.form).entries()) }, rejectClose: false });
  if (!out) return;
  const e = charges[Number(out.c)] ?? charges[0], d = e.flags.flowstate.spellEffect;
  const net = (d.kinetic ? d.kinetic : 0);
  let r = null, hit = !!d.enhanced;
  if (!hit) { r = await roll(`1d${actor.system.derived.attackDie}`); hit = r.total >= Number(out.beat); }
  await changeEffect(e, null);
  const cut = bold(d.bstacks, (d.enhanced ? 10 : 20) * d.power);
  await post(actor, { title: `${esc(actor.name)} — Redirect`, rolls: r ? [r] : [], body: `<div class="fs-result">${hit ? `Redirect ${d.enhanced ? "(Enhanced: automatically hits)" : `hits (${r.total} vs ${out.beat})`}: the attack deals <strong>${cut}</strong> less damage. If that reduces it to 0 you may redirect it to another target within ${R.RANGES[d.range]?.label ?? d.range} range with a new attack roll, repeating the attack's effect on a hit.` : `Redirect misses (${r.total} vs ${out.beat}): the attack is unchanged.`}</div>` });
}

/* -------------------------------------------- */
/*  Order and Chaos: charges                    */
/* -------------------------------------------- */
const MODES_CHARGES_READY = true;

/**
 * Order (Dream) and Chaos (Nightmare) Modes store a charge on the target until the start of your next turn; you cash it in when the target
 * makes a roll. The charge is an effect on the target, and "Charges" rows in the Action List work out what spending one does (a static roll,
 * a forced reroll, +/- results...) on a card for the table to apply, since a roll has usually been made by the time the charge is spent.
 */
export const CHARGES = {
  decree: { label: "Decree", wonder: "mental-order-dream", text: "changes their roll to a static result: half the roll's max result, plus or minus 1" },
  mandate: { label: "Mandate", wonder: "mental-order-dream", text: "gives a result plus or minus 1 per charge consumed" },
  verdict: { label: "Verdict", wonder: "mental-order-dream", text: "swaps a regular hit and a crit, and adds or subtracts 5 damage (doubled on a crit)" },
  fracture: { label: "Fracture", wonder: "mental-chaos-nightmare", text: "forces a reroll with the die size changed by 2 (dodge dice by half)" },
  larceny: { label: "Larceny", wonder: "mental-chaos-nightmare", text: "steals the roll and its effects, forcing a reroll with the die size changed by 1 (dodge dice by half)" },
  entropy: { label: "Entropy", wonder: "mental-chaos-nightmare", text: "on a crit gives them an additional roll with the die size changed by 3 (dodge dice by half)" }
};
const CHARGE_MODES = Object.fromEntries(Object.entries(CHARGES).map(([k, c]) => [`${c.wonder}:${k}`, k]));

export const isCharge = modeId => modeId in CHARGE_MODES;

/** Put a charge of this kind on a target (no attack roll). `free` = from Unbound or Ricochet. */
export async function placeCharge({ caster, target, kind, power, bstacks = 0, enhanced, choices = {}, mode }) {
  const orderPersist = CHARGES[kind].wonder === "mental-order-dream" && tier(caster, "mental-order-dream") >= 2
    && !spellEffects(target, "charge").some(e => e.flags.flowstate.spellEffect.caster === caster.uuid && e.flags.flowstate.spellEffect.persistent && CHARGES[e.flags.flowstate.spellEffect.charge]?.wonder === "mental-order-dream");
  const sign = choices.sign === "minus" ? "minus" : "plus", size = choices.size === "down" ? "down" : "up";
  const bits = [kind === "decree" || kind === "mandate" ? (sign === "plus" ? "+1" : "−1") : "", ["fracture", "larceny", "entropy"].includes(kind) ? `die size ${size === "up" ? "+" : "−"}` : "", enhanced ? "Enhanced" : ""].filter(Boolean).join(", ");
  await putSpellEffect(target, { kind: "charge", stack: true, caster: caster.uuid, name: `${CHARGES[kind].label} charge${bits ? ` (${bits})` : ""}`, charge: kind, enhanced: !!enhanced, power, bstacks, sign, size, persistent: orderPersist, mode,
    description: `A ${CHARGES[kind].label} charge: ${CHARGES[kind].text}. ${orderPersist ? "Permanence: it lasts until it is consumed." : `Until the start of ${caster.name}'s next turn.`}` });
  return orderPersist;
}

for (const [modeId, kind] of Object.entries(CHARGE_MODES)) {
  MODES[modeId] = async c => {
    const persisted = await placeCharge({ caster: c.attacker, target: c.target, kind, power: c.power, bstacks: c.bs, enhanced: c.enhanced, choices: c.choices, mode: modeId });
    return `${esc(c.target.name)} carries a <strong>${CHARGES[kind].label}</strong> charge${c.enhanced ? " (Enhanced)" : ""}${persisted ? " (it stays until used: Permanence)" : " until the start of your next turn"}: you're asked whether to spend it whenever they make a roll.`;
  };
}

/** Charges this caster has placed on creatures in the scene: [{ effect, holder, kind }]. */
export function chargesOf(caster) {
  const pool = new Map();
  for (const a of globalThis.game?.actors ?? []) pool.set(a.uuid, a);
  for (const t of globalThis.canvas?.tokens?.placeables ?? []) if (t.actor) pool.set(t.actor.uuid, t.actor);
  const out = [];
  for (const a of pool.values()) for (const e of spellEffects(a, "charge")) {
    const d = e.flags.flowstate.spellEffect;
    if (d.caster === caster.uuid) out.push({ effect: e, holder: a, kind: d.charge, data: d });
  }
  return out;
}

const dieOf = (a, type) => type === "dodge" ? a.system.derived.dodgeDie : a.system.derived.attackDie;
const half = n => Math.floor(n / 2);
/** Roll a forced reroll: attack/other use one die, dodge two dice with the size changed by half. */
async function rerollWith(holder, type, delta) {
  const base = dieOf(holder, type);
  const d = type === "dodge" ? Math.max(1, base + Math.trunc(delta / 2) + (delta % 2 ? Math.sign(delta) : 0)) : Math.max(1, base + delta);
  const r = await roll(type === "dodge" ? `2d${d}` : `1d${d}`);
  return { r, d, text: `${type === "dodge" ? "2" : "1"}d${d} = ${r.total}` };
}

/** Spend a charge: ask what the roll was, work out the effect, and post it. */
export async function consumeCharge(caster, effect) {
  const d = effect.flags.flowstate.spellEffect, holder = effect.parent;
  const kind = d.charge, def = CHARGES[kind];
  if (!caster.isOwner) return ui.notifications.warn("Only the owner of the Mental user can spend a charge.");
  const pre = caster.getFlag("flowstate", "preordained");
  const preOk = tier(caster, "mental-order-dream") >= 4 && def.wonder === "mental-order-dream" && Number.isFinite(pre?.n);
  const control = tier(caster, "mental-chaos-nightmare") >= 4 && def.wonder === "mental-chaos-nightmare";
  const types = `<div class="fs-field"><label>Their roll</label><select name="type"><option value="attack">Attack roll</option><option value="dodge">Dodge roll</option><option value="damage">Damage roll</option><option value="other">Other roll</option></select></div>
    <div class="fs-field"><label>Its max result <small>(damage and other rolls)</small></label><input type="number" name="max" value="0" min="0"></div>`;
  const fields = {
    decree: types, mandate: `<div class="fs-field"><label>The result</label><input type="number" name="result" value="0"></div><div class="fs-field"><label>Charges consumed</label><input type="number" name="n" value="1" min="1"></div>
      <label class="fs-cast-mod"><input type="checkbox" name="damage"> It's a damage roll${d.enhanced ? ": ±10 damage instead (Enhanced)" : ""}</label>`,
    verdict: `<div class="fs-field"><label>Their attack landed as</label><select name="was"><option value="hit">A regular hit (becomes a crit)</option><option value="crit">A crit (becomes a regular hit)</option></select></div><div class="fs-field"><label>Damage</label><input type="number" name="dmg" value="0" min="0"></div>
      ${d.enhanced ? `<div class="fs-field"><label>Also give the attack</label><select name="stack"><option value="str">a Strengthened stack</option><option value="weak">a Weakened stack</option></select></div>` : ""}`,
    fracture: types, larceny: types, entropy: types
  }[kind];
  const out = await foundry.applications.api.DialogV2.prompt({ window: { title: `${def.label} on ${holder.name}` },
    content: `<div class="fs-cast"><p>${esc(holder.name)}'s ${esc(def.label)} charge: ${esc(def.text)}.</p>${fields}
      ${preOk ? `<label class="fs-cast-mod"><input type="checkbox" name="pre"> <strong>Preordained</strong> <small>⚡ ${minOf(caster, "pon")}: also ${d.sign === "minus" ? "subtract" : "add"} your Preordained Number (${pre.n})</small></label>` : ""}
      ${control ? `<label class="fs-cast-mod"><input type="checkbox" name="control"> <strong>Control</strong> <small>reroll the extra roll once and use the new result</small></label>` : ""}</div>`,
    ok: { label: "Consume", callback: (event, button) => { const f = {}; for (const el of button.form.elements) if (el.name) f[el.name] = el.type === "checkbox" ? el.checked : el.value; return f; } }, rejectClose: false });
  if (!out) return;
  if (out.pre && !(await mental.pay(caster, { energy: minOf(caster, "pon") }, "Preordained"))) return;
  const lines = [], rolls = [];
  const signN = d.sign === "minus" ? -1 : 1, preN = out.pre ? signN * pre.n : 0;
  const maxOf = () => out.type === "attack" ? dieOf(holder, "attack") : out.type === "dodge" ? 2 * dieOf(holder, "dodge") : Number(out.max) || 0;
  if (kind === "decree") {
    const myMax = out.type === "attack" ? dieOf(caster, "attack") : out.type === "dodge" ? 2 * dieOf(caster, "dodge") : Number(out.max) || 0;
    const base = half(d.enhanced ? myMax : maxOf());
    const result = Math.max(0, base + signN + preN);
    lines.push(`${esc(holder.name)}'s ${out.type} roll becomes the static result <strong>${result}</strong> (half of ${d.enhanced ? "your" : "their"} max ${d.enhanced ? myMax : maxOf()} = ${base}, ${d.sign === "minus" ? "−" : "+"}1${preN ? `, ${preN > 0 ? "+" : "−"}${Math.abs(preN)} Preordained` : ""}).`);
  } else if (kind === "mandate") {
    const n = Math.max(1, Math.floor(Number(out.n) || 1));
    if (out.damage && d.enhanced) lines.push(`The damage becomes ${Number(out.result)} ${signN > 0 ? "+" : "−"} <strong>${10 * n}</strong>${preN ? ` ${signN > 0 ? "+" : "−"} ${Math.abs(preN) * 10} (Preordained × 10)` : ""} = <strong>${Math.max(0, Number(out.result) + signN * 10 * n + preN * 10)}</strong>.`);
    else lines.push(`The result ${Number(out.result)} becomes <strong>${Number(out.result) + signN * n + preN}</strong> (${d.sign === "minus" ? "−" : "+"}${n}${preN ? `, ${preN > 0 ? "+" : "−"}${Math.abs(preN)} Preordained` : ""}).`);
  } else if (kind === "verdict") {
    const crit = out.was === "hit";
    const adj = (crit ? 10 : 5) * (d.sign === "minus" ? -1 : 1);
    lines.push(`The ${out.was === "hit" ? "hit becomes a <strong>crit</strong>" : "crit becomes a <strong>regular hit</strong>"}, and the damage goes ${Number(out.dmg)} → <strong>${Math.max(0, Number(out.dmg) + (out.was === "crit" ? -5 : 5) + preN)}</strong> (${out.was === "hit" ? "+5" : "−5"}${preN ? `, ${preN > 0 ? "+" : "−"}${Math.abs(preN)} Preordained` : ""}).`);
    if (d.enhanced) lines.push(`Also: the attack gets a stack of ${out.stack === "weak" ? "Weakened" : "Strengthened"}.`);
  } else {
    const delta = { fracture: 2, larceny: 1, entropy: 3 }[kind] * (d.size === "down" ? -1 : 1);
    const first = await rerollWith(holder, out.type === "dodge" ? "dodge" : "attack", delta);
    rolls.push(first.r);
    let text = first.text;
    if (control) { /* Control: one extra reroll, and the new result must be used */ }
    if (out.control) { const again = await rerollWith(holder, out.type === "dodge" ? "dodge" : "attack", delta); rolls.push(again.r); text = `${first.text}, rerolled (Control): <strong>${again.text}</strong>`; }
    lines.push(kind === "fracture" ? `${esc(holder.name)} rerolls with the die size ${delta > 0 ? "+" : "−"}${Math.abs(delta)}: ${text}${d.enhanced ? " (keeps the original roll's Advantage/Disadvantage)" : " (no effects carried over)"}.`
      : kind === "larceny" ? `${esc(caster.name)} steals ${esc(holder.name)}'s roll and its effects: ${esc(holder.name)} rerolls at die size ${delta > 0 ? "+" : "−"}${Math.abs(delta)}: ${text}. You can use the stolen roll, with its effects, in place of any roll you make before your next turn${d.enhanced ? "; or, Enhanced, steal the action itself for up to a minute (spend RP equal to its AP/RP cost, using their stats and dice)" : ""}.`
      : `${esc(holder.name)} gets an additional roll (${out.type === "dodge" ? "a new dodge attempt" : "an extra attack or a redo"}) at die size ${delta > 0 ? "+" : "−"}${Math.abs(delta)}: ${text}${d.enhanced ? " (keeps the original roll's effects)" : ""}.`);
  }
  await changeEffect(effect, null);
  await post(caster, { title: `${esc(caster.name)} — ${def.label}`, rolls, body: `<div class="fs-result">${lines.join("<br>")}</div>` });
}

/* ---- Tenets, abilities and Preordained for Order and Chaos ---- */

/** Balance (Order Tenet): once per round add 1 to your attack/dodge result, or take 1 off the opposing side's. */
export async function balance(actor) {
  if (!(await tryOnce(actor, "balance"))) return ui.notifications.info("Balance: already used this round.");
  const mult = tenetOf(actor)?.mult ?? 1;
  await post(actor, { title: `${esc(actor.name)} — Balance`, body: `<div class="fs-result">Balance: add <strong>${mult}</strong> to your attack or dodge result, or remove <strong>${mult}</strong> from the opposing side's result.</div>` });
}

/** After an Order/Chaos Manifest hits: Unbound (Chaos Tenet, on a crit) and Ricochet (Chaos T2) come as buttons. */
export function chargeActs(c) {
  const a = c.attacker, acts = [];
  const w = R.wonderById(c.mode.wonder);
  const base = { target: c.target.uuid, caster: a.uuid, mode: c.mode.id, power: c.power, enhanced: !!c.enhanced, range: c.range, choices: c.choices ?? {}, crit: !!c.crit };
  if (w.id === "mental-chaos-nightmare" && tier(a, w.id) >= 2 && !c.m.spread) acts.push({ id: "ricochet", label: "Ricochet", tip: "Place a copy of this charge on a random valid target within range", cost: `⚡ ${Math.floor(minOf(a, "snap") / 2)}`, ...base });
  const tn = tenetOf(a);
  if (tn?.id === "mental-chaos-nightmare:unbound" && c.crit && !c.m.spread) acts.push({ tenet: true, id: "unbound", label: "Unbound", tip: "Once per round, on a crit: place a Chaos charge of your choice on the target for free", cost: "free, once per round", ...base });
  return acts;
}

/** Place a Chaos charge by Unbound or copy it by Ricochet. Returns true if it happened. */
export async function runChargeAct(x, caster, target) {
  if (x.id === "ricochet") {
    const cost = Math.floor(minOf(caster, "snap") / 2);
    const tTok = target?.getActiveTokens?.()[0], cTok = globalThis.canvas?.tokens?.placeables?.find(t => t.actor?.uuid === caster.uuid);
    const reach = x.range === "melee" ? (caster.system.derived?.size?.melee ?? 5) : 100;
    const pool = (globalThis.canvas?.tokens?.placeables ?? []).filter(t => t.actor && t.actor.type !== "pile" && t.actor.uuid !== caster.uuid && t.actor.uuid !== target?.uuid && !t.actor.statuses?.has("dead")
      && (!cTok || globalThis.canvas?.grid) && (!cTok || mentalDistance(cTok, t) <= reach));
    if (!pool.length) { ui.notifications.info("Ricochet: there's no valid target in range."); return false; }
    if (!(await mental.pay(caster, { energy: cost }, "Ricochet"))) return false;
    const pick = pool[Math.floor(Math.random() * pool.length)].actor;
    const kind = CHARGE_MODES[x.mode];
    await placeCharge({ caster, target: pick, kind, power: x.power, enhanced: x.enhanced, choices: x.choices, mode: x.mode });
    await post(caster, { title: `${esc(caster.name)} — Ricochet`, body: `<div class="fs-result">A copy of the ${CHARGES[kind].label} charge lands on <strong>${esc(pick.name)}</strong>.</div>` });
    return true;
  }
  if (x.id === "unbound") {
    if (!(await tryOnce(caster, "unbound"))) { ui.notifications.info("Unbound: already used this round."); return false; }
    const w = R.knownWonders(caster.system.trees).find(w => w.id === "mental-chaos-nightmare");
    const charges = (w?.modes ?? []).filter(m => isCharge(m.id));
    const id = await mental.pickMode(caster, charges, "Unbound: place a Chaos charge");
    if (!id) return false;
    const kind = CHARGE_MODES[id];
    await placeCharge({ caster, target, kind, power: x.power, enhanced: false, choices: x.choices ?? {}, mode: id });
    await post(caster, { title: `${esc(caster.name)} — Unbound`, body: `<div class="fs-result">A free ${CHARGES[kind].label} charge goes on ${esc(target.name)}.</div>` });
    return true;
  }
  return false;
}
const mentalDistance = (a, b) => (globalThis.canvas?.grid ? Math.round((Math.max(Math.abs(a.center.x - b.center.x), Math.abs(a.center.y - b.center.y)) / canvas.grid.size) * canvas.grid.distance) : 0);

/** Preordained (Order T4): when you finish a rest, roll one of your dodge dice: that is your Preordained Number. */
export async function afterRest(actor) {
  if (tier(actor, "mental-order-dream") < 4) return;
  const r = await roll(`1d${actor.system.derived.dodgeDie}`);
  await setActorFlag(actor, "preordained", { n: r.total });
  await post(actor, { title: `${esc(actor.name)} — Preordained`, rolls: [r], body: `<div class="fs-result">${esc(actor.name)}'s Preordained Number is <strong>${r.total}</strong>.</div>` });
}
