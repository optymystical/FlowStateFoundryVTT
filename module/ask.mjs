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

/** Show a small options dialog on this client and return its values (null if closed). `id` lets the GM's prompt list close it from outside. */
export async function showChoices({ title, html, ok = "Use" }, id = null) {
  return DialogV2().prompt({ window: { title }, content: `<div class="fs-cast">${html}</div>`, ok: { label: ok, callback: (event, button) => formValues(button.form) }, rejectClose: false,
    render: (event, dialog) => { if (id) dialogs.set(id, { dialog, title }); } });
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

/** Questions asked of someone else, waiting for their answer: id → { resolve, to }. There is no time limit: the GM's prompt list (below) cancels a stuck one. */
const pending = new Map();
let reqCounter = 0;
const newId = () => `${game.user.id}:${++reqCounter}`;

/* -------------------------------------------- */
/*  The GM's list of open prompts               */
/* -------------------------------------------- */

/**
 * Every question that is waiting for an answer right now, kept by each GM client ({ id, title, about, to, toName, from, fromName, startedAt }), so the GM
 * can see what a fight is waiting on and cancel it. `prompts.mjs` shows it. Whoever asks announces the question and its end to the GMs over the socket.
 */
const records = new Map();
const listeners = new Set();
const changed = () => { for (const fn of listeners) { try { fn(); } catch (err) { console.error(err); } } };
/** How long before a waiting question opens the GM's list by itself. */
export const STUCK_MS = 30000;
export const openPrompts = () => [...records.values()].sort((a, b) => a.startedAt - b.startedAt);
export function onPromptsChanged(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function track(record) {
  records.set(record.id, record);
  changed();
  setTimeout(() => { if (records.has(record.id)) globalThis.Hooks?.callAll?.("flowstatePromptStuck", records.get(record.id)); }, STUCK_MS);
}
function untrack(id) { if (records.delete(id)) changed(); }
const announceOpen = record => { if (game.user.isGM) track(record); else game.socket.emit(SOCKET, { action: "promptOpen", record }); };
const announceClose = id => { if (game.user.isGM) untrack(id); else game.socket.emit(SOCKET, { action: "promptClose", id }); };

/** Dialogs open on this client, by prompt id: { dialog, title }. */
const dialogs = new Map();
/** Close a prompt on this client: the dialog (it answers "no"), and our own wait for someone else's answer. */
function closeHere(id, title = null) {
  const shown = dialogs.get(id);
  if (shown) { try { shown.dialog.close(); } catch (err) { /* already closed */ } }
  else if (title) {
    // No handle (Foundry didn't hand the dialog over): close an open dialog of ours with the same title.
    try { for (const app of foundry.applications.instances?.values?.() ?? []) if (app instanceof DialogV2() && app.title === title) app.close(); } catch (err) { /* nothing to close */ }
  }
  const waiting = pending.get(id);
  if (waiting) { pending.delete(id); waiting.resolve(null); }
}
/** GM: cancel an open prompt everywhere. Whoever was asked sees the window close, and whoever asked carries on as if they had said no. */
export function cancelPrompt(id) {
  const title = records.get(id)?.title ?? null;
  closeHere(id, title);
  game.socket.emit(SOCKET, { action: "promptCancel", id, title });
  untrack(id);
}
/** A user went offline: whatever we were waiting on them for is answered "no", and their prompts leave the list. */
export function userLeft(user) {
  for (const [id, w] of [...pending]) if (w.to === user.id) { pending.delete(id); w.resolve(null); announceClose(id); }
  for (const r of [...records.values()]) if (r.to === user.id || r.from === user.id) untrack(r.id);
}

/**
 * One popup per question on a client: while a dialog is open, the same question (same title and text) asked again, by this client or by another one
 * over the socket, joins it and shares its answer instead of opening a second window. A question asked twice by two clients is shown to one player once.
 * `record` (when we are the one asking) is announced to the GMs while the dialog is open; `id` names the dialog for cancelling.
 */
const inflight = new Map();
const questionKey = spec => `${spec?.title ?? ""}|${spec?.html ?? ""}`;
function askOnce(spec, { record = null, id = record?.id ?? null } = {}) {
  const key = questionKey(spec);
  if (inflight.has(key)) return inflight.get(key);
  if (record) announceOpen(record);
  const p = Promise.resolve(showChoices(spec, id)).finally(() => { inflight.delete(key); if (id) dialogs.delete(id); if (record) announceClose(record.id); });
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

/**
 * Ask `actor`'s player to answer a dialog: locally if that's us, over the socket otherwise. It waits until they answer: there is no timer, so a stuck
 * question shows in the GM's prompt list (opened automatically after half a minute), where it can be cancelled, and one asked of a user who goes
 * offline is answered "no".
 */
export async function askFor(actor, spec) {
  if (isDeclined(actor, spec?.react)) return null;                         // the player switched this reaction off in their Action List: no popup, counts as "no"
  const user = answeringUser(actor);
  const id = newId();
  const record = { id, title: spec?.title ?? "Question", about: actor?.name ?? "", to: user?.id ?? game.user.id, toName: user?.name ?? game.user.name, from: game.user.id, fromName: game.user.name, startedAt: Date.now() };
  if (!user || user.id === game.user.id) return askOnce(spec, { record });
  announceOpen(record);
  try {
    return await new Promise(resolve => {
      pending.set(id, { resolve, to: user.id });
      game.socket.emit(SOCKET, { action: "chargeAsk", to: user.id, from: game.user.id, reqId: id, spec });
    });
  } finally { announceClose(id); }
}

/** Run a button action (an ability or Tenet) as that character's player: here if it's ours, otherwise over the socket. */
export async function runOnOwner(actor, act) {
  const user = answeringUser(actor);
  if (!user || user.id === game.user.id) return runOnce(act);
  game.socket.emit(SOCKET, { action: "mentalRun", to: user.id, act });
}

/** Wire the socket (every client answers dialogs addressed to it and receives answers to its own; GM clients also keep the list of open prompts). */
export function listen() {
  game.socket.on(SOCKET, async data => {
    if (data?.action === "chargeAsk" && data.to === game.user.id) {
      const answer = await askOnce(data.spec, { id: data.reqId });
      game.socket.emit(SOCKET, { action: "chargeAnswer", to: data.from, reqId: data.reqId, answer });
    } else if (data?.action === "mentalRun" && data.to === game.user.id) {
      await runOnce(data.act);
    } else if (data?.action === "chargeAnswer" && data.to === game.user.id) {
      const waiting = pending.get(data.reqId);
      pending.delete(data.reqId);
      waiting?.resolve(data.answer ?? null);
    } else if (data?.action === "promptOpen" && game.user.isGM && data.record?.id) {
      track(data.record);
    } else if (data?.action === "promptClose" && game.user.isGM) {
      untrack(data.id);
    } else if (data?.action === "promptCancel") {
      closeHere(data.id, data.title ?? null);
      untrack(data.id);
    }
  });
}
