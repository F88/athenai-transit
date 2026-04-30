import { Button } from '@/components/ui/button';
import { minutesToDate } from '@/domain/transit/calendar-utils';
import { deriveStopTimeRoleDisplayProps } from '@/domain/transit/stop-time-display';
import { formatAbsoluteTime } from '@/domain/transit/time';
import { cn } from '@/lib/utils';
import type { InfoLevel } from '@/types/app/settings';
import type { TripInspectionTarget, TripStopTime } from '@/types/app/transit-composed';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { StopTimeTimeInfo } from '../stop-time-time-info';

interface TripPagerProps {
  selectedStop: TripStopTime;
  serviceDate: Date;
  now: Date;
  /** Info verbosity level used to derive row visibility / collapse rules. */
  infoLevel: InfoLevel;
  tripInspectionTargets: TripInspectionTarget[];
  currentTripInspectionTargetIndex: number;
  onOpenPreviousTrip: () => void;
  onOpenNextTrip: () => void;
}

function formatTargetDepartureTime(target: TripInspectionTarget | undefined): string | null {
  if (!target) {
    return null;
  }

  return formatAbsoluteTime(minutesToDate(target.serviceDate, target.departureMinutes));
}

export function TripPager({
  selectedStop,
  serviceDate,
  now,
  infoLevel,
  tripInspectionTargets,
  currentTripInspectionTargetIndex,
  onOpenPreviousTrip,
  onOpenNextTrip,
}: TripPagerProps) {
  const { isOrigin, isTerminal } = selectedStop.timetableEntry.patternPosition;
  const display = deriveStopTimeRoleDisplayProps({ isOrigin, isTerminal, infoLevel });

  const hasPreviousTrip = currentTripInspectionTargetIndex > 0;
  const hasNextTrip = currentTripInspectionTargetIndex < tripInspectionTargets.length - 1;
  const previousTarget = hasPreviousTrip
    ? tripInspectionTargets[currentTripInspectionTargetIndex - 1]
    : undefined;
  const nextTarget = hasNextTrip
    ? tripInspectionTargets[currentTripInspectionTargetIndex + 1]
    : undefined;
  const previousDepartureTime = formatTargetDepartureTime(previousTarget);
  const nextDepartureTime = formatTargetDepartureTime(nextTarget);

  return (
    <div className="flex items-center justify-center gap-2 select-none">
      {/* Previous Trip Button */}
      <Button
        className={cn('cursor-pointer', !hasPreviousTrip && 'pointer-events-none invisible')}
        size="sm"
        variant="outline"
        disabled={!hasPreviousTrip}
        onClick={onOpenPreviousTrip}
      >
        <ChevronLeftIcon className="size-3" />
        {previousDepartureTime ? `${previousDepartureTime}` : ''}
      </Button>
      {/* Current Trip Info */}
      <div className="flex min-w-16 flex-col items-center justify-center gap-1">
        <StopTimeTimeInfo
          arrivalMinutes={selectedStop.timetableEntry.schedule.arrivalMinutes}
          departureMinutes={selectedStop.timetableEntry.schedule.departureMinutes}
          serviceDate={serviceDate}
          now={now}
          size="sm"
          align="center"
          showArrivalTime={display.showArrivalTime}
          showDepartureTime={display.showDepartureTime}
          collapseToleranceMinutes={display.collapseToleranceMinutes}
          forceShowRelativeTime={false}
        />
      </div>
      {/* Next Trip Button */}
      <Button
        className={cn('cursor-pointer', !hasNextTrip && 'pointer-events-none invisible')}
        size="sm"
        variant="outline"
        disabled={!hasNextTrip}
        onClick={onOpenNextTrip}
      >
        {nextDepartureTime ? `${nextDepartureTime}` : ''}
        <ChevronRightIcon className="size-3" />
      </Button>
    </div>
  );
}
