/**
 * Falling and Flight (Rules, Ch10): unsupported creatures accrue Gravity Force at the start of each of their turns (Max HP × the world's gravity,
 * growing each round up to Terminal Velocity), resolved through the Force rules; Lift can hold them up. A creature generating its own Lift that takes
 * a big hit has to spend 3 RP to stabilize or it begins falling. There is no elevation on the scene, so the table says how far the ground is.
 */
import { post, setStatus, setActorFlag, requestDamage, damageOutcome, damageOutcomeHTML, forceCap, spendPoints, inActiveCombat, canSpend, registerFlight } from "./actions.mjs";
import { gravityForce, fallFeet, liftBand, forceDamage, TERMINAL_ROUNDS } from "./rules.mjs";

const esc = s => foundry.utils.escapeHTML?.(String(s)) ?? String(s);
const DialogV2 = () => foundry.applications.api.DialogV2;
export const gravityG = () => { try { return Number(game.settings.get("flowstate", "gravity")); } catch (err) { return 1; } };

export const isFalling = actor => !!actor?.statuses?.has("falling");
const lift = actor => Math.max(0, actor?.system?.lift ?? 0);

/** Start falling (unsupported, or failed to stabilize). */
export async function startFalling(actor, why = "") {
  if (!actor || isFalling(actor)) return;
  await setStatus(actor, "falling", true);
  await setActorFlag(actor, "fall", { rounds: 0 });
  await post(actor, { title: `${esc(actor.name)} — Falling`, body: `<div class="fs-result"><i class="fa-solid fa-arrow-down"></i> ${esc(actor.name)} begins to fall${why ? ` (${esc(why)})` : ""}. At the start of each of their turns they accrue Gravity Force.</div>` });
}
export async function stopFalling(actor) {
  await setStatus(actor, "falling", false);
  await setActorFlag(actor, "fall", null);
}

/** 3 RP to stabilize (Action List, or in answer to the prompt). */
export async function stabilize(actor) {
  if (!isFalling(actor) && !(lift(actor) > 0)) return ui.notifications.info(`${actor.name} isn't flying or falling.`);
  if (!(await spendPoints(actor, "rp", 3, "stabilizing"))) return;
  await stopFalling(actor);
  await post(actor, { title: `${esc(actor.name)} — Stabilize`, body: `<div class="fs-result">${esc(actor.name)} stabilizes (3 RP).</div>` });
}

/**
 * A creature generating Lift took damage of at least a tenth of its Max HP, or was hit by Force enough to push it: it spends 3 RP or begins falling.
 * Runs on the owner's client.
 */
export async function flightCheck(actor, reason) {
  if (!actor || actor.type === "pile" || !(lift(actor) > 0) || isFalling(actor) || !actor.isOwner) return;
  const can = canSpend(actor, "rp", 3);
  const yes = can && await DialogV2().confirm({ window: { title: "Stabilize" }, rejectClose: false, content: `<p>${esc(reason)}: spend <strong>3 RP</strong> to stabilize, or ${esc(actor.name)} begins falling?</p>` });
  if (yes && (await spendPoints(actor, "rp", 3, "stabilizing"))) return post(actor, { title: `${esc(actor.name)} — Stabilize`, body: `<div class="fs-result">${esc(actor.name)} stabilizes (3 RP).</div>` });
  await startFalling(actor, can ? "didn't stabilize" : "no RP to stabilize");
}
/** Damage landed: a hit of at least 1/10 of Max HP knocks a flyer off balance. */
export const afterDamage = (actor, amount) => (amount >= Math.floor((actor.system.hp?.max ?? 0) / 10) && amount > 0 ? flightCheck(actor, `${esc(actor.name)} took ${amount} damage (a tenth of their Max HP or more)`) : null);

/** The start of a falling creature's turn: accrue Gravity Force and fall. Runs on the GM (or whoever runs the turn change). */
export async function turnStart(actor) {
  if (!isFalling(actor)) return;
  const fall = actor.getFlag("flowstate", "fall") ?? { rounds: 0 };
  const rounds = (fall.rounds ?? 0) + 1;
  const size = actor.system.size ?? 3;
  const G = gravityG();
  const force = gravityForce({ gravity: G, maxHp: actor.system.hp.max, rounds, size });
  const band = liftBand(lift(actor), force);
  if (band === "full") {            // enough Lift: no longer pulled down, but they must have stabilized to hold it
    await post(actor, { title: `${esc(actor.name)} — Falling`, body: `<div class="fs-notes">${esc(actor.name)}'s Lift (${lift(actor)}) is at least the Gravity Force (${force}): they can stabilize (3 RP) to stop falling.</div>` });
    await setActorFlag(actor, "fall", { rounds });
    return;
  }
  const slow = band === "slow";
  const feet = slow ? 10 : fallFeet(force, lift(actor));
  const ans = await DialogV2().prompt({ window: { title: `${actor.name} falls` }, rejectClose: false,
    content: `<p>Round ${rounds} of falling: Gravity Force <strong>${force}</strong> (${rounds >= (TERMINAL_ROUNDS[size] ?? 2) ? "Terminal Velocity" : `${G} G × Max HP × ${Math.min(rounds, TERMINAL_ROUNDS[size] ?? 2)}`})${lift(actor) ? `, Lift ${lift(actor)}` : ""} → <strong>${feet} ft</strong>${slow ? " (slow, safe fall: 10 ft a round)" : ""}.</p>
      <div class="fs-field"><label>How far to the ground (ft)? <small>leave blank if it's farther than that</small></label><input type="number" name="ground" min="0"></div>`,
    ok: { label: "Fall", callback: (event, button) => button.form.elements.ground.value } });
  const ground = ans === "" || ans === undefined || ans === null ? null : Number(ans);
  if (ground === null || feet < ground) {
    await setActorFlag(actor, "fall", { rounds });
    return post(actor, { title: `${esc(actor.name)} — Falling`, body: `<div class="fs-result">${esc(actor.name)} falls <strong>${feet} ft</strong> (Gravity Force ${force}).${ground !== null ? ` ${ground - feet} ft to the ground.` : ""}</div>` });
  }
  // Landing: the rest of the fall is untraveled distance, which hits as Force damage (3 × feet). Size 1 takes none; slow falls are safe.
  const untraveled = Math.max(0, feet - ground);
  let html = `<div class="fs-result"><i class="fa-solid fa-arrow-down"></i> ${esc(actor.name)} falls ${feet} ft and lands after ${ground} ft.</div>`;
  if (slow || size <= 1 || untraveled <= 0) html += `<div class="fs-notes">${slow ? "A slow, safe landing" : size <= 1 ? "Size 1 creatures take no fall damage" : "No distance left over"}: no damage.</div>`;
  else {
    const cap = await forceCap(actor), raw = forceDamage(untraveled), damage = Math.min(raw, cap);
    html += `<div class="fs-notes">${untraveled} ft untraveled × 3 = ${raw}${damage < raw ? ` (capped at ${cap})` : ""}.</div>${damageOutcomeHTML(actor, damage, "physical", await damageOutcome(actor, damage, "physical"))}`;
    await requestDamage(actor, damage, "physical", 0, null, { silent: true });
  }
  await stopFalling(actor);
  await post(actor, { title: `${esc(actor.name)} — Landing`, body: html });
}

registerFlight(afterDamage, flightCheck);
