import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/StarRating";
import { endpoints } from "@/lib/api";
import { fmtINR, fmtPct, pnlClass } from "@/lib/format";
import { toast } from "sonner";
import { Sparkle, Target, ShieldCheck, ArrowRight } from "@phosphor-icons/react";

export function SignalCard({ signal, onAddTrade }) {
  const [expanded, setExpanded] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [showBuy, setShowBuy] = useState(false);
  const [qty, setQty] = useState(signal.shares || 1);
  const [notes, setNotes] = useState("");

  const runAi = async () => {
    setLoadingAi(true);
    try {
      const { data } = await endpoints.aiAnalysis(signal.symbol);
      setAnalysis(data.analysis);
    } catch (e) {
      toast.error("AI analysis failed");
    } finally {
      setLoadingAi(false);
    }
  };

  const submitBuy = async () => {
    try {
      await endpoints.createTrade({
        symbol: signal.symbol,
        name: signal.name,
        action: "BUY",
        quantity: parseInt(qty),
        price: signal.price,
        stop_loss: signal.stop_loss,
        target: signal.target_1,
        strategy: signal.strategy,
        horizon: signal.horizon,
        notes,
      });
      toast.success(`Added ${signal.symbol} to portfolio`);
      setShowBuy(false);
      if (onAddTrade) onAddTrade();
    } catch (e) {
      toast.error("Failed to add trade");
    }
  };

  const upside = ((signal.target_1 - signal.price) / signal.price * 100).toFixed(1);
  const downside = ((signal.stop_loss - signal.price) / signal.price * 100).toFixed(1);

  return (
    <Card className="p-6 border-border rounded-md transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-sm" data-testid={`signal-card-${signal.symbol}`}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <StarRating count={signal.stars} />
            <Badge variant="secondary" className="rounded-sm text-xs">{signal.sector}</Badge>
          </div>
          <h3 className="font-heading font-bold text-xl text-foreground" data-testid={`signal-name-${signal.symbol}`}>{signal.name}</h3>
          <div className="text-xs text-muted-foreground tracking-widest uppercase mt-1">{signal.symbol.replace(".NS", "")} • {signal.strategy}</div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-heading font-extrabold tabular" data-testid={`signal-price-${signal.symbol}`}>{fmtINR(signal.price)}</div>
          <div className={`text-sm tabular ${pnlClass(signal.indicators.returns_1m)}`}>1M: {fmtPct(signal.indicators.returns_1m)}</div>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs tracking-widest uppercase text-muted-foreground font-bold">Confidence</span>
          <span className="text-lg font-heading font-bold text-primary tabular" data-testid={`confidence-${signal.symbol}`}>{signal.confidence}/100</span>
        </div>
        <Progress value={signal.confidence} className="h-2" />
      </div>

      {/* Trade plan grid */}
      <div className="grid grid-cols-4 gap-2 mb-4 py-3 border-y border-border">
        <div>
          <div className="text-[10px] tracking-widest uppercase text-muted-foreground">Buy Zone</div>
          <div className="text-sm font-semibold tabular">{fmtINR(signal.buy_zone[0], 0)}–{fmtINR(signal.buy_zone[1], 0)}</div>
        </div>
        <div>
          <div className="text-[10px] tracking-widest uppercase text-muted-foreground">Stop</div>
          <div className="text-sm font-semibold tabular text-destructive">{fmtINR(signal.stop_loss)}</div>
          <div className="text-[10px] tabular text-destructive">{downside}%</div>
        </div>
        <div>
          <div className="text-[10px] tracking-widest uppercase text-muted-foreground">Target 1</div>
          <div className="text-sm font-semibold tabular text-success">{fmtINR(signal.target_1)}</div>
          <div className="text-[10px] tabular text-success">+{upside}%</div>
        </div>
        <div>
          <div className="text-[10px] tracking-widest uppercase text-muted-foreground">R:R</div>
          <div className="text-sm font-semibold tabular">1:{signal.risk_reward}</div>
          <div className="text-[10px] text-muted-foreground">{signal.horizon}</div>
        </div>
      </div>

      {/* Reasons */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {signal.reasons.map((r, i) => (
          <span key={i} className="text-xs px-2 py-0.5 bg-secondary text-secondary-foreground rounded-sm border border-border">{r}</span>
        ))}
      </div>

      {/* Investment recommendation */}
      <div className="flex items-center justify-between p-3 bg-primary/5 rounded-sm border border-primary/20 mb-4">
        <div>
          <div className="text-[10px] tracking-widest uppercase text-muted-foreground font-bold">Suggested Investment</div>
          <div className="font-heading font-bold text-lg text-primary tabular">{fmtINR(signal.investment_amount, 0)} • {signal.shares} shares</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] tracking-widest uppercase text-muted-foreground">Holding</div>
          <div className="text-sm font-semibold">{signal.holding_period}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-2">
        <Button className="flex-1" onClick={() => setShowBuy(true)} data-testid={`buy-btn-${signal.symbol}`}>
          <Target size={16} /> Add to Portfolio
        </Button>
        <Button variant="outline" onClick={() => setExpanded(!expanded)} data-testid={`expand-btn-${signal.symbol}`}>
          {expanded ? "Less" : "More"}
        </Button>
        <Button variant="outline" onClick={runAi} disabled={loadingAi} data-testid={`ai-btn-${signal.symbol}`}>
          <Sparkle size={16} weight="fill" /> {loadingAi ? "..." : "AI"}
        </Button>
      </div>

      {analysis && (
        <div className="mt-3 p-3 bg-muted/50 rounded-sm border border-border text-sm whitespace-pre-wrap" data-testid={`ai-analysis-${signal.symbol}`}>
          <div className="text-[10px] tracking-widest uppercase text-muted-foreground font-bold mb-2 flex items-center gap-1"><Sparkle size={12} weight="fill" /> Claude Analysis</div>
          {analysis}
        </div>
      )}

      {expanded && (
        <div className="mt-4 pt-4 border-t border-border space-y-3">
          <div>
            <div className="text-xs tracking-widest uppercase text-muted-foreground font-bold mb-2">Component Scores</div>
            <div className="space-y-1.5">
              {[
                ["Technical (30%)", signal.scores.technical],
                ["Fundamental (30%)", signal.scores.fundamental],
                ["Market Trend (15%)", signal.scores.market_trend],
                ["News Sentiment (10%)", signal.scores.news],
                ["Institutional (10%)", signal.scores.institutional],
                ["Risk Mgmt (5%)", signal.scores.risk],
              ].map(([label, val]) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="text-xs w-40">{label}</div>
                  <Progress value={val} className="h-1.5 flex-1" />
                  <div className="text-xs tabular font-semibold w-10 text-right">{val}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs tracking-widest uppercase text-muted-foreground font-bold mb-2">Key Indicators</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <Kv label="RSI" val={signal.indicators.rsi} />
              <Kv label="ADX" val={signal.indicators.adx} />
              <Kv label="Vol Ratio" val={`${signal.indicators.volume_ratio}x`} />
              <Kv label="EMA 50" val={fmtINR(signal.indicators.ema50, 0)} />
              <Kv label="EMA 200" val={fmtINR(signal.indicators.ema200, 0)} />
              <Kv label="52W High" val={fmtINR(signal.indicators.high_52w, 0)} />
            </div>
          </div>
        </div>
      )}

      <Dialog open={showBuy} onOpenChange={setShowBuy}>
        <DialogContent data-testid="buy-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Add {signal.name} to Portfolio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Symbol</Label>
              <Input value={signal.symbol} disabled className="tabular" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Buy Price (₹)</Label>
                <Input value={signal.price} disabled className="tabular" />
              </div>
              <div>
                <Label>Quantity</Label>
                <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} data-testid="buy-qty-input" className="tabular" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Stop Loss</Label>
                <Input value={signal.stop_loss} disabled className="tabular" />
              </div>
              <div>
                <Label>Target</Label>
                <Input value={signal.target_1} disabled className="tabular" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." data-testid="buy-notes-input" />
            </div>
            <div className="text-sm p-3 bg-muted rounded-sm">
              Total: <span className="font-bold tabular">{fmtINR(qty * signal.price, 0)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBuy(false)}>Cancel</Button>
            <Button onClick={submitBuy} data-testid="confirm-buy-btn"><ShieldCheck size={16} /> Confirm Buy</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Kv({ label, val }) {
  return (
    <div className="flex justify-between border-b border-border pb-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular font-semibold">{val}</span>
    </div>
  );
}
