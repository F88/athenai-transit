/**
 * Tests for validate-shapes.ts validateShapesBundle function.
 *
 * Creates temporary ShapesBundle files and validates them,
 * verifying correct detection of structural and data quality issues.
 *
 * @vitest-environment node
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ShapesBundle } from '../../../../../../src/types/data/transit-v2-json';
import { validateShapesBundle } from '../validate-shapes';

const TMP_DIR = join(import.meta.dirname, '.tmp-validate-shapes-test');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeBundle(prefix: string, bundle: unknown): void {
  const dir = join(TMP_DIR, prefix);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'shapes.json'), JSON.stringify(bundle));
}

function makeValidBundle(shapes: Record<string, [number, number][][]> = {}): ShapesBundle {
  return {
    bundle_version: 2,
    kind: 'shapes',
    shapes: { v: 2, data: shapes },
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateShapesBundle', () => {
  describe('file and structure checks', () => {
    it('reports error when shapes.json does not exist', () => {
      const result = validateShapesBundle('nonexistent', TMP_DIR);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].level).toBe('error');
      expect(result.issues[0].message).toContain('not found');
    });

    it('reports error for invalid JSON', () => {
      const dir = join(TMP_DIR, 'bad-json');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'shapes.json'), '{invalid json');

      const result = validateShapesBundle('bad-json', TMP_DIR);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].level).toBe('error');
      expect(result.issues[0].message).toContain('Failed to parse');
    });

    it('reports error for wrong bundle_version', () => {
      writeBundle('bad-ver', { bundle_version: 1, kind: 'shapes', shapes: { v: 2, data: {} } });
      const result = validateShapesBundle('bad-ver', TMP_DIR);
      expect(result.issues.some((i) => i.message.includes('bundle_version'))).toBe(true);
    });

    it('reports error for wrong kind', () => {
      writeBundle('bad-kind', { bundle_version: 2, kind: 'data', shapes: { v: 2, data: {} } });
      const result = validateShapesBundle('bad-kind', TMP_DIR);
      expect(result.issues.some((i) => i.message.includes('kind'))).toBe(true);
    });

    it('reports error for wrong shapes.v', () => {
      writeBundle('bad-sv', { bundle_version: 2, kind: 'shapes', shapes: { v: 1, data: {} } });
      const result = validateShapesBundle('bad-sv', TMP_DIR);
      expect(result.issues.some((i) => i.message.includes('shapes.v'))).toBe(true);
    });

    it('passes for a valid bundle with data', () => {
      const bundle = makeValidBundle({
        'test:R1': [
          [
            [35.68, 139.76],
            [35.69, 139.77],
          ],
        ],
      });
      writeBundle('valid', bundle);

      const result = validateShapesBundle('valid', TMP_DIR);
      expect(result.issues).toHaveLength(0);
      expect(result.routeCount).toBe(1);
      expect(result.polylineCount).toBe(1);
      expect(result.pointCount).toBe(2);
    });
  });

  describe('empty and malformed shapes', () => {
    it('warns when shapes.data is empty', () => {
      writeBundle('empty', makeValidBundle({}));
      const result = validateShapesBundle('empty', TMP_DIR);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].level).toBe('warn');
      expect(result.issues[0].message).toContain('empty');
    });

    it('reports error when shapes.data is null', () => {
      writeBundle('null-data', { bundle_version: 2, kind: 'shapes', shapes: { v: 2, data: null } });
      const result = validateShapesBundle('null-data', TMP_DIR);
      expect(
        result.issues.some((i) => i.level === 'error' && i.message.includes('Invalid shapes.data')),
      ).toBe(true);
    });

    it('reports error when shapes.data is missing', () => {
      writeBundle('no-data', { bundle_version: 2, kind: 'shapes', shapes: { v: 2 } });
      const result = validateShapesBundle('no-data', TMP_DIR);
      expect(
        result.issues.some((i) => i.level === 'error' && i.message.includes('Invalid shapes.data')),
      ).toBe(true);
    });

    it('reports error when shapes.data is an array', () => {
      writeBundle('array-data', { bundle_version: 2, kind: 'shapes', shapes: { v: 2, data: [] } });
      const result = validateShapesBundle('array-data', TMP_DIR);
      expect(
        result.issues.some((i) => i.level === 'error' && i.message.includes('Invalid shapes.data')),
      ).toBe(true);
    });
  });

  describe('coordinate validation', () => {
    it('reports error for lat out of range', () => {
      const bundle = makeValidBundle({
        'test:R1': [
          [
            [91.0, 139.76],
            [35.69, 139.77],
          ],
        ],
      });
      writeBundle('bad-lat', bundle);

      const result = validateShapesBundle('bad-lat', TMP_DIR);
      expect(result.issues.some((i) => i.level === 'error' && i.message.includes('lat'))).toBe(
        true,
      );
    });

    it('reports error for negative lat out of range', () => {
      const bundle = makeValidBundle({
        'test:R1': [
          [
            [-91.0, 139.76],
            [35.69, 139.77],
          ],
        ],
      });
      writeBundle('bad-neg-lat', bundle);

      const result = validateShapesBundle('bad-neg-lat', TMP_DIR);
      expect(result.issues.some((i) => i.level === 'error' && i.message.includes('lat'))).toBe(
        true,
      );
    });

    it('reports error for lon out of range', () => {
      const bundle = makeValidBundle({
        'test:R1': [
          [
            [35.68, 181.0],
            [35.69, 139.77],
          ],
        ],
      });
      writeBundle('bad-lon', bundle);

      const result = validateShapesBundle('bad-lon', TMP_DIR);
      expect(result.issues.some((i) => i.level === 'error' && i.message.includes('lon'))).toBe(
        true,
      );
    });

    it('accepts valid edge coordinates', () => {
      const bundle = makeValidBundle({
        'test:R1': [
          [
            [-90, -180],
            [90, 180],
          ],
        ],
      });
      writeBundle('edge', bundle);

      const result = validateShapesBundle('edge', TMP_DIR);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('polyline point count', () => {
    it('warns for polyline with fewer than 2 points', () => {
      const bundle = makeValidBundle({
        'test:R1': [[[35.68, 139.76]]],
      });
      writeBundle('single-point', bundle);

      const result = validateShapesBundle('single-point', TMP_DIR);
      expect(result.issues.some((i) => i.level === 'warn' && i.message.includes('1 point'))).toBe(
        true,
      );
    });
  });

  describe('shape_dist_traveled validation', () => {
    it('reports error for negative distance', () => {
      const bundle: ShapesBundle = {
        bundle_version: 2,
        kind: 'shapes',
        shapes: {
          v: 2,
          data: {
            'test:R1': [
              [
                [35.68, 139.76, -1],
                [35.69, 139.77, 100],
              ],
            ],
          },
        },
      };
      writeBundle('neg-dist', bundle);

      const result = validateShapesBundle('neg-dist', TMP_DIR);
      expect(result.issues.some((i) => i.level === 'error' && i.message.includes('negative'))).toBe(
        true,
      );
    });

    it('reports error for non-monotonic distance', () => {
      const bundle: ShapesBundle = {
        bundle_version: 2,
        kind: 'shapes',
        shapes: {
          v: 2,
          data: {
            'test:R1': [
              [
                [35.68, 139.76, 0],
                [35.69, 139.77, 200],
                [35.7, 139.78, 100],
              ],
            ],
          },
        },
      };
      writeBundle('non-mono', bundle);

      const result = validateShapesBundle('non-mono', TMP_DIR);
      expect(
        result.issues.some((i) => i.level === 'error' && i.message.includes('not monotonically')),
      ).toBe(true);
    });

    it('accepts equal consecutive distances (non-decreasing)', () => {
      const bundle: ShapesBundle = {
        bundle_version: 2,
        kind: 'shapes',
        shapes: {
          v: 2,
          data: {
            'test:R1': [
              [
                [35.68, 139.76, 0],
                [35.69, 139.77, 100],
                [35.7, 139.78, 100],
              ],
            ],
          },
        },
      };
      writeBundle('equal-dist', bundle);

      const result = validateShapesBundle('equal-dist', TMP_DIR);
      expect(result.issues).toHaveLength(0);
    });

    it('accepts valid monotonically increasing distances', () => {
      const bundle: ShapesBundle = {
        bundle_version: 2,
        kind: 'shapes',
        shapes: {
          v: 2,
          data: {
            'test:R1': [
              [
                [35.68, 139.76, 0],
                [35.69, 139.77, 100],
                [35.7, 139.78, 250],
              ],
            ],
          },
        },
      };
      writeBundle('valid-dist', bundle);

      const result = validateShapesBundle('valid-dist', TMP_DIR);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('counts', () => {
    it('counts routes, polylines, and points correctly', () => {
      const bundle = makeValidBundle({
        'test:R1': [
          [
            [35.68, 139.76],
            [35.69, 139.77],
          ],
          [
            [35.7, 139.78],
            [35.71, 139.79],
            [35.72, 139.8],
          ],
        ],
        'test:R2': [
          [
            [35.66, 139.74],
            [35.67, 139.75],
          ],
        ],
      });
      writeBundle('counts', bundle);

      const result = validateShapesBundle('counts', TMP_DIR);
      expect(result.routeCount).toBe(2);
      expect(result.polylineCount).toBe(3);
      expect(result.pointCount).toBe(7);
    });
  });

  describe('multiple issues in a single bundle', () => {
    it('detects coordinate error and dist error simultaneously', () => {
      const bundle: ShapesBundle = {
        bundle_version: 2,
        kind: 'shapes',
        shapes: {
          v: 2,
          data: {
            'test:R1': [
              [
                [91.0, 139.76, -5],
                [35.69, 139.77, 100],
              ],
            ],
          },
        },
      };
      writeBundle('multi-issue', bundle);

      const result = validateShapesBundle('multi-issue', TMP_DIR);
      const latError = result.issues.find((i) => i.message.includes('lat'));
      const distError = result.issues.find((i) => i.message.includes('negative'));
      expect(latError).toBeDefined();
      expect(distError).toBeDefined();
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
    });

    it('reports errors in one route while another is valid', () => {
      const bundle: ShapesBundle = {
        bundle_version: 2,
        kind: 'shapes',
        shapes: {
          v: 2,
          data: {
            'test:R1': [
              [
                [35.68, 139.76],
                [35.69, 139.77],
              ],
            ],
            'test:R2': [
              [
                [95.0, 139.76],
                [35.69, 139.77],
              ],
            ],
          },
        },
      };
      writeBundle('mixed-routes', bundle);

      const result = validateShapesBundle('mixed-routes', TMP_DIR);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toContain('test:R2');
      expect(result.issues[0].message).toContain('lat');
    });
  });

  describe('dist resets between polylines', () => {
    it('does not flag dist reset across separate polylines', () => {
      // polyline[0] ends at 300, polyline[1] starts at 0 — this is valid
      // because each polyline represents a separate shape
      const bundle: ShapesBundle = {
        bundle_version: 2,
        kind: 'shapes',
        shapes: {
          v: 2,
          data: {
            'test:R1': [
              [
                [35.68, 139.76, 0],
                [35.69, 139.77, 150],
                [35.7, 139.78, 300],
              ],
              [
                [35.71, 139.79, 0],
                [35.72, 139.8, 100],
              ],
            ],
          },
        },
      };
      writeBundle('dist-reset', bundle);

      const result = validateShapesBundle('dist-reset', TMP_DIR);
      expect(result.issues).toHaveLength(0);
    });
  });
});
