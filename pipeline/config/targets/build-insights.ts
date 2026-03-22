/**
 * Target list for batch v2 InsightsBundle builds.
 *
 * Each entry is a source-name that has a v2 DataBundle (data.json).
 * The insights builder reads calendar data from data.json to produce
 * insights.json. Sources without data.json are skipped at runtime.
 *
 * This list should include all sources from build-v2-data.ts and
 * build-v2-odpt-train-data.ts, since every DataBundle needs an
 * InsightsBundle for validate-v2 to pass.
 *
 * Comment out entries to temporarily skip them.
 */
export default [
  // GTFS sources
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
