/**
 * Target list for batch KSJ railway shape builds.
 *
 * Each entry is a source-name (outDir) that has mlitShapeMapping
 * defined in its resource definition (GTFS or ODPT JSON).
 *
 * Comment out entries to temporarily skip them.
 */
const REGULAR_TARGETS = [
  'toei-train', // Toei Train
  'yurikamome', // Yurikamome
  'mir-train', // Tsukuba Express
  'tama-monorail', // Tama Monorail
  'twr-rinkai', // TWR Rinkai Line
  'tokyometro', // Tokyo Metro
];

// const ODCPT2026_TARGETS = [
//   // 'odcpt2026-jreast-tokyo-area',
//   // 'odcpt2026-keio-train',
//   // 'odcpt2026-tobu-train',
// ];

const TARGETS = [
  ...REGULAR_TARGETS,
  //
  // ...ODCPT2026_TARGETS,
];

export default TARGETS;
