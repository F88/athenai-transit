import { describe, expect, it } from 'vitest';

import { makeRoute, makeStopMeta } from '../../../__tests__/helpers';
import type { AppRouteTypeValue } from '../../../types/app/transit';
import {
  addAnchor,
  buildAnchorRefreshUpdates,
  isAnchor,
  MAX_ANCHOR_SIZE,
  removeAnchor,
  updateAnchor,
  type AnchorEntry,
} from '../anchor';

function makeAnchorInput(
  id: string,
  routeTypes: AppRouteTypeValue[] = [3],
  name = `Stop ${id}`,
): Omit<AnchorEntry, 'createdAt'> {
  return {
    snapshot: {
      stopId: id,
      name,
      lat: 35.0,
      lon: 139.0,
      routeTypes,
      agencyNames: [],
    },
  };
}

function makeAnchorEntry(
  id: string,
  routeTypes: AppRouteTypeValue[] = [3],
  createdAt = 1000,
  name = `Stop ${id}`,
): AnchorEntry {
  return { ...makeAnchorInput(id, routeTypes, name), createdAt };
}

describe('addAnchor', () => {
  it('adds a stop to empty anchors', () => {
    const result = addAnchor([], makeAnchorInput('A'), 1000);

    expect(result).toHaveLength(1);
    expect(result[0].snapshot.stopId).toBe('A');
    expect(result[0].snapshot.name).toBe('Stop A');
    expect(result[0].createdAt).toBe(1000);
  });

  it('prepends new entry to front', () => {
    const result = addAnchor([makeAnchorEntry('A')], makeAnchorInput('B', [2], 'Stop B'), 2000);

    expect(result).toHaveLength(2);
    expect(result[0].snapshot.stopId).toBe('B');
    expect(result[1].snapshot.stopId).toBe('A');
  });

  it('returns same list when stop is already present', () => {
    const existing = [makeAnchorEntry('A'), makeAnchorEntry('B')];
    const result = addAnchor(existing, makeAnchorInput('A'), 2000);

    expect(result).toBe(existing);
  });

  it('caps anchors at MAX_ANCHOR_SIZE', () => {
    const existing = Array.from({ length: MAX_ANCHOR_SIZE }, (_, index) =>
      makeAnchorEntry(`s${index}`, [3], index),
    );
    const result = addAnchor(existing, makeAnchorInput('new', [3], 'New'), 9999);

    expect(result).toHaveLength(MAX_ANCHOR_SIZE);
    expect(result[0].snapshot.stopId).toBe('new');
    expect(
      result.find((entry) => entry.snapshot.stopId === `s${MAX_ANCHOR_SIZE - 1}`),
    ).toBeUndefined();
  });

  it('preserves snapshot and portal fields', () => {
    const result = addAnchor(
      [],
      {
        ...makeAnchorInput('X', [0, 3], 'Shibuya'),
        portal: 'my-group',
      },
      5000,
    );

    expect(result[0]).toEqual({
      snapshot: {
        stopId: 'X',
        name: 'Shibuya',
        lat: 35.0,
        lon: 139.0,
        routeTypes: [0, 3],
        agencyNames: [],
      },
      portal: 'my-group',
      createdAt: 5000,
    });
  });
});

describe('removeAnchor', () => {
  it('removes an existing anchor by stopId', () => {
    const result = removeAnchor(
      [makeAnchorEntry('A'), makeAnchorEntry('B'), makeAnchorEntry('C')],
      'B',
    );

    expect(result).toHaveLength(2);
    expect(result.find((entry) => entry.snapshot.stopId === 'B')).toBeUndefined();
    expect(result[0].snapshot.stopId).toBe('A');
    expect(result[1].snapshot.stopId).toBe('C');
  });

  it('preserves non-target portal entries', () => {
    const result = removeAnchor(
      [
        { ...makeAnchorEntry('A'), portal: 'group-1' },
        { ...makeAnchorEntry('B'), portal: 'group-1' },
        { ...makeAnchorEntry('C'), portal: 'group-2' },
      ],
      'A',
    );

    expect(result).toHaveLength(2);
    expect(result[0].snapshot.stopId).toBe('B');
    expect(result[0].portal).toBe('group-1');
    expect(result[1].snapshot.stopId).toBe('C');
    expect(result[1].portal).toBe('group-2');
  });
});

describe('updateAnchor', () => {
  it('updates snapshot fields of an existing anchor', () => {
    const result = updateAnchor([makeAnchorEntry('A'), makeAnchorEntry('B')], {
      snapshot: {
        stopId: 'A',
        name: 'Updated Name',
        lat: 36.0,
        lon: 140.0,
        routeTypes: [0, 3],
        agencyNames: ['Agency A'],
      },
    });

    expect(result[0].snapshot.name).toBe('Updated Name');
    expect(result[0].snapshot.lat).toBe(36.0);
    expect(result[0].snapshot.lon).toBe(140.0);
    expect(result[0].snapshot.routeTypes).toEqual([0, 3]);
    expect(result[0].snapshot.agencyNames).toEqual(['Agency A']);
    expect(result[0].createdAt).toBe(1000);
    expect(result[1].snapshot.stopId).toBe('B');
  });

  it('preserves existing portal when update omits portal', () => {
    const result = updateAnchor([{ ...makeAnchorEntry('A'), portal: 'my-group' }], {
      snapshot: { ...makeAnchorInput('A').snapshot, name: 'New Name' },
    });

    expect(result[0].portal).toBe('my-group');
    expect(result[0].snapshot.name).toBe('New Name');
  });

  it('updates portal when provided', () => {
    const result = updateAnchor([{ ...makeAnchorEntry('A'), portal: 'old-group' }], {
      ...makeAnchorInput('A'),
      portal: 'new-group',
    });

    expect(result[0].portal).toBe('new-group');
  });

  it('returns same list when nothing changed or stopId not found', () => {
    const existing = [makeAnchorEntry('A')];

    expect(updateAnchor(existing, makeAnchorInput('A'))).toBe(existing);
    expect(updateAnchor(existing, makeAnchorInput('Z'))).toBe(existing);
  });
});

describe('isAnchor', () => {
  it('returns membership by snapshot.stopId', () => {
    const anchors = [makeAnchorEntry('A'), makeAnchorEntry('B')];

    expect(isAnchor(anchors, 'A')).toBe(true);
    expect(isAnchor(anchors, 'Z')).toBe(false);
    expect(isAnchor([], 'A')).toBe(false);
  });
});

describe('buildAnchorRefreshUpdates', () => {
  it('builds updates for anchors with changed fields', () => {
    const metaA = makeStopMeta('A');
    metaA.stop.stop_name = 'New A';
    const metaB = makeStopMeta('B');
    metaB.stop.stop_name = 'New B';
    const updates = buildAnchorRefreshUpdates(
      [makeAnchorEntry('A', [3], 1000, 'Old A'), makeAnchorEntry('B', [3], 2000, 'Old B')],
      [
        { ...metaA, routes: [makeRoute('r1', 3)] },
        { ...metaB, routes: [makeRoute('r2', 0), makeRoute('r3', 3)] },
      ],
      ['ja'],
    );

    expect(updates).toHaveLength(2);
    expect(updates[0].snapshot.stopId).toBe('A');
    expect(updates[0].snapshot.name).toBe('New A');
    expect(updates[1].snapshot.stopId).toBe('B');
    expect(updates[1].snapshot.routeTypes).toEqual([0, 3]);
  });

  it('falls back to existing routeTypes when meta has no routes', () => {
    const meta = makeStopMeta('A');
    meta.stop.stop_name = 'New Name';
    const updates = buildAnchorRefreshUpdates(
      [makeAnchorEntry('A', [2], 1000, 'Old Name')],
      [{ ...meta, routes: [] }],
      ['ja'],
    );

    expect(updates).toHaveLength(1);
    expect(updates[0].snapshot.routeTypes).toEqual([2]);
    expect(updates[0].snapshot.name).toBe('New Name');
  });

  it('returns empty when nothing changed or no metas match', () => {
    const meta = makeStopMeta('A');
    const unchanged = buildAnchorRefreshUpdates(
      [makeAnchorEntry('A', [3], 1000, meta.stop.stop_name)],
      [{ ...meta, routes: [makeRoute('r1', 3)] }],
      ['ja'],
    );
    const missing = buildAnchorRefreshUpdates(
      [makeAnchorEntry('Z')],
      [{ ...meta, routes: [] }],
      ['ja'],
    );

    expect(unchanged).toEqual([]);
    expect(missing).toEqual([]);
  });

  it('preserves portal on refresh updates', () => {
    const meta = makeStopMeta('A');
    meta.stop.stop_name = 'Updated A';
    const updates = buildAnchorRefreshUpdates(
      [{ ...makeAnchorEntry('A', [3], 1000, 'Old A'), portal: 'group-1' }],
      [{ ...meta, routes: [makeRoute('r1', 3)] }],
      ['ja'],
    );

    expect(updates[0].portal).toBe('group-1');
    expect(updates[0].snapshot.name).toBe('Updated A');
  });
});

describe('MAX_ANCHOR_SIZE', () => {
  it('is 100', () => {
    expect(MAX_ANCHOR_SIZE).toBe(100);
  });
});
