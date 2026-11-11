import { renderHook } from '@testing-library/react';
import { useShiftOverride } from '../../hooks/useShiftOverride';

/** Regression (e2e B): Shift released right at mouse-up (before pangea's onDragEnd) lost the WIP override. */
describe('useShiftOverride', () => {
  const fire = (type: string, init: any) => window.dispatchEvent(new (type.startsWith('key') ? KeyboardEvent : MouseEvent)(type, { bubbles: true, ...init }));

  it('stays true after Shift is released within the same interaction', () => {
    const { result } = renderHook(() => useShiftOverride());
    fire('mousedown', {});
    fire('keydown', { key: 'Shift', shiftKey: true });
    fire('mouseup', { shiftKey: true });
    fire('keyup', { key: 'Shift', shiftKey: false });
    expect(result.current()).toBe(true);
  });

  it('is reset by the next mousedown without Shift', () => {
    const { result } = renderHook(() => useShiftOverride());
    fire('keydown', { key: 'Shift', shiftKey: true });
    fire('keyup', { key: 'Shift', shiftKey: false });
    fire('mousedown', { shiftKey: false });
    expect(result.current()).toBe(false);
  });

  it('is true when Shift is already held at mousedown', () => {
    const { result } = renderHook(() => useShiftOverride());
    fire('mousedown', { shiftKey: true });
    expect(result.current()).toBe(true);
  });
});
