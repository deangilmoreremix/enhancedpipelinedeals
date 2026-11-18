import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useDealRecordHotkeys, DealRecordHotkeyHandlers, CHORD_TIMEOUT_MS } from '../hooks/useDealRecordHotkeys';
import { RecordShortcutHelp } from '../components/deals/RecordShortcutHelp';

const Host: React.FC<{ id?: string | null; handlers: DealRecordHotkeyHandlers; enabled?: boolean }> = ({ id = 'd1', handlers, enabled }) => {
  useDealRecordHotkeys(id, handlers, enabled);
  return <div><input aria-label="field" /></div>;
};
const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.body) => fireEvent.keyDown(target, { key, ...init });

const make = () => ({
  onEditTitle: jest.fn(), onNewNote: jest.fn(), onNewTask: jest.fn(), onToggleFavorite: jest.fn(),
  onPrevious: jest.fn(), onNext: jest.fn(), onGoPipeline: jest.fn(), onGoContacts: jest.fn(), onClose: jest.fn()
});

describe('useDealRecordHotkeys', () => {
  it('fires single-key handlers', () => {
    const h = make();
    render(<Host handlers={h} />);
    press('e'); press('n'); press('t'); press('f'); press('['); press(']'); press('Escape');
    expect(h.onEditTitle).toHaveBeenCalledTimes(1);
    expect(h.onNewNote).toHaveBeenCalledTimes(1);
    expect(h.onNewTask).toHaveBeenCalledTimes(1);
    expect(h.onToggleFavorite).toHaveBeenCalledTimes(1);
    expect(h.onPrevious).toHaveBeenCalledTimes(1);
    expect(h.onNext).toHaveBeenCalledTimes(1);
    expect(h.onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores keys while typing, with modifiers, when disabled or without a deal', () => {
    const h = make();
    const { rerender } = render(<Host handlers={h} />);
    press('n', {}, screen.getByLabelText('field'));
    press('n', { ctrlKey: true });
    press('n', { metaKey: true });
    rerender(<Host handlers={h} enabled={false} />);
    press('n');
    rerender(<Host handlers={h} id={null} />);
    press('n');
    expect(h.onNewNote).not.toHaveBeenCalled();
  });

  it('does not close on Esc while a modal dialog is open', () => {
    const h = make();
    render(<><Host handlers={h} /><div role="dialog" aria-modal="true" /></>);
    press('Escape');
    expect(h.onClose).not.toHaveBeenCalled();
  });

  it('supports g p / g c chords and expires them', () => {
    jest.useFakeTimers();
    const h = make();
    render(<Host handlers={h} />);
    press('g'); press('p');
    expect(h.onGoPipeline).toHaveBeenCalledTimes(1);
    press('g'); press('c');
    expect(h.onGoContacts).toHaveBeenCalledTimes(1);
    press('g');
    act(() => { jest.advanceTimersByTime(CHORD_TIMEOUT_MS + 10); });
    press('p');
    expect(h.onGoPipeline).toHaveBeenCalledTimes(1);
    press('g'); press('n'); // not a chord: falls through to the normal key
    expect(h.onNewNote).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});

describe('RecordShortcutHelp', () => {
  it('opens with ? (not while typing), lists shortcuts and closes with Esc', () => {
    render(<><RecordShortcutHelp /><input aria-label="field" /></>);
    expect(screen.queryByRole('dialog')).toBeNull();
    press('?', {}, screen.getByLabelText('field'));
    expect(screen.queryByRole('dialog')).toBeNull();
    press('?');
    expect(screen.getByRole('dialog', { name: 'Deal shortcuts' })).toBeInTheDocument();
    expect(screen.getByText('Toggle favorite')).toBeInTheDocument();
    press('Escape');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('supports controlled mode and the close button', () => {
    const onOpenChange = jest.fn();
    render(<RecordShortcutHelp open onOpenChange={onOpenChange} listen={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close shortcuts' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
