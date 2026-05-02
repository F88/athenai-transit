import type { ReactNode } from 'react';
import { Clock, Route, Signpost } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

interface StopActionButtonsProps {
  stopId: string;
  isAnchor?: boolean;
  layout?: 'horizontal' | 'vertical';
  showAnchorButton?: boolean;
  showStopTimetableButton?: boolean;
  showTripInspectionButton?: boolean;
  onToggleAnchor?: (stopId: string) => void;
  onShowStopTimetable?: (stopId: string) => void;
  onOpenTripInspectionByStopId?: (stopId: string) => void;
}

interface ActionButtonProps {
  title: string;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}

function ActionButton({ title, className, onClick, children }: ActionButtonProps) {
  const baseClassName = 'bg-background shrink-0 cursor-pointer rounded border px-1.5 py-0.5';

  return (
    <button
      type="button"
      className={cn(baseClassName, className)}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

export function StopActionButtons({
  stopId,
  isAnchor,
  layout = 'vertical',
  showAnchorButton = false,
  showStopTimetableButton = false,
  showTripInspectionButton = false,
  onToggleAnchor,
  onShowStopTimetable,
  onOpenTripInspectionByStopId,
}: StopActionButtonsProps) {
  const { t } = useTranslation();
  const layoutClassName = cn(
    'ml-auto flex shrink-0 self-stretch',
    layout === 'horizontal'
      ? 'flex-row items-start justify-end'
      : 'flex-col items-end justify-start',
  );

  return (
    <div className={cn(layoutClassName, 'gap-1')}>
      {/* Anchor Button */}
      {showAnchorButton && onToggleAnchor && isAnchor !== undefined && (
        <ActionButton
          className={cn(
            'border-amber-400 active:bg-amber-50 dark:border-amber-500 dark:active:bg-amber-950',
            isAnchor
              ? 'bg-amber-300 text-white dark:bg-amber-400'
              : 'text-amber-400 dark:text-amber-500',
          )}
          onClick={() => onToggleAnchor(stopId)}
          title={isAnchor ? t('anchor.remove') : t('anchor.add')}
        >
          <Signpost size={16} strokeWidth={2} />
        </ActionButton>
      )}
      {/* Timetable Button */}
      {showStopTimetableButton && onShowStopTimetable && (
        <ActionButton
          className="border-teal-600 text-teal-600 active:bg-teal-600/10 dark:border-teal-400 dark:text-teal-400 dark:active:bg-teal-400/10"
          onClick={() => onShowStopTimetable(stopId)}
          title={t('showTimetable')}
        >
          <Clock size={16} strokeWidth={2} />
        </ActionButton>
      )}
      {/* Trip Inspection Button */}
      {showTripInspectionButton && onOpenTripInspectionByStopId && (
        <ActionButton
          className="border-sky-600 text-sky-600 active:bg-sky-600/10 dark:border-sky-400 dark:text-sky-400 dark:active:bg-sky-400/10"
          onClick={() => onOpenTripInspectionByStopId(stopId)}
          title={t('tripInspection.title')}
        >
          <Route size={16} strokeWidth={2} />
        </ActionButton>
      )}
    </div>
  );
}
