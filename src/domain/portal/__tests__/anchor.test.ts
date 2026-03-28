import { describe, it, expect } from 'vitest';
import {
  addAnchor,
  removeAnchor,
  updateAnchor,
  isAnchor,
  buildAnchorRefreshUpdates,
  MAX_ANCHOR_SIZE,
} from '../anchor';
import type { AnchorEntry } from '../anchor';
import type { RouteType } from '../../../types/app/transit';
import { makeStopMeta, makeRoute } from '../../../__tests__/helpers';
import type { StopWithMeta } from '../../../types/app/transit-composed';

function makeAnchorEntry(id: string, routeTypes: RouteType[] = [3], createdAt = 1000): AnchorEntry {
  return {
    stopId: id,
    stopName: `Stop ${id}`,
    stopLat: 35.0,
    stopLon: 139.0,
    routeTypes,
    createdAt,
  };
}

describe('addAnchor', () => {
  it('adds a stop to empty anchors', () => {
    const entry = {
      stopId: 'A',
      stopName: 'Stop A',
      stopLat: 35.0,
      stopLon: 139.0,
      routeTypes: [3 as RouteType],
    };
    const result = addAnchor([], entry, 1000);

    expect(result).toHaveLength(1);
    expect(result[0].stopId).toBe('A');
    expect(result[0].stopName).toBe('Stop A');
    expect(result[0].createdAt).toBe(1000);
  });

  it('prepends new entry to front', () => {
    const existing = [makeAnchorEntry('A')];
    const entry = {
      stopId: 'B',
      stopName: 'Stop B',
      stopLat: 35.1,
      stopLon: 139.1,
      routeTypes: [2 as RouteType],
    };
    const result = addAnchor(existing, entry, 2000);

    expect(result).toHaveLength(2);
    expect(result[0].stopId).toBe('B');
    expect(result[1].stopId).toBe('A');
  });

  it('returns same list when stop is already present', () => {
    const existing = [makeAnchorEntry('A'), makeAnchorEntry('B')];
    const entry = {
      stopId: 'A',
      stopName: 'Stop A',
      stopLat: 35.0,
      stopLon: 139.0,
      routeTypes: [3 as RouteType],
    };
    const result = addAnchor(existing, entry, 2000);

    expect(result).toBe(existing);
    expect(result).toHaveLength(2);
  });

  it('caps anchors at MAX_ANCHOR_SIZE', () => {
    const existing: AnchorEntry[] = [];
    for (let i = 0; i < MAX_ANCHOR_SIZE; i++) {
      existing.push(makeAnchorEntry(`s${i}`, [3], i));
    }

    const entry = {
      stopId: 'new',
      stopName: 'New',
      stopLat: 35.0,
      stopLon: 139.0,
      routeTypes: [3 as RouteType],
    };
    const result = addAnchor(existing, entry, 9999);

    expect(result).toHaveLength(MAX_ANCHOR_SIZE);
    expect(result[0].stopId).toBe('new');
    // Oldest entry (last in the original list) should be dropped
    expect(result.find((e) => e.stopId === `s${MAX_ANCHOR_SIZE - 1}`)).toBeUndefined();
  });

  it('does not mutate original anchors array', () => {
    const existing = [makeAnchorEntry('A')];
    const originalLength = existing.length;

    const entry = {
      stopId: 'B',
      stopName: 'Stop B',
      stopLat: 35.0,
      stopLon: 139.0,
      routeTypes: [3 as RouteType],
    };
    addAnchor(existing, entry, 2000);

    expect(existing).toHaveLength(originalLength);
  });

  it('preserves all anchor fields', () => {
    const entry = {
      stopId: 'X',
      stopName: 'Shibuya',
      stopLat: 35.658,
      stopLon: 139.702,
      routeTypes: [0, 3] as RouteType[],
    };
    const result = addAnchor([], entry, 5000);

    expect(result[0]).toEqual({
      stopId: 'X',
      stopName: 'Shibuya',
      stopLat: 35.658,
      stopLon: 139.702,
      routeTypes: [0, 3],
      createdAt: 5000,
    });
  });

  it('preserves portal field when provided', () => {
    const entry = {
      stopId: 'A',
      stopName: 'Stop A',
      stopLat: 35.0,
      stopLon: 139.0,
      routeTypes: [3 as RouteType],
      portal: 'my-group',
    };
    const result = addAnchor([], entry, 1000);

    expect(result[0].portal).toBe('my-group');
  });

  it('adds anchors with different portals independently', () => {
    let list: AnchorEntry[] = [];
    list = addAnchor(
      list,
      {
        stopId: 'A',
        stopName: 'A',
        stopLat: 35.0,
        stopLon: 139.0,
        routeTypes: [3],
        portal: 'group-1',
      },
      1000,
    );
    list = addAnchor(
      list,
      {
        stopId: 'B',
        stopName: 'B',
        stopLat: 35.1,
        stopLon: 139.1,
        routeTypes: [3],
        portal: 'group-2',
      },
      2000,
    );
    list = addAnchor(
      list,
      {
        stopId: 'C',
        stopName: 'C',
        stopLat: 35.2,
        stopLon: 139.2,
        routeTypes: [3],
        portal: 'group-1',
      },
      3000,
    );

    expect(list).toHaveLength(3);
    expect(list.filter((a) => a.portal === 'group-1')).toHaveLength(2);
    expect(list.filter((a) => a.portal === 'group-2')).toHaveLength(1);
  });
});

describe('removeAnchor', () => {
  it('removes an existing anchor by stopId', () => {
    const existing = [makeAnchorEntry('A'), makeAnchorEntry('B'), makeAnchorEntry('C')];
    const result = removeAnchor(existing, 'B');

    expect(result).toHaveLength(2);
    expect(result.find((e) => e.stopId === 'B')).toBeUndefined();
    expect(result[0].stopId).toBe('A');
    expect(result[1].stopId).toBe('C');
  });

  it('returns same-length list when stopId not found', () => {
    const existing = [makeAnchorEntry('A'), makeAnchorEntry('B')];
    const result = removeAnchor(existing, 'Z');

    expect(result).toHaveLength(2);
  });

  it('returns empty array when removing from empty list', () => {
    const result = removeAnchor([], 'A');
    expect(result).toHaveLength(0);
  });

  it('does not mutate original anchors array', () => {
    const existing = [makeAnchorEntry('A'), makeAnchorEntry('B')];
    const originalLength = existing.length;

    removeAnchor(existing, 'A');

    expect(existing).toHaveLength(originalLength);
  });

  it('removes only the target anchor, leaving other portals intact', () => {
    const existing: AnchorEntry[] = [
      { ...makeAnchorEntry('A'), portal: 'group-1' },
      { ...makeAnchorEntry('B'), portal: 'group-1' },
      { ...makeAnchorEntry('C'), portal: 'group-2' },
    ];
    const result = removeAnchor(existing, 'A');

    expect(result).toHaveLength(2);
    expect(result[0].stopId).toBe('B');
    expect(result[0].portal).toBe('group-1');
    expect(result[1].stopId).toBe('C');
    expect(result[1].portal).toBe('group-2');
  });
});

describe('updateAnchor', () => {
  it('updates stopName of an existing anchor', () => {
    const existing = [makeAnchorEntry('A'), makeAnchorEntry('B')];
    const result = updateAnchor(existing, {
      stopId: 'A',
      stopName: 'Updated Name',
      stopLat: 35.0,
      stopLon: 139.0,
      routeTypes: [3],
    });

    expect(result[0].stopName).toBe('Updated Name');
    expect(result[0].createdAt).toBe(1000); // preserved
    expect(result[1].stopId).toBe('B'); // unchanged
  });

  it('updates stopLat and stopLon', () => {
    const existing = [makeAnchorEntry('A')];
    const result = updateAnchor(existing, {
      stopId: 'A',
      stopName: 'Stop A',
      stopLat: 36.0,
      stopLon: 140.0,
      routeTypes: [3],
    });

    expect(result[0].stopLat).toBe(36.0);
    expect(result[0].stopLon).toBe(140.0);
  });

  it('updates routeTypes', () => {
    const existing = [makeAnchorEntry('A', [3])];
    const result = updateAnchor(existing, {
      stopId: 'A',
      stopName: 'Stop A',
      stopLat: 35.0,
      stopLon: 139.0,
      routeTypes: [0, 3],
    });

    expect(result[0].routeTypes).toEqual([0, 3]);
  });

  it('preserves existing portal when update omits portal', () => {
    const existing: AnchorEntry[] = [{ ...makeAnchorEntry('A'), portal: 'my-group' }];
    const result = updateAnchor(existing, {
      stopId: 'A',
      stopName: 'New Name',
      stopLat: 35.0,
      stopLon: 139.0,
      routeTypes: [3],
    });

    expect(result[0].portal).toBe('my-group');
    expect(result[0].stopName).toBe('New Name');
  });

  it('updates portal when provided', () => {
    const existing: AnchorEntry[] = [{ ...makeAnchorEntry('A'), portal: 'old-group' }];
    const result = updateAnchor(existing, {
      stopId: 'A',
      stopName: 'Stop A',
      stopLat: 35.0,
      stopLon: 139.0,
      routeTypes: [3],
      portal: 'new-group',
    });

    expect(result[0].portal).toBe('new-group');
  });

  it('returns same list when stopId not found', () => {
    const existing = [makeAnchorEntry('A')];
    const result = updateAnchor(existing, {
      stopId: 'Z',
      stopName: 'Unknown',
      stopLat: 35.0,
      stopLon: 139.0,
      routeTypes: [3],
    });

    expect(result).toBe(existing);
  });

  it('returns same list when nothing changed', () => {
    const existing = [makeAnchorEntry('A')];
    const result = updateAnchor(existing, {
      stopId: 'A',
      stopName: 'Stop A',
      stopLat: 35.0,
      stopLon: 139.0,
      routeTypes: [3],
    });

    expect(result).toBe(existing);
  });

  it('does not mutate original anchors array', () => {
    const existing = [makeAnchorEntry('A')];
    const originalName = existing[0].stopName;

    updateAnchor(existing, {
      stopId: 'A',
      stopName: 'Changed',
      stopLat: 35.0,
      stopLon: 139.0,
      routeTypes: [3],
    });

    expect(existing[0].stopName).toBe(originalName);
  });

  it('preserves createdAt from existing entry', () => {
    const existing = [makeAnchorEntry('A', [3], 5000)];
    const result = updateAnchor(existing, {
      stopId: 'A',
      stopName: 'New Name',
      stopLat: 36.0,
      stopLon: 140.0,
      routeTypes: [0, 3],
    });

    expect(result[0].createdAt).toBe(5000);
  });
});

describe('isAnchor', () => {
  it('returns true for an anchor that exists', () => {
    const anchors = [makeAnchorEntry('A'), makeAnchorEntry('B')];
    expect(isAnchor(anchors, 'A')).toBe(true);
  });

  it('returns false for a stop not in anchors', () => {
    const anchors = [makeAnchorEntry('A')];
    expect(isAnchor(anchors, 'Z')).toBe(false);
  });

  it('returns false for empty anchors', () => {
    expect(isAnchor([], 'A')).toBe(false);
  });
});

describe('buildAnchorRefreshUpdates', () => {
  it('builds updates for anchors with changed fields', () => {
    const anchors: AnchorEntry[] = [
      {
        stopId: 'A',
        stopName: 'Old A',
        stopLat: 35.0,
        stopLon: 139.0,
        routeTypes: [3],
        createdAt: 1000,
      },
      {
        stopId: 'B',
        stopName: 'Old B',
        stopLat: 35.1,
        stopLon: 139.1,
        routeTypes: [3],
        createdAt: 2000,
      },
    ];
    const metaA = makeStopMeta('A');
    metaA.stop.stop_name = 'New A';
    const metaB = makeStopMeta('B');
    metaB.stop.stop_name = 'New B';
    const metas: StopWithMeta[] = [
      { ...metaA, routes: [makeRoute('r1', 3)] },
      { ...metaB, routes: [makeRoute('r2', 0), makeRoute('r3', 3)] },
    ];

    const updates = buildAnchorRefreshUpdates(anchors, metas);

    expect(updates).toHaveLength(2);
    expect(updates[0].stopId).toBe('A');
    expect(updates[0].stopName).toBe('New A');
    expect(updates[1].stopId).toBe('B');
    expect(updates[1].routeTypes).toEqual([0, 3]);
  });

  it('skips anchors without matching meta', () => {
    const anchors: AnchorEntry[] = [
      {
        stopId: 'A',
        stopName: 'Old A',
        stopLat: 35.0,
        stopLon: 139.0,
        routeTypes: [3],
        createdAt: 1000,
      },
      makeAnchorEntry('Z', [3], 2000),
    ];
    const metaA = makeStopMeta('A');
    metaA.stop.stop_name = 'New A';
    const metas: StopWithMeta[] = [{ ...metaA, routes: [makeRoute('r1', 3)] }];

    const updates = buildAnchorRefreshUpdates(anchors, metas);

    expect(updates).toHaveLength(1);
    expect(updates[0].stopId).toBe('A');
  });

  it('returns empty array when metas is empty', () => {
    const anchors: AnchorEntry[] = [makeAnchorEntry('A')];
    const updates = buildAnchorRefreshUpdates(anchors, []);

    expect(updates).toEqual([]);
  });

  it('falls back to anchor routeTypes when meta has no routes but name changed', () => {
    const anchors: AnchorEntry[] = [
      {
        stopId: 'A',
        stopName: 'Old Name',
        stopLat: 35.0,
        stopLon: 139.0,
        routeTypes: [2],
        createdAt: 1000,
      },
    ];
    const metaA = makeStopMeta('A');
    metaA.stop.stop_name = 'New Name';
    const metas: StopWithMeta[] = [{ ...metaA, routes: [] }];

    const updates = buildAnchorRefreshUpdates(anchors, metas);

    expect(updates).toHaveLength(1);
    expect(updates[0].routeTypes).toEqual([2]);
    expect(updates[0].stopName).toBe('New Name');
  });

  it('deduplicates and sorts route types ascending', () => {
    const anchors: AnchorEntry[] = [makeAnchorEntry('A', [3], 1000)];
    const metas: StopWithMeta[] = [
      {
        ...makeStopMeta('A'),
        routes: [makeRoute('r1', 3), makeRoute('r2', 3), makeRoute('r3', 0)],
      },
    ];

    const updates = buildAnchorRefreshUpdates(anchors, metas);

    // Sorted ascending, consistent with stopRouteTypeMap in AthenaiRepositoryV2
    expect(updates[0].routeTypes).toEqual([0, 3]);
  });

  it('updates stopName and coordinates from meta', () => {
    const anchors: AnchorEntry[] = [
      {
        stopId: 'A',
        stopName: 'Old Name',
        stopLat: 35.0,
        stopLon: 139.0,
        routeTypes: [3],
        createdAt: 1000,
      },
    ];
    const meta = makeStopMeta('A');
    meta.stop.stop_name = 'New Name';
    meta.stop.stop_lat = 36.0;
    meta.stop.stop_lon = 140.0;
    const metas: StopWithMeta[] = [{ ...meta, routes: [makeRoute('r1', 3)] }];

    const updates = buildAnchorRefreshUpdates(anchors, metas);

    expect(updates[0].stopName).toBe('New Name');
    expect(updates[0].stopLat).toBe(36.0);
    expect(updates[0].stopLon).toBe(140.0);
  });

  it('returns empty array when anchors is empty', () => {
    const metas: StopWithMeta[] = [{ ...makeStopMeta('A'), routes: [makeRoute('r1', 3)] }];

    const updates = buildAnchorRefreshUpdates([], metas);

    expect(updates).toEqual([]);
  });

  it('returns empty array when nothing has changed', () => {
    const meta = makeStopMeta('A');
    const anchors: AnchorEntry[] = [
      {
        stopId: 'A',
        stopName: meta.stop.stop_name,
        stopLat: meta.stop.stop_lat,
        stopLon: meta.stop.stop_lon,
        routeTypes: [3],
        createdAt: 1000,
      },
    ];
    const metas: StopWithMeta[] = [{ ...meta, routes: [makeRoute('r1', 3)] }];

    const updates = buildAnchorRefreshUpdates(anchors, metas);

    expect(updates).toEqual([]);
  });

  it('includes only anchors with actual changes', () => {
    const metaA = makeStopMeta('A');
    const metaB = makeStopMeta('B');
    metaB.stop.stop_name = 'Updated B';
    const anchors: AnchorEntry[] = [
      {
        stopId: 'A',
        stopName: metaA.stop.stop_name,
        stopLat: metaA.stop.stop_lat,
        stopLon: metaA.stop.stop_lon,
        routeTypes: [3],
        createdAt: 1000,
      },
      {
        stopId: 'B',
        stopName: 'Old B',
        stopLat: metaB.stop.stop_lat,
        stopLon: metaB.stop.stop_lon,
        routeTypes: [3],
        createdAt: 2000,
      },
    ];
    const metas: StopWithMeta[] = [
      { ...metaA, routes: [makeRoute('r1', 3)] },
      { ...metaB, routes: [makeRoute('r2', 3)] },
    ];

    const updates = buildAnchorRefreshUpdates(anchors, metas);

    expect(updates).toHaveLength(1);
    expect(updates[0].stopId).toBe('B');
    expect(updates[0].stopName).toBe('Updated B');
  });
});

describe('MAX_ANCHOR_SIZE', () => {
  it('is 100', () => {
    expect(MAX_ANCHOR_SIZE).toBe(100);
  });
});
