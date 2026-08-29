import asyncio
from fastapi import FastAPI, Request
import httpx
import yfinance as yf
import pandas as pd
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from contextlib import asynccontextmanager

# ==========================================
# ⚙️ الإعدادات العامة
# ==========================================
TELEGRAM_BOT_TOKEN = "8867514375:AAGSH3HABzPZ9HMRvGgLygnZFs37-SbZ9ZE"
TELEGRAM_CHAT_ID = "8015039751"

# ==========================================
# 📊 قائمة أسهم S&P 500
# ==========================================
WATCHLIST = [
    "AAPL", "ABBV", "ABT", "ACN", "ADBE", "ADI", "ADM", "ADP", "ADSK", "AEE",
    "AEP", "AES", "AFL", "AIG", "AIZ", "AJG", "AKAM", "ALB", "ALGN", "ALK",
    "ALL", "ALLE", "AMAT", "AMCR", "AMD", "AME", "AMGN", "AMP", "AMT", "AMZN",
    "ANET", "ANSS", "AON", "AOS", "APA", "APD", "APH", "APTV", "ARE", "ATO",
    "AVB", "AVGO", "AVY", "AWK", "AXON", "AXP", "AZO", "BA", "BAC", "BALL",
    "BAX", "BBWI", "BBY", "BDX", "BEN", "BF-B", "BG", "BIIB", "BIO", "BK",
    "BKNG", "BKR", "BLDR", "BLK", "BMY", "BR", "BRK-B", "BRO", "BSX", "BWA",
    "BX", "BXP", "C", "CAG", "CAH", "CARR", "CAT", "CB", "CBOE", "CBRE",
    "CCI", "CCJ", "CDNS", "CDW", "CE", "CEG", "CF", "CFG", "CHD", "CHRW",
    "CHTR", "CI", "CINF", "CL", "CLX", "CMA", "CMG", "CMI", "CMS", "CNC",
    "CNP", "COF", "COO", "COP", "COR", "COST", "CPB", "CPRT", "CPT", "CRL",
    "CRM", "CSGP", "CSX", "CTAS", "CTRA", "CTSH", "CTVA", "CVS", "CVX", "CZR",
    "D", "DAL", "DD", "DE", "DFS", "DG", "DGX", "DHI", "DHR", "DIS",
    "DLR", "DLTR", "DOC", "DOV", "DOW", "DPZ", "DRI", "DTE", "DUK", "DVA",
    "DVN", "DXCM", "EA", "EBAY", "ECL", "ED", "EFX", "EG", "EIX", "EL",
    "ELV", "EMN", "EMR", "ENPH", "EOG", "EPAM", "EQT", "EQR", "EQIX", "ERIE",
    "ES", "ESS", "ETN", "ETR", "EVRG", "EW", "EXC", "EXPD", "EXPE", "EXR",
    "F", "FANG", "FAST", "FCX", "FDS", "FDX", "FE", "FFIV", "FI", "FICO",
    "FIS", "FITB", "FLT", "FMC", "FOX", "FOXA", "FRT", "FSLR", "FTNT", "FTV",
    "GD", "GE", "GEHC", "GEN", "GEV", "GILD", "GIS", "GL", "GLW", "GM",
    "GNRC", "GOOG", "GOOGL", "GPC", "GPN", "GRMN", "GS", "GWW", "HAL", "HAS",
    "HBAN", "HCA", "HD", "HIG", "HII", "HLT", "HOLX", "HON", "HRL", "HSIC",
    "HST", "HSY", "HUM", "HWM", "IBM", "ICE", "IDXX", "IEX", "IFF", "ILMN",
    "INCY", "INTC", "INTU", "INVH", "IP", "IPG", "IQV", "IR", "IRM", "ISRG",
    "IT", "ITW", "IVZ", "J", "JBHT", "JBL", "JCI", "JKHY", "JNJ", "JNPR",
    "JPM", "K", "KDP", "KEY", "KEYS", "KMB", "KMI", "KMX", "KO", "KR",
    "KVUE", "L", "LDOS", "LEN", "LH", "LHX", "LIN", "LKQ", "LLY", "LMT",
    "LNT", "LOW", "LRCX", "LULU", "LUV", "LVS", "LW", "LYB", "LYV", "MA",
    "MAA", "MAR", "MAS", "MCD", "MCHP", "MCK", "MCO", "MDLZ", "MDT", "MET",
    "META", "MGM", "MHK", "MKC", "MKTX", "MLM", "MMC", "MMM", "MNST", "MO",
    "MOH", "MOS", "MPC", "MPWR", "MRK", "MRNA", "MS", "MSFT", "MSI", "MTB",
    "MTD", "MU", "NCLH", "NDAQ", "NDSN", "NEE", "NEM", "NFLX", "NI", "NKE",
    "NOC", "NOW", "NRG", "NSC", "NTAP", "NTR", "NTRS", "NUE", "NVDA", "NVR",
    "NWS", "NWSA", "NXPI", "O", "ODFL", "OKE", "OMC", "ON", "OPAD", "ORCL",
    "ORLY", "OTIS", "OXY", "PANW", "PARA", "PAYX", "PAYC", "PCAR", "PCG", "PEG",
    "PEP", "PFE", "PFG", "PG", "PGR", "PH", "PHM", "PKG", "PLD", "PLTR",
    "PM", "PNC", "PNR", "PNW", "PODD", "POOL", "PPG", "PPL", "PRU", "PSA",
    "PSX", "PTC", "PWR", "PYPL", "QCOM", "QRVO", "RCL", "REG", "REGN", "RF",
    "RJF", "RL", "RMD", "ROK", "ROL", "ROP", "ROST", "RSG", "RTX", "SBAC",
    "SBUX", "SCHW", "SHW", "SJM", "SLB", "SMCI", "SNA", "SNPS", "SO", "SPG",
    "SPGI", "SRE", "STE", "STLD", "STT", "STX", "STZ", "SWK", "SWKS", "SYK",
    "SYY", "T", "TAP", "TDG", "TDY", "TECH", "TEL", "TER", "TFC", "TFX",
    "TGT", "TJX", "TMO", "TMUS", "TPR", "TRGP", "TRMB", "TROW", "TRV", "TSCO",
    "TSLA", "TSN", "TT", "TTWO", "TXN", "TXT", "TYL", "UAL", "UDR", "UHS",
    "ULTA", "UNH", "UNP", "UPS", "URI", "USB", "V", "VLO", "VLTO", "VMC",
    "VRSK", "VRSN", "VRTX", "VST", "VTR", "VTRS", "VZ", "WAB", "WAT", "WBA",
    "WBD", "WDC", "WEC", "WELL", "WFC", "WM", "WMB", "WMT", "WRB", "WST",
    "WTW", "WY", "WYNN", "XEL", "XOM", "XYL", "YUM", "ZBH", "ZBRA", "ZTS"
]

# ==========================================
# 🔄 المجدول الآلي
# ==========================================
scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # جدولة فحص القائمة كاملة كل ساعة
    scheduler.add_job(lambda: run_scanner_engine(target_stocks=WATCHLIST), 'interval', hours=1)
    scheduler.start()
    print(f"🚀 Started Scheduler: Monitoring {len(WATCHLIST)} stocks.")
    yield
    scheduler.shutdown()

app = FastAPI(title="S&P 500 Fast & Flexible Scanner", lifespan=lifespan)

@app.get("/")
async def root():
    return {"status": "online", "monitored_stocks": len(WATCHLIST)}

async def send_telegram_message(chat_id: str, text: str):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown"
    }
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(url, json=payload, timeout=10.0)
            return res.status_code == 200
        except Exception as e:
            print(f"Error sending Telegram message: {e}")
            return False

# ==========================================
# ⚡ محرك الفحص الشامل (سهم واحد أو الجميع)
# ==========================================
async def run_scanner_engine(target_stocks: list = None, target_chat_id: str = TELEGRAM_CHAT_ID):
    if target_stocks is None or len(target_stocks) == 0:
        target_stocks = WATCHLIST

    is_single_stock = len(target_stocks) == 1
    print(f"Start scanning {len(target_stocks)} stock(s)...")
    matches_found = 0
    batch_size = 20  # لتجنب حظر Yahoo Finance عند جلب كميات كبيرة
    
    for i in range(0, len(target_stocks), batch_size):
        chunk = target_stocks[i:i + batch_size]
        try:
            data = yf.download(chunk, period="3mo", interval="1d", progress=False, threads=False)
            
            if data is None or data.empty:
                continue

            for ticker in chunk:
                try:
                    if isinstance(data.columns, pd.MultiIndex):
                        if ticker not in data.columns.levels[1]:
                            continue
                        df = data.xs(ticker, level=1, axis=1).dropna()
                    else:
                        df = data.dropna()

                    if df.empty or len(df) < 35:
                        if is_single_stock:
                            await send_telegram_message(target_chat_id, f"❌ لا توجد بيانات كافية للسهم `{ticker}`.")
                        continue

                    close_series = df['Close']
                    volume_series = df['Volume']
                    close_price = float(close_series.iloc[-1])
                    current_volume = float(volume_series.iloc[-1])

                    ma20 = float(close_series.rolling(window=20).mean().iloc[-1])
                    ma50 = float(close_series.rolling(window=50).mean().iloc[-1])

                    delta = close_series.diff()
                    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
                    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
                    last_gain = float(gain.iloc[-1])
                    last_loss = float(loss.iloc[-1])
                    rs = last_gain / (last_loss if last_loss != 0 else 1)
                    rsi_val = float(100 - (100 / (1 + rs)))

                    ema12 = close_series.ewm(span=12, adjust=False).mean()
                    ema26 = close_series.ewm(span=26, adjust=False).mean()
                    macd_line = ema12 - ema26
                    signal_line = macd_line.ewm(span=9, adjust=False).mean()
                    macd_hist = macd_line - signal_line

                    last_macd = float(macd_line.iloc[-1])
                    last_signal = float(signal_line.iloc[-1])
                    prev_hist = float(macd_hist.iloc[-2])
                    last_hist = float(macd_hist.iloc[-1])

                    is_macd_crossover = (last_macd > last_signal and prev_hist <= 0 and last_hist > 0)
                    is_macd_bullish = (last_macd > last_signal)

                    avg_vol_20 = float(volume_series.tail(20).mean())
                    vol_ratio = (current_volume / avg_vol_20) if avg_vol_20 > 0 else 1.0

                    support = float(df['Low'].tail(20).min())
                    resistance = float(df['High'].tail(20).max())

                    condition_macd = is_macd_crossover or is_macd_bullish
                    condition_volume = vol_ratio >= 1.2
                    condition_rsi = 45 <= rsi_val <= 68
                    condition_trend = close_price > ma20 and ma20 > ma50

                    if condition_macd and condition_volume and condition_rsi and condition_trend:
                        matches_found += 1
                        alert_msg = (
                            f"🚀 *تنبيه فرصة عالية الجودة | {ticker}*\n"
                            f"───────────────────\n"
                            f"💵 *السعر الحالي:* `${round(close_price, 2)}`\n"
                            f"🔊 *السيولة:* أعلى من المعدل بـ `{int((vol_ratio-1)*100)}%` 🔥\n"
                            f"📊 *مؤشر RSI:* `{round(rsi_val, 1)}`\n"
                            f"📈 *الاتجاه و MACD:* إيجابي وصاعد\n"
                            f"🛡️ *الدعم:* `${round(support, 2)}` | 🎯 *المقاومة:* `${round(resistance, 2)}`"
                        )
                        await send_telegram_message(target_chat_id, alert_msg)
                        await asyncio.sleep(0.5)
                    elif is_single_stock:
                        await send_telegram_message(
                            target_chat_id, 
                            f"ℹ️ السهم `{ticker}` لا يطابق شروط الدخول حالياً.\n"
                            f"السعر: `${round(close_price, 2)}` | RSI: `{round(rsi_val, 1)}` | السيولة: `{round(vol_ratio, 2)}x`"
                        )

                except Exception as ex:
                    print(f"Error processing {ticker}: {ex}")
                    continue

        except Exception as e:
            print(f"Batch error: {e}")

        if not is_single_stock:
            await asyncio.sleep(1.5)

    if not is_single_stock:
        await send_telegram_message(target_chat_id, f"✅ اكتمل فحص الـ {len(target_stocks)} سهم. تم إرسال {matches_found} فرصة مطابقة.")
    
    print(f"Scan finished. Matches: {matches_found}")

# ==========================================
# 💬 Endpoint استقبال أوامر تليجرام
# ==========================================
@app.post("/telegram-webhook")
async def handle_telegram_incoming(request: Request):
    data = await request.json()
    if "message" in data and "text" in data["message"]:
        chat_id = str(data["message"]["chat"]["id"])
        user_text = data["message"]["text"].strip()
        parts = user_text.split()
        cmd = parts[0].lower()

        # أمر /scan (سهم محدد أو الجميع)
        if cmd == "/scan":
            if len(parts) > 1:
                # فحص سهم واحد فقط عبر شروط الإستراتيجية
                ticker = parts[1].upper()
                await send_telegram_message(chat_id, f"🔎 جاري تطبيق شروط الإستراتيجية على `{ticker}`...")
                asyncio.create_task(run_scanner_engine(target_stocks=[ticker], target_chat_id=chat_id))
            else:
                # فحص القائمة كاملة
                await send_telegram_message(chat_id, f"🔎 جاري فحص جميع الأسهم ({len(WATCHLIST)} سهم) في الخلفية...")
                asyncio.create_task(run_scanner_engine(target_stocks=WATCHLIST, target_chat_id=chat_id))

        # أمر /analyze أو /a للحصول على تقرير رقمي مباشر لأي سهم
        elif cmd in ["/analyze", "/a"]:
            if len(parts) > 1:
                ticker = parts[1].upper()
                await send_telegram_message(chat_id, f"⏳ جاري تحليل `{ticker}`...")
                try:
                    df = yf.download(ticker, period="6mo", interval="1d", progress=False)
                    if isinstance(df.columns, pd.MultiIndex):
                        df = df.xs(ticker, level=1, axis=1)

                    if not df.empty and len(df) >= 35:
                        c = float(df['Close'].iloc[-1])
                        v = float(df['Volume'].iloc[-1])
                        avg_v = float(df['Volume'].tail(20).mean())
                        vr = round(v / avg_v, 2) if avg_v > 0 else 1.0

                        delta = df['Close'].diff()
                        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
                        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
                        rs = float(gain.iloc[-1]) / (float(loss.iloc[-1]) if float(loss.iloc[-1]) != 0 else 1)
                        rsi = round(100 - (100 / (1 + rs)), 1)

                        msg = (
                            f"📊 *تحليل {ticker}*\n"
                            f"───────────────────\n"
                            f"💵 السعر الحالي: `${round(c, 2)}`\n"
                            f"📈 RSI (14): `{rsi}`\n"
                            f"🔊 معدل السيولة: `{vr}x`\n"
                            f"🛡️ أدنى سعر 20 يوم: `${round(float(df['Low'].tail(20).min()), 2)}`\n"
                            f"🎯 أعلى سعر 20 يوم: `${round(float(df['High'].tail(20).max()), 2)}`"
                        )
                        await send_telegram_message(chat_id, msg)
                    else:
                        await send_telegram_message(chat_id, f"❌ لا توجد بيانات كافية للسهم `{ticker}`.")
                except Exception as e:
                    await send_telegram_message(chat_id, f"❌ خطأ أثناء التحليل: {e}")
            else:
                await send_telegram_message(chat_id, "⚠️ يرجى كتابة رمز السهم بعد الأمر، مثال:\n`/analyze TSLA`")

    return {"status": "ok"}