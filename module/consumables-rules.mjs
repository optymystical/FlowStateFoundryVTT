/**
 * Consumables (pure, no Foundry globals): potions, the Festival Token, and the bonus Energy pool an Energy potion fills.
 *  - A **Health potion** restores its potency × the health an 8 hour rest restores (`restHeal`: the Con, Will and Build minimums), up to max HP.
 *  - An **Energy potion** puts its potency × max Energy into a separate bonus pool that can take you past your maximum. It lasts 1 minute (10 rounds)
 *    or until used, and is spent before your own Energy.
 *  - One potion per rest, Health and Energy alike (flag `potionUsed`, cleared by an 8 hour rest). Drinking one, or giving one to a creature within your
 *    reach, costs 1 AP in combat; the effect (and the one-per-rest use) is the drinker's.
 *  - A **Festival Token** has 3 uses and is set to one kind of roll; a use gives Advantage on the holder's next roll of that kind. At 0 uses it stays
 *    as a keepsake.
 */

/** The potions (the store's `potions` collection): kind, potency (× the rest heal or × max Energy), price in the world's first currency. */
export const POTIONS = {
  healthLesser: { label: "Lesser Health Potion", kind: "health", potency: 0.5, price: 200, rarity: "common", img: "icons/consumables/potions/potion-tube-corked-red.webp" },
  health: { label: "Health Potion", kind: "health", potency: 1, price: 500, rarity: "common", img: "icons/consumables/potions/bottle-round-corked-red.webp" },
  healthGreater: { label: "Greater Health Potion", kind: "health", potency: 2, price: 1200, rarity: "common", img: "icons/consumables/potions/potion-flask-corked-shiny-red.webp" },
  energyLesser: { label: "Lesser Energy Potion", kind: "energy", potency: 0.5, price: 200, rarity: "common", img: "icons/consumables/potions/potion-tube-corked-blue.webp" },
  energy: { label: "Energy Potion", kind: "energy", potency: 1, price: 500, rarity: "common", img: "icons/consumables/potions/bottle-round-corked-blue.webp" },
  energyGreater: { label: "Greater Energy Potion", kind: "energy", potency: 2, price: 1200, rarity: "common", img: "icons/consumables/potions/potion-flask-corked-blue.webp" }
};
export const POTION_AP = 1;

/** The Festival Token. */
export const TOKEN = { label: "Festival Token", uses: 3, img: "icons/commodities/currency/coin-engraved-sun-smile-copper.webp" };
/** What a Festival Token can be set to (`checkType`): each is the next roll of that kind. */
export const TOKEN_CHECKS = {
  perception: "Spot (Perception)",
  athletics: "Athletics",
  deception: "Deception",
  persuasion: "Persuasion",
  stealth: "Stealth",
  initiative: "Initiative",
  fear: "Resisting Fear",
  con: "Constitution check",
  str: "Strength check",
  attack: "Attack roll"
};

/** The bonus pool lasts 1 minute: 10 rounds in combat. */
export const BONUS_SECONDS = 60;
export const BONUS_ROUNDS = 10;

/** What a potion gives: health (× the rest heal) or bonus Energy (× max Energy), rounded down. */
export function potionAmount(potion, { restHeal = 0, energyMax = 0 } = {}) {
  if (!potion) return 0;
  const base = potion.kind === "energy" ? energyMax : restHeal;
  return Math.max(0, Math.floor((Number(base) || 0) * (Number(potion.potency) || 0)));
}

/** All the Energy a creature can spend: its own and its bonus pool. */
export const energyHave = actor => (Number(actor?.system?.energy?.value) || 0) + (Number(actor?.system?.energy?.bonus) || 0);

/**
 * An update that lowers Energy from `from` to `to` spends the bonus pool first: what comes off the pool doesn't come off your own Energy.
 * Returns the stored { value, bonus }.
 */
export function spendBonusFirst(from, to, bonus) {
  const drop = Math.max(0, (Number(from) || 0) - (Number(to) || 0));
  const b = Math.max(0, Number(bonus) || 0);
  const fromPool = Math.min(b, drop);
  return { value: (Number(to) || 0) + fromPool, bonus: b - fromPool };
}

/**
 * Has a bonus pool run out? `state` = { time, combat, round } from when it was filled (`time` is the world time it ends at; `combat`/`round` the combat
 * and the round it ends in, at the drinker's turn). In that combat the rounds decide, anywhere else the world time.
 */
export function bonusExpired(state, { time = 0, combatId = null, round = 0 } = {}) {
  if (!state) return true;
  if (state.combat && combatId && state.combat === combatId) return round >= state.round;
  return time >= (Number(state.time) || 0);
}

/** A Festival Token's uses left (a new one is full). */
export const tokenUses = sys => (sys?.charges === null || sys?.charges === undefined ? TOKEN.uses : Math.max(0, Number(sys.charges) || 0));

/** The catalog key of a potion, and back. */
export const potionKey = key => `potion.${key}`;
export const TOKEN_KEY = "gear.festivalToken";
