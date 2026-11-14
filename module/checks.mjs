/**
 * Non Stat Checks (Rules doc Ch7, Generic Groups Tier 0s): Stealth, Perception, Persuasion, Deception, counter checks and Athletics on the plain attack
 * die. A check against one targeted creature is a contest: the card has a button for that creature's player to roll the other side (a Spot's Stealth,
 * a Persuade's counter check), and the acting side wins ties. Otherwise the roller can pick the GM's static target (Easy 5 ... Legendary 60).
 * The Tier 3 rerolls (Focus, Still Breath, Rephrase, Double Down, Hold Firm) and Athletics' Push Through are offered after the roll.
 * actions.mjs calls in through `registerChecks()` (`rollCheck`); the rules are in checks-rules.mjs.
 */
import { post, spendAP, spendPoints, spendEnergy, inActiveCombat, turnKey, setActorFlag, rollKit, registerChecks, spottedBy } from "./actions.mjs";
import * as ab from "./abilities.mjs";
import { poolFormula } from "./rules.mjs";
import { notCreature } from "./kinds.mjs";
import { askFor } from "./ask.mjs";
import { esc, select } from "./html.mjs";
import { CHECK_KINDS, CHECK_DIFFICULTIES, ATTITUDES, kindOf, actingWins, meetsTarget, underHalf, halfSP, socialCounter, actingNet, alacrityStacks } from "./checks-rules.mjs";
import { takeEdge } from "./edge.mjs";
import { energyHave } from "./consumables-rules.mjs";

const SOCIAL = new Set(["persuasion", "deception"]);
const tiersOf = actor => id => ab.treeTier(actor, id);
/** Total Skill Points: the size of the plain attack die (what changes attack rolls, like a die penalty, doesn't touch these checks). */
const sp = actor => Number(actor.system.skills?.total ?? actor.system.skillPoints) || 0;
/** No Primary or Heightened sense: actions that rely on senses have Disadvantage (Perception Tier 0). */
const senseNet = actor => (Object.values(actor.system.senses ?? {}).some(v => v === "primary" || v === "heightened") ? 0 : -1);

/** The creature a check is contested against: exactly one targeted creature (not yourself), for checks that have another side. */
function contestTarget(actor, kind) {
  if (!CHECK_KINDS[kind]?.against) return null;
  const list = [...(game.user.targets ?? [])].map(t => t.actor).filter(a => a && !notCreature(a) && a.uuid !== actor.uuid);
  return list.length === 1 ? list[0] : null;
}

/**
 * Roll a Non Stat Check. `contest`: this is the other side of a contested check ({ message, result, kind, actorName, net, notes }). `glimpse`: a
 * Glimpse's Spot (Steady Nerves gives the hider Advantage). Returns { result, message } (null if cancelled).
 */
export async function rollCheck(actor, kind, { apCost = 0, rpCost = 0, label = null, contest = null, net: extraNet = 0, notes: extraNotes = [], glimpse = false, effect = null } = {}) {
  const K = CHECK_KINDS[kind] ?? CHECK_KINDS.perception;
  const title = label ?? K.label;
  const die = Math.max(1, sp(actor));
  const stealthDis = kind === "stealth" ? Number(actor.system.penalties?.stealthDis) || 0 : 0;
  if (stealthDis === Infinity) {
    return { result: 0, message: await post(actor, { title: `${esc(title)} (d${die})`, body: `<div class="fs-outcome fs-miss">Automatically fails</div><div class="fs-notes">Titanic armor</div>` }) };
  }
  const target = contest ? null : contestTarget(actor, kind);
  const fields = [rollKit.netField()];
  if (!contest) {
    const vs = [["", target ? `Contested by ${target.name}` : "No target number"], ...Object.entries(CHECK_DIFFICULTIES).filter(([, d]) => !d.hidden).map(([k, d]) => [k, `${d.label} (${d.target})`])];
    fields.push(`<div class="form-group"><label>Against</label>${select("vs", vs, "")}</div>`);
    if (target && SOCIAL.has(kind)) fields.push(`<div class="form-group"><label>${esc(target.name)}'s attitude toward ${esc(actor.name)}</label>${select("attitude", Object.entries(ATTITUDES), "neutral")}</div>`);
  }
  const opts = await rollKit.optionsDialog(`${title} (d${die})`, fields.join(""), "Roll", { skipIfEmpty: true });
  if (!opts) return null;
  const vs = opts.vs ? CHECK_DIFFICULTIES[opts.vs] ?? null : null;
  const contested = !vs && !!target;
  const attitude = contested && SOCIAL.has(kind) ? opts.attitude || "neutral" : null;
  if (!(await spendAP(actor, apCost, title))) return null;
  if (rpCost && !(await spendPoints(actor, "rp", rpCost, title))) return null;

  const own = actingNet({ kind, attitude, tiers: tiersOf(actor) });
  const coverStory = kind === "deception" && !contest && !!actor.getFlag?.("flowstate", "coverStory");
  const steady = kind === "stealth" && glimpse && ab.treeTier(actor, "generic-stealth") >= 2 ? 1 : 0;
  const edge = ["perception", "athletics", "deception", "persuasion", "stealth"].includes(kind) ? await takeEdge(actor, kind) : 0;   // a Festival Token's use
  const net = (opts.net ?? 0) + extraNet + rollKit.net(actor) - stealthDis + (kind === "perception" ? senseNet(actor) : 0) + own.net + (contest?.net ?? 0) + (coverStory ? 1 : 0) + steady + edge;
  await rollKit.consumeDisrupt(actor);
  if (coverStory) await setActorFlag(actor, "coverStory", null);
  const formula = () => poolFormula(1, die, rollKit.noAdvantage(actor, net));
  const roll = await rollKit.evaluate(formula());
  const cr = await rollKit.charges({ actor, type: "other", roll, die, count: 1, net, max: die, label: title });
  const rolls = [roll, ...(cr?.rolls ?? [])];
  let result = roll.total;
  const lines = [];

  // Tier 3 rerolls: under half the die, for Energy equal to half your total Skill Points; once, or again while still under half at Tier 5.
  const tier = K.reroll ? ab.treeTier(actor, K.tree) : 0;
  for (let n = 0; K.reroll && tier >= 3 && underHalf(result, die) && (n === 0 || tier >= 5); n++) {
    const cost = halfSP(sp(actor));
    if (energyHave(actor) < cost) break;
    const ans = await askFor(actor, { title: `${K.reroll}: reroll?`, react: "checkReroll", ok: "Reroll",
      html: `<p>${esc(actor.name)}'s ${esc(title)} is <strong>${result}</strong>, under half of d${die}. Reroll for <strong>${cost} Energy</strong>? The new result stands${tier >= 5 ? ` (${K.repeat}: again while it's still under half)` : ""}.</p>` });
    if (!ans || !(await spendEnergy(actor, cost, K.reroll))) break;
    const r = await rollKit.evaluate(formula());
    rolls.push(r);
    lines.push(`${K.reroll}: rerolled ${result} → <strong>${r.total}</strong> (${cost} Energy)`);
    result = r.total;
  }
  // Push Through (Athletics T3): a failed Athletics check is rerolled, once per check (and once per turn in combat); free with Peak Condition (T5).
  const athletics = ab.treeTier(actor, "generic-athletics");
  if (kind === "athletics" && vs && !meetsTarget(result, vs.target) && athletics >= 3) {
    const key = turnKey();
    const fresh = !inActiveCombat(actor) || actor.getFlag?.("flowstate", "pushThroughTurn") !== key;
    const cost = athletics >= 5 ? 0 : halfSP(sp(actor));
    if (fresh && energyHave(actor) >= cost) {
      const ans = await askFor(actor, { title: "Push Through: reroll?", react: "checkReroll", ok: "Reroll",
        html: `<p>${esc(actor.name)}'s Athletics check (<strong>${result}</strong>) fails against ${vs.target}. Reroll it${cost ? ` for <strong>${cost} Energy</strong>` : " (free: Peak Condition)"}?</p>` });
      if (ans && (!cost || (await spendEnergy(actor, cost, "Push Through")))) {
        if (key) await setActorFlag(actor, "pushThroughTurn", key);
        const r = await rollKit.evaluate(formula());
        rolls.push(r);
        lines.push(`Push Through: rerolled ${result} → <strong>${r.total}</strong>`);
        result = r.total;
      }
    }
  }

  const notes = [rollKit.netLabel(net), stealthDis ? "armor penalty" : "", kind === "perception" && senseNet(actor) ? "no Primary or Heightened sense" : "",
    coverStory ? "Cover Story: Advantage" : "", steady ? "Steady Nerves: Advantage" : "", ...own.notes, ...(contest?.notes ?? []), ...extraNotes].filter(Boolean).join(" · ");
  let outcome = "";
  if (vs) outcome = `<div class="fs-outcome fs-${meetsTarget(result, vs.target) ? "hit" : "miss"}">${meetsTarget(result, vs.target) ? "Success" : "Failure"} against ${vs.label} (${vs.target})</div>`;
  if (contest) {
    const won = actingWins(contest.result, result);
    // A Spot or Glimpse that wins finds the hider (Stealth Tier 0: Spotted): it no longer has a Stealth Value against the spotter.
    if (won && contest.kind === "perception" && contest.actorUuid && actor.statuses?.has?.("stealth")) await setActorFlag(actor, "spottedBy", [...new Set([...spottedBy(actor), contest.actorUuid])]);
    // Feint (Diversion T2): the loser's next dodge roll has Disadvantage.
    const feinted = won && contest.effect === "feint";
    if (feinted) await setActorFlag(actor, "feinted", true);
    outcome = `<div class="fs-outcome fs-${won ? "miss" : "hit"}">${won ? `${esc(contest.actorName)} wins` : `${esc(actor.name)} wins`} (${contest.result} against ${result}${contest.result === result ? ", a tie goes to the acting side" : ""})</div>`
      + (feinted ? `<div class="fs-result">Feinted: ${esc(actor.name)}'s next dodge roll has Disadvantage.</div>` : "");
  }
  const counterRow = contested ? `<div class="fs-exchange-buttons fs-check-row" data-role="defender" data-owner="${target.uuid}">
      <button type="button" class="fs-counter-check"><i class="fa-solid fa-dice-d20"></i> ${esc(target.name)}: roll ${esc(CHECK_KINDS[K.against].label)}</button></div>` : "";
  const message = await post(actor, {
    title: `${esc(title)} (d${die})`,
    rolls,
    body: `${await rollKit.rollBlock(roll, "Roll")}${(cr?.notes ?? []).map(n => `<div class="fs-notes fs-charge-note"><i class="fa-solid fa-link"></i> ${n}</div>`).join("")}
      ${lines.length ? `<div class="fs-notes">${lines.join("<br>")}</div>` : ""}
      <div class="fs-result">Result: <strong>${result}</strong>${contested ? ` against ${esc(target.name)}` : ""}</div>
      ${outcome}${notes ? `<div class="fs-notes">${notes}</div>` : ""}${counterRow}`,
    flags: { flowstate: {
      check: { actor: actor.uuid, kind, label: title, result, die, target: contested ? target.uuid : null, attitude, against: contested ? K.against : null, inCombat: inActiveCombat(actor), glimpse, effect },
      ...(contest ? { checkOf: contest.message } : {})
    } }
  });
  await rollKit.hex(actor, "noncombat");
  return { result, message };
}

/** The other side of a contested check: the targeted creature's player rolls it from the card. */
export async function counterCheck(message) {
  const f = message?.getFlag("flowstate", "check");
  if (!f?.target || !f.against) return;
  if (findReply(message.id)) return ui.notifications.info("That check has been answered.");
  const target = await fromUuid(f.target), actor = await fromUuid(f.actor);
  if (!target?.isOwner) return ui.notifications.warn(`Only ${target?.name ?? "the target"}'s player can roll this.`);
  const social = SOCIAL.has(f.kind) ? socialCounter({ kind: f.kind, attitude: f.attitude, inCombat: f.inCombat, tiers: tiersOf(target), actorTiers: tiersOf(actor) }) : { net: 0, notes: [] };
  if (social.blocked) return post(target, { title: `${esc(target.name)} — ${esc(f.label)}`, body: `<div class="fs-notes">${esc(social.blocked)}</div>`, flags: { flowstate: { checkOf: message.id } } });
  return rollCheck(target, f.against, { label: `${CHECK_KINDS[f.against].label} against ${actor?.name ?? "them"}`, glimpse: !!f.glimpse,
    contest: { message: message.id, result: f.result, kind: f.kind, actorUuid: f.actor, effect: f.effect ?? null, actorName: actor?.name ?? "The acting side", net: social.net, notes: social.notes } });
}

const findReply = id => game.messages.find(m => m.getFlag("flowstate", "checkOf") === id) ?? null;

/** A contested check's card: the button only for the target's owner, and the outcome once it's answered. */
function decorate(message, html) {
  const row = html.querySelector?.(".fs-check-row");
  if (!row) return;
  const reply = findReply(message.id);
  if (reply) {
    const out = reply.getFlag("flowstate", "check")?.result;
    const f = message.getFlag("flowstate", "check");
    row.innerHTML = out == null ? `<div class="fs-waiting">Answered.</div>`
      : `<div class="fs-outcome fs-${actingWins(f.result, out) ? "hit" : "miss"}">${actingWins(f.result, out) ? "Success" : "Failure"}: ${f.result} against ${out}</div>`;
    return;
  }
  const who = fromUuidSync(row.dataset.owner);
  if (!who?.isOwner) row.innerHTML = `<div class="fs-waiting" data-pending="1">Waiting for ${esc(who?.name ?? "the target")} to roll…</div>`;
  else row.querySelector(".fs-counter-check")?.addEventListener("click", event => { event.preventDefault(); counterCheck(message); });
}

export function registerCheckHooks() {
  Hooks.on("renderChatMessageHTML", decorate);
  Hooks.on("createChatMessage", m => { const ref = m.getFlag("flowstate", "checkOf"); const src = ref && game.messages.get(ref); if (src) ui.chat?.updateMessage?.(src); });
}

registerChecks({ rollCheck, kindOf });

/* -------------------------------------------- */
/*  Initiative (Initiative Tier 0)               */
/* -------------------------------------------- */

/** The Advantage each combatant rolls initiative with this time (Alacrity), keyed by combatant id. */
const initNet = new Map();

/** Alacrity (Initiative T1): before initiative is rolled, each combatant with it is asked whether to pay half its Skill Points in Energy for Advantage. */
export async function prepareInitiative(combat, ids) {
  for (const id of ids) {
    const c = combat.combatants.get(id), a = c?.actor;
    initNet.delete(id);
    const edge = a ? await takeEdge(a, "initiative") : 0;          // a Festival Token set to Initiative
    if (edge) initNet.set(id, edge);
    const stacks = a ? alacrityStacks(ab.treeTier(a, "generic-initiative")) : 0;
    if (!stacks) continue;
    const cost = halfSP(sp(a));
    if (energyHave(a) < cost) continue;
    const ans = await askFor(a, { title: `${a.name}: Alacrity?`, react: "alacrity", ok: "Use Alacrity",
      html: `<p>Roll ${esc(a.name)}'s initiative with <strong>${stacks === 2 ? "two stacks of Advantage (Lightning Reflexes)" : "Advantage"}</strong> for <strong>${cost} Energy</strong>?</p>` });
    if (ans && (await spendEnergy(a, cost, "Alacrity"))) initNet.set(id, stacks + edge);
  }
}
/** An initiative check: the plain attack die (total Skill Points), with Alacrity's Advantage and whatever else every roll takes. */
export function initiativeRoll(combatant) {
  const a = combatant.actor;
  const die = a ? Math.max(1, sp(a)) : 20;
  const net = (initNet.get(combatant.id) ?? 0) + (a ? rollKit.net(a) : 0);
  initNet.delete(combatant.id);
  return new Roll(poolFormula(1, die, a ? rollKit.noAdvantage(a, net) : net));
}
/**
 * Ties (Initiative Tier 0): tied characters reroll against each other to settle their order; one with Poised (Initiative T2) wins the tie instead
 * (Poised against Poised reroll). The order is kept as each combatant's `tiebreak` flag (higher goes first); the scores stay as rolled.
 */
export async function breakTies(combat) {
  const groups = new Map();
  for (const c of combat.combatants) if (c.initiative != null) (groups.get(c.initiative) ?? groups.set(c.initiative, []).get(c.initiative)).push(c);
  const lines = [];
  for (const [score, list] of groups) {
    if (list.length < 2) { if (list[0]?.getFlag?.("flowstate", "tiebreak")) await list[0].setFlag("flowstate", "tiebreak", 0); continue; }
    const rank = new Map(list.map(c => [c.id, (c.actor && ab.treeTier(c.actor, "generic-initiative") >= 2 ? 1000 : 0)]));
    const rolls = new Map();
    for (let tries = 0; tries < 20; tries++) {
      const keys = list.map(c => `${rank.get(c.id)}:${rolls.get(c.id) ?? 0}`);
      const clash = list.filter((c, i) => keys.filter(k => k === keys[i]).length > 1);
      if (!clash.length) break;
      for (const c of clash) rolls.set(c.id, (await new Roll(`1d${Math.max(2, c.actor ? sp(c.actor) : 20)}`).evaluate()).total);
    }
    for (const c of list) await c.setFlag("flowstate", "tiebreak", rank.get(c.id) + (rolls.get(c.id) ?? 0));
    const order = [...list].sort((x, y) => (rank.get(y.id) + (rolls.get(y.id) ?? 0)) - (rank.get(x.id) + (rolls.get(x.id) ?? 0)));
    lines.push(`${score}: ${order.map(c => `${esc(c.name)}${rank.get(c.id) ? " (Poised)" : ""}${rolls.has(c.id) ? ` rerolled ${rolls.get(c.id)}` : ""}`).join(", then ")}`);
  }
  if (lines.length) await ChatMessage.create({ content: `<div class="flowstate-card"><header class="fs-card-title">Initiative ties</header><div class="fs-notes">${lines.join("<br>")}</div></div>` });
}
/** Turn order: initiative, then a settled tie. */
export const tieOrder = (a, b) => (Number(b.getFlag?.("flowstate", "tiebreak")) || 0) - (Number(a.getFlag?.("flowstate", "tiebreak")) || 0);

/** Delaying (Initiative Tier 0): before your turn has started this round, lower your initiative to any score below it, for the rest of combat. */
export async function delayTurn(actor) {
  const combat = game.combat;
  const c = combat?.combatants?.find(x => x.actor?.uuid === actor.uuid);
  if (!combat?.started || !c) return ui.notifications.warn(`${actor.name} isn't in a running combat.`);
  const idx = combat.turns.findIndex(t => t.id === c.id);
  if (idx <= combat.turn) return ui.notifications.warn(`${actor.name}'s turn has already started this round.`);
  if (!(Number(c.initiative) > 0)) return ui.notifications.warn(`${actor.name} has no initiative to lower.`);
  const vals = await rollKit.optionsDialog(`${actor.name}: Delay`, `<div class="form-group"><label>New initiative (below ${c.initiative})</label><input type="number" name="score" value="${Math.max(0, c.initiative - 1)}" min="0" max="${c.initiative - 1}" step="1"></div>
    <p class="hint">You keep the new score for the rest of combat.</p>`, "Delay");
  if (!vals) return;
  const score = Math.max(0, Math.min(c.initiative - 1, Math.trunc(Number(vals.score) || 0)));
  await c.update({ initiative: score });
  await post(actor, { title: `${esc(actor.name)} — Delay`, body: `<div class="fs-result">${esc(actor.name)} delays: initiative lowered to <strong>${score}</strong> for the rest of combat.</div>` });
}
