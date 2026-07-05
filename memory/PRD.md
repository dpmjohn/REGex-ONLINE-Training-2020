# TradeSense AI - PRD

## Original Problem Statement
AI-powered swing/short-term investment assistant for Indian NSE/BSE markets. Continuously scans stocks and produces high-conviction buy opportunities. Ensemble scoring: 30% Technical + 30% Fundamental + 15% Market Trend + 10% News + 10% Institutional + 5% Risk. Monthly capital ₹5,000. Notifications should reach the user; original spec asked WhatsApp.

## User Choices (Feb 2026)
- Market data: yfinance (free, 15-min delayed)
- LLM: Claude Sonnet 4.5 via Emergent Universal Key
- Notifications: in-app + email fallback (WhatsApp deferred)
- Auth: none (single-user)
- News: RSS (Moneycontrol, ET) + Claude sentiment

## Architecture
- Backend: FastAPI + Motor (Mongo). Modules: `analyzer.py` (indicators + ensemble scoring), `news_service.py` (RSS + Claude sentiment), `scheduler.py` (APScheduler IST), `server.py` (39 API routes), `stock_universe.py` (curated NSE list).
- Frontend: React 19 + Shadcn UI + Recharts + Phosphor Icons. Manrope + IBM Plex Sans. Design: Deep Forest Green / off-white "Control Room" grid.
- Auto-scan schedule (IST): 9:00 pre-market, every 15 min 9:15-15:30, 15:30 closing review, Saturday 10:00 deep, first Sunday 9:00 monthly.

## Implemented (2026-02-05)
- 40 NSE stock universe with sector mapping
- Ensemble scoring engine with all 10 strategies (Momentum, Pullback, Institutional, Fundamental Growth, Sector Rotation, Relative Strength, Volume Profile, News Sentiment, Trap Filter, Risk Mgmt)
- Confidence score 0-100 + 5-star rating + strategy classification (Quick Swing / Medium Swing / Positional)
- Trade plan generation: buy zone, ATR-based stop, 2R target 1, 3.5R target 2, position sizing
- Claude-powered per-stock trade thesis (`POST /api/stock/{symbol}/analyze`)
- News RSS + Claude batch sentiment scoring
- Portfolio CRUD with live CMP, unrealized/realized P&L, win rate, avg win/loss
- Watchlist CRUD
- In-app alerts (auto-generated for 4+ star signals during scheduled scans, deduped 24h)
- APScheduler with 5 recurring jobs (IST)
- 8 dashboard pages: Home, Buy Signals, Portfolio, Watchlist, Sector Heatmap, Trade Journal, Performance, News
- All 14+ backend endpoints tested 100% pass (see /app/test_reports/iteration_1.json)

## Backlog / Next Priorities
- P0: Twilio WhatsApp integration (send alerts via WhatsApp Business API)
- P0: Sell signals engine (stop-loss hit / target hit / trend break notifications for open holdings)
- P1: Broker integration (Zerodha Kite one-click order placement)
- P1: Backtesting engine over historical yfinance data
- P1: Paper trading mode
- P2: XGBoost/LSTM ranking layer with learn-from-outcomes
- P2: Tax calculation (STCG/LTCG India)
- P2: SIP suggestions + ETF/MF screening
- P2: Voice assistant + conversational chatbot for trade explanations
