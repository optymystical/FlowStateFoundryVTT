/**
 * The collections of the world data store (pure): every table of game data, where the engine reads it, and what a world may do with it.
 * Importing this module registers them (store.mjs has the rules). `addable` collections take new entries from a world; the others hold things the
 * engine works with by name (the nine stats, the five Sizes, the damage types...), so a world can change their values and text but not add to them.
 * New entries work the way any entry of their kind does (a new material's Durability, Limit and mods; a new Foci's numbers): what an existing entry
 * does beyond its numbers is written for it by name in the engine, and a new one only gets its text.
 */
import { defineCollection } from "./store.mjs";
import { STATS, SIZES, DAMAGE_TYPES, SENSE_LEVELS, OBJECT_DENSITY, TERMINAL_ROUNDS, STAIN_VARIANTS } from "./rules.mjs";
import { RARITIES, WEAPON_TAGS, WEAPON_TYPES, WEIGHTS, RELOAD_RP, THROW, DAMAGE_CATEGORY, WEAPON_MATERIALS, ARMOR_WEIGHTS, ARMOR_MATERIALS } from "./martial.mjs";
import { CASTING_FORMS, FOCI_TYPES, SHROUD_TYPES, AFFIXES, ELEMENTS } from "./magic.mjs";
import { KINDS, RANGES, FORMS, rebuildWonders, rebuildFormKeys } from "./mental-rules.mjs";
import { ANIM_CATEGORIES, ANIM_MATERIALS, RIDERS } from "./conjure-rules.mjs";
import { TREES } from "./trees.mjs";
import { COMBO_PAIRS, COMBO_GENERIC, COMBO_BONUS, COMBO_ILLUSION } from "./combos.mjs";
import { rebuildCatalog } from "./spells.mjs";
import { ITEM_CATALOG, ITEM_TYPES, IDENTITY, generateCatalog } from "./catalog.mjs";

const CORE = "Core rules", EQUIP = "Equipment", MAGIC = "Magic", MENTAL = "Mental", TREE = "Skill trees";
const named = (e, k) => (typeof e === "string" ? e : e?.label ?? e?.name ?? k);

// Core rules
defineCollection("stats", { label: "Stats", group: CORE, table: STATS });
defineCollection("sizes", { label: "Sizes", group: CORE, table: SIZES, nameOf: (e, k) => `Size ${k}` });
defineCollection("terminalRounds", { label: "Terminal Velocity (rounds)", group: CORE, table: TERMINAL_ROUNDS, nameOf: (e, k) => `Size ${k}` });
defineCollection("damageTypes", { label: "Damage types", group: CORE, table: DAMAGE_TYPES, nameOf: named });
defineCollection("damageCategories", { label: "Damage categories", group: CORE, table: DAMAGE_CATEGORY, nameOf: (e, k) => `${DAMAGE_TYPES[k] ?? k}: ${e}` });
defineCollection("senseLevels", { label: "Sense levels", group: CORE, table: SENSE_LEVELS, nameOf: named });
defineCollection("rarities", { label: "Rarities", group: CORE, table: RARITIES, nameOf: named });
defineCollection("objectDensity", { label: "Object densities", group: CORE, table: OBJECT_DENSITY, addable: true, required: ["label", "durability", "limit"] });
defineCollection("stainVariants", { label: "Stain variants", group: CORE, table: STAIN_VARIANTS });

// Equipment
defineCollection("weaponTypes", { label: "Weapon types", group: EQUIP, table: WEAPON_TYPES, addable: true, required: ["label", "light", "heavy"] });
defineCollection("weaponWeights", { label: "Weapon weights", group: EQUIP, table: WEIGHTS });
defineCollection("weaponTags", { label: "Weapon tags", group: EQUIP, table: WEAPON_TAGS, addable: true, required: ["label", "base"] });
defineCollection("throwQualities", { label: "Throw qualities", group: EQUIP, table: THROW });
defineCollection("reloadSpeeds", { label: "Reload speeds (RP)", group: EQUIP, table: RELOAD_RP, nameOf: (e, k) => k });
defineCollection("weaponMaterials", { label: "Weapon materials", group: EQUIP, table: WEAPON_MATERIALS, addable: true, required: ["label", "rarity", "weights"] });
defineCollection("armorWeights", { label: "Armor weights", group: EQUIP, table: ARMOR_WEIGHTS });
defineCollection("armorMaterials", { label: "Armor materials", group: EQUIP, table: ARMOR_MATERIALS, addable: true, required: ["label", "rarity", "weights"] });

// Magic
defineCollection("castingForms", { label: "Casting forms", group: MAGIC, table: CASTING_FORMS });
defineCollection("fociTypes", { label: "Foci", group: MAGIC, table: FOCI_TYPES, addable: true, required: ["label", "form", "dur", "limit"] });
defineCollection("shroudTypes", { label: "Shrouds", group: MAGIC, table: SHROUD_TYPES, addable: true, required: ["label", "dur", "limit"] });
defineCollection("affixes", { label: "Affixes", group: MAGIC, table: AFFIXES, addable: true, required: ["label", "rarity"] });
defineCollection("elements", { label: "Elements", group: MAGIC, table: ELEMENTS, nameOf: named });
defineCollection("animationCategories", { label: "Animation categories", group: MAGIC, table: ANIM_CATEGORIES });
defineCollection("animationMaterials", { label: "Animation materials", group: MAGIC, table: ANIM_MATERIALS, list: true, key: "name", addable: true, required: ["category", "rarity"] });
defineCollection("riders", { label: "Summon and Animation riders", group: MAGIC, table: RIDERS, nameOf: (e, k) => k });
defineCollection("comboPairs", { label: "Combo spells", group: MAGIC, table: COMBO_PAIRS, addable: true, required: ["text"], nameOf: (e, k) => k });
defineCollection("comboGeneric", { label: "Combo spells (any Core)", group: MAGIC, table: COMBO_GENERIC, nameOf: (e, k) => k });
defineCollection("comboBonus", { label: "Combo bonuses", group: MAGIC, table: COMBO_BONUS, nameOf: (e, k) => k });
defineCollection("comboIllusion", { label: "Illusion Combo effects", group: MAGIC, table: COMBO_ILLUSION, nameOf: (e, k) => k });

// Mental
defineCollection("wonderKinds", { label: "Wonder types", group: MENTAL, table: KINDS });
defineCollection("manifestRanges", { label: "Manifest ranges", group: MENTAL, table: RANGES });
defineCollection("iconForms", { label: "Icon Forms", group: MENTAL, table: FORMS, addable: true, required: ["name", "align", "rarity", "kind"], rebuild: rebuildFormKeys });

// Skill trees (every Archetype; the Wonders and the spell catalog are read from them)
defineCollection("skillTrees", { label: "Skill trees", group: TREE, table: TREES, list: true, key: "id", addable: true, required: ["name", "archetype", "tiers"],
  rebuild: () => { rebuildWonders(); rebuildCatalog(); } });

// Items: the catalog every sheet pulls from. Its system entries are generated from the tables above (every weapon type × weight × material, each
// armor, Foci, Shroud, Icon Form, Affix, ammunition), so it is worked out again after they have the world's changes. Named entries are the world's own.
defineCollection("items", { label: "Item catalog", group: "Items", table: ITEM_CATALOG, derive: generateCatalog, addable: true, required: ["type", "name", "system"],
  nameOf: (e, k) => e?.name ?? k,
  validate: (key, v, known) => {
    if (known) return null;
    if (!ITEM_TYPES[v.type]) return `has an unknown item type ("${v.type}").`;
    if (typeof v.system !== "object" || Array.isArray(v.system)) return "has no item data.";
    const missing = IDENTITY[v.type].filter(f => v.system[f] === undefined);
    return missing.length ? `is missing ${missing.join(", ")}.` : null;
  } });
