import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { relativeTimeStyle } from '../utils/time-style';
import type { ExtendedDisplaySize } from './shared/display-size';

// "imminent" is intentionally smaller than "number" — Athenai avoids
// urgency cues. "まもなく" should feel calm, not alarming.
// font-bold is applied on the parent <span>, so variants omit font-weight.
const variants = {
  xs: { number: 'text-xs', label: 'text-[8px]', imminent: 'text-[9px]' },
  sm: { number: 'text-xs', label: 'text-[9px]', imminent: 'text-[10px]' },
  md: { number: 'text-sm', label: 'text-[10px]', imminent: 'text-xs' },
  lg: { number: 'text-xl', label: 'text-xs', imminent: 'text-sm' },
  xl: { number: 'text-2xl', label: 'text-sm', imminent: 'text-base' },
} as const;

interface RelativeTimeProps {
  /** Departure (or arrival) time. */
  time: Date;
  /** Current time for relative calculation. */
  now: Date;
  /** Size variant. @default 'md' */
  size?: ExtendedDisplaySize;
  /** Whether past times should still be rendered as negative minutes. */
  showPastTime?: boolean;
  /** Hide the localized prefix (e.g. "あと" in ja) to save horizontal space. */
  hidePrefix?: boolean;
  /** Additional CSS classes. */
  className?: string;
}

type RelativeTimeDisplay =
  | { kind: 'past'; minutes: number }
  | { kind: 'imminent' }
  | { kind: 'future'; minutes: number };

function getRelativeTimeDisplay(diffMs: number): RelativeTimeDisplay {
  if (diffMs < 0) {
    return { kind: 'past', minutes: Math.ceil(Math.abs(diffMs) / 60000) };
  }

  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin === 0) {
    return { kind: 'imminent' };
  }

  return { kind: 'future', minutes: diffMin };
}

/**
 * Displays relative time with emphasis on the number.
 *
 * Localized prefix and unit labels are displayed in small text,
 * while the number is displayed in bold. Color is determined by
 * the time band from {@link relativeTimeStyle}.
 *
 * - `< 0 min`: render nothing by default, or `-N min` when `showPastTime` is enabled
 * - `0 to < 1 min`: imminent label (e.g. "まもなく" in ja, "Soon" in en)
 * - `> 0 min`: prefix + number + unit (e.g. "あと N 分" in ja, "N min" in en)
 */
export function RelativeTime({
  time,
  now,
  size = 'md',
  showPastTime = false,
  hidePrefix = false,
  className,
}: RelativeTimeProps) {
  const { t } = useTranslation();
  const diffMs = time.getTime() - now.getTime();
  const display = getRelativeTimeDisplay(diffMs);
  const style = relativeTimeStyle(Math.floor(diffMs / 1000));
  const v = variants[size];

  if (display.kind === 'past' && !showPastTime) {
    return null;
  }

  return (
    <span
      className={cn('flex flex-wrap items-baseline justify-end leading-none font-bold', className)}
      style={{ color: style.color, opacity: style.opacity }}
    >
      {display.kind === 'imminent' ? (
        <span className={v.imminent}>{t('stopTimeView.soon')}</span>
      ) : display.kind === 'past' ? (
        <span>
          <span className={v.number}>-{display.minutes}</span>
          <span className={`${v.label} font-normal`}>{t('stopTimeView.minutes')}</span>
        </span>
      ) : (
        <>
          {!hidePrefix && <span className={`${v.label} font-normal`}>{t('stopTimeView.in')}</span>}
          <span>
            <span className={v.number}>{display.minutes}</span>
            <span className={`${v.label} font-normal`}>{t('stopTimeView.minutes')}</span>
          </span>
        </>
      )}
    </span>
  );
}
