/**
 * Asking a character's player a question, on whichever client is theirs (Mental reactions, Order/Chaos charges, Tenets, Wards). `askFor` shows a dialog
 * locally or over the socket and gives the answer back; `runOnOwner` runs an ability on its owner's client. Switched-off reactions (`reactions.mjs`) are
 * never asked. This sits below `charges.mjs` and `wonders.mjs` so that neither needs the other to ask a question; `wonders.mjs` hands over the function
 * that runs an ability (`setActRunner`).
 */
import { isDeclined } from "./reactions.mjs";

const DialogV2 = () => foundry.applications.api.DialogV2;
const SOCKET = "system.flowstate";

let runActHook = null;
/** wonders.mjs: the function that runs an ability (a button's act) for its owner. */
export const setActRunner = fn => { runActHook = fn; };

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

/**
 * The user who should answer for this actor: its player (an active non-GM owner, us first if that's us), even when the GM's client is the one running the
 * code (the GM owns everything, so being an owner is not enough); else us if we own it, else the GM.
 */
export function answeringUser(actor) {
  const users = globalThis.game?.users;
  if (!users) return globalThis.game?.user ?? null;
  // An unlinked token is a copy of its world actor: the player's ownership of the original counts for it too.
  const base = actor?.token?.baseActor ?? null;
  const owns = u => !!(actor?.testUserPermission?.(u, "OWNER") || base?.testUserPermission?.(u, "OWNER"));
  const players = [...users].filter(u => u.active && !u.isGM && owns(u));
  if (players.length) return players.find(u => u.id === globalThis.game.user?.id) ?? players[0];
  if (actor?.isOwner) return globalThis.game?.user ?? null;
  return users.activeGM ?? [...users].find(u => u.isGM && u.active) ?? null;
}

/**
 * Every creature in play, once each: the actors of the tokens on the scene, plus world actors that have no token there. (An unlinked token is a copy of
 * its world actor, so listing both used to ask the same question twice, the second time of a copy nobody owns.)
 */
export function everyActor() {
  const tokenActors = [...new Set((globalThis.canvas?.tokens?.placeables ?? []).map(t => t.actor).filter(Boolean))];
  const represented = new Set(tokenActors.map(a => a.token?.baseActor?.id ?? a.id));
  return [...tokenActors, ...[...(globalThis.game?.actors ?? [])].filter(a => !represented.has(a.id))];
}

/**
 * The creatures on the scene being played: what a Tenet that watches for "a creature within 100 ft" looks at (Infuse, Empower, Dampen). A character
 * who isn't on the scene can't see the fight, so isn't asked. With no scene at all (no canvas), everyone.
 */
export function actorsInPlay() {
  const placeables = globalThis.canvas?.tokens?.placeables;
  if (!placeables) return everyActor();
  return [...new Set(placeables.map(t => t.actor).filter(Boolean))];
}

const pending = new Map();
let reqCounter = 0;

/**
 * One popup per question on a client: while a dialog is open, the same question (same title and text) asked again, by this client or by another one
 * over the socket, joins it and shares its answer instead of opening a second window. A question asked twice by two clients is shown to one player once.
 */
const inflight = new Map();
const questionKey = spec => `${spec?.title ?? ""}|${spec?.html ?? ""}`;
function askOnce(spec) {
  const key = questionKey(spec);
  if (inflight.has(key)) return inflight.get(key);
  const p = Promise.resolve(showChoices(spec)).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
/** The same ability sent to this client twice within a couple of seconds runs once. */
const recentRuns = new Map();
function runOnce(act) {
  const key = JSON.stringify(act), now = Date.now();
  for (const [k, t] of recentRuns) if (now - t > 3000) recentRuns.delete(k);
  if (recentRuns.has(key)) return null;
  recentRuns.set(key, now);
  return runActHook ? runActHook(act) : null;
}

/** Ask `actor`'s player to answer a dialog: locally if that's us, over the socket otherwise. Gives up (null) after a minute. */
export async function askFor(actor, spec) {
  if (isDeclined(actor, spec?.react)) return null;                         // the player switched this reaction off in their Action List: no popup, counts as "no"
  const user = answeringUser(actor);
  if (!user || user.id === game.user.id) return askOnce(spec);
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
  if (!user || user.id === game.user.id) return runOnce(act);
  game.socket.emit(SOCKET, { action: "mentalRun", to: user.id, act });
}

/** Wire the socket (every client answers dialogs addressed to it and receives answers to its own). */
export function listen() {
  game.socket.on(SOCKET, async data => {
    if (data?.action === "chargeAsk" && data.to === game.user.id) {
      const answer = await askOnce(data.spec);
      game.socket.emit(SOCKET, { action: "chargeAnswer", to: data.from, reqId: data.reqId, answer });
    } else if (data?.action === "mentalRun" && data.to === game.user.id) {
      await runOnce(data.act);
    } else if (data?.action === "chargeAnswer" && data.to === game.user.id) {
      pending.get(data.reqId)?.(data.answer ?? null);
      pending.delete(data.reqId);
    }
  });
}

