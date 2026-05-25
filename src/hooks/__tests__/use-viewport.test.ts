import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useViewport } from '../use-viewport';

class MockVisualViewport extends EventTarget {
  width: number;
  height: number;

  constructor(width: number, height: number) {
    super();
    this.width = width;
    this.height = height;
  }
}

const originalInnerWidth = window.innerWidth;
const originalInnerHeight = window.innerHeight;
const originalVisualViewport = window.visualViewport;

function setInnerSize(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
    value: height,
  });
}

function setVisualViewport(viewport: VisualViewport | undefined) {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: viewport,
  });
}

afterEach(() => {
  setInnerSize(originalInnerWidth, originalInnerHeight);
  setVisualViewport(originalVisualViewport ?? undefined);
});

describe('useViewport', () => {
  it('uses visualViewport width and height when available', () => {
    setInnerSize(1280, 800);
    setVisualViewport(new MockVisualViewport(1024, 768) as unknown as VisualViewport);

    const { result } = renderHook(() => useViewport());

    expect(result.current).toEqual({ width: 1024, height: 768 });
  });

  it('falls back to window.innerWidth / innerHeight when visualViewport is unavailable', () => {
    setInnerSize(1280, 800);
    setVisualViewport(undefined);

    const { result } = renderHook(() => useViewport());

    expect(result.current).toEqual({ width: 1280, height: 800 });
  });

  it('updates on the window resize event', () => {
    setInnerSize(900, 700);
    setVisualViewport(undefined);

    const { result } = renderHook(() => useViewport());

    act(() => {
      setInnerSize(1440, 900);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toEqual({ width: 1440, height: 900 });
  });

  it('updates on the visualViewport resize event (e.g. pinch-zoom)', () => {
    const viewport = new MockVisualViewport(1100, 800);
    setInnerSize(1400, 1000);
    setVisualViewport(viewport as unknown as VisualViewport);

    const { result } = renderHook(() => useViewport());

    act(() => {
      viewport.width = 980;
      viewport.height = 720;
      viewport.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toEqual({ width: 980, height: 720 });
  });

  it('updates on the visualViewport scroll event (mobile Safari URL-bar hide)', () => {
    const viewport = new MockVisualViewport(390, 844);
    setInnerSize(390, 844);
    setVisualViewport(viewport as unknown as VisualViewport);

    const { result } = renderHook(() => useViewport());

    act(() => {
      // URL bar hides on scroll -> visual viewport height grows.
      viewport.height = 900;
      viewport.dispatchEvent(new Event('scroll'));
    });

    expect(result.current).toEqual({ width: 390, height: 900 });
  });
});
