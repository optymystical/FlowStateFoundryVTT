/**
 * Tier 5 spells: Restoration Arcana (Restore, Painless, Regenerate, Resuscitate), Geomancy (Shift, Toss, Mend and their Combos),
 * Illusion (Mirage, its Mods and Combos) and the Arcanomancy extras. Strike and the Arcanomancy Combos are ordinary damage profiles (spellfx.mjs).
 * actions.mjs calls in through `registerArcana()`; casting.mjs asks `prompt` before payment and calls `resolve` after.
 */
import * as fx from "./spellfx.mjs";
import { COMBO_ILLUSION } from "./combos.mjs";
import {
  post, requestGM, putSpellEffect, spellEffects, performAttack, changeEffect, registerArcana, attackerToken, tokenDistance, setActorFlag, pickSceneTarget, spendPoints,
  requestDamage, GM_ACTIONS, damageOutcome, findDefense, findCancel
} from "./actions.mjs";
import * as areas from "./areas.mjs";
import * as terrain from "./terrain.mjs";
import { secret } from "./afflictions.mjs";
import { poolFormula, applyStacks, DAMAGE_TYPES } from "./rules.mjs";

const esc = s => foundry.utils.escapeHTML?.(String(s)) ?? String(s);
const DialogV2 = () => foundry.applications.api.DialogV2;
const roll = formula => new Roll(formula).evaluate();
const data = e => e.flags?.flowstate?.spellEffect ?? {};
const formValues = form => {
  const v = {};
  for (const el of form.elements) if (el.name && !el.disabled) v[el.name] = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value;
  return v;
};
const select = (name, options, value) => `<select name="${name}">${options.map(([k, label]) => `<option value="${k}" ${String(value) === String(k) ? "selected" : ""}>${esc(label)}</option>`).join("")}</select>`;
const field = (label, html) => `<div class="fs-field"><label>${esc(label)}</label>${html}</div>`;

/* -------------------------------------------- */
/*  Time bookkeeping (Restoration)              */
/* -------------------------------------------- */

/** HP this creature lost since `since` (the caster's last turn start); with no stamp (out of combat) all recent loss counts. */
export function lossSince(actor, since) {
  const log = actor.getFlag?.("flowstate", "lossLog") ?? [];
  return log.filter(e => !since || e.at >= since).reduce((n, e) => n + (e.n || 0), 0);
}
const turnStamp = actor => (actor.getFlag?.("flowstate", "turnStartedAt") ?? 0) || 0;
const diedAt = actor => actor.getFlag?.("flowstate", "diedAt") ?? 0;

/** Recompute dead / unconscious after something changed Pain Threshold or HP. */
export async function reevaluate(actor) {
  const hp = actor.system.hp.value, pain = actor.system.hp.pain;
  const dead = hp <= 0, unconscious = !dead && hp < pain;
  if (dead !== actor.statuses.has("dead")) await requestGM("setStatus", { target: actor.uuid, status: "dead", active: dead });
  if (unconscious !== actor.statuses.has("unconscious")) await requestGM("setStatus", { target: actor.uuid, status: "unconscious", active: unconscious });
}

/* -------------------------------------------- */
/*  Before payment                              */
/* -------------------------------------------- */

/** What the cast needs from the player (and whether it can happen at all). Returns a spec or null (nothing is spent). */
export async function prompt({ actor, plan, profile, mods, values, targets }) {
  const k = profile.arcana.kind;
  const target = targets?.[0]?.actor ?? null;
  const free = !!plan.freeFrom;
  if (k === "restore") {
    const t = target ?? actor;
    if (t.type === "pile" || t.system.magical) { ui.notifications.warn("Restore needs a living target."); return null; }
    const dead = t.statuses?.has("dead");
    const painless = plan.applied.find(a => a.mod.name === "Painless");
    const replaced = !!painless?.replace;
    if (dead && !mods.resuscitate) { ui.notifications.warn(`${t.name} is dead: Restore needs Resuscitate for that.`); return null; }
    if (dead && !free && diedAt(t) < turnStamp(actor)) { ui.notifications.warn(`${t.name} died before the start of your last turn: Resuscitate can't reach them (a Ritual can).`); return null; }
    if (!replaced && !free && !dead && lossSince(t, turnStamp(actor)) <= 0 && !(mods.regenerate)) { ui.notifications.warn(`${t.name} hasn't lost any health since the start of your last turn: there's nothing to restore.`); return null; }
    return { target: t.uuid };
  }
  if (k === "shift") {
    const max = fx.shiftBody(profile.arcana.body, plan.power);
    if (values?.arcanaSpec) return { ...values.arcanaSpec, body: Math.min(max, Math.max(1, Math.floor(Number(values.arcanaSpec.body) || max))), max };
    const spec = { body: max, muddy: "difficult", harden: "strong", item: "" };
    if (!mods.mend && !mods.muddy && !mods.harden) return { ...spec, max };
    const t = target ?? actor;
    const items = (t.items ?? []).filter(i => ["weapon", "armor", "foci", "shroud"].includes(i.type) && (i.system.wear ?? 0) > 0);
    const html = [
      ...(mods.mend ? [field("Object to mend", items.length ? select("item", items.map(i => [i.uuid, `${i.name} (−${i.system.wear} Durability)`]), "") : "<em>nothing damaged</em>")] : [field("Material moved (Body)", `<input type="number" name="body" value="${max}" min="1" max="${max}">`)]),
      ...(mods.muddy ? [field("Muddy", select("muddy", [["difficult", "Difficult terrain"], ["dis", "Disadvantage on rolls using the object"], ["weak", "Its damage is Weakened"], ["all", "All three (Muddy replacing Shift)"]], "difficult"))] : []),
      ...(mods.harden ? [field("Harden", select("harden", [["strong", "Its damage is Strengthened"], ["armor", "Damage to it is Weakened"], ["terrain", "Loses negative terrain modifiers"], ["all", "All three (Harden replacing Shift)"]], "strong"))] : [])
    ].join("");
    const out = await DialogV2().prompt({ window: { title: "Geomancy" }, content: `<div class="fs-cast">${html}</div>`, ok: { label: "Cast", callback: (e, b) => formValues(b.form) }, rejectClose: false });
    if (!out) return null;
    return { ...spec, ...out, body: Math.min(max, Math.max(1, Math.floor(Number(out.body) || max))), max };
  }
  if (k === "mirage") {
    if (values?.arcanaSpec) return values.arcanaSpec;
    return {};
  }
  return {};
}

/* -------------------------------------------- */
/*  After payment: Restore and Shift            */
/* -------------------------------------------- */

export async function resolve({ actor, plan, profile, spec, mods, targets, ritualOf }) {
  const k = profile.arcana.kind;
  if (k === "restore") return restore({ actor, plan, profile, spec, mods, targets, ritualOf });
  if (k === "shift") return shift({ actor, plan, profile, spec, mods, targets, ritualOf });
  return null;
}

/** Irradiate (Enhanced) lowers every healing effect the creature receives, and stacks. */
export function healingDown(actor) {
  return Array.from(actor?.effects ?? []).reduce((n, e) => n + (e.disabled ? 0 : Number(e.flags?.flowstate?.spellEffect?.healDown) || 0), 0);
}

export async function setHp(actor, update) {
  if (actor.isOwner) await actor.update(update); else await requestGM("updateActor", { uuid: actor.uuid, data: update });
}

async function restore({ actor, plan, profile, spec, mods, targets, ritualOf }) {
  const t = (await fromUuid(spec.target)) ?? targets?.[0]?.actor ?? actor;
  const free = !!plan.freeFrom || !!plan.t3Free;
  const painless = plan.applied.find(a => a.mod.name === "Painless");
  const replaced = !!painless?.replace;
  const power = plan.power;
  const lines = [];
  const dead = t.statuses?.has("dead");
  if (painless) {
    const down = 3 * power * (replaced ? 2 : 1);
    await putSpellEffect(t, { kind: "painless", caster: actor.uuid, ritualOf: replaced && plan.t3Free ? ritualOf : null, name: `Painless (−${down} Pain Threshold)`, painDown: down,
      description: `Pain Threshold lowered by ${down}${replaced && plan.t3Free ? " until the Ritual ends" : " until the start of the caster's next turn"}.` });
    lines.push(`${esc(t.name)}'s Pain Threshold is lowered by <strong>${down}</strong>.`);
    await reevaluate(t);
  }
  if (!replaced) {
    const rawBase = fx.restoreAmount(profile.arcana.heal, power);
    const cut = healingDown(t), raw = Math.max(0, rawBase - cut);
    if (cut) lines.push(`Irradiated: healing is reduced by ${cut} (${rawBase} → ${raw}).`);
    const hp = t.system.hp.value, max = t.system.hp.max;
    if (free && !dead && hp >= max && mods.regenerate) {
      // Regenerate (Ritual, full health): restores Max HP instead.
      const lost = t.system.hp.lost ?? 0, back = Math.min(lost, raw);
      await setHp(t, { "system.hp.lost": lost - back });
      lines.push(`Regenerate: ${esc(t.name)} regains <strong>${back}</strong> maximum health.`);
    } else {
      const limit = free || dead ? Infinity : lossSince(t, turnStamp(actor));
      const heal = Math.max(0, Math.min(raw, limit, max - hp));
      await setHp(t, { "system.hp.value": hp + heal });
      lines.push(`${esc(t.name)} regains <strong>${heal}</strong> health (${hp + heal}/${max})${heal < raw && !free ? " — only health lost since the start of your last turn" : ""}.`);
      if (dead && hp + heal > 0) lines.push(`<strong>${esc(t.name)} is resurrected.</strong>`);
    }
  }
  if (plan.t3Free) { const r = Array.from(actor.effects ?? []).find(e => e.id === plan.t3Free); if (r) await r.update({ "flags.flowstate.ritual.freeCasts": 0 }); }
  await post(actor, { title: `${esc(actor.name)} — Restore`, body: `<div class="fs-result"><i class="fa-solid fa-heart-pulse"></i> ${lines.join("<br>")}</div>` });
  return true;
}

async function shift({ actor, plan, profile, spec, mods, targets, ritualOf = null }) {
  const a = profile.arcana;
  const target = targets?.[0]?.actor && targets[0].actor.uuid !== actor.uuid ? targets[0].actor : null;
  const tierUp = (mods["tier up"] ?? 0) > 0 ? 2 : 0, again = (mods["tier up, again"] ?? 0) > 0 && tierUp ? 4 : 0;
  if (mods.mend) {
    const item = spec.item ? await fromUuid(spec.item) : null;
    const amount = 5 * plan.power;
    if (!item) { await post(actor, { title: `${esc(actor.name)} — Mend`, body: `<div class="fs-result">Mend restores ${amount} Durability to an object: nothing damaged was chosen.</div>` }); return true; }
    const free = !!plan.freeFrom;
    if (item.system.durability?.value <= 0 && !free) { ui.notifications.warn(`${item.name} is broken: only a Ritual can Mend it.`); }
    const back = Math.min(item.system.wear ?? 0, amount);
    if (item.isOwner !== false) await item.update({ "system.wear": (item.system.wear ?? 0) - back }, { flowstateSystem: true }); else await requestGM("wearItem", { uuid: item.uuid, amount: -back });
    await post(actor, { title: `${esc(actor.name)} — Mend`, body: `<div class="fs-result"><i class="fa-solid fa-hammer"></i> ${esc(item.name)} regains <strong>${back}</strong> Durability (up to ${amount}).</div><div class="fs-notes">Rarity and density limits apply; only damage dealt since the start of your last turn counts (a Ritual: any, even broken).</div>` });
    return true;
  }
  const body = spec.body ?? spec.max ?? fx.shiftBody(a.body, plan.power);
  const sides = (mods.toss ? 6 : 4) + tierUp + again;
  const n = Math.floor(body / 2);
  const type = a.arcane ? "arcane" : "physical";
  const notes = [];
  if (mods.muddy) notes.push(`Muddy: ${{ difficult: "the material becomes difficult terrain", dis: "all rolls made while using or wearing the object have Disadvantage", weak: "all damage dealt by it is Weakened", all: "difficult terrain, Disadvantage on rolls using the object, and Weakened damage" }[spec.muddy]}.`);
  if (mods.harden) notes.push(`Harden: ${{ strong: "all damage dealt by the material is Strengthened", armor: "all damage dealt to it is Weakened", terrain: "it loses all negative terrain modifiers", all: "all three" }[spec.harden]}.`);
  if (tierUp) notes.push(`Tier Up: the damage die is +${tierUp + again} sizes (d${sides}).`);
  const level = a.rider ? Math.max(1, Math.floor(body / 12)) : 0;
  if (a.rider) notes.push(`Charged with ${fx.profileFor([a.rider])?.name ?? a.rider} (level ${level}): it applies an extra effect once per turn per target on contact.`);
  if (a.stealth) notes.push("Hidden from normal viewing: the attack roll is made from stealth.");
  await post(actor, { title: `${esc(actor.name)} — ${esc(profile.name)}`, body: `<div class="fs-result"><i class="fa-solid fa-mountain"></i> ${body} Body of ${mods.toss ? "material is flung" : "connected material moves"}${mods.toss ? " (it needn't be connected)" : ""}; it returns to its place at the start of your next turn if it can.</div>
    ${notes.length ? `<ul class="fs-list">${notes.map(l => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}<div class="fs-notes">One piece must stay put; it must be Powder, Liquid or Soft material. 1 Body is about a cubic foot.</div>` });
  // Muddy (difficult terrain) and Harden (loses negative terrain modifiers) leave terrain on the scene where the material is.
  const ground = [];
  if (mods.muddy && ["difficult", "all"].includes(spec.muddy)) ground.push(await terrain.placeSpellTerrain({ actor, kind: "difficult", body, target, ritualOf, label: "Muddy ground" }));
  if (mods.harden && ["terrain", "all"].includes(spec.harden)) ground.push(await terrain.placeSpellTerrain({ actor, kind: "clear", body, target, ritualOf, label: "Hardened ground" }));
  if (ground.some(Boolean)) await post(actor, { title: `${esc(actor.name)} — Terrain`, body: `<ul class="fs-list">${ground.filter(Boolean).map(l => `<li>${esc(l)}</li>`).join("")}</ul>` });
  if (target) {
    const rider = a.rider ? { core: a.rider, level, charmRoll: null, hex: null, arcane: !!a.arcane } : null;
    await performAttack(actor, { label: mods.toss ? "Toss" : "Shift", net: mods.toss ? 0 : 1, stealth: a.stealth ? "half" : "none", magicStealth: !!a.stealth, melee: !mods.toss, area: false, push: false, damage: `${n}d${sides}`, type, stacks: mods.harden && !["armor", "terrain"].includes(spec.harden) ? 1 : 0, physical: false,
      shots: 1, critStacks: 0, pierce: 0, bash: 0, knockback: 0, notes: [mods.toss ? "Toss: ranged attack roll" : "Shift: melee attack roll with Advantage", `${n}d${sides} ${DAMAGE_TYPES[type] ?? type} (half the Body, rounded down)`],
      followups: [], targetActors: [target], ...(rider ? { rider } : {}), ...(spec.muddy && mods.muddy ? { muddy: { choice: spec.muddy, caster: actor.uuid, power: plan.power } } : {}) });
  }
  return true;
}

/* -------------------------------------------- */
/*  Mirage                                      */
/* -------------------------------------------- */

const tenth = actor => Math.max(1, Math.floor((actor.system.skillPoints ?? 0) / 10));
const expiry = () => (globalThis.game?.time?.worldTime !== undefined ? globalThis.game.time.worldTime + 60 : null);

/** A Mirage Spell hit: it takes hold and the target makes their first attack-roll check against its Power. */
export async function mirageHit({ attacker, target, o, result, profile }) {
  const sp = o.spell, a = profile.arcana, m = sp.mods ?? {}, ch = sp.arcana ?? {};
  const out = { html: "", rolls: [] };
  if (sp.ritualFree) { const r = Array.from(attacker.effects ?? []).find(e => e.id === sp.ritualFree); if (r) await r.update({ "flags.flowstate.ritual.freeCasts": 0 }); }
  const power = a.power * Math.max(1, sp.power);
  const slug = a.chart ? a.chart.split(":")[0].replace("magic-", "") : null;
  const chartText = a.chart === "magic-arcanomancy:strike" ? "The target believes their Magic has ultimately failed them: all their Magical attacks are at Disadvantage and Weakened, and prompt a Power check on cast."
    : slug ? COMBO_ILLUSION[slug === "witchery" ? "hex" : slug] : null;
  const fid = m.fidelity ? { kind: ch.fidelity === "dis" ? "dis" : "fear", roll: ch.fidelityRoll || "attack" } : null;
  const eff = { kind: "mirage", stack: true, onTargetTurn: !sp.ritualOf, caster: attacker.uuid, ritualOf: sp.ritualOf ?? null, ritual: !!sp.ritualOf, name: `${profile.name}${a.chart ? "" : ` (${ch.sense || "sight"})`}`,
    power, max: power, sense: ch.sense || "sight", chart: a.chart ?? null, chartText, magicFail: a.chart === "magic-arcanomancy:strike", pervasive: !!m.pervasive, phantom: m["phantom pain"] ? sp.power : 0, reshape: !!m.reshape,
    fidelity: fid, penalty: fid?.kind === "dis" ? { roll: fid.roll, amount: 1 } : null, aura: !!m.aura, expiresAt: sp.ritualOf ? null : expiry(), phantomTotal: 0, tests: 0,
    description: `A false impression with ${power} Power${chartText ? `: ${String(chartText).replace(/\*\*/g, "")}` : ""} Each turn its Power drops; the target's attack-roll check against it ends it.` };
  await putSpellEffect(target, eff);
  if (fid?.kind === "fear") await requestGM("setStatus", { target: target.uuid, status: "fear", active: true });
  out.html = `<div class="fs-notes">${esc(profile.name)} hit. The result goes to the caster and the GM.</div>`;
  const t = await testMirage(target, { ...eff }, { first: true });
  out.rolls.push(t.roll);
  await mirageCard(target, attacker, `${esc(attacker.name)} — ${esc(profile.name)}`, t);
  return out;
}

/** The whispered card for a Mirage test: what happened, and the buttons that still make sense. */
async function mirageCard(target, caster, title, t) {
  const acts = [{ act: "test", target: target.uuid, caster: caster.uuid }, { act: "reshape", target: target.uuid, caster: caster.uuid }, { act: "allow", target: target.uuid, caster: caster.uuid }];
  const buttons = t.ended ? "" : t.pending ? actRow(caster, 1, "reshape", "Reshape (3 RP): they fail instead") + actRow(caster, 2, "allow", "Let it end") : actRow(caster, 0, "test", "Test the Mirage");
  return secret(target, caster, { title, rolls: [t.roll], body: t.body + buttons, flags: { flowstate: { arcana: { acts } } } });
}
const actRow = (owner, i, act, label) => `<div class="fs-brawl-row fs-arcana-row" data-role="attacker" data-owner="${owner.uuid}"><button type="button" class="fs-arcana-act" data-i="${i}"><i class="fa-solid fa-eye"></i> ${esc(label)}</button></div>`;

/** The live Mirage effect on this creature from that caster (the latest). */
const liveMirage = (actor, casterUuid) => spellEffects(actor, "mirage").filter(e => data(e).caster === casterUuid).at(-1) ?? null;

/**
 * The target's attack roll against the Mirage's remaining Power. A pass ends it (a Ritual's loses Power twice instead); a failure loses a tenth
 * of their Skill Points. With Reshape and the target within 100 ft, a pass waits for the caster to Reshape it into a failure or let it go.
 */
async function testMirage(actor, d, { first = false } = {}) {
  const net = (d.fidelity && d.chart ? -1 : 0);
  const r = await roll(poolFormula(1, actor.system.derived.attackDie, net));
  const pass = r.total >= d.power;
  const live = liveMirage(actor, d.caster);
  let body = `<div class="fs-notes">${esc(actor.name)}: attack roll (d${actor.system.derived.attackDie}${net ? ", Disadvantage" : ""}) vs the Mirage's Power ${d.power}: <strong>${r.total}</strong> — ${pass ? "passed" : "failed"}.</div>`;
  if (pass && !d.ritual && d.reshape && await within100(actor, d.caster)) {
    return { roll: r, pass, body: body + `<div class="fs-result">It would end: Reshape (3 RP) makes it fail instead.</div>`, ended: false, pending: true };
  }
  if (pass && !d.ritual) {
    body += `<div class="fs-result">The Mirage ends for ${esc(actor.name)}.</div>`;
    if (live) await endMirage(actor, live);
    return { roll: r, pass, body, ended: true };
  }
  const res = await loseMirage(actor, live, { ...d }, tenth(actor) * (pass ? 2 : 1));
  return { roll: r, pass, body: body + res.html, ended: res.ended };
}
const within100 = async (actor, casterUuid) => {
  const caster = await fromUuid(casterUuid);
  const a = attackerToken(actor), b = caster ? attackerToken(caster) : null;
  return !a || !b || !globalThis.canvas?.grid || tokenDistance(a, b) <= 100;
};

/** The Mirage loses Power; Phantom Pain hurts; at 0 it's over. */
async function loseMirage(actor, live, d, lost) {
  const power = Math.max(0, d.power - lost);
  let html = `<div class="fs-notes">The Mirage loses ${lost} Power (${d.power} → ${power}).</div>`;
  let phantom = d.phantomTotal ?? 0;
  if (d.phantom) {
    const r = await roll(`${d.phantom}d6`);
    phantom += r.total;
    html += `<div class="fs-result">Phantom Pain: ${actor.name} takes ${r.total} illusion damage (${phantom} in all): it ignores protections and only counts toward their Pain Threshold. It disappears when no Mirage affects them.</div>`;
  }
  if (power <= 0) { if (live) await endMirage(actor, live); return { html: html + `<div class="fs-result">The Mirage is gone.</div>`, ended: true }; }
  if (live) await changeEffect(live, { "flags.flowstate.spellEffect.power": power, "flags.flowstate.spellEffect.phantomTotal": phantom, "flags.flowstate.spellEffect.tests": (d.tests ?? 0) + 1 });
  return { html, ended: false };
}

async function endMirage(actor, e) {
  const d = data(e);
  await changeEffect(e, null);
  if (d.fidelity?.kind === "fear" && !spellEffects(actor, "mirage").some(x => x !== e && data(x).fidelity?.kind === "fear")) await requestGM("setStatus", { target: actor.uuid, status: "fear", active: false });
}

/** Start of the target's turn: every Mirage loses Power (unless Pervasive), and old ones fade. */
export async function turnStart(actor) {
  for (const e of spellEffects(actor, "mirage")) {
    const d = data(e);
    if (d.expiresAt != null && globalThis.game?.time?.worldTime !== undefined && globalThis.game.time.worldTime >= d.expiresAt) { await endMirage(actor, e); continue; }
    if (d.pervasive) continue;
    const caster = await fromUuid(d.caster);
    const res = await loseMirage(actor, e, d, tenth(actor));
    await secret(actor, caster, { title: `${esc(actor.name)} — Mirage`, body: res.html });
  }
}

/** Is the creature under a Magic-failing Mirage (Illusion + Arcanomancy)? */
export const magicFails = actor => spellEffects(actor, "mirage").some(e => data(e).magicFail);

/** A button on a Mirage card: test it, Reshape a pass into a failure, or let it end. */
export async function act(message, i = 0) {
  const x = message.getFlag("flowstate", "arcana")?.acts?.[Number(i)];
  if (!x) return;
  const target = await fromUuid(x.target), caster = await fromUuid(x.caster);
  if (!target || !caster?.isOwner) return ui.notifications.warn("Only the caster (or the GM) can do that.");
  if (x.act === "aura") return auraAttack(caster, target);
  const e = liveMirage(target, x.caster);
  if (!e) return ui.notifications.info("That Mirage is over.");
  const d = data(e);
  if (x.act === "allow") { await endMirage(target, e); return secret(target, caster, { title: `${esc(caster.name)} — Mirage`, body: `<div class="fs-result">The Mirage ends for ${esc(target.name)}.</div>` }); }
  if (x.act === "reshape") {
    if (!(await spendPoints(caster, "rp", 3, "Reshape"))) return;
    const loss = tenth(target);
    const power = Math.min(d.max, d.power + loss);
    await changeEffect(e, { "flags.flowstate.spellEffect.power": power });
    return secret(target, caster, { title: `${esc(caster.name)} — Reshape`, body: `<div class="fs-result">${esc(target.name)} fails instead: the Mirage's Power rises by ${loss} to ${power}.</div>` });
  }
  const t = await testMirage(target, d);
  await mirageCard(target, caster, `${esc(caster.name)} — Mirage`, t);
}

/** The aura: the creatures within 50 ft of the caster who get an attack roll made against them on cast. */
export function auraTargets(actor) {
  const src = attackerToken(actor);
  if (!src || !globalThis.canvas?.grid) return [];
  const out = [], seen = new Set();
  for (const t of globalThis.canvas.tokens.placeables) {
    const a = t.actor;
    if (!a || a.type === "pile" || a.uuid === actor.uuid || seen.has(a.uuid)) continue;
    if (tokenDistance(src, t) <= 50) { seen.add(a.uuid); out.push(a); }
  }
  return out;
}



/* -------------------------------------------- */
/*  Spells as targets: Strike, Absorb, Amplify, Rip */
/* -------------------------------------------- */

const SPELLISH = new Set(["shield", "poison", "coat", "charm", "hex", "mirage", "dodgeDie", "attackDie", "dodgeDis", "field", "hold", "brand", "freeze", "scorch", "painless", "magicDis", "delayed", "held", "heatRad", "bleed", "gash", "muddy", "aura"]);
const allActors = () => {
  const seen = new Set(), out = [];
  for (const a of globalThis.game?.actors ?? []) if (!seen.has(a.uuid)) { seen.add(a.uuid); out.push(a); }
  for (const t of globalThis.canvas?.tokens?.placeables ?? []) { const a = t.actor; if (a && !seen.has(a.uuid)) { seen.add(a.uuid); out.push(a); } }
  return out;
};
/** A caster's Scaling Stat (the lesser of Reach and Grasp): the health of a Spell that doesn't state its own, and its Power. */
const casterScaling = c => Math.min(c?.system?.derived?.effective?.reach?.value ?? 0, c?.system?.derived?.effective?.grasp?.value ?? 0);
const spellPowerOf = c => Math.max(1, Math.floor(casterScaling(c) / 10));

/** Every Spell on the scene: effects, Emplace barriers, Summons and Animations. Each: { id, label, kind, caster, hp, power, ritualOf, amplified }. */
export function listSpells() {
  const out = [];
  for (const a of allActors()) {
    const sm = a.flags?.flowstate?.summon;
    if (sm) out.push({ id: `summon:${a.uuid}`, kind: "summon", label: `${a.name} (${sm.kind ?? "summon"})`, caster: sm.owner, hp: a.system.hp.value, power: spellPowerOf(globalThis.fromUuidSync?.(sm.owner)), ritualOf: sm.ritualOf, amplified: !!sm.amplified });
    for (const e of a.effects ?? []) {
      const d = data(e);
      if (e.disabled || !d.caster || !SPELLISH.has(d.kind)) continue;
      const caster = globalThis.fromUuidSync?.(d.caster);
      out.push({ id: `effect:${e.uuid}`, kind: "effect", label: `${e.name} on ${a.name}`, caster: d.caster, hp: d.kind === "shield" ? Number(d.hp) || 0 : d.spellHp ?? casterScaling(caster), power: d.power ?? spellPowerOf(caster), ritualOf: e.flags?.flowstate?.ritualOf ?? null, amplified: !!d.amplified, effect: e });
    }
  }
  // Spells that are mid cast: the attack has been rolled and nobody has answered it yet. Another caster can Strike them.
  for (const m of globalThis.game?.messages?.filter?.(x => x.getFlag?.("flowstate", "attack")?.opts?.spell) ?? []) {
    const at = m.getFlag("flowstate", "attack");
    if (findCancel(m.id)) continue;
    const open = at.targets.filter((t, i) => !findDefense(m.id, i));
    if (!open.length) continue;
    const caster = globalThis.fromUuidSync?.(at.attacker);
    const sp = at.opts.spell;
    out.push({ id: `cast:${m.id}`, kind: "cast", label: `${at.opts.label ?? "A spell"} by ${caster?.name ?? "someone"}, mid cast (attack ${Math.max(...open.map(t => t.total ?? 0))})`, caster: at.attacker,
      hp: sp.hpLeft ?? casterScaling(caster), power: sp.power ?? spellPowerOf(caster), ritualOf: sp.ritualOf ?? null, amplified: !!sp.amplified,
      message: m, attackTotal: Math.max(...open.map(t => t.total ?? 0)), opts: at.opts });
  }
  for (const t of globalThis.canvas?.scene?.templates ?? []) {
    const f = t.flags?.flowstate;
    if (f?.spell !== "emplace" || !(f.health > 0)) continue;
    const caster = globalThis.fromUuidSync?.(f.casterUuid ?? f.areaOf);
    out.push({ id: `barrier:${globalThis.canvas.scene.id}:${t.id}`, kind: "barrier", label: "Emplace barrier", caster: f.casterUuid ?? f.areaOf, hp: f.health, power: spellPowerOf(caster), ritualOf: f.ritualOf ?? null, amplified: !!f.amplified, sceneId: globalThis.canvas.scene.id, tplId: t.id, tpl: t });
  }
  return out;
}
export const findSpell = id => listSpells().find(x => x.id === id) ?? null;

/** Damage a Spell; it's destroyed at 0. Returns { destroyed, left }. */
async function damageSpell(entry, amount) {
  const left = Math.max(0, entry.hp - amount);
  if (entry.kind === "cast") {
    if (left <= 0) await cancelCast(entry, "a Strike destroyed it");
    else await requestGM("castChange", { id: entry.message.id, hpLeft: left });
  } else if (entry.kind === "summon") {
    const a = await fromUuid(entry.id.slice(7));
    await requestDamage(a, amount, "arcane", 0, null, { silent: true, bypass: true });
  } else if (entry.kind === "barrier") {
    await requestGM("barrier", { sceneId: entry.sceneId, id: entry.tplId, hp: left });
  } else if (left <= 0) await changeEffect(entry.effect, null);
  else if (data(entry.effect).kind === "shield") await changeEffect(entry.effect, { "flags.flowstate.spellEffect.hp": left, description: `Absorbs the next ${left} damage.` });
  else await changeEffect(entry.effect, { "flags.flowstate.spellEffect.spellHp": left });
  return { destroyed: left <= 0, left };
}
/** A spell destroyed or taken mid cast never lands: a card says so, and the attack card loses its response buttons. */
async function cancelCast(entry, reason) {
  const caster = globalThis.fromUuidSync?.(entry.caster);
  await post(caster ?? game.user, { title: `${esc(caster?.name ?? "A caster")} — spell countered`, body: `<div class="fs-result"><i class="fa-solid fa-ban"></i> ${esc(entry.label)} is countered: ${esc(reason)}.</div>`,
    flags: { flowstate: { spellCancelled: { attackMessage: entry.message.id, reason } } } });
}
async function destroySpell(entry, reason = "it dissipates") {
  if (entry.kind === "cast") return cancelCast(entry, reason);
  if (entry.kind === "summon") return requestGM("deleteCreation", { actorId: (await fromUuid(entry.id.slice(7))).id });
  if (entry.kind === "barrier") return requestGM("barrier", { sceneId: entry.sceneId, id: entry.tplId, hp: 0 });
  return changeEffect(entry.effect, null);
}

/** Amplify (Arcanomancy T4): +10 Power to a non-Ritual Spell, once. Only effects that scale with Power change. */
async function amplifySpell(entry) {
  if (entry.ritualOf) return "Amplify only works on non-Ritual Spells.";
  if (entry.amplified) return "That Spell has already been amplified.";
  if (entry.kind === "cast") {
    // Mid cast it can still be changed: +10 Power, so its dice, health and Force (everything the card works out later) scale up.
    const p = Math.max(1, entry.power), dmg = String(entry.opts.damage ?? "").match(/^(\d+)d(\d+)$/);
    const upd = { id: entry.message.id, power: p + 10 };
    if (dmg) upd.damage = `${Math.round(Number(dmg[1]) / p * (p + 10))}d${dmg[2]}`;
    await requestGM("castChange", upd);
    return `${entry.label} is amplified: Power ${p} → ${p + 10}${upd.damage ? `, ${dmg[0]} → ${upd.damage}` : ""}. It lands with the new numbers.`;
  }
  if (entry.kind === "barrier") {
    await requestGM("tplFlags", { sceneId: entry.sceneId, id: entry.tplId, flags: { health: entry.tpl.flags.flowstate.health + 200, limit: (entry.tpl.flags.flowstate.limit ?? entry.tpl.flags.flowstate.health) + 200, amplified: true } });
    return `The barrier gains 200 health (20 × 10 Power).`;
  }
  if (entry.kind === "summon") return "A Summon's stats don't scale with Power: nothing changes.";
  const d = data(entry.effect), p = Math.max(1, d.power ?? 1);
  const upd = { "flags.flowstate.spellEffect.amplified": true };
  let msg;
  if (d.kind === "shield") { upd["flags.flowstate.spellEffect.hp"] = d.hp + 200; upd["flags.flowstate.spellEffect.max"] = (d.max ?? d.hp) + 200; msg = "The Shield gains 200 health (20 × 10 Power)."; }
  else if (["poison", "coat", "hex", "charm"].includes(d.kind) && d.n) { const n = Math.round(d.n / p * (p + 10)); upd["flags.flowstate.spellEffect.n"] = n; upd["flags.flowstate.spellEffect.power"] = p + 10; msg = `Its dice go from ${d.n} to ${n}.`; }
  else if (d.kind === "mirage") { upd["flags.flowstate.spellEffect.max"] = d.max + 100; upd["flags.flowstate.spellEffect.power"] = d.power + 100; msg = "The Mirage gains 100 Power."; }
  else if (d.kind === "painless") { upd["flags.flowstate.spellEffect.painDown"] = d.painDown + 30; msg = "Pain Threshold drops 30 more."; }
  else return "That Spell has no Power-scaled number to amplify: nothing changes.";
  await changeEffect(entry.effect, upd);
  return msg;
}

/** Rip (Arcanomancy T5): take control of a Spell with 5 or less Power, then redirect it or dissipate it. */
async function ripSpell(entry, caster, mode, newTarget, ritualOf) {
  if (entry.power > 5) return `That Spell has ${entry.power} Power: Rip needs 5 or less.`;
  if (entry.kind === "cast") {
    await cancelCast(entry, `${caster.name} Ripped it`);
    if (mode !== "redirect" || !newTarget) return `${entry.label} dissipates.`;
    // Redirected: the same spell goes at the new target as a fresh attack roll, now under the Ripper's control.
    await performAttack(caster, { ...entry.opts, targetActors: [newTarget], spell: { ...entry.opts.spell, ritualOf: null, hpLeft: undefined } });
    return `${entry.label} is redirected to ${newTarget.name} (under ${caster.name}'s control, with a new attack roll).`;
  }
  if (mode !== "redirect" || !newTarget || entry.kind === "barrier") { await destroySpell(entry); return `${entry.label} dissipates.`; }
  if (entry.kind === "summon") {
    await requestGM("takeControl", { actor: entry.id.slice(7), caster: caster.uuid });
    return `${caster.name} takes control of ${entry.label}.`;
  }
  const e = entry.effect, d = { ...data(e) };
  await changeEffect(e, null);
  await putSpellEffect(newTarget, { ...d, caster: caster.uuid, ritualOf: ritualOf ?? e.flags?.flowstate?.ritualOf ?? null, name: e.name, description: e.description });
  return `${e.name} is redirected to ${newTarget.name} (under ${caster.name}'s control).`;
}

GM_ACTIONS.tplFlags = async ({ sceneId, id, flags }) => {
  const d = globalThis.game.scenes.get(sceneId)?.templates?.get(id);
  if (d) await d.update(Object.fromEntries(Object.entries(flags).map(([k, v]) => [`flags.flowstate.${k}`, v])));
};
GM_ACTIONS.takeControl = async ({ actor, caster }) => {
  const a = await fromUuid(actor), c = await fromUuid(caster);
  if (!a || !c) return;
  const ownership = { ...(a.ownership ?? {}) };
  for (const [uid, lvl] of Object.entries(c.ownership ?? {})) if (uid !== "default" && lvl >= 3) ownership[uid] = 3;
  await a.update({ ownership, "flags.flowstate.summon.owner": c.uuid });
};

/** Before payment: which Spell a Strike goes for (needed by Amplify and Rip), and Rip's choices. Returns a spec, or null if the cast can't happen. */
export async function promptSpell({ actor, plan, mods, values }) {
  const need = mods.amplify || mods.rip;
  const id = values.strikeSpell;
  if (!id) { if (need) { ui.notifications.warn("Pick the Spell to target."); return null; } return {}; }
  const entry = findSpell(id);
  if (!entry) { ui.notifications.warn("That Spell is gone."); return null; }
  if (mods.amplify && entry.ritualOf) { ui.notifications.warn("Amplify only works on non-Ritual Spells."); return null; }
  if (mods.amplify && entry.amplified) { ui.notifications.warn("That Spell has already been amplified."); return null; }
  if (mods.rip && entry.power > 5) { ui.notifications.warn(`That Spell has ${entry.power} Power: Rip needs 5 or less.`); return null; }
  const spec = { id };
  if (mods.rip) {
    spec.mode = values.ripMode === "redirect" ? "redirect" : "dissipate";
    if (spec.mode === "redirect") {
      const t = values.ripTarget ? await fromUuid(values.ripTarget) : await pickSceneTarget(actor, { title: "Rip: redirect it to", exclude: [] });
      if (!t) return null;
      spec.target = t.uuid;
    }
  }
  return spec;
}

/** After payment: a Strike aimed at a Spell. */
export async function resolveStrike({ actor, plan, profile, mods, spec, ritualOf }) {
  const entry = findSpell(spec.id);
  if (!entry) return post(actor, { title: `${esc(actor.name)} — Strike`, body: `<div class="fs-result">The Spell is already gone.</div>` });
  let body;
  // A spell that is mid cast can only be hit if the Strike's attack roll beats the cast's attack roll.
  if (entry.kind === "cast") {
    const d = actor.system.derived;
    const net = 1 + (mods.pinpoint ? 1 : 0);                                   // Strike has Advantage against magic
    const atk = await roll(poolFormula(1, d.attackDie, net));
    if (!(atk.total > entry.attackTotal)) {
      return post(actor, { title: `${esc(actor.name)} — Strike a Spell`, body: `<div class="fs-result"><i class="fa-solid fa-burst"></i> Strike rolls ${atk.total} against the cast's ${entry.attackTotal}: it doesn't beat it, so ${esc(entry.label)} is untouched.</div>` });
    }
    var castNote = `Strike rolls ${atk.total}, beating the cast's ${entry.attackTotal}. `;
  }
  if (mods.amplify) body = await amplifySpell(entry);
  else if (mods.rip) body = await ripSpell(entry, actor, spec.mode, spec.target ? await fromUuid(spec.target) : null, plan.freeFrom ? (Array.from(actor.effects).find(e => e.id === plan.freeFrom)?.uuid ?? null) : null);
  else {
    const dmg = await roll(`${profile.damage.n * Math.max(1, plan.power)}d${profile.damage.sides}`);
    const res = await damageSpell(entry, dmg.total);
    body = `Strike hits ${entry.label} for ${dmg.total} arcane (${entry.hp} health → ${res.left}).${res.destroyed ? " <strong>It is destroyed.</strong>" : ""}`;
    if (res.destroyed && mods.absorb) {
      const gain = entry.power, maxE = actor.system.energy.max, haveE = actor.system.energy.value;
      const upd = { "system.energy.value": Math.min(maxE, haveE + gain) };
      if (actor.isOwner) await actor.update(upd); else await requestGM("updateActor", { uuid: actor.uuid, data: upd });
      body += ` Absorb: ${esc(actor.name)} regains <strong>${gain} Energy</strong>.`;
    }
  }
  await post(actor, { title: `${esc(actor.name)} — Strike a Spell`, body: `<div class="fs-result"><i class="fa-solid fa-burst"></i> ${typeof castNote === "string" ? castNote : ""}${body}</div>` });
}

/* -------------------------------------------- */
/*  Anti-Magic field (Blast Ritual) and Aura entrants */
/* -------------------------------------------- */

const isMagical = a => !!(a && (a.system?.magical || a.flags?.flowstate?.summon));
const antimagic = () => Array.from(globalThis.canvas?.scene?.templates ?? []).filter(t => t.flags?.flowstate?.spell === "antimagic");
async function antimagicDamage(actor, power, casterName) {
  const p = fx.PROFILES["magic-arcanomancy:strike"].damage;
  const r = await roll(`${p.n * Math.max(1, power)}d${p.sides}`);
  await requestDamage(actor, r.total, "arcane", 0, null, { silent: true, archetype: "magic" });
  await post(actor, { title: `${esc(actor.name)} — Anti-Magic field`, rolls: [r], body: `<div class="fs-result">${esc(casterName)}'s anti-magic field deals ${r.total} arcane damage to ${esc(actor.name)}.</div>` });
}
/** Start of the caster's turn: the field hurts every magical thing inside it. */
export async function antimagicTurn(caster) {
  const grid = globalThis.canvas?.grid;
  if (!grid) return;
  for (const t of antimagic().filter(x => x.flags.flowstate.casterUuid === caster.uuid)) {
    const tpl = { t: t.t, x: t.x, y: t.y, direction: t.direction, distance: t.distance, angle: t.angle, width: t.width };
    const inside = areas.tokensInArea(tpl, globalThis.canvas.tokens.placeables.filter(k => isMagical(k.actor)), { size: grid.size, distance: grid.distance });
    for (const tok of inside) await antimagicDamage(tok.actor, t.flags.flowstate.power ?? 1, caster.name);
  }
}

/** A token is about to move: damage for entering an anti-magic field; Aura entrants get offered an attack roll. */
export async function checkEntry(token, changes) {
  const canvas = globalThis.canvas;
  if (!canvas?.scene || !canvas.grid || !("x" in changes || "y" in changes)) return;
  const grid = { size: canvas.grid.size, distance: canvas.grid.distance };
  const at = (x, y) => ({ document: { x, y, width: token.width, height: token.height } });
  const before = at(token.x, token.y), after = at(changes.x ?? token.x, changes.y ?? token.y);
  const actor = token.actor;
  if (!actor) return;
  if (isMagical(actor)) for (const t of antimagic()) {
    const tpl = { t: t.t, x: t.x, y: t.y, direction: t.direction, distance: t.distance, angle: t.angle, width: t.width };
    if (areas.tokensInArea(tpl, [after], grid).length && !areas.tokensInArea(tpl, [before], grid).length) await antimagicDamage(actor, t.flags.flowstate.power ?? 1, (await fromUuid(t.flags.flowstate.casterUuid))?.name ?? "a caster");
  }
  const centre = p => ({ x: p.document.x + p.document.width * grid.size / 2, y: p.document.y + p.document.height * grid.size / 2 });
  for (const a of allActors()) for (const e of spellEffects(a, "aura")) {
    const d = data(e);
    if (d.expiresAt != null && globalThis.game?.time?.worldTime >= d.expiresAt) continue;
    if ((d.affected ?? []).includes(actor.uuid) || actor.uuid === a.uuid) continue;
    const src = attackerToken(a);
    if (!src) continue;
    const dist = p => canvas.grid.measurePath([src.center, centre(p)]).distance;
    if (dist(after) <= 50 && dist(before) > 50) {
      await secret(actor, a, { title: `${esc(a.name)} — Aura`, body: `<div class="fs-result">${esc(actor.name)} enters the aura: make the attack roll against them.</div>`, flags: { flowstate: { arcana: { acts: [{ act: "aura", target: actor.uuid, caster: a.uuid }] } } },
        });
    }
  }
}

/** The caster makes the aura's attack roll against someone who walked in. */
async function auraAttack(caster, target) {
  const e = spellEffects(caster, "aura")[0];
  if (!e) return ui.notifications.info("The aura is over.");
  const d = data(e);
  await changeEffect(e, { "flags.flowstate.spellEffect.affected": [...(d.affected ?? []), target.uuid] });
  return performAttack(caster, { ...d.opts, area: false, targetActors: [target], spell: { ...d.opts.spell, singleRoll: false }, notes: [...(d.opts.notes ?? []), "Aura: they walked in"] });
}

registerArcana({ mirageHit, magicFails, turnStart, act, lossSince, antimagicTurn, checkEntry });
