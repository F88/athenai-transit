import { Clock, Route, Signpost } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface StopActionButtonsProps {
  stopId: string;
  isAnchor?: boolean;
  layout?: 'horizontal' | 'vertical';
  onToggleAnchor?: (stopId: string) => void;
  onShowStopTimetable?: (stopId: string) => void;
  onOpenTripInspectionByStopId?: (stopId: string) => void;
}

export function StopActionButtons({
  stopId,
  isAnchor,
  layout = 'vertical',
  onToggleAnchor,
  onShowStopTimetable,
  onOpenTripInspectionByStopId,
}: StopActionButtonsProps) {
  const { t } = useTranslation();
  const layoutClassName =
    layout === 'horizontal'
      ? 'ml-auto flex shrink-0 self-stretch flex-row items-start justify-end'
      : 'ml-auto flex shrink-0 self-stretch flex-col items-end justify-start';

  return (
    <div className={`${layoutClassName} gap-1`}>
      {onToggleAnchor && isAnchor !== undefined && (
        <button
          type="button"
          className="shrink-0 cursor-pointer rounded border border-amber-400 bg-transparent px-1.5 py-0.5 active:bg-amber-50 dark:border-amber-500 dark:active:bg-amber-950"
          onClick={(event) => {
            event.stopPropagation();
            onToggleAnchor(stopId);
          }}
          title={isAnchor ? t('anchor.remove') : t('anchor.add')}
          aria-label={isAnchor ? t('anchor.remove') : t('anchor.add')}
        >
          <Signpost
            size={16}
            strokeWidth={2}
            className={isAnchor ? 'text-amber-500' : 'text-gray-400'}
          />
        </button>
      )}
      {onShowStopTimetable && (
        <button
          type="button"
          className="shrink-0 cursor-pointer rounded border border-teal-600 bg-transparent px-1.5 py-0.5 text-teal-600 active:bg-teal-600/10 dark:border-teal-400 dark:text-teal-400 dark:active:bg-teal-400/10"
          onClick={(event) => {
            event.stopPropagation();
            onShowStopTimetable(stopId);
          }}
          title={t('showTimetable')}
          aria-label={t('showTimetable')}
        >
          <Clock size={16} strokeWidth={2} />
        </button>
      )}
      {onOpenTripInspectionByStopId && (
        <button
          type="button"
          className="shrink-0 cursor-pointer rounded border border-sky-600 bg-transparent px-1.5 py-1 text-sky-600 active:bg-sky-600/10 dark:border-sky-400 dark:text-sky-400 dark:active:bg-sky-400/10"
          onClick={(event) => {
            event.stopPropagation();
            onOpenTripInspectionByStopId(stopId);
          }}
          title={t('tripInspection.title')}
          aria-label={t('tripInspection.title')}
        >
          <Route size={16} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
