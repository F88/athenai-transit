/**
 * Tests for load-odpt-train-sources.ts.
 *
 * Uses the actual resource definitions on disk to verify discovery logic.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import {
  discoverOdptTrainSources,
  listOdptTrainSourceNames,
  loadOdptTrainSource,
} from '../load-odpt-train-sources';

describe('discoverOdptTrainSources', () => {
  it('returns an array of sources sorted by name', async () => {
    const sources = await discoverOdptTrainSources();
    expect(Array.isArray(sources)).toBe(true);

    // Verify sorted
    const names = sources.map((s) => s.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it('each source has all required fields', async () => {
    const sources = await discoverOdptTrainSources();
    for (const source of sources) {
      expect(source.name).toBeTruthy();
      expect(source.prefix).toBeTruthy();
      expect(source.provider).toBeDefined();
      expect(source.dataDir).toBeTruthy();
      expect(source.resources.station).toBeDefined();
      expect(source.resources.railway).toBeDefined();
      expect(source.resources.stationTimetable).toBeDefined();
    }
  });

  it('includes yurikamome as a known source', async () => {
    const sources = await discoverOdptTrainSources();
    const yurikamome = sources.find((s) => s.name === 'yurikamome');
    expect(yurikamome).toBeDefined();
    expect(yurikamome!.prefix).toBe('yurimo');
  });
});

describe('listOdptTrainSourceNames', () => {
  it('returns sorted source name strings', async () => {
    const names = await listOdptTrainSourceNames();
    expect(Array.isArray(names)).toBe(true);
    expect(names.every((n) => typeof n === 'string')).toBe(true);
    expect(names).toContain('yurikamome');
  });
});

describe('loadOdptTrainSource', () => {
  it('loads a known source by name', async () => {
    const source = await loadOdptTrainSource('yurikamome');
    expect(source.name).toBe('yurikamome');
    expect(source.prefix).toBe('yurimo');
  });

  it('throws for unknown source name', async () => {
    await expect(loadOdptTrainSource('nonexistent')).rejects.toThrow(
      /Unknown ODPT Train source: "nonexistent"/,
    );
  });
});
