import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AnchorEntry } from '../../../domain/portal/anchor';
import type { AppRouteTypeValue } from '../../../types/app/transit';
import { LocalStorageAnchorRepository } from '../local-storage-anchor-repository';

const STORAGE_KEY = 'portals';

function makeAnchorInput(
  id: string,
  routeTypes: AppRouteTypeValue[] = [3],
): Omit<AnchorEntry, 'createdAt'> {
  return {
    snapshot: {
      stopId: id,
      name: `Stop ${id}`,
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
): AnchorEntry {
  return { ...makeAnchorInput(id, routeTypes), createdAt };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LocalStorageAnchorRepository', () => {
  it('returns empty anchors when storage is empty', async () => {
    const repo = new LocalStorageAnchorRepository();

    const result = await repo.getAnchors();

    expect(result).toEqual({ success: true, data: [] });
  });

  it('loads current snapshot entries from localStorage', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([makeAnchorEntry('A'), makeAnchorEntry('B')]));
    const repo = new LocalStorageAnchorRepository();

    const result = await repo.getAnchors();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.map((entry) => entry.snapshot.stopId)).toEqual(['A', 'B']);
    }
  });

  it('migrates legacy flat entries to snapshot entries and rewrites storage', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          stopId: 'legacy-stop',
          stopName: 'Legacy Stop',
          stopLat: 35.1,
          stopLon: 139.1,
          routeTypes: [0, 3],
          agencyNames: ['Agency A'],
          platformCode: '1',
          portal: 'group-1',
          createdAt: 1234,
        },
      ]),
    );

    const repo = new LocalStorageAnchorRepository();
    const result = await repo.getAnchors();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([
        {
          snapshot: {
            stopId: 'legacy-stop',
            name: 'Legacy Stop',
            lat: 35.1,
            lon: 139.1,
            routeTypes: [0, 3],
            agencyNames: ['Agency A'],
            platformCode: '1',
          },
          portal: 'group-1',
          createdAt: 1234,
        },
      ]);
    }

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual([
      {
        snapshot: {
          stopId: 'legacy-stop',
          name: 'Legacy Stop',
          lat: 35.1,
          lon: 139.1,
          routeTypes: [0, 3],
          agencyNames: ['Agency A'],
          platformCode: '1',
        },
        portal: 'group-1',
        createdAt: 1234,
      },
    ]);
  });

  it('drops invalid stored entries and rewrites valid entries', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([makeAnchorEntry('A'), { stopId: 'bad' }]));

    const repo = new LocalStorageAnchorRepository();
    const result = await repo.getAnchors();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([makeAnchorEntry('A')]);
    }
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual([makeAnchorEntry('A')]);
  });

  it('adds an anchor and persists it', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(5000);
    const repo = new LocalStorageAnchorRepository();

    const result = await repo.addAnchor(makeAnchorInput('A'));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdAt).toBe(5000);
      expect(result.data.snapshot.stopId).toBe('A');
    }
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual([
      { ...makeAnchorInput('A'), createdAt: 5000 },
    ]);
  });

  it('returns an error for duplicate anchors without rewriting storage', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([makeAnchorEntry('A')]));
    const repo = new LocalStorageAnchorRepository();

    const result = await repo.addAnchor(makeAnchorInput('A'));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Duplicate stop');
    }
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual([makeAnchorEntry('A')]);
  });

  it('removes an anchor and persists the remaining entries', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([makeAnchorEntry('A'), makeAnchorEntry('B')]));
    const repo = new LocalStorageAnchorRepository();

    const result = await repo.removeAnchor('A');

    expect(result).toEqual({ success: true, data: undefined });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual([makeAnchorEntry('B')]);
  });

  it('updates an anchor while preserving createdAt and portal', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ ...makeAnchorEntry('A'), portal: 'group-1' }]),
    );
    const repo = new LocalStorageAnchorRepository();

    const result = await repo.updateAnchor({
      ...makeAnchorInput('A'),
      snapshot: { ...makeAnchorInput('A').snapshot, name: 'Updated A' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdAt).toBe(1000);
      expect(result.data.portal).toBe('group-1');
      expect(result.data.snapshot.name).toBe('Updated A');
    }
  });

  it('batch updates anchors with a single persisted result', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([makeAnchorEntry('A'), makeAnchorEntry('B')]));
    const repo = new LocalStorageAnchorRepository();

    const result = await repo.batchUpdateAnchors([
      { ...makeAnchorInput('A'), snapshot: { ...makeAnchorInput('A').snapshot, name: 'A1' } },
      { ...makeAnchorInput('B'), snapshot: { ...makeAnchorInput('B').snapshot, name: 'B1' } },
    ]);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.map((entry) => entry.snapshot.name)).toEqual(['A1', 'B1']);
    }
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toMatchObject([
      { snapshot: { stopId: 'A', name: 'A1' }, createdAt: 1000 },
      { snapshot: { stopId: 'B', name: 'B1' }, createdAt: 1000 },
    ]);
  });
});
