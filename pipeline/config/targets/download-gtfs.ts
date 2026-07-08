/**
 * Target list for batch GTFS downloads.
 *
 * Each entry is a source-name (filename without .ts extension)
 * from pipeline/config/resources/gtfs/.
 *
 * Comment out entries to temporarily skip them.
 */
export default [
  'toei-bus',
  'toei-train',
  'kanto-bus',
  'keio-bus',
  'suginami-gsm',
  'chiyoda-bus',
  'chuo-bus',
  'seibu-bus',
  'iyotetsu-bus',
  'kita-bus',
  'kyoto-city-bus',
  'oshima-bus',
  'miyake-bus',
  'keisei-transit-bus',
  'mir-train',
  'nagoya-srt',
  'tama-monorail',
  'twr-rinkai',
  'vag-freiburg',
  'actv-nav',
  'tokyo-cruise-ship',
  'tokyometro',
  'nishi-tokyo-bus',
  'sanwa-shosen',
  'tokai-kisen',
  'kagoshima-maritime-bureau',
  'okushiri-ferry',
  'orange-ferry',
  'uwajima-unyu',
  'meimon-taiyo-ferry',
  'itsukishima-kisen',
  'kyoto-bus',
  'odakyu-bus',
  'yokohama-municipal-subway',
  'yokohama-municipal-bus',
  'kawasaki-city-bus',
  'rinko-bus',
  'hachiko-bus',
  'chii-bus',
  'hankyu-ferry',
  'meguro-c-bus',
  'shinagawa-c-bus',
  'ota-c-bus',
  'bunkyo-c-bus',
  'taito-c-bus',
  'itabashi-rin2-bus',
];

// /**
//  * Resources for preliminary research
//  */
// const preliminaryResearchTargets = [
//   'kyoto-city-subway', // (ODPT Challenge 2026)
//   'keio-train', // (ODPT Challenge 2026)
//   'tobu-train', // (ODPT Challenge 2026)
// ];
