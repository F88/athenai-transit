/**
 * Types for the ODPT Members Portal API response.
 *
 * API: https://members-portal.odpt.org/api/v1/resources
 * @see https://developer.odpt.org/api_addendum — "メタデータ取得用APIについて"
 *
 * Response structure (from official docs):
 *
 * ```
 * [ // 組織毎のリスト
 *   {
 *     "name_yomi": 組織名ふりがな
 *     "name_ja": 組織名(日本語)
 *     "name_en": 組織名(English)
 *     "url_ja":  URL(日本語)
 *     "url_en":  URL(English)
 *     "label": 組織のラベル
 *     "datasets": [ // データセットのリスト
 *       {
 *         "name_ja": データセット名称(日本語)
 *         "name_en": データセット名称(English)
 *         "explain_ja": 説明(日本語)
 *         "explain_en": 説明(English)
 *         "label": ラベル
 *         "is_gtfsrt": リアルタイム情報(GTFS-RT)の有無(含む:true, 含まない:false)
 *         "license_name_ja": ライセンス名称(日本語)
 *         "license_name_en": ライセンス名称(English)
 *         "license_url_ja": ライセンスURL(日本語)
 *         "license_url_en": ライセンスURL(English)
 *         "license_explain": ライセンス補足説明
 *         "format_type": データ形式
 *         "license_type": ライセンス
 *         "mode_list": [ 交通モードのリスト ]
 *         "dataresource": [ // データリソースのリスト
 *           {
 *             "explain_ja": 説明(日本語)
 *             "explain_en": 説明(English)
 *             "start_at":   適用開始日(YYYY-MM-DD)
 *             "end_at": 公開終了日(YYYY-MM-DD)
 *             "uploaded_at": アップロードされた時刻
 *             "url": エンドポイントURL
 *             "feed_start_date": feed_info.txt の feed_start_date (YYYY-MM-DD)
 *             "feed_end_date": feed_info.txt の feed_end_date (YYYY-MM-DD)
 *             "feed_version": feed_info.txt の feed_version
 *             "is_feed_available_period": feed_start_date ~ feed_end_date の範囲内なら true
 *           }
 *         ]
 *       }
 *     ]
 *   }
 * ]
 * ```
 */

/**
 * Data resource entry from the Members Portal API.
 *
 * Each entry represents one version of a dataset (e.g. one ダイヤ改正).
 * Multiple resources may exist for the same dataset, each with
 * different `start_at` (適用開始日).
 */
export interface OdptDataResource {
  /** 説明 (Japanese). */
  explain_ja: string;
  /** 説明 (English). */
  explain_en: string;
  /** 適用開始日 (ダイヤ改正日). Format: YYYY-MM-DD. */
  start_at: string;
  /** 公開終了日. Format: YYYY-MM-DD, or null if not set. */
  end_at: string | null;
  /** アップロードされた時刻. ISO 8601 with timezone. */
  uploaded_at: string;
  /**
   * エンドポイントURL.
   *
   * Contains `date=YYYYMMDD` query param to identify the resource version.
   * May also contain `acl:consumerKey` for authenticated access.
   * Use `stripAuthParams()` when comparing URLs for identity.
   *
   * Special `date` values (for download, not in this response):
   * - `date=current` — 現在適用されるダイヤ
   * - `date=next` — 次のダイヤ改正データ
   * - `date=latest` — 最新のダイヤ
   */
  url: string;
  /**
   * feed_info.txt の feed_start_date.
   * Format: YYYY-MM-DD, or null if feed_info.txt is absent.
   */
  feed_start_date: string | null;
  /**
   * feed_info.txt の feed_end_date.
   * Format: YYYY-MM-DD, or null if feed_info.txt is absent.
   */
  feed_end_date: string | null;
  /** feed_info.txt に含まれる feed_version. "empty" if feed_info.txt is absent. */
  feed_version: string;
  /**
   * feed_start_date ~ feed_end_date の範囲内なら true.
   * null if feed_info.txt is absent (dates unknown).
   *
   * Note: this is a reference value computed by the API server.
   * Resources with future `start_at` (not yet active) will be false
   * even if the feed period itself is valid. Use `feed_start_date` /
   * `feed_end_date` for independent period evaluation.
   */
  is_feed_available_period: boolean | null;
}

/** Dataset entry containing one or more data resources. */
export interface OdptDataset {
  /** データセット名称 (Japanese). */
  name_ja: string;
  /** データセット名称 (English). */
  name_en: string;
  /** 説明 (Japanese). */
  explain_ja: string;
  /** 説明 (English). */
  explain_en: string;
  /** ラベル (e.g. "AllLines"). */
  label: string;
  /** データ形式 (e.g. "GTFS/GTFS-JP"). */
  format_type: string;
  /** Data resources (one per ダイヤ改正). */
  dataresource: OdptDataResource[];
}

/** Organization entry from the Members Portal API. */
export interface OdptOrganization {
  /** 組織名ふりがな. */
  name_yomi: string;
  /** 組織名 (Japanese). */
  name_ja: string;
  /** 組織名 (English). */
  name_en: string;
  /** URL (Japanese). */
  url_ja: string;
  /** URL (English). */
  url_en: string;
  /** 組織のラベル (e.g. "KantoBus"). */
  label: string;
  /** Datasets provided by this organization. */
  datasets: OdptDataset[];
}
