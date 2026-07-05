import { useEffect, useState } from "react";
import { endpoints } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { fmtINR, fmtPct, pnlClass } from "@/lib/format";
import { toast } from "sonner";
import { XCircle } from "@phosphor-icons/react";

export default function Portfolio() {
  const [data, setData] = useState({ holdings: [], summary: {} });
  const [closeTarget, setCloseTarget] = useState(null);
  const [exitPrice, setExitPrice] = useState("");

  const load = async () => {
    try {
      const { data } = await endpoints.portfolio();
      setData(data);
    } catch (e) {}
  };
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, []);

  const openClose = (h) => { setCloseTarget(h); setExitPrice(h.current_price); };
  const submitClose = async () => {
    try {
      await endpoints.closeTrade(closeTarget.id, parseFloat(exitPrice));
      toast.success(`Closed ${closeTarget.symbol}`);
      setCloseTarget(null);
      load();
    } catch (e) {
      toast.error("Failed to close trade");
    }
  };

  const s = data.summary;
  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto" data-testid="portfolio-page">
      <div className="mb-8">
        <div className="text-xs tracking-[0.25em] uppercase text-muted-foreground font-bold">Portfolio</div>
        <h1 className="text-4xl font-heading font-extrabold mt-1">Holdings & P&amp;L</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Metric label="Invested" val={fmtINR(s.invested, 0)} />
        <Metric label="Current Value" val={fmtINR(s.current_value, 0)} />
        <Metric label="Unrealized P&L" val={fmtINR(s.unrealized_pnl, 0)} cls={pnlClass(s.unrealized_pnl)} sub={fmtPct(s.unrealized_pct)} />
        <Metric label="Realized P&L" val={fmtINR(s.realized_pnl, 0)} cls={pnlClass(s.realized_pnl)} />
      </div>

      <Card className="mb-8">
        <div className="overflow-x-auto">
          <Table data-testid="holdings-table">
            <TableHeader>
              <TableRow>
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Avg Buy</TableHead>
                <TableHead className="text-right">CMP</TableHead>
                <TableHead className="text-right">Invested</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">P&L</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead>SL</TableHead>
                <TableHead>Target</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.holdings.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No open positions. Add from Buy Signals.</TableCell></TableRow>
              ) : data.holdings.map((h) => (
                <TableRow key={h.id} data-testid={`holding-${h.symbol}`}>
                  <TableCell>
                    <div className="font-semibold">{h.name}</div>
                    <div className="text-xs text-muted-foreground">{h.symbol.replace(".NS", "")} • {h.strategy}</div>
                  </TableCell>
                  <TableCell className="text-right tabular">{h.quantity}</TableCell>
                  <TableCell className="text-right tabular">{fmtINR(h.price)}</TableCell>
                  <TableCell className="text-right tabular font-semibold">{fmtINR(h.current_price)}</TableCell>
                  <TableCell className="text-right tabular">{fmtINR(h.price * h.quantity, 0)}</TableCell>
                  <TableCell className="text-right tabular">{fmtINR(h.current_value, 0)}</TableCell>
                  <TableCell className={`text-right tabular font-semibold ${pnlClass(h.unrealized_pnl)}`}>{fmtINR(h.unrealized_pnl, 0)}</TableCell>
                  <TableCell className={`text-right tabular font-semibold ${pnlClass(h.unrealized_pct)}`}>{fmtPct(h.unrealized_pct)}</TableCell>
                  <TableCell className="tabular text-destructive">{h.stop_loss ? fmtINR(h.stop_loss) : "—"}</TableCell>
                  <TableCell className="tabular text-success">{h.target ? fmtINR(h.target) : "—"}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => openClose(h)} data-testid={`close-btn-${h.symbol}`}>
                      <XCircle size={14} /> Close
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!closeTarget} onOpenChange={(o) => !o && setCloseTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close {closeTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Buy Price</span>
              <span className="tabular">{fmtINR(closeTarget?.price)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Quantity</span>
              <span className="tabular">{closeTarget?.quantity}</span>
            </div>
            <div>
              <Label>Exit Price (₹)</Label>
              <Input type="number" step="0.01" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} data-testid="close-exit-price" className="tabular" />
            </div>
            {exitPrice && closeTarget && (
              <div className="p-3 bg-muted rounded-sm">
                Est. P&L: <span className={`font-bold tabular ${pnlClass((parseFloat(exitPrice) - closeTarget.price) * closeTarget.quantity)}`}>
                  {fmtINR((parseFloat(exitPrice) - closeTarget.price) * closeTarget.quantity, 0)}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseTarget(null)}>Cancel</Button>
            <Button onClick={submitClose} data-testid="confirm-close-btn">Confirm Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, val, sub, cls = "" }) {
  return (
    <Card className="p-5">
      <div className="text-[10px] tracking-widest uppercase text-muted-foreground font-bold">{label}</div>
      <div className={`text-3xl font-heading font-extrabold tabular mt-1 ${cls}`}>{val}</div>
      {sub && <div className={`text-sm tabular ${cls}`}>{sub}</div>}
    </Card>
  );
}
