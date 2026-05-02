import type {
  SelectedTripSnapshot,
  TripInspectionTarget,
  TripSnapshot,
  TripStopTime,
} from '../../types/app/transit-composed';

export interface ResolvedTripInspectionTarget {
  target: TripInspectionTarget;
  index: number;
  matchType: 'exact' | 'fallback' | 'reference-time';
}

export interface ResolvedSelectedTripInspectionSnapshot {
  snapshot: SelectedTripSnapshot;
  selectedStopId?: string;
}

export type ResolveSelectedTripInspectionSnapshotResult =
  | {
      ok: true;
      data: ResolvedSelectedTripInspectionSnapshot;
    }
  | {
      ok: false;
      reason: 'pattern-position-missing' | 'stop-row-missing';
    };

export interface ResolvedTripInspectionDisplayState {
  snapshot: SelectedTripSnapshot;
  targets: TripInspectionTarget[];
  targetIndex: number;
}

export type ResolveTripInspectionDisplayStateResult =
  | {
      ok: true;
      data: ResolvedTripInspectionDisplayState;
    }
  | {
      ok: false;
      reason: 'target-not-found';
    };

/**
 * Returns whether two trip-inspection targets refer to the same stop event.
 *
 * This comparison intentionally ignores `departureMinutes`. The current
 * model treats `(tripLocator, serviceDate, stopIndex)` as the primary exact
 * identity, while departure time is used later as a distance/tie-break signal
 * when multiple nearby candidates must be resolved.
 *
 * @param left - First target to compare.
 * @param right - Second target to compare.
 * @returns `true` when both targets point at the same trip / service day /
 *          stop-index tuple.
 */
export function isSameTripInspectionTarget(
  left: TripInspectionTarget,
  right: TripInspectionTarget,
): boolean {
  return (
    left.tripLocator.patternId === right.tripLocator.patternId &&
    left.tripLocator.serviceId === right.tripLocator.serviceId &&
    left.tripLocator.tripIndex === right.tripLocator.tripIndex &&
    left.stopIndex === right.stopIndex &&
    left.serviceDate.getTime() === right.serviceDate.getTime()
  );
}

/**
 * Returns whether two targets belong to the same reconstructed trip instance.
 *
 * This is weaker than {@link isSameTripInspectionTarget}: it ignores the
 * selected stop position and therefore groups all stop events that belong to
 * the same concrete trip on the same service day.
 *
 * @param left - First target to compare.
 * @param right - Second target to compare.
 * @returns `true` when both targets share the same trip locator and service day.
 */
function isSameTripLocator(left: TripInspectionTarget, right: TripInspectionTarget): boolean {
  return (
    left.tripLocator.patternId === right.tripLocator.patternId &&
    left.tripLocator.serviceId === right.tripLocator.serviceId &&
    left.tripLocator.tripIndex === right.tripLocator.tripIndex &&
    left.serviceDate.getTime() === right.serviceDate.getTime()
  );
}

/**
 * Orders two candidates by how close they are to a reference target.
 *
 * The comparison is intentionally narrow: departure-time distance is the
 * primary signal, stop-index distance is the tie-break, and raw departure time
 * is the final deterministic tie-break. Callers should already have filtered
 * candidates to a compatible subset (for example the same trip locator) before
 * using this comparator.
 *
 * @param left - First candidate.
 * @param right - Second candidate.
 * @param reference - Reference target the candidates are being compared against.
 * @returns Negative when `left` is closer, positive when `right` is closer,
 *          or `0` when they are equivalent under this ordering.
 */
function compareCandidateDistance(
  left: TripInspectionTarget,
  right: TripInspectionTarget,
  reference: TripInspectionTarget,
): number {
  const leftDepartureDistance = Math.abs(left.departureMinutes - reference.departureMinutes);
  const rightDepartureDistance = Math.abs(right.departureMinutes - reference.departureMinutes);
  if (leftDepartureDistance !== rightDepartureDistance) {
    return leftDepartureDistance - rightDepartureDistance;
  }

  const leftStopIndexDistance = Math.abs(left.stopIndex - reference.stopIndex);
  const rightStopIndexDistance = Math.abs(right.stopIndex - reference.stopIndex);
  if (leftStopIndexDistance !== rightStopIndexDistance) {
    return leftStopIndexDistance - rightStopIndexDistance;
  }

  return left.departureMinutes - right.departureMinutes;
}

/**
 * Selects one trip-inspection target from an ordered candidate list using a
 * reference service-day time.
 *
 * The input is expected to preserve repository ordering (`departureMinutes`
 * ascending, then `stopIndex`, then route ordering). The selector returns the
 * first candidate whose departure is at or after the reference service-day
 * minutes. If no such candidate exists, it falls back to the final candidate
 * in the list.
 *
 * @param candidates - Ordered trip-inspection candidates to choose from.
 * @param serviceDayMinutes - Reference time expressed as service-day minutes.
 * @returns The selected candidate and its original index, or `null` when the
 *          input is empty.
 */
export function selectTripInspectionTargetByReferenceTime(
  candidates: TripInspectionTarget[],
  serviceDayMinutes: number,
): ResolvedTripInspectionTarget | null {
  if (candidates.length === 0) {
    return null;
  }

  const index = candidates.findIndex(
    (candidate) => candidate.departureMinutes >= serviceDayMinutes,
  );
  const resolvedIndex = index >= 0 ? index : candidates.length - 1;
  const resolvedTarget = candidates[resolvedIndex];
  if (!resolvedTarget) {
    return null;
  }

  return {
    target: resolvedTarget,
    index: resolvedIndex,
    matchType: 'reference-time',
  };
}

/**
 * Resolves one trip-inspection target from an ordered candidate list using an
 * existing target as the reference.
 *
 * The input is expected to preserve repository ordering (`departureMinutes`
 * ascending, then `stopIndex`, then route ordering). This helper does not sort
 * the full input itself; it only sorts the narrowed same-trip fallback subset.
 *
 * @param candidates - Ordered trip-inspection candidates to choose from.
 * @param target - Reference target that should be matched or approximated.
 * @returns The resolved candidate and its original index, or `null` when no
 *          candidate can be selected from the input.
 */
export function resolveTripInspectionTarget(
  candidates: TripInspectionTarget[],
  target: TripInspectionTarget,
): ResolvedTripInspectionTarget | null {
  if (candidates.length === 0) {
    return null;
  }

  const exactIndex = candidates.findIndex((candidate) =>
    isSameTripInspectionTarget(candidate, target),
  );
  if (exactIndex >= 0) {
    const exactTarget = candidates[exactIndex];
    if (!exactTarget) {
      return null;
    }

    return {
      target: exactTarget,
      index: exactIndex,
      matchType: 'exact',
    };
  }

  const sameTripCandidates = candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => isSameTripLocator(candidate, target))
    .sort((left, right) => compareCandidateDistance(left.candidate, right.candidate, target));

  const fallback = sameTripCandidates[0];
  if (!fallback) {
    return null;
  }

  return {
    target: fallback.candidate,
    index: fallback.index,
    matchType: 'fallback',
  };
}

/**
 * Resolves the most suitable stop row inside a reconstructed trip snapshot.
 *
 * The function prefers an exact `stopIndex` match. If that pattern-position is
 * missing from the sparse snapshot, it falls back to the stop row with the
 * smallest departure-time distance and then the smallest stop-index distance.
 *
 * @param stopTimes - Sparse stop rows reconstructed for one trip snapshot.
 * @param target - Target whose selected stop should be located.
 * @returns The array index of the best matching stop row, or `-1` when the
 *          snapshot contains no stop rows at all.
 */
export function resolveSnapshotStopIndex(
  stopTimes: TripStopTime[],
  target: TripInspectionTarget,
): number {
  const exactIndex = stopTimes.findIndex(
    (stop) => stop.timetableEntry.patternPosition.stopIndex === target.stopIndex,
  );
  if (exactIndex >= 0) {
    return exactIndex;
  }

  let bestArrayIndex = -1;
  let bestDepartureDistance = Number.POSITIVE_INFINITY;
  let bestStopIndexDistance = Number.POSITIVE_INFINITY;

  for (const [index, stop] of stopTimes.entries()) {
    const departureDistance = Math.abs(
      stop.timetableEntry.schedule.departureMinutes - target.departureMinutes,
    );
    const stopIndexDistance = Math.abs(
      stop.timetableEntry.patternPosition.stopIndex - target.stopIndex,
    );

    if (
      departureDistance < bestDepartureDistance ||
      (departureDistance === bestDepartureDistance && stopIndexDistance < bestStopIndexDistance)
    ) {
      bestArrayIndex = index;
      bestDepartureDistance = departureDistance;
      bestStopIndexDistance = stopIndexDistance;
    }
  }

  return bestArrayIndex;
}

/**
 * Rebuilds the selected stop row inside one reconstructed trip snapshot.
 *
 * This helper applies the same sparse-safe stop-index resolution used by trip
 * inspection, then returns a {@link SelectedTripSnapshot} enriched with the
 * resolved stop row and its `stop_id` when available.
 *
 * @param trip - Reconstructed trip snapshot returned by the repository.
 * @param target - Target whose selected stop should be located.
 * @returns The selected snapshot plus optional `stop_id`, or `null` when no
 *          suitable stop row can be resolved from the snapshot.
 */
export function resolveSelectedTripInspectionSnapshot(
  trip: TripSnapshot,
  target: TripInspectionTarget,
): ResolveSelectedTripInspectionSnapshotResult {
  const selectedStopIndex = resolveSnapshotStopIndex(trip.stopTimes, target);
  if (selectedStopIndex < 0) {
    return { ok: false, reason: 'pattern-position-missing' };
  }

  const selectedStop = trip.stopTimes[selectedStopIndex];
  if (!selectedStop) {
    return { ok: false, reason: 'stop-row-missing' };
  }

  return {
    ok: true,
    data: {
      snapshot: {
        ...trip,
        currentStopIndex: selectedStopIndex,
        selectedStop,
      },
      selectedStopId: selectedStop.stopMeta?.stop.stop_id,
    },
  };
}

/**
 * Resolves the final trip-inspection display state from one snapshot and a set
 * of stop-level trip-inspection candidates.
 *
 * The helper resolves the requested target against the candidate list and, when
 * needed, rebuilds the snapshot around the fallback target's stop row.
 *
 * @param snapshot - Initial selected snapshot reconstructed for the requested target.
 * @param candidates - Ordered trip-inspection candidates for the selected stop.
 * @param target - Requested target that should be matched or approximated.
 * @returns The final snapshot, candidate list, and selected index, or `null`
 *          when no candidate or fallback snapshot can be resolved.
 */
export function resolveTripInspectionDisplayState(
  snapshot: SelectedTripSnapshot,
  candidates: TripInspectionTarget[],
  target: TripInspectionTarget,
): ResolveTripInspectionDisplayStateResult {
  const resolvedTarget = resolveTripInspectionTarget(candidates, target);
  if (!resolvedTarget) {
    return { ok: false, reason: 'target-not-found' };
  }

  let resolvedSnapshot = snapshot;
  if (resolvedTarget.matchType === 'fallback') {
    const fallbackStopIndex = resolveSnapshotStopIndex(snapshot.stopTimes, resolvedTarget.target);
    const fallbackSelectedStop =
      fallbackStopIndex >= 0 ? snapshot.stopTimes[fallbackStopIndex] : undefined;
    if (!fallbackSelectedStop) {
      return { ok: false, reason: 'target-not-found' };
    }

    resolvedSnapshot = {
      ...snapshot,
      currentStopIndex: fallbackStopIndex,
      selectedStop: fallbackSelectedStop,
    };
  }

  return {
    ok: true,
    data: {
      snapshot: resolvedSnapshot,
      targets: candidates,
      targetIndex: resolvedTarget.index,
    },
  };
}
