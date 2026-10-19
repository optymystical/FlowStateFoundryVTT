/**
 * A small Markdown renderer for the Codex (pure): the docs' text as the Drive export writes it. Paragraphs (two trailing spaces or a backslash break
 * a line), **bold**, *italic*, bullet and numbered lists (nested by indent), tables, ### headings, the export's backslash escapes, and links (the doc's
 * own #anchors become plain text; web links open in a new tab). Everything is HTML-escaped first, so text can't inject markup.
 */

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = s => String(s ?? "").replace(/[&<>"']/g, c => ESC[c]);

const MARK = "\u0000";
/** Inline Markdown → HTML (on already-split text). */
export function inline(text) {
  const kept = [];
  let s = String(text ?? "").replace(/\\([\\`*_{}[\]()#+\-.!~>|<=])/g, (m, c) => { kept.push(c); return `${MARK}${kept.length - 1}${MARK}`; });
  s = escapeHtml(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => (/^https?:\/\//i.test(url) ? `<a href="${url}" target="_blank" rel="noopener">${label}</a>` : label));
  s = s.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>");
  return s.replace(new RegExp(`${MARK}(\\d+)${MARK}`, "g"), (m, i) => escapeHtml(kept[Number(i)]));
}

const LIST_RE = /^(\s*)([-*+]|\d+\.)\s+(.*)$/;
const isTableRow = l => /^\s*\|.*\|\s*$/.test(l);
const isRule = l => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const cells = l => l.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map(c => c.trim());

function list(lines) {
  // lines: [{ indent, ordered, text }]
  let html = "", stack = [];
  const open = (ordered, indent) => { stack.push({ ordered, indent }); html += ordered ? "<ol>" : "<ul>"; };
  const close = () => { const t = stack.pop(); html += t.ordered ? "</li></ol>" : "</li></ul>"; };
  for (const it of lines) {
    if (!stack.length || it.indent > stack.at(-1).indent) open(it.ordered, it.indent);
    else {
      while (stack.length > 1 && it.indent < stack.at(-1).indent) close();
      html += "</li>";
    }
    html += `<li>${inline(it.text)}`;
  }
  while (stack.length) close();
  return html;
}

/** A block of the docs' Markdown → HTML. */
export function renderMarkdown(md) {
  const lines = String(md ?? "").replace(/\r\n/g, "\n").split("\n");
  let html = "", para = [], items = [], table = [];
  const flushPara = () => {
    if (!para.length) return;
    html += `<p>${para.map((l, i) => inline(l.replace(/\s{2,}$|\\$/, "")) + (i < para.length - 1 && (/\s{2,}$|\\$/.test(l)) ? "<br>" : " ")).join("").trim()}</p>`;
    para = [];
  };
  const flushList = () => { if (items.length) { html += list(items); items = []; } };
  const flushTable = () => {
    if (!table.length) return;
    const rows = table.filter(l => !isRule(l)).map(cells);
    const [head, ...body] = rows;
    html += `<table class="fs-codex-table"><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    table = [];
  };
  const flushAll = () => { flushPara(); flushList(); flushTable(); };
  for (const raw of lines) {
    const line = raw.replace(/\t/g, "    ");
    if (!line.trim()) { flushAll(); continue; }
    if (isTableRow(line)) { flushPara(); flushList(); table.push(line); continue; }
    if (table.length) flushTable();
    const h = /^\s*(#{1,6})\s+(.*)$/.exec(line);
    if (h) { flushAll(); const t = h[2].replace(/\s*\{#[^}]*\}\s*$/, "").trim(); if (t) html += `<h4>${inline(t)}</h4>`; continue; }
    const li = LIST_RE.exec(line);
    if (li) { flushPara(); items.push({ indent: li[1].length, ordered: /\d/.test(li[2]), text: li[3] }); continue; }
    if (items.length && /^\s{2,}\S/.test(line)) { items.at(-1).text += ` ${line.trim()}`; continue; }
    flushList();
    para.push(line);
  }
  flushAll();
  return html;
}

/** Markdown → plain text (for search and short blurbs). */
export const plainText = md => String(md ?? "").replace(/\\([^a-zA-Z0-9\s])/g, "$1").replace(/[*#|]+/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  .replace(/:?-{3,}:?/g, " ").replace(/\{#[^}]*\}/g, "").replace(/\s+/g, " ").trim();
