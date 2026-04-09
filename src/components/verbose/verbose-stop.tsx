import type { StopServiceState } from '../../domain/transit/timetable-utils';
import type { Stop } from '../../types/app/transit';

/**
 * Debug dump of Stop basic fields.
 * Renders block-level content (no details/summary, no border).
 * Used as a building block by {@link VerboseStopData} and other components.
 */
export function VerboseStop({
  stop,
  isDropOffOnly,
  serviceState,
  isBoardableOnServiceDay,
}: {
  stop: Stop;
  isDropOffOnly: boolean;
  /** Service state of the stop on the current service day (optional, for debug). */
  serviceState?: StopServiceState;
  /** Raw repo signal — whether at least one boardable entry exists today. */
  isBoardableOnServiceDay?: boolean;
}) {
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
      {(serviceState != null || isBoardableOnServiceDay != null) && (
        <p className="m-0">
          [service]
          {serviceState != null && ` state=${serviceState}`}
          {isBoardableOnServiceDay != null && ` boardable=${String(isBoardableOnServiceDay)}`}
        </p>
      )}
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
