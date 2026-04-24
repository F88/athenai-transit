import type { HeadsignDisplayNames } from '../../domain/transit/get-headsign-display-names';
import type { RouteDirection } from '../../types/app/transit-composed';
import { getEffectiveHeadsign } from '../../domain/transit/get-effective-headsign';
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
  defaultOpen = false,
}: {
  routeDirection: RouteDirection;
  names: HeadsignDisplayNames;
  label: string;
  maxLength?: number;
  /** Start with details expanded. @default false */
  defaultOpen?: boolean;
}) {
  const { route, tripHeadsign, stopHeadsign, direction } = routeDirection;
  const isTruncated = label !== names.resolved.name;

  return (
    <details open={defaultOpen} className="text-[9px] font-normal text-[#999] dark:text-gray-500">
      <summary className="cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
        [Headsign]
      </summary>
      <div className="mt-0.5">
        <span className="border-app-neutral block overflow-x-auto rounded border border-dashed p-1 whitespace-nowrap">
          <span className="block">
            [effective] &quot;{getEffectiveHeadsign(routeDirection)}&quot;
            {maxLength != null && ` maxLength=${maxLength}`}
            {isTruncated && ` truncated=true`}
          </span>
          <span className="block">[label] &quot;{label}&quot;</span>
          <span className="block">
            [tripHeadsign] &quot;{tripHeadsign.name}&quot; names=
            {Object.keys(tripHeadsign.names).length > 0
              ? Object.entries(tripHeadsign.names)
                  .map(([k, v]) => `${k}="${v}"`)
                  .join(' ')
              : '(none)'}
          </span>
          {stopHeadsign != null && (
            <span className="block">
              [stopHeadsign] &quot;{stopHeadsign.name}&quot; names=
              {Object.keys(stopHeadsign.names).length > 0
                ? Object.entries(stopHeadsign.names)
                    .map(([k, v]) => `${k}="${v}"`)
                    .join(' ')
                : '(none)'}
            </span>
          )}
          <span className="block">
            [route] id={route.route_id} color={route.route_color || '(none)'} text=
            {route.route_text_color || '(none)'}
          </span>
          <span className="block">[direction] {direction != null ? direction : '(none)'}</span>
        </span>
        <VerboseHeadsignDisplayNames names={names} />
      </div>
    </details>
  );
}
