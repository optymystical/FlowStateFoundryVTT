// The GM relay only carries out what the system itself asks of it.
const { relayAllowed } = await import("../../module/relay-guard.mjs");
let fails = 0; const ok2 = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const actions = { updateActor: 1, updateItem: 1, changeEffect: 1, setActorFlag: 1, setStatus: 1, moveToken: 1, wearItem: 1, castChange: 1, applyDamage: 1 };
const ok = (a, p) => relayAllowed(a, { action: a, ...p }, actions);

console.log("== what the system sends is accepted");
ok2(ok("updateActor", { uuid: "x", data: { "system.hp.value": 10, "system.hp.lost": 3 } }), "health");
ok2(ok("updateActor", { uuid: "x", data: { "system.ap.value": 2, "system.rp.value": 1, "system.energy.value": 40 } }), "pools");
ok2(ok("updateActor", { uuid: "x", data: { "system.conditions.slow": 20, "system.conditions.ignite": 0, "flags.flowstate.summon.reformMark": 4 } }), "conditions and the system's own flags");
ok2(ok("updateItem", { uuid: "x", data: { "system.wear": 5, "system.conditions.stain": 2, "system.placedOn": "", "system.carapace": 0 } }), "Durability, conditions, Ward placement");
ok2(ok("changeEffect", { uuid: "x", data: { "flags.flowstate.spellEffect.hp": 3, name: "Shield (3)", description: "..." } }) && ok("changeEffect", { uuid: "x", data: null }) && ok("changeEffect", { uuid: "x" }), "changing or removing a system effect");
ok2(ok("setStatus", { target: "x", status: "dead", active: true }) && ok("setActorFlag", { target: "x", key: "lockedDown", value: 1 }) && ok("moveToken", { uuid: "x", x: 100, y: 200 }) && ok("wearItem", { uuid: "x", amount: 4 }), "statuses, flags, thrown tokens, wear");
ok2(ok("applyDamage", { target: "x", amount: 5, type: "heat" }), "actions that only carry ids and numbers");

console.log("== what a modified client sends is refused");
ok2(!ok("updateActor", { uuid: "x", data: { "system.stats.str": 99 } }), "stats");
ok2(!ok("updateActor", { uuid: "x", data: { "system.hp.value": 1, "system.skillPoints": 999 } }), "one allowed field doesn't carry a forbidden one");
ok2(!ok("updateActor", { uuid: "x", data: { ownership: { default: 3 } } }) && !ok("updateActor", { uuid: "x", data: { "system.trees.martial-theory": 5 } }), "ownership and skill trees");
ok2(!ok("updateActor", { uuid: "x", data: {} }) && !ok("updateActor", { uuid: "x", data: [1] }) && !ok("updateActor", { uuid: "x" }), "empty or malformed data");
ok2(!ok("updateItem", { uuid: "x", data: { "system.grade": 99, name: "Godsword" } }), "item identity");
ok2(!ok("changeEffect", { uuid: "x", data: { disabled: true } }) && !ok("changeEffect", { uuid: "x", data: { changes: [] } }), "effect internals");
ok2(!ok("setStatus", { target: "x", status: "halfStealth", active: true }) && !ok("setStatus", { target: "x", status: "fullStealth", active: false }), "the GM-only stealth statuses can't be set through the relay");
ok2(!ok("setActorFlag", { target: "x", key: "__proto__.x", value: 1 }) && !ok("setActorFlag", { target: "x", key: 7, value: 1 }), "flag keys");
ok2(!ok("moveToken", { uuid: "x", x: "a", y: 1 }) && !ok("wearItem", { uuid: "x", amount: "lots" }), "non-numbers");
ok2(!relayAllowed("constructor", {}, actions) && !relayAllowed("toString", {}, actions) && !relayAllowed("nope", {}, actions) && !relayAllowed(null, {}, actions), "only real actions run, not inherited ones");

console.log(fails ? `${fails} FAILED` : "all relay guard tests passed");
process.exit(fails ? 1 : 0);
