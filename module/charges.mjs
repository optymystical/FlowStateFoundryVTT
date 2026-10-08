/**
 * Order and Chaos charges, live on dice rolls (Mental Rework Test Ground).
 *
 * A Mode leaves a charge (an effect of kind "charge") on its target. Whenever that creature makes a roll, `onRoll` finds the charges on them
 * and asks the creature that placed them (over the socket if that is somebody else) which to spend, as selectable options:
 *   Decree (static result), Fracture / Larceny (forced reroll), Mandate (plus or minus per charge), Preordained (Order T4), Control (Chaos T4).
 * After an attack is answered, `afterResolve` offers Verdict (swap hit and crit), Entropy (an extra roll on a crit) and Balance (Order Tenet).
 * `onDamage` handles damage rolls (Mandate Enhanced, Verdict's damage). `consumeCharge` in wonders.mjs stays as the manual fallback.
 */
import { post, spellEffects, changeEffect, setActorFlag, turnKey, performAttack } from "./actions.mjs";
import { poolFormula } from "./rules.mjs";
import { bold } from "./mental-rules.mjs";
import * as ab from "./abilities.mjs";
import { tierOf } from "./skills.mjs";
import { CHARGES, onceUsed, markOnce, tenetOf, runAct } from "./wonders.mjs";
import { pay } from "./mental.mjs";

const esc = s => foundry.utils.escapeHTML?.(String(s)) ?? String(s);
const DialogV2 = () => foundry.applications.api.DialogV2;
const minOf = (a, k) => ab.statMinOf(a, k);
const tier = (actor, id) => tierOf(actor?.system?.trees ?? {}, id);
const SOCKET = "system.flowstate";
const half = n => Math.floor(n / 2);
const pw = d => Math.max(1, Math.floor(Number(d?.power)) || 1);                      // Wonder Power: every bolded number grows with it
// A bolded number of a charge: its base value times Wonder Power, after the Strengthened/Weakened stacks the Manifest had.
const bs = (d, n) => bold(d?.bstacks, n * pw(d));
const sign = d => (d?.sign === "minus" ? -1 : 1);
const sgn = d => sign(d) * bs(d, 1);
const upDown = d => (d?.size === "down" ? -1 : 1);

/* -------------------------------------------- */
/*  Asking the caster                           */
/* -------------------------------------------- */

const formValues = form => {
  const v = {};
  for (const el of form.elements) if (el.name && !el.disabled) v[el.name] = el.type === "checkbox" ? el.checked : el.value;
  return v;
};

/** Show a small options dialog on this client and return its values (null if closed). */
export async function showChoices({ title, html, ok = "Use" }) {
  return DialogV2().prompt({ window: { title }, content: `<div class="fs-cast">${html}</div>`, ok: { label: ok, callback: (event, button) => formValues(button.form) }, rejectClose: false });
}

/** The user who should answer for this actor: one of its owners if any is online (us first), else the GM. */
export function answeringUser(actor) {
  const users = globalThis.game?.users;
  if (!users || actor?.isOwner) return globalThis.game?.user ?? null;
  const owner = [...users].find(u => u.active && !u.isGM && actor?.testUserPermission?.(u, "OWNER"));
  return owner ?? users.activeGM ?? [...users].find(u => u.isGM && u.active) ?? null;
}

const pending = new Map();
let reqCounter = 0;

/** Ask `actor`'s player to answer a dialog: locally if that's us, over the socket otherwise. Gives up (null) after a minute. */
export async function askFor(actor, spec) {
  const user = answeringUser(actor);
  if (!user || user.id === game.user.id) return showChoices(spec);
  const reqId = `${game.user.id}:${++reqCounter}`;
  return new Promise(resolve => {
    const timer = setTimeout(() => { pending.delete(reqId); resolve(null); }, 60000);
    pending.set(reqId, v => { clearTimeout(timer); resolve(v); });
    game.socket.emit(SOCKET, { action: "chargeAsk", to: user.id, from: game.user.id, reqId, spec });
  });
}

/** Run a button action (an ability or Tenet) as that character's player: here if it's ours, otherwise over the socket. */
export async function runOnOwner(actor, act) {
  const user = answeringUser(actor);
  if (!user || user.id === game.user.id) return runAct(act);
  game.socket.emit(SOCKET, { action: "mentalRun", to: user.id, act });
}

/** Wire the socket (every client answers dialogs addressed to it and receives answers to its own). */
export function listen() {
  game.socket.on(SOCKET, async data => {
    if (data?.action === "chargeAsk" && data.to === game.user.id) {
      const answer = await showChoices(data.spec);
      game.socket.emit(SOCKET, { action: "chargeAnswer", to: data.from, reqId: data.reqId, answer });
    } else if (data?.action === "mentalRun" && data.to === game.user.id) {
      await runAct(data.act);
    } else if (data?.action === "chargeAnswer" && data.to === game.user.id) {
      pending.get(data.reqId)?.(data.answer ?? null);
      pending.delete(data.reqId);
    }
  });
}

/* -------------------------------------------- */
/*  Helpers                                     */
/* -------------------------------------------- */

/** Overwrite a roll's total (the dice stay as rolled; the card notes say what changed). */
export function setRollTotal(r, n) {
  try { r._total = n; } catch (err) { /* read-only */ }
  if (r.total !== n) Object.defineProperty(r, "total", { value: n, configurable: true });
  return r;
}

/** Charges sitting on a creature: [{ effect, d, caster uuid }]. */
export const chargesOn = (actor, kinds = null) => spellEffects(actor, "charge")
  .map(effect => ({ effect, d: effect.flags.flowstate.spellEffect })).filter(c => !kinds || kinds.includes(c.d.charge));

const byCaster = list => { const m = new Map(); for (const c of list) { const k = c.d.caster; if (!m.has(k)) m.set(k, []); m.get(k).push(c); } return m; };

const preordainedOf = caster => {
  if (tier(caster, "mental-order-dream") < 4) return null;
  const n = caster.getFlag?.("flowstate", "preordained")?.n;
  return Number.isFinite(n) ? n : null;
};

async function reroll(count, die, net) { return new Roll(poolFormula(count, Math.max(1, die), net)).evaluate(); }
/** A forced reroll's new die size: dodge dice are changed by half (rounded up, at least 1). */
const shiftDie = (die, delta, count) => Math.max(1, die + (count > 1 ? Math.sign(delta) * Math.ceil(Math.abs(delta) / 2) : delta));

const rollName = type => ({ attack: "attack roll", dodge: "dodge roll", other: "roll", damage: "damage roll" }[type] ?? "roll");

/* -------------------------------------------- */
/*  A roll is made: charges on the roller       */
/* -------------------------------------------- */

/**
 * `actor` just made a roll (`roll`, already evaluated): offer the charges on them to whoever placed each. Changes the roll's total and returns
 * { notes, rolls } (extra dice to show), or null if nothing was done.
 * ctx: { type: "attack" | "dodge" | "other", die, count, net, max (the roll's top result), label }
 */
export async function onRoll({ actor, type, roll, die, count = 1, net = 0, max = null, label = "", attackOpts = null }) {
  if (!actor || actor.type === "pile") return null;
  const usable = chargesOn(actor, ["decree", "fracture", "larceny", "mandate"]);
  const stolen = actor.getFlag?.("flowstate", "stolenRoll");
  let stolenAction = false;
  const out = { notes: [], rolls: [] };
  const top = max ?? die * count;
  // Charges other creatures placed on the roller, asked of each caster in turn.
  for (const [casterUuid, list] of byCaster(usable)) {
    const caster = await fromUuid(casterUuid);
    if (!caster) continue;
    const rows = list.filter(c => c.d.charge !== "mandate" || !c.d.enhanced);          // Enhanced Mandate waits for a damage roll
    if (!rows.length) continue;
    const pre = preordainedOf(caster);
    const control = tier(caster, "mental-chaos-nightmare") >= 4;
    const total = roll.total;
    const opt = c => {
      const d = c.d, name = CHARGES[d.charge].label;
      const preBox = c.d.charge === "decree" || c.d.charge === "mandate" ? (pre !== null ? ` <label><input type="checkbox" name="p:${c.effect.id}"> Preordained (${d.sign === "minus" ? "−" : "+"}${pre}, ⚡ ${minOf(caster, "pon")})</label>` : "") : "";
      if (d.charge === "decree") {
        const myMax = type === "attack" ? caster.system.derived.attackDie : type === "dodge" ? 2 * caster.system.derived.dodgeDie : top;
        const base = half(d.enhanced ? myMax : top);
        return `<option value="${c.effect.id}">Decree: the roll becomes ${Math.max(0, base + sgn(d))} (half of ${d.enhanced ? "your" : "their"} max ${d.enhanced ? myMax : top}, ${d.sign === "minus" ? "−" : "+"}${bs(d, 1)})</option>`;
      }
      const delta = bs(d, { fracture: 2, larceny: 1 }[d.charge]) * upDown(d);
      return `<option value="${c.effect.id}">${name}: reroll at ${count > 1 ? `${count}d` : "d"}${shiftDie(die, delta, count)}${d.charge === "fracture" && d.enhanced ? ", keeping Advantage/Disadvantage" : ""}</option>`;
    };
    const replace = rows.filter(c => c.d.charge !== "mandate");
    const mand = rows.filter(c => c.d.charge === "mandate");
    const html = `<p><strong>${esc(actor.name)}</strong> made ${/^[aeiou]/.test(rollName(type)) ? "an" : "a"} <strong>${rollName(type)}</strong>${label ? ` (${esc(label)})` : ""}: <strong>${total}</strong>${roll.formula ? ` <small>(${esc(roll.formula)})</small>` : ""}. Spend your charges on it?</p>
      ${replace.length ? `<div class="fs-field"><label>Replace the roll</label><select name="replace"><option value="">— Leave the roll —</option>${replace.map(opt).join("")}</select></div>` : ""}
      ${replace.map(c => (pre !== null && c.d.charge === "decree" ? `<div><label><input type="checkbox" name="p:${c.effect.id}"> Decree + Preordained (${c.d.sign === "minus" ? "−" : "+"}${pre}, ⚡ ${minOf(caster, "pon")})</label></div>` : "")).join("")}
      ${mand.map(c => `<div><label class="fs-cast-mod"><input type="checkbox" name="m:${c.effect.id}"> <strong>Mandate</strong> ${c.d.sign === "minus" ? "−" : "+"}${bs(c.d, 1)} to the result${pre !== null ? ` <label><input type="checkbox" name="p:${c.effect.id}"> + Preordained (${pre}, ⚡ ${minOf(caster, "pon")})</label>` : ""}</label></div>`).join("")}
      ${control && replace.some(c => c.d.charge !== "decree") ? `<label class="fs-cast-mod"><input type="checkbox" name="control"> <strong>Control</strong> <small>reroll the forced roll once and use the new result</small></label>` : ""}`;
    const ans = await askFor(caster, { title: `${caster.name}'s charges on ${actor.name}`, html, ok: "Spend" });
    if (!ans) continue;
    const used = [];
    let n = roll.total;
    const lines = [];
    const rep = replace.find(c => c.effect.id === ans.replace);
    let preOn = 0;
    const withPre = c => ans[`p:${c.effect.id}`] && pre !== null ? sign(c.d) * pre : 0;
    const payPre = async c => { if (!ans[`p:${c.effect.id}`] || pre === null) return false; return pay(caster, { energy: minOf(caster, "pon") }, "Preordained"); };
    if (rep) {
      const d = rep.d;
      if (d.charge === "decree") {
        const myMax = type === "attack" ? caster.system.derived.attackDie : type === "dodge" ? 2 * caster.system.derived.dodgeDie : top;
        const p = (await payPre(rep)) ? withPre(rep) : 0;
        n = Math.max(0, half(d.enhanced ? myMax : top) + sgn(d) + p);
        lines.push(`Decree: ${esc(actor.name)}'s ${rollName(type)} becomes the static result <strong>${n}</strong>${p ? ` (${p > 0 ? "+" : "−"}${Math.abs(p)} Preordained)` : ""}.`);
      } else {
        const delta = bs(d, { fracture: 2, larceny: 1 }[d.charge]) * upDown(d);
        const keep = d.charge === "fracture" && d.enhanced;
        const nd = shiftDie(die, delta, count);
        let r = await reroll(count, nd, keep ? net : 0);
        out.rolls.push(r);
        let txt = `${count > 1 ? `${count}d` : "d"}${nd} = ${r.total}`;
        if (ans.control && control) { r = await reroll(count, nd, keep ? net : 0); out.rolls.push(r); txt += `, rerolled (Control) = ${r.total}`; }
        if (d.charge === "larceny") await setActorFlag(caster, "stolenRoll", { total: roll.total, type, original: roll.total, from: actor.name, key: turnKey() ?? "ooc" });
        // Enhanced Larceny steals the action itself: for up to a minute the thief can make a copy of that exact attack (their RP, the victim's dice).
        if (d.charge === "larceny" && d.enhanced && type === "attack" && attackOpts) {
          const { targetActors, ...saved } = attackOpts;
          await setActorFlag(caster, "stolenAction", { from: actor.uuid, fromName: actor.name, label: attackOpts.label || "Attack", opts: saved, cost: Math.max(0, Number(attackOpts.apCost) || 0), until: minuteFromNow() });
          stolenAction = true;
        }
        n = r.total;
        lines.push(d.charge === "fracture"
          ? `Fracture: ${esc(actor.name)} rerolls ${keep ? "(keeping the original's Advantage/Disadvantage)" : "(no effects carried over)"}: ${txt}.`
          : `Larceny: ${esc(caster.name)} steals ${esc(actor.name)}'s ${rollName(type)} (${roll.total}) and its effects, and ${esc(actor.name)} rerolls: ${txt}. ${esc(caster.name)} can use the stolen ${roll.total} in place of any roll before their next turn${d.enhanced ? (stolenAction ? `. Enhanced: ${esc(caster.name)} also steals the <strong>action itself</strong> for up to a minute: use "Stolen action" in the Action List to make a copy of this exact attack for RP equal to its AP cost, with ${esc(actor.name)}'s dice` : "; Enhanced, but this wasn't an attack, so there's no action to copy") : ""}.`);
      }
      used.push(rep);
    }
    for (const c of mand) {
      if (!ans[`m:${c.effect.id}`]) continue;
      const p = (await payPre(c)) ? withPre(c) : 0;
      n += sgn(c.d) + p; preOn += p;
      lines.push(`Mandate: the result ${sgn(c.d) > 0 ? "+" : "−"}${bs(c.d, 1)}${p ? `, ${p > 0 ? "+" : "−"}${Math.abs(p)} Preordained` : ""} → <strong>${Math.max(0, n)}</strong>.`);
      used.push(c);
    }
    if (!used.length) continue;
    setRollTotal(roll, Math.max(0, n));
    for (const c of used) await changeEffect(c.effect, null);
    out.notes.push(...lines);
    await post(caster, { title: `${esc(caster.name)} — ${used.map(c => CHARGES[c.d.charge].label).join(", ")}`, body: `<div class="fs-result">${lines.join("<br>")}</div>` });
  }
  // Larceny: a stolen roll can replace one of the thief's own rolls.
  if (stolen && actor.isOwner) {
    const ans = await showChoices({ title: "Stolen roll", html: `<p>Use the roll you stole from ${esc(stolen.from)} (<strong>${stolen.total}</strong>) in place of this ${rollName(type)} (<strong>${roll.total}</strong>)?</p>`, ok: "Use the stolen roll" });
    if (ans) {
      setRollTotal(roll, stolen.total);
      await setActorFlag(actor, "stolenRoll", null);
      const line = `Larceny: the stolen roll (${stolen.total}) replaces this ${rollName(type)}.`;
      out.notes.push(line);
      await post(actor, { title: `${esc(actor.name)} — Larceny`, body: `<div class="fs-result">${line}</div>` });
    }
  }
  return out.notes.length ? out : null;
}

/* -------------------------------------------- */
/*  An attack is answered: Balance, Verdict, Entropy */
/* -------------------------------------------- */

const outcomeOf = (atk, dodge) => { const hit = atk >= dodge, crit = hit && atk >= dodge * 2; return crit ? "crit" : hit ? "hit" : "miss"; };
const shape = (kind, base = {}) => ({ hit: kind !== "miss", crit: kind === "crit", doubleCrit: false, critStacks: kind === "crit" ? 2 : 0, outcome: kind === "crit" ? "Critical Hit" : kind === "hit" ? "Hit" : "Miss", ...base });

/**
 * After the attack and dodge are rolled: Balance (Order Tenet), then Verdict and Entropy on the attacker, Entropy on the defender.
 * `atk` and `dodge` are the Roll objects (their totals may change). Returns { result, notes, rolls, dmgAdjust } or null if nothing changed.
 */
export async function afterResolve({ attacker, target, atk, dodge, result, attackDie = null, o = null }) {
  if (!attacker || !target || !dodge) return null;
  const notes = [], rolls = [];
  let res = result, dmgAdjust = 0;
  const recompute = () => { res = shape(outcomeOf(atk.total, dodge.total)); };
  // Balance: once per round add 1 to your attack/dodge roll or remove 1 from the other side's, offered when it would change the outcome.
  for (const [who, mine, theirs] of [[attacker, atk, dodge], [target, dodge, atk]]) {
    const tn = tenetOf(who);
    if (tn?.id !== "mental-order-dream:balance") continue;
    const cur = outcomeOf(atk.total, dodge.total);
    const m = tn.mult ?? 1;
    const wantUp = who === attacker ? 1 : -1;                                   // the attacker wants a higher result, the defender a lower attack/higher dodge
    const tryOpt = (side, delta) => outcomeOf(atk.total + (side === "atk" ? delta : 0), dodge.total + (side === "dodge" ? delta : 0));
    const myKey = who === attacker ? "atk" : "dodge", oppKey = who === attacker ? "dodge" : "atk";
    const optMine = tryOpt(myKey, m), optOpp = tryOpt(oppKey, -m);
    if (optMine === cur && optOpp === cur) continue;
    if (onceUsed(who, "balance")) continue;
    const ans = await askFor(who, { title: "Balance", ok: "Use Balance", html: `<p>Balance (once per round): the attack is <strong>${atk.total}</strong> against a dodge of <strong>${dodge.total}</strong> (${cur}).</p>
      <div class="fs-field"><label>Use it to</label><select name="b"><option value="">— Don't —</option><option value="mine">Add ${m} to your ${who === attacker ? "attack" : "dodge"} result (→ ${optMine})</option><option value="opp">Remove ${m} from the ${who === attacker ? "dodge" : "attack"} result (→ ${optOpp})</option></select></div>` });
    if (!ans?.b) continue;
    await markOnce(who, "balance");
    if (ans.b === "mine") setRollTotal(mine, mine.total + m); else setRollTotal(theirs, Math.max(0, theirs.total - m));
    notes.push(`Balance: ${ans.b === "mine" ? `+${m} to ${who.name}'s own result` : `−${m} from the opposing result`} (attack ${atk.total}, dodge ${dodge.total}).`);
    recompute();
  }
  // Verdict (on the attacker): swap a regular hit and a crit, with 5 damage added or removed (doubled if the result is a crit).
  if (res.hit) for (const [casterUuid, list] of byCaster(chargesOn(attacker, ["verdict"]))) {
    const caster = await fromUuid(casterUuid);
    if (!caster) continue;
    const c = list[0];
    const pre = preordainedOf(caster);
    const to = res.crit ? "a regular hit" : "a crit";
    const ans = await askFor(caster, { title: `${caster.name}: Verdict on ${attacker.name}`, ok: "Pass judgment", html: `<p>${esc(attacker.name)}'s attack landed as <strong>${res.crit ? "a crit" : "a regular hit"}</strong> (attack ${atk.total} vs dodge ${dodge.total}). Use Verdict to make it ${to}?</p>
      <div class="fs-field"><label>Damage</label><select name="adj"><option value="1">Add ${bs(c.d, res.crit ? 5 : 10)} damage</option><option value="-1">Remove ${bs(c.d, res.crit ? 5 : 10)} damage</option></select></div>
      ${c.d.enhanced ? `<div class="fs-field"><label>Also give the attack</label><select name="stack"><option value="1">a Strengthened stack</option><option value="-1">a Weakened stack</option></select></div>` : ""}
      ${pre !== null ? `<label class="fs-cast-mod"><input type="checkbox" name="pre"> <strong>Preordained</strong> <small>⚡ ${minOf(caster, "pon")}: ±${pre} more damage</small></label>` : ""}` });
    if (!ans) continue;
    const swapped = shape(res.crit ? "hit" : "crit", { outcome: `${res.crit ? "Hit" : "Critical Hit"} (Verdict)` });
    const sgnV = Number(ans.adj) < 0 ? -1 : 1;
    const dmg = (Number(ans.adj) < 0 ? -1 : 1) * bs(c.d, swapped.crit ? 10 : 5);
    let extra = 0;
    if (ans.pre && pre !== null && (await pay(caster, { energy: minOf(caster, "pon") }, "Preordained"))) extra = sgnV * pre;
    res = { ...swapped, critStacks: swapped.critStacks + (c.d.enhanced ? Number(ans.stack) || 0 : 0) };
    dmgAdjust += dmg + extra;
    const line = `Verdict: ${esc(attacker.name)}'s ${swapped.crit ? "regular hit becomes a <strong>crit</strong>" : "crit becomes a <strong>regular hit</strong>"}, ${sgnV > 0 ? "+" : "−"}${Math.abs(dmg + extra)} damage${c.d.enhanced ? `, and a stack of ${Number(ans.stack) < 0 ? "Weakened" : "Strengthened"}` : ""}.`;
    notes.push(line);
    await changeEffect(c.effect, null);
    await post(caster, { title: `${esc(caster.name)} — Verdict`, body: `<div class="fs-result">${line}</div>` });
  }
  // Entropy: when the target would crit (the attacker) or be crit (the defender), an additional roll.
  if (res.crit) for (const [who, role] of [[attacker, "attack"], [target, "dodge"]]) {
    for (const [casterUuid, list] of byCaster(chargesOn(who, ["entropy"]))) {
      const caster = await fromUuid(casterUuid);
      if (!caster || !res.crit) continue;
      const c = list[0], d = c.d, delta = bs(d, 3) * upDown(d);
      const control = tier(caster, "mental-chaos-nightmare") >= 4;
      const dodgeDie = target.system.derived.dodgeDie, atkDie = attackDie ?? attacker.system.derived.attackDie;
      const ans = await askFor(caster, { title: `${caster.name}: Entropy on ${who.name}`, ok: "Spend Entropy", html: `<p>${esc(who.name)} ${role === "attack" ? "would crit" : "would be crit"} (attack ${atk.total} vs dodge ${dodge.total}). Spend Entropy for an additional roll (die size ${delta > 0 ? "+" : "−"}${Math.abs(delta)}${role === "dodge" ? ", dodge dice by half" : ""}${d.enhanced ? ", keeping the original's effects" : ""})?</p>
        ${role === "attack" ? `<div class="fs-field"><label>The additional roll is</label><select name="how"><option value="redo">The attack redone (replaces it)</option><option value="extra">An extra attack roll (the crit stands)</option></select></div>` : `<p class="hint">It's a new attempt to dodge, which replaces theirs.</p>`}
        ${control ? `<label class="fs-cast-mod"><input type="checkbox" name="control"> <strong>Control</strong> <small>reroll it once and use the new result</small></label>` : ""}` });
      if (!ans) continue;
      const count = role === "attack" ? 1 : 2;
      const base = role === "attack" ? atkDie : dodgeDie;
      const nd = shiftDie(base, delta, count);
      const keepNet = d.enhanced ? 0 : 0;                                       // the original's net isn't tracked here; only a plain roll is made
      if (role === "attack" && ans.how === "extra" && o) {
        // A real extra attack: the same attack, at the same target, with the changed die and none of the original's effects (unless Enhanced).
        const line = `Entropy: ${esc(attacker.name)} makes an <strong>extra attack</strong> at ${esc(target.name)} (d${nd}${d.enhanced ? ", keeping the original's effects" : ", no effects carried over"}). The original crit stands.`;
        notes.push(line);
        await changeEffect(c.effect, null);
        await post(caster, { title: `${esc(caster.name)} — Entropy`, body: `<div class="fs-result">${line}</div>` });
        await performAttack(attacker, { ...o, label: `${o.label || "Attack"} (Entropy: extra)`, targetActors: [target], dieOverride: nd, net: d.enhanced ? o.net ?? 0 : 0, followups: [], notes: ["Entropy: an extra attack"], stealth: "none" });
        continue;
      }
      let r = await reroll(count, nd, keepNet); rolls.push(r);
      let txt = `${count > 1 ? "2d" : "d"}${nd} = ${r.total}`;
      if (ans.control && control) { r = await reroll(count, nd, keepNet); rolls.push(r); txt += `, rerolled (Control) = ${r.total}`; }
      let line;
      if (role === "attack" && ans.how === "extra") {
        const oc = outcomeOf(r.total, dodge.total);
        line = `Entropy: ${esc(attacker.name)} gets an extra attack roll (${txt}) against the same dodge of ${dodge.total}: <strong>${oc === "miss" ? "a miss" : oc === "crit" ? "a crit" : "a hit"}</strong>. The original crit stands.`;
      } else if (role === "attack") {
        setRollTotal(atk, r.total); recompute();
        line = `Entropy: the attack is redone: ${txt} against a dodge of ${dodge.total}: <strong>${res.outcome}</strong>.`;
      } else {
        setRollTotal(dodge, r.total); recompute();
        line = `Entropy: ${esc(target.name)} makes a new attempt to dodge: ${txt} against an attack of ${atk.total}: <strong>${res.outcome}</strong>.`;
      }
      notes.push(line);
      await changeEffect(c.effect, null);
      await post(caster, { title: `${esc(caster.name)} — Entropy`, rolls: [r], body: `<div class="fs-result">${line}</div>` });
    }
  }
  return notes.length ? { result: res, notes, rolls, dmgAdjust } : null;
}

/* -------------------------------------------- */
/*  Damage rolls                                */
/* -------------------------------------------- */

/** The top result of a damage formula such as "2d6+3". */
export function formulaMax(formula) {
  let total = 0;
  for (const m of String(formula ?? "").matchAll(/([+-]?)\s*(\d+)(?:d(\d+))?/g)) total += (m[1] === "-" ? -1 : 1) * (m[3] ? Number(m[2]) * Number(m[3]) : Number(m[2]));
  return total;
}
/** The same formula with every die size changed (Fracture). */
export const shiftFormula = (formula, delta) => String(formula).replace(/(\d+)d(\d+)/g, (m, n, sides) => `${n}d${Math.max(1, Number(sides) + delta)}`);

/**
 * The attacker rolled damage (`formula`, one total per shot in `totals`): Decree sets it to half its top result ±1, Fracture rerolls it with every die
 * size changed by 2, Larceny steals the roll and has them reroll with every die size changed by 1 (the thief can use it for a roll of their own, a
 * damage roll included), Enhanced Mandates change it by ±10 each. Returns { flat, notes, totals?, rolls } or null.
 */
export async function onDamage({ actor, formula = "", totals = [] }) {
  const out = { flat: 0, notes: [], rolls: [], totals: null };
  for (const [casterUuid, list] of byCaster(chargesOn(actor, ["decree", "fracture", "larceny", "mandate"]).filter(c => c.d.charge !== "mandate" || c.d.enhanced))) {
    const caster = await fromUuid(casterUuid);
    if (!caster) continue;
    const pre = preordainedOf(caster);
    const top = formulaMax(formula);
    const replace = list.filter(c => c.d.charge !== "mandate" && (c.d.charge === "decree" || formula));
    const mand = list.filter(c => c.d.charge === "mandate");
    const opt = c => c.d.charge === "decree"
      ? `<option value="${c.effect.id}">Decree: the damage becomes ${Math.max(0, half(c.d.enhanced ? formulaMax(formula) : top) + sgn(c.d))} (half of ${top}, ${c.d.sign === "minus" ? "−" : "+"}${bs(c.d, 1)})</option>`
      : c.d.charge === "larceny" ? `<option value="${c.effect.id}">Larceny: steal this damage roll, they reroll as ${esc(shiftFormula(formula, bs(c.d, 1) * upDown(c.d)))}</option>`
      : `<option value="${c.effect.id}">Fracture: reroll as ${esc(shiftFormula(formula, 2 * upDown(c.d)))}</option>`;
    const ans = await askFor(caster, { title: `${caster.name}: charges on ${actor.name}'s damage`, ok: "Spend", html: `<p>${esc(actor.name)} rolled damage (${esc(formula)}): <strong>${totals.join(" + ")}</strong>. Spend your charges?</p>
      ${replace.length ? `<div class="fs-field"><label>Replace the roll</label><select name="replace"><option value="">— Leave it —</option>${replace.map(opt).join("")}</select></div>` : ""}
      ${replace.filter(c => c.d.charge === "decree" && pre !== null).map(c => `<div><label><input type="checkbox" name="p:${c.effect.id}"> Decree + Preordained (${pre}, ⚡ ${minOf(caster, "pon")})</label></div>`).join("")}
      ${mand.map(c => `<div><label class="fs-cast-mod"><input type="checkbox" name="m:${c.effect.id}"> <strong>Mandate</strong> ${c.d.sign === "minus" ? "−" : "+"}${bs(c.d, 10)}${pre !== null ? ` <label><input type="checkbox" name="p:${c.effect.id}"> + Preordained ×10 (${pre * 10}, ⚡ ${minOf(caster, "pon")})</label>` : ""}</label></div>`).join("")}` });
    if (!ans) continue;
    const rep = replace.find(c => c.effect.id === ans.replace);
    if (rep) {
      const d = rep.d;
      if (d.charge === "decree") {
        const p = ans[`p:${rep.effect.id}`] && pre !== null && (await pay(caster, { energy: minOf(caster, "pon") }, "Preordained")) ? sign(d) * pre : 0;
        const n = Math.max(0, half(top) + sgn(d) + p);
        out.totals = totals.map(() => n);
        out.notes.push(`Decree: the damage roll becomes the static <strong>${n}</strong>.`);
      } else {
        const larceny = d.charge === "larceny";
        const f = shiftFormula(formula, bs(d, larceny ? 1 : 2) * upDown(d));
        const rolls = [];
        for (let i = 0; i < Math.max(1, totals.length); i++) rolls.push(await new Roll(f).evaluate());
        out.rolls.push(...rolls);
        out.totals = rolls.map(r => r.total);
        if (larceny) {
          const stolenTotal = totals.reduce((a, b) => a + b, 0);
          await setActorFlag(caster, "stolenRoll", { total: stolenTotal, type: "damage", original: stolenTotal, from: actor.name, key: turnKey() ?? "ooc" });
          out.notes.push(`Larceny: ${esc(caster.name)} steals ${esc(actor.name)}'s damage roll (${stolenTotal}) and its effects, and ${esc(actor.name)} rerolls as ${esc(f)}: <strong>${out.totals.join(" + ")}</strong>. ${esc(caster.name)} can use the stolen ${stolenTotal} in place of any roll of their own before the start of their next turn.`);
        } else out.notes.push(`Fracture: the damage is rerolled as ${esc(f)}: <strong>${out.totals.join(" + ")}</strong>.`);
      }
      await changeEffect(rep.effect, null);
    }
    for (const c of mand) {
      if (!ans[`m:${c.effect.id}`]) continue;
      let n = sgn(c.d) * 10;
      if (ans[`p:${c.effect.id}`] && pre !== null && (await pay(caster, { energy: minOf(caster, "pon") }, "Preordained"))) n += sign(c.d) * pre * 10;
      out.flat += n;
      out.notes.push(`Mandate: ${n > 0 ? "+" : "−"}${Math.abs(n)} damage.`);
      await changeEffect(c.effect, null);
    }
  }
  // Larceny: a stolen roll can replace this damage roll too.
  const stolen = actor.getFlag?.("flowstate", "stolenRoll");
  const rolled = (out.totals ?? totals).reduce((a, b) => a + b, 0);
  if (stolen && actor.isOwner) {
    const ans = await showChoices({ title: "Stolen roll", html: `<p>Use the roll you stole from ${esc(stolen.from)} (<strong>${stolen.total}</strong>) in place of this damage roll (<strong>${rolled}</strong>)?</p>`, ok: "Use the stolen roll" });
    if (ans) {
      out.totals = (out.totals ?? totals).map((t, i) => (i === 0 ? stolen.total : 0));
      await setActorFlag(actor, "stolenRoll", null);
      const line = `Larceny: the stolen roll (${stolen.total}) replaces this damage roll.`;
      out.notes.push(line);
      await post(actor, { title: `${esc(actor.name)} — Larceny`, body: `<div class="fs-result">${line}</div>` });
    }
  }
  return out.notes.length ? out : null;
}

/* -------------------------------------------- */
/*  Larceny, Enhanced: the stolen action        */
/* -------------------------------------------- */

/** "Up to a minute": ten rounds in combat, a real minute outside it. */
function minuteFromNow() {
  const c = globalThis.game?.combat;
  return c?.started ? { combat: c.id, round: c.round + 10 } : { at: Date.now() + 60000 };
}
const expired = until => {
  const c = globalThis.game?.combat;
  if (!until) return true;
  if (until.combat) return !(c?.started && c.id === until.combat && c.round <= until.round);
  return Date.now() > until.at;
};
/** The action this creature stole and can still use, or null. */
export const stolenActionOf = actor => { const s = actor?.getFlag?.("flowstate", "stolenAction"); return s && !expired(s.until) ? s : null; };

/** Make a copy of the stolen attack: pay RP equal to its AP cost, roll with the victim's dice, aim at your targets. */
export async function useStolenAction(actor) {
  const s = stolenActionOf(actor);
  if (!s) { if (actor.getFlag?.("flowstate", "stolenAction")) await setActorFlag(actor, "stolenAction", null); return ui.notifications.info(`${actor.name} has no stolen action (it lasts up to a minute).`); }
  if (!(await pay(actor, { rp: s.cost }, `the stolen ${s.label}`))) return;
  const victim = await fromUuid(s.from);
  const targets = [...(game.user?.targets ?? [])].map(t => t.actor).filter(a => a && a.type !== "pile");
  await post(actor, { title: `${esc(actor.name)} — Stolen action`, body: `<div class="fs-result">${esc(actor.name)} makes a copy of ${esc(s.fromName)}'s <strong>${esc(s.label)}</strong> (${s.cost} RP), using ${esc(s.fromName)}'s dice.</div>` });
  return performAttack(actor, { ...s.opts, label: `${s.label} (stolen)`, dieOf: victim?.uuid ?? s.from, followups: [], notes: [...(s.opts.notes ?? []), `Stolen from ${s.fromName} (Larceny)`], ...(targets.length ? { targetActors: targets } : {}) });
}
