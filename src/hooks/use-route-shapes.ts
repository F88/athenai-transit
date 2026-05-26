import { useEffect, useState } from 'react';

import type { TransitRepository } from '../repositories/transit-repository';
import type { RouteShape } from '../types/app/map';

/**
 * Load route shapes from the repository once per `repo` instance.
 *
 * Mount-once fetch effect: kicks off `repo.getRouteShapes()` when the
 * hook mounts (or `repo` changes) and stores the success payload in
 * local state.
 *
 * `TransitRepository.getRouteShapes()` is documented as "Always
 * succeeds", so under the contract `result.success` is always true.
 * The `if (result.success)` guard is therefore defensive: it is
 * required by the `Result<T>` discriminated union for type
 * narrowing, not because a `{ success: false }` outcome is expected.
 * A rejected Promise (e.g. the underlying data fetch fails) is
 * unhandled here and leaves the empty-array fallback in place;
 * `MapView` simply renders no shape layer until shapes arrive. Wire
 * visible failure reporting here (toast / retry) if route-shape
 * loading needs to surface errors.
 *
 * No request cancellation: if `repo` changes mid-flight the previous
 * fetch's success may still write to state. This mirrors the original
 * inline effect in `App` and matches today's behaviour. In this
 * codebase `repo` identity is stable for the React app lifetime --
 * the repository flows from `TransitRepositoryProvider` whose
 * `readyState.repository` only changes via `window.location.reload()`
 * after a data-source toggle (see
 * `components/dialog/data-source-settings-dialog.tsx`), so the
 * mid-flight race is currently hypothetical. Switch to a requestId
 * / AbortSignal pattern (see `useStopsForBounds`) if a future change
 * makes `repo` swap at runtime.
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
