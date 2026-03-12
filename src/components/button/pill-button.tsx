import type { CSSProperties } from 'react';
import { cn } from '../../lib/utils';

const sizeVariants = {
  default: 'px-2.5 py-1 text-xs',
  sm: 'px-2 py-0.5 text-[11px]',
} as const;

interface PillButtonProps {
  /** Whether this button is currently active/selected. */
  active: boolean;
  /** Whether the button is disabled (non-interactive, dimmed). */
  disabled?: boolean;
  /** Size variant. @default 'default' */
  size?: keyof typeof sizeVariants;
  /** Custom background color when active (e.g. route color). Falls back to default blue. */
  activeBg?: string;
  /** Custom text color when active (e.g. route text color). */
  activeFg?: string;
  /** Custom border color when active. */
  activeBorder?: string;
  /** Custom border color when inactive (e.g. route color as outline). */
  inactiveBorder?: string;
  /** Click handler. */
  onClick: () => void;
  /** Optional tooltip text. */
  title?: string;
  /** Additional CSS classes. */
  className?: string;
  children: React.ReactNode;
}

/**
 * Pill-shaped toggle button used for view switching and filter controls.
 *
 * Active state uses a custom color or default blue. Inactive state uses
 * a gray background. Disabled state is dimmed and non-interactive.
 *
 * All buttons have a 2px transparent border for consistent sizing.
 * Use activeBorder/inactiveBorder to color the border per state.
 *
 * @param active - Whether the button is selected.
 * @param disabled - Whether the button is non-interactive.
 * @param size - Size variant: `'default'` or `'sm'`.
 * @param activeBg - Custom background color for active state.
 * @param activeFg - Custom text color for active state.
 * @param activeBorder - Custom border color for active state.
 * @param inactiveBorder - Custom border color for inactive state.
 * @param onClick - Click handler.
 * @param title - Tooltip text.
 * @param className - Additional CSS classes.
 * @param children - Button content.
 */
export function PillButton({
  active,
  disabled = false,
  size = 'default',
  activeBg,
  activeFg,
  activeBorder,
  inactiveBorder,
  onClick,
  title,
  className,
  children,
}: PillButtonProps) {
  // All buttons get a 2px transparent border for consistent sizing.
  // Border color is overridden per state as needed.
  const style: CSSProperties = {
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: 'transparent',
    ...(active
      ? {
          ...(activeBg ? { background: activeBg, color: activeFg } : {}),
          ...(activeBorder ? { borderColor: activeBorder } : {}),
        }
      : {
          ...(inactiveBorder ? { borderColor: inactiveBorder } : {}),
        }),
  };

  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'shrink-0 rounded-full font-medium whitespace-nowrap transition-colors',
        sizeVariants[size] ?? sizeVariants.default,
        active
          ? activeBg
            ? 'text-white'
            : 'bg-[#1565c0] text-white dark:bg-blue-600'
          : disabled
            ? 'cursor-not-allowed bg-[#f0f0f0] text-[#bbb] dark:bg-gray-800 dark:text-gray-600'
            : 'bg-[#e8eaf0] text-[#555] active:bg-[#d0d3da] dark:bg-gray-700 dark:text-gray-300',
        className,
      )}
      style={style}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}
