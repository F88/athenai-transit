import { forwardRef, useCallback, useEffect, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';

import { getServiceDay } from '@/domain/transit/service-day';
import { getTripInspectionOpenOutcomeMessage } from '@/domain/transit/trip-inspection-message';
import { useTripInspection } from '@/hooks/use-trip-inspection';
import { showOpenOutcomeToast } from '@/lib/open-outcome-toast';
import type { TransitRepository } from '@/repositories/transit-repository';
import type { InfoLevel } from '@/types/app/settings';
import type { TripInspectionTarget } from '@/types/app/transit-composed';

import { TripInspectionDialog } from '@/components/dialog/trip-inspection-dialog';

export interface TripInspectionContainerHandle {
  /**
   * Open trip inspection for the given stop. A stop is served by multiple
   * trips; which one is shown is decided from `referenceDateTime` -- the trip
   * nearest that reference time is selected.
   *
   * This is an explicit argument (not the `relativeTimeNow` display prop), so
   * a caller can open at an arbitrary reference time without changing what the
   * dialog currently shows.
   */
  openByStopId: (params: { stopId: string; referenceDateTime: Date }) => void;
  /** Open trip inspection for one concrete trip target. */
  openByTarget: (target: TripInspectionTarget) => void;
}

interface TripInspectionContainerProps {
  repo: TransitRepository;
  /**
   * The "now" for the dialog's relative times ("in N min"), forwarded as
   * `now`. Usually the real clock, but the user can pin it (time picker /
   * `?time=`); when pinned the countdown stops.
   */
  relativeTimeNow: Date;
  infoLevel: InfoLevel;
  dataLangs: readonly string[];
  /**
   * Select + pan + record-history for a stop chosen inside the dialog. This
   * is an `App`-level navigation concern, not trip-inspection state, so it
   * stays owned by `App` and is forwarded straight to the dialog.
   */
  onSelectStopById: (stopId: string) => void;
  /**
   * Called when the dialog opens or closes. Lets the parent track dialog
   * visibility (e.g. to suppress global keyboard shortcuts) without holding
   * the underlying trip-inspection state.
   */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Owns the `useTripInspection` state so that navigation inside the dialog
 * (prev / next trip, in-dialog trip re-selection, close) does not re-render
 * the rest of the app -- in particular the always-mounted `MapView` and the
 * nearby-stop browsing surface, which would otherwise re-render on every
 * pager step because they are not memoized.
 *
 * External launch paths (BottomSheet, StopSearchDialog, TimetableContainer)
 * still need to open the dialog, so `openByStopId` / `openByTarget` are
 * exposed via ref through `useImperativeHandle`, mirroring
 * `TimetableContainer`.
 */
export const TripInspectionContainer = forwardRef<
  TripInspectionContainerHandle,
  TripInspectionContainerProps
>(function TripInspectionContainer(
  { repo, relativeTimeNow, infoLevel, dataLangs, onSelectStopById, onOpenChange },
  ref,
) {
  const { t } = useTranslation();
  const {
    tripInspectionSnapshot,
    tripInspectionTargets,
    currentTripInspectionTargetIndex,
    showNoticeNonce,
    openTripInspectionFromTarget,
    openTripInspectionFromStopId,
    openPreviousTripInspection,
    openNextTripInspection,
    closeTripInspection,
  } = useTripInspection(repo);

  const isOpen = tripInspectionSnapshot !== null;
  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  const openByStopId = useCallback(
    ({ stopId, referenceDateTime }: { stopId: string; referenceDateTime: Date }) => {
      const serviceDate = getServiceDay(referenceDateTime);
      void openTripInspectionFromStopId({ stopId, now: referenceDateTime, serviceDate }).then(
        (status) => {
          showOpenOutcomeToast(getTripInspectionOpenOutcomeMessage(status), t);
        },
      );
    },
    [openTripInspectionFromStopId, t],
  );

  const openByTarget = useCallback(
    (target: TripInspectionTarget) => {
      void openTripInspectionFromTarget(target, 'direct-open').then((status) => {
        showOpenOutcomeToast(getTripInspectionOpenOutcomeMessage(status), t);
      });
    },
    [openTripInspectionFromTarget, t],
  );

  useImperativeHandle(ref, () => ({ openByStopId, openByTarget }), [openByStopId, openByTarget]);

  // In-dialog re-selection: open a specific trip chosen from the current
  // trip's stop-time list. Uses the `'trip-stops-time-select'` source so the
  // hook bumps `showNoticeNonce` and the dialog surfaces its one-shot notice.
  const handleInspectTripFromDialog = useCallback(
    (target: TripInspectionTarget) => {
      void openTripInspectionFromTarget(target, 'trip-stops-time-select').then((status) => {
        showOpenOutcomeToast(getTripInspectionOpenOutcomeMessage(status), t);
      });
    },
    [openTripInspectionFromTarget, t],
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        closeTripInspection();
      }
    },
    [closeTripInspection],
  );

  return (
    <TripInspectionDialog
      open={isOpen}
      snapshot={tripInspectionSnapshot}
      tripInspectionTargets={tripInspectionTargets}
      currentTripInspectionTargetIndex={currentTripInspectionTargetIndex}
      showNoticeNonce={showNoticeNonce}
      now={relativeTimeNow}
      infoLevel={infoLevel}
      dataLangs={dataLangs}
      onOpenPreviousTrip={openPreviousTripInspection}
      onOpenNextTrip={openNextTripInspection}
      onInspectTrip={handleInspectTripFromDialog}
      onSelectStopById={onSelectStopById}
      onOpenChange={handleOpenChange}
    />
  );
});
