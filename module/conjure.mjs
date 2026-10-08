/**
 * Tier 4 spells (Summoning, Animation, Creation and Build Arcana's Mods): Summons and Animations are real temporary NPC actors with tokens
 * (owned by the caster, in the combat tracker right after them); Made objects are real items given to a creature or dropped on the scene.
 * They end at the start of the caster's next turn, or with the Ritual they're tied to. The rules math is in conjure-rules.mjs.
 */
import * as R from "./conjure-rules.mjs";
import * as fx from "./spellfx.mjs";
import * as A from "./afflictions.mjs";
import { WEAPON_TYPES, WEAPON_MATERIALS, ARMOR_MATERIALS, ARMOR_WEIGHTS, WEIGHTS, RARITIES } from "./martial.mjs";
import { setActorFlag, post, requestGM, GM_ACTIONS, attackerToken, requestDamage, damageOutcome, giveStacks, putSpellEffect, spellForce, knockbackRow, performAttack, rollWeaponAttack, registerConjure, spendPoints, changeEffect, spellEffects, castStacks } from "./actions.mjs";
import { removeEnergy } from "./elemental.mjs";
import { applyStacks, DAMAGE_TYPES } from "./rules.mjs";

const esc = s => foundry.utils.escapeHTML?.(String(s)) ?? String(s);
const DialogV2 = () => foundry.applications.api.DialogV2;
const roll = formula => new Roll(formula).evaluate();
const cap = s => s[0].toUpperCase() + s.slice(1);

/* -------------------------------------------- */
/*  Where things live                           */
/* -------------------------------------------- */

function allActors() {
  const seen = new Set(), out = [];
  for (const a of globalThis.game?.actors ?? []) if (!seen.has(a.uuid)) { seen.add(a.uuid); out.push(a); }
  for (const t of globalThis.canvas?.tokens?.placeables ?? []) { const a = t.actor; if (a && !seen.has(a.uuid)) { seen.add(a.uuid); out.push(a); } }
  return out;
}
const summonOf = a => a?.flags?.flowstate?.summon ?? null;

/** Where a creation appears: one square beside the targeted creature (or the caster), or null with no scene. */
function placement(actor, targets, tile = null) {
  if (tile) return tile;
  const tgt = targets?.[0]?.actor?.getActiveTokens?.()[0] ?? null;
  const anchor = tgt ?? attackerToken(actor);
  const canvas = globalThis.canvas;
  if (!anchor || !canvas?.grid || !canvas.scene) return null;
  const gs = canvas.grid.size, d = anchor.document;
  return { sceneId: canvas.scene.id, x: d.x + (d.width ?? 1) * gs, y: d.y };
}

/**
 * Pick an empty tile within range on the scene: click it (right-click or Esc cancels). Returns { sceneId, x, y } (top-left), null if cancelled,
 * or undefined when there's no scene to click on. `squares` is the footprint (a size 4 Summon takes 2 × 2).
 */
export function pickTile(actor, { range = 100, squares = 1, title = "Pick a tile" } = {}) {
  const canvas = globalThis.canvas, src = attackerToken(actor);
  if (!canvas?.grid || !canvas.scene || !src || !canvas.stage?.on) return Promise.resolve(undefined);
  const gs = canvas.grid.size, n = Math.max(1, Math.ceil(squares));
  const problem = pt => {
    const cx = pt.x + gs * n / 2, cy = pt.y + gs * n / 2;
    const d = canvas.grid.measurePath([src.center, { x: cx, y: cy }]).distance - ((src.document.width ?? 1) + n) / 2 * canvas.grid.distance;
    if (d > range) return `That tile is ${Math.round(d)} ft away (range ${range} ft).`;
    for (const t of canvas.tokens.placeables) {
      const w = (t.document.width ?? 1) * gs, h = (t.document.height ?? 1) * gs;
      if (t.document.x < pt.x + n * gs && pt.x < t.document.x + w && t.document.y < pt.y + n * gs && pt.y < t.document.y + h) return "That tile isn't empty.";
    }
    return "";
  };
  return new Promise(resolve => {
    ui.notifications.info(`${title}: click an empty tile within ${range} ft (right-click or Esc to cancel).`);
    const stage = canvas.stage;
    const done = v => { stage.off("pointerdown", onDown); window.removeEventListener("keydown", onKey); resolve(v); };
    const onKey = e => { if (e.key === "Escape") done(null); };
    const onDown = ev => {
      if (ev.button === 2) return done(null);
      if (ev.button !== 0) return;
      const local = ev.getLocalPosition ? ev.getLocalPosition(stage) : ev.data.getLocalPosition(stage);
      const pt = canvas.grid.getTopLeftPoint(local);
      const bad = problem(pt);
      if (bad) return ui.notifications.warn(bad);
      done({ sceneId: canvas.scene.id, x: pt.x, y: pt.y });
    };
    stage.on("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
  });
}

/** Users (other than GMs) who own the caster: they own what it makes. */
const ownerIds = actor => (globalThis.game?.users ?? []).filter(u => !u.isGM && actor.testUserPermission?.(u, "OWNER")).map(u => u.id);

/* -------------------------------------------- */
/*  GM operations                               */
/* -------------------------------------------- */

GM_ACTIONS.createCreation = async ({ sceneId, x, y, data, items, owners, initiative }) => {
  const scene = globalThis.game.scenes.get(sceneId);
  const ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE };
  for (const id of owners ?? []) ownership[id] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  const actor = await Actor.create({ ...data, type: "npc", ownership,
    prototypeToken: { name: data.name, actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY, displayName: CONST.TOKEN_DISPLAY_MODES.HOVER } });
  if (items?.length) await actor.createEmbeddedDocuments("Item", items, { flowstateAuto: true });
  if (scene) {
    const td = await actor.getTokenDocument({ x, y });
    const [tok] = await scene.createEmbeddedDocuments("Token", [td.toObject()]);
    const combat = globalThis.game.combat;
    if (combat?.started && initiative !== null && initiative !== undefined && tok) await combat.createEmbeddedDocuments("Combatant", [{ tokenId: tok.id, sceneId, actorId: actor.id, initiative }]);
  }
  return actor.id;
};
GM_ACTIONS.deleteCreation = async ({ actorId }) => {
  const actor = globalThis.game.actors.get(actorId);
  if (!actor) return;
  for (const scene of globalThis.game.scenes) {
    const ids = scene.tokens.filter(t => t.actorId === actorId).map(t => t.id);
    if (ids.length) await scene.deleteEmbeddedDocuments("Token", ids);
  }
  await actor.delete();
};
GM_ACTIONS.giveItems = async ({ actor, items }) => {
  const a = await fromUuid(actor);
  if (a) await a.createEmbeddedDocuments("Item", items, { flowstateAuto: true });
};
GM_ACTIONS.deleteMade = async ({ uuids }) => {
  for (const u of uuids) { const i = await fromUuid(u); if (i) await i.delete({ flowstateTransfer: true }); }
};

/* -------------------------------------------- */
/*  The dialogs                                 */
/* -------------------------------------------- */

const formValues = form => {
  const v = {};
  for (const el of form.elements) if (el.name && !el.disabled) v[el.name] = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value;
  return v;
};
const select = (name, options, value) => `<select name="${name}">${options.map(([k, label]) => `<option value="${k}" ${String(value) === String(k) ? "selected" : ""}>${esc(label)}</option>`).join("")}</select>`;
const field = (label, html) => `<div class="fs-field"><label>${esc(label)}</label>${html}</div>`;
const WEAPON_CHOICES = Object.entries(WEAPON_TYPES).filter(([k]) => k !== "unarmed" && k !== "improvised").map(([k, w]) => [k, w.label]);

/** The rarities a Make can use, and the equipment materials of that rarity for a weight. */
export function makeMaterials(kind, weight, rarities) {
  const table = kind === "armor" ? ARMOR_MATERIALS : WEAPON_MATERIALS;
  return Object.entries(table).filter(([, m]) => m.weights[weight] && rarities.includes(m.rarity)).map(([k, m]) => [k, `${m.label} (${RARITIES[m.rarity]})`]);
}

function itemRowHTML(i, spec, rarities, complexity) {
  const it = spec.items?.[i] ?? {};
  const kind = it.kind ?? "weapon";
  const weights = kind === "armor" ? Object.keys(ARMOR_WEIGHTS) : Object.keys(WEIGHTS);
  const weight = weights.includes(it.weight) ? it.weight : weights[0];
  const mats = makeMaterials(kind, weight, rarities);
  const extra = Array.from({ length: complexity }, (_, k) => field(`Extra type ${k + 1}`, select(`i${i}x${k}`, [["", "—"], ...WEAPON_CHOICES], it.extra?.[k] ?? "")));
  return `<fieldset><legend>Object ${i + 1}</legend>
    ${field("What", select(`i${i}kind`, [["weapon", "Weapon (Archetypal)"], ["armor", "Armor (Archetypal)"], ["object", "Other object (Non-Archetypal)"]], kind))}
    ${field("Weapon type", select(`i${i}type`, WEAPON_CHOICES, it.type ?? "bladed"))}
    ${field("Weight", select(`i${i}weight`, weights.map(w => [w, cap(w)]), weight))}
    ${field("Material", select(`i${i}material`, mats, it.material ?? mats[0]?.[0]))}
    ${field("Object (name, material, shape)", `<input type="text" name="i${i}name" value="${esc(it.name ?? "")}">`)}
    ${extra.join("")}</fieldset>`;
}

/**
 * Ask what the spell makes. Returns the spec, or null if cancelled or invalid. `values.conj` presets it (for the macro / tests).
 * @param c  { actor, plan, profile, mods, applied, targets }
 */
export async function prompt({ actor, plan, profile, mods, values, targets }) {
  const cj = profile.conjure;
  const mult = R.conjureMultiplier(plan.base, plan.combo, cj.fear ? 2 : 1);   // Illusion's extra baseline is 2
  const ctx = describe({ actor, plan, profile, mods, mult });
  let spec = values?.conj ?? null;
  if (!spec) {
    const html = dialogHTML(ctx, {});
    spec = await DialogV2().prompt({ window: { title: `${profile.name}: what do you make?` }, content: `<div class="fs-cast">${html}</div>`,
      ok: { label: "Make it", callback: (event, button) => parse(ctx, formValues(button.form)) }, rejectClose: false });
    if (!spec) return null;
  }
  const check = validate(ctx, spec);
  if (!check.ok) { ui.notifications.warn(check.errors.join(" ")); return null; }
  // Summons and Animations appear on an empty tile in range you click; so do Made objects left on the ground.
  const needsTile = cj.kind === "summon" || cj.kind === "animate" ? !ctx.equipment : spec.recipient === "drop";
  if (needsTile && spec.tile === undefined) {
    const size = cj.kind === "summon" ? R.formSize(spec.size, ctx.gross) : cj.kind === "animate" ? R.animationSize(cj.instant ? ctx.pool : Number(spec.body) || ctx.bodyMin) : 1;
    const squares = { 1: 0.25, 2: 0.5, 3: 1, 4: 2, 5: 4 }[size] ?? 1;
    const tile = await pickTile(actor, { range: 100 * (mods.snipe ? 2 : 1), squares, title: profile.name });
    if (tile === null) return null;
    spec.tile = tile ?? null;
  }
  return { ...spec, mult, ctx: undefined };
}

/** What the cast allows: pool, sizes, Arms, Skin, Creation limits. Pure given its inputs. */
export function describe({ actor, plan, profile, mods, mult }) {
  const cj = profile.conjure;
  const applied = plan.applied ?? [];
  const arms = applied.filter(a => a.mod.name === "Arm").map(a => a.threshold);
  const skin = applied.find(a => a.mod.name === "Skin");
  const expanded = !!mods["expanded animation"];
  const st = castStacks(actor, plan);                 // Strengthened/Weakened scales the bolded pools (Body, points)
  const scale = n => applyStacks(n, st);
  const rarities = R.makeRarities({ mk2: !!mods["make mk2"], mk3: !!mods["make mk3"] });
  return { cj, actor, mult, gross: plan.gross ?? plan.threshold, mods, arms, skin: skin?.threshold ?? 0, expanded, rarities, complexity: mods.complexity ?? 0,
    armory: mods.armory ?? 0, pool: scale(cj.instant ? 10 * mult : (cj.kind === "summon" || cj.summonStats) ? R.summonPool(mult) : R.formPool(mult)), bodyMin: scale(cj.instant ? 10 * mult : R.formPool(mult)), makes: cj.kind === "make" || !!cj.make, scaling: plan.scaling ?? 0,
    equipment: !!(mods["weapon/foci"] || mods["armor/shroud"]), combo: plan.combo };
}

function dialogHTML(ctx, spec) {
  const cj = ctx.cj, out = [];
  if (ctx.equipment) return `<p>Pick the equipment on the card that follows (it must be within range).</p>`;
  if (cj.kind === "summon" || cj.summonStats) {
    out.push(`<p class="hint">${ctx.pool} points: Body 1 each (Strength, Dexterity and Constitution need at least 1), Skill 2 each.</p>`);
    if (cj.kind === "summon") out.push(field("Size", select("size", R.formSizes(ctx.gross).map(s => [s, `Size ${s}`]), spec.size ?? 1)));
    out.push(field("Strength", `<input type="number" name="str" value="${spec.str ?? 1}" min="1">`), field("Dexterity", `<input type="number" name="dex" value="${spec.dex ?? 1}" min="1">`),
      field("Constitution", `<input type="number" name="con" value="${spec.con ?? 1}" min="1">`), field("Skill (points)", `<input type="number" name="skill" value="${spec.skill ?? 0}" min="0">`));
  }
  if (cj.kind === "animate") {
    const opts = R.ANIM_MATERIALS.filter(m => R.animationAllowed(m.category, ctx.expanded)).map(m => [m.name, `${m.name} — ${R.ANIM_CATEGORIES[m.category].label} (${RARITIES[m.rarity]})`]);
    out.push(field("Material", select("material", opts, spec.material ?? opts[0]?.[0])));
    if (!cj.instant) out.push(field(`Body of material (at least ${ctx.bodyMin})`, `<input type="number" name="body" value="${spec.body ?? ctx.bodyMin}" min="${ctx.bodyMin}">`));
  }
  if (cj.kind === "summon") for (const [i, t] of ctx.arms.entries()) {
    out.push(`<fieldset><legend>Arm ${i + 1} (${t === 2 ? "both arms, one weapon" : "one arm"})</legend>${field("Weapon type", select(`arm${i}type`, WEAPON_CHOICES, spec.arms?.[i]?.type ?? "bladed"))}${field("Weight", select(`arm${i}weight`, [["light", "Light"], ["heavy", "Heavy"]], spec.arms?.[i]?.weight ?? "light"))}</fieldset>`);
  }
  if (cj.kind === "make") for (let i = 0; i < 1 + ctx.armory; i++) out.push(itemRowHTML(i, spec, ctx.rarities, ctx.complexity));
  if (cj.make && cj.kind !== "make") out.push(itemRowHTML(0, { items: spec.items }, ctx.rarities, ctx.complexity));
  if (cj.kind === "make") out.push(field("Goes to", select("recipient", [["self", "Your own inventory"], ["target", "Your target's inventory (attack roll; a miss drops it beside them)"], ["drop", "On an empty tile in range"]], spec.recipient ?? "self")));
  if (ctx.mods.harden && cj.geo) out.push(field("Harden: its natural/made equipment", select("harden", [["strong", "Its damage is Strengthened"], ["armor", "Damage to it is Weakened"], ["all", "Both"]], spec.harden ?? "strong")));
  if (ctx.mods["limited autonomy"] && (cj.kind === "summon" || cj.kind === "animate")) out.push(field("Limited Autonomy: its command (one short sentence)", `<input type="text" name="command" value="${esc(spec.command ?? "")}">`));
  out.push(field("Name", `<input type="text" name="name" value="${esc(spec.name ?? "")}">`));
  return out.join("");
}

/** The form's values as a spec. */
function parse(ctx, v) {
  const cj = ctx.cj;
  const spec = { name: v.name || "", size: Number(v.size) || 1, str: v.str, dex: v.dex, con: v.con, skill: v.skill, material: v.material, body: v.body, recipient: v.recipient || "self", command: v.command || "", harden: v.harden || "strong", arms: [], items: [] };
  for (let i = 0; i < ctx.arms.length; i++) spec.arms.push({ type: v[`arm${i}type`] || "bladed", weight: v[`arm${i}weight`] || "light" });
  const n = cj.kind === "make" ? 1 + ctx.armory : cj.make ? 1 : 0;
  for (let i = 0; i < n; i++) spec.items.push({ kind: v[`i${i}kind`] || "weapon", type: v[`i${i}type`] || "bladed", weight: v[`i${i}weight`] || "light", material: v[`i${i}material`], name: v[`i${i}name`] || "",
    extra: Array.from({ length: ctx.complexity }, (_, k) => v[`i${i}x${k}`]).filter(Boolean) });
  return spec;
}

/** Is the spec legal for this cast? */
export function validate(ctx, spec) {
  const errors = [], cj = ctx.cj;
  if (ctx.equipment) return { ok: true, errors };
  if (cj.kind === "summon" || cj.summonStats) {
    const f = R.formStats(spec, ctx.pool);
    if (!f.ok) errors.push(...f.errors);

    if (cj.kind === "summon" && !R.formSizes(ctx.gross).includes(Math.floor(+spec.size || 1))) errors.push(`Size ${spec.size} needs a Threshold of at least ${spec.size >= 4 ? 10 : 5} (this cast is ${ctx.gross}).`);
  }
  if (cj.kind === "animate") {
    const m = R.animMaterial(spec.material);
    if (!m) errors.push("Pick a material.");
    else if (!R.animationAllowed(m.category, ctx.expanded)) errors.push(`${m.name} is a ${R.ANIM_CATEGORIES[m.category].label} material: Animate needs Expanded Animation for it.`);
    if (!cj.instant && (Number(spec.body) || 0) < ctx.bodyMin) errors.push(`The pile must be at least ${ctx.bodyMin} Body.`);
  }
  if (cj.make || cj.kind === "make") {
    const items = spec.items ?? [];
    if (!items.length) errors.push("Choose what to make.");
    for (const it of items) {
      if (it.kind === "object") continue;
      const table = it.kind === "armor" ? ARMOR_MATERIALS : WEAPON_MATERIALS, m = table[it.material];
      if (!m) errors.push("Pick a material.");
      else if (!m.weights[it.weight]) errors.push(`${m.label} can't be ${it.weight}.`);
      else if (!ctx.rarities.includes(m.rarity)) errors.push(`${m.label} is ${RARITIES[m.rarity]}: Make can only create ${ctx.rarities.map(r => RARITIES[r]).join(" or ")} equipment (Make Mk2 / Mk3 allow more).`);
    }
  }
  if (!R.mk3Needs({ mk2: !!ctx.mods["make mk2"], mk3: !!ctx.mods["make mk3"] })) errors.push("Make Mk3 needs Make Mk2 on the same Spell.");
  for (const [i, t] of ctx.arms.entries()) if (!spec.arms?.[i]) errors.push(`Choose a weapon for Arm ${i + 1}.`);
  return { ok: errors.length === 0, errors };
}

/* -------------------------------------------- */
/*  Making things                               */
/* -------------------------------------------- */

const madeFlag = (actor, ritualOf, extra = {}) => ({ flowstate: { made: { caster: actor.uuid, ritualOf: ritualOf ?? null, ...extra } } });

/** The item data for a Made weapon or armor (Grade 2), or a plain object. */
export function itemData(it, { actor, ritualOf = null, extraFlags = {}, equipped = false } = {}) {
  const flags = madeFlag(actor, ritualOf, extraFlags);
  if (it.kind === "armor") {
    return { name: it.name || `${ARMOR_MATERIALS[it.material]?.label ?? it.material} ${cap(it.weight)} Armor`, type: "armor", flags,
      system: { weight: it.weight, material: it.material, grade: 2, equipped } };
  }
  if (it.kind === "object") return { name: it.name || "Conjured object", type: "gear", flags, system: { quantity: 1, description: `<p>Conjured${it.name ? `: ${esc(it.name)}` : ""}. Lasts until the start of the caster's next turn (or the Ritual ends).</p>` } };
  const extraTypes = (it.extra ?? []).filter(Boolean);
  return { name: it.name || `${WEAPON_MATERIALS[it.material]?.label ?? it.material} ${WEAPON_TYPES[it.type]?.label ?? it.type}`, type: "weapon", flags,
    system: { weaponType: it.type, weight: it.weight, material: it.material, grade: 2, extraTypes, equipped } };
}

const martialTrees = actor => Object.fromEntries(Object.entries(actor.system?.trees ?? {}).filter(([k, v]) => k.startsWith("martial-") && v > 0));

/** Riders: what a Combo with a Tier 1/2/3 Core adds to the creation's attacks. */
const riderOf = (cj, values, level) => (cj.rider ? { core: cj.rider, level, arcane: !!cj.arcane, charmRoll: values?.charmRoll ?? null, hex: values?.hexTrigger ? { trigger: values.hexTrigger, roll: values.hexRoll, outcome: values.hexOutcome, detail: values.hexDetail } : null, hexDie: values?.hexDie ?? null } : null);

async function creatingCombatInit(actor) {
  const c = globalThis.game.combat;
  const mine = c?.started ? c.combatants.find(x => x.actor?.uuid === actor.uuid) : null;
  return mine ? (Number(mine.initiative) || 0) - 0.01 : null;
}

async function spawn({ actor, name, system, flags, items, targets, tile }) {
  const at = placement(actor, targets, tile);
  const payload = { sceneId: at?.sceneId, x: at?.x ?? 0, y: at?.y ?? 0, data: { name, img: "icons/svg/mystery-man.svg", system, flags }, items, owners: ownerIds(actor), initiative: await creatingCombatInit(actor) };
  return requestGM("createCreation", payload);
}

/** Geomancy Combos: a natural ranged strike (100 ft; no reloading). */
function geoRanged(actor, ritualOf, scaling) {
  return { name: "Natural Ranged Strike", type: "weapon", flags: madeFlag(actor, ritualOf),
    system: { weaponType: "rapid", weight: "light", material: "hardwood", grade: Math.max(1, Math.floor((scaling || 0) / 10)), equipped: true, natural: true, returning: true, rounds: 99, magazine: 99 } };
}

/** Harden (Geomancy T5) on a Geomancy Combo's creation: its equipment's damage is Strengthened and/or damage to it Weakened. */
function hardenItems(items, mods, spec, cj) {
  if (!mods.harden || !cj.geo) return;
  const c = spec.harden || "strong";
  for (const i of items) { i.flags ??= {}; i.flags.flowstate ??= {}; i.flags.flowstate.made ??= {}; i.flags.flowstate.made.harden = { strong: c === "strong" || c === "all", armor: c === "armor" || c === "all" }; }
}

/** Form: a Summon. */
async function makeSummon({ actor, plan, profile, spec, mods, ritualOf, targets, values }) {
  const cj = profile.conjure;
  const ctx = describe({ actor, plan, profile, mods, mult: spec.mult });
  const f = R.formStats(spec, ctx.pool);
  const size = R.formSize(spec.size, ctx.gross);
  const eff = actor.system.derived.effective;
  const layered = (mods.layered ?? 0) * R.layeredBonus(eff.build.value, false);
  const hp = R.summonHealth(f.stats.con, size) + layered;
  const energy = R.summonEnergy(f.stats.con);
  const level = R.riderLevel(f.stats.str + f.stats.dex);
  const items = [];
  const scaling = Math.max(f.stats.str, f.stats.dex);
  for (const [i, t] of ctx.arms.entries()) {
    const w = R.naturalWeapon({ weaponType: spec.arms[i].type, weight: spec.arms[i].weight, scaling });
    items.push({ name: `Natural ${WEAPON_TYPES[w.weaponType]?.label ?? w.weaponType} (${cap(w.weight)})`, type: "weapon", flags: madeFlag(actor, ritualOf),
      system: { ...w, equipped: true, natural: true, returning: !!cj.geo, twoHanded: t === 2, rounds: 1, magazine: 1 } });
  }
  // Summoning + Geomancy: a natural ranged variant of its unarmed attack (100 ft, never needs reloading); melee natural weapons return when thrown.
  if (cj.geo) items.push(geoRanged(actor, ritualOf, scaling));
  if (ctx.skin) {
    const a = R.naturalArmor({ threshold: ctx.skin, con: f.stats.con });
    items.push({ name: `Natural ${cap(a.weight)} Armor`, type: "armor", flags: madeFlag(actor, ritualOf), system: { ...a, equipped: true, natural: true } });
  }
  if (cj.make && spec.items?.[0]) items.push(itemData(spec.items[0], { actor, ritualOf, equipped: true }));
  hardenItems(items, mods, spec, cj);
  const sm = { owner: actor.uuid, ritualOf: ritualOf ?? null, kind: "summon", hp, energy, attackDie: actor.system.derived.attackDie, dodgeDie: actor.system.derived.dodgeDie, ap: 6, rp: 6, reform: !!mods.reform, reactive: !!mods.reactive, reformMark: hp, fear: !!cj.fear, senseSwap: !!mods["sense swap"], command: mods["limited autonomy"] ? spec.command || "" : "",
    rider: riderOf(cj, values, level) };
  const name = spec.name || `${actor.name}'s Summon`;
  const id = await spawn({ actor, name, system: { stats: { str: f.stats.str, dex: f.stats.dex, con: f.stats.con, pon: 0, snap: 0, will: 0, reach: 0, grasp: 0, build: 0 }, skillPoints: f.skillPoints, size, trees: martialTrees(actor), hp: { value: hp, lost: 0 }, energy: { value: energy } }, flags: { flowstate: { summon: sm } }, items, targets, tile: spec.tile });
  const lines = [`Strength ${f.stats.str}, Dexterity ${f.stats.dex}, Constitution ${f.stats.con} · Size ${size}`,
    `${hp} health${layered ? ` (Layered +${layered})` : ""} (no regeneration or Pain Threshold) · ${energy} Energy (its own, for Martial skills)`,
    `${f.skillPoints ? `${f.skillPoints} skill point${f.skillPoints === 1 ? "" : "s"} to spend on Martial trees (it already knows yours) · ` : ""}it uses your attack and dodge dice`,
    ...items.map(i => `${i.name}${i.system.twoHanded ? " (two-handed)" : ""}: natural, can't be dropped${i.type === "weapon" ? " or thrown" : ""}`),
    ...(sm.rider ? [`Its attacks carry ${fx.profileFor([sm.rider.core])?.name ?? sm.rider.core} (level ${level})`] : [])];
  const notes = [mods["sense swap"] ? "Sense Swap: spend 2 RP from the Action List to swap senses with it (spells are then cast from its position)." : "", mods["limited autonomy"] ? `Limited Autonomy: on its turn it follows its command by itself${spec.command ? ` ("${spec.command}")` : ""}.` : "",
    "It shares your turn order and acts right after your turn; it's Mindless and uses your senses."].filter(Boolean);
  await post(actor, { title: `${esc(actor.name)} — Summon`, body: `<div class="fs-result"><i class="fa-solid fa-ghost"></i> ${esc(name)} appears${ritualOf ? " (until the Ritual ends)" : " until the start of your next turn"}.</div><ul class="fs-list">${lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul><div class="fs-notes">${esc(notes.join(" "))}</div>` });
  return id;
}

/** Animate: an Animation from a pile of material. */
async function makeAnimation({ actor, plan, profile, spec, mods, ritualOf, targets, values }) {
  const cj = profile.conjure;
  const ctx = describe({ actor, plan, profile, mods, mult: spec.mult });
  const mat = R.animMaterial(spec.material);
  const points = cj.summonStats ? ctx.bodyMin : ctx.pool;
  const body = cj.instant ? points : Number(spec.body) || points;
  const size = R.animationSize(body);
  const f = cj.summonStats ? R.formStats(spec, ctx.pool) : null;
  const st = R.animationStats({ points, category: mat.category, size, stats: f?.stats ?? null });
  const eff = actor.system.derived.effective;
  const layered = (mods.layered ?? 0) * R.layeredBonus(eff.build.value, false);
  const hp = st.hp + layered;
  const energy = R.summonEnergy(st.con);
  const level = R.riderLevel(f ? f.stats.str + f.stats.dex : points);
  const cat = R.ANIM_CATEGORIES[mat.category];
  const sm = { owner: actor.uuid, ritualOf: ritualOf ?? null, kind: "animation", material: mat.name, category: mat.category, hp, energy, attackDie: actor.system.derived.attackDie, dodgeDie: actor.system.derived.dodgeDie,
    speed: st.speed, physical: st.physical, ap: st.ap, rp: st.rp, reform: !!mods.reform, reactive: !!mods.reactive, senseSwap: !!mods["sense swap"], command: mods["limited autonomy"] ? spec.command || "" : "", reformMark: hp, fear: !!cj.fear, rider: riderOf(cj, values, level) };
  const items = [];
  if (cj.geo) items.push(geoRanged(actor, ritualOf, Math.max(st.str, st.dex)));
  if (cj.make && spec.items?.[0] && !cj.instant) items.push(itemData(spec.items[0], { actor, ritualOf, equipped: true }));
  hardenItems(items, mods, spec, cj);
  const name = spec.name || `${mat.name} Animation`;
  const id = await spawn({ actor, name, system: { stats: { str: st.str, dex: st.dex, con: st.con, pon: 0, snap: 0, will: 0, reach: 0, grasp: 0, build: 0 }, skillPoints: f?.skillPoints ?? 0, size, trees: martialTrees(actor), hp: { value: hp, lost: 0 }, energy: { value: energy } }, flags: { flowstate: { summon: sm } }, items, targets, tile: spec.tile });
  await post(actor, { title: `${esc(actor.name)} — Animate`, body: `<div class="fs-result"><i class="fa-solid fa-hill-rockslide"></i> ${esc(name)} (${esc(mat.name)}, ${cat.label}) rises${ritualOf ? " (until the Ritual ends)" : " until the start of your next turn"}.</div>
    <ul class="fs-list"><li>${points} points (Str, Dex, Con ${st.str}/${st.dex}/${st.con}) · Size ${size} (${body} Body) · ${hp} health${layered ? ` (Layered +${layered})` : ""} · ${st.speed} ft per AP · ${st.ap} AP / ${st.rp} RP</li>
    <li>Physical attacks ${st.physical > 0 ? "Strengthened" : st.physical === -1 ? "Weakened" : st.physical < -1 ? "doubly Weakened" : "normal"}</li><li>${esc(cat.text)}</li></ul>
    <div class="fs-notes">Mindless: it uses your senses and your attack and dodge dice, and shares your turn order (it acts right after your turn).${mods["mixed animations"] ? ` Mixed Animations: ${mods["mixed animations"]} extra material effect${mods["mixed animations"] === 1 ? "" : "s"} are active (the GM applies them).` : ""}</div>` });
  return id;
}

/** Make: real items, in a hand or on the ground. */
async function makeObjects({ actor, plan, profile, spec, mods, ritualOf, targets, values }) {
  const cj = profile.conjure;
  const rider = cj.rider ? { core: cj.rider, level: 1, charmRoll: values?.charmRoll ?? null, hex: values?.hexTrigger ? { trigger: values.hexTrigger, roll: values.hexRoll, outcome: values.hexOutcome, detail: values.hexDetail } : null } : null;
  const flagsFor = it => ({ ...(rider && it.kind !== "object" ? { rider: { ...rider, level: R.riderLevel(2, 4), arcane: !!cj.arcane } } : {}), ...(cj.fear && it.kind !== "object" ? { fear: true } : {}) });
  const items = (spec.items ?? []).map(it => {
    const d = itemData(it, { actor, ritualOf, extraFlags: flagsFor(it) });
    if (cj.geo && d.type === "weapon") { d.system.returning = true; d.system.rounds = 99; d.system.magazine = 99; }   // reloads itself; returns when thrown
    return d;
  });
  hardenItems(items, mods, spec, cj);
  const target = targets?.[0]?.actor ?? null;
  // Into a target's inventory takes a hit: a Targeted attack roll; a miss leaves it on the floor beside them (see makeHit / makeMiss).
  if (spec.recipient === "target" && target && target.uuid !== actor.uuid) {
    const spell = { cores: plan.cores.map(c => c.id), power: plan.power, ritualOf, scaling: plan.scaling, mods: {}, exploit: null, replaced: {}, dampen: [], singleRoll: false, telegraph: null, hold: false, holdRoll: 0,
      makeAct: { items, caster: actor.uuid, ritualOf } };
    await performAttack(actor, { label: "Make", net: 0, stealth: "half", melee: false, area: false, push: false, damage: "", type: "arcane", stacks: 0, physical: false, shots: 1, critStacks: 0, pierce: 0, bash: 0, knockback: 0,
      notes: [`${items.map(i => i.name).join(", ")}: into ${target.name}'s inventory on a hit, on the floor beside them on a miss`], followups: [], targetActors: [target], spell });
    return items.length;
  }
  const to = spec.recipient === "self" ? actor : null;
  let where;
  if (to) {
    if (to.isOwner) await to.createEmbeddedDocuments("Item", items, { flowstateAuto: true });
    else await requestGM("giveItems", { actor: to.uuid, items });
    where = `into ${to.uuid === actor.uuid ? "their own" : `${esc(to.name)}'s`} hand${items.length === 1 ? "" : "s"}`;
  } else {
    const at = placement(actor, targets, spec.tile);
    if (at) { let k = 0; for (const it of items) await requestGM("createPile", { sceneId: at.sceneId, x: at.x, y: at.y + k++ * (globalThis.canvas?.grid?.size ?? 100), item: it }); where = "on the ground"; }
    else { await actor.createEmbeddedDocuments?.("Item", items, { flowstateAuto: true }); where = "into their inventory (no scene to drop them on)"; }
  }
  await post(actor, { title: `${esc(actor.name)} — Make`, body: `<div class="fs-result"><i class="fa-solid fa-wand-magic-sparkles"></i> ${esc(actor.name)} makes ${items.map(i => `<strong>${esc(i.name)}</strong>`).join(", ")} ${where}${ritualOf ? " (until the Ritual ends)" : ", until the start of their next turn"}.</div>
    <div class="fs-notes">Archetypal equipment is Grade 2. Non-Archetypal objects are just a note: a Body of 10 of a single material (a cubic foot per Body).${rider ? ` Attacks with it carry ${fx.profileFor([cj.rider])?.name ?? cj.rider}.` : ""}</div>` });
  return items.length;
}

/** Limited Autonomy: at the start of its turn a creation announces the command it follows. */
export async function autonomyTurn(actor) {
  const sm = summonOf(actor);
  if (!sm?.command) return;
  await post(actor, { title: `${esc(actor.name)} — Limited Autonomy`, body: `<div class="fs-result">${esc(actor.name)} acts on its own, following its command: <strong>${esc(sm.command)}</strong>. Its senses are as good as yours; it carries the command out until it can't (or it or you are destroyed).</div>` });
}

/** Sense Swap (Summoning T4): swap senses with a Summon for 2 RP (again to swap back). Spells are cast from its position meanwhile. */
export async function toggleSenseSwap(caster) {
  const cur = caster.getFlag?.("flowstate", "senseSwap");
  if (!(await spendPoints(caster, "rp", 2, "Sense Swap"))) return;
  if (cur) { await caster.unsetFlag("flowstate", "senseSwap"); return post(caster, { title: `${esc(caster.name)} — Sense Swap`, body: `<div class="fs-result">${esc(caster.name)} swaps their senses back.</div>` }); }
  const mine = allActors().filter(a => summonOf(a)?.owner === caster.uuid && summonOf(a).senseSwap);
  const target = mine[0];
  if (!target) return ui.notifications.warn("You have no Summon with Sense Swap.");
  await setActorFlag(caster, "senseSwap", target.uuid);
  await post(caster, { title: `${esc(caster.name)} — Sense Swap`, body: `<div class="fs-result">${esc(caster.name)} sees through ${esc(target.name)}: your body is limited by whatever senses it has, and spells you cast are cast from its position (still using your Energy and AP/RP).</div>` });
}
/** The token spells are cast from while Sense Swap is active (null otherwise). */
export function senseSwapToken(caster) {
  const u = caster.getFlag?.("flowstate", "senseSwap");
  const a = u ? globalThis.fromUuidSync?.(u) : null;
  return a?.getActiveTokens?.()[0] ?? null;
}

/** A Make's attack hit: the items go into the target's inventory. */
export async function makeHit({ attacker, target, sp }) {
  const m = sp.makeAct;
  if (target.isOwner) await target.createEmbeddedDocuments("Item", m.items, { flowstateAuto: true });
  else await requestGM("giveItems", { actor: target.uuid, items: m.items });
  return `<div class="fs-result"><i class="fa-solid fa-wand-magic-sparkles"></i> ${m.items.map(i => `<strong>${esc(i.name)}</strong>`).join(", ")} ${m.items.length === 1 ? "appears" : "appear"} in ${esc(target.name)}'s inventory${m.ritualOf ? " (until the Ritual ends)" : " until the start of your next turn"}.</div>`;
}
/** A Make's attack missed: the items land on the floor beside the target. */
export async function makeMiss({ attacker, target, sp }) {
  const m = sp.makeAct;
  const at = placement(attacker, [{ actor: target }]);
  if (at) { let k = 0; for (const it of m.items) await requestGM("createPile", { sceneId: at.sceneId, x: at.x, y: at.y + k++ * (globalThis.canvas?.grid?.size ?? 100), item: it }); }
  else await attacker.createEmbeddedDocuments?.("Item", m.items, { flowstateAuto: true });
  await post(attacker, { title: `${esc(attacker.name)} — Make`, body: `<div class="fs-result">It missed: ${m.items.map(i => `<strong>${esc(i.name)}</strong>`).join(", ")} ${at ? `land${m.items.length === 1 ? "s" : ""} on the floor beside ${esc(target.name)}` : "go into your inventory (no scene)"}.</div>` });
}

/** Animate Weapon/Foci and Animate Armor/Shroud (the Replacement Mods): a card of what the animated equipment can do. */
async function animateEquipment({ actor, plan, mods, targets, ritualOf }) {
  const tgt = targets?.[0]?.actor ?? actor;
  const armor = !!mods["armor/shroud"];
  const pool = armor ? [tgt.system.armor, tgt.system.shroud].filter(Boolean) : (tgt.items ?? []).filter(i => (i.type === "weapon" && !i.system.profile?.unarmed) || i.type === "foci");
  const picks = pool.filter(i => (i.system.grade ?? 9) <= 2);
  if (!picks.length) { ui.notifications.warn(`${tgt.name} has no ${armor ? "armor or Shroud" : "weapon or Foci"} of Grade 2 or lower to animate.`); return 0; }
  const item = picks[0];
  const acts = [];
  if (!armor && item.type === "weapon") acts.push({ act: "weapon", caster: actor.uuid, item: item.uuid, name: item.name });
  if (armor) {
    const grade = item.system.grade ?? 1;
    const mult = item.type === "armor" ? { light: 0.5, medium: 1, heavy: 2, titanic: 4 }[item.system.weight] ?? 1 : 1;
    const dice = Math.max(1, Math.floor(grade * mult));
    acts.push({ act: "suffocate", wearer: tgt.uuid, caster: actor.uuid, dice, name: item.name }, { act: "mould", wearer: tgt.uuid, caster: actor.uuid, dice, name: item.name });
  }
  await putSpellEffect(tgt, { kind: "animatedEquip", caster: actor.uuid, ritualOf, name: `Animated: ${item.name}`, item: item.uuid, description: `${item.name} is animated under ${actor.name}'s control until the start of their next turn.` });
  const rows = acts.map((a, i) => `<div class="fs-brawl-row" data-role="attacker" data-owner="${actor.uuid}"><button type="button" class="fs-conjure-act" data-i="${i}"><i class="fa-solid fa-hand-fist"></i> ${a.act === "weapon" ? `Attack with ${esc(a.name)}` : a.act === "suffocate" ? `Suffocate ${esc(tgt.name)}` : "Mould it into a strike"} ${a.act === "weapon" ? "" : ` (${a.dice}d12 physical, 2 AP/RP)`}</button></div>`).join("");
  await post(actor, { title: `${esc(actor.name)} — Animate ${armor ? "Armor/Shroud" : "Weapon/Foci"}`, body: `<div class="fs-result">${esc(item.name)} is animated under ${esc(actor.name)}'s control until the start of ${ritualOf ? "the Ritual's end" : "their next turn"}.</div>
    <div class="fs-notes">${armor ? "Spend 2 AP or RP (also as a reaction) to suffocate its wearer (melee attack roll with Advantage) or mould it into a strike on someone in melee range of it (melee attack roll)." : `Spend AP or RP equal to its attack cost to move it up to ${plan.scaling ? Math.min(plan.scaling, 999) : "your Scaling Stat min"} ft and attack with it as if you held it (Foci: cast through it). You resolve the attacks at the table.`}</div>${rows}`,
    flags: { flowstate: { conjure: { acts } } } });
  return 1;
}

/** Click: Suffocate / Mould (Animate Armor/Shroud). */
export async function act(message, i = 0) {
  const x = message.getFlag("flowstate", "conjure")?.acts?.[Number(i)];
  if (!x) return;
  const caster = await fromUuid(x.caster), wearer = x.wearer ? await fromUuid(x.wearer) : null;
  if (!caster?.isOwner) return ui.notifications.warn("Only the caster can do that.");
  if (x.act === "weapon") {
    // The animated weapon attacks as if you held it: its profile uses your stats and it counts as held.
    const real = await fromUuid(x.item);
    if (!real) return ui.notifications.info("The weapon is gone.");
    const sys = Object.create(real.system);
    const eff = caster.system.derived.effective;
    sys.computeProfile({ str: eff.str.value, dex: eff.dex.value });
    sys.held = true;
    const proxy = Object.create(real, { system: { value: sys } });
    return rollWeaponAttack(caster, proxy);
  }
  if (!(await spendPoints(caster, "ap", 2, `animated ${x.name}`))) return;
  const targets = x.act === "suffocate" ? [wearer] : undefined;
  return performAttack(caster, { label: `${x.act === "suffocate" ? "Suffocate" : "Mould"}: ${x.name}`, net: x.act === "suffocate" ? 1 : 0, stealth: "none", melee: true, area: false, push: false, damage: `${x.dice}d12`, type: "physical",
    stacks: 0, physical: false, shots: 1, critStacks: 0, pierce: 0, bash: 0, knockback: 0, notes: [x.act === "suffocate" ? "Suffocation: Advantage" : "Moulded armor strike"], followups: [], ...(targets ? { targetActors: targets } : {}) });
}

/** Cast resolution for Form / Make / Animate. Returns what was made (an actor id or a count). */
export async function resolve({ actor, plan, profile, spec, mods, ritualOf, targets, values }) {
  const cj = profile.conjure;
  let made;
  if (cj.kind === "animate" && (mods["weapon/foci"] || mods["armor/shroud"])) made = await animateEquipment({ actor, plan, mods, targets, ritualOf });
  else if (cj.kind === "summon") made = await makeSummon({ actor, plan, profile, spec, mods, ritualOf, targets, values });
  else if (cj.kind === "animate") made = await makeAnimation({ actor, plan, profile, spec, mods, ritualOf, targets, values });
  else made = await makeObjects({ actor, plan, profile, spec, mods, ritualOf, targets, values });
  // A Ritual's single free cast is used up by making it.
  if (plan.t3Free) { const r = Array.from(actor.effects ?? []).find(e => e.id === plan.t3Free); if (r) await r.update({ "flags.flowstate.ritual.freeCasts": 0 }); }
  return made;
}

/* -------------------------------------------- */
/*  Ending them                                 */
/* -------------------------------------------- */

/** Everything this caster made that lasts only until their next turn (or all of it with `ritualOf`: what a Ritual tied). */
async function endMade(filter) {
  const actors = allActors();
  const uuids = [], piles = new Set();
  for (const a of actors) {
    const sm = summonOf(a);
    if (sm && filter({ caster: sm.owner, ritualOf: sm.ritualOf })) { await requestGM("deleteCreation", { actorId: a.id }); continue; }
    for (const i of a.items ?? []) {
      const m = i.flags?.flowstate?.made;
      if (!m || !filter({ caster: m.caster, ritualOf: m.ritualOf })) continue;
      if (a.type === "pile") piles.add(a.id); else if (!summonOf(a)) uuids.push(i.uuid);
    }
  }
  for (const id of piles) await requestGM("deletePile", { actorId: id });
  if (uuids.length) await requestGM("deleteMade", { uuids });
}
/** The start of the caster's turn: Reform first, then their temporary Summons, Animations and Made objects end. */
export async function turnStart(caster) {
  await reform(caster);
  await endMade(m => m.caster === caster.uuid && !m.ritualOf);
}
/** Combat is over: temporary creations go. */
export const clearAll = caster => endMade(m => m.caster === caster.uuid && !m.ritualOf);
/** A Ritual ended: what it tied goes with it. */
export const endRitual = ritualUuid => endMade(m => m.ritualOf === ritualUuid);

/** Reform (Build Arcana T4): at the start of your turn, Reform spells (Ritual ones; the rest end now) restore up to your Build minimum of the health they lost since your last turn. */
async function reform(caster) {
  const minB = caster.system.derived?.effective?.build?.min ?? 0;
  if (!minB) return;
  for (const a of allActors()) {
    const sm = summonOf(a);
    if (sm?.owner === caster.uuid && sm.reform && sm.ritualOf) {
      const hp = a.system.hp.value, taken = Math.max(0, (sm.reformMark ?? hp) - hp), heal = Math.min(minB, taken);
      const next = Math.min(a.system.hp.max, hp + heal);
      if (heal) await requestGM("updateActor", { uuid: a.uuid, data: { "system.hp.value": next } });
      await requestGM("updateActor", { uuid: a.uuid, data: { "flags.flowstate.summon.reformMark": next } });
      if (heal) await post(a, { title: `${esc(a.name)} — Reform`, body: `<div class="fs-result">Reform restores ${heal} health (${next}/${a.system.hp.max}).</div>` });
    }
    for (const e of spellEffects(a, "shield")) {
      const d = e.flags.flowstate.spellEffect;
      if (d.caster !== caster.uuid || !d.reform || !d.ritualOf) continue;
      const taken = Math.max(0, (d.reformMark ?? d.max) - d.hp), heal = Math.min(minB, taken, d.max - d.hp);
      const hp = d.hp + heal;
      await changeEffect(e, { "flags.flowstate.spellEffect.hp": hp, "flags.flowstate.spellEffect.reformMark": hp, description: `Absorbs the next ${hp} damage.` });
      if (heal) await post(a, { title: `${esc(a.name)} — Reform`, body: `<div class="fs-result">Reform restores ${heal} to the Shield (${hp}).</div>` });
    }
  }
}

/* -------------------------------------------- */
/*  Riders: Any T1/T2/T3 + Summoning / Animation / Creation */
/* -------------------------------------------- */

/** After a creation's weapon attack dealt its damage: the Combo Core's extra effect. */
export async function riderAfter({ attacker, target, o, outcome, defense }) {
  let r = summonOf(attacker)?.rider ?? null, ritualOf = summonOf(attacker)?.ritualOf ?? null, ownerUuid = summonOf(attacker)?.owner ?? attacker.uuid, fear = !!summonOf(attacker)?.fear;
  if (o.itemUuid) {
    const item = await fromUuid(o.itemUuid);
    const made = item?.flags?.flowstate?.made;
    if (made?.rider && !r) { r = made.rider; ritualOf = made.ritualOf; ownerUuid = made.caster; }
    if (made?.fear) fear = true;
  }
  if (o.rider && !r) r = o.rider;                       // a Geomancy Combo's Charged material
  // Muddy (Geomancy T4): the material fouls what it hits: Disadvantage on their rolls with it and/or Weakened damage, until the caster's next turn.
  if (o.muddy && target.type !== "pile") {
    const c = o.muddy.choice, mud = [];
    if (c === "dis" || c === "all") mud.push({ roll: "attack", text: "Disadvantage on their attack rolls" });
    if (c === "weak" || c === "all") mud.push({ roll: "damage", text: "Weakened damage" });
    for (const m of mud) await putSpellEffect(target, { kind: "muddy", stack: true, caster: o.muddy.caster, name: `Muddy: ${m.text}`, penalty: { roll: m.roll, amount: 1 }, description: `${m.text} until the start of the caster's next turn.` });
    if (mud.length) await post(attacker, { title: `${esc(attacker.name)} — Muddy`, body: `<div class="fs-result">${esc(target.name)} is fouled: ${mud.map(m => m.text).join(", ")} until your next turn.</div>` });
  }
  // Illusion Combos: whoever is hit makes a coin flip or is afraid until their turn ends (success: immune while it lasts).
  if (fear && (outcome?.toHp ?? 0) >= 0 && target.type !== "pile") {
    const flip = await roll("1d2");
    const scared = flip.total === 1;
    if (scared) {
      await requestGM("setStatus", { target: target.uuid, status: "fear", active: true });
      await putSpellEffect(target, { kind: "fearTimed", caster: ownerUuid, name: "Afraid (until their turn ends)", onTargetTurn: true, description: "Afraid: can't gain Energy. Ends when their turn ends." });
    }
    await post(attacker, { title: `${esc(attacker.name)} — Fear`, rolls: [flip], body: `<div class="fs-result">${esc(target.name)} flips a coin: ${scared ? "<strong>afraid</strong> until their turn ends" : "unafraid (immune while it lasts)"}.</div>` });
  }
  if (!r) return;
  const rd = R.RIDERS[r.core];
  if (!rd) return;
  const level = r.level ?? 1;
  const caster = await fromUuid(ownerUuid);
  const living = target.type !== "pile" && !target.system.magical;
  const direct = (outcome?.toHp ?? 0) > 0;
  const html = [], rolls = [], acts = [];
  let push = null;
  const profileName = fx.profileFor([r.core])?.name ?? r.core;
  if (rd.dice) {
    const sides = rd.dice[1] + (rd.livingDie && living && direct ? rd.livingDie : 0);
    const dmg = await roll(`${rd.dice[0] * level}d${sides}`);
    rolls.push(dmg);
    const total = applyStacks(dmg.total, rd.critStack && defense?.result?.crit ? rd.critStack : 0);
    const dtype = r.arcane ? "arcane" : rd.type;
    const out = await damageOutcome(target, total, dtype, { archetype: "magic" });
    const res = await requestDamage(target, total, dtype, 0, null, { wantResult: true, silent: true, archetype: "magic" });
    const dealt = total - Math.min(total, res?.reduced ?? 0);             // a Ward's negation shrinks effects that go by the damage dealt
    html.push(`<div class="fs-result">${esc(profileName)}: ${rd.dice[0] * level}d${sides} = ${dmg.total}${total !== dmg.total ? ` (Strengthened → ${total})` : ""} additional ${DAMAGE_TYPES[dtype] ?? dtype}.</div><ul class="fs-list">${out.lines.map(l => `<li>${l}</li>`).join("")}</ul>`);
    if (rd.ignite) { const l = await giveStacks(target, "ignite", dealt, { outcome: out, caster }); if (l) html.push(`<div class="fs-result">${l}</div>`); }
    if (rd.stain) { const l = await giveStacks(target, "stain", dealt, { outcome: out, caster }); if (l) html.push(`<div class="fs-result">${l}</div>`); }
    if (rd.energy) { const e = await removeEnergy(target, dealt); html.push(`<div class="fs-result">${esc(target.name)} loses <strong>${e.removed} Energy</strong> (${e.remaining} left).</div>`); }
    if (rd.dodgeDie) {
      const amt = rd.dodgeDie * level;
      await putSpellEffect(target, { kind: "dodgeDie", caster: ownerUuid, name: `Dodge −${amt} die size`, dodgeDie: amt, ritualOf, description: `Dodge dice are ${amt} sizes smaller until the start of the caster's next turn (doesn't stack).` });
      html.push(`<div class="fs-notes">${esc(target.name)}'s dodge dice suffer <strong>−${amt} die size</strong> until the start of your next turn.</div>`);
    }
    if (rd.chain) acts.push({ act: "arc", from: target.uuid, attacker: attacker.uuid, n: rd.dice[0] * level, sides, type: dtype, stacks: 0, label: "Chain" });
  }
  if (rd.force) {
    const f = await spellForce(attacker, target, { stacks: 0 }, { critStacks: 0 }, { n: rd.force[0] * level, sides: rd.force[1] }, "Force");
    html.push(f.html); rolls.push(...f.rolls); push = f.push;
  }
  if (rd.poison && living && direct) {
    await A.applyPoison(target, { kind: "poison", caster: ownerUuid, ritualOf: null, ritual: false, n: 3 * level, sides: 6, type: "health", bypassArmor: false, force: false, livingDie: 0, halfStrength: false, dodgeDie: 0,
      ignite: false, stain: false, energy: false, arc: false, prolong: 0, lethality: 0, potency: false, virality: false, power: level, procs: 0, checks: 0 }, caster);
  }
  if (rd.charm && living) {
    const c = await A.check(target, "will", 3);
    rolls.push(c.roll);
    let body = `<div class="fs-notes">${esc(target.name)}: Willpower check needs 3 or higher: <strong>${c.total}</strong> — ${c.passed ? "passed" : "failed"}.</div>`;
    if (!c.passed) body += await A.placeCharm(caster ?? attacker, target, { rollType: r.charmRoll || "attack", ritualOf });
    await A.secret(target, caster, { title: `${esc(attacker.name)} — Charm`, rolls: [c.roll], body });
  }
  if (rd.hex && living) {
    const a = fx.PROFILES["magic-witchery:hex"].afflict;
    const h = A.hexData(a, { mods: {} }, { caster: ownerUuid, power: level, ritualOf }, { hex: r.hex, hexDie: r.hexDie }, { name: "Hex" });
    await putSpellEffect(target, A.hexEffect(h, { name: "Hex" }));
    await A.secret(target, caster, { title: `${esc(attacker.name)} — Hex`, body: A.hexCard(target, h), flags: A.hexFlags(target, h) });
  }
  if (!html.length && !acts.length && !push) return;
  await post(attacker, { title: `${esc(attacker.name)} — ${esc(profileName)}`, rolls, body: html.join("") + acts.map((x, i) => A.actButton(x, i)).join("") + (push ? knockbackRow(attacker.uuid, push.feet, "Force") : ""),
    flags: { flowstate: { afflict: { acts }, ...(push ? { knockback: push } : {}) } } });
}

registerConjure({ riderAfter, makeHit, makeMiss });
