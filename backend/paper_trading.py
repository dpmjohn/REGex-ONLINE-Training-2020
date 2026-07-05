"""Paper trading engine - virtual portfolio for validating signals before real money.

Starting capital: ₹50,000 (configurable).
Auto-executes ★★★★+ signals from scheduled scans (dedupe 24h).
Same close mechanics as real trades.
"""
from __future__ import annotations
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)

STARTING_CAPITAL = 50000.0
MAX_POSITIONS = 8
MAX_PER_POSITION = 12500.0  # 25% of 50K

async def get_or_init_account(db):
    acct = await db.paper_account.find_one({"id": "default"}, {"_id": 0})
    if not acct:
        acct = {
            "id": "default",
            "starting_capital": STARTING_CAPITAL,
            "cash": STARTING_CAPITAL,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.paper_account.insert_one(acct)
    return acct

async def reset_account(db):
    await db.paper_account.delete_one({"id": "default"})
    await db.paper_trades.delete_many({})
    return await get_or_init_account(db)

async def auto_execute_signal(db, signal: dict) -> bool:
    """Attempt to buy a high-conviction signal in the paper portfolio."""
    acct = await get_or_init_account(db)
    open_count = await db.paper_trades.count_documents({"status": "open"})
    if open_count >= MAX_POSITIONS:
        return False
    # Dedupe: don't buy same symbol if we already hold it open
    existing = await db.paper_trades.find_one({"symbol": signal["symbol"], "status": "open"})
    if existing:
        return False
    # Position size: min(signal recommendation, MAX_PER_POSITION, available cash)
    target_amount = min(signal["investment_amount"], MAX_PER_POSITION, acct["cash"])
    if target_amount < signal["price"]:
        return False  # not enough cash for 1 share
    shares = int(target_amount // signal["price"])
    if shares < 1:
        return False
    cost = shares * signal["price"]
    trade = {
        "id": str(uuid.uuid4()),
        "symbol": signal["symbol"],
        "name": signal["name"],
        "action": "BUY",
        "quantity": shares,
        "price": signal["price"],
        "stop_loss": signal["stop_loss"],
        "target": signal["target_1"],
        "strategy": signal["strategy"],
        "horizon": signal["horizon"],
        "confidence_at_entry": signal["confidence"],
        "stars_at_entry": signal["stars"],
        "notes": f"Auto-executed by AI • {', '.join(signal['reasons'][:3])}",
        "date": datetime.now(timezone.utc).isoformat(),
        "status": "open",
        "exit_price": None,
        "exit_date": None,
        "pnl": None,
        "pnl_pct": None,
    }
    await db.paper_trades.insert_one(trade)
    await db.paper_account.update_one({"id": "default"}, {"$inc": {"cash": -cost}})
    logger.info(f"[Paper] Bought {shares} {signal['symbol']} @ {signal['price']} = {cost:.2f} • cash left {acct['cash'] - cost:.2f}")
    return True

async def close_paper_trade(db, trade_id: str, exit_price: float):
    trade = await db.paper_trades.find_one({"id": trade_id}, {"_id": 0})
    if not trade or trade["status"] == "closed":
        return None
    pnl = (exit_price - trade["price"]) * trade["quantity"]
    pnl_pct = (exit_price / trade["price"] - 1) * 100
    proceeds = exit_price * trade["quantity"]
    update = {
        "status": "closed",
        "exit_price": exit_price,
        "exit_date": datetime.now(timezone.utc).isoformat(),
        "pnl": round(pnl, 2),
        "pnl_pct": round(pnl_pct, 2),
    }
    await db.paper_trades.update_one({"id": trade_id}, {"$set": update})
    await db.paper_account.update_one({"id": "default"}, {"$inc": {"cash": proceeds}})
    trade.update(update)
    return trade

async def evaluate_exits(db, signals_by_symbol: dict) -> list:
    """Check open paper trades for stop-loss / target hits."""
    open_trades = await db.paper_trades.find({"status": "open"}, {"_id": 0}).to_list(100)
    closed = []
    for t in open_trades:
        sig = signals_by_symbol.get(t["symbol"])
        if not sig:
            continue
        cmp_price = sig["price"]
        reason = None
        if t.get("stop_loss") and cmp_price <= t["stop_loss"]:
            reason = "Stop-loss hit"
            exit_price = t["stop_loss"]
        elif t.get("target") and cmp_price >= t["target"]:
            reason = "Target reached"
            exit_price = t["target"]
        if reason:
            result = await close_paper_trade(db, t["id"], exit_price)
            if result:
                result["auto_exit_reason"] = reason
                closed.append(result)
                logger.info(f"[Paper] Auto-exit {t['symbol']}: {reason} @ {exit_price}")
    return closed

async def portfolio_summary(db, signals_by_symbol: dict) -> dict:
    acct = await get_or_init_account(db)
    trades = await db.paper_trades.find({}, {"_id": 0}).to_list(1000)
    open_trades = [t for t in trades if t["status"] == "open"]
    closed_trades = [t for t in trades if t["status"] == "closed"]

    invested = sum(t["price"] * t["quantity"] for t in open_trades)
    current_value = 0.0
    unrealized = 0.0
    holdings = []
    for t in open_trades:
        sig = signals_by_symbol.get(t["symbol"])
        cmp_price = sig["price"] if sig else t["price"]
        val = cmp_price * t["quantity"]
        cost = t["price"] * t["quantity"]
        pnl = val - cost
        current_value += val
        unrealized += pnl
        holdings.append({
            **t,
            "current_price": round(cmp_price, 2),
            "current_value": round(val, 2),
            "unrealized_pnl": round(pnl, 2),
            "unrealized_pct": round((cmp_price / t["price"] - 1) * 100, 2),
        })

    realized = sum(t.get("pnl", 0) or 0 for t in closed_trades)
    wins = [t for t in closed_trades if (t.get("pnl") or 0) > 0]
    losses = [t for t in closed_trades if (t.get("pnl") or 0) <= 0]
    win_rate = round(len(wins) / len(closed_trades) * 100, 1) if closed_trades else 0
    total_equity = acct["cash"] + current_value
    total_return_pct = round((total_equity / acct["starting_capital"] - 1) * 100, 2)

    return {
        "account": {
            "starting_capital": acct["starting_capital"],
            "cash": round(acct["cash"], 2),
            "invested": round(invested, 2),
            "current_holdings_value": round(current_value, 2),
            "total_equity": round(total_equity, 2),
            "unrealized_pnl": round(unrealized, 2),
            "realized_pnl": round(realized, 2),
            "total_return_pct": total_return_pct,
            "created_at": acct.get("created_at"),
        },
        "stats": {
            "open_positions": len(open_trades),
            "closed_positions": len(closed_trades),
            "win_rate": win_rate,
            "avg_win": round(sum(t["pnl"] for t in wins) / len(wins), 2) if wins else 0,
            "avg_loss": round(sum(t["pnl"] for t in losses) / len(losses), 2) if losses else 0,
            "profit_factor": round(sum(t["pnl"] for t in wins) / abs(sum(t["pnl"] for t in losses)), 2) if losses and sum(t["pnl"] for t in losses) != 0 else None,
        },
        "holdings": holdings,
    }
