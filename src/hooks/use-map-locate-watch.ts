import { useEffect } from 'react';
import { toUserLocation } from '../lib/map-locate';
import { createLogger } from '../lib/logger';
import type { UserLocation } from '../types/app/map';

const logger = createLogger('MapLocateWatch');

interface UseMapLocateWatchOptions {
  /** Whether the watch is currently active. Toggling to `false` clears the watch. */
  enabled: boolean;
  /** Callback invoked on every successful position update (initial + watch). */
  onLocated: (location: UserLocation) => void;
  /** Callback invoked when the Geolocation API reports an error. */
  onError?: (error: GeolocationPositionError) => void;
}

const formatLoc = (loc: UserLocation): string =>
  `lat=${loc.lat.toFixed(5)}, lng=${loc.lng.toFixed(5)}, accuracy=${loc.accuracy.toFixed(0)}m`;

/**
 * Continuously tracks the user's location via `navigator.geolocation.watchPosition`
 * while {@link UseMapLocateWatchOptions.enabled} is true.
 *
 * Behavior:
 * - On enable, fires one immediate `getCurrentPosition` so the marker
 *   appears without waiting for the next position change.
 * - Then registers a watch that fires `onLocated` whenever the device
 *   reports a new position.
 * - Uses `enableHighAccuracy: true` so the tracking marker stays close
 *   to the user's actual position. WiFi/cell positioning regularly
 *   misses by 30–100 m in dense urban areas, which makes the marker
 *   look like it's hopping between adjacent streets — unacceptable
 *   for a "follow me as I walk" UX. The trade-off is higher battery
 *   draw; the user opts in by enabling tracking and can disable it
 *   any time via the same locate button.
 * - Clears the watch on cleanup (toggle off, unmount, dependency change).
 *
 * Debug logging distinguishes between the one-shot initial call and
 * the subsequent watch updates, and reports the elapsed time since
 * tracking was enabled. Use the `[MapLocateWatch]` log channel to
 * analyze position cadence and accuracy in the field.
 */
export function useMapLocateWatch({ enabled, onLocated, onError }: UseMapLocateWatchOptions): void {
  useEffect(() => {
    if (!enabled || !navigator.geolocation) {
      return;
    }

    // The browser Geolocation API has `clearWatch` for `watchPosition`
    // but no equivalent for `getCurrentPosition` — once dispatched, its
    // success/error callback will fire whenever the device responds,
    // even after this effect has been torn down. Without a guard a fix
    // arriving after the user disables tracking would still update
    // `userLocation`, replay the locate button's pulse, and (on a
    // PERMISSION_DENIED race) flash a toast for an already-disabled
    // mode. The `cancelled` flag closes over every callback so any
    // post-cleanup invocation becomes a no-op.
    let cancelled = false;
    // Per-session error gate. `getCurrentPosition` (one-shot) and
    // `watchPosition` are dispatched simultaneously, so a permission
    // denial typically reaches both error callbacks while neither has
    // been cancelled yet — without this flag the consumer would
    // observe two `onError` calls (and, in MapView, two toasts) for a
    // single PERMISSION_DENIED. Reset implicitly per effect run since
    // the closure is recreated.
    let errorReported = false;
    const enableTime = Date.now();
    let watchUpdates = 0;
    logger.debug('auto-tracking: enabled');

    const handleInitialSuccess: PositionCallback = (pos) => {
      if (cancelled) {
        return;
      }
      const loc = toUserLocation(pos);
      logger.debug(
        `auto-tracking: initial position (elapsed=${Date.now() - enableTime}ms, ${formatLoc(loc)})`,
      );
      onLocated(loc);
    };
    const handleWatchSuccess: PositionCallback = (pos) => {
      if (cancelled) {
        return;
      }
      watchUpdates += 1;
      const loc = toUserLocation(pos);
      logger.debug(
        `auto-tracking: watch update #${String(watchUpdates)} (since-enable=${Date.now() - enableTime}ms, ${formatLoc(loc)})`,
      );
      onLocated(loc);
    };
    const handleErr =
      (kind: 'initial' | 'watch') =>
      (error: GeolocationPositionError): void => {
        if (cancelled) {
          return;
        }
        logger.debug(
          `auto-tracking: ${kind} failed (since-enable=${Date.now() - enableTime}ms, code=${String(error.code)}, message=${error.message})`,
        );
        if (errorReported) {
          // The other request already surfaced an error this session.
          return;
        }
        errorReported = true;
        onError?.(error);
      };

    navigator.geolocation.getCurrentPosition(handleInitialSuccess, handleErr('initial'), {
      enableHighAccuracy: true,
      timeout: 10_000,
    });

    const watchId = navigator.geolocation.watchPosition(handleWatchSuccess, handleErr('watch'), {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 5_000,
    });

    return () => {
      cancelled = true;
      logger.debug(
        `auto-tracking: disabled (duration=${Date.now() - enableTime}ms, watch updates=${String(watchUpdates)})`,
      );
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled, onLocated, onError]);
}
