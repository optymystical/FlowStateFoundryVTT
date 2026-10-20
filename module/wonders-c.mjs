/**
 * Light (Dream) and Dark (Nightmare) (Mental Rework Test Ground): Illuminate and Eclipse (an enemy version and an ally version, picked by the target's side),
 * their Tenets (Beacon, Shadowmark), Refraction / Penumbra (spread), Convergence, Totality, Dispersion, Umbral Strike and Corona / Nightfall.
 * They register into wonders.mjs (`MODES`, `ACTS`, the provider lists); mental.mjs calls `attackStart`, `attackDieAgainst`, `dodgeDieAgainst`,
 * `disperseResolve` and `expandResolve` through `registerMental` / its resolve step.
 */
import { post, putSpellEffect, spellEffects, changeEffect, setActorFlag, tokenDistance, attackerToken, requestDamage, requestGM } from "./actions.mjs";
import { stackMultiplier, applyStacks } from "./rules.mjs";
import * as ab from "./abilities.mjs";
import * as R from "./mental-rules.mjs";
import { askFor, actorsInPlay } from "./ask.mjs";
import { tierOf } from "./skills.mjs";
import { allied, opposed } from "./sides.mjs";
import { mental, bold, MODES, ACTS, ACT_PROVIDERS, DAMAGE_PROVIDERS, TURN_START, rolled, tenetOf, tryOnce } from "./wonders.mjs";
import { notCreature } from "./kinds.mjs";
import { esc } from "./html.mjs";

const LIGHT = "mental-light-dream", DARK = "mental-dark-nightmare";
const ILLUMINATE = `${LIGHT}:illuminate`, ECLIPSE = `${DARK}:eclipse`;
const tier = (actor, id) => tierOf(actor?.system?.trees ?? {}, id);
const minOf = (a, k) => ab.statMinOf(a, k);
const fromU = u => globalThis.fromUuidSync?.(u) ?? null;
const dataOf = e => e.flags.flowstate.spellEffect;
const fx = (actor, kind) => (actor ? spellEffects(actor, kind) : []);
const live = a => a && !notCreature(a);
/** The biggest value of a spell-effect field on an actor (the derived die penalties use the same rule: the worst one applies). */
const penOf = (actor, key) => Math.max(0, ...(actor?.effects ?? []).filter(e => !e.disabled).map(e => Number(e.flags?.flowstate?.spellEffect?.[key]) || 0));
const near = (a, b, ft) => { const ta = attackerToken(a), tb = attackerToken(b); return !!ta && !!tb && !!globalThis.canvas?.grid && tokenDistance(ta, tb) <= ft; };
const reachOf = (actor, range) => (range === "melee" ? (actor.system.derived?.size?.melee ?? 5) : 100);

/* -------------------------------------------- */
/*  Illuminate and Eclipse                      */
/* -------------------------------------------- */

/** Which version of the Mode this target gets: the ally one for a creature on your side, the enemy one for the other side; a neutral one is asked. */
async function versionFor(caster, target, name) {
  if (allied(caster, target)) return "ally";
  if (opposed(caster, target)) return "enemy";
  return (await mental.pickChoice(caster, `${name} on ${target.name}`, [["enemy", "Against an enemy"], ["ally", "Against an ally"]])) ?? "enemy";
}

/** One step more obscured (none → lightly → heavily): a marker for the GM, the system has no obscurement of its own. */
async function obscure(target, caster) {
  const level = Math.min(2, Math.max(0, ...fx(target, "obscured").map(e => dataOf(e).level ?? 0)) + 1);
  await putSpellEffect(target, { kind: "obscured", caster: caster.uuid, name: level === 1 ? "Lightly obscured" : "Heavily obscured", level, replaceAll: true,
    description: `${level === 1 ? "Lightly" : "Heavily"} obscured (the GM applies what that means) until the start of ${caster.name}'s next turn.` });
  return level === 1 ? "lightly" : "heavily";
}

async function applyIlluminate(caster, target, side, { power, enhanced, bs, mode = ILLUMINATE }) {
  const pen = bold(bs, power);
  const weak = enhanced ? " Damage dealt by an attack affected by this is Weakened." : "";
  if (side === "enemy") {
    await putSpellEffect(target, { kind: "illuminated", caster: caster.uuid, name: "Illuminated", attackDie: pen, enhanced, power, bstacks: bs, mode,
      description: `Attack rolls have their die size reduced by ${pen}; can't be naturally obscured or benefit from half cover.${weak} Until the start of ${caster.name}'s next turn.` });
    return `<strong>${esc(target.name)}</strong> is Illuminated: their attack rolls have their die size reduced by <strong>${pen}</strong>${enhanced ? " and the damage of those attacks is Weakened" : ""}.`;
  }
  await putSpellEffect(target, { kind: "illumWard", caster: caster.uuid, name: "Illuminated (ally)", attackAgainst: pen, enhanced, power, bstacks: bs, mode,
    description: `Attack rolls against them have their die size reduced by ${pen} (not those of ${caster.name}'s allies).${weak} Until the start of ${caster.name}'s next turn.` });
  return `Attacks against <strong>${esc(target.name)}</strong> have their die size reduced by <strong>${pen}</strong>${enhanced ? " and their damage is Weakened" : ""} (their allies' attacks are unaffected).`;
}

/** Half a die size per Power (scaled by the Manifest's stacks), the new die rounded down: the penalty is the reduction rounded up. */
const halfDie = (power, bs) => Math.ceil(0.5 * power * stackMultiplier(Number(bs) || 0) - 1e-9);

async function applyEclipse(caster, target, side, { power, enhanced, bs, mode = ECLIPSE }) {
  const pen = halfDie(power, bs);
  const str = enhanced ? " Damage dealt by an attack affected by this is Strengthened." : "";
  if (side === "enemy") {
    await putSpellEffect(target, { kind: "eclipsed", caster: caster.uuid, name: "Eclipsed", dodgeDie: pen, enhanced, power, bstacks: bs, mode,
      description: `Dodge rolls have their die size reduced by ${pen}.${str} Until the start of ${caster.name}'s next turn.` });
    return `<strong>${esc(target.name)}</strong> is Eclipsed: their dodge rolls have their die size reduced by <strong>${pen}</strong>${enhanced ? ", and damage from the attacks it affects is Strengthened" : ""}.`;
  }
  await putSpellEffect(target, { kind: "eclipseWard", caster: caster.uuid, name: "Eclipsed (ally)", dodgeAgainst: pen, enhanced, power, bstacks: bs, mode,
    description: `Their attacks make targets' dodge rolls have their die size reduced by ${pen}, and they are one step more obscured.${str} Until the start of ${caster.name}'s next turn.` });
  const step = await obscure(target, caster);
  return `<strong>${esc(target.name)}</strong>'s attacks make their targets' dodge rolls have their die size reduced by <strong>${pen}</strong>${enhanced ? " and Strengthen the damage" : ""}; they are one step more obscured (${step}).`;
}

for (const [id, apply, name] of [[ILLUMINATE, applyIlluminate, "Illuminate"], [ECLIPSE, applyEclipse, "Eclipse"]]) {
  MODES[id] = async c => {
    if (!live(c.target)) return `<strong>${name}</strong> must be used on a creature.`;
    const side = await versionFor(c.attacker, c.target, name);
    const out = await apply(c.attacker, c.target, side, { power: c.power, enhanced: !!c.enhanced, bs: c.bs ?? c.stacks ?? 0 });
    return `${out}<div class="fs-notes">${side === "ally" ? "Against an ally" : "Against an enemy"}. Until the start of your next turn.</div>`;
  };
}

/** Convergence (Light T3): both Illuminate effects stack with one another; until then only the worse one applies. Called as an attack die is worked out. */
export function attackDieAgainst(attacker, target) {
  if (!attacker || !target) return null;
  const wards = fx(target, "illumWard").filter(e => { const c = fromU(dataOf(e).caster); return !c || (c.uuid !== attacker.uuid && !allied(c, attacker)); });
  if (!wards.length) return null;
  const best = wards.reduce((m, e) => (dataOf(e).attackAgainst > dataOf(m).attackAgainst ? e : m));
  const d = dataOf(best), caster = fromU(d.caster);
  const extra = caster && tier(caster, LIGHT) >= 3 ? d.attackAgainst : Math.max(0, d.attackAgainst - penOf(attacker, "attackDie"));
  return extra ? { pen: extra, note: `Illuminate (ally): attack die −${extra}` } : null;
}

/** An Eclipsed ally's attacks shrink their targets' dodge dice (it doesn't stack with the target being Eclipsed itself). */
export function dodgeDieAgainst(attacker, target) {
  if (!attacker || !target) return null;
  const wards = fx(attacker, "eclipseWard");
  if (!wards.length) return null;
  const best = Math.max(...wards.map(e => dataOf(e).dodgeAgainst || 0));
  const extra = Math.max(0, best - penOf(target, "dodgeDie"));
  return extra ? { pen: extra, note: `Eclipse (ally): dodge die −${extra}` } : null;
}

/** Enhanced Illuminate Weakens, Enhanced Eclipse Strengthens, the damage of the attacks they affect; Umbral Strike adds 1d4 of the damage's type. */
DAMAGE_PROVIDERS.push(async ({ attacker, target, n, notes }) => {
  let out = n;
  const wardHits = effs => effs.some(e => { const c = fromU(dataOf(e).caster); return dataOf(e).enhanced && (!attacker || !c || (c.uuid !== attacker.uuid && !allied(c, attacker))); });
  if (attacker && (fx(attacker, "illuminated").some(e => dataOf(e).enhanced) || wardHits(fx(target, "illumWard")))) { out = applyStacks(out, -1); notes.push("Illuminate (Enhanced): the damage is Weakened"); }
  if (fx(target, "eclipsed").some(e => dataOf(e).enhanced) || (attacker && fx(attacker, "eclipseWard").some(e => dataOf(e).enhanced))) { out = applyStacks(out, 1); notes.push("Eclipse (Enhanced): the damage is Strengthened"); }
  const u = attacker?.getFlag?.("flowstate", "umbral");
  if (u) {
    await setActorFlag(attacker, "umbral", null);          // read before clearing: the charge's Power and stacks
    const r = await new Roll(`${u?.power ?? 1}d4`).evaluate(); rolled.push(r);
    const add = bold(u?.bs ?? 0, r.total);
    out += add; notes.push(`Umbral Strike: +${add} damage (${u?.power ?? 1}d4)`);
  }
  return out;
});

/* -------------------------------------------- */
/*  Tenets and spreading                        */
/* -------------------------------------------- */

ACT_PROVIDERS.push(async c => {
  const a = c.attacker, tn = tenetOf(a), out = [];
  const base = { target: c.target.uuid, caster: a.uuid, mode: c.mode.id, power: c.power, enhanced: !!c.enhanced, range: c.range, choices: c.choices ?? {}, crit: !!c.crit, bstacks: c.bs ?? c.stacks ?? 0 };
  if (tn && !c.m.spread && !c.now) {
    if (tn.id === `${LIGHT}:beacon`) out.push({ tenet: true, id: "beacon", label: "Beacon", tip: "Once per round: you and your allies can see the target through any obstruction until your next turn", cost: "once per round", ...base });
    if (tn.id === `${DARK}:shadowmark`) out.push({ tenet: true, id: "shadowmark", label: "Shadowmark", tip: "Once per round: make the target or yourself one step more obscured until your next turn", cost: "once per round", ...base });
  }
  if (!c.m.spread && !c.now) {
    if (c.mode.id === ILLUMINATE && tier(a, LIGHT) >= 2) out.push({ id: "refraction", label: "Refraction", tip: "Spread this Illuminate to another creature within the Mental attack range (an attack roll)", cost: `⚡ ${Math.floor(minOf(a, "pon") / 2)}`, ...base });
    if (c.mode.id === ECLIPSE && tier(a, DARK) >= 2) out.push({ id: "penumbra", label: "Penumbra", tip: "Spread this Eclipse to another creature within the Mental attack range (an attack roll)", cost: `⚡ ${Math.floor(minOf(a, "snap") / 2)}`, ...base });
  }
  return out;
});

ACTS.beacon = async (x, caster, target) => {
  if (!(await tryOnce(caster, "beacon"))) { ui.notifications.info("Beacon: already used this round."); return false; }
  await putSpellEffect(target, { kind: "beacon", caster: caster.uuid, name: "Beacon", description: `${caster.name} and their allies can see them through any obstruction until the start of ${caster.name}'s next turn.` });
  await post(caster, { title: `${esc(caster.name)} — Beacon`, body: `<div class="fs-result">${esc(caster.name)} and their allies can see <strong>${esc(target.name)}</strong> through any obstruction until ${esc(caster.name)}'s next turn.</div>` });
  return true;
};
ACTS.shadowmark = async (x, caster, target) => {
  if (!(await tryOnce(caster, "shadowmark"))) { ui.notifications.info("Shadowmark: already used this round."); return false; }
  const who = await mental.pickOne(caster, [target, caster], "Shadowmark: make one step more obscured");
  if (!who) return false;
  const step = await obscure(who, caster);
  await post(caster, { title: `${esc(caster.name)} — Shadowmark`, body: `<div class="fs-result"><strong>${esc(who.name)}</strong> is one step more obscured (${step}) until ${esc(caster.name)}'s next turn.</div>` });
  return true;
};

/** Refraction and Penumbra: pay, pick another creature in range, and Manifest the same Mode at it for free (the version suits the new target). */
const spreadAct = (stat, label) => async (x, caster, target) => {
  const mode = R.modeById(x.mode);
  const cost = Math.floor(minOf(caster, stat) / 2);
  if (!(await mental.pay(caster, { energy: cost }, label))) return false;
  const picked = await mental.pickAnother(caster, { title: `${label}: spread it to`, within: reachOf(caster, x.range), exclude: [target?.uuid] });
  if (!picked) return false;
  await mental.manifestAt(caster, mode, picked, { power: x.power, enhanced: x.enhanced, range: x.range === "melee" ? "melee" : "ranged", choices: x.choices, spread: true, label });
  return true;
};
ACTS.refraction = spreadAct("pon", "Refraction");
ACTS.penumbra = spreadAct("snap", "Penumbra");

/* -------------------------------------------- */
/*  Totality and Umbral Strike                  */
/* -------------------------------------------- */

const STEP = { none: "half", half: "full", full: "full" };

/** Just before an attack is rolled: Totality (an Eclipsed ally attacking an Eclipsed target is in half stealth) and Umbral Strike (a charge: a step deeper into stealth and 1d4 more). */
export async function attackStart(actor, opts, targets) {
  let o = opts;
  if (actor.getFlag?.("flowstate", "umbral")) await setActorFlag(actor, "umbral", null);          // last attack's bonus never carries over
  if (targets.length === 1 && (o.stealth ?? "none") === "none") {
    const t = targets[0];
    const tot = fx(actor, "eclipseWard").some(w => { const c = fromU(dataOf(w).caster); return c && tier(c, DARK) >= 3 && fx(t, "eclipsed").some(e => dataOf(e).caster === dataOf(w).caster); });
    if (tot) o = { ...o, stealth: "half", notes: [...(o.notes ?? []), "Totality: half stealth against them"] };
  }
  const charge = fx(actor, "umbralCharge")[0];
  if (charge) {
    const d = dataOf(charge);
    const ans = await askFor(actor, { react: "umbral", title: "Umbral Strike", ok: "Use a charge", html: `<p><strong>Umbral Strike</strong>: use one of your ${d.count ?? 1} charge${(d.count ?? 1) === 1 ? "" : "s"} to make this attack from one step further into stealth (${o.stealth && o.stealth !== "none" ? o.stealth : "none"} → ${STEP[o.stealth ?? "none"]}) and add ${d.power ?? 1}d4 damage of its type?</p>` });
    if (ans) {
      if ((d.count ?? 1) > 1) await charge.update({ "flags.flowstate.spellEffect.count": d.count - 1 }); else await changeEffect(charge, null);
      await setActorFlag(actor, "umbral", { power: d.power ?? 1, bs: d.bstacks ?? 0 });
      o = { ...o, stealth: STEP[o.stealth ?? "none"], notes: [...(o.notes ?? []), `Umbral Strike: a step deeper into stealth, +${d.power ?? 1}d4 damage`] };
    }
  }
  return o === opts ? undefined : o;
}
TURN_START.push(async actor => { if (actor.getFlag?.("flowstate", "umbral")) await setActorFlag(actor, "umbral", null); });

MODES[`${DARK}:umbral-strike`] = async c => {
  const count = c.enhanced ? 2 : 1;
  await putSpellEffect(c.target, { kind: "umbralCharge", caster: c.attacker.uuid, name: `Umbral Strike (${count})`, count, enhanced: !!c.enhanced, power: c.power, bstacks: c.bs ?? c.stacks ?? 0,
    description: `${count} charge${count === 1 ? "" : "s"}: when they attack they can use one to attack from one step further into stealth and add ${c.power}d4 damage of its type. Until the start of ${c.attacker.name}'s next turn.` });
  return `<strong>${esc(c.target.name)}</strong> gets ${count} Umbral Strike charge${count === 1 ? "" : "s"}, until your next turn.`;
};

/* -------------------------------------------- */
/*  Dispersion                                  */
/* -------------------------------------------- */

/** The stat that gauges how strong an effect's creator is: the Wonder's Scaling Stat for a Mode, the Magic one otherwise. */
function creatorStat(creator, d) {
  const eff = creator?.system?.derived?.effective ?? {};
  const w = d.mode && R.modeById(d.mode) ? R.wonderById(R.modeById(d.mode).wonder) : null;
  if (w) return eff[R.KINDS[w.kind].stat]?.value ?? 0;
  return Math.max(eff.reach?.value ?? 0, eff.grasp?.value ?? 0);
}

/** Everything Dispersion can pick: spell and Mental effects, Summons and Animations (actors carrying the `summon` marker) and Made items (items carrying the `made` marker). */
function dispersionTargets(caster, range) {
  const cands = [];
  for (const a of actorsInPlay()) {
    if (a.uuid !== caster.uuid && !near(caster, a, reachOf(caster, range)) && attackerToken(caster) && attackerToken(a)) continue;
    const sm = a.flags?.flowstate?.summon;
    if (sm?.owner && sm.owner !== caster.uuid) cands.push({ kind: "summon", uuid: a.uuid, label: `${a.name} (${sm.kind === "animation" ? "Animation" : "Summon"})`, creator: sm.owner, holder: a });
    for (const e of a.effects ?? []) { const d = e.flags?.flowstate?.spellEffect; if (d?.caster && d.caster !== caster.uuid && !e.disabled) cands.push({ kind: "effect", uuid: e.uuid, label: `${e.name} on ${a.name}`, creator: d.caster, holder: a, d }); }
    if (!sm) for (const i of a.items ?? []) { const m = i.flags?.flowstate?.made; if (m?.caster && m.caster !== caster.uuid) cands.push({ kind: "item", uuid: i.uuid, label: `${i.name} (made, ${a.name})`, creator: m.caster, holder: a }); }
  }
  return cands;
}

/** Dispersion's Manifest picks something (and, Enhanced, others within 5 ft of it), then makes the attack roll with Advantage against its creator's dodge. */
MODES[`${LIGHT}:dispersion`] = async c => {
  const caster = c.attacker;
  const cands = dispersionTargets(caster, c.range);
  if (!cands.length) return `<strong>Dispersion</strong> finds no Manifestation or spell within range.`;
  const label = x => `${x.label}${fromU(x.creator) ? ` — ${fromU(x.creator).name}` : ""}`;
  const ans = await askFor(caster, { title: "Dispersion", ok: "Disperse", html: `<p>Target one Manifestation or spell:</p><div class="fs-field"><label>Target</label><select name="e">${cands.map(x => `<option value="${esc(x.uuid)}">${esc(label(x))}</option>`).join("")}</select></div>` });
  const first = cands.find(x => x.uuid === ans?.e);
  if (!first) return `<strong>Dispersion</strong>: nothing picked.`;
  let picked = [first];
  if (c.enhanced) {
    const others = cands.filter(x => x !== first && (x.holder.uuid === first.holder.uuid || near(first.holder, x.holder, 5)));
    if (others.length) {
      const more = await askFor(caster, { title: "Dispersion (Enhanced)", ok: "Also these", html: `<p>Also affect anything within 5 ft of the target:</p>${others.map(x => `<label class="fs-cast-mod"><input type="checkbox" name="o:${esc(x.uuid)}"> ${esc(label(x))}</label>`).join("")}` });
      picked = [first, ...others.filter(x => more?.[`o:${x.uuid}`])];
    }
  }
  const creator = fromU(first.creator);
  const flag = { disperse: { targets: picked.map(x => ({ kind: x.kind, uuid: x.uuid })), power: c.power, bs: c.bs ?? c.stacks ?? 0 } };
  if (!creator || creator.uuid === caster.uuid) { const r = await disperse(caster, flag.disperse); return `<strong>Dispersion</strong>: ${r}`; }
  await mental.specialAttack(caster, creator, { label: "Dispersion", net: 1, notes: [`Dispersion: ${picked.map(label).join("; ")} (Advantage against ${creator.name}'s dodge)`], flag });
  return `<strong>Dispersion</strong> goes at ${esc(creator.name)}, the creator of ${esc(first.label)}: an attack roll with Advantage against their dodge.`;
};

/**
 * What Dispersion does: something with health or durability (a Summon, an Animation, a Made item, a shield) loses 20 × Power health; anything else
 * (a spell or Mental effect) is destroyed if its creator's Scaling Stat is 15 × Power or less.
 */
async function disperse(caster, { targets, power, bs }) {
  const lines = [], loss = bold(bs, 20 * power), limit = bold(bs, 15 * power);
  for (const t of targets) {
    const doc = await fromUuid(t.uuid);
    if (!doc) continue;
    if (t.kind === "summon") {
      await requestDamage(doc, loss, "arcane", 0, null, { silent: true, bypass: true });
      lines.push(`${esc(doc.name)} loses ${loss} health.`);
    } else if (t.kind === "item") {
      if (doc.isOwner !== false) await doc.update({ "system.wear": (doc.system.wear ?? 0) + loss }, { flowstateSystem: true }); else await requestGM("wearItem", { uuid: doc.uuid, amount: loss });
      lines.push(`${esc(doc.name)} loses ${loss} durability.`);
    } else {
      const d = dataOf(doc), creator = fromU(d.caster);
      if (Number.isFinite(d.hp) && d.hp > 0) {
        const left = d.hp - loss;
        if (left > 0) { await doc.update({ "flags.flowstate.spellEffect.hp": left }); lines.push(`${esc(doc.name)} loses ${loss} health (${left} left).`); }
        else { await changeEffect(doc, null); lines.push(`${esc(doc.name)} is destroyed.`); }
        continue;
      }
      const stat = creatorStat(creator, d);
      if (stat <= limit) { await changeEffect(doc, null); lines.push(`${esc(doc.name)} is destroyed (its creator's stat is ${stat}, ${limit} or less).`); }
      else lines.push(`${esc(doc.name)} holds: its creator's stat is ${stat}, over ${limit}.`);
    }
  }
  return lines.join(" ") || "nothing there.";
}

export async function disperseResolve({ attacker, target, result, m }) {
  if (!result.hit) return { html: `<div class="fs-notes">Dispersion misses ${esc(target.name)}: their effects stay.</div>` };
  const crit = result.critStacks ?? (result.crit ? 2 : 0);          // a crit's stacks scale it too
  return { html: `<div class="fs-result"><i class="fa-solid fa-wind"></i> Dispersion: ${await disperse(attacker, { ...m.disperse, bs: (m.disperse.bs ?? 0) + crit })}</div>` };
}

/* -------------------------------------------- */
/*  Corona and Nightfall                        */
/* -------------------------------------------- */

const KINDS = { light: { name: "Corona", wonder: LIGHT, kinds: ["illuminated", "illumWard"], apply: applyIlluminate, mode: ILLUMINATE, label: "Illuminate" },
  dark: { name: "Nightfall", wonder: DARK, kinds: ["eclipsed", "eclipseWard"], apply: applyEclipse, mode: ECLIPSE, label: "Eclipse" } };

/** Corona / Nightfall (T5, 1 AP): an attack roll at a creature already under your Illuminate / Eclipse; on a hit that instance spreads to everyone within 10 ft of it. */
export async function expand(caster, which) {
  const k = KINDS[which];
  if (tier(caster, k.wonder) < 5) return ui.notifications.warn(`${k.name} needs ${R.wonderById(k.wonder).name} Tier 5.`);
  const under = [];
  for (const a of actorsInPlay()) for (const kind of k.kinds) for (const e of fx(a, kind)) if (dataOf(e).caster === caster.uuid && (!attackerToken(caster) || !attackerToken(a) || near(caster, a, 100))) under.push({ a, d: dataOf(e) });
  if (!under.length) return ui.notifications.info(`No creature within 100 ft is under your ${k.label}.`);
  const uuid = under.length === 1 ? under[0].a.uuid : await mental.pickChoice(caster, `${k.name}: which creature`, under.map(x => [x.a.uuid, x.a.name]));
  const hit = under.find(x => x.a.uuid === uuid);
  if (!hit) return null;
  if (!(await mental.pay(caster, { ap: 1 }, k.name))) return null;
  return mental.specialAttack(caster, hit.a, { label: k.name, notes: [`${k.name}: ${k.label} spreads to everyone within 10 ft of ${hit.a.name} on a hit`], flag: { expand: { which, power: hit.d.power, enhanced: !!hit.d.enhanced, bs: hit.d.bstacks ?? 0 } } });
}

export async function expandResolve({ attacker, target, result, m }) {
  const k = KINDS[m.expand.which];
  if (!result.hit) return { html: `<div class="fs-notes">${esc(k.name)} misses ${esc(target.name)}.</div>` };
  const lines = [];
  for (const a of actorsInPlay()) {
    if (a.uuid === target.uuid || !live(a) || !near(a, target, 10)) continue;
    const side = await versionFor(attacker, a, k.label);
    lines.push(await k.apply(attacker, a, side, { power: m.expand.power, enhanced: m.expand.enhanced, bs: m.expand.bs }));
  }
  return { html: `<div class="fs-result"><i class="fa-solid fa-sun"></i> ${esc(k.name)}: ${lines.length ? lines.join("<br>") : "no one else is within 10 ft."}</div>` };
}
