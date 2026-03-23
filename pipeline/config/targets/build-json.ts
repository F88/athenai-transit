/**
 * Target list for batch GTFS JSON builds.
 *
 * Each entry is a source-name (filename without .ts extension)
 * from pipeline/config/resources/gtfs/.
 *
 * Comment out entries to temporarily skip them.
 */
export default [
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
  'nagoya-srt',
];
