import type { InfoLevel } from '../../../types/app/settings';
import type { AppRouteTypeValue } from '../../../types/app/transit';
import type {
  ContextualTimetableEntry,
  StopWithContext,
} from '../../../types/app/transit-composed';
import { ROUTE_TYPE_DISPLAY_ORDER } from '../route-type-display-order';
import { minutesToDate } from '../calendar-utils';
import { computeStopWithMetaStats, type StopWithMetaStats } from '../compute-stop-with-meta-stats';
import { filterStopsWithinDistance } from '../stop-meta-filter';
import {
  computeTransitDisplayDatumStats,
  type TransitDisplayDatumStats,
} from '../compute-transit-display-datum-stats';
import { getTimetableEntryAttributes } from '../timetable-entry-attributes';

/**
 * Per-board row cap by info level: terser levels show fewer departures, the
 * more detailed levels show more. Used as the `maxEntries` passed to
 * {@link buildTransitDisplayDataSet}.
 */
const MAX_ENTRIES_BY_INFO_LEVEL: Record<InfoLevel, number> = {
  simple: 20,
  normal: 20,
  detailed: 20,
  verbose: 20,
  // verbose: 10,
};

/** Resolves the per-board row cap for the given info level. */
export function transitDisplayMaxEntriesFor(infoLevel: InfoLevel): number {
  return MAX_ENTRIES_BY_INFO_LEVEL[infoLevel];
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

/**
 * One board's cell: which route type(s), direction(s) and category it is, plus
 * the entries selected for it in `data` ({@link TransitDisplayDatum}). These are
 * raw stop events (not resolved UI rows), so the same shape flows through
 * grouping, sort + cap, and UI conversion without those concerns leaking into
 * each other.
 */
export interface TransitDisplayData {
  routeTypes: readonly AppRouteTypeValue[];
  /** Direction(s) this board covers (see {@link TransitDisplayMeta.directions}). */
  directions: readonly (0 | 1 | 'none')[];
  category: TransitDisplayCategory;
  data: TransitDisplayDatum[];
}

/** A cluster of candidates for one board's route-type scope, before the category split. */
export interface RouteTypeCluster {
  routeTypes: readonly AppRouteTypeValue[];
  candidates: TransitDisplayCandidate[];
}

/**
 * Derived aggregate stats attached to one display, kept because they cannot be
 * recovered from the capped rows in `data`. Two scopes:
 * - `stopsInRadius`: dataset-level (all stops within the board's radius; the same
 *   value on every board of one build, like {@link TransitDisplayMeta.radius}).
 * - `qualifying`: per-board, the pre-cap ("qualifying") entry stats; consumers
 *   compare it against the rendered rows to detect truncation.
 */
export interface TransitDisplayStats {
  /** Stats for ALL stops within the board's radius (dataset-level). */
  stopsInRadius: StopWithMetaStats;
  /** Pre-cap stats of the board's entries (per-board). */
  qualifying: TransitDisplayDatumStats;
}

/**
 * A display: its {@link TransitDisplayMeta} descriptor, the structural board it
 * describes in `data`, and the derived {@link TransitDisplayStats}. `meta`
 * restates the board's category / routeTypes / directions and adds `max` /
 * `radius`.
 */
export interface TransitDisplayDataWithMetaData {
  /** Display descriptor (title + selection params). */
  meta: TransitDisplayMeta;
  /** The structural board this display describes. */
  data: TransitDisplayData;
  /** Derived aggregate stats (radius-scope + per-board pre-cap). */
  stats: TransitDisplayStats;
}

/** One stop event paired with the stop context it came from, before name resolution. */
export interface TransitDisplayCandidate {
  timetableEntry: ContextualTimetableEntry;
  stop: StopWithContext;
}

/**
 * One entry selected onto a board by {@link groupCandidatesIntoBoards} -- a
 * {@link TransitDisplayCandidate} that passed category qualification. Same shape
 * as a candidate; this alias marks the post-selection role (it is output, no
 * longer a mere candidate) and reads as the singular of a board's `data`.
 */
export type TransitDisplayDatum = TransitDisplayCandidate;

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

/**
 * Service-day minutes an entry is sorted and shown by, derived from the board's
 * category: an arrivals board uses arrival time (even for intermediate,
 * non-terminal stops); a departures board uses departure time.
 */
export function categoryMinutes(
  timetableEntry: ContextualTimetableEntry,
  category: TransitDisplayCategory,
): number {
  return category === 'arrivals'
    ? timetableEntry.schedule.arrivalMinutes
    : timetableEntry.schedule.departureMinutes;
}

/**
 * Whether an entry belongs on the given category's board, using signboard
 * semantics specific to this Transit Board: a departures board lists trips you
 * can board here (and that continue past here), an arrivals board lists trips you
 * can alight here. Other views still show the data as-is; only this board applies
 * the boardable / alightable rule.
 */
export function categoryQualifies(
  timetableEntry: ContextualTimetableEntry,
  category: TransitDisplayCategory,
): boolean {
  // [IMPORTANT] Use domain logic to determine the starting/ending point.
  const attributes = getTimetableEntryAttributes(timetableEntry);

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
 * Flattens every stop's `stopTimes` into candidates, each paired with its source
 * stop context: the single candidate type the selectors below operate on.
 */
export function toTransitDisplayCandidates(
  stops: readonly StopWithContext[],
): TransitDisplayCandidate[] {
  return stops.flatMap((stop) =>
    stop.stopTimes.map((timetableEntry) => ({ timetableEntry, stop })),
  );
}

/** Keeps only candidates whose event runs on `routeType`. */
export function selectByRouteType(
  candidates: readonly TransitDisplayCandidate[],
  routeType: AppRouteTypeValue,
): TransitDisplayCandidate[] {
  return candidates.filter((c) => c.timetableEntry.routeDirection.route.route_type === routeType);
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
      minutesToDate(
        a.timetableEntry.serviceDate,
        categoryMinutes(a.timetableEntry, category),
      ).getTime() -
      minutesToDate(
        b.timetableEntry.serviceDate,
        categoryMinutes(b.timetableEntry, category),
      ).getTime(),
  );
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
  const present = new Set(candidates.map((c) => c.timetableEntry.routeDirection.direction));
  return DIRECTIONS.filter((direction) => present.has(direction)).map(
    (direction) => direction ?? 'none',
  );
}

/** Present route types among candidates, in `ROUTE_TYPE_DISPLAY_ORDER`. */
function presentRouteTypesInDisplayOrder(
  candidates: readonly TransitDisplayCandidate[],
): AppRouteTypeValue[] {
  const present = new Set(candidates.map((c) => c.timetableEntry.routeDirection.route.route_type));
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
      candidates: candidates.filter((c) =>
        groupSet.has(c.timetableEntry.routeDirection.route.route_type),
      ),
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
 * Grouping only: it does not sort / cap ({@link sortAndCapTransitDisplayData}) or resolve
 * display names ({@link buildTransitDisplayDatumForUi}). Empty cells are dropped, so the
 * present route types / directions fall out without a separate enumeration.
 */
export function groupCandidatesIntoBoards(
  candidates: readonly TransitDisplayCandidate[],
  condition: TransitDisplayCondition,
): TransitDisplayData[] {
  const clusters = clusterCandidatesByRouteType(candidates, condition.routeGrouping);
  const boards: TransitDisplayData[] = [];

  for (const cluster of clusters) {
    if (!condition.splitByDirection) {
      // Not split: one board per category, covering the directions present.
      for (const category of CATEGORIES) {
        const boardCandidates = cluster.candidates.filter((c) =>
          categoryQualifies(c.timetableEntry, category),
        );

        console.debug(
          `Board candidates for route types ${cluster.routeTypes.join(',')}, category ${category}, no direction split: ${boardCandidates.length}`,
        );

        if (boardCandidates.length === 0) {
          continue;
        }
        boards.push({
          routeTypes: cluster.routeTypes,
          directions: presentDirections(boardCandidates),
          category,
          data: boardCandidates,
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
            c.timetableEntry.routeDirection.direction === direction &&
            categoryQualifies(c.timetableEntry, category),
        );

        console.debug(
          `Board candidates for route types ${cluster.routeTypes.join(',')}, category ${category}, direction ${
            direction ?? 'none'
          }: ${boardCandidates.length}`,
        );

        if (boardCandidates.length === 0) {
          continue;
        }
        const directions: readonly (0 | 1 | 'none')[] = [direction ?? 'none'];
        boards.push({
          routeTypes: cluster.routeTypes,
          directions,
          category,
          data: boardCandidates,
        });
      }
    }
  }

  return boards;
}

/**
 * Orders each board's entries (its `data`) earliest-first by its category's
 * time and caps to `maxEntries`. Operates per board; the grouping is already done.
 */
export function sortAndCapTransitDisplayData(
  transitDisplayData: readonly TransitDisplayData[],
  maxEntries: number,
): TransitDisplayData[] {
  return transitDisplayData.map((data) => {
    // sort by the category's time (category-dependent)
    const sorted = sortByCategory(data.data, data.category);
    // cap: keep the earliest maxEntries (slice is non-mutating, expects sorted input)
    return { ...data, data: sorted.slice(0, maxEntries) };
  });
}

/**
 * Runs the structural board-building steps in sequence: distance filter ->
 * flatten -> group into boards (route-type / category clustering) -> sort + cap,
 * then attaches each display's `meta` descriptor. Each step is single-purpose so
 * the next one's concern does not leak into it.
 *
 * Rows are intentionally left RAW: the returned `data` holds the structural
 * board, not resolved UI rows. Resolving display names / times into UI data is
 * the caller's choice, so this stays i18n-free and the UI owns rendering.
 *
 * `radiusMeters` (the range stops are selected within; also each display's
 * `meta.radius`) and `condition` (the per-display selection condition) are both
 * required so the caller states the selection scope explicitly.
 * {@link NEARBY_RADIUS_M} is the conventional radius to pass.
 */
export function buildTransitDisplayDataSet(
  stops: readonly StopWithContext[],
  radiusMeters: number,
  condition: TransitDisplayCondition,
): TransitDisplayDataWithMetaData[] {
  // distance filter: stops within radiusMeters of the center
  const nearbyStops: StopWithContext[] = filterStopsWithinDistance(stops, radiusMeters);
  // flatten each stop's stopTimes into candidates
  const candidates: TransitDisplayCandidate[] = toTransitDisplayCandidates(nearbyStops);
  // cluster by route type, optionally by direction, then split by category
  const boards: TransitDisplayData[] = groupCandidatesIntoBoards(candidates, condition);
  // sort by time, cap each board
  const sortedAndCapped: TransitDisplayData[] = sortAndCapTransitDisplayData(
    boards,
    condition.maxEntries,
  );

  // Dataset-level stats for all stops in radius (computed once, shared by every
  // board). Includes service-less stops, so it cannot be derived from the capped
  // per-board rows.
  const stopsInRadius = computeStopWithMetaStats(nearbyStops);

  // sortAndCapTransitDisplayData maps `boards` in order, so sortedAndCapped[i]
  // corresponds to boards[i]; the pre-cap ("qualifying") stats come from boards[i].
  const dataWithMetaData: TransitDisplayDataWithMetaData[] = sortedAndCapped.map((data, i) => ({
    meta: {
      category: data.category,
      routeTypes: data.routeTypes,
      directions: data.directions,
      max: condition.maxEntries,
      radius: radiusMeters,
    },
    data: data,
    stats: {
      stopsInRadius,
      qualifying: computeTransitDisplayDatumStats(boards[i].data),
    },
  }));
  return dataWithMetaData;
}

/**
 * UI ordering for the raw displays (sorted on `meta`, before rows are resolved),
 * independent of how they were built or merged (the container concatenates a
 * no-split and a split call, so the raw order is not canonical). Three levels:
 *   1. route type, by `ROUTE_TYPE_DISPLAY_ORDER`
 *   2. within a route type: category, departures before arrivals
 *   3. within a category: direction, in `DIRECTIONS` order (none, 0, 1)
 *
 * A full comparator (not a stable sort on one key), so reordering by route type
 * can never disturb the departures/arrivals or direction order set up earlier.
 */
export function sortTransitDisplayDataWithMetaData(
  rawDisplays: readonly TransitDisplayDataWithMetaData[],
): TransitDisplayDataWithMetaData[] {
  const orderKey = (d: TransitDisplayDataWithMetaData): [number, number, number] => {
    const direction = d.meta.directions[0];
    return [
      ROUTE_TYPE_DISPLAY_ORDER.indexOf(d.meta.routeTypes[0]),
      CATEGORIES.indexOf(d.meta.category),
      DIRECTIONS.indexOf(direction === 'none' ? undefined : direction),
    ];
  };
  return [...rawDisplays].sort((a, b) => {
    const ka = orderKey(a);
    const kb = orderKey(b);
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
  });
}
