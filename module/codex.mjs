/**
 * The Codex (pure, no Foundry globals): every element of the game as a page, built from the same tables the engine reads (the store, with the
 * world's changes), so it always shows what this world plays with. Pages have ids like `tree:martial-theory`, `entry:magic-slashing:cut` (the
 * same ids the spell catalog and the Wonders use), `tag:fast`, `weaponMaterial:iron`, `item:named.longsword`, `doc:rules/ch9-conditions/ignite`.
 * Anything can link to a page with `data-codex="<id>"` (the Codex window opens it), and journal text with `@Codex[<id or name>]{label}`.
 *
 * A page is { id, title, section, group, subtitle, hidden, blocks, keywords }: blocks are
 *   { kind: "md", md }               the docs' text (rendered by codex-md.mjs)
 *   { kind: "fields", rows: [[label, value, linkId?]] }
 *   { kind: "links", label, items: [{ id, label, note }] }
 *   { kind: "entries", label, items: [{ id, name, text, sub }] }   a tier's entries
 *   { kind: "table", head: [...], rows: [[...]] }
 * Sections are registered with `registerSection` (the A.B.C.s and anything new add their own).
 */
import { dataVersion } from "./store.mjs";
import { renderMarkdown, inline, escapeHtml, plainText } from "./codex-md.mjs";
import { RULE_DOCS } from "./rules-text.mjs";
import { TREES } from "./trees.mjs";
import { ARCHETYPES } from "./skills.mjs";
import { STATS, SIZES, DAMAGE_TYPES, OBJECT_DENSITY, STAIN_VARIANTS } from "./rules.mjs";
import { RARITIES, WEAPON_TAGS, WEAPON_TYPES, WEIGHTS, THROW, RELOAD_RP, DAMAGE_CATEGORY, WEAPON_MATERIALS, ARMOR_WEIGHTS, ARMOR_MATERIALS } from "./martial.mjs";
import { CASTING_FORMS, FOCI_TYPES, SHROUD_TYPES, AFFIXES } from "./magic.mjs";
import { FORMS, KINDS, WONDERS } from "./mental-rules.mjs";
import { CATALOG } from "./spells.mjs";
import { COMBO_PAIRS, COMBO_GENERIC, COMBO_BONUS, COMBO_ILLUSION } from "./combos.mjs";
import { ITEM_CATALOG, ITEM_TYPES, isGenerated, entrySummary } from "./catalog.mjs";
import { parseEnergyCost } from "./energy.mjs";

export const slug = s => String(s ?? "").replace(/^#\s*/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Page ids for the things the rest of the system links to. */
export const codexId = {
  tree: id => `tree:${id}`,
  entry: (treeId, name) => `entry:${treeId}:${slug(name || "x")}`,
  weaponType: k => `weaponType:${k}`, tag: k => `tag:${k}`, weaponMaterial: k => `weaponMaterial:${k}`,
  armorWeight: k => `armorWeight:${k}`, armorMaterial: k => `armorMaterial:${k}`,
  castingForm: k => `castingForm:${k}`, foci: k => `foci:${k}`, shroud: k => `shroud:${k}`, affix: k => `affix:${k}`, form: k => `form:${k}`,
  density: k => `density:${k}`, stat: k => `stat:${k}`, size: n => `size:${n}`, damage: k => `damage:${k}`,
  status: k => `status:${k}`, item: key => `item:${key}`, combo: k => `combo:${k}`, archetype: k => `archetype:${k}`,
  doc: (doc, ch, sec) => `doc:${doc}/${ch}${sec ? `/${sec}` : ""}`
};

/** Where a rule lives in the Rules doc (for links from the conditions and core pages). */
export const RULE = {
  stats: ["ch3-stats"], statMinimums: ["ch3-stats", "stat-minimums"], sizes: ["ch7-non-combat-rules", "size-categories"],
  damage: ["ch8-combat-rules", "damage-rolls-types"], strengthened: ["ch8-combat-rules", "strengthened-weakened"],
  crouch: ["ch9-conditions", "crouch-prone"], fear: ["ch9-conditions", "fear"], ignite: ["ch9-conditions", "ignite"], stain: ["ch9-conditions", "stain"],
  slow: ["ch9-conditions", "slow"], haste: ["ch9-conditions", "haste"], grappling: ["ch8-combat-rules", "grappling"], stealth: ["ch8-combat-rules", "stealthing"],
  stealthValue: ["ch8-combat-rules", "stealth-value"], hp: ["ch8-combat-rules", "health-points"], pain: ["ch8-combat-rules", "pain-threshold"],
  gravity: ["ch10-objects-and-force", "gravity"], flight: ["ch10-objects-and-force", "flight"], objects: ["ch10-objects-and-force", "objects"],
  movement: ["ch8-combat-rules", "movement"], archetypes: ["ch2-archetypes"], abcs: ["ch5-a-b-c-s"]
};
const ruleId = key => (RULE[key] ? codexId.doc("rules", ...RULE[key]) : null);

/** Statuses (token conditions): what each one is, as a rule or the tree ability that gives it. */
export const STATUS_SOURCES = {
  dead: { rule: "hp" }, unconscious: { rule: "pain" }, prone: { rule: "crouch" }, crouch: { rule: "crouch" }, falling: { rule: "gravity" }, flying: { rule: "flight" },
  stealth: { rule: "stealth" }, halfStealth: { rule: "stealthValue" }, fullStealth: { rule: "stealthValue" }, fear: { rule: "fear" }, grappled: { rule: "grappling" },
  psychedUp: { entry: "Psych Up" }, calmedDown: { entry: "Calm Down" }, limber: { entry: "Limber" }, carefulSteps: { entry: "Careful Steps" },
  berserk: { entry: "Berserk" }, seeingRed: { entry: "Seeing Red" }, unstoppable: { entry: "Unstoppable" }, properStance: { entry: "Proper Stance" },
  fishy: { entry: "Like Shooting Fish" }, sliced: { entry: "Slice" }, taunted: { entry: "Taunt" }, quickened: { entry: "Quicken" }
};
/** The stacking conditions on a character (not token statuses). */
const CONDITIONS = { ignite: { name: "Ignite", rule: "ignite" }, stain: { name: "Stain", rule: "stain" }, slow: { name: "Slow", rule: "slow" }, haste: { name: "Haste", rule: "haste" } };

const SECTIONS = [];
let cache = null;
let statusList = [];
/** Add a section of pages: { id, label, icon, order, build(ctx) → pages }. */
export function registerSection(section) {
  const i = SECTIONS.findIndex(s => s.id === section.id);
  if (i >= 0) SECTIONS.splice(i, 1, section); else SECTIONS.push(section);
  cache = null;
}

const fieldsBlock = rows => ({ kind: "fields", rows: rows.filter(r => r && r[1] !== undefined && r[1] !== null && r[1] !== "") });
const linksBlock = (label, items) => ({ kind: "links", label, items: items.filter(Boolean) });
const md = text => (text ? { kind: "md", md: String(text) } : null);
const tagText = tags => Object.entries(tags ?? {}).map(([k, v]) => `${WEAPON_TAGS[k]?.label ?? k}${v === 2 ? "+" : ""}`).join(", ");
const tagLinks = tags => Object.entries(tags ?? {}).map(([k, v]) => ({ id: codexId.tag(k), label: `${WEAPON_TAGS[k]?.label ?? k}${v === 2 ? "+" : ""}` }));
const treeExists = id => TREES.some(t => t.id === id);
const weaponTree = k => (k === "unarmed" ? "martial-brawling-methods" : `martial-${k}-weapons`);
const armorTree = w => `martial-${w}-armor`;
const school = treeId => treeId.replace(/^magic-/, "");

/* ---------------- Sections ---------------- */

registerSection({ id: "rules", label: "Rules", icon: "fa-solid fa-book", order: 0, build() {
  const pages = [];
  for (const doc of RULE_DOCS) {
    for (const ch of doc.chapters) {
      const group = doc.id === "rules" ? ch.title : `Equipment: ${ch.title}`;
      const chId = codexId.doc(doc.id, ch.id);
      pages.push({ id: chId, title: ch.title, section: "rules", group, chapter: true, blocks: [md(ch.intro),
        ch.sections.length ? linksBlock("Sections", ch.sections.map(s => ({ id: codexId.doc(doc.id, ch.id, s.id), label: s.title }))) : null,
        ch.id === "ch5-a-b-c-s" ? linksBlock("", [{ id: chId, label: "The A.B.C.s aren't written yet; they'll appear here." }]) : null].filter(Boolean) });
      for (const s of ch.sections) pages.push({ id: codexId.doc(doc.id, ch.id, s.id), title: s.title, section: "rules", group, parent: chId, subtitle: ch.title, blocks: [md(s.md)].filter(Boolean) });
    }
  }
  return pages;
} });

registerSection({ id: "basics", label: "Basics", icon: "fa-solid fa-dice-d20", order: 1, build() {
  const pages = [];
  for (const [k, s] of Object.entries(STATS)) {
    const scaling = [
      ...Object.entries(WEIGHTS).filter(([, w]) => w.stat === k).map(([, w]) => ({ id: codexId.doc("equipment", "martial-weapons", "weapon-info"), label: `${w.label} weapons` })),
      ...Object.entries(CASTING_FORMS).filter(([, f]) => f.stat === k).map(([fk, f]) => ({ id: codexId.castingForm(fk), label: `${f.label} Foci` })),
      ...Object.entries(KINDS).filter(([, x]) => x.stat === k).map(([, x]) => ({ id: "section:mental", label: `${x.label} Wonders` }))
    ];
    pages.push({ id: codexId.stat(k), title: s.label, section: "basics", group: "Stats", subtitle: `${s.group} · ${s.abbr}`,
      blocks: [fieldsBlock([["Abbreviation", s.abbr], ["Group", s.group]]), scaling.length ? linksBlock("Scales", scaling) : null,
        linksBlock("Rules", [{ id: ruleId("stats"), label: "Ch3: Stats" }, { id: ruleId("statMinimums"), label: "Stat Minimums" }])].filter(Boolean) });
  }
  for (const [n, z] of Object.entries(SIZES)) pages.push({ id: codexId.size(n), title: `Size ${n}`, section: "basics", group: "Sizes",
    blocks: [fieldsBlock([["Space", z.space], ["Max move", `${z.maxMove} ft per AP`], ["Melee range", `${z.melee} ft`], ["Rations a day", z.rations],
      ["Physical attacks", z.physical > 0 ? `${z.physical === 1 ? "" : "doubly "}Strengthened` : z.physical < 0 ? `${z.physical === -1 ? "" : "doubly "}Weakened` : "normal"]]),
    linksBlock("Rules", [{ id: ruleId("sizes"), label: "Size Categories" }])] });
  for (const [k, label] of Object.entries(DAMAGE_TYPES)) pages.push({ id: codexId.damage(k), title: label, section: "basics", group: "Damage types",
    blocks: [fieldsBlock([["Category", DAMAGE_CATEGORY[k] ? DAMAGE_CATEGORY[k][0].toUpperCase() + DAMAGE_CATEGORY[k].slice(1) : ""]]),
      linksBlock("Rules", [{ id: ruleId("damage"), label: "Damage Rolls/Types" }, { id: ruleId("strengthened"), label: "Strengthened/Weakened" }])] });
  for (const [k, c] of Object.entries(CONDITIONS)) pages.push({ id: codexId.status(k), title: c.name, section: "basics", group: "Conditions", redirect: ruleId(c.rule),
    blocks: [linksBlock("Rules", [{ id: ruleId(c.rule), label: c.name }])] });
  for (const [k, v] of Object.entries(STAIN_VARIANTS)) pages.push({ id: codexId.status(`stain-${k}`), title: v.label, section: "basics", group: "Conditions",
    blocks: [fieldsBlock([["To remove", v.ap == null ? "Can't be removed" : `${v.ap} AP`]]), linksBlock("Rules", [{ id: ruleId("stain"), label: "Stain" }])] });
  return pages;
} });

registerSection({ id: "trees", label: "Skill trees", icon: "fa-solid fa-sitemap", order: 2, build() {
  const pages = [];
  for (const a of ARCHETYPES) {
    const trees = TREES.filter(t => t.archetype === a.id);
    pages.push({ id: codexId.archetype(a.id), title: a.label, section: "trees", group: a.label, archetypePage: true,
      blocks: [a.placeholder ? md(a.placeholder) : null, linksBlock("Skill trees", trees.map(t => ({ id: codexId.tree(t.id), label: t.name, note: t.theory ? "Theory" : t.requires ? `Theory Tier ${t.requires}` : "" }))),
        linksBlock("Rules", [{ id: ruleId("archetypes"), label: "Ch2: Archetypes" }])].filter(Boolean) });
    for (const t of trees) {
      const tierBlocks = t.tiers.map(tier => ({ kind: "entries", label: `Tier ${tier.tier}${tier.free ? " (free)" : ""}`, summary: tier.summary ?? "",
        items: tier.entries.map(e => ({ id: codexId.entry(t.id, e.name), name: e.name ?? "", text: e.text ?? "", sub: e.sub ?? [] })) }));
      const theory = TREES.find(x => x.archetype === t.archetype && x.theory);
      pages.push({ id: codexId.tree(t.id), title: t.name, section: "trees", group: a.label, subtitle: t.theory ? `${a.label} Theory` : t.requires ? `Needs ${theory?.name ?? "Theory"} Tier ${t.requires}` : a.label,
        hidden: !!t.hidden, blocks: [...tierBlocks, t.table?.rows?.length ? { kind: "table", label: t.table.title, head: ["Roll", t.table.title ?? "Effect"], rows: t.table.rows.map(r => [r[0], r[1]]) } : null].filter(Boolean) });
      for (const tier of t.tiers) for (const e of tier.entries) pages.push(entryPage(t, tier, e));
    }
  }
  return pages;
} });

/** A skill tree entry: its text, cost, and (spells, Wonders) what it is in play. */
function entryPage(tree, tier, e) {
  const id = codexId.entry(tree.id, e.name);
  const sid = id.slice("entry:".length);
  const blocks = [];
  const cost = parseEnergyCost(e.text ?? "") ? (/Cost:\s*Energy equal to ([^.]*)\./i.exec(e.text)?.[1] ?? "") : "";
  const spell = CATALOG.find(s => s.id === sid);
  const wonder = WONDERS.find(w => w.id === tree.id);
  const mode = wonder?.modes.find(m => m.id === sid);
  blocks.push(fieldsBlock([["Tree", tree.name, codexId.tree(tree.id)], ["Tier", tier.tier], ["Energy", cost ? `equal to ${cost}` : ""],
    spell ? ["Spell", `${spell.kind === "core" ? "Core Spell" : "Spell Mod"} · ${spell.replicate ? "X+1" : spell.min === spell.max ? spell.min : `${spell.min}–${spell.max}`} Threshold${spell.attack ? ` · ${spell.attack}` : ""}`] : null,
    mode ? ["Mode", `${wonder.name} (${KINDS[wonder.kind]?.label})`] : null]));
  if (mode) { blocks.push(md(mode.base)); if (mode.enhanced) blocks.push({ kind: "md", md: `**Enhanced:** ${mode.enhanced}` }); }
  else blocks.push(md(e.text));
  if (e.sub?.length) blocks.push({ kind: "md", md: e.sub.map(s => `- ${s}`).join("\n") });
  if (spell?.kind === "core") {
    const me = school(tree.id);
    const pairs = Object.keys(COMBO_PAIRS).filter(k => k.split("+").includes(me));
    blocks.push(linksBlock("Combos", [...pairs.map(k => ({ id: codexId.combo(k), label: comboTitle(k) })),
      ...Object.keys(COMBO_GENERIC).map(k => ({ id: codexId.combo(`any-${k}`), label: `${cap(me)} + ${cap(k)} (any Core)` }))]));
    if (COMBO_BONUS[me]) blocks.push({ kind: "md", md: `**As a Combo bonus:** ${COMBO_BONUS[me]}` });
    if (COMBO_ILLUSION[me]) blocks.push({ kind: "md", md: `**Illusion Combo:** ${COMBO_ILLUSION[me]}` });
  }
  return { id, title: e.name || `${tree.name}, Tier ${tier.tier}`, section: "trees", group: null, parent: codexId.tree(tree.id), subtitle: `${tree.name} · Tier ${tier.tier}`,
    hidden: !!tree.hidden, keywords: [tree.name], blocks: blocks.filter(Boolean) };
}
/** Rich text (an old item's description) as plain lines, so nothing in it runs as markup. */
const htmlToText = h => String(h ?? "").replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d)>/gi, "\n\n").replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const cap = s => String(s).replace(/(^|[-\s])(\w)/g, (m, a, b) => `${a === "-" ? " " : a}${b.toUpperCase()}`);
const comboTitle = k => k.split("+").map(cap).join(" + ");

registerSection({ id: "magic", label: "Magic", icon: "fa-solid fa-wand-sparkles", order: 3, build() {
  const pages = [];
  const coreOf = s => CATALOG.find(c => c.kind === "core" && school(c.treeId) === s);
  for (const [k, c] of Object.entries(COMBO_PAIRS)) {
    pages.push({ id: codexId.combo(k), title: comboTitle(k), section: "magic", group: "Combo spells", subtitle: c.head,
      blocks: [md(c.text), linksBlock("Cores", k.split("+").map(s => { const core = coreOf(s); return core ? { id: `entry:${core.id}`, label: `${core.name} (${core.school})` } : null; }))] });
  }
  for (const [k, c] of Object.entries(COMBO_GENERIC)) pages.push({ id: codexId.combo(`any-${k}`), title: `${cap(k)} + any Core`, section: "magic", group: "Combo spells", subtitle: c.head,
    blocks: [md(c.text), k === "illusion" ? { kind: "table", head: ["Core", "Illusion effect"], rows: Object.entries(COMBO_ILLUSION).map(([s, t]) => [cap(s), t]) } : null,
      ["summoning", "animation", "creation", "geomancy"].includes(k) ? { kind: "table", head: ["Core", "Bonus"], rows: Object.entries(COMBO_BONUS).map(([s, t]) => [cap(s), t]) } : null].filter(Boolean) });
  return pages;
} });

registerSection({ id: "mental", label: "Mental", icon: "fa-solid fa-brain", order: 4, build() {
  const pages = [{ id: "section:mental", title: "Wonders", section: "mental", group: "Wonders",
    blocks: Object.entries(KINDS).map(([k, x]) => linksBlock(`${x.label} Wonders (scale with ${x.statLabel})`, WONDERS.filter(w => w.kind === k).map(w => ({ id: codexId.tree(w.id), label: w.name,
      note: [w.modes.map(m => m.name).join(", "), w.tenet ? `Tenet: ${w.tenet.name}` : ""].filter(Boolean).join(" · ") })))) }];
  return pages;
} });

registerSection({ id: "equipment", label: "Equipment", icon: "fa-solid fa-shield-halved", order: 5, build() {
  const pages = [];
  const vis = t => Object.entries(t);
  for (const [k, w] of vis(WEAPON_TYPES)) {
    const rows = [];
    for (const [wk, wt] of Object.entries(WEIGHTS)) {
      const r = w[wk];
      if (!r) continue;
      rows.push([`${wt.label} (${STATS[wt.stat]?.abbr}, ${wt.ap} AP)`, `d${r.die}${w.ranged ? ` · ${r.range} ft · reload ${r.reload} (${RELOAD_RP[r.reload] ?? "?"} RP)` : r.throw ? ` · throw ${THROW[r.throw]?.label ?? r.throw}` : ""}${tagText(r.tags) ? ` · ${tagText(r.tags)}` : ""}`]);
      if (k === "unarmed") break;
    }
    const tags = [...new Map([...tagLinks(w.light?.tags), ...tagLinks(w.heavy?.tags)].map(t => [t.id, t])).values()];
    pages.push({ id: codexId.weaponType(k), title: w.label, section: "equipment", group: "Weapon types", subtitle: w.ranged ? "Ranged" : "Melee", hidden: !!w.hidden,
      blocks: [{ kind: "fields", rows }, linksBlock("Tags", tags), treeExists(weaponTree(k)) ? linksBlock("Skill tree", [{ id: codexId.tree(weaponTree(k)), label: TREES.find(t => t.id === weaponTree(k)).name }]) : null,
        linksBlock("Rules", [{ id: codexId.doc("equipment", "martial-weapons", "weapon-info"), label: "Weapon Info" }])].filter(Boolean) });
  }
  for (const [k, t] of vis(WEAPON_TAGS)) {
    const users = Object.entries(WEAPON_TYPES).filter(([, w]) => w.light?.tags?.[k] || w.heavy?.tags?.[k]).map(([wk, w]) => ({ id: codexId.weaponType(wk), label: w.label,
      note: [w.light?.tags?.[k] ? `Light${w.light.tags[k] === 2 ? "+" : ""}` : "", w.heavy?.tags?.[k] ? `Heavy${w.heavy.tags[k] === 2 ? "+" : ""}` : ""].filter(Boolean).join(", ") }));
    pages.push({ id: codexId.tag(k), title: t.label, section: "equipment", group: "Weapon tags", hidden: !!t.hidden,
      blocks: [md(t.base), t.plus ? { kind: "md", md: `**${t.label}+:** ${t.plus}` } : null, linksBlock("Weapon types with it", users)].filter(Boolean) });
  }
  const matPage = (kind, k, m, weights, group) => ({ id: kind === "weapon" ? codexId.weaponMaterial(k) : codexId.armorMaterial(k), title: m.label, section: "equipment", group, hidden: !!m.hidden,
    subtitle: RARITIES[m.rarity] ?? m.rarity,
    blocks: [fieldsBlock([["Rarity", RARITIES[m.rarity] ?? m.rarity], ...Object.entries(m.weights ?? {}).map(([w, s]) => [`${weights[w]?.label ?? w}`, `Durability ${s.dur} · Limit ${s.limit} per Grade`])]),
      md(m.effect), linksBlock("Rules", [{ id: codexId.doc("equipment", kind === "weapon" ? "martial-weapons" : "martial-armor", kind === "weapon" ? "weapon-material-info" : "armor-info"), label: kind === "weapon" ? "Weapon Material Info" : "Armor Info" }])].filter(Boolean) });
  for (const [k, m] of vis(WEAPON_MATERIALS)) pages.push(matPage("weapon", k, m, WEIGHTS, "Weapon materials"));
  for (const [k, w] of vis(ARMOR_WEIGHTS)) pages.push({ id: codexId.armorWeight(k), title: `${w.label} armor`, section: "equipment", group: "Armor",
    blocks: [fieldsBlock([["Stealth", w.stealthDis === Infinity ? "Automatically fails" : w.stealthDis ? `${w.stealthDis} Disadvantage` : "No penalty"], ["Speed", `−${w.speedPct}%`], ["Time to put on", w.don]]),
      linksBlock("Materials", Object.entries(ARMOR_MATERIALS).filter(([, m]) => m.weights?.[k] && !m.hidden).map(([mk, m]) => ({ id: codexId.armorMaterial(mk), label: m.label, note: `Durability ${m.weights[k].dur} · Limit ${m.weights[k].limit}` }))),
      treeExists(armorTree(k)) ? linksBlock("Skill tree", [{ id: codexId.tree(armorTree(k)), label: TREES.find(t => t.id === armorTree(k)).name }]) : null].filter(Boolean) });
  for (const [k, m] of vis(ARMOR_MATERIALS)) pages.push(matPage("armor", k, m, ARMOR_WEIGHTS, "Armor materials"));
  for (const [k, f] of vis(CASTING_FORMS)) pages.push({ id: codexId.castingForm(k), title: f.label, section: "equipment", group: "Foci", subtitle: "Casting form", blocks: [md(f.text),
    linksBlock("Foci", Object.entries(FOCI_TYPES).filter(([, x]) => x.form === k && !x.hidden).map(([fk, x]) => ({ id: codexId.foci(fk), label: x.label })))] });
  for (const [k, x] of vis(FOCI_TYPES)) pages.push({ id: codexId.foci(k), title: x.label, section: "equipment", group: "Foci", subtitle: `${CASTING_FORMS[x.form]?.label ?? x.form} Foci`, hidden: !!x.hidden,
    blocks: [fieldsBlock([["Casting form", CASTING_FORMS[x.form]?.label, codexId.castingForm(x.form)], ["Durability", `${x.dur} per Grade`], ["Limit", `${x.limit} per Grade`], ["Free Affixes", x.free], ["Doubles an Affix", x.plus ? "Yes" : ""]]),
      md(x.effect), linksBlock("Rules", [{ id: codexId.doc("equipment", "magic-foci", "foci-info"), label: "Foci Info" }])].filter(Boolean) });
  for (const [k, x] of vis(SHROUD_TYPES)) pages.push({ id: codexId.shroud(k), title: x.label, section: "equipment", group: "Shrouds", hidden: !!x.hidden,
    blocks: [fieldsBlock([["Durability", x.dur], ["Limit", x.limit], ["Free Affixes", x.free], ["Doubles an Affix", x.plus ? "Yes" : ""]]), md(x.effect),
      linksBlock("Rules", [{ id: codexId.doc("equipment", "magic-shrouds", "shroud-info"), label: "Shroud Info" }])].filter(Boolean) });
  for (const [k, x] of vis(AFFIXES)) pages.push({ id: codexId.affix(k), title: x.label, section: "equipment", group: "Affixes", subtitle: RARITIES[x.rarity] ?? x.rarity, hidden: !!x.hidden,
    blocks: [fieldsBlock([["Rarity", RARITIES[x.rarity] ?? x.rarity]]), x.foci ? { kind: "md", md: `**Offensive (through your Foci):** ${x.foci}` } : null, x.shroud ? { kind: "md", md: `**Defensive (through your Shroud):** ${x.shroud}` } : null,
      linksBlock("Rules", [{ id: codexId.doc("equipment", "magic-affixes"), label: "Magic Affixes" }])].filter(Boolean) });
  for (const [k, x] of vis(FORMS)) pages.push({ id: codexId.form(k), title: x.name, section: "equipment", group: "Icon Forms", subtitle: `${KINDS[x.align]?.label ?? x.align} Form · ${x.rarity}`, hidden: !!x.hidden,
    blocks: [md(x.ward), x.enhance ? { kind: "md", md: `**Enhanced:** ${x.enhance}` } : null, linksBlock("Rules", [{ id: codexId.doc("equipment", "mental-icons", "icon-info"), label: "Icon Info" }])].filter(Boolean) });
  for (const [k, d] of vis(OBJECT_DENSITY)) pages.push({ id: codexId.density(k), title: d.label, section: "equipment", group: "Object densities",
    blocks: [fieldsBlock([["Durability", `Body × ${d.durability}`], ["Limit", `Body × ${d.limit}`]]), linksBlock("Rules", [{ id: ruleId("objects"), label: "Objects" }])] });
  // Items: named entries are listed; generated ones have pages too (search finds them), shown with what they're made of.
  for (const [key, e] of Object.entries(ITEM_CATALOG)) {
    const s = e.system ?? {};
    const parts = e.type === "weapon" ? [[`Type`, WEAPON_TYPES[s.weaponType]?.label, codexId.weaponType(s.weaponType)], ["Weight", WEIGHTS[s.weight]?.label], ["Material", WEAPON_MATERIALS[s.material]?.label, codexId.weaponMaterial(s.material)]]
      : e.type === "armor" ? [["Armor", ARMOR_WEIGHTS[s.weight]?.label, codexId.armorWeight(s.weight)], ["Material", ARMOR_MATERIALS[s.material]?.label, codexId.armorMaterial(s.material)]]
      : e.type === "foci" ? [["Foci", FOCI_TYPES[s.fociType]?.label, codexId.foci(s.fociType)]] : e.type === "shroud" ? [["Shroud", SHROUD_TYPES[s.shroudType]?.label, codexId.shroud(s.shroudType)]]
      : e.type === "icon" ? [["Form", FORMS[s.form]?.name, codexId.form(s.form)]] : e.type === "affix" ? [["Affix", AFFIXES[s.affix]?.label, codexId.affix(s.affix)]]
      : [["Ammunition for", s.ammoType ? WEAPON_TYPES[s.ammoType]?.label : "", s.ammoType ? codexId.weaponType(s.ammoType) : null], ["Body", s.body || ""]];
    pages.push({ id: codexId.item(key), title: e.name, section: "equipment", group: isGenerated(key) ? null : "Items", subtitle: `${ITEM_TYPES[e.type]?.one ?? e.type} · ${RARITIES[e.rarity] ?? e.rarity}`,
      hidden: !!e.hidden, img: e.img, listed: !isGenerated(key),
      blocks: [fieldsBlock([...parts, ["Rarity", RARITIES[e.rarity] ?? e.rarity], ["Weight", e.pounds != null ? `${e.pounds} lb` : ""], ["Volume", e.volume != null ? `${e.volume} ft³` : ""], ["Price", e.price ?? ""]]),
        { kind: "md", md: entrySummary(e, { CASTING_FORMS, tagLabel: t => WEAPON_TAGS[t]?.label ?? t }) }, e.description ? md(htmlToText(e.description)) : null].filter(Boolean) });
  }
  return pages;
} });

registerSection({ id: "statuses", label: "Statuses", icon: "fa-solid fa-person-falling", order: 6, build(ctx) {
  return (ctx.statuses ?? []).map(s => {
    const src = STATUS_SOURCES[s.id] ?? {};
    const target = src.rule ? ruleId(src.rule) : src.entry ? ctx.byName(src.entry) : null;
    return { id: codexId.status(s.id), title: s.name, section: "statuses", group: "Statuses", img: s.img, embed: target,
      blocks: [target ? linksBlock("From", [{ id: target, label: src.entry ?? (ctx.pages.get(target)?.title ?? "Rules") }]) : md("A status a GM or an ability sets.")].filter(Boolean) };
  });
} });

/* ---------------- The index ---------------- */

/** The statuses Foundry knows (CONFIG.statusEffects); the Foundry side hands them in. */
export function setStatuses(list) { statusList = (list ?? []).map(s => ({ id: s.id, name: s.name ?? s.label ?? s.id, img: s.img ?? s.icon })); cache = null; }

/**
 * Build (or reuse) the index: every page by id, a name lookup, and the navigation tree. It's rebuilt when the world data changes.
 */
export function codexIndex() {
  if (cache && cache.version === dataVersion) return cache;
  const pages = new Map(), names = new Map();
  const ctx = { pages, statuses: statusList, byName: n => names.get(String(n).toLowerCase()) ?? null };
  const sections = [...SECTIONS].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  const later = [];
  for (const sec of sections) {
    if (sec.id === "statuses") { later.push(sec); continue; }
    for (const p of sec.build(ctx) ?? []) add(p);
  }
  for (const sec of later) for (const p of sec.build(ctx) ?? []) add(p);
  function add(p) {
    if (!p?.id || pages.has(p.id)) return;
    pages.set(p.id, p);
    const n = String(p.title ?? "").toLowerCase();
    // Names point at the most useful page: a skill tree entry over an item of the same name, a tree over a rules section.
    for (const key of [n, n.replace(/\s*\([^)]*\)\s*$/, "")]) {               // "Whirlwind (Light)" is also "Whirlwind"
      if (key && (!names.has(key) || rank(p) < rank(pages.get(names.get(key))))) names.set(key, p.id);
    }
  }
  const nav = sections.map(sec => {
    const groups = new Map();
    for (const p of pages.values()) {
      if (p.section !== sec.id || !p.group || p.listed === false) continue;
      if (!groups.has(p.group)) groups.set(p.group, []);
      groups.get(p.group).push(p.id);
    }
    return { id: sec.id, label: sec.label, icon: sec.icon, groups: [...groups].map(([label, ids]) => ({ label, ids })) };
  }).filter(s => s.groups.length);
  cache = { version: dataVersion, pages, names, nav };
  return cache;
}
const RANK = { trees: 0, equipment: 1, basics: 2, magic: 3, mental: 4, statuses: 5, rules: 6 };
const rank = p => (p.id.startsWith("item:") ? 9 : RANK[p.section] ?? 8);

/** A page by id, or by name (case-insensitive), or null. */
export function findPage(idOrName) {
  const { pages, names } = codexIndex();
  const s = String(idOrName ?? "").trim();
  return pages.get(s) ?? pages.get(names.get(s.toLowerCase())) ?? null;
}
/** The page id for a name ("Whirlwind", "Fast", "Iron"), or null. Labels like "Attack: Sword" or "Whirlwind (2 AP)" are tried without their extras. */
export function idForName(name) {
  const { names } = codexIndex();
  const n = String(name ?? "").trim().toLowerCase();
  if (!n) return null;
  return names.get(n) ?? names.get(n.replace(/\s*\([^)]*\)\s*$/, "")) ?? names.get(n.replace(/^[^:]+:\s*/, "")) ?? null;
}

/** Search every page: title first, then keywords, then text. Hidden pages only for the GM. Returns pages. */
export function searchCodex(query, { gm = false, limit = 60 } = {}) {
  const q = String(query ?? "").trim().toLowerCase();
  if (q.length < 2) return [];
  const words = q.split(/\s+/);
  const out = [];
  for (const p of codexIndex().pages.values()) {
    if (p.hidden && !gm) continue;
    const t = String(p.title).toLowerCase();
    let score = t === q ? 100 : t.startsWith(q) ? 60 : t.includes(q) ? 40 : 0;
    if (!score && words.every(w => t.includes(w))) score = 30;
    const kw = (p.keywords ?? []).join(" ").toLowerCase();
    if (!score && kw.includes(q)) score = 15;
    if (!score) { const body = pageText(p).toLowerCase(); if (words.every(w => body.includes(w))) score = 5 + (body.includes(q) ? 3 : 0); }
    if (!score) continue;
    out.push({ p, score: score - rank(p) * 0.1 - (p.id.startsWith("item:") && !p.listed ? 2 : 0) });
  }
  return out.sort((a, b) => b.score - a.score || a.p.title.localeCompare(b.p.title)).slice(0, limit).map(x => x.p);
}
const textCache = new WeakMap();
function pageText(p) {
  if (textCache.has(p)) return textCache.get(p);
  const t = (p.blocks ?? []).map(b => b.kind === "md" ? plainText(b.md) : b.kind === "fields" ? b.rows.map(r => r.slice(0, 2).join(" ")).join(" ")
    : b.kind === "entries" ? b.items.map(i => `${i.name} ${i.text}`).join(" ") : b.kind === "links" ? b.items.map(i => i.label).join(" ")
      : b.kind === "table" ? b.rows.flat().join(" ") : "").join(" ");
  textCache.set(p, t);
  return t;
}

/* ---------------- Rendering ---------------- */

const link = (id, label, cls = "fs-codex-link") => `<a class="${cls}" data-codex="${escapeHtml(id)}">${escapeHtml(label)}</a>`;
/** A page as HTML (links carry data-codex; `embed` pages show the page they point to under their own). */
export function renderPage(page, { gm = false } = {}) {
  if (!page) return `<p class="hint">That page doesn't exist (yet).</p>`;
  const { pages } = codexIndex();
  const known = id => pages.has(id) && (gm || !pages.get(id).hidden);
  const parts = [];
  for (const b of page.blocks ?? []) {
    if (b.kind === "md") parts.push(`<div class="fs-codex-text">${renderMarkdown(b.md)}</div>`);
    else if (b.kind === "fields" && b.rows.length) parts.push(`<div class="fs-codex-fields">${b.rows.map(([l, v, id]) => `<span>${escapeHtml(l)}</span><span>${id && known(id) ? link(id, String(v)) : escapeHtml(v)}</span>`).join("")}</div>`);
    else if (b.kind === "links" && b.items.length) parts.push(`<div class="fs-codex-links">${b.label ? `<h4>${escapeHtml(b.label)}</h4>` : ""}<ul>${b.items.filter(i => i.id && (known(i.id) || i.id === page.id)).map(i => `<li>${i.id === page.id ? escapeHtml(i.label) : link(i.id, i.label)}${i.note ? ` <span class="fs-sub">${escapeHtml(i.note)}</span>` : ""}</li>`).join("")}</ul></div>`);
    else if (b.kind === "entries") parts.push(`<section class="fs-codex-tier"><h4>${escapeHtml(b.label)}</h4>${b.summary ? `<p class="fs-sub">${inline(b.summary)}</p>` : ""}<ul>${b.items.map(i => `<li>${i.name ? `${link(i.id, i.name)}: ` : ""}${inline(i.text)}${i.sub?.length ? `<ul>${i.sub.map(s => `<li>${inline(s)}</li>`).join("")}</ul>` : ""}</li>`).join("")}</ul></section>`);
    else if (b.kind === "table") parts.push(`<table class="fs-codex-table"><thead><tr>${b.head.map(h => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${b.rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
  }
  if (page.embed && pages.has(page.embed)) parts.push(`<div class="fs-codex-embed">${renderPage(pages.get(page.embed), { gm }).replace(/^/, "")}</div>`);
  if (page.parent && known(page.parent)) parts.unshift(`<p class="fs-codex-up">${link(page.parent, `↑ ${pages.get(page.parent).title}`)}</p>`);
  return parts.join("");
}
