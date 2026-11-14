/**
 * Generic Groups (Flow State - Generic Groups): the Action List's Generic rows. Every active ability a character has (one with an Energy cost, an AP/RP
 * cost, or that takes time) gets a row that pays its cost and posts what it does; the ones that change a fight are automated here (Stealthing and Fade,
 * Glimpse, Lift, Pick, Vigilance, Cover Story, Tempo's initiative abilities, Surge, Scramble, Adrenaline Rush, Overexert, Rallying Cry, First Aid,
 * Patch Up, resisting Fear). Checks are checks.mjs; passives live where they apply (actions.mjs, data.mjs).
 */
import { post, spendPoints, spendEnergy, inActiveCombat, turnKey, setActorFlag, setStatus, requestGM, energyTracked, tokenDistance, attackerToken, rollKit } from "./actions.mjs";
import { rollCheck as checkRoll, delayTurn, initiativeRoll } from "./checks.mjs";
import { halfSP } from "./checks-rules.mjs";
import * as ab from "./abilities.mjs";
import { TREES } from "./trees.mjs";
import { parseEnergyCost, energyFor, stripEnergyCost } from "./energy.mjs";
import { codexId } from "./codex.mjs";
import { allied } from "./sides.mjs";
import { heal } from "./wonders.mjs";
import { STATS, poolFormula } from "./rules.mjs";
import { notCreature } from "./kinds.mjs";
import { esc, select } from "./html.mjs";

const tier = (actor, id) => ab.treeTier(actor, id);
const sp = actor => Number(actor.system.skillPoints) || 0;
const myTurn = actor => !inActiveCombat(actor) || game.combat?.combatant?.actor?.uuid === actor.uuid;
const combatantOf = actor => game.combat?.combatants?.find(c => c.actor?.uuid === actor.uuid) ?? null;
/** Energy for one of the doc's "Energy equal to (half of / twice) your total skill points" costs. */
const energyOf = (actor, text) => energyFor(parseEnergyCost(text), { skillPoints: sp(actor), effective: actor.system.derived?.effective ?? {} })?.value ?? 0;
async function pay(actor, { ap = 0, rp = 0, energy = 0 }, what) {
  if ((energy && energyTracked(actor) && (actor.system.energy?.value ?? 0) < energy)) { ui.notifications.warn(`${actor.name} needs ${energy} Energy for ${what}.`); return false; }
  if (ap && !(await spendPoints(actor, "ap", ap, what))) return false;
  if (rp && !(await spendPoints(actor, "rp", rp, what))) return false;
  return !energy || spendEnergy(actor, energy, what);
}
const card = (actor, title, html) => post(actor, { title: `${esc(actor.name)} — ${esc(title)}`, body: html });
const entryOf = (treeId, name) => TREES.find(t => t.id === treeId)?.tiers.flatMap(t => t.entries).find(e => e.name === name) ?? null;

/* -------------------------------------------- */
/*  The rows                                    */
/* -------------------------------------------- */

/** Abilities with their own row (an op below), or that are automatic (the Tier 3 rerolls, Alacrity, passives with a cost line). */
const AUTOMATED = new Set(["Spot", "Glimpse", "Focus", "Hyperfocus", "Vigilance", "Stealthing", "Fade", "Still Breath", "Lift", "Pick", "Alacrity", "Delaying",
  "Rebound", "Quickening", "Seize", "Surge", "Rephrase", "Double Down", "Cover Story", "Hold Firm", "Grit", "Push Through", "Scramble", "Adrenaline Rush",
  "Overexert", "Rallying Cry", "First Aid", "Patch Up", "Fear", "Face Your Fear", "Feint"]);

/** The AP or RP an entry's text says to spend ("spend 2 AP", "This takes 2 AP"); RP "equal to an attack's AP cost" isn't a number. */
const POINTS_RE = /\b(?:spend|takes?) (?:up to )?(\d+) (AP|RP)\b/i;
function pointsIn(text) {
  const m = POINTS_RE.exec(String(text ?? ""));
  return m ? { [m[2].toLowerCase()]: Number(m[1]) } : {};
}
/** An entry is something you do (not a passive): it costs Energy, AP or RP, or takes a stretch of time. */
const isActive = text => !!parseEnergyCost(text) || POINTS_RE.test(text) || /\b(?:spend|take|takes) (?:at least )?(?:\d+|a|an|one|three) (minutes?|hours?|days?)\b/i.test(text);

/** The Action List's Generic group for this character. */
export function actionRows(actor) {
  const rows = [];
  const inCombat = inActiveCombat(actor);
  const stealthing = !!actor.statuses?.has?.("stealth");
  // Stealth Tier 0 / Fade (Stealth T1).
  if (!stealthing) {
    const fade = !myTurn(actor);
    const st = tier(actor, "generic-stealth");
    rows.push({ label: fade ? "Fade" : "Start Stealthing", detail: fade ? "Begin Stealthing outside your turn" : "Moves cost +1 AP; attacks from an unspotted Stealth Value", cost: fade ? `${st >= 3 ? 1 : 2} RP` : "Free",
      action: "generic", op: "stealthOn", icon: "fa-solid fa-user-ninja", disabled: fade && st < 1, tooltip: fade && st < 1 ? "Needs Fade (Stealth T1) outside your turn" : "" });
  } else rows.push({ label: "Stop Stealthing", detail: `Spotted by ${(actor.getFlag?.("flowstate", "spottedBy") ?? []).length || "nobody"}`, cost: "Free", action: "generic", op: "stealthOff", icon: "fa-solid fa-user" });
  if (inCombat) {
    const c = combatantOf(actor);
    const before = c && game.combat.turns.findIndex(t => t.id === c.id) > game.combat.turn;
    if (before) rows.push({ label: "Delay", detail: "Lower your initiative (before your turn starts)", cost: "Free", action: "generic", op: "delay", icon: "fa-solid fa-hourglass-half" });
  }
  if (tier(actor, "generic-perception") >= 1) rows.push({ label: "Glimpse", detail: "Spot a hidden creature that alerted you this round (target it)", cost: `${tier(actor, "generic-perception") >= 3 ? 1 : 2} RP`, action: "generic", op: "glimpse", icon: "fa-solid fa-eye" });
  if (tier(actor, "generic-perception") >= 2 && actor.statuses?.has?.("surprised")) rows.push({ label: "Vigilance", detail: `Become aware: not surprised${tier(actor, "generic-perception") >= 4 ? " (Alert: and your targeted allies)" : ""}`, cost: `${sp(actor)} Energy`, action: "generic", op: "vigilance", icon: "fa-solid fa-bell" });
  if (tier(actor, "generic-sleight") >= 1) rows.push({ label: "Lift", detail: "Take a hand-sized object: Stealth against the targeted creature's Perception", cost: `${tier(actor, "generic-sleight") >= 3 ? 1 : 2} AP`, action: "generic", op: "lift", icon: "fa-solid fa-hand-sparkles" });
  if (tier(actor, "generic-infiltration") >= 1) rows.push({ label: "Pick", detail: "Open a lock or disable a trap: Stealth against the GM's target", cost: `${tier(actor, "generic-infiltration") >= 3 ? 1 : 2} AP`, action: "generic", op: "pick", icon: "fa-solid fa-unlock" });
  if (tier(actor, "generic-deception") >= 1 && !actor.getFlag?.("flowstate", "coverStory")) rows.push({ label: "Cover Story", detail: "Your next deception check has Advantage", cost: "1 minute", action: "generic", op: "coverStory", icon: "fa-solid fa-masks-theater" });
  if (inCombat && tier(actor, "generic-tempo") >= 1) rows.push({ label: "Rebound", detail: "Back to your original initiative", cost: `${halfSP(sp(actor))} Energy`, action: "generic", op: "rebound", icon: "fa-solid fa-rotate-left" });
  if (inCombat && tier(actor, "generic-tempo") >= 2) rows.push({ label: tier(actor, "generic-tempo") >= 4 ? "Quickening / Seize" : "Quickening", detail: "Reroll initiative, keep it if higher", cost: `${sp(actor)} Energy`, action: "generic", op: "quickening", icon: "fa-solid fa-forward" });
  if (inCombat && tier(actor, "generic-tempo") >= 3 && myTurn(actor)) rows.push({ label: "Surge", detail: "End of turn: carry up to 3 unspent AP to your next turn", cost: `${sp(actor)} Energy`, action: "generic", op: "surge", icon: "fa-solid fa-battery-half" });
  if (inCombat && tier(actor, "generic-mobility") >= 3 && myTurn(actor) && !actor.getFlag?.("flowstate", "scramble")) rows.push({ label: "Scramble", detail: "This turn, terrain doesn't raise your movement cost", cost: `${halfSP(sp(actor))} Energy`, action: "generic", op: "scramble", icon: "fa-solid fa-person-hiking" });
  if (inCombat && tier(actor, "generic-stamina") >= 3 && myTurn(actor) && actor.getFlag?.("flowstate", "adrenaline") !== game.combat?.id) rows.push({ label: "Adrenaline Rush", detail: `Regain ${2 * sp(actor)} Energy (once per combat)`, cost: "Free", action: "generic", op: "adrenaline", icon: "fa-solid fa-bolt-lightning" });
  if (inCombat && tier(actor, "generic-stamina") >= 5 && myTurn(actor) && !actor.getFlag?.("flowstate", "overexertUsed")) rows.push({ label: "Overexert", detail: "This turn, Energy can go down to minus its maximum (once per rest)", cost: "Free", action: "generic", op: "overexert", icon: "fa-solid fa-fire-flame-curved" });
  if (inCombat && tier(actor, "generic-diversion") >= 2) rows.push({ label: "Feint", detail: "Deception against the targeted creature's counter check: its next dodge has Disadvantage (once per turn)", cost: `${halfSP(sp(actor))} Energy`, action: "generic", op: "feint", icon: "fa-solid fa-person-walking-arrow-loop-left" });
  if (inCombat && tier(actor, "generic-command") >= 2) rows.push({ label: "Rallying Cry", detail: "Allies within 100 ft end their Fear (once per round)", cost: `2 AP · ${halfSP(sp(actor))} Energy`, action: "generic", op: "rallyingCry", icon: "fa-solid fa-bullhorn" });
  if (tier(actor, "generic-recovery") >= 1 && !inCombat) rows.push({ label: "First Aid", detail: "Tend yourself or the targeted creature (10 minutes; once between rests)", cost: "10 minutes", action: "generic", op: "firstAid", icon: "fa-solid fa-kit-medical" });
  if (inCombat && tier(actor, "generic-recovery") >= 3) rows.push({ label: "Patch Up", detail: "Heal a creature in melee range (health lost since the start of your last turn)", cost: `3 AP · ${sp(actor)} Energy`, action: "generic", op: "patchUp", icon: "fa-solid fa-bandage" });
  if (actor.statuses?.has?.("fear")) rows.push({ label: "Resist Fear", detail: "Constitution, Willpower or Build against the source's Skill Points × Size", cost: "Check", action: "generic", op: "resistFear", icon: "fa-solid fa-person-rays" });
  // Every other active ability: pay its cost, post what it does.
  for (const tree of TREES) {
    if (tree.archetype !== "generic") continue;
    const have = tier(actor, tree.id);
    for (const t of tree.tiers) {
      if (t.tier > have || (t.tier === 0 && !tree.core)) continue;
      for (const e of t.entries) {
        if (!e.name || AUTOMATED.has(e.name) || !isActive(e.text)) continue;
        const pts = pointsIn(e.text), energy = energyOf(actor, e.text);
        const cost = [pts.ap ? `${pts.ap} AP` : "", pts.rp ? `${pts.rp} RP` : "", energy ? `${energy} Energy` : ""].filter(Boolean).join(" · ") || "Time";
        rows.push({ label: e.name, detail: tree.name, cost, action: "generic", op: `use:${tree.id}:${e.name}`, icon: "fa-solid fa-circle-play", codex: codexId.entry(tree.id, e.name) });
      }
    }
  }
  return rows;
}

/* -------------------------------------------- */
/*  Running them                                */
/* -------------------------------------------- */

export async function run(actor, op) {
  if (!actor || !op) return;
  if (op.startsWith("use:")) {
    const [, treeId, ...rest] = op.split(":");
    return useEntry(actor, treeId, rest.join(":"));
  }
  const fn = OPS[op];
  return fn ? fn(actor) : null;
}

/** An ability with no automation of its own: pay what it costs, and post what it does. */
async function useEntry(actor, treeId, name) {
  const e = entryOf(treeId, name);
  if (!e) return;
  const pts = pointsIn(e.text), energy = energyOf(actor, e.text);
  if (!(await pay(actor, { ap: pts.ap ?? 0, rp: pts.rp ?? 0, energy }, name))) return;
  const paid = [pts.ap ? `${pts.ap} AP` : "", pts.rp ? `${pts.rp} RP` : "", energy && energyTracked(actor) ? `${energy} Energy` : ""].filter(Boolean).join(", ");
  return card(actor, name, `<div class="fs-result">${esc(stripEnergyCost(e.text))}</div>${(e.sub ?? []).map(s => `<div class="fs-notes">${esc(s)}</div>`).join("")}
    <div class="fs-notes">${paid ? `Paid ${paid}. ` : ""}What it does is up to the table (the GM applies it).</div>`);
}

const OPS = {
  delay: actor => delayTurn(actor),

  /** Stealthing (Stealth Tier 0) on your turn; Fade (Stealth T1) outside it for 2 RP (Practiced, T3: 1 RP). */
  async stealthOn(actor) {
    if (!myTurn(actor)) {
      const st = tier(actor, "generic-stealth");
      if (st < 1) return ui.notifications.warn(`${actor.name} can only begin Stealthing on their own turn (Fade, Stealth T1, lets them do it outside it).`);
      if (!(await spendPoints(actor, "rp", st >= 3 ? 1 : 2, "Fade"))) return;
    }
    await setActorFlag(actor, "spottedBy", []);
    await setStatus(actor, "stealth", true);
    const hush = tier(actor, "generic-stealth") >= 4 && !myTurn(actor);
    return card(actor, myTurn(actor) ? "Stealthing" : "Fade", `<div class="fs-result">${esc(actor.name)} begins Stealthing: moves cost +1 AP${tier(actor, "generic-infiltration") >= 4 ? " (not with Ghost Step)" : ""}, sounds are soft, and they're lightly obscured except in good light. Creatures that haven't spotted them face their Stealth Value.</div>${hush ? `<div class="fs-notes">Hush: allies within 100 ft who can sense ${esc(actor.name)} may each spend 1 RP to begin Stealthing too.</div>` : ""}`);
  },
  async stealthOff(actor) {
    await setStatus(actor, "stealth", false);
    await setActorFlag(actor, "spottedBy", []);
    return card(actor, "Stealthing", `<div class="fs-result">${esc(actor.name)} stops Stealthing.</div>`);
  },

  /** Glimpse (Perception T1): a Spot for 2 RP (Keen, T3: 1 RP) on a hidden creature that alerted you this round. */
  glimpse: actor => checkRoll(actor, "perception", { label: "Glimpse", rpCost: tier(actor, "generic-perception") >= 3 ? 1 : 2, glimpse: true,
    notes: [tier(actor, "generic-perception") >= 5 ? "Resolute: any number of times once they alert you" : "Once per alert from that creature"] }),
  /** Lift (Sleight T1): Stealth against the target's Perception, 2 AP (Deft, T3: 1 AP); no need to be Stealthing. */
  lift: actor => checkRoll(actor, "stealth", { label: "Lift", apCost: tier(actor, "generic-sleight") >= 3 ? 1 : 2,
    notes: [tier(actor, "generic-sleight") >= 2 ? "Plant: you may place or swap an object instead" : "", "Other observers who could see it roll Perception against this too"].filter(Boolean) }),
  /** Pick (Infiltration T1): Stealth against the GM's static target, 2 AP (Soft Touch, T3: 1 AP, and no noise on a failure). */
  pick: actor => checkRoll(actor, "stealth", { label: "Pick", apCost: tier(actor, "generic-infiltration") >= 3 ? 1 : 2,
    notes: [tier(actor, "generic-infiltration") >= 3 ? "Soft Touch: a failure makes no noise" : "A failure makes a medium noise"] }),

  /** Feint (Diversion T2): once per turn, a deception check against the target's counter check; won, its next dodge roll has Disadvantage. */
  async feint(actor) {
    const key = turnKey();
    if (key && actor.getFlag?.("flowstate", "feintTurn") === key) return ui.notifications.warn(`${actor.name} has already Feinted this turn.`);
    if (!(await pay(actor, { energy: halfSP(sp(actor)) }, "Feint"))) return;
    if (key) await setActorFlag(actor, "feintTurn", key);
    return checkRoll(actor, "deception", { label: "Feint", effect: "feint" });
  },

  /** Vigilance (Perception T2): not surprised after all; Alert (T4) does the same for your targeted creatures. */
  async vigilance(actor) {
    if (!(await pay(actor, { energy: sp(actor) }, "Vigilance"))) return;
    await setStatus(actor, "surprised", false);
    if (inActiveCombat(actor)) await actor.update({ "system.rp.value": actor.system.rp?.max ?? 6 });
    const others = tier(actor, "generic-perception") >= 4 ? [...(game.user.targets ?? [])].map(t => t.actor).filter(a => a && a.uuid !== actor.uuid && a.statuses?.has?.("surprised")) : [];
    for (const a of others) {
      await setStatus(a, "surprised", false);
      if (inActiveCombat(a)) { if (a.isOwner) await a.update({ "system.rp.value": a.system.rp?.max ?? 6 }); else await requestGM("updateActor", { uuid: a.uuid, data: { "system.rp.value": a.system.rp?.max ?? 6 } }); }
    }
    return card(actor, "Vigilance", `<div class="fs-result">${esc(actor.name)} is aware: not surprised${others.length ? `, and alerts ${others.map(a => esc(a.name)).join(", ")}` : ""}.</div>`);
  },

  async coverStory(actor) {
    await setActorFlag(actor, "coverStory", true);
    return card(actor, "Cover Story", `<div class="fs-result">${esc(actor.name)} prepares a lie (1 minute): their next deception check has Advantage.</div>`);
  },

  /** Rebound (Tempo T1): back to the original initiative check. */
  async rebound(actor) {
    const c = combatantOf(actor);
    const orig = Number(c?.getFlag?.("flowstate", "origInit"));
    if (!c || !Number.isFinite(orig)) return ui.notifications.warn(`${actor.name} has no initiative check to go back to.`);
    if (!(Number(c.initiative) < orig)) return ui.notifications.info(`${actor.name}'s initiative isn't below their original check (${orig}).`);
    if (!(await pay(actor, { energy: halfSP(sp(actor)) }, "Rebound"))) return;
    await c.update({ initiative: orig });
    return card(actor, "Rebound", `<div class="fs-result">${esc(actor.name)}'s initiative returns to <strong>${orig}</strong>.</div>`);
  },
  /** Quickening (Tempo T2): reroll initiative, keeping it if higher. Seize (T4): twice the cost, one higher than a creature of your choice. */
  async quickening(actor) {
    const c = combatantOf(actor);
    if (!c) return;
    let seize = null;
    if (tier(actor, "generic-tempo") >= 4) {
      const others = game.combat.combatants.filter(x => x.id !== c.id && x.initiative != null);
      const vals = await rollKit.optionsDialog(`${actor.name}: Quickening`, `<div class="form-group"><label>How</label>${select("how", [["roll", `Quickening: reroll (${sp(actor)} Energy)`], ...others.map(x => [x.id, `Seize: one higher than ${x.name} (${x.initiative}) (${2 * sp(actor)} Energy)`])], "roll")}</div>`, "Go");
      if (!vals) return;
      seize = vals.how && vals.how !== "roll" ? game.combat.combatants.get(vals.how) : null;
    }
    if (!(await pay(actor, { energy: seize ? 2 * sp(actor) : sp(actor) }, seize ? "Seize" : "Quickening"))) return;
    if (seize) {
      await c.update({ initiative: Number(seize.initiative) + 1 });
      return card(actor, "Seize", `<div class="fs-result">${esc(actor.name)}'s initiative becomes <strong>${Number(seize.initiative) + 1}</strong>, one higher than ${esc(seize.name)}.</div>`);
    }
    const roll = await initiativeRoll(c).evaluate();
    const now = Number(c.initiative) || 0;
    if (roll.total > now) await c.update({ initiative: roll.total });
    return post(actor, { title: `${esc(actor.name)} — Quickening`, rolls: [roll], body: `<div class="fs-result">Rerolled initiative: <strong>${roll.total}</strong>${roll.total > now ? ` (up from ${now}, for the rest of combat)` : ` (not higher than ${now}: it stays)`}.</div>` });
  },
  /** Surge (Tempo T3): carry up to 3 unspent AP into your next turn (not two turns in a row). */
  async surge(actor) {
    const last = actor.getFlag?.("flowstate", "surgeRound");
    if (last != null && last === (game.combat?.round ?? 0) - 1) return ui.notifications.warn(`${actor.name} used Surge last turn.`);
    const ap = Math.min(3, actor.system.ap?.value ?? 0);
    if (!ap) return ui.notifications.info(`${actor.name} has no AP left to carry.`);
    if (!(await pay(actor, { energy: sp(actor) }, "Surge"))) return;
    await setActorFlag(actor, "surge", ap);
    await setActorFlag(actor, "surgeRound", game.combat?.round ?? 0);
    await actor.update({ "system.ap.value": (actor.system.ap?.value ?? 0) - ap });
    return card(actor, "Surge", `<div class="fs-result">${esc(actor.name)} carries <strong>${ap} AP</strong> into their next turn.</div>`);
  },
  async scramble(actor) {
    if (!(await pay(actor, { energy: halfSP(sp(actor)) }, "Scramble"))) return;
    await setActorFlag(actor, "scramble", true);
    return card(actor, "Scramble", `<div class="fs-result">Until the end of ${esc(actor.name)}'s turn, terrain doesn't raise their movement cost.</div>`);
  },
  async adrenaline(actor) {
    const e = actor.system.energy, gain = Math.min(e.max - e.value, 2 * sp(actor));
    await setActorFlag(actor, "adrenaline", game.combat?.id ?? true);
    await actor.update({ "system.energy.value": e.value + gain });
    return card(actor, "Adrenaline Rush", `<div class="fs-result">${esc(actor.name)} regains <strong>${gain}</strong> Energy (once per combat).</div>`);
  },
  async overexert(actor) {
    await setActorFlag(actor, "overexert", turnKey());
    await setActorFlag(actor, "overexertUsed", true);
    return card(actor, "Overexert", `<div class="fs-result">Until the end of this turn ${esc(actor.name)} can use abilities without the Energy for them, down to −${actor.system.energy.max}. When the turn ends they lose a fifth of the negative Energy as health, and Energy returns to 0 (once per rest).</div>`);
  },

  /** Rallying Cry (Command T2): allies within 100 ft who can hear you end their Fear (and have Advantage to resist it until your next turn). */
  async rallyingCry(actor) {
    const key = `${game.combat?.id}:${game.combat?.round}`;
    if (actor.getFlag?.("flowstate", "rallyRound") === key) return ui.notifications.warn(`${actor.name} has already used Rallying Cry this round.`);
    if (!(await pay(actor, { ap: 2, energy: halfSP(sp(actor)) }, "Rallying Cry"))) return;
    await setActorFlag(actor, "rallyRound", key);
    const me = attackerToken(actor);
    const freed = [];
    for (const t of globalThis.canvas?.tokens?.placeables ?? []) {
      const a = t.actor;
      if (!a || a.uuid === actor.uuid || notCreature(a) || !allied(actor, a) || !a.statuses?.has?.("fear")) continue;
      if (me && tokenDistance(me, t) > 100) continue;
      await setStatus(a, "fear", false);
      freed.push(a.name);
    }
    return card(actor, "Rallying Cry", `<div class="fs-result">${freed.length ? `${freed.map(esc).join(", ")} ${freed.length === 1 ? "shakes" : "shake"} off their Fear` : "No ally within 100 ft was afraid"}. Until the start of ${esc(actor.name)}'s next turn, allies who heard it have Advantage on checks to resist Fear.</div>`);
  },

  /** First Aid (Recovery T1): half of an 8 hour rest's healing, once per creature between rests. */
  async firstAid(actor) {
    const target = [...(game.user.targets ?? [])].map(t => t.actor).find(a => a && !notCreature(a)) ?? actor;
    if (target.getFlag?.("flowstate", "firstAided")) return ui.notifications.warn(`${target.name} has had First Aid since their last rest.`);
    const n = Math.floor((target.system.derived?.restHeal ?? 0) / 2);
    const hp = target.system.hp.value, next = Math.min(target.system.hp.max, hp + n);
    const data = { "system.hp.value": next, "flags.flowstate.firstAided": true };
    if (target.isOwner) await target.update(data); else await requestGM("updateActor", { uuid: target.uuid, data });
    return card(actor, "First Aid", `<div class="fs-result">${esc(actor.name)} tends ${target === actor ? "themself" : esc(target.name)} for 10 minutes: <strong>+${next - hp}</strong> health (${next}/${target.system.hp.max}).</div>`);
  },
  /** Patch Up (Recovery T3): a quarter of an 8 hour rest's healing, only health lost since the start of your last turn. */
  async patchUp(actor) {
    const target = [...(game.user.targets ?? [])].map(t => t.actor).find(a => a && !notCreature(a)) ?? actor;
    const me = attackerToken(actor), them = target.getActiveTokens?.()[0];
    if (target !== actor && me && them && tokenDistance(me, them) > (actor.system.derived?.size?.melee ?? 5)) return ui.notifications.warn(`${target.name} isn't in melee range.`);
    if (!(await pay(actor, { ap: 3, energy: sp(actor) }, "Patch Up"))) return;
    const n = Math.floor((target.system.derived?.restHeal ?? 0) / 4);
    return card(actor, "Patch Up", `<div class="fs-result">${await heal(target, actor, n)}</div>`);
  },

  /** Resisting Fear (Resolve Tier 0): Constitution, Willpower or Build against the source's Skill Points × its Size. */
  resistFear: actor => resistFear(actor)
};

/**
 * Resist Fear (Resolve Tier 0): a Constitution, Willpower or Build check at least the fear source's Skill Points × Size (the GM's number when it isn't a
 * creature). Brave (Courage T1) has Advantage; Iron Will (Resolve T2) keeps the result from going under a third of your Skill Points (two thirds with
 * Unbreakable, T5); Face Your Fear (Courage T3) rerolls a failure against half the number, for half your Skill Points in Energy.
 */
export async function resistFear(actor, { need = null } = {}) {
  const eff = actor.system.derived.effective;
  const best = ["con", "will", "build"].sort((a, b) => eff[b].value - eff[a].value)[0];
  const vals = await rollKit.optionsDialog(`${actor.name}: Resist Fear`, `${rollKit.netField()}
    <div class="form-group"><label>Stat</label>${select("stat", ["con", "will", "build"].map(k => [k, `${STATS[k].label} (d${eff[k].die})`]), best)}</div>
    <div class="form-group"><label>Needed (the source's Skill Points × its Size)</label><input type="number" name="need" value="${need ?? 0}" min="0" step="1"></div>`, "Roll");
  if (!vals) return null;
  const stat = vals.stat || best, die = eff[stat].die, target = Math.max(0, Number(vals.need) || 0);
  const brave = tier(actor, "generic-courage") >= 1 ? 1 : 0;
  const net = (vals.net ?? 0) + brave + rollKit.net(actor, "stat");
  const floor = tier(actor, "generic-resolve") >= 5 ? Math.floor(2 * sp(actor) / 3) : tier(actor, "generic-resolve") >= 2 ? Math.floor(sp(actor) / 3) : 0;
  const roll = await rollKit.evaluate(poolFormula(1, die, rollKit.noAdvantage(actor, net)));
  const rolls = [roll];
  let result = Math.max(roll.total, floor), need2 = target;
  const lines = [];
  if (floor > roll.total) lines.push(`${tier(actor, "generic-resolve") >= 5 ? "Unbreakable" : "Iron Will"}: no lower than ${floor}`);
  if (target && result < target && tier(actor, "generic-courage") >= 3) {
    const cost = halfSP(sp(actor));
    if ((await rollKit.optionsDialog(`Face Your Fear?`, `<p>${esc(actor.name)} rolled ${result} against ${target}. Reroll against ${Math.floor(target / 2)} for ${cost} Energy?</p>`, "Reroll")) && (await spendEnergy(actor, cost, "Face Your Fear"))) {
      const r = await rollKit.evaluate(poolFormula(1, die, rollKit.noAdvantage(actor, net)));
      rolls.push(r);
      result = Math.max(r.total, floor);
      need2 = Math.floor(target / 2);
      lines.push(`Face Your Fear: rerolled → ${r.total}, against ${need2}`);
    }
  }
  const ok = target ? result >= need2 : null;
  if (ok && actor.statuses?.has?.("fear")) await setStatus(actor, "fear", false);
  await post(actor, { title: `${esc(actor.name)} — Resist Fear (${STATS[stat].label} d${die})`, rolls,
    body: `${await rollKit.rollBlock(roll, "Roll")}<div class="fs-result">Result: <strong>${result}</strong>${target ? ` against ${target}` : ""}</div>
      ${ok === null ? "" : `<div class="fs-outcome fs-${ok ? "hit" : "miss"}">${ok ? "Resisted: no longer afraid" : "Afraid (no Energy from any source)"}</div>`}
      <div class="fs-notes">${[rollKit.netLabel(net), brave ? "Brave: Advantage" : "", ...lines].filter(Boolean).join(" · ")}</div>` });
  return ok;
}

/** Start of your turn: Surge's carried AP. End of your turn: Scramble ends. */
export async function turnStart(actor) {
  const carry = Number(actor.getFlag?.("flowstate", "surge")) || 0;
  if (!carry) return;
  await setActorFlag(actor, "surge", 0);
  await actor.update({ "system.ap.value": (actor.system.ap?.value ?? 0) + carry });
  await card(actor, "Surge", `<div class="fs-result">${esc(actor.name)} has <strong>${carry} AP</strong> more this turn (carried by Surge).</div>`);
}
export async function turnEnd(actor) {
  if (actor.getFlag?.("flowstate", "scramble")) await setActorFlag(actor, "scramble", false);
}

/** A creature that stops Stealthing (any way, the token HUD included) is no longer spotted by anyone. Rests clear First Aid and Overexert. */
export function registerGenericHooks() {
  Hooks.on("deleteActiveEffect", effect => {
    const a = effect.parent;
    if (a instanceof Actor && effect.statuses?.has?.("stealth") && a.isOwner && (a.getFlag("flowstate", "spottedBy") ?? []).length) a.setFlag("flowstate", "spottedBy", []);
  });
}
