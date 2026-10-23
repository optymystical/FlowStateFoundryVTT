// Distance between tokens on square, hex and gridless scenes.
const { borderDistance, centreDistance, tokenPos, tokenCentre } = await import("../../module/distance.mjs");
let fails = 0; const ok2 = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const T = (x, y, n = 1) => ({ x, y, w: n * 100, h: n * 100 });
const square = { size: 100, distance: 5, kind: "square" };
const gridless = { size: 100, distance: 5, kind: "gridless" };
// A stand-in for Foundry's hex path measure: one hex = 5 ft, hexes counted along the larger axis by the hex pitch (100 px).
const hex = { size: 100, distance: 5, kind: "hex", measure: (a, b) => Math.round(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) / 100) * 5 };

console.log("== square (unchanged)");
ok2(borderDistance(T(0, 0), T(100, 0), square) === 0 && borderDistance(T(0, 0), T(100, 100), square) === 0, "touching, side or diagonal: 0 ft");
ok2(borderDistance(T(0, 0), T(200, 0), square) === 5 && borderDistance(T(0, 0), T(300, 300), square) === 10, "a gap of one square is 5 ft; diagonals count one square");
ok2(borderDistance(T(0, 0, 2), T(300, 0), square) === 5, "large tokens measure from their border");

console.log("== gridless");
ok2(borderDistance(T(0, 0), T(100, 0), gridless) === 0, "touching: 0 ft");
ok2(borderDistance(T(0, 0), T(200, 0), gridless) === 5, "a straight gap of 100 px is 5 ft");
ok2(borderDistance(T(0, 0), T(300, 300), gridless) === 14.14, "a diagonal gap is the straight line (10 ft by the square rule, 14.14 here)");
ok2(borderDistance(T(0, 0), T(150, 0), gridless) === 2.5, "half-square gaps count: measured to the pixel");

console.log("== hex");
ok2(borderDistance(T(0, 0), T(100, 0), hex) === 0, "neighbouring hexes touch: 0 ft");
ok2(borderDistance(T(0, 0), T(300, 0), hex) === 10, "centres three hexes apart, borders two apart: 10 ft");
ok2(borderDistance(T(0, 0, 2), T(250, 50), hex) === 2.5, "a Large token's half width comes off the distance");
ok2(borderDistance(T(0, 0), T(0, 0), hex) === 0, "never negative");

console.log("== centres");
ok2(centreDistance({ x: 0, y: 0 }, { x: 300, y: 400 }, square) === 20 && centreDistance({ x: 0, y: 0 }, { x: 300, y: 400 }, gridless) === 25, "square counts the larger axis, gridless the straight line");
ok2(centreDistance({ x: 0, y: 0 }, { x: 300, y: 0 }, hex) === 15, "hexes use the grid's own measure");

console.log("== a moving token is where its move ends");
// Foundry v14: during (or after a stalled) move animation the document's x/y lag behind; `_source` is where the token is.
const moving = { document: { x: 1000, y: 1200, width: 1, height: 1, _source: { x: 2200, y: 1200 } } };
ok2(tokenPos(moving).x === 2200 && tokenCentre(moving).x === 2250 && tokenCentre(moving).y === 1250, "position and centre come from the stored position, not the animated one");
ok2(tokenPos({ center: { x: 50, y: 60 } }).x === 50 && tokenCentre({ center: { x: 50, y: 60 } }).y === 60, "something with only a centre falls back to it");
const viaFoundry = { document: { x: 0, y: 0, width: 1, height: 1, _source: { x: 300, y: 0 }, getCenterPoint: p => ({ x: p.x + 43, y: p.y + 50 }) } };
ok2(tokenCentre(viaFoundry).x === 343, "Foundry's own centre for the stored spot is used when the document has one (hexes)");

console.log(fails ? `${fails} FAILED` : "all distance tests passed");
process.exit(fails ? 1 : 0);
