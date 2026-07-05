import { useEffect, useState } from "react";
import { endpoints } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { fmtINR, fmtPct, pnlClass } from "@/lib/format";
import { Trash, Plus } from "@phosphor-icons/react";

export default function Watchlist() {
  const [items, setItems] = useState([]);
  const [universe, setUniverse] = useState([]);
  const [signalsMap, setSignalsMap] = useState({});
  const [pick, setPick] = useState("");

  const load = async () => {
    try {
      const [w, u, s] = await Promise.all([endpoints.watchlist(), endpoints.universe(), endpoints.signals({ limit: 100 })]);
      setItems(w.data.items);
      setUniverse(u.data.stocks);
      const map = {};
      s.data.signals.forEach(sig => { map[sig.symbol] = sig; });
      setSignalsMap(map);
    } catch (e) {}
  };
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const add = async () => {
    if (!pick) return;
    try {
      await endpoints.addWatchlist(pick);
      toast.success("Added to watchlist");
      setPick("");
      load();
    } catch { toast.error("Failed to add"); }
  };
  const remove = async (symbol) => {
    try { await endpoints.removeWatchlist(symbol); toast.success("Removed"); load(); } catch {}
  };

  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto" data-testid="watchlist-page">
      <div className="mb-8">
        <div className="text-xs tracking-[0.25em] uppercase text-muted-foreground font-bold">Watchlist</div>
        <h1 className="text-4xl font-heading font-extrabold mt-1">Tracked Stocks</h1>
      </div>

      <Card className="p-5 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[240px]">
            <div className="text-xs tracking-widest uppercase text-muted-foreground font-bold mb-1.5">Add Stock</div>
            <Select value={pick} onValueChange={setPick}>
              <SelectTrigger data-testid="watchlist-select"><SelectValue placeholder="Select stock..." /></SelectTrigger>
              <SelectContent>
                {universe.map(u => <SelectItem key={u.symbol} value={u.symbol}>{u.name} ({u.symbol.replace(".NS", "")}) — {u.sector}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={add} disabled={!pick} data-testid="watchlist-add-btn"><Plus size={16} /> Add</Button>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground border-dashed">Watchlist is empty. Add stocks above.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(it => {
            const s = signalsMap[it.symbol];
            return (
              <Card key={it.id} className="p-5" data-testid={`watch-${it.symbol}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <Badge variant="secondary" className="rounded-sm text-[10px] mb-1">{it.sector}</Badge>
                    <div className="font-heading font-bold">{it.name}</div>
                    <div className="text-xs text-muted-foreground">{it.symbol.replace(".NS", "")}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => remove(it.symbol)} data-testid={`remove-watch-${it.symbol}`}>
                    <Trash size={14} />
                  </Button>
                </div>
                {s ? (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Price</div>
                      <div className="tabular font-bold">{fmtINR(s.price)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Confidence</div>
                      <div className="tabular font-bold text-primary">{s.confidence}/100</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">1M</div>
                      <div className={`tabular ${pnlClass(s.indicators.returns_1m)}`}>{fmtPct(s.indicators.returns_1m)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Strategy</div>
                      <div className="text-xs">{s.strategy}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No signal data yet.</div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
