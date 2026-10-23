/**
 * Small helpers for the HTML the system builds (dialogs, chat cards), shared instead of copied into every module. Safe outside Foundry (tests):
 * escaping falls back to the Codex's own escaper.
 */
import { escapeHtml } from "./codex-md.mjs";

/** Escape text for HTML (null and undefined are empty). */
export const esc = s => {
  const f = globalThis.foundry?.utils?.escapeHTML;
  return f ? f(String(s ?? "")) : escapeHtml(s);
};

/** The class every system dialog's window carries (styles/flowstate.css lays its options out as cards, with section headings). */
export const DIALOG_CLASS = "fs-dialog";
const withClass = o => ({ ...o, classes: [...(o?.classes ?? []), DIALOG_CLASS] });
/** Foundry's dialogs (looked up when used, so modules load in tests), with the system's class on the window. */
export const DialogV2 = () => {
  const D = foundry.applications.api.DialogV2;
  return { prompt: o => D.prompt(withClass(o)), confirm: o => D.confirm(withClass(o)), wait: o => D.wait(withClass(o)) };
};
/** A section heading inside a dialog. */
export const dialogHead = text => `<h4 class="fs-dialog-head">${esc(text)}</h4>`;

/** A labelled field for the system's dialogs. */
export const field = (label, html) => `<div class="fs-field"><label>${esc(label)}</label>${html}</div>`;

/** A select of [value, label] pairs, with `value` selected. */
export const select = (name, options, value = undefined) =>
  `<select name="${esc(name)}">${options.map(([k, label]) => `<option value="${esc(k)}" ${value !== undefined && String(value) === String(k) ? "selected" : ""}>${esc(label)}</option>`).join("")}</select>`;

/** A dialog form's named values (checkboxes as booleans); disabled fields are left out. */
export const formValues = form => {
  const v = {};
  for (const el of form.elements) if (el.name && !el.disabled) v[el.name] = el.type === "checkbox" ? el.checked : el.value;
  return v;
};
/** The same, with number inputs read as numbers. */
export const formValuesNumeric = form => {
  const v = {};
  for (const el of form.elements) if (el.name && !el.disabled) v[el.name] = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value;
  return v;
};
