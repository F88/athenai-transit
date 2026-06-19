import { describe, expect, it } from 'vitest';

import type { ContextualTimetableEntry } from '../../../types/app/transit-composed';
import { buildStopEventKey } from '../stop-event-key';
import { makeEntry } from './make-timetable-entry';

// Explicit y/m/d (not string parsing) so the date is timezone-agnostic.
const DATE_A = new Date(2026, 5, 19);
const DATE_B = new Date(2026, 5, 20);

function entry(
  overrides: Parameters<typeof makeEntry>[0],
  serviceDate: Date,
): ContextualTimetableEntry {
  return { ...makeEntry(overrides), serviceDate };
}

describe('buildStopEventKey', () => {
  it('is stable for the same stop event', () => {
    expect(buildStopEventKey(entry({}, DATE_A))).toBe(buildStopEventKey(entry({}, DATE_A)));
  });

  it('differs by service date for the same locator tuple', () => {
    // The bug being fixed: the same (patternId, serviceId, tripIndex, stopIndex)
    // recurring on different service dates must not collide as a React key.
    expect(buildStopEventKey(entry({}, DATE_A))).not.toBe(buildStopEventKey(entry({}, DATE_B)));
  });

  it('differs by stopIndex (Issue #47: circular routes)', () => {
    expect(buildStopEventKey(entry({ stopIndex: 3 }, DATE_A))).not.toBe(
      buildStopEventKey(entry({ stopIndex: 7 }, DATE_A)),
    );
  });

  it('includes the optional stop id', () => {
    const e = entry({}, DATE_A);
    expect(buildStopEventKey(e, 'stop-a')).not.toBe(buildStopEventKey(e, 'stop-b'));
    expect(buildStopEventKey(e, 'stop-a')).not.toBe(buildStopEventKey(e));
  });
});
