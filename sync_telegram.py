import json, os, re, urllib.request
from pathlib import Path

TOKEN = os.environ["BOT_TOKEN"]
DATA = Path("content.json")
API = f"https://api.telegram.org/bot{TOKEN}"

def call(method, params=None):
    params = params or {}
    body = urllib.parse.urlencode(params).encode()
    with urllib.request.urlopen(urllib.request.Request(f"{API}/{method}", data=body), timeout=30) as r:
        return json.load(r)

def load_items():
    if not DATA.exists(): return []
    try: return json.loads(DATA.read_text(encoding="utf-8"))
    except Exception: return []

def category(text):
    m = re.search(r"(?:^|\n)\s*(?:category|cat)\s*:\s*([^\n]+)", text, re.I)
    return (m.group(1).strip().lower() if m else "tools")

def clean_title(text, msg):
    first = next((x.strip() for x in text.splitlines() if x.strip()), "Telegram post")
    if re.match(r"^(category|cat)\s*:", first, re.I): first = "Telegram post"
    return first[:100]

def post_url(chat, message_id):
    username = getattr(chat, "get", lambda *_: None)("username") if isinstance(chat, dict) else None
    if username: return f"https://t.me/{username}/{message_id}"
    cid = str(chat.get("id", ""))
    if cid.startswith("-100"): return f"https://t.me/c/{cid[4:]}/{message_id}"
    return ""

items = load_items()
seen = {str(x.get("update_id")) for x in items}
state = {}
if Path("telegram_state.json").exists():
    try: state = json.loads(Path("telegram_state.json").read_text())
    except Exception: pass
params = {"timeout": 1, "allowed_updates": json.dumps(["channel_post"])}
if state.get("offset") is not None: params["offset"] = state["offset"]
res = call("getUpdates", params)
max_update = state.get("offset", 0) - 1
for update in res.get("result", []):
    max_update = max(max_update, update["update_id"])
    msg = update.get("channel_post")
    if not msg or str(update["update_id"]) in seen: continue
    text = (msg.get("text") or msg.get("caption") or "").strip()
    if not text and not (msg.get("document") or msg.get("photo") or msg.get("video")): continue
    link = post_url(msg.get("chat", {}), msg["message_id"])
    item = {
        "update_id": str(update["update_id"]),
        "message_id": msg["message_id"],
        "title": clean_title(text, msg),
        "description": text[:500],
        "category": category(text),
        "type": "FILE" if msg.get("document") else ("IMAGE" if msg.get("photo") else "LINK"),
        "icon": "📦" if msg.get("document") else ("🖼️" if msg.get("photo") else "🔗"),
        "date": msg.get("date", 0),
        "url": link
    }
    items.insert(0, item)
items = items[:200]
DATA.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
Path("telegram_state.json").write_text(json.dumps({"offset": max_update + 1}), encoding="utf-8")
print(f"Stored {len(items)} items")
