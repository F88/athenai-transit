import type { Route } from '../../types/app/transit';

/**
 * Debug dump of headsign-related data.
 * Only rendered in verbose info level.
 */
export function VerboseHeadsign({
  headsign,
  route,
  label,
  maxLength,
}: {
  headsign: string;
  route: Route;
  label: string;
  maxLength?: number;
}) {
  const isTruncated = label !== headsign;

  return (
    <span className="block overflow-x-auto rounded border border-dashed border-gray-300 p-1 text-[9px] whitespace-nowrap text-[#999] dark:border-gray-600 dark:text-gray-500">
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
    </span>
  );
}
