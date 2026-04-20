/**
 * **Stub: currently returns `fg` unchanged — no contrast adjustment is
 * performed yet.**
 *
 * The public signature is exported so call sites can depend on it
 * today, but callers MUST NOT assume the returned color meets
 * `minRatio` until this function is implemented. Treat the return
 * value as equal to `fg` in all branches.
 *
 * Planned behavior (not yet implemented):
 *
 * - Adjust `fg` so that its contrast against `bg` meets `minRatio`,
 *   measured with WCAG relative luminance.
 * - Preserve the brand hue — unlike {@link suggestTextColor}, which
 *   falls back to pure black or white, this function should nudge
 *   the original color's lightness just enough to cross the
 *   threshold, so a route color (or similar brand color) stays
 *   visually close to its original.
 * - Return the input unchanged when the pair already meets the
 *   threshold.
 *
 * @param fg - Foreground color as a CSS hex string.
 * @param bg - Background color as a CSS hex string.
 *   **Currently ignored (stub).**
 * @param minRatio - Target WCAG contrast ratio. Default `4.5`
 *   (WCAG AA for normal text). **Currently ignored (stub).**
 * @returns In the current stub: `fg` unchanged. When implemented: a
 *   contrast-adjusted color as a CSS hex string.
 *
 * @remarks
 * When implemented, this may internally reuse the a11y helpers in
 * `./color-contrast` to measure contrast before and after adjustment.
 */
export function adjustColorForContrast(fg: string, bg: string, minRatio: number = 4.5): string {
  void bg;
  void minRatio;
  return fg;
}
