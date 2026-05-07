import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { useListKeyboardNavigation } from '../use-list-keyboard-navigation';

interface KeyOptions {
  isComposing?: boolean;
}

function makeKeyEvent(key: string, options: KeyOptions = {}) {
  const preventDefault = vi.fn();
  const event = {
    key,
    nativeEvent: { isComposing: options.isComposing ?? false } as KeyboardEvent,
    preventDefault,
  } as unknown as React.KeyboardEvent<HTMLInputElement>;
  return { event, preventDefault };
}

describe('useListKeyboardNavigation', () => {
  let scrollIntoViewMock: Mock;

  beforeEach(() => {
    scrollIntoViewMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoViewMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts the selection at the first item', () => {
    const items = ['a', 'b', 'c'];
    const { result } = renderHook(() => useListKeyboardNavigation({ items, onActivate: vi.fn() }));

    expect(result.current.selectedIndex).toBe(0);
  });

  it('advances and clamps to the last item on ArrowDown', () => {
    const items = ['a', 'b', 'c'];
    const { result } = renderHook(() => useListKeyboardNavigation({ items, onActivate: vi.fn() }));

    act(() => {
      const { event, preventDefault } = makeKeyEvent('ArrowDown');
      result.current.handleInputKeyDown(event);
      expect(preventDefault).toHaveBeenCalled();
    });
    expect(result.current.selectedIndex).toBe(1);

    act(() => {
      result.current.handleInputKeyDown(makeKeyEvent('ArrowDown').event);
      result.current.handleInputKeyDown(makeKeyEvent('ArrowDown').event);
    });
    expect(result.current.selectedIndex).toBe(2);
  });

  it('moves and clamps to the first item on ArrowUp', () => {
    const items = ['a', 'b', 'c'];
    const { result } = renderHook(() => useListKeyboardNavigation({ items, onActivate: vi.fn() }));

    act(() => {
      result.current.handleInputKeyDown(makeKeyEvent('ArrowDown').event);
      result.current.handleInputKeyDown(makeKeyEvent('ArrowDown').event);
    });
    expect(result.current.selectedIndex).toBe(2);

    act(() => {
      result.current.handleInputKeyDown(makeKeyEvent('ArrowUp').event);
      result.current.handleInputKeyDown(makeKeyEvent('ArrowUp').event);
      result.current.handleInputKeyDown(makeKeyEvent('ArrowUp').event);
    });
    expect(result.current.selectedIndex).toBe(0);
  });

  it('activates the selected item on Enter', () => {
    const items = ['a', 'b', 'c'];
    const onActivate = vi.fn();
    const { result } = renderHook(() => useListKeyboardNavigation({ items, onActivate }));

    act(() => {
      result.current.handleInputKeyDown(makeKeyEvent('ArrowDown').event);
    });
    act(() => {
      const { event, preventDefault } = makeKeyEvent('Enter');
      result.current.handleInputKeyDown(event);
      expect(preventDefault).toHaveBeenCalled();
    });

    expect(onActivate).toHaveBeenCalledWith('b', 1);
  });

  it('ignores key events while IME composition is active', () => {
    const items = ['a', 'b'];
    const onActivate = vi.fn();
    const { result } = renderHook(() => useListKeyboardNavigation({ items, onActivate }));

    act(() => {
      result.current.handleInputKeyDown(makeKeyEvent('Enter', { isComposing: true }).event);
      result.current.handleInputKeyDown(makeKeyEvent('ArrowDown', { isComposing: true }).event);
    });

    expect(onActivate).not.toHaveBeenCalled();
    expect(result.current.selectedIndex).toBe(0);
  });

  it('does nothing when the list is empty', () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() =>
      useListKeyboardNavigation({ items: [] as string[], onActivate }),
    );

    act(() => {
      const { event, preventDefault } = makeKeyEvent('Enter');
      result.current.handleInputKeyDown(event);
      expect(preventDefault).not.toHaveBeenCalled();
    });

    expect(onActivate).not.toHaveBeenCalled();
  });

  it('resets the selection when the items reference changes', () => {
    const itemsA = ['a', 'b', 'c'];
    const itemsB = ['x', 'y'];

    const { result, rerender } = renderHook(
      ({ items }: { items: readonly string[] }) =>
        useListKeyboardNavigation({ items, onActivate: vi.fn() }),
      { initialProps: { items: itemsA } },
    );

    act(() => {
      result.current.handleInputKeyDown(makeKeyEvent('ArrowDown').event);
      result.current.handleInputKeyDown(makeKeyEvent('ArrowDown').event);
    });
    expect(result.current.selectedIndex).toBe(2);

    rerender({ items: itemsB });
    expect(result.current.selectedIndex).toBe(0);
  });

  it('falls back to the first item when selectedIndex is out of range on Enter', () => {
    const onActivate = vi.fn();
    const items = ['a', 'b', 'c'];

    const { result, rerender } = renderHook(
      ({ items: list }: { items: readonly string[] }) =>
        useListKeyboardNavigation({ items: list, onActivate }),
      { initialProps: { items } },
    );

    act(() => {
      result.current.handleInputKeyDown(makeKeyEvent('ArrowDown').event);
      result.current.handleInputKeyDown(makeKeyEvent('ArrowDown').event);
    });
    expect(result.current.selectedIndex).toBe(2);

    // Same-render shrink: the reset to 0 hasn't been applied yet when the next
    // Enter handler reads its closure. The hook must clamp.
    rerender({ items: ['only'] });

    act(() => {
      result.current.handleInputKeyDown(makeKeyEvent('Enter').event);
    });

    expect(onActivate).toHaveBeenCalledWith('only', 0);
  });

  it('scrolls the registered item into view when the selection changes', () => {
    const items = ['a', 'b', 'c'];
    const { result } = renderHook(() => useListKeyboardNavigation({ items, onActivate: vi.fn() }));

    const elements: HTMLElement[] = items.map(() => document.createElement('button'));

    act(() => {
      elements.forEach((el, index) => {
        result.current.registerItemRef(index)(el);
      });
    });

    scrollIntoViewMock.mockClear();

    act(() => {
      result.current.handleInputKeyDown(makeKeyEvent('ArrowDown').event);
    });

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: 'nearest' });
  });
});
