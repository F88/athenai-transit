import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TimetableGrid } from '../timetable/timetable-grid';
import { TimetableHeader } from '../timetable/timetable-header';
import { TimetableMetadata } from '../timetable/timetable-metadata';
import { StopTimetableFilter } from '../timetable/stop-timetable-filter';
import { findRouteDirectionForHeadsign } from '@/domain/transit/find-route-direction-for-headsign';
import { getStopDisplayNames } from '@/domain/transit/get-stop-display-names';
import { getRouteHeadsignKey } from '../../domain/transit/get-route-headsign-key';
import { getServiceDayMinutes } from '@/domain/transit/service-day';
import type { InfoLevel } from '@/types/app/settings';
import type { Agency, Route, Stop, StopServiceState } from '@/types/app/transit';
import type { TimetableEntry } from '@/types/app/transit-composed';
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
  /** Whether at least one non-drop-off-only entry (pickupType !== 1, non-terminal) exists in the full service day. */
  isBoardableOnServiceDay: boolean;
  /** Service state derived from the full service day before filtering. */
  serviceState: StopServiceState;
  agencies: Agency[];
}

interface TimetableModalProps {
  /** Pass null when the modal should be closed. */
  data: TimetableData | null;
  /** Current time reference for highlighting the active hour row. */
  time: Date;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  onClose: () => void;
}

export function TimetableModal({ data, time, infoLevel, dataLang, onClose }: TimetableModalProps) {
  const { t, i18n } = useTranslation();
  const open = data !== null;
  const info = useInfoLevel(infoLevel);
  const currentHour = Math.floor(getServiceDayMinutes(time) / 60);
  const headerContainerRef = useRef<HTMLDivElement | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  // Filter state for stop timetable (route+headsign toggle).
  // Empty set = show all timetable (no filter active).
  const [activeFilters, setActiveFilters] = useState<Set<string>>(() => new Set());

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

  // Both timetable types now use TimetableEntry[] directly.
  const allTimetableEntries: TimetableEntry[] = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.timetableEntries;
  }, [data]);

  const filteredTimetableEntries = useMemo(() => {
    if (!data || data.type !== 'stop' || activeFilters.size === 0) {
      return allTimetableEntries;
    }
    return allTimetableEntries.filter((entry) =>
      activeFilters.has(getRouteHeadsignKey(entry.routeDirection)),
    );
  }, [data, allTimetableEntries, activeFilters]);

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
      dataLang,
      resolveAgencyLang(data.agencies, routeDirection.route.agency_id),
    );
  }, [data, dataLang]);

  const headerScroll = useScrollFades(
    headerContainerRef,
    `${data?.type ?? 'closed'}:${data?.headsign ?? ''}:${filteredTimetableEntries.length}:${infoLevel}`,
  );
  const gridScroll = useScrollFades(
    gridContainerRef,
    `${data?.type ?? 'closed'}:${filteredTimetableEntries.length}:${infoLevel}:${currentHour}`,
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
    dataLang,
    resolveAgencyLang(data.agencies, data.stop.agency_id),
  ).name;
  let timetableDescription: string;

  if (data.type === 'route-headsign') {
    const route = data.routes[0];
    const descriptionRouteName = route
      ? getRouteDisplayNames(route, dataLang, resolveAgencyLang(data.agencies, route.agency_id))
          .resolved.name
      : '';

    timetableDescription = t(
      data.headsign
        ? 'timetable.header.routeHeadsignDescription'
        : 'timetable.header.routeDescription',
      {
        stop: descriptionStopName,
        route: descriptionRouteName,
        headsign: descriptionHeadsign,
        count: filteredTimetableEntries.length.toLocaleString(i18n.language),
      },
    );
  } else {
    timetableDescription = t('timetable.header.stopDescription', {
      stop: descriptionStopName,
      count: filteredTimetableEntries.length.toLocaleString(i18n.language),
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
          {headerScroll.showTop && <ScrollFadeEdge position="top" />}
          <DialogHeader className="p-4 text-left">
            {info.isVerboseEnabled && (
              <VerboseTimetableSummary
                type={data.type}
                headsign={data.headsign}
                serviceDate={data.serviceDate}
                timetableEntries={filteredTimetableEntries}
                omitted={data.omitted}
                isBoardableOnServiceDay={data.isBoardableOnServiceDay}
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
              serviceState={data.serviceState}
              infoLevel={infoLevel}
              dataLang={dataLang}
            />

            {info.isDetailedEnabled && filteredTimetableEntries.length > 0 && (
              <TimetableMetadata
                timetableEntries={filteredTimetableEntries}
                dataLang={dataLang}
                agencies={data.agencies}
              />
            )}

            <TimetableDateLabel serviceDate={data.serviceDate} time={time} lang={dataLang[0]} />
            {data.type === 'stop' && (
              <StopTimetableFilter
                timetableEntries={data.timetableEntries}
                activeFilters={activeFilters}
                onToggleFilter={toggleFilter}
                dataLang={dataLang}
                agencies={data.agencies}
              />
            )}
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
          {headerScroll.showBottom && <ScrollFadeEdge position="bottom" />}
        </div>
        <div
          ref={gridContainerRef}
          onScroll={gridScroll.handleScroll}
          className="relative min-h-0 flex-1 overflow-y-auto"
        >
          {gridScroll.showTop && <ScrollFadeEdge position="top" />}
          <div className="px-4 pt-3 pb-4">
            <TimetableGrid
              timetableEntries={filteredTimetableEntries}
              showHeadsign={
                info.isVerboseEnabled ||
                new Set(
                  filteredTimetableEntries.map((entry) =>
                    getRouteHeadsignKey(entry.routeDirection),
                  ),
                ).size > 1
              }
              currentHour={currentHour}
              infoLevel={infoLevel}
              dataLang={dataLang}
              agencies={data.agencies}
              omitted={data.omitted}
            />
          </div>
          {gridScroll.showBottom && <ScrollFadeEdge position="bottom" />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function useScrollFades(ref: React.RefObject<HTMLDivElement | null>, resetKey: string) {
  const [fadeState, setFadeState] = useState({ showTop: false, showBottom: false });

  const updateFadeState = useCallback(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    const showTop = el.scrollTop > 1;
    const showBottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;

    setFadeState((prev) =>
      prev.showTop === showTop && prev.showBottom === showBottom ? prev : { showTop, showBottom },
    );
  }, [ref]);

  useEffect(() => {
    updateFadeState();

    const el = ref.current;
    if (!el) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      updateFadeState();
    });

    resizeObserver.observe(el);
    if (el.firstElementChild instanceof HTMLElement) {
      resizeObserver.observe(el.firstElementChild);
    }

    window.addEventListener('resize', updateFadeState);
    const frameId = requestAnimationFrame(updateFadeState);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updateFadeState);
      resizeObserver.disconnect();
    };
  }, [ref, resetKey, updateFadeState]);

  return {
    handleScroll: updateFadeState,
    showTop: fadeState.showTop,
    showBottom: fadeState.showBottom,
  };
}

function ScrollFadeEdge({ position }: { position: 'top' | 'bottom' }) {
  return position === 'top' ? (
    <div className="from-background via-background/90 pointer-events-none sticky top-0 z-10 -mb-5 h-5 bg-linear-to-b to-transparent" />
  ) : (
    <div className="from-background via-background/90 pointer-events-none sticky bottom-0 z-10 -mt-5 h-5 bg-linear-to-t to-transparent" />
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

/** Verbose-only metadata dump: boarding stats, direction, pattern breakdown. */
