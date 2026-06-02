import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useDateTime } from '../use-date-time';

describe('useDateTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns current time in real-time mode', () => {
    const before = new Date();
    const { result } = renderHook(() => useDateTime());

    expect(result.current.isVirtualNowPinned).toBe(false);
    expect(result.current.virtualNow.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('updates virtualNow every 15 seconds in real-time mode', () => {
    const { result } = renderHook(() => useDateTime());
    const initial = result.current.virtualNow.getTime();

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(result.current.virtualNow.getTime()).toBeGreaterThan(initial);
  });

  it('switches to custom time mode', () => {
    const { result } = renderHook(() => useDateTime());
    const custom = new Date('2025-01-01T12:00:00');

    act(() => {
      result.current.pinVirtualNow(custom);
    });

    expect(result.current.isVirtualNowPinned).toBe(true);
    expect(result.current.virtualNow).toBe(custom);
  });

  it('stops interval updates in custom time mode', () => {
    const { result } = renderHook(() => useDateTime());
    const custom = new Date('2025-01-01T12:00:00');

    act(() => {
      result.current.pinVirtualNow(custom);
    });

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    // virtualNow should still be the custom time, not updated
    expect(result.current.virtualNow).toBe(custom);
  });

  it('resets to real-time mode', () => {
    const { result } = renderHook(() => useDateTime());

    act(() => {
      result.current.pinVirtualNow(new Date('2025-01-01T12:00:00'));
    });
    expect(result.current.isVirtualNowPinned).toBe(true);

    act(() => {
      result.current.unpinVirtualNow();
    });

    expect(result.current.isVirtualNowPinned).toBe(false);
  });

  it('resumes interval after reset to now', () => {
    const { result } = renderHook(() => useDateTime());

    act(() => {
      result.current.pinVirtualNow(new Date('2025-01-01T12:00:00'));
    });

    act(() => {
      result.current.unpinVirtualNow();
    });

    const afterReset = result.current.virtualNow.getTime();

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(result.current.virtualNow.getTime()).toBeGreaterThan(afterReset);
  });

  it('does not update virtualNow before 15 seconds', () => {
    const { result } = renderHook(() => useDateTime());
    const initial = result.current.virtualNow.getTime();

    act(() => {
      vi.advanceTimersByTime(14_999);
    });

    expect(result.current.virtualNow.getTime()).toBe(initial);
  });

  it('replaces a previous custom time with a new one', () => {
    const { result } = renderHook(() => useDateTime());
    const first = new Date('2025-01-01T10:00:00');
    const second = new Date('2025-06-15T18:30:00');

    act(() => {
      result.current.pinVirtualNow(first);
    });
    expect(result.current.virtualNow).toBe(first);

    act(() => {
      result.current.pinVirtualNow(second);
    });
    expect(result.current.virtualNow).toBe(second);
    expect(result.current.isVirtualNowPinned).toBe(true);
  });

  it('unpinVirtualNow returns a fresh Date, not the old custom time', () => {
    const { result } = renderHook(() => useDateTime());
    const oldCustom = new Date('2000-01-01T00:00:00');

    act(() => {
      result.current.pinVirtualNow(oldCustom);
    });

    act(() => {
      result.current.unpinVirtualNow();
    });

    // The reset time should be much later than the old custom time
    expect(result.current.virtualNow.getTime()).toBeGreaterThan(oldCustom.getTime());
  });

  it('cleans up interval on unmount', () => {
    const { unmount } = renderHook(() => useDateTime());
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
