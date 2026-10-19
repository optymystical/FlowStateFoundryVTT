/**
 * The world data store (pure, no Foundry globals).
 *
 * Every table of game data (weapon types, materials, Foci, Icon Forms, skill trees, Combos...) is a *collection* here. The system's own values
 * (from the docs, in code) are the defaults; a world can layer its own changes on top: edits to an entry's fields, new entries, and hidden entries.
 * The tables stay where the engine already reads them (`WEAPON_MATERIALS`, `TREES`...): applying world data resets each one to its defaults and
 * layers the world's changes onto the same object, in place, so every module sees the result without asking the store.
 *
 * World data (a world setting, and the export file) looks like
 *   { version, collections: { [collection]: { entries: { [key]: patch or new entry }, hidden: [keys] } } }
 * - An edit to a system entry is a *patch*: only the fields that changed. The rest still follows the system, so doc updates keep reaching it.
 *   Objects merge field by field; a list of objects that each have an `id`, `tier` or `name` merges item by item on that key (`_delete: true`
 *   drops one); any other list is replaced whole.
 * - A key the system doesn't have is a new entry (only in collections that allow them), stored whole.
 * - System entries can't be removed, because items and characters may use them: they can be hidden (`hidden: true` on the entry) instead.
 */

export const WORLD_DATA_VERSION = 1;

/** id → { id, label, group, table, list, key, addable, required, nameOf, rebuild, defaults, order, custom: Set } */
export const COLLECTIONS = new Map();

const BAD_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const KEY_RE = /^[A-Za-z0-9_+\-.:' ]{1,100}$/;
const MERGE_KEYS = ["id", "tier", "name"];

const isPlain = v => v !== null && typeof v === "object" && !Array.isArray(v);

/** A deep copy of plain data (keeps Infinity and functions, which JSON would lose). */
export function clone(v) {
  if (Array.isArray(v)) return v.map(clone);
  if (isPlain(v)) { const o = {}; for (const [k, x] of Object.entries(v)) if (!BAD_KEYS.has(k)) o[k] = clone(x); return o; }
  return v;
}

/** The field every element of a list has, to merge it item by item (null: replace the list whole). */
function mergeKeyOf(list) {
  if (!list.length || !list.every(isPlain)) return null;
  return MERGE_KEYS.find(k => list.every(e => e[k] !== undefined && e[k] !== null && e[k] !== "")) ?? null;
}

function mergeList(base, patch) {
  const key = mergeKeyOf(base);
  if (!key || !patch.every(isPlain)) return clone(patch);
  const out = base.map(clone);
  for (const p of patch) {
    if (p[key] === undefined) continue;
    const i = out.findIndex(e => String(e[key]) === String(p[key]));
    if (p._delete) { if (i >= 0) out.splice(i, 1); continue; }
    if (i >= 0) out[i] = merge(out[i], p);
    else { const { _delete, ...rest } = p; out.push(clone(rest)); }
  }
  return out;
}

/** `base` with `patch` layered on (a new object; neither is changed). */
export function merge(base, patch) {
  if (!isPlain(patch)) return clone(patch);
  const out = isPlain(base) ? clone(base) : {};
  for (const [k, v] of Object.entries(patch)) {
    if (BAD_KEYS.has(k) || k === "_delete") continue;
    if (isPlain(v) && isPlain(out[k])) out[k] = merge(out[k], v);
    else if (Array.isArray(v) && Array.isArray(out[k])) out[k] = mergeList(out[k], v);
    else out[k] = clone(v);
  }
  return out;
}

/**
 * Register a table as a collection. `table` is the live object (or array, with `list: true` and its entries' `key` field) the engine reads.
 * `addable`: the world may add entries (new ones need the `required` fields, and pass `validate(key, value)` if given: it returns a problem or null).
 * `nameOf(entry, key)` gives an entry's display name. `rebuild()` runs after the table changes, for anything derived from it.
 * `derive()`: the collection's system values are worked out from the other tables (the item catalog): they are rebuilt after those tables have the
 * world's changes, and the world's changes to this collection go on after that.
 */
export function defineCollection(id, { label, group = "Other", table, list = false, key = "id", addable = false, required = [], nameOf = null, rebuild = null, derive = null, validate = null }) {
  const c = { id, label, group, table, list, key, addable, required, rebuild, derive, validate, defaults: {}, order: [], custom: new Set(),
    nameOf: nameOf ?? ((e, k) => e?.label ?? e?.name ?? (typeof e === "string" ? e : k)) };
  setDefaults(c, derive ? derive() : table);
  COLLECTIONS.set(id, c);
  return c;
}

/** Take a collection's system values from `source` (a table as the system has it, or what `derive()` produced). */
function setDefaults(c, source) {
  c.order = c.list ? source.map(e => String(e[c.key])) : Object.keys(source);
  c.defaults = c.list ? Object.fromEntries(source.map(e => [String(e[c.key]), clone(e)])) : clone(source);
}

/** Put a table back to its system values (in place). */
function resetTable(c) {
  c.custom.clear();
  if (c.list) { c.table.length = 0; for (const k of c.order) c.table.push(clone(c.defaults[k])); return; }
  for (const k of Object.keys(c.table)) delete c.table[k];
  for (const k of c.order) c.table[k] = clone(c.defaults[k]);
}

/** Write an entry into a table (in place). */
function putEntry(c, key, value) {
  if (!c.list) { c.table[key] = value; return; }
  const v = isPlain(value) ? { ...value, [c.key]: c.order.includes(key) ? c.defaults[key][c.key] : key } : value;
  const i = c.table.findIndex(e => String(e?.[c.key]) === key);
  if (i >= 0) c.table[i] = v; else c.table.push(v);
}
const getEntry = (c, key) => (c.list ? c.table.find(e => String(e?.[c.key]) === key) : c.table[key]);

/**
 * Check world data (a setting, or an imported file) before using it: only known collections, safe keys, plain values, and new entries only where
 * they're allowed and complete. Returns { data (cleaned), problems: [text] }.
 */
export function sanitizeWorldData(raw, { only = null, skip = null } = {}) {
  const problems = [];
  const data = { version: WORLD_DATA_VERSION, collections: {} };
  if (!isPlain(raw)) return { data, problems: raw == null || only ? [] : ["That isn't Flow State world data."] };
  if (!only && raw.version && raw.version > WORLD_DATA_VERSION) problems.push(`It was made by a newer version of the system (format ${raw.version}); some of it may not apply.`);
  for (const [id, col] of Object.entries(isPlain(raw.collections) ? raw.collections : {})) {
    if ((only && !only.has(id)) || skip?.has(id)) continue;
    const c = COLLECTIONS.get(id);
    if (!c) { problems.push(`Unknown collection "${id}" left out.`); continue; }
    if (!isPlain(col)) continue;
    const out = { entries: {}, hidden: [] };
    for (const [key, v] of Object.entries(isPlain(col.entries) ? col.entries : {})) {
      if (BAD_KEYS.has(key) || !KEY_RE.test(key)) { problems.push(`${c.label}: the key "${key}" isn't allowed.`); continue; }
      const known = c.order.includes(key);
      if (!known && !c.addable) { problems.push(`${c.label}: new entries can't be added here ("${key}" left out).`); continue; }
      if (!known && isPlain(c.defaults[c.order[0]]) && !isPlain(v)) { problems.push(`${c.label}: "${key}" isn't a valid entry.`); continue; }
      const missing = !known && isPlain(v) ? c.required.filter(f => v[f] === undefined || v[f] === null || v[f] === "") : [];
      if (missing.length) { problems.push(`${c.label}: "${key}" is missing ${missing.join(", ")}.`); continue; }
      const bad = c.validate?.(key, v, known);
      if (bad) { problems.push(`${c.label}: "${key}" ${bad}`); continue; }
      out.entries[key] = clone(v);
    }
    out.hidden = (Array.isArray(col.hidden) ? col.hidden : []).map(String).filter(k => c.order.includes(k) || k in out.entries);
    if (Object.keys(out.entries).length || out.hidden.length) data.collections[id] = out;
  }
  return { data, problems };
}

/**
 * Apply world data to every table: each is reset to the system values, then the world's edits, new entries and hidden marks are layered on, and
 * whatever is derived from the tables is rebuilt. Returns { data, problems }. With nothing (or {}), the tables are simply the system's.
 */
export function applyWorldData(raw) {
  const all = [...COLLECTIONS.values()], derived = all.filter(c => c.derive), ids = new Set(derived.map(c => c.id));
  // The tables first, then what is derived from them (worked out again from the tables as the world has them), then the world's changes to that.
  const first = sanitizeWorldData(raw, { skip: ids }), problems = [...first.problems];
  layer(all.filter(c => !c.derive), first.data, problems);
  for (const c of derived) {
    try { setDefaults(c, c.derive()); } catch (err) { problems.push(`${c.label}: ${err?.message ?? err}`); }
  }
  const second = sanitizeWorldData(raw, { only: ids });
  problems.push(...second.problems);
  layer(derived, second.data, problems);
  return { data: { version: WORLD_DATA_VERSION, collections: { ...first.data.collections, ...second.data.collections } }, problems };
}

/** Reset these collections and layer `data` on them, then rebuild what is derived from them. */
function layer(cols, data, problems) {
  for (const c of cols) resetTable(c);
  for (const c of cols) {
    const col = data.collections[c.id];
    if (!col) continue;
    for (const [key, v] of Object.entries(col.entries)) {
      const known = c.order.includes(key);
      putEntry(c, key, known ? merge(c.defaults[key], v) : clone(v));
      if (!known) c.custom.add(key);
    }
    for (const key of col.hidden) { const e = getEntry(c, key); if (isPlain(e)) e.hidden = true; }
  }
  for (const c of cols) {
    try { c.rebuild?.(); } catch (err) { problems.push(`${c.label}: ${err?.message ?? err}`); }
  }
}

/** Everything in a collection as it stands: [{ key, name, value, system (a system entry), custom, edited, hidden }]. */
export function entries(id, data = null) {
  const c = COLLECTIONS.get(id);
  if (!c) return [];
  const col = data?.collections?.[id];
  const keys = [...c.order, ...[...c.custom].filter(k => !c.order.includes(k))];
  return keys.map(key => {
    const value = getEntry(c, key);
    return { key, name: c.nameOf(value, key), value, system: c.order.includes(key), custom: c.custom.has(key),
      edited: !!col?.entries?.[key] && c.order.includes(key), hidden: !!(isPlain(value) && value.hidden) };
  });
}

/** A collection's system value for one entry (null for an entry the world added). */
export const systemEntry = (id, key) => { const c = COLLECTIONS.get(id); return c && c.order.includes(key) ? clone(c.defaults[key]) : null; };

/* ---- Building world data (the editor and imports use these; each returns new world data and leaves the old alone) ---- */

const blank = data => ({ version: WORLD_DATA_VERSION, collections: clone(data?.collections ?? {}) });
const colOf = (d, id) => (d.collections[id] ??= { entries: {}, hidden: [] });

/** Layer `patch` onto an entry (a system entry's fields, or a world entry; a new key adds an entry). */
export function withEntry(data, id, key, patch) {
  const d = blank(data), col = colOf(d, id);
  col.entries[key] = isPlain(col.entries[key]) && isPlain(patch) ? merge(col.entries[key], patch) : clone(patch);
  return d;
}
/** Undo the world's changes to an entry (a system entry goes back to the system's value; a world entry is removed). */
export function withoutEntry(data, id, key) {
  const d = blank(data), col = d.collections[id];
  if (col) { delete col.entries[key]; col.hidden = (col.hidden ?? []).filter(k => k !== key); if (!Object.keys(col.entries).length && !col.hidden.length) delete d.collections[id]; }
  return d;
}
/** Hide or show an entry. */
export function withHidden(data, id, key, hidden = true) {
  const d = blank(data), col = colOf(d, id);
  col.hidden = [...new Set([...(col.hidden ?? []).filter(k => k !== key), ...(hidden ? [key] : [])])];
  if (!Object.keys(col.entries).length && !col.hidden.length) delete d.collections[id];
  return d;
}

/** Layer one world's data over another's (an import added to the world's own): its entries win field by field, hidden marks add up. */
export function layerWorldData(base, incoming) {
  let out = sanitizeWorldData(base).data;
  for (const [id, col] of Object.entries(sanitizeWorldData(incoming).data.collections)) {
    for (const [key, v] of Object.entries(col.entries)) out = withEntry(out, id, key, v);
    for (const key of col.hidden) out = withHidden(out, id, key, true);
  }
  return out;
}
