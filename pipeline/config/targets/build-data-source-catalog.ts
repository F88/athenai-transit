/**
 * Target list for DataSourceCatalogBundle build.
 *
 * Each entry is a prefix included in the generated
 * `global/data-source-catalog.json` artifact.
 *
 * Kept separate from other target lists so the catalog build can evolve
 * independently if its required source set diverges.
 */
export default [
  'minkuru', // toei-bus
  'toaran', // toei-train
  // 'ktbus', // kanto-bus
  // 'kobus', // keio-bus
  // 'sggsm', // suginami-gsm
  // 'kazag', // chiyoda-bus (community)
  // 'edobus', // chuo-bus (community)
  // 'sbbus', // seibu-bus
  // 'iyt2', // iyotetsu-bus
  // 'kbus', // kita-bus (community)
  // 'kcbus', // kyoto-city-bus
  // 'osmbus', // oshima-bus
  // 'mykbus', // miyake-bus
  // 'kseiw', // keisei-transit-bus
  // 'mir', // mir-train (nippori-toneri liner)
  // 'yurimo', // yurikamome
  // 'nsrt', // nagoya-srt
  // 'tmm', // tama-monorail
  // 'twrr', // twr-rinkai
  // 'vagfr', // vag-freiburg
  // 'actvnav', // actv-nav
  // 'tcship', // tokyo-cruise-ship
  // 'tome', // tokyometro
  // 'ntbus', // nishi-tokyo-bus
  // 'snws', // sanwa-shosen
  // 'tkksn', // tokai-kisen
  // 'kcmb', // kagoshima-maritime-bureau
  // 'oksrif', // okushiri-ferry
  // 'orgfry', // orange-ferry
  // 'uwjmfry', // uwajima-unyu
  // 'mtfry', // meimon-taiyo-ferry
  // 'itkfry', // itsukishima-kisen
  // 'kytbus', // kyoto-bus
  // 'od9bus', // odakyu-bus
  // 'yht', // yokohama-municipal-subway
  // 'yhb', // yokohama-municipal-bus
];
