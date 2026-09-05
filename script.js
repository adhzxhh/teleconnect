const items = [
  {
    title: "Example Android Tool",
    description: "A sample entry. Replace this with your Telegram-synced content.",
    category: "tools",
    icon: "⚙️",
    type: "FILE",
    date: "Sample",
    url: "#"
  },
  {
    title: "Useful Website",
    description: "A sample external link that can be published on the site.",
    category: "other",
    icon: "🔗",
    type: "LINK",
    date: "Sample",
    url: "https://example.com"
  },
  {
    title: "Preview Image",
    description: "Images posted to Telegram can be shown as previews here.",
    category: "images",
    icon: "🖼️",
    type: "IMAGE",
    date: "Sample",
    url: "#"
  }
];

const grid = document.getElementById("contentGrid");
const empty = document.getElementById("emptyState");
const search = document.getElementById("searchInput");
const filter = document.getElementById("categoryFilter");

function render() {
  const q = search.value.toLowerCase().trim();
  const category = filter.value;
  const filtered = items.filter(item =>
    (category === "all" || item.category === category) &&
    (`${item.title} ${item.description}`.toLowerCase().includes(q))
  );

  grid.innerHTML = filtered.map(item => `
    <article class="card">
      <div class="thumb">
        <span class="badge">${item.type}</span>
        <span>${item.icon}</span>
      </div>
      <div class="card-body">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p>
        <div class="card-footer">
          <span class="meta">${escapeHtml(item.date)}</span>
          <a class="btn primary" href="${escapeAttr(item.url)}" target="_blank" rel="noopener">
            ${item.type === "LINK" ? "OPEN ↗" : "VIEW →"}
          </a>
        </div>
      </div>
    </article>
  `).join("");

  empty.hidden = filtered.length !== 0;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}
function escapeAttr(value) {
  return String(value).replace(/"/g, "&quot;");
}

search.addEventListener("input", render);
filter.addEventListener("change", render);
render();

// Put your public Telegram channel URL here, e.g. https://t.me/yourchannel
const TELEGRAM_CHANNEL_URL = "#";
document.getElementById("telegramButton").href = TELEGRAM_CHANNEL_URL;
