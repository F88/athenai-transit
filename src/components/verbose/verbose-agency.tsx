import type { AgencyDisplayNames } from '../../domain/transit/get-agency-display-name';
import type { Agency } from '../../types/app/transit';
import { VerboseAgencyDisplayNames } from './verbose-agency-display-names';

/**
 * Debug dump of all Agency fields and resolved display names.
 * Includes its own details/summary for collapsed display.
 * Only rendered in verbose info level.
 */
export function VerboseAgency({
  agency,
  names,
  defaultOpen = false,
}: {
  agency: Agency;
  names: AgencyDisplayNames;
  /** Start with details expanded. @default false */
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="text-[9px] font-normal text-[#999] dark:text-gray-500">
      <summary className="cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
        [Agency]
      </summary>
      <div className="mt-0.5 space-y-0.5">
        <span className="block overflow-x-auto rounded border border-dashed border-gray-300 p-1 whitespace-nowrap dark:border-gray-600">
          <span className="block">
            [agency] id={agency.agency_id} lang={agency.agency_lang} tz={agency.agency_timezone}
          </span>
          <span className="block">
            name=&quot;{agency.agency_name}&quot; short=&quot;{agency.agency_short_name}&quot;
          </span>
          <span className="block">
            url={agency.agency_url || '(none)'} fare={agency.agency_fare_url || '(none)'}
          </span>
          <span className="block">
            [names]{' '}
            {Object.keys(agency.agency_names).length > 0
              ? Object.entries(agency.agency_names)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(' ')
              : '(none)'}
          </span>
          <span className="block">
            [shortNames]{' '}
            {Object.keys(agency.agency_short_names).length > 0
              ? Object.entries(agency.agency_short_names)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(' ')
              : '(none)'}
          </span>
          <span className="block">
            [colors]{' '}
            {agency.agency_colors.length > 0
              ? agency.agency_colors.map((c, i) => `${i}:bg=${c.bg},text=${c.text}`).join(' ')
              : '(none)'}
          </span>
        </span>
        <VerboseAgencyDisplayNames names={names} />
      </div>
    </details>
  );
}
