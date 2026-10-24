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
const Cast = await import("/systems/flowstate/module/casting.mjs");
const Sp = await import("/systems/flowstate/module/spells.mjs");
const Fx = await import("/systems/flowstate/module/spellfx.mjs");
const Mg = await import("/systems/flowstate/module/magic.mjs");
const CR = await import("/systems/flowstate/module/conjure-rules.mjs");
const Arc = await import("/systems/flowstate/module/arcana.mjs");
const Rules = await import("/systems/flowstate/module/rules.mjs");

const SIM = (window.SIM = window.SIM ?? {});
SIM.results = SIM.results ?? [];
SIM.R = R;
SIM.Act = Act;
SIM.status = SIM.status ?? "idle";

/* ---- Waiting without timers (a hidden tab throttles setTimeout to once a second, or once a minute) ---- */

// One channel for every tick: a new MessageChannel per tick leaks (open ports aren't collected), and the tab ran out of memory in long fights.
SIM._chan = SIM._chan ?? (() => { const c = new MessageChannel(), q = []; c.port1.onmessage = () => q.shift()?.(); return { c, q }; })();
const tick = () => new Promise(r => { SIM._chan.q.push(r); SIM._chan.c.port2.postMessage(0); });
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
      if (f.tagName === "SELECT" && v0 === "$first") v = [...f.options].find(o => o.value)?.value;
      if (v === undefined || v === null) continue;
      if (f.type === "checkbox") f.checked = !!v;
      else if (f.type === "radio") f.checked = f.value === String(v);
      else if (f.tagName === "SELECT" && ![...f.options].some(o => o.value === String(v))) continue;
      else f.value = v;
      f.dispatchEvent(new Event("change", { bubbles: true }));
      // Tree options the AI took (for the report).
      if (F && !NOT_OPTIONS.has(k) && (f.type === "checkbox" ? f.checked : f.value && f.value !== "0")) { F.used = F.used ?? {}; bump(F.used, `opt:${k}${f.type === "checkbox" || f.value.length > 20 ? "" : `=${f.value}`}`); }          // (an id, e.g. Disarm's item, isn't worth keeping)
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
    // Dialogs fill in what a player picked last time (v0.78): the AI starts from the defaults instead, so its own picks are the only ones.
    form.reset();
    for (const sel of form.querySelectorAll("select")) sel.dispatchEvent(new Event("change", { bubbles: true }));
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
  const d = Cat.itemData(`weapon.${slot.type}.${slot.weight}.${slot.material}`, { grade, system: { equipped: false, twoHanded: !!slot.twoHanded, natural: !!natural,
    // Extra types (Weapon Master) are an identity field: they stick on a copy as an override of its catalog entry.
    overrides: slot.extraTypes?.length ? [{ path: "system.extraTypes", value: slot.extraTypes }] : [] } });
  if (!d) throw new Error(`No catalog entry weapon.${slot.type}.${slot.weight}.${slot.material}`);
  return d;
}
function armorData(slot, stats, sp, natural) {
  const grade = R.gradeFor((stats.con ?? 0) + bonusOf(sp));
  const d = Cat.itemData(`armor.${slot.weight}.${slot.material}`, { grade, system: { equipped: true, natural: !!natural } });
  if (!d) throw new Error(`No catalog entry armor.${slot.weight}.${slot.material}`);
  return d;
}

/** A Foci for a caster, Graded to the stat it casts with (Igniter: Grasp, Channeler: Reach, Multi: the lesser), attuned and held. */
function fociData(slot, stats, sp, natural) {
  const form = Mg.FOCI_TYPES[slot.type]?.form;
  const v = k => (stats[k] ?? 0) + bonusOf(sp);
  const stat = form === "igniter" ? v("grasp") : form === "channeler" ? v("reach") : Math.min(v("reach"), v("grasp"));
  const d = Cat.itemData(`foci.${slot.type}`, { grade: R.gradeFor(stat), system: { equipped: true, attuned: true, twoHanded: !!slot.twoHanded, natural: !!natural } });
  if (!d) throw new Error(`No catalog entry foci.${slot.type}`);
  return d;
}
/** A Shroud, Graded to Build (it scales with Build), attuned. */
function shroudData(slot, stats, sp, natural) {
  const d = Cat.itemData(`shroud.${slot.type}`, { grade: R.gradeFor((stats.build ?? 0) + bonusOf(sp)), system: { attuned: true, natural: !!natural } });
  if (!d) throw new Error(`No catalog entry shroud.${slot.type}`);
  return d;
}

/** One actor from a spec and a loadout. Weapons are held in order while hands last; a grappler keeps a fist free. */
async function makeActor(spec, loadout, { party, folder }) {
  const sp = spec.sp ?? 30;
  const a = await Actor.create({
    name: spec.name, type: party ? "character" : "npc", folder: folder.id,
    system: { stats: R.statBlock(spec.stats), skillPoints: sp, size: spec.size ?? 3, trees: loadout.trees ?? {} },
    prototypeToken: { name: spec.name, actorLink: !!party, disposition: party ? 1 : -1, displayBars: 40, bar1: { attribute: "hp" } },
    flags: { flowstate: { sim: { id: spec.id, role: loadout.role ?? spec.role ?? "monster", party: !!party, grapple: !!loadout.grapple, stances: loadout.stances !== false, quickload: spec.quickload ?? null, noPepper: !!loadout.noPepper, conj: loadout.conj ?? null } } }
  });
  const natural = !party && spec.natural !== false;
  const slots = loadout.weapons.filter(w => w.type !== "unarmed");
  const items = [loadout.armor ? armorData(loadout.armor, spec.stats, sp, natural) : null,          // no armor: Unarmored
    loadout.foci ? fociData(loadout.foci, spec.stats, sp, natural) : null, loadout.shroud ? shroudData(loadout.shroud, spec.stats, sp, natural) : null,
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
  await a.update({ "system.hp.value": a.system.hp.max, "system.energy.value": a.system.energy.max, "system.ap.value": 6, "system.rp.value": 6,
    ...(loadout.focus ? { "system.focusedSpell": loadout.focus } : {}) });
  return a;
}

/** Delete the sim's actors, tokens, piles and combats. */
async function clearSim() {
  for (const scene of game.scenes.filter(s => ["Sim Arena", "Sim Field"].includes(s.name))) await clearScene(scene);
  const doomed = () => game.actors.filter(a => a.getFlag("flowstate", "sim") || a.getFlag("flowstate", "summon") || a.name.startsWith("Sim ") || (a.type === "pile" && a.getFlag("flowstate", "simPile"))).map(a => a.id);
  for (let i = 0; i < 4 && doomed().length; i++) {
    try { await Actor.deleteDocuments(doomed()); } catch (err) { await idle(600); }
  }
}
async function clearScene(scene) {
  for (const c of game.combats.filter(c => c.scene?.id === scene?.id)) await c.delete();
  // Ending a combat removes its temporary creations on its own: a token can go while this deletes it, so try again on what's left.
  for (let i = 0; i < 4 && scene?.tokens.size; i++) {
    try { await scene.deleteEmbeddedDocuments("Token", scene.tokens.map(t => t.id)); } catch (err) { await idle(600); }
  }
}

async function arena({ name = "Sim Arena", width = 4800, height = 2800 } = {}) {
  let scene = game.scenes.getName(name);
  if (!scene) scene = await Scene.create({ name, width, height, padding: 0, grid: { type: 1, size: 100, distance: 5, units: "ft" }, backgroundColor: "#2b2f2b" });
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
  if (Act.grappledBy(actor).some(v => v.getFlag?.("flowstate", "grappleWeapon") === item.uuid)) return null;          // holding someone (Impale): it can't attack
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
  // Trudge (Heavy Armor T2): this move ignores the armor's speed penalty.
  const armorW = actor.items.find(i => i.type === "armor" && i.system.equipped)?.system?.weight;
  if (((armorW === "heavy" && tier(actor, "martial-heavy-armor") >= 2) || (armorW === "titanic" && tier(actor, "martial-titanic-armor") >= 4)) && energyOf(actor) >= 10) await runRow(actor, /^Trudge/);
  // A free move (Dash) goes up to the creature's speed whatever its AP.
  const max = actor.getFlag("flowstate", "freeMove") ? (actor.system.movement?.speed ?? 30) : MR.maxMove(Act.moveLedger(actor), { ...Act.moveParams(actor), ap: actor.system.ap.value });
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
  stat(actor).turnMoved = (stat(actor).turnMoved ?? 0) + moved;
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
  if (extra.mode !== "throw") { delete opts.ho; delete opts.wga; }          // Ho! and What Goes Around are for throws only
  if (!extra.area) delete opts.cone; else stat(actor).cones = (stat(actor).cones ?? 0) + 1;
  // An Area hits every targeted creature: a ranged Area everyone within its radius of the target, a melee one (Spin, Spin Cycle, Whirlwind)
  // every foe in reach. (Targeting only the main creature made Area attacks look worse than they are.)
  if (!extra.followup && (extra.area || opts.spin || opts.spinCycle || opts.whirlwind)) {
    const foes = foesOf(me.parent, me);
    const p = plan.item.system.profile;
    const inArea = extra.area ? foes.filter(f => f.id !== target.id && dist(f, target) <= (p.area === 2 ? 10 : 5))
      : foes.filter(f => f.id !== target.id && dist(me, f) <= reachOf(actor) * (p.farstrike || 1) + 0.01);
    setTargets(target, ...inArea);
  }
  SIM.fill = () => ({ mode: extra.mode ?? (plan.ranged ? (extra.far ? "r2" : "r1") : "strike"), pepper: extra.pepper ?? 0, area: !!extra.area,
    grapple: !!extra.grapple, weight: extra.weight ?? undefined, ...opts, ...(extra.followup ? followupOptions(actor, plan.item, target) : {}), ...(extra.extraFill ?? {}) });
  SIM.acting = actor.name;
  try { await Act.rollWeaponAttack(actor, plan.item, extra.followup ?? null); } catch (err) { log.errors.push(`attack ${actor.name}: ${err.stack?.slice(0, 400)}`); }
  const msg = await waitFor(() => game.messages.contents.find(m => !before.has(m.id) && m.getFlag("flowstate", "attack")?.attacker === actor.uuid), 3000);
  if (!msg) return null;
  stat(actor).attacks++;
  (F.firstAttack ??= {})[sim(actor).party ? "party" : "monsters"] ??= SIM.combat?.round ?? null;
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
  const type = item?.system?.weaponType ?? "", weight = item?.system?.weight ?? "";
  const min = minOf(p.capped), dexMin = minOf(effStat(actor, "dex")), strMin = minOf(effStat(actor, "str"));
  const crowd = me ? foesOf(me.parent, me).filter(f => dist(me, f) <= reachOf(actor) * (p.farstrike || 1) + 0.01).length : 0;
  const prone = !!target?.actor?.statuses?.has("prone");
  const s = F && actor ? stat(actor) : {};
  const alt = (key, list) => { s[key] = ((s[key] ?? -1) + 1) % list.length; return list.slice(s[key]).concat(list.slice(0, s[key])); };          // take turns between choices
  const o = {};
  // Martial T1 trees.
  if (type === "bladed" && crowd >= 2) { if (take(2 * min)) o.whirlwind = ["blender", "on"]; else if (take(min)) o.whirlwind = "on"; }
  if (type === "balanced") {
    if (crowd >= 2 && take(min)) o.spinCycle = true;
    if (take(2 * min)) { o.slice = ["both", "pierce"]; o.slam = ["both", "knockback"]; } else if (take(min)) { o.slice = "pierce"; o.slam = "knockback"; }
  }
  if (type === "swift" && take(Math.floor(min / 2))) o.quickStrike = true;
  if (type === "unarmed") {
    if (take(dexMin)) { o.twinFang = ["adv", "str"]; o.twinFangPick = "adv"; }
    const lash = prone || s.lastTech === "kick";
    if (lash ? take(2 * strMin) : take(strMin)) { o.heavyTech = lash ? ["dragon", "kick"] : ["kick", "dragon"]; s.lastTech = lash ? "dragon" : "kick"; }
  }
  if (type === "rapid" && pepper && take(min)) o.spinDown = true;
  // Martial T2 trees.
  if (type === "striker" && take(Math.floor(min / 2))) o.rend = true;
  if (type === "weighted") {
    if (weight === "light" && take(min)) o.controlled = alt("ctl", [["both", "adv", "solitary"], ["both", "solitary", "adv"]])[0];
    if (weight === "heavy" && take(min)) o.wild = alt("wild", [["both", "str2"], ["both", "bashPlus"], ["both", "bashStr"]])[0];
    if (crowd >= 2 && take(min)) o.spin = true;
    // (Smashing, Weighted T4, is a start-of-turn status: the turn card.)
  }
  if (type === "assault") {
    const moved = (s.turnMoved ?? 0) > 0;
    if (!moved && sim(actor).role === "ranged") { o.takeAim = alt("aim", [["adv", "str"], ["str", "adv"]])[0]; o.coolBreath = true; }
    else if (take(min)) o.takeAim = alt("aim", [["adv", "str"], ["str", "adv"]])[0];
  }
  // Martial T3 trees.
  if (type === "weighted" && (s.turnMoved ?? 0) > 0) o.strafe = true;                                   // Wide Arc: it moved this turn, so it's strafing
  if (weight === "light" && take(2 * dexMin)) { const picks = alt("shank", [["adv", "dodge", "pierce"], ["pierce", "cleave", "adv"], ["dodge", "dodge", "adv"]])[0]; o.shank1 = picks[0]; o.shank2 = picks[1]; o.shank3 = picks[2]; }
  if (weight === "light" && take(Math.floor(dexMin / 4))) o.pinpoint = true;
  if (type === "reach" && take(Math.floor(min / 2))) o.thrust = true;
  if (type === "circular") {
    if (take(Math.floor(min / 2))) o.through = alt("thr", [["adv", "str"], ["pierce", "cleave"]])[0];
    if (take(Math.floor(min / 2))) o.letItRip = true;
    if (take(min)) o.wga = true;                                                                          // What Goes Around (throws only)
  }
  if (type === "blast") {
    if (take(min)) o.punch = true;
    if (prone && take(min)) o.execute = true;
    if ((s.cones ?? 0) % 2 === 1 && take(min)) o.cone = true;                                             // Cone Shot on every other Area shot
  }
  // Martial T4 trees.
  if (type === "curved") {
    o.omnislash = true;                                                                                  // offered only at 4+ Momentum on the target
    if ((s.disarms ?? 0) < 2 && take(min)) { o.disarm = "$first"; s.disarms = (s.disarms ?? 0) + 1; }      // a couple of Disarms a fight
  }
  if (type === "longshot") {
    if (take(effStat(actor, weight === "heavy" ? "str" : "dex"))) o.prepared = alt("prep", [["headshot", "str"], ["str"], ["pierce"], ["cleave"]])[0];
    else if (take(2 * min)) o.prepared = alt("prep2", [["str"], ["pierce"], ["cleave"]])[0];
    if (take(min)) o.fish = true;
    if (o.prepared && take(min)) o.snipe = true;                                                          // Snipe Hunt needs an Advantage (Prepared Shot gives one)
  }
  // Martial T5 trees.
  if (type === "thrasher") {
    s.thr = (s.thr ?? 0) + 1;
    const far = me && target ? dist(me, target) > reachOf(actor) + 0.01 : false;
    const grabbable = (target?.actor?.system?.size ?? 3) <= (actor.system.size ?? 3);                     // a weapon grapple only takes your size or smaller
    if (far && grabbable && take(2 * min)) o.getOverHere = true;                                      // pull them in from Farstrike reach
    else if (grabbable && s.thr % 4 === 0) o.thrasherGrapple = true;                                  // every fourth swing holds them instead
    o.windup = budget >= 2 * min + 10 ? "2" : budget >= min + 10 ? "1" : "0";
    if (o.windup !== "0") take(Number(o.windup) * min);
    if (take(min)) o.overshield = true;
  }
  const types = item?.system?.types ?? [];
  if (types.length > 1) o.type = alt("wm", types)[0];                                               // Weapon Master: attack as each of its types in turn
  if (weight === "heavy" && type !== "unarmed" && take(2 * strMin)) o.heave = true;
  if (type !== "defender" && actor.items.some(i => i.type === "weapon" && i.system.held && i.system.weaponType === "defender") && take(min)) o.swordBoard = true;
  if (take(strMin)) o.ho = ["2", "1"];
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
      // Ally help (one button per target; a picker of who and how): Perfect Block first, then Block, then Shield Toss to guard, then anything else.
      if (!handled.has(`${key}|ally`) && doc.querySelector(`.fs-ally-help[data-index="${i}"]`)) {
        handled.add(`${key}|ally`);
        const owners = (doc.querySelector(`.fs-ally-help[data-index="${i}"]`)?.closest(".fs-ally-row")?.dataset.owners ?? "").split(",").filter(Boolean);
        const helper = owners.map(u => fromUuidSync(u)).find(a => a && sim(a).id && a.uuid !== t.uuid && !down(a) && sim(a).party === sim(t).party);
        if (helper) {
          let picked = "";
          SIM.acting = helper.name;
          SIM.fill = (title, content, form) => {
            const opts = [...(form.querySelector('select[name="pick"]')?.options ?? [])];
            const rank = o => (/perfect/i.test(o.text) ? 0 : /shield toss/i.test(o.text) ? 2 : /block/i.test(o.text) ? 1 : 3);
            const best = opts.filter(o => !/perfect/i.test(o.text) || energyOf(helper) >= 15).sort((x, y) => rank(x) - rank(y))[0];
            picked = best?.text ?? "";
            return best ? { pick: best.value } : {};
          };
          try { await Act.allyHelp(msg, i); } catch (err) { log.errors.push(`ally help ${helper.name}: ${err.stack?.slice(0, 400)}`); }
          note(helper, /perfect/i.test(picked) ? "allyPerfectBlock" : /shield toss/i.test(picked) ? "allyShieldToss" : /block/i.test(picked) ? "allyBlock" : picked ? `allyHelp:${picked.split(" ")[0]}` : "allyHelp:none");
          return true;
        }
      }
      let choice = "dodge";
      if (has("perfectBlock") && !handled.has(`${key}|pb`) && energy >= 15) { choice = "perfectBlock"; handled.add(`${key}|pb`); }
      else if (has("perfectParry") && !handled.has(`${key}|pp`)) { choice = "perfectParry"; handled.add(`${key}|pp`); }
      else if (has("distract") && !handled.has(`${key}|df`) && energy >= 10) { choice = "distract"; handled.add(`${key}|df`); }
      else if (has("dash") && !handled.has(`${key}|dash`) && energy >= 5) { choice = "dash"; handled.add(`${key}|dash`); }
      else if (has("closeQuarters") && !handled.has(`${key}|cq`) && energy >= 10) { choice = "closeQuarters"; handled.add(`${key}|cq`); }
      else if (has("shift") && !handled.has(`${key}|shift`) && energy >= 10) { choice = "shift"; handled.add(`${key}|shift`); }
      else if (has("shift") && !handled.has(`${key}|shift2`) && energy >= 20 && tier(t, "martial-light-armor") >= 4) { choice = "shift"; handled.add(`${key}|shift2`); }
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
    // Start-of-turn card: Maintain Berserk (else Berserk) and Proper Stance, while Energy allows.
    const tsRow = doc.querySelector(".fs-turn-start-row");
    if (tsRow) {
      const who = ownerOf(tsRow.querySelector(".fs-turn-start") ?? tsRow);
      for (const op of ["maintain", "berserk", "properStance", "quicken"]) {
        if (!tsRow.querySelector(`.fs-turn-start[data-op="${op}"]`) || !once(`ts:${op}`, true)) continue;
        if (op === "berserk" && tsRow.querySelector('.fs-turn-start[data-op="maintain"]')) continue;
        if (!who || !sim(who).id || energyOf(who) < 25) { if (who) note(who, `${op}:skipped`); continue; }
        SIM.acting = who.name; SIM.fill = () => ({});
        note(who, op);
        try { await Act.startOfTurn(msg, op); } catch (err) { log.errors.push(`${op} ${who.name}: ${err.stack?.slice(0, 400)}`); }
        return true;
      }
    }
    // Bounce (Defender T4): the Shield Toss goes on to another foe within throw range of the one it hit.
    const bounce = doc.querySelector(".fs-bounce");
    if (bounce && once("bounce", true)) {
      const who = ownerOf(bounce), def = msg.getFlag("flowstate", "defense");
      const hitTok = fromUuidSync(def?.target ?? "")?.getActiveTokens?.()[0]?.document;
      const me = who?.getActiveTokens?.()[0]?.document;
      const next = me && hitTok ? foesOf(me.parent, me).filter(f => f.id !== hitTok.id && dist(f, hitTok) <= 100).sort((a, b) => dist(a, hitTok) - dist(b, hitTok))[0] : null;
      if (who && next) {
        setTargets(next); SIM.acting = who.name; SIM.fill = () => ({});
        note(who, "bounce");
        try { await Act.shieldBounce(msg); } catch (err) { log.errors.push(`bounce ${who.name}: ${err.stack?.slice(0, 400)}`); }
        return true;
      }
    }
    // Momentum (Curved T3): after a Curved hit, take a stack (Advantage and Strengthened in turn).
    const mom = [...doc.querySelectorAll(".fs-momentum")];
    if (mom.length && once("momentum", true)) {
      const who = ownerOf(mom[0]);
      if (who && sim(who).id) {
        const st = stat(who); st.mom = ((st.mom ?? 0) + 1) % 2;
        const pick = mom.find(b => b.dataset.kind === (st.mom ? "adv" : "str")) ?? mom[0];
        SIM.acting = who.name; SIM.fill = () => ({});
        note(who, `momentum:${pick.dataset.kind}`);
        try { await Act.addMomentum(msg, pick.dataset.kind); } catch (err) { log.errors.push(`momentum ${who.name}: ${err.stack?.slice(0, 400)}`); }
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
      [".fs-palisade[data-wall='1']", "wall", (who) => energyOf(who) >= 10, () => Act.palisade(msg, true)],
      [".fs-palisade:not([data-wall='1'])", "palisade", (who) => rpOf(who) >= 3, () => Act.palisade(msg, false)],
      [".fs-twist", "twist", (who) => energyOf(who) >= 15, () => Act.reachFinisher(msg, "twist")],
      // Impale is offered on every Reach T5 hit (a Twist may still push it over); only take it when the hit beat half the Pain Threshold.
      [".fs-impale", "impale", (who) => energyOf(who) >= 30 && (Number(msg.getFlag("flowstate", "damage")?.toHp) || 0) > 0, () => Act.reachFinisher(msg, "impale")],
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
  // An empty gun: reload with RP and fire, else (Quickload, Rapid/Assault T1) give the follow-up up to reload for free.
  let quickFu = false;
  if (plan.ranged && !item.system.loaded) {
    const ql = ab.rapid(attacker, item, 1) || ab.assault(attacker, item, 1);
    if (rpOf(attacker) >= plan.reloadRP) {
      SIM.acting = attacker.name;
      await Act.reloadWeapon(attacker, item);
      stat(attacker).reloads = (stat(attacker).reloads ?? 0) + 1;
      if (!item.system.loaded) return false;
    } else if (ql) { quickFu = true; note(attacker, "followup:quickload"); }
    else { note(attacker, "followup:noRP"); return false; }
  }
  const src = game.messages.get(card.getFlag("flowstate", "followupCard"))?.getFlag("flowstate", "attack");
  const first = src?.targets?.[0] ? fromUuidSync(src.targets[0].uuid)?.getActiveTokens?.()[0]?.document : null;
  const inReach = t => t && !down(t.actor) && dist(me, t) <= plan.range + 0.01;
  const target = inReach(first) ? first : foesOf(me.parent, me).filter(inReach).sort((a, b) => dist(me, a) - dist(me, b))[0];
  if (!target) return false;
  if (!quickFu) F.followups = (F.followups ?? 0) + 1;
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
  SIM.fill = () => ({ dir, crunch: energyOf(attacker) >= 20 });
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
  const row = actionRows(actor).find(r => re.test(r.label) && !/\((active|ready)/.test(r.label) && !r.disabled);
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
  // Smashing (Weighted T4): a start-of-turn status, from the Action List. It is ended here first too, in case the active GM's client (which
  // runs turn starts) has older code that doesn't end it.
  if (tier(actor, "martial-weighted-weapons") >= 4) {
    if (actor.statuses.has("smashing")) await actor.toggleStatusEffect("smashing", { active: false });
    if (energyOf(actor) >= 25 && await runRow(actor, /^Smashing/)) note(actor, "smashing");
  }
  if (tier(actor, "martial-medium-armor") >= 5 && !actor.getFlag("flowstate", "versatility")) await runRow(actor, /^Versatility/, { ability: sim(actor).role === "tank" ? "brace" : "shift" });
  const parryCost = w => w.system.profile?.capped ?? 99;
  if (tier(actor, "martial-theory") >= 1) {
    const guard = actor.items.find(i => i.type === "weapon" && i.system.held && ["balanced", "bladed", "curved"].includes(i.system.weaponType) && (i.system.profile?.dice ?? 0) > 0);
    if (guard && energyOf(actor) >= parryCost(guard) + 20) await runRow(actor, new RegExp(`^Parry: ${guard.name.replace(/[()]/g, ".")}`));
  }
  const stancesOn = sim(actor).stances !== false;
  const armorW = actor.items.find(i => i.type === "armor" && i.system.equipped)?.system?.weight;
  const giga = armorW === "titanic" && tier(actor, "martial-titanic-armor") >= 1;
  if (stancesOn && (giga || (["heavy", "titanic"].includes(armorW) && tier(actor, "martial-heavy-armor") >= 1)) && energyOf(actor) >= effStat(actor, "con") + 30)
    await runRow(actor, /^(Giga )?Brace/, { harden: (giga ? tier(actor, "martial-titanic-armor") >= 3 : tier(actor, "martial-heavy-armor") >= 4) && energyOf(actor) >= effStat(actor, "con") + minOf(effStat(actor, "con")) + 30 });
  // Taunt (Constitution T2) the foe nearest an ally; Pull Aggro (T4) every foe within 30 ft once three are that close.
  if (tier(actor, "martial-constitution-methods") >= 2 && rpOf(actor) >= 2) {
    const close = foesOf(me.parent, me).filter(f => dist(me, f) <= 30);
    if (tier(actor, "martial-constitution-methods") >= 4 && close.length >= 3 && energyOf(actor) >= effStat(actor, "con") + 20) { setTargets(...close); await runRow(actor, /^Pull Aggro/); }
    else {
      const allies = alliesOf(me.parent, me);
      const prey = foesOf(me.parent, me).filter(f => dist(me, f) <= 100).sort((a, b) => Math.min(...allies.map(x => dist(x, a)), 999) - Math.min(...allies.map(x => dist(x, b)), 999))[0];
      if (prey && energyOf(actor) >= minOf(effStat(actor, "con")) + 20) { setTargets(prey); await runRow(actor, /^Taunt$/); }
    }
  }
  if (tier(actor, "martial-strength-methods") >= 5 && energyOf(actor) >= 2 * minOf(effStat(actor, "str")) + 40) await runRow(actor, /^Unstoppable/);
  if (tier(actor, "martial-striker-weapons") >= 4 && actor.statuses.has("berserk") && energyOf(actor) >= 25) await runRow(actor, /^Seeing Red/);
  if (stancesOn && armorW === "medium" && tier(actor, "martial-medium-armor") >= 2) {
    const free = actor.getFlag("flowstate", "versatility") === "brace";
    if (free || energyOf(actor) >= effStat(actor, "con") + 30) await runRow(actor, /^Brace/);
  }
  if (stancesOn && tier(actor, "martial-brawling-methods") >= 2) {
    s.fist = s.fist === "Shatter" ? "Dip" : "Shatter";
    const cost = effStat(actor, s.fist === "Dip" ? "dex" : "str");
    if (energyOf(actor) >= cost + 20) await runRow(actor, new RegExp(`^${s.fist}`));
  }
  const bare = !actor.items.some(i => i.type === "armor" && i.system.equipped);
  if ((tier(actor, "martial-light-armor") >= 3 || (bare && tier(actor, "martial-unarmored") >= 2)) && !s.leapt && energyOf(actor) >= 20 && actor.system.ap.value >= 3) { s.leapt = true; await runRow(actor, /^Leap/); }
  if (tier(actor, "martial-dexterity-methods") >= 4 && !s.spotted && energyOf(actor) >= 20) {
    const prey = foesOf(me.parent, me).sort((a, b) => dist(me, a) - dist(me, b))[0];
    if (prey) { s.spotted = true; setTargets(prey); await runRow(actor, /^Spot Weakness/); }
  }
  await holdTight(actor);
  if (!sim(actor).party && actor.getFlag("flowstate", "grappledBy") && actor.system.ap.value >= 2) { note(actor, "breakFree"); await runRow(actor, /^Break Free/); }
  if (tier(actor, "martial-rapid-weapons") >= 3) {
    const gun = actor.items.find(i => i.type === "weapon" && i.system.held && i.system.weaponType === "rapid");
    const prey = gun ? foesOf(me.parent, me).filter(f => dist(me, f) <= (gun.system.profile?.range ?? 0)).sort((a, b) => dist(me, a) - dist(me, b))[0] : null;
    if (prey && energyOf(actor) >= minOf(gun.system.profile?.capped) + 10) { setTargets(prey); await runRow(actor, /^Mark$/); }
  }
}

/** Lock Down (Grappling T1) and Disrupt (T2) what this creature holds, while Energy allows (any time: right after the grapple lands too). */
async function holdTight(actor) {
  const v = Act.grappledBy(actor).find(x => !down(x));
  if (!v || tier(actor, "martial-grappling-methods") < 1) return;
  const vTok = v.getActiveTokens?.()[0]?.document;
  if (!vTok) return;
  if (v.getFlag?.("flowstate", "lockedDown") !== actor.uuid && energyOf(actor) >= effStat(v, "str") + 10) { setTargets(vTok); await runRow(actor, /^Lock Down/); }
  if (tier(actor, "martial-grappling-methods") >= 2 && !v.getFlag?.("flowstate", "disrupted") && energyOf(actor) >= minOf(effStat(v, "str")) + 10) { setTargets(vTok); await runRow(actor, /^Disrupt/); }
}

/** End of the AI's turn: Eviscerate (Swift T4) if it's on offer, then Recover Energy with the AP left while Energy is low. */
async function endOfTurn(actor) {
  if (tier(actor, "martial-swift-weapons") >= 4 && energyOf(actor) >= 20) await runRow(actor, /^Eviscerate/);
  if (tier(actor, "martial-curved-weapons") >= 4 && energyOf(actor) >= 20) await runRow(actor, /^Sheath Weapon/);
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
  if (sim(actor).role === "dummy") return;          // a bench dummy never acts (it still dodges)
  if (passOf().deploy === "kite" && !sim(actor).party) {
    const tr = { who: "chaser", round: SIM.combat?.round, gap: Math.min(...foesOf(me.parent, me).map(f => walkGap(me, f))), ap: actor.system.ap.value };
    (F.kiteLog ??= []).push(tr);
    await settle(); await stances(actor, me); await settle(); await actTurn(actor, me); await settle();
    tr.end = Math.min(...foesOf(me.parent, me).map(f => walkGap(me, f))); tr.moved = Math.round(stat(actor).turnMoved ?? 0); tr.attacks = stat(actor).attacks;
    if (!down(actor)) await endOfTurn(actor);
    return settle();
  }
  await settle();                                   // the start-of-turn card first (Berserk), so stances can see it (Seeing Red)
  await stances(actor, me);
  await settle();
  await actTurn(actor, me);
  await settle();
  if (!down(actor)) await endOfTurn(actor);
  await settle();
}

/**
 * Kiting (role "kiter"): stay out of the chaser's reach. Strafing (Rules doc) lets AP spent on an action also pay for movement, so the kiter shoots
 * first (that AP is banked toward its steps), then walks back on the bank until it is past every foe's threat line: what the foe can reach next
 * turn and still attack (its reach, the steps its spare AP pays for, and one more step that its attack settles).
 */
const threatOf = f => {
  const a = f.actor, held = a.items.filter(i => i.type === "weapon" && i.system.held);
  const atk = Math.min(...held.map(i => i.system.profile?.ap ?? 2), 6);
  const spare = Math.max(0, (a.system.ap.max ?? 6) - atk), step = a.system.movement?.ap ?? 1;
  const reach = reachOf(a) * Math.max(1, ...held.map(i => i.system.profile?.farstrike || 1));
  return reach + (a.system.movement?.speed ?? 30) * (Math.floor(spare / step) + 1);
};
/** Feet a creature must walk (5 ft diagonals) from box `a` to touch token `b`: the gap between them in whole squares. */
const walkGap = (a, b) => {
  const g = canvas.scene.grid.size, pa = a._source ? pos(a) : a, pb = pos(b);
  const gx = Math.max(0, pb.x - (pa.x + a.width * g), pa.x - (pb.x + b.width * g)), gy = Math.max(0, pb.y - (pa.y + a.height * g), pa.y - (pb.y + b.height * g));
  return Math.round(Math.max(gx, gy) / g) * canvas.scene.grid.distance;
};
async function kiteTurn(actor, me) {
  const s = stat(actor);
  const gunOf = () => actor.items.filter(i => i.type === "weapon" && i.system.held && i.system.weaponType !== "unarmed").map(i => weaponPlan(actor, i)).find(w => w?.ranged);
  for (let k = 0; k < 14; k++) {
    if (down(actor) || over(me.parent)) return;
    const foes = foesOf(me.parent, me), gun = gunOf();
    if (!foes.length || !gun) return;
    if (!gun.loaded) { if (actor.system.rp.value < gun.reloadRP) break; SIM.acting = actor.name; await Act.reloadWeapon(actor, gun.item); s.reloads = (s.reloads ?? 0) + 1; continue; }
    if (actor.system.ap.value < gun.ap) break;
    const target = foes.sort((a, b) => dist(me, a) - dist(me, b))[0];
    if (dist(me, target) > gun.far + 0.01) break;
    if (!(await attack(actor, me, gun, target, { far: dist(me, target) > gun.range + 0.01 }))) break;
  }
  if (down(actor) || over(me.parent)) return;
  const foes = foesOf(me.parent, me);
  const trace = { round: SIM.combat?.round, at: Math.min(...foes.map(f => walkGap(me, f))), prone: actor.statuses.has("prone"), ap: actor.system.ap.value,
    speed: actor.system.movement?.speed, foeSpeed: foes[0]?.actor.system.movement?.speed, threat: Math.round(threatOf(foes[0])) };
  (F.kiteLog ??= []).push(trace);
  if (Math.max(...foes.map(f => threatOf(f) - walkGap(me, f))) < 0) return;
  trace.max = Math.round(MR.maxMove(Act.moveLedger(actor), { ...Act.moveParams(actor), ap: actor.system.ap.value }));
  const spot = fleeSpot(actor, me, foes, actor.system.ap.value);
  trace.spot = !!spot;
  if (spot) { s.kites = (s.kites ?? 0) + 1; note(actor, "kite:stepBack"); trace.to = await stepTo(actor, me, spot); trace.after = walkGap(me, foes[0]); }
  else {
    // Can't get clear: back off as far as it can anyway.
    note(actor, "kite:cornered");
    const far = fleeSpot(actor, me, foes, actor.system.ap.value, { anyGap: true });
    if (far) trace.to = await stepTo(actor, me, far);
  }
}

/** The cell to flee to: past every foe's threat line (in the gun's normal range if it can be), reachable with `apBudget` AP; else null. */
function fleeSpot(actor, me, foes, apBudget, { anyGap = false } = {}) {
  const scene = me.parent, g = scene.grid.size, at = pos(me);
  const maxFeet = MR.maxMove(Act.moveLedger(actor), { ...Act.moveParams(actor), ap: apBudget });
  const r = Math.floor(maxFeet / scene.grid.distance);
  const gun = actor.items.find(i => i.type === "weapon" && i.system.held && i.system.profile?.ranged)?.system?.profile;
  const others = scene.tokens.contents.filter(t => t.id !== me.id && sim(t.actor).id && !down(t.actor));
  const cands = [];
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
    const x = at.x + dx * g, y = at.y + dy * g;
    if (x < 0 || y < 0 || x + me.width * g > scene.width || y + me.height * g > scene.height) continue;
    if (Math.max(Math.abs(dx), Math.abs(dy)) * scene.grid.distance > maxFeet + 0.01) continue;
    if (others.some(o => { const p = pos(o); return x < p.x + o.width * g - 1 && p.x < x + me.width * g - 1 && y < p.y + o.height * g - 1 && p.y < y + me.height * g - 1; })) continue;
    const box = { x, y, width: me.width, height: me.height };
    const margin = Math.min(...foes.map(f => walkGap(box, f) - threatOf(f)));
    if (margin <= 0 && !anyGap) continue;
    const near = Math.min(...foes.map(f => dist(box, f)));
    // Prefer staying in normal range, then the shortest move (AP left to shoot), then room behind (away from the edges).
    const edge = Math.min(x, y, scene.width - x, scene.height - y) / g;
    cands.push({ x, y, score: anyGap ? -margin - Math.min(edge, 12) : (gun && near <= gun.range ? 0 : 1000) + Math.hypot(dx, dy) - Math.min(edge, 12) * 0.5 });
  }
  cands.sort((a, b) => a.score - b.score);
  for (const c of cands.slice(0, 40)) if (feetTo(me, c.x, c.y) <= maxFeet + 0.01) return c;
  return null;
}

/** Move to a spot (a player's drag: the move costs AP). Returns the feet moved. */
async function stepTo(actor, me, dest) {
  const from = { x: me._source.x, y: me._source.y };
  try { await me.move([{ x: dest.x, y: dest.y }], { method: "dragging", animate: false }); } catch (err) { log.errors.push(`move ${actor.name}: ${err.message}`); return 0; }
  await waitFor(() => me._source.x !== from.x || me._source.y !== from.y, 1500);
  await idle(150);
  const moved = Math.hypot(me._source.x - from.x, me._source.y - from.y) / me.parent.grid.size * me.parent.grid.distance;
  stat(actor).moved += moved;
  stat(actor).turnMoved = (stat(actor).turnMoved ?? 0) + moved;
  return moved;
}

/**
 * Should an Area-tag gun fire as an Area? Only when the average hit, Weakened (halved) on every target in the area, gets more through their
 * armor in total than one full-strength hit on the main target. (Each target dodges on its own; the hit chance is taken as the same.)
 */
async function areaPays(actor, gun, target, foes) {
  const p = gun.item.system.profile;
  if (!p.area) return false;
  const radius = p.area === 2 ? 10 : 5;
  const others = foes.filter(f => f.id !== target.id && dist(f, target) <= radius);
  if (!others.length) return false;
  const avg = Math.floor(p.dice * (p.die + 1) / 2 * (1 + 0.5 * (p.stacks ?? 0)));
  const through = async (t, n) => { try { return (await Act.damageOutcome(t.actor, n, p.damageType ?? "physical", { pierce: p.pierce ?? 0 })).toHp; } catch (err) { return n; } };
  const single = await through(target, avg);
  let spread = 0;
  for (const t of [target, ...others]) spread += await through(t, Math.floor(avg / 2));
  F.areaChecks = (F.areaChecks ?? 0) + 1;
  return spread > single;
}

/* ---- Casting (the Magic passes) ---- */

/** A creature that knows Core Spells is played as a caster. */
const isCaster = actor => Sp.knownSpells(actor.system.trees ?? {}).cores.length > 0;
const tierOf = (actor, id) => Number(actor.system.trees?.[id]) || 0;
/** The way to cast: an attuned Foci when there is one, else Raw Casting. */
const castOption = ctx => ctx.options.filter(o => o.ok).sort((a, b) => (b.key !== "raw") - (a.key !== "raw") || b.scaling - a.scaling)[0] ?? null;
const meanDice = d => (d ? d.n * (d.sides + 1) / 2 : 0);

/**
 * Plan a cast: Cores, Mods ({ id: true | count }), the AP to cast with (for Raw/Multi casting, the cheapest in Energy, then the fewest AP),
 * extra dialog values. Returns { values, plan } or null if it can't be cast.
 */
function planSpell(ctx, opt, coreIds, mods = {}, extra = {}) {
  const v = { via: opt.key, core1: coreIds[0], core2: coreIds[1] ?? "", ...extra };
  v.base = extra.base ?? Sp.baseThreshold(coreIds).min;
  for (const [id, n] of Object.entries(mods)) v[`mod:${id}`] = n;
  let best = null;
  for (const ap of opt.ap) {
    const plan = Sp.planCast(ctx, { ...v, ap });
    if (!plan.ok) continue;
    if (!best || plan.energy < best.plan.energy) best = { values: { ...v, ap }, plan };
  }
  return best;
}

/**
 * What a spell is worth to the AI against `target`: its damage dice, plus the stacks it leaves (Ignite, Stain, Searing and Electric Stains burn on
 * later turns), Energy it drains, its chain to other foes, and Force. Negative when it can't be used on them (a Cold + Radiation on someone with Energy).
 */
function spellValue(plan, target = null, me = null) {
  const profile = Fx.profileFor(plan.cores.map(c => c.id));
  if (!profile) return 0;
  const P = Math.max(1, plan.power);
  if (profile.needsEnergyZero && (target?.actor?.system?.energy?.value ?? 1) > 0) return -1;
  const dmg = profile.damage ? meanDice(Fx.damageDice(profile, plan.power)) : profile.arcana?.kind === "shift" ? Math.floor(Fx.shiftBody(profile.arcana.body, plan.power) / 2) * 3.5 : 0;
  let v = dmg;
  if (profile.force) v += 0.25 * 5.5 * profile.force.n * P;
  const burn = { ignite: 1.5, stain: 1.5, searing: 3, electric: 2.5 };
  const others = target && me ? foesOf(me.parent, me).filter(f => f.id !== target.id && dist(f, target) <= 30).length : 0;
  let stacks = 0;
  for (const e of profile.effects ?? []) {
    if (e.stack) { stacks = e.stack.dice ? e.stack.dice[0] * (e.stack.dice[1] + 1) / 2 * P : dmg * (e.stack.per ?? 1); v += stacks * (burn[e.stack.kind] ?? 1); }
    if (e.energy) v += 0.3 * (e.energy.sameAsStacks ? stacks : dmg * (e.energy.per ?? 1));
    if (e.chain) v += dmg * 0.6 * Math.min(3, others);
    if (e.heatRad) v += 0.5 * e.heatRad.dice[0] * (e.heatRad.dice[1] + 1) / 2 * P;
    if (e.freezeAll) v += 4 * P;
  }
  return v;
}

/** Mods worth adding to a damage spell, best first (each one only if its school applies and the Energy is there). */
function damageMods(actor, target, plan, me = null) {
  const t = target?.actor;
  const armored = (t?.items ?? []).some(i => i.type === "armor" && i.system.equipped);
  const big = (t?.system?.hp?.max ?? 0) > 1000;
  const near = target && me ? foesOf(me.parent, me).filter(f => f.id !== target.id && dist(f, target) <= 10).length : 0;
  const out = ["magic-geomancy:toss", "magic-geomancy:tier-up", "magic-geomancy:tier-up-again", "magic-geomancy:harden", "magic-geomancy:muddy",
    "magic-slashing:bleed", "magic-slashing:rend", "magic-crushing:crush"];
  if (armored) out.push("magic-piercing:weakpoint", ["magic-piercing:pierce", 2], ["magic-crushing:bash", 1], "magic-acid:melt");
  // Tier 2 schools.
  out.push("magic-heat:ignition", "magic-radiation:electrify", ["magic-cold:frostbite", 2], "magic-cold:chill", "magic-cold:freeze");
  if ((t?.system?.energy?.value ?? 1) <= 0) out.push("magic-cold:shatter");
  if (near >= 1) out.push("magic-radiation:charge", "magic-radiation:lightning-rod");
  if ((t?.system?.conditions?.stain ?? 0) > 0) out.push("magic-acid:catalyst");
  if ((t?.system?.conditions?.stain ?? 0) >= (t?.system?.hp?.pain ?? Infinity)) out.push("magic-acid:sticky");
  if (near >= 2 && plan.attack === "Ranged") out.push("magic-reach-arcana:explode");
  if (actor.system.ap.value >= 2 * Math.max(1, plan.ap)) out.push(["magic-reach-arcana:multicast", 1]);          // AP left to pay for the recast
  out.push("magic-piercing:setup", "magic-crushing:beatdown", "magic-slashing:gash");
  if (big) out.push("magic-slashing:chop");
  if (actor.system.energy.value > 0.6 * actor.system.energy.max) out.push("magic-theory:empower");
  if (actor.system.energy.value > 0.7 * actor.system.energy.max) out.push("magic-theory:pinpoint");
  return out.map(m => (Array.isArray(m) ? m : [m, true]));
}

/** Pick Mods for a plan, cheapest-first in the AI's order, while they stay within `budget` Energy. */
function withMods(ctx, opt, coreIds, wanted, budget, extra = {}) {
  const known = new Set(Sp.applicableMods(ctx.trees, coreIds).map(m => m.id));
  let mods = {}, cur = planSpell(ctx, opt, coreIds, mods, extra);
  if (!cur) return null;
  for (const [id, n] of wanted) {
    if (!known.has(id)) continue;
    const next = planSpell(ctx, opt, coreIds, { ...mods, [id]: n }, extra);
    if (next && next.plan.energy <= budget) { mods = { ...mods, [id]: n }; cur = next; }
  }
  return cur;
}

/* ---- Tier 4: creations ---- */

/** The caster's creations still standing (Summons, Animations). */
const creationsOf = (scene, actor) => scene.tokens.contents.filter(t => t.actor?.getFlag("flowstate", "summon")?.owner === actor.uuid && !down(t.actor));

/**
 * What a Form / Animate / Make Combo makes, for the cast's dialog (values.conj): the whole point pool on Body (Constitution 40%, the rest Strength,
 * Dexterity 1), the biggest Size allowed, one two-handed Heavy natural weapon for Arm, the best Heavy weapon Make may create, the pile's Body at its minimum.
 */
function conjSpec(actor, plan, conj) {
  const profile = Fx.profileFor(plan.cores.map(c => c.id));
  const cj = profile.conjure;
  const mult = CR.conjureMultiplier(plan.base, plan.combo, cj.fear ? 2 : 1);
  const scale = n => Rules.applyStacks(n, Act.castStacks(actor, plan));
  const pw = Math.max(1, plan.power);
  const pool = scale(pw * (cj.instant ? 10 * mult : CR.summonPool(mult)));
  const bodyMin = scale(pw * (cj.instant ? 10 * mult : CR.formPool(mult)));
  const con = Math.max(1, Math.round(pool * 0.4)), str = Math.max(1, pool - con - 1);
  const arms = (plan.applied ?? []).filter(a => a.mod.name === "Arm").map(() => ({ type: conj.arm ?? "bladed", weight: "heavy" }));
  const mods = new Set((plan.applied ?? []).map(a => a.mod.name));
  const rarity = mods.has("Make Mk3") ? "rare" : mods.has("Make Mk2") ? "uncommon" : "common";
  const material = { common: "iron", uncommon: "coldIron", rare: "scarletite" }[rarity];
  const items = cj.kind === "make" || cj.make ? [{ kind: "weapon", type: conj.arm ?? "bladed", weight: "heavy", material, name: "", extra: [] }] : [];
  return { name: "", size: Math.max(...CR.formSizes(plan.gross ?? plan.threshold)), str, dex: 1, con, skill: 0, material: conj.material ?? "Clay", body: bodyMin,
    recipient: "self", command: "", harden: "strong", arms, items, tile: null };
}

/** Plan the loadout's creation: the highest base Threshold that fits the Energy, with Build Arcana and the school's Mods while they fit too. */
function conjurePlan(actor, ctx, opt, conj, budget) {
  const bt = Sp.baseThreshold(conj.cores);
  if (!bt.ok) return null;
  const make = conj.cores.includes("magic-creation:make");
  const wanted = [["magic-build-arcana:layered", true], ...(make ? [] : [["magic-summoning:arm", 1]]), ["magic-summoning:skin", true], ["magic-build-arcana:reactive", true],
    ...(["hard", "powder"].includes(CR.animMaterial(conj.material)?.category) ? [["magic-animation:expanded-animation", true]] : []), ["magic-creation:make-mk2", true], ["magic-creation:make-mk3", true]];
  for (let base = bt.max; base >= bt.min; base--) {
    const extra = { base, "modT:magic-summoning:arm": 2, "modT:magic-summoning:skin": 2 };
    const r = withMods(ctx, opt, conj.cores, wanted, budget, extra);
    if (!r || r.plan.energy > budget) continue;
    r.values.conj = conjSpec(actor, r.plan, conj);
    return r;
  }
  return null;
}

/** Put the caster's new creations on its side: the sim plays them (they act right after the caster) and they defend like any creature. */
async function adoptCreations(actor, label) {
  for (const t of canvas.scene.tokens.contents) {
    const sm = t.actor?.getFlag("flowstate", "summon");
    if (!sm || sm.owner !== actor.uuid || sim(t.actor).id) continue;
    await t.actor.setFlag("flowstate", "sim", { id: "creation", role: "creation", party: !!sim(actor).party, stances: false });
    if (!sim(actor).party) { await t.update({ disposition: -1 }); F.monsterSide?.add(t.actor.uuid); }
    (F.creations ??= {})[t.actor.uuid] = `Creation: ${label}`;
    F.hpMax[t.actor.uuid] = t.actor.system.hp.max;
    note(actor, `made:${sm.kind}`);
    const s = stat(actor);
    s.creations = (s.creations ?? 0) + 1;
    s.creationHp = (s.creationHp ?? 0) + (t.actor.system.hp.max ?? 0);
  }
}

/** Foes within `range` ft, the weakest first. */
const foesWithin = (me, range) => foesOf(me.parent, me).filter(f => dist(me, f) <= range + 0.01).sort((a, b) => a.actor.system.hp.value - b.actor.system.hp.value);
/** The ally (or self) most at risk: the most foes within 30 ft, then the lowest HP. */
function mostThreatened(me, list) {
  const foes = foesOf(me.parent, me);
  const near = t => foes.filter(f => dist(t, f) <= 30).length;
  return [...list].sort((a, b) => near(b) - near(a) || a.actor.system.hp.value - b.actor.system.hp.value)[0] ?? null;
}

/**
 * Venomancy: a coating passes on when the coated creature deals direct damage, through the coating card's Pass the Poison button (the caster
 * picks the victim). After a creature with its own coating hits someone with a spell or weapon, press it for the first creature it hurt.
 */
async function passCoat(actor, since) {
  const coat = Act.spellEffects(actor, "coat").find(e => e.flags.flowstate.spellEffect.caster === actor.uuid);
  if (!coat) return;
  const attackOf = m => { const def = game.messages.get(m.getFlag("flowstate", "damage").defenseMessage)?.getFlag("flowstate", "defense"); return game.messages.get(def?.attackMessage)?.getFlag("flowstate", "attack"); };
  const hit = game.messages.contents.filter(m => !since.has(m.id) && (Number(m.getFlag("flowstate", "damage")?.toHp) || 0) > 0).find(m => attackOf(m)?.attacker === actor.uuid);
  if (!hit) return;
  const card = game.messages.contents.slice().reverse().find(m => (m.getFlag("flowstate", "afflict")?.acts ?? []).some(x => x.act === "pass" && x.coated === actor.uuid));
  if (!card) return;
  const i = card.getFlag("flowstate", "afflict").acts.findIndex(x => x.act === "pass" && x.coated === actor.uuid);
  SIM.acting = actor.name;
  SIM.fill = () => ({ who: hit.getFlag("flowstate", "damage").target });
  try { await Act.afflictAct(card, i); note(actor, "passPoison"); } catch (err) { log.errors.push(`pass poison ${actor.name}: ${err.stack?.slice(0, 300)}`); }
  await settle();
}

/** Cast `values` at `targetTok` through the real Cast Spell path (no dialog). Returns true if a spell went off. */
async function castAt(actor, targetTok, values, label) {
  setTargets(...(Array.isArray(targetTok) ? targetTok : [targetTok]).filter(Boolean));
  SIM.acting = actor.name;
  SIM.fill = title => (/: shape$/.test(title) ? { shape: "radius" } : {});          // Gravity Field on the caster; Lob/Explode where the spell lands
  const apBefore = actor.system.ap.value;
  const since = new Set(game.messages.keys());
  if (Fx.profileFor([values.core1, values.core2].filter(Boolean))?.arcana?.kind === "shift") values = { ...values, arcanaSpec: { muddy: "dis", harden: "strong" } };
  let plan = null;
  try { plan = await Cast.castSpell(actor, values); } catch (err) { log.errors.push(`cast ${actor.name}: ${err.stack?.slice(0, 400)}`); }
  if (!plan) return false;
  const s = stat(actor);
  s.casts = (s.casts ?? 0) + 1;
  note(actor, `cast:${label}`);
  for (const a of plan.applied ?? []) note(actor, `mod:${a.mod.name}`);
  if (actor.system.ap.value === apBefore && !plan.ap) note(actor, "cast:free");
  await settle();
  // Multicast (Reach Arcana): recast for its AP/RP while there's enough left and a target still stands.
  for (let i = 0; i < 6; i++) {
    const card = game.messages.contents.slice(-15).reverse().find(m => m.getFlag("flowstate", "multicast")?.caster === actor.uuid && m.getFlag("flowstate", "multicast").remaining > 0);
    const mc = card?.getFlag("flowstate", "multicast");
    if (!mc || (actor.system[mc.key]?.value ?? 0) < mc.cost || !mc.targets.some(u => !down(fromUuidSync(u)))) break;
    note(actor, "multicast");
    try { await Cast.multicast(card); } catch (err) { log.errors.push(`multicast ${actor.name}: ${err.stack?.slice(0, 300)}`); break; }
    await settle();
  }
  await passCoat(actor, since);
  return true;
}

/**
 * A caster's turn: one protective or control spell (Shield or Personal Repulsion for a tank or support, Burden on the biggest threat, Gravity
 * Field on a crowd next to it, in that order), then the rest on its best damage spell (a Combo when it knows two schools), adding Mods while the Energy lasts.
 * It keeps its distance: it only walks when nothing is in range.
 */
async function casterTurn(actor, me) {
  const s = stat(actor);
  s.turns++;
  s.turnMoved = 0;
  const role = sim(actor).role;
  const done = new Set();
  for (let step = 0; step < 12; step++) {
    if (down(actor) || over(me.parent)) return;
    const { ctx, known } = Cast.castSummary(actor);
    const opt = castOption(ctx);
    if (!opt) { note(actor, "cast:noOption"); return; }
    const ap = actor.system.ap.value;
    const minAp = Math.min(...opt.ap);
    if (ap < minAp) return;
    const energy = actor.system.energy.value;
    const reserve = Math.floor(0.1 * actor.system.energy.max);
    const castsLeft = Math.max(1, Math.floor(ap / Math.max(1, Math.min(...opt.ap.filter(x => x <= ap)))));
    const budget = Math.max(0, Math.floor((energy - reserve) / castsLeft));
    const has = id => known.cores.some(c => c.id === id);
    const allies = [me, ...alliesOf(me.parent, me)];
    const fits = r => r && r.plan.ap <= ap && r.plan.energy <= Math.max(0, energy - reserve);

    // Shield (Protection Arcana): the ally (or yourself) most at risk who has none.
    if ((role === "tank" || role === "support") && has("magic-protection-arcana:shield") && !done.has("shield") && !done.has("support")) {
      done.add("shield");
      const who = mostThreatened(me, allies.filter(t => !Act.spellEffects(t.actor, "shield").length && dist(me, t) <= 100));
      const wanted = [["magic-protection-arcana:reflect", true], ["magic-protection-arcana:dampen", 1], ["magic-build-arcana:layered", true], ["magic-build-arcana:reactive", true]];
      const r = who ? withMods(ctx, opt, ["magic-protection-arcana:shield"], wanted, budget, { "dampen:0": "magic" }) : null;
      if (fits(r) && await castAt(actor, who, r.values, "Shield")) { done.add("support"); continue; }
    }
    // Personal Repulsion (Gravity T3, replacing Force): attacks with a low Scaling Stat against the ally most at risk have Disadvantage.
    if (role === "support" && tierOf(actor, "magic-gravity") >= 3 && !done.has("repulse") && !done.has("support")) {
      done.add("repulse");
      const who = mostThreatened(me, allies.filter(t => !Act.spellEffects(t.actor, "field").length && dist(me, t) <= 100));
      const r = who ? planSpell(ctx, opt, ["magic-gravity:force"], { "magic-gravity:personal-repulsion": true }, { "replace:magic-gravity:personal-repulsion": true }) : null;
      if (fits(r) && await castAt(actor, who, r.values, "Personal Repulsion")) { done.add("support"); continue; }
    }
    // Burden (Gravity T2, replacing Force): Slow the strongest foe in range that isn't Slowed yet.
    if ((role === "support" || role === "monster") && tierOf(actor, "magic-gravity") >= 2 && !done.has("burden") && !done.has("support")) {
      done.add("burden");
      const prey = foesWithin(me, 200).filter(f => !(f.actor.system.conditions?.slow > 0)).sort((a, b) => b.actor.system.hp.max - a.actor.system.hp.max)[0];
      const r = prey ? planSpell(ctx, opt, ["magic-gravity:force"], { "magic-gravity:burden": true }, { "replace:magic-gravity:burden": true }) : null;
      if (fits(r) && await castAt(actor, prey, r.values, "Burden")) { done.add("support"); continue; }
    }
    // Gravity Field (Gravity T5): Force on every foe within 10 ft of you when two or more are that close (the area starts on you).
    if (tierOf(actor, "magic-gravity") >= 5 && !done.has("field") && !done.has("support")) {
      done.add("field");
      const close = foesWithin(me, 10);
      const r = close.length >= 2 ? planSpell(ctx, opt, ["magic-gravity:force"], { "magic-gravity:gravity-field": true }) : null;
      if (fits(r) && await castAt(actor, close[0], r.values, "Gravity Field")) { done.add("support"); continue; }
    }

    // Restore (Restoration Arcana): the ally (or yourself, or a downed ally) with the most it can still give back in its window, with Painless
    // (it lowers their Pain Threshold: it can wake them) and Resuscitate for the dead. Up to three a turn.
    if (has("magic-restoration-arcana:restore") && (done.restores ?? 0) < 3) {
      const since = Arc.restoreSince(actor);
      const healed = (done.healed ??= {});
      const side = tokensOf(me.parent).filter(t => sideOf(t) === sideOf(me) && sim(t.actor).role !== "creation" && dist(me, t) <= 100);
      const need = t => (healed[t.id] === Infinity ? 0 : Arc.restorable(t.actor, since));
      const who = side.filter(t => need(t) > 0).sort((a, b) => down(b.actor) - down(a.actor) || need(b) - need(a))[0];
      if (who) {
        done.restores = (done.restores ?? 0) + 1;
        const dead = who.actor.statuses.has("dead");
        const r = withMods(ctx, opt, ["magic-restoration-arcana:restore"], [...(dead ? [["magic-restoration-arcana:resuscitate", true]] : []), ["magic-restoration-arcana:painless", true]], budget);
        const before = who.actor.system.hp.value;
        if (fits(r) && await castAt(actor, who, r.values, "Restore")) {
          const gain = Math.max(0, who.actor.system.hp.value - before);
          healed[who.id] = (healed[who.id] ?? 0) + Math.max(1, gain);
          s.healed = (s.healed ?? 0) + gain;
          continue;
        }
        healed[who.id] = Infinity;
      }
    }
    // Mirage (Illusion), once a turn, on the biggest foe in range that has none of yours: Mirage + Strike (their Magic fails them) when you know
    // Strike, else a Mirage whose Fidelity gives them Disadvantage on attack rolls; Phantom Pain and Pervasive when they fit.
    if (has("magic-illusion:mirage") && !done.has("mirage")) {
      done.add("mirage");
      const prey = foesWithin(me, 100).sort((a, b) => b.actor.system.hp.max - a.actor.system.hp.max).find(f => !Act.spellEffects(f.actor, "mirage").some(e => e.flags.flowstate.spellEffect.caster === actor.uuid));
      const strike = has("magic-arcanomancy:strike");
      const ids = strike ? ["magic-illusion:mirage", "magic-arcanomancy:strike"] : ["magic-illusion:mirage"];
      const extra = strike ? {} : { "replace:magic-illusion:fidelity": true, fidelityKind: "dis", fidelityRoll: "attack" };
      const wanted = [...(strike ? [] : [["magic-illusion:fidelity", true]]), ["magic-illusion:phantom-pain", true], ["magic-illusion:pervasive", true]];
      const r = prey ? withMods(ctx, opt, ids, wanted, budget, extra) : null;
      if (fits(r) && await castAt(actor, prey, r.values, strike ? "Mirage + Strike" : "Mirage")) continue;
    }

    // Tier 4: keep the loadout's creation in the fight (it lasts until the start of the caster's next turn), beside the nearest foe in range,
    // as big as up to 60% of the Energy left allows.
    const conj = sim(actor).conj;
    if (conj && !done.has("conj") && !creationsOf(me.parent, actor).length) {
      done.add("conj");
      const near = foesOf(me.parent, me).sort((a, b) => dist(me, a) - dist(me, b))[0];
      const r = near ? conjurePlan(actor, ctx, opt, conj, Math.floor(0.6 * Math.max(0, energy - reserve))) : null;
      const label = conj.cores.map(id => Sp.spellById(id)?.name ?? id).join(" + ");
      if (fits(r) && await castAt(actor, near && dist(me, near) <= 100 ? near : me, r.values, label)) { await adoptCreations(actor, label); continue; }
    }

    // Tier 3 afflictions (each once a turn): coat yourself with Poison before your damage spell (it passes to whoever you next deal direct damage
    // to), Charm the biggest threat's attack rolls, Hex a foe to trigger when it attacks (Charm + Hex when you know both).
    const hasDamage = known.cores.some(c => Fx.profileFor([c.id])?.damage);
    if (has("magic-venomancy:poison") && hasDamage && !done.has("poison") && !Act.spellEffects(actor, "coat").length) {
      done.add("poison");
      const meanPoison = ids => { const a = Fx.profileFor(ids)?.afflict; return a?.dice ? a.dice[0] * (a.dice[1] + 1) / 2 * (a.bypassArmor || a.type === "health" ? 1 : 0.5) : 0; };
      const partner = known.cores.filter(c => c.id !== "magic-venomancy:poison" && Fx.profileFor([c.id, "magic-venomancy:poison"])?.afflict?.kind === "poison")
        .map(c => [c.id, "magic-venomancy:poison"]).sort((x, y) => meanPoison(y) - meanPoison(x))[0];
      const coatIds = partner && planSpell(ctx, opt, partner) && meanPoison(partner) > meanPoison(["magic-venomancy:poison"]) ? partner : ["magic-venomancy:poison"];
      const r = withMods(ctx, opt, coatIds, [["magic-venomancy:potency", true], ["magic-venomancy:lethality", true], ["magic-venomancy:prolong", 1], ["magic-venomancy:virality", true]], budget);
      if (fits(r) && await castAt(actor, me, r.values, "Poison (coat self)")) continue;
    }
    const strongest = foesWithin(me, 100).sort((a, b) => b.actor.system.hp.max - a.actor.system.hp.max);
    if (has("magic-charm:charm") && !done.has("charm")) {
      done.add("charm");
      const prey = strongest.find(f => !Act.spellEffects(f.actor, "charm").length);
      const both = has("magic-witchery:hex");
      const ids = both ? ["magic-charm:charm", "magic-witchery:hex"] : ["magic-charm:charm"];
      const extra = { charmRoll: "attack", hexTrigger: "roll", hexRoll: "attack" };
      const r = prey ? withMods(ctx, opt, ids, [["magic-charm:cloud", true], ["magic-charm:convince", true], ["magic-charm:ingrained", true], ["magic-witchery:unravel", true], ["magic-witchery:fester", true], ["magic-witchery:linger", 1]], budget, extra) : null;
      if (fits(r) && await castAt(actor, prey, r.values, both ? "Charm + Hex" : "Charm")) continue;
    }
    if (has("magic-witchery:hex") && !has("magic-charm:charm") && !done.has("hex")) {
      done.add("hex");
      const prey = strongest.find(f => !Act.spellEffects(f.actor, "hex").length);
      const r = prey ? withMods(ctx, opt, ["magic-witchery:hex"], [["magic-witchery:unravel", true], ["magic-witchery:fester", true], ["magic-witchery:linger", 1], ["magic-witchery:consume", true]], budget, { hexTrigger: "roll", hexRoll: "attack" }) : null;
      if (fits(r) && await castAt(actor, prey, r.values, "Hex")) continue;
    }

    // Damage: the best spell per AP among the Cores and Combos it knows, at the weakest foe in range.
    const dmgCores = known.cores.filter(c => !c.uncombinable && Fx.profileFor([c.id]));
    const combos = [];
    for (let i = 0; i < dmgCores.length; i++) for (let j = i + 1; j < dmgCores.length; j++) if (Fx.profileFor([dmgCores[i].id, dmgCores[j].id])) combos.push([dmgCores[i].id, dmgCores[j].id]);
    const choices = [...dmgCores.map(c => [c.id]), ...combos];
    let target = foesWithin(me, 200)[0];
    if (!target) {
      const nearest = foesOf(me.parent, me).sort((a, b) => dist(me, a) - dist(me, b))[0];
      if (!nearest || !(await approach(actor, me, nearest, 195))) return;
      continue;
    }
    let best = null;
    for (const ids of choices) {
      const r = planSpell(ctx, opt, ids);
      if (!fits(r)) continue;
      if (r.plan.attack === "Targeted" && dist(me, target) > 100.01) continue;
      const value = spellValue(r.plan, target, me) / Math.max(1, r.plan.ap);
      if (value > 0 && (!best || value > best.value)) best = { ids, r, value };
    }
    if (!best) { note(actor, "cast:nothingAffordable"); return; }
    const r = withMods(ctx, opt, best.ids, damageMods(actor, target, best.r.plan, me), budget) ?? best.r;
    if (!fits(r)) return;
    const name = best.ids.map(id => Sp.spellById(id)?.name ?? id).join(" + ");
    if (!(await castAt(actor, target, r.values, name))) return;
  }
}

/** Reload, grapple, close in, attack, and throw a spare weapon at a foe out of reach. */
async function actTurn(actor, me) {
  const s = stat(actor);
  s.turns++;
  s.turnMoved = 0;
  const role = sim(actor).role;
  if (role === "kiter") return kiteTurn(actor, me);
  if (isCaster(actor)) { s.turns--; return casterTurn(actor, me); }
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
      const prey = foes.filter(f => (f.actor.system.size ?? 3) <= (actor.system.size ?? 3) + (tier(actor, "martial-grappling-methods") >= 3 ? 1 : 0))          // Big Hands
        .sort((a, b) => Math.min(...allies.map(x => dist(x, a)), 999) - Math.min(...allies.map(x => dist(x, b)), 999))[0];
      if (prey) {
        const reach = reachOf(actor);
        if (dist(me, prey) > reach + 0.01) { if (!(await approach(actor, me, prey, reach))) { /* fall through to weapons */ } else continue; }
        if (dist(me, prey) <= reach + 0.01) { s.grapples = (s.grapples ?? 0) + 1; if (await attack(actor, me, { item: unarmed, ranged: false, range: reach }, prey, { grapple: true, weight: "heavy" })) { await holdTight(actor); continue; } }
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
        const area = await areaPays(actor, gun, target, foes);
        const pepper = gun.item.system.profile.pepper && !sim(actor).noPepper ? 1 : 0;          // a loadout can turn Pepper off (to test it)
        if (area) s.areaShots = (s.areaShots ?? 0) + 1;
        const wasLoaded = gun.item.system.loaded, apBefore = actor.system.ap.value;
        if (await attack(actor, me, gun, target, { far: !inRange[0], area, pepper })) continue;
        if (!wasLoaded && (gun.item.system.loaded || actor.system.ap.value < apBefore)) continue;          // Quickload reloaded it (no attack)
        return;
      }
    }
    const melee = ready.filter(w => !w.ranged && rolls(w)).sort(order)[0]
      ?? (unarmed && ab.freeFists(actor) >= 1 ? { item: unarmed, ranged: false, range: reachOf(actor), ap: 2 } : null);          // not while that fist holds a grapple
    if (!melee && Act.grappledBy(actor).some(v => v.getFlag?.("flowstate", "grappleWeapon"))) {
      SIM.acting = actor.name;
      note(actor, "releaseImpaled");
      await Act.releaseGrapple(actor);
      await quiet(200, 2000);
      continue;
    }
    if (!melee) {
      if (gun && !gun.loaded) return;                     // out of RP to reload: wait for the next turn
      if (gun && foes.every(f => dist(me, f) > gun.far)) { if (!(await approach(actor, me, nearest, gun.range))) return; continue; }
      return;
    }
    const cost = melee.ap ?? 2;
    if (ap < cost) return;
    const taunter = actor.getFlag("flowstate", "tauntedBy")?.by ? foes.find(f => f.actor?.uuid === actor.getFlag("flowstate", "tauntedBy").by) : null;
    const target = taunter ? taunter : role === "tank" || role === "monster" ? nearest
      : foes.filter(f => dist(me, f) <= melee.range + 0.01).sort((a, b) => a.actor.system.hp.value - b.actor.system.hp.value)[0] ?? nearest;
    if (dist(me, target) > melee.range + 0.01) {
      // Out of reach: throw a spare weapon if one is held and the foe is in throw range (once a fight), else walk in.
      const spare = ready.find(w => !w.ranged && w !== melee && w.throwType && !s.threw);
      const throwRange = spare ? { bad: 50, average: 100, good: 200 }[spare.throwType] : 0;
      const speed = actor.system.movement?.speed ?? 30, stepAp = actor.system.movement?.ap ?? 1;
      const reachable = (dist(me, target) - melee.range) <= speed * Math.max(0, Math.floor((ap - cost) / stepAp));
      // Shield Toss (Defender T2): throw the shield at a foe out of reach; it comes back (Return) and is Strengthened.
      const shield = ready.find(w => w.item.system.weaponType === "defender");
      if (shield && tier(actor, "martial-defender-weapons") >= 2 && !reachable && dist(me, target) <= ({ bad: 50, average: 100, good: 200 }[shield.throwType] ?? 0) && ap >= 2 && energyOf(actor) >= 10) {
        note(actor, "shieldToss");
        if (await attack(actor, me, shield, target, { mode: "throw", extraFill: { shieldToss: true, tossReturn: true, tossStrong: true, tossPay: "ap" } })) continue;
      }
      if (spare && !reachable && dist(me, target) <= throwRange && ap >= 2) {
        s.threw = true;
        if (await attack(actor, me, spare, target, { mode: "throw" })) continue;
      }
      const bare = !actor.items.some(i => i.type === "armor" && i.system.equipped);
      if (!reachable && (tier(actor, "martial-light-armor") >= 2 || (bare && tier(actor, "martial-unarmored") >= 1)) && rpOf(actor) >= 1 && !actor.getFlag("flowstate", "freeMove") && energyOf(actor) >= 10) await runRow(actor, /^Dash/);
      const moved = await approach(actor, me, target, melee.range);
      if (!moved) return;
      continue;
    }
    // Living Weapon (Grappling T5): swing what you hold at another foe in reach, every other attack.
    const victim = Act.grappledBy(actor).find(v => !down(v) && !v.getFlag?.("flowstate", "grappleWeapon"));
    if (victim && tier(actor, "martial-grappling-methods") >= 5 && ap >= 3 && (s.living ?? 0) * 2 <= (s.attacks ?? 0)) {
      const other = foes.filter(f => f.actor?.uuid !== victim.uuid && dist(me, f) <= reachOf(actor) + 0.01)[0];
      if (other) {
        s.living = (s.living ?? 0) + 1;
        setTargets(other);
        const before = new Set(game.messages.keys());
        if (await runRow(actor, /^Living Weapon/)) {
          const m = await waitFor(() => game.messages.contents.find(x => !before.has(x.id) && x.getFlag("flowstate", "attack")?.attacker === actor.uuid), 3000);
          if (m) { s.attacks++; await settle(); continue; }
        }
      }
    }
    // Bodyslam (Heavy Armor T3, 3 AP): every other attack when it's in reach and affordable (Launch, T5, every other Bodyslam).
    if ((tier(actor, "martial-heavy-armor") >= 3 || tier(actor, "martial-titanic-armor") >= 2) && ap >= 3 && dist(me, target) <= reachOf(actor) + 0.01 && energyOf(actor) >= minOf(effStat(actor, "con")) && (s.slams ?? 0) * 2 < (s.attacks ?? 0)) {
      s.slams = (s.slams ?? 0) + 1;
      setTargets(target);
      const before = new Set(game.messages.keys());
      if (await runRow(actor, /^Bodyslam/, { launch: s.slams % 2 === 0 })) {
        const m = await waitFor(() => game.messages.contents.find(x => !before.has(x.id) && x.getFlag("flowstate", "attack")?.attacker === actor.uuid), 3000);
        if (m) { s.attacks++; await settle(); continue; }
      }
    }
    // A creation fights Unarmed with its better stat (Heavy: Strength, Light: Dexterity); everyone else keeps the dialog's default.
    const weight = role === "creation" && melee.item.system.weaponType === "unarmed" ? (effStat(actor, "str") >= effStat(actor, "dex") ? "heavy" : "light") : undefined;
    if (!(await attack(actor, me, melee, target, { weight }))) return;
    await holdTight(actor);                                   // a Thrasher Grapple or Get Over Here! may have just grabbed them
  }
}

function over(scene) {
  const t = tokensOf(scene);
  const real = t.filter(x => sim(x.actor).role !== "creation");
  return !real.some(x => sideOf(x) === "party" && !down(x.actor)) || !real.some(x => sideOf(x) === "monsters" && !down(x.actor));
}

/**
 * Place the party on the left and the monsters on the right. "bench": the dummy right beside a melee tester, 15 ft from a gun (a cluster of
 * three touching); "kite": the two 90 ft apart in the middle of the field.
 */
async function deploy(scene, party, monsters, mode = null, loadout = null) {
  const place = async (a, x, y) => { const td = await a.getTokenDocument({ x: x * 100, y: y * 100 }); return (await scene.createEmbeddedDocuments("Token", [td.toObject()]))[0]; };
  if (mode === "bench") {
    await place(party[0], 8, 7);
    const x0 = loadout?.ranged ? 12 : 9;
    for (const [i, a] of monsters.entries()) await place(a, x0 + (i === 1 ? 1 : 0), 7 + (i === 2 ? 1 : 0));
    return idle(300);
  }
  // Magic school benchmark: the caster 20 ft behind a punching bag, the three raiders 15 ft beyond it (the bag is the nearest foe).
  if (mode === "magicbench") {
    await place(party[0], 5, 10);
    await place(party[1], 10, 10);
    for (const [i, a] of monsters.entries()) await place(a, 14 + (i === 2 ? 1 : 0), 9 + i);
    return idle(300);
  }
  if (mode === "kite") {
    await place(party[0], 30, 40);
    for (const a of monsters) await place(a, 49, 40);
    return idle(300);
  }
  for (const [i, a] of party.entries()) await place(a, 8, 7 + i * 3);
  let n = 0;
  for (const a of monsters) { const col = 26 + (n % 3) * 2, row = 6 + Math.floor(n / 3) * 3; await place(a, col, row); n++; }
  await idle(300);
}

/**
 * Keep only the latest cards rendered in the chat log (the messages stay: the stats are read from them). A long fight renders thousands of cards
 * otherwise, and the browser tab has run out of memory on a big swarm.
 */
function trimChat(keep = 60) {
  for (const root of document.querySelectorAll("#chat .chat-log, .chat-log, #chat-notifications")) {
    const cards = root.querySelectorAll(":scope > .chat-message, :scope > li.message");
    for (let i = 0; i < cards.length - keep; i++) cards[i].remove();
  }
}

/** Run one encounter (an id from R.ENCOUNTERS) and add its results to SIM.results. */
SIM.passId = SIM.passId ?? R.PASS;
const passOf = () => R.PASSES[SIM.passId] ?? R.PASSES[R.PASS];
SIM.fight = async function fight(id, { maxRounds } = {}) {
  const P = passOf();
  maxRounds ??= P.maxRounds ?? 20;
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
    const scene = await arena(P.arena);
    // No canvas (a window of 0 × 0 px can't draw one): tokens can't be targeted and nobody could attack, so stop instead of running empty rounds.
    if (!canvas.ready || canvas.scene?.id !== scene.id) throw new Error(`the canvas isn't drawn (window ${innerWidth}×${innerHeight} px)`);
    const pf = await folderFor("Sim: Party"), mf = await folderFor("Sim: Monsters");
    const party = [];
    for (const p of P.party) party.push(await makeActor(p, p.loadouts[enc.rotation], { party: true, folder: pf }));
    const monsterActors = [];
    for (const k of P.monsters[enc.group].kinds) {
      const a = await makeActor(k, { armor: k.armor, weapons: k.weapons, trees: k.trees, grapple: k.grapple, foci: k.foci, shroud: k.shroud, focus: k.focus, conj: k.conj }, { party: false, folder: mf });
      for (let i = 0; i < k.count; i++) monsterActors.push(a);
    }
    await deploy(scene, party, monsterActors, P.deploy, P.party[0].loadouts[enc.rotation]);
    // Item keys (a thrown weapon leaves the actor, so they're read now).
    F.items = {};
    for (const t of tokensOf(scene)) for (const i of t.actor.items) if (i.type === "weapon") F.items[i.uuid] = weaponKey(i);
    F.trees = Object.fromEntries(party.map(a => [a.name, a.system.trees]));
    F.gear = Object.fromEntries(party.map(a => [a.name, a.items.filter(i => ["weapon", "armor"].includes(i.type)).map(i => `${i.name}${i.system.equipped ? "" : " (not held)"} G${i.system.grade}`)]));
    F.monsterGear = Object.fromEntries(P.monsters[enc.group].kinds.map(k => { const a = monsterActors.find(m => m.name === k.name); return [k.name, a.items.filter(i => ["weapon", "armor"].includes(i.type)).map(i => i.name)]; }));
    F.hpMax = Object.fromEntries(tokensOf(scene).map(t => [t.actor.uuid, t.actor.system.hp.max]));
    F.monsterSide = new Set(tokensOf(scene).filter(t => sideOf(t) === "monsters").map(t => t.actor.uuid));
    const firstIds = new Set(game.messages.keys());
    // Combat.
    const combat = await Combat.create({ scene: scene.id, active: true });
    await combat.createEmbeddedDocuments("Combatant", tokensOf(scene).map(t => ({ tokenId: t.id, sceneId: scene.id, actorId: t.actorId })));
    await combat.rollAll();
    await combat.startCombat();
    SIM.combat = combat;
    let lastKey = null, lastRound = 0;
    const snap = () => {
      const side = k => tokensOf(scene).filter(t => sideOf(t) === k);
      const hp = k => side(k).reduce((n, t) => n + Math.max(0, t.actor.system.hp.value), 0);
      return { round: combat.round, partyHp: hp("party"), monsterHp: hp("monsters"), partyDown: side("party").filter(t => down(t.actor)).length, monstersDown: side("monsters").filter(t => down(t.actor)).length };
    };
    F.roundLog = [];
    F.skips = [];
    const skip = why => { F.skips.push(`${combat.round}:${combat.turn} ${why}`); if (F.skips.length > 40) F.skips.shift(); };
    for (let guard = 0; guard < 1500; guard++) {
      if (combat.round !== lastRound) { lastRound = combat.round; F.roundLog.push(snap()); }
      if (over(scene) || combat.round > maxRounds) break;
      const c = combat.combatant;
      if (!c) { skip(`no combatant (${combat.turns.length} turns)`); await combat.nextTurn(); await idle(50); continue; }
      const key = `${combat.round}:${combat.turn}:${c.id}`;
      if (key === lastKey) { skip(`same turn again: ${c.name}`); await combat.nextTurn(); await idle(50); continue; }
      lastKey = key;
      const actor = c.actor, me = c.token;
      SIM.status = `${id}: round ${combat.round}, ${actor?.name}`;
      if (actor && me && !down(actor)) {
        await waitFor(() => (Number(actor.getFlag("flowstate", "turnStartedAt")) || 0) >= F.started && actor.system.ap.value > 0, 4000);
        await takeTurn(actor, me);
      } else skip(`${c.name}: ${!actor ? "no actor" : !me ? "no token" : "down"}`);
      if (over(scene)) break;
      trimChat();
      await combat.nextTurn();
      await idle(200);
    }
    if (!over(scene) && combat.round <= maxRounds) log.notes.push({ level: "sim", msg: `the turn loop gave up in round ${combat.round}: ${F.skips.slice(-8).join(" | ")}` });
    // Results.
    await idle(800);
    F.roundLog.push({ ...snap(), end: true });
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
  const bySource = new Map();          // damage/defense card id → the weapon and attacker behind it (for the Knockback that hit causes)
  for (const m of msgs) {
    const a = m.getFlag("flowstate", "attack");
    if (!a || !a.opts) continue;
    // Shift / Toss (Geomancy) attack with no spell data on the card: they're counted under Shift.
    const geo = !a.opts.spell && !a.opts.itemUuid && ["Shift", "Toss"].includes(a.opts.label);
    let key = F.creations?.[a.attacker] ? F.creations[a.attacker] : a.opts.spell ? `Spell: ${a.opts.label ?? "?"}` : geo ? `Spell: Shift (${a.opts.label})` : a.opts.knockbackOf && !a.opts.itemUuid ? bySource.get(a.opts.knockbackOf)?.key ?? null : a.opts.itemUuid ? F.items[a.opts.itemUuid] ?? "?" : a.opts.unarmedWeight ? `Unarmed ${a.opts.unarmedWeight === "heavy" ? "Heavy" : "Light"}` : null;
    if (!key) continue;
    // Spells and creations are shared by both sides: the monsters' get their own rows.
    if (/^(Spell|Creation): /.test(key) && F.monsterSide?.has(a.attacker)) key += " [M]";
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
      const src = { key, attacker: a.attacker, attackerName };
      bySource.set(def.id, src); if (dm) bySource.set(dm.id, src);
      const toHp = Number(dm?.getFlag("flowstate", "damage")?.toHp) || 0;
      w.damage += toHp;
      P(a.attacker, attackerName).dealt += toHp;
      P(t.uuid, t.name).taken += toHp;
    });
  }
  // Knockback driven into the ground (or into a wall) deals Force damage on its own card: count it for the weapon whose hit caused it.
  for (const m of msgs.filter(m => m.getFlag("flowstate", "knockbackOf") && !m.getFlag("flowstate", "attack"))) {
    const src = bySource.get(m.getFlag("flowstate", "knockbackOf"));
    if (!src) continue;
    const n = [...(m.content ?? "").matchAll(/<strong>(\d+)<\/strong> damage to HP/g)].reduce((t, x) => t + Number(x[1]), 0);
    W(src.key).damage += n; W(src.key).force = (W(src.key).force ?? 0) + n;
    P(src.attacker, src.attackerName).dealt += n;
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
  // Burning stacks (Ignite, Stain, Electric Stain, Brand) tick on the creature's End of Turn card: the HP each side lost to them (the other side's
  // spells put them there). Everything else a side lost beyond its direct damage taken (Poison, Hex and Charm checks, Force) is `otherLoss`.
  const burn = { party: 0, monsters: 0 };
  const sideByName = name => (tokensOf(scene).find(t => t.actor?.name === name || t.name === name) ? sideOf(tokensOf(scene).find(t => t.actor?.name === name || t.name === name)) : /Goblin|Raider|Ogre/.test(name ?? "") ? "monsters" : "party");
  for (const m of msgs.filter(m => (m.content ?? "").includes(">End of Turn<"))) {
    const tok = scene.tokens.get(m.speaker?.token);
    const side = tok?.actor && sim(tok.actor).id ? sideOf(tok) : sideByName(m.speaker?.alias);
    for (const [, amount, , reached] of (m.content ?? "").matchAll(/(\d+) [A-Za-z]+ from (Ignite|Stain|Electric Stain|Brand)(?: \((\d+) reached HP\))?/g)) burn[side] += Number(reached ?? amount);
  }
  const lostBy = { party: 0, monsters: 0 }, directTaken = { party: 0, monsters: 0 };
  for (const t of tokensOf(scene)) if (F.hpMax[t.actor.uuid] !== undefined) lostBy[sideOf(t)] += Math.max(0, F.hpMax[t.actor.uuid] - Math.max(0, t.actor.system.hp.value));
  for (const c of Object.values(per)) directTaken[/Goblin|Raider|Ogre/.test(c.name) ? "monsters" : "party"] += c.taken;
  const otherLoss = { party: Math.max(0, lostBy.party - directTaken.party - burn.party), monsters: Math.max(0, lostBy.monsters - directTaken.monsters - burn.monsters) };
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
    const key = F.creations?.[atk?.attacker] ? F.creations[atk.attacker] : atk?.opts?.spell ? `Spell: ${atk.opts.label ?? "?"}` : atk?.opts?.itemUuid ? F.items[atk.opts.itemUuid] : atk?.opts?.unarmedWeight ? `Unarmed ${atk.opts.unarmedWeight === "heavy" ? "Heavy" : "Light"}` : null;
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
    trees: F.trees, gear: F.gear, monsterGear: F.monsterGear, gearState, kiteLog: F.kiteLog, roundLog: F.roundLog, firstAttack: F.firstAttack ?? {},
    painDivisor: game.settings.get("flowstate", "painDivisor"), skips: F.skips ?? [], burn, otherLoss, lostBy, directTaken, creations: F.creations ?? {},
    log: { dialogs: { ...log.dialogs }, notes: [...log.notes], errors: [...log.errors] }
  };
}

/** Every encounter of the pass, one after another, in the background. */
SIM.start = function start(ids = passOf().encounters.map(e => e.id), opts = {}) {
  if (SIM.busy) return "already running";
  SIM.busy = true;
  (async () => {
    try {
      for (const id of ids) {
        await SIM.fight(id, opts);
        try { await SIM.save(); } catch (err) { log.errors.push(`save: ${err.message}`); }          // after every fight, so a crash loses one fight at most
      }
    } finally { SIM.busy = false; SIM.status = `finished ${ids.length} fights`; }
  })();
  return `started ${ids.length} fights`;
};
SIM.clear = clearSim;

/** Carry on with the fights of the pass that aren't in the saved results yet (after the tab crashed). */
SIM.resume = async function resume(opts = {}) {
  const P = passOf();
  try {
    const res = await fetch(`/systems/flowstate/dev/sim/results/${P.id}.json?${Date.now()}`);
    if (res.ok) SIM.results = await res.json();
  } catch (err) { /* nothing saved yet */ }
  const done = new Set(SIM.results.filter(r => !r.crashed).map(r => r.id));
  SIM.results = SIM.results.filter(r => !r.crashed);
  await clearSim();
  return SIM.start(P.encounters.map(e => e.id).filter(id => !done.has(id)), opts);
};

/** Write SIM.results to dev/sim/results/<name>.json in the system folder (Foundry's file upload; the GM may upload JSON). */
SIM.save = async function save(name = passOf().id) {
  const file = new File([JSON.stringify(SIM.results, null, 1)], `${name}.json`, { type: "application/json" });
  const FP = foundry.applications.apps.FilePicker.implementation;
  return FP.upload("data", "systems/flowstate/dev/sim/results", file, {}, { notify: false });
};

export default SIM;
