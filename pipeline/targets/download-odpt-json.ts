/**
 * Target list for batch ODPT JSON downloads.
 *
 * Each entry is a source-name (filename without .ts extension)
 * from pipeline/resources/odpt-json/.
 *
 * Comment out entries to temporarily skip them.
 */
export default [
  //
  'yurikamome-station',
  'yurikamome-railway',
  'yurikamome-station-timetable',
  // リソース定義最終確認中
  'tokyu-bus-busstop',
  'tokyu-bus-busroute',
  'tokyu-bus-busstop-timetable',
  'tokyu-bus-bus-timetable',
];
