/**
 * Target list for v2 bundle validation.
 *
 * Each entry is a source-name (outDir) that produces v2 bundles.
 * The validator checks all available bundle types (DataBundle,
 * ShapesBundle, InsightsBundle) for each source.
 *
 * Comment out entries to temporarily skip them.
 */
export default [
  // GTFS sources (data + insights + optional shapes)
  'toei-bus',
  'toei-train',
  'kanto-bus',
  'keio-bus',
  'suginami-gsm',
  'chiyoda-bus',
  'chuo-bus',
  'seibu-bus',
  'iyotetsu-bus',
  'kita-bus',
  'kyoto-city-bus',
  'oshima-bus',
  'miyake-bus',
  'keisei-transit-bus',
  'mir-train',

  // ODPT sources
  'yurikamome',
];
