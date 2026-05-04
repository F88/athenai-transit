import {
  MAP_OVERLAY_BUTTON_BASE_STYLE,
  MAP_OVERLAY_BUTTON_NEUTRAL_BG_STYLE,
} from './map-overlay-button.styles';

interface MapToggleButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}

/**
 * A toggle button for use inside a {@link ControlPanel}.
 *
 * @param active - Whether the toggle is currently on (full opacity).
 * @param onClick - Click handler.
 * @param label - Accessible aria-label.
 * @param children - Button content (emoji / text).
 */
export function MapToggleButton({
  active,
  onClick,
  label,
  children,
  disabled = false,
}: MapToggleButtonProps) {
  const opacityClass = active && !disabled ? '' : 'opacity-40';
  return (
    <button
      type="button"
      className={`${MAP_OVERLAY_BUTTON_BASE_STYLE} ${MAP_OVERLAY_BUTTON_NEUTRAL_BG_STYLE} ${opacityClass}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      {children}
    </button>
  );
}
