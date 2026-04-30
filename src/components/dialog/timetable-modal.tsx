import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TimetableGrid } from '../timetable/timetable-grid';
import { TimetableHeader } from '../timetable/timetable-header';
import { TimetableMetadata } from '../timetable/timetable-metadata';
import { TimetableHeadsignFilter } from '../timetable/timetable-headsign-filter';
import { TimetableBoardabilityFilter } from '../timetable/timetable-boardability-filter';
import { TimetableOriginFilter } from '../timetable/timetable-origin-filter';
import { ScrollFadeEdge } from '@/components/shared/scroll-fade-edge';
import { findRouteDirectionForHeadsign } from '@/domain/transit/find-route-direction-for-headsign';
import { getStopDisplayNames } from '@/domain/transit/get-stop-display-names';
import { getRouteHeadsignKey } from '../../domain/transit/get-route-headsign-key';
import { filterByStopEventAttributes } from '@/domain/transit/timetable-filter';
import { computeTimetableEntryStats } from '@/domain/transit/timetable-stats';
import type { TimetableEntryStats } from '@/domain/transit/timetable-stats';
import { getServiceDayMinutes } from '@/domain/transit/service-day';
import { useScrollFades } from '@/hooks/use-scroll-fades';
import type { InfoLevel } from '@/types/app/settings';
import type { Agency, Route, Stop, StopServiceState } from '@/types/app/transit';
import type { TimetableEntry, TripInspectionTarget } from '@/types/app/transit-composed';
import type { TimetableOmitted } from '@/types/app/repository';
import { useInfoLevel } from '@/hooks/use-info-level';
import { DAY_COLOR_CATEGORY_CLASSES } from '@/utils/day-of-week';
import { formatDateParts } from '@/utils/datetime';
import { DEFAULT_TIMEZONE, resolveAgencyLang } from '@/config/transit-defaults';
import { getEffectiveHeadsign } from '@/domain/transit/get-effective-headsign';
import { getSelectedHeadsignDisplayName } from '@/domain/transit/get-headsign-display-names';
import { getRouteDisplayNames } from '@/domain/transit/get-route-display-names';
import { hasUnknownDestination } from '@/domain/transit/has-unknown-destination';
import { VerboseTimetableSummary } from '@/components/verbose/verbose-timetable-summary';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** Data needed to render the timetable modal. */
export interface TimetableData {
  type: 'route-headsign' | 'stop';
  stop: Stop;
  /** Routes serving this stop in this timetable context.
   *  For route-headsign: single route. For stop: all routes. */
  routes: Route[];
  /** Headsign filter. Present only for route-headsign type. */
  headsign?: string;
  /** GTFS service date for this timetable (not real-world time). */
  serviceDate: Date;
  timetableEntries: TimetableEntry[];
  omitted: TimetableOmitted;
  /** Service state derived from the full service day before filtering. */
  stopServiceState: StopServiceState;
  agencies: Agency[];
}

interface TimetableModalProps {
  /** Pass null when the modal should be closed. */
  data: TimetableData | null;
  /** Current time reference for highlighting the active hour row. */
  time: Date;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLangs: readonly string[];
  /**
   * Initial value of the boardable-only filter toggle. When true, the
   * dialog opens with the filter ON (= the user can still toggle it
   * off via the filter pill). The value is read once at mount; pair
   * with a stable `key` on `<TimetableModal>` so the dialog re-mounts
   * (= re-evaluates the initial value) per stop.
   */
  boardableOnly: boolean;
  onInspectTrip?: (target: TripInspectionTarget) => void;
  onClose: () => void;
}

interface EntriesPanelProps {
  timetableEntries: TimetableEntry[];
  entryStats: TimetableEntryStats;
  agencies: Agency[];
  dataLangs: readonly string[];
  filteredCount: number;
}

/**
 * The "all entries" overview block: stats summary for the unfiltered
 * entry set plus the filter toggles that operate on it (headsign /
 * origin-only / boardability).
 */
function EntriesPanel({
  timetableEntries,
  entryStats,
  dataLangs,
  agencies,
  filteredCount,
}: EntriesPanelProps) {
  return (
    <>
      {filteredCount > 0 && (
        <TimetableMetadata
          timetableEntries={timetableEntries}
          dataLang={dataLangs}
          agencies={agencies}
          stats={entryStats}
        />
      )}
    </>
  );
}

/** Date and time label shown at the bottom of the dialog header. */
function TimetableDateLabel({
  serviceDate,
  time,
  lang,
}: {
  serviceDate: Date;
  time: Date;
  lang: string;
}) {
  const { dateText, dayLabel, dayColorCategory } = formatDateParts(
    serviceDate,
    lang,
    DEFAULT_TIMEZONE,
    { showYear: true },
  );
  const { time: currentTimeText } = formatDateParts(time, lang, DEFAULT_TIMEZONE, {
    showTime: true,
  });
  // Weekday inherits the parent's muted color; only sat/sun/holiday get color override.
  const dayLabelClass =
    dayColorCategory === 'weekday' ? undefined : DAY_COLOR_CATEGORY_CLASSES[dayColorCategory];

  return (
    <p className="text-muted-foreground m-0 text-center font-normal">
      {dateText} <span className={dayLabelClass}>({dayLabel})</span> {currentTimeText}
    </p>
  );
}

export function TimetableModal({
  data,
  time,
  infoLevel,
  dataLangs,
  boardableOnly,
  onInspectTrip,
  onClose,
}: TimetableModalProps) {
  const { t, i18n } = useTranslation();
  const open = data !== null;
  const info = useInfoLevel(infoLevel);
  const currentHour = Math.floor(getServiceDayMinutes(time) / 60);
  const headerContainerRef = useRef<HTMLDivElement | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  // Filter state for stop timetable (route+headsign toggle).
  // Empty set = show all timetable (no filter active).
  const [activeFilters, setActiveFilters] = useState<Set<string>>(() => new Set());

  // Boardable-only filter toggle. Initial value comes from the
  // `boardableOnly` prop (read once at mount; the caller should use a
  // `key` on <TimetableModal> to re-mount per stop).
  const [showBoardableOnly, setShowBoardableOnly] = useState(boardableOnly);

  // Origin-only filter toggle (= 始発のみ). OFF by default.
  // When ON, narrows to entries whose patternPosition.isOrigin is true,
  // applied on top of any other active filters.
  const [showOriginOnly, setShowOriginOnly] = useState(false);

  const toggleFilter = useCallback((key: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleBoardableOnly = useCallback(() => {
    setShowBoardableOnly((prev) => !prev);
  }, []);

  const toggleOriginOnly = useCallback(() => {
    setShowOriginOnly((prev) => !prev);
  }, []);

  // Both timetable types now use TimetableEntry[] directly.
  const allTimetableEntries: TimetableEntry[] = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.timetableEntries;
  }, [data]);
  // const allEntriesStats = computeTimetableEntryStats( allTimetableEntries, data?.agencies ?? [], dataLangs,);

  const entriesBeforeRouteHeadsignFilter = useMemo(() => {
    let entries = allTimetableEntries;
    if (showOriginOnly) {
      entries = filterByStopEventAttributes(entries, {
        position: new Set(['origin']),
      });
    }
    if (showBoardableOnly) {
      entries = filterByStopEventAttributes(entries, {
        pickUpState: new Set(['boardable']),
        position: new Set(['origin', 'middle']),
      });
    }
    return entries;
  }, [allTimetableEntries, showOriginOnly, showBoardableOnly]);
  const entriesBeforeRouteHeadsignFilterStats = computeTimetableEntryStats(
    entriesBeforeRouteHeadsignFilter,
    data?.agencies ?? [],
    dataLangs,
  );

  const routeHeadsignFilteredEntries = useMemo(() => {
    let entries = entriesBeforeRouteHeadsignFilter;
    if (activeFilters.size > 0) {
      entries = entries.filter((entry) =>
        activeFilters.has(getRouteHeadsignKey(entry.routeDirection)),
      );
    }
    return entries;
  }, [entriesBeforeRouteHeadsignFilter, activeFilters]);
  const routeHeadsignFilteredEntriesStats = computeTimetableEntryStats(
    routeHeadsignFilteredEntries,
    data?.agencies ?? [],
    dataLangs,
  );

  const descriptionHeadsign = useMemo(() => {
    if (!data?.headsign || data.type !== 'route-headsign') {
      return '';
    }

    const routeDirection = findRouteDirectionForHeadsign(data.timetableEntries, data.headsign);
    if (!routeDirection) {
      return data.headsign;
    }

    return getSelectedHeadsignDisplayName(
      routeDirection,
      data.headsign,
      dataLangs,
      resolveAgencyLang(data.agencies, routeDirection.route.agency_id),
    );
  }, [data, dataLangs]);

  const headerScroll = useScrollFades(
    headerContainerRef,
    `${data?.type ?? 'closed'}:${data?.headsign ?? ''}:${entriesBeforeRouteHeadsignFilter.length}:${infoLevel}`,
  );
  const gridScroll = useScrollFades(
    gridContainerRef,
    `${data?.type ?? 'closed'}:${entriesBeforeRouteHeadsignFilter.length}:${infoLevel}:${currentHour}`,
  );

  if (!data) {
    return (
      <Dialog open={false} onOpenChange={() => onClose()}>
        <DialogContent />
      </Dialog>
    );
  }

  const descriptionStopName = getStopDisplayNames(
    data.stop,
    dataLangs,
    resolveAgencyLang(data.agencies, data.stop.agency_id),
  ).name;
  let timetableDescription: string;

  if (data.type === 'route-headsign') {
    const route = data.routes[0];
    const descriptionRouteName = route
      ? getRouteDisplayNames(
          route,
          dataLangs,
          resolveAgencyLang(data.agencies, route.agency_id),
          'short',
        ).resolved.name
      : '';

    timetableDescription = t(
      data.headsign
        ? 'timetable.header.routeHeadsignDescription'
        : 'timetable.header.routeDescription',
      {
        stop: descriptionStopName,
        route: descriptionRouteName,
        headsign: descriptionHeadsign,
        count: entriesBeforeRouteHeadsignFilter.length.toLocaleString(i18n.language),
      },
    );
  } else {
    timetableDescription = t('timetable.header.stopDescription', {
      stop: descriptionStopName,
      count: entriesBeforeRouteHeadsignFilter.length.toLocaleString(i18n.language),
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          onClose();
          setActiveFilters(new Set());
        }
      }}
    >
      {/* border-4: intentional thick border to visually distinguish the timetable modal from the map background */}
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[80dvh] max-w-[90dvw] flex-col gap-0 overflow-hidden border-4 p-0 sm:max-w-[90dvw]"
      >
        <div
          ref={headerContainerRef}
          onScroll={headerScroll.handleScroll}
          className="border-border relative max-h-[40dvh] shrink-0 overflow-y-auto border-b"
        >
          {headerScroll.showTop && (
            <ScrollFadeEdge position="top" className="via-background/90 -mb-5 h-5" />
          )}
          <DialogHeader className="p-4 text-left">
            {info.isVerboseEnabled && (
              <VerboseTimetableSummary
                type={data.type}
                headsign={data.headsign}
                serviceDate={data.serviceDate}
                timetableEntries={entriesBeforeRouteHeadsignFilter}
                omitted={data.omitted}
                stopServiceState={data.stopServiceState}
              />
            )}
            <DialogTitle className="sr-only">{t('timetable.title')}</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              {timetableDescription}
            </DialogDescription>

            <TimetableHeader
              type={data.type}
              stop={data.stop}
              routes={data.routes}
              agencies={data.agencies}
              stopServiceState={data.stopServiceState}
              infoLevel={infoLevel}
              dataLangs={dataLangs}
            />

            {/* All entries */}
            {/* {info.isVerboseEnabled && (
              <EntriesPanel
                timetableEntries={allTimetableEntries}
                entryStats={allEntriesStats}
                agencies={data.agencies}
                dataLangs={dataLangs}
                filteredCount={allTimetableEntries.length}
              />
            )} */}

            {/* entriesBeforeRouteHeadsignFilter */}
            {/* {info.isVerboseEnabled && (
              <EntriesPanel
                timetableEntries={entriesBeforeRouteHeadsignFilter}
                entryStats={entriesBeforeRouteHeadsignFilterStats}
                agencies={data.agencies}
                dataLangs={dataLangs}
                filteredCount={entriesBeforeRouteHeadsignFilter.length}
              />
            )} */}

            {/* routeHeadsignFilteredEntriesStats */}
            {info.isDetailedEnabled && (
              <EntriesPanel
                timetableEntries={routeHeadsignFilteredEntries}
                entryStats={routeHeadsignFilteredEntriesStats}
                agencies={data.agencies}
                dataLangs={dataLangs}
                filteredCount={routeHeadsignFilteredEntries.length}
              />
            )}

            {/* Date time */}
            <TimetableDateLabel serviceDate={data.serviceDate} time={time} lang={dataLangs[0]} />

            <div className="flex flex-wrap gap-1">
              {/* Origin filter — hidden when no origin entries exist at this stop */}
              {entriesBeforeRouteHeadsignFilterStats.originCount > 0 && (
                <TimetableOriginFilter
                  origin={showOriginOnly}
                  count={entriesBeforeRouteHeadsignFilterStats.originCount}
                  onToggleOrigin={toggleOriginOnly}
                />
              )}
              {/* Boardability filter */}
              {/* {filteredEntriesStats.nonBoardableCount > 0 && ( */}
              <TimetableBoardabilityFilter
                boardable={showBoardableOnly}
                count={entriesBeforeRouteHeadsignFilterStats.boardableCount}
                onToggleBoardable={toggleBoardableOnly}
              />
              {/* )} */}
              {/* Headsign filter */}
              {data.type === 'stop' && (
                <TimetableHeadsignFilter
                  timetableEntries={entriesBeforeRouteHeadsignFilter}
                  activeFilters={activeFilters}
                  onToggleFilter={toggleFilter}
                  dataLang={dataLangs}
                  agencies={data.agencies}
                />
              )}
            </div>
            {/* Unknown destination warning */}
            {((data.type === 'route-headsign' && data.headsign === '') ||
              (data.type === 'stop' &&
                hasUnknownDestination(
                  data.timetableEntries.map((d) => ({
                    headsign: getEffectiveHeadsign(d.routeDirection),
                  })),
                ))) && (
              <p className="m-0 text-center text-[11px] text-amber-600 dark:text-amber-400">
                {t('timetable.header.noDestination')}
              </p>
            )}
          </DialogHeader>
          {headerScroll.showBottom && (
            <ScrollFadeEdge position="bottom" className="via-background/90 -mt-5 h-5" />
          )}
        </div>
        <div
          ref={gridContainerRef}
          onScroll={gridScroll.handleScroll}
          className="relative min-h-0 flex-1 overflow-y-auto"
        >
          {gridScroll.showTop && (
            <ScrollFadeEdge position="top" className="via-background/90 -mb-5 h-5" />
          )}
          <div className="px-4 pt-3 pb-4">
            <TimetableGrid
              timetableEntries={routeHeadsignFilteredEntries}
              serviceDate={data.serviceDate}
              showHeadsign={
                info.isVerboseEnabled ||
                new Set(
                  routeHeadsignFilteredEntries.map((entry) =>
                    getRouteHeadsignKey(entry.routeDirection),
                  ),
                ).size > 1
              }
              currentHour={currentHour}
              infoLevel={infoLevel}
              dataLangs={dataLangs}
              agencies={data.agencies}
              omitted={data.omitted}
              onInspectTrip={onInspectTrip}
            />
          </div>
          {gridScroll.showBottom && (
            <ScrollFadeEdge position="bottom" className="via-background/90 -mt-5 h-5" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
