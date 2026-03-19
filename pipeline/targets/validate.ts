/**
 * Target list for validation.
 *
 * Each entry is a prefix (output directory name) under pipeline/build/data/.
 * Only prefixes listed here are validated by `npm run pipeline:validate`.
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
  'tkbus', // tokyo-bus
];
