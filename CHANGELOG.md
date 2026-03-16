# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [CalVer](https://calver.org/).

## [Unreleased]

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
