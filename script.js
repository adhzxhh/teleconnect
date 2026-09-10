let items = [];

const TELEGRAM_CHANNEL_URL = "https://t.me/+YepVltovdYJmMWQ1";
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
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }
  return String(value);
}

// Automatically recognize common multi-part naming styles:
// Part 1, Part1, Pt 1, 01, (1), _1, -1, etc.
function partInfo(item) {
  const name = String(item.filename || item.title || "").trim();
  const withoutExt = name.replace(/\.[^.]+$/, "");

  let match = withoutExt.match(/(?:^|[ ._\-])(?:part|pt)[ ._\-]?(\d+)$/i);
  if (match) {
    const partNumber = Number(match[1]);
    const base = withoutExt.slice(0, match.index + (match[0].startsWith(" ") || match[0].startsWith(".") || match[0].startsWith("_") || match[0].startsWith("-") ? 0 : 0))
      .replace(/(?:part|pt)[ ._\-]?\d+$/i, "")
      .replace(/[._\-]+$/, "")
      .replace(/\s+/g, " ")
      .trim();
    return { key: base.toLowerCase(), partNumber };
  }

  match = withoutExt.match(/(?:^|[ ._\-])\((\d+)\)$/);
  if (!match) match = withoutExt.match(/(?:^|[._\-])0*(\d+)$/);
  if (match) {
    const partNumber = Number(match[1]);
    const suffix = match[0];
    const base = withoutExt.slice(0, withoutExt.length - suffix.length)
      .replace(/[._\-]+$/, "")
      .replace(/\s+/g, " ")
      .trim();
    // Only treat numbered suffixes as parts when the number is >= 1.
    if (partNumber >= 1) return { key: base.toLowerCase(), partNumber };
  }

  return null;
}

function groupItems(source) {
  const groups = [];
  const grouped = new Map();

  source.forEach(item => {
    const info = partInfo(item);
    if (!info) {
      groups.push({ single: item });
      return;
    }

    const groupKey = `${String(item.category || "other").toLowerCase()}::${info.key}`;
    if (!grouped.has(groupKey)) {
      const group = { parts: [], first: item, key: groupKey, partKey: info.key };
      grouped.set(groupKey, group);
      groups.push(group);
    }
    grouped.get(groupKey).parts.push({ item, partNumber: info.partNumber });
  });

  groups.forEach(group => {
    if (!group.parts) return;
    group.parts.sort((a, b) => a.partNumber - b.partNumber);
  });

  return groups;
}

function render() {
  const q = search.value.toLowerCase().trim();
  const category = filter.value;
  const filtered = items.filter(item => {
    const itemCategory = String(item.category || "other").toLowerCase();
    return (category === "all" || itemCategory === category) &&
      (`${item.title || ""} ${item.description || ""}`.toLowerCase().includes(q));
  });

  const groups = groupItems(filtered);
  grid.innerHTML = groups.map(group => group.single ? renderSingle(group.single) : renderGroup(group)).join("");
  empty.hidden = groups.length !== 0;
}

function renderSingle(item) {
  const type = String(item.type || "FILE").toUpperCase();
  const icon = item.icon || (type === "FILE" ? "📦" : type === "IMAGE" ? "🖼️" : "🎬");
  const url = item.url || TELEGRAM_CHANNEL_URL;
  const downloadUrl = item.download_url || "";
  const action = downloadUrl
    ? `<a class="btn primary" href="${escapeAttr(downloadUrl)}" download="${escapeAttr(item.filename || "")}">DOWNLOAD ↓</a>`
    : `<a class="btn primary" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">VIEW →</a>`;

  return `
    <article class="card">
      <div class="thumb">
        <span class="badge">${escapeHtml(type)}</span>
        <span>${escapeHtml(icon)}</span>
      </div>
      <div class="card-body">
        <h3>${escapeHtml(item.title || "Telegram file")}</h3>
        <p>${escapeHtml(item.description || "")}</p>
        <div class="card-footer">
          <span class="meta">${escapeHtml(formatDate(item.date))}</span>
          ${action}
        </div>
      </div>
    </article>
  `;
}

function renderGroup(group) {
  const first = group.first;
  const count = group.parts.length;
  const title = group.partKey.replace(/\b\w/g, c => c.toUpperCase());
  const category = String(first.category || "other").toUpperCase();

  const buttons = group.parts.map(({ item, partNumber }) => {
    const url = item.download_url || item.url || TELEGRAM_CHANNEL_URL;
    const label = item.download_url ? `PART ${partNumber} ↓` : `PART ${partNumber} →`;
    const attrs = item.download_url
      ? `href="${escapeAttr(url)}" download="${escapeAttr(item.filename || "")}"`
      : `href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer"`;
    return `<a class="btn primary" ${attrs}>${label}</a>`;
  }).join("");

  return `
    <article class="card multipart-card">
      <div class="thumb">
        <span class="badge">${escapeHtml(category)}</span>
        <span>🧩</span>
      </div>
      <div class="card-body">
        <h3>${escapeHtml(title || "Multi-part file")}</h3>
        <p>${count} parts · Select a part to download</p>
        <div class="card-footer multipart-footer">
          <span class="meta">${escapeHtml(formatDate(first.date))}</span>
          <div class="part-buttons">${buttons}</div>
        </div>
      </div>
    </article>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

function escapeAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

search.addEventListener("input", render);
filter.addEventListener("change", render);
document.getElementById("telegramButton").href = TELEGRAM_CHANNEL_URL;
loadContent();
