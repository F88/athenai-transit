import { useTranslation } from 'react-i18next';
import { PillButton } from '../button/pill-button';

interface OriginFilterProps {
  origin: boolean;
  onToggleOrigin: () => void;
  /** Number of origin entries (= count to display on the pill). */
  count?: number;
}

/**
 * Render the origin (始発) filter toggle.
 *
 * Filters to entries where this stop is the trip's origin
 * (= `entry.patternPosition.isOrigin === true`). Includes non-boardable
 * origins (e.g. depot / yard departures with `pickup_type === 1`); the
 * grid distinguishes those visually with `乗×` / `降×` markers, so
 * hiding them at this layer would suppress legitimate GTFS data the
 * viewer is meant to surface.
 *
 * If the caller wants only "boardable origins", combine this with
 * {@link BoardabilityFilter} (= toggle both on); the result is the
 * intersection.
 *
 * @param props - Filter rendering inputs.
 * @returns The rendered filter toggle.
 */
export function OriginFilter({ origin, onToggleOrigin, count }: OriginFilterProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-1">
      <PillButton
        size="sm"
        active={origin}
        activeBg={'var(--info)'}
        activeBorder={'var(--info)'}
        inactiveBorder={'var(--info)'}
        onClick={onToggleOrigin}
        title={t('filter.originOnlyTitle')}
        count={count}
      >
        {t('filter.originOnly')}
      </PillButton>
    </div>
  );
}
