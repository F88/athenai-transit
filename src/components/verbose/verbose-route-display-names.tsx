import type { RouteDisplayNames } from '../../domain/transit/get-route-display-names';

/**
 * Debug dump of resolved {@link RouteDisplayNames}.
 * Shows the output of `getRouteDisplayNames` — the resolved display values
 * after i18n translation and prefer-strategy selection.
 *
 * Serves as a reference pattern for other `resolveXXX` verbose components.
 */
export function VerboseRouteDisplayNames({ names }: { names: RouteDisplayNames }) {
  return (
    <span className="block overflow-x-auto rounded border border-dashed border-gray-300 p-1 text-[9px] whitespace-nowrap text-[#999] dark:border-gray-600 dark:text-gray-500">
      <span className="block">[RouteDisplayNames] name=&quot;{names.name}&quot;</span>
      <span className="block">
        sub={names.subNames.length > 0 ? `[${names.subNames.join(', ')}]` : '[]'}
      </span>
      <span className="block">
        shortName=&quot;{names.shortName || '(empty)'}&quot; longName=&quot;
        {names.longName || '(empty)'}&quot;
      </span>
    </span>
  );
}
