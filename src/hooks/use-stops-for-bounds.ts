import { useCallback, useEffect, useRef, useState } from 'react';

import type { PerfProfile } from '../config/perf-profiles';
import { createLogger } from '../lib/logger';
import type { TransitRepository } from '../repositories/transit-repository';
import type { Bounds, LatLng } from '../types/app/map';
import type { StopWithMeta } from '../types/app/transit-composed';

const logger = createLogger('StopsForBounds');

const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Parameters for {@link useStopsForBounds}.
 */
export interface UseStopsForBoundsParams {
  /** Transit data repository. */
  repo: TransitRepository;
  /**
   * Active performance profile. Read for `nearbyRadius` / `maxResults`.
   * The profile may change at runtime (perf-mode toggle); each
   * `handleBoundsChanged` call reads the current profile via deps so
   * subsequent fetches use the latest values.
   */
  perfProfile: PerfProfile;
  /**
   * Fires after a fetch has won the latest-only race and its result
   * has been committed to state. Lets the caller drop state that
   * should be reset when the visible stop set changes (e.g. clearing
   * focus). Does not fire when a stale response is discarded.
   */
  onStopsCommitted?: () => void;
  /**
   * Debounce in ms for the stops fetch. `mapCenter` is NOT debounced
   * — it follows every bounds-changed event immediately so that
   * map-anchored UI (e.g. the bottom sheet's per-stop distances)
   * tracks the pan in real time.
   */
  debounceMs?: number;
}

/**
 * Return value of {@link useStopsForBounds}.
 */
export interface UseStopsForBoundsReturn {
  /** Stops contained within the current map viewport. */
  inBoundStops: StopWithMeta[];
  /** Stops within `nearbyRadius` of the current map center. */
  radiusStops: StopWithMeta[];
  /**
   * Latest map center, updated immediately on every bounds-changed
   * event (not debounced).
   */
  mapCenter: LatLng | null;
  /**
   * Becomes `true` after the first committed fetch. Distinguishes
   * "haven't fetched yet" from "fetched and got zero stops" so the UI
   * can hide a loading placeholder once a real result arrives.
   */
  hasNearbyLoaded: boolean;
  /**
   * Callback to feed into `MapView`'s `onBoundsChanged`. Pushes the
   * latest viewport into the hook; the hook handles debounce,
   * latest-only commit, and `onStopsCommitted` firing internally.
   */
  handleBoundsChanged: (bounds: Bounds, center: LatLng) => void;
}

/**
 * Owns viewport-driven stop fetching. Encapsulates four concerns that
 * previously lived inline in `app.tsx`:
 *
 * 1. debounce of the fetch to coalesce rapid pan events
 * 2. immediate update of `mapCenter` so it tracks the pan even while
 *    the fetch is being debounced
 * 3. latest-only commit via a request-id counter so a slow response
 *    from an older bounds cannot overwrite a fresher result
 * 4. `onStopsCommitted` callback that fires only after the latest
 *    fetch has been committed (used by the caller to clear focus)
 *
 * The latest-only guard is about state correctness, not cancellation:
 * the underlying repository call still completes its I/O / CPU work,
 * but its result is discarded if a newer request has been issued. If
 * actual cancellation is needed, the repository layer must be
 * extended to accept an `AbortController` (or equivalent).
 */
export function useStopsForBounds(params: UseStopsForBoundsParams): UseStopsForBoundsReturn {
  const { repo, perfProfile, onStopsCommitted, debounceMs = DEFAULT_DEBOUNCE_MS } = params;

  const [inBoundStops, setInBoundStops] = useState<StopWithMeta[]>([]);
  const [radiusStops, setRadiusStops] = useState<StopWithMeta[]>([]);
  const [mapCenter, setMapCenter] = useState<LatLng | null>(null);
  const [hasNearbyLoaded, setHasNearbyLoaded] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestRequestIdRef = useRef(0);

  // Hold the latest `onStopsCommitted` in a ref so `handleBoundsChanged`
  // does not need to list it as a dep. Without this, the callback
  // identity churn at the call site (typical for inline arrows or
  // un-memoized callbacks) would re-create `handleBoundsChanged` on
  // every parent render and force `MapView` re-renders.
  const onStopsCommittedRef = useRef(onStopsCommitted);
  useEffect(() => {
    onStopsCommittedRef.current = onStopsCommitted;
  }, [onStopsCommitted]);

  const handleBoundsChanged = useCallback(
    (bounds: Bounds, center: LatLng) => {
      // Update `mapCenter` synchronously so per-stop distance displays
      // and any other map-anchored UI follow the pan without waiting
      // for the debounced fetch. The fetch result is allowed to be
      // late; the visible map center is not.
      setMapCenter(center);
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        const requestId = ++latestRequestIdRef.current;
        const { nearbyRadius, maxResults } = perfProfile.data.stops;
        if (logger.isEnabled('debug')) {
          logger.debug(
            'bounds changed: fetching stops via repo',
            `radius=${nearbyRadius}`,
            `maxResults=${maxResults}`,
            `center=(${center.lat.toFixed(4)}, ${center.lng.toFixed(4)})`,
            `requestId=${requestId}`,
          );
        }
        void Promise.all([
          repo.getStopsInBounds(bounds, maxResults),
          repo.getStopsNearby(center, nearbyRadius, maxResults),
        ]).then(([inBoundsResult, nearbyResult]) => {
          if (requestId !== latestRequestIdRef.current) {
            // A newer request was issued before this one resolved.
            // Drop the result so it cannot overwrite the fresher state
            // already committed (or about to be) by the newer request.
            if (logger.isEnabled('debug')) {
              logger.debug(
                `stale response dropped (requestId=${requestId}, latest=${latestRequestIdRef.current})`,
              );
            }
            return;
          }
          const inBounds = inBoundsResult.success ? inBoundsResult.data : [];
          const nearby = nearbyResult.success ? nearbyResult.data : [];
          logger.info(
            'bounds changed:',
            `radius=${nearbyRadius}`,
            `nearby=${nearby.length}`,
            `inBound=${inBounds.length}`,
            `center=(${center.lat.toFixed(4)}, ${center.lng.toFixed(4)})`,
          );
          setInBoundStops(inBounds);
          setRadiusStops(nearby);
          setHasNearbyLoaded(true);
          onStopsCommittedRef.current?.();
        });
      }, debounceMs);
    },
    [repo, perfProfile, debounceMs],
  );

  // Cancel any pending debounce on unmount so the timeout cannot fire
  // a fetch after the consumer has gone away. The request-id guard
  // already protects against stale commits while mounted; this is the
  // matching cleanup for unmount.
  useEffect(() => {
    return () => {
      clearTimeout(debounceTimerRef.current);
    };
  }, []);

  return { inBoundStops, radiusStops, mapCenter, hasNearbyLoaded, handleBoundsChanged };
}
