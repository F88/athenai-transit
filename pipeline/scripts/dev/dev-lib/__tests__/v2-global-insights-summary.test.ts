import { describe, expect, it } from 'vitest';

import type { GlobalInsightsBundle } from '@contracts/data/transit-v2-json';

import {
  analyzeV2GlobalInsightsSummary,
  V2_GLOBAL_INSIGHTS_SUMMARY_SECTION_NAMES,
  V2_GLOBAL_INSIGHTS_SUMMARY_SECTIONS,
} from '../v2-global-insights-summary';

/**
 * Smoke tests for the GlobalInsightsBundle sub lib.
 */

function createGlobalBundle(): GlobalInsightsBundle {
  return {
    bundle_version: 3,
    kind: 'global-insights',
    stopGeo: {
      v: 1,
      data: {
        // 3 stops: s1 has wp + cn, s2 has wp only, s3 has neither.
        'src:s1': { nr: 0.5, wp: 0.2, cn: { ho: { rc: 3, freq: 200, sc: 5 } } },
        'src:s2': { nr: 1.2, wp: 0.4 },
        'src:s3': { nr: 0 },
      },
    },
  };
}

describe('analyzeV2GlobalInsightsSummary', () => {
  it('counts stopGeo entries plus wp / cn coverage when the bundle is present', () => {
    const summary = analyzeV2GlobalInsightsSummary({
      bundle: createGlobalBundle(),
      fileSize: 5000,
      gzipSize: 1200,
    });
    expect(summary.fileSize).toBe(5000);
    expect(summary.gzipSize).toBe(1200);
    expect(summary.stopGeoEntries).toBe(3);
    // s1 and s2 have wp; s3 does not.
    expect(summary.stopsWithWp).toBe(2);
    // Only s1 has cn[ho].
    expect(summary.stopsWithCnByGroup).toEqual({ ho: 1 });
    // counts reflects the present stopGeo section (3 entries).
    expect(summary.counts).toEqual({ stopGeo: 3 });
  });

  it('returns null entries and empty coverage when the bundle is missing', () => {
    const summary = analyzeV2GlobalInsightsSummary({
      bundle: null,
      fileSize: null,
      gzipSize: null,
    });
    expect(summary.fileSize).toBeNull();
    expect(summary.gzipSize).toBeNull();
    expect(summary.stopGeoEntries).toBeNull();
    expect(summary.stopsWithWp).toBeNull();
    expect(summary.stopsWithCnByGroup).toEqual({});
    // A missing bundle yields an empty count set — not { stopGeo: 0 },
    // which would be indistinguishable from a present-but-empty bundle.
    expect(summary.counts).toEqual({});
  });

  it('returns null stopGeoEntries when bundle exists but stopGeo section is omitted', () => {
    const summary = analyzeV2GlobalInsightsSummary({
      bundle: { bundle_version: 3, kind: 'global-insights' },
      fileSize: 200,
      gzipSize: 80,
    });
    expect(summary.fileSize).toBe(200);
    expect(summary.stopGeoEntries).toBeNull();
    expect(summary.stopsWithWp).toBeNull();
    expect(summary.stopsWithCnByGroup).toEqual({});
  });
});

describe('V2_GLOBAL_INSIGHTS_SUMMARY_SECTIONS', () => {
  it('exposes global-insights-counts and global-insights in a stable order', () => {
    expect(V2_GLOBAL_INSIGHTS_SUMMARY_SECTION_NAMES).toEqual([
      'global-insights-counts',
      'global-insights',
    ]);
  });

  it("the section's render reports 'not found' when bundle is absent", () => {
    const summary = analyzeV2GlobalInsightsSummary({
      bundle: null,
      fileSize: null,
      gzipSize: null,
    });
    const body = V2_GLOBAL_INSIGHTS_SUMMARY_SECTIONS['global-insights'].render(summary);
    expect(body).toContain('not found');
    expect(body).toContain('-');
  });

  it('global-insights-counts reports sections=0 when the bundle is absent', () => {
    const summary = analyzeV2GlobalInsightsSummary({
      bundle: null,
      fileSize: null,
      gzipSize: null,
    });
    const body = V2_GLOBAL_INSIGHTS_SUMMARY_SECTIONS['global-insights-counts'].render(summary);
    // Empty count set → sections=0, with no `stopGeo: 0` line that
    // would otherwise look like a present-but-empty bundle.
    expect(body).toContain('sections=0');
    expect(body).not.toContain('stopGeo');
  });

  it("the section's render reports wp and cn[group] coverage with percentages", () => {
    const summary = analyzeV2GlobalInsightsSummary({
      bundle: createGlobalBundle(),
      fileSize: 5000,
      gzipSize: 1200,
    });
    const body = V2_GLOBAL_INSIGHTS_SUMMARY_SECTIONS['global-insights'].render(summary);
    expect(body).toContain('found');
    // 2 of 3 stops carry wp → 66.7%.
    expect(body).toContain('stops with wp:        2 (66.7%)');
    // 1 of 3 stops has cn[ho] → 33.3%.
    expect(body).toContain('stops with cn[ho]:  1 (33.3%)');
  });
});
