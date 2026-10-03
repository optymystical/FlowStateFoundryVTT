/**
 * Pictures. Foundry's own file picker needs the "browse files" permission, which players usually lack. So a player changing the
 * picture of a sheet they own can browse through a connected GM (the GM's client lists the folders and images and sends them back),
 * or just paste an image link or path. Players without Foundry's upload permission can also upload a picture from their computer:
 * the file is sent to a connected GM in chunks and the GM's client saves it under flowstate-art/<player>/. The GM can turn the
 * browse and upload relays off with the "Players browse for pictures" / "Players upload pictures" settings.
 */
const IMAGE_EXT = ["png", "jpg", "jpeg", "webp", "gif", "svg", "avif", "bmp"];
const SOCKET = "system.flowstate";
const esc = s => (foundry.utils.escapeHTML ?? (x => x))(String(s ?? ""));
const DialogV2 = () => foundry.applications.api.DialogV2;
const FP = () => foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;

export const relayEnabled = () => { try { return game.settings.get("flowstate", "playerBrowse") !== false; } catch (err) { return true; } };
export const uploadRelayEnabled = () => { try { return game.settings.get("flowstate", "playerUpload") !== false; } catch (err) { return true; } };
export const MAX_UPLOAD = 10 * 1024 * 1024;
const CHUNK = 240 * 1024;
const ART_DIR = "flowstate-art";
/** A folder or file name with only letters, digits, dashes, dots and underscores. */
export const safeName = s => String(s ?? "").normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 60) || "player";
export const imageExt = name => { const m = /\.([A-Za-z0-9]+)$/.exec(String(name ?? "")); return m && IMAGE_EXT.includes(m[1].toLowerCase()) ? m[1].toLowerCase() : null; };
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

const uploads = new Map();
const reply = (user, uploadId, extra) => game.socket.emit(SOCKET, { action: "uploadResult", to: user, uploadId, ...extra });
const b64ToBytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

/** GM side: collect a player's file in chunks, then save it under flowstate-art/<player>/ and send back the path. */
export async function receiveUpload({ user, userName, uploadId, name, index, total, size, data }) {
  if (!game.user.isGM) return;
  if (!uploadRelayEnabled()) return reply(user, uploadId, { error: "Uploading is turned off." });
  const ext = imageExt(name);
  if (!ext) return reply(user, uploadId, { error: "That isn't an image file." });
  if (!(size > 0) || size > MAX_UPLOAD || !(total > 0) || total > Math.ceil(MAX_UPLOAD / CHUNK) + 1) return reply(user, uploadId, { error: `Pictures can be at most ${Math.round(MAX_UPLOAD / 1048576)} MB.` });
  const up = uploads.get(uploadId) ?? { chunks: [], got: 0, bytes: 0 };
  uploads.set(uploadId, up);
  if (up.chunks[index] === undefined) { up.chunks[index] = data; up.got++; up.bytes += data.length * 0.75; }
  if (up.bytes > MAX_UPLOAD * 1.4) { uploads.delete(uploadId); return reply(user, uploadId, { error: "That file is too large." }); }
  if (up.got < total) return;
  uploads.delete(uploadId);
  try {
    const parts = up.chunks.map(b64ToBytes);
    const file = new File(parts, `${Date.now()}-${safeName(name.replace(/\.[^.]*$/, ""))}.${ext}`, { type: ext === "svg" ? "image/svg+xml" : `image/${ext === "jpg" ? "jpeg" : ext}` });
    const dir = `${ART_DIR}/${safeName(userName)}`;
    for (const d of [ART_DIR, dir]) { try { await FP().createDirectory("data", d, {}); } catch (err) { /* already there */ } }
    const r = await FP().upload("data", dir, file, {}, { notify: false });
    if (!r?.path) throw new Error("no path");
    reply(user, uploadId, { path: r.path });
  } catch (err) {
    reply(user, uploadId, { error: "The GM couldn't save that file." });
  }
}

const waiting = new Map();
/** Player side: hear the GM's answers. */
export function listenForBrowse() {
  game.socket.on(SOCKET, data => {
    if (data?.to !== game.user.id) return;
    if (data.action === "uploadResult") {
      const u = waiting.get(data.uploadId);
      if (!u) return;
      waiting.delete(data.uploadId);
      clearTimeout(u.timer);
      return u.resolve(data.error ? { error: data.error } : { path: data.path });
    }
    if (data.action !== "browseResult") return;
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

const toBase64 = bytes => { let s = ""; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(s); };

/** Upload a picture file. Players without upload permission send it to a connected GM. Resolves to { path } or { error }. */
export async function uploadPicture(file) {
  if (!imageExt(file?.name) || !(file.type || "image/").startsWith("image/")) return { error: "That isn't an image file." };
  if (file.size > MAX_UPLOAD) return { error: `Pictures can be at most ${Math.round(MAX_UPLOAD / 1048576)} MB.` };
  if (game.user.isGM || game.user.can?.("FILES_UPLOAD")) {
    const dir = `${ART_DIR}/${safeName(game.user.name)}`;
    for (const d of [ART_DIR, dir]) { try { await FP().createDirectory("data", d, {}); } catch (err) { /* already there */ } }
    try { const r = await FP().upload("data", dir, file, {}, { notify: false }); return r?.path ? { path: r.path } : { error: "The upload failed." }; } catch (err) { return { error: "The upload failed." }; }
  }
  if (!uploadRelayEnabled()) return { error: "Uploading is turned off." };
  if (!game.users.activeGM) return { error: "A GM has to be connected to upload." };
  const uploadId = foundry.utils.randomID?.() ?? String(Math.random());
  const total = Math.max(1, Math.ceil(file.size / CHUNK));
  const done = new Promise(resolve => {
    const timer = setTimeout(() => { waiting.delete(uploadId); resolve({ error: "The GM didn't answer." }); }, 30000 + total * 1000);
    waiting.set(uploadId, { resolve, timer });
  });
  for (let index = 0; index < total; index++) {
    const bytes = new Uint8Array(await file.slice(index * CHUNK, (index + 1) * CHUNK).arrayBuffer());
    game.socket.emit(SOCKET, { action: "uploadChunk", user: game.user.id, userName: game.user.name, uploadId, name: file.name, index, total, size: file.size, data: toBase64(bytes) });
  }
  return done;
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
  const canUpload = !!(game.user.isGM || game.user.can?.("FILES_UPLOAD") || (uploadRelayEnabled() && game.users?.activeGM));
  const url = await DialogV2().prompt({
    window: { title },
    content: `<div class="fs-field"><label>Image URL or path</label><div style="display:flex;gap:4px">
      <input type="text" name="img" value="${esc(current)}" placeholder="https://… or worlds/…/picture.png" style="flex:1" autofocus>
      ${direct || viaGM ? `<button type="button" data-browse><i class="fa-solid fa-folder-open"></i> Browse</button>` : ""}
      ${canUpload ? `<button type="button" data-upload><i class="fa-solid fa-upload"></i> Upload</button><input type="file" accept="image/*" data-file hidden>` : ""}</div>
      <p class="hint">Paste a link to an image, browse the images already on the server${viaGM ? " (through the GM)" : ""}${canUpload ? ", or upload one from your computer" : ""}.</p></div>`,
    render: (ev, dialog) => {
      const input = dialog.element.querySelector("input[name=img]");
      dialog.element.querySelector("[data-browse]")?.addEventListener("click", async () => {
        if (direct) return new (FP())({ type: "image", current, callback: path => { input.value = path; } }).browse();
        const path = await browseDialog(input.value || current);
        if (path) input.value = path;
      });
      const picker = dialog.element.querySelector("[data-file]");
      dialog.element.querySelector("[data-upload]")?.addEventListener("click", () => picker.click());
      picker?.addEventListener("change", async () => {
        const file = picker.files?.[0];
        if (!file) return;
        ui.notifications.info(`Uploading ${file.name}…`);
        const r = await uploadPicture(file);
        if (r.error) return ui.notifications.warn(r.error);
        input.value = r.path;
        ui.notifications.info("Uploaded. Press Set picture to use it.");
      });
    },
    ok: { label: "Set picture", callback: (ev, button) => button.form.elements.img.value.trim() },
    rejectClose: false
  });
  return url || null;
}
