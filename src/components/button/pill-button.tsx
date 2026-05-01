import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

const sizeVariants = {
  default: 'px-2.5 py-1 text-xs',
  sm: 'px-2 py-0.5 text-[10px]',
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
  /** Click handler. Omit for display-only (non-interactive) badges. */
  onClick?: () => void;
  /** Optional tooltip text. */
  title?: string;
  /** Count badge displayed as chip-in-chip (inverted colors). */
  count?: number;
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
  count,
  className,
  children,
}: PillButtonProps) {
  const { i18n } = useTranslation();
  const resolvedActiveBg = activeBg ?? 'var(--info)';
  const resolvedActiveFg = activeFg ?? 'var(--info-foreground)';
  const resolvedDisabledBorder = active ? activeBorder : inactiveBorder;
  const resolvedInactiveBadgeBg = inactiveBorder ?? 'var(--info)';
  const resolvedInactiveBadgeFg = activeFg ?? 'white';

  // All buttons get a 2px transparent border for consistent sizing.
  // Border color is overridden per state as needed.
  const style: CSSProperties = {
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: 'transparent',
  };

  if (disabled) {
    if (resolvedDisabledBorder) {
      style.borderColor = resolvedDisabledBorder;
    }
  } else {
    if (active) {
      if (activeBg) {
        style.background = activeBg;
        style.color = activeFg;
      }
      if (activeBorder) {
        style.borderColor = activeBorder;
      }
    } else if (inactiveBorder) {
      style.borderColor = inactiveBorder;
    }
  }

  let toneClassName: string;
  if (disabled) {
    toneClassName = 'bg-[#e8eaf0] text-gray-400 dark:bg-gray-700 dark:text-gray-500';
  } else {
    if (active) {
      if (activeBg) {
        toneClassName = 'text-white';
      } else {
        toneClassName = 'bg-info text-info-foreground';
      }
    } else {
      toneClassName =
        'bg-[#e8eaf0] text-[#555] active:bg-[#d0d3da] dark:bg-gray-700 dark:text-gray-300';
    }
  }

  let countBadgeStyle: CSSProperties;
  if (disabled) {
    countBadgeStyle = {
      color: 'var(--muted)',
      background: 'var(--muted-foreground)',
    };
  } else {
    if (active) {
      countBadgeStyle = { background: resolvedActiveFg, color: resolvedActiveBg };
    } else {
      countBadgeStyle = {
        background: resolvedInactiveBadgeBg,
        color: resolvedInactiveBadgeFg,
      };
    }
  }

  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full font-medium whitespace-nowrap transition-colors select-none [-webkit-touch-callout:none]',
        onClick && !disabled && 'cursor-pointer',
        disabled && 'cursor-not-allowed',
        sizeVariants[size] ?? sizeVariants.default,
        toneClassName,
        className,
      )}
      style={style}
      onClick={onClick}
      tabIndex={onClick ? undefined : -1}
      title={title}
    >
      {children}
      {/* Count badge  */}
      {count != null && (
        <span
          className="ml-1 inline-flex min-h-[1.4em] min-w-[1.4em] items-center justify-center rounded-full px-1 text-[0.85em] leading-none font-bold"
          style={countBadgeStyle}
        >
          {count.toLocaleString(i18n.language)}
        </span>
      )}
    </button>
  );
}
