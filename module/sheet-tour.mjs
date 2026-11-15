/**
 * The character sheet tutorial: a guided tour over the character's own sheet. Each stop (sheet-tour-text.mjs) switches the sheet to its tab, opens
 * its section, outlines the part it explains in gold and shows a modal popup beside it (Back / Next / End tour); the sheet can't be used until the
 * tour ends. It starts from the end of the character tutorial (the "view the character sheet tutorial?" popup) and from the sheet's ⋮ menu.
 */
import { popup } from "./tutorial.mjs";
import { sheetStops } from "./sheet-tour-text.mjs";
import { activeArchetypes } from "./tutorial-rules.mjs";
import * as abcRules from "./abc-rules.mjs";
import * as skills from "./skills.mjs";
import * as actions from "./actions.mjs";

const HIGHLIGHT = "fs-tour-target";
const WIDTH = 480;
const running = new Set();

const text = el => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
/** The Action or Reaction List's groups as the rendered sheet shows them: [{ key, name, rows: [{ label, detail, cost }] }]. */
export function readGroups(root, tab) {
  return [...(root?.querySelectorAll?.(`.fs-tab[data-tab="${tab}"] details[data-section]`) ?? [])].map(d => ({
    key: d.dataset.section, name: text(d.querySelector("summary")),
    rows: [...d.querySelectorAll("li.fs-action")].map(li => ({ label: text(li.querySelector(".fs-action-name")), detail: text(li.querySelector(".fs-action-detail")), cost: text(li.querySelector(".fs-action-cost")) }))
      .filter(r => r.label)
  }));
}

/** What the tour's words need to know about this character (`root`: the rendered sheet, for its Action and Reaction Lists). */
export function tourFacts(actor, root = actor.sheet?.element) {
  const sys = actor.system ?? {}, d = sys.derived ?? {};
  const stats = Object.fromEntries(Object.entries(sys.stats ?? {}).map(([k, v]) => [k, Number(v?.value ?? v) || 0]));
  const archetypes = activeArchetypes({ stats, trees: sys.trees ?? {} });
  const items = type => (actor.items?.contents ?? [...(actor.items ?? [])]).filter(i => i.type === type);
  let moveCost = "";
  try { moveCost = `${actions.moveParams(actor).cost} AP per move`; } catch { moveCost = "AP per move"; }
  return {
    name: actor.name ?? "",
    has: Object.fromEntries(["martial", "magic", "mental"].map(k => [k, archetypes.includes(k)])),
    weapons: items("weapon").filter(i => i.system?.weaponType !== "unarmed").map(i => ({ name: i.name, held: !!i.system?.held })),
    armor: items("armor").map(i => ({ name: i.name, worn: !!i.system?.equipped })),
    foci: items("foci").map(i => ({ name: i.name, attuned: !!i.system?.attuned, held: !!i.system?.equipped })),
    shrouds: items("shroud").map(i => ({ name: i.name, attuned: !!i.system?.attuned })),
    icons: items("icon").map(i => ({ name: i.name, attuned: !!i.system?.attuned })),
    affixes: items("affix").length,
    unspentSP: sys.skills?.unspent ?? 0, statPoints: sys.unspentStats ?? 0,
    energyMax: sys.energy?.max ?? 0, energyRecover: d.energyRecover ?? 0,
    hpMax: sys.hp?.max ?? 0, pain: sys.hp?.pain ?? 0, attackDie: d.attackDie ?? 0, dodgeDie: d.dodgeDie ?? 0,
    speed: sys.movement?.speed ?? 0, moveCost,
    ancestry: abcRules.ANCESTRIES[sys.abc?.ancestry]?.name ?? "", ancestryId: sys.abc?.ancestry ?? "",
    background: sys.abc?.background ? abcRules.packageFor(sys.abc.background, sys.abc.ancestry)?.name ?? "" : "", backgroundId: sys.abc?.background ?? "",
    trees: Object.entries(sys.trees ?? {}).filter(([, t]) => t > 0).map(([id, t]) => ({ id, name: skills.treeById(id)?.name ?? id, tier: t, free: (sys.freeTrees?.[id] ?? 0) >= t })),
    groups: readGroups(root, "actions"), reacts: readGroups(root, "reactions")
  };
}

/**
 * Where the popup goes (it's `height` tall): beside the sheet if there's room, else over it, below or above the outlined part (whichever it fits),
 * always inside the window.
 */
export function placeNear(sheetRect, targetRect, view, width = WIDTH, height = 360) {
  const fit = t => Math.round(Math.max(8, Math.min(view.height - height - 8, t)));
  const top = fit(sheetRect.top + 40);
  if (view.width - sheetRect.right >= width + 16) return { left: Math.round(sheetRect.right + 8), top };
  if (sheetRect.left >= width + 16) return { left: Math.round(sheetRect.left - width - 8), top };
  const left = Math.max(8, Math.round(Math.min(view.width - width - 8, sheetRect.left + (sheetRect.width - width) / 2)));
  if (!targetRect) return { left, top: fit(sheetRect.top + 80) };
  const below = targetRect.bottom + 12, above = targetRect.top - height - 12;
  const roomBelow = below + height <= view.height - 8, roomAbove = above >= 8;
  const upper = targetRect.top + targetRect.height / 2 < view.height / 2;
  if (upper ? roomBelow : !roomAbove && roomBelow) return { left, top: fit(below) };
  if (roomAbove) return { left, top: fit(above) };
  return { left, top: upper ? fit(view.height - height - 8) : 8 };
}

/** Put the sheet on a stop: its tab, its section open, the part outlined and scrolled into view. Returns the outlined element (or null). */
function showStop(sheet, stop) {
  if (stop.tab && sheet.tabGroups?.primary !== stop.tab) sheet.changeTab?.(stop.tab, "primary");
  const root = sheet.element;
  if (!root) return null;
  if (stop.open) { const det = root.querySelector(`details[data-section="${stop.open}"]`); if (det && !det.open) det.open = true; }
  const target = [stop.target ?? []].flat().map(q => root.querySelector(q)).find(Boolean) ?? null;
  if (target) { target.classList.add(HIGHLIGHT); target.scrollIntoView?.({ block: "nearest" }); }
  return target;
}

/** The popup's width: narrower (down to 340 px) when that lets it sit beside the sheet instead of over it (a laptop screen). */
export function tourWidth(sheetRect, viewWidth) {
  const room = Math.floor(Math.max(sheetRect.left, viewWidth - sheetRect.right)) - 16;
  return room >= 340 ? Math.min(WIDTH, room) : WIDTH;
}

/** The tour. One at a time per character; closing the sheet ends it. */
export async function startSheetTour(actor) {
  if (!actor || running.has(actor.id)) return null;
  running.add(actor.id);
  const sheet = actor.sheet;
  try {
    await sheet.render({ force: true });
    sheet.element?.classList.add("fs-touring");
    // A centred sheet on a laptop screen leaves no side wide enough for the popup: move it to the right edge when that makes room.
    const vw = globalThis.innerWidth ?? 1280, sr = sheet.element?.getBoundingClientRect?.();
    if (sr && tourWidth(sr, vw) === WIDTH && Math.max(sr.left, vw - sr.right) < WIDTH + 16 && vw - sr.width - 20 >= 340) sheet.setPosition?.({ left: Math.max(0, Math.round(vw - sr.width - 4)) });
    const stops = sheetStops(tourFacts(actor));
    let i = 0, step = 1;
    while (i >= 0 && i < stops.length) {
      if (!sheet.rendered) break;
      const stop = stops[i], last = i === stops.length - 1;
      const target = showStop(sheet, stop);
      if (!target && stop.optional) { i += step; continue; }         // a group this character doesn't have yet
      const view = { width: globalThis.innerWidth ?? 1280, height: globalThis.innerHeight ?? 800 };
      const width = sheet.element?.getBoundingClientRect ? tourWidth(sheet.element.getBoundingClientRect(), view.width) : WIDTH;
      const place = sheet.element?.getBoundingClientRect ? h => placeNear(sheet.element.getBoundingClientRect(), target?.getBoundingClientRect?.() ?? null, view, width, h) : null;
      const buttons = [
        i > 0 && { action: "back", label: "Back", icon: "fa-solid fa-arrow-left" },
        { action: "next", label: last ? "Finish" : "Next", icon: last ? "fa-solid fa-check" : "fa-solid fa-arrow-right", default: true },
        !last && { action: "end", label: "End tour", icon: "fa-solid fa-xmark" }
      ].filter(Boolean);
      const answer = await popup(sheet, { title: stop.title, width, place, buttons,
        html: `${stop.html}<p class="fs-tour-step">${i + 1} / ${stops.length}</p>` });
      target?.classList.remove(HIGHLIGHT);
      if (answer === "back") { i--; step = -1; }
      else if (answer === "next") { i++; step = 1; }
      else break;
    }
  } finally {
    running.delete(actor.id);
    sheet.element?.classList.remove("fs-touring");
    sheet.element?.querySelectorAll?.(`.${HIGHLIGHT}`).forEach(el => el.classList.remove(HIGHLIGHT));
  }
  return true;
}
