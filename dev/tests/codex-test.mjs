// The Codex: every element of the game as a page, built from the live tables; links between pages, names, search, hiding, and the Markdown renderer.
await import("../../module/store-catalog.mjs");
const S = await import("../../module/store.mjs");
const C = await import("../../module/codex.mjs");
const M = await import("../../module/codex-md.mjs");
const { TREES } = await import("../../module/trees.mjs");
const { CATALOG } = await import("../../module/spells.mjs");
const { WONDERS } = await import("../../module/mental-rules.mjs");
const { RULE_DOCS } = await import("../../module/rules-text.mjs");
let fails = 0; const ok = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };

const STATUSES = ["dead", "unconscious", "prone", "falling", "crouch", "stealth", "halfStealth", "fullStealth", "fear", "grappled", "flying", "psychedUp", "calmedDown", "limber",
  "carefulSteps", "berserk", "seeingRed", "unstoppable", "properStance", "fishy", "sliced", "taunted", "quickened"].map(id => ({ id, name: id, img: "x.svg" }));
C.setStatuses(STATUSES);
let ix = C.codexIndex();

console.log("== Everything has a page");
ok(ix.pages.size > 1300, `${ix.pages.size} pages`);
const entries = TREES.flatMap(t => t.tiers.flatMap(tier => tier.entries.filter(e => e.name).map(e => C.codexId.entry(t.id, e.name))));
ok(TREES.every(t => ix.pages.has(C.codexId.tree(t.id))) && entries.every(id => ix.pages.has(id)), `Every skill tree (${TREES.length}) and every named entry (${new Set(entries).size}) has a page`);
ok(CATALOG.every(s => ix.pages.has(`entry:${s.id}`)), `Every Core Spell and Mod (${CATALOG.length}) has a page under the id the spell engine uses`);
ok(WONDERS.flatMap(w => w.modes).every(m => ix.pages.has(`entry:${m.id}`)), "…and so does every Wonder Mode");
const secs = RULE_DOCS.flatMap(d => d.chapters.flatMap(c => [C.codexId.doc(d.id, c.id), ...c.sections.map(s => C.codexId.doc(d.id, c.id, s.id))]));
ok(secs.every(id => ix.pages.has(id)), `Every chapter and section of the Rules and Equipment docs (${secs.length})`);
ok(["tag:fast", "weaponType:bladed", "weaponMaterial:iron", "armorWeight:titanic", "armorMaterial:chitin", "foci:rod", "shroud:bastion", "affix:quartz", "form:aegis",
  "stat:str", "size:3", "damage:heat", "combo:gravity+slashing", "item:weapon.bladed.heavy.iron", "status:ignite", "archetype:martial"].every(id => ix.pages.has(id)), "Equipment, materials, tags, stats, sizes, damage types, Combos, items and conditions too");
ok(ix.pages.has(C.codexId.doc("rules", "ch5-a-b-c-s")), "The A.B.C.s chapter is there, waiting for its pages");
ok(Object.keys(C.RULE).every(k => ix.pages.has(C.codexId.doc("rules", ...C.RULE[k]))), "Every rule the Codex points at by name exists in the Rules doc (no stale section names)");

console.log("== No dead links");
let dead = [];
for (const p of ix.pages.values()) {
  for (const id of (C.renderPage(p, { gm: true }).match(/data-codex="([^"]+)"/g) ?? []).map(x => x.slice(12, -1).replace(/&amp;/g, "&").replace(/&#39;/g, "'"))) if (!ix.pages.has(id)) dead.push(`${p.id} → ${id}`);
}
ok(!dead.length, `Every link on every page goes somewhere${dead.length ? ` (dead: ${dead.slice(0, 5).join("; ")})` : ""}`);
for (const s of STATUSES) {
  const p = ix.pages.get(C.codexId.status(s.id));
  if (!p.embed) dead.push(s.id);
}
ok(!dead.length, `Every status leads to its rule or the ability that gives it${dead.length ? ` (none for: ${dead.join(", ")})` : ""}`);
const nav = ix.nav.flatMap(s => s.groups.flatMap(g => g.ids));
ok(nav.every(id => ix.pages.has(id)) && nav.length > 300 && !nav.some(id => id.startsWith("item:weapon.")), `The contents list ${nav.length} pages (generated items are found by search, not listed)`);

console.log("== Names and search");
ok(C.idForName("Whirlwind") === "entry:martial-bladed-weapons:whirlwind-light" && C.idForName("Fast") === "tag:fast" && C.idForName("Iron") === "weaponMaterial:iron", "Names find their page (Whirlwind, Fast, Iron)");
ok(C.idForName("Cut") === "entry:magic-slashing:cut" && C.idForName("Bloom") === "entry:mental-life-dream:bloom" && C.idForName("Attack: Fast") === "tag:fast", "…spells and Modes too, and a label's prefix is ignored");
ok(C.findPage("Psych Up")?.id === "entry:martial-theory:psych-up" && C.findPage("tag:pierce")?.title === "Pierce", "Pages open by id or by name");
let hits = C.searchCodex("ignite");
ok(hits[0]?.id === "status:ignite" && hits.some(p => p.id === "doc:rules/ch9-conditions/ignite"), `Search puts the best match first (${hits.slice(0, 3).map(p => p.title).join(", ")})`);
ok(C.searchCodex("cold iron").some(p => p.id === "weaponMaterial:coldIron") && !C.searchCodex("x").length, "Several words match together; one letter searches nothing");

console.log("== The world's changes show");
S.applyWorldData(S.withHidden(S.withEntry({}, "weaponMaterials", "iron", { effect: "World text for iron." }), "weaponTags", "pepper"));
ix = C.codexIndex();
ok(C.renderPage(ix.pages.get("weaponMaterial:iron")).includes("World text for iron."), "An edited material reads as the world has it");
ok(ix.pages.get("tag:pepper").hidden && !C.searchCodex("pepper").some(p => p.id === "tag:pepper") && C.searchCodex("pepper", { gm: true }).some(p => p.id === "tag:pepper"), "A hidden tag is hidden from players' searches (the GM still finds it)");
ok(!C.renderPage(ix.pages.get("weaponType:rapid")).includes('data-codex="tag:pepper"') && C.renderPage(ix.pages.get("weaponType:rapid"), { gm: true }).includes('data-codex="tag:pepper"'), "…and links to it are left out for players");
S.applyWorldData(S.withEntry({}, "items", "named.longsword", { type: "weapon", name: "Longsword", img: "x.webp", description: "<p>A <b>long</b> sword.</p><script>alert(1)</script>", rarity: "uncommon", pounds: 3, volume: null, price: 15,
  system: { weaponType: "bladed", weight: "light", material: "steel", magazine: 1, extraTypes: [] } }));
ix = C.codexIndex();
const ls = C.renderPage(ix.pages.get("item:named.longsword"));
ok(ix.nav.some(s => s.groups.some(g => g.label === "Items" && g.ids.includes("item:named.longsword"))) && ls.includes("A long sword.") && !ls.includes("<script") && ls.includes('data-codex="weaponMaterial:steel"'), "A named item is listed, links to what it's made of, and its text can't run markup");
S.applyWorldData({});

console.log("== The docs' Markdown");
const html = M.renderMarkdown("**Bold** and *it*, \\- dash, <b>tag</b>\n\n- one\n- two\n  - nested\n\n1. first\n2. second\n\n| A | B |\n| :---- | :---- |\n| x | **y** |\n\nLine one  \nLine two");
ok(html.includes("<strong>Bold</strong>") && html.includes("<em>it</em>") && html.includes("- dash") && html.includes("&lt;b&gt;tag&lt;/b&gt;"), "Bold, italic and escapes render; HTML in the text is shown, not run");
ok(/<ul><li>one<\/li><li>two<ul><li>nested<\/li><\/ul><\/li><\/ul>/.test(html) && html.includes("<ol><li>first</li><li>second</li></ol>"), "Lists, nested lists and numbered lists");
ok(html.includes("<table") && html.includes("<td><strong>y</strong></td>") && html.includes("Line one<br>Line two"), "Tables and line breaks");
ok(M.renderMarkdown("[a](#anchor) [b](https://x.y)").includes('a <a href="https://x.y" target="_blank" rel="noopener">b</a>'), "The doc's own anchors become text; web links open in a new tab");

console.log(fails ? `\n${fails} FAILED` : "\nAll Codex checks passed");
if (fails) process.exit(1);
