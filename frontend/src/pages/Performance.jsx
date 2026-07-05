import { useEffect, useState } from "react";
import { endpoints } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { fmtINR, fmtPct, pnlClass } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from "recharts";

export default function Performance() {
  const [portfolio, setPortfolio] = useState({ summary: {}, holdings: [] });
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [p, t] = await Promise.all([endpoints.portfolio(), endpoints.trades()]);
        setPortfolio(p.data); setTrades(t.data.trades);
      } catch (e) {}
    };
    load();
  }, []);

  const closed = trades.filter(t => t.status === "closed").sort((a, b) => new Date(a.exit_date) - new Date(b.exit_date));
  let cum = 0;
  const equity = closed.map(t => { cum += (t.pnl || 0); return { date: new Date(t.exit_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), pnl: cum, tradePnl: t.pnl }; });

  const s = portfolio.summary;

  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto" data-testid="performance-page">
      <div className="mb-8">
        <div className="text-xs tracking-[0.25em] uppercase text-muted-foreground font-bold">Performance</div>
        <h1 className="text-4xl font-heading font-extrabold mt-1">Track Your Edge</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Metric label="Win Rate" val={`${s.win_rate || 0}%`} />
        <Metric label="Profit Factor" val={s.profit_factor ? s.profit_factor.toFixed(2) : "—"} />
        <Metric label="Avg Win" val={fmtINR(s.avg_win || 0, 0)} cls="text-success" />
        <Metric label="Avg Loss" val={fmtINR(s.avg_loss || 0, 0)} cls="text-destructive" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="font-heading font-bold text-lg mb-4">Cumulative P&L</div>
          {equity.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 border border-dashed border-border rounded-sm">Close a trade to see the curve.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={equity}>
                <CartesianGrid stroke="hsl(60 10% 88%)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(0 0% 100%)", border: "1px solid hsl(60 10% 88%)", borderRadius: 4 }} />
                <Line type="monotone" dataKey="pnl" stroke="hsl(127 34% 18%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5">
          <div className="font-heading font-bold text-lg mb-4">Per-Trade P&L</div>
          {equity.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 border border-dashed border-border rounded-sm">No closed trades yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={equity}>
                <CartesianGrid stroke="hsl(60 10% 88%)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(0 0% 100%)", border: "1px solid hsl(60 10% 88%)", borderRadius: 4 }} />
                <Bar dataKey="tradePnl" fill="hsl(127 34% 18%)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, val, cls = "" }) {
  return (
    <Card className="p-5">
      <div className="text-[10px] tracking-widest uppercase text-muted-foreground font-bold">{label}</div>
      <div className={`text-3xl font-heading font-extrabold tabular mt-1 ${cls}`}>{val}</div>
    </Card>
  );
}
