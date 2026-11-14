/**
 * Consumables (Foundry side; the rules are consumables-rules.mjs): drinking and giving potions, the bonus Energy pool, the Festival Token, and the
 * timed conditions (Infected lasts a day; heat damage clears it, see `applyDamage`).
 */
import { post, spendPoints, requestGM, inActiveCombat, tokenDistance, attackerToken, setActorFlag } from "./actions.mjs";
import { POTIONS, POTION_AP, TOKEN, TOKEN_KEY, TOKEN_CHECKS, BONUS_SECONDS, BONUS_ROUNDS, potionAmount, spendBonusFirst, bonusExpired, tokenUses } from "./consumables-rules.mjs";
import { healingDown, reevaluate } from "./arcana.mjs";
import { notCreature } from "./kinds.mjs";
import { esc, select, DialogV2 } from "./html.mjs";
import { codexId } from "./codex.mjs";

/** Conditions that end on their own after a time (seconds of world time). */
export const TIMED_STATUSES = { infected: 86400 };

const potionOf = item => (item?.type === "gear" && item.system?.use === "potion" ? POTIONS[item.system.potion] ?? null : null);
const isToken = item => item?.type === "gear" && item.system?.use === "token";
const write = (actor, data) => (actor.isOwner ? actor.update(data) : requestGM("updateActor", { uuid: actor.uuid, data }));
const card = (actor, title, html) => post(actor, { title: `${esc(actor.name)} — ${esc(title)}`, body: html });

/* -------------------------------------------- */
/*  Action List rows                            */
/* -------------------------------------------- */

/** The Items group of the Action List: each potion (drink, give) and each Festival Token with uses left. */
export function actionRows(actor) {
  const rows = [];
  const cost = inActiveCombat(actor) ? `${POTION_AP} AP` : "";
  const used = !!actor.getFlag?.("flowstate", "potionUsed");
  for (const item of actor.items ?? []) {
    const p = potionOf(item);
    if (p && (item.system.quantity ?? 0) > 0) {
      const what = p.kind === "energy" ? `+${potionAmount(p, { energyMax: actor.system.energy?.max })} bonus Energy for 1 minute` : `+${potionAmount(p, { restHeal: actor.system.derived?.restHeal })} health`;
      rows.push({ label: `Drink: ${item.name}`, detail: `${what}${used ? " (already had a potion since the last rest)" : ""} · ${item.system.quantity} left`, cost: cost || "Free",
        action: "consumable", op: "drink", itemId: item.id, icon: "fa-solid fa-flask", codex: item.system.base ? codexId.item(item.system.base) : undefined });
      rows.push({ label: `Give: ${item.name}`, detail: "To the targeted creature within your reach (their one potion per rest)", cost: cost || "Free",
        action: "consumable", op: "give", itemId: item.id, icon: "fa-solid fa-hand-holding-medical" });
    }
    if (isToken(item)) {
      const uses = tokenUses(item.system), kind = TOKEN_CHECKS[item.system.checkType];
      if (!uses) continue;
      rows.push({ label: `${item.name}${kind ? `: ${kind}` : ""}`, detail: kind ? `Advantage on your next ${kind.toLowerCase()} · ${uses} use${uses === 1 ? "" : "s"} left` : "Not set to a kind of roll yet: pick one",
        cost: "Free", action: "consumable", op: "token", itemId: item.id, icon: "fa-solid fa-coins", codex: codexId.item(TOKEN_KEY) });
    }
  }
  const edge = actor.getFlag?.("flowstate", "edge") ?? [];
  if (Array.isArray(edge) && edge.length) rows.push({ label: "Advantage ready", detail: `Next ${edge.map(k => TOKEN_CHECKS[k] ?? k).join(", ").toLowerCase()} (Festival Token)`, cost: "—", action: "consumable", op: "edgeInfo", icon: "fa-solid fa-star", disabled: true });
  return rows;
}

/** An Action List click. */
export function run(actor, op, itemId) {
  const item = actor.items?.get?.(itemId) ?? null;
  if (op === "drink") return usePotion(actor, item);
  if (op === "give") return usePotion(actor, item, { give: true });
  if (op === "token") return useToken(actor, item);
  return null;
}

/* -------------------------------------------- */
/*  Potions                                     */
/* -------------------------------------------- */

/**
 * Drink a potion, or give it to the targeted creature within your reach. 1 AP in combat (the one who acts pays); the drinker's one potion per rest.
 * A dead creature can't drink; a Health potion's healing is lowered by Irradiate like any other; an afraid creature gains no Energy, so an Energy potion
 * is refused for it.
 */
export async function usePotion(actor, item, { give = false } = {}) {
  const p = potionOf(item);
  if (!p || (item.system.quantity ?? 0) < 1) return ui.notifications.warn("That isn't a potion you have.");
  let target = actor;
  if (give) {
    target = [...(game.user.targets ?? [])].map(t => t.actor).find(a => a && a.uuid !== actor.uuid && !notCreature(a)) ?? null;
    if (!target) return ui.notifications.warn("Target the creature to give the potion to.");
    const me = attackerToken(actor), them = target.getActiveTokens?.()[0];
    const reach = actor.system.derived?.size?.melee ?? 5;
    if (me && them && tokenDistance(me, them) > reach) return ui.notifications.warn(`${target.name} isn't within your reach (${reach} ft).`);
  }
  if (target.statuses?.has?.("dead")) return ui.notifications.warn(`${target.name} is dead and can't drink.`);
  if (p.kind === "energy" && target.statuses?.has?.("fear")) return ui.notifications.warn(`${target.name} is afraid and can't gain Energy.`);
  if (target.getFlag?.("flowstate", "potionUsed")) {
    if (!game.user.isGM) return ui.notifications.warn(`${target.name} has already had a potion since their last rest (one per rest).`);
    const ok = await DialogV2().confirm({ window: { title: "One potion per rest" }, rejectClose: false,
      content: `<p>${esc(target.name)} has already had a potion since their last rest. Give them another anyway?</p>` });
    if (!ok) return null;
  }
  if (!(await spendPoints(actor, "ap", POTION_AP, item.name))) return null;

  const data = { "flags.flowstate.potionUsed": true };
  let line;
  if (p.kind === "energy") {
    const n = potionAmount(p, { energyMax: target.system.energy?.max });
    const combat = game.combat?.combatants?.some?.(c => c.actor?.uuid === target.uuid) ? game.combat : null;
    data["system.energy.bonus"] = (target.system.energy?.bonus ?? 0) + n;
    data["flags.flowstate.energyBonus"] = { time: (game.time?.worldTime ?? 0) + BONUS_SECONDS, combat: combat?.id ?? null, round: combat ? (combat.round ?? 0) + BONUS_ROUNDS : 0 };
    line = `${esc(target.name)} gains <strong>${n}</strong> bonus Energy (${(target.system.energy?.value ?? 0)} + ${data["system.energy.bonus"]}): it can go past the maximum, is spent first, and lasts 1 minute (${BONUS_ROUNDS} rounds) or until used.`;
  } else {
    const hp = target.system.hp.value, max = target.system.hp.max;
    const n = Math.max(0, potionAmount(p, { restHeal: target.system.derived?.restHeal }) - healingDown(target));
    const next = Math.max(hp, Math.min(max, hp + n));
    data["system.hp.value"] = next;
    line = `${esc(target.name)} regains <strong>${next - hp}</strong> health (${next}/${max}).`;
  }
  await write(target, data);
  if (p.kind !== "energy") await reevaluate(target);
  const left = (item.system.quantity ?? 1) - 1;
  if (left > 0) await item.update({ "system.quantity": left }); else await item.delete();
  return card(actor, item.name, `<div class="fs-result"><i class="fa-solid fa-flask"></i> ${target === actor ? `${esc(actor.name)} drinks it` : `${esc(actor.name)} gives it to ${esc(target.name)}`}. ${line}</div>`);
}

/**
 * Bonus first: an update that lowers a creature's Energy takes it from the bonus pool before its own (an update that writes the pool itself is left
 * alone). Every spend goes through an update, so this covers all of them.
 */
function bonusFirst(actor, changes) {
  const next = foundry.utils.getProperty(changes, "system.energy.value");
  if (next === undefined || foundry.utils.hasProperty(changes, "system.energy.bonus")) return;
  const bonus = actor.system?.energy?.bonus ?? 0;
  if (!bonus) return;
  const from = actor._source?.system?.energy?.value ?? actor.system.energy.value;
  if (next >= from) return;
  const r = spendBonusFirst(from, next, bonus);
  foundry.utils.setProperty(changes, "system.energy.value", r.value);
  foundry.utils.setProperty(changes, "system.energy.bonus", r.bonus);
}

/** The creatures in play that could hold a bonus pool or a timed condition: the world's actors and the scene's unlinked tokens. */
function creaturesInPlay() {
  const out = new Map();
  for (const a of game.actors ?? []) out.set(a.uuid, a);
  for (const t of globalThis.canvas?.scene?.tokens ?? []) if (t.actor && !t.actorLink) out.set(t.actor.uuid, t.actor);
  for (const c of game.combat?.combatants ?? []) if (c.actor) out.set(c.actor.uuid, c.actor);
  return [...out.values()].filter(a => !notCreature(a));
}

/** Empty a creature's bonus pool if it has run out (`now`: { time, combatId, round }). */
async function expireBonus(actor, now, { force = false } = {}) {
  if (!(actor.system?.energy?.bonus > 0)) return;
  const state = actor.getFlag?.("flowstate", "energyBonus") ?? null;
  if (!force && !bonusExpired(state, now)) return;
  await actor.update({ "system.energy.bonus": 0, "flags.flowstate.energyBonus": null });
  await card(actor, "Bonus Energy", `<div class="fs-notes">The potion's bonus Energy has run out.</div>`);
}

/** At the start of a creature's turn in a combat (FlowStateCombat): its bonus pool runs out 10 rounds after it was filled. */
export async function turnStart(combat, actor) {
  if (!actor) return;
  await expireBonus(actor, { time: game.time?.worldTime ?? 0, combatId: combat?.id ?? null, round: combat?.round ?? 0 });
}

/* -------------------------------------------- */
/*  Festival Token                              */
/* -------------------------------------------- */

/** Spend a use: Advantage on your next roll of the token's kind (pick the kind first if it isn't set). At 0 uses it stays as a keepsake. */
export async function useToken(actor, item) {
  if (!isToken(item)) return null;
  const uses = tokenUses(item.system);
  if (!uses) return ui.notifications.info(`${item.name} has no uses left: it's a keepsake now.`);
  let kind = item.system.checkType;
  if (!TOKEN_CHECKS[kind]) {
    const vals = await DialogV2().prompt({ window: { title: `${item.name}: which roll?` }, rejectClose: false,
      content: `<div class="form-group"><label>Set to</label>${select("kind", Object.entries(TOKEN_CHECKS), "perception")}</div>`,
      ok: { label: "Set", callback: (event, button) => button.form.elements.kind.value } });
    if (!vals || !TOKEN_CHECKS[vals]) return null;
    kind = vals;
    await item.update({ "system.checkType": kind });
  }
  const edge = actor.getFlag?.("flowstate", "edge") ?? [];
  await setActorFlag(actor, "edge", [...(Array.isArray(edge) ? edge : []), kind]);
  await item.update({ "system.charges": uses - 1 });
  return card(actor, item.name, `<div class="fs-result"><i class="fa-solid fa-coins"></i> Advantage on ${esc(actor.name)}'s next <strong>${esc(TOKEN_CHECKS[kind].toLowerCase())}</strong>. ${uses - 1 ? `${uses - 1} use${uses - 1 === 1 ? "" : "s"} left.` : "No uses left: it's a keepsake now."}</div>`);
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

export function register() {
  Hooks.on("preUpdateActor", (actor, changes) => { bonusFirst(actor, changes); });
  // A timed condition (Infected) is stamped with when it ends.
  Hooks.on("preCreateActiveEffect", (effect, data) => {
    const s = [...(data.statuses ?? effect.statuses ?? [])].find(x => TIMED_STATUSES[x]);
    if (s && !data.flags?.flowstate?.until) effect.updateSource({ "flags.flowstate.until": (game.time?.worldTime ?? 0) + TIMED_STATUSES[s] });
  });
  // The GM ends what has run out as world time passes: bonus pools outside their combat, and timed conditions.
  Hooks.on("updateWorldTime", async worldTime => {
    if (!game.user.isActiveGM) return;
    for (const a of creaturesInPlay()) {
      await expireBonus(a, { time: worldTime, combatId: game.combat?.id ?? null, round: game.combat?.round ?? 0 });
      for (const e of [...(a.effects ?? [])]) {
        const until = e.flags?.flowstate?.until;
        if (until && worldTime >= until && [...(e.statuses ?? [])].some(x => TIMED_STATUSES[x])) await e.delete();
      }
    }
  });
  // A combat that ends leaves its pools to world time; one that's deleted before they run out doesn't keep them past the minute.
  Hooks.on("deleteCombat", async combat => {
    if (!game.user.isActiveGM) return;
    for (const c of combat.combatants ?? []) {
      const a = c.actor, st = a?.getFlag?.("flowstate", "energyBonus");
      if (a && st?.combat === combat.id) await a.update({ "flags.flowstate.energyBonus": { ...st, combat: null } });
    }
  });
}

export { TOKEN };
