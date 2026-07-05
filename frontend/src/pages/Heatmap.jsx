import { useEffect, useState } from "react";
import { endpoints } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtPct, pnlClass } from "@/lib/format";

export default function Heatmap() {
  const [data, setData] = useState({ sectors: [] });

  useEffect(() => {
    const load = async () => {
      try { const { data } = await endpoints.heatmap(); setData(data); } catch (e) {}
    };
    load(); const t = setInterval(load, 30000); return () => clearInterval(t);
  }, []);

  const heatColor = (ret) => {
    // Off-white to success green (positive) or destructive (negative)
    if (ret > 5) return "bg-success text-success-foreground";
    if (ret > 2) return "bg-success/70 text-success-foreground";
    if (ret > 0) return "bg-success/30";
    if (ret > -2) return "bg-destructive/20";
    if (ret > -5) return "bg-destructive/50 text-destructive-foreground";
    return "bg-destructive text-destructive-foreground";
  };

  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto" data-testid="heatmap-page">
      <div className="mb-8">
        <div className="text-xs tracking-[0.25em] uppercase text-muted-foreground font-bold">Market Heatmap</div>
        <h1 className="text-4xl font-heading font-extrabold mt-1">Sector Rotation</h1>
        <p className="text-muted-foreground mt-1">Ranked by average 1-month performance & confidence score.</p>
      </div>

      {data.sectors.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground border-dashed">Awaiting scan data...</Card>
      ) : (
        <div className="space-y-6">
          {data.sectors.map(sec => (
            <div key={sec.sector} data-testid={`heatmap-sector-${sec.sector}`}>
              <div className="flex items-baseline justify-between mb-2">
                <div>
                  <h3 className="font-heading font-bold text-lg">{sec.sector}</h3>
                  <div className="text-xs text-muted-foreground">{sec.count} stocks • avg confidence {sec.avg_score}</div>
                </div>
                <div className={`tabular font-bold text-lg ${pnlClass(sec.avg_return_1m)}`}>{fmtPct(sec.avg_return_1m)}</div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {sec.stocks.map(st => (
                  <div key={st.symbol} className={`heatmap-cell p-3 rounded-sm border border-border ${heatColor(st.return_1m)}`} data-testid={`heatmap-cell-${st.symbol}`}>
                    <div className="text-xs font-semibold truncate">{st.symbol.replace(".NS", "")}</div>
                    <div className="text-xs opacity-80 truncate">{st.name}</div>
                    <div className="text-lg font-heading font-extrabold tabular mt-1">{fmtPct(st.return_1m)}</div>
                    <div className="text-[10px] opacity-70 tabular">Conf {st.confidence}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
