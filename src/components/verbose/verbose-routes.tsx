import type { InfoLevel } from '../../types/app/settings';
import type { Route } from '../../types/app/transit';
import { getRouteDisplayNames } from '../../domain/transit/get-route-display-names';
import { VerboseRoute } from './verbose-route';

/**
 * Debug dump of multiple routes.
 * Includes its own details/summary for collapsed display.
 * Each route is rendered with defaultOpen via {@link VerboseRoute}.
 */
export function VerboseRoutes({ routes, infoLevel }: { routes: Route[]; infoLevel: InfoLevel }) {
  if (routes.length === 0) {
    return null;
  }

  return (
    <details className="text-[9px] font-normal text-[#999] dark:text-gray-500">
      <summary className="cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
        [Routes ({routes.length})]
      </summary>
      <div className="mt-0.5 space-y-0.5">
        {routes.map((r) => (
          <VerboseRoute
            key={r.route_id}
            route={r}
            names={getRouteDisplayNames(r, infoLevel)}
            infoLevel={infoLevel}
            defaultOpen
          />
        ))}
      </div>
    </details>
  );
}
