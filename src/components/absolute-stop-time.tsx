import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import type { ExtendedDisplaySize } from './shared/display-size';

const absoluteTimeVariants: Record<ExtendedDisplaySize, { time: string; marker: string }> = {
  xs: { time: 'text-xs', marker: 'text-[8px]' },
  sm: { time: 'text-sm', marker: 'text-[9px]' },
  md: { time: 'text-base', marker: 'text-[10px]' },
  lg: { time: 'text-lg', marker: 'text-[11px]' },
  xl: { time: 'text-xl', marker: 'text-[12px]' },
};

export interface AbsoluteStopTimeProps {
  /** Formatted absolute time text. */
  timeText: string;
  /** Text color derived from the route color. */
  textColor: string;
  /** Size variant. @default 'md' */
  size?: ExtendedDisplaySize;
  /** Whether to render the departure marker suffix next to the time. */
  showDepartureMarker: boolean;
  /** Whether to render the arrival marker suffix next to the time. */
  showArrivalMarker: boolean;
}

export function AbsoluteStopTime({
  timeText,
  showArrivalMarker,
  showDepartureMarker,
  textColor,
  size = 'md',
}: AbsoluteStopTimeProps) {
  const { t } = useTranslation();
  const variant = absoluteTimeVariants[size];

  return (
    <div
      className={cn('font-bold text-[#333] dark:text-gray-100', variant.time)}
      style={{ color: textColor }}
    >
      {timeText}
      {showArrivalMarker && (
        <span className={cn('font-normal opacity-70', variant.marker)}>
          {t('stopTimeView.arrivingAbsolute')}
        </span>
      )}
      {showDepartureMarker && (
        <span className={cn('font-normal opacity-70', variant.marker)}>
          {t('stopTimeView.departingAbsolute')}
        </span>
      )}
    </div>
  );
}
