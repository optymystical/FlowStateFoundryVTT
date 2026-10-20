/**
 * The Snappence Arts (Mental T3 tree, Mental doc):
 *  - Reflex (T1): when a character you can sense begins an action, Manifest a Wonder first, for RP equal to the Range's AP cost and half the Scaling Stat min in Energy;
 *    its effects are Weakened. Offered automatically when someone attacks; the Action List row covers other actions (movement, dodging...).
 *  - Impulse (T2): once per round, apply your Tenet once more after it has already triggered this round.
 *  - Fixation (T3): declare a character at the start of your turn; Reflex against them isn't Weakened.
 *  - Nerve (T4): Advantage on the Willpower checks that keep a Concentration (concentration.mjs).
 *  - Afterimage (T5): once per round, Reflex costs no RP or ability Energy.
 */
import { post, setActorFlag, tokenDistance, attackerToken, helpless } from "./actions.mjs";
import { askFor, runOnOwner, actorsInPlay } from "./ask.mjs";
import * as R from "./mental-rules.mjs";
import * as ab from "./abilities.mjs";
import { tierOf } from "./skills.mjs";
import { mental, ACTS, TURN_START, impulseHook, tenetOf } from "./wonders.mjs";
import { notCreature } from "./kinds.mjs";
import { esc } from "./html.mjs";

export const snapTier = actor => tierOf(actor?.system?.trees ?? {}, "mental-snappence-arts");
const roundKey = () => (globalThis.game?.combat?.started ? `${game.combat.id}:${game.combat.round}` : "ooc");
const usedThisRound = (actor, flag) => actor.getFlag?.("flowstate", flag) === roundKey();
const markRound = (actor, flag) => setActorFlag(actor, flag, roundKey());
const near100 = (a, b) => { const ta = attackerToken(a), tb = b ? attackerToken(b) : null; return !ta || !tb || !globalThis.canvas?.grid || tokenDistance(ta, tb) <= 100; };

/** Fixation: the uuid of the character you declared at the start of your turn. */
export const fixationOf = actor => (snapTier(actor) >= 3 ? actor.getFlag?.("flowstate", "fixation") ?? null : null);
export const afterimageReady = actor => snapTier(actor) >= 5 && !usedThisRound(actor, "afterimage");
export const useAfterimage = actor => markRound(actor, "afterimage");

/* -------------------------------------------- */
/*  Reflex                                      */
/* -------------------------------------------- */

/** What Reflex looks like for this reactor against this trigger: Weakened unless it's your Fixation, free once a round with Afterimage. */
export const reflexFor = (actor, trigger) => ({ weak: !(trigger && fixationOf(actor) === trigger.uuid), trigger: trigger?.uuid ?? null, afterimage: afterimageReady(actor) });

/** `x.trigger` is who began the action (Fixation checks them); the Manifest's target is `x.target` (the attacker or the defender, the reactor's choice). */
ACTS.reflex = async (x, caster) => {
  const trigger = x.trigger ? await fromUuid(x.trigger) : null;
  return !!(await mental.manifest(caster, null, { reflex: { ...reflexFor(caster, trigger), target: x.target ?? null } }));
};

/** The Action List's Reflex row (for actions the system can't see begin): the creature you have targeted is the one acting. */
export async function reflexManual(actor) {
  if (snapTier(actor) < 1) return ui.notifications.warn("Reflex needs Snappence Arts Tier 1.");
  const trigger = [...(game.user?.targets ?? [])].map(t => t.actor).find(a => a && a.uuid !== actor.uuid) ?? null;
  return ACTS.reflex({ id: "reflex", caster: actor.uuid, trigger: trigger?.uuid ?? null, target: trigger?.uuid ?? null }, actor);
}

/** Someone is about to attack: every character who can sense it and has Reflex may Manifest first, at the attacker or at who they attack. Called from `performAttack`. */
export async function offerReflex(attacker, opts) {
  if (opts?.mental?.reflex) return;                                       // a Reflex Manifest doesn't set off other Reflexes
  const defenders = (opts?.targetActors ?? [...(game.user?.targets ?? [])].map(t => t.actor)).filter(t => t && !notCreature(t) && t.uuid !== attacker.uuid);
  for (const a of actorsInPlay()) {
    if (a.uuid === attacker.uuid || notCreature(a) || snapTier(a) < 1 || helpless(a) || !near100(a, attacker)) continue;
    const free = afterimageReady(a);
    if (!free && (a.system.rp?.value ?? 0) < 1) continue;
    const pickable = [attacker, ...defenders];
    const ans = await askFor(a, { react: "reflex", title: "Reflex", ok: "Use Reflex", html: `<p><strong>Reflex</strong>: ${esc(attacker.name)} is about to attack${defenders.length ? ` ${esc(defenders.map(d => d.name).join(", "))}` : ""}. Manifest a Wonder first, its effects ${fixationOf(a) === attacker.uuid ? "not Weakened (your Fixation)" : "Weakened"}.</p>
      <div class="fs-field"><label>Manifest at</label><select name="who">${pickable.map(t => `<option value="${esc(t.uuid)}">${esc(t.name)}${t.uuid === attacker.uuid ? " (attacker)" : " (defender)"}</option>`).join("")}</select></div>
      <p>${free ? "Afterimage: no RP or Energy for Reflex this time." : "Costs RP equal to the Range's AP cost, and half the Wonder's Scaling Stat min in Energy."}</p>` });
    if (ans) await runOnOwner(a, { id: "reflex", caster: a.uuid, trigger: attacker.uuid, target: ans.who || attacker.uuid });
  }
}

/* -------------------------------------------- */
/*  Impulse                                     */
/* -------------------------------------------- */

const impulseCost = actor => { const tn = tenetOf(actor); return tn ? Math.floor(ab.statMinOf(actor, R.KINDS[R.wonderById(tn.wonder).kind].stat) / 2) : null; };

impulseHook.can = actor => snapTier(actor) >= 2 && !usedThisRound(actor, "impulse") && impulseCost(actor) !== null && (actor.system.energy?.value ?? 0) >= impulseCost(actor);
/** Pay for Impulse (asked first): the Tenet may apply once more this round. */
impulseHook.use = async (actor, label = "Tenet") => {
  if (!impulseHook.can(actor)) return false;
  const cost = impulseCost(actor);
  const ans = await askFor(actor, { react: "impulse", title: "Impulse", ok: "Use Impulse", html: `<p>Your Tenet has already triggered this round. Pay <strong>⚡ ${cost}</strong> (Impulse) to apply <strong>${esc(label)}</strong> to this instance as well?</p>` });
  if (!ans || !(await mental.pay(actor, { energy: cost }, "Impulse"))) return false;
  await markRound(actor, "impulse");
  await post(actor, { title: `${esc(actor.name)} — Impulse`, body: `<div class="fs-result">${esc(label)} applies again this round.</div>` });
  return true;
};

/* -------------------------------------------- */
/*  Fixation                                    */
/* -------------------------------------------- */

/** Start of your turn: declare the character your Reflexes won't be Weakened against. */
TURN_START.push(async actor => {
  if (snapTier(actor) < 3) return;
  const others = actorsInPlay().filter(a => a.uuid !== actor.uuid && !notCreature(a));
  if (!others.length) return;
  const ans = await askFor(actor, { react: "fixation", title: "Fixation", ok: "Fixate", html: `<p>Declare a character you can sense. Reflex against their actions isn't Weakened until your next turn.</p>
    <div class="fs-field"><label>Fixate on</label><select name="who"><option value="">— No one —</option>${others.map(a => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`).join("")}</select></div>` });
  await setActorFlag(actor, "fixation", ans?.who || null);
  if (ans?.who) await post(actor, { title: `${esc(actor.name)} — Fixation`, body: `<div class="fs-result">${esc(actor.name)} fixes on ${esc(others.find(a => a.uuid === ans.who)?.name ?? "someone")}.</div>` });
});
