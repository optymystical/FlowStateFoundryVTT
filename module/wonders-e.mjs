/**
 * Fortune (Dream) (Mental Stage 1 doc): Wager, Windfall and Providence, Fortune's Bands (no crits: where the attack roll lands decides; under one half it
 * hits you instead), Rig (Tenet: roll the Fortune Table any time, once per round), Parlay (Strengthened stacks multiply) and Double Down (Disadvantage, wider
 * bands), and the Fortune Table itself (`FORTUNE_ROWS`, matched by position to the doc's table, whose text the cards show).
 * It registers into wonders.mjs (`MODES`, `ACTS`, `CHOICE_PROVIDERS`, `COST_PROVIDERS`); mental.mjs hands a Fortune Manifest's resolve to `fortuneResolve`.
 */
import { feedExtra, post, putSpellEffect, requestGM, requestDamage, damageOutcome, setStatus, knockbackRow, attackerToken, tokenDistance, energyRestoreAdjust } from "./actions.mjs";
import { reevaluate } from "./arcana.mjs";
import { removeEnergy } from "./elemental.mjs";
import { stackMultiplier, DAMAGE_TYPES } from "./rules.mjs";
import * as ab from "./abilities.mjs";
import * as R from "./mental-rules.mjs";
import * as concentration from "./concentration.mjs";
import { askFor, actorsInPlay } from "./ask.mjs";
import { tierOf } from "./skills.mjs";
import { strike } from "./wonders-b.mjs";
import { mental, MODES, ACTS, CHOICE_PROVIDERS, COST_PROVIDERS, rolled, tenetFor, tryOnce, runAct, heal, forceRoll } from "./wonders.mjs";
import { notCreature } from "./kinds.mjs";
import { esc } from "./html.mjs";

export const FORTUNE = "mental-fortune-dream";
const WAGER = `${FORTUNE}:wager`, WINDFALL = `${FORTUNE}:windfall`, PROVIDENCE = `${FORTUNE}:providence`, RIG = `${FORTUNE}:rig`;
const tier = (actor, id) => tierOf(actor?.system?.trees ?? {}, id);
const minOf = (a, k) => ab.statMinOf(a, k);
const live = a => a && !notCreature(a);
const roll = formula => new Roll(formula).evaluate();
const typeLabel = t => DAMAGE_TYPES[t] ?? t;
const ELEMENTS = { heat: "Heat", cold: "Cold", radiation: "Radiation", acid: "Acid" };
const near = (a, b, ft) => { const ta = attackerToken(a), tb = attackerToken(b); return !!ta && !!tb && !!globalThis.canvas?.grid && tokenDistance(ta, tb) <= ft; };
const setCond = async (actor, data) => { if (actor.isOwner) await actor.update(data); else await requestGM("updateActor", { uuid: actor.uuid, data }); };
export const isFortune = m => m?.wonder === FORTUNE;

/* -------------------------------------------- */
/*  Manifest choices: Parlay, Double Down       */
/* -------------------------------------------- */

CHOICE_PROVIDERS.push((actor, modeId) => {
  if (!String(modeId).startsWith(`${FORTUNE}:`)) return [];
  const out = [];
  if (modeId === WAGER) out.push({ name: "wtype", label: "If Enhanced: damage type", options: { ...ELEMENTS, arcane: "Arcane" } });
  const cost = minOf(actor, "pon");
  if (tier(actor, FORTUNE) >= 2) out.push({ name: "parlay", label: `Parlay (⚡ ${cost}): Strengthened stacks multiply`, options: { no: "No", yes: "Yes" } });
  if (tier(actor, FORTUNE) >= 4) out.push({ name: "doubleDown", label: `Double Down (⚡ ${cost}): Disadvantage, an 8-stack band, Strengthened self hits`, options: { no: "No", yes: "Yes" } });
  return out;
});
COST_PROVIDERS.push((actor, { wonder, choices }) => {
  if (wonder?.id !== FORTUNE) return null;
  const parlay = choices?.parlay === "yes" && tier(actor, FORTUNE) >= 2, dd = choices?.doubleDown === "yes" && tier(actor, FORTUNE) >= 4;
  if (!parlay && !dd) return null;
  const cost = minOf(actor, "pon");
  return { energy: (parlay ? cost : 0) + (dd ? cost : 0), net: dd ? -1 : 0, flags: { parlay, doubleDown: dd },
    notes: [parlay ? "Parlay: Strengthened stacks multiply" : "", dd ? "Double Down: Disadvantage; 8 Strengthened at seven eighths, Strengthened self hits" : ""].filter(Boolean) };
});

/* -------------------------------------------- */
/*  Fortune's Bands                             */
/* -------------------------------------------- */

const selfHits = new Set();          // Manifests (by uid) that already hit their caster: an Area Manifest's self hit applies once

/**
 * A Fortune Manifest was answered: it can't crit; its band decides. Under one half it hits you (whether or not it hit), with no stacks unless Double Down gives
 * some; otherwise a hit gets 2 / 4 (/ 8) Strengthened. Returns the resolve result, or null for a plain miss (the normal miss card).
 */
export async function fortuneResolve({ attacker, target, o, result, entry, m, mode, index = 0, attackMessage = null, reroll = null }) {
  const total = entry?.total ?? 0, die = entry?.die ?? attacker.system.derived.attackDie;
  const band = R.fortuneBand(total, die, !!m.doubleDown);
  const note = `<div class="fs-notes">Fortune's Bands: ${total} on a d${die} — ${band.label}.</div>`;
  // Chant first (the user's ruling): a miss in the self band is offered Chant before the self hit. A reroll that hits lands by its own band; one that misses
  // (at one half or more) leaves the self hit to apply after all.
  if (band.self && !result.hit && reroll) {
    const ch = await mental.chantFortune({ attacker, o, m, entry, reroll: { ...reroll, die } });
    if (ch) {
      const again = await fortuneResolve({ attacker, target, o, result: ch.result, entry: { ...entry, total: ch.total, die }, m: { ...m, chanted: true }, mode, index, attackMessage });
      if (again) return { ...again, html: `${note}<div class="fs-notes">Chant rerolled it: ${ch.total}.</div>${again.html}` };
    }
  }
  if (band.self) {
    if (m.uid && selfHits.has(m.uid)) return { html: `${note}<div class="fs-notes">It already hit ${esc(attacker.name)}.</div>` };
    if (m.uid) selfHits.add(m.uid);
    // The self hit: the Manifest lands on its caster (no guard, no Tenets, no abilities: it isn't an attack on them, and it isn't a hit on the target).
    const out = await mental.landManifest({ attacker, target: attacker, o, m: { ...m, selfHit: true, spread: true }, mode, result: { ...result, hit: true, crit: false, critStacks: band.stacks }, stacksBase: o.stacks ?? 0, index, attackMessage });
    return { ...out, html: `${note}${out.html}` };
  }
  if (!result.hit) return null;
  const out = await mental.landManifest({ attacker, target, o, m, mode, result: { ...result, crit: false, critStacks: band.stacks }, stacksBase: o.stacks ?? 0, index, attackMessage });
  return { ...out, html: `${note}${out.html}` };
}

/** How the Manifest's stacks apply: additive, or multiplicative with Parlay. */
const scaleOf = c => (n, s) => R.fortuneScale(n, s, !!c.m?.parlay);

/* -------------------------------------------- */
/*  Wager and Windfall                          */
/* -------------------------------------------- */

MODES[WAGER] = async c => {
  const type = c.enhanced && (ELEMENTS[c.choices?.wtype] || c.choices?.wtype === "arcane") ? c.choices.wtype : "physical";
  const s = await strike(c, 1, 10, type, { label: "Wager", scale: scaleOf(c) });
  return `${s.line}${c.m.selfHit ? ` — ${esc(c.attacker.name)} hits themself` : ""}.`;
};

/** Restore Energy (Fear blocks it, a Freeze takes its cut); what goes over the maximum becomes Temp HP (× `ratio`) until the caster's next turn. */
async function giveEnergy(target, caster, n, ratio = 1) {
  if (target.statuses?.has?.("fear")) return `${esc(target.name)} is afraid and can't gain Energy.`;
  const got = await energyRestoreAdjust(target, n);
  const e = target.system.energy ?? { value: 0, max: 0 };
  const gain = Math.max(0, Math.min(got, (e.max ?? 0) - (e.value ?? 0))), over = Math.max(0, got - gain);
  if (gain) await setCond(target, { "system.energy.value": e.value + gain });
  if (over) await putTemp(target, caster, over * ratio);
  return `${esc(target.name)} regains <strong>${gain}</strong> Energy${over ? `; the ${over} over their maximum become <strong>${over * ratio} Temp HP</strong>` : ""}.`;
}
/** Lose Energy; what it would take below 0 becomes Supernatural damage instead (× `ratio`; Temp HP, shielding, Shrouds and Wards reduce it). */
async function takeEnergy(actor, n, ratio = 1) {
  const have = actor.system.energy?.value ?? 0, off = Math.min(have, n), deficit = n - off;
  if (off) await removeEnergy(actor, off);
  if (deficit) await requestDamage(actor, deficit * ratio, "supernatural", 0, null, { silent: true, archetype: "magic", shroudCtx: { source: "type:supernatural", attacker: actor.uuid } });
  return `${esc(actor.name)} loses <strong>${off}</strong> Energy${deficit ? ` and takes <strong>${deficit * ratio}</strong> Supernatural damage (the ${deficit} below 0)` : ""}.`;
}
const putTemp = (who, caster, n, why = "Fortune") => putSpellEffect(who, { kind: "tempHP", caster: caster.uuid, mode: FORTUNE, name: `Temp HP (${n})`, hp: n, max: n,
  description: `Absorbs the next ${n} damage that would reach HP (${why}). Until the start of ${caster.name}'s next turn.` });

MODES[WINDFALL] = async c => {
  const n = R.fortuneScale(4 * c.power, c.bs ?? 0, !!c.m.parlay), ratio = c.enhanced ? 2 : 1;
  // A self hit from the bands: you lose that Energy instead.
  if (c.m.selfHit) return `Windfall backfires: ${await takeEnergy(c.attacker, n, ratio)}`;
  return `Windfall: ${await giveEnergy(c.target, c.attacker, n, ratio)}`;
};

/* -------------------------------------------- */
/*  The Fortune Table                           */
/* -------------------------------------------- */

/**
 * The Fortune Table's effects, in the doc's order (the table's rows give the ranges and the text). `x` = { caster, target, P, bs, parlay, rolls }: its bolded
 * numbers are × P (Wonder Power for Providence, the Tenet's multiplier for Rig) and scaled by the stacks (Parlay: multiplied).
 */
const v = (x, n) => R.fortuneScale(n * x.P, x.bs, x.parlay);
const halfUp = (x, n) => Math.ceil(n * x.P * (x.parlay && x.bs > 0 ? Math.pow(1.5, x.bs) : stackMultiplier(x.bs)) - 1e-9);
async function dice(x, n, sides) { const r = await roll(`${n * x.P}d${sides}`); x.rolls.push(r); return { r, n: R.fortuneScale(r.total, x.bs, x.parlay), f: `${n * x.P}d${sides}` }; }
async function hurt(x, who, n, type) {
  const outcome = await damageOutcome(who, n, type, { archetype: "magic" });
  const res = await requestDamage(who, n, type, 0, null, { wantResult: true, silent: true, archetype: "magic", shroudCtx: { source: `type:${type}`, attacker: x.caster.uuid } });
  return `${esc(who.name)}: <strong>${n}</strong> ${esc(typeLabel(type))} (${res?.toHp ?? outcome.toHp} direct)`;
}
const until = x => `until the start of ${x.caster.name}'s next turn`;
const effect = (x, data) => putSpellEffect(x.target, { caster: x.caster.uuid, mode: FORTUNE, ...data });
/** Creatures within `ft` of the target (tokens on the scene needed). */
const around = (x, ft) => actorsInPlay().filter(a => live(a) && a.uuid !== x.target.uuid && near(x.target, a, ft));

export const FORTUNE_ROWS = [
  async x => {                                                                                 // 1–3
    const d = await dice(x, 1, 12);
    const cands = around(x, 20);
    let others = [];
    if (cands.length) {
      const ans = await askFor(x.caster, { title: "Fortune: who else", ok: "Strike", html: `<p>${d.f} = ${d.n} physical to ${esc(x.target.name)} and any creatures you choose within 20 ft, each knocked prone:</p>${cands.map(a => `<label class="fs-cast-mod"><input type="checkbox" name="o:${esc(a.uuid)}"> ${esc(a.name)}</label>`).join("")}` });
      others = cands.filter(a => ans?.[`o:${a.uuid}`]);
    }
    const lines = [];
    for (const a of [x.target, ...others]) { lines.push(await hurt(x, a, d.n, "physical")); await setStatus(a, "prone", true); }
    return `${d.f} = ${d.r.total}: ${lines.join("; ")}; knocked prone.`;
  },
  async x => {                                                                                 // 4–6
    const d = await dice(x, 1, 12);
    const line = await hurt(x, x.target, d.n, "cold");
    const conc = concentration.list(x.target);
    if (!conc.length) return `${line}. They aren't concentrating on anything.`;
    const id = conc.length === 1 ? conc[0].id : await mental.pickChoice(x.caster, "Fortune: which Concentration ends", conc.map(cc => [cc.id, cc.label]));
    const pick = conc.find(cc => cc.id === id) ?? conc[0];
    await concentration.end(x.target, pick.id, "the Fortune Table", { voluntary: false });
    return `${line}. Their Concentration on ${esc(pick.label)} ends.`;
  },
  async x => {                                                                                 // 7–11
    const d = await dice(x, 1, 12);
    await effect(x, { kind: "noAdvantage", name: "No Advantage (Fortune)", description: `Can't benefit from Advantage on any roll ${until(x)}.` });
    return `${await hurt(x, x.target, d.n, "physical")}; they can't benefit from Advantage ${until(x)}.`;
  },
  async x => {                                                                                 // 12–16
    const d = await dice(x, 1, 10);
    await effect(x, { kind: "dimmed", name: "Senses dimmed (Fortune)", description: `Each of their senses is treated as one step lower ${until(x)} (the GM applies it; doesn't stack).` });
    return `${await hurt(x, x.target, d.n, "radiation")}; their senses are each one step lower ${until(x)}.`;
  },
  async x => { const d = await dice(x, 1, 10); return `${await hurt(x, x.target, d.n, "supernatural")}.`; },          // 17–21
  async x => { const d = await dice(x, 1, 10); const l = await hurt(x, x.target, d.n, "physical"); await setStatus(x.target, "prone", true); return `${l}; knocked prone.`; },  // 22–26
  async x => {                                                                                 // 27–31
    const d = await dice(x, 1, 8);
    const lines = [];
    for (const a of [x.target, ...around(x, 10)]) lines.push(await hurt(x, a, d.n, "heat"));
    return `${d.f} = ${d.r.total}: ${lines.join("; ")}.`;
  },
  async x => { const n = v(x, 10); await effect(x, { kind: "fortunePain", stack: true, painUp: n, name: `Fortune (+${n} Pain Threshold)`, description: `Pain Threshold raised by ${n} ${until(x)}.` }); await reevaluate(x.target); return `Their Pain Threshold is raised by <strong>${n}</strong> ${until(x)}.`; },  // 32–35
  async x => { const n = halfUp(x, 0.5); await effect(x, { kind: "dodgeDie", dodgeDie: n, name: `Fortune (dodge −${n} die size)`, description: `Dodge rolls have their die size reduced by ${n} ${until(x)}.` }); return `Their dodge dice are <strong>${n}</strong> sizes smaller ${until(x)}.`; },  // 36–39
  async x => { const n = v(x, 1); await effect(x, { kind: "attackDie", attackDie: n, name: `Fortune (attack −${n} die size)`, description: `Attack rolls have their die size reduced by ${n} ${until(x)}.` }); return `Their attack dice are <strong>${n}</strong> sizes smaller ${until(x)}.`; },  // 40–43
  async x => { const n = v(x, 15) + await feedExtra(x.caster, x.target, "slow"); await setCond(x.target, { "system.conditions.slow": (x.target.system.conditions?.slow ?? 0) + n }); return `They gain <strong>${n} Slow</strong> stacks.`; },  // 44–47
  async x => { const n = v(x, 3); const r = await removeEnergy(x.target, n); return `They lose <strong>${r.removed}</strong> Energy (${r.remaining} left).`; },  // 48–50
  async x => {                                                                                 // 51–53
    const f = await forceRoll({ stacks: x.bs, target: x.target, attacker: x.caster }, 12 * x.P, 8, "Fortune", false, { normal: true });
    x.rolls.push(f.r);
    if (f.push) x.cards.push({ body: `<div class="fs-result">${f.html}</div>${knockbackRow(x.caster.uuid, f.feet, "Fortune")}`, flags: { flowstate: { knockback: f.push } } });
    return f.html;
  },
  async x => {                                                                                 // 54–56
    const feet = 5;                                                                            // a fixed 5 ft (not bolded in the doc)
    x.cards.push({ body: `<div class="fs-result">Fortune: ${esc(x.target.name)} is moved <strong>${feet} ft</strong> in a direction of your choosing (ignores Force and Lift).</div>${knockbackRow(x.caster.uuid, feet, "Fortune")}`,
      flags: { flowstate: { knockback: { attacker: x.caster.uuid, target: x.target.uuid, force: 0, feet, label: "Fortune", fixed: true } } } });
    return `They're forcefully moved <strong>${feet} ft</strong> (a direction card for ${esc(x.caster.name)}).`;
  },
  async x => {                                                                                 // 57–59
    const type = (await mental.pickChoice(x.caster, "Fortune: elemental damage type", Object.entries(ELEMENTS))) || "heat";
    const d = await dice(x, 1, 10);
    return await hurt(x, x.target, d.n, ELEMENTS[type] ? type : "heat");
  },
  async x => { const n = v(x, 3); if (x.target.statuses?.has?.("fear")) return `${esc(x.target.name)} is afraid and can't gain Energy.`; const got = await energyRestoreAdjust(x.target, n), e = x.target.system.energy ?? { value: 0, max: 0 }; const gain = Math.max(0, Math.min(got, e.max - e.value)); if (gain) await setCond(x.target, { "system.energy.value": e.value + gain }); return `They regain <strong>${gain}</strong> Energy.`; },  // 60–63
  async x => { const n = v(x, 15) + await feedExtra(x.caster, x.target, "haste"); await setCond(x.target, { "system.conditions.haste": (x.target.system.conditions?.haste ?? 0) + n }); return `They gain <strong>${n} Haste</strong> stacks.`; },  // 64–67
  async x => { const n = v(x, 5); await putTemp(x.target, x.caster, n); return `They get <strong>${n} Temp HP</strong> ${until(x)}.`; },  // 68–71
  async x => { const n = halfUp(x, 0.5); await effect(x, { kind: "dodgeUp", dodgeDieUp: n, name: `Fortune (+${n} dodge die size)`, description: `Dodge dice are ${n} sizes bigger ${until(x)}. Doesn't stack.` }); return `Their dodge dice are <strong>+${n}</strong> sizes ${until(x)}.`; },  // 72–75
  async x => { const n = v(x, 1); await effect(x, { kind: "attackUp", attackDieUp: n, name: `Fortune (+${n} attack die size)`, description: `Attack dice are ${n} sizes bigger ${until(x)}. Doesn't stack.` }); return `Their attack dice are <strong>+${n}</strong> sizes ${until(x)}.`; },  // 76–79
  async x => heal(x.target, x.caster, v(x, 5)),                                                  // 80–84
  async x => { const n = v(x, 10); await effect(x, { kind: "fortunePain", stack: true, painDown: n, name: `Fortune (−${n} Pain Threshold)`, description: `Pain Threshold lowered by ${n} ${until(x)}.` }); await reevaluate(x.target); return `Their Pain Threshold is lowered by <strong>${n}</strong> ${until(x)}.`; },  // 85–89
  async x => giveEnergy(x.target, x.caster, v(x, 5), 1),                                        // 90–94
  async x => {                                                                                 // 95–97
    if ((x.depth ?? 0) >= 10) return "The table keeps rerolling itself: nothing more happens.";
    const r = await roll("1d100"); x.rolls.push(r);
    return `Reroll: ${r.total}. ${await fortuneEffect({ ...x, depth: (x.depth ?? 0) + 1 }, r.total)}`;
  },
  async x => {                                                                                 // 98–100
    const n = v(x, 5);
    await putTemp(x.target, x.caster, n);
    const healed = await heal(x.target, x.caster, n);
    return `They get <strong>${n} Temp HP</strong> ${until(x)}. ${healed} ${await cleanseOne(x)}`;
  }
];

/** Remove one negative condition (the caster picks: Ignite, Stain, Slow and the like, or a status such as prone or grappled). */
async function cleanseOne(x) {
  const t = x.target;
  const conds = Object.entries(t.system.conditions ?? {}).filter(([k, n]) => n > 0 && k !== "haste");
  const stati = [...(t.statuses ?? [])].filter(s => ["prone", "grappled", "slowed", "blinded", "deafened", "restrained", "fear"].includes(s));
  if (!conds.length && !stati.length) return "They have no negative condition to remove.";
  const out = await mental.pickChoice(x.caster, "Fortune: remove which condition?", [...conds.map(([k, n]) => [k, `${k} (${n})`]), ...stati.map(s => [`status:${s}`, s])]);
  if (!out) return "No condition removed.";
  if (out.startsWith("status:")) await setStatus(t, out.slice(7), false);
  else await setCond(t, { [`system.conditions.${out}`]: 0 });
  return `Their ${esc(out.replace("status:", ""))} is removed.`;
}

/** The table's row for a d100 result: { index, range, text } (the doc's own ranges and wording). */
export function fortuneRow(n) {
  const rows = R.wonderById(FORTUNE)?.table?.rows ?? [];
  for (const [i, row] of rows.entries()) {
    const m = /^(\d+)\s*[–-]\s*(\d+)$/.exec(String(row[0]).trim());
    if (m && n >= Number(m[1]) && n <= Number(m[2])) return { index: i, range: row[0], text: row[1] };
  }
  return null;
}
/** Apply the row for `n` to `x.target`: returns the card line. */
async function fortuneEffect(x, n) {
  const row = fortuneRow(n);
  const fn = row ? FORTUNE_ROWS[row.index] : null;
  if (!fn) return `No Fortune Table row for ${n}.`;
  return `<em>${esc(row.range)}</em> on ${esc(x.target.name)}: ${await fn(x)}`;
}

/** Roll the table (or use `preset`) and apply it; posts the extra cards (Force and movement buttons). Returns { html, rolls }. */
export async function applyFortune(caster, target, { P, bs = 0, parlay = false, label = "Fortune", preset = null } = {}) {
  const x = { caster, target, P: Math.max(1, P || 1), bs, parlay, rolls: [], cards: [] };
  let n = preset;
  if (n == null) { const r = await roll("1d100"); x.rolls.push(r); n = r.total; }
  const html = `${label}: the Fortune Table rolls <strong>${n}</strong>. ${await fortuneEffect(x, n)}`;
  for (const card of x.cards) await post(caster, { title: `${esc(caster.name)} — ${label}`, body: card.body, flags: card.flags });
  return { html, rolls: x.rolls, n };
}

/* -------------------------------------------- */
/*  Providence and Rig                          */
/* -------------------------------------------- */

MODES[PROVIDENCE] = async c => {
  let preset = null;
  if (c.enhanced) {
    // Enhanced: roll the d100 twice and pick which applies.
    const a = await roll("1d100"), b = await roll("1d100");
    rolled.push(a, b);
    const row = n => `${n}: ${fortuneRow(n)?.text ?? "?"}`;
    preset = Number(await mental.pickChoice(c.attacker, "Providence: which result", [[String(a.total), row(a.total)], [String(b.total), row(b.total)]])) || a.total;
  }
  const out = await applyFortune(c.attacker, c.target, { P: c.power, bs: c.bs ?? 0, parlay: !!c.m.parlay, label: "Providence", preset });
  rolled.push(...out.rolls);
  return out.html;
};

/** Rig (Fortune Tenet, Action List): any time, once per round, roll the Fortune Table and apply it to a creature within 100 ft (the Tenet's multiplier scales it). */
export async function rig(actor) {
  const tn = tenetFor(actor, RIG);
  if (!tn) return ui.notifications.warn("Rig is Fortune's Tenet: attune an Icon to it first.");
  return runAct({ id: "rig", tenet: true, label: "Rig", caster: actor.uuid, target: actor.uuid, mult: tn.mult, bstacks: 0 });
}
/** Rig: roll the table, pick a creature within 100 ft, and make an attack roll at it: the rolled effect applies on a hit (a crit's stacks scale it). */
ACTS.rig = async (x, caster) => {
  if (!(await tryOnce(caster, "rig"))) { ui.notifications.info("Rig: already used this round."); return false; }
  const r = await roll("1d100");
  const row = fortuneRow(r.total);
  const targeted = [...(game.user?.targets ?? [])].map(t => t.actor).filter(live);
  const target = targeted.length === 1 ? targeted[0] : await mental.pickAnother(caster, { title: `Rig rolled ${r.total} (${row?.text ?? "?"}): attack`, within: 100 });
  if (!target) return true;
  await post(caster, { title: `${esc(caster.name)} — Rig`, rolls: [r], body: `<div class="fs-result"><i class="fa-solid fa-dice"></i> Rig rolls <strong>${r.total}</strong> on the Fortune Table (${esc(row?.range ?? "?")}: ${esc(row?.text ?? "")}). An attack roll at ${esc(target.name)} applies it on a hit.</div>` });
  await mental.specialAttack(caster, target, { label: "Rig", notes: [`Rig: Fortune Table ${r.total} on a hit`], flag: { rig: { n: r.total, mult: x.mult ?? 1 } } });
  return true;
};
export async function rigResolve({ attacker, target, result, m }) {
  if (!result.hit) return { html: `<div class="fs-notes">Rig misses ${esc(target.name)}: the Fortune Table result is lost.</div>` };
  const out = await applyFortune(attacker, target, { P: m.rig.mult ?? 1, bs: result.critStacks ?? (result.crit ? 2 : 0), label: "Rig", preset: m.rig.n });
  return { html: `<div class="fs-result"><i class="fa-solid fa-dice"></i> ${out.html}</div>`, rolls: out.rolls };
}

