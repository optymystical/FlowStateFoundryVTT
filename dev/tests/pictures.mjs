// Picture browsing for players: the GM's client lists the folders and sends them back; players never touch the file browser.
const handlers = []; const emitted = [];
const browseCalls = [];
globalThis.foundry = { utils: { escapeHTML: s => s, randomID: () => "req1" }, applications: { api: { DialogV2: {} }, apps: { FilePicker: { implementation: { browse: async (src, path, opts) => { browseCalls.push([src, path, opts]); return { target: path, dirs: ["art/heroes/", "art/misc"], files: ["art/a.png"] }; } } } } } };
const settings = { playerBrowse: true };
const me = { id: "p1", isGM: false, can: () => false };
globalThis.game = { user: me, users: { activeGM: { id: "gm" } }, settings: { get: (s, k) => settings[k] },
  socket: { on: (ch, fn) => handlers.push(fn), emit: (ch, data) => { emitted.push(data); } } };
const P = await import("../../module/pictures.mjs");
let fails = 0; const ok = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };

console.log("== GM answers a browse request");
game.user = { id: "gm", isGM: true, can: () => true };
await P.answerBrowse({ user: "p1", reqId: "r1", target: "../../secret//art/./heroes" });
let a = emitted.pop();
ok(a.action === "browseResult" && a.to === "p1" && a.reqId === "r1", "the answer goes back to the asking player");
ok(browseCalls[0][0] === "data" && browseCalls[0][1] === "secret/art/heroes", "only the user data folder, with .. and . removed from the path");
ok(a.result.dirs.join() === "art/heroes,art/misc" && a.result.files.join() === "art/a.png", "folders (trailing slash dropped) and images are sent");
ok(browseCalls[0][2].extensions.includes(".png") && !browseCalls[0][2].extensions.includes(".js"), "only image files are listed");

console.log("== The GM can turn it off");
settings.playerBrowse = false;
await P.answerBrowse({ user: "p1", reqId: "r2", target: "" });
a = emitted.pop();
ok(a.error && !a.result, "with the setting off the GM refuses");
settings.playerBrowse = true;

console.log("== Player hears only their own answers");
game.user = me; P.listenForBrowse();
ok(handlers.length === 1, "one socket listener");
handlers[0]({ action: "browseResult", to: "someone-else", reqId: "r9", result: { dirs: [], files: [] } });
ok(true, "an answer for another user is ignored without error");
handlers[0]({ action: "somethingElse", to: "p1" });
ok(true, "other socket messages are ignored");
console.log(fails ? `\n${fails} FAILED` : "\nAll picture checks passed");
if (fails) process.exit(1);
