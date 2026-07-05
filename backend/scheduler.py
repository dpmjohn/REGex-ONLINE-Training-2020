"""Automatic scan scheduler for TradeSense AI.

Schedule (IST):
  - Pre-market:       09:00 AM Mon-Fri
  - Live scans:       Every 15 min 09:15 AM – 03:30 PM Mon-Fri
  - Closing review:   03:30 PM Mon-Fri
  - Weekend deep:     10:00 AM Saturday
  - Monthly review:   09:00 AM first Sunday
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
IST = pytz.timezone("Asia/Kolkata")

class ScanScheduler:
    def __init__(self, scan_fn, notify_fn=None):
        self.scan_fn = scan_fn
        self.notify_fn = notify_fn
        self.scheduler = AsyncIOScheduler(timezone=IST)
        self.last_high_conviction_symbols: set = set()
        self.run_history: list = []

    async def _scheduled_scan(self, label: str):
        logger.info(f"[Scheduler] Running scan: {label} at {datetime.now(IST).isoformat()}")
        self.run_history.append({"label": label, "at": datetime.now(timezone.utc).isoformat()})
        self.run_history = self.run_history[-50:]
        try:
            await self.scan_fn()
            if self.notify_fn:
                await self.notify_fn(label)
        except Exception as e:
            logger.exception(f"Scheduled scan {label} failed: {e}")

    def start(self):
        # Pre-market
        self.scheduler.add_job(self._scheduled_scan, CronTrigger(day_of_week="mon-fri", hour=9, minute=0), args=["Pre-Market Scan"], id="pre_market")
        # Live scans every 15 min 09:15 - 15:30
        self.scheduler.add_job(self._scheduled_scan, CronTrigger(day_of_week="mon-fri", hour="9-15", minute="15,30,45,0"), args=["Live Scan"], id="live_scan")
        # Closing review
        self.scheduler.add_job(self._scheduled_scan, CronTrigger(day_of_week="mon-fri", hour=15, minute=30), args=["Closing Review"], id="close_review")
        # Weekend deep analysis (Saturday 10 AM)
        self.scheduler.add_job(self._scheduled_scan, CronTrigger(day_of_week="sat", hour=10, minute=0), args=["Weekend Deep Analysis"], id="weekend")
        # Monthly (first Sunday 9 AM)
        self.scheduler.add_job(self._scheduled_scan, CronTrigger(day_of_week="sun", hour=9, minute=0, day="1-7"), args=["Monthly Portfolio Review"], id="monthly")
        self.scheduler.start()
        logger.info("[Scheduler] Started with 5 jobs (IST)")

    def get_status(self):
        jobs = []
        for j in self.scheduler.get_jobs():
            jobs.append({
                "id": j.id,
                "name": j.args[0] if j.args else j.id,
                "next_run": j.next_run_time.isoformat() if j.next_run_time else None,
            })
        return {
            "timezone": "Asia/Kolkata (IST)",
            "running": self.scheduler.running,
            "jobs": jobs,
            "recent_runs": self.run_history[-10:],
        }

    def shutdown(self):
        if self.scheduler.running:
            self.scheduler.shutdown()
