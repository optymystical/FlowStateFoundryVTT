class Field { constructor(o={}){ Object.assign(this,o); } }
const log = (...a) => console.log(" ", ...a);
globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3 }, TOKEN_DISPOSITIONS: { NEUTRAL: 0 }, TOKEN_DISPLAY_MODES: { HOVER: 30 } };
globalThis.foundry = { applications: { api: { DialogV2: { prompt: async () => ({ equip: 'no' }) } } }, data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field } }, abstract: { TypeDataModel: class {} },
  utils: { escapeHTML: s => s, deepClone: o => structuredClone(o), mergeObject: (a, b) => { for (const k in b) a[k] = (typeof b[k] === "object" && a[k]) ? { ...a[k], ...b[k] } : b[k]; return a; } } };
globalThis.ui = { notifications: { warn: m => log("WARN", m), info: m => log("INFO", m), error: m => log("ERR", m) } };
const gs = 100;
const tok = (name, gx, gy, actor, size=1) => ({ name, actor, center: { x: gx*gs + size*gs/2, y: gy*gs + size*gs/2 }, document: { x: gx*gs, y: gy*gs, width: size, height: size, getOccupiedGridSpaceOffsets: () => { const o=[]; for (let i=0;i<size;i++) for (let j=0;j<size;j++) o.push({i:gy+i,j:gx+j}); return o; } } });
globalThis.canvas = { scene: { id: "S1" }, tokens: { controlled: [] }, grid: { size: gs, getCenterPoint: o => ({ x: o.j, y: o.i }), measurePath: ([a,b]) => ({ distance: Math.max(Math.abs(a.x-b.x), Math.abs(a.y-b.y)) * 5 }) } };
const created = [];
globalThis.game = { combat: null, user: { isGM: true, targets: new Set(), character: null }, users: { activeGM: {} }, settings: { get: () => true },
  folders: { find: () => ({ id: "F" }) }, scenes: { get: () => ({ createEmbeddedDocuments: async (t, d) => created.push(...d) }) } };
const piles = [];
globalThis.Actor = { create: async d => { const items = new Map(d.items.map((it, n) => ["i"+n, mkItem(it, "i"+n)])); const pile = { ...d, id: "P1", type: "pile", items,
  getTokenDocument: async pos => ({ toObject: () => ({ name: d.name, ...pos }) }), getActiveTokens: () => [tok("pile", pos0.x/gs, pos0.y/gs)] }; piles.push(pile); return pile; } };
let pos0;
function mkItem(data, id) { const it = { ...structuredClone(data), id, toObject: () => structuredClone(data), deleted: false };
  it.delete = async () => { it.deleted = true; for (const p of piles) p.items.delete(id); }; it.update = async u => log("item.update", JSON.stringify(u)); return it; }
const actions = await import("../../module/actions.mjs");

const heroActor = { uuid: "A.hero", name: "Hero", isOwner: true, items: [], system: { derived: { size: { melee: 5 } } }, created: [] };
heroActor.createEmbeddedDocuments = async (t, d) => { heroActor.created.push(...d); return d.map(x => ({ ...x, update: async () => {} })); };
const heroTok = tok("Hero", 0, 0, heroActor); heroActor.getActiveTokens = () => [heroTok];
const orcTok = tok("Orc", 4, 3, { type: "npc" });

console.log("== Throw at an Orc 4 right, 3 down: lands on the Orc's side facing the thrower");
const spear = mkItem({ name: "Spear", type: "weapon", img: "spear.webp", system: { weaponType: "reach", equipped: true, twoHanded: true } }, "w1");
const origCreate = actions.GM_ACTIONS.createPile;
actions.GM_ACTIONS.createPile = async p => { pos0 = { x: p.x, y: p.y }; log("createPile at", p.x/gs, p.y/gs, "(grid)", "item equipped:", p.item.system.equipped, "2H:", p.item.system.twoHanded); await origCreate(p); };
await actions.dropItem(heroActor, spear, orcTok);
log("spear removed from hero:", spear.deleted, "| token placed:", JSON.stringify(created[0]));

console.log("== Pick up from too far away (hero at 0,0; pile at 3,2)");
canvas.tokens.controlled = [heroTok];
const pile = piles[0]; const pileItem = [...pile.items.values()][0];
await actions.pickUp(pile, pileItem);

console.log("== Walk next to it and pick up");
heroTok.center = { x: 2*gs+50, y: 2*gs+50 }; heroTok.document.x = 200; heroTok.document.y = 200;
heroTok.document.getOccupiedGridSpaceOffsets = () => [{ i: 2, j: 2 }];
actions.GM_ACTIONS.deletePile = async ({ actorId }) => log("deletePile", actorId);
await actions.pickUp(pile, pileItem);
log("hero got:", heroActor.created.map(i => `${i.name} (equipped ${i.system.equipped})`).join(", "), "| pile items left:", pile.items.size);

console.log("== Throw with no target: lands beside the thrower");
await actions.dropItem(heroActor, mkItem({ name: "Knife", type: "weapon", img: "k", system: {} }, "w2"), null);
