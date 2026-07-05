import { useEffect, useState } from "react";
import { endpoints } from "@/lib/api";
import { Bell, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/StarRating";
import { fmtINR } from "@/lib/format";
import { Link } from "react-router-dom";

export function NotificationBell() {
  const [data, setData] = useState({ alerts: [], unread_count: 0 });

  const load = async () => {
    try { const { data } = await endpoints.api?.get?.("/alerts") ?? {}; if (data) setData(data); } catch {}
  };

  const loadDirect = async () => {
    try {
      const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/alerts?limit=20`);
      const d = await r.json();
      setData(d);
    } catch {}
  };

  useEffect(() => {
    loadDirect();
    const t = setInterval(loadDirect, 20000);
    return () => clearInterval(t);
  }, []);

  const readAll = async () => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/alerts/read-all`, { method: "POST" });
      loadDirect();
    } catch {}
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative w-full justify-start" data-testid="notification-bell">
          <Bell size={16} weight="duotone" />
          <span className="text-sm">Alerts</span>
          {data.unread_count > 0 && (
            <Badge className="ml-auto bg-accent text-accent-foreground rounded-sm text-[10px] tabular">{data.unread_count}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0 max-h-[70vh] overflow-y-auto" align="start" data-testid="alerts-popover">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="font-heading font-bold">High-Conviction Alerts</div>
            <div className="text-xs text-muted-foreground">{data.unread_count} unread</div>
          </div>
          {data.unread_count > 0 && <Button size="sm" variant="ghost" onClick={readAll} data-testid="mark-all-read">Mark all read</Button>}
        </div>
        {data.alerts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No alerts yet. Alerts fire automatically when the AI finds ★★★★ or ★★★★★ setups during scheduled scans.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {data.alerts.map(a => (
              <Link to={`/signals?symbol=${a.symbol}`} key={a.id} className={`block p-4 hover:bg-muted transition-colors ${!a.read ? "bg-primary/5" : ""}`} data-testid={`alert-${a.symbol}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <StarRating count={a.stars} size={10} />
                    {!a.read && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{a.trigger}</span>
                </div>
                <div className="font-semibold text-sm">🚀 {a.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  CMP {fmtINR(a.price)} • SL {fmtINR(a.stop_loss)} • Tgt {fmtINR(a.target_1)} • Conf {a.confidence}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Invest {fmtINR(a.investment_amount, 0)} • {a.shares} shares • {a.holding_period}
                </div>
              </Link>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
