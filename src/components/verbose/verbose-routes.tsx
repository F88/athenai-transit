import type { InfoLevel } from '../../types/app/settings';
import type { Agency, Route } from '../../types/app/transit';
import { resolveAgencyLang } from '../../config/transit-defaults';
import { getRouteDisplayNames } from '../../domain/transit/get-route-display-names';
import { VerboseRoute } from './verbose-route';

/**
 * Debug dump of multiple routes.
 * Includes its own details/summary for collapsed display.
 * Each route is rendered with defaultOpen via {@link VerboseRoute}.
 */
export function VerboseRoutes({
  routes,
  infoLevel,
  dataLang,
  agencies,
}: {
  routes: Route[];
  infoLevel: InfoLevel;
  dataLang: readonly string[];
  agencies: readonly Agency[];
}) {
  if (routes.length === 0) {
    return null;
  }

  return (
    <details className="text-[9px] font-normal text-[#999] dark:text-gray-500">
      <summary
        tabIndex={-1}
        className="cursor-pointer select-none"
        onClick={(e) => e.stopPropagation()}
      >
        [Routes ({routes.length})]
      </summary>
      <div className="mt-0.5 space-y-0.5">
        {routes.map((r) => (
          <VerboseRoute
            key={r.route_id}
            route={r}
            names={getRouteDisplayNames(r, dataLang, resolveAgencyLang(agencies, r.agency_id))}
            infoLevel={infoLevel}
            defaultOpen
          />
        ))}
      </div>
    </details>
  );
}
