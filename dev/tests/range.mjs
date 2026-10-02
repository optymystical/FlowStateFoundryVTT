class Field { constructor(o={}){ Object.assign(this,o); } }
globalThis.foundry = { data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field } }, abstract: { TypeDataModel: class {} }, utils: { escapeHTML: s => s } };
const warns = []; globalThis.ui = { notifications: { warn: m => warns.push(m) } };
// 5 ft squares; a token occupies size×size squares from (x,y). Distance = Chebyshev squares × 5 (Foundry's default 5/5 diagonals).
const tok = (name, x, y, size=1) => ({ name, document: { getOccupiedGridSpaceOffsets: () => { const o=[]; for (let i=0;i<size;i++) for (let j=0;j<size;j++) o.push({i:y+i,j:x+j}); return o; } } });
globalThis.canvas = { tokens: { controlled: [] }, grid: { getCenterPoint: o => ({ x: o.j, y: o.i }), measurePath: ([a,b]) => ({ distance: Math.max(Math.abs(a.x-b.x), Math.abs(a.y-b.y)) * 5 }) } };
globalThis.game = { settings: { get: () => true }, user: { targets: new Set() } };
const actions = await import("../../module/actions.mjs");
const hero = { uuid: "A.h", getActiveTokens: () => [tok("Hero", 0, 0)] };
const check = (targets, range, label) => { game.user.targets = new Set(targets); warns.length = 0; const ok = actions.checkRange(hero, range, label); console.log(label.padEnd(34), ok ? "allowed" : "BLOCKED: " + warns[0]); };
check([tok("Orc (adjacent)", 1, 0)], 5, "melee 5 ft, adjacent");
check([tok("Orc (2 squares)", 2, 0)], 5, "melee 5 ft, 10 ft away");
check([tok("Orc (2 squares)", 2, 0)], 10, "Farstrike 10 ft, 10 ft away");
check([tok("Ogre size 4, 2x2", 2, 0, 2)], 5, "melee 5 ft vs big creature 1 sq gap");
check([tok("Ogre size 4, 2x2", 1, 0, 2)], 5, "melee 5 ft vs adjacent big creature");
check([tok("Archer", 30, 0), tok("Orc", 1, 0)], 100, "100 ft band, one at 150 ft");
