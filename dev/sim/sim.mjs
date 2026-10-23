// Combat sim (dev only, not loaded by the system): parties of characters against monster groups, played by a simple AI through the
// system's real actions and chat cards in a running world. In the browser console, as a GM:
//   const SIM = (await import("/systems/flowstate/dev/sim/sim.mjs?" + Date.now())).default;
//   SIM.start();                 // every encounter of the pass, in the background (SIM.status shows progress)
//   await SIM.fight("swarm-r1");  // or one fight
// Results collect in SIM.results (one entry per fight). Dialogs are answered headlessly (no window opens), and timers are avoided while
// waiting, so it keeps going in a hidden browser tab.
const V = Date.now();
const R = await import(`/systems/flowstate/dev/sim/roster.mjs?${V}`);
const Act = await import("/systems/flowstate/module/actions.mjs");
const Cat = await import("/systems/flowstate/module/catalog.mjs");
const ab = await import("/systems/flowstate/module/abilities.mjs");
const { WEAPON_TYPES } = await import("/systems/flowstate/module/martial.mjs");
const MR = await import("/systems/flowstate/module/movement-rules.mjs");
const Sheets = await import("/systems/flowstate/module/sheets.mjs");

const SIM = (window.SIM = window.SIM ?? {});
SIM.results = SIM.results ?? [];
SIM.R = R;
SIM.Act = Act;
SIM.status = SIM.status ?? "idle";

/* ---- Waiting without timers (a hidden tab throttles setTimeout to once a second, or once a minute) ---- */

const tick = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
const idle = async ms => { const end = Date.now() + ms; while (Date.now() < end) await tick(); };
async function waitFor(fn, ms = 4000) {
  const end = Date.now() + ms;
  for (;;) {
    let v;
    try { v = fn(); } catch (err) { v = null; }
    if (v) return v;
    if (Date.now() > end) return null;
    await tick();
  }
}
SIM.idle = idle;

/* ---- Logging: dialogs, notifications and errors seen during a fight ---- */

const log = { dialogs: {}, notes: [], errors: [] };
const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };
let hooksOn = false;
function watch() {
  if (hooksOn) return;
  hooksOn = true;
  const N = ui.notifications;
  SIM._note = SIM._note ?? { warn: N.warn.bind(N), error: N.error.bind(N) };
  N.warn = (m, ...r) => { if (SIM.running) log.notes.push({ level: "warn", msg: String(m), who: SIM.acting ?? null }); return SIM._note.warn(m, ...r); };
  N.error = (m, ...r) => { if (SIM.running) log.notes.push({ level: "error", msg: String(m), who: SIM.acting ?? null }); return SIM._note.error(m, ...r); };
  window.addEventListener("error", e => { if (SIM.running) log.errors.push(String(e.error?.stack ?? e.message).slice(0, 600)); });
  window.addEventListener("unhandledrejection", e => { if (SIM.running) log.errors.push(String(e.reason?.stack ?? e.reason).slice(0, 600)); });
  Hooks.on("createChatMessage", m => { if (SIM.running) F?.msgIds?.add(m.id); });
  // A window something opened directly (not through prompt/confirm/wait): note it and press its default button.
  Hooks.on("renderDialogV2", (app, el) => {
    if (!SIM.running) return;
    bump(log.dialogs, `[window] ${app.title ?? app.options?.window?.title ?? "?"}`);
    const root = el instanceof HTMLElement ? el : el?.[0];
    const btn = root?.querySelector('footer button[data-action="ok"], footer button[data-action="yes"], footer button.default, footer button');
    queueMicrotask(() => btn?.click());
  });
}

/* ---- Headless dialogs: the form is built off-screen, filled by the AI, and its OK callback run ---- */

const D = foundry.applications.api.DialogV2;
SIM._dlg = SIM._dlg ?? (window.LT?._orig ?? { prompt: D.prompt.bind(D), confirm: D.confirm.bind(D), wait: D.wait.bind(D) });
SIM.fill = null;         // (title, content, form) => { name: value } for the dialog being answered
// (title, buttons) => the button to press in a wait() dialog. An empty gun: Speedloader if it's affordable, else Quickload as a Pepper shot, else Quickload.
SIM.choose = (title, buttons) => {
  if (!/is empty$/.test(title)) return null;
  const by = a => buttons.find(b => b.action === a);
  const who = game.actors.getName(SIM.acting ?? "") ?? null;
  let pick = (by("speed") && (who?.system?.energy?.value ?? 0) > 30 ? by("speed") : null) ?? by("pepper") ?? by("quick");
  if (who?.getFlag("flowstate", "sim")?.quickload === "cycle") {
    SIM._ql = ((SIM._ql ?? -1) + 1) % 3;
    pick = by(["quick", "pepper", "speed"][SIM._ql]) ?? by("quick");
  }
  if (pick && F) { F.used = F.used ?? {}; bump(F.used, `quickload:${pick.action}`); }
  return pick;
};

const NOT_OPTIONS = new Set(["mode", "weight", "net", "stacks", "item"]);
function fillForm(form, vals) {
  if (!vals) return;
  for (const [k, v0] of Object.entries(vals)) {
    for (const f of form.querySelectorAll(`[name="${k}"]`)) {
      let v = v0;
      if (f.tagName === "SELECT" && Array.isArray(v0)) v = v0.find(x => [...f.options].some(o => o.value === String(x)));
      if (v === undefined || v === null) continue;
      if (f.type === "checkbox") f.checked = !!v;
      else if (f.type === "radio") f.checked = f.value === String(v);
      else if (f.tagName === "SELECT" && ![...f.options].some(o => o.value === String(v))) continue;
      else f.value = v;
      f.dispatchEvent(new Event("change", { bubbles: true }));
      // Tree options the AI took (for the report).
      if (F && !NOT_OPTIONS.has(k) && (f.type === "checkbox" ? f.checked : f.value && f.value !== "0")) { F.used = F.used ?? {}; bump(F.used, `opt:${k}${f.type === "checkbox" ? "" : `=${f.value}`}`); }
    }
  }
}
function headless(kind) {
  return async (opts = {}) => {
    if (!SIM.running) return SIM._dlg[kind]({ ...opts });
    const title = opts.window?.title ?? "";
    bump(log.dialogs, `${kind}: ${title.replace(/^Sim [^—:]*[—:]\s*/, "").replace(/\d+/g, "#")}`);
    const content = String(opts.content ?? "");
    if (kind === "confirm") return SIM.confirm ? SIM.confirm(title, content) : true;
    const form = document.createElement("form");
    form.innerHTML = content;
    const dlg = { element: form, form, close: () => {} };
    try { opts.render?.(new Event("render"), dlg); } catch (err) { log.errors.push(`render ${title}: ${err.message}`); }
    try { fillForm(form, SIM.fill?.(title, content, form)); } catch (err) { log.errors.push(`fill ${title}: ${err.message}`); }
    if (kind === "prompt") {
      const cb = opts.ok?.callback;
      return cb ? cb(new Event("submit"), { form, dataset: { action: "ok" } }, dlg) : true;
    }
    const buttons = opts.buttons ?? [];
    const pick = SIM.choose?.(title, buttons, content) ?? buttons.find(b => b.default) ?? buttons[0];
    if (!pick) return null;
    return pick.callback ? pick.callback(new Event("submit"), { form, dataset: { action: pick.action } }, dlg) : pick.action;
  };
}
D.prompt = headless("prompt"); D.confirm = headless("confirm"); D.wait = headless("wait");

/* ---- Building the actors ---- */

const folderFor = async name => game.folders.find(f => f.type === "Actor" && f.name === name) ?? Folder.create({ name, type: "Actor" });
const bonusOf = sp => Math.floor(sp / 5);

/** Item data for a slot, Graded for its user (Light: Dex, Heavy: Str; armor: Con). */
function weaponData(slot, stats, sp, natural) {
  const stat = (slot.weight === "heavy" ? stats.str : stats.dex) ?? 0;
  const grade = R.gradeFor(stat + bonusOf(sp));
  const d = Cat.itemData(`weapon.${slot.type}.${slot.weight}.${slot.material}`, { grade, system: { equipped: false, twoHanded: !!slot.twoHanded, natural: !!natural } });
  if (!d) throw new Error(`No catalog entry weapon.${slot.type}.${slot.weight}.${slot.material}`);
  return d;
}
function armorData(slot, stats, sp, natural) {
  const grade = R.gradeFor((stats.con ?? 0) + bonusOf(sp));
  const d = Cat.itemData(`armor.${slot.weight}.${slot.material}`, { grade, system: { equipped: true, natural: !!natural } });
  if (!d) throw new Error(`No catalog entry armor.${slot.weight}.${slot.material}`);
  return d;
}

/** One actor from a spec and a loadout. Weapons are held in order while hands last; a grappler keeps a fist free. */
async function makeActor(spec, loadout, { party, folder }) {
  const sp = spec.sp ?? 30;
  const a = await Actor.create({
    name: spec.name, type: party ? "character" : "npc", folder: folder.id,
    system: { stats: R.statBlock(spec.stats), skillPoints: sp, size: spec.size ?? 3, trees: loadout.trees ?? {} },
    prototypeToken: { name: spec.name, actorLink: !!party, disposition: party ? 1 : -1, displayBars: 40, bar1: { attribute: "hp" } },
    flags: { flowstate: { sim: { id: spec.id, role: spec.role ?? "monster", party: !!party, grapple: !!loadout.grapple, stances: loadout.stances !== false, quickload: spec.quickload ?? null } } }
  });
  const natural = !party && spec.natural !== false;
  const slots = loadout.weapons.filter(w => w.type !== "unarmed");
  const items = [armorData(loadout.armor, spec.stats, sp, natural),
    ...slots.map(w => foundry.utils.mergeObject(weaponData(w, spec.stats, sp, natural), { "flags.flowstate.simPrimary": !!w.primary })),
    // Ammunition for guns (natural ones need none).
    ...(natural ? [] : slots.filter(w => WEAPON_TYPES[w.type]?.ranged).map(w => Cat.itemData(`ammo.${w.type}`, { system: { quantity: 100 } })))];
  const made = await a.createEmbeddedDocuments("Item", items.filter(Boolean));
  // Hold the weapons: the primary first, then others while hands are free (a grappler keeps one fist free for Unarmed).
  let hands = loadout.grapple ? 1 : 2;
  const isPrimary = i => (i.getFlag("flowstate", "simPrimary") ? 1 : 0);
  for (const it of made.filter(i => i.type === "weapon" && i.system.weaponType !== "unarmed").sort((x, y) => isPrimary(y) - isPrimary(x))) {
    const need = it.system.twoHanded ? 2 : 1;
    if (need > hands) continue;
    await it.update({ "system.equipped": true });
    if (!it.system.equipped) { log.notes.push({ level: "setup", msg: `${a.name}: ${it.name} couldn't be held`, who: a.name }); continue; }
    hands -= need;
  }
  await a.update({ "system.hp.value": a.system.hp.max, "system.energy.value": a.system.energy.max, "system.ap.value": 6, "system.rp.value": 6 });
  return a;
}

/** Delete the sim's actors, tokens, piles and combats. */
async function clearSim() {
  const scene = game.scenes.getName("Sim Arena");
  for (const c of game.combats.filter(c => c.scene?.id === scene?.id)) await c.delete();
  if (scene?.tokens.size) await scene.deleteEmbeddedDocuments("Token", scene.tokens.map(t => t.id));
  const ids = game.actors.filter(a => a.getFlag("flowstate", "sim") || a.name.startsWith("Sim ") || (a.type === "pile" && a.getFlag("flowstate", "simPile"))).map(a => a.id);
  if (ids.length) await Actor.deleteDocuments(ids);
}

async function arena() {
  let scene = game.scenes.getName("Sim Arena");
  if (!scene) scene = await Scene.create({ name: "Sim Arena", width: 4800, height: 2800, padding: 0, grid: { type: 1, size: 100, distance: 5, units: "ft" }, backgroundColor: "#2b2f2b" });
  if (canvas.scene?.id !== scene.id) { await scene.view(); await waitFor(() => canvas.ready && canvas.scene?.id === scene.id, 15000); await idle(500); }
  return scene;
}

/* ---- The fight ---- */

const sim = a => a?.getFlag?.("flowstate", "sim") ?? {};
const down = a => !a?.system?.hp || a.system.hp.value <= 0 || a.statuses.has("dead") || a.statuses.has("unconscious");
const tokensOf = scene => scene.tokens.contents.filter(t => t.actor && sim(t.actor).id);
const sideOf = t => (sim(t.actor).party ? "party" : "monsters");
const foesOf = (scene, me) => tokensOf(scene).filter(t => sideOf(t) !== sideOf(me) && !down(t.actor));
const alliesOf = (scene, me) => tokensOf(scene).filter(t => sideOf(t) === sideOf(me) && t.id !== me.id && !down(t.actor));
const dist = (a, b) => Act.tokenDistance(a, b);
const reachOf = actor => actor.system.derived?.size?.melee ?? 5;
// Where a token is (its stored position: the animated x/y lag behind a move, and never catch up in a hidden window).
const pos = t => ({ x: t._source?.x ?? t.x, y: t._source?.y ?? t.y });

function setTargets(...docs) {
  for (const t of [...game.user.targets]) t.setTarget(false, { releaseOthers: false, groupSelection: true });
  for (const d of docs) d?.object?.setTarget(true, { releaseOthers: false, groupSelection: true });
}

/** A weapon's attack choices for this actor: AP, the reach in ft, and the dialog's mode. */
function weaponPlan(actor, item) {
  const p = item.system.profile;
  if (!p?.valid || item.system.broken || !item.system.held) return null;
  if (p.ranged) return { item, ap: p.ap, ranged: true, range: p.range, far: p.range * 2, loaded: item.system.loaded, reloadRP: p.reloadRP };
  return { item, ap: p.ap, ranged: false, range: reachOf(actor) * (p.farstrike || 1), throwType: p.throwType };
}

/** Cells (token top-left, px) from which `me` would be within `range` ft of `target`, nearest first. */
function spotsNear(scene, me, target, range) {
  const g = scene.grid.size, w = me.width * g, h = me.height * g, at = pos(target), mine = pos(me);
  const span = Math.ceil(range / scene.grid.distance) + Math.ceil(me.width) + 1;
  const others = scene.tokens.contents.filter(t => t.id !== me.id && sim(t.actor).id && !down(t.actor));          // piles and the fallen don't block
  const out = [];
  for (let dx = -span; dx <= span + Math.ceil(target.width); dx++) for (let dy = -span; dy <= span + Math.ceil(target.height); dy++) {
    const x = Math.round(at.x / g) * g + dx * g, y = Math.round(at.y / g) * g + dy * g;
    if (x < 0 || y < 0 || x + w > scene.width || y + h > scene.height) continue;
    const box = { x, y, width: me.width, height: me.height };
    if (dist(box, target) > range + 0.01) continue;
    if (others.some(o => { const p = pos(o); return x < p.x + o.width * g - 1 && p.x < x + w - 1 && y < p.y + o.height * g - 1 && p.y < y + h - 1; })) continue;
    out.push({ x, y, d: Math.hypot(x - mine.x, y - mine.y) });
  }
  return out.sort((a, b) => a.d - b.d);
}

/** Feet from the token's stored position to a spot, measured the way Foundry measures a move. */
function feetTo(me, x, y) {
  try { return me.measureMovementPath([{ x: me._source.x, y: me._source.y }, { x, y }]).distance; } catch (err) {
    const g = me.parent.grid; return Math.max(Math.abs(x - me._source.x), Math.abs(y - me._source.y)) / g.size * g.distance;
  }
}

/**
 * Walk toward `target` until within `range` ft (a player's drag, so movement costs AP). The GM may overspend AP on a move (the system only
 * warns), so the AI stops where its AP runs out, the way a player's move is cut. Returns the feet moved.
 */
async function approach(actor, me, target, range) {
  const spot = spotsNear(me.parent, me, target, range)[0];
  if (!spot) return 0;
  const from = { x: me._source.x, y: me._source.y };
  if (spot.x === from.x && spot.y === from.y) return 0;
  const max = MR.maxMove(Act.moveLedger(actor), { ...Act.moveParams(actor), ap: actor.system.ap.value });
  let dest = spot;
  if (feetTo(me, spot.x, spot.y) > max + 0.01) {
    const g = me.parent.grid.size, n = Math.ceil(Math.max(Math.abs(spot.x - from.x), Math.abs(spot.y - from.y)) / g);
    dest = null;
    for (let k = n - 1; k >= 1; k--) {
      const x = Math.round((from.x + (spot.x - from.x) * k / n) / g) * g, y = Math.round((from.y + (spot.y - from.y) * k / n) / g) * g;
      if (feetTo(me, x, y) <= max + 0.01) { dest = { x, y }; break; }
    }
    if (!dest || (dest.x === from.x && dest.y === from.y)) return 0;
  }
  try { await me.move([{ x: dest.x, y: dest.y }], { method: "dragging", animate: false }); } catch (err) { log.errors.push(`move ${actor.name}: ${err.message}`); return 0; }
  await waitFor(() => me._source.x !== from.x || me._source.y !== from.y, 1500);
  await idle(150);
  const moved = Math.hypot(me._source.x - from.x, me._source.y - from.y) / me.parent.grid.size * me.parent.grid.distance;
  stat(actor).moved += moved;
  return moved;
}

/* ---- Stats ---- */

let F = null;                 // the fight being run: { id, actors: {uuid: {...}}, items: {uuid: key}, attacks: [] }
const stat = actor => (F.actors[actor.uuid] ??= { name: actor.name, side: sim(actor).party ? "party" : "monsters", role: sim(actor).role, moved: 0, attacks: 0, turns: 0, kills: 0 });
const weaponKey = item => {
  const s = item.system;
  if (s.weaponType === "unarmed") return "Unarmed";
  return `${s.weight === "heavy" ? "Heavy" : "Light"} ${s.weaponType[0].toUpperCase()}${s.weaponType.slice(1)}${s.twoHanded ? " (2H)" : ""}`;
};

/** Attack with `plan` at `target`, then settle everything it set off (defenses, damage, reactions, follow-ups). */
async function attack(actor, me, plan, target, extra = {}) {
  setTargets(target);
  const before = new Set(game.messages.keys());
  const opts = extra.followup ? {} : treeOptions(actor, plan.item, { me, target, pepper: extra.pepper });
  SIM.fill = () => ({ mode: extra.mode ?? (plan.ranged ? (extra.far ? "r2" : "r1") : "strike"), pepper: extra.pepper ?? 0, area: !!extra.area,
    grapple: !!extra.grapple, weight: extra.weight ?? undefined, ...opts, ...(extra.followup ? followupOptions(actor, plan.item, target) : {}) });
  SIM.acting = actor.name;
  try { await Act.rollWeaponAttack(actor, plan.item, extra.followup ?? null); } catch (err) { log.errors.push(`attack ${actor.name}: ${err.stack?.slice(0, 400)}`); }
  const msg = await waitFor(() => game.messages.contents.find(m => !before.has(m.id) && m.getFlag("flowstate", "attack")?.attacker === actor.uuid), 3000);
  if (!msg) return null;
  stat(actor).attacks++;
  F.uses = F.uses ?? {};
  F.uses[plan.item.id] = (F.uses[plan.item.id] ?? 0) + 1;
  await settle();
  return msg;
}

/* ---- Tree options: what the AI ticks in an attack dialog, as far as its Energy goes ---- */

const RESERVE = 20;                                  // Energy the AI keeps back
const minOf = n => Math.floor((Number(n) || 0) / 3);
function effStat(actor, k) { return actor.system.derived?.effective?.[k]?.value ?? 0; }

/** The tree options for an attack (fields a dialog doesn't have are ignored). Selects take a list: the first choice the dialog offers. */
function treeOptions(actor, item, { me = null, target = null, pepper = 0 } = {}) {
  let budget = (actor.system.energy?.value ?? 0) - RESERVE;
  const take = cost => (budget >= cost ? ((budget -= cost), true) : false);
  const p = item?.system?.profile ?? {};
  const min = minOf(p.capped), dexMin = minOf(effStat(actor, "dex")), strMin = minOf(effStat(actor, "str"));
  const crowd = me ? foesOf(me.parent, me).filter(f => dist(me, f) <= reachOf(actor) * (p.farstrike || 1) + 0.01).length : 0;
  const prone = !!target?.actor?.statuses?.has("prone");
  const o = {};
  if (crowd >= 2) { if (take(2 * min)) o.whirlwind = ["blender", "on"]; else if (take(min)) o.whirlwind = "on"; }
  if (crowd >= 2 && take(min)) o.spinCycle = true;
  if (take(Math.floor(min / 2))) o.quickStrike = true;
  if (take(2 * min)) { o.slice = ["both", "pierce"]; o.slam = ["both", "knockback"]; } else if (take(min)) { o.slice = "pierce"; o.slam = "knockback"; }
  if (take(dexMin)) { o.twinFang = ["adv", "str"]; o.twinFangPick = "adv"; }          // Twin Fang is a choice: Advantage (or Strengthened)
  const s = F && actor ? stat(actor) : {};
  const lash = prone || s.lastTech === "kick";
  if (lash ? take(2 * strMin) : take(strMin)) { o.heavyTech = lash ? ["dragon", "kick"] : ["kick", "dragon"]; s.lastTech = lash ? "dragon" : "kick"; }
  if (pepper && take(min)) o.spinDown = true;
  return o;
}

/** Options on a follow-up: Remise (Bladed, Heavy Solitary after a hit) and Jab (Brawling, Heavy Solitary), when Energy allows. */
function followupOptions(actor, item) {
  const p = item?.system?.profile ?? {};
  const e = (actor.system.energy?.value ?? 0) - RESERVE;
  return { remise: e >= minOf(p.capped), jab: e >= minOf(effStat(actor, "str")) };
}

/* ---- Settling the chat: defenses, then every card waiting on a choice, until nothing is left ---- */

const handled = new Set();                            // `${messageId}|${what}` already answered
const recent = (n = 60) => game.messages.contents.slice(-n).filter(m => F.msgIds?.has(m.id));
const buttonsIn = msg => new DOMParser().parseFromString(msg.content ?? "", "text/html");

/** Wait until the chat has been quiet for a moment (a click's handler runs on its own). */
async function quiet(ms = 350, max = 6000) {
  const end = Date.now() + max;
  let n = game.messages.size, since = Date.now();
  while (Date.now() < end) {
    await idle(60);
    if (game.messages.size !== n) { n = game.messages.size; since = Date.now(); }
    else if (Date.now() - since >= ms) return;
  }
}

async function settle(maxIter = 80) {
  // Answer whatever is waiting; only when nothing is, wait for the chat to go quiet once to be sure, and stop if it stays that way.
  let sure = false;
  for (let i = 0; i < maxIter; i++) {
    if (await answerDefense() || await answerCard()) { sure = false; await idle(40); continue; }
    if (sure) return;
    await quiet(300);
    sure = true;
  }
  log.notes.push({ level: "sim", msg: "settle: gave up after many steps", who: SIM.acting });
}

/** The next unanswered defense: Close Quarters or Shift first when offered (and affordable), then Dodge. */
async function answerDefense() {
  for (const msg of recent()) {
    const atk = msg.getFlag("flowstate", "attack");
    if (!atk?.targets?.length) continue;
    const doc = buttonsIn(msg);
    for (let i = 0; i < atk.targets.length; i++) {
      if (Act.findDefense(msg.id, i)) continue;
      const key = `${msg.id}|def${i}`;
      if (handled.has(`${key}|dodge`)) continue;
      const t = await fromUuid(atk.targets[i].uuid);
      if (!t || !sim(t).id) { handled.add(`${key}|dodge`); continue; }
      SIM.acting = t.name;
      const has = c => !!doc.querySelector(`.fs-defend[data-choice="${c}"][data-index="${i}"]`);
      const energy = (t.system.energy?.value ?? 0) - RESERVE;
      let choice = "dodge";
      if (has("closeQuarters") && !handled.has(`${key}|cq`) && energy >= 10) { choice = "closeQuarters"; handled.add(`${key}|cq`); }
      else if (has("shift") && !handled.has(`${key}|shift`) && energy >= 10) { choice = "shift"; handled.add(`${key}|shift`); }
      else handled.add(`${key}|dodge`);
      SIM.fill = () => ({ mode: "dis" });
      note(t, `defend:${choice}`);
      try { await Act.defend(msg, i, choice); } catch (err) { log.errors.push(`defend ${t.name} (${choice}): ${err.stack?.slice(0, 400)}`); }
      return true;
    }
  }
  return false;
}

/** Count something a creature did (by the AI's choice), for the report. */
function note(actor, what) {
  const s = stat(actor);
  s.used = s.used ?? {};
  bump(s.used, what);
  F.used = F.used ?? {};
  bump(F.used, what);
}

/** The owner of a button's row (`data-owner`), as an actor. */
const ownerOf = btn => { const u = btn.closest("[data-owner]")?.dataset.owner; return u ? fromUuidSync(u) : null; };
const rpOf = a => a?.system?.rp?.value ?? 0;
const energyOf = a => (a?.system?.energy?.value ?? 0) - RESERVE;

/** The next card button worth pressing. Each one is considered once. */
async function answerCard() {
  for (const msg of recent()) {
    // Knockback on a hit.
    const kb = msg.getFlag("flowstate", "knockback");
    if (kb?.feet > 0 && !handled.has(`${msg.id}|kb`)) {
      handled.add(`${msg.id}|kb`);
      if (sim(fromUuidSync(kb.attacker)).id) { await pushBack(msg); return true; }
    }
    const doc = buttonsIn(msg);
    const once = (what, fn) => { const k = `${msg.id}|${what}`; if (handled.has(k)) return null; handled.add(k); return fn; };
    // Riposte: take it (Perfect when it's offered and affordable) if the RP is there, else pass so the attacker's follow-ups can go.
    const rip = [...doc.querySelectorAll(".fs-riposte")];
    if (rip.length || doc.querySelector(".fs-no-riposte")) {
      const go = once("riposte", true);
      if (go) {
        const who = ownerOf(rip[0] ?? doc.querySelector(".fs-no-riposte"));
        const pick = rip.find(b => b.dataset.perfect === "1" && energyOf(who) >= 20) ?? rip.find(b => b.dataset.perfect !== "1");
        const item = pick ? fromUuidSync(pick.dataset.item) : null;
        const ap = item?.system?.profile?.unarmed ? 2 : item?.system?.profile?.ap ?? 2;
        SIM.acting = who?.name;
        if (pick && who && rpOf(who) >= ap) {
          note(who, pick.dataset.perfect === "1" ? "perfectRiposte" : "riposte");
          SIM.fill = () => treeOptions(who, item);
          await Act.riposte(msg, { perfect: pick.dataset.perfect === "1", itemUuid: pick.dataset.item || null });
        } else { if (who) note(who, "noRiposte"); await Act.declineRiposte(msg); }
        return true;
      }
    }
    const simple = [
      [".fs-deflect", "deflect", (who) => rpOf(who) >= 1, () => Act.deflect(msg)],
      [".fs-limber", "limber", (who) => energyOf(who) >= 5, (btn) => Act.limber(msg, btn.dataset.actor)],
      [".fs-cut-back", "cutBack", (who) => rpOf(who) >= 2, () => Act.cutBack(msg)],
      [".fs-flurry", "bladeFlurry", (who) => rpOf(who) >= 2 && energyOf(who) >= 10, (btn) => Act.bladeFlurry(msg, btn.dataset.item)],
      [".fs-brawl-extra[data-kind='combo']", "combo", (who) => energyOf(who) >= 15, () => Act.brawlingExtra(msg, "combo")],
      [".fs-brawl-extra[data-kind='flow']", "flowLikeWater", (who) => energyOf(who) >= 15, () => Act.brawlingExtra(msg, "flow")],
      [".fs-mark-shot", "markShot", (who) => rpOf(who) >= 2 + emptyRapidRP(who), async () => { await reloadRapid(fromUuidSync(msg.getFlag("flowstate", "markCard")?.marker ?? "")); return Act.markShot(msg); }],
      [".fs-redirect", "redirect", (who) => energyOf(who) >= 10, null],
      [".fs-dip-move", "dipMoveOffered", () => false, null]
    ];
    for (const [sel, what, ok, run] of simple) {
      const btn = doc.querySelector(sel);
      if (!btn) continue;
      if (!once(what, true)) continue;
      const who = ownerOf(btn) ?? (btn.dataset.actor ? fromUuidSync(btn.dataset.actor) : null);
      if (!who || !sim(who).id) continue;
      if (!ok(who)) { note(who, `${what}:skipped`); continue; }
      SIM.acting = who.name;
      if (what === "redirect") {
        // Into another of the attacker's side next to us (or the nearest of them).
        const me = who.getActiveTokens?.()[0]?.document, att = fromUuidSync(msg.getFlag("flowstate", "defense")?.attacker);
        const into = me ? foesOf(me.parent, me).filter(f => f.actor?.uuid !== att?.uuid).sort((a, b) => dist(me, a) - dist(me, b))[0] : null;
        if (!into) { note(who, "redirect:noTarget"); continue; }
        setTargets(into);
        note(who, what);
        try { await Act.redirect(msg); } catch (err) { log.errors.push(`redirect ${who.name}: ${err.stack?.slice(0, 400)}`); }
        return true;
      }
      note(who, what);
      SIM.fill = () => (what === "bladeFlurry" ? treeOptions(who, who.items.get(btn.dataset.item) ?? fromUuidSync(btn.dataset.item)) : {});
      try { await run(btn); } catch (err) { log.errors.push(`${what} ${who.name}: ${err.stack?.slice(0, 400)}`); }
      return true;
    }
    // A follow-up on offer (Fast, Solitary, Titan Weapon...): take it at the same target or the nearest foe in reach.
    if (msg.getFlag("flowstate", "followupCard") && !handled.has(`${msg.id}|followup`)) {
      handled.add(`${msg.id}|followup`);
      if (await takeFollowup(msg, doc)) return true;
    }
  }
  return false;
}

/** RP to reload a held Rapid weapon that's empty (a Mark shot needs a round in it), and the reload itself. */
const emptyRapid = a => a?.items?.find(i => i.type === "weapon" && i.system.held && i.system.weaponType === "rapid" && !i.system.loaded);
const emptyRapidRP = a => emptyRapid(a)?.system?.profile?.reloadRP ?? 0;
async function reloadRapid(a) {
  const gun = emptyRapid(a);
  if (!gun) return;
  SIM.acting = a.name;
  await Act.reloadWeapon(a, gun);
  stat(a).reloads = (stat(a).reloads ?? 0) + 1;
}

/** Take the first follow-up on a follow-up card (a gun reloads first if it can). */
async function takeFollowup(card, doc) {
  const btn = doc.querySelector(".fs-followup");
  if (!btn) return false;
  const attacker = fromUuidSync(btn.dataset.actor);
  if (!attacker || down(attacker) || !sim(attacker).id) return false;
  const me = attacker.getActiveTokens?.()[0]?.document;
  const item = attacker.items.get(btn.dataset.item);
  const plan = item ? weaponPlan(attacker, item) ?? (item.system.weaponType === "unarmed" ? { item, ranged: false, range: reachOf(attacker) } : null) : null;
  if (!plan || !me) return false;
  if (plan.ranged && !item.system.loaded) {
    if (rpOf(attacker) < plan.reloadRP) { note(attacker, "followup:noRP"); return false; }
    SIM.acting = attacker.name;
    await Act.reloadWeapon(attacker, item);
    stat(attacker).reloads = (stat(attacker).reloads ?? 0) + 1;
    if (!item.system.loaded) return false;
  }
  const src = game.messages.get(card.getFlag("flowstate", "followupCard"))?.getFlag("flowstate", "attack");
  const first = src?.targets?.[0] ? fromUuidSync(src.targets[0].uuid)?.getActiveTokens?.()[0]?.document : null;
  const inReach = t => t && !down(t.actor) && dist(me, t) <= plan.range + 0.01;
  const target = inReach(first) ? first : foesOf(me.parent, me).filter(inReach).sort((a, b) => dist(me, a) - dist(me, b))[0];
  if (!target) return false;
  F.followups = (F.followups ?? 0) + 1;
  await attack(attacker, me, plan, target, {
    mode: src?.opts?.melee === false && !plan.ranged ? "throw" : undefined,
    followup: { net: Number(btn.dataset.net) || 0, label: btn.dataset.label, weight: btn.dataset.weight || null, source: btn.dataset.source || card.getFlag("flowstate", "followupCard"),
      kind: btn.dataset.kind || "", whirlwind: btn.dataset.whirlwind || "", perfect: btn.dataset.perfect === "1", twinFang: btn.dataset.twinFang === "1",
      flowChain: btn.dataset.flowChain === "1", quickStrike: btn.dataset.quickStrike === "1", attackType: btn.dataset.attackType || null }
  });
  return true;
}

/**
 * Use a hit's Knockback: into another foe within the Force's reach (an attack roll; both collide on a hit), else down into the ground for melee
 * fighters and monsters (Force damage, prone if it's at least their height: Advantage for melee) or straight away for ranged and support (peeling).
 */
async function pushBack(card) {
  const info = card.getFlag("flowstate", "knockback");
  if (game.messages.contents.some(m => m.getFlag("flowstate", "knockbackOf") === card.id)) return;
  const attacker = await fromUuid(info.attacker), target = await fromUuid(info.target);
  const me = attacker?.getActiveTokens?.()[0]?.document, tt = target?.getActiveTokens?.()[0]?.document;
  if (!attacker || !target || !me || !tt || down(attacker)) return;
  const role = sim(attacker).role;
  const other = foesOf(me.parent, me).filter(f => f.id !== tt.id && dist(f, tt) <= info.feet).sort((a, b) => dist(a, tt) - dist(b, tt))[0];
  const dir = other ? "into" : down(target) ? "away" : ["ranged", "support"].includes(role) ? "away" : "down";
  setTargets(other ?? null);
  const before = new Set(game.messages.keys());
  SIM.acting = attacker.name;
  SIM.fill = () => ({ dir });
  try { await Act.knockback(card); } catch (err) { log.errors.push(`knockback ${attacker.name}: ${err.stack?.slice(0, 400)}`); return; }
  const s = stat(attacker);
  s.knockbacks = s.knockbacks ?? {};
  bump(s.knockbacks, dir);
  F.knockbacks = F.knockbacks ?? {};
  bump(F.knockbacks, dir);
  // Knocked into someone: that's an attack roll the other creature dodges (the resolver answers it).
  if (dir === "into") await waitFor(() => game.messages.contents.find(m => !before.has(m.id) && m.getFlag("flowstate", "attack")), 3000);
}

/* ---- The Action List at the start and end of a turn (the same rows the sheet and the Token Action HUD run) ---- */

const actionRows = actor => Sheets.buildActionList(actor, Sheets.weaponRows(actor)).flatMap(g => g.actions);

/** Run the first Action List row whose label matches (and isn't already active or disabled). */
async function runRow(actor, re, fill = {}) {
  const row = actionRows(actor).find(r => re.test(r.label) && !/\(active/.test(r.label) && !r.disabled);
  if (!row) return false;
  SIM.acting = actor.name;
  SIM.fill = () => fill;
  const before = actor.system.energy?.value ?? 0;
  try { await Sheets.runActionRow(actor, row); } catch (err) { log.errors.push(`${row.label} ${actor.name}: ${err.stack?.slice(0, 400)}`); return false; }
  await quiet(200, 2000);
  note(actor, row.label.replace(/:.*$/, "").replace(/\s*\(.*$/, ""));
  return (actor.system.energy?.value ?? 0) !== before || true;
}

const tier = (actor, tree) => Number(actor.system.trees?.[tree]) || 0;

/**
 * Start of the AI's turn: Versatility once (Brace for the tank, Shift otherwise), then the stances its trees give while Energy allows: Parry with a
 * Balanced or Bladed weapon (Slip Off, Deflect, Riposte, Perfect Riposte), Brace in Medium armor, Dip or Shatter on a free fist (turn about),
 * and Mark on the nearest foe in Rapid range.
 */
async function stances(actor, me) {
  const s = stat(actor);
  if (tier(actor, "martial-medium-armor") >= 5 && !actor.getFlag("flowstate", "versatility")) await runRow(actor, /^Versatility/, { ability: sim(actor).role === "tank" ? "brace" : "shift" });
  const parryCost = w => w.system.profile?.capped ?? 99;
  if (tier(actor, "martial-theory") >= 1) {
    const guard = actor.items.find(i => i.type === "weapon" && i.system.held && ["balanced", "bladed"].includes(i.system.weaponType) && (i.system.profile?.dice ?? 0) > 0);
    if (guard && energyOf(actor) >= parryCost(guard) + 20) await runRow(actor, new RegExp(`^Parry: ${guard.name.replace(/[()]/g, ".")}`));
  }
  const stancesOn = sim(actor).stances !== false;
  if (stancesOn && tier(actor, "martial-medium-armor") >= 2) {
    const free = actor.getFlag("flowstate", "versatility") === "brace";
    if (free || energyOf(actor) >= effStat(actor, "con") + 30) await runRow(actor, /^Brace/);
  }
  if (stancesOn && tier(actor, "martial-brawling-methods") >= 2) {
    s.fist = s.fist === "Shatter" ? "Dip" : "Shatter";
    const cost = effStat(actor, s.fist === "Dip" ? "dex" : "str");
    if (energyOf(actor) >= cost + 20) await runRow(actor, new RegExp(`^${s.fist}`));
  }
  if (tier(actor, "martial-rapid-weapons") >= 3) {
    const gun = actor.items.find(i => i.type === "weapon" && i.system.held && i.system.weaponType === "rapid");
    const prey = gun ? foesOf(me.parent, me).filter(f => dist(me, f) <= (gun.system.profile?.range ?? 0)).sort((a, b) => dist(me, a) - dist(me, b))[0] : null;
    if (prey && energyOf(actor) >= minOf(gun.system.profile?.capped) + 10) { setTargets(prey); await runRow(actor, /^Mark$/); }
  }
}

/** End of the AI's turn: Eviscerate (Swift T4) if it's on offer, then Recover Energy with the AP left while Energy is low. */
async function endOfTurn(actor) {
  if (tier(actor, "martial-swift-weapons") >= 4 && energyOf(actor) >= 20) await runRow(actor, /^Eviscerate/);
  for (let i = 0; i < 6 && actor.system.ap.value >= 1 && (actor.system.energy?.value ?? 0) < (actor.system.energy?.max ?? 0) * 0.7; i++) {
    const e = actor.system.energy.value;
    SIM.acting = actor.name;
    try { await Act.recoverEnergy(actor); } catch (err) { log.errors.push(`recover ${actor.name}: ${err.message}`); break; }
    await quiet(150, 1500);
    if (actor.system.energy.value === e) break;
    note(actor, "recoverEnergy");
  }
}

/** The AI's turn: stances, then act, then the end of the turn; the chat is settled after each. */
async function takeTurn(actor, me) {
  await stances(actor, me);
  await settle();
  await actTurn(actor, me);
  await settle();
  if (!down(actor)) await endOfTurn(actor);
  await settle();
}

/** Reload, grapple, close in, attack, and throw a spare weapon at a foe out of reach. */
async function actTurn(actor, me) {
  const s = stat(actor);
  s.turns++;
  const role = sim(actor).role;
  for (let step = 0; step < 16; step++) {
    if (down(actor) || over(me.parent)) return;
    const ap = actor.system.ap.value, rp = actor.system.rp.value;
    const foes = foesOf(me.parent, me);
    if (!foes.length) return;
    const weapons = actor.items.filter(i => i.type === "weapon" && i.system.held && i.system.weaponType !== "unarmed").map(i => weaponPlan(actor, i)).filter(Boolean);
    // Reload empty guns while RP lasts.
    // (A Rapid weapon with Quickload, Rapid T1, is fired empty instead: Quickload reloads it.)
    const quick = w => w.ranged && ab.rapid(actor, w.item, 1);
    for (const w of weapons.filter(w => w.ranged && !w.loaded && !quick(w) && rp >= w.reloadRP)) { SIM.acting = actor.name; await Act.reloadWeapon(actor, w.item); s.reloads = (s.reloads ?? 0) + 1; }
    const ready = actor.items.filter(i => i.type === "weapon" && i.system.held && i.system.weaponType !== "unarmed").map(i => weaponPlan(actor, i)).filter(w => w && (!w.ranged || w.loaded || quick(w)));
    const unarmed = actor.items.find(i => i.type === "weapon" && i.system.weaponType === "unarmed");
    const nearest = foes.sort((a, b) => dist(me, a) - dist(me, b))[0];

    // Support: grapple the foe nearest an ally (Heavy Unarmed: damage + grapple), once nothing is held.
    if (sim(actor).grapple && unarmed && ap >= 3 && ab.freeFists(actor) >= 1 && !Act.grappledBy(actor).length) {
      const allies = alliesOf(me.parent, me);
      const prey = foes.filter(f => (f.actor.system.size ?? 3) <= (actor.system.size ?? 3))
        .sort((a, b) => Math.min(...allies.map(x => dist(x, a)), 999) - Math.min(...allies.map(x => dist(x, b)), 999))[0];
      if (prey) {
        const reach = reachOf(actor);
        if (dist(me, prey) > reach + 0.01) { if (!(await approach(actor, me, prey, reach))) { /* fall through to weapons */ } else continue; }
        if (dist(me, prey) <= reach + 0.01) { s.grapples = (s.grapples ?? 0) + 1; if (await attack(actor, me, { item: unarmed, ranged: false, range: reach }, prey, { grapple: true, weight: "heavy" })) continue; }
      }
    }

    // Pick a weapon and target: guns shoot the most hurt foe in range; melee goes for the nearest.
    // Spread the attacks over every weapon held (the least used first, the primary on a tie), so each one gets data. A weapon that rolls
    // no dice (its stat under 10) isn't swung: no player would.
    const used = w => F.uses?.[w.item.id] ?? 0, primary = w => (w.item.getFlag("flowstate", "simPrimary") ? 1 : 0);
    const order = (a, b) => used(a) - used(b) || primary(b) - primary(a);
    const rolls = w => (w.item.system.profile?.dice ?? 1) > 0;
    const gun = ready.filter(w => w.ranged && rolls(w)).sort(order)[0];
    if (gun && ap >= gun.ap) {
      const inRange = foes.filter(f => dist(me, f) <= gun.range + 0.01).sort((a, b) => a.actor.system.hp.value - b.actor.system.hp.value);
      const far = foes.filter(f => dist(me, f) <= gun.far + 0.01).sort((a, b) => dist(me, a) - dist(me, b));
      const target = inRange[0] ?? far[0];
      if (target) {
        const area = !!gun.item.system.profile.area && foes.filter(f => f.id !== target.id && dist(f, target) <= (gun.item.system.profile.area === 2 ? 10 : 5)).length > 0;
        const pepper = gun.item.system.profile.pepper ? 1 : 0;
        if (area) s.areaShots = (s.areaShots ?? 0) + 1;
        const wasLoaded = gun.item.system.loaded, apBefore = actor.system.ap.value;
        if (await attack(actor, me, gun, target, { far: !inRange[0], area, pepper })) continue;
        if (!wasLoaded && (gun.item.system.loaded || actor.system.ap.value < apBefore)) continue;          // Quickload reloaded it (no attack)
        return;
      }
    }
    const melee = ready.filter(w => !w.ranged && rolls(w)).sort(order)[0]
      ?? (unarmed && ab.freeFists(actor) >= 1 ? { item: unarmed, ranged: false, range: reachOf(actor), ap: 2 } : null);          // not while that fist holds a grapple
    if (!melee) {
      if (gun && !gun.loaded) return;                     // out of RP to reload: wait for the next turn
      if (gun && foes.every(f => dist(me, f) > gun.far)) { if (!(await approach(actor, me, nearest, gun.range))) return; continue; }
      return;
    }
    const cost = melee.ap ?? 2;
    if (ap < cost) return;
    const target = role === "tank" || role === "monster" ? nearest
      : foes.filter(f => dist(me, f) <= melee.range + 0.01).sort((a, b) => a.actor.system.hp.value - b.actor.system.hp.value)[0] ?? nearest;
    if (dist(me, target) > melee.range + 0.01) {
      // Out of reach: throw a spare weapon if one is held and the foe is in throw range (once a fight), else walk in.
      const spare = ready.find(w => !w.ranged && w !== melee && w.throwType && !s.threw);
      const throwRange = spare ? { bad: 50, average: 100, good: 200 }[spare.throwType] : 0;
      const speed = actor.system.movement?.speed ?? 30, stepAp = actor.system.movement?.ap ?? 1;
      const reachable = (dist(me, target) - melee.range) <= speed * Math.max(0, Math.floor((ap - cost) / stepAp));
      if (spare && !reachable && dist(me, target) <= throwRange && ap >= 2) {
        s.threw = true;
        if (await attack(actor, me, spare, target, { mode: "throw" })) continue;
      }
      const moved = await approach(actor, me, target, melee.range);
      if (!moved) return;
      continue;
    }
    if (!(await attack(actor, me, melee, target))) return;
  }
}

function over(scene) {
  const t = tokensOf(scene);
  return !t.some(x => sideOf(x) === "party" && !down(x.actor)) || !t.some(x => sideOf(x) === "monsters" && !down(x.actor));
}

/** Place the party on the left and the monsters on the right. */
async function deploy(scene, party, monsters) {
  const place = async (a, x, y) => { const td = await a.getTokenDocument({ x: x * 100, y: y * 100 }); return (await scene.createEmbeddedDocuments("Token", [td.toObject()]))[0]; };
  for (const [i, a] of party.entries()) await place(a, 8, 7 + i * 3);
  let n = 0;
  for (const a of monsters) { const col = 26 + (n % 3) * 2, row = 6 + Math.floor(n / 3) * 3; await place(a, col, row); n++; }
  await idle(300);
}

/** Run one encounter (an id from R.ENCOUNTERS) and add its results to SIM.results. */
SIM.passId = SIM.passId ?? R.PASS;
const passOf = () => R.PASSES[SIM.passId] ?? R.PASSES[R.PASS];
SIM.fight = async function fight(id, { maxRounds = 20 } = {}) {
  const P = passOf();
  const enc = P.encounters.find(e => e.id === id);
  if (!enc) throw new Error(`No encounter ${id}`);
  watch();
  SIM.running = true;
  log.dialogs = {}; log.notes = []; log.errors = [];
  F = { id, pass: P.id, group: enc.group, rotation: enc.rotation + 1, actors: {}, started: Date.now(), msgIds: new Set() };
  handled.clear();
  try {
    SIM.status = `${id}: setting up`;
    await clearSim();
    const scene = await arena();
    const pf = await folderFor("Sim: Party"), mf = await folderFor("Sim: Monsters");
    const party = [];
    for (const p of P.party) party.push(await makeActor(p, p.loadouts[enc.rotation], { party: true, folder: pf }));
    const monsterActors = [];
    for (const k of P.monsters[enc.group].kinds) {
      const a = await makeActor(k, { armor: k.armor, weapons: k.weapons }, { party: false, folder: mf });
      for (let i = 0; i < k.count; i++) monsterActors.push(a);
    }
    await deploy(scene, party, monsterActors);
    // Item keys (a thrown weapon leaves the actor, so they're read now).
    F.items = {};
    for (const t of tokensOf(scene)) for (const i of t.actor.items) if (i.type === "weapon") F.items[i.uuid] = weaponKey(i);
    F.trees = Object.fromEntries(party.map(a => [a.name, a.system.trees]));
    F.gear = Object.fromEntries(party.map(a => [a.name, a.items.filter(i => ["weapon", "armor"].includes(i.type)).map(i => `${i.name}${i.system.equipped ? "" : " (not held)"} G${i.system.grade}`)]));
    F.monsterGear = Object.fromEntries(P.monsters[enc.group].kinds.map(k => { const a = monsterActors.find(m => m.name === k.name); return [k.name, a.items.filter(i => ["weapon", "armor"].includes(i.type)).map(i => i.name)]; }));
    F.hpMax = Object.fromEntries(tokensOf(scene).map(t => [t.actor.uuid, t.actor.system.hp.max]));
    const firstIds = new Set(game.messages.keys());
    // Combat.
    const combat = await Combat.create({ scene: scene.id, active: true });
    await combat.createEmbeddedDocuments("Combatant", tokensOf(scene).map(t => ({ tokenId: t.id, sceneId: scene.id, actorId: t.actorId })));
    await combat.rollAll();
    await combat.startCombat();
    SIM.combat = combat;
    let lastKey = null;
    for (let guard = 0; guard < 600; guard++) {
      if (over(scene) || combat.round > maxRounds) break;
      const c = combat.combatant;
      if (!c) { await combat.nextTurn(); continue; }
      const key = `${combat.round}:${combat.turn}:${c.id}`;
      if (key === lastKey) { await combat.nextTurn(); continue; }
      lastKey = key;
      const actor = c.actor, me = c.token;
      SIM.status = `${id}: round ${combat.round}, ${actor?.name}`;
      if (actor && me && !down(actor)) {
        await waitFor(() => (Number(actor.getFlag("flowstate", "turnStartedAt")) || 0) >= F.started && actor.system.ap.value > 0, 4000);
        await takeTurn(actor, me);
      }
      if (over(scene)) break;
      await combat.nextTurn();
      await idle(200);
    }
    // Results.
    await idle(800);
    SIM.status = `${id}: collecting`;
    const msgs = game.messages.contents.filter(m => !firstIds.has(m.id));
    const result = collect(scene, combat, msgs);
    SIM.results.push(result);
    await combat.delete();
    const del = msgs.map(m => m.id).filter(i => game.messages.has(i));
    if (del.length) await ChatMessage.deleteDocuments(del);
    SIM.status = `${id}: done (${result.winner} in ${result.rounds} rounds)`;
    return result;
  } catch (err) {
    log.errors.push(`fight ${id}: ${err.stack?.slice(0, 800)}`);
    SIM.status = `${id}: crashed: ${err.message}`;
    const result = { id, crashed: err.message, log: structuredClone(log) };
    SIM.results.push(result);
    return result;
  } finally {
    SIM.running = false;
    SIM.fill = null;
  }
};

/** Read the fight back from its chat cards: per weapon and per creature. */
function collect(scene, combat, msgs) {
  const weapons = {};
  const W = k => (weapons[k] ??= { attacks: 0, followups: 0, hits: 0, crits: 0, misses: 0, damage: 0, ap: 0, kills: 0, users: new Set() });
  const dmgByDef = new Map(msgs.filter(m => m.getFlag("flowstate", "damage")).map(m => [m.getFlag("flowstate", "damage").defenseMessage, m]));
  const per = {};
  const P = (uuid, name) => (per[uuid] ??= { name, dealt: 0, taken: 0, hits: 0, attacks: 0 });
  for (const m of msgs) {
    const a = m.getFlag("flowstate", "attack");
    if (!a || !a.opts) continue;
    const key = a.opts.itemUuid ? F.items[a.opts.itemUuid] ?? "?" : a.opts.unarmedWeight ? `Unarmed ${a.opts.unarmedWeight === "heavy" ? "Heavy" : "Light"}` : null;
    if (!key) continue;
    const attackerName = fromUuidSync(a.attacker)?.name ?? a.attacker;
    const w = W(key);
    w.users.add(attackerName.replace(/^Sim /, ""));
    const isFollow = !!m.getFlag("flowstate", "followupOf");
    if (isFollow) w.followups++; else w.attacks++;
    w.ap += Number(a.opts.apCost) || 0;
    P(a.attacker, attackerName).attacks++;
    a.targets.forEach((t, i) => {
      const def = Act.findDefense(m.id, i);
      const r = def?.getFlag("flowstate", "defense")?.result;
      if (!r) return;
      if (r.hit) { w.hits++; P(a.attacker, attackerName).hits++; } else w.misses++;
      if (r.crit) w.crits++;
      const dm = dmgByDef.get(def.id);
      const toHp = Number(dm?.getFlag("flowstate", "damage")?.toHp) || 0;
      w.damage += toHp;
      P(a.attacker, attackerName).dealt += toHp;
      P(t.uuid, t.name).taken += toHp;
    });
  }
  // Armor (and anything else in the way) absorbing hits, from the damage cards' text: "Medium Armor (Hide) absorbed 30 (−30 Durability)".
  const absorbed = {};
  for (const m of msgs.filter(m => m.getFlag("flowstate", "damage"))) {
    const text = (m.content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    for (const [, item, n] of text.matchAll(/((?:Light|Medium|Heavy|Titanic) Armor \([^)]+\)) absorbed (\d+)/g)) {
      const a = (absorbed[item] ??= { hits: 0, absorbed: 0 });
      a.hits++; a.absorbed += Number(n);
    }
  }
  // Kills: the last damage card against a creature that ended the fight down.
  const order = msgs.filter(m => m.getFlag("flowstate", "damage"));
  const creatures = tokensOf(scene).map(t => t.actor);
  const downList = [];
  for (const actor of creatures) {
    if (!down(actor)) continue;
    downList.push(actor.name);
    const last = order.filter(m => m.getFlag("flowstate", "damage").target === actor.uuid).at(-1);
    if (!last) continue;
    const def = game.messages.get(last.getFlag("flowstate", "damage").defenseMessage)?.getFlag("flowstate", "defense");
    const atk = def ? game.messages.get(def.attackMessage)?.getFlag("flowstate", "attack") : null;
    const key = atk?.opts?.itemUuid ? F.items[atk.opts.itemUuid] : atk?.opts?.unarmedWeight ? `Unarmed ${atk.opts.unarmedWeight === "heavy" ? "Heavy" : "Light"}` : null;
    if (key) W(key).kills++;
  }
  const partyLeft = tokensOf(scene).filter(t => sideOf(t) === "party" && !down(t.actor)).length;
  const monstersLeft = tokensOf(scene).filter(t => sideOf(t) === "monsters" && !down(t.actor)).length;
  const gearState = Object.fromEntries(creatures.filter((a, i, all) => all.indexOf(a) === i).map(a => [a.name, a.items.filter(i => ["weapon", "armor"].includes(i.type) && i.system.weaponType !== "unarmed")
    .map(i => `${i.name}: ${i.system.durability?.value ?? "?"}/${i.system.durability?.max ?? "?"}${i.system.broken ? " BROKEN" : ""}`)]));
  return {
    id: F.id, group: F.group, rotation: F.rotation, seconds: Math.round((Date.now() - F.started) / 1000),
    winner: partyLeft && !monstersLeft ? "party" : monstersLeft && !partyLeft ? "monsters" : "unfinished",
    pass: F.pass, rounds: combat.round, partyLeft, monstersLeft, followups: F.followups ?? 0, knockbacks: F.knockbacks ?? {}, used: F.used ?? {},
    hp: Object.fromEntries(tokensOf(scene).map(t => [`${t.actor.name}#${t.id.slice(0, 4)}`, `${Math.max(t.actor.system.hp.value, -9999)}/${t.actor.system.hp.max}`])),
    down: downList,
    weapons: Object.fromEntries(Object.entries(weapons).map(([k, v]) => [k, { ...v, users: [...v.users] }])),
    armor: absorbed,
    creatures: Object.values(per),
    ai: Object.values(F.actors),
    trees: F.trees, gear: F.gear, monsterGear: F.monsterGear, gearState,
    log: { dialogs: { ...log.dialogs }, notes: [...log.notes], errors: [...log.errors] }
  };
}

/** Every encounter of the pass, one after another, in the background. */
SIM.start = function start(ids = passOf().encounters.map(e => e.id), opts = {}) {
  if (SIM.busy) return "already running";
  SIM.busy = true;
  (async () => {
    try { for (const id of ids) await SIM.fight(id, opts); } finally { SIM.busy = false; SIM.status = `finished ${ids.length} fights`; }
  })();
  return `started ${ids.length} fights`;
};
SIM.clear = clearSim;

/** Write SIM.results to dev/sim/results/<name>.json in the system folder (Foundry's file upload; the GM may upload JSON). */
SIM.save = async function save(name = passOf().id) {
  const file = new File([JSON.stringify(SIM.results, null, 1)], `${name}.json`, { type: "application/json" });
  const FP = foundry.applications.apps.FilePicker.implementation;
  return FP.upload("data", "systems/flowstate/dev/sim/results", file, {}, { notify: false });
};

export default SIM;
