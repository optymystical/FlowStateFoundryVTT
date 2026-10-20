/**
 * What a player's client may ask the GM's client to do over the socket (the GM relay in `actions.mjs`, `GM_ACTIONS`). The relay exists so that a player
 * can affect a creature or item they don't own (damage, conditions, Durability); it must not become a way to edit anything. Every request is checked
 * here: only the fields the system itself writes are accepted, and nothing that changes what a creature *is* (stats, Skill Points, trees, ownership).
 * Pure: no Foundry globals.
 */

/** Fields the system writes on a creature it doesn't own: health, the pools, conditions, and the system's own flags. */
const ACTOR_PATH = /^(system\.(hp\.(value|lost)|ap\.value|rp\.value|energy\.value|conditions\.[A-Za-z]+)|flags\.flowstate\.[\w.]+)$/;
/** ...on an item: Durability, a Carapace, where a Ward is placed, conditions on it, and the system's own flags. */
const ITEM_PATH = /^(system\.(wear|carapace|placedOn|conditions\.[A-Za-z]+)|flags\.flowstate\.[\w.]+)$/;
/** ...on an Active Effect the system made: its numbers, its name and its description. */
const EFFECT_PATH = /^(flags\.flowstate\.spellEffect\.[\w.]+|name|description)$/;

/** Statuses only the GM sets (Half / Full Stealth). */
const GM_ONLY = new Set(["halfStealth", "fullStealth"]);

const isObject = v => !!v && typeof v === "object" && !Array.isArray(v);
const onlyPaths = (data, re) => isObject(data) && Object.keys(data).length > 0 && Object.keys(data).every(k => re.test(k));
const finite = v => typeof v === "number" && Number.isFinite(v);
const word = v => typeof v === "string" && /^[\w.]+$/.test(v) && !/(^|\.)(__proto__|constructor|prototype)(\.|$)/.test(v);

/** Per-action checks for the requests whose payload carries data to write. Actions not listed here take only ids and numbers the GM side looks up itself. */
const CHECKS = {
  updateActor: p => onlyPaths(p.data, ACTOR_PATH),
  updateItem: p => onlyPaths(p.data, ITEM_PATH),
  changeEffect: p => p.data === null || p.data === undefined || onlyPaths(p.data, EFFECT_PATH),
  setActorFlag: p => word(p.key),
  setStatus: p => typeof p.status === "string" && !GM_ONLY.has(p.status) && typeof p.active === "boolean",
  moveToken: p => finite(p.x) && finite(p.y),
  wearItem: p => finite(p.amount),
  shopBuy: p => typeof p.target === "string" && typeof p.buyer === "string" && typeof p.item === "string" && Number.isInteger(p.quantity) && p.quantity >= 1 && p.quantity <= 1000,
  shopRegrade: p => typeof p.target === "string" && typeof p.owner === "string" && typeof p.item === "string" && Number.isInteger(p.grade) && p.grade >= 0 && p.grade <= 1000,
  shopSell: p => typeof p.target === "string" && typeof p.seller === "string" && typeof p.item === "string" && Number.isInteger(p.quantity) && p.quantity >= 1 && p.quantity <= 1000,
  castChange: p => (p.power === undefined || finite(p.power)) && (p.hpLeft === undefined || finite(p.hpLeft)) && (p.damage === undefined || typeof p.damage === "string")
};

/** Is this relayed request one the GM side may carry out? */
export function relayAllowed(action, payload, actions) {
  if (typeof action !== "string" || !Object.prototype.hasOwnProperty.call(actions, action)) return false;
  if (!isObject(payload)) return false;
  const check = CHECKS[action];
  return check ? !!check(payload) : true;
}

/**
 * The document a relayed request writes to: the creature (an item or effect of it counts as the creature), the token or scene, or the chat message.
 * Requests that name nothing return null. Pure.
 */
export function relayKey(payload) {
  const raw = payload?.target ?? payload?.uuid ?? payload?.actor ?? payload?.actorId ?? payload?.sceneId ?? payload?.id ?? null;
  if (typeof raw !== "string") return null;
  return raw.replace(/\.(Item|ActiveEffect)\..*$/, "");
}

/**
 * Run tasks one after another per key, different keys side by side. Two relayed requests for the same creature used to read its health (or RP, or an item's
 * wear) at the same moment and write back from the same stale number, so one of them was lost; queued, the second reads what the first wrote.
 * A task that fails never blocks the ones behind it. Returns `run(key, task) → Promise`.
 */
export function makeQueue() {
  const tails = new Map();
  return (key, task) => {
    if (key === null || key === undefined) return Promise.resolve().then(task);
    const run = (tails.get(key) ?? Promise.resolve()).then(task, task);
    const tail = run.then(() => {}, () => {});
    tails.set(key, tail);
    tail.then(() => { if (tails.get(key) === tail) tails.delete(key); });
    return run;
  };
}
