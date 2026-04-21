import { useThemeContrastAssessment } from '@/hooks/use-is-low-contrast-against-theme';
import {
  LOW_CONTRAST_BADGE_MIN_RATIO,
  LOW_CONTRAST_TEXT_MIN_RATIO,
} from '@/domain/transit/color-resolver/contrast-thresholds';
import { BaseLabel } from '../label/base-label';

interface ColorPaletteProps {
  color: string;
  textColor?: string;
  text?: string;
  minRatio?: number;
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="border-app-neutral/70 bg-muted inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] leading-none whitespace-nowrap">
      <span className="font-sans text-[9px] uppercase opacity-70">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function ContrastStateChip({ isLowContrast }: { isLowContrast: boolean }) {
  return (
    <BaseLabel
      value={isLowContrast ? 'low' : 'ok'}
      className={`inline-block min-w-10 rounded px-1.5 py-0.5 text-center font-semibold text-white ${
        isLowContrast ? 'bg-red-500' : 'bg-green-600'
      }`}
    />
  );
}

function PaletteFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-app-neutral/70 bg-background/60 inline-flex min-w-0 items-center gap-2 rounded-md border px-2 py-1 text-xs">
      {children}
    </div>
  );
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
 * 3. The current result of {@link useThemeContrastAssessment}
 *    (`true` / `false`) rendered as a BaseLabel pill.
 *
 * Combine several of these to see at a glance which `route_color`
 * values the low-contrast hook classifies as problematic. Toggle the
 * app theme while it is on screen to verify the classification
 * updates reactively.
 */
export function ColorPaletteForBadge({
  color,
  text,
  textColor,
  minRatio = LOW_CONTRAST_BADGE_MIN_RATIO,
}: ColorPaletteProps) {
  const assessment = useThemeContrastAssessment(color, minRatio);

  return (
    <PaletteFrame>
      <code className="font-mono">{color}</code>
      <MetricChip label="min" value={assessment.minRatio.toFixed(2)} />
      <MetricChip label="ratio" value={assessment.ratio?.toFixed(2) ?? 'n/a'} />
      <ContrastStateChip isLowContrast={assessment.isLowContrast} />
      <BaseLabel
        value={text ?? color}
        style={{ background: color, ...(textColor ? { color: textColor } : {}) }}
        size="md"
      />
    </PaletteFrame>
  );
}

/**
 * Development-only probe for cases where the route color itself is
 * used as text or another thin foreground accent.
 */
export function ColorPaletteForText({
  color,
  text,
  minRatio = LOW_CONTRAST_TEXT_MIN_RATIO,
}: ColorPaletteProps) {
  const assessment = useThemeContrastAssessment(color, minRatio);
  const sampleText = text ?? color;

  return (
    <PaletteFrame>
      <code className="font-mono">{color}</code>
      <MetricChip label="min" value={assessment.minRatio.toFixed(2)} />
      <MetricChip label="ratio" value={assessment.ratio?.toFixed(2) ?? 'n/a'} />
      <ContrastStateChip isLowContrast={assessment.isLowContrast} />
      <svg width="180" height="20" viewBox="0 0 180 20" className="shrink-0 overflow-visible">
        <text x="0" y="17" fill={color} fontSize="16" fontWeight="700">
          {sampleText}
        </text>
      </svg>
    </PaletteFrame>
  );
}
