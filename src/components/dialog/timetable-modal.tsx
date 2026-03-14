import { useCallback, useMemo, useState } from 'react';
import { HeadsignBadge } from '@/components/badge/headsign-badge';
import { IdBadge } from '@/components/badge/id-badge';
import { RouteBadge } from '@/components/badge/route-badge';
import { getStopDisplayNames } from '@/domain/transit/get-stop-display-names';
import { resolveMinPrefixLengths } from '@/utils/resolve-min-prefix-lengths';
import { routeTypesEmoji } from '@/domain/transit/route-type-emoji';
import { getServiceDayMinutes } from '@/domain/transit/service-day';
import type { InfoLevel } from '@/types/app/settings';
import type { Route, RouteType, Stop } from '@/types/app/transit';
import { useInfoLevel } from '@/hooks/use-info-level';
import { DAY_COLOR_CATEGORY_CLASSES, formatDateWithDay } from '@/utils/day-of-week';
import { getHeadsignDisplayNames } from '@/domain/transit/get-headsign-display-names';
import { PillButton } from '@/components/button/pill-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** Timetable for a specific route + headsign at a stop. */
export interface RouteHeadsignTimetable {
  type: 'route-headsign';
  stop: Stop;
  route: Route;
  headsign: string;
  /** GTFS service date for this timetable (not real-world time). */
  serviceDate: Date;
  departures: number[]; // minutes from midnight, sorted
}

/** A single departure in a stop timetable with route/headsign metadata. */
export interface StopTimetableDeparture {
  /** Minutes from midnight. */
  minutes: number;
  route: Route;
  headsign: string;
}

/** Timetable for all departures at a stop. */
export interface StopTimetable {
  type: 'stop';
  stop: Stop;
  routeTypes: RouteType[];
  /** GTFS service date for this timetable (not real-world time). */
  serviceDate: Date;
  departures: StopTimetableDeparture[]; // sorted by minutes
}

/** Data needed to render the timetable modal. */
export type TimetableData = RouteHeadsignTimetable | StopTimetable;

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
  // Empty set = show all departures (no filter active).
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

  // Normalize departures to StopTimetableDeparture[] for both timetable types.
  const allDepartures: StopTimetableDeparture[] = useMemo(() => {
    if (!data) {
      return [];
    }
    if (data.type === 'stop') {
      return data.departures;
    }
    // Convert route-headsign minutes to StopTimetableDeparture[].
    return data.departures.map((minutes) => ({
      minutes,
      route: data.route,
      headsign: data.headsign,
    }));
  }, [data]);

  const filteredDepartures = useMemo(() => {
    if (!data || data.type !== 'stop' || activeFilters.size === 0) {
      return allDepartures;
    }
    return allDepartures.filter((d) => activeFilters.has(`${d.route.route_id}__${d.headsign}`));
  }, [data, allDepartures, activeFilters]);

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
        className="flex max-h-[80dvh] max-w-120 flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="border-border shrink-0 border-b p-4 text-left">
          <DialogTitle className="flex flex-col gap-1">
            <TimetableHeader data={data} infoLevel={infoLevel} />
          </DialogTitle>
          <DialogDescription className="sr-only">
            {data.type === 'route-headsign'
              ? `${data.stop.stop_name} ${data.route.route_short_name || data.route.route_long_name} ${data.headsign}方面の時刻表 ${data.departures.length}本`
              : `${data.stop.stop_name}の全路線時刻表 ${data.departures.length}本`}
          </DialogDescription>

          {info.isDetailedEnabled && <TimetableMetadata data={data} infoLevel={infoLevel} />}

          <TimetableDateLabel serviceDate={data.serviceDate} time={time} />
          {data.type === 'stop' && (
            <StopTimetableFilter
              data={data}
              activeFilters={activeFilters}
              onToggleFilter={toggleFilter}
              infoLevel={infoLevel}
            />
          )}
        </DialogHeader>
        <div className="overflow-y-auto px-4 pt-3 pb-4">
          <TimetableGrid
            departures={filteredDepartures}
            showHeadsign={
              info.isVerboseEnabled ||
              (info.isNormalEnabled &&
                new Set(filteredDepartures.map((d) => `${d.route.route_id}__${d.headsign}`)).size >
                  1)
            }
            currentHour={currentHour}
            infoLevel={infoLevel}
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

/** Verbose metadata summary shown above the timetable grid. */
function TimetableMetadata({ data, infoLevel }: { data: TimetableData; infoLevel: InfoLevel }) {
  // Compute departure count and operating hours
  const allMinutes =
    data.type === 'route-headsign' ? data.departures : data.departures.map((d) => d.minutes);
  const count = allMinutes.length;
  const firstTime = count > 0 ? formatMinutes(allMinutes[0]) : null;
  const lastTime = count > 0 ? formatMinutes(allMinutes[count - 1]) : null;
  const avgInterval = computeAverageInterval(allMinutes);

  // Route+headsign breakdown for stop timetable
  const routeBreakdown = useMemo(() => {
    if (data.type !== 'stop') {
      return [];
    }
    const counts = new Map<string, { route: Route; headsign: string; count: number }>();
    for (const dep of data.departures) {
      const key = `${dep.route.route_id}__${dep.headsign}`;
      const entry = counts.get(key);
      if (entry) {
        entry.count++;
      } else {
        counts.set(key, { route: dep.route, headsign: dep.headsign, count: 1 });
      }
    }
    return Array.from(counts.values());
  }, [data]);

  return (
    <div className="border-border text-muted-foreground mb-3 space-y-0.5 rounded border p-2 text-[11px]">
      {firstTime && lastTime && (
        <p>
          {firstTime} - {lastTime}
        </p>
      )}
      <p>
        {count}本{avgInterval !== null && <span> / 平均{avgInterval}分間隔</span>}
      </p>
      {routeBreakdown.length > 1 && (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          {routeBreakdown.map((rb) => (
            <span
              key={`${rb.route.route_id}__${rb.headsign}`}
              className="inline-flex items-center gap-0.5"
            >
              <HeadsignBadge
                headsign={rb.headsign}
                route={rb.route}
                infoLevel={infoLevel}
                size="xs"
              />
              <span className="font-medium">{rb.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

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

/** Hour-grouped timetable grid. Shows headsign badge per departure when enabled. */
function TimetableGrid({
  departures,
  showHeadsign,
  currentHour,
  infoLevel,
}: {
  departures: StopTimetableDeparture[];
  showHeadsign: boolean;
  currentHour: number;
  infoLevel: InfoLevel;
}) {
  const scrollRef = useCurrentHourScroll();

  // Compute minimum display length per headsign to avoid collision.
  // Skip when headsign badges are not rendered.
  const headsignLengths = useMemo(
    () =>
      showHeadsign
        ? resolveMinPrefixLengths(
            departures.map((d) => d.headsign),
            2,
          )
        : new Map<string, number>(),
    [departures, showHeadsign],
  );

  // Group by hour
  const hourGroups = new Map<number, StopTimetableDeparture[]>();
  for (const dep of departures) {
    const hour = Math.floor(dep.minutes / 60);
    const list = hourGroups.get(hour);
    if (list) {
      list.push(dep);
    } else {
      hourGroups.set(hour, [dep]);
    }
  }

  if (hourGroups.size === 0) {
    return <p className="text-muted-foreground p-4 text-center">この日の運行はありません</p>;
  }

  return (
    <>
      {Array.from(hourGroups.entries()).map(([hour, deps]) => (
        <div
          key={hour}
          ref={hour === currentHour ? scrollRef : undefined}
          className={`border-border flex items-baseline gap-2 border-b py-1.5 last:border-b-0 ${hour === currentHour ? 'bg-accent rounded' : ''}`}
        >
          <span className="text-foreground w-10 shrink-0 text-right text-sm font-bold">
            {hour}時
          </span>
          <span className="flex flex-wrap gap-1.5">
            {deps.map((dep, i) => (
              <span
                key={`${dep.route.route_id}__${dep.headsign}__${dep.minutes}__${i}`}
                className="inline-flex items-baseline gap-0.5"
              >
                <span className="text-muted-foreground text-sm tabular-nums">
                  {String(dep.minutes % 60).padStart(2, '0')}
                </span>
                {showHeadsign && (
                  <HeadsignBadge
                    headsign={dep.headsign}
                    route={dep.route}
                    infoLevel={infoLevel}
                    maxLength={headsignLengths.get(dep.headsign)}
                    size="xs"
                  />
                )}
              </span>
            ))}
          </span>
        </div>
      ))}
    </>
  );
}

function TimetableHeader({ data, infoLevel }: { data: TimetableData; infoLevel: InfoLevel }) {
  const stopNames = getStopDisplayNames(data.stop, infoLevel);

  // Collect route types for emoji display.
  const routeTypes = data.type === 'route-headsign' ? [data.route.route_type] : data.routeTypes;

  // Unique routes for badge display (keyed by route_id).
  const uniqueRoutes =
    data.type === 'route-headsign'
      ? [data.route]
      : Array.from(
          new Map(data.departures.map((d) => [d.route.route_id, d.route] as const)).values(),
        );

  return (
    <>
      {infoLevel === 'verbose' && <IdBadge>{data.stop.stop_id}</IdBadge>}
      {stopNames.subNames.length > 0 && (
        <p className="m-0 text-[11px] font-normal text-[#888] dark:text-gray-400">
          {stopNames.subNames.join(' / ')}
        </p>
      )}
      <div className="flex items-center gap-2 text-base">
        <span className="shrink-0">{routeTypesEmoji(routeTypes)}</span>
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          {stopNames.name}
        </span>
      </div>
      {uniqueRoutes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {uniqueRoutes.map((r) => (
            <span key={r.route_id} className="inline-flex items-center gap-1">
              {infoLevel === 'verbose' && <IdBadge>{r.route_id}</IdBadge>}
              <RouteBadge route={r} infoLevel={infoLevel} />
            </span>
          ))}
        </div>
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
  data: StopTimetable;
  activeFilters: Set<string>;
  onToggleFilter: (key: string) => void;
  infoLevel: InfoLevel;
}) {
  const routeHeadsigns = Array.from(
    new Map(
      data.departures.map((d) => [
        `${d.route.route_id}__${d.headsign}`,
        { route: d.route, headsign: d.headsign },
      ]),
    ).values(),
  );

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
            active={isActive}
            activeBg={bg}
            activeFg={fg}
            inactiveBorder={bg}
            onClick={() => onToggleFilter(key)}
          >
            {infoLevel === 'verbose' && <IdBadge>{r.route.route_id}</IdBadge>}
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
