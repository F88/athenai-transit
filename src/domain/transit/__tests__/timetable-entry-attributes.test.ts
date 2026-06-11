import { describe, expect, it } from 'vitest';
import type { StopServiceType } from '../../../types/app/transit-composed';
import type { TimetableEntry } from '../../../types/app/transit-composed';
import { getTimetableEntryAttributes } from '../timetable-entry-attributes';

/**
 * Build a minimal TimetableEntry with only the fields that
 * getTimetableEntryAttributes reads. Other fields get plausible
 * defaults so the type-check passes.
 */
function makeEntry(overrides: {
  isLastStop?: boolean;
  isFirstStop?: boolean;
  pickupType?: StopServiceType;
  dropOffType?: StopServiceType;
}): TimetableEntry {
  return {
    schedule: { departureMinutes: 480, arrivalMinutes: 480 },
    routeDirection: {
      route: {
        route_id: 'r1',
        route_short_name: '',
        route_short_names: {},
        route_long_name: '',
        route_long_names: {},
        route_type: 3,
        route_color: '',
        route_text_color: '',
        agency_id: 'a1',
      },
      tripHeadsign: { name: 'Dest', names: {} },
    },
    boarding: {
      pickupType: overrides.pickupType ?? 0,
      dropOffType: overrides.dropOffType ?? 0,
    },
    patternPosition: {
      stopIndex: 5,
      totalStops: 10,
      isLastStop: overrides.isLastStop ?? false,
      isFirstStop: overrides.isFirstStop ?? false,
    },
    tripLocator: { patternId: 'r1__Dest', serviceId: 'test', tripIndex: 0 },
  };
}

describe('getTimetableEntryAttributes', () => {
  it('derives all four flags as false by default', () => {
    const attributes = getTimetableEntryAttributes(makeEntry({}));
    expect(attributes).toEqual({
      isLastStop: false,
      isFirstStop: false,
      isPickupUnavailable: false,
      isDropOffUnavailable: false,
    });
  });

  it('reflects isLastStop from patternPosition.isLastStop', () => {
    expect(getTimetableEntryAttributes(makeEntry({ isLastStop: true })).isLastStop).toBe(true);
    expect(getTimetableEntryAttributes(makeEntry({ isLastStop: false })).isLastStop).toBe(false);
  });

  it('reflects isFirstStop from patternPosition.isFirstStop', () => {
    expect(getTimetableEntryAttributes(makeEntry({ isFirstStop: true })).isFirstStop).toBe(true);
    expect(getTimetableEntryAttributes(makeEntry({ isFirstStop: false })).isFirstStop).toBe(false);
  });

  it('sets isPickupUnavailable when pickupType is 1', () => {
    expect(getTimetableEntryAttributes(makeEntry({ pickupType: 1 })).isPickupUnavailable).toBe(
      true,
    );
  });

  it('leaves isPickupUnavailable false for pickupType 0 (boardable)', () => {
    expect(getTimetableEntryAttributes(makeEntry({ pickupType: 0 })).isPickupUnavailable).toBe(
      false,
    );
  });

  it('leaves isPickupUnavailable false for pickupType 2 (must phone)', () => {
    expect(getTimetableEntryAttributes(makeEntry({ pickupType: 2 })).isPickupUnavailable).toBe(
      false,
    );
  });

  it('leaves isPickupUnavailable false for pickupType 3 (coordinate with driver)', () => {
    expect(getTimetableEntryAttributes(makeEntry({ pickupType: 3 })).isPickupUnavailable).toBe(
      false,
    );
  });

  it('sets isDropOffUnavailable when dropOffType is 1', () => {
    expect(getTimetableEntryAttributes(makeEntry({ dropOffType: 1 })).isDropOffUnavailable).toBe(
      true,
    );
  });

  it('leaves isDropOffUnavailable false for dropOffType 0 (alightable)', () => {
    expect(getTimetableEntryAttributes(makeEntry({ dropOffType: 0 })).isDropOffUnavailable).toBe(
      false,
    );
  });

  it('leaves isDropOffUnavailable false for dropOffType 2 (must phone)', () => {
    expect(getTimetableEntryAttributes(makeEntry({ dropOffType: 2 })).isDropOffUnavailable).toBe(
      false,
    );
  });

  it('handles an entry with multiple flags set simultaneously', () => {
    const attributes = getTimetableEntryAttributes(
      makeEntry({ isLastStop: true, pickupType: 1, dropOffType: 1 }),
    );
    expect(attributes).toEqual({
      isLastStop: true,
      isFirstStop: false,
      isPickupUnavailable: true,
      isDropOffUnavailable: true,
    });
  });

  it('never crashes on origin + terminal together (edge case)', () => {
    const attributes = getTimetableEntryAttributes(
      makeEntry({ isFirstStop: true, isLastStop: true }),
    );
    expect(attributes.isFirstStop).toBe(true);
    expect(attributes.isLastStop).toBe(true);
  });
});
