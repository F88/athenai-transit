# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [CalVer](https://calver.org/).

## [Unreleased]

### Added

- 近くののりばに方角を表示するようにした。DistanceBadge に三角形の方角インジケーターを追加。
- StopInfo コンポーネントを NearbyStop から抽出。停留所の識別情報 (名前、路線種別、距離、事業者) を担当。
- Verbose パターン: `<details>/<summary>` による折りたたみ式デバッグダンプ。Badge (Route, Agency, Headsign) と StopInfo に統一的に適用。
    - `src/components/verbose/` に dump コンポーネントを集約。
    - 生データ dump と resolver 結果 dump を分離 (例: VerboseRoute + VerboseRouteDisplayNames)。
    - summary ラベルで識別 (`[Route]`, `[Agency]`, `[Headsign]`, `[StopData]`, `[Metrics]`)。
    - `disableVerbose` prop で非インタラクティブなコンテキスト (tooltip) での verbose 抑制。
- StopInfo に `wheelchair_boarding` 表示 (Accessibility アイコン、1=青, 2=グレーアウト)。
- StopInfo に `platform_code` 表示 (amber バッジ、枠線付き)。
- StopMetrics コンポーネント: stats/geo の指標を info level に応じて表示。
    - normal+: freq (CalendarDays), connectivity (Waypoints)
    - detailed+: nearestRoute (Milestone/teal)
    - verbose: walkablePortal (Milestone/purple) + 全フィールド dump
- RouteBadge で路線表示 (StopInfo の routes plain text を置き換え)。
- `formatRouteLabel` から verbose 固有の `[shortName|longName]` 出力を除去 (VerboseRoute が担当)。
- Badge ルート要素に `font-normal` リセット。親の font 設定に依存しない統一スタイル。
- IdBadge に `font-normal` を追加。配置場所による太さの不一致を解消。
- Storybook: RouteBadge, HeadsignBadge, StopMetrics の stories を追加。AgencyBadge stories を簡素化。
- MockRepository に `wheelchair_boarding`, `platform_code` テストデータを追加。

### Fixed

- Canvas mode (lightweight) の選択時 stop tooltip がダークモード未対応だった問題を修正。`L.popup` から `L.tooltip` に統一し、DOM mode とレイアウト・テーマを一致させた。

## [2026.03.28]

### Added

- Portal / Anchor 機能: お気に入り Stop (Anchor) を登録し、Portal ドロップダウンから即座に移動できる機能。
    - Portal ドロップダウン: 画面上部に履歴と並列表示。Lucide `DoorOpen` アイコン (pink)。
    - NearbyStop カードに Anchor トグルボタン (Lucide `Signpost`)。
    - 時刻表ボタンを Lucide `Clock` アイコンに変更。
    - エラー通知: sonner トーストで Anchor 操作エラーを表示。
    - `AnchorEntry` 軽量参照モデル (stopId, stopName, stopLat, stopLon, routeTypes, createdAt, portal?)。
    - `portal?` フィールドで将来的なグループ分類に対応。
    - `UserDataRepository` インターフェース + `LocalStorageUserDataRepository` 実装。async `Result<T>` API で Web API 移行に備えた設計。
    - `useAnchors(repo)` hook: repo 注入パターン。`lastError`/`clearError` によるエラー状態管理。
    - ドメインロジック: `addAnchor`, `removeAnchor`, `updateAnchor`, `isAnchor`, `buildAnchorRefreshUpdates` (純関数)。
    - `batchUpdateAnchors`: 複数 Anchor を1回の永続化で一括更新。

### Changed

- StopHistory / Portal ドロップダウンをテーマ対応 (light: 白背景, dark: 黒背景)。
- StopHistory の未選択時アイコンを Lucide `History` (sky) に変更。
- StopHistory の絶対配置を親 flex コンテナに委譲し、Portal と並列配置可能に。
- StopHistory の最大幅を `max-w-[50dvw]` に調整。
- SelectContent の z-index を `z-1002` に設定 (地図オーバーレイより前面)。
- DEVELOPMENT.md の z-index 階層表を更新。
- import 順序を ES module 規約に準拠 (app.tsx)。

## [2026.03.27]

### Added

- `?stop=` クエリパラメータで初期選択 stop を指定可能。
- Route Stops Layer: 路線選択時に路線上の全停留所を表示。nearby/far layer より描画優先度が高い。路線図データが無い路線でも実際の走行区間を可視化可能。
- `useRouteStops` hook で停留所の路線別フィルタリング。
- `disableDimming` prop で selected stop による dimming を制御。Route Stops Layer では stop 選択時も全停留所が通常表示される。

### Fixed

- StopMarkersCanvas: Tooltip lazy generation で incremental marker update を最適化。map panning 時のマーカー更新を 99.8% 削減 (700-850ms → 2-6ms @941 stops)。

### Changed

- BottomSheet を BottomSheetHeader / BottomSheetStops に分割。
- ボトムシートのヘッダーに nearby 半径を表示 (例: `1km圏内`)。
- 初回データ取得完了前に「近くに乗り場がありません」が一瞬表示される問題を修正。
- `NearbyStopsCounts` (total/active/filtered) を導入し、件数情報を統合。
- `DataConfig` を BottomSheet に props で渡す設計に変更。
- `getUpcomingTimetableEntries` のログレベルを verbose に変更。
- ESLint: `_` プレフィックス付きの未使用変数を許可。

### Optimized

- Repository: `stopsMetaMap` を導入し、stop metadata の O(n) lookup → O(1) lookup に改善。
- Repository: `getStopsForRoutes()` で lazy-initialized reverse map (route_id → Set<stop_id>) を実装。複数ルートの停留所解決が高速化。
- Repository: `getStopsInBounds()` / `getStopsNearby()` で pre-built `stopsMetaMap` を活用し、per-query assembly を廃止。

## [2026.03.26]

### Added

- `ContextualTimetableEntry` 型を導入 (Issue #66):
    - `WithServiceDate`: サービス日の文脈を持つ独立 interface (`readonly serviceDate`)。
    - `ContextualTimetableEntry`: `TimetableEntry` + `WithServiceDate` の合成型。
    - `UpcomingTimetableResult`: `getUpcomingTimetableEntries` 専用の Result 型。
    - overnight 便 (前日サービスの深夜便) の日時表示が1日ずれる問題を修正。
    - repo が `serviceDate` を付与し、Date ベースでソート (時系列順保証)。
    - UI は `entry.serviceDate` で `minutesToDate` を呼出 (serviceDay props 廃止)。
    - verbose 出力に `sd=` (サービス日)、repo ログに `serviceDay=`/`prev=` を追加。
    - `minutesToDate` テスト拡充 (境界値、overnight、月跨ぎ)。
- 時刻表モーダルを `TimetableEntry` ベースに移行:
    - 終点では到着時刻 (`arrivalMinutes`) を `nn着` と表示。
    - 終点/始発/乗車不可/降車不可ラベルを InfoLevel に応じて表示。
    - verbose: 全データダンプ (`VerboseEntryRow`, `VerboseMetadata`)。
    - 降車専用バス停の検出と表示 (`canBoard`, `omitted.terminal`)。
    - 路線フィルタと `TimetableMetadata` の連動。
- simple/normal で終点到着便を非表示 (乗車可能な便のみ表示)。
- 無効クエリパラメータの自動クリーンアップ (`cleanupInvalidQueryParams`)。
- MockRepository: 降車専用バス停、dwell time 路線、停車順序データ追加。
- `InfoLevelFlags.isSimpleEnabled` 追加。
- リソースチェックに `NEWER_AVAILABLE` warning を追加:
    - ローカルより新しい `feed_start_date` のリモートリソースを毎回検知。
    - `NEW_RESOURCE` (初回のみ) と異なり、適用されるまで常に表示。

### Removed

- v1 Repository および関連コード (v2 完全移行):
    - `AthenaiRepository`, v1 DataSource, `flatten-departures`。
    - `DepartureGroup`, `FlatDeparture`, `FullDayStopDeparture` 型。
    - `getFullDayDepartures` (旧 `number[]` API)。
    - `StopTimetableDeparture` 型 (`TimetableEntry` に統合)。
    - `RepoParam` から `'v1'` 削除。
- v1 pipeline を CI / npm scripts / ドキュメントから除去:
    - CI (`update-transit-data.yml`): v1 build / validate / Slack 通知を削除。
    - npm scripts: `pipeline:build:json`, `pipeline:build:odpt-train`, `pipeline:build:shapes:gtfs`, `pipeline:build:shapes:ksj`, `pipeline:validate` を削除。
    - `scripts/copy-pipeline-data.ts`: v1 sync ターゲット削除。
    - `public/data/` (v1 データ 28MB) を削除。
    - v1 ドキュメントを `pipeline/docs/v1-archive/` に移動。
    - v1 スクリプト (`pipeline/scripts/pipeline/app-data-v1/`) は参考用に残存。

### Fixed

- overnight 便 (前日サービスの 24:00+ 出発) の相対時刻・絶対時刻が1日ずれる問題 (#66):
    - NearbyStop、マーカー tooltip の両方で発生。
    - 影響: 伊予鉄バス (iyt2) 等の 27:00+ の便、03:00〜09:03 の時間帯。
- 多路線バス停で時刻表ダイアログ幅が不足しフィルタボタンが見切れる問題。

### Changed

- 時刻表ダイアログ幅: 固定 480px → `90dvw`。

## [2026.03.23]

### Added

- `data:sync` に v2 データ sync を追加 (`_build/data-v2/` → `public/data-v2/`)。
- CatalogOdpt スキーマを拡張 (`organizationUrl`, `datasetUrl`, `resourceUrl`, `resourceId`)。
- Pipeline ベンチマーク記録 (`PIPELINE-BENCHMARKS.md`)。
- SRT名古屋 (Smart Roadway Transit) データソース追加:
    - 名駅-栄間の循環バス路線 (1路線、7停留所、12便/日)。
    - CC BY 4.0、shapes.txt あり、translations 5言語。
    - HOME_LOCATIONS に名古屋、松山を追加。
- v2 GlobalInsightsBundle validator (`pipeline:validate:v2` Step 4):
    - global/insights.json の構造検証 (bundle_version, kind, stopGeo section)。
    - stopGeo エントリの spot-check (nr が number であること)。
    - stopGeo セクション不在時の warning。
- v2 GlobalInsightsBundle builder (`pipeline:build:v2-global-insights`):
    - stopGeo: per-stop 孤立度 (nr)、乗り換えポイント (wp)、connectivity (cn)。
    - connectivity: 300m 圏内のユニークルート数 (rc)、便数合計 (freq)、停留所数 (sc)。
    - 日曜/祝日ダイヤ (ho) 基準。全ソース横断の空間分析。
    - l=0 direct compute, l=1 parent 導出 (nr/wp=min, cn=direct)。
    - single-pass 全探索で 15,798 stops を 9.2秒で処理。
- v2 InsightsBundle builder (`pipeline:build:v2-insights`):
    - DataBundle の calendar セクションから曜日パターンで service groups を導出。
    - 既知パターン (wd/sa/su/wk/all) は短縮キー、未知パターンはビット列キーを生成。
    - 優先度順ソート (平日 → 土曜 → 日曜 → 週末 → 毎日 → その他)。
    - tripPatternGeo: パターンの地理的メトリクス (直線距離、経路距離、循環判定)。Haversine 距離で計算。
    - tripPatternStats: パターンの運行統計 (service group 別の頻度、各停留所からの残り所要時間)。
    - stopStats: 停留所の運行統計 (service group 別の頻度、路線数、route type 数、最早/最終出発時刻)。
- v2 ShapesBundle builders for GTFS and KSJ railway:
    - `pipeline/scripts/pipeline/app-data-v2/` に v2 shapes パイプラインを新規実装。
    - GTFS shapes.txt と国土数値情報 (KSJ) 鉄道路線の両データソースに対応。
    - `ShapesBundle` (`bundle_version: 2, kind: 'shapes'`) でラッパー付き出力。
    - `shape_dist_traveled` 対応 (v2 のみ。v1 は `stripShapeDistance` で除去)。
    - 抽出ロジックを `src/lib/pipeline/` に共有関数として集約。v1/v2 両方から利用。
- v2 DataBundle builders for GTFS and ODPT Train (#31):
    - `pipeline/scripts/pipeline/app-data-v2/` に v2 フォーマットの JSON バンドル生成パイプラインを新規実装。
    - GTFS (SQLite) と ODPT Train (JSON) の両データソースに対応。
    - `DataBundle` (stops, routes, timetable, tripPatterns, lookup, calendar, agency, feedInfo, translations) を1ファイルに統合出力。
    - 166 テストで品質担保。

### Fixed

- ODPT v1 builder が `odpt:destinationStation` を無視し、短距離折返し便 (有明行き等) が終点行きに混入する問題を修正 (#32)
- ODPT 深夜便の `00:xx` が `24:xx` に変換されず、時刻表で0時台に誤表示される問題を修正 (#34)
- ODPT ソースで平日の祝日に平日ダイヤが表示される問題を修正 (#36):
    - pipeline で日本の祝日 calendar_dates を自動生成。WebApp 変更不要。
    - calendar 有効期間を issued + 1年 → 2年に延長。
- `validate-app-data.ts`: 期限切れサービスを error から warning に変更。CI のデータ更新がブロックされる問題を修正 (#26)
- 京都市バスの CKAN resourceId と downloadUrl を最新版に更新 (date=20260309 → 20260323)。

### Changed

- pipeline/ ディレクトリ再構成 (#39, #40, #41, #42):
    - I/O データを `workspace/` に集約 (data/, state/, \_build/, \_archives/)
    - ソース定義とバッチ対象を `config/` に集約 (resources/, targets/)
    - 内部コード (lib/, types/) を `src/` に集約。entry point (scripts/) は直下に維持
    - `pipeline/src/lib/paths.ts` にパス定数を一元管理
    - `_` prefix で git 管理外ディレクトリを視覚的に分離
    - `scripts/` を `pipeline/` (CI/運用) と `dev/` (開発/調査) に分離
    - v1→v2 逆依存を解消。共有 utils を `src/lib/` に抽出
    - `src/lib/` をサブディレクトリで整理 (`pipeline/`, `download/`, `resources/`)
    - v2 builder lib を `src/lib/pipeline/app-data-v2/` に移動。scripts は thin entry point に
    - `app-data/` → `app-data-v1/` にリネーム (v1/v2 対称化)
    - ファイル名を自明に改名 (csv-utils → gtfs-csv-parser 等)

## [2026.03.18]

### Added

- 8つの新データソースを追加:
    - 🚈 つくばエクスプレス (首都圏新都市鉄道)
    - 🚌 西武バス
    - 🚌 京都市営バス
    - 🚌 伊予鉄バス
    - 🚌 京成バス千葉ウエスト
    - 🚌 大島バス (伊豆大島)
    - 🚌 三宅村営バス (三宅島)
    - 🚌 Kバス (北区コミュニティバス)
- Slack 通知 (composite action):
    - `.github/actions/slack-notify/` で Slack 通知を共通化。success / warning / failure / cancelled の4状態に対応。
    - `update-transit-data.yml`, `check-transit-resources.yml` の両ワークフローに統合。
    - 部分失敗や attention-level 警告を warning として通知。
- `check-odpt-resources.ts` に Result Summary セクションを追加:
    - `[RESULT:WARN]` / `[RESULT:ERROR]` 行でソース名付きの警告を出力。CI の Slack 通知で消費。

## [2026.03.17]

### Added

- ODPT リソース更新チェックツール (`npm run pipeline:check:odpt-resources`):
    - ODPT Members Portal API でリソースの有効期限、新規追加、削除を検知。
    - ダウンロードジョブ結果を `pipeline/state/download-meta/` に記録。
    - チェック結果スナップショットを `pipeline/state/check-result/` に保存 (result, warnings, errors 付き)。差分で新リソースを検知。
    - 警告レベル: EXPIRED/REMOVED/NO_VALID_DATA (exit 1), EXPIRING_SOON/NEW_RESOURCE/NO_DOWNLOAD_REPORT (exit 2)。
    - GitHub Actions `check-transit-resources.yml` で daily 自動実行 (UTC 05:00)。
- ソースメタデータ (`SourceMeta`):
    - `TransitRepository.getAllSourceMeta()` でソースごとの有効期間、バージョン、名前、routeTypes、統計情報を取得可能に。
    - 初期化ログにソースメタデータのサマリーを出力。
- ランダム初期表示位置:
    - 10箇所のプリセットからランダムに初期表示位置を選択 (場所ごとの zoom level 付き)。
    - サイコロボタン (🎲) で別のランダムな場所にジャンプ。
    - HOME ボタンは非表示 (将来の USER HOME 機能用にコード保持)。
- URL query params による初期位置指定:
    - `?lat=35.68&lng=139.77&zm=15` で初期表示位置を URL で指定可能。
    - 優先順位: query params > env variables > ランダム選択。
    - `VITE_INITIAL_ZOOM_LEVEL` env 変数を新規追加。
- query params の一元管理:
    - `src/utils/query-params.ts` に safe parsers を集約 (範囲バリデーション、injection 防止)。
    - `?mock-data`, `?sources` の既存処理もリファクタリング。
- 風ぐるま (千代田区コミュニティバス) のブランドカラー (`#E94185`) を設定。
- `describe-resources --verbose` にブランドカラー、認証情報、カタログ詳細等の全フィールドを出力。

### Fixed

- バス停選択時の路線ハイライトが、本日の運行が全て終了している場合に機能しない問題を修正。
    - `StopWithMeta` に `routes: Route[]` を追加 (timetable データから解決、共有参照)。
    - `extractRouteIdsForStop` が departure groups 空のとき `routes` にフォールバック。
- BottomSheet の事業者フィルター pill のコントラスト不足を修正。ブランドカラーの bg/text をそのまま使用。
- BottomSheet のフィルター行が横スクロール不可だった問題を修正。スクロールバー非表示の横スクロールを追加。
- 本番環境で INFO ログが出力されない問題を修正 (`VITE_LOG_TAGS` を `*` に設定)。
- CI workflow で untracked ファイルが検知されない問題を修正 (`git add` + `--cached`)。
- CI workflow の rerun 時に push が失敗する問題を修正 (`git pull --ff-only` を checkout 直後に追加)。

### Changed

- 型ファイル分割: `transit.ts` を GTFS ドメイン型 (安定) と `transit-composed.ts` アプリ合成型 (可変) に分離。
- PRD.md の URL パラメータ仕様に `lat`, `lng`, `zm` を追加。

## [2026.03.16]

### Added

- 事業者識別 (Agency) + i18n FK 化:
    - `StopJson` / `RouteJson` / `AgencyJson` から翻訳 (`m`) を削除し、`TranslationsJson` に一元化 (FK 化)。
    - `TranslationsJson` に `stop_names`, `route_names`, `agency_names`, `agency_short_names` を追加。
    - `StopJson` / `TimetableGroupJson` に `ai` (agency_id FK) を追加。
    - `AgencyJson` を拡張: `sn` (short_name), `tz` (timezone), `fu` (fare_url), `cs` (brand colors 配列)。
    - `Provider` 型を拡張: `name` (ja/en long/short), `colors` (brand colors)。
    - 全ソース定義にブランドカラーと short name を設定。
    - `Stop` ドメイン型に `agency_id` を追加。
    - `Agency` ドメイン型に `agency_short_name`, `agency_short_names`, `agency_timezone`, `agency_fare_url`, `agency_colors` を追加。
    - `DepartureGroup` / `FullDayStopDeparture` に `headsign_names` を追加。
    - `StopWithContext` に `agencies` を追加。
    - `RouteWithMeta` / `RouteWithContext` 型を新設。
    - `TransitRepository` に `getAgency()` メソッドを追加。
    - `AthenaiRepository.mergeSources` で翻訳 FK 解決、agencyMap 構築を実装。
    - headsign/stop_headsign 翻訳を事業者 (ソース) スコープで管理。異なる事業者の同一行先名 (例: 「練馬駅」) が独立した翻訳を保持。
- 路線形状 (shapes) パイプラインの分離:
    - GTFS shapes 抽出を `build-route-shapes-from-gtfs.ts` に分離。
    - KSJ 鉄道スクリプトを `build-route-shapes-from-ksj-railway.ts` にリネーム。
    - 全 shapes スクリプトを統一 CLI インターフェース (`<name>`, `--targets`, `--list`) に対応。
    - `shapes.json` をアプリ側で optional 化 (ファイルがないソースは `{}` にフォールバック)。
    - npm scripts: `pipeline:build:shapes:gtfs`, `pipeline:build:shapes:ksj`。

- 事業者バッジ表示とフィルタ:
    - `StopWithMeta` に `agencies: Agency[]` を追加。repo が timetable データから全 stop の事業者を解決。
    - `StopWithContext extends StopWithMeta` に変更 (stop, agencies の重複フィールドを排除)。
    - `AgencyBadge` コンポーネントを追加。NearbyStop カード、departure 行、時刻表モーダル、マーカー tooltip に事業者名を表示。
    - BottomSheet に事業者フィルタ PillButton を追加 (2事業者以上で表示)。
    - `filterStopsByAgency()`, `collectPresentAgencies()` domain 関数を追加。
    - `getAgencyDisplayNames` / `resolveAgencyDisplayName` / `translateAgencyName` (i18n 対応)。
    - RouteBadge に verbose IdBadge を追加 (HeadsignBadge, AgencyBadge と統一)。
- 共同運行路線分析ツール:
    - `pipeline/scripts/analysis/find-joint-routes.ts` を追加。ソース間で route_short_name が一致する路線を検出し、停留所名の突き合わせと座標による近接分析を行う。
    - `pipeline/lib/normalize-stop-name.ts` を追加。ソース間の stop_name 表記揺れ (「前」有無、ヶ/ケ、ノ/の) を正規化。
- 開発ツール入口:
    - `pipeline/scripts/dev-tools.ts` を追加。分析/開発ツールを対話的に選択実行。
    - npm script: `pipeline:dev-tools`。
- データ品質ドキュメント:
    - `pipeline/resources/NOTES.md` に共同運行路線の停留所差異パターン、コミュニティバスの運営主体乖離、route_short_name 通称問題を追加。

### Changed

- `describe-resources.ts` を `pipeline/scripts/analysis/` に移動。
- `visibleRouteShapes` のデフォルトを route_type 0-7 全てに拡大。
- パイプラインの出力方式をディレクトリ swap からファイルマージに変更。
  複数スクリプトが同一 outdir に出力しても互いのファイルを上書きしない。
  各スクリプトが MANAGED_FILES リストで管理責務を明示。
- リソース定義ファイルのフィールド順を BaseResource 定義順に統一。
- 重複テストファイル `pipeline/scripts/__tests__/build-app-data-from-gtfs.test.ts` を削除。

## [2026.03.14]

### Added

- データソースの追加:
    - ゆりかもめ (新交通ゆりかもめ) の時刻表・駅情報・路線形状に対応。
      ODPT Train API からアプリ用データを生成するパイプライン (`pipeline:build:odpt-train`) を新設。
    - 関東バス (ktbus) のデータソースを追加。
    - 京王バス (kobus) のデータソースを追加。
    - 杉並区グリーンスローモビリティの表示を有効化。
    - 風ぐるま (kazag) — 千代田区コミュニティバスを追加。6路線、shapes あり。
- 行先表示名リゾルバー (`getHeadsignDisplayNames`) を追加。
  行先の表示名を解決し、出発情報の UI コンポーネントに適用。
- 国土数値情報 (MLIT) からの鉄道路線形状生成を複数ソース対応に拡張。
  `mlitShapeMapping` を持つ全リソース (GTFS + ODPT JSON) を自動検出して処理。
- GTFS データパイプラインの大幅拡張 (Step 2+3)。
    - Build DB スキーマを GTFS 公式仕様 + GTFS-JP v3 の全34テーブルに拡張。
    - JSON 出力を5 → 8ファイル/ソースに拡張 (agency, feed-info, translations を追加)。
    - スキーマ定義を `pipeline/lib/gtfs-schema.ts` に分離し、設計判断をドキュメント化。
- 事業者情報/翻訳/フィードメタデータの型とデータフローを追加。
    - Route 型に `route_names` (多言語名)、`agency_id` を追加。Agency, FeedInfo 型を新規追加。
    - DataSource に optional な agencies, feedInfo, translations を追加。
    - `translateRouteName` で翻訳ルックアップを有効化。
- パイプラインドキュメント (`GTFS_TO_RDB.md`, `APP_DATA_FROM_GTFS.md`) を追加。
- route color の wildcard fallback 対応をパイプラインに追加。
- `buildAuthenticatedUrl` ユーティリティを抽出。
- AthenaiRepository に初期化統計ログ (info) とクエリ結果ログ (debug) を追加。
  fetch/merge の処理時間内訳、ソース別統計、truncation 件数を出力。
- FetchDataSource にファイル別 fetch タイミング/サイズの debug ログを追加。
- 行先が空の route に「行先が表示されない路線があります」注釈を表示。
  停留所カード、全路線時刻表、路線別時刻表の3箇所に対応。
- `?sources=` URL パラメータによるデータソース選択。
  `?sources=minkuru,yurimo` で指定ソースのみ、`?sources=all` で全ソース有効。
- perf profile に `maxResults` を追加 (lite=300, normal=3000, full=10000)。
  マーカー描画数をモードに応じて制限。
- モード切替 (perfMode, renderMode, infoLevel, theme) に info レベルログを追加。
- マーカー描画時間の計測ログ (debug) を StopMarkersCanvas に追加。
- 全4種のマーカーコンポーネントにクリック debug ログを追加。

### Changed

- `GtfsRepository` を `AthenaiRepository` にリネーム。
  `MAX_STOPS_RESULT` を `types/app/repository` から `transit-repository` に移動。
- `AthenaiRepository.create()` から `fetchSources()` / `mergeSources()` を分離。
- データ prefix のリネーム: tobus→minkuru (都営バス)、yrkm→yurimo (ゆりかもめ)。
- `SourceGroup` に `enabled` フィールドを追加 (必須)。デフォルトは enabled のみロード。
- `build-gtfs-db.ts` を単一ソース CLI に再設計。
  一括処理は `--targets` で子プロセス実行。安全なビルド (一時ファイル → リネーム) を実装。
- `pipeline-utils.ts` を `download-utils.ts` から分離し、汎用 CLI ユーティリティを独立モジュール化。
- `data-source-settings.json` を TypeScript (`data-source-settings.ts`) に変換。
- 高頻度マーカー描画ログを verbose レベルに降格。

### Fixed

- Vercel SPA fallback (200+HTML) により optional JSON の取得失敗がアプリ全体のデータ読み込みを阻害していた問題を修正。
- CSV ファイルが0件のソースディレクトリで既存 DB を空 DB で上書きする問題を修正。
- GTFS-JP v3 の `pattern_jp` スキーマ定義を修正。
- `getUpcomingDepartures` の debug ログで未定義変数 `truncated` を参照していた ReferenceError を修正。
- headsign が空文字の場合に React key が重複する問題を修正。
- 全ダイアログに `DialogDescription` を追加 (Radix アクセシビリティ警告の解消)。
- Canvas marker のクリックが動作しない問題を修正 (re-dispatch に座標情報が欠落)。
- ODPT train: 複数 railway のデータが正しく処理されない問題を修正。
- ODPT train: `computeDateRange` のうるう年処理を修正。
- ODPT train: `buildTimetable` / `buildTranslations` のキー衝突を修正。

## [2026.03.12]

初回リリース。atenai-v0 リポジトリからのポーティングと改善。

### Added

- プロジェクト基盤 (Vite, TypeScript, ESLint, Prettier, Vercel) の構築
- GTFS/ODPT データパイプライン (CSV → SQLite → JSON) の移植
- ウェブアプリ本体 (React, Leaflet, shadcn/ui) の移植
- プロジェクトドキュメント (PRD.md, CLAUDE.md, DEVELOPMENT.md, ABOUT.md)

### Fixed

- 当日の全便が終了した停留所の [時刻表] が表示されない不具合を修正。
  `handleShowStopTimetable` が upcoming departures に依存していたため、
  全便終了後は時刻表データが取得されなかった。
  新メソッド `getFullDayDeparturesForStop` を追加し解消。
- ダブルタップ検出時の再ディスパッチで修飾キー (Ctrl, Shift, Alt, Meta) が
  失われる問題を修正。
- `route-shape-polyline` のソート時に React key が不安定になる問題を
  `stableIndex` で修正。
- `use-stop-history` の localStorage 読み込み時に破損データでクラッシュする
  問題を修正。バリデーションを追加。
- `data-source-manager` の localStorage 読み込みに try/catch を追加。
