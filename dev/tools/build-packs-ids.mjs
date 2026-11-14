// The packs' stable document ids (build-packs.mjs): a Foundry id (16 letters and digits) from a key, the same key always giving the same id.
import { createHash } from "node:crypto";
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export function stableId(key) {
  const h = createHash("sha256").update(`flowstate:${key}`).digest();
  return Array.from(h.subarray(0, 16), b => ALPHA[b % ALPHA.length]).join("");
}
