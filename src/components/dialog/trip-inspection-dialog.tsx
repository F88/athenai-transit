import { useTranslation } from 'react-i18next';
import { useRef } from 'react';

import { AbsoluteStopTime } from '@/components/absolute-stop-time';
import { ScrollFadeEdge } from '@/components/shared/scroll-fade-edge';
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
import {
  LOW_CONTRAST_BADGE_MIN_RATIO,
  LOW_CONTRAST_TEXT_MIN_RATIO,
} from '@/domain/transit/color-resolver/contrast-thresholds';
import {
  getContrastAdjustedRouteColors,
  resolveRouteColors,
} from '@/domain/transit/color-resolver/route-colors';
import { getHeadsignDisplayNames } from '@/domain/transit/get-headsign-display-names';
import { getStopDisplayNames } from '@/domain/transit/get-stop-display-names';
import { formatAbsoluteTime } from '@/domain/transit/time';
import { getTimetableEntryAttributes } from '@/domain/transit/timetable-entry-attributes';
import { useInfoLevel } from '@/hooks/use-info-level';
import { useThemeContrastAssessment } from '@/hooks/use-is-low-contrast-against-theme';
import { useScrollFades } from '@/hooks/use-scroll-fades';
import { getContrastAwareAlphaSuffixes } from '@/utils/color/contrast-alpha-suffixes';
import type { InfoLevel } from '@/types/app/settings';
import type { SelectedTripSnapshot, TripStopTime } from '@/types/app/transit-composed';
import { IdBadge } from '../badge/id-badge';
import { TripPositionIndicator } from '../label/trip-position-indicator';
import { RouteBadge } from '../badge/route-badge';
import { StopTimeItemRichInfo } from '../stop-time-item-rich-info';

interface TripInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: SelectedTripSnapshot | null;
  now: Date;
  infoLevel: InfoLevel;
  dataLang: readonly string[];
}

interface TripInspectionStopRowProps {
  stop: TripStopTime;
  currentStopIndex: number;
  infoLevel: InfoLevel;
  serviceDate: Date;
  dataLang: readonly string[];
}

interface TripInspectionSummaryProps {
  snapshot: SelectedTripSnapshot;
  infoLevel: InfoLevel;
  dataLang: readonly string[];
}

interface TripInspectionCurrentStopProps {
  snapshot: SelectedTripSnapshot;
  infoLevel: InfoLevel;
}

interface StopSummaryProps {
  stop: TripStopTime | undefined;
  stopNames: ReturnType<typeof getStopDisplayNames> | null;
  stopName: string;
  infoLevel: InfoLevel;
  dataLang: readonly string[];
}

function formatScheduleTime(minutes: number, serviceDate: Date): string {
  return formatAbsoluteTime(minutesToDate(serviceDate, minutes));
}

function SimpleStopSummary({
  stopNames,
  stopName,
}: Pick<StopSummaryProps, 'stopNames' | 'stopName'>) {
  return (
    <div className="min-w-0 rounded-md border p-2">
      {stopNames && stopNames.subNames.length > 0 && (
        <div className="text-muted-foreground truncate text-center text-xs">
          {stopNames.subNames.join(' / ')}
        </div>
      )}
      <div className="truncate text-center text-sm font-medium">{stopName}</div>
    </div>
  );
}

function RichStopSummary({ stop, infoLevel, dataLang }: StopSummaryProps) {
  if (stop?.stopMeta === undefined) {
    return null;
  }
  return (
    <div className="min-w-0 rounded-md border p-2">
      <>
        <StopInfo
          stop={stop.stopMeta.stop}
          agencies={stop.stopMeta.agencies}
          showAgencies={true}
          routeTypes={stop.routeTypes}
          showRouteTypes={true}
          routes={stop.stopMeta.routes}
          showRoutes={true}
          stats={stop.stopMeta.stats}
          geo={stop.stopMeta.geo}
          mapCenter={null}
          infoLevel={infoLevel}
          dataLang={dataLang}
          agencyBadgeSize="sm"
          routeBadgeSize="xs"
        />
      </>
    </div>
  );
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
  const stopAttributes = getTimetableEntryAttributes(stop.timetableEntry);
  const stopAgency = stopMeta?.agencies.find(
    (agency) => agency.agency_id === stop.timetableEntry.routeDirection.route.agency_id,
  );
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
      {/* StopTimeItemRichInfo  */}
      <StopTimeItemRichInfo
        entry={stop.timetableEntry}
        infoLevel={infoLevel}
        dataLang={dataLang}
        showRouteTypeIcon={false}
        agency={stopAgency}
        showAgency={false}
        attributes={stopAttributes}
      />
      <hr />
      {/* StopTimeItem */}
    </div>
  );
}

function TripInspectionSummary({ snapshot, infoLevel, dataLang }: TripInspectionSummaryProps) {
  const infoLevelFlag = useInfoLevel(infoLevel);
  const route = snapshot.route;
  const selectedStop = snapshot.selectedStop;
  const selectedStopAttributes = getTimetableEntryAttributes(selectedStop.timetableEntry);
  const selectedAgency = selectedStop.stopMeta?.agencies.find(
    (agency) => agency.agency_id === route.agency_id,
  );
  const { routeColor } = resolveRouteColors(route, 'css-hex');
  const routeColorAssessment = useThemeContrastAssessment(routeColor, LOW_CONTRAST_BADGE_MIN_RATIO);
  const contrastAdjustedRouteColors = getContrastAdjustedRouteColors(
    route,
    routeColorAssessment.isLowContrast,
    'css-hex',
  );
  const adjustedColorAssessment = useThemeContrastAssessment(
    contrastAdjustedRouteColors.color,
    LOW_CONTRAST_TEXT_MIN_RATIO,
  );
  const { subtleAlphaSuffix, emphasisAlphaSuffix } = getContrastAwareAlphaSuffixes(
    adjustedColorAssessment.ratio,
  );
  const emphasisAccentColor = `${contrastAdjustedRouteColors.color}${emphasisAlphaSuffix}`;
  const subtleAccentColor = `${contrastAdjustedRouteColors.color}${subtleAlphaSuffix}`;
  // const routeAgencyLangs = selectedStop.stopMeta
  //   ? resolveAgencyLang(selectedStop.stopMeta.agencies, route.agency_id)
  //   : DEFAULT_AGENCY_LANG;
  // const routeNames = getRouteDisplayNames(route, dataLang, routeAgencyLangs, 'short');

  const lastStop = snapshot.stopTimes[snapshot.stopTimes.length - 1];

  return (
    <section className="flex flex-col gap-2 pt-3 text-left">
      <TripPositionIndicator
        stopIndex={selectedStop.timetableEntry.patternPosition.stopIndex}
        totalStops={selectedStop.timetableEntry.patternPosition.totalStops}
        size={infoLevelFlag.isDetailedEnabled ? 'md' : infoLevelFlag.isNormalEnabled ? 'xs' : 'xs'}
        showEmoji={infoLevelFlag.isVerboseEnabled}
        showTrack={infoLevelFlag.isNormalEnabled}
        trackColor={subtleAccentColor}
        dotColor={emphasisAccentColor}
        currentColor={contrastAdjustedRouteColors.color}
        trackBorderColor={contrastAdjustedRouteColors.color}
        showTrackBorder={false}
        showPositionLabel={true}
        labelTextColor={contrastAdjustedRouteColors.textColor}
        labelBgColor={contrastAdjustedRouteColors.color}
      />

      {/* StopTimeItemRichInfo  */}
      <StopTimeItemRichInfo
        entry={selectedStop.timetableEntry}
        infoLevel={'simple'}
        dataLang={dataLang}
        showRouteTypeIcon={true}
        agency={selectedAgency}
        showAgency={true}
        attributes={selectedStopAttributes}
      />

      {/* Last stop */}
      <RichStopSummary
        stop={lastStop}
        infoLevel={infoLevel}
        dataLang={dataLang}
        stopNames={null}
        stopName={''}
      />
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
  now: _now,
}: TripInspectionDialogProps) {
  const { t } = useTranslation();
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const contentScroll = useScrollFades(
    contentContainerRef,
    snapshot
      ? `${snapshot.locator.patternId}:${snapshot.locator.serviceId}:${snapshot.locator.tripIndex}:${snapshot.currentStopIndex}:${snapshot.stopTimes.length}`
      : 'empty',
  );

  if (!snapshot) {
    return <Dialog open={false} onOpenChange={onOpenChange} />;
  }

  const routeAgencyLangs = snapshot.selectedStop.stopMeta
    ? resolveAgencyLang(snapshot.selectedStop.stopMeta.agencies, snapshot.route.agency_id)
    : DEFAULT_AGENCY_LANG;
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
  const headsignTitle = getHeadsignDisplayNames(
    snapshot.selectedStop.timetableEntry.routeDirection,
    dataLang,
    routeAgencyLangs,
    'stop',
  ).resolved.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80dvh] max-w-120 flex-col gap-0 overflow-hidden">
        <DialogHeader className="border-border shrink-0 border-b pb-3 sm:text-center">
          {/* {now.toLocaleDateString()} */}
          <DialogTitle className="flex items-center justify-center gap-2 text-base">
            <RouteBadge
              route={snapshot.route}
              size="sm"
              dataLang={dataLang}
              agencyLangs={routeAgencyLangs}
              infoLevel={infoLevel}
              showBorder={true}
            />
            {headsignTitle ? (
              <span className="truncate">{headsignTitle}</span>
            ) : (
              t('tripInspection.title')
            )}
          </DialogTitle>
          <DialogDescription asChild className="text-center sm:text-center">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2">
              <SimpleStopSummary stopNames={firstStopNames} stopName={firstStopName} />
              <div className="flex items-center justify-center">
                <span
                  aria-hidden="true"
                  className="border-l-muted-foreground h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent"
                />
              </div>
              <SimpleStopSummary stopNames={lastStopNames} stopName={lastStopName} />
            </div>
          </DialogDescription>

          <TripInspectionSummary snapshot={snapshot} infoLevel={infoLevel} dataLang={dataLang} />
        </DialogHeader>

        <div
          ref={contentContainerRef}
          onScroll={contentScroll.handleScroll}
          className="relative min-h-0 flex-1 overflow-y-auto text-sm"
        >
          {contentScroll.showTop && (
            <ScrollFadeEdge position="top" className="via-background/90 -mb-5 h-5" />
          )}
          <div className="flex flex-col gap-4 pt-3 pb-4">
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
          {contentScroll.showBottom && <ScrollFadeEdge position="bottom" />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
