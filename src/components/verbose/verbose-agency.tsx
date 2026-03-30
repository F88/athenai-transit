import type { Agency } from '../../types/app/transit';

/**
 * Debug dump of all Agency fields.
 * Only rendered in verbose info level.
 */
export function VerboseAgency({ agency }: { agency: Agency }) {
  return (
    <span className="block overflow-x-auto rounded border border-dashed border-gray-300 p-1 text-[9px] whitespace-nowrap text-[#999] dark:border-gray-600 dark:text-gray-500">
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
  );
}
