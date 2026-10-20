/**
 * Growth (Dream) and Stagnation (Nightmare) (Mental Rework Test Ground).
 *  Growth: Cultivate puts Growth stacks on the target (until the start of your next turn). When it takes an action (anything that spends AP or RP), it can
 *  spend them, each on a different option its Cultivator has unlocked: Flourish (more damage), Thrift (less Energy), Pierce, Feed (more Ignite / Stain /
 *  Slow / Haste), Graft (more Temp HP / shielding granted), Bark (Temp HP for itself), Uproot (Force on its target), Offshoot (copy another option); Full
 *  Bloom Strengthens an action that spends three or more. Sapling (Tenet) hands out a stack. Spending is a popup as the action pays its first AP/RP
 *  (switchable in the Reaction List), or armed in advance from the Action List.
 *  Stagnation: Mire picks action types (Martial Attack / Mental Manifest / Magic Spell); points the target spends on those become Stagnation stacks, shared
 *  between all sources, and each count reached sets something off: Toll (1), Silt (2), Grind (3), Wane (4+), Crush (5), Stasis (6+: two of them, the
 *  Stagnation user's pick). Moss (Tenet) adds a stack. All of a creature's stacks go at the start of the turn of any of their sources.
 * They register into wonders.mjs (`MODES`, `ACTS`, the provider lists); mental.mjs hands the engine hooks to actions.mjs through `registerMental`.
 */
import { post, putSpellEffect, spellEffects, changeEffect, setActorFlag, requestDamage, damageOutcome, damageOutcomeHTML, requestGM, knockbackRow, slamDown } from "./actions.mjs";
import { removeEnergy } from "./elemental.mjs";
import { DAMAGE_TYPES } from "./rules.mjs";
import { askFor, everyActor } from "./ask.mjs";
import { tierOf } from "./skills.mjs";
import { BOLD } from "./mental-bold.mjs";
import * as R from "./mental-rules.mjs";
import { mental, bold, MODES, ACTS, ACT_PROVIDERS, CHOICE_PROVIDERS, TURN_START, BEFORE_CLEAR, tenetOf, tryOnce, forceRoll } from "./wonders.mjs";
import { notCreature } from "./kinds.mjs";
import { esc } from "./html.mjs";

export const GROWTH = "mental-growth-dream", STAGNATION = "mental-stagnation-nightmare";
const CULTIVATE = `${GROWTH}:cultivate`, MIRE = `${STAGNATION}:mire`;
const tier = (actor, id) => tierOf(actor?.system?.trees ?? {}, id);
const fromU = u => (u ? globalThis.fromUuidSync?.(u) ?? null : null);
const dataOf = e => e.flags.flowstate.spellEffect;
const live = a => a && !notCreature(a);
const roll = formula => new Roll(formula).evaluate();
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* -------------------------------------------- */
/*  Growth: the options                         */
/* -------------------------------------------- */

/**
 * The Growth options, the Growth tier that unlocks each, and what one stack does at Power `p` with `bs` Strengthened stacks (`n` = 2 when Offshoot copies it).
 * Offshoot (T4) has no number of its own: it copies another option spent on the same action.
 */
export const OPTIONS = {
  flourish: { label: "Flourish", tier: 1, text: (p, bs, n = 1) => `the attack deals ${2 * p * n}d8 more damage of its type${bs ? ` (${bs > 0 ? "Strengthened" : "Weakened"})` : ""}` },
  thrift: { label: "Thrift", tier: 1, value: (p, bs, n = 1) => bold(bs, 3 * p * n), text: (p, bs, n = 1) => `the action costs ${bold(bs, 3 * p * n)} less Energy` },
  pierce: { label: "Pierce", tier: 2, value: (p, bs, n = 1) => bold(bs, 10 * p * n), text: (p, bs, n = 1) => `the attack ignores up to ${bold(bs, 10 * p * n)} Limit` },
  feed: { label: "Feed", tier: 2, value: (p, bs, n = 1) => bold(bs, 12 * p * n), text: (p, bs, n = 1) => `Ignite, Stain, Slow or Haste it applies: ${bold(bs, 12 * p * n)} more of each` },
  graft: { label: "Graft", tier: 3, value: (p, bs, n = 1) => bold(bs, 10 * p * n), text: (p, bs, n = 1) => `Temp HP or shielding it grants its target: ${bold(bs, 10 * p * n)} more` },
  bark: { label: "Bark", tier: 3, value: (p, bs, n = 1) => bold(bs, 10 * p * n), text: (p, bs, n = 1) => `you gain ${bold(bs, 10 * p * n)} Temp HP until the start of your next turn` },
  uproot: { label: "Uproot", tier: 4, text: (p, bs, n = 1) => `on a hit, its target is hit with ${12 * p * n}d8 Force in a direction the Cultivator chooses` },
  offshoot: { label: "Offshoot", tier: 4, text: () => "copy another option spent on this action (once per action)" }
};
const OPTION_KEYS = Object.keys(OPTIONS);

/** Growth stack effects on a creature: [{ effect, caster, count, power, bs }]. */
export function growthOf(actor) {
  return spellEffects(actor, "growth").map(e => ({ effect: e, caster: fromU(dataOf(e).caster), count: Number(dataOf(e).count) || 0, power: Number(dataOf(e).power) || 1, bs: Number(dataOf(e).bstacks) || 0 }))
    .filter(g => g.count > 0);
}
export const growthCount = actor => growthOf(actor).reduce((n, g) => n + g.count, 0);
/** The options a stack from this Cultivator can be spent on (by their Growth tier). */
const unlocked = caster => OPTION_KEYS.filter(k => tier(caster, GROWTH) >= OPTIONS[k].tier);

const growthName = n => `Growth (${plural(n, "stack")})`;
function growthText(caster, n) {
  const opts = unlocked(caster).map(k => OPTIONS[k].label).join(", ");
  return `${plural(n, "Growth stack")} from ${caster?.name ?? "a Growth user"}: when this creature takes an action (anything that spends AP or RP), it can spend them, each on a different option (${opts}). Until the start of ${caster?.name ?? "the caster"}'s next turn.`;
}

/** Give a creature Growth stacks from this caster (they join the caster's stacks already there). */
export async function addGrowth(target, caster, n, power, bs) {
  const mine = spellEffects(target, "growth").find(e => dataOf(e).caster === caster.uuid);
  if (mine) {
    const count = (Number(dataOf(mine).count) || 0) + n;
    return changeEffect(mine, { "flags.flowstate.spellEffect.count": count, "flags.flowstate.spellEffect.power": Math.max(power, Number(dataOf(mine).power) || 1),
      "flags.flowstate.spellEffect.bstacks": Math.max(bs ?? 0, Number(dataOf(mine).bstacks) || 0), name: growthName(count), description: growthText(caster, count) });
  }
  return putSpellEffect(target, { kind: "growth", stack: true, caster: caster.uuid, mode: CULTIVATE, count: n, power, bstacks: bs ?? 0, name: growthName(n), description: growthText(caster, n) });
}

MODES[CULTIVATE] = async c => {
  if (!live(c.target)) return `<strong>Cultivate</strong> needs a creature.`;
  const n = c.enhanced ? 2 : 1;
  await addGrowth(c.target, c.attacker, n, c.power, c.bs);
  const opts = unlocked(c.attacker).map(k => OPTIONS[k].label).join(", ");
  return `<strong>${esc(c.target.name)}</strong> gains <strong>${plural(n, "Growth stack")}</strong> until the start of your next turn: spent on its actions, each on a different option (${opts}).`;
};

/* -------------------------------------------- */
/*  Growth: spending                            */
/* -------------------------------------------- */

/** Points paid within this long of the last question are the same action paying the rest of its cost (a Manifest's AP then RP). */
const SAME_ACTION_MS = 4000;
/** How long the options spent stay with an action (its attack, the Energy it pays, what it applies). */
const SPENT_MS = 120000;
const asked = new Map();                 // actor uuid → when its player was last asked (or its armed options taken up)
const attacked = new Set();              // actors whose last question an attack has already followed
const thrift = new Map();                // actor uuid → { amount, at }: Energy the next payment of this action doesn't cost
const upkeep = /\b(holding Concentration|maintaining|Careful Steps|reloading|Quickload)\b/i;

const spentOf = actor => actor?.getFlag?.("flowstate", "growthSpent") ?? null;
const fresh = s => !!s && !s.armed && Date.now() - (Number(s.at) || 0) < SPENT_MS;
/** The record of what this action spent is written whole (flags merge: a key left out would survive from the last one). */
async function writeSpent(actor, rec) {
  if (spentOf(actor)) await setActorFlag(actor, "growthSpent", null);
  if (rec) await setActorFlag(actor, "growthSpent", rec);
}

/** The popup: which options to spend this action's Growth stacks on. Returns { picks: [key], copy } or null. */
async function askOptions(actor, what) {
  const g = growthOf(actor);
  const total = g.reduce((n, x) => n + x.count, 0);
  if (!total) return null;
  const best = k => g.filter(x => unlocked(x.caster).includes(k)).sort((a, b) => b.power - a.power)[0];
  const avail = OPTION_KEYS.filter(k => best(k));
  if (!avail.length) return null;
  const rows = avail.map(k => { const b = best(k); return `<label class="fs-cast-mod"><input type="checkbox" name="opt_${k}"> <strong>${OPTIONS[k].label}</strong> <small>${esc(OPTIONS[k].text(b.power, b.bs))}</small></label>`; }).join("");
  const copy = avail.includes("offshoot") ? `<div class="fs-field"><label>Offshoot copies</label><select name="copy">${avail.filter(k => k !== "offshoot").map(k => `<option value="${k}">${OPTIONS[k].label}</option>`).join("")}</select></div>` : "";
  const ans = await askFor(actor, { react: "growth", title: `Growth: ${actor.name}`, ok: "Spend", html: `<p><strong>${esc(actor.name)}</strong> has ${plural(total, "Growth stack")} (${g.map(x => `${x.count} from ${esc(x.caster?.name ?? "?")}`).join(", ")}).
    Spend them on ${esc(what || "this action")}? One stack per option, each on a different one.</p>${rows}${copy}
    ${avail.some(k => g.some(x => tier(x.caster, GROWTH) >= 5)) ? `<p class="hint">Full Bloom: three or more options Strengthen this action and its Growth effects.</p>` : ""}` });
  if (!ans) return null;
  const picks = avail.filter(k => ans[`opt_${k}`]).slice(0, total);
  return picks.length ? { picks, copy: ans.copy } : null;
}

/**
 * Spend stacks on the options picked: each takes a stack from a Cultivator who unlocked it (the strongest first, options fewer of them offer first).
 * Takes the stacks off and returns the action's record { at, opts: { key: { p, bs, n, by } }, bloom }, or null if nothing could be paid for.
 */
export async function spendGrowth(actor, { picks, copy }) {
  const g = growthOf(actor).map(x => ({ ...x, left: x.count }));
  const order = [...picks].sort((a, b) => g.filter(x => unlocked(x.caster).includes(a)).length - g.filter(x => unlocked(x.caster).includes(b)).length);
  const got = {};
  for (const k of order) {
    const src = g.filter(x => x.left > 0 && unlocked(x.caster).includes(k)).sort((a, b) => b.power - a.power)[0];
    if (!src) continue;
    src.left--;
    got[k] = { p: src.power, bs: src.bs, n: 1, by: src.caster?.uuid ?? null, t5: tier(src.caster, GROWTH) >= 5 };
  }
  if (got.offshoot) {
    const k = got[copy] && copy !== "offshoot" ? copy : Object.keys(got).find(x => x !== "offshoot");
    if (k) got[k].n = 2;
    got.offshoot.copied = k ?? null;
  }
  if (!Object.keys(got).length) return null;
  for (const x of g) if (x.left !== x.count) {
    if (x.left > 0) await changeEffect(x.effect, { "flags.flowstate.spellEffect.count": x.left, name: growthName(x.left), description: growthText(x.caster, x.left) });
    else await changeEffect(x.effect, null);
  }
  // Full Bloom (Growth T5): three or more options make the action and those Growth effects Strengthened.
  const bloom = Object.keys(got).length >= 3 && Object.values(got).some(o => o.t5);
  if (bloom) for (const o of Object.values(got)) o.bs += 1;
  return { at: Date.now(), opts: got, bloom, attached: false, feedDone: [], graftDone: [] };
}

/** What the options spent do the moment the action is taken: Thrift waits for the Energy payment, Bark's Temp HP goes on. Returns the card text. */
async function takeUp(actor, rec, what) {
  const o = rec.opts, lines = [];
  if (o.thrift) { const n = OPTIONS.thrift.value(o.thrift.p, o.thrift.bs, o.thrift.n); thrift.set(actor.uuid, { amount: n, at: Date.now() }); lines.push(`Thrift: ${n} less Energy`); }
  if (o.bark) {
    const n = OPTIONS.bark.value(o.bark.p, o.bark.bs, o.bark.n);
    await putSpellEffect(actor, { kind: "tempHP", stack: true, bark: true, caster: actor.uuid, mode: `${GROWTH}:bark`, hp: n, max: n, name: `Bark (${n} Temp HP)`,
      description: `Absorbs the next ${n} damage that would reach HP. Until the start of ${actor.name}'s next turn.` });
    lines.push(`Bark: ${n} Temp HP until the start of your next turn`);
  }
  for (const k of ["flourish", "pierce", "uproot", "feed", "graft"]) if (o[k]) lines.push(`${OPTIONS[k].label}: ${OPTIONS[k].text(o[k].p, o[k].bs, o[k].n)}`);
  if (o.offshoot) lines.push(`Offshoot: ${o.offshoot.copied ? `${OPTIONS[o.offshoot.copied].label} applies twice` : "nothing to copy"}`);
  if (rec.bloom) lines.push("Full Bloom: this action and its Growth effects are Strengthened");
  await post(actor, { title: `${esc(actor.name)} — Growth`, body: `<div class="fs-result"><i class="fa-solid fa-seedling"></i> ${esc(actor.name)} spends Growth on ${esc(what || "this action")}:</div><ul class="fs-list">${lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul>` });
}

/** Ask (or take up armed options) for the action being paid for now. Returns the record, or null. */
async function offer(actor, what) {
  asked.set(actor.uuid, Date.now()); attacked.delete(actor.uuid);
  const armed = spentOf(actor);
  if (armed?.armed) {
    const rec = { ...armed, armed: false, at: Date.now() };
    await writeSpent(actor, rec);
    await takeUp(actor, rec, what);
    asked.set(actor.uuid, Date.now());
    return rec;
  }
  if (armed) await writeSpent(actor, null);                 // the last action's options are done with
  if (!growthCount(actor)) return null;
  const ans = await askOptions(actor, what);
  asked.set(actor.uuid, Date.now());                        // the rest of this action's payment comes after the answer
  if (!ans) return null;
  const rec = await spendGrowth(actor, ans);
  if (!rec) return null;
  await writeSpent(actor, rec);
  await takeUp(actor, rec, what);
  return rec;
}

/** spendPoints paid AP or RP for an action (in combat): the first payment of an action is when its Growth is spent. Movement and upkeep aren't actions. */
export async function pointsSpent(actor, key, cost, what = "") {
  if (!cost || !live(actor) || upkeep.test(String(what))) return;
  if (Date.now() - (asked.get(actor.uuid) ?? 0) < SAME_ACTION_MS) return;
  const s = spentOf(actor);
  if (!s && !growthCount(actor)) return;
  await offer(actor, what);
}

/** Arm options from the Action List for the next action (taken up when it pays its first AP or RP, or makes its attack). */
export async function armGrowth(actor) {
  if (!growthCount(actor)) return ui.notifications.info(`${actor.name} has no Growth stacks.`);
  const ans = await askOptions(actor, "your next action");
  if (!ans) return;
  const rec = await spendGrowth(actor, ans);
  if (!rec) return;
  await writeSpent(actor, { ...rec, armed: true });
  return post(actor, { title: `${esc(actor.name)} — Growth`, body: `<div class="fs-result"><i class="fa-solid fa-seedling"></i> ${esc(actor.name)} readies Growth for their next action: ${Object.keys(rec.opts).map(k => OPTIONS[k].label).join(", ")}${rec.bloom ? " (Full Bloom)" : ""}.</div>` });
}

/** spendEnergy: Thrift takes its Energy off the action's payment (to a minimum of 0). */
export function energyCost(actor, cost) {
  const t = thrift.get(actor?.uuid);
  if (!t || !cost) return cost;
  thrift.delete(actor.uuid);
  if (Date.now() - t.at > 30000) return cost;
  return Math.max(0, cost - t.amount);
}

/** An attack is starting: it carries the action's Flourish, Pierce and Uproot (asked now if nothing was paid for it, as outside combat); Full Bloom Strengthens it. */
export async function attackStart(actor, opts) {
  if (!live(actor) || opts.mental?.ward || opts.mental?.reflect) return opts;
  let s = spentOf(actor);
  // Paid for in the last minute and no attack has followed yet: this is that action's attack (its question was asked as it paid).
  const paid = Date.now() - (asked.get(actor.uuid) ?? 0) < 60000 && !attacked.has(actor.uuid);
  if (s?.armed || (!paid && (!fresh(s) || s.attached) && growthCount(actor))) s = await offer(actor, opts.label || "this attack");
  attacked.add(actor.uuid);
  if (!fresh(s) || s.attached) return opts;
  await setActorFlag(actor, "growthSpent", { attached: true });
  const g = {};
  for (const k of ["flourish", "pierce", "uproot"]) if (s.opts[k]) g[k] = s.opts[k];
  if (!Object.keys(g).length && !s.bloom) return opts;
  return { ...opts, growth: g, stacks: (opts.stacks ?? 0) + (s.bloom ? 1 : 0), notes: [...(opts.notes ?? []), `Growth: ${Object.keys(g).map(k => OPTIONS[k].label).join(", ") || "spent"}${s.bloom ? " (Full Bloom: Strengthened)" : ""}`] };
}

/** The exchange's damage roll (weapons and spells; a Manifest's Flourish is dealt on its hit): Flourish's dice and Pierce's Limit. */
export async function growthDamage(o) {
  const g = o?.growth;
  if (!g || o.mental) return null;
  const out = { flat: 0, pierce: 0, rolls: [], notes: [] };
  if (g.flourish) {
    const r = await roll(`${2 * g.flourish.p * g.flourish.n}d8`);
    out.flat = bold(g.flourish.bs, r.total); out.rolls.push(r);
    out.notes.push(`Flourish: +${out.flat} damage (${2 * g.flourish.p * g.flourish.n}d8 = ${r.total})`);
  }
  if (g.pierce) { out.pierce = OPTIONS.pierce.value(g.pierce.p, g.pierce.bs, g.pierce.n); out.notes.push(`Pierce (Growth): ignores up to ${out.pierce} more Limit`); }
  return out;
}

/** The damage type a Mode deals (from its bolded text), or null if it deals none. */
function modeDamageType(modeId) {
  const mode = R.modeById(modeId);
  for (const s of BOLD[mode?.name] ?? []) {
    const m = String(s).toLowerCase().match(/\b([a-z]+) damage\b/);
    if (m && DAMAGE_TYPES[m[1]]) return m[1];
  }
  return null;
}

const hitsDone = new Set();
/** An attack hit: Uproot's Force on its target, and a Manifest's Flourish (the Mode's own damage type). */
export async function anyHit({ attacker, target, result, o, hitKey = null }) {
  const g = o?.growth;
  if (!g || !result?.hit || !live(target)) return;
  if (hitKey) { if (hitsDone.has(hitKey)) return; hitsDone.add(hitKey); if (hitsDone.size > 200) hitsDone.delete(hitsDone.values().next().value); }
  if (g.flourish && o.mental?.mode) {
    const type = modeDamageType(o.mental.mode);
    if (type) {
      const r = await roll(`${2 * g.flourish.p * g.flourish.n}d8`);
      const n = bold(g.flourish.bs, r.total);
      const outcome = await damageOutcome(target, n, type);
      await requestDamage(target, n, type, 0, null, { silent: true, shroudCtx: { attacker: attacker.uuid } });
      await post(attacker, { title: `${esc(attacker.name)} — Flourish`, rolls: [r], body: `<div class="fs-result"><i class="fa-solid fa-seedling"></i> Flourish: <strong>${n}</strong> more ${esc(DAMAGE_TYPES[type])} damage to ${esc(target.name)}.</div>${damageOutcomeHTML(target, n, type, outcome)}` });
    }
  }
  if (g.uproot) {
    const by = fromU(g.uproot.by) ?? attacker;
    const f = await forceRoll({ stacks: g.uproot.bs, target, attacker: by }, 12 * g.uproot.p * g.uproot.n, 8, "Uproot");
    await post(by, { title: `${esc(by.name)} — Uproot`, rolls: [f.r], body: `<div class="fs-result"><i class="fa-solid fa-seedling"></i> ${f.html}</div>${f.push ? knockbackRow(by.uuid, f.feet, "Uproot") : ""}`, flags: f.push ? { flowstate: { knockback: f.push } } : {} });
  }
}

/** Feed: what the acting creature's action applies to a target gets 12 × Power more of each kind (once per kind and target). Returns the extra. */
export async function feed(source, target, kind) {
  const s = spentOf(source);
  if (!fresh(s) || !s.opts?.feed || !target) return 0;
  const key = `${target.uuid}:${kind}`;
  if ((s.feedDone ?? []).includes(key)) return 0;
  await setActorFlag(source, "growthSpent", { feedDone: [...(s.feedDone ?? []), key] });
  return OPTIONS.feed.value(s.opts.feed.p, s.opts.feed.bs, s.opts.feed.n);
}

/** Graft: Temp HP or shielding the acting creature's action grants its target is 10 × Power more (once per target). Returns the effect to put on. */
export async function graft(target, effect) {
  if (!["tempHP", "shield"].includes(effect?.kind) || effect.bark || !effect.caster || !target) return effect;
  const source = fromU(effect.caster), s = spentOf(source);
  if (!fresh(s) || !s.opts?.graft || (s.graftDone ?? []).includes(target.uuid)) return effect;
  await setActorFlag(source, "growthSpent", { graftDone: [...(s.graftDone ?? []), target.uuid] });
  const n = OPTIONS.graft.value(s.opts.graft.p, s.opts.graft.bs, s.opts.graft.n);
  const hp = (Number(effect.hp) || 0) + n;
  return { ...effect, hp, max: (Number(effect.max) || 0) + n, name: `${effect.name ?? "Temp HP"} + Graft ${n}`, description: `${effect.description ?? ""} (Graft: +${n}.)`.trim() };
}

/** Sapling (Growth Tenet): once per round on a Manifest hit, the target or you gains a Growth stack. */
ACTS.sapling = async (x, caster, target) => {
  if (!(await tryOnce(caster, "sapling"))) { ui.notifications.info("Sapling: already used this round."); return false; }
  const pairs = [...(live(target) && target.uuid !== caster.uuid ? [[target.uuid, target.name]] : []), [caster.uuid, `${caster.name} (you)`]];
  const pick = pairs.length > 1 ? await mental.pickChoice(caster, "Sapling: who gains the Growth stack", pairs) : pairs[0][0];
  const who = pick === caster.uuid ? caster : pick ? target : null;
  if (!who) return false;
  await addGrowth(who, caster, 1, x.mult ?? 1, x.bstacks ?? 0);
  await post(caster, { title: `${esc(caster.name)} — Sapling`, body: `<div class="fs-result"><i class="fa-solid fa-seedling"></i> ${esc(who.name)} gains a Growth stack until the start of your next turn.</div>` });
  return true;
};

/* -------------------------------------------- */
/*  Stagnation: Mire and its stacks             */
/* -------------------------------------------- */

export const ACTION_TYPES = { martial: "Martial Attack", mental: "Mental Manifest", magic: "Magic Spell" };
/** The type of action an attack is, for Mire: a Manifest, a spell, or (anything else) a Martial attack. Wards, reflections and the like aren't Manifests. */
export const actionTypeOf = o => (o?.mental ? (o.mental.mode && !o.mental.ward && !o.mental.reflect ? "mental" : null) : o?.spell ? "magic" : "martial");

CHOICE_PROVIDERS.push((actor, modeId) => (modeId === MIRE ? [{ name: "mire", label: "Mire this action type", options: ACTION_TYPES },
  { name: "mire2", label: "If Enhanced: and this one", options: { "": "—", ...ACTION_TYPES } }] : []));

const miredTypes = actor => new Set(spellEffects(actor, "mire").flatMap(e => dataOf(e).types ?? []));

MODES[MIRE] = async c => {
  if (!live(c.target)) return `<strong>Mire</strong> needs a creature.`;
  const first = ACTION_TYPES[c.choices?.mire] ? c.choices.mire : "martial";
  const want = [...new Set([first, ...(c.enhanced && ACTION_TYPES[c.choices?.mire2] ? [c.choices.mire2] : [])])];
  const had = miredTypes(c.target);
  const add = want.filter(t => !had.has(t));
  if (!add.length) return `<strong>Mire</strong>: ${esc(c.target.name)}'s ${want.map(t => ACTION_TYPES[t]).join(" and ")} ${want.length === 1 ? "is" : "are"} already Mired, so it has no effect.`;
  const labels = add.map(t => ACTION_TYPES[t]).join(" and ");
  await putSpellEffect(c.target, { kind: "mire", stack: true, caster: c.attacker.uuid, mode: MIRE, types: add, power: c.power, bstacks: c.bs, name: `Mire (${labels})`,
    description: `Each AP or RP spent on a ${labels} gives a Stagnation stack; each stack count reached sets off an effect. Until the start of ${c.attacker.name}'s next turn.` });
  return `<strong>${esc(c.target.name)}</strong>'s ${esc(labels)} ${add.length === 1 ? "is" : "are"} Mired until the start of your next turn: each AP or RP spent on ${add.length === 1 ? "one" : "them"} gives a Stagnation stack.${add.length < want.length ? ` (${want.filter(t => had.has(t)).map(t => ACTION_TYPES[t]).join(", ")} was already Mired.)` : ""}`;
};

export const stagnationOf = actor => actor?.getFlag?.("flowstate", "stagnation") ?? null;
const STASIS_PICKS = { toll: "Toll", silt: "Silt", grind: "Grind", crush: "Crush" };

/** The effects of reaching one stack count, at the Stagnation user's tier. `m` = how many times over (Stasis combines two of the same). */
const EFFECTS = {
  async toll(t, caster, P, bs, m) {
    const n = bold(bs, 2 * P * m);
    const { removed } = await removeEnergy(t, n);
    let html = `Toll: ${esc(t.name)} loses <strong>${removed}</strong> Energy`;
    const over = n - removed;
    if (over > 0) {
      // Energy below 0 becomes health loss, 1:1, that what blocks Supernatural damage reduces (Temp HP, shielding, Shrouds, Wards).
      const outcome = await damageOutcome(t, over, "supernatural", { archetype: "magic" });
      const res = await requestDamage(t, over, "supernatural", 0, null, { wantResult: true, silent: true, archetype: "magic", shroudCtx: { source: "type:supernatural", attacker: caster.uuid } });
      const lost = res?.toHp ?? outcome.toHp;
      html += ` and <strong>${lost}</strong> health (${over} past 0 Energy${lost < over ? `, ${over - lost} blocked` : ""})`;
    }
    return `${html}.`;
  },
  async silt(t, caster, P, bs, m) {
    const n = bold(bs, 12 * P * m);
    const data = { "system.conditions.slow": (t.system.conditions?.slow ?? 0) + n };
    if (t.isOwner) await t.update(data); else await requestGM("updateActor", { uuid: t.uuid, data });
    return `Silt: ${esc(t.name)} gains <strong>${n} Slow</strong> stacks.`;
  },
  async grind(t, caster, P, bs, m, rolls) {
    const r = await roll(`${P * m}d8`);
    rolls.push(r);
    const n = bold(bs, r.total);
    const outcome = await damageOutcome(t, n, "physical");
    await requestDamage(t, n, "physical", 0, null, { silent: true, shroudCtx: { attacker: caster.uuid } });
    return `Grind: <strong>${n}</strong> physical damage (${P * m}d8 = ${r.total}).${damageOutcomeHTML(t, n, "physical", outcome)}`;
  },
  async crush(t, caster, P, bs, m, rolls) {
    const f = await forceRoll({ stacks: bs, target: t, attacker: caster }, 12 * P * m, 8, "Crush (downward)");
    rolls.push(f.r);
    return `${f.html}${f.feet > 0 ? await slamDown(t, f.feet) : ""}`;
  }
};

/** What reaching stack count `k` does (Toll 1, Silt 2, Grind 3, Wane 4+, Crush 5, Stasis 6+), by the Stagnation user's tier. Returns HTML. */
async function reach(t, caster, k, P, bs, rolls) {
  const T = tier(caster, STAGNATION);
  if (k === 1) return EFFECTS.toll(t, caster, P, bs, 1, rolls);
  if (k === 2) return EFFECTS.silt(t, caster, P, bs, 1, rolls);
  if (k === 3) return T >= 2 ? EFFECTS.grind(t, caster, P, bs, 1, rolls) : "";
  if (k === 4) return T >= 3 ? `Wane: while ${esc(t.name)} has 4 or more stacks, its attack rolls for Mired action types have a smaller die.` : "";
  if (k === 5) return T >= 4 ? EFFECTS.crush(t, caster, P, bs, 1, rolls) : "";
  if (T < 5) return "";
  // Stasis (T5): each stack from 6 on applies two of Toll, Silt, Grind and Crush, the Stagnation user's choice; the same one twice combines into one.
  const sel = name => `<select name="${name}">${Object.entries(STASIS_PICKS).map(([v, l]) => `<option value="${v}" ${v === (name === "a" ? "crush" : "grind") ? "selected" : ""}>${l}</option>`).join("")}</select>`;
  const ans = await askFor(caster, { react: "stasis", title: `Stasis: ${t.name}`, ok: "Apply", html: `<p>${esc(t.name)} reaches <strong>${k}</strong> Stagnation stacks. Stasis: apply two of Toll, Silt, Grind and Crush (the same one twice combines into one, twice as strong).</p>
    <div class="fs-field"><label>First</label>${sel("a")}</div><div class="fs-field"><label>Second</label>${sel("b")}</div>` });
  const a = STASIS_PICKS[ans?.a] ? ans.a : "crush", b = STASIS_PICKS[ans?.b] ? ans.b : "grind";
  if (a === b) return `Stasis (${k}): ${await EFFECTS[a](t, caster, P, bs, 2, rolls)}`;
  return `Stasis (${k}): ${await EFFECTS[a](t, caster, P, bs, 1, rolls)} ${await EFFECTS[b](t, caster, P, bs, 1, rolls)}`;
}

/** Add Stagnation stacks to a creature (from `caster`'s Mire or Moss, at Power `P`): each count it reaches sets its effect off. */
export async function addStagnation(t, n, { caster, power = 1, bs = 0, why = "" } = {}) {
  if (!live(t) || !caster || n <= 0) return;
  const cur = stagnationOf(t) ?? { count: 0, sources: [] };
  const from = Number(cur.count) || 0, to = from + n;
  await setActorFlag(t, "stagnation", { count: to, sources: [...new Set([...(cur.sources ?? []), caster.uuid])] });
  const rolls = [], lines = [];
  for (let k = from + 1; k <= to; k++) { const h = await reach(t, caster, k, power, bs, rolls); if (h) lines.push(h); }
  await post(t, { title: `${esc(t.name)} — Stagnation`, rolls, body: `<div class="fs-result"><i class="fa-solid fa-hourglass-half"></i> ${esc(t.name)}: Stagnation ${from} → <strong>${to}</strong>${why ? ` (${esc(why)})` : ""}.</div>${lines.map(l => `<div class="fs-notes">${l}</div>`).join("")}` });
}

/** A creature paid AP or RP for an action of this type: each point on a Mired type is a Stagnation stack (the strongest Mire on it decides the effects). */
export async function actionSpent(actor, { type, points }) {
  if (!points || !live(actor) || !ACTION_TYPES[type]) return;
  const mires = spellEffects(actor, "mire").filter(e => (dataOf(e).types ?? []).includes(type));
  if (!mires.length) return;
  const best = mires.map(e => ({ d: dataOf(e), caster: fromU(dataOf(e).caster) })).filter(x => x.caster)
    .sort((a, b) => tier(b.caster, STAGNATION) - tier(a.caster, STAGNATION) || (b.d.power ?? 1) - (a.d.power ?? 1))[0];
  if (!best) return;
  await addStagnation(actor, points, { caster: best.caster, power: Number(best.d.power) || 1, bs: Number(best.d.bstacks) || 0, why: `${plural(points, "point")} on a Mired ${ACTION_TYPES[type]}` });
}

/** Wane (Stagnation T3): at 4+ stacks, attack rolls of a Mired type have their die size lowered by 1 × Power. Returns { pen, note } or null. */
export function waneDie(actor, opts) {
  const st = stagnationOf(actor);
  if (!((Number(st?.count) || 0) >= 4)) return null;
  const type = actionTypeOf(opts);
  if (!type) return null;
  let pen = 0;
  for (const e of spellEffects(actor, "mire")) {
    const d = dataOf(e);
    if (!(d.types ?? []).includes(type) || tier(fromU(d.caster), STAGNATION) < 3) continue;
    pen = Math.max(pen, bold(d.bstacks ?? 0, Number(d.power) || 1));
  }
  return pen ? { pen, note: `Wane (${st.count} Stagnation): attack die −${pen}` } : null;
}

/** Moss (Stagnation Tenet): once per round on a Manifest hit, the target gains a Stagnation stack. */
ACTS.moss = async (x, caster, target) => {
  if (!live(target)) return false;
  if (!(await tryOnce(caster, "moss"))) { ui.notifications.info("Moss: already used this round."); return false; }
  await addStagnation(target, 1, { caster, power: x.mult ?? 1, bs: x.bstacks ?? 0, why: "Moss" });
  return true;
};

ACT_PROVIDERS.push(async c => {
  const a = c.attacker, tn = tenetOf(a);
  if (!tn || c.m?.spread || c.now) return [];
  const base = { target: c.target.uuid, caster: a.uuid, mode: c.mode.id, power: c.power, enhanced: !!c.enhanced, range: c.range, choices: c.choices ?? {}, crit: !!c.crit, bstacks: c.bs ?? c.stacks ?? 0, mult: tn.mult };
  if (tn.id === `${GROWTH}:sapling`) return [{ tenet: true, id: "sapling", label: "Sapling", tip: "Once per round: the target or you gains one Growth stack", cost: "once per round", ...base }];
  if (tn.id === `${STAGNATION}:moss` && live(c.target)) return [{ tenet: true, id: "moss", label: "Moss", tip: "Once per round: the target gains one Stagnation stack", cost: "once per round", ...base }];
  return [];
});

/* -------------------------------------------- */
/*  Turns                                       */
/* -------------------------------------------- */

// The start of a Stagnation source's turn: every creature carrying stacks from it loses all of them (they're shared between sources).
BEFORE_CLEAR.push(async actor => {
  for (const a of everyActor()) {
    const st = stagnationOf(a);
    if (st && (st.sources ?? []).includes(actor.uuid)) await setActorFlag(a, "stagnation", null);
  }
});
// The start of your own turn: what your last action spent is done with (armed options wait for your next action).
TURN_START.push(async actor => {
  const s = spentOf(actor);
  if (s && !s.armed) await writeSpent(actor, null);
  asked.delete(actor.uuid); thrift.delete(actor.uuid);
});

