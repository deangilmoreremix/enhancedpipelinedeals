import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Moon, Sun, Laptop, ChevronDown } from 'lucide-react';
import { Tooltip } from './Tooltip';

export const DarkModeToggle: React.FC = () => {
  const { isDarkMode, toggleDarkMode, theme, setTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsMenuOpen(false);
    }
  };

  return (
    <div className="relative" onKeyDown={handleKeyDown}>
      <Tooltip content={isDarkMode ? 'Switch to Light Mode - Better for bright environments' : 'Switch to Dark Mode - Easier on the eyes in low light'} position="bottom">
        <button
          ref={buttonRef}
          onClick={toggleDarkMode}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleDarkMode();
            }
          }}
          className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-blue-400 focus:ring-offset-white dark:focus:ring-offset-gray-900"
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-pressed={isDarkMode}
          role="switch"
        >
          {isDarkMode ? (
            <Sun className="h-5 w-5 text-yellow-400" aria-hidden="true" />
          ) : (
            <Moon className="h-5 w-5 text-gray-700" aria-hidden="true" />
          )}
          <span className="sr-only">
            {isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          </span>
        </button>
      </Tooltip>
      
      {/* Theme options dropdown button */}
      <Tooltip content="Theme Options - Choose light, dark, or system preference" position="bottom">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsMenuOpen(!isMenuOpen);
            }
          }}
          className="ml-1 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 rounded-md"
          aria-label="More theme options"
          aria-expanded={isMenuOpen}
          aria-controls="theme-menu"
          aria-haspopup="menu"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </Tooltip>
      
      {/* Dropdown menu */}
      <div 
        id="theme-menu" 
        ref={menuRef}
        className={`absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10 transition-opacity duration-200 ${
          isMenuOpen ? 'opacity-100' : 'opacity-0 invisible'
        }`}
        role="menu"
        aria-orientation="vertical"
        aria-labelledby="theme-menu-button"
        tabIndex={-1}
      >
        <div className="py-1" role="none">
          <button
            className={`w-full text-left px-4 py-2 text-sm ${
              theme === 'light' 
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-100' 
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            } transition-colors`}
            onClick={() => {
              setTheme('light');
              setIsMenuOpen(false);
            }}
            role="menuitem"
            tabIndex={0}
          >
            <span className="flex items-center">
              <Sun className="w-4 h-4 mr-3 text-yellow-500" aria-hidden="true" />
              Light Mode
            </span>
          </button>
          <button
            className={`w-full text-left px-4 py-2 text-sm ${
              theme === 'dark' 
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-100' 
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            } transition-colors`}
            onClick={() => {
              setTheme('dark');
              setIsMenuOpen(false);
            }}
            role="menuitem"
            tabIndex={0}
          >
            <span className="flex items-center">
              <Moon className="w-4 h-4 mr-3 text-gray-400 dark:text-gray-300" aria-hidden="true" />
              Dark Mode
            </span>
          </button>
          <button
            className={`w-full text-left px-4 py-2 text-sm ${
              theme === 'auto' 
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-100' 
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            } transition-colors`}
            onClick={() => {
              setTheme('auto');
              setIsMenuOpen(false);
            }}
            role="menuitem"
            tabIndex={0}
          >
            <span className="flex items-center">
              <Laptop className="w-4 h-4 mr-3 text-blue-500" aria-hidden="true" />
              System Preference
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};