import { Button } from '@/components/ui/button';
import { minutesToDate } from '@/domain/transit/calendar-utils';
import { formatAbsoluteTime } from '@/domain/transit/time';
import { cn } from '@/lib/utils';
import type { TripInspectionTarget, TripStopTime } from '@/types/app/transit-composed';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { LabelCountBadge } from '../badge/label-count-badge';
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
  const displayedTripIndex =
    tripInspectionTargets.length > 0 ? currentTripInspectionTargetIndex + 1 : 0;
  const totalTripCount = tripInspectionTargets.length;
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
      <LabelCountBadge
        label={`${displayedTripIndex}`}
        count={totalTripCount}
        size="md"
        labelClassName="bg-info text-info-foreground"
        countClassName="bg-background text-info"
        frameClassName="border-info"
      />
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
          showArrivalTime={true}
          showDepartureTime={true}
          collapseArrivalWhenSameAsDeparture={true}
          forceShowRelativeTime={false}
          showVerbose={false}
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
