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
    <span className="border-app-neutral block overflow-x-auto rounded border border-dashed p-1 text-[9px] whitespace-nowrap text-[#999] dark:text-gray-500">
      <span className="block">
        [AgencyDisplayNames] resolved=&quot;{names.resolved.name}&quot; source=
        {names.resolvedSource}
      </span>
      <span className="block">short=&quot;{names.shortName.name}&quot;</span>
      <span className="block">long=&quot;{names.longName.name}&quot;</span>
    </span>
  );
}
