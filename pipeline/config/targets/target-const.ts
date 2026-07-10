const CONFIG_GTFS_FERRY_TARGETS = [
  'actv-nav', // ACTV Navigazione
  'hankyu-ferry', // Hankyu Ferry
  'itsukishima-kisen', // Itsukishima Kisen
  'kagoshima-maritime-bureau', // Sakurajima Ferry
  'meimon-taiyo-ferry', // Meimon Taiyo Ferry
  'okushiri-ferry', // Okushiri Island Ferry
  'orange-ferry', // Orange Ferry
  'sanwa-shosen', // Sanwa Shosen
  'tokai-kisen', // Tokai Kisen
  'tokyo-cruise-ship', // Tokyo Cruise Ship
  'uwajima-unyu', // Uwajima Unyu Ferries
];

/**
 * Data size: Many large-sized data
 */
const CONFIG_GTFS_BUS_TARGETS = [
  'bunkyo-c-bus', // Bunkyo Community Bus (B-GURU)
  'chii-bus', // Chii Bus (Minato Community Bus)
  'chiyoda-bus', // Kazaguruma (Chiyoda Community Bus)
  'chuo-bus', // Edo Bus (Chuo City Community Bus)
  'hachiko-bus', // Hachiko Bus (Shibuya City community bus)
  'itabashi-rin2-bus', // Rinrin-GO (Itabashi City community bus)
  'iyotetsu-bus', // Iyotetsu Bus
  'kanto-bus', // Kanto Bus
  'kawasaki-city-bus', // Kawasaki City Bus
  'keio-bus', // Keio Bus
  'keisei-transit-bus', // Keisei Transit Bus (Chiba West)
  'kita-bus', // Kita City Community Bus K-bus
  'kyoto-bus', // Kyoto Bus
  'kyoto-city-bus', // Kyoto City Bus
  'meguro-c-bus', // Meguro City Community Bus
  'miyake-bus', // Miyake Village Bus
  'nagoya-srt', // Nagoya SRT
  'nishi-tokyo-bus', // Nishi Tokyo Bus
  'odakyu-bus', // Odakyu Bus
  'oshima-bus', // Oshima Bus
  'ota-c-bus', // Ota City Community Bus
  'rinko-bus', // Kawasaki Tsurumi Rinko Bus
  'seibu-bus', // Seibu Bus
  'shinagawa-c-bus', // Shinagawa City Community Bus
  'suginami-gsm', // Suginami City Green Slow Mobility
  'taito-c-bus', // Taito City Circular Route Bus "Megurin"
  'toei-bus', // Toei Bus
  'vag-freiburg', // VAG Freiburg
  'yokohama-municipal-bus', // Yokohama Municipal Bus
];

export const CONFIG_GTFS_ALL_TARGETS = [
  'mir-train', // Tsukuba Express
  'tama-monorail', // Tama Monorail
  'toei-train', // Toei Train
  'tokyometro', // Tokyo Metro
  'twr-rinkai', // TWR Rinkai Line
  'yokohama-municipal-subway', // Yokohama Municipal Subway
  ...CONFIG_GTFS_FERRY_TARGETS,
  ...CONFIG_GTFS_BUS_TARGETS,
];

const PREFIX_FERRY_TARGETS = [
  'actvnav', // ACTV Navigazione
  'han9fry', // Hankyu Ferry
  'itkfry', // Itsukishima Kisen
  'kcmb', // Sakurajima Ferry
  'mtfry', // Meimon Taiyo Ferry
  'oksrif', // Okushiri Island Ferry
  'orgfry', // Orange Ferry
  'snws', // Sanwa Shosen
  'tkksn', // Tokai Kisen
  'tcship', // Tokyo Cruise Ship
  'uwjmfry', // Uwajima Unyu Ferries
];

/**
 * Data size: Many large-sized data
 */
const PREFIX_BUS_TARGETS = [
  'bgle', // Bunkyo Community Bus (B-GURU)
  '13103b', // Chii Bus (Minato Community Bus)
  'kazag', // Kazaguruma (Chiyoda Community Bus)
  'edobus', // Edo Bus (Chuo City Community Bus)
  '85b', // Hachiko Bus (Shibuya City community bus)
  'rin2', // Rinrin-GO (Itabashi City community bus)
  'iyt2', // Iyotetsu Bus
  'ktbus', // Kanto Bus
  'norufin', // Kawasaki City Bus
  'kobus', // Keio Bus
  'kseiw', // Keisei Transit Bus (Chiba West)
  'kbus', // Kita City Community Bus K-bus
  'kytbus', // Kyoto Bus
  'kcbus', // Kyoto City Bus
  'sanma', // Meguro City Community Bus
  'mykbus', // Miyake Village Bus
  'nsrt', // Nagoya SRT
  'ntbus', // Nishi Tokyo Bus
  'od9bus', // Odakyu Bus
  'osmbus', // Oshima Bus
  'tamachan', // Ota City Community Bus
  'rintan', // Kawasaki Tsurumi Rinko Bus
  'sbbus', // Seibu Bus
  'shinabus', // Shinagawa City Community Bus
  'sggsm', // Suginami City Green Slow Mobility
  'megurin', // Taito City Circular Route Bus "Megurin"
  'minkuru', // Toei Bus
  'vagfr', // VAG Freiburg
  'yhb', // Yokohama Municipal Bus
];

export const PREFIX_ALL_TARGETS = [
  'mir', // Tsukuba Express
  'tmm', // Tama Monorail
  'toaran', // Toei Train
  'tome', // Tokyo Metro
  'twrr', // TWR Rinkai Line
  'yht', // Yokohama Municipal Subway
  'yurimo', // Yurikamome // Note: Yurikamome is not GTFS but ODPT-Train
  ...PREFIX_FERRY_TARGETS,
  ...PREFIX_BUS_TARGETS,
];

// /**
//  * Resources for preliminary research
//  */
// const preliminaryResearchTargets = [
//   'kcsub', // kyoto-city-subway (ODPT Challenge 2026)
//   'kotr', // keio-train (ODPT Challenge 2026)
//   'tobutr', // tobu-train (ODPT Challenge 2026)
// ];
