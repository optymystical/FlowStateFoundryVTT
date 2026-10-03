/**
 * The second batch of Wonders (Mental Rework Test Ground): Destruction, Peace, War, Adaptation and Perfection. Creation is in forging.mjs.
 * They register into wonders.mjs (`MODES`, `ACTS`, the provider lists) and mental.mjs calls `adjust` (damage dealt and taken), `onRollBuffs`
 * (Hone, Serenity, Provoke) and `damageStacks` (Hone) through `registerMental`.
 */
import {
  post, putSpellEffect, spellEffects, changeEffect, setActorFlag, requestDamage, damageOutcome, giveStacks, requestGM, tokenDistance, attackerToken, pickSceneTarget
} from "./actions.mjs";
import { applyStacks, poolFormula } from "./rules.mjs";
import { removeEnergy } from "./elemental.mjs";
import * as ab from "./abilities.mjs";
import * as R from "./mental-rules.mjs";
import * as mental from "./mental.mjs";
import { askFor } from "./charges.mjs";
import { tierOf } from "./skills.mjs";
import { MODES, ACTS, ACT_PROVIDERS, MISS_PROVIDERS, MISS_MODES, CHOICE_PROVIDERS, COST_PROVIDERS, TURN_START, BEFORE_CLEAR, ON_CRIT, rolled, tenetOf, tryOnce, onceUsed, markOnce, actButtons } from "./wonders.mjs";

const esc = s => foundry.utils.escapeHTML?.(String(s)) ?? String(s);
const roll = f => new Roll(f).evaluate();
const minOf = (a, k) => ab.statMinOf(a, k);
const tier = (actor, id) => tierOf(actor?.system?.trees ?? {}, id);
const living = a => a && a.type !== "pile";
const fromU = u => globalThis.fromUuidSync?.(u) ?? null;
const everyActor = () => [...new Set([...(globalThis.game?.actors ?? []), ...(globalThis.canvas?.tokens?.placeables ?? []).map(t => t.actor).filter(Boolean)])];
const ids = { dest: "mental-destruction-nightmare", peace: "mental-peace-dream", war: "mental-war-nightmare", adapt: "mental-adaptation-dream", perf: "mental-perfection-nightmare" };
const fx = (actor, kind) => (actor ? spellEffects(actor, kind) : []);
const dataOf = e => e.flags.flowstate.spellEffect;
const wonderPowerOf = (actor, wonderId) => { const w = R.wonderById(wonderId); return w ? R.manifestCheck(w, actor.system.derived?.effective?.[R.KINDS[w.kind].stat]?.value ?? 0).power : 1; };
const note = t => `<div class="fs-notes fs-charge-note"><i class="fa-solid fa-yin-yang"></i> ${t}</div>`;
const num = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;

/** Roll damage dice for a Mode (Power times the dice), apply stacks, and deal it. Returns { n, direct, r, line }. */
async function strike(c, dice, sides, type, { rend = null, label, pierce = 0 } = {}) {
  const count = dice * c.power;
  const r = await roll(`${count}d${sides}`);
  rolled.push(r);
  const n = Math.max(0, Math.floor(applyStacks(r.total, c.stacks)));
  const outcome = await damageOutcome(c.target, n, type, { archetype: "magic", rend, pierce });
  await requestDamage(c.target, n, type, pierce, null, { silent: true, archetype: "magic", rend });
  return { n, direct: outcome.toHp, r, line: `${label}: ${count}d${sides} = ${r.total}${c.stacks ? ` → ${n}` : ""} ${type} damage (${outcome.toHp} direct)` };
}
const setCond = async (actor, data) => { if (actor.isOwner) await actor.update(data); else await requestGM("updateActor", { uuid: actor.uuid, data }); };

/* -------------------------------------------- */
/*  Destruction (Nightmare)                     */
/* -------------------------------------------- */

const DESTRUCTION = {
  async "mental-destruction-nightmare:corrode"(c) {
    const s = await strike(c, 2, 6, "acid", { rend: { stacks: 1 }, label: "Corrode" });
    const kind = c.enhanced ? "solid" : "stain";
    const g = await giveStacks(c.target, kind, s.n, { caster: c.attacker });
    return `${s.line} (Strengthened against objects). ${g}`;
  },
  async "mental-destruction-nightmare:immolate"(c) {
    const s = await strike(c, 2, 10, "heat", { label: "Immolate" });
    const g = await giveStacks(c.target, "ignite", s.n, { caster: c.attacker });
    return `${s.line}. ${g}${c.enhanced ? " The Ignite can spread to an adjacent target (button below)." : ""}`;
  },
  async "mental-destruction-nightmare:irradiate"(c) {
    await putSpellEffect(c.target, { kind: "irradiated", stack: true, caster: c.attacker.uuid, name: `Irradiated (+${c.power} damage taken)`, extra: c.power, healDown: c.enhanced ? c.power : 0, mode: c.mode.id,
      description: `Takes ${c.power} additional damage from all sources${c.enhanced ? " and healing is reduced by the same" : ""}, until the start of ${c.attacker.name}'s next turn. Stacks.` });
    const s = await strike(c, 2, 8, "radiation", { label: "Irradiate" });
    const stacks = fx(c.target, "irradiated").length;
    return `${s.line}. ${esc(c.target.name)} takes <strong>${c.power * stacks}</strong> extra damage from every source until your next turn (${stacks} stack${stacks === 1 ? "" : "s"})${c.enhanced ? ", and healing is reduced by the same" : ""}.`;
  },
  async "mental-destruction-nightmare:freeze"(c) {
    const s = await strike(c, 2, 8, "cold", { label: "Freeze" });
    const r = await removeEnergy(c.target, s.direct);
    let tail = `${esc(c.target.name)} loses <strong>${r.removed} Energy</strong> (${r.remaining} left).`;
    if (r.remaining <= 0) {
      await putSpellEffect(c.target, { kind: "freezeSlow", caster: c.attacker.uuid, name: "Frozen (+1 AP to move)", moveUp: 1, enhanced: !!c.enhanced, mode: c.mode.id,
        description: `Moving costs 1 more AP until the start of ${c.attacker.name}'s next turn${c.enhanced ? "; damage removes it and is doubly Strengthened" : ""}.` });
      tail += ` Out of Energy: their movement costs <strong>+1 AP</strong> until your next turn${c.enhanced ? " (damage removes it, doubly Strengthened)" : ""}.`;
    }
    return `${s.line}. ${tail}`;
  }
};
const FUSE_ORDER = ["mental-destruction-nightmare:corrode", "mental-destruction-nightmare:freeze", "mental-destruction-nightmare:immolate", "mental-destruction-nightmare:irradiate"];
for (const [id, fn] of Object.entries(DESTRUCTION)) {
  MODES[id] = async c => {
    const fuse = c.choices?.fuse && c.choices.fuse !== "none" && c.choices.fuse !== id && DESTRUCTION[c.choices.fuse] && tier(c.attacker, ids.dest) >= 5 ? c.choices.fuse : null;
    if (!fuse) return fn(c);
    const order = [id, fuse].sort((a, b) => FUSE_ORDER.indexOf(a) - FUSE_ORDER.indexOf(b));       // acid breaks objects first, cold before heat
    const out = [];
    for (const m of order) out.push(await DESTRUCTION[m]({ ...c, mode: R.modeById(m) }));
    return `<em>Fusion:</em> ${out.join("<br>")}`;
  };
}
CHOICE_PROVIDERS.push((actor, modeId) => modeId.startsWith(`${ids.dest}:`) && tier(actor, ids.dest) >= 5
  ? [{ name: "fuse", label: `Fusion (⚡ ${minOf(actor, "snap")}): add another Destruction Mode`, options: { none: "— None —", ...Object.fromEntries(FUSE_ORDER.filter(m => m !== modeId).map(m => [m, R.modeById(m)?.name ?? m])) } }] : []);
COST_PROVIDERS.push((actor, { mode, choices }) => mode.wonder === ids.dest && choices.fuse && choices.fuse !== "none" && tier(actor, ids.dest) >= 5
  ? { energy: minOf(actor, "snap"), notes: [`Fusion: ${R.modeById(choices.fuse)?.name}`] } : null);
ACT_PROVIDERS.push(async c => {
  if (c.mode.id !== "mental-destruction-nightmare:immolate" || !c.enhanced) return [];
  return [{ id: "spreadIgnite", label: "Spread the Ignite", tip: "The target's Ignite stacks spread to an adjacent target of your choice", cost: "free", target: c.target.uuid, caster: c.attacker.uuid, mode: c.mode.id, power: c.power }];
});
ACTS.spreadIgnite = async (x, caster, target) => {
  const tok = target.getActiveTokens?.()[0];
  const pick = await pickSceneTarget(caster, { title: "Immolate: spread the Ignite to", within: 10, anchors: [tok], exclude: [target.uuid, caster.uuid] });
  if (!pick) return false;
  const n = target.system.conditions?.ignite ?? 0;
  const line = await giveStacks(pick, "ignite", n, { caster });
  await post(caster, { title: `${esc(caster.name)} — Immolate`, body: `<div class="fs-result">${n} Ignite spreads from ${esc(target.name)}: ${line}</div>` });
  return true;
};
/** Infuse (Destruction Tenet): when a willing character within 100 ft hits a target, apply one of your Destruction Modes to that attack with Weakened damage. */
export async function anyHit({ attacker, target, result }) {
  if (!result.hit || !target) return;
  for (const a of everyActor()) {
    const tn = tenetOf(a);
    if (tn?.id !== "mental-destruction-nightmare:infuse" || a.type === "pile") continue;
    if (attacker.uuid !== a.uuid && attacker.type === "pile") continue;
    const ta = attackerToken(a), tb = attackerToken(attacker);
    if (ta && tb && globalThis.canvas?.grid && tokenDistance(ta, tb) > 100) continue;
    const act = { id: "infuse", label: "Infuse", tip: "Once per round: apply one of your Destruction Modes to this hit (not Enhanced, no Fusion), its damage Weakened", cost: "once per round", caster: a.uuid, target: target.uuid };
    await post(a, { title: `${esc(a.name)} — Infuse`, body: `<div class="fs-notes">${esc(attacker.name)} hit ${esc(target.name)}.</div>${actButtons([act])}`, flags: { flowstate: { mentalAct: { acts: [act] } } } });
  }
}
ACTS.infuse = async (x, caster, target) => {
  if (!(await tryOnce(caster, "infuse"))) { ui.notifications.info("Infuse: already used this round."); return false; }
  const w = R.knownWonders(caster.system.trees).find(w => w.id === ids.dest);
  const mode = R.modeById(await mental.pickMode(caster, w?.modes ?? [], "Infuse: which Mode?"));
  if (!mode) return false;
  const power = wonderPowerOf(caster, ids.dest);
  const c = { attacker: caster, target, o: { stacks: -1 }, result: { hit: true, crit: false, critStacks: 0 }, m: { mode: mode.id, power, enhanced: false, range: "ranged", choices: {}, spread: true }, mode, power, enhanced: false, choices: {}, stacks: -1, hit: true, crit: false, now: true };
  const out = await MODES[mode.id](c);
  await post(caster, { title: `${esc(caster.name)} — Infuse: ${esc(mode.name)}`, rolls: [...rolled], body: `<div class="fs-result">${out}</div>` });
  return true;
};

/* -------------------------------------------- */
/*  Peace (Dream)                               */
/* -------------------------------------------- */

MODES["mental-peace-dream:pacify"] = async c => {
  for (const e of fx(c.target, "pacify")) if (dataOf(e).caster === c.attacker.uuid) await changeEffect(e, null);       // doesn't stack
  const enh = !!c.enhanced;
  await putSpellEffect(c.target, { kind: "pacify", caster: c.attacker.uuid, name: enh ? "Pacify (Enhanced)" : "Pacify", power: c.power, enhanced: enh, mode: c.mode.id,
    ...(enh ? { dodgeDieUp: 1, takenDice: c.power } : { attackDie: 2, dealtDice: c.power }),
    description: enh ? `Dodge dice +1 die size, and incoming damage is reduced by ${c.power}d8, until the start of ${c.attacker.name}'s next turn.` : `Attack rolls −2 die size, and damage dealt is reduced by ${c.power}d8, until the start of ${c.attacker.name}'s next turn.` });
  return enh ? `${esc(c.target.name)} is Pacified (Enhanced): <strong>+1 die size</strong> to dodge rolls, and incoming damage is reduced by <strong>${c.power}d8</strong>.`
    : `${esc(c.target.name)} is Pacified: <strong>−2 die size</strong> on attack rolls, and the damage they deal is reduced by <strong>${c.power}d8</strong>.`;
};
MODES["mental-peace-dream:absolution"] = async c => {
  await putSpellEffect(c.target, { kind: "absolution", caster: c.attacker.uuid, name: "Absolution (2 stacks)", stacks: 2, power: c.power, enhanced: !!c.enhanced, mode: c.mode.id,
    description: `Each time they deal or take damage, a stack reduces it by ${5 * c.power}${c.enhanced ? " (the caster chooses when and how many)" : ""}. Until the start of ${c.attacker.name}'s next turn.` });
  return `${esc(c.target.name)} gains <strong>2 Absolution</strong> stacks: each time they deal or take damage, a stack reduces it by <strong>${5 * c.power}</strong>${c.enhanced ? " (you choose when, and how many)" : ""}.`;
};
MODES["mental-peace-dream:guard"] = async c => {
  await putSpellEffect(c.target, { kind: "guard", stack: true, caster: c.attacker.uuid, name: `Guard${c.enhanced ? " (Enhanced)" : ""}`, power: c.power, enhanced: !!c.enhanced, mode: c.mode.id,
    description: `When they would take damage, ${c.attacker.name} can redirect up to ${15 * c.power} of it to themselves${c.enhanced ? " (taken at the start of their next turn)" : ""}. Until the start of ${c.attacker.name}'s next turn.` });
  return `${esc(c.target.name)} gains a <strong>Guard</strong> stack: you can redirect up to <strong>${15 * c.power}</strong> of the damage they would take to yourself${c.enhanced ? ", taking it at the start of your next turn" : ""}.`;
};
/** Benediction (Peace T4): after a Peace Mode hits, duplicate it onto other targets for free. */
ACT_PROVIDERS.push(async c => {
  if (c.mode.wonder !== ids.peace || tier(c.attacker, ids.peace) < 4 || c.m.spread) return [];
  return [{ id: "benediction", label: "Benediction", tip: "Duplicate this Mode's effects onto other target(s) of the same Range, with no AP/RP and no attack roll", cost: `⚡ ${2 * minOf(c.attacker, "pon")}`, target: c.target.uuid, caster: c.attacker.uuid, mode: c.mode.id, power: c.power, enhanced: !!c.enhanced, range: c.range, choices: c.choices ?? {} }];
});
ACTS.benediction = async (x, caster, target) => {
  const mode = R.modeById(x.mode);
  const n = x.range === "area" ? 2 : 1;
  const picked = [];
  for (let i = 0; i < n; i++) {
    const p = await mental.pickAnother(caster, { title: `Benediction: duplicate ${mode.name} onto (${i + 1}/${n})`, exclude: [target.uuid, ...picked.map(a => a.uuid)] });
    if (!p) break;
    picked.push(p);
  }
  if (!picked.length) return false;
  if (!(await mental.pay(caster, { energy: 2 * minOf(caster, "pon") }, "Benediction"))) return false;
  for (const p of picked) {
    const c = { attacker: caster, target: p, o: { stacks: 0 }, result: { hit: true, crit: false, critStacks: 0 }, m: { mode: mode.id, power: x.power, enhanced: x.enhanced, range: x.range, choices: x.choices, spread: true }, mode, power: x.power, enhanced: x.enhanced, choices: x.choices, stacks: 0, hit: true, crit: false, now: true };
    const out = await MODES[mode.id](c);
    await post(caster, { title: `${esc(caster.name)} — Benediction`, body: `<div class="fs-result">${typeof out === "string" ? out : out.html}</div>` });
  }
  return true;
};
/** Serenity (Peace T2): a creature under your Peace Mode attacks or is attacked: that attack roll gets a stack of Disadvantage. */
async function serenity({ actor, roll: atk, die, net, targetActor }) {
  const rows = [];
  for (const who of [actor, targetActor]) for (const e of ["pacify", "absolution", "guard"].flatMap(k => fx(who, k))) {
    const d = dataOf(e), caster = fromU(d.caster);
    if (caster && tier(caster, ids.peace) >= 2 && !rows.some(r => r.caster.uuid === caster.uuid)) rows.push({ caster });
  }
  const notes = [];
  for (const { caster } of rows) {
    const ans = await askFor(caster, { title: `${caster.name}: Serenity`, ok: `Use (⚡ ${Math.floor(minOf(caster, "pon") / 2)})`, html: `<p>${esc(actor.name)} makes an attack roll${targetActor ? ` against ${esc(targetActor.name)}` : ""} and one of them is under your Peace Mode. Spend <strong>${Math.floor(minOf(caster, "pon") / 2)}</strong> Energy to make that roll with a stack of Disadvantage (it's rerolled)?</p>` });
    if (!ans) continue;
    if (!(await mental.pay(caster, { energy: Math.floor(minOf(caster, "pon") / 2) }, "Serenity"))) continue;
    const r = await roll(poolFormula(1, die, net - 1));
    const old = atk.total;
    try { atk._total = r.total; } catch (e) { /* read-only */ }
    if (atk.total !== r.total) Object.defineProperty(atk, "total", { value: r.total, configurable: true });
    notes.push(`Serenity: ${esc(caster.name)} gives the attack roll a stack of Disadvantage: ${old} → <strong>${r.total}</strong>.`);
  }
  return notes;
}

/* -------------------------------------------- */
/*  War (Nightmare)                             */
/* -------------------------------------------- */

MODES["mental-war-nightmare:provoke"] = async c => {
  for (const e of fx(c.target, "provoke")) if (!c.enhanced || dataOf(e).caster === c.attacker.uuid) { if (!c.enhanced) await changeEffect(e, null); }
  await putSpellEffect(c.target, { kind: "provoke", caster: c.attacker.uuid, name: `Provoked${c.enhanced ? " (Enhanced)" : ""}`, attackDieUp: 2, power: c.power, enhanced: !!c.enhanced, mode: c.mode.id,
    description: `Their first set of AP on their turn must be spent attacking the nearest target, with +2 die size on that attack roll${c.enhanced ? "; the caster chooses the attack and/or its target" : ""}. Until the start of ${c.attacker.name}'s next turn.` });
  return `${esc(c.target.name)} is <strong>Provoked</strong>: their first AP on their turn must go on an attack at the nearest target (+2 die size on the roll)${c.enhanced ? `; <em>you</em> choose the attack or the target` : ""}.`;
};
MODES["mental-war-nightmare:warzone"] = async c => {
  await putSpellEffect(c.target, { kind: "warzone", stack: true, caster: c.attacker.uuid, name: `Warzone${c.enhanced ? " (Enhanced)" : ""}`, power: c.power, enhanced: !!c.enhanced, mode: c.mode.id,
    description: `When they deal damage, a stack adds ${c.power}d8 of its type${c.enhanced ? " (not used up on a crit)" : ""}. Until the start of ${c.attacker.name}'s next turn.` });
  return `${esc(c.target.name)} gains a <strong>Warzone</strong> stack: their next damage gets <strong>+${c.power}d8</strong> of its type${c.enhanced ? " (kept on a crit)" : ""}.`;
};
MODES["mental-war-nightmare:bloodbond"] = async c => {
  await putSpellEffect(c.target, { kind: "bloodbond", stack: true, caster: c.attacker.uuid, name: `Bloodbond${c.enhanced ? " (Enhanced)" : ""}`, power: c.power, enhanced: !!c.enhanced, range: c.range, mode: c.mode.id,
    description: `When they deal damage, ${c.attacker.name} can duplicate up to ${10 * c.power} of it onto another target in range. Until the start of the caster's next turn.` });
  return `${esc(c.target.name)} gains a <strong>Bloodbond</strong> stack: you can duplicate up to <strong>${10 * c.power}</strong> of the damage they deal onto another target (a new attack roll).`;
};
ACTS.warpath = async (x, caster, target) => {
  if (!(await mental.pay(caster, { energy: minOf(caster, "snap") }, "Warpath"))) return false;
  const modes = x.modes.map(id => R.modeById(id)).filter(Boolean);
  if (!modes.length) return false;
  await mental.manifestAt(caster, modes[0], target, { power: x.power, enhanced: false, spread: true, label: "Warpath", extraModes: modes.slice(1).map(m => m.id) });
  return true;
};

/* -------------------------------------------- */
/*  Adaptation (Dream)                          */
/* -------------------------------------------- */

const stacksOf = a => fx(a, "adaptation");
async function gainStack(actor) {
  await putSpellEffect(actor, { kind: "adaptation", stack: true, caster: actor.uuid, name: "Adaptation", description: "A stack of Adaptation: spend it on Crescendo, Adaptive Skin, Second Wind, Adapt... Lasts until the start of your next turn." });
}
/** Use up `n` Adaptation stacks; with Memory (Adaptation T4) each can be kept for your PON min in Energy. Returns how many were really spent. */
async function spendStacks(actor, n) {
  const have = stacksOf(actor);
  n = Math.min(n, have.length);
  if (n <= 0) return 0;
  let keep = 0;
  if (tier(actor, ids.adapt) >= 4 && actor.isOwner && (actor.system.energy?.value ?? 0) >= minOf(actor, "pon")) {
    const cost = minOf(actor, "pon");
    const ans = await askFor(actor, { title: "Memory", ok: "Keep", html: `<p>${n} Adaptation stack${n === 1 ? " is" : "s are"} being used. Keep how many for <strong>⚡ ${cost}</strong> each?</p><div class="fs-field"><label>Keep</label><input type="number" name="keep" value="0" min="0" max="${n}"></div>` });
    keep = Math.max(0, Math.min(n, Math.floor(num(ans?.keep)), Math.floor((actor.system.energy.value) / cost)));
    if (keep && !(await mental.pay(actor, { energy: cost * keep }, "Memory"))) keep = 0;
  }
  for (const e of have.slice(0, n - keep)) await changeEffect(e, null);
  return n;
}
async function gainOncePerAttack(c) {
  if (c.m.spread || !c.hit) return "";
  const uid = c.m.uid ?? "";
  if (uid && c.attacker.getFlag?.("flowstate", "adaptUid") === uid) return "";
  await setActorFlag(c.attacker, "adaptUid", uid);
  await gainStack(c.attacker);
  return ` You gain a stack of <strong>Adaptation</strong> (${stacksOf(c.attacker).length}).`;
}
CHOICE_PROVIDERS.push((actor, modeId) => {
  const out = [];
  if (modeId === "mental-adaptation-dream:crescendo") out.push({ name: "consume", label: "Adaptation stacks to consume (+die size)", number: true }, { name: "dtype", label: "Damage type (Enhanced)", options: { physical: "Physical", heat: "Heat", cold: "Cold", radiation: "Radiation", acid: "Acid" } });
  if (modeId === "mental-adaptation-dream:adaptive-skin") out.push({ name: "dtype", label: "Damage type (Enhanced: it only works against this)", options: { physical: "Physical", heat: "Heat", cold: "Cold", radiation: "Radiation", acid: "Acid", supernatural: "Supernatural" } });
  const tn = tenetOf(actor);
  if (tn?.id === "mental-adaptation-dream:adapt" && stacksOf(actor).length && modeId) out.push({ name: "adapt", label: "Adapt: spend a stack for Strengthened (once per round)", options: { no: "No", yes: "Yes" } });
  return out;
});
COST_PROVIDERS.push((actor, { choices }) => {
  if (choices.adapt !== "yes" || !stacksOf(actor).length || tenetOf(actor)?.id !== "mental-adaptation-dream:adapt") return null;
  return { stacks: 1, notes: ["Adapt: an Adaptation stack makes this Manifest Strengthened"], after: async () => { if (await tryOnce(actor, "adapt")) await spendStacks(actor, 1); } };
});
MODES["mental-adaptation-dream:crescendo"] = async c => {
  const have = stacksOf(c.attacker).length;
  const eat = Math.max(0, Math.min(have, Math.floor(num(c.choices.consume))));
  const n = eat + (c.enhanced ? 1 : 0);
  const inc = n * (n + 1);                                       // +2, then +4, +6, ...
  const dtype = c.enhanced && ["physical", "heat", "cold", "radiation", "acid"].includes(c.choices.dtype) ? c.choices.dtype : "physical";
  const s = await strike({ ...c }, 1, 10 + inc, dtype, { label: `Crescendo (d${10 + inc}${n ? `, ${eat} stack${eat === 1 ? "" : "s"} consumed${c.enhanced ? " +1 Enhanced" : ""}` : ""})` });
  if (eat) await spendStacks(c.attacker, eat);
  return `${s.line}.${await gainOncePerAttack(c)}`;
};
MODES["mental-adaptation-dream:adaptive-skin"] = async c => {
  const dtype = c.enhanced ? (c.choices.dtype || "physical") : null;
  await putSpellEffect(c.target, { kind: "skin", stack: true, caster: c.attacker.uuid, name: `Adaptive Skin${dtype ? ` (${dtype})` : ""}`, power: c.power, dtype, enhanced: !!c.enhanced, mode: c.mode.id,
    description: `All damage they take is reduced by ${c.power}${dtype ? ` (only ${dtype} damage; the first stack of extra reduction is already counted)` : ""}; ${c.attacker.name} can spend Adaptation stacks for more reduction against a damage type. Until the start of ${c.attacker.name}'s next turn.` });
  return `${esc(c.target.name)} gains <strong>Adaptive Skin</strong>: damage they take is reduced by <strong>${c.power}</strong>${dtype ? `, but only ${esc(dtype)} damage (with one Adaptation stack's worth already in)` : ""}.${await gainOncePerAttack(c)}`;
};
MODES["mental-adaptation-dream:second-wind"] = async c => {
  const n = 5 * c.power, e = c.target.system.energy;
  const gain = Math.max(0, Math.min(n, (e?.max ?? 0) - (e?.value ?? 0)));
  if (gain) await setCond(c.target, { "system.energy.value": e.value + gain });
  return `${esc(c.target.name)} regains <strong>${gain}</strong> Energy.${await gainOncePerAttack(c)}${stacksOf(c.attacker).length >= 2 ? " You can spend 2 stacks to remove a condition (button below)." : ""}`;
};
ACT_PROVIDERS.push(async c => c.mode.id === "mental-adaptation-dream:second-wind" && stacksOf(c.attacker).length >= 2
  ? [{ id: "cleanse", label: "Second Wind: remove a condition", tip: "Spend 2 Adaptation stacks to remove one negative condition from the target", cost: "2 stacks", target: c.target.uuid, caster: c.attacker.uuid, enhanced: !!c.enhanced }] : []);
ACTS.cleanse = async (x, caster, target) => {
  const conds = Object.entries(target.system.conditions ?? {}).filter(([, v]) => v > 0);
  const stati = [...(target.statuses ?? [])].filter(s => ["prone", "grappled", "slowed", "blinded", "deafened", "restrained"].includes(s));
  if (!conds.length && !stati.length) { ui.notifications.info(`${target.name} has no negative condition to remove.`); return false; }
  const out = await mental.pickChoice?.(caster, "Remove which condition?", [...conds.map(([k, v]) => [k, `${k} (${v})`]), ...stati.map(s => [`status:${s}`, s])]);
  if (!out) return false;
  if ((await spendStacks(caster, 2)) < 2) return false;
  if (out.startsWith("status:")) await requestGM("setStatus", { target: target.uuid, status: out.slice(7), active: false });
  else await setCond(target, { [`system.conditions.${out}`]: 0 });
  if (x.enhanced) await putSpellEffect(target, { kind: "wardOff", caster: caster.uuid, name: `Cleansed of ${out.replace("status:", "")}`, description: `${out.replace("status:", "")} can't be applied to them again by the same effect until the start of ${caster.name}'s next turn (the GM enforces this).` });
  await post(caster, { title: `${esc(caster.name)} — Second Wind`, body: `<div class="fs-result">${esc(target.name)} is rid of <strong>${esc(out.replace("status:", ""))}</strong>${x.enhanced ? " (it can't come back from the same effect until your next turn)" : ""}.</div>` });
  return true;
};
MISS_PROVIDERS.push(async c => c.mode.wonder === ids.adapt && tier(c.attacker, ids.adapt) >= 2
  ? [{ id: "instinct", label: "Instinct", tip: "Gain a stack of Adaptation for missing", cost: `⚡ ${Math.floor(minOf(c.attacker, "pon") / 2)}`, caster: c.attacker.uuid, target: c.target.uuid }] : []);
ACTS.instinct = async (x, caster) => {
  if (!(await mental.pay(caster, { energy: Math.floor(minOf(caster, "pon") / 2) }, "Instinct"))) return false;
  await gainStack(caster);
  await post(caster, { title: `${esc(caster.name)} — Instinct`, body: `<div class="fs-result">${esc(caster.name)} gains a stack of Adaptation (${stacksOf(caster).length}).</div>` });
  return true;
};
/** Memory (Adaptation T4): stacks that would be lost at the start of your turn can be kept for your PON min each. */
BEFORE_CLEAR.push(async actor => {
  const have = stacksOf(actor);
  if (!have.length || tier(actor, ids.adapt) < 4 || !actor.isOwner) {
    return;
  }
  const cost = minOf(actor, "pon");
  const afford = Math.floor((actor.system.energy?.value ?? 0) / cost);
  if (afford < 1) { for (const e of have) await changeEffect(e, { "flags.flowstate.spellEffect.persistent": false }); return; }
  const ans = await askFor(actor, { title: "Memory", ok: "Keep", html: `<p>${have.length} Adaptation stack${have.length === 1 ? "" : "s"} would be lost. Keep how many for <strong>⚡ ${cost}</strong> each?</p><div class="fs-field"><label>Keep</label><input type="number" name="keep" value="0" min="0" max="${Math.min(have.length, afford)}"></div>` });
  const keep = Math.max(0, Math.min(have.length, afford, Math.floor(num(ans?.keep))));
  if (keep && !(await mental.pay(actor, { energy: cost * keep }, "Memory"))) return;
  for (const [i, e] of have.entries()) await changeEffect(e, { "flags.flowstate.spellEffect.persistent": i < keep });
});

/* -------------------------------------------- */
/*  Perfection (Nightmare)                      */
/* -------------------------------------------- */

for (const id of ["mental-perfection-nightmare:exact", "mental-perfection-nightmare:hone", "mental-perfection-nightmare:masterstroke"]) MISS_MODES.add(id);
MODES["mental-perfection-nightmare:exact"] = async c => {
  const pierce = c.enhanced ? applyStacks(5 * c.power, c.hit ? 1 : 0) : 0;
  const count = c.power;
  const r = await roll(`${count}d10`);
  rolled.push(r);
  let n = c.hit ? Math.floor(applyStacks(r.total, c.stacks + 1)) : Math.max(0, Math.floor(applyStacks(r.total, c.stacks)) - c.margin);
  const outcome = await damageOutcome(c.target, n, "physical", { archetype: "magic", pierce });
  await requestDamage(c.target, n, "physical", pierce, null, { silent: true, archetype: "magic" });
  return `Exact ${c.hit ? "hits" : `misses by ${c.margin}`}: ${count}d10 = ${r.total} → <strong>${n}</strong> physical damage${c.hit ? " (Strengthened)" : ` (reduced by the ${c.margin} it missed by)`}${pierce ? `, Pierce ${pierce}` : ""} (${outcome.toHp} direct).`;
};
MODES["mental-perfection-nightmare:hone"] = async c => {
  for (const e of fx(c.target, "hone")) await changeEffect(e, null);                     // doesn't stack
  const bonus = c.hit ? c.power : Math.floor(applyStacks(c.power, -1));
  await putSpellEffect(c.target, { kind: "hone", caster: c.attacker.uuid, name: `Hone (${c.enhanced ? "set to average" : `+${bonus}`})`, honeBonus: bonus, honeStr: !!c.hit, honeSet: !!c.enhanced, mode: c.mode.id,
    description: `${c.enhanced ? `Attack roll results are set to the die's average (rounded down) plus ${bonus}, up to the roll's maximum.` : `Attack roll results get +${bonus}, up to the roll's maximum.`}${c.hit ? " Damage rolls are Strengthened." : ""} Until the start of ${c.attacker.name}'s next turn.` });
  return `${esc(c.target.name)} is <strong>Honed</strong>${c.hit ? "" : " (it missed, so the bonus is Weakened)"}: attack roll results ${c.enhanced ? `are set to the average, +${bonus}` : `+${bonus}`} (up to the roll's maximum)${c.hit ? ", and their damage rolls are Strengthened" : ""}.`;
};
MODES["mental-perfection-nightmare:masterstroke"] = async c => {
  const type = ["physical", "heat", "cold", "radiation", "acid", "electric"].includes(c.choices.dtype) ? c.choices.dtype : "physical";
  const prideUsed = c.enhanced ? Math.min(fx(c.attacker, "pride").length, Math.max(0, Math.floor(num(c.choices.pride)))) : 0;
  const count = c.power * (1 + prideUsed);
  const r = await roll(`${count}d8`);
  rolled.push(r);
  const n = c.hit ? Math.floor(applyStacks(r.total, c.stacks)) : Math.max(0, Math.floor(applyStacks(r.total, c.stacks)) - c.margin);
  const outcome = await damageOutcome(c.target, n, type, { archetype: "magic" });
  await requestDamage(c.target, n, type, 0, null, { silent: true, archetype: "magic" });
  for (const e of fx(c.attacker, "pride").slice(0, prideUsed)) await changeEffect(e, null);
  c.masterDirect = outcome.toHp;
  return `Masterstroke ${c.hit ? "hits" : `misses by ${c.margin}`}: ${count}d8 = ${r.total} → <strong>${n}</strong> ${esc(type)} damage${c.hit ? "" : ` (reduced by ${c.margin})`} (${outcome.toHp} direct)${prideUsed ? `, ${prideUsed} Pride stack${prideUsed === 1 ? "" : "s"} spent` : ""}.${c.hit && outcome.toHp > 0 ? " The direct damage reapplies to another target (button below)." : ""}`;
};
ACT_PROVIDERS.push(async c => c.mode.id === "mental-perfection-nightmare:masterstroke" && c.hit && c.masterDirect > 0
  ? [{ id: "masterReapply", label: "Masterstroke: reapply", tip: "The direct damage reapplies on another target within range that you can sense (no attack roll)", cost: "free", amount: c.masterDirect, dtype: ["physical", "heat", "cold", "radiation", "acid", "electric"].includes(c.choices.dtype) ? c.choices.dtype : "physical", target: c.target.uuid, caster: c.attacker.uuid, range: c.range }] : []);
MISS_PROVIDERS.push(async () => []);
ACTS.masterReapply = async (x, caster, target) => {
  const p = await mental.pickAnother(caster, { title: "Masterstroke: reapply the damage to", exclude: [target.uuid, caster.uuid] });
  if (!p) return false;
  await requestDamage(p, x.amount, x.dtype, 0, null, { silent: true, archetype: "magic" });
  await post(caster, { title: `${esc(caster.name)} — Masterstroke`, body: `<div class="fs-result">The direct damage reapplies: ${esc(p.name)} takes <strong>${x.amount}</strong> ${esc(x.dtype)}.</div>` });
  return true;
};
CHOICE_PROVIDERS.push((actor, modeId) => {
  const out = [];
  if (modeId === "mental-perfection-nightmare:masterstroke") out.push({ name: "dtype", label: "Damage type", options: { physical: "Physical", heat: "Heat", cold: "Cold", radiation: "Radiation", acid: "Acid", electric: "Electric" } }, { name: "pride", label: "Pride stacks to spend (Enhanced: +1d8 each)", number: true });
  if (modeId?.startsWith(`${ids.perf}:`) && tier(actor, ids.perf) >= 2) out.push({ name: "hubris", label: `Hubris (⚡ ${Math.floor(minOf(actor, "snap") / 2)}): all on hit, and a hit crits`, options: { no: "No", yes: "Yes" } });
  return out;
});
COST_PROVIDERS.push((actor, { mode, wonder, choices }) => {
  if (wonder.id !== ids.perf) return null;
  const hubris = choices.hubris === "yes" && tier(actor, ids.perf) >= 2;
  const pride = fx(actor, "pride").length;
  return { energy: hubris ? Math.floor(minOf(actor, "snap") / 2) : 0, net: pride, flags: hubris ? { hubris: true } : {}, notes: [...(hubris ? ["Hubris: the whole effect is on hit, and a hit crits"] : []), ...(pride ? [`Pride ×${pride}: Advantage`] : [])] };
});
ON_CRIT.push(async c => {
  if (c.mode.wonder !== ids.perf) return "";
  let out = "";
  if (tier(c.attacker, ids.perf) >= 4) { await putSpellEffect(c.attacker, { kind: "pride", stack: true, caster: c.attacker.uuid, name: "Pride", description: "Each stack gives your Perfection Manifests Advantage on their attack rolls. Until the start of your next turn." }); out += `You gain a stack of <strong>Pride</strong> (${fx(c.attacker, "pride").length}).`; }
  return out;
});
ON_CRIT.push(async c => {
  const tn = tenetOf(c.attacker);
  if (tn?.id !== "mental-perfection-nightmare:ego" || !(await tryOnce(c.attacker, "ego"))) return "";
  const e = c.attacker.system.energy, n = Math.min(5 * tn.mult, (e?.max ?? 0) - (e?.value ?? 0));
  if (n > 0) await setCond(c.attacker, { "system.energy.value": e.value + n });
  return `Ego: ${esc(c.attacker.name)} regains <strong>${5 * tn.mult}</strong> Energy.`;
});
/** Hone: a creature that was Honed makes Strengthened damage rolls. */
export const damageStacks = attacker => fx(attacker, "hone").some(e => dataOf(e).honeStr) ? 1 : 0;

/* -------------------------------------------- */
/*  Rolls: Hone, Provoke, Serenity              */
/* -------------------------------------------- */

/** An attack roll was made: Hone changes the result, Provoke is used up (and marks the attack as War-buffed), Serenity may reroll it with Disadvantage. */
export async function onRollBuffs(ctx) {
  const { actor, type, roll: r, die, max } = ctx;
  const out = { notes: [], rolls: [] };
  if (type === "attack") {
    const hone = fx(actor, "hone")[0];
    if (hone) {
      const d = dataOf(hone), top = max ?? die;
      const was = r.total;
      const to = d.honeSet ? Math.min(top, Math.floor((top + 1) / 2) + d.honeBonus) : Math.min(top, r.total + d.honeBonus);
      try { r._total = to; } catch (e) { /* read-only */ }
      if (r.total !== to) Object.defineProperty(r, "total", { value: to, configurable: true });
      out.notes.push(`Hone: the attack roll ${d.honeSet ? "is set to" : "goes"} ${was} → <strong>${to}</strong>.`);
    }
    const pro = fx(actor, "provoke");
    if (pro.length) {
      await setActorFlag(actor, "warBuff", { casters: pro.map(e => ({ caster: dataOf(e).caster, power: dataOf(e).power, mode: "mental-war-nightmare:provoke" })) });
      for (const e of pro) await changeEffect(e, null);
    }
    out.notes.push(...(await serenity(ctx)));
  }
  return out.notes.length ? out : null;
}

/* -------------------------------------------- */
/*  Damage dealt and taken                      */
/* -------------------------------------------- */

let busy = false;
const dealDice = async (count, sides, label, notes, sign = 1) => { const r = await roll(`${count}d${sides}`); const v = r.total * sign; notes.push(`${label}: ${sign > 0 ? "+" : "−"}${r.total} (${count}d${sides})`); return v; };
const near100 = (a, target) => { const ta = attackerToken(a), tb = target ? attackerToken(target) : null; return !ta || !tb || !globalThis.canvas?.grid || tokenDistance(ta, tb) <= 100; };

/** Use up (or ask about) Absolution stacks on a creature for one instance of damage. Returns the reduction. */
async function absolve(holder, notes) {
  let cut = 0;
  for (const e of fx(holder, "absolution")) {
    const d = dataOf(e), caster = fromU(d.caster);
    const stacks = num(d.stacks);
    if (stacks <= 0) continue;
    let used = 1;
    if (d.enhanced && caster) {
      const ans = await askFor(caster, { title: `${caster.name}: Absolution on ${holder.name}`, ok: "Consume", html: `<p>${esc(holder.name)} has <strong>${stacks}</strong> Absolution stack${stacks === 1 ? "" : "s"} and is about to deal or take damage. Consume how many (each reduces it by ${5 * d.power})?</p><div class="fs-field"><label>Stacks</label><input type="number" name="n" value="0" min="0" max="${stacks}"></div>` });
      used = Math.max(0, Math.min(stacks, Math.floor(num(ans?.n))));
    }
    if (!used) continue;
    cut += 5 * d.power * used;
    notes.push(`Absolution on ${esc(holder.name)}: −${5 * d.power * used} (${used} stack${used === 1 ? "" : "s"})`);
    if (stacks - used <= 0) await changeEffect(e, null); else await changeEffect(e, { "flags.flowstate.spellEffect.stacks": stacks - used, name: `Absolution (${stacks - used} stack${stacks - used === 1 ? "" : "s"})` });
  }
  return cut;
}

/** Damage dealt by `attacker` (if any) to `target` is changed by Wonder effects. Returns { amount, html }. */
export async function adjust({ attacker, target, amount, type, o = null, crit = false }) {
  if (busy || amount <= 0) return { amount, html: "" };
  let n = amount;
  const notes = [], buffs = [];
  if (attacker) {
    // War: Warzone adds dice automatically; a Provoked attack was buffed too.
    for (const e of fx(attacker, "warzone").slice(0, 1)) {
      const d = dataOf(e);
      n += await dealDice(d.power, 8, "Warzone", notes);
      buffs.push({ caster: d.caster, power: d.power, mode: "mental-war-nightmare:warzone" });
      if (!(d.enhanced && crit)) await changeEffect(e, null);
    }
    const wb = attacker.getFlag?.("flowstate", "warBuff");
    if (wb) { buffs.push(...wb.casters); await setActorFlag(attacker, "warBuff", null); }
    // Empower (War Tenet): a War user within 100 ft may add 1d10 (of the damage's type).
    for (const a of everyActor()) {
      const tn = tenetOf(a);
      if (tn?.id !== "mental-war-nightmare:empower" || !near100(a, target)) continue;
      if (await tryOnceCheck(a, "empower")) {
        const ans = await askFor(a, { title: `${a.name}: Empower`, ok: "Empower", html: `<p>${esc(target.name)} is about to take <strong>${n}</strong> ${esc(type)} damage${attacker ? ` from ${esc(attacker.name)}` : ""}. Increase it by <strong>${tn.mult}d10</strong>?</p>` });
        if (ans) { await markUsed(a, "empower"); n += await dealDice(tn.mult, 10, "Empower", notes); buffs.push({ caster: a.uuid, power: tn.mult, mode: null }); }
      }
    }
    // Warmonger (War T2): buffed damage gets 1d12 more, for Energy.
    const casters = [...new Set(buffs.map(b => b.caster))].map(u => fromU(u)).filter(Boolean);
    for (const caster of casters) {
      if (tier(caster, ids.war) < 2) continue;
      const cost = Math.floor(minOf(caster, "snap") / 2);
      const power = buffs.find(b => b.caster === caster.uuid)?.power ?? 1;
      const ans = await askFor(caster, { title: `${caster.name}: Warmonger`, ok: `Warmonger (⚡ ${cost})`, html: `<p>${esc(attacker.name)}'s attack, buffed by your War Mode, deals <strong>${n}</strong> ${esc(type)} damage. Spend <strong>${cost}</strong> Energy to add <strong>${power}d12</strong>?</p>` });
      if (ans && (await mental.pay(caster, { energy: cost }, "Warmonger"))) n += await dealDice(power, 12, "Warmonger", notes);
    }
    // Pacify (normal) lowers the damage its target deals; Absolution lowers it too.
    for (const e of fx(attacker, "pacify")) { const d = dataOf(e); if (d.dealtDice) n -= await dealDice(d.dealtDice, 8, "Pacify", notes, 1); }
    n -= await absolve(attacker, notes);
  }
  // ---- the one taking the damage
  for (const e of fx(target, "irradiated")) n += dataOf(e).extra;
  if (fx(target, "irradiated").length) notes.push(`Irradiated: +${fx(target, "irradiated").reduce((s, e) => s + dataOf(e).extra, 0)}`);
  for (const e of fx(target, "pacify")) { const d = dataOf(e); if (d.takenDice) n -= await dealDice(d.takenDice, 8, "Pacify (Enhanced)", notes); }
  n -= await absolve(target, notes);
  for (const e of fx(target, "skin")) {
    const d = dataOf(e);
    if (d.dtype && d.dtype !== type) continue;
    let cut = d.power;
    // Extra reduction: the caster may spend Adaptation stacks (1, then 2, then 3, ... times the Power) against this damage's type.
    const caster = fromU(d.caster);
    const have = caster ? stacksOf(caster).length : 0;
    if (caster && have > 0 && n - cut > 0) {
      const ans = await askFor(caster, { title: `${caster.name}: Adaptive Skin`, ok: "Adapt", html: `<p>${esc(target.name)} is about to take <strong>${n}</strong> ${esc(type)} damage. Spend Adaptation stacks (you have ${have}) for extra damage reduction against ${esc(type)} until your next turn: the first stack gives ${d.power}, the next ${2 * d.power}, then ${3 * d.power}...${d.enhanced ? " (one stack's worth is already counted)" : ""}</p><div class="fs-field"><label>Stacks</label><input type="number" name="n" value="0" min="0" max="${have}"></div>` });
      const k = Math.max(0, Math.min(have, Math.floor(num(ans?.n))));
      if (k) {
        const total = (k + (d.enhanced ? 1 : 0)) * (k + (d.enhanced ? 1 : 0) + 1) / 2 * d.power;
        await spendStacks(caster, k);
        await putSpellEffect(target, { kind: "skinType", caster: caster.uuid, name: `Adaptive Skin vs ${type} (−${total})`, dtype: type, dr: total, description: `Reduces ${type} damage by ${total} until the start of ${caster.name}'s next turn.` });
        cut += total; notes.push(`${k} Adaptation stack${k === 1 ? "" : "s"}: −${total} against ${esc(type)}`);
      }
    }
    n -= cut; notes.push(`Adaptive Skin: −${cut}`);
  }
  for (const e of fx(target, "skinType")) { const d = dataOf(e); if (d.dtype === type && !fx(target, "skin").some(s => dataOf(s).caster === d.caster && !dataOf(s).dtype)) { n -= d.dr; notes.push(`Adaptive Skin (${type}): −${d.dr}`); } }
  // Frozen (Enhanced Freeze): damage removes the slow and is doubly Strengthened.
  for (const e of fx(target, "freezeSlow")) if (dataOf(e).enhanced) { n = applyStacks(n, 2); notes.push("Frozen (Enhanced): the damage is doubly Strengthened and breaks the slow"); await changeEffect(e, null); }
  // Reactions of others: Dampen (Peace Tenet) lowers it, Guard redirects a chunk.
  for (const a of everyActor()) {
    const tn = tenetOf(a);
    if (tn?.id !== "mental-peace-dream:dampen" || !near100(a, target) || n <= 0) continue;
    if (!(await tryOnceCheck(a, "dampen"))) continue;
    const ans = await askFor(a, { title: `${a.name}: Dampen`, ok: "Dampen", html: `<p>${esc(target.name)} is about to take <strong>${n}</strong> ${esc(type)} damage. Reduce it by <strong>${tn.mult}d10</strong>?</p>` });
    if (ans) { await markUsed(a, "dampen"); n -= await dealDice(tn.mult, 10, "Dampen", notes); }
  }
  for (const e of fx(target, "guard")) {
    const d = dataOf(e), caster = fromU(d.caster);
    if (!caster || n <= 0 || caster.uuid === target.uuid) continue;
    const cap = 15 * d.power;
    const ans = await askFor(caster, { title: `${caster.name}: Guard`, ok: "Redirect", html: `<p>${esc(target.name)} is about to take <strong>${n}</strong> ${esc(type)} damage. Consume a Guard stack to redirect up to <strong>${cap}</strong> of it to yourself${d.enhanced ? " (you take it at the start of your next turn)" : ""}?</p>` });
    if (!ans) continue;
    const moved = Math.min(cap, n);
    n -= moved;
    await changeEffect(e, null);
    if (d.enhanced) await putSpellEffect(caster, { kind: "guardDebt", stack: true, onTargetTurn: true, caster: caster.uuid, name: `Guard debt (${moved})`, amount: moved, dtype: type, description: `Takes ${moved} ${type} damage at the start of their next turn (redirected by Guard).` });
    else { busy = true; try { await requestDamage(caster, moved, type, 0, null, { silent: true }); } finally { busy = false; } }
    notes.push(`Guard: ${moved} ${esc(type)} goes to ${esc(caster.name)}${d.enhanced ? " at the start of their next turn" : ""}`);
  }
  // Bloodbond (War T5): the one dealing damage carries a Bloodbond: duplicate part of it onto someone else.
  if (attacker) for (const e of fx(attacker, "bloodbond")) {
    const d = dataOf(e), caster = fromU(d.caster);
    if (!caster || n <= 0) continue;
    const cap = 10 * d.power, take = Math.min(cap, n);
    const reach = d.range === "melee" ? caster.system.derived?.size?.melee ?? 5 : 100;
    const ct = attackerToken(caster);
    const cands = (globalThis.canvas?.tokens?.placeables ?? []).filter(t => t.actor && t.actor.type !== "pile" && t.actor.uuid !== target.uuid && t.actor.uuid !== caster.uuid && (!ct || tokenDistance(ct, t) <= reach)).map(t => t.actor);
    if (!cands.length) continue;
    const ans = await askFor(caster, { title: `${caster.name}: Bloodbond`, ok: "Duplicate", html: `<p>${esc(attacker.name)} deals <strong>${n}</strong> ${esc(type)} damage while Bloodbonded. Duplicate up to <strong>${take}</strong> of it onto another target (a new attack roll)?</p><div class="fs-field"><label>Onto</label><select name="who">${cands.map(a => `<option value="${a.uuid}">${esc(a.name)}</option>`).join("")}</select></div>` });
    if (!ans?.who) continue;
    const victim = cands.find(a => a.uuid === ans.who);
    if (!victim) continue;
    if (!(d.enhanced && n > cap)) await changeEffect(e, null);
    notes.push(`Bloodbond: ${take} ${esc(type)} is duplicated onto ${esc(victim.name)} (attack roll).`);
    await mental.reflectStrike(caster, victim, take, type, "Bloodbond");
  }
  // Warpath (War T4): after buffed damage, the caster may carry the buffs to a recipient.
  if (attacker && buffs.length) {
    for (const caster of [...new Set(buffs.map(b => b.caster))].map(u => fromU(u)).filter(Boolean)) {
      if (tier(caster, ids.war) < 4) continue;
      const modes = [...new Set(buffs.filter(b => b.caster === caster.uuid && b.mode).map(b => b.mode))];
      if (!modes.length) continue;
      const power = buffs.find(b => b.caster === caster.uuid)?.power ?? 1;
      const act = { id: "warpath", label: "Warpath", tip: `Attack ${target.name} (no AP/RP): on a hit, apply ${modes.map(m => R.modeById(m)?.name).join(" and ")} to them`, cost: `⚡ ${minOf(caster, "snap")}`, caster: caster.uuid, target: target.uuid, modes, power };
      await post(caster, { title: `${esc(caster.name)} — Warpath`, body: actButtons([act]), flags: { flowstate: { mentalAct: { acts: [act] } } } });
    }
  }
  n = Math.max(0, n);
  return { amount: n, html: notes.length ? notes.map(note).join("") : "" };
}

/** Once-per-round without marking it yet (the prompt may be declined). */
const tryOnceCheck = async (a, id) => !onceUsed(a, id);
const markUsed = (a, id) => markOnce(a, id);

/** Guard (Enhanced): damage redirected for later lands at the start of the Guard user's turn. */
TURN_START.push(async actor => {
  for (const e of fx(actor, "guardDebt")) {
    const d = dataOf(e);
    await changeEffect(e, null);
    await post(actor, { title: `${esc(actor.name)} — Guard`, body: `<div class="fs-result">${esc(actor.name)} takes the <strong>${d.amount}</strong> ${esc(d.dtype)} damage Guard redirected.</div>` });
    busy = true; try { await requestDamage(actor, d.amount, d.dtype, 0, null, { silent: true }); } finally { busy = false; }
  }
});
