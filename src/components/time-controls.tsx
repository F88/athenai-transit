import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_TIMEZONE } from '../config/transit-defaults';
import { formatDateParts } from '../utils/datetime';
import { DAY_COLOR_CATEGORY_CLASSES } from '../utils/day-of-week';
import { TimeSettingDialog } from './dialog/time-setting-dialog';

interface TimeControlsProps {
  time: Date;
  isCustomTime: boolean;
  onResetToNow: () => void;
  onCustomTimeSet: (date: Date) => void;
}

export function TimeControls({
  time,
  isCustomTime,
  onResetToNow,
  onCustomTimeSet,
}: TimeControlsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitialTime, setDialogInitialTime] = useState<Date>(time);

  const openDialog = useCallback(() => {
    setDialogInitialTime(time);
    setDialogOpen(true);
  }, [time]);

  const { t, i18n } = useTranslation();
  const {
    dateText,
    dayLabel,
    time: timeText,
    dayColorCategory,
  } = formatDateParts(time, i18n.language, DEFAULT_TIMEZONE, { showTime: true });
  const colorClass = DAY_COLOR_CATEGORY_CLASSES[dayColorCategory];

  return (
    <>
      {/* 🕐 (現在時刻に戻す) and 📅 (カレンダー) buttons removed:
         the top-center datetime button below provides the same functionality */}

      <button
        type="button"
        className="bg-background/85 border-border text-foreground hover:bg-background/95 active:bg-accent absolute top-[calc(1.25rem+env(safe-area-inset-top))] left-1/2 z-1000 -translate-x-1/2 cursor-pointer rounded-full border px-4 py-1.5 text-sm font-semibold whitespace-nowrap shadow-md backdrop-blur-sm transition-colors"
        onClick={openDialog}
        aria-label={t('time.settingLabel')}
      >
        {isCustomTime && '📌 '}
        {dateText} <span className={colorClass}>({dayLabel})</span> {timeText}
      </button>

      <TimeSettingDialog
        initialTime={dialogInitialTime}
        isCustomTime={isCustomTime}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onResetToNow={onResetToNow}
        onCustomTimeSet={onCustomTimeSet}
      />
    </>
  );
}
