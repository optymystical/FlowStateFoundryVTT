import { askImage } from "./pictures.mjs";
import { getCurrencies } from "./currency.mjs";
import { startingPurse } from "./currency-rules.mjs";
import { STATS, DAMAGE_TYPES } from "./rules.mjs";
import { WEAPON_TYPES, WEIGHTS, ARMOR_WEIGHTS, RARITIES, THROW, WEAPON_MATERIALS, ARMOR_MATERIALS, weaponProfile, armorProfile, describeTags } from "./martial.mjs";
import * as creation from "./creation.mjs";
import { ITEM_CATALOG, ITEM_TYPES, entrySummary } from "./catalog.mjs";
import * as mentalRules from "./mental-rules.mjs";
import { FOCI_TYPES, SHROUD_TYPES, CASTING_FORMS, AFFIXES, AFFIX_SIDES, fociProfile, shroudProfile } from "./magic.mjs";
import * as actions from "./actions.mjs";
import * as skills from "./skills.mjs";
import * as abcRules from "./abc-rules.mjs";
import { esc, DialogV2 } from "./html.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

// Flow State - ABCs: Ancestry, then Background, then Culture; then stats, the remaining Skill Points, equipment, and the notes that finish it.
const STEPS = [
  { id: "ancestry", label: "Ancestry" },
  { id: "background", label: "Background" },
  { id: "culture", label: "Culture" },
  { id: "stats", label: "Stats" },
  { id: "skills", label: "Skill Trees" },
  { id: "equipment", label: "Equipment" },
  { id: "notes", label: "Notes" }
];
const blankAbc = () => ({ ancestry: "", background: "", focus: "", picks: {}, alloc: {}, homeland: "", circle: "", element: "", element2: "" });

/** World creation rules from settings. */
function creationRules() {
  return {
    statPoints: game.settings.get("flowstate", "startingStatPoints"),
    items: game.settings.get("flowstate", "startingItems"),
    maxRarity: game.settings.get("flowstate", "startingMaxRarity"),
    grade: game.settings.get("flowstate", "startingGrade"),
    multiType: game.settings.get("flowstate", "startingMultiType") === true,
    currency: startingPurse(getCurrencies())                        // each currency's starting amount (the Currencies settings)
  };
}

/** Step-by-step character creation. Players use this instead of creating actors; the GM's client creates the character. */
export class CharacterWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "flowstate-character-wizard",
    tag: "form",
    classes: ["flowstate", "fs-wizard"],
    window: { title: "New Character", icon: "fa-solid fa-user-plus", resizable: true },
    position: { width: 720, height: 760 },
    form: { handler: CharacterWizard.onChange, submitOnChange: true, closeOnSubmit: false },
    actions: {
      next: CharacterWizard.onNext,
      back: CharacterWizard.onBack,
      goto: CharacterWizard.onGoto,
      addItem: CharacterWizard.onAddItem,
      removeItem: CharacterWizard.onRemoveItem,
      pickImage: CharacterWizard.onPickImage,
      treeUp: CharacterWizard.onTreeUp,
      treeDown: CharacterWizard.onTreeDown,
      treeToggle: CharacterWizard.onTreeToggle,
      pickAncestry: CharacterWizard.onPickAncestry,
      pickBackground: CharacterWizard.onPickBackground,
      allocUp: CharacterWizard.onAllocUp,
      allocDown: CharacterWizard.onAllocDown,
      finish: CharacterWizard.onFinish
    }
  };

  static PARTS = {
    body: { template: "systems/flowstate/templates/wizard.hbs", scrollable: [".fs-wizard-body"] }
  };

  /** Open the wizard (or bring the open one to the front). */
  static open() {
    const existing = foundry.applications.instances.get(this.DEFAULT_OPTIONS.id);
    if (existing) return existing.bringToFront?.() ?? existing.render(true);
    return new this().render(true);
  }

  /**
   * GM: change an existing character's Ancestry, Background or Culture with the wizard's first three steps. The Background's free trees are worked
   * out again; tiers the character paid for stay (trees the new choices no longer allow are removed, refunding their Skill Points).
   */
  static openFor(actor) {
    if (!game.user.isGM || !actor) return null;
    const app = new this({ id: `flowstate-abc-${actor.id}`, window: { title: `Ancestry, Background and Culture: ${actor.name}`, icon: "fa-solid fa-people-group" } });
    const abc = { ...blankAbc(), ...foundry.utils.deepClone(actor.system.abc ?? {}) };
    Object.assign(app.state, { abc, trees: foundry.utils.deepClone(actor.system.trees ?? {}), freeTrees: foundry.utils.deepClone(actor.system.freeTrees ?? {}), name: actor.name, img: actor.img });
    app.editActor = actor;
    return app.render(true);
  }
  editActor = null;
  get steps() { return this.editActor ? STEPS.slice(0, 3) : STEPS; }

  state = { step: 0, name: "", img: creation.DEFAULT_IMG, stats: creation.emptyStats(), items: [], trees: {}, freeTrees: {}, skillArch: "ancestry", openTree: null, abc: blankAbc(), details: {} };

  /** The Background's free trees for the current choices. */
  free() { return abcRules.freeTreesFor(this.state.abc); }
  /** Rebuild the player's trees on top of the (new) free trees: what they bought above the old free tiers stays. */
  syncFree() {
    const st = this.state, free = this.free().trees;
    st.trees = creation.withFree(Object.fromEntries(Object.entries(st.trees).filter(([id, t]) => t > (st.freeTrees?.[id] ?? 0))), free);
    st.freeTrees = free;
  }

  async _prepareContext(options) {
    const rules = creationRules();
    const st = this.state;
    const pv = creation.preview(st, rules);
    const spent = creation.statTotal(st.stats);
    const remaining = rules.statPoints - spent;
    const steps = this.steps;
    st.step = Math.min(st.step, steps.length - 1);
    const step = steps[st.step].id;

    const groups = {};
    for (const [key, meta] of Object.entries(STATS)) {
      (groups[meta.group] ??= { name: meta.group, stats: [] }).stats.push({
        key, label: meta.label, value: st.stats[key], effective: pv.effective[key].value, die: pv.effective[key].die
      });
    }

    const eff = { str: pv.effective.str.value, dex: pv.effective.dex.value };
    const weaponTypes = Object.fromEntries(Object.entries(WEAPON_TYPES).filter(([k]) => k !== "unarmed" && k !== "improvised").map(([k, v]) => [k, `${v.label}${v.ranged ? " (ranged)" : ""}`]));
    // Each piece's details: labeled numbers (facts), what its type/material/form does (notes), its rarity and Codex pages.
    const fact = (label, value, tip = "") => ({ label, value: String(value), tip });
    const link = (label, codex) => ({ label, codex });
    const rar = k => (k ? { key: k, label: RARITIES[k] ?? k } : null);
    const items = st.items.map((slot, index) => {
      if (slot.kind === "named") {
        const e = ITEM_CATALOG[slot.key];
        return { index, ...slot, namedSlot: true, name: creation.slotName(slot), namedChoices: creation.allowedNamed(rules.maxRarity),
          summary: e ? `${ITEM_TYPES[e.type]?.one ?? e.type} · ${entrySummary(e, { CASTING_FORMS })}` : "Pick a named item.",
          effect: e?.description ? String(e.description).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "",
          rarity: rar(e?.rarity), links: e ? [link(e.name, `item:${slot.key}`)] : [], facts: [], notes: [] };
      }
      if (slot.kind === "foci" || slot.kind === "shroud") {
        const foci = slot.kind === "foci";
        const t = foci ? FOCI_TYPES[slot.fociType] : SHROUD_TYPES[slot.shroudType];
        const p = foci ? fociProfile({ ...slot, grade: rules.grade, affixes: [] }, { reach: pv.effective.reach.value, grasp: pv.effective.grasp.value })
          : shroudProfile({ ...slot, grade: rules.grade, affixes: [] }, pv.effective.build.value);
        return { index, ...slot, magic: true, foci, name: creation.slotName(slot),
          typeChoices: foci
            ? Object.entries(CASTING_FORMS).map(([form, f]) => ({ label: f.label, options: Object.fromEntries(Object.entries(FOCI_TYPES).filter(([, x]) => x.form === form).map(([k, x]) => [k, x.label])) }))
            : [{ label: "Shroud", options: Object.fromEntries(Object.entries(SHROUD_TYPES).map(([k, x]) => [k, x.label])) }],
          selected: foci ? slot.fociType : slot.shroudType,
          summary: !p.valid ? p.error : foci
            ? `${p.formLabel}: ${p.formText} · Durability ${p.durability}, Limit ${p.limit} · Free Affixes: ${t.free}${t.plus ? " · doubles one Affix" : ""}`
            : `Durability ${p.durability}, Limit ${p.limit} (×${p.mult} Build) · Free Affixes: ${t.free}${t.plus ? " · doubles one Affix" : ""}`,
          effect: "",
          links: [link(t?.label ?? "Type", foci ? `foci:${slot.fociType}` : `shroud:${slot.shroudType}`), ...(foci && p.form ? [link(p.formLabel, `castingForm:${p.form}`)] : [])],
          facts: !p.valid ? [] : foci ? [
            fact("Form", p.formLabel, p.formText),
            fact("Scales with", `${p.form === "multi" ? "Lesser" : STATS[p.scalingStat]?.label ?? p.scalingStat} ${p.scaling}`, `Your ${p.form === "multi" ? "lesser of Reach and Grasp" : STATS[p.scalingStat]?.label ?? p.scalingStat}, capped at ${rules.grade * 10} by the Grade`),
            fact("Cast", `${p.castAP} AP`), fact("Threshold Red.", p.tr ?? "as Raw Casting", "Threshold Reduction: lowers a spell's Threshold"),
            fact("Durability", p.durability), fact("Limit", p.limit),
            fact("Free Affixes", t.free, "Attuned Affixes up to this cost no speed"),
            ...(p.twoHandCast ? [fact("Hands", "Two to cast")] : []),
            ...(t.plus ? [fact("Doubles", "one Affix")] : [])
          ] : [
            fact("Durability", p.durability), fact("Limit", p.limit, `The listed ${t.limit} × ${p.mult} (your Build, capped by the Grade, per 10)`),
            fact("Recovers", p.fixedDur ? "fully each turn" : `${p.baseLimit} a turn`), fact("Free Affixes", t.free, "Attuned Affixes up to this cost no speed"),
            ...(t.plus ? [fact("Doubles", "one Affix")] : [])
          ],
          notes: t?.effect ? [{ label: t.label, text: t.effect }] : [] };
      }
      if (slot.kind === "icon") {
        const form = mentalRules.FORMS[slot.iconForm];
        // Only the Forms within the starting rarity limit.
        const allowedForms = creation.allowedForms(rules.maxRarity);
        const typeChoices = mentalRules.formGroups().map(g => ({ ...g, options: Object.fromEntries(Object.entries(g.options).filter(([k]) => k in allowedForms)) })).filter(g => Object.keys(g.options).length);
        return { index, ...slot, icon: true, name: creation.slotName(slot), typeChoices, selected: slot.iconForm,
          summary: `${mentalRules.KINDS[form?.align]?.label ?? ""} Form · ${form?.rarity ?? ""} · attune to it for 6 AP in combat; pick its Tenet on the item once you know a Wonder`,
          effect: "", rarity: rar(form?.rarity),
          links: form ? [link(form.name, `form:${slot.iconForm}`)] : [],
          facts: form ? [fact("Alignment", mentalRules.KINDS[form.align]?.label ?? form.align), ...(form.ap ? [fact("Ward", `${form.ap} AP`)] : []), fact("Attune", "6 AP in combat")] : [],
          notes: form ? [{ label: "Ward", text: form.ward }, { label: "Enhanced", text: form.enhance }] : [] };
      }
      if (slot.kind === "affix") {
        const a = AFFIXES[slot.affix];
        return { index, ...slot, affixSlot: true, name: creation.slotName(slot),
          affixChoices: creation.allowedAffixes(rules.maxRarity), sideChoices: AFFIX_SIDES,
          summary: `Attuned to its ${AFFIX_SIDES[slot.side] ?? "Offensive"} form: ${slot.side === "defensive" ? "your Shroud" : "your Foci and raw casting"}. Costs 20% speed past your Free Affixes`,
          effect: "", rarity: rar(a?.rarity),
          links: a ? [link(a.label, `affix:${slot.affix}`)] : [],
          facts: a ? [fact("Works through", slot.side === "defensive" ? "your Shroud" : "your Foci and raw casting"), fact("Speed", "−20%", "Past your attuned Foci's and Shroud's Free Affixes")] : [],
          notes: a ? [{ label: "Offensive (Foci)", text: a.foci, on: slot.side !== "defensive" }, { label: "Defensive (Shroud)", text: a.shroud, on: slot.side === "defensive" }] : [] };
      }
      const armor = slot.kind === "armor";
      const p = armor
        ? armorProfile({ weight: slot.weight, material: slot.material, grade: rules.grade }, pv.effective.con.value)
        : weaponProfile({ type: slot.type, weight: slot.weight, material: slot.material, grade: rules.grade }, eff);
      return {
        index, ...slot, armor, name: creation.slotName(slot),
        weights: armor ? Object.fromEntries(Object.entries(ARMOR_WEIGHTS).map(([k, v]) => [k, v.label]))
          : Object.fromEntries(Object.entries(WEIGHTS).map(([k, v]) => [k, `${v.label} (${STATS[v.stat].abbr}, ${v.ap} AP)`])),
        materials: creation.allowedMaterials(slot.kind, slot.weight, rules.maxRarity),
        summary: !p.valid ? p.error : armor
          ? `Limit ${p.limit} · Durability ${p.durability}${p.stealthDis ? ` · Stealth ${p.stealthDis === Infinity ? "auto-fail" : `Dis ×${p.stealthDis}`}` : ""} · ${p.moveText}`
          : `${p.display ?? p.formula} · ${p.ap} AP`,
        tags: !armor && p.valid ? describeTags(p.tags) : [],
        extraChoices: armor || !rules.multiType ? [] : Object.entries(weaponTypes).filter(([k]) => k !== slot.type)
          .map(([k, label]) => ({ key: k, label, on: (slot.extraTypes ?? []).includes(k) })),
        effect: "",
        rarity: rar((armor ? ARMOR_MATERIALS : WEAPON_MATERIALS)[slot.material]?.rarity),
        links: armor ? [link(`${ARMOR_WEIGHTS[slot.weight]?.label ?? ""} armor`, `armorWeight:${slot.weight}`), link(ARMOR_MATERIALS[slot.material]?.label ?? slot.material, `armorMaterial:${slot.material}`)]
          : [link(WEAPON_TYPES[slot.type]?.label ?? slot.type, `weaponType:${slot.type}`), link(WEAPON_MATERIALS[slot.material]?.label ?? slot.material, `weaponMaterial:${slot.material}`)],
        facts: !p.valid ? [] : armor ? [
          fact("Limit", p.limit), fact("Durability", p.durability), fact("Speed", `−${p.speedPct}%`),
          fact("Stealth", !p.stealthDis ? "no penalty" : p.stealthDis === Infinity ? "auto-fail" : `Disadvantage ×${p.stealthDis}`), fact("Don", p.don)
        ] : [
          fact(`Damage (${DAMAGE_TYPES[p.damageType] ?? p.damageType})`, p.dice ? p.display ?? p.formula : "no dice yet", `One die per full 10 ${STATS[p.scalingStat]?.abbr ?? ""}, capped at ${rules.grade * 10} by the Grade`),
          fact("AP", p.ap), fact("Scales with", `${STATS[p.scalingStat]?.label ?? p.scalingStat} ${p.capped}${p.stat > p.capped ? ` (of ${p.stat})` : ""}`),
          fact("Hands", p.hands === 2 ? "Two" : "One"), fact("Range", p.ranged ? `${p.range} ft` : "Melee"),
          ...(p.throwType ? [fact("Thrown", THROW[p.throwType]?.label ?? p.throwType, `${THROW[p.throwType]?.range ?? "?"} ft`)] : []),
          fact("Durability", p.durability), fact("Limit", p.limit),
          ...(p.pierce ? [fact("Pierce", p.pierce)] : []), ...(p.bash ? [fact("Bash", p.bash)] : []),
          ...(p.knockback ? [fact("Knockback", `${p.knockback} ft`)] : []), ...(p.reloadRP ? [fact("Reload", `${p.reloadRP} RP`)] : [])
        ],
        notes: p.valid && p.effect ? [{ label: armor ? ARMOR_MATERIALS[slot.material]?.label ?? "Material" : WEAPON_MATERIALS[slot.material]?.label ?? "Material", text: p.effect }] : []
      };
    });
    // A tree's tiers as the Skill Trees step shows them (entries, costs, Codex links; a Wonder's table worked out for these stats).
    const tierList = (t, owned, from = 1) => t.tiers.filter(x => x.tier >= from && (x.tier > 0 || x.entries.some(e => e.name || e.text))).map(x => ({ tier: x.tier, summary: x.summary, owned: x.tier <= owned,
      entries: x.entries.filter(e => e.name || e.text).map(e => ({ ...creation.entryBlurb(e), codex: e.name ? `entry:${t.id}:${String(e.name).replace(/^#\s*/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` : null })) }));
    const tableOf = t => (t.table?.rows?.length ? { title: t.table.title, rows: t.table.rows.map(([roll, effect, spans]) => ({ roll, effect: mentalRules.scaleSpans(effect, spans, mentalRules.wonderPower(pv.effective[mentalRules.KINDS[mentalRules.wonderById(t.id)?.kind ?? "dream"].stat]?.value ?? 0)) })) } : null);
    // A clickable tree name on an Ancestry or Background card ("Persuasion T2"); the open one shows its tiers under the card.
    const chip = (scope, id, tier = 0, label = null) => {
      const t = skills.treeById(id);
      if (!t) return null;
      const key = `${scope}:${id}`;
      return { key, id, label: label ?? `${t.name}${tier ? ` T${tier}` : ""}`, open: st.openTree === key, tier };
    };
    const opened = chips => {
      const c = chips.flat().find(x => x?.open);
      const t = c && skills.treeById(c.id);
      return t ? { id: t.id, name: t.name, tier: c.tier, ancestry: t.archetype === "ancestry", tiers: tierList(t, c.tier, t.archetype === "ancestry" ? 0 : 1), table: tableOf(t) } : null;
    };

    // Ancestry, Background and Culture.
    const abc = st.abc, anc = abcRules.ANCESTRIES[abc.ancestry] ?? null;
    const free = this.free();
    const freeTrees = free.trees;
    const ctx = { ancestry: abc.ancestry || null };
    const treeName = id => skills.treeById(id)?.name ?? id;
    const ancestries = Object.values(abcRules.ANCESTRIES).filter(a => !a.hidden).map(a => {
      const chips = skills.ancestryTrees(a.id).map(t => chip(`anc-${a.id}`, t.id)).filter(Boolean);
      return { id: a.id, name: a.name, size: a.size, selected: a.id === abc.ancestry, lifespan: a.lifespan, languages: a.languages,
        profile: a.profile.filter(p => !["Size", "Languages", "Lifespan", "Backgrounds", "Homelands", "Homeland"].includes(p.name)),
        trees: a.trees.map(treeName).join(", "), chips, openTree: opened(chips) };
    });
    const pkg = abc.background ? abcRules.packageFor(abc.background, abc.ancestry) : null;
    // A Background's starting trees as chips: fixed trees, "one of" choices, and each focus's trees.
    const itemChips = (scope, items) => items.map(it => it.tree ? [chip(scope, abcRules.treeByName(it.tree)?.id, it.tier)]
      : (it.choose ?? []).map(n => chip(scope, abcRules.treeByName(n)?.id, it.tier))).map(list => list.filter(Boolean)).filter(l => l.length)
      .map(list => ({ choice: list.length > 1, tier: list[0].tier, chips: list }));
    const backgrounds = anc ? abcRules.backgroundsFor(abc.ancestry).map(b => {
      const p = abcRules.packageFor(b.id, abc.ancestry), scope = `bg-${b.id}`;
      const groups = itemChips(scope, p?.items ?? []);
      const focuses = (p?.options ?? []).map(o => ({ name: o.name, groups: itemChips(scope, o.trees ?? []) }));
      return { id: b.id, name: b.name, selected: b.id === abc.background,
        trees: b.text?.["Starting Trees"] ?? "", trade: b.text?.["Trade Slot"] ?? "",
        differences: (b.differences ?? []).filter(d => d.ancestry === abc.ancestry).map(d => d.text).join(" "),
        groups, focuses, openTree: opened([...groups, ...focuses.flatMap(f => f.groups)].map(g => g.chips)) };
    }) : [];
    const slots = pkg ? abcRules.choiceSlots(pkg, abc.focus).map(s => ({ ...s, choices: s.choices.map(c => ({ ...c, selected: c.id === abc.picks?.[s.key] })) })) : [];
    const allocState = { ...(abc.alloc ?? {}) };
    const allocRows = pkg && free.owed ? skills.ancestryTrees(abc.ancestry).map(t => {
      const tier = Number(abc.alloc?.[t.id]) || 0, next = tier + 1, open = skills.isAvailable(allocState, t, ctx);
      const key = `alloc:${t.id}`;
      return { id: t.id, key, name: t.name, tier, nextCost: next <= skills.MAX_TIER ? next : null,
        canRaise: open && next <= skills.MAX_TIER && (free.allocCost ?? 0) + next <= free.owed, canLower: tier > 0,
        need: open ? "" : `needs ${skills.requirementText(t, ctx)}`, open: st.openTree === key, tiers: st.openTree === key ? tierList(t, tier, 0) : [] };
    }) : [];
    const homelands = anc ? abcRules.homelandsFor(abc.ancestry).map(h => ({ ...h, selected: h.id === abc.homeland, shared: !h.ancestry })) : [];
    const circles = pkg ? abcRules.circlesFor(abc.background).map(c => ({ ...c, selected: c.id === abc.circle, shared: !c.background })) : [];
    const freeList = Object.entries(freeTrees).map(([id, t]) => `${treeName(id)} ${t}`);

    // Skill trees: spend the starting Skill Points (Theory first; it opens that Archetype's other trees). The Background's tiers are free.
    const sp = pv.skillPoints;
    const spentSP = skills.spentPoints(st.trees, freeTrees);
    const treeGroups = skills.skillGroups({ ancestry: ctx.ancestry, ancestryName: anc?.name ?? "" });
    const arch = treeGroups.find(a => a.id === st.skillArch) ?? treeGroups[0];
    const available = arch.trees.filter(t => skills.isAvailable(st.trees, t, ctx));
    const treeRows = available.map(t => {
      const tier = skills.tierOf(st.trees, t.id), freeTier = skills.tierOf(freeTrees, t.id);
      const next = tier + 1;
      const dependents = tier > 0 ? Object.keys(st.trees).filter(id => {
        const other = skills.treeById(id);
        return other && other.id !== t.id && skills.tierOf(st.trees, id) > 0 && !skills.isAvailable({ ...st.trees, [t.id]: tier - 1 }, other, ctx);
      }) : [];
      return {
        id: t.id, name: t.name, tier, freeTier, theory: t.theory, open: st.openTree === t.id,
        canRaise: next <= skills.MAX_TIER && spentSP + next <= sp, nextCost: next <= skills.MAX_TIER ? next : null,
        canLower: tier > freeTier && !dependents.length,
        lowerTip: tier > 0 && tier <= freeTier ? "Free with your Background" : dependents.length ? "Lower the trees this tier opens first" : `Refund ${tier} SP`,
        tiers: tierList(t, tier, t.archetype === "ancestry" ? 0 : 1),
        // A Wonder's table, worked out for the Power these stats give (the tiers above stay as printed).
        table: tableOf(t)
      };
    });
    const pickedTrees = Object.entries(st.trees).filter(([, t]) => t > 0).map(([id, t]) => `${skills.treeById(id)?.name} ${t}${freeTrees[id] ? ` (${freeTrees[id] >= t ? "free" : `${freeTrees[id]} free`})` : ""}`);
    const armorCount = st.items.filter(creation.slotIsArmor).length;
    const errors = creation.validate(st, rules);

    return {
      steps: steps.map((s, i) => ({ ...s, index: i, num: i + 1, active: i === st.step, done: i < st.step })),
      step, isFirst: st.step === 0, isLast: st.step === steps.length - 1, editing: !!this.editActor,
      [`is_${step}`]: true,
      rules, rarityLabel: RARITIES[rules.maxRarity],
      purse: getCurrencies().filter(c => rules.currency?.[c.id] > 0).map(c => `${rules.currency[c.id]} ${c.name}`).join(", "),
      name: st.name, img: st.img, canBrowse: game.user.can?.("FILES_BROWSE") ?? false,
      abc, ancestries, anc, backgrounds, pkg,
      focusChoices: pkg?.options?.map(o => ({ name: o.name, selected: o.name === abc.focus })) ?? [],
      slots, allocRows, owed: free.owed ?? 0, allocCost: free.allocCost ?? 0, freeList, freeErrors: free.errors,
      glandChoices: abc.ancestry === "drakenblood" ? Object.entries(abcRules.GLAND_ELEMENTS).map(([k, v]) => ({ k, v, selected: k === abc.element })) : null,
      homelands, circles,
      details: Object.entries(creation.DETAIL_FIELDS).map(([k, label]) => ({ k, label, value: st.details?.[k] ?? "", long: ["appearance", "personality", "goals", "backstory"].includes(k) })),
      homelandName: homelands.find(h => h.selected)?.name ?? "", circleName: circles.find(c => c.selected)?.name ?? "", backgroundName: pkg?.name ?? "",
      statGroups: Object.values(groups), spent, remaining, overspent: remaining < 0,
      preview: pv,
      items, weaponTypes, slotsLeft: rules.items - st.items.length,
      skillPoints: sp, spentSP, remainingSP: sp - spentSP, treeRows, pickedTrees,
      archetypes: treeGroups.map(a => ({ id: a.id, label: a.label, selected: a.id === arch.id })), archPlaceholder: "",
      lockedTrees: arch.trees.length - available.length, theoryName: arch.coreName,
      canAddWeapon: st.items.length < rules.items, canAddArmor: st.items.length < rules.items && armorCount < 1,
      canAddMagic: st.items.length < rules.items,
      canAddAffix: st.items.length < rules.items,
      canAddNamed: st.items.length < rules.items && Object.keys(creation.allowedNamed(rules.maxRarity)).length > 0,
      errors: this.editActor ? [...free.errors, ...abcRules.cultureErrors(abc)] : errors,
      ready: this.editActor ? !free.errors.length && !abcRules.cultureErrors(abc).length : !errors.length
    };
  }

  /** Keep typed values in state; re-render to update totals and previews. */
  static async onChange(event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    const st = this.state;
    const rules = creationRules();
    if ("name" in data) st.name = data.name ?? "";
    if ("img" in data) st.img = data.img || creation.DEFAULT_IMG;
    if (data.skillArch) st.skillArch = data.skillArch;
    if (data.abc) {
      const a = st.abc, was = JSON.stringify([a.focus, a.picks]);
      for (const k of ["focus", "homeland", "circle", "element", "element2"]) if (k in data.abc) a[k] = String(data.abc[k] ?? "");
      if (data.abc.picks) a.picks = { ...a.picks, ...data.abc.picks };
      if (was !== JSON.stringify([a.focus, a.picks])) this.syncFree();
    }
    if (data.details) st.details = { ...st.details, ...data.details };
    if (data.stats) for (const k of Object.keys(STATS)) if (k in data.stats) st.stats[k] = Math.max(0, Math.trunc(Number(data.stats[k]) || 0));
    if (data.items) {
      for (const [i, slot] of Object.entries(data.items)) {
        if (st.items[i]) st.items[i] = creation.normalizeSlot({ ...st.items[i], ...slot }, rules.maxRarity);
      }
    }
    this.render();
  }

  static onNext() { this.state.step = Math.min(this.steps.length - 1, this.state.step + 1); this.render(); }
  static onBack() { this.state.step = Math.max(0, this.state.step - 1); this.render(); }
  static onGoto(event, target) { this.state.step = Number(target.dataset.step) || 0; this.render(); }

  static onAddItem(event, target) {
    const rules = creationRules();
    if (this.state.items.length >= rules.items) return;
    this.state.items.push(creation.newSlot(target.dataset.kind, rules.maxRarity));
    this.render();
  }
  static onRemoveItem(event, target) {
    const gone = Number(target.dataset.index);
    this.state.items.splice(gone, 1);
    this.render();
  }

  /** Raise a tree one tier (tier N costs N Skill Points; the Background's free tiers cost nothing). */
  static onTreeUp(event, target) {
    const st = this.state;
    const id = target.dataset.tree;
    const tree = skills.treeById(id);
    const sp = creation.preview(st, creationRules()).skillPoints;
    const next = skills.tierOf(st.trees, id) + 1;
    const free = st.freeTrees ?? {}, ctx = { ancestry: st.abc.ancestry || null };
    if (!tree || next > skills.MAX_TIER || !skills.isAvailable(st.trees, tree, ctx)) return;
    const spent = skills.spentPoints(st.trees, free);
    if (spent + next > sp) return ui.notifications.warn(`Tier ${next} costs ${next} Skill Points; you have ${sp - spent} left.`);
    st.trees[id] = next;
    this.render();
  }
  static onTreeDown(event, target) {
    const st = this.state;
    const id = target.dataset.tree;
    const tier = skills.tierOf(st.trees, id);
    if (tier < 1) return;
    if (tier <= skills.tierOf(st.freeTrees ?? {}, id)) return ui.notifications.warn("That tier comes free with your Background.");
    if (tier === 1) delete st.trees[id]; else st.trees[id] = tier - 1;
    // Lowering a tree can't strand the trees it opened.
    if (creation.validateTrees(st.trees, Infinity, { free: st.freeTrees ?? {}, ancestry: st.abc.ancestry || null }).length) {
      st.trees[id] = tier;
      return ui.notifications.warn("Lower the trees this tier opens first.");
    }
    this.render();
  }

  /** Pick an Ancestry (a new one clears the Background and Culture picked for the old one). */
  static onPickAncestry(event, target) {
    const st = this.state, id = target.dataset.id;
    if (!abcRules.ANCESTRIES[id] || st.abc.ancestry === id) return;
    st.abc = { ...blankAbc(), ancestry: id };
    st.freeTrees = {}; st.trees = {}; st.skillArch = "ancestry";
    this.render();
  }
  /** Pick a Background (its choices start empty; the trees bought for the old one are cleared). */
  static onPickBackground(event, target) {
    const st = this.state, id = target.dataset.id;
    if (st.abc.background === id) return;
    Object.assign(st.abc, { background: id, focus: "", picks: {}, alloc: {}, circle: "" });
    st.freeTrees = {}; st.trees = {};
    this.syncFree();
    this.render();
  }
  /** The Outsider's points (or a Background's leftovers) on the Ancestry's own trees. */
  static onAllocUp(event, target) {
    const st = this.state, id = target.dataset.tree, t = skills.treeById(id);
    const tier = Number(st.abc.alloc?.[id]) || 0, f = this.free();
    if (!t || tier >= skills.MAX_TIER || !skills.isAvailable({ ...st.abc.alloc }, t, { ancestry: st.abc.ancestry })) return;
    if ((f.allocCost ?? 0) + tier + 1 > (f.owed ?? 0)) return ui.notifications.warn(`Tier ${tier + 1} costs ${tier + 1}; ${(f.owed ?? 0) - (f.allocCost ?? 0)} left.`);
    st.abc.alloc = { ...st.abc.alloc, [id]: tier + 1 };
    this.syncFree(); this.render();
  }
  static onAllocDown(event, target) {
    const st = this.state, id = target.dataset.tree;
    const tier = Number(st.abc.alloc?.[id]) || 0;
    if (tier < 1) return;
    const alloc = { ...st.abc.alloc, [id]: tier - 1 };
    if (!alloc[id]) delete alloc[id];
    if (Object.keys(alloc).some(x => !skills.isAvailable(alloc, skills.treeById(x), { ancestry: st.abc.ancestry }))) return ui.notifications.warn("Lower the trees this tier opens first.");
    st.abc.alloc = alloc;
    this.syncFree(); this.render();
  }
  static onTreeToggle(event, target) {
    const key = target.dataset.key ?? target.dataset.tree;
    this.state.openTree = this.state.openTree === key ? null : key;
    this.render();
  }

  /** The GM's change to an existing character's ABCs: new free trees, the paid tiers kept where the new choices still allow them, Size from the Ancestry. */
  async applyToActor() {
    const actor = this.editActor, abc = creation.cleanAbc(this.state.abc);
    const free = abcRules.freeTreesFor(abc);
    if (free.errors.length) return ui.notifications.warn(free.errors[0]);
    const oldFree = actor.system.freeTrees ?? {}, ctx = { ancestry: abc.ancestry };
    const paid = Object.fromEntries(Object.entries(actor.system.trees ?? {}).filter(([id, t]) => t > (oldFree[id] ?? 0)));
    let trees = creation.withFree(paid, free.trees);
    // Drop trees the new choices don't allow (another Ancestry's trees, or ones whose requirement is gone), until nothing changes.
    for (let i = 0; i < 6; i++) {
      const gone = Object.keys(trees).filter(id => !skills.isAvailable(trees, skills.treeById(id), ctx));
      if (!gone.length) break;
      for (const id of gone) delete trees[id];
    }
    const removed = Object.keys(actor.system.trees ?? {}).filter(id => !(id in trees)).map(id => skills.treeById(id)?.name ?? id);
    const ok = await DialogV2().confirm({ window: { title: `Change ${actor.name}'s ABCs?` }, rejectClose: false,
      content: `<p>${esc(actor.name)} becomes a <strong>${esc(abcRules.ANCESTRIES[abc.ancestry]?.name ?? "")}</strong> ${esc(abcRules.BACKGROUNDS[abc.background]?.name ?? "")}.</p>
        <p>Free trees: ${Object.entries(free.trees).map(([id, t]) => `${esc(skills.treeById(id)?.name ?? id)} ${t}`).join(", ") || "none"}.</p>
        ${removed.length ? `<p>These trees go (their Skill Points come back): ${removed.map(esc).join(", ")}.</p>` : ""}` });
    if (!ok) return;
    // Object fields merge, so the trees, choices and free trees are written whole: Foundry v14's ForcedReplacement, or (v13) deleting the old keys first.
    const opts = { flowstateAncestry: true, flowstateSystem: true };
    const Replace = foundry.data.operators?.ForcedReplacement;
    const whole = v => (Replace ? Replace.create(v) : v);
    if (!Replace) {
      const gone = Object.fromEntries(Object.keys(actor.system.trees ?? {}).filter(id => !(id in trees)).map(id => [`system.trees.-=${id}`, null]));
      await actor.update({ ...gone, "system.-=abc": null, "system.-=freeTrees": null }, opts);
    }
    await actor.update({ "system.trees": whole(trees), "system.abc": whole(abc), "system.freeTrees": whole(free.trees), "system.size": abcRules.ancestrySize(abc.ancestry) }, opts);
    ui.notifications.info(`${actor.name}'s Ancestry, Background and Culture are updated.`);
    this.close();
  }

  static async onPickImage() {
    const url = await askImage("Portrait", this.state.img);
    if (url) { this.state.img = url; this.render(); }
  }

  static async onFinish() {
    if (this.editActor) return this.applyToActor();
    const rules = creationRules();
    const errors = creation.validate(this.state, rules);
    if (errors.length) return ui.notifications.warn(errors[0]);
    if (!game.user.isGM && !game.users.activeGM) return ui.notifications.error("A GM must be connected to create your character.");
    await actions.requestGM("createCharacter", { userId: game.user.id, choice: foundry.utils.deepClone(this.state) });
    ui.notifications.info(`Creating ${this.state.name}…`);
    this.close();
  }
}

/**
 * GM side: re-validate the choice (never trust the client), then create the locked character for the player
 * and make it their assigned character if they don't have one.
 */
export async function createCharacterForUser({ userId, choice }) {
  const user = game.users.get(userId);
  const rules = creationRules();
  const errors = creation.validate(choice, rules);
  if (!user || errors.length) {
    return ChatMessage.create({
      whisper: [userId, ...game.users.filter(u => u.isGM).map(u => u.id)],
      content: `<div class="flowstate-card"><header class="fs-card-title">Character not created</header><ul class="fs-list">${errors.map(e => `<li>${foundry.utils.escapeHTML(e)}</li>`).join("")}</ul></div>`
    });
  }
  const actor = await Actor.create(creation.buildActorData(choice, rules, userId));
  if (actor && !user.isGM && !user.character) await user.update({ character: actor.id });
  await ChatMessage.create({
    content: `<div class="flowstate-card"><header class="fs-card-title">New character</header><p><strong>${foundry.utils.escapeHTML(user.name)}</strong> created <strong>${foundry.utils.escapeHTML(actor.name)}</strong>.</p></div>`
  });
  return actor;
}
