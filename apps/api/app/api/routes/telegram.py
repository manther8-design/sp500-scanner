import asyncio

from fastapi import APIRouter, Request
from sqlalchemy import select

from apps.api.app.core.config import get_settings
from apps.api.app.core.database import SessionLocal
from db.models import Alert, Watchlist
from providers.base import get_provider
from services.alerts.telegram import send_telegram_message
from services.data_collector import DataCollector

router = APIRouter()


@router.post("/telegram-webhook")
async def handle_telegram_incoming(request: Request) -> dict:
    settings = get_settings()
    data = await request.json()
    if "message" not in data or "text" not in data["message"]:
        return {"status": "ok"}

    chat_id = str(data["message"]["chat"]["id"])
    user_text = data["message"]["text"].strip()
    parts = user_text.split()
    cmd = parts[0].lower()

    if cmd == "/scan":
        symbols = [parts[1].upper()] if len(parts) > 1 else None
        await send_telegram_message(
            f"🔎 جاري المسح{' لـ `' + symbols[0] + '`' if symbols else ' للقائمة الافتراضية'}...",
            chat_id=chat_id,
        )
        asyncio.create_task(_scan_and_notify(chat_id, symbols))

    elif cmd == "/scan_crypto":
        await send_telegram_message("🔎 جاري فحص قائمة Crypto...", chat_id=chat_id)
        asyncio.create_task(_scan_watchlist_by_name(chat_id, "Crypto"))

    elif cmd == "/history":
        db = SessionLocal()
        try:
            recent = db.scalars(select(Alert).order_by(Alert.id.desc()).limit(5)).all()
            if recent:
                msg = "🗄️ *آخر 5 تنبيهات:*\n\n"
                for alert in recent:
                    price = f"${round(alert.price, 2)}" if alert.price is not None else "—"
                    msg += f"• `{alert.symbol}` | {price} | {alert.alert_type}\n"
            else:
                msg = "🗄️ لا توجد تنبيهات مسجلة بعد."
            await send_telegram_message(msg, chat_id=chat_id)
        finally:
            db.close()

    elif cmd == "/status":
        provider = get_provider(settings.data_provider)
        health = await provider.health_check()
        await send_telegram_message(
            f"📡 Provider: `{health.get('provider')}`\n"
            f"Status: `{health.get('status')}`\n"
            f"Delayed: `{health.get('is_delayed')}`\n"
            f"Sample AAPL: `{health.get('sample_price')}`",
            chat_id=chat_id,
        )

    else:
        if settings.telegram_enabled:
            await send_telegram_message(
                "الأوامر: `/scan` `/scan TICKER` `/scan_crypto` `/history` `/status`",
                chat_id=chat_id,
            )

    return {"status": "ok"}


async def _scan_and_notify(chat_id: str, symbols: list[str] | None) -> None:
    db = SessionLocal()
    try:
        settings = get_settings()
        collector = DataCollector(db=db, provider=get_provider(settings.data_provider))
        run = await collector.run_scan(
            trigger="manual",
            symbols=symbols,
            fetch_history=bool(symbols),  # full history only for single-ticker to stay snappy
            timeframe="1d",
        )
        await send_telegram_message(
            f"✅ اكتمل المسح.\n"
            f"الإجمالي: `{run.symbols_total}` | نجاح: `{run.symbols_ok}` | فشل: `{run.symbols_failed}`\n"
            f"اكتمال متوسط: `{round(run.avg_completeness, 2) if run.avg_completeness is not None else '—'}`",
            chat_id=chat_id,
        )
    except Exception as exc:
        await send_telegram_message(f"❌ فشل المسح: {exc}", chat_id=chat_id)
    finally:
        db.close()


async def _scan_watchlist_by_name(chat_id: str, name: str) -> None:
    db = SessionLocal()
    try:
        wl = db.scalar(select(Watchlist).where(Watchlist.name == name))
        if wl is None:
            await send_telegram_message(f"القائمة `{name}` غير موجودة.", chat_id=chat_id)
            return
        settings = get_settings()
        collector = DataCollector(db=db, provider=get_provider(settings.data_provider))
        run = await collector.run_scan(
            trigger="manual",
            watchlist_id=wl.id,
            fetch_history=False,
            timeframe="1d",
        )
        await send_telegram_message(
            f"✅ فحص `{name}`: نجاح `{run.symbols_ok}` / `{run.symbols_total}`",
            chat_id=chat_id,
        )
    except Exception as exc:
        await send_telegram_message(f"❌ فشل المسح: {exc}", chat_id=chat_id)
    finally:
        db.close()
