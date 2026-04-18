import type { InfoLevel } from '../../types/app/settings';
import type { Route } from '../../types/app/transit';
import type { RouteDisplayNames } from '../../domain/transit/get-route-display-names';
import { formatRouteLabel } from '../../domain/transit/format-route-label';
import { resolveGtfsColor } from '../../domain/transit/color-resolver/resolve-colors';
import { VerboseRouteDisplayNames } from './verbose-route-display-names';
import { VerboseRouteColors } from './verbose-route-colors';

/**
 * Debug dump of all Route fields, resolved display names, and label.
 * Includes its own details/summary for collapsed display.
 * Only rendered in verbose info level.
 */
export function VerboseRoute({
  route,
  names,
  infoLevel,
  defaultOpen = false,
}: {
  route: Route;
  names: RouteDisplayNames;
  infoLevel: InfoLevel;
  /** Start with details expanded. @default false */
  defaultOpen?: boolean;
}) {
  const label = formatRouteLabel(names, infoLevel);
  const cssRouteColor = resolveGtfsColor(route.route_color, 'css-hex');
  const cssRouteTextColor = resolveGtfsColor(route.route_text_color, 'css-hex');
  const summaryName =
    names.resolved.name || route.route_long_name || route.route_short_name || route.route_id;

  return (
    <details open={defaultOpen} className="text-[9px] font-normal text-[#999] dark:text-gray-500">
      <summary className="cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
        [Route {summaryName}]
      </summary>
      <div className="mt-0.5 space-y-0.5">
        <span className="border-app-neutral block overflow-x-auto rounded border border-dashed p-1 whitespace-nowrap">
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
            cssColor={cssRouteColor} cssText={cssRouteTextColor}
          </span>
          <span className="block">
            [shortNames]{' '}
            {Object.keys(route.route_short_names).length > 0
              ? Object.entries(route.route_short_names)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(' ')
              : '(none)'}
          </span>
          <span className="block">
            [longNames]{' '}
            {Object.keys(route.route_long_names).length > 0
              ? Object.entries(route.route_long_names)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(' ')
              : '(none)'}
          </span>
          <span className="block">
            [label] &quot;{label}&quot; source={names.resolvedSource}
          </span>
        </span>
        <VerboseRouteDisplayNames names={names} />
        <VerboseRouteColors route={route} />
      </div>
    </details>
  );
}
