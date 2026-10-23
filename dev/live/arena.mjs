// Live test arena (dev only): a scene and the LT actors, recreated each time. Run after kit.mjs:
//   await (await import("/systems/flowstate/dev/live/arena.mjs?" + Date.now())).default()
export default async function arena() {
const C = await import("/systems/flowstate/module/catalog.mjs");
const item = (key, grade = 1, system = {}) => { const d = C.itemData(key, { grade, system }); if (!d) throw new Error("no catalog entry " + key); return d; };
let folder = game.folders.find(f => f.type === "Actor" && f.name === "Live Test") ?? await Folder.create({ name: "Live Test", type: "Actor" });
for (const a of game.actors.filter(a => a.folder?.id === folder.id || a.name.startsWith("LT "))) await a.delete();
let scene = game.scenes.getName("LT Arena");
if (!scene) scene = await Scene.create({ name: "LT Arena", width: 3000, height: 2000, padding: 0, grid: { type: 1, size: 100, distance: 5, units: "ft" }, backgroundColor: "#333333" });
await scene.view(); await LT.sleep(1500);
if (scene.tokens.size) await scene.deleteEmbeddedDocuments("Token", scene.tokens.map(t => t.id));
const stats = o => ({ str: 10, dex: 10, con: 10, pon: 10, snap: 10, will: 10, reach: 10, grasp: 10, build: 10, ...o });
const mk = async (name, type, st, trees, items, extra = {}) => {
  const a = await Actor.create({ name, type, folder: folder.id, system: { stats: stats(st), skillPoints: 400, trees, ...extra }, prototypeToken: { actorLink: true, disposition: type === "npc" ? -1 : 1 } });
  if (items.length) await a.createEmbeddedDocuments("Item", items);
  await a.update({ "system.hp.value": a.system.hp.max, "system.energy.value": a.system.energy.max });
  return a;
};
const blade = await mk("LT Blade", "character", { str: 40, dex: 40, con: 30, will: 20 },
  { "martial-theory": 5, "martial-bladed-weapons": 5, "martial-swift-weapons": 5, "martial-brawling-methods": 5, "martial-medium-armor": 3, "martial-strength-methods": 3 },
  [item("weapon.bladed.light.steel", 3, { equipped: true }), item("weapon.swift.light.steel", 3), item("armor.medium.hardLeather", 2, { equipped: true })]);
const dummy = await mk("LT Dummy", "npc", { con: 30, will: 20, str: 20, dex: 20 }, { "martial-theory": 1 }, [item("armor.light.softLeather", 2, { equipped: true })]);
const dummy2 = await mk("LT Dummy B", "npc", { con: 30, will: 20, str: 20, dex: 20 }, { "martial-theory": 1 }, []);
const mage = await mk("LT Mage", "character", { reach: 40, grasp: 40, build: 30, will: 20, con: 20 },
  { "magic-theory": 5, "magic-slashing": 5, "magic-piercing": 5, "magic-crushing": 5, "magic-protection-arcana": 5, "magic-gravity": 5, "magic-heat": 5, "magic-cold": 5, "magic-reach-arcana": 3 },
  [item("foci.rod", 3, { attuned: true, equipped: true }), item("shroud.bastion", 3, { attuned: true })]);
const mind = await mk("LT Mind", "character", { pon: 50, snap: 50, will: 40, con: 20 },
  { "mental-theory": 5, "mental-life-dream": 5, "mental-death-nightmare": 5, "mental-fortune-dream": 5, "mental-growth-dream": 5, "mental-stagnation-nightmare": 5, "mental-esoteric-arts": 5, "mental-willpower-arts": 3, "mental-psion-arts": 2 },
  [item("icon.aegis", 4, { attuned: true, tenet: "mental-life-dream:verdant-soul" })]);
const place = async (a, x, y) => { const td = await a.getTokenDocument({ x: x * 100, y: y * 100 }); return (await scene.createEmbeddedDocuments("Token", [td.toObject()]))[0]; };
await place(blade, 5, 5); await place(dummy, 6, 5); await place(dummy2, 8, 5); await place(mage, 5, 8); await place(mind, 5, 11);
LT.A = { blade, dummy, dummy2, mage, mind, scene };
LT.tok = a => canvas.tokens.placeables.find(t => t.actor?.id === a.id);
LT.target = (...as) => { game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false })); for (const a of as) LT.tok(a)?.setTarget(true, { releaseOthers: false }); };
LT.reset = async (...as) => { for (const a of as) { await a.update({ "system.hp.value": a.system.hp.max, "system.hp.lost": 0, "system.energy.value": a.system.energy.max, "system.ap.value": 6, "system.rp.value": 6, "system.conditions": { ignite: 0, stain: 0, slow: 0, haste: 0 } }); for (const e of a.effects.contents) await e.delete(); for (const s of [...a.statuses]) await a.toggleStatusEffect(s, { active: false }); } };
return ({ actors: Object.fromEntries(Object.entries(LT.A).map(([k, a]) => [k, a.name ?? a])), hp: { blade: blade.system.hp.max, dummy: dummy.system.hp.max }, tokens: scene.tokens.size })
}
