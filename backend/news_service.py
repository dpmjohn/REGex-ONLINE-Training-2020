"""News service - RSS + LLM sentiment analysis via Claude Sonnet 4.5."""
from __future__ import annotations
import os
import asyncio
import feedparser
from datetime import datetime, timezone
from typing import Optional
from emergentintegrations.llm.chat import LlmChat, UserMessage

RSS_FEEDS = [
    "https://www.moneycontrol.com/rss/latestnews.xml",
    "https://www.moneycontrol.com/rss/marketreports.xml",
    "https://www.moneycontrol.com/rss/business.xml",
    "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
    "https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms",
]

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
    # dedupe by title
    seen = set()
    unique = []
    for it in items:
        t = it["title"].strip().lower()
        if t and t not in seen:
            seen.add(t)
            unique.append(it)
    return unique[:limit]

def _key():
    return os.environ.get("EMERGENT_LLM_KEY", "")

async def score_sentiment_batch(headlines: list[dict]) -> list[dict]:
    """Score sentiment for a list of headlines using Claude Sonnet 4.5."""
    if not headlines or not _key():
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

    try:
        chat = LlmChat(
            api_key=_key(),
            session_id=f"news-batch-{datetime.now(timezone.utc).timestamp()}",
            system_message="You are a financial news sentiment analyst for Indian markets. Be precise and concise."
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        response = await chat.send_message(UserMessage(text=prompt))
        result_text = response if isinstance(response, str) else str(response)

        # Parse
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
    except Exception as e:
        return [{**h, "sentiment": "neutral", "score": 50} for h in headlines]

def aggregate_sentiment(scored: list[dict]) -> float:
    """Aggregate news sentiment score (0-100). Weighted mean toward positive/negative."""
    if not scored:
        return 50.0
    scores = [s["score"] for s in scored if "score" in s]
    if not scores:
        return 50.0
    return sum(scores) / len(scores)

async def stock_specific_analysis(symbol: str, stock_name: str, signal_data: dict) -> str:
    """Get Claude to produce a human-readable trade thesis for a stock."""
    if not _key():
        return "AI analysis unavailable."
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
    try:
        chat = LlmChat(
            api_key=_key(),
            session_id=f"analysis-{symbol}-{datetime.now(timezone.utc).timestamp()}",
            system_message="You are a senior Indian equity analyst. Be concise and objective."
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        response = await chat.send_message(UserMessage(text=prompt))
        return response if isinstance(response, str) else str(response)
    except Exception as e:
        return f"AI analysis error: {str(e)[:100]}"
