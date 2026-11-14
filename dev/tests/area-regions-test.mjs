// Areas as Regions (Foundry v14 merged Measured Templates into Regions): an area shape in feet goes to Region data in pixels and back unchanged.
import assert from "node:assert/strict";
const A = await import("../../module/areas.mjs");
const grid = { size: 100, distance: 5 };          // 20 px per foot
for (const shape of ["radius", "cone", "line"]) {
  for (const scale of [1, 2]) {
    const tpl = A.areaTemplate(shape, { x: 300, y: 400, direction: 45, scale });
    const data = A.areaRegionData(tpl, { grid, userId: "U1", flags: { areaOf: "Actor.a" } });
    assert.equal(data.shapes.length, 1);
    assert.equal(data.shapes[0].gridBased, false);
    assert.equal(data.ownership.U1, 3);
    assert.equal(data.flags.flowstate.areaOf, "Actor.a");
    const back = A.regionTpl(data, grid);
    for (const k of ["t", "x", "y", "distance"]) assert.equal(back[k], tpl[k], `${shape} ×${scale}: ${k}`);
    if (shape !== "radius") assert.equal(back.direction, 45);
    if (shape === "cone") assert.equal(back.angle, 90);
    if (shape === "line") assert.equal(back.width, 5 * scale, "a line's width comes back in feet (the old template path read it in pixels)");
  }
}
// Pixels: a 10 ft radius is 200 px; a 30 ft line is 600 px long and 100 px wide.
assert.equal(A.areaRegionData(A.areaTemplate("radius", {}), { grid }).shapes[0].radius, 200);
const line = A.areaRegionData(A.areaTemplate("line", {}), { grid }).shapes[0];
assert.deepEqual([line.type, line.length, line.width], ["line", 600, 100]);
// The same tokens are inside before and after the trip.
const toks = [{ x: 280, y: 380, width: 1, height: 1, id: "near" }, { x: 2000, y: 2000, width: 1, height: 1, id: "far" }];
const tpl = A.areaTemplate("radius", { x: 300, y: 400 });
assert.deepEqual(A.tokensInArea(A.regionTpl(A.areaRegionData(tpl, { grid }), grid), toks, grid).map(t => t.id), A.tokensInArea(tpl, toks, grid).map(t => t.id));
// Only the system's Regions count as areas (an ordinary terrain or GM Region doesn't).
const scene = { regions: [{ id: "a", flags: { flowstate: { areaOf: "x" } } }, { id: "b", flags: { flowstate: { terrain: 1 } } }, { id: "c", flags: {} }, { id: "d", flags: { flowstate: { spell: "emplace" } } }] };
assert.deepEqual(A.areaRegions(scene).map(r => r.id), ["a", "d"]);
assert.equal(A.areaRegion(scene, "d").id, "d");
console.log("area regions tests passed");
