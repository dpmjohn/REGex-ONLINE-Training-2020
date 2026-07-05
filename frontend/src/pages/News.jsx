import { useEffect, useState } from "react";
import { endpoints } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowSquareOut } from "@phosphor-icons/react";

export default function News() {
  const [data, setData] = useState({ items: [], aggregate_score: 50 });

  useEffect(() => {
    const load = async () => { try { const { data } = await endpoints.news(); setData(data); } catch (e) {} };
    load(); const t = setInterval(load, 60000); return () => clearInterval(t);
  }, []);

  const sentBadge = (s) => {
    if (s === "positive") return <Badge className="bg-success text-success-foreground rounded-sm">Positive</Badge>;
    if (s === "negative") return <Badge variant="destructive" className="rounded-sm">Negative</Badge>;
    return <Badge variant="secondary" className="rounded-sm">Neutral</Badge>;
  };

  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto" data-testid="news-page">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-[0.25em] uppercase text-muted-foreground font-bold">Market Intelligence</div>
          <h1 className="text-4xl font-heading font-extrabold mt-1">News & Sentiment</h1>
          <p className="text-muted-foreground mt-1">Curated from Moneycontrol & Economic Times. Scored by Claude Sonnet 4.5.</p>
        </div>
        <div className="text-right">
          <div className="text-xs tracking-widest uppercase text-muted-foreground">Aggregate</div>
          <div className={`text-4xl font-heading font-extrabold tabular ${data.aggregate_score >= 60 ? "text-success" : data.aggregate_score <= 40 ? "text-destructive" : "text-foreground"}`}>
            {Math.round(data.aggregate_score)}
          </div>
        </div>
      </div>

      {data.items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground border-dashed">Fetching news...</Card>
      ) : (
        <div className="space-y-3">
          {data.items.map((n, i) => (
            <Card key={i} className="p-4 hover:-translate-y-0.5 transition-transform duration-200 hover:shadow-sm" data-testid={`news-item-${i}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {sentBadge(n.sentiment)}
                    <span className="text-xs text-muted-foreground tabular">Score: {n.score}</span>
                    <span className="text-xs text-muted-foreground">• {n.source}</span>
                  </div>
                  <a href={n.link} target="_blank" rel="noreferrer" className="font-heading font-semibold hover:underline flex items-start gap-1">
                    {n.title} <ArrowSquareOut size={14} className="mt-1 shrink-0" />
                  </a>
                  {n.summary && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{n.summary.replace(/<[^>]+>/g, "")}</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
