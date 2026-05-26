# Ultimate Baseball Tool 🏟️⚡

Real-time MLB bullpen health and effectiveness ratings for all 30 teams.  
Powered by [Picks2click](https://picks2click.com) · Deployed at [ultimatebaseballtool.com](https://ultimatebaseballtool.com)

---

## Features

- **Health Tiers** (1–5) based on 14-day rolling innings and pitch counts  
- **Effectiveness Grades** (A–F) from WHIP + ERA weighted formula  
- **Fatigue Index** (1–5) with consecutive-day availability penalties  
- **Live Bullpen Alerts** — real-time notifications when at-risk pitchers enter MLB games  
- **Team Compare** — head-to-head bullpen matchup tool  
- **Standings** — composite score ranking across all 30 teams  
- **IL Tracker** — expandable injury list per team  
- **PWA** — installable on iOS, Android, and desktop  

---

## Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: shadcn/ui + Tailwind CSS  
- **Charts**: Recharts  
- **Animations**: Framer Motion  
- **Data**: Admin upload via Excel → parsed to `data/mlb-teams.json`
- **Live Monitor**: MLB Stats API (free, no auth) polling every 60s via cron-job.org

---

## Environment Variables

Copy `.env.local.example` and fill in values:

```bash
# Admin credentials
ADMIN_USERNAME=LetsFuckingGO
ADMIN_PASSWORD=your_password_here
SUBSCRIBER_PASSWORD=your_subscriber_password

# Cron security (used by cron-job.org Authorization header)
CRON_SECRET=generate_with_openssl_rand_hex_32

# Optional: webhook URL for bullpen alerts
MLB_MONITOR_WEBHOOK_URL=https://ultimatebaseballtool.com/api/webhooks/bullpen-alert
MLB_MONITOR_WEBHOOK_SECRET=another_random_secret

# Alert thresholds (these are the defaults — only set to override)
ALERT_MIN_HEALTH_TIER=3
ALERT_MIN_FATIGUE=4
ALERT_GRADES=D,F
ALERT_MIN_WHIP=1.60

NEXT_PUBLIC_APP_URL=https://ultimatebaseballtool.com
```

---

## Development

```bash
npm install
npm run dev          # http://localhost:3000
```

---

## Deployment

### Vercel (primary)
```bash
git push origin main   # auto-deploys via Vercel GitHub integration
```

Set all environment variables in Vercel Dashboard → Settings → Environment Variables.

### Cron Job (cron-job.org — free)
1. Create account at https://cron-job.org  
2. URL: `https://ultimatebaseballtool.com/api/mlb-monitor`  
3. Schedule: Every minute (`* * * * *`)  
4. Header: `Authorization: Bearer YOUR_CRON_SECRET`  

When you upgrade to Vercel Pro, switch to the native cron in `vercel.json` (already configured).

---

## App Store Distribution

### Google Play Store (TWA)
1. Run [PWABuilder](https://www.pwabuilder.com) → enter `https://ultimatebaseballtool.com`  
2. Download Android package → upload to Google Play Console  
3. Get SHA-256 fingerprint from Google Play Console  
4. Replace placeholder in `public/.well-known/assetlinks.json`  
5. Redeploy  

### Apple App Store (Capacitor)
```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "Ultimate Baseball Tool" com.ultimatebaseballtool.app
npx cap add ios
npx cap sync
npx cap open ios    # Opens Xcode — build and submit from there
```

---

## Admin Access

- URL: `/admin`  
- Login: `/login` with admin credentials  
- **Live Alerts page**: `/alerts` (admin-only — not visible to subscribers)

---

## Project Structure

```
app/
  page.tsx              Dashboard (home)
  compare/              Team comparison
  standings/            Bullpen rankings
  alerts/               Live game alerts (admin only)
  admin/                Data upload & management
  api/
    auth/               Login / logout
    mlb-monitor/        Real-time cron endpoint
    alerts/             Alert data API
    pitchers/           Pitcher data for monitor
    upload-data/        Excel upload handler
    refresh/            Data date endpoint

components/
  header.tsx            Global nav (with Alerts badge)
  pitcher-table.tsx     Team pitcher detail
  team-card.tsx         Dashboard team card
  ...

lib/
  health.ts             Pitcher/team health calculations
  calculations.ts       Grade, composite score, metrics
  mlb/
    types.ts            Monitor type definitions
    api.ts              MLB Stats API client
    monitor.ts          Core monitor engine

data/
  mlb-teams.json        Active dataset (updated via admin upload)
  change-log.json       Upload history
  monitor-state.json    Runtime — auto-generated, gitignored
  alerts-today.json     Runtime — auto-generated, gitignored

public/
  manifest.json         PWA manifest (app store ready)
  sw.js                 Service worker
  .well-known/
    assetlinks.json     Android TWA digital asset links
```
