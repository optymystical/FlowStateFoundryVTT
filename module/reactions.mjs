/**
 * Reaction prompts a player can switch off. Every question the system asks a player in the middle of someone else's turn ("Use Infuse?", "Spend 1 RP
 * to negate with your Ward?") has a key here; when it is switched off for a character the question is never asked and counts as "no" (nothing is
 * spent, nothing happens). The switches live on the character (flag `autoDecline`) and show up in the Action List under "Reactions", only for the
 * reactions that character can actually be asked. Pure: no Foundry globals.
 */

/** A reaction: `key` (what askFor carries as `react`), a label and tip for the Action List, and when the character can be asked it. */
const REACTIONS = [
  { key: "ward", label: "Ward negation", tip: "Whether to spend 1 RP to negate incoming damage with your Icon's Ward.", when: c => c.iconKind === "negate" },
  { key: "premonition", label: "Premonition charge", tip: "Whether to consume a Premonition charge to negate incoming damage.", when: c => c.iconKind === "charge" || c.hasPremonition },
  { key: "tenet", label: "Tenet on a Manifest hit", tip: "Verdant Soul, Mortal Coil, Weight and Gust: offered when your Manifest hits.", when: c => ["verdant-soul", "mortal-coil", "weight", "gust"].includes(c.tenet) },
  { key: "infuse", label: "Infuse", tip: "Offered when a willing character within 100 ft hits something.", when: c => c.tenet === "infuse" },
  { key: "empower", label: "Empower", tip: "Offered when damage is about to be dealt to a foe within 100 ft.", when: c => c.tenet === "empower" },
  { key: "dampen", label: "Dampen", tip: "Offered when damage is about to be dealt to an ally within 100 ft.", when: c => c.tenet === "dampen" },
  { key: "balance", label: "Balance", tip: "Offered when it would change the result of an attack or dodge you are part of.", when: c => c.tenet === "balance" },
  { key: "charges", label: "Order / Chaos charges", tip: "Spending your charges on rolls (attack, dodge, other and damage rolls).", when: c => c.tier("mental-order-dream") >= 1 || c.tier("mental-chaos-nightmare") >= 1 },
  { key: "verdict", label: "Verdict", tip: "Passing judgment after an attack lands.", when: c => c.tier("mental-order-dream") >= 1 },
  { key: "entropy", label: "Entropy", tip: "Spending Entropy on a roll.", when: c => c.tier("mental-chaos-nightmare") >= 1 },
  { key: "serenity", label: "Serenity", tip: "Offered when a creature under your Peace Mode attacks or is attacked.", when: c => c.tier("mental-peace-dream") >= 2 },
  { key: "absolution", label: "Absolution stacks", tip: "How many Absolution stacks to consume when damage is dealt or taken.", when: c => c.tier("mental-peace-dream") >= 1 },
  { key: "guard", label: "Guard redirect", tip: "Whether to redirect damage from a creature you Guard onto yourself.", when: c => c.tier("mental-peace-dream") >= 1 },
  { key: "warmonger", label: "Warmonger", tip: "Whether to spend Energy to add damage to a buffed attack.", when: c => c.tier("mental-war-nightmare") >= 2 },
  { key: "bloodbond", label: "Bloodbond", tip: "Whether to duplicate damage onto another target.", when: c => c.tier("mental-war-nightmare") >= 5 },
  { key: "adaptiveSkin", label: "Adaptive Skin stacks", tip: "Whether to spend Adaptation stacks for extra damage reduction.", when: c => c.tier("mental-adaptation-dream") >= 1 }
];

/** Has this character switched the reaction off? */
export const isDeclined = (actor, key) => !!key && actor?.getFlag?.("flowstate", "autoDecline")?.[key] === true;

/** The reactions this character can be asked, each with whether it is switched off. `ctx` = { tenet (short id), iconKind, hasPremonition, tier(wonderId) }. */
export function reactionRows(actor, ctx) {
  return REACTIONS.filter(r => r.when(ctx)).map(r => ({ ...r, off: isDeclined(actor, r.key) }));
}

/** What a toggle sets the reaction's switch to (flags merge, so the switch is always written as true or false). */
export const toggledTo = (actor, key) => !isDeclined(actor, key);
