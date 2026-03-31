import type { Stop } from '../../types/app/transit';

/**
 * Debug dump of Stop basic fields.
 * Renders block-level content (no details/summary, no border).
 * Used as a building block by {@link VerboseStopData} and other components.
 */
export function VerboseStop({ stop, isDropOffOnly }: { stop: Stop; isDropOffOnly: boolean }) {
  return (
    <>
      <p className="m-0">
        [stop] id={stop.stop_id} agency={stop.agency_id} lat={stop.stop_lat} lon={stop.stop_lon}{' '}
        loc=
        {stop.location_type}
        {stop.wheelchair_boarding != null && ` wb=${stop.wheelchair_boarding}`}
        {stop.parent_station && ` parent=${stop.parent_station}`}
        {stop.platform_code && ` platform=${stop.platform_code}`}
        {isDropOffOnly && ' DROP-OFF-ONLY'}
      </p>
      <p className="m-0">
        [names]{' '}
        {Object.keys(stop.stop_names).length > 0
          ? Object.entries(stop.stop_names)
              .map(([k, v]) => `${k}=${v}`)
              .join(' ')
          : '(none)'}
      </p>
    </>
  );
}
