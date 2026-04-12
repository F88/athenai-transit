import { describe, expect, it } from 'vitest';
import { collectPresentAgencies } from '../collect-present-agencies';
import { makeStop, makeStopWithContext } from '../../../__tests__/helpers';
import type { Agency } from '../../../types/app/transit';
import type { StopWithContext } from '../../../types/app/transit-composed';

function makeAgency(id: string, shortName = '', name = `Agency ${id}`): Agency {
  return {
    agency_id: id,
    agency_name: name,
    agency_long_name: name,
    agency_short_name: shortName,
    agency_names: {},
    agency_long_names: {},
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

describe('collectPresentAgencies', () => {
  const agencyA = makeAgency('a', 'B-Agency');
  const agencyB = makeAgency('b', 'A-Agency');
  const agencyC = makeAgency('c', '', 'C-Agency');

  it('collects unique agencies from all stops in first-seen order', () => {
    const stops: StopWithContext[] = [
      withAgencies(makeStopWithContext(makeStop('s1'), ['r1']), [agencyA]),
      withAgencies(makeStopWithContext(makeStop('s2'), ['r2']), [agencyB]),
    ];
    const result = collectPresentAgencies(stops);
    expect(result.map((a) => a.agency_id)).toEqual(['a', 'b']);
  });

  it('deduplicates agencies by agency_id without changing first-seen order', () => {
    const stops: StopWithContext[] = [
      withAgencies(makeStopWithContext(makeStop('s1'), ['r1']), [agencyA]),
      withAgencies(makeStopWithContext(makeStop('s2'), ['r2']), [agencyA, agencyB]),
    ];
    const result = collectPresentAgencies(stops);
    expect(result.map((a) => a.agency_id)).toEqual(['a', 'b']);
  });

  it('preserves agency order within each stop while deduplicating later repeats', () => {
    const stops: StopWithContext[] = [
      withAgencies(makeStopWithContext(makeStop('s1'), ['r1']), [agencyA, agencyC]),
      withAgencies(makeStopWithContext(makeStop('s2'), ['r2']), [agencyB]),
    ];
    const result = collectPresentAgencies(stops);
    expect(result.map((a) => a.agency_id)).toEqual(['a', 'c', 'b']);
  });

  it('does not reinsert an already seen agency when it appears again later', () => {
    const first = makeAgency('dup', '', 'First Name');
    const later = makeAgency('dup', 'Later Short', 'Later Name');
    const other = makeAgency('other', 'Other');
    const stops: StopWithContext[] = [
      withAgencies(makeStopWithContext(makeStop('s1'), ['r1']), [first]),
      withAgencies(makeStopWithContext(makeStop('s2'), ['r2']), [later, other]),
    ];

    const result = collectPresentAgencies(stops);

    expect(result.map((agency) => agency.agency_id)).toEqual(['dup', 'other']);
    expect(result[0]).toBe(first);
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
