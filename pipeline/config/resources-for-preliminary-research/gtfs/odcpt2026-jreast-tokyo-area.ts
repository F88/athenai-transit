import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const jreastTokyoArea: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'JR East',
    nameJa: 'JR東日本',
    description:
      'GTFS static data for a portion of JR East conventional lines in the Kanto area (train), operated by East Japan Railway Company',
    // No GTFS-JP extension files (*_jp.txt) are present in this feed, so it is
    // plain GTFS despite the CKAN dataset being labelled "GTFS/GTFS-JP".
    // Multilingual names are provided via translations.txt (ja/en).
    dataFormat: { type: 'GTFS' },
    license: {
      name: '公共交通オープンデータチャレンジ限定ライセンス',
      url: 'https://developer.odpt.org/challenge_license',
    },
    notes: [
      'Preliminary survey only',
      'Provided under the Public Transport Open Data Challenge Limited License.',
      'Served from api-challenge.odpt.org, not the regular ODPT host.',
      "Requires the Challenge 2026 access token (credential 'odpt-challenge-2026'), not ODPT_ACCESS_TOKEN.",
      'Coverage is a partial subset of JR East conventional lines in Tokyo, Kanagawa, Saitama, Chiba and surroundings. Shinkansen is excluded.',
      'Joban Line: only the section south of Sakamoto. Chuo Line: only the section east of Takao.',
      'Joetsu Line and Agatsuma Line: limited express trains only. Limited express trains of the Chuo Line and Ome Line are excluded.',
      'Some extra/seasonal trains and through-services to other lines may be excluded.',
      'JR East-specific Terms of Use apply in addition to the Challenge Limited License:',
      '  (1) Do not use outputs derived from JR East data to develop or improve services that compete with services provided by JR East.',
      '  (2) If filing a patent/design based on the data, notify the council of the case name and application number.',
      '  (3) Do not exercise IP rights arising from the data against JR East.',
      '  (4) The above survive after the contest ends.',
    ],
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/jreast',
      datasetUrl: 'https://ckan.odpt.org/dataset/jreast_tokyo_area',
      resourceUrl:
        'https://ckan.odpt.org/dataset/jreast_tokyo_area/resource/a6f842e9-e053-4be5-a926-87d0b49753d3',
      resourceId: 'a6f842e9-e053-4be5-a926-87d0b49753d3',
    },
    provider: {
      name: {
        ja: { long: '東日本旅客鉄道株式会社', short: 'JR東日本' },
        en: { long: 'East Japan Railway Company', short: 'JR East' },
      },
      url: 'https://www.jreast.co.jp/',
      colors: [{ bg: '00B258', text: 'FFFFFF' } /* JR East corporate green */],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
      credential: 'odpt-challenge-2026',
    },
    /** GtfsResource */
    routeTypes: ['rail'],
    // No shapes.txt in this feed. Route shapes are generated from MLIT/KSJ
    // railway data (operator "東日本旅客鉄道"). KSJ maps one physical line name
    // (N02_003) to a single route, so service patterns that share a physical
    // line, or that span multiple lines, cannot be mapped and are left
    // commented out below. NOTE: KSJ returns the full physical line geometry,
    // so trunk lines (東北線/東海道線/上越線/常磐線 etc.) extend well beyond this
    // feed's Kanto-area coverage.
    mlitShapeMapping: {
      operator: '東日本旅客鉄道',
      lineToRouteId: {
        吾妻線: 'jret:10',
        中央線: 'jret:11', // 中央線快速
        八高線: 'jret:13',
        伊東線: 'jret:14',
        五日市線: 'jret:15',
        常磐線: 'jret:16',
        上越線: 'jret:19',
        鹿島線: 'jret:20',
        川越線: 'jret:21', // 川越線(川越-高麗川間)
        根岸線: 'jret:22', // 京浜東北線・根岸線 -- 根岸線 portion only
        京葉線: 'jret:23',
        久留里線: 'jret:24',
        武蔵野線: 'jret:25',
        南武線: 'jret:26',
        成田線: 'jret:27',
        青梅線: 'jret:28',
        相模線: 'jret:29',
        赤羽線: 'jret:30', // 埼京線・川越線 -- 赤羽線 portion only
        総武線: 'jret:32', // 総武本線
        外房線: 'jret:35',
        高崎線: 'jret:36',
        東金線: 'jret:37',
        東海道線: 'jret:38',
        鶴見線: 'jret:39',
        内房線: 'jret:40',
        東北線: 'jret:41', // 宇都宮線 (= 東北線 nickname)
        山手線: 'jret:42',
        横浜線: 'jret:43',
        横須賀線: 'jret:44',
        // -- Unmapped: no single KSJ line, or the physical line is already
        // -- assigned to another route (KSJ line -> one route only). --
        // 常磐線: 'jret:17', // 常磐線各駅停車 -- physical 常磐線 already -> jret:16
        // 常磐線: 'jret:18', // 常磐線快速 -- physical 常磐線 already -> jret:16
        // 総武線: 'jret:33', // 総武快速線 -- physical 総武線 already -> jret:32
        // jret:12 中央・総武各駅停車 -- spans 中央線+総武線 (both already mapped)
        // jret:31 湘南新宿ライン -- spans multiple lines incl. freight; no single KSJ line
        // jret:34 相鉄直通線 -- through-service to Sotetsu via freight lines; no single KSJ line
      },
    },
    downloadUrl: 'https://api-challenge.odpt.org/api/v4/files/JR-East/data/JR-East-Train-GTFS.zip',
    /**
     * Forward-looking metadata for future extensions (per-URL validity,
     * multiple versions across timetable revisions, deferred availability).
     * Not consumed by the pipeline or the app yet; retained as data only.
     */
    dataUrls: [
      {
        url: 'https://api-challenge.odpt.org/api/v4/files/JR-East/data/JR-East-Train-GTFS.zip',
        validity: { from: '2026-03-14', until: '2027-03-12' },
        notes: ['Available only during the Public Transport Open Data Challenge 2026.'],
      },
    ],
  },
  pipeline: {
    outDir: 'odcpt2026-jreast-tokyo-area',
    prefix: 'jret',
  },
};

export default jreastTokyoArea;
