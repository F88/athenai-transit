import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import type { ExtendedDisplaySize } from '@/components/shared/display-size';
import { Button } from '@/components/ui/button';
import { Radio } from 'lucide-react';

/** Text size of the toggle button per display size. */
const RADIUS_TOGGLE_TEXT_BY_SIZE: Record<ExtendedDisplaySize, string> = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
};

interface RadiusToggleButtonProps {
  /** Selectable radii in metres, in cycle order. */
  options: readonly number[];
  /** Currently selected radius (m); shown as the button label. */
  selected: number;
  /** Fired with the next radius (m) when the button is pressed. */
  onSelect: (radiusMeters: number) => void;
  /** Display size; scales the button text. */
  size: ExtendedDisplaySize;
}

/**
 * Single button that cycles the coverage radius through `options` (wrapping back
 * to the first after the last). Controlled: shows the current `selected` value
 * and advances it via `onSelect`. A `selected` value outside `options` advances
 * to the first.
 */
export function RadiusToggleButton({ options, selected, onSelect, size }: RadiusToggleButtonProps) {
  const { t } = useTranslation();
  const onAdvance = () => {
    const currentIndex = options.indexOf(selected);
    const next = options[(currentIndex + 1) % options.length] ?? options[0];
    onSelect(next);
  };
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={t('transitDisplay2.radius.label')}
      onClick={onAdvance}
      className={cn(
        'w-fit shrink-0 cursor-pointer px-2 has-[>svg]:px-2',
        RADIUS_TOGGLE_TEXT_BY_SIZE[size],
      )}
    >
      <Radio />
      {`${selected}m`}
    </Button>
  );
}
