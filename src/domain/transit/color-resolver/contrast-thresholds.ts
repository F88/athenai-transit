/**
 * Default threshold for colored fills such as route badges and pills.
 *
 * This is intentionally permissive: `1.2` protects colors that are
 * nearly indistinguishable from the surrounding surface, while still
 * allowing pale but still visible badge fills.
 */
export const LOW_CONTRAST_BADGE_MIN_RATIO = 1.2;

/**
 * Default threshold for using a color directly as text or as a thin
 * accent that must read clearly against the theme background.
 *
 * This is intentionally looser than WCAG AA because it is used for
 * route-colored time text and thin transit accents, where preserving
 * the operator color is still important.
 */
export const LOW_CONTRAST_TEXT_MIN_RATIO = 1.7;
