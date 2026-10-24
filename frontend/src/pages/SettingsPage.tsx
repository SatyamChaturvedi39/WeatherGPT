import React, { useState } from 'react';
import { MapPin, Plus, Check, LocateFixed } from 'lucide-react';
import { usePlatformSettings } from '../hooks/useWeather';
import { SavedLocation } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { ErrorState } from '../components/ui/ErrorState';
import { PageHeader } from '../components/layout/PageHeader';

interface SettingsPageProps {
  onUseMyLocation?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onUseMyLocation }) => {
  const { data: settings, updateSettings, isUpdating, isError, refetch } = usePlatformSettings();

  const [newCityName, setNewCityName] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLon, setNewLon] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleUnitChange = async (type: 'temperature' | 'precipitation', value: string) => {
    if (!settings) return;
    await updateSettings({
      units: {
        ...settings.units,
        [type]: value,
      },
    });
    triggerSuccess();
  };

  const handleActivityChange = async (activity: string) => {
    if (!settings) return;
    await updateSettings({
      active_activity: activity,
    });
    triggerSuccess();
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCityName || !newLat || !newLon || !settings) return;

    const lat = parseFloat(newLat);
    const lon = parseFloat(newLon);
    if (isNaN(lat) || isNaN(lon)) return;

    const newLoc: SavedLocation = {
      name: newCityName.trim(),
      latitude: lat,
      longitude: lon,
      timezone: 'UTC',
      is_favorite: false,
    };

    await updateSettings({
      saved_locations: [...settings.saved_locations, newLoc],
    });

    setNewCityName('');
    setNewLat('');
    setNewLon('');
    triggerSuccess();
  };

  const triggerSuccess = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  if (isError) {
    return <ErrorState message="Could not load platform settings." onRetry={refetch} />;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Settings & Preferences"
        subtitle="Manage measurement units, outdoor activity profiles, and saved locations."
        actions={
          saveSuccess ? (
            <Badge variant="success" icon={<Check className="w-3 h-3 stroke-[2]" />}>
              Saved
            </Badge>
          ) : undefined
        }
      />

      {/* 1. Units of Measurement */}
      <Card
        title="Measurement Units"
        subtitle="Configure temperature and precipitation units across the platform."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-text-secondary block">Temperature</label>
            <SegmentedControl
              options={[
                { value: 'celsius', label: 'Celsius (°C)' },
                { value: 'fahrenheit', label: 'Fahrenheit (°F)' },
              ]}
              value={settings?.units.temperature || 'celsius'}
              onChange={(val) => handleUnitChange('temperature', val)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-text-secondary block">Precipitation</label>
            <SegmentedControl
              options={[
                { value: 'mm', label: 'Millimeters (mm)' },
                { value: 'inch', label: 'Inches (in)' },
              ]}
              value={settings?.units.precipitation || 'mm'}
              onChange={(val) => handleUnitChange('precipitation', val)}
            />
          </div>
        </div>
      </Card>

      {/* 2. Default Activity Risk Context */}
      <Card
        title="Outdoor Activity Profile"
        subtitle="The risk engine calibrates thermal, wind, and rain sensitivity thresholds based on your active activity."
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {settings?.available_activities.map((act) => {
            const isSelected = settings.active_activity === act;
            return (
              <button
                key={act}
                type="button"
                onClick={() => handleActivityChange(act)}
                className={`py-2 px-3 rounded-btn border text-xs font-medium capitalize text-left transition-colors ${
                  isSelected
                    ? 'bg-accent/10 border-accent text-accent font-semibold'
                    : 'bg-app-surface border-border-default text-text-secondary hover:text-text-primary hover:bg-app-subtle'
                }`}
              >
                {act.replace('_', ' ')}
              </button>
            );
          })}
        </div>
      </Card>

      {/* 3. Monitored Saved Locations */}
      <Card
        title="Monitored Locations"
        subtitle="Manage locations available in your quick-access switcher."
        headerAction={
          onUseMyLocation ? (
            <button
              type="button"
              onClick={onUseMyLocation}
              className="flex items-center gap-1.5 text-2xs font-medium text-accent hover:text-accent-hover transition-colors"
            >
              <LocateFixed className="w-3 h-3" />
              Use my location
            </button>
          ) : undefined
        }
      >
        <div className="space-y-2 mb-4">
          {settings?.saved_locations.map((loc, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2.5 rounded-btn bg-app-subtle border border-border-subtle text-xs"
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-text-muted stroke-[1.75]" />
                <span className="font-medium text-text-primary">{loc.name}</span>
                <span className="text-2xs text-text-muted font-mono">
                  ({loc.latitude.toFixed(2)}°, {loc.longitude.toFixed(2)}°)
                </span>
              </div>
              {loc.is_favorite && <Badge size="sm">Primary</Badge>}
            </div>
          ))}
        </div>

        {/* Add Location Form */}
        <form onSubmit={handleAddLocation} className="pt-3 border-t border-border-subtle space-y-3">
          <span className="text-xs font-medium text-text-secondary block">Add Monitored Location</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="City Name (e.g. Chicago)"
              value={newCityName}
              onChange={(e) => setNewCityName(e.target.value)}
              className="bg-app-surface border border-border-default rounded-btn px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus-visible:outline-none"
              required
            />
            <input
              type="number"
              step="any"
              placeholder="Latitude (e.g. 41.8781)"
              value={newLat}
              onChange={(e) => setNewLat(e.target.value)}
              className="bg-app-surface border border-border-default rounded-btn px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus-visible:outline-none"
              required
            />
            <input
              type="number"
              step="any"
              placeholder="Longitude (e.g. -87.6298)"
              value={newLon}
              onChange={(e) => setNewLon(e.target.value)}
              className="bg-app-surface border border-border-default rounded-btn px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus-visible:outline-none"
              required
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={isUpdating}
            icon={<Plus className="w-3.5 h-3.5 stroke-[2]" />}
          >
            Add Location
          </Button>
        </form>
      </Card>
    </div>
  );
};
