import { useCallback, useRef, useState } from 'react';

import { getServiceDay } from '@/domain/transit/service-day';
import {
  prepareRouteHeadsignTimetable,
  prepareStopTimetable,
} from '@/domain/transit/timetable-filter';
import { getStopServiceState } from '@/domain/transit/timetable-utils';
import { createLogger } from '@/lib/logger';
import type { TransitRepository } from '@/repositories/transit-repository';
import type { Result, TimetableResult } from '@/types/app/repository';
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

export interface UseTimetableReturn {
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
): Promise<Result<StopWithMeta>> {
  return repo.getStopMetaById(stopId);
}

function resolveTimetableRoutes(filter: TimetableFilter, meta: StopWithMeta): Route[] {
  if (filter.type !== 'route-headsign') {
    return meta.routes;
  }

  return meta.routes.filter((route) => route.route_id === filter.routeId);
}

function resolveTimetableRoutesResult(
  filter: TimetableFilter,
  meta: StopWithMeta,
):
  | { ok: true; routes: Route[] }
  | {
      ok: false;
      routeId: string;
      headsign: string;
    } {
  const routes = resolveTimetableRoutes(filter, meta);

  if (filter.type !== 'route-headsign') {
    return { ok: true, routes };
  }

  if (routes.length === 0) {
    return {
      ok: false,
      routeId: filter.routeId,
      headsign: filter.headsign,
    };
  }

  return { ok: true, routes };
}

function normalizeTimetableResult(result: Extract<TimetableResult, { success: true }>) {
  return {
    allEntries: result.data,
    isBoardableOnServiceDay: result.meta.isBoardableOnServiceDay,
    totalEntries: result.meta.totalEntries,
  };
}

function buildTimetableEntries(
  filter: TimetableFilter,
  result: Extract<TimetableResult, { success: true }>,
) {
  const { allEntries, isBoardableOnServiceDay, totalEntries } = normalizeTimetableResult(result);

  if (filter.type === 'route-headsign') {
    const prepared = prepareRouteHeadsignTimetable(
      allEntries,
      filter.routeId,
      filter.headsign,
      true,
    );
    return {
      isBoardableOnServiceDay,
      totalEntries,
      entries: prepared.entries,
      omitted: prepared.omitted,
    };
  }

  const prepared = prepareStopTimetable(allEntries, true);
  return {
    isBoardableOnServiceDay,
    totalEntries,
    entries: prepared.entries,
    omitted: prepared.omitted,
  };
}

function formatTimetableDebugMessage(params: {
  filter: TimetableFilter;
  stopId: string;
  entriesCount: number;
  omittedNonBoardable: number;
  totalEntries: number;
}): string {
  let routeSuffix = '';
  if (params.filter.type === 'route-headsign') {
    routeSuffix = ` ${params.filter.routeId} "${params.filter.headsign}"`;
  }

  return `timetable(${params.filter.type}): ${params.stopId}${routeSuffix} → entries=${params.entriesCount} omitted.nonBoardable=${params.omittedNonBoardable} total=${params.totalEntries}`;
}

function formatUnknownError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
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
        // Resolve stop metadata first so unknown stops short-circuit before the
        // full timetable scan for that stop/service day runs.
        const stopMetaResult = await loadTimetableStopMeta(repo, stopId);
        if (requestIdRef.current !== requestId) {
          return { status: 'cancelled' };
        }

        if (!stopMetaResult.success) {
          logger.warn('openTimetable: stop metadata not found', {
            stopId,
            filter,
            error: stopMetaResult.error,
          });
          return { status: 'not-found' };
        }
        const meta = stopMetaResult.data;

        const routesResult = resolveTimetableRoutesResult(filter, meta);
        if (!routesResult.ok) {
          logger.warn('openTimetable: route metadata not found for stop', {
            stopId,
            routeId: routesResult.routeId,
            headsign: routesResult.headsign,
          });
          return { status: 'route-not-found' };
        }
        const { routes } = routesResult;

        const timetableResult = await repo.getFullDayTimetableEntries(stopId, dateTime);
        if (requestIdRef.current !== requestId) {
          return { status: 'cancelled' };
        }

        if (!timetableResult.success) {
          logger.warn('openTimetable: timetable lookup failed', {
            stopId,
            filter,
            error: timetableResult.error,
          });
          return { status: 'error' };
        }

        const { isBoardableOnServiceDay, totalEntries, entries, omitted } = buildTimetableEntries(
          filter,
          timetableResult,
        );
        const headsign = filter.type === 'route-headsign' ? filter.headsign : undefined;

        if (logger.isEnabled('debug')) {
          logger.debug(
            formatTimetableDebugMessage({
              filter,
              stopId,
              entriesCount: entries.length,
              omittedNonBoardable: omitted.nonBoardable,
              totalEntries,
            }),
          );
        }

        setTimetableData({
          type: filter.type,
          stop: meta.stop,
          routes,
          headsign,
          serviceDate: getServiceDay(dateTime),
          timetableEntries: entries,
          omitted,
          stopServiceState: getStopServiceState({
            totalEntries,
            isBoardableOnServiceDay,
          }),
          agencies: meta.agencies,
        });

        return { status: 'opened' };
      } catch (error: unknown) {
        if (requestIdRef.current !== requestId) {
          return { status: 'cancelled' };
        }

        logger.warn('openTimetable: unexpected error', {
          stopId,
          filter,
          error: formatUnknownError(error),
        });
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
