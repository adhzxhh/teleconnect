import json, os, re, urllib.request, urllib.parse
from pathlib import Path

TOKEN = os.environ["BOT_TOKEN"]
DATA = Path("content.json")
STATE = Path("telegram_state.json")
DOWNLOADS = Path("downloads")
API = f"https://api.telegram.org/bot{TOKEN}"


def call(method, params=None):
    params = params or {}
    body = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(f"{API}/{method}", data=body)
    with urllib.request.urlopen(req, timeout=30) as r:
        result = json.load(r)
    if not result.get("ok"):
        raise RuntimeError(f"Telegram API error in {method}: {result.get('description', 'unknown error')}")
    return result["result"]


def load_json(path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def category(text):
    m = re.search(r"(?:^|\n)\s*(?:category|cat)\s*:\s*([^\n]+)", text, re.I)
    return m.group(1).strip().lower() if m else "tools"


def clean_title(text):
    first = next((x.strip() for x in text.splitlines() if x.strip()), "Telegram post")
    if re.match(r"^(category|cat)\s*:", first, re.I):
        first = "Telegram post"
    return first[:100]


def post_url(chat, message_id):
    username = chat.get("username")
    if username:
        return f"https://t.me/{username}/{message_id}"
    cid = str(chat.get("id", ""))
    if cid.startswith("-100"):
        return f"https://t.me/c/{cid[4:]}/{message_id}"
    return ""


def safe_filename(name, fallback):
    name = os.path.basename(name or "")
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
    return (name or fallback)[:180]


def download_file(file_id, filename):
    info = call("getFile", {"file_id": file_id})
    file_path = info.get("file_path")
    if not file_path:
        return ""

    filename = safe_filename(filename, Path(file_path).name or "file")
    destination = DOWNLOADS / filename
    DOWNLOADS.mkdir(parents=True, exist_ok=True)

    if destination.exists():
        return destination.as_posix()

    url = f"https://api.telegram.org/file/bot{TOKEN}/{file_path}"
    urllib.request.urlretrieve(url, destination)
    return destination.as_posix()


# Verify the bot token and report webhook status without exposing the token.
bot = call("getMe")
print(f"Bot connected: @{bot.get('username', '(no username)')}")
webhook = call("getWebhookInfo")
webhook_url = webhook.get("url", "")
if webhook_url:
    raise RuntimeError("Telegram webhook is configured. getUpdates cannot receive updates while a webhook is active.")
print("Webhook: none (getUpdates is available)")

items = load_json(DATA, [])
if not isinstance(items, list):
    items = []

state = load_json(STATE, {})
if not isinstance(state, dict):
    state = {}

params = {
    "timeout": 1,
    "allowed_updates": json.dumps(["message"]),
}
if state.get("offset") is not None:
    params["offset"] = int(state["offset"])

updates = call("getUpdates", params)
print(f"Telegram updates received: {len(updates)}")

max_update = int(state.get("offset", 0)) - 1
seen = {str(x.get("update_id")) for x in items if isinstance(x, dict)}
new_items = 0

for update in updates:
    update_id = update.get("update_id")
    if update_id is None:
        continue
    max_update = max(max_update, int(update_id))

    msg = update.get("message")
    if not msg:
        continue

    chat = msg.get("chat", {})
    print(f"Group message received: chat={chat.get('title', '(untitled)')} id={chat.get('id')} message_id={msg.get('message_id')}")

    if str(update_id) in seen:
        continue

    text = (msg.get("text") or msg.get("caption") or "").strip()
    has_media = bool(msg.get("document") or msg.get("photo") or msg.get("video"))
    if not text and not has_media:
        continue

    download_url = ""
    filename = ""
    try:
        if msg.get("document"):
            doc = msg["document"]
            filename = safe_filename(doc.get("file_name"), f"telegram_{msg.get('message_id')}.bin")
            item_type, icon = "FILE", "📦"
            download_url = download_file(doc["file_id"], f"{msg.get('message_id')}_{filename}")
        elif msg.get("photo"):
            photo = msg["photo"][-1]
            filename = f"{msg.get('message_id')}.jpg"
            item_type, icon = "IMAGE", "🖼️"
            download_url = download_file(photo["file_id"], filename)
        elif msg.get("video"):
            video = msg["video"]
            filename = safe_filename(video.get("file_name"), f"telegram_{msg.get('message_id')}.mp4")
            item_type, icon = "VIDEO", "🎬"
            download_url = download_file(video["file_id"], f"{msg.get('message_id')}_{filename}")
        else:
            item_type, icon = "LINK", "🔗"
    except Exception as exc:
        print(f"Media download failed; keeping Telegram link: {exc}")
        download_url = ""

    items.insert(0, {
        "update_id": str(update_id),
        "message_id": msg.get("message_id"),
        "title": clean_title(text),
        "description": text[:500],
        "category": category(text),
        "type": item_type,
        "icon": icon,
        "date": msg.get("date", 0),
        "url": post_url(chat, msg.get("message_id")),
        "download_url": download_url,
        "filename": filename,
    })
    new_items += 1

items = items[:200]
DATA.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")

# Only advance the offset after Telegram has successfully returned the queue.
if max_update >= int(state.get("offset", 0)):
    STATE.write_text(json.dumps({"offset": max_update + 1}), encoding="utf-8")

print(f"New posts stored this run: {new_items}")
print(f"Total posts stored: {len(items)}")
