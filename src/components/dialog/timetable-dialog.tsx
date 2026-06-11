import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { BoardabilityFilter } from '@/components/filter/boardability-filter';
import { OriginFilter } from '@/components/filter/origin-filter';
import { ScrollFadeEdge } from '@/components/shared/scroll-fade-edge';
import { TimetableGrid } from '@/components/timetable/timetable-grid';
import { TimetableHeader } from '@/components/timetable/timetable-header';
import { TimetableHeadsignFilter } from '@/components/timetable/timetable-headsign-filter';
import { TimetableMetadata } from '@/components/timetable/timetable-metadata';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VerboseTimetableSummary } from '@/components/verbose/verbose-timetable-summary';
import { DEFAULT_TIMEZONE, resolveAgencyLang } from '@/config/transit-defaults';
import { findRouteDirectionForHeadsign } from '@/domain/transit/find-route-direction-for-headsign';
import { getEffectiveHeadsign } from '@/domain/transit/get-effective-headsign';
import { getRouteHeadsignKey } from '@/domain/transit/get-route-headsign-key';
import { hasUnknownDestination } from '@/domain/transit/has-unknown-destination';
import { getSelectedHeadsignDisplayName } from '@/domain/transit/name-resolver/get-headsign-display-names';
import { getRouteDisplayNames } from '@/domain/transit/name-resolver/get-route-display-names';
import { getStopDisplayNames } from '@/domain/transit/name-resolver/get-stop-display-names';
import { getServiceDayMinutes } from '@/domain/transit/service-day';
import { applyStopEventAttributeToggles } from '@/domain/transit/timetable-filter';
import type { TimetableEntryStats } from '@/domain/transit/timetable-stats';
import { computeTimetableEntryStats } from '@/domain/transit/timetable-stats';
import { useInfoLevel } from '@/hooks/use-info-level';
import { useScrollOverflow } from '@/hooks/use-scroll-overflow';
import type { GlobalFilter } from '@/types/app/global-filter';
import type { InfoLevel } from '@/types/app/settings';
import type { TimetableData } from '@/types/app/timetable';
import type { Agency } from '@/types/app/transit';
import type { TimetableEntry, TripInspectionTarget } from '@/types/app/transit-composed';
import { formatDateParts } from '@/utils/datetime';
import { DAY_COLOR_CATEGORY_CLASSES } from '@/utils/day-of-week';
import { toDatetimeLocalInputValue } from '@/utils/html-date-time';

interface TimetableDialogProps {
  /** Pass null when the dialog should be closed. */
  data: TimetableData | null;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLangs: readonly string[];
  /** App-wide filter state shared across surfaces. */
  globalFilter: GlobalFilter;
  onInspectTrip?: (target: TripInspectionTarget) => void;
  /**
   * Change the datetime of the currently displayed timetable, preserving
   * the current stop and filter. Used by the datetime navigation row.
   */
  onChangeDateTime: (dateTime: Date) => void;
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

interface DateTimeNavigationProps {
  /** The datetime the dialog is currently displaying. */
  viewingDateTime: Date;
  onChangeDateTime: (dateTime: Date) => void;
}

/**
 * Datetime navigation row (previous day / datetime picker / next day / now).
 *
 * Handlers are local to this component so the parent can stay focused on
 * the timetable rendering. The "now" button always re-fetches at the
 * current wall-clock time.
 */
const PICKER_DEBOUNCE_MS = 1_000;

function DateTimeNavigation({ viewingDateTime, onChangeDateTime }: DateTimeNavigationProps) {
  const { t } = useTranslation();

  // Bound the picker to +/- 1 year from the mount-time wall clock.
  // Snapshotted once so spinning the picker can't drift past the bounds
  // during a long-lived dialog session. Enforcement is delegated to the
  // browser's picker via the input's `min` / `max` attributes; direct
  // typing of out-of-range values is intentionally not rejected (the
  // user would see an unexplained no-op otherwise — an empty timetable
  // for the typed date is the clearer signal).
  const inputBounds = useMemo(() => {
    const now = new Date();
    const min = new Date(now);
    min.setFullYear(min.getFullYear() - 1);
    const max = new Date(now);
    max.setFullYear(max.getFullYear() + 1);
    return {
      minString: toDatetimeLocalInputValue(min),
      maxString: toDatetimeLocalInputValue(max),
    };
  }, []);

  // Local echo of the input so direct typing (e.g. yyyy/mm/dd one digit at
  // a time) is not interrupted by the parent's viewingDateTime updates.
  // The committed value (= onChangeDateTime) is debounced so intermediate
  // keystrokes do not each trigger a fetch.
  //
  // Uses the "Adjusting state on prop changes" pattern (compare with the
  // previous value during render) instead of useEffect + setState, per
  // React 19's `set-state-in-effect` rule.
  const [editingValue, setEditingValue] = useState(() =>
    toDatetimeLocalInputValue(viewingDateTime),
  );
  const [prevViewingDateTime, setPrevViewingDateTime] = useState(viewingDateTime);
  // Compare timestamps (not Date references) so that a newly-allocated Date
  // representing the same moment does not trigger an unnecessary state
  // update / extra render of DateTimeNavigation.
  if (viewingDateTime.getTime() !== prevViewingDateTime.getTime()) {
    setPrevViewingDateTime(viewingDateTime);
    setEditingValue(toDatetimeLocalInputValue(viewingDateTime));
  }
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    return () => {
      clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Explicit navigation (prev / next / now) must override any pending
  // picker-debounce commit. Without `clearTimeout` here, a still-pending
  // typed value could fire after the button-triggered fetch returns and
  // silently overwrite it.
  const handlePrevDay = useCallback(() => {
    clearTimeout(debounceTimerRef.current);
    const next = new Date(viewingDateTime);
    next.setDate(next.getDate() - 1);
    onChangeDateTime(next);
  }, [viewingDateTime, onChangeDateTime]);

  const handleNextDay = useCallback(() => {
    clearTimeout(debounceTimerRef.current);
    const next = new Date(viewingDateTime);
    next.setDate(next.getDate() + 1);
    onChangeDateTime(next);
  }, [viewingDateTime, onChangeDateTime]);

  const handleResetToNow = useCallback(() => {
    clearTimeout(debounceTimerRef.current);
    onChangeDateTime(new Date());
  }, [onChangeDateTime]);

  const handlePickerChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      setEditingValue(raw);

      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        if (!raw) {
          return;
        }
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) {
          return;
        }
        onChangeDateTime(parsed);
      }, PICKER_DEBOUNCE_MS);
    },
    [onChangeDateTime],
  );

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <Button
        variant="outline"
        size="icon-xs"
        onClick={handlePrevDay}
        aria-label={t('timetable.dateTimeNav.previousDay')}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <input
        type="datetime-local"
        value={editingValue}
        onChange={handlePickerChange}
        min={inputBounds.minString}
        max={inputBounds.maxString}
        aria-label={t('timetable.dateTimeNav.datePickerLabel')}
        className="border-input bg-background h-6 rounded-md border px-2 text-xs leading-none"
      />
      <Button
        variant="outline"
        size="icon-xs"
        onClick={handleResetToNow}
        aria-label={t('timetable.dateTimeNav.now')}
      >
        <Clock className="size-4" />
      </Button>
      <Button
        variant="outline"
        size="icon-xs"
        onClick={handleNextDay}
        aria-label={t('timetable.dateTimeNav.nextDay')}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
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

function hasSameRelevantGlobalFilter(prev: GlobalFilter, next: GlobalFilter): boolean {
  return (
    prev.showOriginOnly === next.showOriginOnly &&
    prev.showBoardableOnly === next.showBoardableOnly &&
    prev.onToggleShowOriginOnly === next.onToggleShowOriginOnly &&
    prev.onToggleShowBoardableOnly === next.onToggleShowBoardableOnly
  );
}

function areTimetableDialogPropsEqual(
  prev: Readonly<TimetableDialogProps>,
  next: Readonly<TimetableDialogProps>,
): boolean {
  return (
    prev.data === next.data &&
    prev.infoLevel === next.infoLevel &&
    prev.dataLangs === next.dataLangs &&
    prev.onInspectTrip === next.onInspectTrip &&
    prev.onChangeDateTime === next.onChangeDateTime &&
    prev.onClose === next.onClose &&
    hasSameRelevantGlobalFilter(prev.globalFilter, next.globalFilter)
  );
}

export const TimetableDialog = memo(function TimetableDialog({
  data,
  infoLevel,
  dataLangs,
  globalFilter,
  onInspectTrip,
  onChangeDateTime,
  onClose,
}: TimetableDialogProps) {
  const { showOriginOnly, showBoardableOnly, onToggleShowOriginOnly, onToggleShowBoardableOnly } =
    globalFilter;
  const { t, i18n } = useTranslation();
  const open = data !== null;
  const info = useInfoLevel(infoLevel);

  const hourToHighlight = data ? Math.floor(getServiceDayMinutes(data.referenceDateTime) / 60) : -1;
  const headerContainerRef = useRef<HTMLDivElement | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  // Filter state for stop timetable (route+headsign toggle).
  // Empty set = show all timetable (no filter active).
  const [activeFilters, setActiveFilters] = useState<Set<string>>(() => new Set());

  // Reset `activeFilters` when the dialog is retargeted to a different
  // (stop, view-mode, headsign) tuple while still mounted.
  //
  // The container's `key` is bound to `stop.stop_id`, so a same-stop
  // re-open (e.g. switching from stop timetable to route-headsign
  // timetable for the same stop, or vice versa) keeps the dialog
  // mounted and would otherwise leak the previous filter selection into
  // the new view -- `TimetableHeadsignFilter` is only shown for
  // `data.type === 'stop'`, but `routeHeadsignFilteredEntries` honors
  // `activeFilters` regardless of mode, so a stale filter would silently
  // drop rows in route-headsign view with no visible toggle.
  //
  // This uses the "Adjusting state on prop changes" pattern (compare
  // previous and current during render), the same idiom used by
  // `StopSearchDialog.prevDeferredQuery`.
  const dataIdentity = data
    ? JSON.stringify([data.type, data.stop.stop_id, data.headsign ?? ''])
    : null;
  const [prevDataIdentity, setPrevDataIdentity] = useState(dataIdentity);
  if (dataIdentity !== prevDataIdentity) {
    setPrevDataIdentity(dataIdentity);
    setActiveFilters(new Set());
  }

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
  // const allEntriesStats = computeTimetableEntryStats( allTimetableEntries, data?.agencies ?? [], dataLangs,);

  const stopEventAttributesFilteredEntries = useMemo(
    () =>
      applyStopEventAttributeToggles(allTimetableEntries, {
        showOriginOnly,
        showBoardableOnly,
      }),
    [allTimetableEntries, showOriginOnly, showBoardableOnly],
  );
  const stopEventAttributesFilteredEntriesStats = useMemo(
    () =>
      computeTimetableEntryStats(
        stopEventAttributesFilteredEntries,
        data?.agencies ?? [],
        dataLangs,
      ),
    [stopEventAttributesFilteredEntries, data?.agencies, dataLangs],
  );

  const routeHeadsignFilteredEntries = useMemo(() => {
    let entries = stopEventAttributesFilteredEntries;
    if (activeFilters.size > 0) {
      entries = entries.filter((entry) =>
        activeFilters.has(getRouteHeadsignKey(entry.routeDirection)),
      );
    }
    return entries;
  }, [stopEventAttributesFilteredEntries, activeFilters]);
  const routeHeadsignFilteredEntriesStats = useMemo(
    () => computeTimetableEntryStats(routeHeadsignFilteredEntries, data?.agencies ?? [], dataLangs),
    [routeHeadsignFilteredEntries, data?.agencies, dataLangs],
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

  const headerScrollOverflow = useScrollOverflow(
    headerContainerRef,
    `${data?.type ?? 'closed'}:${data?.headsign ?? ''}:${stopEventAttributesFilteredEntries.length}:${infoLevel}`,
  );
  const gridScrollOverflow = useScrollOverflow(
    gridContainerRef,
    `${data?.type ?? 'closed'}:${stopEventAttributesFilteredEntries.length}:${infoLevel}:${hourToHighlight}`,
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
        count: stopEventAttributesFilteredEntries.length.toLocaleString(i18n.language),
      },
    );
  } else {
    timetableDescription = t('timetable.header.stopDescription', {
      stop: descriptionStopName,
      count: stopEventAttributesFilteredEntries.length.toLocaleString(i18n.language),
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
      {/* border-4: intentional thick border to visually distinguish the timetable dialog from the map background */}
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[80dvh] w-[90dvw] max-w-5xl flex-col gap-0 overflow-hidden border-4 p-2 sm:max-w-3xl"
      >
        {/* Datetime navigation */}
        {info.isDetailedEnabled && (
          <DateTimeNavigation
            viewingDateTime={data.referenceDateTime}
            onChangeDateTime={onChangeDateTime}
          />
        )}

        <div
          ref={headerContainerRef}
          onScroll={headerScrollOverflow.update}
          className="border-border relative max-h-[40dvh] shrink-0 overflow-y-auto border-b"
        >
          {headerScrollOverflow.hasContentAbove && (
            <ScrollFadeEdge position="top" className="via-background/90 -mb-5 h-5" />
          )}
          <DialogHeader className="p-4 text-left">
            {info.isVerboseEnabled && (
              <VerboseTimetableSummary
                type={data.type}
                headsign={data.headsign}
                serviceDate={data.serviceDate}
                timetableEntries={stopEventAttributesFilteredEntries}
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
            <TimetableDateLabel
              serviceDate={data.serviceDate}
              time={data.referenceDateTime}
              lang={dataLangs[0]}
            />

            <div className="flex flex-wrap gap-1">
              {/* Boardability filter */}
              <BoardabilityFilter
                boardable={showBoardableOnly}
                count={stopEventAttributesFilteredEntriesStats.boardableCount}
                onToggleBoardable={onToggleShowBoardableOnly}
              />
              {/* Origin filter — hidden when no origin entries exist at this stop */}
              {stopEventAttributesFilteredEntriesStats.originCount > 0 && (
                <OriginFilter
                  origin={showOriginOnly}
                  count={stopEventAttributesFilteredEntriesStats.originCount}
                  onToggleOrigin={onToggleShowOriginOnly}
                />
              )}
              {/* Headsign filter */}
              {data.type === 'stop' && (
                <TimetableHeadsignFilter
                  timetableEntries={stopEventAttributesFilteredEntries}
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
          {headerScrollOverflow.hasContentBelow && (
            <ScrollFadeEdge position="bottom" className="via-background/90 -mt-5 h-5" />
          )}
        </div>
        <div
          ref={gridContainerRef}
          onScroll={gridScrollOverflow.update}
          className="relative min-h-0 flex-1 overflow-y-auto"
        >
          {gridScrollOverflow.hasContentAbove && (
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
              hourToHighlight={hourToHighlight}
              infoLevel={infoLevel}
              dataLangs={dataLangs}
              agencies={data.agencies}
              omitted={data.omitted}
              onInspectTrip={onInspectTrip}
            />
          </div>
          {gridScrollOverflow.hasContentBelow && (
            <ScrollFadeEdge position="bottom" className="via-background/90 -mt-5 h-5" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}, areTimetableDialogPropsEqual);
