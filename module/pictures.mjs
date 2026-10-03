/**
 * Pictures. Foundry's own file picker needs the "browse files" permission, which players usually lack. So a player changing the
 * picture of a sheet they own can browse through a connected GM (the GM's client lists the folders and images and sends them back),
 * or just paste an image link or path. The GM can turn the relay off with the "Players browse for pictures" setting.
 * (Uploading new files still needs Foundry's upload permission.)
 */
const IMAGE_EXT = ["png", "jpg", "jpeg", "webp", "gif", "svg", "avif", "bmp"];
const SOCKET = "system.flowstate";
const esc = s => (foundry.utils.escapeHTML ?? (x => x))(String(s ?? ""));
const DialogV2 = () => foundry.applications.api.DialogV2;
const FP = () => foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;

export const relayEnabled = () => { try { return game.settings.get("flowstate", "playerBrowse") !== false; } catch (err) { return true; } };
const cleanPath = p => String(p ?? "").replace(/\\/g, "/").split("/").filter(x => x && x !== "." && x !== "..").join("/");

/** GM side: list the images and folders at a path of the user data folder and send them back to the asking player. */
export async function answerBrowse({ user, reqId, target }) {
  if (!game.user.isGM || !relayEnabled()) { game.socket.emit(SOCKET, { action: "browseResult", to: user, reqId, error: "Browsing is turned off." }); return; }
  const path = cleanPath(target);
  try {
    const r = await FP().browse("data", path, { extensions: IMAGE_EXT.map(e => `.${e}`) });
    game.socket.emit(SOCKET, { action: "browseResult", to: user, reqId, result: { target: r.target ?? path, dirs: (r.dirs ?? []).map(d => d.replace(/\/+$/, "")), files: r.files ?? [] } });
  } catch (err) {
    game.socket.emit(SOCKET, { action: "browseResult", to: user, reqId, error: "That folder can't be opened." });
  }
}

const waiting = new Map();
/** Player side: hear the GM's answers. */
export function listenForBrowse() {
  game.socket.on(SOCKET, data => {
    if (data?.action !== "browseResult" || data.to !== game.user.id) return;
    const w = waiting.get(data.reqId);
    if (!w) return;
    waiting.delete(data.reqId);
    clearTimeout(w.timer);
    w.resolve(data.error ? { error: data.error } : data.result);
  });
}

/** Ask a connected GM for a folder listing. Resolves to { target, dirs, files } or { error }. */
function browseViaGM(target) {
  if (game.user.isGM || game.user.can?.("FILES_BROWSE")) return FP().browse("data", cleanPath(target), { extensions: IMAGE_EXT.map(e => `.${e}`) })
    .then(r => ({ target: r.target ?? target, dirs: (r.dirs ?? []).map(d => d.replace(/\/+$/, "")), files: r.files ?? [] }), () => ({ error: "That folder can't be opened." }));
  if (!game.users.activeGM) return Promise.resolve({ error: "A GM has to be connected to browse files." });
  return new Promise(resolve => {
    const reqId = foundry.utils.randomID?.() ?? String(Math.random());
    const timer = setTimeout(() => { waiting.delete(reqId); resolve({ error: "The GM didn't answer." }); }, 8000);
    waiting.set(reqId, { resolve, timer });
    game.socket.emit(SOCKET, { action: "browseFiles", user: game.user.id, reqId, target });
  });
}

/** A simple folder and thumbnail browser. Resolves to the chosen image path, or null. */
async function browseDialog(start = "") {
  let path = cleanPath(start.includes("/") ? start.slice(0, start.lastIndexOf("/")) : "");
  for (;;) {
    const r = await browseViaGM(path);
    const up = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    const tile = (kind, p, label, inner) => `<a data-kind="${kind}" data-path="${esc(p)}" title="${esc(label)}" style="display:flex;flex-direction:column;align-items:center;width:84px;cursor:pointer;text-align:center;word-break:break-all;font-size:.8em">${inner}<span>${esc(label)}</span></a>`;
    const body = r.error ? `<p class="hint">${esc(r.error)}</p>` : `
      <div style="display:flex;flex-wrap:wrap;gap:8px;max-height:380px;overflow:auto">
        ${path ? tile("dir", up, "Up", `<i class="fa-solid fa-turn-up" style="font-size:40px;line-height:64px"></i>`) : ""}
        ${r.dirs.map(d => tile("dir", d, d.split("/").pop(), `<i class="fa-solid fa-folder" style="font-size:40px;line-height:64px"></i>`)).join("")}
        ${r.files.map(f => tile("file", f, decodeURIComponent(f.split("/").pop()), `<img src="${esc(f)}" loading="lazy" style="width:64px;height:64px;object-fit:cover;border:1px solid #888">`)).join("")}
      </div>
      ${!r.dirs.length && !r.files.length ? `<p class="hint">No images or folders here.</p>` : ""}`;
    let picked = null;
    await DialogV2().wait({
      window: { title: `Browse: /${path}` },
      position: { width: 520 },
      content: `<div class="flowstate-dialog">${body}</div>`,
      buttons: [{ action: "cancel", label: "Cancel", default: true }],
      render: (ev, dialog) => dialog.element.addEventListener("click", e => {
        const el = e.target.closest("[data-kind]");
        if (!el) return;
        picked = { kind: el.dataset.kind, path: el.dataset.path };
        dialog.close();
      }),
      rejectClose: false
    });
    if (!picked) return null;
    if (picked.kind === "file") return picked.path;
    path = cleanPath(picked.path);
  }
}

/** Ask for a picture: paste a link or path, or browse (directly where permitted, through a GM otherwise). Resolves to the path, or null. */
export async function askImage(title, current = "") {
  const direct = game.user.can?.("FILES_BROWSE") && FP();
  const viaGM = !direct && relayEnabled() && !!game.users?.activeGM;
  const url = await DialogV2().prompt({
    window: { title },
    content: `<div class="fs-field"><label>Image URL or path</label><div style="display:flex;gap:4px">
      <input type="text" name="img" value="${esc(current)}" placeholder="https://… or worlds/…/picture.png" style="flex:1" autofocus>
      ${direct || viaGM ? `<button type="button" data-browse><i class="fa-solid fa-folder-open"></i> Browse</button>` : ""}</div>
      <p class="hint">Paste a link to an image, or browse the images already on the server${viaGM ? " (through the GM)" : ""}.</p></div>`,
    render: (ev, dialog) => dialog.element.querySelector("[data-browse]")?.addEventListener("click", async () => {
      const input = dialog.element.querySelector("input[name=img]");
      if (direct) return new (FP())({ type: "image", current, callback: path => { input.value = path; } }).browse();
      const path = await browseDialog(input.value || current);
      if (path) input.value = path;
    }),
    ok: { label: "Set picture", callback: (ev, button) => button.form.elements.img.value.trim() },
    rejectClose: false
  });
  return url || null;
}
