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
  isTerminal?: boolean;
  isOrigin?: boolean;
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
      isTerminal: overrides.isTerminal ?? false,
      isOrigin: overrides.isOrigin ?? false,
    },
  };
}

describe('getTimetableEntryAttributes', () => {
  it('derives all four flags as false by default', () => {
    const attributes = getTimetableEntryAttributes(makeEntry({}));
    expect(attributes).toEqual({
      isTerminal: false,
      isOrigin: false,
      isPickupUnavailable: false,
      isDropOffUnavailable: false,
    });
  });

  it('reflects isTerminal from patternPosition.isTerminal', () => {
    expect(getTimetableEntryAttributes(makeEntry({ isTerminal: true })).isTerminal).toBe(true);
    expect(getTimetableEntryAttributes(makeEntry({ isTerminal: false })).isTerminal).toBe(false);
  });

  it('reflects isOrigin from patternPosition.isOrigin', () => {
    expect(getTimetableEntryAttributes(makeEntry({ isOrigin: true })).isOrigin).toBe(true);
    expect(getTimetableEntryAttributes(makeEntry({ isOrigin: false })).isOrigin).toBe(false);
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
      makeEntry({ isTerminal: true, pickupType: 1, dropOffType: 1 }),
    );
    expect(attributes).toEqual({
      isTerminal: true,
      isOrigin: false,
      isPickupUnavailable: true,
      isDropOffUnavailable: true,
    });
  });

  it('never crashes on origin + terminal together (edge case)', () => {
    const attributes = getTimetableEntryAttributes(makeEntry({ isOrigin: true, isTerminal: true }));
    expect(attributes.isOrigin).toBe(true);
    expect(attributes.isTerminal).toBe(true);
  });
});
