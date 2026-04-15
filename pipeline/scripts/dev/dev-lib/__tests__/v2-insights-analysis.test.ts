import { describe, expect, it } from 'vitest';

import { analyzeInsightsBundle, formatInsightsAnalysis } from '../v2-insights-analysis';
import type { InsightsBundle } from '../../../../../src/types/data/transit-v2-json';

/**
 * Smoke tests only. Statistical correctness of the numeric output is
 * not asserted here (see TSDoc at the top of the source module for the
 * rationale). These tests guard against type regressions, missing-data
 * contract breakage, and formatter crashes — not algorithmic bugs.
 */

function createMinimalBundle(overrides?: Partial<InsightsBundle>): InsightsBundle {
  return {
    bundle_version: 3,
    kind: 'insights',
    serviceGroups: {
      v: 1,
      data: [{ key: 'wd', serviceIds: ['svc:1'] }],
    },
    tripPatternStats: {
      v: 1,
      data: {
        wd: {
          'src:p1': { freq: 2, rd: [30, 15, 0] },
          'src:p2': { freq: 1, rd: [45, 20, 0] },
        },
      },
    },
    ...overrides,
  };
}

describe('analyzeInsightsBundle', () => {
  it('returns a stats object for a minimal valid bundle', () => {
    const result = analyzeInsightsBundle('src', 'Src Transit', createMinimalBundle());
    expect(result).not.toBeNull();
    expect(result?.source).toBe('src');
    expect(result?.nameEn).toBe('Src Transit');
    expect(result?.byPattern.count).toBe(2);
    expect(result?.byTrip.count).toBe(3);
    expect(result?.serviceGroups.groupCount).toBe(1);
  });

  it('returns null when tripPatternStats is missing', () => {
    const bundle = createMinimalBundle({ tripPatternStats: undefined });
    const result = analyzeInsightsBundle('src', 'Src', bundle);
    expect(result).toBeNull();
  });

  it('returns null when no patterns are valid', () => {
    const bundle = createMinimalBundle({
      tripPatternStats: {
        v: 1,
        data: { wd: { 'src:bad': { freq: 1, rd: [0] } } },
      },
    });
    const result = analyzeInsightsBundle('src', 'Src', bundle);
    expect(result).toBeNull();
  });
});

describe('formatInsightsAnalysis', () => {
  it('emits the expected section headers for a valid input', () => {
    const row = analyzeInsightsBundle('src', 'Src', createMinimalBundle());
    expect(row).not.toBeNull();
    const output = formatInsightsAnalysis(row === null ? [] : [row], {
      analyzedAt: new Date('2026-01-01T00:00:00Z'),
    });
    expect(output).toContain('# Athenai Transit — V2 InsightsBundle analysis');
    expect(output).toContain('# serviceGroups');
    expect(output).toContain('# tripPatternStats');
    expect(output).toContain('# tripPatternGeo');
    expect(output).toContain('# stopStats');
    expect(output).toContain('## Overview');
    expect(output).toContain('## Distribution of trip duration (minutes)');
  });

  it('returns a non-empty string for an empty rows array', () => {
    const output = formatInsightsAnalysis([], {
      analyzedAt: new Date('2026-01-01T00:00:00Z'),
    });
    expect(output.length).toBeGreaterThan(0);
  });
});
