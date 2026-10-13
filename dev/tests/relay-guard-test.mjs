// The GM relay only carries out what the system itself asks of it.
const { relayAllowed, relayKey, makeQueue } = await import("../../module/relay-guard.mjs");
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

console.log("== one request at a time per creature");
{ const run = makeQueue(); const log = [];
  const slow = (name, ms) => () => new Promise(r => setTimeout(() => { log.push(name); r(name); }, ms));
  await Promise.all([run("A", slow("A1", 30)), run("A", slow("A2", 1)), run("B", slow("B1", 5))]);
  ok2(log.indexOf("A1") < log.indexOf("A2"), "two requests for one creature run in the order they arrived, the second after the first has finished");
  ok2(log.indexOf("B1") < log.indexOf("A1"), "…while a different creature isn't made to wait");
  const failing = run("C", () => Promise.reject(new Error("boom")));
  await failing.catch(() => {});
  ok2(await run("C", () => "after") === "after", "a request that fails doesn't block the ones behind it");
  ok2(await run(null, () => "free") === "free" && await run(undefined, () => 7) === 7, "requests that name no creature just run");
  // The race itself: two read-modify-writes on one number, queued, don't lose an update.
  const doc = { hp: 100 }; const dmg = n => async () => { const read = doc.hp; await new Promise(r => setTimeout(r, 5)); doc.hp = read - n; };
  await Promise.all([run("D", dmg(10)), run("D", dmg(7))]);
  ok2(doc.hp === 83, "two hits at once both land (100 - 10 - 7 = 83)");
  const raw = { hp: 100 }; const rawDmg = n => async () => { const read = raw.hp; await new Promise(r => setTimeout(r, 5)); raw.hp = read - n; };
  await Promise.all([rawDmg(10)(), rawDmg(7)()]);
  ok2(raw.hp !== 83, "(without the queue one of them is lost)"); }
ok2(relayKey({ target: "Actor.a" }) === "Actor.a" && relayKey({ uuid: "Actor.a.Item.b" }) === "Actor.a" && relayKey({ uuid: "Actor.a.Item.b.ActiveEffect.c" }) === "Actor.a" && relayKey({ sceneId: "s1" }) === "s1" && relayKey({}) === null, "the key is the creature: an item or effect of it counts as it");

console.log(fails ? `${fails} FAILED` : "all relay guard tests passed");
process.exit(fails ? 1 : 0);
