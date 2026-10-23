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
SIM.choose = null;       // (title, buttons) => the button to press in a wait() dialog

function fillForm(form, vals) {
  if (!vals) return;
  for (const [k, v] of Object.entries(vals)) {
    for (const f of form.querySelectorAll(`[name="${k}"]`)) {
      if (f.type === "checkbox") f.checked = !!v;
      else if (f.type === "radio") f.checked = f.value === String(v);
      else if (f.tagName === "SELECT" && ![...f.options].some(o => o.value === String(v))) continue;
      else f.value = v;
      f.dispatchEvent(new Event("change", { bubbles: true }));
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
    system: { stats: R.statBlock(spec.stats), skillPoints: sp, size: spec.size ?? 3, trees: {} },
    prototypeToken: { name: spec.name, actorLink: !!party, disposition: party ? 1 : -1, displayBars: 40, bar1: { attribute: "hp" } },
    flags: { flowstate: { sim: { id: spec.id, role: spec.role ?? "monster", party: !!party, grapple: !!loadout.grapple } } }
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

/** Attack with `plan` at `target`: the attack card, every defense, the damage, then any follow-up. */
async function attack(actor, me, plan, target, extra = {}) {
  setTargets(target);
  const before = new Set(game.messages.keys());
  SIM.fill = (title, content) => ({ mode: extra.mode ?? (plan.ranged ? (extra.far ? "r2" : "r1") : "strike"), pepper: extra.pepper ?? 0, area: !!extra.area,
    grapple: !!extra.grapple, weight: extra.weight ?? undefined });
  SIM.acting = actor.name;
  try { await Act.rollWeaponAttack(actor, plan.item, extra.followup ?? null); } catch (err) { log.errors.push(`attack ${actor.name}: ${err.stack?.slice(0, 400)}`); }
  const msg = await waitFor(() => game.messages.contents.find(m => !before.has(m.id) && m.getFlag("flowstate", "attack")?.attacker === actor.uuid), 3000);
  if (!msg) return null;
  stat(actor).attacks++;
  F.uses = F.uses ?? {};
  F.uses[plan.item.id] = (F.uses[plan.item.id] ?? 0) + 1;
  await exchange(msg, extra.depth ?? 0);
  return msg;
}

/** Answer every target's defense (always Dodge), wait for the damage, then take a follow-up if one is offered. */
async function exchange(msg, depth = 0) {
  const atk = msg.getFlag("flowstate", "attack");
  for (let i = 0; i < atk.targets.length; i++) {
    if (Act.findDefense(msg.id, i)) continue;
    const t = await fromUuid(atk.targets[i].uuid);
    SIM.acting = t?.name;
    SIM.fill = () => ({});
    try { await Act.defend(msg, i, "dodge"); } catch (err) { log.errors.push(`defend ${t?.name}: ${err.stack?.slice(0, 400)}`); }
  }
  const defs = await waitFor(() => { const d = atk.targets.map((_, i) => Act.findDefense(msg.id, i)); return d.every(Boolean) ? d : null; }, 4000) ?? [];
  const hits = defs.filter(d => d?.getFlag("flowstate", "defense")?.result?.hit);
  if (atk.opts.damage) await waitFor(() => hits.every(d => game.messages.contents.some(m => m.getFlag("flowstate", "damage")?.defenseMessage === d.id)), 5000);
  await idle(100);
  // Knockback (a Force button on the card after a hit): use it.
  for (const d of hits) {
    const card = [d, ...game.messages.contents.filter(m => m.getFlag("flowstate", "damage")?.defenseMessage === d.id)].find(m => m.getFlag("flowstate", "knockback")?.feet > 0);
    if (card) await pushBack(card, depth);
  }
  if (depth >= 3 || !msg.getFlag("flowstate", "followups")?.list?.length) return;          // no follow-up on offer: don't wait for a card
  const card = await waitFor(() => Act.findFollowupCard(msg.id), 1500);
  if (!card) return;
  const attacker = await fromUuid(atk.attacker);
  if (!attacker || down(attacker)) return;
  const me = attacker.getActiveTokens?.()[0]?.document;
  const html = new DOMParser().parseFromString(card.content, "text/html");
  const btn = html.querySelector(".fs-followup");
  if (!btn || !me) return;
  const item = attacker.items.get(btn.dataset.item);
  const plan = item ? weaponPlan(attacker, item) ?? (item.system.weaponType === "unarmed" ? { item, ranged: false, range: reachOf(attacker) } : null) : null;
  if (!plan) return;
  // A gun's follow-up (Solitary) needs a round in it: reload with RP first, as a player would, or let it go.
  if (plan.ranged && !item.system.loaded) {
    if (attacker.system.rp.value < plan.reloadRP) { stat(attacker).followupsNoRP = (stat(attacker).followupsNoRP ?? 0) + 1; return; }
    SIM.acting = attacker.name;
    await Act.reloadWeapon(attacker, item);
    stat(attacker).reloads = (stat(attacker).reloads ?? 0) + 1;
    if (!item.system.loaded) return;
  }
  // The same target if it's still up and in reach, else the nearest foe in reach.
  const first = (await fromUuid(atk.targets[0].uuid))?.getActiveTokens?.()[0]?.document;
  const inReach = t => t && !down(t.actor) && dist(me, t) <= (plan.ranged ? plan.range : plan.range) + 0.01;
  const target = inReach(first) ? first : foesOf(me.parent, me).filter(inReach).sort((a, b) => dist(me, a) - dist(me, b))[0];
  if (!target) return;
  F.followups = (F.followups ?? 0) + 1;
  await attack(attacker, me, plan, target, {
    depth: depth + 1, mode: atk.opts.melee === false && !plan.ranged ? "throw" : undefined,
    followup: { net: Number(btn.dataset.net) || 0, label: btn.dataset.label, weight: btn.dataset.weight || null, source: btn.dataset.source || msg.id, kind: btn.dataset.kind || "",
      whirlwind: "", perfect: false, twinFang: false, flowChain: false, quickStrike: false, attackType: btn.dataset.attackType || null }
  });
}

/**
 * Use a hit's Knockback: into another foe within the Force's reach (an attack roll; both collide on a hit), else down into the ground for melee
 * fighters and monsters (Force damage, prone if it's at least their height: Advantage for melee) or straight away for ranged and support (peeling).
 */
async function pushBack(card, depth) {
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
  // Knocked into someone: that's an attack roll the other creature dodges.
  if (dir === "into") {
    const atk = await waitFor(() => game.messages.contents.find(m => !before.has(m.id) && m.getFlag("flowstate", "attack")), 3000);
    if (atk) await exchange(atk, depth + 3);
  }
}

/** The AI's turn: reload, grapple, close in, attack, and throw a spare weapon at a foe out of reach. */
async function takeTurn(actor, me) {
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
    for (const w of weapons.filter(w => w.ranged && !w.loaded && rp >= w.reloadRP)) { SIM.acting = actor.name; await Act.reloadWeapon(actor, w.item); s.reloads = (s.reloads ?? 0) + 1; }
    const ready = actor.items.filter(i => i.type === "weapon" && i.system.held && i.system.weaponType !== "unarmed").map(i => weaponPlan(actor, i)).filter(w => w && (!w.ranged || w.loaded));
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
        if (await attack(actor, me, gun, target, { far: !inRange[0], area, pepper })) continue;
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
SIM.fight = async function fight(id, { maxRounds = 20 } = {}) {
  const enc = R.ENCOUNTERS.find(e => e.id === id);
  if (!enc) throw new Error(`No encounter ${id}`);
  watch();
  SIM.running = true;
  log.dialogs = {}; log.notes = []; log.errors = [];
  F = { id, group: enc.group, rotation: enc.rotation + 1, actors: {}, started: Date.now(), firstMessage: null };
  try {
    SIM.status = `${id}: setting up`;
    await clearSim();
    const scene = await arena();
    const pf = await folderFor("Sim: Party"), mf = await folderFor("Sim: Monsters");
    const party = [];
    for (const p of R.PARTY) party.push(await makeActor(p, p.loadouts[enc.rotation], { party: true, folder: pf }));
    const monsterActors = [];
    for (const k of R.MONSTERS[enc.group].kinds) {
      const a = await makeActor(k, { armor: k.armor, weapons: k.weapons }, { party: false, folder: mf });
      for (let i = 0; i < k.count; i++) monsterActors.push(a);
    }
    await deploy(scene, party, monsterActors);
    // Item keys (a thrown weapon leaves the actor, so they're read now).
    F.items = {};
    for (const t of tokensOf(scene)) for (const i of t.actor.items) if (i.type === "weapon") F.items[i.uuid] = weaponKey(i);
    F.gear = Object.fromEntries(party.map(a => [a.name, a.items.filter(i => ["weapon", "armor"].includes(i.type)).map(i => `${i.name}${i.system.equipped ? "" : " (not held)"} G${i.system.grade}`)]));
    F.monsterGear = Object.fromEntries(R.MONSTERS[enc.group].kinds.map(k => { const a = monsterActors.find(m => m.name === k.name); return [k.name, a.items.filter(i => ["weapon", "armor"].includes(i.type)).map(i => i.name)]; }));
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
    rounds: combat.round, partyLeft, monstersLeft, followups: F.followups ?? 0, knockbacks: F.knockbacks ?? {},
    hp: Object.fromEntries(tokensOf(scene).map(t => [`${t.actor.name}#${t.id.slice(0, 4)}`, `${Math.max(t.actor.system.hp.value, -9999)}/${t.actor.system.hp.max}`])),
    down: downList,
    weapons: Object.fromEntries(Object.entries(weapons).map(([k, v]) => [k, { ...v, users: [...v.users] }])),
    armor: absorbed,
    creatures: Object.values(per),
    ai: Object.values(F.actors),
    gear: F.gear, monsterGear: F.monsterGear, gearState,
    log: { dialogs: { ...log.dialogs }, notes: [...log.notes], errors: [...log.errors] }
  };
}

/** Every encounter of the pass, one after another, in the background. */
SIM.start = function start(ids = R.ENCOUNTERS.map(e => e.id), opts = {}) {
  if (SIM.busy) return "already running";
  SIM.busy = true;
  (async () => {
    try { for (const id of ids) await SIM.fight(id, opts); } finally { SIM.busy = false; SIM.status = `finished ${ids.length} fights`; }
  })();
  return `started ${ids.length} fights`;
};
SIM.clear = clearSim;

/** Write SIM.results to dev/sim/results/<name>.json in the system folder (Foundry's file upload; the GM may upload JSON). */
SIM.save = async function save(name = R.PASS) {
  const file = new File([JSON.stringify(SIM.results, null, 1)], `${name}.json`, { type: "application/json" });
  const FP = foundry.applications.apps.FilePicker.implementation;
  return FP.upload("data", "systems/flowstate/dev/sim/results", file, {}, { notify: false });
};

export default SIM;
