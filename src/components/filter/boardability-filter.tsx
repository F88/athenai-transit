import { useTranslation } from 'react-i18next';
import { PillButton } from '../button/pill-button';

interface BoardabilityFilterProps {
  boardable: boolean;
  onToggleBoardable: () => void;
  /** Number of boardable entries (= count to display on the pill). */
  count?: number;
}

/**
 * Render the stop-level boardability filter toggle.
 *
 * Currently filters by stop-level boardability (= GTFS `pickup_type`).
 * Segment-level boardability signals (`continuous_pickup` /
 * `continuous_drop_off`) are out of scope for this filter; if added in
 * the future, expose them as a separate filter component to keep
 * dimensions distinct.
 *
 * The `count` is owned by the caller so the same predicate is not
 * computed twice (= once for filter, once for count). Caller decides
 * which scope the count reflects (= total at stop, post-other-filters,
 * etc.).
 *
 * @param props - Filter rendering inputs.
 * @returns The rendered filter toggle.
 */
export function BoardabilityFilter({
  boardable,
  onToggleBoardable,
  count,
}: BoardabilityFilterProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-1">
      <PillButton
        size="sm"
        active={boardable}
        activeBg={'var(--info)'}
        activeBorder={'var(--info)'}
        inactiveBorder={'var(--info)'}
        onClick={onToggleBoardable}
        title={t('filter.boardableOnlyTitle')}
        count={count}
      >
        {t('filter.boardableOnly')}
      </PillButton>
    </div>
  );
}
