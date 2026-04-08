import type { InfoLevel } from '../../types/app/settings';
import type { Agency } from '../../types/app/transit';
import { DEFAULT_AGENCY_LANG } from '../../config/transit-defaults';
import { getAgencyDisplayNames } from '../../domain/transit/get-agency-display-name';
import { VerboseAgency } from './verbose-agency';

/**
 * Debug dump of multiple agencies.
 * Includes its own details/summary for collapsed display.
 * Each agency is rendered with defaultOpen via {@link VerboseAgency}.
 */
export function VerboseAgencies({
  agencies,
  infoLevel: _infoLevel,
  dataLang,
}: {
  agencies: Agency[];
  infoLevel: InfoLevel;
  dataLang: readonly string[];
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
            names={getAgencyDisplayNames(
              a,
              dataLang,
              a.agency_lang ? [a.agency_lang] : DEFAULT_AGENCY_LANG,
            )}
            defaultOpen
          />
        ))}
      </div>
    </details>
  );
}
