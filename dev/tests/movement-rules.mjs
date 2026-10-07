// Movement cost in combat: pay only for distance nothing has covered; actions' AP covers movement (strafing); the open step's AP can pay an action.
let fails = 0; const ok = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const M = await import("../../module/movement-rules.mjs");
const step = { speedFt: 30, cost: 2 };

console.log("== The worked example (2 AP per 30 ft, 6 AP)");
let ap = 6, L = M.emptyLedger();
let m = M.planMove(L, 30, { ...step, ap }); ap -= m.apCost; L = m.ledger;
ok(m.apCost === 2 && ap === 4 && L.ft === 0 && L.openAp === 0, "Moving 30 ft opens a step (2 AP) and uses all of it: 4 AP left, nothing open");
let a = M.planAction(L, 3, step); ap -= a.apCost; L = a.ledger;
ok(a.apCost === 3 && !a.fromOpen && ap === 1 && L.freeFt === 30 && L.bank === 1, "A 3 AP spell is paid in full, covers a fresh 30 ft of movement and banks the extra 1 AP");
m = M.planMove(L, 40, { ...step, ap }); ap -= m.apCost; L = m.ledger;
ok(m.apCost === 1 && ap === 0 && L.freeFt === 0 && L.bank === 0, "Moving 40 ft: 30 ft are covered, the other 10 ft open a step that costs 2 AP, 1 of it from the bank: 1 AP");
ok(L.ft === 20 && L.openAp === 2 && M.availableAp(ap, L) === 2, "The step is still open (20 ft, 2 AP): the sheet shows 2 AP left");

console.log("== Strafing");
L = M.emptyLedger(); ap = 6;
m = M.planMove(L, 20, { ...step, ap }); ap -= m.apCost; L = m.ledger;
ok(L.ft === 10 && L.openAp === 2, "Moving 20 ft leaves 10 ft and the step's 2 AP open");
a = M.planAction(L, 2, step); ap -= a.apCost; L = a.ledger;
ok(a.fromOpen && a.apCost === 0 && ap === 4 && L.openAp === 0 && L.ft === 10 && L.freeFt === 0, "A 2 AP action fits in the open step: it costs nothing extra, covers no new movement, and the remaining 10 ft stay free");
m = M.planMove(L, 10, { ...step, ap }); ok(m.apCost === 0, "…and those 10 ft are free");
a = M.planAction(M.planMove(M.emptyLedger(), 20, { ...step, ap: 6 }).ledger, 3, step);
ok(!a.fromOpen && a.apCost === 3, "An action bigger than the open step's AP is paid in real AP");

console.log("== Steps, banks and limits");
m = M.planMove(M.emptyLedger(), 70, { ...step, ap: 6 });
ok(m.apCost === 6 && m.ok && m.ledger.ft === 20, "70 ft takes three steps: 6 AP");
m = M.planMove(M.emptyLedger(), 70, { ...step, ap: 5 });
ok(!m.ok, "…which 5 AP can't pay");
a = M.planAction(M.emptyLedger(), 5, step);
ok(a.ledger.freeFt === 60 && a.ledger.bank === 1, "A 5 AP action covers two whole steps (60 ft) and banks 1 AP");
m = M.planMove(M.emptyLedger(), 0, { ...step, ap: 0 });
ok(m.apCost === 0 && m.ok, "Not moving costs nothing");
m = M.planMove(M.emptyLedger(), 100, { speedFt: 105, cost: 1, ap: 1 });
ok(m.apCost === 1 && m.ledger.ft === 5, "Haste (105 ft for 1 AP): 100 ft costs 1 AP");
m = M.planMove(M.emptyLedger(), 5, { speedFt: 35, cost: 1, ap: 6 });
ok(m.apCost === 1 && m.ledger.openAp === 1, "Even a 5 ft move opens a whole step (1 AP) and leaves it open");
ok(M.availableAp(4, { openAp: 2 }) === 6 && M.availableAp(4, null) === 4, "AP left = real AP + open AP");

console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
