/**
 * The GM's NPC wizard: like the New Character wizard, but the GM sets the stat points, Skill Points and their ratio, and can pick any gear
 * (any rarity and grade). It makes an unlinked NPC on the GM's client. Only GMs can open it (the button is hidden for everyone else).
 */
import { askImage } from "./pictures.mjs";
import { STATS } from "./rules.mjs";
import { WEAPON_TYPES, WEIGHTS, ARMOR_WEIGHTS, RARITIES, weaponProfile, armorProfile, describeTags } from "./martial.mjs";
import * as creation from "./creation.mjs";
import * as npc from "./npc-creation.mjs";
import * as mentalRules from "./mental-rules.mjs";
import { FOCI_TYPES, SHROUD_TYPES, CASTING_FORMS, AFFIXES, fociProfile, shroudProfile } from "./magic.mjs";
import * as skills from "./skills.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

const STEPS = [
  { id: "identity", label: "Identity" },
  { id: "points", label: "Points & Stats" },
  { id: "skills", label: "Skill Trees" },
  { id: "equipment", label: "Gear" },
  { id: "review", label: "Review" }
];

export class NpcWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "flowstate-npc-wizard",
    tag: "form",
    classes: ["flowstate", "fs-wizard"],
    window: { title: "New NPC", icon: "fa-solid fa-skull", resizable: true },
    position: { width: 700, height: 740 },
    form: { handler: NpcWizard.onChange, submitOnChange: true, closeOnSubmit: false },
    actions: {
      next: NpcWizard.onNext, back: NpcWizard.onBack, goto: NpcWizard.onGoto,
      addItem: NpcWizard.onAddItem, removeItem: NpcWizard.onRemoveItem, pickImage: NpcWizard.onPickImage,
      treeUp: NpcWizard.onTreeUp, treeDown: NpcWizard.onTreeDown, treeToggle: NpcWizard.onTreeToggle,
      evenStats: NpcWizard.onEvenStats, finish: NpcWizard.onFinish
    }
  };

  static PARTS = { body: { template: "systems/flowstate/templates/npc-wizard.hbs", scrollable: [".fs-wizard-body"] } };

  /** Open the wizard (GMs only). */
  static open() {
    if (!game.user.isGM) return ui.notifications.warn("Only the GM can create NPCs with this wizard.");
    const existing = foundry.applications.instances.get(this.DEFAULT_OPTIONS.id);
    if (existing) return existing.bringToFront?.() ?? existing.render(true);
    return new this().render(true);
  }

  state = {
    step: 0, name: "", img: creation.DEFAULT_IMG, size: npc.NPC_DEFAULTS.size, disposition: npc.NPC_DEFAULTS.disposition,
    statPoints: npc.NPC_DEFAULTS.statPoints, ratio: npc.NPC_DEFAULTS.ratio, skillManual: false, skillPoints: npc.NPC_DEFAULTS.skillPoints,
    grade: npc.NPC_DEFAULTS.grade, ammo: npc.NPC_DEFAULTS.ammo,
    stats: npc.evenStats(npc.NPC_DEFAULTS.statPoints), items: [], trees: {}, skillArch: "martial", openTree: null
  };

  async _prepareContext(options) {
    const st = this.state;
    const b = npc.budget(st);
    const pv = npc.preview(st);
    const step = STEPS[st.step].id;

    const groups = {};
    for (const [key, meta] of Object.entries(STATS)) {
      (groups[meta.group] ??= { name: meta.group, stats: [] }).stats.push({ key, label: meta.label, value: st.stats[key], effective: pv.effective[key].value, die: pv.effective[key].die });
    }

    const eff = { str: pv.effective.str.value, dex: pv.effective.dex.value };
    const weaponTypes = Object.fromEntries(Object.entries(WEAPON_TYPES).filter(([k]) => k !== "unarmed" && k !== "improvised").map(([k, v]) => [k, `${v.label}${v.ranged ? " (ranged)" : ""}`]));
    const rangedTypes = Object.fromEntries([["", "— Not ammunition —"], ...Object.entries(WEAPON_TYPES).filter(([, v]) => v.ranged).map(([k, v]) => [k, `${v.label} ammunition`])]);
    const targets = creation.affixTargets(st.items);
    const items = st.items.map((slot, index) => {
      const base = { index, ...slot, rawName: slot.name, name: npc.slotName(slot), ready: slot.ready !== false };
      if (slot.kind === "gear") return { ...base, gear: true, ammoChoices: rangedTypes, summary: slot.ammoType ? `Ammunition for ${WEAPON_TYPES[slot.ammoType]?.label} weapons` : "A plain item" };
      if (slot.kind === "foci" || slot.kind === "shroud") {
        const foci = slot.kind === "foci";
        const t = foci ? FOCI_TYPES[slot.fociType] : SHROUD_TYPES[slot.shroudType];
        const p = foci ? fociProfile({ ...slot, affixes: [] }, { reach: pv.effective.reach.value, grasp: pv.effective.grasp.value }) : shroudProfile({ ...slot, affixes: [] }, pv.effective.build.value);
        return { ...base, magic: true, foci, readyLabel: foci ? "Attuned and held" : "Attuned",
          typeChoices: foci
            ? Object.entries(CASTING_FORMS).map(([form, f]) => ({ label: f.label, options: Object.fromEntries(Object.entries(FOCI_TYPES).filter(([, x]) => x.form === form).map(([k, x]) => [k, x.label])) }))
            : [{ label: "Shroud", options: Object.fromEntries(Object.entries(SHROUD_TYPES).map(([k, x]) => [k, x.label])) }],
          selected: foci ? slot.fociType : slot.shroudType,
          summary: !p.valid ? p.error : foci
            ? `${p.formLabel}: ${p.formText} · Durability ${p.durability}, Limit ${p.limit} · ${t.affixes}${t.plus ? "+" : ""} Affix slot${t.affixes === 1 ? "" : "s"}`
            : `Durability ${p.durability}, Limit ${p.limit} (×${p.mult} Build) · ${t.affixes}${t.plus ? "+" : ""} Affix slot${t.affixes === 1 ? "" : "s"}`,
          effect: t?.effect ?? "" };
      }
      if (slot.kind === "icon") {
        const form = mentalRules.FORMS[slot.iconForm];
        return { ...base, icon: true, readyLabel: "Attuned", typeChoices: mentalRules.formGroups(), selected: slot.iconForm,
          summary: `${mentalRules.KINDS[form?.align]?.label ?? ""} Form · ${form?.rarity ?? ""}`, effect: form ? `Ward: ${form.ward} Enhanced: ${form.enhance}` : "" };
      }
      if (slot.kind === "affix") {
        const a = AFFIXES[slot.affix];
        const on = targets.find(t => String(t.index) === slot.target);
        return { ...base, affixSlot: true, affixChoices: creation.allowedAffixes(npc.ANY_RARITY),
          targetChoices: Object.fromEntries(targets.map(t => [String(t.index), `${t.label} · ${t.free} free`])),
          summary: on ? `On ${on.label}` : "Pick a Foci or Shroud for it",
          effect: a ? (on?.slot.kind === "shroud" ? `Shroud: ${a.shroud}` : on ? `Foci: ${a.foci}` : `Foci: ${a.foci} · Shroud: ${a.shroud}`) : "" };
      }
      const armor = slot.kind === "armor";
      const grade = Math.max(1, Math.trunc(Number(slot.grade)) || 1);
      const p = armor ? armorProfile({ weight: slot.weight, material: slot.material, grade }, pv.effective.con.value)
        : weaponProfile({ type: slot.type, weight: slot.weight, material: slot.material, grade }, eff);
      return { ...base, armor, readyLabel: armor ? "Worn" : "Held",
        weights: armor ? Object.fromEntries(Object.entries(ARMOR_WEIGHTS).map(([k, v]) => [k, v.label])) : Object.fromEntries(Object.entries(WEIGHTS).map(([k, v]) => [k, `${v.label} (${STATS[v.stat].abbr}, ${v.ap} AP)`])),
        materials: creation.allowedMaterials(slot.kind, slot.weight, npc.ANY_RARITY),
        summary: !p.valid ? p.error : armor
          ? `Limit ${p.limit} · Durability ${p.durability}${p.stealthDis ? ` · Stealth ${p.stealthDis === Infinity ? "auto-fail" : `Dis ×${p.stealthDis}`}` : ""} · ${p.moveAP} AP/move`
          : `${p.display ?? p.formula} · ${p.ap} AP`,
        tags: !armor && p.valid ? describeTags(p.tags) : [],
        extraChoices: armor ? [] : Object.entries(weaponTypes).filter(([k]) => k !== slot.type).map(([k, label]) => ({ key: k, label, on: (slot.extraTypes ?? []).includes(k) })),
        effect: p.valid ? p.effect : "" };
    });

    // Skill trees: spend the Skill Points (Theory first; it opens that Archetype's other trees).
    const sp = b.skillPoints;
    const spentSP = skills.spentPoints(st.trees);
    const arch = skills.ARCHETYPES.find(a => a.id === st.skillArch) ?? skills.ARCHETYPES[0];
    const available = skills.treesFor(arch.id).filter(t => skills.isAvailable(st.trees, t));
    const treeRows = available.map(t => {
      const tier = skills.tierOf(st.trees, t.id), next = tier + 1;
      const dependents = t.theory ? Object.keys(st.trees).filter(id => {
        const other = skills.treeById(id);
        return other && !other.theory && other.archetype === t.archetype && skills.tierOf(st.trees, id) > 0 && other.requires >= tier;
      }) : [];
      return {
        id: t.id, name: t.name, tier, theory: t.theory, open: st.openTree === t.id,
        canRaise: next <= skills.MAX_TIER && spentSP + next <= sp, nextCost: next <= skills.MAX_TIER ? next : null,
        canLower: tier > 0 && !dependents.length, lowerTip: dependents.length ? "Lower the trees this Theory tier opens first" : `Refund ${tier} SP`,
        tiers: t.tiers.filter(x => x.tier > 0).map(x => ({ tier: x.tier, summary: x.summary, owned: x.tier <= tier, names: x.entries.map(e => e.name).filter(Boolean).join(", ") }))
      };
    });
    const pickedTrees = Object.entries(st.trees).filter(([, t]) => t > 0).map(([id, t]) => `${skills.treeById(id)?.name} ${t}`);
    const errors = npc.validate(st);

    return {
      steps: STEPS.map((s, i) => ({ ...s, index: i, num: i + 1, active: i === st.step, done: i < st.step })),
      step, isFirst: st.step === 0, isLast: st.step === STEPS.length - 1, [`is_${step}`]: true,
      name: st.name, img: st.img, canBrowse: game.user.can?.("FILES_BROWSE") ?? false,
      sizes: Object.fromEntries([1, 2, 3, 4, 5].map(n => [n, `Size ${n}`])), size: st.size,
      dispositions: npc.DISPOSITIONS, disposition: String(st.disposition),
      statPoints: b.statPoints, ratio: b.ratio, skillManual: st.skillManual, skillPointsField: st.skillManual ? st.skillPoints : b.skillPoints, grade: st.grade, ammo: st.ammo,
      statGroups: Object.values(groups), spent: b.spent, remaining: b.remaining, overspent: b.remaining < 0,
      preview: pv, items, weaponTypes,
      skillPoints: sp, spentSP, remainingSP: sp - spentSP, treeRows, pickedTrees,
      archetypes: skills.ARCHETYPES.map(a => ({ ...a, selected: a.id === arch.id })), archPlaceholder: arch.placeholder ?? "",
      lockedTrees: skills.treesFor(arch.id).length - available.length, theoryName: skills.theoryFor(arch.id)?.name ?? "",
      canAddAffix: targets.some(t => t.free > 0),
      errors, ready: !errors.length
    };
  }

  /** Keep typed values in state; re-render to update totals and previews. */
  static async onChange(event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    const st = this.state;
    const num = (v, d, min = 0) => Math.max(min, Math.trunc(Number(v)) || d);
    if ("name" in data) st.name = data.name ?? "";
    if ("img" in data) st.img = data.img || creation.DEFAULT_IMG;
    if ("size" in data) st.size = Math.min(5, num(data.size, 3, 1));
    if ("disposition" in data) st.disposition = Math.trunc(Number(data.disposition)) || 0;
    if ("statPoints" in data) st.statPoints = num(data.statPoints, 0);
    if ("ratio" in data) { const r = Number(data.ratio); st.ratio = r > 0 ? r : st.ratio; }
    if ("skillManual" in data) st.skillManual = data.skillManual === true || data.skillManual === "true" || data.skillManual === "on";
    if (st.skillManual && "skillPoints" in data) st.skillPoints = num(data.skillPoints, 0);
    if ("grade" in data) st.grade = num(data.grade, 1, 1);
    if ("ammo" in data) st.ammo = Math.min(100, num(data.ammo, 0));
    if (data.skillArch) st.skillArch = data.skillArch;
    if (data.stats) for (const k of Object.keys(STATS)) if (k in data.stats) st.stats[k] = num(data.stats[k], 0);
    if (data.items) {
      for (const [i, slot] of Object.entries(data.items)) {
        if (!st.items[i]) continue;
        // An unchecked checkbox isn't sent: the form's hidden marker tells us the Ready box was on the form.
        const merged = { ...st.items[i], ...slot };
        if ("readyMark" in slot && !("ready" in slot)) merged.ready = false;
        st.items[i] = npc.normalizeNpcSlot(merged);
      }
    }
    // Trees that no longer fit the Skill Points (they were lowered) are trimmed from the top.
    this.render();
  }

  static onNext() { this.state.step = Math.min(STEPS.length - 1, this.state.step + 1); this.render(); }
  static onBack() { this.state.step = Math.max(0, this.state.step - 1); this.render(); }
  static onGoto(event, target) { this.state.step = Number(target.dataset.step) || 0; this.render(); }
  static onEvenStats() { this.state.stats = npc.evenStats(this.state.statPoints); this.render(); }

  static onAddItem(event, target) {
    this.state.items.push(npc.newNpcSlot(target.dataset.kind, this.state.grade, this.state.items));
    this.render();
  }
  static onRemoveItem(event, target) {
    const gone = Number(target.dataset.index);
    this.state.items.splice(gone, 1);
    // Affixes point at their Foci/Shroud by position: shift them, and unhook any that were on the removed item.
    for (const slot of this.state.items) {
      if (slot.kind !== "affix" || slot.target === "") continue;
      const t = Number(slot.target);
      slot.target = t === gone ? "" : t > gone ? String(t - 1) : slot.target;
    }
    this.render();
  }

  static onTreeUp(event, target) {
    const st = this.state, id = target.dataset.tree, tree = skills.treeById(id);
    const sp = npc.budget(st).skillPoints, next = skills.tierOf(st.trees, id) + 1;
    if (!tree || next > skills.MAX_TIER || !skills.isAvailable(st.trees, tree)) return;
    if (skills.spentPoints(st.trees) + next > sp) return ui.notifications.warn(`Tier ${next} costs ${next} Skill Points; ${sp - skills.spentPoints(st.trees)} are left.`);
    st.trees[id] = next;
    this.render();
  }
  static onTreeDown(event, target) {
    const st = this.state, id = target.dataset.tree, tier = skills.tierOf(st.trees, id);
    if (tier < 1) return;
    if (tier === 1) delete st.trees[id]; else st.trees[id] = tier - 1;
    if (creation.validateTrees(st.trees, Infinity).length) { st.trees[id] = tier; return ui.notifications.warn("Lower the trees this Theory tier opens first."); }
    this.render();
  }
  static onTreeToggle(event, target) { this.state.openTree = this.state.openTree === target.dataset.tree ? null : target.dataset.tree; this.render(); }

  static async onPickImage() {
    const url = await askImage("Portrait", this.state.img);
    if (url) { this.state.img = url; this.render(); }
  }

  static async onFinish() {
    const actor = await createNpc(this.state);
    if (!actor) return;
    this.close();
  }
}

/** Create the NPC (GM only; re-validated here). Returns the actor, or null with a warning. */
export async function createNpc(choice) {
  if (!game.user.isGM) { ui.notifications.warn("Only the GM can create NPCs with this wizard."); return null; }
  const errors = npc.validate(choice);
  if (errors.length) { ui.notifications.warn(errors[0]); return null; }
  const actor = await Actor.create(npc.buildNpcData(choice));
  if (actor) { ui.notifications.info(`${actor.name} created.`); actor.sheet?.render(true); }
  return actor;
}
