"""News service - RSS + LLM sentiment analysis.

Supports two providers (auto-detects based on env vars):
- If ANTHROPIC_API_KEY is set: uses official anthropic SDK (self-hosted mode)
- Else if EMERGENT_LLM_KEY is set: uses emergentintegrations (Emergent platform mode)
"""
from __future__ import annotations
import os
import asyncio
import feedparser
from datetime import datetime, timezone
from typing import Optional

RSS_FEEDS = [
    "https://www.moneycontrol.com/rss/latestnews.xml",
    "https://www.moneycontrol.com/rss/marketreports.xml",
    "https://www.moneycontrol.com/rss/business.xml",
    "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
    "https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms",
]

CLAUDE_MODEL = "claude-sonnet-4-5-20250929"

def _provider():
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "anthropic"
    if os.environ.get("EMERGENT_LLM_KEY"):
        return "emergent"
    return None

async def _llm_call(system: str, user: str, session_id: str = "default") -> str:
    """Provider-agnostic LLM call. Returns text response or empty string on failure."""
    prov = _provider()
    if prov == "anthropic":
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
            # anthropic SDK is sync — run in thread
            def _run():
                msg = client.messages.create(
                    model=CLAUDE_MODEL,
                    max_tokens=1500,
                    system=system,
                    messages=[{"role": "user", "content": user}],
                )
                return msg.content[0].text if msg.content else ""
            return await asyncio.to_thread(_run)
        except Exception as e:
            return ""
    elif prov == "emergent":
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            chat = LlmChat(
                api_key=os.environ["EMERGENT_LLM_KEY"],
                session_id=session_id,
                system_message=system,
            ).with_model("anthropic", CLAUDE_MODEL)
            resp = await chat.send_message(UserMessage(text=user))
            return resp if isinstance(resp, str) else str(resp)
        except Exception as e:
            return ""
    return ""

def fetch_headlines(limit: int = 30) -> list[dict]:
    """Fetch recent headlines from Indian financial RSS feeds."""
    items = []
    for url in RSS_FEEDS:
        try:
            parsed = feedparser.parse(url)
            for entry in parsed.entries[:15]:
                items.append({
                    "title": entry.get("title", ""),
                    "link": entry.get("link", ""),
                    "summary": (entry.get("summary", "") or "")[:400],
                    "published": entry.get("published", ""),
                    "source": parsed.feed.get("title", url),
                })
        except Exception:
            continue
    seen = set()
    unique = []
    for it in items:
        t = it["title"].strip().lower()
        if t and t not in seen:
            seen.add(t)
            unique.append(it)
    return unique[:limit]

async def score_sentiment_batch(headlines: list[dict]) -> list[dict]:
    """Score sentiment for a list of headlines."""
    if not headlines or not _provider():
        return [{**h, "sentiment": "neutral", "score": 50} for h in headlines]

    text = "\n".join(f"{i+1}. {h['title']}" for i, h in enumerate(headlines))
    prompt = f"""Analyze the sentiment of these Indian stock market news headlines.
For each, return: LINE_NUMBER|SENTIMENT|SCORE
where SENTIMENT is one of: positive, neutral, negative
and SCORE is 0-100 (100 most positive).

Ignore hype/clickbait. Focus on real market impact.

Headlines:
{text}

Return ONLY the pipe-delimited lines, no other text."""

    result_text = await _llm_call(
        "You are a financial news sentiment analyst for Indian markets. Be precise and concise.",
        prompt,
        session_id=f"news-batch-{datetime.now(timezone.utc).timestamp()}",
    )
    if not result_text:
        return [{**h, "sentiment": "neutral", "score": 50} for h in headlines]

    mapping = {}
    for line in result_text.strip().split("\n"):
        parts = line.strip().split("|")
        if len(parts) >= 3:
            try:
                idx = int(parts[0].strip()) - 1
                sent = parts[1].strip().lower()
                score = int(float(parts[2].strip()))
                mapping[idx] = (sent, max(0, min(100, score)))
            except Exception:
                continue
    out = []
    for i, h in enumerate(headlines):
        s, sc = mapping.get(i, ("neutral", 50))
        out.append({**h, "sentiment": s, "score": sc})
    return out

def aggregate_sentiment(scored: list[dict]) -> float:
    if not scored:
        return 50.0
    scores = [s["score"] for s in scored if "score" in s]
    return sum(scores) / len(scores) if scores else 50.0

async def stock_specific_analysis(symbol: str, stock_name: str, signal_data: dict) -> str:
    if not _provider():
        return "AI analysis unavailable — set ANTHROPIC_API_KEY or EMERGENT_LLM_KEY."
    prompt = f"""You are a senior equity analyst. Give a concise trade thesis (max 120 words) for this Indian stock buy signal.

Stock: {stock_name} ({symbol})
CMP: ₹{signal_data.get('price')}
Confidence: {signal_data.get('confidence')}/100
Strategy: {signal_data.get('strategy')}
Scores: {signal_data.get('scores')}
Key reasons: {', '.join(signal_data.get('reasons', []))}
Indicators: RSI={signal_data.get('indicators', {}).get('rsi')}, ADX={signal_data.get('indicators', {}).get('adx')}, 1M return={signal_data.get('indicators', {}).get('returns_1m')}%

Explain:
1. Why this is a high-conviction setup (2 sentences)
2. Primary risk (1 sentence)
3. What would invalidate the thesis (1 sentence)

Be direct, no fluff, no disclaimers."""
    resp = await _llm_call(
        "You are a senior Indian equity analyst. Be concise and objective.",
        prompt,
        session_id=f"analysis-{symbol}-{datetime.now(timezone.utc).timestamp()}",
    )
    return resp or "AI analysis unavailable."
