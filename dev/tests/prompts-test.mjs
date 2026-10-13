// The GM's list of open prompts: questions have no timer, are listed, and can be cancelled.
let fails = 0; const ok2 = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const sent = []; let handler = null; const hooks = [];
const dialogsShown = [];
globalThis.foundry = { applications: { api: { DialogV2: { prompt: ({ window: w, render }) => new Promise(resolve => {
  const d = { title: w.title, answer: v => resolve(v), close: () => resolve(null) }; dialogsShown.push(d); render?.({}, d); }) } } } };
const gm = { id: "gm", name: "Gamemaster", isGM: true, active: true };
const player = { id: "p1", name: "The Construct", isGM: false, active: true };
globalThis.game = { user: gm, users: Object.assign([gm, player], { activeGM: gm }), socket: { emit: (ev, m) => sent.push(m), on: (ev, fn) => { handler = fn; } } };
globalThis.Hooks = { callAll: (name, ...a) => hooks.push([name, ...a]) };
const mine = { isOwner: true, name: "Rustgnaw", testUserPermission: () => false, getFlag: () => undefined };
const owned = { isOwner: true, name: "Thren", testUserPermission: (u) => u.id === "p1", getFlag: () => undefined };

const A = await import("../../module/ask.mjs");
A.listen();
const tick = () => new Promise(r => setTimeout(r, 5));

console.log("== a question for a player");
let result = "unset";
const asking = A.askFor(owned, { title: "Infuse (Tenet)", html: "<p>x</p>", react: "infuse" }).then(v => { result = v; });
await tick();
const ask = sent.find(m => m.action === "chargeAsk");
ok2(ask && ask.to === "p1" && ask.from === "gm", "it is sent to the player who owns the character");
ok2(A.openPrompts().length === 1 && A.openPrompts()[0].toName === "The Construct" && A.openPrompts()[0].about === "Thren" && A.openPrompts()[0].title === "Infuse (Tenet)", "…and shows in the GM's list: what, whom it waits on, and about whom");
await new Promise(r => setTimeout(r, 80));
ok2(result === "unset", "it simply waits: there is no timer that answers for them");
await handler({ action: "chargeAnswer", to: "gm", reqId: ask.reqId, answer: { ok: true } });
await asking;
ok2(result?.ok === true && A.openPrompts().length === 0, "their answer comes back, and the question leaves the list");

console.log("== cancelled by the GM");
sent.length = 0; result = "unset";
const asking2 = A.askFor(owned, { title: "Bane Ward", html: "<p>y</p>" }).then(v => { result = v; });
await tick();
const id2 = A.openPrompts()[0].id;
A.cancelPrompt(id2);
await asking2;
ok2(result === null && A.openPrompts().length === 0, "cancelling answers it \"no\" for whoever asked, and removes it from the list");
ok2(sent.some(m => m.action === "promptCancel" && m.id === id2), "…and tells every client, so the player's window closes");
await handler({ action: "chargeAnswer", to: "gm", reqId: id2, answer: { late: true } });
ok2(result === null, "a late answer is ignored");

console.log("== a window on this client");
dialogsShown.length = 0; result = "unset";
const asking3 = A.askFor(mine, { title: "Ward", html: "<p>z</p>" }).then(v => { result = v; });
await tick();
ok2(dialogsShown.length === 1 && A.openPrompts().length === 1, "a question for the GM themselves is shown here and listed too");
A.cancelPrompt(A.openPrompts()[0].id);
await asking3;
ok2(result === null && A.openPrompts().length === 0, "cancelling closes the window and answers no");

console.log("== the player's client closes a cancelled window");
dialogsShown.length = 0; globalThis.game.user = player; result = "unset";
const answering = handler({ action: "chargeAsk", to: "p1", from: "gm", reqId: "gm:99", spec: { title: "Tenet", html: "<p>q</p>" } });
await tick();
ok2(dialogsShown.length === 1, "a question sent to them opens a window");
await handler({ action: "promptCancel", id: "gm:99" });
await answering;
ok2(sent.some(m => m.action === "chargeAnswer" && m.reqId === "gm:99" && m.answer === null), "cancelling it closes the window and answers no");
globalThis.game.user = gm;

console.log("== someone goes offline");
sent.length = 0; result = "unset";
const asking4 = A.askFor(owned, { title: "Premonition", html: "<p>w</p>" }).then(v => { result = v; });
await tick();
A.userLeft(player);
await asking4;
ok2(result === null && A.openPrompts().length === 0, "a question waiting on a player who goes offline is answered no");

console.log("== a player announces their questions to the GM");
globalThis.game.user = player; sent.length = 0;
const theirs = { isOwner: false, name: "Orc", testUserPermission: () => false, getFlag: () => undefined };
globalThis.game.users = Object.assign([gm, player], { activeGM: gm });
const asking5 = A.askFor(theirs, { title: "Guard", html: "<p>v</p>" });
await tick();
ok2(sent.some(m => m.action === "promptOpen" && m.record.title === "Guard"), "a player's client announces the question to the GM");
const req = sent.find(m => m.action === "chargeAsk");
await handler({ action: "chargeAnswer", to: "p1", reqId: req.reqId, answer: null });
await asking5;
ok2(sent.some(m => m.action === "promptClose"), "…and announces that it ended");
globalThis.game.user = gm;
await handler({ action: "promptOpen", record: { id: "p1:7", title: "Remote", about: "x", to: "gm", toName: "G", from: "p1", fromName: "P", startedAt: Date.now() } });
ok2(A.openPrompts().some(r => r.id === "p1:7"), "a GM client lists what players announce");
await handler({ action: "promptClose", id: "p1:7" });
ok2(!A.openPrompts().some(r => r.id === "p1:7"), "…and drops it when they say it ended");

console.log(fails ? `${fails} FAILED` : "all prompt list tests passed");
process.exit(fails ? 1 : 0);
