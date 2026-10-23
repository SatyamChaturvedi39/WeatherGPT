import { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import {
  Cloud,
  MessageSquare,
  AlertTriangle,
  Server,
  Search,
  MapPin,
  Compass,
  BrainCircuit,
  Activity,
  Layers,
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
import RouteView from "./components/RouteView";
import AlertsView from "./components/AlertsView";
import BenchmarkView from "./components/BenchmarkView";
import AdminView from "./components/AdminView";
import MicroclimatesView from "./components/MicroclimatesView";
import "./App.css";

const DEFAULT_LOCATION = {
  name: "Bengaluru",
  country: "India",
  latitude: 12.9716,
  longitude: 77.5946,
  admin1: "Karnataka",
};

const OPERATIONAL_HUBS = [
  { name: "Bengaluru", country: "India", latitude: 12.9716, longitude: 77.5946 },
  { name: "Vimanapura (HAL)", country: "India", latitude: 12.9560, longitude: 77.6740 },
  { name: "Koramangala", country: "India", latitude: 12.9352, longitude: 77.6245 },
  { name: "Whitefield", country: "India", latitude: 12.9698, longitude: 77.7499 },
  { name: "Electronic City", country: "India", latitude: 12.8452, longitude: 77.6602 },
  { name: "Indiranagar", country: "India", latitude: 12.9784, longitude: 77.6408 },
  { name: "Mumbai", country: "India", latitude: 19.0760, longitude: 72.8777 },
  { name: "Delhi NCR", country: "India", latitude: 28.6139, longitude: 77.2090 },
  { name: "Hyderabad", country: "India", latitude: 17.3850, longitude: 78.4867 },
  { name: "Chennai", country: "India", latitude: 13.0827, longitude: 80.2707 },
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
      <div className="search-input-shell">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          placeholder="Search Indian stations or Bangalore microclimates (e.g., Vimanapura, Koramangala, Delhi, Mumbai)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
        />
        <button className="search-submit-btn" onClick={handleSearch} disabled={loading}>
          {loading ? "..." : "Search"}
        </button>
      </div>

      {showDropdown && results.length > 0 && (
        <ul className="search-results-dropdown">
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

  // Fetch meteorological telemetry on station change
  useEffect(() => {
    if (!location) return;
    const fetchStationData = async () => {
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
        setError(err.message || "Failed to fetch atmospheric telemetry");
      } finally {
        setLoading(false);
      }
    };
    fetchStationData();
  }, [location]);

  return (
    <div className="app-viewport">
      {/* ── Top Persistent Navigation Bar ─────────────────────── */}
      <header className="top-navigation-bar">
        <div className="brand-logo-cluster" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
          <div className="brand-icon-box">
            <Cloud size={20} className="text-cyan" />
          </div>
          <div className="brand-title-wrap">
            <span className="brand-name">WeatherGPT</span>
            <span className="brand-sub font-mono">ENTERPRISE XAI PLATFORM</span>
          </div>
        </div>

        <LocationSearch onSelect={setLocation} currentLocation={location} />

        <div className="header-controls-cluster">
          <div className="unit-toggle-control">
            <button
              className={`toggle-unit-btn ${unit === "C" ? "unit-selected" : ""}`}
              onClick={() => setUnit("C")}
            >
              °C
            </button>
            <button
              className={`toggle-unit-btn ${unit === "F" ? "unit-selected" : ""}`}
              onClick={() => setUnit("F")}
            >
              °F
            </button>
          </div>

          <div className="pipeline-telemetry-badge font-mono">
            <span className="live-status-dot"></span>
            <span>142ms • LIVE</span>
          </div>
        </div>
      </header>

      {/* ── Operational Station Selector Strip ─────────────────── */}
      <div className="operational-stations-strip">
        <span className="strip-label">OPERATIONAL HUBS:</span>
        <div className="hubs-scroll-row">
          {OPERATIONAL_HUBS.map((hub, i) => (
            <button
              key={i}
              className={`hub-pill-btn ${location?.name === hub.name ? "hub-selected" : ""}`}
              onClick={() => setLocation(hub)}
            >
              <MapPin size={11} />
              <span>{hub.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Section Tabs ─────────────────────────────────── */}
      <nav className="main-section-tabs">
        <NavLink to="/" end className={({ isActive }) => `section-tab ${isActive ? "tab-active" : ""}`}>
          <Cloud size={16} />
          <span>Forecast Intelligence</span>
        </NavLink>
        <NavLink to="/chat" className={({ isActive }) => `section-tab ${isActive ? "tab-active" : ""}`}>
          <MessageSquare size={16} />
          <span>Conversational RAG</span>
          <span className="tag-pill-sm">NLP</span>
        </NavLink>
        <NavLink to="/route" className={({ isActive }) => `section-tab ${isActive ? "tab-active" : ""}`}>
          <Compass size={16} />
          <span>Corridor Route Transit</span>
          <span className="tag-pill-commercial">Commercial</span>
        </NavLink>
        <NavLink to="/microclimates" className={({ isActive }) => `section-tab ${isActive ? "tab-active" : ""}`}>
          <Layers size={16} />
          <span>Bengaluru 25-Zone Grid</span>
          <span className="tag-pill-hyperlocal">Hyper-Local</span>
        </NavLink>
        <NavLink to="/alerts" className={({ isActive }) => `section-tab ${isActive ? "tab-active" : ""}`}>
          <AlertTriangle size={16} />
          <span>Hazard & Risk Center</span>
          {alertsCount > 0 && <span className="alert-count-pill">{alertsCount}</span>}
        </NavLink>
        <NavLink to="/benchmarks" className={({ isActive }) => `section-tab ${isActive ? "tab-active" : ""}`}>
          <BrainCircuit size={16} />
          <span>ML Validation Lab</span>
          <span className="tag-pill-capstone">Member 1</span>
        </NavLink>
        <NavLink to="/admin" className={({ isActive }) => `section-tab ${isActive ? "tab-active" : ""}`}>
          <Server size={16} />
          <span>Data-Ops Telemetry</span>
          <span className="tag-pill-capstone">Member 2</span>
        </NavLink>
      </nav>

      {/* ── Dynamic Route Viewport ─────────────────────────────── */}
      <main className="content-container">
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
          <Route
            path="/chat"
            element={<ChatView location={location} onUpdateLocation={setLocation} />}
          />
          <Route
            path="/route"
            element={
              <RouteView
                unit={unit}
                convertTemp={convertTemp}
                convertSpeed={convertSpeed}
                tempUnit={tempUnit}
                speedUnit={speedUnit}
              />
            }
          />
          <Route
            path="/microclimates"
            element={
              <MicroclimatesView
                onSelectLocation={setLocation}
                convertTemp={convertTemp}
                tempUnit={tempUnit}
              />
            }
          />
          <Route path="/alerts" element={<AlertsView location={location} />} />
          <Route path="/benchmarks" element={<BenchmarkView />} />
          <Route path="/admin" element={<AdminView />} />
        </Routes>
      </main>

      {/* ── Global Technical Footer ─────────────────────────────── */}
      <footer className="technical-footer">
        <div className="footer-meta-line font-mono">
          <span>WeatherGPT • Final-Year MSc (AI & ML) Capstone Demonstration Architecture</span>
          <span>Open-Meteo • TreeSHAP • Isolation Forest • Quantile Regressors • Neon PostgreSQL • FastAPI</span>
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
