"""TradeSense AI analyzer - ensemble scoring engine.

Ensemble weights:
  Technical: 30%, Fundamental: 30%, Market Trend: 15%,
  News Sentiment: 10%, Institutional Activity: 10%, Risk Mgmt: 5%
"""
from __future__ import annotations
import math
from typing import Optional
import pandas as pd
import numpy as np
import yfinance as yf
from ta.trend import EMAIndicator, MACD, ADXIndicator
from ta.momentum import RSIIndicator
from ta.volatility import AverageTrueRange
from stock_universe import NSE_UNIVERSE, INDEX_SYMBOLS

# --------- Data fetching (cached at module level for one scan cycle) ---------

_cache: dict = {}

def _download(symbol: str, period: str = "1y", interval: str = "1d") -> Optional[pd.DataFrame]:
    key = f"{symbol}:{period}:{interval}"
    if key in _cache:
        return _cache[key]
    try:
        df = yf.download(symbol, period=period, interval=interval, progress=False, auto_adjust=True, threads=False)
        if df is None or df.empty:
            _cache[key] = None
            return None
        # Flatten multiindex if any
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = [c[0] for c in df.columns]
        df = df.dropna()
        _cache[key] = df
        return df
    except Exception:
        _cache[key] = None
        return None

def clear_cache():
    _cache.clear()

# --------- Technical indicators ---------

def compute_indicators(df: pd.DataFrame) -> dict:
    close = df["Close"]
    high = df["High"]
    low = df["Low"]
    volume = df["Volume"]

    ema20 = EMAIndicator(close, window=20).ema_indicator().iloc[-1]
    ema50 = EMAIndicator(close, window=50).ema_indicator().iloc[-1]
    ema200 = EMAIndicator(close, window=200).ema_indicator().iloc[-1] if len(close) >= 200 else None
    rsi = RSIIndicator(close, window=14).rsi().iloc[-1]
    macd_ind = MACD(close)
    macd_line = macd_ind.macd().iloc[-1]
    macd_sig = macd_ind.macd_signal().iloc[-1]
    macd_prev_line = macd_ind.macd().iloc[-2]
    macd_prev_sig = macd_ind.macd_signal().iloc[-2]
    adx = ADXIndicator(high, low, close, window=14).adx().iloc[-1]
    atr = AverageTrueRange(high, low, close, window=14).average_true_range().iloc[-1]
    atr_prev = AverageTrueRange(high, low, close, window=14).average_true_range().iloc[-15] if len(close) >= 30 else atr
    avg_vol_20 = volume.rolling(20).mean().iloc[-1]
    vol_ratio = volume.iloc[-1] / avg_vol_20 if avg_vol_20 > 0 else 1
    price = close.iloc[-1]
    high52 = close.tail(252).max() if len(close) >= 252 else close.max()
    low52 = close.tail(252).min() if len(close) >= 252 else close.min()
    return {
        "price": float(price),
        "ema20": float(ema20),
        "ema50": float(ema50),
        "ema200": float(ema200) if ema200 is not None else None,
        "rsi": float(rsi),
        "macd_line": float(macd_line),
        "macd_signal": float(macd_sig),
        "macd_bullish_cross": bool(macd_line > macd_sig and macd_prev_line <= macd_prev_sig),
        "adx": float(adx),
        "atr": float(atr),
        "atr_increasing": bool(atr > atr_prev),
        "avg_vol_20": float(avg_vol_20),
        "vol_ratio": float(vol_ratio),
        "high_52w": float(high52),
        "low_52w": float(low52),
        "returns_1m": float((price / close.iloc[-22] - 1) * 100) if len(close) >= 22 else 0.0,
        "returns_3m": float((price / close.iloc[-66] - 1) * 100) if len(close) >= 66 else 0.0,
    }

# --------- Scoring components ---------

def technical_score(ind: dict) -> tuple[float, dict]:
    """Returns 0-100 score + breakdown."""
    score = 0
    checks = {}
    # Trend
    if ind["ema200"] and ind["ema50"] > ind["ema200"]:
        score += 15; checks["ema50_above_200"] = True
    else:
        checks["ema50_above_200"] = False
    if ind["price"] > ind["ema50"]:
        score += 15; checks["price_above_ema50"] = True
    else:
        checks["price_above_ema50"] = False
    # Momentum
    rsi = ind["rsi"]
    if 55 <= rsi <= 70:
        score += 15; checks["rsi_healthy"] = True
    elif 40 <= rsi <= 55:
        score += 8; checks["rsi_healthy"] = "pullback"
    elif rsi > 70:
        score += 5; checks["rsi_healthy"] = "overbought"
    else:
        checks["rsi_healthy"] = False
    # MACD
    if ind["macd_bullish_cross"]:
        score += 15; checks["macd_cross"] = True
    elif ind["macd_line"] > ind["macd_signal"]:
        score += 8; checks["macd_cross"] = "positive"
    else:
        checks["macd_cross"] = False
    # ADX (trend strength)
    if ind["adx"] > 25:
        score += 15; checks["adx_strong"] = True
    elif ind["adx"] > 20:
        score += 8; checks["adx_strong"] = "moderate"
    else:
        checks["adx_strong"] = False
    # Volume
    if ind["vol_ratio"] >= 2.0:
        score += 15; checks["volume_spike"] = True
    elif ind["vol_ratio"] >= 1.3:
        score += 8; checks["volume_spike"] = "elevated"
    else:
        checks["volume_spike"] = False
    # ATR increasing (expansion)
    if ind["atr_increasing"]:
        score += 5; checks["atr_expanding"] = True
    else:
        checks["atr_expanding"] = False
    # Near 52w high
    dist_from_high = (ind["high_52w"] - ind["price"]) / ind["high_52w"] * 100
    if dist_from_high < 8:
        score += 5; checks["near_52w_high"] = True
    else:
        checks["near_52w_high"] = False
    return min(score, 100), checks

def fundamental_score(info: dict) -> tuple[float, dict]:
    score = 0
    checks = {}
    # Revenue growth
    rg = info.get("revenueGrowth")
    if rg is not None:
        if rg > 0.15:
            score += 18; checks["revenue_growth"] = f"{rg*100:.1f}%"
        elif rg > 0.08:
            score += 10; checks["revenue_growth"] = f"{rg*100:.1f}% (moderate)"
        else:
            checks["revenue_growth"] = f"{rg*100:.1f}% (weak)"
    # Earnings growth
    eg = info.get("earningsGrowth") or info.get("earningsQuarterlyGrowth")
    if eg is not None:
        if eg > 0.15:
            score += 18; checks["earnings_growth"] = f"{eg*100:.1f}%"
        elif eg > 0:
            score += 10; checks["earnings_growth"] = f"{eg*100:.1f}%"
        else:
            checks["earnings_growth"] = f"{eg*100:.1f}% (negative)"
    # ROE
    roe = info.get("returnOnEquity")
    if roe is not None:
        if roe > 0.18:
            score += 15; checks["roe"] = f"{roe*100:.1f}%"
        elif roe > 0.12:
            score += 8; checks["roe"] = f"{roe*100:.1f}%"
        else:
            checks["roe"] = f"{roe*100:.1f}% (low)"
    # Debt/Equity
    de = info.get("debtToEquity")
    if de is not None:
        de_norm = de / 100 if de > 5 else de
        if de_norm < 0.5:
            score += 15; checks["debt_equity"] = f"{de_norm:.2f}"
        elif de_norm < 1.0:
            score += 8; checks["debt_equity"] = f"{de_norm:.2f}"
        else:
            checks["debt_equity"] = f"{de_norm:.2f} (high)"
    # Operating Margin
    om = info.get("operatingMargins")
    if om is not None:
        if om > 0.18:
            score += 12; checks["operating_margin"] = f"{om*100:.1f}%"
        elif om > 0.10:
            score += 6; checks["operating_margin"] = f"{om*100:.1f}%"
        else:
            checks["operating_margin"] = f"{om*100:.1f}%"
    # Free cash flow
    fcf = info.get("freeCashflow")
    if fcf is not None:
        if fcf > 0:
            score += 12; checks["free_cashflow"] = "positive"
        else:
            checks["free_cashflow"] = "negative"
    # Promoter/Insider holdings proxy
    hp = info.get("heldPercentInsiders")
    if hp is not None and hp > 0.3:
        score += 10; checks["insider_holding"] = f"{hp*100:.1f}%"
    return min(score, 100), checks

def market_trend_score(nifty_ind: dict) -> tuple[float, dict]:
    if not nifty_ind:
        return 50, {"nifty": "unavailable"}
    score = 0
    checks = {}
    if nifty_ind["ema200"] and nifty_ind["price"] > nifty_ind["ema200"]:
        score += 35; checks["nifty_above_200ema"] = True
    if nifty_ind["ema50"] and nifty_ind["price"] > nifty_ind["ema50"]:
        score += 25; checks["nifty_above_50ema"] = True
    if 45 <= nifty_ind["rsi"] <= 70:
        score += 20; checks["nifty_rsi_healthy"] = round(nifty_ind["rsi"], 1)
    if nifty_ind["returns_1m"] > 0:
        score += 20; checks["nifty_1m_positive"] = f"{nifty_ind['returns_1m']:.2f}%"
    return min(score, 100), checks

def institutional_score(info: dict) -> tuple[float, dict]:
    score = 0
    checks = {}
    inst = info.get("heldPercentInstitutions")
    if inst is not None:
        if inst > 0.5:
            score += 50; checks["institutional_holding"] = f"{inst*100:.1f}%"
        elif inst > 0.3:
            score += 30; checks["institutional_holding"] = f"{inst*100:.1f}%"
        elif inst > 0.15:
            score += 15; checks["institutional_holding"] = f"{inst*100:.1f}%"
    # Mkt cap - larger caps get institutional participation
    mc = info.get("marketCap")
    if mc:
        if mc > 500_000_000_000:  # >5000 Cr
            score += 30; checks["market_cap_tier"] = "large-cap"
        elif mc > 100_000_000_000:
            score += 20; checks["market_cap_tier"] = "mid-cap"
        else:
            score += 10; checks["market_cap_tier"] = "small-cap"
    # avg volume liquidity
    av = info.get("averageVolume")
    if av and av > 500_000:
        score += 20; checks["liquidity"] = "good"
    return min(score, 100), checks

def risk_score(ind: dict, info: dict) -> tuple[float, dict]:
    score = 0
    checks = {}
    # ATR as % of price
    atr_pct = ind["atr"] / ind["price"] * 100
    if atr_pct < 3:
        score += 40; checks["volatility"] = f"{atr_pct:.2f}% (low)"
    elif atr_pct < 5:
        score += 25; checks["volatility"] = f"{atr_pct:.2f}% (moderate)"
    else:
        checks["volatility"] = f"{atr_pct:.2f}% (high)"
    # Beta
    beta = info.get("beta")
    if beta is not None:
        if 0.7 <= beta <= 1.3:
            score += 30; checks["beta"] = f"{beta:.2f}"
        else:
            score += 15; checks["beta"] = f"{beta:.2f}"
    # Trap filters: not too low volume, not micro cap
    if info.get("averageVolume") and info["averageVolume"] > 300_000:
        score += 30; checks["liquidity_safe"] = True
    return min(score, 100), checks

# --------- Full analysis pipeline ---------

def analyze_symbol(symbol: str, news_sentiment: float = 50.0, market_trend: dict = None) -> Optional[dict]:
    """Run full ensemble analysis for a symbol."""
    df = _download(symbol, period="1y")
    if df is None or len(df) < 60:
        return None
    try:
        ind = compute_indicators(df)
    except Exception as e:
        return None

    # yfinance ticker.info
    try:
        info = yf.Ticker(symbol).info or {}
    except Exception:
        info = {}

    tech, tech_checks = technical_score(ind)
    fund, fund_checks = fundamental_score(info)
    mkt, mkt_checks = market_trend_score(market_trend or {})
    inst, inst_checks = institutional_score(info)
    risk, risk_checks = risk_score(ind, info)
    # News sentiment external
    news = float(max(0, min(100, news_sentiment)))

    # Ensemble
    composite = (
        0.30 * tech + 0.30 * fund + 0.15 * mkt +
        0.10 * news + 0.10 * inst + 0.05 * risk
    )
    confidence = round(composite, 1)

    # Star rating
    if confidence >= 88:
        stars = 5
    elif confidence >= 78:
        stars = 4
    elif confidence >= 65:
        stars = 3
    elif confidence >= 50:
        stars = 2
    else:
        stars = 1

    # Trade plan
    atr = ind["atr"]
    price = ind["price"]
    sl_atr = price - 2 * atr
    sl_pct = price * 0.92
    stop_loss = round(max(sl_atr, sl_pct), 2)  # tighter of the two (higher SL)
    risk_per_share = price - stop_loss
    target1 = round(price + 2 * risk_per_share, 2)
    target2 = round(price + 3.5 * risk_per_share, 2)
    buy_zone_low = round(price * 0.995, 2)
    buy_zone_high = round(price * 1.01, 2)

    # Strategy classification
    if ind["macd_bullish_cross"] and ind["vol_ratio"] >= 1.5 and ind["adx"] > 25:
        strategy = "Momentum Breakout"
        horizon = "Quick Swing"
        holding_days = "5-15 days"
    elif 40 <= ind["rsi"] <= 52 and ind["ema50"] and ind["price"] > ind["ema50"] * 0.98:
        strategy = "Pullback Entry"
        horizon = "Medium Swing"
        holding_days = "15-45 days"
    elif fund >= 60:
        strategy = "Fundamental Growth"
        horizon = "Positional"
        holding_days = "2-6 months"
    else:
        strategy = "Multi-factor Setup"
        horizon = "Medium Swing"
        holding_days = "15-60 days"

    # Position sizing (base 5000/month)
    max_alloc = 2500  # up to 50% (2 stocks)
    if confidence >= 85:
        alloc = 2500
    elif confidence >= 75:
        alloc = 1500
    else:
        alloc = 1000
    shares = max(1, int(alloc // price))

    # Reasons
    reasons = []
    if tech_checks.get("volume_spike") is True: reasons.append("Volume breakout (>2x avg)")
    if tech_checks.get("macd_cross") is True: reasons.append("MACD bullish crossover")
    if tech_checks.get("ema50_above_200") and tech_checks.get("price_above_ema50"): reasons.append("Strong uptrend structure")
    if tech_checks.get("adx_strong") is True: reasons.append("ADX >25 (strong trend)")
    if tech_checks.get("rsi_healthy") is True: reasons.append("RSI in bullish zone")
    if fund_checks.get("earnings_growth", "").startswith(("1", "2", "3", "4", "5", "6", "7", "8", "9")): 
        if "negative" not in fund_checks.get("earnings_growth", ""):
            reasons.append(f"Earnings growth {fund_checks['earnings_growth']}")
    if fund_checks.get("roe", "").split("%")[0]:
        try:
            roe_val = float(fund_checks["roe"].split("%")[0])
            if roe_val >= 18: reasons.append(f"ROE {fund_checks['roe']}")
        except Exception:
            pass
    if inst_checks.get("institutional_holding"): reasons.append(f"Institutional holding {inst_checks['institutional_holding']}")
    if mkt_checks.get("nifty_above_200ema"): reasons.append("Nifty uptrend intact")
    if news >= 65: reasons.append("Positive news sentiment")
    if not reasons: reasons = ["Multi-factor composite setup"]

    # Traps filter (governance/ASM/GSM proxy via low market cap + high vol)
    mc = info.get("marketCap") or 0
    if mc < 5_000_000_000:  # < 500 Cr
        confidence -= 10  # penalize micro-caps
        if confidence < 0: confidence = 0

    return {
        "symbol": symbol,
        "name": next((s["name"] for s in NSE_UNIVERSE if s["symbol"] == symbol), symbol),
        "sector": next((s["sector"] for s in NSE_UNIVERSE if s["symbol"] == symbol), "Other"),
        "price": round(price, 2),
        "buy_zone": [buy_zone_low, buy_zone_high],
        "stop_loss": stop_loss,
        "target_1": target1,
        "target_2": target2,
        "risk_reward": round((target1 - price) / (price - stop_loss), 2) if (price - stop_loss) > 0 else 0,
        "confidence": round(confidence, 1),
        "stars": stars,
        "strategy": strategy,
        "horizon": horizon,
        "holding_period": holding_days,
        "investment_amount": alloc,
        "shares": shares,
        "risk_level": "Medium" if risk >= 50 else "High",
        "reasons": reasons[:5],
        "scores": {
            "technical": round(tech, 1),
            "fundamental": round(fund, 1),
            "market_trend": round(mkt, 1),
            "news": round(news, 1),
            "institutional": round(inst, 1),
            "risk": round(risk, 1),
        },
        "indicators": {
            "rsi": round(ind["rsi"], 2),
            "macd_bullish": ind["macd_bullish_cross"],
            "adx": round(ind["adx"], 2),
            "volume_ratio": round(ind["vol_ratio"], 2),
            "atr": round(ind["atr"], 2),
            "ema50": round(ind["ema50"], 2),
            "ema200": round(ind["ema200"], 2) if ind["ema200"] else None,
            "returns_1m": round(ind["returns_1m"], 2),
            "returns_3m": round(ind["returns_3m"], 2),
            "high_52w": round(ind["high_52w"], 2),
            "low_52w": round(ind["low_52w"], 2),
        },
        "checks": {
            "technical": tech_checks,
            "fundamental": fund_checks,
            "market_trend": mkt_checks,
            "institutional": inst_checks,
            "risk": risk_checks,
        }
    }

def analyze_market_trend() -> dict:
    df = _download(INDEX_SYMBOLS["NIFTY50"], period="1y")
    if df is None or len(df) < 60:
        return {}
    return compute_indicators(df)
