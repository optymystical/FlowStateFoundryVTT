/**
 * Ask for a picture. Foundry's own picker needs the file-browser permission, which players usually lack, so this asks for an
 * image URL or path (Browse is offered where the user may use the file browser). Resolves to the entered path, or null.
 */
export async function askImage(title, current = "") {
  const canBrowse = game.user.can?.("FILES_BROWSE");
  const FP = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
  const esc = foundry.utils.escapeHTML ?? (s => s);
  const url = await foundry.applications.api.DialogV2.prompt({
    window: { title },
    content: `<div class="fs-field"><label>Image URL or path</label><div style="display:flex;gap:4px">
      <input type="text" name="img" value="${esc(current)}" placeholder="https://… or worlds/…/picture.png" style="flex:1" autofocus>
      ${canBrowse && FP ? `<button type="button" data-browse><i class="fa-solid fa-folder-open"></i> Browse</button>` : ""}</div>
      <p class="hint">Paste a link to an image, or the path of one already uploaded.</p></div>`,
    render: (ev, dialog) => dialog.element.querySelector("[data-browse]")?.addEventListener("click", () => {
      new FP({ type: "image", current, callback: path => { dialog.element.querySelector("input[name=img]").value = path; } }).browse();
    }),
    ok: { label: "Set picture", callback: (ev, button) => button.form.elements.img.value.trim() },
    rejectClose: false
  });
  return url || null;
}
