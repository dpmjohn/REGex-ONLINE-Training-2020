import { useEffect, useState } from "react";
import { endpoints } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtINR, fmtPct, pnlClass } from "@/lib/format";

export default function Journal() {
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    const load = async () => { try { const { data } = await endpoints.trades(); setTrades(data.trades); } catch (e) {} };
    load(); const t = setInterval(load, 30000); return () => clearInterval(t);
  }, []);

  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto" data-testid="journal-page">
      <div className="mb-8">
        <div className="text-xs tracking-[0.25em] uppercase text-muted-foreground font-bold">Trade Journal</div>
        <h1 className="text-4xl font-heading font-extrabold mt-1">Every Trade, Documented</h1>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Buy</TableHead>
                <TableHead className="text-right">Exit</TableHead>
                <TableHead className="text-right">P&L</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No trades yet.</TableCell></TableRow>
              ) : trades.map(t => (
                <TableRow key={t.id} data-testid={`journal-row-${t.id}`}>
                  <TableCell className="tabular text-xs">{new Date(t.date).toLocaleDateString("en-IN")}</TableCell>
                  <TableCell><div className="font-semibold">{t.name}</div><div className="text-xs text-muted-foreground">{t.symbol.replace(".NS", "")}</div></TableCell>
                  <TableCell className="text-xs">{t.strategy || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={t.status === "open" ? "default" : "secondary"} className="rounded-sm">{t.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular">{t.quantity}</TableCell>
                  <TableCell className="text-right tabular">{fmtINR(t.price)}</TableCell>
                  <TableCell className="text-right tabular">{t.exit_price ? fmtINR(t.exit_price) : "—"}</TableCell>
                  <TableCell className={`text-right tabular font-semibold ${pnlClass(t.pnl)}`}>{t.pnl !== null && t.pnl !== undefined ? fmtINR(t.pnl, 0) : "—"}</TableCell>
                  <TableCell className={`text-right tabular font-semibold ${pnlClass(t.pnl_pct)}`}>{t.pnl_pct !== null && t.pnl_pct !== undefined ? fmtPct(t.pnl_pct) : "—"}</TableCell>
                  <TableCell className="text-xs max-w-xs truncate">{t.notes || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
