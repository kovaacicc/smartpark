require("dotenv").config();

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { mutateStore, readStore } = require("./db");

const PORT = Number(process.env.PORT) || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-change-me";
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? require("stripe")(stripeSecret) : null;

const REWARDS = [
  {
    id: "wallet_2eur",
    label: "€2 wallet credit",
    description: "Adds €2 to your wallet.",
    costPoints: 200,
    type: "wallet",
    value: 2,
  },
  {
    id: "parking_10pct",
    label: "10% off next parking",
    description: "Applies to your next completed session.",
    costPoints: 120,
    type: "discount",
    value: 10,
  },
  {
    id: "free_next_session",
    label: "Free next parking session",
    description: "Your next parking session has no charge.",
    costPoints: 400,
    type: "free_parking",
    value: 1,
  },
];

const SUBSCRIPTION_PRICING = { monthly: 29, yearly: 299 };

function round2(n) {
  return Math.round(n * 100) / 100;
}

function ceilHours(durationMs) {
  return Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60)));
}

/** Zagreb zone rules: z1 hourly up to 2h then day; z2 up to 3h then day; z3 hourly all day */
function baseParkingCharge(zone, durationMs) {
  const z = Number(zone);
  const h = ceilHours(durationMs);
  if (z === 1) return h <= 2 ? round2(h * 1.6) : 16;
  if (z === 2) return h <= 3 ? round2(h * 0.7) : 8;
  if (z === 3) return round2(h * 0.12);
  return round2(h * 0.12);
}

function getActiveSubscription(store, userId) {
  const now = Date.now();
  return store.subscriptions.find(
    (s) => s.userId === userId && new Date(s.endDate).getTime() > now
  );
}

function sanitizeUser(u) {
  if (!u) return null;
  const {
    id,
    email,
    name,
    walletBalance,
    rewardPoints,
    pendingParkingDiscountPercent,
    freeNextParking,
  } = u;
  return {
    id,
    email,
    name,
    walletBalance,
    rewardPoints,
    pendingParkingDiscountPercent: pendingParkingDiscountPercent || 0,
    freeNextParking: !!freeNextParking,
  };
}

function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }
  const token = h.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

const app = express();
app.use(express.json({ limit: "1mb" }));

app.post("/api/register", (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });
  try {
    const out = mutateStore((store) => {
      if (store.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
        throw new Error("EMAIL_TAKEN");
      }
      const id = crypto.randomUUID();
      const passwordHash = bcrypt.hashSync(String(password), 10);
      store.users.push({
        id,
        email: String(email).trim().toLowerCase(),
        passwordHash,
        name: (name && String(name).trim()) || "Driver",
        walletBalance: 0,
        rewardPoints: 50,
        pendingParkingDiscountPercent: 0,
        freeNextParking: false,
      });
      return id;
    });
    const userId = out;
    const user = readStore().users.find((u) => u.id === userId);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
    return res.json({ token, user: sanitizeUser(user) });
  } catch (e) {
    if (e.message === "EMAIL_TAKEN")
      return res.status(409).json({ error: "Email already registered" });
    return res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });
  const store = readStore();
  const user = store.users.find(
    (u) => u.email.toLowerCase() === String(email).toLowerCase()
  );
  if (!user || !bcrypt.compareSync(String(password), user.passwordHash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
  return res.json({ token, user: sanitizeUser(user) });
});

app.get("/api/user", authMiddleware, (req, res) => {
  const store = readStore();
  const user = store.users.find((u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json(sanitizeUser(user));
});

app.put("/api/user", authMiddleware, (req, res) => {
  const { name, email } = req.body || {};
  mutateStore((store) => {
    const user = store.users.find((u) => u.id === req.userId);
    if (!user) return;
    if (typeof name === "string" && name.trim()) user.name = name.trim();
    if (typeof email === "string" && email.trim()) {
      const next = email.trim().toLowerCase();
      if (!store.users.some((u) => u.id !== user.id && u.email === next))
        user.email = next;
    }
  });
  const user = readStore().users.find((u) => u.id === req.userId);
  return res.json(sanitizeUser(user));
});

app.get("/api/cars", authMiddleware, (req, res) => {
  const store = readStore();
  return res.json(store.cars.filter((c) => c.userId === req.userId));
});

app.post("/api/cars", authMiddleware, (req, res) => {
  const { plate, label } = req.body || {};
  if (!plate || !String(plate).trim())
    return res.status(400).json({ error: "Plate required" });
  const car = mutateStore((store) => {
    const c = {
      id: crypto.randomUUID(),
      userId: req.userId,
      plate: String(plate).trim().toUpperCase(),
      label: label ? String(label).trim() : "",
    };
    store.cars.push(c);
    return c;
  });
  return res.json(car);
});

app.delete("/api/cars/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  mutateStore((store) => {
    store.cars = store.cars.filter((c) => !(c.id === id && c.userId === req.userId));
  });
  return res.json({ ok: true });
});

function addTransaction(store, userId, type, amount, description) {
  const t = {
    id: crypto.randomUUID(),
    userId,
    type,
    amount: round2(amount),
    description,
    createdAt: new Date().toISOString(),
  };
  store.transactions.push(t);
  return t;
}

app.get("/api/wallet", authMiddleware, (req, res) => {
  const store = readStore();
  const user = store.users.find((u) => u.id === req.userId);
  const txs = store.transactions
    .filter((t) => t.userId === req.userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json({
    balance: user ? round2(user.walletBalance) : 0,
    transactions: txs,
  });
});

app.post("/api/wallet/add", authMiddleware, async (req, res) => {
  const { amount, paymentMethodId } = req.body || {};
  const a = Number(amount);
  if (!Number.isFinite(a) || a <= 0 || a > 500)
    return res.status(400).json({ error: "Invalid amount (max 500)" });

  if (stripe && !paymentMethodId) {
    return res.status(400).json({ error: "paymentMethodId required when Stripe is enabled" });
  }
  if (stripe && paymentMethodId) {
    try {
      await stripe.paymentIntents.create({
        amount: Math.round(a * 100),
        currency: "eur",
        payment_method: paymentMethodId,
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      });
    } catch (e) {
      return res.status(400).json({ error: e.message || "Stripe payment failed" });
    }
  }

  const balance = mutateStore((store) => {
    const user = store.users.find((u) => u.id === req.userId);
    if (!user) return 0;
    user.walletBalance = round2(user.walletBalance + a);
    addTransaction(store, user.id, "credit", a, stripe ? "Wallet top-up (Stripe)" : "Wallet top-up (dev)");
    user.rewardPoints = Math.min(99999, user.rewardPoints + Math.floor(a));
    return user.walletBalance;
  });
  return res.json({ balance, devMode: !stripe });
});

app.get("/api/subscription", authMiddleware, (req, res) => {
  const store = readStore();
  const sub = getActiveSubscription(store, req.userId);
  return res.json({ active: !!sub, subscription: sub || null });
});

app.post("/api/subscription", authMiddleware, (req, res) => {
  const { plan } = req.body || {};
  if (plan !== "monthly" && plan !== "yearly")
    return res.status(400).json({ error: "plan must be monthly or yearly" });
  try {
    const price = SUBSCRIPTION_PRICING[plan];
    const sub = mutateStore((store) => {
      const user = store.users.find((u) => u.id === req.userId);
      if (!user) throw new Error("NO_USER");
      if (user.walletBalance < price) throw new Error("INSUFFICIENT");
      user.walletBalance = round2(user.walletBalance - price);
      addTransaction(store, user.id, "debit", -price, `Subscription (${plan})`);
      const start = new Date();
      const end = new Date(start);
      if (plan === "monthly") end.setMonth(end.getMonth() + 1);
      else end.setFullYear(end.getFullYear() + 1);
      const s = {
        id: crypto.randomUUID(),
        userId: user.id,
        plan,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      };
      store.subscriptions.push(s);
      user.rewardPoints += plan === "yearly" ? 200 : 50;
      return s;
    });
    return res.json({ subscription: sub });
  } catch (e) {
    if (e.message === "INSUFFICIENT")
      return res.status(400).json({ error: "Insufficient wallet balance" });
    return res.status(400).json({ error: "Could not purchase subscription" });
  }
});

app.get("/api/rewards", authMiddleware, (req, res) => {
  const store = readStore();
  const user = store.users.find((u) => u.id === req.userId);
  const redemptions = store.rewardRedemptions.filter((r) => r.userId === req.userId);
  return res.json({
    points: user?.rewardPoints ?? 0,
    catalog: REWARDS,
    redemptions,
  });
});

app.post("/api/rewards/redeem", authMiddleware, (req, res) => {
  const { rewardId } = req.body || {};
  const def = REWARDS.find((r) => r.id === rewardId);
  if (!def) return res.status(400).json({ error: "Unknown reward" });
  try {
    const result = mutateStore((store) => {
      const user = store.users.find((u) => u.id === req.userId);
      if (!user) throw new Error("NO_USER");
      if (user.rewardPoints < def.costPoints) throw new Error("POINTS");
      user.rewardPoints -= def.costPoints;
      if (def.type === "wallet") {
        user.walletBalance = round2(user.walletBalance + def.value);
        addTransaction(store, user.id, "credit", def.value, `Reward: ${def.label}`);
      } else if (def.type === "discount") {
        user.pendingParkingDiscountPercent = Math.min(
          90,
          (user.pendingParkingDiscountPercent || 0) + def.value
        );
      } else if (def.type === "free_parking") {
        user.freeNextParking = true;
      }
      const redemption = {
        id: crypto.randomUUID(),
        userId: user.id,
        rewardId: def.id,
        createdAt: new Date().toISOString(),
      };
      store.rewardRedemptions.push(redemption);
      return { redemption, user: sanitizeUser(user) };
    });
    return res.json(result);
  } catch (e) {
    if (e.message === "POINTS")
      return res.status(400).json({ error: "Not enough points" });
    return res.status(400).json({ error: "Could not redeem" });
  }
});

app.get("/api/parking/session", authMiddleware, (req, res) => {
  const store = readStore();
  const session = store.parkingSessions.find(
    (s) => s.userId === req.userId && s.status === "active"
  );
  return res.json({ session: session || null });
});

app.post("/api/parking/start", authMiddleware, (req, res) => {
  const { carId, zone, lat, lon, streetName } = req.body || {};
  const store = readStore();
  if (store.parkingSessions.some((s) => s.userId === req.userId && s.status === "active")) {
    return res.status(400).json({ error: "Already have an active session" });
  }
  const car = store.cars.find((c) => c.id === carId && c.userId === req.userId);
  if (!car) return res.status(400).json({ error: "Invalid car" });
  const z = Number(zone);
  if (![1, 2, 3].includes(z)) return res.status(400).json({ error: "Zone must be 1, 2, or 3" });
  const session = mutateStore((store) => {
    const sess = {
      id: crypto.randomUUID(),
      userId: req.userId,
      carId,
      zone: z,
      lat: lat != null ? Number(lat) : null,
      lon: lon != null ? Number(lon) : null,
      streetName: streetName ? String(streetName) : "",
      startTime: new Date().toISOString(),
      endTime: null,
      status: "active",
      chargeAmount: null,
    };
    store.parkingSessions.push(sess);
    return sess;
  });
  return res.json({ session });
});

app.post("/api/parking/stop", authMiddleware, (req, res) => {
  const store = readStore();
  const session = store.parkingSessions.find(
    (s) => s.userId === req.userId && s.status === "active"
  );
  if (!session) return res.status(400).json({ error: "No active parking session" });
  const end = Date.now();
  const start = new Date(session.startTime).getTime();
  const durationMs = Math.max(0, end - start);

  const sub = getActiveSubscription(store, req.userId);
  const user = store.users.find((u) => u.id === req.userId);
  const rawBase = baseParkingCharge(session.zone, durationMs);
  let charge = rawBase;
  let breakdown = {
    base: rawBase,
    subscriptionWaived: false,
    rewardWaived: false,
    discountApplied: 0,
  };

  if (sub) {
    charge = 0;
    breakdown.subscriptionWaived = true;
  } else if (user.freeNextParking) {
    charge = 0;
    breakdown.rewardWaived = true;
  } else {
    const pct = user.pendingParkingDiscountPercent || 0;
    if (pct > 0) {
      const discounted = round2(charge * (1 - pct / 100));
      breakdown.discountApplied = round2(charge - discounted);
      charge = discounted;
    }
  }

  try {
    const receipt = mutateStore((st) => {
      const u = st.users.find((x) => x.id === req.userId);
      const sess = st.parkingSessions.find((x) => x.id === session.id);
      if (!sess || sess.status !== "active") throw new Error("GONE");

      if (charge > 0 && u.walletBalance < charge) throw new Error("FUNDS");

      if (charge > 0) {
        u.walletBalance = round2(u.walletBalance - charge);
        addTransaction(st, u.id, "debit", -charge, `Parking zone ${sess.zone}`);
      }
      u.rewardPoints += Math.max(1, Math.floor(durationMs / (1000 * 60 * 15)));

      if (breakdown.rewardWaived) u.freeNextParking = false;
      if (breakdown.discountApplied > 0) u.pendingParkingDiscountPercent = 0;

      sess.endTime = new Date(end).toISOString();
      sess.status = "completed";
      sess.chargeAmount = charge;
      sess.durationMs = durationMs;
      return {
        session: sess,
        charge,
        breakdown: { ...breakdown, durationMs },
        user: sanitizeUser(u),
      };
    });
    return res.json(receipt);
  } catch (e) {
    if (e.message === "FUNDS")
      return res.status(400).json({
        error: "Insufficient wallet balance to end session",
        required: charge,
      });
    return res.status(400).json({ error: "Could not stop session" });
  }
});

app.get("/api/places/search", authMiddleware, async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  if (q.length < 3)
    return res.status(400).json({ error: "Query too short" });
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "8");
    url.searchParams.set("q", `${q}, Zagreb, Croatia`);
    const r = await fetch(url.toString(), {
      headers: {
        "User-Agent": "parking-app/1.0 (portfolio demo)",
      },
    });
    if (!r.ok) throw new Error("nominatim error");
    const data = await r.json();
    const places = data.map((p) => ({
      label: p.display_name,
      lat: Number(p.lat),
      lon: Number(p.lon),
    }));
    return res.json({ places });
  } catch {
    return res.status(502).json({ error: "Search failed" });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
