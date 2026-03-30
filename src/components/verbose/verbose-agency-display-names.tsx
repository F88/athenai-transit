import type { AgencyDisplayNames } from '../../domain/transit/get-agency-display-name';

/**
 * Debug dump of resolved {@link AgencyDisplayNames}.
 * Shows the output of `getAgencyDisplayNames` — the resolved display value
 * after i18n translation and fallback logic.
 *
 * Follows the same pattern as {@link VerboseRouteDisplayNames}.
 */
export function VerboseAgencyDisplayNames({ names }: { names: AgencyDisplayNames }) {
  return (
    <span className="block overflow-x-auto rounded border border-dashed border-gray-300 p-1 text-[9px] whitespace-nowrap text-[#999] dark:border-gray-600 dark:text-gray-500">
      <span className="block">[AgencyDisplayNames] name=&quot;{names.name}&quot;</span>
    </span>
  );
}
