import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { JourneyTimeBar } from '@/components/journey-time-bar';
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
import { getTimetableEntryAttributes } from '@/domain/transit/timetable-entry-attributes';
import { useInfoLevel } from '@/hooks/use-info-level';
import { useThemeContrastAssessment } from '@/hooks/use-is-low-contrast-against-theme';
import { useScrollFades } from '@/hooks/use-scroll-fades';
import type { InfoLevel } from '@/types/app/settings';
import type { Agency, Route } from '@/types/app/transit';
import type {
  ContextualTimetableEntry,
  SelectedTripSnapshot,
  TripStopTime,
} from '@/types/app/transit-composed';
import { getContrastAwareAlphaSuffixes } from '@/utils/color/contrast-alpha-suffixes';
import { routeTypesEmoji } from '@/utils/route-type-emoji';
import { AgencyBadge } from '../badge/agency-badge';
import { IdBadge } from '../badge/id-badge';
import { RouteBadge } from '../badge/route-badge';
import { TripPositionIndicator } from '../label/trip-position-indicator';
import { StopTimeDetailInfo } from '../stop-time-detail-info';
import { StopTimeTimeInfo } from '../stop-time-time-info';
import { StopTimeItem } from '../stop-time-item';

interface TripInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: SelectedTripSnapshot | null;
  now: Date;
  infoLevel: InfoLevel;
  dataLangs: readonly string[];
}

interface TripInspectionStopRowProps {
  stop: TripStopTime;
  currentStopIndex: number;
  infoLevel: InfoLevel;
  serviceDate: Date;
  dataLangs: readonly string[];
  now: Date;
}

interface TripInspectionSummaryProps {
  snapshot: SelectedTripSnapshot;
  infoLevel: InfoLevel;
  dataLangs: readonly string[];
}

interface TripInspectionCurrentStopProps {
  snapshot: SelectedTripSnapshot;
  infoLevel: InfoLevel;
}

interface StopSummaryProps {
  stopNames: ReturnType<typeof getStopDisplayNames> | null;
  stopName: string;
}

interface RichStopSummaryProps {
  stop: TripStopTime | undefined;
  infoLevel: InfoLevel;
  dataLangs: readonly string[];
}

function resolveTripStopDisplay(stop: TripStopTime | undefined, dataLangs: readonly string[]) {
  const stopId = stop?.stopMeta?.stop.stop_id || '(unknown-stop)';
  const stopAgencyLangs = stop?.stopMeta
    ? resolveAgencyLang(stop.stopMeta.agencies, stop.stopMeta.stop.agency_id)
    : DEFAULT_AGENCY_LANG;
  const stopNames = stop?.stopMeta
    ? getStopDisplayNames(stop.stopMeta.stop, dataLangs, stopAgencyLangs)
    : null;

  return {
    stopNames,
    stopName: stopNames?.name || stopId,
  };
}

function getSelectedRowScrollTop(container: HTMLDivElement, selectedRow: HTMLElement): number {
  const edgePadding = 12;
  const containerRect = container.getBoundingClientRect();
  const rowRect = selectedRow.getBoundingClientRect();
  const rowTopWithinContainer = rowRect.top - containerRect.top + container.scrollTop;

  if (selectedRow.clientHeight >= container.clientHeight - edgePadding * 2) {
    return Math.max(0, rowTopWithinContainer - edgePadding);
  }

  return Math.max(
    0,
    rowTopWithinContainer - (container.clientHeight - selectedRow.clientHeight) / 2,
  );
}

function SimpleStopSummary({ stopNames, stopName }: StopSummaryProps) {
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

function RichStopSummary({ stop, infoLevel, dataLangs }: RichStopSummaryProps) {
  if (stop?.stopMeta === undefined) {
    return null;
  }
  return (
    <div className="min-w-0 rounded-md p-2">
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
        dataLangs={dataLangs}
        agencyBadgeSize="sm"
        routeBadgeSize="xs"
      />
    </div>
  );
}

function TripInspectionStopRow({
  stop,
  currentStopIndex,
  infoLevel,
  dataLangs,
  serviceDate,
  now,
}: TripInspectionStopRowProps) {
  const infoLevelFlag = useInfoLevel(infoLevel);
  const stopMeta = stop.stopMeta;
  const stopId = stop.stopMeta?.stop.stop_id || '(unknown-stop)';
  const stopAttributes = getTimetableEntryAttributes(stop.timetableEntry);
  const stopAgency = stopMeta?.agencies.find(
    (agency) => agency.agency_id === stop.timetableEntry.routeDirection.route.agency_id,
  );
  const stopRoute = stop.timetableEntry.routeDirection.route;
  const { routeColor } = resolveRouteColors(stopRoute, 'css-hex');
  const routeColorAssessment = useThemeContrastAssessment(routeColor, LOW_CONTRAST_BADGE_MIN_RATIO);
  const contrastAdjustedRouteColors = getContrastAdjustedRouteColors(
    stopRoute,
    routeColorAssessment.isLowContrast,
    'css-hex',
  );
  const stopAgencyLangs = stop.stopMeta
    ? resolveAgencyLang(stop.stopMeta.agencies, stop.stopMeta.stop.agency_id)
    : DEFAULT_AGENCY_LANG;
  const stopNames = stop.stopMeta
    ? getStopDisplayNames(stop.stopMeta.stop, dataLangs, stopAgencyLangs)
    : null;
  const stopIndex = stop.timetableEntry.patternPosition.stopIndex;
  const isCurrent = stopIndex === currentStopIndex;
  const isTerminalStop = stop.timetableEntry.patternPosition.isTerminal;
  const isFirstStop = stop.timetableEntry.patternPosition.isOrigin;
  const showArrivalTime = isTerminalStop || !isFirstStop;
  const showDepartureTime = !isTerminalStop;

  const contextualTimetableEntry: ContextualTimetableEntry = {
    serviceDate: serviceDate,
    ...stop.timetableEntry,
  };

  return (
    <div
      key={`${stopId}:${stopIndex}`}
      data-trip-stop-index={stopIndex}
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
              dataLangs={dataLangs}
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
        <StopTimeTimeInfo
          arrivalMinutes={stop.timetableEntry.schedule.arrivalMinutes}
          departureMinutes={stop.timetableEntry.schedule.departureMinutes}
          serviceDate={serviceDate}
          now={now}
          size="md"
          // size="lg"
          // size="xl"
          showArrivalTime={showArrivalTime}
          showDepartureTime={showDepartureTime}
          collapseArrivalWhenSameAsDeparture={true}
          forceShowRelativeTime={true}
          showVerbose={false}
          textAppearance={{ color: contrastAdjustedRouteColors.color }}
        />
      </div>
      {/* StopTimeDetailInfo  */}
      <StopTimeDetailInfo
        entry={stop.timetableEntry}
        infoLevel={infoLevel}
        dataLangs={dataLangs}
        showRouteTypeIcon={false}
        agency={stopAgency}
        showAgency={false}
        attributes={stopAttributes}
      />

      {/* StopTimeItem */}
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

function TripInspectionSummary({ snapshot, infoLevel, dataLangs }: TripInspectionSummaryProps) {
  const infoLevelFlag = useInfoLevel(infoLevel);
  const route = snapshot.route;
  const selectedStop = snapshot.selectedStop;
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
  // const routeNames = getRouteDisplayNames(route, dataLangs, routeAgencyLangs, 'short');

  // StopTimes
  const stopTimes = snapshot.stopTimes;
  const firstStop = stopTimes[0];
  const lastStop = stopTimes[stopTimes.length - 1];
  const totalMinutes =
    lastStop.timetableEntry.schedule.arrivalMinutes -
    firstStop.timetableEntry.schedule.departureMinutes;
  const remainingMinutes =
    lastStop.timetableEntry.schedule.arrivalMinutes -
    selectedStop.timetableEntry.schedule.departureMinutes;

  return (
    <section className="flex flex-col gap-2 pt-3 text-left">
      {/* TripPositionIndicator */}
      <TripPositionIndicator
        stopIndex={selectedStop.timetableEntry.patternPosition.stopIndex}
        totalStops={selectedStop.timetableEntry.patternPosition.totalStops}
        size="md"
        showEmoji={infoLevelFlag.isNormalEnabled}
        showTrack={infoLevelFlag.isNormalEnabled}
        trackColor={subtleAccentColor}
        dotColor={emphasisAccentColor}
        currentColor={contrastAdjustedRouteColors.color}
        trackBorderColor={contrastAdjustedRouteColors.color}
        showTrackBorder={false}
        showPositionLabel={infoLevelFlag.isNormalEnabled}
        labelTextColor={contrastAdjustedRouteColors.textColor}
        labelBgColor={contrastAdjustedRouteColors.color}
      />

      {/* JourneyTimeBar */}
      <JourneyTimeBar
        remainingMinutes={remainingMinutes}
        totalMinutes={totalMinutes}
        size="xl"
        showEmoji={infoLevelFlag.isNormalEnabled}
        fillColor={contrastAdjustedRouteColors.color}
        unfilledColor={emphasisAccentColor}
        showRMins={infoLevelFlag.isNormalEnabled}
        showTMins={infoLevelFlag.isNormalEnabled}
        minsPosition="right"
        fillDirection="rtl"
        borderColor={contrastAdjustedRouteColors.color}
        minsTextColor={contrastAdjustedRouteColors.textColor}
        minsBgColor={contrastAdjustedRouteColors.color}
        showBorder={false}
      />

      {/* StopTimeDetailInfo  */}
      {/* <StopTimeDetailInfo
        entry={selectedStop.timetableEntry}
        infoLevel="normal"
        // infoLevel="detailed"
        // infoLevel="verbose"
        dataLang={dataLangs}
        showRouteTypeIcon={true}
        agency={selectedAgency}
        showAgency={true}
        attributes={selectedStopAttributes}
      /> */}

      {/* Last stop */}
      <RichStopSummary stop={lastStop} infoLevel={infoLevel} dataLangs={dataLangs} />
    </section>
  );
}

function TripInspectionCurrentStop({ snapshot }: TripInspectionCurrentStopProps) {
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
  dataLangs,
  now,
}: TripInspectionDialogProps) {
  const infoLevelFlag = useInfoLevel(infoLevel);
  const { t } = useTranslation();
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const [contentContainerEl, setContentContainerEl] = useState<HTMLDivElement | null>(null);
  const setContentContainerNode = useCallback((node: HTMLDivElement | null) => {
    contentContainerRef.current = node;
    setContentContainerEl(node);
  }, []);
  const contentScroll = useScrollFades(
    contentContainerRef,
    snapshot
      ? `${snapshot.locator.patternId}:${snapshot.locator.serviceId}:${snapshot.locator.tripIndex}:${snapshot.currentStopIndex}:${snapshot.stopTimes.length}`
      : 'empty',
  );
  const selectedStopRowKey = snapshot
    ? `${snapshot.currentStopIndex}:${snapshot.stopTimes.length}`
    : 'empty';

  useEffect(() => {
    if (!open || !snapshot || !contentContainerEl) {
      return;
    }

    let firstFrameId = 0;
    let secondFrameId = 0;
    let correctionFrameId = 0;

    const applyScrollToSelectedRow = (behavior: ScrollBehavior) => {
      const container = contentContainerEl;
      const selectedRow = container?.querySelector<HTMLElement>(
        `[data-trip-stop-index="${snapshot.currentStopIndex}"]`,
      );

      if (!container || !selectedRow) {
        return false;
      }

      const nextScrollTop = getSelectedRowScrollTop(container, selectedRow);

      if (container.scrollTop === nextScrollTop) {
        return false;
      }

      container.scrollTo({
        top: nextScrollTop,
        behavior,
      });

      return true;
    };

    const correctSelectedRowVisibility = (remainingPasses: number) => {
      if (remainingPasses <= 0) {
        return;
      }

      correctionFrameId = window.requestAnimationFrame(() => {
        const didScroll = applyScrollToSelectedRow('auto');

        if (didScroll) {
          correctSelectedRowVisibility(remainingPasses - 1);
        }
      });
    };

    firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        applyScrollToSelectedRow('smooth');
        correctSelectedRowVisibility(3);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrameId);
      window.cancelAnimationFrame(secondFrameId);
      window.cancelAnimationFrame(correctionFrameId);
    };
  }, [contentContainerEl, open, selectedStopRowKey, snapshot]);

  if (!snapshot) {
    return <Dialog open={false} onOpenChange={onOpenChange} />;
  }

  const selectedTripStopTime: TripStopTime = snapshot.selectedStop;
  const agencies: Agency[] | undefined = selectedTripStopTime.stopMeta?.agencies;
  const route: Route = snapshot.route;
  const tripStopTimes: TripStopTime[] = snapshot.stopTimes;

  const routeAgencyLangs =
    agencies !== undefined ? resolveAgencyLang(agencies, route.agency_id) : DEFAULT_AGENCY_LANG;
  const routeAgency = agencies?.find((agency) => agency.agency_id === route.agency_id);

  const headsignTitle = getHeadsignDisplayNames(
    snapshot.selectedStop.timetableEntry.routeDirection,
    dataLangs,
    routeAgencyLangs,
    'stop',
  ).resolved.name;

  // First TripStopTime
  const firstStop = tripStopTimes[0];
  const { stopName: firstStopName, stopNames: firstStopNames } = resolveTripStopDisplay(
    firstStop,
    dataLangs,
  );

  // Last TripStopTime
  const lastStop = tripStopTimes[tripStopTimes.length - 1];
  const { stopName: lastStopName, stopNames: lastStopNames } = resolveTripStopDisplay(
    lastStop,
    dataLangs,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80dvh] max-w-120 flex-col gap-0 overflow-hidden">
        <DialogHeader className="border-border shrink-0 border-b pb-3 sm:text-center">
          {/* {now.toLocaleDateString()} */}
          <DialogTitle className="flex items-center justify-center gap-2 text-base">
            {routeTypesEmoji([route.route_type])}
            {routeAgency && (
              <>
                <AgencyBadge
                  size="sm"
                  agency={routeAgency}
                  dataLang={dataLangs}
                  agencyLangs={routeAgencyLangs}
                  infoLevel={infoLevel}
                  showBorder={true}
                />
              </>
            )}
            <RouteBadge
              route={snapshot.route}
              size="sm"
              dataLang={dataLangs}
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
                  className="border-l-muted-foreground h-0 w-0 border-y-[6px] border-l-10 border-y-transparent"
                />
              </div>
              <SimpleStopSummary stopNames={lastStopNames} stopName={lastStopName} />
            </div>
          </DialogDescription>

          <TripInspectionSummary snapshot={snapshot} infoLevel={infoLevel} dataLangs={dataLangs} />
          {infoLevelFlag.isVerboseEnabled && (
            <>
              {now.toISOString()}
              <TripInspectionCurrentStop snapshot={snapshot} infoLevel={infoLevel} />
            </>
          )}
        </DialogHeader>

        <div
          ref={setContentContainerNode}
          onScroll={contentScroll.handleScroll}
          className="relative min-h-0 flex-1 overflow-y-auto text-sm"
        >
          {contentScroll.showTop && (
            <ScrollFadeEdge position="top" className="via-background/90 -mb-5 h-5" />
          )}
          <div className="flex flex-col gap-4 pt-3 pb-4">
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
                      dataLangs={dataLangs}
                      serviceDate={snapshot.serviceDate}
                      now={now}
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
