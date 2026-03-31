import { useCallback, useMemo, useState } from 'react';
import { IdBadge } from '@/components/badge/id-badge';
import { RouteBadge } from '@/components/badge/route-badge';
import { getStopDisplayNames } from '@/domain/transit/get-stop-display-names';
import { resolveMinPrefixLengths } from '@/utils/resolve-min-prefix-lengths';
import { routeTypesEmoji } from '@/domain/transit/route-type-emoji';
import { getServiceDayMinutes } from '@/domain/transit/service-day';
import { getDisplayMinutes } from '@/domain/transit/timetable-utils';
import type { InfoLevel } from '@/types/app/settings';
import type { Agency, Route, Stop } from '@/types/app/transit';
import type { TimetableEntry } from '@/types/app/transit-composed';
import type { TimetableOmitted } from '@/types/app/repository';
import { AgencyBadge } from '@/components/badge/agency-badge';
import { useInfoLevel } from '@/hooks/use-info-level';
import { DAY_COLOR_CATEGORY_CLASSES, formatDateWithDay } from '@/utils/day-of-week';
import { getHeadsignDisplayNames } from '@/domain/transit/get-headsign-display-names';
import { hasUnknownDestination } from '@/domain/transit/has-unknown-destination';
import { PillButton } from '@/components/button/pill-button';
import { TimetableGridEntry } from '@/components/timetable/timetable-grid-entry';
import { VerboseAgencies } from '@/components/verbose/verbose-agencies';
import { VerboseStop } from '@/components/verbose/verbose-stop';
import { VerboseStopDisplayNames } from '@/components/verbose/verbose-stop-display-names';
import { VerboseRoutes } from '@/components/verbose/verbose-routes';
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
  agencies: Agency[];
}

interface TimetableModalProps {
  /** Pass null when the modal should be closed. */
  data: TimetableData | null;
  /** Current time reference for highlighting the active hour row. */
  time: Date;
  infoLevel: InfoLevel;
  onClose: () => void;
}

export function TimetableModal({ data, time, infoLevel, onClose }: TimetableModalProps) {
  const open = data !== null;
  const info = useInfoLevel(infoLevel);
  const currentHour = Math.floor(getServiceDayMinutes(time) / 60);

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
    return allTimetableEntries.filter((d) =>
      activeFilters.has(`${d.routeDirection.route.route_id}__${d.routeDirection.headsign}`),
    );
  }, [data, allTimetableEntries, activeFilters]);

  if (!data) {
    return (
      <Dialog open={false} onOpenChange={() => onClose()}>
        <DialogContent />
      </Dialog>
    );
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
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[80dvh] max-w-[90dvw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[90dvw]"
      >
        <DialogHeader className="border-border shrink-0 border-b p-4 text-left">
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
          <DialogTitle className="flex flex-col gap-1">
            <TimetableHeader data={data} infoLevel={infoLevel} />
          </DialogTitle>
          <DialogDescription className="sr-only">
            {data.type === 'route-headsign'
              ? `${data.stop.stop_name} ${data.routes[0].route_short_name || data.routes[0].route_long_name}${data.headsign ? ` ${data.headsign}方面` : ''}の時刻表 ${filteredTimetableEntries.length}本`
              : `${data.stop.stop_name}の全路線時刻表 ${filteredTimetableEntries.length}本`}
          </DialogDescription>

          {info.isDetailedEnabled && (
            <TimetableMetadata timetableEntries={filteredTimetableEntries} />
          )}

          <TimetableDateLabel serviceDate={data.serviceDate} time={time} />
          {data.type === 'stop' && (
            <StopTimetableFilter
              data={data}
              activeFilters={activeFilters}
              onToggleFilter={toggleFilter}
              infoLevel={infoLevel}
            />
          )}
          {((data.type === 'route-headsign' && data.headsign === '') ||
            (data.type === 'stop' &&
              hasUnknownDestination(
                data.timetableEntries.map((d) => ({ headsign: d.routeDirection.headsign })),
              ))) && (
            <p className="m-0 text-center text-[11px] text-amber-600 dark:text-amber-400">
              行先が表示されない路線があります
            </p>
          )}
        </DialogHeader>
        <div className="overflow-y-auto px-4 pt-3 pb-4">
          <TimetableGrid
            timetableEntries={filteredTimetableEntries}
            showHeadsign={
              info.isVerboseEnabled ||
              new Set(
                filteredTimetableEntries.map(
                  (d) => `${d.routeDirection.route.route_id}__${d.routeDirection.headsign}`,
                ),
              ).size > 1
            }
            currentHour={currentHour}
            infoLevel={infoLevel}
            omitted={data.omitted}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Format minutes-from-midnight as HH:MM. */
function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Compute average interval in minutes between sorted departure times. */
function computeAverageInterval(minutes: number[]): number | null {
  if (minutes.length < 2) {
    return null;
  }
  const totalSpan = minutes[minutes.length - 1] - minutes[0];
  return Math.round(totalSpan / (minutes.length - 1));
}

/** Date and time label shown at the bottom of the dialog header. */
function TimetableDateLabel({ serviceDate, time }: { serviceDate: Date; time: Date }) {
  const { dateText, dayLabel, dayColorCategory } = formatDateWithDay(serviceDate);
  // Weekday inherits the parent's muted color; only sat/sun/holiday get color override.
  const dayLabelClass =
    dayColorCategory === 'weekday' ? undefined : DAY_COLOR_CATEGORY_CLASSES[dayColorCategory];
  const hh = String(time.getHours()).padStart(2, '0');
  const mm = String(time.getMinutes()).padStart(2, '0');

  return (
    <p className="text-muted-foreground m-0 text-center font-normal">
      {dateText} <span className={dayLabelClass}>({dayLabel})</span> {hh}:{mm}
    </p>
  );
}

/** Metadata summary shown above the timetable grid. */
function TimetableMetadata({ timetableEntries }: { timetableEntries: TimetableEntry[] }) {
  // Compute departure count and operating hours.
  // Use the display time (arrival for terminal, departure otherwise) for statistics.
  const allMinutes = timetableEntries.map((d) => getDisplayMinutes(d));
  const count = allMinutes.length;
  const firstTime = count > 0 ? formatMinutes(allMinutes[0]) : null;
  const lastTime = count > 0 ? formatMinutes(allMinutes[count - 1]) : null;
  const avgInterval = computeAverageInterval(allMinutes);

  // Route breakdown (always available)
  const routeBreakdown = useMemo(() => {
    const counts = new Map<string, { route: Route; count: number }>();
    for (const dep of timetableEntries) {
      const routeId = dep.routeDirection.route.route_id;
      const entry = counts.get(routeId);
      if (entry) {
        entry.count++;
      } else {
        counts.set(routeId, { route: dep.routeDirection.route, count: 1 });
      }
    }
    return Array.from(counts.values());
  }, [timetableEntries]);

  return (
    <div className="border-border text-muted-foreground mb-3 space-y-0.5 rounded border p-2 text-[11px]">
      <p>
        {firstTime && lastTime && (
          <span>
            {firstTime} - {lastTime}
          </span>
        )}
        <span> / {count.toLocaleString()}本</span>
        {avgInterval !== null && <span> / 平均{avgInterval}分間隔</span>}
      </p>
      {routeBreakdown.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {routeBreakdown.map((rb) => {
            const bg = rb.route.route_color ? `#${rb.route.route_color}` : undefined;
            const fg = rb.route.route_text_color ? `#${rb.route.route_text_color}` : undefined;
            const label =
              rb.route.route_short_name || rb.route.route_long_name || rb.route.route_id;
            return (
              <PillButton
                key={rb.route.route_id}
                size="sm"
                active={true}
                activeBg={bg}
                activeFg={fg}
                count={rb.count}
              >
                {label}
              </PillButton>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Verbose-only metadata dump: boarding stats, direction, pattern breakdown. */

/** Ref callback that scrolls the current hour row into view on mount. */
function useCurrentHourScroll() {
  return useCallback((el: HTMLDivElement | null) => {
    if (el) {
      // Delay to ensure the dialog scroll container is rendered.
      requestAnimationFrame(() => {
        el.scrollIntoView({ block: 'start' });
      });
    }
  }, []);
}

/**
 * Get the display time for a timetable entry.
 * Terminal stops show arrival time; all others show departure time.
 */

/** Hour-grouped timetable grid. Shows headsign badge per entry when enabled. */
function TimetableGrid({
  timetableEntries,
  showHeadsign,
  currentHour,
  infoLevel,
  omitted,
}: {
  timetableEntries: TimetableEntry[];
  showHeadsign: boolean;
  currentHour: number;
  infoLevel: InfoLevel;
  omitted: TimetableOmitted;
}) {
  const scrollRef = useCurrentHourScroll();
  const info = useInfoLevel(infoLevel);

  // Compute minimum display length per headsign to avoid collision.
  // Skip when headsign badges are not rendered.
  const headsignLengths = useMemo(
    () =>
      showHeadsign
        ? resolveMinPrefixLengths(
            timetableEntries.map((d) => d.routeDirection.headsign),
            2,
          )
        : new Map<string, number>(),
    [timetableEntries, showHeadsign],
  );

  // Group by hour using the display time (arrival for terminal, departure otherwise).
  const hourGroups = new Map<number, TimetableEntry[]>();
  for (const entry of timetableEntries) {
    const hour = Math.floor(getDisplayMinutes(entry) / 60);
    const list = hourGroups.get(hour);
    if (list) {
      list.push(entry);
    } else {
      hourGroups.set(hour, [entry]);
    }
  }

  if (hourGroups.size === 0) {
    return (
      <p className="text-muted-foreground p-4 text-center">
        {omitted.terminal > 0 ? '降車専用' : 'この日の運行はありません'}
      </p>
    );
  }

  // Display flags — structured for per-level adjustment.
  const isDisplayTerminal = info.isSimpleEnabled;
  // const isDisplayOrigin = info.isNormalEnabled;
  const isDisplayOrigin = info.isDetailedEnabled;
  const isDisplayPickupUnavailable = info.isVerboseEnabled;
  const isDisplayDropOffUnavailable = info.isVerboseEnabled;

  const hasCurrentHour = hourGroups.has(currentHour);
  const firstHour = hourGroups.keys().next().value as number;

  return (
    <>
      {Array.from(hourGroups.entries()).map(([hour, entries]) => (
        <div
          key={hour}
          ref={
            hour === currentHour
              ? scrollRef
              : !hasCurrentHour && hour === firstHour
                ? scrollRef
                : undefined
          }
          className={`border-border border-b py-1.5 last:border-b-0 ${hour === currentHour ? 'bg-accent rounded' : ''}`}
        >
          <div className="flex items-baseline gap-2">
            <span className="text-foreground w-10 shrink-0 text-right text-sm font-bold">
              {hour}時
            </span>
            <span className="flex flex-wrap gap-1.5">
              {entries.map((entry, i) => (
                <TimetableGridEntry
                  key={`${entry.routeDirection.route.route_id}__${entry.routeDirection.headsign}__${entry.schedule.departureMinutes}_${entry.schedule.arrivalMinutes}_${i}`}
                  entry={entry}
                  showHeadsign={showHeadsign}
                  headsignMaxLength={headsignLengths.get(entry.routeDirection.headsign)}
                  infoLevel={infoLevel}
                  isDisplayTerminal={isDisplayTerminal}
                  isDisplayOrigin={isDisplayOrigin}
                  isDisplayPickupUnavailable={isDisplayPickupUnavailable}
                  isDisplayDropOffUnavailable={isDisplayDropOffUnavailable}
                  disableVerbose={true}
                  defaultOpen={false}
                />
              ))}
            </span>
          </div>
          {info.isVerboseEnabled && (
            <details className="mt-0.5 text-[9px] font-normal text-[#999] dark:text-gray-500">
              <summary className="cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
                [{hour}時 {entries.length}件]
              </summary>
              <div className="mt-0.5 flex flex-col gap-0.5">
                {entries.map((entry, i) => (
                  <TimetableGridEntry
                    key={`${entry.routeDirection.route.route_id}__${entry.routeDirection.headsign}__${entry.schedule.departureMinutes}_${entry.schedule.arrivalMinutes}_${i}`}
                    entry={entry}
                    showHeadsign={showHeadsign}
                    headsignMaxLength={headsignLengths.get(entry.routeDirection.headsign)}
                    infoLevel={infoLevel}
                    isDisplayTerminal={isDisplayTerminal}
                    isDisplayOrigin={isDisplayOrigin}
                    isDisplayPickupUnavailable={isDisplayPickupUnavailable}
                    isDisplayDropOffUnavailable={isDisplayDropOffUnavailable}
                    defaultOpen={false}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      ))}
    </>
  );
}

function TimetableHeader({ data, infoLevel }: { data: TimetableData; infoLevel: InfoLevel }) {
  const stopNames = getStopDisplayNames(data.stop, infoLevel);
  const isDropOffOnly =
    !data.isBoardableOnServiceDay &&
    (data.omitted.terminal > 0 || data.timetableEntries.length > 0);

  // Convert route types into emoji.
  // Duplicates are not removed; it's simply a conversion.
  const routeTypes = data.routes.map((r) => r.route_type);

  // Unique routes for badge display.
  const uniqueRoutes = data.routes;

  // For route-headsign, show only the agency of that route.
  // For stop timetable, show all agencies.
  const displayAgencies =
    data.type === 'route-headsign'
      ? data.agencies.filter((a) => a.agency_id === data.routes[0].agency_id)
      : data.agencies;

  const showVerbose = infoLevel === 'verbose';

  return (
    <>
      {showVerbose && <IdBadge>{data.stop.stop_id}</IdBadge>}
      {stopNames.subNames.length > 0 && (
        <p className="m-0 text-[11px] font-normal text-[#888] dark:text-gray-400">
          {stopNames.subNames.join(' / ')}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-base">
        <span className="shrink-0">{routeTypesEmoji(routeTypes)}</span>
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          {stopNames.name}
        </span>
        {isDropOffOnly && (
          <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
            降車専用
          </span>
        )}
        {displayAgencies.length > 0 &&
          displayAgencies.map((a) => (
            <AgencyBadge
              key={a.agency_id}
              agency={a}
              infoLevel={infoLevel}
              size="xs"
              disableVerbose
            />
          ))}
      </div>

      {uniqueRoutes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {uniqueRoutes.map((r) => (
            <RouteBadge key={r.route_id} route={r} infoLevel={infoLevel} disableVerbose />
          ))}
        </div>
      )}
      {showVerbose && (
        <details className="text-[9px] font-normal text-[#999] dark:text-gray-500">
          <summary className="cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
            [META]
          </summary>
          <div className="mt-1 ml-2 space-y-1">
            <details className="text-[9px] font-normal text-[#999] dark:text-gray-500">
              <summary className="cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
                [Stop]
              </summary>
              <div className="mt-1 overflow-x-auto rounded border border-dashed border-gray-300 p-1 whitespace-nowrap dark:border-gray-600">
                <VerboseStop stop={data.stop} isDropOffOnly={isDropOffOnly} />
              </div>
              <VerboseStopDisplayNames names={stopNames} />
            </details>
            <VerboseAgencies agencies={displayAgencies} infoLevel={infoLevel} />
            <VerboseRoutes routes={uniqueRoutes} infoLevel={infoLevel} />
          </div>
        </details>
      )}
    </>
  );
}

/** Route+headsign filter buttons for stop timetable. */
function StopTimetableFilter({
  data,
  activeFilters,
  onToggleFilter,
  infoLevel,
}: {
  data: TimetableData;
  activeFilters: Set<string>;
  onToggleFilter: (key: string) => void;
  infoLevel: InfoLevel;
}) {
  // Count entries per route+headsign (memoized for filter toggle re-renders)
  const routeHeadsigns = useMemo(() => {
    const counts = new Map<string, { route: Route; headsign: string; count: number }>();
    for (const d of data.timetableEntries) {
      const key = `${d.routeDirection.route.route_id}__${d.routeDirection.headsign}`;
      const entry = counts.get(key);
      if (entry) {
        entry.count++;
      } else {
        counts.set(key, {
          route: d.routeDirection.route,
          headsign: d.routeDirection.headsign,
          count: 1,
        });
      }
    }
    return Array.from(counts.values());
  }, [data.timetableEntries]);

  const noFilter = activeFilters.size === 0;

  if (routeHeadsigns.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {routeHeadsigns.map((r) => {
        const key = `${r.route.route_id}__${r.headsign}`;
        const isActive = noFilter || activeFilters.has(key);
        const bg = r.route.route_color ? `#${r.route.route_color}` : undefined;
        const fg = r.route.route_text_color ? `#${r.route.route_text_color}` : undefined;
        return (
          <PillButton
            key={key}
            size={'sm'}
            active={isActive}
            activeBg={bg}
            activeFg={fg}
            inactiveBorder={bg}
            onClick={() => onToggleFilter(key)}
            count={r.count}
          >
            {/* Filter button has no RouteBadge — fall back to route name so it is never blank. */}
            {getHeadsignDisplayNames(r.headsign, r.route, infoLevel).name ||
              r.route.route_short_name ||
              r.route.route_long_name ||
              r.route.route_id}
          </PillButton>
        );
      })}
    </div>
  );
}
