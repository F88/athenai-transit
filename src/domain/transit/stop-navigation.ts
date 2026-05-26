import type { StopReferenceSnapshot } from '../../types/app/stop-reference-snapshot';
import type { AppRouteTypeValue, Stop } from '../../types/app/transit';
import type { StopWithMeta } from '../../types/app/transit-composed';
import type { AnchorEntry } from '../portal/anchor';
import type { LangChain } from './i18n/resolve-lang-chain';
import { resolveStopRouteTypes } from './resolve-stop-route-types';
import type { StopHistoryEntry } from './stop-history';
import { createStopReferenceSnapshot } from './stop-reference-snapshot';

/**
 * Minimal persisted entry shape accepted by stop-navigation helpers.
 */
export interface SnapshotBackedStopEntry {
  /** Durable stop snapshot used for fallback navigation. */
  snapshot: StopReferenceSnapshot;
}

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

/**
 * Resolved stop target and snapshot used by selection flows.
 */
export interface StopNavigationPayload {
  stop: Stop;
  snapshot: StopReferenceSnapshot;
}

/**
 * Build a minimal Stop from a persisted stop snapshot.
 *
 * Used as the fallback navigation target when current repository
 * metadata is unavailable but the durable snapshot still has
 * coordinates.
 *
 * @param snapshot - Persisted stop snapshot.
 * @returns Minimal Stop for navigation, or null when coordinates are missing.
 */
export function buildFallbackStopFromSnapshot(snapshot: StopReferenceSnapshot): Stop | null {
  if (snapshot.lat === null || snapshot.lon === null) {
    return null;
  }

  return {
    stop_id: snapshot.stopId,
    stop_name: snapshot.name,
    stop_names: {},
    stop_lat: snapshot.lat,
    stop_lon: snapshot.lon,
    location_type: 0,
    agency_id: '',
    platform_code: snapshot.platformCode,
  };
}

/**
 * Resolve a durable stop reference into a navigation payload.
 *
 * The resolution strategy is shared by history and portal selection:
 * prefer current repository metadata when available, otherwise fall
 * back to the persisted snapshot.
 *
 * @param entry - Durable stop reference entry.
 * @param routeTypeMap - Route-type lookup used when rebuilding snapshots from live meta.
 * @param dataLang - Preferred display language chain.
 * @param lookupStopMeta - Live metadata lookup for the entry's stopId.
 * @returns Navigation payload, or null when neither live nor persisted coordinates can navigate.
 */
export function buildPersistedStopNavigationPayload(
  entry: SnapshotBackedStopEntry,
  routeTypeMap: ReadonlyMap<string, AppRouteTypeValue[]>,
  dataLang: LangChain,
  lookupStopMeta: (stopId: string) => StopWithMeta | null,
): StopNavigationPayload | null {
  const stopMeta = lookupStopMeta(entry.snapshot.stopId);

  if (stopMeta != null) {
    return {
      stop: stopMeta.stop,
      snapshot: buildSelectionSnapshotFromMeta(stopMeta, routeTypeMap, dataLang),
    };
  }

  const minimalStop = buildFallbackStopFromSnapshot(entry.snapshot);

  if (minimalStop == null) {
    return null;
  }

  return {
    stop: minimalStop,
    snapshot: entry.snapshot,
  };
}

/**
 * Resolve a history entry into a navigation payload.
 *
 * @param entry - Persisted history entry.
 * @param routeTypeMap - Route-type lookup used when rebuilding snapshots from live meta.
 * @param dataLang - Preferred display language chain.
 * @param lookupStopMeta - Live metadata lookup for the history entry's stopId.
 * @returns Navigation payload, or null when neither live nor persisted coordinates can navigate.
 */
export function buildHistoryNavigationPayload(
  entry: StopHistoryEntry,
  routeTypeMap: ReadonlyMap<string, AppRouteTypeValue[]>,
  dataLang: LangChain,
  lookupStopMeta: (stopId: string) => StopWithMeta | null,
): StopNavigationPayload | null {
  return buildPersistedStopNavigationPayload(entry, routeTypeMap, dataLang, lookupStopMeta);
}

/**
 * Resolve a portal anchor into a navigation payload.
 *
 * @param entry - Selected anchor entry.
 * @param routeTypeMap - Route-type lookup used when rebuilding snapshots from live meta.
 * @param dataLang - Preferred display language chain.
 * @param lookupStopMeta - Live metadata lookup for the anchor stopId.
 * @returns Navigation payload, or null when neither live nor persisted coordinates can navigate.
 */
export function buildPortalNavigationPayload(
  entry: AnchorEntry,
  routeTypeMap: ReadonlyMap<string, AppRouteTypeValue[]>,
  dataLang: LangChain,
  lookupStopMeta: (stopId: string) => StopWithMeta | null,
): StopNavigationPayload | null {
  return buildPersistedStopNavigationPayload(entry, routeTypeMap, dataLang, lookupStopMeta);
}
