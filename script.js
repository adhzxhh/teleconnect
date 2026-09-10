let items = [];

const TELEGRAM_CHANNEL_URL = "https://t.me/+YepVltovdYJmMWQ1";
const REPO = "adhzxhh/teleconnect";
const grid = document.getElementById("contentGrid");
const empty = document.getElementById("emptyState");
const search = document.getElementById("searchInput");
const filter = document.getElementById("categoryFilter");
const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
let editingMessageId = "";

async function loadContent() {
  try {
    const response = await fetch(`content.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    items = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Could not load content.json:", error);
    items = [];
  }
  render();
}

function formatDate(value) {
  if (!value) return "";
  if (typeof value === "number") return new Date(value * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  return String(value);
}

function cleanName(item) {
  return String(item.filename || item.title || "").trim().replace(/\.[^.]+$/, " ").replace(/[._\-]+/g, " ").replace(/\s+/g, " ").trim();
}

function partInfo(item) {
  if (item.part_group && Number(item.part_number) >= 1) {
    return { key: String(item.part_group).trim().toLowerCase(), partNumber: Number(item.part_number), explicit: true };
  }

  const name = String(item.filename || item.title || "").trim().replace(/\.[^.]+$/g, "");
  let match = name.match(/(?:^|[ ._\-])(?:part|pt)[ ._\-]?(\d+)$/i);
  if (match) {
    const n = Number(match[1]);
    if (n >= 1) return { key: name.slice(0, match.index).replace(/[._\-]+$/, " ").trim().toLowerCase(), partNumber: n, explicit: true };
    return null;
  }

  match = name.match(/(?:^|[ ._\-])\((\d+)\)$/);
  if (match) {
    const n = Number(match[1]);
    if (n >= 1) {
      const base = name.slice(0, name.length - match[0].length).replace(/[._\-]+$/, " ").trim();
      return { key: base.toLowerCase(), partNumber: n, explicit: true };
    }
    return null;
  }

  // Numeric suffixes such as _1/_2 are only treated as parts when the base
  // really looks like a multipart filename. Do not mistake x64/x86 or similar
  // architecture/version suffixes for PART 64/PART 86.
  match = name.match(/(?:^|[._\-])0*(\d+)$/);
  if (match) {
    const n = Number(match[1]);
    const prefix = name.slice(0, name.length - match[0].length).trim();
    if (n >= 1 && !/x$/i.test(prefix)) {
      return { key: prefix.replace(/[._\-]+$/, " ").trim().toLowerCase(), partNumber: n, explicit: false };
    }
  }

  return null;
}

function groupItems(source) {
  const groups = [], explicitGroups = new Map(), unnamedGroups = new Map();
  source.forEach(item => {
    const info = partInfo(item);
    if (info) {
      const key = `${String(item.category || "other").toLowerCase()}::${info.key}`;
      if (!explicitGroups.has(key)) {
        const g = { parts: [], first: item, partKey: info.key };
        explicitGroups.set(key, g);
        groups.push(g);
      }
      explicitGroups.get(key).parts.push({ item, partNumber: info.partNumber });
      return;
    }
    const filename = String(item.filename || item.title || "").trim().toLowerCase();
    const category = String(item.category || "other").toLowerCase();
    const key = `${category}::${filename}`;
    if (!unnamedGroups.has(key)) unnamedGroups.set(key, []);
    unnamedGroups.get(key).push(item);
  });

  unnamedGroups.forEach(list => {
    if (list.length === 1) {
      groups.push({ single: list[0] });
      return;
    }
    const sorted = [...list].sort((a, b) => Number(a.message_id || 0) - Number(b.message_id || 0));
    const ids = sorted.map(x => Number(x.message_id)).filter(Number.isFinite);
    const consecutive = ids.length === sorted.length && (Math.max(...ids) - Math.min(...ids) <= sorted.length + 2);
    if (consecutive) groups.push({ parts: sorted.map((item, i) => ({ item, partNumber: i + 1 })), first: sorted[0], partKey: cleanName(sorted[0]).toLowerCase() });
    else list.forEach(item => groups.push({ single: item }));
  });

  groups.forEach(g => { if (g.parts) g.parts.sort((a, b) => a.partNumber - b.partNumber); });
  groups.sort((a, b) => Number(b.first?.date || b.single?.date || 0) - Number(a.first?.date || a.single?.date || 0));
  return groups;
}

function menu(item) {
  return `<div class="card-menu"><button class="menu-trigger" type="button" aria-label="More options" aria-expanded="false">⋮</button><div class="menu-panel"><button class="menu-edit" type="button" data-edit-id="${escapeAttr(item.message_id)}">✏️ Edit</button></div></div>`;
}

function render() {
  const q = search.value.toLowerCase().trim(), category = filter.value;
  const filtered = items.filter(item => {
    const c = String(item.category || "other").toLowerCase();
    return (category === "all" || c === category) && (`${item.title || ""} ${item.description || ""} ${item.part_group || ""}`).toLowerCase().includes(q);
  });
  const groups = groupItems(filtered);
  grid.innerHTML = groups.map(g => g.single ? renderSingle(g.single) : renderGroup(g)).join("");
  empty.hidden = groups.length !== 0;
}

function renderSingle(item) {
  const type = String(item.type || "FILE").toUpperCase(), icon = item.icon || (type === "FILE" ? "📦" : type === "IMAGE" ? "🖼️" : "🎬"), url = item.url || TELEGRAM_CHANNEL_URL, downloadUrl = item.download_url || "";
  const action = downloadUrl ? `<a class="btn primary" href="${escapeAttr(downloadUrl)}" download="${escapeAttr(item.filename || "")}">DOWNLOAD ↓</a>` : `<a class="btn primary" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">VIEW →</a>`;
  return `<article class="card"><div class="thumb">${menu(item)}<span class="badge">${escapeHtml(type)}</span><span>${escapeHtml(icon)}</span></div><div class="card-body"><h3>${escapeHtml(item.display_title || item.title || "Telegram file")}</h3><p>${escapeHtml(item.description || "")}</p><div class="card-footer"><span class="meta">${escapeHtml(formatDate(item.date))}</span>${action}</div></div></article>`;
}

function renderGroup(group) {
  const first = group.first, count = group.parts.length, title = first.display_title || group.partKey.replace(/\b\w/g, c => c.toUpperCase()), category = String(first.category || "other").toUpperCase();
  const buttons = group.parts.map(({ item, partNumber }) => {
    const url = item.download_url || item.url || TELEGRAM_CHANNEL_URL;
    const label = item.download_url ? `PART ${partNumber} ↓` : `PART ${partNumber} →`;
    const attrs = item.download_url ? `href="${escapeAttr(url)}" download="${escapeAttr(item.filename || "")}"` : `href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer"`;
    return `<a class="btn primary" ${attrs}>${label}</a>`;
  }).join("");
  return `<article class="card multipart-card"><div class="thumb">${menu(first)}<span class="badge">${escapeHtml(category)}</span><span>🧩</span></div><div class="card-body"><h3>${escapeHtml(title || "Multi-part file")}</h3><p>${count} parts · Select a part to download</p><div class="card-footer multipart-footer"><span class="meta">${escapeHtml(formatDate(first.date))}</span><div class="part-buttons">${buttons}</div></div></div></article>`;
}

function openEditor(messageId) {
  const item = items.find(x => String(x.message_id) === String(messageId));
  if (!item || !editModal) return;
  editingMessageId = String(item.message_id);
  const inferred = partInfo(item);
  document.getElementById("editTitle").value = item.display_title || item.title || "";
  document.getElementById("editDescription").value = item.description || "";
  document.getElementById("editCategory").value = String(item.category || "other").toLowerCase();
  document.getElementById("editPartGroup").value = item.part_group || (inferred?.key || "");
  document.getElementById("editPartNumber").value = Number(item.part_number) >= 1 ? item.part_number : (inferred?.partNumber >= 1 ? inferred.partNumber : "");
  document.getElementById("editFilename").textContent = item.filename || item.title || "Telegram file";
  editModal.hidden = false;
  document.body.classList.add("modal-open");
  setTimeout(() => document.getElementById("editTitle")?.focus(), 50);
}

function closeEditor() {
  if (!editModal) return;
  editModal.hidden = true;
  editingMessageId = "";
  document.body.classList.remove("modal-open");
}

editForm?.addEventListener("submit", event => {
  event.preventDefault();
  const item = items.find(x => String(x.message_id) === editingMessageId);
  if (!item) return;

  const title = document.getElementById("editTitle").value.trim();
  const description = document.getElementById("editDescription").value.trim();
  const category = document.getElementById("editCategory").value.trim().toLowerCase() || "other";
  const partGroup = document.getElementById("editPartGroup").value.trim();
  const partNumber = document.getElementById("editPartNumber").value.trim();

  if (partNumber && (!/^\d+$/.test(partNumber) || Number(partNumber) < 1)) {
    alert("Part number must be 1 or greater.");
    return;
  }

  const payload = {
    message_id: item.message_id,
    title,
    description,
    category,
    part_group: partGroup,
    part_number: partNumber
  };
  const body = `SITE_EDIT\n\nEdit requested from the website.\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
  const url = `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(`Edit site item ${item.message_id}`)}&body=${encodeURIComponent(body)}`;
  window.open(url, "_blank", "noopener,noreferrer");
  closeEditor();
});

document.addEventListener("click", event => {
  const trigger = event.target.closest(".menu-trigger");
  if (trigger) {
    const m = trigger.closest(".card-menu");
    document.querySelectorAll(".card-menu.open").forEach(x => { if (x !== m) x.classList.remove("open"); });
    m.classList.toggle("open");
    trigger.setAttribute("aria-expanded", m.classList.contains("open") ? "true" : "false");
    event.stopPropagation();
    return;
  }
  const edit = event.target.closest("[data-edit-id]");
  if (edit) {
    openEditor(edit.dataset.editId);
    edit.closest(".card-menu")?.classList.remove("open");
    return;
  }
  if (event.target.closest("[data-close-edit]")) {
    closeEditor();
    return;
  }
  if (editModal && !editModal.hidden && event.target === editModal) {
    closeEditor();
    return;
  }
  if (!event.target.closest(".card-menu")) document.querySelectorAll(".card-menu.open").forEach(m => m.classList.remove("open"));
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && editModal && !editModal.hidden) closeEditor();
});

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])); }
function escapeAttr(value) { return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }

search.addEventListener("input", render);
filter.addEventListener("change", render);
document.getElementById("telegramButton").href = TELEGRAM_CHANNEL_URL;
loadContent();
