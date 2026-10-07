/**
 * Creation (Dream) Wonders (Mental Rework Test Ground): Forge, Conjure, Consecrate and Fabricate make real items that last until the start of your
 * next turn (like Build Arcana's Make), Rite makes them permanent, and Alter (the Tenet) changes damage dealt to an object.
 * The Manifest's attack roll is made against yourself; on a hit a "Create" button on the follow-up card asks what to make.
 */
import { post, requestGM, putSpellEffect, spellEffects, attackerToken, setActorFlag } from "./actions.mjs";
import * as ab from "./abilities.mjs";
import * as R from "./mental-rules.mjs";
import * as conjure from "./conjure.mjs";
import * as mental from "./mental.mjs";
import { AFFIXES, FOCI_TYPES, SHROUD_TYPES, AFFIX_LIMIT } from "./magic.mjs";
import { WEAPON_TYPES, WEAPON_MATERIALS, ARMOR_MATERIALS } from "./martial.mjs";
import { tierOf } from "./skills.mjs";
import { MODES, ACTS, ACT_PROVIDERS, CHOICE_PROVIDERS, tenetOf, tryOnce } from "./wonders.mjs";

const esc = s => foundry.utils.escapeHTML?.(String(s)) ?? String(s);
const DialogV2 = () => foundry.applications.api.DialogV2;
const tier = (actor, id) => tierOf(actor?.system?.trees ?? {}, id);
const ID = "mental-creation-dream";
export const CREATION_MODES = new Set([`${ID}:forge`, `${ID}:conjure`, `${ID}:consecrate`, `${ID}:fabricate`]);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const field = (label, html) => `<div class="fs-field"><label>${esc(label)}</label>${html}</div>`;
const select = (name, options) => `<select name="${name}">${options.map(([k, l]) => `<option value="${esc(k)}">${esc(l)}</option>`).join("")}</select>`;
const formValues = form => { const v = {}; for (const el of form.elements) if (el.name && !el.disabled) v[el.name] = el.type === "checkbox" ? el.checked : el.value; return v; };

/** The rarities this Mode can make: Common and Uncommon, plus Rare when Enhanced. */
export const rarities = enhanced => (enhanced ? ["common", "uncommon", "rare"] : ["common", "uncommon"]);
const rarityKey = r => String(r).replace(/\s+/g, "").replace(/^very rare$/i, "veryRare");

for (const id of CREATION_MODES) {
  MODES[id] = async c => {
    const who = c.m.recipients?.[c.index] ? (globalThis.fromUuidSync?.(c.m.recipients[c.index])?.name ?? "the recipient") : c.attacker.name;
    return `${esc(c.mode.name)} takes hold (the attack was made against ${esc(c.attacker.name)}). Use <em>Create</em> below to choose what appears, for <strong>${esc(who)}</strong>: it lasts until the start of your next turn${tier(c.attacker, ID) >= 5 ? ", or is permanent as a Rite" : ""}.`;
  };
}
ACT_PROVIDERS.push(async c => CREATION_MODES.has(c.mode.id)
  ? [{ id: "create", label: `Create (${c.mode.name})`, tip: "Choose what to create and who it appears for", cost: "free", caster: c.attacker.uuid, target: c.m.recipients?.[c.index] ?? c.attacker.uuid, mode: c.mode.id, enhanced: !!c.enhanced, range: c.range, power: c.power, rite: c.choices?.rite === "yes" }] : []);

CHOICE_PROVIDERS.push((actor, modeId) => CREATION_MODES.has(modeId) && tier(actor, ID) >= 5
  ? [{ name: "rite", label: "Rite (hours of work, permanent: Energy is 0 meanwhile)", options: { no: "No", yes: "Yes: make it permanent" } }] : []);

/** What to make: a dialog per Mode. Returns { item data, label } or null. */
async function askWhat(caster, x) {
  const rar = rarities(x.enhanced), mode = x.mode;
  let html = "";
  if (mode === `${ID}:forge`) {
    html = field("What", select("kind", [["weapon", "Martial Weapon"], ["armor", "Armor"]])) + field("Weapon type", select("type", Object.keys(WEAPON_TYPES).filter(k => !["unarmed", "improvised"].includes(k)).map(k => [k, cap(k)])))
      + field("Weight", select("weight", [["light", "Light"], ["medium", "Medium"], ["heavy", "Heavy"], ["titanic", "Titanic (armor)"]])) + field("Material", `<input type="text" name="material" placeholder="a material key, e.g. ironwood">`) + field("Name", `<input type="text" name="name">`);
  } else if (mode === `${ID}:conjure`) {
    const aff = Object.entries(AFFIXES).filter(([, a]) => rar.includes(rarityKey(a.rarity)));
    html = field("What", select("kind", [["foci", "Magic Foci"], ["shroud", "Shroud"]])) + field("Foci type", select("ftype", Object.entries(FOCI_TYPES).map(([k, v]) => [k, v.label]))) + field("Shroud type", select("stype", Object.entries(SHROUD_TYPES).map(([k, v]) => [k, v.label])))
      + `<fieldset><legend>Affixes (each past your free ones costs 20% speed)</legend>${aff.map(([k, a]) => `<label class="fs-cast-mod"><input type="checkbox" name="aff:${k}"> ${esc(a.label)} <small>(${esc(a.rarity)})</small></label>`).join("")}</fieldset>` + field("Name", `<input type="text" name="name">`);
  } else if (mode === `${ID}:consecrate`) {
    const forms = Object.entries(R.FORMS).filter(([, f]) => rar.includes(rarityKey(f.rarity)));
    html = field("Form", select("form", forms.map(([k, f]) => [k, `${f.name} (${R.KINDS[f.align].label}, ${f.rarity})`]))) + field("Name", `<input type="text" name="name">`);
  } else {
    html = field("Material", select("mat", [["powder", "Powder"], ["liquid", "Liquid"], ["soft", "Soft"], ...(x.enhanced ? [["hard", "Hard"]] : [])])) + field(`Body (up to ${15 * x.power})`, `<input type="number" name="body" value="${Math.min(10, 15 * x.power)}" min="1" max="${15 * x.power}">`) + field("Object (name, material, shape)", `<input type="text" name="name">`);
  }
  html += `<label class="fs-cast-mod"><input type="checkbox" name="willing" checked> <strong>Willing recipient</strong> <small>it appears in their hand; otherwise at their feet</small></label>`;
  return DialogV2().prompt({ window: { title: `${R.modeById(mode)?.name}: what do you create?` }, content: `<div class="fs-cast">${html}</div>`, rejectClose: false,
    ok: { label: "Create", callback: (event, button) => formValues(button.form) } });
}

function buildItem(caster, x, v, permanent) {
  const flags = permanent ? {} : { flowstate: { made: { caster: caster.uuid, ritualOf: null } } };
  const mode = x.mode;
  if (mode === `${ID}:forge`) {
    const kind = v.kind === "armor" ? "armor" : "weapon";
    const it = { kind, type: v.type, weight: v.weight, material: v.material, name: v.name };
    const d = conjure.itemData(it, { actor: caster, ritualOf: null });
    d.system.grade = 1; d.system.equipped = false; d.flags = { ...(d.flags ?? {}), ...flags };
    if (permanent) delete d.flags?.flowstate?.made;
    return d;
  }
  if (mode === `${ID}:conjure`) {
    const affixes = Object.keys(v).filter(k => k.startsWith("aff:") && v[k]).map(k => k.slice(4));
    if (v.kind === "shroud") return { name: v.name || `${SHROUD_TYPES[v.stype]?.label} Shroud`, type: "shroud", flags, system: { shroudType: v.stype, grade: 1, attuned: false, affixes: affixes.slice(0, AFFIX_LIMIT) } };
    return { name: v.name || `${FOCI_TYPES[v.ftype]?.label} Foci`, type: "foci", flags, system: { fociType: v.ftype, grade: 1, attuned: false, equipped: false, affixes: affixes.slice(0, AFFIX_LIMIT) } };
  }
  if (mode === `${ID}:consecrate`) return { name: v.name || `${R.FORMS[v.form]?.name} Icon`, type: "icon", flags, system: { form: v.form, grade: 1, attuned: false, tenet: "" } };
  const body = Math.min(15 * (x.power ?? 1), Math.max(1, Number(v.body) || 1));
  return { name: v.name || `Fabricated ${v.mat} object`, type: "gear", flags, system: { quantity: 1, body, density: v.mat === "liquid" ? "powder" : v.mat, description: `<p>Fabricated from ${esc(v.mat)} (Body ${body}): ${esc(v.name || "an object")}.</p>` } };
}

/** Put a created item in the recipient's hands (inventory) or at their feet. */
async function deliver(caster, recipient, item, willing) {
  if (willing) {
    if (recipient.isOwner) await recipient.createEmbeddedDocuments("Item", [item], { flowstateAuto: true });
    else await requestGM("giveItems", { actor: recipient.uuid, items: [item] });
    return;
  }
  const tok = recipient.getActiveTokens?.()[0] ?? attackerToken(caster);
  const canvas = globalThis.canvas;
  if (tok && canvas?.grid && canvas.scene) { const gs = canvas.grid.size, d = tok.document; await requestGM("createPile", { sceneId: canvas.scene.id, x: d.x + (d.width ?? 1) * gs, y: d.y, item }); }
  else if (recipient.isOwner) await recipient.createEmbeddedDocuments("Item", [item], { flowstateAuto: true });
  else await requestGM("giveItems", { actor: recipient.uuid, items: [item] });
}

const nowSeconds = () => globalThis.game?.time?.worldTime ?? Date.now() / 1000;
/** Rite: 2 hours for a Common archetypal item or a Powder/Liquid object, 8 hours for anything more (Uncommon and up, Soft and up). */
export function riteHours(mode, v) {
  const order = ["common", "uncommon", "rare", "veryRare"];
  const rank = r => Math.max(0, order.indexOf(rarityKey(r ?? "common")));
  if (mode === `${ID}:fabricate`) return ["powder", "liquid"].includes(v.mat) ? 2 : 8;
  let r = 0;
  if (mode === `${ID}:forge`) r = rank((v.kind === "armor" ? ARMOR_MATERIALS : WEAPON_MATERIALS)[v.material]?.rarity);
  else if (mode === `${ID}:conjure`) r = Math.max(0, ...Object.keys(v).filter(k => k.startsWith("aff:") && v[k]).map(k => rank(AFFIXES[k.slice(4)]?.rarity)));
  else r = rank(R.FORMS[v.form]?.rarity);
  return r === 0 ? 2 : 8;
}
const hoursLeft = rite => Math.max(0, (rite.readyAt - nowSeconds()) / 3600);

ACTS.create = async (x, caster, target) => {
  const v = await askWhat(caster, x);
  if (!v) return false;
  const permanent = !!x.rite;
  const item = buildItem(caster, x, v, permanent);
  const recipient = target ?? caster;
  // A Rite takes hours of heavy work at zero Energy; the item arrives when it's finished (or the Rite is cancelled and the progress is lost).
  if (permanent) {
    const hours = riteHours(x.mode, v);
    await setActorFlag(caster, "rite", { item, recipient: recipient.uuid, willing: !!v.willing, mode: x.mode, hours, readyAt: nowSeconds() + hours * 3600, name: item.name });
    await caster.update({ "system.energy.value": 0 });
    await post(caster, { title: `${esc(caster.name)} — Rite`, body: `<div class="fs-result"><i class="fa-solid fa-hourglass-half"></i> ${esc(caster.name)} begins a Rite to make <strong>${esc(item.name)}</strong>: <strong>${hours} hours</strong> of heavy activity at zero Energy. Use "Finish Rite" in the Action List when the time has passed (or cancel it, losing all progress).</div>` });
    return true;
  }
  await deliver(caster, recipient, item, v.willing);
  // Consecrate: a willing recipient's Icon can be attuned at once, to a Tenet either of you can use.
  let attuned = "";
  if (x.mode === `${ID}:consecrate` && v.willing) {
    const align = R.FORMS[v.form]?.align;
    const opts = new Map();
    for (const a of [caster, recipient]) for (const w of R.tenetChoices(align, a.system.trees)) opts.set(w.tenet.id, `${w.tenet.name} (${w.name})`);
    const pick = opts.size ? await mental.pickChoice(caster, "Attune the Icon to which Tenet?", [["", "— Don't attune —"], ...opts]) : "";
    if (pick !== null && pick !== undefined && pick !== "") {
      const made = (recipient.items ?? []).find(i => i.type === "icon" && i.name === item.name && !i.system.attuned);
      if (made && !recipient.items.some(i => i.type === "icon" && i.system.attuned)) { await made.update({ "system.attuned": true, "system.tenet": pick }, { flowstateAttune: true }); attuned = ` and attuned to ${esc(opts.get(pick))}`; }
    }
  }
  await post(caster, { title: `${esc(caster.name)} — ${esc(R.modeById(x.mode)?.name)}`, body: `<div class="fs-result"><i class="fa-solid fa-hammer"></i> <strong>${esc(item.name)}</strong> appears ${v.willing ? `in ${esc(recipient.name)}'s hands` : `at ${esc(recipient.name)}'s feet`}${attuned}. It lasts until the start of your next turn.</div>` });
  return true;
};

/** The Rite in progress, if any: { name, hoursLeft, ready }. */
export function riteOf(actor) {
  const r = actor?.getFlag?.("flowstate", "rite");
  return r ? { name: r.name, hoursLeft: hoursLeft(r), ready: hoursLeft(r) <= 0, hours: r.hours } : null;
}
/** Finish the Rite (once the hours have passed) or cancel it. */
export async function finishRite(actor) {
  const r = actor.getFlag("flowstate", "rite");
  if (!r) return;
  if (hoursLeft(r) > 0) {
    const stop = await DialogV2().confirm({ window: { title: "Rite" }, rejectClose: false, content: `<p>${esc(r.name)} needs <strong>${hoursLeft(r).toFixed(1)}</strong> more hours. Cancel the Rite and lose all progress?</p>` });
    if (!stop) return;
    await setActorFlag(actor, "rite", null);
    return post(actor, { title: `${esc(actor.name)} — Rite`, body: `<div class="fs-notes">${esc(actor.name)} cancels the Rite for ${esc(r.name)}: all progress is lost.</div>` });
  }
  const recipient = (await fromUuid(r.recipient)) ?? actor;
  await deliver(actor, recipient, r.item, r.willing);
  await setActorFlag(actor, "rite", null);
  await post(actor, { title: `${esc(actor.name)} — Rite`, body: `<div class="fs-result"><i class="fa-solid fa-hammer"></i> The Rite is finished: <strong>${esc(r.name)}</strong> is made permanent, ${r.willing ? `in ${esc(recipient.name)}'s hands` : `at ${esc(recipient.name)}'s feet`}. It can still be dismissed by ${esc(actor.name)}, or by anyone who identifies it as Mentally made.</div>` });
}

/* ---- Alter (Creation Tenet) ---- */

ACT_PROVIDERS.push(async c => {
  const tn = tenetOf(c.attacker);
  if (tn?.id !== "mental-creation-dream:alter" || c.m.spread || c.now || CREATION_MODES.has(c.mode.id)) return [];
  return [{ tenet: true, id: "alter", label: "Alter", tip: "Once per round: choose an object the target wears or holds; damage to it is Strengthened or Weakened until your next turn", cost: "once per round", target: c.target.uuid, caster: c.attacker.uuid, mult: tn.mult }];
});
ACTS.alter = async (x, caster, target) => {
  const objs = (target.items ?? []).filter(i => ["weapon", "armor", "foci", "shroud"].includes(i.type) && (i.system.equipped || i.system.attuned));
  if (!objs.length) { ui.notifications.info(`${target.name} isn't wearing or holding anything to Alter.`); return false; }
  if (!(await tryOnce(caster, "alter"))) { ui.notifications.info("Alter: already used this round."); return false; }
  const out = await DialogV2().prompt({ window: { title: "Alter" }, rejectClose: false, content: `<div class="fs-cast">${field("Object", select("o", objs.map(i => [i.uuid, i.name])))}${field("Damage to it is", select("s", [["1", "Strengthened"], ["-1", "Weakened"]]))}</div>`,
    ok: { label: "Alter", callback: (event, button) => formValues(button.form) } });
  if (!out) return false;
  const sign = Number(out.s) < 0 ? -1 : 1, stacks = sign * (x.mult ?? 1);
  const item = objs.find(i => i.uuid === out.o);
  await putSpellEffect(target, { kind: "alter", stack: true, caster: caster.uuid, name: `Alter: ${item.name} (${sign > 0 ? "Strengthened" : "Weakened"})`, item: item.uuid, alterStacks: stacks,
    description: `Damage dealt to ${item.name} is ${sign > 0 ? "Strengthened" : "Weakened"}${(x.mult ?? 1) > 1 ? ` ×${x.mult}` : ""} until the start of ${caster.name}'s next turn.` });
  await post(caster, { title: `${esc(caster.name)} — Alter`, body: `<div class="fs-result">Damage to ${esc(target.name)}'s <strong>${esc(item.name)}</strong> is ${sign > 0 ? "Strengthened" : "Weakened"} until your next turn.</div>` });
  return true;
};
/** Stacks of Strengthened (positive) or Weakened applied to damage dealt to this object. */
export function alterStacks(actor, obj) {
  const uuid = obj?.uuid;
  if (!uuid) return 0;
  return spellEffects(actor, "alter").reduce((n, e) => n + (e.flags.flowstate.spellEffect.item === uuid ? Number(e.flags.flowstate.spellEffect.alterStacks) || 0 : 0), 0);
}
