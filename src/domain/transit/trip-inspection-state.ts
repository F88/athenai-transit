/**
 * @module trip-inspection-state
 *
 * Pure helpers that derive trip-inspection display state from canonical
 * timetable data. Paired with `./trip-inspection-target` (which contains
 * pure helpers that operate on `TripInspectionTarget`); the helpers here
 * compose those into the higher-level state (`RefinedTripInspectionState`
 * / `LoadedTripInspectionSnapshot`) consumed by `useTripInspection`.
 *
 * The functions in this module are not React-aware: they receive their
 * inputs as plain values and return plain results. Side effects are
 * limited to warning-level logger calls on failure branches, matching the
 * pattern already used by `./timetable-stats`.
 */

import { createLogger } from '../../lib/logger';
import type { TripInspectionTargetsEmptyReason } from '../../types/app/repository';
import type {
  SelectedTripSnapshot,
  TimetableEntry,
  TripInspectionTarget,
  TripSnapshot,
} from '../../types/app/transit-composed';
import { sortTimetableEntriesByDisplayTime } from './sort-timetable-for-ui';
import {
  resolveSelectedTripInspectionSnapshot,
  resolveTripInspectionDisplayState,
} from './trip-inspection-target';

const logger = createLogger('TripInspectionState');

/**
 * Anchor a service-day Date to noon so it survives `getServiceDay`'s
 * 03:00 boundary check. `target.serviceDate` is midnight-anchored by
 * convention, and `repo.getFullDayTimetableEntries(stopId, dateTime)`
 * normalises its argument via `getServiceDay(dateTime)` which would
 * otherwise treat midnight as the **previous** service day (hours < 3).
 *
 * The returned Date is always a fresh instance — the input is never
 * mutated.
 */
export function serviceDayReferenceDateTime(serviceDate: Date): Date {
  const result = new Date(serviceDate);
  result.setHours(12, 0, 0, 0);
  return result;
}

/** Snapshot + selected stop_id for a successfully loaded trip inspection. */
export interface LoadedTripInspectionSnapshot {
  snapshot: SelectedTripSnapshot;
  selectedStopId: string;
}

/** Result of {@link loadTripInspectionSnapshot}. */
export type LoadedTripInspectionSnapshotResult =
  | { ok: true; data: LoadedTripInspectionSnapshot }
  | { ok: false; reason: 'no-data' };

/** State derived for trip-inspection prev/next navigation. */
export interface RefinedTripInspectionState {
  snapshot: SelectedTripSnapshot;
  targets: TripInspectionTarget[];
  targetIndex: number;
}

/** Result of {@link refineTripInspectionState}. */
export type RefinedTripInspectionStateResult =
  | { ok: true; data: RefinedTripInspectionState }
  | { ok: false; reason: 'no-data' };

/**
 * Map a {@link TripInspectionTargetsEmptyReason} to a human-readable note
 * used in warning logs.
 */
export function getEmptyTripInspectionTargetsNote(
  emptyReason: TripInspectionTargetsEmptyReason,
): string {
  if (emptyReason === 'no-stop-data') {
    return 'The stop has no trip-inspection stop data.';
  }

  return 'The stop has trip-inspection data, but no services on the selected service day.';
}

/**
 * Build a diagnostic payload describing why a requested target did not
 * match against the candidate list. Used by callers that want to log
 * detailed mismatch context at `debug` level.
 *
 * Pure: the function does not log; callers gate logging behind their
 * level filter and pass the returned object to `logger.debug(...)`.
 */
export function buildTripInspectionMatchDiagnostics(
  target: TripInspectionTarget,
  candidates: TripInspectionTarget[],
) {
  const summarizeTarget = (candidate: TripInspectionTarget) => ({
    patternId: candidate.tripLocator.patternId,
    serviceId: candidate.tripLocator.serviceId,
    tripIndex: candidate.tripLocator.tripIndex,
    stopIndex: candidate.stopIndex,
    departureMinutes: candidate.departureMinutes,
    serviceDate: candidate.serviceDate.toISOString(),
  });

  const sameService = candidates.filter(
    (candidate) =>
      candidate.tripLocator.patternId === target.tripLocator.patternId &&
      candidate.tripLocator.serviceId === target.tripLocator.serviceId,
  );
  const sameTripIndex = sameService.filter(
    (candidate) => candidate.tripLocator.tripIndex === target.tripLocator.tripIndex,
  );
  const sameStopIndex = sameTripIndex.filter(
    (candidate) => candidate.stopIndex === target.stopIndex,
  );

  return {
    patternId: target.tripLocator.patternId,
    serviceId: target.tripLocator.serviceId,
    tripIndex: target.tripLocator.tripIndex,
    stopIndex: target.stopIndex,
    departureMinutes: target.departureMinutes,
    serviceDate: target.serviceDate.toISOString(),
    sampleSameService: sameService.slice(0, 5).map(summarizeTarget),
    sampleSameTripIndex: sameTripIndex.slice(0, 5).map(summarizeTarget),
    sampleSameStopIndex: sameStopIndex.slice(0, 5).map(summarizeTarget),
  };
}

/**
 * Resolve the trip-inspection snapshot for a reconstructed trip and a
 * requested target. Wraps {@link resolveSelectedTripInspectionSnapshot}
 * and emits warning logs on each failure branch so the caller only has
 * to handle the boolean outcome.
 */
export function loadTripInspectionSnapshot(
  trip: TripSnapshot,
  target: TripInspectionTarget,
): LoadedTripInspectionSnapshotResult {
  const resolvedSnapshot = resolveSelectedTripInspectionSnapshot(trip, target);
  if (!resolvedSnapshot.ok) {
    switch (resolvedSnapshot.reason) {
      case 'pattern-position-missing':
        logger.warn(
          `loadTripInspectionSnapshot: selected stop index ${target.stopIndex} is missing from reconstructed trip snapshot`,
        );
        break;
      case 'stop-row-missing':
        logger.warn(
          'loadTripInspectionSnapshot: selected stop row is missing from reconstructed trip snapshot',
          {
            target,
          },
        );
        break;
      default: {
        const exhaustiveReason: never = resolvedSnapshot.reason;
        logger.warn('loadTripInspectionSnapshot: unexpected snapshot resolution failure', {
          target,
          reason: exhaustiveReason,
        });
      }
    }

    return { ok: false, reason: 'no-data' };
  }

  if (resolvedSnapshot.data.selectedStopId === undefined) {
    logger.warn(
      'loadTripInspectionSnapshot: selected stop metadata missing; skip trip-inspection target lookup',
    );
    return { ok: false, reason: 'no-data' };
  }

  return {
    ok: true,
    data: {
      snapshot: resolvedSnapshot.data.snapshot,
      selectedStopId: resolvedSnapshot.data.selectedStopId,
    },
  };
}

/**
 * Build the trip-inspection candidate list from a stop's full-day
 * timetable entries.
 *
 * The entries are sorted with {@link sortTimetableEntriesByDisplayTime}
 * (display-minute order) and then mapped to {@link TripInspectionTarget},
 * so the resulting navigation list reads chronologically in the UI
 * (Issue #63). The input array is never mutated -- the helper sorts a
 * defensive copy.
 *
 * The candidate list is exposed as its own value (rather than hidden
 * inside {@link refineTripInspectionState}) so callers can pass the same
 * list both to the resolver and to
 * {@link buildTripInspectionMatchDiagnostics} on failure.
 */
export function deriveTripInspectionCandidates(
  entries: TimetableEntry[],
  serviceDate: Date,
): TripInspectionTarget[] {
  const sorted = sortTimetableEntriesByDisplayTime([...entries]);
  return sorted.map((entry) => ({
    tripLocator: entry.tripLocator,
    stopIndex: entry.patternPosition.stopIndex,
    departureMinutes: entry.schedule.departureMinutes,
    serviceDate,
  }));
}

/**
 * Resolve the trip-inspection navigation state for a requested target
 * against an already-derived candidate list. Pure: takes the candidate
 * list and pure context as input and returns the refined state without
 * any I/O.
 *
 * The requested target is located within `candidates` via
 * {@link resolveTripInspectionDisplayState}; if it cannot be resolved
 * (and the helper has no fallback either) the function returns
 * `{ ok: false, reason: 'no-data' }`. The same outcome is also produced
 * for an empty `candidates` array.
 *
 * Failure-path logging is intentionally NOT performed here so the function
 * stays trivially testable. Callers that want diagnostics on failure can
 * invoke {@link buildTripInspectionMatchDiagnostics} with the same
 * `candidates` list they passed in.
 */
export function refineTripInspectionState(
  candidates: TripInspectionTarget[],
  snapshot: SelectedTripSnapshot,
  target: TripInspectionTarget,
): RefinedTripInspectionStateResult {
  if (candidates.length === 0) {
    return { ok: false, reason: 'no-data' };
  }

  const resolvedState = resolveTripInspectionDisplayState(snapshot, candidates, target);
  if (!resolvedState.ok) {
    return { ok: false, reason: 'no-data' };
  }

  return {
    ok: true,
    data: {
      snapshot: resolvedState.data.snapshot,
      targets: resolvedState.data.targets,
      targetIndex: resolvedState.data.targetIndex,
    },
  };
}
