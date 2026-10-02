// Grapple throws move the thrown token (open ground, wall, hit beside target, miss past target).
const src = await (await import("fs")).promises.readFile(new URL("./theory.mjs", import.meta.url), "utf8");
// Reuse the theory harness up to the helper definitions.
const cut = src.slice(0, src.indexOf("const hero = mkActor"));
const harness = cut.replace("globalThis.canvas = null;", "");
await (await import("fs")).promises.writeFile(new URL("./.tm-harness.mjs", import.meta.url), harness + `
let wall = null;
globalThis.CONST = {};
globalThis.CONFIG = { Canvas: { polygonBackends: { move: { testCollision: (a, b) => wall ? wall(a, b) : null } } } };
globalThis.canvas = { grid: { size: 100, isGridless: false, measurePath: ([p, q]) => ({ distance: Math.hypot(p.x - q.x, p.y - q.y) / 20 }), getCenterPoint: o => o }, dimensions: { size: 100, distance: 5, sceneX: 0, sceneY: 0, sceneWidth: 10000, sceneHeight: 10000 }, tokens: { controlled: [], placeables: [] }, scene: {} };
function place(actor, gx, gy) {
  const doc = { x: gx * 100, y: gy * 100, width: 1, height: 1, isOwner: true, uuid: actor.uuid + ".Token", update: async u => { Object.assign(doc, u); moves.push([actor.name, u.x / 100, u.y / 100]); } };
  const tok = { name: actor.name, actor, document: doc, get center() { return { x: doc.x + 50, y: doc.y + 50 }; } };
  actor.getActiveTokens = () => [tok]; canvas.tokens.placeables.push(tok); return tok;
}
const moves = [];
const hero = mkActor("Hero", {}, { "martial-theory": 1 });
const orc = mkActor("Orc"); const gob = mkActor("Goblin");
place(hero, 10, 10); place(orc, 11, 10); place(gob, 16, 10);
combat.combatant = { actor: hero };
dialog = c => c.includes('name="dir"') ? { dir: "e" } : { net: 0 };
const feet = actions.grappleThrowForce(hero);
console.log("force", feet);

console.log("== No target, east, open ground");
await actions.setGrapple(orc, hero.uuid); hero.system.ap.value = 6; game.user.targets = new Set();
await actions.throwGrappled(hero);
console.log("  moves", JSON.stringify(moves.splice(0)), "|", text(messages.at(-1)));

console.log("== No target, wall 3 ft east of orc");
orc.getActiveTokens()[0].document.x = 1100;
wall = (a, b) => ({ x: a.x + 60, y: a.y });   // 3 ft in
await actions.setGrapple(orc, hero.uuid); hero.system.ap.value = 6;
const hp0 = orc.system.hp.value;
await actions.throwGrappled(hero);
console.log("  moves", JSON.stringify(moves.splice(0)), "| orc HP", hp0, "->", orc.system.hp.value, "|", text(messages.at(-1)));
wall = null;

console.log("== At goblin: hit lands orc beside goblin");
orc.getActiveTokens()[0].document.x = 1100;
await actions.setGrapple(orc, hero.uuid); hero.system.ap.value = 6; game.user.targets = new Set([{ actor: gob }]);
seq = [30]; await actions.throwGrappled(hero); seq = [2];
await actions.defend(messages.at(-1), 0, "dodge");
console.log("  moves", JSON.stringify(moves.splice(0)), "|", text(messages.at(-1)).slice(0, 300));

console.log("== At goblin: miss flies past");
orc.getActiveTokens()[0].document.x = 1100;
await actions.setGrapple(orc, hero.uuid); hero.system.ap.value = 6;
seq = [3]; await actions.throwGrappled(hero); seq = [30];
await actions.defend(messages.at(-1), 0, "dodge");
console.log("  moves", JSON.stringify(moves.splice(0)), "|", text(messages.at(-1)).slice(0, 300));
`);
await import(new URL("./.tm-harness.mjs", import.meta.url));
