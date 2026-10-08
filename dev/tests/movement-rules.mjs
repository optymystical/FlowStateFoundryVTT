// Movement cost in combat: a step is paid only when you move past it; AP spent on an action settles a pending step and banks the rest.
let fails = 0; const ok = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const M = await import("../../module/movement-rules.mjs");
const step = { speedFt: 30, cost: 2 };

console.log("== The worked example (2 AP per 30 ft, 6 AP)");
let ap = 6, L = M.emptyLedger();
let m = M.planMove(L, 30, { ...step, ap }); ap -= m.apCost; L = m.ledger;
ok(m.ok && m.apCost === 0 && ap === 6 && L.pending && L.ft === 0, "Move 30 ft: nothing is spent yet (2 AP of movement is pending)");
let a = M.planAction(L, 3, step); ap -= a.apCost; L = a.ledger;
ok(a.apCost === 3 && ap === 3 && !L.pending && L.bank === 1, "Cast a 3 AP spell: it settles the pending 2 AP of movement and banks the other 1 AP");
m = M.planMove(L, 40, { ...step, ap }); ap -= m.apCost; L = m.ledger;
ok(m.ok && m.apCost === 1 && ap === 2, "Move 40 ft: the first 30 ft cost 1 AP (2 minus the 1 banked), spent because the move went further");
ok(L.pending && L.ft === 20 && L.bank === 0, "…and 10 ft of the next step's 30 ft are used: 20 ft left, its 2 AP still pending");

console.log("== Pending steps");
m = M.planMove(M.emptyLedger(), 20, { ...step, ap: 6 });
ok(m.apCost === 0 && m.ledger.ft === 10 && m.ledger.pending, "A short move costs nothing and leaves the rest of the step");
m = M.planMove(m.ledger, 10, { ...step, ap: 6 });
ok(m.apCost === 0 && m.ledger.ft === 0, "…which can be used up for nothing too");
m = M.planMove(m.ledger, 5, { ...step, ap: 6 });
ok(m.apCost === 2 && m.ledger.pending && m.ledger.ft === 25, "One more foot pays for the step it was in (2 AP) and opens the next");
a = M.planAction(M.planMove(M.emptyLedger(), 20, { ...step, ap: 6 }).ledger, 2, step);
ok(a.apCost === 2 && !a.ledger.pending && a.ledger.bank === 0 && a.ledger.ft === 10, "A 2 AP action mid-step settles it exactly; the 10 ft left stay free");
a = M.planAction(M.planMove(M.emptyLedger(), 20, { ...step, ap: 6 }).ledger, 1, step);
ok(a.ledger.pending && a.ledger.bank === 1, "A 1 AP action doesn't settle a 2 AP step: it's banked toward it");
m = M.planMove(a.ledger, 40, { ...step, ap: 6 });
ok(m.apCost === 1, "…so moving on later pays only the other 1 AP");

console.log("== Banks");
a = M.planAction(M.emptyLedger(), 5, step);
ok(a.ledger.bank === 5 && !a.ledger.pending, "A 5 AP action before any move banks 5 AP");
m = M.planMove(a.ledger, 60, { ...step, ap: 1 });
ok(m.ok && m.apCost === 0 && m.ledger.bank === 1, "…which covers two whole steps (60 ft) with nothing to pay");
m = M.planMove(a.ledger, 70, { ...step, ap: 1 });
ok(m.ok && m.apCost === 0 && m.ledger.pending && m.ledger.bank === 1, "…and 70 ft: the third step opens (the 1 AP left plus the 1 banked can pay for it) and stays pending");

console.log("== Can't walk on AP you don't have");
m = M.planMove(M.emptyLedger(), 10, { ...step, ap: 1 });
ok(!m.ok, "With 1 AP and a 2 AP step you can't start moving");
m = M.planMove(M.emptyLedger(), 10, { ...step, ap: 2 });
ok(m.ok && m.apCost === 0, "With 2 AP you can (nothing is spent)");
m = M.planMove(M.emptyLedger(), 70, { ...step, ap: 3 });
ok(!m.ok, "70 ft needs two steps paid and a third affordable: 3 AP isn't enough");
m = M.planMove(M.emptyLedger(), 70, { ...step, ap: 6 });
ok(m.ok && m.apCost === 4 && m.ledger.pending && m.ledger.ft === 20, "…6 AP pays two steps (4 AP) and the third stays pending");
m = M.planMove(M.emptyLedger(), 0, { ...step, ap: 0 });
ok(m.ok && m.apCost === 0, "Not moving costs nothing, with any AP");
m = M.planMove(M.emptyLedger(), 100, { speedFt: 105, cost: 1, ap: 1 });
ok(m.ok && m.apCost === 0 && m.ledger.ft === 5, "Haste (105 ft for 1 AP): 100 ft is one pending step");

console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
