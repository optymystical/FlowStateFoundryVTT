import { STATS, SIZES, SENSE_LEVELS, DAMAGE_TYPES, STAIN_VARIANTS } from "./rules.mjs";
import {
  WEAPON_TYPES, WEIGHTS, WEAPON_MATERIALS, ARMOR_WEIGHTS, ARMOR_MATERIALS, TAGS, THROW, RARITIES, materialsFor, describeTags, weaponProfile
} from "./martial.mjs";
import * as actions from "./actions.mjs";
import * as casting from "./casting.mjs";
import * as fociEngine from "./foci.mjs";
import * as conjureEngine from "./conjure.mjs";

/** Does this actor have a Summon with Sense Swap? */
const conjureHasSenseSwap = actor => (globalThis.game?.actors ?? []).some(a => a.flags?.flowstate?.summon?.owner === actor.uuid && a.flags.flowstate.summon.senseSwap);
import * as spells from "./spells.mjs";
import { FOCI_TYPES, SHROUD_TYPES, CASTING_FORMS, AFFIXES, AFFIX_RARITIES, ELEMENTS, sourceTypeChoices } from "./magic.mjs";
import * as skills from "./skills.mjs";
import { askImage } from "./pictures.mjs";
import * as ab from "./abilities.mjs";
import { parseEnergyCost, stripEnergyCost, energyFor, energySummary } from "./energy.mjs";

/** What an actor's Energy costs are computed from: stats, Skill Points, and held weapons. */
export function energyContext(actor) {
  const sys = actor.system;
  const weapons = actor.items.filter(i => i.type === "weapon" && i.system.held && i.system.profile?.valid && !i.system.broken)
    .map(i => ({ name: i.name, capped: i.system.profile.capped, unarmed: !!i.system.profile.unarmed }));
  return { effective: sys.derived.effective, skillPoints: sys.skills?.total ?? sys.skillPoints ?? 0, weapons };
}

/** Extra detail for system statuses on the Misc tab's Active Effects list. */
const STATUS_DETAIL = {
  psychedUp: "Advantage on your attack rolls; attacks against you have Advantage. Ends at the start of your next turn.",
  calmedDown: "Advantage on your dodge rolls; your attack rolls have Disadvantage. Ends at the start of your next turn.",
  prone: "Dodge rolls have Disadvantage; melee attacks against you have Advantage.",
  unconscious: "HP below the Pain Threshold (set automatically from HP).",
  limber: "Your next attack, dodge, or parry roll has Advantage (until your next turn).",
  carefulSteps: "No stealth penalty from Medium armor; 2 AP at the start of each of your turns in combat (lapses for the turn if you can't pay). Toggle any time.",
  berserk: "Light Striker attacks get Fast, Heavy Striker attacks get Solitary. Until the start of your next turn (can be maintained).",
  seeingRed: "Berserk upgraded to Fast+ / Solitary+; Disadvantage on all non-attack rolls.",
  unstoppable: "Advantage on rolls to block negative conditions and effects; stats count as twice as high to resist them. Until the start of your next turn.",
  properStance: "Assault weapon attacks have Solitary+ until the start of your next turn. Swapping weapons ends it.",
  fishy: "Moves as if in rough terrain (+1 AP) until the shooter's next turn (Like Shooting Fish).",
  taunted: "Compelled to attack the taunter until the start of their next turn. Repeat the check at the end of your turn or for 2 AP/RP.",
  quickened: "Movement speed doubled until the start of your next turn. Ends if you put armor on.",
  dead: "HP at 0 or below (set automatically from HP)."
};

/** Everything currently affecting the actor: statuses, other Active Effects, and creatures it is grappling. */
export function activeEffectRows(actor) {
  const rows = [];
  const seen = new Set();
  for (const effect of actor.effects ?? []) {
    if (effect.disabled) continue;
    const statuses = [...(effect.statuses ?? [])];
    const id = statuses[0] ?? null;
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    const cfg = id ? globalThis.CONFIG?.statusEffects?.find(e => e.id === id) : null;
    let detail = STATUS_DETAIL[id] ?? "";
    if (id === "grappled") {
      const by = actor.getFlag?.("flowstate", "grappledBy");
      const name = by ? globalThis.fromUuidSync?.(by)?.name : null;
      detail = `${name ? `By ${name}. ` : ""}Can't move. Break Free (2 AP) from the Action List.`;
    }
    if (!id && (effect.flags?.flowstate?.spellEffect || effect.flags?.flowstate?.ritual)) detail = String(effect.description ?? "").replace(/<[^>]+>/g, "");
    rows.push({
      key: id ?? effect.id, status: id ?? "", effectId: effect.id,
      name: globalThis.game?.i18n?.localize?.(cfg?.name ?? effect.name) ?? cfg?.name ?? effect.name, img: cfg?.img ?? effect.img, detail
    });
  }
  const mark = actor.getFlag?.("flowstate", "markedBy");
  if (mark) rows.push({ key: "marked", name: `Marked by ${mark.name}`, img: "icons/svg/target.svg",
    detail: "Attacking, acting, or moving lets them shoot you first.", markedBy: true });
  // Active Parries (Martial Theory T1, Dip/Shatter, Brace): until the start of the actor's next turn.
  for (const [key, e] of Object.entries(actor.getFlag?.("flowstate", "parrying") ?? {})) {
    if (!e) continue;
    const item = e.item ? globalThis.fromUuidSync?.(e.item) : null;
    const name = e.style === "parry" ? `Parrying with ${item?.name ?? "a weapon"}` : e.style === "dip" ? "Dip" : e.style === "shatter" ? "Shatter" : `Brace${e.harden ? " (Hardened)" : ""}`;
    rows.push({ key: `parry-${key}`, name, img: "icons/svg/shield.svg", detail: "Until the start of your next turn.", parryKey: key });
  }
  const placed = actor.getFlag?.("flowstate", "shroudOn");
  const placedShroud = placed ? globalThis.fromUuidSync?.(placed) : null;
  if (placedShroud?.system?.placedOn === actor.uuid) {
    rows.push({ key: "shroudOn", name: `${placedShroud.parent?.name ?? "Someone"}'s ${placedShroud.system.shroudType === "ward" ? "Ward" : "Bond"}: ${placedShroud.name}`,
      img: "icons/svg/aura.svg", detail: `Soaks your damage too (${placedShroud.system.durability.value}/${placedShroud.system.durability.max} Durability).`, shroudOn: true });
  }
  for (const victim of actions.grappledBy(actor)) {
    rows.push({ key: `grappling-${victim.uuid}`, name: `Grappling ${victim.name}`, img: "icons/svg/net.svg",
      detail: "Release (free) or Throw (2 AP) from the Action List.", release: victim.uuid });
  }
  return rows;
}

/** Weapon trees: which weapons their abilities work with (Weapon Master adds a multi-type weapon's other types). */
function weaponTreeNote(tree, state) {
  const type = skills.weaponTypeOfTree(tree?.id);
  if (!type) return "";
  const label = WEAPON_TYPES[type]?.label ?? type;
  return skills.tierOf(state, "martial-theory") >= 5
    ? `These abilities work with weapons that have the ${label} type, including multi-type weapons (Weapon Master).`
    : `These abilities work with ${label} weapons (a multi-type weapon's main type). Martial Theory Tier 5 (Weapon Master) adds its other types.`;
}

/** A tree entry with its Energy cost pulled out into a badge (formula + this actor's value). */
export function withEnergy(entry, ctx) {
  const cost = parseEnergyCost(entry.text);
  if (!cost) return entry;
  return { ...entry, text: stripEnergyCost(entry.text),
    energy: { formula: cost.short, value: energySummary(energyFor(cost, ctx)), tip: `Energy equal to ${cost.phrase}. Free outside combat.` } };
}

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2, ItemSheetV2 } = foundry.applications.sheets;

/** "Fast+, Pierce" style tag list from a profile. */
export function tagList(tags = {}) {
  return Object.entries(tags).map(([k, v]) => `${TAGS[k] ?? k}${v === 2 ? "+" : ""}`).join(", ");
}

/** Tiers whose rules are automated, with where to find them (shown as a badge in the Skills tab). */
const AUTOMATED = {
  "martial-constitution-methods": {
    1: "One With Body is information for you and the GM (nothing to roll).",
    2: "Taunt is in the Action List (Constitution Methods); the Taunted creature repeats the check at the end of its turn automatically.",
    3: "Pure Body: resisting effects isn't automated yet; the GM applies it.",
    4: "Pull Aggro is in the Action List (Constitution Methods).",
    5: "Imposing Presence: already-Weakened attacks from within your personal melee range are Weakened again (automatic)."
  },
  "martial-curved-weapons": {
    1: "Disarm is an option in a Curved weapon's attack dialog (one target holding something).",
    2: "Perfect Parry appears on attack cards while a Curved weapon is Parrying (roll with Advantage; a miss means it doesn't apply).",
    3: "Momentum buttons appear on the defense card after a Curved hit; it's applied to later Curved attacks automatically.",
    4: "Sheath Weapon is in the Action List (Curved Weapons) at the end of your turn.",
    5: "Omnislash is an option when a target has 4+ Momentum."
  },
  "martial-longshot-weapons": {
    1: "Prepared Shot is an option in a Longshot weapon's attack dialog.",
    2: "Like Shooting Fish is an option in the attack dialog.",
    3: "Snipe Hunt is an option in the attack dialog.",
    4: "In a Barrel: Advantage against targets with a movement penalty (automatic).",
    5: "Headshot is a Prepared Shot choice."
  },
  "martial-titanic-armor": {
    1: "Giga Brace is in the Action List (Parry) while you wear Titanic armor (−2× CON).",
    2: "Bodyslam is in the Action List (Titanic Armor), with Disadvantage.",
    3: "Harden is offered when you turn Giga Brace on.",
    4: "Trudge is in the Action List (Titanic Armor).",
    5: "Chunky: Pierce against your Titanic armor is halved (automatic)."
  },
  "martial-grappling-methods": {
    1: "Lock Down is in the Action List (Grappling Methods) while you're grappling someone.",
    2: "Disrupt is in the Action List: the grappled creature's next roll has Disadvantage.",
    3: "Big Hands: grapple up to one size larger, with Advantage (automatic).",
    4: "Stunlock: Disrupt is free on a Locked Down creature and covers all their rolls (automatic).",
    5: "Slam is in the Action List while you're grappling someone."
  },
  "martial-thrasher-weapons": {
    1: "Grapple is an option in a Thrasher weapon's attack dialog.",
    2: "Windup is an option in the attack dialog (as many as you like).",
    3: "Overshield Strike is an option in the attack dialog.",
    4: "Whirlygig: every two Windups add a Strengthened (automatic).",
    5: "Get Over Here! is an option in the attack dialog."
  },
  "martial-unarmored": {
    1: "Dash is in the Action List (Unarmored), and appears on attack cards against you as a reaction.",
    2: "Leap is in the Action List (Unarmored).",
    3: "Speedy: Dash costs no Energy, so its reaction is automatic: attacks against you are rolled with Disadvantage, and you can move for 1 RP after.",
    4: "Quicken is in the Action List (Unarmored).",
    5: "Unfettered: Advantage on dodges and no movement slows while unarmored (automatic)."
  },
  "martial-dexterity-methods": {
    1: "Fast Lips: Persuasion and Deception rolls against one targeted creature get Advantage automatically when your (size-scaled) Dexterity is higher.",
    2: "Shank is an option in the attack dialog of Light attacks (pick three).",
    3: "Quick Change: swapping weapons costs 1 RP instead of 1 AP (automatic).",
    4: "Spot Weakness is in the Action List (Dexterity Methods).",
    5: "Pinpoint Accuracy is an option on Light attacks with Pepper and on Fast/Solitary follow-ups with Disadvantage."
  },
  "martial-reach-weapons": {
    1: "Palisade: a Riposte card appears when a creature moves into your Reach weapon's range.",
    2: "Thrust is an option in a Reach weapon's attack dialog.",
    3: "Wall appears next to Palisade on its card.",
    4: "Twist appears on the damage card after direct damage with a Reach weapon.",
    5: "Impale appears next to Twist."
  },
  "martial-circular-weapons": {
    1: "What Goes Around is an option when throwing a Circular weapon; the return attack appears with the follow-ups.",
    2: "Pierce Through (Light) and Cut Through (Heavy) are options in the attack dialog.",
    3: "Let it Rip! is an option in the attack dialog.",
    4: "Shadow Wings: while stealthing, a Thrown Pierce/Cut Through gets both effects (automatic).",
    5: "Vector Assault: the return attack is made from half stealth (automatic)."
  },
  "martial-blast-weapons": {
    1: "Point Blank: dodges against your Blast attacks from within your personal melee range have Disadvantage (automatic).",
    2: "Cone Shot is an option on Area Blast attacks.",
    3: "Rip and Tear: dealing damage with a Blast weapon reloads it (automatic).",
    4: "Punch is an option in a Blast weapon's attack dialog.",
    5: "Execute is an option when every target is prone."
  },
  "martial-light-armor": {
    1: "Shift appears on incoming attack cards while you wear Light armor.",
    2: "Dash is in the Action List (Light Armor).",
    3: "Leap is in the Action List (Light Armor).",
    4: "Evade: Shift can be used twice against one attack (automatic).",
    5: "Breathing Room: the first Shift, Dash, and Leap each round are free (automatic)."
  },
  "martial-strength-methods": {
    1: "Intimidate: a Persuasion or Deception roll against one targeted creature notes when their counter roll has Disadvantage (size-scaled Strength check).",
    2: "Heave! is an option in the attack dialog of any Heavy attack.",
    3: "Crunch Time is an option when you Knockback, Push, Launch, or throw a grappled creature: the Force is matched against current HP.",
    4: "Ho! is an option when throwing a Heavy weapon that isn't a Good throw.",
    5: "Unstoppable is in the Action List (Strength Methods). Its resistance effects are shown as a status for the GM to apply."
  },
  "martial-striker-weapons": {
    1: "Rend is an option in a Striker weapon's attack dialog: object damage (after their Limit) is Strengthened.",
    2: "Berserk is in the Action List (Striker Weapons); a card at the start of your turn lets you maintain it.",
    3: "Shred: Rend is Strengthened twice against a single target (automatic).",
    4: "Seeing Red is in the Action List while Berserk; it applies Disadvantage to your non-attack rolls automatically.",
    5: "Blood and Iron: Striker Cleave left over after the objects' Limits also hits the creature (automatic)."
  },
  "martial-defender-weapons": {
    1: "Block: your held Defender weapons always Parry for free; allies within reach get a Block for them button on their attack cards.",
    2: "Shield Toss is an option in a Defender weapon's attack dialog (Throw mode).",
    3: "Sword and Board is an option when attacking with another weapon while holding a Defender weapon.",
    4: "Bounce appears on the defense card after a Shield Toss hits.",
    5: "Perfect Block appears on attack cards: roll against the attack to negate it (a miss means the shield doesn't apply)."
  },
  "martial-weighted-weapons": {
    1: "Controlled Swing (Light) and Wild Swing (Heavy) are options in a Weighted weapon's attack dialog.",
    2: "Spin is an option in a Weighted weapon's attack dialog.",
    3: "Wide Arc: tick Strafing in the attack dialog to get Farstrike.",
    4: "Smash is an option in the attack dialog (+5 × Scaling Stat Knockback Force).",
    5: "Crunch: against a prone target, Controlled and Wild Swing give both effects automatically."
  },
  "martial-assault-weapons": {
    1: "Quickload is offered when you attack with an empty Assault weapon.",
    2: "Take Aim is an option in an Assault weapon's attack dialog.",
    3: "Distracting Fire appears on Area attack cards against you while you hold an Assault weapon with the attacker in range.",
    4: "Cool Breath: Take Aim is free if you haven't moved this turn (you then can't move for the rest of it).",
    5: "Proper Stance is in the Action List (Assault Weapons); swapping weapons ends it."
  },
  "martial-heavy-armor": {
    1: "Brace is in the Action List (Parry) while you wear Heavy armor.",
    2: "Trudge is in the Action List (Heavy Armor): your next move ignores the armor's movement penalty.",
    3: "Bodyslam is in the Action List (Heavy Armor).",
    4: "Harden is offered when you turn Brace on (extra Energy; incoming attacks are also Weakened).",
    5: "Launch is an option in the Bodyslam dialog."
  },
  "martial-brawling-methods": {
    1: "Twin Fang (Light) is an option in the Unarmed attack dialog; Jab (Heavy) is an option on the Heavy Solitary follow-up.",
    2: "Dip and Shatter are in the Action List (Parry) while a fist is raised: turned on during your turn, active until your next turn (one hand at a time).",
    3: "Dragon Lash is a Heavy technique in the Unarmed attack dialog. Combo appears on a Brawling card after both hits of a Fast Unarmed set land.",
    4: "Kick Out is a Heavy technique in the Unarmed attack dialog. Redirect appears after you dodge a melee attack, or on the damage card when a Parry took all of it.",
    5: "Flow Like Water appears on the Brawling card after every hit of a Fast or Solitary Unarmed set lands."
  },
  "martial-medium-armor": {
    1: "Limber appears on the defense card after your attack hits or your dodge/parry succeeds (in Medium armor, in combat).",
    2: "Brace is in the Action List (Parry) while you wear Medium armor: active until your next turn.",
    3: "Careful Steps is a toggle in the Action List (Medium Armor), toggled any time.",
    4: "Shift appears on incoming attack cards while you wear Medium armor.",
    5: "Versatility is in the Action List (Medium Armor): a standing pick, changed once per turn in combat."
  },
  "martial-rapid-weapons": {
    1: "Quickload is offered when you attack with an empty Rapid weapon.",
    2: "Spin Down is an option in a Rapid weapon's attack dialog when you use Pepper.",
    3: "Mark is in the Action List (Rapid Weapons); a Mark card appears when the Marked creature acts or moves.",
    4: "Lead Blindness applies automatically to reactions against your Rapid attacks and to actions that trigger your Mark.",
    5: "Speedloader is offered next to Quickload."
  },
  "martial-swift-weapons": {
    1: "Cut Back (a Riposte, no Energy) appears on the defense card after you dodge while holding a Swift weapon.",
    2: "Quick Strike is an option in the attack dialog of a Swift weapon (carries to a Swift Fast follow-up).",
    3: "Blade Flurry appears on its own card when both attacks of a Fast Swift set land on the same target.",
    4: "Eviscerate is in the Action List (Swift Weapons) during your turn once your Swift attacks have dealt damage.",
    5: "Delta: at the end of your turn, 12+ landed Swift attacks restore 6 RP automatically."
  },
  "martial-balanced-weapons": {
    1: "Slip Off: a Parry with a Balanced weapon also Weakens incoming attacks (automatic).",
    2: "Spin Cycle is an option in the attack dialog of a Balanced weapon.",
    3: "Slice (Light) and Slam (Heavy) are options in the attack dialog of a Balanced weapon. Knockback gets a push button on the damage card; Bash breaks through armor or a parrying weapon.",
    4: "Deflect appears on the damage card when a parrying Balanced weapon took all of the damage.",
    5: "One with your Weapon adds a \"Both\" choice to Slice and Slam (double Energy)."
  },
  "martial-bladed-weapons": {
    1: "Whirlwind is an option in the attack dialog (Light Bladed weapons with Fast). Remise is an option on Solitary follow-ups (Heavy).",
    2: "Close Quarters appears as a button on melee attack cards against you.",
    3: "Blender: Light Bladed weapons count as Fast+, and Whirlwind gets a Blender option (2× Energy, Cleave).",
    4: "Titan Weapon: two-handed Heavy Bladed attacks offer a Solitary follow-up with Disadvantage.",
    5: "Perfect Riposte appears next to Riposte with a Bladed weapon."
  },
  "martial-theory": {
    0: "Attack, Grapple (Unarmed attack option), Break Free, Release, and Throw (weapons and grappled creatures) are automated. See the Action List.",
    1: "Parry is in the Action List (Parry): turned on during your turn for a held weapon, active until your next turn. Riposte appears on the damage card when a Parry left you with no direct damage.",
    2: "Psych Up is in the Action List (Martial Theory).",
    3: "Calm Down is in the Action List (Martial Theory).",
    4: "Automated: any Improvised weapons are removed when you reach this tier, and you can't pick new ones up. You use normal weapons instead.",
    5: "Automated: weapon tree abilities you've unlocked work with any weapon (e.g. Swift abilities with a Striker weapon). This applies to each weapon tree's abilities as they're automated."
  }
};

/** Sections collapsed the first time a sheet is opened (Checks is long, so it starts closed). */
const DEFAULT_COLLAPSED = ["act-checks"];
function collapsedFor(uuid) {
  if (!collapsedSections.has(uuid)) collapsedSections.set(uuid, new Set(DEFAULT_COLLAPSED));
  return collapsedSections.get(uuid);
}

/** Weapon rows for the sheet (and the Action List / Token Action HUD), with hands and display info. */
export function weaponRows(actor) {
  const d = actor.system.derived;
  // Hands: Unarmed uses one per raised fist; picking up a weapon lowers fists automatically.
  const isFist = i => i.system.weaponType === "unarmed";
  const handsOf = i => (isFist(i) ? 0 : i.system.twoHanded ? 2 : 1);
  const heldHands = i => (isFist(i) ? (i.system.equipped ? 1 : 0) + (i.system.secondHand ? 1 : 0) : i.system.equipped ? handsOf(i) : 0);
  const weaponItems = actor.items.filter(i => i.type === "weapon");
  // Held Foci take hands too.
  const fociHands = actor.items.filter(i => i.type === "foci" && i.system.equipped).reduce((n, i) => n + (i.system.twoHanded ? 2 : 1), 0);
  const totalHands = weaponItems.reduce((n, i) => n + heldHands(i), 0) + fociHands;
  const weaponHands = weaponItems.reduce((n, i) => n + (isFist(i) ? 0 : heldHands(i)), 0) + fociHands; // excludes fists
  const stats = { str: d.effective.str.value, dex: d.effective.dex.value };

  return weaponItems.map(i => {
    const p = i.system.profile;
    const fist = isFist(i);
    const row = {
      id: i.id, name: i.name, img: i.img, system: i.system, profile: p, unarmed: fist,
      damageType: p.valid ? DAMAGE_TYPES[p.damageType] : "",
      needsReload: p.valid && p.ranged && !i.system.loaded,
      canReload: p.valid && p.ranged,
      roundsText: p.valid && p.ranged ? `${i.system.rounds ?? 0}/${i.system.magazine ?? 1} loaded` : "",
      typesText: (i.system.types?.length ?? 0) > 1 ? i.system.types.map(k => WEAPON_TYPES[k]?.label ?? k).join("/") : "",
      canTwoHand: p.valid && !fist
    };
    if (fist) {
      const light = weaponProfile({ type: "unarmed", weight: "light" }, stats);
      const heavy = weaponProfile({ type: "unarmed", weight: "heavy" }, stats);
      const free = 2 - totalHands;
      Object.assign(row, {
        formula: `${light.formula} / ${heavy.display}`,
        ap: "2 / 3",
        tagGroups: [{ label: "L", tags: describeTags(light.tags) }, { label: "H", tags: describeTags(heavy.tags) }],
        fist1Blocked: !i.system.equipped && free < 1,
        fist2Blocked: !i.system.secondHand && free < 1,
        grappling: (() => {
          const held = ab.handGrapples(actor);
          if (!held.length) return "";
          return `${ab.freeFists(actor) ? "a fist is" : "no free fist:"} holding ${held.map(a => a.name).join(", ")} in a grapple`;
        })()
      });
    } else {
      const otherWeaponHands = weaponHands - heldHands(i);
      Object.assign(row, {
        formula: p.valid ? p.display : "",
        ap: p.ap,
        tagGroups: p.valid ? [{ label: "", tags: describeTags(p.tags) }] : [],
        equipBlocked: false,
        equipTip: i.system.equipped ? "Held (click to stow: 1 AP in combat, or drop it for free)"
          : otherWeaponHands + handsOf(i) > 2 ? "Swap to this weapon (1 AP in combat)" : "Draw into an empty hand (1 RP in combat)",
        twoHandBlocked: i.system.equipped && !i.system.twoHanded && otherWeaponHands > 0
      });
    }
    return row;
  });
}

const SHIELD_ORDERS = [
  { key: "default", label: "after parrying weapons, before the Shroud" }, { key: "afterShroud", label: "after the Shroud, before armor" },
  { key: "last", label: "after armor (last)" }, { key: "first", label: "before everything" }
];
const shieldOrderRows = actor => actions.spellEffects(actor, "shield").filter(e => e.flags.flowstate.spellEffect.adjust)
  .map(e => ({ id: e.id, name: e.name, label: SHIELD_ORDERS.find(o => o.key === (e.flags.flowstate.spellEffect.order ?? "default"))?.label }));

/** { coreId: name } for a select: the Core Spells this character knows (all of them when there is no owner). */
function coreChoices(trees) {
  const cores = trees ? spells.knownSpells(trees).cores : spells.CATALOG.filter(s => s.kind === "core");
  return { "": "— none —", ...Object.fromEntries(cores.map(c => [c.id, c.name])) };
}

/** Collapsed sections per actor (by UUID), kept for the session so re-renders don't reopen them. */
const collapsedSections = new Map();

/** Everything the character can do right now, grouped, with costs. Each entry reuses a sheet action. */
export function buildActionList(actor, weapons, stats) {
  // Only things that can be clicked to activate belong here: passives, reactions, and info rows are left out.
  return actionGroups(actor, weapons, stats)
    .map(g => ({ ...g, actions: g.actions.filter(a => a.action) }))
    .filter(g => g.actions.length);
}

function actionGroups(actor, weapons, stats) {
  const sys = actor.system;
  const d = sys.derived;
  const combat = [];
  for (const w of weapons) {
    if (!w.system.held || !w.profile.valid) continue;
    if (w.needsReload) {
      combat.push({ label: `Reload ${w.name}`, detail: `Must reload before attacking · loads ${w.system.magazine ?? 1}${actions.ammoRequired() ? ` · ${actions.ammoCount(actor, w.system.ammoType)} ${actions.ammoLabel(w.system.ammoType)} left` : ""}`,
        cost: `${w.profile.reloadRP} RP`, action: "reload", itemId: w.id, icon: "fa-solid fa-rotate" });
      continue;
    }
    combat.push({
      label: `Attack: ${w.name}`, itemId: w.id, action: "weaponAttack", icon: "fa-solid fa-khanda",
      detail: `${w.formula} ${w.damageType}${w.unarmed ? " (Light / Heavy)" : ""}`,
      cost: w.unarmed ? "2 / 3 AP" : `${w.profile.ap} AP`
    });
    if (w.canReload) combat.push({ label: `Reload ${w.name}`, detail: `Tops up to ${w.system.magazine ?? 1} (${w.system.rounds ?? 0} loaded)${actions.ammoRequired() ? ` · ${actions.ammoCount(actor, w.system.ammoType)} ${actions.ammoLabel(w.system.ammoType)} left` : ""}`,
      cost: `${w.profile.reloadRP} RP`, action: "reload", itemId: w.id, icon: "fa-solid fa-rotate" });
  }
  combat.push(
    { label: "Move", detail: `${sys.movement.speed} ft${sys.movement.multiplier > 1 ? ` ×${sys.movement.multiplier}` : ""}`, cost: `${sys.movement.ap} AP`, icon: "fa-solid fa-shoe-prints" }
  );

  // Posture (Ch9): crouch is free on your turn, going prone or standing up from prone costs 1 AP.
  const st = actor.statuses ?? new Set();
  const isProne = st.has("prone"), isCrouch = st.has("crouch");
  // Only offer the postures you aren't already in.
  if (!isCrouch && !isProne) combat.push({ label: "Crouch", detail: "Half size behind cover; rough terrain", cost: "Free",
    action: "posture", op: "crouch", icon: "fa-solid fa-person-praying" });
  if (!isProne) combat.push({ label: "Go Prone", detail: "Quarter size behind cover; melee attackers get Advantage", cost: "1 AP",
    action: "posture", op: "prone", icon: "fa-solid fa-person-falling" });
  if (isProne || isCrouch) combat.push({ label: "Get Up", detail: isProne ? "Stand up from prone" : "Stand up from a crouch", cost: isProne ? "1 AP" : "Free",
    action: "posture", op: "stand", icon: "fa-solid fa-person" });

  // Recover Energy is a combat action (Ignite, Stain, and Rest live on the Misc tab).
  combat.push({ label: "Recover Energy", detail: `+${d.energyRecover} (${sys.energy.value}/${sys.energy.max})`, cost: "1 AP", action: "recoverEnergy", icon: "fa-solid fa-bolt",
    disabled: sys.energy.value >= sys.energy.max });


  const checks = [
    { label: "Attack roll", detail: "Just the attack die", cost: `d${d.attackDie}`, action: "attack", icon: "fa-solid fa-hand-back-fist" },
    { label: "Dodge roll", detail: "Just the dodge dice", cost: `2d${d.dodgeDie}`, action: "dodge", icon: "fa-solid fa-person-running" },
    ...["Stealth", "Perception", "Persuasion", "Deception"].map(label => ({
      label, detail: label === "Perception" ? "Spot" : "", cost: "d100", action: "rollD100", rollLabel: label, icon: "fa-solid fa-dice-d20"
    }))
  ];

  // Martial Theory (automated tiers).
  const martial = [];
  const mt = actions.theoryTier(actor);
  const statuses = actor.statuses ?? new Set();
  const unarmed = weapons.find(w => w.unarmed && w.system.held);
  if (unarmed) martial.push({ label: "Grapple", detail: "Unarmed attack · Light: grapple only · Heavy: damage + grapple · your size or smaller",
    cost: "2 / 3 AP", action: "weaponAttack", itemId: unarmed.id, grapple: true, icon: "fa-solid fa-hands-holding" });
  if (statuses.has("grappled")) martial.push({ label: "Break Free", detail: "Attack roll vs the grappler's dodge", cost: "2 AP",
    action: "martial", op: "breakFree", icon: "fa-solid fa-link-slash" });
  const victims = actions.grappledBy(actor);
  if (victims.length) {
    martial.push(
      { label: "Release grapple", detail: victims.map(v => v.name).join(", "), cost: "Free", action: "martial", op: "release", icon: "fa-solid fa-hand" },
      { label: "Throw grappled creature", detail: `Force ${actions.grappleThrowForce(actor)} (10 × Str) · target who to hit`, cost: "2 AP",
        action: "martial", op: "throwGrappled", icon: "fa-solid fa-person-falling-burst" });
  }
  for (const [key, st] of Object.entries(actions.STANCES)) {
    if (mt < st.tier) continue;
    const active = statuses.has(st.status);
    const blocked = actions.stanceBlocked(actor, key);
    martial.push({ label: `${st.label}${active ? " (active)" : ""}`, detail: `${st.text} · until your next turn`, cost: "Your turn",
      energy: `${actions.stanceCost(actor)} Energy`, energyTip: "½ × Skill Points",
      action: "martial", op: key, icon: key === "psych" ? "fa-solid fa-fire" : "fa-solid fa-wind", disabled: !!blocked, tooltip: blocked });
  }

  // Parry (Martial Theory T1) and its variants: turned on during your turn, active until your next turn.
  const parryRows = [];
  const parrying = actor.getFlag?.("flowstate", "parrying") ?? {};
  const inCombatNow = actions.inActiveCombat(actor);
  const myTurnNow = inCombatNow && globalThis.game?.combat?.combatant?.actor?.uuid === actor.uuid;
  const turnBlock = inCombatNow && !myTurnNow ? "Only during your turn." : "";
  if (mt >= 1) {
    for (const w of actions.parryWeapons(actor)) {
      if (ab.defender(actor, w, 1)) continue;   // Defender weapons always Block
      const on = !!parrying[w.id];
      parryRows.push({ label: `Parry: ${w.name}${on ? " (active)" : ""}`, detail: `Its Limit ${w.system.profile.limit} and Durability apply to incoming melee/ranged attacks · until your next turn`,
        cost: "Your turn", energy: `${ab.parryCost(w)} Energy`, energyTip: "Scaling Stat (capped by Grade)", action: "martial", op: "parry", itemId: w.id,
        icon: "fa-solid fa-shield", disabled: on || !!turnBlock, tooltip: turnBlock });
    }
  }
  if (ab.brawl(actor, 2) && ab.fists(actor)) {
    for (const k of ["dip", "shatter"]) {
      const on = !!parrying[k];
      parryRows.push({ label: `${k === "dip" ? "Dip" : "Shatter"} (free hand)${on ? " (active)" : ""}`,
        detail: k === "dip" ? `Incoming melee/ranged damage −${ab.statValue(actor, "dex")} (DEX); at 0, move for 1 RP · one hand at a time` : "Each incoming hit takes your Heavy Unarmed damage first (×2 Solitary) · one hand at a time",
        cost: "Your turn", energy: `${ab.handParryCost(actor, k)} Energy`, energyTip: k === "dip" ? "DEX stat" : "STR stat", action: "martial", op: k,
        icon: k === "dip" ? "fa-solid fa-person-walking-arrow-right" : "fa-solid fa-hand-fist", disabled: on || !!turnBlock, tooltip: turnBlock });
    }
  }
  const braceI = ab.braceInfo(actor);
  if (braceI) {
    const on = !!parrying.brace;
    parryRows.push({ label: `${braceI.name}${on ? ` (active${parrying.brace.harden ? ", Hardened" : ""})` : ""}`, detail: `Incoming damage −${braceI.reduce} (CON${braceI.reduce > ab.statValue(actor, "con") ? " ×2" : ""})${braceI.harden !== null ? ` · Harden +${braceI.harden} Energy: also Weakened` : ""}`,
      cost: "Your turn", energy: braceI.cost ? `${braceI.cost} Energy` : "Free (Versatility)", energyTip: "CON (capped by armor Grade)", action: "martial", op: "brace",
      icon: "fa-solid fa-shield-heart", disabled: on || !!turnBlock, tooltip: turnBlock });
  }

  // Swift Weapons T4: Eviscerate (end of your turn).
  const swiftRows = [];
  if (ab.treeTier(actor, ab.SWIFT) >= 4 && ab.swiftHeld(actor, 4).length) {
    const blocked = actions.eviscerateBlocked(actor);
    const best = ab.swiftHeld(actor, 4).sort((a, b) => ab.scalingMin(b) - ab.scalingMin(a))[0];
    const dealt = actions.swiftDamageThisTurn(actor).reduce((n, h) => n + h.toHp, 0);
    swiftRows.push({ label: "Eviscerate", detail: `Repeat this turn's Swift damage (${dealt}), bypassing armor · end of your turn`, cost: "Once per turn",
      action: "martial", op: "eviscerate", icon: "fa-solid fa-droplet", disabled: !!blocked, tooltip: blocked,
      energy: best ? `${ab.SWIFT_COST.eviscerate(best)} Energy` : "hold a Swift weapon", energyTip: "2 × Scaling Stat min" });
  }

  // Medium Armor T3/T5 and Rapid Weapons T3.
  const mediumRows = [];
  const inFight = actions.inActiveCombat(actor) && !globalThis.game?.user?.isGM;
  const myTurn = inFight && globalThis.game?.combat?.combatant?.actor?.uuid === actor.uuid;
  // Medium Armor abilities only show while Medium armor is worn; weapon abilities only while a fitting weapon is held.
  const medWorn = ab.wearingMedium(actor);
  if (medWorn && ab.treeTier(actor, ab.MEDIUM) >= 3) {
    const on = st.has("carefulSteps");
    const lapsed = on && actor.getFlag?.("flowstate", "carefulLapsed");
    mediumRows.push({ label: `Careful Steps${on ? (lapsed ? " (lapsed)" : " (on)") : ""}`,
      detail: on ? `${lapsed ? "Resumes at the start of your next turn" : "No Medium armor stealth penalty"} · 2 AP at the start of each of your turns in combat · click to stop`
        : "Remove your Medium armor's stealth penalty · 2 AP at the start of each of your turns in combat",
      cost: on ? "Stop" : myTurn ? "2 AP" : "Start", action: "martial", op: "careful", icon: "fa-solid fa-shoe-prints" });
  }
  if (medWorn && ab.treeTier(actor, ab.MEDIUM) >= 5) {
    const v = actor.getFlag?.("flowstate", "versatility");
    const used = inFight && actor.getFlag?.("flowstate", "versatilityTurn") === actions.turnKey();
    const blocked = inFight && (!myTurn || used);
    mediumRows.push({ label: `Versatility${v ? ` (${v[0].toUpperCase() + v.slice(1)})` : " (not set)"}`,
      detail: `${v ? "Costs no Energy while wearing Medium armor" : "Pick Shift, Brace, or Limber to cost no Energy while wearing Medium armor"} · in combat, change once per turn on your turn`,
      cost: !inFight ? (v ? "Change" : "Set") : used ? "Changed" : myTurn ? "Once/turn" : "Your turn",
      action: "martial", op: "versatility", icon: "fa-solid fa-shuffle", disabled: blocked });
  }
  const rapidRows = [];
  const rapidW = ab.rapidHeld(actor, 3);
  if (ab.treeTier(actor, ab.RAPID) >= 3 && rapidW.length) {
    rapidRows.push({ label: "Mark", detail: "Target a creature in range: when it attacks, acts, or moves, shoot it (RP = attack AP)", cost: "Any time",
      action: "martial", op: "mark", icon: "fa-solid fa-crosshairs",
      energy: `${Math.min(...rapidW.map(ab.RAPID_COST.mark))} Energy`, energyTip: "Scaling Stat min" });
  }

  // T2 trees: Strength Methods, Striker, Assault, Heavy / Titanic Armor.
  const strengthRows = [];
  if (ab.strength(actor, 5)) {
    const on = st.has("unstoppable");
    strengthRows.push({ label: `Unstoppable${on ? " (active)" : ""}`, detail: "Advantage to block negative conditions; stats count double to resist them · until your next turn",
      cost: "Any time", energy: `${ab.STRENGTH_COST.unstoppable(actor)} Energy`, energyTip: "2 × STR min", action: "martial", op: "unstoppable",
      icon: "fa-solid fa-person-rays", disabled: on });
  }
  const strikerRows = [];
  const strikerW = ab.strikerHeld(actor, 2);
  if (ab.treeTier(actor, ab.STRIKER) >= 2 && strikerW.length) {
    const best = strikerW.sort((a, b) => ab.scalingMin(b) - ab.scalingMin(a))[0];
    const on = st.has("berserk");
    const blocked = actions.berserkBlocked(actor);
    strikerRows.push({ label: `Berserk${on ? " (active)" : ""}`, detail: "Light Striker attacks get Fast, Heavy get Solitary · until your next turn (can be maintained)",
      cost: "Start of turn", energy: `${ab.STRIKER_COST.berserk(best)} Energy`, energyTip: "Scaling Stat min", action: "martial", op: "berserk",
      icon: "fa-solid fa-fire", disabled: !!blocked, tooltip: blocked });
    if (ab.treeTier(actor, ab.STRIKER) >= 4) {
      const red = st.has("seeingRed");
      strikerRows.push({ label: `Seeing Red${red ? " (active)" : ""}`, detail: "While Berserk: Fast+ and Solitary+, but Disadvantage on non-attack rolls",
        cost: "While Berserk", energy: `${ab.STRIKER_COST.seeingRed(best)} Energy`, energyTip: "Scaling Stat min", action: "martial", op: "seeingRed",
        icon: "fa-solid fa-eye", disabled: !on || red, tooltip: !on ? "Only while Berserk." : "" });
    }
  }
  const assaultRows = [];
  const assaultW = ab.assaultHeld(actor, 5);
  if (ab.treeTier(actor, ab.ASSAULT) >= 5 && assaultW.length) {
    const blocked = actions.properStanceBlocked(actor);
    const best = assaultW.sort((a, b) => ab.scalingMin(b) - ab.scalingMin(a))[0];
    assaultRows.push({ label: `Proper Stance${st.has("properStance") ? " (active)" : ""}`, detail: "Assault attacks have Solitary+ until your next turn; swapping weapons ends it",
      cost: "Start of turn", energy: `${ab.ASSAULT_COST.properStance(best)} Energy`, energyTip: "2 × Scaling Stat min", action: "martial", op: "properStance",
      icon: "fa-solid fa-person-rifle", disabled: !!blocked, tooltip: blocked });
  }
  const armorRows = [];
  const trudge = ab.trudgeCost(actor);
  if (trudge !== null) {
    const ready = actor.getFlag?.("flowstate", "trudge");
    armorRows.push({ label: `Trudge${ready ? " (ready)" : ""}`, detail: "Your next move ignores your armor's movement penalty (1 AP base)",
      cost: "Before moving", energy: `${trudge} Energy`, energyTip: ab.wornWeight(actor) === "heavy" ? "¼ × CON min" : "½ × CON min", action: "martial", op: "trudge",
      icon: "fa-solid fa-person-walking", disabled: !!ready });
  }
  const slam = ab.bodyslamInfo(actor);
  if (slam) {
    const dmg = (actor.system.armor?.system.profile?.limit ?? 0) + ab.statMinOf(actor, "con");
    armorRows.push({ label: "Bodyslam", detail: `Attack a target in personal melee range${slam.net ? " (Disadvantage)" : ""} · ${dmg} Physical${slam.launch ? " or Launch (Force ×10)" : ""}`,
      cost: "3 AP", energy: `${slam.cost} Energy`, energyTip: "CON min", action: "martial", op: "bodyslam", icon: "fa-solid fa-person-falling-burst" });
  }
  const armorName = ab.wornWeight(actor) === "titanic" ? "Titanic Armor" : "Heavy Armor";
  // T3+: Dexterity Methods, Light Armor / Unarmored.
  const dexRows = [];
  if (ab.dexterity(actor, 4)) dexRows.push({ label: "Spot Weakness", detail: "Target a creature you sense: reveals its armor and stats to you", cost: "1 AP",
    energy: `${ab.DEXTERITY_COST.spotWeakness(actor)} Energy`, energyTip: "½ × DEX min", action: "martial", op: "spotWeakness", icon: "fa-solid fa-magnifying-glass" });
  const moveRows = [];
  const dashI = ab.dashInfo(actor), leapI = ab.leapInfo(actor);
  const slowed = Math.max(1, 1 + Math.max(0, sys.movement?.tempo ?? 0));
  if (dashI) moveRows.push({ label: "Dash", detail: `Move up to ${sys.movement?.speed ?? 0} ft right away, even off-turn`, cost: `${slowed} RP`,
    energy: dashI.cost ? `${dashI.cost} Energy` : "", energyTip: dashI.tree === "Light Armor" ? "½ × CON min" : "¼ × CON min", action: "martial", op: "dash", icon: "fa-solid fa-person-running" });
  if (leapI) moveRows.push({ label: "Leap", detail: `Jump: ${Math.floor((sys.movement?.speed ?? 0) / 5)} ft up, ${sys.movement?.speed ?? 0} ft across`, cost: `${slowed} AP`,
    energy: `${leapI.cost} Energy`, energyTip: leapI.tree === "Light Armor" ? "½ × CON min" : "¼ × CON min", action: "martial", op: "leap", icon: "fa-solid fa-person-skating" });
  const moveName = dashI?.tree ?? leapI?.tree ?? "Movement";
  if (ab.unarmoredT(actor, 4)) moveRows.push({ label: `Quicken${st.has("quickened") ? " (active)" : ""}`, detail: "Double your movement speed until your next turn", cost: "Start of turn",
    energy: `${ab.UNARMORED_COST.quicken(actor)} Energy`, energyTip: "CON min", action: "martial", op: "quicken", icon: "fa-solid fa-forward-fast", disabled: st.has("quickened") });
  // Constitution Methods / Grappling Methods / Curved Weapons.
  const conRows = [];
  if (ab.constitution(actor, 2)) conRows.push({ label: "Taunt", detail: "Contested Persuasion/Deception vs a creature within 100 ft: they must attack you until your next turn", cost: "2 RP",
    energy: `${ab.CONSTITUTION_COST.taunt(actor)} Energy`, energyTip: "CON min", action: "martial", op: "taunt", icon: "fa-solid fa-bullhorn" });
  if (ab.constitution(actor, 4)) conRows.push({ label: "Pull Aggro", detail: "Taunt every targeted creature within 30 ft", cost: "2 RP",
    energy: `${ab.CONSTITUTION_COST.pullAggro(actor)} Energy`, energyTip: "CON stat", action: "martial", op: "pullAggro", icon: "fa-solid fa-users-viewfinder" });
  const taunted = actor.getFlag?.("flowstate", "tauntedBy");
  if (taunted) conRows.push({ label: "Shake off Taunt", detail: `Repeat the check against ${taunted.name} (they get another Disadvantage)`, cost: "2 AP / RP",
    action: "martial", op: "shakeTaunt", icon: "fa-solid fa-hand" });
  const grappleRows = [];
  const held = actions.grappledBy(actor);
  if (ab.grappling(actor, 1) && held.length) grappleRows.push({ label: "Lock Down", detail: "A grappled creature is forced prone and can't move; escaping takes two tries", cost: "Any time",
    energy: `${ab.GRAPPLING_COST.lockDown(held[0])} Energy`, energyTip: "grappled target's STR stat", action: "martial", op: "lockDown", icon: "fa-solid fa-lock" });
  if (ab.grappling(actor, 2) && held.length) grappleRows.push({ label: "Disrupt", detail: "Your grappled creature's next roll has Disadvantage (every roll while Locked Down, with Stunlock)", cost: "Any time",
    energy: `${ab.GRAPPLING_COST.disrupt(held[0])} Energy`, energyTip: "grappled target's STR min", action: "martial", op: "disrupt", icon: "fa-solid fa-hand-back-fist" });
  if (ab.grappling(actor, 5) && held.length) grappleRows.push({ label: "Slam", detail: `Swing a grappled creature at a target: Force ${10 * (sys.derived.effective.str.value ?? 0)} at 0 ft`, cost: "2 / 3 AP",
    action: "martial", op: "slam", icon: "fa-solid fa-person-falling-burst" });
  const curvedRows = [];
  if (ab.treeTier(actor, ab.CURVED) >= 4 && ab.curvedHeld(actor, 4).length) {
    const blocked = actions.sheathBlocked(actor);
    const best = ab.curvedHeld(actor, 4).sort((a, b) => ab.scalingMin(b) - ab.scalingMin(a))[0];
    const dealt = actions.curvedDamageThisTurn(actor).reduce((n, h) => n + h.toHp, 0);
    curvedRows.push({ label: "Sheath Weapon", detail: `Repeat this turn's direct Curved damage (${dealt}) doubled, through armor · end of your turn`, cost: "Once per turn",
      energy: `${ab.CURVED_COST.sheath(best)} Energy`, energyTip: "2 × Scaling Stat min", action: "martial", op: "sheath", icon: "fa-solid fa-khanda", disabled: !!blocked, tooltip: blocked });
  }

  // Magic Shroud actions (melded Shroud only).
  const shroudRows = [];
  const shr = sys.shroud;
  if (shr?.system.profile?.placed) {
    const ward = shr.system.shroudType === "ward";
    const on = shr.system.placedOn ? globalThis.fromUuidSync?.(shr.system.placedOn)?.name : null;
    shroudRows.push({ label: `${ward ? "Ward" : "Bond"}: ${shr.name}${on ? ` (on ${on})` : ""}`, detail: ward
      ? "Place it on your target within 100 ft (or yourself with no target) until your next turn; restores its Durability"
      : "Also protect your target within 100 ft; restores its Durability", cost: ward ? "2 RP" : "3 RP", action: "martial", op: "placeShroud", icon: "fa-solid fa-ghost" });
  }
  if (shr?.system.profile?.affixes?.includes("hematite") && shr.system.wear > 0) {
    shroudRows.push({ label: `Hematite: refill ${shr.name}`, detail: `Restore its Durability to ${shr.system.durability.max}`, cost: `${Math.floor(sys.skillPoints / 2)} HP`,
      action: "martial", op: "hematite", icon: "fa-solid fa-droplet" });
  }

  // Magic: casting a spell (the dialog picks the Core Spell(s), Mods, and how to cast).
  const magicRows = [];
  for (const e of Array.from(actor.effects ?? []).filter(x => !x.disabled && x.flags?.flowstate?.spellEffect?.kind === "held")) {
    const h = e.flags.flowstate.spellEffect;
    const myTurn = !actions.inActiveCombat(actor) || globalThis.game?.combat?.combatant?.actor?.uuid === actor.uuid;
    magicRows.push({ label: `Use ${e.name.toLowerCase()}`, detail: "Melee, no damage, AP only · until your next turn", cost: `${h.ap} AP`, action: "useHeld", itemId: e.id, icon: "fa-solid fa-hand-holding-fire", disabled: !myTurn, tooltip: myTurn ? "" : "Only on your turn" });
  }
  // Summoning: Sense Swap; Build Arcana: Reactive on/off.
  if (conjureHasSenseSwap(actor)) magicRows.push({ label: actor.getFlag?.("flowstate", "senseSwap") ? "Sense Swap: swap back" : "Sense Swap", detail: "Swap senses with your Summon: spells are cast from its position", cost: "2 RP", action: "senseSwap", icon: "fa-solid fa-eye" });
  if (ab.treeTier(actor, "magic-build-arcana") >= 2) magicRows.push({ label: actor.getFlag?.("flowstate", "reactiveOff") ? "Reactive: turn on" : "Reactive: turn off", detail: "Spend 1 RP to Weaken each damage instance that hits your Spells (automatic while on)", cost: "Free", action: "toggleReactive", icon: "fa-solid fa-shield-halved" });
  // Deck Foci (Chime, Cards): draw a card, or mulligan your hand.
  if (fociEngine.deckFoci(actor)) {
    const hand = fociEngine.handOf(actor).map(id => spells.spellById(id)?.name ?? id);
    const tenth = Math.floor((actor.system.energy?.max ?? 0) / 10);
    magicRows.push({ label: "Deck: draw a card", detail: `Hand: ${hand.join(", ") || "(empty)"}`, cost: `⚡ ${tenth}`, action: "deckDraw", icon: "fa-solid fa-clone" });
    magicRows.push({ label: "Deck: mulligan", detail: "Discard your whole hand and draw that many cards", cost: `⚡ ${2 * tenth}`, action: "deckMulligan", icon: "fa-solid fa-shuffle", disabled: !hand.length });
  }
  // Delayed spells (Restoration Arcana T4) waiting for their trigger.
  for (const e of actions.spellEffects(actor, "delayed")) magicRows.push({ label: `Trigger: ${e.name.replace(/^Delayed /, "")}`, detail: `Waiting for: ${e.flags.flowstate.spellEffect.trigger}`, cost: "Free (already paid)", action: "fireDelayed", itemId: e.id, icon: "fa-solid fa-hourglass-end" });
  // Grasp Arcana: Spirit Sense (T2) and Foci Master (T4).
  const grasp = ab.treeTier(actor, "magic-grasp-arcana");
  if (grasp >= 2) magicRows.push({ label: "Spirit Sense", detail: `Spot check for magical energy within ${grasp >= 4 ? 100 : 10} ft`, cost: "Check", action: "spiritSense", icon: "fa-solid fa-eye" });
  if (grasp >= 4 && actor.items.some(i => i.type === "foci" && !i.system.attuned)) magicRows.push({ label: "Foci Master: swap Foci", detail: "Attune to another Foci you carry (no hour needed)", cost: "2 AP", action: "swapFoci", icon: "fa-solid fa-arrows-rotate" });
  if (ab.treeTier(actor, "magic-build-arcana") >= 4 && actor.items.some(i => i.type === "shroud" && !i.system.attuned)) magicRows.push({ label: "Shroud Master: swap Shroud", detail: "Attune to another Shroud you carry (no hour needed)", cost: "2 AP", action: "swapShroud", icon: "fa-solid fa-arrows-rotate" });
  const cs = casting.castSummary(actor);
  if (cs.any) {
    const why = cs.usable ? "" : cs.ctx.options.map(o => `${o.label}: ${o.reason}`).join(" · ");
    magicRows.push({ label: "Cast Spell", detail: cs.usable ? `${cs.known.cores.map(c => c.name).join(", ")}` : why,
      cost: "AP/RP + Energy", action: "cast", icon: "fa-solid fa-wand-sparkles", disabled: !cs.usable, tooltip: why });
  }

  return [
    { key: "act-combat", name: "Combat", actions: combat },
    ...(magicRows.length ? [{ key: "act-magic", name: "Magic", actions: magicRows }] : []),
    ...(shroudRows.length ? [{ key: "act-shroud", name: "Shroud", actions: shroudRows }] : []),
    ...(parryRows.length ? [{ key: "act-parry", name: "Parry", actions: parryRows }] : []),
    ...(armorRows.length ? [{ key: "act-heavy", name: armorName, actions: armorRows }] : []),
    ...(moveRows.length ? [{ key: "act-move", name: moveName, actions: moveRows }] : []),
    ...(dexRows.length ? [{ key: "act-dex", name: "Dexterity Methods", actions: dexRows }] : []),
    ...(conRows.length ? [{ key: "act-con", name: "Constitution Methods", actions: conRows }] : []),
    ...(grappleRows.length ? [{ key: "act-grappling", name: "Grappling Methods", actions: grappleRows }] : []),
    ...(curvedRows.length ? [{ key: "act-curved", name: "Curved Weapons", actions: curvedRows }] : []),
    ...(strengthRows.length ? [{ key: "act-strength", name: "Strength Methods", actions: strengthRows }] : []),
    ...(strikerRows.length ? [{ key: "act-striker", name: "Striker Weapons", actions: strikerRows }] : []),
    ...(assaultRows.length ? [{ key: "act-assault", name: "Assault Weapons", actions: assaultRows }] : []),
    ...(mediumRows.length ? [{ key: "act-medium", name: "Medium Armor", actions: mediumRows }] : []),
    ...(rapidRows.length ? [{ key: "act-rapid", name: "Rapid Weapons", actions: rapidRows }] : []),
    ...(swiftRows.length ? [{ key: "act-swift", name: "Swift Weapons", actions: swiftRows }] : []),
    ...(martial.length ? [{ key: "act-martial", name: "Martial Theory", actions: martial }] : []),
    { key: "act-checks", name: "Checks", actions: checks }
  ];
}

/**
 * Run an Action List row without a sheet (Token Action HUD): the row's data-* values are passed to the same handler
 * the sheet button uses.
 */
export function runActionRow(actor, row) {
  const handler = FlowStateActorSheet.DEFAULT_OPTIONS.actions[row.action];
  if (!handler || row.disabled) return;
  const dataset = {};
  if (row.op) dataset.op = row.op;
  if (row.stat) dataset.stat = row.stat;
  if (row.rollLabel) dataset.label = row.rollLabel;
  if (row.condition) dataset.condition = row.condition;
  if (row.grapple) dataset.grapple = "true";
  if (row.itemId) dataset.itemId = row.itemId;
  const target = { dataset, closest: sel => (sel === "[data-item-id]" && row.itemId ? { dataset: { itemId: row.itemId } } : null) };
  return handler.call({ document: actor, actor }, new Event("click"), target);
}

/** Change a sheet's picture (owners only; see `askImage`: players browse through a connected GM). */
async function pickImage(event, target) {
  const doc = this.document;
  if (!this.isEditable) return;
  const field = target?.dataset?.edit || "img";
  const current = foundry.utils.getProperty(doc, field) ?? "";
  const url = await askImage(`Picture: ${doc.name}`, current);
  if (!url || url === current) return;
  const update = { [field]: url };
  // An actor's token art follows its portrait, unless the token was given its own picture.
  if (doc.documentName === "Actor" && field === "img") {
    const tex = doc.prototypeToken?.texture?.src;
    if (!tex || tex === current || tex === "icons/svg/mystery-man.svg") update["prototypeToken.texture.src"] = url;
  }
  await doc.update(update);
}

export class FlowStateActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["flowstate", "sheet", "actor"],
    position: { width: 780, height: 860 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      editImage: pickImage,
      rollStat: FlowStateActorSheet.onRollStat,
      rollD100: FlowStateActorSheet.onRollD100,
      attack: FlowStateActorSheet.onAttack,
      dodge: FlowStateActorSheet.onDodge,
      recoverEnergy: FlowStateActorSheet.onRecoverEnergy,
      cast: FlowStateActorSheet.onCast,
      spiritSense: FlowStateActorSheet.onSpiritSense,
      swapFoci: FlowStateActorSheet.onSwapFoci,
      swapShroud: FlowStateActorSheet.onSwapShroud,
      fireDelayed: FlowStateActorSheet.onFireDelayed,
      deckDraw: FlowStateActorSheet.onDeckDraw,
      senseSwap: FlowStateActorSheet.onSenseSwap,
      toggleReactive: FlowStateActorSheet.onToggleReactive,
      deckMulligan: FlowStateActorSheet.onDeckMulligan,
      useHeld: FlowStateActorSheet.onUseHeld,
      cycleShieldOrder: FlowStateActorSheet.onCycleShieldOrder,
      posture: FlowStateActorSheet.onPosture,
      rest: FlowStateActorSheet.onRest,
      clearCondition: FlowStateActorSheet.onClearCondition,
      createItem: FlowStateActorSheet.onCreateItem,
      editItem: FlowStateActorSheet.onEditItem,
      deleteItem: FlowStateActorSheet.onDeleteItem,
      weaponAttack: FlowStateActorSheet.onWeaponAttack,
      reload: FlowStateActorSheet.onReload,
      toggleField: FlowStateActorSheet.onToggleField,
      repair: FlowStateActorSheet.onRepair,
      spendStat: FlowStateActorSheet.onSpendStat,
      unlockTier: FlowStateActorSheet.onUnlockTier,
      lowerTier: FlowStateActorSheet.onLowerTier,
      martial: FlowStateActorSheet.onMartial,
      endEffect: FlowStateActorSheet.onEndEffect
    }
  };

  static PARTS = {
    header: { template: "systems/flowstate/templates/actor-header.hbs" },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    main: { template: "systems/flowstate/templates/actor-main.hbs", scrollable: [""] },
    skills: { template: "systems/flowstate/templates/actor-skills.hbs", scrollable: [""] },
    actions: { template: "systems/flowstate/templates/actor-actions.hbs", scrollable: [""] },
    equipment: { template: "systems/flowstate/templates/actor-equipment.hbs", scrollable: [""] },
    misc: { template: "systems/flowstate/templates/actor-misc.hbs", scrollable: [""] },
    notes: { template: "systems/flowstate/templates/actor-notes.hbs", scrollable: [""] }
  };

  /** Top-level tabs. More tabs can be added here (and as PARTS) later. */
  static TABS = {
    primary: {
      tabs: [
        { id: "main", label: "Main", icon: "fa-solid fa-user" },
        { id: "skills", label: "Skills", icon: "fa-solid fa-sitemap" },
        { id: "actions", label: "Action List", icon: "fa-solid fa-list-check" },
        { id: "equipment", label: "Equipment", icon: "fa-solid fa-shield-halved" },
        { id: "misc", label: "Misc", icon: "fa-solid fa-sliders" },
        { id: "notes", label: "Notes", icon: "fa-solid fa-feather" }
      ],
      initial: "main"
    }
  };

  /** Each tab part gets its own tab state as `tab`. */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (context.tabs?.[partId]) context.tab = context.tabs[partId];
    return context;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.tabs = this._prepareTabs("primary");
    const actor = this.document;
    const sys = actor.system;
    const d = sys.derived;

    const groups = {};
    for (const [key, meta] of Object.entries(STATS)) {
      (groups[meta.group] ??= { name: meta.group, stats: [] }).stats.push({ key, ...meta, ...d.effective[key] });
    }

    const moveNote = actor.statuses?.has("grappled") ? "Grappled — can't move"
      : sys.movement.multiplier > 1
      ? `${sys.movement.multiplier}× distance for 1 AP`
      : `${sys.movement.ap} AP per move`;

    const stats = { str: d.effective.str.value, dex: d.effective.dex.value };
    const weapons = weaponRows(actor);
    const totalHands = actor.items.filter(i => i.type === "weapon" || i.type === "foci").reduce((n, i) => n + (i.system.weaponType === "unarmed"
      ? (i.system.equipped ? 1 : 0) + (i.system.secondHand ? 1 : 0) : i.system.equipped ? (i.system.twoHanded ? 2 : 1) : 0), 0);
    const armor = actor.items.filter(i => i.type === "armor").map(i => ({
      id: i.id, name: i.name, img: i.img, system: i.system, profile: i.system.profile
    }));
    const affixNames = p => (p.affixes ?? []).map(k => AFFIXES[k]?.label).filter(Boolean).join(", ");
    const foci = actor.items.filter(i => i.type === "foci").map(i => {
      const p = i.system.profile;
      const handsFree = 2 - totalHands + (i.system.equipped ? (i.system.twoHanded ? 2 : 1) : 0);
      return { id: i.id, name: i.name, img: i.img, system: i.system, profile: p, affixText: p.valid ? affixNames(p) : "",
        statLabel: p.valid ? STATS[p.scalingStat]?.abbr ?? "" : "", trText: p.valid ? (p.tr ?? "1–3") : "",
        holdTip: i.system.equipped ? "Held (click to put away)" : "Hold it (a held item: uses a hand)",
        twoHandBlocked: !i.system.twoHanded && i.system.equipped && handsFree < 2 };
    });
    const shrouds = actor.items.filter(i => i.type === "shroud").map(i => {
      const p = i.system.profile;
      return { id: i.id, name: i.name, img: i.img, system: i.system, profile: p, affixText: p.valid ? affixNames(p) : "" };
    });

    const collapsed = collapsedFor(actor.uuid);
    const actionGroups = buildActionList(actor, weapons, stats).map(g => ({ ...g, open: !collapsed.has(g.key) }));
    const open = Object.fromEntries(["weapons", "armor", "foci", "shrouds", "misc"].map(k => [k, !collapsed.has(k)]));

    return Object.assign(context, {
      actor,
      system: sys,
      d,
      actionGroups,
      open,
      editable: this.isEditable,
      isGM: game.user.isGM,
      shieldRows: shieldOrderRows(actor),
      armorConditions: Object.entries(sys.armor?.system.conditions ?? {}).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k === "ignite" ? "Ignite" : STAIN_VARIANTS[k]?.label ?? k}`).join(" · "),
      showFocus: skills.tierOf(sys.trees, "magic-theory") >= 2,
      focusChoices: coreChoices(sys.trees),
      focusEditable: this.isEditable && !actions.inActiveCombat(actor),
      inCombat: actions.inActiveCombat(actor),
      creation: sys.creation,
      buildOpen: this.isEditable && (game.user.isGM || sys.creation),
      // Characters are always Size 3 until Ancestry exists; the GM can set NPC sizes.
      sizeEditable: this.isEditable && game.user.isGM && actor.type === "npc",
      canSpendStats: this.isEditable && !sys.creation && sys.unspentStats > 0,
      statPointsLabel: `${sys.unspentStats} stat point${sys.unspentStats === 1 ? "" : "s"}`,
      skillView: this.#skillContext(),
      statGroups: Object.values(groups),
      sizeChoices: Object.fromEntries(Object.keys(SIZES).map(k => [k, `Size ${k}`])),
      senseChoices: SENSE_LEVELS,
      moveNote,
      showOptional: game.settings.get("flowstate", "showOptionalFields"),
      hpState: sys.hp.destroyed ? "Body destroyed" : sys.hp.value <= 0 ? "Dead" : sys.hp.value < sys.hp.pain ? "Unconscious" : "",
      weapons,
      handsLabel: `${Math.max(0, 2 - totalHands)} of 2 hands free`,
      armor,
      foci,
      shrouds,
      wornArmor: sys.armor,
      gear: actor.items.filter(i => i.type === "gear").map(i => ({ id: i.id, name: i.name, img: i.img, system: i.system,
        ammoNote: i.system.ammoType ? `${WEAPON_TYPES[i.system.ammoType]?.label ?? i.system.ammoType} ammunition (max ${actions.AMMO_MAX})` : "" })),
      activeEffects: activeEffectRows(actor)
    });
  }

  /** Which Archetype and tree the Skills tab is showing (per open sheet). */
  skillSelection = { archetype: "martial", tree: null };

  #skillContext() {
    const sys = this.document.system;
    const state = sys.trees ?? {};
    const sel = this.skillSelection;
    const arch = skills.ARCHETYPES.find(a => a.id === sel.archetype) ?? skills.ARCHETYPES[0];
    const available = skills.treesFor(arch.id).filter(t => skills.isAvailable(state, t));
    if (!available.some(t => t.id === sel.tree)) sel.tree = available[0]?.id ?? null;
    const tree = skills.treeById(sel.tree);
    const current = tree ? skills.tierOf(state, tree.id) : 0;
    const inCombat = actions.inActiveCombat(this.document);
    const next = tree ? skills.nextTier(state, tree, sys.skills.unspent, { inCombat }) : null;
    const lockedCount = skills.treesFor(arch.id).length - available.length;
    const ectx = energyContext(this.document);
    return {
      archetypes: skills.ARCHETYPES.map(a => ({ ...a, selected: a.id === arch.id })),
      placeholder: arch.placeholder ?? "",
      trees: available.map(t => ({ id: t.id, selected: t.id === sel.tree,
        label: `${t.name} — Tier ${skills.tierOf(state, t.id)}/${skills.MAX_TIER}` })),
      weaponNote: weaponTreeNote(tree, state),
      lockedNote: lockedCount ? `${lockedCount} more tree${lockedCount === 1 ? "" : "s"} unlock as you raise ${skills.theoryFor(arch.id)?.name}.` : "",
      tree: tree && {
        id: tree.id, name: tree.name, current,
        tiers: tree.tiers.map(t => {
          const owned = t.tier <= current;
          const isNext = t.tier === current + 1;
          return {
            ...t, entries: t.entries.map(e => withEnergy(e, ectx)), owned, isNext, locked: !owned && !isNext,
            free: t.tier === 0,
            cost: t.tier, canUnlock: isNext && next?.ok && this.isEditable,
            reason: isNext ? next.reason : `Unlock Tier ${t.tier - 1} first.`,
            canLower: game.user.isGM && owned && t.tier === current && t.tier > 0,
            automated: AUTOMATED[tree.id]?.[t.tier] ?? "",
            automatedLabel: AUTOMATED[tree.id]?.[t.tier]?.startsWith("Passive") ? "Passive" : "Automated"
          };
        })
      },
      points: sys.skills,
      gmPoints: game.user.isGM && this.isEditable
    };
  }

  /** Track section collapse state; keep header buttons (e.g. +) from toggling the section. */
  _onRender(context, options) {
    super._onRender?.(context, options);
    // Skills tab selectors: view state only (not saved to the actor).
    this.element.querySelector(".fs-skill-arch")?.addEventListener("change", event => {
      event.stopPropagation();
      this.skillSelection = { archetype: event.target.value, tree: null };
      this.render();
    });
    this.element.querySelector(".fs-skill-tree")?.addEventListener("change", event => {
      event.stopPropagation();
      this.skillSelection.tree = event.target.value;
      this.render();
    });
    const uuid = this.document.uuid;
    for (const details of this.element.querySelectorAll("details.fs-collapse[data-section]")) {
      details.addEventListener("toggle", () => {
        const set = collapsedFor(uuid);
        if (details.open) set.delete(details.dataset.section);
        else set.add(details.dataset.section);
        collapsedSections.set(uuid, set);
      });
      for (const btn of details.querySelectorAll("summary button")) {
        btn.addEventListener("click", event => event.preventDefault());
      }
    }
  }

  static onRollStat(event, target) { return actions.rollStatCheck(this.document, target.dataset.stat); }
  static onRollD100(event, target) {
    return actions.rollD100(this.document, target.dataset.label, { apCost: Number(target.dataset.ap) || 0 });
  }
  static onAttack() { return actions.rollAttackCheck(this.document); }
  static onDodge() { return actions.rollDodge(this.document); }
  static onRecoverEnergy() { return actions.recoverEnergy(this.document); }
  static onCast() { return casting.castSpell(this.document); }
  static onSpiritSense() { return casting.spiritSense(this.document); }
  static onSwapFoci() { return casting.swapFoci(this.document); }
  static onSenseSwap() { return conjureEngine.toggleSenseSwap(this.document); }
  static async onToggleReactive() { const a = this.document; return a.getFlag("flowstate", "reactiveOff") ? a.unsetFlag("flowstate", "reactiveOff") : a.setFlag("flowstate", "reactiveOff", true); }
  static onDeckDraw() { return fociEngine.drawCard(this.document); }
  static onDeckMulligan() { return fociEngine.mulligan(this.document); }
  static onSwapShroud() { return casting.swapShroud(this.document); }
  static onFireDelayed(event, target) { return casting.fireDelayed(this.document, target.dataset.itemId ?? target.closest?.("[data-item-id]")?.dataset.itemId); }
  static onUseHeld(event, target) { return casting.useHeldSpell(this.document, target.dataset.itemId ?? target.closest?.("[data-item-id]")?.dataset.itemId); }
  /** Adjust (Protection Arcana T3): the holder chooses where their Shield sits in the order damage is absorbed. */
  static async onCycleShieldOrder(event, target) {
    const e = this.document.effects.get(target.dataset.effectId);
    if (!e) return;
    const i = SHIELD_ORDERS.findIndex(o => o.key === (e.flags.flowstate.spellEffect.order ?? "default"));
    await e.update({ "flags.flowstate.spellEffect.order": SHIELD_ORDERS[(i + 1) % SHIELD_ORDERS.length].key });
  }
  static onPosture(event, target) { return actions.setPosture(this.document, target.dataset.op); }
  static onRest() { return actions.rest(this.document); }
  static onClearCondition(event, target) { return actions.clearCondition(this.document, target.dataset.condition); }

  static #item(sheet, target) {
    return sheet.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
  }

  static onCreateItem(event, target) {
    const type = target.dataset.type ?? "gear";
    const name = { gear: "New Gear", weapon: "New Weapon", armor: "New Armor", foci: "New Foci", shroud: "New Shroud" }[type];
    const img = { foci: "icons/weapons/wands/wand-gem-purple.webp", shroud: "icons/magic/defensive/shield-barrier-glowing-blue.webp" }[type];
    return this.document.createEmbeddedDocuments("Item", [{ name, type, ...(img ? { img } : {}) }], { renderSheet: type !== "gear" });
  }
  static onEditItem(event, target) { FlowStateActorSheet.#item(this, target)?.sheet.render(true); }
  static onDeleteItem(event, target) {
    const item = FlowStateActorSheet.#item(this, target);
    if (item) return actions.dropOrDelete(this.document, item);
  }
  static onWeaponAttack(event, target) {
    const item = FlowStateActorSheet.#item(this, target);
    if (item) return actions.rollWeaponAttack(this.document, item, null, { grapple: target.dataset.grapple === "true" });
  }
  /** GM: end a status/effect (or release a grapple) from the Misc tab. */
  static async onEndEffect(event, target) {
    if (!game.user.isGM) return ui.notifications.warn("Only the GM can end effects manually.");
    const actor = this.document;
    const { status, effectId, release, marked, parryKey, shroudOn } = target.dataset;
    if (marked) return actor.unsetFlag("flowstate", "markedBy");
    if (shroudOn) {
      const sh = await fromUuid(actor.getFlag("flowstate", "shroudOn"));
      return sh ? actions.endShroudPlacement(sh.parent, sh) : actor.unsetFlag("flowstate", "shroudOn");
    }
    if (parryKey) return actor.unsetFlag("flowstate", `parrying.${parryKey}`);
    if (release) return actions.setGrapple(await fromUuid(release), null);
    if (status === "grappled") return actions.setGrapple(actor, null);
    if (status) return actor.toggleStatusEffect(status, { active: false });
    if (effectId) return actor.effects.get(effectId)?.delete();
  }
  static onMartial(event, target) {
    const actor = this.document;
    switch (target.dataset.op) {
      case "breakFree": return actions.breakFree(actor);
      case "release": return actions.releaseGrapple(actor);
      case "throwGrappled": return actions.throwGrappled(actor);
      case "psych": case "calm": return actions.useStance(actor, target.dataset.op);
      case "eviscerate": return actions.eviscerate(actor);
      case "careful": return actions.carefulSteps(actor);
      case "parry": return actions.startParry(actor, target.closest("[data-item-id]")?.dataset.itemId ?? target.dataset.itemId);
      case "dip": case "shatter": case "brace": return actions.startParry(actor, target.dataset.op);
      case "unstoppable": return actions.unstoppable(actor);
      case "berserk": return actions.berserk(actor);
      case "seeingRed": return actions.seeingRed(actor);
      case "properStance": return actions.properStance(actor);
      case "trudge": return actions.trudge(actor);
      case "bodyslam": return actions.bodyslam(actor);
      case "spotWeakness": return actions.spotWeakness(actor);
      case "quicken": return actions.quicken(actor);
      case "taunt": return actions.taunt(actor);
      case "pullAggro": return actions.taunt(actor, { aggro: true });
      case "shakeTaunt": return (async () => {
        const inFightNow = actions.inActiveCombat(actor);
        const pay = !inFightNow ? null : await foundry.applications.api.DialogV2.wait({ window: { title: "Shake off Taunt" }, rejectClose: false,
          content: "<p>Pay with:</p>", buttons: [{ action: "ap", label: "2 AP", default: true }, { action: "rp", label: "2 RP" }] });
        if (inFightNow && !pay) return;
        return actions.shakeTaunt(actor, { pay });
      })();
      case "lockDown": return actions.lockDown(actor);
      case "disrupt": return actions.disrupt(actor);
      case "slam": return actions.slamGrappled(actor);
      case "sheath": return actions.sheathWeapon(actor);
      case "dash": return actions.dash(actor);
      case "leap": return actions.leap(actor);
      case "versatility": return actions.versatility(actor);
      case "mark": return actions.markTarget(actor);
      case "placeShroud": return actions.placeShroud(actor);
      case "hematite": return actions.hematiteRefill(actor);
    }
  }
  static onReload(event, target) {
    const item = FlowStateActorSheet.#item(this, target);
    if (item) return actions.reloadWeapon(this.document, item);
  }
  static onToggleField(event, target) {
    const item = FlowStateActorSheet.#item(this, target);
    const field = target.dataset.field;
    if (item && field) return item.update({ [`system.${field}`]: !item.system[field] });
  }
  static onUnlockTier(event, target) { return actions.unlockTier(this.document, target.dataset.tree); }
  static onLowerTier(event, target) { return actions.lowerTier(this.document, target.dataset.tree); }
  static onSpendStat(event, target) { return actions.spendStatPoint(this.document, target.dataset.stat); }
  static onRepair(event, target) {
    if (!game.user.isGM) return ui.notifications.warn("Only the GM can repair equipment.");
    const item = FlowStateActorSheet.#item(this, target);
    if (item) return item.update({ "system.wear": 0 });
  }
}

export class FlowStateItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["flowstate", "sheet", "item"],
    position: { width: 480, height: 420 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: { editImage: pickImage }
  };

  static PARTS = {
    sheet: { template: "systems/flowstate/templates/item-sheet.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.document.actor;
    const identityOpen = this.isEditable && (game.user.isGM || !actor || actor.type === "pile" || actor.system?.creation);
    return Object.assign(context, {
      item: this.document, system: this.document.system,
      editable: identityOpen,                 // name, type, material, grade, description, wear
      stateEditable: this.isEditable,          // held, two-handed, loaded
      nameEditable: this.isEditable,           // owners can always rename their items
      lockedNote: this.isEditable && !identityOpen ? "Only the GM can modify this item (you can rename it and change its picture)." : "",
      isGear: this.document.type === "gear",
      ammoTypes: Object.fromEntries(Object.entries(WEAPON_TYPES).filter(([, v]) => v.ranged).map(([k, v]) => [k, `${v.label} weapons`]))
    });
  }
}

/** Dropdown builder for Martial weapons: Type → Weight → Material → Grade. */
export class FlowStateWeaponSheet extends FlowStateItemSheet {
  static DEFAULT_OPTIONS = { position: { width: 560, height: 640 } };
  static PARTS = { sheet: { template: "systems/flowstate/templates/weapon-sheet.hbs", scrollable: [""] } };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sys = this.document.system;
    const p = sys.profile;
    const group = ranged => Object.fromEntries(Object.entries(WEAPON_TYPES).filter(([, v]) => v.ranged === ranged).map(([k, v]) => [k, v.label]));
    const mat = WEAPON_MATERIALS[sys.material];
    return Object.assign(context, {
      p,
      meleeTypes: group(false),
      rangedTypes: group(true),
      weights: Object.fromEntries(Object.entries(WEIGHTS).map(([k, v]) => [k, `${v.label} (${STATS[v.stat].abbr}, ${v.ap} AP)`])),
      materials: materialsFor(WEAPON_MATERIALS, sys.weight),
      unarmed: sys.weaponType === "unarmed",
      improvised: sys.weaponType === "improvised",
      rarity: mat && !["unarmed", "improvised"].includes(sys.weaponType) ? RARITIES[mat.rarity] : "",
      tags: p.valid ? describeTags(p.tags) : [],
      materialName: sys.weaponType === "unarmed" ? "Unarmed" : sys.weaponType === "improvised" ? "Improvised" : mat?.label ?? "",
      damageType: p.valid ? DAMAGE_TYPES[p.damageType] : "",
      scalingLabel: p.valid ? STATS[p.scalingStat].label : "",
      farstrikeLabel: p.valid && p.farstrike > 1 ? `×${p.farstrike} (Farstrike${p.farstrike > 2 ? "+" : ""})` : "Normal",
      throwLabel: p.valid && p.throwType ? `${THROW[p.throwType].label} (${THROW[p.throwType].range} ft)` : "",
      owned: !!this.document.actor,
      hasAmmo: !!sys.ammoType,
      extraTypeChoices: ["unarmed", "improvised"].includes(sys.weaponType) ? []
        : Object.entries(WEAPON_TYPES).filter(([k]) => !["unarmed", "improvised", sys.weaponType].includes(k))
          .map(([k, v]) => ({ key: k, label: `${v.label}${v.ranged ? " (ranged)" : ""}`, on: (sys.extraTypes ?? []).includes(k) }))
    });
  }

  /** Extra-type checkboxes aren't named fields: collect them into system.extraTypes. */
  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    const boxes = [...form.querySelectorAll("input[data-extra-type]")];
    if (boxes.length && !boxes[0].disabled) foundry.utils.setProperty(data, "system.extraTypes", boxes.filter(b => b.checked).map(b => b.dataset.extraType));
    return data;
  }
}

/** Dropdown builder for Martial armor: Weight → Material → Grade. */
export class FlowStateArmorSheet extends FlowStateItemSheet {
  static DEFAULT_OPTIONS = { position: { width: 520, height: 560 } };
  static PARTS = { sheet: { template: "systems/flowstate/templates/armor-sheet.hbs", scrollable: [""] } };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sys = this.document.system;
    const p = sys.profile;
    const mat = ARMOR_MATERIALS[sys.material];
    const stealth = p.valid ? (p.stealthDis === Infinity ? "Auto-fail" : p.stealthDis ? `${p.stealthDis}× Disadvantage` : "None") : "";
    return Object.assign(context, {
      p,
      weights: Object.fromEntries(Object.entries(ARMOR_WEIGHTS).map(([k, v]) => [k, v.label])),
      materials: materialsFor(ARMOR_MATERIALS, sys.weight),
      rarity: mat ? RARITIES[mat.rarity] : "",
      materialName: mat?.label ?? "",
      stealth,
      effectiveWeight: p.valid ? ARMOR_WEIGHTS[p.effectiveWeight].label : "",
      owned: !!this.document.actor
    });
  }
}

/** Affix pick-list grouped by rarity, plus one slot row per Affix the item can hold. */
function affixContext(sys, p) {
  const choices = Object.entries(AFFIX_RARITIES).map(([r, label]) => ({
    label, options: Object.fromEntries(Object.entries(AFFIXES).filter(([, a]) => a.rarity === r).map(([k, a]) => [k, a.label]))
  }));
  const current = sys.affixes ?? [];
  const slots = Array.from({ length: p.affixSlots ?? 0 }, (_, i) => ({ n: i + 1, value: current[i] ?? "", info: AFFIXES[current[i]] ?? null }));
  return { affixChoices: choices, slots, hasTourmaline: p.affixes?.includes("tourmaline"), elements: ELEMENTS };
}

/** Affix slots aren't named form fields: collect them into system.affixes on submit. */
function collectAffixes(form, data) {
  const selects = [...form.querySelectorAll("select[data-affix-slot]")];
  if (selects.length && !selects[0].disabled) foundry.utils.setProperty(data, "system.affixes", selects.map(el => el.value).filter(Boolean));
  return data;
}

/** Magic Foci: Type (grouped by casting form) → Grade, attunement, held, Affix slots. */
export class FlowStateFociSheet extends FlowStateItemSheet {
  static DEFAULT_OPTIONS = { position: { width: 540, height: 640 } };
  static PARTS = { sheet: { template: "systems/flowstate/templates/foci-sheet.hbs", scrollable: [""] } };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sys = this.document.system;
    const p = sys.profile;
    const typeGroups = Object.entries(CASTING_FORMS).map(([form, f]) => ({
      label: f.label, options: Object.fromEntries(Object.entries(FOCI_TYPES).filter(([, t]) => t.form === form).map(([k, t]) => [k, t.label]))
    }));
    const statLabel = k => STATS[k]?.label ?? k;
    return Object.assign(context, {
      p, typeGroups,
      cap: (p.grade ?? 1) * 10,
      scalingLabel: p.valid ? (p.form === "multi" ? `Lesser of Reach and Grasp (${statLabel(p.scalingStat)})` : statLabel(p.scalingStat)) : "",
      trLabel: p.valid ? (p.tr === null || p.tr === undefined ? "1 / 2 / 3 (Raw Casting)" : String(p.tr)) : "",
      isRing: sys.fociType === "ring",
      hasOpal: p.valid && p.affixes?.includes("blackOpal") && p.affixPlus, opalChoices: { targeted: "Targeted", ranged: "Ranged" }, hasEmerald: p.valid && p.affixes?.includes("emerald"), hasColored: p.valid && p.affixes?.includes("coloredDiamond"),
      spellChoices: coreChoices(this.document.actor?.system?.trees),
      owned: !!this.document.actor,
      ...(p.valid ? affixContext(sys, p) : {})
    });
  }

  _processFormData(event, form, formData) {
    return collectAffixes(form, super._processFormData(event, form, formData));
  }
}

/** Magic Shroud: Type → Grade, attunement, Affix slots and their settings. */
export class FlowStateShroudSheet extends FlowStateItemSheet {
  static DEFAULT_OPTIONS = { position: { width: 540, height: 640 } };
  static PARTS = { sheet: { template: "systems/flowstate/templates/shroud-sheet.hbs", scrollable: [""] } };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sys = this.document.system;
    const p = sys.profile;
    const t = sys.shroudType;
    const limitNote = !p.valid ? "" : t === "cinder" ? `×3 (${p.baseLimit * 3}) against damage types you've already taken this turn`
      : t === "cistern" ? `${p.baseLimit} base: ×3 at full Energy, ×2 above half`
      : t === "ember" ? `${p.baseLimit} base: ×3 at or below half HP, ×2 below full`
      : t === "carapace" ? `${p.baseLimit} base, +${p.baseLimit} each time it takes damage this turn`
      : p.negator ? "damage up to the Limit is fully negated for 1 Durability; more than that isn't blocked" : "";
    return Object.assign(context, {
      p,
      types: Object.fromEntries(Object.entries(SHROUD_TYPES).map(([k, v]) => [k, v.label])),
      limitNote,
      recoveryLabel: !p.valid ? "" : p.fixedDur ? "Fully restores at the start of your turn" : p.placed ? "Restores to full when placed; otherwise recovers its Limit each turn"
        : `+${p.recovery} Durability at the start of your turn`,
      owned: !!this.document.actor,
      hasColored: p.affixes?.includes("coloredDiamond"),
      hasEmerald: p.affixes?.includes("emerald"),
      sources: sourceTypeChoices(WEAPON_TYPES, DAMAGE_TYPES),
      ...(p.valid ? affixContext(sys, p) : {})
    });
  }

  _processFormData(event, form, formData) {
    return collectAffixes(form, super._processFormData(event, form, formData));
  }
}

/** When a weight change makes the material invalid, switch to the first valid material for that weight. */
Hooks.on("preUpdateItem", (item, changes) => {
  if (!["weapon", "armor"].includes(item.type)) return;
  const weight = foundry.utils.getProperty(changes, "system.weight");
  if (!weight) return;
  const table = item.type === "weapon" ? WEAPON_MATERIALS : ARMOR_MATERIALS;
  const material = foundry.utils.getProperty(changes, "system.material") ?? item.system.material;
  if (table[material]?.weights[weight]) return;
  const first = Object.keys(materialsFor(table, weight))[0];
  if (first) foundry.utils.setProperty(changes, "system.material", first);
});

/** Sheet for a pile of dropped items: take items onto your selected token. */
export class FlowStatePileSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["flowstate", "sheet", "actor", "pile"],
    position: { width: 420, height: 360 },
    window: { resizable: true },
    actions: {
      editImage: pickImage,
      take: FlowStatePileSheet.onTake,
      editItem: FlowStatePileSheet.onEditItem
    }
  };

  static PARTS = {
    sheet: { template: "systems/flowstate/templates/pile-sheet.hbs", scrollable: [""] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const items = this.document.items.map(i => ({
      id: i.id, name: i.name, img: i.img,
      summary: i.system.profile?.valid ? i.system.profile.label : i.type === "gear" ? `×${i.system.quantity}` : ""
    }));
    return Object.assign(context, { actor: this.document, items });
  }

  static onTake(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (item) return actions.pickUp(this.document, item);
  }
  static onEditItem(event, target) {
    this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId)?.sheet.render(true);
  }
}
