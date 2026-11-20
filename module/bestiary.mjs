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
import { opposed, allied } from "./sides.mjs";
import { notCreature } from "./kinds.mjs";
import { resistFear } from "./generic.mjs";
import { terrainRegionData } from "./terrain.mjs";
import { poolFormula, DAMAGE_TYPES } from "./rules.mjs";
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
  "Black Jaws", "Pack Hunter", "Drag Into the Dark", "Root Lash", "Ripen", "Seed", "Rooted", "Overgrowth",
  "Culling Hook", "Quarry", "Carrion Feast", "Carrion Flock", "Funeral by Funeral", "Burning Antlers", "Noonlight", "Run Them Down", "Sleepless", "Solar Storm",
  "Gavel", "Edicts", "Clockwork", "Lockstep", "The Unbroken Rule", "Unmaking Touch", "Unfixed", "Split", "Shifting Streets", "Lost Names"]);

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
  if (t.death >= 2) {
    const q = quarryOf(actor);
    row(q ? `Quarry: ${q.name} (mark another)` : "Quarry: mark", "Mark the targeted creature (else the strongest opposed one here) as its Quarry: its attacks against it have Advantage (not while one of its allies is within 10 ft), and it knows where it is within 1,000 ft", "—", "quarry", "fa-solid fa-crosshairs");
  }
  if (t.order >= 2) {
    const ed = actor.getFlag?.("flowstate", "edicts")?.list ?? [];
    row(ed.length ? "Edicts: declare anew" : "Edicts: declare", ed.length ? `Now: ${ed.map(e => `“${esc(e)}”`).join(", ")}` : "Two plain rules, each forbidding one kind of action (at the start of a fight and each dawn)", "—", "edicts", "fa-solid fa-scroll");
    if (ed.length) row("An Edict is broken", `The targeted creatures within 100 ft broke one: ${t.order >= 5 ? "each resists its Allure first (on a failure it can't take that action this turn); " : ""}1d10 × ${power} Supernatural damage, once per round each`, "—", "edictBroken", "fa-solid fa-gavel");
  }
  if (t.chaos >= 2) row(actor.statuses?.has?.("pinned") ? "Pinned (unpin it)" : "Pinned (its true name, an Order effigy)", "Pinned until the end of its next turn: it can't Split, and it can be grappled. Iron weapons and Order Manifests pin it on a hit by themselves", "—", "pin", "fa-solid fa-thumbtack");
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
  bloom: actor => bloom(actor),
  async quarry(actor) {
    const picked = targetsOf().filter(a => a.uuid !== actor.uuid)[0] ?? strongest(actor);
    if (!picked) return ui.notifications.warn("Nobody here to mark.");
    return markQuarry(actor, picked);
  },
  async edicts(actor) { return declareEdicts(actor); },
  async edictBroken(actor) {
    // The Edicts hurt within 100 ft; the Unbroken Rule (T5) reaches 1,000 ft (beyond 100 ft breaking one costs nothing but the resisted Allure).
    const reach = T(actor).order >= 5 ? 1000 : 100;
    const list = targetsOf().filter(a => a.uuid !== actor.uuid && (dist(actor, a) ?? 0) <= reach);
    if (!list.length) return ui.notifications.warn(`Target the creatures within ${reach} ft that broke an Edict.`);
    const key = roundKey() ?? "out", hits = actor.getFlag?.("flowstate", "edictHits");
    const done = new Set(hits?.key === key ? hits.uuids ?? [] : []);
    const formula = `${B.powerOf(actor)}d10`, need = B.presenceNeed(actor), net = T(actor).dream >= 5 ? -1 : 0, lines = [];
    for (const a of list) {
      if (done.has(a.uuid)) { lines.push(`${esc(a.name)} already took the Edict's damage this round`); continue; }
      done.add(a.uuid);
      if (T(actor).order >= 5) {                       // The Unbroken Rule: it resists the Allure first (its own client), and pays only if it breaks free
        await runOnOwner(a, { id: "bestiaryEdict", caster: a.uuid, target: actor.uuid, need, net, formula: (dist(actor, a) ?? 0) <= 100 ? formula : null, by: actor.name });
        lines.push(`${esc(a.name)} resists the Unbroken Rule (${need} needed${net ? ", with Disadvantage" : ""})`);
        continue;
      }
      await edictDamage(a, actor.name, formula);
      lines.push(`${esc(a.name)} breaks an Edict`);
    }
    await setActorFlag(actor, "edictHits", { key, uuids: [...done] });
    return card(actor, "Edicts", `<ul class="fs-list">${lines.map(l => `<li>${l}</li>`).join("")}</ul>`);
  },
  async pin(actor) {
    const on = !actor.statuses?.has?.("pinned");
    await setStatus(actor, "pinned", on);
    if (on) await actor.setFlag("flowstate", "pinned", { armed: turnKey() ?? "out" });
    return card(actor, on ? "Pinned" : "Unpinned", `<div class="fs-result">${esc(actor.name)} ${on ? "is Pinned until the end of its next turn: it can't Split, and it can be grappled" : "is no longer Pinned"}.</div>`);
  }
};

/* -------------------------------------------- */
/*  Death: Quarry                               */
/* -------------------------------------------- */

const quarryOf = actor => { const u = actor.getFlag?.("flowstate", "quarry"); return u ? globalThis.fromUuidSync?.(u) ?? null : null; };
const alive = a => (a?.system?.hp?.value ?? 0) > 0 && !a?.statuses?.has?.("dead");
/** The strongest opposed creature it can sense (the most Skill Points; healers and protectors count as strong, so the GM can mark another). */
function strongest(actor, without = null) {
  const list = sceneCreatures().filter(a => a.uuid !== actor.uuid && a.uuid !== without && opposed(actor, a) && alive(a) && !isWonderborn(a));
  return list.sort((x, y) => (Number(y.system?.skillPoints) || 0) - (Number(x.system?.skillPoints) || 0))[0] ?? null;
}
async function markQuarry(actor, target) {
  await setActorFlag(actor, "quarry", target.uuid);
  return card(actor, "Quarry", `<div class="fs-result">${esc(actor.name)} marks <strong>${esc(target.name)}</strong> as its Quarry: Advantage on its attacks against it (not while one of its allies is within 10 ft of it), and it knows where it is within 1,000 ft.</div><div class="fs-notes">Healers and protectors count as strong: the GM can mark another from the Action List.</div>`);
}

/* -------------------------------------------- */
/*  Order: Edicts                               */
/* -------------------------------------------- */

async function declareEdicts(actor) {
  const cur = actor.getFlag?.("flowstate", "edicts")?.list ?? [];
  const vals = await DialogV2().prompt({ window: { title: `${actor.name}: Edicts` }, rejectClose: false,
    content: `<p>Two plain rules, each forbidding one kind of action ("none shall cast spells", "none shall run"...). Creatures within 100 ft that can hear it know them.</p>
      <div class="form-group"><label>First</label><input type="text" name="e1" value="${esc(cur[0] ?? "")}"></div><div class="form-group"><label>Second</label><input type="text" name="e2" value="${esc(cur[1] ?? "")}"></div>`,
    ok: { label: "Declare", callback: (event, button) => [button.form.elements.e1?.value, button.form.elements.e2?.value].map(s => String(s ?? "").trim()).filter(Boolean) } });
  if (!vals?.length) return null;
  await actor.setFlag("flowstate", "edicts", { list: vals.slice(0, 2), at: Date.now() });
  return card(actor, "Edicts", `<div class="fs-result">${esc(actor.name)} declares: ${vals.slice(0, 2).map(e => `<strong>“${esc(e)}”</strong>`).join(" and ")}.</div><div class="fs-notes">A creature within 100 ft that breaks one takes 1d10 × its Wonder Power Supernatural damage, once per round${T(actor).order >= 5 ? "; within 1,000 ft it must first resist its Allure to break one (the Unbroken Rule)" : ""}.</div>`);
}
async function edictDamage(a, by, formula) {
  const roll = await rollKit.evaluate(formula);
  await post(a, { title: `${esc(a.name)} — Edict`, rolls: [roll], body: `<div class="fs-result">${esc(a.name)} breaks ${esc(by)}'s Edict: <strong>${roll.total}</strong> Supernatural damage.</div>` });
  await applyDamage(a, roll.total, "supernatural", { silent: true });
}
/** The Unbroken Rule (Order T5), on the breaker's client: resist the Allure; a failure stops the action, a success breaks the Edict and takes its damage. */
ACTS.bestiaryEdict = async (x, self) => {
  const ok = await resistFear(self, { need: x.need, net: x.net ?? 0, source: `${x.by}'s Allure (the Unbroken Rule)` });
  if (ok === false) return card(self, "The Unbroken Rule", `<div class="fs-result">${esc(self.name)} can't bring itself to break ${esc(x.by)}'s Edict: it can't take that action this turn.</div>`);
  if (ok === null) return true;
  if (!x.formula) return card(self, "The Unbroken Rule", `<div class="fs-result">${esc(self.name)} breaks ${esc(x.by)}'s Edict, beyond the 100 ft where it hurts.</div>`);
  return edictDamage(self, x.by, x.formula);
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
  // Unmaking Touch (Chaos T1): its damage type is rolled from the seven (a d7, in DAMAGE_TYPES' order).
  let type = n.type, rolled = "";
  if (type === "random") {
    const keys = Object.keys(DAMAGE_TYPES), r = await rollKit.evaluate("1d7");
    type = keys[Math.max(0, Math.min(keys.length - 1, r.total - 1))];
    rolled = `; its damage type rolled: ${DAMAGE_TYPES[type]} (${r.total} on a d7)`;
  }
  return performAttack(actor, { label: n.name, net: 0, melee: true, push: false, damage: B.naturalFormula(n, power), type, stacks: 0, physical: type === "physical",
    natural: true, shots: 1, ap: 0, apCost: n.ap, notes: [`A natural attack${n.scales ? ` (Wonder Power ×${power})` : ""}${rolled}`], followups: [], turnKey: turnKey(), targetActors: targets,
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
  // Quarry (Death T2): Advantage against its Quarry, unless one of the Quarry's allies is within 10 ft of it.
  if (T(attacker).death >= 2 && attacker.getFlag?.("flowstate", "quarry") === target.uuid) {
    const guarded = sceneCreatures().some(a => a.uuid !== target.uuid && a.uuid !== attacker.uuid && alive(a) && allied(target, a) && (dist(target, a) ?? Infinity) <= 10);
    if (guarded) notes.push("Quarry: an ally of it is within 10 ft (no Advantage)");
    else { net += 1; notes.push("Quarry: Advantage"); }
  }
  // Clockwork (Order T3): Disadvantage on the same attack its attacker made on its last turn. The attacker's own-turn attacks are logged while a
  // creature with Clockwork is on the scene.
  if (game.combat?.started && sceneCreatures().some(a => T(a).order >= 3)) {
    const key = B.attackKey(opts), round = game.combat.round, own = game.combat.combatant?.actor?.uuid === attacker.uuid;
    const log = attacker.getFlag?.("flowstate", "clockLog");
    if (T(target).order >= 3 && B.madeLastTurn(log, key, round, own)) { net -= 1; notes.push(`Clockwork (${target.name}): the same attack as last turn, Disadvantage`); }
    if (own && key) await setActorFlag(attacker, "clockLog", B.logOwnAttack(log, key, round));
  }
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
  if (!attacker || !target) return;
  // Unfixed (Chaos T2): an iron weapon (iron, cold iron, gray iron) or an Order Manifest pins it until the end of its next turn.
  if (T(target).chaos >= 2 && !target.statuses?.has?.("pinned")) {
    const item = o?.itemUuid ? globalThis.fromUuidSync?.(o.itemUuid) : null;
    const why = item && B.PIN_MATERIALS.has(item.system?.material) ? item.name : o?.mental?.wonder === "mental-order-dream" ? "an Order Manifest" : null;
    if (why) {
      await setStatus(target, "pinned", true);
      await setActorFlag(target, "pinned", { armed: turnKey() ?? "out" });
      await card(target, "Pinned", `<div class="fs-result">${esc(why)} pins ${esc(target.name)} until the end of its next turn: it can't Split, and it can be grappled.</div>`);
    }
  }
  const b = o?.bestiary;
  if (!b) return;
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

/**
 * Clockwork (Order T3): the first time each creature hits it with an attack it hasn't used against it this combat, that hit's damage is Strengthened.
 * Called as the damage is rolled (sync: the new attack is written down after).
 */
export function damageStacks({ attacker, target, o }) {
  if (!attacker || !target || T(target).order < 3 || !game.combat?.started) return { stacks: 0, parts: [] };
  const key = B.attackKey(o), seen = target.getFlag?.("flowstate", "clockSeen");
  const mine = seen?.combat === game.combat.id ? seen.by?.[attacker.id ?? attacker.uuid] ?? [] : [];
  if (!key || mine.includes(key)) return { stacks: 0, parts: [] };
  const by = seen?.combat === game.combat.id ? { ...(seen.by ?? {}) } : {};
  by[attacker.id ?? attacker.uuid] = [...mine, key];
  setTimeout(() => setActorFlag(target, "clockSeen", { combat: game.combat.id, by }), 0);
  return { stacks: 1, parts: ["+1 Clockwork (a new attack)"] };
}

/**
 * Damage landed on a creature (its owner's client, after the HP change): who hurt it (Funeral by Funeral, Carrion Flock), Run Them Down's chase, and
 * Split (Chaos T3), which breaks a piece away.
 */
export async function afterDamage(actor, amount, type, att) {
  if (!(amount > 0) || !actor) return;
  if (att && att.uuid !== actor.uuid) {
    const t = T(att);
    if (t.death >= 4) {
      const log = { ...(actor.getFlag?.("flowstate", "damagedBy") ?? {}) };
      for (const [k, at] of Object.entries(log)) if (Date.now() - at > 30 * 60 * 1000) delete log[k];
      log[att.id ?? att.uuid] = Date.now();
      await setActorFlag(actor, "damagedBy", { ...log, last: att.uuid });
    }
    // Run Them Down (Light T3): a creature that damaged it must spend its first movement each turn moving toward it (resisted at its turn start).
    if (T(actor).light >= 3 && inActiveCombat(actor)) await setActorFlag(att, "chasing", { by: actor.uuid, at: Date.now() });
  }
  if (T(actor).chaos >= 3 && !actor.statuses?.has?.("pinned") && inActiveCombat(actor) && !used(actor, "split", "round") && game.user?.isGM) {
    await use(actor, "split", "round");
    await split(actor, amount);
  }
}

/* -------------------------------------------- */
/*  Chaos: Split                                */
/* -------------------------------------------- */

/**
 * Split (Chaos T3): a piece breaks away within 10 ft, an object of Durability = the damage (at most half its max HP) and 0 Limit. It's put on the scene
 * as a copy of the Smear's token (HP = that Durability, fixed dodge 0 so attacks always hit it, as against an object); still standing at the end of the
 * Smear's next turn, it becomes a new Smear with that health (the GM adds it to the tracker).
 */
async function split(actor, damage) {
  const tok = tokenOf(actor), scene = globalThis.canvas?.scene;
  const dur = B.splitDurability(damage, actor.system?.hp?.max);
  if (!dur) return null;
  if (!tok?.document || !scene) return card(actor, "Split", `<div class="fs-result">A piece of ${esc(actor.name)} breaks away (${dur} Durability, 0 Limit): if it's still standing at the end of its next turn, it becomes a new Smear with that much health.</div>`);
  const data = tok.document.toObject();
  delete data._id;
  const gs = scene.grid?.size ?? 100;
  Object.assign(data, { name: `Piece of ${tok.document.name}`, x: data.x + gs * (data.width ?? 1), y: data.y, actorLink: false });
  foundry.utils.setProperty(data, "delta.system.hp.value", dur);
  foundry.utils.setProperty(data, "delta.flags.flowstate.fixedDodge", { on: true, value: 0 });
  foundry.utils.setProperty(data, "delta.flags.flowstate.smearPiece", { of: actor.uuid, armed: turnKey() ?? "out", dur });
  foundry.utils.setProperty(data, "delta.flags.flowstate.bestUse", {});
  await scene.createEmbeddedDocuments("Token", [data]);
  return card(actor, "Split", `<div class="fs-result">A piece of ${esc(actor.name)} breaks away (<strong>${dur}</strong> Durability, 0 Limit; attacks always hit it). Still standing at the end of ${esc(actor.name)}'s next turn, it becomes a new Smear with that much health.</div><div class="fs-notes">Placed beside it: move it anywhere within 10 ft.</div>`);
}
/** The end of a Smear's turn: its pieces from before this turn that still stand become Smears. */
async function ripenPieces(actor) {
  const scene = globalThis.canvas?.scene;
  if (!scene || !game.user?.isGM) return;
  for (const td of scene.tokens ?? []) {
    const f = td.actor?.getFlag?.("flowstate", "smearPiece");
    if (!f || f.of !== actor.uuid || f.armed === turnKey()) continue;
    if ((td.actor.system?.hp?.value ?? 0) <= 0) continue;
    await td.actor.unsetFlag("flowstate", "smearPiece");
    await td.actor.setFlag("flowstate", "fixedDodge", { on: false, value: 0 });
    await td.update({ name: String(td.name).replace(/^Piece of /, "") });
    await card(td.actor, "A new Smear", `<div class="fs-result">The piece still stands: it's a new Smear with ${td.actor.system.hp.value} health (the GM adds it to the tracker).</div>`);
  }
}

/* -------------------------------------------- */
/*  Death: a creature dies                      */
/* -------------------------------------------- */

/** A creature died (GM, as its Dead status goes on): Carrion Feast heals the Death Wonderborn near it, Carrion Flock raises it, Quarry moves on. */
export async function died(actor) {
  if (!actor || !game.user?.isGM) return;
  const pain = Number(actor.system?.hp?.pain) || 0;
  for (const w of sceneCreatures()) {
    if (w.uuid === actor.uuid || !alive(w)) continue;
    const t = T(w);
    if (t.death >= 3 && pain > 0 && (dist(w, actor) ?? Infinity) <= 10) {
      const hp = w.system.hp, gain = Math.max(0, Math.min(pain, hp.max - hp.value));
      if (gain) { await w.update({ "system.hp.value": hp.value + gain }); await card(w, "Carrion Feast", `<div class="fs-result">${esc(actor.name)} dies within 10 ft: ${esc(w.name)} heals ${gain} (its Pain Threshold).</div>`); }
    }
    if (t.death >= 2 && w.getFlag?.("flowstate", "quarry") === actor.uuid) {
      const next = strongest(w, actor.uuid);
      if (next) await markQuarry(w, next); else await w.unsetFlag("flowstate", "quarry");
    }
  }
  const by = globalThis.fromUuidSync?.(actor.getFlag?.("flowstate", "damagedBy")?.last ?? "");
  if (by && T(by).death >= 4 && !isWonderborn(actor)) await card(by, "Carrion Flock", `<div class="fs-result">${esc(by.name)} killed ${esc(actor.name)}: it rises as its carrion thrall within a minute (the GM makes it).</div>`);
}

/**
 * Funeral by Funeral (Death T5): healing on a creature it damaged since the start of its last turn is doubly Weakened. The HP gained in an update is
 * cut to a quarter (a preUpdateActor hook): its last turn is its previous one on its own turn, else its latest.
 */
export function funeralFor(actor) {
  const log = actor?.getFlag?.("flowstate", "damagedBy");
  if (!log || !game.combat?.started) return null;
  for (const w of sceneCreatures()) {
    if (T(w).death < 5 || !alive(w) || w.uuid === actor.uuid) continue;
    const at = log[w.id ?? w.uuid];
    if (!at) continue;
    const own = game.combat.combatant?.actor?.uuid === w.uuid;
    const since = Number(w.getFlag?.("flowstate", own ? "prevTurnStartedAt" : "turnStartedAt")) || Number(w.getFlag?.("flowstate", "turnStartedAt")) || 0;
    if (since && at >= since) return w;
  }
  return null;
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

/**
 * Unwaking / Unrelenting (T4), and Numb Flesh (the Wasteling tree, T4): below its Pain Threshold in a fight it stays up through its next turn (flag
 * `unwaking`, set as it drops).
 */
const numbFlesh = actor => (Number(actor?.system?.trees?.["ancestry-wasteling"]) || 0) >= 4;
export function holdingOn(actor) {
  const t = T(actor);
  if ((t.dream < 4 && t.nightmare < 4 && !numbFlesh(actor)) || !inActiveCombat(actor)) return false;
  const f = actor.getFlag?.("flowstate", "unwaking");
  return !f || (f.combat === combatKey() && !f.done);
}
/** It just dropped below its Pain Threshold: start the count (GM). */
export async function droppedBelow(actor) {
  if (!holdingOn(actor) || actor.getFlag?.("flowstate", "unwaking")) return;
  await actor.setFlag("flowstate", "unwaking", { combat: combatKey(), armed: turnKey(), done: false });
  const name = T(actor).dream >= 4 ? "Unwaking" : T(actor).nightmare >= 4 ? "Unrelenting" : "Numb Flesh";
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
  // At the start of combat: Quarry (Death T2) marks the strongest; Edicts (Order T2) are declared (the GM's dialog, last ones filled in).
  for (const w of fighters) {
    const t = T(w);
    if (t.death >= 2 && !alive(quarryOf(w))) { const q = strongest(w); if (q) await markQuarry(w, q); }
    if (t.order >= 2) await declareEdicts(w);
  }
}

/** Resisting a Wonderborn's Allure or Dread for a forced mental effect (on the resisting creature's client): the card says what failing means. */
ACTS.bestiaryResist = async (x, self) => {
  const ok = await resistFear(self, { need: x.need, net: x.net ?? 0, source: x.label });
  if (ok === null) return true;
  if (ok !== false) return card(self, x.label, `<div class="fs-result">${esc(self.name)} resists.</div>`);
  if (x.kind === "lostNames") await setActorFlag(self, "lostNames", { armed: turnKey() ?? "out" });
  return card(self, x.label, `<div class="fs-result">${x.fail}</div>`);
};
const resistArgs = (w, allure) => ({ need: B.presenceNeed(w), net: (allure ? T(w).dream : T(w).nightmare) >= 5 ? -1 : 0 });
/** It wears or wields metal: its worn armor or a held weapon of a metal material (Solar Storm). */
const wearsMetal = a => [a?.system?.armor, ...(a?.items ?? []).filter(i => i.type === "weapon" && i.system?.equipped)]
  .some(i => i && !i.system?.natural && B.METALS.has(i.system?.material));

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
  const awake = (a, tier, ft) => a.uuid !== actor.uuid && alive(a) && !a.statuses?.has?.("dormant") && tier(T(a)) && (dist(a, actor) ?? Infinity) <= ft;
  // Solar Storm (Light T5): within 100 ft, a creature that wears or wields metal takes 1d6 heat damage at the start of its turn.
  const sun = !isWonderborn(actor) && wearsMetal(actor) ? sceneCreatures().find(a => awake(a, t => t.light >= 5, 100)) : null;
  if (sun) {
    const roll = await rollKit.evaluate(poolFormula(1, 6, 0));
    await post(actor, { title: `${esc(actor.name)} — Solar Storm`, rolls: [roll], body: `<div class="fs-result">${esc(sun.name)}'s storm heats ${esc(actor.name)}'s metal: <strong>${roll.total}</strong> heat damage.</div>` });
    await applyDamage(actor, roll.total, "heat", { silent: true });
  }
  // Lost Names (Chaos T5): starting its turn within 100 ft, it resists the Dread or forgets its name and allies (random targets) until its turn ends.
  const smear = !isWonderborn(actor) ? sceneCreatures().find(a => awake(a, t => t.chaos >= 5, 100)) : null;
  if (smear) await runOnOwner(actor, { id: "bestiaryResist", caster: actor.uuid, target: smear.uuid, ...resistArgs(smear, false), kind: "lostNames", label: `${smear.name}'s Dread (Lost Names)`,
    fail: `${esc(actor.name)} forgets its name and its allies until the end of its turn: it picks its targets at random.` });
  // Run Them Down (Light T3): it damaged a Blazehart since that one's last turn, so its first movement this turn must go toward it (resisted as Allure).
  const ch = actor.getFlag?.("flowstate", "chasing"), stag = ch ? globalThis.fromUuidSync?.(ch.by) : null;
  if (stag && alive(stag) && T(stag).light >= 3 && (ch.at ?? 0) >= (Number(stag.getFlag?.("flowstate", "prevTurnStartedAt")) || 0)) {
    const spent = (actor.system?.energy?.value ?? 0) <= 0;
    await runOnOwner(actor, { id: "bestiaryResist", caster: actor.uuid, target: stag.uuid, ...resistArgs(stag, true), label: `${stag.name}'s Allure (Run Them Down)`,
      fail: `${esc(actor.name)} must spend its first movement this turn moving toward ${esc(stag.name)}.${spent ? " It keeps chasing at 0 Energy: it collapses." : ""}` });
  } else if (ch) await actor.unsetFlag("flowstate", "chasing");
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
  // Pinned (Chaos T2) lasts until the end of its next turn; Lost Names until the end of this one.
  const pin = actor.getFlag?.("flowstate", "pinned");
  if (actor.statuses?.has?.("pinned") && pin?.armed !== turnKey()) { await setStatus(actor, "pinned", false); await actor.unsetFlag("flowstate", "pinned"); }
  if (actor.getFlag?.("flowstate", "lostNames")) await actor.unsetFlag("flowstate", "lostNames");
  const t = T(actor), n = actor.getFlag?.("flowstate", "bestTurns");
  if (t.chaos >= 3) await ripenPieces(actor);
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
  await setStatus(actor, "dormant", true);          // flowstate.mjs takes it off the tracker (as a downed creature)
  await refreshAuras();                              // a dormant creature has no aura
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
/** The difficult ground around each creature with The Choking Green (Life T5, 100 ft) or Overgrowth (Growth T5, 10 ft); it doesn't slow the creature itself.
 *  Runs one at a time (every token move asks for one): two at once would both delete the same region or both create one. */
let auraRun = Promise.resolve();
export function refreshAuras() {
  auraRun = auraRun.then(syncAuras).catch(err => console.warn("Flow State | aura regions:", err));
  return auraRun;
}
async function syncAuras() {
  const scene = globalThis.canvas?.scene;
  if (!scene || !game.user.isGM) return;
  const want = new Map();
  for (const tok of scene.tokens ?? []) {
    const a = tok.actor;
    if (!a || a.statuses?.has?.("dormant")) continue;
    const ft = T(a).life >= 5 ? 100 : T(a).growth >= 5 ? 10 : 0;
    if (ft) want.set(a.uuid, { a, tok, ft, name: T(a).life >= 5 ? "The Choking Green" : "Overgrowth" });
  }
  const have = auraRegions();
  const first = new Map();
  for (const r of have) if (!first.has(r.flags.flowstate.auraOf)) first.set(r.flags.flowstate.auraOf, r);
  const gone = have.filter(r => (!want.has(r.flags.flowstate.auraOf) || first.get(r.flags.flowstate.auraOf) !== r) && scene.regions.has(r.id)).map(r => r.id);
  if (gone.length) await scene.deleteEmbeddedDocuments("Region", gone);
  const size = scene.grid?.size ?? 100, unit = scene.grid?.distance ?? 5;
  for (const [uuid, w] of want) {
    const d = w.tok, cx = d.x + ((d.width ?? 1) * size) / 2, cy = d.y + ((d.height ?? 1) * size) / 2;
    const side = ((2 * w.ft) / unit) * size + (d.width ?? 1) * size;
    const at = `${cx},${cy}:${side}`;
    const data = terrainRegionData("difficult", { cx, cy, sidePx: side, name: `${w.name} (${w.a.name})`, flags: { terrainOf: uuid, auraOf: uuid, auraAt: at, ritualOf: `aura:${uuid}` } });
    const cur = first.get(uuid);
    if (!cur) await scene.createEmbeddedDocuments("Region", [data]);
    else if (cur.flags.flowstate.auraAt !== at) await cur.update({ shapes: data.shapes, "flags.flowstate.auraAt": at });
  }
}

/** The GM side of a token moving: its aura follows it. */
export function registerHooks() {
  // Funeral by Funeral (Death T5): the HP an update would heal is cut to a quarter (doubly Weakened).
  Hooks.on("preUpdateActor", (actor, changed) => {
    const next = foundry.utils.getProperty(changed, "system.hp.value"), cur = actor.system?.hp?.value;
    if (typeof next !== "number" || typeof cur !== "number" || next <= cur || cur <= 0) return;
    const w = funeralFor(actor);
    if (!w) return;
    const cut = cur + B.funeralHeal(next - cur);
    foundry.utils.setProperty(changed, "system.hp.value", cut);
    setTimeout(() => card(actor, "Funeral by Funeral", `<div class="fs-result">${esc(w.name)} damaged ${esc(actor.name)} since the start of its last turn: the healing is doubly Weakened (${next - cur} → ${cut - cur}).</div>`), 0);
  });
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

