import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MapPin, Loader2, LocateFixed, AlertTriangle } from 'lucide-react';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { ExplainabilityPage } from './pages/ExplainabilityPage';
import { ChatPage } from './pages/ChatPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminPage } from './pages/AdminPage';
import LandingPage from './landing/LandingPage';
import { RoutePage } from './pages/RoutePage';
import { MicroclimatesPage } from './pages/MicroclimatesPage';
import { FloodTwinPage } from './pages/FloodTwinPage';
import { AlertsPage } from './pages/AlertsPage';
import { BenchmarksPage } from './pages/BenchmarksPage';
import { SavedLocation } from './types';
import { usePlatformSettings, useCurrentWeather } from './hooks/useWeather';
import { classifyCode } from './landing/weatherTheme';
import { getBrowserCoords, reverseGeocode } from './lib/geolocation';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/** Default fallback location (used only if geolocation is denied AND no saved location exists) */
const FALLBACK_LOCATION: SavedLocation = {
  name: 'New York',
  latitude: 40.7128,
  longitude: -74.006,
  timezone: 'UTC',
  is_favorite: false,
};

type GeoState = 'detecting' | 'ready' | 'denied' | 'error';

/** Sky mood used to tint light-mode panels (see index.css `data-sky`). */
function skyMood(code: number | undefined, timestamp: string | undefined): string {
  if (code == null) return 'partly';
  const c = classifyCode(code);
  const hour = Number(timestamp?.split('T')[1]?.slice(0, 2));
  const night = Number.isFinite(hour) && (hour < 6 || hour >= 18);
  if (c === 'drizzle' || c === 'rain') return 'rain';
  if (c === 'storm' || c === 'snow' || c === 'fog') return c;
  if (night) return 'night';
  return c === 'clear' ? 'sunny' : c;
}

const AppContent: React.FC = () => {
  // Light panels by default; the navbar toggle switches to dark and is remembered.
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('weathergpt.theme') === 'dark';
    } catch {
      return false;
    }
  });

  const [currentLocation, setCurrentLocation] = useState<SavedLocation>(FALLBACK_LOCATION);
  const [geoState, setGeoState] = useState<GeoState>('detecting');
  const [geoError, setGeoError] = useState<string>('');

  const { data: settings, updateSettings } = usePlatformSettings();

  // ─── Geolocation on mount ────────────────────────────────────────────────
  const detectLocation = useCallback(async () => {
    setGeoState('detecting');
    setGeoError('');
    try {
      const coords = await getBrowserCoords();
      // Reverse geocode to get human-readable city name
      let cityName = `${coords.latitude.toFixed(2)}, ${coords.longitude.toFixed(2)}`;
      try {
        const geo = await reverseGeocode(coords.latitude, coords.longitude);
        cityName = geo.country ? `${geo.city}, ${geo.country}` : geo.city;
      } catch {
        // Reverse geocode failed — coordinates-only name is still usable
      }
      setCurrentLocation({
        name: cityName,
        latitude: coords.latitude,
        longitude: coords.longitude,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        is_favorite: true,
      });
      setGeoState('ready');
    } catch (err: unknown) {
      const isPermissionDenied =
        err instanceof GeolocationPositionError && err.code === GeolocationPositionError.PERMISSION_DENIED;
      setGeoState(isPermissionDenied ? 'denied' : 'error');
      setGeoError(isPermissionDenied
        ? 'Location access denied — using saved location.'
        : 'Could not detect location — using saved location.'
      );
      // Fall through to use saved favourite or FALLBACK_LOCATION
    }
  }, []);

  useEffect(() => {
    detectLocation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Override with saved favourite if geolocation fails ─────────────────
  useEffect(() => {
    if ((geoState === 'denied' || geoState === 'error') && settings?.saved_locations?.length) {
      const fav = settings.saved_locations.find((l) => l.is_favorite) || settings.saved_locations[0];
      setCurrentLocation(fav);
    }
  }, [geoState, settings?.saved_locations]);

  // ─── Dark mode ───────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('weathergpt.theme', darkMode ? 'dark' : 'light');
    } catch {
      /* storage unavailable */
    }
    return () => document.documentElement.classList.remove('dark');
  }, [darkMode]);

  // ─── Weather-tinted panels: map live conditions to a sky mood ───────────
  const { data: liveWeather } = useCurrentWeather(currentLocation.latitude, currentLocation.longitude);
  const sky = skyMood(liveWeather?.weather_code, liveWeather?.timestamp);
  useEffect(() => {
    document.documentElement.dataset.sky = sky;
    return () => {
      delete document.documentElement.dataset.sky;
    };
  }, [sky]);

  const activeActivity = settings?.active_activity || 'running';
  const savedLocations = settings?.saved_locations || [currentLocation];
  const temperatureUnit = settings?.units?.temperature || 'celsius';
  const precipitationUnit = settings?.units?.precipitation || 'mm';

  const handleToggleUnit = async () => {
    const nextUnit = temperatureUnit === 'celsius' ? 'fahrenheit' : 'celsius';
    if (settings) {
      await updateSettings({
        units: { temperature: nextUnit, precipitation: nextUnit === 'fahrenheit' ? 'inch' : 'mm' },
      });
    }
  };

  const handleActivityChange = async (act: string) => {
    if (settings) await updateSettings({ active_activity: act });
  };

  // ─── Location detecting overlay ──────────────────────────────────────────
  if (geoState === 'detecting') {
    return (
      <div className="min-h-screen bg-app-bg flex flex-col items-center justify-center gap-4 text-text-secondary">
        <div className="flex flex-col items-center gap-3 p-8 bg-app-surface border border-border-subtle rounded-card shadow-card max-w-xs w-full text-center">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
            <LocateFixed className="w-6 h-6 text-accent animate-pulse" />
          </div>
          <div>
            <p className="font-semibold text-text-primary text-sm">Detecting your location</p>
            <p className="text-xs text-text-muted mt-1">
              Allow location access for local weather data
            </p>
          </div>
          <Loader2 className="w-4 h-4 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen bg-app-bg text-text-primary flex flex-col font-sans transition-colors duration-150">
      {/* Geolocation error / denied banner */}
      {(geoState === 'denied' || geoState === 'error') && geoError && (
        <div className="bg-risk-high-bg border-b border-risk-high-border px-4 py-2 flex items-center justify-between gap-3 text-xs text-risk-high">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 stroke-[2]" />
            <span>{geoError}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={detectLocation}
              className="flex items-center gap-1 font-medium underline hover:no-underline"
            >
              <MapPin className="w-3 h-3" />
              Retry
            </button>
            <button
              type="button"
              onClick={() => setGeoError('')}
              className="text-risk-high/60 hover:text-risk-high"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <Navbar
        currentLocation={currentLocation}
        savedLocations={savedLocations}
        onSelectLocation={(loc) => setCurrentLocation(loc)}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
        temperatureUnit={temperatureUnit}
        onToggleUnit={handleToggleUnit}
      />

      <div className="flex flex-1 max-w-content w-full mx-auto">
        <Sidebar skyLabel={sky} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 md:pb-8 overflow-x-hidden">
          <Routes>
            <Route
              path="/dashboard"
              element={
                <DashboardPage
                  location={{
                    name: currentLocation.name,
                    lat: currentLocation.latitude,
                    lon: currentLocation.longitude,
                  }}
                  activity={activeActivity}
                  onActivityChange={handleActivityChange}
                  temperatureUnit={temperatureUnit}
                  precipitationUnit={precipitationUnit}
                  availableActivities={settings?.available_activities || ['running', 'commuting', 'travel', 'outdoor_event']}
                />
              }
            />
            <Route
              path="/explainability"
              element={
                <ExplainabilityPage
                  location={{
                    name: currentLocation.name,
                    lat: currentLocation.latitude,
                    lon: currentLocation.longitude,
                  }}
                />
              }
            />
            <Route
              path="/chat"
              element={
                <ChatPage
                  location={{
                    name: currentLocation.name,
                    lat: currentLocation.latitude,
                    lon: currentLocation.longitude,
                  }}
                  activity={activeActivity}
                />
              }
            />
            <Route
              path="/settings"
              element={
                <SettingsPage
                  onUseMyLocation={detectLocation}
                  currentLocation={{ name: currentLocation.name, latitude: currentLocation.latitude, longitude: currentLocation.longitude }}
                />
              }
            />
            <Route path="/admin" element={<AdminPage />} />
            <Route
              path="/alerts"
              element={
                <AlertsPage
                  location={{ name: currentLocation.name, lat: currentLocation.latitude, lon: currentLocation.longitude }}
                />
              }
            />
            <Route path="/route" element={<RoutePage />} />
            <Route path="/microclimates" element={<MicroclimatesPage />} />
            <Route path="/flood-twin" element={<FloodTwinPage />} />
            <Route path="/benchmarks" element={<BenchmarksPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/*" element={<AppContent />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
