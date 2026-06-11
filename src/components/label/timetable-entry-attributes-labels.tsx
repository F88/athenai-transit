import type { TimetableEntryAttributes } from '../../types/app/transit';
import { useTranslation } from 'react-i18next';
import { BaseLabel, type BaseLabelSize } from './base-label';

interface TimetableEntryAttributesLabelsProps {
  attributes: TimetableEntryAttributes;
  size?: BaseLabelSize;
  showDisplayLastStop: boolean;
  showDisplayFirstStop: boolean;
  showDisplayPickupUnavailable: boolean;
  showDisplayDropOffUnavailable: boolean;
}

/**
 * Compact labels for the four {@link TimetableEntryAttributes} flags
 * (last stop, first stop, pickup unavailable, drop-off unavailable).
 *
 * Scope is deliberately limited to those four attributes — anything
 * beyond them (headsign, route info, etc.) belongs in other components.
 *
 * Display vocabulary gap (deliberate): the facts are "first/last stop
 * of this pattern", but the user-facing words below still say origin /
 * terminal ("timetable.entry.origin" / "timetable.entry.terminal").
 * For through-services the words over-claim (a trip continuing beyond
 * the feed boundary is labeled as if it ends here). The wording stays
 * until a true service terminus can be told apart from a feed boundary
 * -- tracked in Issue #145.
 */
export function TimetableEntryAttributesLabels({
  attributes,
  size = 'xs',
  showDisplayLastStop,
  showDisplayFirstStop,
  showDisplayPickupUnavailable,
  showDisplayDropOffUnavailable,
}: TimetableEntryAttributesLabelsProps) {
  const { t } = useTranslation();

  const showLastStop = showDisplayLastStop && attributes.isLastStop;
  const showFirstStop = showDisplayFirstStop && attributes.isFirstStop;
  const showPickupUnavailable = showDisplayPickupUnavailable && attributes.isPickupUnavailable;
  const showDropOffUnavailable = showDisplayDropOffUnavailable && attributes.isDropOffUnavailable;

  if (!showLastStop && !showFirstStop && !showPickupUnavailable && !showDropOffUnavailable) {
    return null;
  }

  return (
    <span className="inline-flex items-baseline gap-0.5">
      {showFirstStop && (
        <BaseLabel
          size={size}
          value={t('timetable.entry.origin')}
          className="border-foreground/30 border bg-blue-500 text-white"
        />
      )}
      {showLastStop && (
        <BaseLabel
          size={size}
          value={t('timetable.entry.terminal')}
          className="border-foreground/30 border bg-gray-500 text-white"
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
