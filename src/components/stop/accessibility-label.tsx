import { Accessibility } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { ExtendedDisplaySize } from '../shared/display-size';

interface AccessibilityLabelProps {
  /**
   * GTFS `stop.wheelchair_boarding` value:
   * - `1` → wheelchair accessible (blue chip)
   * - `2` → not wheelchair accessible (dimmed gray chip)
   * - `0` / `undefined` → renders nothing
   */
  wheelchairBoarding: number | undefined;
  /**
   * Chip size. Drives both the surrounding padding (matching the
   * {@link BaseLabel} `sizeClasses` scale) and the rendered icon dimensions
   * so the chip stays visually aligned with adjacent {@link BaseLabel}-based
   * chips at the same `size`.
   */
  size: ExtendedDisplaySize;
}

const ICON_STROKE = 2;

/** Padding classes that mirror BaseLabel's `sizeClasses` per size. */
const PADDING_BY_SIZE: Record<ExtendedDisplaySize, string> = {
  xs: 'px-0.5',
  sm: 'px-1 py-0.5',
  md: 'px-1.5 py-0.5',
  lg: 'px-2 py-0.5',
  xl: 'px-3 py-1',
};

/**
 * Icon size in pixels per chip size. Tuned to read at the same visual
 * weight as a BaseLabel chip's text at the same size.
 */
const ICON_PX_BY_SIZE: Record<ExtendedDisplaySize, number> = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
};

const ACCESSIBLE_CHIP_CLASS =
  'shrink-0 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';

const INACCESSIBLE_CHIP_CLASS =
  'shrink-0 rounded bg-gray-100 text-gray-700 opacity-30 dark:bg-gray-700 dark:text-gray-300';

/**
 * Wheelchair accessibility indicator for a stop.
 *
 * Encapsulates the GTFS `wheelchair_boarding` rendering used by StopSummary
 * and StopSearchResultItem: a small icon-only chip whose color indicates
 * accessibility, with an aria-label / title carrying the translated
 * description for screen readers and hover tooltip.
 *
 * Returns `null` for `0` / `undefined` so the caller does not need a
 * surrounding falsy guard.
 */
export function AccessibilityLabel({ wheelchairBoarding, size }: AccessibilityLabelProps) {
  const { t } = useTranslation();
  const padding = PADDING_BY_SIZE[size];
  const iconPx = ICON_PX_BY_SIZE[size];

  if (wheelchairBoarding === 1) {
    const label = t('stop.accessibility.wheelchairAccessible');
    return (
      <span
        className={`${ACCESSIBLE_CHIP_CLASS} ${padding}`}
        role="img"
        aria-label={label}
        title={label}
      >
        <Accessibility
          size={iconPx}
          strokeWidth={ICON_STROKE}
          aria-hidden="true"
          focusable="false"
        />
      </span>
    );
  }

  if (wheelchairBoarding === 2) {
    const label = t('stop.accessibility.wheelchairNotAccessible');
    return (
      <span
        className={`${INACCESSIBLE_CHIP_CLASS} ${padding}`}
        role="img"
        aria-label={label}
        title={label}
      >
        <Accessibility
          size={iconPx}
          strokeWidth={ICON_STROKE}
          aria-hidden="true"
          focusable="false"
        />
      </span>
    );
  }

  return null;
}
