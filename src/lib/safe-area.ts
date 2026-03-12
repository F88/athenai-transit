/**
 * Safe-area inset values in pixels for all four edges.
 */
export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const ZERO_INSETS: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/** Cached result — safe-area insets are device-fixed and never change at runtime. */
let cached: SafeAreaInsets | null = null;

/**
 * Read the current `env(safe-area-inset-*)` values as pixels.
 *
 * CSS `env()` cannot be read directly from JS, so a temporary element
 * with the env value as padding is measured and discarded.
 * The result is cached after the first call since safe-area insets
 * are determined by the device hardware and do not change at runtime.
 *
 * @returns Resolved inset values in pixels. Returns all zeros when
 *          `safe-area-inset-*` is not supported or not applicable.
 */
export function getSafeAreaInsets(): SafeAreaInsets {
  if (cached) {
    return cached;
  }

  if (typeof document === 'undefined') {
    return ZERO_INSETS;
  }

  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.visibility = 'hidden';
  el.style.paddingTop = 'env(safe-area-inset-top)';
  el.style.paddingRight = 'env(safe-area-inset-right)';
  el.style.paddingBottom = 'env(safe-area-inset-bottom)';
  el.style.paddingLeft = 'env(safe-area-inset-left)';
  document.body.appendChild(el);

  const style = getComputedStyle(el);
  cached = {
    top: parseFloat(style.paddingTop) || 0,
    right: parseFloat(style.paddingRight) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
  };

  document.body.removeChild(el);
  return cached;
}
