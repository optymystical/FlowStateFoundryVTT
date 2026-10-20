/**
 * Ruin (Nightmare) (Mental Rework Test Ground): Ruin Modes (Jinx, Forfeit, Calamity) can't crit; on a hit they store a **Jinx** on the target until the start of
 * your next turn. The target's next attack roll resolves every Jinx on it at once by Ruin's Bands (where that roll lands against its die's max: under one half
 * they fizzle, then 2 or 4 Strengthened). Gild (T2) gives that roll Advantage; Reversal (T4) flips the roll afterwards (only their attack uses the flipped
 * number: the user's ruling). Doom (Tenet) rolls the Ruin Table and applies it on a hit; Calamity (T5) stores a Ruin Table result as a Jinx.
 * It registers into wonders.mjs (`MODES`, `ACTS`, the provider lists); mental.mjs hands `attackNetBefore`, `attackRolled`, `dodgeNext` and `energySpent` to
 * actions.mjs through `registerMental`, and calls `ruinResolve` / `doomResolve` from its resolve step.
 */
import { feedExtra, post, putSpellEffect, spellEffects, changeEffect, requestGM, requestDamage, damageOutcome, setStatus, attackerToken, tokenDistance } from "./actions.mjs";
import { removeEnergy } from "./elemental.mjs";
import { DAMAGE_TYPES } from "./rules.mjs";
import * as ab from "./abilities.mjs";
import * as R from "./mental-rules.mjs";
import * as concentration from "./concentration.mjs";
import { askFor, actorsInPlay } from "./ask.mjs";
import { tierOf } from "./skills.mjs";
import { mental, MODES, ACTS, CHOICE_PROVIDERS, COST_PROVIDERS, DAMAGE_PROVIDERS, TURN_START, rolled, tenetOf, tryOnce, runAct } from "./wonders.mjs";
import { notCreature } from "./kinds.mjs";
import { esc } from "./html.mjs";

export const RUIN = "mental-ruin-nightmare";
const JINX = `${RUIN}:jinx`, FORFEIT = `${RUIN}:forfeit`, CALAMITY = `${RUIN}:calamity`, DOOM = `${RUIN}:doom`;
const tier = (actor, id) => tierOf(actor?.system?.trees ?? {}, id);
const minOf = (a, k) => ab.statMinOf(a, k);
const live = a => a && !notCreature(a);
const fromU = u => (u ? globalThis.fromUuidSync?.(u) ?? null : null);
const dataOf = e => e.flags.flowstate.spellEffect;
const roll = formula => new Roll(formula).evaluate();
const near = (a, b, ft) => { const ta = attackerToken(a), tb = attackerToken(b); return !!ta && !!tb && !!globalThis.canvas?.grid && tokenDistance(ta, tb) <= ft; };
const setCond = async (actor, data) => { if (actor.isOwner) await actor.update(data); else await requestGM("updateActor", { uuid: actor.uuid, data }); };
const halfSnap = actor => Math.floor(minOf(actor, "snap") / 2);
export const isRuin = m => m?.wonder === RUIN;
let jinxDamage = 0;                       // > 0 while a Jinx is dealing its damage (81–84's Strengthened is for "non-Jinx damage")

/* -------------------------------------------- */
/*  Manifest choice: Gild                       */
/* -------------------------------------------- */

CHOICE_PROVIDERS.push((actor, modeId) => (String(modeId).startsWith(`${RUIN}:`) && tier(actor, RUIN) >= 2
  ? [{ name: "gild", label: `Gild (⚡ ${halfSnap(actor)}): the roll that resolves their Jinxes has Advantage`, options: { no: "No", yes: "Yes" } }] : []));
COST_PROVIDERS.push((actor, { wonder, choices }) => (wonder?.id === RUIN && choices?.gild === "yes" && tier(actor, RUIN) >= 2
  ? { energy: halfSnap(actor), flags: { gild: true }, notes: ["Gild: the roll that resolves their Jinxes has Advantage"] } : null));

/* -------------------------------------------- */
/*  Ruin Modes store Jinxes                     */
/* -------------------------------------------- */

/** A Ruin Manifest was answered: no crits; a hit lands the Mode (which stores its Jinx). A miss is a normal miss (null). */
export async function ruinResolve({ attacker, target, o, result, m, mode, index = 0, attackMessage = null }) {
  if (!result.hit) return null;
  return mental.landManifest({ attacker, target, o, m, mode, result: { ...result, crit: false, critStacks: 0 }, stacksBase: o.stacks ?? 0, index, attackMessage });
}

/** Store a Jinx on `target`: `payload` = { type: "damage", n, sides, dtype } | { type: "forfeit", n, ratio } | { type: "calamity", roll }. */
async function storeJinx(caster, target, payload, { power = 1, bs = 0, enhanced = false, gild = false, label = "Jinx" } = {}) {
  await putSpellEffect(target, { kind: "jinx", stack: true, caster: caster.uuid, mode: JINX, payload, power, bstacks: bs, enhanced: !!enhanced, gild: !!gild, waited: false, name: `${label} (${caster.name})`,
    description: `A Jinx from ${caster.name}: ${jinxText(payload, power)}. Their next attack roll resolves it (under one half of the die it fizzles${enhanced ? ", once it waits instead" : ""}; higher rolls Strengthen it)${gild ? "; that roll has Advantage (Gild)" : ""}. Until the start of ${caster.name}'s next turn.` });
}
const jinxText = (p, power) => (p.type === "damage" ? `${p.n * power}d${p.sides} ${p.dtype}` : p.type === "forfeit" ? `${p.n * power} Energy removed` : `Ruin Table ${p.roll}`);

MODES[JINX] = async c => {
  if (!live(c.target)) return `<strong>Jinx</strong> needs a creature.`;
  await storeJinx(c.attacker, c.target, { type: "damage", n: 1, sides: 10, dtype: "physical" }, { power: c.power, bs: c.bs, enhanced: c.enhanced, gild: c.m.gild });
  return `<strong>${esc(c.target.name)}</strong> carries a <strong>Jinx</strong> (${c.power}d10 physical) until your next turn: their next attack roll resolves it${c.enhanced ? " (the first time it would fizzle it waits instead)" : ""}.`;
};
MODES[FORFEIT] = async c => {
  if (!live(c.target)) return `<strong>Forfeit</strong> needs a creature.`;
  await storeJinx(c.attacker, c.target, { type: "forfeit", n: 4, ratio: c.enhanced ? 2 : 1 }, { power: c.power, bs: c.bs, gild: c.m.gild, label: "Forfeit" });
  return `<strong>${esc(c.target.name)}</strong> carries a <strong>Forfeit</strong> Jinx: ${4 * c.power} Energy removed when it resolves (below 0, health lost ${c.enhanced ? "1:2" : "1:1"}).`;
};
MODES[CALAMITY] = async c => {
  if (!live(c.target)) return `<strong>Calamity</strong> needs a creature.`;
  let n = (await roll("1d100")); rolled.push(n); n = n.total;
  if (c.enhanced) {
    const b = await roll("1d100"); rolled.push(b);
    const row = k => `${k}: ${ruinRow(k)?.text ?? "?"}`;
    n = Number(await mental.pickChoice(c.attacker, "Calamity: which result to store", [[String(n), row(n)], [String(b.total), row(b.total)]])) || n;
  }
  await storeJinx(c.attacker, c.target, { type: "calamity", roll: n }, { power: c.power, bs: c.bs, gild: c.m.gild, label: "Calamity" });
  return `<strong>${esc(c.target.name)}</strong> carries a <strong>Calamity</strong> Jinx: Ruin Table ${n} (${esc(ruinRow(n)?.text ?? "")}).`;
};

/* -------------------------------------------- */
/*  Resolving: the Jinxed creature's attack roll */
/* -------------------------------------------- */

/** Before a creature's attack roll: Gild's Advantage (it resolves their Jinxes) and 53–56's Disadvantage (used up). Returns { net, notes }. */
export async function attackNetBefore(actor) {
  let net = 0;
  const notes = [];
  if (spellEffects(actor, "jinx").some(e => dataOf(e).gild)) { net += 1; notes.push("Gild: Advantage (this roll resolves their Jinxes)"); }
  const dis = spellEffects(actor, "ruinAttackDis");
  if (dis.length) { net -= 1; notes.push("Ruin: Disadvantage on this attack roll"); for (const e of dis) await changeEffect(e, null); }
  return { net, notes };
}
/** Before a creature's dodge roll: 57–60's Disadvantage (used up). Returns the net change. */
export async function dodgeNext(actor) {
  const dis = spellEffects(actor, "ruinDodgeDis");
  for (const e of dis) await changeEffect(e, null);
  return dis.length ? -1 : 0;
}

/**
 * A creature made an attack roll (`total` on a d`die`): 5–8's self-harm goes off, every Jinx on it resolves by Ruin's Bands, then their casters may flip the roll
 * (Reversal, T4, half SNA min; 65–68 gives a free flip). Returns { total, lines } — `total` is what their attack uses (flipped or not); `lines` go on the attack card.
 */
export async function attackRolled(actor, { total, die }) {
  const html = [];
  let out = total;
  // 5–8: the attack after the one that set it up hurts them, hit or miss (those set up by this very roll's Jinxes wait for the next one).
  for (const e of spellEffects(actor, "ruinBacklash")) {
    const d = dataOf(e);
    await changeEffect(e, null);
    const r = await roll(`${d.power}d10`);
    const n = R.fortuneScale(r.total, d.bstacks ?? 0);
    html.push(`Ruin: ${esc(actor.name)} hurts themself with the attack: ${await hurt(actor, n, "physical", d.caster)}.`);
  }
  const jinxes = spellEffects(actor, "jinx");
  const casters = new Set(jinxes.map(e => dataOf(e).caster));
  if (jinxes.length) {
    const band = R.ruinBand(total, die);
    html.push(`Ruin's Bands: ${total} on a d${die} — ${band.label}.`);
    if (band.fizzle) {
      for (const e of jinxes) {
        const d = dataOf(e);
        if (d.enhanced && !d.waited) { await changeEffect(e, { "flags.flowstate.spellEffect.waited": true }); html.push(`${esc(e.name)} waits for their next attack roll (Enhanced).`); }
        else { await changeEffect(e, null); html.push(`${esc(e.name)} fizzles.`); }
      }
    } else {
      // 61–64: the next Jinx to resolve gets 2 more Strengthened (the first one, when several resolve at once).
      const boost = spellEffects(actor, "ruinJinxBoost");
      let extra = boost.length ? 2 : 0;
      for (const e of boost) await changeEffect(e, null);
      for (const e of jinxes) {
        const d = dataOf(e), caster = fromU(d.caster);
        await changeEffect(e, null);
        if (!caster) continue;
        html.push(await resolveJinx(caster, actor, d, band.stacks + extra));
        extra = 0;
      }
    }
  }
  // Reversal (T4): the casters whose Jinxes this roll resolved may flip it: only the attack uses the flipped number.
  for (const u of casters) {
    const caster = fromU(u);
    if (!caster || tier(caster, RUIN) < 4) continue;
    const flipped = R.flipRoll(out, die);
    const cost = halfSnap(caster);
    const ans = await askFor(caster, { react: "reversal", title: `Reversal: ${actor.name}`, ok: "Flip it", html: `<p>${esc(actor.name)}'s attack roll of <strong>${out}</strong> (d${die}) resolved your Jinxes. Flip it to <strong>${flipped}</strong> for ${cost} Energy? (Only their attack uses the flipped roll.)</p>` });
    if (ans && await mental.pay(caster, { energy: cost }, "Reversal")) { html.push(`Reversal (${esc(caster.name)}): the roll is flipped, ${out} → <strong>${flipped}</strong>.`); out = flipped; }
  }
  // 65–68: a free flip of this attack roll.
  for (const e of spellEffects(actor, "ruinFlip")) {
    const caster = fromU(dataOf(e).caster);
    await changeEffect(e, null);
    if (!caster) continue;
    const flipped = R.flipRoll(out, die);
    const ans = await askFor(caster, { react: "reversal", title: `Ruin: flip ${actor.name}'s roll`, ok: "Flip it", html: `<p>Flip ${esc(actor.name)}'s attack roll of <strong>${out}</strong> (d${die}) to <strong>${flipped}</strong>, for free?</p>` });
    if (ans) { html.push(`Ruin (${esc(caster.name)}): the roll is flipped for free, ${out} → <strong>${flipped}</strong>.`); out = flipped; }
  }
  return { total: out, lines: html };
}

/** Resolve one Jinx's effect on `target` with `stacks` more Strengthened (the band, 61–64). Returns a card line. */
async function resolveJinx(caster, target, d, stacks) {
  const bs = (d.bstacks ?? 0) + stacks, P = d.power ?? 1, p = d.payload ?? {};
  if (p.type === "damage") {
    const r = await roll(`${p.n * P}d${p.sides}`);
    const n = R.fortuneScale(r.total, bs);
    return `${esc(caster.name)}'s Jinx: ${p.n * P}d${p.sides} = ${r.total}${n !== r.total ? ` → ${n}` : ""}: ${await hurt(target, n, p.dtype ?? "physical", caster.uuid, { jinx: true })}.`;
  }
  if (p.type === "forfeit") return `${esc(caster.name)}'s Forfeit: ${await drain(target, R.fortuneScale(p.n * P, bs), p.ratio ?? 1, caster)}`;
  const x = ctxFor(caster, target, P, bs);
  return `${esc(caster.name)}'s Calamity: ${await ruinEffect(x, p.roll)}`;
}

/* -------------------------------------------- */
/*  Damage, health loss and Energy              */
/* -------------------------------------------- */

async function hurt(who, n, type, casterUuid, { pierce = 0, jinx = false } = {}) {
  if (jinx) jinxDamage++;
  try {
    const outcome = await damageOutcome(who, n, type, { archetype: "magic", pierce });
    const res = await requestDamage(who, n, type, pierce, null, { wantResult: true, silent: true, archetype: "magic", shroudCtx: { source: `type:${type}`, attacker: casterUuid } });
    return `${esc(who.name)} takes <strong>${n}</strong> ${esc(DAMAGE_TYPES[type] ?? type)} (${res?.toHp ?? outcome.toHp} direct)`;
  } finally { if (jinx) jinxDamage--; }
}
/** Energy lost; what would go below 0 is health lost (× ratio), reduced by what blocks Supernatural damage. */
async function drain(actor, n, ratio = 1, caster = null) {
  const have = actor.system.energy?.value ?? 0, off = Math.min(have, n), deficit = n - off;
  if (off) await removeEnergy(actor, off);
  let tail = "";
  if (deficit) tail = `; the ${deficit} below 0: ${await hurt(actor, deficit * ratio, "supernatural", caster?.uuid ?? null, { jinx: true })}`;
  return `${esc(actor.name)} loses <strong>${off}</strong> Energy${tail}.`;
}

/** 81–84 and 73–76: the next damage they take (not a Jinx's) is Strengthened; the next damage they deal is Weakened. */
DAMAGE_PROVIDERS.push(async ({ attacker, target, n, notes }) => {
  let out = n;
  const weak = attacker ? spellEffects(attacker, "ruinWeakNext") : [];
  if (weak.length) { out = Math.floor(out * 0.5); notes.push("Ruin: their damage is Weakened (used up)"); for (const e of weak) await changeEffect(e, null); }
  const str = target && !jinxDamage ? spellEffects(target, "ruinStrNext") : [];
  if (str.length) { out = Math.floor(out * 1.5); notes.push("Ruin: the damage they take is Strengthened (used up)"); for (const e of str) await changeEffect(e, null); }
  return out;
});

/** 41–44: the next time they spend Energy, they spend more (below 0 is health lost). */
export async function energySpent(actor) {
  for (const e of spellEffects(actor, "ruinDrainNext")) {
    const d = dataOf(e);
    await changeEffect(e, null);
    const line = await drain(actor, d.amount ?? 0, 1, fromU(d.caster));
    await post(actor, { title: `${esc(actor.name)} — Ruin`, body: `<div class="fs-result">Spending Energy costs more: ${line}</div>` });
  }
}

/** 25–28: the heat again at the start of the target's next turn. */
TURN_START.push(async actor => {
  for (const e of spellEffects(actor, "ruinBurn")) {
    const d = dataOf(e);
    await changeEffect(e, null);
    await post(actor, { title: `${esc(actor.name)} — Ruin`, body: `<div class="fs-result">The heat returns: ${await hurt(actor, d.amount ?? 0, "heat", d.caster)}.</div>` });
  }
});

/* -------------------------------------------- */
/*  The Ruin Table                              */
/* -------------------------------------------- */

const ctxFor = (caster, target, P, bs) => ({ caster, target, P: Math.max(1, P || 1), bs: bs ?? 0, rolls: [] });
const v = (x, n) => R.fortuneScale(n * x.P, x.bs);
async function dmg(x, n, sides, type, opts = {}) {
  const r = await roll(`${n * x.P}d${sides}`); x.rolls.push(r);
  const amount = R.fortuneScale(r.total, x.bs + (opts.stacks ?? 0));
  return { r, n: amount, f: `${n * x.P}d${sides} = ${r.total}${amount !== r.total ? ` → ${amount}` : ""}`, line: await hurt(x.target, amount, type, x.caster.uuid, opts) };
}
const until = x => `until used or the start of ${x.caster.name}'s next turn`;
const mark = (x, who, data) => putSpellEffect(who, { caster: x.caster.uuid, mode: RUIN, ...data });
const around = (x, ft) => actorsInPlay().filter(a => live(a) && a.uuid !== x.target.uuid && near(x.target, a, ft));
async function pickNear(x, ft, title) {
  const cands = around(x, ft);
  if (!cands.length) return null;
  const u = cands.length === 1 ? cands[0].uuid : await mental.pickChoice(x.caster, title, cands.map(a => [a.uuid, a.name]));
  return cands.find(a => a.uuid === u) ?? null;
}
/** Take Temp HP, then spell shielding, off a creature. Returns how much came off. */
async function strip(who, n) {
  let left = n;
  for (const kind of ["tempHP", "shield"]) for (const e of spellEffects(who, kind)) {
    if (left <= 0) break;
    const hp = Number(dataOf(e).hp) || 0, take = Math.min(hp, left);
    left -= take;
    await changeEffect(e, hp - take > 0 ? { "flags.flowstate.spellEffect.hp": hp - take, ...(kind === "tempHP" ? { name: `Temp HP (${hp - take})` } : {}) } : null);
  }
  return n - left;
}

export const RUIN_ROWS = [
  async x => { const full = x.target.system.hp.value >= 0.75 * (x.target.system.hp.max ?? 0); const d = await dmg(x, 1, 12, "physical", { stacks: full ? 2 : 0 }); return `${d.f}${full ? " (at ¾ health or more: 2 more Strengthened)" : ""}: ${d.line}.`; },  // 1–4
  async x => { await mark(x, x.target, { kind: "ruinBacklash", stack: true, power: x.P, bstacks: x.bs, name: "Ruin: next attack hurts them", description: `Their next attack after this one deals ${x.P}d10 physical to themself, hit or miss, ${until(x)}.` }); return `Their next attack after this one deals <strong>${x.P}d10</strong> physical to themself, hit or miss.`; },  // 5–8
  async x => { const d = await dmg(x, 1, 10, "physical"); const o = await pickNear(x, 10, "Ruin: who else within 10 ft"); return `${d.f}: ${d.line}${o ? `; ${await hurt(o, d.n, "physical", x.caster.uuid)}` : " (no one else within 10 ft)"}.`; },  // 9–12
  async x => { const o = await pickNear(x, 10, "Ruin: pass a fresh Jinx to"); if (!o) return "A fresh Jinx has no one within 10 ft to pass to."; await storeJinx(x.caster, o, { type: "damage", n: 1, sides: 8, dtype: "physical" }, { power: x.P }); return `A fresh Jinx (${x.P}d8 physical) passes to <strong>${esc(o.name)}</strong>.`; },  // 13–16
  async x => { const r = await roll(`${x.P}d10`); x.rolls.push(r); const off = await strip(x.target, R.fortuneScale(r.total, x.bs)); const d = await dmg(x, 1, 10, "acid"); return `${off} Temp HP/shielding stripped; ${d.f}: ${d.line}.`; },  // 17–20
  async x => { const d = await dmg(x, 1, 10, "radiation"); await mark(x, x.target, { kind: "ruinNoHeal", healDown: 1e9, name: "Ruin: can't regain health", description: `Can't regain health until the start of ${x.caster.name}'s next turn.` }); return `${d.f}: ${d.line}; they can't regain health until your next turn.`; },  // 21–24
  async x => { const d = await dmg(x, 1, 8, "heat"); await mark(x, x.target, { kind: "ruinBurn", stack: true, onTargetTurn: true, amount: d.n, name: `Ruin: heat again (${d.n})`, description: `${d.n} heat damage again at the start of their next turn.` }); return `${d.f}: ${d.line}; the same heat comes again at the start of their next turn.`; },  // 25–28
  async x => { const d = await dmg(x, 1, 10, "cold"); const n = v(x, 10) + await feedExtra(x.caster, x.target, "slow"); await setCond(x.target, { "system.conditions.slow": (x.target.system.conditions?.slow ?? 0) + n }); return `${d.f}: ${d.line}; <strong>${n} Slow</strong>.`; },  // 29–32
  async x => { const d = await dmg(x, 1, 10, "supernatural"); return `${d.f}: ${d.line} (health loss: what blocks Supernatural damage reduces it).`; },  // 33–36
  async x => drain(x.target, v(x, 3), 1, x.caster),  // 37–40
  async x => { const n = v(x, 3); await mark(x, x.target, { kind: "ruinDrainNext", amount: n, name: `Ruin: next Energy spent +${n}`, description: `The next time they spend Energy they spend ${n} more (below 0 is health lost), ${until(x)}.` }); return `The next time they spend Energy, they spend <strong>${n}</strong> more.`; },  // 41–44
  async x => { const c = x.target.system.conditions ?? {}, n = v(x, 10) + await feedExtra(x.caster, x.target, "slow"); await setCond(x.target, { "system.conditions.haste": 0, "system.conditions.slow": (c.slow ?? 0) + (c.haste ?? 0) + n }); return `Their ${c.haste ?? 0} Haste becomes Slow, plus <strong>${n} Slow</strong>.`; },  // 45–48
  async x => {                                                                                    // 49–52
    const n = v(x, 10), off = await strip(x.target, n);
    const items = (x.target.items ?? []).filter(i => (i.system?.durability?.max ?? 0) > 0 && (i.system.equipped || i.system.held || i.system.attuned || i.system.secondHand));
    let it = items.length === 1 ? items[0] : null;
    if (items.length > 1) { const id = await mental.pickChoice(x.caster, "Ruin: which object loses Durability", items.map(i => [i.id, i.name])); it = items.find(i => i.id === id) ?? items[0]; }
    if (it) { if (it.isOwner !== false) await it.update({ "system.wear": (it.system.wear ?? 0) + n }, { flowstateSystem: true }); else await requestGM("wearItem", { uuid: it.uuid, amount: n }); }
    return `${off} Temp HP/shielding stripped${it ? `; ${esc(it.name)} loses <strong>${n}</strong> Durability` : "; they hold or wear nothing with Durability"}.`;
  },
  async x => { const d = await dmg(x, 1, 8, "physical"); await mark(x, x.target, { kind: "ruinAttackDis", name: "Ruin: next attack at Disadvantage", description: `Their next attack roll has Disadvantage, ${until(x)}.` }); return `${d.f}: ${d.line}; their next attack roll has Disadvantage.`; },  // 53–56
  async x => { const d = await dmg(x, 1, 8, "physical"); await mark(x, x.target, { kind: "ruinDodgeDis", name: "Ruin: next dodge at Disadvantage", description: `Their next dodge roll has Disadvantage, ${until(x)}.` }); return `${d.f}: ${d.line}; their next dodge roll has Disadvantage.`; },  // 57–60
  async x => { const d = await dmg(x, 1, 6, "physical"); await mark(x, x.target, { kind: "ruinJinxBoost", name: "Ruin: next Jinx +2 Strengthened", description: `The next Jinx to resolve on them gains 2 Strengthened, ${until(x)}.` }); return `${d.f}: ${d.line}; the next Jinx to resolve on them gains 2 Strengthened.`; },  // 61–64
  async x => { const d = await dmg(x, 1, 6, "physical"); await mark(x, x.target, { kind: "ruinFlip", name: "Ruin: next attack roll can be flipped", description: `${x.caster.name} may flip their next attack roll for free (as Reversal), ${until(x)}.` }); return `${d.f}: ${d.line}; you may flip their next attack roll for free.`; },  // 65–68
  async x => { const p = v(x, 10); const d = await dmg(x, 1, 12, "physical", { pierce: p }); return `${d.f}, ignoring up to ${p} Limit: ${d.line}.`; },  // 69–72
  async x => { const d = await dmg(x, 1, 8, "physical"); await mark(x, x.target, { kind: "ruinWeakNext", name: "Ruin: next damage dealt Weakened", description: `The next damage they deal is Weakened, ${until(x)}.` }); return `${d.f}: ${d.line}; the next damage they deal is Weakened.`; },  // 73–76
  async x => {                                                                                    // 77–80
    const conc = concentration.list(x.target);
    let ended = "They aren't concentrating on anything";
    if (conc.length) { const id = conc.length === 1 ? conc[0].id : await mental.pickChoice(x.caster, "Ruin: which Concentration ends", conc.map(c => [c.id, c.label])); const pick = conc.find(c => c.id === id) ?? conc[0]; await concentration.end(x.target, pick.id, "the Ruin Table"); ended = `Their Concentration on ${esc(pick.label)} ends`; }
    const d = await dmg(x, 1, 8, "supernatural");
    return `${ended}; ${d.f}: ${d.line} (health loss).`;
  },
  async x => { const d = await dmg(x, 1, 8, "physical"); await mark(x, x.target, { kind: "ruinStrNext", name: "Ruin: next damage taken Strengthened", description: `The next non-Jinx damage they take is Strengthened, ${until(x)}.` }); return `${d.f}: ${d.line}; the next non-Jinx damage they take is Strengthened.`; },  // 81–84
  async x => { const e = x.target.system.energy ?? { value: 0, max: 0 }; if (e.value > e.max / 2) { const r = await removeEnergy(x.target, v(x, 5)); return `They lose <strong>${r.removed}</strong> Energy (${r.remaining} left).`; } const d = await dmg(x, 1, 10, "physical"); return `${d.f}: ${d.line}.`; },  // 85–88
  async x => { const r = await roll("1d100"); x.rolls.push(r); await storeJinx(x.caster, x.target, { type: "calamity", roll: r.total }, { power: x.P, label: "Calamity" }); return `A fresh Calamity is stored on them: Ruin Table ${r.total} (${esc(ruinRow(r.total)?.text ?? "")}).`; },  // 89–92
  async x => {                                                                                    // 93–96
    const lines = [];
    for (let i = 0; i < 2; i++) {
      let r; let tries = 0;
      do { r = await roll("1d100"); x.rolls.push(r); tries++; } while (r.total >= 89 && tries < 20);
      lines.push(await ruinEffect(x, r.total));
    }
    return `Twice more: ${lines.join(" · ")}`;
  },
  async x => { const d = await dmg(x, 1, 12, "supernatural"); await setStatus(x.target, "prone", true); return `${d.f}: ${d.line}; knocked prone.`; }  // 97–100
];

/** The Ruin Table's row for a d100: { index, range, text } (the doc's ranges and wording). */
export function ruinRow(n) {
  const rows = R.wonderById(RUIN)?.table?.rows ?? [];
  for (const [i, row] of rows.entries()) {
    const m = /^(\d+)\s*[–-]\s*(\d+)$/.exec(String(row[0]).trim());
    if (m && n >= Number(m[1]) && n <= Number(m[2])) return { index: i, range: row[0], text: row[1] };
  }
  return null;
}
async function ruinEffect(x, n) {
  const row = ruinRow(n), fn = row ? RUIN_ROWS[row.index] : null;
  if (!fn) return `No Ruin Table row for ${n}.`;
  return `<em>${esc(row.range)}</em> on ${esc(x.target.name)}: ${await fn(x)}`;
}
/** Apply a Ruin Table result now (Doom). Returns { html, rolls }. */
export async function applyRuin(caster, target, { P = 1, bs = 0, n }) {
  const x = ctxFor(caster, target, P, bs);
  return { html: `Ruin Table <strong>${n}</strong>: ${await ruinEffect(x, n)}`, rolls: x.rolls };
}

/* -------------------------------------------- */
/*  Doom (Tenet)                                */
/* -------------------------------------------- */

/** Doom (Ruin Tenet, Action List): any time, once per round: roll the Ruin Table, pick a creature within 100 ft, attack it: the result applies on a hit. */
export async function doom(actor) {
  const tn = tenetOf(actor);
  if (tn?.id !== DOOM) return ui.notifications.warn("Doom is Ruin's Tenet: attune an Icon to it first.");
  return runAct({ id: "doom", tenet: true, label: "Doom", caster: actor.uuid, target: actor.uuid, mult: tn.mult, bstacks: 0 });
}
ACTS.doom = async (x, caster) => {
  if (!(await tryOnce(caster, "doom"))) { ui.notifications.info("Doom: already used this round."); return false; }
  const r = await roll("1d100");
  const row = ruinRow(r.total);
  const targeted = [...(game.user?.targets ?? [])].map(t => t.actor).filter(live);
  const target = targeted.length === 1 ? targeted[0] : await mental.pickAnother(caster, { title: `Doom rolled ${r.total} (${row?.text ?? "?"}): attack`, within: 100 });
  if (!target) return true;
  await post(caster, { title: `${esc(caster.name)} — Doom`, rolls: [r], body: `<div class="fs-result"><i class="fa-solid fa-skull"></i> Doom rolls <strong>${r.total}</strong> on the Ruin Table (${esc(row?.range ?? "?")}: ${esc(row?.text ?? "")}). An attack roll at ${esc(target.name)} applies it on a hit.</div>` });
  await mental.specialAttack(caster, target, { label: "Doom", notes: [`Doom: Ruin Table ${r.total} on a hit`], flag: { doom: { n: r.total, mult: x.mult ?? 1 } } });
  return true;
};
export async function doomResolve({ attacker, target, result, m }) {
  if (!result.hit) return { html: `<div class="fs-notes">Doom misses ${esc(target.name)}: the Ruin Table result is lost.</div>` };
  const out = await applyRuin(attacker, target, { P: m.doom.mult ?? 1, bs: result.critStacks ?? (result.crit ? 2 : 0), n: m.doom.n });
  return { html: `<div class="fs-result"><i class="fa-solid fa-skull"></i> ${out.html}</div>`, rolls: out.rolls };
}

