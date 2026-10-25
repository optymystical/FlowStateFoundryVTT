/**
 * Balance variants under test in the combat sim (pure). The hidden world setting `balanceTest` lists the switches that are on, comma-separated;
 * none are on by default, so the rules are as written. Not a rule: this module goes away once the tests are done.
 *   assaultD12  — a Light Assault rolls d12s instead of d8s.
 *   strike2d8   — Strike deals 2d8 arcane instead of 2d12.
 *   strikeRanged — Strike is a Ranged spell instead of Targeted (no half stealth).
 *   shroudX2    — a Shroud's scaled Durability and Limit are doubled.
 */
export const BALANCE_TEST = new Set();
export const setBalanceTest = text => { BALANCE_TEST.clear(); for (const k of String(text ?? "").split(",").map(s => s.trim()).filter(Boolean)) BALANCE_TEST.add(k); };
