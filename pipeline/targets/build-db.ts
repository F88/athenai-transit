/**
 * Target list for batch GTFS DB builds.
 *
 * Each entry is a source-name (filename without .ts extension)
 * from pipeline/resources/gtfs/.
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
];
