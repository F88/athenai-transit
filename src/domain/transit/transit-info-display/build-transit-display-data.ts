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
 * the mode emoji(s) from `routeTypes`, the departures/arrivals phrase from
 * `category`, and the row-count / radius text from `max` / `radius`.
 */
export interface TransitDisplayMeta {
  /** Whether this is a departures or an arrivals board. */
  category: TransitDisplayCategory;
  /**
   * Route type(s) this board covers (drives the title's mode emoji). One element
   * when split by route type; several when route types are combined into one board.
   */
  routeTypes: readonly AppRouteTypeValue[];
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

/**
 * How route types are grouped into boards:
 * - `none`: all route types combined into one board (per category)
 * - `route`: one board per route type
 * - `custom`: one board per caller-supplied group (each group = the route types
 *   on that board); e.g. pass the values of `ROUTE_TYPE_CATEGORY_GROUPS` to group
 *   by bus / subway / train / others.
 */
export type TransitDisplayRouteGrouping =
  | { kind: 'none' }
  | { kind: 'route' }
  | { kind: 'custom'; groups: readonly (readonly AppRouteTypeValue[])[] };

/**
 * Per-display selection condition the caller passes to {@link buildTransitDisplayDataSet}.
 * Bundles the choices that cannot be re-derived after boards are built (clustering
 * is lossy), so they must be decided at call time.
 */
export interface TransitDisplayCondition {
  /** Per-display (per-board) row cap. */
  maxEntries: number;
  /** How route types are grouped into boards. */
  routeGrouping: TransitDisplayRouteGrouping;
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
 * Whether an entry belongs on the given category's board. A departures board
 * excludes terminal arrivals (a terminal has no meaningful onward departure); an
 * arrivals board keeps every stop event (every event has a meaningful arrival).
 */
function categoryQualifies(
  entry: ContextualTimetableEntry,
  category: TransitDisplayCategory,
): boolean {
  if (category === 'departures') {
    return !entry.patternPosition.isTerminal;
  }
  return true;
}

/**
 * 1.1 Distance filter: stops whose precomputed `distance` is within
 * `radiusMeters` of the query centre. `distance` is precomputed (metres), so no
 * coordinate maths is needed here.
 */
export function filterStopsWithinRadius(
  stops: readonly StopWithContext[],
  radiusMeters: number,
): StopWithContext[] {
  return stops.filter((stop) => stop.distance !== undefined && stop.distance <= radiusMeters);
}

/**
 * Flattens every stop's `stopTimes` into candidates, each paired with its source
 * stop context: the single candidate type the selectors below operate on.
 */
export function toTransitDisplayCandidates(
  stops: readonly StopWithContext[],
): TransitDisplayCandidate[] {
  return stops.flatMap((stopWithContext) =>
    stopWithContext.stopTimes.map((entry) => ({ entry, stopWithContext })),
  );
}

/** 2.1 Route-type selector: keeps only candidates whose event runs on `routeType`. */
export function selectByRouteType(
  candidates: readonly TransitDisplayCandidate[],
  routeType: AppRouteTypeValue,
): TransitDisplayCandidate[] {
  return candidates.filter((c) => c.entry.routeDirection.route.route_type === routeType);
}

/**
 * 2.2 Category selector: keeps only candidates that qualify for `category`'s
 * board (its category-specific logic; see {@link categoryQualifies}).
 */
export function selectByCategory(
  candidates: readonly TransitDisplayCandidate[],
  category: TransitDisplayCategory,
): TransitDisplayCandidate[] {
  return candidates.filter((c) => categoryQualifies(c.entry, category));
}

/**
 * 3.1 Sort + cap: orders candidates earliest-first by the category's time and
 * returns at most `maxEntries` of them. Does not mutate the input.
 */
export function sortAndCapByCategory(
  candidates: readonly TransitDisplayCandidate[],
  category: TransitDisplayCategory,
  maxEntries: number,
): TransitDisplayCandidate[] {
  return [...candidates]
    .sort(
      (a, b) =>
        minutesToDate(a.entry.serviceDate, categoryMinutes(a.entry, category)).getTime() -
        minutesToDate(b.entry.serviceDate, categoryMinutes(b.entry, category)).getTime(),
    )
    .slice(0, maxEntries);
}

export function buildTransitDisplayEntryData(
  candidates: readonly TransitDisplayCandidate[],
  preferredDisplayLangs: readonly string[],
  category: TransitDisplayCategory,
): TransitDisplayEntryData[] {
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
    const agencyLangs = stopWithContext.agencies.map((agency) => agency.agency_lang);
    const name = getStopDisplayNames(stopWithContext.stop, preferredDisplayLangs, agencyLangs).name;
    stopNameCache.set(stopWithContext.stop.stop_id, name);
    return name;
  };

  return candidates.map(({ entry, stopWithContext }) => {
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

/** Conventional radius (metres) for the nearby-stops displays; callers pass this explicitly. */
export const NEARBY_RADIUS_M = 100;

/** Board categories, in the order they appear within a route type (departures then arrivals). */
const CATEGORIES: readonly TransitDisplayCategory[] = ['departures', 'arrivals'];

/**
 * One board's cell: which route type(s) and category it is, plus its candidates.
 * Plain candidates (not UI rows), so the same shape flows through selection (2),
 * sort + cap (3), and conversion (4) without those steps' concerns leaking into
 * each other.
 */
export interface TransitDisplayBoard {
  routeTypes: readonly AppRouteTypeValue[];
  category: TransitDisplayCategory;
  candidates: TransitDisplayCandidate[];
}

/** A cluster of candidates for one board's route-type scope, before the category split. */
export interface RouteTypeCluster {
  routeTypes: readonly AppRouteTypeValue[];
  candidates: TransitDisplayCandidate[];
}

/** Present route types among candidates, in `ROUTE_TYPE_DISPLAY_ORDER`. */
function presentRouteTypesInDisplayOrder(
  candidates: readonly TransitDisplayCandidate[],
): AppRouteTypeValue[] {
  const present = new Set(candidates.map((c) => c.entry.routeDirection.route.route_type));
  return ROUTE_TYPE_DISPLAY_ORDER.filter((routeType) => present.has(routeType));
}

/**
 * 2.1 Route-type clustering, per the grouping strategy:
 * - `route`: one cluster per route type (in `ROUTE_TYPE_DISPLAY_ORDER`)
 * - `none`: a single cluster of all candidates (its `routeTypes` are the present types)
 * - `custom`: one cluster per caller-supplied group, in the given order. Each
 *   board's `routeTypes` keep the group's order (present types only), not the
 *   display order, so the caller controls the emoji order. Groups may overlap --
 *   each cluster independently keeps the candidates whose route type is in its
 *   group, so a route type listed in two groups appears on both boards.
 *
 * Clustering is lossy, so the caller chooses the strategy via the condition.
 */
export function clusterCandidatesByRouteType(
  candidates: readonly TransitDisplayCandidate[],
  grouping: TransitDisplayRouteGrouping,
): RouteTypeCluster[] {
  if (grouping.kind === 'route') {
    return ROUTE_TYPE_DISPLAY_ORDER.map((routeType) => ({
      routeTypes: [routeType],
      candidates: selectByRouteType(candidates, routeType),
    }));
  }
  const presentTypes = presentRouteTypesInDisplayOrder(candidates);
  if (grouping.kind === 'none') {
    return [{ routeTypes: presentTypes, candidates: [...candidates] }];
  }
  // 'custom': one cluster per group (groups may overlap). Keep each group's own
  // order for routeTypes (present types only), so the caller's order is honored.
  const presentSet = new Set<number>(presentTypes);
  return grouping.groups.map((group) => {
    const groupSet = new Set<number>(group);
    return {
      routeTypes: group.filter((routeType) => presentSet.has(routeType)),
      candidates: candidates.filter((c) => groupSet.has(c.entry.routeDirection.route.route_type)),
    };
  });
}

/**
 * 2 Selector: clusters candidates into boards -- 2.1 route-type (per
 * `routeGrouping`) then 2.2 category -- yielding one board per non-empty cell,
 * in route-type display order x (departures, arrivals).
 *
 * Selection only. No sort / cap (that is 3, {@link sortAndCapBoards}) and no UI
 * conversion (that is 4, {@link toTransitDisplayData}). Empty cells are dropped,
 * so the present route types fall out without a separate enumeration.
 */
export function selectTransitDisplayBoards(
  candidates: readonly TransitDisplayCandidate[],
  routeGrouping: TransitDisplayRouteGrouping,
): TransitDisplayBoard[] {
  return clusterCandidatesByRouteType(candidates, routeGrouping)
    .flatMap((cluster) =>
      CATEGORIES.map((category) => ({
        routeTypes: cluster.routeTypes,
        category,
        candidates: selectByCategory(cluster.candidates, category), // 2.2
      })),
    )
    .filter((board) => board.candidates.length > 0);
}

/**
 * 3 Sort + cap: orders each board's candidates earliest-first by its category's
 * time and caps to `maxEntries`. Operates per board; not the selector's concern.
 */
export function sortAndCapBoards(
  boards: readonly TransitDisplayBoard[],
  maxEntries: number,
): TransitDisplayBoard[] {
  return boards.map((board) => ({
    ...board,
    candidates: sortAndCapByCategory(board.candidates, board.category, maxEntries),
  }));
}

/**
 * 4 UI converter: turns one board into UI data -- assembles its `meta`
 * descriptor (from the board cell + the `radiusMeters` / `maxEntries` scope) and
 * resolves display names for its candidates.
 */
export function toTransitDisplayData(
  board: TransitDisplayBoard,
  preferredDisplayLangs: readonly string[],
  radiusMeters: number,
  maxEntries: number,
): TransitDisplayData {
  return {
    meta: {
      category: board.category,
      routeTypes: board.routeTypes,
      max: maxEntries,
      radius: radiusMeters,
    },
    data: buildTransitDisplayEntryData(board.candidates, preferredDisplayLangs, board.category),
  };
}

/**
 * Runs the board-building steps in sequence: 1.1 distance filter -> flatten ->
 * 2 select (route-type / category clustering) -> 3 sort + cap -> 4 UI convert.
 * Each step is single-purpose so the next one's concern does not leak into it.
 *
 * `radiusMeters` (the range stops are selected within; also each board's
 * `meta.radius`) and `condition` (the per-display selection condition) are both
 * required so the caller states the selection scope explicitly.
 * {@link NEARBY_RADIUS_M} is the conventional radius to pass.
 */
export function buildTransitDisplayDataSet(
  stops: readonly StopWithContext[],
  preferredDisplayLangs: readonly string[],
  radiusMeters: number,
  condition: TransitDisplayCondition,
): TransitDisplayData[] {
  const nearbyStops = filterStopsWithinRadius(stops, radiusMeters); // 1.1
  const candidates = toTransitDisplayCandidates(nearbyStops); // flatten once
  const boards = selectTransitDisplayBoards(candidates, condition.routeGrouping); // 2
  const cappedBoards = sortAndCapBoards(boards, condition.maxEntries); // 3
  return cappedBoards.map((board) =>
    toTransitDisplayData(board, preferredDisplayLangs, radiusMeters, condition.maxEntries),
  ); // 4
}
