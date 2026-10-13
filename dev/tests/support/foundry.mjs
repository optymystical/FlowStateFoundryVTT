// The Foundry globals the harnesses share: enough of `foundry`, `Roll`, `ChatMessage`, `game`, `ui` and `fromUuid` to drive the real engine.
// A harness keeps its own `seq` (scripted dice), `messages`, `uuids` and `dialog` variables and hands in getters, so its body reads as it always did:
//   const { combat } = installFoundry({ roll: () => (seq.length ? seq.shift() : 10), dialog: c => dialog(c), messages, uuids });
// Users are real-looking (an online GM), which is what the prompt-routing code looks at; harnesses that need a player push one into `game.users`.
export class Field { constructor(o = {}) { Object.assign(this, o); } }

export function installFoundry({ roll, dialog, confirm = () => true, wait = () => "ap", messages, uuids }) {
  globalThis.foundry = {
    data: { fields: { NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field, ObjectField: Field } },
    abstract: { TypeDataModel: class {} },
    utils: { escapeHTML: s => s, deepClone: o => structuredClone(o), getProperty: (o, k) => k.split(".").reduce((a, b) => a?.[b], o),
      setProperty: (o, k, v) => { const p = k.split("."); let c = o; for (const x of p.slice(0, -1)) c = c[x] ??= {}; c[p.at(-1)] = v; } },
    applications: { api: { DialogV2: { prompt: async ({ content }) => dialog(content), confirm: async () => confirm(), wait: async () => wait() } } }
  };
  globalThis.Roll = class {
    constructor(f) { this.formula = f; }
    async evaluate() { this.total = roll(); return this; }
    async render() { return `<roll ${this.formula}=${this.total}>`; }
  };
  globalThis.ChatMessage = {
    getSpeaker: ({ actor }) => ({ alias: actor.name }),
    create: async d => {
      const m = { id: "m" + messages.length, ...d, getFlag: (s, k) => m.flags?.[s]?.[k],
        setFlag: async (s, k, v) => { m.flags ??= {}; (m.flags[s] ??= {})[k] = v; },
        update: async u => { for (const [k, v] of Object.entries(u)) foundry.utils.setProperty(m, k, v); } };
      messages.push(m);
      return m;
    }
  };
  const combat = { id: "C", started: true, round: 1, turn: 0, combatant: null, combatants: [] };
  const gm = { id: "gm", isGM: true, active: true };
  globalThis.game = {
    settings: { get: () => false },
    messages: { find: fn => messages.find(fn), filter: fn => messages.filter(fn), get: id => messages.find(m => m.id === id) },
    combat,
    users: Object.assign([gm], { activeGM: gm }),
    socket: { emit: (...a) => console.log("  socket emit", JSON.stringify(a[1])), on: () => {} },
    user: { targets: new Set(), isGM: false },
    actors: []
  };
  globalThis.ui = { notifications: { warn: m => console.log("  WARN", m), info: m => console.log("  INFO", m), error: m => console.log("  ERR", m) } };
  globalThis.canvas = null;
  globalThis.fromUuid = async u => uuids.get(u);
  globalThis.fromUuidSync = u => uuids.get(u);
  return { combat, gm };
}
