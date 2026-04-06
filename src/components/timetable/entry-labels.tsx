import type { TimetableEntry } from '../../types/app/transit-composed';
import { useTranslation } from 'react-i18next';

interface EntryLabelsProps {
  entry: TimetableEntry;
  isDisplayTerminal: boolean;
  isDisplayOrigin: boolean;
  isDisplayPickupUnavailable: boolean;
  isDisplayDropOffUnavailable: boolean;
}

/** Compact labels for terminal, origin, and boarding availability. */
export function EntryLabels({
  entry,
  isDisplayTerminal,
  isDisplayOrigin,
  isDisplayPickupUnavailable,
  isDisplayDropOffUnavailable,
}: EntryLabelsProps) {
  const { t } = useTranslation();
  const { boarding, patternPosition } = entry;

  const showTerminal = isDisplayTerminal && patternPosition.isTerminal;
  const showOrigin = isDisplayOrigin && patternPosition.isOrigin;
  const showPickupUnavailable = isDisplayPickupUnavailable && boarding.pickupType === 1;
  const showDropOffUnavailable = isDisplayDropOffUnavailable && boarding.dropOffType === 1;

  if (!showTerminal && !showOrigin && !showPickupUnavailable && !showDropOffUnavailable) {
    return null;
  }

  return (
    <span className="inline-flex items-baseline gap-0.5">
      {showTerminal && (
        <span className="rounded bg-gray-500 px-0.5 text-[9px] leading-tight text-white">
          {t('timetable.entry.terminal')}
        </span>
      )}
      {showOrigin && (
        <span className="rounded bg-blue-500 px-0.5 text-[9px] leading-tight text-white">
          {t('timetable.entry.origin')}
        </span>
      )}
      {showPickupUnavailable && (
        <span className="rounded bg-red-500 px-0.5 text-[9px] leading-tight text-white">
          {t('timetable.entry.noPickup')}
        </span>
      )}
      {showDropOffUnavailable && (
        <span className="rounded bg-red-500 px-0.5 text-[9px] leading-tight text-white">
          {t('timetable.entry.noDropOff')}
        </span>
      )}
    </span>
  );
}
