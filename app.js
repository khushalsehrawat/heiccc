/*
  Local image converter (no uploads):
  - HEIC/HEIF → JPEG via native decode when possible, else heic2any
  - Other image types → JPEG via Canvas
  - Bulk download as ZIP + per-image download
*/

const fileInput = document.getElementById("fileInput");
const btnUpload = document.getElementById("btnUpload");
const folderInput = document.getElementById("folderInput");
const btnUploadFolder = document.getElementById("btnUploadFolder");
const dropZone = document.getElementById("dropZone");
const btnConvert = document.getElementById("btnConvert");

const folderInfo = document.getElementById("folderInfo");
const imageList = document.getElementById("imageList");
const imageItems = document.getElementById("imageItems");

const outputNameInput = document.getElementById("outputName");
const outputExtSelect = document.getElementById("outputExt");
const qualityInput = document.getElementById("quality");
const qLabel = document.getElementById("qLabel");

const selectAllBtn = document.getElementById("selectAll");
const clearAllBtn = document.getElementById("clearAll");

const progressWrap = document.getElementById("progressWrap");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");

let images = [];
let sourceRootFolder = "";

function syncQualityLabel() {
  qLabel.textContent = qualityInput.value;
}
qualityInput.oninput = syncQualityLabel;
syncQualityLabel();

btnUpload?.addEventListener("click", () => fileInput?.click());
btnUploadFolder?.addEventListener("click", () => folderInput?.click());

dropZone?.addEventListener("click", () => fileInput?.click());
dropZone?.addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === " ") fileInput?.click();
});

["dragenter", "dragover", "dragleave", "drop"].forEach(evt => {
  dropZone?.addEventListener(evt, e => {
    e.preventDefault();
    e.stopPropagation();
  });
});

["dragenter", "dragover"].forEach(evt => {
  dropZone?.addEventListener(evt, () => dropZone.classList.add("dragover"));
});

["dragleave", "drop"].forEach(evt => {
  dropZone?.addEventListener(evt, () => dropZone.classList.remove("dragover"));
});

if (fileInput) fileInput.onchange = () => loadPickedFiles([...fileInput.files]);
if (folderInput) folderInput.onchange = () => loadPickedFiles([...folderInput.files]);

dropZone?.addEventListener("drop", async e => {
  try {
    const filesWithPaths = await getFilesFromDataTransfer(e.dataTransfer);
    loadPickedFiles(filesWithPaths);
  } catch (err) {
    folderInfo.classList.remove("d-none");
    folderInfo.innerHTML = `Drop failed: ${escapeHtml(normalizeErrorMessage(err))}`;
  }
});

function loadPickedFiles(filesOrFilesWithPaths) {
  const all = filesOrFilesWithPaths.map(f => {
    if (f && typeof f === "object" && "file" in f) return f;
    return { file: f, relativePath: f?.webkitRelativePath || "" };
  });

  const picked = all.filter(({ file }) => isImageLikeFile(file));

  sourceRootFolder = detectCommonRootFolder(picked);

  images = picked.map(({ file, relativePath }) => ({
    file,
    relativePath: relativePath || "",
    selected: true,
    status: "pending", // pending | converting | converted | error
    outputs: [],
    error: null
  }));

  if (!images.length) {
    folderInfo.classList.remove("d-none");
    folderInfo.innerHTML = `<strong>0</strong> images loaded`;
    imageItems.innerHTML = "";
    imageList.classList.add("d-none");
    btnConvert.disabled = true;
    return;
  }

  if (!outputNameInput.value.trim()) {
    const suggestion = suggestOutputFolderName(picked, sourceRootFolder);
    outputNameInput.value = suggestion + "_JPG";
  }

  folderInfo.classList.remove("d-none");
  const skipped = all.length - picked.length;
  folderInfo.innerHTML =
    `<strong>${images.length}</strong> images loaded` +
    (skipped ? ` <span class="text-muted">(skipped ${skipped} non-images)</span>` : "");

  renderImageList();
  btnConvert.disabled = false;
}

function renderImageList() {
  imageItems.innerHTML = "";
  imageList.classList.remove("d-none");

  images.forEach((img, index) => {
    const row = document.createElement("div");
    row.className = "list-group-item image-row";
    row.dataset.row = String(index);

    const { badgeClass, badgeText } = getStatusBadge(img);
    const displayName = escapeHtml(stripSourceRoot(img.relativePath) || img.file.name);

    row.innerHTML = `
      <div class="image-row-left">
        <input type="checkbox" ${img.selected ? "checked" : ""} data-index="${index}">
        <span class="ms-2">${displayName}</span>
        <small class="ms-2">(${formatBytes(img.file.size)})</small>
        <span class="badge ${badgeClass} ms-2" data-status>${badgeText}</span>
      </div>
      <button class="btn btn-sm btn-outline-primary" data-download="${index}" ${img.outputs?.length ? "" : "disabled"}>
        ${downloadButtonLabel(img)}
      </button>
    `;
    imageItems.appendChild(row);
  });
}

function updateImageRow(index) {
  const row = imageItems.querySelector(`[data-row="${index}"]`);
  if (!row) return;

  const img = images[index];
  const statusEl = row.querySelector("[data-status]");
  const downloadBtn = row.querySelector("[data-download]");

  if (statusEl) {
    const { badgeClass, badgeText } = getStatusBadge(img);
    statusEl.className = `badge ${badgeClass} ms-2`;
    statusEl.textContent = badgeText;
    if (img.status === "error" && img.error) statusEl.title = img.error;
    else statusEl.title = "";
  }

  if (downloadBtn) {
    downloadBtn.disabled = !img.outputs?.length;
    downloadBtn.textContent = downloadButtonLabel(img);
  }
}

imageItems.addEventListener("change", e => {
  if (e.target.type === "checkbox") {
    images[e.target.dataset.index].selected = e.target.checked;
  }
});

imageItems.addEventListener("click", async e => {
  const btn = e.target.closest("[data-download]");
  if (!btn) return;

  const index = Number(btn.dataset.download);
  const img = images[index];
  if (!img?.outputs?.length) return;

  await downloadOutputs(img);
});

selectAllBtn.onclick = () => {
  images.forEach(i => (i.selected = true));
  renderImageList();
};

clearAllBtn.onclick = () => {
  images.forEach(i => (i.selected = false));
  renderImageList();
};

btnConvert.onclick = async () => {
  const selectedIndexes = images
    .map((img, index) => (img.selected ? index : -1))
    .filter(index => index !== -1);

  if (!selectedIndexes.length) return;

  btnConvert.disabled = true;
  progressWrap.classList.remove("d-none");

  const zip = new JSZip();
  const outputFolderName = (outputNameInput.value || "").trim() || "Converted";
  const folder = zip.folder(outputFolderName);
  const quality = Number(qualityInput.value) / 100;
  const outputExt = outputExtSelect.value || "jpg";

  let processed = 0;
  let outputsAdded = 0;
  const usedZipPaths = new Set();

  for (const index of selectedIndexes) {
    processed += 1;
    progressText.textContent = `Converting ${processed} of ${selectedIndexes.length}`;
    progressBar.style.width = `${(processed / selectedIndexes.length) * 100}%`;

    const img = images[index];
    img.status = "converting";
    img.outputs = [];
    img.error = null;
    updateImageRow(index);

    try {
      const outputs = await convertToJpegOutputs(img.file, { quality, outputExt });
      for (const out of outputs) {
        const rel = stripSourceRoot(img.relativePath);
        const destPath = rel ? parentDir(rel) : "";
        const destFolder = destPath ? folder.folder(destPath) : folder;
        const uniqueName = uniqueFileName(out.fileName, usedZipPaths, destPath);
        destFolder.file(uniqueName, out.blob);
        outputsAdded += 1;
      }
      img.outputs = outputs;
      img.status = "converted";
    } catch (err) {
      img.status = "error";
      img.error = normalizeErrorMessage(err);
    } finally {
      updateImageRow(index);
    }
  }

  if (outputsAdded) {
    const zipBlob = await zip.generateAsync({ type: "blob" });
    saveAs(zipBlob, `${outputFolderName}.zip`);
  }

  const failures = selectedIndexes.filter(i => images[i].status === "error").length;
  progressText.textContent =
    failures
      ? `Done. Converted ${selectedIndexes.length - failures}/${selectedIndexes.length} (failed ${failures}).`
      : `Done. Converted ${selectedIndexes.length}/${selectedIndexes.length}.`;

  btnConvert.disabled = false;
};

function isImageLikeFile(file) {
  if (file?.type?.startsWith("image/")) return true;
  const n = (file?.name || "").toLowerCase();
  return n.endsWith(".heic") || n.endsWith(".heif");
}

function isHeicFile(file) {
  if (!file) return false;
  const type = (file.type || "").toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  const n = (file.name || "").toLowerCase();
  return n.endsWith(".heic") || n.endsWith(".heif");
}

function isAlreadyJpeg(file) {
  const type = (file?.type || "").toLowerCase();
  if (type === "image/jpeg") return true;
  const n = (file?.name || "").toLowerCase();
  return n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".jfif");
}

function suggestOutputFolderName(filesWithPaths, rootFolder) {
  if (rootFolder) return rootFolder;
  const first = filesWithPaths.find(f => f.file)?.file;
  const firstRel = filesWithPaths.find(f => f.relativePath)?.relativePath || first?.webkitRelativePath || "";
  const fromRel = String(firstRel).split("/")[0];
  return fromRel || "Images";
}

function baseName(fileName) {
  return String(fileName || "image").replace(/\.[^/.]+$/, "");
}

function parentDir(path) {
  const p = String(path || "").replace(/\\/g, "/");
  const parts = p.split("/").filter(Boolean);
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}

function outputNameFor(fileName, outputExt, index, total) {
  const base = baseName(fileName);
  if (!total || total <= 1) return `${base}.${outputExt}`;
  return `${base}-${index + 1}.${outputExt}`;
}

async function convertToJpegOutputs(file, { quality, outputExt }) {
  if (!file) throw new Error("Missing file");

  const ext = outputExt === "jpeg" ? "jpeg" : "jpg";

  if (isAlreadyJpeg(file) && quality === 1) {
    return [{ fileName: outputNameFor(file.name, ext, 0, 1), blob: file }];
  }

  if (isHeicFile(file)) {
    try {
      const nativeBlob = await convertViaCanvas(file, quality);
      return [{ fileName: outputNameFor(file.name, ext, 0, 1), blob: nativeBlob }];
    } catch {
      // Fall back to heic2any below
    }

    const result = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality
    });

    const blobs = Array.isArray(result) ? result : [result];
    if (!blobs.length) throw new Error("HEIC conversion returned no images");

    return blobs.map((blob, i) => ({
      fileName: outputNameFor(file.name, ext, i, blobs.length),
      blob
    }));
  }

  const blob = await convertViaCanvas(file, quality);
  return [{ fileName: outputNameFor(file.name, ext, 0, 1), blob }];
}

async function downloadOutputs(img) {
  const outputs = img.outputs || [];
  if (!outputs.length) return;

  if (outputs.length === 1) {
    saveAs(outputs[0].blob, outputs[0].fileName);
    return;
  }

  const zip = new JSZip();
  const folder = zip.folder(baseName(img.file.name));
  for (const out of outputs) folder.file(out.fileName, out.blob);
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${baseName(img.file.name)}.zip`);
}

function uniqueFileName(fileName, usedPaths, destPath) {
  const name = String(fileName || "image.jpg");
  const prefix = destPath ? `${destPath}/` : "";
  const full = `${prefix}${name}`;
  if (!usedPaths.has(full)) {
    usedPaths.add(full);
    return name;
  }

  const extMatch = name.match(/(\.[^/.]+)$/);
  const ext = extMatch ? extMatch[1] : "";
  const stem = ext ? name.slice(0, -ext.length) : name;
  let i = 2;
  while (true) {
    const candidate = `${stem}-${i}${ext}`;
    const fullCandidate = `${prefix}${candidate}`;
    if (!usedPaths.has(fullCandidate)) {
      usedPaths.add(fullCandidate);
      return candidate;
    }
    i += 1;
  }
}

function downloadButtonLabel(img) {
  const count = img.outputs?.length || 0;
  if (count <= 1) return "Download";
  return `Download (${count})`;
}

function getStatusBadge(img) {
  switch (img.status) {
    case "converting":
      return { badgeClass: "text-bg-warning", badgeText: "Converting" };
    case "converted":
      return { badgeClass: "text-bg-success", badgeText: "Converted" };
    case "error":
      return { badgeClass: "text-bg-danger", badgeText: "Failed" };
    default:
      return { badgeClass: "text-bg-secondary", badgeText: "Pending" };
  }
}

function normalizeErrorMessage(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error && err.message) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });
}

function formatBytes(bytes) {
  const b = Number(bytes);
  if (!Number.isFinite(b) || b <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), units.length - 1);
  const value = b / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function convertViaCanvas(file, quality) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas not supported");

  const decoded = await decodeImage(file);
  const width = decoded.width;
  const height = decoded.height;

  canvas.width = width;
  canvas.height = height;

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(decoded, 0, 0);

  if (decoded && typeof decoded.close === "function") decoded.close();

  const blob = await canvasToBlob(canvas, "image/jpeg", quality);
  if (!blob) throw new Error("Failed to encode JPEG");
  return blob;
}

async function decodeImage(file) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await loadImageElement(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), type, quality);
  });
}

function detectCommonRootFolder(filesWithPaths) {
  const roots = new Set();
  for (const fp of filesWithPaths) {
    const rp = String(fp.relativePath || "");
    if (!rp.includes("/")) return "";
    const root = rp.split("/")[0];
    if (!root) return "";
    roots.add(root);
    if (roots.size > 1) return "";
  }
  return roots.values().next().value || "";
}

function stripSourceRoot(relativePath) {
  const rp = String(relativePath || "").replace(/\\/g, "/");
  if (!sourceRootFolder) return rp;
  const prefix = `${sourceRootFolder}/`;
  if (rp.startsWith(prefix)) return rp.slice(prefix.length);
  return rp;
}

async function getFilesFromDataTransfer(dataTransfer) {
  if (!dataTransfer) return [];

  const items = [...(dataTransfer.items || [])];
  const hasEntries = items.some(it => typeof it.webkitGetAsEntry === "function");

  if (!items.length || !hasEntries) {
    return [...(dataTransfer.files || [])].map(file => ({
      file,
      relativePath: file?.webkitRelativePath || ""
    }));
  }

  const results = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry?.();
    if (!entry) continue;
    const collected = await collectFilesFromEntry(entry, "");
    results.push(...collected);
  }
  return results;
}

async function collectFilesFromEntry(entry, basePath) {
  if (entry.isFile) {
    const file = await new Promise((resolve, reject) => {
      entry.file(resolve, reject);
    });
    return [{ file, relativePath: `${basePath}${file.name}` }];
  }

  if (!entry.isDirectory) return [];

  const dirPath = `${basePath}${entry.name}/`;
  const reader = entry.createReader();
  const entries = [];

  while (true) {
    const batch = await new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (!batch.length) break;
    entries.push(...batch);
  }

  const nested = await Promise.all(entries.map(e => collectFilesFromEntry(e, dirPath)));
  return nested.flat();
}
