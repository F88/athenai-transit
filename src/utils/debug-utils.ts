import { minutesToDate } from '../domain/transit/calendar-utils';
import { formatAbsoluteTime } from '../domain/transit/time';
import type { SelectedTripSnapshot } from '../types/app/transit-composed';

/**
 * Format debug minutes as `minutes(HH:mm)` when serviceDate is available.
 *
 * @param minutes - Minutes from midnight of the GTFS service day.
 * @param serviceDate - Service day used to resolve overnight times.
 * @returns Raw minutes or a combined debug string.
 */
export function formatDebugMinutes(minutes: number, serviceDate?: Date): string {
  if (!serviceDate) {
    return String(minutes);
  }

  const absoluteTime = formatAbsoluteTime(minutesToDate(serviceDate, minutes));
  const [hour = '0', minute = '00'] = absoluteTime.split(':');
  return `${minutes}(${hour.padStart(2, '0')}:${minute})`;
}

/**
 * Format service-day minutes as `HH:mm` for compact debug output.
 *
 * @param minutes - Minutes from midnight of the GTFS service day.
 * @param serviceDate - Service day used to resolve overnight times.
 * @returns `HH:mm` or raw minutes when serviceDate is unavailable.
 */
export function formatDebugClock(minutes: number, serviceDate?: Date): string {
  if (!serviceDate) {
    return String(minutes);
  }

  const absoluteTime = formatAbsoluteTime(minutesToDate(serviceDate, minutes));
  const [hour = '0', minute = '00'] = absoluteTime.split(':');
  return `${hour.padStart(2, '0')}:${minute}`;
}

/**
 * Format a duration in minutes as `HH:mm`.
 *
 * @param totalMinutes - Duration in minutes.
 * @returns Zero-padded hour/minute duration string.
 */
export function formatDurationClock(totalMinutes: number): string {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Build the primary trip debug summary line.
 *
 * @param snapshot - Reconstructed trip snapshot including the selected stop.
 * @returns One-line summary of the selected stop event and trip locator.
 */
export function buildTripDebugLog1(snapshot: SelectedTripSnapshot): string {
  const departureText = formatDebugMinutes(
    snapshot.selectedStop.departureMinutes,
    snapshot.serviceDate,
  );
  const arrivalText = formatDebugMinutes(
    snapshot.selectedStop.arrivalMinutes,
    snapshot.serviceDate,
  );

  return `handleSelectTripDebug: pattern=${snapshot.locator.patternId} service=${snapshot.locator.serviceId} tripIndex=${snapshot.locator.tripIndex} selectedStop=${snapshot.selectedStop.stopId}(${snapshot.selectedStop.stopName}) stopIndex=${snapshot.currentStopIndex}/${snapshot.totalStops - 1} dep=${departureText} arr=${arrivalText} pickup=${snapshot.selectedStop.pickupType} dropOff=${snapshot.selectedStop.dropOffType}`;
}

/**
 * Build the expanded trip stop listing debug line.
 *
 * @param snapshot - Reconstructed trip snapshot including the selected stop.
 * @returns One-line listing of the route, headsign, span, and all stops.
 */
export function buildTripDebugLog2(snapshot: SelectedTripSnapshot): string {
  const routeInfo = `[${snapshot.route.route_short_name || snapshot.route.route_long_name}]`;
  const effectiveHeadsign = snapshot.selectedStop.stopHeadsign ?? snapshot.headsign;
  const headsign = effectiveHeadsign === '' ? '""' : effectiveHeadsign;
  const firstStop = snapshot.stops[0];
  const lastStop = snapshot.stops[snapshot.stops.length - 1];
  const tripSpan =
    firstStop && lastStop
      ? `${formatDebugClock(firstStop.departureMinutes, snapshot.serviceDate)}->${formatDebugClock(lastStop.arrivalMinutes, snapshot.serviceDate)}(${lastStop.arrivalMinutes - firstStop.departureMinutes})`
      : '';
  const stops = snapshot.stops
    .map((stop) => {
      const stopText = `${stop.stopIndex}:${stop.stopName}(${formatDebugClock(stop.arrivalMinutes, snapshot.serviceDate)}|${formatDebugClock(stop.departureMinutes, snapshot.serviceDate)})`;
      return stop.stopIndex === snapshot.currentStopIndex ? `[${stopText}]` : stopText;
    })
    .join(', ');

  return `handleSelectTripDebug.stops: ${routeInfo} ${headsign} (${snapshot.totalStops} stops) ${tripSpan} ${stops}`;
}
