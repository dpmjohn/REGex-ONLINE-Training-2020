import { useEffect, useState } from "react";
import { endpoints } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmtINR, fmtPct, pnlClass } from "@/lib/format";
import { toast } from "sonner";
import { ArrowsClockwise, Lightning, Sparkle } from "@phosphor-icons/react";
import { StarRating } from "@/components/StarRating";

export default function Paper() {
  const [data, setData] = useState({ account: {}, stats: {}, holdings: [] });
  const [confirmReset, setConfirmReset] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const load = async () => {
    try { const { data } = await endpoints.paperPortfolio(); setData(data); } catch (e) {}
  };
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, []);

  const reset = async () => {
    try {
      await endpoints.paperReset();
      toast.success("Paper account reset to ₹50,000");
      setConfirmReset(false);
      load();
    } catch { toast.error("Reset failed"); }
  };

  const simulate = async () => {
    setSimulating(true);
    try {
      await endpoints.paperSimulate();
      toast.success("Simulation complete – AI auto-executed high-conviction signals");
      load();
    } catch { toast.error("Simulation failed"); }
    setSimulating(false);
  };

  const closeTrade = async (t) => {
    try {
      await endpoints.paperClose(t.id, t.current_price);
      toast.success(`Closed ${t.symbol}`);
      load();
    } catch { toast.error("Failed to close"); }
  };

  const a = data.account || {};
  const s = data.stats || {};

  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto" data-testid="paper-page">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-[0.25em] uppercase text-muted-foreground font-bold">Paper Trading</div>
          <h1 className="text-4xl font-heading font-extrabold mt-1">Validate Before You Risk Real Money</h1>
          <p className="text-muted-foreground mt-1">
            The AI auto-executes ★★★★+ signals during scheduled scans. Watch the win rate build for 2-4 weeks before committing capital.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={simulate} disabled={simulating} data-testid="simulate-btn">
            <Lightning size={16} weight="fill" /> {simulating ? "Simulating..." : "Simulate Now"}
          </Button>
          <Button variant="destructive" onClick={() => setConfirmReset(true)} data-testid="reset-btn">
            <ArrowsClockwise size={16} /> Reset
          </Button>
        </div>
      </div>

      {/* North Star */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Card className="p-5 bg-primary text-primary-foreground col-span-2 md:col-span-1" data-testid="paper-equity">
          <div className="text-[10px] tracking-widest uppercase font-bold opacity-80">Total Equity</div>
          <div className="text-3xl font-heading font-extrabold tabular mt-1">{fmtINR(a.total_equity || 0, 0)}</div>
          <div className={`text-sm tabular mt-1 opacity-90`}>{fmtPct(a.total_return_pct || 0)}</div>
        </Card>
        <Metric label="Cash" val={fmtINR(a.cash || 0, 0)} />
        <Metric label="Holdings" val={fmtINR(a.current_holdings_value || 0, 0)} />
        <Metric label="Unrealized" val={fmtINR(a.unrealized_pnl || 0, 0)} cls={pnlClass(a.unrealized_pnl)} />
        <Metric label="Realized" val={fmtINR(a.realized_pnl || 0, 0)} cls={pnlClass(a.realized_pnl)} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Metric label="Win Rate" val={`${s.win_rate || 0}%`} />
        <Metric label="Open Positions" val={s.open_positions || 0} />
        <Metric label="Closed Trades" val={s.closed_positions || 0} />
        <Metric label="Profit Factor" val={s.profit_factor ? s.profit_factor.toFixed(2) : "—"} />
      </div>

      {/* How it works banner */}
      <Card className="p-5 mb-6 bg-secondary/50 border-primary/20">
        <div className="flex items-start gap-3">
          <Sparkle size={20} weight="fill" className="text-accent shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-heading font-bold mb-1">How the paper engine works</div>
            <ul className="text-muted-foreground space-y-0.5 list-disc list-inside">
              <li>Every scheduled scan (pre-market, every 15 min live, closing) auto-buys ★★★★+ setups with confidence ≥75 and R:R ≥2</li>
              <li>Position size: min(AI recommendation, 25% of ₹50K, available cash) — max 8 open positions</li>
              <li>Auto-exits when CMP crosses stop-loss or target — logged with reason</li>
              <li>Click "Simulate Now" to force one execution cycle on current signals (useful outside market hours)</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Holdings */}
      <Card className="mb-6">
        <div className="p-5 border-b border-border">
          <div className="font-heading font-bold text-lg">Open Paper Positions</div>
        </div>
        <div className="overflow-x-auto">
          <Table data-testid="paper-holdings-table">
            <TableHeader>
              <TableRow>
                <TableHead>Stock</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Buy</TableHead>
                <TableHead className="text-right">CMP</TableHead>
                <TableHead className="text-right">P&L</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead>SL / Tgt</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.holdings.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No open paper positions yet. Wait for the next scheduled scan or click "Simulate Now".</TableCell></TableRow>
              ) : data.holdings.map(h => (
                <TableRow key={h.id} data-testid={`paper-holding-${h.symbol}`}>
                  <TableCell>
                    <div className="font-semibold">{h.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <StarRating count={h.stars_at_entry || 0} size={10} />
                      {h.strategy}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs tabular">{new Date(h.date).toLocaleDateString("en-IN")}</TableCell>
                  <TableCell className="text-right tabular">{h.quantity}</TableCell>
                  <TableCell className="text-right tabular">{fmtINR(h.price)}</TableCell>
                  <TableCell className="text-right tabular font-semibold">{fmtINR(h.current_price)}</TableCell>
                  <TableCell className={`text-right tabular font-semibold ${pnlClass(h.unrealized_pnl)}`}>{fmtINR(h.unrealized_pnl, 0)}</TableCell>
                  <TableCell className={`text-right tabular font-semibold ${pnlClass(h.unrealized_pct)}`}>{fmtPct(h.unrealized_pct)}</TableCell>
                  <TableCell className="text-xs">
                    <div className="text-destructive tabular">{fmtINR(h.stop_loss)}</div>
                    <div className="text-success tabular">{fmtINR(h.target)}</div>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => closeTrade(h)} data-testid={`paper-close-${h.symbol}`}>Close</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Paper Account?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will delete all paper trades and reset cash to ₹50,000. Your real Portfolio and Trade Journal are not affected.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button variant="destructive" onClick={reset} data-testid="confirm-reset-btn">Reset to ₹50,000</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, val, cls = "" }) {
  return (
    <Card className="p-5">
      <div className="text-[10px] tracking-widest uppercase text-muted-foreground font-bold">{label}</div>
      <div className={`text-2xl font-heading font-extrabold tabular mt-1 ${cls}`}>{val}</div>
    </Card>
  );
}
