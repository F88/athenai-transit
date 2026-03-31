import type { InfoLevel } from '../../types/app/settings';
import type { Agency } from '../../types/app/transit';
import { getAgencyDisplayNames } from '../../domain/transit/get-agency-display-name';
import { VerboseAgency } from './verbose-agency';

/**
 * Debug dump of multiple agencies.
 * Includes its own details/summary for collapsed display.
 * Each agency is rendered with defaultOpen via {@link VerboseAgency}.
 */
export function VerboseAgencies({
  agencies,
  infoLevel,
}: {
  agencies: Agency[];
  infoLevel: InfoLevel;
}) {
  if (agencies.length === 0) {
    return null;
  }

  return (
    <details className="text-[9px] font-normal text-[#999] dark:text-gray-500">
      <summary className="cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
        [Agencies ({agencies.length})]
      </summary>
      <div className="mt-0.5 space-y-0.5">
        {agencies.map((a) => (
          <VerboseAgency
            key={a.agency_id}
            agency={a}
            names={getAgencyDisplayNames(a, infoLevel)}
            defaultOpen
          />
        ))}
      </div>
    </details>
  );
}
