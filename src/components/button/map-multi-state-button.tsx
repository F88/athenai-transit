import {
  MAP_OVERLAY_BUTTON_BASE_STYLE,
  MAP_OVERLAY_BUTTON_HIGHLIGHT_BG_STYLE,
  MAP_OVERLAY_BUTTON_NEUTRAL_BG_STYLE,
} from './map-overlay-button.styles';

interface MapMultiStateButtonProps {
  /** Whether the button is currently interactive (full opacity when true). */
  active: boolean;
  /** Whether the button is in its highlighted (accent background) state. */
  highlighted: boolean;
  /** Click handler. */
  onClick: () => void;
  /** Accessible aria-label. */
  label: string;
  /** Button content (emoji / text). */
  children: React.ReactNode;
  /** When true the button is non-interactive (overrides active). */
  disabled?: boolean;
  /**
   * Monotonically increasing counter that, when it changes, replays a
   * one-shot ripple animation on the button to acknowledge an external
   * event (e.g. a fresh geolocation fix from `watchPosition` or a
   * manual locate). The animation is keyed off this number, so only
   * the change matters; pass the same value again and nothing happens.
   * Leave undefined to disable the ripple entirely.
   */
  pulseKey?: number;
}

const PULSE_KEYFRAMES = `
@keyframes mmsb-locate-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.6); }
  100% { box-shadow: 0 0 0 12px rgba(59, 130, 246, 0); }
}
`;

/**
 * A control-panel button that supports two independent visual axes:
 * - {@link MapMultiStateButtonProps.active} — opacity (interactive vs dimmed)
 * - {@link MapMultiStateButtonProps.highlighted} — accent background color
 *
 * Use when a single button needs to express more than the on/off pair
 * that {@link MapToggleButton} covers (e.g. an idle / locating /
 * tracking-enabled triplet on the locate button).
 *
 * The neutral and highlighted background variants are mutually exclusive
 * (only one is applied) so Tailwind utility ordering can't cause one to
 * silently override the other.
 *
 * The optional {@link MapMultiStateButtonProps.pulseKey} replays a brief
 * blue ripple any time the value changes, useful for signaling that a
 * background event (such as a geolocation update) just happened without
 * altering the persistent button state.
 */
export function MapMultiStateButton({
  active,
  highlighted,
  onClick,
  label,
  children,
  disabled = false,
  pulseKey,
}: MapMultiStateButtonProps) {
  const opacityClass = active && !disabled ? '' : 'opacity-40';
  const backgroundClass = highlighted
    ? MAP_OVERLAY_BUTTON_HIGHLIGHT_BG_STYLE
    : MAP_OVERLAY_BUTTON_NEUTRAL_BG_STYLE;
  return (
    <>
      <style>{PULSE_KEYFRAMES}</style>
      <button
        type="button"
        className={`relative ${MAP_OVERLAY_BUTTON_BASE_STYLE} ${backgroundClass} ${opacityClass}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={highlighted}
      >
        {pulseKey != null && pulseKey > 0 && (
          <span
            key={pulseKey}
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-lg"
            style={{ animation: 'mmsb-locate-pulse 700ms ease-out' }}
          />
        )}
        {children}
      </button>
    </>
  );
}
