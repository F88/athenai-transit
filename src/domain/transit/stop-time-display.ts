/**
 * Pure display-rule helpers for stop-time rendering.
 *
 * UI components delegate boolean "should we render row X?" decisions
 * here so they can be reasoned about and unit-tested without touching
 * React. New rules (e.g. relative-time visibility, verbose-badge
 * gates) belong in this module too as they are extracted.
 */

import type { InfoLevel } from '@/types/app/settings';

/** Inputs for {@link shouldCollapseArrival}. */
export interface ShouldCollapseArrivalInput {
  /** Arrival minutes from midnight of the service day. */
  arrivalMinutes: number;
  /** Departure minutes from midnight of the service day. */
  departureMinutes: number;
  /**
   * Caller policy combined with tolerance.
   *
   * - `null`: never collapse.
   * - `0`: collapse only when arrival and departure are at the
   *   exact same minute.
   * - `n` (positive integer): collapse when
   *   `|departure - arrival| <= n` minutes — useful when callers
   *   want to treat tiny dwell times (e.g. 1-minute layovers) as
   *   visually identical to instant transfers.
   */
  collapseToleranceMinutes: number | null;
  /** Whether the arrival row would otherwise render. */
  showArrivalTime: boolean;
  /** Whether the departure row would otherwise render. */
  showDepartureTime: boolean;
}

/**
 * Decide whether the arrival row should be hidden because it would
 * render redundantly next to the departure row.
 */
export function shouldCollapseArrival({
  arrivalMinutes,
  departureMinutes,
  collapseToleranceMinutes,
  showArrivalTime,
  showDepartureTime,
}: ShouldCollapseArrivalInput): boolean {
  if (collapseToleranceMinutes === null) {
    return false;
  }
  return (
    showArrivalTime &&
    showDepartureTime &&
    Math.abs(departureMinutes - arrivalMinutes) <= collapseToleranceMinutes
  );
}

/** Inputs for {@link deriveStopTimeRoleDisplayProps}. */
export interface DeriveStopTimeDisplayInput {
  /** Whether this stop is the trip's origin (= first stop). */
  isOrigin: boolean;
  /** Whether this stop is the trip's terminal (= last stop). */
  isTerminal: boolean;
  /** Current info verbosity level. */
  infoLevel: InfoLevel;
}

/**
 * Subset of `StopTimeTimeInfoProps` whose values depend on the
 * stop's role (origin / middle / terminal) and the current info
 * level. Other props (`serviceDate`, `arrivalMinutes`, `now`,
 * `size`, `align`, `textAppearance`, `showVerbose`, `inspectTarget`,
 * etc.) remain the caller's concern.
 */
export interface StopTimeRoleDisplayProps {
  /** Whether to render the arrival absolute-time row. */
  showArrivalTime: boolean;
  /** Whether to render the departure absolute-time row. */
  showDepartureTime: boolean;
  /** Tolerance for collapsing arrival when same as departure. */
  collapseToleranceMinutes: number | null;
}

/**
 * Derive role / info-level dependent display props for
 * `StopTimeTimeInfo`: which time rows to show and how aggressively
 * to collapse same-minute dwell into a single row.
 */
export function deriveStopTimeRoleDisplayProps({
  isOrigin,
  isTerminal,
  infoLevel,
}: DeriveStopTimeDisplayInput): StopTimeRoleDisplayProps {
  const isVerbose = infoLevel === 'verbose';

  return {
    showArrivalTime: isVerbose || !isOrigin || isTerminal,
    showDepartureTime: isVerbose || !isTerminal || isOrigin,

    // Tolerance for hiding the arrival row when its time is "close
    // enough" to departure that the second row adds no information.
    // Bundled GTFS / ODPT data shows three populations at middle
    // stops: d=1 dwell (~94% of all dwell — rail boarding-wait
    // convention `HH:MM` → `HH:MM+1`), d=2 (~3% — small hub dwell),
    // and d>=3 (~3% — meaningful waits like express-overtaking,
    // turnaround, boarding announcements). Collapsing through d=2
    // folds the rail / small-hub noise while preserving the >=3
    // dwell as two rows where the dwell carries information. Verbose
    // mode disables collapse entirely so every recorded dwell
    // surfaces.
    collapseToleranceMinutes: isVerbose ? null : 2,
  };
}
