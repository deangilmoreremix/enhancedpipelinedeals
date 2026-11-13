import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Users, BarChart3, Bot, Calendar, Mail, Filter, Workflow, LineChart, Grid3X3,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Pipeline', icon: BarChart3, end: true },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/email', label: 'Email', icon: Mail },
  { to: '/views', label: 'Views', icon: Filter },
  { to: '/workflows', label: 'Workflows', icon: Workflow },
  { to: '/analytics', label: 'Analytics', icon: LineChart },
  { to: '/apps', label: 'Apps', icon: Grid3X3 },
];

/** Router-based primary navigation (works under BrowserRouter and MemoryRouter). */
export const AppNavigation: React.FC = () => (
  <nav aria-label="Primary" className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1">
    {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
      <NavLink
        key={to}
        to={to}
        end={end}
        className={({ isActive }) =>
          `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            isActive
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`
        }
      >
        <Icon className="w-4 h-4" />
        {label}
      </NavLink>
    ))}
  </nav>
);

export default AppNavigation;
