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
  const schedule = snapshot.selectedStop.timetableEntry.schedule;
  const boarding = snapshot.selectedStop.timetableEntry.boarding;
  const selectedStopId = snapshot.selectedStop.stopMeta?.stop.stop_id ?? '(unknown-stop)';
  const selectedStopName = snapshot.selectedStop.stopMeta?.stop.stop_name ?? selectedStopId;
  const departureText = formatDebugMinutes(schedule.departureMinutes, snapshot.serviceDate);
  const arrivalText = formatDebugMinutes(schedule.arrivalMinutes, snapshot.serviceDate);

  return `handleSelectTripDebug: pattern=${snapshot.locator.patternId} service=${snapshot.locator.serviceId} tripIndex=${snapshot.locator.tripIndex} selectedStop=${selectedStopId}(${selectedStopName}) stopIndex=${snapshot.currentStopIndex}/${snapshot.stopTimes.length - 1} dep=${departureText} arr=${arrivalText} pickup=${boarding.pickupType} dropOff=${boarding.dropOffType}`;
}

/**
 * Build the expanded trip stop listing debug line.
 *
 * @param snapshot - Reconstructed trip snapshot including the selected stop.
 * @returns One-line listing of the route, headsign, span, and all stops.
 */
export function buildTripDebugLog2(snapshot: SelectedTripSnapshot): string {
  const routeInfo = `[${snapshot.route.route_short_name || snapshot.route.route_long_name}]`;
  const effectiveHeadsign =
    snapshot.selectedStop.timetableEntry.routeDirection.stopHeadsign?.name ??
    snapshot.tripHeadsign.name;
  const headsign = effectiveHeadsign === '' ? '""' : effectiveHeadsign;
  const firstStop = snapshot.stopTimes[0];
  const lastStop = snapshot.stopTimes[snapshot.stopTimes.length - 1];
  const tripSpan =
    firstStop && lastStop
      ? `${formatDebugClock(firstStop.timetableEntry.schedule.departureMinutes, snapshot.serviceDate)}->${formatDebugClock(lastStop.timetableEntry.schedule.arrivalMinutes, snapshot.serviceDate)}(${lastStop.timetableEntry.schedule.arrivalMinutes - firstStop.timetableEntry.schedule.departureMinutes})`
      : '';
  const stops = snapshot.stopTimes
    .map((stop) => {
      const stopId = stop.stopMeta?.stop.stop_id ?? '(unknown-stop)';
      const stopName = stop.stopMeta?.stop.stop_name ?? stopId;
      const stopIndex = stop.timetableEntry.patternPosition.stopIndex;
      const arrivalMinutes = stop.timetableEntry.schedule.arrivalMinutes;
      const departureMinutes = stop.timetableEntry.schedule.departureMinutes;
      const stopText = `${stopIndex}:${stopName}(${formatDebugClock(arrivalMinutes, snapshot.serviceDate)}|${formatDebugClock(departureMinutes, snapshot.serviceDate)})`;
      return stopIndex === snapshot.currentStopIndex ? `[${stopText}]` : stopText;
    })
    .join(', ');

  return `handleSelectTripDebug.stops: ${routeInfo} ${headsign} (${snapshot.stopTimes.length} stops) ${tripSpan} ${stops}`;
}
