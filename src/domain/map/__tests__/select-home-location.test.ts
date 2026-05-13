import { describe, expect, it } from 'vitest';
import { isHomeLocationUsable, selectHomeCandidates } from '../select-home-location';
import type { HomeLocation } from '../../../types/app/home-location';

const unconstrained: HomeLocation = {
  name: 'Anywhere',
  lat: 0,
  lng: 0,
  zoom: 10,
};

const constrainedSingle: HomeLocation = {
  name: 'Single-prefix place',
  lat: 1,
  lng: 1,
  zoom: 12,
  requiredDataSource: ['only-this'],
};

const constrainedMulti: HomeLocation = {
  name: 'Multi-prefix place',
  lat: 2,
  lng: 2,
  zoom: 14,
  requiredDataSource: ['a', 'b', 'c'],
};

describe('isHomeLocationUsable', () => {
  it('returns true for a location with `requiredDataSource === undefined`, regardless of loaded prefixes', () => {
    expect(isHomeLocationUsable(unconstrained, new Set())).toBe(true);
    expect(isHomeLocationUsable(unconstrained, new Set(['anything']))).toBe(true);
  });

  it('returns true when the single required prefix is loaded', () => {
    expect(isHomeLocationUsable(constrainedSingle, new Set(['only-this']))).toBe(true);
  });

  it('returns false when the single required prefix is not loaded', () => {
    expect(isHomeLocationUsable(constrainedSingle, new Set(['other']))).toBe(false);
    expect(isHomeLocationUsable(constrainedSingle, new Set())).toBe(false);
  });

  it('returns true when at least one of multiple required prefixes is loaded (some semantics)', () => {
    expect(isHomeLocationUsable(constrainedMulti, new Set(['b']))).toBe(true);
    expect(isHomeLocationUsable(constrainedMulti, new Set(['a', 'unrelated']))).toBe(true);
    expect(isHomeLocationUsable(constrainedMulti, new Set(['a', 'b', 'c']))).toBe(true);
  });

  it('returns false when none of the required prefixes is loaded', () => {
    expect(isHomeLocationUsable(constrainedMulti, new Set(['unrelated']))).toBe(false);
    expect(isHomeLocationUsable(constrainedMulti, new Set())).toBe(false);
  });

  it('returns true for `requiredDataSource: []` (empty array = no required data source = vacuously matched)', () => {
    // Semantic equivalence: `[]` and `undefined` both mean "this
    // location has no data-source requirement". The vacuous-truth
    // reading is the intuitive one and matches the field name's
    // intent ("required" — there's nothing required).
    const noRequirement: HomeLocation = {
      name: 'Empty array',
      lat: 0,
      lng: 0,
      zoom: 10,
      requiredDataSource: [],
    };
    expect(isHomeLocationUsable(noRequirement, new Set(['anything']))).toBe(true);
    expect(isHomeLocationUsable(noRequirement, new Set())).toBe(true);
  });
});

describe('selectHomeCandidates', () => {
  it('returns only the usable subset when some locations are filtered out', () => {
    const result = selectHomeCandidates(
      [unconstrained, constrainedSingle, constrainedMulti],
      new Set(['b']), // matches constrainedMulti (has 'b'); not constrainedSingle ('only-this')
    );
    expect(result.map((l) => l.name)).toEqual(['Anywhere', 'Multi-prefix place']);
  });

  it('returns all locations when every entry is usable', () => {
    const result = selectHomeCandidates(
      [unconstrained, constrainedSingle, constrainedMulti],
      new Set(['only-this', 'a']),
    );
    expect(result).toHaveLength(3);
  });

  it('falls back to the full input list when no location matches (so caller always has a candidate)', () => {
    const result = selectHomeCandidates(
      [constrainedSingle, constrainedMulti],
      new Set(['something-else']), // matches neither
    );
    // Fallback: returns the input as-is.
    expect(result.map((l) => l.name)).toEqual(['Single-prefix place', 'Multi-prefix place']);
  });

  it('returns only the unconstrained location when only unconstrained matches', () => {
    const result = selectHomeCandidates(
      [unconstrained, constrainedSingle, constrainedMulti],
      new Set(), // empty loaded set; only `unconstrained` (no requiredDataSource) is usable
    );
    expect(result.map((l) => l.name)).toEqual(['Anywhere']);
  });

  it('returns an empty array for an empty input (no fallback when there is nothing to fall back to)', () => {
    expect(selectHomeCandidates([], new Set())).toEqual([]);
    expect(selectHomeCandidates([], new Set(['anything']))).toEqual([]);
  });

  it('keeps locations with `requiredDataSource: []` (empty = no requirement = `["*"]` wildcard)', () => {
    // `[]` and `undefined` are equivalent: both mean "this location
    // has no data-source requirement" — like a `['*']` wildcard
    // matching any state. The location is always kept regardless of
    // what is loaded.
    const noRequirement: HomeLocation = {
      name: 'Empty array place',
      lat: 0,
      lng: 0,
      zoom: 10,
      requiredDataSource: [],
    };
    const result = selectHomeCandidates([unconstrained, noRequirement], new Set(['anything']));
    expect(result.map((l) => l.name)).toEqual(['Anywhere', 'Empty array place']);

    // Even with empty `loadedDataSources`, both unconstrained and
    // `[]`-requirement locations remain in the pool.
    const emptyLoaded = selectHomeCandidates([unconstrained, noRequirement], new Set());
    expect(emptyLoaded.map((l) => l.name)).toEqual(['Anywhere', 'Empty array place']);
  });
});
