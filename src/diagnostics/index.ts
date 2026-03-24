/**
 * @module diagnostics
 *
 * Dispatcher for diagnostic/benchmark tools.
 * Each diagnostic is lazy-loaded to avoid bundling unused code.
 *
 * Add new diagnostics by adding a case to the switch in {@link runDiagnostics}.
 */

import { DataSourceManager } from '../config/data-source-manager';
import { createLogger } from '../utils/logger';

const logger = createLogger('diagnostics');

/**
 * Run a named diagnostic tool.
 *
 * @param name - Diagnostic name from `?diag=` query parameter.
 */
export async function runDiagnostics(name: string): Promise<void> {
  const prefixes = new DataSourceManager().getEnabledPrefixes();

  switch (name) {
    case 'v2-load': {
      const { runV2LoadBenchmark } = await import('./v2-load-benchmark');
      await runV2LoadBenchmark(prefixes);
      break;
    }
    default:
      logger.warn(`Unknown diag: "${name}". Available: v2-load`);
  }
}
