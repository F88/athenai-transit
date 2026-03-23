/**
 * Target list for GlobalInsightsBundle build.
 *
 * Each entry is a prefix whose DataBundle (data.json) will be loaded
 * and analyzed for cross-source spatial metrics. All prefixes are
 * processed in a single run (not per-source batch).
 *
 * Large sources are commented out to keep computation time manageable.
 * Add them back as spatial indexing or performance improvements are
 * implemented.
 */
export default [
  'minkuru', // toei-bus
  'toaran', // toei-train
  // 'ktbus', // kanto-bus (1,326 stops — large)
  // 'kobus', // keio-bus (2,988 stops — large)
  'sggsm', // suginami-gsm
  'kazag', // chiyoda-bus (community)
  'edobus', // chuo-bus (community)
  // 'sbbus', // seibu-bus (4,125 stops — large)
  // 'iyt2', // iyotetsu-bus (1,094 stops — large)
  'kbus', // kita-bus (community)
  // 'kcbus', // kyoto-city-bus (1,677 stops — large)
  'osmbus', // oshima-bus
  'mykbus', // miyake-bus
  'kseiw', // keisei-transit-bus
  'mir', // mir-train (nippori-toneri liner)
  'yurimo', // yurikamome
];
