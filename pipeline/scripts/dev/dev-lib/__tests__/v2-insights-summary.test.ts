import { describe, expect, it } from 'vitest';

import {
  V2_INSIGHTS_SUMMARY_SECTION_NAMES,
  V2_INSIGHTS_SUMMARY_SECTIONS,
  analyzeV2InsightsSummary,
  computeTripCountsPerServiceGroup,
} from '../v2-insights-summary';
import type { InsightsBundle } from '../../../../../src/types/data/transit-v2-json';

/**
 * Smoke tests for the InsightsBundle sub lib. Asserts the two
 * max-leaning indicators (`tripsTotal`, `tripsMax`) on a couple of
 * representative distributions plus the missing-insights branch.
 */

function createInsightsBundle(overrides?: Partial<InsightsBundle>): InsightsBundle {
  return {
    bundle_version: 3,
    kind: 'insights',
    serviceGroups: {
      v: 1,
      data: [
        { key: 'wd', serviceIds: ['svc:weekday'] },
        { key: 'sa', serviceIds: ['svc:saturday'] },
        { key: 'su', serviceIds: ['svc:sunday'] },
      ],
    },
    tripPatternStats: {
      v: 1,
      data: {
        wd: {
          'src:p1': { freq: 100, rd: [30, 15, 0] },
          'src:p2': { freq: 80, rd: [45, 20, 0] },
        },
        sa: { 'src:p1': { freq: 60, rd: [30, 15, 0] } },
        su: { 'src:p1': { freq: 40, rd: [30, 15, 0] } },
      },
    },
    ...overrides,
  };
}

describe('computeTripCountsPerServiceGroup', () => {
  it('returns one total per service group, summed across patterns', () => {
    const result = computeTripCountsPerServiceGroup(createInsightsBundle());
    expect(result.sort((a, b) => a - b)).toEqual([40, 60, 180]);
  });

  it('returns empty array when tripPatternStats is missing', () => {
    expect(
      computeTripCountsPerServiceGroup(createInsightsBundle({ tripPatternStats: undefined })),
    ).toEqual([]);
  });

  it('returns empty array when insights is null', () => {
    expect(computeTripCountsPerServiceGroup(null)).toEqual([]);
  });
});

describe('analyzeV2InsightsSummary', () => {
  it('computes tripsTotal as the grand sum and tripsMax as the busiest sg', () => {
    const result = analyzeV2InsightsSummary({
      prefix: 'src',
      nameEn: 'Src Transit',
      insights: createInsightsBundle(),
    });
    // per-sg totals: wd=180, sa=60, su=40
    expect(result.tripVolume.tripsTotal).toBe(280);
    expect(result.tripVolume.tripsMax).toBe(180);
    expect(result.tripVolume.serviceGroupCount).toBe(3);
    expect(result.bundlePresent).toBe(true);
  });

  it('returns nulls when tripPatternStats is missing', () => {
    const result = analyzeV2InsightsSummary({
      prefix: 'src',
      nameEn: 'Src Transit',
      insights: createInsightsBundle({ tripPatternStats: undefined }),
    });
    expect(result.tripVolume.tripsTotal).toBeNull();
    expect(result.tripVolume.tripsMax).toBeNull();
    // serviceGroupCount comes from the required `serviceGroups`
    // section, so it stays accurate even when the optional
    // `tripPatternStats` section is absent. bundlePresent is still
    // true — the bundle exists, it just carries no trip stats.
    expect(result.tripVolume.serviceGroupCount).toBe(3);
    expect(result.bundlePresent).toBe(true);
  });

  it('returns nulls when insights is null', () => {
    const result = analyzeV2InsightsSummary({
      prefix: 'src',
      nameEn: 'Src Transit',
      insights: null,
    });
    expect(result.tripVolume.tripsTotal).toBeNull();
    expect(result.tripVolume.tripsMax).toBeNull();
    expect(result.tripVolume.serviceGroupCount).toBe(0);
    expect(result.bundlePresent).toBe(false);
  });

  it('survives a heavy-tailed sg distribution where median would mislead', () => {
    // Simulate vagfr-style: many tiny sg + few large sg. Median across
    // sg sums would collapse toward the tail; tripsMax surfaces the
    // actual peak day, tripsTotal aggregates the whole feed.
    // serviceGroups must enumerate every group keyed in
    // tripPatternStats — a valid InsightsBundle keeps the two in sync.
    const result = analyzeV2InsightsSummary({
      prefix: 'src',
      nameEn: 'Src Transit',
      insights: createInsightsBundle({
        serviceGroups: {
          v: 1,
          data: [
            { key: 'wd', serviceIds: ['svc:wd'] },
            { key: 'sa', serviceIds: ['svc:sa'] },
            { key: 'su', serviceIds: ['svc:su'] },
            { key: 'sp1', serviceIds: ['svc:sp1'] },
            { key: 'sp2', serviceIds: ['svc:sp2'] },
            { key: 'sp3', serviceIds: ['svc:sp3'] },
          ],
        },
        tripPatternStats: {
          v: 1,
          data: {
            wd: { 'src:p1': { freq: 5000, rd: [10, 0] } },
            sa: { 'src:p1': { freq: 4000, rd: [10, 0] } },
            su: { 'src:p1': { freq: 3000, rd: [10, 0] } },
            sp1: { 'src:p1': { freq: 5, rd: [10, 0] } },
            sp2: { 'src:p1': { freq: 3, rd: [10, 0] } },
            sp3: { 'src:p1': { freq: 1, rd: [10, 0] } },
          },
        },
      }),
    });
    expect(result.tripVolume.tripsTotal).toBe(5000 + 4000 + 3000 + 5 + 3 + 1);
    expect(result.tripVolume.tripsMax).toBe(5000);
    expect(result.tripVolume.serviceGroupCount).toBe(6);
  });

  it('handles single-sg sources by setting both indicators to the same value', () => {
    const result = analyzeV2InsightsSummary({
      prefix: 'src',
      nameEn: 'Src Transit',
      insights: createInsightsBundle({
        serviceGroups: {
          v: 1,
          data: [{ key: 'd1000111', serviceIds: ['svc:d1000111'] }],
        },
        tripPatternStats: {
          v: 1,
          data: { d1000111: { 'src:p1': { freq: 12, rd: [10, 0] } } },
        },
      }),
    });
    expect(result.tripVolume.tripsTotal).toBe(12);
    expect(result.tripVolume.tripsMax).toBe(12);
    expect(result.tripVolume.serviceGroupCount).toBe(1);
  });
});

describe('V2_INSIGHTS_SUMMARY_SECTIONS', () => {
  it('exposes insights-counts and trip-volume in a stable order', () => {
    expect(V2_INSIGHTS_SUMMARY_SECTION_NAMES).toEqual(['insights-counts', 'trip-volume']);
  });

  it("the section's render returns a string with a totals row", () => {
    const result = analyzeV2InsightsSummary({
      prefix: 'src',
      nameEn: 'Src Transit',
      insights: createInsightsBundle(),
    });
    const body = V2_INSIGHTS_SUMMARY_SECTIONS['trip-volume'].render([result]);
    expect(body).toContain('Src Transit');
    expect(body).toContain('totals');
  });
});
