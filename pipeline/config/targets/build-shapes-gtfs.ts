/**
 * Target list for batch GTFS route shape builds.
 *
 * Each entry is a source-name (filename without .ts extension)
 * from pipeline/config/resources/gtfs/ that has shapes.txt data.
 *
 * Sources without shapes.txt (e.g. kanto-bus, keio-bus) are
 * safely skipped by the script, but listing only relevant sources
 * avoids unnecessary DB opens.
 *
 * Comment out entries to temporarily skip them.
 */
export default [
  'toei-bus',
  'suginami-gsm',
  'chiyoda-bus',
  'chuo-bus',
  'kita-bus',
  'kyoto-city-bus',
  'oshima-bus',
  'keisei-transit-bus',
  'nagoya-srt',
];
