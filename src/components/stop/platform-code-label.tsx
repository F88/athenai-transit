import { cn } from '../../lib/utils';
import { BaseLabel } from '../label/base-label';
import type { ExtendedDisplaySize } from '../shared/display-size';

interface PlatformCodeLabelProps {
  code: string;
  size: ExtendedDisplaySize;
  maxLength?: number;
  ellipsis?: boolean;
  className?: string;
}

/**
 * Small amber chip displaying a station's platform code.
 *
 * GTFS `stop.platform_code` identifies a specific platform within a station.
 * The amber accent visually distinguishes it from surrounding stop metadata
 * (route badges, distance, accessibility icons).
 *
 * Built on top of {@link BaseLabel} for shape / sizing consistency. The
 * amber palette is design-driven (not data-driven), so it is applied via
 * Tailwind classes — including the `dark:` variants — rather than inline
 * color props.
 *
 * Caller is responsible for the falsy check; render this component only when
 * a `platform_code` is present.
 */
export function PlatformCodeLabel({
  code,
  size,
  maxLength,
  ellipsis,
  className,
}: PlatformCodeLabelProps) {
  return (
    <BaseLabel
      value={code}
      size={size}
      maxLength={maxLength}
      ellipsis={ellipsis}
      className={cn(
        'border border-amber-400 bg-amber-100 text-amber-700 dark:border-amber-600 dark:bg-amber-900 dark:text-amber-300',
        className,
      )}
    />
  );
}
