/**
 * @module diagnostics
 *
 * Dispatcher for diagnostic/benchmark tools.
 * Each diagnostic is lazy-loaded to avoid bundling unused code.
 *
 * Add new diagnostics by adding a case to the switch in {@link runDiagnostics}.
 */

import { DataSourceManager } from '../config/data-source-manager';
import { createLogger } from '../lib/logger';
import type { TransitRepository } from '../repositories/transit-repository';

const logger = createLogger('diagnostics');

/**
 * Run a named diagnostic tool.
 *
 * @param name - Diagnostic name from `?diag=` query parameter.
 * @param repository - The active TransitRepository instance (for repo-bench).
 */
export async function runDiagnostics(name: string, repository?: TransitRepository): Promise<void> {
  const prefixes = new DataSourceManager().getEnabledPrefixes();

  switch (name) {
    case 'v2-load': {
      const { runV2LoadBenchmark } = await import('./v2-load-benchmark');
      await runV2LoadBenchmark(prefixes);
      break;
    }
    case 'repo-bench': {
      if (!repository) {
        logger.warn('repo-bench requires a repository instance');
        break;
      }
      const { runRepoBenchmark } = await import('./repo-benchmark');
      await runRepoBenchmark(repository);
      break;
    }
    default:
      logger.warn(`Unknown diag: "${name}". Available: v2-load, repo-bench`);
  }
}
