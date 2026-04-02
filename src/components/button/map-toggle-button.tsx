/** Visual-only Tailwind classes for map overlay buttons (no positioning). */
const MAP_OVERLAY_BUTTON_STYLE =
  'flex h-10 w-10 items-center justify-center rounded-lg border-2 border-black/60 bg-white text-lg leading-none cursor-pointer active:bg-[#e0e0e0] disabled:cursor-not-allowed disabled:active:bg-white dark:border-white/40 dark:bg-gray-800 dark:text-white dark:active:bg-gray-700 dark:disabled:active:bg-gray-800';

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
      className={`${MAP_OVERLAY_BUTTON_STYLE} ${opacityClass}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      {children}
    </button>
  );
}
