/** Visual-only Tailwind classes for map overlay buttons (no positioning). */
const MAP_OVERLAY_BUTTON_STYLE =
  'flex items-center justify-center w-10 h-10 border-2 border-black/60 rounded-lg bg-white text-lg leading-none cursor-pointer active:bg-[#e0e0e0] dark:bg-gray-800 dark:border-white/40 dark:text-white dark:active:bg-gray-700';

interface MapToggleButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}

/**
 * A toggle button for use inside a {@link ControlPanel}.
 *
 * @param active - Whether the toggle is currently on (full opacity).
 * @param onClick - Click handler.
 * @param label - Accessible aria-label.
 * @param children - Button content (emoji / text).
 */
export function MapToggleButton({ active, onClick, label, children }: MapToggleButtonProps) {
  const opacityClass = active ? '' : 'opacity-40';
  return (
    <button
      type="button"
      className={`${MAP_OVERLAY_BUTTON_STYLE} ${opacityClass}`}
      onClick={onClick}
      aria-label={label}
    >
      {children}
    </button>
  );
}
