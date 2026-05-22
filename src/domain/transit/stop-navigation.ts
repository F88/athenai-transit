import type { StopReferenceSnapshot } from '../../types/app/stop-reference-snapshot';
import type { AppRouteTypeValue, Stop } from '../../types/app/transit';
import type { StopWithMeta } from '../../types/app/transit-composed';
import type { LangChain } from './i18n/resolve-lang-chain';
import { resolveStopRouteTypes } from './resolve-stop-route-types';
import { buildHistorySelectionStop, type StopHistoryEntry } from './stop-history';
import { createStopReferenceSnapshot } from './stop-reference-snapshot';

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

  return {
    stop: minimalStop,
    snapshot: stopHistoryEntry.snapshot,
  };
}
