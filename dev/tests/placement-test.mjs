// Putting a token or a pile beside another on gridless and hex scenes.
const P = await import("../../module/placement.mjs");
const D = await import("../../module/distance.mjs");
let fails = 0; const ok2 = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const T = (x, y, n = 1) => ({ x, y, w: n * 100, h: n * 100 });
const gridless = { size: 100, distance: 5, kind: "gridless" };

console.log("== geometry");
ok2(P.halfExtent(100, 100, 1, 0) === 50 && Math.round(P.halfExtent(100, 100, Math.SQRT1_2, Math.SQRT1_2)) === 71 && P.halfExtent(200, 100, 0, 1) === 50, "distance from a token's centre to its border along a direction");
ok2(P.overlapping(T(0, 0), T(50, 0)) && !P.overlapping(T(0, 0), T(100, 0)) && !P.overlapping(T(0, 0), T(86, 50)), "round tokens: overlapping, side by side, and hex neighbours whose boxes overlap don't count");
ok2(P.touching(T(0, 0), T(100, 0)) && !P.touching(T(0, 0), T(300, 0)), "touching");

console.log("== candidate spots");
const spots = P.candidateSpots(T(0, 0), { w: 100, h: 100 });
ok2(spots.length === 16 && spots[0].x === 100 && spots[0].y === 0, "the first spot is on the preferred side (east by default), touching the token");
ok2(spots.every(s => D.borderDistance(T(0, 0), { ...s, w: 100, h: 100 }, gridless) < 0.01 || D.borderDistance(T(0, 0), { ...s, w: 100, h: 100 }, gridless) < 5), "every spot touches the token (0 ft on a gridless scene)");
const west = P.candidateSpots(T(0, 0), { w: 100, h: 100 }, { x: -1, y: 0 })[0];
ok2(west.x === -100, "…or on the side facing someone: west for a token to the west");
const big = P.candidateSpots(T(0, 0, 2), { w: 100, h: 100 }, { x: 0, y: 1 })[0];
ok2(Math.abs(big.y - 200) < 0.01, "a Large anchor puts the spot beyond its whole width");

console.log("== picking a free spot");
const anchor = T(0, 0);
const free = P.pickSpot({ anchor, mover: { w: 100, h: 100 }, others: [] , from: T(500, 0)});
ok2(free && free.x >= 0 && free.x <= 100, "with nothing in the way it picks the spot nearest the mover's old position (the east side for one coming from the east)");
const taken = [T(100, 0), T(100, 100), T(100, -100)];
const around = P.pickSpot({ anchor, mover: { w: 100, h: 100 }, others: taken, from: T(500, 0) });
ok2(around && !taken.some(o => P.overlapping({ ...around, w: 100, h: 100 }, o)) && P.touching({ ...around, w: 100, h: 100 }, anchor), "occupied spots are skipped: it goes around to a free one that still touches");
const ring = []; for (let a = 0; a < 16; a++) ring.push({ x: Math.cos(a * Math.PI / 8) * 100, y: Math.sin(a * Math.PI / 8) * 100, w: 100, h: 100 });
ok2(P.pickSpot({ anchor, mover: { w: 100, h: 100 }, others: ring }) === null, "a token boxed in on every side has no spot");
const near = P.pickSpot({ anchor, mover: { w: 100, h: 100 }, from: T(500, 0), inReach: c => c.x < 60 });
ok2(near && near.x < 60 + 50, "a spot inside the attacker's reach beats one outside it, even if the pull is longer");
const snapped = P.pickSpot({ anchor, mover: { w: 100, h: 100 }, from: T(500, 0), snap: p => ({ x: Math.round(p.x / 100) * 100, y: Math.round(p.y / 100) * 100 }) });
ok2(snapped && snapped.x % 100 === 0 && snapped.y % 100 === 0, "candidates are put on the grid by the snap function the caller supplies");

console.log(fails ? `${fails} FAILED` : "all placement tests passed");
process.exit(fails ? 1 : 0);
