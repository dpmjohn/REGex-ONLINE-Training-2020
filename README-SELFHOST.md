# TradeSense AI — Self-Host Guide

Run the entire app on your own machine with **zero Emergent dependency**.

---

## What you need installed

Just **one thing**: **Docker Desktop** (bundles Python, Node, MongoDB — you don't install any of those manually).

- Windows / Mac: https://www.docker.com/products/docker-desktop/
- Linux: `sudo apt install docker.io docker-compose-plugin` (or use official install script)

Verify:
```
docker --version
docker compose version
```

---

## Get your API key

You need an **Anthropic API key** (Claude Sonnet 4.5 powers the AI analysis + news sentiment).

1. Sign up at https://console.anthropic.com
2. Add a payment method (usage is ~₹100–200/month for a personal 15-min scanner)
3. Create an API key at: https://console.anthropic.com/settings/keys
4. Copy the key that starts with `sk-ant-…`

*(No other API keys are needed — Yahoo Finance for prices and Moneycontrol/ET RSS feeds are free.)*

---

## Setup (3 commands)

```bash
# 1. Clone your GitHub export
git clone https://github.com/<your-username>/<your-repo>.git tradesense
cd tradesense

# 2. Create .env from the template and paste your Anthropic key
cp .env.example .env
# then edit .env → set ANTHROPIC_API_KEY=sk-ant-...

# 3. Build & launch (this takes ~3-5 min the first time)
docker compose up -d --build
```

That's it. Open **http://localhost:3000** in your browser.

---

## Common commands

```bash
docker compose logs -f backend     # tail backend logs
docker compose logs -f frontend    # tail frontend logs
docker compose ps                  # see running containers
docker compose restart backend     # restart after code changes
docker compose down                # stop everything
docker compose down -v             # stop AND wipe database
```

Data (Mongo) survives restarts — it's stored in a Docker volume `mongo-data`.

---

## Access from other devices on your Wi-Fi

By default the app is only reachable at `http://localhost:3000` on the host machine.

To access it from your phone / other laptop on the same Wi-Fi:

1. Find your machine's LAN IP (e.g. `192.168.1.42`):
   - Mac / Linux: `ifconfig | grep inet`
   - Windows: `ipconfig`

2. Edit `.env`:
   ```
   REACT_APP_BACKEND_URL=http://192.168.1.42:8001
   ```

3. Rebuild frontend:
   ```
   docker compose up -d --build frontend
   ```

4. Open `http://192.168.1.42:3000` on any device on your LAN.

---

## Keep it running 24/7

The `restart: unless-stopped` policy in `docker-compose.yml` means containers auto-restart on crashes and after reboots (as long as Docker Desktop / dockerd itself is running).

**Important caveats for a scheduler-based app**:
- ⚠️ If your laptop sleeps, the APScheduler stops. Disable sleep or use a desktop / mini-PC / Raspberry Pi that stays awake.
- ⚠️ Cron jobs run in **IST (Asia/Kolkata)**. If your machine's timezone differs, jobs still fire at IST wall-clock time.
- ⚠️ First scan on startup takes ~90 seconds (fetches yfinance data for 40 stocks).

For truly always-on: rent a small VPS (DigitalOcean $6/mo, Hetzner ~₹350/mo) and run the same 3 commands there.

---

## Expose to the internet (optional)

If you want to access from anywhere (not just LAN), add a reverse proxy with a real domain + SSL. Simplest path:

- Use **Cloudflare Tunnel** (free, no port forwarding needed): https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
- Or **Tailscale** (free personal VPN): https://tailscale.com

Both take ~10 minutes to set up and give you `https://tradesense.your-domain.com` from anywhere.

---

## Cost estimate

| Item | Monthly cost |
|---|---|
| Home electricity (24/7) | ₹150–300 |
| Anthropic API (15-min scan schedule) | ₹100–250 |
| **Total (home)** | **~₹300–550** |
| VPS alternative | ₹400–800 |

---

## Troubleshooting

**"Cannot connect to backend"** — Check `.env` has the correct `REACT_APP_BACKEND_URL` and rebuild frontend.

**"AI analysis unavailable"** — Your Anthropic key isn't set or has no credits.

**Signals empty for 2 min after start** — Normal. The startup scan takes ~90s. Check `docker compose logs backend` for "Scan complete".

**Scheduler not firing** — Container timezone might differ. Check `docker compose exec backend date`. IST cron uses `Asia/Kolkata` via `pytz`, so wall-clock host time doesn't matter — the scheduler internally uses IST.

**"Port already in use"** — Something else is on 3000 or 8001. Edit `docker-compose.yml` ports section (`"3001:80"` etc).

---

## Updating

```bash
git pull
docker compose up -d --build
```

That's it. Docker rebuilds only the changed images.
