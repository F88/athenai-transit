import { forwardRef, useCallback, useEffect, useImperativeHandle } from 'react';

import { useTimetable, type UseTimetableReturn } from '@/hooks/use-timetable';
import type { TransitRepository } from '@/repositories/transit-repository';
import type { GlobalFilter } from '@/types/app/global-filter';
import type { InfoLevel } from '@/types/app/settings';
import type { TripInspectionTarget } from '@/types/app/transit-composed';

import { TimetableDialog } from '../dialog/timetable-dialog';

export interface TimetableContainerHandle {
  openStopTimetable: UseTimetableReturn['openStopTimetable'];
  openRouteHeadsignTimetable: UseTimetableReturn['openRouteHeadsignTimetable'];
}

interface TimetableContainerProps {
  repo: TransitRepository;
  infoLevel: InfoLevel;
  dataLangs: readonly string[];
  globalFilter: GlobalFilter;
  onInspectTrip?: (target: TripInspectionTarget) => void;
  /**
   * Called when the dialog opens or closes. Lets the parent track
   * dialog visibility (e.g. to suppress global keyboard shortcuts)
   * without holding the underlying `timetableData` state.
   */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Owns the `useTimetable` state so that updates triggered from the dialog
 * (changeDateTime / closeTimetable) do not re-render the rest of the app.
 *
 * External callers (map markers, BottomSheet, StopSearchDialog) still need
 * to open the dialog, so `openStopTimetable` / `openRouteHeadsignTimetable`
 * are exposed via ref through `useImperativeHandle`.
 */
export const TimetableContainer = forwardRef<TimetableContainerHandle, TimetableContainerProps>(
  function TimetableContainer(
    { repo, infoLevel, dataLangs, globalFilter, onInspectTrip, onOpenChange },
    ref,
  ) {
    const {
      timetableData,
      openStopTimetable,
      openRouteHeadsignTimetable,
      changeDateTime,
      closeTimetable,
    } = useTimetable(repo);

    const isOpen = timetableData !== null;
    useEffect(() => {
      onOpenChange?.(isOpen);
    }, [isOpen, onOpenChange]);

    useImperativeHandle(ref, () => ({ openStopTimetable, openRouteHeadsignTimetable }), [
      openStopTimetable,
      openRouteHeadsignTimetable,
    ]);

    const handleChangeDateTime = useCallback(
      (next: Date) => {
        void changeDateTime(next);
      },
      [changeDateTime],
    );

    return (
      <TimetableDialog
        key={timetableData?.stop.stop_id ?? 'closed'}
        data={timetableData}
        infoLevel={infoLevel}
        dataLangs={dataLangs}
        globalFilter={globalFilter}
        onInspectTrip={onInspectTrip}
        onChangeDateTime={handleChangeDateTime}
        onClose={closeTimetable}
      />
    );
  },
);
