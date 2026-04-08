/**
 * Target list for validation.
 *
 * Each entry is a prefix (output directory name) under
 * pipeline/workspace/_build/. Used by both v1 and v2 validators.
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
  // 'tkbus', // tokyu-bus (not built)
];
