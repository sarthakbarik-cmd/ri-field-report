# Project Handoff & External Hosting Guide

This repository is a complete full-stack web application ready for continued development in ChatGPT / Codex and self-hosting on a custom domain.

## Tech Stack
- **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS v4 (`@tailwindcss/vite`), Lucide Icons, `jspdf`, `html2canvas`
- **Backend:** Node.js + Express (`server.ts`)
  - Serves the Vite SPA in development and `dist/` static build in production
  - Exposes `/api/health`, `/api/extract-ror` (PDF extraction via `@google/genai`), and `/api/sample-ror-pdf`
- **Database & Auth:** Firebase Authentication (Google Sign-In) + Cloud Firestore (`firebase` v12)

## Linked Firebase Project & Firestore Database
The project is already wired to the existing Firebase project via:
- `firebase-applet-config.json` — Client Firebase web config and named `firestoreDatabaseId`
- `src/lib/firebase.ts` — Initializes Firebase Auth and Cloud Firestore using `getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined)`
- `firestore.rules` — Owner-scoped Firestore security rules (`/users/{userId}/...`)
- `firebase-blueprint.json` — Schema reference

**Important:** Keep `firebase-applet-config.json` intact and preserve the `firestoreDatabaseId` argument in `getFirestore(...)` so the app stays connected to the exact same Firestore database and existing user records.

### Required Step for Custom Domain Sign-In
Before signing in on your custom domain (or `localhost` / staging URL), add the domain in Firebase Console:
1. Open **Firebase Console** → select the project ID from `firebase-applet-config.json`
2. Go to **Authentication → Settings → Authorized domains**
3. Click **Add domain** and add your custom domain (e.g., `yourdomain.com` and `www.yourdomain.com`)

## Commands
```bash
# Install dependencies (Node.js 20+ or 22+ recommended)
npm install

# Run full-stack dev server locally (http://localhost:3000)
npm run dev

# Type-check
npm run lint

# Build frontend (dist/) + bundled Node server (dist/server.cjs)
npm run build

# Start production server
NODE_ENV=production npm run start
```

## Environment Variables
Create a `.env` file locally (never commit it) or configure these in your hosting dashboard:
- `NODE_ENV=production` (for deployed servers)
- `PORT` (automatically injected by Render, Railway, Cloud Run, Fly.io; defaults to `3000`)
- `GEMINI_API_KEY` — Required for `/api/extract-ror` ROR PDF extraction
- `GEMINI_MODEL` — Optional override (e.g. `gemini-2.5-flash`)
- `APP_URL` — Your deployed domain URL (e.g. `https://yourdomain.com`)

## Recommended Hosting Setup (Render / Railway / Google Cloud Run)
- **Runtime:** Node.js 20 or 22
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm run start`
- **Custom Domain:** Add your domain in the host's Custom Domains settings, point DNS (`A` or `CNAME`) from your domain registrar, and add the same domain to Firebase **Authorized domains**.
