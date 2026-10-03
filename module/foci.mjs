/**
 * Foci effects (Equipment doc): the passives of Wand, Lens, Staff, Tome, Scepter, Tablet and Gauntlet, the Foci-side Affixes, and Deck Foci
 * (Chime, Cards). Threshold Reduction maths is in magic.mjs / spells.mjs; this file keeps the per-turn state and hooks into the spell exchange
 * through `registerFoci()` (actions.mjs). A Foci's effects only work while it's attuned and unbroken, for spells cast through it.
 */
import * as spells from "./spells.mjs";
import { FOCI_TYPES } from "./magic.mjs";
import { igniteTotal } from "./rules.mjs";
import { post, requestGM, turnKey, setActorFlag, spendEnergy, giveStacks, registerFoci, inActiveCombat, attackerToken } from "./actions.mjs";

const esc = s => foundry.utils.escapeHTML?.(String(s)) ?? String(s);
const stamp = () => (globalThis.game ? turnKey() : null) ?? "ooc";

/** The Foci an option casts through, if it's attuned and working. */
export function fociItem(actor, fociId) {
  if (!fociId) return null;
  const i = actor.items?.get?.(fociId) ?? Array.from(actor.items ?? []).find(x => x.id === fociId);
  return i && i.type === "foci" && i.system.attuned && !i.system.broken && i.system.profile?.valid ? i : null;
}

/** Everything a cast needs to remember about its Foci (plain data, it travels on the attack card). */
export function fociFx(actor, plan, dark = false) {
  const item = fociItem(actor, plan.option?.fociId);
  if (!item) return null;
  const p = item.system.profile;
  return { id: item.id, type: p.type ?? item.system.fociType, plus: !!p.affixPlus, affixes: [...p.affixes], element: item.system.element, lush: !!item.system.lush || !!globalThis.canvas?.scene?.getFlag?.("flowstate", "lush"),
    declared: item.system.declared || "", opalRange: item.system.opalRange || "targeted", dark: !!dark, scalingMin: Math.floor((plan.scaling ?? 0) / 3) };
}

/* -------------------------------------------- */
/*  Per-turn state                              */
/* -------------------------------------------- */

const turnState = (actor, name) => { const s = actor.getFlag?.("flowstate", name); return s && s.key === stamp() ? s : { key: stamp() }; };
/** { [fociId]: { casts, last } } for this turn (Wand, Lens, Staff, Tome). */
export const castState = actor => turnState(actor, "fociState");
export async function recordCast(actor, fociId, coreKey) {
  const s = castState(actor);
  s[fociId] = { casts: (s[fociId]?.casts ?? 0) + 1, last: coreKey };
  await setActorFlag(actor, "fociState", s);
}

/* -------------------------------------------- */
/*  Affix hooks                                 */
/* -------------------------------------------- */

/** Attack-roll Advantage / Disadvantage the Foci's Affixes give a spell against this target. */
export function attackNet({ attacker, target, o }) {
  const f = o.spell?.fociFx;
  if (!f) return { net: 0, notes: [] };
  const has = k => f.affixes.includes(k);
  let net = 0;
  const notes = [];
  const add = (n, text) => { net += n; notes.push(text); };
  if ((target.system?.movement?.tempo ?? 0) >= 2) {
    if (has("topaz")) add(1, "Topaz: Advantage (they're slowed by 2+ AP)");
  }
  const pain = target.system?.hp?.pain ?? Infinity;
  if (has("garnet") && igniteTotal(target.system?.conditions) > pain / 2) add(1, "Garnet: Advantage (more than half their Pain Threshold in Ignite)");
  if (has("emerald")) add(f.lush ? 1 : -1, f.lush ? "Emerald: Advantage (Lush biome)" : "Emerald: Disadvantage (not a Lush biome)");
  const key = [...o.spell.cores].sort().join("+");
  if (has("diamond") && (turnState(attacker, "fociHits").hits ?? []).some(h => h.key === key && h.target === target.uuid)) add(1, "Diamond: Advantage (the same spell already hit them this turn)");
  if (has("coloredDiamond") && f.declared && o.spell.cores.includes(f.declared)) add(1, "Colored Diamond: Advantage (the declared spell)");
  if (has("moonstone") && f.plus && f.dark) add(1, "Moonstone: Advantage (darkness or dim light)");
  return { net, notes };
}

/** Strengthened / Weakened stacks on a spell's damage from the Foci's Affixes. */
export function damageStacks({ attacker, o, type }) {
  const f = o.spell?.fociFx;
  if (!f) return { stacks: 0, parts: [] };
  const has = k => f.affixes.includes(k);
  let stacks = 0;
  const parts = [];
  if (has("tourmaline")) { const s = type === f.element ? 1 : -1; stacks += s; parts.push(`${s > 0 ? "+1" : "−1"} Tourmaline (${type === f.element ? "the chosen element" : "other damage"})`); }
  if (has("jasper")) { const s = type === "physical" ? 1 : -1; stacks += s; parts.push(`${s > 0 ? "+1" : "−1"} Jasper (${type === "physical" ? "Physical damage" : "other damage"})`); }
  if (has("coloredDiamond") && f.declared && o.spell.cores.includes(f.declared)) { stacks += 1; parts.push("+1 Colored Diamond (the declared spell)"); }
  if (has("alexandrite") && turnState(attacker, "fociLast").type === type) { stacks += 1; parts.push("+1 Alexandrite (the same damage type as your last spell)"); }
  return { stacks, parts };
}

/** After a spell's damage: Alexandrite remembers the type. */
export async function afterDamage({ attacker, o, type }) {
  const f = o.spell?.fociFx;
  if (f?.affixes.includes("alexandrite")) await setActorFlag(attacker, "fociLast", { key: stamp(), type });
}

/** After a spell hits: Diamond remembers it; Ruby / Sapphire add Ignite / Slow when it targeted something in melee range. */
export async function afterHit({ attacker, target, o }) {
  const f = o.spell?.fociFx;
  if (!f) return "";
  let html = "";
  if (f.affixes.includes("diamond")) {
    const s = turnState(attacker, "fociHits");
    s.hits = [...(s.hits ?? []), { key: [...o.spell.cores].sort().join("+"), target: target.uuid }];
    await setActorFlag(attacker, "fociHits", s);
  }
  if (o.melee && f.scalingMin > 0) {
    if (f.affixes.includes("ruby")) { const l = await giveStacks(target, "ignite", f.scalingMin, { caster: attacker }); if (l) html += `<div class="fs-result">Ruby: ${l}</div>`; }
    if (f.affixes.includes("sapphire")) {
      const cur = target.system.conditions?.slow ?? 0;
      const data = { "system.conditions.slow": cur + f.scalingMin };
      if (target.isOwner) await target.update(data); else await requestGM("updateActor", { uuid: target.uuid, data });
      html += `<div class="fs-result">Sapphire: ${esc(target.name)} gets <strong>${f.scalingMin} Slow</strong> stacks.</div>`;
    }
  }
  return html;
}

/** Notes on the cast card for Affixes that are only flavor here. */
export function castNotes(fx, plan) {
  if (!fx) return [];
  const out = [];
  if (fx.affixes.includes("obsidian") && (plan.attack === "Ranged" || (fx.plus && plan.attack === "Area"))) out.push(`Obsidian: this ${plan.attack} spell is silent.`);
  if (fx.affixes.includes("moonstone") && fx.dark) out.push("Moonstone: this spell is silent in the dark.");
  return out;
}

/* -------------------------------------------- */
/*  Deck Foci (Chime, Cards)                    */
/* -------------------------------------------- */

const shuffle = list => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/** The attuned, working Deck Foci, if any. */
export const deckFoci = actor => Array.from(actor.items ?? []).find(i => i.type === "foci" && i.system.attuned && !i.system.broken && i.system.profile?.deck) ?? null;
export const deckOf = actor => actor.getFlag?.("flowstate", "deck") ?? null;
export const handOf = actor => deckOf(actor)?.hand ?? [];

/** Three copies of every Core Spell you know. */
const fullDeck = actor => spells.knownSpells(actor.system.trees ?? {}).cores.flatMap(c => [c.id, c.id, c.id]);

async function save(actor, deck) { await setActorFlag(actor, "deck", deck); }
function draw(deck, n) {
  for (let i = 0; i < n; i++) {
    if (!deck.draw.length) { deck.draw = shuffle(deck.discard); deck.discard = []; }
    const c = deck.draw.shift();
    if (c) deck.hand.push(c);
  }
}
const nameOf = id => spells.spellById(id)?.name ?? id;

/** Start of your turn: hand and discard go back into the deck, shuffled, and you draw a new hand. */
export async function deckTurnStart(actor) {
  const foci = deckFoci(actor);
  if (!foci) return;
  const old = deckOf(actor);
  const all = [...(old?.draw ?? []), ...(old?.hand ?? []), ...(old?.discard ?? [])];
  const deck = { draw: shuffle(all.length ? all : fullDeck(actor)), hand: [], discard: [] };
  draw(deck, foci.system.profile.deckDraw);
  await save(actor, deck);
  await post(actor, { title: `${esc(actor.name)} — ${esc(foci.name)} (${esc(foci.system.profile.label)})`, body: `<div class="fs-result">Hand: ${deck.hand.map(nameOf).map(esc).join(", ") || "(empty)"}</div>` });
}

/** Spend Energy (1/10 of max for one card, 2/10 to mulligan) to draw a card / redraw your hand. */
export async function drawCard(actor) {
  const foci = deckFoci(actor);
  if (!foci) return;
  let deck = deckOf(actor);
  if (!deck) { await deckTurnStart(actor); return; }
  if (!(await spendEnergy(actor, Math.floor((actor.system.energy.max ?? 0) / 10), "drawing a card"))) return;
  deck = structuredClone(deck);
  draw(deck, 1);
  await save(actor, deck);
  await post(actor, { title: `${esc(actor.name)} — Draw`, body: `<div class="fs-result">Hand: ${deck.hand.map(nameOf).map(esc).join(", ")}</div>` });
}
export async function mulligan(actor) {
  const foci = deckFoci(actor);
  const deck0 = deckOf(actor);
  if (!foci || !deck0) return;
  if (!(await spendEnergy(actor, Math.floor(2 * (actor.system.energy.max ?? 0) / 10), "a mulligan"))) return;
  const deck = structuredClone(deck0);
  const n = deck.hand.length;
  deck.discard.push(...deck.hand); deck.hand = [];
  draw(deck, n);
  await save(actor, deck);
  await post(actor, { title: `${esc(actor.name)} — Mulligan`, body: `<div class="fs-result">New hand: ${deck.hand.map(nameOf).map(esc).join(", ")}</div>` });
}
/** The cards a cast played are discarded. */
export async function playCards(actor, coreIds) {
  const deck = deckOf(actor);
  if (!deck) return;
  const d = structuredClone(deck);
  for (const id of coreIds) { const i = d.hand.indexOf(id); if (i >= 0) { d.hand.splice(i, 1); d.discard.push(id); } }
  await save(actor, d);
}

registerFoci({ attackNet, damageStacks, afterDamage, afterHit });
