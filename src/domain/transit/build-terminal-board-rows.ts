import type { ContextualTimetableEntry, StopWithContext } from '../../types/app/transit-composed';
import { minutesToDate } from './calendar-utils';
import { getHeadsignDisplayNames } from './name-resolver/get-headsign-display-names';
import { getRouteDisplayNames } from './name-resolver/get-route-display-names';
import { getStopDisplayNames } from './name-resolver/get-stop-display-names';
import { sortTimetableEntriesByDisplayTimeChronologically } from './sort-timetable-for-ui';
import { formatAbsoluteTime } from './time';
import { getDisplayMinutes } from './timetable-utils';

export const TERMINAL_BOARD_MAX_ROWS = 12;

export interface TerminalBoardRow {
  key: string;
  stopId: string;
  stopName: string;
  routeName: string;
  headsign: string;
  timeText: string;
  isArrival: boolean;
}

interface TerminalBoardSortableEntry extends ContextualTimetableEntry {
  terminalBoardRowKey: string;
}

interface TerminalBoardRowMeta {
  stopId: string;
  stopName: string;
  routeName: string;
  headsign: string;
}

export function buildTerminalBoardRows(
  stops: readonly StopWithContext[],
  preferredDisplayLangs: readonly string[],
  maxRows: number = TERMINAL_BOARD_MAX_ROWS,
): TerminalBoardRow[] {
  const metaByKey = new Map<string, TerminalBoardRowMeta>();
  const entries: TerminalBoardSortableEntry[] = [];

  for (const stopWithContext of stops) {
    const agencyLangs = stopWithContext.agencies.map((agency) => agency.agency_lang);
    const stopName = getStopDisplayNames(
      stopWithContext.stop,
      preferredDisplayLangs,
      agencyLangs,
    ).name;

    for (const entry of stopWithContext.stopTimes) {
      const key = [
        stopWithContext.stop.stop_id,
        entry.tripLocator.patternId,
        entry.tripLocator.serviceId,
        entry.tripLocator.tripIndex,
        entry.patternPosition.stopIndex,
      ].join('__');
      const routeAgency = stopWithContext.agencies.find(
        (agency) => agency.agency_id === entry.routeDirection.route.agency_id,
      );
      const routeAgencyLangs = routeAgency ? [routeAgency.agency_lang] : agencyLangs;
      const routeName = getRouteDisplayNames(
        entry.routeDirection.route,
        preferredDisplayLangs,
        routeAgencyLangs,
        'short',
      ).resolved.name;
      const headsign = getHeadsignDisplayNames(
        entry.routeDirection,
        preferredDisplayLangs,
        routeAgencyLangs,
        'stop',
      ).resolved.name;

      metaByKey.set(key, {
        stopId: stopWithContext.stop.stop_id,
        stopName,
        routeName,
        headsign,
      });
      entries.push({ ...entry, terminalBoardRowKey: key });
    }
  }

  return sortTimetableEntriesByDisplayTimeChronologically(entries)
    .slice(0, maxRows)
    .map((entry) => {
      const meta = metaByKey.get(entry.terminalBoardRowKey);
      if (!meta) {
        throw new Error(`Missing terminal board row meta for key: ${entry.terminalBoardRowKey}`);
      }
      return {
        key: entry.terminalBoardRowKey,
        stopId: meta.stopId,
        stopName: meta.stopName,
        routeName: meta.routeName,
        headsign: meta.headsign,
        timeText: formatAbsoluteTime(minutesToDate(entry.serviceDate, getDisplayMinutes(entry))),
        isArrival: entry.patternPosition.isTerminal,
      };
    });
}
