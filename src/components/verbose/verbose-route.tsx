import type { InfoLevel } from '../../types/app/settings';
import type { Route } from '../../types/app/transit';
import { formatRouteLabel } from '../../domain/transit/format-route-label';
import { getRouteDisplayNames } from '../../domain/transit/get-route-display-names';

/**
 * Debug dump of all Route fields and derived display values.
 * Only rendered in verbose info level.
 */
export function VerboseRoute({ route, infoLevel }: { route: Route; infoLevel: InfoLevel }) {
  const label = formatRouteLabel(getRouteDisplayNames(route, infoLevel), infoLevel);

  return (
    <span className="block overflow-x-auto rounded border border-dashed border-gray-300 p-1 text-[9px] whitespace-nowrap text-[#999] dark:border-gray-600 dark:text-gray-500">
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
  );
}
