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

function render() {
  const q = search.value.toLowerCase().trim();
  const category = filter.value;
  const filtered = items.filter(item => {
    const itemCategory = String(item.category || "other").toLowerCase();
    return (category === "all" || itemCategory === category) &&
      (`${item.title || ""} ${item.description || ""}`.toLowerCase().includes(q));
  });

  grid.innerHTML = filtered.map(item => {
    const type = String(item.type || "LINK").toUpperCase();
    const icon = item.icon || (type === "FILE" ? "📦" : type === "IMAGE" ? "🖼️" : type === "VIDEO" ? "🎬" : "🔗");
    const url = item.url || TELEGRAM_CHANNEL_URL;
    const downloadUrl = item.download_url || "";
    const action = downloadUrl
      ? `<a class="btn primary" href="${escapeAttr(downloadUrl)}" download="${escapeAttr(item.filename || "")}">DOWNLOAD ↓</a>`
      : `<a class="btn primary" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${type === "LINK" ? "OPEN ↗" : "VIEW →"}</a>`;

    return `
      <article class="card">
        <div class="thumb">
          <span class="badge">${escapeHtml(type)}</span>
          <span>${escapeHtml(icon)}</span>
        </div>
        <div class="card-body">
          <h3>${escapeHtml(item.title || "Telegram post")}</h3>
          <p>${escapeHtml(item.description || "")}</p>
          <div class="card-footer">
            <span class="meta">${escapeHtml(formatDate(item.date))}</span>
            ${action}
          </div>
        </div>
      </article>
    `;
  }).join("");

  empty.hidden = filtered.length !== 0;
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
