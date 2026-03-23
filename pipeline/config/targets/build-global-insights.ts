/**
 * Target list for GlobalInsightsBundle build.
 *
 * Each entry is a prefix whose DataBundle (data.json) will be loaded
 * and analyzed for cross-source spatial metrics. All prefixes are
 * processed in a single run (not per-source batch).
 */
export default [
  'minkuru', // toei-bus
  'toaran', // toei-train
  'ktbus', // kanto-bus
  'kobus', // keio-bus
  'sggsm', // suginami-gsm
  'kazag', // chiyoda-bus (community)
  'edobus', // chuo-bus (community)
  'sbbus', // seibu-bus
  'iyt2', // iyotetsu-bus
  'kbus', // kita-bus (community)
  'kcbus', // kyoto-city-bus
  'osmbus', // oshima-bus
  'mykbus', // miyake-bus
  'kseiw', // keisei-transit-bus
  'mir', // mir-train (nippori-toneri liner)
  'yurimo', // yurikamome
  'nsrt', // nagoya-srt
];
