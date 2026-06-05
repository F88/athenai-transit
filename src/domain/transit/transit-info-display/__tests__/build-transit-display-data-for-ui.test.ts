/**
 * Tests for build-transit-display-data-for-ui.ts.
 *
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeContextualEntry, makeRoute, makeStop } from '../../../../__tests__/helpers';
import type { AppRouteTypeValue, Agency, Route } from '../../../../types/app/transit';
import type { StopWithContext, TripInspectionTarget } from '../../../../types/app/transit-composed';
import { minutesToDate } from '../../calendar-utils';
import { getAgencyDisplayNames } from '../../name-resolver/get-agency-display-name';
import { getHeadsignDisplayNames } from '../../name-resolver/get-headsign-display-names';
import { getRouteDisplayNames } from '../../name-resolver/get-route-display-names';
import { getStopDisplayNames } from '../../name-resolver/get-stop-display-names';
import { formatAbsoluteTime } from '../../time';
import { getTimetableEntryAttributes } from '../../timetable-entry-attributes';
import { buildTripInspectionTarget } from '../../trip-inspection-target';
import { routeTypesEmoji } from '../../../../utils/route-type-emoji';
import { buildTransitDisplayDatumForUi } from '../build-transit-display-data-for-ui';
import type { TransitDisplayDatum } from '../build-transit-display-data';

// Name resolution, emoji, attributes, and trip-inspection targeting are exercised
// by their own suites; here they are mocked so the assertions pin only what
// buildTransitDisplayDatumForUi itself does (field mapping, per-stop name cache,
// category-dependent time, and key construction). Date utilities stay real.
vi.mock('../../name-resolver/get-stop-display-names', () => ({ getStopDisplayNames: vi.fn() }));
vi.mock('../../name-resolver/get-route-display-names', () => ({ getRouteDisplayNames: vi.fn() }));
vi.mock('../../name-resolver/get-headsign-display-names', () => ({
  getHeadsignDisplayNames: vi.fn(),
}));
vi.mock('../../name-resolver/get-agency-display-name', () => ({ getAgencyDisplayNames: vi.fn() }));
vi.mock('../../timetable-entry-attributes', () => ({ getTimetableEntryAttributes: vi.fn() }));
vi.mock('../../trip-inspection-target', () => ({ buildTripInspectionTarget: vi.fn() }));
vi.mock('../../../../utils/route-type-emoji', () => ({ routeTypesEmoji: vi.fn() }));

const MOCK_ATTRIBUTES = {
  isTerminal: false,
  isOrigin: false,
  isPickupUnavailable: false,
  isDropOffUnavailable: false,
};
const MOCK_INSPECTION_TARGET = { kind: 'mock-target' } as unknown as TripInspectionTarget;

/** Minimal agency; only `agency_id` / `agency_lang` are read directly by the builder. */
function makeAgency(id: string, lang = 'ja'): Agency {
  return { agency_id: id, agency_lang: lang } as unknown as Agency;
}

/** A stop context with overridable agencies / routeTypes / distance. */
function makeStopContext(
  overrides: {
    stopId?: string;
    distance?: number;
    routeTypes?: AppRouteTypeValue[];
    agencies?: Agency[];
    routes?: Route[];
  } = {},
): StopWithContext {
  return {
    stop: makeStop(overrides.stopId ?? 'stop-1'),
    distance: overrides.distance ?? 120,
    routeTypes: overrides.routeTypes ?? [3],
    stopTimes: [],
    stopServiceState: 'boardable',
    agencies: overrides.agencies ?? [],
    routes: overrides.routes ?? [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStopDisplayNames).mockImplementation(
    (stop) => ({ name: `STOP:${stop.stop_id}` }) as ReturnType<typeof getStopDisplayNames>,
  );
  vi.mocked(getRouteDisplayNames).mockReturnValue({
    resolved: { name: 'ROUTE' },
  } as ReturnType<typeof getRouteDisplayNames>);
  vi.mocked(getHeadsignDisplayNames).mockReturnValue({
    resolved: { name: 'HEADSIGN' },
  } as ReturnType<typeof getHeadsignDisplayNames>);
  vi.mocked(getAgencyDisplayNames).mockReturnValue({
    resolved: { name: 'AGENCY' },
  } as ReturnType<typeof getAgencyDisplayNames>);
  vi.mocked(getTimetableEntryAttributes).mockReturnValue(MOCK_ATTRIBUTES);
  vi.mocked(buildTripInspectionTarget).mockReturnValue(MOCK_INSPECTION_TARGET);
  vi.mocked(routeTypesEmoji).mockImplementation((routeTypes) => `emoji(${routeTypes.join(',')})`);
});

describe('buildTransitDisplayDatumForUi', () => {
  it('returns an empty array for empty input', () => {
    expect(buildTransitDisplayDatumForUi([], ['ja'], 'departures')).toEqual([]);
  });

  it('maps each datum to one UI row, in order', () => {
    const datum: TransitDisplayDatum[] = [
      { entry: makeContextualEntry({ departureMinutes: 480 }), stopWithContext: makeStopContext() },
      { entry: makeContextualEntry({ departureMinutes: 540 }), stopWithContext: makeStopContext() },
    ];

    const rows = buildTransitDisplayDatumForUi(datum, ['ja'], 'departures');

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.departureMinutes)).toEqual([480, 540]);
  });

  it('fills row fields from the resolvers and the source entry', () => {
    const route: Route = { ...makeRoute('r1', 3), agency_id: 'A1' };
    const datum: TransitDisplayDatum[] = [
      {
        entry: makeContextualEntry({ route, departureMinutes: 480, arrivalMinutes: 510 }),
        stopWithContext: makeStopContext({
          stopId: 'stop-9',
          distance: 250,
          routeTypes: [3, 2],
          agencies: [makeAgency('A1')],
          routes: [route],
        }),
      },
    ];

    const [row] = buildTransitDisplayDatumForUi(datum, ['ja'], 'departures');

    expect(row.routeName).toBe('ROUTE');
    expect(row.headsign).toBe('HEADSIGN');
    expect(row.agencyName).toBe('AGENCY');
    expect(row.routeTypeEmoji).toBe('emoji(3)'); // trip-level: the route's own type
    expect(row.stop).toEqual({
      id: 'stop-9',
      name: 'STOP:stop-9',
      platformCode: undefined,
      distance: 250,
      routeTypesEmoji: 'emoji(3,2)', // stop-level: all the stop's route types
      context: datum[0].stopWithContext,
    });
    // Passthrough fields.
    expect(row.arrivalMinutes).toBe(510);
    expect(row.departureMinutes).toBe(480);
    expect(row.serviceDate).toEqual(new Date('2026-01-01'));
    expect(row.attributes).toBe(MOCK_ATTRIBUTES);
    expect(row.inspectionTarget).toBe(MOCK_INSPECTION_TARGET);
  });

  it("leaves agencyName empty when no stop agency matches the route's agency", () => {
    const route: Route = { ...makeRoute('r1', 3), agency_id: 'A1' };
    const datum: TransitDisplayDatum[] = [
      {
        // stop context carries no agencies -> no match for agency_id 'A1'
        entry: makeContextualEntry({ route }),
        stopWithContext: makeStopContext({ agencies: [] }),
      },
    ];

    const [row] = buildTransitDisplayDatumForUi(datum, ['ja'], 'departures');

    expect(row.agencyName).toBe('');
    expect(getAgencyDisplayNames).not.toHaveBeenCalled();
  });

  it('uses the category time for timeText: departures -> departure, arrivals -> arrival', () => {
    const serviceDate = new Date('2026-01-01');
    const entry = makeContextualEntry({ departureMinutes: 480, arrivalMinutes: 510, serviceDate });
    const datum: TransitDisplayDatum[] = [{ entry, stopWithContext: makeStopContext() }];

    const [departuresRow] = buildTransitDisplayDatumForUi(datum, ['ja'], 'departures');
    const [arrivalsRow] = buildTransitDisplayDatumForUi(datum, ['ja'], 'arrivals');

    expect(departuresRow.timeText).toBe(formatAbsoluteTime(minutesToDate(serviceDate, 480)));
    expect(arrivalsRow.timeText).toBe(formatAbsoluteTime(minutesToDate(serviceDate, 510)));
    expect(departuresRow.timeText).not.toBe(arrivalsRow.timeText);
  });

  it('resolves each stop name at most once and shares it across that stop entries', () => {
    const sharedStop = makeStopContext({ stopId: 'shared' });
    const datum: TransitDisplayDatum[] = [
      { entry: makeContextualEntry({ departureMinutes: 480 }), stopWithContext: sharedStop },
      { entry: makeContextualEntry({ departureMinutes: 540 }), stopWithContext: sharedStop },
    ];

    const rows = buildTransitDisplayDatumForUi(datum, ['ja'], 'departures');

    expect(rows.map((row) => row.stop.name)).toEqual(['STOP:shared', 'STOP:shared']);
    // Per-stop cache: one resolution shared across both entries of the same stop.
    expect(getStopDisplayNames).toHaveBeenCalledTimes(1);
  });

  it('builds distinct keys for the same trip on different service dates', () => {
    const stopWithContext = makeStopContext({ stopId: 'k' });
    const day1: TransitDisplayDatum = {
      entry: makeContextualEntry({ serviceDate: new Date('2026-01-01') }),
      stopWithContext,
    };
    const day2: TransitDisplayDatum = {
      entry: makeContextualEntry({ serviceDate: new Date('2026-01-02') }),
      stopWithContext,
    };

    const [row1] = buildTransitDisplayDatumForUi([day1], ['ja'], 'departures');
    const [row2] = buildTransitDisplayDatumForUi([day2], ['ja'], 'departures');

    expect(row1.key).not.toBe(row2.key);
    // The key is a JSON tuple that embeds the stop_id, so it survives a literal
    // separator collision between its parts.
    expect(row1.key).toContain('k');
  });
});
