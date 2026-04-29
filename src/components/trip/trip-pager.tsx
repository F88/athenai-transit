import { Button } from '@/components/ui/button';
import { minutesToDate } from '@/domain/transit/calendar-utils';
import { formatAbsoluteTime } from '@/domain/transit/time';
import type { TripInspectionTarget, TripStopTime } from '@/types/app/transit-composed';
import { StopTimeTimeInfo } from '../stop-time-time-info';

interface TripPagerProps {
  selectedStop: TripStopTime;
  serviceDate: Date;
  now: Date;
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
  tripInspectionTargets,
  currentTripInspectionTargetIndex,
  onOpenPreviousTrip,
  onOpenNextTrip,
}: TripPagerProps) {
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
    <div className="flex items-center justify-center gap-2 pb-2 select-none">
      <Button
        className={!hasPreviousTrip ? 'pointer-events-none invisible' : undefined}
        size="sm"
        variant="outline"
        disabled={!hasPreviousTrip}
        onClick={onOpenPreviousTrip}
      >
        {previousDepartureTime ? `${previousDepartureTime}` : 'Prev'}
      </Button>
      <div className="flex min-w-16 flex-col items-center justify-center gap-1">
        <StopTimeTimeInfo
          arrivalMinutes={selectedStop.timetableEntry.schedule.arrivalMinutes}
          departureMinutes={selectedStop.timetableEntry.schedule.departureMinutes}
          serviceDate={serviceDate}
          now={now}
          size="sm"
          showArrivalTime={true}
          showDepartureTime={true}
          collapseArrivalWhenSameAsDeparture={true}
          forceShowRelativeTime={false}
          showVerbose={false}
        />
      </div>
      <Button
        className={!hasNextTrip ? 'pointer-events-none invisible' : undefined}
        size="sm"
        variant="outline"
        disabled={!hasNextTrip}
        onClick={onOpenNextTrip}
      >
        {nextDepartureTime ? `${nextDepartureTime}` : 'Next'}
      </Button>

      <span className="text-muted-foreground text-center text-xs">
        {tripInspectionTargets.length > 0
          ? `${currentTripInspectionTargetIndex + 1} / ${tripInspectionTargets.length}`
          : '0 / 0'}
      </span>
    </div>
  );
}
