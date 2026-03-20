/**
 * Shared path constants for the pipeline.
 *
 * Centralizes all directory references so that restructuring
 * requires changes in this single file only.
 */

import { join, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

/** Pipeline root directory (`pipeline/`). */
export const PIPELINE_ROOT = resolve(import.meta.dirname, '..');

// ---------------------------------------------------------------------------
// Config directories (source definitions, batch targets)
// ---------------------------------------------------------------------------

/** Config root — resource definitions and batch target lists. */
export const CONFIG_DIR = join(PIPELINE_ROOT, 'config');

/** GTFS resource definitions (`config/resources/gtfs/*.ts`). */
export const RESOURCES_DIR = join(CONFIG_DIR, 'resources');

/** Batch target lists (`config/targets/*.ts`). */
export const TARGETS_DIR = join(CONFIG_DIR, 'targets');

// ---------------------------------------------------------------------------
// Workspace directories (pipeline I/O data)
// ---------------------------------------------------------------------------

/** Workspace root — all pipeline I/O data lives here. */
export const WORKSPACE_DIR = join(PIPELINE_ROOT, 'workspace');

/** Downloaded source data (GTFS, ODPT JSON, MLIT GeoJSON). */
export const DATA_DIR = join(WORKSPACE_DIR, 'data');

/** Build output (SQLite DBs, generated JSON). */
export const BUILD_DIR = join(WORKSPACE_DIR, '_build');

/** Timestamped archives of downloaded files. */
export const ARCHIVES_DIR = join(WORKSPACE_DIR, '_archives');

/** Pipeline state (download metadata, check results). */
export const STATE_DIR = join(WORKSPACE_DIR, 'state');

// ---------------------------------------------------------------------------
// Derived paths — workspace
// ---------------------------------------------------------------------------

/** SQLite database directory. */
export const DB_DIR = join(BUILD_DIR, 'db');

/** v1 JSON output directory. */
export const V1_OUTPUT_DIR = join(BUILD_DIR, 'data');

/** v2 JSON output directory. */
export const V2_OUTPUT_DIR = join(BUILD_DIR, 'data-v2');

/** GTFS source data directory. */
export const GTFS_DATA_DIR = join(DATA_DIR, 'gtfs');

/** ODPT JSON source data directory. */
export const ODPT_JSON_DATA_DIR = join(DATA_DIR, 'odpt-json');

/** MLIT GeoJSON file (KSJ railway section data). */
export const MLIT_GEOJSON_PATH = join(DATA_DIR, 'mlit/N02-24_RailroadSection.geojson');
