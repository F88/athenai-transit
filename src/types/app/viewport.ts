/**
 * Effective viewport dimensions in CSS pixels.
 *
 * Project-wide shape for "where the layout decisions look at the
 * browser window". Defined here (not inside `src/hooks/use-viewport.ts`)
 * so pure decision utilities in `src/utils/` (e.g. `resolveLayoutMode`)
 * can depend on the type without breaking the `hooks → utils`
 * dependency direction.
 */
export interface Viewport {
  width: number;
  height: number;
}
