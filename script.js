let items = [];

const TELEGRAM_CHANNEL_URL = "https://t.me/+YepVltovdYJmMWQ1";
const REPO = "adhzxhh/teleconnect";
const grid = document.getElementById("contentGrid");
const empty = document.getElementById("emptyState");
const search = document.getElementById("searchInput");
const filter = document.getElementById("categoryFilter");

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
  if (typeof value === "number") {
    return new Date(value * 1000).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric"
    });
  }
  return String(value);
}

function cleanName(item) {
  return String(item.filename || item.title || "")
    .trim().replace(/\.[^.]+$/, "")
    .replace(/[._\-]+/g, " ").replace(/\s+/g, " ").trim();
}

function partInfo(item) {
  if (item.part_group && item.part_number) {
    return { key: String(item.part_group).trim().toLowerCase(), partNumber: Number(item.part_number), explicit: true };
  }

  const original = String(item.filename || item.title || "").trim();
  const name = original.replace(/\.[^.]+$/, "");
  let match = name.match(/(?:^|[ ._\-])(?:part|pt)[ ._\-]?(\d+)$/i);
  if (match) {
    return {
      key: name.slice(0, match.index).replace(/[._\-]+$/, "").trim().toLowerCase(),
      partNumber: Number(match[1]), explicit: true
    };
  }

  match = name.match(/(?:^|[ ._\-])\((\d+)\)$/);
  if (!match) match = name.match(/(?:^|[._\-])0*(\d+)$/);
  if (match) {
    const partNumber = Number(match[1]);
    const base = name.slice(0, name.length - match[0].length).replace(/[._\-]+$/, "").trim();
    if (partNumber >= 1) return { key: base.toLowerCase(), partNumber, explicit: true };
  }
  return null;
}

function groupItems(source) {
  const groups = [];
  const explicitGroups = new Map();
  const unnamedGroups = new Map();

  source.forEach(item => {
    const info = partInfo(item);
    if (info) {
      const groupKey = `${String(item.category || "other").toLowerCase()}::${info.key}`;
      if (!explicitGroups.has(groupKey)) {
        const group = { parts: [], first: item, partKey: info.key };
        explicitGroups.set(groupKey, group);
        groups.push(group);
      }
      explicitGroups.get(groupKey).parts.push({ item, partNumber: info.partNumber });
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
    if (consecutive) {
      groups.push({
        parts: sorted.map((item, index) => ({ item, partNumber: index + 1 })),
        first: sorted[0],
        partKey: cleanName(sorted[0]).toLowerCase()
      });
    } else {
      list.forEach(item => groups.push({ single: item }));
    }
  });

  groups.forEach(group => { if (group.parts) group.parts.sort((a, b) => a.partNumber - b.partNumber); });
  groups.sort((a, b) => Number(b.first?.date || 0) - Number(a.first?.date || 0));
  return groups;
}

function render() {
  const q = search.value.toLowerCase().trim();
  const category = filter.value;
  const filtered = items.filter(item => {
    const itemCategory = String(item.category || "other").toLowerCase();
    return (category === "all" || itemCategory === category) &&
      (`${item.title || ""} ${item.description || ""} ${item.part_group || ""}`.toLowerCase().includes(q));
  });

  const groups = groupItems(filtered);
  grid.innerHTML = groups.map(group => group.single ? renderSingle(group.single) : renderGroup(group)).join("");
  empty.hidden = groups.length !== 0;
}

function renderEditButton(item) {
  return `<button class="edit-btn" type="button" data-edit-id="${escapeAttr(item.message_id)}">EDIT</button>`;
}

function renderSingle(item) {
  const type = String(item.type || "FILE").toUpperCase();
  const icon = item.icon || (type === "FILE" ? "📦" : type === "IMAGE" ? "🖼️" : "🎬");
  const url = item.url || TELEGRAM_CHANNEL_URL;
  const downloadUrl = item.download_url || "";
  const action = downloadUrl
    ? `<a class="btn primary" href="${escapeAttr(downloadUrl)}" download="${escapeAttr(item.filename || "")}">DOWNLOAD ↓</a>`
    : `<a class="btn primary" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">VIEW →</a>`;

  return `<article class="card">
    <div class="thumb"><span class="badge">${escapeHtml(type)}</span><span>${escapeHtml(icon)}</span></div>
    <div class="card-body"><h3>${escapeHtml(item.display_title || item.title || "Telegram file")}</h3>
    <p>${escapeHtml(item.description || "")}</p><div class="card-footer"><span class="meta">${escapeHtml(formatDate(item.date))}</span>
    <div class="card-actions">${renderEditButton(item)}${action}</div></div></div></article>`;
}

function renderGroup(group) {
  const first = group.first;
  const count = group.parts.length;
  const title = first.display_title || group.partKey.replace(/\b\w/g, c => c.toUpperCase());
  const category = String(first.category || "other").toUpperCase();
  const buttons = group.parts.map(({ item, partNumber }) => {
    const url = item.download_url || item.url || TELEGRAM_CHANNEL_URL;
    const label = item.download_url ? `PART ${partNumber} ↓` : `PART ${partNumber} →`;
    const attrs = item.download_url
      ? `href="${escapeAttr(url)}" download="${escapeAttr(item.filename || "")}"`
      : `href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer"`;
    return `<a class="btn primary" ${attrs}>${label}</a>`;
  }).join("");

  return `<article class="card multipart-card">
    <div class="thumb"><span class="badge">${escapeHtml(category)}</span><span>🧩</span></div>
    <div class="card-body"><h3>${escapeHtml(title || "Multi-part file")}</h3>
    <p>${count} parts · Select a part to download</p><div class="card-footer multipart-footer"><span class="meta">${escapeHtml(formatDate(first.date))}</span>
    <div class="part-buttons">${buttons}</div></div><div class="group-edit">${renderEditButton(first)}</div></div></article>`;
}

function openEditor(messageId) {
  const item = items.find(x => String(x.message_id) === String(messageId));
  if (!item) return;

  const payload = {
    message_id: item.message_id,
    title: item.display_title || item.title || "",
    description: item.description || "",
    category: item.category || "other",
    part_group: item.part_group || "",
    part_number: item.part_number || ""
  };

  const body = `SITE_EDIT\n\nPlease do not change the JSON below.\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
  const url = `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(`Edit site item ${item.message_id}`)}&body=${encodeURIComponent(body)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-edit-id]");
  if (button) openEditor(button.dataset.editId);
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function escapeAttr(value) {
  return String(value).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");
}

search.addEventListener("input", render);
filter.addEventListener("change", render);
document.getElementById("telegramButton").href = TELEGRAM_CHANNEL_URL;
loadContent();
