import { useEffect, useState } from "react";
import { endpoints } from "@/lib/api";
import { SignalCard } from "@/components/SignalCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function Signals() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | high | medium

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await endpoints.signals({ limit: 50 });
      setSignals(data.signals);
    } catch (e) {}
    setLoading(false);
  };
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const filtered = signals.filter(s => {
    if (filter === "high") return s.stars >= 4;
    if (filter === "medium") return s.stars === 3;
    return true;
  });

  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto" data-testid="signals-page">
      <div className="mb-8">
        <div className="text-xs tracking-[0.25em] uppercase text-muted-foreground font-bold">Live Feed</div>
        <h1 className="text-4xl font-heading font-extrabold mt-1">Buy Signals</h1>
        <p className="text-muted-foreground mt-1">Ensemble-scored opportunities across NSE. High-conviction ideas only ({filtered.filter(s => s.stars >= 4).length} of {signals.length}).</p>
      </div>

      <Tabs value={filter} onValueChange={setFilter} className="mb-6">
        <TabsList data-testid="signal-filter-tabs">
          <TabsTrigger value="all" data-testid="filter-all">All ({signals.length})</TabsTrigger>
          <TabsTrigger value="high" data-testid="filter-high">
            High Conviction ({signals.filter(s => s.stars >= 4).length})
          </TabsTrigger>
          <TabsTrigger value="medium" data-testid="filter-medium">
            Medium ({signals.filter(s => s.stars === 3).length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading && signals.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground border-dashed">
          Running initial scan... This takes ~2 min on first load.
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground border-dashed">
          No signals match this filter.
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {filtered.map((s) => (
            <SignalCard key={s.symbol} signal={s} onAddTrade={load} />
          ))}
        </div>
      )}
    </div>
  );
}
