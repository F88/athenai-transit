import type { SourceGroup } from '../../types/app/source-group';
import { getEnabledDataSourcesFromSourcesParam } from './data-source-selection';

/**
 * Resolve the final list of data sources (= GTFS prefixes) the
 * repository should fetch, given the URL `?sources=` value and the
 * group-driven fallback view.
 *
 * Architecture (historical):
 *
 * 1. `?sources=<data sources>` was the original load-target mechanism
 *    and has always operated at the data-source (= prefix) level.
 * 2. {@link SourceGroup} and
 *    {@link import('../../config/data-source-manager').DataSourceManager}
 *    were added later as a wrapper/manager so users could think in
 *    groups (bus operators, ticket bundles) rather than raw data sources.
 *
 * This resolver keeps those two layers honest:
 *
 * - When the user supplies `?sources=<data sources>` (anything except
 *   the `'all'` keyword), the original data-source-level contract wins.
 *   The resolver returns exactly the data sources the user listed —
 *   even when one of those also appears in a multi-prefix bundling
 *   group (e.g. `toko` covering both `minkuru` and `toaran`). This is
 *   what `PRD.md:118` ("指定した prefix のデータソースのみ有効")
 *   prescribes.
 * - Otherwise (URL absent, `?sources=all`, localStorage, defaults), we
 *   fall through to the group-driven view that the caller already
 *   computed (typically `DataSourceManager.getEnabledPrefixes()`).
 *
 * Keeping data-source resolution out of `DataSourceManager` preserves
 * DSM's role as a SourceGroup state manager and leaves the
 * data-source-centric URL semantic where it belongs — next to the
 * param parser.
 *
 * @param groups - All configured source groups. Used to validate the
 *   data sources listed in `?sources=` against the known universe.
 * @param fallbackDataSources - The group-driven data-source list for
 *   the non-URL paths (typically `dsm.getEnabledPrefixes()`).
 * @param sourcesParam - Raw `?sources=` value, or `null` if the query
 *   parameter is absent.
 * @returns The data sources to load (prefix array).
 */
export function resolveFetchDataSources(
  groups: readonly SourceGroup[],
  fallbackDataSources: readonly string[],
  sourcesParam: string | null,
): string[] {
  if (sourcesParam !== null && sourcesParam !== 'all') {
    // Direct data-source-list path: trust the user's request verbatim.
    return getEnabledDataSourcesFromSourcesParam([...groups], sourcesParam);
  }
  // Group-driven fallback: '?sources=all', no param, localStorage, default.
  return [...fallbackDataSources];
}
