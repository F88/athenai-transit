import { describe, expect, it } from 'vitest';
import type { Route } from '../../../types/app/transit';
import type {
  StopServiceType,
  TimetableEntry,
  TranslatableText,
} from '../../../types/app/transit-composed';
import { getTimetableHeadsignPrefixLengths } from '../get-timetable-headsign-prefix-lengths';

function makeRoute(overrides?: Partial<Route>): Route {
  return {
    route_id: 'routeA',
    route_short_name: 'A',
    route_short_names: {},
    route_long_name: 'Route A',
    route_long_names: {},
    route_type: 3,
    route_color: '00377E',
    route_text_color: 'FFFFFF',
    agency_id: 'agencyA',
    ...overrides,
  };
}

function makeText(name: string, names?: Record<string, string>): TranslatableText {
  return { name, names: names ?? {} };
}

function makeEntry(options: {
  tripHeadsign: TranslatableText;
  stopHeadsign?: TranslatableText;
  departureMinutes?: number;
}): TimetableEntry {
  return {
    routeDirection: {
      route: makeRoute(),
      tripHeadsign: options.tripHeadsign,
      ...(options.stopHeadsign ? { stopHeadsign: options.stopHeadsign } : {}),
    },
    schedule: {
      departureMinutes: options.departureMinutes ?? 600,
      arrivalMinutes: options.departureMinutes ?? 600,
    },
    boarding: {
      pickupType: 0 as StopServiceType,
      dropOffType: 0 as StopServiceType,
    },
    patternPosition: {
      stopIndex: 0,
      totalStops: 1,
      isOrigin: false,
      isTerminal: false,
    },
  };
}

describe('getTimetableHeadsignPrefixLengths', () => {
  it('uses rendered labels instead of raw headsign keys', () => {
    const result = getTimetableHeadsignPrefixLengths(
      [
        makeEntry({
          tripHeadsign: makeText('さくらの湯', { en: 'Sakuranoyu' }),
        }),
        makeEntry({
          tripHeadsign: makeText('さくらの湯(愛大病院前)', {
            en: 'Sakuranoyu(Aidai Byoin)',
          }),
          departureMinutes: 605,
        }),
      ],
      ['en'],
      () => ['ja'],
    );

    expect(result.get('さくらの湯')).toBe('Sakuranoyu'.length);
    expect(result.get('さくらの湯(愛大病院前)')).toBe('Sakuranoyu(Aidai Byoin)'.length);
  });

  it('keeps the maximum required length when one raw headsign has multiple rendered labels', () => {
    const result = getTimetableHeadsignPrefixLengths(
      [
        makeEntry({
          tripHeadsign: makeText('A', { en: 'Alpha' }),
        }),
        makeEntry({
          tripHeadsign: makeText('A', { en: 'Alpha' }),
          stopHeadsign: makeText('A', { en: 'Alpine' }),
          departureMinutes: 605,
        }),
      ],
      ['en'],
      () => ['ja'],
    );

    expect(result.get('A')).toBe(4);
  });
});
