import type { HeadsignDisplayNames } from '../../domain/transit/get-headsign-display-names';
import type { RouteDirection } from '../../types/app/transit-composed';
import { VerboseHeadsignDisplayNames } from './verbose-headsign-display-names';

/**
 * Debug dump of headsign-related data.
 * Includes its own details/summary for collapsed display.
 * Only rendered in verbose info level.
 */
export function VerboseHeadsign({
  routeDirection,
  names,
  label,
  maxLength,
}: {
  routeDirection: RouteDirection;
  names: HeadsignDisplayNames;
  label: string;
  maxLength?: number;
}) {
  const { route, headsign, headsign_names, direction } = routeDirection;
  const isTruncated = label !== names.name;

  return (
    <details className="text-[9px] font-normal text-[#999] dark:text-gray-500">
      <summary className="cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
        [Headsign]
      </summary>
      <div className="mt-0.5">
        <span className="block overflow-x-auto rounded border border-dashed border-gray-300 p-1 whitespace-nowrap dark:border-gray-600">
          <span className="block">
            [headsign] &quot;{headsign}&quot;
            {maxLength != null && ` maxLength=${maxLength}`}
            {isTruncated && ` truncated=true`}
          </span>
          <span className="block">[label] &quot;{label}&quot;</span>
          <span className="block">
            [route] id={route.route_id} color={route.route_color || '(none)'} text=
            {route.route_text_color || '(none)'}
          </span>
          <span className="block">[direction] {direction != null ? direction : '(none)'}</span>
          <span className="block">
            [headsign_names]{' '}
            {Object.keys(headsign_names).length > 0
              ? Object.entries(headsign_names)
                  .map(([k, v]) => `${k}="${v}"`)
                  .join(' ')
              : '(none)'}
          </span>
        </span>
        <VerboseHeadsignDisplayNames names={names} />
      </div>
    </details>
  );
}
