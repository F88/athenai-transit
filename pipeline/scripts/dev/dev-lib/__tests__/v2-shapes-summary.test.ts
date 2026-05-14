import { describe, expect, it } from 'vitest';

import {
  V2_SHAPES_SUMMARY_SECTION_NAMES,
  V2_SHAPES_SUMMARY_SECTIONS,
  analyzeV2ShapesSummary,
} from '../v2-shapes-summary';
import type { ShapesBundle } from '../../../../../src/types/data/transit-v2-json';

/**
 * Smoke tests for the ShapesBundle sub lib.
 */

function createShapesBundle(): ShapesBundle {
  return {
    bundle_version: 3,
    kind: 'shapes',
    shapes: {
      v: 2,
      data: {
        'src:r1': [
          [
            [35.0, 139.0],
            [35.1, 139.1],
            [35.2, 139.2],
          ],
        ],
        'src:r2': [
          [
            [36.0, 140.0],
            [36.1, 140.1],
          ],
          [
            [36.2, 140.2],
            [36.3, 140.3],
            [36.4, 140.4],
            [36.5, 140.5],
          ],
        ],
      },
    },
  };
}

describe('analyzeV2ShapesSummary', () => {
  it('counts routes, polylines, points, and total length', () => {
    const result = analyzeV2ShapesSummary({
      prefix: 'src',
      nameEn: 'Src Transit',
      shapesBundle: createShapesBundle(),
    });
    // src:r1 has 1 polyline of 3 points; src:r2 has 2 polylines of 2 + 4 points
    expect(result.shapes.routes).toBe(2);
    expect(result.shapes.polylines).toBe(3);
    expect(result.shapes.points).toBe(3 + 2 + 4);
    // Total length sums Haversine segments across every polyline.
    // The fixture coordinates are roughly 0.1 deg apart, so the value
    // is positive and well under 100 km (loose bound — exact value is
    // covered by geo-utils tests).
    expect(result.shapes.totalLengthKm).toBeGreaterThan(0);
    expect(result.shapes.totalLengthKm).toBeLessThan(100);
  });

  it('returns null counts when shapes bundle is missing', () => {
    const result = analyzeV2ShapesSummary({
      prefix: 'src',
      nameEn: 'Src Transit',
      shapesBundle: null,
    });
    expect(result.shapes.routes).toBeNull();
    expect(result.shapes.polylines).toBeNull();
    expect(result.shapes.points).toBeNull();
    expect(result.shapes.totalLengthKm).toBeNull();
  });
});

describe('V2_SHAPES_SUMMARY_SECTIONS', () => {
  it('exposes shapes-counts and shapes-volume in a stable order', () => {
    expect(V2_SHAPES_SUMMARY_SECTION_NAMES).toEqual(['shapes-counts', 'shapes-volume']);
  });

  it('shapes-counts renders generic top-level counts with a totals row', () => {
    const result = analyzeV2ShapesSummary({
      prefix: 'src',
      nameEn: 'Src Transit',
      shapesBundle: createShapesBundle(),
    });
    const body = V2_SHAPES_SUMMARY_SECTIONS['shapes-counts'].render([result]);
    expect(body).toContain('Src Transit');
    expect(body).toContain('totals');
    expect(body).toContain('shapes'); // column header
  });

  it('shapes-volume includes routes / polylines / points / totalLengthKm', () => {
    const result = analyzeV2ShapesSummary({
      prefix: 'src',
      nameEn: 'Src Transit',
      shapesBundle: createShapesBundle(),
    });
    const body = V2_SHAPES_SUMMARY_SECTIONS['shapes-volume'].render([result]);
    expect(body).toContain('Src Transit');
    expect(body).toContain('routes');
    expect(body).toContain('polylines');
    expect(body).toContain('points');
    expect(body).toContain('totalLengthKm');
  });

  it("shapes-volume renders '-' for sources without shapes", () => {
    const result = analyzeV2ShapesSummary({
      prefix: 'src',
      nameEn: 'Src Transit',
      shapesBundle: null,
    });
    const body = V2_SHAPES_SUMMARY_SECTIONS['shapes-volume'].render([result]);
    expect(body).toContain('sourcesMissingShapes=1');
  });
});
