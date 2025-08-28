import { useState, useEffect } from 'react';

/**
 * Hook to detect if a media query matches
 * Useful for responsive behavior and feature detection
 */
export function useMediaQuery(query: string): boolean {
  // Initialize with the current match state
  const getMatches = (): boolean => {
    // SSR safety check
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  };

  const [matches, setMatches] = useState<boolean>(getMatches());

  // Update matches state when the media query changes
  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const updateMatches = () => setMatches(mediaQuery.matches);
    
    // Set up event listener
    mediaQuery.addEventListener('change', updateMatches);
    
    // Check immediately in case it already matches
    updateMatches();
    
    // Clean up event listener
    return () => {
      mediaQuery.removeEventListener('change', updateMatches);
    };
  }, [query]);

  return matches;
}

// Export common media queries
export const useIsDarkMode = () => useMediaQuery('(prefers-color-scheme: dark)');
export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
export const useIsMobile = () => useMediaQuery('(max-width: 767px)');
export const useIsTablet = () => useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
export const useIsLargeDesktop = () => useMediaQuery('(min-width: 1440px)');
export const useIsTouchDevice = () => useMediaQuery('(hover: none) and (pointer: coarse)');

export default useMediaQuery;