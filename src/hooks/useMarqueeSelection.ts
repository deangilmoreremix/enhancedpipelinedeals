import { useCallback, useEffect, useRef, useState } from 'react';
import { useBoardSelectionStore } from '../store/boardSelectionStore';
import {
  Rect, applyMarqueeSelection, exceedsThreshold, idsInMarquee, isMarqueeBlocked, rectFromPoints
} from '../utils/marquee';

/**
 * Drag-rectangle selection on the board background. Mouse down on empty space (not on a card, button,
 * input or column header) and drag to draw a rectangle; intersecting `[data-deal-id]` cards are selected
 * (Shift adds to the existing selection). A plain click on empty space clears the selection.
 * The returned `rect` is in the scroll container's content coordinates (render it inside the scrolling content).
 */
export function useMarqueeSelection(containerRef: React.RefObject<HTMLElement>) {
  const [rect, setRect] = useState<Rect | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container || e.button !== 0 || isMarqueeBlocked(e.target)) return;
    e.preventDefault();

    const toContent = (clientX: number, clientY: number) => {
      const b = container.getBoundingClientRect();
      return { x: clientX - b.left + container.scrollLeft, y: clientY - b.top + container.scrollTop };
    };
    const start = toContent(e.clientX, e.clientY);
    const additive = e.shiftKey;
    const base = additive ? useBoardSelectionStore.getState().selectedIds : [];
    let active = false;

    const cardRects = () => {
      const b = container.getBoundingClientRect();
      return Array.from(container.querySelectorAll<HTMLElement>('[data-deal-id]')).map(el => {
        const r = el.getBoundingClientRect();
        return {
          id: el.dataset.dealId as string,
          rect: { left: r.left - b.left + container.scrollLeft, top: r.top - b.top + container.scrollTop, right: r.right - b.left + container.scrollLeft, bottom: r.bottom - b.top + container.scrollTop }
        };
      });
    };

    const move = (ev: MouseEvent) => {
      const cur = toContent(ev.clientX, ev.clientY);
      if (!active) {
        if (!exceedsThreshold(start, cur)) return;
        active = true;
      }
      const marquee = rectFromPoints(start, cur);
      setRect(marquee);
      useBoardSelectionStore.getState().setSelection(applyMarqueeSelection(base, idsInMarquee(marquee, cardRects()), additive));
    };
    const stop = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      cleanup.current = null;
    };
    const up = () => {
      stop();
      setRect(null);
      // A plain click on empty space clears the selection
      if (!active && !additive) useBoardSelectionStore.getState().clearSelection();
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    cleanup.current = stop;
  }, [containerRef]);

  return { rect, onMouseDown };
}
