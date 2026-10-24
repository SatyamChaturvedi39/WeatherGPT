import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  BrainCircuit,
  MessageSquare,
  Settings as SettingsIcon,
  ActivitySquare,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const navItems = [
    { to: '/', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4 stroke-[1.75]" /> },
    { to: '/explainability', label: 'Explainability', icon: <BrainCircuit className="w-4 h-4 stroke-[1.75]" /> },
    { to: '/chat', label: 'Weather Chat', icon: <MessageSquare className="w-4 h-4 stroke-[1.75]" /> },
    { to: '/settings', label: 'Settings', icon: <SettingsIcon className="w-4 h-4 stroke-[1.75]" /> },
    { to: '/admin', label: 'Admin & Ops', icon: <ActivitySquare className="w-4 h-4 stroke-[1.75]" /> },
  ];

  return (
    <>
      {/* Desktop & Tablet Sidebar */}
      <aside className="hidden md:flex flex-col w-56 lg:w-60 border-r border-border-subtle bg-app-surface/50 p-3 shrink-0 min-h-[calc(100vh-3.5rem)]">
        <nav className="space-y-1" aria-label="Main Navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `group relative flex items-center gap-2.5 px-3 py-2 rounded-btn font-medium text-xs transition-colors duration-150 ${
                  isActive
                    ? 'bg-accent/10 text-accent font-semibold'
                    : 'text-text-secondary hover:text-text-primary hover:bg-app-subtle'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Left indicator bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-accent" />
                  )}
                  <span className={`${isActive ? 'text-accent' : 'text-text-muted group-hover:text-text-secondary'}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer info (version badge moved here) */}
        <div className="mt-auto pt-4 border-t border-border-subtle px-3 py-2 text-2xs text-text-muted space-y-1">
          <div className="flex items-center justify-between">
            <span>Version</span>
            <span className="font-mono text-text-secondary">v0.1.0</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Model Core</span>
            <span className="font-mono text-text-secondary">Calibrated</span>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-app-surface/95 backdrop-blur-md border-t border-border-subtle px-1 py-1 flex justify-around"
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center py-1.5 px-2 rounded-btn text-2xs font-medium transition-colors ${
                isActive ? 'text-accent font-semibold' : 'text-text-muted hover:text-text-primary'
              }`
            }
          >
            {item.icon}
            <span className="mt-1 text-[10px]">{item.label.split(' ')[0]}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
};
