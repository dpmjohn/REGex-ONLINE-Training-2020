"""TradeSense AI - Backend API."""
from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from stock_universe import NSE_UNIVERSE, get_symbols, get_stock_info
from analyzer import analyze_symbol, analyze_market_trend, clear_cache, _download, compute_indicators
from news_service import fetch_headlines, score_sentiment_batch, aggregate_sentiment, stock_specific_analysis
from scheduler import ScanScheduler

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="TradeSense AI")
api_router = APIRouter(prefix="/api")

# ---------- Models ----------

class Trade(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    symbol: str
    name: str
    action: str  # BUY / SELL
    quantity: int
    price: float
    stop_loss: Optional[float] = None
    target: Optional[float] = None
    strategy: Optional[str] = None
    horizon: Optional[str] = None
    notes: Optional[str] = None
    date: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    status: str = "open"  # open / closed
    exit_price: Optional[float] = None
    exit_date: Optional[str] = None
    pnl: Optional[float] = None
    pnl_pct: Optional[float] = None

class TradeCreate(BaseModel):
    symbol: str
    name: Optional[str] = None
    action: str = "BUY"
    quantity: int
    price: float
    stop_loss: Optional[float] = None
    target: Optional[float] = None
    strategy: Optional[str] = None
    horizon: Optional[str] = None
    notes: Optional[str] = None

class TradeClose(BaseModel):
    exit_price: float
    notes: Optional[str] = None

class WatchlistItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    symbol: str
    name: str
    sector: str
    added: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class WatchlistAdd(BaseModel):
    symbol: str

# ---------- In-memory scan cache ----------

class ScanCache:
    def __init__(self):
        self.signals: list = []
        self.market_trend: dict = {}
        self.news: list = []
        self.news_score: float = 50.0
        self.last_updated: Optional[str] = None
        self.status: str = "idle"  # idle | scanning | ready | error

    def to_dict(self):
        return {
            "signals": self.signals,
            "market_trend": self.market_trend,
            "news": self.news,
            "news_score": self.news_score,
            "last_updated": self.last_updated,
            "status": self.status,
        }

scan_cache = ScanCache()

# ---------- Notifications after scan ----------

async def emit_alerts(label: str):
    """After a scan, persist alerts for new 4+ star high-conviction signals."""
    hi = [s for s in scan_cache.signals if s["stars"] >= 4 and s["confidence"] >= 75 and s["risk_reward"] >= 2.0]
    for s in hi:
        # Dedupe: don't re-alert the same symbol within 24h
        recent = await db.alerts.find_one({
            "symbol": s["symbol"],
            "created_at": {"$gt": (datetime.now(timezone.utc).timestamp() - 24 * 3600)}
        })
        if recent:
            continue
        alert = {
            "id": str(uuid.uuid4()),
            "symbol": s["symbol"],
            "name": s["name"],
            "trigger": label,
            "price": s["price"],
            "stop_loss": s["stop_loss"],
            "target_1": s["target_1"],
            "confidence": s["confidence"],
            "stars": s["stars"],
            "strategy": s["strategy"],
            "reasons": s["reasons"],
            "investment_amount": s["investment_amount"],
            "shares": s["shares"],
            "holding_period": s["holding_period"],
            "created_at": datetime.now(timezone.utc).timestamp(),
            "created_iso": datetime.now(timezone.utc).isoformat(),
            "read": False,
        }
        await db.alerts.insert_one(alert)
        logger.info(f"[Alert] {s['symbol']} conf={s['confidence']} stars={s['stars']} trigger={label}")

scheduler = ScanScheduler(scan_fn=lambda: run_scan(), notify_fn=emit_alerts)

# ---------- Scan pipeline ----------

async def run_scan(symbols: Optional[list] = None):
    """Run full scan: fetch news, compute market trend, analyze each stock."""
    scan_cache.status = "scanning"
    try:
        clear_cache()
        # 1) News + sentiment
        headlines = fetch_headlines(20)
        scored = await score_sentiment_batch(headlines)
        news_score = aggregate_sentiment(scored)
        scan_cache.news = scored
        scan_cache.news_score = news_score

        # 2) Market trend
        market_trend = await asyncio.to_thread(analyze_market_trend)
        scan_cache.market_trend = market_trend

        # 3) Analyze each stock (in threadpool since yfinance is sync)
        target_symbols = symbols or get_symbols()
        results = []
        for sym in target_symbols:
            try:
                res = await asyncio.to_thread(analyze_symbol, sym, news_score, market_trend)
                if res:
                    results.append(res)
            except Exception as e:
                logger.warning(f"Analyze failed for {sym}: {e}")
        # Sort by confidence
        results.sort(key=lambda x: x["confidence"], reverse=True)
        scan_cache.signals = results
        scan_cache.last_updated = datetime.now(timezone.utc).isoformat()
        scan_cache.status = "ready"
    except Exception as e:
        scan_cache.status = "error"
        logger.exception(f"Scan failed: {e}")

# ---------- Routes ----------

@api_router.get("/")
async def root():
    return {"message": "TradeSense AI API"}

@api_router.get("/scan/status")
async def scan_status():
    return {
        "status": scan_cache.status,
        "last_updated": scan_cache.last_updated,
        "count": len(scan_cache.signals),
    }

@api_router.post("/scan/run")
async def trigger_scan(background: BackgroundTasks):
    if scan_cache.status == "scanning":
        return {"status": "already_scanning"}
    background.add_task(run_scan)
    return {"status": "started"}

@api_router.get("/signals")
async def get_signals(min_stars: int = 0, limit: int = 50):
    signals = [s for s in scan_cache.signals if s["stars"] >= min_stars]
    return {
        "signals": signals[:limit],
        "last_updated": scan_cache.last_updated,
        "market_trend_score": _market_trend_score(),
    }

@api_router.get("/signals/high-conviction")
async def high_conviction():
    """Only 4+ star signals with confidence >= 75 and RR >= 2."""
    signals = [
        s for s in scan_cache.signals
        if s["stars"] >= 4 and s["confidence"] >= 75 and s["risk_reward"] >= 2.0
    ]
    return {"signals": signals, "last_updated": scan_cache.last_updated}

@api_router.get("/stock/{symbol}")
async def stock_detail(symbol: str):
    # search cache first
    for s in scan_cache.signals:
        if s["symbol"] == symbol:
            return s
    # else compute on the fly
    result = await asyncio.to_thread(analyze_symbol, symbol, scan_cache.news_score, scan_cache.market_trend)
    if not result:
        raise HTTPException(404, "Stock not found or data unavailable")
    return result

@api_router.post("/stock/{symbol}/analyze")
async def stock_ai_analysis(symbol: str):
    """Get Claude-generated trade thesis."""
    signal = None
    for s in scan_cache.signals:
        if s["symbol"] == symbol:
            signal = s
            break
    if not signal:
        signal = await asyncio.to_thread(analyze_symbol, symbol, scan_cache.news_score, scan_cache.market_trend)
    if not signal:
        raise HTTPException(404, "Stock data unavailable")
    analysis = await stock_specific_analysis(symbol, signal["name"], signal)
    return {"symbol": symbol, "analysis": analysis, "signal": signal}

@api_router.get("/market/heatmap")
async def market_heatmap():
    """Sector heatmap based on cached signals."""
    if not scan_cache.signals:
        return {"sectors": [], "stocks": []}
    sector_map = {}
    for s in scan_cache.signals:
        sec = s["sector"]
        if sec not in sector_map:
            sector_map[sec] = {"sector": sec, "stocks": [], "avg_score": 0, "avg_return_1m": 0}
        sector_map[sec]["stocks"].append({
            "symbol": s["symbol"],
            "name": s["name"],
            "confidence": s["confidence"],
            "return_1m": s["indicators"]["returns_1m"],
            "price": s["price"],
        })
    for sec in sector_map.values():
        n = len(sec["stocks"])
        sec["avg_score"] = round(sum(x["confidence"] for x in sec["stocks"]) / n, 1)
        sec["avg_return_1m"] = round(sum(x["return_1m"] for x in sec["stocks"]) / n, 2)
        sec["count"] = n
    sectors = sorted(sector_map.values(), key=lambda x: x["avg_score"], reverse=True)
    return {"sectors": sectors, "last_updated": scan_cache.last_updated}

@api_router.get("/market/trend")
async def market_trend():
    ind = scan_cache.market_trend
    return {
        "indicators": ind,
        "score": _market_trend_score(),
        "regime": _market_regime(ind),
    }

def _market_trend_score() -> float:
    ind = scan_cache.market_trend
    if not ind:
        return 50.0
    from analyzer import market_trend_score as mts
    s, _ = mts(ind)
    return s

def _market_regime(ind: dict) -> str:
    if not ind:
        return "unknown"
    if ind.get("ema200") and ind["price"] > ind["ema200"] and ind["price"] > ind["ema50"]:
        if ind["rsi"] > 70:
            return "Bullish - Overheated"
        return "Bullish"
    if ind.get("ema200") and ind["price"] < ind["ema200"]:
        return "Bearish"
    return "Sideways"

# ----- News -----

@api_router.get("/news")
async def news():
    return {
        "items": scan_cache.news,
        "aggregate_score": round(scan_cache.news_score, 1),
        "last_updated": scan_cache.last_updated,
    }

# ----- Watchlist -----

@api_router.get("/watchlist")
async def get_watchlist():
    items = await db.watchlist.find({}, {"_id": 0}).to_list(200)
    return {"items": items}

@api_router.post("/watchlist")
async def add_watchlist(item: WatchlistAdd):
    info = get_stock_info(item.symbol)
    if not info:
        raise HTTPException(404, "Symbol not in universe")
    existing = await db.watchlist.find_one({"symbol": item.symbol})
    if existing:
        return {"status": "exists"}
    wi = WatchlistItem(symbol=item.symbol, name=info["name"], sector=info["sector"])
    await db.watchlist.insert_one(wi.model_dump())
    return {"status": "added", "item": wi.model_dump()}

@api_router.delete("/watchlist/{symbol}")
async def remove_watchlist(symbol: str):
    await db.watchlist.delete_one({"symbol": symbol})
    return {"status": "removed"}

# ----- Portfolio / Trades -----

@api_router.get("/trades")
async def list_trades(status: Optional[str] = None):
    q = {"status": status} if status else {}
    trades = await db.trades.find(q, {"_id": 0}).sort("date", -1).to_list(500)
    return {"trades": trades}

@api_router.post("/trades")
async def create_trade(t: TradeCreate):
    info = get_stock_info(t.symbol)
    name = t.name or (info["name"] if info else t.symbol)
    trade = Trade(
        symbol=t.symbol, name=name, action=t.action, quantity=t.quantity, price=t.price,
        stop_loss=t.stop_loss, target=t.target, strategy=t.strategy, horizon=t.horizon,
        notes=t.notes
    )
    await db.trades.insert_one(trade.model_dump())
    return {"trade": trade.model_dump()}

@api_router.post("/trades/{trade_id}/close")
async def close_trade(trade_id: str, close: TradeClose):
    trade = await db.trades.find_one({"id": trade_id}, {"_id": 0})
    if not trade:
        raise HTTPException(404, "Trade not found")
    if trade["status"] == "closed":
        raise HTTPException(400, "Already closed")
    pnl = (close.exit_price - trade["price"]) * trade["quantity"]
    pnl_pct = (close.exit_price / trade["price"] - 1) * 100
    update = {
        "status": "closed",
        "exit_price": close.exit_price,
        "exit_date": datetime.now(timezone.utc).isoformat(),
        "pnl": round(pnl, 2),
        "pnl_pct": round(pnl_pct, 2),
    }
    if close.notes:
        update["notes"] = (trade.get("notes") or "") + " | " + close.notes
    await db.trades.update_one({"id": trade_id}, {"$set": update})
    trade.update(update)
    return {"trade": trade}

@api_router.delete("/trades/{trade_id}")
async def delete_trade(trade_id: str):
    await db.trades.delete_one({"id": trade_id})
    return {"status": "removed"}

@api_router.get("/portfolio")
async def portfolio():
    """Compute portfolio metrics from open + closed trades."""
    trades = await db.trades.find({}, {"_id": 0}).to_list(1000)
    open_trades = [t for t in trades if t["status"] == "open"]
    closed_trades = [t for t in trades if t["status"] == "closed"]

    # Current prices for open trades
    holdings = []
    invested = 0.0
    current_value = 0.0
    unrealized = 0.0
    for t in open_trades:
        cmp_price = t["price"]
        for s in scan_cache.signals:
            if s["symbol"] == t["symbol"]:
                cmp_price = s["price"]
                break
        cost = t["price"] * t["quantity"]
        value = cmp_price * t["quantity"]
        pnl = value - cost
        invested += cost
        current_value += value
        unrealized += pnl
        holdings.append({
            **t,
            "current_price": round(cmp_price, 2),
            "current_value": round(value, 2),
            "unrealized_pnl": round(pnl, 2),
            "unrealized_pct": round((cmp_price / t["price"] - 1) * 100, 2),
        })

    realized = sum(t.get("pnl", 0) for t in closed_trades)
    total_closed_cost = sum(t["price"] * t["quantity"] for t in closed_trades)
    wins = [t for t in closed_trades if (t.get("pnl") or 0) > 0]
    losses = [t for t in closed_trades if (t.get("pnl") or 0) <= 0]
    win_rate = round(len(wins) / len(closed_trades) * 100, 1) if closed_trades else 0
    avg_win = round(sum(t["pnl"] for t in wins) / len(wins), 2) if wins else 0
    avg_loss = round(sum(t["pnl"] for t in losses) / len(losses), 2) if losses else 0

    return {
        "holdings": holdings,
        "summary": {
            "invested": round(invested, 2),
            "current_value": round(current_value, 2),
            "unrealized_pnl": round(unrealized, 2),
            "unrealized_pct": round(unrealized / invested * 100, 2) if invested else 0,
            "realized_pnl": round(realized, 2),
            "total_pnl": round(unrealized + realized, 2),
            "open_positions": len(open_trades),
            "closed_positions": len(closed_trades),
            "win_rate": win_rate,
            "avg_win": avg_win,
            "avg_loss": avg_loss,
            "profit_factor": round(sum(t["pnl"] for t in wins) / abs(sum(t["pnl"] for t in losses)), 2) if losses and sum(t["pnl"] for t in losses) != 0 else None,
        }
    }

# ----- Universe -----

@api_router.get("/universe")
async def universe():
    return {"stocks": NSE_UNIVERSE}

# ----- Alerts (in-app notifications) -----

@api_router.get("/alerts")
async def list_alerts(unread_only: bool = False, limit: int = 50):
    q = {"read": False} if unread_only else {}
    items = await db.alerts.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    unread_count = await db.alerts.count_documents({"read": False})
    return {"alerts": items, "unread_count": unread_count}

@api_router.post("/alerts/{alert_id}/read")
async def mark_alert_read(alert_id: str):
    await db.alerts.update_one({"id": alert_id}, {"$set": {"read": True}})
    return {"status": "ok"}

@api_router.post("/alerts/read-all")
async def mark_all_read():
    await db.alerts.update_many({"read": False}, {"$set": {"read": True}})
    return {"status": "ok"}

# ----- Scheduler status -----

@api_router.get("/scheduler/status")
async def scheduler_status():
    return scheduler.get_status()

# ----- Startup / Include router -----

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    logger.info("TradeSense AI backend starting - kicking off initial scan in background")
    asyncio.create_task(run_scan())
    scheduler.start()

@app.on_event("shutdown")
async def shutdown_db_client():
    scheduler.shutdown()
    client.close()
