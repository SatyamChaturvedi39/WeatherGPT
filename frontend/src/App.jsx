import { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import {
  Cloud,
  MessageSquare,
  AlertTriangle,
  Server,
  Search,
  MapPin,
  Sparkles,
  Thermometer,
  ShieldAlert,
} from "lucide-react";
import {
  geocodeLocation,
  getCurrentWeather,
  getHourlyForecast,
  getDailyForecast,
  getAlerts,
} from "./services/api";
import DashboardView from "./components/DashboardView";
import ChatView from "./components/ChatView";
import AlertsView from "./components/AlertsView";
import AdminView from "./components/AdminView";
import "./App.css";

const DEFAULT_LOCATION = {
  name: "London",
  country: "United Kingdom",
  latitude: 51.5074,
  longitude: -0.1278,
  admin1: "England",
};

const POPULAR_LOCATIONS = [
  { name: "London", country: "United Kingdom", latitude: 51.5074, longitude: -0.1278 },
  { name: "New York", country: "United States", latitude: 40.7128, longitude: -74.006 },
  { name: "Tokyo", country: "Japan", latitude: 35.6895, longitude: 139.6917 },
  { name: "Paris", country: "France", latitude: 48.8566, longitude: 2.3522 },
  { name: "San Francisco", country: "United States", latitude: 37.7749, longitude: -122.4194 },
  { name: "Mumbai", country: "India", latitude: 19.076, longitude: 72.8777 },
];

function LocationSearch({ onSelect, currentLocation }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleSearch = useCallback(async () => {
    if (query.trim().length < 2) return;
    setLoading(true);
    try {
      const data = await geocodeLocation(query);
      setResults(data.results || []);
      setShowDropdown(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <div className="location-search-wrapper">
      <div className="search-bar glass-panel">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          placeholder="Search any global city (e.g., Tokyo, Zurich, Austin)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
        />
        <button className="search-btn" onClick={handleSearch} disabled={loading}>
          {loading ? "..." : "Search"}
        </button>
      </div>

      {showDropdown && results.length > 0 && (
        <ul className="search-results-dropdown glass-panel">
          {results.map((r, i) => (
            <li
              key={i}
              onClick={() => {
                onSelect(r);
                setShowDropdown(false);
                setQuery("");
              }}
            >
              <MapPin size={14} className="text-cyan" />
              <span>
                <strong>{r.name}</strong>
                {r.admin1 ? `, ${r.admin1}` : ""} {r.country ? `(${r.country})` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MainApp() {
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [unit, setUnit] = useState("C"); // 'C' | 'F'
  const [current, setCurrent] = useState(null);
  const [hourly, setHourly] = useState(null);
  const [daily, setDaily] = useState(null);
  const [alertsCount, setAlertsCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Unit conversion helpers
  const convertTemp = (celsius) => {
    if (celsius === undefined || celsius === null) return 0;
    if (unit === "C") return Math.round(celsius);
    return Math.round((celsius * 9) / 5 + 32);
  };

  const convertSpeed = (kmh) => {
    if (kmh === undefined || kmh === null) return 0;
    if (unit === "C") return Math.round(kmh);
    return Math.round(kmh * 0.621371);
  };

  const tempUnit = unit === "C" ? "C" : "F";
  const speedUnit = unit === "C" ? "km/h" : "mph";

  // Fetch meteorological models on location change
  useEffect(() => {
    if (!location) return;
    const fetchAllData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [currRes, hourRes, dayRes, alertRes] = await Promise.all([
          getCurrentWeather(location.latitude, location.longitude),
          getHourlyForecast(location.latitude, location.longitude, 48),
          getDailyForecast(location.latitude, location.longitude, 7),
          getAlerts(location.latitude, location.longitude).catch(() => ({ alerts: [] })),
        ]);
        setCurrent(currRes.data);
        setHourly(hourRes.data);
        setDaily(dayRes.data);
        setAlertsCount((alertRes.alerts || []).filter((a) => a.severity !== "LOW").length);
      } catch (err) {
        setError(err.message || "Failed to fetch atmospheric models");
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [location]);

  return (
    <div className="app-shell">
      {/* ── Top Navigation Bar ──────────────────────────────────── */}
      <header className="top-navbar glass-panel">
        <div className="brand-group" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
          <div className="brand-logo-glow">
            <Cloud size={24} className="text-cyan" />
          </div>
          <div>
            <span className="brand-title">WeatherGPT</span>
            <span className="brand-badge">AI METEOROLOGY</span>
          </div>
        </div>

        <LocationSearch onSelect={setLocation} currentLocation={location} />

        <div className="nav-controls">
          <div className="unit-toggle-pill glass-panel-sm">
            <button
              className={`unit-btn ${unit === "C" ? "active-unit" : ""}`}
              onClick={() => setUnit("C")}
            >
              °C
            </button>
            <button
              className={`unit-btn ${unit === "F" ? "active-unit" : ""}`}
              onClick={() => setUnit("F")}
            >
              °F
            </button>
          </div>
        </div>
      </header>

      {/* ── Sub-header: Quick City Chips ────────────────────────── */}
      <div className="city-chips-bar">
        <span className="chips-label">Popular Locations:</span>
        <div className="chips-scroll">
          {POPULAR_LOCATIONS.map((loc, i) => (
            <button
              key={i}
              className={`city-chip ${location?.name === loc.name ? "active-chip" : ""}`}
              onClick={() => setLocation(loc)}
            >
              <MapPin size={12} />
              <span>{loc.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Navigation Tabs ─────────────────────────────────────── */}
      <nav className="tab-navigation">
        <NavLink to="/" end className={({ isActive }) => `nav-tab ${isActive ? "active-tab" : ""}`}>
          <Cloud size={18} />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/chat" className={({ isActive }) => `nav-tab ${isActive ? "active-tab" : ""}`}>
          <MessageSquare size={18} />
          <span>AI Assistant</span>
          <span className="tab-pill-badge">RAG</span>
        </NavLink>
        <NavLink to="/alerts" className={({ isActive }) => `nav-tab ${isActive ? "active-tab" : ""}`}>
          <AlertTriangle size={18} />
          <span>Risk & Alerts</span>
          {alertsCount > 0 && <span className="tab-alert-badge">{alertsCount}</span>}
        </NavLink>
        <NavLink to="/admin" className={({ isActive }) => `nav-tab ${isActive ? "active-tab" : ""}`}>
          <Server size={18} />
          <span>Data-Ops Telemetry</span>
        </NavLink>
      </nav>

      {/* ── Main View Container ─────────────────────────────────── */}
      <main className="main-viewport">
        <Routes>
          <Route
            path="/"
            element={
              <DashboardView
                current={current}
                hourly={hourly}
                daily={daily}
                location={location}
                loading={loading}
                error={error}
                unit={unit}
                convertTemp={convertTemp}
                convertSpeed={convertSpeed}
                tempUnit={tempUnit}
                speedUnit={speedUnit}
                onNavigateToChat={() => navigate("/chat")}
              />
            }
          />
          <Route path="/chat" element={<ChatView location={location} />} />
          <Route path="/alerts" element={<AlertsView location={location} />} />
          <Route path="/admin" element={<AdminView />} />
        </Routes>
      </main>

      {/* ── Global Footer ───────────────────────────────────────── */}
      <footer className="global-footer">
        <div className="footer-content">
          <span>WeatherGPT • Academic Project Plan Architecture (100% Free Tier Implementation)</span>
          <span>Open-Meteo • Neon PostgreSQL • ChromaDB • FastAPI • React + Recharts</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <MainApp />
    </BrowserRouter>
  );
}
