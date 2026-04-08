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
      <span className="block">
        [RouteDisplayNames] resolved.name=&quot;{names.resolved.name}&quot; source=&quot;
        {names.resolvedSource}&quot;
      </span>
      <span className="block">
        resolved.sub=
        {names.resolved.subNames.length > 0 ? `[${names.resolved.subNames.join(', ')}]` : '[]'}
      </span>
      <span className="block">
        short.name=&quot;{names.shortName.name || '(empty)'}&quot; short.sub=
        {names.shortName.subNames.length > 0 ? `[${names.shortName.subNames.join(', ')}]` : '[]'}
      </span>
      <span className="block">
        long.name=&quot;{names.longName.name || '(empty)'}&quot; long.sub=
        {names.longName.subNames.length > 0 ? `[${names.longName.subNames.join(', ')}]` : '[]'}
      </span>
    </span>
  );
}
