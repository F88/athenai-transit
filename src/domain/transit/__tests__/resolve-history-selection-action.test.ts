import { describe, expect, it } from 'vitest';
import { makeRoute, makeStop, makeStopMeta } from '../../../__tests__/helpers';
import type { StopHistoryEntry } from '../stop-history';
import { resolveHistorySelectionAction } from '../resolve-history-selection-action';

function makeEntry(): StopHistoryEntry {
  return {
    snapshot: {
      stopId: 'A',
      name: 'Snapshot A',
      lat: 35,
      lon: 139,
      routeTypes: [3],
      agencyNames: ['Agency A'],
      platformCode: '1',
    },
    selectedAt: 1000,
  };
}

describe('resolveHistorySelectionAction', () => {
  it('returns refresh-from-meta when current stop metadata is available', () => {
    const latestStop = makeStop('A', 36, 140);
    const stopMeta = {
      ...makeStopMeta(latestStop),
      routes: [makeRoute('route-1', 1), makeRoute('route-2', 3)],
    };

    const result = resolveHistorySelectionAction({
      entry: makeEntry(),
      stopMeta,
      routeTypeMap: new Map<string, (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 11 | 12 | -1)[]>([
        ['A', [1, 3]],
      ]),
    });

    expect(result).toEqual({
      type: 'resolved',
      source: 'meta',
      stop: latestStop,
      routeTypes: [1, 3],
    });
  });

  it('returns reuse-snapshot when current stop metadata is unavailable', () => {
    const entry = makeEntry();

    const result = resolveHistorySelectionAction({
      entry,
      stopMeta: null,
      routeTypeMap: new Map(),
    });

    expect(result).toEqual({
      type: 'resolved',
      source: 'snapshot',
      stop: {
        stop_id: 'A',
        stop_name: 'Snapshot A',
        stop_names: {},
        stop_lat: 35,
        stop_lon: 139,
        location_type: 0,
        agency_id: '',
        platform_code: '1',
      },
      routeTypes: [3],
    });
  });

  it('returns ignore when the stored snapshot cannot rebuild a fallback stop', () => {
    const result = resolveHistorySelectionAction({
      entry: {
        snapshot: {
          stopId: 'A',
          name: 'Snapshot A',
          lat: null,
          lon: null,
          routeTypes: [3],
          agencyNames: ['Agency A'],
        },
        selectedAt: 1000,
      },
      stopMeta: null,
      routeTypeMap: new Map(),
    });

    expect(result).toEqual({ type: 'ignore' });
  });
});
