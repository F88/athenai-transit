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
  'tmm', // tama-monorail
  'twrr', // twr-rinkai
  'vagfr', // vag-freiburg
  'actvnav', // actv-nav
  'tcship', // tokyo-cruise-ship
  'tome', // tokyometro
  'ntbus', // nishi-tokyo-bus
  'snws', // sanwa-shosen
  'tkksn', // tokai-kisen
  'kcmb', // kagoshima-maritime-bureau
  'oksrif', // okushiri-ferry
  'orgfry', // orange-ferry
  'uwjmfry', // uwajima-unyu
  'mtfry', // meimon-taiyo-ferry
  'itkfry', // itsukishima-kisen
  'kytbus', // kyoto-bus
  'od9bus', // odakyu-bus
  'yht', // yokohama-municipal-subway
  'yhb', // yokohama-municipal-bus
];
