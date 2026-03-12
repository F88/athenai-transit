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

    expect(result.current.isCustomTime).toBe(false);
    expect(result.current.dateTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('updates dateTime every 15 seconds in real-time mode', () => {
    const { result } = renderHook(() => useDateTime());
    const initial = result.current.dateTime.getTime();

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(result.current.dateTime.getTime()).toBeGreaterThan(initial);
  });

  it('switches to custom time mode', () => {
    const { result } = renderHook(() => useDateTime());
    const custom = new Date('2025-01-01T12:00:00');

    act(() => {
      result.current.setCustomTime(custom);
    });

    expect(result.current.isCustomTime).toBe(true);
    expect(result.current.dateTime).toBe(custom);
  });

  it('stops interval updates in custom time mode', () => {
    const { result } = renderHook(() => useDateTime());
    const custom = new Date('2025-01-01T12:00:00');

    act(() => {
      result.current.setCustomTime(custom);
    });

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    // dateTime should still be the custom time, not updated
    expect(result.current.dateTime).toBe(custom);
  });

  it('resets to real-time mode', () => {
    const { result } = renderHook(() => useDateTime());

    act(() => {
      result.current.setCustomTime(new Date('2025-01-01T12:00:00'));
    });
    expect(result.current.isCustomTime).toBe(true);

    act(() => {
      result.current.resetToNow();
    });

    expect(result.current.isCustomTime).toBe(false);
  });

  it('resumes interval after reset to now', () => {
    const { result } = renderHook(() => useDateTime());

    act(() => {
      result.current.setCustomTime(new Date('2025-01-01T12:00:00'));
    });

    act(() => {
      result.current.resetToNow();
    });

    const afterReset = result.current.dateTime.getTime();

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(result.current.dateTime.getTime()).toBeGreaterThan(afterReset);
  });

  it('does not update dateTime before 15 seconds', () => {
    const { result } = renderHook(() => useDateTime());
    const initial = result.current.dateTime.getTime();

    act(() => {
      vi.advanceTimersByTime(14_999);
    });

    expect(result.current.dateTime.getTime()).toBe(initial);
  });

  it('replaces a previous custom time with a new one', () => {
    const { result } = renderHook(() => useDateTime());
    const first = new Date('2025-01-01T10:00:00');
    const second = new Date('2025-06-15T18:30:00');

    act(() => {
      result.current.setCustomTime(first);
    });
    expect(result.current.dateTime).toBe(first);

    act(() => {
      result.current.setCustomTime(second);
    });
    expect(result.current.dateTime).toBe(second);
    expect(result.current.isCustomTime).toBe(true);
  });

  it('resetToNow returns a fresh Date, not the old custom time', () => {
    const { result } = renderHook(() => useDateTime());
    const oldCustom = new Date('2000-01-01T00:00:00');

    act(() => {
      result.current.setCustomTime(oldCustom);
    });

    act(() => {
      result.current.resetToNow();
    });

    // The reset time should be much later than the old custom time
    expect(result.current.dateTime.getTime()).toBeGreaterThan(oldCustom.getTime());
  });

  it('cleans up interval on unmount', () => {
    const { unmount } = renderHook(() => useDateTime());
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
