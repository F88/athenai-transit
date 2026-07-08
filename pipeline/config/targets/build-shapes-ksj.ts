/**
 * Target list for batch KSJ railway shape builds.
 *
 * Each entry is a source-name (outDir) that has mlitShapeMapping
 * defined in its resource definition (GTFS or ODPT JSON).
 *
 * Comment out entries to temporarily skip them.
 */
export default [
  //
  'toei-train',
  'yurikamome',
  'mir-train',
  'tama-monorail',
  'twr-rinkai',
  'tokyometro',
];

// /**
//  * Resources for preliminary research
//  */
// const preliminaryResearchTargets = [
//   'keio-train', // (ODPT Challenge 2026)
//   'tobu-train', // (ODPT Challenge 2026)
// ];
