import { DEFAULT_AGENCY_LANG, resolveAgencyLang } from '@/config/transit-defaults';
import { type AdjustedRouteColors } from '@/domain/transit/color-resolver/route-colors';
import { getStopDisplayNames } from '@/domain/transit/get-stop-display-names';
import { getTimetableEntryAttributes } from '@/domain/transit/timetable-entry-attributes';
import { useInfoLevel } from '@/hooks/use-info-level';
import type { InfoLevel } from '@/types/app/settings';
import type {
  ContextualTimetableEntry,
  SelectedTripSnapshot,
  TripStopTime,
} from '@/types/app/transit-composed';
import { StopInfo } from '../stop-info';
import { LabelCountBadge } from '../badge/label-count-badge';
import { TripInfo } from '../trip-info';
import { StopTimeItem } from '../stop-time-item';
import { StopTimeTimeInfo } from '../stop-time-time-info';

interface TripStopsProps {
  tripSnapshot: SelectedTripSnapshot;
  renderedSnapshot: SelectedTripSnapshot | null;
  selectedPatternStopIndex: number;
  routeColors: AdjustedRouteColors<string>;
  infoLevel: InfoLevel;
  dataLangs: readonly string[];
  now: Date;
}

interface TripStopRowProps {
  tripStopTime: TripStopTime;
  totalStops: number;
  currentPatternStopIndex: number;
  routeColors: AdjustedRouteColors<string>;
  infoLevel: InfoLevel;
  serviceDate: Date;
  dataLangs: readonly string[];
  now: Date;
}

interface TripStopPlaceholderRowProps {
  stopIndex: number;
  totalStops: number;
  currentPatternStopIndex: number;
  routeColors: AdjustedRouteColors<string>;
  infoLevel: InfoLevel;
}

interface TripStopMetaInfoProps {
  arrivalMinutes?: number;
  departureMinutes?: number;
  serviceDate?: Date;
  now?: Date;
  showArrivalTime?: boolean;
  showDepartureTime?: boolean;
  stopIndex: number;
  totalStops: number;
  timeTextColor?: string;
  labelBg?: string;
  labelFg?: string;
  frameColor?: string;
  className?: string;
}

type RenderedTripStopRow =
  | { kind: 'stop'; stop: TripStopTime; stopIndex: number; totalStops: number }
  | { kind: 'placeholder'; stopIndex: number; totalStops: number };

// Initial frame renders the selected stop and +/- 5 neighbors so
// long trips paint quickly before the full list is restored.
const INITIAL_TRIP_STOP_RENDER_PADDING = 5;

function buildRenderedTripStopRows(stopTimes: readonly TripStopTime[]): RenderedTripStopRow[] {
  if (stopTimes.length === 0) {
    return [];
  }

  const totalStops = stopTimes[0]?.timetableEntry.patternPosition.totalStops ?? 0;
  const stopByIndex = new Map(
    stopTimes.map((stop) => [stop.timetableEntry.patternPosition.stopIndex, stop]),
  );

  return Array.from({ length: totalStops }, (_, stopIndex) => {
    const stop = stopByIndex.get(stopIndex);
    if (stop) {
      return { kind: 'stop', stop, stopIndex, totalStops } satisfies RenderedTripStopRow;
    }

    return { kind: 'placeholder', stopIndex, totalStops } satisfies RenderedTripStopRow;
  });
}

function TripStopMetaInfo({
  arrivalMinutes,
  departureMinutes,
  serviceDate,
  now,
  showArrivalTime,
  showDepartureTime,
  stopIndex,
  totalStops,
  timeTextColor,
  labelBg,
  labelFg,
  frameColor,
  className,
}: TripStopMetaInfoProps) {
  const shouldRenderStopTimeTimeInfo =
    arrivalMinutes !== undefined &&
    departureMinutes !== undefined &&
    serviceDate !== undefined &&
    now !== undefined &&
    showArrivalTime !== undefined &&
    showDepartureTime !== undefined;

  return (
    <div className={className ?? 'flex flex-col items-end gap-1'}>
      <div className="self-start">
        <LabelCountBadge
          label={`${stopIndex + 1}`}
          count={totalStops}
          size="md"
          labelBg={labelBg}
          labelFg={labelFg}
          frameColor={frameColor}
        />
      </div>
      {shouldRenderStopTimeTimeInfo && (
        <StopTimeTimeInfo
          arrivalMinutes={arrivalMinutes}
          departureMinutes={departureMinutes}
          serviceDate={serviceDate}
          now={now}
          size="md"
          showArrivalTime={showArrivalTime}
          showDepartureTime={showDepartureTime}
          collapseArrivalWhenSameAsDeparture={true}
          forceShowRelativeTime={true}
          showVerbose={false}
          textAppearance={{ color: timeTextColor }}
        />
      )}
    </div>
  );
}

function TripStopRow({
  tripStopTime,
  totalStops,
  currentPatternStopIndex,
  routeColors,
  infoLevel,
  dataLangs,
  serviceDate,
  now,
}: TripStopRowProps) {
  const infoLevelFlag = useInfoLevel(infoLevel);
  const stopMeta = tripStopTime.stopMeta;
  const stopId = tripStopTime.stopMeta?.stop.stop_id || '(unknown-stop)';
  const stopAttributes = getTimetableEntryAttributes(tripStopTime.timetableEntry);
  const stopAgency = stopMeta?.agencies.find(
    (agency) => agency.agency_id === tripStopTime.timetableEntry.routeDirection.route.agency_id,
  );
  const stopAgencyLangs = tripStopTime.stopMeta
    ? resolveAgencyLang(tripStopTime.stopMeta.agencies, tripStopTime.stopMeta.stop.agency_id)
    : DEFAULT_AGENCY_LANG;
  const stopNames = tripStopTime.stopMeta
    ? getStopDisplayNames(tripStopTime.stopMeta.stop, dataLangs, stopAgencyLangs)
    : null;
  const stopIndex = tripStopTime.timetableEntry.patternPosition.stopIndex;
  const isCurrent = stopIndex === currentPatternStopIndex;
  const isTerminalStop = tripStopTime.timetableEntry.patternPosition.isTerminal;
  const isFirstStop = tripStopTime.timetableEntry.patternPosition.isOrigin;
  const showArrivalTime = isTerminalStop || !isFirstStop;
  const showDepartureTime = !isTerminalStop;

  const contextualTimetableEntry: ContextualTimetableEntry = {
    serviceDate: serviceDate,
    ...tripStopTime.timetableEntry,
  };

  return (
    <div
      data-trip-stop-index={stopIndex}
      className={[
        'rounded-md px-3 py-2',
        isCurrent ? 'border-2' : 'border',
        'border-border bg-background',
      ].join(' ')}
      style={isCurrent ? { borderColor: routeColors.color } : undefined}
    >
      {/* StopTime / StopInfo / Index  */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
        <TripStopMetaInfo
          arrivalMinutes={tripStopTime.timetableEntry.schedule.arrivalMinutes}
          departureMinutes={tripStopTime.timetableEntry.schedule.departureMinutes}
          serviceDate={serviceDate}
          now={now}
          showArrivalTime={showArrivalTime}
          showDepartureTime={showDepartureTime}
          stopIndex={stopIndex}
          totalStops={totalStops}
          timeTextColor={routeColors.color}
          labelBg={routeColors.color}
          labelFg={routeColors.textColor}
          frameColor={routeColors.color}
          className="flex min-h-8 flex-col items-end gap-1"
        />
        <div className="min-w-0">
          {stopMeta ? (
            <StopInfo
              stop={stopMeta.stop}
              agencies={stopMeta.agencies}
              showAgencies={true}
              routeTypes={tripStopTime.routeTypes}
              showRouteTypes={true}
              routes={stopMeta.routes}
              showRoutes={true}
              stats={stopMeta.stats}
              geo={stopMeta.geo}
              mapCenter={null}
              infoLevel={infoLevel}
              dataLangs={dataLangs}
              agencyBadgeSize="sm"
              routeBadgeSize="xs"
            />
          ) : (
            <>
              <div className="flex min-w-0 flex-col gap-1">
                {stopNames && stopNames.subNames.length > 0 && (
                  <div className="text-muted-foreground truncate text-xs">
                    {stopNames.subNames.join(' / ')}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">#{stopIndex}</span>
                  <span className="truncate font-medium">{stopNames?.name || stopId}</span>
                </div>
                <div className="text-muted-foreground truncate text-xs">{stopId}</div>
              </div>
            </>
          )}
        </div>
      </div>
      <TripInfo
        size="md"
        routeDirection={tripStopTime.timetableEntry.routeDirection}
        infoLevel={infoLevel}
        dataLangs={dataLangs}
        showRouteTypeIcon={false}
        agency={stopAgency}
        showAgency={false}
        attributes={stopAttributes}
      />

      {infoLevelFlag.isVerboseEnabled && (
        <>
          <hr className="m-2" />
          <StopTimeItem
            entry={contextualTimetableEntry}
            now={now}
            showArrivalTime={showArrivalTime}
            showDepartureTime={showDepartureTime}
            collapseArrivalWhenSameAsDeparture={true}
            forceShowRelativeTime={true}
            showRouteTypeIcon={true}
            infoLevel={infoLevel}
            dataLangs={dataLangs}
            agency={stopAgency}
            showAgency={true}
          />
        </>
      )}
    </div>
  );
}

function TripStopPlaceholderRow({
  stopIndex,
  totalStops,
  currentPatternStopIndex,
  routeColors,
  infoLevel,
}: TripStopPlaceholderRowProps) {
  const infoLevelFlag = useInfoLevel(infoLevel);
  const isCurrent = stopIndex === currentPatternStopIndex;

  return (
    <div
      data-trip-stop-index={stopIndex}
      className={[
        'rounded-md border-dashed px-3 py-2',
        isCurrent ? 'border-2' : 'border',
        'border-border bg-muted/20',
      ].join(' ')}
      style={isCurrent ? { borderColor: routeColors.color } : undefined}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">#{stopIndex}</span>
            <span className="text-muted-foreground truncate font-medium">
              Stop-time unavailable
            </span>
          </div>
          {infoLevelFlag.isVerboseEnabled && (
            <div className="text-muted-foreground truncate text-xs">
              Pattern stop {stopIndex + 1} / {totalStops}
            </div>
          )}
        </div>
        <TripStopMetaInfo stopIndex={stopIndex} totalStops={totalStops} />
      </div>
    </div>
  );
}

export function TripStops({
  tripSnapshot,
  renderedSnapshot,
  selectedPatternStopIndex,
  routeColors,
  infoLevel,
  dataLangs,
  now,
}: TripStopsProps) {
  const renderedTripStopRows = buildRenderedTripStopRows(tripSnapshot.stopTimes);
  const initialRenderStart = Math.max(
    0,
    selectedPatternStopIndex - INITIAL_TRIP_STOP_RENDER_PADDING,
  );
  const initialRenderEnd = Math.min(
    renderedTripStopRows.length,
    selectedPatternStopIndex + INITIAL_TRIP_STOP_RENDER_PADDING + 1,
  );
  const renderAllStops = renderedSnapshot === tripSnapshot;
  const visibleTripStopRows = renderAllStops
    ? renderedTripStopRows
    : renderedTripStopRows.slice(initialRenderStart, initialRenderEnd);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-2">
        {visibleTripStopRows.map((row) => {
          const rowKey =
            row.kind === 'placeholder'
              ? `placeholder:${row.stopIndex}`
              : `${row.stop.stopMeta?.stop.stop_id || '(unknown-stop)'}:${row.stopIndex}`;

          return row.kind === 'placeholder' ? (
            <TripStopPlaceholderRow
              key={rowKey}
              stopIndex={row.stopIndex}
              totalStops={row.totalStops}
              currentPatternStopIndex={selectedPatternStopIndex}
              routeColors={routeColors}
              infoLevel={infoLevel}
            />
          ) : (
            <TripStopRow
              key={rowKey}
              tripStopTime={row.stop}
              totalStops={row.totalStops}
              currentPatternStopIndex={selectedPatternStopIndex}
              routeColors={routeColors}
              infoLevel={infoLevel}
              dataLangs={dataLangs}
              serviceDate={tripSnapshot.serviceDate}
              now={now}
            />
          );
        })}
      </div>
    </section>
  );
}
