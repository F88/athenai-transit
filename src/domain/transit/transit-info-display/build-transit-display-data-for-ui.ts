/**
 * UI presentation layer for transit displays: resolves a structural board's raw
 * entries ({@link TransitDisplayDatum}) into display-name-resolved UI rows
 * ({@link TransitDisplayDatumForUi}). Kept separate from build-transit-display-data.ts
 * (the i18n-free structural builder) so the data layer stays free of
 * presentation / name-resolution concerns; calling this is the UI's choice.
 */
import type { TimetableEntryAttributes } from '../../../types/app/transit';
import type { StopWithContext, TripInspectionTarget } from '../../../types/app/transit-composed';
import { routeTypesEmoji } from '../../../utils/route-type-emoji';
import { formatDateKey, minutesToDate } from '../calendar-utils';
import { getAgencyDisplayNames } from '../name-resolver/get-agency-display-name';
import { getHeadsignDisplayNames } from '../name-resolver/get-headsign-display-names';
import { getRouteDisplayNames } from '../name-resolver/get-route-display-names';
import { getStopDisplayNames } from '../name-resolver/get-stop-display-names';
import { getTimetableEntryAttributes } from '../timetable-entry-attributes';
import { formatAbsoluteTime } from '../time';
import { buildTripInspectionTarget } from '../trip-inspection-target';
import {
  categoryMinutes,
  type TransitDisplayCategory,
  type TransitDisplayDatum,
  type TransitDisplayMeta,
} from './build-transit-display-data';
import { DEFAULT_AGENCY_LANG } from '@/config/transit-defaults';

/**
 * Stop-level fields of a {@link TransitDisplayDatumForUi}, grouped so consumers can
 * tell stop context apart from the per-event (trip) fields.
 */
export interface TransitDisplayDatumForUiStop {
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

export interface TransitDisplayDatumForUi {
  key: string;
  /** Stop-level context for this event. */
  stop: TransitDisplayDatumForUiStop;
  /** Mode emoji for this event's route (trip-level: bus / train / etc.). */
  routeTypeEmoji: string;
  routeName: string;
  /** Resolved display name of the agency operating this event's route. */
  agencyName: string;
  headsign: string;
  /** Pre-formatted absolute display time (legacy presentation). */
  timeText: string;
  /** Boarding / drop-off availability and pattern-position flags for this event. */
  attributes: TimetableEntryAttributes;
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
 * One resolved display, ready to render: its {@link TransitDisplayMeta} descriptor
 * plus the UI rows. Produced by resolving a board's rows with
 * {@link buildTransitDisplayDatumForUi} (e.g. in the UI container).
 */
export interface TransitDisplayDataWithMetaDataForUi {
  /** Display descriptor (title + selection params). */
  meta: TransitDisplayMeta;
  /** The entry data this display renders. */
  data: readonly TransitDisplayDatumForUi[];
}

export function buildTransitDisplayDatumForUi(
  datum: readonly TransitDisplayDatum[],
  preferredDisplayLangs: readonly string[],
  category: TransitDisplayCategory,
): TransitDisplayDatumForUi[] {
  // Data-shaping half: resolve names and build the output objects for the
  // already-selected entries.
  // Stop names are per-stop, so resolve each at most once and share across the
  // selected entries that belong to the same stop.
  const stopNameCache = new Map<string, string>();
  const resolveStopName = (stopWithContext: StopWithContext): string => {
    const cached = stopNameCache.get(stopWithContext.stop.stop_id);
    if (cached !== undefined) {
      return cached;
    }
    const stopAgencies = stopWithContext.agencies;
    const stopAgencyLangs = stopAgencies.map((agency) => agency.agency_lang);
    const stopName = getStopDisplayNames(
      stopWithContext.stop,
      preferredDisplayLangs,
      stopAgencyLangs,
    ).name;
    stopNameCache.set(stopWithContext.stop.stop_id, stopName);
    return stopName;
  };

  return datum.map(({ timetableEntry, stop: stopWithContext }) => {
    // [IMPORTANT] Use domain logic to determine the starting/ending point.
    const attributes = getTimetableEntryAttributes(timetableEntry);

    // Route
    const route = timetableEntry.routeDirection.route;
    const routeAgency = stopWithContext.agencies.find(
      (agency) => agency.agency_id === route.agency_id,
    );
    const routeAgencyLangs = routeAgency ? [routeAgency.agency_lang] : DEFAULT_AGENCY_LANG;
    const routeName = getRouteDisplayNames(route, preferredDisplayLangs, routeAgencyLangs, 'short')
      .resolved.name;
    const agencyName = routeAgency
      ? getAgencyDisplayNames(routeAgency, preferredDisplayLangs, routeAgencyLangs, 'short')
          .resolved.name || routeAgency.agency_id
      : '';

    // Headsign
    const headsign = getHeadsignDisplayNames(
      timetableEntry.routeDirection,
      preferredDisplayLangs,
      routeAgencyLangs,
      'stop',
    ).resolved.name;

    // Include the service date: TripLocator is per-service (not per-day), so the
    // same (patternId, serviceId, tripIndex, stopIndex) can recur on different
    // service dates within one board, which would collide as a React key.
    // JSON.stringify (not a delimiter join) keeps the parts unambiguous: a
    // patternId already embeds "__" (`${route_id}__${headsign}`), so a literal
    // separator could let different tuples stringify to the same key.
    const key = JSON.stringify([
      stopWithContext.stop.stop_id,
      formatDateKey(timetableEntry.serviceDate),
      timetableEntry.tripLocator.patternId,
      timetableEntry.tripLocator.serviceId,
      timetableEntry.tripLocator.tripIndex,
      timetableEntry.patternPosition.stopIndex,
    ]);
    const tripInspectionTarget = buildTripInspectionTarget(
      timetableEntry,
      timetableEntry.serviceDate,
    );

    return {
      key,
      stop: {
        id: stopWithContext.stop.stop_id,
        name: resolveStopName(stopWithContext),
        platformCode: stopWithContext.stop.platform_code,
        distance: stopWithContext.distance,
        routeTypesEmoji: routeTypesEmoji(stopWithContext.routeTypes),
        context: stopWithContext,
      },
      routeTypeEmoji: routeTypesEmoji([timetableEntry.routeDirection.route.route_type]),
      routeName,
      agencyName,
      headsign,
      timeText: formatAbsoluteTime(
        minutesToDate(timetableEntry.serviceDate, categoryMinutes(timetableEntry, category)),
      ),
      attributes,
      arrivalMinutes: timetableEntry.schedule.arrivalMinutes,
      departureMinutes: timetableEntry.schedule.departureMinutes,
      serviceDate: timetableEntry.serviceDate,
      inspectionTarget: tripInspectionTarget,
    };
  });
}
