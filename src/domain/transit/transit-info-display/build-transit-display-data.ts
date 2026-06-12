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
import { isArrival, isDeparture } from '../timetable-entry-for-passenger';

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
  // [IMPORTANT] Use domain logic to determine boardability / alightability.

  if (category === 'departures') {
    // [IMPORTANT] Use domain logic.
    // A departures board lists trips you can actually leave on -- see
    // isDeparture: boardable per the signal and not the pattern's last stop
    // (the trip ends there; excludes boarding-prohibited stops such as the
    // drop-off-only stop just before a terminus).
    return isDeparture(timetableEntry);
  }
  // [IMPORTANT] Use domain logic.
  // An arrivals board lists trips you can alight from here -- see isArrival:
  // alightable per the signal and not the pattern's first stop (the trip
  // starts there; excludes pickup-only legs such as the boarding leg of a
  // turn-around / boarding-swap stop).
  return isArrival(timetableEntry);
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

/**
 * One direction bucket for {@link groupCandidatesIntoBoards}: which candidates
 * belong to it (`matches`) and how to label the resulting board's `directions`
 * (`directionsOf`). Not split = a single bucket spanning all present directions;
 * split = one bucket per direction value. Modeling both as a list lets the
 * category / filter / skip / push logic run once instead of being duplicated.
 */
interface DirectionGroup {
  matches: (candidate: TransitDisplayCandidate) => boolean;
  directionsOf: (selected: readonly TransitDisplayCandidate[]) => readonly (0 | 1 | 'none')[];
}

/**
 * Clusters candidates by route type, per the grouping strategy. `effectiveRouteTypes`
 * is the set of route types eligible to appear -- typically the route types served
 * by the nearby stops -- so a board's `routeTypes` reflect what the stops offer. It
 * is intersected with `ROUTE_TYPE_DISPLAY_ORDER` for ordering and dedup.
 *
 * - `route`: one cluster per eligible route type (display order); an eligible type
 *   with no candidates yields an empty cluster.
 * - `none`: a single cluster of all candidates; its `routeTypes` are the eligible
 *   types in display order.
 * - `custom`: one cluster per caller-supplied group, in the given order. Each
 *   cluster's `routeTypes` are the group's eligible types (group order preserved,
 *   not display order), and a group with no eligible type is dropped. Groups may
 *   overlap -- each cluster independently keeps the candidates whose route type is
 *   in its group, so a route type listed in two groups appears on both boards.
 *
 * Eligibility only constrains which route types form clusters and how they are
 * labelled; empty clusters are NOT turned into boards --
 * {@link groupCandidatesIntoBoards} drops empty category cells.
 *
 * Clustering is lossy, so the caller chooses the strategy via the condition.
 */
export function clusterCandidatesByRouteType(
  candidates: readonly TransitDisplayCandidate[],
  grouping: TransitDisplayRouteGrouping,
  effectiveRouteTypes: readonly AppRouteTypeValue[],
): RouteTypeCluster[] {
  // Eligible route types in display order (those served by the stops).
  const eligibleRouteTypes = ROUTE_TYPE_DISPLAY_ORDER.filter((rt) =>
    effectiveRouteTypes.includes(rt),
  );

  if (grouping.kind === 'route') {
    return eligibleRouteTypes.map((routeType) => ({
      routeTypes: [routeType],
      candidates: selectByRouteType(candidates, routeType),
    }));
  }

  if (grouping.kind === 'none') {
    return [{ routeTypes: eligibleRouteTypes, candidates: [...candidates] }];
  }

  // 'custom': one cluster per group (groups may overlap). Keep each group's own
  // order for routeTypes (eligible types only), so the caller's order is honored.
  const eligibleSet = new Set<number>(eligibleRouteTypes);
  return grouping.groups
    .map((group) => {
      const groupSet = new Set<number>(group);
      return {
        routeTypes: group.filter((routeType) => eligibleSet.has(routeType)),
        candidates: candidates.filter((c) =>
          groupSet.has(c.timetableEntry.routeDirection.route.route_type),
        ),
      };
    })
    .filter((cluster) => cluster.routeTypes.length > 0);
}

/**
 * Groups candidates into boards: derives the eligible route types from `stops`
 * (each stop's `routeTypes`, independent of whether trips remain), clusters
 * candidates by route type (per `routeGrouping`), optionally by direction of
 * travel (when `splitByDirection`), then by category, yielding one board per
 * non-empty cell.
 *
 * `stops` are the (already distance-filtered) nearby stops. As a guard it returns
 * no boards when there are no stops, or none are in service today -- the same
 * empty cases the caller surfaces via {@link resolveTransitDisplayState}.
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
  stops: readonly StopWithContext[],
): TransitDisplayData[] {
  // Nothing to show when there are no stops, or none are in service today.
  if (stops.length === 0 || stops.every((stop) => stop.stopServiceState === 'no-service')) {
    return [];
  }

  // Route types served by the stops (from each stop's `routeTypes`, independent
  // of whether any trips remain), in display order -- so a board's routeTypes
  // reflect what the stops offer.
  const effectiveRouteTypes: readonly AppRouteTypeValue[] = ROUTE_TYPE_DISPLAY_ORDER.filter(
    (routeType) => stops.some((stop) => stop.routeTypes.includes(routeType)),
  );

  const clusters = clusterCandidatesByRouteType(
    candidates,
    condition.routeGrouping,
    effectiveRouteTypes,
  );

  const boards: TransitDisplayData[] = [];

  // Direction buckets: not split = a single bucket spanning all present
  // directions; split = one bucket per direction. Category-major iteration
  // (departures, then arrivals) keeps a board's departures before its arrivals,
  // e.g. at a terminus where one direction is arrivals-only and another is
  // departures-only. Empty cells are skipped.
  const directionGroups: readonly DirectionGroup[] = condition.splitByDirection
    ? DIRECTIONS.map((direction) => ({
        matches: (c) => c.timetableEntry.routeDirection.direction === direction,
        directionsOf: () => [direction ?? 'none'],
      }))
    : [{ matches: () => true, directionsOf: presentDirections }];

  for (const cluster of clusters) {
    for (const category of CATEGORIES) {
      for (const group of directionGroups) {
        const boardCandidates = cluster.candidates.filter(
          (c) => group.matches(c) && categoryQualifies(c.timetableEntry, category),
        );

        if (boardCandidates.length === 0) {
          continue;
        }

        boards.push({
          routeTypes: cluster.routeTypes,
          directions: group.directionsOf(boardCandidates),
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
 * then attaches each display's `meta` descriptor and derived `stats`. Each step
 * is single-purpose so the next one's concern does not leak into it.
 *
 * Returns an empty array when no boards result -- e.g. no stops within the radius,
 * none in service today, or no candidate qualifies for any cell (see
 * {@link groupCandidatesIntoBoards}); the caller decides the empty-state UI (see
 * {@link resolveTransitDisplayState}).
 *
 * Rows are intentionally left RAW: the returned `data` holds the structural
 * board, not resolved UI rows. Resolving display names / times into UI data is
 * the caller's choice, so this stays i18n-free and the UI owns rendering. Each
 * display also carries {@link TransitDisplayStats} (radius-scope stop stats plus
 * the per-board pre-cap entry stats) that cannot be recovered from the capped rows.
 *
 * `radiusMeters` (the range stops are selected within; also each display's
 * `meta.radius`) and `condition` (the per-display selection condition) are both
 * required so the caller states the selection scope explicitly.
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
  const boards: TransitDisplayData[] = groupCandidatesIntoBoards(
    candidates,
    condition,
    nearbyStops,
  );

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

export type TransitDisplayStopsState = 'ready' | 'no-stops' | 'no-service';
export type TransitDisplayStatus = {
  radius: number;
  state: TransitDisplayStopsState;
};

export function resolveTransitDisplayState(
  stops: readonly StopWithContext[],
): TransitDisplayStopsState {
  if (stops.length === 0) {
    return 'no-stops';
  }
  if (stops.every((stop) => stop.stopServiceState === 'no-service')) {
    return 'no-service';
  }
  return 'ready';
}
