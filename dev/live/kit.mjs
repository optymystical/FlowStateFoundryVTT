// Live test kit for a running Foundry world (dev only, not loaded by the system): in the browser console, as a GM,
//   await import("/systems/flowstate/dev/live/kit.mjs?" + Date.now())
// Scripted dice (LT.dice(18, 3, 4)), dialogs answered like a user (LT.fill = { name: value }; OK is pressed), and helpers.
window.LT = window.LT ?? {};
const DT = foundry.dice.terms.DiceTerm.prototype;
if (!LT._origFace) LT._origFace = DT.randomFace;
LT.q = [];
DT.randomFace = function () { if (LT.q.length) { const v = LT.q.shift(); return Math.max(1, Math.min(this.faces, v === "max" ? this.faces : v)); } return LT._origFace.call(this); };
LT.dice = (...v) => { LT.q = v.flat(); };
const D = foundry.applications.api.DialogV2;
if (!LT._orig) LT._orig = { prompt: D.prompt.bind(D), confirm: D.confirm.bind(D), wait: D.wait.bind(D) };
LT.log = []; LT.auto = true; LT.fill = null; LT.confirmAns = true; LT.choice = null; LT.answer = null;
const fillForm = (el, content) => { const vals = typeof LT.fill === "function" ? LT.fill(content, el) : LT.fill; if (!vals) return; for (const [k, v] of Object.entries(vals)) for (const f of el.querySelectorAll(`[name="${k}"]`)) { if (f.type === "checkbox") f.checked = !!v; else if (f.type === "radio") f.checked = f.value === String(v); else f.value = v; f.dispatchEvent(new Event("change", { bubbles: true })); } };
const wrap = (kind) => async (opts = {}) => {
  if (opts._lt) return LT._orig[kind](opts);
  const content = opts.content ?? "";
  LT.log.push({ kind, title: opts.window?.title, content: String(content).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 300) });
  if (!LT.auto) return LT._orig[kind]({ ...opts, _lt: true });
  if (kind === "confirm" && LT.confirmAns !== "dialog") return typeof LT.confirmAns === "function" ? LT.confirmAns(content, opts) : LT.confirmAns;
  if (LT.answer) { const a = LT.answer(kind, content, opts); if (a !== undefined) return a; }
  const userRender = opts.render;
  return LT._orig[kind]({ ...opts, _lt: true, render: (event, dlg) => {
    userRender?.(event, dlg);
    const el = dlg?.element ?? dlg;
    setTimeout(() => {
      fillForm(el, content);
      let btn;
      if (LT.choice) { const c = typeof LT.choice === "function" ? LT.choice(content, el) : LT.choice; if (c) btn = el.querySelector(`footer button[data-action="${c}"]`); }
      btn ??= el.querySelector('footer button[data-action="ok"], footer button[data-action="yes"], footer button.default, footer button[autofocus], footer button');
      btn?.click();
    }, 80);
  } });
};
D.prompt = wrap("prompt"); D.confirm = wrap("confirm"); D.wait = wrap("wait");
LT.sleep = ms => new Promise(r => setTimeout(r, ms));
LT.last = (flag) => game.messages.contents.filter(m => !flag || m.getFlag("flowstate", flag)).at(-1);
LT.text = m => (m?.content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
LT.results = LT.results ?? []; LT.ok = (c, msg) => { LT.results.push({ ok: !!c, msg }); return !!c; };
LT.A = { blade: game.actors.getName("LT Blade"), dummy: game.actors.getName("LT Dummy"), dummy2: game.actors.getName("LT Dummy B"), mage: game.actors.getName("LT Mage"), mind: game.actors.getName("LT Mind"), scene: game.scenes.getName("LT Arena") };
LT.tok = a => canvas.tokens.placeables.find(t => t.actor?.id === a.id);
LT.target = (...as) => { game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false })); for (const a of as) LT.tok(a)?.setTarget(true, { releaseOthers: false }); };
LT.reset = async (...as) => { for (const a of as) { await a.update({ "system.hp.value": a.system.hp.max, "system.hp.lost": 0, "system.energy.value": a.system.energy.max, "system.ap.value": 6, "system.rp.value": 6, "system.conditions": { ignite: 0, stain: 0, slow: 0, haste: 0 } }); for (const e of a.effects.contents) await e.delete().catch(() => null); for (const s of [...a.statuses]) await a.toggleStatusEffect(s, { active: false }); } };
export default window.LT;
// Token moves: `drag` is a player's drag (movement cost applies); `move` an API move (free). No animation (a hidden window never finishes one).
LT.drag = async (a, dx, dy) => { const t = LT.tok(a).document; await t.move([{ x: t._source.x + dx * 100, y: t._source.y + dy * 100 }], { method: "dragging", animate: false }); await LT.sleep(900); };
LT.move = async (a, dx, dy) => { const t = LT.tok(a).document; await t.update({ x: t._source.x + dx * 100, y: t._source.y + dy * 100 }, { animate: false }); await LT.sleep(700); };
LT.clickTile = (x, y) => canvas.stage.emit("pointerdown", { button: 0, getLocalPosition: () => ({ x, y }), data: { getLocalPosition: () => ({ x, y }) } });
LT.combat = game.combats.find(c => c.scene?.id === LT.A.scene?.id) ?? null;
LT.Act = await import("/systems/flowstate/module/actions.mjs");
LT.M = await import("/systems/flowstate/module/mental.mjs");
LT.CA = await import("/systems/flowstate/module/casting.mjs");
LT.E = await import("/systems/flowstate/module/esoteric.mjs");
LT.C = await import("/systems/flowstate/module/concentration.mjs");
