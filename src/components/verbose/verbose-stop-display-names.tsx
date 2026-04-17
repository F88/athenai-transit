import type { ResolvedDisplayNames } from '../../domain/transit/get-display-names';

/**
 * Debug dump of resolved {@link ResolvedDisplayNames}.
 * Shows the output of `getStopDisplayNames` — the resolved display values
 * after i18n translation and infoLevel filtering.
 *
 * Follows the same pattern as {@link VerboseRouteDisplayNames}.
 */
export function VerboseStopDisplayNames({ names }: { names: ResolvedDisplayNames }) {
  return (
    <span className="border-app-neutral block overflow-x-auto rounded border border-dashed p-1 text-[9px] whitespace-nowrap text-[#999] dark:text-gray-500">
      <span className="block">[StopNames] name=&quot;{names.name}&quot;</span>
      <span className="block">
        sub={names.subNames.length > 0 ? `[${names.subNames.join(', ')}]` : '[]'}
      </span>
    </span>
  );
}
