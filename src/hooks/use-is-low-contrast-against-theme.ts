import { useSyncExternalStore } from 'react';
import { LOW_CONTRAST_BADGE_MIN_RATIO } from '../domain/transit/color-resolver/contrast-thresholds';
import {
  getContrastAssessment,
  getContrastEvaluation,
  type ContrastAssessment,
  type ContrastEvaluation,
} from '../utils/color/color-contrast';

/** Background color used as the reference when the user is on the light theme. */
const LIGHT_BG = '#ffffff';
/** Neutral border color used on the light theme. Matches `border-app-neutral`. */
const LIGHT_NEUTRAL_BORDER = '#d1d5db';
/**
 * Background color used as the reference when the user is on the dark
 * theme. Matches the bottom-sheet dark background (`dark:bg-gray-900`,
 * Tailwind `gray-900` = `#111827`), which is the dominant surface
 * behind badge / indicator color swatches in dark mode.
 */
const DARK_BG = '#111827';
/** Neutral border color used on the dark theme. Matches `border-app-neutral`. */
const DARK_NEUTRAL_BORDER = '#4b5563';

/**
 * Default WCAG contrast threshold below which a color is deemed too
 * close to the theme background. `1.2` still protects exact matches
 * like white-on-white and near-matches like black on `#111827`, while
 * avoiding outlines for pale but still visible yellows.
 */
const DEFAULT_BADGE_MIN_RATIO = LOW_CONTRAST_BADGE_MIN_RATIO;

/**
 * Observe the `class` attribute of `<html>` and fire the callback on
 * every mutation. Used so every component tree that calls
 * {@link useThemeContrastAssessment} sees theme changes immediately.
 *
 * Why not `useUserSettings`? That hook keeps its state in `useState`
 * at each call site, so two call sites end up with independent state
 * instances that do not stay in sync when the user toggles the theme
 * elsewhere. Reading the `dark` class on `<html>` bypasses that: it
 * is the single source of truth written in `App` via
 * `document.documentElement.classList.toggle('dark', ...)`, and every
 * subscriber observes the same DOM node.
 */
function subscribeToDarkClass(callback: () => void): () => void {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}

function getDarkClassSnapshot(): boolean {
  return document.documentElement.classList.contains('dark');
}

function getDarkClassServerSnapshot(): boolean {
  // SSR has no document. Default to light so the first paint has a
  // predictable value; the observer takes over on hydration.
  return false;
}

/**
 * React hook: returns the current theme background color used for
 * contrast checks.
 *
 * The value tracks the `dark` class on `<html>` via the same
 * subscription mechanism as {@link useThemeContrastAssessment}, so
 * callers can derive multiple contrast decisions from a single theme
 * read.
 *
 * @returns `#ffffff` on light theme, `#111827` on dark theme.
 */
export function useThemeContrastBackgroundColor(): string {
  const isDark = useSyncExternalStore(
    subscribeToDarkClass,
    getDarkClassSnapshot,
    getDarkClassServerSnapshot,
  );

  return isDark ? DARK_BG : LIGHT_BG;
}

/**
 * React hook: returns the neutral border color used across the app for
 * theme-aware fallback outlines.
 *
 * @returns `#d1d5db` on light theme, `#4b5563` on dark theme.
 */
export function useThemeNeutralBorderColor(): string {
  const isDark = useSyncExternalStore(
    subscribeToDarkClass,
    getDarkClassSnapshot,
    getDarkClassServerSnapshot,
  );

  return isDark ? DARK_NEUTRAL_BORDER : LIGHT_NEUTRAL_BORDER;
}

/**
 * React hook: assesses the given foreground `color` against the
 * current theme's background.
 *
 * Intended for badge / indicator components whose `color` is a raw
 * GTFS `route_color` that can coincide with the theme background
 * (e.g. `#FFFFFF` on the light theme, `#000000` on the dark theme).
 * When `isLowContrast` is `true`, the caller is expected to render an
 * extra outline / border so the element remains visually
 * distinguishable.
 *
 * The theme is read from the `dark` class on `<html>` via
 * `useSyncExternalStore` + `MutationObserver`, so every consumer stays
 * in sync when the user toggles themes, regardless of where the
 * toggle happens in the component tree.
 *
 * @param color - Foreground color (CSS hex, rgb, or hsl). Typically
 *   a GTFS `route_color` prefixed with `#`.
 * @param minRatio - WCAG contrast ratio threshold. Defaults to
 *   {@link DEFAULT_BADGE_MIN_RATIO}.
 * @returns An assessment object with both the raw ratio and the
 *   boolean low-contrast classification.
 */
export function useThemeContrastAssessment(
  color: string,
  minRatio: number = DEFAULT_BADGE_MIN_RATIO,
): ContrastAssessment {
  const bg = useThemeContrastBackgroundColor();

  return getContrastAssessment(color, bg, minRatio);
}

/**
 * React hook: evaluates the given foreground `color` against the current
 * theme's background and returns both the result and the evaluated pair.
 *
 * Unlike {@link useThemeContrastAssessment}, this hook includes the input
 * `foreground` color and resolved theme `background` in the returned object,
 * which is useful for verbose UI and diagnostics.
 *
 * @param color - Foreground color (CSS hex, rgb, or hsl). Typically a GTFS
 *   `route_color` prefixed with `#`.
 * @param minRatio - WCAG contrast ratio threshold. Defaults to
 *   {@link DEFAULT_BADGE_MIN_RATIO}.
 * @returns A {@link ContrastEvaluation} with both evaluated colors and the
 *   computed classification.
 */
export function useThemeContrastEvaluation(
  color: string,
  minRatio: number = DEFAULT_BADGE_MIN_RATIO,
): ContrastEvaluation {
  const bg = useThemeContrastBackgroundColor();

  return getContrastEvaluation(color, bg, minRatio);
}
