import type { StopReferenceSnapshot } from '../../types/app/stop-reference-snapshot';
import type { AppRouteTypeValue, Stop } from '../../types/app/transit';
import type { StopWithMeta } from '../../types/app/transit-composed';
import type { LangChain } from './i18n/resolve-lang-chain';
import { resolveStopRouteTypes } from './resolve-stop-route-types';
import {
  buildHistorySelectionStop,
  createStopReferenceSnapshot,
  type StopHistoryEntry,
} from './stop-history';

export interface HistoryNavigationPayload {
  stop: Stop;
  snapshot: StopReferenceSnapshot;
}

export function findNavigableStopMeta(
  stopId: string,
  radiusStops: readonly StopWithMeta[],
  inBoundStops: readonly StopWithMeta[],
): StopWithMeta | null {
  return (
    radiusStops.find((stopMeta) => stopMeta.stop.stop_id === stopId) ??
    inBoundStops.find((stopMeta) => stopMeta.stop.stop_id === stopId) ??
    null
  );
}

export function resolveNavigableStopMeta(
  stopId: string,
  radiusStops: readonly StopWithMeta[],
  inBoundStops: readonly StopWithMeta[],
  fallbackStop?: Stop,
): StopWithMeta | null {
  return (
    findNavigableStopMeta(stopId, radiusStops, inBoundStops) ??
    (fallbackStop ? { stop: fallbackStop, agencies: [], routes: [] } : null)
  );
}

export function buildHistoryNavigationPayload(
  stopHistoryEntry: StopHistoryEntry,
  routeTypeMap: ReadonlyMap<string, AppRouteTypeValue[]>,
  dataLang: LangChain,
  lookupHistoryStopMeta: (stopId: string) => StopWithMeta | null,
): HistoryNavigationPayload | null {
  const stopMeta = lookupHistoryStopMeta(stopHistoryEntry.snapshot.stopId);

  if (stopMeta != null) {
    const stop = stopMeta.stop;
    const routeTypes = resolveStopRouteTypes({
      stopId: stop.stop_id,
      routeTypeMap,
      routes: stopMeta.routes,
      unknownPolicy: 'include-unknown',
    });
    const snapshot = createStopReferenceSnapshot(stopMeta, routeTypes, dataLang);
    return {
      stop,
      snapshot,
    };
  }

  // create a minimal Stop from the snapshot
  const minimalStop = buildHistorySelectionStop(stopHistoryEntry);

  if (minimalStop == null) {
    return null;
  }

  const routeTypes = stopHistoryEntry.snapshot.routeTypes;
  const snapshot = createStopReferenceSnapshot(minimalStop, routeTypes, dataLang);
  return {
    stop: minimalStop,
    snapshot,
  };
}
