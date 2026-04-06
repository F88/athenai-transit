import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { relativeTimeStyle } from '../utils/time-style';

// "imminent" is intentionally smaller than "number" — Athenai avoids
// urgency cues. "まもなく" should feel calm, not alarming.
// font-bold is applied on the parent <span>, so variants omit font-weight.
const variants = {
  sm: { number: 'text-xs', label: 'text-[9px]', imminent: 'text-[10px]' },
  default: { number: 'text-sm', label: 'text-[10px]', imminent: 'text-xs' },
  lg: { number: 'text-xl', label: 'text-xs', imminent: 'text-sm' },
} as const;

interface RelativeTimeProps {
  /** Departure (or arrival) time. */
  departureTime: Date;
  /** Current time for relative calculation. */
  now: Date;
  /** Whether this is a terminal (arrival) entry. Appends "着" suffix. */
  isTerminal?: boolean;
  /** Hide the "あと" prefix to save horizontal space. */
  hidePrefix?: boolean;
  /** Size variant. @default 'default' */
  size?: keyof typeof variants;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Displays relative time with emphasis on the number.
 *
 * "あと" and "分" are displayed in small text, while the number
 * is displayed in bold. Color is determined by the time band
 * from {@link relativeTimeStyle}.
 *
 * - `<= 0 min`: "まもなく"
 * - `> 0 min`: "あと N 分"
 */
export function RelativeTime({
  departureTime,
  now,
  isTerminal = false,
  hidePrefix = false,
  size = 'default',
  className,
}: RelativeTimeProps) {
  const { t } = useTranslation();
  const diffMs = departureTime.getTime() - now.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const style = relativeTimeStyle(Math.floor(diffMs / 1000));
  const v = variants[size];

  return (
    <span
      className={cn('flex flex-wrap items-baseline justify-end leading-none font-bold', className)}
      style={{ color: style.color, opacity: style.opacity }}
    >
      {diffMin <= 0 ? (
        <span className={v.imminent}>{t('departure.soon')}</span>
      ) : (
        <>
          {!hidePrefix && <span className={`${v.label} font-normal`}>{t('departure.in')}</span>}
          <span>
            <span className={v.number}>{diffMin}</span>
            <span className={`${v.label} font-normal`}>{t('departure.minutes')}</span>
          </span>
        </>
      )}
      {isTerminal && (
        <span className={`${v.label} font-normal opacity-70`}>{t('departure.arriving')}</span>
      )}
    </span>
  );
}
