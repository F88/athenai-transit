import type { SourceGroup } from '../../types/app/source-group';
import { getEnabledDataSourcesFromSourcesParam } from './data-source-selection';

/**
 * Resolve the final fetch-target prefix list passed to the repository's
 * `create(prefixes)` entry point.
 *
 * Architecture (historical):
 *
 * 1. `?sources=<prefixes>` was the original load-target mechanism and
 *    has always operated at the prefix level.
 * 2. `SourceGroup` and {@link import('../../config/data-source-manager').DataSourceManager}
 *    were added later as a wrapper/manager so users could think in
 *    groups (bus operators, ticket bundles) rather than raw prefixes.
 *
 * This resolver keeps those two layers honest:
 *
 * - When the user supplies `?sources=<prefixes>` (anything except the
 *   `'all'` keyword), the original prefix-level contract wins. The
 *   resolver returns exactly the prefixes the user listed — even when
 *   one of those prefixes also appears in a multi-prefix bundling group
 *   (e.g. `toko` covering both `minkuru` and `toaran`). This is what
 *   `PRD.md:118` ("指定した prefix のデータソースのみ有効") prescribes.
 * - Otherwise (URL absent, `?sources=all`, localStorage, defaults), we
 *   fall through to the group-driven view that the caller already
 *   computed (typically `DataSourceManager.getEnabledPrefixes()`).
 *
 * Keeping prefix resolution out of `DataSourceManager` preserves DSM's
 * role as a SourceGroup state manager and leaves the prefix-centric
 * URL semantic where it belongs — next to the param parser.
 *
 * @param groups - All configured source groups. Used to validate the
 *   prefixes listed in `?sources=` against the known prefix universe.
 * @param fallbackPrefixes - The group-driven prefix list for the
 *   non-URL paths (typically `dsm.getEnabledPrefixes()`).
 * @param sourcesParam - Raw `?sources=` value, or `null` if the
 *   query parameter is absent.
 * @returns The prefix array to load.
 */
export function resolveFetchPrefixes(
  groups: readonly SourceGroup[],
  fallbackPrefixes: readonly string[],
  sourcesParam: string | null,
): string[] {
  if (sourcesParam !== null && sourcesParam !== 'all') {
    // Direct prefix-list path: trust the user's request verbatim.
    return getEnabledDataSourcesFromSourcesParam([...groups], sourcesParam);
  }
  // Group-driven fallback: '?sources=all', no param, localStorage, default.
  return [...fallbackPrefixes];
}
