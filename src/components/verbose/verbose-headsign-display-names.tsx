import type { HeadsignDisplayNames } from '../../domain/transit/get-headsign-display-names';

/**
 * Debug dump of resolved {@link HeadsignDisplayNames}.
 * Shows the output of `getHeadsignDisplayNames` — the resolved display values
 * including headsign translations from GTFS translations.txt.
 */
export function VerboseHeadsignDisplayNames({ names }: { names: HeadsignDisplayNames }) {
  return (
    <span className="block overflow-x-auto rounded border border-dashed border-gray-300 p-1 text-[9px] whitespace-nowrap text-[#999] dark:border-gray-600 dark:text-gray-500">
      <span className="block">[HeadsignDisplayNames] name=&quot;{names.name}&quot;</span>
      <span className="block">
        sub={names.subNames.length > 0 ? `[${names.subNames.join(', ')}]` : '[]'}
      </span>
    </span>
  );
}
