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
  { key: "tenet", label: "Tenet on a Manifest hit", tip: "Verdant Soul, Mortal Coil, Weight, Gust, Beacon, Shadowmark, Adamant and Surge: offered when your Manifest hits.", when: c => ["verdant-soul", "mortal-coil", "weight", "gust", "beacon", "shadowmark", "adamant", "surge"].includes(c.tenet) },
  { key: "accretion", label: "Reinforce / Bedrock", tip: "Offered when damage bigger than its Limit is about to strike one of your Accretions.", when: c => c.tier("mental-earth-dream") >= 2 },
  { key: "infuse", label: "Infuse", tip: "Offered when a willing character within 100 ft hits something.", when: c => c.tenet === "infuse" },
  { key: "empower", label: "Empower", tip: "Offered when damage is about to be dealt to a foe within 100 ft.", when: c => c.tenet === "empower" },
  { key: "dampen", label: "Dampen", tip: "Offered when damage is about to be dealt to an ally within 100 ft.", when: c => c.tenet === "dampen" },
  { key: "balance", label: "Balance", tip: "Offered when it would change the result of an attack or dodge you are part of.", when: c => c.tenet === "balance" },
  { key: "mantra", label: "Mantra", tip: "Whether to pay Energy to double a Tenet's bolded effect (or, for Infuse and Adapt, its extra stack) as it triggers.", when: c => !!c.tenet && c.ponderance >= 2 },
  { key: "reflex", label: "Reflex", tip: "Offered when a character you can sense is about to attack.", when: c => c.snappence >= 1 },
  { key: "impulse", label: "Impulse", tip: "Whether to pay Energy to apply your Tenet once more after it has already triggered this round.", when: c => c.snappence >= 2 && !!c.tenet },
  { key: "fixation", label: "Fixation", tip: "The question at the start of your turn about whom to fixate on.", when: c => c.snappence >= 3 },
  // Offer cards: optional buttons the system posts on their own card. Switched off, the card isn't posted (nothing is spent).
  { key: "palisade", label: "Palisade", tip: "The card to strike a creature that moves into your Reach weapon's range.", when: c => c.tier("martial-reach-weapons") >= 1 },
  { key: "flurry", label: "Blade Flurry", tip: "The card offered when both Fast Swift attacks land on one target.", when: c => c.tier("martial-swift-weapons") >= 3 },
  { key: "brawling", label: "Combo / Flow Like Water", tip: "The card offered when a whole Fast or Solitary Unarmed set lands on one target.", when: c => c.tier("martial-brawling-methods") >= 3 },
  { key: "turnStart", label: "Start-of-turn abilities", tip: "The card at the start of your turn with Berserk, Proper Stance and Quicken (switched off, Berserk can't be maintained from it).", when: c => c.tier("martial-striker-weapons") >= 2 || c.tier("martial-assault-weapons") >= 5 || c.tier("martial-unarmored") >= 4 },
  { key: "wonderAbilities", label: "Wonder ability buttons", tip: "The card of ability buttons after a Manifest (Pollinate, Fester, Refraction, Ricochet, Instinct and the like).", when: c => !!c.anyWonder },
  { key: "chant", label: "Chant reroll", tip: "The card offering to reroll a missed Manifest (Mental Theory T3).", when: c => (c.theory ?? 0) >= 3 },
  { key: "wobs", label: "Will of Body and Spirit", tip: "The card offering a free Manifest after your Martial or Magic attacks (Mental Theory T5).", when: c => (c.theory ?? 0) >= 5 },
  { key: "perennial", label: "Perennial", tip: "The card at the start of your turn to reapply expiring Life effects.", when: c => c.tier("mental-life-dream") >= 4 },
  { key: "below", label: "Vice / Quicksand", tip: "The card offered when someone tries to break free of your Below effects.", when: c => c.tier("mental-below-nightmare") >= 2 },
  { key: "momentum", label: "Momentum", tip: "The card offered when a creature you moved with a Beyond Mode collides.", when: c => c.tier("mental-beyond-dream") >= 2 },
  { key: "warpath", label: "Warpath", tip: "The card offering to carry your War buffs to another creature.", when: c => c.tier("mental-war-nightmare") >= 4 },
  { key: "current", label: "Current", tip: "The button to move a creature after your Sea Modes hurt it.", when: c => c.tier("mental-sea-nightmare") >= 2 },
  { key: "mark", label: "Mark shot", tip: "The card to shoot your Marked creature when it attacks, acts or moves (the Mark is used up either way; Lead Blindness still applies).", when: c => c.tier("martial-rapid-weapons") >= 3 },
  { key: "umbral", label: "Umbral Strike", tip: "Offered when you attack while you hold an Umbral Strike charge.", when: c => !!c.hasUmbral },
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
