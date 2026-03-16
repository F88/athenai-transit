import { describe, expect, it } from 'vitest';
import { collectPresentAgencies, filterStopsByAgency } from '../agency-filter';
import { makeStop, makeStopWithContext } from '../../../__tests__/helpers';
import type { Agency, StopWithContext } from '../../../types/app/transit';

function makeAgency(id: string, shortName = '', name = `Agency ${id}`): Agency {
  return {
    agency_id: id,
    agency_name: name,
    agency_short_name: shortName,
    agency_names: {},
    agency_short_names: {},
    agency_url: '',
    agency_lang: 'ja',
    agency_timezone: 'Asia/Tokyo',
    agency_fare_url: '',
    agency_colors: [],
  };
}

function withAgencies(swc: StopWithContext, agencies: Agency[]): StopWithContext {
  return { ...swc, agencies };
}

describe('filterStopsByAgency', () => {
  const agencyA = makeAgency('a', 'A');
  const agencyB = makeAgency('b', 'B');
  const agencyC = makeAgency('c', 'C');

  const stops: StopWithContext[] = [
    withAgencies(makeStopWithContext(makeStop('s1'), ['r1']), [agencyA]),
    withAgencies(makeStopWithContext(makeStop('s2'), ['r2']), [agencyB]),
    withAgencies(makeStopWithContext(makeStop('s3'), ['r3']), [agencyA, agencyC]),
  ];

  it('returns all stops when hiddenAgencyIds is empty', () => {
    const result = filterStopsByAgency(stops, new Set());
    expect(result.map((s) => s.stop.stop_id)).toEqual(['s1', 's2', 's3']);
  });

  it('excludes stop whose only agency is hidden', () => {
    const result = filterStopsByAgency(stops, new Set(['a']));
    expect(result.map((s) => s.stop.stop_id)).toEqual(['s2', 's3']);
  });

  it('keeps stop when at least one agency is not hidden', () => {
    // s3 has agencies [a, c]; hiding only 'a' should keep it
    const result = filterStopsByAgency(stops, new Set(['a']));
    expect(result.map((s) => s.stop.stop_id)).toContain('s3');
  });

  it('excludes stop when all its agencies are hidden', () => {
    const result = filterStopsByAgency(stops, new Set(['a', 'c']));
    // s3 has agencies [a, c], both hidden → excluded
    expect(result.map((s) => s.stop.stop_id)).toEqual(['s2']);
  });

  it('never excludes stops with empty agencies', () => {
    const stopsWithEmpty = [
      ...stops,
      makeStopWithContext(makeStop('s4'), ['r4']), // agencies: []
    ];
    const result = filterStopsByAgency(stopsWithEmpty, new Set(['a', 'b', 'c']));
    expect(result.map((s) => s.stop.stop_id)).toEqual(['s4']);
  });

  it('handles empty stops array', () => {
    const result = filterStopsByAgency([], new Set(['a']));
    expect(result).toEqual([]);
  });
});

describe('collectPresentAgencies', () => {
  const agencyA = makeAgency('a', 'B-Agency'); // short_name starts with B
  const agencyB = makeAgency('b', 'A-Agency'); // short_name starts with A
  const agencyC = makeAgency('c', '', 'C-Agency'); // no short_name, falls back to name

  it('collects unique agencies from all stops', () => {
    const stops: StopWithContext[] = [
      withAgencies(makeStopWithContext(makeStop('s1'), ['r1']), [agencyA]),
      withAgencies(makeStopWithContext(makeStop('s2'), ['r2']), [agencyB]),
    ];
    const result = collectPresentAgencies(stops);
    expect(result.map((a) => a.agency_id)).toEqual(['b', 'a']);
  });

  it('deduplicates agencies by agency_id', () => {
    const stops: StopWithContext[] = [
      withAgencies(makeStopWithContext(makeStop('s1'), ['r1']), [agencyA]),
      withAgencies(makeStopWithContext(makeStop('s2'), ['r2']), [agencyA, agencyB]),
    ];
    const result = collectPresentAgencies(stops);
    expect(result).toHaveLength(2);
  });

  it('sorts by agency_short_name, falling back to agency_name', () => {
    const stops: StopWithContext[] = [
      withAgencies(makeStopWithContext(makeStop('s1'), ['r1']), [agencyA, agencyC]),
      withAgencies(makeStopWithContext(makeStop('s2'), ['r2']), [agencyB]),
    ];
    const result = collectPresentAgencies(stops);
    // A-Agency (b), B-Agency (a), C-Agency (c)
    expect(result.map((a) => a.agency_id)).toEqual(['b', 'a', 'c']);
  });

  it('returns empty array when no stops have agencies', () => {
    const stops: StopWithContext[] = [
      makeStopWithContext(makeStop('s1'), ['r1']), // agencies: []
    ];
    const result = collectPresentAgencies(stops);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(collectPresentAgencies([])).toEqual([]);
  });
});
