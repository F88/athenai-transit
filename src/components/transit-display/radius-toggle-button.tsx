import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import type { ExtendedDisplaySize } from '@/components/shared/display-size';
import { Button } from '@/components/ui/button';
import { Radio } from 'lucide-react';
import { distanceStyle } from '@/utils/distance-style';

/** Per-`size` style bundle for `RadiusToggleButton`. */
interface RadiusToggleButtonSizeStyle {
  /** Button label text size. */
  textClass: string;
  /**
   * `Radio` icon size. A `size-*` class is required so it overrides the
   * ui/button base `[&_svg:not([class*='size-'])]:size-4`.
   */
  iconClass: string;
  /** Vertical padding; sets the button height. */
  paddingClass: string;
}

const RADIUS_TOGGLE_BUTTON_STYLE_BY_SIZE: Record<ExtendedDisplaySize, RadiusToggleButtonSizeStyle> =
  {
    xs: { textClass: 'text-[10px]', iconClass: 'size-2.5', paddingClass: 'py-px' },
    sm: { textClass: 'text-xs', iconClass: 'size-3', paddingClass: 'py-0.5' },
    md: { textClass: 'text-base', iconClass: 'size-4', paddingClass: 'py-1' },
    lg: { textClass: 'text-2xl', iconClass: 'size-9', paddingClass: 'py-1.5' },
    xl: { textClass: 'text-4xl', iconClass: 'size-15', paddingClass: 'py-2' },
  };

interface RadiusToggleButtonProps {
  /** Selectable radii in metres, in cycle order. */
  options: readonly number[];
  /** Currently selected radius (m); shown as the button label. */
  selected: number;
  /** Fired with the next radius (m) when the button is pressed. */
  onSelect: (radiusMeters: number) => void;
  /** Display size; scales the button text, height, and icon. */
  size: ExtendedDisplaySize;
  /** Extra classes for the button, merged last so the caller can override. */
  className?: string;
}

/**
 * Single button that cycles the coverage radius through `options` (wrapping back
 * to the first after the last). Controlled: shows the current `selected` value
 * and advances it via `onSelect`. A `selected` value outside `options` advances
 * to the first.
 */
export function RadiusToggleButton({
  options,
  selected,
  onSelect,
  size,
  className,
}: RadiusToggleButtonProps) {
  const { t } = useTranslation();
  const style = RADIUS_TOGGLE_BUTTON_STYLE_BY_SIZE[size];
  const onAdvance = () => {
    if (options.length === 0) {
      return;
    }
    const currentIndex = options.indexOf(selected);
    const next = options[(currentIndex + 1) % options.length] ?? options[0];
    onSelect(next);
  };
  const styleForDistance = distanceStyle(selected);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={t('transitDisplay2.radius.label')}
      onClick={onAdvance}
      className={cn(
        'h-auto w-fit shrink-0 cursor-pointer px-2 has-[>svg]:px-2',
        // 'border-0',
        style.textClass,
        style.paddingClass,
        className,
      )}
      style={{
        color: styleForDistance.textColor,
        backgroundColor: styleForDistance.color,
        // borderColor: styleForDistance.color,
      }}
    >
      <Radio className={style.iconClass} />
      {`${selected}m`}
    </Button>
  );
}
