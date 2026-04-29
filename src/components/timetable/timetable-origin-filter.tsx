import { useTranslation } from 'react-i18next';
import { PillButton } from '../button/pill-button';

interface TimetableOriginFilterProps {
  origin: boolean;
  onToggleOrigin: () => void;
  /** Number of origin entries (= count to display on the pill). */
  count?: number;
}

/**
 * Render the origin (始発) filter toggle for a timetable view.
 *
 * Filters to entries where this stop is the trip's origin
 * (= `entry.patternPosition.isOrigin === true`). Includes non-boardable
 * origins (e.g. depot / yard departures with `pickup_type === 1`); the
 * grid distinguishes those visually with `乗×` / `降×` markers, so
 * hiding them at this layer would suppress legitimate GTFS data the
 * viewer is meant to surface.
 *
 * If the caller wants only "boardable origins", combine this with
 * `TimetableBoardabilityFilter` (= toggle both on); the result is the
 * intersection.
 *
 * @param props - Filter rendering inputs.
 * @returns The rendered filter toggle.
 */
export function TimetableOriginFilter({
  origin,
  onToggleOrigin,
  count,
}: TimetableOriginFilterProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-1">
      <PillButton
        size="sm"
        active={origin}
        activeBg={'#1565c0'}
        activeBorder={'#1565c0'}
        inactiveBorder={'#1565c0'}
        onClick={onToggleOrigin}
        title={t('timetable.filter.originOnlyTitle')}
        count={count}
      >
        {t('timetable.filter.originOnly')}
      </PillButton>
    </div>
  );
}
