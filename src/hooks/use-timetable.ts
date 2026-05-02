import { useCallback, useRef, useState } from 'react';

import { getServiceDay } from '@/domain/transit/service-day';
import {
  prepareRouteHeadsignTimetable,
  prepareStopTimetable,
} from '@/domain/transit/timetable-filter';
import { getStopServiceState } from '@/domain/transit/timetable-utils';
import { createLogger } from '@/lib/logger';
import type { TransitRepository } from '@/repositories/transit-repository';
import type { TimetableResult } from '@/types/app/repository';
import type { Route } from '@/types/app/transit';
import type { StopWithMeta } from '@/types/app/transit-composed';
import type { TimetableData } from '@/types/app/timetable';

const logger = createLogger('Timetable');

interface OpenStopTimetableParams {
  dateTime: Date;
  stopId: string;
}

interface OpenRouteHeadsignTimetableParams extends OpenStopTimetableParams {
  routeId: string;
  headsign: string;
}

type TimetableFilter =
  | { type: 'route-headsign'; routeId: string; headsign: string }
  | { type: 'stop' };

export type TimetableOpenOutcome =
  | { status: 'opened' }
  | { status: 'cancelled' }
  | { status: 'not-found' }
  | { status: 'route-not-found' }
  | { status: 'error' };

interface UseTimetableReturn {
  timetableData: TimetableData | null;
  openStopTimetable: (params: OpenStopTimetableParams) => Promise<TimetableOpenOutcome>;
  openRouteHeadsignTimetable: (
    params: OpenRouteHeadsignTimetableParams,
  ) => Promise<TimetableOpenOutcome>;
  closeTimetable: () => void;
}

async function loadTimetableStopMeta(
  repo: TransitRepository,
  stopId: string,
): Promise<StopWithMeta | null> {
  const result = await repo.getStopMetaById(stopId);
  if (!result.success) {
    return null;
  }

  return result.data;
}

function resolveTimetableRoutes(filter: TimetableFilter, meta: StopWithMeta): Route[] {
  if (filter.type !== 'route-headsign') {
    return meta.routes;
  }

  return meta.routes.filter((route) => route.route_id === filter.routeId);
}

function normalizeTimetableResult(result: TimetableResult) {
  if (!result.success) {
    return {
      allEntries: [],
      isBoardableOnServiceDay: false,
    };
  }

  return {
    allEntries: result.data,
    isBoardableOnServiceDay: result.meta.isBoardableOnServiceDay,
  };
}

function buildTimetableEntries(filter: TimetableFilter, result: TimetableResult) {
  const { allEntries, isBoardableOnServiceDay } = normalizeTimetableResult(result);

  if (filter.type === 'route-headsign') {
    const prepared = prepareRouteHeadsignTimetable(
      allEntries,
      filter.routeId,
      filter.headsign,
      true,
    );
    return {
      allEntries,
      isBoardableOnServiceDay,
      entries: prepared.entries,
      omitted: prepared.omitted,
      headsign: filter.headsign,
    };
  }

  const prepared = prepareStopTimetable(allEntries, true);
  return {
    allEntries,
    isBoardableOnServiceDay,
    entries: prepared.entries,
    omitted: prepared.omitted,
    headsign: undefined,
  };
}

function formatTimetableDebugMessage(params: {
  filter: TimetableFilter;
  stopId: string;
  headsign?: string;
  entriesCount: number;
  omittedNonBoardable: number;
  totalEntries: number;
}): string {
  let routeSuffix = '';
  if (params.filter.type === 'route-headsign') {
    routeSuffix = ` ${params.filter.routeId} "${params.headsign}"`;
  }

  return `timetable(${params.filter.type}): ${params.stopId}${routeSuffix} → entries=${params.entriesCount} omitted.nonBoardable=${params.omittedNonBoardable} total=${params.totalEntries}`;
}

export function useTimetable(repo: TransitRepository): UseTimetableReturn {
  const [timetableData, setTimetableData] = useState<TimetableData | null>(null);
  const requestIdRef = useRef(0);

  const openTimetable = useCallback(
    async (
      params: OpenStopTimetableParams,
      filter: TimetableFilter,
    ): Promise<TimetableOpenOutcome> => {
      const { dateTime, stopId } = params;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      try {
        const meta = await loadTimetableStopMeta(repo, stopId);
        if (requestIdRef.current !== requestId) {
          return { status: 'cancelled' };
        }

        if (!meta) {
          logger.warn('openTimetable: stop metadata not found', { stopId, filter });
          return { status: 'not-found' };
        }

        const routes = resolveTimetableRoutes(filter, meta);
        if (filter.type === 'route-headsign' && routes.length === 0) {
          logger.warn('openTimetable: route metadata not found for stop', {
            stopId,
            routeId: filter.routeId,
            headsign: filter.headsign,
          });
          return { status: 'route-not-found' };
        }

        const result = await repo.getFullDayTimetableEntries(stopId, dateTime);
        if (requestIdRef.current !== requestId) {
          return { status: 'cancelled' };
        }

        const { allEntries, isBoardableOnServiceDay, entries, omitted, headsign } =
          buildTimetableEntries(filter, result);

        logger.debug(
          formatTimetableDebugMessage({
            filter,
            stopId,
            headsign,
            entriesCount: entries.length,
            omittedNonBoardable: omitted.nonBoardable,
            totalEntries: allEntries.length,
          }),
        );

        setTimetableData({
          type: filter.type,
          stop: meta.stop,
          routes,
          headsign,
          serviceDate: getServiceDay(dateTime),
          timetableEntries: entries,
          omitted,
          stopServiceState: getStopServiceState({
            totalEntries: allEntries.length,
            isBoardableOnServiceDay,
          }),
          agencies: meta.agencies,
        });

        return { status: 'opened' };
      } catch (error: unknown) {
        if (requestIdRef.current !== requestId) {
          return { status: 'cancelled' };
        }

        logger.warn('openTimetable: unexpected error', { stopId, filter, error });
        return { status: 'error' };
      }
    },
    [repo],
  );

  const openStopTimetable = useCallback(
    (params: OpenStopTimetableParams) => openTimetable(params, { type: 'stop' }),
    [openTimetable],
  );

  const openRouteHeadsignTimetable = useCallback(
    (params: OpenRouteHeadsignTimetableParams) =>
      openTimetable(params, {
        type: 'route-headsign',
        routeId: params.routeId,
        headsign: params.headsign,
      }),
    [openTimetable],
  );

  const closeTimetable = useCallback(() => {
    requestIdRef.current += 1;
    setTimetableData(null);
  }, []);

  return {
    timetableData,
    openStopTimetable,
    openRouteHeadsignTimetable,
    closeTimetable,
  };
}
