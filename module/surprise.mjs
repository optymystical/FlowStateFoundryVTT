/**
 * The surprise round (Initiative Tier 0, Surprise): when combat begins and someone was unaware of it, combat opens with a surprise round (round 0). Each
 * side with a non-surprised character picks one opener; the openers take a full turn in initiative order and everyone else waits for round 1. Surprised
 * characters have no RP until their first turn (Collected, Initiative T3: they get it when round 1 starts); the others refill their RP when round 1 starts.
 *
 * Foundry's own round 0 is "not started", so the surprise round is Foundry's round 1 with the combat flag `surprise` ({ round, openers, debt }); the
 * tracker shows it as round 0 and the rounds after it one lower. FlowStateCombat calls in: `beginCombat` (from startCombat), `nextTurnIndex` (skips the
 * non-openers), `roundStart`, `turnStart`. A Sneak Attack outside combat is remembered on the attacker (flag `openingAttack`): it makes them their side's
 * opener, its targets start out Surprised, and its AP comes out of the opener's surprise turn.
 */
import { post, setActorFlag, setStatus, spendPoints, tokenDistance, registerSurprise } from "./actions.mjs";
import * as ab from "./abilities.mjs";
import { askFor } from "./ask.mjs";
import { esc, DialogV2 } from "./html.mjs";
import { energyHave } from "./consumables-rules.mjs";
import { inTerritory } from "./ancestry-net.mjs";

/** How long a Sneak Attack outside combat counts as the one that starts the next combat. */
const OPENING_MS = 5 * 60 * 1000;
const tier = (actor, id) => ab.treeTier(actor, id);
const SIDES = { 1: "Friendly", 0: "Neutral", "-1": "Hostile", "-2": "Secret" };
const sideOf = c => String(c.token?.disposition ?? c.actor?.prototypeToken?.disposition ?? 0);

/** The surprise round's state, while it's on (Foundry round `round`). */
export const surpriseOf = combat => {
  const s = combat?.getFlag?.("flowstate", "surprise");
  return s && s.round === combat.round ? s : null;
};
/** Is this the surprise round, and is this combatant one of its openers? */
export const isOpener = (combat, combatant) => !!surpriseOf(combat)?.openers?.includes(combatant?.id);

/** A Sneak Attack (an attack from stealth) outside combat: it starts the next combat. Remembered on the attacker, with a note for the GM. */
export async function noteOpeningAttack(actor, opts, targets) {
  if (!actor || game.combat?.started || !targets?.length || !(opts?.stealth === "half" || opts?.stealth === "full")) return;
  const at = Date.now();
  await setActorFlag(actor, "openingAttack", { at, ap: Math.max(0, Number(opts.apCost) || 0), targets: targets.map(t => t.uuid) });
  await ChatMessage.create({ whisper: game.users.filter(u => u.isGM).map(u => u.id), speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="flowstate-card"><header class="fs-card-title">Sneak Attack: combat begins</header>
      <div class="fs-result">${esc(actor.name)} attacked ${targets.map(t => esc(t.name)).join(", ")} from ${opts.stealth} stealth outside combat.</div>
      <div class="fs-notes">When you Begin Combat, ${esc(actor.name)} opens the surprise round for their side (this attack is the start of that turn: its ${Math.max(0, Number(opts.apCost) || 0)} AP come out of it), and ${targets.length === 1 ? "the target starts" : "the targets start"} out Surprised. ${targets.length === 1 ? "It's" : "They're"} aware of combat now.</div></div>` });
}
const openingOf = actor => {
  const o = actor?.getFlag?.("flowstate", "openingAttack");
  return o && Date.now() - (Number(o.at) || 0) < OPENING_MS ? o : null;
};

/**
 * Begin Combat (GM): if anyone could be surprised, ask who is (pre-filled: the Surprised status, and the targets of a recent Sneak Attack), offer
 * Vigilance to the surprised who have it, then pick each side's opener. Returns the surprise state to keep, or null for a normal start.
 */
export async function beginCombat(combat) {
  const list = combat.combatants.contents.filter(c => c.actor);
  if (!list.length) return null;
  const openings = list.map(c => ({ c, o: openingOf(c.actor) })).filter(x => x.o);
  const targeted = new Set(openings.flatMap(x => x.o.targets));
  const pre = c => c.actor.statuses?.has?.("surprised") || targeted.has(c.actor.uuid);
  if (!list.some(pre) && !openings.length) return null;

  // 1. Who is surprised (unaware of combat when it began)?
  const rows = list.map(c => `<tr><td>${esc(c.name)}</td><td>${SIDES[sideOf(c)] ?? ""}</td><td><input type="checkbox" name="s.${c.id}" ${pre(c) ? "checked" : ""}></td></tr>`).join("");
  const marked = await DialogV2().prompt({ window: { title: "Surprise round?" }, rejectClose: false,
    content: `<div class="flowstate-dialog"><p>Tick the creatures that were unaware of combat when it began: they're Surprised (no turn in the surprise round, no RP until their first turn). With nobody ticked, combat starts normally.</p>
      <table class="fs-table"><thead><tr><th>Creature</th><th>Side</th><th>Surprised</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    ok: { label: "Next", callback: (event, button) => Object.fromEntries(list.map(c => [c.id, !!button.form.elements[`s.${c.id}`]?.checked])) } });
  if (!marked) return null;
  // Territorial (Bestial T2): a creature in its territory can't be Surprised (Tribe, T5: nor its allies near it).
  const home = list.filter(c => marked[c.id] && inTerritory(c.actor));
  for (const c of home) marked[c.id] = false;
  if (home.length) await ChatMessage.create({ content: `<div class="flowstate-card"><header class="fs-card-title">Territorial</header><div class="fs-notes">${home.map(c => esc(c.name)).join(", ")} ${home.length === 1 ? "is" : "are"} in their territory and can't be Surprised.</div></div>` });
  // Warning Thump (Leporid T4): a creature that isn't Surprised thumps the ground, and its allies within 100 ft who hear it can't be Surprised.
  const thumpers = list.filter(c => !marked[c.id] && ab.treeTier(c.actor, "ancestry-leporid") >= 4 && !c.actor.statuses?.has?.("unconscious"));
  const warned = list.filter(c => marked[c.id] && thumpers.some(t => sideOf(t) === sideOf(c) && sideOf(c) !== "0" && near(t, c)));
  for (const c of warned) marked[c.id] = false;
  if (warned.length) await ChatMessage.create({ content: `<div class="flowstate-card"><header class="fs-card-title">Warning Thump</header><div class="fs-notes">${thumpers.map(c => esc(c.name)).join(", ")} thump${thumpers.length === 1 ? "s" : ""} the ground: ${warned.map(c => esc(c.name)).join(", ")} can't be Surprised.</div></div>` });
  for (const c of list) await setStatus(c.actor, "surprised", !!marked[c.id]);

  // 2. Vigilance (Perception T2): a surprised creature that has it may pay to be aware; Alert (T4) brings its allies within 100 ft along.
  for (const c of list) {
    const a = c.actor;
    if (!a.statuses?.has?.("surprised") || tier(a, "generic-perception") < 2) continue;
    const cost = Number(a.system.skillPoints) || 0;
    if (energyHave(a) < cost) continue;
    const allies = tier(a, "generic-perception") >= 4 ? list.filter(o => o !== c && o.actor.statuses?.has?.("surprised") && sideOf(o) === sideOf(c) && near(c, o)) : [];
    const ans = await askFor(a, { title: `${a.name}: Vigilance?`, react: "vigilance", ok: "Use Vigilance",
      html: `<p>Combat begins and ${esc(a.name)} is unaware. Become aware (not surprised) for <strong>${cost} Energy</strong>?</p>${allies.length ? `<p>Alert: also alert</p>${allies.map(o => `<label><input type="checkbox" name="al.${o.id}" checked> ${esc(o.name)}</label>`).join("<br>")}` : ""}` });
    if (!ans) continue;
    await a.update({ "system.energy.value": Math.max(0, (a.system.energy?.value ?? 0) - cost) });          // paid as combat begins (the GM's client)
    await setStatus(a, "surprised", false);
    const freed = allies.filter(o => ans[`al.${o.id}`]);
    for (const o of freed) await setStatus(o.actor, "surprised", false);
    await post(a, { title: `${esc(a.name)} — Vigilance`, body: `<div class="fs-result">${esc(a.name)} is aware: not surprised${freed.length ? `, and alerts ${freed.map(o => esc(o.name)).join(", ")}` : ""}.</div>` });
  }
  if (!list.some(c => c.actor.statuses?.has?.("surprised"))) return null;

  // 3. Each side with a non-surprised character picks its opener; whoever's Sneak Attack started combat must be theirs.
  const missing = list.filter(c => c.initiative === null || c.initiative === undefined).map(c => c.id);
  if (missing.length) await combat.rollInitiative(missing, { updateTurn: false });
  const sides = {};
  for (const c of list) if (!c.actor.statuses?.has?.("surprised")) (sides[sideOf(c)] ??= []).push(c);
  const forced = Object.fromEntries(Object.entries(sides).map(([k, cs]) => [k, cs.find(c => openings.some(x => x.c === c))?.id ?? null]));
  const byInit = cs => [...cs].sort((a, b) => (Number(b.initiative) || 0) - (Number(a.initiative) || 0));
  const pick = await DialogV2().prompt({ window: { title: "Surprise round: openers" }, rejectClose: false,
    content: `<div class="flowstate-dialog"><p>Each side picks one opener: they take a full turn in the surprise round (round 0), in initiative order. Everyone else waits for round 1.</p>
      ${Object.entries(sides).map(([k, cs]) => `<div class="form-group"><label>${SIDES[k] ?? k}</label><select name="o.${k}" ${forced[k] ? "disabled" : ""}>
        <option value="">— no opener —</option>${byInit(cs).map(c => `<option value="${c.id}" ${(forced[k] ?? byInit(cs)[0].id) === c.id ? "selected" : ""}>${esc(c.name)} (${c.initiative ?? "?"})${forced[k] === c.id ? " — their Sneak Attack began it" : ""}</option>`).join("")}</select></div>`).join("")}
      <p class="hint">Not surprised but not opening: they keep their RP, and with Poised (Initiative T2) can spend up to 2 RP to move in the surprise round.</p></div>`,
    ok: { label: "Begin the surprise round", callback: (event, button) => Object.keys(sides).map(k => forced[k] ?? button.form.elements[`o.${k}`]?.value).filter(Boolean) } });
  if (!pick?.length) return null;
  const debt = Object.fromEntries(openings.filter(x => pick.includes(x.c.id) && x.o.ap).map(x => [x.c.id, x.o.ap]));
  for (const x of openings) await setActorFlag(x.c.actor, "openingAttack", null);
  return { round: 1, openers: pick, debt };
}
const near = (a, b) => { const ta = a.token?.object, tb = b.token?.object; return !ta || !tb || tokenDistance(ta, tb) <= 100; };

/** The first turn index to start the combat on: the first opener in the turn order. */
export const firstOpenerIndex = (combat, s) => Math.max(0, combat.turns.findIndex(c => s.openers.includes(c.id)));
/** The next turn in the surprise round: the next opener after `from`, or null (the round is over). */
export function nextOpenerIndex(combat, from) {
  const s = surpriseOf(combat);
  if (!s) return undefined;
  for (let i = from + 1; i < combat.turns.length; i++) if (s.openers.includes(combat.turns[i].id) && !combat.turns[i].isDefeated) return i;
  return null;
}

/** A round starts: right after the surprise round, everyone who isn't Surprised gets their RP (Collected: the Surprised too). */
export async function roundStart(combat) {
  const s = combat.getFlag("flowstate", "surprise");
  if (!s || combat.round !== s.round + 1 || s.done) return;
  await combat.setFlag("flowstate", "surprise", { ...s, done: true });
  for (const c of combat.combatants) {
    const a = c.actor;
    if (!a || (a.statuses?.has?.("surprised") && tier(a, "generic-initiative") < 3)) continue;
    await a.update({ "system.rp.value": a.system.rp?.max ?? 6 });
  }
  await ChatMessage.create({ content: `<div class="flowstate-card"><header class="fs-card-title">Round 1</header><div class="fs-notes">The surprise round is over: everyone who isn't Surprised has their RP${combat.combatants.some(c => c.actor?.statuses?.has?.("surprised") && tier(c.actor, "generic-initiative") >= 3) ? " (and the Collected)" : ""}. The Surprised get theirs at the start of their first turn.</div></div>` });
}

/** An opener's surprise turn: the AP its Sneak Attack spent come out of it; Coordinated Strike (Ambush T4) is pointed out to the allies who can join. */
export async function turnStart(combat, combatant) {
  const s = surpriseOf(combat);
  if (!s || !combatant?.actor) return;
  const a = combatant.actor;
  const owed = Number(s.debt?.[combatant.id]) || 0;
  if (owed) {
    await a.update({ "system.ap.value": Math.max(0, (a.system.ap?.value ?? 0) - owed) });
    await combat.setFlag("flowstate", "surprise", { ...s, debt: { ...s.debt, [combatant.id]: 0 } });
    await post(a, { title: `${esc(a.name)} — Surprise round`, body: `<div class="fs-result">${esc(a.name)}'s Sneak Attack began this turn: its <strong>${owed} AP</strong> are already spent.</div>` });
  }
  if (tier(a, "generic-ambush") >= 4 && owed) {
    const allies = combat.combatants.filter(c => c !== combatant && c.actor && sideOf(c) === sideOf(combatant) && c.actor.statuses?.has?.("stealth") && near(combatant, c));
    if (allies.length) await post(a, { title: `${esc(a.name)} — Coordinated Strike`, body: `<div class="fs-result">Up to two of ${allies.map(c => esc(c.name)).join(", ")} (Stealthing, within 100 ft) can each make an attack against ${esc(a.name)}'s target now, as a reaction for RP equal to its AP cost, if the target hasn't spotted them (their own Stealth Value applies).</div><div class="fs-notes">The GM gives back the AP the attack dialog takes and takes the RP instead.</div>` });
  }
}

/**
 * Poised (Initiative T2): not surprised and not an opener, you can spend up to 2 RP in the surprise round to move, each RP as 1 AP of movement (a free move
 * of up to your speed each).
 */
export async function poisedMove(actor) {
  const combat = game.combat, s = surpriseOf(combat);
  const c = combat?.combatants?.find(x => x.actor?.uuid === actor.uuid);
  if (!s || !c || actor.statuses?.has?.("surprised") || s.openers.includes(c.id)) return ui.notifications.warn("Poised moves are for the surprise round, if you're neither surprised nor opening.");
  const used = Number(actor.getFlag("flowstate", "poisedUsed")?.[combat.id]) || 0;
  if (used >= 2) return ui.notifications.warn(`${actor.name} has spent 2 RP moving already.`);
  if (!(await spendPoints(actor, "rp", 1, "Poised move"))) return;
  await setActorFlag(actor, "poisedUsed", { [combat.id]: used + 1 });
  await actor.setFlag("flowstate", "freeMove", true);
  return post(actor, { title: `${esc(actor.name)} — Poised`, body: `<div class="fs-result">${esc(actor.name)} can move up to ${actor.system.movement?.speed ?? "their"} ft now (1 RP; ${1 - used} more this surprise round).</div>` });
}

/** The tracker shows the surprise round as round 0, and the rounds after it one lower. */
export function displayRound(combat) {
  const s = combat?.getFlag?.("flowstate", "surprise");
  if (!s || !combat.round) return combat?.round;
  return combat.round - s.round;
}
export function registerSurpriseHooks() {
  Hooks.on("renderCombatTracker", (app, html) => {
    const combat = app.viewed ?? game.combat;
    const s = combat?.getFlag?.("flowstate", "surprise");
    if (!s || !combat.round) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    const title = root?.querySelector?.(".encounter-title, .encounter-controls h3, h3.encounter-title");
    if (title) title.textContent = combat.round === s.round ? "Surprise round (round 0)" : `Round ${displayRound(combat)}`;
    if (combat.round === s.round) for (const li of root.querySelectorAll?.("[data-combatant-id]") ?? []) if (!s.openers.includes(li.dataset.combatantId)) li.classList.add("fs-waiting-round");
  });
}

registerSurprise({ opening: noteOpeningAttack });
