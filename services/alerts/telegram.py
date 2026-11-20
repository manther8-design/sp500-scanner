import httpx

from apps.api.app.core.config import get_settings


async def send_telegram_message(text: str, chat_id: str | None = None) -> bool:
    settings = get_settings()
    token = settings.telegram_bot_token
    target = chat_id or settings.telegram_chat_id
    if not token or not target:
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {"chat_id": target, "text": text, "parse_mode": "Markdown"}
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(url, json=payload, timeout=10.0)
            return res.status_code == 200
        except Exception:
            return False
