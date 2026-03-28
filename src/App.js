import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import "./App.css";

const TOKEN_KEY = "parking_token";

const AuthContext = createContext(null);

function useAuth() {
  return useContext(AuthContext);
}

async function api(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = (data && data.error) || res.statusText || "Request failed";
    throw new Error(msg);
  }
  return data;
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function formatEuro(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("hr-HR", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [booting, setBooting] = useState(!!localStorage.getItem(TOKEN_KEY));

  const setToken = useCallback((t) => {
    setTokenState(t);
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      setBooting(false);
      return;
    }
    try {
      const u = await api("/api/user");
      setUser(u);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setBooting(false);
    }
  }, [setToken, token]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const loginWith = useCallback(
    ({ token: t, user: u }) => {
      setToken(t);
      setUser(u);
      setBooting(false);
    },
    [setToken]
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, [setToken]);

  const value = useMemo(
    () => ({
      user,
      token,
      booting,
      loginWith,
      logout,
      refreshUser,
      setUser,
    }),
    [user, token, booting, loginWith, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function ProtectedRoute({ children }) {
  const { token, booting } = useAuth();
  if (booting) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function LandingPage() {
  const { token } = useAuth();
  if (token) return <Navigate to="/dashboard" replace />;
  return (
    <div className="landing">
      <span className="badge">Zagreb</span>
      <h1>Smart Parking</h1>
      <p>
        Wallet-funded parking, subscriptions, rewards, and a live occupancy map
        tuned for zones 1–3. Built for learning and portfolio demos.
      </p>
      <div className="btn-row">
        <Link className="btn btn-primary" to="/register">
          Create account
        </Link>
        <Link className="btn btn-ghost" to="/login">
          Sign in
        </Link>
      </div>
    </div>
  );
}

function LoginPage() {
  const nav = useNavigate();
  const { loginWith, token } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  if (token) return <Navigate to="/dashboard" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const data = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      loginWith(data);
      nav("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 420, margin: "2rem auto" }}>
        <h2>Sign in</h2>
        <form className="form" onSubmit={onSubmit} style={{ maxWidth: "none" }}>
          <div>
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error ? <div className="error">{error}</div> : null}
          <button className="btn btn-primary" type="submit">
            Continue
          </button>
          <p className="muted">
            No account? <Link to="/register">Register</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function RegisterPage() {
  const nav = useNavigate();
  const { loginWith, token } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  if (token) return <Navigate to="/dashboard" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const data = await api("/api/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      loginWith(data);
      nav("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 420, margin: "2rem auto" }}>
        <h2>Create account</h2>
        <form className="form" onSubmit={onSubmit} style={{ maxWidth: "none" }}>
          <div>
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {error ? <div className="error">{error}</div> : null}
          <button className="btn btn-primary" type="submit">
            Register
          </button>
          <p className="muted">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

const AMOUNT_CHIPS = [5, 10, 20, 50, 100, 200];

function fmtCardNumber(raw) {
  return raw
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function fmtExpiry(raw) {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d;
}

function fmtCvc(raw) {
  return raw.replace(/\D/g, "").slice(0, 4);
}

function detectCardBrand(num) {
  const n = num.replace(/\s/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^5[1-5]/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  if (/^6(?:011|5)/.test(n)) return "Discover";
  return "";
}

function TopUpModal({ onClose, onSuccess }) {
  const [amount, setAmount] = useState(20);
  const [customAmt, setCustomAmt] = useState("");
  const [method, setMethod] = useState("card");
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [aircashPhone, setAircashPhone] = useState("");
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const displayAmount = customAmt !== "" ? Number(customAmt) : amount;
  const brand = detectCardBrand(cardNumber);

  function validate() {
    if (!Number.isFinite(displayAmount) || displayAmount < 1 || displayAmount > 500) {
      setError("Amount must be between €1 and €500.");
      return false;
    }
    if (method === "card") {
      if (!cardName.trim()) { setError("Enter the cardholder name."); return false; }
      if (cardNumber.replace(/\s/g, "").length < 13) { setError("Enter a valid card number."); return false; }
      if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) { setError("Enter expiry as MM/YY."); return false; }
      const [mm, yy] = cardExpiry.split("/").map(Number);
      const now = new Date();
      const expYear = 2000 + yy;
      if (mm < 1 || mm > 12 || expYear < now.getFullYear() || (expYear === now.getFullYear() && mm < now.getMonth() + 1)) {
        setError("Card appears to be expired."); return false;
      }
      if (cardCvc.length < 3) { setError("Enter your CVV (3–4 digits)."); return false; }
    }
    if (method === "aircash") {
      if (!/^\+?[\d\s\-]{7,}$/.test(aircashPhone)) { setError("Enter a valid phone number."); return false; }
    }
    return true;
  }

  async function submit() {
    setError("");
    if (!validate()) return;
    setProcessing(true);
    try {
      await api("/api/wallet/add", {
        method: "POST",
        body: JSON.stringify({ amount: displayAmount }),
      });
      setDone(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1800);
    } catch (e) {
      setError(e.message);
    } finally {
      setProcessing(false);
    }
  }

  const METHODS = [
    { id: "card", label: "Card" },
    { id: "apple", label: "Apple Pay" },
    { id: "google", label: "Google Pay" },
    { id: "aircash", label: "Aircash" },
  ];

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Add funds">
        <div className="modal-header">
          <span className="modal-title">Add funds</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          {done ? (
            <div className="pay-success">
              <div className="pay-success-icon">✓</div>
              <p>{formatEuro(displayAmount)} added to your wallet</p>
            </div>
          ) : (
            <>
              <p className="modal-section-label">Amount</p>
              <div className="amount-chips">
                {AMOUNT_CHIPS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={`chip${amount === a && customAmt === "" ? " active" : ""}`}
                    onClick={() => { setAmount(a); setCustomAmt(""); setError(""); }}
                  >
                    €{a}
                  </button>
                ))}
              </div>
              <div className="custom-amount-wrap">
                <span className="custom-amount-prefix">€</span>
                <input
                  className="custom-amount-input"
                  placeholder="Custom amount"
                  inputMode="decimal"
                  value={customAmt}
                  onChange={(e) => { setCustomAmt(e.target.value.replace(/[^\d.]/g, "")); setError(""); }}
                />
              </div>

              <p className="modal-section-label" style={{ marginTop: "1.25rem" }}>Payment method</p>
              <div className="method-tabs">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`method-tab${method === m.id ? " active" : ""}`}
                    onClick={() => { setMethod(m.id); setError(""); }}
                  >
                    {m.id === "apple" && <AppleIcon />}
                    {m.id === "google" && <GoogleIcon />}
                    {m.id === "aircash" && <AircashIcon />}
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="method-body">
                {method === "card" && (
                  <div className="card-form">
                    <div className="card-preview">
                      <div className="card-preview-chip" />
                      <div className="card-preview-brand">{brand || "CARD"}</div>
                      <div className="card-preview-number">
                        {cardNumber
                          ? cardNumber.padEnd(19, " ").replace(/(.{4})/g, "$1 ").trim()
                          : "•••• •••• •••• ••••"}
                      </div>
                      <div className="card-preview-footer">
                        <div>
                          <div className="card-preview-hint">CARDHOLDER</div>
                          <div className="card-preview-value">{cardName || "FULL NAME"}</div>
                        </div>
                        <div>
                          <div className="card-preview-hint">EXPIRES</div>
                          <div className="card-preview-value">{cardExpiry || "MM/YY"}</div>
                        </div>
                      </div>
                    </div>

                    <div className="field-group">
                      <label className="field-label">Cardholder name</label>
                      <input
                        className="field-input"
                        placeholder="John Smith"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        autoComplete="cc-name"
                      />
                    </div>
                    <div className="field-group">
                      <label className="field-label">Card number</label>
                      <input
                        className="field-input"
                        placeholder="1234 5678 9012 3456"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(fmtCardNumber(e.target.value))}
                        inputMode="numeric"
                        autoComplete="cc-number"
                      />
                    </div>
                    <div className="field-row">
                      <div className="field-group" style={{ flex: 1 }}>
                        <label className="field-label">Expiry</label>
                        <input
                          className="field-input"
                          placeholder="MM/YY"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(fmtExpiry(e.target.value))}
                          inputMode="numeric"
                          autoComplete="cc-exp"
                        />
                      </div>
                      <div className="field-group" style={{ flex: 1 }}>
                        <label className="field-label">CVV</label>
                        <input
                          className="field-input"
                          placeholder="•••"
                          type="password"
                          value={cardCvc}
                          onChange={(e) => setCardCvc(fmtCvc(e.target.value))}
                          autoComplete="cc-csc"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {method === "apple" && (
                  <div className="express-pay-wrap">
                    <p className="muted" style={{ textAlign: "center", marginBottom: "1rem" }}>
                      Authenticate with Face ID or Touch ID to confirm {formatEuro(displayAmount)}.
                    </p>
                    <button type="button" className="btn-apple-pay" onClick={submit} disabled={processing}>
                      <AppleIcon color="#fff" size={20} />
                      {processing ? "Processing…" : "Pay"}
                    </button>
                  </div>
                )}

                {method === "google" && (
                  <div className="express-pay-wrap">
                    <p className="muted" style={{ textAlign: "center", marginBottom: "1rem" }}>
                      Complete payment with your saved Google Pay card.
                    </p>
                    <button type="button" className="btn-google-pay" onClick={submit} disabled={processing}>
                      <GoogleIcon size={20} />
                      {processing ? "Processing…" : <><span style={{ color: "#4285F4" }}>G</span><span style={{ color: "#EA4335" }}>o</span><span style={{ color: "#FBBC05" }}>o</span><span style={{ color: "#34A853" }}>g</span><span style={{ color: "#4285F4" }}>l</span><span style={{ color: "#EA4335" }}>e</span>&nbsp;Pay</>}
                    </button>
                  </div>
                )}

                {method === "aircash" && (
                  <div className="card-form">
                    <div className="aircash-logo-wrap">
                      <AircashIcon size={28} />
                      <span className="aircash-brand">Aircash</span>
                    </div>
                    <p className="muted" style={{ fontSize: "0.85rem", margin: "0.5rem 0 1rem" }}>
                      Enter the phone number linked to your Aircash wallet. A payment request will be sent to your Aircash app.
                    </p>
                    <div className="field-group">
                      <label className="field-label">Phone number</label>
                      <input
                        className="field-input"
                        placeholder="+385 91 234 5678"
                        value={aircashPhone}
                        onChange={(e) => setAircashPhone(e.target.value)}
                        inputMode="tel"
                        autoComplete="tel"
                      />
                    </div>
                    <p className="hint" style={{ marginTop: "0.5rem" }}>
                      Aircash is available in Croatia, Bosnia & Herzegovina, Slovenia, and Serbia.
                    </p>
                  </div>
                )}
              </div>

              {error && <p className="pay-error">{error}</p>}

              {(method === "card" || method === "aircash") && (
                <button
                  type="button"
                  className="btn btn-primary pay-submit"
                  disabled={processing}
                  onClick={submit}
                >
                  {processing ? (
                    <span className="pay-spinner" />
                  ) : (
                    `Pay ${formatEuro(displayAmount)}`
                  )}
                </button>
              )}

              <p className="pay-secure-note">
                🔒 Demo mode — no real charge is made
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AppleIcon({ color = "currentColor", size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 814 1000" fill={color} aria-hidden="true">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.5-42.8-154.6-109.3C149.3 698 82 498.4 82 317.2c0-190.9 124.7-292.1 247.9-292.1 62.9 0 115.2 41.5 155.1 41.5 37.8 0 96.7-43.7 166.3-43.7 27.5 0 117.2 1.9 176.7 86.2z" />
      <path d="M665 220.7c-25.8-29.1-59.5-52.5-108.9-52.5-76.5 0-138.8 53.5-176.5 53.5-40.2 0-95.6-48.4-165.9-48.4-98.8 0-241.3 80.1-241.3 275.9 0 113.3 44.6 233.1 99.7 311.9 47.5 66.9 89 105.8 149.7 105.8 61.1 0 90.8-40.8 163.9-40.8 71.9 0 91.9 40.1 165.9 40.1 72.4 0 121.9-64.5 162.9-124.6 43.9-67.7 61.9-133.6 63.5-136.2-.8-.4-120.5-48.8-120.5-188.6 0-126.6 93.7-183.3 98.5-186.1z" />
    </svg>
  );
}

function GoogleIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function AircashIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="8" fill="#DC2626" />
      <text x="20" y="27" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#fff">A</text>
    </svg>
  );
}

function DashboardPage() {
  const { user, refreshUser, setUser, logout } = useAuth();
  const [cars, setCars] = useState([]);
  const [wallet, setWallet] = useState({ balance: 0, transactions: [] });
  const [sub, setSub] = useState({ active: false, subscription: null });
  const [rewards, setRewards] = useState({ points: 0, catalog: [], redemptions: [] });
  const [session, setSession] = useState(null);
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profileEmail, setProfileEmail] = useState(user?.email || "");
  const [carPlate, setCarPlate] = useState("");
  const [showTopUp, setShowTopUp] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  async function reload() {
    const [c, w, s, r, ps] = await Promise.all([
      api("/api/cars"),
      api("/api/wallet"),
      api("/api/subscription"),
      api("/api/rewards"),
      api("/api/parking/session"),
    ]);
    setCars(c);
    setWallet(w);
    setSub(s);
    setRewards(r);
    setSession(ps.session);
    await refreshUser();
  }

  useEffect(() => {
    setProfileName(user?.name || "");
    setProfileEmail(user?.email || "");
  }, [user]);

  useEffect(() => {
    reload().catch(() => {});
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setBusy("profile");
    setMsg("");
    try {
      const u = await api("/api/user", {
        method: "PUT",
        body: JSON.stringify({ name: profileName, email: profileEmail }),
      });
      setUser(u);
      setMsg("Profile saved.");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy("");
    }
  }

  async function addCar(e) {
    e.preventDefault();
    if (!carPlate.trim()) return;
    setBusy("car");
    setMsg("");
    try {
      await api("/api/cars", {
        method: "POST",
        body: JSON.stringify({ plate: carPlate }),
      });
      setCarPlate("");
      await reload();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy("");
    }
  }

  async function removeCar(id) {
    setBusy("car");
    try {
      await api(`/api/cars/${id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy("");
    }
  }

  async function buySub(plan) {
    setBusy("sub");
    setMsg("");
    try {
      await api("/api/subscription", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      setMsg(`Subscription (${plan}) activated.`);
      await reload();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy("");
    }
  }

  async function redeem(id) {
    setBusy("rew");
    setMsg("");
    try {
      await api("/api/rewards/redeem", {
        method: "POST",
        body: JSON.stringify({ rewardId: id }),
      });
      setMsg("Reward redeemed.");
      await reload();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy("");
    }
  }

  async function stopParking() {
    setBusy("park");
    setMsg("");
    try {
      const rec = await api("/api/parking/stop", { method: "POST", body: JSON.stringify({}) });
      let note = `Session ended. Charged ${formatEuro(rec.charge)}.`;
      if (rec.breakdown?.subscriptionWaived) note = "Session ended. Free with subscription.";
      else if (rec.breakdown?.freeFirstHourApplied) note = `Session ended. Saved ${formatEuro(rec.breakdown.freeFirstHourSaving)} (1h free reward). Charged ${formatEuro(rec.charge)}.`;
      else if (rec.breakdown?.zone2ExtApplied) note = `Session ended. Saved ${formatEuro(rec.breakdown.zone2ExtSaving)} (4th hour 50% off). Charged ${formatEuro(rec.charge)}.`;
      setMsg(note);
      await reload();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="page">
      {showTopUp && (
        <TopUpModal
          onClose={() => setShowTopUp(false)}
          onSuccess={async () => {
            setMsg("Funds added successfully.");
            await reload();
          }}
        />
      )}

      <div className="card-grid">
        <div className="card wallet-card-outer">
          <div className="wallet-tile">
            <div className="wallet-tile-top">
              <span className="wallet-tile-label">Smart Parking Wallet</span>
              <span className="wallet-tile-logo">SP</span>
            </div>
            <div className="wallet-tile-balance">{formatEuro(wallet.balance)}</div>
            <div className="wallet-tile-bottom">
              <span className="wallet-tile-sub">Available balance</span>
              <div className="wallet-tile-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary wallet-add-btn"
            onClick={() => setShowTopUp(true)}
          >
            + Add funds
          </button>

          <div className="wallet-pay-icons">
            <span className="wallet-pay-icon apple">
              <AppleIcon size={13} />
              <span>Apple Pay</span>
            </span>
            <span className="wallet-pay-icon google">
              <GoogleIcon size={13} />
              <span>Google Pay</span>
            </span>
            <span className="wallet-pay-icon aircash">
              <AircashIcon size={13} />
              <span>Aircash</span>
            </span>
            <span className="wallet-pay-icon card-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="1" y="4" width="22" height="16" rx="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              <span>Card</span>
            </span>
          </div>

          <h3 className="muted" style={{ margin: "1rem 0 0.35rem", fontSize: "0.82rem", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Recent transactions
          </h3>
          <ul className="tx-list">
            {wallet.transactions.length === 0 && (
              <li><span className="muted">No transactions yet.</span></li>
            )}
            {wallet.transactions.slice(0, 8).map((t) => (
              <li key={t.id}>
                <div className="tx-desc">
                  <span className={`tx-dot ${t.amount >= 0 ? "pos" : "neg"}`} />
                  <span>{t.description}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className={t.amount >= 0 ? "tx-amount-pos" : "tx-amount-neg"}>
                    {t.amount >= 0 ? "+" : ""}{formatEuro(t.amount)}
                  </span>
                  <div className="muted" style={{ fontSize: "0.75rem" }}>
                    {new Date(t.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2>Rewards</h2>
          <div className="reward-points-row">
            <span className="reward-points-value">{rewards.points}</span>
            <span className="muted">pts available</span>
          </div>
          <div className="reward-catalog">
            {rewards.catalog.map((r) => {
              const isActive =
                (r.type === "free_first_hour" && user?.freeFirstHour) ||
                (r.type === "zone2_extension" && user?.zone2FourthHourHalf);
              const canAfford = rewards.points >= r.costPoints;
              return (
                <div key={r.id} className={`reward-item${isActive ? " reward-active" : ""}`}>
                  <div className="reward-item-header">
                    <div className="reward-item-title-row">
                      <span className="reward-item-label">{r.label}</span>
                      {isActive && <span className="reward-active-badge">Active</span>}
                    </div>
                    <span className="reward-item-pts">{r.costPoints} pts</span>
                  </div>
                  <p className="reward-item-desc">{r.description}</p>
                  <button
                    type="button"
                    className={`btn ${isActive ? "btn-ghost" : canAfford ? "btn-primary" : "btn-ghost"} reward-redeem-btn`}
                    disabled={!!busy || !canAfford || isActive}
                    onClick={() => redeem(r.id)}
                  >
                    {isActive ? "✓ Activated" : canAfford ? "Redeem" : `Need ${r.costPoints - rewards.points} more pts`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h2>Subscription</h2>
          {sub.active ? (
            <p>
              Active <span className="badge">{sub.subscription.plan}</span> until{" "}
              {new Date(sub.subscription.endDate).toLocaleDateString()}
            </p>
          ) : (
            <p className="muted">No active pass. Parking is billed per session.</p>
          )}
          <div className="row" style={{ marginTop: "0.75rem" }}>
            <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => buySub("monthly")}>
              Monthly · €29
            </button>
            <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => buySub("yearly")}>
              Yearly · €299
            </button>
          </div>
          <p className="hint">Paid from wallet balance.</p>
        </div>

        <div className="card">
          <h2>Parking session</h2>
          {session ? (
            <>
              <p>
                Zone {session.zone} · started {new Date(session.startTime).toLocaleString()}
              </p>
              <p className="muted">{session.streetName || "Custom location"}</p>
              {(user?.freeFirstHour || user?.zone2FourthHourHalf) && (
                <div className="session-reward-notice">
                  {user?.freeFirstHour && (
                    <span className="session-reward-tag">🎁 1h free applies</span>
                  )}
                  {user?.zone2FourthHourHalf && session.zone === 2 && (
                    <span className="session-reward-tag">🎁 4th hour 50% off applies</span>
                  )}
                </div>
              )}
              <button type="button" className="btn btn-danger" disabled={!!busy} onClick={stopParking}>
                Stop &amp; charge wallet
              </button>
            </>
          ) : (
            <>
              <p className="muted">No active session. Start one from the map.</p>
              {(user?.freeFirstHour || user?.zone2FourthHourHalf) && (
                <div className="session-reward-notice">
                  {user?.freeFirstHour && (
                    <span className="session-reward-tag">🎁 1h free ready</span>
                  )}
                  {user?.zone2FourthHourHalf && (
                    <span className="session-reward-tag">🎁 Zone 2 4th hour 50% off ready</span>
                  )}
                </div>
              )}
            </>
          )}
          <Link className="btn btn-primary" to="/parking-map" style={{ marginTop: "0.75rem" }}>
            Open parking map
          </Link>
        </div>

        <div className="card">
          <h2>Vehicles</h2>
          <form className="form" onSubmit={addCar} style={{ maxWidth: "none" }}>
            <div className="row">
              <input
                placeholder="e.g. ZG 1234 AB"
                value={carPlate}
                onChange={(e) => setCarPlate(e.target.value)}
              />
              <button className="btn btn-primary" type="submit" disabled={!!busy}>
                Add
              </button>
            </div>
          </form>
          <ul className="tx-list" style={{ maxHeight: 200 }}>
            {cars.map((c) => (
              <li key={c.id}>
                <span>{c.plate}</span>
                <button type="button" className="btn btn-ghost" onClick={() => removeCar(c.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2>Profile</h2>
          <form className="form" onSubmit={saveProfile} style={{ maxWidth: "none" }}>
            <div>
              <label>Name</label>
              <input value={profileName} onChange={(e) => setProfileName(e.target.value)} />
            </div>
            <div>
              <label>Email</label>
              <input value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} />
            </div>
            <button className="btn btn-ghost" type="submit" disabled={!!busy}>
              Save
            </button>
          </form>
        </div>
      </div>

      {msg ? (
        <p className="muted" style={{ marginTop: "1rem" }}>
          {msg}
        </p>
      ) : null}

      <button
        type="button"
        className="btn btn-ghost"
        style={{ marginTop: "1.5rem" }}
        onClick={logout}
      >
        Log out
      </button>
    </div>
  );
}

function ParkingMapPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const heatRef = useRef(null);
  const pinRef = useRef(null);
  const streetsData = useRef([]);

  const [cars, setCars] = useState([]);
  const [session, setSession] = useState(null);
  const [zone, setZone] = useState(1);
  const [selectedCar, setSelectedCar] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedStreet, setSelectedStreet] = useState(null);
  const [refLocation, setRefLocation] = useState(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const token = localStorage.getItem(TOKEN_KEY);

  const loadContext = useCallback(async () => {
    const [c, ps] = await Promise.all([api("/api/cars"), api("/api/parking/session")]);
    setCars(c);
    setSession(ps.session);
    if (c.length && !selectedCar) setSelectedCar(c[0].id);
  }, [selectedCar]);

  useEffect(() => {
    loadContext().catch(() => {});
  }, [loadContext]);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomControl: true }).setView([45.815, 15.9819], 13);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);
    mapRef.current = map;

    const url = `${process.env.PUBLIC_URL || ""}/streets_with_parking.json`;
    fetch(url)
      .then((r) => r.json())
      .then((rows) => {
        streetsData.current = rows;
        if (heatRef.current) map.removeLayer(heatRef.current);
        const pts = rows.map((s) => [s.lat, s.lon, Math.min(1, s.occupancy || 0.3)]);
        heatRef.current = L.heatLayer(pts, {
          radius: 26,
          blur: 18,
          max: 1,
          minOpacity: 0.35,
        }).addTo(map);
      })
      .catch(() => {});

    return () => {
      if (heatRef.current && mapRef.current) {
        try {
          mapRef.current.removeLayer(heatRef.current);
        } catch {
          /* noop */
        }
      }
      heatRef.current = null;
      if (pinRef.current) {
        try {
          mapRef.current.removeLayer(pinRef.current);
        } catch {
          /* noop */
        }
        pinRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedStreet) return;
    const icon = L.divIcon({
      className: "",
      html: '<div class="pin-marker"></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 24],
    });
    if (pinRef.current) map.removeLayer(pinRef.current);
    pinRef.current = L.marker([selectedStreet.lat, selectedStreet.lon], { icon }).addTo(map);
    map.panInside([selectedStreet.lat, selectedStreet.lon], { padding: [80, 80] });
  }, [selectedStreet]);

  function useGps() {
    if (!navigator.geolocation) {
      setStatus("Geolocation not available.");
      return;
    }
    setStatus("Locating…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setRefLocation(loc);
        mapRef.current?.setView([loc.lat, loc.lon], 15);
        setStatus("Using GPS as reference.");
      },
      () => setStatus("Could not read GPS."),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  useEffect(() => {
    if (!searchQ || searchQ.length < 2) {
      setSuggestions([]);
      return;
    }
    const local = streetsData.current
      .map((s) => ({
        ...s,
        distanceKm: refLocation ? haversineKm(refLocation, s) : 0,
        free: Math.max(0, (s.capacity || 0) - (s.current_cars || 0)),
      }))
      .filter((s) => s.street.toLowerCase().includes(searchQ.toLowerCase()))
      .sort(
        (a, b) => (refLocation ? a.distanceKm - b.distanceKm : b.free - a.free)
      )
      .slice(0, 12);

    const h = setTimeout(async () => {
      let remote = [];
      if (token && searchQ.length >= 3) {
        try {
          const res = await api(`/api/places/search?q=${encodeURIComponent(searchQ)}`);
          remote = (res.places || []).map((p) => ({
            street: p.label,
            lat: p.lat,
            lon: p.lon,
            remote: true,
            distanceKm: refLocation ? haversineKm(refLocation, p) : null,
            capacity: null,
            current_cars: null,
            occupancy: null,
            free: null,
          }));
        } catch {
          /* ignore */
        }
      }
      const merged = [...local, ...remote].slice(0, 14);
      setSuggestions(merged);
    }, 280);

    return () => clearTimeout(h);
  }, [searchQ, refLocation, token]);

  function pickSuggestion(s) {
    setSelectedStreet(s);
    setSearchQ(s.street);
    setSuggestions([]);
    if (!refLocation) setRefLocation({ lat: s.lat, lon: s.lon });
  }

  async function startParking() {
    if (!selectedCar || !cars.find((c) => c.id === selectedCar)) {
      setStatus("Select a vehicle on the dashboard or add one.");
      return;
    }
    const loc = selectedStreet
      ? { lat: selectedStreet.lat, lon: selectedStreet.lon, street: selectedStreet.street }
      : refLocation;
    if (!loc) {
      setStatus("Pick a street or set GPS / search.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      await api("/api/parking/start", {
        method: "POST",
        body: JSON.stringify({
          carId: selectedCar,
          zone,
          lat: loc.lat,
          lon: loc.lon,
          streetName: loc.street || "",
        }),
      });
      setStatus("Parking started.");
      await loadContext();
      await refreshUser();
    } catch (e) {
      setStatus(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function stopParking() {
    setBusy(true);
    setStatus("");
    try {
      const rec = await api("/api/parking/stop", { method: "POST", body: JSON.stringify({}) });
      setStatus(`Stopped. Charged ${formatEuro(rec.charge)}.`);
      await loadContext();
      await refreshUser();
    } catch (e) {
      setStatus(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="map-shell">
      <div className="map-top">
        <div className="row">
          <Link to="/dashboard" className="btn btn-ghost">
            ← Dashboard
          </Link>
          <span className="muted">Wallet {formatEuro(user?.walletBalance)}</span>
        </div>
        <div className="row">
          <button type="button" className="btn btn-ghost" onClick={useGps}>
            Use GPS
          </button>
          {session ? (
            <button type="button" className="btn btn-danger" disabled={busy} onClick={stopParking}>
              Stop parking
            </button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={startParking}>
              Start parking
            </button>
          )}
        </div>
      </div>
      <div className="map-body">
        <aside className="map-panel">
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.05rem" }}>Location</h2>
          <input
            placeholder="Search street or address…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            style={{ width: "100%" }}
          />
          {suggestions.length ? (
            <ul className="suggest-list">
              {suggestions.map((s, i) => (
                <li key={`${s.street}-${i}`}>
                  <button type="button" onClick={() => pickSuggestion(s)}>
                    <strong>{s.street}</strong>
                    <div className="muted">
                      {s.remote
                        ? "Nominatim"
                        : `${(s.distanceKm != null ? s.distanceKm.toFixed(2) : "—")} km · ~${Math.round(
                            (s.occupancy || 0) * 100
                          )}% busy · ${s.free}/${s.capacity} free`}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <h3 className="hint" style={{ marginTop: "1rem" }}>
            Zone (Zagreb pricing)
          </h3>
          <div className="zone-pills">
            {[1, 2, 3].map((z) => (
              <button
                key={z}
                type="button"
                className={zone === z ? "active" : ""}
                onClick={() => setZone(z)}
              >
                Zone {z}
              </button>
            ))}
          </div>
          <p className="hint">
            Z1 €1.60/h (≤2h) else €16 · Z2 €0.70/h (≤3h) else €8 · Z3 €0.12/h all day.
          </p>

          <h3 className="hint" style={{ marginTop: "1rem" }}>
            Vehicle
          </h3>
          <select value={selectedCar} onChange={(e) => setSelectedCar(e.target.value)} style={{ width: "100%" }}>
            {cars.length === 0 ? (
              <option value="">Add a vehicle first</option>
            ) : null}
            {cars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.plate}
              </option>
            ))}
          </select>
          {cars.length === 0 ? (
            <button type="button" className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => navigate("/dashboard")}>
              Add a car in dashboard
            </button>
          ) : null}

          {session ? (
            <div className="card" style={{ marginTop: "1rem" }}>
              <h2 style={{ fontSize: "0.95rem" }}>Active session</h2>
              <p className="muted" style={{ margin: "0.35rem 0" }}>
                Zone {session.zone} · {new Date(session.startTime).toLocaleTimeString()}
              </p>
            </div>
          ) : null}

          {status ? <p className="muted" style={{ marginTop: "0.75rem" }}>{status}</p> : null}
        </aside>
        <div className="map-canvas-wrap">
          <div ref={mapEl} className="map-root" />
        </div>
      </div>
    </div>
  );
}

function AppShell() {
  const { token, logout } = useAuth();
  const { pathname } = useLocation();

  if (pathname === "/parking-map") return <Outlet />;

  return (
    <div className="shell">
      <header className="top-nav">
        <Link to={token ? "/dashboard" : "/"}>Smart Parking</Link>
        <nav className="links">
          {token ? (
            <>
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/parking-map">Map</Link>
              <button type="button" className="btn btn-ghost" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Sign in</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/parking-map"
              element={
                <ProtectedRoute>
                  <ParkingMapPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
