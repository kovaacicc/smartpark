# Smart Parking — Zagreb

A full-stack portfolio web app for smart parking in Zagreb. Combines user accounts, wallet funding, zone-based pricing, subscriptions, a rewards system, and a live parking map.

---

## Quick Start

```bash
npm install
npm start          # runs API on :4000 + CRA dev on :3000 (proxied)
```

Optional — copy `.env.example` to `.env` and fill in secrets before starting.

```bash
npm run build                        # production frontend bundle
npm run generate-streets             # regenerate public/streets_with_parking.json
CI=true npm test -- --watchAll=false # run tests once
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Create React App, React Router 6 |
| Styling | Custom CSS (`src/App.css`) |
| Map | Leaflet + leaflet.heat (see migration note below) |
| Backend | Node.js + Express 5 |
| Auth | JWT (30-day tokens stored in localStorage) |
| Passwords | bcryptjs |
| Payments | Stripe SDK (dev fallback when `STRIPE_SECRET_KEY` absent) |
| Persistence | JSON flat-file (`server/data/store.json`) |
| Dev workflow | concurrently (frontend + backend together) |

---

## Project Structure

```
parkingApp/
├── public/
│   ├── index.html
│   └── streets_with_parking.json     # heatmap + suggestion dataset (generated)
├── scripts/
│   └── generate-streets.js           # synthesises streets_with_parking.json
├── server/
│   ├── data/store.json               # live app state (users, sessions, etc.)
│   ├── db.js                         # readStore / mutateStore helpers
│   └── index.js                      # Express API
├── src/
│   ├── App.js                        # all frontend routes + components
│   ├── App.css                       # single main stylesheet
│   ├── App.test.js
│   ├── index.js
│   ├── index.css
│   └── setupTests.js
└── package.json
```

---

## Zagreb Parking Pricing (live in backend)

| Zone | Hourly rate | Max hourly | Day cap |
|---|---|---|---|
| Zone 1 | €1.60 / h | 2 hours | €16.00 flat |
| Zone 2 | €0.70 / h | 3 hours | €8.00 flat |
| Zone 3 | €0.12 / h | no cap | charged hourly all day |

Charge is deducted from wallet balance when a session is stopped. Active subscriptions zero the charge. Reward "free next session" also zeros it.

---

## Environment Variables

Create a `.env` file in the project root:

```
PORT=4000
JWT_SECRET=replace-with-a-long-random-string
STRIPE_SECRET_KEY=sk_test_...          # omit to use dev credit mode
REACT_APP_GOOGLE_MAPS_KEY=AIza...      # needed for Google Maps migration (see below)
```

---

## API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/register` | — | Create account, returns JWT |
| POST | `/api/login` | — | Login, returns JWT |
| GET | `/api/user` | JWT | Get current user profile |
| PUT | `/api/user` | JWT | Update name / email |
| GET | `/api/cars` | JWT | List user vehicles |
| POST | `/api/cars` | JWT | Add vehicle |
| DELETE | `/api/cars/:id` | JWT | Remove vehicle |
| GET | `/api/wallet` | JWT | Balance + transaction history |
| POST | `/api/wallet/add` | JWT | Top up wallet (Stripe or dev) |
| GET | `/api/subscription` | JWT | Active subscription info |
| POST | `/api/subscription` | JWT | Purchase monthly/yearly pass |
| GET | `/api/rewards` | JWT | Points, catalog, redemption history |
| POST | `/api/rewards/redeem` | JWT | Redeem a reward by ID |
| GET | `/api/parking/session` | JWT | Active session (if any) |
| POST | `/api/parking/start` | JWT | Start parking session |
| POST | `/api/parking/stop` | JWT | Stop session + charge wallet |
| GET | `/api/places/search?q=` | JWT | Nominatim address lookup |
| GET | `/api/health` | — | Server liveness check |

---

---

# Fixes Needed & Future Updates

> This section tracks known issues, incomplete features, and planned improvements.
> Items are grouped by area and ordered roughly by priority.

---

## 1. Auth — Login & Registration

### Bugs / Gaps to fix

- **Form validation is missing on the frontend.** There is no check that the email looks like a valid address, that the password meets a minimum length, or that all required fields are filled before the form submits. Currently the backend returns a generic 400 which shows up as a raw error string.
- **No "confirm password" field** on the register form. A user can type a mistyped password and never know.
- **Error messages are not user-friendly.** Backend errors like "Email and password required" or "Invalid credentials" are shown verbatim. They should be mapped to friendly copy (e.g. "Wrong email or password. Try again.").
- **No loading / disabled state on submit.** Double-clicking the Register button fires two API calls.
- **JWT is stored in `localStorage`.** This is acceptable for a portfolio project but is a known XSS risk. For production, move to `HttpOnly` cookies.
- **No "Forgot password" flow.** There is no reset link or email-based recovery.
- **No email verification.** Any email string is accepted on registration.
- **Token expiry is not handled gracefully.** A 30-day-old token returns 401 and the user is silently redirected to login with no message.

### Planned improvements

- Add `zod` or `yup` schema validation on both frontend forms and backend handlers.
- Add password strength indicator on register.
- Add a toast/snackbar notification system instead of raw inline error strings.
- Implement email-based password reset via nodemailer (or a service like Resend).
- Switch to `HttpOnly` cookie auth when moving away from CRA.

---

## 2. Wallet — Payment Methods & UI

### Bugs / Gaps to fix

- **The wallet top-up UI is a plain number input and a button.** It does not look or behave like a real payment screen.
- **In dev mode (no Stripe key), any amount is credited instantly.** There is no visual indication that this is a demo, other than a small hint text below the button.
- **No minimum top-up guard on the frontend.** The backend rejects amounts ≤ 0 and > 500, but the form does not inform the user before submitting.
- **Stripe integration is backend-only.** There is no Stripe Elements / Payment Element on the frontend. The `paymentMethodId` field in the API exists but there is no UI to collect it.

### Planned improvements

- **Replace the input+button with a proper payment sheet modal:**
  - Quick-select amount chips (e.g. €10, €20, €50, €100).
  - Expandable "custom amount" field.
  - Payment method tabs at the top: **Card**, **Apple Pay**, **Google Pay**, **Aircash**, **PayPal**.
  - Card tab: embed Stripe Payment Element (handles card, Apple Pay, Google Pay natively in one component).
  - Aircash tab: redirect flow using Aircash checkout URL (Aircash is popular in Croatia/region). Requires Aircash merchant account.
  - PayPal tab: PayPal JS SDK button.
- Show wallet balance in a styled "card" UI (like a bank card tile) with last four digits masked.
- Add spend analytics: a small bar chart of spending per day / week using Chart.js or Recharts.
- Add low-balance warning when balance drops below €2.
- Transaction list should be paginated or load-more rather than truncated at 8 items.

---

## 3. Rewards System

### Bugs / Gaps to fix

- **Rewards catalog is hardcoded in `server/index.js`.** Adding or changing rewards requires a code deploy.
- **Points accumulation logic is scattered.** Points are added in four places (registration, wallet top-up, subscription purchase, parking stop). If any path is missed, points go out of sync.
- **The `pendingParkingDiscountPercent` is wiped after any session end with a discount, even if the discount was only partial.** If a user has a 30% reward and the charge is €0.20, the full discount field is cleared.
- **No expiry on reward redemptions.** A "free next session" reward can sit indefinitely.
- **Reward IDs are magic strings.** No enum or constant prevents typos between frontend and backend.

### Planned improvements

- **Tiered loyalty levels**: Bronze (0–499 pts), Silver (500–1999 pts), Gold (2000+ pts). Each tier unlocks:
  - Bronze — basic catalog.
  - Silver — +5% bonus points on every parking session, exclusive reward "30 min free".
  - Gold — +10% bonus points, "3-day free pass" reward, priority map pin colour.
- **Streak bonuses**: park 5 days in a row → earn double points for a day.
- **Referral reward**: share a referral code; both users earn 150 points on the referee's first session.
- **Reward expiry**: "free session" and "% off" rewards expire after 30 days if unused.
- **Admin panel** (or at least a seeded config file) to manage the catalog without a code deploy.
- **Visual progress bar** on the dashboard showing points to next tier.
- Move rewards catalog to `server/data/store.json` under a `rewardCatalog` key and expose `GET /api/rewards/catalog` + `PUT /api/rewards/catalog` for admin editing.

---

## 4. Map — Colors, Provider, Pins, Locations

### Bugs / Gaps to fix

- **Map uses OpenStreetMap tiles via CartoDB Dark.** The tile styling does not match the app brand and can feel inconsistent.
- **Leaflet heatmap color defaults (blue → red) are not customised.** Low-occupancy streets and high-occupancy streets are hard to distinguish on the dark background.
- **The CSS pin marker (`.pin-marker`) only appears for the manually selected street.** There are no markers for POIs, the user's GPS location, or active parking sessions.
- **No GPS "you are here" marker.** Calling "Use GPS" pans the map but leaves no persistent dot.
- **Street suggestion list disappears on mobile when the map pops into the second grid row.** The sidebar layout breaks below 840px.
- **`leaflet.heat` has no TypeScript types and its CDN integrity hash is not pinned.** Minor, but noticeable in a production build.
- **Zone boundaries are not shown on the map.** Users must remember which zone their street falls in.

### Planned: Migrate to Google Maps

Switching from Leaflet to Google Maps API requires:

1. Add `REACT_APP_GOOGLE_MAPS_KEY=AIza...` to `.env`.
2. Install `@vis.gl/react-google-maps` (the official Google Maps React wrapper).
3. Replace the Leaflet tile layer + heatmap with:
   - `<APIProvider apiKey={...}>` wrapping the map.
   - `<Map>` component with `mapId` pointing to a custom dark-style Map ID (created in the Google Cloud Console under "Map Styles").
   - `<HeatmapLayer>` from the `@vis.gl/react-google-maps/libraries/visualization` entrypoint.
4. Replace the CSS pin with a `<AdvancedMarker>` using a custom `<Pin>` component (supports custom colours, glyphs, scale).
5. Add dedicated marker types:
   - **GPS pin** (blue pulsing dot) — `AdvancedMarker` at GPS coords with a pulsing CSS animation.
   - **Selected street pin** (pink/rose, current brand color) — `AdvancedMarker` dropped on pick.
   - **Active session pin** (green) — shown on the map while a session is running.
   - **Suggested streets** (grey ghost pins) — lightweight markers for top 5 suggestions.
6. Heatmap gradient should be customised: grey (0% occupancy) → yellow → orange → red (100%).
7. Add a Google Places Autocomplete input (replaces the current Nominatim fallback). Requires `places` library from the Maps JS API.
8. Show Zagreb zone boundaries as polygon overlays (`<Polygon>`) with zone-colored fills (semi-transparent).
9. Map style: use a Cloud-based map style ("night" theme with parking zones highlighted). 

Note: Google Maps API usage is billed after the monthly free tier (28 000 Dynamic Map loads / month). For a portfolio demo this is usually free. Set a billing alert in Google Cloud Console.

---

## 5. Subscriptions — Clarify & Improve

### What the subscription does right now

- A **monthly pass (€29)** or **yearly pass (€299)** is purchased from wallet balance.
- While a subscription is active, the `POST /api/parking/stop` endpoint sets `charge = 0` — the user parks for free in **any zone**.
- Points bonus: +50 for monthly purchase, +200 for yearly.
- Only one subscription can be active at a time (the backend checks `endDate > now`).
- There is no UI showing how many days remain or an auto-renew option.

### Gaps / confusions

- **Subscription does not check the zone.** A monthly pass zeroes out Zone 1 (normally €16/day) equally with Zone 3 (normally €0.12/h). This may be intentional (unlimited pass) but should be documented as a business decision.
- **"Paid zones" from the city of Zagreb** — Zagreb has a physical zone permit system where residents can buy annual resident permits for their home zone. This app does not yet model resident permits. There are two options:
  - **Option A (simple)**: Add a "resident permit" flag per user-zone pair (e.g. `userZones: [{ zone: 1, permit: "resident", validUntil: "..." }]`). On parking stop, if the session zone matches a permit zone, charge is zeroed without consuming the subscription.
  - **Option B (accurate)**: Mirror the real Zagreb permit tiers — `D1` (downtown resident), `D2`, `D3` — and map them to zones. Only D-tier permit in matching zone gets free parking.
- **No subscription reminder.** Users get no notification 3 days before expiry.
- **Subscription purchased mid-session does not retroactively zero the charge.** If you subscribe while parked and then stop, the subscription check fires after the stop, which is correct, but this edge case is not tested.

### Planned improvements

- Add **`GET /api/subscription/history`** to list past and expired subscriptions.
- Add a **zone-scoped resident permit** model (Option A above) with `POST /api/subscription/resident-permit`.
- Show a **"Days remaining" countdown** bar on the dashboard subscription card.
- Add **auto-renew** flag + a scheduled job (e.g. `node-cron`) to renew and deduct from wallet automatically.
- Send an **expiry reminder** via email (nodemailer) 3 and 1 days before end date.
- Subscription card on dashboard should show the exact zones it covers (all three for now, or per-zone for resident permits).
- Yearly plan should show projected savings vs monthly (e.g. "saves €49 vs monthly").

---

## 6. General / Infrastructure

| Item | Status | Notes |
|---|---|---|
| Flat-file JSON persistence | Working, dev-only | Migrate to PostgreSQL + Prisma when going to production |
| Stripe Elements frontend | Missing | Backend is ready; frontend needs `@stripe/react-stripe-js` |
| Push / email notifications | Missing | Add nodemailer + SendGrid for session receipts and expiry reminders |
| Rate limiting | Missing | Add `express-rate-limit` to auth routes |
| CORS | Not configured | Add `cors` middleware with an explicit allow-list |
| HTTPS in dev | Scripts exist | `scripts/generate-dev-cert.sh` — run once, then use `npm run start:https` |
| Admin dashboard | Missing | Route for viewing all sessions, users, revenue |
| Docker | Missing | Add `Dockerfile` + `docker-compose.yml` for local + prod |
| Deployment | Not done | Suitable targets: Railway, Render, or VPS with PM2 |
| ESLint / Prettier | Partial | CRA provides ESLint; add Prettier config for consistent formatting |
| TypeScript | Not adopted | Gradually migrate `server/` to TypeScript with `ts-node` |
| Accessibility | Partial | Add `aria-label` to icon buttons; check color contrast on badge/hint text |
| Dark/light mode toggle | Missing | CSS variables for color tokens; `prefers-color-scheme` media query |

---

## 7. Suggested Implementation Order

1. Fix auth form validation + error UX (fast, high user impact).
2. Replace map with Google Maps + custom heatmap gradient + zone polygons.
3. Rebuild wallet top-up UI with payment method tabs (Apple Pay/Google Pay come "free" via Stripe Elements).
4. Add Aircash redirect tab.
5. Clarify and document subscription/zone rules; add resident permit model.
6. Build tiered rewards system + progress UI.
7. Migrate persistence to PostgreSQL.
8. Add email notifications (session receipts, subscription expiry).
9. Rate limit + CORS + HTTPS in production.
10. Dockerise and deploy.
