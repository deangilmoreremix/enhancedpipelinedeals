import { useCallback, useEffect, useRef } from 'react';

/**
 * Tracks whether Shift was held during the current pointer interaction (WIP-limit override on drop).
 * @hello-pangea/dnd calls onDragEnd after its drop animation, by which time users have usually already
 * released Shift, so reading the live key state is not enough: Shift counts if it was down at mousedown,
 * at any keydown, or at mouseup of the interaction.
 */
export function useShiftOverride(): () => boolean {
  const live = useRef(false);
  const latch = useRef(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { live.current = e.shiftKey; if (e.shiftKey) latch.current = true; };
    const start = (e: MouseEvent) => { latch.current = e.shiftKey; };
    const end = (e: MouseEvent) => { if (e.shiftKey) latch.current = true; };
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', key);
    window.addEventListener('mousedown', start, true);
    window.addEventListener('mouseup', end, true);
    return () => {
      window.removeEventListener('keydown', key); window.removeEventListener('keyup', key);
      window.removeEventListener('mousedown', start, true); window.removeEventListener('mouseup', end, true);
    };
  }, []);
  return useCallback(() => live.current || latch.current, []);
}
