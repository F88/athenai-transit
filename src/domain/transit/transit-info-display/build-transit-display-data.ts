import type { InfoLevel } from '../../../types/app/settings';
import type { AppRouteTypeValue, TimetableEntryAttributes } from '../../../types/app/transit';
import type {
  ContextualTimetableEntry,
  StopWithContext,
  TripInspectionTarget,
} from '../../../types/app/transit-composed';
import { routeTypesEmoji } from '../../../utils/route-type-emoji';
import { ROUTE_TYPE_DISPLAY_ORDER } from '../route-type-display-order';
import { formatDateKey, minutesToDate } from '../calendar-utils';
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
  // verbose: 10,
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
  /**
   * Direction(s) of travel this board covers. `0` / `1` are GTFS `direction_id`
   * (where the source provides it) and `'none'` is "no direction_id". One element
   * when split by direction; several (the directions actually present) when not.
   */
  directions: readonly (0 | 1 | 'none')[];
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
  /**
   * Whether to also split each board by direction of travel. When true, every
   * route type is split by each trip's `routeDirection.direction` (`0` | `1` |
   * `undefined`); when false, boards are not divided by direction. That
   * `direction` mirrors GTFS `direction_id` where the source provides it
   * (`undefined` otherwise) and is route-local / arbitrary across routes, so
   * splitting can read poorly at multi-route stops -- the caller decides per
   * display.
   */
  splitByDirection: boolean;
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
 * Whether an entry belongs on the given category's board, using signboard
 * semantics specific to this Transit Board: a departures board lists trips you
 * can board here (and that continue past here), an arrivals board lists trips you
 * can alight here. Other views still show the data as-is; only this board applies
 * the boardable / alightable rule.
 */
export function categoryQualifies(
  entry: ContextualTimetableEntry,
  category: TransitDisplayCategory,
): boolean {
  // [IMPORTANT] Use domain logic to determine the starting/ending point.
  const attributes = getTimetableEntryAttributes(entry);

  if (category === 'departures') {
    // A departures board lists trips you can actually leave on: not the terminal
    // (the trip ends here) and boardable here (excludes boarding-prohibited stops
    // such as the drop-off-only stop just before a terminus).
    return !attributes.isTerminal && !attributes.isPickupUnavailable;
  }
  // An arrivals board lists trips you can alight from here: not the origin (the
  // trip starts here) and drop-off allowed here (excludes pickup-only legs such
  // as the boarding leg of a turn-around / boarding-swap stop).
  return !attributes.isOrigin && !attributes.isDropOffUnavailable;
}

/**
 * Distance filter: stops whose precomputed `distance` is within
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

/** Keeps only candidates whose event runs on `routeType`. */
export function selectByRouteType(
  candidates: readonly TransitDisplayCandidate[],
  routeType: AppRouteTypeValue,
): TransitDisplayCandidate[] {
  return candidates.filter((c) => c.entry.routeDirection.route.route_type === routeType);
}

/**
 * Orders candidates earliest-first by the category's time. Does not mutate the
 * input.
 */
export function sortByCategory(
  candidates: readonly TransitDisplayCandidate[],
  category: TransitDisplayCategory,
): TransitDisplayCandidate[] {
  return [...candidates].sort(
    (a, b) =>
      minutesToDate(a.entry.serviceDate, categoryMinutes(a.entry, category)).getTime() -
      minutesToDate(b.entry.serviceDate, categoryMinutes(b.entry, category)).getTime(),
  );
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
    // Include the service date: TripLocator is per-service (not per-day), so the
    // same (patternId, serviceId, tripIndex, stopIndex) can recur on different
    // service dates within one board, which would collide as a React key.
    // JSON.stringify (not a delimiter join) keeps the parts unambiguous: a
    // patternId already embeds "__" (`${route_id}__${headsign}`), so a literal
    // separator could let different tuples stringify to the same key.
    const key = JSON.stringify([
      stopWithContext.stop.stop_id,
      formatDateKey(entry.serviceDate),
      entry.tripLocator.patternId,
      entry.tripLocator.serviceId,
      entry.tripLocator.tripIndex,
      entry.patternPosition.stopIndex,
    ]);
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
 * Direction buckets used to split a board by direction of travel. The values
 * are `routeDirection.direction`: `undefined` (no direction on the trip), then
 * `0` and `1` (the route's two opposite directions). `direction` mirrors GTFS
 * `direction_id` where the source provides it, and is `undefined` otherwise
 * (e.g. non-GTFS / ODPT sources). Empty buckets are dropped downstream, so trips
 * without a direction collapse to one group.
 */
const DIRECTIONS: readonly (0 | 1 | undefined)[] = [undefined, 0, 1];

/**
 * Directions actually present among the candidates, in `DIRECTIONS` order, with
 * the no-direction case as `'none'`. Used for a not-split board's `directions`,
 * mirroring how present route types are listed (data-present, not enumerated).
 */
function presentDirections(
  candidates: readonly TransitDisplayCandidate[],
): readonly (0 | 1 | 'none')[] {
  const present = new Set(candidates.map((c) => c.entry.routeDirection.direction));
  return DIRECTIONS.filter((direction) => present.has(direction)).map(
    (direction) => direction ?? 'none',
  );
}

/**
 * One board's cell: which route type(s), direction(s) and category it is, plus
 * its candidates. Plain candidates (not UI rows), so the same shape flows through
 * grouping, sort + cap, and UI conversion without those concerns leaking into
 * each other.
 */
export interface TransitDisplayBoard {
  routeTypes: readonly AppRouteTypeValue[];
  /** Direction(s) this board covers (see {@link TransitDisplayMeta.directions}). */
  directions: readonly (0 | 1 | 'none')[];
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
 * Clusters candidates by route type, per the grouping strategy:
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
 * Groups candidates into boards: clusters them by route type (per
 * `routeGrouping`), optionally by direction of travel (when `splitByDirection`),
 * then by category, yielding one board per non-empty cell.
 *
 * A trip's `routeDirection.direction` (which mirrors GTFS `direction_id` where
 * the source provides it) is route-local and arbitrary across routes, so a
 * caller that wants direction split for some modes but not others (e.g. trains
 * yes, buses no) composes it by calling with different `routeGrouping` /
 * `splitByDirection` and merging the results, rather than having a per-mode rule
 * baked in here.
 *
 * Grouping only: it does not sort / cap ({@link sortAndCapBoards}) or resolve
 * display names ({@link toTransitDisplayData}). Empty cells are dropped, so the
 * present route types / directions fall out without a separate enumeration.
 */
export function groupCandidatesIntoBoards(
  candidates: readonly TransitDisplayCandidate[],
  condition: TransitDisplayCondition,
): TransitDisplayBoard[] {
  const clusters = clusterCandidatesByRouteType(candidates, condition.routeGrouping);
  const boards: TransitDisplayBoard[] = [];

  for (const cluster of clusters) {
    if (!condition.splitByDirection) {
      // Not split: one board per category, covering the directions present.
      for (const category of CATEGORIES) {
        const boardCandidates = cluster.candidates.filter((c) =>
          categoryQualifies(c.entry, category),
        );
        if (boardCandidates.length === 0) {
          continue;
        }
        boards.push({
          routeTypes: cluster.routeTypes,
          directions: presentDirections(boardCandidates),
          category,
          candidates: boardCandidates,
        });
      }
      continue;
    }

    // Split: one board per (category, direction) bucket. Category-major
    // (departures, then arrivals) so a board's departures always precede its
    // arrivals -- e.g. at a terminus where one direction is arrivals-only and
    // another is departures-only, the departures still list first. Empty buckets
    // are skipped.
    for (const category of CATEGORIES) {
      for (const direction of DIRECTIONS) {
        const boardCandidates = cluster.candidates.filter(
          (c) =>
            c.entry.routeDirection.direction === direction && categoryQualifies(c.entry, category),
        );
        if (boardCandidates.length === 0) {
          continue;
        }
        const directions: readonly (0 | 1 | 'none')[] = [direction ?? 'none'];
        boards.push({
          routeTypes: cluster.routeTypes,
          directions,
          category,
          candidates: boardCandidates,
        });
      }
    }
  }

  return boards;
}

/**
 * Orders each board's candidates earliest-first by its category's time and caps
 * to `maxEntries`. Operates per board; the grouping is already done.
 */
export function sortAndCapBoards(
  boards: readonly TransitDisplayBoard[],
  maxEntries: number,
): TransitDisplayBoard[] {
  return boards.map((board) => {
    // sort by the category's time (category-dependent)
    const sorted = sortByCategory(board.candidates, board.category);
    // cap: keep the earliest maxEntries (slice is non-mutating, expects sorted input)
    return { ...board, candidates: sorted.slice(0, maxEntries) };
  });
}

/**
 * Turns one board into UI data -- assembles its `meta`
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
      directions: board.directions,
      max: maxEntries,
      radius: radiusMeters,
    },
    data: buildTransitDisplayEntryData(board.candidates, preferredDisplayLangs, board.category),
  };
}

/**
 * Runs the board-building steps in sequence: distance filter -> flatten ->
 * group into boards (route-type / category clustering) -> sort + cap -> UI
 * convert. Each step is single-purpose so the next one's concern does not leak
 * into it.
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
  // distance filter: stops within radiusMeters of the center
  const nearbyStops = filterStopsWithinRadius(stops, radiusMeters);
  // flatten each stop's stopTimes into candidates
  const candidates = toTransitDisplayCandidates(nearbyStops);
  // cluster by route type, optionally by direction, then split by category
  const boards = groupCandidatesIntoBoards(candidates, condition);
  // sort by time, cap each board
  const cappedBoards = sortAndCapBoards(boards, condition.maxEntries);
  // resolve display names, build UI data
  return cappedBoards.map((board) =>
    toTransitDisplayData(board, preferredDisplayLangs, radiusMeters, condition.maxEntries),
  );
}
