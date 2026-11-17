/**
 * Ancestry abilities (Flow State - ABCs). The rules for who has which tree are abc-rules.mjs / skills.mjs; this is what the trees do in play.
 *  - Action List rows (`actionRows`/`run`): Shed the Heat, Territorial, Lucky / Charmed Life, Good Spirits, Duelist, Topple, Overgrowth, Ward of the
 *    Hold, Elemental Wings, Mob Rule, Shadow Spirit / Transference, the Drakenblood breath; every other active ability pays its cost and posts its text.
 *  - Exchange hooks (`registerAncestry` in actions.mjs): attack Advantage (Small Target, Home Ground, Mob Rule), dodge Advantage (Mindful of Fragility,
 *    Awakened Scales, Underdog), the defender's buttons (Underfoot, Neutral Party: the attack is re-rolled keeping the lower result), after the dodge
 *    (Unlucky, Indomitable), damage (Elemental Ward, Flamekin, Curse-Hardened, Ward of the Hold, Spirit Shell, Searing Zeal, Elemental Mastery,
 *    Grudgebearer, Elemental Absorption, Lingering Spirit) and Force/prone (Immovable).
 *  - Passives in data.mjs (Keen Instincts, Quick Feet, Big Gear, Bounding, Wings, the cores' senses, Light Step, Lake Surge's slows), movement.mjs (Slip
 *    Through, Wild Heart, your own Overgrowth), checks (Unassuming, Territorial, Unbowed and the rest in ancestry-net.mjs), actions.mjs (rest: Unstable
 *    Regeneration; Sealed Wounds), casting (Steeped in Magic, Blood Price), gravity (Feather-Fall), bestiary (Numb Flesh), surprise (Warning Thump).
 *  - The new trees (Namuh, Sworan, Wildibit, Myrthel, Dawn Elf, Noctua, Minotaur, Smoblin and the Lakeborn, Strigid, Leporid and Wasteling cores):
 *    Action List rows (Accelerated Healing, Living Metal Arm and its materials, Thick Hide, Lake Surge, Zig-Zag, Hind Kick, Swoop, Overclock) and the
 *    exchange (Skittish, Red Tide, Shy of Pain, Zig-Zag, Glass Body, Fused Shadow, Acid-Worn, Stone Skin, Rotting Touch, Lashing Shadow).
 * Uses are tracked in flags: `ancUse` (name → the round/turn/combat it was used in) and `ancRest` (name → true until the next 8 hour rest).
 */
import { post, fixedDodgeOf, spendPoints, spendEnergy, requestGM, requestDamage, inActiveCombat, turnKey, setActorFlag, tokenDistance, attackerToken, rollKit, performAttack, GM_ACTIONS,
  besideTokenPosition, setStatus, energyRestoreAdjust, dodgeNetKnown } from "./actions.mjs";
import { startFalling } from "./gravity.mjs";
import { restoreSince, restorable } from "./arcana.mjs";
import { FOCI_TYPES } from "./magic.mjs";
import { FORMS, alignmentState, maxAlignment } from "./mental-rules.mjs";
import { energyHave } from "./consumables-rules.mjs";

import { askFor } from "./ask.mjs";
import { allied } from "./sides.mjs";
import { notCreature } from "./kinds.mjs";
import { tierOf, hasAncestryTree } from "./skills.mjs";
import { TREES } from "./trees.mjs";
import { resolveAttack, poolFormula, applyStacks, gravityForce } from "./rules.mjs";
import { weaponProfile, WEAPON_TYPES, WEAPON_MATERIALS, ARMOR_WEIGHTS } from "./martial.mjs";
import { levelAt, terrainRegionData } from "./terrain.mjs";
import { GLAND_ELEMENTS } from "./abc-rules.mjs";
import { spiritToken } from "./spirit.mjs";
import { inTerritory } from "./ancestry-net.mjs";
import * as bestiary from "./bestiary.mjs";
import { esc, select, DialogV2 } from "./html.mjs";

const tier = (actor, id) => tierOf(actor?.system?.trees, id);
const sp = actor => Number(actor?.system?.skillPoints) || 0;
const card = (actor, title, html) => post(actor, { title: `${esc(actor.name)} — ${esc(title)}`, body: html });
const roundKey = () => (game.combat?.started ? `${game.combat.id}:${game.combat.round}` : null);
const combatKey = () => (game.combat?.started ? game.combat.id : null);
const scopeKey = scope => (scope === "turn" ? turnKey() : scope === "round" ? roundKey() : scope === "combat" ? combatKey() : null);
/** Has the ability been used in its window (turn, round, combat, or since the last rest)? Out of combat a turn/round/combat window is always fresh. */
export function used(actor, name, scope) {
  if (scope === "rest") return !!actor?.getFlag?.("flowstate", "ancRest")?.[name];
  const k = scopeKey(scope);
  return !!k && actor?.getFlag?.("flowstate", "ancUse")?.[name] === k;
}
async function use(actor, name, scope) {
  if (scope === "rest") return setActorFlag(actor, "ancRest", { [name]: true });
  const k = scopeKey(scope);
  if (k) await setActorFlag(actor, "ancUse", { [name]: k });
}
const tokenOf = actor => attackerToken(actor) ?? actor?.getActiveTokens?.()[0] ?? null;
const dist = (a, b) => { const x = tokenOf(a), y = tokenOf(b); return x && y && globalThis.canvas?.grid ? tokenDistance(x, y) : null; };
const targetsOf = () => [...(game.user?.targets ?? [])].map(t => t.actor).filter(a => a && !notCreature(a));
const elements = actor => [actor.system.abc?.element, tier(actor, "ancestry-draken-elements") >= 2 ? actor.getFlag?.("flowstate", "gland2") : null].filter(e => GLAND_ELEMENTS[e]);

/* -------------------------------------------- */
/*  Action List                                 */
/* -------------------------------------------- */

/** Abilities with their own row or hook (the rest of the active ones get a pay-and-post row; passives without a hook are text). */
export const AUTOMATED = new Set(["Shed the Heat", "Keen Instincts", "Territorial", "Tribe", "Slip Through", "Quick Feet", "Big Gear", "Underfoot", "Small Target",
  "Indomitable", "Immovable", "Grudgebearer", "Lucky", "Good Spirits", "Unassuming", "Neutral Party", "Charmed Life", "Mindful of Fragility", "Magic Boost",
  "Overflowing Magic", "Shadow Spirit", "Transference", "Mastered Tether", "Curse-Hardened", "Spirit Shell", "Lingering Spirit", "Unbroken Spirit",
  "Elemental Ward", "Elemental Diversity", "Elemental Mastery", "Elemental Absorption", "Elemental Attunement", "Unbowed", "Ward of the Hold",
  "Awakened Scales", "Elemental Wings", "Overgrowth", "Home Ground", "Wild Heart", "Underdog", "Topple", "Duelist", "Proven Strength", "Searing Zeal",
  "Flamekin", "Unlucky", "Mob Rule", "Jinx", "Acclimated", "Hardy Constitution", "Adaptive Lineage", "Endless Adaptation",
  // The trees added with the Namuh, Sworan, Wildibit, Myrthel, Dawn Elf, Noctua, Minotaur and Smoblin.
  "Bounding", "Wings", "Silent Wings", "Swoop", "Turning Gaze", "Death From Above", "Lake Surge", "Endless Tide", "Twitching Ears", "Hind Kick", "Warning Thump",
  "Powerful Legs", "Unwelcome", "Acid-Worn", "Rotting Touch", "Numb Flesh", "Spreading Rot", "Unstable Regeneration", "Stabilized", "Sealed Wounds",
  "Accelerated Healing", "Rapid Regrowth", "Perfect Body", "Living Metal Arm", "Deep-Dweller", "Deepforged", "Stone Skin", "Coreforged", "Quick Reshape",
  "Paws", "Skittish", "Zig-Zag", "Warren Instinct", "Untouchable", "Glass Body", "Steeped in Magic", "Shy of Pain", "Treasured", "Blood Price",
  "Hardened Glass", "Overflowing Blood", "Fused Shadow", "Lashing Shadow", "Uneasy Truce", "Shadow Unleashed", "Wing-Hands", "Heavy Wings", "Perched",
  "Feather-Fall", "Strong Wings", "Thick Hide", "Red Tide", "Toughened Hide", "Unending Rage", "Steady Focus", "Light Step", "Overclock", "Hardened Mind",
  "Redline", "Faith of the Flame", "Awakened Mind"]);
/** An ability with a cost or a duration (its text names AP, RP or Energy, or a time). */
const isActive = text => /\*\*\d+ (AP|RP)\*\*|\b\d+ (AP|RP)\b|Cost:|\b\d+ minutes?\b|once per (day|rest)/i.test(text ?? "");
const pointsIn = text => ({ ap: Number(/\b(\d+) AP\b/.exec(text ?? "")?.[1]) || 0, rp: Number(/\b(\d+) RP\b/.exec(text ?? "")?.[1]) || 0 });

export function actionRows(actor) {
  const rows = [], inCombat = inActiveCombat(actor);
  const row = (label, detail, cost, op, icon, extra = {}) => rows.push({ label, detail, cost, action: "ancestry", op, icon, ...extra });
  if (tier(actor, "ancestry-wusonian") >= 1) {
    const list = actor.getFlag?.("flowstate", "biomes") ?? [], t = tier(actor, "ancestry-wusonian");
    row("Acclimated", `${list.length ? `Acclimated to: ${list.join(", ")}` : "No biome set"} (${t >= 5 ? "every biome you've lived in for a week" : t >= 4 ? "two biomes" : "one biome"}): its Extreme penalties don't apply and you have Advantage on Athletics checks there`, "—", "acclimate", "fa-solid fa-mountain-sun");
  }
  if (tier(actor, "ancestry-wusonian") >= 3 && inCombat) row("Shed the Heat", `Once per turn, after you move: regain ${actor.system.derived?.energyRecover ?? 0} Energy`, "2 RP", "shedHeat", "fa-solid fa-temperature-arrow-down", { disabled: used(actor, "shedHeat", "turn") });
  if (tier(actor, "ancestry-bestial") >= 2) {
    const here = inTerritory(actor);
    row(here ? "Territorial: this is your territory" : "Territorial: claim this scene", here ? "Advantage on perception checks, and you can't be Surprised here" : "A place you've lived in for a week (the GM's call): this scene becomes your territory", "—", "territory", "fa-solid fa-flag", { disabled: here });
  }
  if (tier(actor, "ancestry-halfling-tree") >= 1) {
    const scope = tier(actor, "ancestry-halfling-tree") >= 5 ? "combat" : "rest";
    row("Lucky", `Advantage on your next check, attack roll or dodge roll (your pick)${scope === "combat" ? "; or give it to an ally within 30 ft (target them)" : ""} · once per ${scope}`, "Free", "lucky", "fa-solid fa-clover", { disabled: used(actor, "lucky", scope) });
  }
  if (tier(actor, "ancestry-halfling-tree") >= 2) row("Good Spirits", "Lead a celebration as you rest: you and the targeted allies have Advantage on your first check to resist Fear until your next rest · once per rest", "Rest", "goodSpirits", "fa-solid fa-champagne-glasses", { disabled: used(actor, "goodSpirits", "rest") });
  if (tier(actor, "ancestry-dirtborn") >= 4 && inCombat) row("Duelist", "Advantage on your next attack: pay RP equal to its AP (Light 2, Heavy 3) · once per round", "2–3 RP", "duelist", "fa-solid fa-user-ninja", { disabled: used(actor, "duelist", "round") });
  if (tier(actor, "ancestry-dirtborn") >= 3 && inCombat) row("Topple", `Attack roll against the targeted creature in your melee range${tier(actor, "ancestry-dirtborn") >= 5 ? "" : " that has Disadvantage on its dodge"}; it dodges without that Disadvantage. On a hit it's knocked Prone instead of damaged · once per round`, "2 RP", "topple", "fa-solid fa-person-falling-burst", { disabled: used(actor, "topple", "round") });
  if (tier(actor, "ancestry-orc-tree") >= 3) row("Overgrowth", `A 10 ft square of ${tier(actor, "ancestry-orc-tree") >= 5 ? "difficult" : "rough"} terrain around the targeted creature within 30 ft (or you), until combat ends; it doesn't slow you. Up to three · once per round`, "2 AP", "overgrowth", "fa-solid fa-seedling", { disabled: used(actor, "overgrowth", "round") });
  if (tier(actor, "ancestry-draken-legacy") >= 3 && inCombat) row("Ward of the Hold", "Until the start of your next turn, Spell damage to you and allies within 10 ft gets a Weakened stack · once per combat", "2 AP", "wardHold", "fa-solid fa-shield-heart", { disabled: used(actor, "wardHold", "combat") });
  if (tier(actor, "ancestry-draken-legacy") >= 5) row("Elemental Wings", "Lift equal to your Gravity Force for 1 minute (10 rounds): you fly at your ground speed · once per rest", "2 AP", "wings", "fa-solid fa-dove", { disabled: used(actor, "wings", "rest") || !!actor.getFlag("flowstate", "wings") });
  if (tier(actor, "ancestry-goblin-tree") >= 4 && inCombat) row("Mob Rule", "Mark the targeted creature within 100 ft: until the start of your next turn each ally's first attack against it has Advantage · once per combat", "2 AP", "mobRule", "fa-solid fa-users-viewfinder", { disabled: used(actor, "mobRule", "combat") });
  if (tier(actor, "ancestry-dusken-shadow") >= 3) {
    const spirit = spiritToken(actor), t5 = tier(actor, "ancestry-dusken-shadow") >= 5;
    if (!spirit) row("Shadow Spirit", `Separate your spirit into a space within ${t5 ? 100 : 30} ft: you perceive and cast Spells from it, and move it with your movement`, `${t5 ? 1 : 3} AP`, "spiritOut", "fa-solid fa-ghost");
    else {
      row("Shadow Spirit: recombine", "Your spirit returns to your body", "1 AP", "spiritIn", "fa-solid fa-person-rays");
      if (tier(actor, "ancestry-dusken-shadow") >= 4) row("Transference", "Swap your body's place with your spirit's, then recombine · once per round", t5 ? "2 RP" : "2 AP", "transfer", "fa-solid fa-right-left", { disabled: used(actor, "transfer", "round") });
    }
  }
  if (tier(actor, "ancestry-draken-elements") >= 2 && !actor.getFlag?.("flowstate", "gland2")) row("Elemental Diversity", "Choose your Elemental Gland's second element", "—", "diversity", "fa-solid fa-droplet");
  if (actor.system.abc?.ancestry === "drakenblood" && actor.system.abc?.element) {
    const els = elements(actor).map(e => GLAND_ELEMENTS[e]).join(" or ");
    row("Breath: Light", `Elemental Gland: a ranged natural attack (15 ft) dealing ${els} damage, both fists free`, "2 AP", "breath:light", "fa-solid fa-wind");
    row("Breath: Heavy", `Elemental Gland: a ranged natural attack (15 ft) dealing ${els} damage, both fists free`, "3 AP", "breath:heavy", "fa-solid fa-wind");
  }
  newRows(actor, row, inCombat);
  // The Bestiary's creatures (bestiary.mjs): natural attacks, Recognition, Allure/Dread, Sustain, Portent, Sporing / Bloom.
  rows.push(...bestiary.actionRows(actor));
  // Every other active ability: pay its cost, post what it does.
  for (const tree of TREES) {
    if (tree.archetype !== "ancestry" || tree.rulesOnly) continue;
    const have = tier(actor, tree.id);
    for (const t of tree.tiers) {
      if (t.tier > have || t.tier === 0) continue;
      for (const e of t.entries) {
        if (!e.name || AUTOMATED.has(e.name) || (tree.bestiary && bestiary.AUTOMATED.has(e.name)) || !isActive(e.text)) continue;
        const pts = pointsIn(e.text);
        rows.push({ label: e.name, detail: tree.name, cost: [pts.ap ? `${pts.ap} AP` : "", pts.rp ? `${pts.rp} RP` : ""].filter(Boolean).join(" · ") || "Time", action: "ancestry", op: `use:${tree.id}:${e.name}`, icon: "fa-solid fa-circle-play" });
      }
    }
  }
  return rows;
}

/** An Action List click. */
export async function run(actor, op) {
  if (op?.startsWith("use:")) return useRow(actor, op);
  if (op?.startsWith("best:")) return bestiary.run(actor, op.slice(5));
  if (op?.startsWith("breath:")) return breath(actor, op.slice(7));
  const f = OPS[op];
  return f ? f(actor) : null;
}

/** A pay-and-post row: the AP/RP its text names, then its text on a card. */
async function useRow(actor, op) {
  const [, treeId, name] = op.split(":");
  const e = TREES.find(t => t.id === treeId)?.tiers.flatMap(t => t.entries).find(x => x.name === name);
  if (!e) return null;
  const pts = pointsIn(e.text);
  if (pts.ap && !(await spendPoints(actor, "ap", pts.ap, name))) return null;
  if (pts.rp && !(await spendPoints(actor, "rp", pts.rp, name))) return null;
  return card(actor, name, `<div class="fs-result">${esc(e.text)}</div>`);
}

const OPS = {
  async shedHeat(actor) {
    if (used(actor, "shedHeat", "turn")) return ui.notifications.warn("Shed the Heat is once per turn.");
    if (!(actor.getFlag("flowstate", "moveLedger")?.ft > 0) && !(actor.getFlag("flowstate", "moveLedger")?.moves?.length)) return ui.notifications.warn(`${actor.name} hasn't moved this turn.`);
    if (actor.statuses?.has?.("fear")) return ui.notifications.warn(`${actor.name} is afraid and can't gain Energy.`);
    if (!(await spendPoints(actor, "rp", 2, "Shed the Heat"))) return null;
    const e = actor.system.energy, gain = await energyRestoreAdjust(actor, actor.system.derived?.energyRecover ?? 0);
    await actor.update({ "system.energy.value": Math.min(e.max, e.value + gain) });
    await use(actor, "shedHeat", "turn");
    return card(actor, "Shed the Heat", `<div class="fs-result">+${gain} Energy (as 1 AP of recovering).</div>`);
  },
  async territory(actor) {
    const scene = globalThis.canvas?.scene;
    if (!scene) return null;
    await setActorFlag(actor, "territory", scene.uuid);
    return card(actor, "Territorial", `<div class="fs-result">${esc(scene.name)} is ${esc(actor.name)}'s territory: Advantage on perception checks here, and they can't be Surprised.</div>`);
  },
  async lucky(actor) {
    const t5 = tier(actor, "ancestry-halfling-tree") >= 5, scope = t5 ? "combat" : "rest";
    if (used(actor, "lucky", scope)) return ui.notifications.warn(`Lucky is once per ${scope}.`);
    const ally = t5 ? targetsOf().find(a => a.uuid !== actor.uuid && allied(actor, a) && (dist(actor, a) ?? 0) <= 30) ?? null : null;
    const who = ally ?? actor;
    const kind = await DialogV2().prompt({ window: { title: `Lucky${ally ? `: ${ally.name}` : ""}` }, rejectClose: false,
      content: `<div class="form-group"><label>Advantage on ${esc(who.name)}'s next</label>${select("kind", [["attack", "Attack roll"], ["dodge", "Dodge roll"], ["check", "Check (any Non Stat or stat check)"]], "attack")}</div>`,
      ok: { label: "Arm it", callback: (event, button) => button.form.elements.kind.value } });
    if (!kind) return null;
    await armEdge(who, kind);
    await use(actor, "lucky", scope);
    return card(actor, "Lucky", `<div class="fs-result"><i class="fa-solid fa-clover"></i> Advantage on ${esc(who.name)}'s next ${kind === "check" ? "check" : `${kind} roll`}.</div>`);
  },
  async goodSpirits(actor) {
    if (used(actor, "goodSpirits", "rest")) return ui.notifications.warn("Good Spirits is once per rest.");
    const party = [actor, ...targetsOf().filter(a => a.uuid !== actor.uuid && allied(actor, a))];
    for (const a of party) await armEdge(a, "fear");
    await use(actor, "goodSpirits", "rest");
    return card(actor, "Good Spirits", `<div class="fs-result">A celebration: ${party.map(a => esc(a.name)).join(", ")} have Advantage on their first check to resist Fear until their next rest.</div>`);
  },
  async duelist(actor) {
    if (used(actor, "duelist", "round")) return ui.notifications.warn("Duelist is once per round.");
    const ap = await DialogV2().prompt({ window: { title: "Duelist" }, rejectClose: false,
      content: `<div class="form-group"><label>Your next attack costs</label>${select("ap", [["2", "2 AP (Light): 2 RP"], ["3", "3 AP (Heavy): 3 RP"]], "2")}</div>`,
      ok: { label: "Pay", callback: (event, button) => Number(button.form.elements.ap.value) } });
    if (!ap || !(await spendPoints(actor, "rp", ap, "Duelist"))) return null;
    await armEdge(actor, "attack");
    await use(actor, "duelist", "round");
    return card(actor, "Duelist", `<div class="fs-result">${ap} RP: Advantage on ${esc(actor.name)}'s next attack.</div>`);
  },
  topple: actor => topple(actor),
  accelHeal: actor => accelHeal(actor),
  arm: actor => reshapeArm(actor),
  absorb: actor => absorbMaterial(actor),
  hide: actor => thickHide(actor),
  lakeSurge: actor => armed(actor, "lakeSurge", { tree: "ancestry-lakeborn", ap: 2, label: "Lake Surge", flag: true,
    text: "Until the start of their next turn, Stage 1 movement slows don't affect them, and they have Advantage on checks to resist being grappled, moved or knocked Prone." }),
  zigzag: actor => armed(actor, "zigzag", { tree: "ancestry-wildibit-tree", rp: 1, label: "Zig-Zag", flag: true, moved: 20,
    text: "Until the start of their next turn, ranged attacks against them have Disadvantage." }),
  hindKick: actor => armed(actor, "hindKick", { tree: "ancestry-leporid", label: "Hind Kick", flag: true,
    text: "Their next Unarmed attack is a kick with the hind legs: Strengthened, and it imparts Force as though it had the Knockback tag." }),
  swoop: actor => armed(actor, "swoop", { tree: "ancestry-strigid", label: "Swoop", flag: "turn", flying: true, moved: 20,
    text: "Their next melee attack this turn (after flying at least 20 ft toward the target) is Strengthened." }),
  overclock: actor => overclock(actor),
  async acclimate(actor) {
    const t = tier(actor, "ancestry-wusonian"), max = t >= 5 ? 20 : t >= 4 ? 2 : 1;
    const cur = (actor.getFlag?.("flowstate", "biomes") ?? []).join(", ");
    const val = await DialogV2().prompt({ window: { title: "Acclimated" }, rejectClose: false,
      content: `<p class="hint">The biome${max > 1 ? "s" : ""} you were raised in or have lived in (${max === 1 ? "one" : max === 2 ? "up to two" : "any you've lived in for a week"}), as the GM names them on scenes: jungle, desert, mountains, sea, tundra...</p>
        <div class="form-group"><label>Biome${max > 1 ? "s (comma separated)" : ""}</label><input type="text" name="b" value="${esc(cur)}"></div>`,
      ok: { label: "Save", callback: (event, button) => button.form.elements.b.value } });
    if (val === null || val === undefined) return null;
    const list = String(val).split(",").map(x => x.trim()).filter(Boolean).slice(0, max);
    await setActorFlag(actor, "biomes", list);
    return card(actor, "Acclimated", `<div class="fs-result">${list.length ? `Acclimated to ${list.map(esc).join(", ")}.` : "No biome."}</div>`);
  },
  async diversity(actor) {
    const first = actor.system.abc?.element;
    const el = await DialogV2().prompt({ window: { title: "Elemental Diversity" }, rejectClose: false,
      content: `<div class="form-group"><label>Second element</label>${select("el", Object.entries(GLAND_ELEMENTS).filter(([k]) => k !== first), "")}</div>`,
      ok: { label: "Choose", callback: (event, button) => button.form.elements.el.value } });
    if (!GLAND_ELEMENTS[el] || el === first) return null;
    await setActorFlag(actor, "gland2", el);
    return card(actor, "Elemental Diversity", `<div class="fs-result">${esc(actor.name)}'s gland can also breathe ${esc(GLAND_ELEMENTS[el])}; Elemental Ward covers both.</div>`);
  },
  async overgrowth(actor) {
    if (used(actor, "overgrowth", "round")) return ui.notifications.warn("Overgrowth is once per round.");
    const scene = globalThis.canvas?.scene, at = targetsOf()[0] ?? actor;
    if (!scene || !tokenOf(at)) return ui.notifications.warn("Overgrowth needs a scene and a token to grow around.");
    if (at !== actor && (dist(actor, at) ?? 0) > 30) return ui.notifications.warn(`${at.name} is more than 30 ft away.`);
    const mine = [...(scene.regions ?? [])].filter(r => r.flags?.flowstate?.overgrowthOf === actor.uuid);
    if (!(await spendPoints(actor, "ap", 2, "Overgrowth"))) return null;
    if (mine.length >= 3) await requestGM("overgrowthTrim", { sceneId: scene.id, id: mine[0].id });
    const tok = tokenOf(at), size = scene.grid?.size ?? 100, kind = tier(actor, "ancestry-orc-tree") >= 5 ? "difficult" : "rough";
    const c = { x: tok.document?.x ?? tok.x, y: tok.document?.y ?? tok.y };
    const w = (tok.document?.width ?? 1) * size, h = (tok.document?.height ?? 1) * size;
    const data = terrainRegionData(kind, { cx: c.x + w / 2, cy: c.y + h / 2, sidePx: (10 / (scene.grid?.distance ?? 5)) * size, name: `Overgrowth (${actor.name})`,
      flags: { terrainOf: actor.uuid, overgrowthOf: actor.uuid, ritualOf: `overgrowth:${game.combat?.id ?? "scene"}` } });
    await requestGM("createTerrain", { sceneId: scene.id, data });
    await use(actor, "overgrowth", "round");
    return card(actor, "Overgrowth", `<div class="fs-result">A 10 ft square of ${kind} terrain grows around ${esc(at.name)} until combat ends (it doesn't slow ${esc(actor.name)}).</div>`);
  },
  async wardHold(actor) {
    if (used(actor, "wardHold", "combat")) return ui.notifications.warn("Ward of the Hold is once per combat.");
    if (!(await spendPoints(actor, "ap", 2, "Ward of the Hold"))) return null;
    await setActorFlag(actor, "wardHold", true);
    await use(actor, "wardHold", "combat");
    return card(actor, "Ward of the Hold", `<div class="fs-result">Until the start of ${esc(actor.name)}'s next turn, Spell damage to them and allies within 10 ft gets a Weakened stack.</div>`);
  },
  async wings(actor) {
    if (used(actor, "wings", "rest")) return ui.notifications.warn("Elemental Wings is once per rest.");
    if (!(await spendPoints(actor, "ap", 2, "Elemental Wings"))) return null;
    const G = (() => { try { return Number(game.settings.get("flowstate", "gravity")) || 1; } catch { return 1; } })();
    const lift = gravityForce({ gravity: G, maxHp: actor.system.hp.max, rounds: 1, size: actor.system.size });
    const combat = inActiveCombat(actor) ? game.combat : null;
    await actor.update({ "system.lift": lift, "flags.flowstate.wings": { prev: actor._source?.system?.lift ?? 0, time: (game.time?.worldTime ?? 0) + 60, combat: combat?.id ?? null, round: (combat?.round ?? 0) + 10 } });
    await setStatus(actor, "flying", true);
    await use(actor, "wings", "rest");
    const el = GLAND_ELEMENTS[actor.system.abc?.element] ?? "elemental";
    return card(actor, "Elemental Wings", `<div class="fs-result">Wings of ${esc(el.toLowerCase())} unfold: Lift ${lift} for 1 minute (10 rounds). ${esc(actor.name)} flies at their ground speed.</div>`);
  },
  async mobRule(actor) {
    if (used(actor, "mobRule", "combat")) return ui.notifications.warn("Mob Rule is once per combat.");
    const t = targetsOf().find(a => a.uuid !== actor.uuid);
    if (!t) return ui.notifications.warn("Target the creature to mark.");
    if ((dist(actor, t) ?? 0) > 100) return ui.notifications.warn(`${t.name} is more than 100 ft away.`);
    if (!(await spendPoints(actor, "ap", 2, "Mob Rule"))) return null;
    await setActorFlag(t, "mobRule", { by: actor.uuid, round: game.combat?.round ?? 0, used: [] });
    await use(actor, "mobRule", "combat");
    return card(actor, "Mob Rule", `<div class="fs-result">${esc(t.name)} is marked: until the start of ${esc(actor.name)}'s next turn, each ally's first attack against it has Advantage.</div>`);
  },
  async spiritOut(actor) {
    const scene = globalThis.canvas?.scene, me = tokenOf(actor);
    if (!scene || !me) return ui.notifications.warn("Shadow Spirit needs your token on a scene.");
    const t5 = tier(actor, "ancestry-dusken-shadow") >= 5;
    if (!(await spendPoints(actor, "ap", t5 ? 1 : 3, "Shadow Spirit"))) return null;
    const pos = besideTokenPosition(me);
    await requestGM("spiritCreate", { actor: actor.uuid, sceneId: scene.id, x: pos.x, y: pos.y });
    return card(actor, "Shadow Spirit", `<div class="fs-result">${esc(actor.name)}'s spirit separates (within ${t5 ? 100 : 30} ft). It passes through non-magical objects, moves with ${esc(actor.name)}'s movement, and Spells are cast from it.</div>`);
  },
  async spiritIn(actor) {
    if (!(await spendPoints(actor, "ap", 1, "Shadow Spirit"))) return null;
    await recombine(actor);
    return card(actor, "Shadow Spirit", `<div class="fs-result">${esc(actor.name)}'s spirit returns to their body.</div>`);
  },
  async transfer(actor) {
    const spirit = spiritToken(actor), me = tokenOf(actor);
    if (!spirit || !me) return null;
    if (used(actor, "transfer", "round")) return ui.notifications.warn("Transference is once per round.");
    const t5 = tier(actor, "ancestry-dusken-shadow") >= 5;
    if (!(await spendPoints(actor, t5 ? "rp" : "ap", 2, "Transference"))) return null;
    const to = { x: spirit.document?.x ?? spirit.x, y: spirit.document?.y ?? spirit.y };
    await requestGM("moveToken", { uuid: me.document?.uuid ?? me.uuid, x: to.x, y: to.y });
    await recombine(actor);
    await use(actor, "transfer", "round");
    return card(actor, "Transference", `<div class="fs-result">${esc(actor.name)} steps into their spirit's place, and the two become one again.</div>`);
  }
};

/** Advantage armed for a creature's next roll of a kind (edge.mjs): "attack", "dodge", "check", "fear"... */
async function armEdge(actor, kind) {
  const list = actor.getFlag?.("flowstate", "edge") ?? [];
  await setActorFlag(actor, "edge", [...(Array.isArray(list) ? list : []), kind]);
}
async function recombine(actor) {
  const sp = spiritToken(actor);
  if (sp) await requestGM("spiritRemove", { actor: actor.uuid });
}
/* -------------------------------------------- */
/*  Topple and the breath                       */
/* -------------------------------------------- */

/** Topple (Dirtborn T3): 2 RP, an attack roll against a creature in melee range that would have Disadvantage on its dodge (Proven Strength, T5: any). */
async function topple(actor) {
  if (used(actor, "topple", "round")) return ui.notifications.warn("Topple is once per round.");
  const t = targetsOf().find(a => a.uuid !== actor.uuid);
  if (!t) return ui.notifications.warn("Target the creature to topple.");
  if ((dist(actor, t) ?? 0) > (actor.system.derived?.size?.melee ?? 5)) return ui.notifications.warn(`${t.name} isn't in your melee range.`);
  const dis = dodgeNetKnown(t);
  if (tier(actor, "ancestry-dirtborn") < 5 && dis >= 0) return ui.notifications.warn(`${t.name} doesn't have Disadvantage on its dodge (Proven Strength, Tier 5, drops this).`);
  if (!(await spendPoints(actor, "rp", 2, "Topple"))) return null;
  await use(actor, "topple", "round");
  const atk = await rollKit.evaluate(poolFormula(1, actor.system.derived.attackDie, rollKit.noAdvantage(actor, rollKit.net(actor, "attack"))));
  const fixed = fixedDodgeOf(t);          // a fixed dodge (NPC): compared with, not rolled
  const dodge = fixed === null ? await rollKit.evaluate(poolFormula(2, t.system.derived.dodgeDie, 0)) : null;
  const res = resolveAttack(atk.total, dodge ? dodge.total : fixed);
  if (res.hit) await setStatus(t, "prone", true);
  return post(actor, { title: `${esc(actor.name)} — Topple`, rolls: dodge ? [atk, dodge] : [atk],
    body: `${await rollKit.rollBlock(atk, `Attack (d${actor.system.derived.attackDie})`)}${dodge ? await rollKit.rollBlock(dodge, `${esc(t.name)}'s dodge (2d${t.system.derived.dodgeDie}, without the Disadvantage)`) : `<div class="fs-notes">${esc(t.name)}'s fixed dodge: ${fixed}</div>`}
      <div class="fs-result">${res.hit ? `<strong>${esc(t.name)} is knocked Prone</strong> (no damage).` : `${esc(t.name)} keeps their footing.`}</div>` });
}

/** Elemental Gland (Drakenblood): a Light or Heavy unarmed attack with your breath: a ranged natural attack (15 ft) of the gland's element; both fists stay free. */
async function breath(actor, weight) {
  const els = elements(actor);
  if (!els.length) return ui.notifications.warn(`${actor.name} has no Elemental Gland element set.`);
  let el = els[0];
  if (els.length > 1) {
    el = await DialogV2().prompt({ window: { title: "Breath: which element?" }, rejectClose: false,
      content: `<div class="form-group"><label>Element</label>${select("el", els.map(e => [e, GLAND_ELEMENTS[e]]), els[0])}</div>`,
      ok: { label: "Breathe", callback: (event, button) => button.form.elements.el.value } });
    if (!el) return null;
  }
  const targets = targetsOf();
  if (!targets.length) return ui.notifications.warn("Target who you breathe on.");
  const far = targets.find(t => (dist(actor, t) ?? 0) > 15);
  if (far) return ui.notifications.warn(`${far.name} is beyond your breath's 15 ft.`);
  const eff = actor.system.derived.effective;
  const p = weaponProfile({ type: "unarmed", weight, material: "", grade: 1, natural: true }, { str: eff.str.value, dex: eff.dex.value });
  if (!p?.valid) return ui.notifications.warn(p?.error ?? "No breath profile.");
  const ap = weight === "heavy" ? 3 : 2;
  if (!(await spendPoints(actor, "ap", ap, "Breath"))) return null;
  return performAttack(actor, { label: `Breath (${GLAND_ELEMENTS[el]}, ${weight === "heavy" ? "Heavy" : "Light"})`, net: 0, melee: false, push: false,
    damage: p.formula, type: el, stacks: p.stacks ?? 0, physical: true, natural: true, shots: 1, ap: 0, apCost: ap,
    notes: ["Elemental Gland: a ranged natural attack (15 ft)"], followups: [], turnKey: turnKey(), targetActors: targets });
}

/* -------------------------------------------- */
/*  The newer trees: rows                       */
/* -------------------------------------------- */

const scopeOf = (actor, tree, five = "round", base = "combat") => (tier(actor, tree) >= 5 ? five : base);
/** The extra rows the newer trees bring (row(label, detail, cost, op, icon, extra)). */
function newRows(actor, row, inCombat) {
  const t = id => tier(actor, id);
  if (t("ancestry-namuh-tree") >= 3) row("Accelerated Healing", `Regain the HP an 8 hour rest would (${actor.system.derived?.restHeal ?? 0}), up to what you've lost since the start of your last turn · once per turn`,
    t("ancestry-namuh-tree") >= 5 ? "2 AP" : `2 AP · ${actor.system.skillPoints ?? 0} Energy`, "accelHeal", "fa-solid fa-heart-pulse", { disabled: used(actor, "accelHeal", "turn") });
  if (hasAncestryTree(actor.system, "ancestry-sworan-tree")) {
    const cur = livingArm(actor), t5 = t("ancestry-sworan-tree") >= 5;
    row("Living Metal Arm", `Now: ${cur ? esc(cur.name) : "a plain arm"}. Reshape it into a Foci, an Icon Form, a Weapon of an absorbed material (${armMaterials(actor).map(m => WEAPON_MATERIALS[m]?.label ?? m).join(", ")}), or a plain arm`,
      t5 && inCombat ? "1 AP" : "1 minute", "arm", "fa-solid fa-hand-fist", { disabled: inCombat && (!t5 || used(actor, "reshape", "round")) });
    if (!inCombat) row("Living Metal Arm: absorb a material", `Over an 8 hour rest, merge an item (or the raw material) of a ${t("ancestry-sworan-tree") >= 4 ? "Common, Uncommon or Rare" : t("ancestry-sworan-tree") >= 2 ? "Common or Uncommon" : "Common"} Weapon material into your arm; the item is used up`, "Rest", "absorb", "fa-solid fa-magnet");
  }
  if (hasAncestryTree(actor.system, "ancestry-minotaur-tree") && !inCombat) {
    const hide = actor.items?.find(i => i.getFlag?.("flowstate", "thickHide"));
    row("Thick Hide", `${hide ? `Grown out: ${esc(hide.name)}` : "Shed"}. Over an 8 hour rest, grow it out as ${t("ancestry-minotaur-tree") >= 4 ? "Light, Medium, Heavy or Titanic" : "Light or Medium"} Armor, or shed it`, "Rest", "hide", "fa-solid fa-shield-cat");
  }
  if (t("ancestry-lakeborn") >= 3 && inCombat) row("Lake Surge", `Until the start of your next turn: Stage 1 movement slows don't affect you; Advantage on checks to resist being grappled, moved or knocked Prone · once per ${scopeOf(actor, "ancestry-lakeborn")}`,
    "2 AP", "lakeSurge", "fa-solid fa-water", { disabled: used(actor, "lakeSurge", scopeOf(actor, "ancestry-lakeborn")) });
  if (t("ancestry-wildibit-tree") >= 3 && inCombat) row("Zig-Zag", `After moving at least 20 ft this turn: ranged attacks against you have Disadvantage until the start of your next turn · once per ${scopeOf(actor, "ancestry-wildibit-tree")}`,
    "1 RP", "zigzag", "fa-solid fa-shuffle", { disabled: used(actor, "zigzag", scopeOf(actor, "ancestry-wildibit-tree")) });
  if (t("ancestry-leporid") >= 3 && inCombat) row("Hind Kick", `Your next Unarmed attack kicks with your hind legs: Strengthened, with Knockback · once per ${scopeOf(actor, "ancestry-leporid")}`,
    "Free", "hindKick", "fa-solid fa-shoe-prints", { disabled: used(actor, "hindKick", scopeOf(actor, "ancestry-leporid")) || !!actor.getFlag?.("flowstate", "hindKick") });
  if (t("ancestry-strigid") >= 3 && inCombat) row("Swoop", `After flying at least 20 ft toward the target this turn: your next melee attack is Strengthened · once per ${scopeOf(actor, "ancestry-strigid")}`,
    "Free", "swoop", "fa-solid fa-feather-pointed", { disabled: used(actor, "swoop", scopeOf(actor, "ancestry-strigid")) || !actor.statuses?.has?.("flying") });
  if (t("ancestry-smoblin-tree") >= 3) row("Overclock", `Raise your Alignment by 1 (up to your deepest) until the end of your next turn; the extra point costs no speed or AP · once per ${scopeOf(actor, "ancestry-smoblin-tree")}`,
    "1 RP", "overclock", "fa-solid fa-gauge-high", { disabled: used(actor, "overclock", scopeOf(actor, "ancestry-smoblin-tree")) || !!actor.getFlag?.("flowstate", "overclock") });
}

/** A row that pays, checks its window and sets a flag (`flag`: true until cleared, "turn": this turn's key). */
async function armed(actor, key, { tree, ap = 0, rp = 0, label, flag, moved = 0, flying = false, text }) {
  const scope = scopeOf(actor, tree);
  if (used(actor, key, scope)) return ui.notifications.warn(`${label} is once per ${scope}.`);
  if (flying && !actor.statuses?.has?.("flying")) return ui.notifications.warn(`${actor.name} isn't flying.`);
  if (moved && !((actor.getFlag("flowstate", "moveLedger")?.ft ?? 0) >= moved)) {
    const ok = await DialogV2().confirm({ window: { title: label }, rejectClose: false, content: `<p>${label} needs ${esc(actor.name)} to have moved at least ${moved} ft this turn${flying ? " (flying toward the target)" : ""}. Have they?</p>` });
    if (!ok) return null;
  }
  if (ap && !(await spendPoints(actor, "ap", ap, label))) return null;
  if (rp && !(await spendPoints(actor, "rp", rp, label))) return null;
  await setActorFlag(actor, key, flag === "turn" ? turnKey() : true);
  await use(actor, key, scope);
  return card(actor, label, `<div class="fs-result">${esc(text)}</div>`);
}

/** Accelerated Healing (Namuh T3): 2 AP and Energy equal to your total Skill Points (none with Perfect Body, T5); the 8 hour rest's HP, up to what was lost since the start of your last turn. */
async function accelHeal(actor) {
  if (used(actor, "accelHeal", "turn")) return ui.notifications.warn("Accelerated Healing is once per turn.");
  const since = restoreSince(actor), room = restorable(actor, since), heal = Math.min(actor.system.derived?.restHeal ?? 0, room, actor.system.hp.max - actor.system.hp.value);
  if (heal <= 0) return ui.notifications.warn(`${actor.name} hasn't lost any health since the start of their last turn.`);
  const energy = tier(actor, "ancestry-namuh-tree") >= 5 ? 0 : actor.system.skillPoints ?? 0;
  if (energy && energyHave(actor) < energy) return ui.notifications.warn(`Accelerated Healing costs ${energy} Energy.`);
  if (!(await spendPoints(actor, "ap", 2, "Accelerated Healing"))) return null;
  if (energy && !(await spendEnergy(actor, energy, "Accelerated Healing"))) return null;
  await actor.update({ "system.hp.value": actor.system.hp.value + heal });
  const log = actor.getFlag("flowstate", "restoreLog") ?? [];
  await setActorFlag(actor, "restoreLog", [...log.slice(-20), { at: Date.now(), n: heal }]);
  await use(actor, "accelHeal", "turn");
  return card(actor, "Accelerated Healing", `<div class="fs-result">+${heal} HP (${actor.system.hp.value}/${actor.system.hp.max})${energy ? ` · ${energy} Energy` : ""}.</div>`);
}

/* ---- Living Metal Arm (Sworan T0) ---- */
const livingArm = actor => actor.items?.find(i => i.getFlag?.("flowstate", "livingArm")) ?? null;
/** The Weapon materials absorbed into the arm (Iron to start). */
const armMaterials = actor => [...new Set(["iron", ...(actor.getFlag?.("flowstate", "armMaterials") ?? [])])].filter(m => WEAPON_MATERIALS[m]);
const RARITY_STEP = { common: 0, uncommon: 2, rare: 4 };
async function absorbMaterial(actor) {
  const t = tier(actor, "ancestry-sworan-tree"), have = armMaterials(actor);
  const can = Object.entries(WEAPON_MATERIALS).filter(([k, m]) => !have.includes(k) && RARITY_STEP[m.rarity] !== undefined && t >= RARITY_STEP[m.rarity]);
  if (!can.length) return ui.notifications.info(`${actor.name} has absorbed every material they can.`);
  const k = await DialogV2().prompt({ window: { title: "Living Metal Arm: absorb" }, rejectClose: false,
    content: `<p class="hint">An 8 hour rest merging an item made of it (or enough of the raw material for one) into the arm. The item is used up.</p><div class="form-group"><label>Material</label>${select("m", can.map(([key, m]) => [key, `${m.label} (${m.rarity})`]), can[0][0])}</div>`,
    ok: { label: "Absorb", callback: (event, button) => button.form.elements.m.value } });
  if (!WEAPON_MATERIALS[k]) return null;
  await setActorFlag(actor, "armMaterials", [...have, k]);
  return card(actor, "Living Metal Arm", `<div class="fs-result">${esc(actor.name)} absorbs ${esc(WEAPON_MATERIALS[k].label)}: the arm can take that material's shape from now on.</div>`);
}
async function reshapeArm(actor) {
  const inCombat = inActiveCombat(actor), t5 = tier(actor, "ancestry-sworan-tree") >= 5;
  if (inCombat && !t5) return ui.notifications.warn("Reshaping the arm takes a minute (Quick Reshape, Sworan Tier 5, does it for 1 AP).");
  if (inCombat && used(actor, "reshape", "round")) return ui.notifications.warn("Quick Reshape is once per round.");
  const mats = armMaterials(actor);
  const weapons = Object.entries(WEAPON_TYPES).filter(([k]) => !["unarmed", "improvised"].includes(k)).map(([k, v]) => [k, v.label]);
  const shape = await DialogV2().prompt({ window: { title: "Living Metal Arm" }, rejectClose: false,
    content: `<div class="form-group"><label>Shape</label>${select("shape", [["plain", "A plain arm"], ["weapon", "A Weapon"], ["foci", "A Foci"], ["icon", "An Icon Form"]], "weapon")}</div>
      <div class="form-group"><label>Weapon type</label>${select("type", weapons, weapons[0]?.[0])}</div>
      <div class="form-group"><label>Weight</label>${select("weight", [["light", "Light"], ["heavy", "Heavy"]], "light")}</div>
      <div class="form-group"><label>Material</label>${select("material", mats.map(m => [m, WEAPON_MATERIALS[m].label]), mats[0])}</div>
      <p class="hint">A Heavy-only material (Iron, Stone...) as a Light Weapon uses half its Durability and Limit.</p>
      <div class="form-group"><label>Foci</label>${select("foci", Object.entries(FOCI_TYPES).map(([k, v]) => [k, v.label]), "rod")}</div>
      <div class="form-group"><label>Icon Form</label>${select("form", Object.entries(FORMS).map(([k, v]) => [k, v.label ?? k]), Object.keys(FORMS)[0])}</div>`,
    ok: { label: "Reshape", callback: (event, button) => Object.fromEntries(["shape", "type", "weight", "material", "foci", "form"].map(n => [n, button.form.elements[n].value])) } });
  if (!shape) return null;
  let data = null;
  const flags = { flowstate: { livingArm: true } };
  if (shape.shape === "weapon") {
    const mat = WEAPON_MATERIALS[shape.material];
    if (!mat || !mats.includes(shape.material)) return ui.notifications.warn("The arm can only take the shape of a material it has absorbed.");
    if (!mat.weights[shape.weight] && !(shape.weight === "light" && mat.weights.heavy)) return ui.notifications.warn(`${mat.label} can't be made ${shape.weight === "heavy" ? "Heavy" : "Light"}.`);
    data = { name: `Living Metal Arm (${WEAPON_TYPES[shape.type]?.label ?? shape.type}, ${mat.label})`, type: "weapon", img: "icons/svg/sword.svg", flags,
      system: { weaponType: shape.type, weight: shape.weight, material: shape.material, grade: 1, natural: true, equipped: true } };
  } else if (shape.shape === "foci") data = { name: `Living Metal Arm (${FOCI_TYPES[shape.foci]?.label ?? shape.foci})`, type: "foci", img: "icons/svg/daze.svg", flags,
    system: { fociType: shape.foci, grade: 1, natural: true, attuned: true, equipped: true } };
  else if (shape.shape === "icon") data = { name: `Living Metal Arm (${FORMS[shape.form]?.label ?? shape.form})`, type: "icon", img: "icons/svg/aura.svg", flags,
    system: { form: shape.form, grade: 1, natural: true, attuned: true } };
  if (inCombat) { if (!(await spendPoints(actor, "ap", 1, "Quick Reshape"))) return null; await use(actor, "reshape", "round"); }
  const old = livingArm(actor);
  if (old) await old.delete();
  // As a Foci or Icon it counts as attuned: another attuned one of that kind steps aside.
  if (data && (data.type === "foci" || data.type === "icon")) for (const i of actor.items.filter(x => x.type === data.type && x.system.attuned)) await i.update({ "system.attuned": false }, { flowstateSystem: true });
  if (data?.type === "weapon") for (const i of actor.items.filter(x => x.type === "weapon" && x.system.equipped && x.system.weaponType !== "unarmed" && x.system.twoHanded)) await i.update({ "system.equipped": false });
  if (data) await actor.createEmbeddedDocuments("Item", [data]);
  return card(actor, "Living Metal Arm", `<div class="fs-result">${esc(actor.name)}'s arm reshapes into ${data ? esc(data.name.replace(/^Living Metal Arm \(|\)$/g, "")) : "a plain arm"}${inCombat ? " (Quick Reshape, 1 AP)" : " over a minute"}.</div>`);
}

/* ---- Thick Hide (Minotaur T0) ---- */
const HIDE = { light: "cloth", medium: "hide", heavy: "titanium", titanic: "copper" };          // 15/3, 30/6, 60/12, 120/24: the hide's own numbers
async function thickHide(actor) {
  if (inActiveCombat(actor)) return ui.notifications.warn("Growing or shedding the hide takes an 8 hour rest.");
  const t4 = tier(actor, "ancestry-minotaur-tree") >= 4;
  const weights = [["light", "Light (15 Durability, 3 Limit)"], ["medium", "Medium (30, 6)"], ...(t4 ? [["heavy", "Heavy (60, 12)"], ["titanic", "Titanic (120, 24)"]] : []), ["shed", "Shed it"]];
  const w = await DialogV2().prompt({ window: { title: "Thick Hide" }, rejectClose: false,
    content: `<p class="hint">Over an 8 hour rest. Natural Armor: scales with all your Constitution, the normal penalties of its weight, fully repairs on every rest; while it's grown out you can't wear other Armor.</p><div class="form-group"><label>Grow it as</label>${select("w", weights, "light")}</div>`,
    ok: { label: "Done", callback: (event, button) => button.form.elements.w.value } });
  if (!w) return null;
  const old = actor.items.find(i => i.getFlag?.("flowstate", "thickHide"));
  if (old) await old.delete();
  if (w !== "shed") {
    for (const i of actor.items.filter(x => x.type === "armor" && x.system.equipped)) await i.update({ "system.equipped": false });
    await actor.createEmbeddedDocuments("Item", [{ name: `Thick Hide (${ARMOR_WEIGHTS[w].label})`, type: "armor", img: "icons/svg/shield.svg", flags: { flowstate: { thickHide: true } },
      system: { weight: w, material: HIDE[w], grade: 1, natural: true, equipped: true } }]);
  }
  return card(actor, "Thick Hide", `<div class="fs-result">${w === "shed" ? `${esc(actor.name)} sheds the hide.` : `${esc(actor.name)}'s hide grows out as ${ARMOR_WEIGHTS[w].label} Armor.`}</div>`);
}

/** Overclock (Smoblin T3): 1 RP, Alignment +1 (up to the deepest unlocked) until the end of your next turn; the extra point adds no speed or AP penalty. */
async function overclock(actor) {
  const scope = scopeOf(actor, "ancestry-smoblin-tree");
  if (used(actor, "overclock", scope)) return ui.notifications.warn(`Overclock is once per ${scope}.`);
  const al = alignmentState(actor.getFlag?.("flowstate", "alignment")), deepest = maxAlignment(tier(actor, "mental-theory"));
  if (al.level <= 0) return ui.notifications.warn(`${actor.name} is Neutral: Overclock deepens an Alignment you have.`);
  if (al.level >= deepest) return ui.notifications.warn(`${actor.name}'s Alignment is already at their deepest (${deepest}).`);
  if (!(await spendPoints(actor, "rp", 1, "Overclock"))) return null;
  await setActorFlag(actor, "overclock", { extra: 1, prev: al.level, armed: turnKey() });
  await setActorFlag(actor, "alignment", { kind: al.kind, level: al.level + 1 });
  await use(actor, "overclock", scope);
  return card(actor, "Overclock", `<div class="fs-result">${esc(actor.name)}'s Alignment rises to ${al.level + 1} until the end of their next turn (no extra speed or AP cost).</div>`);
}

/* ---- The newer trees in the exchange ---- */

/** Shy of Pain (Myrthel T1): above the Pain Threshold, dodge dice against physical attacks are +1 size per 10 total Skill Points (Hardened Glass, T4: +2). */
function dodgeDieUp(target, o) {
  const t = tier(target, "ancestry-myrthel-tree");
  if (t < 1 || o?.type !== "physical" || !((target.system.hp?.value ?? 0) > (target.system.hp?.pain ?? 0))) return null;
  const up = Math.floor(sp(target) / 10) * (t >= 4 ? 2 : 1);
  return up > 0 ? { up, note: `Shy of Pain (+${up} die size)` } : null;
}
/** A weapon attack being made: Hind Kick (an Unarmed attack) and Swoop (a melee attack this turn), armed from the Action List, are used up. */
async function weaponAttack(actor, { unarmed, melee }) {
  const out = { stacks: 0, notes: [], knockback: false };
  if (unarmed && actor.getFlag?.("flowstate", "hindKick")) {
    await setActorFlag(actor, "hindKick", null);
    out.stacks += 1; out.knockback = true; out.notes.push("Hind Kick: Strengthened, Knockback");
  }
  if (melee && actor.getFlag?.("flowstate", "swoop") === turnKey()) {
    await setActorFlag(actor, "swoop", null);
    out.stacks += 1; out.notes.push("Swoop: Strengthened");
  }
  return out;
}
/** Red Tide (Minotaur T3): an attack damaged you; 1 RP to rage until the end of your next turn (melee attacks Strengthened, dodges with Disadvantage). */
async function redTide(actor) {
  if (tier(actor, "ancestry-minotaur-tree") < 3 || actor.getFlag?.("flowstate", "redTide") || (actor.system.rp?.value ?? 0) < 1) return;
  const scope = scopeOf(actor, "ancestry-minotaur-tree");
  if (used(actor, "redTide", scope)) return;
  if (!(await askFor(actor, { title: `${actor.name}: Red Tide?`, react: "redTide", ok: "Rage",
    html: `<p>You were hurt. Spend 1 RP to fly into a rage until the end of your next turn: your melee attacks are Strengthened, your dodge rolls have Disadvantage. Once per ${scope}.</p>` }))) return;
  if (!(await spendPoints(actor, "rp", 1, "Red Tide"))) return;
  await use(actor, "redTide", scope);
  await setActorFlag(actor, "redTide", { armed: turnKey() });
  await card(actor, "Red Tide", `<div class="fs-result">${esc(actor.name)} rages: melee attacks Strengthened, dodges with Disadvantage, until the end of their next turn.</div>`);
}
/** Lashing Shadow (Dawn Elf T3): a creature in your melee range hit you; 1 RP for Arcane damage equal to your Build Min (Shadow Unleashed, T5: once per turn, within 30 ft). */
async function lashingShadow(actor, att) {
  const t = tier(actor, "ancestry-dawn-elf-tree");
  if (t < 3 || (actor.system.rp?.value ?? 0) < 1 || notCreature(att)) return;
  const scope = t >= 5 ? "turn" : "round", reach = t >= 5 ? 30 : (actor.system.derived?.size?.melee ?? 5);
  if (used(actor, "lashing", scope) || (dist(actor, att) ?? Infinity) > reach) return;
  const dmg = actor.system.derived?.effective?.build?.min ?? 0;
  if (dmg <= 0 || !(await askFor(actor, { title: `${actor.name}: Lashing Shadow?`, react: "lashingShadow", ok: "Lash out",
    html: `<p>${esc(att.name)} hit you. Spend 1 RP to have your shadow lash out for <strong>${dmg}</strong> Arcane damage? Once per ${scope}.</p>` }))) return;
  if (!(await spendPoints(actor, "rp", 1, "Lashing Shadow"))) return;
  await use(actor, "lashing", scope);
  await card(actor, "Lashing Shadow", `<div class="fs-result">${esc(actor.name)}'s shadow lashes ${esc(att.name)}: ${dmg} Arcane damage.</div>`);
  await requestDamage(att, dmg, "arcane", 0, null, { archetype: "magic" });          // no attacker: the lash itself sets off no reactions (no Lashing Shadow back)
}

/* -------------------------------------------- */
/*  Exchange hooks                              */
/* -------------------------------------------- */

/** Advantage on an attack against one target: Small Target (the target's), Home Ground, Mob Rule. */
async function attackNet(attacker, target, opts) {
  let net = 0;
  const notes = [];
  const as = attacker.system.size ?? 3, ts = target.system.size ?? 3;
  if (tier(target, "ancestry-smallfolk") >= 5 && as >= ts + 2) { net -= 1; notes.push(`Small Target (${target.name}): Disadvantage`); }
  if (tier(attacker, "ancestry-orc-tree") >= 4 && !used(attacker, "homeGround", "turn")) {
    const tok = tokenOf(target), scene = tok?.document?.parent ?? globalThis.canvas?.scene, size = scene?.grid?.size ?? 100;
    const c = tok ? { x: (tok.document?.x ?? tok.x) + ((tok.document?.width ?? 1) * size) / 2, y: (tok.document?.y ?? tok.y) + ((tok.document?.height ?? 1) * size) / 2 } : null;
    if (c && levelAt(scene, c, tok.document?.elevation ?? 0) > 0) { net += 1; notes.push("Home Ground: Advantage (the target stands in rough or difficult terrain)"); await use(attacker, "homeGround", "turn"); }
  }
  // Zig-Zag (Wildibit T3): ranged attacks against it have Disadvantage until the start of its next turn.
  if (target.getFlag?.("flowstate", "zigzag") && !opts?.melee && !opts?.area) { net -= 1; notes.push(`Zig-Zag (${target.name}): Disadvantage`); }
  const mob = target.getFlag?.("flowstate", "mobRule");
  if (mob && mob.by !== attacker.uuid && !(mob.used ?? []).includes(attacker.uuid)) {
    const marker = globalThis.fromUuidSync?.(mob.by);
    if (marker && allied(marker, attacker)) {
      net += 1; notes.push("Mob Rule: Advantage");
      await setActorFlag(target, "mobRule", { ...mob, used: [...(mob.used ?? []), attacker.uuid] });
    }
  }
  const best = await bestiary.attackNet(attacker, target, opts);
  return { net: net + best.net, notes: [...notes, ...best.notes] };
}

/** Advantage on a dodge: Mindful of Fragility (the first attack each combat), Awakened Scales (the first Spell attack each round), Underdog. */
async function dodgeNet(target, attacker, o) {
  let net = 0;
  const notes = [];
  if (tier(target, "ancestry-elf-tree") >= 1 && inActiveCombat(target) && !used(target, "fragility", "combat")) { net += 1; notes.push("Mindful of Fragility"); await use(target, "fragility", "combat"); }
  if (tier(target, "ancestry-draken-legacy") >= 4 && o?.spell && inActiveCombat(target) && !used(target, "scales", "round")) { net += 1; notes.push("Awakened Scales"); await use(target, "scales", "round"); }
  // Skittish (Wildibit T2): the first attack against it each round. Red Tide (Minotaur T3): a raging creature's dodges have Disadvantage.
  if (tier(target, "ancestry-wildibit-tree") >= 2 && inActiveCombat(target) && !used(target, "skittish", "round")) { net += 1; notes.push("Skittish"); await use(target, "skittish", "round"); }
  if (target.getFlag?.("flowstate", "redTide")) { net -= 1; notes.push("Red Tide (raging): Disadvantage"); }
  if (tier(target, "ancestry-dirtborn") >= 2 && inActiveCombat(target) && attacker) {
    const rk = roundKey(), seen = target.getFlag?.("flowstate", "underdog");
    const list = seen?.round === rk ? [...new Set([...(seen.by ?? []), attacker.uuid])] : [attacker.uuid];
    await setActorFlag(target, "underdog", { round: rk, by: list, until: seen?.until ?? null });
    const on = (seen?.until && seen.until === rk) || list.length >= 3;
    if (list.length >= 3 && seen?.until !== rk) await setActorFlag(target, "underdog", { round: rk, by: list, until: rk });
    if (on) { net += 1; notes.push("Underdog"); }
  }
  return { net, notes };
}

/** The defender's extra buttons on an attack card: Underfoot (Smallfolk T4) and Neutral Party (Halfling T4). */
function defendButtons(target, attacker, opts, index) {
  const out = [];
  if (!attacker) return "";
  if (tier(target, "ancestry-smallfolk") >= 4 && opts.melee && (attacker.system.size ?? 3) > (target.system.size ?? 3)
    && !used(target, "underfoot", tier(target, "ancestry-smallfolk") >= 5 ? "turn" : "round") && (target.system.rp?.value ?? 0) >= 1)
    out.push(`<button type="button" class="fs-defend" data-choice="anc:underfoot" data-index="${index}" data-tooltip="Smallfolk T4: 1 RP, this attack is re-rolled with Disadvantage (the lower result stands)"><i class="fa-solid fa-shoe-prints"></i> Underfoot (1 RP)</button>`);
  if (tier(target, "ancestry-halfling-tree") >= 4 && !used(target, "neutralParty", "combat") && target.getFlag?.("flowstate", "dealtDamage") !== combatKey() && (target.system.rp?.value ?? 0) >= 1)
    out.push(`<button type="button" class="fs-defend" data-choice="anc:neutralParty" data-index="${index}" data-tooltip="Halfling T4: 1 RP, persuasion against their counter check; on a success they must pick another target if they can (the GM's call), else this attack is re-rolled with Disadvantage"><i class="fa-solid fa-handshake-simple"></i> Neutral Party (1 RP)</button>`);
  return out.join("");
}

/** A defender's button: re-roll the attack keeping the lower result (flag `lowered`, which effectiveEntry reads). */
async function react(choice, message, index, target, entry, { effectiveEntry, rerollNet }) {
  const attack = message.getFlag("flowstate", "attack");
  const attacker = await fromUuid(attack.attacker);
  const key = choice.slice(4);
  const cur = effectiveEntry(message.id, index, entry);
  const lower = async (label, extraHtml = "") => {
    const roll = await rollKit.evaluate(poolFormula(1, entry.die ?? 1, rerollNet(message.id, index, entry) - 1));
    const total = Math.min(cur.total, roll.total);
    return post(target, { title: `${esc(entry.name)} — ${label}`, rolls: [roll],
      body: `${extraHtml}${await rollKit.rollBlock(roll, `Attack (d${entry.die}), re-rolled with Disadvantage`)}<div class="fs-result">The attack is now <strong>${total}</strong>${roll.total > cur.total ? ` (the re-roll of ${roll.total} is higher, so ${cur.total} stands)` : ""}. Respond on the attack card.</div>`,
      flags: { flowstate: { lowered: { attackMessage: message.id, index, total, original: cur.total, by: key } } } });
  };
  if (key === "underfoot") {
    const scope = tier(target, "ancestry-smallfolk") >= 5 ? "turn" : "round";
    if (used(target, "underfoot", scope) || !(await spendPoints(target, "rp", 1, "Underfoot"))) return null;
    await use(target, "underfoot", scope);
    return lower("Underfoot");
  }
  if (key === "neutralParty") {
    if (used(target, "neutralParty", "combat") || !(await spendPoints(target, "rp", 1, "Neutral Party"))) return null;
    await use(target, "neutralParty", "combat");
    const die = Math.max(1, sp(target)), them = Math.max(1, sp(attacker));
    const mine = await rollKit.evaluate(poolFormula(1, die, rollKit.noAdvantage(target, rollKit.net(target))));
    const theirs = await rollKit.evaluate(poolFormula(1, them, rollKit.noAdvantage(attacker, rollKit.net(attacker))));
    const won = mine.total >= theirs.total;
    const head = `${await rollKit.rollBlock(mine, `${esc(target.name)}'s persuasion (d${die})`)}${await rollKit.rollBlock(theirs, `${esc(attacker?.name ?? "")}'s counter check (d${them})`)}`;
    if (!won) return post(target, { title: `${esc(entry.name)} — Neutral Party`, rolls: [mine, theirs], body: `${head}<div class="fs-result">${esc(attacker?.name ?? "")} isn't persuaded.</div>`,
      flags: { flowstate: { ancTried: { attackMessage: message.id, index, by: key } } } });
    return lower("Neutral Party", `${head}<div class="fs-notes">Persuaded: ${esc(attacker?.name ?? "")} must choose a different target if it can (the GM's call); otherwise the attack is made with Disadvantage.</div>`);
  }
  return null;
}

/**
 * After the dodge roll: Unlucky (the attack would hit you, or an ally within 30 ft at T5: re-rolled, the lower stands; still a hit at T5 → Weakened),
 * Indomitable for the defender (a failed dodge is re-rolled) and for the attacker (a miss is re-rolled). Returns { result, rolls, notes, weak }.
 */
async function afterDodge({ attacker, target, entry, dodge, die, net, result }) {
  const rolls = [], notes = [];
  let atkTotal = entry.total, weak = 0;
  if (result.hit && !result.noCrit) {
    for (const g of unluckyGoblins(target)) {
      const scope = tier(g, "ancestry-goblin-tree") >= 5 ? "combat" : "rest";
      const ans = await askFor(g, { title: `${g.name}: Unlucky?`, react: "unlucky", ok: "Unlucky",
        html: `<p>${esc(attacker?.name ?? "")}'s attack (${atkTotal}) would hit ${g === target ? "you" : esc(target.name)}. Force a re-roll (the lower result stands)? Once per ${scope}.</p>` });
      if (!ans) continue;
      await use(g, "unlucky", scope);
      const r = await rollKit.evaluate(poolFormula(1, entry.die ?? 1, (entry.net ?? 0)));
      rolls.push(r);
      atkTotal = Math.min(atkTotal, r.total);
      notes.push(`Unlucky (${g.name}): attack re-rolled → ${r.total}, ${atkTotal} stands`);
      result = resolveAttack(atkTotal, dodge.total);
      if (result.hit && tier(g, "ancestry-goblin-tree") >= 5) { weak = 1; notes.push("Jinx: it still hits, so its damage is Weakened"); }
      break;
    }
  }
  if (result.hit && !result.noCrit && tier(target, "ancestry-human-tree") >= 5 && !used(target, "indomitable", "round")) {
    const ans = await askFor(target, { title: `${target.name}: Indomitable?`, react: "indomitable", ok: "Re-roll the dodge",
      html: `<p>Your dodge (${dodge.total}) failed against ${atkTotal}. Re-roll it? You must take the new result. Once per round.</p>` });
    if (ans) {
      await use(target, "indomitable", "round");
      const r = await rollKit.evaluate(poolFormula(2, die, rollKit.noAdvantage(target, net)));
      rolls.push(r); dodge = r;
      result = resolveAttack(atkTotal, r.total);
      notes.push(`Indomitable: dodge re-rolled → ${r.total}`);
    }
  }
  if (!result.hit && attacker && tier(attacker, "ancestry-human-tree") >= 5 && !used(attacker, "indomitable", "round")) {
    const ans = await askFor(attacker, { title: `${attacker.name}: Indomitable?`, react: "indomitable", ok: "Re-roll the attack",
      html: `<p>Your attack (${atkTotal}) missed ${esc(target.name)} (dodge ${dodge.total}). Re-roll it? You must take the new result. Once per round.</p>` });
    if (ans) {
      await use(attacker, "indomitable", "round");
      const r = await rollKit.evaluate(poolFormula(1, entry.die ?? 1, entry.net ?? 0));
      rolls.push(r); atkTotal = r.total;
      result = resolveAttack(atkTotal, dodge.total);
      notes.push(`Indomitable (${attacker.name}): attack re-rolled → ${r.total}`);
    }
  }
  return { result, rolls, notes, weak, attackTotal: atkTotal };
}
/** The Goblins who can use Unlucky for this target: the target itself (Tier 1), or an ally within 30 ft (Jinx, Tier 5). */
function unluckyGoblins(target) {
  const out = [];
  const can = g => tier(g, "ancestry-goblin-tree") >= 1 && !used(g, "unlucky", tier(g, "ancestry-goblin-tree") >= 5 ? "combat" : "rest");
  if (can(target)) out.push(target);
  for (const t of globalThis.canvas?.scene?.tokens ?? []) {
    const g = t.actor;
    if (!g || g.uuid === target.uuid || notCreature(g) || tier(g, "ancestry-goblin-tree") < 5 || !can(g) || !allied(g, target)) continue;
    if ((dist(g, target) ?? Infinity) <= 30) out.push(g);
  }
  return out;
}

/** Before an attack's damage is rolled: Searing Zeal (Firelander T3) and Elemental Mastery (Draken Elements T3). Returns new opts (or the same). */
async function beforeDamage(attacker, target, o) {
  let out = o;
  if (tier(attacker, "ancestry-firelander") >= 3) {
    const scope = tier(attacker, "ancestry-firelander") >= 5 ? "round" : "combat";
    if (!used(attacker, "searingZeal", scope) && (await askFor(attacker, { title: `${attacker.name}: Searing Zeal?`, react: "searingZeal", ok: "Searing Zeal",
      html: `<p>You hit ${esc(target.name)}. Make the damage Heat with a Strengthened stack? Once per ${scope}.</p>` }))) {
      await use(attacker, "searingZeal", scope);
      out = { ...out, type: "heat", ancStacks: [...(out.ancStacks ?? []), "Searing Zeal"], notes: [...(out.notes ?? []), "Searing Zeal: Heat, +1 Strengthened"] };
    }
  }
  // Rotting Touch (Wasteling T3): a melee hit's damage becomes Acid with a Strengthened stack, for 1 RP (once per combat; Spreading Rot, T5: per round).
  if (tier(attacker, "ancestry-wasteling") >= 3 && out.melee && (attacker.system.rp?.value ?? 0) >= 1) {
    const scope = tier(attacker, "ancestry-wasteling") >= 5 ? "round" : "combat";
    if (!used(attacker, "rottingTouch", scope) && (await askFor(attacker, { title: `${attacker.name}: Rotting Touch?`, react: "rottingTouch", ok: "Rotting Touch",
      html: `<p>You hit ${esc(target.name)} in melee. Spend 1 RP to make the damage Acid with a Strengthened stack? Once per ${scope}.</p>` })) && (await spendPoints(attacker, "rp", 1, "Rotting Touch"))) {
      await use(attacker, "rottingTouch", scope);
      out = { ...out, type: "acid", ancStacks: [...(out.ancStacks ?? []), "Rotting Touch"], notes: [...(out.notes ?? []), "Rotting Touch: Acid, +1 Strengthened"] };
    }
  }
  if (tier(attacker, "ancestry-draken-elements") >= 3 && elements(attacker).includes(out.type)) {
    const scope = tier(attacker, "ancestry-draken-elements") >= 5 ? "round" : "combat";
    if (!used(attacker, "mastery", scope) && (await askFor(attacker, { title: `${attacker.name}: Elemental Mastery?`, react: "elementalMastery", ok: "Strengthen it",
      html: `<p>Give this ${esc(GLAND_ELEMENTS[out.type] ?? out.type)} damage to ${esc(target.name)} a Strengthened stack? Once per ${scope}.</p>` }))) {
      await use(attacker, "mastery", scope);
      out = { ...out, ancStacks: [...(out.ancStacks ?? []), "Elemental Mastery"], notes: [...(out.notes ?? []), "Elemental Mastery: +1 Strengthened"] };
    }
  }
  return out;
}

/** Strengthened/Weakened stacks for one hit: Searing Zeal and Elemental Mastery (chosen as damage is rolled), Grudgebearer (+1 against your Grudge). */
function damageStacks({ attacker, target, o }) {
  const parts = (o?.ancStacks ?? []).map(n => `+1 ${n}`);
  const g = attacker?.getFlag?.("flowstate", "grudge");
  if (g && g.uuid === target?.uuid && g.combat === combatKey()) parts.push("+1 Grudgebearer");
  if (attacker?.getFlag?.("flowstate", "redTide") && o?.melee) parts.push("+1 Red Tide");
  return { stacks: parts.length, parts };
}

/**
 * Damage arriving at a creature (applyDamage, before soak): Weakened stacks from Elemental Ward, Flamekin, Curse-Hardened, Ward of the Hold and Spirit
 * Shell. Returns { amount, notes }.
 */
async function incoming(actor, amount, type, { archetype, attacker = null, natural = false } = {}) {
  let stacks = 0;
  const notes = [];
  // Glass Body (Myrthel T0): physical damage is Strengthened. Fused Shadow (Dawn Elf T0): Arcane damage is, until Uneasy Truce (T4). Acid-Worn
  // (Wasteling T1): Acid damage is Weakened.
  if (type === "physical" && hasAncestryTree(actor.system, "ancestry-myrthel-tree")) { stacks -= 1; notes.push("Glass Body (Strengthened)"); }
  if (type === "arcane" && hasAncestryTree(actor.system, "ancestry-dawn-elf-tree") && tier(actor, "ancestry-dawn-elf-tree") < 4) { stacks -= 1; notes.push("Fused Shadow (Strengthened)"); }
  if (type === "acid" && tier(actor, "ancestry-wasteling") >= 1) { stacks += 1; notes.push("Acid-Worn"); }
  if (tier(actor, "ancestry-draken-elements") >= 1 && elements(actor).includes(type)) { stacks += 1; notes.push("Elemental Ward"); }
  if (tier(actor, "ancestry-firelander") >= 5 && type === "heat") { stacks += 1; notes.push("Flamekin"); }
  const att = attacker ? globalThis.fromUuidSync?.(attacker) : null;
  if (tier(actor, "ancestry-dusken-spirit") >= 2 && (type === "supernatural" || (natural && att?.system?.supernatural))) { stacks += 1; notes.push("Curse-Hardened"); }
  if (archetype === "magic") {
    const warded = [...(globalThis.canvas?.scene?.tokens ?? [])].map(t => t.actor).find(w => w?.getFlag?.("flowstate", "wardHold") && (w.uuid === actor.uuid || (allied(w, actor) && (dist(w, actor) ?? Infinity) <= 10)));
    if (warded) { stacks += 1; notes.push(`Ward of the Hold (${warded.name})`); }
    if (tier(actor, "ancestry-dusken-spirit") >= 3) {
      const scope = tier(actor, "ancestry-dusken-spirit") >= 5 ? "round" : "combat";
      if (!used(actor, "spiritShell", scope) && (actor.system.rp?.value ?? 0) >= 2 && (await askFor(actor, { title: `${actor.name}: Spirit Shell?`, react: "spiritShell", ok: "Spirit Shell",
        html: `<p>A Spell's ${amount} damage is about to hit you. Spend 2 RP to give it a Weakened stack? Once per ${scope}.</p>` }))) {
        if (await spendPoints(actor, "rp", 2, "Spirit Shell")) { await use(actor, "spiritShell", scope); stacks += 1; notes.push("Spirit Shell"); }
      }
    }
  }
  let out = stacks ? Math.floor(applyStacks(amount, -stacks)) : amount;
  // Stone Skin (Sworan T3): physical damage from each attack is reduced by the Constitution Min.
  const cmin = actor.system.derived?.effective?.con?.min ?? 0;
  if (type === "physical" && tier(actor, "ancestry-sworan-tree") >= 3 && cmin > 0 && out > 0) { out = Math.max(0, out - cmin); notes.push(`Stone Skin (−${cmin})`); }
  return { amount: out, notes };
}

/** After damage landed (it reached HP or not): Grudgebearer marks the attacker; Elemental Absorption turns element damage into Energy. */
async function afterDamage(actor, amount, type, { attacker = null } = {}) {
  const att = attacker ? globalThis.fromUuidSync?.(attacker) : null;
  // Neutral Party (Halfling T4) needs to know who has dealt damage this combat.
  if (att && amount > 0 && combatKey() && att.getFlag?.("flowstate", "dealtDamage") !== combatKey()) await setActorFlag(att, "dealtDamage", combatKey());
  if (!(amount > 0) || !inActiveCombat(actor)) return;
  if (att && att.uuid !== actor.uuid) { await redTide(actor); await lashingShadow(actor, att); }
  if (att && att.uuid !== actor.uuid && tier(actor, "ancestry-dwarf-tree") >= 5 && actor.getFlag?.("flowstate", "grudge")?.combat !== combatKey() && !used(actor, "grudge", "combat")) {
    if (await askFor(actor, { title: `${actor.name}: Grudgebearer?`, react: "grudge", ok: "Mark them", html: `<p>${esc(att.name)} hurt you. Mark them as your Grudge for this combat (your attacks against them are Strengthened)? Once per combat.</p>` })) {
      await use(actor, "grudge", "combat");
      await setActorFlag(actor, "grudge", { uuid: att.uuid, name: att.name, combat: combatKey() });
      await card(actor, "Grudgebearer", `<div class="fs-result">${esc(att.name)} is ${esc(actor.name)}'s Grudge: ${esc(actor.name)}'s attacks against ${esc(att.name)} are Strengthened for the rest of the combat.</div>`);
    }
  }
  if (tier(actor, "ancestry-draken-elements") >= 4 && elements(actor).includes(type) && !used(actor, "absorb", "combat") && (actor.system.rp?.value ?? 0) >= 2 && !actor.statuses?.has?.("fear")) {
    const gain = 2 * (actor.system.derived?.energyRecover ?? 0);
    if (await askFor(actor, { title: `${actor.name}: Elemental Absorption?`, react: "elementalAbsorption", ok: "Absorb", html: `<p>Spend 2 RP to regain ${gain} Energy from the ${esc(GLAND_ELEMENTS[type])} damage? Once per combat.</p>` })) {
      if (await spendPoints(actor, "rp", 2, "Elemental Absorption")) {
        await use(actor, "absorb", "combat");
        const e = actor.system.energy, got = await energyRestoreAdjust(actor, gain);
        await actor.update({ "system.energy.value": Math.min(e.max, e.value + got) });
        await card(actor, "Elemental Absorption", `<div class="fs-result">+${got} Energy.</div>`);
      }
    }
  }
}

/** Lingering Spirit (Dusken Spirit T4): once per rest, damage that would drop you to 0 HP or below leaves you at 1. Returns the HP to set. */
function lethal(actor, next) {
  if (next > 0 || (actor.system.hp?.value ?? 0) <= 0 || tier(actor, "ancestry-dusken-spirit") < 4 || used(actor, "lingering", "rest")) return next;
  setTimeout(() => { use(actor, "lingering", "rest"); card(actor, "Lingering Spirit", `<div class="fs-result">${esc(actor.name)}'s spirit holds on: they drop to 1 HP instead.</div>`); }, 0);
  return 1;
}

/** Immovable (Dwarf T4): once per round, 1 RP to ignore Force that would move you or knock you Prone. True when ignored. */
async function immovable(actor, what) {
  if (tier(actor, "ancestry-dwarf-tree") < 4 || used(actor, "immovable", "round") || (actor.system.rp?.value ?? 0) < 1) return false;
  const ans = await askFor(actor, { title: `${actor.name}: Immovable?`, react: "immovable", ok: "Ignore it", html: `<p>${esc(what)}. Spend 1 RP to ignore it? Once per round.</p>` });
  if (!ans || !(await spendPoints(actor, "rp", 1, "Immovable"))) return false;
  await use(actor, "immovable", "round");
  await card(actor, "Immovable", `<div class="fs-result">${esc(actor.name)} doesn't budge.</div>`);
  return true;
}

/** The start of a creature's turn: Ward of the Hold, Mob Rule marks it made, Underdog and Elemental Wings run out; an unconscious Dusken recombines. */
export async function turnStart(combat, actor) {
  if (!actor) return;
  if (actor.getFlag?.("flowstate", "wardHold")) await setActorFlag(actor, "wardHold", null);
  for (const k of ["zigzag", "lakeSurge"]) if (actor.getFlag?.("flowstate", k)) await setActorFlag(actor, k, null);
  for (const t of combat?.combatants ?? []) {
    const a = t.actor, mob = a?.getFlag?.("flowstate", "mobRule");
    if (mob?.by === actor.uuid && (combat.round ?? 0) > (mob.round ?? 0)) await setActorFlag(a, "mobRule", null);
  }
  const ud = actor.getFlag?.("flowstate", "underdog");
  if (ud?.until) await setActorFlag(actor, "underdog", { round: ud.round, by: ud.by, until: null });
  const w = actor.getFlag?.("flowstate", "wings");
  if (w && w.combat === combat?.id && (combat?.round ?? 0) >= w.round) await endWings(actor);
  if (actor.statuses?.has?.("unconscious") && spiritToken(actor)) await recombine(actor);
  await bestiary.turnStart(combat, actor);                    // Regrowth, the Choking Green, the Wonderborn's turn count, the ground auras
}
/** The end of a creature's turn: Red Tide and Overclock end (at the end of the turn after the one they began in); Heavy Wings (Noctua T0) pulls it down. */
export async function turnEnd(combat, actor) {
  if (!actor) return;
  const tk = turnKey();
  const rage = actor.getFlag?.("flowstate", "redTide");
  if (rage && rage.armed !== tk) { await setActorFlag(actor, "redTide", null); await card(actor, "Red Tide", `<div class="fs-notes">The rage passes.</div>`); }
  const oc = actor.getFlag?.("flowstate", "overclock");
  if (oc && oc.armed !== tk) {
    const al = alignmentState(actor.getFlag?.("flowstate", "alignment"));
    await setActorFlag(actor, "alignment", al.level > oc.prev ? { kind: al.kind, level: oc.prev } : actor.getFlag?.("flowstate", "alignment") ?? null);
    await setActorFlag(actor, "overclock", null);
    await card(actor, "Overclock", `<div class="fs-notes">${esc(actor.name)}'s Alignment settles back to ${oc.prev}.</div>`);
  }
  const tok = tokenOf(actor);
  if (hasAncestryTree(actor.system, "ancestry-noctua-tree") && tier(actor, "ancestry-noctua-tree") < 4 && (tok?.document?.elevation ?? 0) > 0 && !actor.statuses?.has?.("falling")
    && !actor.statuses?.has?.("unconscious")) {
    const fall = await askFor(actor, { title: `${actor.name}: Heavy Wings`, react: "heavyWings", ok: "In the air: begin falling",
      html: `<p>${esc(actor.name)} ends their turn ${tok.document.elevation} ft up. Heavy Wings: unless they're on the ground or a perch, they begin falling. (Close this if they're perched.)</p>` });
    if (fall) await startFalling(actor, "Heavy Wings");
  }
}
/** A rest: Thick Hide (Minotaur T0) fully repairs. */
async function rest(actor) {
  for (const i of actor.items ?? []) if (i.getFlag?.("flowstate", "thickHide") && (i.system.wear ?? 0) > 0) await i.update({ "system.wear": 0 }, { flowstateSystem: true });
}
async function endWings(actor) {
  const w = actor.getFlag?.("flowstate", "wings");
  if (!w) return;
  await actor.update({ "system.lift": w.prev ?? 0, "flags.flowstate.wings": null });
  await setStatus(actor, "flying", false);
  await card(actor, "Elemental Wings", `<div class="fs-notes">The wings fade.</div>`);
}

/* -------------------------------------------- */
/*  GM side: the spirit token                   */
/* -------------------------------------------- */

GM_ACTIONS.spiritCreate = async function ({ actor: uuid, sceneId, x, y }, senderId = null) {
  const actor = await fromUuid(uuid), scene = game.scenes.get(sceneId), user = game.users.get(senderId) ?? game.user;
  if (!actor || !scene || !actor.testUserPermission?.(user, "OWNER") || tier(actor, "ancestry-dusken-shadow") < 3) return;
  if (spiritToken(actor)) return;
  let shell = game.actors.find(a => a.type === "pile" && a.getFlag("flowstate", "spiritOf") === actor.uuid);
  if (!shell) shell = await Actor.create({ name: `${actor.name}'s spirit`, type: "pile", img: actor.img, ownership: { ...actor.ownership },
    flags: { flowstate: { spiritOf: actor.uuid } }, prototypeToken: { actorLink: true, alpha: 0.5, sight: { enabled: true } } });
  const td = await shell.getTokenDocument({ x, y, alpha: 0.5, name: `${actor.name}'s spirit`, flags: { flowstate: { spiritOf: actor.uuid } } });
  await scene.createEmbeddedDocuments("Token", [td.toObject()]);
};
/** Overgrowth: the oldest of a caster's three squares goes when a fourth grows. */
GM_ACTIONS.overgrowthTrim = async function ({ sceneId, id }) {
  const r = game.scenes.get(sceneId)?.regions?.get(id);
  if (r?.flags?.flowstate?.overgrowthOf) await r.delete();
};
GM_ACTIONS.spiritRemove = async function ({ actor: uuid }, senderId = null) {
  const actor = await fromUuid(uuid), user = game.users.get(senderId) ?? game.user;
  if (!actor || !actor.testUserPermission?.(user, "OWNER")) return;
  for (const scene of game.scenes ?? []) {
    const mine = [...scene.tokens].filter(t => t.flags?.flowstate?.spiritOf === uuid);
    if (mine.length) await scene.deleteEmbeddedDocuments("Token", mine.map(t => t.id));
  }
};

/** What actions.mjs and the others call. */
export const hooks = { attackNet, dodgeNet, dodgeDieUp, weaponAttack, defendButtons, react, afterDodge, beforeDamage, damageStacks, incoming, afterDamage, lethal, immovable,
  turnStart, rest, onHit: bestiary.onHit, forceHalf: bestiary.forceHalf };
