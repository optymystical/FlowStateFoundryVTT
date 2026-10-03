import { STATS, SENSE_LEVELS, deriveCharacter, tempoModifier, movementCost } from "./rules.mjs";
import { spentPoints } from "./skills.mjs";
import { WEAPON_TYPES, WEIGHTS, ARMOR_WEIGHTS, weaponProfile, armorProfile } from "./martial.mjs";
import { FOCI_TYPES, SHROUD_TYPES, fociProfile, shroudProfile } from "./magic.mjs";
import { penalizedDie } from "./spellfx.mjs";
import { FORMS, iconProfile } from "./mental-rules.mjs";

const f = foundry.data.fields;
const int = (initial = 0, opts = {}) => new f.NumberField({ required: true, nullable: false, integer: true, initial, ...opts });

/** Shared data model for characters and NPCs (Flow State has no class split). */
export class FlowStateActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const stats = {};
    // 90 starting stat points spread evenly = 10 each.
    for (const key of Object.keys(STATS)) stats[key] = int(10);

    const sense = initial => new f.StringField({ required: true, initial, choices: SENSE_LEVELS });

    return {
      stats: new f.SchemaField(stats),
      skillPoints: int(30, { min: 0 }),
      // Progression: GM grants points; players spend stat points outside combat.
      unspentStats: int(0, { min: 0 }),
      statCarry: int(0, { min: 0 }),           // stat points granted toward the next skill point (3:1)
      trees: new f.ObjectField({ initial: {} }), // skill tree id → current tier
      creation: new f.BooleanField({ initial: false }), // legacy unlock flag; creation now happens in the New Character wizard
      size: int(3, { min: 1, max: 5 }),
      hp: new f.SchemaField({
        value: int(0),        // may go negative: below 0 is Overkill
        lost: int(0, { min: 0 }) // Max HP lost (chunks of body removed)
      }),
      energy: new f.SchemaField({ value: int(0, { min: 0 }) }),
      ap: new f.SchemaField({ value: int(6, { min: 0 }) }),
      rp: new f.SchemaField({ value: int(6, { min: 0 }) }),
      conditions: new f.SchemaField({
        ignite: int(0, { min: 0 }),
        stain: int(0, { min: 0 }),
        slow: int(0, { min: 0 }),
        haste: int(0, { min: 0 }),
        solid: int(0, { min: 0 }), searing: int(0, { min: 0 }), frozen: int(0, { min: 0 }), electric: int(0, { min: 0 })   // Stain variants (Magic)
      }),
      lift: int(0, { min: 0 }),
      magical: new f.BooleanField({ initial: false }),      // fully Magical: not Weakened by Arcane
      supernatural: new f.BooleanField({ initial: false }), // Supernatural: Silver/Cold Iron Strengthened
      daysWithoutRest: int(0, { min: 0 }),
      senses: new f.SchemaField({
        sight: sense("primary"),
        hearing: sense("primary"),
        smell: sense("secondary")
      }),
      focusedSpell: new f.StringField({ initial: "" }),    // Magic Theory T2: the Focused Spell's Core id
      biography: new f.HTMLField({ initial: "" })
    };
  }

  prepareDerivedData() {
    const d = deriveCharacter({
      stats: this.stats,
      skillPoints: this.skillPoints,
      size: this.size,
      hpLost: this.hp.lost
    });
    // Summons and Animations (Tier 4 Magic) have their own health, Energy, dice, speed and physical-attack stacks, set when they're made.
    const sm = this.parent?.flags?.flowstate?.summon;
    if (sm) {
      d.hpMax = sm.hp - Math.max(0, this.hp.lost);
      d.pain = d.hpMax;
      d.energyMax = sm.energy ?? 0;
      d.energyRecover = 0;
      if (sm.attackDie) d.attackDie = sm.attackDie;
      if (sm.dodgeDie) d.dodgeDie = sm.dodgeDie;
      if (sm.speed) d.move = sm.speed;
      if (sm.physical) d.size = { ...d.size, physical: (d.size?.physical ?? 0) + sm.physical };
    }
    Object.assign(this, { derived: d });
    const spent = spentPoints(this.trees);
    this.skills = { total: this.skillPoints, spent, unspent: this.skillPoints - spent };
    this.hp.max = d.hpMax;
    this.hp.pain = d.pain;
    this.hp.overkill = Math.max(0, -this.hp.value);
    this.hp.destroyed = this.hp.overkill >= d.hpMax && d.hpMax > 0 && this.hp.value < 0;
    const effects = Array.from(this.parent?.effects ?? []).filter(e => !e.disabled);
    // Spell effects that shrink dice (Slam: dodge dice, Cut + Slam: attack dice). The worst one applies; they don't stack.
    const penalty = key => Math.max(0, ...effects.map(e => Number(e.flags?.flowstate?.spellEffect?.[key]) || 0));
    // Painless (Restoration Arcana T2) lowers the Pain Threshold.
    const painDown = effects.reduce((n, e) => n + (Number(e.flags?.flowstate?.spellEffect?.painDown) || 0), 0);
    // Phantom Pain (Illusion T2): illusion damage from a Mirage only raises the Pain Threshold (gone when no Mirage affects them).
    const phantom = effects.reduce((n, e) => n + (Number(e.flags?.flowstate?.spellEffect?.phantomTotal) || 0), 0);
    // Execute (Mental, Death T5) raises it.
    const painUp = effects.reduce((n, e) => n + (Number(e.flags?.flowstate?.spellEffect?.painUp) || 0), 0);
    if (painDown || phantom || painUp) { d.pain = Math.max(0, d.pain - painDown + phantom + painUp); this.hp.pain = d.pain; }
    // Mental: Flourish (Life) makes dodge dice a size bigger (it doesn't stack).
    const bonus = key => Math.max(0, ...effects.map(e => Number(e.flags?.flowstate?.spellEffect?.[key]) || 0));
    this.lift = (this.lift ?? 0) + bonus("liftUp");                // Ascend (Mental, Beyond T5)
    d.dodgeDie = penalizedDie(d.dodgeDie, penalty("dodgeDie")) + bonus("dodgeDieUp");
    d.attackDie = penalizedDie(d.attackDie, penalty("attackDie")) + bonus("attackDieUp");
    // Active Rituals lower max Energy until they end (the Ritual effect carries the amount).
    this.ritualLoss = effects.reduce((n, e) => n + (Number(e.flags?.flowstate?.ritual?.energyLost) || 0), 0);
    this.energy.max = Math.max(0, d.energyMax - this.ritualLoss);
    this.ap.max = sm?.ap ?? 6;
    this.rp.max = sm?.rp ?? 6;

    // Martial equipment scales off this actor's effective stats.
    const eff = d.effective;
    this.armor = null;
    this.shroud = null;
    this.foci = null;
    this.icon = null;
    for (const item of this.parent?.items ?? []) {
      if (item.type === "weapon") item.system.computeProfile({ str: eff.str.value, dex: eff.dex.value });
      else if (item.type === "foci") {
        item.system.computeProfile({ reach: eff.reach.value, grasp: eff.grasp.value });
        if (item.system.attuned && item.system.profile.valid && !this.foci) this.foci = item;
      } else if (item.type === "icon") {
        item.system.computeProfile({ will: eff.will.value, pon: eff.pon.value, snap: eff.snap.value });
        if (item.system.attuned && item.system.profile.valid && !this.icon) this.icon = item;
      } else if (item.type === "shroud") {
        item.system.computeProfile(eff.build.value, this);
        if (item.system.attuned && item.system.profile.valid && !this.shroud) this.shroud = item;
      }
      else if (item.type === "armor") {
        item.system.computeProfile(eff.con.value);
        if (item.system.equipped && item.system.profile.valid && !this.armor) this.armor = item;
      }
    }
    const penalties = this.armor?.system.profile ?? { stealthDis: 0, moveAP: 1, physicalDis: 0, physicalWeakened: 0 };
    // Careful Steps (Medium Armor T3): no stealth penalty from worn Medium armor while it's active.
    const careful = this.parent?.statuses?.has?.("carefulSteps") && !this.parent?.getFlag?.("flowstate", "carefulLapsed")
      && this.armor?.system.weight === "medium";
    this.penalties = {
      stealthDis: careful ? 0 : penalties.stealthDis,
      physicalDis: penalties.physicalDis,
      physicalWeakened: penalties.physicalWeakened
    };

    const statuses = this.parent?.statuses ?? new Set();
    // Unfettered (Unarmored T5): immune to physical movement slows (Martial Theory, Martial equipment, physical sources) while
    // wearing no armor. The Slow condition's stacks don't record a source, so they still apply.
    const noArmor = !(this.parent?.items ?? []).some?.(i => i.type === "armor" && i.system.equipped);
    const unfettered = noArmor && (Number(this.trees?.["martial-unarmored"]) || 0) >= 5;
    // Zircon (Shroud): while the melded Shroud is undamaged, ignore Rough Terrain and Slow stacks.
    const zircon = !!this.shroud?.system.profile.affixes?.includes("zircon") && this.shroud.system.wear <= 0;
    const tempo = tempoModifier(zircon ? 0 : this.conditions.slow, this.conditions.haste, d.pain);
    this.movement = {
      // Quicken (Unarmored T4): double speed.
      speed: statuses.has("quickened") ? d.move * 2 : d.move,
      tempo,
      ...movementCost({
        prone: statuses.has("prone"),
        // Like Shooting Fish (Longshot T2): moves as if in rough terrain.
        crouch: statuses.has("crouch") || (statuses.has("fishy") && !unfettered && !zircon),
        stealth: statuses.has("stealth"),
        tempo,
        // Trudge (Heavy T2 / Titanic T4): the next move ignores the armor's movement penalty.
        base: (this.parent?.getFlag?.("flowstate", "trudge") ? 1 : penalties.moveAP)
          // Slice (Balanced T3): +1 AP per move (a Martial source, so Unfettered ignores it).
          + (statuses.has("sliced") && !unfettered ? 1 : 0)
          // Freeze (Mental, Destruction T4): +1 AP per move
          + bonus("moveUp")
      })
    };
    // Ch7 Rest: after 1 day without rest, disadvantage on all rolls.
    this.exhausted = this.daysWithoutRest >= 1;
  }
}

export class FlowStateGearData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      quantity: int(1, { min: 0 }),
      // Ammunition: the ranged weapon type it feeds ("" = not ammunition).
      ammoType: new f.StringField({ initial: "" }),
      description: new f.HTMLField({ initial: "" })
    };
  }
}

/** Stats an unowned item previews at: the most its Grade allows. */
const gradePreview = grade => Math.max(1, grade || 1) * 10;

/** Martial weapon: Type × Weight × Material × Grade. Wear = Durability lost. */
export class FlowStateWeaponData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      weaponType: new f.StringField({ required: true, initial: "bladed", choices: () => Object.fromEntries(Object.entries(WEAPON_TYPES).map(([k, v]) => [k, v.label])) }),
      weight: new f.StringField({ required: true, initial: "light", choices: () => Object.fromEntries(Object.entries(WEIGHTS).map(([k, v]) => [k, v.label])) }),
      material: new f.StringField({ required: true, initial: "hardwood" }),
      grade: int(1, { min: 1 }),
      twoHanded: new f.BooleanField({ initial: false }),
      equipped: new f.BooleanField({ initial: false }),
      secondHand: new f.BooleanField({ initial: false }), // Unarmed only: the other fist is up too
      natural: new f.BooleanField({ initial: false }),    // a natural weapon (Summoning Arm, ...): can't be dropped or thrown
      returning: new f.BooleanField({ initial: false }),  // a natural weapon that returns when thrown (Geomancy Combos)
      // Ranged: shots per reload (X, uses X ammunition) and shots currently loaded.
      magazine: int(1, { min: 1 }),
      rounds: int(1, { min: 0 }),
      // Multi-type weapons (Weapon Master, Martial Theory T5): extra weapon types besides the main one.
      extraTypes: new f.ArrayField(new f.StringField()),
      wear: int(0, { min: 0 }),
      description: new f.HTMLField({ initial: "" })
    };
  }

  prepareDerivedData() {
    const eff = this.parent?.actor?.system?.derived?.effective;
    const p = gradePreview(this.grade);
    this.computeProfile(eff ? { str: eff.str.value, dex: eff.dex.value } : { str: p, dex: p });
  }

  computeProfile(stats) {
    const { weaponType: type, weight, material, grade, twoHanded } = this;
    this.profile = weaponProfile({ type, weight, material, grade, twoHanded }, stats);
    if (this.parent?.flags?.flowstate?.made?.harden?.armor && this.profile) this.profile.selfWeakened = Math.max(this.profile.selfWeakened ?? 0, 1);
    this._stats = stats;
    // All of this weapon's types: the main one first, then any extra (Unarmed/Improvised can't be multi-type).
    const extra = type === "unarmed" || type === "improvised" ? []
      : [...new Set((this.extraTypes ?? []).filter(k => k !== type && WEAPON_TYPES[k] && k !== "unarmed" && k !== "improvised"))];
    this.types = [type, ...extra];
    // Ranged ammunition: the weapon's ranged type (main first) and its loaded shots.
    this.ammoType = this.types.find(k => WEAPON_TYPES[k]?.ranged) ?? null;
    this.loaded = (this.rounds ?? 0) > 0;
    this.durability = { max: this.profile.durability ?? 0, value: (this.profile.durability ?? 0) - this.wear };
    this.broken = this.profile.valid && !this.profile.unarmed && !this.profile.improvised && this.profile.durability - this.wear <= 0;
    this.held = this.equipped || (this.weaponType === "unarmed" && this.secondHand);
  }

  /** The profile when attacking as one of this weapon's types (same weight, material, Grade, hands). */
  profileFor(type) {
    if (!type || type === this.weaponType || !this.types?.includes(type)) return this.profile;
    const { weight, material, grade, twoHanded } = this;
    return weaponProfile({ type, weight, material, grade, twoHanded }, this._stats ?? {});
  }
}

/** Martial armor: Weight × Material × Grade; stats scale with Con up to Grade × 10. */
export class FlowStateArmorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      weight: new f.StringField({ required: true, initial: "light", choices: () => Object.fromEntries(Object.entries(ARMOR_WEIGHTS).map(([k, v]) => [k, v.label])) }),
      material: new f.StringField({ required: true, initial: "cloth" }),
      grade: int(1, { min: 1 }),
      equipped: new f.BooleanField({ initial: false }),
      natural: new f.BooleanField({ initial: false }),    // natural armor (Summoning Skin): can't be dropped
      wear: int(0, { min: 0 }),
      // Ignite and Stain stacks "on whatever is damaged" can land on the armor itself.
      conditions: new f.SchemaField({ ignite: int(0, { min: 0 }), stain: int(0, { min: 0 }), solid: int(0, { min: 0 }), searing: int(0, { min: 0 }), frozen: int(0, { min: 0 }), electric: int(0, { min: 0 }) }),
      description: new f.HTMLField({ initial: "" })
    };
  }

  prepareDerivedData() {
    const eff = this.parent?.actor?.system?.derived?.effective;
    this.computeProfile(eff ? eff.con.value : gradePreview(this.grade));
  }

  computeProfile(con) {
    const { weight, material, grade } = this;
    this.profile = armorProfile({ weight, material, grade }, con);
    if (this.parent?.flags?.flowstate?.made?.harden?.armor && this.profile) this.profile.selfWeakened = Math.max(this.profile.selfWeakened ?? 0, 1);   // Harden: damage to it is Weakened
    const max = this.profile.durability ?? 0;
    this.durability = { max, value: max - this.wear };
    this.broken = this.profile.valid && max - this.wear <= 0;
  }
}

/** Magic Foci: attuned (one at a time) and held to cast. */
export class FlowStateFociData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      fociType: new f.StringField({ required: true, initial: "rod", choices: () => Object.fromEntries(Object.entries(FOCI_TYPES).map(([k, v]) => [k, v.label])) }),
      grade: int(1, { min: 1 }),
      attuned: new f.BooleanField({ initial: false }),
      equipped: new f.BooleanField({ initial: false }),   // held
      twoHanded: new f.BooleanField({ initial: false }),
      wear: int(0, { min: 0 }),
      affixes: new f.ArrayField(new f.StringField()),
      element: new f.StringField({ initial: "heat" }),    // Tourmaline
      chosenSpell: new f.StringField({ initial: "" }),    // Ring
      lush: new f.BooleanField({ initial: false }),       // Emerald: in a Lush biome
      declared: new f.StringField({ initial: "" }),     // Colored Diamond: the Core Spell declared this turn
      opalRange: new f.StringField({ initial: "targeted" }), // Black Opal (+): which range gets +50%
      description: new f.HTMLField({ initial: "" })
    };
  }

  prepareDerivedData() {
    const eff = this.parent?.actor?.system?.derived?.effective;
    this.computeProfile(eff ? { reach: eff.reach.value, grasp: eff.grasp.value } : { reach: gradePreview(this.grade), grasp: gradePreview(this.grade) });
  }

  computeProfile(stats) {
    this.profile = fociProfile(this, stats);
    const max = this.profile.durability ?? 0;
    this.durability = { max, value: max - this.wear };
    this.broken = this.profile.valid && max - this.wear <= 0;
    this.held = this.equipped;
  }
}

/**
 * Mental Icon: an object of devotion with a Form (its Ward effect) and a Tenet. Attuned (one at a time, 6 AP in combat) it works from anywhere on your
 * body. Ward numbers scale per 10 Willpower, the Tenet per 10 of its Wonder's Scaling Stat, both limited by Grade (10 per Grade).
 */
export class FlowStateIconData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      form: new f.StringField({ required: true, initial: "aegis", choices: () => Object.fromEntries(Object.entries(FORMS).map(([k, v]) => [k, v.name])) }),
      grade: int(1, { min: 1 }),
      attuned: new f.BooleanField({ initial: false }),
      tenet: new f.StringField({ initial: "" }),          // the Tenet's id ("mental-life-dream:verdant-soul"), chosen when attuning
      chosen: new f.StringField({ initial: "physical" }), // Bane: the damage category chosen on attuning
      description: new f.HTMLField({ initial: "" })
    };
  }

  prepareDerivedData() {
    const eff = this.parent?.actor?.system?.derived?.effective;
    this.computeProfile(eff ? { will: eff.will.value, pon: eff.pon.value, snap: eff.snap.value } : { will: this.grade * 10, pon: this.grade * 10, snap: this.grade * 10 });
  }

  computeProfile(stats) {
    this.profile = iconProfile(this, stats);
    this.broken = false;
  }
}

/** Magic Shroud: attuned (one at a time), melded into the Spirit. Soaks before armor and recovers each turn. */
export class FlowStateShroudData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      shroudType: new f.StringField({ required: true, initial: "bastion", choices: () => Object.fromEntries(Object.entries(SHROUD_TYPES).map(([k, v]) => [k, v.label])) }),
      grade: int(1, { min: 1 }),
      attuned: new f.BooleanField({ initial: false }),
      wear: int(0),                                       // spent Durability (Aegis/Lattice: charges used)
      affixes: new f.ArrayField(new f.StringField()),
      element: new f.StringField({ initial: "heat" }),    // Tourmaline
      declared: new f.StringField({ initial: "" }),       // Colored Diamond source type
      lush: new f.BooleanField({ initial: false }),       // Emerald: in a Lush biome
      carapace: int(0, { min: 0 }),                       // Carapace: hits taken since your turn started
      negated: new f.ArrayField(new f.StringField()),     // Agate/Jasper/Obsidian categories used since recovery
      lastType: new f.StringField({ initial: "" }),       // Alexandrite
      hitSources: new f.ArrayField(new f.StringField()),  // Diamond: "turnKey|source"
      placedOn: new f.StringField({ initial: "" }),       // Ward/Bond: the other creature's UUID
      description: new f.HTMLField({ initial: "" })
    };
  }

  prepareDerivedData() {
    const eff = this.parent?.actor?.system?.derived?.effective;
    this.computeProfile(eff ? eff.build.value : gradePreview(this.grade), this.parent?.actor?.system ?? null);
  }

  /** `owner` is the wearer's system data (for Cistern/Ember/Carapace/Emerald limits). */
  computeProfile(build, owner = null) {
    const p = shroudProfile(this, build);
    if (p.valid) {
      let factor = 1;
      const t = this.shroudType;
      if (owner && t === "cistern") {
        const e = owner.energy?.value ?? 0, m = owner.energy?.max ?? 0;
        factor = m > 0 && e >= m ? 3 : e > m / 2 ? 2 : 1;
      } else if (owner && t === "ember") {
        const h = owner.hp?.value ?? 0, m = owner.hp?.max ?? 0;
        factor = h <= m / 2 ? 3 : h < m ? 2 : 1;
      }
      if (t === "carapace") factor += this.carapace;
      p.limitFactor = factor;
      p.limit = p.baseLimit * factor;
      // Emerald: doubled in a Lush biome, halved elsewhere (×2 / ÷4 with an upgraded affix).
      if (p.affixes.includes("emerald")) p.limit = this.lush ? p.limit * 2 * p.affixMult : Math.floor(p.limit / (2 * p.affixMult));
      p.recovery = t === "cistern" || t === "ember" ? p.limit : p.baseLimit;
    }
    this.profile = p;
    const max = p.durability ?? 0;
    this.durability = { max, value: max - this.wear };
    this.broken = p.valid && max - this.wear <= 0;
  }
}

/** A pile of dropped items on the map (e.g. a thrown weapon). Holds items; no stats. */
export class FlowStatePileData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return { description: new f.HTMLField({ initial: "" }) };
  }
}
