import { useTranslation } from 'react-i18next';

import { AbsoluteStopTime } from '@/components/absolute-stop-time';
import { StopInfo } from '@/components/stop-info';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DEFAULT_AGENCY_LANG, resolveAgencyLang } from '@/config/transit-defaults';
import { minutesToDate } from '@/domain/transit/calendar-utils';
import { getHeadsignDisplayNames } from '@/domain/transit/get-headsign-display-names';
import { getStopDisplayNames } from '@/domain/transit/get-stop-display-names';
import { getRouteDisplayNames } from '@/domain/transit/name-resolver/get-route-display-names';
import { formatAbsoluteTime } from '@/domain/transit/time';
import type { InfoLevel } from '@/types/app/settings';
import type { SelectedTripSnapshot, TripStopTime } from '@/types/app/transit-composed';
import { IdBadge } from '../badge/id-badge';
import { RouteBadge } from '../badge/route-badge';

interface TripInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: SelectedTripSnapshot | null;
  infoLevel: InfoLevel;
  dataLang: readonly string[];
}

interface TripInspectionStopRowProps {
  stop: TripStopTime;
  currentStopIndex: number;
  infoLevel: InfoLevel;
  serviceDate?: Date;
  dataLang: readonly string[];
}

interface TripInspectionSummaryProps {
  snapshot: SelectedTripSnapshot;
  infoLevel: InfoLevel;
  dataLang: readonly string[];
}

interface RouteInfoProps {
  route: SelectedTripSnapshot['route'];
  infoLevel: InfoLevel;
  dataLang: readonly string[];
  agencyLangs: readonly string[];
  routeSubNames: readonly string[];
}

interface TripInspectionCurrentStopProps {
  snapshot: SelectedTripSnapshot;
  infoLevel: InfoLevel;
}

function formatScheduleTime(minutes: number, serviceDate?: Date): string {
  if (!serviceDate) {
    return String(minutes);
  }

  return formatAbsoluteTime(minutesToDate(serviceDate, minutes));
}

function TripInspectionStopRow({
  stop,
  currentStopIndex,
  infoLevel,
  dataLang,
  serviceDate,
}: TripInspectionStopRowProps) {
  const stopMeta = stop.stopMeta;
  const stopId = stop.stopMeta?.stop.stop_id || '(unknown-stop)';
  const stopAgencyLangs = stop.stopMeta
    ? resolveAgencyLang(stop.stopMeta.agencies, stop.stopMeta.stop.agency_id)
    : DEFAULT_AGENCY_LANG;
  const stopNames = stop.stopMeta
    ? getStopDisplayNames(stop.stopMeta.stop, dataLang, stopAgencyLangs)
    : null;
  const stopIndex = stop.timetableEntry.patternPosition.stopIndex;
  const isCurrent = stopIndex === currentStopIndex;

  return (
    <div
      key={`${stopId}:${stopIndex}`}
      className={[
        'rounded-md border px-3 py-2',
        isCurrent ? 'border-primary bg-primary/5' : 'border-border bg-background',
      ].join(' ')}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          {stopMeta ? (
            <StopInfo
              stop={stopMeta.stop}
              agencies={stopMeta.agencies}
              showAgencies={true}
              routeTypes={stop.routeTypes}
              showRouteTypes={true}
              routes={stopMeta.routes}
              showRoutes={true}
              stats={stopMeta.stats}
              geo={stopMeta.geo}
              mapCenter={null}
              infoLevel={infoLevel}
              dataLang={dataLang}
              agencyBadgeSize="sm"
              routeBadgeSize="xs"
            />
          ) : (
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
          )}
        </div>
        <div className="shrink-0 text-right text-xs">
          <div className="flex items-center justify-end gap-1">
            <AbsoluteStopTime
              timeText={formatScheduleTime(
                stop.timetableEntry.schedule.arrivalMinutes,
                serviceDate,
              )}
              textColor="currentColor"
              showDepartureMarker={false}
              showArrivalMarker={true}
            />
          </div>
          <div className="flex items-center justify-end gap-1">
            <AbsoluteStopTime
              timeText={formatScheduleTime(
                stop.timetableEntry.schedule.departureMinutes,
                serviceDate,
              )}
              textColor="currentColor"
              showDepartureMarker={true}
              showArrivalMarker={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function RouteInfo({ route, infoLevel, dataLang, agencyLangs, routeSubNames }: RouteInfoProps) {
  return (
    <>
      <dd className="flex min-w-0 items-center gap-2">
        <RouteBadge
          route={route}
          size="sm"
          dataLang={dataLang}
          agencyLangs={agencyLangs}
          infoLevel={infoLevel}
          showBorder={true}
        />
        {routeSubNames.length > 0 && (
          <div className="text-muted-foreground min-w-0 truncate text-xs">
            {routeSubNames.join(' / ')}
          </div>
        )}
      </dd>
    </>
  );
}

function TripInspectionSummary({ snapshot, infoLevel, dataLang }: TripInspectionSummaryProps) {
  const { t } = useTranslation();

  const route = snapshot.route;
  const selectedStop = snapshot.selectedStop;
  const routeAgencyLangs = selectedStop.stopMeta
    ? resolveAgencyLang(selectedStop.stopMeta.agencies, route.agency_id)
    : DEFAULT_AGENCY_LANG;
  const routeNames = getRouteDisplayNames(route, dataLang, routeAgencyLangs, 'short');

  const headsignNames = getHeadsignDisplayNames(
    selectedStop.timetableEntry.routeDirection,
    dataLang,
    routeAgencyLangs,
    'stop',
  );
  const headsignLabel = headsignNames.resolved.name;

  const firstStop = snapshot.stopTimes[0];
  const firstStopId = firstStop?.stopMeta?.stop.stop_id || '(unknown-stop)';
  const firstStopAgencyLangs = firstStop?.stopMeta
    ? resolveAgencyLang(firstStop.stopMeta.agencies, firstStop.stopMeta.stop.agency_id)
    : DEFAULT_AGENCY_LANG;
  const firstStopNames = firstStop?.stopMeta
    ? getStopDisplayNames(firstStop.stopMeta.stop, dataLang, firstStopAgencyLangs)
    : null;
  const firstStopName = firstStopNames?.name || firstStopId;

  const lastStop = snapshot.stopTimes[snapshot.stopTimes.length - 1];
  const lastStopId = lastStop?.stopMeta?.stop.stop_id || '(unknown-stop)';
  const lastStopAgencyLangs = lastStop?.stopMeta
    ? resolveAgencyLang(lastStop.stopMeta.agencies, lastStop.stopMeta.stop.agency_id)
    : DEFAULT_AGENCY_LANG;
  const lastStopNames = lastStop?.stopMeta
    ? getStopDisplayNames(lastStop.stopMeta.stop, dataLang, lastStopAgencyLangs)
    : null;
  const lastStopName = lastStopNames?.name || lastStopId;

  return (
    <section className="flex flex-col gap-2 pt-3 text-left">
      {/* Route */}
      <RouteInfo
        route={route}
        infoLevel={infoLevel}
        dataLang={dataLang}
        agencyLangs={routeAgencyLangs}
        routeSubNames={routeNames.resolved.subNames}
      />
      {/* Headsign */}
      <div className="min-w-0">
        {headsignNames.resolved.subNames.length > 0 && (
          <div className="text-muted-foreground truncate text-xs">
            {headsignNames.resolved.subNames.join(' / ')}
          </div>
        )}
        <div>{headsignLabel || t('tripInspection.values.none')}</div>
      </div>
      {/* Trip Span */}
      <dt className="text-muted-foreground">{t('tripInspection.fields.tripSpan')}</dt>
      <dd className="min-w-0">
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-x-2">
          <div className="min-w-0">
            {firstStopNames && firstStopNames.subNames.length > 0 && (
              <div className="text-muted-foreground truncate text-xs">
                {firstStopNames.subNames.join(' / ')}
              </div>
            )}
            <div className="truncate font-medium">{firstStopName}</div>
          </div>

          <div className="text-muted-foreground pt-4 text-xs">-</div>
          <div className="min-w-0">
            {lastStopNames && lastStopNames.subNames.length > 0 && (
              <div className="text-muted-foreground truncate text-right text-xs">
                {lastStopNames.subNames.join(' / ')}
              </div>
            )}
            <div className="truncate text-right font-medium">{lastStopName}</div>
          </div>
        </div>
      </dd>
    </section>
  );
}

function TripInspectionCurrentStop({ snapshot, infoLevel }: TripInspectionCurrentStopProps) {
  if (infoLevel !== 'verbose') {
    return null;
  }

  const selectedStop: TripStopTime = snapshot.selectedStop;
  const selectedStopId = selectedStop.stopMeta?.stop.stop_id || '(unknown-stop)';
  const selectedStopName = selectedStop.stopMeta?.stop.stop_name || selectedStopId;

  return (
    <section className="flex flex-col gap-2">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Stop</dt>
        <dd className="min-w-0">
          <div className="truncate font-medium">
            <IdBadge>{selectedStopId}</IdBadge>
            {selectedStopName} ({snapshot.currentStopIndex + 1} / {snapshot.stopTimes.length})
          </div>
        </dd>
      </dl>
    </section>
  );
}

export function TripInspectionDialog({
  open,
  onOpenChange,
  snapshot,
  infoLevel,
  dataLang,
}: TripInspectionDialogProps) {
  const { t } = useTranslation();

  if (!snapshot) {
    return <Dialog open={false} onOpenChange={onOpenChange} />;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80dvh] max-w-120 flex-col gap-0 overflow-hidden">
        <DialogHeader className="border-border shrink-0 border-b pb-3 sm:text-center">
          <DialogTitle className="text-base">{t('tripInspection.title')}</DialogTitle>
          <DialogDescription className="text-center sm:text-center">
            {t('tripInspection.description')}
          </DialogDescription>
          <TripInspectionSummary snapshot={snapshot} infoLevel={infoLevel} dataLang={dataLang} />
        </DialogHeader>

        <div className="overflow-y-auto pt-3 text-sm">
          <div className="flex flex-col gap-4">
            <TripInspectionCurrentStop snapshot={snapshot} infoLevel={infoLevel} />

            <section className="flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                {snapshot.stopTimes.map((stop) => {
                  const stopId = stop.stopMeta?.stop.stop_id || '(unknown-stop)';
                  const stopIndex = stop.timetableEntry.patternPosition.stopIndex;

                  return (
                    <TripInspectionStopRow
                      key={`${stopId}:${stopIndex}`}
                      stop={stop}
                      currentStopIndex={snapshot.currentStopIndex}
                      infoLevel={infoLevel}
                      dataLang={dataLang}
                      serviceDate={snapshot.serviceDate}
                    />
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
