/**
 * Esoteric Arts (Mental T5 tree, Mental Rework Test Ground): the Omen.
 *  Seed (T1): 8 hours of work seed an Omen of a Wonder you have at Tier 5: an NPC of its own (its own turn, AP, RP, and 5 × its skill points of Energy) with
 *  stat points equal to yours (two thirds in its Wonder's stat, one third Willpower, or flipped), a fifth of that in skill points (they only set its dice),
 *  full Mental Theory and its Wonder at Tier 5. It is its own Icon (a natural Icon of the Form picked at Seeding, its Tenet always on) and keeps the
 *  Alignment depth picked. It is one of your Concentrations, kept by a "Bound Omen" effect on it.
 *  Pole-Bound: it knows only its own Wonder; attacks between it and its paired Wonder (Life ↔ Death...) are Strengthened both ways: a paired Omen, or
 *  a Manifest of the paired Wonder. Bond: ending the Concentration yourself dismisses it if it is willing (you Manifested its Wonder more times than its
 *  paired one since it was seeded), otherwise an attack roll does (a miss: it's hostile). Losing the Concentration another way: it fights at your side
 *  for the rest of the battle, turning hostile if angered (you or an ally hits it, or Manifests its paired Wonder within 100 ft of it; the GM's
 *  "Turn hostile" for acting against its pole); after the battle it is free (the GM's) until you rebind it with 1 hour of work.
 *  Channel (T2), Unbind (T3), Kinship (T4), Rend (T5).
 * The user's player runs a bound Omen (or one fighting at their side); a free or hostile one is the GM's.
 */
import { post, applySpellEffect, spellEffects, requestGM, GM_ACTIONS, attackerToken, tokenDistance, inActiveCombat, besideTokenPosition, defend } from "./actions.mjs";
import * as concentration from "./concentration.mjs";
import * as R from "./mental-rules.mjs";
import * as ab from "./abilities.mjs";
import { tierOf } from "./skills.mjs";
import { itemData } from "./catalog.mjs";
import { leaveCombats } from "./conjure.mjs";
import { deriveCharacter } from "./rules.mjs";
import { allied } from "./sides.mjs";
import { mental, CHOICE_PROVIDERS, COST_PROVIDERS, TURN_START, kinshipHook, tenetOf } from "./wonders.mjs";
import { esc, DialogV2, formValues } from "./html.mjs";

export const ESOTERIC = "mental-esoteric-arts";
const BOND = "omenBond";
const OMEN_IMG = "icons/magic/unholy/silhouette-evil-horned-giant.webp";
const tier = a => tierOf(a?.system?.trees ?? {}, ESOTERIC);
const fromU = u => (u ? globalThis.fromUuidSync?.(u) ?? null : null);
const minOf = (a, k) => ab.statMinOf(a, k);
export const omenData = a => a?.flags?.flowstate?.omen ?? null;
export const isOmen = a => !!omenData(a);
const newId = () => globalThis.foundry?.utils?.randomID?.() ?? String(Math.random()).slice(2, 12);
const levels = () => globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS ?? { NONE: 0, OWNER: 3 };
const sides = () => globalThis.CONST?.TOKEN_DISPOSITIONS ?? { HOSTILE: -1, FRIENDLY: 1 };
const statOf = wonderId => R.KINDS[R.wonderById(wonderId)?.kind]?.stat ?? "pon";

/** The paired Wonder (Life ↔ Death, Order ↔ Chaos...): the neighbour of the other type in the doc's order. */
export function pairOf(wonderId) {
  const i = R.WONDERS.findIndex(w => w.id === wonderId), w = R.WONDERS[i];
  if (!w) return null;
  const n = R.WONDERS[w.kind === "dream" ? i + 1 : i - 1];
  return n && n.kind !== w.kind ? n.id : null;
}

/** Your Omens: bound to you, or fighting at your side after the Concentration was lost (not free or hostile ones). You can have as many as your Concentrations allow. */
export function omensOf(user) {
  if (!user) return [];
  return [...(globalThis.game?.actors ?? [])].filter(a => { const d = omenData(a); return d?.owner === user.uuid && !d.hostile && (d.bound || d.battle); });
}
export const omenOf = user => omensOf(user)[0] ?? null;
/** Your Omens that are free (the battle they fought at your side is over), waiting to be rebound. */
export function straysOf(user) {
  return [...(globalThis.game?.actors ?? [])].filter(a => { const d = omenData(a); return d?.owner === user?.uuid && !d.hostile && !d.bound && !d.battle; });
}
export const strayOf = user => straysOf(user)[0] ?? null;
/** The one of `list` with this uuid, the only one, or the one picked in a small dialog. */
async function whichOmen(user, list, uuid, title) {
  if (uuid) return list.find(a => a.uuid === uuid) ?? null;
  if (list.length <= 1) return list[0] ?? null;
  const pick = await mental.pickChoice(user, title, list.map(a => [a.uuid, a.name]));
  return list.find(a => a.uuid === pick) ?? null;
}

/**
 * An Omen's stats: stat points equal to the user's (their base stats), two thirds (rounded down) in its Wonder's Scaling Stat and the rest in Willpower
 * (or the other way round), skill points a fifth of that. `full` (Unbind, a Rend gone wrong): twice the stat points, the same skill points.
 */
export function omenBuild(user, wonderId, { flip = false, full = false } = {}) {
  const base = user?.system?.stats ?? {};
  const total = Object.values(base).reduce((n, v) => n + (Number(v) || 0), 0);
  const stat = statOf(wonderId);
  const main = Math.floor((total * 2) / 3), rest = total - main;
  const make = mult => {
    const s = Object.fromEntries(Object.keys(base).map(k => [k, 0]));
    s[flip ? "will" : stat] = main * mult;
    s[flip ? stat : "will"] = (s[flip ? stat : "will"] ?? 0) + rest * mult;
    return s;
  };
  return { stats: make(full ? 2 : 1), base: make(1), skillPoints: Math.floor(total / 5), total };
}

/** The Wonders an Omen can be seeded from (you have them at Tier 5) and the Forms it can take (its Wonder's type, Common to Rare). */
export function seedChoices(user) {
  const wonders = R.knownWonders(user?.system?.trees ?? {}).filter(w => w.tier >= 5 && w.modes.length);
  const forms = Object.entries(R.FORMS).filter(([, f]) => ["common", "uncommon", "rare"].includes(f.rarity));
  return { wonders, forms };
}
/** What's wrong with these Seed choices (null if nothing). */
export function seedProblem(user, { wonder, form, depth }) {
  const w = seedChoices(user).wonders.find(x => x.id === wonder);
  if (!w) return "You need the Omen's Wonder at Tier 5.";
  const f = R.FORMS[form];
  if (!f || !["common", "uncommon", "rare"].includes(f.rarity)) return "Pick a Common, Uncommon or Rare Form.";
  if (f.align !== w.kind) return `${w.name} is a ${R.KINDS[w.kind].label} Wonder: its Omen takes a ${R.KINDS[w.kind].label} Form.`;
  if (!(Number.isInteger(depth) && depth >= 1 && depth <= R.MAX_ALIGNMENT)) return `Its Alignment depth is 1 to ${R.MAX_ALIGNMENT}.`;
  return null;
}

/** The Seed / Rend dialog: Wonder, Form, Alignment depth and the stat split. */
async function seedDialog(user, title) {
  const { wonders, forms } = seedChoices(user);
  if (!wonders.length) { ui.notifications.warn(`${user.name} has no Wonder at Tier 5 to seed an Omen of.`); return null; }
  const formOpts = ["dream", "nightmare"].map(k => `<optgroup label="${R.KINDS[k].label} Forms">${forms.filter(([, f]) => f.align === k).map(([id, f]) => `<option value="${id}">${esc(f.name)} (${esc(f.rarity)})</option>`).join("")}</optgroup>`).join("");
  const out = await DialogV2().prompt({ window: { title: `${title}: ${user.name}` }, rejectClose: false,
    content: `<div class="fs-cast">
      <div class="fs-field"><label>Wonder <small>(Tier 5)</small></label><select name="wonder">${wonders.map(w => `<option value="${w.id}">${esc(w.name)} (${R.KINDS[w.kind].label})</option>`).join("")}</select></div>
      <div class="fs-field"><label>Form <small>(of its Wonder's type; it is its own Icon)</small></label><select name="form">${formOpts}</select></div>
      <div class="fs-field"><label>Alignment depth</label><select name="depth">${[1, 2, 3, 4].map(n => `<option value="${n}">${n}</option>`).join("")}</select></div>
      <label class="fs-cast-mod"><input type="checkbox" name="flip"> <strong>Flip the split</strong> <small>two thirds Willpower, one third its Wonder's stat</small></label>
    </div>`,
    ok: { label: title, callback: (event, button) => formValues(button.form) } });
  if (!out) return null;
  const pick = { wonder: out.wonder, form: out.form, depth: Math.floor(Number(out.depth)) || 1, flip: !!out.flip };
  const why = seedProblem(user, pick);
  if (why) { ui.notifications.warn(why); return null; }
  return pick;
}

/** Where a new Omen appears: beside the user's token on the scene they're on (no token: nowhere, the GM places it). */
function spot(user) {
  const tok = attackerToken(user);
  if (!tok || !globalThis.canvas?.grid) return { sceneId: null, x: 0, y: 0 };
  const at = besideTokenPosition(tok);
  return { sceneId: globalThis.canvas.scene?.id ?? null, x: at?.x ?? 0, y: at?.y ?? 0 };
}

const bondEffect = (user, conc, w) => ({ kind: BOND, caster: user.uuid, concentration: conc, persistent: true, name: `Bound Omen (${user.name})`,
  description: `Bound to ${user.name}, one of their Concentrations. Manifests only ${w?.name ?? "its Wonder"}; attacks between it and ${R.wonderById(pairOf(w?.id))?.name ?? "its paired Wonder"} are Strengthened.` });

/** Wait (briefly) for something the GM is creating to show up on this client. */
async function waitFor(find, ms = 6000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = find();
    if (v || Date.now() > end) return v ?? null;
    await new Promise(r => setTimeout(r, 100));
  }
}

/** Seed (T1): 8 hours, out of combat; the Omen is one of your Concentrations. */
export async function seed(user) {
  if (tier(user) < 1) return ui.notifications.warn("Seed is an Esoteric Arts ability.");
  if (inActiveCombat(user)) return ui.notifications.warn("Seeding an Omen takes 8 hours: not in combat.");
  const pick = await seedDialog(user, "Seed an Omen");
  if (!pick) return null;
  const conc = `omen:${newId()}`;
  const w = R.wonderById(pick.wonder);
  if (!(await concentration.begin(user, { id: conc, label: `${w.name} Omen`, omen: true }))) return null;
  await requestGM("omenCreate", { user: user.uuid, ...pick, full: false, conc, rend: null, ...spot(user) });
  return post(user, { title: `${esc(user.name)} — Seed`, body: `<div class="fs-result"><i class="fa-solid fa-seedling"></i> After 8 hours, ${esc(user.name)} seeds an <strong>Omen of ${esc(w.name)}</strong> (${esc(R.FORMS[pick.form].name)}, ${R.KINDS[w.kind].label} ${pick.depth}). It is bound to them as one of their Concentrations.</div>` });
}

/** Rend (T5, 2 AP): summon an Omen at once and try to bind it: an attack roll with Disadvantage, it dodging with Advantage. A miss: it's free, full-statted and hostile. */
export async function rend(user) {
  if (tier(user) < 5) return ui.notifications.warn("Rend is Esoteric Arts Tier 5.");
  const pick = await seedDialog(user, "Rend");
  if (!pick) return null;
  if (!(await mental.pay(user, { ap: 2 }, "Rend"))) return null;
  const id = newId();
  await requestGM("omenCreate", { user: user.uuid, ...pick, full: true, conc: null, rend: id, ...spot(user) });
  const omen = await waitFor(() => [...(globalThis.game?.actors ?? [])].find(a => omenData(a)?.rend === id));
  if (!omen) return ui.notifications.warn("The Omen didn't arrive (is a GM connected?).");
  await mental.specialAttack(user, omen, { label: `Rend: bind the ${omen.name}`, net: -1, dodgeNet: 1, notes: ["Rend: Disadvantage on the attack, the Omen dodges with Advantage; a hit binds it, a miss leaves it free and hostile"], flag: { omenRend: { omen: omen.uuid } } });
  return autoDodge(omen);
}

/** The Omen answers its own binding roll (a dodge): its player shouldn't have to choose against their own character. */
async function autoDodge(omen) {
  const msg = (globalThis.game?.messages?.filter?.(m => (m.getFlag?.("flowstate", "attack") ?? m.flags?.flowstate?.attack)?.targets?.some(t => t.uuid === omen.uuid)) ?? []).at(-1);
  if (msg) await defend(msg, 0, "dodge");
}

/** Rend's roll resolved: a hit seeds and binds it as normal (a Concentration, its stats back to normal); a miss leaves it free, full-statted and hostile. */
export async function rendResolve({ attacker, target, result }) {
  if (result.hit) {
    const conc = `omen:${newId()}`;
    if (await concentration.begin(attacker, { id: conc, label: target.name, omen: true })) {
      await requestGM("omenState", { omen: target.uuid, op: "bind", conc });
      return { html: `<div class="fs-result"><i class="fa-solid fa-link"></i> ${esc(target.name)} is seeded and bound to ${esc(attacker.name)} (one of their Concentrations).</div>` };
    }
  }
  await requestGM("omenState", { omen: target.uuid, op: "hostile" });
  return { html: `<div class="fs-result fs-warn"><i class="fa-solid fa-link-slash"></i> ${esc(target.name)} arrives free, with its full stats, and hostile.</div>` };
}

/** Bond, ending it yourself: a willing Omen is dismissed; an unwilling one takes an attack roll (a miss: it's hostile). */
export async function bondResolve({ attacker, target, result }) {
  if (result.hit) {
    await requestGM("omenState", { omen: target.uuid, op: "dismiss" });
    return { html: `<div class="fs-result">${esc(attacker.name)} dismisses ${esc(target.name)}.</div>` };
  }
  await requestGM("omenState", { omen: target.uuid, op: "hostile" });
  return { html: `<div class="fs-result fs-warn"><i class="fa-solid fa-link-slash"></i> The bond is severed: ${esc(target.name)} turns hostile.</div>` };
}

// A Concentration on an Omen ended.
concentration.END_HOOKS.push(async (user, entry, { voluntary }) => {
  if (!entry?.omen) return;
  const omen = [...(globalThis.game?.actors ?? [])].find(a => omenData(a)?.conc === entry.id);
  const d = omenData(omen);
  if (!omen || d.hostile) return;
  if (voluntary) {
    if ((d.own ?? 0) > (d.opp ?? 0)) {
      await requestGM("omenState", { omen: omen.uuid, op: "dismiss" });
      return post(user, { title: `${esc(user.name)} — Bond`, body: `<div class="fs-result">${esc(omen.name)} is willing (${d.own} ${esc(R.wonderById(d.wonder)?.name)} Manifests to ${d.opp}) and is dismissed.</div>` });
    }
    await post(user, { title: `${esc(user.name)} — Bond`, body: `<div class="fs-result">${esc(omen.name)} isn't willing (${d.own ?? 0} ${esc(R.wonderById(d.wonder)?.name)} Manifests to ${d.opp ?? 0} ${esc(R.wonderById(pairOf(d.wonder))?.name)}): an attack roll to dismiss it; a miss severs the bond and it turns hostile.</div>` });
    await mental.specialAttack(user, omen, { label: `Bond: dismiss the ${omen.name}`, notes: ["Bond: a hit dismisses it; a miss severs the bond and it turns hostile"], flag: { omenBond: { omen: omen.uuid } } });
    return autoDodge(omen);
  }
  // Lost another way: it fights on your side for the rest of the battle (no battle: it's free at once).
  const battle = inActiveCombat(user) ? globalThis.game.combat.id : null;
  await requestGM("omenState", { omen: omen.uuid, op: battle ? "ally" : "free", battle });
  return post(user, { title: `${esc(user.name)} — Bond`, body: `<div class="fs-result fs-warn">${esc(user.name)} loses the Concentration on ${esc(omen.name)}. ${battle
    ? "It fights on their side for the rest of this battle, but turns hostile if angered (they or an ally harming it, Manifesting its paired Wonder where it can sense it, or acting against its pole). If it isn't hostile when the battle ends, they can rebind it with 1 hour of work."
    : "It is free; if it isn't hostile, they can rebind it with 1 hour of work."}</div>` });
});

/** Rebind (Action List, 1 hour, not in combat): your free Omen is bound again (one of your Concentrations). */
export async function rebind(user, uuid = null) {
  const omen = await whichOmen(user, straysOf(user), uuid, "Rebind which Omen");
  if (!omen) return ui.notifications.info(`${user.name} has no free Omen to rebind.`);
  if (inActiveCombat(user)) return ui.notifications.warn("Rebinding takes 1 hour of work: not in combat.");
  const conc = `omen:${newId()}`;
  if (!(await concentration.begin(user, { id: conc, label: omen.name, omen: true }))) return null;
  await requestGM("omenState", { omen: omen.uuid, op: "bind", conc });
  return post(user, { title: `${esc(user.name)} — Bond`, body: `<div class="fs-result"><i class="fa-solid fa-link"></i> After an hour of work, ${esc(user.name)} rebinds ${esc(omen.name)}.</div>` });
}

/** Unbind (T3, 2 AP and your stat min in Energy): until the start of your next turn your Omen has its full stats (twice the stat points, the same skill points). */
export async function unbind(user, uuid = null) {
  if (tier(user) < 3) return ui.notifications.warn("Unbind is Esoteric Arts Tier 3.");
  const omen = await whichOmen(user, omensOf(user).filter(a => !omenData(a).unbound && !omenData(a).full), uuid, "Unbind which Omen");
  if (!omen) return ui.notifications.info(`${user.name} has no Omen.`);
  if (omenData(omen).unbound || omenData(omen).full) return ui.notifications.info(`${omen.name} already has its full stats.`);
  if (!(await mental.pay(user, { ap: 2, energy: minOf(user, statOf(omenData(omen).wonder)) }, "Unbind"))) return null;
  await requestGM("omenState", { omen: omen.uuid, op: "unbind" });
  return post(user, { title: `${esc(user.name)} — Unbind`, body: `<div class="fs-result">${esc(omen.name)} has its full stats until the start of ${esc(user.name)}'s next turn (its HP rises with its Max HP).</div>` });
}
// The start of the user's turn: an Unbound Omen goes back to its normal stats (HP above its normal Max HP comes down to it).
TURN_START.push(async actor => {
  for (const a of globalThis.game?.actors ?? []) { const d = omenData(a); if (d?.owner === actor.uuid && d.unbound) await requestGM("omenState", { omen: a.uuid, op: "rebound" }); }
});

/** The GM's Action List button on an Omen: it acted against its pole (or anything else that angers it). */
export const turnHostile = omen => requestGM("omenState", { omen: omen.uuid, op: "hostile" });

/** The battle is over: an Omen fighting at someone's side that isn't hostile is free (the GM's) until it's rebound. Runs on the GM. */
export async function battleOver(combat) {
  for (const a of globalThis.game?.actors ?? []) {
    const d = omenData(a);
    if (!d || d.hostile || d.battle !== combat?.id) continue;
    await GM_ACTIONS.omenState({ omen: a.uuid, op: "free" });
    const user = fromU(d.owner);
    if (user) await post(user, { title: `${esc(user.name)} — Bond`, body: `<div class="fs-notes">The battle is over and ${esc(a.name)} isn't hostile: ${esc(user.name)} can rebind it with 1 hour of work (Action List).</div>` });
  }
}

/* -------------------------------------------- */
/*  Bond counts and anger                       */
/* -------------------------------------------- */

const near = (a, b, ft) => { const ta = attackerToken(a), tb = attackerToken(b); return !ta || !tb || !globalThis.canvas?.grid || tokenDistance(ta, tb) <= ft; };
const onSide = (actor, user) => actor.uuid === user.uuid || allied(actor, user);

/** A Manifest of this Wonder was made: its Omen's Bond count (its Wonder vs its paired one), and an Omen fighting at your side is angered by its paired Wonder. */
export async function manifested(actor, wonderId) {
  for (const a of globalThis.game?.actors ?? []) {
    const d = omenData(a);
    if (!d || d.hostile) continue;
    const pair = pairOf(d.wonder);
    if (d.owner === actor.uuid && (wonderId === d.wonder || wonderId === pair))
      await requestGM("omenState", { omen: a.uuid, op: "count", side: wonderId === d.wonder ? "own" : "opp" });
    const user = fromU(d.owner);
    if (d.battle && !d.bound && user && wonderId === pair && onSide(actor, user) && near(actor, a, 100)) {
      await requestGM("omenState", { omen: a.uuid, op: "hostile" });
      await post(a, { title: `${esc(a.name)} — Angered`, body: `<div class="fs-result fs-warn">${esc(actor.name)} Manifests ${esc(R.wonderById(pair)?.name)} where ${esc(a.name)} can sense it: it turns hostile.</div>` });
    }
  }
}

/** An attack hit an Omen fighting at your side: harmed by you or an ally, it turns hostile. */
export async function anyHit({ attacker, target, result }) {
  const d = omenData(target);
  if (!result?.hit || !d || d.hostile || d.bound || !d.battle || !attacker) return;
  const user = fromU(d.owner);
  if (!user || attacker.uuid === target.uuid || !onSide(attacker, user)) return;
  await requestGM("omenState", { omen: target.uuid, op: "hostile" });
  await post(target, { title: `${esc(target.name)} — Angered`, body: `<div class="fs-result fs-warn">${esc(attacker.name)} harms ${esc(target.name)}: it turns hostile.</div>` });
}

/**
 * Pole-Bound: attacks between an Omen and its paired Wonder are Strengthened, both ways: an Omen attacking (or attacked by) an Omen of its paired
 * Wonder, and a Manifest of an Omen's paired Wonder hitting it. Every target has to qualify.
 */
export function poleStacks(actor, opts, targets) {
  if (!targets?.length) return 0;
  const wonder = opts?.mental?.mode && !opts.mental.ward && !opts.mental.reflect ? opts.mental.wonder : null;
  const ad = omenData(actor);
  const hits = t => {
    const td = omenData(t);
    if (ad && td && pairOf(ad.wonder) === td.wonder) return true;
    return !!(td && wonder && wonder === pairOf(td.wonder));
  };
  return targets.every(hits) ? 1 : 0;
}
export function attackStart(actor, opts, targets) {
  if (!poleStacks(actor, opts, targets)) return opts;
  return { ...opts, stacks: (opts.stacks ?? 0) + 1, notes: [...(opts.notes ?? []), "Pole-Bound: Strengthened (its paired Wonder)"] };
}

/* -------------------------------------------- */
/*  Channel (T2) and Kinship (T4)               */
/* -------------------------------------------- */

/** Channel: the Omen (by uuid) a Manifest is made from, if it's yours and you have Channel. */
const channelOmen = (actor, uuid) => (tier(actor) >= 2 && uuid ? omensOf(actor).find(a => a.uuid === uuid) ?? null : null);
/** Channel: the token of the Omen a Manifest is made from (null if it can't be). */
export function channelFrom(actor, uuid) {
  const omen = channelOmen(actor, uuid);
  return omen ? attackerToken(omen) : null;
}
CHOICE_PROVIDERS.push(actor => (tier(actor) >= 2 && omensOf(actor).length
  ? [{ name: "channel", label: "Channel (⚡ half the Wonder's stat min): Manifest from an Omen's position", options: { "": "No", ...Object.fromEntries(omensOf(actor).map(a => [a.uuid, `From ${a.name}`])) } }] : []));
COST_PROVIDERS.push((actor, { mode, wonder, choices }) => {
  const omen = channelOmen(actor, choices?.channel);
  if (!omen) return null;
  const own = mode?.wonder === omenData(omen).wonder;
  return { energy: Math.floor(minOf(actor, R.KINDS[wonder.kind].stat) / 2), net: own ? 1 : 0, notes: [`Channel: from ${omen.name}'s position${own ? ", Advantage (its own Wonder)" : ""}`] };
});

// Kinship (T4): within 30 ft of an Omen of yours you also benefit from its Tenet; when it's your own selected Tenet, it triggers once more a round (per Omen).
kinshipHook.tenets = actor => {
  if (tier(actor) < 4 || isOmen(actor)) return [];
  return omensOf(actor).filter(o => near(actor, o, 30)).map(o => tenetOf(o)).filter(Boolean);
};

/* -------------------------------------------- */
/*  The GM's side                               */
/* -------------------------------------------- */

const playerOwners = actor => [...(globalThis.game?.users ?? [])].filter(u => !u.isGM && actor?.testUserPermission?.(u, "OWNER")).map(u => u.id);
const mayDirect = (omen, sender) => {
  if (!sender || sender.isGM) return true;
  const user = fromU(omenData(omen)?.owner);
  return !!(user?.testUserPermission?.(sender, "OWNER") || omen.testUserPermission?.(sender, "OWNER"));
};
async function setSide(omen, disposition) {
  for (const scene of globalThis.game?.scenes ?? []) {
    const ids = scene.tokens.filter(t => t.actorId === omen.id).map(t => ({ _id: t.id, disposition }));
    if (ids.length) await scene.updateEmbeddedDocuments("Token", ids);
  }
}
async function setOwners(omen, ids) {
  const L = levels(), ownership = { default: L.NONE };
  for (const u of globalThis.game?.users ?? []) if (!u.isGM) ownership[u.id] = ids.includes(u.id) ? L.OWNER : L.NONE;
  await omen.update({ ownership });
}
async function setStats(omen, stats) {
  const before = omen.system.hp.max ?? 0;
  await omen.update({ "system.stats": stats });
  return before;
}

/** Make an Omen (Seed, Rend): the actor, its natural Icon, its token, and (Seed) the effect that keeps it one of the user's Concentrations. */
GM_ACTIONS.omenCreate = async ({ user, wonder, form, depth, flip, full, conc, rend: rendId, sceneId, x, y }, senderId = null) => {
  const sender = (senderId && globalThis.game.users.get(senderId)) || globalThis.game.user;
  const u = await fromUuid(user);
  if (!u || !(sender?.isGM || u.testUserPermission?.(sender, "OWNER"))) return null;
  if (seedProblem(u, { wonder, form, depth })) return null;
  const w = R.wonderById(wonder);
  const b = omenBuild(u, wonder, { flip, full });
  const size = u.system.size ?? 3;
  const d = deriveCharacter({ stats: b.stats, skillPoints: b.skillPoints, size, omen: true });
  const L = levels(), ownership = { default: L.NONE };
  for (const id of playerOwners(u)) ownership[id] = L.OWNER;
  const actor = await Actor.create({ name: `${w.name} Omen`, type: "npc", img: OMEN_IMG, ownership,
    system: { stats: b.stats, skillPoints: b.skillPoints, size, trees: { "mental-theory": 5, [wonder]: 5 }, hp: { value: d.hpMax, lost: 0 }, energy: { value: d.energyMax } },
    flags: { flowstate: { omen: { owner: u.uuid, wonder, form, depth, flip: !!flip, bound: !!conc, hostile: false, battle: null, conc: conc ?? null, own: 0, opp: 0, base: b.base, full: !!full, unbound: false, rend: rendId ?? null },
      alignment: { kind: w.kind, level: depth } } },
    prototypeToken: { name: `${w.name} Omen`, actorLink: true, disposition: sides().FRIENDLY, displayName: globalThis.CONST?.TOKEN_DISPLAY_MODES?.HOVER } });
  const icon = itemData(`icon.${form}`, { system: { natural: true, attuned: true, tenet: w.tenet?.id ?? "" } });
  if (icon) await actor.createEmbeddedDocuments("Item", [icon], { flowstateAuto: true });
  const scene = sceneId ? globalThis.game.scenes?.get(sceneId) : null;
  if (scene) {
    const td = await actor.getTokenDocument({ x, y });
    const [tok] = await scene.createEmbeddedDocuments("Token", [td.toObject()]);
    const combat = globalThis.game.combat;
    const mine = combat?.started ? combat.combatants.find(c => c.actor?.uuid === u.uuid) : null;
    if (mine && tok) await combat.createEmbeddedDocuments("Combatant", [{ tokenId: tok.id, sceneId, actorId: actor.id, initiative: (Number(mine.initiative) || 0) - 0.01 }]);
  }
  if (conc) await applySpellEffect(actor, bondEffect(u, conc, w));
  return actor.id;
};

const OMEN_OPS = ["hostile", "free", "ally", "bind", "dismiss", "unbind", "rebound", "count"];
export const omenOps = () => [...OMEN_OPS];

/** Change an Omen: hostile / free / fighting at your side ("ally") / bound again, dismissed, Unbind and its end, and the Bond count. */
GM_ACTIONS.omenState = async ({ omen: omenUuid, op, conc = null, battle = null, side = null }, senderId = null) => {
  const sender = (senderId && globalThis.game.users.get(senderId)) || globalThis.game.user;
  const omen = await fromUuid(omenUuid);
  const d = omenData(omen);
  if (!d || !OMEN_OPS.includes(op) || !mayDirect(omen, sender)) return;
  const user = fromU(d.owner);
  const set = v => omen.update({ "flags.flowstate.omen": { ...d, ...v } });
  if (op === "count") return set({ [side === "own" ? "own" : "opp"]: (d[side === "own" ? "own" : "opp"] ?? 0) + 1 });
  if (op === "dismiss") {
    await leaveCombats(omen.id);
    for (const scene of globalThis.game?.scenes ?? []) { const ids = scene.tokens.filter(t => t.actorId === omen.id).map(t => t.id); if (ids.length) await scene.deleteEmbeddedDocuments("Token", ids); }
    return omen.delete();
  }
  if (op === "hostile") {
    for (const e of spellEffects(omen, BOND)) await e.delete();
    await set({ hostile: true, bound: false, battle: null, conc: null });
    await setOwners(omen, []);
    return setSide(omen, sides().HOSTILE);
  }
  if (op === "free") { await set({ bound: false, battle: null, conc: null }); return setOwners(omen, []); }
  if (op === "ally") return set({ bound: false, battle, conc: null });
  if (op === "bind") {
    if (!user) return;
    // A Rend that hit: it is seeded as normal, so its stats come back to normal (HP above the normal Max HP comes down to it).
    if (d.full) { await setStats(omen, d.base); await omen.update({ "system.hp.value": Math.min(omen.system.hp.value, omen.system.hp.max) }); }
    await set({ bound: true, battle: null, hostile: false, conc, full: false, rend: null });
    await setOwners(omen, playerOwners(user));
    await setSide(omen, sides().FRIENDLY);
    if (conc) await applySpellEffect(omen, bondEffect(user, conc, R.wonderById(d.wonder)));
    return;
  }
  if (op === "unbind") {
    const full = Object.fromEntries(Object.entries(d.base ?? {}).map(([k, v]) => [k, 2 * (Number(v) || 0)]));
    const before = await setStats(omen, full);
    await omen.update({ "system.hp.value": omen.system.hp.value + Math.max(0, (omen.system.hp.max ?? 0) - before) });
    return set({ unbound: true });
  }
  if (op === "rebound") {
    await setStats(omen, d.base);
    await omen.update({ "system.hp.value": Math.min(omen.system.hp.value, omen.system.hp.max) });
    return set({ unbound: false });
  }
};

/** The Action List rows for Esoteric Arts (sheets.mjs adds them to the Mental group). */
export function actionRows(actor) {
  const rows = [], t = tier(actor);
  if (isOmen(actor) && globalThis.game?.user?.isGM && !omenData(actor).hostile)
    rows.push({ label: "Turn hostile", detail: "It acted against its pole (or was otherwise angered): it turns on its binder", cost: "GM", action: "omenHostile", icon: "fa-solid fa-link-slash" });
  if (t < 1) return rows;
  rows.push({ label: "Seed an Omen", detail: "8 hours: an Omen of a Wonder you have at Tier 5, bound to you as one of your Concentrations (as many as your Concentrations allow)", cost: "8 hours", action: "omenSeed", icon: "fa-solid fa-seedling", disabled: inActiveCombat(actor) });
  for (const stray of straysOf(actor)) rows.push({ label: `Rebind ${stray.name}`, detail: "1 hour of work: it is bound to you again (one of your Concentrations)", cost: "1 hour", action: "omenRebind", itemId: stray.uuid, icon: "fa-solid fa-link", disabled: inActiveCombat(actor) });
  if (t >= 3) for (const omen of omensOf(actor)) rows.push({ label: `Unbind ${omen.name}`, detail: `${omen.name} has its full stats (twice the stat points) until the start of your next turn`, cost: `2 AP + ⚡ ${minOf(actor, statOf(omenData(omen).wonder))}`, action: "omenUnbind", itemId: omen.uuid, icon: "fa-solid fa-unlock", disabled: !!omenData(omen).unbound || !!omenData(omen).full });
  if (t >= 5) rows.push({ label: "Rend", detail: "Summon an Omen at once: an attack roll with Disadvantage (it dodges with Advantage) binds it; a miss leaves it free, full-statted and hostile", cost: "2 AP", action: "omenRend", icon: "fa-solid fa-burst" });
  return rows;
}
