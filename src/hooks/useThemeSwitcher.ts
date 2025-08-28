import { useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

/**
 * A hook to handle all theme switching logic and accessibility concerns
 * - Handles localStorage persistence
 * - Handles system preference detection
 * - Manages transitions and animations
 * - Announces theme changes to screen readers
 * - Updates meta theme color
 */
export function useThemeSwitcher() {
  const { isDarkMode, toggleDarkMode, theme, setTheme } = useTheme();
  
  useEffect(() => {
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        'content', 
        isDarkMode ? '#121212' : '#ffffff'
      );
    }
    
    // Add transition classes with delay to prevent flash
    const transitionClasses = [
      'transition-colors',
      'duration-300'
    ];
    
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (!prefersReducedMotion) {
      document.body.classList.add(...transitionClasses);
    }
    
    return () => {
      if (!prefersReducedMotion) {
        document.body.classList.remove(...transitionClasses);
      }
    };
  }, [isDarkMode]);
  
  // Handle system preference changes
  useEffect(() => {
    if (theme !== 'auto') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      // Only update if theme is set to auto
      if (theme === 'auto') {
        // Update meta theme-color
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
          metaThemeColor.setAttribute(
            'content', 
            mediaQuery.matches ? '#121212' : '#ffffff'
          );
        }
        
        // Announce to screen readers
        announceThemeChange(mediaQuery.matches ? 'dark' : 'light');
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);
  
  // Helper function to announce theme changes to screen readers
  const announceThemeChange = (newTheme: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = `Theme changed to ${newTheme} mode`;
    
    document.body.appendChild(announcement);
    
    // Remove after announcement is read
    setTimeout(() => {
      if (document.body.contains(announcement)) {
        document.body.removeChild(announcement);
      }
    }, 3000);
  };
  
  return {
    isDarkMode,
    toggleDarkMode,
    theme,
    setTheme,
    announceThemeChange
  };
}

export default useThemeSwitcher;