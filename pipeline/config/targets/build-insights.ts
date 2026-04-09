/**
 * Target list for batch InsightsBundle builds.
 *
 * Each entry is a prefix (output directory name) that has a
 * DataBundle (data.json). The insights builder reads calendar
 * data from data.json to produce insights.json. Prefixes without
 * data.json will cause the batch child process to exit non-zero.
 *
 * Comment out entries to temporarily skip them.
 */
export default [
  'minkuru', // toei-bus
  'toaran', // toei-train
  'ktbus', // kanto-bus
  'kobus', // keio-bus
  'sggsm', // suginami-gsm
  'kazag', // chiyoda-bus
  'edobus', // chuo-bus
  'sbbus', // seibu-bus
  'iyt2', // iyotetsu-bus
  'kbus', // kita-bus
  'kcbus', // kyoto-city-bus
  'osmbus', // oshima-bus
  'mykbus', // miyake-bus
  'kseiw', // keisei-transit-bus
  'mir', // mir-train
  'yurimo', // yurikamome
  'nsrt', // nagoya-srt
  'vagfr', // vag-freiburg
  'actvnav', // actv-nav
];
