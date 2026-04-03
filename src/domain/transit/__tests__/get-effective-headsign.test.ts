/**
 * Tests for get-effective-headsign.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type { RouteDirection } from '../../../types/app/transit-composed';
import { getEffectiveHeadsign } from '../get-effective-headsign';

function makeRD(tripName: string, stopName?: string): RouteDirection {
  return {
    route: {
      route_id: 'r1',
      route_short_name: 'R1',
      route_long_name: '',
      route_names: {},
      route_type: 3,
      route_color: '',
      route_text_color: '',
      agency_id: 'a1',
    },
    tripHeadsign: { name: tripName, names: {} },
    stopHeadsign: stopName != null ? { name: stopName, names: {} } : undefined,
  };
}

describe('getEffectiveHeadsign', () => {
  it('returns tripHeadsign when stopHeadsign is absent', () => {
    expect(getEffectiveHeadsign(makeRD('Terminal A'))).toBe('Terminal A');
  });

  it('returns stopHeadsign when present (GTFS override)', () => {
    expect(getEffectiveHeadsign(makeRD('Terminal A', 'Mid Stop'))).toBe('Mid Stop');
  });

  it('returns stopHeadsign when tripHeadsign is empty (keio-bus pattern)', () => {
    expect(getEffectiveHeadsign(makeRD('', 'Musashi-koganei'))).toBe('Musashi-koganei');
  });

  it('returns empty when both are empty', () => {
    expect(getEffectiveHeadsign(makeRD(''))).toBe('');
  });

  it('falls back to tripHeadsign when stopHeadsign is empty string', () => {
    // stopHeadsign with empty name — should fall back to trip
    expect(getEffectiveHeadsign(makeRD('Terminal A', ''))).toBe('Terminal A');
  });
});
