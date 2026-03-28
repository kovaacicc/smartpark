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
  const [topUp, setTopUp] = useState("20");
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

  async function doTopUp() {
    const amount = Number(topUp);
    setBusy("wallet");
    setMsg("");
    try {
      const out = await api("/api/wallet/add", {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
      setMsg(
        out.devMode
          ? `Added ${formatEuro(amount)} (dev mode — no Stripe charge).`
          : `Added ${formatEuro(amount)}.`
      );
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
      setMsg(`Stopped. Charged ${formatEuro(rec.charge)}.`);
      await reload();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="page">
      <div className="card-grid">
        <div className="card">
          <h2>Wallet</h2>
          <p style={{ fontSize: "1.6rem", margin: "0.25rem 0" }}>
            {formatEuro(wallet.balance)}
          </p>
          <div className="row">
            <input
              style={{ width: 100 }}
              value={topUp}
              onChange={(e) => setTopUp(e.target.value)}
              inputMode="decimal"
            />
            <button type="button" className="btn btn-primary" disabled={!!busy} onClick={doTopUp}>
              Add funds
            </button>
          </div>
          <p className="hint">Stripe runs only when STRIPE_SECRET_KEY is set; otherwise dev credit.</p>
          <h3 className="muted" style={{ margin: "1rem 0 0.35rem", fontSize: "0.85rem" }}>
            Recent transactions
          </h3>
          <ul className="tx-list">
            {wallet.transactions.slice(0, 8).map((t) => (
              <li key={t.id}>
                <span>{t.description}</span>
                <span className={t.amount >= 0 ? "tx-amount-pos" : "tx-amount-neg"}>
                  {t.amount >= 0 ? "+" : ""}
                  {formatEuro(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2>Rewards</h2>
          <p className="muted">Points: {rewards.points}</p>
          <ul className="tx-list" style={{ maxHeight: 160 }}>
            {rewards.catalog.map((r) => (
              <li key={r.id} style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{r.label}</strong>
                  <span className="muted">{r.costPoints} pts</span>
                </div>
                <span className="muted">{r.description}</span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ alignSelf: "flex-start", marginTop: 4 }}
                  disabled={!!busy || rewards.points < r.costPoints}
                  onClick={() => redeem(r.id)}
                >
                  Redeem
                </button>
              </li>
            ))}
          </ul>
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
              <button type="button" className="btn btn-danger" disabled={!!busy} onClick={stopParking}>
                Stop &amp; charge wallet
              </button>
            </>
          ) : (
            <p className="muted">No active session. Start one from the map.</p>
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
      {user?.freeNextParking ? (
        <p className="muted">You have a free next parking session from rewards.</p>
      ) : null}
      {user?.pendingParkingDiscountPercent ? (
        <p className="muted">Next session discount: {user.pendingParkingDiscountPercent}%</p>
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
