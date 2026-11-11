import { useEffect, useState } from 'react';

const read = (): boolean => {
  try { return document.documentElement.classList.contains('dark') || document.documentElement.getAttribute('data-theme') === 'dark'; } catch { return false; }
};

/** Tracks the app's dark mode (the `dark` class on <html>). */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(read);
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    const obs = new MutationObserver(() => setDark(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}
