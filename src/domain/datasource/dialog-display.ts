import type { SourceLoadState } from './source-load-state';
import type { SourceGroup } from '../../types/app/source-group';

/**
 * Display-ready inputs for the Data Source Settings dialog.
 *
 * The dialog renders the same shape regardless of whether the URL is
 * forcing source selection. {@link computeDialogDisplay} normalizes the
 * two modes (forced / normal) into one Set + one list so the dialog
 * body does not branch on `isForcedSourcesMode` for what to render.
 */
export interface DialogDisplay {
  /**
   * Groups to render in the dialog. The same group may be rendered in
   * multiple sections (multi-routeType groups); section assignment is
   * the caller's concern.
   */
  visibleGroups: SourceGroup[];
  /**
   * IDs that the dialog should show as "currently on" — used both for
   * the per-row Switch `checked` state and for per-section enabled
   * counts in the header.
   *
   * - Forced-sources mode: every visible group (the URL is the source
   *   of truth; user-settings is bypassed).
   * - Normal mode: the user-settings layer (`enabledGroupIds`).
   */
  effectiveEnabledIds: ReadonlySet<string>;
}

/**
 * Normalize the two operating modes (forced-sources / normal) into a
 * single {@link DialogDisplay} shape consumed by the dialog body.
 *
 * Pure function — no React, no hooks. The mode-dependent decisions
 * (which groups are visible, which Switch is checked) live here, not
 * sprinkled through the JSX.
 *
 * @param settings - All configured source groups (build-time config).
 * @param loadStatusByPrefix - Per-prefix runtime load status.
 * @param isForcedSourcesMode - Whether the URL `?sources=` override is
 *   active for this session.
 * @param userEnabledIds - The user-settings layer's enabled group IDs
 *   (used only when `isForcedSourcesMode` is `false`).
 * @returns Normalized display inputs.
 */
export function computeDialogDisplay(
  settings: readonly SourceGroup[],
  loadStatusByPrefix: SourceLoadState,
  isForcedSourcesMode: boolean,
  userEnabledIds: ReadonlySet<string>,
): DialogDisplay {
  const visibleGroups = settings.filter((g) => {
    const anyAttempted = g.prefixes.some((prefix) => loadStatusByPrefix.has(prefix));
    if (isForcedSourcesMode) {
      // URL is in control; show only what was actually attempted.
      return anyAttempted;
    }
    // Normal mode: app-level enabled groups are always shown; plus any
    // group whose data ended up loaded for other reasons (e.g. stale
    // localStorage referencing a system-disabled group).
    return g.systemEnabledByDefault || anyAttempted;
  });

  const effectiveEnabledIds: ReadonlySet<string> = isForcedSourcesMode
    ? new Set(visibleGroups.map((g) => g.id))
    : userEnabledIds;

  return { visibleGroups, effectiveEnabledIds };
}
