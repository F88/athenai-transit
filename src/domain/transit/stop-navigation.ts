import type { StopReferenceSnapshot } from '../../types/app/stop-reference-snapshot';
import type { AppRouteTypeValue, Stop } from '../../types/app/transit';
import type { StopWithMeta } from '../../types/app/transit-composed';
import type { LangChain } from './i18n/resolve-lang-chain';
import { resolveStopRouteTypes } from './resolve-stop-route-types';
import { buildHistorySelectionStop, type StopHistoryEntry } from './stop-history';
import { createStopReferenceSnapshot } from './stop-reference-snapshot';

/**
 * Build a `StopReferenceSnapshot` from live `StopWithMeta`.
 *
 * Wraps the two-step "resolve routeTypes from the route map plus the
 * meta's own routes, then create snapshot" pattern that originated
 * inline in `App` and inside `buildHistoryNavigationPayload`. Used
 * whenever the caller already has the live metadata (anchor map,
 * history map, viewport lookup, or repository fetch) and wants the
 * canonical snapshot for persistence / navigation.
 *
 * `unknownPolicy: 'include-unknown'` matches the historical inline
 * call sites: stops whose route_type cannot be classified are kept,
 * not dropped, so the snapshot still records something.
 */
export function buildSelectionSnapshotFromMeta(
  stopMeta: StopWithMeta,
  routeTypeMap: ReadonlyMap<string, AppRouteTypeValue[]>,
  dataLang: LangChain,
): StopReferenceSnapshot {
  const routeTypes = resolveStopRouteTypes({
    stopId: stopMeta.stop.stop_id,
    routeTypeMap,
    routes: stopMeta.routes,
    unknownPolicy: 'include-unknown',
  });
  return createStopReferenceSnapshot(stopMeta, routeTypes, dataLang);
}

/**
 * Build a `StopReferenceSnapshot` from a bare `Stop` (no live meta).
 *
 * Used by selection flows whose only handle on a stop is the `Stop`
 * itself (e.g. when a viewport lookup misses but the caller still has
 * the click target), where there is no `StopWithMeta.routes` to feed
 * to `resolveStopRouteTypes`. Passes an empty `routes` array so the
 * resolver leans entirely on the route-type map for the stop id.
 *
 * The resulting snapshot has `agencyNames: []` because
 * `createStopReferenceSnapshot` only resolves agency names when the
 * argument carries `agencies` (i.e. is a `StopWithMeta`).
 */
export function buildSelectionSnapshotFromStop(
  stop: Stop,
  routeTypeMap: ReadonlyMap<string, AppRouteTypeValue[]>,
  dataLang: LangChain,
): StopReferenceSnapshot {
  const routeTypes = resolveStopRouteTypes({
    stopId: stop.stop_id,
    routeTypeMap,
    routes: [],
    unknownPolicy: 'include-unknown',
  });
  return createStopReferenceSnapshot(stop, routeTypes, dataLang);
}

export interface HistoryNavigationPayload {
  stop: Stop;
  snapshot: StopReferenceSnapshot;
}

export function buildHistoryNavigationPayload(
  stopHistoryEntry: StopHistoryEntry,
  routeTypeMap: ReadonlyMap<string, AppRouteTypeValue[]>,
  dataLang: LangChain,
  lookupHistoryStopMeta: (stopId: string) => StopWithMeta | null,
): HistoryNavigationPayload | null {
  const stopMeta = lookupHistoryStopMeta(stopHistoryEntry.snapshot.stopId);

  if (stopMeta != null) {
    return {
      stop: stopMeta.stop,
      snapshot: buildSelectionSnapshotFromMeta(stopMeta, routeTypeMap, dataLang),
    };
  }

  // create a minimal Stop from the snapshot
  const minimalStop = buildHistorySelectionStop(stopHistoryEntry);

  if (minimalStop == null) {
    return null;
  }

  return {
    stop: minimalStop,
    snapshot: stopHistoryEntry.snapshot,
  };
}
