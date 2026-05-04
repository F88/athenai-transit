/**
 * Layout / border / typography classes shared by every map overlay button.
 * Background color is intentionally omitted so the consumer can pick a
 * background variant without colliding with this class.
 */
export const MAP_OVERLAY_BUTTON_BASE_STYLE =
  'flex h-10 w-10 items-center justify-center rounded-lg border-2 border-black/60 text-lg leading-none cursor-pointer select-none [-webkit-touch-callout:none] disabled:cursor-not-allowed dark:border-white/40 dark:text-white';

/** Background variant for the neutral (default) state. */
export const MAP_OVERLAY_BUTTON_NEUTRAL_BG_STYLE =
  'bg-white active:bg-[#e0e0e0] disabled:active:bg-white dark:bg-gray-800 dark:active:bg-gray-700 dark:disabled:active:bg-gray-800';

/**
 * Background variant for the accented (highlighted) state used by buttons
 * that need to communicate an active/engaged mode (e.g. auto tracking on).
 * Text color is forced to white so the emoji/glyph stays legible against
 * the saturated background in both light and dark modes.
 */
export const MAP_OVERLAY_BUTTON_HIGHLIGHT_BG_STYLE =
  'bg-blue-600 text-white active:bg-blue-700 disabled:active:bg-blue-600 dark:bg-blue-500 dark:text-white dark:active:bg-blue-600 dark:disabled:active:bg-blue-500';
