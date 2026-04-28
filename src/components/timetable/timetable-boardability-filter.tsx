import { useTranslation } from 'react-i18next';
import { PillButton } from '../button/pill-button';

interface TimetableBoardabilityFilterProps {
  boardable: boolean;
  onToggleBoardable: () => void;
}

/**
 * Render the stop-level boardability filter toggle for a timetable view.
 *
 * Currently filters by stop-level boardability (= GTFS `pickup_type` and
 * pattern-inferred `isTerminal`). Segment-level boardability signals
 * (`continuous_pickup` / `continuous_drop_off`) are out of scope for
 * this filter; if added in the future, expose them as a separate filter
 * component to keep dimensions distinct.
 *
 * @param props - Filter rendering inputs.
 * @returns The rendered filter toggle.
 */
export function TimetableBoardabilityFilter({
  boardable,
  onToggleBoardable,
}: TimetableBoardabilityFilterProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-1">
      <PillButton
        size="sm"
        active={boardable}
        onClick={onToggleBoardable}
        title={t('timetable.filter.boardableOnlyTitle')}
      >
        {t('timetable.filter.boardableOnly')}
      </PillButton>
    </div>
  );
}
