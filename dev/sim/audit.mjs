// Visual audit (dev only): flags layout problems in a rendered window or card. In the browser console:
//   const { audit } = await import("/systems/flowstate/dev/sim/audit.mjs?" + Date.now()); audit(app.element, "label")
// Kinds: clipped (text cut off by hidden overflow or an ellipsis), narrow-select / narrow-input, button-overflow (a label wider than its button),
// button-wrapped (a short button label on two lines or more), button-cut (a label taller than its fixed-height button), spills-out (something
// sticking out of the window's content sideways, outside any scroller), offscreen (the window itself past the screen's edge).

/** Lines of text an element's own text runs over (icons and padding don't count). */
export function textLines(el) {
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), tops = [];
  let n;
  while ((n = tw.nextNode())) {
    if (!n.textContent.trim()) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    for (const q of rg.getClientRects()) if (q.width > 1 && q.height > 4) tops.push(q.top);
  }
  tops.sort((a, b) => a - b);
  let lines = 0, last = -1e9;
  for (const t of tops) if (t - last > 6) { lines++; last = t; }
  return lines;
}

const visible = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && !el.closest("[hidden], .tab:not(.active)"); };
const textOf = el => (el.innerText ?? el.value ?? "").replace(/\s+/g, " ").trim().slice(0, 70);
function path(el, root) {
  const p = [];
  for (let e = el, i = 0; e && e !== root && i < 4; i++, e = e.parentElement) p.unshift(e.tagName.toLowerCase() + (typeof e.className === "string" && e.className.trim() ? `.${e.className.trim().split(/\s+/).slice(0, 2).join(".")}` : ""));
  return p.join(" > ");
}

export function audit(root, label = "") {
  const out = [];
  if (!root) return out;
  const content = root.querySelector(".window-content") ?? root, box = content.getBoundingClientRect();
  const rr = root.getBoundingClientRect();
  if (root.classList?.contains("application") && (rr.right > innerWidth + 2 || rr.bottom > innerHeight + 2 || rr.left < -2 || rr.top < -2)) out.push({ kind: "offscreen", where: root.id || root.className, text: `${Math.round(rr.right)}×${Math.round(rr.bottom)} in ${innerWidth}×${innerHeight}` });
  for (const el of root.querySelectorAll("*")) {
    if (!visible(el)) continue;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect(), t = textOf(el);
    if (t && el.children.length <= 2 && el.scrollWidth > el.clientWidth + 2 && (["hidden", "clip"].includes(cs.overflowX) || cs.textOverflow === "ellipsis") && !["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName))
      out.push({ kind: "clipped", where: path(el, root), text: t, w: Math.round(el.clientWidth), need: el.scrollWidth });
    if (el.tagName === "SELECT" && el.clientWidth < 60 && el.options.length) out.push({ kind: "narrow-select", where: path(el, root), text: el.options[el.selectedIndex]?.text ?? "", w: Math.round(el.clientWidth) });
    if (el.tagName === "INPUT" && ["text", "number", "search"].includes(el.type) && el.clientWidth < 28) out.push({ kind: "narrow-input", where: path(el, root), text: el.value, w: Math.round(el.clientWidth) });
    if (el.tagName === "BUTTON" && t) {
      if (el.scrollWidth > el.clientWidth + 2) out.push({ kind: "button-overflow", where: path(el, root), text: t, w: Math.round(el.clientWidth), need: el.scrollWidth });
      if (t.length < 40 && textLines(el) > 1) out.push({ kind: "button-wrapped", where: path(el, root), text: t, w: Math.round(r.width) });
      if (el.scrollHeight > el.clientHeight + 3 && cs.overflowY !== "visible") out.push({ kind: "button-cut", where: path(el, root), text: t, h: el.clientHeight, need: el.scrollHeight });
    }
    if (content !== root && (r.right > box.right + 3 || r.left < box.left - 3) && r.width < box.width * 3 && t) {
      let sc = el.parentElement, scroll = false;
      while (sc && sc !== content) { if (["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(sc).overflowX)) { scroll = true; break; } sc = sc.parentElement; }
      if (!scroll) out.push({ kind: "spills-out", where: path(el, root), text: t, by: Math.round(Math.max(r.right - box.right, box.left - r.left)) });
    }
  }
  const seen = new Set();
  return out.filter(x => { const k = x.kind + x.text; if (seen.has(k)) return false; seen.add(k); return true; }).map(x => ({ ...x, label }));
}
