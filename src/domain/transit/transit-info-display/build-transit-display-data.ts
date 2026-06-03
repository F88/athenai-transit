import type { InfoLevel } from '../../../types/app/settings';
import type { AppRouteTypeValue, TimetableEntryAttributes } from '../../../types/app/transit';
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
import { getTimetableEntryAttributes } from '../timetable-entry-attributes';
import { formatAbsoluteTime } from '../time';
import { buildTripInspectionTarget } from '../trip-inspection-target';

export const TRANSIT_DISPLAY_MAX_ENTRIES = 12;

/**
 * Per-board row cap by info level: terser levels show fewer departures, the
 * more detailed levels show more. Used as the `maxEntries` passed to
 * {@link buildTransitDisplayDataSet}.
 */
const MAX_ENTRIES_BY_INFO_LEVEL: Record<InfoLevel, number> = {
  simple: 10,
  normal: 10,
  detailed: 20,
  verbose: 20,
};

/** Resolves the per-board row cap for the given info level. */
export function transitDisplayMaxEntriesFor(infoLevel: InfoLevel): number {
  return MAX_ENTRIES_BY_INFO_LEVEL[infoLevel];
}

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
 * How a display is classified: a departures board or an arrivals board. The
 * category is the meaningful concept; which time (departure vs arrival) it sorts
 * and shows by is derived internally from it (see {@link categoryMinutes}).
 */
export type TransitDisplayCategory = 'departures' | 'arrivals';

/**
 * Descriptor of one transit display: the selection parameters the UI composes
 * its (localized) title and description from. All fields are raw structured
 * values (no display text), so this domain layer stays i18n-free: the UI derives
 * the mode emoji from `routeType`, the departures/arrivals phrase from
 * `category`, and the row-count / radius text from `max` / `radius`.
 */
export interface TransitDisplayMeta {
  /** Whether this is a departures or an arrivals board. */
  category: TransitDisplayCategory;
  /** Route type this display is categorized by (drives the title's mode emoji). */
  routeType: AppRouteTypeValue;
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

/** One stop event paired with the stop context it came from, before name resolution. */
export interface TransitDisplayCandidate {
  entry: ContextualTimetableEntry;
  stopWithContext: StopWithContext;
}

/**
 * Service-day minutes an entry is sorted and shown by, derived from the board's
 * category: an arrivals board uses arrival time (even for intermediate,
 * non-terminal stops); a departures board uses departure time.
 */
function categoryMinutes(
  entry: ContextualTimetableEntry,
  category: TransitDisplayCategory,
): number {
  return category === 'arrivals' ? entry.schedule.arrivalMinutes : entry.schedule.departureMinutes;
}

/**
 * Selects which stop events a board shows (the data-selection half): flattens
 * every stop's `stopTimes` into candidates (each paired with its source stop
 * context), orders them by the board's category earliest-first, and caps the
 * count to `maxEntries`.
 *
 * Pure selection -- no route_type / terminal filtering (the caller pre-filters),
 * no display-name resolution, no output shaping. It therefore needs no
 * `preferredDisplayLangs`. Name resolution is deferred to the shaping step so it
 * runs only for the entries that survive the cap.
 */
export function selectTransitDisplayEntries(
  stops: readonly StopWithContext[],
  category: TransitDisplayCategory,
  maxEntries: number = TRANSIT_DISPLAY_MAX_ENTRIES,
): TransitDisplayCandidate[] {
  const candidates: TransitDisplayCandidate[] = [];
  for (const stopWithContext of stops) {
    for (const entry of stopWithContext.stopTimes) {
      candidates.push({ entry, stopWithContext });
    }
  }
  return candidates
    .sort(
      (a, b) =>
        minutesToDate(a.entry.serviceDate, categoryMinutes(a.entry, category)).getTime() -
        minutesToDate(b.entry.serviceDate, categoryMinutes(b.entry, category)).getTime(),
    )
    .slice(0, maxEntries);
}

export function buildTransitDisplayEntryData(
  stops: readonly StopWithContext[],
  preferredDisplayLangs: readonly string[],
  category: TransitDisplayCategory,
  maxEntries: number = TRANSIT_DISPLAY_MAX_ENTRIES,
): TransitDisplayEntryData[] {
  // Data-selection half: pick and order the entries this board shows.
  const visible = selectTransitDisplayEntries(stops, category, maxEntries);

  // Data-shaping half: resolve names and build the output objects for the
  // selected entries only.
  // Stop names are per-stop, so resolve each at most once and share across the
  // surviving entries that belong to the same stop.
  const stopNameCache = new Map<string, string>();
  const resolveStopName = (stopWithContext: StopWithContext): string => {
    const cached = stopNameCache.get(stopWithContext.stop.stop_id);
    if (cached !== undefined) {
      return cached;
    }
    const agencyLangs = stopWithContext.agencies.map((agency) => agency.agency_lang);
    const name = getStopDisplayNames(stopWithContext.stop, preferredDisplayLangs, agencyLangs).name;
    stopNameCache.set(stopWithContext.stop.stop_id, name);
    return name;
  };

  return visible.map(({ entry, stopWithContext }) => {
    const agencyLangs = stopWithContext.agencies.map((agency) => agency.agency_lang);
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
    const key = [
      stopWithContext.stop.stop_id,
      entry.tripLocator.patternId,
      entry.tripLocator.serviceId,
      entry.tripLocator.tripIndex,
      entry.patternPosition.stopIndex,
    ].join('__');
    const tripInspectionTarget = buildTripInspectionTarget(entry, entry.serviceDate);
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
      routeTypeEmoji: routeTypesEmoji([entry.routeDirection.route.route_type]),
      routeName,
      agencyName,
      headsign,
      timeText: formatAbsoluteTime(
        minutesToDate(entry.serviceDate, categoryMinutes(entry, category)),
      ),
      isArrival: entry.patternPosition.isTerminal,
      attributes: getTimetableEntryAttributes(entry),
      arrivalMinutes: entry.schedule.arrivalMinutes,
      departureMinutes: entry.schedule.departureMinutes,
      serviceDate: entry.serviceDate,
      inspectionTarget: tripInspectionTarget,
    };
  });
}

/** Radius (metres) for the nearby-stops displays. */
const NEARBY_RADIUS_M = 100;

/** Board categories, in the order they appear within a route type (departures then arrivals). */
const CATEGORIES: readonly TransitDisplayCategory[] = ['departures', 'arrivals'];

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

/**
 * Builds one display for the given route type and category from `stops`, or
 * `null` when no entries qualify.
 *
 * The departures board excludes terminal arrivals (a terminal has no meaningful
 * onward departure); the arrivals board keeps every stop event (every event has
 * a meaningful arrival time).
 */
function buildDisplay(
  routeType: AppRouteTypeValue,
  category: TransitDisplayCategory,
  stops: readonly StopWithContext[],
  preferredDisplayLangs: readonly string[],
  maxEntries: number,
): TransitDisplayData | null {
  const stopsForBoard = stops
    .map((stopWithContext) => ({
      ...stopWithContext,
      stopTimes: stopWithContext.stopTimes.filter((entry) => {
        if (entry.routeDirection.route.route_type !== routeType) {
          return false;
        }
        if (category === 'departures' && entry.patternPosition.isTerminal) {
          return false;
        }
        return true;
      }),
    }))
    .filter((stopWithContext) => stopWithContext.stopTimes.length > 0);
  const data = buildTransitDisplayEntryData(
    stopsForBoard,
    preferredDisplayLangs,
    category,
    maxEntries,
  );
  if (data.length === 0) {
    return null;
  }
  // Return only structured values; the UI composes the localized title
  // (mode emoji from `routeType` + departures/arrivals phrase from `category`)
  // and the row-count / radius description.
  return {
    meta: {
      category,
      routeType,
      max: maxEntries,
      radius: NEARBY_RADIUS_M,
    },
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

  // One display per (present route type, category), route type in canonical
  // display order with the departures board before the arrivals board.
  const presentTypes = collectEntryRouteTypes(nearbyStops);
  const orderedTypes = ROUTE_TYPE_DISPLAY_ORDER.filter((routeType) => presentTypes.has(routeType));

  return orderedTypes
    .flatMap((routeType) =>
      CATEGORIES.map((category) =>
        buildDisplay(routeType, category, nearbyStops, preferredDisplayLangs, maxEntries),
      ),
    )
    .filter((display): display is TransitDisplayData => display !== null);
}
