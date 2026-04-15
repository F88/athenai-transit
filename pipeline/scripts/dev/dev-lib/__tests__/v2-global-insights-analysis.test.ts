import { describe, expect, it } from 'vitest';

import {
  analyzeGlobalInsightsBundle,
  formatGlobalInsightsAnalysis,
} from '../v2-global-insights-analysis';
import type { GlobalInsightsBundle } from '../../../../../src/types/data/transit-v2-json';

/**
 * Smoke tests only. See the TSDoc at the top of the source module for
 * the testing philosophy — these assertions guard against type and
 * contract regressions, not algorithm correctness.
 */

function createMinimalBundle(overrides?: Partial<GlobalInsightsBundle>): GlobalInsightsBundle {
  return {
    bundle_version: 3,
    kind: 'global-insights',
    stopGeo: {
      v: 1,
      data: {
        'src:001': {
          nr: 0.3,
          wp: 0.1,
          cn: { ho: { rc: 4, freq: 50, sc: 3 } },
        },
        'src:002': {
          nr: 0.05,
          cn: { ho: { rc: 1, freq: 10, sc: 1 } },
        },
        'src:003': {
          nr: 2.5,
        },
      },
    },
    ...overrides,
  };
}

describe('analyzeGlobalInsightsBundle', () => {
  it('returns a stats object for a minimal valid bundle', () => {
    const result = analyzeGlobalInsightsBundle(createMinimalBundle());
    expect(result).not.toBeNull();
    expect(result?.totalStops).toBe(3);
    expect(result?.totalSources).toBe(1);
    expect(result?.perSource[0].source).toBe('src');
    expect(result?.perSource[0].stops).toBe(3);
    expect(result?.perSource[0].connectivity).not.toBeNull();
    expect(result?.perSource[0].walkablePortal).not.toBeNull();
  });

  it('returns null when stopGeo is missing', () => {
    const bundle = createMinimalBundle({ stopGeo: undefined });
    const result = analyzeGlobalInsightsBundle(bundle);
    expect(result).toBeNull();
  });

  it('populates leaderboards when cn data is present', () => {
    const result = analyzeGlobalInsightsBundle(createMinimalBundle());
    expect(result?.leaderboards.mostIsolated.length).toBeGreaterThan(0);
    expect(result?.leaderboards.mostConnected.length).toBeGreaterThan(0);
    expect(result?.leaderboards.busiestNeighborhood.length).toBeGreaterThan(0);
  });
});

describe('formatGlobalInsightsAnalysis', () => {
  it('emits the expected section headers for a valid input', () => {
    const stats = analyzeGlobalInsightsBundle(createMinimalBundle());
    const output = formatGlobalInsightsAnalysis(stats, {
      analyzedAt: new Date('2026-01-01T00:00:00Z'),
    });
    expect(output).toContain('# Athenai Transit — V2 GlobalInsightsBundle analysis');
    expect(output).toContain('# stopGeo');
    expect(output).toContain('## Summary');
    expect(output).toContain('## Distribution of nr (km)');
    expect(output).toContain('## Isolation buckets');
    expect(output).toContain('## Connectivity within 300m');
    expect(output).toContain('## Top 10 most isolated stops');
  });

  it('returns a message when stats is null', () => {
    const output = formatGlobalInsightsAnalysis(null, {
      analyzedAt: new Date('2026-01-01T00:00:00Z'),
    });
    expect(output).toContain('No stopGeo data found');
  });
});
