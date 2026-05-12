import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { DEFAULT_AGENCY_LANG, resolveAgencyLang } from '@/config/transit-defaults';
import { getStopDisplayNames } from '@/domain/transit/name-resolver/get-stop-display-names';
import { deriveStopTimeRoleDisplayProps } from '@/domain/transit/stop-time-display';
import { getTimetableEntryAttributes } from '@/domain/transit/timetable-entry-attributes';
import { useInfoLevel } from '@/hooks/use-info-level';
import { cn } from '@/lib/utils';
import type { TripInspectionTarget } from '@/types/app/transit-composed';
import { StopInfo } from '../stop-info';
import { TripInfo } from '../trip-info';
import { VerboseTripStopTime } from '../verbose/verbose-trip-stop-time';
import { tripStopRowDataAttrs } from './trip-stop-row-dom';
import { getRenderedTripStopRowKey, getVisibleTripStopRows } from './trip-stop-rows';
import {
  TripStopMetaInfo,
  type TripStopPlaceholderRowProps,
  type TripStopRowProps,
  type TripStopsProps,
} from './trip-stops';

function TripStopRow({
  tripStopTime,
  tripLocator,
  totalStops,
  currentPatternStopIndex,
  routeColors,
  infoLevel,
  dataLangs,
  serviceDate,
  now,
  onInspectTrip,
  onSelectStopById,
}: TripStopRowProps) {
  const { t } = useTranslation();
  const infoLevelFlag = useInfoLevel(infoLevel);
  const stopMeta = tripStopTime.stopMeta;
  const stopId = tripStopTime.stopMeta?.stop.stop_id;
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
  const display = deriveStopTimeRoleDisplayProps({
    isOrigin: isFirstStop,
    isTerminal: isTerminalStop,
    infoLevel,
  });
  const inspectTarget: TripInspectionTarget = {
    serviceDate,
    tripLocator,
    stopIndex,
    departureMinutes: tripStopTime.timetableEntry.schedule.departureMinutes,
  };
  const handleSelectStop = stopId && onSelectStopById ? () => onSelectStopById(stopId) : undefined;
  const handleRowKeyDown =
    handleSelectStop === undefined
      ? undefined
      : (e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSelectStop();
          }
        };
  const stopContent = stopMeta ? (
    <StopInfo
      stop={stopMeta.stop}
      agencies={stopMeta.agencies}
      showAgencies={true}
      routeTypes={tripStopTime.routeTypes}
      showRouteTypes={true}
      routes={stopMeta.routes}
      showRoutes={true}
      distance={undefined}
      mapCenter={null}
      infoLevel={infoLevel}
      dataLangs={dataLangs}
      stopServiceState={undefined}
      textSize="sm"
      labelSize="sm"
      agencyBadgeSize="xs"
      routeBadgeSize="xs"
      stats={stopMeta.stats}
      geo={stopMeta.geo}
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
          <span className="truncate font-medium">
            {stopNames?.name || stopId || t('tripInspection.unknownStop')}
          </span>
        </div>
        {stopId !== undefined && (
          <div className="text-muted-foreground truncate text-xs">{stopId}</div>
        )}
      </div>
    </>
  );

  return (
    <div
      {...tripStopRowDataAttrs(stopIndex)}
      {...(handleSelectStop ? { role: 'button' as const, tabIndex: 0 } : {})}
      onClick={handleSelectStop}
      onKeyDown={handleRowKeyDown}
      className={cn(
        'bg-background rounded-md border-2 px-3 py-2',
        handleSelectStop &&
          'cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
      )}
      style={isCurrent ? { borderColor: routeColors.color } : undefined}
    >
      {/* StopTime / StopInfo / Index  */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
        <TripStopMetaInfo
          align="right"
          serviceDate={serviceDate}
          now={now}
          arrivalMinutes={tripStopTime.timetableEntry.schedule.arrivalMinutes}
          departureMinutes={tripStopTime.timetableEntry.schedule.departureMinutes}
          collapseToleranceMinutes={display.collapseToleranceMinutes}
          showArrivalTime={display.showArrivalTime}
          showDepartureTime={display.showDepartureTime}
          stopIndex={stopIndex}
          totalStops={totalStops}
          timeTextColor={routeColors.color}
          labelBg={routeColors.color}
          labelFg={routeColors.textColor}
          frameColor={routeColors.color}
          className="flex min-h-8 flex-col items-end gap-1"
          stopId={stopId}
          inspectTarget={inspectTarget}
          onSelectStopById={onSelectStopById}
          onInspectTrip={onInspectTrip}
        />
        <div className="min-w-0">
          {stopContent}
          {infoLevelFlag.isDetailedEnabled && (
            <div className="border-border/70 mt-1 border-t border-dashed pt-1">
              <TripInfo
                size="sm"
                routeDirection={tripStopTime.timetableEntry.routeDirection}
                infoLevel={infoLevel}
                dataLangs={dataLangs}
                showRouteTypeIcon={false}
                agency={stopAgency}
                showAgency={false}
                attributes={stopAttributes}
              />
            </div>
          )}
        </div>
      </div>
      {infoLevelFlag.isVerboseEnabled && (
        <VerboseTripStopTime
          tripStopTime={tripStopTime}
          serviceDate={serviceDate}
          dataLangs={dataLangs}
        />
      )}
    </div>
  );
}

function TripStopPlaceholderRow({
  stopIndex,
  totalStops,
  currentPatternStopIndex,
  routeColors,
  infoLevel: _infoLevel,
}: TripStopPlaceholderRowProps) {
  const { t } = useTranslation();
  const isCurrent = stopIndex === currentPatternStopIndex;

  return (
    <div
      {...tripStopRowDataAttrs(stopIndex)}
      className={['rounded-md border-2 border-dashed px-3 py-2', 'border-border bg-muted/20'].join(
        ' ',
      )}
      style={isCurrent ? { borderColor: routeColors.color } : undefined}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
        <TripStopMetaInfo
          align="right"
          // No schedule → `StopTimeTimeInfo` is not rendered inside
          // `TripStopMetaInfo`; the value is effectively dead. Use `null`
          // (= "collapse disabled") to make the inert intent explicit
          // rather than picking a tolerance that would imply a policy.
          collapseToleranceMinutes={null}
          stopIndex={stopIndex}
          totalStops={totalStops}
          labelBg={routeColors.color}
          labelFg={routeColors.textColor}
          frameColor={routeColors.color}
          className="flex min-h-8 flex-col items-end gap-1"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground truncate font-medium">
              {t('tripInspection.unknownStop')} ({stopIndex + 1}/{totalStops})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export const TripStops1 = memo(function TripStops({
  tripSnapshot,
  renderedSnapshot,
  selectedPatternStopIndex,
  routeColors,
  infoLevel,
  dataLangs,
  now,
  onInspectTrip,
  onSelectStopById,
}: TripStopsProps) {
  const visibleTripStopRows = getVisibleTripStopRows({
    tripSnapshot,
    renderedSnapshot,
    selectedPatternStopIndex,
  });

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-2">
        {visibleTripStopRows.map((row) => {
          const rowKey = getRenderedTripStopRowKey(row);

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
              tripLocator={tripSnapshot.locator}
              totalStops={row.totalStops}
              currentPatternStopIndex={selectedPatternStopIndex}
              routeColors={routeColors}
              infoLevel={infoLevel}
              dataLangs={dataLangs}
              serviceDate={tripSnapshot.serviceDate}
              now={now}
              onInspectTrip={onInspectTrip}
              onSelectStopById={onSelectStopById}
            />
          );
        })}
      </div>
    </section>
  );
});
