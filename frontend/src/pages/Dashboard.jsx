import { useEffect, useState } from "react";
import { endpoints } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { fmtINR, fmtPct, pnlClass } from "@/lib/format";
import { StarRating } from "@/components/StarRating";
import { Link } from "react-router-dom";
import { TrendUp, TrendDown, Fire, Wallet, ChartLineUp } from "@phosphor-icons/react";

export default function Dashboard() {
  const [signals, setSignals] = useState([]);
  const [portfolio, setPortfolio] = useState({ summary: {}, holdings: [] });
  const [trend, setTrend] = useState({ score: 0, regime: "loading" });
  const [news, setNews] = useState({ aggregate_score: 50 });
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, p, m, n] = await Promise.all([
          endpoints.signals({ min_stars: 3, limit: 6 }),
          endpoints.portfolio(),
          endpoints.marketTrend(),
          endpoints.news(),
        ]);
        setSignals(s.data.signals);
        setLastUpdated(s.data.last_updated);
        setPortfolio(p.data);
        setTrend(m.data);
        setNews(n.data);
      } catch (e) {}
    };
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const summary = portfolio.summary || {};

  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto" data-testid="dashboard-page">
      <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-[0.25em] uppercase text-muted-foreground font-bold">Command Center</div>
          <h1 className="text-4xl sm:text-5xl font-heading font-extrabold tracking-tight mt-1">Good morning, Analyst</h1>
          <p className="text-muted-foreground mt-1">Your AI has scanned {signals.length ? "40+ NSE stocks" : "the market"}. Here's what matters today.</p>
        </div>
        <div className="text-right">
          <div className="text-xs tracking-widest uppercase text-muted-foreground">Market Regime</div>
          <div className={`font-heading text-2xl font-extrabold ${trend.regime?.includes("Bullish") ? "text-success" : trend.regime?.includes("Bearish") ? "text-destructive" : "text-foreground"}`} data-testid="market-regime">
            {trend.regime || "—"}
          </div>
        </div>
      </div>

      {/* North Star Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          testid="metric-portfolio"
          label="Portfolio Value"
          value={fmtINR(summary.current_value || 0, 0)}
          delta={summary.unrealized_pct}
          icon={Wallet}
          primary
        />
        <MetricCard
          testid="metric-pnl"
          label="Total P&L"
          value={fmtINR(summary.total_pnl || 0, 0)}
          delta={null}
          icon={TrendUp}
          valueClass={pnlClass(summary.total_pnl)}
        />
        <MetricCard
          testid="metric-market"
          label="Market Score"
          value={`${Math.round(trend.score || 0)}/100`}
          delta={null}
          icon={ChartLineUp}
        />
        <MetricCard
          testid="metric-signals"
          label="High-Conviction"
          value={signals.filter(s => s.stars >= 4).length}
          delta={null}
          icon={Fire}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top signals compact */}
        <div className="lg:col-span-2">
          <SectionHeader title="Top Buy Signals" subtitle={`Ensemble-scored • ${lastUpdated ? new Date(lastUpdated).toLocaleString("en-IN") : "awaiting scan"}`} />
          <div className="space-y-3">
            {signals.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground border-dashed">
                Scan is running or has no results. Click "Run Scan" in the sidebar to refresh.
              </Card>
            ) : (
              signals.map((s) => (
                <Link to={`/signals?symbol=${s.symbol}`} key={s.symbol} className="block" data-testid={`top-signal-${s.symbol}`}>
                  <Card className="p-4 hover:-translate-y-0.5 transition-transform duration-200 hover:shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <StarRating count={s.stars} size={12} />
                          <Badge variant="secondary" className="rounded-sm text-[10px]">{s.sector}</Badge>
                          <span className="text-[10px] tracking-widest uppercase text-muted-foreground">{s.strategy}</span>
                        </div>
                        <div className="font-heading font-bold">{s.name}</div>
                        <div className="text-xs text-muted-foreground">Buy {fmtINR(s.buy_zone[0], 0)}–{fmtINR(s.buy_zone[1], 0)} • SL {fmtINR(s.stop_loss)} • Tgt {fmtINR(s.target_1)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-heading font-extrabold tabular">{fmtINR(s.price)}</div>
                        <div className="text-xs tabular font-semibold text-primary">{s.confidence}/100</div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-6">
          <div>
            <SectionHeader title="Market Pulse" subtitle="Nifty 50 snapshot" />
            <Card className="p-5">
              <ScoreRow label="Market Trend" value={Math.round(trend.score || 0)} />
              <ScoreRow label="News Sentiment" value={Math.round(news.aggregate_score || 0)} />
              {trend.indicators?.rsi && <ScoreRow label="Nifty RSI" value={Number(trend.indicators.rsi).toFixed(1)} maxVal={100} />}
              {trend.indicators?.adx && <ScoreRow label="Nifty ADX" value={Number(trend.indicators.adx).toFixed(1)} maxVal={80} />}
              {trend.indicators?.returns_1m !== undefined && (
                <div className="flex justify-between items-center pt-2 mt-2 border-t border-border">
                  <span className="text-xs tracking-widest uppercase text-muted-foreground">1M Return</span>
                  <span className={`font-semibold tabular ${pnlClass(trend.indicators.returns_1m)}`}>{fmtPct(trend.indicators.returns_1m)}</span>
                </div>
              )}
            </Card>
          </div>

          <div>
            <SectionHeader title="Portfolio Snapshot" subtitle="Live positions" />
            <Card className="p-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <KV label="Invested" val={fmtINR(summary.invested || 0, 0)} />
                <KV label="Current" val={fmtINR(summary.current_value || 0, 0)} />
                <KV label="Unrealized" val={fmtINR(summary.unrealized_pnl || 0, 0)} cls={pnlClass(summary.unrealized_pnl)} />
                <KV label="Realized" val={fmtINR(summary.realized_pnl || 0, 0)} cls={pnlClass(summary.realized_pnl)} />
                <KV label="Win Rate" val={`${summary.win_rate || 0}%`} />
                <KV label="Positions" val={`${summary.open_positions || 0}`} />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, delta, icon: Icon, valueClass = "", primary = false, testid }) {
  return (
    <Card className={`p-5 ${primary ? "bg-primary text-primary-foreground" : ""}`} data-testid={testid}>
      <div className="flex items-start justify-between mb-3">
        <span className={`text-[10px] tracking-widest uppercase font-bold ${primary ? "opacity-80" : "text-muted-foreground"}`}>{label}</span>
        <Icon size={20} weight="duotone" className={primary ? "opacity-80" : "text-muted-foreground"} />
      </div>
      <div className={`text-3xl font-heading font-extrabold tabular ${valueClass}`}>{value}</div>
      {delta !== null && delta !== undefined && (
        <div className={`text-sm tabular mt-1 ${primary ? "opacity-90" : pnlClass(delta)}`}>{fmtPct(delta)}</div>
      )}
    </Card>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-3">
      <h2 className="font-heading font-bold text-xl">{title}</h2>
      {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
    </div>
  );
}

function ScoreRow({ label, value, maxVal = 100 }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs tracking-widest uppercase text-muted-foreground">{label}</span>
        <span className="font-semibold tabular text-sm">{value}</span>
      </div>
      <Progress value={(value / maxVal) * 100} className="h-1.5" />
    </div>
  );
}

function KV({ label, val, cls = "" }) {
  return (
    <div>
      <div className="text-[10px] tracking-widest uppercase text-muted-foreground">{label}</div>
      <div className={`font-semibold tabular ${cls}`}>{val}</div>
    </div>
  );
}
