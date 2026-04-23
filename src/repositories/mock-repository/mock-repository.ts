/**
 * In-memory mock implementation of {@link TransitRepository}.
 *
 * Provides fictional stops and routes around Kumano-mae for UI development
 * and edge-marker validation without real GTFS data.
 * All stop/route names are fictional and do not represent real services.
 *
 * Includes stops with multiple route types for testing the
 * `routeTypes: RouteType[]` feature:
 * - `sta_central`: tram(0) + subway(1) + rail(2) + bus(3) — all 4 types,
 *   with bus routes from two agencies (あおば交通 + そら急行バス)
 * - `sta_central_s`: subway(1) + rail(2) + bus(3) — 3 types
 * - `sta_hill`: rail(2) + bus(3)
 * - `sta_east`: tram(0) + rail(2)
 * - `sta_south`: subway(1) + rail(2)
 */

import type { Bounds, LatLng, RouteShape } from '../../types/app/map';
import type { Agency, AppRouteTypeValue, Stop } from '../../types/app/transit';
import type {
  ContextualTimetableEntry,
  SourceMeta,
  StopWithMeta,
  TimetableEntry,
  TripLocator,
  TripStopTime,
  TripSnapshot,
} from '../../types/app/transit-composed';
import type {
  CollectionResult,
  Result,
  TimetableQueryMeta,
  TimetableResult,
  TripSnapshotResult,
  UpcomingTimetableResult,
} from '../../types/app/repository';
import { getTimetableEntriesState } from '../../domain/transit/timetable-utils';
import { getServiceDay, getServiceDayMinutes } from '../../domain/transit/service-day';
import {
  sortTimetableEntriesByDepartureTime,
  sortTimetableEntriesChronologically,
} from '../../domain/transit/sort-timetable-entries';
import { normalizeOptionalResultLimit, normalizeStopQueryLimit } from '../transit-repository';
import type { TransitRepository } from '../transit-repository';
import {
  AGENCY_MAP,
  ROUTE_MAP,
  ROUTE_SHAPES,
  ROUTES,
  ROUTE_STOP_SEQUENCES,
  STOP_AGENCIES,
  STOP_ROUTES,
  STOP_ROUTES_RESOLVED,
  STOP_ROUTE_TYPES,
  STOPS,
  approxDistanceKm,
  computeArrivalMinutes,
  computeOccOffset,
  countStopOccurrences,
  createMockTranslatableText,
  createMockTripPatternId,
  generateFixedMinutes,
  getBoardingTypes,
  getPatternPosition,
  simpleHash,
} from './mock-data';

export class MockRepository implements TransitRepository {
  /** {@inheritDoc TransitRepository.getStopsInBounds} */
  getStopsInBounds(bounds: Bounds, limit: number): Promise<CollectionResult<StopWithMeta>> {
    const effectiveLimit = normalizeStopQueryLimit(limit);
    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLng = (bounds.east + bounds.west) / 2;

    const matching: { stop: Stop; distance: number }[] = [];
    for (const stop of STOPS) {
      if (
        stop.stop_lat >= bounds.south &&
        stop.stop_lat <= bounds.north &&
        stop.stop_lon >= bounds.west &&
        stop.stop_lon <= bounds.east
      ) {
        const distKm = approxDistanceKm(stop.stop_lat, stop.stop_lon, centerLat, centerLng);
        matching.push({ stop, distance: distKm * 1000 });
      }
    }

    matching.sort((a, b) => a.distance - b.distance);

    const truncated = matching.length > effectiveLimit;
    const data: StopWithMeta[] = matching.slice(0, effectiveLimit).map((m) => ({
      stop: m.stop,
      distance: m.distance,
      agencies: STOP_AGENCIES.get(m.stop.stop_id) ?? [],
      routes: STOP_ROUTES_RESOLVED.get(m.stop.stop_id) ?? [],
    }));

    return Promise.resolve({ success: true, data, truncated });
  }

  /** {@inheritDoc TransitRepository.getUpcomingTimetableEntries} */
  getUpcomingTimetableEntries(
    stopId: string,
    now: Date,
    limit?: number,
  ): Promise<UpcomingTimetableResult> {
    const normalizedLimit = normalizeOptionalResultLimit(limit);
    const stop = STOPS.find((s) => s.stop_id === stopId);
    if (!stop) {
      return Promise.resolve({ success: false, error: `No stop time data for stop: ${stopId}` });
    }

    const stopRoutes = STOP_ROUTES[stopId] ?? [];
    const entries: ContextualTimetableEntry[] = [];
    let fullDayCount = 0;
    let hasBoardable = false;

    const serviceDate = getServiceDay(now);
    const nowMinutes = getServiceDayMinutes(now);
    for (const { routeId, headsign, stopHeadsign } of stopRoutes) {
      const route = ROUTES.find((r) => r.route_id === routeId);
      if (!route) {
        continue;
      }

      const allMinutes = generateFixedMinutes(routeId, headsign);

      // Issue #47: a stop may appear at multiple positions in one pattern
      // (6-shape / circular). Emit one set of entries per occurrence.
      const occurrences = Math.max(1, countStopOccurrences(routeId, headsign, stopId));

      for (let occ = 0; occ < occurrences; occ++) {
        const position = getPatternPosition(routeId, headsign, stopId, occ);
        const occOffset = computeOccOffset(routeId, occ);
        const { pickupType, dropOffType } = getBoardingTypes(routeId, headsign, stopId, occ);

        // Count full-day entries and check boardability (per occurrence).
        fullDayCount += allMinutes.length;
        if (!hasBoardable && pickupType !== 1 && !position.isTerminal) {
          hasBoardable = true;
        }

        const upcoming = allMinutes
          .map((minutes, tripIndex) => ({ minutes: minutes + occOffset, tripIndex }))
          .filter(({ minutes }) => minutes >= nowMinutes);
        for (const { minutes, tripIndex } of upcoming) {
          const arrivalMinutes = computeArrivalMinutes(routeId, occ, minutes);
          // Colorful Route fixtures need insights so JourneyTimeBar
          // renders. Real insights come from InsightsBundle in production
          // builds; for the mock we synthesize a deterministic trip
          // length (10–120 min, per route_id) and derive remainingMinutes
          // by linear interpolation across the pattern. `freq` is always
          // 1 since colorful routes are one-trip-per-day fixtures.
          const colorfulInsights = (() => {
            if (route.agency_id !== 'mock:colorful') {
              return undefined;
            }
            const totalMinutes = 10 + (simpleHash(route.route_id) % 111);
            const remainingMinutes =
              position.totalStops > 1
                ? Math.round(
                    (totalMinutes * (position.totalStops - position.stopIndex - 1)) /
                      (position.totalStops - 1),
                  )
                : 0;
            return { totalMinutes, remainingMinutes, freq: 1 };
          })();
          entries.push({
            schedule: { departureMinutes: minutes, arrivalMinutes },
            routeDirection: {
              route,
              tripHeadsign: createMockTranslatableText(headsign),
              ...(stopHeadsign != null
                ? { stopHeadsign: createMockTranslatableText(stopHeadsign) }
                : {}),
            },
            boarding: { pickupType, dropOffType },
            patternPosition: position,
            tripLocator: {
              patternId: createMockTripPatternId(routeId, headsign),
              serviceId: 'mock:default',
              tripIndex,
            },
            serviceDate,
            ...(colorfulInsights ? { insights: colorfulInsights } : {}),
          });
        }
      }
    }

    sortTimetableEntriesChronologically(entries);

    let truncated = false;
    let result = entries;
    if (normalizedLimit !== undefined && entries.length > normalizedLimit) {
      result = entries.slice(0, normalizedLimit);
      truncated = true;
    }

    const meta: TimetableQueryMeta = {
      isBoardableOnServiceDay: hasBoardable,
      totalEntries: fullDayCount,
    };
    return Promise.resolve({ success: true, data: result, truncated, meta });
  }

  /** {@inheritDoc TransitRepository.getRouteTypesForStop} */
  getRouteTypesForStop(stopId: string): Promise<Result<AppRouteTypeValue[]>> {
    const types = STOP_ROUTE_TYPES.get(stopId);
    if (!types) {
      return Promise.resolve({ success: false, error: `No route types for stop: ${stopId}` });
    }
    return Promise.resolve({ success: true, data: types });
  }

  /** {@inheritDoc TransitRepository.getStopsNearby} */
  getStopsNearby(
    center: LatLng,
    radiusM: number,
    limit: number,
  ): Promise<CollectionResult<StopWithMeta>> {
    if (radiusM <= 0) {
      return Promise.resolve({ success: true, data: [], truncated: false });
    }

    const effectiveLimit = normalizeStopQueryLimit(limit);
    const radiusKm = radiusM / 1000;
    const sorted = STOPS.map((stop) => {
      const distKm = approxDistanceKm(stop.stop_lat, stop.stop_lon, center.lat, center.lng);
      return { stop, distKm };
    })
      .filter(({ distKm }) => distKm <= radiusKm)
      .sort((a, b) => a.distKm - b.distKm);

    const truncated = sorted.length > effectiveLimit;
    const data: StopWithMeta[] = sorted.slice(0, effectiveLimit).map(({ stop, distKm }) => ({
      stop,
      distance: distKm * 1000,
      agencies: STOP_AGENCIES.get(stop.stop_id) ?? [],
      routes: STOP_ROUTES_RESOLVED.get(stop.stop_id) ?? [],
    }));

    return Promise.resolve({ success: true, data, truncated });
  }

  /** {@inheritDoc TransitRepository.getRouteShapes} */
  getRouteShapes(): Promise<CollectionResult<RouteShape>> {
    return Promise.resolve({ success: true, data: ROUTE_SHAPES, truncated: false });
  }

  /** {@inheritDoc TransitRepository.getFullDayTimetableEntries} */
  getFullDayTimetableEntries(
    stopId: string,
    ...[
      /* dateTime */
    ]: [Date]
  ): Promise<TimetableResult> {
    const stopRoutes = STOP_ROUTES[stopId] ?? [];
    const entries: TimetableEntry[] = [];

    for (const { routeId, headsign, stopHeadsign } of stopRoutes) {
      const route = ROUTES.find((r) => r.route_id === routeId);
      if (!route) {
        continue;
      }
      // Issue #47: emit one set of entries per occurrence (6-shape / circular).
      const occurrences = Math.max(1, countStopOccurrences(routeId, headsign, stopId));

      for (let occ = 0; occ < occurrences; occ++) {
        const position = getPatternPosition(routeId, headsign, stopId, occ);
        const occOffset = computeOccOffset(routeId, occ);
        const { pickupType, dropOffType } = getBoardingTypes(routeId, headsign, stopId, occ);
        const baseSchedule = generateFixedMinutes(routeId, headsign);
        for (const [tripIndex, baseMinutes] of baseSchedule.entries()) {
          const minutes = baseMinutes + occOffset;
          const arrivalMinutes = computeArrivalMinutes(routeId, occ, minutes);
          entries.push({
            schedule: { departureMinutes: minutes, arrivalMinutes },
            routeDirection: {
              route,
              tripHeadsign: createMockTranslatableText(headsign),
              ...(stopHeadsign != null
                ? { stopHeadsign: createMockTranslatableText(stopHeadsign) }
                : {}),
            },
            boarding: { pickupType, dropOffType },
            patternPosition: position,
            tripLocator: {
              patternId: createMockTripPatternId(routeId, headsign),
              serviceId: 'mock:default',
              tripIndex,
            },
          });
        }
      }
    }

    sortTimetableEntriesByDepartureTime(entries);
    const meta: TimetableQueryMeta = {
      isBoardableOnServiceDay: getTimetableEntriesState(entries) === 'boardable',
      totalEntries: entries.length,
    };
    return Promise.resolve({ success: true, data: entries, truncated: false, meta });
  }

  getTripSnapshot(locator: TripLocator, serviceDate: Date): TripSnapshotResult {
    const [routeId, headsign] = locator.patternId.split('__');
    if (!routeId || headsign === undefined) {
      return { success: false, error: `Invalid mock trip pattern id: ${locator.patternId}` };
    }

    const route = ROUTES.find((candidate) => candidate.route_id === routeId);
    const stopSequence = ROUTE_STOP_SEQUENCES.get(locator.patternId);
    if (!route || !stopSequence) {
      return { success: false, error: `Unknown mock trip pattern: ${locator.patternId}` };
    }

    const baseMinutes = generateFixedMinutes(routeId, headsign)[locator.tripIndex];
    if (baseMinutes === undefined) {
      return {
        success: false,
        error: `No mock trip instance for pattern=${locator.patternId} index=${locator.tripIndex}`,
      };
    }

    const occurrenceCount = new Map<string, number>();
    const stopTimes: TripStopTime[] = stopSequence.map((stopId, stopIndex) => {
      const occ = occurrenceCount.get(stopId) ?? 0;
      occurrenceCount.set(stopId, occ + 1);
      const stop = STOPS.find((candidate) => candidate.stop_id === stopId);
      const departureMinutes = baseMinutes + computeOccOffset(routeId, occ);
      const arrivalMinutes = computeArrivalMinutes(routeId, occ, departureMinutes);
      const { pickupType, dropOffType } = getBoardingTypes(routeId, headsign, stopId, occ);
      const stopMeta =
        stop == null
          ? undefined
          : {
              stop,
              agencies: STOP_AGENCIES.get(stopId) ?? [],
              routes: STOP_ROUTES_RESOLVED.get(stopId) ?? [],
            };
      return {
        stopMeta,
        routeTypes: stop == null ? [] : (STOP_ROUTE_TYPES.get(stopId) ?? []),
        timetableEntry: {
          tripLocator: locator,
          schedule: {
            departureMinutes,
            arrivalMinutes,
          },
          routeDirection: {
            route,
            tripHeadsign: { name: headsign, names: {} },
            stopHeadsign: headsign !== '' ? { name: headsign, names: {} } : undefined,
          },
          boarding: {
            pickupType,
            dropOffType,
          },
          patternPosition: {
            stopIndex,
            totalStops: stopSequence.length,
            isTerminal: stopIndex === stopSequence.length - 1,
            isOrigin: stopIndex === 0,
          },
        },
      };
    });

    const snapshot: TripSnapshot = {
      locator,
      serviceDate,
      route,
      tripHeadsign: { name: headsign, names: {} },
      stopTimes,
    };
    return { success: true, data: snapshot };
  }

  /** {@inheritDoc TransitRepository.getStopMetaById} */
  getStopMetaById(stopId: string): Promise<Result<StopWithMeta>> {
    const stop = STOPS.find((s) => s.stop_id === stopId);
    if (stop) {
      return Promise.resolve({
        success: true,
        data: {
          stop,
          agencies: STOP_AGENCIES.get(stopId) ?? [],
          routes: STOP_ROUTES_RESOLVED.get(stopId) ?? [],
        },
      });
    }
    return Promise.resolve({ success: false, error: `Stop not found: ${stopId}` });
  }

  /** {@inheritDoc TransitRepository.getStopMetaByIds} */
  getStopMetaByIds(stopIds: Set<string>): StopWithMeta[] {
    const result: StopWithMeta[] = [];
    for (const stopId of stopIds) {
      const stop = STOPS.find((s) => s.stop_id === stopId);
      if (stop) {
        result.push({
          stop,
          agencies: STOP_AGENCIES.get(stopId) ?? [],
          routes: STOP_ROUTES_RESOLVED.get(stopId) ?? [],
        });
      }
    }
    return result;
  }

  /** {@inheritDoc TransitRepository.getStopsForRoutes} */
  getStopsForRoutes(routeIds: Set<string>): Set<string> {
    const stopIds = new Set<string>();
    for (const [key, stops] of ROUTE_STOP_SEQUENCES) {
      const routeId = key.split('__')[0];
      if (routeIds.has(routeId)) {
        for (const stopId of stops) {
          stopIds.add(stopId);
        }
      }
    }
    return stopIds;
  }

  /** {@inheritDoc TransitRepository.getAllStops} */
  getAllStops(): Promise<CollectionResult<Stop>> {
    return Promise.resolve({ success: true, data: STOPS, truncated: false });
  }

  /** {@inheritDoc TransitRepository.getAgency} */
  getAgency(agencyId: string): Promise<Result<Agency>> {
    const agency = AGENCY_MAP.get(agencyId);
    if (agency) {
      return Promise.resolve({ success: true, data: agency });
    }
    return Promise.resolve({ success: false, error: `Agency not found: ${agencyId}` });
  }

  /** {@inheritDoc TransitRepository.resolveStopStats} */
  resolveStopStats(_stopId: string, _serviceDate: Date): StopWithMeta['stats'] | undefined {
    // MockRepository does not have real insights data; return undefined.
    return undefined;
  }

  /** {@inheritDoc TransitRepository.resolveRouteFreq} */
  resolveRouteFreq(routeId: string, serviceDate: Date): number | undefined {
    // Return exaggerated weekday/weekend freq difference for visual testing.
    // Weekday: high freq (thick lines), Weekend: low freq (thin lines).
    const day = getServiceDay(serviceDate).getDay(); // 0=Sun, 6=Sat
    const isWeekend = day === 0 || day === 6;
    const route = ROUTE_MAP.get(routeId);
    if (!route || route.route_type !== 3) {
      return undefined; // Only bus routes have freq
    }
    return isWeekend ? 10 : 300;
  }

  /** {@inheritDoc TransitRepository.getAllSourceMeta} */
  getAllSourceMeta(): Promise<CollectionResult<SourceMeta>> {
    const meta: SourceMeta = {
      id: 'mock',
      name: 'あおバス',
      version: 'mock-1.0',
      validity: {
        startDate: '20260101',
        endDate: '20261231',
      },
      routeTypes: [0, 1, 2, 3, 6],
      keywords: [],
      stats: {
        stopCount: STOPS.length,
        routeCount: ROUTES.length,
      },
    };
    return Promise.resolve({ success: true, data: [meta], truncated: false });
  }
}
