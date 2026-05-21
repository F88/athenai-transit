import { resolveStopRouteTypes } from './resolve-stop-route-types';
import { buildHistorySelectionStop, type StopHistoryEntry } from './stop-history';
import type { AppRouteTypeValue, Stop } from '../../types/app/transit';
import type { StopWithMeta } from '../../types/app/transit-composed';

export type HistorySelectionAction =
  | {
      type: 'ignore';
    }
  | {
      type: 'resolved';
      source: 'snapshot';
      stop: Stop;
      routeTypes: readonly AppRouteTypeValue[];
    }
  | {
      type: 'resolved';
      source: 'meta';
      stop: Stop;
      routeTypes: readonly AppRouteTypeValue[];
    };

export function resolveHistorySelectionAction(args: {
  entry: StopHistoryEntry;
  stopMeta: StopWithMeta | null;
  routeTypeMap: ReadonlyMap<string, AppRouteTypeValue[]>;
}): HistorySelectionAction {
  const { entry, stopMeta, routeTypeMap } = args;

  if (stopMeta !== null) {
    const stop = stopMeta.stop;
    const routeTypes = resolveStopRouteTypes({
      stopId: stop.stop_id,
      routeTypeMap,
      routes: stopMeta.routes,
      unknownPolicy: 'include-unknown',
    });
    return {
      type: 'resolved',
      source: 'meta',
      stop,
      routeTypes,
    };
  }

  // create a minimal Stop from the snapshot
  const minimalStop = buildHistorySelectionStop(entry);

  if (minimalStop != null) {
    const routeTypes = entry.snapshot.routeTypes;
    return {
      type: 'resolved',
      source: 'snapshot',
      stop: minimalStop,
      routeTypes,
    };
  }

  return { type: 'ignore' };
}
