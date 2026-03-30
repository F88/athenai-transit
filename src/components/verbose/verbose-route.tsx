import type { InfoLevel } from '../../types/app/settings';
import type { Route } from '../../types/app/transit';
import type { RouteDisplayNames } from '../../domain/transit/get-route-display-names';
import { formatRouteLabel } from '../../domain/transit/format-route-label';
import { VerboseRouteDisplayNames } from './verbose-route-display-names';

/**
 * Debug dump of all Route fields, resolved display names, and label.
 * Includes its own details/summary for collapsed display.
 * Only rendered in verbose info level.
 */
export function VerboseRoute({
  route,
  names,
  infoLevel,
}: {
  route: Route;
  names: RouteDisplayNames;
  infoLevel: InfoLevel;
}) {
  const label = formatRouteLabel(names, infoLevel);

  return (
    <details className="text-[9px] font-normal text-[#999] dark:text-gray-500">
      <summary className="cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
        [Route]
      </summary>
      <div className="mt-0.5 space-y-0.5">
        <span className="block overflow-x-auto rounded border border-dashed border-gray-300 p-1 whitespace-nowrap dark:border-gray-600">
          <span className="block">
            [route] id={route.route_id} type={route.route_type} agency={route.agency_id}
          </span>
          <span className="block">
            short=&quot;{route.route_short_name}&quot; long=&quot;{route.route_long_name}&quot;
          </span>
          <span className="block">
            color={route.route_color || '(none)'} text={route.route_text_color || '(none)'}
          </span>
          <span className="block">
            [names]{' '}
            {Object.keys(route.route_names).length > 0
              ? Object.entries(route.route_names)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(' ')
              : '(none)'}
          </span>
          <span className="block">[label] &quot;{label}&quot;</span>
        </span>
        <VerboseRouteDisplayNames names={names} />
      </div>
    </details>
  );
}
