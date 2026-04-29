import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { JourneyTimeBar } from '@/components/journey-time-bar';
import { ScrollFadeEdge } from '@/components/shared/scroll-fade-edge';
import { StopInfo } from '@/components/stop-info';
import { Button } from '@/components/ui/button';
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
  type AdjustedRouteColors,
  getContrastAdjustedRouteColors,
  resolveRouteColors,
} from '@/domain/transit/color-resolver/route-colors';
import { minutesToDate } from '@/domain/transit/calendar-utils';
import { getHeadsignDisplayNames } from '@/domain/transit/get-headsign-display-names';
import { getStopDisplayNames } from '@/domain/transit/get-stop-display-names';
import { deriveJourneyTimeFromTrip } from '@/domain/transit/journey-time';
import { formatAbsoluteTime } from '@/domain/transit/time';
import { getOriginStop, getTerminalStop } from '@/domain/transit/trip-stop-times';
import { useInfoLevel } from '@/hooks/use-info-level';
import { useThemeContrastAssessment } from '@/hooks/use-is-low-contrast-against-theme';
import { useScrollFades } from '@/hooks/use-scroll-fades';
import type { InfoLevel } from '@/types/app/settings';
import type { Agency, Route } from '@/types/app/transit';
import type {
  SelectedTripSnapshot,
  TripInspectionTarget,
  TripStopTime,
} from '@/types/app/transit-composed';
import { getContrastAwareAlphaSuffixes } from '@/utils/color/contrast-alpha-suffixes';
import { IdBadge } from '../badge/id-badge';
import { TripPositionIndicator } from '../label/trip-position-indicator';
import { TripBasicInfo } from '../trip/trip-basic-info';
import { findTripStopRow } from '../trip/trip-stop-row-dom';
import { computeScrolledStopIndex, getSelectedRowScrollTop } from '../trip/trip-stop-scroll';
import { TripStops } from '../trip/trip-stops';
import { TripPager } from '../trip/trip-pager';
import { VerboseTripLocator } from '../verbose/verbose-trip-locator';
import { VerboseTripStopTime } from '../verbose/verbose-trip-stop-time';

interface TripInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: SelectedTripSnapshot | null;
  tripInspectionTargets: TripInspectionTarget[];
  currentTripInspectionTargetIndex: number;
  now: Date;
  infoLevel: InfoLevel;
  dataLangs: readonly string[];
  onOpenPreviousTrip: () => void;
  onOpenNextTrip: () => void;
}

interface TripInspectionSummaryProps {
  snapshot: SelectedTripSnapshot;
  focusedStopIndex: number;
  numberOfStops: number;
  routeColors: AdjustedRouteColors<string>;
  infoLevel: InfoLevel;
  dataLangs: readonly string[];
}

interface TripInspectionCurrentStopProps {
  snapshot: SelectedTripSnapshot;
}

interface StopSummaryProps {
  stopNames: ReturnType<typeof getStopDisplayNames> | null;
  stopName: string;
  infoLevel: InfoLevel;
  /** Pre-formatted departure time for this stop (e.g. "16:10"). */
  departureTime?: string;
  /** Pre-formatted arrival time for this stop (e.g. "16:35"). */
  arrivalTime?: string;
  /** Render the departure time row when {@link departureTime} is provided. */
  showDepartureTime?: boolean;
  /** Render the arrival time row when {@link arrivalTime} is provided. */
  showArrivalTime?: boolean;
}

interface RichStopSummaryProps {
  stop: TripStopTime | undefined;
  infoLevel: InfoLevel;
  dataLangs: readonly string[];
  /**
   * Invoked when the summary is activated. When omitted, renders as a
   * non-interactive container. The handler should scroll the trip stops
   * list to the corresponding row.
   */
  onSelect?: () => void;
}

interface TripEndpointsSummaryProps {
  firstStopNames: ReturnType<typeof getStopDisplayNames> | null;
  firstStopName: string;
  firstStopDepartureTime: string | undefined;
  lastStopNames: ReturnType<typeof getStopDisplayNames> | null;
  lastStopName: string;
  lastStopArrivalTime: string | undefined;
  infoLevel: InfoLevel;
  /**
   * Invoked when the first-stop summary cell is activated. Disabled when omitted.
   * The handler should scroll the trip stops list to the corresponding row.
   */
  onSelectFirst?: () => void;
  /**
   * Invoked when the last-stop summary cell is activated. Disabled when omitted.
   * The handler should scroll the trip stops list to the corresponding row.
   */
  onSelectLast?: () => void;
}

function resolveTripStopDisplay(
  stop: TripStopTime | undefined,
  dataLangs: readonly string[],
  unknownStopFallback: string,
) {
  const stopId = stop?.stopMeta?.stop.stop_id;
  const stopAgencyLangs = stop?.stopMeta
    ? resolveAgencyLang(stop.stopMeta.agencies, stop.stopMeta.stop.agency_id)
    : DEFAULT_AGENCY_LANG;
  const stopNames = stop?.stopMeta
    ? getStopDisplayNames(stop.stopMeta.stop, dataLangs, stopAgencyLangs)
    : null;

  // Display fallback chain: localized name → stop_id → translated
  // "unknown stop" placeholder. The translated placeholder is sourced
  // from the caller because this helper runs outside React's hook
  // context.
  return {
    stopNames,
    stopName: stopNames?.name || stopId || unknownStopFallback,
  };
}

function SimpleStopSummary({
  stopNames,
  stopName,
  infoLevel,
  departureTime,
  arrivalTime,
  showDepartureTime = false,
  showArrivalTime = false,
}: StopSummaryProps) {
  const infoLevelFlag = useInfoLevel(infoLevel);
  return (
    <div className="min-w-0 rounded-md border p-2">
      {infoLevelFlag.isNormalEnabled && stopNames && stopNames.subNames.length > 0 && (
        <div className="text-muted-foreground truncate text-center text-xs">
          {stopNames.subNames.join(' / ')}
        </div>
      )}
      <div className="truncate text-center text-sm font-medium">{stopName}</div>
      {showArrivalTime && arrivalTime != null && (
        <div className="text-muted-foreground truncate text-center text-xs tabular-nums">
          {arrivalTime}
        </div>
      )}
      {showDepartureTime && departureTime != null && (
        <div className="text-muted-foreground truncate text-center text-xs tabular-nums">
          {departureTime}
        </div>
      )}
    </div>
  );
}

function TripEndpointsSummary({
  firstStopNames,
  firstStopName,
  firstStopDepartureTime,
  lastStopNames,
  lastStopName,
  lastStopArrivalTime,
  infoLevel,
  onSelectFirst,
  onSelectLast,
}: TripEndpointsSummaryProps) {
  // Override Button's inherent fixed height / horizontal padding so the
  // wrapped SimpleStopSummary controls sizing, while keeping the design
  // system's focus ring, hover accent, and disabled handling. `min-w-0`
  // lets the button shrink below its intrinsic content width so the inner
  // truncate utility can ellipsize long stop names.
  const buttonClassName = 'block h-auto w-full min-w-0 cursor-pointer p-0';
  return (
    // `minmax(0,1fr)` (instead of plain `1fr`) lets the side tracks shrink
    // below their content's min-content width, which is required for the
    // truncate utility inside the buttons to ellipsize long stop names.
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 select-none">
      {/* First Stop Button */}
      <Button
        variant="ghost"
        onClick={onSelectFirst}
        disabled={!onSelectFirst}
        className={buttonClassName}
      >
        <SimpleStopSummary
          stopNames={firstStopNames}
          stopName={firstStopName}
          infoLevel={infoLevel}
          departureTime={firstStopDepartureTime}
          showDepartureTime
        />
      </Button>
      {/* Divider */}
      <div className="flex items-center justify-center">
        <span
          aria-hidden="true"
          className="border-l-muted-foreground h-0 w-0 border-y-[6px] border-l-10 border-y-transparent"
        />
      </div>
      {/* Last Stop Button */}
      <Button
        variant="ghost"
        onClick={onSelectLast}
        disabled={!onSelectLast}
        className={buttonClassName}
      >
        <SimpleStopSummary
          stopNames={lastStopNames}
          stopName={lastStopName}
          infoLevel={infoLevel}
          arrivalTime={lastStopArrivalTime}
          showArrivalTime
        />
      </Button>
    </div>
  );
}

function RichStopSummary({ stop, infoLevel, dataLangs, onSelect }: RichStopSummaryProps) {
  if (stop?.stopMeta === undefined) {
    return null;
  }
  // Override Button's inherent fixed height / horizontal padding so the
  // wrapped content controls sizing, while keeping the design system's
  // focus ring, hover accent, and disabled handling. `min-w-0` lets the
  // button shrink below its intrinsic content width.
  return (
    <Button
      variant="ghost"
      onClick={onSelect}
      disabled={!onSelect}
      className="block h-auto w-full min-w-0 cursor-pointer rounded-md p-0"
    >
      <div className="min-w-0 rounded-md px-2">
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
    </Button>
  );
}

const TripInspectionSummary = memo(function TripInspectionSummary({
  snapshot,
  focusedStopIndex,
  numberOfStops,
  routeColors,
  infoLevel,
  dataLangs: _dataLangs,
}: TripInspectionSummaryProps) {
  const infoLevelFlag = useInfoLevel(infoLevel);

  const adjustedColorAssessment = useThemeContrastAssessment(
    routeColors.color,
    LOW_CONTRAST_TEXT_MIN_RATIO,
  );
  const { subtleAlphaSuffix, emphasisAlphaSuffix } = getContrastAwareAlphaSuffixes(
    adjustedColorAssessment.ratio,
  );
  const emphasisAccentColor = `${routeColors.color}${emphasisAlphaSuffix}`;
  const subtleAccentColor = `${routeColors.color}${subtleAlphaSuffix}`;

  const { totalMinutes, remainingMinutes } = useMemo(
    () =>
      deriveJourneyTimeFromTrip(
        snapshot.stopTimes.map((s) => s.timetableEntry),
        focusedStopIndex,
      ),
    [snapshot.stopTimes, focusedStopIndex],
  );

  return (
    <section className="flex flex-col gap-2 pt-0 text-left">
      {/* TripPositionIndicator */}
      <TripPositionIndicator
        stopIndex={focusedStopIndex}
        totalStops={numberOfStops}
        size="md"
        showEmoji={false}
        showTrack={infoLevelFlag.isNormalEnabled}
        trackColor={subtleAccentColor}
        dotColor={emphasisAccentColor}
        currentColor={routeColors.color}
        trackBorderColor={routeColors.color}
        showTrackBorder={false}
        showPositionLabel={infoLevelFlag.isNormalEnabled}
        labelTextColor={routeColors.textColor}
        labelBgColor={routeColors.color}
      />

      {/* JourneyTimeBar */}
      <JourneyTimeBar
        remainingMinutes={remainingMinutes}
        totalMinutes={totalMinutes}
        size="xl"
        showEmoji={false}
        fillColor={routeColors.color}
        unfilledColor={emphasisAccentColor}
        showRMins={infoLevelFlag.isNormalEnabled}
        showTMins={infoLevelFlag.isNormalEnabled}
        minsPosition="right"
        fillDirection="rtl"
        borderColor={routeColors.color}
        minsTextColor={routeColors.textColor}
        minsBgColor={routeColors.color}
        showBorder={false}
      />
    </section>
  );
});

function TripInspectionCurrentStop({ snapshot }: TripInspectionCurrentStopProps) {
  const selectedStop: TripStopTime = snapshot.selectedStop;
  const selectedStopId = selectedStop.stopMeta?.stop.stop_id || '(unknown-stop)';
  const selectedStopName = selectedStop.stopMeta?.stop.stop_name || selectedStopId;
  const selectedPatternPosition = selectedStop.timetableEntry.patternPosition;

  return (
    <section className="flex items-center gap-3 overflow-x-auto text-xs whitespace-nowrap">
      <div className="shrink-0 font-medium">
        <IdBadge>{selectedStopId}</IdBadge>
        {selectedStopName}
      </div>
      <div className="text-muted-foreground shrink-0">
        Pattern stop {selectedPatternPosition.stopIndex + 1} / {selectedPatternPosition.totalStops}
      </div>
      <div className="text-muted-foreground shrink-0">
        Reconstructed row {snapshot.currentStopIndex + 1} / {snapshot.stopTimes.length}
      </div>
    </section>
  );
}

function TripInspectionRowsSummary({
  snapshot,
  defaultOpen = false,
}: TripInspectionCurrentStopProps & { defaultOpen?: boolean }) {
  const totalStops = snapshot.selectedStop.timetableEntry.patternPosition.totalStops;
  const selectedStopIndex = snapshot.selectedStop.timetableEntry.patternPosition.stopIndex;
  const stopByIndex = new Map(
    snapshot.stopTimes.map((stop) => [stop.timetableEntry.patternPosition.stopIndex, stop]),
  );
  const { lines, missingPatternStops } = Array.from({ length: totalStops }).reduce<{
    lines: string[];
    missingPatternStops: number[];
  }>(
    (acc, _, index) => {
      const stop = stopByIndex.get(index);
      const selectedLabel = index === selectedStopIndex ? ' selected' : '';

      if (!stop) {
        acc.lines.push(`p${index + 1}/${totalStops}${selectedLabel} missing`);
        acc.missingPatternStops.push(index + 1);
        return acc;
      }

      const rowNumber = acc.lines.length - acc.missingPatternStops.length + 1;
      acc.lines.push(
        [
          `r${rowNumber}`,
          `p${index + 1}/${totalStops}${selectedLabel}`,
          `stop=${stop.stopMeta?.stop.stop_id ?? '(unknown-stop)'}`,
          `dep=${formatAbsoluteTime(minutesToDate(snapshot.serviceDate, stop.timetableEntry.schedule.departureMinutes))}`,
          `arr=${formatAbsoluteTime(minutesToDate(snapshot.serviceDate, stop.timetableEntry.schedule.arrivalMinutes))}`,
        ].join(' '),
      );
      return acc;
    },
    { lines: [], missingPatternStops: [] },
  );

  return (
    <details
      open={defaultOpen}
      className="mt-1 text-[9px] font-normal text-[#999] dark:text-gray-500"
    >
      <summary
        tabIndex={-1}
        className="cursor-pointer select-none"
        onClick={(e) => e.stopPropagation()}
      >
        [RowsSummary]
      </summary>
      <div className="mt-0.5 space-y-0.5">
        <div className="border-app-neutral overflow-x-auto rounded border border-dashed p-1.5 whitespace-nowrap">
          <p className="m-0">
            [rows] reconstructed={snapshot.stopTimes.length} expected={totalStops}{' '}
            missingPatternStops=
            {missingPatternStops.length > 0 ? `[${missingPatternStops.join(',')}]` : '[]'}
          </p>
          {lines.map((line: string, index: number) => (
            <div key={index} className="m-0">
              {line}
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

export function TripInspectionDialog({
  open,
  onOpenChange,
  snapshot,
  tripInspectionTargets,
  currentTripInspectionTargetIndex,
  infoLevel,
  dataLangs,
  now,
  onOpenPreviousTrip,
  onOpenNextTrip,
}: TripInspectionDialogProps) {
  const infoLevelFlag = useInfoLevel(infoLevel);
  const { t } = useTranslation();
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const [contentContainerEl, setContentContainerEl] = useState<HTMLDivElement | null>(null);
  const setContentContainerNode = useCallback((node: HTMLDivElement | null) => {
    contentContainerRef.current = node;
    setContentContainerEl(node);
  }, []);
  const selectedPatternStopIndex =
    snapshot?.selectedStop.timetableEntry.patternPosition.stopIndex ?? -1;

  // Route colors
  const dialogRouteColorInput = useMemo(
    () => snapshot?.route ?? { route_color: '', route_text_color: '' },
    [snapshot?.route],
  );
  const { routeColor } = resolveRouteColors(dialogRouteColorInput, 'css-hex');
  const dialogRouteColorAssessment = useThemeContrastAssessment(
    routeColor,
    LOW_CONTRAST_BADGE_MIN_RATIO,
  );
  const adjustedRouteColors = useMemo(
    () =>
      getContrastAdjustedRouteColors(
        dialogRouteColorInput,
        dialogRouteColorAssessment.isLowContrast,
        'css-hex',
      ),
    [dialogRouteColorInput, dialogRouteColorAssessment.isLowContrast],
  );

  const contentScroll = useScrollFades(
    contentContainerRef,
    snapshot
      ? `${snapshot.locator.patternId}:${snapshot.locator.serviceId}:${snapshot.locator.tripIndex}:${selectedPatternStopIndex}:${snapshot.stopTimes.length}`
      : 'empty',
  );
  const selectedStopRowKey = snapshot
    ? `${snapshot.locator.patternId}:${snapshot.locator.serviceId}:${snapshot.locator.tripIndex}:${selectedPatternStopIndex}:${snapshot.stopTimes.length}`
    : 'empty';
  const [renderedSnapshot, setRenderedSnapshot] = useState<SelectedTripSnapshot | null>(null);
  const [focusedStopIndex, setFocusedStopIndex] = useState<number>(selectedPatternStopIndex);
  // Reset the focused stop whenever the selected stop / snapshot identity
  // changes, by tracking the row key during render. This is the React-
  // recommended pattern for resetting state from props without an extra
  // effect-driven render pass.
  const [trackedSelectedStopRowKey, setTrackedSelectedStopRowKey] = useState(selectedStopRowKey);
  if (trackedSelectedStopRowKey !== selectedStopRowKey) {
    setTrackedSelectedStopRowKey(selectedStopRowKey);
    setFocusedStopIndex(selectedPatternStopIndex);
  }
  // Programmatic scroll triggered by snapshot/selected-stop change leaves the
  // body in a scrolling state where intermediate scrollTop values would map to
  // arbitrary stop indices. Suppress scroll-driven focus updates until the
  // smooth scroll has had time to settle.
  const programmaticScrollSettleRef = useRef<number>(0);

  useEffect(() => {
    if (!open || !snapshot) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setRenderedSnapshot(snapshot);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [open, snapshot]);

  const scrollToStopRow = useCallback((stopIndex: number, behavior: ScrollBehavior): boolean => {
    const container = contentContainerRef.current;
    const row = container ? findTripStopRow(container, stopIndex) : null;

    if (!container || !row) {
      return false;
    }

    const nextScrollTop = getSelectedRowScrollTop(container, row);

    if (container.scrollTop === nextScrollTop) {
      return false;
    }

    container.scrollTo({
      top: nextScrollTop,
      behavior,
    });

    return true;
  }, []);

  // Imperative scroll triggered by user actions (= origin/destination click).
  // Sets focus synchronously to the target so the journey-time / position
  // indicators reflect the click intent immediately. The suppress timer keeps
  // scroll-driven focus updates quiet while the smooth scroll is settling
  // (smooth-scroll typically completes before the timer expires, after which
  // no further scroll events fire — so we cannot rely on `handleBodyScroll`
  // to set focus for a click-driven jump).
  const handleSelectStopRow = useCallback(
    (stopIndex: number) => {
      programmaticScrollSettleRef.current = Date.now() + 800;
      setFocusedStopIndex(stopIndex);
      scrollToStopRow(stopIndex, 'smooth');
    },
    [scrollToStopRow],
  );

  useEffect(() => {
    if (!open || !snapshot || !contentContainerEl) {
      return;
    }

    // Cover the smooth-scroll animation plus the rAF correction passes; user
    // scroll events fired during this window must not redirect focus.
    programmaticScrollSettleRef.current = Date.now() + 800;

    let firstFrameId = 0;
    let secondFrameId = 0;
    let correctionFrameId = 0;

    const correctSelectedRowVisibility = (remainingPasses: number) => {
      if (remainingPasses <= 0) {
        return;
      }

      correctionFrameId = window.requestAnimationFrame(() => {
        const didScroll = scrollToStopRow(selectedPatternStopIndex, 'auto');

        if (didScroll) {
          correctSelectedRowVisibility(remainingPasses - 1);
        }
      });
    };

    firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        scrollToStopRow(selectedPatternStopIndex, 'smooth');
        correctSelectedRowVisibility(3);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrameId);
      window.cancelAnimationFrame(secondFrameId);
      window.cancelAnimationFrame(correctionFrameId);
    };
  }, [
    contentContainerEl,
    open,
    selectedPatternStopIndex,
    selectedStopRowKey,
    snapshot,
    scrollToStopRow,
  ]);

  const handleBodyScroll = useCallback(() => {
    contentScroll.handleScroll();

    if (Date.now() < programmaticScrollSettleRef.current) {
      return;
    }
    if (!snapshot || renderedSnapshot !== snapshot) {
      return;
    }
    const container = contentContainerRef.current;
    if (!container) {
      return;
    }
    const newIndex = computeScrolledStopIndex(container);
    if (newIndex === null) {
      return;
    }
    setFocusedStopIndex((prev) => (prev === newIndex ? prev : newIndex));
  }, [contentScroll, snapshot, renderedSnapshot]);

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

  const selectedStop = snapshot.selectedStop;
  const numberOfStops = selectedStop.timetableEntry.patternPosition.totalStops;

  // Pattern origin / terminal — sourced via patternPosition flags rather
  // than array-index access. The reconstructed `stopTimes` array is sparse
  // (rows for pattern positions the repository could not bind are dropped),
  // so `stopTimes[0]` and `stopTimes[length-1]` would silently misreport
  // origin / terminal whenever those positions are missing — e.g. yurikamome
  // short-turn trips that stop one station before the pattern's terminal.
  const unknownStopFallback = t('tripInspection.unknownStop');
  const firstStop = getOriginStop(tripStopTimes);
  const { stopName: firstStopName, stopNames: firstStopNames } = resolveTripStopDisplay(
    firstStop,
    dataLangs,
    unknownStopFallback,
  );
  const firstStopDepartureTime = firstStop
    ? formatAbsoluteTime(
        minutesToDate(snapshot.serviceDate, firstStop.timetableEntry.schedule.departureMinutes),
      )
    : undefined;

  const lastStop = getTerminalStop(tripStopTimes);
  const { stopName: lastStopName, stopNames: lastStopNames } = resolveTripStopDisplay(
    lastStop,
    dataLangs,
    unknownStopFallback,
  );
  const lastStopArrivalTime = lastStop
    ? formatAbsoluteTime(
        minutesToDate(snapshot.serviceDate, lastStop.timetableEntry.schedule.arrivalMinutes),
      )
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[80dvh] max-w-[90vw] flex-col gap-0 overflow-hidden border-4 p-2"
        style={{ borderColor: adjustedRouteColors.color }}
      >
        <DialogHeader
          className="z-10 -mb-px shrink-0 gap-0 border-b-2 pb-3 sm:text-center"
          style={{ borderBottomColor: 'var(--background)' }}
        >
          {/* {now.toLocaleDateString()} */}
          {/*
            DialogTitle intentionally summarizes the selected stop.
            The dialog content describes one concrete trip that passes
            through that stop, including trip identity and stop sequence.
          */}
          <DialogTitle className="flex flex-col items-center justify-center gap-2 text-base">
            <div className="px-2">
              {/* Selected stop (RichStopSummary) */}
              <RichStopSummary
                //
                stop={selectedStop}
                // infoLevel={infoLevel}
                infoLevel={'simple'}
                // infoLevel={'normal'}
                // infoLevel={'detailed'}
                dataLangs={dataLangs}
                onSelect={() => handleSelectStopRow(selectedPatternStopIndex)}
              />
            </div>
          </DialogTitle>

          <div className="px-2">
            {/*
            Trip identity stays below the title because the dialog is
            centered on the selected stop, while the body renders the
            matching trip that serves that stop.
          */}
            <TripPager
              selectedStop={selectedStop}
              serviceDate={snapshot.serviceDate}
              now={now}
              tripInspectionTargets={tripInspectionTargets}
              currentTripInspectionTargetIndex={currentTripInspectionTargetIndex}
              onOpenPreviousTrip={onOpenPreviousTrip}
              onOpenNextTrip={onOpenNextTrip}
            />
          </div>

          <div className="p-2">
            <TripBasicInfo
              route={route}
              routeAgency={routeAgency}
              routeAgencyLangs={routeAgencyLangs}
              infoLevel={infoLevel}
              dataLangs={dataLangs}
              headsignTitle={headsignTitle}
              titleWithNoHeadsign={t('tripInspection.titleWithNoHeadsign')}
              currentIndex={
                tripInspectionTargets.length > 0 ? currentTripInspectionTargetIndex + 1 : 0
              }
              totalCount={tripInspectionTargets.length}
            />
          </div>

          <DialogDescription asChild className="text-center sm:text-center">
            <div className="px-2">
              <TripEndpointsSummary
                firstStopNames={firstStopNames}
                firstStopName={firstStopName}
                firstStopDepartureTime={firstStopDepartureTime}
                lastStopNames={lastStopNames}
                lastStopName={lastStopName}
                lastStopArrivalTime={lastStopArrivalTime}
                infoLevel={infoLevel}
                onSelectFirst={
                  firstStop
                    ? () => handleSelectStopRow(firstStop.timetableEntry.patternPosition.stopIndex)
                    : undefined
                }
                onSelectLast={
                  lastStop
                    ? () => handleSelectStopRow(lastStop.timetableEntry.patternPosition.stopIndex)
                    : undefined
                }
              />
            </div>
          </DialogDescription>

          <div className="p-2">
            <TripInspectionSummary
              snapshot={snapshot}
              focusedStopIndex={focusedStopIndex}
              numberOfStops={numberOfStops}
              routeColors={adjustedRouteColors}
              infoLevel={infoLevel}
              dataLangs={dataLangs}
            />
          </div>

          {/* Verbose info for debug */}
          {infoLevelFlag.isVerboseEnabled && (
            <div className="max-h-[24dvh] overflow-y-auto pr-1">
              <>
                <details className="mt-1 text-[9px] font-normal text-[#999] dark:text-gray-500">
                  <summary
                    tabIndex={-1}
                    className="cursor-pointer select-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    [Verbose]
                  </summary>

                  <div className="mt-1 space-y-1">
                    {now.toISOString()}
                    <TripInspectionCurrentStop snapshot={snapshot} />
                    <VerboseTripLocator locator={snapshot.locator} defaultOpen={true} />
                    <VerboseTripStopTime
                      tripStopTime={snapshot.selectedStop}
                      serviceDate={snapshot.serviceDate}
                      dataLangs={dataLangs}
                      defaultOpen={true}
                    />
                    <TripInspectionRowsSummary snapshot={snapshot} defaultOpen={true} />
                  </div>
                </details>
              </>
            </div>
          )}
        </DialogHeader>

        <div
          ref={setContentContainerNode}
          onScroll={handleBodyScroll}
          className="relative min-h-0 flex-1 overflow-y-auto text-sm"
        >
          {contentScroll.showTop && (
            <ScrollFadeEdge position="top" className="via-background/90 -mb-5 h-5" />
          )}
          <div className="flex flex-col gap-4 pt-2 pb-2">
            <TripStops
              tripSnapshot={snapshot}
              renderedSnapshot={renderedSnapshot}
              selectedPatternStopIndex={selectedPatternStopIndex}
              routeColors={adjustedRouteColors}
              infoLevel={infoLevel}
              dataLangs={dataLangs}
              now={now}
            />
          </div>
          {contentScroll.showBottom && <ScrollFadeEdge position="bottom" />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
