import * as rules from "./rules.mjs";
import { FlowStateActorData, FlowStateGearData, FlowStateWeaponData, FlowStateArmorData, FlowStateFociData, FlowStateShroudData, FlowStateIconData, FlowStatePileData } from "./data.mjs";
import * as martial from "./martial.mjs";
import * as actions from "./actions.mjs";
import * as areas from "./areas.mjs";
import "./elemental.mjs";
import "./afflictions.mjs";
import "./arcana.mjs";
import * as fociEngine from "./foci.mjs";
import * as conjure from "./conjure.mjs";
import * as ab from "./abilities.mjs";
import { CharacterWizard, createCharacterForUser } from "./wizard.mjs";
import "./integrations.mjs";
import * as pictures from "./pictures.mjs";
import "./mental.mjs";
import { FlowStateActorSheet, FlowStateItemSheet, FlowStateWeaponSheet, FlowStateArmorSheet, FlowStateFociSheet, FlowStateShroudSheet, FlowStateIconSheet, FlowStatePileSheet } from "./sheets.mjs";
/* -------------------------------------------- */
/*  Documents                                   */
/* -------------------------------------------- */

/** Grid squares a token of this creature Size takes (Size 3 = 1). */
export const tokenSquares = size => ({ 1: 0.25, 2: 0.5, 3: 1, 4: 2, 5: 4 }[Math.round(size || 3)] ?? 1);

class FlowStateActor extends Actor {
  /** New actors start at full HP and Energy. */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;
    // Default: token artwork doesn't rotate (unless the creator set it).
    if (!foundry.utils.hasProperty(data, "prototypeToken.lockRotation")) this.updateSource({ "prototypeToken.lockRotation": true });
    if (this.type === "pile") return;
    // Token size follows creature Size (Size 3 = 1 square, each step doubles or halves).
    if (!foundry.utils.hasProperty(data, "prototypeToken.width")) {
      const sq = tokenSquares(this.system.size);
      this.updateSource({ "prototypeToken.width": sq, "prototypeToken.height": sq });
    }
    // Default: HP and Energy token bars, always shown to owners (unless the creator already set bars).
    if (!foundry.utils.hasProperty(data, "prototypeToken.bar1.attribute") && !foundry.utils.hasProperty(data, "prototypeToken.displayBars")) {
      this.updateSource({ prototypeToken: {
        bar1: { attribute: "hp" }, bar2: { attribute: "energy" },
        displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER
      } });
    }
    if (!foundry.utils.hasProperty(data, "system.hp.value")) {
      this.updateSource({ "system.hp.value": this.system.hp.max, "system.energy.value": this.system.energy.max });
    }
  }

  /**
   * Every actor starts with Unarmed. Added after creation (by the creating client) rather than by rewriting
   * the item list in _preCreate, which re-added any starting items a second time.
   */
  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    if (game.user.id !== userId || this.type === "pile") return;
    if (this.items.some(i => i.type === "weapon" && i.system.weaponType === "unarmed")) return;
    this.createEmbeddedDocuments("Item", [foundry.utils.deepClone(UNARMED_ITEM)], { flowstateSystem: true });
  }

  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    if (game.user.id !== userId || this.type === "pile") return;
    this.#syncAfterUpdate(changed);
  }

  async #syncAfterUpdate(changed) {
    const sys = this.system;

    // Martial Theory T4 (Improvise): improvised weapons are removed once it's reached.
    if ((Number(foundry.utils.getProperty(changed, "system.trees.martial-theory")) || 0) >= 4) await actions.removeImprovised(this);

    // Outside combat, Energy stays full (including when Skill Points raise the max).
    if (sys.energy.value < sys.energy.max && !actions.inActiveCombat(this)) {
      await this.update({ "system.energy.value": sys.energy.max });
      return;
    }

    // Ch9: Haste and Slow cancel each other out equal to their values.
    const { slow, haste } = sys.conditions;
    if (slow > 0 && haste > 0) {
      const m = Math.min(slow, haste);
      await this.update({ "system.conditions.slow": slow - m, "system.conditions.haste": haste - m });
      return;
    }

    // Ch8: 0 HP or below = dead; below Pain Threshold = unconscious.
    if (foundry.utils.hasProperty(changed, "system")) {
      const dead = sys.hp.value <= 0;
      const unconscious = !dead && sys.hp.value < sys.hp.pain;
      if (dead && !this.statuses.has("dead")) await this.setFlag("flowstate", "diedAt", Date.now());          // Resuscitate only reaches the recently dead
      if (dead !== this.statuses.has("dead")) await this.toggleStatusEffect("dead", { active: dead, overlay: true });
      if (unconscious !== this.statuses.has("unconscious")) await this.toggleStatusEffect("unconscious", { active: unconscious });
      // Falling unconscious (or dying) knocks you prone. Waking up leaves you prone until you stand.
      if ((dead || unconscious) && !this.statuses.has("prone")) await this.toggleStatusEffect("prone", { active: true });
    }
  }
}

class FlowStateCombat extends Combat {
  /** Round 1: every combatant gets their full AP and RP. */
  async startCombat() {
    for (const c of this.combatants) {
      if (c.actor?.isOwner) await c.actor.update({ "system.ap.value": c.actor.system.ap?.max ?? 6, "system.rp.value": c.actor.system.rp?.max ?? 6 });
    }
    return super.startCombat();
  }

  /** Ch8: AP and RP refill at the start of your turn. Runs on the active GM only. */
  async _onStartTurn(combatant, context) {
    await super._onStartTurn(combatant, context);
    if (combatant.actor) {
      // AP/RP refresh, and Energy regained equal to 2 AP of Recover Energy.
      const a = combatant.actor, e = a.system.energy;
      let regain = 2 * (a.system.derived?.energyRecover ?? 0);
      if (regain) regain = await actions.energyRestoreAdjust(a, regain);                 // Freeze (Cold T4)
      await a.update({ "system.ap.value": a.system.ap?.max ?? 6, "system.rp.value": a.system.rp?.max ?? 6, ...(e && regain ? { "system.energy.value": Math.min(e.max, e.value + regain) } : {}) });
      // Psych Up / Calm Down last until the start of your next turn.
      await actions.clearStances(combatant.actor);
      // Medium Armor (Limber, Versatility, Careful Steps) and Rapid Marks.
      await actions.mediumTurnStart(combatant.actor);
      await actions.clearMarks(combatant.actor);
      await actions.treesTurnStart(combatant.actor);
      // Spell effects this creature put on others end now (Shield, Slam's dodge penalty); Rituals' last until the Ritual ends.
      await actions.mentalBeforeClear(combatant.actor);
      await actions.clearSpellEffects(combatant.actor);
      await areas.clearAreas(combatant.actor);
      // Bleed (Slashing T2) hits at the start of the victim's turn.
      await actions.bleedTurnStart(combatant.actor);
      // Poison, Charm and Hex (Tier 3): the victim's checks, and the caster's Ingrained Charms.
      await actions.afflictTurnStart(combatant.actor);
      await actions.arcanaTurnStart(combatant.actor);
      await actions.arcanaAntimagicTurn(combatant.actor);
      await fociEngine.deckTurnStart(combatant.actor);
      await conjure.autonomyTurn(combatant.actor);
      await actions.mentalTurnStart(combatant.actor);
      await combatant.actor.setFlag?.("flowstate", "turnStartedAt", Date.now());
      // Tier 4: Reform, then the caster's temporary Summons, Animations and Made objects end.
      await conjure.turnStart(combatant.actor);
      await actions.afflictCasterTurn(combatant.actor);
    }
  }

  /** Ch8/Ch9: unused AP expires; Ignite/Stain tick; Slow/Haste decay. Runs on the active GM only. */
  async _onEndTurn(combatant, context) {
    await super._onEndTurn(combatant, context);
    if (!combatant.actor) return;
    // Delta (Swift T5): 12+ Swift attacks landed this turn → regain 6 RP.
    const round = context?.round ?? this.previous?.round ?? this.round;
    const turn = context?.turn ?? this.previous?.turn ?? this.turn;
    await actions.delta(combatant.actor, `${this.id}:${round}:${turn}`);
    // Taunt (Constitution T2): a Taunted creature repeats the check at the end of its turn.
    if (combatant.actor.getFlag?.("flowstate", "tauntedBy")) await actions.shakeTaunt(combatant.actor);
    await actions.endOfTurn(combatant.actor);
  }
}

/* -------------------------------------------- */
/*  Init                                        */
/* -------------------------------------------- */

Hooks.once("init", () => {
  game.flowstate = { rules, martial, actions };

  CONFIG.Actor.documentClass = FlowStateActor;
  CONFIG.Combat.documentClass = FlowStateCombat;
  CONFIG.Actor.dataModels = { character: FlowStateActorData, npc: FlowStateActorData, pile: FlowStatePileData };
  CONFIG.Item.dataModels = { gear: FlowStateGearData, weapon: FlowStateWeaponData, armor: FlowStateArmorData, foci: FlowStateFociData, shroud: FlowStateShroudData, icon: FlowStateIconData };
  CONFIG.Actor.trackableAttributes = {
    character: { bar: ["hp", "energy", "ap", "rp"], value: [] },
    npc: { bar: ["hp", "energy", "ap", "rp"], value: [] }
  };
  CONFIG.Combat.initiative = { formula: "1d100", decimals: 0 };

  CONFIG.statusEffects = [
    { id: "dead", name: "Dead", img: "icons/svg/skull.svg" },
    { id: "unconscious", name: "Unconscious", img: "icons/svg/unconscious.svg" },
    { id: "prone", name: "Prone", img: "icons/svg/falling.svg" },
    { id: "crouch", name: "Crouching", img: "icons/svg/down.svg" },
    { id: "stealth", name: "Stealthing", img: "icons/svg/invisible.svg" },
    { id: "fear", name: "Fear", img: "icons/svg/terror.svg" },
    { id: "grappled", name: "Grappled", img: "icons/svg/net.svg" },
    { id: "flying", name: "Flying", img: "icons/svg/wing.svg" },
    { id: "psychedUp", name: "Psyched Up", img: "icons/svg/upgrade.svg" },
    { id: "calmedDown", name: "Calmed Down", img: "icons/svg/regen.svg" },
    { id: "limber", name: "Limber", img: "icons/svg/wingfoot.svg" },
    { id: "carefulSteps", name: "Careful Steps", img: "icons/svg/mystery-man.svg" },
    { id: "berserk", name: "Berserk", img: "icons/svg/blood.svg" },
    { id: "seeingRed", name: "Seeing Red", img: "icons/svg/fire.svg" },
    { id: "unstoppable", name: "Unstoppable", img: "icons/svg/sword.svg" },
    { id: "properStance", name: "Proper Stance", img: "icons/svg/target.svg" },
    { id: "fishy", name: "Like Shooting Fish", img: "icons/svg/net.svg" },
    { id: "sliced", name: "Sliced (+1 AP movement)", img: "icons/svg/blood.svg" },
    { id: "taunted", name: "Taunted", img: "icons/svg/hazard.svg" },
    { id: "quickened", name: "Quickened", img: "icons/svg/wingfoot.svg" }
  ];

  // Character creation budgets (used by the New Character wizard and re-checked by the GM).
  const worldNumber = (key, name, hint, def) => game.settings.register("flowstate", key, { name, hint, scope: "world", config: true, type: Number, default: def });
  worldNumber("startingStatPoints", "Starting stat points", "Stat points a new character spends in the New Character wizard. Skill Points are a third of this.", 90);
  worldNumber("startingItems", "Starting equipment picks", "How many items a new character picks: weapons, armor (at most one), Foci, Shrouds, and Affixes (each Affix is one pick). Unarmed is free; ranged weapons come with 20 ammunition each.", 4);
  worldNumber("startingGrade", "Starting equipment Grade", "Grade of starting weapons and armor.", 10);
  game.settings.register("flowstate", "startingMaxRarity", {
    name: "Starting equipment rarity limit", hint: "Highest material rarity allowed for starting equipment.",
    scope: "world", config: true, type: String, default: "uncommon",
    choices: { common: "Common", uncommon: "Uncommon", rare: "Rare", veryRare: "Very Rare" }
  });
  game.settings.register("flowstate", "migratedCreationLock", { scope: "world", config: false, type: Boolean, default: false });

  game.flowstate.CharacterWizard = CharacterWizard;
  actions.GM_ACTIONS.createCharacter = createCharacterForUser;

  // Chat cards waiting on a choice are tinted: the attacker's choices in one color, the defender's in another.
  const colorType = foundry.data?.fields?.ColorField ? new foundry.data.fields.ColorField({ nullable: false, initial: "#c0392b" }) : String;
  game.settings.register("flowstate", "attackerChoiceColor", {
    name: "Attacker choice color",
    hint: "Chat cards waiting on the attacker (roll damage, follow-ups, Knockback) are tinted this color.",
    scope: "client", config: true, type: colorType, default: "#c0392b", onChange: applyChoiceColors
  });
  game.settings.register("flowstate", "defenderChoiceColor", {
    name: "Defender choice color",
    hint: "Chat cards waiting on the defender (Dodge, Parry, Riposte, Redirect, Deflect) are tinted this color.",
    scope: "client", config: true,
    type: foundry.data?.fields?.ColorField ? new foundry.data.fields.ColorField({ nullable: false, initial: "#2e6fd1" }) : String,
    default: "#2e6fd1", onChange: applyChoiceColors
  });
  game.settings.register("flowstate", "customAdvantage", {
    name: "Custom Advantage/Disadvantage",
    hint: "Show a field in roll and attack dialogs for adding extra Advantage (+) or Disadvantage (−) stacks by hand. Automatic sources (Psych Up, prone, armor, range, and so on) apply either way. When off, plain rolls like Dodge and d100 checks skip their dialog.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => {}
  });
    game.settings.register("flowstate", "customStacks", {
    name: "Custom Strengthened/Weakened",
    hint: "Show a field in attack and damage dialogs for adding extra Strengthened (+) or Weakened (−) stacks by hand. Automatic sources (materials, size, crits, Parry, armor, Area) apply either way.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
    game.settings.register("flowstate", "autoDamage", {
    name: "Roll damage automatically",
    hint: "When an attack hits, roll and apply its damage right away instead of showing a Roll damage button. Turn off to add extra Strengthened/Weakened stacks by hand before rolling.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
    game.settings.register("flowstate", "playerBrowse", {
    name: "Players browse for pictures",
    hint: "Players without the file-browser permission can browse the server's images through a connected GM when changing the picture of a sheet they own. Off: they can only paste an image link or path.",
    scope: "world", config: true, type: Boolean, default: true
  });
    game.settings.register("flowstate", "playerUpload", {
    name: "Players upload pictures",
    hint: "Players without the upload permission can upload a picture from their computer for a sheet they own: it is sent to a connected GM and saved under flowstate-art/<player>/ (images only, up to 10 MB). Off: they can only browse, or paste an image link or path.",
    scope: "world", config: true, type: Boolean, default: true
  });
    game.settings.register("flowstate", "requireAmmo", {
    name: "Require ammunition",
    hint: "Reloading a ranged weapon uses Ammunition items of its type (a Misc item with an ammunition type; up to 100 per type). Off: reloads are free.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register("flowstate", "startingMultiType", {
    name: "Multi-type starting weapons",
    hint: "Let the New Character wizard make starting weapons with more than one weapon type (usable as such with Weapon Master, Martial Theory Tier 5).",
    scope: "world", config: true, type: Boolean, default: false
  });
    game.settings.register("flowstate", "enforceRange", {
    name: "Enforce attack range",
    hint: "Block attacks when a targeted token is beyond melee reach, throw range, or the chosen range band.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register("flowstate", "showOptionalFields", {
    name: "Show optional sheet fields",
    hint: "Adds Space, Rations/day, Terminal Velocity, Lift, and Fully Magical to character sheets.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => {
      for (const app of foundry.applications.instances.values()) {
        if (app instanceof FlowStateActorSheet) app.render();
      }
    }
  });

  const { DocumentSheetConfig } = foundry.applications.apps;
  DocumentSheetConfig.registerSheet(Actor, "flowstate", FlowStateActorSheet, { types: ["character", "npc"], makeDefault: true, label: "Flow State Sheet" });
  DocumentSheetConfig.registerSheet(Actor, "flowstate", FlowStatePileSheet, { types: ["pile"], makeDefault: true, label: "Dropped Items" });
  DocumentSheetConfig.registerSheet(Item, "flowstate", FlowStateItemSheet, { types: ["gear"], makeDefault: true, label: "Flow State Gear" });
  DocumentSheetConfig.registerSheet(Item, "flowstate", FlowStateWeaponSheet, { types: ["weapon"], makeDefault: true, label: "Flow State Weapon" });
  DocumentSheetConfig.registerSheet(Item, "flowstate", FlowStateArmorSheet, { types: ["armor"], makeDefault: true, label: "Flow State Armor" });
  DocumentSheetConfig.registerSheet(Item, "flowstate", FlowStateFociSheet, { types: ["foci"], makeDefault: true, label: "Flow State Foci" });
  DocumentSheetConfig.registerSheet(Item, "flowstate", FlowStateShroudSheet, { types: ["shroud"], makeDefault: true, label: "Flow State Shroud" });
  DocumentSheetConfig.registerSheet(Item, "flowstate", FlowStateIconSheet, { types: ["icon"], makeDefault: true, label: "Flow State Icon" });
});

/* -------------------------------------------- */
/*  Attack exchange: button visibility & state  */
/* -------------------------------------------- */

/** Hide buttons the viewer can't use and mark steps that are already resolved. */
function decorateExchange(message, html) {
  const attack = message.getFlag("flowstate", "attack");
  if (attack) {
    const cancelled = actions.findCancel(message.id)?.getFlag("flowstate", "spellCancelled");
    for (const [index, entry] of attack.targets.entries()) {
      const defense = actions.findDefense(message.id, index);
      if (cancelled && !defense) {
        html.querySelector(`.fs-target[data-index="${index}"] .fs-exchange-buttons`)?.remove();
        const st = html.querySelector(`.fs-status[data-index="${index}"]`);
        if (st) st.innerHTML = `<div class="fs-notes"><i class="fa-solid fa-ban"></i> Countered mid cast: ${foundry.utils.escapeHTML(cancelled.reason ?? "the spell is gone")}</div>`;
        continue;
      }
      const status = html.querySelector(`.fs-status[data-index="${index}"]`);
      const buttons = html.querySelector(`.fs-target[data-index="${index}"] .fs-exchange-buttons`);
      // Close Quarters (Bladed T2): once used, show the re-rolled attack and drop its button.
      const shifts = actions.findShifts(message.id, index);
      const sh = shifts.at(-1);
      const shiftUses = ab.shiftInfo(fromUuidSync(entry.uuid))?.uses ?? 1;
      if (shifts.length >= shiftUses) buttons?.querySelector(".fs-shift")?.remove();
      if (sh && status && !defense) status.innerHTML = `<div class="fs-notes">Shift: ${sh.mode === "adv" ? "Advantage on the dodge" : `attack re-rolled ${sh.original} → <strong>${sh.total}</strong>`}</div>`;
      const cq = actions.findCloseQuarters(message.id, index)?.getFlag("flowstate", "closeQuarters");
      if (cq) {
        buttons?.querySelector(".fs-close-quarters")?.remove();
        if (status && !defense) status.innerHTML = `<div class="fs-notes">Close Quarters: attack re-rolled ${cq.original} → <strong>${cq.total}</strong></div>`;
      }
      const dsh = actions.findDash(message.id, index)?.getFlag("flowstate", "dash");
      if (dsh) {
        buttons?.querySelector(".fs-dash")?.remove();
        if (status && !defense) status.innerHTML = `<div class="fs-notes">Dash: attack re-rolled ${dsh.original} → <strong>${dsh.total}</strong></div>`;
      }
      const dist = actions.findDistract(message.id, index)?.getFlag("flowstate", "distract");
      if (dist) {
        buttons?.querySelector(".fs-distract")?.remove();
        if (status && !defense) status.innerHTML = `<div class="fs-notes">Distracting Fire: ${dist.hit ? `attack re-rolled ${dist.original} → <strong>${dist.total}</strong>, Weakened` : "missed"}</div>`;
      }
      if (defense) html.querySelectorAll(`.fs-target[data-index="${index}"] .fs-block-row, .fs-target[data-index="${index}"] .fs-quartz-row`).forEach(r => r.remove());
      for (const q of actions.findQuartz(message.id, index)) {
        const owner = fromUuidSync(q)?.parent;
        const row = owner && html.querySelector(`.fs-target[data-index="${index}"] .fs-quartz-row[data-owner="${owner.uuid}"]`);
        if (row) row.innerHTML = `<div class="fs-waiting">${foundry.utils.escapeHTML(owner.name)}'s Shroud extends over them.</div>`;
      }
      for (const b of actions.findBlocksFor(message.id, index)) {
        const row = html.querySelector(`.fs-target[data-index="${index}"] .fs-block-row[data-owner="${b.blocker}"]`);
        if (row) row.innerHTML = `<div class="fs-waiting">${foundry.utils.escapeHTML(fromUuidSync(b.blocker)?.name ?? "Ally")} is Blocking.</div>`;
      }
      // Collapsed "Ally help" row: who is helping, and the button only for users who own one of the helpers.
      const ally = html.querySelector(`.fs-target[data-index="${index}"] .fs-ally-row`);
      if (ally) {
        const esc = foundry.utils.escapeHTML;
        const notes = [
          ...actions.findBlocksFor(message.id, index).map(b => `${esc(fromUuidSync(b.blocker)?.name ?? "An ally")} is Blocking${b.toss ? " (Shield Toss)" : ""}.`),
          ...actions.findQuartz(message.id, index).map(q => `${esc(fromUuidSync(q)?.parent?.name ?? "An ally")}'s Shroud extends over them.`)
        ];
        const status = ally.querySelector(".fs-ally-status");
        if (status) status.innerHTML = notes.map(n => `<div class="fs-waiting">${n}</div>`).join("");
        const mine = (ally.dataset.owners ?? "").split(",").some(u => u && fromUuidSync(u)?.isOwner);
        if (defense || !mine) ally.querySelector(".fs-ally-help")?.remove();
        if (!ally.querySelector("button") && !notes.length) ally.remove();
      }
      if (actions.findPerfectFails(message.id, index).length) buttons?.querySelectorAll(".fs-perfect").forEach(b => b.remove());
      if (defense) {
        const r = defense.getFlag("flowstate", "defense").result;
        buttons?.remove();
        if (status) status.innerHTML = `<div class="fs-outcome fs-${r.hit ? (r.crit ? "crit" : "hit") : "miss"}">${r.outcome}</div>`;
      } else if (buttons && !fromUuidSync(entry.uuid)?.isOwner) {
        buttons.innerHTML = `<div class="fs-waiting" data-pending="1">Waiting for ${foundry.utils.escapeHTML(entry.name)} to respond…</div>`;
      }
    }
  }
  const defense = message.getFlag("flowstate", "defense");
  const riposteRow = html.querySelector(".fs-riposte-row");
  if (riposteRow) {
    if (actions.findFollowup(message.id)) riposteRow.innerHTML = `<div class="fs-waiting">Riposte used.</div>`;
    else if (actions.findRiposteDeclined(message.id)) riposteRow.innerHTML = `<div class="fs-waiting">No riposte.</div>`;
    else if (!fromUuidSync(riposteRow.dataset.owner)?.isOwner) {
      riposteRow.innerHTML = `<div class="fs-waiting" data-pending="1">Waiting for ${foundry.utils.escapeHTML(fromUuidSync(riposteRow.dataset.owner)?.name ?? "the defender")} to decide on a Riposte…</div>`;
    }
  }
  // Brawling rows: only the owner sees the buttons; show what was used.
  for (const row of html.querySelectorAll(".fs-brawl-row")) {
    if (row.classList.contains("fs-redirect-row") && game.messages.find(m => m.getFlag("flowstate", "attack")?.opts?.redirectOf === message.id)) row.innerHTML = `<div class="fs-waiting">Redirected.</div>`;
    if (row.classList.contains("fs-knockback-row") && game.messages.find(m => m.getFlag("flowstate", "knockbackOf") === message.id
      || m.getFlag("flowstate", "attack")?.opts?.knockbackOf === message.id)) row.innerHTML = `<div class="fs-waiting">Force used.</div>`;
    if (row.classList.contains("fs-limber-row")) {
      const who = fromUuidSync(row.dataset.owner);
      const used = game.messages.find(m => m.getFlag("flowstate", "limberOf") === message.id && m.getFlag("flowstate", "limberActor") === row.dataset.owner)
        || who?.getFlag?.("flowstate", "limberFrom") === message.id;
      if (used) row.innerHTML = `<div class="fs-waiting">Limber used.</div>`;
      else if (who?.statuses?.has?.("limber")) row.remove();
    }
    if (row.classList.contains("fs-mark-row") && actions.findFollowup(`${message.id}:mark`)) row.innerHTML = `<div class="fs-waiting">Mark shot taken.</div>`;
    if (row.classList.contains("fs-cutback-row") && actions.findFollowup(message.id)) row.innerHTML = `<div class="fs-waiting">Cut Back used.</div>`;
    if (row.classList.contains("fs-flurry-row") && actions.findFollowup(`${message.id}:flurry`)) row.innerHTML = `<div class="fs-waiting">Blade Flurry used.</div>`;
    if (row.classList.contains("fs-deflect-row") && game.messages.find(m => m.getFlag("flowstate", "attack")?.opts?.deflectOf === message.id)) row.innerHTML = `<div class="fs-waiting">Deflected.</div>`;
    if (row.classList.contains("fs-reach-row")) {
      for (const k of ["twist", "impale"]) if (game.messages.find(m => m.getFlag("flowstate", "reachOf") === `${message.id}:${k}`)) row.querySelector(`.fs-${k}`)?.replaceWith(Object.assign(document.createElement("div"), { className: "fs-waiting", textContent: `${k === "twist" ? "Twist" : "Impale"} used.` }));
    }
    if (row.classList.contains("fs-palisade-row") && actions.findFollowup(`${message.id}:palisade`)) row.innerHTML = `<div class="fs-waiting">Palisade used.</div>`;
    if (row.classList.contains("fs-momentum-row") && game.messages.find(m => m.getFlag("flowstate", "momentumOf") === message.id)) row.innerHTML = `<div class="fs-waiting">Momentum added.</div>`;
    if (row.classList.contains("fs-dip-row") && game.messages.find(m => m.getFlag("flowstate", "dipOf") === message.id)) row.innerHTML = `<div class="fs-waiting">Dip move used.</div>`;
    if (row.classList.contains("fs-dash-move-row") && game.messages.find(m => m.getFlag("flowstate", "dashMoveOf") === message.id)) row.innerHTML = `<div class="fs-waiting">Dash move used.</div>`;
    if (row.classList.contains("fs-retort-row") && actions.findRetort(message.id)) row.innerHTML = `<div class="fs-waiting">Retort used.</div>`;
    if (row.classList.contains("fs-shroud-row")) {
      for (const b of row.querySelectorAll(".fs-shroud-counter")) {
        if (game.messages.find(m => m.getFlag("flowstate", "attack")?.opts?.shroudCounterOf === `${message.id}:${b.dataset.kind}`)) b.replaceWith(Object.assign(document.createElement("div"), { className: "fs-waiting", textContent: "Used." }));
      }
    }
    if (row.classList.contains("fs-reflect-row") && game.messages.find(m => m.getFlag("flowstate", "attack")?.opts?.shroudCounterOf === `${message.id}:reflect:${row.dataset.owner}`)) row.innerHTML = `<div class="fs-waiting">Reflected.</div>`;
    if (row.classList.contains("fs-chain-row") && game.messages.find(m => m.getFlag("flowstate", "attack")?.opts?.shroudCounterOf === `${message.id}:chain`)) row.innerHTML = `<div class="fs-waiting">Chained.</div>`;
    if (row.classList.contains("fs-electric-row") && game.messages.find(m => m.getFlag("flowstate", "attack")?.opts?.shroudCounterOf === `${message.id}:electric`)) row.innerHTML = `<div class="fs-waiting">Tried.</div>`;
    if (row.classList.contains("fs-bounce-row") && game.messages.find(m => m.getFlag("flowstate", "attack")?.opts?.bounceOf === message.id)) row.innerHTML = `<div class="fs-waiting">Bounced.</div>`;
    if (row.classList.contains("fs-turn-start-row")) {
      const sc = message.getFlag("flowstate", "startCard");
      const who = fromUuidSync(sc?.actor);
      const status = { maintain: "berserk", berserk: "berserk", properStance: "properStance", quicken: "quickened" };
      const label = { maintain: "Berserk maintained", berserk: "Berserk", properStance: "Proper Stance", quicken: "Quickened" };
      for (const b of row.querySelectorAll(".fs-turn-start")) {
        if (who?.statuses?.has(status[b.dataset.op])) b.replaceWith(Object.assign(document.createElement("div"), { className: "fs-waiting", textContent: `${label[b.dataset.op]} ✓` }));
      }
      if (game.combat?.round !== sc?.round && row.querySelector("button")) row.innerHTML = `<div class="fs-waiting">Turn passed.</div>`;
    }
    if (row.classList.contains("fs-brawl-extras")) {
      for (const b of row.querySelectorAll(".fs-brawl-extra")) {
        if (actions.findFollowup(`${message.id}:${b.dataset.kind}`)) b.replaceWith(Object.assign(document.createElement("div"), { className: "fs-waiting", textContent: `${b.dataset.kind === "combo" ? "Combo" : "Flow Like Water"} used.` }));
      }
    }
    // Only the owner sees the buttons; everyone else sees who it's waiting on.
    if (row.querySelector("button") && !fromUuidSync(row.dataset.owner)?.isOwner) {
      row.innerHTML = `<div class="fs-waiting" data-pending="1">Waiting for ${foundry.utils.escapeHTML(fromUuidSync(row.dataset.owner)?.name ?? "someone")}…</div>`;
    }
  }
  if (defense) {
    const buttons = html.querySelector(".fs-exchange-buttons");
    if (buttons && actions.findDamage(message.id)) buttons.innerHTML = `<div class="fs-waiting">Damage rolled.</div>`;
    else if (buttons && !fromUuidSync(defense.attacker)?.isOwner) {
      buttons.innerHTML = `<div class="fs-waiting" data-pending="1">Waiting for ${foundry.utils.escapeHTML(fromUuidSync(defense.attacker)?.name ?? "the attacker")} to roll damage…</div>`;
    }
  }
}

/** When a step is answered, re-render the card it answers so its buttons update everywhere. */
Hooks.on("createChatMessage", message => {
  const ref = message.getFlag("flowstate", "defense")?.attackMessage ?? message.getFlag("flowstate", "damage")?.defenseMessage
    ?? message.getFlag("flowstate", "closeQuarters")?.attackMessage ?? message.getFlag("flowstate", "shift")?.attackMessage
    ?? message.getFlag("flowstate", "distract")?.attackMessage ?? message.getFlag("flowstate", "reachOf") ?? message.getFlag("flowstate", "momentumOf")
    ?? message.getFlag("flowstate", "dash")?.attackMessage ?? message.getFlag("flowstate", "blockFor")?.attackMessage
    ?? message.getFlag("flowstate", "perfect")?.attackMessage ?? message.getFlag("flowstate", "dipOf") ?? message.getFlag("flowstate", "dashMoveOf")
    ?? message.getFlag("flowstate", "riposteDeclined") ?? message.getFlag("flowstate", "quartzFor")?.attackMessage ?? message.getFlag("flowstate", "adjustFor")?.attackMessage ?? message.getFlag("flowstate", "retortOf") ?? message.getFlag("flowstate", "limberOf")
    ?? message.getFlag("flowstate", "spellCancelled")?.attackMessage ?? message.getFlag("flowstate", "mentalActDone")?.card
    ?? message.getFlag("flowstate", "followupCard")
    ?? message.getFlag("flowstate", "followupOf");
  const target = ref && game.messages.get(String(ref).split(":")[0]);
  if (target) ui.chat?.updateMessage?.(target);
  const also = message.getFlag("flowstate", "attack")?.opts?.redirectOf ?? message.getFlag("flowstate", "attack")?.opts?.deflectOf
    ?? message.getFlag("flowstate", "attack")?.opts?.bounceOf ?? message.getFlag("flowstate", "attack")?.opts?.shroudCounterOf?.split(":")[0]
    ?? message.getFlag("flowstate", "knockbackOf") ?? message.getFlag("flowstate", "attack")?.opts?.knockbackOf;
  if (also && game.messages.get(also)) ui.chat?.updateMessage?.(game.messages.get(also));
  // A follow-up was taken: update its follow-up card too.
  const card = message.getFlag("flowstate", "followupOf") && actions.findFollowupCard(message.getFlag("flowstate", "followupOf"));
  if (card) ui.chat?.updateMessage?.(card);
});

/**
 * Follow-ups wait until the whole exchange is resolved (responses, damage, Riposte), then get their own card.
 * One client does the posting: the active GM, or the message's author when no GM is connected.
 */
Hooks.on("createChatMessage", message => {
  const responsible = game.users.activeGM ? game.user.isActiveGM : message.author?.id === game.user.id;
  if (!responsible) return;
  const f = k => message.getFlag("flowstate", k);
  let attackMsg = null;
  if (f("attack") || f("followups")) attackMsg = message;
  else if (f("defense")) attackMsg = game.messages.get(f("defense").attackMessage);
  else if (f("damage")) attackMsg = game.messages.get(game.messages.get(f("damage").defenseMessage)?.getFlag("flowstate", "defense")?.attackMessage);
  else if (f("riposteDeclined")) {
    const src = game.messages.get(f("riposteDeclined"));
    const def = src?.getFlag("flowstate", "defense") ?? game.messages.get(src?.getFlag("flowstate", "damage")?.defenseMessage)?.getFlag("flowstate", "defense");
    attackMsg = game.messages.get(def?.attackMessage);
  }
  if (attackMsg) setTimeout(() => actions.postReadyFollowups(attackMsg), 0);
});

/** GM applies damage on behalf of players who don't own the target. */
Hooks.once("ready", () => {
  game.socket.on("system.flowstate", async data => {
    if (!game.user.isActiveGM) return;
    if (data?.action === "browseFiles") return pictures.answerBrowse(data);
    if (data?.action === "uploadChunk") return pictures.receiveUpload(data);
    await actions.GM_ACTIONS[data?.action]?.(data);
  });
  pictures.listenForBrowse();
});

/* -------------------------------------------- */
/*  Movement: only on your own turn in combat   */
/* -------------------------------------------- */

/**
 * During a started combat, players can't move a combatant token unless it's that combatant's turn.
 * Unconscious or dead characters can't move at all. The GM can always move tokens, and system moves
 * (a thrown creature) go through. Tokens not in the combat move freely.
 */
Hooks.on("preUpdateToken", (token, changes, options) => {
  if (!("x" in changes || "y" in changes) || options?.flowstateThrow) return;
  const actor = token.actor;
  if (!game.user.isGM) {
    if (actions.helpless(actor)) {
      ui.notifications.warn(`${token.name} is ${actor.statuses.has("dead") ? "dead" : "unconscious"} and can't move.`);
      return false;
    }
    if (actor?.getFlag("flowstate", "lockedDown")) {
      ui.notifications.warn(`${token.name} is Locked Down and can't move.`);
      return false;
    }
    // Grappled: held in place by an effect (Gravity Hold, a thrown weapon) means no movement at all; held by a creature means staying
    // within their reach (a weapon grapple's reach is longer, Thrasher's most of all). Whoever holds you drags you along when they move.
    const blocked = actions.grappleMoveBlock(actor, token, changes.x ?? token.x, changes.y ?? token.y);
    if (blocked) { ui.notifications.warn(blocked); return false; }
    // Dip (Brawling T2): one free move away, even off-turn.
    if (actor?.getFlag("flowstate", "freeMove")) setTimeout(() => actor.unsetFlag("flowstate", "freeMove"), 0);
    else {
      const combat = game.combat;
      const mine = combat?.started ? combat.combatants.find(c => c.tokenId === token.id && c.sceneId === token.parent?.id) : null;
      if (mine && combat.combatant?.id !== mine.id) {
        ui.notifications.warn(`${token.name} can only move on their own turn.`);
        return false;
      }
    }
  }
  // Cool Breath (Assault T4): a free Take Aim roots you for the rest of the turn.
  const key = actions.turnKey();
  if (!game.user.isGM && key && actor?.getFlag("flowstate", "rootedTurn") === key) {
    ui.notifications.warn(`${token.name} used Cool Breath this turn and can't move until next turn.`);
    return false;
  }
  if (actor?.isOwner) {
    // Remember that this creature moved this turn (Cool Breath needs you not to have), and use up a readied Trudge.
    setTimeout(() => {
      if (key && actions.inActiveCombat(actor) && actor.getFlag("flowstate", "movedTurn") !== key) actor.setFlag("flowstate", "movedTurn", key);
      if (actor.getFlag("flowstate", "trudge")) actor.unsetFlag("flowstate", "trudge");
    }, 0);
  }
  // Gash (Slashing T3): voluntarily moving reopens the wound.
  if (actor && !options?.flowstateThrow && actions.spellEffects(actor, "gash").length) actions.triggerGash(actor);
  if (actor && !options?.flowstateThrow) actions.hexMove(actor);
  if (actor && !options?.flowstateThrow) actions.arcanaCheckEntry(token, changes);
  // Rapid T3 Mark: a Marked creature moving lets the marker shoot.
  if (actor?.getFlag("flowstate", "markedBy")) actions.triggerMark(actor, "moves");
  // Reach T1 Palisade: moving into a Reach wielder's range lets them strike (the palisading token is moved back on a hit).
  if (!options?.flowstateThrow) actions.checkPalisade(token, { x: changes.x ?? token.x, y: changes.y ?? token.y });
});

/** Remember where a token started so the creatures it holds can follow by the same step. */
Hooks.on("preUpdateToken", (token, changes, options) => {
  if (("x" in changes || "y" in changes) && !options?.flowstateDrag) options.flowstateFrom = { x: token.x, y: token.y };
});
Hooks.on("updateToken", (token, changes, options, userId) => {
  if (userId !== game.user.id || !options?.flowstateFrom || options.flowstateDrag || !token.actor) return;
  if (!("x" in changes || "y" in changes)) return;
  actions.dragGrappled(token.actor, token, options.flowstateFrom);
});

/* -------------------------------------------- */
/*  GM-gated build: stats, points, size, items  */
/* -------------------------------------------- */
/*
 * Outside character creation, players can't change their build or create/modify/delete items.
 * They CAN spend granted stat points (flowstateSpend), move items (flowstateTransfer: drop, pick up, throw),
 * and change item state (equip, 2H, loaded). Foundry has no server-side field checks, so this guards the
 * interface and normal play; it isn't anti-cheat.
 */
const BUILD_KEYS = ["system.stats", "system.skillPoints", "system.size", "system.unspentStats", "system.statCarry", "system.creation", "system.trees"];
// Players may rename their own items and change their pictures; everything else about an item's identity is GM-only.
const ITEM_IDENTITY_KEYS = ["system.weaponType", "system.weight", "system.material", "system.grade",
  "system.description", "system.quantity", "system.wear", "system.fociType", "system.shroudType", "system.affixes", "system.magazine", "system.extraTypes", "system.ammoType"];

/** Keys in `changes` that match a guarded prefix AND actually differ from the document's current value. */
function guardedChanges(doc, changes, keys) {
  const flat = foundry.utils.flattenObject(changes);
  return Object.keys(flat).filter(k => keys.some(p => k === p || k.startsWith(`${p}.`))
    && foundry.utils.getProperty(doc, k) !== flat[k]);
}

/** Is this actor's build open to its players (GM always can)? */
const buildOpen = actor => !actor || actor.type === "pile" || actor.system?.creation;

/** Characters stay Size 3 until Ancestry exists (only NPCs have other sizes). */
Hooks.on("preUpdateActor", (actor, changes, options) => {
  if (actor.type !== "character" || options?.flowstateAncestry) return;
  if (!guardedChanges(actor, changes, ["system.size"]).length) return;
  ui.notifications.warn("Character size is set by Ancestry, which isn't in the system yet. It stays at Size 3.");
  setTimeout(() => actor.sheet?.rendered && actor.sheet.render(), 0);
  return false;
});

Hooks.on("preUpdateActor", (actor, changes, options) => {
  if (game.user.isGM || actor.type === "pile" || options?.flowstateSpend || options?.flowstateSystem) return;
  const touched = guardedChanges(actor, changes, BUILD_KEYS);
  if (!touched.length) return;
  if (actor.system.creation) {
    // During creation anything goes, except a player can't re-open creation once finalized (handled by GM).
    return;
  }
  ui.notifications.warn("Only the GM can change stats, Skill Points, or size after character creation. Spend granted stat points with the + buttons.");
  setTimeout(() => actor.sheet?.rendered && actor.sheet.render(), 0);
  return false;
});

/** Martial Theory T4 (Improvise): characters with it don't carry improvised weapons (for anyone, GM included). */
Hooks.on("preCreateItem", item => {
  const actor = item.parent;
  if (!(actor instanceof Actor) || !actions.isImprovised(item) || actions.theoryTier(actor) < 4) return;
  ui.notifications.warn(`${actor.name} has Improvise (Martial Theory Tier 4): improvised weapons count as normal ones. Forge it as its closest real weapon type instead.`);
  return false;
});

Hooks.on("preCreateItem", (item, data, options) => {
  const actor = item.parent;
  if (game.user.isGM || !(actor instanceof Actor) || buildOpen(actor) || options?.flowstateTransfer || options?.flowstateSystem) return;
  ui.notifications.warn("Only the GM can add new items to a character. Picking items up works as normal.");
  return false;
});

Hooks.on("preUpdateItem", (item, changes, options) => {
  const actor = item.parent;
  if (game.user.isGM || !(actor instanceof Actor) || buildOpen(actor)) return;
  if (options?.flowstateSystem || options?.flowstateTransfer) return;
  if (!guardedChanges(item, changes, ITEM_IDENTITY_KEYS).length) return; // equip/2H/loaded are fine
  ui.notifications.warn("Only the GM can modify or repair equipment.");
  setTimeout(() => { if (item.sheet?.rendered) item.sheet.render(); if (actor.sheet?.rendered) actor.sheet.render(); }, 0);
  return false;
});

Hooks.on("preDeleteItem", (item, options) => {
  const actor = item.parent;
  if (game.user.isGM || !(actor instanceof Actor) || buildOpen(actor) || options?.flowstateTransfer || options?.flowstateSystem) return;
  ui.notifications.warn("Only the GM can delete items. You can drop them instead.");
  return false;
});

/* -------------------------------------------- */
/*  GM tools: grant points, reopen creation     */
/* -------------------------------------------- */

/** Player characters: character actors with at least one player owner. */
const playerCharacters = () => game.actors.filter(a => a.type === "character" && a.hasPlayerOwner);

async function announceGrants(results) {
  const lines = results.map(({ actor, stats, skills }) => `<li><strong>${foundry.utils.escapeHTML(actor.name)}</strong>: +${stats} stat point${stats === 1 ? "" : "s"}, +${skills} Skill Point${skills === 1 ? "" : "s"}</li>`);
  await ChatMessage.create({ content: `<div class="flowstate-card"><header class="fs-card-title">Points granted</header><ul class="fs-list">${lines.join("")}</ul></div>` });
}

/** Dialog: grant stat and/or skill points to some actors. Blank Skill Points = automatic 3:1. */
async function grantDialog(targets) {
  if (!targets.length) return ui.notifications.warn("No player characters to grant points to.");
  const names = targets.map(a => foundry.utils.escapeHTML(a.name)).join(", ");
  const res = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Grant Points" }, rejectClose: false,
    content: `<div class="flowstate-dialog"><p>To: <strong>${names}</strong></p>
      <div class="form-group"><label>Stat points</label><input type="number" name="stats" value="3" min="0" step="1"></div>
      <div class="form-group"><label>Skill Points</label><input type="number" name="skills" placeholder="auto (3 stat : 1 skill)" min="0" step="1"></div>
      <p class="hint">Leave Skill Points blank to use the 3:1 ratio; leftover stat points carry toward the next Skill Point.</p></div>`,
    ok: { label: "Grant", icon: "fa-solid fa-gift", callback: (e, b) => ({ stats: Number(b.form.elements.stats.value) || 0, skills: b.form.elements.skills.value }) }
  });
  if (!res) return;
  const results = [];
  for (const actor of targets) results.push({ actor, ...(await actions.grantPoints(actor, res.stats, res.skills === "" ? null : Number(res.skills))) });
  await announceGrants(results);
}

/** Actor sidebar right-click entries (v13 name, plus the older name for safety). */
function actorContextEntries(entries) {
  const actorFrom = li => game.actors.get(li?.dataset?.entryId ?? li?.dataset?.documentId ?? li?.data?.("documentId"));
  entries.push(
    { name: "Grant Points", icon: '<i class="fa-solid fa-gift"></i>',
      condition: li => game.user.isGM && ["character", "npc"].includes(actorFrom(li)?.type),
      callback: li => grantDialog([actorFrom(li)]) }
  );
}
Hooks.on("getActorContextOptions", (app, entries) => actorContextEntries(entries));
Hooks.on("getActorDirectoryEntryContext", (html, entries) => actorContextEntries(entries));

/** Chat command: /grant <stat points> [skill points] → all player characters. GM only. */
Hooks.on("chatMessage", (log, message) => {
  const m = message.trim().match(/^\/grant(?:\s+(\d+))?(?:\s+(\d+))?\s*$/i);
  if (!m) return;
  if (!game.user.isGM) { ui.notifications.warn("Only the GM can grant points."); return false; }
  const stats = Number(m[1] ?? 0), skills = m[2] === undefined ? null : Number(m[2]);
  (async () => {
    const targets = playerCharacters();
    if (!targets.length) return ui.notifications.warn("No player characters to grant points to.");
    if (m[1] === undefined) return grantDialog(targets);
    const results = [];
    for (const actor of targets) results.push({ actor, ...(await actions.grantPoints(actor, stats, skills)) });
    await announceGrants(results);
  })();
  return false;
});

/* -------------------------------------------- */
/*  New Character wizard                        */
/* -------------------------------------------- */

/** "New Character" button at the top of the Actors tab, for everyone. */
Hooks.on("renderActorDirectory", (app, html) => {
  const root = html instanceof HTMLElement ? html : html[0];
  if (!root || root.querySelector(".fs-new-character")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "fs-new-character";
  btn.innerHTML = `<i class="fa-solid fa-user-plus"></i> New Character`;
  btn.addEventListener("click", () => CharacterWizard.open());
  const header = root.querySelector(".header-actions") ?? root.querySelector(".directory-header") ?? root;
  header.prepend(btn);
});

/** When the GM finishes creating someone's character, open it for them. */
Hooks.on("createActor", actor => {
  if (actor.getFlag("flowstate", "createdBy") === game.user.id) actor.sheet?.render(true);
});

/** One-time: sheets no longer have a creation mode, so lock any character still in it. */
Hooks.once("ready", async () => {
  if (!game.user.isActiveGM || game.settings.get("flowstate", "migratedCreationLock")) return;
  for (const actor of game.actors) {
    if (actor.system?.creation) await actor.update({ "system.creation": false });
  }
  await game.settings.set("flowstate", "migratedCreationLock", true);
});

/* -------------------------------------------- */
/*  GM tools: the Forge                         */
/* -------------------------------------------- */

/** Make a new weapon/armor/foci/shroud/misc item in the "Forge" folder and open its builder. Drag it onto a character to give it. */
async function openForge() {
  const type = await foundry.applications.api.DialogV2.wait({
    window: { title: "Forge" }, rejectClose: false,
    content: `<p>Build a new item. When it's ready, drag it from the Items sidebar onto a character.</p>`,
    buttons: [
      { action: "weapon", label: "Weapon", icon: "fa-solid fa-khanda", default: true },
      { action: "armor", label: "Armor", icon: "fa-solid fa-shirt" },
      { action: "foci", label: "Foci", icon: "fa-solid fa-wand-sparkles" },
      { action: "shroud", label: "Shroud", icon: "fa-solid fa-ghost" },
      { action: "icon", label: "Icon", icon: "fa-solid fa-hands-praying" },
      { action: "gear", label: "Misc Item", icon: "fa-solid fa-box" }
    ]
  });
  if (!type) return;
  const folder = game.folders.find(f => f.type === "Item" && f.name === "Forge") ?? await Folder.create({ name: "Forge", type: "Item" });
  const name = { weapon: "New Weapon", armor: "New Armor", foci: "New Foci", shroud: "New Shroud", icon: "New Icon", gear: "New Item" }[type];
  const img = { foci: "icons/weapons/wands/wand-gem-purple.webp", shroud: "icons/magic/defensive/shield-barrier-glowing-blue.webp", icon: "icons/magic/holy/yin-yang-balance-symbol.webp" }[type];
  const item = await Item.create({ name, type, folder: folder.id, ...(img ? { img } : {}) });
  item?.sheet.render(true);
}

Hooks.on("renderItemDirectory", (app, html) => {
  if (!game.user.isGM) return;
  const root = html instanceof HTMLElement ? html : html[0];
  if (!root || root.querySelector(".fs-forge-btn")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "fs-forge-btn";
  btn.innerHTML = `<i class="fa-solid fa-hammer"></i> Forge`;
  btn.addEventListener("click", openForge);
  const header = root.querySelector(".header-actions") ?? root.querySelector(".directory-header") ?? root;
  header.append(btn);
});

/* -------------------------------------------- */
/*  Energy is full outside combat               */
/* -------------------------------------------- */

/** When combat ends (or someone leaves it), refill their Energy. Runs on the active GM. */
Hooks.on("deleteCombat", combat => {
  if (!game.user.isActiveGM) return;
  for (const c of combat.combatants) setTimeout(() => {
    actions.clearSpellEffects(c.actor, { all: true });
    areas.clearAreas(c.actor, { all: true });
    conjure.clearAll(c.actor);
    actions.refillEnergy(c.actor); actions.clearStances(c.actor);
    if (c.actor?.getFlag("flowstate", "carefulLapsed")) c.actor.unsetFlag("flowstate", "carefulLapsed"); // Careful Steps is free again
  }, 0);
});
Hooks.on("deleteCombatant", combatant => {
  if (game.user.isActiveGM) setTimeout(() => actions.refillEnergy(combatant.actor), 0);
});
Hooks.once("ready", () => {
  if (!game.user.isActiveGM) return;
  for (const actor of game.actors) actions.refillEnergy(actor);
});

/* -------------------------------------------- */
/*  Keep open sheets live                       */
/* -------------------------------------------- */

/**
 * Re-render every open Flow State sheet for an actor, matched by UUID.
 * Automated updates (end of turn, applied damage, armor wear) can come from another client or
 * through a token's synthetic actor, which isn't always the same object the open sheet holds.
 */
const pendingRefresh = new Map();
export function refreshActorSheets(actor) {
  const uuid = actor?.uuid;
  if (!uuid || pendingRefresh.has(uuid)) return;
  pendingRefresh.set(uuid, setTimeout(() => {
    pendingRefresh.delete(uuid);
    const baseId = actor.isToken ? actor.id : null;
    for (const app of foundry.applications.instances.values()) {
      if (!(app instanceof FlowStateActorSheet) || !app.rendered) continue;
      const doc = app.document;
      // Same actor, or a token copy of it (or the base actor behind a token copy).
      if (doc.uuid === uuid || (baseId && doc.id === baseId && !doc.isToken)) app.render();
    }
  }, 30));
}

/** Re-render every open actor sheet (for changes that affect other actors' Action Lists, like combat turns). */
let pendingAll = null;
export function refreshAllActorSheets() {
  if (pendingAll) return;
  pendingAll = setTimeout(() => {
    pendingAll = null;
    for (const app of foundry.applications.instances.values()) {
      if (app instanceof FlowStateActorSheet && app.rendered) app.render();
    }
  }, 30);
}

Hooks.on("updateActor", (actor, changes) => {
  refreshActorSheets(actor);
  // Grapples show on the grappler's sheet too (Release / Throw), so refresh everyone when one changes.
  if (foundry.utils.hasProperty(changes, "flags.flowstate.grappledBy") || foundry.utils.hasProperty(changes, "flags.flowstate.-=grappledBy")
    || changes.flags?.flowstate?.["-=grappledBy"] !== undefined) refreshAllActorSheets();
});
// Combat state (started, whose turn, who's in it) changes costs and what's usable (Psych Up, Calm Down, pick-ups, Energy).
for (const hook of ["createCombat", "updateCombat", "deleteCombat", "createCombatant", "updateCombatant", "deleteCombatant"]) {
  Hooks.on(hook, () => refreshAllActorSheets());
}
Hooks.on("updateToken", (token, changes) => { if (changes.delta || changes.actorData) refreshActorSheets(token.actor); });
for (const hook of ["createItem", "updateItem", "deleteItem", "createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
  Hooks.on(hook, doc => { if (doc.parent instanceof Actor) refreshActorSheets(doc.parent); });
}
// Quicken (Unarmored T4) ends if armor goes on.
Hooks.on("updateItem", (item, changes, options, userId) => {
  if (userId !== game.user.id || item.type !== "armor" || !item.system.equipped) return;
  const actor = item.parent;
  if (!(actor instanceof Actor) || !actor.statuses?.has("quickened")) return;
  setTimeout(async () => {
    await actor.toggleStatusEffect("quickened", { active: false });
    ui.notifications.info(`${actor.name} put armor on, so Quicken ends.`);
  }, 0);
});
// Proper Stance (Assault T5) ends when you swap weapons.
Hooks.on("updateItem", (item, changes, options, userId) => {
  if (userId !== game.user.id || item.type !== "weapon" || item.system.weaponType === "unarmed") return;
  const actor = item.parent;
  if (!(actor instanceof Actor) || !actor.statuses?.has("properStance")) return;
  if (foundry.utils.getProperty(changes, "system.equipped") === undefined) return;
  setTimeout(async () => {
    await actor.toggleStatusEffect("properStance", { active: false });
    ui.notifications.info(`${actor.name} swapped weapons, so Proper Stance ends.`);
  }, 0);
});
// Taking off (or deleting) Medium armor ends Careful Steps.
for (const hook of ["updateItem", "deleteItem"]) {
  Hooks.on(hook, (item, ...rest) => {
    const userId = rest.at(-1);
    if (item.type !== "armor" || !(item.parent instanceof Actor) || userId !== game.user.id) return;
    setTimeout(() => actions.checkMediumArmor(item.parent), 0);
  });
}

/* -------------------------------------------- */
/*  Give existing actors their Unarmed weapon   */
/* -------------------------------------------- */

Hooks.once("ready", async () => {
  if (!game.user.isActiveGM) return;
  for (const actor of game.actors) {
    if (actor.type === "pile") continue;
    if (actor.items.some(i => i.type === "weapon" && i.system.weaponType === "unarmed")) continue;
    const free = 2 - handsUsed(actor);
    const data = foundry.utils.deepClone(UNARMED_ITEM);
    data.system.equipped = free >= 1;
    data.system.secondHand = free >= 2;
    await actor.createEmbeddedDocuments("Item", [data]);
  }
});

/* -------------------------------------------- */
/*  AP / RP pips in the combat tracker          */
/* -------------------------------------------- */

function pips(value, cls) {
  let html = "";
  for (let i = 0; i < 6; i++) html += `<span class="fs-pip ${cls} ${i < value ? "full" : ""}"></span>`;
  return html;
}

Hooks.on("renderCombatTracker", (app, html) => {
  const combat = app.viewed;
  if (!combat) return;
  for (const li of html.querySelectorAll("[data-combatant-id]")) {
    const combatant = combat.combatants.get(li.dataset.combatantId);
    const actor = combatant?.actor;
    if (!actor || actor.system?.ap === undefined) continue;
    if (!actor.testUserPermission(game.user, "OBSERVER")) continue;

    const el = document.createElement("div");
    el.className = "fs-tracker-points";
    el.innerHTML = `
      <span class="fs-points" data-resource="ap" data-tooltip="AP: click to spend, right-click to restore">
        <b>AP</b>${pips(actor.system.ap.value, "ap")}</span>
      <span class="fs-points" data-resource="rp" data-tooltip="RP: click to spend, right-click to restore">
        <b>RP</b>${pips(actor.system.rp.value, "rp")}</span>`;

    if (actor.isOwner) {
      for (const group of el.querySelectorAll(".fs-points")) {
        const adjust = delta => async event => {
          event.preventDefault();
          event.stopPropagation();
          const key = group.dataset.resource;
          const next = Math.clamp(actor.system[key].value + delta, 0, 6);
          await actor.update({ [`system.${key}.value`]: next });
        };
        group.addEventListener("click", adjust(-1));
        group.addEventListener("contextmenu", adjust(1));
        group.addEventListener("dblclick", e => e.stopPropagation());
      }
    }

    const anchor = li.querySelector(".token-name") ?? li;
    anchor.append(el);
  }
});

// Keep the tracker's pips current when AP/RP change (linked actors and unlinked tokens).
const refreshTracker = foundry.utils.debounce(() => ui.combat?.render(), 50);
Hooks.on("updateActor", (actor, changes) => {
  const s = changes.system;
  if (s && ("ap" in s || "rp" in s) && game.combat) refreshTracker();
});
Hooks.on("updateToken", (token, changes) => {
  const s = changes.delta?.system;
  if (s && ("ap" in s || "rp" in s) && game.combat) refreshTracker();
});

/* -------------------------------------------- */
/*  Chat card buttons                           */
/* -------------------------------------------- */

const followupInFlight = new Set();

Hooks.on("renderChatMessageHTML", (message, html) => {
  decorateExchange(message, html);
  for (const btn of html.querySelectorAll(".fs-defend")) {
    btn.addEventListener("click", event => {
      event.preventDefault();
      actions.defend(message, Number(btn.dataset.index), btn.dataset.choice);
    });
  }
  for (const btn of html.querySelectorAll(".fs-riposte")) {
    btn.addEventListener("click", event => {
      event.preventDefault();
      actions.riposte(message, { perfect: btn.dataset.perfect === "1", itemUuid: btn.dataset.item || null });
    });
  }
  for (const btn of html.querySelectorAll(".fs-roll-damage")) {
    btn.addEventListener("click", event => {
      event.preventDefault();
      actions.rollExchangeDamage(message);
    });
  }
  for (const btn of html.querySelectorAll(".fs-apply")) {
    btn.addEventListener("click", async event => {
      event.preventDefault();
      const actor = await fromUuid(btn.dataset.uuid);
      if (!actor) return ui.notifications.warn("That target no longer exists.");
      await actions.applyDamage(actor, Number(btn.dataset.amount), btn.dataset.type, { pierce: Number(btn.dataset.pierce) || 0 });
    });
  }
  // Follow-up cards: one follow-up per attack. The attack card notes where they went.
  const source = message.getFlag("flowstate", "followupCard");
  const followups = html.querySelector(".fs-followups");
  if (followups && source) {
    if (actions.findFollowup(source)) followups.querySelectorAll('.fs-followup:not([data-kind="return"])').forEach(b => b.remove());
    if (actions.findFollowup(`${source}:return`)) followups.querySelectorAll('.fs-followup[data-kind="return"]').forEach(b => b.remove());
    if (!followups.querySelector(".fs-followup")) followups.innerHTML = `<div class="fs-waiting">Follow-up used.</div>`;
  }
  const pending = html.querySelector(".fs-followups-pending");
  if (pending && actions.findFollowupCard(message.id)) pending.innerHTML = `<i class="fa-solid fa-forward"></i> Follow-up posted below.`;
  // Brawling Methods: Shatter's strike, Redirect, and Combo / Flow Like Water.
  for (const btn of html.querySelectorAll(".fs-limber")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.limber(message, btn.dataset.actor); });
  }
  for (const btn of html.querySelectorAll(".fs-mark-shot")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.markShot(message); });
  }
  for (const btn of html.querySelectorAll(".fs-cut-back")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.cutBack(message); });
  }
  for (const btn of html.querySelectorAll(".fs-flurry")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.bladeFlurry(message, btn.dataset.item); });
  }
  for (const btn of html.querySelectorAll(".fs-knockback")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.knockback(message); });
  }
  for (const btn of html.querySelectorAll(".fs-deflect")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.deflect(message); });
  }
  for (const btn of html.querySelectorAll(".fs-redirect")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.redirect(message); });
  }
  for (const btn of html.querySelectorAll(".fs-brawl-extra")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.brawlingExtra(message, btn.dataset.kind); });
  }
  for (const btn of html.querySelectorAll(".fs-block")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.blockFor(message, Number(btn.dataset.index), btn.dataset.blocker, btn.dataset.perfect === "1", btn.dataset.toss === "1"); });
  }
  for (const btn of html.querySelectorAll(".fs-twist, .fs-impale")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.reachFinisher(message, btn.classList.contains("fs-twist") ? "twist" : "impale"); });
  }
  for (const btn of html.querySelectorAll(".fs-palisade")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.palisade(message, btn.dataset.wall === "1"); });
  }
  for (const btn of html.querySelectorAll(".fs-momentum")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.addMomentum(message, btn.dataset.kind); });
  }
  for (const btn of html.querySelectorAll(".fs-ally-help")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.allyHelp(message, Number(btn.dataset.index)); });
  }
  for (const btn of html.querySelectorAll(".fs-quartz")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.quartzFor(message, Number(btn.dataset.index), btn.dataset.ownerActor); });
  }
  for (const btn of html.querySelectorAll(".fs-retort")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.retort(message); });
  }
  for (const btn of html.querySelectorAll(".fs-shroud-counter")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.shroudCounter(message, btn.dataset.kind, Number(btn.dataset.amount)); });
  }
  for (const btn of html.querySelectorAll(".fs-multicast")) {
    const mc = message.getFlag("flowstate", "multicast");
    if (mc && mc.remaining <= 0) { btn.replaceWith(Object.assign(document.createElement("div"), { className: "fs-waiting", textContent: "Multicast used up." })); continue; }
    btn.addEventListener("click", event => { event.preventDefault(); import("./casting.mjs").then(c => c.multicast(message)); });
  }
  for (const btn of html.querySelectorAll(".fs-chain")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.chainNext(message); });
  }
  for (const btn of html.querySelectorAll(".fs-arcana-act")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.arcanaAct(message, Number(btn.dataset.i)); });
  }
  for (const btn of html.querySelectorAll(".fs-mental-act")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.mentalAct(message, Number(btn.dataset.i)); });
  }
  if (message.getFlag("flowstate", "mentalAct")) {
    const used = game.messages.filter(m => m.getFlag("flowstate", "mentalActDone")?.card === message.id).map(m => m.getFlag("flowstate", "mentalActDone").i);
    for (const btn of html.querySelectorAll(".fs-mental-act")) if (used.includes(Number(btn.dataset.i))) btn.closest(".fs-mental-row")?.replaceChildren(Object.assign(document.createElement("div"), { className: "fs-waiting", textContent: "Used." }));
  }
  for (const btn of html.querySelectorAll(".fs-conjure-act")) {
    btn.addEventListener("click", event => { event.preventDefault(); conjure.act(message, Number(btn.dataset.i)); });
  }
  for (const btn of html.querySelectorAll(".fs-afflict-act")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.afflictAct(message, Number(btn.dataset.i)); });
  }
  for (const btn of html.querySelectorAll(".fs-electric-transfer")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.electricTransfer(message); });
  }
  for (const btn of html.querySelectorAll(".fs-flip-wall")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.requestGM("flipBarrier", { sceneId: btn.dataset.scene, templateId: btn.dataset.template }); });
  }
  for (const btn of html.querySelectorAll(".fs-reflect-counter")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.reflectCounter(message, btn.dataset.caster, Number(btn.dataset.amount)); });
  }
  for (const btn of html.querySelectorAll(".fs-dash-move")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.dashMove(message); });
  }
  for (const btn of html.querySelectorAll(".fs-dip-move")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.dipMove(message); });
  }
  for (const btn of html.querySelectorAll(".fs-bounce")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.shieldBounce(message); });
  }
  for (const btn of html.querySelectorAll(".fs-turn-start")) {
    btn.addEventListener("click", event => { event.preventDefault(); actions.startOfTurn(message, btn.dataset.op); });
  }
  for (const btn of html.querySelectorAll(".fs-no-riposte")) {
    btn.addEventListener("click", event => {
      event.preventDefault();
      actions.declineRiposte(message);
    });
  }
  for (const btn of html.querySelectorAll(".fs-followup")) {
    btn.addEventListener("click", async event => {
      event.preventDefault();
      // Only one follow-up per attack (Fast and Solitary can't both trigger).
      const src = btn.dataset.source || message.id;
      if (actions.findFollowup(src) || followupInFlight.has(src)) return ui.notifications.info("This attack's follow-up was already used.");
      const actor = await fromUuid(btn.dataset.actor);
      const item = actor?.items.get(btn.dataset.item);
      if (!item) return ui.notifications.warn("That weapon no longer exists.");
      if (!actor.isOwner) return ui.notifications.warn(`You don't control ${actor.name}.`);
      followupInFlight.add(src);
      try {
        await actions.rollWeaponAttack(actor, item, { net: Number(btn.dataset.net) || 0, label: btn.dataset.label, weight: btn.dataset.weight || null, source: src,
          kind: btn.dataset.kind || "", whirlwind: btn.dataset.whirlwind || "", perfect: btn.dataset.perfect === "1",
          twinFang: btn.dataset.twinFang === "1", flowChain: btn.dataset.flowChain === "1", quickStrike: btn.dataset.quickStrike === "1",
          attackType: btn.dataset.attackType || null });
      } finally {
        followupInFlight.delete(src);
      }
    });
  }
});

/* -------------------------------------------- */
/*  Equip limits: one Armor, two hands          */
/* -------------------------------------------- */

/** Read a change from either an expanded or a flattened update object. */
const changed = (changes, key) => (key in changes ? changes[key] : foundry.utils.getProperty(changes, key));

/** Item types that are held in hands (Foci count as held items too). */
export const HELD_TYPES = new Set(["weapon", "foci"]);

/** Hands a weapon occupies. Unarmed takes one hand per raised fist; other weapons 1, or 2 if two-handed. */
export function handsFor(data) {
  if (data.weaponType === "unarmed") return (data.equipped ? 1 : 0) + (data.secondHand ? 1 : 0);
  if (!data.equipped) return 0;
  return data.twoHanded ? 2 : 1;
}

/** Hands occupied by held weapons, optionally ignoring one item. */
export function handsUsed(actor, excludeId = null) {
  return actor.items.reduce((n, i) => (HELD_TYPES.has(i.type) && i.id !== excludeId ? n + handsFor(i.system) : n), 0);
}

/** Default Unarmed weapon every actor starts with (both fists up). */
export const UNARMED_ITEM = {
  name: "Unarmed",
  type: "weapon",
  img: "icons/skills/melee/unarmed-punch-fist.webp",
  system: { weaponType: "unarmed", weight: "light", material: "", equipped: true, secondHand: true }
};

/**
 * Hold an item change until the user confirms a cost. The change is re-issued with
 * `flowstateConfirmed` so the hook lets it through (and charges) the second time.
 */
function confirmFirst(item, changes, title, text) {
  const data = foundry.utils.deepClone(changes);
  delete data._id;
  (async () => {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title }, content: `<p>${text}</p>`, rejectClose: false
    });
    if (ok) await item.update(data, { flowstateConfirmed: true });
    else snapBack(item);
  })();
  return false;
}

function snapBack(item) {
  setTimeout(() => {
    if (item.sheet?.rendered) item.sheet.render();
    if (item.actor?.sheet?.rendered) item.actor.sheet.render();
  }, 0);
}

/** Refuse an item change with a warning, and re-render so a ticked checkbox snaps back. */
function refuse(item, why) {
  ui.notifications.warn(why);
  setTimeout(() => {
    if (item.sheet?.rendered) item.sheet.render();
    if (item.actor?.sheet?.rendered) item.actor.sheet.render();
  }, 0);
  return false;
}

const isActorsTurn = actor => game.combat?.started && game.combat.combatant?.actor?.uuid === actor.uuid;

Hooks.on("preUpdateItem", (item, changes, options) => {
  const actor = item.actor;
  if (!actor) return;
  const auto = options?.flowstateAuto; // our own follow-on changes (lowering fists, taking off old armor)
  const inCombat = !auto && actions.inActiveCombat(actor);

  /* ---- Armor: one at a time; in combat only Light can be changed, and it takes your whole turn ---- */
  if (item.type === "armor") {
    const equip = changed(changes, "system.equipped");
    if (equip === undefined || equip === item.system.equipped) return;
    const others = equip ? actor.items.filter(i => i.type === "armor" && i.id !== item.id && i.system.equipped) : [];
    if (inCombat) {
      if (item.system.weight !== "light") return refuse(item, `${ARMOR_LABEL(item)} armor takes ${martial.ARMOR_WEIGHTS[item.system.weight].don} to ${equip ? "put on" : "remove"}, so it can't be changed in combat.`);
      if (others.length) return refuse(item, `Take off ${others[0].name} first. Swapping armor takes more than one turn.`);
      if (!isActorsTurn(actor)) return refuse(item, `Light armor takes a full turn to ${equip ? "put on" : "remove"}. Do it on ${actor.name}'s turn.`);
      if (actor.system.ap.value < 6) return refuse(item, `Light armor takes a full turn (all 6 AP); ${actor.name} has ${actor.system.ap.value} AP left.`);
      if (!options?.flowstateConfirmed) {
        return confirmFirst(item, changes, `${equip ? "Put on" : "Remove"} ${item.name}?`,
          `This takes ${actor.name}'s <strong>whole turn</strong> (all 6 AP).`);
      }
      actor.update({ "system.ap.value": 0 });
      ui.notifications.info(`${actor.name} spends their turn ${equip ? "putting on" : "removing"} ${item.name}.`);
    }
    if (others.length) actor.updateEmbeddedDocuments("Item", others.map(i => ({ _id: i.id, "system.equipped": false })), { flowstateAuto: true });
    return;
  }

  /* ---- Foci / Shrouds: attuning takes an hour (not in combat), one of each at a time ---- */
  if (item.type === "foci" || item.type === "shroud") {
    const attune = changed(changes, "system.attuned");
    if (attune !== undefined && attune !== item.system.attuned) {
      if (attune && inCombat && !options?.flowstateFociMaster) return refuse(item, `Attuning to ${item.name} takes an hour, so it can't be done in combat.`);
      if (attune) {
        const others = actor.items.filter(i => i.type === item.type && i.id !== item.id && i.system.attuned);
        if (others.length) actor.updateEmbeddedDocuments("Item", others.map(i => ({ _id: i.id, "system.attuned": false })), { flowstateAuto: true });
      }
      if (!attune && item.type === "shroud") setTimeout(() => actions.endShroudPlacement(actor, item), 0);
    }
    if (item.type === "shroud") return;
  }

  /* ---- Icons: attuning takes 6 AP in combat (the Action List does it); out of combat it's free. One at a time. ---- */
  if (item.type === "icon") {
    const attune = changed(changes, "system.attuned");
    if (attune !== undefined && attune !== item.system.attuned) {
      if (attune && inCombat && !auto && !options?.flowstateAttune) return refuse(item, `Attuning to ${item.name} takes AP in combat: use "Attune ${item.name}" in the Action List.`);
      if (attune) {
        const others = actor.items.filter(i => i.type === "icon" && i.id !== item.id && i.system.attuned);
        if (others.length) actor.updateEmbeddedDocuments("Item", others.map(i => ({ _id: i.id, "system.attuned": false })), { flowstateAuto: true });
      }
    }
    return;
  }

  /* ---- Weapons: at most two hands.
     In combat: drawing into an empty hand costs 1 RP; swapping (putting a weapon away to draw another) costs 1 AP.
     Putting a weapon away and raising/lowering fists are free. ---- */
  if (!HELD_TYPES.has(item.type)) return;
  const next = {
    equipped: changed(changes, "system.equipped") ?? item.system.equipped,
    secondHand: changed(changes, "system.secondHand") ?? item.system.secondHand,
    twoHanded: changed(changes, "system.twoHanded") ?? item.system.twoHanded,
    weaponType: changed(changes, "system.weaponType") ?? item.system.weaponType
  };
  // Stowing a held weapon in combat costs 1 AP (dropping it instead is free).
  const stowing = next.weaponType !== "unarmed" && !next.equipped && item.system.equipped;
  if (stowing && !auto && !options?.flowstatePaid && actions.inActiveCombat(actor)) {
    stowOrDrop(item, changes);
    return false;
  }

  const drawing = next.weaponType !== "unarmed" && next.equipped && !item.system.equipped;
  if (drawing && !auto && !options?.flowstatePaid) {
    const swap = weaponHandsUsed(actor, item.id) + (next.twoHanded ? 2 : 1) > 2;
    if (swap || actions.inActiveCombat(actor)) {
      drawOrSwap(item, changes, swap);
      return false;
    }
  }

  const need = handsFor(next);
  const used = handsUsed(actor, item.id);
  let over = used + need - 2;
  let lower = null;
  if (need && over > 0) {
    // Raised fists are empty hands: lower them to make room.
    const fists = next.weaponType !== "unarmed" && actor.items.find(i => i.type === "weapon" && i.id !== item.id && i.system.weaponType === "unarmed");
    if (fists) {
      lower = {};
      if (fists.system.secondHand && over > 0) { lower["system.secondHand"] = false; over--; }
      if (fists.system.equipped && over > 0) { lower["system.equipped"] = false; over--; }
    }
    if (over > 0) {
      return refuse(item, next.weaponType === "unarmed"
        ? `${actor.name} has no free hand.`
        : `${item.name} can't be two-handed while another weapon is held.`);
    }
  }
  if (lower) actor.items.find(i => i.type === "weapon" && i.id !== item.id && i.system.weaponType === "unarmed")
    .update(lower, { flowstateAuto: true });
});

/** In combat, unequipping a weapon: stow it (1 AP, your turn) or drop it on the ground (free). */
async function stowOrDrop(item, changes) {
  const actor = item.actor;
  const data = foundry.utils.deepClone(changes);
  delete data._id;
  const esc = foundry.utils.escapeHTML;
  const canStow = isActorsTurn(actor) && actor.system.ap.value >= 1;
  const why = !isActorsTurn(actor) ? "only on your turn" : `needs 1 AP (${esc(actor.name)} has ${actor.system.ap.value})`;
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: `Put away ${item.name}?` },
    content: `<p>Stowing a weapon in combat costs <strong>1 AP</strong>${canStow ? ` (${esc(actor.name)} has ${actor.system.ap.value})` : ` — ${why}`}.
      Dropping it on the ground is free.</p>`,
    buttons: [
      ...(canStow ? [{ action: "stow", label: "Stow (1 AP)", icon: "fa-solid fa-box", default: true }] : []),
      { action: "drop", label: "Drop (free)", icon: "fa-solid fa-arrow-down" },
      { action: "cancel", label: "Cancel", icon: "fa-solid fa-xmark" }
    ],
    rejectClose: false
  });
  if (choice === "stow") {
    await actor.update({ "system.ap.value": actor.system.ap.value - 1 });
    await item.update(data, { flowstatePaid: true });
    return ui.notifications.info(`${actor.name} stows ${item.name} (1 AP).`);
  }
  if (choice === "drop") {
    if (await actions.dropItem(actor, item, null, { thrown: false })) return ui.notifications.info(`${actor.name} drops ${item.name}.`);
  }
  snapBack(item);
}

/** Hands occupied by held non-Unarmed weapons (fists are empty hands). */
function weaponHandsUsed(actor, excludeId = null) {
  return actor.items.reduce((n, i) => (HELD_TYPES.has(i.type) && i.id !== excludeId && i.system.weaponType !== "unarmed" && i.system.equipped
    ? n + (i.system.twoHanded ? 2 : 1) : n), 0);
}

/**
 * Drawing a weapon, with a confirmation that states the cost.
 * - Empty hand available (fists count as empty): 1 RP in combat.
 * - Hands full of weapons: a swap. Pick what to put away; 1 AP in combat (on your turn), free outside combat.
 */
async function drawOrSwap(item, changes, swap) {
  const actor = item.actor;
  const inCombat = actions.inActiveCombat(actor);
  const data = foundry.utils.deepClone(changes);
  delete data._id;
  const DialogV2 = foundry.applications.api.DialogV2;
  const esc = foundry.utils.escapeHTML;

  if (!swap) {
    const rp = actor.system.rp.value;
    if (rp < 1) return refuse(item, `${actor.name} needs 1 RP to draw ${item.name} into an empty hand and has none.`);
    const ok = await DialogV2.confirm({ window: { title: `Draw ${item.name}?` }, rejectClose: false,
      content: `<p>Drawing a weapon into an empty hand costs <strong>1 RP</strong> (${esc(actor.name)} has ${rp}).</p>` });
    if (!ok) return snapBack(item);
    await actor.update({ "system.rp.value": actor.system.rp.value - 1 });
    await item.update(data, { flowstatePaid: true });
    return ui.notifications.info(`${actor.name} draws ${item.name} (1 RP).`);
  }

  // Quick Change (Dexterity T3): swapping costs 1 RP instead of 1 AP (so it works off-turn too).
  const quick = ab.dexterity(actor, 3);
  const key = quick ? "rp" : "ap";
  if (inCombat) {
    if (!quick && !isActorsTurn(actor)) return refuse(item, `Swapping weapons costs 1 AP, so ${actor.name} can only do it on their turn.`);
    if (actor.system[key].value < 1) return refuse(item, `${actor.name} needs 1 ${key.toUpperCase()} to swap weapons and has none.`);
  }
  const held = actor.items.filter(i => HELD_TYPES.has(i.type) && i.id !== item.id && i.system.weaponType !== "unarmed" && i.system.equipped);
  const cost = inCombat ? `<strong>1 ${key.toUpperCase()}</strong>${quick ? " (Quick Change)" : ""} (${esc(actor.name)} has ${actor.system[key].value})` : "nothing outside combat";
  const choice = await DialogV2.prompt({
    window: { title: `Swap to ${item.name}?` }, rejectClose: false,
    content: `<div class="flowstate-dialog"><p>Your hands are full. Swapping weapons costs ${cost}.</p>
      <div class="form-group"><label>Put away</label><select name="putAway">
        ${held.map(i => `<option value="${i.id}">${esc(i.name)}${i.system.twoHanded ? " (two-handed)" : ""}</option>`).join("")}
      </select></div>
      <p class="hint">Anything else needed to free enough hands is put away too.</p></div>`,
    ok: { label: "Swap", icon: "fa-solid fa-right-left", callback: (event, button) => button.form.elements.putAway.value }
  });
  if (!choice) return snapBack(item);
  if (inCombat) await actor.update({ [`system.${key}.value`]: actor.system[key].value - 1 });

  // Put away the chosen weapon, then anything else still in the way.
  const quiet = { flowstateAuto: true };
  await actor.items.get(choice)?.update({ "system.equipped": false }, quiet);
  const need = data.system?.twoHanded ?? item.system.twoHanded ? 2 : 1;
  for (const other of held) {
    if (weaponHandsUsed(actor, item.id) + need <= 2) break;
    if (other.system.equipped) await other.update({ "system.equipped": false }, quiet);
  }
  await item.update(data, { flowstatePaid: true });
  ui.notifications.info(`${actor.name} swaps to ${item.name}${inCombat ? ` (1 ${key.toUpperCase()})` : ""}.`);
}

const ARMOR_LABEL = item => martial.ARMOR_WEIGHTS[item.system.weight]?.label ?? "That";

/** Items added to an actor (dragged in, duplicated) start unequipped if they'd break the limits. */
Hooks.on("preCreateItem", (item) => {
  const actor = item.parent;
  if (!(actor instanceof Actor) || !(item.system?.equipped || item.system?.secondHand)) return;
  const over = item.type === "armor"
    ? actor.items.some(i => i.type === "armor" && i.system.equipped)
    : HELD_TYPES.has(item.type) && handsUsed(actor) + handsFor(item.system) > 2;
  if (over) item.updateSource(item.type === "weapon" ? { "system.equipped": false, "system.secondHand": false } : { "system.equipped": false });
});


/* -------------------------------------------- */
/*  Whose choice is a chat card waiting on?     */
/* -------------------------------------------- */

/** Push the two choice colors into CSS variables (per client). */
function applyChoiceColors() {
  const get = (k, d) => { try { return String(game.settings.get("flowstate", k) || d); } catch (err) { return d; } };
  const root = document.documentElement.style;
  root.setProperty("--fs-attacker-color", get("attackerChoiceColor", "#c0392b"));
  root.setProperty("--fs-defender-color", get("defenderChoiceColor", "#2e6fd1"));
}
Hooks.once("ready", applyChoiceColors);

/**
 * After a card is decorated, tint it by who still has to act: rows tagged data-role="attacker"/"defender" that still
 * hold a button (or a "Waiting for…" note) are pending. Both pending → split border.
 */
Hooks.on("renderChatMessageHTML", (message, html) => {
  const roles = new Set();
  for (const el of html.querySelectorAll("[data-role]")) {
    if (el.querySelector("button, [data-pending]")) roles.add(el.dataset.role);
  }
  html.classList.remove("fs-choice-attacker", "fs-choice-defender", "fs-choice-both");
  if (roles.has("attacker") && roles.has("defender")) html.classList.add("fs-choice-both");
  else if (roles.has("attacker")) html.classList.add("fs-choice-attacker");
  else if (roles.has("defender")) html.classList.add("fs-choice-defender");
});

/* -------------------------------------------- */
/*  Grapples end when the grappler goes down     */
/* -------------------------------------------- */

Hooks.on("createActiveEffect", async effect => {
  if (!game.user.isActiveGM) return;
  const actor = effect.parent;
  if (!(actor instanceof Actor) || !(effect.statuses?.has("unconscious") || effect.statuses?.has("dead"))) return;
  // Downed creatures leave initiative.
  for (const combat of game.combats ?? []) {
    const ids = combat.combatants.filter(c => c.actor === actor || c.actor?.uuid === actor.uuid).map(c => c.id);
    if (ids.length) await combat.deleteEmbeddedDocuments("Combatant", ids);
  }
  const victims = actions.grappledBy(actor);
  if (!victims.length) return;
  for (const v of victims) await actions.setGrapple(v, null);
  ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="flowstate-card"><header class="fs-card-title">Grapple released</header><div class="fs-notes">${foundry.utils.escapeHTML(actor.name)} is ${effect.statuses.has("dead") ? "dead" : "unconscious"}: ${victims.map(v => foundry.utils.escapeHTML(v.name)).join(", ")} ${victims.length === 1 ? "is" : "are"} no longer grappled.</div></div>` });
});


/* -------------------------------------------- */
/*  Rituals: max Energy loss and dependent effects */
/* -------------------------------------------- */

/** A Ritual is an Active Effect on the caster that lowers max Energy. When it ends, the spell effects tied to it end too. */
Hooks.on("deleteActiveEffect", async effect => {
  if (!game.user.isActiveGM || !effect.flags?.flowstate?.ritual) return;
  const actor = effect.parent;
  if (actor instanceof Actor) setTimeout(() => actions.refillEnergy(actor), 0);
  const tied = [];
  for (const a of game.actors) for (const e of a.effects) if (e.flags?.flowstate?.ritualOf === effect.uuid) tied.push(e);
  for (const t of canvas?.tokens?.placeables ?? []) if (!t.document.actorLink) for (const e of t.actor?.effects ?? []) if (e.flags?.flowstate?.ritualOf === effect.uuid) tied.push(e);
  for (const e of tied) await e.delete();
  await conjure.endRitual(effect.uuid);
});
Hooks.on("createActiveEffect", effect => {
  if (!game.user.isActiveGM || !effect.flags?.flowstate?.ritual || !(effect.parent instanceof Actor)) return;
  const actor = effect.parent;
  setTimeout(() => { const { value, max } = actor.system.energy; if (value > max) actor.update({ "system.energy.value": max }); }, 0);
});

/* -------------------------------------------- */
/*  Token size follows creature Size            */
/* -------------------------------------------- */

Hooks.on("updateActor", async (actor, changes, options, userId) => {
  if (userId !== game.user.id || actor.type === "pile") return;
  const size = foundry.utils.getProperty(changes, "system.size");
  if (size === undefined) return;
  const sq = tokenSquares(size);
  if (actor.isToken) return actor.token?.update({ width: sq, height: sq });
  await actor.update({ "prototypeToken.width": sq, "prototypeToken.height": sq });
  for (const t of actor.getActiveTokens(false, true)) if (t.isOwner) await t.update({ width: sq, height: sq });
});

/* -------------------------------------------- */
/*  Ammunition: at most 100 per type            */
/* -------------------------------------------- */

const ammoTotal = (actor, type, excludeId = null) => actor.items.filter(i => i.type === "gear" && i.id !== excludeId && i.system.ammoType === type)
  .reduce((n, i) => n + (i.system.quantity ?? 0), 0);

Hooks.on("preCreateItem", (item) => {
  const actor = item.parent;
  if (!(actor instanceof Actor) || item.type !== "gear" || !item.system?.ammoType) return;
  const have = ammoTotal(actor, item.system.ammoType);
  if (have + (item.system.quantity ?? 0) > actions.AMMO_MAX) {
    ui.notifications.warn(`${actor.name} can carry at most ${actions.AMMO_MAX} ${actions.ammoLabel(item.system.ammoType)} (has ${have}).`);
    return false;
  }
});

Hooks.on("preUpdateItem", (item, changes) => {
  const actor = item.parent;
  if (!(actor instanceof Actor) || item.type !== "gear") return;
  const type = changed(changes, "system.ammoType") ?? item.system.ammoType;
  const qty = changed(changes, "system.quantity") ?? item.system.quantity;
  if (!type || (qty <= item.system.quantity && type === item.system.ammoType)) return;
  const have = ammoTotal(actor, type, item.id);
  if (have + qty > actions.AMMO_MAX) {
    ui.notifications.warn(`${actor.name} can carry at most ${actions.AMMO_MAX} ${actions.ammoLabel(type)} (${have} in other stacks).`);
    return false;
  }
});


/* -------------------------------------------- */
/*  Scene setting: Lush biome (Emerald Affix)   */
/* -------------------------------------------- */

Hooks.on("renderSceneConfig", (app, html) => {
  try {
    const el = html instanceof HTMLElement ? html : html?.[0];
    if (!el || el.querySelector('[name="flags.flowstate.lush"]')) return;
    const scene = app.document ?? app.object;
    const group = document.createElement("div");
    group.className = "form-group";
    group.innerHTML = `<label>Lush biome (Flow State)</label><div class="form-fields"><input type="checkbox" name="flags.flowstate.lush" ${scene?.getFlag?.("flowstate", "lush") ? "checked" : ""}></div><p class="hint">Emerald Affixes treat this scene as a Lush biome.</p>`;
    const tab = el.querySelector('.tab[data-tab="basic"]') ?? el.querySelector(".tab") ?? el.querySelector("form");
    tab?.appendChild(group);
  } catch (err) { console.warn("flowstate | Lush biome setting not added", err); }
});
