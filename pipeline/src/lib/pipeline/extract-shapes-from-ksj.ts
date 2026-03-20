/**
 * Extract route shapes from MLIT National Land Numerical Information GeoJSON.
 *
 * Shared by both v1 and v2 shapes builders. The output format
 * (`Record<string, [number, number][][]>`) is compatible with
 * {@link ShapePointV2} (`[number, number, number?]`) — the v2 builder
 * can pass it directly to `writeShapesBundle()`.
 *
 * Also provides target discovery ({@link collectAllKsjTargets}) and
 * GeoJSON loading ({@link loadKsjGeoJson}) shared across v1/v2 scripts.
 *
 * @module
 */

import { existsSync, readFileSync } from 'node:fs';

import type { MlitShapeMapping } from '../../types/resource-common';
import { loadAllGtfsSources } from '../resources/load-gtfs-sources';
import { loadAllOdptJsonSources } from '../resources/load-odpt-json-sources';
import { MLIT_GEOJSON_PATH } from '../paths';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeoJsonFeature {
  type: 'Feature';
  properties: {
    N02_001: string; // rail type code
    N02_002: string; // operation type code
    N02_003: string; // line name
    N02_004: string; // operator name
  };
  geometry: {
    type: 'LineString';
    coordinates: [number, number][]; // [lon, lat]
  };
}

export interface GeoJsonCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

/** A target to generate shapes for. */
export interface ShapeTarget {
  /** Source name (outDir), used as CLI argument. */
  name: string;
  prefix: string;
  nameEn: string;
  mapping: MlitShapeMapping;
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

/**
 * Generate shapes for a single target from GeoJSON features.
 *
 * Filters features by operator name, maps line names to route IDs,
 * and converts [lon, lat] coordinates to [lat, lon] with 5-decimal
 * precision.
 *
 * @param target - Shape generation target with operator/line mapping.
 * @param geojson - Full GeoJSON feature collection (MLIT railway data).
 * @returns Mapping of route_id to arrays of polylines.
 */
export function buildShapesForTarget(
  target: ShapeTarget,
  geojson: GeoJsonCollection,
): Record<string, [number, number][][]> {
  const { operator, lineToRouteId } = target.mapping;

  // Filter by operator
  const features = geojson.features.filter((f) => f.properties.N02_004 === operator);
  console.log(`  ${features.length} features for operator "${operator}"`);

  // Group by route and convert coordinates
  const shapes: Record<string, [number, number][][]> = {};
  const unmapped = new Set<string>();

  for (const feature of features) {
    const lineName = feature.properties.N02_003;
    const routeId = lineToRouteId[lineName];

    if (!routeId) {
      unmapped.add(lineName);
      continue;
    }

    // Convert [lon, lat] -> [lat, lon] with 5 decimal precision
    const polyline: [number, number][] = feature.geometry.coordinates.map(([lon, lat]) => [
      Math.round(lat * 1e5) / 1e5,
      Math.round(lon * 1e5) / 1e5,
    ]);

    if (!shapes[routeId]) {
      shapes[routeId] = [];
    }
    shapes[routeId].push(polyline);
  }

  if (unmapped.size > 0) {
    console.warn(`  WARN: Unmapped lines: ${[...unmapped].join(', ')}`);
  }

  return shapes;
}

// ---------------------------------------------------------------------------
// Target discovery
// ---------------------------------------------------------------------------

/**
 * Collect all mlitShapeMapping targets from GTFS and ODPT JSON resources.
 *
 * Deduplicates by outDir — multiple ODPT resources may share the same
 * prefix, so only the first encountered entry is kept.
 */
export async function collectAllKsjTargets(): Promise<ShapeTarget[]> {
  const targetMap = new Map<string, ShapeTarget>();

  const gtfsSources = await loadAllGtfsSources();
  for (const source of gtfsSources) {
    if (source.resource.mlitShapeMapping) {
      targetMap.set(source.pipeline.outDir, {
        name: source.pipeline.outDir,
        prefix: source.pipeline.prefix,
        nameEn: source.resource.nameEn,
        mapping: source.resource.mlitShapeMapping,
      });
    }
  }

  const odptSources = await loadAllOdptJsonSources();
  for (const source of odptSources) {
    if (source.resource.mlitShapeMapping && !targetMap.has(source.pipeline.outDir)) {
      targetMap.set(source.pipeline.outDir, {
        name: source.pipeline.outDir,
        prefix: source.pipeline.prefix,
        nameEn: source.resource.nameEn,
        mapping: source.resource.mlitShapeMapping,
      });
    }
  }

  return [...targetMap.values()];
}

// ---------------------------------------------------------------------------
// GeoJSON loading
// ---------------------------------------------------------------------------

let cachedGeoJson: GeoJsonCollection | null = null;

/**
 * Load the MLIT GeoJSON railway section file.
 *
 * The result is cached in module scope so that batch-mode callers
 * (which process multiple targets in the same process) only read
 * the file once.
 */
export function loadKsjGeoJson(): GeoJsonCollection {
  if (cachedGeoJson) {
    return cachedGeoJson;
  }

  if (!existsSync(MLIT_GEOJSON_PATH)) {
    throw new Error(`GeoJSON file not found: ${MLIT_GEOJSON_PATH}`);
  }

  console.log(`Reading ${MLIT_GEOJSON_PATH}...`);
  const raw = readFileSync(MLIT_GEOJSON_PATH, 'utf-8');
  cachedGeoJson = JSON.parse(raw) as GeoJsonCollection;
  console.log(`  ${cachedGeoJson.features.length} total features\n`);
  return cachedGeoJson;
}
