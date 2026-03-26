import { useCallback, useEffect, useState } from 'react';
import { getTimeParam } from '../utils/query-params';

const NOW_UPDATE_INTERVAL_MS = 15_000;

/**
 * Return type for the useDateTime hook.
 */
export interface UseDateTimeReturn {
  /** The effective date/time (custom or real-time). */
  dateTime: Date;
  /** Whether a custom time is active. */
  isCustomTime: boolean;
  /** Reset to real-time mode. */
  resetToNow: () => void;
  /** Set a custom time (switches to manual mode). */
  setCustomTime: (date: Date) => void;
}

/**
 * Manages the app's date/time state with real-time auto-update.
 *
 * In real-time mode, `now` is updated every 15 seconds.
 * When a custom time is set, the interval stops and the custom value is used.
 *
 * @returns Date/time state and controls.
 */
export function useDateTime(): UseDateTimeReturn {
  const [now, setNow] = useState(() => new Date());
  // Initialize custom time from ?time= query param (RFC 3339)
  const [customTime, setCustomTimeState] = useState<Date | null>(() => getTimeParam());

  const isCustomTime = customTime !== null;
  const dateTime = customTime ?? now;

  // Auto-update `now` every 15 seconds in real-time mode
  useEffect(() => {
    if (customTime !== null) {
      return;
    }
    const id = setInterval(() => {
      setNow(new Date());
    }, NOW_UPDATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [customTime]);

  const resetToNow = useCallback(() => {
    setCustomTimeState(null);
    setNow(new Date());
  }, []);

  const setCustomTime = useCallback((date: Date) => {
    setCustomTimeState(date);
  }, []);

  return { dateTime, isCustomTime, resetToNow, setCustomTime };
}
