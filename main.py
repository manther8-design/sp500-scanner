import asyncio
from fastapi import FastAPI, Request
import httpx
import yfinance as yf
import pandas as pd
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from contextlib import asynccontextmanager
import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker

# ==========================================
# ⚙️ الإعدادات العامة
# ==========================================
TELEGRAM_BOT_TOKEN = "8867514375:AAGSH3HABzPZ9HMRvGgLygnZFs37-SbZ9ZE"
TELEGRAM_CHAT_ID = "8015039751"

# ==========================================
# 🗄️ إعدادات قاعدة البيانات (حفظ الفرص)
# ==========================================
# نستخدم SQLite حالياً لسهولتها (يمكن لاحقاً استبدال الرابط بـ PostgreSQL)
SQLALCHEMY_DATABASE_URL = "sqlite:///./alerts.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class AlertRecord(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, index=True)
    price = Column(Float)
    market_type = Column(String) # 'Stock' or 'Crypto'
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

Base.metadata.create_all(bind=engine)

def save_alert_to_db(ticker: str, price: float, market_type: str):
    db = SessionLocal()
    new_alert = AlertRecord(ticker=ticker, price=price, market_type=market_type)
    db.add(new_alert)
    db.commit()
    db.close()

# ==========================================
# 📊 قوائم المراقبة
# ==========================================
CRYPTO_WATCHLIST = ["BTC-USD", "ETH-USD", "SOL-USD", "AVAX-USD"]

# قائمة S&P 500 (نفس القائمة الخاصة بك)
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
    # جدولة فحص الأسهم كل ساعة
    scheduler.add_job(lambda: run_scanner_engine(target_stocks=WATCHLIST, market_type="Stock"), 'interval', hours=1)
    # جدولة فحص الكريبتو كل ساعتين
    scheduler.add_job(lambda: run_scanner_engine(target_stocks=CRYPTO_WATCHLIST, market_type="Crypto"), 'interval', hours=2)
    scheduler.start()
    print(f"🚀 Started Scheduler: Monitoring Stocks & Crypto.")
    yield
    scheduler.shutdown()

app = FastAPI(title="Pro Market Scanner", lifespan=lifespan)

async def send_telegram_message(chat_id: str, text: str):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(url, json=payload, timeout=10.0)
            return res.status_code == 200
        except Exception:
            return False

# ==========================================
# ⚡ محرك الفحص المتطور (SMC + RSI + Volume)
# ==========================================
async def run_scanner_engine(target_stocks: list = None, target_chat_id: str = TELEGRAM_CHAT_ID, market_type="Stock"):
    is_single_stock = len(target_stocks) == 1
    matches_found = 0
    batch_size = 20
    
    for i in range(0, len(target_stocks), batch_size):
        chunk = target_stocks[i:i + batch_size]
        try:
            data = yf.download(chunk, period="3mo", interval="1d", progress=False, threads=False)
            if data is None or data.empty:
                continue

            for ticker in chunk:
                try:
                    if isinstance(data.columns, pd.MultiIndex):
                        if ticker not in data.columns.levels[1]: continue
                        df = data.xs(ticker, level=1, axis=1).dropna()
                    else:
                        df = data.dropna()

                    if df.empty or len(df) < 35: continue

                    close_series = df['Close']
                    open_series = df['Open']
                    high_series = df['High']
                    low_series = df['Low']
                    vol_series = df['Volume']
                    
                    c_price = float(close_series.iloc[-1])
                    
                    # 1. تحليل السيولة
                    avg_vol_20 = float(vol_series.tail(20).mean())
                    vol_ratio = (float(vol_series.iloc[-1]) / avg_vol_20) if avg_vol_20 > 0 else 1.0

                    # 2. مؤشر RSI
                    delta = close_series.diff()
                    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
                    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
                    rs = float(gain.iloc[-1]) / (float(loss.iloc[-1]) if float(loss.iloc[-1]) != 0 else 1)
                    rsi_val = float(100 - (100 / (1 + rs)))

                    # 3. مفاهيم الأموال الذكية (SMC) - Order Blocks & FVG
                    # أ. Bullish Fair Value Gap (FVG): قاع الشمعة الحالية أعلى من قمة الشمعة قبل السابقة
                    has_bullish_fvg = float(low_series.iloc[-1]) > float(high_series.iloc[-3])
                    
                    # ب. Bullish Order Block (OB): شمعة هابطة قوية يليها ابتلاع شرائي
                    prev_bearish = float(close_series.iloc[-2]) < float(open_series.iloc[-2])
                    current_bullish = float(close_series.iloc[-1]) > float(open_series.iloc[-1])
                    engulfing = float(close_series.iloc[-1]) > float(open_series.iloc[-2])
                    is_order_block = prev_bearish and current_bullish and engulfing

                    # الشروط المجمعة
                    condition_volume = vol_ratio >= 1.2
                    condition_rsi = 40 <= rsi_val <= 70
                    condition_smc = has_bullish_fvg or is_order_block

                    if condition_volume and condition_rsi and condition_smc:
                        matches_found += 1
                        
                        # حفظ الفرصة في قاعدة البيانات
                        save_alert_to_db(ticker, c_price, market_type)
                        
                        smc_tag = "🟩 Order Block" if is_order_block else "🪟 FVG Gap"
                        
                        alert_msg = (
                            f"🚀 *فرصة {market_type} | {ticker}*\n"
                            f"───────────────────\n"
                            f"💵 *السعر:* `${round(c_price, 2)}`\n"
                            f"🧠 *مؤشر SMC:* `{smc_tag}` 🔥\n"
                            f"🔊 *السيولة:* `{round(vol_ratio, 2)}x` معدل طبيعي\n"
                            f"📊 *مؤشر RSI:* `{round(rsi_val, 1)}`"
                        )
                        await send_telegram_message(target_chat_id, alert_msg)
                        await asyncio.sleep(0.5)

                except Exception as ex:
                    continue

        except Exception:
            pass

        if not is_single_stock:
            await asyncio.sleep(1.5)

    if not is_single_stock:
        await send_telegram_message(target_chat_id, f"✅ اكتمل فحص `{market_type}`. تم العثور على {matches_found} فرصة وتخزينها بقاعدة البيانات.")

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

        if cmd == "/scan":
            if len(parts) > 1:
                ticker = parts[1].upper()
                await send_telegram_message(chat_id, f"🔎 جاري فحص `{ticker}` بشروط SMC...")
                asyncio.create_task(run_scanner_engine(target_stocks=[ticker], target_chat_id=chat_id, market_type="Stock"))
            else:
                await send_telegram_message(chat_id, f"🔎 جاري فحص جميع الأسهم...")
                asyncio.create_task(run_scanner_engine(target_stocks=WATCHLIST, target_chat_id=chat_id, market_type="Stock"))
        
        # أمر جديد لفحص الكريبتو فقط
        elif cmd == "/scan_crypto":
            await send_telegram_message(chat_id, f"🔎 جاري فحص العملات الرقمية (SMC)...")
            asyncio.create_task(run_scanner_engine(target_stocks=CRYPTO_WATCHLIST, target_chat_id=chat_id, market_type="Crypto"))

        # أمر لمعرفة سجل الصفقات المحفوظة
        elif cmd == "/history":
            db = SessionLocal()
            recent_alerts = db.query(AlertRecord).order_by(AlertRecord.id.desc()).limit(5).all()
            db.close()
            
            if recent_alerts:
                msg = "🗄️ *آخر 5 فرص تم رصدها:*\n\n"
                for alert in recent_alerts:
                    msg += f"• `{alert.ticker}` | `${round(alert.price, 2)}` | {alert.market_type}\n"
                await send_telegram_message(chat_id, msg)
            else:
                await send_telegram_message(chat_id, "🗄️ لا توجد فرص مسجلة في قاعدة البيانات بعد.")

    return {"status": "ok"}