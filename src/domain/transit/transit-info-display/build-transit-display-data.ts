import { APP_ROUTE_TYPES } from '../../../config/route-types';
import type { AppRouteTypeValue } from '../../../types/app/transit';
import type {
  ContextualTimetableEntry,
  StopWithContext,
  TripInspectionTarget,
} from '../../../types/app/transit-composed';
import { routeTypesEmoji } from '../../../utils/route-type-emoji';
import { ROUTE_TYPE_DISPLAY_ORDER } from '../route-type-display-order';
import { minutesToDate } from '../calendar-utils';
import { getAgencyDisplayNames } from '../name-resolver/get-agency-display-name';
import { getHeadsignDisplayNames } from '../name-resolver/get-headsign-display-names';
import { getRouteDisplayNames } from '../name-resolver/get-route-display-names';
import { getStopDisplayNames } from '../name-resolver/get-stop-display-names';
import { sortTimetableEntriesByDisplayTimeChronologically } from '../sort-timetable-for-ui';
import { formatAbsoluteTime } from '../time';
import { getDisplayMinutes } from '../timetable-utils';
import { buildTripInspectionTarget } from '../trip-inspection-target';

export const TRANSIT_DISPLAY_MAX_ENTRIES = 12;

/**
 * Stop-level fields of a {@link TransitDisplayEntryData}, grouped so consumers can
 * tell stop context apart from the per-event (trip) fields.
 */
export interface TransitDisplayEntryDataStop {
  /** Stop ID (used for selection and row keys). */
  id: string;
  /** Resolved display name of the stop. */
  name: string;
  /** Platform code of the stop, when present. */
  platformCode: string | undefined;
  /** Distance in metres from the query centre point, when known. */
  distance: number | undefined;
  /** Mode emojis for all route_types served by the stop (stop-level). */
  routeTypesEmoji: string;
  /**
   * Source stop context (shared reference) this event belongs to.
   *
   * Carried verbatim so row consumers can render stop-level presentation
   * directly from the stop / agency / route metadata already resolved on
   * the source context.
   */
  context: StopWithContext;
}

export interface TransitDisplayEntryData {
  key: string;
  /** Stop-level context for this event. */
  stop: TransitDisplayEntryDataStop;
  /** Mode emoji for this event's route (trip-level: bus / train / etc.). */
  routeTypeEmoji: string;
  routeName: string;
  /** Resolved display name of the agency operating this event's route. */
  agencyName: string;
  headsign: string;
  /** Pre-formatted absolute display time (legacy presentation). */
  timeText: string;
  isArrival: boolean;
  /** Service-day arrival minutes for `StopTimeTimeInfo` rendering. */
  arrivalMinutes: number;
  /** Service-day departure minutes for `StopTimeTimeInfo` rendering. */
  departureMinutes: number;
  /** Service date the stop event belongs to. */
  serviceDate: Date;
  /** Target used to open trip inspection for this stop event. */
  inspectionTarget: TripInspectionTarget;
}

/**
 * Descriptor of one transit display: what it is plus the selection parameters
 * the UI composes the (localized) description from. `max` / `radius` are raw
 * numbers and `title` is provisional text, so this domain layer stays i18n-free
 * (title becomes an i18n key / structured value when localized later).
 */
export interface TransitDisplayMeta {
  /** Title — what this display is (e.g. 出発案内). Text/i18n deferred to a later spec. */
  title: string;
  /** Row cap applied to this display's entries. */
  max: number;
  /** Radius (metres) the display's stops were selected within. */
  radius: number;
}

export interface TransitDisplayData {
  /** Display descriptor (title + selection params). */
  meta: TransitDisplayMeta;
  /** The entry data this display renders. */
  data: readonly TransitDisplayEntryData[];
}

interface TransitDisplaySortableEntry extends ContextualTimetableEntry {
  transitDisplayEntryKey: string;
}

interface TransitDisplayEntryDataMeta {
  stopId: string;
  stopName: string;
  platformCode: string | undefined;
  distance: number | undefined;
  routeTypesEmoji: string;
  routeName: string;
  agencyName: string;
  headsign: string;
  stopWithContext: StopWithContext;
}

export function buildTransitDisplayEntryData(
  stops: readonly StopWithContext[],
  preferredDisplayLangs: readonly string[],
  maxEntries: number = TRANSIT_DISPLAY_MAX_ENTRIES,
): TransitDisplayEntryData[] {
  const metaByKey = new Map<string, TransitDisplayEntryDataMeta>();
  const entries: TransitDisplaySortableEntry[] = [];

  for (const stopWithContext of stops) {
    const agencyLangs = stopWithContext.agencies.map((agency) => agency.agency_lang);
    const stopName = getStopDisplayNames(
      stopWithContext.stop,
      preferredDisplayLangs,
      agencyLangs,
    ).name;

    for (const entry of stopWithContext.stopTimes) {
      const key = [
        stopWithContext.stop.stop_id,
        entry.tripLocator.patternId,
        entry.tripLocator.serviceId,
        entry.tripLocator.tripIndex,
        entry.patternPosition.stopIndex,
      ].join('__');
      const routeAgency = stopWithContext.agencies.find(
        (agency) => agency.agency_id === entry.routeDirection.route.agency_id,
      );
      const routeAgencyLangs = routeAgency ? [routeAgency.agency_lang] : agencyLangs;
      const routeName = getRouteDisplayNames(
        entry.routeDirection.route,
        preferredDisplayLangs,
        routeAgencyLangs,
        'short',
      ).resolved.name;
      const headsign = getHeadsignDisplayNames(
        entry.routeDirection,
        preferredDisplayLangs,
        routeAgencyLangs,
        'stop',
      ).resolved.name;
      const agencyName = routeAgency
        ? getAgencyDisplayNames(routeAgency, preferredDisplayLangs, routeAgencyLangs, 'short')
            .resolved.name || routeAgency.agency_id
        : '';

      metaByKey.set(key, {
        stopId: stopWithContext.stop.stop_id,
        stopName,
        platformCode: stopWithContext.stop.platform_code,
        distance: stopWithContext.distance,
        routeTypesEmoji: routeTypesEmoji(stopWithContext.routeTypes),
        routeName,
        agencyName,
        headsign,
        stopWithContext,
      });
      entries.push({ ...entry, transitDisplayEntryKey: key });
    }
  }

  return sortTimetableEntriesByDisplayTimeChronologically(entries)
    .slice(0, maxEntries)
    .map((entry) => {
      const meta = metaByKey.get(entry.transitDisplayEntryKey);
      if (!meta) {
        throw new Error(
          `Missing transit display row meta for key: ${entry.transitDisplayEntryKey}`,
        );
      }
      const tripInspectionTarget = buildTripInspectionTarget(entry, entry.serviceDate);
      return {
        key: entry.transitDisplayEntryKey,
        stop: {
          id: meta.stopId,
          name: meta.stopName,
          platformCode: meta.platformCode,
          distance: meta.distance,
          routeTypesEmoji: meta.routeTypesEmoji,
          context: meta.stopWithContext,
        },
        routeTypeEmoji: routeTypesEmoji([entry.routeDirection.route.route_type]),
        routeName: meta.routeName,
        agencyName: meta.agencyName,
        headsign: meta.headsign,
        timeText: formatAbsoluteTime(minutesToDate(entry.serviceDate, getDisplayMinutes(entry))),
        isArrival: entry.patternPosition.isTerminal,
        arrivalMinutes: entry.schedule.arrivalMinutes,
        departureMinutes: entry.schedule.departureMinutes,
        serviceDate: entry.serviceDate,
        inspectionTarget: tripInspectionTarget,
      };
    });
}

/** Radius (metres) for the nearby-stops displays. */
const NEARBY_RADIUS_M = 100;

/** Route types that have at least one entry across the given stops. */
function collectEntryRouteTypes(stops: readonly StopWithContext[]): Set<AppRouteTypeValue> {
  const routeTypes = new Set<AppRouteTypeValue>();
  for (const stopWithContext of stops) {
    for (const entry of stopWithContext.stopTimes) {
      routeTypes.add(entry.routeDirection.route.route_type);
    }
  }
  return routeTypes;
}

/** Builds one display holding only the given route type's entries from `stops`. */
function buildRouteTypeDisplay(
  routeType: AppRouteTypeValue,
  stops: readonly StopWithContext[],
  preferredDisplayLangs: readonly string[],
  maxEntries: number,
): TransitDisplayData {
  const stopsForType = stops
    .map((stopWithContext) => ({
      ...stopWithContext,
      stopTimes: stopWithContext.stopTimes.filter(
        (entry) => entry.routeDirection.route.route_type === routeType,
      ),
    }))
    .filter((stopWithContext) => stopWithContext.stopTimes.length > 0);
  const data = buildTransitDisplayEntryData(stopsForType, preferredDisplayLangs, maxEntries);
  const routeTypeMeta = APP_ROUTE_TYPES.find((appRouteType) => appRouteType.value === routeType);
  const label = routeTypeMeta ? `${routeTypeMeta.emoji} ${routeTypeMeta.label}` : String(routeType);
  // title is a provisional placeholder (text/i18n deferred); the UI composes
  // the localized description from `max` / `radius`.
  return {
    meta: { title: `${label} (${NEARBY_RADIUS_M}m)`, max: maxEntries, radius: NEARBY_RADIUS_M },
    data,
  };
}

export function buildTransitDisplayDataSet(
  stops: readonly StopWithContext[],
  preferredDisplayLangs: readonly string[],
  maxEntries: number = TRANSIT_DISPLAY_MAX_ENTRIES,
): TransitDisplayData[] {
  // Limit to stops within the radius. `distance` is precomputed (metres from the
  // query centre), so no coordinate maths here.
  const nearbyStops = stops.filter(
    (stop) => stop.distance !== undefined && stop.distance <= NEARBY_RADIUS_M,
  );

  // One display per present route type, in canonical display order.
  const presentTypes = collectEntryRouteTypes(nearbyStops);
  const orderedTypes = ROUTE_TYPE_DISPLAY_ORDER.filter((routeType) => presentTypes.has(routeType));
  return orderedTypes.map((routeType) =>
    buildRouteTypeDisplay(routeType, nearbyStops, preferredDisplayLangs, maxEntries),
  );
}
