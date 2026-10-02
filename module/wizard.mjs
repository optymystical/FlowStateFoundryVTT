import { STATS } from "./rules.mjs";
import { WEAPON_TYPES, WEIGHTS, ARMOR_WEIGHTS, RARITIES, weaponProfile, armorProfile, describeTags } from "./martial.mjs";
import * as creation from "./creation.mjs";
import { FOCI_TYPES, SHROUD_TYPES, CASTING_FORMS, AFFIXES, fociProfile, shroudProfile } from "./magic.mjs";
import * as actions from "./actions.mjs";
import * as skills from "./skills.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

const STEPS = [
  { id: "identity", label: "Identity" },
  { id: "stats", label: "Stats" },
  { id: "skills", label: "Skill Trees" },
  { id: "equipment", label: "Equipment" },
  { id: "review", label: "Review" }
];

/** World creation rules from settings. */
export function creationRules() {
  return {
    statPoints: game.settings.get("flowstate", "startingStatPoints"),
    items: game.settings.get("flowstate", "startingItems"),
    maxRarity: game.settings.get("flowstate", "startingMaxRarity"),
    grade: game.settings.get("flowstate", "startingGrade"),
    multiType: game.settings.get("flowstate", "startingMultiType") === true
  };
}

/** Step-by-step character creation. Players use this instead of creating actors; the GM's client creates the character. */
export class CharacterWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "flowstate-character-wizard",
    tag: "form",
    classes: ["flowstate", "fs-wizard"],
    window: { title: "New Character", icon: "fa-solid fa-user-plus", resizable: true },
    position: { width: 640, height: 700 },
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

  state = { step: 0, name: "", img: creation.DEFAULT_IMG, stats: creation.emptyStats(), items: [], trees: {}, skillArch: "martial", openTree: null };

  async _prepareContext(options) {
    const rules = creationRules();
    const st = this.state;
    const pv = creation.preview(st, rules);
    const spent = creation.statTotal(st.stats);
    const remaining = rules.statPoints - spent;
    const step = STEPS[st.step].id;

    const groups = {};
    for (const [key, meta] of Object.entries(STATS)) {
      (groups[meta.group] ??= { name: meta.group, stats: [] }).stats.push({
        key, label: meta.label, value: st.stats[key], effective: pv.effective[key].value, die: pv.effective[key].die
      });
    }

    const eff = { str: pv.effective.str.value, dex: pv.effective.dex.value };
    const weaponTypes = Object.fromEntries(Object.entries(WEAPON_TYPES).filter(([k]) => k !== "unarmed" && k !== "improvised").map(([k, v]) => [k, `${v.label}${v.ranged ? " (ranged)" : ""}`]));
    const targets = creation.affixTargets(st.items);
    const items = st.items.map((slot, index) => {
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
            ? `${p.formLabel}: ${p.formText} · Durability ${p.durability}, Limit ${p.limit} · ${t.affixes}${t.plus ? "+" : ""} Affix slot${t.affixes === 1 ? "" : "s"}`
            : `Durability ${p.durability}, Limit ${p.limit} (×${p.mult} Build) · ${t.affixes}${t.plus ? "+" : ""} Affix slot${t.affixes === 1 ? "" : "s"}`,
          effect: t?.effect ?? "" };
      }
      if (slot.kind === "affix") {
        const a = AFFIXES[slot.affix];
        const on = targets.find(t => String(t.index) === slot.target);
        return { index, ...slot, affixSlot: true, name: creation.slotName(slot),
          affixChoices: creation.allowedAffixes(rules.maxRarity),
          targetChoices: Object.fromEntries(targets.map(t => [String(t.index), `${t.label} · ${t.free} free`])),
          summary: on ? `On ${on.label}` : "Pick a Foci or Shroud for it",
          effect: a ? (on?.slot.kind === "shroud" ? `Shroud: ${a.shroud}` : on ? `Foci: ${a.foci}` : `Foci: ${a.foci} · Shroud: ${a.shroud}`) : "" };
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
          ? `Limit ${p.limit} · Durability ${p.durability}${p.stealthDis ? ` · Stealth ${p.stealthDis === Infinity ? "auto-fail" : `Dis ×${p.stealthDis}`}` : ""} · ${p.moveAP} AP/move`
          : `${p.display ?? p.formula} · ${p.ap} AP`,
        tags: !armor && p.valid ? describeTags(p.tags) : [],
        extraChoices: armor || !rules.multiType ? [] : Object.entries(weaponTypes).filter(([k]) => k !== slot.type)
          .map(([k, label]) => ({ key: k, label, on: (slot.extraTypes ?? []).includes(k) })),
        effect: p.valid ? p.effect : ""
      };
    });
    // Skill trees: spend the starting Skill Points (Theory first; it opens that Archetype's other trees).
    const sp = pv.skillPoints;
    const spentSP = skills.spentPoints(st.trees);
    const arch = skills.ARCHETYPES.find(a => a.id === st.skillArch) ?? skills.ARCHETYPES[0];
    const available = skills.treesFor(arch.id).filter(t => skills.isAvailable(st.trees, t));
    const treeRows = available.map(t => {
      const tier = skills.tierOf(st.trees, t.id);
      const next = tier + 1;
      const dependents = t.theory ? Object.keys(st.trees).filter(id => {
        const other = skills.treeById(id);
        return other && !other.theory && other.archetype === t.archetype && skills.tierOf(st.trees, id) > 0 && other.requires >= tier;
      }) : [];
      return {
        id: t.id, name: t.name, tier, theory: t.theory, open: st.openTree === t.id,
        canRaise: next <= skills.MAX_TIER && spentSP + next <= sp, nextCost: next <= skills.MAX_TIER ? next : null,
        canLower: tier > 0 && !dependents.length, lowerTip: dependents.length ? "Lower the trees this Theory tier opens first" : `Refund ${tier} SP`,
        tiers: t.tiers.filter(x => x.tier > 0).map(x => ({ tier: x.tier, summary: x.summary, owned: x.tier <= tier,
          names: x.entries.map(e => e.name).filter(Boolean).join(", ") }))
      };
    });
    const pickedTrees = Object.entries(st.trees).filter(([, t]) => t > 0).map(([id, t]) => `${skills.treeById(id)?.name} ${t}`);
    const armorCount = st.items.filter(i => i.kind === "armor").length;
    const errors = creation.validate(st, rules);

    return {
      steps: STEPS.map((s, i) => ({ ...s, index: i, num: i + 1, active: i === st.step, done: i < st.step })),
      step, isFirst: st.step === 0, isLast: st.step === STEPS.length - 1,
      [`is_${step}`]: true,
      rules, rarityLabel: RARITIES[rules.maxRarity],
      name: st.name, img: st.img, canBrowse: game.user.can?.("FILES_BROWSE") ?? false,
      statGroups: Object.values(groups), spent, remaining, overspent: remaining < 0,
      preview: pv,
      items, weaponTypes, slotsLeft: rules.items - st.items.length,
      skillPoints: sp, spentSP, remainingSP: sp - spentSP, treeRows, pickedTrees,
      archetypes: skills.ARCHETYPES.map(a => ({ ...a, selected: a.id === arch.id })), archPlaceholder: arch.placeholder ?? "",
      lockedTrees: skills.treesFor(arch.id).length - available.length, theoryName: skills.theoryFor(arch.id)?.name ?? "",
      canAddWeapon: st.items.length < rules.items, canAddArmor: st.items.length < rules.items && armorCount < 1,
      canAddMagic: st.items.length < rules.items,
      canAddAffix: st.items.length < rules.items && targets.some(t => t.free > 0),
      errors, ready: !errors.length
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
    if (data.stats) for (const k of Object.keys(STATS)) if (k in data.stats) st.stats[k] = Math.max(0, Math.trunc(Number(data.stats[k]) || 0));
    if (data.items) {
      for (const [i, slot] of Object.entries(data.items)) {
        if (st.items[i]) st.items[i] = creation.normalizeSlot({ ...st.items[i], ...slot }, rules.maxRarity);
      }
    }
    this.render();
  }

  static onNext() { this.state.step = Math.min(STEPS.length - 1, this.state.step + 1); this.render(); }
  static onBack() { this.state.step = Math.max(0, this.state.step - 1); this.render(); }
  static onGoto(event, target) { this.state.step = Number(target.dataset.step) || 0; this.render(); }

  static onAddItem(event, target) {
    const rules = creationRules();
    if (this.state.items.length >= rules.items) return;
    this.state.items.push(creation.newSlot(target.dataset.kind, rules.maxRarity, this.state.items));
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

  /** Raise a tree one tier (tier N costs N Skill Points). */
  static onTreeUp(event, target) {
    const st = this.state;
    const id = target.dataset.tree;
    const tree = skills.treeById(id);
    const sp = creation.preview(st, creationRules()).skillPoints;
    const next = skills.tierOf(st.trees, id) + 1;
    if (!tree || next > skills.MAX_TIER || !skills.isAvailable(st.trees, tree)) return;
    if (skills.spentPoints(st.trees) + next > sp) return ui.notifications.warn(`Tier ${next} costs ${next} Skill Points; you have ${sp - skills.spentPoints(st.trees)} left.`);
    st.trees[id] = next;
    this.render();
  }
  static onTreeDown(event, target) {
    const st = this.state;
    const id = target.dataset.tree;
    const tier = skills.tierOf(st.trees, id);
    if (tier < 1) return;
    if (tier === 1) delete st.trees[id]; else st.trees[id] = tier - 1;
    // Lowering a Theory can't strand trees it opened.
    if (creation.validateTrees(st.trees, Infinity).length) {
      st.trees[id] = tier;
      return ui.notifications.warn("Lower the trees this Theory tier opens first.");
    }
    this.render();
  }
  static onTreeToggle(event, target) {
    this.state.openTree = this.state.openTree === target.dataset.tree ? null : target.dataset.tree;
    this.render();
  }

  static onPickImage() {
    const FP = foundry.applications.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
    new FP({ type: "image", current: this.state.img, callback: path => { this.state.img = path; this.render(); } }).browse();
  }

  static async onFinish() {
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
