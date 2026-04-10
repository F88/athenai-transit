/**
 * @vitest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useKeyboardShortcuts } from '../use-keyboard-shortcuts';

/**
 * Dispatch a keydown event on `document` so the global listener picks it up.
 * Returns the dispatched event so callers can inspect `defaultPrevented`.
 */
function dispatchKey(key: string, init: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  document.dispatchEvent(event);
  return event;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useKeyboardShortcuts', () => {
  it('calls onOpenSearch when "/" is pressed', () => {
    const onOpenSearch = vi.fn();
    const onOpenHelp = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
        handlers: { onOpenSearch, onOpenHelp },
      }),
    );

    const event = dispatchKey('/');

    expect(onOpenSearch).toHaveBeenCalledOnce();
    expect(onOpenHelp).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('calls onOpenHelp when "?" is pressed', () => {
    const onOpenSearch = vi.fn();
    const onOpenHelp = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
        handlers: { onOpenSearch, onOpenHelp },
      }),
    );

    const event = dispatchKey('?');

    expect(onOpenHelp).toHaveBeenCalledOnce();
    expect(onOpenSearch).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not call any handler for unrelated keys', () => {
    const onOpenSearch = vi.fn();
    const onOpenHelp = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
        handlers: { onOpenSearch, onOpenHelp },
      }),
    );

    const event = dispatchKey('a');

    expect(onOpenSearch).not.toHaveBeenCalled();
    expect(onOpenHelp).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('does not call handlers when enabled is false', () => {
    const onOpenSearch = vi.fn();
    const onOpenHelp = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        enabled: false,
        handlers: { onOpenSearch, onOpenHelp },
      }),
    );

    const event = dispatchKey('/');

    expect(onOpenSearch).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('removes the listener when enabled flips from true to false', () => {
    const onOpenSearch = vi.fn();
    const onOpenHelp = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useKeyboardShortcuts({
          enabled,
          handlers: { onOpenSearch, onOpenHelp },
        }),
      { initialProps: { enabled: true } },
    );

    dispatchKey('/');
    expect(onOpenSearch).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    dispatchKey('/');
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
  });

  it('starts firing when enabled flips from false to true', () => {
    const onOpenSearch = vi.fn();
    const onOpenHelp = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useKeyboardShortcuts({
          enabled,
          handlers: { onOpenSearch, onOpenHelp },
        }),
      { initialProps: { enabled: false } },
    );

    dispatchKey('/');
    expect(onOpenSearch).not.toHaveBeenCalled();

    rerender({ enabled: true });
    dispatchKey('/');
    expect(onOpenSearch).toHaveBeenCalledOnce();
  });

  it('removes the listener on unmount', () => {
    const onOpenSearch = vi.fn();
    const onOpenHelp = vi.fn();
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
        handlers: { onOpenSearch, onOpenHelp },
      }),
    );

    unmount();
    dispatchKey('/');

    expect(onOpenSearch).not.toHaveBeenCalled();
  });

  it('uses the latest handlers across re-renders without re-registering', () => {
    const firstSearch = vi.fn();
    const secondSearch = vi.fn();
    const onOpenHelp = vi.fn();
    const { rerender } = renderHook(
      ({ onOpenSearch }: { onOpenSearch: () => void }) =>
        useKeyboardShortcuts({
          enabled: true,
          handlers: { onOpenSearch, onOpenHelp },
        }),
      { initialProps: { onOpenSearch: firstSearch } },
    );

    rerender({ onOpenSearch: secondSearch });
    dispatchKey('/');

    expect(firstSearch).not.toHaveBeenCalled();
    expect(secondSearch).toHaveBeenCalledOnce();
  });

  it('does not fire while IME composition is in progress', () => {
    const onOpenSearch = vi.fn();
    const onOpenHelp = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
        handlers: { onOpenSearch, onOpenHelp },
      }),
    );

    dispatchKey('/', { isComposing: true });

    expect(onOpenSearch).not.toHaveBeenCalled();
  });

  it('does not fire when an <input> has focus', () => {
    const onOpenSearch = vi.fn();
    const onOpenHelp = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
        handlers: { onOpenSearch, onOpenHelp },
      }),
    );

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    // Dispatch from the input element so event.target is the input.
    const event = new KeyboardEvent('keydown', {
      key: '/',
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);

    expect(onOpenSearch).not.toHaveBeenCalled();
  });
});
