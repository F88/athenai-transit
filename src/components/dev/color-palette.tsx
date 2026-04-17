import { useIsLowContrastAgainstTheme } from '@/hooks/use-is-low-contrast-against-theme';
import { BaseLabel } from '../label/base-label';

interface ColorPaletteProps {
  color: string;
  textColor?: string;
  text?: string;
}

/**
 * Development-only probe that renders, for a single `color`:
 *
 * 1. The raw color string (hex value) as plain text — always readable
 *    against the current theme text color.
 * 2. A {@link BaseLabel} filled with the color, optionally labeled
 *    with `text` and colored with `textColor` (so the
 *    route_color / route_text_color pair is shown in its production
 *    combination).
 * 3. The current result of {@link useIsLowContrastAgainstTheme}
 *    (`true` / `false`) rendered as a BaseLabel pill.
 *
 * Combine several of these to see at a glance which `route_color`
 * values the low-contrast hook classifies as problematic. Toggle the
 * app theme while it is on screen to verify the classification
 * updates reactively.
 */
export function ColorPalette({ color, text, textColor }: ColorPaletteProps) {
  const isLowContrast = useIsLowContrastAgainstTheme(color);
  return (
    <div className="inline-flex items-center gap-2 text-xs">
      <code className="font-mono">{color}</code>
      <BaseLabel
        value={String(isLowContrast)}
        className={`inline-block w-10 rounded px-1 py-0.5 text-center font-semibold text-white ${
          isLowContrast ? 'bg-red-500' : 'bg-green-600'
        }`}
      />
      <BaseLabel
        value={text ?? color}
        style={{ background: color, ...(textColor ? { color: textColor } : {}) }}
      />
    </div>
  );
}
