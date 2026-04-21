import type { HeadsignDisplayNames } from '../../domain/transit/get-headsign-display-names';

/**
 * Debug dump of resolved {@link HeadsignDisplayNames}.
 * Shows the output of `getHeadsignDisplayNames` — the resolved display values
 * including headsign translations from GTFS translations.txt.
 */
export function VerboseHeadsignDisplayNames({ names }: { names: HeadsignDisplayNames }) {
  return (
    <span className="border-app-neutral block overflow-x-auto rounded border border-dashed p-1 text-[9px] whitespace-nowrap text-[#999] dark:text-gray-500">
      <span className="block">
        [HeadsignDisplayNames] resolved.name=&quot;{names.resolved.name}&quot;
      </span>
      <span className="block">
        resolved.sub=
        {names.resolved.subNames.length > 0 ? `[${names.resolved.subNames.join(', ')}]` : '[]'}
      </span>
      <span className="block">
        tripName=&quot;{names.tripName.name}&quot; sub=
        {names.tripName.subNames.length > 0 ? `[${names.tripName.subNames.join(', ')}]` : '[]'}
      </span>
      <span className="block">
        stopName=&quot;{names.stopName?.name ?? '(none)'}&quot;
        {names.stopName
          ? ` sub=${names.stopName.subNames.length > 0 ? `[${names.stopName.subNames.join(', ')}]` : '[]'}`
          : ''}
      </span>
    </span>
  );
}
