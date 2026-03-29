<div align="center">

# 🅿️ Smart Parking Zagreb

### *One app for a smarter parking experience in Zagreb.*

[![Cursor Hackathon Zagreb](https://img.shields.io/badge/Cursor%20Hackathon-Zagreb%202026-blue?style=flat-square)](https://cursor.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Express](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express)](https://expressjs.com)
[![Google Maps](https://img.shields.io/badge/Google%20Maps-API-4285F4?style=flat-square&logo=googlemaps&logoColor=white)](https://developers.google.com/maps)

</div>

---

## The Problem

Parking in Zagreb is more fragmented than it should be. Drivers need to understand parking zones, estimate availability, manage payments, and keep track of subscriptions or permits, often with very little context and too much friction.

That leads to a frustrating experience where people waste time figuring out where to park, how much they will pay, and whether a location is even worth driving to.

## The Solution

A single web app that improves the classic city parking flow with a smarter, more user-friendly experience. Instead of being just a payment tool, Smart Parking Zagreb combines parking management, map-based discovery, and crowdsourced context into one place.

Through three core experiences:

- **Crowdsourced occupancy insights** — estimate how busy selected streets and areas are
- **Interactive parking map** — explore parking zones, selected streets, Street View, and route context
- **Smart parking flow** — manage wallet balance, parking sessions, subscriptions, and rewards in one app

---

## Demo

📹 **[SmartPark.mp4](SmartPark.mp4)** — watch the full demo

---

## Features

| | Feature | Description |
|---|---|---|
| 🗺️ | **Interactive parking map** | Explore Zagreb parking zones, streets, selected locations, and nearby context on Google Maps |
| 📊 | **Crowdsourced occupancy insights** | View estimated occupancy and available spots for selected streets and areas |
| 💳 | **Wallet payments** | Top up balance and use it to pay for parking sessions |
| ⏱️ | **Parking session flow** | Start and stop parking sessions directly from the app |
| 🎁 | **Rewards system** | Earn and redeem perks tied to parking activity and account usage |
| 🏙️ | **Zone-aware pricing** | Pricing logic follows Zagreb parking zone rules |
| 🔐 | **User accounts** | Sign in and manage parking actions through an authenticated profile |
| 🧭 | **Street View and directions** | Get better context before parking and open directions quickly |

---

## Tech Stack

```text
Backend    →  Node.js · Express
Frontend   →  React · React Router · CSS
Maps       →  Google Maps API
Auth       →  JWT
Payments   →  Wallet flow + optional Stripe integration
Data       →  JSON store + generated street occupancy dataset
```

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Run the app
npm start
```

Then open:

- Frontend: `http://localhost:4001`
- Backend API: `http://localhost:4000`

---

<div align="center">

Built with ❤️ at the **Cursor Hackathon Zagreb** · March 28, 2026

*Theme: Build Something Zagreb Wants*

---

**Team**

[Borna Oršulić](https://www.linkedin.com/in/borna-or%C5%A1uli%C4%87-1680aa370/) · [Karlo Kovačić](https://www.linkedin.com/in/karlo-kovacic-05a550387/)

</div>
