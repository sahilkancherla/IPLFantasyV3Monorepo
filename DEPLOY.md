# IPL Fantasy — Production Deployment Guide

## Overview

| Layer | Service | Cost |
|---|---|---|
| Backend (API + WebSocket) | Railway | ~$5–10/mo |
| Database | Supabase (already cloud) | Free / $25/mo Pro |
| Mobile app | EAS Build → iOS App Store | $99/yr (Apple Developer) + EAS free tier |

---

## 1. Supabase — Harden for Production

Your database is already in the cloud, but do these before going live.

### 1a. Create a production Supabase project (separate from dev)

1. Go to [supabase.com](https://supabase.com) → New project
2. Choose a region close to your users (e.g. `ap-south-1` for India)
3. Save the password — you won't see it again

### 1b. Run all migrations on the new project

```bash
# In Supabase dashboard → SQL Editor, run each migration in order:
# supabase/migrations/001_schema.sql
# supabase/migrations/002_rls.sql
# supabase/migrations/003_seed_players.sql
# supabase/migrations/004_updates.sql
# supabase/migrations/005_seed_weeks.sql
# supabase/migrations/006_fix_trigger.sql
# supabase/migrations/007_interests.sql
# supabase/migrations/008_admin.sql
# supabase/migrations/009_role_limits.sql
# supabase/migrations/010_currency.sql
```

### 1c. Grab your production credentials

Go to **Project Settings → API**:

| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | `anon` / `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key (keep secret) |

Go to **Project Settings → Database → Connection string → URI**:

| Variable | Where to find it |
|---|---|
| `DATABASE_URL` | URI format (use Session mode, port 5432) |

> **Important:** Use the **Session mode** connection string (port 5432), not Transaction mode. The backend uses a persistent pg pool that requires session-level connections.

### 1d. Set auth redirect URLs

**Authentication → URL Configuration:**
- Site URL: `iplfantasy://` (your app scheme)
- Add redirect URL: `iplfantasy://auth/callback`

### 1e. Configure email (optional but recommended)

**Authentication → SMTP Settings:** Connect a custom SMTP provider (Resend, SendGrid, Postmark) so auth emails don't go to spam.

---

## 2. Backend — Deploy to Railway

Railway supports Node.js + WebSockets natively, gives you HTTPS/WSS automatically, and deploys straight from GitHub.

### 2a. Add a Dockerfile to `backend/`

Railway can use Nixpacks auto-detection, but an explicit Dockerfile is more reliable for ESM TypeScript:

```dockerfile
# backend/Dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

> We copy `src/` and run `npm run build` (which runs `tsc`) inside the image. `devDependencies` like `tsx` and `typescript` are NOT omitted at this stage — remove `--omit=dev` from the first `npm ci` and add a second `npm ci --omit=dev` after the build step if you want to minimize the final image size.

Cleaner two-stage version:

```dockerfile
# backend/Dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### 2b. Create Railway project

1. Go to [railway.app](https://railway.app) → New Project
2. **Deploy from GitHub repo** → select `IPLFantasyV3`
3. Railway will ask which service — set **Root Directory** to `backend`
4. Railway auto-detects the Dockerfile

### 2c. Set environment variables in Railway

Go to your service → **Variables** tab and add:

```
NODE_ENV=production
PORT=3000

SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://postgres:[password]@db.xxxx.supabase.co:5432/postgres

JWT_SECRET=<random 64-char string — generate with: openssl rand -hex 32>
SYNC_SECRET=<random 32-char string>
ADMIN_SECRET=<random 32-char string>

CORS_ORIGIN=iplfantasy://
```

> Generate secrets: `openssl rand -hex 32`

### 2d. Set the Railway domain

1. Railway service → **Settings → Networking → Generate Domain**
2. You'll get something like `ipl-fantasy-backend-production.up.railway.app`
3. Note both the HTTPS URL and WSS URL — they're the same hostname, different scheme:
   - API: `https://ipl-fantasy-backend-production.up.railway.app`
   - WebSocket: `wss://ipl-fantasy-backend-production.up.railway.app`

### 2e. Custom domain (optional)

1. Buy a domain (e.g. `api.iplfantasy.app`) from Namecheap / Cloudflare
2. Railway → Settings → Networking → Custom Domain → add your domain
3. Add the CNAME record Railway shows you in your DNS provider
4. Update `CORS_ORIGIN` to include your domain if needed

### 2f. Verify the backend is live

```bash
curl https://ipl-fantasy-backend-production.up.railway.app/health
# Should return {"status":"ok"} or similar

# Test WebSocket with wscat:
npx wscat -c wss://ipl-fantasy-backend-production.up.railway.app/ws/auction
```

---

## 3. Mobile App — Wire to Production Backend

### 3a. Create a production `.env` in `mobile/`

```bash
# mobile/.env.production
EXPO_PUBLIC_API_URL=https://ipl-fantasy-backend-production.up.railway.app
EXPO_PUBLIC_WS_URL=wss://ipl-fantasy-backend-production.up.railway.app
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

> Expo automatically picks up `.env` files. Values prefixed `EXPO_PUBLIC_` are bundled into the app at build time. **Never put service role keys or secrets in mobile env.**

### 3b. Verify `app.json` bundle identifier

Your bundle ID is already set correctly:

```json
"ios": {
  "bundleIdentifier": "com.sahilkancherla.iplfantasyv3"
}
```

This must exactly match what you register in App Store Connect.

---

## 4. iOS App Store — EAS Build

### 4a. Prerequisites

1. **Apple Developer Program** — enroll at [developer.apple.com](https://developer.apple.com) ($99/year)
   - Takes up to 48 hours to activate
2. **EAS CLI** installed:
   ```bash
   npm install -g eas-cli
   eas login   # log in with your Expo account
   ```

### 4b. Create the app in App Store Connect

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. **My Apps → +** → New App
3. Fill in:
   - Platform: iOS
   - Name: IPL Fantasy
   - Primary Language: English
   - Bundle ID: `com.sahilkancherla.iplfantasyv3` (register it first if not listed)
   - SKU: `iplfantasyv3` (any unique string)
4. Save the **App ID** (10-digit number) — you'll need it for `eas.json`

### 4c. Configure EAS Build

Create `mobile/eas.json`:

```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "autoIncrement": true,
      "env": {
        "EXPO_PUBLIC_API_URL": "https://ipl-fantasy-backend-production.up.railway.app",
        "EXPO_PUBLIC_WS_URL": "wss://ipl-fantasy-backend-production.up.railway.app",
        "EXPO_PUBLIC_SUPABASE_URL": "https://xxxx.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "eyJ..."
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "1234567890",
        "appleTeamId": "XXXXXXXXXX"
      }
    }
  }
}
```

Where to find:
- `ascAppId`: App Store Connect → App Information → Apple ID (the 10-digit number)
- `appleTeamId`: developer.apple.com → Account → Membership → Team ID

### 4d. Configure `app.json` for production

Add/verify these fields in `mobile/app.json`:

```json
{
  "expo": {
    "name": "IPL Fantasy",
    "slug": "ipl-fantasy-v3",
    "version": "1.0.0",
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "ios": {
      "bundleIdentifier": "com.sahilkancherla.iplfantasyv3",
      "deploymentTarget": "16.0",
      "supportsTablet": false,
      "buildNumber": "1"
    },
    "extra": {
      "eas": {
        "projectId": "YOUR_EAS_PROJECT_ID"
      }
    }
  }
}
```

Get `projectId` by running `eas init` inside `mobile/` — it registers the project and writes the ID automatically.

```bash
cd mobile
eas init
```

### 4e. Create app icons and splash screen

The App Store requires specific icon sizes. Expo handles resizing automatically from a single 1024×1024 PNG.

1. Replace `mobile/assets/icon.png` with a 1024×1024 PNG (no alpha channel — App Store rejects icons with transparency)
2. Replace `mobile/assets/splash.png` with your splash image
3. Replace `mobile/assets/adaptive-icon.png` (for Android, but include it)

### 4f. Build for production

```bash
cd mobile

# Build iOS production binary (uploads to EAS servers, takes 10–20 min)
eas build --platform ios --profile production

# EAS will:
# 1. Ask to log into Apple Developer (first time only)
# 2. Auto-create provisioning profiles and signing certificates
# 3. Build the .ipa on EAS servers
# 4. Give you a download link when done
```

### 4g. Submit to App Store

```bash
# Submit the latest build to App Store Connect
eas submit --platform ios --profile production

# This uploads the .ipa to App Store Connect via the App Store Connect API
```

### 4h. App Store Connect — complete the listing

Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → your app:

1. **App Information**
   - Category: Sports → Fantasy Sports
   - Content Rights: check if your app uses third-party IPL data
   - Age Rating: run the age rating questionnaire (likely 4+)

2. **Pricing and Availability**
   - Price: Free
   - Availability: All countries or restrict to India + others

3. **App Privacy** (required)
   - Declare what data you collect (email, username = account data)
   - Link a privacy policy URL (you need a real URL — host a simple one on GitHub Pages or Notion)

4. **1.0 Prepare for Submission**
   - Screenshots: required for iPhone 6.5" (iPhone 14 Pro Max) and 5.5" (iPhone 8 Plus)
     ```bash
     # Run your app in simulator and take screenshots:
     # Xcode → Simulator → File → Take Screenshot
     ```
   - Description: write the app description
   - Keywords: "IPL, cricket, fantasy, auction, draft"
   - Support URL: GitHub repo URL or a simple webpage
   - Version: 1.0.0
   - What's new: "Initial release"

5. **Build** — select the build you uploaded via `eas submit`

6. Click **Submit for Review**

### 4i. Review timeline

- Standard review: 1–3 days
- First submission: can take up to 7 days
- If rejected: fix the issue and resubmit (doesn't restart the clock in most cases)

---

## 5. TestFlight — Recommended Before App Store

Test with real devices before submitting to the App Store.

```bash
# Build for TestFlight (same as production profile)
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios --profile production
```

Then in App Store Connect:
1. **TestFlight → iOS Builds** → your build should appear (takes ~30 min to process)
2. Add internal testers (up to 100) by Apple ID — no review needed
3. External testers require a brief Beta App Review (usually same-day)

---

## 6. Updates After Launch — EAS Update (OTA)

For bug fixes that don't change native code (JS-only changes), you can push over-the-air without going through App Store review.

```bash
# First, add expo-updates to the project:
cd mobile
npx expo install expo-updates

# Publish an update (reaches users within 24 hours, often immediately):
eas update --branch production --message "Fix nomination bug"
```

Add to `app.json` to enable OTA:
```json
{
  "expo": {
    "updates": {
      "url": "https://u.expo.dev/YOUR_EAS_PROJECT_ID"
    },
    "runtimeVersion": {
      "policy": "appVersion"
    }
  }
}
```

> **When you need a full App Store build:** adding new native packages, changing `app.json` native fields (bundle ID, permissions), or iOS version bumps.

---

## 7. Continuous Deployment (Optional)

### Auto-deploy backend on push

Railway does this automatically — every push to your connected branch triggers a redeploy.

To restrict to a specific branch:
- Railway → Service → Settings → Source → Branch: `main`

### Auto-build mobile on push

Create `.github/workflows/eas-build.yml`:

```yaml
name: EAS Production Build

on:
  push:
    branches: [main]
    paths:
      - 'mobile/**'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install EAS CLI
        run: npm install -g eas-cli

      - name: Install dependencies
        working-directory: mobile
        run: npm ci

      - name: Build
        working-directory: mobile
        run: eas build --platform ios --profile production --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

Add `EXPO_TOKEN` to GitHub repo secrets (get it from expo.dev → Account → Access Tokens).

---

## 8. Monitoring & Observability

### Backend logs
Railway → your service → **Logs** tab. Live streaming logs, searchable.

### Backend errors
Add Sentry for error tracking:
```bash
cd backend && npm install @sentry/node
```
Free tier covers most indie apps.

### Supabase monitoring
- Supabase Dashboard → Reports → shows query times, API requests, active connections
- Set up database alert emails for high connection counts

### Uptime monitoring
Use [UptimeRobot](https://uptimerobot.com) (free):
- Monitor: `https://ipl-fantasy-backend-production.up.railway.app/health`
- Alert via email if down

---

## 9. Cost Estimate

| Item | Monthly cost |
|---|---|
| Railway Hobby plan (backend) | $5 base + ~$2–5 usage |
| Supabase Free tier | $0 (up to 500MB DB, 2GB bandwidth) |
| Supabase Pro (if you exceed free limits) | $25 |
| Apple Developer Program | $8.25 (billed $99/year) |
| EAS Build (Expo) | Free for limited builds, $49/mo for unlimited |
| Domain (optional) | $1–3/mo |
| **Total (minimal)** | **~$13/mo + $99/yr** |

---

## 10. Pre-Launch Checklist

```
□ Supabase production project created + migrations run
□ Supabase RLS enabled and tested (SELECT on all tables blocked without auth)
□ Backend Dockerfile created and tested locally (docker build + docker run)
□ Railway service created, env vars set, domain assigned
□ Backend health check returns 200
□ WebSocket connects successfully from a test client
□ mobile/.env.production set with production API/WS/Supabase URLs
□ eas.json created with correct ascAppId and appleTeamId
□ App icon is 1024×1024 PNG with no alpha channel
□ Privacy policy hosted at a public URL
□ App Store Connect listing filled out (description, screenshots, age rating, privacy)
□ TestFlight build tested on a real iPhone
□ eas submit run successfully
□ Submitted for App Store review
```

---

## Quick Reference — Key Commands

```bash
# Backend
cd backend
npm run build          # compile TypeScript
npm start              # start production server
docker build -t ipl-backend .    # build Docker image locally
docker run -p 3000:3000 --env-file .env ipl-backend  # run locally

# Mobile
cd mobile
eas init                                              # first-time EAS setup
eas build --platform ios --profile production        # build .ipa
eas submit --platform ios --profile production       # upload to App Store
eas update --branch production --message "fix: ..."  # OTA JS update

# Secrets
openssl rand -hex 32   # generate a 64-char secret for JWT_SECRET etc.
```
