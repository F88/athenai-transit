import { useCallback, useMemo, useState } from 'react';

import { getServiceDayMinutes } from '../domain/transit/service-day';
import type { GlobalFilter } from '../types/app/global-filter';

/**
 * Service-day minute at which the empty-stop omit policy auto-enables.
 * Matches the original inline value in `App`; 22:00 chosen so the
 * BottomSheet stops drowning in `no-service` entries late at night
 * when most routes have stopped running.
 */
const LATE_NIGHT_THRESHOLD_MINUTES = 22 * 60;

/**
 * Return shape of {@link useGlobalFilter}.
 */
export interface UseGlobalFilterReturn {
  /** Pass-through of the `showOriginOnly` filter flag. */
  showOriginOnly: boolean;
  /** Pass-through of the `showBoardableOnly` filter flag. */
  showBoardableOnly: boolean;
  /** Final empty-stop omit policy after `isLateNight` and forced-on rules. */
  effectiveOmitEmptyStops: boolean;
  /** Bundled {@link GlobalFilter} for drilling into BottomSheet / TimetableModal. */
  globalFilter: GlobalFilter;
}

/**
 * Own the app-wide display filter state shared across surfaces.
 *
 * Bundles:
 *
 *   - Three user-toggleable inputs (`showOriginOnly`,
 *     `showBoardableOnly`, `omitEmptyStopsOverride`).
 *   - Derived empty-stop policy: `isLateNight` (from `dateTime` vs.
 *     {@link LATE_NIGHT_THRESHOLD_MINUTES}), forced-on rules
 *     (origin-only or boardable-only force empty-stop omit on), and
 *     the final `effectiveOmitEmptyStops`.
 *   - The memoized {@link GlobalFilter} bundle that `BottomSheet` and
 *     `TimetableModal` consume directly.
 *
 * The selector-level inputs (`showOriginOnly`, `showBoardableOnly`,
 * `effectiveOmitEmptyStops`) are exposed alongside the bundle because
 * `App` feeds them into `deriveFilteredNearbyStops` to produce the
 * filtered `stopTimes` that `MapView` consumes indirectly. The bundle
 * carries the user-facing toggle handlers; `App` does not call them.
 *
 * `omitEmptyStops` is `dateTime`-dependent through `isLateNight`, so
 * `dateTime` is taken as a parameter rather than read from
 * `useDateTime` inside the hook: the caller already owns `dateTime`
 * and threads it through everything else.
 *
 * @param dateTime - Current date / time used to compute the
 * late-night empty-stop policy.
 * @returns Filter inputs needed by the App-level selector plus the
 * memoized `globalFilter` bundle for prop drilling.
 */
export function useGlobalFilter(dateTime: Date): UseGlobalFilterReturn {
  const [showOriginOnly, setShowOriginOnly] = useState(false);
  const [showBoardableOnly, setShowBoardableOnly] = useState(false);
  const [omitEmptyStopsOverride, setOmitEmptyStopsOverride] = useState<boolean | null>(null);

  const isLateNight = getServiceDayMinutes(dateTime) >= LATE_NIGHT_THRESHOLD_MINUTES;
  const omitEmptyStops = omitEmptyStopsOverride ?? isLateNight;
  const isOmitEmptyStopsForced = showOriginOnly || showBoardableOnly;
  const effectiveOmitEmptyStops = omitEmptyStops || isOmitEmptyStopsForced;

  const toggleShowOriginOnly = useCallback(() => {
    setShowOriginOnly((prev) => !prev);
  }, []);
  const toggleShowBoardableOnly = useCallback(() => {
    setShowBoardableOnly((prev) => !prev);
  }, []);
  const toggleOmitEmptyStops = useCallback(() => {
    if (isOmitEmptyStopsForced) {
      return;
    }
    setOmitEmptyStopsOverride((prev) => !(prev ?? isLateNight));
  }, [isLateNight, isOmitEmptyStopsForced]);

  const globalFilter = useMemo<GlobalFilter>(
    () => ({
      showOriginOnly,
      showBoardableOnly,
      omitEmptyStops: effectiveOmitEmptyStops,
      isOmitEmptyStopsForced,
      onToggleShowOriginOnly: toggleShowOriginOnly,
      onToggleShowBoardableOnly: toggleShowBoardableOnly,
      onToggleOmitEmptyStops: toggleOmitEmptyStops,
    }),
    [
      showOriginOnly,
      showBoardableOnly,
      effectiveOmitEmptyStops,
      isOmitEmptyStopsForced,
      toggleShowOriginOnly,
      toggleShowBoardableOnly,
      toggleOmitEmptyStops,
    ],
  );

  return {
    showOriginOnly,
    showBoardableOnly,
    effectiveOmitEmptyStops,
    globalFilter,
  };
}
