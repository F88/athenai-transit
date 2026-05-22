import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useViewportWidth } from '../use-viewport-width';

class MockVisualViewport extends EventTarget {
  width: number;

  constructor(width: number) {
    super();
    this.width = width;
  }
}

const originalInnerWidth = window.innerWidth;
const originalVisualViewport = window.visualViewport;

function setInnerWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

function setVisualViewport(viewport: VisualViewport | undefined) {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: viewport,
  });
}

afterEach(() => {
  setInnerWidth(originalInnerWidth);
  setVisualViewport(originalVisualViewport ?? undefined);
});

describe('useViewportWidth', () => {
  it('uses visualViewport width when available', () => {
    setInnerWidth(1280);
    setVisualViewport(new MockVisualViewport(1024) as unknown as VisualViewport);

    const { result } = renderHook(() => useViewportWidth());

    expect(result.current).toBe(1024);
  });

  it('falls back to innerWidth when visualViewport is unavailable', () => {
    setInnerWidth(1280);
    setVisualViewport(undefined);

    const { result } = renderHook(() => useViewportWidth());

    expect(result.current).toBe(1280);
  });

  it('updates when the window resize event changes innerWidth', () => {
    setInnerWidth(900);
    setVisualViewport(undefined);

    const { result } = renderHook(() => useViewportWidth());

    act(() => {
      setInnerWidth(1440);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(1440);
  });

  it('updates when the visualViewport resize event changes width', () => {
    const viewport = new MockVisualViewport(1100);
    setInnerWidth(1400);
    setVisualViewport(viewport as unknown as VisualViewport);

    const { result } = renderHook(() => useViewportWidth());

    act(() => {
      viewport.width = 980;
      viewport.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(980);
  });
});
