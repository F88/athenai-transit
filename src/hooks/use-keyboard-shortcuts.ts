import { useEffect, useRef } from 'react';
import { shouldHandleShortcut } from '../utils/should-handle-shortcut';

/**
 * Action handlers invoked when a matching shortcut is pressed.
 * One handler per supported shortcut.
 */
export interface KeyboardShortcutHandlers {
  /** Open the stop search modal. Triggered by `/`. */
  onOpenSearch: () => void;
  /** Open the shortcut help dialog. Triggered by `?`. */
  onOpenHelp: () => void;
}

/**
 * Options for {@link useKeyboardShortcuts}.
 */
export interface UseKeyboardShortcutsOptions {
  /**
   * Whether shortcut handling is currently enabled.
   * Callers should pass `false` whenever a modal is already open so that
   * shortcuts do not fire on top of modal interactions.
   */
  enabled: boolean;
  /** Action handlers. See {@link KeyboardShortcutHandlers}. */
  handlers: KeyboardShortcutHandlers;
}

/**
 * Register a global `keydown` listener that dispatches to the provided
 * handlers based on key matching in {@link shouldHandleShortcut}.
 *
 * Design notes:
 * - Handlers are stored in a ref so that the listener sees the latest
 *   callbacks without being re-registered on every render. The effect
 *   depends only on `enabled`, minimising listener churn.
 * - `preventDefault()` is called only when a shortcut actually fires.
 *   When the event is suppressed (modifier, IME, form field, etc.) the
 *   default browser behaviour is preserved.
 * - When `enabled` is false, the listener is not registered at all. This
 *   guarantees that shortcuts do not fire while a modal is open.
 *
 * @param options - Enabled flag and handlers. See {@link UseKeyboardShortcutsOptions}.
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void {
  const { enabled, handlers } = options;

  // Keep a ref to the latest handlers so the effect does not need to
  // re-register the listener whenever callers pass new closures.
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      const action = shouldHandleShortcut(event, true);
      if (action === null) {
        return;
      }
      event.preventDefault();
      if (action === 'search') {
        handlersRef.current.onOpenSearch();
      } else if (action === 'help') {
        handlersRef.current.onOpenHelp();
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [enabled]);
}
