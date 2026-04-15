import type { TimetableEntryAttributes } from '../../types/app/transit';
import { useTranslation } from 'react-i18next';
import { BaseLabel, type BaseLabelSize } from './base-label';

interface TimetableEntryAttributesLabelsProps {
  attributes: TimetableEntryAttributes;
  size?: BaseLabelSize;
  isDisplayTerminal: boolean;
  isDisplayOrigin: boolean;
  isDisplayPickupUnavailable: boolean;
  isDisplayDropOffUnavailable: boolean;
}

/**
 * Compact labels for the four {@link TimetableEntryAttributes} flags
 * (terminal, origin, pickup unavailable, drop-off unavailable).
 *
 * Scope is deliberately limited to those four attributes — anything
 * beyond them (headsign, route info, etc.) belongs in other components.
 */
export function TimetableEntryAttributesLabels({
  attributes,
  size = 'xs',
  isDisplayTerminal,
  isDisplayOrigin,
  isDisplayPickupUnavailable,
  isDisplayDropOffUnavailable,
}: TimetableEntryAttributesLabelsProps) {
  const { t } = useTranslation();

  const showTerminal = isDisplayTerminal && attributes.isTerminal;
  const showOrigin = isDisplayOrigin && attributes.isOrigin;
  const showPickupUnavailable = isDisplayPickupUnavailable && attributes.isPickupUnavailable;
  const showDropOffUnavailable = isDisplayDropOffUnavailable && attributes.isDropOffUnavailable;

  if (!showTerminal && !showOrigin && !showPickupUnavailable && !showDropOffUnavailable) {
    return null;
  }

  return (
    <span className="inline-flex items-baseline gap-0.5">
      {showOrigin && (
        <BaseLabel
          size={size}
          value={t('timetable.entry.origin')}
          className="bg-blue-500 text-white"
        />
      )}
      {showTerminal && (
        <BaseLabel
          size={size}
          value={t('timetable.entry.terminal')}
          className="bg-gray-500 text-white"
        />
      )}
      {showPickupUnavailable && (
        <BaseLabel
          size={size}
          value={t('timetable.entry.noPickup')}
          className="border border-yellow-600 bg-yellow-100 text-yellow-900 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-200"
        />
      )}
      {showDropOffUnavailable && (
        <BaseLabel
          size={size}
          value={t('timetable.entry.noDropOff')}
          className="border border-dashed border-yellow-600 bg-yellow-100 text-yellow-900 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-200"
        />
      )}
    </span>
  );
}
