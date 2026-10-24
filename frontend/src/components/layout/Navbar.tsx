import React, { useState, useRef, useEffect } from 'react';
import { CloudSun, MapPin, Moon, Sun, Search, Check } from 'lucide-react';
import { SavedLocation } from '../../types';
import { Tooltip } from '../ui/Tooltip';
import { Button } from '../ui/Button';

interface NavbarProps {
  currentLocation: SavedLocation;
  savedLocations: SavedLocation[];
  onSelectLocation: (loc: SavedLocation) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  temperatureUnit: 'celsius' | 'fahrenheit';
  onToggleUnit: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentLocation,
  savedLocations,
  onSelectLocation,
  darkMode,
  onToggleDarkMode,
  temperatureUnit,
  onToggleUnit,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredLocations = savedLocations.filter((loc) =>
    loc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border-subtle bg-app-surface/95 backdrop-blur-sm">
      <div className="max-w-content mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-btn bg-app-subtle border border-border-default flex items-center justify-center text-accent">
            <CloudSun className="w-4 h-4 stroke-[1.75]" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-text-primary">
            WeatherGPT
          </span>
        </div>

        {/* Center: Location Combobox */}
        <div className="relative flex-1 max-w-xs sm:max-w-sm" ref={dropdownRef}>
          <div className="flex items-center gap-1.5 w-full">
            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex-1 flex items-center justify-between bg-app-subtle border border-border-subtle hover:border-border-default rounded-btn px-3 py-1.5 text-xs text-text-primary transition-colors focus-visible:outline-none"
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
            >
              <div className="flex items-center gap-2 truncate">
                <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0 stroke-[1.75]" />
                <span className="font-medium truncate">{currentLocation.name || 'Select place'}</span>
              </div>
              <span className="text-2xs text-text-muted shrink-0 ml-1">Change</span>
            </button>

            {/* Coordinates tooltip */}
            <Tooltip
              content={
                <span>
                  Coordinates: {currentLocation.latitude.toFixed(4)}°, {currentLocation.longitude.toFixed(4)}°
                  {currentLocation.timezone ? ` (${currentLocation.timezone})` : ''}
                </span>
              }
            />
          </div>

          {/* Floating Combobox Dropdown */}
          {dropdownOpen && (
            <div className="absolute left-0 right-0 mt-1.5 rounded-btn floating-layer p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-app-surface rounded-input border border-border-subtle mb-2">
                <Search className="w-3.5 h-3.5 text-text-muted stroke-[1.75]" />
                <input
                  type="text"
                  placeholder="Search saved locations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {filteredLocations.length > 0 ? (
                  filteredLocations.map((loc) => {
                    const isSelected =
                      Math.abs(loc.latitude - currentLocation.latitude) < 0.001 &&
                      Math.abs(loc.longitude - currentLocation.longitude) < 0.001;
                    return (
                      <button
                        key={`${loc.latitude}-${loc.longitude}`}
                        type="button"
                        onClick={() => {
                          onSelectLocation(loc);
                          setDropdownOpen(false);
                          setSearchQuery('');
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-input text-xs text-left transition-colors ${
                          isSelected
                            ? 'bg-accent/10 text-accent font-medium'
                            : 'text-text-secondary hover:bg-app-subtle hover:text-text-primary'
                        }`}
                      >
                        <span className="truncate">{loc.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0 stroke-[2]" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-2 text-2xs text-text-muted text-center">
                    No matching location
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Controls: Unit switch & theme toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleUnit}
            title="Toggle measurement units"
            className="text-xs font-medium tabular-nums h-8 px-2"
          >
            °{temperatureUnit === 'fahrenheit' ? 'F' : 'C'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleDarkMode}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-8 h-8 p-0"
          >
            {darkMode ? (
              <Sun className="w-4 h-4 stroke-[1.75] text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 stroke-[1.75] text-text-secondary" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
};
