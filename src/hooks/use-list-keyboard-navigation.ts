import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';

/**
 * Options for {@link useListKeyboardNavigation}.
 */
export interface UseListKeyboardNavigationOptions<T> {
  /** Items shown in the list. */
  items: readonly T[];
  /**
   * Stable identity for the current "logical" list. The selection resets
   * to 0 — and the highlighted row is re-scrolled into view — only when
   * this value changes (compared with `Object.is`). Items growing in place
   * (e.g. infinite-scroll pagination appending another page) does NOT
   * reset selection because `resetKey` does not change with them.
   *
   * Typical value: the search query string, or any token that uniquely
   * identifies the user's current search intent.
   */
  resetKey: unknown;
  /** Invoked when Enter is pressed on the currently selected item. */
  onActivate: (item: T, index: number) => void;
}

/**
 * Result of {@link useListKeyboardNavigation}.
 */
export interface UseListKeyboardNavigationReturn {
  /** Index currently highlighted via keyboard. Always within `[0, items.length)` when items is non-empty. */
  selectedIndex: number;
  /** Bind to the input element's `onKeyDown`. Handles ArrowUp/Down/Enter. */
  handleInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  /** Returns a callback ref to register the list-item element at `index`. */
  registerItemRef: (index: number) => (el: HTMLElement | null) => void;
}

/**
 * Adds keyboard navigation to a search-style result list driven by a single
 * input element.
 *
 * - ArrowDown / ArrowUp move the selection within `items`.
 * - Enter activates the selected item via `onActivate`.
 * - The selection resets to 0 whenever `resetKey` changes — using the React
 *   "store info from previous renders" pattern (no useEffect-driven setState).
 *   Items growing in place (paginated suffix-append) does NOT reset selection
 *   because `resetKey` is independent of `items` identity.
 * - The currently selected item is scrolled into view via
 *   `scrollIntoView({ block: 'nearest' })` whenever the selection changes or
 *   `resetKey` changes. `block: 'nearest'` keeps the row visible without
 *   jumping the list when it is already on screen.
 * - IME composition is honored: the Enter that confirms a kana conversion is
 *   ignored so it does not double as activation.
 *
 * @param options - List items, reset key, and activation callback.
 * @returns Selected index, key handler, and per-item ref registrar.
 */
export function useListKeyboardNavigation<T>(
  options: UseListKeyboardNavigationOptions<T>,
): UseListKeyboardNavigationReturn {
  const { items, resetKey, onActivate } = options;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);

  // Reset highlight to the first row whenever resetKey changes (= the user
  // moved on to a different logical search). Stale entries in itemRefs.current
  // are cleared automatically: callback refs of unmounted rows are invoked
  // with null on the next commit.
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey);
    setSelectedIndex(0);
  }

  // Scroll the highlighted row into view when selection changes or the list
  // is logically replaced (resetKey changed). Pagination (items growing) is
  // intentionally NOT a dependency: re-firing scrollIntoView on every page
  // load would yank the user back to the top while they are scrolling
  // through a long result list.
  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, resetKey]);

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.nativeEvent.isComposing) {
        return;
      }
      if (items.length === 0) {
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((index) => Math.min(index + 1, items.length - 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        // Guard against an out-of-range `selectedIndex` snapshot: when items
        // shrank in the same render the index reset has already been queued
        // but not applied, so we fall back to the first item.
        const safeIndex = selectedIndex < items.length ? selectedIndex : 0;
        const target = items[safeIndex];
        if (target !== undefined) {
          onActivate(target, safeIndex);
        }
      }
    },
    [items, selectedIndex, onActivate],
  );

  const registerItemRef = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      itemRefs.current[index] = el;
    },
    [],
  );

  return { selectedIndex, handleInputKeyDown, registerItemRef };
}
