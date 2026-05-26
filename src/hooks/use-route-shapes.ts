import { useEffect, useState } from 'react';

import type { TransitRepository } from '../repositories/transit-repository';
import type { RouteShape } from '../types/app/map';

/**
 * Load route shapes from the repository once per `repo` instance.
 *
 * Mount-once fetch effect: kicks off `repo.getRouteShapes()` when the
 * hook mounts (or `repo` changes) and stores the success payload in
 * local state. Failures are silently ignored, leaving the empty-array
 * fallback in place; `MapView` simply renders no shape layer until
 * shapes arrive. Wire visible failure reporting here (toast / retry)
 * if route-shape loading needs to surface errors.
 *
 * No request cancellation: if `repo` changes mid-flight the previous
 * fetch's success may still write to state. This mirrors the original
 * inline effect in `App` and matches today's behaviour. Switch to a
 * requestId / AbortSignal pattern (see `useStopsForBounds`) when this
 * race becomes user-visible.
 *
 * @param repo - Active transit repository.
 * @returns The loaded route shapes, or an empty array while pending /
 * on failure.
 */
export function useRouteShapes(repo: TransitRepository): RouteShape[] {
  const [routeShapes, setRouteShapes] = useState<RouteShape[]>([]);

  useEffect(() => {
    void repo.getRouteShapes().then((result) => {
      if (result.success) {
        setRouteShapes(result.data);
      }
    });
  }, [repo]);

  return routeShapes;
}
