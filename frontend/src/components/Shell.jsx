import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { House, ChartLineUp, Wallet, Bookmark, SquaresFour, Newspaper, Notebook, ChartBar, ArrowsClockwise } from "@phosphor-icons/react";
import { NotificationBell } from "@/components/NotificationBell";
import { useEffect, useState } from "react";
import { endpoints } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const NAV = [
  { to: "/", label: "Dashboard", icon: House, testid: "nav-dashboard" },
  { to: "/signals", label: "Buy Signals", icon: ChartLineUp, testid: "nav-signals" },
  { to: "/portfolio", label: "Portfolio", icon: Wallet, testid: "nav-portfolio" },
  { to: "/watchlist", label: "Watchlist", icon: Bookmark, testid: "nav-watchlist" },
  { to: "/heatmap", label: "Sector Heatmap", icon: SquaresFour, testid: "nav-heatmap" },
  { to: "/journal", label: "Trade Journal", icon: Notebook, testid: "nav-journal" },
  { to: "/performance", label: "Performance", icon: ChartBar, testid: "nav-performance" },
  { to: "/news", label: "News", icon: Newspaper, testid: "nav-news" },
];

export default function Shell() {
  const location = useLocation();
  const [status, setStatus] = useState({ status: "idle", last_updated: null, count: 0 });
  const [scanning, setScanning] = useState(false);

  const refreshStatus = async () => {
    try {
      const { data } = await endpoints.scanStatus();
      setStatus(data);
      if (data.status === "ready" && scanning) {
        setScanning(false);
        toast.success(`Scan complete • ${data.count} signals analyzed`);
      }
    } catch (e) {}
  };

  useEffect(() => {
    refreshStatus();
    const t = setInterval(refreshStatus, 5000);
    return () => clearInterval(t);
  }, [scanning]);

  const triggerScan = async () => {
    setScanning(true);
    try {
      await endpoints.runScan();
      toast.info("Scan initiated – analyzing 40+ NSE stocks...");
    } catch {
      toast.error("Failed to start scan");
      setScanning(false);
    }
  };

  const lastUpd = status.last_updated ? new Date(status.last_updated).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never";

  return (
    <div className="flex min-h-screen bg-background" data-testid="app-shell">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card sticky top-0 h-screen">
        <div className="px-6 py-5 border-b border-border">
          <Link to="/" className="flex items-center gap-2" data-testid="brand-logo">
            <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center rounded-sm font-heading font-extrabold text-sm">TS</div>
            <div>
              <div className="font-heading font-extrabold text-lg leading-none">TradeSense</div>
              <div className="text-xs text-muted-foreground tracking-widest mt-1">AI ANALYST</div>
            </div>
          </Link>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              data-testid={item.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-foreground hover:bg-muted"
                }`
              }
            >
              <item.icon size={18} weight="duotone" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="mb-3">
            <NotificationBell />
          </div>
          <div className="text-xs tracking-widest uppercase text-muted-foreground mb-2">Scan Status</div>
          <div className="flex items-center justify-between mb-2">
            <Badge variant={status.status === "ready" ? "default" : "secondary"} data-testid="scan-status-badge">
              {status.status}
            </Badge>
            <span className="text-xs text-muted-foreground tabular">{status.count} signals</span>
          </div>
          <div className="text-xs text-muted-foreground mb-3">Updated: {lastUpd}</div>
          <Button
            size="sm"
            className="w-full"
            onClick={triggerScan}
            disabled={status.status === "scanning" || scanning}
            data-testid="run-scan-btn"
          >
            <ArrowsClockwise size={14} className={status.status === "scanning" ? "animate-spin" : ""} />
            {status.status === "scanning" ? "Scanning..." : "Run Scan"}
          </Button>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary text-primary-foreground flex items-center justify-center rounded-sm font-heading font-extrabold text-xs">TS</div>
            <span className="font-heading font-extrabold">TradeSense</span>
          </Link>
          <Button size="sm" variant="outline" onClick={triggerScan} disabled={status.status === "scanning"}>
            <ArrowsClockwise size={14} className={status.status === "scanning" ? "animate-spin" : ""} />
            Scan
          </Button>
        </div>
        <div className="overflow-x-auto border-t border-border">
          <div className="flex gap-1 px-2 py-2 min-w-max">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/"}
                className={({ isActive }) => `text-xs px-3 py-1.5 rounded-sm whitespace-nowrap ${isActive ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 min-w-0 pt-28 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
