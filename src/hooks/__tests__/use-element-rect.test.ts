import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useElementRect } from '../use-element-rect';

// jsdom does not implement `ResizeObserver`; mock it so the hook can
// install / tear down the observer and so tests can trigger the
// callback synchronously without a real browser layout step.
class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  readonly callback: ResizeObserverCallback;
  readonly observed = new Set<Element>();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  observe(target: Element) {
    this.observed.add(target);
  }

  unobserve(target: Element) {
    this.observed.delete(target);
  }

  disconnect() {
    this.observed.clear();
  }
}

const originalResizeObserver = globalThis.ResizeObserver;

beforeEach(() => {
  MockResizeObserver.instances = [];
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
});

afterEach(() => {
  globalThis.ResizeObserver = originalResizeObserver;
});

function makeElement(rect: Partial<DOMRectInit & { top: number; left: number }> = {}) {
  const el = document.createElement('div');
  // jsdom returns all-zero rects; stub `getBoundingClientRect` so the
  // hook sees deterministic values.
  const r: DOMRect = {
    x: rect.x ?? rect.left ?? 0,
    y: rect.y ?? rect.top ?? 0,
    width: rect.width ?? 0,
    height: rect.height ?? 0,
    top: rect.top ?? 0,
    left: rect.left ?? 0,
    right: (rect.left ?? 0) + (rect.width ?? 0),
    bottom: (rect.top ?? 0) + (rect.height ?? 0),
    toJSON() {
      return { ...this };
    },
  };
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(r);
  return el;
}

describe('useElementRect', () => {
  it('returns null when no element is given', () => {
    const { result } = renderHook(() => useElementRect(null));
    expect(result.current).toBeNull();
  });

  it('returns the element rect on mount via getBoundingClientRect', () => {
    const el = makeElement({ left: 10, top: 20, width: 100, height: 80 });
    const { result } = renderHook(({ e }) => useElementRect(e), {
      initialProps: { e: el as HTMLElement },
    });

    expect(result.current).not.toBeNull();
    expect(result.current?.left).toBe(10);
    expect(result.current?.top).toBe(20);
    expect(result.current?.width).toBe(100);
    expect(result.current?.height).toBe(80);
  });

  it('installs a ResizeObserver on the element', () => {
    const el = makeElement({ width: 50, height: 50 });
    renderHook(() => useElementRect(el));

    expect(MockResizeObserver.instances).toHaveLength(1);
    expect(MockResizeObserver.instances[0].observed.has(el)).toBe(true);
  });

  it('disconnects the observer when the element changes', () => {
    const a = makeElement({ width: 10, height: 10 });
    const b = makeElement({ width: 20, height: 20 });
    const { rerender } = renderHook(({ e }) => useElementRect(e), {
      initialProps: { e: a as HTMLElement },
    });

    const firstObserver = MockResizeObserver.instances[0];
    expect(firstObserver.observed.has(a)).toBe(true);

    rerender({ e: b });

    // Old observer is disconnected; a fresh one observes the new element.
    expect(firstObserver.observed.size).toBe(0);
    const secondObserver = MockResizeObserver.instances[1];
    expect(secondObserver.observed.has(b)).toBe(true);
  });

  it('updates the rect when the observer callback fires', () => {
    const el = makeElement({ left: 0, top: 0, width: 100, height: 100 });
    const { result } = renderHook(() => useElementRect(el));
    expect(result.current?.width).toBe(100);

    // Simulate a resize (e.g. drag handle in multi-pane).
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 200,
      height: 150,
      top: 0,
      left: 0,
      right: 200,
      bottom: 150,
      toJSON() {
        return { ...this };
      },
    });
    const observer = MockResizeObserver.instances[0];
    act(() => {
      observer.callback([], observer as unknown as ResizeObserver);
    });

    expect(result.current?.width).toBe(200);
    expect(result.current?.height).toBe(150);
  });
});
