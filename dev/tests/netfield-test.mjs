// Custom Advantage setting: field hidden by default; plain rolls skip the dialog.
let custom = false, dialogs = 0;
globalThis.foundry = { applications: { api: { DialogV2: { prompt: async ({ content }) => { dialogs++; return { net: content.includes('name="net"') ? 2 : 0 }; } } } },
  utils: { escapeHTML: s => s } };
globalThis.game = { settings: { get: (s, k) => (k === "customAdvantage" ? custom : false) }, combat: null, user: { targets: new Set() } };
const rolls = [];
globalThis.Roll = class { constructor(f) { this.formula = f; } async evaluate() { this.total = 7; rolls.push(this.formula); return this; } async render() { return ""; } };
globalThis.ChatMessage = { getSpeaker: () => ({}), create: async d => d };
const actions = await import("../../module/actions.mjs");
const actor = { name: "A", uuid: "A", statuses: new Set(), system: { exhausted: false, penalties: { physicalDis: 0 }, derived: { dodgeDie: 15, attackDie: 30 } } };
await actions.rollDodge(actor); await actions.rollAttackCheck(actor);
console.log("off: dialogs", dialogs, "rolls", rolls.splice(0));
custom = true; dialogs = 0;
await actions.rollDodge(actor); await actions.rollAttackCheck(actor);
console.log("on:  dialogs", dialogs, "rolls", rolls.splice(0));
