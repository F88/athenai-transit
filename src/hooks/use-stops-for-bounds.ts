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
   * -- it follows every bounds-changed event immediately so that
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
 *    from an older request cannot overwrite a fresher result. The
 *    counter is bumped at the moment a new viewport arrives (or the
 *    repo / perfProfile changes), not when the debounced fetch is
 *    dispatched, so an in-flight response that lands before its
 *    successor's fetch is even issued is still classified as stale.
 * 4. `onStopsCommitted` callback that fires only after the latest
 *    fetch has been committed (used by the caller to clear focus)
 * 5. re-fetch against the last viewport when `repo` / `perfProfile`
 *    changes, so a perf-mode toggle (which changes `nearbyRadius` /
 *    `maxResults`) refreshes the visible stop set immediately instead
 *    of waiting for the next pan
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

  // Remember the most recent viewport so a repo / perfProfile change
  // can re-fetch against it without waiting for the next pan. Updated
  // on every `handleBoundsChanged`; consumed by the re-fetch effect
  // below.
  const lastViewportRef = useRef<{ bounds: Bounds; center: LatLng } | null>(null);

  // Hold the latest `onStopsCommitted` in a ref so `handleBoundsChanged`
  // does not need to list it as a dep. Without this, the callback
  // identity churn at the call site (typical for inline arrows or
  // un-memoized callbacks) would re-create `handleBoundsChanged` on
  // every parent render and force `MapView` re-renders.
  const onStopsCommittedRef = useRef(onStopsCommitted);
  useEffect(() => {
    onStopsCommittedRef.current = onStopsCommitted;
  }, [onStopsCommitted]);

  // Core fetch dispatch: bump the request id, (re)arm the debounce
  // timer, and commit the result only if it is still the latest. Shared
  // by `handleBoundsChanged` (viewport changes) and the re-fetch effect
  // below (repo / perfProfile changes), so both paths go through the
  // same latest-only guard. Reads `nearbyRadius` / `maxResults` from
  // the current `perfProfile` via deps, so a re-dispatch after a
  // perf-mode toggle uses the new values.
  const dispatchFetch = useCallback(
    (bounds: Bounds, center: LatLng) => {
      // Bump the request id at the moment a fetch is dispatched, not
      // when its debounced timer fires. Otherwise an old in-flight
      // response that lands between this call and its yet-to-be-issued
      // fetch would still see itself as `latest` and overwrite the
      // fresher state. The newly bumped id is the one this fetch owns.
      const requestId = ++latestRequestIdRef.current;
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
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
            // A newer viewport (or a repo / perfProfile change) has
            // invalidated this request. Drop the result so it cannot
            // overwrite the fresher state already committed -- or
            // about to be -- by the newer request.
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

  const handleBoundsChanged = useCallback(
    (bounds: Bounds, center: LatLng) => {
      // Update `mapCenter` synchronously so per-stop distance displays
      // and any other map-anchored UI follow the pan without waiting
      // for the debounced fetch. The fetch result is allowed to be
      // late; the visible map center is not.
      setMapCenter(center);
      // Record the viewport so the re-fetch effect can refresh against
      // it when the repo / perfProfile changes.
      lastViewportRef.current = { bounds, center };
      dispatchFetch(bounds, center);
    },
    [dispatchFetch],
  );

  // Re-fetch against the last known viewport when the data source or
  // perf profile changes. A perf-mode toggle changes `nearbyRadius` /
  // `maxResults`, so the visible stop set must refresh immediately
  // rather than waiting for the next pan -- otherwise the radius label
  // (derived synchronously from `perfProfile`) updates while the stop
  // list stays stale. `dispatchFetch` also bumps the request id, so any
  // in-flight fetch issued under the old repo / profile is invalidated
  // and cannot overwrite the fresh result.
  //
  // The effect keys on `dispatchFetch`, whose identity changes exactly
  // when `repo` / `perfProfile` / `debounceMs` change. On the very
  // first render there is no viewport yet (no pan has happened), so
  // there is nothing to re-fetch; the initial fetch is driven by the
  // caller's first `handleBoundsChanged`.
  useEffect(() => {
    const lastViewport = lastViewportRef.current;
    if (lastViewport === null) {
      return;
    }
    dispatchFetch(lastViewport.bounds, lastViewport.center);
  }, [dispatchFetch]);

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
