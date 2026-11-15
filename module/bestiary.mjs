/**
 * The Bestiary's creatures in play (Flow State - Bestiary): Wonderborn (Omens and Heralds of a Wonder), their lineages (Dreamborn, Nightmareborn) and
 * their own trees (Life, Dark, Growth). The pure part (builds, Wonders, poles served, natural attacks) is bestiary-rules.mjs.
 *  - Action List rows (`actionRows`/`run`, through ancestry.mjs): natural attacks (Budding Gore, Black Jaws, Root Lash), Recognition, Allure/Dread for
 *    newcomers, Sustain, Portent, and releasing spores / blooming out of combat.
 *  - Exchange (ancestry.mjs's hooks call these): Prey on Fear, Pack Hunter and Allure's Disadvantage (`attackNet`); Budding Gore's Infection and Drag
 *    Into the Dark's grapple (`onHit`); Pole-Bound, Bounty and Portent on an attack's start (`attackStart`, from esoteric.mjs); Rooted (`forceHalf`).
 *  - The combat (GM): Allure/Dread as round 1 starts, Regrowth and the Choking Green at the start of a turn, Sporing / Ripen and Seed at the end of
 *    the 4th turn (then Dormant), Unwaking/Unrelenting (`holdingOn`), Deathless (`deathless`), the ground auras (Choking Green, Overgrowth).
 * Uses: flag `bestUse` (name → the round/turn/combat key). Darkness (Drag Into the Dark) is read from the scene's lighting.
 */
import { post, spendPoints, inActiveCombat, turnKey, setActorFlag, tokenDistance, attackerToken, performAttack, setStatus,
  moveLedger, setGrapple, applyDamage, rollKit } from "./actions.mjs";
import { runOnOwner } from "./ask.mjs";
import { ACTS } from "./wonders.mjs";
import { opposed } from "./sides.mjs";
import { notCreature } from "./kinds.mjs";
import { resistFear } from "./generic.mjs";
import { terrainRegionData } from "./terrain.mjs";
import { poolFormula } from "./rules.mjs";
import { wonderById } from "./mental-rules.mjs";
import * as B from "./bestiary-rules.mjs";
import { ANCESTRIES } from "./abc-rules.mjs";
import { esc, DialogV2 } from "./html.mjs";

const T = a => B.tiers(a);
const card = (actor, title, html) => post(actor, { title: `${esc(actor.name)} — ${esc(title)}`, body: html });
const roundKey = () => (game.combat?.started ? `${game.combat.id}:${game.combat.round}` : null);
const combatKey = () => (game.combat?.started ? game.combat.id : null);
const scopeKey = scope => (scope === "turn" ? turnKey() : scope === "round" ? roundKey() : scope === "combat" ? combatKey() : null);
const used = (actor, name, scope) => { const k = scopeKey(scope); return !!k && actor?.getFlag?.("flowstate", "bestUse")?.[name] === k; };
const use = async (actor, name, scope) => { const k = scopeKey(scope); if (k) await setActorFlag(actor, "bestUse", { [name]: k }); };
const tokenOf = actor => attackerToken(actor) ?? actor?.getActiveTokens?.()[0] ?? null;
const dist = (a, b) => { const x = tokenOf(a), y = tokenOf(b); return x && y && globalThis.canvas?.grid ? tokenDistance(x, y) : null; };
const targetsOf = () => [...(game.user?.targets ?? [])].map(t => t.actor).filter(a => a && !notCreature(a));
const sceneCreatures = () => [...(globalThis.canvas?.scene?.tokens ?? [])].map(t => t.actor).filter(a => a && !notCreature(a));
const wonderName = id => wonderById(id)?.name ?? "its Wonder";
const ancOf = a => ANCESTRIES[a?.system?.abc?.ancestry] ?? null;
const isWonderborn = a => !!B.wonderOf(a);

/* -------------------------------------------- */
/*  Action List                                 */
/* -------------------------------------------- */

/** The Bestiary abilities that have a row or a hook here (ancestry.mjs's pay-and-post rows leave these out). */
export const AUTOMATED = new Set(["Pole-Bound", "Recognition", "Follow the Pole", "Sustain", "Portent", "Allure", "Dread", "Lucid Depth", "Nightmare Depth",
  "Bounty", "Prey on Fear", "Unwaking", "Unrelenting", "Rapture", "Terror", "Budding Gore", "Regrowth", "Sporing", "Deathless", "The Choking Green",
  "Black Jaws", "Pack Hunter", "Drag Into the Dark", "Root Lash", "Ripen", "Seed", "Rooted", "Overgrowth"]);

export function actionRows(actor) {
  const rows = [], t = T(actor), inCombat = inActiveCombat(actor);
  const row = (label, detail, cost, op, icon, extra = {}) => rows.push({ label, detail, cost, action: "ancestry", op: `best:${op}`, icon, ...extra });
  const power = B.powerOf(actor);
  for (const n of B.naturalAttacks(actor.system?.trees)) {
    row(n.name, `${n.range ? `Within ${n.range} ft` : "Melee"}: ${B.naturalFormula(n, power)} ${n.type} damage, a natural attack${n.scales ? ` (×${power} Wonder Power)` : ""}${n.name === "Budding Gore" ? "; Infects for a day" : ""}`,
      `${n.ap} AP`, `nat:${n.tree}:${n.name}`, "fa-solid fa-paw");
  }
  if (!isWonderborn(actor)) return rows;
  const w = B.wonderOf(actor);
  if (t.wonderborn >= 1) row("Recognition", `Whether the targeted creatures serve ${wonderName(w)}, oppose it, or neither`, "—", "recognize", "fa-solid fa-eye");
  if (t.dream >= 1 || t.nightmare >= 1) row(t.dream >= 1 ? "Allure: newcomers resist" : "Dread: newcomers resist", `The targeted creatures (or every opposed one here that hasn't yet) resist it as Fear: ${B.presenceNeed(actor)} needed${(t.dream >= 5 || t.nightmare >= 5) ? ", with Disadvantage" : ""}. Done for everyone as a fight starts`, "—", "presence", "fa-solid fa-ghost");
  if (t.wonderborn >= 4) row("Sustain", `1 hour feeding on ${esc(ancOf(actor)?.profile?.find(p => /feeds on/i.test(p.name))?.text?.replace(/\.$/, "").toLowerCase() ?? "its surroundings")}: all HP back`, "1 hour", "sustain", "fa-solid fa-utensils", { disabled: inCombat });
  if (t.wonderborn >= 5) {
    const p = actor.getFlag?.("flowstate", "portent");
    row(p?.scene === globalThis.canvas?.scene?.id ? "Portent: move it here" : "Portent: this area", `After a day here (about 1,000 ft across), Manifests of ${wonderName(w)} are Strengthened and of ${wonderName(B.pairOf(w))} Weakened within it`, "1 day", "portent", "fa-solid fa-cloud-moon");
  }
  if (!inCombat && (t.life >= 3 || t.growth >= 2)) row(t.life >= 3 ? "Release spores (after 1 hour)" : "Bloom (after 1 hour)", t.life >= 3 ? "Every breathing creature within 100 ft is Infected; then it collapses, dormant for a day" : `It blooms${t.growth >= 3 ? ": seed scatters within 100 ft, and it wilts dormant for a day" : ""}`, "1 hour", "bloom", "fa-solid fa-spa");
  return rows;
}

export async function run(actor, op) {
  if (op.startsWith("nat:")) { const [tree, ...name] = op.slice(4).split(":"); return natural(actor, tree, name.join(":")); }
  const f = OPS[op];
  return f ? f(actor) : null;
}

const OPS = {
  async recognize(actor) {
    const w = B.wonderOf(actor), list = targetsOf().filter(a => a.uuid !== actor.uuid);
    if (!list.length) return ui.notifications.warn("Target the creatures to recognize.");
    const lines = list.map(a => `<li><strong>${esc(a.name)}</strong>: ${B.serves(a, w) ? `serves ${esc(wonderName(w))}` : B.opposes(a, w) ? `opposes it (serves ${esc(wonderName(B.pairOf(w)))})` : "neither (or the GM knows better)"}</li>`);
    return card(actor, "Recognition", `<ul class="fs-list">${lines.join("")}</ul><div class="fs-notes">It doesn't attack a creature that serves its pole unless that creature harms it first.</div>`);
  },
  async presence(actor) {
    const picked = targetsOf().filter(a => a.uuid !== actor.uuid);
    const seen = new Set(actor.getFlag?.("flowstate", "presenceSeen") ?? []);
    const list = picked.length ? picked : sceneCreatures().filter(a => opposed(actor, a) && !seen.has(a.uuid) && !isWonderborn(a));
    if (!list.length) return ui.notifications.info("Nobody new to resist it.");
    return presence(actor, list);
  },
  async sustain(actor) {
    if (inActiveCombat(actor)) return ui.notifications.warn("Sustain takes an hour: not in a fight.");
    await actor.update({ "system.hp.value": actor.system.hp.max });
    return card(actor, "Sustain", `<div class="fs-result">An hour of feeding: ${esc(actor.name)} is back to ${actor.system.hp.max} HP.</div>`);
  },
  async portent(actor) {
    const tok = tokenOf(actor), scene = globalThis.canvas?.scene;
    if (!tok || !scene) return ui.notifications.warn("Portent needs the creature's token on a scene.");
    const c = tok.center ?? { x: tok.document.x, y: tok.document.y };
    await setActorFlag(actor, "portent", { scene: scene.id, x: c.x, y: c.y });
    const w = B.wonderOf(actor);
    return card(actor, "Portent", `<div class="fs-result">The area around ${esc(actor.name)} takes on ${esc(wonderName(w))}'s portents (about 1,000 ft across, after a day here): Manifests of ${esc(wonderName(w))} are Strengthened within it, and of ${esc(wonderName(B.pairOf(w)))} Weakened.</div>`);
  },
  bloom: actor => bloom(actor)
};

/** A natural attack from a Bestiary tree: Budding Gore, Black Jaws, Root Lash. */
async function natural(actor, tree, name) {
  const n = B.naturalAttacks(actor.system?.trees).find(x => x.tree === tree && x.name === name);
  if (!n) return null;
  const targets = targetsOf().filter(a => a.uuid !== actor.uuid);
  if (!targets.length) return ui.notifications.warn(`Target who ${actor.name} attacks.`);
  const reach = n.range ?? (actor.system.derived?.size?.melee ?? 5);
  const far = targets.find(t => (dist(actor, t) ?? 0) > reach);
  if (far) return ui.notifications.warn(`${far.name} is beyond ${n.name}'s ${reach} ft.`);
  if (!(await spendPoints(actor, "ap", n.ap, n.name))) return null;
  const power = B.powerOf(actor);
  return performAttack(actor, { label: n.name, net: 0, melee: true, push: false, damage: B.naturalFormula(n, power), type: n.type, stacks: 0, physical: n.type === "physical",
    natural: true, shots: 1, ap: 0, apCost: n.ap, notes: [`A natural attack${n.scales ? ` (Wonder Power ×${power})` : ""}`], followups: [], turnKey: turnKey(), targetActors: targets,
    bestiary: { attack: n.name, tree: n.tree } });
}

/* -------------------------------------------- */
/*  Allure and Dread                            */
/* -------------------------------------------- */

/** Creatures that first see it resist Allure (Dreamborn) or Dread (Nightmareborn) as Fear: each one's player rolls; a failure applies it. */
async function presence(actor, list) {
  const t = T(actor), allure = t.dream >= 1, kind = allure ? "allure" : "dread";
  if (!allure && t.nightmare < 1) return null;
  const need = B.presenceNeed(actor), net = (allure ? t.dream : t.nightmare) >= 5 ? -1 : 0;
  const seen = new Set(actor.getFlag?.("flowstate", "presenceSeen") ?? []);
  for (const a of list) {
    seen.add(a.uuid);
    await runOnOwner(a, { id: "bestiaryPresence", caster: a.uuid, target: actor.uuid, need, net, kind, by: actor.uuid, label: allure ? "Allure" : "Dread" });
  }
  await setActorFlag(actor, "presenceSeen", [...seen]);
  return card(actor, allure ? "Allure" : "Dread", `<div class="fs-result">${list.map(a => esc(a.name)).join(", ")} must resist ${allure ? "its Allure" : "its Dread"} as they would Fear: <strong>${need}</strong> needed (its Skill Points × its Size)${net ? ", with Disadvantage (" + (allure ? "Rapture" : "Terror") + ")" : ""}.</div>`);
}
/** On the resisting creature's client: roll to resist; a failure is Fear (Dread) or Allure's Disadvantage (its first attack against the creature each turn). */
ACTS.bestiaryPresence = async (x, self) => {
  const ok = await resistFear(self, { need: x.need, net: x.net ?? 0, source: x.label });
  if (ok !== false) return true;
  if (x.kind === "dread") await setStatus(self, "fear", true);
  else await setActorFlag(self, "allured", { by: x.by, armed: turnKey() ?? "out", used: null });
  return true;
};

/* -------------------------------------------- */
/*  Exchange hooks                              */
/* -------------------------------------------- */

/** Advantage on an attack against one target: Prey on Fear, Pack Hunter (Black Jaws), and Allure's Disadvantage. Also keeps who attacked whom (Pack Hunter). */
export async function attackNet(attacker, target, opts) {
  let net = 0;
  const notes = [];
  if (!attacker || !target) return { net, notes };
  if (T(attacker).nightmare >= 3 && target.statuses?.has?.("fear")) { net += 1; notes.push("Prey on Fear: Advantage"); }
  if (opts?.bestiary?.attack === "Black Jaws" && T(attacker).dark >= 4 && packMates(attacker, target)) { net += 1; notes.push("Pack Hunter: Advantage"); }
  const al = attacker.getFlag?.("flowstate", "allured");
  if (al?.by === target.uuid && al.used !== turnKey()) { net -= 1; notes.push(`Allure (${target.name}): Disadvantage`); await setActorFlag(attacker, "allured", { ...al, used: turnKey() }); }
  if (B.polesServed(attacker).size && inActiveCombat(attacker)) {
    const log = (attacker.getFlag?.("flowstate", "lastAttacks") ?? []).filter(e => Date.now() - (e.at ?? 0) < 10 * 60 * 1000).slice(-9);
    await setActorFlag(attacker, "lastAttacks", [...log, { target: target.uuid, at: Date.now() }]);
  }
  return { net, notes };
}
/** Pack Hunter: another Gloamhound, or a creature serving Dark, attacked this creature since the start of the hound's last turn. */
function packMates(hound, target) {
  const since = Number(hound.getFlag?.("flowstate", "prevTurnStartedAt")) || Number(hound.getFlag?.("flowstate", "turnStartedAt")) || 0;
  const w = B.wonderOf(hound);
  return sceneCreatures().some(a => a.uuid !== hound.uuid && (a.system?.abc?.ancestry === hound.system?.abc?.ancestry || B.serves(a, w))
    && (a.getFlag?.("flowstate", "lastAttacks") ?? []).some(e => e.target === target.uuid && (e.at ?? 0) >= since));
}

/** A hit landed: Budding Gore Infects; a Black Jaws crit on a creature in darkness drags it down (grappled). */
export async function onHit({ attacker, target, result, o }) {
  const b = o?.bestiary;
  if (!b || !attacker || !target) return;
  if (b.attack === "Budding Gore" && !target.statuses?.has?.("infected")) {
    await setStatus(target, "infected", true);
    await card(target, "Infected", `<div class="fs-result">${esc(attacker.name)}'s gore buds in ${esc(target.name)}: Infected for a day. Any heat damage burns it out.</div>`);
  }
  if (b.attack === "Black Jaws" && result?.crit && T(attacker).dark >= 5) {
    const dark = inDarkness(tokenOf(target));
    if (dark) {
      await setGrapple(target, attacker.uuid);
      await card(attacker, "Drag Into the Dark", `<div class="fs-result">${esc(attacker.name)} drags ${esc(target.name)} into the dark: grappled until it breaks free with a counter grapple check of <strong>3 or higher</strong>.</div>`);
    } else await card(attacker, "Drag Into the Dark", `<div class="fs-notes">A crit, but ${esc(target.name)} isn't standing in darkness (the scene's lighting), so it isn't dragged down.</div>`);
  }
}

/**
 * Darkness at a token's spot, from the scene's lighting: not inside any light source, and the scene dark enough that its global light is off (or,
 * without global light, a darkness level of at least half).
 */
export function inDarkness(token) {
  const cv = globalThis.canvas;
  if (!token || !cv?.scene) return false;
  const c = token.center ?? { x: token.document?.x ?? token.x, y: token.document?.y ?? token.y };
  const elevation = token.document?.elevation ?? 0;
  let lit = false;
  try { lit = !!cv.effects?.testInsideLight?.(c, elevation); } catch { lit = false; }
  if (lit) return false;
  const level = (() => { try { return cv.effects?.getDarknessLevel?.(c, elevation) ?? cv.environment?.darknessLevel ?? cv.scene.environment?.darknessLevel ?? 0; } catch { return cv.environment?.darknessLevel ?? 0; } })();
  const global = cv.environment?.globalLightSource;
  if (global?.active) return false;
  return level >= 0.5;
}

/**
 * An attack starts (Manifests too): Pole-Bound's Strengthened stack is esoteric.mjs's (it reads these poles); here Bounty (a Dreamborn's Manifest on a
 * creature serving its pole hits, once per round) and Portent (a Manifest made inside a Portent: its Wonder Strengthened, the opposite pole Weakened).
 */
export async function attackStart(actor, opts, targets) {
  const mode = opts?.mental?.mode && !opts.mental.ward && !opts.mental.reflect ? opts.mental.wonder : null;
  if (!mode || !actor) return opts;
  let out = opts;
  const w = B.wonderOf(actor);
  if (w && T(actor).dream >= 3 && targets?.length === 1 && B.serves(targets[0], w) && !used(actor, "bounty", "round")) {
    await use(actor, "bounty", "round");
    out = { ...out, mental: { ...out.mental, autoHit: true }, notes: [...(out.notes ?? []), "Bounty: it hits (a creature serving its pole)"] };
  }
  const here = tokenOf(actor);
  if (here) {
    for (const p of portents()) {
      if (Math.hypot((here.center?.x ?? 0) - p.x, (here.center?.y ?? 0) - p.y) * ((globalThis.canvas?.scene?.grid?.distance ?? 5) / (globalThis.canvas?.scene?.grid?.size ?? 100)) > 500) continue;
      if (mode === p.wonder) out = { ...out, stacks: (out.stacks ?? 0) + 1, notes: [...(out.notes ?? []), `Portent of ${wonderName(p.wonder)}: Strengthened`] };
      else if (mode === B.pairOf(p.wonder)) out = { ...out, stacks: (out.stacks ?? 0) - 1, notes: [...(out.notes ?? []), `Portent of ${wonderName(p.wonder)}: Weakened`] };
    }
  }
  return out;
}
/** The Portents on this scene: { wonder, x, y } (a Wonderborn's flag; one per Wonder counts once). */
function portents() {
  const sid = globalThis.canvas?.scene?.id, out = new Map();
  for (const a of [...(globalThis.game?.actors ?? []), ...sceneCreatures()]) {
    const p = a?.getFlag?.("flowstate", "portent"), w = B.wonderOf(a);
    if (p?.scene === sid && w && T(a).wonderborn >= 5 && !out.has(w)) out.set(w, { wonder: w, x: p.x, y: p.y });
  }
  return [...out.values()];
}

/** Rooted (Growth T4): Force applied to it is halved while it hasn't moved this turn. */
export function forceHalf(target, force) {
  if (T(target).growth < 4) return force;
  const l = moveLedger(target);
  return (l.ft > 0 || l.moves?.length) ? force : Math.floor(force / 2);
}

/** Follow the Pole (Wonderborn T3): Advantage on its Ward's attack rolls within 100 ft of a Herald of its Wonder or a creature serving its pole. */
export function wardNet(actor) {
  if (T(actor).wonderborn < 3) return { net: 0, note: "" };
  const w = B.wonderOf(actor);
  const near = sceneCreatures().some(a => a.uuid !== actor.uuid && (B.isHeraldOf(a, w) || B.serves(a, w)) && (dist(actor, a) ?? Infinity) <= 100);
  return near ? { net: 1, note: "Follow the Pole: Advantage" } : { net: 0, note: "" };
}

/** Lucid Depth / Nightmare Depth (T2): its Alignment costs it no speed. */
export const alignmentFree = a => T(a).dream >= 2 || T(a).nightmare >= 2;

/* -------------------------------------------- */
/*  Health: Unwaking, Deathless                 */
/* -------------------------------------------- */

/** Unwaking / Unrelenting (T4): below its Pain Threshold in a fight it stays up through its next turn (flag `unwaking`, set as it drops). */
export function holdingOn(actor) {
  const t = T(actor);
  if ((t.dream < 4 && t.nightmare < 4) || !inActiveCombat(actor)) return false;
  const f = actor.getFlag?.("flowstate", "unwaking");
  return !f || (f.combat === combatKey() && !f.done);
}
/** It just dropped below its Pain Threshold: start the count (GM). */
export async function droppedBelow(actor) {
  if (!holdingOn(actor) || actor.getFlag?.("flowstate", "unwaking")) return;
  await actor.setFlag("flowstate", "unwaking", { combat: combatKey(), armed: turnKey(), done: false });
  const name = T(actor).dream >= 4 ? "Unwaking" : "Unrelenting";
  await card(actor, name, `<div class="fs-result">${esc(actor.name)} falls below its Pain Threshold but doesn't go down: it acts normally on its next turn, and falls unconscious after it if it's still below.</div>`);
}
/** Deathless (Life T4): an Infected creature within 100 ft of a Life Wonderborn with Deathless doesn't die from damage: it stays down, budding. */
export function deathless(actor) {
  if (!actor?.statuses?.has?.("infected") || isWonderborn(actor)) return null;
  return sceneCreatures().find(a => T(a).life >= 4 && a.uuid !== actor.uuid && !a.statuses?.has?.("dormant") && (dist(a, actor) ?? Infinity) <= 100) ?? null;
}

/* -------------------------------------------- */
/*  The combat (GM)                             */
/* -------------------------------------------- */

/** Round 1 begins: every Wonderborn with Allure or Dread makes the opposed creatures in the fight resist it (once each per fight). */
export async function roundStart(combat) {
  if ((combat?.round ?? 0) !== 1) return;
  const fighters = combat.combatants.map(c => c.actor).filter(a => a && !notCreature(a));
  for (const w of fighters) {
    const t = T(w);
    if (t.dream < 1 && t.nightmare < 1) continue;
    const seen = new Set(w.getFlag?.("flowstate", "presenceSeen") ?? []);
    const list = fighters.filter(a => opposed(w, a) && !isWonderborn(a) && !seen.has(a.uuid));
    if (list.length) await presence(w, list);
  }
}

/** The start of a creature's turn: Regrowth, the Choking Green's damage, Unwaking's count, a Wonderborn's turn count, and the ground auras. */
export async function turnStart(combat, actor) {
  if (!actor) return;
  const t = T(actor);
  const n = actor.getFlag?.("flowstate", "bestTurns");
  if (isWonderborn(actor)) await actor.setFlag("flowstate", "bestTurns", { combat: combat.id, n: n?.combat === combat.id ? (n.n ?? 0) + 1 : 1 });
  // Regrowth (Life T2): everything lost since the start of its last turn comes back, except heat damage and crits.
  if (t.life >= 2) {
    const since = Number(actor.getFlag?.("flowstate", "turnStartedAt")) || 0;
    const back = since ? (actor.getFlag?.("flowstate", "lossLog") ?? []).filter(e => (e.at ?? 0) >= since && e.type !== "heat" && !e.crit).reduce((s, e) => s + (e.n || 0), 0) : 0;
    const hp = actor.system.hp, gain = Math.max(0, Math.min(back, hp.max - hp.value));
    if (gain > 0) {
      await actor.update({ "system.hp.value": hp.value + gain });
      await card(actor, "Regrowth", `<div class="fs-result">${esc(actor.name)} regrows ${gain} HP (everything since the start of its last turn but heat damage and crits).</div>`);
    }
  }
  // The Choking Green (Life T5): an Infected creature in it takes 1d6 physical damage at the start of its turn.
  if (actor.statuses?.has?.("infected") && !isWonderborn(actor)) {
    const green = sceneCreatures().find(a => T(a).life >= 5 && !a.statuses?.has?.("dormant") && (dist(a, actor) ?? Infinity) <= 100);
    if (green) {
      const roll = await rollKit.evaluate(poolFormula(1, 6, 0));
      await post(actor, { title: `${esc(actor.name)} — The Choking Green`, rolls: [roll], body: `<div class="fs-result">${esc(green.name)}'s choking growth: <strong>${roll.total}</strong> physical damage.</div>` });
      await applyDamage(actor, roll.total, "physical", { silent: true });
    }
  }
  await refreshAuras();
}

/** The end of a creature's turn: Allure wears off, Unwaking runs out, and on its 4th turn Sporing (Life) or Ripen (Growth). */
export async function turnEnd(combat, actor) {
  if (!actor) return;
  const al = actor.getFlag?.("flowstate", "allured");
  if (al && al.armed !== turnKey()) await actor.unsetFlag("flowstate", "allured");
  const uw = actor.getFlag?.("flowstate", "unwaking");
  if (uw && !uw.done && uw.armed !== turnKey()) {
    await actor.setFlag("flowstate", "unwaking", { ...uw, done: true });
    if (actor.system.hp.value < actor.system.hp.pain && actor.system.hp.value > 0) await actor.toggleStatusEffect("unconscious", { active: true });
  }
  const t = T(actor), n = actor.getFlag?.("flowstate", "bestTurns");
  if (n?.combat === combat?.id && n.n === 4 && (t.life >= 3 || t.growth >= 2)) await bloom(actor);
}

/**
 * Sporing (Life T3): every breathing creature within 100 ft is Infected (the GM ticks who breathes), then it collapses, dormant. Ripen (Growth T2):
 * it blooms; with Seed (T3) seed scatters within 100 ft (new Burgeons within a day, the GM's to place) and it wilts dormant.
 */
async function bloom(actor) {
  const t = T(actor);
  if (t.life >= 3) {
    const near = sceneCreatures().filter(a => a.uuid !== actor.uuid && (dist(actor, a) ?? Infinity) <= 100);
    const ticks = near.map(a => `<label class="fs-check"><input type="checkbox" name="b-${a.id}" ${isWonderborn(a) || a.system?.magical || a.flags?.flowstate?.summon ? "" : "checked"}> ${esc(a.name)}</label>`).join("");
    const picked = near.length ? await DialogV2().prompt({ window: { title: `${actor.name}: Sporing` }, rejectClose: false,
      content: `<p>${esc(actor.name)} releases its spores. Which of these creatures within 100 ft breathe (and are Infected)?</p><div class="fs-checks">${ticks}</div>`,
      ok: { label: "Infect them", callback: (event, button) => near.filter(a => button.form.elements[`b-${a.id}`]?.checked) } }) : [];
    for (const a of picked ?? []) await setStatus(a, "infected", true);
    await card(actor, "Sporing", `<div class="fs-result">Spores burst from ${esc(actor.name)}${(picked ?? []).length ? `: ${picked.map(a => esc(a.name)).join(", ")} ${(picked.length === 1 ? "is" : "are")} Infected` : ""}. It collapses, dormant, until it regrows over the next day.</div>`);
    return goDormant(actor);
  }
  if (t.growth >= 2) {
    if (t.growth < 3) return card(actor, "Ripen", `<div class="fs-result">${esc(actor.name)} blooms.</div>`);
    await card(actor, "Ripen and Seed", `<div class="fs-result">${esc(actor.name)} blooms and scatters seed within 100 ft: each seed that takes root grows into a new Burgeon within a day (the GM places them). It wilts back into its bulb, dormant until it regrows.</div>`);
    return goDormant(actor);
  }
  return null;
}
/** Dormant: out of the fight (off the tracker), for a day of world time; it wakes at full HP (consumables.mjs ends timed statuses, flowstate.mjs wakes it). */
async function goDormant(actor) {
  await setStatus(actor, "dormant", true);
  const combat = game.combat;
  const mine = combat?.combatants?.filter(c => c.actor?.uuid === actor.uuid).map(c => c.id) ?? [];
  if (mine.length && game.user.isGM) await combat.deleteEmbeddedDocuments("Combatant", mine);
  const region = auraRegions().filter(r => r.flags.flowstate.auraOf === actor.uuid).map(r => r.id);
  if (region.length && game.user.isGM) await globalThis.canvas.scene.deleteEmbeddedDocuments("Region", region);
}
/** It wakes (the Dormant status ended): full HP. */
export async function wake(actor) {
  if (!actor || !game.user.isGM) return;
  await actor.update({ "system.hp.value": actor.system.hp.max });
  await card(actor, "Regrown", `<div class="fs-result">${esc(actor.name)} has regrown: it wakes at full health.</div>`);
}

/* -------------------------------------------- */
/*  Ground auras (GM): the Choking Green, Overgrowth   */
/* -------------------------------------------- */

const auraRegions = () => [...(globalThis.canvas?.scene?.regions ?? [])].filter(r => r.flags?.flowstate?.auraOf);
/** The difficult ground around each creature with The Choking Green (Life T5, 100 ft) or Overgrowth (Growth T5, 20 ft); it doesn't slow the creature itself. */
export async function refreshAuras() {
  const scene = globalThis.canvas?.scene;
  if (!scene || !game.user.isGM) return;
  const want = new Map();
  for (const tok of scene.tokens ?? []) {
    const a = tok.actor;
    if (!a || a.statuses?.has?.("dormant")) continue;
    const ft = T(a).life >= 5 ? 100 : T(a).growth >= 5 ? 20 : 0;
    if (ft) want.set(a.uuid, { a, tok, ft, name: T(a).life >= 5 ? "The Choking Green" : "Overgrowth" });
  }
  const have = auraRegions();
  const gone = have.filter(r => !want.has(r.flags.flowstate.auraOf)).map(r => r.id);
  if (gone.length) await scene.deleteEmbeddedDocuments("Region", gone);
  const size = scene.grid?.size ?? 100, unit = scene.grid?.distance ?? 5;
  for (const [uuid, w] of want) {
    const d = w.tok, cx = d.x + ((d.width ?? 1) * size) / 2, cy = d.y + ((d.height ?? 1) * size) / 2;
    const side = ((2 * w.ft) / unit) * size + (d.width ?? 1) * size;
    const at = `${cx},${cy}:${side}`;
    const data = terrainRegionData("difficult", { cx, cy, sidePx: side, name: `${w.name} (${w.a.name})`, flags: { terrainOf: uuid, auraOf: uuid, auraAt: at, ritualOf: `aura:${uuid}` } });
    const cur = have.find(r => r.flags.flowstate.auraOf === uuid);
    if (!cur) await scene.createEmbeddedDocuments("Region", [data]);
    else if (cur.flags.flowstate.auraAt !== at) await cur.update({ shapes: data.shapes, "flags.flowstate.auraAt": at });
  }
}

/** The GM side of a token moving: its aura follows it. */
export function registerHooks() {
  Hooks.on("updateToken", (doc, change) => {
    if (!game.user.isGM || !("x" in change || "y" in change)) return;
    const t = T(doc.actor);
    if (t.life >= 5 || t.growth >= 5) refreshAuras();
  });
  Hooks.on("deleteActiveEffect", effect => {
    if (game.user !== game.users.activeGM) return;
    if (effect.statuses?.has?.("dormant") && effect.parent instanceof Actor) wake(effect.parent);
  });
}

