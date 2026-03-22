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
  // GTFS sources (data + optional shapes from build-shapes-from-gtfs.ts)
  'toei-bus',
  'suginami-gsm',
  'chiyoda-bus',
  'chuo-bus',
  'kita-bus',
  'kyoto-city-bus',
  'oshima-bus',
  'keisei-transit-bus',

  // KSJ railway shapes (from build-shapes-from-ksj-railway.ts)
  'toei-train',
  'yurikamome',
  'mir-train',
];
