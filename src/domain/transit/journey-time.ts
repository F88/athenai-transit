import type { TimetableEntry } from '@/types/app/transit-composed';

/**
 * Pure numeric calculations for journey-time visualization.
 *
 * Handles the "time math" layer — input sanitization, remaining/total
 * relationship enforcement, progress ratio, and integer rounding for
 * display labels. Visual concerns like bar width scaling
 * (`maxMinutes`) are left to the UI layer because they reflect
 * rendering judgment, not a property of the underlying duration data.
 *
 * The function returns a tagged union so callers can discriminate
 * "can render" vs "cannot render" at a single gate:
 *
 * ```ts
 * const result = computeJourneyTime({ remainingMinutes, totalMinutes });
 * if (!result.ok) {
 *   return null; // insufficient data — nothing meaningful to show
 * }
 * const { progressValue, displayTotalMinutes, ... } = result.value;
 * ```
 *
 * A missing or invalid `totalMinutes` is a hard failure because the
 * bar cannot even decide its width without it. A missing
 * `remainingMinutes` is soft: the function still succeeds but marks
 * the fill / remaining-label fields as "no data".
 */

/** Raw inputs taken straight from upstream data (typically pipeline insights). */
export interface JourneyTimeInput {
  /** Remaining minutes from the current stop to the terminal. */
  remainingMinutes: number | undefined;
  /** Total minutes of the full trip pattern. */
  totalMinutes: number | undefined;
}

/** Computed values needed to render a journey-time bar / label pair. */
export interface ComputedJourneyTime {
  /**
   * Sanitized total minutes (raw decimal). Always a positive finite
   * number in a successful result.
   */
  safeTotalMinutes: number;
  /**
   * Sanitized remaining minutes, clamped to `safeTotalMinutes`.
   * `undefined` when the remaining value is missing / invalid — the
   * bar cannot show a fill ratio in that case, but it can still be
   * drawn at 0% width-scaling against `safeTotalMinutes`.
   */
  safeRemainingMinutes: number | undefined;
  /**
   * Bar fill percentage (0-100). `0` when `safeRemainingMinutes` is
   * missing.
   */
  progressValue: number;
  /**
   * Integer-rounded total minutes for label display. Always present
   * in a successful result.
   */
  displayTotalMinutes: number;
  /**
   * Integer-rounded remaining minutes for label display. Derived
   * from the rounded total via the remaining ratio, so when
   * `progressValue` is `100` the label always reads `x / x` — never
   * `98 / 99` etc. `null` when `safeRemainingMinutes` is missing.
   */
  displayRemainingMinutes: number | null;
}

/**
 * Reason for a {@link JourneyTimeResult} failure.
 *
 * - `no-total`: `totalMinutes` is `null` / `undefined`.
 * - `invalid-total`: `totalMinutes` is present but cannot be used
 *   (`NaN`, `Infinity`, zero, or negative).
 *
 * Sub-minute but positive values (e.g. `0.2`) are NOT rejected —
 * they are clamped to a display floor of `1` minute so the label
 * never degenerates to `0 / 0`. See the `displayTotalMinutes`
 * calculation in {@link computeJourneyTime}.
 */
export type JourneyTimeFailureReason = 'no-total' | 'invalid-total';

/** Result of {@link computeJourneyTime}. */
export type JourneyTimeResult =
  | { ok: true; value: ComputedJourneyTime }
  | { ok: false; reason: JourneyTimeFailureReason };

/**
 * Compute journey-time values for display.
 *
 * Sanitizes input, enforces `remaining <= total`, produces the bar
 * fill ratio, and rounds display values consistently so the label
 * ratio matches the bar fill at the endpoints (0% and 100%).
 *
 * @param input - Raw remaining/total minutes (may be undefined / NaN / negative).
 * @returns Tagged union — `{ ok: true, value }` when computable, or
 *          `{ ok: false, reason }` when the total is missing / invalid.
 */
export function computeJourneyTime(input: JourneyTimeInput): JourneyTimeResult {
  const { remainingMinutes, totalMinutes } = input;

  if (totalMinutes == null) {
    return { ok: false, reason: 'no-total' };
  }
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return { ok: false, reason: 'invalid-total' };
  }
  const safeTotalMinutes = totalMinutes;

  // Sanitize remaining: reject null / undefined / NaN / Infinity / negative.
  const sanitizedRemaining =
    remainingMinutes != null && Number.isFinite(remainingMinutes) && remainingMinutes >= 0
      ? remainingMinutes
      : undefined;

  // Enforce `remaining <= total` so downstream rendering sees a
  // self-consistent pair even when upstream data has anomalies.
  const safeRemainingMinutes =
    sanitizedRemaining !== undefined ? Math.min(sanitizedRemaining, safeTotalMinutes) : undefined;

  // Progress fill percentage. Clamp to `[0, 100]` so numeric edge
  // cases cannot push the indicator past the track edges.
  const progressValue =
    safeRemainingMinutes !== undefined
      ? Math.min(100, Math.max(0, (safeRemainingMinutes / safeTotalMinutes) * 100))
      : 0;

  // Rounded display values. The pipeline rounds `rd[i]` to 1 decimal
  // place, so fractional inputs like `98.5` do occur. Round the total
  // first, then derive the remaining value from the rounded total so
  // the label ratio stays consistent with the bar fill — specifically,
  // at 100% fill (`safeRemaining === safeTotal`) the label always
  // reads `x / x`.
  //
  // Clamp the display total to a minimum of `1` so sub-minute values
  // like `0.2` (which round to `0`) still produce a meaningful label
  // instead of `0 / 0`. Real pipeline data is not expected to go
  // below ~1 min, but a positive total is by definition "something",
  // not "nothing" — displaying it as 1 min is more graceful than
  // rejecting or zero-labelling it.
  const displayTotalMinutes = Math.max(1, Math.round(safeTotalMinutes));
  const displayRemainingMinutes =
    safeRemainingMinutes !== undefined
      ? Math.round((safeRemainingMinutes / safeTotalMinutes) * displayTotalMinutes)
      : null;

  return {
    ok: true,
    value: {
      safeTotalMinutes,
      safeRemainingMinutes,
      progressValue,
      displayTotalMinutes,
      displayRemainingMinutes,
    },
  };
}

/**
 * Derive raw {@link JourneyTimeInput} values from a trip's
 * reconstructed timetable entries and the focused stop's pattern
 * stop index.
 *
 * The helper takes the pipeline-reconstructed `entries` as-is, sorts
 * a copy by `patternPosition.stopIndex`, and resolves origin /
 * terminal / target with placeholder-tolerant fallbacks:
 *
 * - **origin**:   `sorted[0]` (smallest stopIndex present).
 * - **terminal**: `sorted[sorted.length - 1]` (largest stopIndex present).
 * - **target**:   the entry whose stopIndex is the largest one
 *   `<= targetStopIndex`; if none qualifies (target is below all
 *   present stops), fall back forward to the smallest stopIndex
 *   `> targetStopIndex`.
 *
 * Computation:
 * - `totalMinutes`     = resolved-terminal `arrivalMinutes` minus
 *   resolved-origin `departureMinutes`.
 * - `remainingMinutes` = resolved-terminal `arrivalMinutes` minus
 *   resolved-target `departureMinutes`.
 *
 * All loops are bounded by `entries.length`, so the helper is safe
 * against bizarre `targetStopIndex` or `patternPosition.totalStops`
 * values (NaN / Infinity / negative) without dedicated guards. Such
 * inputs simply cause the search predicates to fail and the helper
 * returns `(undefined, undefined)`.
 *
 * Returns `(undefined, undefined)` when `entries` is empty, or when
 * the searches cannot resolve a target (e.g. `targetStopIndex` is
 * `NaN`). Otherwise the helper always returns numeric values; some
 * may be off (e.g. underestimated total when the terminal is a
 * placeholder, or negative when source data is non-monotonic) but a
 * result is always produced.
 *
 * The result is raw arithmetic — the helper deliberately does not
 * sanitise, clamp, or reject negative values. Validation belongs to
 * {@link computeJourneyTime}, which this result feeds into.
 */
export function deriveJourneyTimeFromTrip(
  entries: readonly TimetableEntry[],
  targetStopIndex: number,
): JourneyTimeInput {
  if (entries.length === 0) {
    return { totalMinutes: undefined, remainingMinutes: undefined };
  }

  // Sort a copy by stopIndex. All subsequent processing iterates this
  // bounded array, so loop counts stay tied to entries.length and
  // can never depend on potentially-bogus pattern numbers.
  const sorted = [...entries].sort(
    (a, b) => a.patternPosition.stopIndex - b.patternPosition.stopIndex,
  );

  const origin = sorted[0];
  const terminal = sorted[sorted.length - 1];

  // target: the largest present stopIndex <= targetStopIndex.
  let target: TimetableEntry | undefined;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].patternPosition.stopIndex <= targetStopIndex) {
      target = sorted[i];
      break;
    }
  }
  // If the backward search found nothing (targetStopIndex is below
  // the smallest present stopIndex, or NaN against a number), fall
  // back to the smallest stopIndex > targetStopIndex.
  if (target === undefined) {
    for (const entry of sorted) {
      if (entry.patternPosition.stopIndex > targetStopIndex) {
        target = entry;
        break;
      }
    }
  }

  if (target === undefined) {
    return { totalMinutes: undefined, remainingMinutes: undefined };
  }

  return {
    totalMinutes: terminal.schedule.arrivalMinutes - origin.schedule.departureMinutes,
    remainingMinutes: terminal.schedule.arrivalMinutes - target.schedule.departureMinutes,
  };
}
