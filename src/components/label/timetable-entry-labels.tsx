import type { TimetableEntry } from '../../types/app/transit-composed';
import { useTranslation } from 'react-i18next';
import { BaseLabel, type BaseLabelSize } from './base-label';

interface TimetableEntryLabelsProps {
  entry: TimetableEntry;
  size?: BaseLabelSize;
  isDisplayTerminal: boolean;
  isDisplayOrigin: boolean;
  isDisplayPickupUnavailable: boolean;
  isDisplayDropOffUnavailable: boolean;
}

/** Compact labels for terminal, origin, and boarding availability. */
export function TimetableEntryLabels({
  entry,
  size = 'xs',
  isDisplayTerminal,
  isDisplayOrigin,
  isDisplayPickupUnavailable,
  isDisplayDropOffUnavailable,
}: TimetableEntryLabelsProps) {
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
        <BaseLabel
          size={size}
          value={t('timetable.entry.terminal')}
          className="bg-gray-500 text-white"
        />
      )}
      {showOrigin && (
        <BaseLabel
          size={size}
          value={t('timetable.entry.origin')}
          className="bg-blue-500 text-white"
        />
      )}
      {showPickupUnavailable && (
        <BaseLabel
          size={size}
          value={t('timetable.entry.noPickup')}
          className="bg-red-500 text-white"
        />
      )}
      {showDropOffUnavailable && (
        <BaseLabel
          size={size}
          value={t('timetable.entry.noDropOff')}
          className="bg-red-500 text-white"
        />
      )}
    </span>
  );
}
